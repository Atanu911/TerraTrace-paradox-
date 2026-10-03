"""Image Alignment Module — ORB/SIFT + RANSAC with ECC fallback."""
import cv2
import numpy as np
from typing import Tuple, Optional
import logging

logger = logging.getLogger(__name__)


def align_images(
    old_image: np.ndarray,
    new_image: np.ndarray,
    method: str = "orb",
    min_matches: int = 10
) -> Tuple[np.ndarray, float, dict]:
    """
    Align new_image to old_image coordinate space.
    
    Args:
        old_image: Reference image (BGR)
        new_image: Image to warp (BGR)
        method: 'orb' or 'ecc'
        min_matches: Minimum feature matches for ORB method
        
    Returns:
        Tuple of (aligned_image, quality_score, metadata)
    """
    old_gray = cv2.cvtColor(old_image, cv2.COLOR_BGR2GRAY)
    new_gray = cv2.cvtColor(new_image, cv2.COLOR_BGR2GRAY)
    
    # Resize new to match old dimensions if different
    if old_image.shape[:2] != new_image.shape[:2]:
        new_image = cv2.resize(new_image, (old_image.shape[1], old_image.shape[0]))
        new_gray = cv2.cvtColor(new_image, cv2.COLOR_BGR2GRAY)
    
    if method == "orb":
        aligned, quality, meta = _align_orb(old_gray, new_gray, new_image, min_matches)
        if quality < 0.3:
            logger.warning(f"ORB alignment quality low ({quality:.2f}), falling back to ECC")
            aligned, quality, meta = _align_ecc(old_gray, new_gray, new_image)
            meta["fallback"] = True
    else:
        aligned, quality, meta = _align_ecc(old_gray, new_gray, new_image)
    
    return aligned, quality, meta


def _align_orb(
    old_gray: np.ndarray,
    new_gray: np.ndarray,
    new_color: np.ndarray,
    min_matches: int = 10
) -> Tuple[np.ndarray, float, dict]:
    """Align using ORB feature matching + RANSAC homography."""
    # Detect ORB features
    orb = cv2.ORB_create(nfeatures=5000)
    kp1, des1 = orb.detectAndCompute(old_gray, None)
    kp2, des2 = orb.detectAndCompute(new_gray, None)
    
    if des1 is None or des2 is None or len(kp1) < 4 or len(kp2) < 4:
        logger.warning("Not enough keypoints for ORB alignment")
        return new_color.copy(), 0.0, {"method": "orb", "matches": 0, "inliers": 0}
    
    # Match features
    bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=False)
    matches = bf.knnMatch(des1, des2, k=2)
    
    # Apply Lowe's ratio test
    good_matches = []
    for match_pair in matches:
        if len(match_pair) == 2:
            m, n = match_pair
            if m.distance < 0.75 * n.distance:
                good_matches.append(m)
    
    if len(good_matches) < min_matches:
        logger.warning(f"Only {len(good_matches)} good matches (need {min_matches})")
        return new_color.copy(), 0.0, {
            "method": "orb", "matches": len(good_matches), "inliers": 0
        }
    
    # Find homography with RANSAC
    src_pts = np.float32([kp2[m.trainIdx].pt for m in good_matches]).reshape(-1, 1, 2)
    dst_pts = np.float32([kp1[m.queryIdx].pt for m in good_matches]).reshape(-1, 1, 2)
    
    H, mask = cv2.findHomography(src_pts, dst_pts, cv2.RANSAC, 5.0)
    
    if H is None:
        logger.warning("Homography estimation failed")
        return new_color.copy(), 0.0, {
            "method": "orb", "matches": len(good_matches), "inliers": 0
        }
    
    inlier_count = int(mask.sum()) if mask is not None else 0
    quality = inlier_count / len(good_matches) if good_matches else 0.0
    
    # Warp new image to old coordinate space
    h, w = old_gray.shape
    aligned = cv2.warpPerspective(new_color, H, (w, h))
    
    return aligned, quality, {
        "method": "orb",
        "total_keypoints_old": len(kp1),
        "total_keypoints_new": len(kp2),
        "matches": len(good_matches),
        "inliers": inlier_count,
        "homography": H.tolist()
    }


def _align_ecc(
    old_gray: np.ndarray,
    new_gray: np.ndarray,
    new_color: np.ndarray
) -> Tuple[np.ndarray, float, dict]:
    """Align using Enhanced Correlation Coefficient (ECC)."""
    # Define the motion model (euclidean for rotation+translation)
    warp_mode = cv2.MOTION_EUCLIDEAN
    warp_matrix = np.eye(2, 3, dtype=np.float32)
    
    # Specify the number of iterations and termination criteria
    criteria = (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 1000, 1e-6)
    
    try:
        cc, warp_matrix = cv2.findTransformECC(
            old_gray, new_gray, warp_matrix, warp_mode, criteria
        )
        quality = float(cc)
    except cv2.error as e:
        logger.warning(f"ECC alignment failed: {e}")
        return new_color.copy(), 0.0, {"method": "ecc", "error": str(e)}
    
    # Warp the new image
    h, w = old_gray.shape
    aligned = cv2.warpAffine(
        new_color, warp_matrix, (w, h),
        flags=cv2.INTER_LINEAR + cv2.WARP_INVERSE_MAP
    )
    
    return aligned, quality, {
        "method": "ecc",
        "correlation_coefficient": quality,
        "warp_matrix": warp_matrix.tolist()
    }
