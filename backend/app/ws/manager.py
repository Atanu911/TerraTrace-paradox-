"""WebSocket Connection Manager for live analysis tracking."""
from typing import Dict, List
from fastapi import WebSocket
import logging
import json

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self):
        # Maps scan_id -> list of active WebSockets
        self.active_connections: Dict[int, List[WebSocket]] = {}
        # Global listeners (for dashboard feed)
        self.global_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket, scan_id: int = None):
        await websocket.accept()
        if scan_id is not None:
            if scan_id not in self.active_connections:
                self.active_connections[scan_id] = []
            self.active_connections[scan_id].append(websocket)
        else:
            self.global_connections.append(websocket)
        logger.info(f"WebSocket connected. Scan: {scan_id}")

    def disconnect(self, websocket: WebSocket, scan_id: int = None):
        if scan_id is not None and scan_id in self.active_connections:
            if websocket in self.active_connections[scan_id]:
                self.active_connections[scan_id].remove(websocket)
            if not self.active_connections[scan_id]:
                del self.active_connections[scan_id]
        elif websocket in self.global_connections:
            self.global_connections.remove(websocket)
        logger.info(f"WebSocket disconnected. Scan: {scan_id}")

    async def broadcast_scan_progress(self, scan_id: int, message: dict):
        """Send progress updates to listeners of a specific scan."""
        if scan_id in self.active_connections:
            dead_sockets = []
            for connection in self.active_connections[scan_id]:
                try:
                    await connection.send_text(json.dumps(message))
                except Exception as e:
                    logger.warning(f"Failed to send to client: {e}")
                    dead_sockets.append(connection)
            for dead in dead_sockets:
                self.disconnect(dead, scan_id)
                
        # Also broadcast high-level events to global listeners
        if message.get("status") in ("complete", "failed"):
            await self.broadcast_global({
                "type": "scan_update",
                "scan_id": scan_id,
                **message
            })

    async def broadcast_global(self, message: dict):
        """Send message to all global dashboard listeners."""
        dead_sockets = []
        for connection in self.global_connections:
            try:
                await connection.send_text(json.dumps(message))
            except Exception as e:
                dead_sockets.append(connection)
        for dead in dead_sockets:
            if dead in self.global_connections:
                self.global_connections.remove(dead)


manager = ConnectionManager()
