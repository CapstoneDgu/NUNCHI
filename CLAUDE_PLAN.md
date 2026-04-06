# 주문 전체 플로우 구현 계획 (수정본)

## 핵심 설계 방침

- FastAPI(AI)와 React(터치) 모두 **동일한 `/api/**` 엔드포인트** 호출
- MCP 별도 컨트롤러 X — 비즈니스 로직은 동일, 호출자만 다를 뿐
- AI 전용 기능(판매통계, 눈치 트리거 등)만 `/api/mcp/**` 에 추가
- 장바구니 = `PENDING` 상태의 `Order`

---

## 전체 주문 흐름

### [일반 주문 — 터치]

```
[React 프론트엔드]
    │
    ├─ POST /api/sessions              → 세션 생성 (매장/포장 선택)
    ├─ GET  /api/menus/categories      → 카테고리 목록
    ├─ GET  /api/menus?categoryId=1    → 메뉴 목록
    ├─ GET  /api/menus/{menuId}        → 메뉴 상세 (옵션 확인)
    ├─ POST /api/orders/cart           → 장바구니(Order) 생성
    ├─ POST /api/orders/cart/items     → 아이템 담기
    ├─ PUT  /api/orders/cart/items/{id}→ 수량 수정
    ├─ DELETE /api/orders/cart/items/{id} → 아이템 제거
    ├─ GET  /api/orders/cart/{sessionId}  → 장바구니 확인
    └─ POST /api/orders/{orderId}/confirm → 주문 확정 → 결제로 이동
```

---

### [AI 음성 주문 — FastAPI MCP]

```
[손님 음성]
    ↓
[FastAPI]
  1. STT (Whisper v3): 음성 → 텍스트
  2. LLM (ChatGPT): 의도 분석 + 개체 추출
     - 의도: 메뉴탐색 / 담기 / 수량변경 / 취소 / 주문확정
     - 개체: 메뉴명("아메리카노"), 수량(2), 옵션("ICE")
  3. MCP Tool 선택 → Spring Boot API 호출 (동일한 /api/**)
     │
     ├─ GET  /api/menus?categoryId=    → "커피 뭐 있어?"
     ├─ GET  /api/menus/{menuId}       → "아메리카노 옵션 뭐야?"
     ├─ POST /api/orders/cart/items    → "아메리카노 ICE 2잔 담아줘"
     ├─ GET  /api/orders/cart/{sessionId} → "지금 뭐 담았어?"
     ├─ DELETE /api/orders/cart/items/{id} → "카페라떼 빼줘"
     └─ POST /api/orders/{orderId}/confirm → "주문할게"
  4. TTS: 처리 결과 → 음성으로 안내
     "아메리카노 ICE 2잔 담았어요. 총 9,000원입니다."

[Spring Boot]
  → 동일한 비즈니스 로직 처리
  → PostgreSQL 저장
```

---

## API 목록

### [A] menu 도메인

| Method | URL | 설명 |
|--------|-----|------|
| GET | `/api/menus/categories` | 카테고리 목록 |
| GET | `/api/menus?categoryId={id}` | 메뉴 목록 (categoryId 없으면 전체) |
| GET | `/api/menus/{menuId}` | 메뉴 상세 (옵션그룹 + 옵션 포함) |

### [B] order 도메인

| Method | URL | 설명 |
|--------|-----|------|
| POST | `/api/orders/cart` | 장바구니 생성 (세션 ID 바인딩) |
| GET | `/api/orders/cart/{sessionId}` | 현재 장바구니 조회 |
| POST | `/api/orders/cart/items` | 아이템 추가 |
| PUT | `/api/orders/cart/items/{orderItemId}` | 수량 수정 |
| DELETE | `/api/orders/cart/items/{orderItemId}` | 아이템 삭제 |
| POST | `/api/orders/{orderId}/confirm` | 주문 확정 |
| PATCH | `/api/orders/{orderId}/cancel` | 주문 취소 |

### [C] AI 전용 — 일반 UI에서는 안 쓰는 기능

| Method | URL | 설명 |
|--------|-----|------|
| GET | `/api/mcp/menus/recommendations` | 오늘 판매량 TOP5 (AI 추천용) |
| GET | `/api/mcp/sessions/{sessionId}/behavior` | 눈치 트리거 데이터 (체류시간, 반복탐색) |

---

## 구현 순서 & 에이전트 전략

```
Phase 1 — menu 도메인 (독립)
  에이전트 A 단독

Phase 2 — order 도메인 (Phase 1 완료 후)
  에이전트 B 단독

Phase 3 — AI 전용 API (Phase 1, 2 완료 후, 필요 시)
  에이전트 C 단독
```

---

## Phase 1 — menu 구현 범위

**구현 파일:**
- `MenuService.java`
- `MenuController.java`
- `MenuCategoryResponse.java` — `from(MenuCategory)` 팩터리
- `MenuResponse.java` — `from(Menu)` 팩터리
- `MenuDetailResponse.java` — 옵션그룹 + 옵션 중첩 record

```java
public record MenuDetailResponse(
    Long menuId, String name, Integer price,
    Boolean isSoldOut, String imageUrl,
    List<OptionGroupInfo> optionGroups
) {
    public record OptionGroupInfo(Long groupId, String groupName, List<OptionInfo> options) {}
    public record OptionInfo(Long optionId, String name, Integer extraPrice) {}
}
```

- `global/exception/errorcode/MenuErrorCode.java` — `NOT_FOUND_MENU`
- `global/exception/domainException/MenuException.java`

**주의:**
- 메뉴 상세 조회 시 옵션그룹 + 옵션 N+1 방지 → fetch join

---

## Phase 2 — order 구현 범위

**구현 파일:**
- `OrderCreateRequest.java` (채우기) — `Long sessionId`
- `CartItemAddRequest.java` (신규) — `Long menuId, Integer quantity, List<Long> optionIds`
- `CartItemUpdateRequest.java` (신규) — `Integer quantity`
- `OrderItemResponse.java` (채우기) — `orderItemId, menuName, unitPrice, quantity, options`
- `OrderResponse.java` (채우기) — `orderId, sessionId, totalAmount, orderStatus, items`
- `OrderService.java`
- `OrderController.java`
- `global/exception/errorcode/OrderErrorCode.java` — `NOT_FOUND_ORDER, NOT_FOUND_ORDER_ITEM, ORDER_ALREADY_CONFIRMED`
- `global/exception/domainException/OrderException.java`

**주의:**
- 아이템 추가 시 Menu 조회 → `menuName`, `unitPrice` 스냅샷 저장
- 옵션 추가 시 `OrderItemOption` 함께 저장 (optionName, extraPrice 스냅샷)
- 총금액 = `(unitPrice + 옵션 extraPrice 합) * quantity` 합산 → `Order.updateTotalAmount()`
- COMPLETED 상태 Order 수정 시 `ORDER_ALREADY_CONFIRMED` 예외

---

## 구현 착수 기준

- `[A] 메뉴 구현해줘` → Phase 1 에이전트 실행
- `[B] 주문 구현해줘` → Phase 2 에이전트 실행 (Phase 1 완료 후)
- `전체 구현해줘` → Phase 1 → 2 순서로 순차 실행