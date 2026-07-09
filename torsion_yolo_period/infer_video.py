"""
infer_video.py
Run YOLO-Seg on a torsion-pendulum video, extract per-frame rod angles,
smooth the sequence, estimate the oscillation period, and write outputs.

Usage:
    python infer_video.py --video data/videos/扭摆法测量实际演示.mp4 \
                          --weights weights/best.pt \
                          --output outputs
"""
from __future__ import annotations

import argparse
import csv
import json
import logging
import sys
from pathlib import Path
from typing import Optional

import numpy as np

logging.basicConfig(level=logging.INFO, format="[%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

def _select_best_mask(results_frame, min_area: int = 50) -> tuple[Optional[np.ndarray], float, float]:
    """
    From a YOLO result frame, pick the best rod mask.

    Selection priority:
      1. Class == 0 (rod)
      2. Highest confidence among qualifying detections
      3. Mask area >= min_area

    Returns (binary_mask, confidence, mask_area) or (None, 0, 0).
    """
    if results_frame.masks is None:
        return None, 0.0, 0.0

    masks_data = results_frame.masks.data.cpu().numpy()   # (N, H, W)
    boxes = results_frame.boxes
    confs = boxes.conf.cpu().numpy()
    classes = boxes.cls.cpu().numpy().astype(int)

    best_mask = None
    best_conf = -1.0
    best_area = 0.0

    for i, (mask, conf, cls) in enumerate(zip(masks_data, confs, classes)):
        if cls != 0:
            continue
        area = float(mask.sum())
        if area < min_area:
            continue
        if conf > best_conf:
            best_mask = (mask > 0.5).astype(np.uint8)
            best_conf = float(conf)
            best_area = area

    return best_mask, best_conf, best_area


def _draw_overlay(frame: np.ndarray, mask: np.ndarray, center: np.ndarray,
                  main_vec: np.ndarray, theta: float, frame_id: int,
                  t: float, conf: float, alpha: float = 0.4,
                  line_len_ratio: float = 0.4) -> np.ndarray:
    """Draw mask overlay, PCA direction line, and info text onto frame."""
    import cv2

    vis = frame.copy()
    h, w = vis.shape[:2]

    # resize mask to frame size if needed
    if mask.shape[:2] != (h, w):
        mask_resized = cv2.resize(mask, (w, h), interpolation=cv2.INTER_NEAREST)
    else:
        mask_resized = mask

    # green mask overlay
    overlay = vis.copy()
    overlay[mask_resized > 0] = (0, 200, 80)
    vis = cv2.addWeighted(overlay, alpha, vis, 1 - alpha, 0)

    # PCA direction line
    half_len = int(min(w, h) * line_len_ratio)
    cx, cy = int(center[0] * w / mask.shape[1] if mask.shape[1] != w else center[0]),\
             int(center[1] * h / mask.shape[0] if mask.shape[0] != h else center[1])
    dx = int(main_vec[0] * half_len)
    dy = int(main_vec[1] * half_len)
    cv2.line(vis, (cx - dx, cy - dy), (cx + dx, cy + dy), (0, 255, 255), 2)
    cv2.circle(vis, (cx, cy), 5, (0, 0, 255), -1)

    # info text
    lines = [
        f"frame={frame_id}",
        f"t={t:.3f}s",
        f"theta={np.degrees(theta):.2f}deg",
        f"conf={conf:.2f}",
    ]
    for j, txt in enumerate(lines):
        cv2.putText(vis, txt, (10, 25 + j * 20),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 1, cv2.LINE_AA)

    return vis


# ---------------------------------------------------------------------------
# main inference
# ---------------------------------------------------------------------------

def infer_video(
    video_path: Path,
    weights_path: Path,
    output_dir: Path,
    conf_threshold: float = 0.25,
    iou_threshold: float = 0.45,
    min_mask_area: int = 50,
    max_gap_frames: int = 10,
    smooth_method: str = "savgol",
    savgol_window: int = 21,
    savgol_polyorder: int = 3,
    period_method: str = "zero_crossing",
    min_period: float = 0.3,
    max_period: float = 20.0,
    write_video: bool = True,
) -> dict:
    """
    Full inference pipeline for one video.

    Returns a dict with period results and output file paths.
    """
    try:
        import cv2
    except ImportError:
        logger.error("opencv-python required: pip install opencv-python")
        sys.exit(1)

    try:
        from ultralytics import YOLO
    except ImportError:
        logger.error("ultralytics required: pip install ultralytics")
        sys.exit(1)

    from angle_utils import (
        pca_angle_from_mask,
        normalize_angle,
        unwrap_rod_angle,
        smooth_angle,
        interpolate_gaps,
    )
    from period_estimator import estimate_period
    from visualize import save_angle_plot, save_report

    # --- open video ---
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        logger.error("Cannot open video: %s", video_path)
        return {}

    fps = cap.get(cv2.CAP_PROP_FPS)
    if fps <= 0:
        logger.warning("FPS read as %.1f, defaulting to 30.0", fps)
        fps = 30.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    logger.info("Video: %s  [%dx%d  %.1f fps  %d frames]", video_path.name, w, h, fps, total_frames)

    # --- load model ---
    logger.info("Loading weights: %s", weights_path)
    model = YOLO(str(weights_path))

    # --- prepare outputs ---
    vid_stem = video_path.stem
    out_dir = output_dir / vid_stem
    out_dir.mkdir(parents=True, exist_ok=True)
    csv_path = out_dir / "angle_series.csv"
    overlay_path = out_dir / "detection_overlay.mp4"

    # video writer
    vwriter = None
    if write_video:
        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        vwriter = cv2.VideoWriter(str(overlay_path), fourcc, fps, (w, h))

    # --- per-frame processing ---
    frame_ids: list[int] = []
    times: list[float] = []
    theta_raw: list[float] = []
    confs: list[float] = []
    areas: list[float] = []
    valid_flags: list[bool] = []

    frame_id = 0
    while True:
        ret, frame = cap.read()
        if not ret:
            break

        t = frame_id / fps
        results = model(frame, conf=conf_threshold, iou=iou_threshold, verbose=False)
        res = results[0]

        mask, conf, area = _select_best_mask(res, min_area=min_mask_area)

        if mask is not None:
            try:
                theta, center, main_vec = pca_angle_from_mask(mask)
                theta = normalize_angle(theta)
                valid = True
            except ValueError as e:
                logger.debug("Frame %d PCA failed: %s", frame_id, e)
                theta, center, main_vec = float("nan"), np.array([w/2, h/2]), np.array([1.0, 0.0])
                valid = False
        else:
            theta, center, main_vec = float("nan"), np.array([w/2, h/2]), np.array([1.0, 0.0])
            conf, area = 0.0, 0.0
            valid = False

        frame_ids.append(frame_id)
        times.append(t)
        theta_raw.append(theta)
        confs.append(conf)
        areas.append(area)
        valid_flags.append(valid)

        if vwriter is not None:
            if valid and mask is not None:
                vis = _draw_overlay(frame, mask, center, main_vec, theta,
                                    frame_id, t, conf)
            else:
                vis = frame.copy()
                cv2.putText(vis, f"frame={frame_id} NO DETECTION",
                            (10, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 0, 255), 1)
            vwriter.write(vis)

        frame_id += 1

    cap.release()
    if vwriter:
        vwriter.release()

    valid_count = sum(valid_flags)
    logger.info("Valid detections: %d / %d frames", valid_count, frame_id)

    if valid_count < 10:
        logger.error("Too few valid frames (%d) for angle/period analysis", valid_count)
        return {"error": "too few valid frames", "valid_count": valid_count}

    # --- angle post-processing ---
    theta_arr = np.array(theta_raw, dtype=float)
    valid_arr = np.array(valid_flags, dtype=bool)
    times_arr = np.array(times, dtype=float)

    # fill NaN with interpolation for short gaps
    theta_interp = interpolate_gaps(theta_arr, valid_arr, max_gap=max_gap_frames)

    # unwrap (180° symmetry-aware)
    valid_indices = np.where(valid_arr)[0]
    theta_valid = theta_interp[valid_indices]
    theta_unwrapped_valid = unwrap_rod_angle(theta_valid)

    # rebuild full array
    theta_unwrapped = np.full(len(theta_arr), float("nan"))
    theta_unwrapped[valid_indices] = theta_unwrapped_valid

    # smooth
    theta_smooth = np.full(len(theta_arr), float("nan"))
    if valid_count >= 4:
        smooth_vals = smooth_angle(
            theta_unwrapped_valid,
            method=smooth_method,
            window=savgol_window,
            polyorder=savgol_polyorder,
        )
        theta_smooth[valid_indices] = smooth_vals

    # --- period estimation ---
    valid_times = times_arr[valid_indices]
    valid_smooth = theta_smooth[valid_indices]
    period_result = estimate_period(
        valid_times, valid_smooth,
        min_period=min_period, max_period=max_period,
        primary_method=period_method,
    )

    # --- write CSV ---
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["frame_id", "time", "theta_raw", "theta_unwrapped",
                         "theta_smooth", "confidence", "mask_area", "valid"])
        for i in range(len(frame_ids)):
            writer.writerow([
                frame_ids[i],
                f"{times[i]:.4f}",
                f"{theta_raw[i]:.6f}" if valid_flags[i] else "",
                f"{theta_unwrapped[i]:.6f}" if np.isfinite(theta_unwrapped[i]) else "",
                f"{theta_smooth[i]:.6f}" if np.isfinite(theta_smooth[i]) else "",
                f"{confs[i]:.4f}",
                f"{areas[i]:.1f}",
                int(valid_flags[i]),
            ])
    logger.info("CSV saved: %s", csv_path)

    # --- visualizations ---
    plot_path = out_dir / "angle_period_plot.png"
    save_angle_plot(
        times_arr, theta_unwrapped, theta_smooth,
        period_result, plot_path, video_name=vid_stem,
    )

    report_path = out_dir / "report.md"
    save_report(
        video_path, fps, frame_id, valid_count,
        period_result, report_path,
    )

    result = {
        "video": str(video_path),
        "fps": fps,
        "total_frames": frame_id,
        "valid_frames": valid_count,
        "T_final": period_result.T_final,
        "T_zero_crossing": period_result.T_zero_crossing,
        "T_peak": period_result.T_peak,
        "T_fitting": period_result.T_fitting,
        "std_period": period_result.std_period,
        "method_used": period_result.method_used,
        "csv": str(csv_path),
        "plot": str(plot_path),
        "report": str(report_path),
        "overlay_video": str(overlay_path) if write_video else None,
    }

    if period_result.T_final is not None:
        logger.info("Final period T = %.4f s (method=%s)", period_result.T_final, period_result.method_used)
    else:
        logger.warning("Period estimation failed for %s", video_path.name)

    return result


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description="Infer rod angles and period from torsion video")
    parser.add_argument("--video", required=True, help="Path to input video")
    parser.add_argument("--weights", required=True, help="YOLO-Seg weights (.pt)")
    parser.add_argument("--output", default="outputs", help="Output directory")
    parser.add_argument("--conf", type=float, default=0.25)
    parser.add_argument("--iou", type=float, default=0.45)
    parser.add_argument("--min_mask_area", type=int, default=50)
    parser.add_argument("--no_video", action="store_true", help="Skip writing overlay video")
    parser.add_argument("--period_method", default="zero_crossing",
                        choices=["zero_crossing", "peak", "fit"])
    args = parser.parse_args()

    result = infer_video(
        video_path=Path(args.video),
        weights_path=Path(args.weights),
        output_dir=Path(args.output),
        conf_threshold=args.conf,
        iou_threshold=args.iou,
        min_mask_area=args.min_mask_area,
        write_video=not args.no_video,
        period_method=args.period_method,
    )

    if result:
        print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
