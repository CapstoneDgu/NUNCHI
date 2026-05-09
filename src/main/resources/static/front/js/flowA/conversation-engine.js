// ========================================================
// conversation-engine.js — 턴테이킹 대화 엔진 (AudioRecorder + Google STT)
//
// 모드:
//   INACTIVE     — 세션 시작 전. 녹음 X.
//   AI_SPEAKING  — AI 발화 중 (typewriter + TTS 재생). 사용자 입력 시 바지인.
//   LISTENING    — 사용자 발화 대기. AudioRecorder 가 녹음 중.
//   THINKING     — STT/AI 응답 대기. 다음 say() 까지 대기.
//
// 사용:
//   ConvEngine.init({ speak, onUserUtterance, onSilencePrompt, onBargeIn, onModeChange });
//   ConvEngine.start();
//   await ConvEngine.say("안녕하세요");
//   ConvEngine.endTurn();              // → AudioRecorder 자동 시작
//   ConvEngine.submitText("매운 거");  // 텍스트 입력 폴백
//   ConvEngine.stop();
//
// 의존: window.AudioRecorder, window.Api.Voice
// ========================================================
(function () {
    'use strict';

    const MODE = {
        INACTIVE: 'INACTIVE',
        AI_SPEAKING: 'AI_SPEAKING',
        LISTENING: 'LISTENING',
        THINKING: 'THINKING'
    };

    let handlers = {
        speak: null,
        onUserUtterance: null,
        onSilencePrompt: null,    // 호환 유지 (호출은 안 함 — VAD 가 자동 처리)
        onBargeIn: null,
        onModeChange: null
    };

    const state = {
        mode: MODE.INACTIVE,
        currentSpeakAbort: null,
        wantsRunning: false
    };

    function setMode(next) {
        const prev = state.mode;
        if (prev === next) return;
        state.mode = next;
        if (handlers.onModeChange) {
            try { handlers.onModeChange(next, prev); }
            catch (e) { console.warn('[ConvEngine] onModeChange', e); }
        }
    }

    function _bargeIn() {
        if (state.currentSpeakAbort) {
            try { state.currentSpeakAbort.abort(); } catch (_) {}
        }
        if (handlers.onBargeIn) {
            try { handlers.onBargeIn(); } catch (e) { console.warn('[ConvEngine] onBargeIn', e); }
        }
    }

    function _stopRecording() {
        if (window.AudioRecorder && window.AudioRecorder.isActive()) {
            window.AudioRecorder.stop();
        }
    }

    /** 녹음 종료 후 호출 — STT 후 onUserUtterance 디스패치. */
    async function _onRecordingStop(blob, meta) {
        if (!state.wantsRunning) return;
        if (!blob || !meta || !meta.hadSpeech) {
            // 발화 감지 없이 종료(타임아웃 등) — 다시 LISTENING 으로 재시작
            if (state.wantsRunning && state.mode !== MODE.AI_SPEAKING) {
                _startListening();
            }
            return;
        }
        setMode(MODE.THINKING);
        let text = null;
        try {
            const res = await window.Api.Voice.transcribe(blob);
            text = res && res.text ? res.text.trim() : null;
        } catch (e) {
            console.warn('[ConvEngine] transcribe 실패', e);
        }
        if (!text) {
            // 인식 실패 — 다시 청취 시작 (폴백 멘트 X)
            if (state.wantsRunning) _startListening();
            return;
        }
        if (handlers.onUserUtterance) {
            try { handlers.onUserUtterance(text); }
            catch (e) { console.warn('[ConvEngine] onUserUtterance', e); }
        }
    }

    function _startListening() {
        if (!window.AudioRecorder || !window.AudioRecorder.isSupported()) return;
        if (window.AudioRecorder.isActive()) return;
        setMode(MODE.LISTENING);
        window.AudioRecorder.start({
            onStop: _onRecordingStop,
            onError: (e) => {
                console.warn('[ConvEngine] mic error', e);
                state.wantsRunning = false;
                setMode(MODE.INACTIVE);
            }
        });
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
        // 첫 say() 까지 AI_SPEAKING 으로 진입.
        setMode(MODE.AI_SPEAKING);
    }

    function stop() {
        state.wantsRunning = false;
        _stopRecording();
        if (state.currentSpeakAbort) {
            try { state.currentSpeakAbort.abort(); } catch (_) {}
            state.currentSpeakAbort = null;
        }
        setMode(MODE.INACTIVE);
    }

    /** AI 발화 — host 의 speak() 호출. 발화 끝나면 AI_SPEAKING 모드 유지. */
    async function say(text) {
        if (!handlers.speak) {
            console.warn('[ConvEngine] speak handler not set');
            return;
        }
        // 청취 중이면 잠시 멈춤 — 자기 음성 자기인식 방지
        if (state.mode === MODE.LISTENING) {
            _stopRecording();
        }
        setMode(MODE.AI_SPEAKING);

        state.currentSpeakAbort = new AbortController();
        const signal = state.currentSpeakAbort.signal;
        try {
            await handlers.speak(text, signal);
        } catch (e) {
            if (!e || e.name !== 'AbortError') console.warn('[ConvEngine] speak failed', e);
        } finally {
            state.currentSpeakAbort = null;
        }
    }

    /** AI 발화 시퀀스가 끝났음을 알림. wantsRunning 이면 청취 시작. */
    function endTurn() {
        if (!state.wantsRunning) return;
        if (state.mode === MODE.INACTIVE) return;
        _startListening();
    }

    /** 텍스트 입력 폴백 — 녹음/STT 우회하고 직접 onUserUtterance 호출. */
    function submitText(text) {
        const t = (text || '').trim();
        if (!t) return;
        _stopRecording();
        if (state.wantsRunning) setMode(MODE.THINKING);
        if (handlers.onUserUtterance) {
            try { handlers.onUserUtterance(t); }
            catch (e) { console.warn('[ConvEngine] onUserUtterance', e); }
        }
    }

    function isActive() { return state.wantsRunning; }
    function getMode()  { return state.mode; }
    function isSupported() {
        return !!(window.AudioRecorder && window.AudioRecorder.isSupported());
    }

    window.ConvEngine = {
        MODE,
        init, start, stop, say, endTurn, submitText,
        isActive, getMode, isSupported
    };
})();
