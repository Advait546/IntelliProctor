"""
Split-Safe Train-Only Augmentation for IntelliProctor Dataset_it2.

Augments ONLY the training split (Dataset_it2/images/train and Dataset_it2/labels/train).
Leaves validation (images/val, labels/val) and test (images/test, labels/test) 100% UNTOUCHED.
Creates a self-contained augmented dataset directory: Dataset_it2_augmented/
"""

import shutil
from pathlib import Path
import cv2
import albumentations as A
import yaml

# ============================================================
# PATHS
# ============================================================

PROJECT_ROOT = Path(__file__).resolve().parent.parent
SOURCE_DATASET = PROJECT_ROOT / "Dataset_it2"
TARGET_DATASET = PROJECT_ROOT / "Dataset_it2_augmented"

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}

AUGMENTATION_NAMES = [
    "rotate",
    "flip",
    "brightness",
    "gaussian_blur",
    "motion_blur",
    "zoom_in",
    "zoom_out",
    "crop",
    "noise",
    "compression",
    "rotate_brightness",
    "rotate_blur",
    "flip_brightness",
    "zoom_blur",
    "noise_compression",
    "rotate_zoom_brightness_blur",
]


def build_transform(name, has_bboxes, image_height, image_width):
    if name == "rotate":
        transforms = [A.Affine(rotate=(-12, 12), keep_ratio=True, p=1.0)]
    elif name == "flip":
        transforms = [A.HorizontalFlip(p=1.0)]
    elif name == "brightness":
        transforms = [A.RandomBrightnessContrast(brightness_limit=0.25, contrast_limit=0.20, p=1.0)]
    elif name == "gaussian_blur":
        transforms = [A.GaussianBlur(blur_limit=(3, 7), p=1.0)]
    elif name == "motion_blur":
        transforms = [A.MotionBlur(blur_limit=(3, 7), p=1.0)]
    elif name == "zoom_in":
        transforms = [A.Affine(scale=(1.05, 1.20), keep_ratio=True, p=1.0)]
    elif name == "zoom_out":
        transforms = [A.Affine(scale=(0.85, 0.95), keep_ratio=True, p=1.0)]
    elif name == "crop":
        if has_bboxes:
            transforms = [A.RandomSizedBBoxSafeCrop(height=image_height, width=image_width, erosion_rate=0.10, p=1.0)]
        else:
            transforms = [A.RandomResizedCrop(size=(image_height, image_width), scale=(0.75, 0.95), ratio=(0.90, 1.10), p=1.0)]
    elif name == "noise":
        transforms = [A.GaussNoise(std_range=(0.03, 0.08), mean_range=(0.0, 0.0), per_channel=True, p=1.0)]
    elif name == "compression":
        transforms = [A.ImageCompression(quality_range=(40, 75), compression_type="jpeg", p=1.0)]
    elif name == "rotate_brightness":
        transforms = [
            A.Affine(rotate=(-10, 10), keep_ratio=True, p=1.0),
            A.RandomBrightnessContrast(brightness_limit=0.20, contrast_limit=0.15, p=1.0),
        ]
    elif name == "rotate_blur":
        transforms = [
            A.Affine(rotate=(-10, 10), keep_ratio=True, p=1.0),
            A.GaussianBlur(blur_limit=(3, 5), p=1.0),
        ]
    elif name == "flip_brightness":
        transforms = [
            A.HorizontalFlip(p=1.0),
            A.RandomBrightnessContrast(brightness_limit=0.20, contrast_limit=0.15, p=1.0),
        ]
    elif name == "zoom_blur":
        transforms = [
            A.Affine(scale=(1.05, 1.15), keep_ratio=True, p=1.0),
            A.GaussianBlur(blur_limit=(3, 5), p=1.0),
        ]
    elif name == "noise_compression":
        transforms = [
            A.GaussNoise(std_range=(0.03, 0.07), mean_range=(0.0, 0.0), per_channel=True, p=1.0),
            A.ImageCompression(quality_range=(45, 75), compression_type="jpeg", p=1.0),
        ]
    elif name == "rotate_zoom_brightness_blur":
        transforms = [
            A.Affine(rotate=(-10, 10), scale=(0.95, 1.10), keep_ratio=True, p=1.0),
            A.RandomBrightnessContrast(brightness_limit=0.15, contrast_limit=0.15, p=1.0),
            A.GaussianBlur(blur_limit=(3, 5), p=1.0),
        ]
    else:
        raise ValueError(f"Unknown augmentation: {name}")

    if has_bboxes:
        return A.Compose(
            transforms,
            bbox_params=A.BboxParams(
                format="yolo",
                label_fields=["class_labels"],
                min_visibility=0.30,
                clip=True,
                filter_invalid_bboxes=True,
            ),
        )
    return A.Compose(transforms)


def read_yolo_labels(label_path):
    bboxes, class_labels = [], []
    if not label_path.exists():
        return bboxes, class_labels

    with open(label_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            parts = line.split()
            if len(parts) != 5:
                continue
            cls_id = int(parts[0])
            xc, yc, w, h = map(float, parts[1:])
            bboxes.append((xc, yc, w, h))
            class_labels.append(cls_id)
    return bboxes, class_labels


def save_yolo_labels(label_path, bboxes, class_labels):
    label_path.parent.mkdir(parents=True, exist_ok=True)
    with open(label_path, "w", encoding="utf-8") as f:
        for bbox, class_id in zip(bboxes, class_labels):
            xc, yc, w, h = bbox
            f.write(f"{int(class_id)} {float(xc):.6f} {float(yc):.6f} {float(w):.6f} {float(h):.6f}\n")


def copy_split_unmodified(src_images_dir, src_labels_dir, dst_images_dir, dst_labels_dir):
    dst_images_dir.mkdir(parents=True, exist_ok=True)
    dst_labels_dir.mkdir(parents=True, exist_ok=True)
    images = [p for p in src_images_dir.iterdir() if p.suffix.lower() in IMAGE_EXTENSIONS]
    for img in images:
        shutil.copy2(img, dst_images_dir / img.name)
        lbl = src_labels_dir / f"{img.stem}.txt"
        dst_lbl = dst_labels_dir / f"{img.stem}.txt"
        if lbl.exists():
            shutil.copy2(lbl, dst_lbl)
        else:
            dst_lbl.write_text("", encoding="utf-8")
    return len(images)


def augment_training_split():
    print("=" * 80)
    print("INTELLIPROCTOR: TRAIN-SPLIT OFFLINE AUGMENTATION")
    print("=" * 80)
    print(f"Source Dataset: {SOURCE_DATASET}")
    print(f"Target Dataset: {TARGET_DATASET}")
    print("=" * 80)

    if TARGET_DATASET.exists():
        print(f"Cleaning existing target directory: {TARGET_DATASET}")
        shutil.rmtree(TARGET_DATASET)

    # 1. Copy Validation and Test splits 100% UNMODIFIED
    print("\n[1/3] Copying validation split (untouched)...")
    val_count = copy_split_unmodified(
        SOURCE_DATASET / "images" / "val",
        SOURCE_DATASET / "labels" / "val",
        TARGET_DATASET / "images" / "val",
        TARGET_DATASET / "labels" / "val",
    )
    print(f"Copied {val_count} untouched validation samples.")

    print("\n[2/3] Copying test split (untouched)...")
    test_count = copy_split_unmodified(
        SOURCE_DATASET / "images" / "test",
        SOURCE_DATASET / "labels" / "test",
        TARGET_DATASET / "images" / "test",
        TARGET_DATASET / "labels" / "test",
    )
    print(f"Copied {test_count} untouched test samples.")

    # 2. Process Training Split
    print("\n[3/3] Processing training split (copying originals + generating augmentations)...")
    src_train_img = SOURCE_DATASET / "images" / "train"
    src_train_lbl = SOURCE_DATASET / "labels" / "train"
    dst_train_img = TARGET_DATASET / "images" / "train"
    dst_train_lbl = TARGET_DATASET / "labels" / "train"
    dst_train_img.mkdir(parents=True, exist_ok=True)
    dst_train_lbl.mkdir(parents=True, exist_ok=True)

    train_images = sorted([p for p in src_train_img.iterdir() if p.suffix.lower() in IMAGE_EXTENSIONS])
    print(f"Found {len(train_images)} original training images.")

    original_positives = 0
    original_negatives = 0
    augmented_positives_created = 0

    for idx, img_path in enumerate(train_images, 1):
        image = cv2.imread(str(img_path))
        if image is None:
            print(f"WARNING: could not read {img_path.name}")
            continue

        h, w = image.shape[:2]
        lbl_path = src_train_lbl / f"{img_path.stem}.txt"
        bboxes, class_labels = read_yolo_labels(lbl_path)
        is_positive = len(bboxes) > 0

        # Always copy the original image + label
        shutil.copy2(img_path, dst_train_img / img_path.name)
        dst_lbl_path = dst_train_lbl / f"{img_path.stem}.txt"
        if lbl_path.exists():
            shutil.copy2(lbl_path, dst_lbl_path)
        else:
            dst_lbl_path.write_text("", encoding="utf-8")

        if is_positive:
            original_positives += 1
            # Generate augmentations for positive images to resolve positive scarcity
            for aug_name in AUGMENTATION_NAMES:
                transform = build_transform(aug_name, has_bboxes=True, image_height=h, image_width=w)
                try:
                    res = transform(image=image, bboxes=bboxes, class_labels=class_labels)
                    t_bboxes = res["bboxes"]
                    t_labels = res["class_labels"]
                    if len(t_bboxes) == 0:
                        continue

                    out_stem = f"{img_path.stem}__{aug_name}"
                    out_img = dst_train_img / f"{out_stem}.jpg"
                    out_lbl = dst_train_lbl / f"{out_stem}.txt"

                    cv2.imwrite(str(out_img), res["image"], [cv2.IMWRITE_JPEG_QUALITY, 95])
                    save_yolo_labels(out_lbl, t_bboxes, t_labels)
                    augmented_positives_created += 1
                except Exception as e:
                    print(f"ERROR: {img_path.name} | {aug_name} | {e}")
        else:
            original_negatives += 1

        if idx % 50 == 0 or idx == len(train_images):
            print(f"  Processed {idx}/{len(train_images)} training images...")

    # 3. Create data.yaml pointing to the new augmented dataset
    data_yaml_content = {
        "path": str(TARGET_DATASET).replace("\\", "/"),
        "train": "images/train",
        "val": "images/val",
        "test": "images/test",
        "names": {
            0: "phone",
            1: "book_notebook",
        },
    }

    yaml_path = TARGET_DATASET / "data.yaml"
    with open(yaml_path, "w", encoding="utf-8") as f:
        yaml.safe_dump(data_yaml_content, f, sort_keys=False)

    final_train_images = len([p for p in dst_train_img.iterdir() if p.suffix.lower() in IMAGE_EXTENSIONS])
    final_train_labels = len(list(dst_train_lbl.glob("*.txt")))

    print("\n" + "=" * 80)
    print("AUGMENTATION COMPLETE")
    print("=" * 80)
    print(f"Original positive training images: {original_positives}")
    print(f"Original negative training images: {original_negatives}")
    print(f"Augmented positive images created: {augmented_positives_created}")
    print(f"Final TRAIN images: {final_train_images} (Labels: {final_train_labels})")
    print(f"Final VAL images (100% untouched): {val_count}")
    print(f"Final TEST images (100% untouched): {test_count}")
    print(f"Target YAML: {yaml_path}")
    print("=" * 80)


if __name__ == "__main__":
    augment_training_split()
