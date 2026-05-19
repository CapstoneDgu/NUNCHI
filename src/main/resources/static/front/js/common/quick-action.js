// ========================================================
// quick-action.js — JS 측 음성 단축 명령 (LLM 호출 없이 즉시 처리)
//
// 정책 (느슨 매치 + critical 부정 가드):
//  - 화면 컨트롤만 처리. 메뉴 추천/카트 조작/자연어는 LLM.
//  - substring 매치 — 종결어미/조사 자동 흡수 ("결제할게요", "1층 메뉴 보여줘" 도 잡음).
//  - critical 액션(결제/홈)만 부정형 가드 — 잘못 트리거 시 피해 큰 것만 안전 처리.
//  - 그 외 액션(뒤로/층/결제수단/마이크)은 잘못 잡혀도 무해(쉽게 복구 가능) → 가드 없음.
//
// 사용:
//   if (window.QuickAction.try(text, { page: location.pathname })) return;
// ========================================================

(function () {
    'use strict';

    const LOG = '[QuickAction]';

    /**
     * 룰: { match, guard?, allowOn?, run }
     *  - match:   substring 정규식 — 어디에 있어도 잡음
     *  - guard:   매치되면 즉시 미발동 (부정 표현 등) — critical 액션만 사용
     *  - allowOn: 페이지 가드 — location.pathname 받아 boolean
     *  - run:     실행 콜백 (m: 정규식 match 객체)
     */
    const RULES = [
        // ───────── 결제하기 (critical — 부정 가드 + 카트 가드) ─────────
        {
            name: 'checkout',
            match: /결제/,
            guard: /(안|못|말고|그만|취소|싫어|아니|잠깐|아직|나중에)/,
            allowOn: (p) => p === '/menu' || p === '/summary',
            run: () => {
                // N02 에서는 카트 비어있으면 발동 안 함 (N02 가 노출한 함수가 알아서 처리)
                if (typeof window.__N02_gotoCheckout === 'function') {
                    window.__N02_gotoCheckout();
                } else {
                    location.href = '/summary';
                }
            },
        },

        // ───────── 처음으로 (critical — 세션 초기화 위험) ─────────
        {
            name: 'home',
            match: /(처음으로?|홈으로?|메인\s*화면|초기\s*화면)/,
            guard: /(안|못|말고|아니|잠깐|그만)/,
            run: () => location.href = '/start',
        },

        // ───────── 뒤로 (안전 — 가드 없음) ─────────
        {
            name: 'back',
            match: /(뒤로|이전\s*화면|이전으로|뒤로\s*가)/,
            run: () => {
                if (history.length > 1) history.back();
                else location.href = '/start';
            },
        },

        // ───────── 메뉴 화면 이동 (안전) ─────────
        {
            name: 'menu',
            match: /(메뉴(\s*화면)?(\s*보여)?|메뉴로\s*가|메뉴\s*보여|메뉴\s*가)/,
            // N02 에 이미 있으면 noop. 다른 페이지에서만 의미
            allowOn: (p) => p !== '/menu',
            run: () => location.href = '/menu',
        },

        // ───────── 주문 확인 (P01 단축 진입) ─────────
        {
            name: 'summary',
            match: /(주문\s*확인|확인\s*화면|장바구니\s*화면)/,
            allowOn: (p) => p !== '/summary',
            run: () => location.href = '/summary',
        },

        // ───────── N02 층 선택 (안전) ─────────
        {
            name: 'floor',
            match: /([1-3])\s*층/,
            allowOn: (p) => p === '/menu',
            run: (m) => document.querySelector(`[data-floor="F${m[1]}"]`)?.click(),
        },

        // ───────── P02 결제수단 (안전 — 카드 선택만, CTA 누르지 않음) ─────────
        {
            name: 'pay_kakao',
            match: /(카카오\s*페이?|카카오\s*바코드|카톡\s*페이?|바코드)/,
            allowOn: (p) => p === '/payment',
            run: () => document.querySelector('[data-method="barcode"]')?.click(),
        },
        {
            name: 'pay_ic',
            match: /(IC\s*카드|아이씨\s*카드|신용\s*카드|체크\s*카드|카드(?!오))/i,
            allowOn: (p) => p === '/payment',
            run: () => document.querySelector('[data-method="ic"]')?.click(),
        },
        {
            name: 'pay_vein',
            match: /(정맥|손바닥\s*정맥|손바닥\s*인증)/,
            allowOn: (p) => p === '/payment',
            run: () => document.querySelector('[data-method="vein"]')?.click(),
        },

        // ───────── 마이크 끄기 (안전) ─────────
        {
            name: 'mic_off',
            match: /마이크.{0,3}(꺼|종료|중지|오프|stop)/i,
            run: () => window.dispatchEvent(new CustomEvent('voice:stop')),
        },
    ];

    /**
     * 발화 텍스트를 검사. 매치되면 run 실행 + true 반환.
     */
    function tryAction(text, ctx) {
        const t = (text || '').trim();
        if (!t) return false;
        const page = (ctx && ctx.page) || (typeof location !== 'undefined' ? location.pathname : '');

        for (const rule of RULES) {
            // 1) page 가드
            if (rule.allowOn && !rule.allowOn(page)) continue;

            // 2) 매치 확인
            const m = t.match(rule.match);
            if (!m) continue;

            // 3) 부정 가드 — 매치되면 즉시 미발동 (LLM 으로 넘어감)
            if (rule.guard && rule.guard.test(t)) {
                console.log(LOG, '가드:', t, '→', rule.name);
                continue;
            }

            // 4) 실행
            try {
                console.log(LOG, '매치:', t, '→', rule.name);
                rule.run(m);
                return true;
            } catch (e) {
                console.warn(LOG, '실행 실패', rule.name, e);
                return false;
            }
        }
        return false;
    }

    window.QuickAction = { try: tryAction, RULES: RULES };
})();
