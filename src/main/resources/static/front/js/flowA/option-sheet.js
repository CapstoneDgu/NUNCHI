// ========================================================
// option-sheet.js — 메뉴 옵션 선택 하단 시트 (UMD)
//
// FastAPI 응답의 menu_options 필드를 받아
// 화면 하단에서 슬라이드 업되는 시트로 옵션 선택 UI 표시.
// 라디오(max_select=1) / 체크박스(max_select>1) 그룹 지원.
//
// 사용:
//   <script src="/js/flowA/option-sheet.js"></script>
//   OptionSheet.open({
//     menuOptions: { menu_id, menu_name, option_groups: [...] },
//     onConfirm: (selectedOptionIds) => void,  // 담기 버튼
//     onCancel:  () => void                     // 취소/배경/X
//   });
//   OptionSheet.close();
//   OptionSheet.isOpen();
// ========================================================

(function (root) {
    'use strict';

    const STYLES = `
        .opt-sheet__overlay {
            position: absolute; inset: 0;
            background: rgba(30, 25, 21, 0.35);
            z-index: 9000;
            font-family: var(--font-sans, "Pretendard", sans-serif);
            animation: opt-sheet-fade 200ms ease-out;
        }
        @keyframes opt-sheet-fade {
            from { opacity: 0; }
            to   { opacity: 1; }
        }
        .opt-sheet {
            position: absolute;
            left: 0; right: 0; bottom: 0;
            background: var(--neutral-0, #fff);
            border-top-left-radius: 28px;
            border-top-right-radius: 28px;
            box-shadow: 0 -12px 40px rgba(30, 25, 21, 0.18);
            padding: 24px 24px 28px;
            animation: opt-sheet-up 280ms cubic-bezier(0.34, 1.56, 0.64, 1);
            max-height: 85%;
            display: flex; flex-direction: column;
        }
        @keyframes opt-sheet-up {
            from { transform: translateY(100%); }
            to   { transform: translateY(0); }
        }
        @keyframes opt-sheet-shake {
            0%, 100% { transform: translateX(0); }
            20%, 60% { transform: translateX(-8px); }
            40%, 80% { transform: translateX(8px); }
        }
        .opt-sheet--shake {
            animation: opt-sheet-shake 360ms ease-in-out;
        }
        .opt-sheet__handle {
            width: 48px; height: 5px;
            background: var(--neutral-200, #DDD9D5);
            border-radius: 3px;
            margin: -8px auto 16px;
        }
        .opt-sheet__header {
            display: flex; align-items: center; justify-content: space-between;
            margin-bottom: 16px;
        }
        .opt-sheet__title {
            margin: 0;
            font-size: 22px; font-weight: 700;
            color: var(--color-text-heading, var(--neutral-800, #352F2B));
        }
        .opt-sheet__close {
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
        .opt-sheet__close:hover { background: var(--neutral-200, #DDD9D5); }

        .opt-sheet__body {
            flex: 1 1 auto;
            overflow-y: auto;
            padding: 4px 4px 16px;
            -webkit-overflow-scrolling: touch;
            scrollbar-width: thin;
        }
        .opt-sheet__body::-webkit-scrollbar { width: 6px; }
        .opt-sheet__body::-webkit-scrollbar-thumb {
            background: var(--neutral-200, #DDD9D5);
            border-radius: 3px;
        }

        .opt-group {
            margin-bottom: 20px;
        }
        .opt-group:last-child { margin-bottom: 4px; }
        .opt-group__head {
            display: flex; align-items: center; gap: 8px;
            margin-bottom: 12px;
        }
        .opt-group__name {
            font-size: 17px; font-weight: 700;
            color: var(--color-text-heading, var(--neutral-800, #352F2B));
        }
        .opt-group__required {
            font-size: 12px; font-weight: 700;
            color: var(--neutral-0, #fff);
            background: var(--semantic-error, #E53935);
            border-radius: 6px;
            padding: 3px 8px;
            line-height: 1;
        }
        .opt-group__hint {
            font-size: 13px;
            color: var(--neutral-500, #8A827C);
            margin-left: auto;
        }

        .opt-group__list {
            display: flex; flex-direction: column;
            gap: 8px;
        }
        .opt-item {
            display: flex; align-items: center;
            min-height: 56px;
            padding: 12px 16px;
            border: 1px solid var(--neutral-200, #DDD9D5);
            border-radius: 12px;
            background: var(--neutral-0, #fff);
            cursor: pointer;
            transition: background 120ms, border-color 120ms;
        }
        .opt-item:hover {
            background: var(--neutral-50, #FAF8F6);
        }
        .opt-item--checked {
            border-color: var(--primary-500, #E8600A);
            background: var(--primary-50, #FFF5EE);
        }
        .opt-item__input {
            appearance: none;
            -webkit-appearance: none;
            width: 28px; height: 28px;
            margin: 0 14px 0 0;
            border: 2px solid var(--neutral-300, #C2BBB5);
            background: var(--neutral-0, #fff);
            cursor: pointer;
            flex-shrink: 0;
            position: relative;
            transition: border-color 120ms, background 120ms;
        }
        .opt-item__input[type="radio"] { border-radius: 50%; }
        .opt-item__input[type="checkbox"] { border-radius: 6px; }
        .opt-item__input:checked {
            border-color: var(--primary-500, #E8600A);
            background: var(--primary-500, #E8600A);
        }
        .opt-item__input[type="radio"]:checked::after {
            content: '';
            position: absolute;
            top: 50%; left: 50%;
            width: 12px; height: 12px;
            border-radius: 50%;
            background: var(--neutral-0, #fff);
            transform: translate(-50%, -50%);
        }
        .opt-item__input[type="checkbox"]:checked::after {
            content: '';
            position: absolute;
            top: 50%; left: 50%;
            width: 8px; height: 14px;
            border: solid var(--neutral-0, #fff);
            border-width: 0 3px 3px 0;
            transform: translate(-50%, -60%) rotate(45deg);
        }
        .opt-item__input:disabled {
            opacity: 0.4;
            cursor: not-allowed;
        }
        .opt-item__name {
            flex: 1;
            font-size: 16px; font-weight: 500;
            color: var(--color-text-heading, var(--neutral-800, #352F2B));
        }
        .opt-item__price {
            font-size: 15px; font-weight: 700;
            color: var(--color-text-price, var(--primary-700, #933C06));
            margin-left: 8px;
        }

        .opt-sheet__toast {
            position: absolute;
            left: 50%; bottom: 110px;
            transform: translateX(-50%);
            background: rgba(30, 25, 21, 0.92);
            color: var(--neutral-0, #fff);
            font-size: 14px; font-weight: 600;
            padding: 10px 18px;
            border-radius: 999px;
            pointer-events: none;
            opacity: 0;
            transition: opacity 180ms;
            z-index: 1;
        }
        .opt-sheet__toast--show { opacity: 1; }

        .opt-sheet__actions {
            display: flex; gap: 10px;
            padding-top: 12px;
            border-top: 1px solid var(--neutral-100, #F0EDEA);
        }
        .opt-sheet__btn {
            flex: 1;
            min-height: 56px;
            padding: 14px 16px;
            border: none; border-radius: 12px;
            font-family: inherit;
            font-size: 16px; font-weight: 600;
            cursor: pointer;
            transition: background 150ms;
        }
        .opt-sheet__btn--cancel {
            background: var(--neutral-100, #F0EDEA);
            color: var(--neutral-700, #4D4742);
        }
        .opt-sheet__btn--cancel:hover { background: var(--neutral-200, #DDD9D5); }
        .opt-sheet__btn--confirm {
            background: var(--color-btn-primary, var(--primary-500, #E8600A));
            color: var(--color-text-inverse, #fff);
        }
        .opt-sheet__btn--confirm:hover {
            background: var(--color-btn-hover, var(--primary-400, #FF8320));
        }
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
        const menuOptions = o.menuOptions || {};
        const groups = Array.isArray(menuOptions.option_groups) ? menuOptions.option_groups : [];
        if (!groups.length) {
            // 옵션이 없으면 바로 confirm (선택 ID 없음)
            if (o.onConfirm) o.onConfirm([]);
            return;
        }
        ensureStyles();
        if (activeOverlay) close();

        const menuName = menuOptions.menu_name || '옵션 선택';

        const $overlay = document.createElement('div');
        $overlay.className = 'opt-sheet__overlay';
        $overlay.innerHTML = `
            <div class="opt-sheet" role="dialog" aria-modal="true" aria-label="옵션 선택">
                <div class="opt-sheet__handle" aria-hidden="true"></div>
                <div class="opt-sheet__header">
                    <h2 class="opt-sheet__title">${escapeHtml(menuName)}</h2>
                    <button type="button" class="opt-sheet__close" aria-label="닫기">×</button>
                </div>
                <div class="opt-sheet__body" data-body></div>
                <div class="opt-sheet__toast" data-toast>필수 옵션을 선택해 주세요</div>
                <div class="opt-sheet__actions">
                    <button type="button" class="opt-sheet__btn opt-sheet__btn--cancel">취소</button>
                    <button type="button" class="opt-sheet__btn opt-sheet__btn--confirm">담기</button>
                </div>
            </div>
        `;

        const $body = $overlay.querySelector('[data-body]');
        const groupRefs = []; // { group, $inputs, type }

        groups.forEach((g, idx) => {
            const groupRef = buildGroup(g, idx);
            $body.appendChild(groupRef.$el);
            groupRefs.push(groupRef);
        });

        const $sheet = $overlay.querySelector('.opt-sheet');
        const $toast = $overlay.querySelector('[data-toast]');
        let toastTimer = null;
        function showToast(msg) {
            if (msg) $toast.textContent = msg;
            $toast.classList.add('opt-sheet__toast--show');
            $sheet.classList.remove('opt-sheet--shake');
            // reflow 후 재적용
            void $sheet.offsetWidth;
            $sheet.classList.add('opt-sheet--shake');
            if (toastTimer) clearTimeout(toastTimer);
            toastTimer = setTimeout(() => {
                $toast.classList.remove('opt-sheet__toast--show');
            }, 1600);
        }

        // 취소/X/배경 닫기
        const handleCancel = () => { close(); if (o.onCancel) o.onCancel(); };
        $overlay.querySelector('.opt-sheet__close').addEventListener('click', handleCancel);
        $overlay.querySelector('.opt-sheet__btn--cancel').addEventListener('click', handleCancel);
        $overlay.addEventListener('click', (e) => {
            if (e.target === $overlay) handleCancel();
        });

        // 담기 버튼
        $overlay.querySelector('.opt-sheet__btn--confirm').addEventListener('click', () => {
            const selectedIds = [];
            for (const ref of groupRefs) {
                const checked = ref.$inputs.filter(($i) => $i.checked);
                if (ref.group.is_required && checked.length === 0) {
                    showToast(`'${ref.group.group_name}' 옵션을 선택해 주세요`);
                    // 해당 그룹으로 스크롤
                    ref.$el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    return;
                }
                checked.forEach(($i) => {
                    selectedIds.push(Number($i.dataset.optionId));
                });
            }
            if (o.onConfirm) o.onConfirm(selectedIds);
            close();
        });

        (document.querySelector('.page-bg') || document.body).appendChild($overlay);
        activeOverlay = $overlay;
    }

    function buildGroup(group, idx) {
        const maxSelect = Number(group.max_select) || 1;
        const type = maxSelect === 1 ? 'radio' : 'checkbox';
        const groupName = group.group_name || '';
        const groupKey = `opt-grp-${idx}-${group.group_id || idx}`;

        const $el = document.createElement('div');
        $el.className = 'opt-group';

        const hintText = type === 'checkbox' ? `최대 ${maxSelect}개 선택` : '';
        $el.innerHTML = `
            <div class="opt-group__head">
                <span class="opt-group__name">${escapeHtml(groupName)}</span>
                ${group.is_required ? '<span class="opt-group__required">필수</span>' : ''}
                ${hintText ? `<span class="opt-group__hint">${escapeHtml(hintText)}</span>` : ''}
            </div>
            <div class="opt-group__list" data-list></div>
        `;

        const $list = $el.querySelector('[data-list]');
        const $inputs = [];
        const options = Array.isArray(group.options) ? group.options : [];

        options.forEach((opt) => {
            const extra = Number(opt.extra_price) || 0;
            const inputId = `${groupKey}-opt-${opt.option_id}`;
            const $label = document.createElement('label');
            $label.className = 'opt-item';
            $label.setAttribute('for', inputId);

            const priceHtml = extra > 0
                ? `<span class="opt-item__price">+ ₩${extra.toLocaleString('ko-KR')}</span>`
                : '';

            $label.innerHTML = `
                <input type="${type}" name="${groupKey}" id="${inputId}"
                       class="opt-item__input" data-option-id="${opt.option_id}" />
                <span class="opt-item__name">${escapeHtml(opt.name || '')}</span>
                ${priceHtml}
            `;
            const $input = $label.querySelector('input');
            $inputs.push($input);

            $input.addEventListener('change', () => {
                // 체크박스 max_select 제한
                if (type === 'checkbox' && $input.checked) {
                    const checkedCount = $inputs.filter(($i) => $i.checked).length;
                    if (checkedCount > maxSelect) {
                        $input.checked = false;
                        // 시각적 피드백: 흔들기 토스트는 호출자가 함수 외부에 있으므로 간단히 라벨 강조
                        $label.animate(
                            [{ transform: 'translateX(0)' },
                             { transform: 'translateX(-6px)' },
                             { transform: 'translateX(6px)' },
                             { transform: 'translateX(0)' }],
                            { duration: 220, easing: 'ease-in-out' }
                        );
                    }
                }
                // checked 시각 갱신
                $inputs.forEach(($i) => {
                    const $lbl = $i.closest('.opt-item');
                    if (!$lbl) return;
                    if ($i.checked) $lbl.classList.add('opt-item--checked');
                    else $lbl.classList.remove('opt-item--checked');
                });
            });

            $list.appendChild($label);
        });

        return { group, $el, $inputs, type };
    }

    function escapeHtml(s) {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    root.OptionSheet = { open, close, isOpen };
})(typeof self !== 'undefined' ? self : this);
