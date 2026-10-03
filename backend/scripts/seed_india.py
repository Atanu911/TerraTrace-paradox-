import os
import asyncio
from datetime import datetime, timezone, timedelta
from sqlmodel import Session, select
import json
from reportlab.pdfgen import canvas

from backend.app.config import settings
from backend.app.db import engine, create_db_and_tables
from backend.app.models import Location, Scan, Detection, Alert, Report

states_data = [
    {"name": "Rajasthan", "lat": 27.0238, "lon": 74.2179, "forest": 0.40, "minerals": "Lead & Zinc, Copper, Gypsum"},
    {"name": "Gujarat", "lat": 22.2587, "lon": 71.1924, "forest": 0.35, "minerals": "Limestone, Petroleum"},
    {"name": "Madhya Pradesh", "lat": 22.9734, "lon": 78.6569, "forest": -0.10, "minerals": "Coal, Copper, Diamond"},
    {"name": "Maharashtra", "lat": 19.7515, "lon": 75.7139, "forest": 0.02, "minerals": "Bauxite, Manganese"},
    {"name": "Karnataka", "lat": 15.3173, "lon": 75.7139, "forest": 0.15, "minerals": "Gold, Iron, Manganese"},
    {"name": "Kerala", "lat": 10.8505, "lon": 76.2711, "forest": 0.05, "minerals": "None"},
    {"name": "Tamil Nadu", "lat": 11.1271, "lon": 78.6569, "forest": 0.10, "minerals": "Lignite, Limestone, Magnesite"},
    {"name": "Andhra Pradesh", "lat": 15.9129, "lon": 79.7400, "forest": 0.30, "minerals": "Mica, Limestone, Barytes"},
    {"name": "Telangana", "lat": 18.1124, "lon": 79.0193, "forest": 0.25, "minerals": "Coal"},
    {"name": "Odisha", "lat": 20.9517, "lon": 85.0985, "forest": 0.50, "minerals": "Iron, Bauxite, Coal, Manganese"},
    {"name": "Chhattisgarh", "lat": 21.2787, "lon": 81.8661, "forest": 0.60, "minerals": "Coal, Iron, Bauxite, Dolomite"},
    {"name": "Jharkhand", "lat": 23.6102, "lon": 85.2799, "forest": -0.01, "minerals": "Coal, Iron, Copper, Mica, Bauxite"},
    {"name": "West Bengal", "lat": 22.9868, "lon": 87.8550, "forest": 0.20, "minerals": "Coal"},
    {"name": "Bihar", "lat": 25.0961, "lon": 85.3131, "forest": -0.05, "minerals": "Limestone"},
    {"name": "Uttar Pradesh", "lat": 26.8467, "lon": 80.9462, "forest": 0.55, "minerals": "Limestone, Silica sand"},
    {"name": "Uttarakhand", "lat": 30.0668, "lon": 79.0193, "forest": 0.03, "minerals": "Limestone"},
    {"name": "Himachal Pradesh", "lat": 31.1048, "lon": 77.1734, "forest": 0.00, "minerals": "None"},
    {"name": "Punjab", "lat": 31.1471, "lon": 75.3412, "forest": 0.00, "minerals": "None"},
    {"name": "Haryana", "lat": 29.0588, "lon": 76.0856, "forest": -0.02, "minerals": "None"},
    {"name": "Jammu and Kashmir", "lat": 33.7782, "lon": 76.5762, "forest": -0.20, "minerals": "None"},
    {"name": "Arunachal Pradesh", "lat": 28.2180, "lon": 94.7278, "forest": -0.35, "minerals": "None"},
    {"name": "Assam", "lat": 26.2006, "lon": 92.9376, "forest": -0.25, "minerals": "Coal, Petroleum"},
    {"name": "Meghalaya", "lat": 25.4670, "lon": 91.3662, "forest": -0.45, "minerals": "Coal, Limestone"},
    {"name": "Nagaland", "lat": 26.1584, "lon": 94.5624, "forest": -0.15, "minerals": "None"},
    {"name": "Manipur", "lat": 24.6637, "lon": 93.9063, "forest": 0.30, "minerals": "None"},
    {"name": "Mizoram", "lat": 23.1645, "lon": 92.9376, "forest": 0.75, "minerals": "None"},
    {"name": "Tripura", "lat": 23.9408, "lon": 91.9882, "forest": -0.40, "minerals": "None"},
    {"name": "Sikkim", "lat": 27.5330, "lon": 88.5122, "forest": 0.00, "minerals": "None"},
    {"name": "Delhi", "lat": 28.7041, "lon": 77.1025, "forest": 0.00, "minerals": "None"}
]

def generate_pdf_report(state, out_path):
    c = canvas.Canvas(out_path)
    c.setFont("Helvetica-Bold", 16)
    c.drawString(100, 800, f"Comparison Report: {state['name']}")
    c.setFont("Helvetica", 12)
    c.drawString(100, 770, f"Forest Cover Change (5 years): {state['forest']}%")
    c.drawString(100, 750, f"Malicious Activities / Mining: {state['minerals']}")
    c.drawString(100, 730, f"Coordinates: {state['lat']} N, {state['lon']} E")
    if state['forest'] < 0:
        c.drawString(100, 710, "Warning: Negative forest cover change indicates deforestation.")
    if "Coal" in state['minerals'] or "Iron" in state['minerals']:
        c.drawString(100, 690, "Note: Heavy mining activity detected.")
    
    c.save()

async def seed():
    print("Seeding India States Data...")
    create_db_and_tables()
    
    upload_dir = settings.UPLOAD_DIR
    os.makedirs(upload_dir, exist_ok=True)
    
    with Session(engine) as session:
        for state in states_data:
            # Create Location
            loc = session.exec(select(Location).where(Location.name == state["name"])).first()
            if not loc:
                loc = Location(
                    name=state["name"],
                    latitude=state["lat"],
                    longitude=state["lon"],
                    description=f"Forest change: {state['forest']}%. Minerals: {state['minerals']}"
                )
                session.add(loc)
                session.commit()
                session.refresh(loc)
            
            # Create Scan
            scan = session.exec(select(Scan).where(Scan.location_id == loc.id)).first()
            if not scan:
                scan = Scan(
                    location_id=loc.id,
                    old_image_path="dummy",
                    new_image_path="dummy",
                    status="completed",
                    scan_date_old=datetime.now(timezone.utc) - timedelta(days=365*5),
                    scan_date_new=datetime.now(timezone.utc)
                )
                session.add(scan)
                session.commit()
                session.refresh(scan)
            
            # Create Detection based on forest cover or minerals
            if state["forest"] < 0:
                det = Detection(
                    scan_id=scan.id,
                    change_type="Deforestation",
                    confidence=95.0,
                    area_hectares=abs(state["forest"]) * 1000, # arbitrary scale
                    centroid_lat=state["lat"],
                    centroid_lon=state["lon"],
                    polygon_geojson=json.dumps({"type": "Point", "coordinates": [state["lon"], state["lat"]]}),
                    bbox=json.dumps([0,0,0,0])
                )
                session.add(det)
            if state["minerals"] != "None":
                det = Detection(
                    scan_id=scan.id,
                    change_type="Mining",
                    confidence=85.0,
                    area_hectares=500.0,
                    centroid_lat=state["lat"] + 0.1,
                    centroid_lon=state["lon"] + 0.1,
                    polygon_geojson=json.dumps({"type": "Point", "coordinates": [state["lon"]+0.1, state["lat"]+0.1]}),
                    bbox=json.dumps([0,0,0,0])
                )
                session.add(det)
                
            # Create PDF Report
            report = session.exec(select(Report).where(Report.scan_id == scan.id)).first()
            if not report:
                pdf_filename = f"report_{state['name'].replace(' ', '_')}.pdf"
                pdf_path = os.path.join(upload_dir, pdf_filename)
                generate_pdf_report(state, pdf_path)
                
                report = Report(
                    scan_id=scan.id,
                    pdf_path=f"/uploads/{pdf_filename}",
                    sha256_old="dummy",
                    sha256_new="dummy"
                )
                session.add(report)
        
        session.commit()
    print("Seeding Complete.")

if __name__ == "__main__":
    asyncio.run(seed())
