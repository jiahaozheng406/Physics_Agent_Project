from __future__ import annotations

import argparse
import csv
import math
import random
import shutil
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


def generate_dataset(
    output: Path,
    *,
    samples: int = 3000,
    image_size: int = 640,
    val_ratio: float = 0.18,
    seed: int = 20260706,
    overwrite: bool = False,
) -> None:
    """Generate a synthetic YOLOv5 dataset for torsion rod detection."""
    rng = random.Random(seed)
    if output.exists() and overwrite:
        shutil.rmtree(output)
    for split in ("train", "val"):
        (output / "images" / split).mkdir(parents=True, exist_ok=True)
        (output / "labels" / split).mkdir(parents=True, exist_ok=True)

    manifest_rows: list[dict[str, str | float | int]] = []
    val_count = int(samples * val_ratio)
    for index in range(samples):
        split = "val" if index < val_count else "train"
        stem = f"torsion_{index:06d}"
        image, label, meta = _render_sample(rng, image_size=image_size)
        image_path = output / "images" / split / f"{stem}.jpg"
        label_path = output / "labels" / split / f"{stem}.txt"
        image.save(image_path, quality=92)
        label_path.write_text(label + "\n", encoding="utf-8")
        manifest_rows.append({"split": split, "file": stem, **meta})

    (output / "data.yaml").write_text(
        "\n".join(
            [
                f"path: {output.resolve().as_posix()}",
                "train: images/train",
                "val: images/val",
                "names:",
                "  0: torsion_rod",
                "",
            ]
        ),
        encoding="utf-8",
    )
    with (output / "manifest.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=["split", "file", "angle_deg", "length_px", "width_px", "bbox_cx", "bbox_cy", "bbox_w", "bbox_h"])
        writer.writeheader()
        writer.writerows(manifest_rows)
    (output / "README_train_yolov5.txt").write_text(
        "\n".join(
            [
                "YOLOv5 torsion_rod MVP training:",
                "1. Generate data:",
                "   python -m backend.torsion_dataset --output data/torsion_yolo --samples 3000",
                "2. Train in YOLOv5 repo:",
                "   cd D:\\yolov5",
                "   python train.py --img 640 --batch 16 --epochs 80 --workers 0 --device 0 --data D:\\Physics_Agent_Project\\data\\torsion_yolo\\data.yaml --weights yolov5s.pt --name torsion_rod_mvp",
                "3. Use the trained weights:",
                "   set PHYSICS_AGENT_TORSION_YOLO_WEIGHTS=D:\\yolov5\\runs\\train\\torsion_rod_mvp\\weights\\best.pt",
                "   set PHYSICS_AGENT_TORSION_YOLO_CLASSES=torsion_rod",
                "",
                "The backend uses YOLO only to locate the rod ROI; the rod angle is fitted inside the box.",
            ]
        ),
        encoding="utf-8",
    )


def _render_sample(rng: random.Random, *, image_size: int) -> tuple[Image.Image, str, dict[str, float]]:
    image = Image.new("RGB", (image_size, image_size), _rand_bg(rng))
    draw = ImageDraw.Draw(image, "RGBA")
    _draw_background(draw, rng, image_size)

    cx = rng.uniform(image_size * 0.34, image_size * 0.66)
    cy = rng.uniform(image_size * 0.34, image_size * 0.66)
    length = rng.uniform(image_size * 0.36, image_size * 0.72)
    width = rng.uniform(image_size * 0.025, image_size * 0.07)
    angle = rng.uniform(-math.pi * 0.88, math.pi * 0.88)
    rod_color = rng.choice([(28, 76, 88, 255), (46, 91, 96, 255), (35, 63, 74, 255), (70, 82, 96, 255)])
    points = _rotated_rect(cx, cy, length, width, angle)
    draw.polygon(points, fill=rod_color)
    draw.line([points[0], points[1], points[2], points[3], points[0]], fill=(230, 245, 245, 55), width=2)

    for sign in (-1, 1):
        ex = cx + math.cos(angle) * length * 0.43 * sign
        ey = cy + math.sin(angle) * length * 0.43 * sign
        radius = width * rng.uniform(0.9, 1.5)
        marker_color = rng.choice([(40, 190, 162, 230), (230, 98, 88, 220), (242, 174, 78, 220)])
        draw.ellipse((ex - radius, ey - radius, ex + radius, ey + radius), fill=marker_color)

    if rng.random() < 0.7:
        pr = width * rng.uniform(1.0, 2.0)
        draw.ellipse((cx - pr, cy - pr, cx + pr, cy + pr), fill=(20, 35, 48, 210))

    if rng.random() < 0.55:
        image = image.filter(ImageFilter.GaussianBlur(radius=rng.uniform(0.2, 1.1)))

    xs = [point[0] for point in points]
    ys = [point[1] for point in points]
    x_min = max(0.0, min(xs) - width * 1.8)
    x_max = min(float(image_size), max(xs) + width * 1.8)
    y_min = max(0.0, min(ys) - width * 1.8)
    y_max = min(float(image_size), max(ys) + width * 1.8)
    bbox_cx = (x_min + x_max) / 2 / image_size
    bbox_cy = (y_min + y_max) / 2 / image_size
    bbox_w = (x_max - x_min) / image_size
    bbox_h = (y_max - y_min) / image_size
    label = f"0 {bbox_cx:.6f} {bbox_cy:.6f} {bbox_w:.6f} {bbox_h:.6f}"
    meta = {
        "angle_deg": round(math.degrees(angle), 4),
        "length_px": round(length, 3),
        "width_px": round(width, 3),
        "bbox_cx": round(bbox_cx, 6),
        "bbox_cy": round(bbox_cy, 6),
        "bbox_w": round(bbox_w, 6),
        "bbox_h": round(bbox_h, 6),
    }
    return image, label, meta


def _rotated_rect(cx: float, cy: float, length: float, width: float, angle: float) -> list[tuple[float, float]]:
    ux, uy = math.cos(angle), math.sin(angle)
    vx, vy = -uy, ux
    return [
        (cx - ux * length / 2 - vx * width / 2, cy - uy * length / 2 - vy * width / 2),
        (cx + ux * length / 2 - vx * width / 2, cy + uy * length / 2 - vy * width / 2),
        (cx + ux * length / 2 + vx * width / 2, cy + uy * length / 2 + vy * width / 2),
        (cx - ux * length / 2 + vx * width / 2, cy - uy * length / 2 + vy * width / 2),
    ]


def _rand_bg(rng: random.Random) -> tuple[int, int, int]:
    base = rng.randint(226, 250)
    return base, min(255, base + rng.randint(-5, 5)), min(255, base + rng.randint(-8, 8))


def _draw_background(draw: ImageDraw.ImageDraw, rng: random.Random, image_size: int) -> None:
    for _ in range(rng.randint(3, 9)):
        x1 = rng.uniform(0, image_size)
        y1 = rng.uniform(0, image_size)
        x2 = x1 + rng.uniform(-image_size * 0.3, image_size * 0.3)
        y2 = y1 + rng.uniform(-image_size * 0.3, image_size * 0.3)
        color = (rng.randint(120, 190), rng.randint(130, 200), rng.randint(140, 210), rng.randint(20, 70))
        draw.line((x1, y1, x2, y2), fill=color, width=rng.randint(1, 5))
    if rng.random() < 0.6:
        x = rng.uniform(image_size * 0.15, image_size * 0.85)
        draw.line((x, 0, x, image_size), fill=(80, 90, 105, 38), width=rng.randint(2, 7))


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate synthetic YOLO torsion rod detection data.")
    parser.add_argument("--output", type=Path, default=Path("data/torsion_yolo"))
    parser.add_argument("--samples", type=int, default=3000)
    parser.add_argument("--image-size", type=int, default=640)
    parser.add_argument("--val-ratio", type=float, default=0.18)
    parser.add_argument("--seed", type=int, default=20260706)
    parser.add_argument("--overwrite", action="store_true")
    args = parser.parse_args()
    generate_dataset(
        output=args.output,
        samples=args.samples,
        image_size=args.image_size,
        val_ratio=args.val_ratio,
        seed=args.seed,
        overwrite=args.overwrite,
    )
    print(f"Synthetic torsion YOLO dataset written to {args.output.resolve()}")


if __name__ == "__main__":
    main()
