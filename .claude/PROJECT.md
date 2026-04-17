# NUNCHI KIOSK — 프로젝트 개요

## 프로젝트 정의
**NUNCHI (눈치) KIOSK**
LLM Agentic AI 기반 배리어프리 자율주문 키오스크
> 음성 AI와 MCP 프로토콜을 활용하여 AI 에이전트가 시스템을 자율 제어하는 차세대 키오스크

사용자가 자연어 대화만으로 메뉴 탐색 → 추천 → 담기 → 결제까지 완료할 수 있는 완전 자율 주문 시스템.

---

## 시스템 아키텍처 (5계층)

```
[Hardware Layer]       범용 스탠드형 키오스크 + 핀 마이크(PIN Microphone)
[Presentation Layer]   React 자체 설계 UI + AI 오버레이 + MCP UI Control
[MCP AI Agent Layer]   FastAPI — STT → LLM → MCP Tool Router → TTS + 세션 관리
[Backend + Data Layer] Spring Boot — 주문/메뉴 서비스 + MCP DB Tool + PostgreSQL
[Infrastructure]       Docker + AWS + Nginx
```

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| 프론트엔드 | React (자체 설계 UI) |
| AI 서버 | **FastAPI** (STT: Whisper v3, LLM: ChatGPT API, TTS: OpenAI TTS API) |
| 백엔드 | **Spring Boot 4.0.5** (Java 17, JPA, Security, MVC) |
| DB | PostgreSQL (운영), H2 (개발/테스트) |
| 프로토콜 | **MCP (Model Context Protocol)** |
| 배포 | Docker, AWS, Nginx |

---

## MCP 도구 정의 (3종)

| MCP Tool | 역할 |
|----------|------|
| `MCP DB Tool` | DB SQL 쿼리 실행 (메뉴 조회, 판매 데이터 추출 등) |
| `MCP UI Control Tool` | 키오스크 화면 원격 조작 (메뉴 강조, 클릭, 담기, 옵션 선택) |
| `MCP Payment Tool` | 결제 플로우 자동 제어 (IC카드, 정맥인증, 결제 실행) |

---

## 주문 모드 (2가지)

### 일반 UI 모드
- 터치 기반 주문 (기본)
- LLM 채팅 기능 선택적 활성화
- AI가 MCP로 화면 자동 조작 → **사용자 확인 모달** 필수
- AI 추천 팝업 제공 (X버튼으로 닫기 가능)

### 아바타 UI 모드
- 캐릭터 아바타와 음성 대화
- MCP 기능으로 주문 유도 → 포장/매장 확인 → 결제까지 AI 주도
- 첫 방문자 안내 및 자연스러운 대화 흐름

---

## 음성 AI 파이프라인 (6단계)

```
1. 음성 캐처    핀 마이크 → 음성 스트림 수신, 노이즈 필터링
2. STT 변환     Whisper v3 — 실시간 음성→텍스트
3. 의도 분류    LLM — 메뉴 추천 / 담기 / 주문 / 일반 질문 분류
4. 개체 추출    NER — 메뉴명, 수량, 옵션 등 추출
5. MCP 툴 선택  의도에 맞는 MCP Tool 자율 선택 및 체이닝 실행
6. TTS 응답     처리 결과를 자연어 음성 합성으로 안내
```

---

## '눈치' 기능 (핵심 차별점)

사용자가 도움을 요청하지 않아도 시스템이 먼저 망설임을 감지하고 추천 제공.

감지 신호:
- **체류 시간**: 특정 화면에 오래 머무름
- **반복 탐색**: 같은 메뉴를 여러 번 확인
- **음성 불확실성**: STT 신뢰도 낮음

→ 조건 충족 시 AI 메뉴 추천 자동 트리거

---

## AI 메뉴 추천 플로우

실시간 판매 데이터 기반 동적 추천:
```sql
SELECT m.menu_id, m.name, COUNT(oi.id) AS today_cnt
FROM order_items oi
JOIN menus m ON oi.menu_id = m.menu_id
JOIN orders o ON oi.order_id = o.order_id
WHERE DATE(o.created_at) = CURDATE()
GROUP BY m.menu_id
ORDER BY today_cnt DESC
LIMIT 5
```

---

## Spring Boot 서버의 역할 (백엔드 담당 범위)

Spring Boot는 다음을 담당:

1. **메뉴 관리** — 메뉴, 카테고리, 옵션, 가격, 이미지 CRUD
2. **주문 관리** — 주문 생성, 장바구니, 주문 상태 관리
3. **세션/기록 관리** — 주문 세션 생성/유지, 대화 기록 JSON 저장, 주문 완료 후 초기화
4. **결제 처리** — IC카드, 정맥인증, 결제 결과 처리, 영수증 발행
5. **MCP DB Tool 지원** — FastAPI AI 서버가 MCP를 통해 DB를 조회/조작할 수 있는 API 엔드포인트 제공
6. **MCP Payment Tool 지원** — AI가 결제 플로우를 제어할 수 있는 결제 API 엔드포인트 제공

---

## Spring ↔ FastAPI 통신 구조

```
React (Frontend)
    ↕ REST API
Spring Boot (Backend) ←→ PostgreSQL
    ↕ HTTP (MCP Tool 요청)
FastAPI (AI Server)
    ↕
STT / LLM / TTS / MCP Tool Router
```

FastAPI가 MCP Tool을 실행할 때 Spring Boot API를 호출:
- `MCP DB Tool` → Spring Boot의 DB 조회 API 호출
- `MCP Payment Tool` → Spring Boot의 결제 API 호출
- `MCP UI Control Tool` → React 프론트엔드 직접 WebSocket/SSE 통신

---

## 기능 요구사항 목록 (Feature ID 기준)

| ID | 분류 | 기능 |
|----|------|------|
| 0-1 ~ 0-4 | 시작/모드 | 시작화면, 언어선택, 모드선택, 모드 진입 |
| 1-1 ~ 1-5 | 일반 UI | 매장/포장 선택, 메뉴목록, 메뉴상세, 장바구니, 장바구니 수정 |
| 2-1 ~ 2-4 | AI 보조 주문 | LLM 채팅, 의도 분석, MCP 자동조작, AI 추천 확인 모달 |
| 3-1 ~ 3-5 | 아바타 UI | 대화 제공, 첫 인사, 음성 주문 유도, 메뉴선택, 주문 로직 |
| 4-1 ~ 4-6 | 음성 AI | 음성캐처, STT, 의도분류, 개체추출, MCP Tool 선택, TTS |
| 5-1 ~ 5-4 | 메뉴 추천 | 실시간 추천, 눈치 트리거, 추천 제시, 추천 처리 |
| 6-1 ~ 6-6 | 결제/완료 | 주문요약, IC카드, 정맥인증, 결제실행, 실패처리, 영수증 |
| 7-1 ~ 7-4 | 세션/기록 | 세션 생성, 대화저장, 주문저장, 세션 종료 초기화 |
| 8-1 ~ 8-3 | 안정성 | 터치 우선처리, 모드 일관성 |
| 9-1 ~ 9-3 | 배포/운영 | Docker, CI/CD, 모니터링 |

---

## 비기능 요구사항

- AI 응답 시간: **3초 이내**
- 음성 인식 정확도: **90% 이상**
- 터치 주문 + 음성 주문 병렬 동작 충돌 없음
- 세션 데이터 안정적 저장
- Docker 기반 배포

---

## 개발 일정 (3개월 MVP)

| Phase | 기간 | 내용 |
|-------|------|------|
| Phase 1 | W1~W3 | 기획/설계 |
| Phase 2 | W4~W8 | 핵심 개발 |
| Phase 3 | W9~W12 | 통합/테스트/발표 |