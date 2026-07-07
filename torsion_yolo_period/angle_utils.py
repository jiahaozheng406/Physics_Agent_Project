"""
angle_utils.py
Utilities for extracting and smoothing rod orientation angles from YOLO masks.
"""
from __future__ import annotations

import logging
from typing import Optional

import numpy as np

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# PCA-based angle extraction
# ---------------------------------------------------------------------------

def pca_angle_from_mask(mask: np.ndarray) -> tuple[float, np.ndarray, np.ndarray]:
    """
    Compute the principal-axis angle of a binary mask using PCA.

    Returns
    -------
    theta : float
        Angle in radians in (-pi/2, pi/2].  Rod direction is ambiguous by 180°;
        the caller must unwrap with unwrap_rod_angle().
    center : ndarray shape (2,)
        (cx, cy) centroid in pixel coordinates.
    main_vec : ndarray shape (2,)
        Unit vector along the principal axis.
    """
    ys, xs = np.where(mask > 0)
    if len(xs) < 3:
        raise ValueError("Mask too sparse for PCA (< 3 pixels)")

    points = np.column_stack([xs, ys]).astype(float)
    center = points.mean(axis=0)
    pts_c = points - center

    cov = np.cov(pts_c.T)
    eigvals, eigvecs = np.linalg.eigh(cov)
    main_vec = eigvecs[:, np.argmax(eigvals)]

    theta = np.arctan2(main_vec[1], main_vec[0])
    return float(theta), center, main_vec


def normalize_angle(theta: float) -> float:
    """Wrap angle to (-pi/2, pi/2] — rod has 180° symmetry."""
    while theta > np.pi / 2:
        theta -= np.pi
    while theta <= -np.pi / 2:
        theta += np.pi
    return theta


# ---------------------------------------------------------------------------
# Angle unwrapping (handles 180° ambiguity)
# ---------------------------------------------------------------------------

def unwrap_rod_angle(theta_array: np.ndarray) -> np.ndarray:
    """
    Unwrap a sequence of rod angles that have 180° symmetry.

    Standard np.unwrap would treat π as the period, but rods look the same
    after 180° rotation so we double the angle, unwrap normally, then halve.

    Parameters
    ----------
    theta_array : array of raw angles in (-pi/2, pi/2]

    Returns
    -------
    Continuous angle array (no pi-jumps).
    """
    doubled = 2.0 * np.asarray(theta_array, dtype=float)
    unwrapped_doubled = np.unwrap(doubled)
    return unwrapped_doubled / 2.0


# ---------------------------------------------------------------------------
# Smoothing
# ---------------------------------------------------------------------------

def smooth_angle(
    theta_array: np.ndarray,
    method: str = "savgol",
    window: int = 11,
    polyorder: int = 3,
) -> np.ndarray:
    """
    Smooth a continuous angle sequence.

    Parameters
    ----------
    theta_array : 1-D array of unwrapped angles.
    method      : "savgol" (preferred) or "moving_avg".
    window      : Savitzky-Golay window length (must be odd, >= polyorder+1).
    polyorder   : Savitzky-Golay polynomial order.

    Returns
    -------
    Smoothed angle array, same length as input.
    """
    arr = np.asarray(theta_array, dtype=float)
    n = len(arr)

    if n < 4:
        return arr.copy()

    if method == "savgol":
        try:
            from scipy.signal import savgol_filter

            # Ensure window is odd and not larger than the data
            w = min(window, n if n % 2 == 1 else n - 1)
            w = max(w, polyorder + 1 if (polyorder + 1) % 2 == 1 else polyorder + 2)
            if w % 2 == 0:
                w += 1
            p = min(polyorder, w - 1)
            return savgol_filter(arr, window_length=w, polyorder=p)
        except ImportError:
            logger.warning("scipy not available, falling back to moving average")
            method = "moving_avg"

    if method == "moving_avg":
        k = min(window, n)
        if k % 2 == 0:
            k = max(1, k - 1)
        pad = k // 2
        padded = np.pad(arr, pad, mode="edge")
        kernel = np.ones(k) / k
        return np.convolve(padded, kernel, mode="valid")[:n]

    raise ValueError(f"Unknown smooth method: {method!r}")


# ---------------------------------------------------------------------------
# Gap interpolation
# ---------------------------------------------------------------------------

def interpolate_gaps(
    theta_array: np.ndarray,
    valid_mask: np.ndarray,
    max_gap: int = 10,
) -> np.ndarray:
    """
    Linearly interpolate short gaps in a theta sequence.

    Parameters
    ----------
    theta_array : angle array (NaN at failed frames).
    valid_mask  : bool array, True where detection succeeded.
    max_gap     : gaps longer than this are left as NaN.

    Returns
    -------
    Array with short gaps filled; long gaps remain NaN.
    """
    result = theta_array.copy().astype(float)
    n = len(result)
    i = 0
    while i < n:
        if not valid_mask[i]:
            # find end of gap
            j = i
            while j < n and not valid_mask[j]:
                j += 1
            gap_len = j - i
            if gap_len <= max_gap and i > 0 and j < n:
                # linear interpolation
                t0, t1 = result[i - 1], result[j]
                for k in range(gap_len):
                    result[i + k] = t0 + (t1 - t0) * (k + 1) / (gap_len + 1)
            i = j
        else:
            i += 1
    return result
