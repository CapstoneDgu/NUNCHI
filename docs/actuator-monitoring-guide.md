# NUNCHI 운영 확인용 Actuator 모니터링 기준

## 1. 목적

배포 서버에서 Spring 서버 상태, DB/Redis 연결 상태, 주요 API 응답 시간을 최소한으로 확인하기 위한 운영 점검 기준을 정리한다.

현재 NUNCHI 서버는 다음 방식으로 성능과 병목을 확인한다.

- Spring Actuator metric
- Spring `[AI_CALL]` 로그
- FastAPI `[AI_STEP]` 로그
- MCP `[MCP_TOOL]` 로그

본 문서는 배포 서버 운영 중 장애 또는 지연 발생 시 어떤 순서로 확인할지 정의한다.

---

## 2. 유지할 Actuator Endpoint

운영 확인용으로 다음 endpoint를 유지한다.

```text
/actuator/health
/actuator/metrics
/actuator/metrics/http.server.requests
```

각 endpoint의 역할은 다음과 같다.

| Endpoint | 역할 |
|---|---|
| `/actuator/health` | Spring 서버, DB, Redis 상태 확인 |
| `/actuator/metrics` | 수집 가능한 metric 목록 확인 |
| `/actuator/metrics/http.server.requests` | HTTP API 요청 수, 응답 시간 확인 |

---

## 3. Actuator 설정 기준

배포 서버용 설정 파일에는 다음 설정을 유지한다.

```yaml
management:
  endpoints:
    web:
      exposure:
        include: health,info,metrics
  endpoint:
    health:
      show-details: always
  metrics:
    tags:
      application: nunchi-spring
```

주의사항:

- `include: "*"` 방식으로 전체 Actuator endpoint를 공개하지 않는다.
- 운영 확인에 필요한 `health`, `info`, `metrics`만 노출한다.
- 실제 운영 환경에서는 외부 공개 범위를 제한하는 것이 좋다.

---

## 4. 운영 확인용 명령어

### Spring 서버 상태 확인

```bash
curl http://localhost:8080/actuator/health
```

정상 예시:

```json
{
  "status": "UP"
}
```

DB/Redis 상세 상태가 노출되는 경우 다음 항목을 확인한다.

```text
db: UP
redis: UP
```

### Metric 목록 확인

```bash
curl http://localhost:8080/actuator/metrics
```

### 전체 HTTP 요청 Metric 확인

```bash
curl "http://localhost:8080/actuator/metrics/http.server.requests"
```

### AI 주문 Chat API 응답 시간 확인

```bash
curl "http://localhost:8080/actuator/metrics/http.server.requests?tag=uri:/api/ai/order/chat"
```

### 메뉴 API 응답 시간 확인

```bash
curl "http://localhost:8080/actuator/metrics/http.server.requests?tag=uri:/api/menus"
```

---

## 5. Metric 해석 기준

`http.server.requests`의 주요 값은 다음과 같다.

| 항목 | 의미 |
|---|---|
| `COUNT` | 요청 횟수 |
| `TOTAL_TIME` | 전체 누적 응답 시간, 초 단위 |
| `MAX` | 가장 오래 걸린 요청 시간, 초 단위 |

평균 응답 시간은 다음과 같이 계산한다.

```text
평균 응답 시간 = TOTAL_TIME / COUNT
```

예시:

```text
TOTAL_TIME = 19.49
COUNT = 3

평균 응답 시간 = 19.49 / 3 = 약 6.49초
```

---

## 6. 운영 모니터링 기준

| 항목 | 확인 방법 | 정상 기준 | 이상 기준 | 우선 확인 구간 |
|---|---|---:|---:|---|
| Spring 서버 상태 | `/actuator/health` | `UP` | `DOWN` | Spring 서버/컨테이너 |
| DB 연결 | `/actuator/health` | `db: UP` | `db: DOWN` | PostgreSQL, DB 계정, 네트워크 |
| Redis 연결 | `/actuator/health` | `redis: UP` | `redis: DOWN` | Redis 컨테이너, 포트, 설정 |
| 일반 API 응답 | `/actuator/metrics/http.server.requests` | 1초 이내 | 3초 이상 반복 | Spring 또는 DB |
| AI 주문 API 응답 | `/api/ai/order/chat` metrics | 5~10초 내외 | 15초 이상 반복 | FastAPI, LLM, LangGraph |
| Spring → FastAPI 호출 | `[AI_CALL]` 로그 | Actuator 시간과 유사 | AI_CALL 자체가 오래 걸림 | FastAPI/AI 처리 |
| AI 내부 단계 | `[AI_STEP]` 로그 | 특정 step만 과도하지 않음 | `langgraph_invoke`, `node_*` 장시간 | AI Agent |
| MCP Tool | `[MCP_TOOL]` 로그 | 수십 ms 수준 | 수백 ms~초 단위 반복 | MCP Tool, DB 조회 |

---

## 7. 장애 또는 지연 발생 시 확인 순서

### 1단계. Spring 서버 상태 확인

```bash
curl http://localhost:8080/actuator/health
```

판단 기준:

```text
UP   → Spring 서버는 살아있음
DOWN → Spring 서버 또는 컨테이너 문제
```

### 2단계. DB/Redis 상태 확인

```bash
curl http://localhost:8080/actuator/health
```

판단 기준:

```text
db: UP, redis: UP
→ 기본 인프라 정상

db: DOWN
→ PostgreSQL 연결 문제

redis: DOWN
→ Redis 연결 문제
```

### 3단계. 느린 API Metric 확인

```bash
curl "http://localhost:8080/actuator/metrics/http.server.requests?tag=uri:/api/ai/order/chat"
```

확인 항목:

```text
COUNT
TOTAL_TIME
MAX
```

`MAX`가 15초 이상 반복되면 AI 주문 API 지연으로 판단한다.

### 4단계. Spring AI 호출 로그 확인

```bash
docker logs nunchi-spring | grep "AI_CALL"
```

확인 항목:

```text
elapsedMs
status
endpoint
```

예시:

```text
[AI_CALL] method=POST endpoint=/ai/order/chat elapsedMs=18071 status=SUCCESS
```

이 경우 Spring에서 FastAPI 응답을 약 18초 동안 기다린 것이므로, Spring 내부 처리보다 FastAPI/AI 처리 구간을 우선 확인한다.

### 5단계. FastAPI 단계별 로그 확인

```bash
docker logs nunchi-fastapi | grep "AI_STEP"
```

주요 확인 step:

```text
chat_total
langgraph_invoke
node_intent_classifier
node_order_agent
node_recommend_agent
node_step_transition
```

`langgraph_invoke`, `node_order_agent`, `node_recommend_agent`가 길게 측정되면 AI Agent 실행 구간 병목으로 판단한다.

### 6단계. MCP Tool 로그 확인

```bash
docker logs nunchi-mcp | grep "MCP_TOOL"
```

주요 확인 tool:

```text
tool_search_menus
tool_get_categories
tool_get_menus
tool_get_top_menus
```

현재 측정 기준 MCP Tool은 대부분 수십 ms 수준이므로, AI 주문 API 지연의 주요 병목 가능성은 낮다.

---

## 8. 현재까지의 성능 측정 결론

현재까지 측정 결과, `/api/ai/order/chat` 지연의 주요 원인은 다음 구간으로 확인되었다.

```text
FastAPI 내부 LangGraph/AI Agent 실행 구간
```

대표 측정 결과:

```text
Spring [AI_CALL] elapsedMs: 약 18초
FastAPI [AI_STEP] chat_total: 약 9~19초
langgraph_invoke: 대부분의 지연 차지
MCP [MCP_TOOL]: 대부분 수십 ms 수준
```

따라서 AI 주문 API가 느릴 경우 다음 순서로 판단한다.

```text
1. Spring health 확인
2. DB/Redis 확인
3. Actuator API metric 확인
4. Spring AI_CALL 확인
5. FastAPI AI_STEP 확인
6. MCP_TOOL 확인
```

AI 주문 API 지연은 Spring 프록시, DB 조회, MCP Tool보다 FastAPI/LangGraph/LLM 처리 구간을 우선 확인한다.

---

## 9. 향후 확장 방향

현재 단계에서는 Actuator와 로그 기반 점검으로 충분하다.

추후 운영 규모가 커지거나 지속적인 시각화가 필요해질 경우 다음 구성을 검토한다.

```text
Spring Actuator Prometheus endpoint
Prometheus
Grafana Dashboard
```

다만 현재는 시연 및 개발 운영 단계이므로 Prometheus/Grafana까지 도입하지 않고, Actuator와 로그 요약 스크립트 기반으로 운영 확인을 수행한다.