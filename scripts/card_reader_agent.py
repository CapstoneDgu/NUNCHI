from http.server import BaseHTTPRequestHandler, HTTPServer
import json
import os
import re
import time
import traceback

HOST = "127.0.0.1"
PORT = 9200

COM_PORT = os.environ.get("DUALI_PORT", "COM6")
BAUD = int(os.environ.get("DUALI_BAUD", "115200"))
MOCK = os.environ.get("DUALI_MOCK", "0") == "1"
DEBUG = os.environ.get("DUALI_DEBUG", "0") == "1"

_MSR_RE = re.compile(rb"MsrLen\((\d+)\)")


def read_card(timeout=30):
    if MOCK:
        time.sleep(float(os.environ.get("DUALI_MOCK_DELAY", "1.5")))
        return {"type": "ic", "info": "MOCK"}
    import serial
    try:
        s = serial.Serial(COM_PORT, BAUD, timeout=0.3)
    except Exception as e:
        print("[CARD_AGENT] serial open failed:", e)
        return None
    try:
        s.dtr = True
        s.rts = True
        try:
            s.reset_input_buffer()
        except Exception:
            pass
        buf = b""
        dl = time.time() + timeout
        while time.time() < dl:
            d = s.read(256)
            if not d:
                continue
            buf += d
            if DEBUG:
                print("[CARD_AGENT] RX:", d.decode("latin1", "replace"))
            m = _MSR_RE.search(buf)
            if m and int(m.group(1)) > 0:
                return {"type": "msr", "msrlen": int(m.group(1))}
            if b"EMV OK" in buf:
                return {"type": "ic"}
            if len(buf) > 8192:
                buf = buf[-2048:]
        return None
    finally:
        try:
            s.close()
        except Exception:
            pass


class Handler(BaseHTTPRequestHandler):
    def _send(self, st, obj):
        self.send_response(st)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(json.dumps(obj, ensure_ascii=False).encode("utf-8"))

    def do_OPTIONS(self):
        self._send(200, {"ok": True})

    def do_GET(self):
        try:
            if self.path.startswith("/status"):
                self._send(200, {"ok": True, "port": COM_PORT, "baud": BAUD, "mock": MOCK})
                return
            if self.path.startswith("/diag"):
                info = {"port": COM_PORT, "baud": BAUD, "mock": MOCK}
                if not MOCK:
                    import serial
                    try:
                        s = serial.Serial(COM_PORT, BAUD, timeout=2)
                        s.dtr = True
                        s.rts = True
                        s.reset_input_buffer()
                        d = s.read(300)
                        s.close()
                        info["bytes"] = len(d)
                        info["sample"] = d.decode("latin1", "replace")
                    except Exception as e:
                        info["error"] = str(e)
                print("[CARD_AGENT] diag:", info)
                self._send(200, {"ok": True, "diag": info})
                return
            if self.path.startswith("/card"):
                print("[CARD_AGENT] /card requested - waiting up to 30s for IC/MSR")
                r = read_card(30)
                if r:
                    print("[CARD_AGENT] detected:", r)
                    o = {"ok": True, "present": True}
                    o.update(r)
                    self._send(200, o)
                else:
                    print("[CARD_AGENT] /card timeout - nothing detected")
                    self._send(200, {"ok": False, "reason": "timeout"})
                return
            self._send(404, {"ok": False, "msg": "not found"})
        except Exception as e:
            print("[CARD_AGENT] error:", e)
            traceback.print_exc()
            self._send(500, {"ok": False, "msg": "server error"})

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    try:
        print("=" * 56)
        print(f"[CARD_AGENT] serial {COM_PORT} @ {BAUD} mock={MOCK}")
        print(f"[CARD_AGENT] http://{HOST}:{PORT}  (GET /status /diag /card)")
        print("=" * 56)
        HTTPServer((HOST, PORT), Handler).serve_forever()
    except KeyboardInterrupt:
        pass
    except Exception as e:
        traceback.print_exc()
        print("=" * 56)
        print("[CARD_AGENT] startup failed. Please capture the error above.")
        try:
            input("Press Enter to exit...")
        except Exception:
            pass
