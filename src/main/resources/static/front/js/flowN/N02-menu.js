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
    const $detailAiSection      = document.querySelector('[data-detail-ai-section]');
    const $detailAiReason       = document.querySelector('[data-detail-ai-reason]');

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

        // S02-dine 의 dineOption (`dine_in` / `take_out`) → 백엔드 OrderType (`DINE_IN` / `TAKEOUT`)
        // SessionCreateRequest 가 @NotNull 로 orderType 요구하므로 누락 시 400.
        const rawDine = sessionStorage.getItem("dineOption") || "";
        const orderType = (rawDine === "take_out") ? "TAKEOUT" : "DINE_IN";

        const created = await window.Api.session.create({
            mode: safeMode,
            language: "ko",
            orderType: orderType,
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

    // 서버 응답으로 받은 카트로 state.cart 교체 후 UI 갱신
    // 카트만 바뀐 경우 그리드를 통째로 다시 그리지 않고(이미지 재로드 방지 — QA #14)
    // 카드의 담김 표시/수량 뱃지만 제자리에서 갱신한다.
    function applyCartResponse(cartResponse) {
        state.cart = (cartResponse && cartResponse.items) ? cartResponse.items : [];
        syncCardCartState();
        renderCartBar();
    }

    function refreshVisionSelectables() {
        if (!window.NunchiVisionClient || !window.NunchiVisionClient.isEnabled()) return;
        setTimeout(() => window.NunchiVisionClient.refresh(), 0);
    }

    // 메뉴 카드의 in-cart 강조 + 수량 뱃지만 제자리 갱신 (DOM 재생성 X → 이미지 재요청 없음)
    function syncCardCartState() {
        if (!$menuGrid) return;
        $menuGrid.querySelectorAll(".n02__menu-card[data-menu]").forEach((card) => {
            const id = Number(card.getAttribute("data-menu"));
            const qty = getCartQty(id);
            card.classList.toggle("n02__menu-card--in-cart", qty > 0);
            const thumb = card.querySelector(".n02__menu-card-thumb");
            let badge = card.querySelector(".n02__menu-card-qty-badge");
            if (qty > 0) {
                if (!badge && thumb) {
                    badge = document.createElement("span");
                    badge.className = "n02__menu-card-qty-badge";
                    thumb.appendChild(badge);
                }
                if (badge) badge.textContent = String(qty);
            } else if (badge) {
                badge.remove();
            }
        });
    }

    function logApiError(label, e) {
        console.error("[N02] " + label, e);
        const msg = (e && e.message) ? e.message : "요청 실패";
        showN02Toast("⚠ " + label + " 실패: " + msg);
    }

    // ---------- 렌더링: 층 탭 ----------
    function renderFloorTabs() {
        const html = window.MenuData.data.floors.map((f) => {
            const active = f.id === state.currentFloorId;
            return `<button class="pill-tab vision-selectable ${active ? "pill-tab--active" : ""}"
                            type="button"
                            data-floor="${f.id}">${f.label}</button>`;
        }).join("");
        $floorTabs.innerHTML = html;
        refreshVisionSelectables();
    }

    // ---------- 렌더링: 식당 사이드바 ----------
    function renderStoreList() {
        const floor = getFloor(state.currentFloorId);
        if (!floor) { $storeList.innerHTML = ""; return; }

        const html = floor.stores.map((s) => {
            const open   = window.MenuData.isOpenNow(s.hours);
            const active = s.id === state.currentStoreId;
            return `
                <li class="n02__store-item vision-selectable ${active ? "n02__store-item--active" : ""}"
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
        refreshVisionSelectables();
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
                <li class="n02__menu-card ${m.soldOut ? "" : "vision-selectable"} ${inCart ? "n02__menu-card--in-cart" : ""} ${m.soldOut ? "n02__menu-card--sold-out" : ""}"
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
                        ${m.imageUrl ? "" : `<span class="n02__menu-card-thumb-text">${m.name}</span>`}
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
        refreshVisionSelectables();
    }

    // ---------- 렌더링: 카트 바 ----------
    function renderCartBar() {
        const count = totalCartCount();

        if (count === 0) {
            $cartBar.classList.add("n02__cart-bar--empty");
            $cartEmpty.hidden = false;
            $cartFilled.hidden = true;
            refreshVisionSelectables();
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
        refreshVisionSelectables();
    }

    // ---------- 옵션 선택 모달 (담기 시 — QA #9) ----------
    // optGroups: [{groupId, groupName, options:[{optionId, name, extraPrice}]}]
    // optSelected: { [groupId]: optionId } (그룹당 1개 — 라디오)
    const $optModal    = document.querySelector('[data-opt-modal]');
    const $optName     = document.querySelector('[data-opt-name]');
    const $optPrice    = document.querySelector('[data-opt-price]');
    const $optGroupsEl = document.querySelector('[data-opt-groups]');

    let optMenuId = null;
    let optGroups = [];
    const optSelected = {};
    let optBasePrice = 0;

    function renderOptGroups() {
        Object.keys(optSelected).forEach((k) => delete optSelected[k]);
        if (!$optGroupsEl) return;
        if (!optGroups.length) { $optGroupsEl.innerHTML = ""; recomputeOptPrice(); return; }
        $optGroupsEl.innerHTML = optGroups.map((g) => {
            const first = g.options && g.options[0];
            if (first) optSelected[g.groupId] = first.optionId;
            const choices = (g.options || []).map((o) => {
                const sel = first && o.optionId === first.optionId ? " is-selected" : "";
                const price = o.extraPrice > 0
                    ? `<span class="n02__detail-opt-price">+${fmt(o.extraPrice)}</span>` : "";
                return `<button type="button" class="n02__detail-opt vision-selectable${sel}"
                                data-group-id="${g.groupId}" data-option-id="${o.optionId}">
                            <span class="n02__detail-opt-name">${o.name}</span>${price}
                        </button>`;
            }).join("");
            return `<div class="n02__detail-optgroup" data-optgroup="${g.groupId}">
                        <div class="n02__detail-optgroup-head">
                            <span class="n02__detail-optgroup-name">${g.groupName}</span>
                        </div>
                        <div class="n02__detail-optgroup-choices">${choices}</div>
                    </div>`;
        }).join("");
        recomputeOptPrice();
        refreshVisionSelectables();
    }

    function selectOpt(groupId, optionId) {
        optSelected[groupId] = optionId;
        const group = $optGroupsEl && $optGroupsEl.querySelector(`[data-optgroup="${groupId}"]`);
        if (group) {
            group.querySelectorAll(".n02__detail-opt").forEach((b) => {
                b.classList.toggle("is-selected", b.getAttribute("data-option-id") === String(optionId));
            });
        }
        recomputeOptPrice();
    }

    function recomputeOptPrice() {
        let total = optBasePrice;
        for (const g of optGroups) {
            const opt = (g.options || []).find((o) => o.optionId === optSelected[g.groupId]);
            if (opt && opt.extraPrice) total += opt.extraPrice;
        }
        if ($optPrice) $optPrice.textContent = fmt(total);
    }

    function getOptSelectedIds() {
        return optGroups.map((g) => optSelected[g.groupId]).filter((v) => v != null);
    }

    // 메뉴 담기 진입점 (터치·음성 공통) — 옵션 있으면 모달, 없으면 바로 담기
    function openOptionModal(menuId) {
        const found = window.MenuData.findMenuById(menuId);
        if (!found || found.menu.soldOut) return;
        const m = found.menu;
        window.Api.menu.detail(menuId).then((d) => {
            const groups = (d && d.optionGroups) || [];
            if (!groups.length) { addToCart(menuId, { optionIds: [] }); return; }
            optMenuId = menuId;
            optGroups = groups;
            optBasePrice = m.price;
            if ($optName) $optName.textContent = m.name;
            renderOptGroups();
            if ($optModal) $optModal.hidden = false;
            refreshVisionSelectables();
        }).catch((e) => {
            console.warn("[N02] 옵션 조회 실패", e);
            addToCart(menuId, { optionIds: [] });
        });
    }

    function closeOptModal() {
        optMenuId = null;
        optGroups = [];
        if ($optModal) $optModal.hidden = true;
        refreshVisionSelectables();
    }

    // 더 담기(thenCheckout=false): 담고 닫고 계속 / 바로 주문(true): 담고 결제로
    async function optModalAdd(thenCheckout) {
        if (optMenuId == null) return;
        const id = optMenuId;
        const ids = getOptSelectedIds();
        closeOptModal();
        await addToCart(id, { optionIds: ids });
        if (thenCheckout) gotoCheckout();
    }

    // 옵션명과 발화가 매칭되는지 — STT 오인식/축약 고려해 느슨하게.
    const _OPT_GENERIC = ["추가", "선택", "없음", "기본", "변경", "옵션"];
    function _optNameMatches(spoken, optName) {
        const t = (spoken || "").replace(/\s/g, "");
        const n = (optName || "").replace(/\s/g, "");
        if (!t || !n) return false;
        if (t.includes(n) || n.includes(t)) return true;
        const tokens = (optName || "").split(/\s+/).filter((w) => w.length >= 2 && !_OPT_GENERIC.includes(w));
        return tokens.some((w) => t.includes(w));
    }

    // 옵션 모달이 열려 있을 때의 음성 처리 (선택 / 바로주문 / 더담기 / 닫기) — MCP 원격조작도 동일
    function tryOptModalVoice(text) {
        if (!$optModal || $optModal.hidden || optMenuId == null) return false;
        const t = (text || "").replace(/\s/g, "");
        if (!t) return false;
        for (const g of optGroups) {
            for (const o of (g.options || [])) {
                if (_optNameMatches(text, o.name)) {
                    selectOpt(g.groupId, o.optionId);
                    const btn = $optGroupsEl && $optGroupsEl.querySelector(`[data-option-id="${o.optionId}"]`);
                    if (btn) { btn.classList.add("ai-pulse"); setTimeout(() => btn.classList.remove("ai-pulse"), 1200); }
                    return true;
                }
            }
        }
        if (/(바로\s*주문|주문할|결제|주문해)/.test(text) && !/(안|말고|취소|아니|그만)/.test(text)) {
            optModalAdd(true); return true;
        }
        if (/(더\s*담|담아|담기|넣어|추가|이걸로)/.test(text) && !/(안|말고|취소|아니|그만)/.test(text)) {
            optModalAdd(false); return true;
        }
        if (/(닫아|닫기|취소|그만|나가)/.test(t)) { closeOptModal(); return true; }
        return false;
    }

    // 상세(정보) 오버레이 음성 — 담기는 옵션 모달로 연결, 닫기.
    function tryDetailVoice(text) {
        if (!$detail || $detail.hidden || openDetailMenuId == null) return false;
        const t = (text || "").replace(/\s/g, "");
        if (!t) return false;
        if (/(담아|담기|넣어|이걸로|주문|추가|시킬)/.test(t) && !/(안|말고|취소|아니|그만)/.test(t)) {
            const id = openDetailMenuId;
            closeDetail();
            openOptionModal(id);
            return true;
        }
        if (/(닫아|닫기|취소|그만|뒤로|나가)/.test(t)) { closeDetail(); return true; }
        return false;
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

        // CTA 가격 (옵션 로딩 전 base 가격)
        $detailCtaPrice.textContent = "· " + fmt(m.price);

        // AI 추천 이유 — 우선 숨기고, 상세 API 응답에 aiReason 있으면 노출 (QA #5, 백엔드 제공 전제)
        // (옵션 선택은 상세가 아니라 담기 시 옵션 모달에서 처리 — QA #9)
        if ($detailAiSection) $detailAiSection.hidden = true;
        window.Api.menu.detail(menuId).then((d) => {
            if (openDetailMenuId !== menuId) return;   // 그새 다른 메뉴 열렸으면 무시
            const reason = d && (d.aiReason || d.aiRecommendReason);
            if (reason && $detailAiSection && $detailAiReason) {
                $detailAiReason.textContent = reason;
                $detailAiSection.hidden = false;
            }
        }).catch((e) => console.warn("[N02] 상세 조회 실패", e));

        $detail.hidden = false;
        $detail.setAttribute("aria-hidden", "false");
        refreshVisionSelectables();

        // 눈치 감지 — 담지 않고 상세만 반복해서 열면 repeat_browse 신호
        if (window.NunchiSensor) window.NunchiSensor.noteDetailOpen(menuId);
    }

    function closeDetail() {
        openDetailMenuId = null;
        $detail.hidden = true;
        $detail.setAttribute("aria-hidden", "true");
        refreshVisionSelectables();
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
                optionIds: Array.isArray(opts.optionIds) ? opts.optionIds : [],
            });
            applyCartResponse(res);

            // 눈치 감지 — "담음" = 결정함 → 반복탐색 카운터 리셋
            if (window.NunchiSensor) window.NunchiSensor.noteCartAdd();

            // 담기 피드백은 토스트로 — 대화기록(채팅)에는 실제 대화만 남긴다 (QA #6)
            if (!opts.silent) {
                showN02Toast(`${found.menu.name} 담았어요`);
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
                showN02Toast(`${item.menuName} 뺐어요`);
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

    // ---------- 채팅 패널 ----------
    // chatLog 메모리 누적은 더 이상 사용 안 함 (JSON export 제거).
    // 대화 영속은 서버(POST /api/sessions/{id}/messages) 에 LangGraph 가 자동 저장.
    function pushChatBubble(role, text) {
        // 대화기록에는 실제 대화만 남긴다 — role: "user"(내 발화) | "ai"(AI 응답)
        // 담기/처리 같은 로컬 피드백은 채팅이 아니라 토스트/화면으로 처리한다.
        const node = document.createElement("div");
        node.className = "ai-chat-bubble ai-chat-bubble--" + role;
        const iconHtml = (role === "ai" || role === "system")
            ? '<i class="xi xi-message"></i>'
            : (role === "tool" ? '<i class="xi xi-lightning"></i>' : '');
        node.innerHTML = `
            <div class="ai-chat-bubble__body"></div>
            <div class="ai-chat-bubble__time">${iconHtml}<span>${nowHHMM()}</span></div>
        `;
        // textContent 로 안전하게 (XSS 방지)
        node.querySelector(".ai-chat-bubble__body").textContent = text;
        $chatMessages.appendChild(node);

        if ($chatPanel.classList.contains("ai-chat-panel--open")) {
            $chatMessages.scrollTop = $chatMessages.scrollHeight;
        }
    }

    function renderChatInitial() {
        if ($chatSession) $chatSession.textContent = state.sessionId ?? "—";
        $chatMessages.innerHTML = "";
        pushChatBubble("ai",
            "안녕하세요! 상록원 AI 주문 도우미입니다. 상단 마이크 버튼을 눌러 음성으로 주문해보세요.");
    }

    // 패널 헤더의 마이크 상태 표시 (off / listening / thinking)
    const $micStatusEl       = document.querySelector('[data-mic-status]');
    const $micStatusTitle    = document.querySelector('[data-mic-status-title]');
    const $micStatusDesc     = document.querySelector('[data-mic-status-desc]');
    const $micStatusBadge    = document.querySelector('[data-mic-status-badge]');
    function setMicStatus(kind) {
        if (!$micStatusEl) return;
        $micStatusEl.dataset.mic = kind;
        const COPY = {
            off:       { title: "마이크 꺼짐",        desc: "상단 마이크 버튼을 눌러 음성 주문을 시작하세요", badge: "OFF" },
            listening: { title: "듣고 있어요",        desc: "편하게 말씀해 주세요",                            badge: "LIVE" },
            thinking:  { title: "응답을 준비 중…",    desc: "잠시만 기다려주세요",                              badge: "…"   },
        };
        const c = COPY[kind] || COPY.off;
        if ($micStatusTitle) $micStatusTitle.textContent = c.title;
        if ($micStatusDesc)  $micStatusDesc.textContent  = c.desc;
        if ($micStatusBadge) $micStatusBadge.textContent = c.badge;
    }

    function resetChat() {
        // 서버 세션은 유지 — UI 만 초기 인사말로 되돌림
        renderChatInitial();
    }

    // ---------- 마이크 / ConvEngine ----------
    // ConvEngine 은 사용자 발화 → onUserUtterance(text) 콜백으로 final 텍스트 전달.
    // 우리는 그 텍스트를 FastAPI /ai/order/chat 으로 보내고 응답을 채팅 패널에 표시한다.
    // TTS 는 일반 모드에서는 사용하지 않으므로 speak 핸들러 없음.
    let _convEngineInited = false;
    function initConvEngineOnce() {
        if (_convEngineInited) return;
        if (!window.ConvEngine || !window.ConvEngine.isSupported || !window.ConvEngine.isSupported()) {
            console.warn("[N02] Web Speech API 미지원");
            pushChatBubble("ai", "이 브라우저는 음성 인식을 지원하지 않아 채팅으로만 안내드려요.");
            return;
        }
        window.ConvEngine.init({
            onInterim: (interim) => {
                // 실시간 자막 — 상태 패널 desc 자리에 짧게 노출
                if ($micStatusDesc && interim) $micStatusDesc.textContent = "…" + interim;
            },
            onUserUtterance: async (text) => {
                console.log("[N02 mic] user 발화 final:", text, "micActive=" + state.micActive);
                pushChatBubble("user", text);
                setMicStatus("thinking");
                await dispatchUserUtterance(text);
                // 처리 끝났으면 다시 LISTENING 으로 — 단 페이지 이동 중이면 무의미
                console.log("[N02 mic] dispatch 종료, endTurn 시도. micActive=" + state.micActive
                    + ", convMode=" + (window.ConvEngine && window.ConvEngine.getMode && window.ConvEngine.getMode()));
                if (state.micActive && window.ConvEngine) {
                    window.ConvEngine.endTurn();
                    setMicStatus("listening");
                }
            },
            onSilencePrompt: () => null,  // 침묵 시 자동 재촉발화 안 함
            onBargeIn: () => {},
            onModeChange: (m) => console.log("[N02 mic] ConvEngine mode →", m),
        });
        _convEngineInited = true;
    }

    async function dispatchUserUtterance(text) {
        // 0) 옵션 모달/상세가 열려 있으면 그 안에서 우선 처리 (LLM 없이) — QA #9
        if (tryOptModalVoice(text)) return;
        if (tryDetailVoice(text)) return;

        // 1) JS quick-action — 결정론적 명령(결제하기/뒤로/층/결제수단 등)은 LLM 없이 0ms 처리
        if (window.QuickAction && window.QuickAction.try(text, { page: location.pathname })) {
            return;
        }

        // 2) 세션 보장
        if (!state.sessionId) {
            try { await ensureServerSession(); } catch (e) {
                logApiError("세션 발급", e);
                return;
            }
        }

        // 3) FastAPI/LangGraph 호출 — 502/504 1회 재시도
        const callAi = () => window.Api.Ai.chat({
            session_id: state.sessionId,
            text: text,
            mode: "NORMAL",
        });

        try {
            let res;
            try {
                res = await callAi();
            } catch (firstErr) {
                const isGateway = firstErr && (firstErr.status === 502 || firstErr.status === 504);
                if (!isGateway) throw firstErr;
                console.warn("[N02] AI 응답 502/504, 1회 재시도");
                await new Promise(r => setTimeout(r, 1000));
                res = await callAi();
            }

            if (res && res.reply) pushChatBubble("ai", res.reply);

            // AI 가 백엔드 카트를 변경했을 수 있으므로 서버 카트 재동기화
            await syncCartFromServer();

            // 4) 옵션 필요한 메뉴 → 상세(옵션 UI) 자동 오픈 → 사용자가 옵션 고르고 "담아줘"
            if (res && res.menu_options && res.menu_options.menu_id != null) {
                openOptionModal(res.menu_options.menu_id);   // 옵션 모달로 (QA #9, MCP 동일 플로우)
            } else if (window.AiAction && res && res.action) {
                const a = res.action;
                // 빈 카트로 결제/주문확인 화면 이동 금지 — 메뉴부터 담게 안내
                if (a.type === "navigate" && (a.page === "/summary" || a.page === "/payment") && !state.cart.length) {
                    pushChatBubble("ai", "장바구니가 비어 있어요. 메뉴를 먼저 담아주세요.");
                } else {
                    window.AiAction.handle(a);
                }
            }
            // 5) 추천 시각화
            if (window.AiAction && res && res.recommendations) {
                window.AiAction.handleRecommendations(res.recommendations);
            }
        } catch (e) {
            // 처리 중 중첩으로 버려진 발화 — 에러 아님, 조용히 무시(직전 요청이 곧 응답).
            if (e && e._busy) {
                console.log("[N02] 처리 중 — 중복 발화 무시:", text);
                return;
            }
            console.error("[N02] AI 응답 최종 실패", e);
            const friendly = (e && (e.status === 502 || e.status === 504))
                ? "AI 서버가 잠시 응답이 느려요. 잠시 후 다시 말씀해주세요."
                : "응답을 가져오지 못했어요. 다시 시도해 주세요.";
            pushChatBubble("ai", friendly);
        }
    }

    // ---------- 눈치 신호 전송 (QA R2-5) ----------
    // 사용자가 망설이는 행동(체류=silence / 반복탐색=repeat_browse)을 감지하면
    // 발화 없이도 AI 에게 nunchi_signal 을 보낸다. 백엔드는 이 신호를 받으면
    // 무조건 hesitation → 추천(recommend) 흐름으로 처리해 추천 메뉴를 돌려준다.
    async function sendNunchiSignal(signal) {
        // 세션 보장 (없으면 발급)
        if (!state.sessionId) {
            try { await ensureServerSession(); } catch (e) {
                console.warn("[N02] 눈치 신호 — 세션 발급 실패", e);
                return;
            }
        }
        try {
            // text 는 @NotNull(min_length=1) 이라 짧은 망설임 표현을 함께 보낸다.
            // (라우팅은 nunchi_signal 이 결정하므로 text 내용은 영향 없음)
            const res = await window.Api.Ai.chat({
                session_id: state.sessionId,
                text: "음...",
                nunchi_signal: signal,
                mode: "NORMAL",
            });
            if (res && res.reply) {
                pushChatBubble("ai", res.reply);
                // 대화 패널이 닫혀 있어도 보이도록 짧게 토스트로 알림
                showN02Toast(res.reply.length > 36 ? res.reply.slice(0, 35) + "…" : res.reply);
            }
            // 추천 메뉴 카드 강조 + 스크롤
            if (window.AiAction && res && res.recommendations) {
                window.AiAction.handleRecommendations(res.recommendations);
            }
        } catch (e) {
            // 음성 요청 처리 중이면 조용히 무시 (_busy) — 다음 기회에 다시 감지됨
            if (e && e._busy) return;
            console.warn("[N02] 눈치 신호 처리 실패", e);
        }
    }

    // 미사용 (AiAction 모듈로 이관). 페이지 전용 액션 필요 시만 활용.
    function handleAiAction(action) {
        if (!action || !action.type) return;
        switch (action.type) {
            case "navigate":
                if (action.page) location.href = action.page;
                break;
            default:
                console.log("[N02] 미지원 action:", action);
        }
    }

    function startMic() {
        initConvEngineOnce();
        if (!window.ConvEngine || !window.ConvEngine.isSupported()) return;
        window.ConvEngine.start();
        window.ConvEngine.endTurn();   // 인사 발화 없이 즉시 LISTENING
        state.micActive = true;
        try { sessionStorage.setItem("voiceMicOn", "1"); } catch (_) {}  // 결제 화면까지 ON 유지
        $micBtn.classList.add("app-topbar__action-icon--mic-active");
        setMicStatus("listening");
        // 마이크만 켠다 — 대화기록 패널은 자동으로 열지 않는다 (QA #7, 패널은 대화기록 버튼으로만)
    }

    function stopMic() {
        if (window.ConvEngine) window.ConvEngine.stop();
        state.micActive = false;
        try { sessionStorage.setItem("voiceMicOn", "0"); } catch (_) {}  // 명시적 OFF
        $micBtn.classList.remove("app-topbar__action-icon--mic-active");
        setMicStatus("off");
    }

    function toggleMic() {
        if (state.micActive) stopMic();
        else                  startMic();
    }

    // ---------- 결제 ----------
    function gotoCheckout() {
        if (!state.cart.length) return;
        try {
            sessionStorage.setItem("currentStep", "P01");
        } catch (e) { /* noop */ }
        location.href = PAY_NEXT_URL;
    }

    // ---------- 매장/포장 토글 (QA #3) ----------
    const DINE_KEY = 'dineOption';
    function getDine() {
        return sessionStorage.getItem(DINE_KEY) === 'take_out' ? 'take_out' : 'dine_in';
    }
    function renderDineLabel() {
        const el = document.querySelector('[data-bind="dineLabel"]');
        if (el) el.textContent = getDine() === 'take_out' ? '포장' : '매장';
    }
    function toggleDine() {
        const next = getDine() === 'take_out' ? 'dine_in' : 'take_out';
        try { sessionStorage.setItem(DINE_KEY, next); } catch (_) {}
        renderDineLabel();
        showN02Toast(next === 'take_out'
            ? '포장으로 변경했어요'
            : '매장 식사로 변경했어요');
    }

    // ---------- 토스트 ----------
    function showN02Toast(msg) {
        let t = document.querySelector('.n02__toast');
        if (!t) {
            t = document.createElement('div');
            t.className = 'n02__toast';
            document.body.appendChild(t);
        }
        t.textContent = msg;
        t.classList.add('is-visible');
        clearTimeout(showN02Toast._timer);
        showN02Toast._timer = setTimeout(() => t.classList.remove('is-visible'), 2000);
    }

    // ---------- 첫 진입 가이드 오버레이 (QA #13) ----------
    // 회색 쉐이드 위 가이드, 화면 터치하면 해제. 한 세션(주문)당 1회만.
    function initGuideOverlay() {
        const $guide = document.querySelector('[data-guide]');
        if (!$guide) return;
        let seen = false;
        try { seen = sessionStorage.getItem('n02GuideSeen') === '1'; } catch (_) {}
        // ?guide=1 (또는 ?guide=show): 이미 본 세션이어도 가이드를 강제로 다시 띄움 — QA/테스트용
        let force = false;
        try { force = /[?&]guide=(1|show)(\b|$)/.test(location.search); } catch (_) {}
        if (seen && !force) return;
        $guide.hidden = false;
        refreshVisionSelectables();

        const closeGuide = () => {
            if ($guide.hidden) return;
            $guide.hidden = true;
            clearGuideLit();
            try { sessionStorage.setItem('n02GuideSeen', '1'); } catch (_) {}
            window.removeEventListener('resize', $guide._redraw);
            window.removeEventListener('nunchi:vision-move', onGuideVisionMove);
            window.removeEventListener('nunchi:vision-click', onGuideVisionClick);
            if (window.NunchiSensor) window.NunchiSensor.resume();
            refreshVisionSelectables();
        };

        const onGuideVisionMove = (event) => {
            if ($guide.hidden) return;
            if (event.detail && event.detail.direction === 'RIGHT') {
                event.preventDefault();
                closeGuide();
            }
        };

        const onGuideVisionClick = (event) => {
            if ($guide.hidden) return;
            event.preventDefault();
            closeGuide();
        };

        window.addEventListener('nunchi:vision-move', onGuideVisionMove);
        window.addEventListener('nunchi:vision-click', onGuideVisionClick);

        // 실제 버튼 위치를 재서 점선 + 화살표를 그림 (메뉴 카드는 동적이라 좌표를 고정할 수 없음)
        drawGuideLines($guide);
        // 레이아웃/폰트가 안정된 다음 프레임에 한 번 더 — 첫 측정 어긋남 방지 (QA R2-13)
        requestAnimationFrame(() => requestAnimationFrame(() => {
            if (!$guide.hidden) drawGuideLines($guide);
        }));
        // 메뉴 카드 이미지가 늦게 로드되면 카드/배지 위치가 내려앉는다 →
        // 이미지 load 와 짧은 지연 후 다시 그려 상세칩·AI배지 어긋남 방지. (QA R2-27)
        const _reflow = () => { if (!$guide.hidden) drawGuideLines($guide); };
        if ($menuGrid) {
            $menuGrid.querySelectorAll('img').forEach((img) => {
                if (!img.complete) img.addEventListener('load', _reflow, { once: true });
            });
        }
        setTimeout(_reflow, 250);
        setTimeout(_reflow, 700);

        $guide.addEventListener('click', () => {
            $guide.hidden = true;
            clearGuideLit();   // 대상 밝게/상단바 들어올림 원복
            try { sessionStorage.setItem('n02GuideSeen', '1'); } catch (_) {}
            window.removeEventListener('resize', $guide._redraw);
            // 가이드를 닫고 실제 주문을 시작하는 시점부터 눈치 감지 재개
            if (window.NunchiSensor) window.NunchiSensor.resume();
            refreshVisionSelectables();
        }, { once: true });

        // 창 크기 변동 시 다시 그림
        $guide._redraw = () => drawGuideLines($guide);
        window.addEventListener('resize', $guide._redraw);
    }

    // 콜아웃은 HTML 에서 화면 전체에 고르게 "고정 배치"(겹침 없음) 되어 있고,
    // 여기서는 각 콜아웃 → 대상 버튼까지 점선 화살표만 그린다. (QA R2-11)
    // .page-bg 의 zoom 은 svg/콜아웃/대상이 모두 동일하게 받으므로
    // svg 표시영역 기준으로 환산하면 viewBox(720x1280) 좌표가 그대로 맞는다.
    // 가이드 중 어둠 위로 "복제해 띄운" 대상들 — 닫을 때 제거하기 위해 기억
    let _liftClones = [];
    function clearGuideLit() {
        _liftClones.forEach((el) => { try { el.remove(); } catch (_) {} });
        _liftClones = [];
    }

    // 대상(배지/버튼)을 복제해 가이드 위에 똑같은 위치/크기로 띄워 밝게 강조. (QA R2-22)
    // 카드 overflow:hidden 에 갇힌 배지도 복제본은 어둠 위에 또렷이 보인다. 점선 화살표는 그 근방을 가리킴.
    // 가이드 복제본(밝은 블록) 위치 미세조정 (논리 px). 음수=위/왼쪽, 양수=아래/오른쪽.
    //   대상별로 개별 보정. 키 = data-guide-target 셀렉터. 없으면 0,0 (보정 안 함).
    //   상세칩/AI추천 배지는 카드 안 좌표라 살짝 어긋나 보일 수 있어 여기서만 미세조정한다.
    const GUIDE_NUDGE = {
        ".n02__menu-card-ai-badge":    { x: 0, y: 0 },   // AI 추천 배지
        ".n02__menu-card-detail-chip": { x: 0, y: 0 },   // 상세 칩
    };

    function drawGuideLines($guide) {
        const $svg   = $guide.querySelector('.n02-guide__svg');
        const $lines = $guide.querySelector('[data-guide-lines]');
        if (!$svg || !$lines) return;

        // 모든 좌표를 720×1280 "논리 좌표" 하나로 통일 (QA R2-23).
        //   - .page-bg 는 720×1280 고정이고 zoom 으로 균일 축소만 된다.
        //   - getBoundingClientRect 는 zoom 적용된 화면 픽셀 → scale 로 나눠 논리 좌표로 환원.
        //   - SVG viewBox 는 0 0 720 1280 고정, 콜아웃/복제본도 같은 논리 좌표 → 어떤 창에서도 안 비틀림.
        const guideRect = $guide.getBoundingClientRect();
        if (!guideRect.width) return;
        $svg.setAttribute('viewBox', '0 0 720 1280');
        const scale = guideRect.width / 720;     // 화면픽셀 / 논리픽셀
        const toLX = (px) => (px - guideRect.left) / scale;   // 화면 → 가이드 논리 X
        const toLY = (py) => (py - guideRect.top)  / scale;   // 화면 → 가이드 논리 Y

        const SVGNS = 'http://www.w3.org/2000/svg';
        $lines.innerHTML = "";
        clearGuideLit();

        $guide.querySelectorAll('.n02-guide__callout').forEach((callout) => {
            const sel = callout.getAttribute('data-guide-target');
            const target = sel ? document.querySelector(sel) : null;
            if (!target || target.offsetParent === null) {  // 대상 없으면(예: 추천 메뉴 없음) 콜아웃 숨김
                callout.style.display = "none";
                return;
            }
            callout.style.display = "";

            const tr = target.getBoundingClientRect();
            // 대상 박스 (논리 좌표)
            const tbox = { left: toLX(tr.left), right: toLX(tr.right), top: toLY(tr.top), bottom: toLY(tr.bottom) };
            const tcx = (tbox.left + tbox.right) / 2;
            const tcy = (tbox.top + tbox.bottom) / 2;

            // ① 대상 복제본을 가이드 위 동일 위치로 띄움 — 밝게 + 글로우.
            //    크기는 강제하지 않는다(원본 class 의 padding/flex 로 자기 크기 유지) → 디자인·글자 100% 동일.
            //    위치만 논리 좌표 left/top 으로 지정해 원본과 정확히 포갬. (QA R2-24)
            const clone = target.cloneNode(true);
            clone.classList.add('n02-guide__lift');
            clone.removeAttribute('data-guide-target');
            clone.id = '';
            // 위치 = 원본 좌표 + 대상별 미세조정(NUDGE). 대부분 0,0 — 상세칩/AI배지만 필요 시 보정.
            const nudge = GUIDE_NUDGE[sel] || { x: 0, y: 0 };
            let cloneLeft = tbox.left + nudge.x, cloneTop = tbox.top + nudge.y;
            clone.style.left = cloneLeft.toFixed(1) + 'px';
            clone.style.top  = cloneTop.toFixed(1) + 'px';
            $guide.appendChild(clone);
            _liftClones.push(clone);

            // 자기보정 — 붙인 직후 복제본 실제 위치를 측정해 목표(tbox + nudge)와의 오차만큼 보정.
            //   (상속 마진/반올림으로 살짝 밀리는 것을 측정 기반으로 정확히 잡음 — 줌 무관) (QA R2-26)
            const cl = clone.getBoundingClientRect();
            const dxErr = (tbox.left + nudge.x) - toLX(cl.left);
            const dyErr = (tbox.top  + nudge.y) - toLY(cl.top);
            if (Math.abs(dxErr) > 0.5 || Math.abs(dyErr) > 0.5) {
                cloneLeft += dxErr; cloneTop += dyErr;
                clone.style.left = cloneLeft.toFixed(1) + 'px';
                clone.style.top  = cloneTop.toFixed(1) + 'px';
            }

            // ② 콜아웃 → 대상 근방 점선 화살표 (콜아웃도 논리 좌표)
            const cr = callout.getBoundingClientRect();
            const cbox = { left: toLX(cr.left), right: toLX(cr.right), top: toLY(cr.top), bottom: toLY(cr.bottom) };
            const ccx = (cbox.left + cbox.right) / 2;
            const ccy = (cbox.top + cbox.bottom) / 2;

            const start = rayHitRect(ccx, ccy, tcx, tcy, cbox, 2);
            const end   = rayHitRect(start.x, start.y, tcx, tcy, tbox, 12);  // 글로우 테두리 바깥쪽

            const path = document.createElementNS(SVGNS, 'path');
            path.setAttribute('d', `M${start.x.toFixed(1)},${start.y.toFixed(1)} L${end.x.toFixed(1)},${end.y.toFixed(1)}`);
            $lines.appendChild(path);
        });
    }

    // 시작점(박스 밖)에서 대상 중심을 향하는 ray 가 박스 경계와 처음 만나는 점.
    // pad 만큼 박스를 키워 화살촉이 블록에 파묻히지 않고 살짝 떨어져 가리키게 한다.
    function rayHitRect(sx, sy, cx, cy, box, pad) {
        const left = box.left - pad, right = box.right + pad;
        const top = box.top - pad,  bottom = box.bottom + pad;
        const dx = cx - sx, dy = cy - sy;
        const ts = [];
        if (dx !== 0) {
            const tL = (left - sx) / dx,  yL = sy + tL * dy;
            if (tL > 0 && tL <= 1 && yL >= top && yL <= bottom) ts.push(tL);
            const tR = (right - sx) / dx, yR = sy + tR * dy;
            if (tR > 0 && tR <= 1 && yR >= top && yR <= bottom) ts.push(tR);
        }
        if (dy !== 0) {
            const tT = (top - sy) / dy,    xT = sx + tT * dx;
            if (tT > 0 && tT <= 1 && xT >= left && xT <= right) ts.push(tT);
            const tB = (bottom - sy) / dy, xB = sx + tB * dx;
            if (tB > 0 && tB <= 1 && xB >= left && xB <= right) ts.push(tB);
        }
        const t = ts.length ? Math.min(...ts) : 1;
        return { x: sx + t * dx, y: sy + t * dy };
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
            // 1) "+ 담기" 버튼 → 옵션 모달 (옵션 없으면 바로 담김) — QA #9
            const addBtn = e.target.closest("[data-add]");
            if (addBtn) {
                e.stopPropagation();
                openOptionModal(parseInt(addBtn.getAttribute("data-add"), 10));
                return;
            }
            // 2) 썸네일 → 상세 오버레이
            const thumb = e.target.closest("[data-detail-trigger]");
            if (thumb) {
                openDetail(parseInt(thumb.getAttribute("data-detail-trigger"), 10));
                return;
            }
            // 3) 눈 포커스/카드 직접 클릭은 "+ 담기"와 같은 흐름으로 처리
            const card = e.target.closest("[data-menu]");
            if (card) {
                openOptionModal(parseInt(card.getAttribute("data-menu"), 10));
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

        // 매장/포장 토글
        document.addEventListener("click", (e) => {
            if (e.target.closest('[data-action="toggle-dine"]')) toggleDine();
        });

        // 상세 닫기
        document.addEventListener("click", (e) => {
            const btn = e.target.closest('[data-action="close-detail"]');
            if (btn) closeDetail();
        });

        // 옵션 모달 — 옵션 선택(그룹당 라디오) + 더담기/바로주문 + 닫기 (QA #9)
        if ($optGroupsEl) {
            $optGroupsEl.addEventListener("click", (e) => {
                const opt = e.target.closest(".n02__detail-opt");
                if (!opt) return;
                selectOpt(Number(opt.getAttribute("data-group-id")), Number(opt.getAttribute("data-option-id")));
            });
        }
        if ($optModal) {
            $optModal.addEventListener("click", (e) => {
                if (e.target.closest('[data-opt-close]')) { closeOptModal(); return; }
                const act = e.target.closest('[data-opt-action]');
                if (!act) return;
                optModalAdd(act.getAttribute("data-opt-action") === "order");
            });
        }

        // 상세에서 "담기" → 옵션 모달로 연결 (옵션 없으면 바로 담김)
        document.addEventListener("click", (e) => {
            const btn = e.target.closest('[data-action="add-from-detail"]');
            if (btn && openDetailMenuId != null) {
                const id = openDetailMenuId;
                closeDetail();
                openOptionModal(id);
            }
        });

        // AI 채팅
        document.addEventListener("click", (e) => {
            if (e.target.closest('[data-action="open-chat"]'))   openChat();
            if (e.target.closest('[data-action="close-chat"]'))  closeChat();
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
        renderDineLabel();
        bindEvents();
        initGuideOverlay();

        // 눈치 감지기 — 망설임(체류/반복탐색) 감지 시 AI 추천 유도 (QA R2-5)
        if (window.NunchiSensor) {
            window.NunchiSensor.init({
                getCartCount: () => state.cart.length,
                onSignal: (signal) => sendNunchiSignal(signal),
            });
            // 첫 진입 가이드가 떠 있으면 닫힐 때까지 감지 일시정지
            const $g0 = document.querySelector('[data-guide]');
            if ($g0 && !$g0.hidden) window.NunchiSensor.pause();
        }

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

        // 가이드가 아직 떠 있으면, 이제 렌더된 메뉴 카드(AI추천·상세) 위치까지 점선 다시 그림
        const $g = document.querySelector('[data-guide]');
        if ($g && !$g.hidden) drawGuideLines($g);

        // QuickAction / AiAction 모듈이 호출할 수 있는 핸들러 노출
        window.__N02_gotoCheckout = gotoCheckout;
        window.__N02_openDetail   = openDetail;

        // 외부에서 마이크 강제 종료 (QuickAction "마이크 꺼" 명령) 수신
        window.addEventListener("voice:stop", () => { if (state.micActive) stopMic(); });

        // 직전 화면(결제 등)에서 마이크가 켜져 있었으면 자동으로 다시 켠다.
        try {
            if (sessionStorage.getItem("voiceMicOn") === "1" && !state.micActive) {
                startMic();
            }
        } catch (_) {}

        // 운영 상태는 1분마다 갱신
        setInterval(renderStoreList, 60 * 1000);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", bootstrap);
    } else {
        bootstrap();
    }
})();
