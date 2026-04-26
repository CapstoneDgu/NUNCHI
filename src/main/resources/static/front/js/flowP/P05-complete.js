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
    const CART_KEY    = 'cart';
    const STORE_KEY   = 'currentStoreName';
    const METHOD_KEY  = 'paymentMethod';
    const STATUS_KEY  = 'paymentStatus';
    const ORDERNO_KEY = 'orderNumber';

    const FLOW_KEYS_TO_CLEAR = [
        CART_KEY, STORE_KEY, METHOD_KEY, STATUS_KEY, ORDERNO_KEY,
        'mode', 'dineOption', 'currentFloor', 'currentStore',
        'aiSessionId', 'currentStep'
    ];

    const MOCK_CART = [
        { id: 'mock-shabu', name: '샤브칼국수 세트', price: 7000, qty: 1, storeName: '상록원' }
    ];

    function loadCart() {
        try {
            const raw = sessionStorage.getItem(CART_KEY);
            if (!raw) return MOCK_CART.slice();
            const parsed = JSON.parse(raw);
            return (Array.isArray(parsed) && parsed.length) ? parsed : MOCK_CART.slice();
        } catch (_) { return MOCK_CART.slice(); }
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

        const cart = loadCart();
        const totalQty   = cart.reduce((s, it) => s + (it.qty || 0), 0);
        const totalPrice = cart.reduce((s, it) => s + (it.qty || 0) * (it.price || 0), 0);

        if (itemsSummaryEl) {
            const firstName = cart[0] ? (cart[0].name || '') : '';
            const extra = cart.length > 1 ? ` 외 ${cart.length - 1}건` : '';
            itemsSummaryEl.textContent = firstName
                ? `${firstName}${extra} (총 ${totalQty}개)`
                : `${totalQty}개`;
        }
        if (totalEl) totalEl.textContent = fmtWon(totalPrice);
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
        location.href = '/index.html';
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
    setTimeout(markReceiptDone, 3000);
    startCountdown();
})();
