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
from tensorflow.keras import layers, regularizers
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score, balanced_accuracy_score
from sklearn.utils.class_weight import compute_class_weight

TARGET_CLASSES = ['Bronchiectasis', 'Bronchiolitis', 'COPD', 'Healthy', 'Pneumonia', 'URTI']
CACHE_PATH = Path('features_cache_6class.npz')
MODEL_OUT_PATH = Path('VoxMed') / 'Model_6class.h5'
EVAL_OUT_PATH = Path('VoxMed') / 'eval_results_6class.json'

print("="*60, flush=True)
print("VoxMed 6-Class Keras Classifier Training & Evaluation", flush=True)
print("="*60, flush=True)

if not CACHE_PATH.exists():
    print(f"Error: Cache file not found at {CACHE_PATH}", flush=True)
    sys.exit(1)

data = np.load(CACHE_PATH)
X = data['features']
y = data['labels']
filenames = data['filenames']

print(f"Loaded {len(X)} cached AST embeddings of dimension {X.shape[1]}.", flush=True)

# Stratified 70% train, 15% val, 15% test
X_train_val, X_test, y_train_val, y_test, f_train_val, f_test = train_test_split(
    X, y, filenames, test_size=0.15, random_state=42, stratify=y
)
X_train, X_val, y_train, y_val, f_train, f_val = train_test_split(
    X_train_val, y_train_val, f_train_val, test_size=0.1765, random_state=42, stratify=y_train_val
)

print(f"Split sizes: Train={len(X_train)}, Val={len(X_val)}, Test={len(X_test)}", flush=True)

classes = np.unique(y_train)
raw_weights = compute_class_weight(class_weight='balanced', classes=classes, y=y_train)
class_weights_dict = {int(i): float(w) for i, w in zip(classes, raw_weights)}

print("\nComputed Balanced Class Weights:", flush=True)
for i, cls_name in enumerate(TARGET_CLASSES):
    print(f"  {cls_name} (idx {i}): {class_weights_dict.get(i, 1.0):.4f}", flush=True)

tf.keras.utils.set_random_seed(42)
np.random.seed(42)

# Neural architecture (1D-CNN + Dense classifier)
model = keras.Sequential([
    layers.Input(shape=(768, 1)),
    layers.Conv1D(32, kernel_size=3, padding='same', activation='relu', kernel_regularizer=regularizers.l2(1e-3)),
    layers.BatchNormalization(),
    layers.MaxPooling1D(pool_size=2),
    layers.Dropout(0.2),
    
    layers.Flatten(),
    layers.Dense(64, activation='relu', kernel_regularizer=regularizers.l2(1e-2)),
    layers.Dropout(0.3),
    layers.Dense(6, activation='softmax', kernel_regularizer=regularizers.l2(1e-2))
])

model.compile(
    optimizer=keras.optimizers.Adam(learning_rate=3e-4),
    loss='sparse_categorical_crossentropy',
    metrics=['accuracy']
)

model.summary()

callbacks = [
    keras.callbacks.EarlyStopping(monitor='val_accuracy', patience=20, restore_best_weights=True, mode='max', verbose=1),
    keras.callbacks.ReduceLROnPlateau(monitor='val_loss', factor=0.5, patience=5, min_lr=1e-5, verbose=1)
]

history = model.fit(
    X_train.reshape(-1, 768, 1), y_train,
    validation_data=(X_val.reshape(-1, 768, 1), y_val),
    epochs=100,
    batch_size=32,
    class_weight=class_weights_dict,
    callbacks=callbacks,
    verbose=2
)

# Evaluate on Held-Out Test Set
print("\n" + "="*60, flush=True)
print("Evaluating Model on Held-Out Test Set...", flush=True)
print("="*60, flush=True)

y_pred_probs = model.predict(X_test.reshape(-1, 768, 1), verbose=0)
y_pred = np.argmax(y_pred_probs, axis=1)

test_acc = float(accuracy_score(y_test, y_pred))
bal_acc = float(balanced_accuracy_score(y_test, y_pred))
report = classification_report(y_test, y_pred, target_names=TARGET_CLASSES, output_dict=True, zero_division=0)
report_str = classification_report(y_test, y_pred, target_names=TARGET_CLASSES, zero_division=0)
cm = confusion_matrix(y_test, y_pred).tolist()

print(f"\nTEST ACCURACY: {test_acc*100:.2f}%", flush=True)
print(f"BALANCED ACCURACY: {bal_acc*100:.2f}%\n", flush=True)
print(report_str, flush=True)

print("CONFUSION MATRIX (Rows: True, Cols: Predicted):", flush=True)
header = f"{'':16}" + "".join([f"{c[:8]:>10}" for c in TARGET_CLASSES])
print(header, flush=True)
for i, cls in enumerate(TARGET_CLASSES):
    row_str = f"{cls:16}" + "".join([f"{cm[i][j]:>10}" for j in range(len(TARGET_CLASSES))])
    print(row_str, flush=True)

# Save Model and Metrics
MODEL_OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
print(f"\nSaving model to {MODEL_OUT_PATH.resolve()}...", flush=True)
model.save(str(MODEL_OUT_PATH))
print("Model saved successfully.", flush=True)

eval_data = {
    'target_classes': TARGET_CLASSES,
    'test_accuracy': test_acc,
    'balanced_accuracy': bal_acc,
    'classification_report': report,
    'confusion_matrix': cm,
    'test_support': {cls: int(np.sum(y_test == i)) for i, cls in enumerate(TARGET_CLASSES)},
    'train_support': {cls: int(np.sum(y_train == i)) for i, cls in enumerate(TARGET_CLASSES)},
    'class_weights': class_weights_dict
}

with open(EVAL_OUT_PATH, 'w') as f:
    json.dump(eval_data, f, indent=2)

print(f"Saved evaluation results to {EVAL_OUT_PATH.resolve()}", flush=True)
