from pathlib import Path

import cv2
import albumentations as A


# ============================================================
# PATHS
# ============================================================

DATASET_DIR = Path(__file__).resolve().parent
RAW_DIR = DATASET_DIR / "raw"
AUGMENTED_DIR = DATASET_DIR / "augmented"

# Positive classes MUST have YOLO .txt files
POSITIVE_CLASSES = {
    "phone",
    "book_notebook",
}

# Negative classes do not need bounding boxes
NEGATIVE_CLASSES = {
    "water_bottle",
    "hand_no_prohibited_object",
}

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


# ============================================================
# AUGMENTATIONS
# ============================================================

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
    """
    Build one augmentation pipeline.

    For positive images, bounding boxes are transformed automatically.
    For negative images, only the image is transformed.
    """

    # --------------------------------------------------------
    # BASIC TRANSFORMS
    # --------------------------------------------------------

    if name == "rotate":
        transforms = [
            A.Affine(
                rotate=(-12, 12),
                keep_ratio=True,
                p=1.0,
            )
        ]

    elif name == "flip":
        transforms = [
            A.HorizontalFlip(p=1.0)
        ]

    elif name == "brightness":
        transforms = [
            A.RandomBrightnessContrast(
                brightness_limit=0.25,
                contrast_limit=0.20,
                p=1.0,
            )
        ]

    elif name == "gaussian_blur":
        transforms = [
            A.GaussianBlur(
                blur_limit=(3, 7),
                p=1.0,
            )
        ]

    elif name == "motion_blur":
        transforms = [
            A.MotionBlur(
                blur_limit=(3, 7),
                p=1.0,
            )
        ]

    elif name == "zoom_in":
        transforms = [
            A.Affine(
                scale=(1.05, 1.20),
                keep_ratio=True,
                p=1.0,
            )
        ]

    elif name == "zoom_out":
        transforms = [
            A.Affine(
                scale=(0.85, 0.95),
                keep_ratio=True,
                p=1.0,
            )
        ]

    elif name == "crop":
        # Positive images:
        # keep the entire bounding box inside the crop.
        if has_bboxes:
            transforms = [
                A.RandomSizedBBoxSafeCrop(
                    height=image_height,
                    width=image_width,
                    erosion_rate=0.10,
                    p=1.0,
                )
            ]

        # Negative images:
        # normal random crop + resize.
        else:
            transforms = [
                A.RandomResizedCrop(
                    size=(image_height, image_width),
                    scale=(0.75, 0.95),
                    ratio=(0.90, 1.10),
                    p=1.0,
                )
            ]

    elif name == "noise":
        transforms = [
            A.GaussNoise(
                std_range=(0.03, 0.08),
                mean_range=(0.0, 0.0),
                per_channel=True,
                p=1.0,
            )
        ]

    elif name == "compression":
        transforms = [
            A.ImageCompression(
                quality_range=(40, 75),
                compression_type="jpeg",
                p=1.0,
            )
        ]

    # --------------------------------------------------------
    # COMBINATIONS
    # --------------------------------------------------------

    elif name == "rotate_brightness":
        transforms = [
            A.Affine(
                rotate=(-10, 10),
                keep_ratio=True,
                p=1.0,
            ),
            A.RandomBrightnessContrast(
                brightness_limit=0.20,
                contrast_limit=0.15,
                p=1.0,
            ),
        ]

    elif name == "rotate_blur":
        transforms = [
            A.Affine(
                rotate=(-10, 10),
                keep_ratio=True,
                p=1.0,
            ),
            A.GaussianBlur(
                blur_limit=(3, 5),
                p=1.0,
            ),
        ]

    elif name == "flip_brightness":
        transforms = [
            A.HorizontalFlip(p=1.0),
            A.RandomBrightnessContrast(
                brightness_limit=0.20,
                contrast_limit=0.15,
                p=1.0,
            ),
        ]

    elif name == "zoom_blur":
        transforms = [
            A.Affine(
                scale=(1.05, 1.15),
                keep_ratio=True,
                p=1.0,
            ),
            A.GaussianBlur(
                blur_limit=(3, 5),
                p=1.0,
            ),
        ]

    elif name == "noise_compression":
        transforms = [
            A.GaussNoise(
                std_range=(0.03, 0.07),
                mean_range=(0.0, 0.0),
                per_channel=True,
                p=1.0,
            ),
            A.ImageCompression(
                quality_range=(45, 75),
                compression_type="jpeg",
                p=1.0,
            ),
        ]

    elif name == "rotate_zoom_brightness_blur":
        transforms = [
            A.Affine(
                rotate=(-10, 10),
                scale=(0.95, 1.10),
                keep_ratio=True,
                p=1.0,
            ),
            A.RandomBrightnessContrast(
                brightness_limit=0.15,
                contrast_limit=0.15,
                p=1.0,
            ),
            A.GaussianBlur(
                blur_limit=(3, 5),
                p=1.0,
            ),
        ]

    else:
        raise ValueError(f"Unknown augmentation: {name}")

    # --------------------------------------------------------
    # POSITIVE IMAGES -> WITH YOLO BBOXES
    # --------------------------------------------------------

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

    # --------------------------------------------------------
    # NEGATIVE IMAGES -> IMAGE ONLY
    # --------------------------------------------------------

    return A.Compose(transforms)


# ============================================================
# READ YOLO LABEL
# ============================================================

def read_yolo_labels(label_path):
    bboxes = []
    class_labels = []

    if not label_path.exists():
        return bboxes, class_labels

    with open(label_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()

            if not line:
                continue

            parts = line.split()

            if len(parts) != 5:
                print(f"WARNING: Bad label format: {label_path}")
                continue

            class_id = int(parts[0])

            x_center = float(parts[1])
            y_center = float(parts[2])
            width = float(parts[3])
            height = float(parts[4])

            bboxes.append(
                (
                    x_center,
                    y_center,
                    width,
                    height,
                )
            )

            class_labels.append(class_id)

    return bboxes, class_labels


# ============================================================
# SAVE YOLO LABEL
# ============================================================

def save_yolo_labels(label_path, bboxes, class_labels):

    with open(label_path, "w", encoding="utf-8") as f:

        for bbox, class_id in zip(bboxes, class_labels):

            x_center, y_center, width, height = bbox

            f.write(
                f"{int(class_id)} "
                f"{float(x_center):.6f} "
                f"{float(y_center):.6f} "
                f"{float(width):.6f} "
                f"{float(height):.6f}\n"
            )


# ============================================================
# PROCESS ONE IMAGE
# ============================================================

def process_image(image_path, class_name, output_class_dir):

    image = cv2.imread(str(image_path))

    if image is None:
        print(f"WARNING: Could not read {image_path}")
        return 0

    image_height, image_width = image.shape[:2]

    is_positive = class_name in POSITIVE_CLASSES

    label_path = image_path.with_suffix(".txt")

    # --------------------------------------------------------
    # POSITIVE IMAGE
    # --------------------------------------------------------

    if is_positive:

        bboxes, class_labels = read_yolo_labels(label_path)

        if not bboxes:
            print(f"SKIPPING positive image with no label: {image_path.name}")
            return 0

    # --------------------------------------------------------
    # NEGATIVE IMAGE
    # --------------------------------------------------------

    else:

        bboxes = []
        class_labels = []

    generated = 0

    for aug_name in AUGMENTATION_NAMES:

        transform = build_transform(
            aug_name,
            has_bboxes=is_positive,
            image_height=image_height,
            image_width=image_width,
        )

        try:

            if is_positive:

                result = transform(
                    image=image,
                    bboxes=bboxes,
                    class_labels=class_labels,
                )

            else:

                result = transform(image=image)

        except Exception as e:

            print(
                f"ERROR: {image_path.name} | "
                f"{aug_name} | {e}"
            )
            continue

        augmented_image = result["image"]

        output_stem = f"{image_path.stem}__{aug_name}"

        output_image_path = (
            output_class_dir /
            f"{output_stem}.jpg"
        )

        # ----------------------------------------------------
        # POSITIVE: make sure bbox still exists
        # ----------------------------------------------------

        if is_positive:

            transformed_bboxes = result["bboxes"]
            transformed_labels = result["class_labels"]

            if len(transformed_bboxes) == 0:
                print(
                    f"SKIPPING empty bbox result: "
                    f"{image_path.name} | {aug_name}"
                )
                continue

            # Save image
            success = cv2.imwrite(
                str(output_image_path),
                augmented_image,
                [cv2.IMWRITE_JPEG_QUALITY, 95],
            )

            if not success:
                print(f"ERROR saving {output_image_path}")
                continue

            output_label_path = (
                output_class_dir /
                f"{output_stem}.txt"
            )

            save_yolo_labels(
                output_label_path,
                transformed_bboxes,
                transformed_labels,
            )

        # ----------------------------------------------------
        # NEGATIVE: image only
        # ----------------------------------------------------

        else:

            success = cv2.imwrite(
                str(output_image_path),
                augmented_image,
                [cv2.IMWRITE_JPEG_QUALITY, 95],
            )

            if not success:
                print(f"ERROR saving {output_image_path}")
                continue

        generated += 1

    return generated


# ============================================================
# MAIN
# ============================================================

def main():

    AUGMENTED_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    # YOLO class order
    classes_file = AUGMENTED_DIR / "classes.txt"

    with open(classes_file, "w", encoding="utf-8") as f:
        f.write("phone\n")
        f.write("book_notebook\n")

    total_images = 0
    total_generated = 0

    print("=" * 60)
    print("INTELLIPROCTOR DATASET AUGMENTATION")
    print("=" * 60)
    print(f"RAW:       {RAW_DIR}")
    print(f"AUGMENTED: {AUGMENTED_DIR}")
    print()
    print(f"Augmentations per image: {len(AUGMENTATION_NAMES)}")
    print()

    if not RAW_DIR.exists():
        print(f"ERROR: Raw dataset does not exist: {RAW_DIR}")
        return

    # --------------------------------------------------------
    # Process every class folder
    # --------------------------------------------------------

    for class_dir in sorted(RAW_DIR.iterdir()):

        if not class_dir.is_dir():
            continue

        class_name = class_dir.name

        if class_name not in (
            POSITIVE_CLASSES | NEGATIVE_CLASSES
        ):
            print(
                f"Skipping unknown folder: "
                f"{class_name}"
            )
            continue

        output_class_dir = (
            AUGMENTED_DIR / class_name
        )

        output_class_dir.mkdir(
            parents=True,
            exist_ok=True,
        )

        print()
        print("-" * 60)
        print(f"CLASS: {class_name}")
        print("-" * 60)

        images = [
            p
            for p in class_dir.iterdir()
            if p.is_file()
            and p.suffix.lower() in IMAGE_EXTENSIONS
        ]

        if not images:
            print("No images found.")
            continue

        for image_path in sorted(images):

            generated = process_image(
                image_path,
                class_name,
                output_class_dir,
            )

            total_images += 1
            total_generated += generated

            print(
                f"{image_path.name} "
                f"-> {generated} augmented"
            )

    print()
    print("=" * 60)
    print("DONE")
    print("=" * 60)
    print(f"Original images processed: {total_images}")
    print(f"Augmented images created:  {total_generated}")
    print()
    print(f"Output folder:")
    print(AUGMENTED_DIR)
    print("=" * 60)


if __name__ == "__main__":
    main()