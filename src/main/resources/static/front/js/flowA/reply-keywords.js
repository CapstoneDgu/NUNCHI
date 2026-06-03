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
    // 사용자 발화 — 명확한 종료/주문 포기 의사. 단어 단독("그만"/"끝"/"취소") 으로는 매칭 X.
    // 의도가 분명한 어미 조합만 인식해서 조회/일반 대화의 false positive 차단.
    const QUIT_PATTERN = /(그만 ?할(래|게|래요)|그만 ?하(자|고 ?싶)|그만 ?둘래|끝낼(래|게|래요)|끝내(자|줘|드려)|주문 ?(취소|그만|안 ?할게|안 ?할래)|관둘래|관둬|관두자|나갈래|나갈게|그냥 ?나갈|돌아갈래|돌아갈게)/;
    // 조회/확인 의도 — QUIT 패턴과 함께 나오면 quit 무효화
    // (예: "장바구니 확인", "메뉴 보여줘", "얼마야" — 의도는 결제 끝내기가 아님)
    const INQUIRY_PATTERN = /(확인|보여|알려|얼마|뭐|어떻|어디|어느|있어|있나|있을|어때|볼래|볼게|구경|찾|추천)/;

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

    /** 사용자 발화에 명확한 대화 종료/주문 포기 의사가 있는지 매칭.
     *  조회/확인 의도가 같이 들어있으면 quit 의사 아님으로 본다. */
    function userWantsToQuit(text) {
        if (typeof text !== 'string' || text.length === 0) return false;
        if (INQUIRY_PATTERN.test(text)) return false;
        return QUIT_PATTERN.test(text);
    }

    /**
     * reply 텍스트 → 단계 추정. 서버 currentStep 미제공 시 fallback.
     * BROWSE 는 부트 기본값으로 두고 적극 추정 X — 반환 X.
     * @returns {'SELECT'|'CONFIGURE'|'CHECKOUT'|null}
     */
    function guessStep(text) {
        if (typeof text !== 'string' || text.length === 0) return null;
        if (STEP_CHECKOUT_PATTERN.test(text)) return 'CHECKOUT';
        if (STEP_CONFIGURE_PATTERN.test(text)) return 'CONFIGURE';
        if (STEP_SELECT_PATTERN.test(text)) return 'SELECT';
        return null; // BROWSE 는 적극 추정 X — 부트 기본값
    }

    return {
        replyHasCartChange, replyHasComplete, userWantsToQuit, guessStep,
        CART_PATTERN, COMPLETE_PATTERN, QUIT_PATTERN, INQUIRY_PATTERN
    };
});
