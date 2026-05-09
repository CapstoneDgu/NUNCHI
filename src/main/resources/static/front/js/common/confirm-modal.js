// ========================================================
// confirm-modal.js — 공통 확인 모달 (UMD)
//
// 사용:
//   <script src="/js/common/confirm-modal.js"></script>
//   const ok = await ConfirmModal.show({
//     title: '홈으로 돌아가시겠습니까?',
//     message: '진행 중인 주문은 취소됩니다.'
//   });
//   if (ok) location.href = '/start';
//
// 또는 홈 이동 헬퍼:
//   onclick="confirmGoHome()"
//   confirmGoHome(() => clearAllTimers());  // 이동 직전 정리 콜백
// ========================================================

(function (root) {
    'use strict';

    const STYLES = `
        .confirm-modal__overlay {
            position: fixed; inset: 0;
            background: var(--color-bg-overlay, rgba(30, 25, 21, 0.4));
            display: flex; align-items: center; justify-content: center;
            z-index: 9999;
            font-family: var(--font-sans, "Pretendard", -apple-system, BlinkMacSystemFont, sans-serif);
            animation: confirm-modal-fade-in 200ms var(--ease-out, cubic-bezier(0.25, 0.46, 0.45, 0.94));
            padding: 24px;
        }
        @keyframes confirm-modal-fade-in {
            from { opacity: 0; }
            to   { opacity: 1; }
        }
        .confirm-modal__box {
            background: var(--neutral-0, #fff);
            border-radius: 24px;
            width: min(560px, calc(100% - 48px));
            padding: 48px 40px 32px;
            box-shadow: var(--shadow-lg, 0 8px 32px rgba(30, 25, 21, 0.15));
            text-align: center;
            animation: confirm-modal-pop 280ms var(--ease-bounce, cubic-bezier(0.34, 1.56, 0.64, 1));
        }
        @keyframes confirm-modal-pop {
            from { opacity: 0; transform: scale(0.94) translateY(8px); }
            to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        .confirm-modal__title {
            margin: 0 0 16px;
            font-size: 28px; font-weight: 700; line-height: 1.35;
            color: var(--color-text-heading, var(--neutral-800, #352F2B));
        }
        .confirm-modal__message {
            margin: 0 0 36px;
            font-size: 18px; line-height: 1.55;
            color: var(--color-text-body, var(--neutral-700, #4D4742));
        }
        .confirm-modal__actions {
            display: flex; gap: 12px;
        }
        .confirm-modal__btn {
            flex: 1;
            min-height: 64px;
            padding: 16px 20px;
            border: none; border-radius: 14px;
            font-family: inherit;
            font-size: 18px; font-weight: 600;
            cursor: pointer;
            transition: background 150ms ease, transform 100ms ease;
            -webkit-tap-highlight-color: transparent;
        }
        .confirm-modal__btn:active { transform: scale(0.98); }
        .confirm-modal__btn--cancel {
            background: var(--neutral-100, #F0EDEA);
            color: var(--color-text-body, var(--neutral-700, #4D4742));
        }
        .confirm-modal__btn--cancel:hover {
            background: var(--neutral-200, #DDD9D5);
        }
        .confirm-modal__btn--confirm {
            background: var(--color-btn-primary, var(--primary-500, #E8600A));
            color: var(--color-text-inverse, #fff);
        }
        .confirm-modal__btn--confirm:hover {
            background: var(--color-btn-hover, var(--primary-400, #FF8320));
        }
        .confirm-modal__btn--confirm:focus-visible {
            outline: 3px solid var(--color-focus, var(--primary-500, #E8600A));
            outline-offset: 2px;
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

    let modalCounter = 0;

    function show(opts) {
        ensureStyles();
        const o = opts || {};
        const title = o.title || '확인';
        const message = o.message || '';
        const confirmLabel = o.confirmLabel || '예';
        const cancelLabel = o.cancelLabel || '아니요';

        return new Promise((resolve) => {
            const id = ++modalCounter;
            const titleId = 'confirm-modal__title-' + id;
            const messageId = 'confirm-modal__message-' + id;

            const $overlay = document.createElement('div');
            $overlay.className = 'confirm-modal__overlay';
            $overlay.setAttribute('role', 'dialog');
            $overlay.setAttribute('aria-modal', 'true');
            $overlay.setAttribute('aria-labelledby', titleId);
            $overlay.setAttribute('aria-describedby', messageId);
            $overlay.innerHTML =
                '<div class="confirm-modal__box">' +
                    '<h2 class="confirm-modal__title"></h2>' +
                    '<p class="confirm-modal__message"></p>' +
                    '<div class="confirm-modal__actions">' +
                        '<button type="button" class="confirm-modal__btn confirm-modal__btn--cancel"></button>' +
                        '<button type="button" class="confirm-modal__btn confirm-modal__btn--confirm"></button>' +
                    '</div>' +
                '</div>';
            const $title = $overlay.querySelector('.confirm-modal__title');
            const $message = $overlay.querySelector('.confirm-modal__message');
            $title.id = titleId;
            $title.textContent = title;
            $message.id = messageId;
            $message.textContent = message;
            $overlay.querySelector('.confirm-modal__btn--cancel').textContent = cancelLabel;
            $overlay.querySelector('.confirm-modal__btn--confirm').textContent = confirmLabel;

            const $confirmBtn = $overlay.querySelector('.confirm-modal__btn--confirm');
            const $cancelBtn  = $overlay.querySelector('.confirm-modal__btn--cancel');

            const cleanup = (result) => {
                $overlay.remove();
                document.removeEventListener('keydown', onKey);
                resolve(result);
            };
            const onKey = (e) => {
                if (e.key === 'Escape') {
                    cleanup(false);
                    return;
                }
                // Enter 는 confirm 버튼이 포커스됐을 때만 confirm.
                // (취소 버튼 포커스에서 Enter 누르면 취소 의도이므로 confirm 트리거 X)
                if (e.key === 'Enter' && document.activeElement === $confirmBtn) {
                    cleanup(true);
                }
            };
            $cancelBtn.addEventListener('click', () => cleanup(false));
            $confirmBtn.addEventListener('click', () => cleanup(true));
            $overlay.addEventListener('click', (e) => {
                if (e.target === $overlay) cleanup(false);
            });
            document.addEventListener('keydown', onKey);
            document.body.appendChild($overlay);
            // 포커스 — 확인 버튼
            $confirmBtn.focus();
        });
    }

    /**
     * 홈(/start) 이동 확인 헬퍼.
     * @param {Function} [beforeNav] 이동 직전 정리 콜백 (e.g. clearAllTimers)
     */
    async function confirmGoHome(beforeNav) {
        const ok = await show({
            title: '홈으로 돌아가시겠습니까?',
            message: '진행 중인 주문은 취소됩니다.',
            confirmLabel: '돌아가기',
            cancelLabel: '계속하기'
        });
        if (!ok) return;
        if (typeof beforeNav === 'function') {
            try { beforeNav(); } catch (_) { /* noop */ }
        }
        location.href = '/start';
    }

    root.ConfirmModal = { show };
    root.confirmGoHome = confirmGoHome;
})(typeof self !== 'undefined' ? self : this);
