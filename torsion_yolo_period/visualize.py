"""
visualize.py
Publication-quality plots and markdown reports for torsion period analysis.
"""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional, TYPE_CHECKING

import numpy as np

if TYPE_CHECKING:
    from period_estimator import PeriodResult

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Matplotlib Chinese font setup
# ---------------------------------------------------------------------------

def _setup_matplotlib() -> None:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    import matplotlib.font_manager as fm

    # Try common CJK fonts on Windows / Linux / macOS
    cjk_candidates = [
        "Microsoft YaHei", "SimHei", "SimSun",
        "PingFang SC", "Hiragino Sans GB",
        "WenQuanYi Micro Hei", "Noto Sans CJK SC",
    ]
    available = {f.name for f in fm.fontManager.ttflist}
    chosen = next((f for f in cjk_candidates if f in available), None)
    if chosen:
        matplotlib.rcParams["font.family"] = chosen
    else:
        logger.debug("No CJK font found; Chinese labels may not render correctly")

    matplotlib.rcParams["axes.unicode_minus"] = False


# ---------------------------------------------------------------------------
# Angle + period plot
# ---------------------------------------------------------------------------

def save_angle_plot(
    times: np.ndarray,
    theta_unwrapped: np.ndarray,
    theta_smooth: np.ndarray,
    period_result: "PeriodResult",
    out_path: Path,
    video_name: str = "",
) -> None:
    """
    Save a two-panel figure:
      Top   — raw unwrapped angle + smoothed angle with annotated crossings/peaks
      Bottom— smoothed angle with period arrows
    """
    _setup_matplotlib()
    import matplotlib.pyplot as plt
    import matplotlib.patches as mpatches

    fig, axes = plt.subplots(2, 1, figsize=(12, 8), sharex=True)
    fig.suptitle(f"扭摆角度—时间曲线  |  {video_name}", fontsize=13)

    valid = np.isfinite(theta_unwrapped)
    t_v = times[valid]
    raw_v = theta_unwrapped[valid]
    smooth_v = theta_smooth[valid] if np.any(np.isfinite(theta_smooth)) else raw_v

    # --- top panel: raw + smooth ---
    ax0 = axes[0]
    ax0.plot(t_v, np.degrees(raw_v), color="#aaaaaa", lw=0.8, label="原始角度")
    ax0.plot(t_v, np.degrees(smooth_v), color="#1f77b4", lw=1.5, label="平滑角度")
    ax0.set_ylabel("摆杆角度 θ / °")
    ax0.legend(loc="upper right", fontsize=9)
    ax0.grid(True, alpha=0.3)

    # mark zero-crossings
    for tc in period_result.zero_crossing_times[:20]:
        ax0.axvline(tc, color="#e74c3c", lw=0.7, alpha=0.6)

    # mark peaks
    if period_result.peak_times:
        peak_arr = np.array(period_result.peak_times)
        # find y values by nearest-time lookup
        peak_y = []
        for pt in peak_arr[:20]:
            idx = np.argmin(np.abs(t_v - pt))
            peak_y.append(np.degrees(smooth_v[idx]))
        ax0.scatter(peak_arr[:20], peak_y, color="#e67e22", s=40, zorder=5, label="峰值点")
        ax0.legend(loc="upper right", fontsize=9)

    # --- bottom panel: smooth + period annotation ---
    ax1 = axes[1]
    ax1.plot(t_v, np.degrees(smooth_v), color="#1f77b4", lw=1.8)
    ax1.set_xlabel("时间 / s")
    ax1.set_ylabel("摆杆角度 θ / °")
    ax1.grid(True, alpha=0.3)

    # draw period double-arrows between consecutive zero-crossings
    zc = period_result.zero_crossing_times
    if len(zc) >= 2:
        y_arrow = float(np.degrees(np.nanmax(smooth_v))) * 0.85
        for i in range(min(3, len(zc) - 1)):
            t0, t1 = zc[i], zc[i + 1]
            T_shown = t1 - t0
            mid = (t0 + t1) / 2
            ax1.annotate(
                "", xy=(t1, y_arrow), xytext=(t0, y_arrow),
                arrowprops=dict(arrowstyle="<->", color="#e74c3c", lw=1.5)
            )
            ax1.text(mid, y_arrow * 1.05,
                     f"T={T_shown:.3f}s", ha="center", fontsize=8, color="#e74c3c")

    # result text box
    T = period_result.T_final
    method = period_result.method_used
    std = period_result.std_period
    if T is not None:
        info = (
            f"T_final = {T:.4f} s\n"
            f"方法: {method}\n"
            f"标准差: {std:.4f} s" if std else f"T_final = {T:.4f} s\n方法: {method}"
        )
        ax1.text(
            0.01, 0.97, info,
            transform=ax1.transAxes,
            va="top", ha="left", fontsize=9,
            bbox=dict(boxstyle="round,pad=0.4", facecolor="#f0f4ff", alpha=0.8),
        )

    plt.tight_layout()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    plt.savefig(str(out_path), dpi=150, bbox_inches="tight")
    plt.close(fig)
    logger.info("Plot saved: %s", out_path)


# ---------------------------------------------------------------------------
# Markdown report
# ---------------------------------------------------------------------------

def save_report(
    video_path: Path,
    fps: float,
    total_frames: int,
    valid_frames: int,
    period_result: "PeriodResult",
    out_path: Path,
) -> None:
    """Write a Markdown experiment report."""

    T = period_result.T_final
    lines = [
        f"# 扭摆周期自动测量报告",
        "",
        f"## 视频信息",
        f"| 项目 | 值 |",
        f"|------|-----|",
        f"| 文件名 | `{video_path.name}` |",
        f"| 帧率 (fps) | {fps:.2f} |",
        f"| 总帧数 | {total_frames} |",
        f"| 有效检测帧 | {valid_frames} |",
        f"| 检测率 | {valid_frames/max(total_frames,1)*100:.1f}% |",
        "",
        f"## 周期估计结果",
        f"| 方法 | T (s) |",
        f"|------|-------|",
    ]

    if period_result.T_zero_crossing is not None:
        lines.append(f"| 同向过零法 | {period_result.T_zero_crossing:.4f} |")
    if period_result.T_peak is not None:
        lines.append(f"| 峰值法 | {period_result.T_peak:.4f} |")
    if period_result.T_fitting is not None:
        lines.append(f"| 阻尼正弦拟合 | {period_result.T_fitting:.4f} |")

    lines += [""]
    if T is not None:
        std_str = f" ± {period_result.std_period:.4f}" if period_result.std_period else ""
        lines += [
            f"**最终周期 T = {T:.4f}{std_str} s**  ",
            f"使用方法: {period_result.method_used}  ",
            f"有效周期数: {period_result.valid_period_count}",
        ]
    else:
        lines.append("**周期估计失败，请检查检测质量或视频内容。**")

    if period_result.notes:
        lines += ["", "## 异常说明"]
        for note in period_result.notes:
            lines.append(f"- {note}")

    lines += [
        "",
        "## 方法说明",
        "本模块采用 **YOLO-Seg 实例分割** 检测杆子区域，",
        "通过 **PCA 主方向分析** 提取每帧角度 θ，",
        "经过 **Savitzky-Golay 平滑** 后用 **同向过零法** 估计扭摆周期 T。",
        "核心思路：YOLO 负责视觉检测，物理算法负责周期计算，保证可解释性。",
    ]

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text("\n".join(lines), encoding="utf-8")
    logger.info("Report saved: %s", out_path)
