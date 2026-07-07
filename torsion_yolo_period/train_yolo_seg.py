"""
train_yolo_seg.py
Train a YOLO-Seg model on the torsion rod dataset.

Usage:
    python train_yolo_seg.py
    python train_yolo_seg.py --weights yolo11n-seg.pt --epochs 150 --device 0
    python train_yolo_seg.py --device cpu   # CPU-only (slow)
"""
from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="[%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


def main() -> None:
    parser = argparse.ArgumentParser(description="Train YOLO-Seg on torsion rod dataset")
    parser.add_argument("--weights", default="yolo11n-seg.pt",
                        help="Pretrained weights (yolo11n-seg.pt or yolov8n-seg.pt)")
    parser.add_argument("--data", default="data/torsion_rod_seg.yaml",
                        help="Dataset YAML path")
    parser.add_argument("--epochs", type=int, default=100)
    parser.add_argument("--imgsz", type=int, default=640)
    parser.add_argument("--batch", type=int, default=8)
    parser.add_argument("--device", default="0",
                        help="'0' for GPU 0, 'cpu' for CPU-only training")
    parser.add_argument("--project", default="runs/torsion_rod_seg")
    parser.add_argument("--name", default="yolo_seg_rod")
    args = parser.parse_args()

    try:
        from ultralytics import YOLO
    except ImportError:
        logger.error("ultralytics not installed: pip install ultralytics")
        sys.exit(1)

    data_yaml = Path(args.data)
    if not data_yaml.exists():
        logger.error("Dataset YAML not found: %s", data_yaml)
        sys.exit(1)

    logger.info("Loading base weights: %s", args.weights)
    model = YOLO(args.weights)

    logger.info(
        "Starting training — epochs=%d  imgsz=%d  batch=%d  device=%s",
        args.epochs, args.imgsz, args.batch, args.device
    )

    results = model.train(
        data=str(data_yaml),
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,
        device=args.device,
        project=args.project,
        name=args.name,
        # augmentation — tuned for rod detection (no heavy perspective warp)
        degrees=15.0,       # ±15° rotation
        translate=0.1,
        scale=0.3,
        shear=2.0,
        perspective=0.0,    # disabled — would distort rod geometry
        flipud=0.1,
        fliplr=0.5,
        mosaic=0.5,
        hsv_h=0.015,
        hsv_s=0.4,
        hsv_v=0.3,
        # NOTE: no "blur" augment arg exists in ultralytics' Albumentations
        # pipeline is used automatically (includes blur/noise) when installed.
    )

    best_weights = Path(args.project) / args.name / "weights" / "best.pt"
    if best_weights.exists():
        logger.info("Training complete. Best weights: %s", best_weights)
    else:
        logger.info("Training complete. Results: %s", results)


if __name__ == "__main__":
    main()
