// ========================================================
// kiosk-guard.js — 키오스크 제스처 가드 (QA R2-4)
//
// 목적: 크롬 --kiosk 에서 좌우 스와이프(트랙패드 2지 / 터치스크린)가
//       브라우저 "뒤로가기 / 앞으로가기" 로 동작하는 것을 코드 레벨에서 차단.
//
// 이중 차단:
//   1) common.css 의 overscroll-behavior-x: none (오버스크롤 네비게이션)
//   2) scripts/kiosk-launch.sh 의 Chrome 플래그(OverscrollHistoryNavigation off)
//   3) 본 스크립트 — 위 둘을 못 쓰는 환경(일반 --kiosk)에서도 막히도록 보조
//
// 정상 가로 스크롤 영역(카트 트랙 등)은 방해하지 않는다.
// ========================================================

(function () {
    'use strict';

    // target 이 "실제 가로 스크롤이 가능한 컨테이너" 안에 있으면 제스처를 통과시킨다.
    function inHorizontalScroller(el) {
        while (el && el !== document.body && el.nodeType === 1) {
            if (el.scrollWidth > el.clientWidth + 1) {
                const ox = getComputedStyle(el).overflowX;
                if (ox === 'auto' || ox === 'scroll') return true;
            }
            el = el.parentElement;
        }
        return false;
    }

    let startX = 0, startY = 0;

    document.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1) return;
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
    }, { passive: true });

    // 가로 우세 터치 제스처 + 가로 스크롤러 밖 → 뒤로/앞으로가기 방지
    document.addEventListener('touchmove', (e) => {
        if (e.touches.length !== 1) return;
        const dx = e.touches[0].clientX - startX;
        const dy = e.touches[0].clientY - startY;
        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 8 && !inHorizontalScroller(e.target)) {
            e.preventDefault();
        }
    }, { passive: false });

    // 트랙패드 가로 휠(2지 스와이프) 네비게이션 차단
    document.addEventListener('wheel', (e) => {
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && Math.abs(e.deltaX) > 0 && !inHorizontalScroller(e.target)) {
            e.preventDefault();
        }
    }, { passive: false });
})();
