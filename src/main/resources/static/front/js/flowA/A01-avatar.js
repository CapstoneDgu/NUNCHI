// ========================================================
// A01-avatar.js — 아바타 모드(크롱이) 통합 로직
//
// 책임:
//   1) 기승전결 FSM (opening → recommend → addmore → confirm)
//   2) 아바타 비디오 cross-fade (idle ↔ talking)
//   3) AI 발화: typewriter + 음성 파형 동기화
//   4) 빠른응답 칩 + 텍스트 입력으로 사용자 발화
//   5) 메뉴 추천 카드 인라인 + 미니카트
//   6) 카트 영속 (sessionStorage('cart'), N02 호환)
//   7) 모드 전환 / 결제 연결
//
// 의존: window.MenuData (menu-data.js), jQuery (선택, 미사용)
// 세션 키: cart, mode, dineOption, aiSessionId, currentStep
//
// ※ 음성 입력 (Web Speech API) 은 1차 미연동 — 2차 커밋 예정
// ※ 실 STT/TTS 백엔드 연동은 후속 PR (docs/A01_아바타_구현계획.md 참고)
// ========================================================

(function () {
    'use strict';

    // ========================================================
    // 1. 시나리오 스크립트 (mock)
    // ========================================================
    const SCRIPTS = {
        opening: {
            greeting: "안녕하세요! 저는 크롱이에요 🐸",
            askDine:  "오늘은 매장에서 드시나요, 포장하시나요?",
            confirmedDineIn:  "매장에서 드시는군요! 천천히 골라봐요.",
            confirmedTakeOut: "포장이시군요! 따끈할 때 가져갈 수 있게 도와드릴게요.",
        },
        recommend: {
            intro:   "오늘은 뭐 드시고 싶으세요? 추천해드릴까요?",
            recPick: (m) => `오늘은 "${m.name}" 어떠세요? 인기 메뉴예요!`,
            picked:  (m) => `좋은 선택이에요! "${m.name}" 담아드릴게요.`,
        },
        addmore: {
            ask:     "더 담으실 메뉴가 있을까요?",
            another: "또 추천해드릴까요? 아니면 결제하러 갈까요?",
        },
        confirm: {
            summarize: (n, total) => `메뉴 ${n}개, 총 ${fmtPrice(total)} 이에요. 결제하러 갈까요?`,
            agree:     "좋아요! 결제 화면으로 이동할게요.",
        },
    };

    // ========================================================
    // 2. 상태
    // ========================================================
    const state = {
        fsm: 'opening',          // opening | recommend | addmore | confirm
        cart: [],                // [{ menuId, qty }]  (N02 호환)
        chatLog: [],             // [{ role, text, ts }]
        avatarMode: 'idle',      // idle | talking
        sessionId: null,
        recommendedIds: [],      // 이미 추천한 메뉴 id (중복 회피)
        muted: false,
        speech: {
            recognizer: null,    // SpeechRecognition 인스턴스
            supported: false,
            listening: false,
        },
    };

    const STEP_ORDER = ['opening', 'recommend', 'addmore', 'confirm'];

    // ========================================================
    // 3. DOM 캐시
    // ========================================================
    const $videos      = document.querySelectorAll('[data-avatar]');
    const $videoIdle   = document.querySelector('[data-avatar="idle"]');
    const $videoTalk   = document.querySelector('[data-avatar="talking"]');
    const $waveform    = document.querySelector('[data-waveform]');
    const $bubble      = document.querySelector('[data-bubble]');
    const $bubbleText  = document.querySelector('[data-bubble-text]');

    const $stepsList   = document.querySelector('[data-steps]');
    const $log         = document.querySelector('[data-log]');

    const $minicartEmpty  = document.querySelector('[data-minicart-empty]');
    const $minicartFilled = document.querySelector('[data-minicart-filled]');
    const $minicartList   = document.querySelector('[data-minicart-list]');
    const $minicartTotal  = document.querySelector('[data-minicart-total]');

    const $chipRow     = document.querySelector('[data-chip-row]');
    const $input       = document.querySelector('[data-input]');
    const $sendBtn     = document.querySelector('[data-action="send"]');
    const $micBtn      = document.querySelector('[data-action="toggle-mic"]');
    const $muteBtn     = document.querySelector('[data-action="toggle-mute"]');
    const $switchBtn   = document.querySelector('[data-action="switch-normal"]');

    // ========================================================
    // 4. 유틸
    // ========================================================
    function fmtPrice(won) {
        if (window.MenuData && window.MenuData.formatPrice) {
            return window.MenuData.formatPrice(won);
        }
        return "₩ " + Number(won).toLocaleString("ko-KR");
    }

    function generateSessionId() {
        return 'a01-' + Math.random().toString(36).slice(2, 10);
    }

    function findMenu(id) {
        if (!window.MenuData) return null;
        const r = window.MenuData.findMenuById(id);
        return r ? r.menu : null;
    }

    function getCartCount() {
        return state.cart.reduce((s, it) => s + it.qty, 0);
    }

    function getCartTotal() {
        return state.cart.reduce((sum, it) => {
            const m = findMenu(it.menuId);
            return sum + (m ? m.price * it.qty : 0);
        }, 0);
    }

    // ========================================================
    // 5. 세션 영속 (N02 와 동일 키 사용)
    // ========================================================
    function loadSession() {
        try {
            state.cart      = JSON.parse(sessionStorage.getItem('cart') || '[]');
            state.sessionId = sessionStorage.getItem('aiSessionId');
            if (!state.sessionId) {
                state.sessionId = generateSessionId();
                sessionStorage.setItem('aiSessionId', state.sessionId);
            }
            sessionStorage.setItem('currentStep', 'A01');
            sessionStorage.setItem('mode', 'avatar');
        } catch (e) {
            console.warn('[A01] 세션 로드 실패', e);
        }
    }

    function persistCart() {
        try {
            sessionStorage.setItem('cart', JSON.stringify(state.cart));
        } catch (e) {
            console.warn('[A01] 카트 저장 실패', e);
        }
    }

    // ========================================================
    // 6. 아바타 비디오 cross-fade
    // ========================================================
    function setAvatar(mode) {
        if (state.avatarMode === mode) return;
        state.avatarMode = mode;
        if (mode === 'talking') {
            $videoTalk.classList.add('is-active');
            $videoIdle.classList.remove('is-active');
            try { $videoTalk.currentTime = 0; $videoTalk.play(); } catch (_) {}
            $waveform.classList.add('is-active');
        } else {
            $videoIdle.classList.add('is-active');
            $videoTalk.classList.remove('is-active');
            try { $videoIdle.play(); } catch (_) {}
            $waveform.classList.remove('is-active');
        }
    }

    // ========================================================
    // 7. AI 발화 (typewriter + 로그)
    // ========================================================
    function sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    async function typewriter(text, opts) {
        const speed = (opts && opts.speed) || 50;
        $bubble.classList.add('is-typing', 'is-visible');
        $bubbleText.textContent = '';
        for (let i = 0; i < text.length; i++) {
            const ch = text[i];
            $bubbleText.textContent += ch;
            // 문장부호 후 살짝 멈춤
            if (',.!?…'.includes(ch)) {
                await sleep(220);
            } else if (ch === ' ') {
                await sleep(speed * 0.5);
            } else {
                await sleep(speed);
            }
        }
        $bubble.classList.remove('is-typing');
    }

    async function aiSpeak(text) {
        appendLog('ai', text);
        setAvatar('talking');
        await typewriter(text, { speed: 48 });
        // 발화 종료 후 짧은 여운
        await sleep(450);
        setAvatar('idle');
    }

    function userSay(text, opts) {
        const t = (text || '').trim();
        if (!t) return;
        appendLog('user', t);
        if (!opts || !opts.silent) {
            handleUserIntent(t);
        }
    }

    // ========================================================
    // 8. 대화 로그 렌더
    // ========================================================
    function appendLog(role, text) {
        state.chatLog.push({ role, text, ts: Date.now() });
        const $msg = document.createElement('div');
        $msg.className = 'a01__msg a01__msg--' + role;
        $msg.textContent = text;
        $log.appendChild($msg);
        scrollLogToBottom();
    }

    function appendMenuCard(menu) {
        const $card = document.createElement('div');
        $card.className = 'a01__msg-menu';
        $card.innerHTML = ''
            + '<div class="a01__msg-menu-head">'
            +   '<i class="xi xi-restaurant" aria-hidden="true"></i>'
            +   '<span>크롱이의 추천</span>'
            + '</div>'
            + '<div class="a01__msg-menu-body">'
            +   '<div class="a01__msg-menu-thumb"><i class="xi xi-restaurant" aria-hidden="true"></i></div>'
            +   '<div class="a01__msg-menu-info">'
            +     '<span class="a01__msg-menu-name"></span>'
            +     '<span class="a01__msg-menu-meta">' + (menu.aiPick ? 'AI 추천 · ' : '') + '인기 메뉴</span>'
            +     '<span class="a01__msg-menu-price"></span>'
            +   '</div>'
            +   '<button class="a01__msg-menu-add" type="button" aria-label="장바구니에 담기">'
            +     '<i class="xi xi-plus-thin" aria-hidden="true"></i><span>담기</span>'
            +   '</button>'
            + '</div>';
        $card.querySelector('.a01__msg-menu-name').textContent  = menu.name;
        $card.querySelector('.a01__msg-menu-price').textContent = fmtPrice(menu.price);
        $card.querySelector('.a01__msg-menu-add').addEventListener('click', () => {
            addToCart(menu.id, 1);
            // 사용자 의사 표시로 처리 → addmore 단계로
            userSay('이거 담아주세요', { silent: true });
            aiSpeak(SCRIPTS.recommend.picked(menu)).then(() => {
                if (state.fsm === 'recommend') enterState('addmore');
            });
        });
        $log.appendChild($card);
        scrollLogToBottom();
    }

    function scrollLogToBottom() {
        // requestAnimationFrame 으로 레이아웃 후 스크롤
        requestAnimationFrame(() => {
            $log.scrollTop = $log.scrollHeight;
        });
    }

    // ========================================================
    // 9. FSM
    // ========================================================
    function enterState(name) {
        if (!STEP_ORDER.includes(name)) return;
        state.fsm = name;
        renderSteps();
        renderChips();

        switch (name) {
            case 'opening':
                runOpening();
                break;
            case 'recommend':
                runRecommend();
                break;
            case 'addmore':
                runAddmore();
                break;
            case 'confirm':
                runConfirm();
                break;
        }
    }

    async function runOpening() {
        await aiSpeak(SCRIPTS.opening.greeting);
        const dine = sessionStorage.getItem('dineOption');
        if (dine === 'dine_in') {
            await aiSpeak(SCRIPTS.opening.confirmedDineIn);
            enterState('recommend');
        } else if (dine === 'take_out') {
            await aiSpeak(SCRIPTS.opening.confirmedTakeOut);
            enterState('recommend');
        } else {
            await aiSpeak(SCRIPTS.opening.askDine);
        }
    }

    async function runRecommend() {
        await aiSpeak(SCRIPTS.recommend.intro);
        const pick = pickRecommendedMenu();
        if (pick) {
            state.recommendedIds.push(pick.id);
            await aiSpeak(SCRIPTS.recommend.recPick(pick));
            appendMenuCard(pick);
        }
    }

    async function runAddmore() {
        await aiSpeak(SCRIPTS.addmore.ask);
    }

    async function runConfirm() {
        const total = getCartTotal();
        const count = getCartCount();
        await aiSpeak(SCRIPTS.confirm.summarize(count, total));
    }

    function pickRecommendedMenu() {
        const data = window.MenuData && window.MenuData.data;
        if (!data) return null;
        // aiPick=true 우선, 그다음 임의
        const candidates = [];
        for (const f of data.floors) {
            for (const s of f.stores) {
                for (const m of s.menus) {
                    if (state.recommendedIds.includes(m.id)) continue;
                    if (m.soldOut) continue;
                    candidates.push({ menu: m, score: m.aiPick ? 10 : Math.random() });
                }
            }
        }
        if (!candidates.length) return null;
        candidates.sort((a, b) => b.score - a.score);
        return candidates[0].menu;
    }

    // ========================================================
    // 10. 사용자 의도 분류 (mock 키워드 매칭)
    // ========================================================
    const KEYWORDS = {
        dineIn:   ['매장', '먹고 갈', '먹고갈', '여기서'],
        takeOut:  ['포장', '가져갈', '테이크'],
        rec:      ['추천', '뭐 있', '뭐있', '메뉴'],
        addMore:  ['더', '추가', '하나 더', '또'],
        done:     ['끝', '그만', '됐어', '충분', '결제', '갈게', '진행'],
        cancel:   ['취소', '아니', '별로'],
    };

    function matchAny(text, list) {
        return list.some((kw) => text.includes(kw));
    }

    function handleUserIntent(text) {
        const t = text.toLowerCase();

        // 1) 매장/포장 답변 (opening 단계)
        if (state.fsm === 'opening') {
            if (matchAny(t, KEYWORDS.dineIn)) {
                sessionStorage.setItem('dineOption', 'dine_in');
                aiSpeak(SCRIPTS.opening.confirmedDineIn).then(() => enterState('recommend'));
                return;
            }
            if (matchAny(t, KEYWORDS.takeOut)) {
                sessionStorage.setItem('dineOption', 'take_out');
                aiSpeak(SCRIPTS.opening.confirmedTakeOut).then(() => enterState('recommend'));
                return;
            }
        }

        // 2) 메뉴명 직접 언급 → 카드 추천
        const directMenu = matchMenuByName(text);
        if (directMenu) {
            state.recommendedIds.push(directMenu.id);
            aiSpeak(SCRIPTS.recommend.recPick(directMenu)).then(() => {
                appendMenuCard(directMenu);
            });
            if (state.fsm === 'opening') enterState('recommend');
            return;
        }

        // 3) 결제/완료 의도
        if (matchAny(t, KEYWORDS.done)) {
            if (state.cart.length === 0) {
                aiSpeak('아직 담은 메뉴가 없어요. 한 가지만 골라볼까요?');
                if (state.fsm !== 'recommend') enterState('recommend');
                return;
            }
            // 이미 confirm 단계면 → 결제 화면으로 진행
            if (state.fsm === 'confirm') {
                aiSpeak(SCRIPTS.confirm.agree).then(() => goToPayment());
                return;
            }
            enterState('confirm');
            return;
        }

        // 3-1) confirm 단계에서 수정/취소 → addmore 로 복귀
        if (state.fsm === 'confirm' && matchAny(t, ['수정', '바꿔', '잠깐'])) {
            aiSpeak('알겠어요. 더 추가하거나 빼실 수 있어요.').then(() => enterState('addmore'));
            return;
        }

        // 4) 추천 요청
        if (matchAny(t, KEYWORDS.rec)) {
            const pick = pickRecommendedMenu();
            if (pick) {
                state.recommendedIds.push(pick.id);
                aiSpeak(SCRIPTS.recommend.recPick(pick)).then(() => appendMenuCard(pick));
            } else {
                aiSpeak('지금은 추천 가능한 메뉴를 찾기 어려워요.');
            }
            if (state.fsm === 'opening') enterState('recommend');
            return;
        }

        // 5) 더 담기
        if (matchAny(t, KEYWORDS.addMore)) {
            if (state.fsm === 'addmore' || state.fsm === 'recommend') {
                aiSpeak(SCRIPTS.addmore.another);
                const pick = pickRecommendedMenu();
                if (pick) {
                    state.recommendedIds.push(pick.id);
                    appendMenuCard(pick);
                }
                if (state.fsm !== 'recommend') enterState('recommend');
                return;
            }
        }

        // 6) 폴백
        aiSpeak('흠, 다시 한번 말씀해 주실래요?');
    }

    function matchMenuByName(text) {
        const data = window.MenuData && window.MenuData.data;
        if (!data) return null;
        for (const f of data.floors) {
            for (const s of f.stores) {
                for (const m of s.menus) {
                    if (m.soldOut) continue;
                    // 메뉴 이름이 길거나 특수문자 많아서 부분 매칭
                    const stem = m.name.replace(/[·\s\-,]/g, '');
                    if (stem.length >= 2 && text.replace(/\s/g, '').includes(stem.slice(0, 3))) {
                        return m;
                    }
                }
            }
        }
        return null;
    }

    // ========================================================
    // 11. 카트
    // ========================================================
    function addToCart(menuId, qty) {
        const found = state.cart.find((it) => it.menuId === menuId);
        if (found) {
            found.qty += qty;
        } else {
            state.cart.push({ menuId, qty });
        }
        persistCart();
        renderMinicart();
    }

    function renderMinicart() {
        if (state.cart.length === 0) {
            $minicartEmpty.hidden = false;
            $minicartFilled.hidden = true;
            return;
        }
        $minicartEmpty.hidden = true;
        $minicartFilled.hidden = false;
        $minicartList.innerHTML = '';
        state.cart.forEach((it) => {
            const m = findMenu(it.menuId);
            if (!m) return;
            const $li = document.createElement('li');
            $li.className = 'a01__minicart-item';
            $li.innerHTML = ''
                + '<span class="a01__minicart-item-name"></span>'
                + '<span class="a01__minicart-item-qty">×' + it.qty + '</span>';
            $li.querySelector('.a01__minicart-item-name').textContent =
                m.name.length > 10 ? m.name.slice(0, 10) + '…' : m.name;
            $minicartList.appendChild($li);
        });
        $minicartTotal.textContent = fmtPrice(getCartTotal());
    }

    // ========================================================
    // 12. 빠른응답 칩
    // ========================================================
    const CHIPS = {
        opening:   [
            { label: '매장에서요',  text: '매장에서 먹을게요' },
            { label: '포장이요',    text: '포장이요' },
        ],
        recommend: [
            { label: '추천해줘',    text: '추천해주세요' },
            { label: '매콤한 거',   text: '매콤한 메뉴 추천해주세요' },
            { label: '가벼운 거',   text: '가볍게 먹을 거 추천해주세요' },
        ],
        addmore:   [
            { label: '하나 더',     text: '하나 더 추천해주세요' },
            { label: '충분해요',    text: '충분해요. 결제할게요', cta: true },
        ],
        confirm:   [
            { label: '결제할래요',  text: '결제할게요', cta: true },
            { label: '수정할게요',  text: '수정할래요' },
        ],
    };

    function renderChips() {
        $chipRow.innerHTML = '';
        const list = CHIPS[state.fsm] || [];
        list.forEach((c) => {
            const $btn = document.createElement('button');
            $btn.type = 'button';
            $btn.className = 'a01__chip' + (c.cta ? ' a01__chip--cta' : '');
            $btn.textContent = c.label;
            $btn.addEventListener('click', () => onChipClick(c));
            $chipRow.appendChild($btn);
        });
    }

    function onChipClick(chip) {
        userSay(chip.text);
    }

    // ========================================================
    // 13. 단계 인디케이터
    // ========================================================
    function renderSteps() {
        const idx = STEP_ORDER.indexOf(state.fsm);
        const $steps = $stepsList.querySelectorAll('.a01__step');
        const $lines = $stepsList.querySelectorAll('.a01__step-line');
        $steps.forEach(($s, i) => {
            $s.classList.toggle('is-current', i === idx);
            $s.classList.toggle('is-done',    i <  idx);
        });
        $lines.forEach(($l, i) => {
            $l.classList.toggle('is-done', i < idx);
        });
    }

    // ========================================================
    // 14. 입력 / 액션 핸들러
    // ========================================================
    function onSendClick() {
        const v = ($input.value || '').trim();
        if (!v) return;
        $input.value = '';
        userSay(v);
    }

    function onInputKey(e) {
        if (e.key === 'Enter') onSendClick();
    }

    function onSwitchToNormal() {
        sessionStorage.setItem('mode', 'normal');
        location.href = '/flowN/N02-menu.html';
    }

    function goToPayment() {
        sessionStorage.setItem('currentStep', 'P01');
        location.href = '/flowP/P01-summary.html';
    }

    function onToggleMute() {
        state.muted = !state.muted;
        $muteBtn.setAttribute('aria-pressed', String(state.muted));
        const $icon = $muteBtn.querySelector('i');
        if (state.muted) {
            $icon.classList.remove('xi-volume-up');
            $icon.classList.add('xi-volume-mute');
        } else {
            $icon.classList.remove('xi-volume-mute');
            $icon.classList.add('xi-volume-up');
        }
        // 비디오 음소거 (현재는 muted=true 고정이라 표시만)
    }

    // ---- 음성 입력 (Web Speech API) ----
    // 후속 PR에서 voice-pipeline.js (FastAPI WebSocket STT) 로 어댑터 swap.
    // 현재 layer:
    //   - 지원 브라우저(Chrome/Edge): 실 STT 사용, interim 결과로 입력창 라이브 캡션
    //   - 미지원/권한거부: 토스트 안내 + 텍스트 입력 폴백 (기존 onSendClick 그대로)
    function initSpeech() {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) {
            state.speech.supported = false;
            return null;
        }
        state.speech.supported = true;
        const rec = new SR();
        rec.lang = 'ko-KR';
        rec.continuous = false;
        rec.interimResults = true;
        rec.maxAlternatives = 1;

        let finalText = '';
        let interimText = '';

        rec.onstart = () => {
            state.speech.listening = true;
            $micBtn.classList.add('a01__btn-mic--listening');
            $micBtn.setAttribute('aria-pressed', 'true');
            $input.placeholder = '듣고 있어요...';
            finalText = '';
            interimText = '';
            $input.value = '';
        };

        rec.onresult = (event) => {
            interimText = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const res = event.results[i];
                if (res.isFinal) {
                    finalText += res[0].transcript;
                } else {
                    interimText += res[0].transcript;
                }
            }
            // 입력창에 라이브 캡션 (final + interim)
            $input.value = (finalText + interimText).trim();
        };

        rec.onerror = (e) => {
            console.warn('[A01] SpeechRecognition error', e.error);
            stopListeningUI();
            if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
                showToast('마이크 권한이 필요해요. 텍스트로 입력해주세요.');
            } else if (e.error === 'no-speech') {
                showToast('음성을 듣지 못했어요. 다시 시도해주세요.');
            } else if (e.error === 'audio-capture') {
                showToast('마이크를 찾을 수 없어요.');
            }
        };

        rec.onend = () => {
            stopListeningUI();
            const text = (finalText || interimText || '').trim();
            $input.value = '';
            if (text) {
                userSay(text);
            }
        };

        return rec;
    }

    function stopListeningUI() {
        state.speech.listening = false;
        $micBtn.classList.remove('a01__btn-mic--listening');
        $micBtn.setAttribute('aria-pressed', 'false');
        $input.placeholder = '크롱이에게 말하거나 입력해보세요';
    }

    function onMicClick() {
        // 미지원 브라우저: 안내 + 텍스트 입력으로 유도
        if (!state.speech.supported) {
            showToast('이 브라우저는 음성 입력을 지원하지 않아요. 텍스트로 입력해주세요.');
            $input.focus();
            return;
        }
        const rec = state.speech.recognizer;
        if (!rec) return;

        if (state.speech.listening) {
            // 사용 중 다시 누르면 즉시 중지 (onend → 결과 처리)
            try { rec.stop(); } catch (_) {}
            return;
        }

        // 사용자 발화 우선 — AI가 말하는 중이면 발화 중단(터치 우선 8-1)
        // (현재 mock 에선 별도 abort 시그널 없음, 다음 발화부터 멈춤)
        try {
            rec.start();
        } catch (e) {
            // 이미 시작된 경우 등 — 한 번 stop 후 재시도
            console.warn('[A01] mic start failed', e);
            try { rec.stop(); } catch (_) {}
        }
    }

    // ---- 가벼운 토스트 (의존성 없이) ----
    function showToast(msg) {
        let $t = document.querySelector('.a01__toast');
        if (!$t) {
            $t = document.createElement('div');
            $t.className = 'a01__toast';
            document.body.appendChild($t);
        }
        $t.textContent = msg;
        $t.classList.add('is-visible');
        clearTimeout(showToast._timer);
        showToast._timer = setTimeout(() => {
            $t.classList.remove('is-visible');
        }, 2400);
    }

    // ========================================================
    // 15. 부트
    // ========================================================
    function bind() {
        $sendBtn.addEventListener('click', onSendClick);
        $input.addEventListener('keydown', onInputKey);
        $switchBtn.addEventListener('click', onSwitchToNormal);
        $muteBtn.addEventListener('click', onToggleMute);
        $micBtn.addEventListener('click', onMicClick);
    }

    function bootVideos() {
        // autoplay + muted + playsinline 으로 자동 재생.
        // 보수적으로 강제 play() 시도 (Safari 일부 케이스).
        $videos.forEach(($v) => {
            try { $v.play(); } catch (_) {}
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        loadSession();
        renderMinicart();
        renderSteps();
        renderChips();
        bind();
        bootVideos();
        state.speech.recognizer = initSpeech();

        // 첫 진입 시나리오 시작
        enterState('opening');
    });
})();
