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

    // 상태의 단일 기준은 sessionStorage. URL(?posture=low)은 '최초 진입 seed' 용도일 뿐
    // (init 에서 1회만 저장값에 반영) — 매번 우선시키면 토글로 끈 뒤 다시 켤 수 없다.
    function isOn() {
        try { return sessionStorage.getItem(KEY) === '1'; } catch (e) { return urlForced(); }
    }

    // 현재 화면에 실제 적용된 상태(클래스) — 토글은 이 실제 상태를 뒤집어야 안전하다.
    function currentlyOn() {
        return document.documentElement.classList.contains('posture-low');
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
        var on = !currentlyOn();   // 저장값/URL 이 아닌 '실제 적용 상태'를 뒤집는다
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
        // URL 강제 진입은 '최초 1회'만 저장값으로 seed → 이후엔 토글/저장값이 기준이 되어
        // ?posture=low 페이지에서 껐다 다시 켜는 것이 정상 동작한다.
        try { if (urlForced() && sessionStorage.getItem(KEY) === null) sessionStorage.setItem(KEY, '1'); } catch (e) {}
        injectButton();
        apply(isOn());
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
