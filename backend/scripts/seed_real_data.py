import asyncio
import os
import sys
from datetime import datetime, timezone, timedelta

sys.path.insert(0, os.path.abspath("."))
sys.path.insert(0, os.path.abspath("backend"))

from sqlmodel import Session, select
from backend.app.config import settings
from backend.app.db import engine, create_db_and_tables
from backend.app.models import Location, Scan, Detection, Alert
from backend.scripts.seed_demo import generate_sundarbans_pair, generate_raniganj_pair, generate_amazon_pair
from backend.app.services.analysis import run_analysis_pipeline

async def populate():
    print("[1] Ensuring DB and uploads dir...")
    create_db_and_tables()
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    os.makedirs(settings.OUTPUT_DIR, exist_ok=True)

    print("[2] Generating satellite raster pairs...")
    sund_old, sund_new = generate_sundarbans_pair(settings.UPLOAD_DIR)
    rani_old, rani_new = generate_raniganj_pair(settings.UPLOAD_DIR)
    amaz_old, amaz_new = generate_amazon_pair(settings.UPLOAD_DIR)

    with Session(engine) as session:
        # 1. Sundarbans (Deforestation & Construction)
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

        # 2. Raniganj (Mining)
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

        # 3. Amazon (Deforestation)
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

        # Scans
        scan1 = session.exec(select(Scan).where(Scan.id == 1)).first()
        now = datetime.now(timezone.utc)
        if not scan1:
            scan1 = Scan(
                id=1,
                location_id=loc1.id,
                old_image_path=sund_old,
                new_image_path=sund_new,
                old_thumbnail=f"/uploads/{os.path.basename(sund_old)}",
                new_thumbnail=f"/uploads/{os.path.basename(sund_new)}",
                gsd_meters=0.5,
                status="uploaded",
                scan_date_old=now - timedelta(days=90),
                scan_date_new=now
            )
            session.add(scan1)
        else:
            scan1.old_image_path = sund_old
            scan1.new_image_path = sund_new
            scan1.old_thumbnail = f"/uploads/{os.path.basename(sund_old)}"
            scan1.new_thumbnail = f"/uploads/{os.path.basename(sund_new)}"
            scan1.scan_date_old = now - timedelta(days=90)
            scan1.scan_date_new = now
            session.add(scan1)

        scan2 = session.exec(select(Scan).where(Scan.id == 2)).first()
        if not scan2:
            scan2 = Scan(
                id=2,
                location_id=loc2.id,
                old_image_path=rani_old,
                new_image_path=rani_new,
                old_thumbnail=f"/uploads/{os.path.basename(rani_old)}",
                new_thumbnail=f"/uploads/{os.path.basename(rani_new)}",
                gsd_meters=0.5,
                status="uploaded",
                scan_date_old=now - timedelta(days=120),
                scan_date_new=now - timedelta(days=10)
            )
            session.add(scan2)
        else:
            scan2.old_image_path = rani_old
            scan2.new_image_path = rani_new
            scan2.old_thumbnail = f"/uploads/{os.path.basename(rani_old)}"
            scan2.new_thumbnail = f"/uploads/{os.path.basename(rani_new)}"
            scan2.scan_date_old = now - timedelta(days=120)
            scan2.scan_date_new = now - timedelta(days=10)
            session.add(scan2)

        # Add Active Alerts
        if not session.exec(select(Alert)).first():
            session.add(Alert(
                location_id=loc1.id,
                rule_type="area_threshold",
                threshold_ha=0.5,
                change_type_filter="Construction",
                notification_method="browser",
                status="triggered",
                triggered_at=now - timedelta(hours=3)
            ))
            session.add(Alert(
                location_id=loc2.id,
                rule_type="area_threshold",
                threshold_ha=2.0,
                change_type_filter="Mining",
                notification_method="browser",
                status="triggered",
                triggered_at=now - timedelta(days=1)
            ))
            session.add(Alert(
                location_id=loc3.id,
                rule_type="area_threshold",
                threshold_ha=1.0,
                change_type_filter="Deforestation",
                notification_method="browser",
                status="active"
            ))

        session.commit()

    print("[3] Running Computer Vision Analysis Pipelines...")
    await run_analysis_pipeline(1, change_threshold=0.25, min_region_area_px=50)
    print(" Scan 1 completed!")
    await run_analysis_pipeline(2, change_threshold=0.25, min_region_area_px=50)
    print(" Scan 2 completed!")
    print("[ALL DONE] Database seeded with real forensic scans, alerts, and classified changes!")

if __name__ == "__main__":
    asyncio.run(populate())
