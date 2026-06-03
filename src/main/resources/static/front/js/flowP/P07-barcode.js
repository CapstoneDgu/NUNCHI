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

    /* ---------- 아바타 음성 안내 — 상태별 멘트 ---------- */
    const AVATAR_GUIDE = {
        waiting: '카카오페이 바코드를 스캐너에 비춰주세요.',
        success: '결제가 완료됐어요.'
    };

    /* ---------- State setter ---------- */
    function setState(nextState) {
        clearAllTimers();
        sectionEl.dataset.state = nextState;

        const copy = COPY[nextState] || COPY.waiting;
        if (titleEl) titleEl.innerHTML = copy.title;
        if (descEl)  descEl.textContent = copy.desc;

        if (window.AvatarGuide && AVATAR_GUIDE[nextState]) {
            window.AvatarGuide.speak(AVATAR_GUIDE[nextState]);
        }

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

    /* ---------- Scanning ----------
       실제 바코드 스캐너(HID) 는 키보드처럼 동작한다: 손님 폰의 결제 바코드를 읽으면
       숫자(또는 영숫자) 를 아주 빠르게 연타한 뒤 Enter(개행) 로 끝낸다.
       → keydown 을 버퍼링해 "빠른 연타 + Enter" 패턴이면 스캔으로 간주하고 즉시 결제 확정.
       사람이 키보드로 천천히 누르는 입력은 무시(간격이 길면 버퍼 리셋)해 오작동을 막는다.
       데모/단말 미연결 환경을 위해 자동 진행 타이머도 함께 둔다(실 스캔이 들어오면 타이머는 취소). */
    const SCAN = {
        buf: '',
        lastTs: 0,
        CHAR_GAP_MS: 60,   // 이 간격보다 빠른 연속 입력만 스캐너로 인정
        MIN_LEN: 6,        // 바코드 최소 자릿수
        done: false,
    };

    function onScannerKey(e) {
        if (SCAN.done) return;
        const now = performance.now();

        // Enter/Tab = 스캔 종료 신호
        if (e.key === 'Enter' || e.key === 'Tab') {
            if (SCAN.buf.length >= SCAN.MIN_LEN) {
                e.preventDefault();
                const code = SCAN.buf;
                SCAN.buf = '';
                acceptScan(code);
            } else {
                SCAN.buf = '';
            }
            return;
        }

        // 한 글자(바코드는 보통 숫자/영숫자) 만 버퍼링
        if (e.key && e.key.length === 1) {
            // 직전 입력과의 간격이 길면(사람 타이핑) 버퍼 리셋 후 새로 시작
            if (now - SCAN.lastTs > SCAN.CHAR_GAP_MS) SCAN.buf = '';
            SCAN.lastTs = now;
            SCAN.buf += e.key;
            // Enter 를 안 보내는 스캐너 대비: 충분히 길어지면 잠시 후 자동 확정
            clearTimeout(SCAN._flush);
            SCAN._flush = setTimeout(() => {
                if (!SCAN.done && SCAN.buf.length >= SCAN.MIN_LEN) {
                    const code = SCAN.buf;
                    SCAN.buf = '';
                    acceptScan(code);
                }
            }, 120);
        }
    }

    // 유효 바코드 스캔 수신 → 실패 강제 쿼리 우선, 아니면 그 값으로 결제 확정
    function acceptScan(code) {
        if (SCAN.done) return;
        SCAN.done = true;
        clearAllTimers();
        setProgress(100);
        const forced = getQuery('result');
        if (forced === 'fail') {
            try { sessionStorage.setItem(STATUS_KEY, 'failed'); } catch (_) {}
            location.href = '/fail?reason=barcode_error';
            return;
        }
        finalizeBarcodePayment(code);
    }

    function startScanning() {
        setProgress(0);
        SCAN.done = false;
        SCAN.buf = '';

        // 데모 모드(?demo=1): 스캐너 없이 동작 확인용 — 2.5s 뒤 자동 성공.
        // 실제 운영: 스캐너 스캔(onScannerKey→acceptScan)이 들어올 때까지 대기하고,
        //            일정 시간 무스캔이면 타임아웃 실패 처리(가짜 성공 금지 — QA R2-2 실제 결제).
        const demo = getQuery('demo') === '1';

        if (demo) {
            const DURATION = 2500;
            const startTs = performance.now();
            const tick = (now) => {
                setProgress(Math.min(100, ((now - startTs) / DURATION) * 100));
                if (now - startTs < DURATION) progressRaf = requestAnimationFrame(tick);
            };
            progressRaf = requestAnimationFrame(tick);
            scanTimer = setTimeout(() => {
                if (getQuery('result') === 'fail') {
                    try { sessionStorage.setItem(STATUS_KEY, 'failed'); } catch (_) {}
                    location.href = '/fail?reason=barcode_error';
                    return;
                }
                finalizeBarcodePayment();   // 데모 — 임의 바코드로 확정
            }, DURATION);
            return;
        }

        // 실제 스캔 대기 — 프로그레스는 "스캔 대기 중" 을 부드럽게 반복 표시
        let dir = 1, pct = 0;
        const sweep = () => {
            pct += dir * 1.4;
            if (pct >= 90) { pct = 90; dir = -1; }
            else if (pct <= 10) { pct = 10; dir = 1; }
            setProgress(pct);
            progressRaf = requestAnimationFrame(sweep);
        };
        progressRaf = requestAnimationFrame(sweep);

        // 무스캔 타임아웃 — 45초 동안 스캔이 없으면 실패 화면으로 (멈춤 방지)
        const SCAN_TIMEOUT_MS = 45000;
        scanTimer = setTimeout(() => {
            if (SCAN.done) return;
            SCAN.done = true;
            clearAllTimers();
            try { sessionStorage.setItem(STATUS_KEY, 'failed'); } catch (_) {}
            location.href = '/fail?reason=timeout';
        }, SCAN_TIMEOUT_MS);
    }

    /* ---------- 백엔드 결제 확정 ----------
       바코드는 백엔드 payByBarcode 가 confirmOrder 완료 후 즉시 SUCCESS 결제 레코드를 만든다.
       그래서 IC/정맥과 달리 markSuccess 별도 호출 불필요.
       1) POST /api/orders/confirm   → orderId
       2) POST /api/payments/barcode → paymentId (이미 SUCCESS 상태)
       3) orderSummary 저장 → setState('success') → /complete */
    let finalizing = false;
    async function finalizeBarcodePayment(scannedCode) {
        if (finalizing) return;
        finalizing = true;
        document.removeEventListener('keydown', onScannerKey, true);

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
                    orderId:     order.orderId,
                    orderType:   order.orderType,                 // DINE_IN / TAKEOUT (영수증 표기)
                    totalAmount: order.totalAmount,
                    itemCount:   (order.items || []).length,
                    firstName:   (order.items && order.items[0] && order.items[0].menuName) || '',
                    totalQty:    (order.items || []).reduce((s, it) => s + (it.quantity || 0), 0),
                    items:       order.items || [],               // 영수증 품목 명세 (QA R2-3)
                }));
            } catch (_) {}

            // 실제 스캔 값이 있으면 그 값으로, 없으면(데모/폴백) 임의 13자리.
            // 백엔드 payByBarcode 는 값 검증 없이 SUCCESS 처리한다.
            const barcodeValue = (scannedCode && String(scannedCode).trim())
                ? String(scannedCode).trim()
                : String(Date.now()).slice(-13);
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

    // HID 바코드 스캐너 입력 수신 (캡처 단계 — 다른 핸들러보다 먼저 가로챔)
    document.addEventListener('keydown', onScannerKey, true);

    window.addEventListener('beforeunload', () => {
        clearAllTimers();
        document.removeEventListener('keydown', onScannerKey, true);
    });

    /* ---------- Boot ---------- */
    renderStoreName();
    try { sessionStorage.setItem(METHOD_KEY, 'barcode'); } catch (_) {}

    const initial = getQuery('state');
    if (initial && COPY[initial]) {
        setState(initial);
    } else {
        setState('waiting');
    }

    // ---------- 음성 컨트롤 ----------
    if (window.VoiceController) {
        window.VoiceController.init({
            getSessionId: getSessionId,
            mode: 'NORMAL',
            onAiReply: (data) => console.log('[P07] AI reply:', data && data.reply),
        });
    }
})();
