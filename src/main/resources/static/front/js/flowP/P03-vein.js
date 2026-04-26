/* ========================================================
   P03-vein.js — 정맥 인증 (Step 3/3 · 4상태 전환)
   states: prepare → scanning → success | fail

   자동 전환:
     prepare  (1.8s) → scanning
     scanning (3.5s + progress 0→100%) → result (default: success)
     success  (2.0s) → /flowP/P05-complete.html
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
            successTimer = setTimeout(() => {
                location.href = '/flowP/P05-complete.html';
            }, 2000);
        } else if (nextState === 'fail') {
            try { sessionStorage.setItem(STATUS_KEY, 'failed'); } catch (_) {}
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
    if (switchEl) {
        switchEl.addEventListener('click', () => {
            clearAllTimers();
            location.href = '/flowP/P02-payment.html';
        });
    }
    if (retryEl) {
        retryEl.addEventListener('click', () => {
            setState('prepare');
        });
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
