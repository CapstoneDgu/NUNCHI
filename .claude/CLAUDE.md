# CLAUDE.md — NUNCHI KIOSK Spring Boot 서버

## 필수 숙지 문서
이 프로젝트를 작업하기 전에 반드시 아래 두 문서를 읽을 것.

- `.claude/PROJECT.md` — 전체 아키텍처, MCP 도구 정의, Spring 서버 역할, FastAPI 통신 구조, 기능 요구사항 전체 목록
- `.claude/CONVENTION.md` — DTO / Entity / Service / Controller / 예외처리 / 네이밍 코딩 컨벤션

## 계획 규칙
사용자가 **"계획을 써서 보여줘"** 또는 **"계획 보여줘"** 라고 요청할 때만:
1. `CLAUDE_PLAN.md` 파일의 기존 내용을 모두 지우고
2. 구현 계획을 작성한 뒤
3. 사용자에게 파일을 확인하라고 안내한다.

## 보고 규칙
사용자가 **"문서로 보고해"** 라고 요청할 때만:
1. `CLAUDE_RESULT.md` 파일의 기존 내용을 모두 지우고
2. 새로운 내용으로 작성한 뒤
3. 사용자에게 파일을 확인하라고 안내한다.

"설명해", "알려줘" 등 일반 질문은 파일 작성 없이 채팅으로 답변한다.

---

## 프로젝트 컨텍스트

- **서버 역할**: NUNCHI KIOSK의 백엔드 (주문/메뉴/결제/세션 관리)
- **패키지**: `dgu.capstone.nunchi`
- **연동 대상**:
  - **FastAPI AI 서버** (MCP Tool 요청 수신, DB 조회/결제 API 제공)
  - **React 프론트엔드** (REST API 제공)
  - **PostgreSQL** (운영 DB)

---

## 기술 스택

- Java 17 / Spring Boot 4.0.5
- Spring Data JPA + PostgreSQL (운영), H2 (개발/테스트)
- Spring Security
- Spring MVC (REST API)
- Lombok
- Gradle

---

## FastAPI (MCP) 연동 원칙

Spring Boot는 FastAPI AI 서버가 MCP Tool을 실행할 때 호출하는 API를 제공한다.

### MCP DB Tool 지원
- FastAPI가 메뉴 조회, 판매 데이터, 재고 등을 조회할 수 있는 REST API 엔드포인트 제공
- 예: `GET /api/mcp/menus`, `GET /api/mcp/sales/today`
- MCP 전용 엔드포인트는 `/api/mcp/**` 경로로 분리 관리

### MCP Payment Tool 지원
- FastAPI가 결제 플로우를 제어할 수 있는 결제 API 제공
- 예: `POST /api/mcp/payment/request`, `POST /api/mcp/payment/confirm`

### 통신 방식
- Spring Boot ↔ FastAPI: HTTP REST
- FastAPI가 클라이언트 역할로 Spring Boot를 호출하는 구조
- 인증: 서버 간 통신이므로 내부 API Key 또는 별도 인증 방식 사용

---

## 레이어드 아키텍처

```
Controller (REST API)
    ↓
Service (비즈니스 로직)
    ↓
Repository (JPA)
    ↓
Entity (DB)
```

패키지 구조 예시:
```
dgu.capstone.nunchi
├── domain
│   ├── menu        (메뉴/카테고리/옵션)
│   ├── order       (주문/장바구니)
│   ├── payment     (결제)
│   └── session     (세션/기록)
├── mcp             (MCP Tool 지원 API)
├── global          (공통 설정, 예외처리, 응답 포맷)
└── NunchiApplication.java
```

---

## 코딩 규칙

### 공통
- 언어: 한국어로 소통, 코드 주석도 한국어
- Lombok 적극 활용 (`@Getter`, `@Builder`, `@RequiredArgsConstructor` 등)
- JPA Entity: `@NoArgsConstructor(access = AccessLevel.PROTECTED)` + `@Builder`
- REST API 응답: 공통 응답 포맷 (`ApiResponse<T>`) 사용
- 예외처리: `@ControllerAdvice` 전역 예외 핸들러 사용

### API 설계
- REST 원칙 준수
- MCP 전용 엔드포인트: `/api/mcp/**`
- 일반 클라이언트 엔드포인트: `/api/**`
- 응답 코드 명확히 구분 (200, 201, 400, 401, 404, 500)

### 보안
- Spring Security 설정 시 MCP 내부 API와 일반 API 보안 정책 분리
- 민감한 결제 정보는 절대 로그에 남기지 않을 것

---

## Spring 서버 개발 시 주의사항

1. **MCP 우선 설계**: 어떤 기능을 만들든 "FastAPI AI 서버가 이 API를 MCP Tool로 호출할 수 있는가?"를 항상 고려
2. **병렬 동작 고려**: 터치 주문과 음성(AI) 주문이 동시에 들어올 수 있으므로 동시성 처리 주의
3. **세션 관리**: 주문 세션은 주문 완료 또는 타임아웃 시 반드시 초기화
4. **눈치 기능 지원**: 체류시간, 반복탐색 등 프론트에서 수집한 행동 데이터를 저장/제공하는 API 필요
5. **AI 응답 시간 3초 이내**: DB 쿼리 최적화, N+1 방지 필수

---

## 에이전트(Agent) 활용 전략

작업 속도와 능률을 높이기 위해 Claude Code의 에이전트를 적극 활용한다.

### 언제 에이전트를 쓸 것인가

| 상황 | 활용 방법 |
|------|-----------|
| 도메인이 독립적인 여러 기능을 동시에 개발할 때 | 각 도메인(menu, order, payment 등)을 **병렬 에이전트**로 분리하여 동시 작업 |
| 코드베이스 탐색이 필요한 조사 작업 | `Explore` 에이전트로 위임하여 메인 컨텍스트 절약 |
| 구현 전 설계/아키텍처 검토 | `Plan` 에이전트로 구조 먼저 설계 후 구현 착수 |
| 테스트 코드 작성 | 기능 구현 에이전트와 테스트 작성 에이전트를 병렬로 실행 |

### 병렬 에이전트 예시

도메인 레이어 구현 시 아래처럼 동시에 분리:
```
에이전트 A: menu 도메인 (Entity + Repository + Service + Controller)
에이전트 B: order 도메인 (Entity + Repository + Service + Controller)
에이전트 C: payment 도메인 (Entity + Repository + Service + Controller)
```
→ 각 도메인이 독립적이면 병렬 실행으로 개발 시간 대폭 단축

### 에이전트 사용 원칙
- 작업 간 **의존성이 없을 때**만 병렬 실행 (예: order가 menu를 참조하면 menu 먼저 완료 후 order 착수)
- 에이전트에게 작업을 위임할 때는 **파일 경로, 패키지명, 구현 범위**를 명확히 지정
- 에이전트 결과는 메인에서 반드시 검토 후 통합