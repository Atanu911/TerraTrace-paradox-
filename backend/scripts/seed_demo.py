"""Seed Demo Data Script — generates realistic satellite before/after pairs and populates the database."""
import os
import cv2
import numpy as np
import json
import asyncio
from datetime import datetime, timezone, timedelta
from sqlmodel import Session, select

from backend.app.config import settings
from backend.app.db import engine, create_db_and_tables
from backend.app.models import Location, Scan, Detection, Alert, Report
from backend.app.services.analysis import run_analysis_pipeline

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


def generate_sundarbans_pair(out_dir: str):
    """
    Generate Sundarbans Forest pair:
    Before: Dense mangrove forest + winding river.
    After: Cleared area with rectangular construction / road expansion.
    """
    h, w = 512, 512
    # Base forest: dark green with texture
    base = np.zeros((h, w, 3), dtype=np.uint8)
    # Forest color (BGR): Dark green
    base[:] = (35, 95, 30)
    
    # Add noise for canopy texture
    noise = np.random.normal(0, 15, (h, w, 3)).astype(np.int16)
    forest = np.clip(base.astype(np.int16) + noise, 0, 255).astype(np.uint8)
    
    # Draw winding river (dark muddy blue)
    river_pts = np.array([
        [0, 150], [100, 180], [200, 140], [320, 220], [420, 200], [512, 260],
        [512, 310], [420, 250], [320, 270], [200, 190], [100, 230], [0, 200]
    ], np.int32)
    cv2.fillPoly(forest, [river_pts], (90, 75, 40))
    
    old_img = forest.copy()
    new_img = forest.copy()
    
    # In AFTER image:
    # 1. Deforestation clearing patch (brown bare soil)
    clear_pts = np.array([[120, 320], [240, 310], [260, 420], [140, 440]], np.int32)
    cv2.fillPoly(new_img, [clear_pts], (45, 80, 140))  # Bare soil brown
    
    # 2. Construction structures (gray rectangular pads + access road)
    cv2.rectangle(new_img, (150, 340), (190, 380), (180, 185, 190), -1)  # Building 1
    cv2.rectangle(new_img, (200, 350), (230, 400), (170, 175, 180), -1)  # Building 2
    cv2.line(new_img, (190, 390), (320, 270), (150, 150, 155), 6)       # Road to river
    
    # 3. Second illegal clearing patch
    clear_pts2 = np.array([[360, 80], [460, 70], [480, 160], [380, 180]], np.int32)
    cv2.fillPoly(new_img, [clear_pts2], (50, 85, 145))
    cv2.rectangle(new_img, (390, 100), (430, 140), (190, 195, 200), -1)

    old_path = os.path.join(out_dir, "demo_sundarbans_old.jpg")
    new_path = os.path.join(out_dir, "demo_sundarbans_new.jpg")
    safe_imwrite(old_path, old_img)
    safe_imwrite(new_path, new_img)
    return old_path, new_path


def generate_raniganj_pair(out_dir: str):
    """
    Generate Raniganj Coal Belt pair:
    Before: Sparse vegetation and dry shrubs.
    After: Large open-cast coal mining pit (dark/black terraced pit and earth piles).
    """
    h, w = 512, 512
    base = np.zeros((h, w, 3), dtype=np.uint8)
    base[:] = (60, 110, 95)  # Dry shrub green/tan
    
    noise = np.random.normal(0, 12, (h, w, 3)).astype(np.int16)
    terrain = np.clip(base.astype(np.int16) + noise, 0, 255).astype(np.uint8)
    
    old_img = terrain.copy()
    new_img = terrain.copy()
    
    # In AFTER image: Open cast mining pit
    # Concentric terraced excavation rings
    center = (256, 256)
    cv2.ellipse(new_img, center, (160, 120), 25, 0, 360, (30, 45, 60), -1)   # Outer cut
    cv2.ellipse(new_img, center, (120, 90), 25, 0, 360, (20, 30, 40), -1)    # Middle terrace
    cv2.ellipse(new_img, center, (80, 60), 25, 0, 360, (10, 15, 20), -1)     # Deep coal pit
    
    # Spoil tips / overburden mounds (tan/yellowish earth)
    cv2.ellipse(new_img, (110, 160), (45, 30), -15, 0, 360, (55, 115, 175), -1)
    cv2.ellipse(new_img, (400, 340), (60, 40), 10, 0, 360, (50, 110, 170), -1)
    
    # Haul roads
    cv2.ellipse(new_img, center, (140, 105), 25, 0, 220, (110, 120, 130), 4)

    old_path = os.path.join(out_dir, "demo_raniganj_old.jpg")
    new_path = os.path.join(out_dir, "demo_raniganj_new.jpg")
    safe_imwrite(old_path, old_img)
    safe_imwrite(new_path, new_img)
    return old_path, new_path


def generate_amazon_pair(out_dir: str):
    """
    Generate Amazon Frontier pair:
    Before: Pristine dense rainforest canopy.
    After: Distinctive "fishbone" deforestation pattern.
    """
    h, w = 512, 512
    base = np.zeros((h, w, 3), dtype=np.uint8)
    base[:] = (25, 80, 20)  # Dense tropical canopy
    
    noise = np.random.normal(0, 16, (h, w, 3)).astype(np.int16)
    rainforest = np.clip(base.astype(np.int16) + noise, 0, 255).astype(np.uint8)
    
    old_img = rainforest.copy()
    new_img = rainforest.copy()
    
    # Primary access road (tan)
    cv2.line(new_img, (50, 50), (460, 460), (60, 100, 150), 7)
    
    # Perpendicular lateral clearings (fishbone branches)
    for t in [120, 190, 260, 330, 400]:
        x = t
        y = t
        # Left clearing block
        pts_left = np.array([[x - 10, y + 10], [x - 90, y + 90], [x - 80, y + 110], [x, y + 30]], np.int32)
        cv2.fillPoly(new_img, [pts_left], (50, 90, 140))
        # Right clearing block
        pts_right = np.array([[x + 10, y - 10], [x + 90, y - 90], [x + 110, y - 80], [x + 30, y]], np.int32)
        cv2.fillPoly(new_img, [pts_right], (50, 90, 140))

    old_path = os.path.join(out_dir, "demo_amazon_old.jpg")
    new_path = os.path.join(out_dir, "demo_amazon_new.jpg")
    safe_imwrite(old_path, old_img)
    safe_imwrite(new_path, new_img)
    return old_path, new_path


async def seed():
    print("[INIT] Initializing TerraTrace Database tables...")
    create_db_and_tables()

    upload_dir = settings.UPLOAD_DIR
    os.makedirs(upload_dir, exist_ok=True)

    print("[GEN] Generating synthesized satellite demo imagery...")
    sund_old, sund_new = generate_sundarbans_pair(upload_dir)
    rani_old, rani_new = generate_raniganj_pair(upload_dir)
    amaz_old, amaz_new = generate_amazon_pair(upload_dir)

    with Session(engine) as session:
        # Check if already seeded
        existing_locs = session.exec(select(Location)).all()
        if existing_locs:
            print("[INFO] Database already contains locations. Seeding additional if needed.")
        
        # 1. Sundarbans
        loc1 = session.exec(select(Location).where(Location.name == "Sundarbans Biosphere Reserve")).first()
        if not loc1:
            loc1 = Location(
                name="Sundarbans Biosphere Reserve",
                latitude=22.0250,
                longitude=88.8500,
                description="Protected coastal mangrove ecosystem monitored for illicit construction & illegal land reclamation."
            )
            session.add(loc1)
            session.commit()
            session.refresh(loc1)

        # 2. Raniganj
        loc2 = session.exec(select(Location).where(Location.name == "Raniganj Coal Basin")).first()
        if not loc2:
            loc2 = Location(
                name="Raniganj Coal Basin",
                latitude=23.6147,
                longitude=87.1333,
                description="High-priority mining zone monitored for unpermitted open-cast pit expansions."
            )
            session.add(loc2)
            session.commit()
            session.refresh(loc2)

        # 3. Amazon
        loc3 = session.exec(select(Location).where(Location.name == "Amazon Rainforest Frontier")).first()
        if not loc3:
            loc3 = Location(
                name="Amazon Rainforest Frontier",
                latitude=-3.4653,
                longitude=-62.2159,
                description="Remote rainforest tract monitored for illegal fishbone logging roads."
            )
            session.add(loc3)
            session.commit()
            session.refresh(loc3)

        # Add Alert Rules
        alert1 = session.exec(select(Alert).where(Alert.location_id == loc1.id)).first()
        if not alert1:
            session.add(Alert(
                location_id=loc1.id,
                rule_type="area_threshold",
                threshold_ha=1.0,
                change_type_filter="Construction",
                notification_method="browser"
            ))

        alert2 = session.exec(select(Alert).where(Alert.location_id == loc2.id)).first()
        if not alert2:
            session.add(Alert(
                location_id=loc2.id,
                rule_type="area_threshold",
                threshold_ha=2.5,
                change_type_filter="Mining",
                notification_method="browser"
            ))

        # Add Scans
        scan1 = session.exec(select(Scan).where(Scan.location_id == loc1.id)).first()
        if not scan1:
            scan1 = Scan(
                location_id=loc1.id,
                old_image_path=sund_old,
                new_image_path=sund_new,
                old_thumbnail=f"/uploads/{os.path.basename(sund_old)}",
                new_thumbnail=f"/uploads/{os.path.basename(sund_new)}",
                gsd_meters=0.5,
                status="uploaded",
                scan_date_old=datetime.now(timezone.utc) - timedelta(days=90),
                scan_date_new=datetime.now(timezone.utc)
            )
            session.add(scan1)

        scan2 = session.exec(select(Scan).where(Scan.location_id == loc2.id)).first()
        if not scan2:
            scan2 = Scan(
                location_id=loc2.id,
                old_image_path=rani_old,
                new_image_path=rani_new,
                old_thumbnail=f"/uploads/{os.path.basename(rani_old)}",
                new_thumbnail=f"/uploads/{os.path.basename(rani_new)}",
                gsd_meters=0.5,
                status="uploaded",
                scan_date_old=datetime.now(timezone.utc) - timedelta(days=60),
                scan_date_new=datetime.now(timezone.utc)
            )
            session.add(scan2)

        session.commit()
        if scan1:
            session.refresh(scan1)
        if scan2:
            session.refresh(scan2)

    print("[PIPELINE] Running live analysis pipeline on Scan 1 (Sundarbans)...")
    if scan1:
        await run_analysis_pipeline(scan1.id, change_threshold=0.25, min_region_area_px=60)

    print("[PIPELINE] Running live analysis pipeline on Scan 2 (Raniganj)...")
    if scan2:
        await run_analysis_pipeline(scan2.id, change_threshold=0.25, min_region_area_px=60)

    print("[DONE] Demo seeding complete! Database populated with realistic scans and forensic outputs.")


if __name__ == "__main__":
    asyncio.run(seed())
