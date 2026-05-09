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
            background: rgba(0, 0, 0, 0.45);
            display: flex; align-items: center; justify-content: center;
            z-index: 9999;
            animation: confirm-modal-fade-in 0.18s ease-out;
        }
        @keyframes confirm-modal-fade-in {
            from { opacity: 0; }
            to   { opacity: 1; }
        }
        .confirm-modal__box {
            background: #fff;
            border-radius: 16px;
            min-width: 320px; max-width: 480px;
            padding: 28px 24px 20px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
            text-align: center;
            animation: confirm-modal-pop 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        @keyframes confirm-modal-pop {
            from { opacity: 0; transform: scale(0.92); }
            to   { opacity: 1; transform: scale(1); }
        }
        .confirm-modal__title {
            margin: 0 0 12px;
            font-size: 20px; font-weight: 700;
            color: #1a1a1a;
        }
        .confirm-modal__message {
            margin: 0 0 24px;
            font-size: 15px; line-height: 1.5;
            color: #555;
        }
        .confirm-modal__actions {
            display: flex; gap: 10px;
        }
        .confirm-modal__btn {
            flex: 1;
            padding: 14px 18px;
            border: none; border-radius: 10px;
            font-size: 16px; font-weight: 600;
            cursor: pointer;
            transition: background 0.15s;
        }
        .confirm-modal__btn--cancel {
            background: #f3f4f6; color: #333;
        }
        .confirm-modal__btn--cancel:hover { background: #e5e7eb; }
        .confirm-modal__btn--confirm {
            background: #2563eb; color: #fff;
        }
        .confirm-modal__btn--confirm:hover { background: #1d4ed8; }
    `;

    let stylesInjected = false;
    function ensureStyles() {
        if (stylesInjected) return;
        const $s = document.createElement('style');
        $s.textContent = STYLES;
        document.head.appendChild($s);
        stylesInjected = true;
    }

    function show(opts) {
        ensureStyles();
        const o = opts || {};
        const title = o.title || '확인';
        const message = o.message || '';
        const confirmLabel = o.confirmLabel || '예';
        const cancelLabel = o.cancelLabel || '아니요';

        return new Promise((resolve) => {
            const $overlay = document.createElement('div');
            $overlay.className = 'confirm-modal__overlay';
            $overlay.setAttribute('role', 'dialog');
            $overlay.setAttribute('aria-modal', 'true');
            $overlay.innerHTML =
                '<div class="confirm-modal__box">' +
                    '<h2 class="confirm-modal__title"></h2>' +
                    '<p class="confirm-modal__message"></p>' +
                    '<div class="confirm-modal__actions">' +
                        '<button type="button" class="confirm-modal__btn confirm-modal__btn--cancel"></button>' +
                        '<button type="button" class="confirm-modal__btn confirm-modal__btn--confirm"></button>' +
                    '</div>' +
                '</div>';
            $overlay.querySelector('.confirm-modal__title').textContent = title;
            $overlay.querySelector('.confirm-modal__message').textContent = message;
            $overlay.querySelector('.confirm-modal__btn--cancel').textContent = cancelLabel;
            $overlay.querySelector('.confirm-modal__btn--confirm').textContent = confirmLabel;

            const cleanup = (result) => {
                $overlay.remove();
                document.removeEventListener('keydown', onKey);
                resolve(result);
            };
            const onKey = (e) => {
                if (e.key === 'Escape') cleanup(false);
                else if (e.key === 'Enter') cleanup(true);
            };
            $overlay.querySelector('.confirm-modal__btn--cancel')
                .addEventListener('click', () => cleanup(false));
            $overlay.querySelector('.confirm-modal__btn--confirm')
                .addEventListener('click', () => cleanup(true));
            $overlay.addEventListener('click', (e) => {
                if (e.target === $overlay) cleanup(false);
            });
            document.addEventListener('keydown', onKey);
            document.body.appendChild($overlay);
            // 포커스 — 확인 버튼
            $overlay.querySelector('.confirm-modal__btn--confirm').focus();
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
