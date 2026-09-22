"""
Automated collector for negative test images in Phase 0B of IntelliProctor.

Downloads open/public-domain images from Wikimedia Commons for negative test categories:
- laptop (20)
- tablet (20)
- smartwatch (15)
- calculator (15)
- notebook (15)
- headphones (15)
- water_bottle (10)
- pen (10)
- other (20)

Saves decoded, standardized images into tests/test_data/<category>/.
"""

import os
import sys
import json
import time
import urllib.request
import urllib.parse
import cv2
import numpy as np

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEST_DATA_DIR = os.path.join(BASE_DIR, "tests", "test_data")

CATEGORY_REQUIREMENTS = {
    "laptop": {
        "target_count": 20,
        "queries": [
            "laptop computer on desk",
            "working on laptop office",
            "student laptop classroom desk",
            "laptop open desk monitor",
        ],
    },
    "tablet": {
        "target_count": 20,
        "queries": [
            "tablet computer desk",
            "person using tablet pc",
            "ipad desk hands",
            "digital tablet on table",
        ],
    },
    "smartwatch": {
        "target_count": 15,
        "queries": [
            "smartwatch wrist watch",
            "wearing smartwatch wrist",
            "digital smartwatch arm",
            "apple watch wrist",
        ],
    },
    "calculator": {
        "target_count": 15,
        "queries": [
            "pocket calculator on desk",
            "scientific calculator desk",
            "electronic calculator table",
            "using calculator math",
        ],
    },
    "notebook": {
        "target_count": 15,
        "queries": [
            "spiral notebook on desk",
            "writing in notebook desk",
            "open paper notepad desk",
            "blank notebook and pen",
        ],
    },
    "headphones": {
        "target_count": 15,
        "queries": [
            "person wearing headphones computer",
            "headphones on desk",
            "over-ear headphones audio",
            "earphones on office desk",
        ],
    },
    "water_bottle": {
        "target_count": 10,
        "queries": [
            "water bottle on desk",
            "reusable water bottle office",
            "plastic water bottle table",
            "drink bottle desk",
        ],
    },
    "pen": {
        "target_count": 10,
        "queries": [
            "ballpoint pen on desk",
            "hand holding pen writing",
            "pen and paper on table",
            "fountain pen desk",
        ],
    },
    "other": {
        "target_count": 20,
        "queries": [
            "empty office desk computer",
            "empty classroom desk",
            "person sitting at desk webcam",
            "clean office workstation desk",
        ],
    },
}

USER_AGENT = "IntelliProctorDatasetCollector/1.0 (academic-proctoring-research; contact@intelliproctor.local)"


def search_wikimedia_images(query: str, limit: int = 30):
    params = {
        "action": "query",
        "format": "json",
        "generator": "search",
        "gsrnamespace": "6",
        "gsrsearch": f"{query} filetype:bitmap",
        "gsrlimit": str(limit),
        "prop": "imageinfo",
        "iiprop": "url|mime|size|thumburl",
        "iiurlwidth": "1280",
    }
    url = "https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            pages = data.get("query", {}).get("pages", {})
            results = []
            for pid, pdata in pages.items():
                infos = pdata.get("imageinfo", [])
                if infos:
                    info = infos[0]
                    mime = info.get("mime", "")
                    if mime in ["image/jpeg", "image/png", "image/webp"]:
                        # Prefer thumburl (1280px wide) or fallback to full url
                        img_url = info.get("thumburl") or info.get("url")
                        results.append({
                            "title": pdata.get("title", ""),
                            "url": img_url,
                            "mime": mime,
                        })
            return results
    except Exception as e:
        print(f"Error querying Wikimedia for '{query}': {e}")
        return []


def download_image_as_bgr(img_url: str):
    req = urllib.request.Request(img_url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            raw_bytes = resp.read()
            arr = np.frombuffer(raw_bytes, dtype=np.uint8)
            img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
            return img
    except Exception as e:
        return None


def collect_category(category: str, config: dict):
    target_count = config["target_count"]
    queries = config["queries"]
    cat_dir = os.path.join(TEST_DATA_DIR, category)
    os.makedirs(cat_dir, exist_ok=True)

    # Check existing images
    existing_files = [f for f in os.listdir(cat_dir) if f.lower().endswith((".jpg", ".jpeg", ".png", ".webp"))]
    print(f"[{category.upper()}] Starting collection. Target: {target_count}. Existing: {len(existing_files)}")
    
    current_count = len(existing_files)
    if current_count >= target_count:
        print(f"[{category.upper()}] Already satisfied ({current_count} >= {target_count}).")
        return current_count

    seen_urls = set()
    idx = current_count + 1

    for q in queries:
        if current_count >= target_count:
            break
        print(f"  Searching '{q}'...")
        results = search_wikimedia_images(q, limit=25)
        for res in results:
            if current_count >= target_count:
                break
            u = res["url"]
            if not u or u in seen_urls:
                continue
            seen_urls.add(u)

            img = download_image_as_bgr(u)
            if img is None:
                continue

            h, w = img.shape[:2]
            if min(h, w) < 200:  # Skip tiny thumbnails/icons
                continue

            # Resize if very large (e.g. > 1920)
            max_dim = max(h, w)
            if max_dim > 1920:
                scale = 1920.0 / max_dim
                img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)

            filename = f"{category}_{idx:03d}.jpg"
            save_path = os.path.join(cat_dir, filename)
            success = cv2.imwrite(save_path, img, [cv2.IMWRITE_JPEG_QUALITY, 90])
            if success and os.path.exists(save_path) and os.path.getsize(save_path) > 1000:
                print(f"    Saved: {filename} ({img.shape[1]}x{img.shape[0]})")
                idx += 1
                current_count += 1
            time.sleep(0.1)  # Respect rate limits

    print(f"[{category.upper()}] Completed: {current_count}/{target_count} images.")
    return current_count


def main():
    print("=" * 70)
    print(" INTELLIPROCTOR PHASE 0B: NEGATIVE TEST DATASET COLLECTION")
    print("=" * 70)
    totals = {}
    for cat, cfg in CATEGORY_REQUIREMENTS.items():
        count = collect_category(cat, cfg)
        totals[cat] = count
    
    print("\n" + "=" * 70)
    print(" COLLECTION SUMMARY:")
    for cat, count in totals.items():
        req = CATEGORY_REQUIREMENTS[cat]["target_count"]
        status = "OK" if count >= req else "SHORT"
        print(f"  {cat:<15}: {count:3d} / {req:2d} images [{status}]")
    print(f"  TOTAL NEGATIVES: {sum(totals.values())} images")
    print("=" * 70)


if __name__ == "__main__":
    main()
