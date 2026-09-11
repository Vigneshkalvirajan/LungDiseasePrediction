import os
import sys
import json
import warnings
from pathlib import Path
from collections import Counter

os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'
warnings.filterwarnings('ignore')

import numpy as np
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers, regularizers, optimizers, callbacks
from sklearn.model_selection import StratifiedKFold, train_test_split
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score, balanced_accuracy_score, f1_score
from sklearn.utils.class_weight import compute_class_weight

TARGET_CLASSES = ['Bronchiectasis', 'Bronchiolitis', 'COPD', 'Healthy', 'Pneumonia', 'URTI']
CACHE_PATH = Path('features_cache_6class.npz')

if not CACHE_PATH.exists():
    print(f"Error: Cache file not found at {CACHE_PATH}", flush=True)
    sys.exit(1)

data = np.load(CACHE_PATH)
X = data['features'].astype(np.float32)
y = data['labels'].astype(np.int32)
filenames = data['filenames']

print("=" * 70, flush=True)
print(f"Dataset: {len(X)} samples, {X.shape[1]} features", flush=True)
counts = Counter(y)
for idx, cls_name in enumerate(TARGET_CLASSES):
    print(f"  Class {idx} ({cls_name:14}): {counts[idx]:3d} samples ({counts[idx]/len(X)*100:5.1f}%)", flush=True)
print("=" * 70, flush=True)

def augment_embeddings(X_in, y_in, target_per_minority=160):
    """
    Augments minority class embeddings using jittering and convex mixup
    in AST latent space to prevent collapse to majority COPD.
    """
    aug_X = [X_in]
    aug_y = [y_in]
    
    for c in range(6):
        if c == 2:  # skip majority COPD
            continue
        c_samples = X_in[y_in == c]
        n_curr = len(c_samples)
        if n_curr == 0:
            continue
            
        needed = target_per_minority - n_curr
        if needed <= 0:
            continue
            
        # 1. Feature jittering with small Gaussian perturbation
        n_jitter = needed // 2
        jitter_repeats = (n_jitter // n_curr) + 1
        jittered = np.tile(c_samples, (jitter_repeats, 1))[:n_jitter]
        jitter_noise = np.random.normal(0, 0.025 * np.std(c_samples, axis=0, keepdims=True), jittered.shape)
        aug_X.append(jittered + jitter_noise)
        aug_y.append(np.full(n_jitter, c, dtype=np.int32))
        
        # 2. Intra-class convex mixup
        n_mix = needed - n_jitter
        if n_curr > 1 and n_mix > 0:
            idx1 = np.random.randint(0, n_curr, size=n_mix)
            idx2 = np.random.randint(0, n_curr, size=n_mix)
            # Ensure pairs are not the same index where possible
            same = (idx1 == idx2)
            idx2[same] = (idx2[same] + 1) % n_curr
            
            lambdas = np.random.beta(2.0, 2.0, size=(n_mix, 1)).astype(np.float32)
            mixed = lambdas * c_samples[idx1] + (1.0 - lambdas) * c_samples[idx2]
            aug_X.append(mixed)
            aug_y.append(np.full(n_mix, c, dtype=np.int32))
            
    X_out = np.vstack(aug_X).astype(np.float32)
    y_out = np.concatenate(aug_y).astype(np.int32)
    return X_out, y_out

def build_model(input_dim=768, num_classes=6):
    inputs = layers.Input(shape=(input_dim,))
    
    # LayerNorm for robust feature standardization
    x = layers.LayerNormalization()(inputs)
    
    # First projection block
    x = layers.Dense(384, kernel_regularizer=regularizers.l2(1e-4))(x)
    x = layers.BatchNormalization()(x)
    x = layers.Activation('swish')(x)
    x = layers.Dropout(0.35)(x)
    
    # Residual Block 1
    res1 = x
    x = layers.Dense(384, kernel_regularizer=regularizers.l2(1e-4))(x)
    x = layers.BatchNormalization()(x)
    x = layers.Activation('swish')(x)
    x = layers.Dropout(0.35)(x)
    x = layers.Dense(384, kernel_regularizer=regularizers.l2(1e-4))(x)
    x = layers.BatchNormalization()(x)
    x = layers.add([x, res1])
    x = layers.Activation('swish')(x)
    
    # Bottleneck block
    x = layers.Dense(192, kernel_regularizer=regularizers.l2(1e-4))(x)
    x = layers.BatchNormalization()(x)
    x = layers.Activation('swish')(x)
    x = layers.Dropout(0.3)(x)
    
    # Residual Block 2
    res2 = x
    x = layers.Dense(192, kernel_regularizer=regularizers.l2(1e-4))(x)
    x = layers.BatchNormalization()(x)
    x = layers.Activation('swish')(x)
    x = layers.Dropout(0.3)(x)
    x = layers.Dense(192, kernel_regularizer=regularizers.l2(1e-4))(x)
    x = layers.BatchNormalization()(x)
    x = layers.add([x, res2])
    x = layers.Activation('swish')(x)
    
    # Dense classification head
    x = layers.Dense(96, activation='swish', kernel_regularizer=regularizers.l2(1e-4))(x)
    x = layers.Dropout(0.2)(x)
    outputs = layers.Dense(num_classes, activation='softmax')(x)
    
    model = keras.Model(inputs=inputs, outputs=outputs)
    model.compile(
        optimizer=optimizers.Adam(learning_rate=1e-3),
        loss='sparse_categorical_crossentropy',
        metrics=['accuracy']
    )
    return model

print("\n--- Running 5-Fold Stratified Cross Validation ---", flush=True)
skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)

all_val_y = []
all_val_preds = []
fold_accs = []
fold_bal_accs = []
fold_macro_f1s = []

for fold, (train_idx, val_idx) in enumerate(skf.split(X, y), 1):
    X_tr, y_tr = X[train_idx], y[train_idx]
    X_va, y_va = X[val_idx], y[val_idx]
    
    # Augment training set
    X_tr_aug, y_tr_aug = augment_embeddings(X_tr, y_tr, target_per_minority=180)
    
    # Balanced weights with dampening exponent
    raw_weights = compute_class_weight('balanced', classes=np.arange(6), y=y_tr_aug)
    weights_dict = {i: float(w ** 0.8) for i, w in enumerate(raw_weights)}
    
    model = build_model(input_dim=768, num_classes=6)
    
    lr_cb = callbacks.ReduceLROnPlateau(monitor='val_loss', factor=0.5, patience=4, min_lr=1e-5, verbose=0)
    es_cb = callbacks.EarlyStopping(monitor='val_loss', patience=15, restore_best_weights=True, verbose=0)
    
    model.fit(
        X_tr_aug, y_tr_aug,
        validation_data=(X_va, y_va),
        epochs=75,
        batch_size=32,
        class_weight=weights_dict,
        callbacks=[lr_cb, es_cb],
        verbose=0
    )
    
    val_probs = model.predict(X_va, verbose=0)
    val_pred = np.argmax(val_probs, axis=1)
    
    acc = accuracy_score(y_va, val_pred)
    bal_acc = balanced_accuracy_score(y_va, val_pred)
    mf1 = f1_score(y_va, val_pred, average='macro')
    
    fold_accs.append(acc)
    fold_bal_accs.append(bal_acc)
    fold_macro_f1s.append(mf1)
    
    all_val_y.extend(y_va)
    all_val_preds.extend(val_pred)
    print(f"Fold {fold}: Accuracy = {acc*100:5.2f}%, Balanced Acc = {bal_acc*100:5.2f}%, Macro F1 = {mf1*100:5.2f}%", flush=True)

print("\n" + "=" * 70, flush=True)
print(f"5-Fold CV Mean Accuracy:         {np.mean(fold_accs)*100:.2f}% ± {np.std(fold_accs)*100:.2f}%", flush=True)
print(f"5-Fold CV Mean Balanced Accuracy:{np.mean(fold_bal_accs)*100:.2f}% ± {np.std(fold_bal_accs)*100:.2f}%", flush=True)
print(f"5-Fold CV Mean Macro F1:         {np.mean(fold_macro_f1s)*100:.2f}% ± {np.std(fold_macro_f1s)*100:.2f}%", flush=True)
print("=" * 70, flush=True)
print("\nAggregate Out-of-Fold Classification Report:", flush=True)
print(classification_report(all_val_y, all_val_preds, target_names=TARGET_CLASSES, digits=3), flush=True)
print("Confusion Matrix:", flush=True)
print(confusion_matrix(all_val_y, all_val_preds), flush=True)

print("\n--- Training Final Production Model on Full Dataset ---", flush=True)
X_train_full, y_train_full = augment_embeddings(X, y, target_per_minority=200)
raw_weights_full = compute_class_weight('balanced', classes=np.arange(6), y=y_train_full)
weights_full_dict = {i: float(w ** 0.8) for i, w in enumerate(raw_weights_full)}

final_model = build_model(input_dim=768, num_classes=6)
final_model.fit(
    X_train_full, y_train_full,
    epochs=60,
    batch_size=32,
    class_weight=weights_full_dict,
    verbose=1
)

# Save the production model to both locations
voxmed_dir = Path("VoxMed")
voxmed_dir.mkdir(exist_ok=True)
model_h5 = voxmed_dir / "Model.h5"
model_6class_h5 = voxmed_dir / "Model_6class.h5"

final_model.save(str(model_h5))
final_model.save(str(model_6class_h5))
print(f"Saved production models to {model_h5} and {model_6class_h5}", flush=True)

# Save evaluation results metadata
eval_metrics = {
    "model_architecture": "Deep Residual MLP with LayerNormalization & Feature Augmentation",
    "feature_extractor": "MIT/ast-finetuned-audioset-10-10-0.4593",
    "embedding_dim": 768,
    "target_classes": TARGET_CLASSES,
    "cv_accuracy": float(np.mean(fold_accs)),
    "cv_balanced_accuracy": float(np.mean(fold_bal_accs)),
    "cv_macro_f1": float(np.mean(fold_macro_f1s)),
    "classification_report": classification_report(all_val_y, all_val_preds, target_names=TARGET_CLASSES, output_dict=True),
    "confusion_matrix": confusion_matrix(all_val_y, all_val_preds).tolist()
}

with open(voxmed_dir / "eval_results_6class.json", "w") as f:
    json.dump(eval_metrics, f, indent=2)
print("Updated eval_results_6class.json successfully.", flush=True)
