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
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score, balanced_accuracy_score
from sklearn.utils.class_weight import compute_class_weight
from sklearn.ensemble import ExtraTreesClassifier, RandomForestClassifier, HistGradientBoostingClassifier
from sklearn.neural_network import MLPClassifier
from sklearn.calibration import CalibratedClassifierCV

TARGET_CLASSES = ['Bronchiectasis', 'Bronchiolitis', 'COPD', 'Healthy', 'Pneumonia', 'URTI']
CACHE_PATH = Path('features_cache_6class.npz')

if not CACHE_PATH.exists():
    print(f"Error: Cache file not found at {CACHE_PATH}")
    sys.exit(1)

data = np.load(CACHE_PATH)
X = data['features']
y = data['labels']
filenames = data['filenames']

print("=" * 60)
print(f"Dataset: {len(X)} samples, {X.shape[1]} features")
counts = Counter(y)
for idx, cls_name in enumerate(TARGET_CLASSES):
    print(f"  {cls_name} (idx {idx}): {counts[idx]} samples ({counts[idx]/len(X)*100:.1f}%)")
print("=" * 60)

# 1. Evaluate classical ML models
print("\n--- Benchmarking Classifiers (Stratified 5-Fold Cross-Validation) ---")
skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)

models_to_test = {
    "HistGradientBoosting": HistGradientBoostingClassifier(class_weight='balanced', random_state=42, max_iter=200, l2_regularization=1.0),
    "ExtraTrees (Balanced)": ExtraTreesClassifier(n_estimators=300, class_weight='balanced', random_state=42, max_depth=15),
    "RandomForest (Balanced Subsample)": RandomForestClassifier(n_estimators=300, class_weight='balanced_subsample', random_state=42, max_depth=15),
    "MLP (Scikit-Learn)": MLPClassifier(hidden_layer_sizes=(256, 128), activation='relu', max_iter=300, random_state=42, alpha=0.01)
}

for name, clf in models_to_test.items():
    bal_accs = []
    accs = []
    for train_idx, val_idx in skf.split(X, y):
        X_tr, X_va = X[train_idx], X[val_idx]
        y_tr, y_va = y[train_idx], y[val_idx]
        
        clf.fit(X_tr, y_tr)
        preds = clf.predict(X_va)
        accs.append(accuracy_score(y_va, preds))
        bal_accs.append(balanced_accuracy_score(y_va, preds))
    
    print(f"{name:35}: Accuracy = {np.mean(accs)*100:.2f}%, Balanced Accuracy = {np.mean(bal_accs)*100:.2f}%")

print("\n--- Training Deep Residual MLP with Mixup / Feature Augmentation & Focal Weighting ---")

def build_advanced_residual_mlp(input_dim=768, num_classes=6):
    inputs = layers.Input(shape=(input_dim,))
    
    # Dense block 1
    x = layers.Dense(384, kernel_regularizer=regularizers.l2(1e-4))(inputs)
    x = layers.BatchNormalization()(x)
    x = layers.Activation('swish')(x)
    x = layers.Dropout(0.3)(x)
    
    # Residual Block 1
    res1 = x
    x = layers.Dense(384, kernel_regularizer=regularizers.l2(1e-4))(x)
    x = layers.BatchNormalization()(x)
    x = layers.Activation('swish')(x)
    x = layers.Dropout(0.3)(x)
    x = layers.Dense(384, kernel_regularizer=regularizers.l2(1e-4))(x)
    x = layers.BatchNormalization()(x)
    x = layers.add([x, res1])
    x = layers.Activation('swish')(x)
    
    # Dense block 2
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
    
    # Final dense & softmax
    x = layers.Dense(64, activation='swish', kernel_regularizer=regularizers.l2(1e-4))(x)
    x = layers.Dropout(0.2)(x)
    outputs = layers.Dense(num_classes, activation='softmax')(x)
    
    model = keras.Model(inputs=inputs, outputs=outputs)
    model.compile(
        optimizer=optimizers.Adam(learning_rate=1e-3),
        loss='sparse_categorical_crossentropy',
        metrics=['accuracy']
    )
    return model

# Test Neural MLP with 5-Fold CV
nn_accs = []
nn_bal_accs = []
for train_idx, val_idx in skf.split(X, y):
    X_tr, X_va = X[train_idx], X[val_idx]
    y_tr, y_va = y[train_idx], y[val_idx]
    
    # Compute effective weights
    raw_weights = compute_class_weight('balanced', classes=np.arange(6), y=y_tr)
    # Dampen extreme COPD imbalance slightly with power factor 0.8 to balance precision/recall
    effective_weights = {i: float(w ** 0.85) for i, w in enumerate(raw_weights)}
    
    # Feature-level minority data augmentation (jittering & mixup in embedding space)
    augmented_X = [X_tr]
    augmented_y = [y_tr]
    
    for c in range(6):
        if c == 2:  # skip COPD
            continue
        c_samples = X_tr[y_tr == c]
        if len(c_samples) > 0:
            # Generate jittered samples for minority classes
            n_aug = max(1, int(150 / len(c_samples)))
            for _ in range(n_aug):
                noise = np.random.normal(0, 0.02, c_samples.shape)
                augmented_X.append(c_samples + noise)
                augmented_y.append(np.full(len(c_samples), c))
                
                # Pairwise interpolation (mixup within class)
                if len(c_samples) > 1:
                    idx_perm = np.random.permutation(len(c_samples))
                    lambdas = np.random.uniform(0.3, 0.7, (len(c_samples), 1))
                    mix = lambdas * c_samples + (1 - lambdas) * c_samples[idx_perm]
                    augmented_X.append(mix)
                    augmented_y.append(np.full(len(c_samples), c))
    
    X_tr_aug = np.vstack(augmented_X)
    y_tr_aug = np.concatenate(augmented_y)
    
    model = build_advanced_residual_mlp(input_dim=768, num_classes=6)
    
    lr_schedule = callbacks.ReduceLROnPlateau(monitor='val_loss', factor=0.5, patience=5, min_lr=1e-5, verbose=0)
    early_stop = callbacks.EarlyStopping(monitor='val_loss', patience=18, restore_best_weights=True, verbose=0)
    
    model.fit(
        X_tr_aug, y_tr_aug,
        validation_data=(X_va, y_va),
        epochs=80,
        batch_size=32,
        class_weight=effective_weights,
        callbacks=[lr_schedule, early_stop],
        verbose=0
    )
    
    preds_probs = model.predict(X_va, verbose=0)
    preds = np.argmax(preds_probs, axis=1)
    
    nn_accs.append(accuracy_score(y_va, preds))
    nn_bal_accs.append(balanced_accuracy_score(y_va, preds))

print(f"Deep Residual MLP with Feature Augmentation: Accuracy = {np.mean(nn_accs)*100:.2f}%, Balanced Accuracy = {np.mean(nn_bal_accs)*100:.2f}%")
