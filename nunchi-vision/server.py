# server.py

import asyncio
import json
import queue
import websockets


class VisionWebSocketServer:
    def __init__(self, host="127.0.0.1", port=8765):
        self.host = host
        self.port = port
        self.clients = set()
        self.command_queue = queue.Queue()
        self.calibration_debug_enabled = False

    async def start(self):
        print(f"[VISION_WS] server starting ws://{self.host}:{self.port}")

        async with websockets.serve(self._handler, self.host, self.port):
            await asyncio.Future()

    async def _handler(self, websocket):
        self.clients.add(websocket)
        print(f"[VISION_WS] client connected count={len(self.clients)}")

        try:
            async for message in websocket:
                # 클라이언트에서 메시지를 보내도 현재는 별도 처리하지 않음
                try:
                    command = json.loads(message)
                    self.command_queue.put(command)
                except json.JSONDecodeError:
                    print(f"[VISION_WS] invalid client message: {message}")
        except Exception as e:
            print(f"[VISION_WS] client error: {e}")
        finally:
            self.clients.discard(websocket)
            print(f"[VISION_WS] client disconnected count={len(self.clients)}")

    async def broadcast(self, event):
        if not self.clients:
            return

        message = json.dumps(event, ensure_ascii=False)

        disconnected = []

        for client in self.clients:
            try:
                await client.send(message)
            except Exception:
                disconnected.append(client)

        for client in disconnected:
            self.clients.discard(client)

    def drain_commands(self):
        commands = []

        while True:
            try:
                commands.append(self.command_queue.get_nowait())
            except queue.Empty:
                break

        return commands
