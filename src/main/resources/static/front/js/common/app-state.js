// ========================================================
// app-state.js — sessionStorage 기반 단일 상태 관리 모듈
//
// 흩어진 sessionStorage 키를 한 군데에서 관리.
// - 키 오타 방지 (KEYS 상수)
// - mode/dineOption 같은 값 정규화
// - JSON 객체 자동 직렬화/역직렬화 (CART 등)
// - onChange 구독 (UI 자동 갱신)
//
// 사용:
//   <script src="/js/common/app-state.js"></script>
//
//   AppState.set('SESSION_ID', 42);
//   const id = AppState.get('SESSION_ID');           // 42 (Number 자동 변환)
//   AppState.set('CART', [{menuId: 1, qty: 2}]);     // JSON 자동
//   const cart = AppState.get('CART');               // [{...}]
//
//   AppState.onChange('CART', (newVal) => updateMiniCart(newVal));
//   AppState.clear();                                // 전체 비움
//   AppState.clear('AI_SESSION_ID');                 // 특정 키만
//
// 키 정의:
//   SESSION_ID    — Spring Long 세션 ID
//   AI_SESSION_ID — FastAPI 세션 ID
//   MODE          — 'NORMAL' | 'AVATAR' (자동 대문자)
//   DINE_OPTION   — 'dine_in' | 'take_out'
//   CART          — JSON: P-flow 호환 카트 캐시
//   CURRENT_STEP  — 'S00' | 'S01' | ... | 'P05'
//   CURRENT_FLOOR / CURRENT_STORE / CURRENT_STORE_NAME
//   ORDER_ID / PAYMENT_ID / ORDER_SUMMARY
//   PAYMENT_METHOD / PAYMENT_STATUS
// ========================================================

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.AppState = factory();
    }
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    // ---------- 키 매핑 (논리키 → sessionStorage 실제 키) ----------
    const KEYS = Object.freeze({
        SESSION_ID:           'sessionId',
        AI_SESSION_ID:        'aiSessionId',
        MODE:                 'mode',
        DINE_OPTION:          'dineOption',
        CART:                 'cart',
        CURRENT_STEP:         'currentStep',
        CURRENT_FLOOR:        'currentFloor',
        CURRENT_STORE:        'currentStore',
        CURRENT_STORE_NAME:   'currentStoreName',
        ORDER_ID:             'orderId',
        ORDER_SUMMARY:        'orderSummary',
        PAYMENT_ID:           'paymentId',
        PAYMENT_METHOD:       'paymentMethod',
        PAYMENT_STATUS:       'paymentStatus',
    });

    // JSON 직렬화 대상 키 — set 시 stringify, get 시 parse
    const JSON_KEYS = new Set(['CART', 'ORDER_SUMMARY']);

    // 값 정규화 — set 직전 적용
    function normalize(key, value) {
        if (value == null) return value;
        if (key === 'MODE') return String(value).toUpperCase();
        if (key === 'DINE_OPTION') return String(value).toLowerCase();
        return value;
    }

    // 논리키 → 실제 sessionStorage 키. 미정의 논리키는 그대로 사용 (자유 키 허용).
    function resolveKey(logicalKey) {
        return KEYS[logicalKey] || logicalKey;
    }

    // 구독자 — Map<storageKey, Set<callback>>
    const subs = new Map();

    function notify(storageKey, value) {
        const set = subs.get(storageKey);
        if (!set) return;
        set.forEach((cb) => {
            try { cb(value); } catch (e) { console.warn('[AppState] onChange 콜백 오류', e); }
        });
    }

    function get(logicalKey) {
        const sk = resolveKey(logicalKey);
        const raw = sessionStorage.getItem(sk);
        if (raw == null) return null;
        if (JSON_KEYS.has(logicalKey)) {
            try { return JSON.parse(raw); }
            catch (_) { return null; }
        }
        return raw;
    }

    function set(logicalKey, value) {
        const sk = resolveKey(logicalKey);
        if (value == null) {
            sessionStorage.removeItem(sk);
            notify(sk, null);
            return;
        }
        const v = normalize(logicalKey, value);
        const stored = JSON_KEYS.has(logicalKey) ? JSON.stringify(v) : String(v);
        sessionStorage.setItem(sk, stored);
        notify(sk, v);
    }

    function remove(logicalKey) {
        set(logicalKey, null);
    }

    /**
     * @returns {Function} unsubscribe 함수
     */
    function onChange(logicalKey, cb) {
        const sk = resolveKey(logicalKey);
        if (!subs.has(sk)) subs.set(sk, new Set());
        subs.get(sk).add(cb);
        return () => subs.get(sk).delete(cb);
    }

    /** 전체 또는 특정 키만 비움. */
    function clear(...logicalKeys) {
        if (logicalKeys.length === 0) {
            sessionStorage.clear();
            subs.forEach((set, sk) => notify(sk, null));
            return;
        }
        logicalKeys.forEach((k) => remove(k));
    }

    return {
        KEYS,
        get, set, remove, onChange, clear,
    };
});
