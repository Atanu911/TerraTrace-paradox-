"""Forensic Report Generation Module — generates PDF evidence report."""
import os
import hashlib
from datetime import datetime
from typing import List, Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)


def calculate_sha256(file_path: str) -> str:
    """Calculate SHA256 checksum of a file for chain of custody."""
    if not os.path.exists(file_path):
        return "FILE_NOT_FOUND"
    hasher = hashlib.sha256()
    with open(file_path, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()


def generate_pdf_report(
    output_pdf_path: str,
    location_name: str,
    latitude: float,
    longitude: float,
    old_image_path: str,
    new_image_path: str,
    overlay_image_path: Optional[str],
    detections: List[Dict[str, Any]],
    total_area_ha: float,
    avg_confidence: float,
    alignment_quality: Optional[float] = None
) -> str:
    """
    Generate a formal PDF forensic investigation report.
    Uses reportlab if available, with structured layout and chain of custody.
    """
    os.makedirs(os.path.dirname(output_pdf_path), exist_ok=True)
    sha_old = calculate_sha256(old_image_path)
    sha_new = calculate_sha256(new_image_path)
    
    try:
        from reportlab.lib.pagesizes import letter
        from reportlab.lib import colors
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image as RLImage, HRFlowable
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        
        doc = SimpleDocTemplate(
            output_pdf_path,
            pagesize=letter,
            rightMargin=36,
            leftMargin=36,
            topMargin=36,
            bottomMargin=36
        )
        
        story = []
        styles = getSampleStyleSheet()
        
        # Custom styles
        title_style = ParagraphStyle(
            'ReportTitle',
            parent=styles['Heading1'],
            fontName='Helvetica-Bold',
            fontSize=22,
            leading=26,
            textColor=colors.HexColor('#0B1B3A')
        )
        subtitle_style = ParagraphStyle(
            'ReportSubtitle',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=11,
            leading=14,
            textColor=colors.HexColor('#1F6BFF')
        )
        section_style = ParagraphStyle(
            'SectionTitle',
            parent=styles['Heading2'],
            fontName='Helvetica-Bold',
            fontSize=14,
            leading=18,
            textColor=colors.HexColor('#0B1B3A')
        )
        body_style = ParagraphStyle(
            'BodyText',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=9,
            leading=12,
            textColor=colors.HexColor('#2A3B53')
        )
        mono_style = ParagraphStyle(
            'MonoText',
            parent=styles['Normal'],
            fontName='Courier',
            fontSize=7.5,
            leading=10,
            textColor=colors.HexColor('#1E293B')
        )
        
        # Header
        story.append(Paragraph("TERRATRACE FORENSIC EVIDENCE REPORT", title_style))
        story.append(Paragraph("Autonomous Satellite & Drone Temporal Change Detection Engine", subtitle_style))
        story.append(Spacer(1, 8))
        story.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor('#1F6BFF'), spaceBefore=2, spaceAfter=12))
        
        # Metadata Block
        meta_data = [
            [Paragraph("<b>Target Location:</b>", body_style), Paragraph(f"{location_name} ({latitude:.4f}N, {longitude:.4f}E)", body_style)],
            [Paragraph("<b>Report Generated:</b>", body_style), Paragraph(datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC"), body_style)],
            [Paragraph("<b>Total Change Detected:</b>", body_style), Paragraph(f"<b>{total_area_ha:.3f} hectares</b>", body_style)],
            [Paragraph("<b>Average Confidence:</b>", body_style), Paragraph(f"<b>{avg_confidence:.1f}%</b>", body_style)],
            [Paragraph("<b>Registration Quality:</b>", body_style), Paragraph(f"{((alignment_quality or 0)*100):.1f}% inlier score", body_style)],
        ]
        meta_table = Table(meta_data, colWidths=[150, 390])
        meta_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F3F8FF')),
            ('PADDING', (0, 0), (-1, -1), 4),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#D0E0FF')),
        ]))
        story.append(meta_table)
        story.append(Spacer(1, 14))
        
        # Chain of Custody Section
        story.append(Paragraph("Chain of Custody & Cryptographic Verification", section_style))
        story.append(Spacer(1, 4))
        hash_data = [
            [Paragraph("<b>Asset</b>", body_style), Paragraph("<b>Path / Checksum (SHA-256)</b>", body_style)],
            [Paragraph("Pre-Incident Image (Old)", body_style), Paragraph(f"{sha_old}", mono_style)],
            [Paragraph("Post-Incident Image (New)", body_style), Paragraph(f"{sha_new}", mono_style)],
        ]
        hash_table = Table(hash_data, colWidths=[150, 390])
        hash_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0B1B3A')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('PADDING', (0, 0), (-1, -1), 4),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CCCCCC')),
        ]))
        story.append(hash_table)
        story.append(Spacer(1, 14))
        
        # Detections Breakdown Section
        story.append(Paragraph(f"Detected Anomalies & Classification ({len(detections)} Regions)", section_style))
        story.append(Spacer(1, 4))
        
        det_rows = [
            [
                Paragraph("<b>#</b>", body_style),
                Paragraph("<b>Change Classification</b>", body_style),
                Paragraph("<b>Area (ha)</b>", body_style),
                Paragraph("<b>Confidence</b>", body_style),
                Paragraph("<b>Coordinates (Lat, Lon)</b>", body_style)
            ]
        ]
        for idx, d in enumerate(detections, 1):
            c_lat = d.get("centroid_lat", latitude)
            c_lon = d.get("centroid_lon", longitude)
            det_rows.append([
                Paragraph(str(idx), body_style),
                Paragraph(str(d.get("change_type", "Unknown")), body_style),
                Paragraph(f"{float(d.get('area_hectares', 0.0)):.4f}", body_style),
                Paragraph(f"{float(d.get('confidence', 0.0)):.1f}%", body_style),
                Paragraph(f"{c_lat:.5f}, {c_lon:.5f}", mono_style)
            ])
            
        det_table = Table(det_rows, colWidths=[25, 150, 75, 75, 215])
        det_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1F6BFF')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('PADDING', (0, 0), (-1, -1), 4),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#DDDDDD')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F8FAFC')])
        ]))
        story.append(det_table)
        story.append(Spacer(1, 14))
        
        # Methodology Statement
        story.append(Paragraph("Forensic Methodology & Algorithm Integrity", section_style))
        story.append(Spacer(1, 4))
        methodology_text = (
            "This report was automatically synthesized by TerraTrace. Multi-temporal alignment was conducted "
            "using feature-invariant homography (ORB+RANSAC) with Euclidean ECC correlation fallback. "
            "Structural change detection integrates Structural Similarity Index (SSIM), normalized pixel differences, "
            "and Excess Green spectral vegetation indices. Change boundaries were resolved via morphological closing and "
            "contour polygonal extraction. Feature classification employs spectral heuristics and geometry edge metrics."
        )
        story.append(Paragraph(methodology_text, body_style))
        story.append(Spacer(1, 10))
        story.append(Paragraph("Report verified by TerraTrace Core System • Team AA Boys (Hackinverse)", subtitle_style))
        
        doc.build(story)
        logger.info(f"Generated PDF report at {output_pdf_path}")
        return output_pdf_path
        
    except Exception as e:
        logger.error(f"ReportLab failed or not installed, writing markdown summary: {e}")
        # Text/HTML fallback
        with open(output_pdf_path + ".txt", "w", encoding="utf-8") as f:
            f.write(f"TERRATRACE FORENSIC EVIDENCE REPORT\n")
            f.write(f"Location: {location_name} ({latitude}, {longitude})\n")
            f.write(f"Total Change: {total_area_ha} ha | Avg Confidence: {avg_confidence}%\n")
            f.write(f"Old SHA-256: {sha_old}\nNew SHA-256: {sha_new}\n")
            f.write(f"Detections: {len(detections)}\n")
            for idx, d in enumerate(detections, 1):
                f.write(f"{idx}. {d.get('change_type')}: {d.get('area_hectares')} ha ({d.get('confidence')}%)\n")
        return output_pdf_path + ".txt"
