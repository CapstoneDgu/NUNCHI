/* ========================================================
   P01-summary.js — 주문 요약/확인 (Step 1/3)
   - sessionStorage.cart 를 읽어 리스트·합계 렌더
   - 수량 ± / 삭제 / 주문 확인 완료 → P02
   - cart 가 비어있으면 데모 mock 데이터로 렌더 (디자인 확인 편의)
   - cart 아이템 형식: { id, name, price, qty, storeName?, imageUrl? }
   ======================================================== */

(function () {
    'use strict';

    /* ---------- Session helpers ---------- */
    const SESSION_KEY = 'cart';
    const STORE_KEY   = 'currentStoreName';

    const MOCK_CART = [
        { id: 'mock-shabu', name: '샤브칼국수 세트', price: 7000, qty: 1, storeName: '상록원' }
    ];

    function loadCart() {
        try {
            const raw = sessionStorage.getItem(SESSION_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : null;
        } catch (_) { return null; }
    }
    function saveCart(cart) {
        try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(cart)); } catch (_) {}
    }

    /* ---------- Formatters ---------- */
    const nf = new Intl.NumberFormat('ko-KR');
    const fmtWon = (n) => '₩' + nf.format(Math.max(0, n | 0));

    /* ---------- DOM refs ---------- */
    const $ = (sel, root = document) => root.querySelector(sel);
    const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

    const listEl   = $('[data-bind="items"]');
    const countEl  = $('[data-bind="count"]');
    const totalEl  = $('[data-bind="total"]');
    const storeEl  = $('[data-bind="storeName"]');
    const ctaEl    = $('[data-action="next"]');
    const backEl   = $('[data-action="back"]');
    const itemTpl  = $('#tpl-p01-item');

    /* ---------- State ---------- */
    let cart = loadCart();
    if (!cart || cart.length === 0) {
        cart = MOCK_CART.slice();
    }

    /* ---------- Render ---------- */
    function renderStoreName() {
        const storeName =
            (sessionStorage.getItem(STORE_KEY)) ||
            (cart[0] && cart[0].storeName) ||
            '상록원';
        if (storeEl) storeEl.textContent = storeName;
    }

    function renderList() {
        listEl.innerHTML = '';

        if (cart.length === 0) {
            const empty = document.createElement('li');
            empty.className = 'p01__empty';
            empty.textContent = '장바구니가 비어있어요';
            listEl.appendChild(empty);
            return;
        }

        cart.forEach((item, idx) => {
            const node = itemTpl.content.firstElementChild.cloneNode(true);
            node.dataset.index = String(idx);

            $('[data-name]', node).textContent  = item.name || '';
            $('[data-price]', node).textContent = fmtWon(item.price);
            $('[data-qty-value]', node).textContent = String(item.qty || 1);

            if (item.imageUrl) {
                const thumb = $('[data-thumb]', node);
                thumb.innerHTML = '';
                const img = document.createElement('img');
                img.src = item.imageUrl;
                img.alt = item.name || '';
                thumb.appendChild(img);
            }

            const decBtn = $('[data-qty-dec]', node);
            if ((item.qty || 1) <= 1) decBtn.disabled = true;

            listEl.appendChild(node);
        });
    }

    function renderSummary() {
        const totalQty   = cart.reduce((s, it) => s + (it.qty || 0), 0);
        const totalPrice = cart.reduce((s, it) => s + (it.qty || 0) * (it.price || 0), 0);

        countEl.textContent = totalQty + '개';
        totalEl.textContent = fmtWon(totalPrice);

        ctaEl.disabled = totalQty === 0;
    }

    function renderAll() {
        renderStoreName();
        renderList();
        renderSummary();
    }

    /* ---------- Events ---------- */
    listEl.addEventListener('click', (e) => {
        const itemEl = e.target.closest('[data-item]');
        if (!itemEl) return;
        const idx = Number(itemEl.dataset.index);
        if (Number.isNaN(idx) || !cart[idx]) return;

        if (e.target.closest('[data-qty-inc]')) {
            cart[idx].qty = (cart[idx].qty || 1) + 1;
            saveCart(cart);
            renderAll();
            return;
        }
        if (e.target.closest('[data-qty-dec]')) {
            const nextQty = (cart[idx].qty || 1) - 1;
            if (nextQty < 1) return;
            cart[idx].qty = nextQty;
            saveCart(cart);
            renderAll();
            return;
        }
        if (e.target.closest('[data-del]')) {
            cart.splice(idx, 1);
            saveCart(cart);
            renderAll();
            return;
        }
    });

    backEl.addEventListener('click', () => {
        if (history.length > 1) history.back();
        else location.href = '/flowN/N02-menu.html';
    });

    ctaEl.addEventListener('click', () => {
        if (cart.length === 0) return;
        saveCart(cart);
        location.href = '/flowP/P02-payment.html';
    });

    /* ---------- Init ---------- */
    renderAll();
})();
