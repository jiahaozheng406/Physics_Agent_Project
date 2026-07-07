from __future__ import annotations

import math
import os
import tempfile
import statistics
from pathlib import Path
from typing import Any


YOLOV5_MODEL_CACHE: dict[str, Any] = {}
DEFAULT_YOLO_CLASS_NAMES = {"pendulum_bob", "bob", "ball", "sports ball"}


class PendulumAnalysisError(RuntimeError):
    """Raised when a video can be read but the pendulum signal is unusable."""


class PendulumDependencyError(PendulumAnalysisError):
    """Raised when optional computer-vision dependencies are unavailable."""


def analyze_pendulum_video(
    video_path: Path,
    *,
    length_m: float | None = None,
    gravity: float = 9.8,
    max_seconds: float = 90.0,
    detector: str = "auto",
    yolo_weights: str | Path | None = None,
    yolo_confidence: float = 0.18,
    yolo_img_size: int = 640,
    output_video_path: Path | None = None,
) -> dict[str, Any]:
    """Extract a pendulum period from a local video file."""
    length_input_provided = length_m is not None
    if length_m is not None and length_m <= 0:
        raise PendulumAnalysisError("摆长 L 必须大于 0。")
    if gravity <= 0:
        raise PendulumAnalysisError("重力加速度 g 必须大于 0。")
    detector_mode = _normalize_detector(detector)

    try:
        import cv2  # type: ignore
        import numpy as np  # type: ignore
    except Exception as exc:  # pragma: no cover - depends on local optional packages.
        raise PendulumDependencyError(
            "单摆视频分析需要 OpenCV 与 NumPy。请在当前环境安装 opencv-python-headless 与 numpy 后重试。"
        ) from exc

    temp_video_path: Path | None = None
    capture = cv2.VideoCapture(str(video_path))
    if not capture.isOpened() and not str(video_path).isascii() and video_path.exists():
        suffix = video_path.suffix if video_path.suffix else ".mp4"
        with tempfile.NamedTemporaryFile(prefix="pendulum_video_", suffix=suffix, delete=False) as handle:
            temp_video_path = Path(handle.name)
            handle.write(video_path.read_bytes())
        capture = cv2.VideoCapture(str(temp_video_path))
    if not capture.isOpened():
        if temp_video_path is not None:
            temp_video_path.unlink(missing_ok=True)
        raise PendulumAnalysisError("无法读取该视频文件，请确认格式为 mp4、webm、mov、avi 或 mkv。")

    fps = float(capture.get(cv2.CAP_PROP_FPS) or 0.0)
    if not math.isfinite(fps) or fps <= 1:
        fps = 30.0
    total_frames = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    max_frames = int(max_seconds * fps)
    if total_frames > 0:
        max_frames = min(max_frames, total_frames)
    max_frames = max(1, max_frames)

    frame_width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
    frame_height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
    background_subtractor = cv2.createBackgroundSubtractorMOG2(history=180, varThreshold=32, detectShadows=False)
    detector_notes: list[str] = []
    yolo_model = None
    yolo_names: dict[int, str] = {}
    yolo_weights_path = str(yolo_weights or os.getenv("PHYSICS_AGENT_PENDULUM_YOLO_WEIGHTS", "")).strip()
    yolo_available = detector_mode in {"auto", "yolov5"}
    if yolo_available:
        try:
            yolo_model, yolo_names = _load_yolov5_model(yolo_weights_path, confidence=yolo_confidence)
            detector_notes.append(
                f"YOLOv5 detector loaded ({'custom weights' if yolo_weights_path else 'pretrained baseline'})."
            )
        except Exception as exc:
            if detector_mode == "yolov5":
                capture.release()
                raise PendulumDependencyError(
                    f"YOLOv5 检测器加载失败：{exc}。请确认 torch 可用，并配置 PHYSICS_AGENT_PENDULUM_YOLO_WEIGHTS 指向自训练权重。"
                ) from exc
            detector_notes.append(f"YOLOv5 unavailable, fallback to OpenCV: {exc}")

    points: list[dict[str, Any]] = []
    previous_gray = None
    last_center: tuple[float, float] | None = None
    frame_index = 0
    yolo_hits = 0
    opencv_hits = 0
    yolo_rejected = 0

    while frame_index < max_frames:
        ok, frame = capture.read()
        if not ok or frame is None:
            break

        timestamp_ms = float(capture.get(cv2.CAP_PROP_POS_MSEC) or 0.0)
        timestamp = timestamp_ms / 1000.0 if timestamp_ms > 0 else frame_index / fps
        center = None
        confidence = 0.0
        method = ""
        area = 0.0
        yolo_detection: tuple[tuple[float, float] | None, float, str, float] = (None, 0.0, "", 0.0)
        opencv_detection: tuple[tuple[float, float] | None, float, str, float] = (None, 0.0, "", 0.0)

        if yolo_model is not None:
            yolo_detection = _detect_bob_center_yolov5(
                frame,
                model=yolo_model,
                names=yolo_names,
                last_center=last_center,
                img_size=yolo_img_size,
                previous_gray=previous_gray,
                cv2=cv2,
                np=np,
            )

        if detector_mode in {"auto", "opencv", "yolov5"}:
            opencv_detection = _detect_bob_center_opencv(
                frame,
                cv2=cv2,
                np=np,
                background_subtractor=background_subtractor,
                previous_gray=previous_gray,
                last_center=last_center,
            )

        center, confidence, method, area, detection_source = _select_pendulum_detection(
            yolo_detection=yolo_detection,
            opencv_detection=opencv_detection,
            last_center=last_center,
            width=frame_width,
            height=frame_height,
            detector_mode=detector_mode,
        )
        if detection_source == "yolov5":
            yolo_hits += 1
        elif detection_source == "opencv":
            opencv_hits += 1
        if yolo_detection[0] is not None and detection_source != "yolov5":
            yolo_rejected += 1
        previous_gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

        if center is not None:
            last_center = center
            points.append(
                {
                    "frame": frame_index,
                    "t": timestamp,
                    "x": float(center[0]),
                    "y": float(center[1]),
                    "confidence": float(confidence),
                    "method": method,
                    "area": float(area),
                }
            )

        frame_index += 1

    capture.release()
    if temp_video_path is not None:
        temp_video_path.unlink(missing_ok=True)

    if len(points) < max(10, int(fps * 0.8)):
        if detector_mode == "yolov5":
            raise PendulumAnalysisError(
                "YOLOv5 未能稳定检测到摆球。请使用已用仿真/实拍单摆数据训练的 pendulum_bob 权重，或切换为自动/传统视觉模式。"
            )
        raise PendulumAnalysisError("未能从视频中稳定检测到摆球，请使用背景简洁、摆球颜色明显、镜头固定的视频。")

    smoothed_points = _smooth_trajectory(points, np=np)
    times = np.array([item["t"] for item in smoothed_points], dtype=float)
    signal_x = np.array([item["x_smooth"] for item in smoothed_points], dtype=float)
    signal_y = np.array([item["y_smooth"] for item in smoothed_points], dtype=float)
    theoretical_period = 2 * math.pi * math.sqrt(length_m / gravity) if length_m is not None else None
    fft_result = _estimate_period_from_fft(times, signal_x, np=np)
    autocorr_result = _estimate_period_from_autocorrelation(times, signal_x, np=np)
    # Keep period extraction independent from the theoretical comparison. A wrong or missing
    # length should not pull the measured video period away from the visual trajectory.
    period_hint = 2.0

    x_period = _estimate_period_from_peaks(times, signal_x, fps=fps, expected_period=period_hint, source="x(t)", np=np)
    y_period = _estimate_period_from_peaks(times, signal_y, fps=fps, expected_period=period_hint / 2, source="y(t)", np=np)
    # Vertical displacement has two extrema per full oscillation for small-angle motion.
    if y_period["period"] is not None:
        y_period = {**y_period, "period": y_period["period"] * 2, "intervals": [value * 2 for value in y_period["intervals"]]}

    peak_estimates = [entry for entry in (x_period, y_period) if entry["period"] is not None]
    period_peak = None
    peak_source = ""
    peak_intervals: list[float] = []
    peak_indices: list[int] = []
    if peak_estimates:
        # The horizontal coordinate is the small-angle harmonic signal. The vertical coordinate
        # can be useful as a fallback, but it often introduces half-period or double-period
        # ambiguity when the camera is not exactly front-facing.
        best_peak = x_period if x_period["period"] is not None else y_period
        period_peak = float(best_peak["period"])
        peak_source = str(best_peak["source"])
        peak_intervals = [float(value) for value in best_peak["intervals"]]
        peak_indices = [int(value) for value in best_peak["peaks"]]

    period_fft = fft_result["period"]
    period_autocorr = autocorr_result["period"]
    reference_period = period_autocorr or period_fft
    selected_peak = _select_consistent_peak_period(
        x_period=x_period,
        y_period=y_period,
        reference_period=reference_period,
    )

    if selected_peak is not None:
        period_experimental = float(selected_peak["period"])
        peak_source = str(selected_peak["source"])
        peak_intervals = [float(value) for value in selected_peak["intervals"]]
        peak_indices = [int(value) for value in selected_peak["peaks"]]
        suffix = "，经自相关校验" if reference_period is not None else ""
        period_method = f"峰值检测（{peak_source}{suffix}）"
        period_peak = period_experimental
    elif period_autocorr is not None:
        period_experimental = float(period_autocorr)
        period_method = "自相关分析（x(t)）"
        if period_peak is not None:
            detector_notes.append(
                f"峰值检测得到 {period_peak:.4f} s，但与轨迹主周期不一致，已按自相关周期修正。"
            )
    elif period_fft is not None:
        period_experimental = float(period_fft)
        period_method = "频域分析（FFT）"
        if period_peak is not None:
            detector_notes.append(
                f"峰值检测得到 {period_peak:.4f} s，但与频域主周期不一致，已按 FFT 主周期修正。"
            )
    else:
        raise PendulumAnalysisError("已检测到摆球轨迹，但视频中完整摆动次数不足，无法计算稳定周期。")

    relative_error = (
        abs(period_experimental - theoretical_period) / theoretical_period
        if theoretical_period is not None and theoretical_period > 0
        else None
    )
    equivalent_length_m = gravity * (period_experimental / (2 * math.pi)) ** 2
    stability = _build_stability_summary(peak_intervals, period_experimental)
    trajectory = _downsample_trajectory(smoothed_points)
    key_frames = _build_key_frames(smoothed_points, peak_indices)
    detection_rate = len(points) / max(1, frame_index)
    resolved_detector = "yolov5" if yolo_hits and (detector_mode == "yolov5" or yolo_hits >= opencv_hits) else "opencv"
    if detector_mode == "auto" and yolo_model is not None and yolo_hits <= max(6, frame_index * 0.08):
        detector_notes.append("YOLOv5 detections were sparse; OpenCV fallback dominated this run.")
    if yolo_rejected:
        detector_notes.append(f"已剔除 {yolo_rejected} 帧低可信或物理轨迹不连续的 YOLO 摆球候选。")
    if detector_mode == "yolov5" and not yolo_weights_path:
        detector_notes.append("Using pretrained YOLOv5 without pendulum-specific training; custom pendulum_bob weights are recommended.")

    processed_video_created = False
    processed_video_error = ""
    if output_video_path is not None:
        try:
            processed_video_created = _write_annotated_video(
                video_path=video_path,
                output_path=output_video_path,
                points=smoothed_points,
                fps=fps,
                max_frames=frame_index,
                period_experimental=period_experimental,
                detector=resolved_detector,
                detector_requested=detector_mode,
                cv2=cv2,
                np=np,
            )
        except Exception as exc:  # pragma: no cover - depends on local video codecs.
            processed_video_error = str(exc)
            detector_notes.append(f"Processed video export failed: {exc}")

    result: dict[str, Any] = {
        "period_experimental": round(period_experimental, 4),
        "period_theoretical": round(theoretical_period, 4) if theoretical_period is not None else None,
        "error": round(relative_error, 5) if relative_error is not None else None,
        "trajectory": trajectory,
        "analysis": _build_analysis_text(
            period_experimental=period_experimental,
            theoretical_period=theoretical_period,
            relative_error=relative_error,
            length_m=length_m,
            equivalent_length_m=equivalent_length_m,
            method=period_method,
            fps=fps,
            detected_points=len(points),
            frame_count=frame_index,
            stability=stability,
        ),
        "advice": _build_advice_text(
            relative_error=relative_error,
            length_input_provided=length_input_provided,
            detection_rate=detection_rate,
            stability=stability,
        ),
        "length_m": round(float(length_m), 5) if length_m is not None else None,
        "length_input_provided": length_input_provided,
        "length_equivalent_m": round(float(equivalent_length_m), 5),
        "gravity": round(float(gravity), 5),
        "theory_status": "measured_length" if length_input_provided else "length_required",
        "theory_note": (
            "理论周期按用户输入的实测摆长计算。"
            if length_input_provided
            else "未输入实测摆长，暂不计算独立理论周期；已根据实验周期反推等效摆长。"
        ),
        "period_method": period_method,
        "period_peak": round(period_peak, 4) if period_peak is not None else None,
        "period_fft": round(float(period_fft), 4) if period_fft is not None else None,
        "period_autocorrelation": round(float(period_autocorr), 4) if period_autocorr is not None else None,
        "autocorrelation_score": round(float(autocorr_result["score"]), 5) if autocorr_result["score"] is not None else None,
        "dominant_frequency_hz": round(float(fft_result["frequency"]), 5) if fft_result["frequency"] is not None else None,
        "fps": round(fps, 3),
        "frame_count": int(frame_index),
        "detected_points": int(len(points)),
        "detection_rate": round(detection_rate, 4),
        "detector": resolved_detector,
        "detector_requested": detector_mode,
        "detector_hits": {"yolov5": int(yolo_hits), "opencv": int(opencv_hits)},
        "detector_model": "yolov5-custom" if yolo_weights_path else ("yolov5-pretrained" if yolo_model is not None else "opencv"),
        "detector_notes": detector_notes,
        "processed_video_created": processed_video_created,
        "processed_video_error": processed_video_error,
        "frame_size": {"width": frame_width, "height": frame_height},
        "key_frames": key_frames,
        "stability": stability,
    }
    return result


def _write_annotated_video(
    *,
    video_path: Path,
    output_path: Path,
    points: list[dict[str, Any]],
    fps: float,
    max_frames: int,
    period_experimental: float,
    detector: str,
    detector_requested: str,
    cv2: Any,
    np: Any,
) -> bool:
    if not points:
        return False

    output_path.parent.mkdir(parents=True, exist_ok=True)
    temp_video_path: Path | None = None
    capture = cv2.VideoCapture(str(video_path))
    if not capture.isOpened() and not str(video_path).isascii() and video_path.exists():
        suffix = video_path.suffix if video_path.suffix else ".mp4"
        with tempfile.NamedTemporaryFile(prefix="pendulum_overlay_", suffix=suffix, delete=False) as handle:
            temp_video_path = Path(handle.name)
            handle.write(video_path.read_bytes())
        capture = cv2.VideoCapture(str(temp_video_path))
    if not capture.isOpened():
        if temp_video_path is not None:
            temp_video_path.unlink(missing_ok=True)
        raise PendulumAnalysisError("无法重新读取原视频以生成检测标注视频。")

    width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
    height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
    if width <= 0 or height <= 0:
        capture.release()
        if temp_video_path is not None:
            temp_video_path.unlink(missing_ok=True)
        raise PendulumAnalysisError("原视频尺寸异常，无法生成检测标注视频。")

    writer = None
    codec_candidates = ("VP80", "VP90") if output_path.suffix.lower() == ".webm" else ("mp4v", "avc1", "H264")
    for codec in codec_candidates:
        candidate = cv2.VideoWriter(str(output_path), cv2.VideoWriter_fourcc(*codec), max(1.0, float(fps)), (width, height))
        if candidate.isOpened():
            writer = candidate
            break
        candidate.release()
    if writer is None:
        capture.release()
        if temp_video_path is not None:
            temp_video_path.unlink(missing_ok=True)
        raise PendulumAnalysisError("OpenCV 当前环境无法创建标注视频。")

    point_by_frame = {int(item["frame"]): item for item in points}
    trail: list[tuple[int, int]] = []
    frame_index = 0
    max_draw_frames = max(1, int(max_frames))
    label_color = (36, 112, 108) if detector == "yolov5" else (48, 96, 150)

    while frame_index < max_draw_frames:
        ok, frame = capture.read()
        if not ok or frame is None:
            break

        point = point_by_frame.get(frame_index)
        if point is not None:
            x = int(round(float(point.get("x_smooth", point.get("x", 0)))))
            y = int(round(float(point.get("y_smooth", point.get("y", 0)))))
            if 0 <= x < width and 0 <= y < height:
                trail.append((x, y))
                trail = trail[-90:]
                radius = int(max(8, min(32, math.sqrt(max(float(point.get("area") or 0.0), 1.0) / math.pi) + 6)))
                cv2.circle(frame, (x, y), radius, (72, 211, 190), 3, lineType=cv2.LINE_AA)
                cv2.circle(frame, (x, y), 5, (22, 104, 95), -1, lineType=cv2.LINE_AA)
                method = str(point.get("method") or detector).upper()
                confidence = float(point.get("confidence") or 0.0)
                cv2.putText(
                    frame,
                    f"{method} {confidence:.2f}",
                    (max(8, x + radius + 6), max(22, y - radius)),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.54,
                    (235, 255, 250),
                    3,
                    lineType=cv2.LINE_AA,
                )
                cv2.putText(
                    frame,
                    f"{method} {confidence:.2f}",
                    (max(8, x + radius + 6), max(22, y - radius)),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.54,
                    (18, 88, 82),
                    1,
                    lineType=cv2.LINE_AA,
                )

        if len(trail) >= 2:
            polyline = np.array(trail, dtype=np.int32).reshape((-1, 1, 2))
            cv2.polylines(frame, [polyline], False, (80, 210, 190), 3, lineType=cv2.LINE_AA)

        overlay = frame.copy()
        cv2.rectangle(overlay, (0, 0), (min(width, 580), 78), (8, 16, 28), -1)
        frame = cv2.addWeighted(overlay, 0.52, frame, 0.48, 0)
        cv2.putText(
            frame,
            f"Pendulum detection: requested={detector_requested} resolved={detector}",
            (18, 30),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.62,
            (235, 246, 255),
            2,
            lineType=cv2.LINE_AA,
        )
        cv2.putText(
            frame,
            f"T_exp={period_experimental:.4f}s  frame={frame_index + 1}/{max_draw_frames}",
            (18, 60),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.62,
            label_color,
            2,
            lineType=cv2.LINE_AA,
        )
        writer.write(frame)
        frame_index += 1

    writer.release()
    capture.release()
    if temp_video_path is not None:
        temp_video_path.unlink(missing_ok=True)
    return output_path.exists() and output_path.stat().st_size > 0


def format_pendulum_report(result: dict[str, Any]) -> str:
    error_value = result.get("error")
    error_text = f"{float(error_value) * 100:.2f}%" if isinstance(error_value, (int, float)) else "未计算"
    stability = result.get("stability") if isinstance(result.get("stability"), dict) else {}
    cv_percent = stability.get("coefficient_variation_percent")
    cv_text = f"{cv_percent:.2f}%" if isinstance(cv_percent, (int, float)) else "样本不足"
    length_text = (
        f"{_format_number(result.get('length_m'), 4)} m"
        if result.get("length_input_provided")
        else f"未输入；由实验周期反推约 {_format_number(result.get('length_equivalent_m'), 4)} m"
    )
    lines = [
        "### 单摆实验周期测量结果",
        "",
        f"- 实验周期：{_format_number(result.get('period_experimental'), 4)} s",
        f"- 理论周期：{_format_number(result.get('period_theoretical'), 4)} s",
        f"- 相对误差：{error_text}",
        f"- 摆长：{length_text}；重力加速度：{_format_number(result.get('gravity'), 3)} m/s^2",
        f"- 计算方法：{result.get('period_method') or '视觉轨迹分析'}；周期稳定性：{cv_text}",
        "",
        str(result.get("analysis") or "").strip(),
        "",
        "### 操作建议",
        "",
        str(result.get("advice") or "").strip(),
    ]
    return "\n".join(part for part in lines if part is not None)


def _normalize_detector(detector: str) -> str:
    value = (detector or "auto").strip().lower()
    if value in {"auto", "opencv", "yolov5"}:
        return value
    raise PendulumAnalysisError("检测器参数仅支持 auto、opencv 或 yolov5。")


def _load_yolov5_model(weights_path: str = "", *, confidence: float = 0.18) -> tuple[Any, dict[int, str]]:
    import torch  # type: ignore

    repo = os.getenv("PHYSICS_AGENT_YOLOV5_REPO", "ultralytics/yolov5").strip() or "ultralytics/yolov5"
    model_name = os.getenv("PHYSICS_AGENT_PENDULUM_YOLO_MODEL", "yolov5s").strip() or "yolov5s"
    clean_weights = str(weights_path or "").strip()
    source = "local" if Path(repo).exists() else "github"
    cache_key = f"{repo}|{source}|{clean_weights or model_name}|{confidence:.3f}"
    cached = YOLOV5_MODEL_CACHE.get(cache_key)
    if cached is not None:
        return cached

    if clean_weights:
        model = torch.hub.load(repo, "custom", path=clean_weights, source=source, trust_repo=True)
    else:
        model = torch.hub.load(repo, model_name, pretrained=True, source=source, trust_repo=True)

    model.conf = max(0.01, min(0.95, float(confidence)))
    model.iou = 0.45
    model.eval()
    names_raw = getattr(model, "names", {}) or {}
    if isinstance(names_raw, dict):
        names = {int(key): str(value) for key, value in names_raw.items()}
    else:
        names = {index: str(value) for index, value in enumerate(names_raw)}
    payload = (model, names)
    YOLOV5_MODEL_CACHE[cache_key] = payload
    return payload


def _yolo_target_class_names() -> set[str]:
    raw = os.getenv("PHYSICS_AGENT_PENDULUM_YOLO_CLASSES", "").strip()
    if not raw:
        return DEFAULT_YOLO_CLASS_NAMES
    return {item.strip().lower() for item in raw.split(",") if item.strip()}


def _detect_bob_center_yolov5(
    frame: Any,
    *,
    model: Any,
    names: dict[int, str],
    last_center: tuple[float, float] | None,
    img_size: int,
    previous_gray: Any,
    cv2: Any,
    np: Any,
) -> tuple[tuple[float, float] | None, float, str, float]:
    results = model(frame[..., ::-1], size=int(img_size))
    detections = getattr(results, "xyxy", [None])[0]
    if detections is None:
        return None, 0.0, "", 0.0

    try:
        rows = detections.detach().cpu().numpy().tolist()
    except Exception:
        rows = detections.tolist()
    if not rows:
        return None, 0.0, "", 0.0

    height, width = frame.shape[:2]
    current_gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY) if previous_gray is not None else None
    target_names = _yolo_target_class_names()
    candidates: list[dict[str, Any]] = []
    for row in rows:
        if len(row) < 6:
            continue
        x1, y1, x2, y2, conf, cls_id = row[:6]
        class_id = int(cls_id)
        class_name = names.get(class_id, str(class_id)).strip().lower()
        box_w = max(0.0, float(x2) - float(x1))
        box_h = max(0.0, float(y2) - float(y1))
        area = box_w * box_h
        if area <= 4:
            continue
        accepted_class = class_name in target_names
        # Custom weights should produce pendulum_bob. For pretrained COCO, sports ball is useful.
        if not accepted_class and target_names:
            class_penalty = 0.52
        else:
            class_penalty = 1.0
        cx = (float(x1) + float(x2)) * 0.5
        cy = (float(y1) + float(y2)) * 0.5
        aspect = max(box_w, box_h) / max(1.0, min(box_w, box_h))
        if aspect > 5.5:
            continue
        color_score = _bbox_bob_color_score(frame, (float(x1), float(y1), float(x2), float(y2)), cv2=cv2, np=np)
        if float(conf) < 0.24 and color_score < 0.55:
            continue
        if aspect > 3.2 and color_score < 0.45:
            continue
        candidates.append(
            {
                "x": cx,
                "y": cy,
                "area": area,
                "confidence": float(conf),
                "method": f"yolov5:{class_name}",
                "class_penalty": class_penalty,
                "color_score": color_score,
                "aspect": aspect,
                "motion_score": _bbox_motion_score(
                    current_gray,
                    previous_gray,
                    (float(x1), float(y1), float(x2), float(y2)),
                    cv2=cv2,
                    np=np,
                ),
                "vertical_bias": cy / max(1.0, height),
                "area_ratio": area / max(1.0, width * height),
            }
        )

    if not candidates:
        return None, 0.0, "", 0.0

    best = max(candidates, key=lambda item: _yolo_candidate_score(item, last_center, width, height))
    return (
        (float(best["x"]), float(best["y"])),
        float(best["confidence"]),
        f"{best['method']}+color{float(best.get('color_score', 0.0)):.2f}",
        float(best["area"]),
    )


def _select_pendulum_detection(
    *,
    yolo_detection: tuple[tuple[float, float] | None, float, str, float],
    opencv_detection: tuple[tuple[float, float] | None, float, str, float],
    last_center: tuple[float, float] | None,
    width: int,
    height: int,
    detector_mode: str,
) -> tuple[tuple[float, float] | None, float, str, float, str]:
    yolo_center, yolo_confidence, yolo_method, yolo_area = yolo_detection
    opencv_center, opencv_confidence, opencv_method, opencv_area = opencv_detection
    if detector_mode == "opencv":
        return opencv_center, opencv_confidence, opencv_method, opencv_area, "opencv" if opencv_center else ""

    max_dim = max(1.0, float(max(width, height)))
    agreement_limit = max(82.0, 0.075 * max_dim)
    jump_limit = max(150.0, 0.12 * max_dim)

    if yolo_center is None:
        if opencv_center is not None and last_center is not None:
            opencv_jump = math.hypot(opencv_center[0] - last_center[0], opencv_center[1] - last_center[1])
            min_opencv_area = 0.00042 * max(1.0, width * height)
            if (opencv_area < min_opencv_area and opencv_jump > agreement_limit) or (
                opencv_jump > max(135.0, 0.08 * max_dim) and opencv_confidence < 0.72
            ):
                return None, 0.0, "", 0.0, ""
        return opencv_center, opencv_confidence, opencv_method, opencv_area, "opencv" if opencv_center else ""

    if opencv_center is not None:
        disagreement = math.hypot(yolo_center[0] - opencv_center[0], yolo_center[1] - opencv_center[1])
        yolo_jump = math.hypot(yolo_center[0] - last_center[0], yolo_center[1] - last_center[1]) if last_center else 0.0
        opencv_jump = math.hypot(opencv_center[0] - last_center[0], opencv_center[1] - last_center[1]) if last_center else 0.0
        opencv_area_ok = opencv_area >= max(0.30 * max(1.0, yolo_area), 0.00035 * max(1.0, width * height))
        if yolo_confidence < 0.22 and opencv_confidence > yolo_confidence and (disagreement <= agreement_limit or opencv_area_ok):
            return opencv_center, opencv_confidence, f"{opencv_method}+yolo-low-conf", opencv_area, "opencv"
        if (
            disagreement > agreement_limit
            and last_center is not None
            and yolo_confidence < 0.34
            and opencv_area_ok
            and opencv_jump <= max(120.0, 0.07 * max_dim)
            and yolo_jump > max(jump_limit, opencv_jump * 2.8 + 32.0)
        ):
            return opencv_center, opencv_confidence, f"{opencv_method}+yolo-track-correct", opencv_area, "opencv"

    if last_center is not None:
        yolo_jump = math.hypot(yolo_center[0] - last_center[0], yolo_center[1] - last_center[1])
        if yolo_jump > jump_limit and yolo_confidence < 0.34:
            if opencv_center is not None:
                opencv_jump = math.hypot(opencv_center[0] - last_center[0], opencv_center[1] - last_center[1])
                opencv_area_ok = opencv_area >= max(0.30 * max(1.0, yolo_area), 0.00035 * max(1.0, width * height))
                if opencv_area_ok and opencv_jump <= max(120.0, 0.07 * max_dim):
                    return opencv_center, opencv_confidence, f"{opencv_method}+yolo-jump-reject", opencv_area, "opencv"
            return None, 0.0, "", 0.0, ""

    return yolo_center, yolo_confidence, yolo_method, yolo_area, "yolov5"


def _yolo_candidate_score(candidate: dict[str, Any], last_center: tuple[float, float] | None, width: int, height: int) -> float:
    continuity = 1.0
    if last_center is not None:
        distance = math.hypot(float(candidate["x"]) - last_center[0], float(candidate["y"]) - last_center[1])
        continuity = 1.0 / (1.0 + distance / max(36.0, 0.22 * max(width, height)))
        continuity = 0.58 + 0.72 * continuity
    area_score = min(1.25, math.sqrt(max(float(candidate["area_ratio"]), 1e-9)) * 58.0)
    vertical_bonus = 0.84 + 0.28 * float(candidate["vertical_bias"])
    motion_score = 0.42 + 1.18 * float(candidate.get("motion_score", 0.5))
    aspect_score = 1.0 / (0.72 + 0.28 * float(candidate.get("aspect", 1.0)))
    color_score = 0.46 + 1.35 * float(candidate.get("color_score", 0.0))
    return float(candidate["confidence"]) * area_score * vertical_bonus * continuity * float(candidate["class_penalty"]) * motion_score * aspect_score * color_score


def _bbox_bob_color_score(frame: Any, bbox: tuple[float, float, float, float], *, cv2: Any, np: Any) -> float:
    height, width = frame.shape[:2]
    x1, y1, x2, y2 = bbox
    ix1 = max(0, int(math.floor(x1)))
    iy1 = max(0, int(math.floor(y1)))
    ix2 = min(width, int(math.ceil(x2)))
    iy2 = min(height, int(math.ceil(y2)))
    if ix2 - ix1 < 3 or iy2 - iy1 < 3:
        return 0.0
    roi = frame[iy1:iy2, ix1:ix2]
    hsv = cv2.cvtColor(cv2.GaussianBlur(roi, (3, 3), 0), cv2.COLOR_BGR2HSV)
    warm_low = cv2.inRange(hsv, np.array([0, 45, 35]), np.array([36, 255, 255]))
    warm_high = cv2.inRange(hsv, np.array([165, 45, 35]), np.array([179, 255, 255]))
    warm_mask = cv2.bitwise_or(warm_low, warm_high)
    saturation = hsv[:, :, 1]
    value = hsv[:, :, 2]
    saturated_mask = (saturation > 52) & (value > 42)
    warm_ratio = float(np.mean(warm_mask > 0))
    saturated_ratio = float(np.mean(saturated_mask))
    return max(0.0, min(1.0, warm_ratio * 7.0 + saturated_ratio * 0.34))


def _bbox_motion_score(current_gray: Any, previous_gray: Any, bbox: tuple[float, float, float, float], *, cv2: Any, np: Any) -> float:
    if current_gray is None or previous_gray is None:
        return 0.5
    x1, y1, x2, y2 = bbox
    height, width = current_gray.shape[:2]
    pad = max(4, int(max(x2 - x1, y2 - y1) * 0.2))
    ix1 = max(0, int(math.floor(x1)) - pad)
    iy1 = max(0, int(math.floor(y1)) - pad)
    ix2 = min(width, int(math.ceil(x2)) + pad)
    iy2 = min(height, int(math.ceil(y2)) + pad)
    if ix2 <= ix1 or iy2 <= iy1:
        return 0.0
    current_roi = current_gray[iy1:iy2, ix1:ix2]
    previous_roi = previous_gray[iy1:iy2, ix1:ix2]
    diff = cv2.absdiff(current_roi, previous_roi)
    if diff.size <= 0:
        return 0.0
    mean_diff = float(np.mean(diff))
    active_ratio = float(np.mean(diff > 12))
    return max(0.0, min(1.0, mean_diff / 34.0 + active_ratio * 0.72))


def _detect_bob_center_opencv(
    frame: Any,
    *,
    cv2: Any,
    np: Any,
    background_subtractor: Any,
    previous_gray: Any,
    last_center: tuple[float, float] | None,
) -> tuple[tuple[float, float] | None, float, str, float]:
    height, width = frame.shape[:2]
    scale = min(1.0, 720.0 / max(height, width))
    if scale < 1.0:
        small = cv2.resize(frame, (int(width * scale), int(height * scale)), interpolation=cv2.INTER_AREA)
    else:
        small = frame

    small_h, small_w = small.shape[:2]
    min_area = max(36.0, small_w * small_h * 0.00038)
    max_area = max(min_area * 4, small_w * small_h * 0.08)
    scaled_last = (last_center[0] * scale, last_center[1] * scale) if last_center is not None else None

    candidates: list[dict[str, Any]] = []

    blurred = cv2.GaussianBlur(small, (7, 7), 0)
    hsv = cv2.cvtColor(blurred, cv2.COLOR_BGR2HSV)
    color_mask = cv2.inRange(hsv, np.array([0, 46, 35]), np.array([179, 255, 255]))
    color_mask = _clean_mask(color_mask, cv2=cv2, np=np)
    candidates.extend(
        _contour_candidates(
            color_mask,
            cv2=cv2,
            method="color",
            min_area=min_area,
            max_area=max_area,
            frame_width=small_w,
            frame_height=small_h,
        )
    )

    foreground_mask = background_subtractor.apply(small, learningRate=0.004)
    _, foreground_mask = cv2.threshold(foreground_mask, 180, 255, cv2.THRESH_BINARY)
    foreground_mask = _clean_mask(foreground_mask, cv2=cv2, np=np)
    candidates.extend(
        _contour_candidates(
            foreground_mask,
            cv2=cv2,
            method="motion",
            min_area=min_area,
            max_area=max_area,
            frame_width=small_w,
            frame_height=small_h,
        )
    )

    if previous_gray is not None:
        previous_small = cv2.resize(previous_gray, (small_w, small_h), interpolation=cv2.INTER_AREA) if scale < 1.0 else previous_gray
        current_gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
        diff = cv2.absdiff(current_gray, previous_small)
        _, diff_mask = cv2.threshold(diff, 18, 255, cv2.THRESH_BINARY)
        diff_mask = _clean_mask(diff_mask, cv2=cv2, np=np)
        candidates.extend(
            _contour_candidates(
                diff_mask,
                cv2=cv2,
                method="frame-diff",
                min_area=min_area,
                max_area=max_area,
                frame_width=small_w,
                frame_height=small_h,
            )
        )

    if not candidates:
        return None, 0.0, "", 0.0

    best = max(candidates, key=lambda item: _candidate_score(item, scaled_last, small_w, small_h))
    x = float(best["x"]) / scale
    y = float(best["y"]) / scale
    confidence = min(1.0, max(0.05, _candidate_score(best, scaled_last, small_w, small_h) / 4.0))
    return (x, y), confidence, str(best["method"]), float(best["area"]) / max(scale * scale, 1e-9)


def _clean_mask(mask: Any, *, cv2: Any, np: Any) -> Any:
    kernel = np.ones((5, 5), dtype=np.uint8)
    cleaned = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel, iterations=1)
    cleaned = cv2.morphologyEx(cleaned, cv2.MORPH_CLOSE, kernel, iterations=2)
    return cleaned


def _contour_candidates(
    mask: Any,
    *,
    cv2: Any,
    method: str,
    min_area: float,
    max_area: float,
    frame_width: int,
    frame_height: int,
) -> list[dict[str, Any]]:
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    candidates: list[dict[str, Any]] = []
    for contour in contours:
        area = float(cv2.contourArea(contour))
        if area < min_area or area > max_area:
            continue
        perimeter = float(cv2.arcLength(contour, True))
        if perimeter <= 0:
            continue
        circularity = float(4.0 * math.pi * area / (perimeter * perimeter))
        x, y, width, height = cv2.boundingRect(contour)
        aspect = max(width, height) / max(1.0, min(width, height))
        if aspect > 7.0:
            continue
        moments = cv2.moments(contour)
        if abs(moments["m00"]) < 1e-9:
            continue
        cx = float(moments["m10"] / moments["m00"])
        cy = float(moments["m01"] / moments["m00"])
        candidates.append(
            {
                "x": cx,
                "y": cy,
                "area": area,
                "method": method,
                "circularity": max(0.0, min(1.6, circularity)),
                "aspect": aspect,
                "vertical_bias": cy / max(1.0, frame_height),
                "area_ratio": area / max(1.0, frame_width * frame_height),
            }
        )
    return candidates


def _candidate_score(candidate: dict[str, Any], last_center: tuple[float, float] | None, width: int, height: int) -> float:
    area_score = min(1.4, math.sqrt(max(float(candidate["area_ratio"]), 1e-9)) * 70.0)
    shape_score = 0.45 + min(1.2, float(candidate["circularity"]))
    method_bonus = {"color": 1.25, "motion": 1.0, "frame-diff": 0.82}.get(str(candidate["method"]), 0.8)
    vertical_bonus = 0.82 + 0.32 * float(candidate["vertical_bias"])
    continuity = 1.0
    if last_center is not None:
        dx = float(candidate["x"]) - last_center[0]
        dy = float(candidate["y"]) - last_center[1]
        distance = math.hypot(dx, dy)
        continuity = 1.0 / (1.0 + distance / max(40.0, 0.24 * max(width, height)))
        continuity = 0.58 + 0.72 * continuity
    return area_score * shape_score * method_bonus * vertical_bonus * continuity


def _smooth_trajectory(points: list[dict[str, Any]], *, np: Any, window: int = 5) -> list[dict[str, Any]]:
    if len(points) < 3:
        return [{**item, "x_smooth": item["x"], "y_smooth": item["y"]} for item in points]
    actual_window = min(window, len(points))
    if actual_window % 2 == 0:
        actual_window -= 1
    actual_window = max(3, actual_window)
    kernel = np.ones(actual_window, dtype=float) / actual_window
    xs = np.array([item["x"] for item in points], dtype=float)
    ys = np.array([item["y"] for item in points], dtype=float)
    pad = actual_window // 2
    xs_pad = np.pad(xs, (pad, pad), mode="edge")
    ys_pad = np.pad(ys, (pad, pad), mode="edge")
    xs_smooth = np.convolve(xs_pad, kernel, mode="valid")
    ys_smooth = np.convolve(ys_pad, kernel, mode="valid")
    return [
        {
            **item,
            "x_smooth": float(xs_smooth[index]),
            "y_smooth": float(ys_smooth[index]),
        }
        for index, item in enumerate(points)
    ]


def _estimate_period_from_peaks(times: Any, values: Any, *, fps: float, expected_period: float, source: str, np: Any) -> dict[str, Any]:
    if len(times) < 8:
        return {"period": None, "intervals": [], "peaks": [], "source": source, "amplitude": 0.0}

    centered = values - float(np.nanmedian(values))
    amplitude = float(np.nanpercentile(centered, 95) - np.nanpercentile(centered, 5))
    if not math.isfinite(amplitude) or amplitude < 3.0:
        return {"period": None, "intervals": [], "peaks": [], "source": source, "amplitude": amplitude}

    min_distance_sec = max(0.24, min(1.6, expected_period * 0.38))
    min_distance = max(3, int(min_distance_sec * fps))
    threshold = max(2.0, float(np.nanstd(centered)) * 0.16)
    maxima = _find_prominent_peaks(centered, threshold=threshold, min_distance=min_distance, np=np)
    minima = _find_prominent_peaks(-centered, threshold=threshold, min_distance=min_distance, np=np)

    intervals: list[float] = []
    for peak_group in (maxima, minima):
        intervals.extend(_intervals_from_indices(times, peak_group))

    intervals = [
        interval
        for interval in intervals
        if math.isfinite(interval) and 0.25 <= interval <= 12.0
    ]
    if expected_period > 0:
        intervals = [
            interval
            for interval in intervals
            if expected_period * 0.35 <= interval <= expected_period * 2.6
        ] or intervals

    if not intervals:
        return {"period": None, "intervals": [], "peaks": sorted(maxima + minima), "source": source, "amplitude": amplitude}

    return {
        "period": float(statistics.fmean(intervals)),
        "intervals": intervals,
        "peaks": sorted(maxima + minima),
        "source": source,
        "amplitude": amplitude,
    }


def _select_consistent_peak_period(
    *,
    x_period: dict[str, Any],
    y_period: dict[str, Any],
    reference_period: float | None,
) -> dict[str, Any] | None:
    candidates = [entry for entry in (x_period, y_period) if entry.get("period") is not None]
    if not candidates:
        return None
    if reference_period is None or not math.isfinite(float(reference_period)) or float(reference_period) <= 0:
        return x_period if x_period.get("period") is not None else y_period

    reference = float(reference_period)
    consistent = [
        entry
        for entry in candidates
        if _periods_are_consistent(float(entry["period"]), reference)
    ]
    if not consistent:
        return None

    x_consistent = [entry for entry in consistent if entry.get("source") == "x(t)"]
    preferred = x_consistent or consistent
    return max(preferred, key=lambda entry: (len(entry.get("intervals") or []), float(entry.get("amplitude") or 0.0)))


def _periods_are_consistent(candidate: float, reference: float) -> bool:
    if not math.isfinite(candidate) or not math.isfinite(reference) or candidate <= 0 or reference <= 0:
        return False
    ratio = candidate / reference
    return 0.62 <= ratio <= 1.38


def _estimate_period_from_autocorrelation(times: Any, values: Any, *, np: Any) -> dict[str, float | None]:
    if len(times) < 24:
        return {"period": None, "score": None}
    duration = float(times[-1] - times[0])
    if duration <= 2.0:
        return {"period": None, "score": None}

    diffs = np.diff(times)
    median_dt = float(np.median(diffs[diffs > 0])) if np.any(diffs > 0) else duration / max(1, len(times) - 1)
    if not math.isfinite(median_dt) or median_dt <= 0:
        return {"period": None, "score": None}
    sample_rate = min(120.0, max(8.0, 1.0 / median_dt))
    grid = np.arange(float(times[0]), float(times[-1]), 1.0 / sample_rate)
    if len(grid) < 24:
        return {"period": None, "score": None}

    signal = np.interp(grid, times, values)
    smooth_window = max(3, int(sample_rate * 0.2))
    if smooth_window % 2 == 0:
        smooth_window += 1
    if smooth_window > 3 and len(signal) > smooth_window:
        kernel = np.ones(smooth_window, dtype=float) / smooth_window
        signal = np.convolve(signal, kernel, mode="same")
    signal = signal - float(np.mean(signal))
    std = float(np.std(signal))
    if not math.isfinite(std) or std < 2.0:
        return {"period": None, "score": None}
    signal = signal / std

    correlation = np.correlate(signal, signal, mode="full")[len(signal) - 1:]
    if len(correlation) < 3 or float(correlation[0]) <= 0:
        return {"period": None, "score": None}
    correlation = correlation / float(correlation[0])
    lags = np.arange(len(correlation), dtype=float) / sample_rate
    min_period = max(0.8, duration / 16.0)
    max_period = min(12.0, duration * 0.9)
    if max_period <= min_period:
        return {"period": None, "score": None}

    best_period = None
    best_score = None
    for index in range(1, len(correlation) - 1):
        lag = float(lags[index])
        if lag < min_period or lag > max_period:
            continue
        value = float(correlation[index])
        if value < float(correlation[index - 1]) or value <= float(correlation[index + 1]):
            continue
        if best_score is None or value > best_score:
            best_period = lag
            best_score = value

    if best_period is None or best_score is None or best_score < 0.08:
        return {"period": None, "score": best_score}
    return {"period": float(best_period), "score": float(best_score)}


def _find_prominent_peaks(values: Any, *, threshold: float, min_distance: int, np: Any) -> list[int]:
    candidates: list[tuple[int, float]] = []
    radius = max(2, min_distance // 2)
    for index in range(1, len(values) - 1):
        value = float(values[index])
        if value < threshold or value < float(values[index - 1]) or value <= float(values[index + 1]):
            continue
        left = max(0, index - radius)
        right = min(len(values), index + radius + 1)
        local_floor = max(float(np.min(values[left:index + 1])), float(np.min(values[index:right])))
        prominence = value - local_floor
        if prominence >= threshold * 0.55:
            candidates.append((index, value))

    selected: list[tuple[int, float]] = []
    for index, value in sorted(candidates, key=lambda item: item[1], reverse=True):
        if all(abs(index - existing_index) >= min_distance for existing_index, _ in selected):
            selected.append((index, value))
    return sorted(index for index, _ in selected)


def _intervals_from_indices(times: Any, indices: list[int]) -> list[float]:
    if len(indices) < 2:
        return []
    return [float(times[indices[index + 1]] - times[indices[index]]) for index in range(len(indices) - 1)]


def _estimate_period_from_fft(times: Any, values: Any, *, np: Any) -> dict[str, float | None]:
    if len(times) < 16:
        return {"period": None, "frequency": None}
    duration = float(times[-1] - times[0])
    if duration <= 1.0:
        return {"period": None, "frequency": None}

    diffs = np.diff(times)
    median_dt = float(np.median(diffs[diffs > 0])) if np.any(diffs > 0) else duration / max(1, len(times) - 1)
    if not math.isfinite(median_dt) or median_dt <= 0:
        return {"period": None, "frequency": None}
    sample_rate = min(120.0, max(8.0, 1.0 / median_dt))
    grid = np.arange(float(times[0]), float(times[-1]), 1.0 / sample_rate)
    if len(grid) < 16:
        return {"period": None, "frequency": None}

    signal = np.interp(grid, times, values)
    signal = signal - float(np.mean(signal))
    if float(np.std(signal)) < 2.0:
        return {"period": None, "frequency": None}

    window = np.hanning(len(signal))
    spectrum = np.abs(np.fft.rfft(signal * window))
    freqs = np.fft.rfftfreq(len(signal), d=1.0 / sample_rate)
    valid = (freqs >= 0.12) & (freqs <= 4.0)
    if not np.any(valid):
        return {"period": None, "frequency": None}
    valid_indices = np.where(valid)[0]
    best_index = int(valid_indices[int(np.argmax(spectrum[valid]))])
    frequency = float(freqs[best_index])
    if not math.isfinite(frequency) or frequency <= 0:
        return {"period": None, "frequency": None}
    return {"period": 1.0 / frequency, "frequency": frequency}


def _build_stability_summary(intervals: list[float], period: float) -> dict[str, Any]:
    clean = [float(value) for value in intervals if math.isfinite(value) and value > 0]
    if len(clean) < 2:
        return {
            "sample_count": len(clean),
            "mean_period": round(period, 4),
            "std_period": None,
            "coefficient_variation_percent": None,
            "level": "样本不足",
        }
    mean_value = statistics.fmean(clean)
    std_value = statistics.stdev(clean)
    cv = std_value / mean_value * 100 if mean_value else 0.0
    if cv < 2.0:
        level = "稳定"
    elif cv < 5.0:
        level = "基本稳定"
    else:
        level = "波动较大"
    return {
        "sample_count": len(clean),
        "mean_period": round(mean_value, 4),
        "std_period": round(std_value, 4),
        "coefficient_variation_percent": round(cv, 3),
        "level": level,
    }


def _downsample_trajectory(points: list[dict[str, Any]], *, max_points: int = 720) -> list[dict[str, Any]]:
    if not points:
        return []
    step = max(1, math.ceil(len(points) / max_points))
    sampled = points[::step]
    if sampled[-1] is not points[-1]:
        sampled.append(points[-1])
    return [
        {
            "frame": int(item["frame"]),
            "t": round(float(item["t"]), 4),
            "x": round(float(item["x"]), 3),
            "y": round(float(item["y"]), 3),
            "x_smooth": round(float(item["x_smooth"]), 3),
            "y_smooth": round(float(item["y_smooth"]), 3),
            "confidence": round(float(item.get("confidence", 0.0)), 3),
        }
        for item in sampled
    ]


def _build_key_frames(points: list[dict[str, Any]], peak_indices: list[int], *, max_items: int = 12) -> list[dict[str, Any]]:
    if not points:
        return []
    selected_indices = [index for index in peak_indices if 0 <= index < len(points)]
    if not selected_indices:
        step = max(1, len(points) // max_items)
        selected_indices = list(range(0, len(points), step))[:max_items]
    selected_indices = selected_indices[:max_items]
    return [
        {
            "frame": int(points[index]["frame"]),
            "t": round(float(points[index]["t"]), 4),
            "x": round(float(points[index]["x_smooth"]), 3),
            "y": round(float(points[index]["y_smooth"]), 3),
        }
        for index in selected_indices
    ]


def _build_analysis_text(
    *,
    period_experimental: float,
    theoretical_period: float | None,
    relative_error: float | None,
    length_m: float | None,
    equivalent_length_m: float,
    method: str,
    fps: float,
    detected_points: int,
    frame_count: int,
    stability: dict[str, Any],
) -> str:
    stability_level = stability.get("level") or "样本不足"
    cv = stability.get("coefficient_variation_percent")
    cv_clause = f"，周期变异系数约为 {cv:.2f}%" if isinstance(cv, (int, float)) else ""
    if theoretical_period is not None and relative_error is not None:
        comparison_clause = (
            f"用户输入的实测摆长为 L = {length_m:.4f} m，按 T = 2π√(L/g) 计算，理论周期 "
            f"T_theory = {theoretical_period:.4f} s，相对误差为 {relative_error * 100:.2f}%。"
        )
    else:
        comparison_clause = (
            "本次未输入悬点到摆球质心的实测摆长，因此不输出独立理论周期和相对误差；"
            f"若把实验周期代入 L = g(T/2π)^2，可反推等效摆长约为 {equivalent_length_m:.4f} m。"
        )
    return (
        f"系统从视频中识别到 {detected_points}/{frame_count} 帧的摆球中心，并以 {method} 得到实验周期 "
        f"T_exp = {period_experimental:.4f} s。{comparison_clause}"
        f"从相邻周期样本看，本次测量的周期稳定性为“{stability_level}”{cv_clause}。"
        f"若摆角较小且镜头保持静止，该结果可作为单摆简谐近似的自动测量值；若误差偏大，应优先检查摆长取值、摆角大小与视觉识别质量。"
    )


def _build_advice_text(
    *,
    relative_error: float | None,
    length_input_provided: bool,
    detection_rate: float,
    stability: dict[str, Any],
) -> str:
    suggestions = [
        "拍摄时保持相机固定，尽量让摆球颜色与背景形成明显对比，并让摆球完整出现在画面中央。",
        "摆长 L 应取悬点到摆球质心的距离；若只量到细线末端，会系统性改变理论周期。",
        "初始摆角建议控制在 5° 到 10° 左右，摆角过大会引入非简谐修正，使实验周期偏离小角近似公式。",
        "建议记录 5 个以上完整周期后取平均，帧率较低或视频过短都会放大峰值定位误差。",
    ]
    if not length_input_provided:
        suggestions.append("若要做理论对比，请先输入真实摆长；未测量摆长时，只应报告实验周期或反推等效摆长。")
    if relative_error is not None and relative_error > 0.08:
        suggestions.append("本次相对误差偏大，可复核摆长输入、视频帧率、空气阻力影响以及是否存在椭圆摆动。")
    if detection_rate < 0.55:
        suggestions.append("摆球检测覆盖率偏低，建议更换纯色摆球、提高照明或裁剪掉复杂背景后再分析。")
    if (stability.get("coefficient_variation_percent") or 0) > 5:
        suggestions.append("周期样本波动较大，可能存在释放时推力、支架晃动或跟踪点跳变，应重新录制并避免手部入镜。")
    return "\n".join(f"{index + 1}. {item}" for index, item in enumerate(suggestions))


def _format_number(value: Any, digits: int) -> str:
    if isinstance(value, (int, float)) and math.isfinite(float(value)):
        return f"{float(value):.{digits}f}"
    return "--"
