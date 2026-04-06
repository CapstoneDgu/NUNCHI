# NUNCHI KIOSK — 코딩 컨벤션

## 주석 규칙
- `// 정적 팩토리 메서드`, `// 주문 당시 단가 스냅샷` 처럼 **명사형·단문**으로 작성
- "~하기 위한", "~대신 사용" 같은 부연설명 금지
- 코드만 봐도 알 수 있는 내용엔 주석 달지 않음

---

## DTO
모든 DTO는 `record`로 정의.
- **Request**: `@NotNull` 등 validation 어노테이션으로 입력값 검증
- **Response**: 필드 + `public static XxxResponse from(Entity)` 정적 팩터리 메서드
- 중첩 DTO는 record 안에 `public record XxxInfo(...) {}` 로 정의

```java
public record MenuResponse(Long menuId, String name, Integer price) {
    public static MenuResponse from(Menu menu) {
        return new MenuResponse(menu.getMenuId(), menu.getName(), menu.getPrice());
    }
}
```

---

## Entity
- `@Entity` + `@Getter` + `@Builder` + `@AllArgsConstructor` + `@NoArgsConstructor(access = AccessLevel.PROTECTED)` 필수
- `@Column(name = "snake_case")` 로 컬럼명 명시
- Boolean 기본값은 `@Builder.Default` 로 선언
- `created_at` / `updated_at` 있는 엔티티는 `BaseEntity` 상속
- 비즈니스 로직(생성·상태변경·삭제)은 **정적 팩터리 메서드**로 엔티티 내부에 캡슐화

```java
@Entity @Getter @Builder @AllArgsConstructor
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Table(name = "menu")
public class Menu extends BaseEntity {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "menu_id")
    private Long menuId;

    @Column(name = "is_sold_out")
    @Builder.Default
    private Boolean isSoldOut = false;

    // 정적 팩터리 메서드 — new 대신 이걸로 생성
    public static Menu create(String name, Integer price) {
        return Menu.builder().name(name).price(price).build();
    }

    // 상태 변경도 엔티티 내부에서
    public void markSoldOut() { this.isSoldOut = true; }
}
```

---

## Service
- 클래스 레벨 `@Transactional(readOnly = true)` 기본
- 데이터 변경 메서드에만 `@Transactional` 별도 선언
- DI는 `@RequiredArgsConstructor` + `final` 필드

---

## Controller
- 응답: `ResponseEntity<ApiResponse<T>>`
- Request Body: `@RequestBody @Valid`
- MCP 전용 API: `/api/mcp/**` 경로 분리

---

## 예외 처리
새 도메인 예외 추가 시 두 파일만 생성 (`GlobalExceptionHandler` 건드릴 필요 없음):

```java
// errorcode/MenuErrorCode.java
public enum MenuErrorCode implements ErrorCode {
    NOT_FOUND_MENU(HttpStatus.NOT_FOUND, 404, "존재하지 않는 메뉴입니다.");
    // ...
}

// domainException/MenuException.java
public class MenuException extends BusinessException {
    public MenuException(MenuErrorCode errorCode) { super(errorCode); }
}

// 사용
menuRepository.findById(id)
        .orElseThrow(() -> new MenuException(MenuErrorCode.NOT_FOUND_MENU));
```

---

## 네이밍
| 레이어 | 규칙 | 예시 |
|--------|------|------|
| Entity | 단수 도메인명 | `Menu`, `OrderItem` |
| Repository | `도메인명Repository` | `MenuRepository` |
| Service | `도메인명Service` | `MenuService` |
| Controller | `도메인명Controller` | `MenuController` |
| Request DTO | `동사+대상+Request` | `MenuCreateRequest` |
| Response DTO | `대상+Response` / `대상+DetailResponse` | `MenuDetailResponse` |
| ErrorCode | `도메인명ErrorCode` | `MenuErrorCode` |
| Exception | `도메인명Exception` | `MenuException` |
