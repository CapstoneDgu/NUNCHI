/* ========================================================
   P02-payment.js — 결제 수단 선택 (Step 2/3)
   - 서버 카트 (GET /api/orders/cart/{sessionId}) 로 금액/수량 요약
   - IC카드 / 정맥인증 중 하나 선택
   - CTA 클릭 시
       1) POST /api/payments { orderId, method } 로 결제 생성 → paymentId 저장
       2) ic   → /flowP/P04-processing.html
          vein → /flowP/P03-vein.html
   - orderId / sessionId 없으면 P01 또는 N02 로 복귀
   ======================================================== */

(function () {
    'use strict';

    /* ---------- Session helpers ---------- */
    const SESSION_ID_KEY = 'sessionId';
    const ORDER_ID_KEY   = 'orderId';
    const PAYMENT_ID_KEY = 'paymentId';
    const STORE_KEY      = 'currentStoreName';
    const METHOD_KEY     = 'paymentMethod';

    function getSessionId() {
        const raw = sessionStorage.getItem(SESSION_ID_KEY);
        const n = raw ? Number(raw) : NaN;
        return Number.isFinite(n) ? n : null;
    }
    function getOrderId() {
        const raw = sessionStorage.getItem(ORDER_ID_KEY);
        const n = raw ? Number(raw) : NaN;
        return Number.isFinite(n) ? n : null;
    }

    /* ---------- Formatters ---------- */
    const nf = new Intl.NumberFormat('ko-KR');
    const fmtWon = (n) => '₩' + nf.format(Math.max(0, n | 0));

    /* ---------- DOM refs ---------- */
    const $  = (sel, root = document) => root.querySelector(sel);
    const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

    const countEl   = $('[data-bind="count"]');
    const totalEl   = $('[data-bind="total"]');
    const storeEl   = $('[data-bind="storeName"]');
    const hintEl    = $('[data-bind="hint"]');
    const hintTxtEl = hintEl ? $('span', hintEl) : null;
    const ctaEl     = $('[data-action="next"]');
    const backEl    = $('[data-action="back"]');
    const methodEls = $$('.method-card[data-method]');

    /* ---------- State ---------- */
    let cartItems = [];
    let selectedMethod = null;

    /* ---------- Render ---------- */
    function renderStoreName() {
        const storeName = sessionStorage.getItem(STORE_KEY) || '상록원';
        if (storeEl) storeEl.textContent = storeName;
    }

    function renderSummary() {
        const totalQty   = cartItems.reduce((s, it) => s + (it.quantity || 0), 0);
        const totalPrice = cartItems.reduce((s, it) => s + (it.itemTotal || 0), 0);

        if (countEl) countEl.textContent = totalQty + '개';
        if (totalEl) totalEl.textContent = fmtWon(totalPrice);
    }

    function renderSelection() {
        methodEls.forEach((el) => {
            const isOn = el.dataset.method === selectedMethod;
            el.setAttribute('aria-pressed', String(isOn));
            el.setAttribute('aria-checked', String(isOn));
            el.classList.toggle('is-selected', isOn);
        });

        if (selectedMethod === 'ic') {
            ctaEl.textContent = 'IC카드로 결제하기 →';
            if (hintEl && hintTxtEl) {
                hintEl.classList.add('p02__hint--selected');
                hintTxtEl.textContent = 'IC카드 투입구에 카드를 꽂아주세요';
            }
        } else if (selectedMethod === 'vein') {
            ctaEl.textContent = '정맥인증으로 결제하기 →';
            if (hintEl && hintTxtEl) {
                hintEl.classList.add('p02__hint--selected');
                hintTxtEl.textContent = '등록된 손바닥 정맥으로 간편하게 인증해요';
            }
        } else {
            ctaEl.textContent = '결제 수단 선택 →';
            if (hintEl && hintTxtEl) {
                hintEl.classList.remove('p02__hint--selected');
                hintTxtEl.textContent = '결제 수단을 선택하면 다음 단계로 진행할 수 있어요';
            }
        }

        ctaEl.disabled = !selectedMethod;
    }

    function renderAll() {
        renderStoreName();
        renderSummary();
        renderSelection();
    }

    /* ---------- API ---------- */
    async function fetchCart() {
        const sid = getSessionId();
        if (!sid) {
            location.href = '/flowN/N02-menu.html';
            return;
        }
        try {
            const res = await window.NunchiApi.Cart.get(sid);
            cartItems = (res && res.items) ? res.items : [];
        } catch (e) {
            console.warn('[P02] 카트 조회 실패', e);
            cartItems = [];
        }
        renderSummary();
    }

    /* ---------- Events ---------- */
    methodEls.forEach((el) => {
        el.addEventListener('click', () => {
            const m = el.dataset.method;
            if (!m) return;
            selectedMethod = (selectedMethod === m) ? null : m;
            renderSelection();
        });
    });

    if (backEl) {
        backEl.addEventListener('click', () => {
            if (history.length > 1) history.back();
            else location.href = '/flowP/P01-summary.html';
        });
    }

    if (ctaEl) {
        // 결제수단 선택 후 결제 화면(P03/P04) 으로 단순 이동.
        // 백엔드 호출(confirmOrder/payment.create) 은 인증/카드 승인 직전에 한 번에 묶어서.
        ctaEl.addEventListener('click', () => {
            if (!selectedMethod) return;
            try { sessionStorage.setItem(METHOD_KEY, selectedMethod); } catch (_) {}

            if (selectedMethod === 'ic') {
                location.href = '/flowP/P04-processing.html';
            } else if (selectedMethod === 'vein') {
                location.href = '/flowP/P03-vein.html';
            }
        });
    }

    /* ---------- Init ---------- */
    renderAll();
    fetchCart();
})();
