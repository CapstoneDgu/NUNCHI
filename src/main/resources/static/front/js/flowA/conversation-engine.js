// ========================================================
// conversation-engine.js — 턴테이킹 대화 엔진 (Web Speech API)
//
// 모드:
//   INACTIVE     — 세션 시작 전. recognition 미가동.
//   AI_SPEAKING  — AI 발화 중(typewriter + TTS). 사용자 interim 감지 시 바지인.
//   LISTENING    — 사용자 발화 대기. 3초 침묵 시 onSilencePrompt 콜백.
//   THINKING     — final 인식 후 host 가 처리 중. 다음 say() 까지 대기.
//
// 사용:
//   ConvEngine.init({ speak, onUserUtterance, onInterim, onSilencePrompt, onBargeIn, onModeChange });
//   ConvEngine.start();
//   await ConvEngine.say("안녕하세요");
//   ConvEngine.endTurn();              // → 자동 청취 시작
//   ConvEngine.submitText("매운 거");  // 텍스트 입력 폴백
//   ConvEngine.stop();
//
// 의존: 없음 (Web Speech API 만 사용)
//
// 콘솔 로그:
//   [Conv] 접두사로 마이크 상태/interim/final 모두 출력
// ========================================================
(function () {
    'use strict';

    const LOG = '[Conv]';
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
        onUserUtterance: null,   // (text) => void          — final
        onInterim: null,         // (text) => void          — partial result (실시간)
        onSilencePrompt: null,   // () => string | null
        onBargeIn: null,
        onModeChange: null
    };

    const state = {
        mode: MODE.INACTIVE,
        recognition: null,
        supported: typeof window !== 'undefined' &&
                   !!(window.SpeechRecognition || window.webkitSpeechRecognition),
        currentSpeakAbort: null,
        finalAccum: '',
        interimAccum: '',
        lastInterimAt: 0,
        silenceTimer: null,
        wantsRunning: false,
        startScheduled: false
    };

    function setMode(next) {
        const prev = state.mode;
        if (prev === next) return;
        state.mode = next;
        console.log(LOG, '🔄 모드 전환:', prev, '→', next);
        if (handlers.onModeChange) {
            try { handlers.onModeChange(next, prev); }
            catch (e) { console.warn(LOG, '모드 변경 처리 실패', e); }
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
            console.log(LOG, '🎤 마이크 켜짐 — 음성 인식 시작');
        };

        rec.onresult = (event) => {
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

            // 실시간 interim 콘솔 + 콜백
            if (interim) {
                console.log(LOG, '💬 듣는 중:', interim);
                if (handlers.onInterim) {
                    try { handlers.onInterim(interim); }
                    catch (e) { console.warn(LOG, '실시간 인식 처리 실패', e); }
                }
            }

            // 바지인: AI 발화 중 사용자 발화 감지
            // → speak abort + LISTENING 모드 전환 (final 처리 흐름 충돌 방지)
            if (state.mode === MODE.AI_SPEAKING && (interim || state.finalAccum)) {
                console.log(LOG, '✋ 사용자 끼어들기 감지');
                _bargeIn();
                setMode(MODE.LISTENING);
            }

            // final 결과 처리
            if (state.finalAccum.trim() && state.mode !== MODE.AI_SPEAKING) {
                const text = state.finalAccum.trim();
                console.log(LOG, '✅ 최종 인식:', text);
                state.finalAccum = '';
                state.interimAccum = '';
                _clearSilenceTimer();
                _stopRecognition();
                setMode(MODE.THINKING);
                // interim 화면 비우기 신호
                if (handlers.onInterim) {
                    try { handlers.onInterim(''); } catch (_) {}
                }
                if (handlers.onUserUtterance) {
                    try { handlers.onUserUtterance(text); }
                    catch (e) { console.warn(LOG, '사용자 발화 처리 실패', e); }
                }
            }
        };

        rec.onerror = (e) => {
            const code = e && e.error;
            if (code === 'no-speech' || code === 'aborted') {
                return; // 정상 — 침묵 타이머/재시작 흐름
            }
            if (code === 'not-allowed' || code === 'service-not-allowed' || code === 'audio-capture') {
                console.warn(LOG, '🚫 마이크 권한 차단:', code);
                state.wantsRunning = false;
                state.supported = false;
                setMode(MODE.INACTIVE);
                return;
            }
            console.warn(LOG, '음성 인식 오류:', code);
        };

        rec.onend = () => {
            console.log(LOG, '🎤 마이크 꺼짐 — 음성 인식 종료');
            // Chrome 은 continuous=true 라도 ~1분 후 자동 종료 → LISTENING 이면 재시작
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
        setTimeout(() => {
            if (!state.wantsRunning) { state.startScheduled = false; return; }
            try { state.recognition.start(); }
            catch (e) {
                state.startScheduled = false;
                if (e && e.name !== 'InvalidStateError') {
                    console.warn(LOG, '음성 인식 시작 실패', e);
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
            try { handlers.onBargeIn(); } catch (e) { console.warn(LOG, '끼어들기 처리 실패', e); }
        }
    }

    function _startSilenceTimer() {
        _clearSilenceTimer();
        state.lastInterimAt = Date.now();
        state.silenceTimer = setInterval(() => {
            if (state.mode !== MODE.LISTENING) return;
            if (Date.now() - state.lastInterimAt < SILENCE_MS) return;
            _clearSilenceTimer();
            let prompt = null;
            if (handlers.onSilencePrompt) {
                try { prompt = handlers.onSilencePrompt(); }
                catch (e) { console.warn(LOG, '침묵 프롬프트 처리 실패', e); }
            }
            if (prompt) {
                say(prompt).then(() => endTurn()).catch(() => {});
            } else {
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
        console.log(LOG, '초기화 — 음성인식 지원:', state.supported);
    }

    function start() {
        if (state.mode !== MODE.INACTIVE) return;
        state.wantsRunning = true;
        if (state.supported) _ensureRecognition();
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

    /** 단일 발화 — host typewriter + TTS. AI_SPEAKING 모드 유지. */
    async function say(text) {
        if (!handlers.speak) {
            console.warn(LOG, '발화 핸들러 미설정');
            return;
        }
        if (state.mode === MODE.LISTENING) {
            _stopRecognition();  // 자기 음성 자기인식 방지
        }
        _clearSilenceTimer();
        setMode(MODE.AI_SPEAKING);

        state.currentSpeakAbort = new AbortController();
        const signal = state.currentSpeakAbort.signal;
        try {
            await handlers.speak(text, signal);
        } catch (e) {
            if (!e || e.name !== 'AbortError') console.warn(LOG, '발화 실패', e);
        } finally {
            state.currentSpeakAbort = null;
        }
    }

    /** AI 발화 끝 알림. wantsRunning 이면 LISTENING 으로 전환 + 청취 시작. */
    function endTurn() {
        if (!state.wantsRunning) return;
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

    /** 텍스트 입력 폴백 — 음성 우회. */
    function submitText(text) {
        const t = (text || '').trim();
        if (!t) return;
        console.log(LOG, '⌨️ 텍스트 입력:', t);
        _clearSilenceTimer();
        _stopRecognition();
        state.finalAccum = '';
        state.interimAccum = '';
        if (state.wantsRunning) setMode(MODE.THINKING);
        if (handlers.onUserUtterance) {
            try { handlers.onUserUtterance(t); }
            catch (e) { console.warn(LOG, '사용자 발화 처리 실패', e); }
        }
    }

    /**
     * 명시적 바지인 — 마이크 버튼 클릭 등 사용자 의도가 명확한 경우.
     * AI 발화 즉시 중단 + LISTENING 으로 전환 + recognition 시작.
     */
    function bargeIn() {
        if (state.mode === MODE.LISTENING || state.mode === MODE.INACTIVE) return;
        console.log(LOG, '✋ 사용자 바지인 (수동)');
        _bargeIn();
        if (state.wantsRunning) {
            setMode(MODE.LISTENING);
            state.finalAccum = '';
            state.interimAccum = '';
            if (state.supported) {
                _ensureRecognition();
                _scheduleStart();
            }
            _startSilenceTimer();
        }
    }

    function isActive() { return state.wantsRunning; }
    function getMode()  { return state.mode; }
    function isSupported() { return state.supported; }

    window.ConvEngine = {
        MODE,
        init, start, stop, say, endTurn, submitText, bargeIn,
        isActive, getMode, isSupported
    };
})();
