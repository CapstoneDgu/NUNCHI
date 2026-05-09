// ========================================================
// api.js — NUNCHI 공통 백엔드 API 클라이언트
// 책임:
//   - 모든 fetch 호출의 단일 진입점
//   - ApiResponse<T> ({ code, msg, data }) 자동 언래핑 → data 만 반환
//   - HTTP/비즈니스 에러 표준화 → ApiError 로 throw
//   - 도메인별 호출 헬퍼 제공 (session / menu / cart / order / payment / recommend)
//
// 사용:
//   <script src="/js/common/api.js"></script>
//   const session = await Api.session.create({ mode: "NORMAL", language: "ko" });
//   sessionStorage.setItem("sessionId", session.sessionId);
//
// 약속:
//   - Spring Boot 가 정적 리소스도 함께 서빙하므로 same-origin → BASE_URL 비움
//   - 페이지 JS 에서 fetch() 직접 호출 금지. 무조건 이 모듈 경유.
//   - 새 도메인/엔드포인트가 생기면 이 파일에만 추가하고 페이지 JS 는 헬퍼만 호출.
// ========================================================

(function () {
    'use strict';

    const LOG = '[Api]';
    // 운영 도메인 — nginx 가 /api/** → Spring, /ai/** → FastAPI 로 매핑
    const BASE_URL = 'https://43-201-20-11.sslip.io';

    // ---------- 에러 타입 ----------
    /** 서버가 ApiResponse 포맷으로 돌려준 4xx/5xx 또는 네트워크 실패. */
    class ApiError extends Error {
        constructor(code, msg, status, path) {
            super(msg || '요청 처리 중 오류가 발생했습니다.');
            this.name = 'ApiError';
            this.code = code;     // 서버 ApiResponse.code (없으면 HTTP status)
            this.status = status; // HTTP status
            this.path = path;
        }
    }

    // ---------- 저레벨 fetch 래퍼 ----------
    /**
     * Spring 전용 — ApiResponse<T> 자동 언래핑.
     * FastAPI 같은 raw JSON 응답에는 requestRaw 사용.
     */
    async function request(method, path, body) {
        const url = BASE_URL + path;
        const init = {
            method,
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
        };
        if (body !== undefined && body !== null) {
            init.body = JSON.stringify(body);
        }

        let res;
        try {
            res = await fetch(url, init);
        } catch (networkErr) {
            console.error(LOG, method, path, '네트워크 실패', networkErr);
            throw new ApiError(0, '서버에 연결할 수 없습니다.', 0, path);
        }

        // 204 No Content / 본문 없는 응답 방어
        let json = null;
        const text = await res.text();
        if (text) {
            try { json = JSON.parse(text); }
            catch (e) {
                console.error(LOG, method, path, 'JSON 파싱 실패', text);
                throw new ApiError(res.status, '응답 파싱에 실패했습니다.', res.status, path);
            }
        }

        if (!res.ok) {
            const code = json && typeof json.code === 'number' ? json.code : res.status;
            const msg  = (json && json.msg) || ('HTTP ' + res.status);
            console.warn(LOG, method, path, '실패', { status: res.status, code, msg });
            throw new ApiError(code, msg, res.status, path);
        }

        // ApiResponse<T> 언래핑: { code, msg, data } → data
        const data = json && Object.prototype.hasOwnProperty.call(json, 'data') ? json.data : json;
        if (window.__NUNCHI_API_DEBUG__) {
            console.debug(LOG, method, path, data);
        }
        return data;
    }

    const get   = (path)        => request('GET',    path);
    const post  = (path, body)  => request('POST',   path, body);
    const put   = (path, body)  => request('PUT',    path, body);
    const patch = (path, body)  => request('PATCH',  path, body);
    const del   = (path)        => request('DELETE', path);

    /**
     * Spring multipart 업로드용 — ApiResponse 언래핑.
     * Content-Type 은 브라우저가 boundary 포함하여 자동 설정 (직접 지정 X).
     */
    async function requestMultipart(method, path, formData) {
        const url = BASE_URL + path;
        const init = {
            method,
            credentials: 'same-origin',
            body: formData,
        };

        let res;
        try {
            res = await fetch(url, init);
        } catch (networkErr) {
            console.error(LOG, method, path, '네트워크 실패', networkErr);
            throw new ApiError(0, '서버에 연결할 수 없습니다.', 0, path);
        }

        let json = null;
        const text = await res.text();
        if (text) {
            try { json = JSON.parse(text); }
            catch (e) {
                throw new ApiError(res.status, '응답 파싱에 실패했습니다.', res.status, path);
            }
        }

        if (!res.ok) {
            const code = json && typeof json.code === 'number' ? json.code : res.status;
            const msg  = (json && json.msg) || ('HTTP ' + res.status);
            throw new ApiError(code, msg, res.status, path);
        }

        const data = json && Object.prototype.hasOwnProperty.call(json, 'data') ? json.data : json;
        if (window.__NUNCHI_API_DEBUG__) console.debug(LOG, method, path, data);
        return data;
    }

    /**
     * 바이너리 응답용 — Blob 반환. 4xx/5xx 면 ApiError throw.
     */
    async function requestBinary(method, path, body) {
        const url = BASE_URL + path;
        const init = {
            method,
            headers: { 'Content-Type': 'application/json', 'Accept': 'audio/*, application/json' },
            credentials: 'same-origin',
        };
        if (body !== undefined && body !== null) {
            init.body = JSON.stringify(body);
        }

        let res;
        try {
            res = await fetch(url, init);
        } catch (networkErr) {
            console.error(LOG, method, path, '네트워크 실패', networkErr);
            throw new ApiError(0, '서버에 연결할 수 없습니다.', 0, path);
        }

        if (!res.ok) {
            // 에러 시엔 JSON 으로 내려옴 (ApiResponse fail)
            let json = null;
            try { json = await res.json(); } catch (_) {}
            const code = json && typeof json.code === 'number' ? json.code : res.status;
            const msg  = (json && json.msg) || ('HTTP ' + res.status);
            throw new ApiError(code, msg, res.status, path);
        }

        return await res.blob();
    }

    /**
     * FastAPI(raw JSON) 호출용 — ApiResponse 언래핑 없음.
     * 4xx/5xx 시 FastAPI 에러 포맷 ({ detail }) 또는 Spring 포맷 ({ code, msg }) 양쪽 매핑.
     */
    async function requestRaw(method, path, body) {
        const url = BASE_URL + path;
        const init = {
            method,
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            credentials: 'same-origin',
        };
        if (body !== undefined && body !== null) {
            init.body = JSON.stringify(body);
        }

        let res;
        try {
            res = await fetch(url, init);
        } catch (networkErr) {
            console.error(LOG, method, path, '네트워크 실패', networkErr);
            throw new ApiError(0, '서버에 연결할 수 없습니다.', 0, path);
        }

        let json = null;
        const text = await res.text();
        if (text) {
            try { json = JSON.parse(text); }
            catch (e) {
                console.error(LOG, method, path, 'JSON 파싱 실패', text);
                throw new ApiError(res.status, '응답 파싱에 실패했습니다.', res.status, path);
            }
        }

        if (!res.ok) {
            // FastAPI: { detail: "..." } 또는 { detail: [{msg, ...}] } 또는 Spring: { code, msg }
            const detail = json && json.detail;
            const msg = (json && json.msg)
                || (typeof detail === 'string' ? detail : null)
                || (Array.isArray(detail) && detail[0] && detail[0].msg)
                || ('HTTP ' + res.status);
            const code = (json && typeof json.code === 'number') ? json.code : res.status;
            console.warn(LOG, method, path, '실패', { status: res.status, msg });
            throw new ApiError(code, msg, res.status, path);
        }

        if (window.__NUNCHI_API_DEBUG__) {
            console.debug(LOG, method, path, json);
        }
        return json;
    }

    // ---------- 도메인 헬퍼 ----------

    // /api/sessions
    const session = {
        /** @param {{mode:"NORMAL"|"AVATAR", language?:string}} body */
        create(body)               { return post('/api/sessions', body); },
        complete(sessionId)        { return patch(`/api/sessions/${sessionId}/complete`); },
        saveMessage(sessionId, b)  { return post(`/api/sessions/${sessionId}/messages`, b); },
        saveToolLog(sessionId, b)  { return post(`/api/sessions/${sessionId}/tool-logs`, b); },
        getToolLogs(sessionId, limit = 50) {
            return get(`/api/sessions/${sessionId}/tool-logs?limit=${limit}`);
        },
    };

    // /api/menus
    const menu = {
        categories()               { return get('/api/menus/categories'); },
        list(categoryId)           {
            const q = categoryId != null ? `?categoryId=${categoryId}` : '';
            return get('/api/menus' + q);
        },
        detail(menuId)             { return get(`/api/menus/${menuId}`); },
        top(limit = 5)             { return get(`/api/menus/top?limit=${limit}`); },
    };

    // /api/orders/cart, /api/orders/confirm, /api/orders/{id}/cancel
    const cart = {
        get(sessionId)             { return get(`/api/orders/cart/${sessionId}`); },
        /** @param {{sessionId:number, menuId:number, quantity:number, optionIds:number[]}} body */
        addItem(body)              { return post('/api/orders/cart/items', body); },
        /** itemId 는 서버가 발급한 UUID 문자열 */
        updateItem(sessionId, itemId, quantity) {
            return put(`/api/orders/cart/${sessionId}/items/${itemId}`, { quantity });
        },
        removeItem(sessionId, itemId) {
            return del(`/api/orders/cart/${sessionId}/items/${itemId}`);
        },
    };

    const order = {
        confirm(sessionId)         { return post('/api/orders/confirm', { sessionId }); },
        cancel(orderId)            { return patch(`/api/orders/${orderId}/cancel`); },
    };

    // /api/payments
    const payment = {
        /** @param {{orderId:number, method:"IC_CARD"|"VEIN"|string}} body */
        request(body)              { return post('/api/payments', body); },
        success(paymentId)         { return patch(`/api/payments/${paymentId}/success`); },
        fail(paymentId)            { return patch(`/api/payments/${paymentId}/fail`); },
        get(paymentId)             { return get(`/api/payments/${paymentId}`); },
    };

    // /api/recommendations
    const recommend = {
        /** @param {"DEFAULT"|"CATEGORY"|"POPULAR"} type */
        get(type, categoryId) {
            const q = categoryId != null
                ? `?type=${type}&categoryId=${categoryId}`
                : `?type=${type}`;
            return get('/api/recommendations' + q);
        },
    };

    // /api/voice — Google Cloud STT/TTS (Spring 프록시)
    const Voice = {
        /**
         * 음성 인식 (STT).
         * @param {Blob} audioBlob audio/webm;codecs=opus 권장
         * @returns {Promise<{text:string, confidence:number}>}
         */
        transcribe(audioBlob) {
            const fd = new FormData();
            fd.append('audio', audioBlob, 'speech.webm');
            return requestMultipart('POST', '/api/voice/transcribe', fd);
        },
        /**
         * 음성 합성 (TTS) — Blob(audio/mpeg) 반환.
         * @param {string} text
         * @param {string} [voice] 비우면 서버 기본
         * @returns {Promise<Blob>}
         */
        synthesize(text, voice) {
            const body = { text };
            if (voice) body.voice = voice;
            return requestBinary('POST', '/api/voice/synthesize', body);
        }
    };

    // /ai/order/* — FastAPI AI 서버 (nginx /ai/** 매핑)
    const Ai = {
        /**
         * 주문 세션 시작.
         * @param {{mode?:"AVATAR"|"TOUCH", language?:string, order_type?:"DINE_IN"|"TAKE_OUT"}} body
         * @returns {Promise<{session_id:number, greeting:string}>}
         */
        start(body) {
            const payload = {
                mode: (body && body.mode) || 'AVATAR',
                language: (body && body.language) || 'ko',
                order_type: (body && body.order_type) || 'DINE_IN',
            };
            return requestRaw('POST', '/ai/order/start', payload);
        },
        /**
         * 사용자 발화 처리.
         * @param {{session_id:number, text:string, nunchi_signal?:string, mode?:string}} body
         * @returns {Promise<{session_id:number, reply:string}>}
         */
        chat(body) {
            if (!body || body.session_id == null || !body.text) {
                throw new Error('Ai.chat: session_id, text 필수');
            }
            const payload = {
                session_id: body.session_id,
                text: body.text,
                mode: body.mode || 'AVATAR',
            };
            if (body.nunchi_signal) payload.nunchi_signal = body.nunchi_signal;
            return requestRaw('POST', '/ai/order/chat', payload);
        },
    };

    // ---------- 글로벌 노출 ----------
    const Api = {
        ApiError,
        get, post, put, patch, del,
        session, menu, cart, order, payment, recommend, Ai, Voice,
    };

    window.NunchiApi = Api;
    window.Api = Api; // 짧은 별칭 (페이지 JS 에서 권장)

    // 디버그 모드 토글: 콘솔에서 window.__NUNCHI_API_DEBUG__ = true
})();
