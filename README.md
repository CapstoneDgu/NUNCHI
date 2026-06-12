# 1. Project Overview (프로젝트 개요)
- 프로젝트 이름: NUNCHI (눈치)
- 프로젝트 설명: LLM Agentic AI 기반 배리어프리 자율주문 키오스크. 음성 대화만으로 메뉴 탐색 → 추천 → 담기 → 결제까지 완료할 수 있으며, 사용자가 말하지 않아도 AI가 망설임을 감지해 먼저 도움을 제안합니다.

<br/>
<br/>

# 2. Team Members (팀원 및 팀 소개)
| 조효동 | 이현노 | 임호영 | 임현우 |
|:------:|:------:|:------:|:------:|
| <img src="https://github.com/hyodongg.png" alt="효동" width="150"> | <img src="https://github.com/leehyunro123.png" alt="현노" width="150"> | <img src="https://github.com/user-attachments/assets/8364b797-411e-409c-bbcf-8252edcee649" alt="호영" width="150"> | <img src="https://github.com/user-attachments/assets/38a337c7-6881-4e92-a918-a740acc21b20" alt="현우" width="150"> |
| BE / AI | FE · 결제 · HW연동 | Infra / VISION/ ADMIN | FE/PM |
| [GitHub](https://github.com/hyodongg) | [GitHub](https://github.com/leehyunro123) | [GitHub](https://github.com/sexybugmaster) | [GitHub](https://github.com/pyeree) |

<br/>
<br/>

# 3. Key Features (주요 기능)

## 3.1 시작 화면

터치 주문, 시선 추적 주문, 저자세(배리어프리) 모드를 선택할 수 있는 메인 화면입니다.

<img src="https://github.com/user-attachments/assets/e54e6ad5-cc99-447b-a537-3530af4ee04f"  alt="메인화면" width="300"/>

<br/>

## 3.2 주문 모드 선택

일반 터치 주문과 AI 대화 주문 중 원하는 방식을 선택합니다.

<img src="https://github.com/user-attachments/assets/5ea4ef96-d0a1-4453-9e8a-bcceb0a984d3" alt="메인화면" width="300"/>

<br/>

## 3.3 일반 모드 (Touch Order)

터치 기반 주문이 기본 흐름입니다. 상단 마이크 버튼으로 음성 주문을 시작하면 AI가 음성을 인식하고 화면을 자동으로 원격 조작하여 메뉴 탐색·담기·결제까지 진행합니다. AI 추천 라벨, 대화 기록, 매장/포장 전환 버튼을 제공합니다.

<img src="https://github.com/user-attachments/assets/8ba8a3b5-2d33-4372-8402-6cd34469743c" alt="메인화면" width="300"/>



<br/>

## 3.4 아바타 모드 (AI Avatar)

캐릭터 아바타 **"눈치"** 와 음성 대화로 주문 전 과정을 진행합니다. 인기 메뉴 추천은 물론, 아래와 같이 다양한 기준으로 추천을 요청할 수 있습니다.

- **인기 메뉴 기반** 추천
- **영양성분 기반** 추천 (저칼로리, 고단백 등)
- **알레르기 기반** 추천 (특정 성분 제외)
- **날씨 기반** 추천 (오늘 날씨에 어울리는 메뉴)

**아바타 모드 — 대화 & 추천**

<img src="https://github.com/user-attachments/assets/54ab750c-3caa-4f28-bff5-c2e1698de4a3" alt="메인화면" width="300"/>

<br/>

**아바타 모드 — 추천 메뉴 모달**

추천을 받으면 메뉴 카드 모달이 표시됩니다. 마음에 드는 메뉴를 바로 담거나, 마음에 들지 않으면 닫고 다른 추천을 요청할 수 있습니다.

<img src="https://github.com/user-attachments/assets/acc3edb0-b85e-4a0e-81e3-61bd61b8e2bb" alt="메인화면" width="300"/>


<br/>

## 3.5 퀵바 (Quick Bar)

다음 발화를 예측하여 하단에 추천 입력 버튼을 제공합니다. 퀵바 응답은 미리 prefetch되어 즉시 응답이 가능합니다.

> 예: `장바구니 확인해줘` · `조건 바꿔서 추천해줘` · `다른 메뉴도 추천해줘`

<img src="https://github.com/user-attachments/assets/61639b41-c19f-407a-a1a1-711050aa06f0" alt="메인화면" width="300"/>


<br/>

## 3.6 Smithery MCP 연동

[Smithery.ai](https://smithery.ai)에 NUNCHI MCP 서버를 등록하여, 개인 Claude Desktop에 간단한 명령어 한 줄로 연결할 수 있습니다. 개인 AI를 통해 외국어 주문, 개인 맞춤 추천 등 다양한 방식으로 활용 가능합니다.

<img src="https://github.com/user-attachments/assets/9472ad6b-cfea-4390-a341-ac616c6f31a1" width="600"/>

<img src="https://github.com/user-attachments/assets/c614b573-e7e7-44a3-8604-ca0d6d237731" width="600"/>

<img src="https://github.com/user-attachments/assets/3dac1501-ed1f-49e2-bee0-7070d34f8487" width="600"/>


<!-- Smithery 연동 스크린샷 삽입 위치 -->
<!-- <img src="docs/images/smithery-mcp.png" alt="Smithery MCP 연동" width="100%"/> -->

<br/>

## 3.7 👀 눈치 기능

사용자가 도움을 요청하지 않아도, AI가 망설임 신호를 감지해 먼저 추천을 제안합니다.

- **체류 시간**: 특정 화면에 오래 머무름
- **반복 탐색**: 같은 메뉴·카테고리 반복 확인
- **침묵**: 응답 없이 일정 시간 정지
- **헤징 발화**: "음", "뭐가 좋지", "추천해줘" 등 불확실 표현
- **음성 불확실성**: STT 신뢰도 낮음

<br/>

## 3.8 시선 추적 주문 (NUNCHI Vision)

OpenCV와 MediaPipe 기반 Python 비전 엔진을 통해 사용자의 시선 방향과 더블 깜빡임을 감지합니다.

Python 비전 서버는 WebSocket(`ws://127.0.0.1:8765`)으로 브라우저와 연결되며,
프론트엔드의 `vision-client.js`가 `.vision-selectable` 요소를 대상으로 포커스 이동과 클릭을 수행합니다.

- **LEFT / RIGHT 시선 유지**: 선택 포커스 이동
- **더블 깜빡임**: 현재 포커스된 요소 클릭
- **캘리브레이션 화면**: 사용자의 중앙 시선 기준 보정
- **적용 화면**: 모드 선택, 매장/포장 선택, 메뉴 선택, 주문 확인, 결제 흐름

이를 통해 터치 없이도 키오스크 주요 주문 플로우를 진행할 수 있습니다.

<br/>

## 3.9 관리자 모드

키오스크에서 발생한 주문 데이터를 관리자가 확인할 수 있는 운영 관리 화면입니다.

관리자는 주문 내역, 주문 상세 정보, 주문 상태, 주문 시각, 주문 메뉴 등을 조회할 수 있으며, 키오스크에서 생성된 주문 데이터가 백엔드와 DB에 정상 반영되었는지 확인할 수 있습니다.

- 관리자 로그인
- 주문 내역 조회
- 주문 상세 정보 확인
- 주문 상태 확인
- 주문 데이터 DB 저장 확인
- 관리자 API 기반 주문 데이터 조회
- 주문 통계 파일 다운로드

<br/>
<br/>

# 4. Tasks & Responsibilities (작업 및 역할 분담)

|  |  |  |
|--------|--------|--------|
| 조효동 | <img src="https://github.com/hyodongg.png" alt="효동" width="100"> | <ul><li>Spring Boot & FastAPI 백엔드/AI 서버 설계·개발</li><li>메뉴 조회·추천·주문·결제 API 구현</li><li>LangGraph 주문 에이전트 & MCP Tool/서버(Smithery) 구현</li><li>MCP 서버 Smithery 배포</li><li>CI/CD 설정 및 서버 관리 (GitHub Actions, Discord 웹훅)</li></ul> |
| 임현우 | <img src="https://github.com/user-attachments/assets/38a337c7-6881-4e92-a918-a740acc21b20" alt="임현우" width="100"> | <ul><li>기획 및 디자인 시스템 구축</li><li>AI 아바타 제작 및 플로우 구현</li><li>아바타 모드 UI 구현</li><li>프론트 통합 및 SSE 클라이언트 구축</li></ul> |
| 임호영 | <img src="https://github.com/user-attachments/assets/8364b797-411e-409c-bbcf-8252edcee649" alt="호영" width="100"> | <ul><li>AWS EC2 및 Docker Compose 기반 서비스 배포·운영 환경 구축</li><li>Spring Boot, FastAPI, PostgreSQL, Redis, Nginx 기반 서버 아키텍처 구성</li><li>GitHub Actions CI/CD 및 Prometheus·Grafana 기반 모니터링 체계 구축</li><li>관리자 주문 조회 기능 개발, API 성능 분석 및 시선 입력 보조 기능 연동 검토</li></ul> |
| 이현노 | <img src="https://github.com/leehyunro123.png" alt="현노" width="100"> | <ul><li>일반 모드 키오스크 UI 및 <b>음성 원격조작 주문 플로우</b> 개발 — STT 연동, quick-action·AI action dispatcher 로 「메뉴 탐색 → 상세 → 옵션 모달 → 담기」 화면 자동 제어</li><li><b>AI 추천 모달 · 눈치(망설임) 추천 모달</b> 프론트 구현 — 음성/터치 선택, 추천 사유 라벨, 대화 사이드바 연동</li><li><b>결제 플로우(flowP) 전 화면</b> 구현 — 주문 요약·결제수단·카드결제·완료·실패·카카오페이 바코드, 백엔드/장바구니 서버 연동</li><li><b>실 카드 단말기(IC·마그네틱) 하드웨어 연동</b> 및 영수증·번호표 출력 에이전트 연결</li><li><b>저자세(배리어프리) 모드</b> 구현 — 화면 하단 절반 UI, 모달 겹침·토글 처리</li><li>홈 추천 슬라이드·AI 추천 라벨링, 메뉴 데이터 시드(2·3층 매장·영업시간), 1~3차 QA 대응</li></ul> |

<br/>
<br/>

# 5. Technology Stack (기술 스택)


|  |  |
|--------|--------|
| Java | ![Java](https://img.shields.io/badge/Java_17-007396?style=flat-square&logo=openjdk&logoColor=white) |
| JavaScript | ![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black) |
| Python | ![Python](https://img.shields.io/badge/Python_3.11-3776AB?style=flat-square&logo=python&logoColor=white) |
| Spring Boot | ![Spring Boot](https://img.shields.io/badge/Spring_Boot-6DB33F?style=flat-square&logo=springboot&logoColor=white) |
| PostgreSQL | ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white) |
| Redis | ![Redis](https://img.shields.io/badge/Redis-FF4438?style=flat-square&logo=redis&logoColor=white) |
| FastAPI | ![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white) |
| LangGraph | ![LangGraph](https://img.shields.io/badge/LangGraph-1C3C3C?style=flat-square&logo=langchain&logoColor=white) |
| OpenAI | ![OpenAI](https://img.shields.io/badge/OpenAI-412991?style=flat-square&logo=openai&logoColor=white) |
| Docker | ![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white) |
| GitHub Actions | ![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-2088FF?style=flat-square&logo=githubactions&logoColor=white) |
| Prometheus | ![Prometheus](https://img.shields.io/badge/Prometheus-E6522C?style=flat&logo=prometheus&logoColor=white") |
| Grafana | ![Grafana](https://img.shields.io/badge/Grafana-F46800?style=flat&logo=grafana&logoColor=white") |
| OpenCV | ![OpenCV](https://img.shields.io/badge/OpenCV-5C3EE8?style=flat&logo=opencv&logoColor=white") |
| MediaPipe | ![MediaPipe](https://img.shields.io/badge/MediaPipe-0097A7?style=flat&logo=google&logoColor=white") |

# 6. Project Structure (프로젝트 구조)

```plaintext
NUNCHI/
├── src/main/
│   ├── java/dgu/capstone/
│   │   ├── domain/          # 엔티티 및 도메인 모델
│   │   ├── repository/      # JPA 레포지토리
│   │   ├── service/         # 비즈니스 로직
│   │   ├── controller/      # REST API 컨트롤러
│   │   ├── dto/             # 요청/응답 DTO
│   │   ├── config/          # Security, Redis 설정
│   │   └── exception/       # 공통 예외 처리
│   └── resources/
│       └── application.yml
├── nunchi-vision/               # OpenCV / MediaPipe 기반 시선 입력 서버
│   ├── main.py                  # 비전 엔진 실행 진입점
│   ├── server.py                # WebSocket 서버
│   ├── detectors/               # 얼굴/홍채 감지
│   └── fusion/                  # 시선 이동, 깜빡임, 망설임 이벤트 처리
├── tests/                   # 프론트엔드 단위 테스트 (Node test runner)
├── docs/
│   └── images/              # ← 스크린샷 이미지 저장 위치
├── .env.example
├── Dockerfile
└── build.gradle
```

<br/>
<br/>

# 7. Development Workflow (개발 워크플로우)

## 브랜치 전략 (Branch Strategy)

Git Flow를 기반으로 하며, 다음 브랜치를 사용합니다.

- `main` Branch
  - 배포 가능한 상태의 코드를 유지합니다.
  - 모든 배포는 이 브랜치에서 이루어집니다.

- `dev` Branch
  - 개발 통합 브랜치입니다.
  - 기능 개발 완료 후 dev로 머지합니다.

- `{name}/{feature}` Branch
  - 팀원 각자의 기능 개발 브랜치입니다.
  - 예: `feat/#82/kakao-payment`

<br/>
<br/>

# 8. Coding Convention

## 명명 규칙 (Java / Spring)

```java
// 클래스: 파스칼 케이스
public class OrderService {}

// 메서드 & 변수: 카멜 케이스
public void createOrder() {}
private String orderStatus;

// 상수: 어퍼 스네이크 케이스
public static final String JWT_SECRET = "...";
```

<br/>

## API 설계 원칙

```
- REST API: /api/**
- 응답 코드: 200, 201, 400, 401, 404, 409, 500 명확히 구분
- 비즈니스 로직은 Controller에 두지 않고 Service로 분리
- 외부 연동은 Adapter/Client 계층으로 분리
- 공통 예외 처리 사용
```

<br/>

## 보안 원칙

```
- API Key, JWT Secret 등 민감 정보는 코드에 하드코딩 금지
- 환경 변수(.env)로 관리
- 결제/인증 정보는 로그에 기록 금지
```

<br/>
<br/>

# 9. 커밋 컨벤션

## 기본 구조

```
[Type] 설명
```

<br/>

## Type 종류

```
[Feat]    : 새로운 기능 추가
[Fix]     : 버그 수정
[Refactor]: 코드 리팩토링
[Chore]   : 빌드, 설정, 패키지 변경
[Docs]    : 문서 작성 / 수정
```

<br/>

## 커밋 예시

```
== ex1
[Feat] 메뉴 추천 API 추가

홈 화면 메뉴 추천 엔드포인트 및 Specification 기반 필터링 구현

== ex2
[Fix] 장바구니 분산 락 획득 실패 시 409 에러코드 추가

== ex3
[Chore] Discord 웹훅 CI/CD 알림 추가
```
