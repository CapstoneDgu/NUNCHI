// ========================================================
// S00-start.js — 시작 화면 동작
// - 세션 초기화 (sessionStorage)
// - CTA 클릭 → S01-mode.html 이동
// - 30초 유휴 → 어트랙션 모드
// - 어트랙션 중 화면 터치 → 정상 모드 복귀
// ========================================================

(function () {
    const ATTRACT_TIMEOUT_MS = 30 * 1000;

    // 세션 초기화 (AppState 모듈 도입 전 임시)
    function resetSession() {
        try {
            sessionStorage.clear();
            sessionStorage.setItem("sessionId", "sess_" + Date.now());
            sessionStorage.setItem("currentStep", "S00");
        } catch (e) {
            console.warn("[S00] sessionStorage 사용 불가", e);
        }
    }

    // 페이지 이동
    function startOrder() {
        sessionStorage.setItem("currentStep", "S01");
        location.href = "/S01-mode.html";
    }

    // 어트랙션 모드
    let attractTimer = null;
    const $root = document.querySelector(".s00");

    function enterAttract() {
        if (!$root) return;
        $root.classList.add("s00--attract");
    }

    function exitAttract() {
        if (!$root) return;
        $root.classList.remove("s00--attract");
        resetAttractTimer();
    }

    function resetAttractTimer() {
        if (attractTimer) clearTimeout(attractTimer);
        attractTimer = setTimeout(enterAttract, ATTRACT_TIMEOUT_MS);
    }

    // 활동 감지 이벤트 (터치·클릭·키 입력)
    ["click", "touchstart", "keydown", "pointerdown"].forEach((ev) => {
        document.addEventListener(ev, () => {
            if ($root && $root.classList.contains("s00--attract")) {
                exitAttract();
            } else {
                resetAttractTimer();
            }
        });
    });

    // CTA 버튼 핸들러
    document.addEventListener("DOMContentLoaded", () => {
        resetSession();
        resetAttractTimer();

        const $cta = document.querySelector("[data-action='start-order']");
        if ($cta) {
            $cta.addEventListener("click", startOrder);
        }
    });
})();
