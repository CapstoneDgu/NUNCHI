// ========================================================
// low-posture.js — 저자세(배리어프리) 모드 토글
//
// 휠체어/착석 사용자를 위해 화면을 하단 절반으로 내리는 모드.
// - 화면 하단 고정 버튼으로 켜고/끈다 (두 모드 모두에서 닿음)
// - sessionStorage 에 상태 저장 → 페이지 이동해도 유지
// - <html> 에 .posture-low 클래스 토글 (실제 레이아웃은 low-posture.css)
//
// 로드: app-state.js 로더가 모든 키오스크 페이지에서 자동 주입.
// ========================================================
(function () {
    'use strict';

    var KEY = 'postureLow';

    function urlForced() {
        try { return /[?&]posture=low(\b|$)/.test(location.search); } catch (e) { return false; }
    }

    function isOn() {
        if (urlForced()) return true;
        try { return sessionStorage.getItem(KEY) === '1'; } catch (e) { return false; }
    }

    function apply(on) {
        document.documentElement.classList.toggle('posture-low', on);
        var btn = document.getElementById('lpostToggle');
        if (btn) {
            btn.setAttribute('aria-pressed', String(on));
            var label = btn.querySelector('.lpost-toggle__label');
            if (label) label.textContent = on ? '일반 화면' : '저자세 모드';
        }
    }

    function toggle() {
        var on = !isOn();
        try { sessionStorage.setItem(KEY, on ? '1' : '0'); } catch (e) {}
        apply(on);
    }

    function injectButton() {
        if (document.getElementById('lpostToggle')) return;
        var b = document.createElement('button');
        b.id = 'lpostToggle';
        b.type = 'button';
        b.className = 'lpost-toggle';
        b.setAttribute('aria-label', '저자세 모드 켜고 끄기');
        b.setAttribute('aria-pressed', 'false');
        b.innerHTML =
            '<span class="lpost-toggle__icon" aria-hidden="true">&#9855;</span>' +
            '<span class="lpost-toggle__label">저자세 모드</span>';
        b.addEventListener('click', toggle);
        document.body.appendChild(b);
    }

    function init() {
        injectButton();
        apply(isOn());
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
