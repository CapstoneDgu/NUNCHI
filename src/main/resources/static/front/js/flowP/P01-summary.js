/* ========================================================
   P01-summary.js — 주문 요약 / 확인 (Step 1/3)
   - 서버 Redis 장바구니 (GET /api/orders/cart/{sessionId}) 를 진실의 원천으로 사용
   - 수량 ±  / 삭제 → Cart API 호출 후 응답으로 재렌더
   - "주문 확인 완료" → POST /api/orders/confirm → orderId 저장 → P02
   ======================================================== */

(function () {
    'use strict';

    /* ---------- Session helpers ---------- */
    const SESSION_ID_KEY = 'sessionId';
    const STORE_KEY      = 'currentStoreName';

    function getSessionId() {
        const raw = sessionStorage.getItem(SESSION_ID_KEY);
        const n = raw ? Number(raw) : NaN;
        return Number.isFinite(n) ? n : null;
    }

    /* ---------- Formatters ---------- */
    const nf = new Intl.NumberFormat('ko-KR');
    const fmtWon = (n) => '₩' + nf.format(Math.max(0, n | 0));

    /* ---------- DOM refs ---------- */
    const $  = (sel, root = document) => root.querySelector(sel);

    const listEl   = $('[data-bind="items"]');
    const countEl  = $('[data-bind="count"]');
    const totalEl  = $('[data-bind="total"]');
    const storeEl  = $('[data-bind="storeName"]');
    const ctaEl    = $('[data-action="next"]');
    const backEl   = $('[data-action="back"]');
    const itemTpl  = $('#tpl-p01-item');

    /* ---------- State (서버 응답 그대로) ---------- */
    // items: [{ itemId, menuId, menuName, unitPrice, quantity, itemTotal, options[] }]
    let items = [];

    /* ---------- Render ---------- */
    function renderStoreName() {
        const storeName = sessionStorage.getItem(STORE_KEY) || '상록원';
        if (storeEl) storeEl.textContent = storeName;
    }

    function renderList() {
        listEl.innerHTML = '';

        if (!items.length) {
            const empty = document.createElement('li');
            empty.className = 'p01__empty';
            empty.textContent = '장바구니가 비어있어요';
            listEl.appendChild(empty);
            return;
        }

        items.forEach((it) => {
            const node = itemTpl.content.firstElementChild.cloneNode(true);
            node.dataset.itemId = it.itemId;

            $('[data-name]', node).textContent  = it.menuName || '';
            $('[data-price]', node).textContent = fmtWon(it.itemTotal);
            $('[data-qty-value]', node).textContent = String(it.quantity || 1);

            // 썸네일 — imageUrl 있으면 <img> 채우고, 없으면 메뉴명 첫 글자 fallback
            const thumb = $('[data-thumb]', node);
            if (thumb) {
                thumb.innerHTML = '';
                if (it.imageUrl) {
                    const img = document.createElement('img');
                    img.src = it.imageUrl;
                    img.alt = it.menuName || '';
                    img.loading = 'lazy';
                    thumb.appendChild(img);
                } else {
                    thumb.textContent = (it.menuName || '').slice(0, 1);
                }
            }

            const decBtn = $('[data-qty-dec]', node);
            if ((it.quantity || 1) <= 1) decBtn.disabled = true;

            listEl.appendChild(node);
        });
    }

    function renderSummary() {
        const totalQty   = items.reduce((s, it) => s + (it.quantity || 0), 0);
        const totalPrice = items.reduce((s, it) => s + (it.itemTotal || 0), 0);

        countEl.textContent = totalQty + '개';
        totalEl.textContent = fmtWon(totalPrice);

        ctaEl.disabled = totalQty === 0;
    }

    function renderAll() {
        renderStoreName();
        renderList();
        renderSummary();
    }

    function applyCart(cartResponse) {
        items = (cartResponse && cartResponse.items) ? cartResponse.items : [];
        renderAll();
    }

    function logApiError(label, e) {
        console.warn('[P01] ' + label + ' 실패', e);
    }

    /* ---------- API ---------- */
    async function fetchCart() {
        const sid = getSessionId();
        if (!sid) {
            // 세션이 없으면 N02 부터 다시 시작
            location.href = '/menu';
            return;
        }
        try {
            const res = await window.NunchiApi.Cart.get(sid);
            applyCart(res);
        } catch (e) {
            logApiError('카트 조회', e);
            applyCart({ items: [] });
        }
    }

    async function changeQty(itemId, nextQty) {
        const sid = getSessionId();
        if (!sid) return;
        try {
            const res = await window.NunchiApi.Cart.updateItem(sid, itemId, nextQty);
            applyCart(res);
        } catch (e) {
            logApiError('수량 변경', e);
        }
    }

    async function removeItem(itemId) {
        const sid = getSessionId();
        if (!sid) return;
        try {
            const res = await window.NunchiApi.Cart.removeItem(sid, itemId);
            applyCart(res);
        } catch (e) {
            logApiError('삭제', e);
        }
    }

    function goNext() {
        if (items.length === 0) return;
        // confirmOrder 는 결제수단 선택 직후 P02 에서 호출 (그래야 P02 까지 카트가 살아있음)
        location.href = '/payment';
    }

    /* ---------- Events ---------- */
    listEl.addEventListener('click', (e) => {
        const itemEl = e.target.closest('[data-item]');
        if (!itemEl) return;
        const itemId = itemEl.dataset.itemId;
        const found = items.find((it) => it.itemId === itemId);
        if (!found) return;

        if (e.target.closest('[data-qty-inc]')) {
            changeQty(itemId, found.quantity + 1);
            return;
        }
        if (e.target.closest('[data-qty-dec]')) {
            const next = found.quantity - 1;
            if (next < 1) return;
            changeQty(itemId, next);
            return;
        }
        if (e.target.closest('[data-del]')) {
            removeItem(itemId);
            return;
        }
    });

    backEl.addEventListener('click', () => confirmGoHome());

    ctaEl.addEventListener('click', goNext);

    /* ---------- Init ---------- */
    renderAll();
    fetchCart();
})();
