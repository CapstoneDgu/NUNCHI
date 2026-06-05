// ========================================================
// card-terminal.js — IC 카드 인식 어댑터 (듀얼아이 DKSRDE633R)
//
// 실제 카드 단말(리더기)로 카드를 "인식"만 한다. (VAN 승인/출금 없음 — 캡스톤 데모)
//   - 로컬 카드 에이전트(scripts/card_reader_agent.py, 127.0.0.1:9200)가
//     DualCardDll.dll 로 리더기(COM6)를 제어해 카드 꽂힘(ATR) 또는 마그네틱(MSR)을 반환.
//   - requestApproval 은 그 에이전트의 GET /card 를 호출해, 카드가 인식되면 approved:true.
//     (인식 = 승인 처리. 실제 결제는 일어나지 않음)
//
// requestApproval({ amount, orderName }) => Promise<{
//     approved: boolean,
//     type?: 'ic' | 'msr',    // 삽입 / 마그네틱 스와이프
//     atr?: string, track?: string,
//     cardName?: string,
//     reason?: string,        // 실패: timeout / card_error
// }>
// ========================================================

(function () {
    'use strict';

    // 카드 에이전트. /card 는 카드가 꽂히거나 긁힐 때까지(최대 30초) 대기 후 결과 반환.
    const AGENT_URL = 'http://127.0.0.1:9200/card';

    async function requestApproval(/* { amount, orderName } */) {
        try {
            const res = await fetch(AGENT_URL, { method: 'GET' });
            if (!res.ok) return { approved: false, reason: 'card_error' };
            const j = await res.json();
            if (j && j.ok) {
                // type: 'ic'(삽입) | 'msr'(마그네틱 스와이프)
                return { approved: true, type: j.type, atr: j.atr, track: j.track, cardName: 'IC카드' };
            }
            return { approved: false, reason: (j && j.reason === 'timeout') ? 'timeout' : 'card_error' };
        } catch (e) {
            console.warn('[CardTerminal] 카드 에이전트(9200) 연결 실패 — 실행 여부 확인', e);
            return { approved: false, reason: 'card_error' };
        }
    }

    window.CardTerminal = { requestApproval };
})();
