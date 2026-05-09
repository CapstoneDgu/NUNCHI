// ========================================================
// audio-recorder.js — MediaRecorder + 단순 VAD (UMD window.AudioRecorder)
//
// 자동 청취 흐름:
//   AudioRecorder.start({ onStop: (blob, meta) => ... });
//   사용자 발화 감지 → 침묵 silenceMs(기본 1500) 초과 → 자동 stop → onStop(blob)
//   - blob: audio/webm;codecs=opus
//   - meta: { hadSpeech }
//
// 강제 정지:
//   AudioRecorder.stop();   // 외부에서 즉시 정지 (바지인 등)
//
// 안전장치:
//   maxMs(기본 20000) 초과 시 자동 stop.
// ========================================================

(function (root) {
    'use strict';

    const DEFAULT_SILENCE_MS = 1500;        // 발화 후 침묵 N ms → 자동 stop
    const DEFAULT_THRESHOLD = 0.02;         // RMS 발화 임계 (0~1)
    const DEFAULT_MAX_MS = 20000;           // 안전장치 — 최대 녹음 시간

    const state = {
        active: false,
        mediaRecorder: null,
        chunks: [],
        stream: null,
        audioContext: null,
        analyser: null,
        rafId: null,
        maxTimer: null,
        speechDetected: false,
        onStop: null,
        mime: null
    };

    function isSupported() {
        return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia
            && window.MediaRecorder);
    }

    function pickMime() {
        const candidates = [
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/ogg;codecs=opus'
        ];
        for (const m of candidates) {
            if (window.MediaRecorder.isTypeSupported(m)) return m;
        }
        return ''; // 브라우저 기본
    }

    async function start(opts) {
        if (state.active) return;
        const o = opts || {};
        const silenceMs = o.silenceMs || DEFAULT_SILENCE_MS;
        const threshold = o.threshold || DEFAULT_THRESHOLD;
        const maxMs = o.maxMs || DEFAULT_MAX_MS;

        let stream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (e) {
            // 권한 거부 / 마이크 없음
            if (o.onError) {
                try { o.onError(e); } catch (_) {}
            }
            return;
        }

        const mime = pickMime();
        const recorder = mime
            ? new window.MediaRecorder(stream, { mimeType: mime })
            : new window.MediaRecorder(stream);

        const chunks = [];
        recorder.addEventListener('dataavailable', (e) => {
            if (e.data && e.data.size > 0) chunks.push(e.data);
        });

        recorder.addEventListener('stop', () => {
            const hadSpeech = state.speechDetected;
            const recordedMime = mime || (chunks[0] && chunks[0].type) || 'audio/webm';
            const blob = chunks.length ? new Blob(chunks, { type: recordedMime }) : null;
            const cb = state.onStop;
            cleanup();
            if (cb) {
                try { cb(blob, { hadSpeech: hadSpeech }); } catch (_) {}
            }
        });

        recorder.start();

        // VAD — AnalyserNode 로 RMS 측정
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioCtx();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        source.connect(analyser);
        const buf = new Float32Array(analyser.fftSize);
        let silenceStart = null;

        function tick() {
            if (!state.active) return;
            analyser.getFloatTimeDomainData(buf);
            let sum = 0;
            for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
            const rms = Math.sqrt(sum / buf.length);

            if (rms > threshold) {
                state.speechDetected = true;
                silenceStart = null;
            } else if (state.speechDetected) {
                if (silenceStart == null) {
                    silenceStart = performance.now();
                } else if (performance.now() - silenceStart > silenceMs) {
                    stop();
                    return;
                }
            }
            state.rafId = requestAnimationFrame(tick);
        }

        state.active = true;
        state.mediaRecorder = recorder;
        state.chunks = chunks;
        state.stream = stream;
        state.audioContext = ctx;
        state.analyser = analyser;
        state.onStop = o.onStop || null;
        state.speechDetected = false;
        state.mime = mime;
        state.rafId = requestAnimationFrame(tick);
        state.maxTimer = setTimeout(() => stop(), maxMs);
    }

    function stop() {
        if (!state.active || !state.mediaRecorder) return;
        // active 플래그를 먼저 내려 tick 루프가 더 돌지 않게
        state.active = false;
        try { state.mediaRecorder.stop(); }
        catch (_) { cleanup(); }
    }

    function cleanup() {
        if (state.rafId) cancelAnimationFrame(state.rafId);
        if (state.maxTimer) clearTimeout(state.maxTimer);
        if (state.audioContext) {
            try { state.audioContext.close(); } catch (_) {}
        }
        if (state.stream) {
            state.stream.getTracks().forEach((t) => { try { t.stop(); } catch (_) {} });
        }
        state.active = false;
        state.rafId = null;
        state.maxTimer = null;
        state.audioContext = null;
        state.analyser = null;
        state.stream = null;
        state.mediaRecorder = null;
        state.chunks = [];
    }

    function isActive() { return state.active; }

    root.AudioRecorder = { start, stop, isActive, isSupported };
})(typeof self !== 'undefined' ? self : this);
