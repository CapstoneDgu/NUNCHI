// ========================================================
// ai-action.js — AI 응답의 화면 명령 dispatcher
//
// MCP/LangGraph 응답 스키마(향후):
//   { reply, current_step, recommendations, menu_options, suggestions,
//     action: { type, ...payload } }       ← 우리가 처리할 부분
//
// 지원 액션 (현재 / 향후 백엔드 도구):
//   navigate                 page → location.href
//   select_floor             floor → 층 탭 click
//   select_restaurant        name  → 식당 사이드바 click
//   highlight_menu           menu_id → 카드 펄스 + 자동 스크롤
//   open_menu_detail         menu_id → 상세 오버레이 오픈 (페이지가 hook 노출 시)
//   close_overlay            현재 열린 오버레이/패널 닫기
//   select_payment_method    method: ic|vein|barcode → P02 카드 click
//
// 추천 시각화:
//   handleRecommendations(list) — 메뉴 카드 펄스 + 첫 메뉴 스크롤
//
// CSS:
//   .ai-pulse  — 1.6s 펄스 효과 (common.css 또는 페이지 CSS 에 정의 필요)
// ========================================================

(function () {
    'use strict';

    const LOG = '[AiAction]';

    function handleAiAction(action) {
        if (!action || !action.type) return;
        console.log(LOG, 'dispatch', action);

        switch (action.type) {
            case 'navigate':
                if (action.page) location.href = action.page;
                break;

            case 'select_floor': {
                const tab = document.querySelector(`[data-floor="F${action.floor}"]`);
                tab?.click();
                break;
            }

            case 'select_restaurant': {
                const stores = document.querySelectorAll('[data-store]');
                for (const el of stores) {
                    const name = el.querySelector('.n02__store-name')?.textContent?.trim();
                    if (name === action.name) { el.click(); break; }
                }
                break;
            }

            case 'highlight_menu':
                highlightMenu(action.menu_id);
                break;

            case 'open_menu_detail':
                if (typeof window.__N02_openDetail === 'function') {
                    window.__N02_openDetail(action.menu_id);
                }
                break;

            case 'close_overlay':
                document.querySelector('[data-action="close-detail"]')?.click();
                document.querySelector('[data-action="close-chat"]')?.click();
                break;

            case 'select_payment_method':
                document.querySelector(`[data-method="${action.method}"]`)?.click();
                break;

            default:
                console.warn(LOG, '미지원 action:', action.type);
        }
    }

    function highlightMenu(menuId) {
        const card = document.querySelector(`[data-menu="${menuId}"]`);
        if (!card) return;
        card.classList.add('ai-pulse');
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => card.classList.remove('ai-pulse'), 2400);
    }

    /**
     * AI 응답의 recommendations 배열을 받아 카드 강조 + 자동 스크롤.
     * 첫 메뉴만 스크롤 / 나머지는 200ms 간격 펄스.
     */
    function handleRecommendations(list) {
        if (!Array.isArray(list) || !list.length) return;
        list.forEach((m, idx) => {
            setTimeout(() => {
                const card = document.querySelector(`[data-menu="${m.menu_id}"]`);
                if (!card) return;
                card.classList.add('ai-pulse');
                if (idx === 0) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setTimeout(() => card.classList.remove('ai-pulse'), 2400);
            }, idx * 220);
        });
    }

    window.AiAction = {
        handle: handleAiAction,
        handleRecommendations: handleRecommendations,
        highlightMenu: highlightMenu,
    };
})();
