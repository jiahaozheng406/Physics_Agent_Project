"""
extract_frames.py
Extract frames from torsion-pendulum videos for YOLO-Seg dataset construction.

Usage:
    python extract_frames.py --videos data/videos --interval 5 --out data/images_raw
    python extract_frames.py --videos data/videos --interval 10 --out data/images_raw --min_frames 100
"""
from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="[%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


def extract_frames(
    video_path: Path,
    out_dir: Path,
    interval: int = 5,
    min_frames: int = 100,
) -> int:
    """
    Extract every `interval`-th frame from a video into `out_dir`.

    Returns the number of frames saved.
    """
    try:
        import cv2
    except ImportError:
        logger.error("opencv-python is required: pip install opencv-python")
        sys.exit(1)

    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        logger.error("Cannot open video: %s", video_path)
        return 0

    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = cap.get(cv2.CAP_PROP_FPS)
    logger.info("  %s — %d frames @ %.1f fps", video_path.name, total_frames, fps)

    # auto-reduce interval if video is short
    effective_interval = interval
    if total_frames // interval < min_frames and total_frames >= min_frames:
        effective_interval = max(1, total_frames // min_frames)
        logger.info("  Auto-reduced interval to %d to reach %d frames", effective_interval, min_frames)

    stem = video_path.stem
    out_dir.mkdir(parents=True, exist_ok=True)

    saved = 0
    frame_id = 0
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        if frame_id % effective_interval == 0:
            fname = out_dir / f"{stem}_{frame_id:06d}.jpg"
            _imwrite_unicode(fname, frame)
            saved += 1
        frame_id += 1

    cap.release()
    logger.info("  Saved %d frames → %s", saved, out_dir)
    return saved


def _imwrite_unicode(path: Path, frame) -> None:
    """
    cv2.imwrite silently mishandles non-ASCII (e.g. Chinese) Windows paths:
    it reports success but writes to a mangled path or not at all. Encode
    to a buffer with cv2.imencode and write the bytes ourselves instead.
    """
    import cv2

    ok, buf = cv2.imencode(path.suffix, frame)
    if not ok:
        raise IOError(f"cv2.imencode failed for {path}")
    path.write_bytes(buf.tobytes())


def main() -> None:
    parser = argparse.ArgumentParser(description="Extract frames from torsion videos")
    parser.add_argument(
        "--videos", required=True,
        help="Directory containing .mp4 files, or path to a single video"
    )
    parser.add_argument("--interval", type=int, default=5, help="Sample every N-th frame")
    parser.add_argument("--out", default="data/images_raw", help="Output directory for frames")
    parser.add_argument("--min_frames", type=int, default=100, help="Minimum frames per video")
    args = parser.parse_args()

    videos_path = Path(args.videos)
    out_base = Path(args.out)

    if videos_path.is_file():
        video_files = [videos_path]
    elif videos_path.is_dir():
        video_files = sorted(videos_path.glob("*.mp4"))
    else:
        logger.error("--videos must be a file or directory: %s", videos_path)
        sys.exit(1)

    if not video_files:
        logger.error("No .mp4 files found in %s", videos_path)
        sys.exit(1)

    total = 0
    for vf in video_files:
        out_dir = out_base / vf.stem
        n = extract_frames(vf, out_dir, interval=args.interval, min_frames=args.min_frames)
        total += n

    logger.info("Total frames extracted: %d", total)


if __name__ == "__main__":
    main()
