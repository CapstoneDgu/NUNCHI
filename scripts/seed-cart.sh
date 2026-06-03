#!/usr/bin/env bash
# ============================================================
# seed-cart.sh — 결제 플로우 시연용 데모 카트 채우기
#
# 사용:
#   ./scripts/seed-cart.sh                     # 새 세션 + 메뉴 3개 자동
#   ./scripts/seed-cart.sh <SESSION_ID>        # 기존 세션에 메뉴 3개 추가
#
# 출력:
#   세션 ID 와 카트 합계를 표시
#   브라우저 콘솔에 다음 한 줄로 sessionStorage 도 동기화 가능:
#     sessionStorage.setItem("sessionId", "X"); location.href="/flowP/P01-summary.html";
# ============================================================

set -euo pipefail

BASE="${BASE:-http://localhost:8080}"
SESSION_ID="${1:-}"

# 1. 세션이 없으면 새로 생성
if [[ -z "$SESSION_ID" ]]; then
  echo "→ 새 세션 생성 (NORMAL/ko)"
  SESSION_ID=$(curl -s -X POST "$BASE/api/sessions" \
    -H "Content-Type: application/json" \
    -d '{"mode":"NORMAL","language":"ko"}' \
    | python3 -c "import json,sys;print(json.load(sys.stdin)['data']['sessionId'])")
fi
echo "  sessionId = $SESSION_ID"

# 2. 백엔드 메뉴 상위 3개 가져오기 (인기 순)
echo "→ 인기 메뉴 3개 조회"
MENU_IDS=$(curl -s "$BASE/api/menus/top?limit=3" \
  | python3 -c "import json,sys;[print(m['menuId']) for m in json.load(sys.stdin)['data']]")

# 3. 각 메뉴를 수량 1로 카트에 추가
echo "→ 카트에 담기"
for MID in $MENU_IDS; do
  RESP=$(curl -s -X POST "$BASE/api/orders/cart/items" \
    -H "Content-Type: application/json" \
    -d "{\"sessionId\":$SESSION_ID,\"menuId\":$MID,\"quantity\":1,\"optionIds\":[]}")
  echo "  + menuId=$MID 추가됨"
done

# 4. 결과 요약
echo ""
echo "✅ 완료. 카트 상태:"
curl -s "$BASE/api/orders/cart/$SESSION_ID" | python3 -c "
import json, sys
d = json.load(sys.stdin)['data']
print(f\"   sessionId   : {d['sessionId']}\")
print(f\"   item count  : {len(d['items'])}\")
print(f\"   total       : {d['totalAmount']:,}원\")
print()
for it in d['items']:
    print(f\"   - {it['menuName']:20s} {it['unitPrice']:>6,}원 × {it['quantity']} = {it['itemTotal']:>7,}원\")"

echo ""
echo "▶ 브라우저 콘솔에 붙여넣기:"
echo "  sessionStorage.setItem(\"sessionId\", \"$SESSION_ID\");"
echo "  sessionStorage.setItem(\"mode\", \"normal\");"
echo "  sessionStorage.setItem(\"dineOption\", \"dine_in\");"
echo "  location.href = \"/flowP/P01-summary.html\";"
