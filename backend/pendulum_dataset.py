from __future__ import annotations

import argparse
import csv
import math
import random
import shutil
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter


@dataclass(frozen=True)
class PendulumRenderParams:
    width: int
    height: int
    pivot_x: float
    pivot_y: float
    length_px: float
    bob_radius: float
    amplitude_rad: float
    phase_rad: float
    period_s: float
    damping: float
    line_color: tuple[int, int, int]
    bob_color: tuple[int, int, int]
    bg_color: tuple[int, int, int]


def generate_dataset(
    output_dir: Path,
    *,
    samples: int = 2400,
    val_ratio: float = 0.18,
    seed: int = 42,
    width: int = 640,
    height: int = 480,
) -> None:
    rng = random.Random(seed)
    output_dir = output_dir.resolve()
    if output_dir.exists():
        shutil.rmtree(output_dir)

    image_train = output_dir / "images" / "train"
    image_val = output_dir / "images" / "val"
    label_train = output_dir / "labels" / "train"
    label_val = output_dir / "labels" / "val"
    for folder in (image_train, image_val, label_train, label_val):
        folder.mkdir(parents=True, exist_ok=True)

    manifest_rows: list[dict[str, str]] = []
    val_count = int(samples * max(0.0, min(0.5, val_ratio)))
    val_indices = set(rng.sample(range(samples), val_count)) if val_count else set()

    for index in range(samples):
        params = random_params(rng, width=width, height=height)
        t = rng.uniform(0.0, params.period_s * rng.uniform(1.5, 4.5))
        frame, bbox = render_frame(params, t, rng=rng)
        split = "val" if index in val_indices else "train"
        stem = f"pendulum_{index:06d}"
        image_path = (image_val if split == "val" else image_train) / f"{stem}.jpg"
        label_path = (label_val if split == "val" else label_train) / f"{stem}.txt"
        frame.save(image_path, format="JPEG", quality=rng.randint(82, 96), optimize=True)
        label_path.write_text(format_yolo_label(bbox, width=params.width, height=params.height), encoding="utf-8")
        manifest_rows.append(
            {
                "image": str(image_path.relative_to(output_dir)).replace("\\", "/"),
                "split": split,
                "period_s": f"{params.period_s:.6f}",
                "length_px": f"{params.length_px:.3f}",
                "amplitude_rad": f"{params.amplitude_rad:.6f}",
                "bob_radius_px": f"{params.bob_radius:.3f}",
                "time_s": f"{t:.6f}",
            }
        )

    write_data_yaml(output_dir)
    write_manifest(output_dir / "manifest.csv", manifest_rows)
    write_training_hint(output_dir / "README_train_yolov5.txt")


def random_params(rng: random.Random, *, width: int, height: int) -> PendulumRenderParams:
    pivot_x = width * rng.uniform(0.34, 0.66)
    pivot_y = height * rng.uniform(0.08, 0.20)
    max_length = min(height - pivot_y - 42, width * 0.44)
    length_px = rng.uniform(max_length * 0.62, max_length)
    bob_radius = rng.uniform(10, 28)
    amplitude_rad = rng.uniform(0.08, 0.52)
    phase_rad = rng.uniform(0, math.tau)
    period_s = rng.uniform(1.15, 3.4)
    damping = rng.uniform(0.0, 0.035)
    line_shade = rng.randint(38, 150)
    bg_base = rng.randint(22, 244)
    bob_color = (
        rng.randint(25, 235),
        rng.randint(25, 235),
        rng.randint(25, 235),
    )
    return PendulumRenderParams(
        width=width,
        height=height,
        pivot_x=pivot_x,
        pivot_y=pivot_y,
        length_px=length_px,
        bob_radius=bob_radius,
        amplitude_rad=amplitude_rad,
        phase_rad=phase_rad,
        period_s=period_s,
        damping=damping,
        line_color=(line_shade, line_shade, line_shade),
        bob_color=bob_color,
        bg_color=(
            max(0, min(255, bg_base + rng.randint(-18, 18))),
            max(0, min(255, bg_base + rng.randint(-18, 18))),
            max(0, min(255, bg_base + rng.randint(-18, 18))),
        ),
    )


def render_frame(params: PendulumRenderParams, t: float, *, rng: random.Random):
    frame = Image.new("RGB", (params.width, params.height), params.bg_color)
    frame = add_background_variation(frame, rng=rng)
    add_lab_distractors(frame, rng=rng)

    theta = params.amplitude_rad * math.exp(-params.damping * t) * math.sin(math.tau * t / params.period_s + params.phase_rad)
    bob_x = params.pivot_x + params.length_px * math.sin(theta)
    bob_y = params.pivot_y + params.length_px * math.cos(theta)

    draw = ImageDraw.Draw(frame)
    line_width = rng.randint(1, 3)
    draw.line(
        [(params.pivot_x, params.pivot_y), (bob_x, bob_y)],
        fill=params.line_color,
        width=line_width,
    )
    pivot_radius = rng.randint(3, 6)
    draw.ellipse(
        [
            params.pivot_x - pivot_radius,
            params.pivot_y - pivot_radius,
            params.pivot_x + pivot_radius,
            params.pivot_y + pivot_radius,
        ],
        fill=params.line_color,
    )
    draw.ellipse(
        [
            bob_x - params.bob_radius,
            bob_y - params.bob_radius,
            bob_x + params.bob_radius,
            bob_y + params.bob_radius,
        ],
        fill=params.bob_color,
    )
    highlight = tuple(min(255, channel + rng.randint(20, 60)) for channel in params.bob_color)
    highlight_radius = max(2, params.bob_radius * 0.22)
    highlight_x = bob_x - params.bob_radius * 0.28
    highlight_y = bob_y - params.bob_radius * 0.32
    draw.ellipse(
        [
            highlight_x - highlight_radius,
            highlight_y - highlight_radius,
            highlight_x + highlight_radius,
            highlight_y + highlight_radius,
        ],
        fill=highlight,
    )
    frame = apply_camera_effects(frame, rng=rng, fill_color=params.bg_color)

    x1 = max(0.0, bob_x - params.bob_radius * 1.18)
    y1 = max(0.0, bob_y - params.bob_radius * 1.18)
    x2 = min(float(params.width - 1), bob_x + params.bob_radius * 1.18)
    y2 = min(float(params.height - 1), bob_y + params.bob_radius * 1.18)
    return frame, (x1, y1, x2, y2)


def add_background_variation(frame: Image.Image, *, rng: random.Random) -> Image.Image:
    width, height = frame.size
    if rng.random() < 0.75:
        noise = Image.effect_noise((width, height), rng.uniform(8, 32)).convert("RGB")
        frame = Image.blend(frame, noise, rng.uniform(0.018, 0.055))
    draw = ImageDraw.Draw(frame)
    base = frame.getpixel((0, 0))
    for _ in range(rng.randint(0, 8)):
        color = tuple(int(max(0, min(255, base[channel] + rng.randint(-42, 42)))) for channel in range(3))
        p1 = (rng.randint(0, width - 1), rng.randint(0, height - 1))
        p2 = (rng.randint(0, width - 1), rng.randint(0, height - 1))
        draw.line([p1, p2], fill=color, width=rng.randint(1, 3))
    return frame


def add_lab_distractors(frame: Image.Image, *, rng: random.Random) -> None:
    width, height = frame.size
    draw = ImageDraw.Draw(frame)

    # Pendulum videos often contain rods, bases, clamps, and static orange objects.
    # These are deliberately left unlabeled so YOLO learns they are not pendulum_bob.
    if rng.random() < 0.72:
        rod_x = rng.randint(int(width * 0.52), int(width * 0.92))
        rod_y1 = rng.randint(int(height * 0.22), int(height * 0.56))
        rod_y2 = rng.randint(int(height * 0.70), int(height * 0.96))
        shade = rng.randint(75, 180)
        draw.line([(rod_x, rod_y1), (rod_x, rod_y2)], fill=(shade, shade, shade), width=rng.randint(2, 5))

    if rng.random() < 0.62:
        block_w = rng.randint(14, 36)
        block_h = rng.randint(18, 54)
        x = rng.randint(int(width * 0.55), int(width * 0.90))
        y = rng.randint(int(height * 0.58), int(height * 0.88))
        color = (
            rng.randint(160, 238),
            rng.randint(70, 150),
            rng.randint(35, 95),
        )
        draw.rounded_rectangle([x, y, x + block_w, y + block_h], radius=4, fill=color)

    if rng.random() < 0.54:
        base_x = rng.randint(int(width * 0.05), int(width * 0.42))
        base_y = rng.randint(int(height * 0.72), int(height * 0.94))
        base_w = rng.randint(48, 110)
        base_h = rng.randint(8, 22)
        draw.rounded_rectangle(
            [base_x, base_y, base_x + base_w, base_y + base_h],
            radius=5,
            fill=(rng.randint(25, 75), rng.randint(55, 115), rng.randint(120, 205)),
        )

    if rng.random() < 0.38:
        # A static false bob: visually similar, but not connected to the pendulum string.
        radius = rng.randint(7, 20)
        x = rng.randint(int(width * 0.08), int(width * 0.92))
        y = rng.randint(int(height * 0.34), int(height * 0.90))
        color = (rng.randint(150, 240), rng.randint(55, 135), rng.randint(35, 110))
        draw.ellipse([x - radius, y - radius, x + radius, y + radius], fill=color)


def apply_camera_effects(frame: Image.Image, *, rng: random.Random, fill_color: tuple[int, int, int]) -> Image.Image:
    if rng.random() < 0.42:
        frame = frame.filter(ImageFilter.GaussianBlur(radius=rng.uniform(0.35, 1.15)))
    if rng.random() < 0.25:
        frame = ImageEnhance.Brightness(frame).enhance(rng.uniform(0.78, 1.22))
        frame = ImageEnhance.Contrast(frame).enhance(rng.uniform(0.82, 1.18))
    if rng.random() < 0.18:
        frame = frame.rotate(
            rng.uniform(-4, 4),
            resample=Image.Resampling.BICUBIC,
            expand=False,
            fillcolor=fill_color,
        )
    return frame


def format_yolo_label(bbox: tuple[float, float, float, float], *, width: int, height: int) -> str:
    x1, y1, x2, y2 = bbox
    cx = ((x1 + x2) * 0.5) / width
    cy = ((y1 + y2) * 0.5) / height
    box_w = (x2 - x1) / width
    box_h = (y2 - y1) / height
    return f"0 {cx:.8f} {cy:.8f} {box_w:.8f} {box_h:.8f}\n"


def write_data_yaml(output_dir: Path) -> None:
    yaml_text = "\n".join(
        [
            f"path: {output_dir.as_posix()}",
            "train: images/train",
            "val: images/val",
            "names:",
            "  0: pendulum_bob",
            "",
        ]
    )
    (output_dir / "data.yaml").write_text(yaml_text, encoding="utf-8")


def write_manifest(path: Path, rows: list[dict[str, str]]) -> None:
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=["image", "split", "period_s", "length_px", "amplitude_rad", "bob_radius_px", "time_s"],
        )
        writer.writeheader()
        writer.writerows(rows)


def write_training_hint(path: Path) -> None:
    path.write_text(
        "\n".join(
            [
                "YOLOv5 pendulum_bob MVP training:",
                "1. Generate this dataset with python -m backend.pendulum_dataset --output data/pendulum_yolo --samples 3000",
                "2. Train with a local YOLOv5 repo:",
                "   python train.py --img 640 --batch 8 --epochs 80 --workers 0 --data D:\\Physics_Agent_Project\\data\\pendulum_yolo\\data.yaml --weights yolov5s.pt --name pendulum_bob_mvp",
                "   On Windows CPU training, --workers 0 avoids torch shared-memory mapping errors such as error code 1455.",
                "3. Configure runtime weights:",
                "   set PHYSICS_AGENT_PENDULUM_YOLO_WEIGHTS=runs/train/pendulum_bob_mvp/weights/best.pt",
                "   set PHYSICS_AGENT_YOLOV5_REPO=D:\\path\\to\\yolov5",
                "",
            ]
        ),
        encoding="utf-8",
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate synthetic YOLO pendulum bob detection data.")
    parser.add_argument("--output", type=Path, default=Path("data/pendulum_yolo"))
    parser.add_argument("--samples", type=int, default=2400)
    parser.add_argument("--val-ratio", type=float, default=0.18)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--width", type=int, default=640)
    parser.add_argument("--height", type=int, default=480)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    generate_dataset(
        args.output,
        samples=max(1, args.samples),
        val_ratio=args.val_ratio,
        seed=args.seed,
        width=max(160, args.width),
        height=max(160, args.height),
    )
    print(f"Synthetic pendulum YOLO dataset written to {args.output.resolve()}")


if __name__ == "__main__":
    main()
