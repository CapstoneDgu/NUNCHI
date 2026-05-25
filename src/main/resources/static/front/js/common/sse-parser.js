// ========================================================
// sse-parser.js — Server-Sent Events 본문 파서
//
// 책임: ReadableStream 형태의 SSE 응답 본문을 파싱해 type 별 핸들러로 라우팅.
// 호출처: api.js 의 Ai.chatStream() — /ai/order/chat/stream 응답 처리.
//
// 이벤트 포맷 (NUNCHI FastAPI):
//   data: {"type":"token","text":"오늘"}\n\n
//   data: {"type":"done","reply":"...","recommendations":[...],...}\n\n
//   data: {"type":"error","message":"..."}\n\n
//
// 청크 경계가 이벤트 중간(\n\n 이전)에 떨어질 수 있으므로 잔여 buf 를 다음 청크로 이월.
// JSON 파싱 실패한 라인은 건너뛰고 다음 라인 계속 처리.
// kept_alive 등 알 수 없는 type 은 조용히 무시 (연결 유지 핑).
//
// UMD: 브라우저(window.SseParser) / Node(require) 양쪽 사용 가능.
// ========================================================

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.SseParser = factory();
    }
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    /**
     * 단일 SSE 이벤트 블록(여러 줄 가능) 을 파싱.
     * @param {string} block — "data: {...}" 형태의 한 이벤트 (개행 포함 가능)
     * @returns {object|null} — 파싱된 이벤트 객체, 또는 파싱 실패/빈 블록이면 null
     */
    function parseEventBlock(block) {
        const lines = block.split('\n');
        let dataStr = '';
        for (const line of lines) {
            if (line.startsWith('data:')) {
                // SSE 스펙: "data:" 뒤 공백 1개는 무시
                dataStr += line.slice(5).replace(/^ /, '');
            }
        }
        if (!dataStr) return null;
        try {
            return JSON.parse(dataStr);
        } catch (_) {
            return null;
        }
    }

    /**
     * 파싱된 이벤트를 type 별 핸들러로 라우팅.
     * @param {object} ev — { type, ...payload }
     * @param {{onToken?:Function, onDone?:Function, onError?:Function}} handlers
     */
    function dispatchEvent(ev, handlers) {
        if (!ev || !ev.type || !handlers) return;
        if (ev.type === 'token' && handlers.onToken) {
            handlers.onToken(ev.text || '');
        } else if (ev.type === 'done' && handlers.onDone) {
            handlers.onDone(ev);
        } else if (ev.type === 'error' && handlers.onError) {
            handlers.onError(ev.message || '오류가 발생했습니다.');
        }
        // 그 외 type (kept_alive 등) 은 조용히 무시
    }

    /**
     * fetch().body (ReadableStream) 를 끝까지 읽으며 이벤트 단위로 핸들러 호출.
     * @param {ReadableStream} stream — fetch Response.body
     * @param {{onToken?:Function, onDone?:Function, onError?:Function}} handlers
     * @returns {Promise<void>} — 스트림 종료 시 resolve
     */
    async function consume(stream, handlers) {
        const reader = stream.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    // 마지막 미완성 라인이 있으면 그것도 시도
                    if (buf.trim()) {
                        const ev = parseEventBlock(buf);
                        if (ev) dispatchEvent(ev, handlers);
                    }
                    return;
                }
                buf += decoder.decode(value, { stream: true });
                const parts = buf.split('\n\n');
                buf = parts.pop(); // 마지막은 미완성일 수 있으므로 보관
                for (const part of parts) {
                    const ev = parseEventBlock(part);
                    if (ev) dispatchEvent(ev, handlers);
                }
            }
        } finally {
            try { reader.releaseLock(); } catch (_) {}
        }
    }

    /**
     * 청크 단위로 누적 → 완성된 이벤트만 콜백.
     * 테스트/특수 환경에서 ReadableStream 없이 청크를 직접 공급할 때 사용.
     * @param {string} chunk — 새로 도착한 텍스트
     * @param {string} prevBuf — 이전 잔여 버퍼
     * @param {(ev:object)=>void} onEvent — 완성된 이벤트마다 호출
     * @returns {string} — 다음 청크로 이월할 새 buf
     */
    function feedChunk(chunk, prevBuf, onEvent) {
        const merged = (prevBuf || '') + chunk;
        const parts = merged.split('\n\n');
        const remainder = parts.pop();
        for (const part of parts) {
            const ev = parseEventBlock(part);
            if (ev) onEvent(ev);
        }
        return remainder;
    }

    return {
        parseEventBlock,
        dispatchEvent,
        consume,
        feedChunk,
    };
});
