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
    // 로컬 개발: 페이지가 localhost 면 Spring 은 same-origin(`''`),
    //           FastAPI(/ai/**) 는 원격 FastAPI(sslip.io HTTPS) 로 직결.
    //           ※ 원격 FastAPI 는 원격 Spring 세션을 검증함 — 로컬 Spring 으로 만든
    //             session_id 와 다를 수 있으므로 AI 화면은 /ai/order/start 로 새 세션 발급해 사용.
    // 운영: 둘 다 same-origin (`''`) — nginx 가 /ai/** 를 FastAPI 로 매핑.
    // 참고: raw IP(43.201.20.11:8000)는 포트 닫혀 있음. sslip.io 도메인만 노출.
    const LOCAL_FASTAPI = 'https://43-201-20-11.sslip.io';   // 원격 NUNCHI-AI (sslip.io DNS → 443 → FastAPI)
    const isLocalHost = (typeof location !== 'undefined') &&
        (location.hostname === 'localhost' || location.hostname === '127.0.0.1');

    /** path 별 base URL 결정. /ai/** 는 FastAPI(로컬=sslip.io HTTPS 직결, 운영=same-origin), 그 외는 Spring. */
    function resolveUrl(path) {
        if (path.startsWith('/ai/')) {
            return (isLocalHost ? LOCAL_FASTAPI : '') + path;
        }
        return path; // Spring 은 same-origin
    }

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
        const url = resolveUrl(path);
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
     * 바이너리 응답용 — Blob 반환. 4xx/5xx 면 ApiError throw.
     */
    async function requestBinary(method, path, body) {
        const url = resolveUrl(path);
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
        const url = resolveUrl(path);
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

    // /api/voice — Google Cloud TTS (Spring 프록시). STT 는 Web Speech API 가 처리.
    const Voice = {
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

    // /ai/order/chat 동시 호출 차단용 락.
    // 운영 FastAPI 는 chat 1건이 5~16초(LangGraph 다단계 LLM)라 처리 중에
    // 두 번째 요청이 겹치면 nginx 가 빈 업스트림을 못 얻어 즉시 502 를 낸다.
    // 음성 루프는 발화/소음/재시도로 요청이 상시 겹치므로, 진행 중이면 새 요청을 버린다(큐잉X).
    let _chatInFlight = false;

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
            // 이미 처리 중이면 새 발화는 버린다 — 중첩이 운영 서버 502 의 원인.
            if (_chatInFlight) {
                const busy = new ApiError(429, '이전 음성 요청을 처리하고 있어요.', 0, '/ai/order/chat');
                busy._busy = true;
                return Promise.reject(busy);
            }
            const payload = {
                session_id: body.session_id,
                text: body.text,
                mode: body.mode || 'AVATAR',
            };
            if (body.nunchi_signal) payload.nunchi_signal = body.nunchi_signal;
            _chatInFlight = true;
            return requestRaw('POST', '/ai/order/chat', payload)
                .finally(() => { _chatInFlight = false; });
        },
        /**
         * 사용자 발화 처리 — SSE 스트리밍.
         * /ai/order/chat 과 요청 body 동일, 응답은 SSE 이벤트 스트림.
         *
         * 이벤트 종류:
         *   - token : { type:"token", text:"오늘" }  — LLM 토큰 도착 즉시 (말풍선에 append)
         *   - done  : { type:"done", reply, recommendations, menu_options, suggestions,
         *              action, current_step }       — 전체 응답 완료 (후처리 분기 시점)
         *   - error : { type:"error", message }     — 백엔드 오류
         *
         * 동시 호출 정책은 chat() 과 동일 — done 까지는 신규 호출 즉시 reject.
         * OOD(clarify_responder) 응답은 token 없이 done 만 올 수 있다 — 호출부에서 fallback 필요.
         *
         * @param {{session_id:number, text:string, nunchi_signal?:string, mode?:string}} body
         * @param {{onToken?:(t:string)=>void, onDone?:(d:object)=>void, onError?:(m:string)=>void}} [handlers]
         * @returns {Promise<void>} 스트림 종료 시 resolve
         */
        chatStream(body, handlers) {
            if (!body || body.session_id == null || !body.text) {
                throw new Error('Ai.chatStream: session_id, text 필수');
            }
            if (_chatInFlight) {
                const busy = new ApiError(429, '이전 음성 요청을 처리하고 있어요.', 0, '/ai/order/chat/stream');
                busy._busy = true;
                return Promise.reject(busy);
            }
            const payload = {
                session_id: body.session_id,
                text: body.text,
                mode: body.mode || 'AVATAR',
            };
            if (body.nunchi_signal) payload.nunchi_signal = body.nunchi_signal;

            const onToken = handlers && handlers.onToken;
            const onDone  = handlers && handlers.onDone;
            const onError = handlers && handlers.onError;

            const url = resolveUrl('/ai/order/chat/stream');
            _chatInFlight = true;

            return fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'text/event-stream',
                },
                credentials: 'same-origin',
                body: JSON.stringify(payload),
            }).then((res) => {
                if (!res.ok) {
                    throw new ApiError(res.status, 'SSE 연결 실패: ' + res.status, res.status, '/ai/order/chat/stream');
                }
                if (!res.body) {
                    throw new ApiError(0, 'SSE 응답 본문이 없습니다.', res.status, '/ai/order/chat/stream');
                }
                if (!window.SseParser) {
                    throw new ApiError(0, 'SseParser 가 로드되지 않았습니다 (sse-parser.js 누락).', 0, '/ai/order/chat/stream');
                }
                return window.SseParser.consume(res.body, { onToken, onDone, onError });
            }).finally(() => { _chatInFlight = false; });
        },
        /**
         * 추천/옵션 선택 후 메뉴를 장바구니에 직접 담음 (옵션 선택 UI 거친 뒤 사용).
         * @param {{session_id:number, menu_id:number, quantity:number, option_ids:number[]}} body
         * @returns {Promise<{sessionId, items, totalAmount}>}
         */
        cartAdd(body) {
            if (!body || body.session_id == null || body.menu_id == null) {
                throw new Error('Ai.cartAdd: session_id, menu_id 필수');
            }
            const payload = {
                session_id: body.session_id,
                menu_id: body.menu_id,
                quantity: body.quantity || 1,
                option_ids: Array.isArray(body.option_ids) ? body.option_ids : [],
            };
            return requestRaw('POST', '/ai/api/order/cart/add', payload);
        },
        /**
         * AI 대화 없이 현재 장바구니를 즉시 조회.
         * @param {number} sessionId
         * @returns {Promise<{sessionId, items, totalAmount}>}
         */
        cartGet(sessionId) {
            if (sessionId == null) throw new Error('Ai.cartGet: sessionId 필수');
            return requestRaw('GET', `/ai/api/order/cart/${encodeURIComponent(sessionId)}`);
        },
    };

    // ---------- 글로벌 노출 ----------
    const Api = {
        ApiError,
        get, post, put, patch, del,
        session, menu, cart, order, payment, recommend, Ai, Voice,
    };

    window.Api = Api; // 짧은 별칭 (페이지 JS 에서 권장)
    // api-client.js(대문자 NunchiApi.Cart/Sessions/...) 가 이미 로드된 페이지에서는
    // 그 객체를 덮어쓰지 않는다. (P 화면들은 api-client.js 의 NunchiApi 를 사용)
    if (!window.NunchiApi) window.NunchiApi = Api;

    // 디버그 모드 토글: 콘솔에서 window.__NUNCHI_API_DEBUG__ = true
})();
