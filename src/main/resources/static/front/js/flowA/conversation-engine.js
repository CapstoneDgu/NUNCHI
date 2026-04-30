// ========================================================
// conversation-engine.js — 턴테이킹 대화 엔진
//
// 모드:
//   INACTIVE     — 세션 시작 전. recognition 미가동.
//   AI_SPEAKING  — AI 발화 중(typewriter). 사용자 interim 감지 시 바지인.
//   LISTENING    — 사용자 발화 대기. 3초 침묵 시 onSilencePrompt 콜백.
//   THINKING     — final 인식 후 host 가 처리 중. 다음 say() 까지 대기.
//
// 사용:
//   ConvEngine.init({ speak, onUserUtterance, onSilencePrompt, onBargeIn, onModeChange });
//   ConvEngine.start();
//   await ConvEngine.say("안녕하세요");
//   ConvEngine.endTurn();              // → 자동 청취 시작
//   ConvEngine.submitText("매운 거");  // 텍스트 입력 폴백
//   ConvEngine.stop();
//
// 의존: 없음 (Web Speech API 만 사용)
// ========================================================
(function () {
    'use strict';

    const MODE = {
        INACTIVE: 'INACTIVE',
        AI_SPEAKING: 'AI_SPEAKING',
        LISTENING: 'LISTENING',
        THINKING: 'THINKING'
    };

    const SILENCE_MS = 3000;     // 침묵 N 초 → 되물음
    const SILENCE_TICK = 200;    // 타이머 폴링 간격

    let handlers = {
        speak: null,             // async (text, signal) => void
        onUserUtterance: null,   // (text) => void
        onSilencePrompt: null,   // () => string | null  — null 반환 시 발화 생략
        onBargeIn: null,         // () => void
        onModeChange: null       // (newMode, prevMode) => void
    };

    const state = {
        mode: MODE.INACTIVE,
        recognition: null,
        supported: typeof window !== 'undefined' &&
                   !!(window.SpeechRecognition || window.webkitSpeechRecognition),
        currentSpeakAbort: null,    // 호스트 typewriter 의 AbortController (say() 가 생성)
        finalAccum: '',
        interimAccum: '',
        lastInterimAt: 0,
        silenceTimer: null,
        // 'soft' 종료(타임아웃)와 'hard' 종료(stop()) 구분 — onend 에서 재시작 여부 결정
        wantsRunning: false,
        startScheduled: false       // 중복 start() 호출 방지
    };

    function setMode(next) {
        const prev = state.mode;
        if (prev === next) return;
        state.mode = next;
        if (handlers.onModeChange) {
            try { handlers.onModeChange(next, prev); } catch (e) { console.warn('[ConvEngine] onModeChange', e); }
        }
    }

    function _ensureRecognition() {
        if (state.recognition || !state.supported) return state.recognition;
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        const rec = new SR();
        rec.lang = 'ko-KR';
        rec.continuous = true;
        rec.interimResults = true;
        rec.maxAlternatives = 1;

        rec.onstart = () => {
            state.startScheduled = false;
            state.lastInterimAt = Date.now();
        };

        rec.onresult = (event) => {
            // interim 결과는 매 호출마다 일부 results 가 isFinal=false 로 옴.
            // resultIndex 부터 순회하여 final 누적.
            let interim = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const res = event.results[i];
                if (res.isFinal) {
                    state.finalAccum += res[0].transcript;
                } else {
                    interim += res[0].transcript;
                }
            }
            state.interimAccum = interim;
            state.lastInterimAt = Date.now();

            // 바지인: AI 발화 중에 사용자 interim 이 들어오면 typewriter 컷
            if (state.mode === MODE.AI_SPEAKING && (interim || state.finalAccum)) {
                _bargeIn();
            }

            // final 결과가 누적된 경우 — 한 번에 한 발화 처리
            if (state.finalAccum.trim() && state.mode !== MODE.AI_SPEAKING) {
                const text = state.finalAccum.trim();
                state.finalAccum = '';
                state.interimAccum = '';
                _clearSilenceTimer();
                setMode(MODE.THINKING);
                if (handlers.onUserUtterance) {
                    try { handlers.onUserUtterance(text); }
                    catch (e) { console.warn('[ConvEngine] onUserUtterance', e); }
                }
            }
        };

        rec.onerror = (e) => {
            const code = e && e.error;
            if (code === 'no-speech' || code === 'aborted') {
                // 침묵 타이머가 처리. 자동 종료 후 재시작은 onend 가 담당.
                return;
            }
            if (code === 'not-allowed' || code === 'service-not-allowed' || code === 'audio-capture') {
                console.warn('[ConvEngine] mic blocked:', code);
                state.wantsRunning = false;
                state.supported = false;
                setMode(MODE.INACTIVE);
                return;
            }
            console.warn('[ConvEngine] recognition error:', code);
        };

        rec.onend = () => {
            // Chrome 은 continuous=true 라도 ~1분 후 자동 종료 → 재시작
            if (state.wantsRunning && state.mode === MODE.LISTENING) {
                _scheduleStart();
            }
        };

        state.recognition = rec;
        return rec;
    }

    function _scheduleStart() {
        if (state.startScheduled || !state.recognition) return;
        state.startScheduled = true;
        // 직접 start() 시 InvalidStateError 잦으므로 rAF 한 틱 미루기
        setTimeout(() => {
            if (!state.wantsRunning) { state.startScheduled = false; return; }
            try { state.recognition.start(); }
            catch (e) {
                state.startScheduled = false;
                // 이미 실행 중이면 무시, 아니면 약간 더 미뤄서 재시도
                if (e && e.name !== 'InvalidStateError') {
                    console.warn('[ConvEngine] start failed', e);
                } else {
                    setTimeout(() => {
                        if (state.wantsRunning) {
                            try { state.recognition.start(); } catch (_) {}
                        }
                    }, 250);
                }
            }
        }, 50);
    }

    function _bargeIn() {
        if (state.currentSpeakAbort) {
            try { state.currentSpeakAbort.abort(); } catch (_) {}
        }
        if (handlers.onBargeIn) {
            try { handlers.onBargeIn(); } catch (e) { console.warn('[ConvEngine] onBargeIn', e); }
        }
        // 모드 전환은 say() 의 catch/finally 가 처리. 여기선 abort 신호만.
    }

    function _startSilenceTimer() {
        _clearSilenceTimer();
        state.lastInterimAt = Date.now();
        state.silenceTimer = setInterval(() => {
            if (state.mode !== MODE.LISTENING) return;
            if (Date.now() - state.lastInterimAt < SILENCE_MS) return;
            _clearSilenceTimer();
            // 호스트에 되물음 멘트 요청
            let prompt = null;
            if (handlers.onSilencePrompt) {
                try { prompt = handlers.onSilencePrompt(); }
                catch (e) { console.warn('[ConvEngine] onSilencePrompt', e); }
            }
            if (prompt) {
                say(prompt).then(() => endTurn()).catch(() => {});
            } else {
                // 멘트 없으면 타이머만 갱신해 다시 대기
                state.lastInterimAt = Date.now();
                _startSilenceTimer();
            }
        }, SILENCE_TICK);
    }

    function _clearSilenceTimer() {
        if (state.silenceTimer) {
            clearInterval(state.silenceTimer);
            state.silenceTimer = null;
        }
    }

    function _stopRecognition() {
        if (!state.recognition) return;
        try { state.recognition.abort(); } catch (_) {}
        state.startScheduled = false;
    }

    // ----------------------------------------------------
    // Public API
    // ----------------------------------------------------

    function init(opts) {
        handlers = Object.assign({}, handlers, opts || {});
    }

    function start() {
        if (state.mode !== MODE.INACTIVE) return;
        state.wantsRunning = true;
        if (state.supported) _ensureRecognition();
        // 첫 say() 까지 모드는 INACTIVE 유지 — 호스트가 say() 를 부르며 AI_SPEAKING 으로 진입.
        // 호스트 입장에선 start() 직후 첫 발화만 보내면 됨.
        setMode(MODE.AI_SPEAKING);
    }

    function stop() {
        state.wantsRunning = false;
        state.finalAccum = '';
        state.interimAccum = '';
        _clearSilenceTimer();
        _stopRecognition();
        if (state.currentSpeakAbort) {
            try { state.currentSpeakAbort.abort(); } catch (_) {}
            state.currentSpeakAbort = null;
        }
        setMode(MODE.INACTIVE);
    }

    /**
     * 단일 발화 — 호스트 typewriter 호출 후 promise 가 끝나면 AI_SPEAKING 모드 유지.
     * 자동 청취는 endTurn() 호출까지 보류한다(연속 say 체이닝 지원).
     */
    async function say(text) {
        if (!handlers.speak) {
            console.warn('[ConvEngine] speak handler not set');
            return;
        }
        if (state.mode === MODE.INACTIVE) {
            // 비활성 상태에서 say() 호출 시: 청취는 시작하지 않음. 단순 발화만.
        }
        // 청취 중이면 잠시 멈춤 — 자기 음성 자기인식 방지
        if (state.mode === MODE.LISTENING) {
            _stopRecognition();
        }
        _clearSilenceTimer();
        setMode(MODE.AI_SPEAKING);

        // 새 AbortController — 바지인 시 외부에서 abort 호출 가능
        state.currentSpeakAbort = new AbortController();
        const signal = state.currentSpeakAbort.signal;
        try {
            await handlers.speak(text, signal);
        } catch (e) {
            // AbortError 는 정상 컷오프
            if (!e || e.name !== 'AbortError') console.warn('[ConvEngine] speak failed', e);
        } finally {
            state.currentSpeakAbort = null;
        }
    }

    /**
     * AI 발화 시퀀스가 끝났음을 알림. wantsRunning 이면 LISTENING 으로 진입.
     */
    function endTurn() {
        if (!state.wantsRunning) return;     // 비활성 세션이면 무시
        if (state.mode === MODE.INACTIVE) return;
        setMode(MODE.LISTENING);
        state.finalAccum = '';
        state.interimAccum = '';
        if (state.supported) {
            _ensureRecognition();
            _scheduleStart();
        }
        _startSilenceTimer();
    }

    /**
     * 텍스트 입력 폴백 — Web Speech 미지원 또는 사용자가 텍스트로 입력한 경우.
     * 음성 경로와 동일한 onUserUtterance 콜백을 호출한다.
     */
    function submitText(text) {
        const t = (text || '').trim();
        if (!t) return;
        _clearSilenceTimer();
        // 활성 세션이면 모드 전환, 비활성이면 단발 처리
        if (state.wantsRunning) setMode(MODE.THINKING);
        if (handlers.onUserUtterance) {
            try { handlers.onUserUtterance(t); }
            catch (e) { console.warn('[ConvEngine] onUserUtterance', e); }
        }
    }

    function isActive() { return state.wantsRunning; }
    function getMode()  { return state.mode; }
    function isSupported() { return state.supported; }

    window.ConvEngine = {
        MODE,
        init, start, stop, say, endTurn, submitText,
        isActive, getMode, isSupported
    };
})();
