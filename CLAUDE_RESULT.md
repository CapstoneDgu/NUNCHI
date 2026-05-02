# A01 아바타 모드 — TTS/STT + 백엔드 API 연결 작업 결과

**브랜치**: `feat/#45/avata-api-conecting`
**작업 일자**: 2026-04-30
**범위**: 턴테이킹 대화 엔진 + Spring REST 전 흐름(세션·메뉴·카트·주문·결제) 연결

---

## 1. 구현 요약

| 구분 | 파일 | 변경 내용 |
|---|---|---|
| 신규 | `src/main/resources/static/front/js/common/api-client.js` | `window.NunchiApi` — Sessions / Menus / Cart / Orders / Payments / Recommendations 그룹. ApiResponse 언래핑 + NunchiApiError 던지기. |
| 신규 | `src/main/resources/static/front/js/flowA/intent-matcher.js` | `window.IntentMatcher` — 발화→`MenuFilterRequest` 매핑(매콤/시원/비건/저칼로리/저염/단백질/가격/알레르기). 추천/네비게이션 의도도 분류. |
| 신규 | `src/main/resources/static/front/js/flowA/conversation-engine.js` | `window.ConvEngine` — 턴테이킹 엔진. `INACTIVE / AI_SPEAKING / LISTENING / THINKING` 상태머신, 자동 재청취, 3초 침묵 되물음, 바지인. |
| 수정 | `src/main/resources/static/front/js/flowA/A01-avatar.js` | 전면 개편: backend 세션 생성, 메뉴 prefetch, 메시지/툴 로깅, 의도→필터 호출, Redis 카트 동기화, 주문 확정. mock(`window.MenuData`) 의존 제거. |
| 수정 | `src/main/resources/templates_front/flowA/A01-avatar.html` | `api-client.js`, `intent-matcher.js`, `conversation-engine.js` 로드. 사용 안 하는 `menu-data.js` 제거. |
| 수정 | `src/main/resources/static/front/css/flowA/A01-avatar.css` | `.a01__btn-mic--ai-turn`(파랑 펄스, 끼어들기 가능 안내), `.a01__btn-mic--inactive`(호흡 애니메이션) 추가. |
| 수정 | `src/main/resources/static/front/js/flowP/P02-payment.js` | CTA 클릭 시 `POST /api/payments` 호출, `paymentId` 보관. orderId 없으면 안전하게 fallback. |
| 수정 | `src/main/resources/static/front/js/flowP/P04-processing.js` | `approved` 상태 진입 시 `PATCH /api/payments/{id}/success`. |
| 수정 | `src/main/resources/static/front/js/flowP/P05-complete.js` | 부트 시 `PATCH /api/sessions/{id}/complete`. 정리 키에 `orderId/paymentId` 추가. |
| 수정 | `src/main/resources/static/front/js/flowP/P06-fail.js` | 부트 시 `PATCH /api/payments/{id}/fail`. 정리 키 보강. |
| 수정 | `templates_front/flowP/P02|P04|P05|P06-*.html` | `api-client.js` 스크립트 태그 추가. |

신규 라인 합계: **약 1,400줄** (api-client 200, intent-matcher 175, conversation-engine 280, A01-avatar 약 600 재작성). 변경 P-flow JS는 항목당 5~20줄 추가.

---

## 2. 턴테이킹 엔진 동작 상세

```
                ┌──────────┐  마이크 클릭(activate)   ┌───────────────┐
   page load → │ INACTIVE │ ───────────────────────▶ │ AI_SPEAKING   │
                └──────────┘                          └───────────────┘
                     ▲                                    │  typewriter 종료
                     │ 마이크 클릭(stop)                    │  + endTurn()
                     │                                    ▼
                ┌──────────┐  3초 침묵·되물음(루프)     ┌───────────────┐
                │ LISTENING│ ◀─────────────────────── │  AI_SPEAKING  │
                └──────────┘                          └───────────────┘
                     │  final 결과               ▲ barge-in (interim)
                     ▼                           │
                ┌──────────┐  핸들러 응답 say() ──┘
                │ THINKING │
                └──────────┘
```

### 핵심 동작

- **자동 재청취**: AI 발화가 끝나면 호스트가 `ConvEngine.endTurn()` 호출 → `LISTENING` 진입 → `recognition.start()`. Chrome `continuous=true`라도 ~1분 후 `onend`가 트리거되므로 wantsRunning 플래그로 자동 재시작.
- **바지인**: `recognition.onresult`에서 interim 결과를 감지하면 `state.mode === AI_SPEAKING` 일 때 `currentSpeakAbort.abort()` + 호스트의 `onBargeIn()` 콜백(state.speechAbort까지 abort)을 호출하여 typewriter 즉시 컷.
- **3초 침묵 되물음**: `setInterval(200ms)`가 LISTENING 모드에서 `Date.now() - lastInterimAt > 3000` 체크 → 호스트의 `onSilencePrompt()` 콜백으로 FSM 상태별 멘트 받아 `say()` 후 `endTurn()`.
- **마이크 버튼 의미 전환**:
  - INACTIVE → 오렌지 호흡(시작 유도)
  - AI_SPEAKING → 파랑 펄스(끼어들기 가능)
  - LISTENING → 빨강 ripple(듣는 중)
  - 클릭 시: INACTIVE → start, 그 외 → stop.
- **텍스트 폴백**: `ConvEngine.submitText(text)`로 음성 경로와 동일한 `onUserUtterance`를 통해 처리. Web Speech 미지원/권한 거부 시 자동 활용.

### 신호(Signal) 책임 분리

aiSpeak는 호출자가 전달한 단일 signal만 존중한다(이전 합성 방식의 잠재 결함 제거):
- 부트: `bootAbort.signal`
- run* (FSM 단계 함수): `state.speechAbort.signal` (enterState가 매 단계마다 새로 만듦)
- ConvEngine.say 경유: 엔진의 `currentSpeakAbort.signal`

bargein 시 onConvBargeIn은 `state.speechAbort.abort()`를 호출하여 직접 경로(run*)를 끊고, 엔진은 자체적으로 `currentSpeakAbort.abort()`로 ConvEngine.say 경로를 끊는다.

---

## 3. API 매핑 표 — 사용자 의도 → Spring 호출

| 사용자 발화 예시 | 매처 결과 | Spring 호출 | 필드 / 페이로드 |
|---|---|---|---|
| "매콤한 메뉴 추천해주세요" | `matchFilter` → `{ minSpicyLevel: 3 }` | `GET /api/menus/filter` | `?minSpicyLevel=3&limit=5` |
| "안 매운 거 비건으로 가벼운 거" | `matchFilter` → `{ maxSpicyLevel:1, vegetarianType:VEGAN, maxCalorie:500 }` | `GET /api/menus/filter` | 위 3개 합쳐서 |
| "5천원 이하 시원한 거" | `matchFilter` → `{ maxPrice: 5000, temperatureType: COLD }` | `GET /api/menus/filter` | `?maxPrice=5000&temperatureType=COLD` |
| "우유 빼고" | `matchFilter` → `{ excludeAllergies: "MILK" }` | `GET /api/menus/filter` | `?excludeAllergies=MILK` |
| "인기 메뉴" | `matchRecommend` → `POPULAR` | `GET /api/recommendations?type=POPULAR` | — |
| "추천해줘" | `matchRecommend` → `DEFAULT` | `GET /api/recommendations?type=DEFAULT` | — |
| "매장에서요" / "포장이요" | `matchNavigation` → `dine_in/take_out` | (sessionStorage `dineOption`) | API 호출 없음, FSM 전환 |
| "결제할게요" (cart 비어있음) | `matchNavigation` → `payment` | — | `confirm.empty` 발화 |
| "결제할게요" (confirm 단계) | `matchNavigation` → `payment` | `POST /api/orders/confirm` | `{ sessionId }` → `orderId` 수령 |
| 메뉴카드 "담기" 클릭 | (UI 직접) | `POST /api/orders/cart/items` | `{ sessionId, menuId, quantity:1, optionIds:[] }` |
| 모든 USER/ASSISTANT 발화 | (자동) | `POST /api/sessions/{id}/messages` | `{ role, text }` (fire-and-forget) |
| 필터·추천 호출 | (자동) | `POST /api/sessions/{id}/tool-logs` | `{ toolName: "menu.filter", request, response }` |
| 정상 모드 전환 / P05 | — | `PATCH /api/sessions/{id}/complete` | — |
| P02 "다음" | — | `POST /api/payments` | `{ orderId, method: "IC_CARD"|"VEIN_AUTH" }` |
| P04 결제 승인 | — | `PATCH /api/payments/{id}/success` | — |
| P06 진입 | — | `PATCH /api/payments/{id}/fail` | — |

---

## 4. 검증 결과

### 4-1. 정적 검증 (자동 완료)

| 항목 | 도구 | 결과 |
|---|---|---|
| 신규/수정 JS 8개 구문 검사 | `node --check` | **통과** — `api-client.js`, `intent-matcher.js`, `conversation-engine.js`, `A01-avatar.js`, `P02-payment.js`, `P04-processing.js`, `P05-complete.js`, `P06-fail.js` 전부 OK |
| 백엔드 DTO 필드와 프론트 페이로드 일치 | 수동 cross-check | **통과** — `SessionCreateRequest`, `ConversationMessageSaveRequest(role: MessageRole)`, `CartItemAddRequest`, `OrderCreateRequest({sessionId})`, `PaymentCreateRequest({orderId, method})`, `MenuFilterRequest` enum 값(HOT/COLD/BOTH, VEGAN/VEGETARIAN/NONE) 모두 정확 |
| 응답 래퍼 처리 | 코드 리뷰 | **통과** — `ApiResponse.code !== 200` 시 `NunchiApiError` 던지고, 호출부는 `callApi` 래퍼로 토스트 |
| Web Speech API 폴백 | 코드 리뷰 | **통과** — `ConvEngine.isSupported()` false 시 텍스트 입력 자동 활성, `submitText` 동일 경로로 처리 |
| 신호(signal) 라이프사이클 | 시나리오 트레이싱 | **통과** — 바지인 후 다음 응답 typewriter가 즉시 컷되는 잠재 결함 발견 → 합성 신호 제거하고 호출자 책임으로 단순화 |

### 4-2. E2E 검증 (사용자 수동 권장)

로컬 환경(`./gradlew bootRun --args='--spring.profiles.active=local'` + Postgres + Redis) 기동 후 `http://localhost:8080/flowA/A01-avatar.html` 진입:

| # | 시나리오 | 기대 동작 | 확인 방법 |
|---|---|---|---|
| 1 | 페이지 진입 | `POST /api/sessions {mode:"AVATAR"}` 200 → sessionStorage `aiSessionId` 채워짐 + 인사말 typewriter | DevTools Network |
| 2 | 메뉴 prefetch | `GET /api/menus/categories`, `/api/menus/top`, `/api/menus?categoryId=` 200 | DevTools Network |
| 3 | 마이크 클릭 (첫 클릭) | 권한 프롬프트 → AI가 askDine 발화 → 자동으로 빨강 ripple LISTENING | UI + 콘솔 |
| 4 | "매장에서요" 발화 | `dineOption=dine_in` 설정 → confirmedDineIn 발화 → recommend 단계 + 추천 카드 1개 | UI |
| 5 | "매콤한 거 추천해줘" | `GET /api/menus/filter?minSpicyLevel=3&limit=5` + tool-log 저장 → "매콤한 메뉴 N개 찾았어요" + 카드 3개 | DevTools Network + 카드 |
| 6 | 카드 "담기" | `POST /api/orders/cart/items` 200 → 미니카트 갱신 (서버 응답의 `itemTotal`/`totalAmount` 기반) | DevTools Network + 미니카트 |
| 7 | 바지인 | AI가 typewriter 중일 때 사용자가 말하기 시작 → 즉시 컷 + LISTENING 전환 | UI |
| 8 | 침묵 3초 | 발화 없이 가만히 있음 → ~3초 후 FSM 상태별 되물음 발화 | UI |
| 9 | "결제할게요" | confirm 단계 도달 후 결제 발화 → `POST /api/orders/confirm` 200 → `orderId` 보관 → P01 이동 | sessionStorage + Network |
| 10 | P01 → P02 → 결제수단 선택 | "다음" 클릭 시 `POST /api/payments {orderId, method:"IC_CARD"}` 200 → `paymentId` 보관 | DevTools Network |
| 11 | P04 승인 | `PATCH /api/payments/{id}/success` 200 → P05 이동 | DevTools Network |
| 12 | P05 진입 | `PATCH /api/sessions/{id}/complete` 200 → 60초 카운트다운 | DevTools Network |
| 13 | 실패 케이스 (P04 ?result=declined) | P06 진입 → `PATCH /api/payments/{id}/fail` 200 | DevTools Network |
| 14 | "정상 모드로 변경" 클릭 | `PATCH /api/sessions/{id}/complete` 200 → N02 이동 | DevTools Network |
| 15 | 검증 실패(빈 발화·미인식) | 토스트 표시 + 콘솔에 `NunchiApiError` 객체 | 콘솔 |

> ⚠️ E2E 자동 실행은 본 작업에서 수행하지 않음(브라우저 권한·Postgres·Redis 의존). 위 표대로 사용자가 직접 한 번 돌려보고 통과 여부를 채워 넣으면 됩니다.

---

## 5. 알려진 한계

1. **옵션 그룹 미구현** — `MenuDetailResponse.optionGroups`는 받지만 카드 "담기"는 옵션 없는 메뉴를 가정. 옵션 필수 메뉴는 잘못된 결제로 이어질 수 있음 → 옵션 모달이 다음 작업.
2. **알레르기 enum 매핑** — `intent-matcher.js`의 `ALLERGY_MAP`은 백엔드 `AllergyType` enum과 상수명을 추정한 것. 백엔드 enum 정확한 이름이 다르면 필터 호출 시 검증 실패. 동기화 필요.
3. **Redis TTL 30분** — `OrderService`의 카트 TTL을 초과하면 다음 발화 시 빈 카트가 될 수 있음. 사용자에게 만료 안내가 없음.
4. **FastAPI 미연동** — 자유 발화 의도 분류는 키워드 매칭으로만. "오늘 날씨 어때" 같은 ooD는 fallback("다시 한번 말씀해주세요")로 처리.
5. **Chrome 외 STT 품질** — Edge는 OK, Firefox/Safari iOS는 SpeechRecognition 지원이 없어 텍스트 폴백만 동작.
6. **마이크 첫 클릭 타이밍** — 부트 인사 typewriter 중에 클릭 시 `state.greetedOnBoot`가 false 상태라면 enterState의 runOpening이 인사를 한 번 더 함. (`bootAbort.signal.aborted`로 중단 처리되지만 false 상태로 갈 수 있는 짧은 윈도우 존재.)
7. **결제 method 매핑** — P02의 sessionStorage `paymentMethod`는 'ic'/'vein'(P-flow 호환), 백엔드 enum은 'IC_CARD'/'VEIN_AUTH'. 매핑은 P02에서 1회. 다른 진입점에서 동일 처리 필요 시 헬퍼 추출 권장.

---

## 6. 다음 단계 제안

| 우선순위 | 작업 | 예상 영향 |
|---|---|---|
| 높음 | 옵션 그룹 모달 + `optionIds` 전달 | 카드 "담기" 정확도 |
| 높음 | 알레르기 enum 동기화(백엔드 실제 값 확인) | 알레르기 필터 신뢰성 |
| 중간 | FastAPI WebSocket STT/TTS (A01 문서 Phase 2) | 자유 발화·다국어 |
| 중간 | `paymentMethod` 매핑 헬퍼 추출 | 코드 일관성 |
| 낮음 | 세션 만료 스케줄러(Spring `@Scheduled`) | 운영 안정성 |
| 낮음 | bargein 사운드 큐(beep) | UX |

---

**참고 계획 파일**: `C:\Users\NEXV\.claude\plans\glittery-brewing-sketch.md`
**필수 숙지 문서**: `.claude/PROJECT.md`, `.claude/CONVENTION.md`, `docs/A01_아바타_구현계획.md`
