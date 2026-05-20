// ========================================================
// voice-controller.js — 공통 마이크/STT 컨트롤러
//
// 책임:
//  - ConvEngine 초기화 + 마이크 토글 (startMic / stopMic)
//  - 발화(final) 처리 — QuickAction → 매치 안 되면 Api.Ai.chat → AiAction.handle
//  - 502/504 일시 오류 1회 재시도
//  - 마이크 버튼 [data-action="toggle-mic"] 클릭 + voice:stop 이벤트 자동 처리
//
// 사용:
//   VoiceController.init({
//       getSessionId: () => Number(sessionStorage.getItem('sessionId')),
//       onUserUtterance: (text) => { ... },   // 옵션 — 페이지가 추가로 할 일
//       onAiReply: (data) => { ... },         // 옵션 — reply 받았을 때
//       onInterim: (text) => { ... },         // 옵션 — 실시간 자막
//       mode: 'NORMAL',                       // 옵션 — 기본 NORMAL
//   });
//
// 의존: api.js (Api.Ai), conversation-engine.js (ConvEngine),
//      quick-action.js (QuickAction, 선택), ai-action.js (AiAction, 선택)
// ========================================================

(function () {
    'use strict';

    const LOG = '[Voice]';
    const MIC_KEY = 'voiceMicOn';   // 페이지 이동 시 마이크 상태 보존용
    let _inited = false;
    let _opts = {};
    const _state = {
        micActive: false,
    };

    function _persistMicOn(on) {
        try { sessionStorage.setItem(MIC_KEY, on ? '1' : '0'); } catch (_) {}
    }
    function _isMicPersistedOn() {
        try { return sessionStorage.getItem(MIC_KEY) === '1'; } catch (_) { return false; }
    }

    // ── 대화 기록 패널 (결제 화면 등 채팅 UI 없는 화면 공용) ──────────
    const _transcript = [];   // [{role:'user'|'ai'|'system', text}]
    let _panelEl = null, _dimEl = null, _stylesInjected = false;

    function _injectChatStyles() {
        if (_stylesInjected) return;
        _stylesInjected = true;
        const css =
'.vc-chat-dim{position:fixed;inset:0;background:rgba(0,0,0,.35);opacity:0;visibility:hidden;transition:opacity .2s;z-index:900;}' +
'.vc-chat-dim.is-open{opacity:1;visibility:visible;}' +
'.vc-chat{position:fixed;top:0;right:0;height:100%;width:380px;max-width:86vw;background:#fff;box-shadow:-8px 0 24px rgba(0,0,0,.12);transform:translateX(100%);transition:transform .25s;z-index:901;display:flex;flex-direction:column;}' +
'.vc-chat.is-open{transform:translateX(0);}' +
'.vc-chat__head{display:flex;align-items:center;justify-content:space-between;padding:18px 20px;border-bottom:1px solid #eee;}' +
'.vc-chat__title{font-size:16px;font-weight:800;color:#222;}' +
'.vc-chat__close{border:none;background:#f3f3f3;width:34px;height:34px;border-radius:50%;font-size:20px;line-height:1;cursor:pointer;color:#555;}' +
'.vc-chat__body{flex:1;overflow-y:auto;padding:16px 18px;display:flex;flex-direction:column;gap:10px;}' +
'.vc-chat__empty{color:#999;font-size:13px;text-align:center;margin-top:30px;line-height:1.6;}' +
'.vc-msg{max-width:80%;padding:10px 13px;border-radius:14px;font-size:14px;line-height:1.45;word-break:break-word;white-space:pre-wrap;}' +
'.vc-msg--user{align-self:flex-end;background:var(--primary-500,#3d7eff);color:#fff;border-bottom-right-radius:4px;}' +
'.vc-msg--ai{align-self:flex-start;background:#f1f1f4;color:#222;border-bottom-left-radius:4px;}' +
'.vc-msg--system{align-self:center;background:transparent;color:#999;font-size:12px;}';
        const s = document.createElement('style');
        s.textContent = css;
        document.head.appendChild(s);
    }

    function _ensurePanel() {
        if (_panelEl) return;
        _injectChatStyles();
        _dimEl = document.createElement('div');
        _dimEl.className = 'vc-chat-dim';
        _dimEl.addEventListener('click', _closeChat);

        _panelEl = document.createElement('aside');
        _panelEl.className = 'vc-chat';
        _panelEl.setAttribute('aria-label', 'AI 대화');
        _panelEl.innerHTML =
            '<div class="vc-chat__head"><span class="vc-chat__title">AI 대화</span>' +
            '<button type="button" class="vc-chat__close" aria-label="닫기">×</button></div>' +
            '<div class="vc-chat__body"></div>';
        _panelEl.querySelector('.vc-chat__close').addEventListener('click', _closeChat);

        document.body.appendChild(_dimEl);
        document.body.appendChild(_panelEl);
        _renderTranscript();
    }

    function _renderTranscript() {
        if (!_panelEl) return;
        const body = _panelEl.querySelector('.vc-chat__body');
        if (!_transcript.length) {
            body.innerHTML = '<p class="vc-chat__empty">아직 대화가 없어요.\n마이크를 켜고 말씀해보세요.</p>';
            return;
        }
        body.innerHTML = '';
        _transcript.forEach((m) => {
            const el = document.createElement('div');
            el.className = 'vc-msg vc-msg--' + m.role;
            el.textContent = m.text;          // XSS 안전
            body.appendChild(el);
        });
        body.scrollTop = body.scrollHeight;
    }

    function _logChat(role, text) {
        if (!text) return;
        _transcript.push({ role: role, text: String(text) });
        if (_transcript.length > 100) _transcript.shift();
        _renderTranscript();
    }

    function _openChat()  { _ensurePanel(); _dimEl.classList.add('is-open'); _panelEl.classList.add('is-open'); }
    function _closeChat() { if (_panelEl) { _dimEl.classList.remove('is-open'); _panelEl.classList.remove('is-open'); } }
    function _toggleChat() { _ensurePanel(); (_panelEl.classList.contains('is-open') ? _closeChat : _openChat)(); }

    function init(opts) {
        if (_inited) return;
        _opts = opts || {};

        if (!window.ConvEngine || !window.ConvEngine.isSupported || !window.ConvEngine.isSupported()) {
            console.warn(LOG, 'Web Speech API 미지원 브라우저');
            return;
        }

        window.ConvEngine.init({
            onInterim: (interim) => {
                if (_opts.onInterim) {
                    try { _opts.onInterim(interim); } catch (e) { console.warn(LOG, 'onInterim 실패', e); }
                }
            },
            onUserUtterance: async (text) => {
                console.log(LOG, '발화:', text);
                _logChat('user', text);
                if (_opts.onUserUtterance) {
                    try { _opts.onUserUtterance(text); } catch (e) { console.warn(LOG, 'onUserUtterance 실패', e); }
                }
                await _dispatch(text);
                // 처리 끝났으면 다시 LISTENING 으로
                if (_state.micActive && window.ConvEngine) window.ConvEngine.endTurn();
            },
            onSilencePrompt: () => null,
            onBargeIn: () => {},
            onModeChange: (m) => console.log(LOG, 'mode →', m),
        });

        // 마이크 버튼 + 뒤로가기 버튼 클릭 위임
        document.addEventListener('click', (e) => {
            if (e.target.closest('[data-action="toggle-mic"]')) toggle();
            // 뒤로가기 — 이전 화면으로. 히스토리 없으면 메뉴로.
            if (e.target.closest('[data-action="nav-back"]')) {
                if (window.history.length > 1) window.history.back();
                else window.location.href = '/menu';
            }
            // 대화 보기 패널 토글
            if (e.target.closest('[data-action="open-chat"]')) _toggleChat();
        });

        // 음성 명령으로 "마이크 꺼" 일 때 발생하는 이벤트
        window.addEventListener('voice:stop', () => { if (_state.micActive) stop(); });

        _inited = true;
        console.log(LOG, '초기화 완료');

        // 직전 화면에서 마이크가 켜져 있었으면 이 화면에서도 자동으로 켠다.
        // (권한은 same-origin 에서 1회 허용 후 유지되므로 팝업 없이 시작)
        if (_isMicPersistedOn()) {
            console.log(LOG, '직전 화면 마이크 ON 상태 → 자동 시작');
            start();
        }
    }

    async function _dispatch(text) {
        // 1) JS quick-action (있으면)
        if (window.QuickAction && window.QuickAction.try(text, { page: location.pathname })) {
            _logChat('system', '✓ 처리했어요');
            return;
        }

        // 2) 세션 확보
        const sid = _opts.getSessionId ? _opts.getSessionId() : null;
        if (!sid) {
            console.warn(LOG, 'session_id 없음 — AI 호출 생략');
            return;
        }

        // 3) FastAPI/LangGraph 호출 (502/504 1회 재시도)
        const callAi = () => window.Api.Ai.chat({
            session_id: sid,
            text: text,
            mode: _opts.mode || 'NORMAL',
        });

        try {
            let res;
            try {
                res = await callAi();
            } catch (firstErr) {
                const isGateway = firstErr && (firstErr.status === 502 || firstErr.status === 504);
                if (!isGateway) throw firstErr;
                console.warn(LOG, '502/504, 1회 재시도');
                await new Promise(r => setTimeout(r, 1000));
                res = await callAi();
            }

            if (res && res.reply) _logChat('ai', res.reply);
            if (_opts.onAiReply) {
                try { _opts.onAiReply(res); } catch (e) { console.warn(LOG, 'onAiReply 실패', e); }
            }

            // 4) 화면 액션 dispatch
            if (window.AiAction) {
                if (res && res.action)          window.AiAction.handle(res.action);
                if (res && res.recommendations) window.AiAction.handleRecommendations(res.recommendations);
            }
        } catch (e) {
            // 처리 중 중첩으로 버려진 발화 — 에러 아님, 조용히 무시.
            if (e && e._busy) {
                console.log(LOG, '처리 중 — 중복 발화 무시:', text);
                return;
            }
            console.error(LOG, 'AI 최종 실패', e);
            const _errMsg = (e && (e.status === 502 || e.status === 504))
                ? "AI 서버가 잠시 응답이 느려요. 잠시 후 다시 말씀해주세요."
                : "응답을 가져오지 못했어요.";
            _logChat('ai', _errMsg);
            if (_opts.onAiReply) {
                try {
                    _opts.onAiReply({ reply: _errMsg, _error: true });
                } catch (_) {}
            }
        }
    }

    function start() {
        if (!window.ConvEngine || !window.ConvEngine.isSupported()) return;
        if (_state.micActive) return;
        window.ConvEngine.start();
        window.ConvEngine.endTurn();   // 인사 발화 없이 즉시 LISTENING
        _state.micActive = true;
        _persistMicOn(true);           // 페이지 이동 후에도 유지
        _toggleMicButton(true);
        if (_opts.onMicStateChange) _opts.onMicStateChange(true);
    }

    function stop() {
        if (!window.ConvEngine) return;
        window.ConvEngine.stop();
        _state.micActive = false;
        _persistMicOn(false);          // 명시적으로 끄면 다음 화면도 OFF
        _toggleMicButton(false);
        if (_opts.onMicStateChange) _opts.onMicStateChange(false);
    }

    function toggle() {
        if (_state.micActive) stop();
        else                   start();
    }

    function _toggleMicButton(active) {
        const btn = document.querySelector('[data-action="toggle-mic"]');
        if (btn) btn.classList.toggle('app-topbar__action-icon--mic-active', !!active);
    }

    function isActive() { return _state.micActive; }

    window.VoiceController = { init, start, stop, toggle, isActive };
})();
