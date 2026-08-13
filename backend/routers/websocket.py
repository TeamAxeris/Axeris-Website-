"""WebSocket endpoint for real-time notifications."""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import List, Dict
import json
import asyncio
from datetime import datetime

router = APIRouter(tags=["websocket"])


class ConnectionManager:
    """Manages active WebSocket connections."""

    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self._event_queue: asyncio.Queue = asyncio.Queue()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        """Send message to all connected clients."""
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                disconnected.append(connection)
        for conn in disconnected:
            self.disconnect(conn)

    async def send_notification(self, event_type: str, data: dict):
        """Send a typed notification to all clients."""
        message = {
            "type": event_type,
            "data": data,
            "timestamp": datetime.now().isoformat(),
        }
        await self.broadcast(message)


# Singleton manager
manager = ConnectionManager()

# Event loop captured at startup so sync (threadpool) request handlers can
# schedule broadcasts safely — asyncio.create_task from a worker thread
# raises RuntimeError, which silently killed every notification.
_main_loop = None


def capture_main_loop():
    global _main_loop
    _main_loop = asyncio.get_running_loop()


def notify_threadsafe(event_type: str, data: dict):
    """Schedule a broadcast from any thread. No-op if the loop isn't up."""
    if _main_loop is None or _main_loop.is_closed():
        return
    _main_loop.call_soon_threadsafe(
        lambda: asyncio.ensure_future(manager.send_notification(event_type, data))
    )


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        # Send initial connection confirmation
        await websocket.send_json({
            "type": "connection",
            "data": {"status": "connected", "message": "Real-time notifications active"},
            "timestamp": datetime.now().isoformat(),
        })

        while True:
            # Keep alive — listen for client messages (heartbeat / ping)
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_json({
                    "type": "pong",
                    "timestamp": datetime.now().isoformat(),
                })
    except WebSocketDisconnect:
        pass
    except Exception:
        # Abnormal transport teardown — must still fall through to cleanup
        # or the dead socket leaks in active_connections forever.
        pass
    finally:
        manager.disconnect(websocket)
