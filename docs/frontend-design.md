# NUNCHI KIOSK — 프론트엔드 UI/UX 설계서

> **Single Source of Truth** — NUNCHI 프론트엔드의 디자인·구조·화면 청사진을 한 문서에 정리합니다.
> 이 문서는 `.claude/FRONTEND_CONVENTION.md` 의 충돌 항목보다 **우선** 합니다.
> 새 페이지를 만들기 전에 여기부터 확인하세요.

| 항목 | 값 |
|---|---|
| **디바이스 해상도** | 720 × 1280 px (세로형 터치 키오스크) |
| **제작 목적** | LLM Agentic AI 기반 배리어프리 자율주문 키오스크 |
| **디자인 방향** | 따뜻한 식당 + 모던 AI (Warm Campus + Modern AI) |
| **기술 스택** | HTML5 + CSS3 + Vanilla JS (ES Modules) |
| **아키텍처** | 멀티 페이지 (페이지별 HTML) + JS partials 주입 |
| **서빙** | Spring Boot `static-locations` 다중 매핑 |
| **폰트** | DONGGUK UNIVERSITY (로컬 ttf) |
| **지원 모드** | 일반 키오스크 모드 / 아바타 음성 모드 |
| **문서 버전** | v1.0 |

---

## 목차

1. [디자인 테마](#1-디자인-테마)
2. [디자인 시스템 (토큰)](#2-디자인-시스템-토큰)
3. [폴더 구조 & 파일 네이밍](#3-폴더-구조--파일-네이밍)
4. [공통 컴포넌트](#4-공통-컴포넌트)
5. [화면 청사진](#5-화면-청사진)
6. [화면 전환 플로우](#6-화면-전환-플로우)
7. [페이지별 상세 스펙](#7-페이지별-상세-스펙)
8. [기술 고려사항](#8-기술-고려사항)

---

## 1. 디자인 테마

### 1.1 테마 정체성

**이름**: Warm Campus + Modern AI
**한 줄 정의**: *밝고 따뜻한 대학 식당에, 조용히 곁들어주는 AI 도우미*

NUNCHI 는 "주문을 도와주는 차가운 기계"가 아니라 **친근한 학생식당의 직원처럼** 느껴져야 합니다. 동시에 AI 가 개입하는 순간에는 **스마트하고 신뢰감 있는 분위기**를 유지해야 합니다.

### 1.2 감성 키워드

| 키워드 | 의미 |
|---|---|
| **따뜻함** | 오렌지·피치 톤, 둥근 모서리, 친근한 세리프 폰트 |
| **밝음** | 아이보리 배경, 채도 낮은 부드러운 컬러 |
| **친근함** | 의인화된 라벨("학생식당 / 상록원"), 이모지 활용 절제 |
| **모던 AI** | 퍼플 액센트, 미세한 그라데이션, 마이크로 인터랙션 |
| **신뢰감** | 일관된 카드 시스템, 충분한 여백, 명확한 CTA |

### 1.3 하지 않을 것 (Do Not)

- 검정 바탕 / 다크 모드 — 키오스크는 항상 밝게
- 차가운 네온·사이버펑크 톤
- 과도한 그라데이션 / 광택 효과
- 의미 없는 이모지 도배 — 핵심 액션에만 사용
- 좁은 터치 타겟 (최소 64px)
- 14px 미만의 본문 텍스트

---

## 2. 디자인 시스템 (토큰)

> 모든 토큰은 `src/main/resources/static/front/css/variables.css` 에 정의됩니다.
> CSS 에선 반드시 `var(--token-name)` 로 참조하고, 하드코딩 색상·간격은 금지입니다.

### 2.1 컬러 팔레트

#### Surface (배경·면)

| 토큰 | 값 | 의미 |
|---|---|---|
| `--color-bg` | `#fafafa` | 페이지 기본 배경 (아이보리) |
| `--color-surface` | `#ffffff` | 카드·모달 배경 (순백) |
| `--color-surface-subtle` | `#f2f3f5` | 회색 면 (아이콘 박스, order-mode 배경) |
| `--color-surface-peach` | `#fff8f3` | 피치 배너 (안내 박스) |
| `--color-surface-peach-soft` | `#fffaf6` | 피치 카드 (AI 카드 hover/highlight) |

#### Text

| 토큰 | 값 | 의미 |
|---|---|---|
| `--color-text` | `#191f28` | 본문 (near-black) |
| `--color-text-muted` | `#8b95a1` | 보조 텍스트 (서브타이틀) |
| `--color-text-faint` | `#b0bac6` | 3차 텍스트 (캡션·라벨) |
| `--color-text-subtle` | `#c5cbd2` | 힌트 (placeholder, 디자인 시스템 라벨) |
| `--color-text-dark` | `#0a0a0a` | 대형 그래픽용 (이모지) |

#### Border

| 토큰 | 값 | 의미 |
|---|---|---|
| `--color-border` | `#e5e8eb` | 카드·버튼 기본 보더 |
| `--color-border-subtle` | `#f0f1f3` | 옅은 보더 (헤더 separator, progress track) |
| `--color-border-peach` | `#f5e6d8` | 피치 배너 보더 |

#### Brand & Accent

| 토큰 | 값 | 의미 |
|---|---|---|
| `--color-primary` | `#e8762b` | 메인 브랜드 오렌지 — 주문 CTA, 강조 |
| `--color-primary-hover` | `#d96a22` | Primary `:hover` / `:active` |
| `--color-accent-purple` | `#5856d6` | AI·스마트 강조 — 뱃지, 통계, AI 관련 |
| `--color-accent-peach` | `#ffd4a0` | 보조 피치 (가격 표시 등) |

#### Utility

| 토큰 | 값 | 의미 |
|---|---|---|
| `--color-indicator` | `#d1d5db` | 캐러셀 인디케이터 |
| `--color-focus` | `#4a90e2` | 포커스 링 |

### 2.2 타이포그래피

**Family**: `--font-family-base` = `"DONGGUK UNIVERSITY", -apple-system, "Pretendard", sans-serif`
**파일 위치**: `src/main/resources/static/front/fonts/DONGGUK UNIVERSITY.ttf`
**선언 위치**: `front/css/base.css` 의 `@font-face`

#### 권장 사이즈 스케일

키오스크는 일반 웹보다 **본문 사이즈가 큼**. 멀리서 봐도 읽혀야 함.

| 역할 | 사이즈 | 라인 높이 | 사용 예 |
|---|---|---|---|
| Hero | 96 px | 96 px | 매장 메인 타이틀 (`상록원`) |
| Display | 38–40 px | 46–60 px | 페이지 제목 (`주문 방식 선택`), 주요 버튼 |
| Title | 28–34 px | 40–51 px | 카드 제목, 통계 값 |
| Subtitle | 22 px | 30–33 px | 영문 서브타이틀, 캐러셀 라벨 |
| Body Large | 18 px | 27 px | 본문, 카드 내 설명 |
| Body | 16 px | 24 px | 배너 텍스트, 일반 본문 |
| Caption | 14 px | 21 px | 작은 설명, 통계 부연 |
| Tiny | 13 px | 19.5 px | 개발용 라벨 |

> 본문은 **최소 14px** 보장. 그보다 작은 텍스트는 사용 금지.

### 2.3 간격 (Spacing)

기본 단위: **8 px**. 모든 간격은 8 의 배수로.

| 키 | 값 |
|---|---|
| xxs | 4 px |
| xs | 8 px |
| sm | 12 px |
| md | 16 px |
| lg | 24 px |
| xl | 32 px |
| 2xl | 40 px |

> 현재 `variables.css` 에 spacing 토큰은 명시 안 돼 있고 페이지마다 직접 px 값 사용 중. 화면이 늘면 `--space-*` 토큰으로 추가 예정.

### 2.4 모서리 (Border Radius)

| 키 | 값 | 사용 |
|---|---|---|
| sm | 12 px | 작은 UI |
| md | 16–22 px | 일반 카드 |
| lg | 28 px | 메인 카드, CTA 버튼 |
| xl | 32 px | 큰 컨테이너 |
| pill | 9999 px | 뱃지, 인디케이터, 도움말 버튼 |

### 2.5 그림자 (Shadow)

| 토큰 | 값 | 사용 |
|---|---|---|
| `--shadow-card` | `0 12px 52px rgba(0,0,0,0.15)` | 메인 카드 (splash 인기 메뉴) |
| `--shadow-card-subtle` | `0 4px 16px rgba(0,0,0,0.06)` | 보조 카드 (order-mode 카드) |
| `--shadow-badge` | `0 4px 14px rgba(88,86,214,0.33)` | 퍼플 뱃지 |
| `--shadow-primary-btn` | `0 12px 44px rgba(232,118,43,0.5)` | 주문하기 등 메인 CTA |

### 2.6 아이콘 사이즈 규칙

| 사이즈 | 사용 |
|---|---|
| 24 px | 인라인 아이콘 (뱃지 안 등) |
| 32–40 px | 작은 액션 (뒤로가기 화살표) |
| 48–64 px | 상단/하단 바 액션 (음성 마이크) |
| 120–160 px | 카드 메인 아이콘 (touch-tap, ai-robot) |

### 2.7 레이아웃 상수

| 토큰 | 값 |
|---|---|
| `--screen-width` | 720 px |
| `--screen-height` | 1280 px |

#### 권장 표준

- **최소 터치 타겟**: 64 × 64 px (배리어프리 기준)
- **메인 CTA 버튼 높이**: 96–118 px (`splash__order-btn` 118px, 일반 버튼 96px)
- **헤더 높이**: 130 px (order-mode 기준)
- **배너 높이**: 54–64 px
- **좌우 안전 여백**: 27–40 px

---

## 3. 폴더 구조 & 파일 네이밍

### 3.1 물리 구조

```
src/main/resources/
├── static/front/                    🎨 정적 에셋
│   ├── css/
│   │   ├── variables.css                디자인 토큰
│   │   ├── base.css                     리셋 + 폰트
│   │   ├── components.css               공통 컴포넌트
│   │   ├── splash.css                   페이지별 (공용 진입은 평평)
│   │   ├── order-mode.css
│   │   ├── dine-location.css            (예정)
│   │   ├── avatar/                      아바타 모드 전용
│   │   └── kiosk/                       일반 키오스크 전용
│   │
│   ├── js/
│   │   ├── common/
│   │   │   ├── partials-loader.js       data-include 처리
│   │   │   ├── api.js                   (예정) REST 래퍼
│   │   │   ├── util.js                  (예정) 헬퍼
│   │   │   └── session.js               (예정) 세션 관리
│   │   ├── avatar/
│   │   └── kiosk/
│   │
│   ├── images/
│   │   ├── common/                      여러 화면 공용
│   │   │   ├── icons/                   SVG 아이콘
│   │   │   ├── dongguk-logo.svg
│   │   │   └── splash-featured.jpg
│   │   ├── avatar/                      아바타 전용 이미지
│   │   └── kiosk/                       키오스크 전용 이미지
│   │
│   └── fonts/
│       └── DONGGUK UNIVERSITY.ttf
│
└── templates_front/                 📄 HTML
    ├── layouts/
    │   └── _help-button.html            partial (언더스코어 prefix)
    ├── splash.html                      공용 진입
    ├── order-mode.html
    ├── dine-location.html               (예정)
    ├── avatar/                          아바타 모드 페이지
    └── kiosk/                           일반 키오스크 페이지
```

### 3.2 Spring 정적 리소스 매핑

`application-local.yml` 의 `static-locations` 가 두 경로를 **모두 URL 루트** 로 서빙:

```yaml
spring:
  web:
    resources:
      static-locations:
        - classpath:/static/front/
        - classpath:/templates_front/
```

→ 파일 경로 `static/front/css/splash.css` 가 URL `http://localhost:8080/css/splash.css` 로 매핑.
→ 파일 경로 `templates_front/splash.html` 이 URL `http://localhost:8080/splash.html` 로 매핑.

### 3.3 네이밍 규칙

| 대상 | 규칙 | 예시 |
|---|---|---|
| HTML/CSS/JS 파일명 | `kebab-case` | `order-mode.html`, `dine-location.css` |
| Layout partial | `_kebab-case.html` | `_help-button.html` |
| CSS 클래스 | BEM `block__element--modifier` | `.order-mode__card-icon--avatar` |
| CSS 변수 | `--kebab-case` | `--color-primary`, `--font-family-base` |
| JS 변수·함수 | `camelCase` | `loadPartials`, `cartItems` |
| JS 상수 | `UPPER_SNAKE_CASE` | `API_BASE_URL`, `SESSION_TIMEOUT_MS` |
| HTML id | `camelCase` | `id="orderModeCart"` |
| HTML data-* | `kebab-case` | `data-menu-id="42"`, `data-include="..."` |
| 공용 진입 페이지 | 평평하게 root | `splash.html`, `order-mode.html`, `dine-location.html` |
| 모드 전용 페이지 | 모드 폴더 안 | `avatar/intro.html`, `kiosk/cart.html` |

> **숫자 prefix 금지** — `S01-splash.html` ❌ → `splash.html` ✅

### 3.4 BEM 적용 예

```html
<article class="splash__card">
    <div class="splash__card-image">
        <div class="splash__card-overlay"></div>
        <div class="splash__card-badge">...</div>
    </div>
    <div class="splash__card-stats">
        <span class="splash__card-stats-value">81%</span>
    </div>
</article>
```

- `block` = 페이지 또는 컴포넌트 (`splash`, `order-mode`, `help-btn`)
- `__element` = block 내부의 자식
- `--modifier` = 변형 (`--avatar`, `--active`, `--lg`)

피그마 플러그인이 export 한 `container-13`, `text-wrapper-7` 같은 의미 없는 클래스명은 **반드시 BEM 으로 재작명**.

---

## 4. 공통 컴포넌트

> 위치: `src/main/resources/static/front/css/components.css`
> 원칙: **두 번째로 필요해지는 시점**에 컴포넌트로 승격. YAGNI.

### 4.1 구현 완료

#### `help-btn` — 도움말 버튼 (좌하단 공통)

| 항목 | 값 |
|---|---|
| 위치 | `position: absolute; left: 40px; bottom: 40px;` |
| 크기 | 80 × 80 px |
| 모양 | 원형, 흰 배경, 옅은 보더 + `--shadow-card-subtle` |
| 아이콘 | `/images/common/icons/help.svg` (34 × 34) |
| Partial | `templates_front/layouts/_help-button.html` |
| 사용 방법 | `<div data-include="/layouts/_help-button.html"></div>` |
| 모든 페이지 | ✅ partial 로 자동 주입 |

### 4.2 예정 컴포넌트 (등장 시 추가)

| 컴포넌트 | 사용 화면 | 추가 시점 |
|---|---|---|
| `top-bar` | order-mode (이미 인라인), 모든 모드 내부 페이지 | 2번째 사용 시점 |
| `bottom-bar` | 장바구니, 메뉴 목록, 결제 | kiosk/menu-list 작업 시 |
| `modal` | AI 추천 확인, 도움말, 결제 확인 | AI 추천 확인 모달 작업 시 |
| `banner` | order-mode (이미 인라인), AI 안내 화면 | 2번째 사용 시점 |
| `toast` | 에러·성공 피드백 | 결제 화면 구현 시 |
| `lang-selector` | 모든 페이지 우상단 | 다국어 도입 시 |
| `card` | 메뉴 카드, 옵션 카드 | 메뉴 목록 구현 시 |
| `loading-spinner` | AI 응답 대기, 결제 처리 중 | 결제 화면 구현 시 |
| `badge` | "지금 인기" 등 마커 | 카드 내부에 자주 쓰면 컴포넌트화 |

### 4.3 컴포넌트 등록 절차

새 컴포넌트를 추가할 때:

1. `front/css/components.css` 에 `/* --- {컴포넌트명} --- */` 섹션 추가
2. `templates_front/layouts/_{컴포넌트명}.html` 생성 (필요한 경우)
3. 이 문서의 4.1 표에 항목 추가
4. 해당 컴포넌트가 처음 사용되는 페이지의 `<head>` 에 `components.css` 가 이미 로드돼 있는지 확인

---

## 5. 화면 청사진

> NUNCHI 는 **공용 진입 → 모드 분기 → 모드별 내부 플로우** 의 3 단계 구조.
> Feature ID 는 `.claude/PROJECT.md` 의 기능 요구사항 표 참조.

### 5.1 공용 진입 (intro)

두 모드 공통으로 거치는 진입 플로우. 파일은 `templates_front/` 루트에 평평하게 배치.

| 화면 | 파일 | 기능 ID | 상태 |
|---|---|---|---|
| 스플래쉬 | `templates_front/splash.html` | 0-1 | ✅ 구현 완료 |
| 주문 방식 선택 | `templates_front/order-mode.html` | 0-3 | ✅ 구현 완료 |
| 매장/포장 선택 | `templates_front/dine-location.html` | 1-1 | ⏳ 다음 작업 |
| 언어 선택 (오버레이) | 공통 컴포넌트 `lang-selector` | 0-2 | ⏳ 예정 |

### 5.2 일반 키오스크 모드

터치 기반 전통 주문 플로우 + 선택적 LLM 채팅. 파일은 `templates_front/kiosk/` 안.

| 화면 | 파일 | 기능 ID | 상태 |
|---|---|---|---|
| 카테고리 목록 | `kiosk/category.html` | 1-2 | ⏳ 예정 |
| 메뉴 목록 | `kiosk/menu-list.html` | 1-2 | ⏳ 예정 |
| 메뉴 상세 + 옵션 | `kiosk/menu-detail.html` | 1-3 | ⏳ 예정 |
| 장바구니 | `kiosk/cart.html` | 1-4, 1-5 | ⏳ 예정 |
| 주문 요약 | `kiosk/order-summary.html` | 6-1 | ⏳ 예정 |
| 결제 화면 | `kiosk/payment.html` | 6-2 ~ 6-5 | ⏳ 예정 |
| 주문 완료 | `kiosk/complete.html` | 6-6 | ⏳ 예정 |

### 5.3 아바타 음성 모드

캐릭터 아바타 + 음성 대화 중심 플로우. 파일은 `templates_front/avatar/` 안.

| 화면 | 파일 | 기능 ID | 상태 |
|---|---|---|---|
| 아바타 첫 인사 | `avatar/intro.html` | 3-2 | ⏳ 예정 |
| 음성 대화 메인 | `avatar/voice.html` | 3-1, 3-3, 3-4, 4-1~4-6 | ⏳ 예정 |
| 주문 확인 | `avatar/confirm.html` | 3-5 | ⏳ 예정 |
| 결제 | `avatar/payment.html` | 6-1 ~ 6-5 | ⏳ 예정 |
| 주문 완료 | `avatar/complete.html` | 6-6 | ⏳ 예정 |

### 5.4 공통 오버레이 / 모달

화면이 아닌 **상위 레이어**로 떠 있는 UI 요소들. 양쪽 모드에서 공유.

| 오버레이 | 트리거 | 기능 ID |
|---|---|---|
| AI 추천 확인 모달 | LLM 이 자동 화면 조작 시도 시 | 1-4, 2-3, 2-4 |
| 눈치 감지 알림 | 체류 시간 / 반복 탐색 감지 시 | 5-1, 5-2, 5-3 |
| 결제 중 로딩 | 결제 처리 중 | 6-4 |
| 도움말 모달 | `help-btn` 클릭 시 | — |
| 에러 토스트 | API 실패 / 음성 인식 실패 | 6-5 |
| 세션 타임아웃 경고 | 비활동 임계 도달 시 | 7-4 |
| 언어 선택 패널 | 우상단 lang-selector 클릭 | 0-2 |

### 5.5 기능 ID 매핑 요약

| Feature ID 범위 | 분류 | 다루는 화면 |
|---|---|---|
| 0-1 ~ 0-4 | 시작/모드 | splash, order-mode, dine-location, lang-selector |
| 1-1 ~ 1-5 | 일반 UI | dine-location, kiosk/* |
| 2-1 ~ 2-4 | AI 보조 주문 | 모든 페이지 + AI 추천 모달 |
| 3-1 ~ 3-5 | 아바타 UI | avatar/* |
| 4-1 ~ 4-6 | 음성 AI | avatar/voice (프론트는 상태 표시만, 처리는 FastAPI) |
| 5-1 ~ 5-4 | 메뉴 추천 | 눈치 감지 알림 + AI 추천 모달 |
| 6-1 ~ 6-6 | 결제/완료 | kiosk/payment, avatar/payment, complete |
| 7-1 ~ 7-4 | 세션/기록 | 프론트 state 관리 (localStorage + 서버 동기화) |
| 8-1 ~ 8-3 | 안정성 | 모든 페이지 (병렬 입력 처리 규칙) |
| 9-1 ~ 9-3 | 배포/운영 | 프론트 무관 |

---

## 6. 화면 전환 플로우

```
┌─────────────────────────────────────────────────────────────┐
│                      공용 진입                              │
│                                                             │
│   splash.html (S01)                                         │
│      │                                                      │
│      │ [주문하기 버튼 또는 화면 터치]                        │
│      ▼                                                      │
│   order-mode.html (S02)                                     │
│      │                                                      │
│      ├─[터치로 주문하기]─────────┐                          │
│      │                           │                          │
│      └─[AI 아바타 대화하기]──┐   │                          │
│                              │   │                          │
└──────────────────────────────┼───┼──────────────────────────┘
                               │   │
                               ▼   ▼
                       dine-location.html (S03)
                          │
                          ├─[매장]─┐
                          └─[포장]─┤
                                   ▼
                  ┌────────────────┴────────────────┐
                  │                                 │
                  ▼                                 ▼
        ┌────────────────────┐          ┌─────────────────────┐
        │   아바타 모드       │          │   일반 키오스크      │
        │                    │          │                     │
        │  avatar/intro      │          │  kiosk/category     │
        │      ↓             │          │      ↓              │
        │  avatar/voice      │          │  kiosk/menu-list    │
        │      ↓             │          │      ↓              │
        │  avatar/confirm    │          │  kiosk/menu-detail  │
        │      ↓             │          │      ↓              │
        │  avatar/payment    │          │  kiosk/cart         │
        │      ↓             │          │      ↓              │
        │  avatar/complete   │          │  kiosk/order-summary│
        │      ↓             │          │      ↓              │
        │   (홈 복귀)         │          │  kiosk/payment      │
        │                    │          │      ↓              │
        │                    │          │  kiosk/complete     │
        │                    │          │      ↓              │
        │                    │          │   (홈 복귀)          │
        └────────────────────┘          └─────────────────────┘
```

### 6.1 되돌아가기 규칙

- 모든 모드 내부 페이지에 **좌상단 뒤로가기 버튼** (`top-bar` 컴포넌트)
- 공용 진입(splash, order-mode, dine-location)은 **선형 전환**, 뒤로가기로 이전 단계 가능
- splash 에서 뒤로가기는 **노출 안 함** (시작 지점)
- 결제 진행 후 (`payment` 진입 후)는 뒤로가기 비활성화 — 중복 결제 방지

### 6.2 세션 초기화 경로

다음 상황에 세션이 리셋되고 splash 로 복귀:
- 결제 완료 후 `complete.html` 의 "처음으로" 버튼
- 5 분 비활동 자동 타임아웃 (7-4)
- 결제 실패 후 사용자가 "취소"

---

## 7. 페이지별 상세 스펙

> ✅ 완료된 페이지는 **실측값**, ⏳ 예정 페이지는 **가이드/스켈레톤** 으로 작성합니다.
> 예정 페이지의 상세 디자인은 피그마 export 가 들어올 때 이 문서에 채워 넣습니다.

### 7.1 splash.html ✅

**파일 위치**: `templates_front/splash.html` + `static/front/css/splash.css`
**기능 ID**: 0-1 (시작 화면)
**용도**: 키오스크 첫 진입. 매장 정체성 + 인기 메뉴 1개 강조 + 주문 시작 CTA.

#### 레이아웃 (절대 좌표)

```
┌─────────────────── 720 ───────────────────┐
│                                  [동국대 로고]│ top: 48, right: 40
│                                              │
│              학생식당                         │ top: 162
│              상록원                           │   (96px hero)
│                                              │
│  ┌──────────────────────────────────────┐   │ top: 312
│  │ [지금 인기 ⏰]            [숯불삼겹솥밥] │   │
│  │                          [₩5,000]    │   │ 카드 664×499
│  │  ───────────────────────────────────  │   │ + 상단 그라데이션
│  │  현재 시간대 주문 1위           [81%] │   │ + 인디케이터 4개
│  │  점심 피크 12:00–13:00 최다 주문       │   │
│  │  ████████████████░░░░  (progress)    │   │
│  └──────────────────────────────────────┘   │
│        ●  ●  ●  ●   (인디케이터)             │
│                                              │
│  ┌──────────────────────────────────────┐   │ top: 919
│  │              주문하기                  │   │ 664×118
│  └──────────────────────────────────────┘   │ 오렌지 + 그림자
│                                              │
│                  ↑                           │ top: 1052
│             화면을 터치하세요                  │
│                                              │
│         [🎨 Team Nunchi]                     │ top: 1223
│                                              │
│  ╭───╮                                       │ help-btn
│  │ ? │                                       │ left:40, bottom:40
│  ╰───╯                                       │
└──────────────────────────────────────────────┘
                                              1280
```

#### 사용 컴포넌트
- `help-btn` (partial)

#### CSS 토큰 사용
- 배경: `--color-bg`
- 카드: `--color-surface` + `--shadow-card`
- 뱃지: `--color-accent-purple` + `--shadow-badge`
- 주문 버튼: `--color-primary` + `--shadow-primary-btn`
- 통계 강조: `--color-accent-purple`
- 가격: `--color-accent-peach`

#### 인터랙션
- 주문하기 버튼 → `order-mode.html` 로 이동 *(핸들러 미구현)*
- "Team Nunchi" 라벨 → 개발용, 향후 디자인 시스템 페이지로 이동 가능
- 화면 어디든 터치 → `order-mode.html` 로 이동 *(미구현, 스펙 예정)*

#### 데이터 연동 (예정)
- 인기 메뉴 정보: `GET /api/mcp/menus/popular?limit=1`
- 주문 비율 통계: `GET /api/mcp/sales/today?menuId={id}`
- 인디케이터 4개 → 캐러셀로 4개 메뉴 순환 (자동 + 수동)

---

### 7.2 order-mode.html ✅

**파일 위치**: `templates_front/order-mode.html` + `static/front/css/order-mode.css`
**기능 ID**: 0-3 (주문 모드 선택)
**용도**: 사용자가 "터치로 주문" / "AI 아바타 대화" 두 가지 중 선택.

#### 레이아웃

```
┌─────────────────── 720 ───────────────────┐
│ ┌──────┐  상록원              [🎤]         │ 헤더 720×130
│ │  ←   │  주문 방식 선택                    │ 흰 배경 + 보더
│ └──────┘                                  │
│ ─────────────────────────────────────────  │
│ "터치 주문이요" 또는 "아바타 주문이요"      │ 배너 720×64
│ ─────────────────────────────────────────  │ 피치 배경
│                                              │
│                                              │
│       ┌──────┐         ┌──────┐             │ top: 280
│       │      │         │      │             │ 카드 300×600
│       │  🎯  │         │  🤖  │             │
│       │      │         │      │             │
│       │  터치  │         │  AI  │             │
│       │ 주문하기 │       │ 대화하기 │           │
│       │ Touch  │         │  Avatar │          │
│       │  Order │         │  Order │           │
│       │        │         │        │           │
│       │   →    │         │   →    │          │
│       └──────┘         └──────┘             │
│                                              │
│  ╭───╮                                       │ help-btn
│  │ ? │                                       │
│  ╰───╯                                       │
└──────────────────────────────────────────────┘
```

#### 사용 컴포넌트
- `help-btn` (partial)
- (인라인) 헤더, 배너, 카드 — 2번째 등장하면 컴포넌트화 예정

#### CSS 토큰 사용
- 페이지 배경: `--color-surface-subtle`
- 헤더 배경: `--color-surface`
- 배너 배경: `--color-surface-peach` + 보더 `--color-border-peach`
- 배너 텍스트: `--color-primary`
- 터치 카드: `--color-surface`
- 아바타 카드: `--color-surface-peach-soft`
- 카드 그림자: `--shadow-card-subtle`

#### 인터랙션
- 좌측 카드 클릭 → 일반 키오스크 모드 진입 *(미구현)*
- 우측 카드 클릭 → 아바타 음성 모드 진입 *(미구현)*
- 음성 마이크 버튼 → 음성 입력 시작 *(미구현)*
- 뒤로가기 → splash *(미구현)*

#### SVG 아이콘
- `/images/common/icons/touch-tap.svg` (자체 제작 — 오렌지 리플)
- `/images/common/icons/ai-robot.svg` (자체 제작 — 퍼플 로봇)
- `/images/common/icons/arrow-back.svg` (40×40 `<` 화살표)
- `/images/common/icons/voice-mic.svg` (28×28 마이크)
- `/images/common/icons/card-cta.svg` (26×26 `>` 화살표, opacity 0.6 로 표시)

---

### 7.3 dine-location.html ⏳

**파일 위치**: `templates_front/dine-location.html` + `static/front/css/dine-location.css` (예정)
**기능 ID**: 1-1 (매장/포장 선택)
**용도**: 주문 모드 선택 후 "여기서 드시겠어요? / 가지고 가시겠어요?" 분기.

#### 가이드 레이아웃

- 헤더: order-mode 와 동일 패턴 (뒤로가기 + "어디서 드실까요?" + 음성 마이크)
- 두 개의 큰 선택 카드 (가로 분할 또는 세로 스택 — 피그마 결정 대기)
- "매장 식사" / "포장 / 테이크아웃" 두 가지 선택지
- 아이콘: 식기 vs 종이백 (자체 SVG 제작 또는 피그마 export)
- 좌하단: `help-btn`

#### 사용 예정 컴포넌트
- `top-bar` (현재 order-mode 헤더와 동일하면 이때 컴포넌트화)
- `help-btn`
- 카드 디자인 — order-mode 카드 패턴 재사용 가능

#### 인터랙션
- 매장 선택 → 모드별 다음 화면 (avatar/intro 또는 kiosk/category)
- 포장 선택 → 동일하게 다음 화면 + state 에 `dineMode='takeout'` 저장
- 뒤로가기 → order-mode

> **상세 스펙은 피그마 export 들어올 때 채워 넣음.**

---

### 7.4 kiosk/* ⏳

#### kiosk/category.html
- 메뉴 카테고리 (한식·양식·디저트 등) 그리드
- 카테고리당 큰 카드 (이미지 + 이름)
- 좌하단 help-btn, 좌상단 뒤로가기, 우상단 음성 토글

#### kiosk/menu-list.html
- 선택된 카테고리의 메뉴 리스트 (2열 그리드)
- 메뉴 카드: 썸네일 + 이름 + 가격
- 하단 고정 bottom-bar: 장바구니 요약 + "장바구니 보기" CTA
- AI 추천 카드 별도 강조 (퍼플 보더)

#### kiosk/menu-detail.html
- 상단: 큰 메뉴 이미지
- 옵션 선택 (사이즈, 토핑 등)
- 수량 조절
- "장바구니 담기" CTA
- AI 추천 모달 트리거 가능 (관련 메뉴 추천)

#### kiosk/cart.html
- 담긴 메뉴 리스트 + 수량 변경 + 삭제
- 합계 표시
- "결제하기" CTA → kiosk/order-summary

#### kiosk/order-summary.html
- 주문 내역 최종 확인
- 매장/포장 표시
- 합계 + "결제 진행" CTA → kiosk/payment

#### kiosk/payment.html
- 결제 수단 선택 (IC카드 / 정맥인증)
- 결제 진행 상태 표시
- 결제 중 로딩 오버레이 (6-4)
- 실패 시 에러 토스트 (6-5)

#### kiosk/complete.html
- 주문 완료 메시지
- 주문 번호
- "처음으로" 버튼 → splash + 세션 리셋

> **각 페이지는 피그마 디자인이 들어오는 순서대로 상세 스펙 추가.**

---

### 7.5 avatar/* ⏳

#### avatar/intro.html
- 아바타 캐릭터 등장 (대형 일러스트 또는 Lottie)
- "안녕하세요! 저는 NUNCHI 도우미예요" 인사
- "음성으로 편하게 말씀해주세요" 안내
- 자동으로 voice 화면으로 전환 (또는 화면 터치)

#### avatar/voice.html
- 아바타 캐릭터 (말하는 중·듣는 중 상태별 애니메이션)
- 음성 인식 상태 시각화 (파형, 듣는 중 인디케이터)
- STT 결과 텍스트 실시간 표시
- 추천 메뉴 카드 (AI 가 자동으로 띄움)
- 화면 좌하단 help-btn
- 우하단 "직접 터치로 주문" 전환 버튼

#### avatar/confirm.html
- 주문 내역 음성 확인 ("이거 맞으세요?")
- 합계 + 매장/포장
- "네, 결제할게요" / "수정할게요" CTA

#### avatar/payment.html, avatar/complete.html
- kiosk 결제 화면과 동일 기능, 단 음성 안내 추가

> **상세 디자인 미정. 아바타 캐릭터 디자인이 결정되면 채워 넣음.**

---

### 7.6 공통 오버레이 ⏳

#### AI 추천 확인 모달

LLM 이 화면을 자동 조작하려 할 때 **사용자 확인을 받기 위한 모달** (1-4, 2-4).

```
┌─────────────────────────────┐
│      AI 추천                │
│                             │
│  "오늘 인기 1위 메뉴를       │
│   장바구니에 넣을까요?"      │
│                             │
│  [숯불삼겹솥밥 / ₩5,000]     │
│                             │
│  [   확인   ] [   취소   ]  │
└─────────────────────────────┘
```

- 화면 중앙 모달 (퍼플 강조 보더)
- 부드러운 fade-in (300ms)
- 백드롭 클릭 → 닫기 (취소와 동일)
- 확인 시 → MCP UI Control 로 액션 진행
- 컴포넌트: `modal` (예정) + `_ai-confirm.html` partial (예정)

#### 눈치 감지 알림 (5-1, 5-2, 5-3)

**트리거 조건**:
- 같은 화면 30 초 이상 머무름
- 같은 카테고리 5번 이상 왕복
- STT 신뢰도 50% 미만 3회 연속

**UI 동작**:
- 화면 하단에서 슬라이드 업
- 퍼플 톤 카드 + 부드러운 그림자
- "도와드릴까요? 추천 메뉴를 보여드릴 수 있어요" 메시지
- "네, 추천해주세요" / "괜찮아요" CTA
- 5초 무응답 시 자동 닫기

#### 도움말 모달

- `help-btn` 클릭 시 표시
- "키오스크 사용법" + "음성 모드 안내" + "직원 호출"
- 직원 호출 → 점원 알림 (8-2)

#### 에러 토스트

- 화면 상단 또는 하단 슬라이드 인
- 자동 사라짐 (3초)
- 색상: `--color-primary` (오렌지) 또는 별도 danger 토큰 (예정)

---

## 8. 기술 고려사항

### 8.1 접근성 (배리어프리)

NUNCHI 의 핵심 정체성. 다음 규칙을 **반드시** 준수:

| 항목 | 기준 |
|---|---|
| 본문 최소 크기 | 18 px |
| 버튼 텍스트 최소 크기 | 28 px |
| 터치 타겟 최소 크기 | 64 × 64 px |
| 색 대비 (WCAG) | AA (4.5:1) 이상, 가능하면 AAA (7:1) |
| `aria-label` | 아이콘 전용 버튼에 필수 |
| 포커스 링 | `outline: none` 금지, `--color-focus` 사용 |
| 색에만 의존한 정보 표시 금지 | 색 + 아이콘/텍스트 병행 |

### 8.2 다국어 (향후)

지금은 한국어 고정. 향후 도입 시:

- `data-i18n="key.path"` 속성 + JSON 사전 방식
- 지원 예정: 한국어(기본) / 영어 / 중국어 / 일본어
- 우상단 `lang-selector` 컴포넌트로 전환
- `localStorage('kioskLang')` 으로 페이지 간 유지
- 홈 복귀 시 기본 언어로 자동 복원

### 8.3 상태 관리

| 데이터 | 저장 위치 | 수명 |
|---|---|---|
| 주문 세션 ID | `sessionStorage` | 탭 닫힐 때까지 |
| 선택한 모드 (avatar/kiosk) | `sessionStorage` | 동일 |
| 선택한 dine 옵션 (eat-in/takeout) | `sessionStorage` | 동일 |
| 장바구니 (서버 동기화 전) | `sessionStorage` | 동일 |
| 언어 설정 | `localStorage('kioskLang')` | 영구 (홈 복귀 시 초기화) |
| 사용자 행동 로그 ("눈치" 측정) | 메모리 + 서버 전송 | 페이지 단위 |

페이지 간 큰 데이터 전달은 `sessionStorage` + 페이지 로드 시 복원. URL 쿼리 파라미터는 단순 분기 정도에만.

### 8.4 세션 타임아웃 (7-4)

- **3 분 비활동**: 부드러운 알림 ("주문을 계속 진행하시겠어요?")
- **5 분 비활동**: 자동 세션 종료 + splash 복귀 + 모든 state 리셋
- 측정 이벤트: `touchstart`, `click`, `keydown`, 음성 인식 활성화

### 8.5 동시성 (8-1, 8-2)

터치 + 음성 입력이 **동시에** 들어올 수 있음:

- 터치 우선 처리 — 터치 발생 시 진행 중인 음성 명령은 인터럽트
- 모드 일관성 — 한쪽에서 발생한 state 변경이 다른 쪽에 즉시 반영
- 충돌 시 사용자 확인 모달

### 8.6 "눈치" 감지 트리거 (5-1)

프론트엔드 책임:
- 화면별 진입 시각 기록
- 마지막 사용자 액션 시각 기록
- 같은 카테고리/메뉴 탭 횟수 카운트
- 30 초마다 백엔드로 행동 이벤트 전송

판단 책임 (FastAPI):
- 누적 데이터로 "추천 트리거 시점" 판단
- 추천 트리거 시 → MCP 로 프론트에 추천 모달 표시 명령

### 8.7 MCP UI Control 연동

- FastAPI ↔ 프론트엔드 실시간 통신: WebSocket 또는 SSE
- AI 가 화면을 자동 조작하려 할 때:
  1. WebSocket 으로 액션 명령 수신
  2. **사용자 확인 모달 띄우기** (1-4)
  3. 확인 시 → DOM 액션 실행 (메뉴 강조, 클릭, 옵션 선택, 장바구니 담기)
  4. 결과 → WebSocket 으로 FastAPI 에 보고

### 8.8 에러 처리

| 상황 | 처리 |
|---|---|
| API 4xx | 사용자에게 친절한 메시지 토스트 |
| API 5xx | "잠시 후 다시 시도" 토스트 + 재시도 버튼 |
| AI 응답 3 초 초과 | 로딩 표시 후 fallback (터치 모드 전환 권장) |
| STT 신뢰도 낮음 | "다시 한번 말씀해주세요" 음성 안내 |
| 결제 실패 | 결제 화면에 redspecific 에러 표시 + 재시도 옵션 |
| 네트워크 끊김 | 전체 화면 경고 + "직원 호출" CTA |

### 8.9 하드웨어 연동 (참고)

| 기능 | 장치 | API |
|---|---|---|
| 음성 입력 | 핀 마이크 | `navigator.mediaDevices.getUserMedia()` 또는 백엔드 직접 처리 |
| 결제 | IC 카드 리더 + 정맥 인증 단말 | 별도 SDK (백엔드 경유) |
| 영수증 | 포토 프린터 | 백엔드 API |
| 결제음 | 키오스크 스피커 | Web Audio API 또는 `<audio>` |

---

## 부록 A. 변경 이력

| 날짜 | 버전 | 변경 |
|---|---|---|
| 2026-04-15 | v1.0 | 초기 작성 (splash, order-mode 구현 기준 + 전체 청사진) |

## 부록 B. 다음 단계 / TODO

- [ ] dine-location.html 피그마 export 받아 7.3 섹션 채우기
- [ ] kiosk 모드 첫 화면(category) 디자인 확정
- [ ] 아바타 캐릭터 일러스트 디자인 확정
- [ ] AI 추천 모달 컴포넌트화 (`_ai-confirm.html`)
- [ ] `top-bar` / `bottom-bar` 컴포넌트 승격 (2 페이지 이상에서 같은 헤더/하단바 사용 시)
- [ ] `--space-*` 토큰을 variables.css 에 추가
- [ ] 다국어 시스템 도입 (`data-i18n`)
- [ ] 사용자 매뉴얼 첨부 (이 문서 확장)
