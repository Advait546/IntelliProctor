from pathlib import Path
import random
import shutil
import yaml

DATASET_DIR = Path(__file__).resolve().parent
RAW_DIR = DATASET_DIR / "raw"
AUGMENTED_DIR = DATASET_DIR / "augmented"
YOLO_DIR = DATASET_DIR / "yolo_dataset"

CLASS_NAMES = ["phone", "book_notebook"]
POSITIVE_CLASSES = {"phone", "book_notebook"}
NEGATIVE_CLASSES = {"water_bottle", "hand_no_prohibited_object"}
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}

VAL_RATIO = 0.20
SEED = 42


def is_image(path):
    return path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS


def copy_file(src, dst):
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)


def create_or_copy_label(image_path, output_label, positive):
    source_label = image_path.with_suffix(".txt")
    if source_label.exists():
        copy_file(source_label, output_label)
    elif positive:
        raise FileNotFoundError(
            f"Missing YOLO label for positive image:\n{image_path}"
        )
    else:
        output_label.parent.mkdir(parents=True, exist_ok=True)
        output_label.write_text("", encoding="utf-8")


def split_images(images, seed):
    images = list(images)
    rng = random.Random(seed)
    rng.shuffle(images)

    if len(images) < 2:
        return images, []

    val_count = max(1, round(len(images) * VAL_RATIO))
    val_count = min(val_count, len(images) - 1)

    return images[val_count:], images[:val_count]


def match_augmented_files(raw_images, augmented_dir):
    mapping = {p.stem: [] for p in raw_images}

    if not augmented_dir.exists():
        return mapping

    raw_stems = sorted(
        [p.stem for p in raw_images],
        key=len,
        reverse=True,
    )

    for aug_path in augmented_dir.iterdir():
        if not is_image(aug_path):
            continue

        for stem in raw_stems:
            if aug_path.stem.startswith(stem + "_"):
                mapping[stem].append(aug_path)
                break

    return mapping


def copy_pair(image_path, images_dir, labels_dir, positive):
    copy_file(
        image_path,
        images_dir / image_path.name
    )

    create_or_copy_label(
        image_path,
        labels_dir / f"{image_path.stem}.txt",
        positive,
    )


def main():
    print("=" * 70)
    print("INTELLIPROCTOR - PREPARE YOLO DATASET")
    print("=" * 70)

    if not RAW_DIR.exists():
        raise FileNotFoundError(f"Raw folder not found:\n{RAW_DIR}")

    if not AUGMENTED_DIR.exists():
        raise FileNotFoundError(
            f"Augmented folder not found:\n{AUGMENTED_DIR}"
        )

    if YOLO_DIR.exists():
        print(f"Removing existing: {YOLO_DIR}")
        shutil.rmtree(YOLO_DIR)

    train_images_dir = YOLO_DIR / "images" / "train"
    val_images_dir = YOLO_DIR / "images" / "val"
    train_labels_dir = YOLO_DIR / "labels" / "train"
    val_labels_dir = YOLO_DIR / "labels" / "val"

    for d in (
        train_images_dir,
        val_images_dir,
        train_labels_dir,
        val_labels_dir,
    ):
        d.mkdir(parents=True, exist_ok=True)

    total_raw = 0
    total_train_raw = 0
    total_val_raw = 0
    total_train_aug = 0

    for class_name in sorted(POSITIVE_CLASSES | NEGATIVE_CLASSES):
        raw_class_dir = RAW_DIR / class_name
        aug_class_dir = AUGMENTED_DIR / class_name

        if not raw_class_dir.exists():
            print(f"WARNING: missing raw class folder: {raw_class_dir}")
            continue

        raw_images = sorted(
            [p for p in raw_class_dir.iterdir() if is_image(p)]
        )

        if not raw_images:
            print(f"WARNING: no images in {raw_class_dir}")
            continue

        train_raw, val_raw = split_images(
            raw_images,
            SEED + CLASS_NAMES.index(class_name)
            if class_name in CLASS_NAMES
            else SEED + 100,
        )

        positive = class_name in POSITIVE_CLASSES

        print()
        print("-" * 70)
        print(f"CLASS: {class_name}")
        print(f"Raw: {len(raw_images)}")
        print(f"Train originals: {len(train_raw)}")
        print(f"Validation originals: {len(val_raw)}")

        total_raw += len(raw_images)
        total_train_raw += len(train_raw)
        total_val_raw += len(val_raw)

        # Validation = untouched originals only.
        for image_path in val_raw:
            copy_pair(
                image_path,
                val_images_dir,
                val_labels_dir,
                positive,
            )

        # Training = original training images.
        for image_path in train_raw:
            copy_pair(
                image_path,
                train_images_dir,
                train_labels_dir,
                positive,
            )

        # Add only augmentations derived from training originals.
        mapping = match_augmented_files(
            raw_images,
            aug_class_dir,
        )

        train_stems = {p.stem for p in train_raw}
        val_stems = {p.stem for p in val_raw}

        for stem in sorted(train_stems):
            for aug_path in sorted(mapping.get(stem, [])):
                copy_pair(
                    aug_path,
                    train_images_dir,
                    train_labels_dir,
                    positive,
                )
                total_train_aug += 1

        # Report validation-derived augmentations that were deliberately excluded.
        excluded = sum(
            len(mapping.get(stem, []))
            for stem in val_stems
        )

        if excluded:
            print(
                f"Excluded {excluded} validation-derived "
                f"augmentations from training."
            )

    # data.yaml
    data = {
        "path": "dataset/yolo_dataset",
        "train": "images/train",
        "val": "images/val",
        "names": {
            0: "phone",
            1: "book_notebook",
        },
    }

    yaml_path = YOLO_DIR / "data.yaml"
    with open(yaml_path, "w", encoding="utf-8") as f:
        yaml.safe_dump(data, f, sort_keys=False)

    train_images = [p for p in train_images_dir.iterdir() if is_image(p)]
    val_images = [p for p in val_images_dir.iterdir() if is_image(p)]
    train_labels = list(train_labels_dir.glob("*.txt"))
    val_labels = list(val_labels_dir.glob("*.txt"))

    print()
    print("=" * 70)
    print("DONE")
    print("=" * 70)
    print(f"Raw originals processed: {total_raw}")
    print(f"Training originals:       {total_train_raw}")
    print(f"Validation originals:     {total_val_raw}")
    print(f"Training augmentations:   {total_train_aug}")
    print()
    print(f"Final TRAIN images:       {len(train_images)}")
    print(f"Final TRAIN labels:       {len(train_labels)}")
    print(f"Final VAL images:         {len(val_images)}")
    print(f"Final VAL labels:         {len(val_labels)}")
    print()
    print(f"YOLO dataset: {YOLO_DIR}")
    print(f"data.yaml:    {yaml_path}")
    print("=" * 70)


if __name__ == "__main__":
    main()
