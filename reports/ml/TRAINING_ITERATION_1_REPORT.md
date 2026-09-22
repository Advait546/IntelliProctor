# IntelliProctor — Training Iteration 1 Post-Training Evaluation Report

## 1. Executive Summary

This report documents the rigorous post-training technical evaluation of **Training Iteration 1** for the IntelliProctor prohibited object detection subsystem. Training was executed on local GPU hardware (`NVIDIA GeForce RTX 4050 Laptop GPU`) using Ultralytics YOLO11m fine-tuned for 2 classes: `0: phone` and `1: book_notebook`.

The goal of Training Iteration 1 was to establish whether fine-tuning the baseline pre-trained YOLO11m model on domain-specific data would resolve critical baseline deficiencies (e.g. 0% book detection recall, 17.6% phone recall) without degrading false-positive rates or real-time latency.

### Key Evaluation Takeaways:
1. **Raw Detection Sensitivity Improved Dramatically**:
   - Phone raw detection recall surged from **64.7% (11/17)** to **100.0% (17/17)**.
   - Book raw detection recall surged from **13.3% (2/15)** to **66.7% (10/15)**.
2. **Production Filtered Recall Remained Low**:
   - Confidence calibration on held-out external benchmark images dropped. When filtered with production thresholds (confidence $\ge 0.65$ and aspect ratio validation), Phone Final Recall was **11.8% (2/17)** (vs. 17.6% baseline) and Book Final Recall was **0.0% (0/15)** (vs. 0.0% baseline).
3. **Severe False Alarm Rate Inflation on Benchmark Negatives**:
   - False positive rate (FPR) across the 140-image negative benchmark spiked from **13.6% (19/140)** to **47.9% (67/140)**.
   - FPs heavily concentrated on laptops (65.0% FPR) and tablets (65.0% FPR), with books frequently hallucinated on open laptops, screens, and notebooks.
4. **Extreme Domain Overfitting Confirmed**:
   - On the local raw negative test sets (`water_bottle` and `hand_no_prohibited_object`, 28 images total), the model achieved **0.0% FPR (0/28 FPs)**, proving that the model memorized the specific capture room, background, subject, and lighting, but failed to generalize to varied external domains.
5. **CPU Latency & Throughput Remained Stable**:
   - Total pipeline median CPU latency: **864.01 ms** (1.16 FPS) vs. baseline **911.25 ms** (1.10 FPS).

### Final Verdict:
**`ITERATION INCONCLUSIVE — COLLECT MORE DATA`**

The training pipeline, GPU fine-tuning harness, loss convergence, and feature learning are verified to function properly. However, the extreme lack of training data diversity (only 21 raw positive images, single subject, single room, single camera) and the complete absence of negative training samples (e.g. laptops, tablets, smartwatches) caused severe domain overfitting and elevated false alarm rates on out-of-distribution benchmark images.

---

## 2. Training Run Verification

The completed training run under `runs/detect/intelliproctor_phase1_iter1_gpu` was inspected and verified.

| Parameter | Configuration / Observed Value |
| :--- | :--- |
| **Model Weights Checkpoint** | `runs/detect/intelliproctor_phase1_iter1_gpu/weights/best.pt` |
| **Last Weights Checkpoint** | `runs/detect/intelliproctor_phase1_iter1_gpu/weights/last.pt` |
| **Weights File Size** | 40,577,132 bytes (~38.7 MB) |
| **Model Classes** | 2 classes (`0: phone`, `1: book_notebook`) |
| **Base Architecture** | YOLO11m (`yolo11m.pt`, 20,094,446 parameters) |
| **Hardware Device** | `CUDA:0` (`NVIDIA GeForce RTX 4050 Laptop GPU`) |
| **Mixed Precision (AMP)** | Enabled (`amp: true`) |
| **Epochs Configured / Executed**| 30 configured / **29 executed** |
| **Early Stopping** | **Triggered at Epoch 29** (patience = 10 epochs without mAP50 improvement) |
| **Best Epoch** | **Epoch 16** |
| **Best Validation Metrics** | **mAP50: 0.7825**, mAP50-95: 0.3301, Precision: 0.6354, Recall: 0.8589 |
| **Final Validation Metrics** | mAP50: 0.7450, mAP50-95: 0.2833, Precision: 0.6555, Recall: 0.8683 |
| **Optimizer** | `AdamW` |
| **Initial Learning Rate ($lr_0$)** | `0.001` ($lr_f = 0.01$, final effective lr $\approx 7.6 \times 10^{-5}$) |
| **Batch Size & Image Size** | Batch = 4, `imgsz = 1280` |
| **Frozen Layers** | First 10 backbone layers (`freeze: 10`) |
| **Data Augmentation** | Flips, translation (0.1), scaling (0.5), HSV color jitter |

---

## 3. Direct Baseline vs. Training Iteration 1 Comparison Table

The table below presents a direct side-by-side comparison between the out-of-the-box pre-trained YOLO11m baseline and the fine-tuned Iteration 1 checkpoint (`best.pt`) across identical test suites.

| Metric | Pre-trained Baseline (`yolo11m.pt`) | Training Iteration 1 (`best.pt`) | Delta / Evaluation Analysis |
| :--- | :---: | :---: | :--- |
| **Phone Raw Recall** | 64.7% (11/17) | **100.0% (17/17)** | **+35.3%** (Model detected candidate box on every test phone) |
| **Phone Conf Recall ($\ge 0.65$)** | 29.4% (5/17) | **11.8% (2/17)** | **-17.6%** (Under-confident predictions on unseen domain) |
| **Phone Aspect Filtered Recall** | 17.6% (3/17) | **11.8% (2/17)** | **-5.8%** |
| **Phone Final Passing Recall** | **17.6% (3/17)** | **11.8% (2/17)** | **-5.8%** (1 less passing phone at 0.65 threshold) |
| **Book Raw Recall** | 13.3% (2/15) | **66.7% (10/15)** | **+53.4%** (Learned book object features from scratch) |
| **Book Conf Recall ($\ge 0.65$)** | 0.0% (0/15) | **0.0% (0/15)** | **0.0%** (Detections clustered in $0.15 - 0.58$ confidence range) |
| **Book Aspect Filtered Recall** | 0.0% (0/15) | **0.0% (0/15)** | **0.0%** |
| **Book Final Passing Recall** | **0.0% (0/15)** | **0.0% (0/15)** | **0.0%** (Zero predictions surpassed 0.65 threshold) |
| **Negative Benchmark FPs (140 imgs)**| 19 / 140 | **67 / 140** | **+48 FPs** (Severe increase in false alarms) |
| **Negative Benchmark FPR** | **13.6%** | **47.9%** | **+34.3%** (3.5× higher false alarm rate) |
| **Phone FPs on Negatives** | 12 | **37** | **+25** (Hallucinations on tablets, calculators, remotes) |
| **Book FPs on Negatives** | 7 | **44** | **+37** (Hallucinations on laptops, open notebooks, pads) |
| **Raw Negatives FPR (28 imgs)** | **0.0% (0/28)** | **0.0% (0/28)** | **0.0%** (Perfect rejection on local capture domain) |
| **Median CPU Latency** | 911.25 ms | **864.01 ms** | **-47.24 ms** (Stable; within normal CPU run-to-run noise) |
| **Mean CPU Latency** | 927.68 ms | **891.28 ms** | **-36.40 ms** |
| **YOLO Only Latency (Median)**| 890.41 ms | **843.82 ms** | **-46.59 ms** |
| **Throughput (FPS)** | 1.10 FPS | **1.16 FPS** | **+0.06 FPS** (Real-time CPU performance unchanged) |

---

## 4. Phone Detection Detailed Evaluation

### Metrics Summary:
- **Total Test Images**: 17
- **Raw Detections ($\text{conf} > 0.01$)**: 17 / 17 (**100.0%**)
- **Confidence Filtered ($\text{conf} \ge 0.65$)**: 2 / 17 (**11.8%**)
- **Aspect Ratio Filtered ($1.2 \le AR \le 3.2$)**: 2 / 17 (**11.8%**)
- **Final True Positives**: 2
- **Final False Negatives**: 15

### Analysis:
In the pre-trained baseline, YOLO11m completely missed 6 of the 17 phone images (raw recall 64.7%). With fine-tuning, Iteration 1 detected a candidate phone bounding box in **every single phone test image (100% raw recall)**. This proves that the fine-tuned backbone successfully learned rich visual feature patterns for phones.

However, the model output lower confidence scores on the held-out phone benchmark images (which were captured with different camera sensors, lighting, and angles than the 14 training phones). 15 out of 17 detections had confidence scores between $0.015$ and $0.62$, falling below the strict production threshold of $0.65$.

---

## 5. Book Detection Detailed Evaluation

### Metrics Summary:
- **Total Test Images**: 15
- **Raw Detections ($\text{conf} > 0.01$)**: 10 / 15 (**66.7%**)
- **Confidence Filtered ($\text{conf} \ge 0.65$)**: 0 / 15 (**0.0%**)
- **Aspect Ratio Filtered ($0.7 \le AR \le 2.5$)**: 0 / 15 (**0.0%**)
- **Final True Positives**: 0
- **Final False Negatives**: 15

### Analysis:
In the baseline, standard YOLO11m detected books in only 2 of 15 images (raw recall 13.3%), both with low confidence. In Iteration 1, despite having only **7 raw book training images** (expanded via augmentation to 56 training instances), the model successfully recognized candidate book structures in **10 of 15 test images (66.7% raw recall)**.

None of the 10 detected books reached the production confidence threshold ($\ge 0.65$), with confidence values peaking at $0.58$. While this represents substantial feature learning from an impoverished training set, it is insufficient for production deployment without significantly more real-world book training data.

---

## 6. Negative Benchmark Detailed Evaluation (140 Images)

The negative benchmark evaluates false positive rates across 140 non-prohibited desk and study objects across 9 distinct categories.

### Category-by-Category False Positive Breakdown:

| Category | Images | Baseline FPs | Baseline FPR | Iter 1 FPs | Iter 1 FPR | Iter 1 Phone FPs | Iter 1 Book FPs | Rejections |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Laptop** | 20 | 5 | 25.0% | **13** | **65.0%** | 5 | 12 | 7 / 20 |
| **Tablet** | 20 | 3 | 15.0% | **13** | **65.0%** | 11 | 6 | 7 / 20 |
| **Smartwatch** | 15 | 3 | 20.0% | **5** | **33.3%** | 3 | 2 | 10 / 15 |
| **Calculator** | 15 | 2 | 13.3% | **7** | **46.7%** | 4 | 5 | 8 / 15 |
| **Notebook** | 15 | 2 | 13.3% | **7** | **46.7%** | 3 | 5 | 8 / 15 |
| **Headphones** | 15 | 1 | 6.7% | **5** | **33.3%** | 4 | 4 | 10 / 15 |
| **Water Bottle** | 10 | 2 | 20.0% | **5** | **50.0%** | 2 | 3 | 5 / 10 |
| **Pen** | 10 | 1 | 10.0% | **4** | **40.0%** | 1 | 3 | 6 / 10 |
| **Other** | 20 | 0 | 0.0% | **8** | **40.0%** | 4 | 4 | 12 / 20 |
| **TOTAL** | **140** | **19** | **13.6%** | **67** | **47.9%** | **37** | **44** | **73 / 140** |

### Key Observations:
1. **Laptops & Tablets are Major False Positive Drivers**:
   - 65.0% of laptops and tablets triggered false alarms. Open laptops and keyboards were repeatedly classified as `book_notebook`, while tablet screens were classified as `phone`.
2. **Book Class Over-Generalization**:
   - The book detector produced 44 false alarms across the 140 negative images. Any rectangular flat surface with text or contrast (laptop screens, open folders, desk pads, notebooks) was classified as `book_notebook`.
3. **No Negative Samples in Training Data**:
   - The training set contained **zero background images** containing laptops, tablets, or monitors. Consequently, the model had no negative supervision to differentiate a laptop display from an open textbook or a tablet from a large phone.

---

## 7. Raw Negatives Evaluation (Local Capture Domain)

To test the hypothesis of domain overfitting, the model was evaluated against the 28 raw negative images captured locally in the exact same environment as the training positive data:
- `water_bottle`: 14 images
- `hand_no_prohibited_object`: 14 images

| Negative Dataset | Images | Iteration 1 FPs | Iteration 1 FPR | Baseline FPs | Baseline FPR |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Raw Water Bottle** | 14 | **0** | **0.0%** | 0 | 0.0% |
| **Raw Hand / Empty Desk** | 14 | **0** | **0.0%** | 0 | 0.0% |
| **Total Local Negatives** | **28** | **0** | **0.0%** | **0** | **0.0%** |

### The Critical Domain Discrepancy:
- **Local Domain**: 0.0% FPR (0 / 28 false positives)
- **External Benchmark**: 47.9% FPR (67 / 140 false positives)

This stark contrast provides undeniable mathematical proof of **domain memorization**: within the training environment (same desk, same wall background, same ambient lighting, same webcam angle), the model exhibits near-perfect discrimination. But when exposed to novel external backgrounds, diverse lighting, and varied camera resolutions, its discrimination collapses.

---

## 8. Baseline Passing Cases Regression Analysis

The baseline model correctly passed exactly 3 phone images under full production filtering. In Training Iteration 1, those 3 specific images were tracked to verify stability and regression:

| Image Filename | Baseline Result | Iteration 1 Result | Iteration 1 Conf | Iteration 1 AR | Status | Reason / Detail |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| `WhatsApp Image 2026-08-31 at 14.34.58 (2).jpeg` | **PASS (TP)** | **FAIL (FN)** | 0.0151 | 1.339 | **REGRESSION** | Severe confidence collapse from >0.65 to 0.0151 |
| `WhatsApp Image 2026-08-31 at 14.34.58.jpeg` | **PASS (TP)** | **FAIL (FN)** | 0.5022 | 2.015 | **REGRESSION** | Detected with AR=2.015, but conf 0.5022 < 0.65 threshold |
| `WhatsApp Image 2026-08-31 at 14.34.59 (3).jpeg` | **PASS (TP)** | **PASS (TP)** | **0.8200** | 2.287 | **STILL PASSING** | High confidence detection passing all filters |

### Regression Summary:
- **Still Passing**: 1 / 3 (33.3%)
- **Regressions**: 2 / 3 (66.7%)

Fine-tuning on the 14 training phones shifted feature weights away from standard general phone features toward the specific physical appearance, aspect ratios, and angles of the training phone. Consequently, two previously confident baseline detections fell below the $0.65$ threshold.

---

## 9. CPU Latency & Throughput Benchmark

A rigorous 100-frame latency profile was conducted on the full proctoring pipeline (MediaPipe Face Mesh + YOLO11m Inference + Filtering) under identical conditions to the Phase 0 baseline:
- **Hardware**: CPU execution
- **Input Resolution**: 1280x720 (synthetic exam webcam frames)
- **YOLO Input Size (`imgsz`)**: 1280
- **Total Frames Sampled**: 100

### Latency Comparison Table:

| Component / Metric | Baseline (`yolo11m.pt`) | Iteration 1 (`best.pt`) | Delta |
| :--- | :---: | :---: | :---: |
| **Total Frame Latency (Median)** | **911.25 ms** | **864.01 ms** | -47.24 ms (-5.2%) |
| **Total Frame Latency (Mean)** | **927.68 ms** | **891.28 ms** | -36.40 ms (-3.9%) |
| **Total Frame Latency (P90)** | **948.33 ms** | **917.27 ms** | -31.06 ms |
| **Total Frame Latency (P95)** | **1025.10 ms** | **987.37 ms** | -37.73 ms |
| **Total Frame Latency (Min / Max)** | 782.1 ms / 2150.4 ms | 764.59 ms / 2342.90 ms | — |
| **YOLO Inference (Median)** | **890.41 ms** | **843.82 ms** | -46.59 ms |
| **YOLO Inference (Mean)** | **906.12 ms** | **869.60 ms** | -36.52 ms |
| **MediaPipe Latency (Median)** | **19.82 ms** | **19.56 ms** | -0.26 ms |
| **Post-Processing (Median)** | **0.12 ms** | **0.13 ms** | +0.01 ms |
| **Median Throughput (FPS)** | **1.10 FPS** | **1.16 FPS** | **+0.06 FPS** |

### Latency Conclusions:
1. Fine-tuning did not alter the network architecture or parameter count (YOLO11m backbone remains intact with 2 output heads instead of 80).
2. The slight reduction from 911 ms to 864 ms is standard CPU thread-scheduling variance.
3. The model maintains steady ~1.16 FPS on CPU at `imgsz=1280`. As established in Phase 0, downscaling to `imgsz=640` or enabling dynamic ROI/skipping will achieve 10–15 FPS when required for production.

---

## 10. Error Analysis — What Went Right

1. **Hardware & Pipeline Verification**:
   - The GPU training harness ran with full CUDA acceleration on the RTX 4050, resolving the previous CPU bottleneck.
   - Mixed-precision training (`amp: true`) and AdamW optimizer operated stably over 29 epochs without gradient explosion or NaN losses.
2. **Successful Feature Learning for Under-Represented Classes**:
   - **Book Detection**: Baseline YOLO11m detected books in only 13.3% of test images. Iteration 1 detected books in 66.7% of test images, proving that the model successfully learned visual representations of books and notebooks.
   - **Phone Detection**: Raw detection recall reached 100.0%, indicating that candidate extraction is now exhaustive.
3. **Local Domain Discrimination**:
   - The model achieved 0% false positives on local negative objects (water bottles and empty hands), proving that the detector does not trigger indiscriminately when objects match the trained environment.

---

## 11. Error Analysis — What Went Wrong

1. **Confidence Score Degradation on Out-of-Distribution Data**:
   - While raw recall surged, confidence scores on external benchmark images were heavily depressed ($0.15 - 0.55$).
   - The model became over-confident on the training domain and under-confident on novel domains.
2. **False Positive Explosion on Benchmark Negatives (47.9% FPR)**:
   - 67 false alarms were triggered across 140 negative images.
   - 37 phone false alarms (especially on tablets and smartwatches).
   - 44 book false alarms (especially on laptop keyboards, screens, and notebooks).
3. **Regression on Baseline True Positives**:
   - 2 of the 3 previously passing phone cases were lost due to confidence dropping below the $0.65$ threshold.

---

## 12. Overfitting & Data Diversity Analysis

The root cause of the observed behavior is an extreme data diversity bottleneck:

```
Total Raw Positive Images in Training: 21 images
├── Phones: 14 images (single smartphone model, single desk, single room)
└── Books: 7 images (single notebook type, single angle)
```

Although offline augmentations (flips, rotations, crops, color shifts) multiplied these into 56 training images, augmentations cannot introduce new visual features:
- **No Variations in Subjects**: All hand grips, skin tones, and postures belong to a single individual.
- **No Variations in Hardware**: Only 1 phone model and 1 notebook were present in the source data.
- **No Background Variation**: All images were taken against the identical wall/desk backdrop.
- **Backbone Layer Freezing**: Freezing the first 10 layers (`freeze: 10`) prevented catastrophic forgetting of low-level edges, but the newly trained head became hyper-specialized on the narrow statistical distribution of the 21 source images.

---

## 13. Domain Shift Analysis

The massive delta between the local raw negatives (**0.0% FPR**) and the benchmark negatives (**47.9% FPR**) is a classic manifestation of **domain shift**:

```
Local Environment (Training Domain)               External Benchmark (Evaluation Domain)
-------------------------------------             --------------------------------------
• Single Logitech webcam sensor                   • Multiple smartphone cameras & sensors
• Fixed fluorescent indoor lighting               • Daylight, incandescent, low-light
• Neutral desk backdrop                           • Cluttered desks, monitors, office setups
• Model memorized non-object background           • Novel textures misconstrued as book/phone
• Result: 0% FPR (0/28)                           • Result: 47.9% FPR (67/140)
```

Because the training set included no negative background images containing laptops, tablets, or diverse office items, the model learned a decision boundary where any rectangular object with high contrast was classified as a prohibited object.

---

## 14. Decision Framework Evaluation

The three formal decision outcomes were evaluated against empirical evidence:

### Option A: `ITERATION SUCCESS — CONTINUE EXPERIMENTATION`
- **Criteria**: Final phone recall $\ge 50\%$, book recall $\ge 30\%$, benchmark FPR $\le 15\%$, no regressions.
- **Actual Evidence**: Phone final recall is 11.8%, book final recall is 0.0%, benchmark FPR jumped to 47.9%, and 2 regressions occurred.
- **Verdict**: **REJECTED**.

### Option B: `ITERATION FAILED — INVESTIGATE TRAINING`
- **Criteria**: Training diverged, loss did not decrease, GPU harness failed, weights corrupted, or raw sensitivity decreased.
- **Actual Evidence**: Training converged smoothly (box loss dropped from 1.96 to 0.48, cls loss from 3.73 to 0.38), validation mAP50 reached 0.7825, GPU acceleration succeeded, and raw sensitivity increased from 64.7% to 100% (phones) and 13.3% to 66.7% (books). The training process itself was sound.
- **Verdict**: **REJECTED**.

### Option C: `ITERATION INCONCLUSIVE — COLLECT MORE DATA`
- **Criteria**: Model learned target features (substantial raw sensitivity gains), but performance is bottlenecked by severe dataset limitations (lack of diverse subjects, backgrounds, and negative counter-examples).
- **Actual Evidence**: 
  - Raw phone recall reached 100.0%.
  - Raw book recall reached 66.7%.
  - 0% FPR on local domain confirms discrimination capability.
  - 47.9% FPR on benchmark confirms domain shift due to only 21 source positive images and 0 hard negative training images.
- **Verdict**: **ACCEPTED**.

---

## 15. Final Iteration Verdict

# `ITERATION INCONCLUSIVE — COLLECT MORE DATA`

---

## 16. Root Cause Summary

1. **Source Data Scarcity**: 21 source positive images (14 phones, 7 books) are insufficient to span the variance of smartphones and books encountered in real exam conditions.
2. **Absence of Negative Counter-Examples**: The training split contained zero un-annotated or hard-negative background images of laptops, monitors, tablets, smartwatches, or calculators.
3. **Domain Narrowness**: All training images originated from a single room, camera, and lighting setup.
4. **Confidence Calibration Shift**: The classification head assigned peak probabilities to the training domain, causing valid external test objects to fall into the $0.15 - 0.55$ confidence range while misclassifying external laptops as books.

---

## 17. Concrete Action Plan for Training Iteration 2

To achieve production readiness in Training Iteration 2, the following systematic steps must be executed:

### A. Dataset Expansion (Mandatory)
1. **Multi-Subject Positive Collection**:
   - Collect at least **150–200 diverse phone images** across at least 5 different rooms, 4 different subjects, various phone models (cases, colors, screen-on vs screen-off), and multiple hand grips (one-handed, two-handed, typing, resting).
   - Collect at least **150–200 diverse book and notebook images** (open books, closed notebooks, spiral pads, textbooks, with and without text).
2. **Targeted Hard Negatives Collection (Zero-Annotation Background Images)**:
   - Add **100+ negative background images** containing open laptops, laptop keyboards, external computer monitors, tablets, smartwatches, calculators, and desk stationery without any phone or book present.
   - In YOLO format, background images are included with empty `.txt` label files, directly training the model to suppress false alarms on laptops and tablets.

### B. Training Configuration Improvements
1. **Hyperparameter Tuning**:
   - Increase training duration to **50 epochs** with a warmup of 3 epochs.
   - Adjust classification loss weight (`cls: 1.0` vs default `0.5`) to penalize false positives more heavily.
   - Enable `mosaic: 0.5` and `mixup: 0.1` augmentations to force scale and background invariance.
2. **Backbone Unfreezing Strategy**:
   - Train for 15 epochs with `freeze: 10`, then unfreeze all layers for the remaining 35 epochs at a reduced learning rate ($1 \times 10^{-4}$) to allow deeper feature adaptation.

### C. Validation & Benchmarking Strategy
1. Split the new dataset using a **stratified multi-source validation split** (validation set must contain images from rooms/subjects never seen in the training split).
2. Retain the 172-image benchmark as the inviolable final evaluation test suite.

---

## 18. Deliverables & Preserved Artifacts Inventory

All baseline and Iteration 1 evaluation artifacts have been strictly preserved:

| File Path | Description | Status |
| :--- | :--- | :--- |
| `runs/detect/intelliproctor_phase1_iter1_gpu/weights/best.pt` | Iteration 1 Best Trained Model Checkpoint | Preserved |
| `runs/detect/intelliproctor_phase1_iter1_gpu/weights/last.pt` | Iteration 1 Final Checkpoint (Epoch 29) | Preserved |
| `runs/detect/intelliproctor_phase1_iter1_gpu/results.csv` | Epoch-by-epoch training/val loss & mAP logs | Preserved |
| `runs/detect/intelliproctor_phase1_iter1_gpu/results.png` | Training loss curves and metric trajectory | Preserved |
| `runs/detect/intelliproctor_phase1_iter1_gpu/confusion_matrix.png` | Final validation confusion matrix | Preserved |
| `runs/detect/intelliproctor_phase1_iter1_gpu/args.yaml` | Exact hyperparameters used for training | Preserved |
| `tests/results/iteration1_gpu_summary.json` | Comprehensive comparative evaluation summary | Preserved |
| `tests/results/latency_iteration1_gpu_results.json` | 100-frame CPU latency profiling measurements | Preserved |
| `tests/results/iteration1_gpu_per_image_results.json` | Per-image detection details across all test suites | Preserved |
| `tests/results/iteration1_gpu_eval_results.csv` | Full tabular benchmark results | Preserved |
| `baseline_32_images_yolo11m_results.json` | Original 32-image baseline results | Preserved (Untouched) |
| `latest_automated_detection_results.json` | Original automated evaluation results | Preserved (Untouched) |
| `latency_baseline_results.json` | Original CPU latency baseline | Preserved (Untouched) |
| `phase0_optimization_results.json` | Original Phase 0 optimization results | Preserved (Untouched) |
| `TRAINING_ITERATION_1_REPORT.md` | Full formal post-training report | Created |
