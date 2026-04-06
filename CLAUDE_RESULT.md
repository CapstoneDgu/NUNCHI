# 주문 플로우 최종 구현 보고

---

## 개발 요약

| 도메인 | API 수 | 저장소 |
|--------|--------|--------|
| Menu | 3 | PostgreSQL |
| Session | 2 | PostgreSQL |
| Order (장바구니) | 4 | **Redis** |
| Order (주문 확정/취소) | 2 | PostgreSQL |
| Payment | 4 | PostgreSQL |
| **합계** | **15** | |

---

## 전체 API 목록

### MenuController `GET /api/menus/**`
| Method | URL | 설명 |
|--------|-----|------|
| GET | `/api/menus/categories` | 카테고리 목록 |
| GET | `/api/menus?categoryId={id}` | 메뉴 목록 (없으면 전체) |
| GET | `/api/menus/{menuId}` | 메뉴 상세 + 옵션그룹 + 옵션 |

### SessionController `POST|PATCH /api/sessions/**`
| Method | URL | 설명 |
|--------|-----|------|
| POST | `/api/sessions` | 세션 생성 → 201 |
| PATCH | `/api/sessions/{sessionId}/complete` | 세션 완료 |

### OrderController `/api/orders/**`
| Method | URL | 설명 |
|--------|-----|------|
| GET | `/api/orders/cart/{sessionId}` | 장바구니 조회 (Redis) |
| POST | `/api/orders/cart/items` | 아이템 추가 (Redis) |
| PUT | `/api/orders/cart/{sessionId}/items/{itemId}` | 수량 수정 (Redis) |
| DELETE | `/api/orders/cart/{sessionId}/items/{itemId}` | 아이템 삭제 (Redis) |
| POST | `/api/orders/confirm` | 주문 확정 → Redis 읽어서 DB 저장 |
| PATCH | `/api/orders/{orderId}/cancel` | 주문 취소 |

### PaymentController `/api/payments/**`
| Method | URL | 설명 |
|--------|-----|------|
| POST | `/api/payments` | 결제 요청 → 201 |
| PATCH | `/api/payments/{paymentId}/success` | 결제 성공 |
| PATCH | `/api/payments/{paymentId}/fail` | 결제 실패 |
| GET | `/api/payments/{paymentId}` | 결제 조회 |

---

## QA 결과

### 수정된 버그 (3건)
| 위치 | 버그 | 처리 |
|------|------|------|
| `OrderService.updateItem` | 없는 itemId 수정 시 예외 없이 통과 | `NOT_FOUND_CART_ITEM(404)` 추가 |
| `OrderService.removeItem` | 없는 itemId 삭제 시 예외 없이 통과 | `NOT_FOUND_CART_ITEM(404)` 추가 |
| `OrderService.confirmOrder` | 빈 장바구니로 주문 확정 시 빈 Order DB 저장 | `EMPTY_CART(400)` 추가 |

### 이상 없는 항목
- 메뉴 상세 조회 N+1 방지 (IN 쿼리 일괄 조회)
- Redis TTL 30분 자동 만료
- 주문 확정 후 Redis 장바구니 자동 삭제
- 결제 중복 처리 방지 (PENDING 상태 아니면 예외)
- 세션 상태 검증 (ACTIVE 아닌 세션 완료 요청 차단)
- 메뉴명/단가 주문 시점 스냅샷 저장

---

## 전체 주문 플로우

```
[터치 주문]
1.  POST /api/sessions
      body: { mode: "NORMAL", language: "ko" }
      → sessionId 발급

2.  GET /api/menus/categories
      → 카테고리 목록 조회

3.  GET /api/menus?categoryId=1
      → 메뉴 목록 조회

4.  GET /api/menus/{menuId}
      → 메뉴 상세 + 옵션 확인

5.  POST /api/orders/cart/items
      body: { sessionId, menuId, quantity, optionIds }
      → Redis에 아이템 저장 (key: cart:{sessionId}, TTL 30분)

6.  PUT /api/orders/cart/{sessionId}/items/{itemId}
      body: { quantity: 3 }
      → Redis 수량 수정

7.  DELETE /api/orders/cart/{sessionId}/items/{itemId}
      → Redis 아이템 삭제

8.  GET /api/orders/cart/{sessionId}
      → Redis 장바구니 확인

9.  POST /api/orders/confirm
      body: { sessionId }
      → Redis 읽어서 PostgreSQL에 Order + OrderItem 저장
      → Redis 장바구니 삭제
      → orderId 반환

10. POST /api/payments
      body: { orderId, method: "IC_CARD" }
      → Payment(PENDING) 생성 → paymentId 반환

11. [카드 단말기 승인 완료 시]
    PATCH /api/payments/{paymentId}/success
      → Payment(SUCCESS) 처리

12. PATCH /api/sessions/{sessionId}/complete
      → 세션 종료
```

---

## 결제 구조

실제 PG사 연동 없이 **단말기 콜백 방식**으로 동작.

```
카드 단말기 → VAN사 승인 → Spring Boot /success 또는 /fail 콜백
```

향후 PG 연동 필요 시 `PaymentService.requestPayment` 내부에만 추가.

---

## 기술 스택 요약

| 항목 | 내용 |
|------|------|
| 장바구니 | Redis (TTL 30분, key: `cart:{sessionId}`) |
| 주문/결제 | PostgreSQL |
| 더미데이터 | 동국대 학식 16개 메뉴 (학생식당 11개, 분식당 5개) |
| Swagger | `http://localhost:8080/swagger-ui/index.html` |
