# -*- coding: utf-8 -*-
# ============================================================
# print_server.py — NUNCHI 키오스크 로컬 프린트 에이전트 (감열 영수증 프린터)
#
# 역할:
#   키오스크 프론트(receipt.js)가 POST /print 로 보낸 "텍스트 양식(lines)" 을
#   CP949 로 인코딩해 ticket.txt 로 저장한 뒤, print_ticket.bat 으로 실제
#   감열 프린터(WSP-CP383 등)에 인쇄한다.
#
# 요청 본문(JSON):
#   {
#     "type": "receipt" | "ticket",
#     "orderNumber": "A-12",
#     "lines": ["...영수증 한 줄...", "..."]   # 프론트에서 폭(32칸)에 맞춰 정렬한 양식
#   }
#   - lines 가 있으면 그대로 인쇄(프론트가 양식을 만든다).
#   - lines 가 없으면(구버전 호출) 아래 build_ticket 의 기본 양식으로 폴백.
#
# 실행:  python print_server.py   (Windows, 키오스크 PC)
# ============================================================
from http.server import BaseHTTPRequestHandler, HTTPServer
import json
import subprocess
from pathlib import Path
from datetime import datetime
import traceback

HOST = "127.0.0.1"
PORT = 9100

BASE_DIR = Path(r"C:\Users\G_Series\Desktop")
TICKET_PATH = BASE_DIR / "ticket.txt"
BAT_PATH = BASE_DIR / "print_ticket.bat"


def safe_line(text, max_len=48):
    if text is None:
        return ""
    text = str(text).replace("\r", " ").replace("\n", " ")
    return text[:max_len]


def build_ticket(data):
    # 1) 프론트가 만든 양식(lines)이 오면 그대로 인쇄한다.
    lines = data.get("lines")
    if isinstance(lines, list) and lines:
        out = [safe_line(ln) for ln in lines]
        out += ["", "", ""]   # 절취용 여백
        return "\r\n".join(out)

    # 2) (폴백) lines 가 없으면 기존 기본 양식으로 생성.
    order_number = safe_line(data.get("orderNumber", "A-000"), 16)
    items = data.get("items", [])
    print_type = data.get("type", "ticket")

    title = "주문번호표" if print_type == "ticket" else "영수증"

    fb = []
    fb.append("----------------")
    fb.append(" NUNCHI KIOSK")
    fb.append("----------------")
    fb.append(title)
    fb.append("번호: " + order_number)
    fb.append(datetime.now().strftime("%Y-%m-%d %H:%M"))
    fb.append("")

    if isinstance(items, list) and items:
        for item in items:
            fb.append(safe_line(item, 24))
    else:
        fb.append("주문 항목 없음")

    fb.append("")
    fb.append("잠시만 기다려주세요")
    fb.append("----------------")
    fb.append("")
    fb.append("")
    fb.append("")

    return "\r\n".join(fb)


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

            BASE_DIR.mkdir(parents=True, exist_ok=True)

            ticket = build_ticket(data)

            # WSP-CP383(RX) 한글 출력용: CP949
            TICKET_PATH.write_bytes(ticket.encode("cp949", errors="replace"))

            result = subprocess.run(
                ["cmd", "/c", str(BAT_PATH), str(TICKET_PATH)],
                capture_output=True,
                text=True,
                timeout=5
            )

            if result.returncode != 0:
                print("[PRINT_AGENT] print failed:", result.stderr)
                self._set_headers(500)
                self.wfile.write(b'{"ok":false,"msg":"print failed"}')
                return

            print("[PRINT_AGENT] printed:", data.get("type"), data.get("orderNumber"))
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
