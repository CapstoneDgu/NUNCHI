# 전체 주문 플로우 시뮬레이션 보고서

## 시나리오
> 고객이 키오스크에서 **동국 비빔밥(7,500원) + 계란 추가 옵션(500원) x2**와 **동국 순두부(6,500원) x1**을 주문하고 IC카드로 결제한다.

---

## STEP 1. 세션 생성

```
POST /api/sessions
```

**요청**
```json
{ "mode": "NORMAL", "language": "ko" }
```

**코드 흐름**
- `SessionService.createSession()` → `KioskSession.create(NORMAL, "ko")` → DB 저장
- 초기 상태: `sessionStatus = ACTIVE`

**응답** `201 Created`
```json
{
  "code": 201,
  "msg": "생성이 완료되었습니다.",
  "data": {
    "sessionId": 1,
    "mode": "NORMAL",
    "status": "ACTIVE",
    "language": "ko",
    "createdAt": "2026-04-07T10:00:00"
  }
}
```

---

## STEP 2. 카테고리 목록 조회

```
GET /api/menus/categories
```

**코드 흐름**
- `MenuService.getCategories()` → `menuCategoryRepository.findAll()`

**응답** `200 OK`
```json
{
  "code": 200,
  "msg": "요청이 성공했습니다.",
  "data": [
    { "categoryId": 1, "name": "학생식당" },
    { "categoryId": 2, "name": "분식당" }
  ]
}
```

---

## STEP 3. 메뉴 목록 조회

```
GET /api/menus?categoryId=1
```

**코드 흐름**
- `MenuService.getMenus(1L)` → `menuRepository.findByCategory_CategoryId(1)`

**응답** `200 OK`
```json
{
  "code": 200,
  "msg": "요청이 성공했습니다.",
  "data": [
    { "menuId": 1, "name": "동국 비빔밥", "price": 7500, "isSoldOut": false },
    { "menuId": 2, "name": "동국 순두부", "price": 6500, "isSoldOut": false },
    ...
  ]
}
```

---

## STEP 4. 메뉴 상세 조회 (옵션 확인)

```
GET /api/menus/1
```

**코드 흐름**
- `MenuService.getMenuDetail(1L)`
- `menuRepository.findById(1)` → 메뉴 조회
- `menuOptionGroupRepository.findByMenu_MenuId(1)` → 옵션그룹 조회
- `menuOptionRepository.findByOptionGroup_OptionGroupIdIn([1])` → 옵션 일괄 조회 (N+1 방지)

**응답** `200 OK`
```json
{
  "code": 200,
  "msg": "요청이 성공했습니다.",
  "data": {
    "menuId": 1,
    "name": "동국 비빔밥",
    "price": 7500,
    "isSoldOut": false,
    "imageUrl": "https://...",
    "optionGroups": [
      {
        "groupId": 1,
        "groupName": "추가 옵션",
        "options": [
          { "optionId": 1, "name": "계란 추가", "extraPrice": 500 },
          { "optionId": 2, "name": "김치 추가", "extraPrice": 300 }
        ]
      }
    ]
  }
}
```

---

## STEP 5. 장바구니 담기 - 동국 비빔밥 x2 (계란 추가)

```
POST /api/orders/cart/items
```

**요청**
```json
{
  "sessionId": 1,
  "menuId": 1,
  "quantity": 2,
  "optionIds": [1]
}
```

**코드 흐름**
1. `@Valid` 검증: `sessionId(@Positive)`, `menuId(@Positive)`, `quantity(@Min(1))`, `optionIds(List<@NotNull @Positive>)` 통과
2. `menuRepository.findById(1)` → 동국 비빔밥(7500원) 조회
3. `menuOptionRepository.findById(1)` → 계란 추가(500원) 조회
4. `CartItem` 생성 (UUID 자동 생성: `"a1b2-c3d4-..."`)
5. `cartRedisRepository.getItems(1)` → 빈 리스트
6. 리스트에 추가 후 `cartRedisRepository.saveItems(1, items)` → Redis 저장 (TTL 30분)

**응답** `200 OK`
```json
{
  "code": 200,
  "msg": "요청이 성공했습니다.",
  "data": {
    "sessionId": 1,
    "items": [
      {
        "itemId": "a1b2-c3d4-e5f6",
        "menuId": 1,
        "menuName": "동국 비빔밥",
        "unitPrice": 7500,
        "quantity": 2,
        "itemTotal": 16000,
        "options": [
          { "optionId": 1, "optionName": "계란 추가", "extraPrice": 500 }
        ]
      }
    ],
    "totalAmount": 16000
  }
}
```
> itemTotal = (7500 + 500) * 2 = **16,000원**

---

## STEP 6. 장바구니 담기 - 동국 순두부 x1 (옵션 없음)

```
POST /api/orders/cart/items
```

**요청**
```json
{
  "sessionId": 1,
  "menuId": 2,
  "quantity": 1,
  "optionIds": []
}
```

**코드 흐름**
- `cartRedisRepository.getItems(1)` → 기존 1개 아이템 조회
- 새 `CartItem` 추가 후 저장 (총 2개)

**응답** `200 OK`
```json
{
  "code": 200,
  "msg": "요청이 성공했습니다.",
  "data": {
    "sessionId": 1,
    "items": [
      {
        "itemId": "a1b2-c3d4-e5f6",
        "menuName": "동국 비빔밥",
        "unitPrice": 7500,
        "quantity": 2,
        "itemTotal": 16000,
        "options": [{ "optionId": 1, "optionName": "계란 추가", "extraPrice": 500 }]
      },
      {
        "itemId": "b2c3-d4e5-f6a7",
        "menuName": "동국 순두부",
        "unitPrice": 6500,
        "quantity": 1,
        "itemTotal": 6500,
        "options": []
      }
    ],
    "totalAmount": 22500
  }
}
```
> totalAmount = 16,000 + 6,500 = **22,500원**

---

## STEP 7. 장바구니 확인

```
GET /api/orders/cart/1
```

**코드 흐름**
- `cartRedisRepository.getItems(1)` → Redis에서 2개 아이템 조회
- `CartResponse.from(1, items)` 구성

**응답**: STEP 6 응답과 동일

---

## STEP 8. 주문 확정 (Redis → PostgreSQL)

```
POST /api/orders/confirm
```

**요청**
```json
{ "sessionId": 1 }
```

**코드 흐름**
1. `cartRedisRepository.getItems(1)` → 2개 아이템
2. 빈 장바구니 체크 통과
3. `Order.create(1)` → DB 저장 (orderId=1, status=PENDING, totalAmount=0)
4. **루프 - 아이템1 (동국 비빔밥)**
   - `OrderItem.create(order, 1, 2, "동국 비빔밥", 7500)` → DB 저장
   - `OrderItemOption.create(orderItem, 1, "계란 추가", 500)` → DB 저장
   - optionExtra=500, totalAmount += (7500+500)*2 = 16,000
5. **루프 - 아이템2 (동국 순두부)**
   - `OrderItem.create(order, 2, 1, "동국 순두부", 6500)` → DB 저장
   - 옵션 없음, totalAmount += 6500*1 = 6,500
6. `order.updateTotalAmount(22500)` + `order.complete()` → status=COMPLETED
7. `cartRedisRepository.deleteCart(1)` → Redis 장바구니 삭제
8. 루프에서 수집한 메모리 데이터로 응답 직접 구성 (DB 재조회 없음)

**응답** `200 OK`
```json
{
  "code": 200,
  "msg": "요청이 성공했습니다.",
  "data": {
    "orderId": 1,
    "sessionId": 1,
    "totalAmount": 22500,
    "orderStatus": "COMPLETED",
    "items": [
      {
        "orderItemId": 1,
        "menuId": 1,
        "menuName": "동국 비빔밥",
        "unitPrice": 7500,
        "quantity": 2,
        "itemTotal": 16000,
        "options": [{ "optionId": 1, "optionName": "계란 추가", "extraPrice": 500 }]
      },
      {
        "orderItemId": 2,
        "menuId": 2,
        "menuName": "동국 순두부",
        "unitPrice": 6500,
        "quantity": 1,
        "itemTotal": 6500,
        "options": []
      }
    ]
  }
}
```

---

## STEP 9. 결제 요청

```
POST /api/payments
```

**요청**
```json
{ "orderId": 1, "method": "IC_CARD" }
```

**코드 흐름**
1. `@Valid`: `orderId(@Positive)` 통과
2. `orderRepository.findById(1)` → COMPLETED 확인 통과
3. `paymentRepository.findTopByOrderIdOrderByCreatedAtDesc(1)` → 결과 없음 → 중복 결제 없음 확인
4. `Payment.create(1, IC_CARD)` → DB 저장 (paymentId=1, status=PENDING)

**응답** `201 Created`
```json
{
  "code": 201,
  "msg": "생성이 완료되었습니다.",
  "data": {
    "paymentId": 1,
    "orderId": 1,
    "method": "IC_CARD",
    "status": "PENDING",
    "createdAt": "2026-04-07T10:02:00"
  }
}
```

---

## STEP 10. 결제 성공 처리 (카드 단말기 승인 콜백)

```
PATCH /api/payments/1/success
```

**코드 흐름**
1. `paymentRepository.findByIdWithLock(1)` → `SELECT ... FOR UPDATE` (비관적 락)
2. `payment.getStatus() == PENDING` → 통과
3. `payment.success()` → status=SUCCESS

**응답** `200 OK`
```json
{
  "code": 200,
  "msg": "요청이 성공했습니다.",
  "data": {
    "paymentId": 1,
    "orderId": 1,
    "method": "IC_CARD",
    "status": "SUCCESS",
    "createdAt": "2026-04-07T10:02:00"
  }
}
```

---

## STEP 11. 세션 종료

```
PATCH /api/sessions/1/complete
```

**코드 흐름**
1. `kioskSessionRepository.findByIdWithLock(1)` → `SELECT ... FOR UPDATE` (비관적 락)
2. `session.getSessionStatus() == ACTIVE` → 통과
3. `session.complete()` → status=COMPLETED

**응답** `200 OK`
```json
{
  "code": 200,
  "msg": "요청이 성공했습니다.",
  "data": {
    "sessionId": 1,
    "mode": "NORMAL",
    "status": "COMPLETED",
    "language": "ko",
    "createdAt": "2026-04-07T10:00:00"
  }
}
```

---

## 최종 금액 검증

| 항목 | 계산 | 금액 |
|------|------|------|
| 동국 비빔밥 x2 (계란 추가 x1) | (7,500 + 500) × 2 | 16,000원 |
| 동국 순두부 x1 | 6,500 × 1 | 6,500원 |
| **합계** | | **22,500원** |

- 장바구니 totalAmount: 22,500원 ✓
- 주문 확정 totalAmount: 22,500원 ✓
- 결제 금액 불일치 없음 ✓

---

## 시뮬레이션 결과

전체 11단계 이상 없이 정상 동작 확인.
