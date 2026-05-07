# API 연결 작업 — 진행 현황 (회고)

> **2026-05-07 갱신**: 본 문서는 PR #77 (`feat/#77/connect-api`) 의 작업 회고이다.
> dev 의 #72(N02-menu) / #76(flowP 결제) / #79(admin 엑셀) 가 거의 같은 시점에 같은 영역을 머지하면서, 본 PR 의 P 화면·S02·api.js 변경은 **중복으로 폐기**되었다. 살아남은 것은 향후 작업의 토대가 되는 **docs 2개 + TDD 헬퍼 1개** 다.

## 1. 최종 보존 결과물

| 파일 | 용도 |
|---|---|
| `docs/향후_작업_로드맵.md` | 다음 작업(STT/TTS OpenAI 도입 + UI 점진 개선) spec |
| `docs/API연결_진행현황.md` (이 파일) | 회고 |
| `src/main/resources/static/front/js/flowA/reply-keywords.js` | A flow 의 FastAPI reply 후처리용 키워드 매칭 헬퍼 (UMD) |
| `tests/reply-keywords.test.js` | 위 헬퍼의 단위 테스트 16 케이스 (Node 기본 test runner) |
| `package.json` | `npm test` 스크립트 (테스트 인프라) |

## 2. 폐기된 작업 (중복으로 사라진 영역)

다음 항목들은 dev 의 #72 / #76 머지로 별도 인터페이스로 이미 들어와 있어 본 PR 의 변경을 폐기했다. dev 의 정책이 정답.

- S02 `Sessions.create` 호출 — dev 가 더 정교한 흐름 (`SESSION_ID_KEY = 'sessionId'` 단일 키)
- P01-summary 백엔드 카트 동기화 — dev 가 거의 동일한 패턴 + `getSessionId()` 표준화
- P03-vein 결제 마킹 — dev 가 더 정교한 `finalizePaymentThenGoComplete` 흐름 (confirm → payment.create → markSuccess 한 번에)
- P05-complete 의 `Sessions.complete` 키 정정 — dev 가 단일 `sessionId` 키로 처리
- P06-fail 의 키 정리 — dev 의 `FLOW_KEYS_TO_CLEAR` 에 `SESSION_ID_KEY` 단일
- common/api.js — dev 의 #79 가 별도 인터페이스(`window.Api.session/menu/cart/...`) 로 작성. 우리 IIFE(`NunchiApi.Sessions/...`) 는 폐기
- common/api-client.js → api.js 리네임 — dev 가 별도로 api.js 추가, api-client.js 도 살아있는 상태라 리네임 의미 사라짐
- common/partials-loader.js → partials.js 리네임 — dev 와 충돌, 폐기
- flowA/intent-matcher.js 제거 — dev 가 보존 중, 정책 충돌
- flowA/A01-avatar.js 의 FastAPI 위임 + reply 후처리 — dev 의 인터페이스(`window.Api.*`) 와 다른 IIFE(`window.NunchiApi.*`)에 의존했고, 향후 STT/TTS 작업 시 dev 인터페이스에 맞춰 다시 작성 예정

## 3. dev 의 현재 정책 (재개 시 참고)

PR #76 머지 후의 dev 정책:

| 항목 | dev 정책 |
|---|---|
| 세션 키 | `sessionStorage.sessionId` 단일 키 (Spring 세션 ID) |
| API 클라이언트 | `window.Api.{session,menu,cart,order,payment,recommend}` (#79) |
| 디버그 토글 | `window.__NUNCHI_API_DEBUG__` |
| 결제 흐름 | P03(정맥)·P04(IC) 의 성공 분기에서 `finalizePaymentThenGoComplete` — confirm → payment.create → markSuccess 를 가드와 함께 한 번에 |
| 카트 흐름 | P01 진입 시 `Cart.get(sessionId)` → 응답이 진실의 원천. 수량 변경/삭제도 모두 백엔드 호출 |
| 세션 시작 | (dev 의 N02 / S02 흐름 참고) |

## 4. 살아남은 것의 향후 활용

- **`reply-keywords.js`**: A flow FastAPI 통합 시 reply 의 카트/완료 키워드 감지에 그대로 사용 가능. CART_PATTERN(`담았어요|비웠어요|장바구니|담아드렸어요`), COMPLETE_PATTERN(`결제가 완료|세션이 종료`) 정규식 + UMD 패턴이라 브라우저/Node 양쪽 import 가능. 16 케이스 단위 테스트 통과 상태.
- **`docs/향후_작업_로드맵.md`**: STT/TTS OpenAI 도입의 상세 spec + UI 점진 개선 메모. 다음 작업의 출발점.
- **`package.json` + `tests/`**: Node 기본 test runner 인프라. 새 헬퍼 추가 시 같은 패턴으로 단위 테스트 작성 가능.

## 5. 본 작업에서 발견한 외부 의존성 이슈 (인계)

다음 두 이슈는 본 PR 작업 중 발견됐고, 향후 STT/TTS 작업을 포함한 모든 A flow 검증의 선행 조건이다:

### 5-1. FastAPI CORS 차단
- 증상: 브라우저에서 `POST http://43.201.20.11:8000/api/order/start` → preflight 실패. `No 'Access-Control-Allow-Origin' header`.
- 조치 (FastAPI 담당):
  ```python
  from fastapi.middleware.cors import CORSMiddleware
  app.add_middleware(
      CORSMiddleware,
      allow_origins=["http://localhost:8080", "http://127.0.0.1:8080"],
      allow_credentials=True,
      allow_methods=["POST", "GET", "OPTIONS"],
      allow_headers=["Content-Type", "Accept"],
  )
  ```
- 검증: `curl -i -X OPTIONS http://43.201.20.11:8000/api/order/start -H "Origin: http://localhost:8080" -H "Access-Control-Request-Method: POST"` 응답에 `Access-Control-Allow-Origin` 헤더 보이면 OK.

### 5-2. Postgres 비밀번호 / `.env` 변수 키 정합성
- 작업 중 `.env` 의 `POSTGRES_PASSWORD=nunchi1234` 가 실제 컨테이너의 `0218` 과 불일치 발견. 정정 완료.
- `.env` 에 `DEV_DB_*`, `DEV_FASTAPI_URL`, `ECR_IMAGE` 가 없어서 docker-compose 가 못 찾던 문제도 보강 (`.env` 자체는 .gitignore 됨, 팀 내 `.env.example` 의 키 정합성도 함께 정리 권장).

### 5-3. Dockerfile ENTRYPOINT 의 hardcoded profile
- `ENTRYPOINT ["java", "-jar", "/app/app.jar", "--spring.profiles.active=dev"]` 가 SPRING_PROFILES_ACTIVE 환경변수를 무시함.
- 권장: `--spring.profiles.active=dev` 제거하여 환경변수로 교체 가능하게.

## 6. 한 줄 회고

**P/S02/api.js 영역은 dev 의 #72·#76·#79 가 같은 시점에 더 완성도 높게 머지**.
**본 PR 은 회고 + STT/TTS 로드맵 + TDD 헬퍼 한 개를 남기는 것으로 가치를 좁힘**.
**다음은 STT/TTS 작업 (`docs/향후_작업_로드맵.md` §2 참고)**.
