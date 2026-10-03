"""Analysis Orchestrator — runs the 5-step change forensics pipeline."""
import os
import cv2
import json
import asyncio
from datetime import datetime, timezone
from sqlmodel import Session, select
import numpy as np
import logging

from ..config import settings
from ..db import engine
from ..models import Scan, Detection, Report, Alert, Location
from ..pipeline.align import align_images
from ..pipeline.preprocess import preprocess_images
from ..pipeline.compare import compare_images
from ..pipeline.detect import detect_changes
from ..pipeline.classify import classify_regions
from ..services.gis import build_geojson, calculate_area_hectares
from ..services.report import generate_pdf_report
from ..ws.manager import manager

logger = logging.getLogger(__name__)

def safe_imread(path: str):
    if not os.path.exists(path):
        return None
    try:
        return cv2.imdecode(np.fromfile(path, dtype=np.uint8), cv2.IMREAD_COLOR)
    except Exception:
        return cv2.imread(path)

def safe_imwrite(path: str, img):
    ext = os.path.splitext(path)[1] or ".jpg"
    try:
        success, buf = cv2.imencode(ext, img)
        if success:
            buf.tofile(path)
            return True
    except Exception:
        pass
    return cv2.imwrite(path, img)



async def run_analysis_pipeline(
    scan_id: int,
    change_threshold: float = 0.3,
    min_region_area_px: int = 50,
    alignment_method: str = "orb"
):
    """
    Executes the end-to-end 5-step change forensics pipeline asynchronously.
    Streams real-time step status & progress via WebSockets.
    """
    with Session(engine) as session:
        scan = session.get(Scan, scan_id)
        if not scan:
            logger.error(f"Scan {scan_id} not found")
            return
            
        location = session.get(Location, scan.location_id)
        ref_lat = location.latitude if location else 0.0
        ref_lon = location.longitude if location else 0.0
        loc_name = location.name if location else "Target Location"
        old_path = scan.old_image_path
        new_path = scan.new_image_path
        gsd_meters = scan.gsd_meters

        scan.status = "processing"
        scan.progress = 0.05
        scan.current_step = "initializing"
        session.add(scan)
        session.commit()

    async def update_progress(step: str, progress: float, msg: str, image_url: str = None, data: dict = None):
        with Session(engine) as sess:
            s = sess.get(Scan, scan_id)
            if s:
                s.current_step = step
                s.progress = progress
                sess.add(s)
                sess.commit()
        await manager.broadcast_scan_progress(scan_id, {
            "step": step,
            "status": "running" if progress < 1.0 else "complete",
            "progress": progress,
            "message": msg,
            "image_url": image_url,
            "data": data
        })

    try:
        # Load images
        if not os.path.exists(old_path) or not os.path.exists(new_path):
            raise FileNotFoundError(f"Input images not found: {old_path} or {new_path}")

        old_img = safe_imread(old_path)
        new_img = safe_imread(new_path)
        
        if old_img is None or new_img is None:
            raise ValueError("Failed to decode input images")

        out_prefix = f"scan_{scan_id}"
        out_dir = settings.OUTPUT_DIR
        os.makedirs(out_dir, exist_ok=True)

        # ── STEP 1: ALIGNMENT ─────────────────────────────────────
        await update_progress("align", 0.15, "Performing feature-invariant image alignment...")
        await asyncio.sleep(0.1)
        aligned_img, align_quality, align_meta = align_images(
            old_img, new_img, method=alignment_method, min_matches=settings.MIN_ORB_MATCHES
        )
        aligned_rel = f"/outputs/{out_prefix}_aligned.jpg"
        aligned_full = os.path.join(out_dir, f"{out_prefix}_aligned.jpg")
        safe_imwrite(aligned_full, aligned_img)

        with Session(engine) as session:
            s = session.get(Scan, scan_id)
            s.aligned_image_path = aligned_rel
            s.alignment_quality = round(align_quality, 4)
            session.add(s)
            session.commit()

        await update_progress("align", 0.30, f"Alignment complete (Quality: {int(align_quality*100)}%)",
                              image_url=aligned_rel, data=align_meta)

        # ── STEP 2: PREPROCESSING ────────────────────────────────
        await update_progress("preprocess", 0.40, "Normalizing radiometric illumination & cloud mask...")
        await asyncio.sleep(0.1)
        norm_old, norm_new, valid_mask, prep_meta = preprocess_images(old_img, aligned_img)

        # ── STEP 3: COMPARISON (Multi-signal) ─────────────────────
        await update_progress("compare", 0.55, "Computing SSIM, pixel differential & vegetation index...")
        await asyncio.sleep(0.1)
        comb_heatmap, colored_heatmap, comp_meta = compare_images(
            norm_old, norm_new, valid_mask=valid_mask, ssim_window=settings.SSIM_WINDOW_SIZE
        )
        heatmap_rel = f"/outputs/{out_prefix}_heatmap.jpg"
        heatmap_full = os.path.join(out_dir, f"{out_prefix}_heatmap.jpg")
        safe_imwrite(heatmap_full, colored_heatmap)

        with Session(engine) as session:
            s = session.get(Scan, scan_id)
            s.diff_heatmap_path = heatmap_rel
            session.add(s)
            session.commit()

        await update_progress("compare", 0.70, "Change heatmap generated", image_url=heatmap_rel, data=comp_meta)

        # ── STEP 4: DETECTION ─────────────────────────────────────
        await update_progress("detect", 0.78, "Morphological filtering & polygonal contour extraction...")
        await asyncio.sleep(0.1)
        regions, det_overlay = detect_changes(
            comb_heatmap, threshold=change_threshold, min_area_px=min_region_area_px, valid_mask=valid_mask
        )
        overlay_rel = f"/outputs/{out_prefix}_overlay.jpg"
        overlay_full = os.path.join(out_dir, f"{out_prefix}_overlay.jpg")
        safe_imwrite(overlay_full, det_overlay)

        with Session(engine) as session:
            s = session.get(Scan, scan_id)
            s.detection_overlay_path = overlay_rel
            session.add(s)
            session.commit()

        await update_progress("detect", 0.85, f"Isolated {len(regions)} change anomalies",
                              image_url=overlay_rel, data={"region_count": len(regions)})

        # ── STEP 5: CLASSIFICATION & GIS MAPPING ─────────────────
        await update_progress("classify", 0.90, "Classifying land change signatures & projecting coordinates...")
        await asyncio.sleep(0.1)
        classified_regions = classify_regions(regions, aligned_img, old_img, comb_heatmap)

        h, w = old_img.shape[:2]
        geojson_data = build_geojson(classified_regions, ref_lat, ref_lon, w, h, gsd_meters)
        geojson_rel = f"/outputs/{out_prefix}_detections.geojson"
        geojson_full = os.path.join(out_dir, f"{out_prefix}_detections.geojson")
        with open(geojson_full, "w", encoding="utf-8") as f:
            json.dump(geojson_data, f, indent=2)

        # Persist detections to database
        total_ha = 0.0
        conf_sum = 0.0
        with Session(engine) as session:
            s = session.get(Scan, scan_id)
            s.geojson_path = geojson_rel
            
            # Clear existing detections if re-run
            existing = session.exec(select(Detection).where(Detection.scan_id == scan_id)).all()
            for ex in existing:
                session.delete(ex)

            for feat in geojson_data["features"]:
                props = feat["properties"]
                geom = feat["geometry"]
                c_lat, c_lon = props["centroid"]
                area_h = props["area_hectares"]
                conf = props["confidence"]
                
                det = Detection(
                    scan_id=scan_id,
                    change_type=props["change_type"],
                    confidence=conf,
                    area_hectares=area_h,
                    centroid_lat=c_lat,
                    centroid_lon=c_lon,
                    polygon_geojson=json.dumps(geom),
                    bbox=json.dumps(props.get("bbox", [0, 0, 0, 0])),
                    area_pixels=props.get("area_pixels", 0),
                    mean_change_intensity=props.get("mean_intensity", 0.0)
                )
                session.add(det)
                total_ha += area_h
                conf_sum += conf

            avg_conf = (conf_sum / len(classified_regions)) if classified_regions else 0.0

            # Generate PDF Report
            pdf_rel = f"/outputs/{out_prefix}_report.pdf"
            pdf_full = os.path.join(out_dir, f"{out_prefix}_report.pdf")
            generate_pdf_report(
                output_pdf_path=pdf_full,
                location_name=loc_name,
                latitude=ref_lat,
                longitude=ref_lon,
                old_image_path=old_path,
                new_image_path=new_path,
                overlay_image_path=overlay_full,
                detections=[f["properties"] for f in geojson_data["features"]],
                total_area_ha=total_ha,
                avg_confidence=avg_conf,
                alignment_quality=align_quality
            )

            # Check for existing report
            rep = session.exec(select(Report).where(Report.scan_id == scan_id)).first()
            if not rep:
                rep = Report(
                    scan_id=scan_id,
                    pdf_path=pdf_rel,
                    sha256_old="computed",
                    sha256_new="computed"
                )
                session.add(rep)

            # Check Alert triggers
            alerts = session.exec(select(Alert).where(Alert.location_id == s.location_id)).all()
            for al in alerts:
                if al.status == "active" and total_ha >= al.threshold_ha:
                    al.status = "triggered"
                    al.triggered_at = datetime.now(timezone.utc)
                    session.add(al)

            # Mark scan complete
            s.status = "completed"
            s.progress = 1.0
            s.current_step = "complete"
            s.completed_at = datetime.now(timezone.utc)
            s.set_metadata({
                "alignment": align_meta,
                "comparison": comp_meta,
                "region_count": len(classified_regions),
                "total_area_ha": round(total_ha, 4),
                "avg_confidence": round(avg_conf, 1)
            })
            session.add(s)
            session.commit()

        await update_progress("complete", 1.0, f"Analysis concluded successfully: {len(classified_regions)} detections ({total_ha:.2f} ha)",
                              image_url=overlay_rel, data={
                                  "total_area_ha": round(total_ha, 4),
                                  "detections_count": len(classified_regions),
                                  "report_pdf": pdf_rel,
                                  "geojson": geojson_rel
                              })

    except Exception as e:
        logger.exception(f"Pipeline error on scan {scan_id}: {e}")
        with Session(engine) as session:
            s = session.get(Scan, scan_id)
            if s:
                s.status = "failed"
                s.error_message = str(e)
                session.add(s)
                session.commit()
        await manager.broadcast_scan_progress(scan_id, {
            "step": "failed",
            "status": "failed",
            "progress": 1.0,
            "message": f"Pipeline failure: {str(e)}"
        })
