from __future__ import annotations

import math
import os
import statistics
import tempfile
from pathlib import Path
from typing import Any

from backend.pendulum_analysis import (
    _estimate_period_from_autocorrelation,
    _estimate_period_from_fft,
    _load_yolov5_model,
)


YOLO_SEG_MODEL_CACHE: dict[str, Any] = {}

# Resolved relative to the repo root (this file lives at <repo_root>/backend/torsion_analysis.py)
# rather than the process's current working directory, so it still resolves
# correctly no matter where uvicorn/the shell was launched from.
_REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_TORSION_YOLO_SEG_WEIGHTS = str(
    _REPO_ROOT / "torsion_yolo_period" / "runs" / "segment" / "runs" / "torsion_rod_seg" / "yolo_seg_rod-3" / "weights" / "best.pt"
)

DEFAULT_TORSION_YOLO_CLASS_NAMES = {
    "torsion_rod",
    "rod",
    "bar",
    "beam",
    "lever",
    "pointer",
    "torsion_marker",
    "marker",
    "dot",
    "mass",
    "bob",
    "ball",
    "sports ball",
}


class TorsionAnalysisError(RuntimeError):
    """Raised when a torsion-pendulum video cannot produce a usable angle signal."""


class TorsionDependencyError(TorsionAnalysisError):
    """Raised when optional computer-vision dependencies are unavailable."""


def analyze_torsion_video(
    video_path: Path,
    *,
    torsion_constant: float | None = None,
    calibration_inertia: float | None = None,
    calibration_period: float | None = None,
    initial_angle_deg: float | None = None,
    max_seconds: float = 90.0,
    detector: str = "auto",
    yolo_weights: str | Path | None = None,
    yolo_confidence: float = 0.18,
    yolo_img_size: int = 640,
    output_video_path: Path | None = None,
) -> dict[str, Any]:
    """Measure torsion-pendulum period and infer moment of inertia from video."""
    if torsion_constant is not None and torsion_constant <= 0:
        raise TorsionAnalysisError("扭转常量 κ 必须大于 0。")
    if calibration_inertia is not None and calibration_inertia <= 0:
        raise TorsionAnalysisError("标定转动惯量 I0 必须大于 0。")
    if calibration_period is not None and calibration_period <= 0:
        raise TorsionAnalysisError("标定周期 T0 必须大于 0。")
    if (calibration_inertia is None) ^ (calibration_period is None):
        raise TorsionAnalysisError("使用标定法时，需要同时输入标定转动惯量 I0 与标定周期 T0。")
    if initial_angle_deg is not None and not math.isfinite(float(initial_angle_deg)):
        raise TorsionAnalysisError("初始角 θ0 必须是有限数值。")
    detector_mode = _normalize_detector(detector)

    try:
        import cv2  # type: ignore
        import numpy as np  # type: ignore
    except Exception as exc:  # pragma: no cover - depends on local optional packages.
        raise TorsionDependencyError("扭摆视频分析需要 OpenCV 与 NumPy。请安装 opencv-python-headless 与 numpy 后重试。") from exc

    temp_video_path: Path | None = None
    capture = cv2.VideoCapture(str(video_path))
    if not capture.isOpened() and not str(video_path).isascii() and video_path.exists():
        suffix = video_path.suffix if video_path.suffix else ".mp4"
        with tempfile.NamedTemporaryFile(prefix="torsion_video_", suffix=suffix, delete=False) as handle:
            temp_video_path = Path(handle.name)
            handle.write(video_path.read_bytes())
        capture = cv2.VideoCapture(str(temp_video_path))
    if not capture.isOpened():
        if temp_video_path is not None:
            temp_video_path.unlink(missing_ok=True)
        raise TorsionAnalysisError("无法读取该视频文件，请确认格式为 mp4、webm、mov、avi 或 mkv。")

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
    pivot_anchor = _estimate_video_torsion_pivot(capture, frame_count=max_frames, cv2=cv2, np=np)
    capture.set(cv2.CAP_PROP_POS_FRAMES, 0)

    detector_notes: list[str] = []
    yolo_seg_model = None
    yolo_seg_weights_path = str(
        os.getenv("PHYSICS_AGENT_TORSION_YOLO_SEG_WEIGHTS", "") or DEFAULT_TORSION_YOLO_SEG_WEIGHTS
    ).strip()
    if detector_mode in {"auto", "yolo-seg"}:
        try:
            yolo_seg_model = _load_yolo_seg_model(yolo_seg_weights_path)
            detector_notes.append(f"YOLO-Seg rod detector loaded ({yolo_seg_weights_path}).")
        except Exception as exc:
            if detector_mode == "yolo-seg":
                capture.release()
                if temp_video_path is not None:
                    temp_video_path.unlink(missing_ok=True)
                raise TorsionDependencyError(
                    f"YOLO-Seg 检测器加载失败：{exc}。请配置 PHYSICS_AGENT_TORSION_YOLO_SEG_WEIGHTS 指向训练好的 rod 分割权重。"
                ) from exc
            detector_notes.append(f"YOLO-Seg unavailable, fallback to YOLOv5/OpenCV: {exc}")

    yolo_model = None
    yolo_names: dict[int, str] = {}
    yolo_weights_path = str(
        yolo_weights
        or os.getenv("PHYSICS_AGENT_TORSION_YOLO_WEIGHTS", "")
        or os.getenv("PHYSICS_AGENT_PENDULUM_YOLO_WEIGHTS", "")
    ).strip()
    if yolo_seg_model is None and detector_mode in {"auto", "yolov5"}:
        try:
            yolo_model, yolo_names = _load_yolov5_model(yolo_weights_path, confidence=yolo_confidence)
            detector_notes.append(
                f"YOLOv5 detector loaded ({'custom weights' if yolo_weights_path else 'pretrained baseline'})."
            )
        except Exception as exc:
            if detector_mode == "yolov5":
                capture.release()
                if temp_video_path is not None:
                    temp_video_path.unlink(missing_ok=True)
                raise TorsionDependencyError(
                    f"YOLOv5 检测器加载失败：{exc}。请配置 PHYSICS_AGENT_TORSION_YOLO_WEIGHTS 指向扭摆标记点权重。"
                ) from exc
            detector_notes.append(f"YOLOv5 unavailable, fallback to OpenCV: {exc}")

    points: list[dict[str, Any]] = []
    previous_gray = None
    last_angle = None
    frame_index = 0
    yolo_seg_hits = 0
    yolo_hits = 0
    opencv_hits = 0

    while frame_index < max_frames:
        ok, frame = capture.read()
        if not ok or frame is None:
            break
        timestamp_ms = float(capture.get(cv2.CAP_PROP_POS_MSEC) or 0.0)
        timestamp = timestamp_ms / 1000.0 if timestamp_ms > 0 else frame_index / fps
        angle = None
        confidence = 0.0
        method = ""
        geometry: dict[str, Any] = {}

        if yolo_seg_model is not None:
            angle, confidence, method, geometry = _detect_angle_yolo_seg(
                frame,
                model=yolo_seg_model,
                pivot=pivot_anchor,
                last_angle=last_angle,
                cv2=cv2,
                np=np,
            )
            if angle is not None:
                yolo_seg_hits += 1

        if angle is None and yolo_model is not None:
            angle, confidence, method, geometry = _detect_angle_yolov5(
                frame,
                model=yolo_model,
                names=yolo_names,
                pivot=pivot_anchor,
                last_angle=last_angle,
                img_size=yolo_img_size,
                cv2=cv2,
                np=np,
            )
            if angle is not None:
                yolo_hits += 1

        if angle is None and detector_mode in {"auto", "opencv"}:
            angle, confidence, method, geometry = _detect_angle_opencv(
                frame,
                cv2=cv2,
                np=np,
                previous_gray=previous_gray,
                pivot=pivot_anchor,
                last_angle=last_angle,
            )
            if angle is not None:
                opencv_hits += 1

        previous_gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        if angle is not None:
            if last_angle is not None:
                angle = _unwrap_line_angle(angle, last_angle)
            last_angle = angle
            points.append(
                {
                    "frame": frame_index,
                    "t": timestamp,
                    "theta_rad": float(angle),
                    "theta_deg": math.degrees(float(angle)),
                    "confidence": float(confidence),
                    "method": method,
                    "geometry": geometry,
                }
            )
        frame_index += 1

    capture.release()
    if temp_video_path is not None:
        temp_video_path.unlink(missing_ok=True)

    if len(points) < max(12, int(fps * 1.0)):
        if detector_mode == "yolov5":
            raise TorsionAnalysisError("YOLOv5 未能稳定检测到扭摆标记点。请使用扭摆标记点权重，或切换为自动/传统视觉模式。")
        raise TorsionAnalysisError("未能从视频中稳定提取扭摆角度。请给横杆或转盘贴明显标记，并保持相机俯视或正对。")

    smoothed_points = _smooth_angle_points(points, fps=fps, np=np)
    angle_offset_deg = 0.0
    if initial_angle_deg is not None:
        smoothed_points, angle_offset_deg = _apply_initial_angle_offset(smoothed_points, float(initial_angle_deg))
    times = np.array([item["t"] for item in smoothed_points], dtype=float)
    theta = np.array([item["theta_smooth_deg"] for item in smoothed_points], dtype=float)
    theta_centered = theta - float(np.nanmedian(theta))

    autocorr = _estimate_period_from_autocorrelation(times, theta_centered, np=np)
    fft = _estimate_period_from_fft(times, theta_centered, np=np)
    peak = _estimate_torsion_peak_period(times, theta_centered, fps=fps, reference_period=autocorr["period"] or fft["period"], np=np)

    period = None
    method = ""
    intervals: list[float] = []
    peak_indices: list[int] = []
    if peak["period"] is not None:
        period = float(peak["period"])
        intervals = [float(value) for value in peak["intervals"]]
        peak_indices = [int(value) for value in peak["peaks"]]
        method = "角度峰值检测（经主周期校验）"
    elif autocorr["period"] is not None:
        period = float(autocorr["period"])
        method = "角度自相关分析"
    elif fft["period"] is not None:
        period = float(fft["period"])
        method = "角度频域分析（FFT）"
    else:
        raise TorsionAnalysisError("已提取到角度序列，但完整振荡次数不足，无法稳定计算周期。")

    kappa, kappa_source = _resolve_torsion_constant(
        torsion_constant=torsion_constant,
        calibration_inertia=calibration_inertia,
        calibration_period=calibration_period,
    )
    inertia = kappa * (period / (2 * math.pi)) ** 2 if kappa is not None else None
    stability = _build_stability_summary(intervals, period)
    angle_series = _downsample_angles(smoothed_points)
    detection_rate = len(points) / max(1, frame_index)
    if yolo_seg_hits and yolo_seg_hits >= max(yolo_hits, opencv_hits):
        resolved_detector = "yolo-seg"
    elif yolo_hits and (detector_mode == "yolov5" or yolo_hits >= opencv_hits):
        resolved_detector = "yolov5"
    else:
        resolved_detector = "opencv"
    if detector_mode == "yolov5" and not yolo_weights_path:
        detector_notes.append("使用通用 YOLOv5 权重只能作为演示；建议训练 torsion_marker/marker 自定义类别。")
    if detector_mode == "auto" and yolo_seg_model is None and yolo_model is not None and yolo_hits < opencv_hits:
        detector_notes.append("YOLOv5 命中不足，本次主要由传统视觉角度检测完成。")

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
                period=period,
                inertia=inertia,
                detector=resolved_detector,
                detector_requested=detector_mode,
                cv2=cv2,
                np=np,
            )
        except Exception as exc:  # pragma: no cover - depends on codecs.
            processed_video_error = str(exc)
            detector_notes.append(f"Processed video export failed: {exc}")

    result: dict[str, Any] = {
        "period_experimental": round(period, 4),
        "moment_inertia": round(inertia, 8) if inertia is not None else None,
        "torsion_constant": round(kappa, 8) if kappa is not None else None,
        "torsion_constant_source": kappa_source,
        "calibration_inertia": round(float(calibration_inertia), 8) if calibration_inertia is not None else None,
        "calibration_period": round(float(calibration_period), 4) if calibration_period is not None else None,
        "initial_angle_deg": round(float(initial_angle_deg), 4) if initial_angle_deg is not None else None,
        "angle_offset_deg": round(float(angle_offset_deg), 4),
        "angle_series": angle_series,
        "analysis": _build_analysis_text(
            period=period,
            inertia=inertia,
            kappa=kappa,
            kappa_source=kappa_source,
            method=method,
            initial_angle_deg=initial_angle_deg,
            angle_offset_deg=angle_offset_deg,
            fps=fps,
            detected_points=len(points),
            frame_count=frame_index,
            stability=stability,
        ),
        "advice": _build_advice_text(detection_rate=detection_rate, stability=stability, has_kappa=kappa is not None),
        "period_method": method,
        "period_peak": round(float(peak["period"]), 4) if peak["period"] is not None else None,
        "period_fft": round(float(fft["period"]), 4) if fft["period"] is not None else None,
        "period_autocorrelation": round(float(autocorr["period"]), 4) if autocorr["period"] is not None else None,
        "dominant_frequency_hz": round(float(fft["frequency"]), 5) if fft["frequency"] is not None else None,
        "autocorrelation_score": round(float(autocorr["score"]), 5) if autocorr["score"] is not None else None,
        "fps": round(fps, 3),
        "frame_count": int(frame_index),
        "detected_points": int(len(points)),
        "detection_rate": round(detection_rate, 4),
        "detector": resolved_detector,
        "detector_requested": detector_mode,
        "detector_hits": {"yolo_seg": int(yolo_seg_hits), "yolov5": int(yolo_hits), "opencv": int(opencv_hits)},
        "detector_model": (
            "yolo-seg-rod" if yolo_seg_model is not None
            else "yolov5-custom" if yolo_weights_path
            else "yolov5-pretrained" if yolo_model is not None
            else "opencv"
        ),
        "detector_notes": detector_notes,
        "processed_video_created": processed_video_created,
        "processed_video_error": processed_video_error,
        "frame_size": {"width": frame_width, "height": frame_height},
        "stability": stability,
    }
    return result


def analyze_torsion_frame(
    image_bytes: bytes,
    *,
    detector: str = "auto",
    last_angle_deg: float | None = None,
    yolo_weights: str | Path | None = None,
    yolo_confidence: float = 0.18,
    yolo_img_size: int = 640,
) -> dict[str, Any]:
    """Extract one torsion-pendulum angle sample from a still frame."""
    detector_mode = _normalize_detector(detector)
    if last_angle_deg is not None and not math.isfinite(float(last_angle_deg)):
        raise TorsionAnalysisError("上一帧角度必须是有效数值。")

    try:
        import cv2  # type: ignore
        import numpy as np  # type: ignore
    except Exception as exc:  # pragma: no cover - depends on local optional packages.
        raise TorsionDependencyError("实时扭摆分析需要 OpenCV 与 NumPy。请安装 opencv-python-headless 与 numpy 后重试。") from exc

    if not image_bytes:
        raise TorsionAnalysisError("实时分析帧为空。")
    buffer = np.frombuffer(image_bytes, dtype=np.uint8)
    frame = cv2.imdecode(buffer, cv2.IMREAD_COLOR)
    if frame is None:
        raise TorsionAnalysisError("无法解码实时图像帧。")

    last_angle = math.radians(float(last_angle_deg)) if last_angle_deg is not None else None
    detector_notes: list[str] = []
    angle = None
    confidence = 0.0
    method = ""
    geometry: dict[str, Any] = {}
    yolo_seg_hits = 0
    yolo_hits = 0
    opencv_hits = 0

    if detector_mode in {"auto", "yolo-seg"}:
        yolo_seg_weights_path = str(
            os.getenv("PHYSICS_AGENT_TORSION_YOLO_SEG_WEIGHTS", "") or DEFAULT_TORSION_YOLO_SEG_WEIGHTS
        ).strip()
        try:
            yolo_seg_model = _load_yolo_seg_model(yolo_seg_weights_path)
            angle, confidence, method, geometry = _detect_angle_yolo_seg(
                frame,
                model=yolo_seg_model,
                pivot=None,
                last_angle=last_angle,
                cv2=cv2,
                np=np,
            )
            if angle is not None:
                yolo_seg_hits += 1
        except Exception as exc:
            if detector_mode == "yolo-seg":
                raise TorsionDependencyError(f"YOLO-Seg 实时检测器加载失败：{exc}") from exc
            detector_notes.append(f"YOLO-Seg unavailable, fallback to YOLOv5/OpenCV: {exc}")

    if angle is None and detector_mode in {"auto", "yolov5"}:
        yolo_weights_path = str(
            yolo_weights
            or os.getenv("PHYSICS_AGENT_TORSION_YOLO_WEIGHTS", "")
            or os.getenv("PHYSICS_AGENT_PENDULUM_YOLO_WEIGHTS", "")
        ).strip()
        try:
            yolo_model, yolo_names = _load_yolov5_model(yolo_weights_path, confidence=yolo_confidence)
            angle, confidence, method, geometry = _detect_angle_yolov5(
                frame,
                model=yolo_model,
                names=yolo_names,
                last_angle=last_angle,
                img_size=yolo_img_size,
                cv2=cv2,
                np=np,
            )
            if angle is not None:
                yolo_hits += 1
        except Exception as exc:
            if detector_mode == "yolov5":
                raise TorsionDependencyError(f"YOLOv5 实时检测器加载失败：{exc}") from exc
            detector_notes.append(f"YOLOv5 unavailable, fallback to OpenCV: {exc}")

    if angle is None and detector_mode in {"auto", "opencv"}:
        angle, confidence, method, geometry = _detect_angle_opencv(
            frame,
            cv2=cv2,
            np=np,
            previous_gray=None,
            last_angle=last_angle,
        )
        if angle is not None:
            opencv_hits += 1

    if angle is None:
        raise TorsionAnalysisError("当前帧未能识别横杆或标记点。请增强红色/高对比标记，并保持相机稳定。")

    height, width = frame.shape[:2]
    resolved_detector = "yolo-seg" if yolo_seg_hits else ("yolov5" if yolo_hits else "opencv")
    return {
        "theta_rad": round(float(angle), 8),
        "theta_deg": round(math.degrees(float(angle)), 4),
        "confidence": round(float(confidence), 4),
        "method": method,
        "geometry": geometry,
        "detector": resolved_detector,
        "detector_requested": detector_mode,
        "detector_hits": {"yolo_seg": yolo_seg_hits, "yolov5": yolo_hits, "opencv": opencv_hits},
        "frame_width": int(width),
        "frame_height": int(height),
        "detector_notes": detector_notes,
    }


def format_torsion_report(result: dict[str, Any]) -> str:
    stability = result.get("stability") if isinstance(result.get("stability"), dict) else {}
    cv = stability.get("coefficient_variation_percent")
    cv_text = f"{cv:.2f}%" if isinstance(cv, (int, float)) else "样本不足"
    inertia = result.get("moment_inertia")
    inertia_text = _format_number(inertia, 8) if isinstance(inertia, (int, float)) else "未计算"
    lines = [
        "### 扭摆法测转动惯量结果",
        "",
        f"- 扭摆周期：{_format_number(result.get('period_experimental'), 4)} s",
        f"- 转动惯量：{inertia_text} kg·m^2",
        f"- 扭转常量：{_format_number(result.get('torsion_constant'), 8)} N·m/rad；来源：{result.get('torsion_constant_source') or '未给定'}",
        f"- 计算方法：{result.get('period_method') or '角度序列分析'}；周期稳定性：{cv_text}",
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
    if value in {"auto", "opencv", "yolov5", "yolo-seg"}:
        return value
    raise TorsionAnalysisError("检测器参数仅支持 auto、opencv、yolov5 或 yolo-seg。")


def _target_class_names() -> set[str]:
    raw = os.getenv("PHYSICS_AGENT_TORSION_YOLO_CLASSES", "").strip()
    if not raw:
        return DEFAULT_TORSION_YOLO_CLASS_NAMES
    return {item.strip().lower() for item in raw.split(",") if item.strip()}


def _load_yolo_seg_model(weights_path: str = "") -> Any:
    """Load an Ultralytics YOLO-Seg model (trained on the single 'rod' class)."""
    from ultralytics import YOLO  # type: ignore

    clean_weights = str(weights_path or "").strip()
    if not clean_weights:
        raise TorsionDependencyError("未配置 YOLO-Seg 权重路径 (PHYSICS_AGENT_TORSION_YOLO_SEG_WEIGHTS)。")
    resolved = Path(clean_weights)
    if not resolved.exists():
        raise TorsionDependencyError(f"YOLO-Seg 权重文件不存在：{resolved}")

    cache_key = str(resolved.resolve())
    cached = YOLO_SEG_MODEL_CACHE.get(cache_key)
    if cached is not None:
        return cached

    model = YOLO(str(resolved))
    YOLO_SEG_MODEL_CACHE[cache_key] = model
    return model


def _select_best_rod_mask(result: Any, *, min_area: float, np: Any) -> tuple[Any, float, float] | None:
    """Pick the highest-confidence 'rod' instance mask from one YOLO-Seg result frame."""
    if result.masks is None or result.boxes is None:
        return None
    masks_data = result.masks.data.cpu().numpy()
    confs = result.boxes.conf.cpu().numpy()
    classes = result.boxes.cls.cpu().numpy().astype(int)

    best_mask = None
    best_conf = -1.0
    best_area = 0.0
    for mask, conf, cls in zip(masks_data, confs, classes):
        if cls != 0:
            continue
        area = float(mask.sum())
        if area < min_area:
            continue
        if conf > best_conf:
            best_mask = (mask > 0.5).astype(np.uint8)
            best_conf = float(conf)
            best_area = area
    if best_mask is None:
        return None
    return best_mask, best_conf, best_area


def _pca_angle_from_mask(mask: Any, *, np: Any) -> tuple[float, tuple[float, float], tuple[float, float]]:
    """Principal-axis angle (radians, 180°-ambiguous) of a binary mask via PCA."""
    ys, xs = np.where(mask > 0)
    points = np.column_stack([xs, ys]).astype(float)
    center = points.mean(axis=0)
    centered = points - center
    cov = np.cov(centered.T)
    eigvals, eigvecs = np.linalg.eigh(cov)
    main_vec = eigvecs[:, np.argmax(eigvals)]
    theta = float(np.arctan2(main_vec[1], main_vec[0]))
    return theta, (float(center[0]), float(center[1])), (float(main_vec[0]), float(main_vec[1]))


def _detect_angle_yolo_seg(
    frame: Any,
    *,
    model: Any,
    pivot: tuple[float, float] | None,
    last_angle: float | None,
    min_mask_area: float = 40.0,
    cv2: Any,
    np: Any,
) -> tuple[float | None, float, str, dict[str, Any]]:
    """Detect the rod's orientation angle via YOLO-Seg mask + PCA main axis.

    The rod has 180° symmetry (a line has no "head"), so the raw PCA angle is
    disambiguated against last_angle the same way the OpenCV/YOLOv5 line
    detectors do (_unwrap_line_angle), keeping the angle series continuous.
    """
    height, width = frame.shape[:2]
    results = model(frame, verbose=False)
    selection = _select_best_rod_mask(results[0], min_area=min_mask_area, np=np)
    if selection is None:
        return None, 0.0, "", {}
    mask, confidence, area = selection

    mask_h, mask_w = mask.shape[:2]
    if (mask_h, mask_w) != (height, width):
        mask = cv2.resize(mask, (width, height), interpolation=cv2.INTER_NEAREST)

    if int(mask.sum()) < 3:
        return None, 0.0, "", {}

    theta, center, main_vec = _pca_angle_from_mask(mask, np=np)
    if last_angle is not None:
        theta = _unwrap_line_angle(theta, last_angle)

    half_len = max(mask.shape) * 0.5
    p1 = (center[0] - main_vec[0] * half_len, center[1] - main_vec[1] * half_len)
    p2 = (center[0] + main_vec[0] * half_len, center[1] + main_vec[1] * half_len)
    line = [p1[0], p1[1], p2[0], p2[1]]

    geometry: dict[str, Any] = {
        "line": line,
        "center": [center[0], center[1]],
        "mask_area": float(area),
    }
    if pivot is not None:
        geometry["pivot"] = [float(pivot[0]), float(pivot[1])]
        geometry["pivot_distance"] = round(_line_distance_to_point(line, pivot), 3)

    return theta, float(confidence), "yolo-seg-pca", geometry


def _detect_angle_yolov5(
    frame: Any,
    *,
    model: Any,
    names: dict[int, str],
    pivot: tuple[float, float] | None = None,
    last_angle: float | None,
    img_size: int,
    cv2: Any,
    np: Any,
) -> tuple[float | None, float, str, dict[str, Any]]:
    results = model(frame, size=img_size)
    predictions = results.xyxy[0]
    if hasattr(predictions, "detach"):
        predictions = predictions.detach().cpu().numpy()
    targets = _target_class_names()
    height, width = frame.shape[:2]
    pivot = pivot or _estimate_torsion_pivot(frame, cv2=cv2, np=np)
    marker_candidates: list[dict[str, Any]] = []
    rod_candidates: list[dict[str, Any]] = []
    for raw in predictions:
        x1, y1, x2, y2, confidence, class_id = [float(value) for value in raw[:6]]
        if confidence < 0.08:
            continue
        class_name = str(names.get(int(class_id), int(class_id))).lower()
        if class_name not in targets and targets:
            continue
        cx = (x1 + x2) / 2
        cy = (y1 + y2) / 2
        candidate = {
            "bbox": (float(x1), float(y1), float(x2), float(y2)),
            "center": (float(cx), float(cy)),
            "confidence": float(confidence),
            "class_name": class_name,
            "area": float(max(1.0, (x2 - x1) * (y2 - y1))),
        }
        if _is_rod_class(class_name):
            rod_candidates.append(candidate)
        else:
            marker_candidates.append(candidate)

    if rod_candidates:
        for candidate in sorted(rod_candidates, key=lambda item: item["confidence"] * item["area"], reverse=True):
            fit = _fit_rod_axis_in_bbox(frame, candidate["bbox"], pivot=pivot, last_angle=last_angle, cv2=cv2, np=np)
            if fit is None:
                continue
            angle, line, length = fit
            pivot_distance = _line_distance_to_point(line, pivot)
            if not _line_passes_pivot(line, pivot, width, height):
                continue
            return angle, float(candidate["confidence"]), "yolov5-rod-axis", {
                "line": line,
                "length": float(length),
                "bbox": list(candidate["bbox"]),
                "pivot": [float(pivot[0]), float(pivot[1])],
                "pivot_distance": round(float(pivot_distance), 3),
            }

    candidates = marker_candidates
    if not candidates:
        return None, 0.0, "", {}

    if len(candidates) >= 2:
        best_pair = None
        best_score = -1.0
        for index, first in enumerate(candidates):
            for second in candidates[index + 1:]:
                dx = second["center"][0] - first["center"][0]
                dy = second["center"][1] - first["center"][1]
                distance = math.hypot(dx, dy)
                score = distance * (first["confidence"] + second["confidence"]) / 2
                if score > best_score:
                    best_score = score
                    best_pair = (first, second, distance)
        if best_pair is None:
            return None, 0.0, "", {}
        first, second, distance = best_pair
        line = [*first["center"], *second["center"]]
        pivot_distance = _line_distance_to_point(line, pivot)
        if not _line_passes_pivot(line, pivot, width, height):
            return None, 0.0, "", {}
        angle = math.atan2(second["center"][1] - first["center"][1], second["center"][0] - first["center"][0])
        if last_angle is not None:
            angle = _unwrap_line_angle(angle, last_angle)
        confidence = min(1.0, max(0.05, (first["confidence"] + second["confidence"]) / 2))
        return angle, confidence, "yolov5-marker-pair", {
            "line": line,
            "length": float(distance),
            "pivot": [float(pivot[0]), float(pivot[1])],
            "pivot_distance": round(float(pivot_distance), 3),
        }

    candidate = max(candidates, key=lambda item: item["confidence"] * item["area"])
    angle = math.atan2(candidate["center"][1] - pivot[1], candidate["center"][0] - pivot[0])
    if last_angle is not None:
        angle = _unwrap_line_angle(angle, last_angle)
    return angle, float(candidate["confidence"]), "yolov5-marker", {
        "line": [pivot[0], pivot[1], *candidate["center"]],
        "length": float(math.hypot(candidate["center"][0] - pivot[0], candidate["center"][1] - pivot[1])),
    }


def _is_rod_class(class_name: str) -> bool:
    return class_name in {"torsion_rod", "rod", "bar", "beam", "lever", "pointer"}


def _fit_rod_axis_in_bbox(
    frame: Any,
    bbox: tuple[float, float, float, float],
    *,
    pivot: tuple[float, float],
    last_angle: float | None,
    cv2: Any,
    np: Any,
) -> tuple[float, list[float], float] | None:
    height, width = frame.shape[:2]
    x1, y1, x2, y2 = bbox
    pad = max(6, int(max(x2 - x1, y2 - y1) * 0.12))
    ix1 = max(0, int(math.floor(x1)) - pad)
    iy1 = max(0, int(math.floor(y1)) - pad)
    ix2 = min(width, int(math.ceil(x2)) + pad)
    iy2 = min(height, int(math.ceil(y2)) + pad)
    if ix2 - ix1 < 12 or iy2 - iy1 < 12:
        return None

    roi = frame[iy1:iy2, ix1:ix2]
    gray_raw = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    gray = cv2.GaussianBlur(gray_raw, (5, 5), 0)
    hsv = cv2.cvtColor(cv2.GaussianBlur(roi, (3, 3), 0), cv2.COLOR_BGR2HSV)
    metal_mask = cv2.inRange(hsv, np.array([0, 0, 95]), np.array([179, 105, 255]))
    kernel = np.ones((3, 3), dtype=np.uint8)
    metal_mask = cv2.morphologyEx(metal_mask, cv2.MORPH_OPEN, kernel, iterations=1)
    metal_mask = cv2.morphologyEx(metal_mask, cv2.MORPH_CLOSE, kernel, iterations=2)
    metal_edges = cv2.bitwise_and(cv2.Canny(gray, 28, 110), metal_mask)
    edges = cv2.Canny(gray, 35, 125)
    min_line = max(18, int(max(ix2 - ix1, iy2 - iy1) * 0.42))

    def pick_best_line(edge_image: Any, metal_weight: float) -> tuple[float, list[float], float] | None:
        lines = cv2.HoughLinesP(
            edge_image,
            1,
            math.pi / 180,
            threshold=max(12, min_line // 4),
            minLineLength=min_line,
            maxLineGap=max(10, int(min_line * 0.12)),
        )
        if lines is None:
            return None
        best = None
        best_score = -1.0
        for raw in lines.reshape((-1, 4)):
            lx1, ly1, lx2, ly2 = [float(value) for value in raw]
            dx = lx2 - lx1
            dy = ly2 - ly1
            length = math.hypot(dx, dy)
            if length <= 0:
                continue
            line = [lx1 + ix1, ly1 + iy1, lx2 + ix1, ly2 + iy1]
            if not _line_passes_pivot(line, pivot, width, height):
                continue
            angle = math.atan2(dy, dx)
            if last_angle is not None:
                angle = _unwrap_line_angle(angle, last_angle)
                continuity = 1.0 / (1.0 + abs(angle - last_angle))
            else:
                continuity = 1.0
            pivot_distance = _line_distance_to_point(line, pivot)
            metal_score = _line_metal_score(frame, line, cv2=cv2, np=np)
            score = length * (1.0 + continuity) * (0.5 + metal_weight * metal_score) / (
                1.0 + pivot_distance / max(width, height)
            )
            if score > best_score:
                best_score = score
                best = (angle, line, length)
        return best

    best = pick_best_line(metal_edges, metal_weight=3.0)
    if best is None:
        best = pick_best_line(edges, metal_weight=1.8)
    if best is not None:
        return best

    ys, xs = np.where(edges > 0)
    if len(xs) < 12:
        return None
    pts = np.column_stack([xs.astype(float), ys.astype(float)])
    mean = np.mean(pts, axis=0)
    centered = pts - mean
    _, _, vt = np.linalg.svd(centered, full_matrices=False)
    direction = vt[0]
    projections = centered @ direction
    p1 = mean + direction * float(np.min(projections))
    p2 = mean + direction * float(np.max(projections))
    angle = math.atan2(float(p2[1] - p1[1]), float(p2[0] - p1[0]))
    if last_angle is not None:
        angle = _unwrap_line_angle(angle, last_angle)
    line = [float(p1[0] + ix1), float(p1[1] + iy1), float(p2[0] + ix1), float(p2[1] + iy1)]
    length = math.hypot(line[2] - line[0], line[3] - line[1])
    if length < 12:
        return None
    if not _line_passes_pivot(line, pivot, width, height):
        return None
    return angle, line, length


def _detect_angle_opencv(
    frame: Any,
    *,
    cv2: Any,
    np: Any,
    previous_gray: Any,
    pivot: tuple[float, float] | None = None,
    last_angle: float | None,
) -> tuple[float | None, float, str, dict[str, Any]]:
    height, width = frame.shape[:2]
    scale = min(1.0, 760.0 / max(height, width))
    small = cv2.resize(frame, (int(width * scale), int(height * scale)), interpolation=cv2.INTER_AREA) if scale < 1.0 else frame
    small_h, small_w = small.shape[:2]
    gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
    gray = cv2.GaussianBlur(gray, (5, 5), 0)

    pivot_small = (pivot[0] * scale, pivot[1] * scale) if pivot is not None else _estimate_torsion_pivot(small, cv2=cv2, np=np)

    colored_rod = _detect_angle_from_colored_rod(small, scale=scale, pivot=pivot_small, last_angle=last_angle, cv2=cv2, np=np)
    if colored_rod[0] is not None:
        return colored_rod

    edges = cv2.Canny(gray, 45, 135)
    lines = cv2.HoughLinesP(
        edges,
        1,
        math.pi / 180,
        threshold=max(42, int(min(small_w, small_h) * 0.08)),
        minLineLength=max(45, int(min(small_w, small_h) * 0.22)),
        maxLineGap=max(8, int(min(small_w, small_h) * 0.035)),
    )
    line_candidates: list[dict[str, Any]] = []
    if lines is not None:
        lines_array = lines.reshape((-1, 4))
        for item in lines_array:
            x1, y1, x2, y2 = [float(value) for value in item]
            dx = x2 - x1
            dy = y2 - y1
            length = math.hypot(dx, dy)
            if length <= 0:
                continue
            line = [x1, y1, x2, y2]
            pivot_distance = _line_distance_to_point(line, pivot_small)
            if not _line_passes_pivot(line, pivot_small, small_w, small_h):
                continue
            midpoint = ((x1 + x2) / 2, (y1 + y2) / 2)
            center_distance = math.hypot(midpoint[0] - pivot_small[0], midpoint[1] - pivot_small[1])
            angle = math.atan2(dy, dx)
            if last_angle is not None:
                angle = _unwrap_line_angle(angle, last_angle)
                continuity = 1.0 / (1.0 + abs(angle - last_angle))
            else:
                continuity = 1.0
            metal_score = _line_metal_score(small, line, cv2=cv2, np=np)
            score = length * (1.0 + continuity) * (0.55 + 2.4 * metal_score) / (
                1.0 + pivot_distance / max(small_w, small_h) + 0.35 * center_distance / max(small_w, small_h)
            )
            line_candidates.append(
                {
                    "angle": angle,
                    "score": score,
                    "length": length / scale,
                    "line": [x1 / scale, y1 / scale, x2 / scale, y2 / scale],
                    "pivot": [pivot_small[0] / scale, pivot_small[1] / scale],
                    "pivot_distance": pivot_distance / scale,
                }
            )
    if line_candidates:
        best = max(line_candidates, key=lambda item: item["score"])
        confidence = min(1.0, max(0.08, best["length"] / max(width, height)))
        return float(best["angle"]), confidence, "opencv-line", {
            "line": best["line"],
            "length": float(best["length"]),
            "pivot_distance": round(float(best["pivot_distance"]), 3),
        }

    marker_angle = _detect_angle_from_colored_markers(small, scale=scale, pivot=pivot_small, last_angle=last_angle, cv2=cv2, np=np)
    if marker_angle[0] is not None:
        return marker_angle

    if previous_gray is not None:
        previous_small = cv2.resize(previous_gray, (small_w, small_h), interpolation=cv2.INTER_AREA) if scale < 1.0 else previous_gray
        diff = cv2.absdiff(gray, previous_small)
        _, diff_mask = cv2.threshold(diff, 18, 255, cv2.THRESH_BINARY)
        diff_mask = _clean_mask(diff_mask, cv2=cv2, np=np)
        return _angle_from_mask(diff_mask, scale=scale, pivot=pivot_small, last_angle=last_angle, cv2=cv2)

    return None, 0.0, "", {}


def _detect_angle_from_colored_markers(
    frame: Any,
    *,
    scale: float,
    pivot: tuple[float, float] | None,
    last_angle: float | None,
    cv2: Any,
    np: Any,
) -> tuple[float | None, float, str, dict[str, Any]]:
    hsv = cv2.cvtColor(cv2.GaussianBlur(frame, (5, 5), 0), cv2.COLOR_BGR2HSV)
    mask = cv2.inRange(hsv, np.array([0, 45, 42]), np.array([179, 255, 255]))
    mask = _clean_mask(mask, cv2=cv2, np=np)
    return _angle_from_mask(mask, scale=scale, pivot=pivot, last_angle=last_angle, cv2=cv2)


def _detect_angle_from_colored_rod(
    frame: Any,
    *,
    scale: float,
    pivot: tuple[float, float] | None,
    last_angle: float | None,
    cv2: Any,
    np: Any,
) -> tuple[float | None, float, str, dict[str, Any]]:
    hsv = cv2.cvtColor(cv2.GaussianBlur(frame, (3, 3), 0), cv2.COLOR_BGR2HSV)
    red_low = cv2.inRange(hsv, np.array([0, 55, 65]), np.array([14, 255, 255]))
    red_high = cv2.inRange(hsv, np.array([165, 55, 65]), np.array([179, 255, 255]))
    mask = cv2.bitwise_or(red_low, red_high)

    kernel = np.ones((3, 3), dtype=np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=1)
    mask = cv2.dilate(mask, kernel, iterations=1)

    ys, xs = np.where(mask > 0)
    if len(xs) < max(32, int(frame.shape[0] * frame.shape[1] * 0.0007)):
        return None, 0.0, "", {}

    pts = np.column_stack([xs.astype(float), ys.astype(float)])
    mean = np.mean(pts, axis=0)
    centered = pts - mean
    _, singular_values, vt = np.linalg.svd(centered, full_matrices=False)
    if len(singular_values) < 2 or singular_values[0] <= 1e-6:
        return None, 0.0, "", {}

    elongation = float(singular_values[0] / max(singular_values[1], 1e-6))
    if elongation < 3.0:
        return None, 0.0, "", {}

    direction = vt[0]
    projections = centered @ direction
    p1 = mean + direction * float(np.min(projections))
    p2 = mean + direction * float(np.max(projections))
    length = math.hypot(float(p2[0] - p1[0]), float(p2[1] - p1[1]))
    if length < max(36.0, min(frame.shape[:2]) * 0.18):
        return None, 0.0, "", {}
    raw_line = [float(p1[0]), float(p1[1]), float(p2[0]), float(p2[1])]
    pivot_point = pivot or (frame.shape[1] / 2, frame.shape[0] / 2)
    pivot_distance = _line_distance_to_point(raw_line, pivot_point)
    if not _line_passes_pivot(raw_line, pivot_point, frame.shape[1], frame.shape[0]):
        return None, 0.0, "", {}

    angle = math.atan2(float(p2[1] - p1[1]), float(p2[0] - p1[0]))
    if last_angle is not None:
        angle = _unwrap_line_angle(angle, last_angle)

    line = [float(p1[0] / scale), float(p1[1] / scale), float(p2[0] / scale), float(p2[1] / scale)]
    confidence = min(1.0, max(0.12, (length / max(frame.shape[:2])) * min(1.0, elongation / 8.0)))
    return angle, confidence, "opencv-red-rod", {
        "line": line,
        "length": float(length / scale),
        "mask_pixels": int(len(xs)),
        "elongation": round(elongation, 3),
        "pivot_distance": round(float(pivot_distance / scale), 3),
    }


def _angle_from_mask(
    mask: Any,
    *,
    scale: float,
    pivot: tuple[float, float] | None,
    last_angle: float | None,
    cv2: Any,
) -> tuple[float | None, float, str, dict[str, Any]]:
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    centers: list[tuple[float, float, float]] = []
    area_min = max(12.0, mask.shape[0] * mask.shape[1] * 0.00003)
    for contour in contours:
        area = float(cv2.contourArea(contour))
        if area < area_min:
            continue
        moments = cv2.moments(contour)
        if not moments["m00"]:
            continue
        centers.append((float(moments["m10"] / moments["m00"]), float(moments["m01"] / moments["m00"]), area))
    if len(centers) < 2:
        return None, 0.0, "", {}
    best_pair = None
    best_distance = 0.0
    for index, first in enumerate(centers):
        for second in centers[index + 1:]:
            distance = math.hypot(second[0] - first[0], second[1] - first[1])
            if distance > best_distance:
                best_distance = distance
                best_pair = (first, second)
    if best_pair is None or best_distance <= 0:
        return None, 0.0, "", {}
    first, second = best_pair
    angle = math.atan2(second[1] - first[1], second[0] - first[0])
    if last_angle is not None:
        angle = _unwrap_line_angle(angle, last_angle)
    line = [first[0] / scale, first[1] / scale, second[0] / scale, second[1] / scale]
    raw_line = [first[0], first[1], second[0], second[1]]
    pivot_point = pivot or (mask.shape[1] / 2, mask.shape[0] / 2)
    pivot_distance = _line_distance_to_point(raw_line, pivot_point)
    if not _line_passes_pivot(raw_line, pivot_point, mask.shape[1], mask.shape[0]):
        return None, 0.0, "", {}
    return angle, min(1.0, max(0.08, best_distance / max(mask.shape[:2]))), "opencv-marker-pair", {
        "line": line,
        "length": float(best_distance / scale),
        "pivot_distance": round(float(pivot_distance / scale), 3),
    }


def _clean_mask(mask: Any, *, cv2: Any, np: Any) -> Any:
    kernel = np.ones((5, 5), dtype=np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel, iterations=1)
    return cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=2)


def _estimate_video_torsion_pivot(capture: Any, *, frame_count: int, cv2: Any, np: Any) -> tuple[float, float] | None:
    width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
    height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
    if width <= 0 or height <= 0:
        return None
    total = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    available = max(1, min(frame_count, total or frame_count))
    window = min(available, 150)
    step = max(1, window // 30)
    samples: list[tuple[float, float]] = []
    for index in range(0, window, step):
        capture.set(cv2.CAP_PROP_POS_FRAMES, index)
        ok, frame = capture.read()
        if not ok or frame is None:
            continue
        pivot = _estimate_torsion_pivot(frame, cv2=cv2, np=np)
        if math.hypot(pivot[0] - width / 2.0, pivot[1] - height / 2.0) <= max(width, height) * 0.22:
            samples.append(pivot)
    if len(samples) < 3:
        return None

    xs = np.array([item[0] for item in samples], dtype=float)
    ys = np.array([item[1] for item in samples], dtype=float)
    median_x = float(np.median(xs))
    median_y = float(np.median(ys))
    distances = np.array([math.hypot(x - median_x, y - median_y) for x, y in samples], dtype=float)
    keep = distances <= max(38.0, float(np.percentile(distances, 70)) + 18.0)
    if int(np.sum(keep)) >= 3:
        xs = xs[keep]
        ys = ys[keep]
    return float(np.median(xs)), float(np.median(ys))


def _estimate_torsion_pivot(frame: Any, *, cv2: Any, np: Any) -> tuple[float, float]:
    height, width = frame.shape[:2]
    fallback = (float(width) / 2.0, float(height) / 2.0)
    if width < 40 or height < 40:
        return fallback

    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    blurred = cv2.medianBlur(gray, 5)
    min_radius = max(10, int(min(width, height) * 0.025))
    max_radius = max(min_radius + 4, int(min(width, height) * 0.085))
    circles = cv2.HoughCircles(
        blurred,
        cv2.HOUGH_GRADIENT,
        dp=1.2,
        minDist=max(24, int(min(width, height) * 0.05)),
        param1=90,
        param2=24,
        minRadius=min_radius,
        maxRadius=max_radius,
    )
    if circles is None:
        return fallback

    best: tuple[float, float] | None = None
    best_score = -1.0
    for raw_x, raw_y, raw_radius in circles[0]:
        x = float(raw_x)
        y = float(raw_y)
        radius = float(raw_radius)
        if not (0.0 <= x < width and 0.0 <= y < height):
            continue
        center_distance = math.hypot(x - fallback[0], y - fallback[1])
        if center_distance > max(width, height) * 0.28:
            continue
        x1 = max(0, int(round(x - radius)))
        y1 = max(0, int(round(y - radius)))
        x2 = min(width, int(round(x + radius + 1)))
        y2 = min(height, int(round(y + radius + 1)))
        roi = gray[y1:y2, x1:x2]
        mean_brightness = float(np.mean(roi)) if getattr(roi, "size", 0) else 0.0
        preferred_radius = min(width, height) * 0.045
        radius_score = 1.0 / (1.0 + abs(radius - preferred_radius) / max(6.0, preferred_radius))
        score = (0.7 + mean_brightness / 255.0) * radius_score / (1.0 + center_distance / max(80.0, min(width, height) * 0.18))
        if score > best_score:
            best_score = score
            best = (x, y)
    return best or fallback


def _line_metal_score(frame: Any, line: list[float], *, cv2: Any, np: Any) -> float:
    if len(line) != 4:
        return 0.0
    height, width = frame.shape[:2]
    x1, y1, x2, y2 = [float(value) for value in line]
    length = math.hypot(x2 - x1, y2 - y1)
    if length <= 1e-6:
        return 0.0

    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    sample_count = max(16, min(220, int(length / 4)))
    metal_hits = 0
    brightness_sum = 0.0
    saturation_sum = 0.0
    valid = 0
    for index in range(sample_count):
        ratio = index / max(1, sample_count - 1)
        x = int(round(x1 + (x2 - x1) * ratio))
        y = int(round(y1 + (y2 - y1) * ratio))
        if not (0 <= x < width and 0 <= y < height):
            continue
        value = float(gray[y, x])
        saturation = float(hsv[y, x, 1])
        brightness_sum += value
        saturation_sum += saturation
        valid += 1
        if value >= 105.0 and saturation <= 115.0:
            metal_hits += 1
    if valid <= 0:
        return 0.0
    metal_ratio = metal_hits / valid
    mean_brightness = brightness_sum / valid / 255.0
    low_saturation = 1.0 - min(1.0, (saturation_sum / valid) / 180.0)
    return max(0.0, min(1.0, 0.62 * metal_ratio + 0.23 * mean_brightness + 0.15 * low_saturation))


def _line_distance_to_image_center(line: list[float], width: int, height: int) -> float:
    return _line_distance_to_point(line, (float(width) / 2.0, float(height) / 2.0))


def _line_passes_image_center(line: list[float], width: int, height: int) -> bool:
    return _line_passes_point(line, (float(width) / 2.0, float(height) / 2.0), width, height)


def _line_passes_point(line: list[float], point: tuple[float, float], width: int, height: int) -> bool:
    distance = _line_distance_to_point(line, point)
    threshold = max(22.0, min(float(width), float(height)) * 0.085)
    return distance <= threshold


def _line_passes_pivot(line: list[float], pivot: tuple[float, float], width: int, height: int) -> bool:
    distance = _line_distance_to_point(line, pivot)
    threshold = max(16.0, min(float(width), float(height)) * 0.045)
    return distance <= threshold


def _line_distance_to_point(line: list[float], point: tuple[float, float]) -> float:
    if len(line) != 4:
        return float("inf")
    x1, y1, x2, y2 = [float(value) for value in line]
    px, py = point
    dx = x2 - x1
    dy = y2 - y1
    denom = math.hypot(dx, dy)
    if denom <= 1e-9:
        return float("inf")
    return abs(dy * px - dx * py + x2 * y1 - y2 * x1) / denom


def _unwrap_line_angle(angle: float, reference: float) -> float:
    candidates = [angle + k * math.pi for k in range(-4, 5)]
    return min(candidates, key=lambda value: abs(value - reference))


def _smooth_angle_points(points: list[dict[str, Any]], *, fps: float, np: Any) -> list[dict[str, Any]]:
    angles = np.unwrap(np.array([item["theta_rad"] for item in points], dtype=float), period=math.pi)
    window = max(3, int(round(fps * 0.18)))
    if window % 2 == 0:
        window += 1
    if len(angles) < window:
        smoothed = angles
    else:
        kernel = np.ones(window, dtype=float) / window
        padded = np.pad(angles, (window // 2, window // 2), mode="edge")
        smoothed = np.convolve(padded, kernel, mode="valid")
    return [
        {
            **item,
            "theta_unwrapped_rad": float(angles[index]),
            "theta_smooth_rad": float(smoothed[index]),
            "theta_smooth_deg": math.degrees(float(smoothed[index])),
        }
        for index, item in enumerate(points)
    ]


def _apply_initial_angle_offset(points: list[dict[str, Any]], initial_angle_deg: float) -> tuple[list[dict[str, Any]], float]:
    if not points:
        return points, 0.0
    first_angle = float(points[0].get("theta_smooth_deg", points[0].get("theta_deg", 0.0)))
    offset = float(initial_angle_deg) - first_angle
    adjusted: list[dict[str, Any]] = []
    for item in points:
        next_item = dict(item)
        next_item["theta_deg"] = float(next_item.get("theta_deg", 0.0)) + offset
        next_item["theta_smooth_deg"] = float(next_item.get("theta_smooth_deg", 0.0)) + offset
        next_item["theta_unwrapped_rad"] = float(next_item.get("theta_unwrapped_rad", 0.0)) + math.radians(offset)
        next_item["theta_smooth_rad"] = float(next_item.get("theta_smooth_rad", 0.0)) + math.radians(offset)
        adjusted.append(next_item)
    return adjusted, offset


def _estimate_torsion_peak_period(times: Any, values: Any, *, fps: float, reference_period: float | None, np: Any) -> dict[str, Any]:
    if len(times) < 10:
        return {"period": None, "intervals": [], "peaks": []}
    centered = values - float(np.nanmedian(values))
    amplitude = float(np.nanpercentile(centered, 95) - np.nanpercentile(centered, 5))
    if not math.isfinite(amplitude) or amplitude < 1.2:
        return {"period": None, "intervals": [], "peaks": []}
    min_distance_sec = max(0.45, min(2.5, (reference_period or 2.0) * 0.45))
    min_distance = max(4, int(min_distance_sec * fps))
    threshold = max(0.35, float(np.nanstd(centered)) * 0.18)
    maxima = _find_peaks(centered, threshold=threshold, min_distance=min_distance, np=np)
    minima = _find_peaks(-centered, threshold=threshold, min_distance=min_distance, np=np)
    intervals = _intervals(times, maxima) + _intervals(times, minima)
    intervals = [value for value in intervals if math.isfinite(value) and 0.35 <= value <= 20.0]
    if reference_period is not None and math.isfinite(reference_period) and reference_period > 0:
        intervals = [value for value in intervals if 0.62 * reference_period <= value <= 1.38 * reference_period] or []
    if not intervals:
        return {"period": None, "intervals": [], "peaks": sorted(maxima + minima)}
    return {"period": statistics.fmean(intervals), "intervals": intervals, "peaks": sorted(maxima + minima)}


def _find_peaks(values: Any, *, threshold: float, min_distance: int, np: Any) -> list[int]:
    candidates: list[tuple[int, float]] = []
    radius = max(2, min_distance // 2)
    for index in range(1, len(values) - 1):
        value = float(values[index])
        if value < threshold or value < float(values[index - 1]) or value <= float(values[index + 1]):
            continue
        left = max(0, index - radius)
        right = min(len(values), index + radius + 1)
        local_floor = max(float(np.min(values[left:index + 1])), float(np.min(values[index:right])))
        if value - local_floor >= threshold * 0.55:
            candidates.append((index, value))
    selected: list[tuple[int, float]] = []
    for index, value in sorted(candidates, key=lambda item: item[1], reverse=True):
        if all(abs(index - existing_index) >= min_distance for existing_index, _ in selected):
            selected.append((index, value))
    return sorted(index for index, _ in selected)


def _intervals(times: Any, indices: list[int]) -> list[float]:
    if len(indices) < 2:
        return []
    return [float(times[indices[index + 1]] - times[indices[index]]) for index in range(len(indices) - 1)]


def _resolve_torsion_constant(
    *,
    torsion_constant: float | None,
    calibration_inertia: float | None,
    calibration_period: float | None,
) -> tuple[float | None, str]:
    if torsion_constant is not None:
        return float(torsion_constant), "直接输入 κ"
    if calibration_inertia is not None and calibration_period is not None:
        return 4 * math.pi * math.pi * float(calibration_inertia) / (float(calibration_period) ** 2), "标定计算 κ = 4π²I0/T0²"
    return None, "未给定 κ"


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


def _downsample_angles(points: list[dict[str, Any]], *, max_points: int = 720) -> list[dict[str, Any]]:
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
            "theta_deg": round(float(item["theta_deg"]), 4),
            "theta_smooth_deg": round(float(item["theta_smooth_deg"]), 4),
            "confidence": round(float(item.get("confidence") or 0.0), 4),
            "method": item.get("method") or "",
        }
        for item in sampled
    ]


def _write_annotated_video(
    *,
    video_path: Path,
    output_path: Path,
    points: list[dict[str, Any]],
    fps: float,
    max_frames: int,
    period: float,
    inertia: float | None,
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
        with tempfile.NamedTemporaryFile(prefix="torsion_overlay_", suffix=suffix, delete=False) as handle:
            temp_video_path = Path(handle.name)
            handle.write(video_path.read_bytes())
        capture = cv2.VideoCapture(str(temp_video_path))
    if not capture.isOpened():
        if temp_video_path is not None:
            temp_video_path.unlink(missing_ok=True)
        raise TorsionAnalysisError("无法重新读取原视频以生成扭摆标注视频。")

    width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
    height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
    if width <= 0 or height <= 0:
        capture.release()
        if temp_video_path is not None:
            temp_video_path.unlink(missing_ok=True)
        raise TorsionAnalysisError("原视频尺寸异常，无法生成标注视频。")

    codec_candidates = ("VP80", "VP90") if output_path.suffix.lower() == ".webm" else ("mp4v", "avc1", "H264")
    writer = None
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
        raise TorsionAnalysisError("OpenCV 当前环境无法创建扭摆标注视频。")

    point_by_frame = {int(item["frame"]): item for item in points}
    frame_index = 0
    max_draw_frames = max(1, int(max_frames))
    while frame_index < max_draw_frames:
        ok, frame = capture.read()
        if not ok or frame is None:
            break
        point = point_by_frame.get(frame_index)
        if point:
            geom = point.get("geometry") if isinstance(point.get("geometry"), dict) else {}
            line = geom.get("line") if isinstance(geom, dict) else None
            if isinstance(line, list) and len(line) == 4:
                p1 = (int(round(float(line[0]))), int(round(float(line[1]))))
                p2 = (int(round(float(line[2]))), int(round(float(line[3]))))
                cv2.line(frame, p1, p2, (86, 214, 190), 4, lineType=cv2.LINE_AA)
                cv2.circle(frame, p1, 7, (22, 104, 95), -1, lineType=cv2.LINE_AA)
                cv2.circle(frame, p2, 7, (22, 104, 95), -1, lineType=cv2.LINE_AA)
            cv2.putText(
                frame,
                f"theta={float(point.get('theta_smooth_deg', point.get('theta_deg', 0.0))):.2f} deg",
                (18, max(96, height - 28)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.62,
                (235, 255, 250),
                2,
                lineType=cv2.LINE_AA,
            )

        overlay = frame.copy()
        cv2.rectangle(overlay, (0, 0), (min(width, 680), 84), (8, 16, 28), -1)
        frame = cv2.addWeighted(overlay, 0.52, frame, 0.48, 0)
        cv2.putText(
            frame,
            f"Torsion detection: requested={detector_requested} resolved={detector}",
            (18, 32),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.62,
            (235, 246, 255),
            2,
            lineType=cv2.LINE_AA,
        )
        inertia_text = f"I={inertia:.6g} kg*m^2" if inertia is not None else "I=requires kappa"
        cv2.putText(
            frame,
            f"T={period:.4f}s  {inertia_text}  frame={frame_index + 1}/{max_draw_frames}",
            (18, 64),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.62,
            (72, 211, 190),
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


def _build_analysis_text(
    *,
    period: float,
    inertia: float | None,
    kappa: float | None,
    kappa_source: str,
    method: str,
    initial_angle_deg: float | None,
    angle_offset_deg: float,
    fps: float,
    detected_points: int,
    frame_count: int,
    stability: dict[str, Any],
) -> str:
    stability_level = stability.get("level") or "样本不足"
    cv = stability.get("coefficient_variation_percent")
    cv_clause = f"，周期变异系数约为 {cv:.2f}%" if isinstance(cv, (int, float)) else ""
    if inertia is None or kappa is None:
        inertia_clause = "尚未输入扭转常量 κ 或标定数据，因此本次只给出扭摆周期；输入 κ 后可由 I = κT²/(4π²) 计算转动惯量。"
    else:
        inertia_clause = f"由 {kappa_source} 得到 κ = {kappa:.6g} N·m/rad，代入 I = κT²/(4π²)，转动惯量 I = {inertia:.8g} kg·m²。"
    angle_clause = (
        f"角度序列已按输入初始角 θ0 = {initial_angle_deg:.2f}° 校准，整体角度偏移 {angle_offset_deg:.2f}°；"
        if initial_angle_deg is not None
        else ""
    )
    return (
        f"系统从视频中识别到 {detected_points}/{frame_count} 帧的扭摆角度，使用 {method} 得到周期 "
        f"T = {period:.4f} s。{angle_clause}{inertia_clause}"
        f"从相邻周期样本看，本次测量稳定性为“{stability_level}”{cv_clause}。"
        f"扭摆法的关键是小角度、低阻尼与稳定悬丝；若角度曲线出现跳变，应优先检查 YOLO 是否稳定检测到杆子或固定标记点。"
    )


def _build_advice_text(*, detection_rate: float, stability: dict[str, Any], has_kappa: bool) -> str:
    suggestions = [
        "建议优先训练 YOLO 检测横杆，类别命名为 torsion_rod；系统会在 YOLO 框内拟合杆轴角度来计算周期。",
        "若杆子本身不易识别，可在横杆两端贴高对比标记点，并训练 torsion_marker 或 marker 类别作为备选。",
        "初始扭转角不宜过大，保持悬丝弹性回复近似线性，避免摆架平动或上下晃动。",
        "建议记录 5 个以上完整周期，并用同一组标记点连续追踪，避免手部、支架和背景边缘被误识别。",
    ]
    if not has_kappa:
        suggestions.append("若要计算转动惯量，请输入扭转常量 κ；也可用已知转动惯量 I0 与其周期 T0 标定 κ。")
    if detection_rate < 0.55:
        suggestions.append("角度检测覆盖率偏低，建议增大标记点面积、提高照明或裁剪画面。")
    if (stability.get("coefficient_variation_percent") or 0) > 5:
        suggestions.append("周期样本波动较大，可能存在释放时推力、空气阻尼较强或检测角度跳变，应重新录制。")
    return "\n".join(f"{index + 1}. {item}" for index, item in enumerate(suggestions))


def _format_number(value: Any, digits: int) -> str:
    if isinstance(value, (int, float)) and math.isfinite(float(value)):
        return f"{float(value):.{digits}f}"
    return "--"
