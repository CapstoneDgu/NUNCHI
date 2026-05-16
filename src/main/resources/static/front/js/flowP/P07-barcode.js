/* ========================================================
   P07-barcode.js — 카카오페이 결제 (Step 3/3)
   states: waiting → success
   자동 전환:
     waiting (2.5s + progress 0→100%) →
       confirmOrder + payByBarcode 묶어 호출 →
       success (1.2s) → /complete
     실패 시 → /fail?reason=barcode_error

   디자인 확인용 쿼리스트링:
     ?state=waiting|success    초기 상태 강제
     ?result=success|fail      waiting 종료 시 결과 강제

   흐름:
     사용자 → 카카오톡에 결제 요청 알림 → 휴대폰에서 인증 → 결제 완료
     (Mock — 백엔드 payByBarcode 는 검증 없이 SUCCESS 처리)
   ======================================================== */

(function () {
    'use strict';

    const $ = (sel, root = document) => root.querySelector(sel);

    /* ---------- DOM refs ---------- */
    const sectionEl     = $('.p07');
    const titleEl       = $('[data-bind="title"]');
    const descEl        = $('[data-bind="desc"]');
    const progressEl    = $('.p07__progress');
    const progressBarEl = $('[data-bind="progressBar"]');
    const storeEl       = $('[data-bind="storeName"]');

    const backEl   = $('[data-action="back"]');
    const cancelEl = $('[data-action="cancel"]');

    /* ---------- Session helpers ---------- */
    const SESSION_ID_KEY = 'sessionId';
    const STORE_KEY      = 'currentStoreName';
    const METHOD_KEY     = 'paymentMethod';
    const STATUS_KEY     = 'paymentStatus';

    function getSessionId() {
        const raw = sessionStorage.getItem(SESSION_ID_KEY);
        const n = raw ? Number(raw) : NaN;
        return Number.isFinite(n) ? n : null;
    }

    function getQuery(name) {
        try { return new URLSearchParams(location.search).get(name); }
        catch (_) { return null; }
    }

    /* ---------- Copy per state ---------- */
    const COPY = {
        waiting: {
            title: '카카오페이 결제 바코드를<br>스캐너에 대주세요',
            desc:  '카카오톡 더보기 → 결제 → 바코드 화면을 스캐너 정중앙에 평평하게 올려주세요',
        },
        success: {
            title: '결제가 완료되었어요',
            desc:  '카카오페이 바코드 결제가 정상적으로 처리되었습니다',
        },
    };

    /* ---------- Timers ---------- */
    let scanTimer    = null;
    let progressRaf  = null;
    let successTimer = null;

    function clearAllTimers() {
        if (scanTimer)    { clearTimeout(scanTimer);    scanTimer    = null; }
        if (successTimer) { clearTimeout(successTimer); successTimer = null; }
        if (progressRaf)  { cancelAnimationFrame(progressRaf); progressRaf = null; }
    }

    /* ---------- Progress ---------- */
    function setProgress(pct) {
        const clamped = Math.max(0, Math.min(100, pct));
        if (progressBarEl) progressBarEl.style.width = clamped + '%';
        if (progressEl) progressEl.setAttribute('aria-valuenow', String(Math.round(clamped)));
    }

    /* ---------- State setter ---------- */
    function setState(nextState) {
        clearAllTimers();
        sectionEl.dataset.state = nextState;

        const copy = COPY[nextState] || COPY.waiting;
        if (titleEl) titleEl.innerHTML = copy.title;
        if (descEl)  descEl.textContent = copy.desc;

        if (nextState === 'waiting') {
            startScanning();
        } else if (nextState === 'success') {
            setProgress(100);
            try { sessionStorage.setItem(STATUS_KEY, 'approved'); } catch (_) {}
            successTimer = setTimeout(() => {
                location.href = '/complete';
            }, 1200);
        }
    }

    /* ---------- Scanning ---------- */
    function startScanning() {
        setProgress(0);

        const DURATION = 2500;
        const startTs = performance.now();

        const tick = (now) => {
            const elapsed = now - startTs;
            setProgress(Math.min(100, (elapsed / DURATION) * 100));
            if (elapsed < DURATION) {
                progressRaf = requestAnimationFrame(tick);
            }
        };
        progressRaf = requestAnimationFrame(tick);

        scanTimer = setTimeout(() => {
            const forced = getQuery('result');
            if (forced === 'fail') {
                try { sessionStorage.setItem(STATUS_KEY, 'failed'); } catch (_) {}
                location.href = '/fail?reason=barcode_error';
                return;
            }
            finalizeBarcodePayment();
        }, DURATION);
    }

    /* ---------- 백엔드 결제 확정 ----------
       바코드는 백엔드 payByBarcode 가 confirmOrder 완료 후 즉시 SUCCESS 결제 레코드를 만든다.
       그래서 IC/정맥과 달리 markSuccess 별도 호출 불필요.
       1) POST /api/orders/confirm   → orderId
       2) POST /api/payments/barcode → paymentId (이미 SUCCESS 상태)
       3) orderSummary 저장 → setState('success') → /complete */
    let finalizing = false;
    async function finalizeBarcodePayment() {
        if (finalizing) return;
        finalizing = true;

        const sid = getSessionId();
        if (!sid) {
            location.href = '/menu';
            return;
        }

        try {
            const order = await window.NunchiApi.Orders.confirm(sid);
            if (!order || !order.orderId) throw new Error('confirm 응답에 orderId 없음');
            sessionStorage.setItem('orderId', String(order.orderId));

            try {
                sessionStorage.setItem('orderSummary', JSON.stringify({
                    totalAmount: order.totalAmount,
                    itemCount:   (order.items || []).length,
                    firstName:   (order.items && order.items[0] && order.items[0].menuName) || '',
                    totalQty:    (order.items || []).reduce((s, it) => s + (it.quantity || 0), 0),
                }));
            } catch (_) {}

            // 바코드 값은 mock — 백엔드가 검증하지 않으므로 임의 13자리
            const barcodeValue = String(Date.now()).slice(-13);
            const payment = await window.NunchiApi.Payments.payByBarcode(order.orderId, barcodeValue);
            if (!payment || !payment.paymentId) throw new Error('payByBarcode 응답에 paymentId 없음');
            sessionStorage.setItem('paymentId', String(payment.paymentId));

            setState('success');
        } catch (e) {
            console.warn('[P07] 바코드 결제 실패', e);
            try { sessionStorage.setItem(STATUS_KEY, 'failed'); } catch (_) {}
            location.href = '/fail?reason=barcode_error';
        }
    }

    /* ---------- Misc ---------- */
    function renderStoreName() {
        const storeName = sessionStorage.getItem(STORE_KEY) || '상록원';
        if (storeEl) storeEl.textContent = storeName;
    }

    /* ---------- Events ----------
       성공 단계 이전이면 confirm 도 호출 전이므로 카트가 그대로 살아있음 → 자유 복귀 */
    function goPrev() {
        clearAllTimers();
        if (history.length > 1) history.back();
        else location.href = '/payment';
    }
    if (backEl)   backEl.addEventListener('click',   goPrev);
    if (cancelEl) cancelEl.addEventListener('click', goPrev);

    window.addEventListener('beforeunload', clearAllTimers);

    /* ---------- Boot ---------- */
    renderStoreName();
    try { sessionStorage.setItem(METHOD_KEY, 'barcode'); } catch (_) {}

    const initial = getQuery('state');
    if (initial && COPY[initial]) {
        setState(initial);
    } else {
        setState('waiting');
    }
})();
