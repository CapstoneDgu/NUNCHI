#!/usr/bin/env python3
"""
NUNCHI · 프론트엔드 미리보기 서버
=================================

Spring Boot 를 띄우지 않고 브라우저에서 바로 확인하기 위한 작은 정적 서버.

application-local.yml 의 매핑을 그대로 모사한다:
    classpath:/static/front/        → URL 루트
    classpath:/templates_front/     → URL 루트

즉 두 폴더를 하나의 가상 루트로 합쳐서 서빙한다.

실행:
    python3 dev-server.py            # 기본 포트 5500
    python3 dev-server.py 8080       # 다른 포트로 띄우려면 인자로 지정

접속 URL (기본 포트 5500 기준):
    http://localhost:5500/                       → 홈(index.html)
    http://localhost:5500/S00-start.html
    http://localhost:5500/S01-mode.html
    http://localhost:5500/S02-dine.html
    http://localhost:5500/flowN/N02-menu.html    ← 메뉴 페이지

종료:
    Ctrl + C
"""

import http.server
import socketserver
import os
import sys
import posixpath
from urllib.parse import unquote

# ---- 두 정적 자원 루트 (우선순위 순) ----
HERE = os.path.dirname(os.path.abspath(__file__))
ROOTS = [
    os.path.join(HERE, "src", "main", "resources", "static", "front"),
    os.path.join(HERE, "src", "main", "resources", "templates_front"),
]


class MultiRootHandler(http.server.SimpleHTTPRequestHandler):
    """ROOTS 배열을 차례로 뒤져 가장 먼저 발견된 파일을 응답한다."""

    def translate_path(self, path):
        path = path.split("?", 1)[0].split("#", 1)[0]
        path = unquote(path)
        # 보안: 상위로 빠져나가는 경로 차단
        path = posixpath.normpath(path).lstrip("/").lstrip("\\")
        if path.startswith(".."):
            return os.path.join(ROOTS[0], "")

        for root in ROOTS:
            full = os.path.join(root, path)
            if os.path.isfile(full):
                return full
            # 디렉터리면 index.html 폴백
            if os.path.isdir(full):
                idx = os.path.join(full, "index.html")
                if os.path.isfile(idx):
                    return idx
        # 못 찾으면 첫 루트 기준 (404 처리)
        return os.path.join(ROOTS[0], path)

    def end_headers(self):
        # 브라우저 캐시 무력화 — 수정 즉시 반영
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, fmt, *args):
        # 깔끔한 로그
        sys.stdout.write("  %s\n" % (fmt % args))


def main():
    port = 5500
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            print(f"포트 번호가 올바르지 않습니다: {sys.argv[1]}")
            sys.exit(1)

    # 루트 존재 검증
    missing = [r for r in ROOTS if not os.path.isdir(r)]
    if missing:
        print("아래 폴더가 보이지 않습니다 (프로젝트 루트에서 실행하세요):")
        for m in missing:
            print("  - " + m)
        sys.exit(1)

    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", port), MultiRootHandler) as httpd:
        print("=" * 60)
        print(" NUNCHI 프론트 미리보기 서버 시작")
        print("=" * 60)
        print(f" 포트       : {port}")
        print(" 정적 루트  :")
        for r in ROOTS:
            print(f"   - {r}")
        print()
        print(" 바로가기:")
        print(f"   홈        http://localhost:{port}/")
        print(f"   메뉴(N02) http://localhost:{port}/flowN/N02-menu.html")
        print(f"   모드(S01) http://localhost:{port}/S01-mode.html")
        print(f"   포장(S02) http://localhost:{port}/S02-dine.html")
        print()
        print(" Chrome DevTools → 디바이스 툴바 → 720 × 1280 (Portrait) 권장")
        print(" 종료: Ctrl + C")
        print("=" * 60)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n서버를 종료합니다.")


if __name__ == "__main__":
    main()
