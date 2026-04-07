# PR 코드리뷰 반영 결과 보고서

## 반영 완료 항목

### 1. DTO 요청 검증 강화
**파일**: `CartItemAddRequest.java`

- `sessionId`, `menuId`: `@Positive` 추가 (0 이하 값 차단)
- `optionIds`: `List<@NotNull @Positive Long>` 으로 변경 (null 요소 및 음수 ID 차단)

### 2. OrderItemResponse itemTotal 계산 수정
**파일**: `OrderItemResponse.java`

- 기존: `unitPrice * quantity` (옵션 추가금 누락)
- 수정: `(unitPrice + optionExtra) * quantity` (옵션 추가금 합산 후 수량 곱셈)
- `extraPrice`가 null인 경우 0으로 처리하여 NPE 방지

### 3. springdoc-openapi 버전 업그레이드
**파일**: `build.gradle`

- 기존: `springdoc-openapi-starter-webmvc-ui:2.8.3` (Spring Boot 3.x 호환)
- 수정: `springdoc-openapi-starter-webmvc-ui:3.0.0` (Spring Boot 4.x 호환)

### 4. 결제 중복 요청 방지
**파일**: `PaymentService.java`, `PaymentRepository.java`, `PaymentErrorCode.java`

- `findTopByOrderIdOrderByCreatedAtDesc` 메서드 추가
- `requestPayment()` 진입 시 기존 결제 조회:
  - `PENDING` / `SUCCESS` 상태이면 `PAYMENT_ALREADY_EXISTS(400)` 예외 발생
  - `FAILED` 상태이면 재시도 허용
- `PaymentErrorCode.PAYMENT_ALREADY_EXISTS` 에러코드 추가

### 5. 결제 상태 전이 경쟁 조건 방지
**파일**: `PaymentRepository.java`, `PaymentService.java`

- `findByIdWithLock(Long paymentId)`: `PESSIMISTIC_WRITE` 락 적용
- `successPayment()`, `failPayment()` 모두 락 조회로 교체
- 동시 성공/실패 콜백이 들어와도 한쪽만 PENDING 상태를 확보하여 원자성 보장

### 6. 세션 완료 처리 경쟁 조건 방지
**파일**: `KioskSessionRepository.java`, `SessionService.java`

- `findByIdWithLock(Long sessionId)`: `PESSIMISTIC_WRITE` 락 적용
- `completeSession()` 에서 락 조회로 교체
- 동시 요청 시 두 트랜잭션이 모두 ACTIVE 판정받는 상황 차단

### 7. ObjectMapper 빈 격리
**파일**: `RedisConfig.java`, `CartRedisRepository.java`

- `objectMapper` → `@Bean("redisObjectMapper")`로 이름 변경
- `CartRedisRepository` 에서 `@Qualifier("redisObjectMapper")` 명시적 주입
- Spring Boot 자동 구성 `ObjectMapper` 오버라이드 방지

---

## 파일별 변경 요약

| 파일 | 변경 내용 |
|------|-----------|
| `CartItemAddRequest.java` | `@Positive`, `@NotNull @Positive` 검증 추가 |
| `OrderItemResponse.java` | itemTotal 옵션 추가금 반영 |
| `build.gradle` | springdoc 2.8.3 → 3.0.0 |
| `PaymentErrorCode.java` | `PAYMENT_ALREADY_EXISTS` 추가 |
| `PaymentRepository.java` | `findTopByOrderId...`, `findByIdWithLock` 추가 |
| `PaymentService.java` | 중복 결제 차단 로직, 락 조회 적용 |
| `KioskSessionRepository.java` | `findByIdWithLock` 추가 |
| `SessionService.java` | 락 조회로 교체 |
| `RedisConfig.java` | 빈 이름 `redisObjectMapper`로 변경 |
| `CartRedisRepository.java` | `@Qualifier("redisObjectMapper")` 명시 |
