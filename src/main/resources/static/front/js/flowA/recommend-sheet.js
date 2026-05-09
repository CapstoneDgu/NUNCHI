// ========================================================
// recommend-sheet.js — 아바타 모드 추천 메뉴 하단 시트 (UMD)
//
// FastAPI /ai/order/chat 응답의 recommendations 배열을 받아
// 화면 하단에서 슬라이드 업되는 시트로 표시.
// 카드별 [담기] + 시트 하단 [다른 거 추천] / [선택 안 함] 버튼.
//
// 사용:
//   <script src="/js/flowA/recommend-sheet.js"></script>
//   RecommendSheet.open({
//     menus: [{menu_id, name, price, image_url}, ...],
//     onPick:    (menu) => Promise<void>,   // 담기 클릭 — 호출자가 카트 추가
//     onAnother: () => void,                // 다른 거 추천 — 호출자가 chat 재호출
//     onCancel:  () => void                 // 선택 안 함 / 닫기
//   });
//   RecommendSheet.close();
//   RecommendSheet.isOpen();
// ========================================================

(function (root) {
    'use strict';

    const STYLES = `
        .rec-sheet__overlay {
            position: fixed; inset: 0;
            background: rgba(30, 25, 21, 0.35);
            z-index: 9000;
            font-family: var(--font-sans, "Pretendard", sans-serif);
            animation: rec-sheet-fade 200ms ease-out;
        }
        @keyframes rec-sheet-fade {
            from { opacity: 0; }
            to   { opacity: 1; }
        }
        .rec-sheet {
            position: absolute;
            left: 0; right: 0; bottom: 0;
            background: var(--neutral-0, #fff);
            border-top-left-radius: 28px;
            border-top-right-radius: 28px;
            box-shadow: 0 -12px 40px rgba(30, 25, 21, 0.18);
            padding: 24px 24px 28px;
            animation: rec-sheet-up 280ms cubic-bezier(0.34, 1.56, 0.64, 1);
            max-height: 70%;
            display: flex; flex-direction: column;
        }
        @keyframes rec-sheet-up {
            from { transform: translateY(100%); }
            to   { transform: translateY(0); }
        }
        .rec-sheet__handle {
            width: 48px; height: 5px;
            background: var(--neutral-200, #DDD9D5);
            border-radius: 3px;
            margin: -8px auto 16px;
        }
        .rec-sheet__header {
            display: flex; align-items: center; justify-content: space-between;
            margin-bottom: 16px;
        }
        .rec-sheet__title {
            margin: 0;
            font-size: 22px; font-weight: 700;
            color: var(--color-text-heading, var(--neutral-800, #352F2B));
        }
        .rec-sheet__close {
            width: 40px; height: 40px;
            border: none; background: var(--neutral-100, #F0EDEA);
            border-radius: 50%;
            cursor: pointer;
            color: var(--neutral-700, #4D4742);
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-size: 22px; line-height: 1;
            font-family: inherit;
            padding: 0;
        }
        .rec-sheet__close:hover { background: var(--neutral-200, #DDD9D5); }

        .rec-sheet__cards {
            display: flex;
            gap: 12px;
            overflow-x: auto;
            padding: 4px 4px 16px;
            scroll-snap-type: x mandatory;
            -webkit-overflow-scrolling: touch;
            scrollbar-width: thin;
        }
        .rec-sheet__cards::-webkit-scrollbar { height: 6px; }
        .rec-sheet__cards::-webkit-scrollbar-thumb {
            background: var(--neutral-200, #DDD9D5);
            border-radius: 3px;
        }

        .rec-card {
            flex: 0 0 200px;
            background: var(--neutral-50, #FAF8F6);
            border: 1px solid var(--neutral-200, #DDD9D5);
            border-radius: 16px;
            padding: 12px;
            scroll-snap-align: start;
            display: flex; flex-direction: column;
        }
        .rec-card__thumb {
            width: 100%; aspect-ratio: 1;
            background: var(--neutral-100, #F0EDEA);
            border-radius: 12px;
            display: flex; align-items: center; justify-content: center;
            overflow: hidden;
            margin-bottom: 10px;
        }
        .rec-card__thumb img {
            width: 100%; height: 100%;
            object-fit: cover;
        }
        .rec-card__thumb-fallback {
            font-size: 36px;
            color: var(--neutral-300, #C2BBB5);
        }
        .rec-card__name {
            font-size: 15px; font-weight: 600;
            color: var(--color-text-heading, var(--neutral-800, #352F2B));
            margin-bottom: 4px;
            line-height: 1.3;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .rec-card__price {
            font-size: 14px; font-weight: 700;
            color: var(--color-text-price, var(--primary-700, #933C06));
            margin-bottom: 12px;
        }
        .rec-card__add {
            margin-top: auto;
            padding: 10px 12px;
            border: none; border-radius: 10px;
            background: var(--color-btn-primary, var(--primary-500, #E8600A));
            color: var(--color-text-inverse, #fff);
            font-size: 14px; font-weight: 600;
            font-family: inherit;
            cursor: pointer;
            transition: background 150ms;
        }
        .rec-card__add:hover {
            background: var(--color-btn-hover, var(--primary-400, #FF8320));
        }
        .rec-card__add:disabled {
            background: var(--neutral-300, #C2BBB5);
            cursor: progress;
        }

        .rec-sheet__actions {
            display: flex; gap: 10px;
            padding-top: 12px;
            border-top: 1px solid var(--neutral-100, #F0EDEA);
        }
        .rec-sheet__btn {
            flex: 1;
            min-height: 56px;
            padding: 14px 16px;
            border: none; border-radius: 12px;
            font-family: inherit;
            font-size: 16px; font-weight: 600;
            cursor: pointer;
            transition: background 150ms;
        }
        .rec-sheet__btn--another {
            background: var(--primary-50, #FFF5EE);
            color: var(--primary-700, #933C06);
            border: 1px solid var(--primary-200, #FFC08A);
        }
        .rec-sheet__btn--another:hover { background: var(--primary-100, #FFE0C7); }
        .rec-sheet__btn--cancel {
            background: var(--neutral-100, #F0EDEA);
            color: var(--neutral-700, #4D4742);
        }
        .rec-sheet__btn--cancel:hover { background: var(--neutral-200, #DDD9D5); }
    `;

    let stylesInjected = false;
    function ensureStyles() {
        if (stylesInjected) return;
        const $s = document.createElement('style');
        $s.textContent = STYLES;
        document.head.appendChild($s);
        stylesInjected = true;
    }

    let activeOverlay = null;

    function close() {
        if (!activeOverlay) return;
        const $o = activeOverlay;
        activeOverlay = null;
        $o.style.opacity = '0';
        setTimeout(() => { $o.remove(); }, 180);
    }

    function isOpen() {
        return !!activeOverlay;
    }

    function open(opts) {
        const o = opts || {};
        const menus = Array.isArray(o.menus) ? o.menus : [];
        if (!menus.length) return;
        ensureStyles();
        if (activeOverlay) close();

        const $overlay = document.createElement('div');
        $overlay.className = 'rec-sheet__overlay';
        $overlay.innerHTML = `
            <div class="rec-sheet" role="dialog" aria-modal="true" aria-label="추천 메뉴">
                <div class="rec-sheet__handle" aria-hidden="true"></div>
                <div class="rec-sheet__header">
                    <h2 class="rec-sheet__title">동대맘의 추천</h2>
                    <button type="button" class="rec-sheet__close" aria-label="닫기">×</button>
                </div>
                <div class="rec-sheet__cards" data-cards></div>
                <div class="rec-sheet__actions">
                    <button type="button" class="rec-sheet__btn rec-sheet__btn--another">다른 메뉴 추천받기</button>
                    <button type="button" class="rec-sheet__btn rec-sheet__btn--cancel">닫기</button>
                </div>
            </div>
        `;

        const $cards = $overlay.querySelector('[data-cards]');
        menus.forEach((m) => $cards.appendChild(buildCard(m, o.onPick)));

        $overlay.querySelector('.rec-sheet__close')
            .addEventListener('click', () => { close(); if (o.onCancel) o.onCancel(); });
        $overlay.querySelector('.rec-sheet__btn--cancel')
            .addEventListener('click', () => { close(); if (o.onCancel) o.onCancel(); });
        $overlay.querySelector('.rec-sheet__btn--another')
            .addEventListener('click', () => { close(); if (o.onAnother) o.onAnother(); });
        // 배경 클릭 닫기
        $overlay.addEventListener('click', (e) => {
            if (e.target === $overlay) {
                close();
                if (o.onCancel) o.onCancel();
            }
        });

        document.body.appendChild($overlay);
        activeOverlay = $overlay;
    }

    function buildCard(menu, onPick) {
        const $card = document.createElement('div');
        $card.className = 'rec-card';

        const price = '₩ ' + Number(menu.price || 0).toLocaleString('ko-KR');
        const imgUrl = menu.image_url || menu.imageUrl;
        const name = menu.name || '';

        $card.innerHTML = `
            <div class="rec-card__thumb">
                ${imgUrl
                    ? `<img alt="${escapeHtml(name)}" src="${escapeAttr(imgUrl)}" />`
                    : '<i class="xi xi-restaurant rec-card__thumb-fallback" aria-hidden="true"></i>'}
            </div>
            <div class="rec-card__name" title="${escapeAttr(name)}">${escapeHtml(name)}</div>
            <div class="rec-card__price">${price}</div>
            <button type="button" class="rec-card__add">담기</button>
        `;

        // 이미지 로드 실패 시 fallback
        const $img = $card.querySelector('img');
        if ($img) {
            $img.addEventListener('error', () => {
                const $thumb = $card.querySelector('.rec-card__thumb');
                $thumb.innerHTML = '<i class="xi xi-restaurant rec-card__thumb-fallback" aria-hidden="true"></i>';
            });
        }

        const $btn = $card.querySelector('.rec-card__add');
        $btn.addEventListener('click', async () => {
            if ($btn.disabled) return;
            $btn.disabled = true;
            $btn.textContent = '담는 중...';
            try {
                if (onPick) await onPick(menu);
            } catch (e) {
                console.warn('[RecommendSheet] onPick 실패', e);
            }
            close();
        });
        return $card;
    }

    function escapeHtml(s) {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
    function escapeAttr(s) {
        return escapeHtml(s);
    }

    root.RecommendSheet = { open, close, isOpen };
})(typeof self !== 'undefined' ? self : this);
