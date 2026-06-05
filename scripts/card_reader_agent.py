# -*- coding: utf-8 -*-
# ============================================================
# card_reader_agent.py - Duali card "detect" agent (no VAN / no real charge)
#
# Controls Duali DKSRDE633R via DualCardDll.dll (Windows, serial COM6).
# Detects a card by IC insert (DE_IC_PowerOn) OR magnetic swipe (MSR).
# It only DETECTS - it does NOT approve/charge.
#
# Reader on this kiosk: COM6, baud 115200.
#
# Run (next to DualCardDll.dll):
#   python card_reader_agent.py
#
# Env overrides:
#   DUALI_PORT=6  DUALI_BAUD=115200  DUALI_SLOT=0  DUALI_DLL=DualCardDll.dll
#   DUALI_MOCK=1  -> no device; /card returns a fake IC card after 1.5s
#   DUALI_MSR=1   -> also try magnetic-stripe read each poll.
#                    !! ApiMsrReadTrack2 signature is BEST-EFFORT; verify with the
#                       DUALPAY SDK header before enabling. Default OFF.
#
# HTTP API (frontend card-terminal.js):
#   GET /status -> { ok, port, baud, dll, version, mock, msr }
#   GET /card   -> wait up to 30s for IC insert or MSR swipe
#                  -> { ok:true, type:"ic", atr:"..." } | { ok:true, type:"msr", track:"masked" }
#                  -> { ok:false, reason:"timeout" }
# ============================================================
from http.server import BaseHTTPRequestHandler, HTTPServer
import json
import os
import time
import traceback

HOST = "127.0.0.1"
PORT = 9200

COM_PORT = int(os.environ.get("DUALI_PORT", "6"))
BAUD     = int(os.environ.get("DUALI_BAUD", "115200"))
SLOT     = int(os.environ.get("DUALI_SLOT", "0"))
DLL_NAME = os.environ.get("DUALI_DLL", "DualCardDll.dll")
MOCK     = os.environ.get("DUALI_MOCK", "0") == "1"
MSR_ON   = os.environ.get("DUALI_MSR", "0") == "1"

DE_OK = 0
_dll = None
_port_open = False


def load_dll():
    global _dll
    if _dll is not None:
        return _dll
    import ctypes
    try:
        d = ctypes.WinDLL(DLL_NAME)
    except Exception:
        d = ctypes.CDLL(DLL_NAME)
    ci = ctypes.c_int
    LPINT = ctypes.POINTER(ctypes.c_int)
    LPB = ctypes.c_char_p
    B = ctypes.c_ubyte
    d.DE_InitPort.argtypes = [ci, ci];                 d.DE_InitPort.restype = ci
    d.DE_ClosePort.argtypes = [ci];                    d.DE_ClosePort.restype = None
    d.DE_GetVersion.argtypes = [ci, LPINT, LPB];       d.DE_GetVersion.restype = ci
    d.DE_IC_PowerOn.argtypes = [ci, B, LPINT, LPB];    d.DE_IC_PowerOn.restype = ci
    d.DE_IC_PowerOff.argtypes = [ci, B];               d.DE_IC_PowerOff.restype = ci
    _dll = d
    return _dll


def open_port():
    global _port_open
    if MOCK:
        _port_open = True
        return True
    d = load_dll()
    rc = d.DE_InitPort(COM_PORT, BAUD)
    _port_open = (rc == COM_PORT)
    if not _port_open:
        print(f"[CARD_AGENT] DE_InitPort failed rc={rc} (COM{COM_PORT},{BAUD})")
    return _port_open


def get_version():
    if MOCK:
        return "MOCK-FW"
    try:
        import ctypes
        d = load_dll()
        ol = ctypes.c_int(0)
        buf = ctypes.create_string_buffer(256)
        rc = d.DE_GetVersion(COM_PORT, ctypes.byref(ol), buf)
        return buf.raw[:ol.value].hex().upper() if rc == DE_OK and ol.value > 0 else f"(rc={rc})"
    except Exception as e:
        return f"(err {e})"


def _try_ic():
    import ctypes
    d = load_dll()
    ol = ctypes.c_int(0)
    buf = ctypes.create_string_buffer(512)
    rc = d.DE_IC_PowerOn(COM_PORT, SLOT, ctypes.byref(ol), buf)
    if rc == DE_OK and ol.value > 0:
        atr = buf.raw[:ol.value].hex().upper()
        try:
            d.DE_IC_PowerOff(COM_PORT, SLOT)
        except Exception:
            pass
        return atr
    return None


def _try_msr():
    # BEST-EFFORT signature - verify with DUALPAY SDK header before DUALI_MSR=1.
    import ctypes
    d = load_dll()
    fn = getattr(d, "ApiMsrReadTrack2", None)
    if fn is None:
        return None
    try:
        fn.argtypes = [ctypes.c_char_p, ctypes.POINTER(ctypes.c_int)]
        fn.restype = ctypes.c_int
        buf = ctypes.create_string_buffer(256)
        ln = ctypes.c_int(0)
        rc = fn(buf, ctypes.byref(ln))
        n = ln.value if ln.value > 0 else (rc if rc > 0 else 0)
        if n > 0:
            raw = buf.raw[:n].decode("ascii", errors="ignore")
            return ("*" * max(0, len(raw) - 4)) + raw[-4:]
    except Exception as e:
        print("[CARD_AGENT] MSR read error (check signature):", e)
    return None


def read_card(timeout=30):
    if MOCK:
        time.sleep(1.5)
        return {"type": "ic", "atr": "3B 8F 80 01 (MOCK ATR)"}
    if not _port_open and not open_port():
        return None
    dl = time.time() + timeout
    while time.time() < dl:
        atr = _try_ic()
        if atr:
            return {"type": "ic", "atr": atr}
        if MSR_ON:
            t = _try_msr()
            if t:
                return {"type": "msr", "track": t}
        time.sleep(0.4)
    return None


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
                self._send(200, {"ok": _port_open, "port": COM_PORT, "baud": BAUD, "dll": DLL_NAME,
                                 "version": get_version(), "mock": MOCK, "msr": MSR_ON})
                return
            if self.path.startswith("/card"):
                r = read_card(30)
                if r:
                    print(f"[CARD_AGENT] detected: {r}")
                    o = {"ok": True, "present": True}
                    o.update(r)
                    self._send(200, o)
                else:
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
    print("=" * 56)
    print(f"[CARD_AGENT] DLL={DLL_NAME} COM{COM_PORT} baud={BAUD} slot={SLOT} mock={MOCK} msr={MSR_ON}")
    if not MOCK:
        if open_port():
            print(f"[CARD_AGENT] port open OK. firmware={get_version()}")
        else:
            print("[CARD_AGENT] WARNING: port open failed - check COM/DLL/reader")
    print("=" * 56)
    print(f"[CARD_AGENT] http://{HOST}:{PORT}  (GET /status /card)")
    HTTPServer((HOST, PORT), Handler).serve_forever()
