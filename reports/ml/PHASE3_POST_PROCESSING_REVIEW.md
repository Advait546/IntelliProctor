# IntelliProctor — Phase 3 Post-Processing Review & Filter Optimization Report

## 1. Overview & Objectives

In the IntelliProctor implementation roadmap ([`implementation_plan.md`](file:///c:/Advait/projects/CEP/IntelliProctor/implementation_plan.md)):
- **Phase 0**: Filter Experiment Completion & Infrastructure Fixes (✅ COMPLETE)
- **Phase 1**: Dataset Collection & Annotation (Partial / Legacy team iteration)
- **Phase 2**: Fine-Tuning Experiment (✅ Deliverables Produced; Exit Criteria Failed: `ITERATION INCONCLUSIVE — COLLECT MORE DATA`)
- **Phase 3**: Post-Processing Review (THIS PHASE)
  - *Entry criteria*: Phase 2 evaluation report complete (`TRAINING_ITERATION_1_REPORT.md` ✅).
  - *Goal*: Systematically investigate whether post-processing calibrations (class-specific confidence sweeps, aspect ratio adjustments, and filter ordering) can salvage the fine-tuned model (`best.pt`) to meet production acceptance thresholds, or whether the model is fundamentally blocked on dataset expansion before production integration (Phase 4).

---

## 2. Phase 2 Deliverables vs. Acceptance Exit Criteria Audit

Before beginning Phase 3, we audited the formal checklist for Phase 2:

### A. Phase 2 Deliverable Artifacts: ✅ MET
| Deliverable | Expected Artifact | Actual File Location | Status |
| :--- | :--- | :--- | :---: |
| **Fine-tuned model weights** | YOLO11m weights file | `runs/detect/intelliproctor_phase1_iter1_gpu/weights/best.pt` | ✅ MET |
| **Training log & curves** | CSV logs, loss & mAP curves | `results.csv`, `results.png`, `confusion_matrix.png`, `args.yaml` | ✅ MET |
| **Comparison evaluation report** | Baseline vs Fine-tuned table | `TRAINING_ITERATION_1_REPORT.md`, `tests/results/iteration1_gpu_summary.json` | ✅ MET |
| **Class ID mapping docs** | Documented custom classes | Documented (`0: phone`, `1: book_notebook`) | ✅ MET |
| **Hardware latency benchmark** | CPU latency profile | `tests/results/latency_iteration1_gpu_results.json` (864.01 ms median, 1.16 FPS) | ✅ MET |

### B. Phase 2 Exit / Acceptance Criteria: ❌ NOT MET
| Criterion | Section 7 Production Threshold | Pre-trained Baseline | Phase 2 Model (`best.pt`) | Status |
| :--- | :---: | :---: | :---: | :---: |
| **Phone Filtered Recall** | $\ge 50.0\%$ ($\ge 9/17$) | 17.6% (3/17) | **11.8% (2/17)** | ❌ **FAILED** (Net regression) |
| **Book Filtered Recall** | $\ge 40.0\%$ ($\ge 6/15$) | 0.0% (0/15) | **0.0% (0/15)** | ❌ **FAILED** (Zero passing) |
| **Negative Benchmark FPR** | $\le 5.0\%$ ($\le 7/140$) | 13.6% (19/140) | **47.9% (67/140)** | ❌ **FAILED** (3.5× baseline, 9.6× target) |
| **Regressions on Baseline PASSes** | **0** | 3 passing | **2 regressions** (only 1/3 retained) | ❌ **FAILED** |
| **Median CPU Latency** | $\le 911.25\text{ ms}$ | 911.25 ms | **864.01 ms** | ✅ **MET** |

**Conclusion on Phase 2**:
All deliverable files were successfully created and preserved. However, the model failed the acceptance exit criteria. Under the implementation plan, **Phase 4 (Production Integration) is strictly blocked**.

Phase 3 was therefore initiated to evaluate whether post-processing optimization can close the gap.

---

## 3. Phase 3 Experimental Sweep Methodology

Using the complete per-image detection results (`tests/results/iteration1_gpu_per_image_results.json`), we executed a comprehensive parametric grid search across:
1. **Aspect Ratio Filtering Configurations**:
   - `Current Production`: Phone $\in [1.3, 2.9]$, Book = None.
   - `Relaxed Phone`: Phone $\in [1.15, 2.9]$, Book = None (Phase 0 recommendation).
   - `Wide Phone`: Phone $\in [1.10, 3.2]$, Book = None.
   - `Bounded Book`: Phone $\in [1.15, 2.9]$, Book $\in [0.8, 2.5]$.
   - `Unconstrained`: Phone = None, Book = None.
2. **Confidence Thresholds**:
   - 16 discrete intervals from $0.05$ to $0.80$.
3. **Evaluated Test Sets**:
   - 17 held-out Phone test images.
   - 15 held-out Book test images.
   - 140 held-out Negative benchmark images across 9 categories (laptops, tablets, smartwatches, calculators, notebooks, headphones, water bottles, pens, others).
   - 3 baseline passing phone images (regression tracking).

The full sweep data is serialized in [`tests/results/phase3_post_processing_sweep_results.json`](file:///c:/Advait/projects/CEP/IntelliProctor/tests/results/phase3_post_processing_sweep_results.json).

---

## 4. Empirical Sweep Results

### A. Key Threshold Comparison Across Aspect Configurations

| Configuration | Conf Threshold | Phone Recall | Book Recall | Neg FPR | Precision | F1 Score | Regressions |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Current Production** | 0.65 (Baseline) | 11.8% (2/17) | 0.0% (0/15) | **47.9%** (67/140) | 2.9% | 4.0% | 2 / 3 |
| (Phone: 1.3-2.9, Book: None) | 0.50 | 35.3% (6/17) | 0.0% (0/15) | **66.4%** (93/140) | 6.1% | 9.2% | 1 / 3 |
| | 0.30 | 35.3% (6/17) | 26.7% (4/15) | **79.3%** (111/140) | 8.3% | 13.1% | 1 / 3 |
| | 0.10 | 35.3% (6/17) | 40.0% (6/15) | **87.1%** (122/140) | 9.0% | 14.5% | 1 / 3 |
| **Relaxed Phone (1.15-2.9)** | 0.65 | 11.8% (2/17) | 0.0% (0/15) | **50.0%** (70/140) | 2.8% | 3.9% | 2 / 3 |
| (Book: None) | 0.50 | 41.2% (7/17) | 0.0% (0/15) | **68.6%** (96/140) | 6.8% | 10.4% | 1 / 3 |
| | 0.30 | 41.2% (7/17) | 26.7% (4/15) | **80.7%** (113/140) | 8.9% | 14.1% | 1 / 3 |
| | 0.10 | 47.1% (8/17) | 40.0% (6/15) | **88.6%** (124/140) | 10.1% | 16.5% | 1 / 3 |
| **Bounded Book (0.8-2.5)** | 0.65 | 11.8% (2/17) | 0.0% (0/15) | **50.0%** (70/140) | 2.8% | 3.9% | 2 / 3 |
| (Phone: 1.15-2.9) | 0.50 | 41.2% (7/17) | 0.0% (0/15) | **68.6%** (96/140) | 6.8% | 10.4% | 1 / 3 |
| | 0.30 | 41.2% (7/17) | 26.7% (4/15) | **79.3%** (111/140) | 9.0% | 14.3% | 1 / 3 |
| | 0.10 | 47.1% (8/17) | 40.0% (6/15) | **86.4%** (121/140) | 10.4% | 16.8% | 1 / 3 |
| **Unconstrained** | 0.65 | 11.8% (2/17) | 0.0% (0/15) | **53.6%** (75/140) | 2.6% | 3.7% | 2 / 3 |
| (No Aspect Filters) | 0.50 | 52.9% (9/17) | 0.0% (0/15) | **73.6%** (103/140) | 8.0% | 12.5% | 1 / 3 |
| | 0.30 | 64.7% (11/17) | 26.7% (4/15) | **84.3%** (118/140) | 11.3% | 18.2% | 1 / 3 |
| | 0.10 | 70.6% (12/17) | 40.0% (6/15) | **92.9%** (128/140) | 12.2% | 20.0% | 1 / 3 |

---

## 5. In-Depth Technical Insights

### 5.1 Re-examination of Aspect Ratio Filters (Task 3.1)
- **Phone Aspect Distribution**:
  - In the raw detections, phones exhibited aspect ratios ranging from $1.10$ to $4.35$.
  - Relaxing the lower bound to $1.15$ (as recommended in Phase 0) recovers 1 additional phone detection at conf $\ge 0.50$ (improving phone recall from 35.3% to 41.2%).
  - However, unlike in Phase 0 where relaxing to 1.15 produced 0 extra false positives, on the fine-tuned model relaxing the lower bound allows square-ish laptop webcam regions and smartwatch faces to register as phones (adding 3 false positives).
- **Book Aspect Distribution**:
  - Valid book detections have aspect ratios tightly bounded between $1.01$ and $1.83$ (median $1.53$).
  - Adding a book aspect ratio filter $[0.8, 2.5]$ successfully eliminates long, thin false detections (e.g. pens, cables, table edges misclassified as books).
  - It reduces book false alarms on negatives by 11 images at low thresholds (from 89 down to 78).
  - *Recommendation*: **Adopt a Book Aspect Ratio filter of $[0.8, 2.5]$** in future iterations.

### 5.2 Re-examination of Confidence Thresholds & The Pareto Breakdown (Task 3.2)
- **Confidence Calibration Dilemma**:
  - To achieve the Phase 2 book recall target ($\ge 40\%$), the confidence threshold must be dropped to **$0.10$**.
  - But at $\text{conf} = 0.10$, the model produces false alarms on **86.4% of non-prohibited desk objects** (121 out of 140 negative benchmark images trigger alarms!).
  - Even if the confidence threshold is raised to **$0.80$**, the false alarm rate remains unacceptably high at **25.0%** (35 out of 140 negative images alert).
  - The model does NOT have a calibrated decision threshold that simultaneously achieves high recall and low FPR:
    - Target recall ($\ge 50\%$ phone, $\ge 40\%$ book) $\implies$ $\text{FPR} \approx 86\% - 90\%$.
    - Target FPR ($\le 5\%$) $\implies$ $\text{Recall} = 0\%$.

### 5.3 Filter Ordering & Funnel Code Refactoring (Task 3.3)
Currently, in [`video_input_analysis.py`](file:///c:/Advait/projects/CEP/IntelliProctor/video_input_analysis.py#L202), confidence and class checks are combined:
```python
if cls_name not in TARGET_CLASSES or conf < CONF_THRESHOLD:
    continue
```
- In the Phase 3 sweep, evaluating per-class confidence thresholds proved that a single global `CONF_THRESHOLD` is flawed:
  - Phone and Book require different confidence operating points.
  - Future iterations should refactor `TARGET_CLASSES` to bundle per-class confidence thresholds:
```python
TARGET_CLASSES = {
    "cell phone": {"conf_threshold": 0.65, "aspect_range": (1.15, 2.9), "color": (0, 0, 255)},
    "book":       {"conf_threshold": 0.50, "aspect_range": (0.80, 2.5), "color": (0, 165, 255)},
}
```

---

## 6. Mathematical Confirmation: Why Post-Processing Cannot Solve Iteration 1

The Phase 3 sweep establishes mathematically that post-processing cannot compensate for the root deficiencies of the Training Iteration 1 model:
1. **Lack of Negative Supervision**: Because the training set contained 0 images of laptops, monitors, or tablets, the model's feature weights for `phone` and `book_notebook` overlap with standard electronics and rectangular objects.
2. **Confidence Degradation on Out-of-Domain Positives**: Because positive training data came from only 1 individual and 1 room, the model's confidence on external test images is depressed into the same low-confidence range ($0.15 - 0.55$) occupied by background clutter.

Therefore, adjusting thresholds merely trades off near-zero recall for near-total false alarms.

---

## 7. Deliverables Checklist & Status for Phase 3

| Phase 3 Deliverable | Recommendation & Finding | Status |
| :--- | :--- | :---: |
| **Aspect-ratio filter recommendation with evidence** | • Phone: Maintain $[1.15, 2.9]$<br>• Book: Introduce $[0.80, 2.50]$ (eliminates 11 false alarms) | ✅ **COMPLETE** |
| **Confidence threshold recommendation with evidence** | Retain production $\text{conf} = 0.65$ for current deployment. Do NOT lower threshold on Iteration 1 model (prevents 86%+ FPR explosion). | ✅ **COMPLETE** |
| **Decision on filter code refactoring** | Refactor `TARGET_CLASSES` to support per-class confidence thresholds in Phase 4 once a viable model is trained. | ✅ **COMPLETE** |
| **Production Integration Decision (Phase 4 Gate)** | **DO NOT DEPLOY ITERATION 1 MODEL TO PRODUCTION**. Rollback/maintain baseline YOLO11m in `video_input_analysis.py`. Proceed to dataset expansion for Training Iteration 2. | ✅ **DECISION FINALIZED** |

---

## 8. Summary of Phase Statuses

- **Phase 0 (Baseline & Fixes)**: ✅ COMPLETE
- **Phase 1 (Data Collection Iteration 1)**: ⚠️ INSUFFICIENT DIVERSITY (Need Iteration 2 Data)
- **Phase 2 (Fine-Tuning Experiment 1)**: ✅ EXPERIMENT COMPLETE, ❌ ACCEPTANCE CRITERIA FAILED
- **Phase 3 (Post-Processing Review)**: ✅ COMPLETE (All sweep analysis and recommendations documented)
- **Phase 4 (Production Integration)**: ⛔ **BLOCKED** on Training Iteration 2 passing Phase 2 exit criteria.
