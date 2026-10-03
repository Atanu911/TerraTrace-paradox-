"""Detection Module — threshold, morphology, connected components, polygons."""
import cv2
import numpy as np
from typing import List, Tuple
import logging

logger = logging.getLogger(__name__)


def detect_changes(
    heatmap: np.ndarray,
    threshold: float = 0.3,
    min_area_px: int = 50,
    valid_mask: np.ndarray = None
) -> Tuple[List[dict], np.ndarray]:
    """
    Detect changed regions from the combined heatmap.
    
    Args:
        heatmap: float32 [0, 1] change heatmap
        threshold: minimum change intensity to consider
        min_area_px: minimum region area in pixels
        valid_mask: optional mask of valid pixels
        
    Returns:
        Tuple of (regions, visualization)
        regions: list of dicts with polygon, bbox, area, centroid, intensity
        visualization: BGR overlay image showing detected regions
    """
    # 1. Threshold
    binary = (heatmap > threshold).astype(np.uint8) * 255
    
    # Apply valid mask
    if valid_mask is not None:
        binary = cv2.bitwise_and(binary, valid_mask)
    
    # 2. Morphological operations
    # Close small gaps
    kernel_close = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
    binary = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel_close)
    
    # Remove small noise
    kernel_open = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    binary = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel_open)
    
    # 3. Find contours (connected components)
    contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    # 4. Extract regions
    regions = []
    h, w = heatmap.shape
    
    for i, contour in enumerate(contours):
        area = cv2.contourArea(contour)
        
        if area < min_area_px:
            continue
        
        # Bounding box
        x, y, bw, bh = cv2.boundingRect(contour)
        
        # Centroid
        M = cv2.moments(contour)
        if M["m00"] > 0:
            cx = int(M["m10"] / M["m00"])
            cy = int(M["m01"] / M["m00"])
        else:
            cx = x + bw // 2
            cy = y + bh // 2
        
        # Simplify polygon for storage (reduce point count)
        epsilon = 0.02 * cv2.arcLength(contour, True)
        simplified = cv2.approxPolyDP(contour, epsilon, True)
        
        # Compute mean change intensity within the contour
        mask = np.zeros((h, w), dtype=np.uint8)
        cv2.drawContours(mask, [contour], -1, 255, -1)
        mean_intensity = float(cv2.mean(heatmap, mask=mask)[0])
        
        # Extract polygon points as list of [x, y]
        polygon_points = simplified.reshape(-1, 2).tolist()
        
        regions.append({
            "id": i,
            "polygon": polygon_points,
            "bbox": [int(x), int(y), int(x + bw), int(y + bh)],
            "area_pixels": int(area),
            "centroid": [int(cx), int(cy)],
            "mean_intensity": round(mean_intensity, 4),
            "contour": contour  # Keep original for visualization
        })
    
    # Sort by area (largest first)
    regions.sort(key=lambda r: r["area_pixels"], reverse=True)
    
    # 5. Create visualization
    vis = create_detection_overlay(heatmap, regions)
    
    logger.info(f"Detected {len(regions)} changed regions (min area={min_area_px}px)")
    
    return regions, vis


def create_detection_overlay(
    heatmap: np.ndarray,
    regions: List[dict]
) -> np.ndarray:
    """Create a visualization overlay showing detected regions."""
    h, w = heatmap.shape
    
    # Create base from heatmap
    heatmap_uint8 = (heatmap * 255).astype(np.uint8)
    vis = cv2.applyColorMap(heatmap_uint8, cv2.COLORMAP_JET)
    
    # Blend with a dark background
    dark = np.zeros((h, w, 3), dtype=np.uint8)
    vis = cv2.addWeighted(vis, 0.6, dark, 0.4, 0)
    
    # Draw regions
    colors = {
        0: (34, 197, 94),    # Green - default
        1: (45, 45, 255),    # Red - alert
        2: (1, 179, 245),    # Yellow/gold - mining
        3: (255, 92, 124),   # Violet
    }
    
    for i, region in enumerate(regions):
        color = colors.get(i % len(colors), (34, 197, 94))
        contour = region.get("contour")
        
        if contour is not None:
            # Draw filled polygon with transparency
            overlay = vis.copy()
            cv2.drawContours(overlay, [contour], -1, color, -1)
            vis = cv2.addWeighted(overlay, 0.3, vis, 0.7, 0)
            
            # Draw contour outline
            cv2.drawContours(vis, [contour], -1, color, 2)
            
            # Draw bbox
            bbox = region["bbox"]
            cv2.rectangle(vis, (bbox[0], bbox[1]), (bbox[2], bbox[3]), color, 1)
            
            # Label
            cx, cy = region["centroid"]
            label = f"R{i+1}: {region['area_pixels']}px"
            cv2.putText(vis, label, (cx - 30, cy - 10),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 255), 1)
    
    return vis
