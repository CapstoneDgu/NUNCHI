// ========================================================
// nunchi-sensor.js — "눈치" 행동 감지기 (QA R2-5 복원)
//
// 배경:
//   백엔드(FastAPI/LangGraph)에는 눈치 파이프라인이 살아있다.
//     intent_node: nunchi_signal 있으면 무조건 'hesitation' →
//     nunchi_detector → recommend_agent (추천 유도)
//   그런데 일반(NORMAL/N02) 페이지에는 "행동을 감지해 nunchi_signal 을
//   만들어 보내는" 프론트 코드가 빠져 있었다. 이 모듈이 그 역할을 한다.
//
// 감지 신호 (백엔드 _NUNCHI_HINTS 키와 일치):
//   - silence        : 일정 시간 아무 상호작용 없음 (장바구니 비어 있을 때만)
//   - repeat_browse  : 담지는 않고 상세만 여러 번 열어봄
//   - hesitation     : (음성 발화의 망설임은 백엔드 LLM 이 직접 분류 → 여기선 미사용)
//
// 사용:
//   NunchiSensor.init({
//       getCartCount: () => state.cart.length,   // 0 이면 "아직 못 고름"
//       onSignal: (signal) => { ... },           // AI 호출 + 추천 시각화는 페이지가
//   });
//   // 페이지가 행동 발생 시 알려준다:
//   NunchiSensor.noteDetailOpen(menuId);
//   NunchiSensor.noteCartAdd();
//
// 과도한 개입 방지: 쿨다운 + 세션당 최대 횟수 제한. 한번 담으면 카운터 리셋.
// ========================================================

(function () {
    'use strict';

    const LOG = '[Nunchi]';

    // ── 튜닝 파라미터 ───────────────────────────────────────
    const IDLE_MS      = 25000;   // 25초 무반응 → silence 후보
    const CHECK_MS     = 5000;    // 유휴 검사 주기
    const REPEAT_OPENS = 3;       // 상세 N회 열고도 안 담으면 repeat_browse
    const COOLDOWN_MS  = 45000;   // 개입 사이 최소 간격
    const MAX_NUDGES   = 3;       // 세션당 최대 개입 횟수

    let _opts = {};
    let _inited = false;
    let _lastActivity = Date.now();
    let _detailOpens = 0;
    let _lastNudge = 0;
    let _nudgeCount = 0;
    let _paused = false;
    let _timer = null;

    function _cartCount() {
        try { return _opts.getCartCount ? (_opts.getCartCount() || 0) : 0; }
        catch (_) { return 0; }
    }

    function _canNudge() {
        if (_paused) return false;
        if (_nudgeCount >= MAX_NUDGES) return false;
        return (Date.now() - _lastNudge) >= COOLDOWN_MS;
    }

    function _fire(signal) {
        _lastNudge = Date.now();
        _nudgeCount += 1;
        _detailOpens = 0;          // 개입 후 반복탐색 카운터 초기화
        _lastActivity = Date.now();
        console.log(LOG, '신호 발생 →', signal, '(누적', _nudgeCount + '/' + MAX_NUDGES + ')');
        if (_opts.onSignal) {
            try { _opts.onSignal(signal); } catch (e) { console.warn(LOG, 'onSignal 실패', e); }
        }
    }

    // 사용자 상호작용 → 유휴 타이머 리셋
    function noteActivity() { _lastActivity = Date.now(); }

    // 상세 오버레이 오픈 — 담지 않고 반복해서 열면 repeat_browse
    function noteDetailOpen() {
        _detailOpens += 1;
        _lastActivity = Date.now();
        if (_detailOpens >= REPEAT_OPENS && _cartCount() === 0 && _canNudge()) {
            _fire('repeat_browse');
        }
    }

    // 장바구니 담기 성공 — "결정함" → 반복탐색 카운터 리셋
    function noteCartAdd() {
        _detailOpens = 0;
        _lastActivity = Date.now();
    }

    function _tick() {
        if (!_canNudge()) return;
        // 장바구니가 비어 있고(아직 못 고름) 일정 시간 무반응 → silence
        if (_cartCount() === 0 && (Date.now() - _lastActivity) >= IDLE_MS) {
            _fire('silence');
        }
    }

    function pause()  { _paused = true; }
    function resume() { _paused = false; _lastActivity = Date.now(); }

    function init(opts) {
        if (_inited) return;
        _opts = opts || {};
        _inited = true;

        // 전역 상호작용은 유휴 타이머만 리셋 (개입 UI 클릭 포함되어도 무방)
        ['touchstart', 'pointerdown', 'click', 'keydown', 'wheel'].forEach((ev) => {
            document.addEventListener(ev, noteActivity, { passive: true });
        });

        _timer = setInterval(_tick, CHECK_MS);
        console.log(LOG, '초기화 완료');
    }

    window.NunchiSensor = {
        init,
        noteActivity,
        noteDetailOpen,
        noteCartAdd,
        pause,
        resume,
    };
})();
