"""Image Preprocessing — histogram matching, cloud masking, noise cleanup."""
import cv2
import numpy as np
from typing import Tuple, Optional
import logging

logger = logging.getLogger(__name__)


def preprocess_images(
    old_image: np.ndarray,
    new_image: np.ndarray
) -> Tuple[np.ndarray, np.ndarray, np.ndarray, dict]:
    """
    Preprocess image pair for change detection.
    
    Returns:
        Tuple of (processed_old, processed_new, valid_mask, metadata)
        valid_mask: binary mask where both images are valid (no clouds/shadows)
    """
    meta = {}
    
    # 1. Histogram matching — normalize illumination
    new_matched = match_histograms(new_image, old_image)
    meta["histogram_matched"] = True
    
    # 2. Cloud & shadow masking
    cloud_mask_old = detect_clouds_shadows(old_image)
    cloud_mask_new = detect_clouds_shadows(new_matched)
    
    # Valid pixels = no clouds in either image
    valid_mask = cv2.bitwise_and(
        cv2.bitwise_not(cloud_mask_old),
        cv2.bitwise_not(cloud_mask_new)
    )
    
    cloud_pct_old = (cloud_mask_old.sum() / 255) / cloud_mask_old.size * 100
    cloud_pct_new = (cloud_mask_new.sum() / 255) / cloud_mask_new.size * 100
    meta["cloud_pct_old"] = round(cloud_pct_old, 1)
    meta["cloud_pct_new"] = round(cloud_pct_new, 1)
    
    # 3. Mild denoising
    old_denoised = cv2.GaussianBlur(old_image, (3, 3), 0.5)
    new_denoised = cv2.GaussianBlur(new_matched, (3, 3), 0.5)
    
    return old_denoised, new_denoised, valid_mask, meta


def match_histograms(source: np.ndarray, reference: np.ndarray) -> np.ndarray:
    """
    Match the histogram of source to reference, channel by channel.
    Simple implementation without scikit-image dependency for core path.
    """
    result = np.zeros_like(source)
    
    for c in range(3):
        src_channel = source[:, :, c]
        ref_channel = reference[:, :, c]
        
        # Compute CDFs
        src_hist, _ = np.histogram(src_channel.flatten(), 256, [0, 256])
        ref_hist, _ = np.histogram(ref_channel.flatten(), 256, [0, 256])
        
        src_cdf = src_hist.cumsum()
        ref_cdf = ref_hist.cumsum()
        
        # Normalize CDFs
        src_cdf = src_cdf / src_cdf[-1] if src_cdf[-1] > 0 else src_cdf
        ref_cdf = ref_cdf / ref_cdf[-1] if ref_cdf[-1] > 0 else ref_cdf
        
        # Create mapping
        mapping = np.zeros(256, dtype=np.uint8)
        for i in range(256):
            diff = np.abs(ref_cdf - src_cdf[i])
            mapping[i] = np.argmin(diff)
        
        result[:, :, c] = mapping[src_channel]
    
    return result


def detect_clouds_shadows(image: np.ndarray, 
                          bright_thresh: int = 230,
                          dark_thresh: int = 30,
                          sat_thresh: int = 30) -> np.ndarray:
    """
    Simple heuristic cloud & shadow detection.
    
    Clouds: high brightness + low saturation + low texture
    Shadows: very low brightness
    
    NOTE: This is a heuristic, not a trained model. Accuracy varies
    with image type and conditions.
    
    Returns:
        Binary mask (255 = cloud/shadow, 0 = valid)
    """
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    h, s, v = cv2.split(hsv)
    
    # Texture measure (Laplacian variance)
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    laplacian = cv2.Laplacian(gray, cv2.CV_64F)
    
    # Compute local texture (variance in 15x15 windows)
    kernel_size = 15
    local_mean = cv2.blur(laplacian, (kernel_size, kernel_size))
    local_sq_mean = cv2.blur(laplacian ** 2, (kernel_size, kernel_size))
    local_var = np.abs(local_sq_mean - local_mean ** 2)
    
    # Cloud mask: bright + low saturation + low texture
    cloud_mask = (
        (v > bright_thresh) &
        (s < sat_thresh) &
        (local_var < 50)
    ).astype(np.uint8) * 255
    
    # Shadow mask: very dark
    shadow_mask = (v < dark_thresh).astype(np.uint8) * 255
    
    # Combine
    combined = cv2.bitwise_or(cloud_mask, shadow_mask)
    
    # Clean up with morphology
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (11, 11))
    combined = cv2.morphologyEx(combined, cv2.MORPH_CLOSE, kernel)
    combined = cv2.morphologyEx(combined, cv2.MORPH_OPEN, kernel)
    
    return combined
