# -*- coding: utf-8 -*-

from http.server import BaseHTTPRequestHandler, HTTPServer
import json
from datetime import datetime
import traceback
import serial

HOST = "127.0.0.1"
PORT = 9100

COM_PORT = "COM1"
BAUDRATE = 115200

# Printer line width (chars). Must match the frontend (receipt.js) LINE_W. (58mm = 32)
LINE_W = 32


def safe_line(text, max_len=LINE_W):
    if text is None:
        return ""
    text = str(text).replace("\r", " ").replace("\n", " ")
    return text[:max_len]


def build_ticket(data):
    # The frontend (receipt.js) sends 'lines': a fully formatted string array
    # (width/alignment/CJK already handled). Print those lines as-is instead of
    # re-rendering the layout. Falls back to 'items' for older payloads.
    order_number = safe_line(data.get("orderNumber", "A-000"), 16)
    lines = data.get("lines", None)
    items = data.get("items", [])

    out = []

    if isinstance(lines, list) and lines:
        for line in lines:
            out.append(safe_line(line, LINE_W))
    else:
        print_type = data.get("type", "ticket")
        title = "ORDER TICKET" if print_type == "ticket" else "RECEIPT"

        out.append("-" * 16)
        out.append(" NUNCHI KIOSK")
        out.append("-" * 16)
        out.append(title)
        out.append("NO: " + order_number)
        out.append(datetime.now().strftime("%Y-%m-%d %H:%M"))
        out.append("")

        if isinstance(items, list) and items:
            for item in items:
                out.append(safe_line(item, LINE_W))
        else:
            out.append("No items")

        out.append("")
        out.append("PLEASE WAIT")
        out.append("-" * 16)

    out.append("")
    out.append("")
    out.append("")

    return "\r\n".join(out)


def print_to_com1(ticket):
    raw = ticket.encode("cp949", errors="replace")

    with serial.Serial(
        port=COM_PORT,
        baudrate=BAUDRATE,
        bytesize=8,
        parity="N",
        stopbits=1,
        timeout=2
    ) as ser:
        ser.write(raw)
        ser.flush()


class PrintHandler(BaseHTTPRequestHandler):
    def _set_headers(self, status=200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_OPTIONS(self):
        self._set_headers(200)
        self.wfile.write(b'{"ok":true}')

    def do_POST(self):
        if self.path != "/print":
            self._set_headers(404)
            self.wfile.write(b'{"ok":false,"msg":"not found"}')
            return

        try:
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length).decode("utf-8")
            data = json.loads(body) if body else {}

            ticket = build_ticket(data)
            print_to_com1(ticket)

            print("[PRINT_AGENT] printed:", data)
            self._set_headers(200)
            self.wfile.write(b'{"ok":true}')

        except Exception as e:
            print("[PRINT_AGENT] error:", e)
            traceback.print_exc()
            self._set_headers(500)
            self.wfile.write(b'{"ok":false,"msg":"server error"}')


if __name__ == "__main__":
    server = HTTPServer((HOST, PORT), PrintHandler)
    print(f"[PRINT_AGENT] running at http://{HOST}:{PORT}")
    print("[PRINT_AGENT] POST /print")
    server.serve_forever()
