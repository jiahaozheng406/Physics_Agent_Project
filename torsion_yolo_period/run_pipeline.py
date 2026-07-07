"""
run_pipeline.py
One-command pipeline: run YOLO-Seg inference + period estimation on one or
more torsion-pendulum videos and collect a summary report.

Usage:
    python run_pipeline.py \
        --weights weights/best.pt \
        --videos "data/videos/扭摆法测量实际演示.mp4" \
                 "data/videos/扭摆法测量实际演示2.mp4" \
        --output outputs

    # Process all mp4 files in a directory:
    python run_pipeline.py --weights weights/best.pt --video_dir data/videos --output outputs
"""
from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="[%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# ensure local modules are importable when run from repo root
sys.path.insert(0, str(Path(__file__).parent))


def run_all(
    weights: Path,
    video_paths: list[Path],
    output_dir: Path,
    conf: float = 0.25,
    iou: float = 0.45,
    min_mask_area: int = 50,
    write_video: bool = True,
    period_method: str = "zero_crossing",
    no_video: bool = False,
) -> None:
    from infer_video import infer_video

    if not weights.exists():
        logger.error("Weights file not found: %s", weights)
        sys.exit(1)

    summary = []
    for vp in video_paths:
        if not vp.exists():
            logger.warning("Video not found, skipping: %s", vp)
            continue

        logger.info("=" * 60)
        logger.info("Processing video: %s", vp.name)
        logger.info("=" * 60)

        result = infer_video(
            video_path=vp,
            weights_path=weights,
            output_dir=output_dir,
            conf_threshold=conf,
            iou_threshold=iou,
            min_mask_area=min_mask_area,
            write_video=not no_video,
            period_method=period_method,
        )
        summary.append(result)

    # write combined summary JSON
    summary_path = output_dir / "summary.json"
    output_dir.mkdir(parents=True, exist_ok=True)
    summary_path.write_text(
        json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    logger.info("Summary written: %s", summary_path)

    # print table
    print("\n" + "=" * 70)
    print(f"{'Video':<40} {'T_final (s)':>12} {'Method':<20}")
    print("-" * 70)
    for r in summary:
        if not r:
            continue
        name = Path(r.get("video", "")).name[:38]
        T = r.get("T_final")
        T_str = f"{T:.4f}" if T is not None else "FAILED"
        method = r.get("method_used", "-")
        print(f"{name:<40} {T_str:>12} {method:<20}")
    print("=" * 70)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Torsion pendulum YOLO-Seg period measurement pipeline"
    )
    parser.add_argument("--weights", required=True, help="YOLO-Seg weights (.pt)")
    parser.add_argument("--videos", nargs="+", default=[],
                        help="Video file paths (one or more)")
    parser.add_argument("--video_dir", default=None,
                        help="Directory of .mp4 files (alternative to --videos)")
    parser.add_argument("--output", default="outputs", help="Output root directory")
    parser.add_argument("--conf", type=float, default=0.25)
    parser.add_argument("--iou", type=float, default=0.45)
    parser.add_argument("--min_mask_area", type=int, default=50)
    parser.add_argument("--no_video", action="store_true",
                        help="Skip writing overlay video (faster)")
    parser.add_argument("--period_method", default="zero_crossing",
                        choices=["zero_crossing", "peak", "fit"])
    args = parser.parse_args()

    # collect video list
    video_paths: list[Path] = []
    for v in args.videos:
        video_paths.append(Path(v))
    if args.video_dir:
        vdir = Path(args.video_dir)
        if not vdir.is_dir():
            logger.error("--video_dir is not a directory: %s", vdir)
            sys.exit(1)
        video_paths.extend(sorted(vdir.glob("*.mp4")))

    if not video_paths:
        logger.error("No videos specified. Use --videos or --video_dir.")
        sys.exit(1)

    run_all(
        weights=Path(args.weights),
        video_paths=video_paths,
        output_dir=Path(args.output),
        conf=args.conf,
        iou=args.iou,
        min_mask_area=args.min_mask_area,
        write_video=not args.no_video,
        period_method=args.period_method,
    )


if __name__ == "__main__":
    main()
