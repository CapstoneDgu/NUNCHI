// reply-keywords.test.js — A01 의 FastAPI reply 후처리에 쓰일 키워드 매칭 헬퍼.
// Node 기본 test runner (`node --test`) 로 실행.

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { replyHasCartChange, replyHasComplete } = require('../src/main/resources/static/front/js/flowA/reply-keywords.js');

describe('replyHasCartChange', () => {
    it('"담았어요" 가 포함되면 true', () => {
        assert.equal(replyHasCartChange('가츠동을 담았어요. 더 시키실 거 있나요?'), true);
    });

    it('"비웠어요" 가 포함되면 true', () => {
        assert.equal(replyHasCartChange('장바구니에서 비웠어요'), true);
    });

    it('"장바구니" 가 포함되면 true (조사 변형 대응)', () => {
        assert.equal(replyHasCartChange('장바구니가 갱신되었어요'), true);
    });

    it('"담아드렸어요" 가 포함되면 true', () => {
        assert.equal(replyHasCartChange('샐러드를 담아드렸어요'), true);
    });

    it('카트 키워드가 없는 일반 reply 는 false', () => {
        assert.equal(replyHasCartChange('어떤 메뉴를 추천해 드릴까요?'), false);
    });

    it('빈 문자열은 false', () => {
        assert.equal(replyHasCartChange(''), false);
    });

    it('null 은 false', () => {
        assert.equal(replyHasCartChange(null), false);
    });

    it('undefined 는 false', () => {
        assert.equal(replyHasCartChange(undefined), false);
    });

    it('숫자 등 비문자열은 false (방어)', () => {
        assert.equal(replyHasCartChange(12345), false);
    });
});

describe('replyHasComplete', () => {
    it('"결제가 완료" 가 포함되면 true', () => {
        assert.equal(replyHasComplete('결제가 완료되었습니다'), true);
    });

    it('"세션이 종료" 가 포함되면 true', () => {
        assert.equal(replyHasComplete('세션이 종료되었어요. 감사합니다'), true);
    });

    it('"결제 완료" 만 있고 조사 "가" 가 없으면 false (의도된 엄격 매칭)', () => {
        assert.equal(replyHasComplete('결제 완료해주세요'), false);
    });

    it('완료 키워드가 없는 일반 reply 는 false', () => {
        assert.equal(replyHasComplete('주문을 진행할게요'), false);
    });

    it('빈 문자열은 false', () => {
        assert.equal(replyHasComplete(''), false);
    });

    it('null 은 false', () => {
        assert.equal(replyHasComplete(null), false);
    });

    it('undefined 는 false', () => {
        assert.equal(replyHasComplete(undefined), false);
    });
});
