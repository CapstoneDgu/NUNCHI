/* ========================================================
   P04-processing.js — 카드 결제 처리 (Step 3/3 · 3상태)
   states: inserting → processing → approved
   실패 → /flowP/P06-fail.html?reason=…

   자동 전환:
     inserting  (3.0s) → processing     (카드 인식 가정)
     processing (3.0s + progress 0→100%) → result
         · default: approved
         · ?result=timeout|card_error|declined → P06 으로 이동
     approved   (2.0s) → /flowP/P05-complete.html

   디자인 확인용 쿼리스트링:
     ?state=inserting|processing|approved   초기 상태 강제
     ?result=approved|timeout|card_error|declined
   ======================================================== */

(function () {
    'use strict';

    const $ = (sel, root = document) => root.querySelector(sel);

    /* ---------- DOM refs ---------- */
    const sectionEl  = $('.p04');
    const titleEl    = $('[data-bind="title"]');
    const descEl     = $('[data-bind="desc"]');
    const storeEl    = $('[data-bind="storeName"]');
    const totalEl    = $('[data-bind="total"]');
    const progressEl = $('.p04__progress');
    const progressBarEl = $('[data-bind="progressBar"]');

    const backEl   = $('[data-action="back"]');
    const cancelEl = $('[data-action="cancel"]');

    /* ---------- Session ---------- */
    const SESSION_ID_KEY = 'sessionId';
    const STORE_KEY  = 'currentStoreName';
    const METHOD_KEY = 'paymentMethod';
    const STATUS_KEY = 'paymentStatus';

    function getSessionId() {
        const raw = sessionStorage.getItem(SESSION_ID_KEY);
        const n = raw ? Number(raw) : NaN;
        return Number.isFinite(n) ? n : null;
    }

    function getQuery(name) {
        try { return new URLSearchParams(location.search).get(name); }
        catch (_) { return null; }
    }

    const nf = new Intl.NumberFormat('ko-KR');
    const fmtWon = (n) => '₩' + nf.format(Math.max(0, n | 0));

    /* ---------- Copy ---------- */
    const COPY = {
        inserting: {
            title: '카드를 투입해주세요',
            desc:  'IC칩이 위로 향하게 하여 슬롯에 카드를 넣어주세요'
        },
        processing: {
            title: '결제를 처리하고 있어요',
            desc:  '잠시만 기다려주세요. 카드 승인 요청 중이에요'
        },
        approved: {
            title: '결제가 완료되었어요',
            desc:  '카드 결제 승인이 정상적으로 완료되었습니다'
        }
    };

    /* ---------- Timers ---------- */
    let insertTimer = null;
    let processTimer = null;
    let approvedTimer = null;
    let progressRaf = null;

    function clearAllTimers() {
        if (insertTimer)   { clearTimeout(insertTimer);   insertTimer = null; }
        if (processTimer)  { clearTimeout(processTimer);  processTimer = null; }
        if (approvedTimer) { clearTimeout(approvedTimer); approvedTimer = null; }
        if (progressRaf)   { cancelAnimationFrame(progressRaf); progressRaf = null; }
    }

    /* ---------- Progress ---------- */
    function setProgress(pct) {
        const clamped = Math.max(0, Math.min(100, pct));
        if (progressBarEl) progressBarEl.style.width = clamped + '%';
        if (progressEl) progressEl.setAttribute('aria-valuenow', String(Math.round(clamped)));
    }

    /* ---------- State ---------- */
    /**
     * @param {string} nextState
     * @param {object} [opts]
     * @param {boolean} [opts.transition=false] — 실제 전이 이벤트 여부.
     *   true 일 때만 백엔드 markSuccess 호출. URL 강제 진입(?state=approved) 같은
     *   수동 진입에서는 false 라서 markSuccess 가 중복 호출되지 않는다.
     */
    function setState(nextState, opts) {
        const transition = !!(opts && opts.transition);
        clearAllTimers();
        sectionEl.dataset.state = nextState;

        const copy = COPY[nextState] || COPY.inserting;
        if (titleEl) titleEl.textContent = copy.title;
        if (descEl)  descEl.textContent  = copy.desc;

        if (nextState === 'inserting') {
            setProgress(0);
            insertTimer = setTimeout(() => setState('processing', { transition: true }), 3000);

        } else if (nextState === 'processing') {
            setProgress(0);
            const DURATION = 3000;
            const startTs = performance.now();
            const tick = (now) => {
                const elapsed = now - startTs;
                setProgress(Math.min(100, (elapsed / DURATION) * 100));
                if (elapsed < DURATION) {
                    progressRaf = requestAnimationFrame(tick);
                }
            };
            progressRaf = requestAnimationFrame(tick);

            processTimer = setTimeout(() => {
                const forced = getQuery('result');
                if (forced === 'timeout' || forced === 'card_error' || forced === 'declined') {
                    try { sessionStorage.setItem(STATUS_KEY, 'failed'); } catch (_) {}
                    // 아직 confirm/payment 호출 전이므로 카트 그대로 살아있음. 단순 P06 이동.
                    location.href = '/flowP/P06-fail.html?reason=' + encodeURIComponent(forced);
                    return;
                }
                setState('approved', { transition: true });
            }, DURATION);

        } else if (nextState === 'approved') {
            setProgress(100);
            try { sessionStorage.setItem(STATUS_KEY, 'approved'); } catch (_) {}

            // 실제 승인 직전에 confirmOrder + payment.create + markSuccess 한 번에 호출.
            if (transition) {
                finalizePaymentThenGoComplete();
            } else {
                approvedTimer = setTimeout(() => {
                    location.href = '/flowP/P05-complete.html';
                }, 1200);
            }
        }
    }

    /* ---------- 백엔드 결제 확정 (승인 분기) ---------- */
    let finalizing = false;
    async function finalizePaymentThenGoComplete() {
        if (finalizing) return;
        finalizing = true;

        const sid = getSessionId();
        if (!sid) {
            location.href = '/flowN/N02-menu.html';
            return;
        }

        let orderId = null, paymentId = null;
        try {
            const order = await window.NunchiApi.Orders.confirm(sid);
            if (!order || !order.orderId) throw new Error('confirm 응답에 orderId 없음');
            orderId = order.orderId;
            sessionStorage.setItem('orderId', String(orderId));

            try {
                sessionStorage.setItem('orderSummary', JSON.stringify({
                    totalAmount: order.totalAmount,
                    itemCount:   (order.items || []).length,
                    firstName:   (order.items && order.items[0] && order.items[0].menuName) || '',
                    totalQty:    (order.items || []).reduce((s, it) => s + (it.quantity || 0), 0),
                }));
            } catch (_) {}

            const payment = await window.NunchiApi.Payments.create(orderId, 'IC_CARD');
            if (!payment || !payment.paymentId) throw new Error('payment.create 응답에 paymentId 없음');
            paymentId = payment.paymentId;
            sessionStorage.setItem('paymentId', String(paymentId));

            await window.NunchiApi.Payments.markSuccess(paymentId);

            approvedTimer = setTimeout(() => {
                location.href = '/flowP/P05-complete.html';
            }, 1200);
        } catch (e) {
            console.warn('[P04] 결제 확정 실패', e);
            if (paymentId) {
                window.NunchiApi.Payments.markFail(paymentId).catch(() => {});
            }
            location.href = '/flowP/P06-fail.html?reason=declined';
        }
    }

    /* ---------- Init render ----------
       이 화면 진입 시점엔 아직 confirm 전이라 서버 카트가 살아있음 → 카트 합계 그대로 표시 */
    function renderStoreAndTotal() {
        const storeName = sessionStorage.getItem(STORE_KEY) || '상록원';
        if (storeEl) storeEl.textContent = storeName;
    }

    async function fetchTotalFromCart() {
        const sid = getSessionId();
        if (!sid || !window.NunchiApi) return;
        try {
            const res = await window.NunchiApi.Cart.get(sid);
            const total = (res && typeof res.totalAmount === 'number') ? res.totalAmount : 0;
            if (totalEl) totalEl.textContent = fmtWon(total);
        } catch (e) {
            console.warn('[P04] 카트 조회 실패', e);
        }
    }

    /* ---------- Events ----------
       승인 직전 단계에 들어가기 전이면 confirm 도 안 한 상태이므로 카트 그대로 → 자유 복귀.
       모든 복귀(뒤로/취소) 는 history.back() — location.href 로 새 entry 쌓으면 P02 에서
       뒤로가기 시 P04 로 되돌아오는 문제가 생긴다. */
    function goPrev() {
        clearAllTimers();
        if (history.length > 1) history.back();
        else location.href = '/flowP/P02-payment.html';
    }
    if (backEl)   backEl.addEventListener('click',   goPrev);
    if (cancelEl) cancelEl.addEventListener('click', goPrev);

    window.addEventListener('beforeunload', clearAllTimers);

    /* ---------- Boot ---------- */
    renderStoreAndTotal();
    fetchTotalFromCart();
    try { sessionStorage.setItem(METHOD_KEY, 'ic'); } catch (_) {}

    // 초기 진입은 항상 비-전이(transition=false) — markSuccess 중복 호출 방지
    const initial = getQuery('state');
    if (initial && COPY[initial]) setState(initial, { transition: false });
    else setState('inserting', { transition: false });
})();
