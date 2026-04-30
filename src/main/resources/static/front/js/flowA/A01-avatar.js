// ========================================================
// A01-avatar.js — 아바타 모드(동대맘) 통합 로직 (백엔드 연결 + 턴테이킹)
//
// 흐름:
//   1) 진입: backend 세션 생성(POST /api/sessions, mode=AVATAR), 메뉴 prefetch
//   2) 대기 화면: 인사말만 typewriter 노출, 마이크 버튼이 "대화 시작" 안내
//   3) 마이크 클릭: ConvEngine.start() → enterState('opening')
//   4) 사용자 발화 → IntentMatcher → 백엔드 호출 (메뉴 필터 / 카트 / 주문)
//   5) 결제 의도 → POST /api/orders/confirm → P01 페이지로 인계
//   6) 정상 모드 전환 → PATCH /api/sessions/{id}/complete
//
// 의존:
//   - window.NunchiApi      (api-client.js)
//   - window.IntentMatcher  (intent-matcher.js)
//   - window.ConvEngine     (conversation-engine.js)
//
// 세션키 호환:
//   aiSessionId (Long), cart (P-flow 호환 형태로 캐시), currentStep, mode, dineOption,
//   orderId, currentStoreName
// ========================================================

(function () {
    'use strict';

    // ========================================================
    // 1. 상수 / 시나리오 스크립트
    // ========================================================
    const SCRIPTS = {
        opening: {
            greeting: "안녕하세요! 동대맘이에요. 오늘 뭐 드시고 싶으세요?",
            askDine:  "오늘은 매장에서 드시나요, 포장하시나요?",
            confirmedDineIn:  "매장에서 드시는군요! 천천히 골라봐요.",
            confirmedTakeOut: "포장이시군요! 따끈할 때 가져갈 수 있게 도와드릴게요.",
            startHint: "마이크를 눌러서 저랑 대화해 보세요."
        },
        recommend: {
            intro:    "오늘은 뭐 드시고 싶으세요? 추천해드릴까요?",
            recPick:  (m) => `오늘은 "${m.name}" 어떠세요? 인기 메뉴예요!`,
            byTags:   (tags, n) => `${tags} 메뉴로 ${n}개 찾았어요. 마음에 드는 거 있으세요?`,
            empty:    "음... 그 조건에 맞는 메뉴를 찾기 어렵네요. 다른 걸 시도해볼까요?",
            picked:   (name) => `좋은 선택이에요! "${name}" 담아드릴게요.`
        },
        addmore: {
            ask:      "더 담으실 메뉴가 있을까요?",
            another:  "또 추천해드릴까요? 아니면 결제하러 갈까요?"
        },
        confirm: {
            summarize: (n, total) => `메뉴 ${n}개, 총 ${fmtPrice(total)} 이에요. 결제하러 갈까요?`,
            agree:     "좋아요! 결제 화면으로 이동할게요.",
            empty:     "아직 담은 메뉴가 없어요. 한 가지만 골라볼까요?"
        },
        silence: {
            opening:   "어떤 메뉴 찾으시나요? 매운 거, 시원한 거 같이 말씀해 주셔도 돼요.",
            recommend: "추천 메뉴 더 보여드릴까요, 골라드릴까요?",
            addmore:   "더 담으실 메뉴가 있나요? 아니면 결제로 넘어갈까요?",
            confirm:   "결제 진행할까요?"
        }
    };

    const STEP_ORDER = ['opening', 'recommend', 'addmore', 'confirm'];

    // ========================================================
    // 2. 상태
    // ========================================================
    const state = {
        fsm: 'opening',
        sessionId: null,            // 백엔드 Long sessionId
        cart: { items: [], totalAmount: 0 },  // 서버 CartResponse 미러
        chatLog: [],
        avatarMode: 'idle',
        recommendedIds: [],
        muted: false,
        speechAbort: null,
        engineStarted: false,       // 마이크 첫 클릭 여부
        greetedOnBoot: false,       // 부트 인사 완료 — 첫 enterState 시 인사 생략
        // 메뉴 캐시 (백엔드 prefetch)
        menuCache: {
            categories: [],
            top: [],
            byId: new Map(),
            categoryNameById: new Map(),  // categoryId → 카테고리명 (이미지 경로 추론용)
            ready: false
        }
    };

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
        return "₩ " + Number(won || 0).toLocaleString("ko-KR");
    }

    function getCartCount() {
        return state.cart.items.reduce((s, it) => s + (it.quantity || 0), 0);
    }

    function getCartTotal() {
        return state.cart.totalAmount || 0;
    }

    /** API 호출 래퍼 — 에러 토스트 + 로그. 호출부는 try/catch 없이 then/await 가능. */
    async function callApi(label, fn) {
        try {
            return await fn();
        } catch (e) {
            const msg = (e && e.msg) || (e && e.message) || '요청 실패';
            console.warn(`[A01] ${label} 실패`, e);
            showToast(`${label}: ${msg}`);
            return null;
        }
    }

    /** AI 의도 매칭 결과를 tool-log 로 기록 (fire-and-forget). */
    function logToolCall(toolName, requestObj, responseObj) {
        if (!state.sessionId) return;
        try {
            window.NunchiApi.Sessions.saveToolLog(
                state.sessionId, toolName, requestObj, responseObj
            ).catch(() => { /* 비치명 */ });
        } catch (_) { /* noop */ }
    }

    // ========================================================
    // 5. 세션 영속
    // ========================================================
    /** sessionStorage 의 aiSessionId 가 Long 형식인지 검사. mock 잔재('a01-...')는 폐기. */
    function readStoredSessionId() {
        const raw = sessionStorage.getItem('aiSessionId');
        if (!raw) return null;
        const n = Number(raw);
        if (!Number.isFinite(n) || n <= 0) return null;
        return n;
    }

    async function loadOrCreateSession() {
        const stored = readStoredSessionId();
        if (stored) {
            state.sessionId = stored;
            return;
        }
        const res = await callApi('세션 생성', () =>
            window.NunchiApi.Sessions.create('AVATAR', 'ko')
        );
        if (res && res.sessionId) {
            state.sessionId = res.sessionId;
            sessionStorage.setItem('aiSessionId', String(res.sessionId));
        }
    }

    /** 서버 카트를 P-flow 호환 sessionStorage 형태로 캐시. */
    function persistCartCache() {
        try {
            const compat = state.cart.items.map((it) => ({
                id:        it.itemId,             // P01/P02 가 키로 사용 (UUID)
                menuId:    it.menuId,
                name:      it.menuName,
                price:     it.unitPrice,
                qty:       it.quantity,
                itemTotal: it.itemTotal
            }));
            sessionStorage.setItem('cart', JSON.stringify(compat));
        } catch (e) {
            console.warn('[A01] 카트 캐시 실패', e);
        }
    }

    // ========================================================
    // 6. 메뉴 prefetch
    // ========================================================
    async function fetchMenuCatalog() {
        const [categories, top] = await Promise.all([
            callApi('카테고리 조회', () => window.NunchiApi.Menus.categories()),
            callApi('인기 메뉴 조회', () => window.NunchiApi.Menus.top(8))
        ]);
        state.menuCache.categories = categories || [];
        state.menuCache.top        = top || [];
        (categories || []).forEach((c) => {
            state.menuCache.categoryNameById.set(c.categoryId, c.name);
        });
        (top || []).forEach((m) => state.menuCache.byId.set(m.menuId, m));

        // 모든 카테고리의 메뉴 목록을 가져와 풀로 비축 + categoryId 보강
        const lists = await Promise.all(
            (categories || []).map((cat) =>
                callApi(`메뉴 목록(${cat.name}) 조회`, () =>
                    window.NunchiApi.Menus.list({ categoryId: cat.categoryId })
                ).then((list) => ({ cat, list: list || [] }))
            )
        );
        lists.forEach(({ cat, list }) => {
            list.forEach((m) => {
                // MenuResponse 에 categoryId 가 없을 수 있어 prefetch 시점의 cat 으로 보강
                if (m.categoryId == null) m.categoryId = cat.categoryId;
                state.menuCache.byId.set(m.menuId, m);
            });
        });
        state.menuCache.ready = true;
    }

    /**
     * 메뉴 이미지 URL 후보를 우선순위대로 반환.
     * 1) 한글 카테고리/메뉴명 매핑: /images/menu/덮밥류/가츠동.png  (실 파일과 일치)
     * 2) 백엔드 menu.imageUrl (영문 경로일 수 있음 — 시드 데이터와 불일치 케이스)
     * 호출부는 1)을 시도하고 onerror 시 2)로 폴백한다.
     */
    function resolveMenuImageUrls(menu) {
        const urls = [];
        if (menu && menu.name) {
            const catName = state.menuCache.categoryNameById.get(menu.categoryId);
            if (catName) {
                urls.push(encodeURI(`/images/menu/${catName}/${menu.name}.png`));
            }
        }
        if (menu && menu.imageUrl) urls.push(menu.imageUrl);
        return urls;
    }

    /** 캐시에 없으면 detail API 로 1회 fetch 후 캐시. */
    async function ensureMenu(menuId) {
        if (state.menuCache.byId.has(menuId)) return state.menuCache.byId.get(menuId);
        const m = await callApi('메뉴 상세 조회', () => window.NunchiApi.Menus.detail(menuId));
        if (m) state.menuCache.byId.set(menuId, m);
        return m;
    }

    /** 추천에 쓸 메뉴 1개 — 인기 메뉴에서 미추천 항목 우선. */
    function pickRecommendedMenu() {
        const pool = state.menuCache.top.length
            ? state.menuCache.top
            : Array.from(state.menuCache.byId.values());
        const fresh = pool.filter((m) => !state.recommendedIds.includes(m.menuId) && !m.isSoldOut);
        const target = (fresh.length ? fresh : pool)[0];
        return target || null;
    }

    // ========================================================
    // 7. 아바타 비디오 cross-fade
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
    // 8. AI 발화 (typewriter + 백엔드 메시지 로깅)
    // ========================================================
    function sleep(ms, signal) {
        return new Promise((resolve, reject) => {
            if (signal && signal.aborted) {
                reject(new DOMException('aborted', 'AbortError'));
                return;
            }
            const t = setTimeout(resolve, ms);
            if (signal) {
                signal.addEventListener('abort', () => {
                    clearTimeout(t);
                    reject(new DOMException('aborted', 'AbortError'));
                }, { once: true });
            }
        });
    }

    async function typewriter(text, opts) {
        const speed  = (opts && opts.speed) || 50;
        const signal = opts && opts.signal;
        $bubble.classList.add('is-typing', 'is-visible');
        $bubbleText.textContent = '';
        try {
            for (let i = 0; i < text.length; i++) {
                if (signal && signal.aborted) return;
                const ch = text[i];
                $bubbleText.textContent += ch;
                if (',.!?…'.includes(ch)) {
                    await sleep(220, signal);
                } else if (ch === ' ') {
                    await sleep(speed * 0.5, signal);
                } else {
                    await sleep(speed, signal);
                }
            }
        } finally {
            $bubble.classList.remove('is-typing');
        }
    }

    /**
     * AI 발화 — typewriter + 대화 로그 + 백엔드 메시지 저장(fire-and-forget).
     * signal 은 호출자가 책임지고 전달:
     *   - run*(signal): FSM 의 state.speechAbort.signal
     *   - ConvEngine.say 경유: 엔진의 currentSpeakAbort.signal
     *   - 부트: 자체 bootAbort.signal
     * 호출자가 신호를 abort 시키면 typewriter 가 즉시 컷된다.
     */
    async function aiSpeak(text, signal) {
        if (signal && signal.aborted) return;

        appendLog('ai', text);
        if (state.sessionId) {
            window.NunchiApi.Sessions
                .saveMessage(state.sessionId, 'ASSISTANT', text)
                .catch(() => {});
        }

        setAvatar('talking');
        try {
            await typewriter(text, { speed: 48, signal });
            await sleep(450, signal);
        } catch (e) {
            if (e && e.name === 'AbortError') return;
            throw e;
        }
        if (!signal || !signal.aborted) setAvatar('idle');
    }

    /**
     * 사용자 발화 처리.
     * - 로그 + 백엔드 USER 메시지 저장
     * - silent 옵션 시 의도 처리 생략
     */
    function userSay(text, opts) {
        const t = (text || '').trim();
        if (!t) return;
        appendLog('user', t);
        if (state.sessionId) {
            window.NunchiApi.Sessions
                .saveMessage(state.sessionId, 'USER', t)
                .catch(() => {});
        }
        if (!opts || !opts.silent) {
            handleUserIntent(t);
        }
    }

    // ========================================================
    // 9. 대화 로그 + 메뉴 카드 렌더
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
            +   '<span>동대맘의 추천</span>'
            + '</div>'
            + '<div class="a01__msg-menu-body">'
            +   '<div class="a01__msg-menu-thumb"><i class="xi xi-restaurant" aria-hidden="true"></i></div>'
            +   '<div class="a01__msg-menu-info">'
            +     '<span class="a01__msg-menu-name"></span>'
            +     '<span class="a01__msg-menu-meta">백엔드 추천</span>'
            +     '<span class="a01__msg-menu-price"></span>'
            +   '</div>'
            +   '<button class="a01__msg-menu-add" type="button" aria-label="장바구니에 담기">'
            +     '<i class="xi xi-plus-thin" aria-hidden="true"></i><span>담기</span>'
            +   '</button>'
            + '</div>';
        $card.querySelector('.a01__msg-menu-name').textContent  = menu.name;
        $card.querySelector('.a01__msg-menu-price').textContent = fmtPrice(menu.price);
        const imgCandidates = resolveMenuImageUrls(menu);
        if (imgCandidates.length) {
            const $thumb = $card.querySelector('.a01__msg-menu-thumb');
            const $iconFallback = $thumb.innerHTML;
            $thumb.innerHTML = '';
            const $img = document.createElement('img');
            $img.alt = menu.name || '';
            $img.style.width = '100%';
            $img.style.height = '100%';
            $img.style.objectFit = 'cover';
            $img.style.borderRadius = 'inherit';
            let attempt = 0;
            $img.addEventListener('error', () => {
                attempt += 1;
                if (attempt < imgCandidates.length) {
                    $img.src = imgCandidates[attempt];
                } else {
                    $thumb.innerHTML = $iconFallback;
                }
            });
            $img.src = imgCandidates[0];
            $thumb.appendChild($img);
        }
        $card.querySelector('.a01__msg-menu-add').addEventListener('click', () => {
            addToCart(menu.menuId, 1).then((ok) => {
                if (!ok) return;
                userSay('이거 담아주세요', { silent: true });
                aiSpeakChained(SCRIPTS.recommend.picked(menu)).then(() => {
                    if (state.fsm === 'recommend') enterState('addmore');
                });
            });
        });
        $log.appendChild($card);
        scrollLogToBottom();
    }

    function scrollLogToBottom() {
        requestAnimationFrame(() => { $log.scrollTop = $log.scrollHeight; });
    }

    /**
     * AI 발화 헬퍼 — ConvEngine 활성 시엔 ConvEngine.say 경로(바지인 가능),
     * 비활성 시엔 직접 aiSpeak(자유 호출, FSM signal 만 사용).
     */
    function aiSpeakChained(text) {
        if (state.engineStarted && window.ConvEngine && window.ConvEngine.isActive()) {
            return window.ConvEngine.say(text);
        }
        // 엔진 비활성 — FSM 신호로 발화 (취소 가능하도록 신호 전달)
        const sig = state.speechAbort && state.speechAbort.signal;
        return aiSpeak(text, sig);
    }

    // ========================================================
    // 10. FSM
    // ========================================================
    function enterState(name) {
        if (!STEP_ORDER.includes(name)) return;
        if (state.speechAbort) {
            try { state.speechAbort.abort(); } catch (_) {}
        }
        state.speechAbort = new AbortController();
        const signal = state.speechAbort.signal;

        state.fsm = name;
        renderSteps();
        renderChips();

        let runner;
        switch (name) {
            case 'opening':   runner = runOpening;   break;
            case 'recommend': runner = runRecommend; break;
            case 'addmore':   runner = runAddmore;   break;
            case 'confirm':   runner = runConfirm;   break;
            default: return;
        }
        runner(signal).then(() => {
            // 정상 완료 시: 엔진 활성이면 endTurn → 자동 청취
            if (signal.aborted) return;
            if (state.engineStarted && window.ConvEngine && window.ConvEngine.isActive()) {
                window.ConvEngine.endTurn();
            }
        }).catch((e) => {
            if (!e || e.name !== 'AbortError') console.warn('[A01] FSM runner error', e);
        });
    }

    async function runOpening(signal) {
        if (!state.greetedOnBoot) {
            await aiSpeak(SCRIPTS.opening.greeting, signal);
            if (signal.aborted) return;
        }
        const dine = sessionStorage.getItem('dineOption');
        if (dine === 'dine_in') {
            await aiSpeak(SCRIPTS.opening.confirmedDineIn, signal);
            if (signal.aborted) return;
            enterState('recommend');
        } else if (dine === 'take_out') {
            await aiSpeak(SCRIPTS.opening.confirmedTakeOut, signal);
            if (signal.aborted) return;
            enterState('recommend');
        } else {
            await aiSpeak(SCRIPTS.opening.askDine, signal);
        }
    }

    async function runRecommend(signal) {
        await aiSpeak(SCRIPTS.recommend.intro, signal);
        if (signal.aborted) return;
        const pick = pickRecommendedMenu();
        if (pick) {
            state.recommendedIds.push(pick.menuId);
            await aiSpeak(SCRIPTS.recommend.recPick(pick), signal);
            if (signal.aborted) return;
            appendMenuCard(pick);
        }
    }

    async function runAddmore(signal) {
        await aiSpeak(SCRIPTS.addmore.ask, signal);
    }

    async function runConfirm(signal) {
        const total = getCartTotal();
        const count = getCartCount();
        if (count === 0) {
            await aiSpeak(SCRIPTS.confirm.empty, signal);
            return;
        }
        await aiSpeak(SCRIPTS.confirm.summarize(count, total), signal);
    }

    // ========================================================
    // 11. 사용자 의도 분류 (IntentMatcher 위임 + 백엔드 호출)
    // ========================================================
    async function handleUserIntent(text) {
        // 1) 메뉴 필터 의도 — 가장 풍부한 시나리오. 우선 매칭.
        const filterIntent = window.IntentMatcher.matchFilter(text);
        if (filterIntent) {
            await runFilterFlow(filterIntent);
            // 청취 재개를 위해 endTurn
            if (state.engineStarted && window.ConvEngine.isActive()) window.ConvEngine.endTurn();
            return;
        }

        // 2) 추천 요청
        const recType = window.IntentMatcher.matchRecommend(text);
        if (recType) {
            await runRecommendFlow(recType);
            if (state.engineStarted && window.ConvEngine.isActive()) window.ConvEngine.endTurn();
            return;
        }

        // 3) 굵은 네비게이션 의도
        const nav = window.IntentMatcher.matchNavigation(text);
        if (nav) {
            await runNavigationFlow(nav);
            if (state.engineStarted && window.ConvEngine.isActive()) window.ConvEngine.endTurn();
            return;
        }

        // 4) 메뉴명 직접 언급
        const direct = matchMenuByName(text);
        if (direct) {
            state.recommendedIds.push(direct.menuId);
            await aiSpeakChained(SCRIPTS.recommend.recPick(direct));
            appendMenuCard(direct);
            if (state.fsm === 'opening') enterState('recommend');
            else if (state.engineStarted && window.ConvEngine.isActive()) window.ConvEngine.endTurn();
            return;
        }

        // 5) 폴백
        await aiSpeakChained('흠, 다시 한번 말씀해 주실래요?');
        if (state.engineStarted && window.ConvEngine.isActive()) window.ConvEngine.endTurn();
    }

    async function runFilterFlow(intent) {
        const result = await callApi('메뉴 필터', () =>
            window.NunchiApi.Menus.filter(intent.params)
        );
        // 응답 메뉴를 캐시에 적재
        if (Array.isArray(result)) {
            result.forEach((m) => state.menuCache.byId.set(m.menuId, m));
        }
        // 툴 호출 로그 — 매칭 검증용
        logToolCall('menu.filter', intent.params, {
            count: Array.isArray(result) ? result.length : 0,
            sample: Array.isArray(result) ? result.slice(0, 3).map((m) => m.menuId) : []
        });

        if (!result || result.length === 0) {
            await aiSpeakChained(SCRIPTS.recommend.empty);
            return;
        }
        await aiSpeakChained(SCRIPTS.recommend.byTags(intent.summary, result.length));
        // 상위 3개 카드 노출
        result.slice(0, 3).forEach((m) => {
            state.recommendedIds.push(m.menuId);
            appendMenuCard(m);
        });
        if (state.fsm === 'opening') enterState('recommend');
    }

    async function runRecommendFlow(type) {
        const res = await callApi('추천 조회', () =>
            window.NunchiApi.Recommendations.get(type)
        );
        logToolCall('recommendation', { type }, {
            count: res && Array.isArray(res.menus) ? res.menus.length : 0
        });
        const menus = (res && res.menus) || [];
        if (!menus.length) {
            await aiSpeakChained('지금은 추천 가능한 메뉴를 찾기 어려워요.');
            return;
        }
        await aiSpeakChained(`${menus.length}개 추천드릴게요!`);
        menus.slice(0, 3).forEach((m) => {
            // RecommendationMenuResponse 는 menuId/name/price/imageUrl 만 보유
            state.menuCache.byId.set(m.menuId, m);
            state.recommendedIds.push(m.menuId);
            appendMenuCard(m);
        });
        if (state.fsm === 'opening') enterState('recommend');
    }

    async function runNavigationFlow(nav) {
        switch (nav) {
            case 'dine_in':
                sessionStorage.setItem('dineOption', 'dine_in');
                await aiSpeakChained(SCRIPTS.opening.confirmedDineIn);
                if (state.fsm === 'opening') enterState('recommend');
                break;
            case 'take_out':
                sessionStorage.setItem('dineOption', 'take_out');
                await aiSpeakChained(SCRIPTS.opening.confirmedTakeOut);
                if (state.fsm === 'opening') enterState('recommend');
                break;
            case 'payment':
                if (state.cart.items.length === 0) {
                    await aiSpeakChained(SCRIPTS.confirm.empty);
                    if (state.fsm !== 'recommend') enterState('recommend');
                } else if (state.fsm === 'confirm') {
                    await aiSpeakChained(SCRIPTS.confirm.agree);
                    await goToPayment();
                } else {
                    enterState('confirm');
                }
                break;
            case 'cancel':
                await aiSpeakChained('알겠어요. 천천히 골라봐요.');
                break;
            case 'modify':
                if (state.fsm === 'confirm') {
                    await aiSpeakChained('알겠어요. 더 추가하거나 빼실 수 있어요.');
                    enterState('addmore');
                } else {
                    await aiSpeakChained('수정하실 메뉴를 말씀해 주세요.');
                }
                break;
            case 'add_more': {
                await aiSpeakChained(SCRIPTS.addmore.another);
                const pick = pickRecommendedMenu();
                if (pick) {
                    state.recommendedIds.push(pick.menuId);
                    appendMenuCard(pick);
                }
                if (state.fsm !== 'recommend') enterState('recommend');
                break;
            }
            case 'recommend': {
                const pick = pickRecommendedMenu();
                if (pick) {
                    state.recommendedIds.push(pick.menuId);
                    await aiSpeakChained(SCRIPTS.recommend.recPick(pick));
                    appendMenuCard(pick);
                } else {
                    await aiSpeakChained('지금은 추천 가능한 메뉴를 찾기 어려워요.');
                }
                if (state.fsm === 'opening') enterState('recommend');
                break;
            }
        }
    }

    function matchMenuByName(text) {
        if (!state.menuCache.byId.size) return null;
        const stripped = (text || '').replace(/\s/g, '');
        for (const m of state.menuCache.byId.values()) {
            if (m.isSoldOut) continue;
            const stem = (m.name || '').replace(/[·\s\-,]/g, '');
            if (stem.length >= 2 && stripped.includes(stem.slice(0, 3))) {
                return m;
            }
        }
        return null;
    }

    // ========================================================
    // 12. 카트 (백엔드 동기화)
    // ========================================================
    async function addToCart(menuId, qty) {
        if (!state.sessionId) {
            showToast('세션을 먼저 생성해야 해요.');
            return false;
        }
        const result = await callApi('장바구니 담기', () =>
            window.NunchiApi.Cart.addItem({
                sessionId: state.sessionId,
                menuId,
                quantity: qty || 1,
                optionIds: []
            })
        );
        if (!result) return false;
        applyCartResponse(result);
        logToolCall('cart.addItem', { menuId, quantity: qty || 1 }, {
            totalItems: state.cart.items.length, totalAmount: state.cart.totalAmount
        });
        return true;
    }

    async function refreshCart() {
        if (!state.sessionId) return;
        const result = await callApi('장바구니 조회', () =>
            window.NunchiApi.Cart.get(state.sessionId)
        );
        if (result) applyCartResponse(result);
    }

    function applyCartResponse(cartResp) {
        state.cart = {
            items: cartResp.items || [],
            totalAmount: cartResp.totalAmount || 0
        };
        // 메뉴 캐시에 보강
        state.cart.items.forEach((it) => {
            if (!state.menuCache.byId.has(it.menuId)) {
                state.menuCache.byId.set(it.menuId, {
                    menuId: it.menuId,
                    name: it.menuName,
                    price: it.unitPrice
                });
            }
        });
        persistCartCache();
        renderMinicart();
    }

    function renderMinicart() {
        if (!state.cart.items.length) {
            $minicartEmpty.hidden = false;
            $minicartFilled.hidden = true;
            return;
        }
        $minicartEmpty.hidden = true;
        $minicartFilled.hidden = false;
        $minicartList.innerHTML = '';
        state.cart.items.forEach((it) => {
            const $li = document.createElement('li');
            $li.className = 'a01__minicart-item';
            $li.innerHTML = ''
                + '<span class="a01__minicart-item-name"></span>'
                + '<span class="a01__minicart-item-qty">×' + (it.quantity || 1) + '</span>';
            const display = it.menuName || '';
            $li.querySelector('.a01__minicart-item-name').textContent =
                display.length > 10 ? display.slice(0, 10) + '…' : display;
            $minicartList.appendChild($li);
        });
        $minicartTotal.textContent = fmtPrice(getCartTotal());
    }

    // ========================================================
    // 13. 빠른응답 칩
    // ========================================================
    const CHIPS = {
        opening:   [
            { label: '매장에서요',  text: '매장에서 먹을게요' },
            { label: '포장이요',    text: '포장이요' }
        ],
        recommend: [
            { label: '추천해줘',    text: '추천해주세요' },
            { label: '매콤한 거',   text: '매콤한 메뉴 추천해주세요' },
            { label: '가벼운 거',   text: '가볍게 먹을 거 추천해주세요' }
        ],
        addmore:   [
            { label: '하나 더',     text: '하나 더 추천해주세요' },
            { label: '충분해요',    text: '충분해요. 결제할게요', cta: true }
        ],
        confirm:   [
            { label: '결제할래요',  text: '결제할게요', cta: true },
            { label: '수정할게요',  text: '수정할래요' }
        ]
    };

    function renderChips() {
        $chipRow.innerHTML = '';
        const list = CHIPS[state.fsm] || [];
        list.forEach((c) => {
            const $btn = document.createElement('button');
            $btn.type = 'button';
            $btn.className = 'a01__chip' + (c.cta ? ' a01__chip--cta' : '');
            $btn.textContent = c.label;
            $btn.addEventListener('click', () => userSay(c.text));
            $chipRow.appendChild($btn);
        });
    }

    // ========================================================
    // 14. 단계 인디케이터
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
    // 15. 입력 / 액션 핸들러
    // ========================================================
    function onSendClick() {
        const v = ($input.value || '').trim();
        if (!v) return;
        $input.value = '';
        // 텍스트 입력은 ConvEngine 폴백 경로로도, 직접 userSay 로도 처리 가능.
        // 엔진이 활성이면 폴백 경로(엔진이 모드 갱신 + onUserUtterance 호출).
        if (state.engineStarted && window.ConvEngine && window.ConvEngine.isActive()) {
            window.ConvEngine.submitText(v);
        } else {
            userSay(v);
        }
    }

    function onInputKey(e) {
        if (e.isComposing || e.keyCode === 229) return;
        if (e.key === 'Enter') onSendClick();
    }

    async function onSwitchToNormal() {
        if (state.sessionId) {
            await callApi('세션 종료', () => window.NunchiApi.Sessions.complete(state.sessionId));
        }
        sessionStorage.removeItem('aiSessionId');
        sessionStorage.setItem('mode', 'normal');
        if (window.ConvEngine) window.ConvEngine.stop();
        location.href = '/flowN/N02-menu.html';
    }

    async function goToPayment() {
        if (!state.sessionId) {
            showToast('세션이 없어요. 새로고침 해주세요.');
            return;
        }
        if (!state.cart.items.length) {
            showToast('장바구니가 비어있어요.');
            return;
        }
        const result = await callApi('주문 확정', () =>
            window.NunchiApi.Orders.confirm(state.sessionId)
        );
        if (!result || !result.orderId) return;
        sessionStorage.setItem('orderId', String(result.orderId));
        sessionStorage.setItem('currentStep', 'P01');
        if (window.ConvEngine) window.ConvEngine.stop();
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
    }

    // ========================================================
    // 16. 마이크 버튼 + ConvEngine 통합
    // ========================================================
    function onMicClick() {
        if (!window.ConvEngine) {
            showToast('대화 엔진을 불러오지 못했어요.');
            return;
        }
        if (!window.ConvEngine.isSupported()) {
            showToast('이 브라우저는 음성 입력을 지원하지 않아요. 텍스트로 입력해주세요.');
            $input.focus();
            return;
        }
        if (window.ConvEngine.isActive()) {
            // 활성 → 종료
            window.ConvEngine.stop();
            // 인사말 다시 보여주기 (선택사항)
            return;
        }
        // 비활성 → 시작
        window.ConvEngine.start();
        state.engineStarted = true;
        // 첫 진입이면 enterState('opening') — 이전에 호출됐어도 abort 후 재시작
        enterState('opening');
    }

    function onConvModeChange(next) {
        // 마이크 버튼 시각 상태 갱신
        $micBtn.classList.remove(
            'a01__btn-mic--listening',
            'a01__btn-mic--ai-turn',
            'a01__btn-mic--inactive'
        );
        if (next === 'LISTENING') {
            $micBtn.classList.add('a01__btn-mic--listening');
            $micBtn.setAttribute('aria-pressed', 'true');
            $micBtn.setAttribute('aria-label', '대화 종료');
            $input.placeholder = '듣고 있어요...';
        } else if (next === 'AI_SPEAKING') {
            $micBtn.classList.add('a01__btn-mic--ai-turn');
            $micBtn.setAttribute('aria-pressed', 'true');
            $micBtn.setAttribute('aria-label', '대화 종료 (말씀하시면 끼어들 수 있어요)');
            $input.placeholder = '동대맘이 말하고 있어요';
        } else if (next === 'THINKING') {
            $micBtn.classList.add('a01__btn-mic--ai-turn');
            $input.placeholder = '잠시만요...';
        } else {
            $micBtn.classList.add('a01__btn-mic--inactive');
            $micBtn.setAttribute('aria-pressed', 'false');
            $micBtn.setAttribute('aria-label', '대화 시작');
            $input.placeholder = '동대맘에게 말하거나 입력해보세요';
        }
    }

    function onConvSilencePrompt() {
        // 3초 침묵 되물음 비활성화 — 너무 자주 끼어들어서 거슬림.
        // 사용자 발화 또는 칩 클릭으로만 다음 턴 진행.
        return null;
    }

    function onConvBargeIn() {
        // FSM 의 speechAbort 도 함께 끊어 다음 발화 체인을 정지
        if (state.speechAbort) {
            try { state.speechAbort.abort(); } catch (_) {}
        }
        setAvatar('idle');
    }

    // ========================================================
    // 17. 토스트
    // ========================================================
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
    // 18. 부트
    // ========================================================
    function bind() {
        $sendBtn.addEventListener('click', onSendClick);
        $input.addEventListener('keydown', onInputKey);
        $switchBtn.addEventListener('click', onSwitchToNormal);
        $muteBtn.addEventListener('click', onToggleMute);
        $micBtn.addEventListener('click', onMicClick);
    }

    function bootVideos() {
        $videos.forEach(($v) => { try { $v.play(); } catch (_) {} });
    }

    document.addEventListener('DOMContentLoaded', async () => {
        sessionStorage.setItem('currentStep', 'A01');
        sessionStorage.setItem('mode', 'avatar');

        renderMinicart();
        renderSteps();
        renderChips();
        bind();
        bootVideos();

        // 의존 모듈 가드
        if (!window.NunchiApi || !window.IntentMatcher || !window.ConvEngine) {
            showToast('필수 모듈을 불러오지 못했어요. 새로고침 해주세요.');
            return;
        }

        window.ConvEngine.init({
            speak: aiSpeak,
            onUserUtterance: userSay,
            onSilencePrompt: onConvSilencePrompt,
            onModeChange: onConvModeChange,
            onBargeIn: onConvBargeIn
        });

        onConvModeChange('INACTIVE');

        // 세션 + 메뉴 prefetch (병렬 실행 — 둘 다 끝나야 카트 동기화 가능)
        await Promise.all([loadOrCreateSession(), fetchMenuCatalog()]);
        if (state.sessionId) await refreshCart();

        // 환영 메시지 — 마이크 클릭 전까지는 청취 비활성. 마이크 클릭이 들어오면
        // enterState 가 speechAbort 를 abort 하므로 boot 발화도 깔끔히 컷.
        const bootAbort = new AbortController();
        state.speechAbort = bootAbort;
        await aiSpeak(SCRIPTS.opening.greeting, bootAbort.signal);
        if (bootAbort.signal.aborted) return;
        state.greetedOnBoot = true;
        await aiSpeak(SCRIPTS.opening.startHint, bootAbort.signal);
    });
})();
