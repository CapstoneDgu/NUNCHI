// ========================================================
// A01-avatar.js — 아바타 모드(눈치) 통합 로직 (FastAPI 연결 + 턴테이킹)
//
// 흐름:
//   1) 진입: FastAPI 세션 시작(POST /ai/order/start) — FastAPI 가 Spring 에
//      세션을 생성한 뒤 동일한 sessionId 를 응답. 프론트는 단일 ID 사용.
//   2) 대기 화면: FastAPI greeting 을 typewriter 로 노출
//   3) 마이크 클릭: ConvEngine.start() → enterState('opening')
//   4) 사용자 발화 → POST /ai/order/chat → reply 발화
//   5) 응답 current_step 기반 단계 인디케이터 갱신(BROWSE/SELECT/CONFIGURE/CHECKOUT)
//      + CHECKOUT 진입 시 /summary 라우팅 (FastAPI 가 PATCH /sessions/{id}/step 으로
//      Spring 에 동기화한 단계를 chat 응답에서 echo 받는 구조)
//   6) reply 키워드(ReplyKeywords)는 카트 변경 감지 / step 누락 시 라우팅 폴백 용도
//   7) 정상 모드 전환 → PATCH /api/sessions/{id}/complete
//
// 의존:
//   - window.Api          (api.js)              — Spring + FastAPI 호출
//   - window.ReplyKeywords(reply-keywords.js)   — reply 후처리
//   - window.ConvEngine   (conversation-engine.js)
//
// 세션 키:
//   sessionId    — Spring/FastAPI 공유 단일 sessionId (FastAPI start 응답값)
//   aiSessionId  — sessionId 와 동일 값. FastAPI API 시그니처 호환 용도로 별도 보관.
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
        sessionId: null,            // Spring/FastAPI 공유 sessionId (FastAPI start 응답값)
        aiSessionId: null,          // sessionId 와 동일 값 — FastAPI 호출 시그니처 호환용
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
        menuImageCache: new Map(),
        // 추천 시트가 열려있을 때 음성 매칭에 사용할 컨텍스트
        recommendCtx: null
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

    const $log         = document.querySelector('[data-log]');

    // 대화 기록 서랍 (왼쪽 슬라이드) + 열기 FAB
    const $drawer      = document.querySelector('[data-drawer]');
    const $fab         = document.querySelector('[data-action="open-drawer"]');

    const $minicartEmpty  = document.querySelector('[data-minicart-empty]');
    const $minicartFilled = document.querySelector('[data-minicart-filled]');
    const $minicartList   = document.querySelector('[data-minicart-list]');
    const $minicartTotal  = document.querySelector('[data-minicart-total]');
    const $minicartCount  = document.querySelector('[data-minicart-count]');

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
    // 5. 세션 시작 — FastAPI 가 내부에서 Spring 세션을 생성하고
    // 동일한 sessionId 를 응답으로 돌려준다. 프론트는 이 단일 ID 를
    // Spring(미니카트/결제) 및 FastAPI(대화) 양쪽 호출에 그대로 사용.
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
            // Spring/FastAPI 가 공유하는 단일 sessionId — 두 변수에 동일 값 저장
            state.sessionId = res.session_id;
            state.aiSessionId = res.session_id;
            AppState.set('SESSION_ID', res.session_id);
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
        $bubble.classList.remove('is-thinking');   // 발화 시작 → 점점점 종료
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

    /** Append-mode typewriter — 말풍선 초기화 안 하고 한 글자씩 끝에 추가.
     *  SSE 큐 안에서 문장 단위로 호출 (이전 문장 누적된 상태 유지). */
    async function typeChunk(text, speed, signal) {
        // 발화 시작 → 점점점 종료. 스트리밍 경로는 모드가 THINKING 으로 유지되므로
        // 여기서 직접 is-thinking 을 해제하지 않으면 .a01__bubble-text 가 display:none 으로
        // 가려져 글자가 화면에 안 보임. (typewriter() 와 동일하게 해제)
        $bubble.classList.remove('is-thinking');
        for (let i = 0; i < text.length; i++) {
            if (signal && signal.aborted) return;
            $bubbleText.textContent += text[i];
            await sleep(speed, signal);
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
     * 반환 Promise 는 "재생 종료(audio.ended) / abort / 합성 실패" 시점에 resolve.
     * → 호출자(특히 ttsQueue 체인) 가 진짜로 재생 끝난 뒤 다음 단계로 진행하도록 보장.
     * → 마이크 ON(endTurn) 을 재생 도중에 켜서 STT 가 TTS echo 를 듣는 문제 방지.
     *
     * duration(초) 은 typewriter 속도 동기화에 필요 — 메타데이터 시점 즉시 opts.onMeta(d) 콜백으로 전달.
     *
     * @param {string} text
     * @param {AbortSignal} [signal]
     * @param {{onMeta?: (duration:number|null)=>void, onPlayStart?: ()=>void}} [opts]
     *   onMeta      — 메타데이터 로드 직후 (typewriter 속도 동기화용)
     *   onPlayStart — audio.play() 가 resolve 된 직후 = 실제 소리 재생 시작 시점
     *                 (talking 영상 전환 등 TTS 와 sync 되어야 할 동작)
     * @returns {Promise<void>} 재생 종료 시점에 resolve
     */
    function startTtsPlayback(text, signal, opts) {
        // 모든 경로 공통 — meta/play-start 콜백 (abort 시엔 firePlayStart 무효).
        const fireMeta = (d) => {
            if (opts && opts.onMeta) try { opts.onMeta(d); } catch (_) {}
        };
        const firePlayStart = () => {
            if (signal && signal.aborted) return;
            if (opts && opts.onPlayStart) try { opts.onPlayStart(); } catch (_) {}
        };

        if (state.muted) {
            // 무음이라도 텍스트는 보여줘야 함 → onPlayStart 즉시 발화 (typewriter 진행).
            fireMeta(null);
            firePlayStart();
            return Promise.resolve();
        }
        if (!window.Api || !window.Api.Voice) {
            fireMeta(null);
            firePlayStart();
            return Promise.resolve();
        }
        stopCurrentAudio();
        return window.Api.Voice.synthesize(text)
            .then((blob) => {
                if (!blob || (signal && signal.aborted)) {
                    fireMeta(null);
                    // blob 없음(서버 무응답) — 텍스트는 보여줘야 함. abort 시엔 자동으로 skip.
                    if (!blob) firePlayStart();
                    return;
                }
                const url = URL.createObjectURL(blob);
                const audio = new Audio(url);
                audio.muted = state.muted;
                state.currentAudio = audio;
                state.currentAudioUrl = url;

                return new Promise((resolveEnded) => {
                    let settled = false;
                    let metaTimer = null;
                    const finish = () => {
                        if (settled) return;
                        settled = true;
                        if (metaTimer) { clearTimeout(metaTimer); metaTimer = null; }
                        if (state.currentAudio === audio) stopCurrentAudio();
                        resolveEnded();
                    };

                    audio.addEventListener('ended', finish);
                    audio.addEventListener('error', (e) => {
                        console.warn('[A01] TTS audio error', e);
                        finish();
                    });
                    if (signal) {
                        signal.addEventListener('abort', finish, { once: true });
                    }

                    const onMeta = () => {
                        audio.removeEventListener('loadedmetadata', onMeta);
                        // 메타 도착 → 재생 시작. 이 후로는 audio.ended 가 종료 시그널.
                        if (metaTimer) { clearTimeout(metaTimer); metaTimer = null; }
                        if (signal && signal.aborted) { finish(); return; }
                        const d = isFinite(audio.duration) ? audio.duration : null;
                        fireMeta(d);
                        // play() resolve = 실제 재생 시작 — onPlayStart 발화
                        audio.play().then(() => {
                            firePlayStart();
                        }).catch((e) => {
                            console.warn('[A01] TTS 재생 실패', e);
                            // 재생 실패해도 텍스트는 보여줘야 함
                            firePlayStart();
                            finish();
                        });
                    };
                    audio.addEventListener('loadedmetadata', onMeta);

                    // 메타데이터 로드 실패(네트워크/디코딩 에러) 시에만 발동하는 안전망.
                    // 메타 도착 후엔 timer clear 됨 → 실제 재생 길이는 제한 없음
                    // (긴 응답도 audio.ended 까지 끝까지 재생).
                    metaTimer = setTimeout(() => {
                        if (!settled) {
                            console.warn('[A01] TTS 메타데이터 로드 타임아웃 (5s) — 강제 종료');
                            finish();
                        }
                    }, 5000);
                });
            })
            .catch((e) => {
                console.warn('[A01] TTS 합성 실패', e);
                fireMeta(null);
                firePlayStart();   // 합성 실패해도 텍스트는 보여줘야 함
            });
    }

    async function aiSpeak(text, signal) {
        if (signal && signal.aborted) return;

        appendLog('ai', text);

        // TTS 재생 시작(메타 도착) 시점에 duration 받음 → typewriter 속도 동기화
        // ttsPromise 자체는 재생 종료 시점에 resolve — typewriter 와 병렬 진행
        // onPlayStart: 실제 소리 재생 시점에 talking 영상 ON (그 전엔 idle 유지)
        let duration = null;
        const ttsPromise = startTtsPlayback(text, signal, {
            onMeta: (d) => { duration = d; },
            onPlayStart: () => setAvatar('talking'),
        });

        try {
            // typewriter 글자당 ms — TTS duration 으로 보정 (bias 0.95 살짝 빠르게)
            // duration 은 메타 도착 시점에 채워지므로, 첫 글자 출력 전 마이크로타스크 한 번 양보
            await Promise.resolve();
            let speed = 110; // 기본값 (TTS 실패 시 한국어 평균 발화 속도)
            if (duration && duration > 0 && text.length > 0) {
                speed = Math.max(40, (duration * 1000 * 0.95) / text.length);
            }
            await typewriter(text, { speed, signal });
            // 재생이 typewriter 보다 길면 끝날 때까지 대기 (마이크 ON 시점 일치)
            await ttsPromise;
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
                window.ConvEngine.rest();
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

    /**
     * Spring SessionStep enum (BROWSE/SELECT/CONFIGURE/CHECKOUT) → FSM 인디케이터 매핑.
     * 응답에 currentStep 이 있으면 사용, 없으면 reply 키워드로 추정.
     * 단계 인디케이터(기/승/전/결)만 갱신 — 발화/실행은 이미 chat 응답이 처리.
     */
    function applyStep(res) {
        let serverStep = res && (res.current_step || res.currentStep || res.step);
        if (!serverStep && window.ReplyKeywords) {
            serverStep = window.ReplyKeywords.guessStep(res && res.reply);
        }
        if (!serverStep) return;

        const STEP_MAP = {
            'BROWSE':    'opening',
            'SELECT':    'recommend',
            'CONFIGURE': 'addmore',
            'CHECKOUT':  'confirm'
        };
        const fsmStep = STEP_MAP[String(serverStep).toUpperCase()];
        if (!fsmStep || state.fsm === fsmStep) return;

        // 인디케이터 + 칩만 갱신 (runner 실행 X — chat 응답이 이미 발화 진행 중)
        state.fsm = fsmStep;
        renderSteps();
        renderChips();
    }

    // ========================================================
    // 11. 사용자 발화 → FastAPI chatStream (SSE) → 토큰 스트림 + done 후처리
    //
    // SSE 흐름:
    //   onToken : 말풍선에 즉시 append, 문장 경계(. ! ? …) 마다 TTS 큐에 push
    //   onDone  : 단계 갱신 + action / suggestions / menu_options / recommendations 처리
    //   onError : 토스트 + 청취 재개
    // OOD(clarify_responder) 응답은 token 없이 done 만 옴 → onDone 에서 reply 로 fallback TTS.
    // ========================================================
    async function handleUserUtterance(text, { silent = false } = {}) {
        if (state.aiSessionId == null) {
            showToast('AI 세션이 없어요. 새로고침 해주세요.');
            if (state.engineStarted && window.ConvEngine.isActive()) window.ConvEngine.rest();
            return;
        }

        // 빈 장바구니 + 종료/포기 의사 → /summary 로 라우팅 (FastAPI 우회).
        // (장바구니에 담긴 게 있으면 정상 흐름 유지 — FastAPI 가 결제/요약 단계로 안내)
        if (window.ReplyKeywords && window.ReplyKeywords.userWantsToQuit(text) && getCartCount() === 0) {
            console.warn('[A01] quit-gate 발동 → /summary 라우팅', {
                text,
                cartCount: getCartCount(),
                matchedQuit: window.ReplyKeywords.QUIT_PATTERN.test(text),
                hasInquiry: window.ReplyKeywords.INQUIRY_PATTERN.test(text),
            });
            if (!silent) appendLog('user', text);
            AppState.set('CURRENT_STEP', 'P01');
            navigateWithFade('/summary');   // ConvEngine.stop 포함
            return;
        }

        // 추천 시트 열려있을 때 음성을 자연어로 변환 후 시트 닫음.
        let chatText = text;
        const mapped = matchRecommendVoice(text);
        if (mapped) chatText = mapped;
        if (window.RecommendSheet && window.RecommendSheet.isOpen()) {
            window.RecommendSheet.close();
            state.recommendCtx = null;
        }

        // 터치로 들어온 직접 호출(시트 담기/추천카드/칩)은 엔진이 LISTENING(마이크 ON)인 채라,
        // 이어지는 응답 TTS 가 스피커→마이크 echo 로 되돌아와 끊긴다. 요청 전에 마이크를 끄고
        // THINKING 으로 내린다. (음성/텍스트 경로는 이미 THINKING 이라 no-op)
        if (state.engineStarted && window.ConvEngine && window.ConvEngine.isActive()
                && typeof window.ConvEngine.beginThinking === 'function') {
            window.ConvEngine.beginThinking();
        }

        // 이전 발화 abort (barge-in) + 새 signal
        if (state.speechAbort) {
            try { state.speechAbort.abort(); } catch (_) {}
        }
        state.speechAbort = new AbortController();
        const signal = state.speechAbort.signal;

        // 말풍선 초기화 — 아바타는 idle 유지. TTS 실제 재생 시작될 때 talking 으로 전환.
        $bubble.classList.add('is-visible');
        $bubble.classList.remove('is-typing');
        $bubbleText.textContent = '';

        // SSE 스트리밍 누적 상태
        let sentenceBuf = '';
        let fullText = '';
        let receivedAnyToken = false;
        let ttsQueue = Promise.resolve();
        let talkingShown = false;

        const switchToTalking = () => {
            if (talkingShown || signal.aborted) return;
            talkingShown = true;
            setAvatar('talking');
        };

        function flushTts(sentence) {
            const s = (sentence || '').trim();
            if (!s) return;
            // TTS + typewriter 동기 큐 — 직전 재생/타이핑 끝난 뒤 다음 문장 진행.
            // onPlayStart 시점에:
            //   1) talking 영상 ON (첫 호출만)
            //   2) TTS duration 기반 속도로 typewriter 시작 → 글자가 소리와 함께 노출됨
            //   3) 0.88 배율로 TTS 보다 약간 빠르게 (글자 다 보인 후 소리 살짝 더)
            ttsQueue = ttsQueue.then(async () => {
                if (signal.aborted) return;
                let duration = null;
                let typePromise = Promise.resolve();
                const playPromise = startTtsPlayback(s, signal, {
                    onMeta: (d) => { duration = d; },
                    onPlayStart: () => {
                        switchToTalking();
                        const base = (duration && duration > 0 && s.length > 0)
                            ? (duration * 1000 * 0.88) / s.length
                            : 70;   // duration 없을 때(무음/실패) 기본 속도
                        const speed = Math.max(28, Math.min(180, base));
                        typePromise = typeChunk(s, speed, signal);
                    },
                });
                await playPromise;
                await typePromise;   // 글자가 미완이면 끝까지 기다림
            }).catch((e) => {
                console.warn('[A01] TTS/typewriter 큐 실패', e);
            });
        }

        let doneRes = null;
        let errorMsg = null;

        try {
            await window.Api.Ai.chatStream(
                { session_id: state.aiSessionId, text: chatText },
                {
                    onToken(chunk) {
                        if (signal.aborted || !chunk) return;
                        receivedAnyToken = true;
                        fullText += chunk;
                        sentenceBuf += chunk;
                        // 글자는 화면에 즉시 X — flushTts 큐 안에서 TTS 와 sync 된 typewriter 가 노출.
                        // 문장 경계에 도달하면 해당 문장을 TTS + typewriter 큐에 넣음.
                        if (/[.!?…](\s|$)/.test(sentenceBuf)) {
                            flushTts(sentenceBuf);
                            sentenceBuf = '';
                        }
                    },
                    onDone(res) {
                        doneRes = res;
                        if (sentenceBuf.trim()) {
                            flushTts(sentenceBuf);
                            sentenceBuf = '';
                        }
                        // OOD(clarify_responder): 토큰 없이 done 만 — reply 로 fallback.
                        // 즉시 표시 X — flushTts 큐 안 typewriter 가 TTS 와 sync 해서 노출.
                        if (!receivedAnyToken && res && res.reply) {
                            fullText = res.reply;
                            flushTts(res.reply);
                        }
                    },
                    onError(msg) {
                        errorMsg = msg;
                    },
                }
            );
        } catch (e) {
            // 네트워크 실패 / 429 (_busy) 등
            console.warn('[A01] chatStream 실패', e);
            if (!e || !e._busy) {
                const msg = (e && e.message) || 'AI 응답을 받지 못했어요.';
                showToast(msg);
            }
            setAvatar('idle');
            if (state.engineStarted && window.ConvEngine.isActive()) window.ConvEngine.rest();
            return;
        }

        // 백엔드 error 이벤트
        if (errorMsg) {
            showToast(errorMsg);
            appendLog('ai', errorMsg);
            ttsQueue.then(() => setAvatar('idle'));
            if (state.engineStarted && window.ConvEngine.isActive()) window.ConvEngine.rest();
            return;
        }

        // done 없음 또는 빈 응답 — 폴백 멘트 추가 금지, 청취만 재개
        if (!doneRes || (!fullText && !(doneRes && doneRes.reply))) {
            setAvatar('idle');
            if (state.engineStarted && window.ConvEngine.isActive()) window.ConvEngine.rest();
            return;
        }

        console.log('[A01] chatStream done:', doneRes);
        console.log('[A01] current_step:', doneRes.current_step, '| currentStep:', doneRes.currentStep, '| step:', doneRes.step);

        const reply = doneRes.reply || fullText;
        appendLog('ai', reply);

        // 단계 인디케이터 갱신 — CHECKOUT 진입 감지를 위해 prev fsm 저장
        const prevFsm = state.fsm;
        applyStep(doneRes);
        const enteredCheckout = state.fsm === 'confirm' && prevFsm !== 'confirm';
        console.log('[A01] step 분석:', {
            prevFsm,
            currFsm: state.fsm,
            enteredCheckout,
            replyComplete: !!(window.ReplyKeywords && window.ReplyKeywords.replyHasComplete(reply))
        });

        // AI 화면 원격조작
        // navigate(예: 결제 화면 이동)는 아바타 발화를 끝까지 들려준 뒤 0.7초 텀을 두고 이동
        // — 빈 카트에서 "결제할래" 시 휙 넘어가던 문제 방지. 그 외 액션은 즉시 처리.
        if (window.AiAction && doneRes.action) {
            const act = doneRes.action;
            if (act.type === 'navigate' && act.page) {
                await ttsQueue.catch(() => {});       // 발화 끝까지 대기
                try {
                    await sleep(700, signal);          // 마무리 텀
                } catch (_) {
                    return;                            // 도중 barge-in/abort → 이동 취소
                }
                navigateWithFade(act.page);            // 페이드 전환으로 이동
                return;
            }
            window.AiAction.handle(act);
        }

        // 매 턴 카트 재조회 — AI 가 서버사이드(MCP 툴)로 담거나 뺐을 수 있으므로
        // 응답 문구와 무관하게 항상 Spring 카트를 다시 가져와 미니카트를 동기화한다.
        // (이전엔 reply 키워드 "담았어요" 등에 의존 → "담겼어요"·"추가했어요" 같은 표현은
        //  누락돼 서버엔 담겼는데 미니카트가 안 바뀌던 문제. 카트 GET 은 가벼워 항상 호출 OK)
        await refreshCart();

        // 결제 라우팅 — CHECKOUT 진입 또는 완료 키워드
        // 아바타가 마지막 말을 끝까지 들려준 뒤(TTS 큐 완료), 0.7초 텀을 두고 결제 화면으로.
        // (말 도중에 화면이 휙 넘어가지 않도록 — 자연스러운 마무리)
        const replyComplete = window.ReplyKeywords && window.ReplyKeywords.replyHasComplete(reply);
        if (enteredCheckout || replyComplete) {
            await ttsQueue.catch(() => {});       // 발화 끝까지 대기
            try {
                await sleep(700, signal);          // 마무리 텀
            } catch (_) {
                return;                            // 도중 barge-in/abort → 이동 취소
            }
            await goToPayment();
            return;
        }

        // suggestions 칩 갱신
        renderChips(doneRes.suggestions);

        // TTS 큐 끝나면 아바타 idle + 청취 재개.
        // 400ms 잔향/차분 가드: 스피커 음향이 마이크로 되돌아오는 echo 안정화 + 턴 사이 텀.
        // (abort 시엔 sleep 이 reject → catch 로 흡수, endTurn 호출 안 함)
        const finalize = () => {
            ttsQueue
                .then(() => sleep(400, signal))
                .then(() => {
                    setAvatar('idle');
                    if (state.engineStarted && window.ConvEngine.isActive()) window.ConvEngine.rest();
                })
                .catch(() => {
                    setAvatar('idle');
                });
        };

        // 옵션 시트는 즉시 열고 TTS 끝나면 청취 재개
        // silent 알림(담기 완료 등)은 사용자가 새로 요청한 게 아니므로 시트를 재오픈하지 않는다.
        // → AI 가 menu_options 를 다시 돌려줘도 옵션 시트 재오픈 루프 / 중복 담기 / TTS 씹힘(즉시 endTurn 레이스) 방지.
        // (reply·suggestions·TTS·step·cart 갱신은 그대로 받는다)
        if (!silent && doneRes.menu_options) {
            openOptionSheet(doneRes.menu_options);
            finalize();
            return;
        }

        // 추천 시트도 즉시 열고 TTS 끝나면 마이크 ON 유지 (silent 알림은 재오픈 안 함)
        if (!silent && Array.isArray(doneRes.recommendations) && doneRes.recommendations.length > 0) {
            openRecommendSheet(doneRes.recommendations);
            finalize();
            return;
        }

        finalize();
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
        const onPick = (menu) => {
            // 사용자 액션을 자연어로 chat 에 알림 — FastAPI 가 옵션 유무 판단해서 처리
            // (옵션 있으면 menu_options 응답 → 옵션 시트, 없으면 카트 추가 + reply)
            state.recommendCtx = null;
            handleUserUtterance(`${menu.name} 담아줘`);
        };
        const onAnother = () => {
            state.recommendCtx = null;
            handleUserUtterance('다른 거 추천해주세요');
        };
        const onCancel = () => {
            state.recommendCtx = null;
            if (state.engineStarted && window.ConvEngine.isActive()) window.ConvEngine.rest();
        };

        // 시트 열려있는 동안 음성 매칭에 사용할 컨텍스트 등록
        state.recommendCtx = { menus, onPick, onAnother, onCancel };

        window.RecommendSheet.open({ menus, onPick, onAnother, onCancel });

        // 마이크는 여기서 즉시 열지 않는다 — 응답 TTS 가 아직 재생 중이라 마이크를 켜면
        // AI 자기 목소리를 STT 가 주워듣는 echo 루프가 생긴다. 마이크는 finalize() 가
        // 발화 끝난 뒤 한 번만 연다(터치 선택은 마이크와 무관하게 가능).
    }

    /**
     * 추천 시트 열려있을 때 사용자 음성을 자연어로 변환만 (FastAPI 호출은 그대로 진행).
     * @returns {string|null} 매칭된 자연어 (예: "데리야끼치킨솥밥 담아줘") 또는 null
     */
    function matchRecommendVoice(text) {
        const ctx = state.recommendCtx;
        if (!ctx || !window.RecommendSheet || !window.RecommendSheet.isOpen()) return null;
        const t = (text || '').trim();
        if (!t) return null;

        if (/(다른\s*(거|것|메뉴|걸)|더\s*추천)/.test(t)) return '다른 메뉴 추천해줘';
        if (/(취소|그만|안\s*할래|닫|다음에|선택\s*안)/.test(t)) return '선택 안 할래';

        const idxMap = [
            { re: /(1번|첫\s*(째|번째)|첫번째)/, idx: 0 },
            { re: /(2번|두\s*(째|번째)|두번째|둘째)/, idx: 1 },
            { re: /(3번|세\s*(째|번째)|세번째|셋째)/, idx: 2 }
        ];
        for (const { re, idx } of idxMap) {
            if (re.test(t) && ctx.menus[idx]) {
                return `${ctx.menus[idx].name} 담아줘`;
            }
        }
        if (ctx.menus.length === 1 && /(담|그거|이거|좋아|할래)/.test(t)) {
            return `${ctx.menus[0].name} 담아줘`;
        }
        return null;
    }

    /**
     * 옵션 선택 시트 열기. 선택 후 cart/add 직접 호출 + chat 알림 (AI 컨텍스트 동기화).
     */
    function openOptionSheet(menuOptions) {
        if (!window.OptionSheet) {
            console.warn('[A01] OptionSheet 모듈 미로드');
            return;
        }
        window.OptionSheet.open({
            menuOptions,
            onConfirm: async (selectedOptionIds) => {
                const cart = await callApi('옵션 담기', () =>
                    window.Api.Ai.cartAdd({
                        session_id: state.aiSessionId,
                        menu_id: menuOptions.menu_id,
                        quantity: 1,
                        option_ids: selectedOptionIds
                    })
                );
                if (cart) applyCartResponse(cart);

                // 선택된 옵션명 추출 (option-sheet.js: option_id=숫자, name 필드)
                const selectedOptNames = (menuOptions.option_groups || [])
                    .flatMap((g) => g.options || [])
                    .filter((o) => selectedOptionIds.includes(o.option_id))
                    .map((o) => o.name);
                const optionText = selectedOptNames.length ? ` (${selectedOptNames.join(', ')})` : '';

                // AI 컨텍스트 동기화용 silent 알림 — 완료형("담겼어") + 옵션명으로
                // "새 주문" 오인(옵션 재호출) 방지. silent: true → 채팅 로그엔 안 보이고,
                // AI reply + suggestions + TTS 는 그대로 받는다.
                handleUserUtterance(
                    `${menuOptions.menu_name}${optionText} 장바구니에 담겼어`,
                    { silent: true }
                );
            },
            onCancel: () => {
                if (state.engineStarted && window.ConvEngine.isActive()) window.ConvEngine.rest();
            }
        });
        // 마이크는 여기서 즉시 열지 않는다 — 응답 TTS 가 아직 재생 중이라 마이크를 켜면
        // AI 자기 목소리를 STT 가 주워듣는 echo 루프가 생긴다. 마이크는 finalize() 가
        // 발화 끝난 뒤 한 번만 연다(터치 선택은 마이크와 무관하게 가능).
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
        console.log('[A01] refreshCart (Spring sessionId=' + state.sessionId + ') →', result);
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

    /** 카드형 카트 렌더 (N02 스타일 참조) — 사진 상단, 가격 오버레이, 수량 스테퍼. */
    function renderMinicart() {
        if (!state.cart.items.length) {
            $minicartEmpty.hidden = false;
            $minicartFilled.hidden = true;
            return;
        }
        $minicartEmpty.hidden = true;
        $minicartFilled.hidden = false;
        $minicartList.replaceChildren();

        state.cart.items.forEach((it) => {
            $minicartList.appendChild(buildMinicartCard(it));
        });

        $minicartCount.textContent = String(getCartCount());
        $minicartTotal.textContent = fmtPrice(getCartTotal());
    }

    /** 단일 카드 DOM 생성 (XSS 방지 — innerHTML 대신 DOM API). */
    function buildMinicartCard(it) {
        const itemId = it.itemId;
        const $li = document.createElement('li');
        $li.className = 'a01__minicart-item';
        $li.dataset.cartItem = itemId;

        // 썸네일 + 가격 오버레이 + X 버튼
        const $thumb = document.createElement('div');
        $thumb.className = 'a01__minicart-item-thumb';
        const imgUrl = it.imageUrl || state.menuImageCache.get(it.menuId);
        const setIconFallback = () => {
            $thumb.classList.add('a01__minicart-item-thumb--icon');
            // 가격/X 노드는 유지하고 img/i 만 갈아끼움
            const old = $thumb.querySelector('img, i');
            if (old) old.remove();
            const $icon = document.createElement('i');
            $icon.className = 'xi xi-restaurant';
            $icon.setAttribute('aria-hidden', 'true');
            $thumb.prepend($icon);
        };
        if (imgUrl) {
            const $img = document.createElement('img');
            $img.alt = '';
            $img.src = imgUrl;
            $img.addEventListener('error', setIconFallback);
            $thumb.appendChild($img);
        } else {
            setIconFallback();
        }

        // 가격 오버레이 — 우하단
        const $price = document.createElement('span');
        $price.className = 'a01__minicart-item-price-overlay';
        $price.textContent = fmtPrice(it.itemTotal != null ? it.itemTotal : (it.unitPrice || 0) * (it.quantity || 1));
        $thumb.appendChild($price);

        // 삭제 버튼 — 우상단
        const $remove = document.createElement('button');
        $remove.type = 'button';
        $remove.className = 'a01__minicart-item-remove';
        $remove.dataset.cartRemove = itemId;
        $remove.setAttribute('aria-label', '삭제');
        const $closeIcon = document.createElement('i');
        $closeIcon.className = 'xi xi-close-thin';
        $closeIcon.setAttribute('aria-hidden', 'true');
        $remove.appendChild($closeIcon);
        $thumb.appendChild($remove);

        // 본문 — 이름 + 수량 스테퍼
        const $body = document.createElement('div');
        $body.className = 'a01__minicart-item-body';

        const $name = document.createElement('span');
        $name.className = 'a01__minicart-item-name';
        $name.textContent = it.menuName || '';
        $body.appendChild($name);

        const $stepper = document.createElement('div');
        $stepper.className = 'a01__minicart-stepper';
        const qty = it.quantity || 1;
        const $minus = document.createElement('button');
        $minus.type = 'button';
        $minus.className = 'a01__minicart-stepper-btn';
        $minus.dataset.cartQty = itemId;
        $minus.dataset.delta = '-1';
        $minus.setAttribute('aria-label', '수량 감소');
        $minus.textContent = '−';
        if (qty <= 1) $minus.disabled = true;   // 1 에서 −는 삭제로 유도 (X 버튼)

        const $val = document.createElement('span');
        $val.className = 'a01__minicart-stepper-value';
        $val.textContent = String(qty);

        const $plus = document.createElement('button');
        $plus.type = 'button';
        $plus.className = 'a01__minicart-stepper-btn';
        $plus.dataset.cartQty = itemId;
        $plus.dataset.delta = '1';
        $plus.setAttribute('aria-label', '수량 증가');
        $plus.textContent = '+';

        $stepper.append($minus, $val, $plus);
        $body.appendChild($stepper);

        $li.append($thumb, $body);
        return $li;
    }

    /** 미니카트 클릭 위임 — 수량 +/− 및 삭제. 한 번 등록. */
    function bindMinicartHandlers() {
        if (!$minicartList || $minicartList.dataset.bound === '1') return;
        $minicartList.dataset.bound = '1';
        $minicartList.addEventListener('click', async (e) => {
            const target = e.target.closest('[data-cart-remove], [data-cart-qty]');
            if (!target) return;
            if (!state.sessionId) return;

            if (target.dataset.cartRemove) {
                const itemId = target.dataset.cartRemove;
                target.disabled = true;
                const cartResp = await callApi('항목 삭제', () =>
                    window.Api.cart.removeItem(state.sessionId, itemId)
                );
                if (cartResp) applyCartResponse(cartResp);
                return;
            }

            if (target.dataset.cartQty) {
                const itemId = target.dataset.cartQty;
                const delta = Number(target.dataset.delta || 0);
                const item = state.cart.items.find((it) => it.itemId === itemId);
                if (!item) return;
                const next = (item.quantity || 1) + delta;
                if (next <= 0) {
                    // 0 이하는 삭제로 처리 (현재는 −가 1에서 disabled 라 거의 도달 X)
                    target.disabled = true;
                    const cartResp = await callApi('항목 삭제', () =>
                        window.Api.cart.removeItem(state.sessionId, itemId)
                    );
                    if (cartResp) applyCartResponse(cartResp);
                    return;
                }
                target.disabled = true;
                const cartResp = await callApi('수량 변경', () =>
                    window.Api.cart.updateItem(state.sessionId, itemId, next)
                );
                if (cartResp) applyCartResponse(cartResp);
            }
        });
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

    /**
     * 퀵바 chip 렌더 — FastAPI chat 응답의 suggestions 배열 기반.
     * 인자 없거나 빈 배열이면 chip-row 비움.
     */
    function renderChips(suggestions) {
        $chipRow.innerHTML = '';
        if (!Array.isArray(suggestions) || suggestions.length === 0) return;
        suggestions.slice(0, 3).forEach((sText) => {
            const text = (sText || '').trim();
            if (!text) return;
            const $btn = document.createElement('button');
            $btn.type = 'button';
            $btn.className = 'a01__chip';
            $btn.textContent = text;
            $btn.addEventListener('click', () => userSay(text));
            $chipRow.appendChild($btn);
        });
    }

    // ========================================================
    // 14. 단계 인디케이터
    // ========================================================
    // 기승전결 인디케이터 제거됨 — FSM 단계는 내부 라우팅에만 사용.
    // 호출부 호환을 위해 no-op 으로 유지.
    function renderSteps() {}

    // ========================================================
    // 대화 기록 서랍 (왼쪽 슬라이드 off-canvas)
    // ========================================================
    function openDrawer() {
        if (!$drawer) return;
        $drawer.hidden = false;
        // reflow 후 transition 트리거 (display:none → 슬라이드 인)
        requestAnimationFrame(() => $drawer.classList.add('is-open'));
        scrollLogToBottom();
    }

    function closeDrawer() {
        if (!$drawer) return;
        $drawer.classList.remove('is-open');
        // 슬라이드 아웃 애니메이션 후 DOM 비표시
        setTimeout(() => { if (!$drawer.classList.contains('is-open')) $drawer.hidden = true; }, 280);
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

    /** 페이지 전환 — 베일을 페이드인한 뒤 이동. 화면이 툭 끊기지 않고 부드럽게 넘어감. */
    function navigateWithFade(url) {
        if (window.ConvEngine) window.ConvEngine.stop();
        stopCurrentAudio();
        const veil = document.createElement('div');
        veil.className = 'a01__page-leave';
        document.body.appendChild(veil);
        // reflow 후 활성화 → opacity transition 트리거
        requestAnimationFrame(() => veil.classList.add('is-active'));
        // 베일 페이드(360ms) 거의 끝나는 시점에 실제 이동
        setTimeout(() => { location.href = url; }, 340);
    }

    async function goToPayment() {
        if (!state.sessionId) {
            showToast('세션이 없어요. 새로고침 해주세요.');
            return;
        }
        // 장바구니가 비어도 결제 화면을 확인해야 하므로 통과 (검증용). 경고만 남김.
        if (!state.cart.items.length) {
            console.warn('[A01] 장바구니가 비었지만 결제 화면으로 진행 (검증용)');
        }
        // 주문 확정(order.confirm)은 P01-summary 가 사용자 액션 시 호출.
        // A01 에서 호출하면 P03/P04 의 retry 흐름과 합쳐 중복 주문 위험.
        AppState.set('CURRENT_STEP', 'P01');
        navigateWithFade('/summary');
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
        // P-flow 의 AvatarGuide 가 동일 상태 참조 — sessionStorage 로 공유
        AppState.set('AVATAR_MUTED', state.muted ? '1' : '0');
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
        const mode = window.ConvEngine.getMode();

        if (mode === 'INACTIVE') {
            // 첫 시작
            window.ConvEngine.start();
            state.engineStarted = true;
            enterState('opening');
            return;
        }

        if (mode === 'READY') {
            // 눌러서 말하기 — 한 턴만 청취 시작 (열림음 → 마이크 ON)
            window.ConvEngine.endTurn();
            return;
        }

        if (mode === 'AI_SPEAKING' || mode === 'THINKING') {
            // 눈치가 말하거나 응답 대기 중 — 사용자가 바로 말하고 싶을 때.
            // AI 즉시 멈추고 LISTENING 으로 전환.
            window.ConvEngine.bargeIn();
            return;
        }

        if (mode === 'LISTENING') {
            // 듣는 중 다시 누르면 청취 취소 → 대기(READY)
            window.ConvEngine.rest();
        }
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
            placeholder = '눈치가 말하고 있어요';
            bubbleHint = null; // typewriter 가 직접 채움
            ariaPressed = 'true';
            ariaLabel = '대화 종료 (말씀하시면 끼어들 수 있어요)';
        } else if (next === 'THINKING') {
            micClass = 'a01__btn-mic--ai-turn';
            statusText = '생각 중';
            placeholder = '잠시만요...';
            bubbleHint = null; // 텍스트 대신 점점점(…) 애니메이션으로 표시
            ariaPressed = 'false';
            ariaLabel = 'AI 응답 중';
        } else if (next === 'READY') {
            // 눌러서 말하기 대기 — 마이크 OFF, 사용자가 누를 때까지 어떤 소리도 안 들음.
            // AI 발화가 끝날 때마다 이 안내가 떠서 다음 차례를 명확히 알려준다.
            micClass = 'a01__btn-mic--inactive';
            statusText = '눌러서 말하기';
            placeholder = '🎤 마이크를 눌러 말씀해 주세요';
            bubbleHint = '🎤 마이크를 눌러 말씀해 주세요';
            ariaPressed = 'false';
            ariaLabel = '마이크를 눌러 말하기';
        } else { // INACTIVE
            micClass = 'a01__btn-mic--inactive';
            statusText = '대기';
            placeholder = '눈치에게 말하거나 입력해보세요';
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

        // 생각중 점점점(…) — THINKING 일 때만 .is-thinking 토글
        $bubble.classList.toggle('is-thinking', next === 'THINKING');

        // 말풍선 상태 표시
        // - THINKING: 점점점 애니메이션 (텍스트 비움)
        // - LISTENING: bubbleHint 텍스트
        // - AI_SPEAKING: typewriter 가 직접 채움
        if (next === 'THINKING') {
            $bubble.classList.add('is-visible');
            $bubble.classList.remove('is-typing');
            $bubbleText.textContent = '';
        } else if (bubbleHint) {
            $bubble.classList.add('is-visible');
            $bubble.classList.remove('is-typing');
            $bubbleText.textContent = bubbleHint;
        }
    }

    function onConvSilencePrompt() {
        // 3초 침묵 되물음 비활성화 — 너무 자주 끼어들어서 거슬림.
        return null;
    }

    /** LISTENING 진입 후 listenTimeoutMs 안에 한 마디도 안 들리면 호출됨.
     *  ConvEngine 이 stop() 으로 INACTIVE 전환 + recognition 종료까지 처리 완료된 상태. */
    function onConvListenTimeout() {
        console.log('[A01] 발화 없음 → 자동 청취 종료');
        setAvatar('idle');
        showToast('한참 기다렸어요. 마이크 버튼을 다시 눌러주세요.');
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
        stopCurrentAudio();           // TTS 음성 즉시 정지
        setAvatar('idle');
        // 즉시 시각 신호 — 모드 전환 콜백이 늦게 와도 사용자에게 바로 보임
        if ($bubble) $bubble.classList.remove('is-typing', 'is-thinking');
        if ($bubbleText) $bubbleText.textContent = '🎤 말씀해 주세요';
        if ($input) $input.placeholder = '듣고 있어요...';
    }

    // ========================================================
    // 17. 토스트
    // ========================================================
    function showToast(msg) {
        let $t = document.querySelector('.a01__toast');
        if (!$t) {
            $t = document.createElement('div');
            $t.className = 'a01__toast';
            (document.querySelector('.page-bg') || document.body).appendChild($t);
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

        // 대화 기록 서랍 — FAB 로 열고, 백드롭/닫기 버튼으로 닫기
        if ($fab) $fab.addEventListener('click', openDrawer);
        if ($drawer) {
            $drawer.querySelectorAll('[data-drawer-close]').forEach(($el) =>
                $el.addEventListener('click', closeDrawer)
            );
        }
    }

    function bootVideos() {
        $videos.forEach(($v) => { try { $v.play(); } catch (_) {} });
    }

    // 디버그 헬퍼 — devtools 콘솔에서 수동 호출:
    //   window.__a01.goPayment()     강제 /summary 라우팅 (cart/session 검증은 그대로)
    //   window.__a01.state           내부 state 스냅샷
    //   window.__a01.simulateStep('CHECKOUT')  current_step 도달 시뮬레이션
    //     - CHECKOUT 으로 호출하면 인디케이터 갱신 + 무조건 /summary 라우팅 (반복 호출 가능)
    //     - 그 외 step 은 인디케이터만 갱신
    //   window.__a01.diagnoseCart()  Spring 카트 vs FastAPI 카트 동시 비교
    //   window.__a01.forceGoPayment() 카트 검증 우회 + /summary 강제 이동
    window.__a01 = {
        goPayment: () => goToPayment(),
        get state() { return state; },
        simulateStep(step) {
            const prev = state.fsm;
            applyStep({ current_step: step });
            console.log('[A01] simulateStep', { from: prev, to: state.fsm, step });
            if (String(step).toUpperCase() === 'CHECKOUT') {
                console.log('[A01] simulateStep → CHECKOUT, /summary 이동');
                return goToPayment();
            }
        },
        async diagnoseCart() {
            console.log('━━━━━ 카트 진단 ━━━━━');
            console.log('sessionId (공유):', state.sessionId);
            console.log('aiSessionId    :', state.aiSessionId, '(sessionId 와 동일해야 함)');
            try {
                const springCart = await window.Api.cart.get(state.sessionId);
                console.log('[Spring cart]', springCart);
            } catch (e) { console.warn('Spring cart 조회 실패', e && e.message); }
            try {
                const aiCart = await window.Api.Ai.cartGet(state.aiSessionId);
                console.log('[AI cart]   ', aiCart);
            } catch (e) { console.warn('AI cart 조회 실패', e && e.message); }
            console.log('A01 state.cart:', state.cart);
        },
        forceGoPayment() {
            console.warn('[A01] forceGoPayment — 카트 검증 우회');
            AppState.set('CURRENT_STEP', 'P01');
            if (window.ConvEngine) window.ConvEngine.stop();
            location.href = '/summary';
        }
    };

    document.addEventListener('DOMContentLoaded', async () => {
        AppState.set('CURRENT_STEP', 'A01');
        AppState.set('MODE', 'AVATAR');

        renderMinicart();
        renderSteps();
        renderChips();
        bindMinicartHandlers();
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
            onBargeIn: onConvBargeIn,
            onListenTimeout: onConvListenTimeout,
            listenTimeoutMs: 80000   // 80초 안에 한 마디도 안 들리면 자동 종료
        });

        onConvModeChange('INACTIVE');

        // FastAPI 가 Spring 세션을 함께 생성 — 단일 sessionId 사용
        await startAiSession();
        if (state.sessionId) await refreshCart();

        // 세션 시작 — ConvEngine.start() 가 AI_SPEAKING 으로 진입해 greeting 발화,
        // 끝나면 rest() 로 READY(눌러서 말하기) 대기. 마이크는 사용자가 버튼을 누를 때만
        // 한 턴씩 열린다(자동 청취 X — 주변 소음/대화 오작동 방지).
        if (window.ConvEngine.isSupported()) {
            state.engineStarted = true;
            window.ConvEngine.start();
            if (state.bootGreeting) {
                await window.ConvEngine.say(state.bootGreeting);
            }
            state.greetedOnBoot = true;
            window.ConvEngine.rest();
        } else {
            // 브라우저 미지원 — 텍스트 입력으로 폴백
            showToast('이 브라우저는 음성 입력을 지원하지 않아요. 텍스트로 입력해주세요.');
            // greeting 만 typewriter+TTS 로 1회 노출 (ConvEngine 비경유)
            if (state.bootGreeting) {
                const bootAbort = new AbortController();
                state.speechAbort = bootAbort;
                try { await aiSpeak(state.bootGreeting, bootAbort.signal); }
                catch (_) { /* AbortError 무시 */ }
            }
            state.greetedOnBoot = true;
        }
    });
})();
