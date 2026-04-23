# 눈치 키오스크 UI/UX 설계 계획서

> **디바이스 해상도**: 720 x 1280 px (세로형 터치 키오스크)  
> **제작 목적**: 대학 구내식당(상록원) AI 기반 음식 주문 키오스크  
> **핵심 컨셉**: "눈치" — 사용자의 망설임·체류시간·반복탐색을 감지하여 선제적으로 도움을 제공하는 AI 키오스크  
> **디자인 방향**: 웜 오렌지 톤 + 글래스모피즘 + 소프트 그라데이션 배경  
> **기술 스택**: HTML5 + CSS3 + Vanilla JS (jQuery 3.7.0)  
> **아키텍처**: 멀티 페이지 (페이지별 HTML) + localStorage 세션 관리 + WebSocket (음성 스트리밍)  
> **템플릿 엔진**: Jinja2 (FastAPI) — 공통 레이아웃 `{% include %}` 방식  
> **언어**: 한국어 단일 (영어는 추후 확장 고려)  
> **브랜드**: 눈치 · NUNCHI Kiosk

---

## 1. 서비스 개요

### 1.1 서비스 정의

눈치 키오스크는 대학 구내식당(상록원)에 설치되는 AI 주문 키오스크로, **두 가지 주문 모드**를 제공한다.

| 모드 | 설명 | 핵심 인터랙션 |
|---|---|---|
| **일반 UI 모드** | 터치 기반 메뉴 탐색 → 옵션 선택 → 장바구니 → 결제 | 터치 + AI 보조 (LLM 채팅, MCP UI 자동조작) |
| **아바타 UI 모드** | 캐릭터 아바타와 음성 대화를 통한 주문 | 음성 대화 + 아바타 애니메이션 + 기승전결 주문 로직 |

두 모드 모두에서 **"눈치 엔진"**이 사용자의 행동 패턴(체류시간, 반복탐색, 음성 불확실성)을 분석하여 메뉴 추천을 자동 트리거한다.

### 1.2 핵심 차별점

- **눈치 기반 추천**: 사용자가 "뭘 시킬지 모르겠다"고 말하기 전에 시스템이 먼저 감지
- **듀얼 모드**: 터치에 익숙한 사용자와 음성 선호 사용자 모두 수용
- **MCP UI 자동조작**: AI가 음성 명령을 받아 UI를 직접 조작 (메뉴 강조, 장바구니 담기 등)
- **정맥인증 결제**: 기존 IC카드 + 생체인증(정맥) 듀얼 결제

---

## 2. 프로젝트 파일 구조

```
/templates_front/dev
  index.html                              ← S00 시작화면 (광고/안내 + 주문시작)
  S01-mode.html                           ← S01 모드 선택 (일반 UI / 아바타 UI)
  S02-dine.html                           ← S02 매장/포장 선택 (공용 진입)
  /flowN
    N02-menu.html                         ← N02 메뉴 목록 (카테고리별)
    N03-detail.html                       ← N03 메뉴 상세 (옵션 선택)
    N04-cart.html                         ← N04 장바구니
    N05-recommend.html                    ← N05 눈치 추천 팝업 (오버레이)
  /flowA
    A01-avatar.html                       ← A01 아바타 대화 화면 (전체 주문 프로세스)
  /flowP
    P01-summary.html                      ← P01 주문 요약
    P02-payment.html                      ← P02 결제 수단 선택 (IC카드 / 정맥인증)
    P03-vein.html                         ← P03 정맥인증 스캔
    P04-processing.html                   ← P04 결제 처리 중
    P05-complete.html                     ← P05 주문 완료
    P06-fail.html                         ← P06 결제 실패 / 재시도
  /layouts
    _head.html                            ← 공통 <head>
    _scripts.html                         ← 공통 JS
    _footer.html                          ← 푸터 로고
    _ai_chat_panel.html                   ← AI 채팅 사이드 패널
    _nunchi_toast.html                    ← 눈치 추천 토스트 알림

/static/front
  /css
    common.css                            ← 디자인 토큰 + 웹폰트 + 리셋 + 레이아웃
    components.css                        ← 공통 컴포넌트
    S00-start.css / S01-mode.css
    xeicon.min.css
    /flowN  (N02~N05)
    /flowA  (A01)
    /flowP  (P01~P06)
    ai-chat.css
    /fonts                                ← Pretendard, NanumSquareRound, XEIcon
  /js
    common.js                             ← 유휴 감지, 네트워크 체크, fade-up
    app.js                                ← 페이지 이동, AppState, 세션 초기화
    nunchi-engine.js                      ← 눈치 엔진
    voice-pipeline.js                     ← 음성 파이프라인
    ai-chat.js                            ← AI 채팅 패널
    mcp-controller.js                     ← MCP UI 자동조작
    S00-start.js / S01-mode.js
    /flowN  (N02~N05)
    /flowA  (A01)
    /flowP  (P01~P06)
  /images
    /avatars  /categories  /menu  /icons  /bg
  /lib
    jquery-3.7.0.min.js / animate.min.css / reset / swal2
```

---

## 3. Jinja2 템플릿 시스템

### 3.1 공통 레이아웃

| 파일 | 내용 |
|---|---|
| `_head.html` | meta, 공통 CSS, title |
| `_scripts.html` | jQuery, SweetAlert2, common.js, app.js, nunchi-engine.js |
| `_footer.html` | NUNCHI 로고 |
| `_ai_chat_panel.html` | 일반 UI용 AI 채팅 사이드 패널 |
| `_nunchi_toast.html` | 눈치 추천 토스트 |

### 3.2 페이지별 사용법

```html
<head>
    {% include 'dev/layouts/_head.html' %}
    <link rel="stylesheet" href="/static/front/css/flowN/N02-menu.css">
</head>
<body>
<div id="app" class="kiosk-app">
    <main class="screen-content page-content">
        <!-- 페이지 고유 콘텐츠 -->
    </main>
    {% include 'dev/layouts/_ai_chat_panel.html' %}
    {% include 'dev/layouts/_nunchi_toast.html' %}
    {% include 'dev/layouts/_footer.html' %}
</div>
{% include 'dev/layouts/_scripts.html' %}
<script src="/static/front/js/flowN/N02-menu.js"></script>
</body>
```

---

## 4. 디자인 시스템

### 4.1 컬러 시스템 개요

컬러 시스템은 **Accent(Brand) → Neutral(Grey) → Semantic** 3계층으로 구성한다. 모든 색상은 HSL 기반으로 파생하며, Primary 1색을 기준으로 전체 팔레트를 생성한다. **팔레트에 선언되지 않은 색상은 사용하지 않는다.**

```
┌─────────────────────────────────────────────┐
│  1. Accent Colors (Brand)                   │
│     Primary (Orange)  → 10단계 팔레트       │
│     Secondary (Amber) → 보조 (최소 사용)    │
│                                             │
│  2. Neutral Colors (Warm Grey)              │
│     White + 50~900 → 11단계                 │
│                                             │
│  3. Semantic Colors (고정 4색 + 배경 틴트)   │
│     Error / Warning / Success / Info        │
└─────────────────────────────────────────────┘
```

### 4.2 Accent Colors — Primary (Orange)

기준값 `#E8600A` = `hsl(24, 92%, 47%)`. L값을 10단위 가감하여 10단계 생성.

| 토큰 | HSL | HEX | 용도 |
|---|---|---|---|
| `--primary-50` | hsl(24, 92%, 97%) | `#FFF5EE` | 배경 틴트, 눈치 추천 배경 |
| `--primary-100` | hsl(24, 92%, 90%) | `#FFE0C7` | 호버 배경, 뱃지 배경 |
| `--primary-200` | hsl(24, 92%, 80%) | `#FFC08A` | 비활성 보더, 칩 배경, 블롭 |
| `--primary-300` | hsl(24, 92%, 70%) | `#FFA050` | 보조 아이콘, 진행 바, 블롭 |
| `--primary-400` | hsl(24, 92%, 60%) | `#FF8320` | 버튼 호버 |
| `--primary-500` | hsl(24, 92%, 47%) | `#E8600A` | **기본 — CTA, 활성 탭, 선택 보더** |
| `--primary-600` | hsl(24, 92%, 40%) | `#C44F08` | 버튼 프레스 |
| `--primary-700` | hsl(24, 92%, 30%) | `#933C06` | 강조 텍스트, 가격 (접근성 4.5:1) |
| `--primary-800` | hsl(24, 92%, 20%) | `#622804` | 다크 강조 |
| `--primary-900` | hsl(24, 92%, 10%) | `#311402` | 극강조 (거의 미사용) |

### 4.3 Accent Colors — Secondary (Amber)

Primary H값 +30 → `hsl(54, 85%, 47%)`. 아바타 모드 구분, 정맥인증 등 Primary와 분리 필요 영역에만 사용. **4단계만 선언.**

| 토큰 | HEX | 용도 |
|---|---|---|
| `--secondary-50` | `#FFFCE8` | 아바타 배경 틴트 |
| `--secondary-100` | `#FFF5B3` | 아바타 말풍선 배경 |
| `--secondary-500` | `#D4B30A` | 아바타 강조, 정맥인증 포인트 |
| `--secondary-700` | `#877206` | 아바타 강조 텍스트 |

### 4.4 Neutral Colors — Warm Grey

웜 그레이 (Hue 30, 낮은 Saturation). 배경·텍스트·구분선·비활성 전반.

| 토큰 | HEX | 용도 |
|---|---|---|
| `--neutral-0` | `#FFFFFF` | 카드/모달 배경 |
| `--neutral-50` | `#FAF8F6` | 페이지 배경 |
| `--neutral-100` | `#F0EDEA` | 섹션 배경, 입력필드 |
| `--neutral-200` | `#DDD9D5` | 구분선, 비활성 보더 |
| `--neutral-300` | `#C2BBB5` | 플레이스홀더, 비활성 아이콘 |
| `--neutral-400` | `#A19A93` | 캡션 텍스트 |
| `--neutral-500` | `#847D76` | 보조 텍스트 |
| `--neutral-600` | `#6B645E` | 본문 보조 |
| `--neutral-700` | `#4D4742` | 본문 텍스트 |
| `--neutral-800` | `#352F2B` | 제목 텍스트 |
| `--neutral-900` | `#1E1915` | 최강조, 오버레이 |

### 4.5 Semantic Colors — 기능 전용 4색

**반드시 아이콘/텍스트와 함께 사용** (색상만으로 의미 전달 금지).

| 토큰 | HEX | 용도 | 배경 틴트 |
|---|---|---|---|
| `--semantic-error` | `#DC3545` | 결제 실패, 품절 | `#FEF2F2` |
| `--semantic-warning` | `#F59E0B` | 재고 부족, 타임아웃 | `#FFFBEB` |
| `--semantic-success` | `#16A34A` | 결제 완료, 담기 성공 | `#F0FDF4` |
| `--semantic-info` | `#2563EB` | 눈치 추천, AI 안내 | `#EFF6FF` |

### 4.6 Contextual Tokens — 용도별 매핑

```css
/* 배경 */
--color-bg-page:         var(--neutral-50);
--color-bg-card:         var(--neutral-0);
--color-bg-input:        var(--neutral-100);
--color-bg-overlay:      rgba(30, 25, 21, 0.4);

/* 텍스트 */
--color-text-heading:    var(--neutral-800);
--color-text-body:       var(--neutral-700);
--color-text-secondary:  var(--neutral-500);
--color-text-disabled:   var(--neutral-300);
--color-text-inverse:    var(--neutral-0);
--color-text-price:      var(--primary-700);

/* 보더 */
--color-border-default:  var(--neutral-200);
--color-border-active:   var(--primary-500);

/* 버튼 */
--color-btn-primary:     var(--primary-500);
--color-btn-hover:       var(--primary-400);
--color-btn-press:       var(--primary-600);
--color-btn-disabled:    var(--neutral-200);

/* 특수 */
--color-cart-badge:      var(--semantic-error);
--color-sold-out:        var(--neutral-400);
--color-nunchi-bg:       var(--primary-50);
--color-nunchi-border:   var(--primary-300);
```

### 4.7 컬러 사용 금지 원칙

1. 팔레트 외 색상 사용 금지
2. Semantic을 장식 목적으로 사용 금지
3. 색상 단독 의미 전달 금지 (아이콘/텍스트 병행)
4. Primary 텍스트는 700 이상 (500은 배경/보더용)

### 4.8 글래스모피즘

| 변수 | 값 |
|---|---|
| `--glass-bg` | `rgba(255, 255, 255, 0.55)` |
| `--glass-bg-heavy` | `rgba(255, 255, 255, 0.75)` |
| `--glass-border` | `rgba(255, 255, 255, 0.7)` |
| `--glass-shadow` | `0 8px 32px rgba(30, 25, 21, 0.08)` |
| `--glass-blur` | `blur(20px)` |

### 4.9 블롭·그림자·폰트·레이아웃·애니메이션

**블롭**: Primary 팔레트만 사용 (`--primary-200`, `--primary-100`)

**그림자**:
- `--shadow-sm`: `0 2px 8px rgba(30,25,21,0.06)` (카드)
- `--shadow-md`: `0 4px 16px rgba(30,25,21,0.10)` (떠있는 요소)
- `--shadow-lg`: `0 8px 32px rgba(30,25,21,0.15)` (모달)

**폰트**: Pretendard — ExtraBold(800) / Bold(700) / SemiBold(600) / Regular(400) / Light(300)

**레이아웃**: 720x1280, 상단 53px, 좌우 27px, 푸터 67px, 터치 53px+, 버튼 53px r11, 카드 r13

**애니메이션**: ease-out / ease-bounce, 200ms / 350ms / 600ms

---

## 5. 공통 컴포넌트

### 5.1 페이지 배경 (`.page-bg`)
`--color-bg-page` + Primary 블롭 (blur 80px, `floatBlob` 20초)

### 5.2 메뉴 카드 (`.menu-card`)
`--color-bg-card` + `--shadow-sm` | 이미지(4:3) → 메뉴명(`--color-text-heading`) → 가격(`--color-text-price`) | 품절: opacity 0.5 + "품절"(`--color-sold-out`)

### 5.3 옵션 칩 (`.option-chip`)
미선택: `--color-bg-card` + `--color-border-default` | 선택: `--color-btn-primary` + `--color-text-inverse` + bounce

### 5.4 수량 조절기 (`.quantity-control`)
`[-]` `수량` `[+]` — 56px 원형, `--color-bg-card` + `--color-border-default`

### 5.5 장바구니 바 (`.cart-bar`)
하단 120px, `--glass-bg-heavy` | 뱃지(`--color-cart-badge`) + 총액 + "주문하기" CTA | 0개: 숨김

### 5.6 AI 채팅 패널 (`.ai-chat-panel`)
우측 400px 슬라이드인 | 사용자: `--primary-500` / AI: `--color-bg-card` | FAB 60px `--color-btn-primary`

### 5.7 눈치 추천 토스트 (`.nunchi-toast`)
하단 slide-up 600px | `--color-nunchi-bg` + `--color-nunchi-border` + `--semantic-info` 아이콘 | 8초 dismiss

### 5.8 확인 모달 (`.confirm-modal`)
센터 560px, `--color-bg-card` + `--shadow-lg` | 딤: `--color-bg-overlay`

### 5.9 카테고리 탭 (`.category-tabs`)
수평 스크롤 64px | 선택: `--color-btn-primary` + `--color-text-inverse`

### 5.10 CTA 버튼 (`.btn-cta`)
Primary: `--color-btn-primary` + `--color-text-inverse` | Secondary: 투명 + `--primary-500` 보더 | Disabled: `--color-btn-disabled`

### 5.11 기타
- `.fade-up`: 200ms 순차 등장
- `.btn-home`: 좌하단 60px, `--glass-bg`
- `.btn-back`: 홈 옆, 동일 스타일

---

## 6. 상태 관리

### 6.1 AppState (localStorage)

| 키 | 타입 | 설명 |
|---|---|---|
| `sessionId` | string | 서버 세션 ID |
| `mode` | string | `normal` / `avatar` |
| `currentStep` | string | 현재 페이지 ID |
| `dineOption` | string | `dine_in` / `take_out` |
| `cart` | array | `[{ menuId, menuName, quantity, selectedOptions, unitPrice, totalPrice }]` |
| `cartTotal` | number | 총액 |
| `chatEnabled` | boolean | AI 채팅 활성화 |
| `chatHistory` | array | `[{ role, text, timestamp }]` |
| `avatarState` | string | `idle`/`talking`/`thinking`/`happy` |
| `avatarStep` | string | `기`/`승`/`전`/`결` |
| `orderSummary` | object | `{ orderId, items, totalPrice }` |
| `paymentMethod` | string | `ic_card` / `vein` |
| `paymentStatus` | string | `pending`/`success`/`fail` |
| `orderNumber` | string | 주문번호 |

### 6.2 눈치 엔진 상태 (메모리 전용)

| 키 | 설명 |
|---|---|
| `stayTime` | 카테고리/메뉴 체류 시간(초) |
| `repeatCount` | 동일 영역 반복 횟수 |
| `confidence` | 음성 인식 신뢰도 (0~1) |
| `hesitationScore` | 종합 망설임 점수 (0~100) |
| `lastRecommendAt` | 마지막 추천 시각 |
| `isRecommending` | 추천 팝업 표시 중 |

---

## 7. 화면별 상세 설계

---

### S00 — 시작화면 (`index.html`)

**요구사항**: 0-1

- 배경: `--color-bg-page` + Primary 블롭
- 로고 → 타이틀 "오늘 뭐 먹지? 고민은 눈치에게 맡기세요!" (`--font-title` 42px) → 서브 (`--color-text-secondary`) → 광고 배너(선택) → CTA "주문 시작하기" (`--color-btn-primary`, 100px)
- 어트랙션: 30초 → 대기 모드
- 진입: `AppState.reset()` + 세션 생성

---

### S01 — 모드 선택 (`S01-mode.html`)

**요구사항**: 0-3, 0-4

- 타이틀: "주문 방식을 선택해주세요" → 서브 → Liquid Glass 카드 2개
- **일반 주문**: `xi-touch`, `--primary-200/100` 블롭, `--primary-500` 보더, "메뉴를 직접 골라 주문해요."
- **AI 대화**: `xi-microphone`, `--secondary-100/primary-100` 블롭, `--secondary-500` 보더, "캐릭터와 대화하며 주문해요."
- `normal` / `avatar` 모두 → S02 (매장/포장) → 이후 mode 에 따라 N02 / A01 분기

---

### S02 — 매장/포장 (`S02-dine.html`, 공용 진입)

**요구사항**: 1-1
> N01 에서 S02 로 승격: 매장/포장은 두 모드 공통 속성이므로 공용 진입 플로우에 배치.

- "어디서 드실 건가요?" + 2개 카드(280x480, S01 동일 구조): 매장 / 포장
- xi-restaurant (매장) / xi-package (포장) 아이콘
- 하단 원형 화살표 버튼 (S01 동일)
- 선택 → sessionStorage('dineOption') 저장 → mode 에 따라 N02 또는 A01 분기

---

### N02 — 메뉴 목록 (`flowN/N02-menu.html`)

**요구사항**: 1-2, 2-1, 5-2

- 헤더(180px): 타이틀 + 뱃지(`--primary-100` bg, `--primary-700` text) + 카테고리 탭
- 3열 그리드 `.menu-card` + 장바구니 바 + AI FAB
- **눈치 엔진**: 카테고리 15초(+20), 3회 왕복(+30), 스크롤 반복(+15), 음성 불확실(+25), 30초 무조작(+40) → ≥60 → N05 팝업 (쿨다운 30초)

---

### N03 — 메뉴 상세 (`flowN/N03-detail.html`)

**요구사항**: 1-3, 1-4

- 이미지(480px) + 그라데이션 → 메뉴 카드(이름/설명/가격) → 옵션 그룹(`.option-chip`) → 수량 → "장바구니 담기"
- 담기 성공: `--semantic-success-bg` 토스트 → N02 복귀

---

### N04 — 장바구니 (`flowN/N04-cart.html`)

**요구사항**: 1-5

- 리스트(썸네일+이름+옵션+수량+소계+삭제) + 합계(`--color-text-price` 32px)
- "더 담기" (Secondary) + "주문하기" (Primary)

---

### N05 — 눈치 추천 팝업 (오버레이)

**요구사항**: 5-1~5-4

- 바텀시트(~60%): `--semantic-info` 아이콘 + "이런 메뉴는 어떠세요?" + 추천 사유 + 메뉴 카드
- [수락] → N03 / [거절] → dismiss + score 리셋
- 추천 소스: 실시간 판매 / 시간대별 / 카테고리 연관

---

### A01 — 아바타 대화 (`flowA/A01-avatar.html`)

**요구사항**: 3-1~3-5

- 배경: `--secondary-50` 틴트 + Primary 블롭
- 상단(40%): 아바타 360px (idle/talking/thinking/happy) + 말풍선
- 하단(60%): 대화 로그 + 메뉴 제안 카드 + 장바구니 미니
  - AI: `--color-bg-card` + `--primary-500` left-border
  - 사용자: `--primary-500` + `--color-text-inverse`
- 음성 인디케이터: 대기 → `--primary-300` 웨이브 → 로딩
- "일반 주문 전환" 링크

#### 기승전결

| 단계 | 목적 | 전환 조건 |
|---|---|---|
| **기** | 인사 + 매장/포장 | 확정 |
| **승** | 메뉴 추천/선택 | 1개+ 담기 |
| **전** | 추가 주문 확인 | 완료 |
| **결** | 확인 → 결제 | 동의 → P01 |

명확한 주문 시 기→전/결 점프 가능

---

### P01 — 주문 요약

**요구사항**: 6-1 | 뱃지 + 리스트 + 합계(`--color-text-price` 36px) + "메뉴 수정"/"결제하기"

### P02 — 결제 수단 선택

**요구사항**: 6-2, 6-3 | 총액 42px + IC카드(`--primary-500` 보더) / 정맥(`--secondary-500` 보더)

### P03 — 정맥인증 스캔

**요구사항**: 6-3~6-5 | 손바닥 가이드 + `--secondary-500` 스캔라인 | 실패: `--semantic-error` + 1회 재시도 → IC폴백

### P04 — 결제 처리 중

**요구사항**: 6-6 | `--primary-500` 프로그레스 + "결제를 진행하고 있어요..." | 30초 타임아웃

### P05 — 주문 완료

**요구사항**: 6-6, 7-4 | 컨페티(`--primary-500/300/neutral-0`) + 체크(`--semantic-success`) + 주문번호(`--color-text-price` 64px) + 10초 → S00

### P06 — 결제 실패

**요구사항**: 6-6 | X(`--semantic-error`) + "다시 시도"/"주문 취소"

---

## 8. AI 보조 기능

### 8.1 채팅 패널 (요구사항 2-1, 2-1.1)
N02 FAB → 사이드 패널 400px → 텍스트/음성 → LLM → 응답

### 8.2 MCP UI 자동조작 (요구사항 2-3, 2-4, 8-1, 8-2)

| 조작 | 피드백 |
|---|---|
| 메뉴 강조 | `--color-nunchi-border` 펄스 2초 |
| 자동 클릭 | 리플 |
| 옵션 선택 | highlight + bounce |
| 장바구니 담기 | 바 bounce |

- **확인 모달 필수**: "AI가 [메뉴명]을 추가합니다. 괜찮으세요?"
- **터치 우선**: AI 조작 중 터치 → AI 중단

---

## 9. 음성 AI 파이프라인 (요구사항 4-1~4-6)

```
핀 마이크 → voice-pipeline.js → WebSocket → STT(≥95%) → 의도+개체 → MCP Tool → TTS → 아바타
```

| intent | MCP Tool | 예시 |
|---|---|---|
| `menu_recommend` | DB Tool | "추천해줘" |
| `menu_add` | UI Control | "된장찌개 담아줘" |
| `menu_remove` | UI Control | "그거 빼줘" |
| `order_confirm` | Payment | "이걸로 할게요" |
| `general_qa` | LLM 응답 | "칼로리?" |
| `dine_option` | UI Control | "포장이요" |
| `navigate` | UI Control | "장바구니 보여줘" |

STT 대응: Custom vocabulary + 유사 메뉴 확인 대화 + confidence < 0.7 재확인

---

## 10. 눈치 엔진 (요구사항 5-1~5-3)

```
[체류시간] + [탐색패턴] + [음성분석] → hesitationScore (0~100) → ≥60 + 쿨다운 → N05 팝업
```

| 소스 | 표시 |
|---|---|
| 실시간 판매 | "오늘 가장 많이 팔린 메뉴" |
| 시간대별 | "이 시간 인기 메뉴" |
| 카테고리 연관 | "한식 중 인기 메뉴" |

---

## 11. 전체 플로우

```
S00 시작 → S01 모드 선택 → S02 매장/포장
                                ├─ [일반] → N02 ←→ N03/N04/N05 → P01 → P02 → P03/P04 → P05/P06
                                └─ [아바타] → A01 (기→승→전→결) → P01 → P02 → P03/P04 → P05/P06
```

모드 전환(8-3): A01 → N02 (장바구니 유지)

---

## 12. 화면 목록

| ID | 화면명 | 파일 | 요구사항 |
|---|---|---|---|
| S00 | 시작화면 | `index.html` | 0-1 |
| S01 | 모드 선택 | `S01-mode.html` | 0-3, 0-4 |
| S02 | 매장/포장 (공용) | `S02-dine.html` | 1-1 |
| N02 | 메뉴 목록 | `flowN/N02-menu.html` | 1-2, 2-1, 5-2 |
| N03 | 메뉴 상세 | `flowN/N03-detail.html` | 1-3, 1-4 |
| N04 | 장바구니 | `flowN/N04-cart.html` | 1-5 |
| N05 | 눈치 추천 | `flowN/N05-recommend.html` | 5-1~5-4 |
| A01 | 아바타 대화 | `flowA/A01-avatar.html` | 3-1~3-5 |
| P01 | 주문 요약 | `flowP/P01-summary.html` | 6-1 |
| P02 | 결제 수단 | `flowP/P02-payment.html` | 6-2, 6-3 |
| P03 | 정맥인증 | `flowP/P03-vein.html` | 6-3~6-5 |
| P04 | 결제 처리 | `flowP/P04-processing.html` | 6-6 |
| P05 | 주문 완료 | `flowP/P05-complete.html` | 6-6, 7-4 |
| P06 | 결제 실패 | `flowP/P06-fail.html` | 6-6 |

---

## 13. 세션 관리 (요구사항 7-1~7-4)

- **생성**: S00 진입 시 서버 세션 발급
- **유지**: 모드/단계/장바구니 실시간 갱신
- **종료**: 결제 완료, 취소, 5분 타임아웃 → `AppState.reset()` → S00

---

## 14. 기술 고려사항

### 접근성
- 본문 최소 18px, 버튼 22px+, 터치 80px+
- `--neutral-800` on `--neutral-50` ≈ 12:1 (WCAG AA)
- Primary 텍스트 → `--primary-700`

### 비활동 타임아웃
- S00 30초: 어트랙션 | 전체 5분: 세션 리셋 | 메뉴 30초: 눈치 +40

### 병렬 안정성 (8-1~8-3)
- 터치 우선 | AI 조작 중 터치 → AI 중단 | 모드 전환 시 장바구니 보존

### 배포 (9-1~9-3)
- Docker + GitLab CI/CD + 헬스체크 API

---

## 15. 요구사항 매핑

| ID | 요구사항명 | 화면 | 컴포넌트 |
|---|---|---|---|
| 0-1 | 시작 화면 | S00 | 어트랙션, CTA |
| 0-2 | 언어 선택 | — | 한국어 단일 (추후) |
| 0-3 | 모드 선택 | S01 | Liquid Glass |
| 0-4 | 모드 분기 | S01→S02→N02/A01 | navigateTo |
| 1-1 | 매장/포장 선택 | S02 (공용) | 카드 선택 |
| 1-2~1-5 | 일반 UI 주문 | N02~N04 | 메뉴/옵션/장바구니 |
| 2-1~2-4 | AI 보조 주문 | N02 패널, 전체 | 채팅/MCP/모달 |
| 3-1~3-5 | 아바타 UI | A01 | 기승전결 FSM |
| 4-1~4-6 | 음성 파이프라인 | 전체 | voice-pipeline |
| 5-1~5-4 | 눈치 추천 | N02/N05 | nunchi-engine |
| 6-1~6-6 | 결제/완료 | P01~P06 | 결제 모듈 |
| 7-1~7-4 | 세션 관리 | 전체 | AppState |
| 8-1~8-3 | 병렬/안정성 | 전체 | 터치 우선 |
| 9-1~9-3 | 배포/운영 | 인프라 | Docker/CI |

---

*문서 버전: v2.0 | 최종 수정: 2026.04.15 | 기술 스택: HTML5 + CSS3 + jQuery 3.7.0 + Jinja2 + WebSocket | 디바이스: 720x1280px 세로형 키오스크*
