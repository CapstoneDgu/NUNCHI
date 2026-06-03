/* ========================================================
   P02-payment.js — 결제 수단 선택 (Step 2/3)
   - 서버 카트 (GET /api/orders/cart/{sessionId}) 로 금액/수량 요약
   - IC카드 / 정맥인증 중 하나 선택
   - CTA 클릭 시
       1) POST /api/payments { orderId, method } 로 결제 생성 → paymentId 저장
       2) ic   → /processing
          vein → /vein
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
        } else if (selectedMethod === 'barcode') {
            ctaEl.textContent = '카카오페이로 결제하기 →';
            if (hintEl && hintTxtEl) {
                hintEl.classList.add('p02__hint--selected');
                hintTxtEl.textContent = '카카오톡 결제 바코드 화면을 미리 켜두세요';
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
            location.href = '/menu';
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
        backEl.addEventListener('click', () => confirmGoHome());
    }

    // 백엔드 결제 메서드 enum 매핑
    const PAY_ENUM = { ic: 'IC_CARD', vein: 'VEIN_AUTH' };

    // 데모 모드(?demo=1): 결제 백엔드 없이 승인 성공 처리 → 완료 화면/영수증 출력까지 플로우 확인용. (QA)
    const DEMO_PAY = /[?&]demo=1\b/.test(location.search);

    // 카트(또는 샘플)로 영수증/완료 화면용 orderSummary 를 만들어 둔다. (데모 출력 검증용)
    function seedDemoSummary() {
        const items = (cartItems && cartItems.length) ? cartItems : [
            { menuName: '아메리카노(ICE)', quantity: 2, unitPrice: 3000, itemTotal: 6000, options: [] },
            { menuName: '카페라떼',        quantity: 1, unitPrice: 2500, itemTotal: 2500, options: [] },
        ];
        const total = items.reduce((s, it) =>
            s + (it.itemTotal != null ? it.itemTotal : (it.unitPrice || 0) * (it.quantity || 1)), 0);
        try {
            sessionStorage.setItem('orderId', '9999');
            sessionStorage.setItem('orderSummary', JSON.stringify({
                orderId: 9999,
                orderType: sessionStorage.getItem('dineOption') === 'takeout' ? 'TAKEOUT' : 'DINE_IN',
                totalAmount: total,
                itemCount: items.length,
                firstName: (items[0] && items[0].menuName) || '',
                totalQty: items.reduce((s, it) => s + (it.quantity || 0), 0),
                items: items,
            }));
            sessionStorage.setItem('paymentStatus', 'approved');
        } catch (_) {}
    }

    // 모달 "승인 요청" 시 호출 — 결제 3단계(주문확정→결제생성→성공)를 한 번에 처리. (QA R2-16)
    //   반환: { ok:true } | { ok:false, reason }
    async function approvePayment() {
        if (DEMO_PAY) {
            console.info('[P02] 데모 결제(?demo=1) — 백엔드 호출 없이 승인 성공 처리');
            seedDemoSummary();
            return { ok: true };
        }
        const sid = getSessionId();
        if (!sid) return { ok: false, reason: 'payment_failed' };
        try {
            // 재시도(다시 시도) 시 confirm 중복 방지 — 이미 확정된 orderId 가 있으면 재사용
            let orderId = getOrderId();
            if (!orderId) {
                const order = await window.NunchiApi.Orders.confirm(sid);
                if (!order || !order.orderId) throw new Error('confirm 응답에 orderId 없음');
                orderId = order.orderId;
                try { sessionStorage.setItem(ORDER_ID_KEY, String(orderId)); } catch (_) {}
                // 영수증/완료 화면용 주문 요약 (품목 명세 포함)
                try {
                    sessionStorage.setItem('orderSummary', JSON.stringify({
                        orderId:     order.orderId,
                        orderType:   order.orderType,
                        totalAmount: order.totalAmount,
                        itemCount:   (order.items || []).length,
                        firstName:   (order.items && order.items[0] && order.items[0].menuName) || '',
                        totalQty:    (order.items || []).reduce((s, it) => s + (it.quantity || 0), 0),
                        items:       order.items || [],
                    }));
                } catch (_) {}
            }

            if (selectedMethod === 'barcode') {
                // 바코드는 payByBarcode 가 즉시 SUCCESS 결제 생성 (markSuccess 불필요)
                const barcodeValue = String(Date.now()).slice(-13);
                const pay = await window.NunchiApi.Payments.payByBarcode(orderId, barcodeValue);
                if (!pay || !pay.paymentId) throw new Error('payByBarcode 응답에 paymentId 없음');
                try { sessionStorage.setItem(PAYMENT_ID_KEY, String(pay.paymentId)); } catch (_) {}
            } else {
                const pay = await window.NunchiApi.Payments.create(orderId, PAY_ENUM[selectedMethod] || 'IC_CARD');
                if (!pay || !pay.paymentId) throw new Error('payment.create 응답에 paymentId 없음');
                try { sessionStorage.setItem(PAYMENT_ID_KEY, String(pay.paymentId)); } catch (_) {}
                await window.NunchiApi.Payments.markSuccess(pay.paymentId);
            }

            try { sessionStorage.setItem('paymentStatus', 'approved'); } catch (_) {}
            return { ok: true };
        } catch (e) {
            console.warn('[P02] 결제 승인 실패', e);
            try { sessionStorage.setItem('paymentStatus', 'failed'); } catch (_) {}
            const code = String((e && (e.code || e.msg)) || '');
            const reason = /VEIN.*UNREGISTER|정맥.*등록/i.test(code) ? 'declined' : 'payment_failed';
            return { ok: false, reason };
        }
    }

    if (ctaEl) {
        // 결제하기 → 결제 승인 모달 (실제 키오스크 결제창). 모달이 승인·완료·영수증선택까지 전부 처리.
        ctaEl.addEventListener('click', () => {
            if (!selectedMethod) return;
            try { sessionStorage.setItem(METHOD_KEY, selectedMethod); } catch (_) {}
            if (!window.PaymentModal) { location.href = '/complete'; return; }

            window.PaymentModal.open({
                method: selectedMethod,
                items: cartItems,
                totalAmount: cartItems.reduce((s, it) => s + (it.itemTotal || 0), 0),
                approve: approvePayment,
                onCancel: () => { /* 모달만 닫고 결제수단 화면 유지 */ },
                onDone: (receiptKind) => {
                    // 영수증/번호표 선택 결과를 완료 화면(P05)에 전달 → 거기서 실제 출력
                    try { sessionStorage.setItem('receiptKind', receiptKind || 'none'); } catch (_) {}
                    location.href = '/complete';
                },
            });
        });
    }

    /* ---------- Init ---------- */
    renderAll();
    fetchCart();

    // ---------- 음성 컨트롤 ----------
    if (window.VoiceController) {
        window.VoiceController.init({
            getSessionId: getSessionId,
            mode: 'NORMAL',
            onAiReply: (data) => {
                console.log('[P02] AI reply:', data && data.reply);
            },
        });
    }
    // 아바타 모드 — 결제 수단 선택 안내
    if (window.AvatarGuide) {
        window.AvatarGuide.speak('결제 수단을 골라주세요.');
    }
})();
