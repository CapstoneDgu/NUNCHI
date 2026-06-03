#!/usr/bin/env bash
# NUNCHI 키오스크 실행 스크립트 (macOS / Chrome)
#
# 좌우 스와이프 → 브라우저 "뒤로/앞으로 가기" 이동을 막는 가장 확실한 방법은
# Chrome 자체의 OverscrollHistoryNavigation 기능을 끄는 것이다.
# CSS(overscroll-behavior-x:none)로도 막지만, 트랙패드/터치 제스처는
# 브라우저 레벨에서 가로채므로 아래 플래그로 이중 차단한다. (QA2 #4)
#
# 사용:  ./scripts/kiosk-launch.sh  [URL]
#   URL 미지정 시 http://localhost:8080/ 로 실행

set -euo pipefail

URL="${1:-http://localhost:8080/}"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

# 키오스크용 임시 프로필 (기존 개인 프로필과 분리)
PROFILE_DIR="${TMPDIR:-/tmp}/nunchi-kiosk-profile"

exec "$CHROME" \
  --kiosk "$URL" \
  --user-data-dir="$PROFILE_DIR" \
  --disable-features=OverscrollHistoryNavigation,TranslateUI \
  --overscroll-history-navigation=0 \
  --disable-pinch \
  --no-first-run \
  --no-default-browser-check \
  --noerrdialogs \
  --disable-session-crashed-bubble \
  --disable-infobars \
  --autoplay-policy=no-user-gesture-required
