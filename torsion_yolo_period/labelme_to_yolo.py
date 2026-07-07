"""
labelme_to_yolo.py
Convert Labelme polygon annotations (.json) into YOLO-Seg polygon labels (.txt).

Expects a directory layout like:
    data/images_raw/<video_stem>/<frame>.jpg
    data/images_raw/<video_stem>/<frame>.json   (Labelme output, same folder)

Produces:
    data/labels_raw/<video_stem>/<frame>.txt    (YOLO-Seg polygon format)

Only shapes labeled "rod" are converted; any other label name is skipped with
a warning (so accidental base/disk/table annotations don't leak into the
training set). Supports polygon, linestrip, rectangle, and oriented_rectangle
shape types (Labelme's rotated-box tool is a natural fit for a thin rod).

Usage:
    python labelme_to_yolo.py --json_root data/images_raw --out_root data/labels_raw
    python labelme_to_yolo.py --json_root data/images_raw/扭摆法测量实际演示 \
        --out_root data/labels_raw/扭摆法测量实际演示
"""
from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="[%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


def convert_one(json_path: Path, out_dir: Path, label_name: str = "rod") -> bool:
    """
    Convert a single Labelme json file to a YOLO-Seg polygon txt.

    Returns True if a label file was written (i.e. at least one matching
    polygon was found), False otherwise.
    """
    try:
        data = json.loads(json_path.read_text(encoding="utf-8"))
    except Exception as e:
        logger.warning("Failed to parse %s: %s", json_path, e)
        return False

    img_w = data.get("imageWidth")
    img_h = data.get("imageHeight")
    if not img_w or not img_h:
        logger.warning("Missing imageWidth/imageHeight in %s, skipping", json_path)
        return False

    lines: list[str] = []
    for shape in data.get("shapes", []):
        label = shape.get("label", "")
        if label != label_name:
            if label:
                logger.debug("Skipping shape with label %r (only %r kept)", label, label_name)
            continue

        shape_type = shape.get("shape_type", "polygon")
        points = shape.get("points", [])

        if shape_type == "rectangle" and len(points) == 2:
            # axis-aligned rectangle: labelme stores only two corners
            (x0, y0), (x1, y1) = points
            points = [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]

        # "oriented_rectangle" (labelme >=6) already stores 4 corner points,
        # so it can be treated as a polygon directly — this is the natural
        # tool for a long thin rod.
        if shape_type not in ("polygon", "linestrip", "oriented_rectangle", "rectangle") or len(points) < 3:
            logger.warning(
                "Shape in %s has type=%s with %d points, need polygon>=3 points, skipping",
                json_path, shape_type, len(points),
            )
            continue

        coords = []
        for x, y in points:
            nx = min(max(x / img_w, 0.0), 1.0)
            ny = min(max(y / img_h, 0.0), 1.0)
            coords.append(f"{nx:.6f}")
            coords.append(f"{ny:.6f}")

        lines.append("0 " + " ".join(coords))

    if not lines:
        return False

    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / (json_path.stem + ".txt")
    out_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return True


def convert_directory(json_dir: Path, out_dir: Path, label_name: str = "rod") -> tuple[int, int]:
    """Convert all .json files in one directory. Returns (converted, skipped)."""
    json_files = sorted(json_dir.glob("*.json"))
    converted = 0
    skipped = 0
    for jf in json_files:
        if convert_one(jf, out_dir, label_name=label_name):
            converted += 1
        else:
            skipped += 1
    return converted, skipped


def main() -> None:
    parser = argparse.ArgumentParser(description="Convert Labelme json to YOLO-Seg polygon txt")
    parser.add_argument(
        "--json_root", required=True,
        help="Directory of Labelme jsons, or a root containing per-video subdirectories",
    )
    parser.add_argument(
        "--out_root", required=True,
        help="Output root for YOLO-Seg txt labels (mirrors json_root's subdirectory structure)",
    )
    parser.add_argument("--label", default="rod", help="Label name to keep (default: rod)")
    args = parser.parse_args()

    json_root = Path(args.json_root)
    out_root = Path(args.out_root)

    if not json_root.is_dir():
        logger.error("--json_root is not a directory: %s", json_root)
        sys.exit(1)

    # if json_root itself contains .json files, treat it as a single video directory
    direct_jsons = list(json_root.glob("*.json"))
    if direct_jsons:
        converted, skipped = convert_directory(json_root, out_root, label_name=args.label)
        logger.info("%s: converted=%d skipped=%d", json_root.name, converted, skipped)
        return

    # otherwise, iterate per-video subdirectories
    subdirs = sorted(d for d in json_root.iterdir() if d.is_dir())
    if not subdirs:
        logger.error("No .json files or subdirectories found in %s", json_root)
        sys.exit(1)

    total_converted = 0
    total_skipped = 0
    for vdir in subdirs:
        out_dir = out_root / vdir.name
        converted, skipped = convert_directory(vdir, out_dir, label_name=args.label)
        logger.info("%s: converted=%d skipped=%d", vdir.name, converted, skipped)
        total_converted += converted
        total_skipped += skipped

    logger.info("Total: converted=%d skipped=%d", total_converted, total_skipped)


if __name__ == "__main__":
    main()
