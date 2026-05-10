/* ========================================================
   P05-complete.js — 주문 완료
   - 주문번호(대기번호) 랜덤 생성 후 sessionStorage 유지
   - cart / paymentMethod 로 요약 렌더
   - 영수증 프로그레스 3초 후 \"· 완료\" 표시
   - 60초 자동 홈 복귀 (/)  — 카운트다운 UI 표시
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
        'currentStep', 'orderId', 'paymentId'
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
        if (m === 'vein') return '정맥 인증';
        if (m === 'ic')   return 'IC 카드';
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

    /* ---------- Auto-reset countdown ---------- */
    const AUTO_SEC = 60;
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

    // 세션 종료 — 정리 전에 sessionId 캡처해서 PATCH /api/sessions/{id}/complete 호출
    (function completeBackendSession() {
        const sessionId = sessionStorage.getItem(SESSION_ID_KEY);
        if (sessionId && window.NunchiApi) {
            window.NunchiApi.Sessions.complete(sessionId)
                .catch((e) => console.warn('[P05] session.complete 실패', e));
        }
    })();

    setTimeout(markReceiptDone, 3000);
    startCountdown();
})();
