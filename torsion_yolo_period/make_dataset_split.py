"""
make_dataset_split.py
Split annotated images+labels into train/val/test sets.

Expects:
    data/images_raw/<video_stem>/<frame>.jpg   (extracted frames)
    data/labels_raw/<video_stem>/<frame>.txt   (YOLO-Seg polygon labels)

Produces:
    data/images/train|val|test/<frame>.jpg
    data/labels/train|val|test/<frame>.txt

Each video's frames are stratified across splits to prevent single-source bias.

Usage:
    python make_dataset_split.py
    python make_dataset_split.py --images data/images_raw --labels data/labels_raw \
        --out_images data/images --out_labels data/labels --ratio 0.7 0.2 0.1
"""
from __future__ import annotations

import argparse
import logging
import random
import shutil
import sys
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="[%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


def split_video_frames(
    image_files: list[Path],
    label_dir: Path,
    out_img_dirs: dict[str, Path],
    out_lbl_dirs: dict[str, Path],
    ratio: tuple[float, float, float],
    seed: int = 42,
) -> dict[str, int]:
    """
    Shuffle and split one video's frames across train/val/test.
    Only copies frames that have a matching label file.
    """
    rng = random.Random(seed)

    # filter to labeled frames only
    labeled = [f for f in image_files if (label_dir / f.name).with_suffix(".txt").exists()]
    if not labeled:
        logger.warning("No labeled frames found in %s", label_dir)
        return {"train": 0, "val": 0, "test": 0}

    rng.shuffle(labeled)
    n = len(labeled)
    n_train = int(n * ratio[0])
    n_val = int(n * ratio[1])

    splits = {
        "train": labeled[:n_train],
        "val": labeled[n_train: n_train + n_val],
        "test": labeled[n_train + n_val:],
    }

    counts: dict[str, int] = {}
    for split_name, files in splits.items():
        for img_path in files:
            lbl_path = (label_dir / img_path.name).with_suffix(".txt")
            shutil.copy2(img_path, out_img_dirs[split_name] / img_path.name)
            shutil.copy2(lbl_path, out_lbl_dirs[split_name] / lbl_path.name)
        counts[split_name] = len(files)

    return counts


def main() -> None:
    parser = argparse.ArgumentParser(description="Split torsion dataset into train/val/test")
    parser.add_argument("--images", default="data/images_raw", help="Raw images directory (per-video subdirs)")
    parser.add_argument("--labels", default="data/labels_raw", help="Raw labels directory (per-video subdirs)")
    parser.add_argument("--out_images", default="data/images", help="Output images directory")
    parser.add_argument("--out_labels", default="data/labels", help="Output labels directory")
    parser.add_argument("--ratio", nargs=3, type=float, default=[0.7, 0.2, 0.1],
                        help="train/val/test split ratio (must sum to 1)")
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    ratio = tuple(args.ratio)
    if abs(sum(ratio) - 1.0) > 1e-6:
        logger.error("Ratios must sum to 1.0, got %.3f", sum(ratio))
        sys.exit(1)

    images_root = Path(args.images)
    labels_root = Path(args.labels)
    out_img_root = Path(args.out_images)
    out_lbl_root = Path(args.out_labels)

    splits = ["train", "val", "test"]
    out_img_dirs = {s: out_img_root / s for s in splits}
    out_lbl_dirs = {s: out_lbl_root / s for s in splits}
    for d in list(out_img_dirs.values()) + list(out_lbl_dirs.values()):
        d.mkdir(parents=True, exist_ok=True)

    # discover per-video subdirectories
    video_dirs = sorted(images_root.iterdir()) if images_root.is_dir() else []
    if not video_dirs:
        logger.error("No subdirectories found in %s", images_root)
        sys.exit(1)

    total: dict[str, int] = {"train": 0, "val": 0, "test": 0}
    for vdir in video_dirs:
        if not vdir.is_dir():
            continue
        ldir = labels_root / vdir.name
        image_files = sorted(vdir.glob("*.jpg")) + sorted(vdir.glob("*.png"))
        if not image_files:
            continue
        logger.info("Processing %s (%d images)...", vdir.name, len(image_files))
        counts = split_video_frames(
            image_files, ldir, out_img_dirs, out_lbl_dirs, ratio, seed=args.seed
        )
        for s in splits:
            total[s] += counts.get(s, 0)
        logger.info("  → train=%d  val=%d  test=%d", counts.get("train",0), counts.get("val",0), counts.get("test",0))

    logger.info("Dataset split complete: train=%d  val=%d  test=%d", total["train"], total["val"], total["test"])


if __name__ == "__main__":
    main()
