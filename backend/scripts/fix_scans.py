import asyncio
import os
import sys

sys.path.insert(0, os.path.abspath("."))
sys.path.insert(0, os.path.abspath("backend"))

from sqlmodel import Session, select
from backend.app.db import engine
from backend.app.models import Scan
from backend.app.config import settings
from backend.app.services.analysis import run_analysis_pipeline

with Session(engine) as session:
    scans = session.exec(select(Scan)).all()
    for scan in scans:
        old_f = os.path.join(settings.UPLOAD_DIR, os.path.basename(scan.old_image_path))
        new_f = os.path.join(settings.UPLOAD_DIR, os.path.basename(scan.new_image_path))
        if os.path.exists(old_f) and os.path.exists(new_f):
            scan.old_image_path = old_f
            scan.new_image_path = new_f
            scan.status = "uploaded"
            session.add(scan)
    session.commit()

async def main():
    with Session(engine) as session:
        for scan in session.exec(select(Scan)).all():
            try:
                print(f"Running pipeline on scan {scan.id}...")
                await run_analysis_pipeline(scan.id, change_threshold=0.25, min_region_area_px=50)
                print(f"Scan {scan.id} completed successfully!")
            except Exception as e:
                print(f"Scan {scan.id} error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
