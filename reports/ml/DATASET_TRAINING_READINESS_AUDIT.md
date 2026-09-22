# IntelliProctor — Dataset & Training Readiness Audit

**Date**: 2026-09-22
**Auditor**: Automated Pre-Training Technical Audit
**Scope**: Full pipeline from raw dataset → split → annotation → dataloader → training → validation → evaluation → production inference

---

## 1. Executive Verdict

## READY WITH REQUIRED FIXES

Training **cannot proceed** in its current state due to **2 blockers** and **5 required fixes**. Once the blockers and required fixes are addressed (estimated 1–2 hours of work), the dataset and architecture are technically sound enough to begin a first training iteration.

**Critical Blockers:**
1. `data.yaml` contains a hardcoded absolute path to a non-existent machine (`C:/Users/tanis/...`) — YOLO training will fail immediately
2. No test split exists — there is no held-out evaluation set in the training pipeline; all evaluation relies on separately managed test images

**Summary of findings:**
- Dataset is very small (21 raw images/class) but augmented to ~280–284 train images/class
- Annotations are technically valid (correct YOLO format, correct class IDs, no malformed lines)
- Several annotations have questionable quality (extremely thin slivers, edge-clipped objects)
- No data leakage detected between train/val/held-out test sets (verified by file hash)
- Severe source diversity deficit — all 70 raw images are from one person, one room, one camera, one session
- Validation set is extremely small (4 positive images per class) — insufficient for reliable model selection
- Training run was previously attempted but interrupted — no model weights were produced
- Training architecture is reasonable for dataset size (frozen backbone, small epoch count)
- Hard-negative coverage is present but limited to only 2 categories (water bottle, hand)

---

## 2. Current Dataset Summary

### 2.1 Raw Dataset

| Category | Role | Images | Labels | Objects | Class ID |
|---|---|---|---|---|---|
| `phone` | Positive | 21 | 21 | 21 | 0 |
| `book_notebook` | Positive | 21 | 21 | 21 | 1 |
| `water_bottle` | Negative | 14 | 0 | 0 | — |
| `hand_no_prohibited_object` | Negative | 14 | 0 | 0 | — |
| **Total** | | **70** | **42** | **42** | |

**Location**: `dataset/raw/` (paths reference `C:\Users\tanis\dataset\raw`)
**Image format**: All `.jpg` (1920×1080 resolution, Windows Camera app captures)
**Capture date**: All images timestamped 2026-09-20 (single session)
**Corrupted images**: 0

### 2.2 Augmented Dataset

| Category | Role | Images | Labels | Multiplier |
|---|---|---|---|---|
| `phone` | Positive | 327 | 327 | 15.57× |
| `book_notebook` | Positive | 327 | 327 | 15.57× |
| `water_bottle` | Negative | 224 | 0 | 16× |
| `hand_no_prohibited_object` | Negative | 224 | 0 | 16× |
| **Total** | | **1,102** | **654** | |

**Augmentation pipeline**: 16 variations per raw image via Albumentations:
`rotate`, `flip`, `brightness`, `gaussian_blur`, `motion_blur`, `zoom_in`, `zoom_out`, `crop`, `noise`, `compression`, `rotate_brightness`, `rotate_blur`, `flip_brightness`, `zoom_blur`, `noise_compression`, `rotate_zoom_brightness_blur`

**Location**: `dataset/augmented/`

### 2.3 YOLO Dataset (Training-Ready Split)

| Split | Total Images | Total Labels | Positive (Annotated) | Negative (Empty) | Phone Objects | Book Objects |
|---|---|---|---|---|---|---|
| train | 938 | 938 | 564 | 374 | 280 | 284 |
| val | 14 | 14 | 8 | 6 | 4 | 4 |
| **Total** | **952** | **952** | **572** | **380** | **284** | **288** |

> [!IMPORTANT]
> **No test split exists** in the YOLO dataset. Evaluation relies on the separately managed held-out images in `tests/test_data/`.

### 2.4 Held-Out Evaluation Set (NOT in Training Pipeline)

| Category | Location | Count | Source |
|---|---|---|---|
| Phone (positive) | `tests/test_data/phone/` | 17 | WhatsApp images from 2026-08-31 |
| Book (positive) | `tests/test_data/book/` | 15 | WhatsApp images from 2026-08-31 |
| Laptop (negative) | `tests/test_data/laptop/` | 20 | Wikimedia Commons downloads |
| Tablet (negative) | `tests/test_data/tablet/` | 20 | Wikimedia Commons downloads |
| Other (negative) | `tests/test_data/other/` | 20 | Wikimedia Commons downloads |
| Smartwatch (negative) | `tests/test_data/smartwatch/` | 15 | Wikimedia Commons downloads |
| Calculator (negative) | `tests/test_data/calculator/` | 15 | Wikimedia Commons downloads |
| Notebook (negative) | `tests/test_data/notebook/` | 15 | Wikimedia Commons downloads |
| Headphones (negative) | `tests/test_data/headphones/` | 15 | Wikimedia Commons downloads |
| Water Bottle (negative) | `tests/test_data/water_bottle/` | 10 | Wikimedia Commons downloads |
| Pen (negative) | `tests/test_data/pen/` | 10 | Wikimedia Commons downloads |
| **Total** | | **172** | |

---

## 3. Comparison Against Original Plan

| Requirement (Original Plan) | Current Implementation | Assessment |
|---|---|---|
| `cell phone` and `book` as main classes | `phone` (ID 0) and `book_notebook` (ID 1) | ✅ Reasonable deviation — merged book+notebook into one class |
| 500+ images/class target | 21 raw/class (→~280 train after augmentation) | ⚠️ **Far below target** — but original plan said 200 was absolute minimum for first iteration |
| 200 images/class absolute minimum | 21 raw, ~280 after augmentation | ⚠️ **Borderline** — 280 augmented from only 21 unique sources is much weaker than 200 genuinely unique images |
| Hard-negative coverage | 28 raw negatives (water bottle + hand) | ⚠️ **Insufficient** — only 2 categories; no laptop/tablet/smartwatch/calculator negatives in training |
| Exam-webcam domain relevance | All images from Windows Camera webcam | ✅ Domain-matched captures |
| YOLO-format bounding boxes | Correct YOLO format throughout | ✅ Verified programmatically |
| Train/val/test separation | Train/val only; no test in YOLO dataset | ⚠️ Test relies on separate held-out set |
| No test leakage | Verified — 0 hash overlaps | ✅ Clean separation |
| Existing test images reserved for eval | 32 test images in `tests/test_data/` not in training | ✅ Verified by hash comparison |
| Fine-tuning from pretrained detector | YOLO11m pretrained on COCO | ✅ Appropriate |
| Validation-based model selection | Early stopping on val mAP | ⚠️ Val set too small (14 images) for reliable selection |
| `notebook` and `calculator` as optional classes | Not included as separate classes | ✅ Reasonable — `book_notebook` merges notebooks into the book class |

**Overall**: The current implementation deviates significantly from the original plan in dataset size and hard-negative coverage, but the core architectural decisions (class mapping, augmentation strategy, transfer learning approach) are technically defensible for a first iteration.

---

## 4. Dataset Quality Findings

### 4.1 Image Quality
- **Resolution**: All raw images are 1920×1080 (Full HD webcam captures)
- **Format**: All `.jpg`
- **Corrupted files**: 0
- **Missing labels**: 0 (for positive classes); negative classes correctly have no labels
- **Orphan labels**: 0

### 4.2 Source Diversity Assessment

> [!CAUTION]
> **CRITICAL DIVERSITY DEFICIT**: All 70 raw images were captured in a **single session** on 2026-09-20, featuring:
> - **One person** (same individual in every image)
> - **One phone** (same Samsung Galaxy device)
> - **One book/notebook** (2 objects total: a spiral notebook with "DENTE 91" branding, and what appears to be a painting/calendar)
> - **One room** (bedroom with wooden wardrobe background)
> - **One camera** (built-in Windows laptop webcam)
> - **One lighting setup** (ceiling tube light)
> - **One desk/seating position** (same angle throughout)

This is a **fundamental limitation**. Augmentation (rotation, brightness, blur, etc.) cannot compensate for:
- Different skin tones
- Different phone models/sizes/colors
- Different book types (textbooks, printed books, A4 notebooks)
- Different rooms/backgrounds
- Different webcam qualities
- Different lighting conditions beyond the one present
- Different body builds/clothing

The model will almost certainly overfit to this specific person and environment.

---

## 5. Annotation Findings

### 5.1 Format Validation (Programmatic)
- ✅ All 42 raw label files follow correct YOLO format: `class_id x_center y_center width height`
- ✅ All coordinates are normalized within [0.0, 1.0]
- ✅ No zero-area boxes
- ✅ No negative values
- ✅ No malformed lines
- ✅ All phone labels use class_id = 0 (verified every line)
- ✅ All book_notebook labels use class_id = 1 (verified every line)
- ✅ All labels contain exactly 1 object per image (single object annotations)
- ✅ All 654 augmented labels also pass validation

### 5.2 Annotation Quality (Visual Inspection of Training Batches)

From visual inspection of `train_batch0.jpg`, `train_batch1.jpg`, `train_batch2.jpg`:

**Positive observations:**
- Bounding boxes generally surround the target objects
- Augmented images retain valid annotations through Albumentations transforms
- Labels correctly distinguish phone (class 0) from book_notebook (class 0 shown as blue boxes in training batch visualization — note: YOLO uses 0-indexed class colors)

**Concerning observations:**

| File | Annotation | Issue |
|---|---|---|
| `WIN_20260920_18_47_35_Pro.txt` | `0 0.497396 0.945833 0.452083 0.025000` | Phone edge-on: extremely thin horizontal sliver (width=45%, height=2.5%). Box area = 1.1% of image. Phone is barely visible — nearly edge-on. |
| `WIN_20260920_18_46_29_Pro.txt` | `0 0.327344 0.980556 0.098437 0.038889` | Phone at extreme bottom edge: y_center=0.98, only 3.9% height visible. Most of phone is likely cut off. |
| `WIN_20260920_18_47_41_Pro.txt` | `0 0.190365 0.981481 0.128646 0.037037` | Same issue — phone barely visible at bottom edge (3.7% height). |
| `WIN_20260920_18_52_01_Pro.txt` | `0 0.914583 0.887500 0.060417 0.039815` | Very small box (6%×4% = 0.24% area) — phone extremely distant/small. |
| `WIN_20260920_18_45_37_Pro.txt` | `0 0.259635 0.776389 0.065104 0.093519` | Small phone (6.5%×9.4% = 0.61% area) — phone at distance. |
| `WIN_20260920_22_36_49_Pro.txt` | `1 0.383333 0.984722 0.122917 0.030556` | Book at extreme bottom edge (3% height visible). |
| `WIN_20260920_21_31_48_Pro.txt` | `1 0.251042 0.975926 0.161458 0.048148` | Book barely visible at bottom (4.8% height). |
| `WIN_20260920_22_37_07_Pro.txt` | `1 0.813281 0.669444 0.026562 0.416667` | Very narrow vertical strip (2.7% width, 42% height) — book edge-on. |

**Assessment**: ~8/42 raw annotations (19%) involve objects that are extremely small, edge-clipped, or barely visible. While some of these represent legitimate hard cases (edge-on phones), several are questionable training signal where the object is nearly invisible. These will propagate through all 16 augmentation variants, creating ~128 borderline training examples.

### 5.3 Label Distribution Visualization

From the YOLO-generated `labels.jpg`:
- Total instance count shows **564** in training (displayed as single bar — YOLO treats both classes together in this visualization)
- Spatial distribution: objects are concentrated in the bottom half of images (y > 0.7), consistent with webcam desk-level captures where objects are held below the face
- Size distribution: majority of objects are small-to-medium (width 0.05–0.35, height 0.05–0.35) with some outliers (very wide thin strips, or very tall thin strips from edge-on objects)

---

## 6. Data Leakage Analysis

### 6.1 Train/Val Leakage
- **Filename overlap**: 0 images share names between train and val splits
- **Hash overlap**: 0 hash matches between train and val (verified by MD5)
- **Augmentation leakage**: The `prepare_yolo_dataset.py` script (lines 188-211) correctly excludes validation-derived augmentations from training. Only augmentations derived from **training-split raw images** are included in the training set.

### 6.2 Train/Val vs Held-Out Test Leakage
- **Hash comparison**: 0 matches between any training/validation image and the 32 held-out test images in `tests/test_data/`
- **Source separation**: Training images are from `WIN_20260920_*` (webcam captures, 2026-09-20). Test images are from `WhatsApp Image 2026-08-31*` (WhatsApp transfers, 2026-08-31). Different source dates, different cameras, different environments.

### 6.3 Near-Duplicate / Source-Level Leakage
- Training images were captured from a webcam in a single session on 2026-09-20
- Test images were captured via WhatsApp on 2026-08-31
- **Different people**: Training features one person (glasses, beige t-shirt, bedroom). Test images feature a different person (checkered shirt, PICT lanyard, institutional setting).
- **No source-level leakage detected.**

### 6.4 Verdict
> ✅ **NO DATA LEAKAGE DETECTED.** Train/val/test separation is clean at both the file level and the source level.

---

## 7. Held-Out Evaluation Set Audit

### 7.1 Test Image Integrity
| Category | Count | In Training? | In Validation? | Status |
|---|---|---|---|---|
| `tests/test_data/phone/` | 17 images | ❌ No | ❌ No | ✅ Reserved |
| `tests/test_data/book/` | 15 images | ❌ No | ❌ No | ✅ Reserved |
| 9 negative categories | 140 images | ❌ No | ❌ No | ✅ Reserved |

### 7.2 Baseline Results Preservation
The following baseline result files exist and are intact:
- [`tests/results/baseline_32_images_yolo11m_results.json`](file:///c:/Advait/projects/CEP/IntelliProctor/tests/results/baseline_32_images_yolo11m_results.json) — 208,871 bytes
- [`tests/results/latest_automated_detection_results.json`](file:///c:/Advait/projects/CEP/IntelliProctor/tests/results/latest_automated_detection_results.json) — 208,871 bytes
- [`tests/results/latency_baseline_results.json`](file:///c:/Advait/projects/CEP/IntelliProctor/tests/results/latency_baseline_results.json) — 1,057 bytes
- [`tests/results/phase0_optimization_results.json`](file:///c:/Advait/projects/CEP/IntelliProctor/tests/results/phase0_optimization_results.json) — 7,443 bytes

> ✅ All baseline artifacts are preserved and unmodified.

---

## 8. Dataset Domain-Relevance Audit

The model is intended for **exam-webcam/proctoring conditions**.

### 8.1 Training Dataset Coverage

| Condition | Represented? | Evidence |
|---|---|---|
| **Object pose — frontal** | ✅ Yes | Multiple frontal phone/book images |
| **Object pose — angled** | ✅ Yes | Some angled phone holds |
| **Object pose — rotated** | ⚠️ Augmented only | Physical rotation not present; synthetic rotation via augmentation |
| **Object pose — horizontal** | ✅ Yes | Phone held horizontally in some images |
| **Object pose — edge-on** | ✅ Yes | `WIN_20260920_18_47_35_Pro.jpg` shows phone edge-on |
| **Distance — close** | ✅ Yes | Several close-range images |
| **Distance — medium** | ✅ Yes | Most images are at medium distance |
| **Distance — far** | ⚠️ Limited | A few small-object annotations suggest far distance |
| **Occlusion — hand** | ✅ Yes | Objects held in hand with partial finger occlusion |
| **Occlusion — body** | ❌ No | No body-occluded examples visible |
| **Lighting — normal indoor** | ✅ Yes | All images have indoor ceiling light |
| **Lighting — low light** | ❌ No | All images appear well-lit; no dark/dim scenarios |
| **Lighting — bright/overexposed** | ❌ No | No bright window/backlit scenarios |
| **Lighting — uneven/side** | ❌ No | Consistent single-source ceiling light |
| **Camera — webcam perspective** | ✅ Yes | All images from laptop webcam |
| **Camera — low resolution** | ❌ No | All images are 1920×1080 |
| **Camera — blur** | ⚠️ Augmented only | Motion/Gaussian blur added synthetically |
| **Camera — compression** | ⚠️ Augmented only | JPEG compression added synthetically |
| **Background — desk** | ⚠️ Limited | Some desk visible but same desk every time |
| **Background — monitor** | ❌ No | No monitor visible in training images |
| **Background — clutter** | ❌ No | Very clean background (wardrobe, wall) |
| **Context — face visible** | ✅ Yes | Face visible in most images |
| **Context — multiple objects** | ❌ No | All annotations have exactly 1 object per image |
| **Different people** | ❌ No | **All images feature one person** |
| **Different phone models** | ❌ No | **All images show one phone** |
| **Different book types** | ⚠️ Limited | 2 book/notebook objects used |

### 8.2 Held-Out Test Set Coverage
The test set (`tests/test_data/phone/` and `tests/test_data/book/`) represents a **different domain**:
- Different person (different appearance, clothing)
- Different environment (institutional hallway/classroom vs bedroom)
- Different camera (phone camera vs laptop webcam)
- More people in background
- Different lighting (institutional fluorescent vs bedroom ceiling light)

> [!WARNING]
> The training and test sets have a **significant domain gap**. Training images are from a bedroom webcam with one person, while test images are from an institutional setting with phone cameras. This means evaluation will test generalization, but the model may struggle because it hasn't seen anything like the test conditions.

---

## 9. Hard-Negative Audit

### 9.1 Training Hard Negatives

| Negative Category | Raw Count | Augmented Count | In Training | Visual Diversity | Usefulness |
|---|---|---|---|---|---|
| `water_bottle` | 14 | 224 | ~187 train + ~37 val/excluded | Low — same steel thermos bottle, same person, same room | ⚠️ Limited — only one bottle type |
| `hand_no_prohibited_object` | 14 | 224 | ~187 train + ~37 val/excluded | Low — same person's hand, same room, same camera | ⚠️ Limited — important category but low diversity |
| `laptop` | 0 | 0 | ❌ Not in training | — | ❌ **MISSING** — laptops caused 3/20 FPs in Phase 0 baseline |
| `tablet` | 0 | 0 | ❌ Not in training | — | ❌ **MISSING** — tablets caused 3/20 FPs in baseline |
| `smartwatch` | 0 | 0 | ❌ Not in training | — | ❌ **MISSING** — smartwatches caused 3/15 FPs in baseline |
| `calculator` | 0 | 0 | ❌ Not in training | — | ⚠️ Missing |
| `headphones` | 0 | 0 | ❌ Not in training | — | ⚠️ Missing |
| `keyboard/monitor` | 0 | 0 | ❌ Not in training | — | ⚠️ Missing |

> [!WARNING]
> **The three biggest false-positive sources from the Phase 0 baseline (laptop, tablet, smartwatch) are completely absent from the training dataset.** The model has no training signal to learn "this rectangular object is NOT a phone/book." This is a significant gap that will likely result in high false-positive rates even after fine-tuning.

### 9.2 Evaluation Hard Negatives
The held-out test set in `tests/test_data/` contains 140 negative images across 9 categories, which is adequate for **evaluation** but these images are correctly NOT used for training.

---

## 10. Class Balance Audit

### 10.1 Overall Distribution

| Metric | Phone (Class 0) | Book_Notebook (Class 1) | Negative (No Class) |
|---|---|---|---|
| Raw images | 21 | 21 | 28 |
| Augmented images | 327 | 327 | 448 |
| Train objects | 280 | 284 | 374 (empty labels) |
| Val objects | 4 | 4 | 6 (empty labels) |
| Objects percentage | 49.6% | 50.4% | — |

### 10.2 Balance Assessment
- ✅ **Class balance is excellent** — phone and book_notebook have nearly equal representation (280 vs 284 in training)
- ✅ **Positive:negative ratio is reasonable** — 564 positive : 374 negative (60:40) in training
- ⚠️ **Validation split is too small** — only 4 positive images per class is insufficient for reliable mAP computation. A single image changing between detected/undetected shifts mAP by 25%.

### 10.3 Diversity Assessment
Despite the balanced counts:
- Phone images: 21 unique scenes → 280 training images via augmentation. **Effective diversity: 21 unique viewpoints**
- Book images: 21 unique scenes → 284 training images via augmentation. **Effective diversity: 21 unique viewpoints**
- This is fundamentally different from having 280 genuinely unique phone images

---

## 11. Source Diversity Audit

| Diversity Dimension | Status | Detail |
|---|---|---|
| Number of people | ❌ **1 person** | Same individual in all 70 raw images |
| Number of phones | ❌ **1 phone** | Same Samsung Galaxy model throughout |
| Number of books | ⚠️ **~2 objects** | One spiral notebook, one painting/calendar |
| Number of rooms | ❌ **1 room** | Bedroom with wooden wardrobe |
| Number of desks | ❌ **1 desk** | Same seating position |
| Number of cameras | ❌ **1 camera** | Built-in laptop webcam (1920×1080) |
| Lighting setups | ❌ **1 setup** | Ceiling tube light |
| Backgrounds | ❌ **1 background** | Wall + wooden wardrobe |
| Capture sessions | ❌ **1 session** | All dated 2026-09-20 |

> [!CAUTION]
> This is a **single-source dataset**. The model will learn to detect this specific phone in this specific room held by this specific person. Generalization to other people, phones, rooms, and conditions is not guaranteed and is in fact unlikely with only 21 unique images per class.

---

## 12. Augmentation Audit

### 12.1 Augmentations Applied

| Augmentation | Parameters | Domain-Appropriate? | Assessment |
|---|---|---|---|
| `rotate` | ±12° affine | ✅ Yes | Webcam angles vary slightly |
| `flip` (horizontal) | p=1.0 | ✅ Yes | Left/right hand hold |
| `brightness` | ±0.25 brightness, ±0.20 contrast | ✅ Yes | Indoor lighting variation |
| `gaussian_blur` | kernel 3–7 | ✅ Yes | Webcam quality variation |
| `motion_blur` | kernel 3–7 | ✅ Yes | Hand movement |
| `zoom_in` | scale 1.05–1.20 | ✅ Yes | Simulates closer distance |
| `zoom_out` | scale 0.85–0.95 | ✅ Yes | Simulates further distance |
| `crop` | BBoxSafeCrop (positive), RandomResizedCrop (negative) | ✅ Yes | Safe crop preserves annotations |
| `noise` | Gaussian σ=0.03–0.08 | ✅ Yes | Low-quality webcam noise |
| `compression` | JPEG quality 40–75 | ✅ Yes | Compression artifacts |
| `rotate_brightness` | Combined | ✅ Yes | Realistic compound variation |
| `rotate_blur` | Combined | ✅ Yes | Realistic compound variation |
| `flip_brightness` | Combined | ✅ Yes | Realistic compound variation |
| `zoom_blur` | Combined | ✅ Yes | Simulates approaching while camera adjusts |
| `noise_compression` | Combined | ✅ Yes | Low-quality capture simulation |
| `rotate_zoom_brightness_blur` | Combined 4-way | ⚠️ Borderline | Heavy compound augmentation may produce unrealistic images |

### 12.2 Missing Augmentations
- **Mosaic**: Disabled in training config (`mosaic=0.0`) — this was intentional and appropriate for the small dataset size (mosaic with only 21 unique images would create highly repetitive composites)
- **MixUp**: Disabled (`mixup=0.0`) — appropriate for small dataset
- **Vertical flip**: Not applied — appropriate (phones/books are rarely upside-down in proctoring)
- **Perspective transform**: Not applied but would be beneficial for webcam angle variation
- **Color jitter / HSV**: Applied via YOLO defaults (`hsv_h=0.015, hsv_s=0.7, hsv_v=0.4`)

### 12.3 YOLO Built-in Augmentations (from `args.yaml`)

| Parameter | Value | Assessment |
|---|---|---|
| `hsv_h` | 0.015 | ✅ Modest hue variation |
| `hsv_s` | 0.7 | ✅ Reasonable saturation variation |
| `hsv_v` | 0.4 | ✅ Reasonable brightness variation |
| `translate` | 0.1 | ✅ Small translation |
| `scale` | 0.5 | ✅ Scale augmentation |
| `fliplr` | 0.5 | ✅ Horizontal flip probability |
| `mosaic` | 0.0 | ✅ Disabled — appropriate for small dataset |
| `mixup` | 0.0 | ✅ Disabled — appropriate |
| `erasing` | 0.4 | ✅ Random erasing for occlusion robustness |
| `auto_augment` | `randaugment` | ✅ Additional random augmentation |

### 12.4 Augmentation Verdict
The augmentation pipeline is **well-designed** for the proctoring domain. The Albumentations pre-augmentation creates 16 variations with bbox-safe transforms, and YOLO applies additional online augmentation during training. Mosaic being disabled is a correct decision for this dataset size.

---

## 13. Training Architecture Audit

### 13.1 Model

| Parameter | Value | Assessment |
|---|---|---|
| Architecture | YOLO11m | ✅ Same as production baseline |
| Size | 40.7 MB | ✅ Matches `yolo11m.pt` |
| Pretrained checkpoint | `yolo11m.pt` (COCO) | ✅ Standard COCO pretrained weights |
| Number of classes | 2 (phone, book_notebook) | ✅ Correct for current dataset |
| Detection head | Auto-configured by Ultralytics | ✅ Standard YOLO detection head |

### 13.2 Transfer Learning Strategy

| Aspect | Configuration | Assessment |
|---|---|---|
| Pretrained weights | ✅ `yolo11m.pt` (COCO) | Correct — leverages general features |
| Frozen layers | 10 (backbone layers 0–9) | ✅ **Appropriate** — preserves COCO features, trains neck + head only |
| Training from scratch | ❌ No | ✅ Correct — insufficient data for training from scratch |
| Full fine-tuning | ❌ No (frozen backbone) | ✅ Correct for 21 unique images — prevents overfitting backbone |

### 13.3 Optimizer & Training Hyperparameters

| Parameter | Value | Assessment |
|---|---|---|
| Optimizer | `auto` (SGD with momentum by default) | ✅ Standard |
| Learning rate | `lr0=0.01` | ⚠️ **Higher than recommended** for fine-tuning. Plan suggested `lr0=0.001`. However, with frozen backbone this only affects neck+head so 0.01 may be acceptable. |
| LR final ratio | `lrf=0.01` | ✅ Standard cosine decay to lr0×0.01 |
| Momentum | 0.937 | ✅ Standard |
| Weight decay | 0.0005 | ✅ Standard |
| Warmup epochs | 3.0 | ⚠️ With only 4 total epochs, 3 warmup epochs leaves only 1 epoch at full learning rate |
| Warmup bias lr | 0.1 | ✅ Standard |

| Parameter | Value | Assessment |
|---|---|---|
| **Epochs** | **4** | ⚠️ Very low — but with patience=2, may early-stop anyway. For CPU training this keeps runtime manageable. |
| **Patience** | **2** | ⚠️ Very aggressive early stopping — may stop before model converges |
| Batch size | 8 | ✅ Reasonable for CPU |
| Image size | 1280 | ✅ Matches production `IMG_SIZE=1280` |
| Workers | 0 | ✅ Windows compatibility |
| Seed | 42 | ✅ Reproducible |
| Save period | 1 | ✅ Checkpoint every epoch |
| Device | CPU | ⚠️ Slow but functional |
| Mixed precision (AMP) | true | ✅ Helps on CPU |

### 13.4 Loss Configuration (from `args.yaml`)

| Loss | Weight | Standard? |
|---|---|---|
| Box loss | 7.5 | ✅ YOLO default |
| Classification loss | 0.5 | ✅ YOLO default |
| DFL loss | 1.5 | ✅ YOLO default |

### 13.5 Validation Configuration

| Parameter | Value | Assessment |
|---|---|---|
| Validation during training | `val=true` | ✅ |
| Validation split | `val` | ✅ |
| Best model selection | mAP50(B) | ✅ Standard YOLO criterion |
| Early stopping metric | mAP50(B) | ✅ Standard |

---

## 14. Training Architecture Validity

### 14.1 Model Size vs Dataset Size

The model (YOLO11m) has ~20M parameters. With only 21 unique raw images per class (→564 total training objects), this gives a ratio of ~35,500 parameters per unique training sample. This is **extremely high** and carries significant overfitting risk.

**Mitigating factors:**
- Backbone is frozen (only ~3-5M trainable parameters in neck+head)
- Heavy augmentation (16× per image + YOLO online augmentation)
- Short training (4 epochs max)
- Pretrained features from COCO provide a strong initialization

**Assessment**: The frozen-backbone strategy with short training is the **correct approach** for this dataset size. However, the model could still memorize the 21 unique backgrounds/people.

### 14.2 Inference Latency Impact

| Metric | Phase 0 Baseline | Phase 1 (Proposed) | Impact |
|---|---|---|---|
| Model | yolo11m.pt | yolo11m.pt (fine-tuned) | No change in architecture |
| Image size | 1280 | 1280 | No change |
| Expected CPU latency | ~911 ms median | ~911 ms median | **No improvement** |
| Expected FPS | ~1.10 | ~1.10 | **No improvement** |

> [!NOTE]
> The Phase 1 fine-tuning does not address the latency problem (911 ms/frame, ~1.1 FPS). The original plan recommended evaluating `yolo11s`, `yolo11n`, or `imgsz=640` for latency improvement. This training run will produce a model with identical latency to the baseline.

### 14.3 Previous Training Run Status

> [!IMPORTANT]
> **A previous training attempt exists at `runs/detect/intelliproctor_phase1/` but was interrupted.** Only 5 files were generated (args.yaml, labels.jpg, 3 train_batch images). **No `weights/` directory exists and no model weights (best.pt, last.pt) were produced.** The training must be restarted from scratch.

---

## 15. Train/Val/Test Split Quality

### 15.1 Split Ratios

| Split | Images | Ratio | Assessment |
|---|---|---|---|
| Train | 938 | ~98.5% | ⚠️ Very high — nearly all data is in training |
| Val | 14 | ~1.5% | ⚠️ **Extremely small** |
| Test | 0 (external) | — | External test set used instead |

### 15.2 Validation Set Composition
The validation set contains exactly:
- 4 phone images (raw originals, no augmentations)
- 4 book_notebook images (raw originals, no augmentations)
- 3 water_bottle images (raw originals)
- 3 hand images (raw originals)

**Total: 14 images.**

### 15.3 Validation Set Adequacy

> [!WARNING]
> **The validation set is too small for reliable model selection.** With only 4 positive images per class, a single image changing from detected to undetected shifts recall by **25%** and can dramatically affect mAP. Early stopping decisions based on this validation set will be noisy and unreliable.

The `prepare_yolo_dataset.py` uses `VAL_RATIO = 0.20`, which yields 4-5 images per class from 21 raw images. The implementation correctly:
- Uses only raw originals (no augmentations) in validation
- Excludes augmentations derived from validation images from training
- Uses a seeded random split for reproducibility

### 15.4 Split Method
The split is implemented via per-class random shuffle with seed=42 (phone) and seed=43 (book_notebook). This means the split is:
- Reproducible ✅
- Per-class stratified ✅
- Clean (no augmentation leakage) ✅
- But source-level separation is not applicable since all images are from one session

---

## 16. Evaluation Architecture Audit

### 16.1 Available Evaluation Infrastructure

| Metric | Available? | Implementation |
|---|---|---|
| Precision | ✅ | `evaluate_phase1.py` computes per-class precision |
| Recall | ✅ | Raw detection rate + filtered detection rate |
| mAP50 | ✅ | YOLO built-in validation |
| mAP50-95 | ✅ | YOLO built-in validation |
| Class-specific recall | ✅ | `evaluate_phase1.py` reports per-class |
| Class-specific precision | ✅ | YOLO per-class validation |
| Confusion matrix | ✅ | YOLO built-in (`plots=true`) |
| False positives | ✅ | `evaluate_phase1.py` counts FPs on negative images |
| False negatives | ✅ | Missed detection counts |

### 16.2 Production Acceptance Criteria Evaluation

| Criterion | Measurable? | How |
|---|---|---|
| Phone detection > baseline (17.6%) | ✅ | `evaluate_phase1.py` runs on same 17 test images |
| Book detection > baseline (0%) | ✅ | `evaluate_phase1.py` runs on same 15 test images |
| FPR ≤ 5% | ✅ | `evaluate_phase1.py` tests against 28 negative images (water_bottle + hand raw) |
| No regressions on passing cases | ✅ | Per-image comparison available |
| Inference latency | ⚠️ Partially | No automated latency benchmark in `evaluate_phase1.py`, but `benchmark_latency.py` exists separately |

### 16.3 Evaluation Gap

> [!WARNING]
> The `evaluate_phase1.py` script tests against only 28 negative raw images (14 water_bottle + 14 hand). The Phase 0 baseline FPR was measured against 140 diverse negative images from `tests/test_data/`. The Phase 1 evaluation should also test against the full 140-image negative set for a fair comparison. Currently, `evaluate_phase1.py` only uses a subset.

---

## 17. Baseline Comparison

### 17.1 Verified Baseline Numbers

| Metric | Value | Source |
|---|---|---|
| Phone raw YOLO recall | 7/17 = 41.2% | `phase0_optimization_results.json` |
| Phone final filtered recall | 3/17 = 17.6% | `phase0_optimization_results.json` |
| Book raw recall | 0/15 = 0.0% | `phase0_optimization_results.json` |
| Book final recall | 0/15 = 0.0% | `phase0_optimization_results.json` |
| FPR on 140 negatives (filtered) | 12 phone FP + 7 book FP = 19/140 | FPR clarification: the 8.57% from the plan refers to phone FP at specific filter settings |
| CPU latency (median) | 911.25 ms | `latency_baseline_results.json` |
| FPS | ~1.10 | `latency_baseline_results.json` |

### 17.2 Baseline Artifacts
All baseline files in `tests/results/` are intact and unmodified. ✅

---

## 18. Training Readiness Gate

### BLOCKERS (Training MUST NOT begin)

#### BLOCKER 1: `data.yaml` Contains Invalid Absolute Path

**What**: [`dataset/yolo_dataset/data.yaml`](file:///c:/Advait/projects/CEP/IntelliProctor/dataset/yolo_dataset/data.yaml) contains:
```yaml
path: C:/Users/tanis/dataset/yolo_dataset
```
This path does not exist on the current machine. The dataset is located at:
```
c:\Advait\projects\CEP\IntelliProctor\dataset\yolo_dataset
```

**Why it matters**: YOLO training will fail immediately with a `FileNotFoundError` when trying to locate `images/train/` and `images/val/` under the non-existent path.

**Evidence**: Line 1 of `data.yaml`; also `train_phase1.py` line 27 references `DATA_YAML = r"C:\Users\tanis\dataset\yolo_dataset\data.yaml"`

**Fix required**:
1. Update `data.yaml` to use the correct path: `c:/Advait/projects/CEP/IntelliProctor/dataset/yolo_dataset`
2. Update `DATA_YAML` in `train_phase1.py` to the correct path

**Verification**: Run `python -c "import yaml; d=yaml.safe_load(open('dataset/yolo_dataset/data.yaml')); import os; assert os.path.exists(os.path.join(d['path'], d['train'])), 'FAIL'"` — should print nothing if correct.

---

#### BLOCKER 2: Training Script References Non-Existent Path

**What**: [`train_phase1.py`](file:///c:/Advait/projects/CEP/IntelliProctor/train_phase1.py) line 27:
```python
DATA_YAML = r"C:\Users\tanis\dataset\yolo_dataset\data.yaml"
```
This path does not exist on the current machine.

**Why it matters**: The training script will raise `FileNotFoundError` on line 72 before training begins.

**Evidence**: `train_phase1.py` line 27, line 72

**Fix required**: Change to `DATA_YAML = r"c:\Advait\projects\CEP\IntelliProctor\dataset\yolo_dataset\data.yaml"` or use a relative path.

**Verification**: Run `python train_phase1.py --epochs 0` (or similar dry-run) to verify the path resolves.

---

### REQUIRED FIXES (Training should NOT proceed without these)

#### REQUIRED FIX 1: Validation Set Too Small for Reliable Model Selection

**What**: The validation set contains only 14 images (4 phone, 4 book_notebook, 6 negative). This is insufficient for stable mAP computation.

**Why it matters**: With 4 positive images per class, early stopping based on validation mAP is noisy. A model that detects 3/4 vs 4/4 phone images shifts mAP by 25%. The "best" checkpoint may not actually be the best model.

**Fix required**: Increase validation set size to at least 10% of unique raw images, or better yet, collect additional validation images. Alternatively, use k-fold cross-validation (though this is more complex with YOLO).

**Practical workaround**: Given only 21 raw images per class, consider using 5–6 images for validation instead of 4. This reduces training set slightly but makes validation more reliable.

---

#### REQUIRED FIX 2: Warmup Epochs Exceed Useful Training Duration

**What**: Training is configured for `epochs=4` with `warmup_epochs=3.0`. This means 75% of training is spent in warmup where the learning rate is ramping up, leaving only 1 epoch at full learning rate.

**Why it matters**: The model barely gets to train at the intended learning rate before training ends or early stopping kicks in (`patience=2`).

**Fix required**: Either:
- Increase `epochs` to at least 20–30 (with `patience=5–10`)
- Reduce `warmup_epochs` to 1.0
- Or both

**Recommended**: `epochs=30, patience=10, warmup_epochs=1.0`

---

#### REQUIRED FIX 3: Learning Rate Too High for Fine-Tuning

**What**: `lr0=0.01` is the default YOLO learning rate for training from scratch. For fine-tuning from pretrained weights, a lower rate is standard practice.

**Why it matters**: Even with a frozen backbone, `lr0=0.01` can cause the neck and detection head to lose useful COCO feature representations quickly ("catastrophic forgetting" in the trainable layers).

**Fix required**: Set `lr0=0.001` or `lr0=0.002` for fine-tuning. The original plan also recommended `lr0=0.001`.

---

#### REQUIRED FIX 4: Evaluate Phase 1 Script Path References

**What**: [`evaluate_phase1.py`](file:///c:/Advait/projects/CEP/IntelliProctor/evaluate_phase1.py) lines 244–274 contain hardcoded paths to `C:\Users\tanis\dataset\`:
```python
val_dir = Path(r"C:\Users\tanis\dataset\yolo_dataset\images\val")
raw_base = Path(r"C:\Users\tanis\dataset\raw")
```

**Why it matters**: Post-training evaluation will fail or produce empty results.

**Fix required**: Update all hardcoded paths to the current machine's paths.

---

#### REQUIRED FIX 5: Augmentation Script Path References

**What**: Both [`augment_dataset.py`](file:///c:/Advait/projects/CEP/IntelliProctor/dataset/augment_dataset.py) (line 11) and [`prepare_yolo_dataset.py`](file:///c:/Advait/projects/CEP/IntelliProctor/dataset/prepare_yolo_dataset.py) (line 6) reference `C:\Users\tanis\dataset`:
```python
DATASET_DIR = Path(r"C:\Users\tanis\dataset")
```

**Why it matters**: If the augmentation or split scripts need to be re-run (e.g., to fix the validation set size), they will fail.

**Fix required**: Update to the correct local path.

---

### NON-BLOCKING IMPROVEMENTS (Training may proceed without)

#### IMPROVEMENT 1: Add Hard Negatives for Laptop/Tablet/Smartwatch

The three biggest false-positive sources (laptop: 3 FPs, tablet: 3 FPs, smartwatch: 3 FPs) are not represented in the training dataset. Adding diverse hard-negative images for these categories would significantly improve the model's ability to distinguish prohibited objects from common desk items.

**Recommended**: Collect 50–100 webcam images of each (laptop, tablet, smartwatch) and add to the dataset as negative training examples.

#### IMPROVEMENT 2: Collect Images from Additional People/Environments

The single-source dataset limits generalization. Even 5–10 additional people would dramatically improve robustness.

#### IMPROVEMENT 3: Review Edge-Case Annotations

~8 annotations (19%) involve objects that are barely visible (edge-clipped, edge-on, extremely distant). Consider whether these are helpful training signal or noise. At minimum, review:
- `WIN_20260920_18_47_35_Pro` (phone edge-on: 45%×2.5% box)
- `WIN_20260920_18_46_29_Pro` (phone at bottom edge: 9.8%×3.9% box)
- `WIN_20260920_18_52_01_Pro` (phone tiny: 6%×4% box)
- `WIN_20260920_22_36_49_Pro` (book at bottom edge: 12%×3% box)

#### IMPROVEMENT 4: Increase Epochs for CPU Training

With 4 epochs and warmup=3, the model barely trains. Even on CPU, 20–30 epochs with the ~940-image dataset should complete in a few hours. Increase epochs and patience accordingly.

#### IMPROVEMENT 5: Consider Smaller Model for Latency

The current approach fine-tunes yolo11m (same as baseline). This will not improve the 911ms/1.1 FPS latency. Consider also fine-tuning yolo11s or yolo11n for comparison, or training at imgsz=640 instead of 1280.

#### IMPROVEMENT 6: Naming Convention

Image filenames use Windows Camera naming (`WIN_20260920_18_44_28_Pro.jpg`). While functional, descriptive names would enable per-condition reporting as recommended in the original plan.

---

## 19. Final Verdict

## READY WITH REQUIRED FIXES

**The current setup cannot train as-is due to invalid file paths (BLOCKER 1, BLOCKER 2).** Once the 2 blockers and 5 required fixes are applied (approximately 1–2 hours of work), the system is technically ready to attempt a first training iteration.

**However, expectations must be calibrated:**

1. **The dataset is extremely small** (21 unique images per class). This is at the absolute minimum threshold mentioned in the original plan (200 images/class) only if augmented copies are counted, and augmented copies from 21 sources provide far less diversity than 200 unique images.

2. **Source diversity is essentially zero** — all images feature one person, one phone, one book, one room, one camera. The model will learn to detect this specific setup and may not generalize to other users, devices, or environments.

3. **Key false-positive sources are absent from training** — laptops, tablets, and smartwatches caused the most false positives in the Phase 0 baseline but are not included as hard negatives in training.

4. **The training hyperparameters need adjustment** — warmup is too long relative to total epochs, learning rate is too high for fine-tuning, and the validation set is too small for reliable model selection.

5. **Training will NOT improve latency** — the model architecture (yolo11m at imgsz=1280) is identical to the baseline.

6. **Evaluation is well-structured** — the held-out test set is clean, the baseline is preserved, and the evaluation scripts exist (with path fixes needed).

**The recommended path is:**
1. Fix BLOCKER 1 and 2 (path corrections) — 10 minutes
2. Apply REQUIRED FIX 1–5 (hyperparameters, paths) — 30 minutes
3. Run first training iteration with corrected settings — several hours on CPU
4. Evaluate against held-out test set using `evaluate_phase1.py`
5. Use results to inform whether more data collection is needed before the next iteration

---

## 20. Exact Recommended Next Steps

### Step 1: Fix `data.yaml` (BLOCKER 1)
```yaml
# dataset/yolo_dataset/data.yaml — UPDATED
path: c:/Advait/projects/CEP/IntelliProctor/dataset/yolo_dataset
train: images/train
val: images/val
names:
  0: phone
  1: book_notebook
```

### Step 2: Fix `train_phase1.py` (BLOCKER 2 + Required Fixes)
```python
DATA_YAML = r"c:\Advait\projects\CEP\IntelliProctor\dataset\yolo_dataset\data.yaml"
```
Also update training hyperparameters:
```python
EPOCHS = 30          # was 4
PATIENCE = 10        # was 2
```
And in the `model.train()` call, add:
```python
lr0=0.001,           # fine-tuning learning rate
warmup_epochs=1.0,   # was 3.0 (default)
```

### Step 3: Fix `evaluate_phase1.py` paths
Update all `C:\Users\tanis\dataset\` references to `c:\Advait\projects\CEP\IntelliProctor\dataset\`

### Step 4: Fix `augment_dataset.py` and `prepare_yolo_dataset.py` paths
Update `DATASET_DIR` to `c:\Advait\projects\CEP\IntelliProctor\dataset`

### Step 5: Clear previous interrupted training run
Delete `runs/detect/intelliproctor_phase1/` to start fresh (the existing run has no weights).

### Step 6: Train
```bash
python train_phase1.py --epochs 30 --patience 10
```

### Step 7: Evaluate
```bash
python evaluate_phase1.py
```

### Confirmed Configuration for Training

| Parameter | Value |
|---|---|
| Dataset YAML | `dataset/yolo_dataset/data.yaml` |
| Class mapping | `0: phone, 1: book_notebook` |
| Split | 938 train / 14 val |
| Model | `yolo11m.pt` (COCO pretrained) |
| Frozen layers | 10 (backbone) |
| Epochs | 30 (with patience=10) |
| Batch size | 8 |
| Image size | 1280 |
| Learning rate | 0.001 |
| Warmup epochs | 1.0 |
| Device | CPU |
| Mosaic | 0.0 (disabled) |
| Seed | 42 |
| Output | `runs/detect/intelliproctor_phase1/` |

### Expected Training Outputs
- `runs/detect/intelliproctor_phase1/weights/best.pt` — best validation checkpoint
- `runs/detect/intelliproctor_phase1/weights/last.pt` — final epoch checkpoint
- `runs/detect/intelliproctor_phase1/results.csv` — per-epoch metrics
- `runs/detect/intelliproctor_phase1/results.png` — loss/metric curves
- `runs/detect/intelliproctor_phase1/confusion_matrix.png` — class confusion
- `runs/detect/intelliproctor_phase1/training_summary.json` — custom summary from `train_phase1.py`

> Training may proceed **after** the blockers and required fixes are applied.

---

*This audit was performed on the actual repository files. No training was executed, no dataset was modified, no production code was changed, and no baseline results were overwritten.*
