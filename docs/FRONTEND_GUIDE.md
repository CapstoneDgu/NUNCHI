# 눈치 키오스크 · 프론트엔드 구현 가이드

> 이 문서는 `src/main/resources/` 하위에 **현재 구현되어 있는 프론트엔드 코드 자체**를 기준으로
> 구조·기술 스택·디자인 토큰·컴포넌트·네이밍 규칙·코딩 컨벤션을 정리한 참조서입니다.
> 새 화면을 디자인 시안 그대로 퍼블리싱하고, 기존 코드와 **일관된 방식으로 파인코딩**하기 위한
> 유일한 소스(Source of Truth) 역할을 합니다.
>
> 설계/플로우 레벨의 기획 문서는 `docs/눈치키오스크_UIUX설계계획서.md` 를 참고하고,
> 이 문서는 **"이미 작성된 코드와 동일한 방식으로 어떻게 계속 만들지"** 만 다룹니다.

---

## 1. 프로젝트 한눈에 보기

| 항목 | 값 |
|---|---|
| 타깃 해상도 | **720 × 1280 px** (세로 키오스크, 설계서의 1080 × 1920 × 2/3 스케일) |
| 렌더링 아키텍처 | **멀티 페이지 정적 HTML** (SPA 아님, 페이지 단위 `.html`) |
| 스타일 전략 | CSS 토큰(`:root` 커스텀 프로퍼티) + **BEM 네이밍** + **글래스모피즘 + 블롭 배경** |
| JS 전략 | 의존성 없는 **Vanilla JS IIFE** 패턴 (`jQuery`는 로드만 되고 현재 미사용) |
| 상태 저장 | `sessionStorage` (키오스크 세션 범위) |
| 백엔드 서빙 | Spring Boot (`application-local.yml` 에서 `classpath:/static/front/` + `classpath:/templates_front/` 를 static 경로로 매핑) |
| 브라우저 타깃 | 키오스크 전용 최신 Chromium 1개 (크로스브라우저 고려 최소) |
| 언어 | 한국어 단일 |

---

## 2. 디렉토리 구조 (프론트엔드 한정)

```
src/main/resources/
├── application-local.yml              # static-locations 매핑 설정
├── templates_front/                   # HTML 페이지 (URL 루트 = /)
│   ├── index.html                     # S00 시작 화면
│   ├── S01-mode.html                  # S01 주문 방식 선택 (일반 / AI)
│   ├── S02-dine.html                  # S02 매장 / 포장 선택
│   ├── flowN/                         # 일반 주문 플로우 (N02~N05)
│   │   └── N02-menu.html              # N02 메뉴 선택 + 장바구니 + 메뉴 상세 + AI 채팅 (오버레이 통합)
│   ├── flowA/                         # (비어있음) A01 아바타 플로우
│   ├── flowP/                         # (비어있음) P01~P06 결제 플로우
│   └── layouts/                       # (비어있음) 공통 파셜
└── static/front/                      # 정적 자원 (URL 루트 = /)
    ├── css/
    │   ├── common.css                 # 디자인 토큰 + @font-face + reset + [hidden] 전역 리셋 + 데스크톱 미리보기 프레임
    │   ├── components.css             # 재사용 공통 컴포넌트 (.app-topbar / .pill-tab / .qty-stepper / .origin-pill / .ai-chat-panel / .ai-chat-bubble 등)
    │   ├── S00-start.css              # S00 전용
    │   ├── S01-mode.css               # S01 전용
    │   ├── S02-dine.css               # S02 전용
    │   ├── flowN/N02-menu.css         # N02 전용 (장바구니·상세·AI 채팅 오버레이 스타일)
    │   ├── flowA/ flowP/              # (비어있음)
    ├── js/
    │   ├── common/partials-loader.js  # data-include 파셜 로더
    │   ├── S00-start.js               # 시작 화면 로직 (캐러셀·어트랙션)
    │   ├── S01-mode.js                # 모드 선택
    │   ├── S02-dine.js                # 매장/포장 선택
    │   ├── flowN/menu-data.js         # 상록원 메뉴 데이터 단일 소스 + 카테고리/영양 메타 빌더
    │   ├── flowN/N02-menu.js          # N02 컨트롤러 (층/매장 전환·장바구니·상세·AI 채팅)
    │   └── flowA/ flowP/              # (비어있음)
    ├── fonts/                         # Pretendard 9종 + DONGGUK UNIVERSITY
    ├── images/
    │   ├── avatars/                   # 할머니 이미지 + 통장님/이웃사촌 mp4
    │   ├── logos/Dongguk-Logo.jpg
    │   ├── bg/ categories/ icons/ menu/  # (비어있음)
    └── lib/                           # 외부 라이브러리 (직접 번들)
        ├── jquery-3.7.0.min.js
        ├── reset-css@5.0.2_reset.min.css
        ├── animate.min.css
        ├── swal2/swal.js              # SweetAlert2 v11.14.1
        └── fonts/XEIcon-2.2.0/        # XEIcon 아이콘 폰트
```

### 2.1 URL 매핑 규칙

`application-local.yml` 에 다음이 있으므로 **절대 경로(`/`)로 참조**합니다.

```yaml
spring.web.resources.static-locations:
  - classpath:/static/front/
  - classpath:/templates_front/
```

- `templates_front/S01-mode.html`  →  `GET /S01-mode.html`
- `static/front/css/S01-mode.css`  →  `GET /css/S01-mode.css`
- `static/front/js/S01-mode.js`    →  `GET /js/S01-mode.js`
- `static/front/images/...`        →  `GET /images/...`
- `static/front/fonts/...`         →  `GET /fonts/...`
- `static/front/lib/...`           →  `GET /lib/...`

> 그래서 HTML 에서는 `<link href="/css/common.css">` 처럼 **슬래시로 시작하는 절대 경로**만 씁니다.
> 상대 경로(`./`, `../`) 는 사용하지 않습니다.

---

## 3. 기술 스택 & 외부 라이브러리

### 3.1 런타임 스택

| 분류 | 기술 | 비고 |
|---|---|---|
| 마크업 | HTML5 | 각 페이지가 독립적. 템플릿 엔진 아직 미사용 |
| 스타일 | CSS3 (커스텀 프로퍼티, `@keyframes`, `backdrop-filter`) | 전처리기 없음 |
| 스크립트 | Vanilla JavaScript (ES2017+) | **IIFE** 로 전역 오염 차단 |
| 선택자 라이브러리 | jQuery 3.7.0 | 모든 HTML 이 로드하지만 **현재 구현 코드에는 사용하지 않음**. 후속 작업 시 Vanilla 기조 유지 권장 |
| 알림/모달 | SweetAlert2 11.14.1 (`/lib/swal2/swal.js`) | 아직 호출부 없음. 컨펌/에러 모달 용도 예정 |
| 애니메이션 유틸 | Animate.css (`/lib/animate.min.css`) | 현재 코드엔 미사용. 사용 시 클래스 prefix 는 Animate.css 기본 |
| 아이콘 | **XEIcon 2.2.0** (`/lib/fonts/XEIcon-2.2.0/xeicon.min.css`) | `<i class="xi xi-...">` 형태, 모든 아이콘을 이걸로 통일 |
| 웹폰트 | Pretendard 9종 + DONGGUK UNIVERSITY | 로컬 번들 (`/fonts/`), CDN 미사용 |

### 3.2 현재 사용 중인 XEIcon (인벤토리)

| 아이콘 | 쓰임 |
|---|---|
| `xi-touch` | CTA 힌트, 일반 주문 카드 |
| `xi-microphone` | AI 대화 주문 카드 |
| `xi-home` | 좌하단 홈 버튼 |
| `xi-angle-left-thin` | 좌하단 뒤로 버튼 |
| `xi-angle-right-thin` | 카드 우하단 화살표 |
| `xi-restaurant` | 매장 카드 (S02) |
| `xi-package` | 포장 카드 (S02) |
| `xi-fire` | 인기/HOT 뱃지 |
| `xi-new` | NEW 뱃지 |
| `xi-star` | 추천 뱃지 |
| `xi-lightbulb-o` | 컨셉 뱃지 "눈치 있는 키오스크" |
| `xi-chart-pie` | 눈치 추천 피처 |

새 아이콘이 필요할 때는 `src/main/resources/static/front/lib/fonts/XEIcon-2.2.0/xeicon.css` 에서 클래스명을 찾아 그대로 사용합니다. **절대 이모지/SVG 를 아이콘 자리에 섞지 않습니다.** (단, 슬라이드 `s00__slide-emblem` 같은 **장식용 대형 심볼**은 예외로 이모지 허용.)

### 3.3 백엔드 서버

Spring Boot (Java)가 정적 리소스를 서빙합니다. REST API 는 `dgu.capstone.nunchi.domain.*.controller` 패키지에 정의되어 있지만, **현재 구현된 3개 페이지는 API 호출 없이 동작**합니다. 추후 `fetch('/api/...')` 방식으로 연동할 예정입니다.

---

## 4. 디자인 시스템 — `common.css`

모든 페이지가 **반드시 이 순서**로 CSS 를 로드합니다.

```html
<link rel="stylesheet" href="/lib/fonts/XEIcon-2.2.0/xeicon.min.css">
<link rel="stylesheet" href="/css/common.css">
<link rel="stylesheet" href="/css/components.css">
<link rel="stylesheet" href="/css/<페이지>.css">
```

### 4.1 웹폰트

- 본문/UI: `--font-sans` = `"Pretendard"` (100~900 9단계 전부 번들)
- 타이틀(한정): `--font-title` = `"DONGGUK UNIVERSITY"` — **상록원 로고 워드마크 느낌의 타이틀에만** 사용. 본문 절대 사용 금지.

```css
font-family: var(--font-sans);   /* 기본 */
font-family: var(--font-title);  /* "상록원" 같은 매장명 브랜딩만 */
```

### 4.2 컬러 토큰

색은 **직접 HEX 를 쓰지 않고 반드시 토큰으로 참조**합니다.

#### Primary (Warm Orange · hsl 24 92% X%)
- `--primary-50` ~ `--primary-900` 10단계 (배경틴트 → 극강조)
- 주요 쓰임:
  - CTA 기본: `--primary-500` (#E8600A)
  - 버튼 hover: `--primary-400`, press: `--primary-600`
  - 가격 강조(WCAG AA): `--primary-700`
  - 블롭/배경 틴트: `--primary-100`, `--primary-200`

#### Secondary (Amber · hsl 54 85% X%)
- `--secondary-50/100/500/700`
- 주요 쓰임: **아바타 모드 색(AI 대화)**, 정맥인증 포인트

#### Neutral (Warm Grey, Hue ≈ 30)
- `--neutral-0` (#FFFFFF) ~ `--neutral-900` (#1E1915) 10단계

#### Semantic
- `--semantic-error / warning / success / info` + 각 `*-bg`
- 에러 기본 #DC3545 / 성공 #16A34A 등

#### Contextual 별칭 (이쪽을 우선 사용)
실제 컴포넌트에서는 원색 토큰 대신 **의미 기반 별칭**을 우선 사용합니다.

```
--color-bg-page / bg-card / bg-input / bg-overlay
--color-text-heading / body / secondary / disabled / inverse / price
--color-border-default / border-active
--color-btn-primary / btn-hover / btn-press / btn-disabled
--color-cart-badge / sold-out / nunchi-bg / nunchi-border / focus
```

### 4.3 글래스모피즘 토큰

```css
--glass-bg:       rgba(255, 255, 255, 0.55);
--glass-bg-heavy: rgba(255, 255, 255, 0.75);
--glass-border:   rgba(255, 255, 255, 0.7);
--glass-shadow:   0 8px 32px rgba(30, 25, 21, 0.08);
--glass-blur:     blur(20px);
```

글래스 표면은 항상 다음 3개 세트로 구성합니다.

```css
background: var(--glass-bg);
backdrop-filter: var(--glass-blur);
-webkit-backdrop-filter: var(--glass-blur);
border: 1px solid var(--glass-border);
```

### 4.4 쉐도우

| 토큰 | 값 | 용도 |
|---|---|---|
| `--shadow-sm` | `0 2px 8px rgba(30,25,21,.06)` | 홈/뒤로 버튼, 카드 아이콘 |
| `--shadow-md` | `0 4px 16px rgba(30,25,21,.10)` | 글래스 카드 press, 기본 카드 |
| `--shadow-lg` | `0 8px 32px rgba(30,25,21,.15)` | 모달, 팝업 |

### 4.5 레이아웃 토큰 (720 × 1280 스케일 기준)

```
--screen-width:  720px
--screen-height: 1280px
--pad-top:    53px   /* 설계서 80 */
--pad-side:   27px   /* 설계서 40 */
--pad-footer: 67px   /* 설계서 100 */
--touch-min:  53px   /* 터치 타깃 최소치 (설계서 80+) */
--btn-height: 53px   /* 설계서 80 */
--btn-radius: 11px   /* 설계서 16 */
--card-radius:13px   /* 설계서 20 */
```

> 설계서가 1080×1920 기준이라면 **여기 값들이 이미 ×2/3 스케일로 맞춰져 있습니다**.
> 새 토큰을 추가할 때도 같은 2/3 비율을 유지하세요.

### 4.6 모션 토큰

```
--ease-out:      cubic-bezier(0.25, 0.46, 0.45, 0.94)
--ease-bounce:   cubic-bezier(0.68, -0.55, 0.265, 1.55)
--duration-fast: 200ms
--duration-base: 350ms
--duration-slow: 600ms
```

### 4.7 글로벌 베이스

- Reset: `margin/padding: 0`, `box-sizing: border-box`, `button { all: unset; cursor: pointer; }`
- `user-select: none`, `-webkit-tap-highlight-color: transparent` (키오스크라서)
- `:focus-visible` → `outline: 2px solid var(--color-focus); outline-offset: 2px;`
- `.sr-only` 스크린리더 전용 유틸 클래스 존재
- `@media (prefers-reduced-motion: reduce)` 전역 대응 — 모션 민감 사용자용

---

## 5. 공통 컴포넌트 — `components.css`

모든 컴포넌트는 **"토큰만 사용, 하드코딩 금지"** 원칙을 따릅니다.

### 5.1 `.page-bg` — 페이지 배경 + 블롭

**모든 페이지의 `<main>` 에 반드시 부여**하는 래퍼입니다.

```html
<main class="page-bg s01">
  ...페이지 콘텐츠...
</main>
```

- `position: relative; width: 720px; height: 1280px; overflow: hidden`
- `::before` — 좌상단 주황 블롭 (480×480, `blur(80px)`, 20s 부유 애니메이션)
- `::after` — 우하단 주황 블롭 (400×400, 24s reverse)
- `.page-bg > *` 는 자동으로 `z-index: 1` (블롭 위)
- 애니메이션 키프레임: `@keyframes float-blob`

### 5.2 `.glass-card` — 글래스모피즘 카드

```html
<div class="glass-card">...</div>
<div class="glass-card glass-card--heavy">...</div>  <!-- 불투명도 ↑ -->
```

- `:active` 에서 `transform: scale(0.98)` + `shadow-md`
- 현재 S01/S02 카드는 이 클래스를 **상속 없이 수동으로** 쓰고 있음 → 동일 속성을 직접 선언.
  향후 리팩터링 시 `.glass-card` 로 통합 가능.

### 5.3 `.btn-cta` — CTA 버튼

```html
<button class="btn-cta btn-cta--primary">확인</button>
<button class="btn-cta btn-cta--secondary">취소</button>
<button class="btn-cta btn-cta--primary btn-cta--lg btn-cta--block">주문 시작</button>
<button class="btn-cta btn-cta--primary" disabled>...</button>
```

| 모디파이어 | 효과 |
|---|---|
| `--primary` | 주황 fill + 강한 쉐도우. 기본 액션 |
| `--secondary` | 투명 + 2px primary 보더 |
| `--disabled` / `:disabled` | 뉴트럴 배경, `pointer-events: none` |
| `--lg` | min-height 67px, font-size 26px |
| `--block` | `display: flex; width: 100%` (한 줄 차지) |

기본 스펙: `min-height: 53px`, `font-size: 22px`, `font-weight: 700`, `radius: 11px`.

### 5.4 `.btn-home` / `.btn-back` — 좌하단 네비 원형 버튼

글래스 60×60 원형. `position: absolute; bottom: var(--pad-side)` 로 고정.

```html
<!-- 홈만 -->
<button class="btn-home" onclick="location.href='/index.html'" aria-label="처음으로">
  <i class="xi xi-home"></i>
</button>

<!-- 홈 + 뒤로 (뒤로가 오른쪽으로 76px 오프셋) -->
<button class="btn-home" ...>...</button>
<button class="btn-back" ...><i class="xi xi-angle-left-thin"></i></button>
```

- 첫 화면(S00) 에는 둘 다 없음
- 2단계(S01) 에는 `btn-home` 만
- 3단계 이후(S02 ~) 에는 `btn-home` + `btn-back` 둘 다

### 5.5 `.fade-up` — 순차 등장 유틸리티

```html
<header class="s01__header fade-up" style="--delay: 0ms;">...</header>
<div    class="s01__card   fade-up" style="--delay: 150ms;">...</div>
<div    class="s01__card   fade-up" style="--delay: 300ms;">...</div>
```

- 초기 `opacity: 0; translateY(20px)` → `--delay` 지연 후 복귀
- 지연 스테핑은 **150ms 단위** (0, 150, 300, 450...) 가 관례입니다

---

## 6. 페이지 구현 현황 & 패턴

현재 `S00`, `S01`, `S02` 3개 페이지가 완성되어 있고 이들이 **모든 후속 페이지의 레퍼런스**입니다.

### 6.1 HTML 스켈레톤 (모든 페이지 공통)

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=720, initial-scale=1" />
  <title>화면 이름 · 눈치 키오스크</title>

  <!-- 로드 순서 엄수 -->
  <link rel="stylesheet" href="/lib/fonts/XEIcon-2.2.0/xeicon.min.css">
  <link rel="stylesheet" href="/css/common.css">
  <link rel="stylesheet" href="/css/components.css">
  <link rel="stylesheet" href="/css/<페이지 코드>.css">
</head>
<body>
  <main class="page-bg <페이지 클래스>">
    <!-- ① 헤더 (fade-up delay 0ms) -->
    <!-- ② 본문 카드/리스트 (fade-up delay 150~) -->
    <!-- ③ 좌하단 네비 버튼 (홈/뒤로) -->
    <!-- ④ (선택) 하단 고정 CTA -->
  </main>

  <script src="/lib/jquery-3.7.0.min.js"></script>
  <script src="/js/<페이지 코드>.js"></script>
</body>
</html>
```

### 6.2 S00 · `index.html` (시작 화면)

**페이지 루트 클래스**: `.s00`
**기능 요약**: 동국대 로고 / 매장 타이틀 "상록원" / 5장짜리 인기메뉴 슬라이더 / CTA / 30초 유휴 어트랙션 모드

| 블록 | 주요 클래스 |
|---|---|
| 우상단 로고 (mix-blend-mode: multiply) | `.s00__dongguk-logo` |
| 매장 타이틀 | `.s00__title-block` > `.s00__title-sub`, `.s00__title-main` |
| 슬라이더 컨테이너 | `.s00__slider` > `.s00__slider-viewport` > `.s00__slider-track[data-slider-track]` |
| 슬라이드 | `.s00__slide` + 베리언트 `.s00__slide--concept / --1 / --2 / --3 / --4` |
| 슬라이드 미디어 | `.s00__slide-media`, `.s00__slide-overlay`, `.s00__slide-badge`, `.s00__slide-emblem`, `.s00__slide-meta`, `.s00__slide-name`, `.s00__slide-price` |
| 컨셉 슬라이드 전용 | `.s00__slide-copy`, `.s00__slide-copy-main`, `.s00__slide-copy-sub`, `.s00__slide-features`, `.s00__slide-feature`, `.s00__slide-feature-label`, `.s00__slide-feature-desc` |
| 통계 슬라이드 전용 | `.s00__slide-stats`, `.s00__slide-stats-row/info/label/desc/value`, `.s00__slide-progress`, `.s00__slide-progress-fill` |
| 인디케이터 | `.s00__slider-dots[data-slider-dots]` > `.s00__slider-dot[data-idx]`, 활성 `.s00__slider-dot--active` |
| CTA 영역 | `.s00__cta-wrap` > `.btn-cta.btn-cta--primary.s00__cta[data-action="start-order"]` + `.s00__cta-hint` |
| 어트랙션 모드 | `.s00.s00--attract` (JS가 토글) → `@keyframes breathe` 로 숨쉬기 효과 |

**JS 담당 (`/js/S00-start.js`)**:
- 세션 초기화: `sessionStorage.setItem("sessionId", "sess_" + Date.now())`, `currentStep = "S00"`
- 슬라이드 캐러셀: `[data-slider-track]` 을 `translateX(-idx * 100%)` 로 이동, 4초 자동 회전, 도트 클릭 시 `startSlideTimer()` 재시작
- 어트랙션 모드: 30초 미활동 → `.s00--attract` 추가, `click/touchstart/keydown/pointerdown` 감지 시 해제
- CTA 클릭: `sessionStorage.setItem("currentStep", "S01")` 후 `/S01-mode.html` 로 이동

### 6.3 S01 · `S01-mode.html` (주문 방식 선택)

**페이지 루트 클래스**: `.s01`
**레이아웃**: 세로 flex (`padding: 200px 56px var(--pad-footer)`)
- 헤더(타이틀+서브타이틀) → 카드 2개 가로 배치(`gap: 32px`) → 좌하단 홈 버튼

| 블록 | 주요 클래스 |
|---|---|
| 헤더 | `.s01__header` > `.s01__title`, `.s01__subtitle` |
| 카드 컨테이너 | `.s01__cards` |
| 카드 공통 | `.s01__card` (width 280, min-height 480, radius 28, 내부 블롭 ::before/::after) |
| 카드 베리언트 | `.s01__card--normal` (Primary 보더/블롭), `.s01__card--avatar` (Secondary 보더/블롭) |
| 카드 내부 | `.s01__card-icon`, `.s01__card-body` > `.s01__card-subtitle / -title / -desc`, `.s01__card-arrow` |
| 액션 훅 | `[data-mode="normal"]` / `[data-mode="avatar"]` |

**JS 담당 (`/js/S01-mode.js`)**:
- `[data-mode]` 카드 클릭 시 `sessionStorage.setItem("mode", "normal" | "avatar")` + `currentStep="S02"` → **둘 다 `/S02-dine.html`** 로 이동
- 분기는 S02 에서 수행

### 6.4 S02 · `S02-dine.html` (매장 / 포장)

**페이지 루트 클래스**: `.s02`
**구조**: S01 과 **완전히 동일한 레이아웃 스펙** (px 값, 그룹 구조, 카드 스타일). 달라지는 건 클래스 prefix 와 아이콘/문구/데이터 속성.

| 블록 | 주요 클래스 |
|---|---|
| 헤더 | `.s02__header` > `.s02__title`, `.s02__subtitle` |
| 카드 컨테이너 | `.s02__cards` |
| 카드 공통 | `.s02__card` |
| 베리언트 | `.s02__card--dine-in` (Primary), `.s02__card--takeout` (Secondary) |
| 내부 구성 | `.s02__card-icon`, `.s02__card-body`, `.s02__card-subtitle`, `.s02__card-title`, `.s02__card-desc`, `.s02__card-arrow` |
| 액션 훅 | `[data-dine="dine_in"]` / `[data-dine="take_out"]` |
| 하단 네비 | `.btn-home` + `.btn-back` 둘 다 |

**JS 담당 (`/js/S02-dine.js`)**:
- `[data-dine]` 클릭 → `sessionStorage.setItem("dineOption", "dine_in" | "take_out")`
- 이전 단계의 `mode` 에 따라 분기:
  - `mode === "avatar"` → `/flowA/A01-avatar.html`
  - `mode === "normal"` → `/flowN/N02-menu.html`
  - 그 외 → `/S01-mode.html` (복귀)

---

## 7. 네이밍 & 코딩 컨벤션

### 7.1 CSS 클래스 — BEM + 페이지 prefix

```
<페이지코드>__<블록>[-<요소>][--<모디파이어>]
```

- 페이지 코드 소문자: `s00`, `s01`, `s02`, 향후 `n02`, `n03`, `a01`, `p01` ...
- 구분자는 **BEM 규칙 고수**: `__` = 요소, `--` = 모디파이어
- 공통 컴포넌트는 prefix 없음 (`btn-cta`, `btn-home`, `glass-card`, `fade-up`, `page-bg`)
- 예:
  - `.s01__card` → `.s01__card--normal` ✅
  - `.s01-card-normal` ❌ (BEM 위반)
  - `.primary-card` ❌ (prefix 누락)

### 7.2 CSS 작성 규칙

1. **하드코딩 금지**. 색·간격·반경·쉐도우·모션은 전부 `var(--token-name)` 로만.
2. 한 곳에서만 쓰이는 스타일 → `pages/S0X-xxx.css`. 두 곳 이상 → `components.css` 승격 대상.
3. 파일 헤더 주석에 **파일명 / 용도 / 관련 요구사항 번호** 3줄 기재 (기존 파일 동일 패턴).
4. `::before`, `::after` 는 **장식용 블롭/오버레이** 전용.
5. `backdrop-filter` 는 항상 `-webkit-backdrop-filter` 페어로 작성.
6. `will-change` 는 애니메이션 실제 대상에만 부여하고, `@media (prefers-reduced-motion)` 에서 `auto` 로 복원.
7. 하드 px 값이 필요하면 **주석으로 "설계서 원본 값 / 2/3 스케일 결과" 병기** (예: `padding: 53px; /* 설계서 80 */`).

### 7.3 HTML 작성 규칙

1. `lang="ko"`, viewport 는 `width=720, initial-scale=1` **고정** (반응형 아님).
2. 모든 인터랙션 루트 `<main class="page-bg sXX">` 로 시작.
3. 장식 아이콘에는 `aria-hidden="true"`, 의미있는 아이콘/이미지에는 `aria-label` 또는 `alt`.
4. 액션 훅은 **`onclick` 직접 바인딩 대신 `data-*` 속성 + JS 에서 queryselector 로 위임**.
   - 예외: 홈/뒤로 버튼은 로직이 자명해 `onclick="location.href=..."` 인라인 허용.
5. `fade-up` 등장 순서는 `--delay: 0ms, 150ms, 300ms, 450ms ...` 스테핑.
6. 한국어 텍스트 줄바꿈은 `<br>` 로 명시 (설계 의도 보존).

### 7.4 JS 작성 규칙

1. **IIFE 스코프** 로 감싸 전역 오염 차단:
   ```js
   (function () {
       // ...
   })();
   ```
2. 상수는 상단에 `const UPPER_SNAKE_CASE` 로 선언.
3. DOM 참조는 `$` prefix 변수명 (`$track`, `$dots`, `$cta`) — jQuery 가 아니라 **단순 네이밍 컨벤션**.
4. 페이지 로직은 `document.addEventListener("DOMContentLoaded", () => {...})` 에서 부트.
5. 저장/읽기는 **sessionStorage 만** 사용. 예외는 `try/catch` + `console.warn("[SXX] ...")` 로 방어.
6. 로그 prefix 는 `[SXX]`, `[N02]` 처럼 **페이지 코드 대괄호**로 통일.
7. jQuery 는 필요해지기 전까지 쓰지 않는다. 새 페이지 추가 시에도 vanilla 유지 권장.

### 7.5 세션(sessionStorage) 키 명세

| 키 | 설정 시점 | 값 |
|---|---|---|
| `sessionId` | S00 진입 시 초기화 | `"sess_" + Date.now()` |
| `currentStep` | 각 페이지 진입/이탈 시 | `"S00" \| "S01" \| "S02" \| ...` |
| `mode` | S01 카드 클릭 | `"normal" \| "avatar"` |
| `dineOption` | S02 카드 클릭 | `"dine_in" \| "take_out"` |
| `cart` | N02 장바구니 변경 시 | `JSON.stringify(CartItem[])` — `{ id, name, price, qty, storeId, storeName, floorId }` |
| `currentFloor` | N02 층 탭 클릭 | `"F1" \| "F2" \| "F3"` |
| `currentStore` | N02 매장 칩 클릭 | 매장 id (예: `"sotn-noodle"`, `"ilpum"`) |
| `aiSessionId` | N02 진입 시 자동 생성 (없으면) | 짧은 랜덤 토큰 (AI 채팅 컨텍스트 식별자) |

> 새 키를 추가할 때는 이 표를 함께 업데이트 해주세요.

### 7.6 파일 네이밍

- HTML: `<페이지코드 대문자>-<케밥명>.html` → `S01-mode.html`, `N02-menu.html`
- 페이지별 CSS/JS: HTML 파일명과 **1:1 매칭** (`S01-mode.css`, `S01-mode.js`)
- 공통: `common.css`, `components.css`, `js/common/*.js`

---

## 8. 공통 유틸리티

### 8.1 `partials-loader.js`

`data-include="/layouts/_xxx.html"` 속성을 만나면 해당 HTML 을 fetch 해 **요소를 교체**합니다.
로드 완료 후 `document` 에 `partials:ready` 커스텀 이벤트를 발생시켜 후속 JS 가 훅 가능합니다.

```html
<div data-include="/layouts/_help-button.html"></div>

<script src="/js/common/partials-loader.js"></script>
<script>
  document.addEventListener("partials:ready", () => {
    // 파셜 로딩 완료 후 초기화
  });
</script>
```

- 타임아웃 5초 (`PARTIAL_TIMEOUT_MS`)
- 실패 시 `console.error("[partials-loader] ... 로드 실패", err)`
- **현재 사용 중인 페이지 없음**. 공통 레이아웃 파셜(헤더/푸터/AI 채팅 패널 등)을 도입할 때 즉시 활용.

### 8.2 SweetAlert2

전역 `Swal` 로 사용 가능하지만 현재 호출부는 없습니다. 사용 시 권장 패턴:

```js
Swal.fire({
  icon: "warning",
  title: "주문을 취소할까요?",
  showCancelButton: true,
  confirmButtonText: "네, 취소할게요",
  cancelButtonText: "계속 주문하기",
  confirmButtonColor: "var(--primary-500)", // 혹은 HEX 로 변환해서 전달
});
```

> Swal 은 내부적으로 style 주입을 하므로 `confirmButtonColor` 등 **일부 스타일은 CSS 변수가 해석되지 않을 수 있습니다**. 필요시 `common.css` 톤에 맞춘 override CSS 를 나중에 추가.

### 8.3 Animate.css

현재 미사용. 도입 시 `<html class="animate__animated animate__fadeIn">` 같은 방식 대신
이미 정의된 `.fade-up` 등 **프로젝트 고유 유틸을 우선** 사용하고, Animate.css 는 "한 번만 쓰는 특수 효과" 에 한정합니다.

---

## 9. 에셋 관리

### 9.1 이미지 구조

```
images/
├── avatars/          # AI 아바타 자원
│   ├── 할머니_아바타.jpg
│   ├── 통장님_대기.mp4 / 통장님_대화중.mp4
│   └── 이웃사촌_대기.mp4 / 이웃사촌_대화중.mp4
├── logos/Dongguk-Logo.jpg
├── menu/             # (비어있음) 메뉴 사진 예정
├── categories/       # (비어있음) 카테고리 썸네일 예정
├── icons/            # (비어있음) 커스텀 SVG 가 생길 경우
└── bg/               # (비어있음) 배경용 이미지
```

### 9.2 파일 네이밍 규칙

- **한글 파일명 허용** (현재 아바타 파일들이 한글): 키오스크 전용 환경이라 인코딩 이슈가 없다면 유지
- 공식 로고/브랜드는 원본 명 유지: `Dongguk-Logo.jpg`
- 메뉴 썸네일 추가 시 권장 포맷: `<메뉴ID>-<menu-name>.webp` (예: `101-bulgogi.webp`)
- 아이콘은 **XEIcon 우선**, 커스텀 SVG 는 `/images/icons/` 에 kebab-case 로 저장

### 9.3 비디오(아바타)

- `.mp4` 는 `<video autoplay muted loop playsinline>` 로 재생. 오토플레이 정책 때문에 **`muted` 필수**.
- "대기" 상태와 "대화중" 상태 2벌로 설계 → JS 에서 `<source>` 를 갈아 끼우거나 두 `<video>` 를 교차 페이드.

---

## 10. 접근성 (A11y) 가이드라인

현재 코드에 이미 반영되어 있는 항목 — **새 페이지도 반드시 준수**:

| 항목 | 구현 방법 |
|---|---|
| 스크린리더 라벨 | 의미있는 버튼/링크는 `aria-label="..."` |
| 장식 요소 | `aria-hidden="true"` (아이콘, 블롭, emoji emblem) |
| 섹션 라벨 | `<section aria-label="...">` |
| 프로그레스바 | `role="progressbar" aria-valuenow/min/max` |
| 포커스 링 | `button:focus-visible { outline: 2px solid var(--color-focus); }` |
| 모션 축소 | `@media (prefers-reduced-motion: reduce)` 글로벌 대응 |
| 터치 최소치 | 버튼 높이 ≥ `--touch-min` (53px = 설계서 80) |
| 색 대비 | 가격은 `--primary-700` (WCAG AA) |
| 한국어 | `<html lang="ko">` |

---

## 11. 새 페이지 추가 체크리스트 (파인코딩 워크플로우)

새 화면(예: `N02-menu.html`) 을 **기존 코드와 똑같은 품질로** 추가할 때 이 순서로 진행합니다.

### 11.1 파일 3종 생성

```
templates_front/flowN/N02-menu.html
static/front/css/flowN/N02-menu.css
static/front/js/flowN/N02-menu.js
```

### 11.2 HTML 뼈대 작성

- [ ] 위 §6.1 스켈레톤 복사
- [ ] `<title>XXX · 눈치 키오스크</title>` 세팅
- [ ] `<main class="page-bg nN2">` (페이지 코드 prefix 지정)
- [ ] 헤더 `fade-up --delay:0ms` + 본문 `150ms/300ms/...`
- [ ] 좌하단 `btn-home` + `btn-back` (필요 시)
- [ ] 하단 CTA 는 `.btn-cta.btn-cta--primary` 기반으로 구성
- [ ] 아이콘은 XEIcon (`xi xi-...`) 만 사용
- [ ] 모든 장식 요소 `aria-hidden="true"`

### 11.3 CSS 작성

- [ ] 파일 헤더 주석 3줄 (파일명 / 용도 / 요구사항 번호)
- [ ] 페이지 루트 셀렉터(`.n02 { ... }`) 로 스코프 한정
- [ ] 색/간격/반경/쉐도우/모션 **100% 토큰화**
- [ ] px 값이 필요하면 주석으로 "설계서 원본 / 2/3 스케일" 병기
- [ ] hover 는 데스크탑 미리보기 용으로만, 실제 터치 피드백은 `:active { transform: scale(0.98); }`
- [ ] 재사용 가능한 블록은 바로 `components.css` 로 승격 제안

### 11.4 JS 작성

- [ ] IIFE 로 감싸기
- [ ] 상수는 `const UPPER_SNAKE` 상단 선언
- [ ] DOM 변수는 `$xxx` prefix
- [ ] `DOMContentLoaded` 후 바인딩
- [ ] `sessionStorage` 접근은 `try/catch` 로 방어
- [ ] 로그는 `console.warn("[N02] ...")`
- [ ] 페이지 이동 직전 `sessionStorage.setItem("currentStep", "다음 페이지 코드")`

### 11.5 시각 QA

- [ ] 720 × 1280 창에서 스크롤 없이 한 뷰 안에 다 들어오는지
- [ ] 블롭이 잘리지 않고, 글래스 모피즘 `backdrop-filter` 가 크롬에서 적용되는지
- [ ] `fade-up` 이 순차로 떨어지는지
- [ ] `prefers-reduced-motion` 강제 설정 시 치명적 레이아웃 깨짐이 없는지
- [ ] 터치 타깃이 53px 이상인지
- [ ] 홈/뒤로 버튼이 다른 요소를 가리지 않는지 (항상 `z-index: 10`)

### 11.6 세션/플로우 검증

- [ ] 이전 페이지 → 현재 페이지로 들어왔을 때 `sessionStorage` 에 필요한 키가 모두 존재하는지
- [ ] 키가 없을 때 **안전한 fallback 경로**(예: `/S01-mode.html` 복귀)를 구현했는지
- [ ] "홈" 은 `/index.html`, "뒤로" 는 **해당 플로우 상 직전 페이지** 로 정확히 가는지

---

## 12. 알려진 기술 부채 / 개선 예정

| 항목 | 설명 |
|---|---|
| jQuery 로드 | `<script src="/lib/jquery-3.7.0.min.js">` 모든 페이지에 있으나 실제로 사용 안 함. 완전히 제거하거나 쓴다면 일관되게 써야 함. |
| 공통 파셜 | `templates_front/layouts/` 가 비어있음. `partials-loader.js` 로 로딩할 `_head.html / _scripts.html / _home-back.html` 을 도입하면 각 페이지 중복 마크업을 걷어낼 수 있음. |
| `.glass-card` 사용률 | S01/S02 카드는 `.glass-card` 를 상속하지 않고 같은 속성을 재선언. 리팩터링 여지. |
| XEIcon CDN vs 로컬 | 로컬 번들 유지 중 (오프라인 키오스크 대비). |
| SweetAlert2 테마 | 브랜드 톤 맞춘 커스텀 CSS 필요. |
| WebSocket / REST | 아바타/눈치엔진 도입 시 공용 API 클라이언트를 `js/common/` 에 추가 예정. |

---

## 13. 빠른 참조 (Cheat Sheet)

### 디자인 토큰

```css
/* 주황 */
var(--primary-50)  var(--primary-100) var(--primary-200) var(--primary-300)
var(--primary-400) var(--primary-500) var(--primary-600) var(--primary-700)

/* 중립 */
var(--neutral-0)   ~  var(--neutral-900)

/* 의미 별칭 */
var(--color-text-heading|body|secondary|disabled|inverse|price)
var(--color-bg-page|card|input|overlay)
var(--color-btn-primary|hover|press|disabled)

/* 레이아웃 */
var(--screen-width)  720px
var(--screen-height) 1280px
var(--pad-top|side|footer)
var(--btn-height)    53px
var(--btn-radius)    11px
var(--card-radius)   13px

/* 모션 */
var(--ease-out)
var(--duration-fast|base|slow)
```

### 핵심 컴포넌트 한 줄 요약

```html
<main class="page-bg s0X">                     <!-- 배경+블롭 래퍼 -->
<div  class="glass-card glass-card--heavy">    <!-- 글래스 카드 -->
<button class="btn-cta btn-cta--primary btn-cta--lg btn-cta--block">
<button class="btn-home"><i class="xi xi-home"></i></button>
<button class="btn-back"><i class="xi xi-angle-left-thin"></i></button>
<div class="fade-up" style="--delay: 150ms;">  <!-- 순차 등장 -->
```

### 페이지 간 이동 패턴

```js
sessionStorage.setItem("currentStep", "다음 코드");
location.href = "/다음_페이지.html";
```

### 세션 스냅샷 디버깅

브라우저 콘솔에서:
```js
Object.fromEntries(Object.entries(sessionStorage));
// { sessionId: "sess_...", currentStep: "S02", mode: "avatar", dineOption: "dine_in" }
```

---

**문서 버전**: 2026-04-26 기준 (S00·S01·S02·N02 구현 완료 시점)
**다음 업데이트 트리거**: 새 페이지 추가, `components.css` 변경, 디자인 토큰 추가/변경, `sessionStorage` 키 추가
