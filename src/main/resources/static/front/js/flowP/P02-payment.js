/* ========================================================
   P02-payment.js — 결제 수단 선택 (Step 2/3)
   - sessionStorage.cart 로 금액/수량 요약
   - IC카드 / 정맥인증 중 하나 선택 (라디오)
   - 선택 시 sessionStorage.paymentMethod 저장
   - CTA 클릭 시 분기
       ic   → /flowP/P04-processing.html (카드 결제 처리)
       vein → /flowP/P03-vein.html        (정맥 인증)
   - cart 가 비어있으면 P01 과 동일한 mock 로 렌더 (디자인 확인 편의)
   ======================================================== */

(function () {
    'use strict';

    /* ---------- Session helpers ---------- */
    const CART_KEY    = 'cart';
    const STORE_KEY   = 'currentStoreName';
    const METHOD_KEY  = 'paymentMethod';

    const MOCK_CART = [
        { id: 'mock-shabu', name: '샤브칼국수 세트', price: 7000, qty: 1, storeName: '상록원' }
    ];

    function loadCart() {
        try {
            const raw = sessionStorage.getItem(CART_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : null;
        } catch (_) { return null; }
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
    let cart = loadCart();
    if (!cart || cart.length === 0) {
        cart = MOCK_CART.slice();
    }
    let selectedMethod = null;

    /* ---------- Render ---------- */
    function renderStoreName() {
        const storeName =
            sessionStorage.getItem(STORE_KEY) ||
            (cart[0] && cart[0].storeName) ||
            '상록원';
        if (storeEl) storeEl.textContent = storeName;
    }

    function renderSummary() {
        const totalQty   = cart.reduce((s, it) => s + (it.qty || 0), 0);
        const totalPrice = cart.reduce((s, it) => s + (it.qty || 0) * (it.price || 0), 0);

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
})();
