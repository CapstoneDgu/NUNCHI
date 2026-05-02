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
    const CART_KEY   = 'cart';
    const STORE_KEY  = 'currentStoreName';
    const METHOD_KEY = 'paymentMethod';
    const STATUS_KEY = 'paymentStatus';

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
                    location.href = '/flowP/P06-fail.html?reason=' + encodeURIComponent(forced);
                    return;
                }
                setState('approved', { transition: true });
            }, DURATION);

        } else if (nextState === 'approved') {
            setProgress(100);
            try { sessionStorage.setItem(STATUS_KEY, 'approved'); } catch (_) {}

            // 실제 전이 이벤트일 때만 백엔드 결제 성공 마킹.
            // URL 로 강제 진입(?state=approved) 한 디자인 확인 시에는 호출하지 않음.
            if (transition) {
                const paymentId = Number(sessionStorage.getItem('paymentId'));
                if (paymentId && window.NunchiApi) {
                    window.NunchiApi.Payments.markSuccess(paymentId)
                        .catch((e) => console.warn('[P04] markSuccess 실패', e));
                }
            }

            approvedTimer = setTimeout(() => {
                location.href = '/flowP/P05-complete.html';
            }, 2000);
        }
    }

    /* ---------- Init render ---------- */
    function renderStoreAndTotal() {
        const storeName = sessionStorage.getItem(STORE_KEY) || '상록원';
        if (storeEl) storeEl.textContent = storeName;

        const cart = loadCart();
        const totalPrice = cart.reduce((s, it) => s + (it.qty || 0) * (it.price || 0), 0);
        if (totalEl) totalEl.textContent = fmtWon(totalPrice);
    }

    /* ---------- Events ---------- */
    if (backEl) {
        backEl.addEventListener('click', () => {
            clearAllTimers();
            if (history.length > 1) history.back();
            else location.href = '/flowP/P02-payment.html';
        });
    }
    if (cancelEl) {
        cancelEl.addEventListener('click', () => {
            clearAllTimers();
            location.href = '/flowP/P02-payment.html';
        });
    }

    window.addEventListener('beforeunload', clearAllTimers);

    /* ---------- Boot ---------- */
    renderStoreAndTotal();
    try { sessionStorage.setItem(METHOD_KEY, 'ic'); } catch (_) {}

    // 초기 진입은 항상 비-전이(transition=false) — markSuccess 중복 호출 방지
    const initial = getQuery('state');
    if (initial && COPY[initial]) setState(initial, { transition: false });
    else setState('inserting', { transition: false });
})();
