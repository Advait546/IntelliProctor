"""
Comprehensive Dataset & Label Audit Script for IntelliProctor.

Audits:
1. Raw dataset (C:/Users/tanis/dataset/raw)
2. Augmented dataset (C:/Users/tanis/dataset/augmented)
3. YOLO dataset (C:/Users/tanis/dataset/yolo_dataset)

Verifies:
- File counts & image-label pairings
- Label format (class x_center y_center width height)
- Coordinate bounds (0.0 <= coord <= 1.0) and valid positive dimensions
- Class ID distribution against data.yaml definitions (0: phone, 1: book_notebook)
- Negative classes having zero bounding boxes (background images)
- Detects any annotation anomalies or class mapping bugs

Can also fix/remediate class ID misalignments (e.g., book_notebook 0 -> 1) with --fix flag.
"""

import os
import sys
import glob
import json
import argparse
from pathlib import Path
from typing import Dict, List, Any, Tuple
import cv2

DEFAULT_DATASET_DIR = Path(__file__).resolve().parent.parent / "dataset"
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
REPORT_OUTPUT_PATH = Path("tests/results/dataset_audit_report.json")


def is_image_file(path: Path) -> bool:
    return path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS


def audit_label_file(label_path: Path) -> Dict[str, Any]:
    """Validates the structure and values of a YOLO .txt label file."""
    issues = []
    boxes = []
    
    try:
        content = label_path.read_text(encoding="utf-8").strip()
    except Exception as e:
        return {"valid": False, "num_boxes": 0, "boxes": [], "issues": [f"Read error: {e}"]}

    if not content:
        return {"valid": True, "num_boxes": 0, "boxes": [], "issues": []}

    lines = content.splitlines()
    for line_idx, line in enumerate(lines, 1):
        line = line.strip()
        if not line:
            continue
        parts = line.split()
        if len(parts) != 5:
            issues.append(f"Line {line_idx}: Invalid YOLO format (expected 5 tokens, got {len(parts)}): '{line}'")
            continue
        
        try:
            cls_id = int(parts[0])
            x_center = float(parts[1])
            y_center = float(parts[2])
            width = float(parts[3])
            height = float(parts[4])
        except ValueError as e:
            issues.append(f"Line {line_idx}: Non-numeric value parsed: '{line}' ({e})")
            continue

        box_issue = False
        if not (0.0 <= x_center <= 1.0 and 0.0 <= y_center <= 1.0):
            issues.append(f"Line {line_idx}: Center coords out of [0, 1] range: ({x_center}, {y_center})")
            box_issue = True
        if not (0.0 < width <= 1.0 and 0.0 < height <= 1.0):
            issues.append(f"Line {line_idx}: Box dimensions out of (0, 1] range: ({width}, {height})")
            box_issue = True
            
        # Check boundary overflow
        x1 = x_center - width / 2.0
        x2 = x_center + width / 2.0
        y1 = y_center - height / 2.0
        y2 = y_center + height / 2.0
        if x1 < -0.05 or x2 > 1.05 or y1 < -0.05 or y2 > 1.05:
            issues.append(f"Line {line_idx}: Bounding box exceeds frame boundary significantly: [{x1:.3f}, {y1:.3f}, {x2:.3f}, {y2:.3f}]")

        boxes.append({
            "line": line_idx,
            "class_id": cls_id,
            "x_center": x_center,
            "y_center": y_center,
            "width": width,
            "height": height,
        })

    return {
        "valid": len(issues) == 0,
        "num_boxes": len(boxes),
        "boxes": boxes,
        "issues": issues,
    }


def audit_directory(category_dir: Path, expected_class_id: int = None, is_negative: bool = False) -> Dict[str, Any]:
    """Audits a category directory containing images and optional labels."""
    images = [p for p in category_dir.iterdir() if is_image_file(p)]
    label_files = [p for p in category_dir.iterdir() if p.suffix.lower() == ".txt" and p.name != "classes.txt"]
    
    img_stems = {p.stem: p for p in images}
    lbl_stems = {p.stem: p for p in label_files}

    missing_labels = sorted(list(img_stems.keys() - lbl_stems.keys()))
    orphan_labels = sorted(list(lbl_stems.keys() - img_stems.keys()))

    class_id_counts = {}
    total_boxes = 0
    corrupted_images = []
    label_issues = []

    for img_name, img_path in img_stems.items():
        try:
            # Check basic image header/decoding
            img = cv2.imread(str(img_path))
            if img is None:
                corrupted_images.append(img_path.name)
        except Exception as e:
            corrupted_images.append(f"{img_path.name} ({e})")

    for lbl_name, lbl_path in lbl_stems.items():
        res = audit_label_file(lbl_path)
        if not res["valid"] or res["issues"]:
            label_issues.append({"file": lbl_path.name, "issues": res["issues"]})
        
        total_boxes += res["num_boxes"]
        for b in res["boxes"]:
            cid = b["class_id"]
            class_id_counts[cid] = class_id_counts.get(cid, 0) + 1

    # Class ID compliance check
    anomalies = []
    if is_negative and total_boxes > 0:
        anomalies.append(f"Negative category has {total_boxes} labeled bounding boxes (expected 0 background boxes).")
    
    if expected_class_id is not None:
        for cid, count in class_id_counts.items():
            if cid != expected_class_id:
                anomalies.append(f"Found {count} bounding boxes with class ID {cid}, expected class ID {expected_class_id}.")

    return {
        "directory": str(category_dir),
        "total_images": len(images),
        "total_labels": len(label_files),
        "missing_labels_count": len(missing_labels),
        "orphan_labels_count": len(orphan_labels),
        "corrupted_images": corrupted_images,
        "total_boxes": total_boxes,
        "class_id_distribution": class_id_counts,
        "label_issues": label_issues,
        "anomalies": anomalies,
    }


def audit_yolo_split(yolo_dir: Path, split: str) -> Dict[str, Any]:
    """Audits train or val split in yolo_dataset."""
    img_dir = yolo_dir / "images" / split
    lbl_dir = yolo_dir / "labels" / split

    if not img_dir.exists() or not lbl_dir.exists():
        return {"error": f"Missing split directory for {split}"}

    images = [p for p in img_dir.iterdir() if is_image_file(p)]
    labels = list(lbl_dir.glob("*.txt"))

    img_stems = {p.stem: p for p in images}
    lbl_stems = {p.stem: p for p in labels}

    class_id_counts = {}
    total_boxes = 0
    empty_label_files = 0
    non_empty_label_files = 0
    label_issues = []

    for lbl_path in labels:
        res = audit_label_file(lbl_path)
        if res["num_boxes"] == 0:
            empty_label_files += 1
        else:
            non_empty_label_files += 1
            total_boxes += res["num_boxes"]
            for b in res["boxes"]:
                cid = b["class_id"]
                class_id_counts[cid] = class_id_counts.get(cid, 0) + 1
        
        if res["issues"]:
            label_issues.append({"file": lbl_path.name, "issues": res["issues"]})

    return {
        "split": split,
        "total_images": len(images),
        "total_labels": len(labels),
        "empty_labels (background)": empty_label_files,
        "annotated_labels": non_empty_label_files,
        "total_boxes": total_boxes,
        "class_id_distribution": class_id_counts,
        "missing_labels": len(img_stems.keys() - lbl_stems.keys()),
        "orphan_labels": len(lbl_stems.keys() - img_stems.keys()),
        "label_issues_count": len(label_issues),
    }


def run_complete_audit(dataset_dir: Path = DEFAULT_DATASET_DIR) -> Dict[str, Any]:
    print("=" * 80)
    print(" INTELLIPROCTOR DATASET & LABEL INTEGRITY AUDIT")
    print("=" * 80)
    print(f"Dataset Root Directory : {dataset_dir}")
    print("=" * 80)

    audit_report = {
        "dataset_root": str(dataset_dir),
        "raw": {},
        "augmented": {},
        "yolo_dataset": {},
        "critical_findings": [],
    }

    # 1. Audit Raw Folders
    raw_dir = dataset_dir / "raw"
    if raw_dir.exists():
        print("\n--- Auditing Raw Dataset ---")
        cfg_map = {
            "phone": {"expected_cid": 0, "is_neg": False},
            "book_notebook": {"expected_cid": 1, "is_neg": False},
            "water_bottle": {"expected_cid": None, "is_neg": True},
            "hand_no_prohibited_object": {"expected_cid": None, "is_neg": True},
        }
        for cat, cfg in cfg_map.items():
            cat_p = raw_dir / cat
            if cat_p.exists():
                res = audit_directory(cat_p, expected_class_id=cfg["expected_cid"], is_negative=cfg["is_neg"])
                audit_report["raw"][cat] = res
                print(f"  [{cat}]")
                print(f"    Images: {res['total_images']}, Labels: {res['total_labels']}, Total Boxes: {res['total_boxes']}")
                print(f"    Class distribution: {res['class_id_distribution']}")
                if res["anomalies"]:
                    for a in res["anomalies"]:
                        print(f"    CRITICAL ANOMALY: {a}")
                        audit_report["critical_findings"].append(f"Raw {cat}: {a}")

    # 2. Audit Augmented Folders
    aug_dir = dataset_dir / "augmented"
    if aug_dir.exists():
        print("\n--- Auditing Augmented Dataset ---")
        for cat, cfg in cfg_map.items():
            cat_p = aug_dir / cat
            if cat_p.exists():
                res = audit_directory(cat_p, expected_class_id=cfg["expected_cid"], is_negative=cfg["is_neg"])
                audit_report["augmented"][cat] = res
                print(f"  [{cat}]")
                print(f"    Images: {res['total_images']}, Labels: {res['total_labels']}, Total Boxes: {res['total_boxes']}")
                print(f"    Class distribution: {res['class_id_distribution']}")
                if res["anomalies"]:
                    for a in res["anomalies"]:
                        print(f"    CRITICAL ANOMALY: {a}")
                        audit_report["critical_findings"].append(f"Augmented {cat}: {a}")

    # 3. Audit YOLO Splits
    yolo_dir = dataset_dir / "yolo_dataset"
    if yolo_dir.exists():
        print("\n--- Auditing YOLO Dataset Splits ---")
        for split in ["train", "val"]:
            res = audit_yolo_split(yolo_dir, split)
            audit_report["yolo_dataset"][split] = res
            print(f"  [{split.upper()}]")
            print(f"    Images: {res['total_images']}, Labels: {res['total_labels']}")
            print(f"    Empty background labels: {res['empty_labels (background)']}")
            print(f"    Annotated labels: {res['annotated_labels']}")
            print(f"    Total bounding boxes: {res['total_boxes']}")
            print(f"    Class ID distribution: {res['class_id_distribution']}")
            
            # Check if class 1 is missing
            cids = res["class_id_distribution"]
            if 0 in cids and 1 not in cids:
                msg = f"In {split} split, Class ID 1 (book_notebook) has 0 instances! All boxes labeled as class ID 0 (phone)!"
                print(f"    CRITICAL ANOMALY: {msg}")
                audit_report["critical_findings"].append(msg)

    REPORT_OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(REPORT_OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(audit_report, f, indent=2)

    print("\n" + "=" * 80)
    print(f"Audit report saved to: {REPORT_OUTPUT_PATH.resolve()}")
    print("=" * 80)
    print("CRITICAL FINDINGS SUMMARY:")
    if audit_report["critical_findings"]:
        for idx, cf in enumerate(audit_report["critical_findings"], 1):
            print(f"  {idx}. {cf}")
    else:
        print("  None. All labels match specifications.")
    print("=" * 80)

    return audit_report


def fix_book_notebook_labels(dataset_dir: Path = DEFAULT_DATASET_DIR, dry_run: bool = True):
    """
    Remaps book_notebook annotations from class 0 to class 1.
    Dry run by default to inspect changes safely.
    """
    print(f"\nRemapping book_notebook class labels: 0 -> 1 (Dry Run: {dry_run})")
    
    # 1. Raw book_notebook
    raw_books = list((dataset_dir / "raw" / "book_notebook").glob("*.txt"))
    # 2. Augmented book_notebook
    aug_books = list((dataset_dir / "augmented" / "book_notebook").glob("*.txt"))
    # 3. yolo_dataset (only those originating from book_notebook)
    yolo_train = dataset_dir / "yolo_dataset" / "labels" / "train"
    yolo_val = dataset_dir / "yolo_dataset" / "labels" / "val"
    
    all_targets = raw_books + aug_books
    print(f"Found {len(raw_books)} raw book label files, {len(aug_books)} augmented book label files.")

    files_modified = 0
    lines_modified = 0

    for f in all_targets:
        if f.name == "classes.txt":
            continue
        content = f.read_text(encoding="utf-8").strip()
        if not content:
            continue
        new_lines = []
        file_changed = False
        for line in content.splitlines():
            parts = line.strip().split()
            if parts and parts[0] == "0":
                parts[0] = "1"
                new_lines.append(" ".join(parts))
                file_changed = True
                lines_modified += 1
            else:
                new_lines.append(line)
        if file_changed:
            files_modified += 1
            if not dry_run:
                f.write_text("\n".join(new_lines) + "\n", encoding="utf-8")

    print(f"Result: {files_modified} files ({lines_modified} boxes) remapped from class 0 to 1.")

    if not dry_run:
        # Also ensure classes.txt in raw folders are informative
        raw_book_classes = dataset_dir / "raw" / "book_notebook" / "classes.txt"
        if raw_book_classes.exists():
            raw_book_classes.write_text("phone\nbook_notebook\n", encoding="utf-8")

        # Regenerate YOLO dataset from updated raw and augmented labels
        prep_script = dataset_dir / "prepare_yolo_dataset.py"
        if prep_script.exists():
            print("\nRegenerating YOLO dataset splits via prepare_yolo_dataset.py...")
            import importlib.util
            spec = importlib.util.spec_from_file_location("prepare_yolo_dataset", str(prep_script))
            prep_module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(prep_module)
            prep_module.main()

            # Remove any stale YOLO label cache files
            for cache_file in (dataset_dir / "yolo_dataset" / "labels").rglob("*.cache"):
                try:
                    cache_file.unlink()
                    print(f"Removed stale cache file: {cache_file.name}")
                except Exception:
                    pass

        print("\nRe-running complete audit on updated dataset...")
        run_complete_audit(dataset_dir)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Audit and verify dataset integrity.")
    parser.add_argument("--fix-book-labels", action="store_true", help="Fix book_notebook class ID from 0 to 1")
    parser.add_argument("--apply-fix", action="store_true", help="Apply fix to disk (otherwise dry-run)")
    args = parser.parse_args()

    if args.fix_book_labels:
        fix_book_notebook_labels(dry_run=not args.apply_fix)
    else:
        run_complete_audit()
