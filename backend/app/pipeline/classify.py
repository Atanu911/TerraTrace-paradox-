"""Classification Module — heuristic feature-based + CNN plug-in interface."""
import cv2
import numpy as np
from typing import Tuple, Optional
from abc import ABC, abstractmethod
import logging
import os
from functools import lru_cache
from ..config import settings

logger = logging.getLogger(__name__)


# ── Classifier Interface ──────────────────────────────────

class ClassifierBase(ABC):
    """Base interface for change-type classifiers."""
    
    @abstractmethod
    def predict(self, region_image: np.ndarray, context: dict = None) -> Tuple[str, float]:
        """
        Classify a region image.
        
        Args:
            region_image: BGR crop of the changed region from the NEW image
            context: optional dict with additional features (veg_change, diff_intensity, etc.)
            
        Returns:
            Tuple of (class_name, confidence)
            class_name: one of 'Construction', 'Deforestation', 'Mining', 'Other'
            confidence: 0-100
        """
        pass


# ── Heuristic Classifier ──────────────────────────────────

class HeuristicClassifier(ClassifierBase):
    """
    Feature-based heuristic classifier.
    
    NOTE: This uses hand-crafted features (vegetation loss, soil color, edge density,
    shape regularity, texture) to classify changes. It is NOT a trained model.
    Classification accuracy depends on image quality and change type.
    
    For production accuracy, use a trained CNN via the MODEL_PATH environment variable.
    """
    
    CLASSES = ["Construction", "Deforestation", "Mining", "Other"]
    
    def predict(self, region_image: np.ndarray, context: dict = None) -> Tuple[str, float]:
        if region_image.size == 0 or region_image.shape[0] < 5 or region_image.shape[1] < 5:
            return "Other", 30.0
        
        context = context or {}
        
        # Extract features
        features = self._extract_features(region_image, context)
        
        # Score each class
        scores = {
            "Construction": self._score_construction(features),
            "Deforestation": self._score_deforestation(features),
            "Mining": self._score_mining(features),
            "Other": 25.0  # Base score for Other
        }
        
        # Pick the highest-scoring class
        best_class = max(scores, key=scores.get)
        confidence = min(scores[best_class], 98.0)  # Cap at 98% for honesty
        
        # If the best score is too low, default to Other
        if confidence < 35:
            return "Other", confidence
        
        return best_class, round(confidence, 1)
    
    def _extract_features(self, image: np.ndarray, context: dict) -> dict:
        """Extract hand-crafted features from a region image."""
        hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        b, g, r = cv2.split(image.astype(np.float32))
        
        h, s, v = cv2.split(hsv)
        
        # 1. Vegetation measure (Excess Green)
        total = r + g + b + 1.0
        exgreen = (2.0 * g - r - b) / total
        veg_ratio = float(np.mean(exgreen > 0.05))
        
        # 2. Brown/bare soil ratio (hue in brown range, low-medium saturation)
        brown_mask = (
            ((h > 8) & (h < 30)) &  # Brown hue range
            (s > 30) & (s < 180) &
            (v > 50) & (v < 200)
        )
        bare_soil_ratio = float(brown_mask.sum()) / brown_mask.size
        
        # 3. Edge density (Canny)
        edges = cv2.Canny(gray, 50, 150)
        edge_density = float(edges.sum() / 255) / edges.size
        
        # 4. Shape regularity (using contours and bounding box fill ratio)
        _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        regularity = 0.0
        if contours:
            largest = max(contours, key=cv2.contourArea)
            area = cv2.contourArea(largest)
            x, y, w, h_box = cv2.boundingRect(largest)
            bbox_area = w * h_box
            if bbox_area > 0:
                regularity = area / bbox_area  # 1.0 = perfectly rectangular
        
        # 5. Texture variance (Laplacian)
        laplacian = cv2.Laplacian(gray, cv2.CV_64F)
        texture_var = float(laplacian.var())
        
        # 6. Gray/concrete color ratio
        gray_mask = (s < 40) & (v > 80) & (v < 220)
        gray_ratio = float(gray_mask.sum()) / gray_mask.size
        
        # 7. Context-based features
        veg_loss = abs(context.get("veg_change", 0))
        diff_intensity = context.get("diff_intensity", 0.5)
        
        return {
            "veg_ratio": veg_ratio,
            "bare_soil_ratio": bare_soil_ratio,
            "edge_density": edge_density,
            "regularity": regularity,
            "texture_var": texture_var,
            "gray_ratio": gray_ratio,
            "veg_loss": veg_loss,
            "diff_intensity": diff_intensity,
        }
    
    def _score_construction(self, f: dict) -> float:
        """Score likelihood of construction."""
        score = 30.0
        
        # High edge density (buildings have sharp edges)
        if f["edge_density"] > 0.15:
            score += 20
        elif f["edge_density"] > 0.08:
            score += 10
        
        # Regular shapes (buildings are rectangular)
        if f["regularity"] > 0.6:
            score += 15
        
        # Gray/concrete surfaces
        if f["gray_ratio"] > 0.2:
            score += 15
        
        # High texture (built environment)
        if f["texture_var"] > 500:
            score += 10
        
        # Moderate vegetation loss
        if f["veg_loss"] > 0.1:
            score += 5
        
        return min(score, 95)
    
    def _score_deforestation(self, f: dict) -> float:
        """Score likelihood of deforestation."""
        score = 20.0
        
        # Low vegetation in the changed area
        if f["veg_ratio"] < 0.2:
            score += 15
        
        # High vegetation loss from context
        if f["veg_loss"] > 0.3:
            score += 25
        elif f["veg_loss"] > 0.15:
            score += 15
        
        # High bare soil
        if f["bare_soil_ratio"] > 0.3:
            score += 15
        elif f["bare_soil_ratio"] > 0.15:
            score += 8
        
        # Low edge density (cleared land is smooth)
        if f["edge_density"] < 0.08:
            score += 10
        
        # Irregular shapes
        if f["regularity"] < 0.5:
            score += 5
        
        return min(score, 95)
    
    def _score_mining(self, f: dict) -> float:
        """Score likelihood of mining activity."""
        score = 20.0
        
        # Very high bare soil (open pits)
        if f["bare_soil_ratio"] > 0.4:
            score += 25
        elif f["bare_soil_ratio"] > 0.25:
            score += 15
        
        # Low vegetation
        if f["veg_ratio"] < 0.15:
            score += 10
        
        # Medium edge density
        if 0.05 < f["edge_density"] < 0.15:
            score += 10
        
        # Medium regularity
        if 0.3 < f["regularity"] < 0.7:
            score += 10
        
        # High texture variation (disturbed land)
        if f["texture_var"] > 300:
            score += 10
        
        return min(score, 95)


# ── CNN Classifier (plug-in) ──────────────────────────────

class CNNClassifier(ClassifierBase):
    """
    CNN-based classifier using a trained PyTorch model.
    
    Set MODEL_PATH environment variable to the path of a trained model
    (e.g., ResNet18 fine-tuned on EuroSAT or similar dataset).
    
    Expected model interface:
    - Input: 224x224 RGB tensor, normalized with ImageNet stats
    - Output: 4-class logits [Construction, Deforestation, Mining, Other]
    """
    
    CLASSES = ["Construction", "Deforestation", "Mining", "Other"]
    
    def __init__(self, model_path: str):
        self.model = None
        self.model_path = model_path
        self._load_model()
    
    def _load_model(self):
        try:
            import torch
            self.model = torch.load(self.model_path, map_location="cpu")
            self.model.eval()
            logger.info(f"Loaded CNN classifier from {self.model_path}")
        except Exception as e:
            logger.error(f"Failed to load CNN model: {e}")
            self.model = None
    
    def predict(self, region_image: np.ndarray, context: dict = None) -> Tuple[str, float]:
        if self.model is None:
            logger.warning("CNN model not loaded, falling back to heuristic")
            return HeuristicClassifier().predict(region_image, context)
        
        try:
            import torch
            from torchvision import transforms
            
            # Preprocess
            transform = transforms.Compose([
                transforms.ToPILImage(),
                transforms.Resize((224, 224)),
                transforms.ToTensor(),
                transforms.Normalize(
                    mean=[0.485, 0.456, 0.406],
                    std=[0.229, 0.224, 0.225]
                ),
            ])
            
            # Convert BGR to RGB
            rgb = cv2.cvtColor(region_image, cv2.COLOR_BGR2RGB)
            tensor = transform(rgb).unsqueeze(0)
            
            with torch.no_grad():
                logits = self.model(tensor)
                probs = torch.softmax(logits, dim=1)[0]
                
            idx = int(probs.argmax())
            confidence = float(probs[idx]) * 100
            
            return self.CLASSES[idx], round(confidence, 1)
            
        except Exception as e:
            logger.error(f"CNN prediction failed: {e}")
            return HeuristicClassifier().predict(region_image, context)


# ── Factory ───────────────────────────────────────────────

@lru_cache(maxsize=2)
def _classifier_for_path(model_path: str) -> ClassifierBase:
    if model_path and os.path.isfile(model_path):
        logger.info("Using CNN classifier configured by MODEL_PATH")
        return CNNClassifier(model_path)
    logger.info("Using heuristic classifier (no usable MODEL_PATH configured)")
    return HeuristicClassifier()


def get_classifier() -> ClassifierBase:
    """Get the appropriate classifier based on configuration."""
    # Use the same environment-backed settings object as the rest of the app and
    # load a model once instead of reloading its weights for every analysis.
    model_path = settings.MODEL_PATH or os.environ.get("MODEL_PATH", "")
    return _classifier_for_path(model_path)


def classify_regions(
    regions: list,
    new_image: np.ndarray,
    old_image: np.ndarray,
    heatmap: np.ndarray,
    veg_change: np.ndarray = None
) -> list:
    """
    Classify all detected regions.
    
    Args:
        regions: list of region dicts from detect module
        new_image: the aligned new image (BGR)
        old_image: the old image (BGR)
        heatmap: change heatmap
        veg_change: vegetation change map (optional)
        
    Returns:
        regions with added 'change_type' and 'confidence' fields
    """
    classifier = get_classifier()
    
    for region in regions:
        bbox = region["bbox"]
        x1, y1, x2, y2 = bbox
        
        # Crop region from new image
        crop = new_image[y1:y2, x1:x2].copy()
        
        # Build context
        context = {
            "diff_intensity": region.get("mean_intensity", 0.5),
        }
        
        # Add vegetation change context if available
        if veg_change is not None:
            region_veg = veg_change[y1:y2, x1:x2]
            context["veg_change"] = float(np.mean(region_veg))
        
        # Classify
        change_type, confidence = classifier.predict(crop, context)
        region["change_type"] = change_type
        region["confidence"] = confidence
    
    return regions
