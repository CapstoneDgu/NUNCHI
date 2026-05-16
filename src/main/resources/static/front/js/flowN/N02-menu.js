// ========================================================
// N02-menu.js — 메뉴 목록 화면 통합 로직
// 책임:
//   - 층 탭 / 식당 사이드바 / 메뉴 그리드 렌더링
//   - 운영시간 기반 자동 운영중·마감 표시
//   - 서버 Redis 장바구니 추가/수량/삭제 + 카드 강조 + 카트 바 갱신
//   - 메뉴 상세 풀스크린 오버레이 오픈/클로즈
//   - AI 대화 기록 패널 슬라이드 토글
//
// 의존: window.MenuData (menu-data.js), window.Api (api.js)
// 세션 키: sessionId, mode, currentFloor, currentStore, currentStep (sessionStorage)
// 카트 진실의 원천: 서버 Redis (GET /api/orders/cart/{sessionId})
//   ─ 클라 sessionStorage 에 카트를 저장하지 않는다.
//   ─ AI(FastAPI) 가 같은 Redis 카트를 직접 변경할 수 있으므로,
//     "담았어요" 류 응답 직후에는 Api.cart.get(sessionId) 으로 재동기화 필요.
// ========================================================

(function () {
    'use strict';

    // ---------- 상수 / 상태 ----------
    const PAY_NEXT_URL = "/summary"; // 추후 페이지

    const state = {
        currentFloorId: null,
        currentStoreId: null,
        // 서버 CartResponse.items 그대로:
        // [{ itemId(string UUID), menuId, menuName, unitPrice, quantity, itemTotal, options[] }]
        cart: [],
        chatLog: [],         // [{ role: "system"|"user"|"tool", text, ts }]
        sessionId: null,     // 서버 발급 Long
        mode: null,          // "NORMAL" | "AVATAR"
        micActive: false,
    };

    // ---------- DOM 캐시 ----------
    const $brand          = document.querySelector('[data-bind="brand"]');
    const $storeName      = document.querySelector('[data-bind="storeName"]');
    const $floorTabs      = document.querySelector('[data-floor-tabs]');
    const $storeList      = document.querySelector('[data-store-list]');
    const $menuGrid       = document.querySelector('[data-menu-grid]');
    const $menuEmpty      = document.querySelector('[data-menu-empty]');

    const $cartBar        = document.querySelector('[data-cart-bar]');
    const $cartEmpty      = document.querySelector('[data-cart-empty]');
    const $cartFilled     = document.querySelector('[data-cart-filled]');
    const $cartCount      = document.querySelector('[data-cart-count]');
    const $cartTotal      = document.querySelector('[data-cart-total]');
    const $cartTrack      = document.querySelector('[data-cart-track]');
    const $cartArrowPrev  = document.querySelector('[data-cart-arrow="prev"]');
    const $cartArrowNext  = document.querySelector('[data-cart-arrow="next"]');
    const $cartPayAmount  = document.querySelector('[data-cart-pay-amount]');

    const $detail         = document.querySelector('[data-detail]');
    const $detailHero     = document.querySelector('[data-detail-hero]');
    const $detailName     = document.querySelector('[data-detail-name]');
    const $detailPrice    = document.querySelector('[data-detail-price]');
    const $detailDesc     = document.querySelector('[data-detail-desc]');
    const $detailComps    = document.querySelector('[data-detail-components]');
    const $detailIngs     = document.querySelector('[data-detail-ingredients]');
    const $detailNutKcal  = document.querySelector('[data-detail-nut-kcal]');
    const $detailNutP     = document.querySelector('[data-detail-nut-protein]');
    const $detailNutC     = document.querySelector('[data-detail-nut-carb]');
    const $detailNutF     = document.querySelector('[data-detail-nut-fat]');
    const $detailCtaPrice = document.querySelector('[data-detail-cta-price]');

    const $chatPanel      = document.querySelector('[data-chat-panel]');
    const $chatDim        = document.querySelector('[data-chat-dim]');
    const $chatMessages   = document.querySelector('[data-chat-messages]');
    const $chatSession    = document.querySelector('[data-chat-session]');
    const $micBtn         = document.querySelector('[data-action="toggle-mic"]');

    let openDetailMenuId = null;

    // ---------- 유틸 ----------
    const fmt = window.MenuData.formatPrice;

    function nowHHMM() {
        const d = new Date();
        const pad = (n) => String(n).padStart(2, "0");
        const h24 = d.getHours();
        const period = h24 < 12 ? "오전" : "오후";
        const h12 = pad(((h24 + 11) % 12) + 1);
        return period + " " + h12 + ":" + pad(d.getMinutes());
    }

    // ---------- 세션 로드/저장 ----------
    // sessionStorage 에는 "서버 데이터에 접근할 키" 만 남긴다.
    // 카트 본체는 서버 Redis. 새로고침 시 sessionId 로 다시 fetch.
    function loadSession() {
        try {
            state.currentFloorId = sessionStorage.getItem("currentFloor");
            state.currentStoreId = sessionStorage.getItem("currentStore");
            state.mode           = sessionStorage.getItem("mode") || "NORMAL";

            const stored = sessionStorage.getItem("sessionId");
            state.sessionId = stored ? Number(stored) : null;
        } catch (e) {
            console.warn("[N02] 세션 로드 실패", e);
        }
    }

    // 서버 세션이 없으면 새로 발급, 있으면 유지
    async function ensureServerSession() {
        if (state.sessionId) return state.sessionId;

        // 백엔드 SessionMode enum 은 대문자(NORMAL/AVATAR). 옛 sessionStorage 잔여물 방어.
        const rawMode = (state.mode || "NORMAL").toUpperCase();
        const safeMode = (rawMode === "AVATAR") ? "AVATAR" : "NORMAL";

        const created = await window.Api.session.create({
            mode: safeMode,
            language: "ko",
        });
        state.sessionId = created.sessionId;
        sessionStorage.setItem("sessionId", String(state.sessionId));
        return state.sessionId;
    }

    function persistFloorStore() {
        try {
            sessionStorage.setItem("currentFloor", state.currentFloorId);
            sessionStorage.setItem("currentStore", state.currentStoreId);

            // 결제 화면들이 매장명 표시용으로 사용
            const store = getStore(state.currentFloorId, state.currentStoreId);
            if (store) sessionStorage.setItem("currentStoreName", store.name);
        } catch (e) {
            console.warn("[N02] 위치 저장 실패", e);
        }
    }

    // ---------- 데이터 헬퍼 ----------
    function getFloor(id) {
        return window.MenuData.data.floors.find((f) => f.id === id);
    }

    function getStore(floorId, storeId) {
        const f = getFloor(floorId);
        if (!f) return null;
        return f.stores.find((s) => s.id === storeId) || null;
    }

    // 메뉴 카드 뱃지용: 같은 menuId 의 모든 라인 수량 합산
    // (옵션이 다른 동일 메뉴는 서버에서 별도 itemId 로 분리됨)
    function getCartQty(menuId) {
        return state.cart
            .filter((i) => i.menuId === menuId)
            .reduce((sum, i) => sum + i.quantity, 0);
    }

    function totalCartCount() {
        return state.cart.reduce((sum, i) => sum + i.quantity, 0);
    }

    function totalCartAmount() {
        return state.cart.reduce((sum, i) => sum + (i.itemTotal || 0), 0);
    }

    // 서버 응답으로 받은 카트로 state.cart 교체 후 UI 재렌더
    function applyCartResponse(cartResponse) {
        state.cart = (cartResponse && cartResponse.items) ? cartResponse.items : [];
        renderMenuGrid();
        renderCartBar();
    }

    function logApiError(label, e) {
        console.error("[N02] " + label, e);
        const msg = (e && e.message) ? e.message : "요청 실패";
        pushChatBubble("system", "⚠ " + label + " 실패: " + msg);
    }

    // ---------- 렌더링: 층 탭 ----------
    function renderFloorTabs() {
        const html = window.MenuData.data.floors.map((f) => {
            const active = f.id === state.currentFloorId;
            return `<button class="pill-tab ${active ? "pill-tab--active" : ""}"
                            type="button"
                            data-floor="${f.id}">${f.label}</button>`;
        }).join("");
        $floorTabs.innerHTML = html;
    }

    // ---------- 렌더링: 식당 사이드바 ----------
    function renderStoreList() {
        const floor = getFloor(state.currentFloorId);
        if (!floor) { $storeList.innerHTML = ""; return; }

        const html = floor.stores.map((s) => {
            const open   = window.MenuData.isOpenNow(s.hours);
            const active = s.id === state.currentStoreId;
            return `
                <li class="n02__store-item ${active ? "n02__store-item--active" : ""}"
                    data-store="${s.id}">
                    <span class="n02__store-name">${s.name}</span>
                    <span class="n02__store-hours">${s.hours}</span>
                    ${s.dailyDate ? `<span class="n02__store-daily">오늘 (${s.dailyDate})</span>` : ""}
                    <span class="n02__store-status ${open ? "" : "n02__store-status--closed"}">
                        ${open ? "운영중" : "마감"}
                    </span>
                </li>`;
        }).join("");
        $storeList.innerHTML = html;
    }

    // ---------- 렌더링: 메뉴 그리드 ----------
    function renderMenuGrid() {
        const store = getStore(state.currentFloorId, state.currentStoreId);
        if (!store) {
            $menuGrid.innerHTML = "";
            $menuEmpty.hidden = false;
            return;
        }

        // 매장 이름을 상단바에 반영
        $storeName.textContent = store.name;

        if (!store.menus.length) {
            $menuGrid.innerHTML = "";
            $menuEmpty.hidden = false;
            return;
        }
        $menuEmpty.hidden = true;

        const html = store.menus.map((m) => {
            const meta  = window.MenuData.buildMenuMeta(m);
            const qty   = getCartQty(m.id);
            const inCart = qty > 0;

            // 원산지 한 줄 요약 (앞 2개 + 외)
            const originSummary = meta.ingredients
                .slice(0, 2)
                .map((i) => `${i.name}(${i.origin})`)
                .join(" · ") + (meta.ingredients.length > 2 ? " 외" : "");

            const thumbStyle = m.imageUrl
                ? `style="background-image:url('${m.imageUrl}');background-size:cover;background-position:center;"`
                : "";

            return `
                <li class="n02__menu-card ${inCart ? "n02__menu-card--in-cart" : ""} ${m.soldOut ? "n02__menu-card--sold-out" : ""}"
                    data-menu="${m.id}">
                    <div class="n02__menu-card-thumb" data-detail-trigger="${m.id}" ${thumbStyle}>
                        ${m.aiPick ? `
                            <span class="n02__menu-card-ai-badge">
                                <i class="xi xi-lightning"></i>AI 추천
                            </span>` : ""}
                        ${m.badge ? `
                            <span class="n02__menu-card-extra-badge">${m.badge}</span>` : ""}
                        <span class="n02__menu-card-detail-chip">
                            상세 <i class="xi xi-angle-right-thin"></i>
                        </span>
                        <span class="n02__menu-card-thumb-text">${m.name}</span>
                        ${qty > 0 ? `
                            <span class="n02__menu-card-qty-badge">${qty}</span>` : ""}
                    </div>
                    <div class="n02__menu-card-info">
                        <span class="n02__menu-card-name">${m.name}</span>
                        <span class="n02__menu-card-origin">${originSummary}</span>
                        <span class="n02__menu-card-price">${fmt(m.price)}</span>
                    </div>
                    <button class="n02__menu-card-add"
                            type="button"
                            data-add="${m.id}"
                            ${m.soldOut ? "disabled" : ""}>
                        <i class="xi xi-plus-thin"></i>담기
                    </button>
                </li>`;
        }).join("");
        $menuGrid.innerHTML = html;
    }

    // ---------- 렌더링: 카트 바 ----------
    function renderCartBar() {
        const count = totalCartCount();

        if (count === 0) {
            $cartBar.classList.add("n02__cart-bar--empty");
            $cartEmpty.hidden = false;
            $cartFilled.hidden = true;
            return;
        }

        $cartBar.classList.remove("n02__cart-bar--empty");
        $cartEmpty.hidden = true;
        $cartFilled.hidden = false;

        $cartCount.textContent = count;
        const total = totalCartAmount();
        $cartTotal.textContent = fmt(total);
        $cartPayAmount.textContent = "· " + fmt(total);

        const html = state.cart.map((item) => {
            const optionText = (item.options && item.options.length)
                ? item.options.map((o) => o.optionName).join(" · ")
                : "";

            // 썸네일 — imageUrl 있으면 background-image (cover), 없으면 메뉴명 텍스트 fallback
            const thumbStyle = item.imageUrl
                ? ` style="background-image:url('${item.imageUrl}');background-size:cover;background-position:center;"`
                : "";
            const thumbInner = item.imageUrl ? "" : item.menuName;

            return `
                <li class="n02__cart-item" data-cart-item="${item.itemId}">
                    <div class="n02__cart-item-thumb"${thumbStyle}>${thumbInner}</div>
                    <div class="n02__cart-item-name-row">
                        <span class="n02__cart-item-name">${item.menuName}${optionText ? ` <small>(${optionText})</small>` : ""}</span>
                        <button class="n02__cart-item-remove"
                                type="button"
                                data-cart-remove="${item.itemId}"
                                aria-label="삭제">
                            <i class="xi xi-close-thin"></i>
                        </button>
                    </div>
                    <div class="n02__cart-item-bottom">
                        <span class="n02__cart-item-price">${fmt(item.itemTotal)}</span>
                        <div class="qty-stepper">
                            <button class="qty-stepper__btn qty-stepper__btn--minus"
                                    type="button"
                                    data-cart-qty="${item.itemId}"
                                    data-delta="-1"
                                    aria-label="수량 감소">−</button>
                            <span class="qty-stepper__value">${item.quantity}</span>
                            <button class="qty-stepper__btn"
                                    type="button"
                                    data-cart-qty="${item.itemId}"
                                    data-delta="1"
                                    aria-label="수량 증가">+</button>
                        </div>
                    </div>
                </li>`;
        }).join("");
        $cartTrack.innerHTML = html;

        // 화살표는 아이템이 2개 이상일 때만 노출
        const showArrows = state.cart.length > 2;
        $cartArrowPrev.hidden = !showArrows;
        $cartArrowNext.hidden = !showArrows;
    }

    // ---------- 메뉴 상세 오버레이 ----------
    function openDetail(menuId) {
        const found = window.MenuData.findMenuById(menuId);
        if (!found) return;
        const m = found.menu;
        const meta = window.MenuData.buildMenuMeta(m);

        openDetailMenuId = menuId;

        $detailName.textContent  = m.name;
        $detailPrice.textContent = fmt(m.price);
        $detailDesc.textContent  = meta.description;

        // 사진 — 등록된 imageUrl 우선, 없으면 placeholder 그라데이션
        if (m.imageUrl) {
            $detailHero.style.background =
                "url('" + m.imageUrl + "') center/cover no-repeat";
        } else {
            $detailHero.style.background =
                "linear-gradient(135deg, var(--neutral-200), var(--neutral-300))";
        }

        // 메뉴 구성 칩
        $detailComps.innerHTML = meta.components
            .map((c) => `<span class="n02__detail-chip">${c}</span>`)
            .join("");

        // 원재료 + 원산지
        $detailIngs.innerHTML = meta.ingredients.map((i) => `
            <li class="n02__detail-ingredient-row">
                <span class="n02__detail-ingredient-name">${i.name}</span>
                <span class="origin-pill ${i.imported ? "origin-pill--imported" : ""}">
                    ${i.origin}
                </span>
            </li>`).join("");

        // 영양정보
        $detailNutKcal.textContent = meta.nutrition.kcal;
        $detailNutP.textContent    = meta.nutrition.protein;
        $detailNutC.textContent    = meta.nutrition.carb;
        $detailNutF.textContent    = meta.nutrition.fat;

        // CTA 가격
        $detailCtaPrice.textContent = "· " + fmt(m.price);

        $detail.hidden = false;
        $detail.setAttribute("aria-hidden", "false");
    }

    function closeDetail() {
        openDetailMenuId = null;
        $detail.hidden = true;
        $detail.setAttribute("aria-hidden", "true");
    }

    // ---------- 카트 조작 (모두 서버 Api.cart.* 호출) ----------
    async function addToCart(menuId, opts) {
        opts = opts || {};
        const found = window.MenuData.findMenuById(menuId);
        if (!found || found.menu.soldOut) return;

        try {
            const sessionId = await ensureServerSession();
            const res = await window.Api.cart.addItem({
                sessionId: sessionId,
                menuId: menuId,
                quantity: 1,
                optionIds: [],
            });
            applyCartResponse(res);

            if (!opts.silent) {
                pushChatBubble("system", `${found.menu.name}을(를) 장바구니에 담았어요! ${fmt(found.menu.price)}`);
                pushChatBubble("tool",   `🛒 ${found.menu.name} 담기 실행`);
            }
        } catch (e) {
            logApiError("장바구니 추가", e);
        }
    }

    async function changeCartQty(itemId, delta) {
        const item = state.cart.find((i) => i.itemId === itemId);
        if (!item) return;
        const next = item.quantity + delta;
        if (next <= 0) {
            await removeFromCart(itemId, { silent: true });
            return;
        }
        try {
            const res = await window.Api.cart.updateItem(state.sessionId, itemId, next);
            applyCartResponse(res);
        } catch (e) {
            logApiError("수량 변경", e);
        }
    }

    async function removeFromCart(itemId, opts) {
        opts = opts || {};
        const item = state.cart.find((i) => i.itemId === itemId);
        try {
            const res = await window.Api.cart.removeItem(state.sessionId, itemId);
            applyCartResponse(res);
            if (!opts.silent && item) {
                pushChatBubble("system", `${item.menuName}을(를) 장바구니에서 뺐어요.`);
            }
        } catch (e) {
            logApiError("장바구니 삭제", e);
        }
    }

    // AI 가 서버 카트를 직접 변경한 직후 호출되는 동기화 헬퍼
    // (FastAPI 응답 처리 코드에서 사용 예정)
    async function syncCartFromServer() {
        if (!state.sessionId) return;
        try {
            const res = await window.Api.cart.get(state.sessionId);
            applyCartResponse(res);
        } catch (e) {
            logApiError("카트 동기화", e);
        }
    }
    window.__N02_syncCart = syncCartFromServer;

    // ---------- AI 채팅 패널 ----------
    function openChat() {
        $chatPanel.classList.add("ai-chat-panel--open");
        $chatPanel.setAttribute("aria-hidden", "false");
        $chatDim.classList.add("ai-chat-dim--open");
        $chatDim.setAttribute("aria-hidden", "false");
        // 스크롤 맨 아래로
        $chatMessages.scrollTop = $chatMessages.scrollHeight;
    }

    function closeChat() {
        $chatPanel.classList.remove("ai-chat-panel--open");
        $chatPanel.setAttribute("aria-hidden", "true");
        $chatDim.classList.remove("ai-chat-dim--open");
        $chatDim.setAttribute("aria-hidden", "true");
    }

    function pushChatBubble(role, text) {
        const item = { role: role, text: text, ts: nowHHMM() };
        state.chatLog.push(item);
        renderChatBubble(item);
        // 패널 열려 있으면 자동 스크롤
        if ($chatPanel.classList.contains("ai-chat-panel--open")) {
            $chatMessages.scrollTop = $chatMessages.scrollHeight;
        }
    }

    function renderChatBubble(item) {
        const cls = "ai-chat-bubble--" + item.role;
        const iconHtml = item.role === "system"
            ? '<i class="xi xi-message"></i>'
            : (item.role === "tool"
                ? '<i class="xi xi-lightning"></i>'
                : '');
        const node = document.createElement("div");
        node.className = "ai-chat-bubble " + cls;
        node.innerHTML = `
            <div class="ai-chat-bubble__body">${item.text}</div>
            <div class="ai-chat-bubble__time">${iconHtml}<span>${item.ts}</span></div>
        `;
        $chatMessages.appendChild(node);
    }

    function renderChatInitial() {
        $chatSession.textContent = state.sessionId;
        $chatMessages.innerHTML = "";
        // 디폴트 인사말
        pushChatBubble("system",
            "안녕하세요! 상록원 AI 주문 도우미입니다. 음성으로 편하게 주문하세요 😊 핀 마이크가 항상 켜져 있어 버튼을 누르지 않아도 돼요.");
    }

    function exportChatJson() {
        const blob = new Blob(
            [JSON.stringify({ sessionId: state.sessionId, log: state.chatLog }, null, 2)],
            { type: "application/json" }
        );
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `nunchi-session-${state.sessionId}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    function resetChat() {
        state.chatLog = [];
        state.sessionId = generateSessionId();
        sessionStorage.setItem("aiSessionId", state.sessionId);
        renderChatInitial();
    }

    // ---------- 마이크 토글 ----------
    function toggleMic() {
        state.micActive = !state.micActive;
        $micBtn.classList.toggle("app-topbar__action-icon--mic-active", state.micActive);
        if (state.micActive) {
            pushChatBubble("system", "🎙️ 청취 시작 — 편하게 말씀해 주세요");
        } else {
            pushChatBubble("system", "🔇 청취 일시 정지");
        }
    }

    // ---------- 결제 ----------
    function gotoCheckout() {
        if (!state.cart.length) return;
        try {
            sessionStorage.setItem("currentStep", "P01");
        } catch (e) { /* noop */ }
        location.href = PAY_NEXT_URL;
    }

    // ---------- 이벤트 위임 ----------
    function bindEvents() {
        // 층 탭
        $floorTabs.addEventListener("click", (e) => {
            const btn = e.target.closest("[data-floor]");
            if (!btn) return;
            const fid = btn.getAttribute("data-floor");
            if (fid === state.currentFloorId) return;
            state.currentFloorId = fid;
            // 새 층의 첫 식당으로 자동 선택
            const f = getFloor(fid);
            state.currentStoreId = f && f.stores[0] ? f.stores[0].id : null;
            persistFloorStore();
            renderFloorTabs();
            renderStoreList();
            renderMenuGrid();
        });

        // 사이드바 식당 클릭
        $storeList.addEventListener("click", (e) => {
            const li = e.target.closest("[data-store]");
            if (!li) return;
            const sid = li.getAttribute("data-store");
            if (sid === state.currentStoreId) return;
            state.currentStoreId = sid;
            persistFloorStore();
            renderStoreList();
            renderMenuGrid();
        });

        // 메뉴 그리드 위임
        $menuGrid.addEventListener("click", (e) => {
            // 1) "+ 담기" 버튼
            const addBtn = e.target.closest("[data-add]");
            if (addBtn) {
                e.stopPropagation();
                addToCart(parseInt(addBtn.getAttribute("data-add"), 10));
                return;
            }
            // 2) 썸네일 → 상세 오버레이
            const thumb = e.target.closest("[data-detail-trigger]");
            if (thumb) {
                openDetail(parseInt(thumb.getAttribute("data-detail-trigger"), 10));
                return;
            }
        });

        // 카트 바 — 수량 / 삭제 (itemId 는 서버 발급 string UUID)
        $cartTrack.addEventListener("click", (e) => {
            const qtyBtn = e.target.closest("[data-cart-qty]");
            if (qtyBtn) {
                const itemId = qtyBtn.getAttribute("data-cart-qty");
                const delta  = parseInt(qtyBtn.getAttribute("data-delta"), 10);
                changeCartQty(itemId, delta);
                return;
            }
            const rmBtn = e.target.closest("[data-cart-remove]");
            if (rmBtn) {
                removeFromCart(rmBtn.getAttribute("data-cart-remove"));
                return;
            }
        });

        // 카트 화살표
        $cartArrowPrev.addEventListener("click", () => {
            $cartTrack.scrollBy({ left: -180, behavior: "smooth" });
        });
        $cartArrowNext.addEventListener("click", () => {
            $cartTrack.scrollBy({ left: 180, behavior: "smooth" });
        });

        // 결제하기
        document.addEventListener("click", (e) => {
            const btn = e.target.closest('[data-action="checkout"]');
            if (btn) gotoCheckout();
        });

        // 상세 닫기
        document.addEventListener("click", (e) => {
            const btn = e.target.closest('[data-action="close-detail"]');
            if (btn) closeDetail();
        });

        // 상세에서 카트 담기
        document.addEventListener("click", (e) => {
            const btn = e.target.closest('[data-action="add-from-detail"]');
            if (btn && openDetailMenuId != null) {
                addToCart(openDetailMenuId);
                closeDetail();
            }
        });

        // AI 채팅
        document.addEventListener("click", (e) => {
            if (e.target.closest('[data-action="open-chat"]'))   openChat();
            if (e.target.closest('[data-action="close-chat"]'))  closeChat();
            if (e.target.closest('[data-action="export-chat"]')) exportChatJson();
            if (e.target.closest('[data-action="reset-chat"]'))  resetChat();
        });
        $chatDim.addEventListener("click", closeChat);

        // 마이크
        $micBtn.addEventListener("click", toggleMic);

        // ESC 로 오버레이 닫기 (디버깅 편의)
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
                if (!$detail.hidden) closeDetail();
                else if ($chatPanel.classList.contains("ai-chat-panel--open")) closeChat();
            }
        });
    }

    // ---------- 초기화 ----------
    async function bootstrap() {
        loadSession();
        sessionStorage.setItem("currentStep", "N02");

        // 매장 브랜드명 (API 로드 전에도 표시)
        $brand.textContent = window.MenuData.data.brand;

        // 채팅/이벤트는 데이터 로드와 무관하게 먼저 세팅
        renderChatInitial();
        renderCartBar();
        bindEvents();

        // 백엔드에서 메뉴 트리 로드 + 서버 세션/카트 동기화 (병렬)
        try {
            await Promise.all([
                window.MenuData.load(),
                ensureServerSession().then(() => syncCartFromServer()),
            ]);
        } catch (e) {
            console.error("[N02] 초기 로드 실패", e);
            $menuEmpty.hidden = false;
            $menuEmpty.querySelector("p").textContent =
                "데이터를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.";
            return;
        }

        if (!window.MenuData.data.floors.length) {
            $menuEmpty.hidden = false;
            return;
        }

        // 기본 위치 = 첫 층 / 첫 식당 (세션값이 유효하면 그대로)
        if (!state.currentFloorId || !getFloor(state.currentFloorId)) {
            state.currentFloorId = window.MenuData.data.floors[0].id;
        }
        const f = getFloor(state.currentFloorId);
        if (!state.currentStoreId || !getStore(state.currentFloorId, state.currentStoreId)) {
            state.currentStoreId = f && f.stores[0] ? f.stores[0].id : null;
        }
        persistFloorStore();

        renderFloorTabs();
        renderStoreList();
        renderMenuGrid();
        renderCartBar();

        // 운영 상태는 1분마다 갱신
        setInterval(renderStoreList, 60 * 1000);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", bootstrap);
    } else {
        bootstrap();
    }
})();
