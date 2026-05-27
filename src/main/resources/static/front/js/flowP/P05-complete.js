/* ========================================================
   P05-complete.js — 주문 완료
   - 주문번호(대기번호) 랜덤 생성 후 sessionStorage 유지
   - cart / paymentMethod 로 요약 렌더
   - 영수증 프로그레스 3초 후 \"· 완료\" 표시
   - 15초 자동 홈 복귀 (/)  — 카운트다운 UI 표시
   - CTA/X 클릭 → 즉시 홈 복귀 + flow 세션 초기화
   ======================================================== */

(function () {
    'use strict';

    const $ = (sel, root = document) => root.querySelector(sel);

    /* ---------- DOM refs ---------- */
    const orderNoEl      = $('[data-bind="orderNo"]');
    const storeEl        = $('[data-bind="storeName"]');
    const orderTimeEl    = $('[data-bind="orderTime"]');
    const methodLabelEl  = $('[data-bind="methodLabel"]');
    const itemsSummaryEl = $('[data-bind="itemsSummary"]');
    const totalEl        = $('[data-bind="total"]');
    const autoSecEl      = $('[data-bind="autoSec"]');
    const receiptEl      = $('[data-bind="receipt"]');
    const receiptTitleEl = $('[data-bind="receiptTitle"]');
    const outputModalEl  = $('[data-output-modal]');

    const homeEls = Array.from(document.querySelectorAll('[data-action="home"]'));

    /* ---------- Session ---------- */
    const SESSION_ID_KEY = 'sessionId';
    const STORE_KEY      = 'currentStoreName';
    const METHOD_KEY     = 'paymentMethod';
    const STATUS_KEY     = 'paymentStatus';
    const ORDERNO_KEY    = 'orderNumber';
    const ORDER_SUMMARY_KEY = 'orderSummary';

    const FLOW_KEYS_TO_CLEAR = [
        STORE_KEY, METHOD_KEY, STATUS_KEY, ORDERNO_KEY, ORDER_SUMMARY_KEY,
        SESSION_ID_KEY, 'mode', 'dineOption', 'currentFloor', 'currentStore',
        'currentStep', 'orderId', 'paymentId', 'printOrder'
    ];

    function loadOrderSummary() {
        try {
            const raw = sessionStorage.getItem(ORDER_SUMMARY_KEY);
            if (!raw) return null;
            return JSON.parse(raw);
        } catch (_) { return null; }
    }

    function getSessionId() {
        const raw = sessionStorage.getItem(SESSION_ID_KEY);
        const n = raw ? Number(raw) : NaN;
        return Number.isFinite(n) ? n : null;
    }

    /* ---------- Utils ---------- */
    const nf = new Intl.NumberFormat('ko-KR');
    const fmtWon = (n) => '₩' + nf.format(Math.max(0, n | 0));
    const pad2 = (n) => String(n).padStart(2, '0');

    function generateOrderNo() {
        const letters = 'ABCDEFGHJKMNPQRSTUVWXYZ';
        const letter = letters[Math.floor(Math.random() * letters.length)];
        const number = pad2(Math.floor(Math.random() * 99) + 1);
        return `${letter}-${number}`;
    }

    function formatOrderTime(d = new Date()) {
        return `${d.getFullYear()}.${pad2(d.getMonth() + 1)}.${pad2(d.getDate())} `
             + `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    }

    function getMethodLabel() {
        const m = sessionStorage.getItem(METHOD_KEY);
        if (m === 'vein')    return '정맥 인증';
        if (m === 'ic')      return 'IC 카드';
        if (m === 'barcode') return '카카오 바코드';
        return 'IC 카드';
    }

    /* ---------- Render ---------- */
    function renderAll() {
        const storeName = sessionStorage.getItem(STORE_KEY) || '상록원';
        if (storeEl) storeEl.textContent = storeName;

        let orderNo = sessionStorage.getItem(ORDERNO_KEY);
        if (!orderNo) {
            orderNo = generateOrderNo();
            try { sessionStorage.setItem(ORDERNO_KEY, orderNo); } catch (_) {}
        }
        if (orderNoEl) orderNoEl.textContent = orderNo;

        if (orderTimeEl) orderTimeEl.textContent = formatOrderTime();
        if (methodLabelEl) methodLabelEl.textContent = getMethodLabel();

        const summary = loadOrderSummary() || { totalAmount: 0, itemCount: 0, firstName: '', totalQty: 0 };

        if (itemsSummaryEl) {
            const extra = summary.itemCount > 1 ? ` 외 ${summary.itemCount - 1}건` : '';
            itemsSummaryEl.textContent = summary.firstName
                ? `${summary.firstName}${extra} (총 ${summary.totalQty}개)`
                : `${summary.totalQty}개`;
        }
        if (totalEl) totalEl.textContent = fmtWon(summary.totalAmount);
    }

    /* ---------- Receipt progress done ---------- */
    function markReceiptDone() {
        if (receiptEl) receiptEl.classList.add('p05__receipt--done');
    }

    /* ---------- 출력 선택 모달 (영수증 / 번호표) ---------- */
    // 완료 화면 진입 시 출력 항목을 고르게 한다. 고른 뒤에야 출력 안내 + 카운트다운 시작.
    let outputChosen = false;
    function openOutputModal() {
        if (!outputModalEl) { afterOutputChosen('receipt'); return; }
        outputModalEl.hidden = false;
        const choose = (kind) => {
            if (outputChosen) return;
            outputChosen = true;
            outputModalEl.hidden = true;
            afterOutputChosen(kind);
        };
        outputModalEl.querySelectorAll('[data-output]').forEach((btn) => {
            btn.addEventListener('click', () => choose(btn.getAttribute('data-output')));
        });
        // 안전장치 — 아무도 안 고르면 20초 뒤 영수증으로 진행 (키오스크 멈춤 방지)
        setTimeout(() => choose('receipt'), 20000);
    }

    async function printOrderTicket(kind) {
        const raw = sessionStorage.getItem('printOrder');
        if (!raw) {
            console.warn('[P05] printOrder 없음');
            return;
        }

        const printOrder = JSON.parse(raw);

        const items = (printOrder.items || []).map((item) => {
            return `${item.menuName} x${item.quantity}`;
        });

        await fetch('http://localhost:9100/print', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                type: kind,
                orderNumber: printOrder.orderNumber,
                items: items
            }),
        });
    }
    function afterOutputChosen(kind) {
        if (receiptTitleEl) {
            receiptTitleEl.textContent = kind === 'ticket'
                ? '번호표가 출력되고 있어요'
                : '영수증이 출력되고 있어요';
        }

        printOrderTicket(kind).catch((e) => {
            console.warn('[P05] 프린터 출력 실패', e);
        });

        if (receiptEl) receiptEl.hidden = false;
        setTimeout(markReceiptDone, 3000);
        startCountdown();
    }


    /* ---------- Auto-reset countdown ---------- */
    const AUTO_SEC = 15;
    let remaining = AUTO_SEC;
    let tickTimer = null;

    function startCountdown() {
        if (autoSecEl) autoSecEl.textContent = String(remaining);
        tickTimer = setInterval(() => {
            remaining -= 1;
            if (autoSecEl) autoSecEl.textContent = String(Math.max(0, remaining));
            if (remaining <= 0) {
                clearInterval(tickTimer);
                tickTimer = null;
                goHome();
            }
        }, 1000);
    }

    function clearFlowSession() {
        try {
            FLOW_KEYS_TO_CLEAR.forEach((k) => sessionStorage.removeItem(k));
        } catch (_) {}
    }

    function goHome() {
        if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
        clearFlowSession();
        location.href = '/start';
    }

    /* ---------- Events ---------- */
    homeEls.forEach((el) => {
        el.addEventListener('click', goHome);
    });

    window.addEventListener('beforeunload', () => {
        if (tickTimer) clearInterval(tickTimer);
    });

    /* ---------- Init ---------- */
    renderAll();
    try { sessionStorage.setItem(STATUS_KEY, 'approved'); } catch (_) {}

    // 세션 종료 정책 (이슈 #109)
    //
    //   [현재 — 단말기 미연동, 결제 더미]
    //   - 일반(N02) 모드: P04 markSuccess 후 P05 진입 → 여기서 session.complete 호출.
    //   - 아바타(A01) 모드: 사용자 "결제해줘" 발화 시 FastAPI MCP Tool 이
    //     주문 확인 → 결제 요청(더미) → 세션 종료까지 자동 수행. 이후 프론트가
    //     동일 흐름으로 P05 에 도달하면서 여기서 또 한 번 호출하지만,
    //     서버 측 complete 가 멱등이라 안전 (이미 COMPLETED 면 상태 변경 없이 응답).
    //
    //   [단말기 연동 후]
    //   - FastAPI MCP Tool 은 주문 확인 + 결제 요청까지만 수행.
    //   - 단말기 승인 결과를 프론트가 받으면 결제 성공 처리(POST /api/payments/{id}/success)
    //     후 여기서 세션 종료. 즉 단일 호출 경로로 정리되며 본 호출이 정식 종료 지점이 된다.
    (function completeBackendSession() {
        const sessionId = sessionStorage.getItem(SESSION_ID_KEY);
        if (sessionId && window.NunchiApi) {
            window.NunchiApi.Sessions.complete(sessionId)
                .catch((e) => console.warn('[P05] session.complete 실패', e));
        }
        if (window.AppState && window.AppState.get('MODE') === 'AVATAR') {
            window.AppState.remove('AI_SESSION_ID');
        }
    })();

    // 아바타 모드 — 완료 안내
    if (window.AvatarGuide) {
        window.AvatarGuide.speak('결제가 완료됐어요. 맛있게 드세요.');
    }

    // 출력 항목(영수증/번호표) 선택 후 출력 안내 + 카운트다운 시작
    openOutputModal();

    // ---------- 음성 컨트롤 ----------
    if (window.VoiceController) {
        window.VoiceController.init({
            getSessionId: getSessionId,
            mode: 'NORMAL',
            onAiReply: (data) => console.log('[P05] AI reply:', data && data.reply),
        });
    }
})();
