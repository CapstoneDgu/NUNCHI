// sse-parser.test.js — /ai/order/chat/stream 응답 파싱 단위 테스트.
// Node 기본 test runner (`node --test`) 로 실행.

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
    parseEventBlock,
    dispatchEvent,
    consume,
    feedChunk,
} = require('../src/main/resources/static/front/js/common/sse-parser.js');

// ---------- parseEventBlock ----------
describe('parseEventBlock', () => {
    it('단일 라인 data: 정상 파싱', () => {
        const ev = parseEventBlock('data: {"type":"token","text":"오늘"}');
        assert.deepEqual(ev, { type: 'token', text: '오늘' });
    });

    it('"data:" 뒤 공백이 없어도 파싱 (SSE 스펙 허용)', () => {
        const ev = parseEventBlock('data:{"type":"token","text":"x"}');
        assert.deepEqual(ev, { type: 'token', text: 'x' });
    });

    it('멀티라인 data: 누적', () => {
        const block = 'data: {"type":"done",\ndata: "reply":"안녕"}';
        const ev = parseEventBlock(block);
        assert.deepEqual(ev, { type: 'done', reply: '안녕' });
    });

    it('data 가 아닌 라인은 무시 (event/id/retry/주석)', () => {
        const block = 'event: token\nid: 1\n: 주석\ndata: {"type":"token","text":"y"}';
        const ev = parseEventBlock(block);
        assert.deepEqual(ev, { type: 'token', text: 'y' });
    });

    it('잘못된 JSON 은 null', () => {
        assert.equal(parseEventBlock('data: not json'), null);
    });

    it('빈 블록은 null', () => {
        assert.equal(parseEventBlock(''), null);
        assert.equal(parseEventBlock('\n\n'), null);
    });
});

// ---------- dispatchEvent ----------
describe('dispatchEvent', () => {
    it('token 이벤트 → onToken(text)', () => {
        let received;
        dispatchEvent({ type: 'token', text: '메뉴' }, {
            onToken: (t) => { received = t; },
        });
        assert.equal(received, '메뉴');
    });

    it('done 이벤트 → onDone(전체 객체)', () => {
        let received;
        const ev = { type: 'done', reply: '안녕', recommendations: [{ menu_id: 1 }] };
        dispatchEvent(ev, { onDone: (d) => { received = d; } });
        assert.deepEqual(received, ev);
    });

    it('error 이벤트 → onError(message)', () => {
        let received;
        dispatchEvent({ type: 'error', message: '실패' }, {
            onError: (m) => { received = m; },
        });
        assert.equal(received, '실패');
    });

    it('알 수 없는 type (kept_alive 등) 은 무시', () => {
        let called = false;
        dispatchEvent({ type: 'kept_alive' }, {
            onToken: () => { called = true; },
            onDone:  () => { called = true; },
            onError: () => { called = true; },
        });
        assert.equal(called, false);
    });

    it('text 누락 token → 빈 문자열로 호출', () => {
        let received;
        dispatchEvent({ type: 'token' }, { onToken: (t) => { received = t; } });
        assert.equal(received, '');
    });

    it('message 누락 error → 기본 메시지', () => {
        let received;
        dispatchEvent({ type: 'error' }, { onError: (m) => { received = m; } });
        assert.equal(received, '오류가 발생했습니다.');
    });

    it('핸들러 미정의 시 noop (throw 없음)', () => {
        assert.doesNotThrow(() => {
            dispatchEvent({ type: 'token', text: 'x' }, {});
        });
    });

    it('null 이벤트는 무시', () => {
        assert.doesNotThrow(() => {
            dispatchEvent(null, { onToken: () => { throw new Error('called'); } });
        });
    });
});

// ---------- feedChunk ----------
describe('feedChunk', () => {
    it('완전한 이벤트 1개 → 콜백 1회 호출, remainder 빈 문자열', () => {
        const got = [];
        const rem = feedChunk('data: {"type":"token","text":"a"}\n\n', '', (ev) => got.push(ev));
        assert.equal(got.length, 1);
        assert.equal(got[0].text, 'a');
        assert.equal(rem, '');
    });

    it('이벤트 2개 + 미완성 1개 → 콜백 2회, remainder 에 미완성 보관', () => {
        const got = [];
        const chunk = 'data: {"type":"token","text":"a"}\n\n'
                    + 'data: {"type":"token","text":"b"}\n\n'
                    + 'data: {"type":"to';
        const rem = feedChunk(chunk, '', (ev) => got.push(ev));
        assert.equal(got.length, 2);
        assert.equal(rem, 'data: {"type":"to');
    });

    it('청크 경계가 이벤트 중간에 떨어져도 prevBuf 와 합쳐 처리', () => {
        const got = [];
        // 1차: 미완성 끝
        let buf = feedChunk('data: {"type":"to', '', (ev) => got.push(ev));
        assert.equal(got.length, 0);
        // 2차: 나머지가 들어와 완성
        buf = feedChunk('ken","text":"x"}\n\n', buf, (ev) => got.push(ev));
        assert.equal(got.length, 1);
        assert.equal(got[0].text, 'x');
        assert.equal(buf, '');
    });

    it('JSON 파싱 실패 라인은 건너뛰고 다음 이벤트는 정상 처리', () => {
        const got = [];
        const chunk = 'data: not json\n\ndata: {"type":"token","text":"ok"}\n\n';
        feedChunk(chunk, '', (ev) => got.push(ev));
        assert.equal(got.length, 1);
        assert.equal(got[0].text, 'ok');
    });

    it('done 이벤트의 복합 payload 도 그대로 파싱', () => {
        const got = [];
        const block = 'data: {"type":"done","reply":"안녕","recommendations":[{"menu_id":13}],"action":{"type":"highlight_menu","menu_id":13},"current_step":"SELECT"}\n\n';
        feedChunk(block, '', (ev) => got.push(ev));
        assert.equal(got.length, 1);
        assert.equal(got[0].type, 'done');
        assert.equal(got[0].reply, '안녕');
        assert.equal(got[0].recommendations[0].menu_id, 13);
        assert.equal(got[0].action.type, 'highlight_menu');
        assert.equal(got[0].current_step, 'SELECT');
    });

    it('CRLF(\\r\\n\\r\\n) 구분자도 LF 와 동일하게 처리 (SSE 스펙)', () => {
        const got = [];
        const block = 'data: {"type":"token","text":"안녕"}\r\n\r\ndata: {"type":"done","reply":"끝"}\r\n\r\n';
        const remainder = feedChunk(block, '', (ev) => got.push(ev));
        assert.equal(got.length, 2);
        assert.deepEqual(got[0], { type: 'token', text: '안녕' });
        assert.equal(got[1].type, 'done');
        assert.equal(remainder, '');
    });
});

// ---------- consume (ReadableStream 통합) ----------
describe('consume', () => {
    /** 청크 배열을 ReadableStream 으로 감싸는 헬퍼. */
    function streamOf(chunks) {
        const enc = new TextEncoder();
        let i = 0;
        return new ReadableStream({
            pull(controller) {
                if (i < chunks.length) {
                    controller.enqueue(enc.encode(chunks[i++]));
                } else {
                    controller.close();
                }
            },
        });
    }

    it('token → done 순서 그대로 핸들러 호출', async () => {
        const tokens = [];
        let done;
        const stream = streamOf([
            'data: {"type":"token","text":"오늘"}\n\n',
            'data: {"type":"token","text":" 인기"}\n\n',
            'data: {"type":"done","reply":"오늘 인기 메뉴"}\n\n',
        ]);
        await consume(stream, {
            onToken: (t) => tokens.push(t),
            onDone:  (d) => { done = d; },
        });
        assert.deepEqual(tokens, ['오늘', ' 인기']);
        assert.equal(done.reply, '오늘 인기 메뉴');
    });

    it('청크가 이벤트 중간에 잘려도 끝까지 파싱', async () => {
        const tokens = [];
        const stream = streamOf([
            'data: {"type":"to',
            'ken","text":"x"}\n\nda',
            'ta: {"type":"token","text":"y"}\n\n',
        ]);
        await consume(stream, { onToken: (t) => tokens.push(t) });
        assert.deepEqual(tokens, ['x', 'y']);
    });

    it('error 이벤트가 오면 onError 호출 (스트림은 정상 종료)', async () => {
        let err;
        const stream = streamOf([
            'data: {"type":"error","message":"실패했어요"}\n\n',
        ]);
        await consume(stream, { onError: (m) => { err = m; } });
        assert.equal(err, '실패했어요');
    });

    it('kept_alive 는 무시되고 다른 이벤트는 정상 처리', async () => {
        const tokens = [];
        const stream = streamOf([
            'data: {"type":"kept_alive"}\n\n',
            'data: {"type":"token","text":"z"}\n\n',
        ]);
        await consume(stream, { onToken: (t) => tokens.push(t) });
        assert.deepEqual(tokens, ['z']);
    });

    it('마지막 이벤트에 끝 \\n\\n 이 없어도 처리 (close 시 잔여 buf flush)', async () => {
        const tokens = [];
        const stream = streamOf([
            'data: {"type":"token","text":"a"}\n\n',
            'data: {"type":"token","text":"b"}', // 끝 \n\n 없음
        ]);
        await consume(stream, { onToken: (t) => tokens.push(t) });
        assert.deepEqual(tokens, ['a', 'b']);
    });
});
