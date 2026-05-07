// ========================================================
// reply-keywords.js — FastAPI AI reply 후처리용 키워드 매칭 헬퍼.
//
// FastAPI 의 /api/order/chat 응답(reply)에 특정 키워드가 포함되면
// 프론트가 추가 동작을 트리거한다:
//   - replyHasCartChange : Spring 카트를 강제 재조회해야 하는 신호
//   - replyHasComplete   : P05 완료 화면으로 라우팅해야 하는 신호
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

    function replyHasCartChange(text) {
        if (typeof text !== 'string' || text.length === 0) return false;
        return CART_PATTERN.test(text);
    }

    function replyHasComplete(text) {
        if (typeof text !== 'string' || text.length === 0) return false;
        return COMPLETE_PATTERN.test(text);
    }

    return { replyHasCartChange, replyHasComplete, CART_PATTERN, COMPLETE_PATTERN };
});
