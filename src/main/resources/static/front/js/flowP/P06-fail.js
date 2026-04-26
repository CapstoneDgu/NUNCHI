/* ========================================================
   P06-fail.js — 결제 실패 (사유별 분기)
   reasons:
     timeout          — 카드 투입 시간 초과
     card_error       — 카드 인식 실패
     declined         — 카드사 승인 거절
     vein_timeout     — 정맥 인식 시간 초과
     vein_unregistered— 미등록 정맥

   Query: ?reason=<code>  (없거나 알 수 없으면 default 적용)

   CTA 분기:
     - 재시도 가능 (timeout/card_error/vein_timeout) → [다른 수단] + [다시 시도 →] 2버튼
     - 재시도 불가 (declined/vein_unregistered)     → [다른 결제 수단] 1버튼
     retry 클릭 시 돌아갈 대상:
        vein_* → /flowP/P03-vein.html
        ic_*   → /flowP/P04-processing.html
   ======================================================== */

(function () {
    'use strict';

    const $  = (sel, root = document) => root.querySelector(sel);

    /* ---------- DOM refs ---------- */
    const storeEl      = $('[data-bind="storeName"]');
    const pillEl       = $('[data-bind="reasonPill"]');
    const titleEl      = $('[data-bind="title"]');
    const descEl       = $('[data-bind="desc"]');
    const helpListEl   = $('[data-bind="helpList"]');
    const totalEl      = $('[data-bind="total"]');
    const ctaRowEl     = $('[data-bind="ctaRow"]');

    const backEl   = $('[data-action="back"]');
    const switchEl = $('[data-action="switch"]');
    const retryEl  = $('[data-action="retry"]');
    const homeEl   = $('[data-action="home"]');

    /* ---------- Session ---------- */
    const CART_KEY   = 'cart';
    const STORE_KEY  = 'currentStoreName';
    const METHOD_KEY = 'paymentMethod';
    const STATUS_KEY = 'paymentStatus';

    const FLOW_KEYS_TO_CLEAR = [
        CART_KEY, STORE_KEY, METHOD_KEY, STATUS_KEY, 'orderNumber',
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

    function getQuery(name) {
        try { return new URLSearchParams(location.search).get(name); }
        catch (_) { return null; }
    }

    const nf = new Intl.NumberFormat('ko-KR');
    const fmtWon = (n) => '₩' + nf.format(Math.max(0, n | 0));

    /* ---------- Reason copy map ---------- */
    const REASONS = {
        timeout: {
            pill: 'E-001 · 시간초과',
            title: '결제 시간이 초과되었어요',
            desc:  '카드 투입이 감지되지 않아 결제가 자동 취소되었습니다. 다시 시도하거나 다른 결제 수단을 선택해주세요.',
            help:  [
                'IC 칩이 있는 면이 위로 향하는지 확인해주세요',
                '카드를 끝까지 밀어 넣어주세요',
                '인식이 계속 안 되면 다른 결제 수단을 이용해주세요'
            ],
            retry: 'ic'
        },
        card_error: {
            pill: 'E-002 · 카드 인식 실패',
            title: '카드를 인식할 수 없어요',
            desc:  '카드 표면의 IC 칩이나 마그네틱 스트라이프가 손상되었을 수 있어요. 카드 상태를 확인한 뒤 다시 시도해주세요.',
            help:  [
                'IC 칩 부분에 먼지·이물질이 없는지 닦아주세요',
                '카드가 휘어지거나 파손되지 않았는지 확인해주세요',
                '여러 번 실패하면 다른 카드나 결제 수단을 이용해주세요'
            ],
            retry: 'ic'
        },
        declined: {
            pill: 'E-003 · 승인 거절',
            title: '카드 결제가 거절되었어요',
            desc:  '카드사로부터 승인이 거절되었습니다. 한도 초과·정지·카드사 정책 등의 원인이 있을 수 있어요. 카드사에 문의하거나 다른 결제 수단을 이용해주세요.',
            help:  [
                '카드 한도 또는 잔액을 확인해주세요',
                '카드 유효기간이 지나지 않았는지 확인해주세요',
                '문제 지속 시 카드사 고객센터로 문의해주세요'
            ],
            retry: null
        },
        vein_timeout: {
            pill: 'V-001 · 시간초과',
            title: '정맥 인식 시간이 초과되었어요',
            desc:  '센서 위에 손바닥을 올려주시지 않아 인증이 종료되었습니다. 다시 시도하거나 다른 결제 수단을 선택해주세요.',
            help:  [
                '센서 위 약 15cm 높이에 손바닥을 펴서 올려주세요',
                '손바닥이 센서와 평행하도록 맞춰주세요',
                '주변 조명이 너무 밝으면 가려주세요'
            ],
            retry: 'vein'
        },
        vein_unregistered: {
            pill: 'V-002 · 미등록',
            title: '등록되지 않은 정맥이에요',
            desc:  '현재 키오스크에 등록된 정맥 정보와 일치하지 않습니다. 카운터에서 등록을 진행하거나 다른 결제 수단을 이용해주세요.',
            help:  [
                '정맥 결제는 사전 등록이 필요한 회원 전용 기능입니다',
                '카운터(또는 모바일 앱)에서 정맥을 등록해주세요',
                '오늘은 다른 결제 수단으로 진행해주세요'
            ],
            retry: null
        }
    };

    const DEFAULT_REASON = {
        pill: 'E-000 · 결제 실패',
        title: '결제에 실패했어요',
        desc:  '일시적인 오류가 발생했어요. 잠시 후 다시 시도하거나 다른 결제 수단을 선택해주세요.',
        help:  [
            '네트워크 상태를 확인해주세요',
            '다시 시도해도 실패하면 다른 결제 수단을 이용해주세요',
            '계속 실패하면 카운터로 문의해주세요'
        ],
        retry: null
    };

    /* ---------- Render ---------- */
    function renderStoreAndTotal() {
        const storeName = sessionStorage.getItem(STORE_KEY) || '상록원';
        if (storeEl) storeEl.textContent = storeName;

        const cart = loadCart();
        const totalPrice = cart.reduce((s, it) => s + (it.qty || 0) * (it.price || 0), 0);
        if (totalEl) totalEl.textContent = fmtWon(totalPrice);
    }

    function renderReason(config) {
        if (pillEl)  pillEl.textContent  = config.pill;
        if (titleEl) titleEl.textContent = config.title;
        if (descEl)  descEl.textContent  = config.desc;

        if (helpListEl) {
            helpListEl.innerHTML = '';
            config.help.forEach((txt) => {
                const li = document.createElement('li');
                li.textContent = txt;
                helpListEl.appendChild(li);
            });
        }

        const canRetry = !!config.retry;
        if (ctaRowEl) {
            ctaRowEl.classList.toggle('p06__cta-row--single', !canRetry);
        }
        if (retryEl) {
            retryEl.style.display = canRetry ? '' : 'none';
        }
    }

    /* ---------- Navigation ---------- */
    function goSwitch() {
        location.href = '/flowP/P02-payment.html';
    }

    function goRetry(retryTarget) {
        if (retryTarget === 'vein') {
            location.href = '/flowP/P03-vein.html';
        } else if (retryTarget === 'ic') {
            location.href = '/flowP/P04-processing.html';
        } else {
            goSwitch();
        }
    }

    function clearFlowSession() {
        try { FLOW_KEYS_TO_CLEAR.forEach((k) => sessionStorage.removeItem(k)); }
        catch (_) {}
    }

    function goHome() {
        clearFlowSession();
        location.href = '/index.html';
    }

    /* ---------- Boot ---------- */
    try { sessionStorage.setItem(STATUS_KEY, 'failed'); } catch (_) {}

    const code = getQuery('reason');
    const config = REASONS[code] || DEFAULT_REASON;

    renderStoreAndTotal();
    renderReason(config);

    /* ---------- Events ---------- */
    if (backEl) {
        backEl.addEventListener('click', () => {
            if (history.length > 1) history.back();
            else goSwitch();
        });
    }
    if (switchEl) switchEl.addEventListener('click', goSwitch);
    if (retryEl)  retryEl.addEventListener('click', () => goRetry(config.retry));
    if (homeEl)   homeEl.addEventListener('click', goHome);
})();
