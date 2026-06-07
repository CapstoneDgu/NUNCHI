// ========================================================
// vision-client.js — NUNCHI Vision Mouse Replacement Client
//
// 정책:
// - 눈 인식 모드가 켜졌을 때만 WebSocket 연결
// - Python 이벤트:
//   { type: "vision_move", direction: "LEFT" }
//   { type: "vision_move", direction: "RIGHT" }
//   { type: "vision_click" }
//
// 사용:
// - 조작 가능한 카드/버튼에 class="vision-selectable" 추가
// - 현재 선택된 요소에는 JS가 vision-focused class 자동 부여
// ========================================================

(function () {
    'use strict';

    const VISION_WS_URL = 'ws://127.0.0.1:8765';

    let socket = null;
    let reconnectTimer = null;
    const reconnectDelayMs = 1500;

    let selectables = [];
    let focusedIndex = 0;

    let lastMoveAt = 0;
    let lastClickAt = 0;
    const MOVE_DEDUP_MS = 500;
    const CLICK_DEDUP_MS = 800;

    function isVisionEnabled() {
        return sessionStorage.getItem('nunchiVisionEnabled') === 'true';
    }

    function enableVision() {
        sessionStorage.setItem('nunchiVisionEnabled', 'true');
        injectVisionStyle();
        refreshSelectables();
        connectVisionWebSocket();
        console.log('[VISION_CLIENT] enabled');
    }

    function disableVision() {
        sessionStorage.setItem('nunchiVisionEnabled', 'false');
        clearReconnectTimer();

        if (socket) {
            socket.close();
            socket = null;
        }

        clearFocus();
        console.log('[VISION_CLIENT] disabled');
    }

    function connectVisionWebSocket() {
        if (!isVisionEnabled()) {
            console.log('[VISION_CLIENT] vision mode disabled. skip connect.');
            return;
        }

        if (
            socket &&
            (
                socket.readyState === WebSocket.OPEN ||
                socket.readyState === WebSocket.CONNECTING
            )
        ) {
            return;
        }

        console.log('[VISION_CLIENT] connecting:', VISION_WS_URL);

        socket = new WebSocket(VISION_WS_URL);

        socket.onopen = function () {
            console.log('[VISION_CLIENT] connected');
            clearReconnectTimer();
            injectVisionStyle();
            refreshSelectables();
        };

        socket.onmessage = function (event) {
            try {
                const visionEvent = JSON.parse(event.data);
                handleVisionEvent(visionEvent);
            } catch (error) {
                console.warn('[VISION_CLIENT] failed to parse message:', event.data, error);
            }
        };

        socket.onerror = function (error) {
            console.warn('[VISION_CLIENT] websocket error:', error);
        };

        socket.onclose = function () {
            console.warn('[VISION_CLIENT] disconnected');
            socket = null;

            if (isVisionEnabled()) {
                scheduleReconnect();
            }
        };
    }

    function scheduleReconnect() {
        clearReconnectTimer();

        reconnectTimer = setTimeout(function () {
            if (isVisionEnabled()) {
                connectVisionWebSocket();
            }
        }, reconnectDelayMs);
    }

    function clearReconnectTimer() {
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }
    }

    function handleVisionEvent(visionEvent) {
        if (!isVisionEnabled()) {
            return;
        }

        console.log('[VISION_EVENT]', visionEvent);
        sendVisionEventLog(visionEvent);

        if (visionEvent.type === 'presence') {
            handlePresenceEvent(visionEvent);
            return;
        }

        if (visionEvent.type === 'vision_move') {
            handleVisionMove(visionEvent.direction);
            return;
        }

        if (visionEvent.type === 'vision_click') {
            handleVisionClick();
            return;
        }

        if (visionEvent.type === 'hesitation') {
            handleHesitationEvent(visionEvent);
            return;
        }

    }

    function handlePresenceEvent(event) {
        if (event.event === 'entered') {
            console.log('[VISION_CLIENT] user entered');
        }

        if (event.event === 'left') {
            console.log('[VISION_CLIENT] user left');
        }
    }

    function handleHesitationEvent(event) {
        console.log('[VISION_CLIENT] hesitation:', event.level, event.score);
    }

    function handleVisionMove(direction) {
        const now = Date.now();

        if (now - lastMoveAt < MOVE_DEDUP_MS) {
            return;
        }

        lastMoveAt = now;

        const moveEvent = new CustomEvent('nunchi:vision-move', {
            cancelable: true,
            detail: { direction: direction }
        });
        window.dispatchEvent(moveEvent);
        if (moveEvent.defaultPrevented) {
            return;
        }

        refreshSelectables();

        if (selectables.length === 0) {
            console.warn('[VISION_CLIENT] no vision-selectable elements');
            showVisionToast('눈으로 선택할 요소가 없습니다.');
            return;
        }

        if (direction === 'LEFT') {
            focusedIndex = Math.max(0, focusedIndex - 1);
        } else if (direction === 'RIGHT') {
            focusedIndex = Math.min(selectables.length - 1, focusedIndex + 1);
        } else {
            console.warn('[VISION_CLIENT] unknown direction:', direction);
            return;
        }

        applyFocus();
        showVisionToast('선택 이동: ' + direction);
    }

    function handleVisionClick() {
        const now = Date.now();

        if (now - lastClickAt < CLICK_DEDUP_MS) {
            return;
        }

        lastClickAt = now;

        const clickEvent = new CustomEvent('nunchi:vision-click', {
            cancelable: true
        });
        window.dispatchEvent(clickEvent);
        if (clickEvent.defaultPrevented) {
            return;
        }

        refreshSelectables();

        if (focusedIndex < 0 || focusedIndex >= selectables.length) {
            console.warn('[VISION_CLIENT] no focused element');
            showVisionToast('클릭할 요소가 없습니다.');
            return;
        }

        const target = selectables[focusedIndex];

        console.log('[VISION_CLIENT] click focused:', target);
        showVisionToast('선택');

        target.classList.add('vision-clicked');

        setTimeout(function () {
            target.classList.remove('vision-clicked');
        }, 180);

        target.click();
    }

    function refreshSelectables() {
        const activeScope = Array.from(document.querySelectorAll('[data-vision-scope]'))
            .find(isVisibleSelectable);
        const roots = activeScope ? [activeScope] : [document];

        selectables = roots.flatMap(function (root) {
            const items = root.classList && root.classList.contains('vision-selectable')
                ? [root]
                : [];

            return items.concat(Array.from(root.querySelectorAll('.vision-selectable')));
        }).filter(isVisibleSelectable);

        if (selectables.length === 0) {
            focusedIndex = -1;
            clearFocus();
            return;
        }

        if (focusedIndex < 0 || focusedIndex >= selectables.length) {
            focusedIndex = 0;
        }

        applyFocus();
    }

    function isVisibleSelectable(el) {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);

        return (
            rect.width > 0 &&
            rect.height > 0 &&
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            !el.disabled
        );
    }

    function applyFocus() {
        clearFocus();

        if (focusedIndex < 0 || focusedIndex >= selectables.length) {
            return;
        }

        const target = selectables[focusedIndex];
        target.classList.add('vision-focused');

        try {
            target.scrollIntoView({
                block: 'nearest',
                inline: 'nearest',
                behavior: 'smooth'
            });
        } catch (e) {
            target.scrollIntoView();
        }

        console.log('[VISION_CLIENT] focused:', focusedIndex, target);
    }

    function clearFocus() {
        document.querySelectorAll('.vision-focused').forEach(function (el) {
            el.classList.remove('vision-focused');
        });
    }

    function injectVisionStyle() {
        if (document.getElementById('vision-client-style')) {
            return;
        }

        const style = document.createElement('style');
        style.id = 'vision-client-style';
        style.textContent = `
            .vision-focused {
                outline: 6px solid #22c55e !important;
                outline-offset: 5px !important;
                transform: scale(1.03);
                box-shadow: 0 0 0 8px rgba(34, 197, 94, 0.28) !important;
                position: relative;
                z-index: 9999 !important;
                transition: transform 120ms ease, box-shadow 120ms ease, outline 120ms ease;
            }

            .vision-clicked {
                transform: scale(0.96) !important;
                filter: brightness(0.9);
            }
        `;

        document.head.appendChild(style);
    }

    function showVisionToast(message) {
        let toast = document.getElementById('visionToast');

        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'visionToast';

            toast.style.position = 'fixed';
            toast.style.left = '50%';
            toast.style.bottom = '40px';
            toast.style.transform = 'translateX(-50%)';
            toast.style.padding = '14px 22px';
            toast.style.borderRadius = '14px';
            toast.style.background = 'rgba(0, 0, 0, 0.75)';
            toast.style.color = '#fff';
            toast.style.fontSize = '20px';
            toast.style.fontWeight = '700';
            toast.style.zIndex = '99999';
            toast.style.transition = 'opacity 0.2s ease';
            toast.style.opacity = '0';

            document.body.appendChild(toast);
        }

        toast.textContent = message;
        toast.style.opacity = '1';

        setTimeout(function () {
            toast.style.opacity = '0';
        }, 900);
    }

    function sendVisionEventLog(visionEvent) {
        fetch('/api/vision/events', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                type: visionEvent.type || null,
                source: visionEvent.source || 'vision',
                event: visionEvent.event || null,
                value: visionEvent.value || null,
                direction: visionEvent.direction || null,
                level: visionEvent.level || null,
                score: visionEvent.score || null,
                raw: visionEvent,
            }),
        }).catch(function (error) {
            console.warn('[VISION_CLIENT] failed to send vision log:', error);
        });
    }

    window.NunchiVisionClient = {
        enable: enableVision,
        disable: disableVision,
        connect: connectVisionWebSocket,
        isEnabled: isVisionEnabled,
        refresh: refreshSelectables,
        clickFocused: handleVisionClick,
        moveFocus: handleVisionMove
    };

    document.addEventListener('DOMContentLoaded', function () {
        injectVisionStyle();

        if (isVisionEnabled()) {
            connectVisionWebSocket();
        } else {
            console.log('[VISION_CLIENT] default mode. vision disabled.');
        }

        // DOM 로드 직후 selectable 잡기
        setTimeout(refreshSelectables, 200);

        // 모달/동적 버튼 대응
        const observer = new MutationObserver(function () {
            if (isVisionEnabled()) {
                refreshSelectables();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    });
})();
