// ========================================================
// api-client.js — Spring REST 호출 공통 모듈
//
// 백엔드 응답 포맷: ApiResponse<T> = { code: int, msg: string, data: T }
//   - code === 200 이면 .data 반환, 아니면 NunchiApiError throw.
//   - 검증 실패는 HTTP 400 + code === "NOT_VALID_EXCEPTION".
//
// 사용 예:
//   const session = await NunchiApi.Sessions.create("AVATAR", "ko");
//   const cart    = await NunchiApi.Cart.addItem({ sessionId, menuId, quantity: 1, optionIds: [] });
//
// 의존: 없음 (jQuery 미사용, fetch + Promise)
// ========================================================
(function () {
    'use strict';

    const BASE_URL = window.location.origin;
    const DEFAULT_TIMEOUT_MS = 8000;  // fetch 타임아웃 기본값

    class NunchiApiError extends Error {
        constructor(message, opts) {
            super(message);
            this.name = 'NunchiApiError';
            this.httpStatus = opts && opts.httpStatus;
            this.code       = opts && opts.code;
            this.msg        = opts && opts.msg;
            this.body       = opts && opts.body;
        }
    }

    /**
     * 공통 fetch 래퍼.
     *  - JSON 직렬화/역직렬화
     *  - ApiResponse 언래핑
     *  - 비-2xx 또는 code !== 200 시 NunchiApiError throw
     *  - timeoutMs(기본 8초) 경과 시 AbortController 로 중단 → TIMEOUT 에러
     */
    async function request(method, path, body, query, opts) {
        const url = new URL(path, BASE_URL);
        if (query) {
            Object.entries(query).forEach(([k, v]) => {
                if (v === undefined || v === null || v === '') return;
                if (Array.isArray(v)) {
                    if (v.length === 0) return;
                    url.searchParams.set(k, v.join(','));
                } else {
                    url.searchParams.set(k, String(v));
                }
            });
        }
        const controller = new AbortController();
        const timeoutMs = (opts && Number.isFinite(opts.timeoutMs)) ? opts.timeoutMs : DEFAULT_TIMEOUT_MS;
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        const init = { method, headers: { 'Accept': 'application/json' }, signal: controller.signal };
        if (body !== undefined && body !== null) {
            init.headers['Content-Type'] = 'application/json';
            init.body = JSON.stringify(body);
        }

        let res;
        try {
            res = await fetch(url.toString(), init);
        } catch (networkErr) {
            clearTimeout(timer);
            const isAbort = networkErr && (networkErr.name === 'AbortError' || controller.signal.aborted);
            if (isAbort) {
                throw new NunchiApiError('요청 시간이 초과되었어요.', {
                    httpStatus: 0, code: 'TIMEOUT', msg: `timeout ${timeoutMs}ms`
                });
            }
            throw new NunchiApiError('네트워크 오류로 요청을 완료하지 못했어요.', {
                httpStatus: 0, code: 'NETWORK_ERROR', msg: networkErr && networkErr.message
            });
        }
        clearTimeout(timer);

        let payload = null;
        try { payload = await res.json(); } catch (_) { /* 응답이 비어있을 수도 있음 */ }

        if (!res.ok) {
            const code = (payload && payload.code) || res.status;
            const msg  = (payload && payload.msg)  || res.statusText || '요청 실패';
            throw new NunchiApiError(msg, { httpStatus: res.status, code, msg, body: payload });
        }

        // 성공 응답이라도 ApiResponse code 가 200 이 아니면 실패로 처리
        if (payload && typeof payload === 'object' && 'code' in payload) {
            if (payload.code !== 200 && payload.code !== '200') {
                throw new NunchiApiError(payload.msg || '비즈니스 오류', {
                    httpStatus: res.status, code: payload.code, msg: payload.msg, body: payload
                });
            }
            return payload.data;
        }
        return payload;
    }

    // ----------------------------------------------------
    // 도메인별 메서드 그룹
    // ----------------------------------------------------

    const Sessions = {
        // POST /api/sessions { mode, language }
        create(mode, language) {
            return request('POST', '/api/sessions', { mode, language: language || 'ko' });
        },
        // PATCH /api/sessions/{id}/complete
        complete(sessionId) {
            return request('PATCH', `/api/sessions/${encodeURIComponent(sessionId)}/complete`);
        },
        // POST /api/sessions/{id}/messages { role, text }
        saveMessage(sessionId, role, text) {
            if (!text || !text.trim()) return Promise.resolve(null);
            return request('POST', `/api/sessions/${encodeURIComponent(sessionId)}/messages`, {
                role, text: text.trim()
            });
        },
        // POST /api/sessions/{id}/tool-logs { toolName, request, response }
        saveToolLog(sessionId, toolName, requestObj, responseObj) {
            return request('POST', `/api/sessions/${encodeURIComponent(sessionId)}/tool-logs`, {
                toolName,
                request: typeof requestObj === 'string' ? requestObj : JSON.stringify(requestObj || {}),
                response: typeof responseObj === 'string' ? responseObj : JSON.stringify(responseObj || {})
            });
        },
        // GET /api/sessions/{id}/tool-logs
        listToolLogs(sessionId) {
            return request('GET', `/api/sessions/${encodeURIComponent(sessionId)}/tool-logs`);
        }
    };

    const Menus = {
        categories() { return request('GET', '/api/menus/categories'); },
        list({ categoryId } = {}) {
            return request('GET', '/api/menus', null, { categoryId });
        },
        top(limit) {
            return request('GET', '/api/menus/top', null, { limit });
        },
        detail(menuId) {
            return request('GET', `/api/menus/${encodeURIComponent(menuId)}`);
        },
        // GET /api/menus/filter — 매개변수는 plan 의 매핑 표 참고
        filter(params) {
            return request('GET', '/api/menus/filter', null, params || {});
        }
    };

    const Cart = {
        get(sessionId) {
            return request('GET', `/api/orders/cart/${encodeURIComponent(sessionId)}`);
        },
        addItem({ sessionId, menuId, quantity, optionIds }) {
            return request('POST', '/api/orders/cart/items', {
                sessionId, menuId, quantity, optionIds: optionIds || []
            });
        },
        updateItem(sessionId, itemId, quantity) {
            return request('PUT',
                `/api/orders/cart/${encodeURIComponent(sessionId)}/items/${encodeURIComponent(itemId)}`,
                { quantity }
            );
        },
        removeItem(sessionId, itemId) {
            return request('DELETE',
                `/api/orders/cart/${encodeURIComponent(sessionId)}/items/${encodeURIComponent(itemId)}`
            );
        }
    };

    const Orders = {
        confirm(sessionId) {
            return request('POST', '/api/orders/confirm', { sessionId });
        },
        cancel(orderId) {
            return request('PATCH', `/api/orders/${encodeURIComponent(orderId)}/cancel`);
        }
    };

    const Payments = {
        create(orderId, method) {
            return request('POST', '/api/payments', { orderId, method });
        },
        markSuccess(paymentId) {
            return request('PATCH', `/api/payments/${encodeURIComponent(paymentId)}/success`);
        },
        markFail(paymentId) {
            return request('PATCH', `/api/payments/${encodeURIComponent(paymentId)}/fail`);
        },
        get(paymentId) {
            return request('GET', `/api/payments/${encodeURIComponent(paymentId)}`);
        }
    };

    const Recommendations = {
        get(type, categoryId) {
            return request('GET', '/api/recommendations', null, { type, categoryId });
        }
    };

    // export
    window.NunchiApi = { Sessions, Menus, Cart, Orders, Payments, Recommendations, Error: NunchiApiError };
})();
