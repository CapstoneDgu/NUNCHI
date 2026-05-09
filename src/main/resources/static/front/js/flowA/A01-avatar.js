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

    // (지연 토스트는 제거됨 — ConvEngine THINKING 모드 placeholder 로 표시 충분)

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
        currentAudioUrl: null,      // revokeObjectURL 대상
        // 추천 시트에서 담은 메뉴의 image_url 캐시 (menuId → url)
        // 카트 응답엔 image_url 이 없어서 추천 응답을 통해서만 채움
        menuImageCache: new Map()
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
        return AppState.get('DINE_OPTION') === 'take_out' ? 'TAKEOUT' : 'DINE_IN';
    }

    // ========================================================
    // 5. 세션 영속 — Spring 세션
    // ========================================================
    /**
     * sessionStorage 의 sessionId 가 양의 정수인지 엄격 검사.
     * mock 잔재('a01-...') 또는 소수, 음수, 0 은 폐기.
     */
    function readStoredSessionId() {
        const raw = AppState.get('SESSION_ID');
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
            AppState.remove('SESSION_ID');
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
            AppState.set('SESSION_ID', res.sessionId);
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
            AppState.set('AI_SESSION_ID', res.session_id);
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
            AppState.set('CART', compat);
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

    /**
     * Google TTS 호출 → Audio 재생.
     * @returns {Promise<number|null>} 음성 길이(초). 실패/뮤트 시 null.
     *   typewriter 속도 동기화에 사용.
     */
    function startTtsPlayback(text, signal) {
        if (state.muted) return Promise.resolve(null);
        if (!window.Api || !window.Api.Voice) return Promise.resolve(null);
        stopCurrentAudio();
        return window.Api.Voice.synthesize(text)
            .then((blob) => {
                if (!blob || (signal && signal.aborted)) return null;
                const url = URL.createObjectURL(blob);
                const audio = new Audio(url);
                audio.muted = state.muted;
                state.currentAudio = audio;
                state.currentAudioUrl = url;
                audio.addEventListener('ended', () => {
                    if (state.currentAudio === audio) stopCurrentAudio();
                });
                if (signal) {
                    signal.addEventListener('abort', () => {
                        if (state.currentAudio === audio) stopCurrentAudio();
                    }, { once: true });
                }
                // metadata 로드 후 duration 확보 + 재생 시작
                return new Promise((resolve) => {
                    const onMeta = () => {
                        audio.removeEventListener('loadedmetadata', onMeta);
                        const d = isFinite(audio.duration) ? audio.duration : null;
                        audio.play().catch((e) => console.warn('[A01] TTS 재생 실패', e));
                        resolve(d);
                    };
                    audio.addEventListener('loadedmetadata', onMeta);
                    // 1.5s 안전 타임아웃 — metadata 못 받아도 typewriter 시작
                    setTimeout(() => {
                        audio.removeEventListener('loadedmetadata', onMeta);
                        resolve(isFinite(audio.duration) ? audio.duration : null);
                    }, 1500);
                });
            })
            .catch((e) => {
                console.warn('[A01] TTS 합성 실패', e);
                return null;
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

        // TTS 시작 + duration 받아서 typewriter 속도 동기화
        const ttsPromise = startTtsPlayback(text, signal);
        setAvatar('talking');

        try {
            const duration = await ttsPromise;  // 초 단위 또는 null
            // typewriter 글자당 ms — TTS duration 으로 보정 (bias 0.95 살짝 빠르게)
            let speed = 110; // 기본값 (TTS 실패 시 한국어 평균 발화 속도)
            if (duration && duration > 0 && text.length > 0) {
                speed = Math.max(40, (duration * 1000 * 0.95) / text.length);
            }
            await typewriter(text, { speed, signal });
            await sleep(300, signal);
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

        const res = await callApi('AI 응답', () =>
            window.Api.Ai.chat({
                session_id: state.aiSessionId,
                text
            })
        );

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

        // 추천 메뉴가 응답에 포함되면 하단 시트로 표시
        if (Array.isArray(res.recommendations) && res.recommendations.length > 0) {
            openRecommendSheet(res.recommendations);
            return; // 시트 열린 동안 청취 재개 보류 — 시트 닫힐 때 endTurn
        }

        if (state.engineStarted && window.ConvEngine.isActive()) window.ConvEngine.endTurn();
    }

    /**
     * 추천 시트 열기. 카드 [담기] 시 카트 추가 + 짧은 발화.
     * [다른 거 추천] 시 자동으로 같은 의도의 발화 재시도.
     * [선택 안 함] 또는 닫기 시 청취 재개.
     */
    function openRecommendSheet(menus) {
        if (!window.RecommendSheet) {
            console.warn('[A01] RecommendSheet 모듈 미로드');
            return;
        }
        // 추천 메뉴들의 image_url 을 cache 에 미리 채워둠 — 미니카트 사진 표시용
        menus.forEach((m) => {
            const id = m.menu_id || m.menuId;
            const url = m.image_url || m.imageUrl;
            if (id != null && url) state.menuImageCache.set(id, url);
        });
        window.RecommendSheet.open({
            menus,
            onPick: async (menu) => {
                // FastAPI 추천 menu_id → Spring 카트 add
                const ok = await addToCart(menu.menu_id || menu.menuId, 1);
                if (ok) {
                    await aiSpeakChained(`${menu.name} 담아드렸어요!`);
                }
                if (state.engineStarted && window.ConvEngine.isActive()) window.ConvEngine.endTurn();
            },
            onAnother: () => {
                // 사용자가 직접 다시 추천 요청한 것처럼 처리
                handleUserUtterance('다른 거 추천해주세요');
            },
            onCancel: () => {
                // 폴백 멘트 X — 시트만 닫고 청취 재개
                if (state.engineStarted && window.ConvEngine.isActive()) window.ConvEngine.endTurn();
            }
        });
    }

    /** 카트 추가 — 작업 1 에서 제거됐던 함수 재도입 (추천 시트 onPick 용). */
    async function addToCart(menuId, qty) {
        if (!state.sessionId) {
            showToast('세션이 없어요.');
            return false;
        }
        const result = await callApi('장바구니 담기', () =>
            window.Api.cart.addItem({
                sessionId: state.sessionId,
                menuId,
                quantity: qty || 1,
                optionIds: []
            })
        );
        if (!result) return false;
        applyCartResponse(result);
        return true;
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
            const display = it.menuName || '';
            const shortName = display.length > 6 ? display.slice(0, 6) + '…' : display;
            const imgUrl = state.menuImageCache.get(it.menuId);
            const thumbHtml = imgUrl
                ? `<span class="a01__minicart-item-thumb"><img alt="" src="${imgUrl}" /></span>`
                : `<span class="a01__minicart-item-thumb a01__minicart-item-thumb--icon"><i class="xi xi-restaurant" aria-hidden="true"></i></span>`;
            $li.innerHTML = thumbHtml
                + '<span class="a01__minicart-item-name">' + shortName + '</span>'
                + '<span class="a01__minicart-item-qty">×' + (it.quantity || 1) + '</span>';
            // 이미지 onerror 폴백 → 아이콘
            const $img = $li.querySelector('img');
            if ($img) {
                $img.addEventListener('error', () => {
                    const $thumb = $li.querySelector('.a01__minicart-item-thumb');
                    $thumb.classList.add('a01__minicart-item-thumb--icon');
                    $thumb.innerHTML = '<i class="xi xi-restaurant" aria-hidden="true"></i>';
                });
            }
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
        AppState.remove('AI_SESSION_ID');
        AppState.set('MODE', 'NORMAL');
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
        AppState.set('ORDER_ID', result.orderId);
        AppState.set('CURRENT_STEP', 'P01');
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

        // 모드별 UI 상태 — 마이크 버튼 / 입력바 / 상단바 / 말풍선 힌트
        let micClass, statusText, placeholder, bubbleHint, ariaPressed, ariaLabel;
        if (next === 'LISTENING') {
            micClass = 'a01__btn-mic--listening';
            statusText = '듣고 있어요';
            placeholder = '듣고 있어요...';
            bubbleHint = '🎤 말씀해 주세요';
            ariaPressed = 'true';
            ariaLabel = '대화 종료';
        } else if (next === 'AI_SPEAKING') {
            micClass = 'a01__btn-mic--ai-turn';
            statusText = '대화 중';
            placeholder = '동대맘이 말하고 있어요';
            bubbleHint = null; // typewriter 가 직접 채움
            ariaPressed = 'true';
            ariaLabel = '대화 종료 (말씀하시면 끼어들 수 있어요)';
        } else if (next === 'THINKING') {
            micClass = 'a01__btn-mic--ai-turn';
            statusText = '생각 중';
            placeholder = '잠시만요...';
            bubbleHint = '💭 생각하고 있어요';
            ariaPressed = 'false';
            ariaLabel = 'AI 응답 중';
        } else { // INACTIVE
            micClass = 'a01__btn-mic--inactive';
            statusText = '대기';
            placeholder = '동대맘에게 말하거나 입력해보세요';
            bubbleHint = null;
            ariaPressed = 'false';
            ariaLabel = '대화 시작';
        }

        $micBtn.classList.add(micClass);
        $micBtn.setAttribute('aria-pressed', ariaPressed);
        $micBtn.setAttribute('aria-label', ariaLabel);
        $input.placeholder = placeholder;

        // 상단바 상태 텍스트 — 점은 유지, 라벨만 갱신
        const $status = document.querySelector('[data-bind="status"]');
        if ($status) {
            $status.innerHTML = '<span class="a01__topbar-status-dot"></span>' + statusText;
        }

        // 말풍선 상태 힌트 (LISTENING / THINKING 만 — AI_SPEAKING 은 typewriter 가 채움)
        if (bubbleHint) {
            $bubble.classList.add('is-visible');
            $bubble.classList.remove('is-typing');
            $bubbleText.textContent = bubbleHint;
        }
    }

    function onConvSilencePrompt() {
        // 3초 침묵 되물음 비활성화 — 너무 자주 끼어들어서 거슬림.
        return null;
    }

    /** 사용자 발화 interim(실시간 부분) — 입력바에 표시. */
    function onConvInterim(text) {
        if (!$input) return;
        if (text) {
            $input.placeholder = text + ' ...';
        } else {
            // final 시 클리어 — 모드별 placeholder 는 onConvModeChange 가 다시 세팅
            $input.placeholder = '듣고 있어요...';
        }
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
        AppState.set('CURRENT_STEP', 'A01');
        AppState.set('MODE', 'AVATAR');

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
            onInterim: onConvInterim,
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
