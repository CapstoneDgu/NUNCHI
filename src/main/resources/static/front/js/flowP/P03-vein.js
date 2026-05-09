/* ========================================================
   P03-vein.js — 정맥 인증 (Step 3/3 · 4상태 전환)
   states: prepare → scanning → success | fail

   자동 전환:
     prepare  (1.8s) → scanning
     scanning (3.5s + progress 0→100%) → result (default: success)
     success  (2.0s) → /complete
     fail     → 사용자 액션

   디자인 확인용 쿼리스트링:
     ?state=prepare|scanning|success|fail   초기 상태 강제
     ?result=success|fail                   scanning 종료 시 결과 강제
   ======================================================== */

(function () {
    'use strict';

    const $ = (sel, root = document) => root.querySelector(sel);

    /* ---------- DOM refs ---------- */
    const sectionEl  = $('.p03');
    const titleEl    = $('[data-bind="title"]');
    const descEl     = $('[data-bind="desc"]');
    const progressEl = $('.p03__progress');
    const progressBarEl = $('[data-bind="progressBar"]');
    const storeEl    = $('[data-bind="storeName"]');

    const backEl   = $('[data-action="back"]');
    const cancelEl = $('[data-action="cancel"]');
    const retryEl  = $('[data-action="retry"]');
    const switchEl = $('[data-action="switch"]');

    /* ---------- Session helpers ---------- */
    const STORE_KEY   = 'currentStoreName';
    const METHOD_KEY  = 'paymentMethod';
    const STATUS_KEY  = 'paymentStatus';

    function getQuery(name) {
        try { return new URLSearchParams(location.search).get(name); }
        catch (_) { return null; }
    }

    /* ---------- Copy per state ---------- */
    const COPY = {
        prepare: {
            title: '손바닥을 올려주세요',
            desc:  '센서 위 약 15cm 높이에 손바닥을 펴서 올려주세요'
        },
        scanning: {
            title: '정맥을 인식하고 있어요',
            desc:  '잠시만 기다려주세요. 손바닥을 움직이지 마세요'
        },
        success: {
            title: '인증이 완료되었어요',
            desc:  '결제가 정상적으로 처리되었습니다'
        },
        fail: {
            title: '인식하지 못했어요',
            desc:  '손바닥 위치를 다시 확인한 후 재시도하거나 다른 결제 수단을 선택해주세요'
        }
    };

    /* ---------- Timers ---------- */
    let prepareTimer = null;
    let scanTimer    = null;
    let progressRaf  = null;
    let successTimer = null;

    function clearAllTimers() {
        if (prepareTimer) { clearTimeout(prepareTimer); prepareTimer = null; }
        if (scanTimer)    { clearTimeout(scanTimer);    scanTimer    = null; }
        if (successTimer) { clearTimeout(successTimer); successTimer = null; }
        if (progressRaf)  { cancelAnimationFrame(progressRaf); progressRaf = null; }
    }

    /* ---------- State setter ---------- */
    function setState(nextState) {
        clearAllTimers();
        sectionEl.dataset.state = nextState;

        const copy = COPY[nextState] || COPY.prepare;
        if (titleEl) titleEl.textContent = copy.title;
        if (descEl)  descEl.textContent  = copy.desc;

        if (nextState === 'scanning') {
            startScanning();
        } else if (nextState === 'prepare') {
            resetProgress();
            prepareTimer = setTimeout(() => setState('scanning'), 1800);
        } else if (nextState === 'success') {
            setProgress(100);
            try { sessionStorage.setItem(STATUS_KEY, 'approved'); } catch (_) {}
            finalizePaymentThenGoComplete();
        } else if (nextState === 'fail') {
            try { sessionStorage.setItem(STATUS_KEY, 'failed'); } catch (_) {}
        }
    }

    /* ---------- 백엔드 결제 확정 (성공 분기 1회 가드) ----------
       인증 성공 직전까지 confirmOrder/payment.create 를 미뤘다 한 번에 호출:
         1) POST /api/orders/confirm   → orderId
         2) POST /api/payments         → paymentId
         3) PATCH /api/payments/{id}/success
         4) sessionStorage.orderSummary 저장 후 P05 이동
       어느 단계든 실패하면 카트는 그대로(아직 confirm 전이거나 markFail 가드) → P06 이동 */
    let finalizing = false;
    async function finalizePaymentThenGoComplete() {
        if (finalizing) return;
        finalizing = true;

        const sid = Number(sessionStorage.getItem('sessionId'));
        if (!sid) {
            location.href = '/menu';
            return;
        }

        let orderId = null, paymentId = null;
        try {
            const order = await window.NunchiApi.Orders.confirm(sid);
            if (!order || !order.orderId) throw new Error('confirm 응답에 orderId 없음');
            orderId = order.orderId;
            sessionStorage.setItem('orderId', String(orderId));

            // 결제 완료 화면용 요약
            try {
                sessionStorage.setItem('orderSummary', JSON.stringify({
                    totalAmount: order.totalAmount,
                    itemCount:   (order.items || []).length,
                    firstName:   (order.items && order.items[0] && order.items[0].menuName) || '',
                    totalQty:    (order.items || []).reduce((s, it) => s + (it.quantity || 0), 0),
                }));
            } catch (_) {}

            const payment = await window.NunchiApi.Payments.create(orderId, 'VEIN_AUTH');
            if (!payment || !payment.paymentId) throw new Error('payment.create 응답에 paymentId 없음');
            paymentId = payment.paymentId;
            sessionStorage.setItem('paymentId', String(paymentId));

            await window.NunchiApi.Payments.markSuccess(paymentId);

            successTimer = setTimeout(() => {
                location.href = '/complete';
            }, 1200);
        } catch (e) {
            console.warn('[P03] 결제 확정 실패', e);
            // 결제 레코드까지는 만들어진 경우 markFail
            if (paymentId) {
                window.NunchiApi.Payments.markFail(paymentId).catch(() => {});
            }
            location.href = '/fail?reason=vein_unregistered';
        }
    }

    /* ---------- Progress helpers ---------- */
    function setProgress(pct) {
        const clamped = Math.max(0, Math.min(100, pct));
        if (progressBarEl) progressBarEl.style.width = clamped + '%';
        if (progressEl) progressEl.setAttribute('aria-valuenow', String(Math.round(clamped)));
    }
    function resetProgress() { setProgress(0); }

    /* ---------- Scanning ---------- */
    function startScanning() {
        resetProgress();

        const DURATION = 3500;
        const startTs = performance.now();

        const tick = (now) => {
            const elapsed = now - startTs;
            const pct = Math.min(100, (elapsed / DURATION) * 100);
            setProgress(pct);
            if (elapsed < DURATION) {
                progressRaf = requestAnimationFrame(tick);
            }
        };
        progressRaf = requestAnimationFrame(tick);

        scanTimer = setTimeout(() => {
            const forced = getQuery('result');
            const finalState = (forced === 'fail' || forced === 'success')
                ? forced
                : 'success';
            setState(finalState);
        }, DURATION);
    }

    /* ---------- Misc render ---------- */
    function renderStoreName() {
        const storeName = sessionStorage.getItem(STORE_KEY) || '상록원';
        if (storeEl) storeEl.textContent = storeName;
    }

    /* ---------- Events ----------
       성공 단계에 진입하기 전이라면 confirm 도 하기 전이므로 카트가 그대로 살아있음.
       모든 복귀(뒤로/취소/결제수단 변경) 는 history.back() 으로 — location.href 로 새 entry 를
       쌓으면 P02 에서 뒤로가기 시 P03 으로 되돌아오는 문제가 생긴다. */
    function goPrev() {
        clearAllTimers();
        if (history.length > 1) history.back();
        else location.href = '/payment';
    }
    if (backEl)   backEl.addEventListener('click', () => confirmGoHome(clearAllTimers));
    if (cancelEl) cancelEl.addEventListener('click', goPrev);
    if (switchEl) switchEl.addEventListener('click', goPrev);
    if (retryEl) {
        retryEl.addEventListener('click', () => { setState('prepare'); });
    }

    window.addEventListener('beforeunload', clearAllTimers);

    /* ---------- Init ---------- */
    renderStoreName();

    const initial = getQuery('state');
    if (initial && COPY[initial]) {
        setState(initial);
    } else {
        try { sessionStorage.setItem(METHOD_KEY, 'vein'); } catch (_) {}
        setState('prepare');
    }
})();
