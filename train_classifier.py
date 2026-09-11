import os
import time
import json
import warnings
from pathlib import Path
from collections import Counter

# Suppress framework and system warning noise
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'
warnings.filterwarnings('ignore')

import numpy as np
import pandas as pd
import soundfile as sf
import torch
import torchaudio
from transformers import AutoProcessor, ASTModel
import tensorflow as tf
from tensorflow.keras import layers, regularizers, models, callbacks, optimizers
from sklearn.model_selection import train_test_split
from sklearn.utils.class_weight import compute_class_weight
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score

TARGET_CLASSES = ['Bronchiectasis', 'Bronchiolitis', 'COPD', 'Healthy', 'Pneumonia', 'URTI']
CLASS_TO_IDX = {cls: idx for idx, cls in enumerate(TARGET_CLASSES)}
IDX_TO_CLASS = {idx: cls for idx, cls in enumerate(TARGET_CLASSES)}

BASE_DIR = Path(__file__).resolve().parent
AUDIO_DIR = BASE_DIR / "archive" / "Respiratory_Sound_Database" / "Respiratory_Sound_Database" / "audio_and_txt_files"
DIAG_CSV = BASE_DIR / "archive" / "Respiratory_Sound_Database" / "Respiratory_Sound_Database" / "patient_diagnosis.csv"
CACHE_PATH = BASE_DIR / "features_cache_6class.npz"
MODEL_OUTPUT_PATH = BASE_DIR / "VoxMed" / "Model_6class.h5"

def extract_all_features():
    """
    Extracts 768-dim AST features from all ICBHI dataset audio files,
    matching against the patient diagnosis labels.
    Uses cached .npz features if already extracted.
    """
    if CACHE_PATH.exists():
        print(f"Loading cached features from {CACHE_PATH}...")
        data = np.load(CACHE_PATH, allow_pickle=True)
        return data['features'], data['labels'], data['filenames']

    print("Parsing patient diagnosis mapping...")
    diag_df = pd.read_csv(DIAG_CSV, header=None, names=['patient_id', 'diagnosis'])
    diag_dict = dict(zip(diag_df['patient_id'].astype(str), diag_df['diagnosis']))

    wav_files = sorted(list(AUDIO_DIR.glob("*.wav")))
    print(f"Found {len(wav_files)} total .wav files.")

    valid_samples = []
    for wav in wav_files:
        pid = wav.stem.split('_')[0]
        if pid in diag_dict:
            diag = diag_dict[pid]
            if diag in CLASS_TO_IDX:
                valid_samples.append((wav, diag, CLASS_TO_IDX[diag]))

    print(f"Total filtered samples matching 6 target classes: {len(valid_samples)}")
    counts = Counter([item[1] for item in valid_samples])
    print("Class distribution in dataset:")
    for cls in TARGET_CLASSES:
        count = counts.get(cls, 0)
        pct = (count / len(valid_samples) * 100) if valid_samples else 0
        print(f"  {cls}: {count} ({pct:.2f}%)")

    print("\nLoading AST Model and Processor...")
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    processor = AutoProcessor.from_pretrained("MIT/ast-finetuned-audioset-10-10-0.4593")
    ast_model = ASTModel.from_pretrained("MIT/ast-finetuned-audioset-10-10-0.4593")
    ast_model.to(device)
    ast_model.eval()

    sample_rate = 16000
    features_list = []
    labels_list = []
    filenames_list = []

    print(f"Extracting features for {len(valid_samples)} files (using {device})...")
    start_time = time.time()
    for idx, (wav_path, diag_name, label_idx) in enumerate(valid_samples):
        data, fs = sf.read(str(wav_path))
        if data.ndim > 1:
            data = np.mean(data, axis=1)

        waveform = torch.from_numpy(data).float().unsqueeze(0)
        if fs != sample_rate:
            resampler = torchaudio.transforms.Resample(orig_freq=fs, new_freq=sample_rate)
            waveform = resampler(waveform)

        array = waveform.squeeze(0).numpy()
        inputs = processor(array, sampling_rate=sample_rate, return_tensors="pt")
        inputs = {k: v.to(device) for k, v in inputs.items()}

        with torch.no_grad():
            outputs = ast_model(**inputs)
            feat = outputs.last_hidden_state.squeeze().mean(axis=0).to("cpu").numpy()

        features_list.append(feat)
        labels_list.append(label_idx)
        filenames_list.append(wav_path.name)

        if (idx + 1) % 50 == 0 or (idx + 1) == len(valid_samples):
            elapsed = time.time() - start_time
            print(f"  Processed {idx + 1}/{len(valid_samples)} files ({elapsed:.1f}s)")

    features_arr = np.array(features_list, dtype=np.float32)
    labels_arr = np.array(labels_list, dtype=np.int32)
    filenames_arr = np.array(filenames_list)

    print(f"Saving extracted features to cache: {CACHE_PATH}")
    np.savez_compressed(CACHE_PATH, features=features_arr, labels=labels_arr, filenames=filenames_arr)
    return features_arr, labels_arr, filenames_arr

def build_1d_cnn_model(input_shape=(768, 1), num_classes=6):
    """
    Constructs the 1D-CNN architecture for classifying AST embeddings into 6 respiratory categories.
    """
    model = models.Sequential([
        layers.Input(shape=input_shape),
        
        layers.Conv1D(filters=128, kernel_size=5, padding='same', activation='relu', kernel_regularizer=regularizers.l2(1e-4)),
        layers.BatchNormalization(),
        layers.MaxPooling1D(pool_size=2),
        layers.Dropout(0.3),
        
        layers.Conv1D(filters=64, kernel_size=5, padding='same', activation='relu', kernel_regularizer=regularizers.l2(1e-4)),
        layers.BatchNormalization(),
        layers.MaxPooling1D(pool_size=2),
        layers.Dropout(0.3),
        
        layers.Conv1D(filters=32, kernel_size=3, padding='same', activation='relu', kernel_regularizer=regularizers.l2(1e-4)),
        layers.BatchNormalization(),
        layers.MaxPooling1D(pool_size=2),
        layers.Dropout(0.3),
        
        layers.Flatten(),
        layers.Dense(64, activation='relu', kernel_regularizer=regularizers.l2(1e-4)),
        layers.BatchNormalization(),
        layers.Dropout(0.4),
        
        layers.Dense(num_classes, activation='softmax')
    ])
    
    model.compile(
        optimizer=optimizers.Adam(learning_rate=1e-3),
        loss='sparse_categorical_crossentropy',
        metrics=['accuracy']
    )
    return model

def main():
    print("=" * 60)
    print("VoxMed 6-Class Classifier Retraining Pipeline")
    print("=" * 60)
    
    features, labels, filenames = extract_all_features()
    print(f"Feature array shape: {features.shape}")
    print(f"Labels array shape: {labels.shape}")

    # Stratified Train (70%), Val (15%), Test (15%) split
    X_train, X_temp, y_train, y_temp = train_test_split(
        features, labels, test_size=0.30, stratify=labels, random_state=42
    )
    X_val, X_test, y_val, y_test = train_test_split(
        X_temp, y_temp, test_size=0.50, stratify=y_temp, random_state=42
    )

    print(f"\nDataset Splits:")
    print(f"  Train: {X_train.shape[0]} samples")
    print(f"  Val:   {X_val.shape[0]} samples")
    print(f"  Test:  {X_test.shape[0]} samples")

    # Compute balanced class weights
    class_weights = compute_class_weight(
        class_weight='balanced',
        classes=np.arange(len(TARGET_CLASSES)),
        y=y_train
    )
    class_weight_dict = {i: float(w) for i, w in enumerate(class_weights)}
    print("\nComputed Balanced Class Weights for Training:")
    for idx, cls in enumerate(TARGET_CLASSES):
        print(f"  {cls} (idx {idx}): {class_weight_dict[idx]:.4f}")

    # Reshape features to (N, 768, 1) for 1D-CNN
    X_train_cnn = np.expand_dims(X_train, axis=-1)
    X_val_cnn = np.expand_dims(X_val, axis=-1)
    X_test_cnn = np.expand_dims(X_test, axis=-1)

    print("\nBuilding 1D-CNN Architecture...")
    model = build_1d_cnn_model(input_shape=(768, 1), num_classes=len(TARGET_CLASSES))
    model.summary()

    training_callbacks = [
        callbacks.EarlyStopping(
            monitor='val_loss',
            patience=20,
            restore_best_weights=True,
            verbose=1
        ),
        callbacks.ReduceLROnPlateau(
            monitor='val_loss',
            factor=0.5,
            patience=6,
            min_lr=1e-5,
            verbose=1
        )
    ]

    print("\nStarting Training...")
    history = model.fit(
        X_train_cnn, y_train,
        validation_data=(X_val_cnn, y_val),
        epochs=100,
        batch_size=32,
        class_weight=class_weight_dict,
        callbacks=training_callbacks,
        verbose=1
    )

    print("\nEvaluating on Held-Out Test Set...")
    y_pred_probs = model.predict(X_test_cnn)
    y_pred = np.argmax(y_pred_probs, axis=1)

    test_acc = accuracy_score(y_test, y_pred)
    report = classification_report(
        y_test, y_pred,
        labels=np.arange(len(TARGET_CLASSES)),
        target_names=TARGET_CLASSES,
        digits=4
    )
    cm = confusion_matrix(y_test, y_pred, labels=np.arange(len(TARGET_CLASSES)))

    print("=" * 60)
    print(f"TEST SET ACCURACY: {test_acc * 100:.2f}%")
    print("=" * 60)
    print("\nPER-CLASS CLASSIFICATION REPORT:")
    print(report)
    print("\nCONFUSION MATRIX:")
    print("Rows: True, Columns: Predicted")
    cm_df = pd.DataFrame(cm, index=TARGET_CLASSES, columns=TARGET_CLASSES)
    print(cm_df.to_string())
    print("=" * 60)

    # Save trained model
    MODEL_OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    print(f"\nSaving 6-Class Model to {MODEL_OUTPUT_PATH}...")
    model.save(str(MODEL_OUTPUT_PATH))
    print("Model saved successfully.")

    # Save evaluation summary to json
    report_dict = classification_report(
        y_test, y_pred,
        labels=np.arange(len(TARGET_CLASSES)),
        target_names=TARGET_CLASSES,
        output_dict=True
    )
    eval_results = {
        "target_classes": TARGET_CLASSES,
        "class_weights": class_weight_dict,
        "test_accuracy": float(test_acc),
        "classification_report": report_dict,
        "confusion_matrix": cm.tolist()
    }
    eval_json_path = BASE_DIR / "VoxMed" / "eval_results_6class.json"
    with open(eval_json_path, "w") as f:
        json.dump(eval_results, f, indent=2)
    print(f"Saved evaluation metrics to {eval_json_path}")

if __name__ == "__main__":
    main()
