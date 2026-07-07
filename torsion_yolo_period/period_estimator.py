"""
period_estimator.py
Three independent methods for estimating the torsion pendulum period T from
a smoothed angle-vs-time sequence: zero-crossing, peak-finding, damped-sine fit.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Optional

import numpy as np

logger = logging.getLogger(__name__)


@dataclass
class PeriodResult:
    T_zero_crossing: Optional[float] = None
    T_peak: Optional[float] = None
    T_fitting: Optional[float] = None
    T_final: Optional[float] = None
    std_period: Optional[float] = None
    valid_period_count: int = 0
    method_used: str = "none"
    fit_params: dict = field(default_factory=dict)
    zero_crossing_times: list = field(default_factory=list)
    peak_times: list = field(default_factory=list)
    notes: list = field(default_factory=list)


# ---------------------------------------------------------------------------
# Zero-crossing method
# ---------------------------------------------------------------------------

def _zero_crossing_period(
    times: np.ndarray,
    theta: np.ndarray,
    min_period: float = 0.3,
    max_period: float = 20.0,
) -> tuple[Optional[float], Optional[float], list, int]:
    """Return (T_mean, T_std, crossing_times, count)."""
    equilibrium = float(np.median(theta))
    x = theta - equilibrium

    # find upward zero-crossings (negative → positive) via linear interpolation
    crossings = []
    for i in range(len(x) - 1):
        if x[i] < 0 and x[i + 1] >= 0:
            # linear interpolation for sub-frame precision
            frac = -x[i] / (x[i + 1] - x[i])
            t_cross = times[i] + frac * (times[i + 1] - times[i])
            crossings.append(float(t_cross))

    if len(crossings) < 2:
        return None, None, crossings, 0

    diffs = np.diff(crossings)
    diffs = diffs[(diffs >= min_period) & (diffs <= max_period)]

    if len(diffs) == 0:
        return None, None, crossings, 0

    return float(np.mean(diffs)), float(np.std(diffs)), crossings, int(len(diffs))


# ---------------------------------------------------------------------------
# Peak-finding method
# ---------------------------------------------------------------------------

def _peak_period(
    times: np.ndarray,
    theta: np.ndarray,
    min_period: float = 0.3,
    max_period: float = 20.0,
) -> tuple[Optional[float], Optional[float], list, int]:
    """Return (T_mean, T_std, peak_times, count)."""
    try:
        from scipy.signal import find_peaks
        # require minimum prominence to avoid noise peaks
        prominence = (np.max(theta) - np.min(theta)) * 0.15
        peaks, _ = find_peaks(theta, prominence=prominence)
    except ImportError:
        # manual local-max fallback
        peaks = []
        for i in range(1, len(theta) - 1):
            if theta[i] > theta[i - 1] and theta[i] > theta[i + 1]:
                peaks.append(i)
        peaks = np.array(peaks)

    if len(peaks) < 2:
        return None, None, [], 0

    peak_times = times[peaks].tolist()
    diffs = np.diff(times[peaks])
    diffs = diffs[(diffs >= min_period) & (diffs <= max_period)]

    if len(diffs) == 0:
        return None, None, peak_times, 0

    return float(np.mean(diffs)), float(np.std(diffs)), peak_times, int(len(diffs))


# ---------------------------------------------------------------------------
# Damped sine fit
# ---------------------------------------------------------------------------

def _fit_damped_sine(
    times: np.ndarray,
    theta: np.ndarray,
    T_guess: float,
) -> tuple[Optional[float], dict]:
    """
    Fit  θ(t) = θ0 + A·exp(-λ·t)·cos(2π·t/T + φ)
    Returns (T_fit, params_dict).  Returns (None, {}) on failure.
    """
    try:
        from scipy.optimize import curve_fit

        def model(t, theta0, A, lam, T, phi):
            return theta0 + A * np.exp(-lam * t) * np.cos(2 * np.pi * t / T + phi)

        amp_guess = (np.max(theta) - np.min(theta)) / 2.0
        p0 = [np.mean(theta), amp_guess, 0.05, T_guess, 0.0]
        bounds = (
            [-np.inf, 0,     0,   T_guess * 0.3, -np.pi],
            [ np.inf, np.inf, 5.0, T_guess * 3.0,  np.pi],
        )

        popt, _ = curve_fit(
            model, times, theta, p0=p0, bounds=bounds,
            maxfev=5000, ftol=1e-6
        )
        theta0, A, lam, T_fit, phi = popt
        params = dict(theta0=theta0, A=A, lambda_=lam, T=T_fit, phi=phi)
        return float(T_fit), params

    except Exception as e:
        logger.debug("Damped sine fit failed: %s", e)
        return None, {}


# ---------------------------------------------------------------------------
# Main estimator
# ---------------------------------------------------------------------------

def estimate_period(
    times: np.ndarray,
    theta_smooth: np.ndarray,
    min_period: float = 0.3,
    max_period: float = 20.0,
    primary_method: str = "zero_crossing",
) -> PeriodResult:
    """
    Estimate torsion pendulum period from a smooth θ(t) sequence.

    Parameters
    ----------
    times         : 1-D array of frame timestamps in seconds.
    theta_smooth  : 1-D array of smoothed, unwrapped angles in radians.
    min_period    : lower bound for plausible period (seconds).
    max_period    : upper bound for plausible period (seconds).
    primary_method: "zero_crossing" | "peak" | "fit".

    Returns
    -------
    PeriodResult dataclass with all estimates and diagnostics.
    """
    times = np.asarray(times, dtype=float)
    theta = np.asarray(theta_smooth, dtype=float)

    # drop NaN frames
    valid = np.isfinite(theta)
    times = times[valid]
    theta = theta[valid]

    if len(times) < 10:
        result = PeriodResult()
        result.notes.append("Too few valid frames for period estimation")
        return result

    result = PeriodResult()

    # --- zero-crossing ---
    T_zc, std_zc, zc_times, n_zc = _zero_crossing_period(
        times, theta, min_period, max_period
    )
    result.T_zero_crossing = T_zc
    result.zero_crossing_times = zc_times
    if T_zc is not None:
        logger.info("[period] zero-crossing T = %.4f s (n=%d, std=%.4f)", T_zc, n_zc, std_zc or 0)

    # --- peak ---
    T_pk, std_pk, pk_times, n_pk = _peak_period(
        times, theta, min_period, max_period
    )
    result.T_peak = T_pk
    result.peak_times = pk_times
    if T_pk is not None:
        logger.info("[period] peak T = %.4f s (n=%d, std=%.4f)", T_pk, n_pk, std_pk or 0)

    # --- choose T_guess for fit ---
    T_guess = T_zc or T_pk
    if T_guess is None:
        # rough FFT estimate as last resort
        dt = np.median(np.diff(times))
        freqs = np.fft.rfftfreq(len(theta), d=dt)
        power = np.abs(np.fft.rfft(theta - np.mean(theta))) ** 2
        idx = np.argmax(power[1:]) + 1
        if freqs[idx] > 0:
            T_guess = 1.0 / freqs[idx]

    # --- damped sine fit ---
    if T_guess is not None:
        T_fit, fit_params = _fit_damped_sine(times, theta, T_guess)
        result.T_fitting = T_fit
        result.fit_params = fit_params
        if T_fit is not None:
            logger.info("[period] damped-fit T = %.4f s", T_fit)

    # --- select final T ---
    candidates = []
    if T_zc is not None:
        candidates.append((T_zc, std_zc or 0.0, n_zc, "zero_crossing"))
    if T_pk is not None:
        candidates.append((T_pk, std_pk or 0.0, n_pk, "peak"))
    if result.T_fitting is not None:
        candidates.append((result.T_fitting, 0.0, 1, "fitting"))

    if not candidates:
        result.notes.append("All period estimation methods failed")
        return result

    # prefer primary_method; fall back in order
    priority = {"zero_crossing": 0, "peak": 1, "fitting": 2}
    candidates.sort(key=lambda c: priority.get(c[3], 9))

    # filter to primary method if available
    primary = [c for c in candidates if c[3] == primary_method]
    chosen = primary[0] if primary else candidates[0]

    result.T_final = chosen[0]
    result.std_period = chosen[1]
    result.valid_period_count = chosen[2]
    result.method_used = chosen[3]

    logger.info(
        "[period] FINAL T = %.4f s ± %.4f (method=%s, n=%d)",
        result.T_final, result.std_period or 0, result.method_used, result.valid_period_count
    )
    return result
