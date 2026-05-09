// ========================================================
// A01-avatar.js — 아바타 모드(동대맘) 통합 로직 (FastAPI 연결 + 턴테이킹)
//
// 흐름:
//   1) 진입: Spring 세션 생성(POST /api/sessions, mode=AVATAR) + FastAPI 세션 생성(POST /ai/order/start)
//   2) 대기 화면: FastAPI greeting 을 typewriter 로 노출
//   3) 마이크 클릭: ConvEngine.start() → enterState('opening')
//   4) 사용자 발화 → POST /ai/order/chat → reply 발화
//   5) reply 키워드(ReplyKeywords)로 카트 갱신/완료 라우팅 분기
//   6) 정상 모드 전환 → PATCH /api/sessions/{id}/complete
//
// 의존:
//   - window.Api          (api.js)              — Spring + FastAPI 호출
//   - window.ReplyKeywords(reply-keywords.js)   — reply 후처리
//   - window.ConvEngine   (conversation-engine.js)
//
// 세션 키:
//   sessionId    — Spring Long ID (P-flow 호환, 메시지/카트/주문)
//   aiSessionId  — FastAPI 세션 ID (대화 흐름)
//   cart, currentStep, mode, dineOption, orderId, currentStoreName
// ========================================================

(function () {
    'use strict';

    // ========================================================
    // 1. 상수 / 시나리오 스크립트
    // ========================================================
    const SCRIPTS = {
        recommend: {
            picked: (name) => `좋은 선택이에요! "${name}" 담아드릴게요.`
        },
        addmore: {
            ask: "더 담으실 메뉴가 있을까요?"
        },
        confirm: {
            empty: "아직 담은 메뉴가 없어요. 한 가지만 골라볼까요?"
        }
    };

    const STEP_ORDER = ['opening', 'recommend', 'addmore', 'confirm'];

    // FastAPI chat 응답 지연 토스트 임계
    const SLOW_REPLY_MS = 5000;

    // ========================================================
    // 2. 상태
    // ========================================================
    const state = {
        fsm: 'opening',
        sessionId: null,            // Spring Long sessionId
        aiSessionId: null,          // FastAPI session_id
        bootGreeting: null,         // FastAPI 첫 인사말
        cart: { items: [], totalAmount: 0 },
        chatLog: [],
        avatarMode: 'idle',
        muted: false,
        speechAbort: null,
        engineStarted: false,
        greetedOnBoot: false,
        currentAudio: null,         // 재생 중인 TTS Audio 객체
        currentAudioUrl: null       // revokeObjectURL 대상
    };

    // ========================================================
    // 3. DOM 캐시
    // ========================================================
    const $videos      = document.querySelectorAll('[data-avatar]');
    const $videoIdle   = document.querySelector('[data-avatar="idle"]');
    const $videoTalk   = document.querySelector('[data-avatar="talking"]');
    const $waveform    = document.querySelector('[data-waveform]');
    const $bubble      = document.querySelector('[data-bubble]');
    const $bubbleText  = document.querySelector('[data-bubble-text]');

    const $stepsList   = document.querySelector('[data-steps]');
    const $log         = document.querySelector('[data-log]');

    const $minicartEmpty  = document.querySelector('[data-minicart-empty]');
    const $minicartFilled = document.querySelector('[data-minicart-filled]');
    const $minicartList   = document.querySelector('[data-minicart-list]');
    const $minicartTotal  = document.querySelector('[data-minicart-total]');

    const $chipRow     = document.querySelector('[data-chip-row]');
    const $input       = document.querySelector('[data-input]');
    const $sendBtn     = document.querySelector('[data-action="send"]');
    const $micBtn      = document.querySelector('[data-action="toggle-mic"]');
    const $muteBtn     = document.querySelector('[data-action="toggle-mute"]');
    const $switchBtn   = document.querySelector('[data-action="switch-normal"]');

    // ========================================================
    // 4. 유틸
    // ========================================================
    function fmtPrice(won) {
        return "₩ " + Number(won || 0).toLocaleString("ko-KR");
    }

    function getCartCount() {
        return state.cart.items.reduce((s, it) => s + (it.quantity || 0), 0);
    }

    function getCartTotal() {
        return state.cart.totalAmount || 0;
    }

    /** API 호출 래퍼 — 에러 토스트 + 로그. 호출부는 try/catch 없이 await 가능. */
    async function callApi(label, fn) {
        try {
            return await fn();
        } catch (e) {
            const msg = (e && e.message) || (e && e.msg) || '요청 실패';
            console.warn(`[A01] ${label} 실패`, e);
            showToast(`${label}: ${msg}`);
            return null;
        }
    }

    /** S02-dine 의 dineOption 을 OrderType ('DINE_IN'/'TAKEOUT') 로 변환.
     *  Spring/FastAPI 모두 동일 enum 사용. */
    function resolveOrderType() {
        return sessionStorage.getItem('dineOption') === 'take_out' ? 'TAKEOUT' : 'DINE_IN';
    }

    // ========================================================
    // 5. 세션 영속 — Spring 세션
    // ========================================================
    /**
     * sessionStorage 의 sessionId 가 양의 정수인지 엄격 검사.
     * mock 잔재('a01-...') 또는 소수, 음수, 0 은 폐기.
     */
    function readStoredSessionId() {
        const raw = sessionStorage.getItem('sessionId');
        if (!raw) return null;
        if (!/^[1-9][0-9]*$/.test(raw)) return null;
        const n = Number(raw);
        if (!Number.isInteger(n) || n <= 0 || !Number.isSafeInteger(n)) return null;
        return n;
    }

    /**
     * 저장된 세션 ID 가 서버에 실제로 존재하는지 가벼운 ping 으로 검증.
     * 별도 GET /sessions/{id} 엔드포인트가 없어 tool-logs 조회로 대체.
     */
    async function verifyStoredSession(sessionId) {
        try {
            await window.Api.session.getToolLogs(sessionId, 1);
            return true;
        } catch (e) {
            return false;
        }
    }

    async function loadOrCreateSpringSession() {
        const stored = readStoredSessionId();
        if (stored) {
            const ok = await verifyStoredSession(stored);
            if (ok) {
                state.sessionId = stored;
                return;
            }
            sessionStorage.removeItem('sessionId');
        }
        const res = await callApi('Spring 세션 생성', () =>
            window.Api.session.create({
                mode: 'AVATAR',
                language: 'ko',
                orderType: resolveOrderType()
            })
        );
        if (res && res.sessionId) {
            state.sessionId = res.sessionId;
            sessionStorage.setItem('sessionId', String(res.sessionId));
        }
    }

    // ========================================================
    // 5b. 세션 영속 — FastAPI 세션
    // ========================================================
    async function startAiSession() {
        const res = await callApi('AI 세션 시작', () =>
            window.Api.Ai.start({
                mode: 'AVATAR',
                language: 'ko',
                order_type: resolveOrderType()
            })
        );
        if (res && res.session_id != null) {
            state.aiSessionId = res.session_id;
            sessionStorage.setItem('aiSessionId', String(res.session_id));
            state.bootGreeting = res.greeting || null;
            return true;
        }
        return false;
    }

    /** 서버 카트를 P-flow 호환 sessionStorage 형태로 캐시. */
    function persistCartCache() {
        try {
            const compat = state.cart.items.map((it) => ({
                id:        it.itemId,
                menuId:    it.menuId,
                name:      it.menuName,
                price:     it.unitPrice,
                qty:       it.quantity,
                itemTotal: it.itemTotal
            }));
            sessionStorage.setItem('cart', JSON.stringify(compat));
        } catch (e) {
            console.warn('[A01] 카트 캐시 실패', e);
        }
    }

    // ========================================================
    // 7. 아바타 비디오 cross-fade
    // ========================================================
    function setAvatar(mode) {
        if (state.avatarMode === mode) return;
        state.avatarMode = mode;
        if (mode === 'talking') {
            $videoTalk.classList.add('is-active');
            $videoIdle.classList.remove('is-active');
            try { $videoTalk.currentTime = 0; $videoTalk.play(); } catch (_) {}
            $waveform.classList.add('is-active');
        } else {
            $videoIdle.classList.add('is-active');
            $videoTalk.classList.remove('is-active');
            try { $videoIdle.play(); } catch (_) {}
            $waveform.classList.remove('is-active');
        }
    }

    // ========================================================
    // 8. AI 발화 (typewriter + 백엔드 메시지 로깅)
    // ========================================================
    function sleep(ms, signal) {
        return new Promise((resolve, reject) => {
            if (signal && signal.aborted) {
                reject(new DOMException('aborted', 'AbortError'));
                return;
            }
            const t = setTimeout(resolve, ms);
            if (signal) {
                signal.addEventListener('abort', () => {
                    clearTimeout(t);
                    reject(new DOMException('aborted', 'AbortError'));
                }, { once: true });
            }
        });
    }

    async function typewriter(text, opts) {
        const speed  = (opts && opts.speed) || 50;
        const signal = opts && opts.signal;
        $bubble.classList.add('is-typing', 'is-visible');
        $bubbleText.textContent = '';
        try {
            for (let i = 0; i < text.length; i++) {
                if (signal && signal.aborted) return;
                const ch = text[i];
                $bubbleText.textContent += ch;
                if (',.!?…'.includes(ch)) {
                    await sleep(220, signal);
                } else if (ch === ' ') {
                    await sleep(speed * 0.5, signal);
                } else {
                    await sleep(speed, signal);
                }
            }
        } finally {
            $bubble.classList.remove('is-typing');
        }
    }

    /** 재생 중인 TTS 오디오 정리. */
    function stopCurrentAudio() {
        if (state.currentAudio) {
            try { state.currentAudio.pause(); } catch (_) {}
            state.currentAudio = null;
        }
        if (state.currentAudioUrl) {
            try { URL.revokeObjectURL(state.currentAudioUrl); } catch (_) {}
            state.currentAudioUrl = null;
        }
    }

    /** Google TTS 호출 후 fire-and-forget 으로 Audio 재생 시작. */
    function startTtsPlayback(text, signal) {
        if (state.muted) return;
        if (!window.Api || !window.Api.Voice) return;
        // 이전 재생은 정리
        stopCurrentAudio();
        window.Api.Voice.synthesize(text)
            .then((blob) => {
                if (!blob) return;
                if (signal && signal.aborted) return;
                const url = URL.createObjectURL(blob);
                const audio = new Audio(url);
                audio.muted = state.muted;
                state.currentAudio = audio;
                state.currentAudioUrl = url;
                audio.addEventListener('ended', () => {
                    if (state.currentAudio === audio) stopCurrentAudio();
                });
                audio.play().catch((e) => {
                    console.warn('[A01] TTS 재생 실패', e);
                });
                if (signal) {
                    signal.addEventListener('abort', () => {
                        if (state.currentAudio === audio) stopCurrentAudio();
                    }, { once: true });
                }
            })
            .catch((e) => {
                console.warn('[A01] TTS 합성 실패', e);
            });
    }

    async function aiSpeak(text, signal) {
        if (signal && signal.aborted) return;

        appendLog('ai', text);
        if (state.sessionId) {
            window.Api.session
                .saveMessage(state.sessionId, { role: 'ASSISTANT', text })
                .catch(() => {});
        }

        // typewriter 와 TTS 음성 재생 병행
        startTtsPlayback(text, signal);

        setAvatar('talking');
        try {
            await typewriter(text, { speed: 48, signal });
            await sleep(450, signal);
        } catch (e) {
            if (!e || e.name !== 'AbortError') throw e;
        } finally {
            setAvatar('idle');
        }
    }

    function userSay(text, opts) {
        const t = (text || '').trim();
        if (!t) return;
        appendLog('user', t);
        if (state.sessionId) {
            window.Api.session
                .saveMessage(state.sessionId, { role: 'USER', text: t })
                .catch(() => {});
        }
        if (!opts || !opts.silent) {
            handleUserUtterance(t);
        }
    }

    // ========================================================
    // 9. 대화 로그 + 메뉴 카드 렌더
    // ========================================================
    function appendLog(role, text) {
        state.chatLog.push({ role, text, ts: Date.now() });
        const $msg = document.createElement('div');
        $msg.className = 'a01__msg a01__msg--' + role;
        $msg.textContent = text;
        $log.appendChild($msg);
        scrollLogToBottom();
    }

    function scrollLogToBottom() {
        requestAnimationFrame(() => { $log.scrollTop = $log.scrollHeight; });
    }

    /**
     * AI 발화 헬퍼 — ConvEngine 활성 시엔 ConvEngine.say (바지인 가능),
     * 비활성 시엔 직접 aiSpeak.
     */
    function aiSpeakChained(text) {
        if (state.engineStarted && window.ConvEngine && window.ConvEngine.isActive()) {
            return window.ConvEngine.say(text);
        }
        const sig = state.speechAbort && state.speechAbort.signal;
        return aiSpeak(text, sig);
    }

    // ========================================================
    // 10. FSM — 단계 인디케이터/UI 용 골격만 유지
    //     본문은 단순화 (FastAPI 가 의도 분류/응답 책임)
    // ========================================================
    function enterState(name) {
        if (!STEP_ORDER.includes(name)) return;
        if (state.speechAbort) {
            try { state.speechAbort.abort(); } catch (_) {}
        }
        state.speechAbort = new AbortController();
        const signal = state.speechAbort.signal;

        state.fsm = name;
        renderSteps();
        renderChips();

        let runner;
        switch (name) {
            case 'opening':   runner = runOpening;   break;
            case 'recommend': runner = runRecommend; break;
            case 'addmore':   runner = runAddmore;   break;
            case 'confirm':   runner = runConfirm;   break;
            default: return;
        }
        runner(signal).then(() => {
            if (signal.aborted) return;
            if (state.engineStarted && window.ConvEngine && window.ConvEngine.isActive()) {
                window.ConvEngine.endTurn();
            }
        }).catch((e) => {
            if (!e || e.name !== 'AbortError') console.warn('[A01] FSM runner error', e);
        });
    }

    async function runOpening(signal) {
        if (state.greetedOnBoot) return;
        if (state.bootGreeting) await aiSpeak(state.bootGreeting, signal);
    }

    async function runRecommend(signal) {
        // FastAPI 가 reply 로 추천을 직접 발화. 단계만 유지.
    }

    async function runAddmore(signal) {
        // FastAPI 위임. 단계만 유지.
    }

    async function runConfirm(signal) {
        if (getCartCount() === 0) {
            await aiSpeak(SCRIPTS.confirm.empty, signal);
        }
    }

    // ========================================================
    // 11. 사용자 발화 → FastAPI chat → reply 발화 + 후처리
    // ========================================================
    async function handleUserUtterance(text) {
        if (state.aiSessionId == null) {
            // FastAPI 세션이 없으면 reply 받을 수 없음 — 토스트만
            showToast('AI 세션이 없어요. 새로고침 해주세요.');
            if (state.engineStarted && window.ConvEngine.isActive()) window.ConvEngine.endTurn();
            return;
        }

        // 5초 지연 토스트
        let slowTimer = setTimeout(() => {
            slowTimer = null;
            showToast('잠시만요...');
        }, SLOW_REPLY_MS);

        const res = await callApi('AI 응답', () =>
            window.Api.Ai.chat({
                session_id: state.aiSessionId,
                text
            })
        );

        if (slowTimer) { clearTimeout(slowTimer); slowTimer = null; }

        if (!res || !res.reply) {
            // 폴백 멘트 추가 금지 — 청취만 재개
            if (state.engineStarted && window.ConvEngine.isActive()) window.ConvEngine.endTurn();
            return;
        }

        await aiSpeakChained(res.reply);

        // reply 후처리
        const reply = res.reply;
        if (window.ReplyKeywords && window.ReplyKeywords.replyHasCartChange(reply)) {
            await refreshCart();
        }
        if (window.ReplyKeywords && window.ReplyKeywords.replyHasComplete(reply)) {
            await goToPayment();
            return;
        }

        if (state.engineStarted && window.ConvEngine.isActive()) window.ConvEngine.endTurn();
    }

    // ========================================================
    // 12. 카트 (백엔드 동기화)
    // ========================================================
    async function refreshCart() {
        if (!state.sessionId) return;
        const result = await callApi('장바구니 조회', () =>
            window.Api.cart.get(state.sessionId)
        );
        if (result) applyCartResponse(result);
    }

    function applyCartResponse(cartResp) {
        state.cart = {
            items: cartResp.items || [],
            totalAmount: cartResp.totalAmount || 0
        };
        persistCartCache();
        renderMinicart();
    }

    function renderMinicart() {
        if (!state.cart.items.length) {
            $minicartEmpty.hidden = false;
            $minicartFilled.hidden = true;
            return;
        }
        $minicartEmpty.hidden = true;
        $minicartFilled.hidden = false;
        $minicartList.innerHTML = '';
        state.cart.items.forEach((it) => {
            const $li = document.createElement('li');
            $li.className = 'a01__minicart-item';
            $li.innerHTML = ''
                + '<span class="a01__minicart-item-name"></span>'
                + '<span class="a01__minicart-item-qty">×' + (it.quantity || 1) + '</span>';
            const display = it.menuName || '';
            $li.querySelector('.a01__minicart-item-name').textContent =
                display.length > 10 ? display.slice(0, 10) + '…' : display;
            $minicartList.appendChild($li);
        });
        $minicartTotal.textContent = fmtPrice(getCartTotal());
    }

    // ========================================================
    // 13. 빠른응답 칩 — 매장/포장 chip 제거 (S02-dine 에서 이미 결정)
    // ========================================================
    const CHIPS = {
        opening:   [
            { label: '추천해줘',    text: '추천해주세요' }
        ],
        recommend: [
            { label: '추천해줘',    text: '추천해주세요' },
            { label: '매콤한 거',   text: '매콤한 메뉴 추천해주세요' },
            { label: '가벼운 거',   text: '가볍게 먹을 거 추천해주세요' }
        ],
        addmore:   [
            { label: '하나 더',     text: '하나 더 추천해주세요' },
            { label: '충분해요',    text: '충분해요. 결제할게요', cta: true }
        ],
        confirm:   [
            { label: '결제할래요',  text: '결제할게요', cta: true },
            { label: '수정할게요',  text: '수정할래요' }
        ]
    };

    function renderChips() {
        $chipRow.innerHTML = '';
        const list = CHIPS[state.fsm] || [];
        list.forEach((c) => {
            const $btn = document.createElement('button');
            $btn.type = 'button';
            $btn.className = 'a01__chip' + (c.cta ? ' a01__chip--cta' : '');
            $btn.textContent = c.label;
            $btn.addEventListener('click', () => userSay(c.text));
            $chipRow.appendChild($btn);
        });
    }

    // ========================================================
    // 14. 단계 인디케이터
    // ========================================================
    function renderSteps() {
        const idx = STEP_ORDER.indexOf(state.fsm);
        const $steps = $stepsList.querySelectorAll('.a01__step');
        const $lines = $stepsList.querySelectorAll('.a01__step-line');
        $steps.forEach(($s, i) => {
            $s.classList.toggle('is-current', i === idx);
            $s.classList.toggle('is-done',    i <  idx);
        });
        $lines.forEach(($l, i) => {
            $l.classList.toggle('is-done', i < idx);
        });
    }

    // ========================================================
    // 15. 입력 / 액션 핸들러
    // ========================================================
    function onSendClick() {
        const v = ($input.value || '').trim();
        if (!v) return;
        $input.value = '';
        if (state.engineStarted && window.ConvEngine && window.ConvEngine.isActive()) {
            window.ConvEngine.submitText(v);
        } else {
            userSay(v);
        }
    }

    function onInputKey(e) {
        if (e.isComposing || e.keyCode === 229) return;
        if (e.key === 'Enter') onSendClick();
    }

    async function onSwitchToNormal() {
        // 모드 전환 — Spring 세션/카트는 그대로 유지. FastAPI 세션만 정리.
        // session.complete 는 결제 완료 시점에서만 호출 (모드 전환 시엔 X).
        sessionStorage.removeItem('aiSessionId');
        sessionStorage.setItem('mode', 'NORMAL');
        if (window.ConvEngine) window.ConvEngine.stop();
        location.href = '/menu';
    }

    async function goToPayment() {
        if (!state.sessionId) {
            showToast('세션이 없어요. 새로고침 해주세요.');
            return;
        }
        if (!state.cart.items.length) {
            showToast('장바구니가 비어있어요.');
            return;
        }
        const result = await callApi('주문 확정', () =>
            window.Api.order.confirm(state.sessionId)
        );
        if (!result || !result.orderId) return;
        sessionStorage.setItem('orderId', String(result.orderId));
        sessionStorage.setItem('currentStep', 'P01');
        if (window.ConvEngine) window.ConvEngine.stop();
        location.href = '/summary';
    }

    function onToggleMute() {
        state.muted = !state.muted;
        $muteBtn.setAttribute('aria-pressed', String(state.muted));
        const $icon = $muteBtn.querySelector('i');
        if (state.muted) {
            $icon.classList.remove('xi-volume-up');
            $icon.classList.add('xi-volume-mute');
            // 재생 중인 음성도 즉시 정지
            stopCurrentAudio();
        } else {
            $icon.classList.remove('xi-volume-mute');
            $icon.classList.add('xi-volume-up');
        }
        if (state.currentAudio) state.currentAudio.muted = state.muted;
    }

    // ========================================================
    // 16. 마이크 버튼 + ConvEngine 통합
    // ========================================================
    function onMicClick() {
        if (!window.ConvEngine) {
            showToast('대화 엔진을 불러오지 못했어요.');
            return;
        }
        if (!window.ConvEngine.isSupported()) {
            showToast('이 브라우저는 음성 입력을 지원하지 않아요. 텍스트로 입력해주세요.');
            $input.focus();
            return;
        }
        if (window.ConvEngine.isActive()) {
            window.ConvEngine.stop();
            return;
        }
        window.ConvEngine.start();
        state.engineStarted = true;
        enterState('opening');
    }

    function onConvModeChange(next) {
        $micBtn.classList.remove(
            'a01__btn-mic--listening',
            'a01__btn-mic--ai-turn',
            'a01__btn-mic--inactive'
        );
        if (next === 'LISTENING') {
            $micBtn.classList.add('a01__btn-mic--listening');
            $micBtn.setAttribute('aria-pressed', 'true');
            $micBtn.setAttribute('aria-label', '대화 종료');
            $input.placeholder = '듣고 있어요...';
        } else if (next === 'AI_SPEAKING') {
            $micBtn.classList.add('a01__btn-mic--ai-turn');
            $micBtn.setAttribute('aria-pressed', 'true');
            $micBtn.setAttribute('aria-label', '대화 종료 (말씀하시면 끼어들 수 있어요)');
            $input.placeholder = '동대맘이 말하고 있어요';
        } else if (next === 'THINKING') {
            $micBtn.classList.add('a01__btn-mic--ai-turn');
            $micBtn.setAttribute('aria-pressed', 'false');
            $micBtn.setAttribute('aria-label', 'AI 응답 중, 마이크 비활성');
            $input.placeholder = '잠시만요...';
        } else {
            $micBtn.classList.add('a01__btn-mic--inactive');
            $micBtn.setAttribute('aria-pressed', 'false');
            $micBtn.setAttribute('aria-label', '대화 시작');
            $input.placeholder = '동대맘에게 말하거나 입력해보세요';
        }
    }

    function onConvSilencePrompt() {
        // 3초 침묵 되물음 비활성화 — 너무 자주 끼어들어서 거슬림.
        return null;
    }

    function onConvBargeIn() {
        if (state.speechAbort) {
            try { state.speechAbort.abort(); } catch (_) {}
        }
        stopCurrentAudio();
        setAvatar('idle');
    }

    // ========================================================
    // 17. 토스트
    // ========================================================
    function showToast(msg) {
        let $t = document.querySelector('.a01__toast');
        if (!$t) {
            $t = document.createElement('div');
            $t.className = 'a01__toast';
            document.body.appendChild($t);
        }
        $t.textContent = msg;
        $t.classList.add('is-visible');
        clearTimeout(showToast._timer);
        showToast._timer = setTimeout(() => {
            $t.classList.remove('is-visible');
        }, 2400);
    }

    // ========================================================
    // 18. 부트
    // ========================================================
    function bind() {
        $sendBtn.addEventListener('click', onSendClick);
        $input.addEventListener('keydown', onInputKey);
        $switchBtn.addEventListener('click', onSwitchToNormal);
        $muteBtn.addEventListener('click', onToggleMute);
        $micBtn.addEventListener('click', onMicClick);
    }

    function bootVideos() {
        $videos.forEach(($v) => { try { $v.play(); } catch (_) {} });
    }

    document.addEventListener('DOMContentLoaded', async () => {
        sessionStorage.setItem('currentStep', 'A01');
        sessionStorage.setItem('mode', 'avatar');

        renderMinicart();
        renderSteps();
        renderChips();
        bind();
        bootVideos();

        // 의존 모듈 가드
        if (!window.Api || !window.ConvEngine) {
            showToast('필수 모듈을 불러오지 못했어요. 새로고침 해주세요.');
            return;
        }

        window.ConvEngine.init({
            speak: aiSpeak,
            onUserUtterance: userSay,
            onSilencePrompt: onConvSilencePrompt,
            onModeChange: onConvModeChange,
            onBargeIn: onConvBargeIn
        });

        onConvModeChange('INACTIVE');

        // Spring + FastAPI 세션 병렬 시작
        await Promise.all([
            loadOrCreateSpringSession(),
            startAiSession()
        ]);
        if (state.sessionId) await refreshCart();

        // 자동 청취 시작 — ConvEngine.start() 가 AI_SPEAKING 으로 진입,
        // greeting 발화 끝나면 endTurn() 으로 LISTENING 전환 (마이크 권한 팝업).
        // 사용자가 마이크 버튼으로 끄기 전까지 자동으로 듣고 끊고 응답.
        if (!window.ConvEngine.isSupported()) {
            showToast('이 브라우저는 음성 입력을 지원하지 않아요. 텍스트로 입력해주세요.');
        }
        state.engineStarted = true;
        window.ConvEngine.start();

        if (state.bootGreeting) {
            await window.ConvEngine.say(state.bootGreeting);
        }
        state.greetedOnBoot = true;
        window.ConvEngine.endTurn();
    });
})();
