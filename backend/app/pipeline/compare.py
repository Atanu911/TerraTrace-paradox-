"""Image Comparison Module — SSIM, pixel diff, vegetation index."""
import cv2
import numpy as np
from typing import Tuple, Optional
import logging

logger = logging.getLogger(__name__)


def compare_images(
    old_image: np.ndarray,
    new_image: np.ndarray,
    valid_mask: Optional[np.ndarray] = None,
    ssim_window: int = 7
) -> Tuple[np.ndarray, np.ndarray, dict]:
    """
    Multi-signal comparison between old and new images.
    
    Returns:
        Tuple of (combined_heatmap, colored_heatmap, metadata)
        combined_heatmap: float32 [0, 1] where 1 = maximum change
        colored_heatmap: BGR uint8 visualization
    """
    meta = {}
    
    old_gray = cv2.cvtColor(old_image, cv2.COLOR_BGR2GRAY).astype(np.float32)
    new_gray = cv2.cvtColor(new_image, cv2.COLOR_BGR2GRAY).astype(np.float32)
    
    # 1. SSIM-based change map
    ssim_map = compute_ssim_map(old_gray, new_gray, ssim_window)
    ssim_change = 1.0 - ssim_map  # Invert: high value = more change
    meta["mean_ssim"] = round(float(ssim_map.mean()), 4)
    
    # 2. Absolute pixel difference
    pixel_diff = compute_pixel_diff(old_gray, new_gray)
    meta["mean_pixel_diff"] = round(float(pixel_diff.mean()), 4)
    
    # 3. Vegetation index change
    veg_change = compute_vegetation_change(old_image, new_image)
    meta["mean_veg_change"] = round(float(np.abs(veg_change).mean()), 4)
    
    # 4. Combine signals (weighted fusion)
    combined = (
        0.4 * ssim_change +
        0.35 * pixel_diff +
        0.25 * np.abs(veg_change)
    )
    
    # Apply valid mask if provided
    if valid_mask is not None:
        mask_float = valid_mask.astype(np.float32) / 255.0
        combined = combined * mask_float
    
    # Normalize to [0, 1]
    if combined.max() > 0:
        combined = combined / combined.max()
    
    # Create colored heatmap for visualization
    heatmap_uint8 = (combined * 255).astype(np.uint8)
    colored_heatmap = cv2.applyColorMap(heatmap_uint8, cv2.COLORMAP_JET)
    
    meta["max_change"] = round(float(combined.max()), 4)
    
    return combined, colored_heatmap, meta


def compute_ssim_map(
    old_gray: np.ndarray,
    new_gray: np.ndarray,
    window_size: int = 7
) -> np.ndarray:
    """
    Compute per-pixel SSIM map between two grayscale images.
    
    Uses the standard SSIM formula with Gaussian weighting.
    Returns float32 map in [0, 1] where 1 = identical.
    """
    C1 = (0.01 * 255) ** 2
    C2 = (0.03 * 255) ** 2
    
    # Gaussian blur for local statistics
    ksize = (window_size, window_size)
    sigma = 1.5
    
    mu1 = cv2.GaussianBlur(old_gray, ksize, sigma)
    mu2 = cv2.GaussianBlur(new_gray, ksize, sigma)
    
    mu1_sq = mu1 ** 2
    mu2_sq = mu2 ** 2
    mu1_mu2 = mu1 * mu2
    
    sigma1_sq = cv2.GaussianBlur(old_gray ** 2, ksize, sigma) - mu1_sq
    sigma2_sq = cv2.GaussianBlur(new_gray ** 2, ksize, sigma) - mu2_sq
    sigma12 = cv2.GaussianBlur(old_gray * new_gray, ksize, sigma) - mu1_mu2
    
    numerator = (2 * mu1_mu2 + C1) * (2 * sigma12 + C2)
    denominator = (mu1_sq + mu2_sq + C1) * (sigma1_sq + sigma2_sq + C2)
    
    ssim_map = numerator / (denominator + 1e-10)
    ssim_map = np.clip(ssim_map, 0, 1)
    
    return ssim_map


def compute_pixel_diff(
    old_gray: np.ndarray,
    new_gray: np.ndarray
) -> np.ndarray:
    """Compute normalized absolute pixel difference."""
    diff = np.abs(old_gray - new_gray)
    if diff.max() > 0:
        diff = diff / diff.max()
    return diff


def compute_vegetation_change(
    old_image: np.ndarray,
    new_image: np.ndarray
) -> np.ndarray:
    """
    Compute Excess Green Index change between two images.
    
    ExGreen = (2*G - R - B) / (R + G + B + 1)
    Positive ExGreen = vegetation; negative change = vegetation loss.
    
    This is a standard remote sensing index that works with RGB.
    For multispectral images with NIR band, use NDVI instead.
    """
    old_exgreen = _excess_green(old_image)
    new_exgreen = _excess_green(new_image)
    
    # Change: negative = vegetation loss, positive = vegetation gain
    change = new_exgreen - old_exgreen
    
    # Normalize to [-1, 1]
    max_abs = max(abs(change.min()), abs(change.max()), 1e-10)
    change = change / max_abs
    
    return change


def _excess_green(image: np.ndarray) -> np.ndarray:
    """Compute Excess Green Index for an RGB image."""
    b, g, r = cv2.split(image.astype(np.float32))
    total = r + g + b + 1.0  # Add 1 to avoid division by zero
    exgreen = (2.0 * g - r - b) / total
    return exgreen
