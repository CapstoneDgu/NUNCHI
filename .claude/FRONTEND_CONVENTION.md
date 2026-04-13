# FRONTEND_CONVENTION.md — NUNCHI 프론트엔드 개발 규칙

NUNCHI 프론트엔드는 **바닐라 HTML/CSS/JavaScript**로 작성하며, `src/main/resources/static/`
아래에 두고 Spring Boot가 직접 서빙한다. 두 개의 모드(아바타 / 일반 키오스크)가 공존하고
공통 리소스를 공유하므로, 스타일 일관성 유지를 위해 아래 규칙을 따른다.

---

## 1. 폴더 구조 규칙

```
src/main/resources/static/
├── css/
│   ├── common/       # reset.css, variables.css, layout.css
│   ├── components/   # button.css, modal.css 등 재사용 UI
│   └── pages/
│       ├── avatar/
│       └── kiosk/
├── js/
│   ├── common/       # api.js, util.js, session.js
│   ├── libs/         # 외부 라이브러리 (고정 버전)
│   └── pages/
│       ├── avatar/
│       └── kiosk/
├── images/
│   ├── icons/
│   ├── logos/
│   └── backgrounds/
├── fonts/
└── data/             # mock/설정 JSON
```

### 배치 판단 기준
- **두 모드가 모두 쓰는가?** → `css/common/` 또는 `css/components/`, `js/common/`
- **한 모드에서만 쓰는가?** → `css/pages/{mode}/` 또는 `js/pages/{mode}/`
- **재사용 UI 조각(버튼, 모달, 토스트 등)?** → `css/components/`
- **외부 라이브러리?** → `js/libs/` (CDN 금지, 고정 버전 파일로 커밋)

> 한 모드 전용이었던 파일이 다른 모드에서도 필요해지면 **즉시 `common/`으로 승격**한다.
> 복붙 금지.

---

## 2. 네이밍 규칙

| 대상 | 스타일 | 예시 |
|---|---|---|
| JS/CSS 파일명 | `kebab-case` | `order-summary.js`, `button-primary.css` |
| JS 변수·함수 | `camelCase` | `fetchMenuList`, `cartItems` |
| JS 상수(모듈 레벨) | `UPPER_SNAKE_CASE` | `API_BASE_URL`, `SESSION_TIMEOUT_MS` |
| JS 클래스 | `PascalCase` | `OrderCart`, `AvatarController` |
| CSS 클래스 | `kebab-case` (BEM 권장) | `.order-card`, `.order-card__title--active` |
| CSS 변수 | `--kebab-case` | `--color-primary`, `--space-md` |
| HTML id | `camelCase` | `id="avatarStage"`, `id="cartTotal"` |
| HTML data-* | `kebab-case` | `data-menu-id="42"` |

---

## 3. API 호출 규칙 (`js/common/api.js`)

**모든 서버 호출은 `api.js`의 래퍼를 경유한다. `fetch()` 직접 호출 금지.**

```js
// js/common/api.js (참고 구조)
const BASE_URL = ''; // 같은 오리진, 상대경로

export async function apiGet(path)           { /* ... */ }
export async function apiPost(path, body)    { /* ... */ }
export async function apiPatch(path, body)   { /* ... */ }
export async function apiDelete(path)        { /* ... */ }
```

### 래퍼 책임
- 공통 헤더(`Content-Type: application/json`, 세션 ID 등) 자동 주입
- JSON 파싱 및 응답 포맷(`ApiResponse<T>`) 언래핑
- 에러 분기 처리: HTTP 4xx/5xx → 공통 에러 객체로 throw
- 서버 에러 코드(`{code, msg}`) → 사용자 친화 메시지로 변환

### 사용 예
```js
import { apiGet, apiPost } from '/js/common/api.js';

const menus = await apiGet('/api/menus');
await apiPost('/api/orders', { items: [...] });
```

### 금지
- 페이지 JS에서 `fetch()` 직접 호출
- API 경로 문자열 하드코딩 반복 → 상수화 또는 모듈로 분리

---

## 4. `common/` 유틸 사용 규칙

공통 모듈 위치: `js/common/`

| 모듈 | 역할 |
|---|---|
| `api.js` | 서버 호출 래퍼 |
| `util.js` | 포맷터(원화, 시간), DOM 헬퍼(`qs`, `qsa`), 디바운스 등 |
| `session.js` | 주문 세션 ID 생성·저장·만료 |

### 규칙
- 페이지 전용 파일에서 같은 유틸을 중복 구현하지 말 것
- 두 번째로 필요해지는 시점에 바로 `common/`으로 승격
- 공통 모듈은 **부수효과 없는 순수 함수 우선**, 전역 상태 지양

---

## 5. JS 모듈화

- **ES Modules** 사용 (`<script type="module" src="..."></script>`)
- `import` / `export` 로만 모듈 간 의존성 표현
- 전역 `window` 오염 금지
- 공통 모듈은 **named export** 우선, default export는 페이지 진입점 정도에만 허용
- 파일당 책임 하나(Single Responsibility)

---

## 6. CSS 작성 규칙

### 변수 우선
- 색상·폰트·간격·radius·shadow는 **`css/common/variables.css`의 CSS 변수만** 사용
- 하드코딩된 색상(`#fff`, `rgb(...)`) 금지

```css
/* ❌ 금지 */
.btn { background: #ff5500; padding: 12px; }

/* ✅ 권장 */
.btn { background: var(--color-primary); padding: var(--space-md); }
```

### 로딩 순서
페이지 HTML에서:
1. `css/common/reset.css`
2. `css/common/variables.css`
3. `css/common/layout.css`
4. `css/components/*.css` (필요한 것만)
5. `css/pages/{mode}/*.css`

### 금지
- `!important` 사용 (외부 라이브러리 오버라이드 외)
- 인라인 `style="..."` (동적 값은 CSS 변수 + class toggle로)
- ID 선택자(`#foo { ... }`) — JS 훅용 id와 스타일 훅을 분리

---

## 7. 에러 처리 & 사용자 피드백

- API 에러는 `api.js` 래퍼에서 throw → 페이지 JS는 `try/catch`로 받고 **공통 토스트/알림 컴포넌트**로 표시
- **무음 실패(silent fail) 금지** — 최소한 콘솔 `console.error` + 사용자 알림
- 결제 등 중요 액션은 **멱등성**을 고려해 버튼을 즉시 비활성화(중복 요청 방지)

---

## 8. 접근성 / 반응형

- 주요 인터랙션 버튼은 `aria-label` 필수 (특히 아이콘 전용 버튼)
- 포커스 링 제거 금지 (`outline: none` 금지 또는 대체 포커스 스타일 제공)
- **기본 대상 해상도**: FHD 세로형(1080 × 1920) 키오스크
- 반응형은 해당 범위 안에서만 고려, 모바일 대응은 범위 외

---

## 9. 주석 / 언어

- 주석·에러 메시지·사용자 문구는 **한국어**
- 주석은 **"왜(Why)"** 중심. "무엇(What)"은 코드가 말하도록
- 복잡한 비즈니스 로직(예: 할인, 옵션 조합 계산)은 한 줄 Why 주석 허용
- TODO는 `// TODO(이름): ...` 형식

---

## 10. 금지 사항 (보안 · 유지보수)

- **`innerHTML`에 서버 값 직접 주입 금지** (XSS) → `textContent` 또는 이스케이프된 템플릿 사용
- **인라인 `<script>` / `<style>` 지양** (CSP 및 유지보수 문제)
- **CDN 경유 외부 리소스 금지** — `js/libs/`에 고정 버전 파일로 커밋
- **민감 정보 로그 금지** — 결제·개인정보는 `console.log` 금지
- **글로벌 네임스페이스 오염 금지** — 모든 JS는 ES Module 스코프 내부에서 동작

---

## 11. 커밋 컨벤션

백엔드와 동일한 한국어 prefix 사용:
- `[Feat]` 새 기능
- `[Fix]` 버그 수정
- `[Chore]` 설정·문서·리팩토링 등 기능 외
- `[Style]` 포맷팅·네이밍 등 코드 스타일만 변경

프론트 커밋 메시지는 **어떤 모드/페이지의 어떤 기능인지** 한 줄로 명확히 표기.

예: `[Feat] 아바타 모드 음성 입력 버튼 UI 추가`
