// ========================================================
// card-terminal.js — IC 카드 단말기 연동 어댑터 (QA R2-2)
//
// ⚠ 현재 상태: "연동 자리(seam)"만 정의한 스텁이다.
//   실제 카드 승인은 단말기 제조사/VAN 의 통신 규격이 있어야 구현할 수 있다.
//   이 파일이 로드되어 window.CardTerminal.requestApproval 가 존재하면
//   P04(카드 결제 처리 화면)이 가짜 타이머 대신 "실제 승인 요청" 경로를 탄다.
//   스텁 상태에서는 ENABLED=false 라 어댑터를 노출하지 않으므로 기존 데모 흐름이 유지된다.
//
// ── 왜 단말기 정보가 꼭 필요한가 ──────────────────────────
//   키오스크 IC 카드 결제는 브라우저가 카드를 직접 읽지 못한다. 반드시
//   "결제 단말기(리더기) + VAN(부가통신사) 연동 모듈" 을 거쳐 카드사 승인을 받는다.
//   연동 방식은 제조사마다 달라서 아래 중 하나를 확인해야 구현 가능하다:
//     1) VAN 사 + 단말기 모델  (예: KICC/NICE/스마트로/KIS + 모델명)
//     2) 단말 제어용 로컬 연동 프로그램(EXE/서비스)의 호출 규격
//          - 보통 localhost 의 특정 포트로 HTTP/소켓 요청 → 승인 결과 콜백
//     3) 단말이 시리얼/USB 직결이면 ESC/명령 규격 문서
//
// ── 연동 시 구현 계약(아래 requestApproval 채우기) ──────────
//   requestApproval({ amount, orderName }) => Promise<{
//       approved: boolean,
//       approvalNo?: string,     // 승인번호
//       cardName?: string,       // 카드사
//       reason?: string,         // 실패 사유 (declined / timeout / card_error ...)
//   }>
//
//   예) 로컬 단말 연동 프로그램이 http://127.0.0.1:9100/approval 을 제공하는 경우:
//     const res = await fetch('http://127.0.0.1:9100/approval', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ amount, taxFree: 0 }),
//     });
//     const j = await res.json();
//     return { approved: j.code === '0000', approvalNo: j.approvalNo, reason: j.message };
// ========================================================

(function () {
    'use strict';

    // 실제 단말 연동 규격을 확보해 requestApproval 를 채운 뒤 true 로 바꾼다.
    const ENABLED = false;

    if (!ENABLED) {
        console.info('[CardTerminal] 미연동(스텁) — 단말기/VAN 규격 확보 후 활성화 필요');
        return;   // window.CardTerminal 노출 안 함 → P04 는 기존 데모 흐름 유지
    }

    async function requestApproval(/* { amount, orderName } */) {
        // TODO(단말 연동): 위 주석의 계약대로 실제 승인 요청 구현.
        throw { approved: false, reason: 'not_implemented' };
    }

    window.CardTerminal = { requestApproval };
})();
