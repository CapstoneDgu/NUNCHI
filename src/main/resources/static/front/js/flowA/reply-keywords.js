// ========================================================
// reply-keywords.js — FastAPI AI reply 후처리용 키워드 매칭 헬퍼.
//
// FastAPI 의 /api/order/chat 응답(reply)에 특정 키워드가 포함되면
// 프론트가 추가 동작을 트리거한다:
//   - replyHasCartChange : Spring 카트를 강제 재조회해야 하는 신호
//   - replyHasComplete   : P05 완료 화면으로 라우팅해야 하는 신호
//   - guessStep          : reply 텍스트로 기/승/전/결 단계 추정
//                         (서버가 응답에 currentStep 안 줄 때 fallback)
//
// UMD: 브라우저(window.ReplyKeywords) / Node(require) 양쪽 사용 가능.
// ========================================================

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.ReplyKeywords = factory();
    }
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const CART_PATTERN = /(담았어요|비웠어요|장바구니|담아드렸어요)/;
    const COMPLETE_PATTERN = /(결제가 완료|세션이 종료)/;

    // step 추정 키워드
    const STEP_CHECKOUT_PATTERN = /(결제|마무리|주문할게|주문 확정|총 ?[\d,]+원|결제 ?화면)/;
    const STEP_CONFIGURE_PATTERN = /(매운맛|맵기|토핑|옵션|곱빼기|사이즈|추가|빼고|빼주세요)/;
    const STEP_SELECT_PATTERN = /(추천|골라|찾아|어떠세요|이건 ?어때)/;

    function replyHasCartChange(text) {
        if (typeof text !== 'string' || text.length === 0) return false;
        return CART_PATTERN.test(text);
    }

    function replyHasComplete(text) {
        if (typeof text !== 'string' || text.length === 0) return false;
        return COMPLETE_PATTERN.test(text);
    }

    /**
     * reply 텍스트 → 단계 추정. 서버 currentStep 미제공 시 fallback.
     * @returns {'BROWSE'|'SELECT'|'CONFIGURE'|'CHECKOUT'|null}
     */
    function guessStep(text) {
        if (typeof text !== 'string' || text.length === 0) return null;
        if (STEP_CHECKOUT_PATTERN.test(text)) return 'CHECKOUT';
        if (STEP_CONFIGURE_PATTERN.test(text)) return 'CONFIGURE';
        if (STEP_SELECT_PATTERN.test(text)) return 'SELECT';
        return null; // BROWSE 는 적극 추정 X — 부트 기본값
    }

    return {
        replyHasCartChange, replyHasComplete, guessStep,
        CART_PATTERN, COMPLETE_PATTERN
    };
});
