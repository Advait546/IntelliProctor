"""
Phase 1 YOLO Fine-Tuning Script for IntelliProctor.

Fine-tunes YOLO11m on the domain-specific prohibited object dataset:
- data: C:/Users/tanis/dataset/yolo_dataset/data.yaml
- classes: 0 = phone, 1 = book_notebook
- negative backgrounds: water_bottle, hand_no_prohibited_object
- starting model: yolo11m.pt (COCO pretrained)
- image size: 1280
- device: CPU (utilizing Intel 13th Gen multi-threading)
- freeze: 10 (preserves pretrained backbone, trains neck + detection head)
- early stopping: patience=3, max epochs=8
- output directory: runs/detect/intelliproctor_phase1/
"""

import os
import sys
import json
import time
from pathlib import Path
import csv
import torch
torch.set_num_threads(6)
from ultralytics import YOLO

# Configuration
DATA_YAML = r"C:\Users\tanis\dataset\yolo_dataset\data.yaml"
PRETRAINED_MODEL = "yolo11m.pt"
PROJECT_DIR = str(Path("runs/detect").resolve())
RUN_NAME = "intelliproctor_phase1"
IMG_SIZE = 1280
BATCH_SIZE = 8
EPOCHS = 4
PATIENCE = 2
FREEZE_LAYERS = 10
DEVICE = "cpu"


import argparse

def parse_args():
    parser = argparse.ArgumentParser(description="Train Phase 1 YOLO11m Model for IntelliProctor.")
    parser.add_argument("--epochs", type=int, default=EPOCHS, help=f"Max training epochs (default: {EPOCHS})")
    parser.add_argument("--patience", type=int, default=PATIENCE, help=f"Early stopping patience (default: {PATIENCE})")
    parser.add_argument("--batch", type=int, default=BATCH_SIZE, help=f"Batch size (default: {BATCH_SIZE})")
    parser.add_argument("--imgsz", type=int, default=IMG_SIZE, help=f"Image size (default: {IMG_SIZE})")
    parser.add_argument("--freeze", type=int, default=FREEZE_LAYERS, help=f"Number of layers to freeze (default: {FREEZE_LAYERS})")
    parser.add_argument("--device", type=str, default=DEVICE, help=f"Compute device (default: {DEVICE})")
    parser.add_argument("--resume", action="store_true", default=False, help="Resume training from last checkpoint if available")
    return parser.parse_args()


def train_phase1(epochs=EPOCHS, patience=PATIENCE, batch=BATCH_SIZE, imgsz=IMG_SIZE, freeze_layers=FREEZE_LAYERS, device=DEVICE, resume=False):
    print("=" * 80)
    print(" INTELLIPROCTOR PHASE 1 YOLO11m FINE-TUNING")
    print("=" * 80)
    print(f"Pretrained Model : {PRETRAINED_MODEL}")
    print(f"Dataset YAML     : {DATA_YAML}")
    print(f"Image Size       : {imgsz}")
    print(f"Batch Size       : {batch}")
    print(f"Max Epochs       : {epochs}")
    print(f"Patience         : {patience}")
    print(f"Frozen Layers    : {freeze_layers} (Backbone layers 0-9)")
    print(f"Device           : {device}")
    print(f"Resume           : {resume}")
    print(f"Output Target    : {os.path.join(PROJECT_DIR, RUN_NAME)}")
    print("=" * 80)

    if not os.path.exists(PRETRAINED_MODEL):
        raise FileNotFoundError(f"Starting model weights not found: {PRETRAINED_MODEL}")
    if not os.path.exists(DATA_YAML):
        raise FileNotFoundError(f"Dataset YAML configuration not found: {DATA_YAML}")

    output_dir = Path(PROJECT_DIR) / RUN_NAME
    last_weights_path = output_dir / "weights" / "last.pt"

    start_time = time.time()
    
    if resume and last_weights_path.exists():
        print(f"\nResuming training from checkpoint: {last_weights_path}")
        model = YOLO(str(last_weights_path))
        train_results = model.train(resume=True)
    else:
        if resume:
            print(f"\nResume requested. Checkpoint {last_weights_path} not found (interrupted during Epoch 1).")
            print(f"Continuing training in existing target directory: {output_dir}")
        else:
            print("\nStarting fine-tuning...")
        model = YOLO(PRETRAINED_MODEL)
        train_results = model.train(
            data=DATA_YAML,
            epochs=epochs,
            patience=patience,
            batch=batch,
            imgsz=imgsz,
            freeze=freeze_layers,
            device=device,
            workers=0,
            mosaic=0.0,
            save_period=1,
            project=PROJECT_DIR,
            name=RUN_NAME,
            exist_ok=True,
            verbose=True,
            seed=42,
        )

    elapsed_time = time.time() - start_time
    print(f"\nTraining completed in {elapsed_time / 60:.2f} minutes ({elapsed_time:.1f} s).")

    # Inspect results directory
    output_dir = Path(PROJECT_DIR) / RUN_NAME
    results_csv_path = output_dir / "results.csv"
    best_weights_path = output_dir / "weights" / "best.pt"

    summary_metrics = {
        "pretrained_model": PRETRAINED_MODEL,
        "dataset_yaml": DATA_YAML,
        "img_size": IMG_SIZE,
        "batch_size": BATCH_SIZE,
        "target_epochs": EPOCHS,
        "patience": PATIENCE,
        "freeze_layers": FREEZE_LAYERS,
        "training_time_seconds": round(elapsed_time, 2),
        "best_weights_path": str(best_weights_path),
    }

    if results_csv_path.exists():
        rows = []
        with open(results_csv_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            # Normalize column keys
            for r in reader:
                cleaned_row = {k.strip(): float(v.strip()) if v.strip().replace(".", "", 1).replace("-", "", 1).isdigit() else v.strip() for k, v in r.items() if k is not None}
                rows.append(cleaned_row)

        if rows:
            summary_metrics["actual_epochs"] = len(rows)
            # Find best epoch based on metrics/mAP50(B)
            best_row = max(rows, key=lambda x: x.get("metrics/mAP50(B)", 0.0))
            summary_metrics["best_epoch"] = int(best_row.get("epoch", len(rows)))
            summary_metrics["best_map50"] = float(best_row.get("metrics/mAP50(B)", 0.0))
            summary_metrics["best_map50_95"] = float(best_row.get("metrics/mAP50-95(B)", 0.0))
            summary_metrics["best_precision"] = float(best_row.get("metrics/precision(B)", 0.0))
            summary_metrics["best_recall"] = float(best_row.get("metrics/recall(B)", 0.0))
            summary_metrics["train_box_loss"] = float(best_row.get("train/box_loss", 0.0))
            summary_metrics["train_cls_loss"] = float(best_row.get("train/cls_loss", 0.0))
            summary_metrics["train_dfl_loss"] = float(best_row.get("train/dfl_loss", 0.0))
            summary_metrics["val_box_loss"] = float(best_row.get("val/box_loss", 0.0))
            summary_metrics["val_cls_loss"] = float(best_row.get("val/cls_loss", 0.0))
            summary_metrics["val_dfl_loss"] = float(best_row.get("val/dfl_loss", 0.0))

    summary_file = output_dir / "training_summary.json"
    with open(summary_file, "w", encoding="utf-8") as f:
        json.dump(summary_metrics, f, indent=2)

    print("\n" + "=" * 80)
    print(" TRAINING SUMMARY METRICS")
    print("=" * 80)
    for k, v in summary_metrics.items():
        print(f"  {k:<25}: {v}")
    print("=" * 80)
    print(f"Saved summary metrics to: {summary_file}")

    # Run validation with best model to get per-class metrics
    if best_weights_path.exists():
        print("\nValidating best model on validation set...")
        best_model = YOLO(str(best_weights_path))
        val_res = best_model.val(data=DATA_YAML, imgsz=IMG_SIZE, device=DEVICE)
        
        per_class_summary = {}
        for i, name in enumerate(val_res.names.values()):
            if i < len(val_res.box.p):
                per_class_summary[name] = {
                    "precision": round(float(val_res.box.p[i]), 4),
                    "recall": round(float(val_res.box.r[i]), 4),
                    "mAP50": round(float(val_res.box.ap50[i]), 4),
                    "mAP50_95": round(float(val_res.box.ap[i]), 4),
                }
        print("\nPER-CLASS VALIDATION METRICS:")
        print(json.dumps(per_class_summary, indent=2))
        
        summary_metrics["per_class_metrics"] = per_class_summary
        with open(summary_file, "w", encoding="utf-8") as f:
            json.dump(summary_metrics, f, indent=2)

    return summary_metrics


if __name__ == "__main__":
    args = parse_args()
    train_phase1(
        epochs=args.epochs,
        patience=args.patience,
        batch=args.batch,
        imgsz=args.imgsz,
        freeze_layers=args.freeze,
        device=args.device,
        resume=args.resume,
    )
