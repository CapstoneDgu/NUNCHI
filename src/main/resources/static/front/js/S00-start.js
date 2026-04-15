// ========================================================
// S00-start.js — 시작 화면 동작
// - 세션 초기화 (sessionStorage)
// - 음식 슬라이드 캐러셀 (자동 회전 + 인디케이터 클릭)
// - CTA 클릭 → S01 이동
// - 30초 유휴 → 어트랙션 모드
// ========================================================

(function () {
    const ATTRACT_TIMEOUT_MS = 30 * 1000;
    const SLIDE_INTERVAL_MS  = 4000;

    const $root = document.querySelector(".s00");

    // ---- 세션 초기화 ----
    function resetSession() {
        try {
            sessionStorage.clear();
            sessionStorage.setItem("sessionId", "sess_" + Date.now());
            sessionStorage.setItem("currentStep", "S00");
        } catch (e) {
            console.warn("[S00] sessionStorage 사용 불가", e);
        }
    }

    // ---- 페이지 이동 ----
    function startOrder() {
        sessionStorage.setItem("currentStep", "S01");
        location.href = "/S01-mode.html";
    }

    // ---- 음식 슬라이드 캐러셀 ----
    const $track = document.querySelector("[data-slider-track]");
    const $dots  = document.querySelectorAll(".s00__slider-dot");
    const SLIDE_COUNT = $dots.length;
    let slideIdx = 0;
    let slideTimer = null;

    function updateSlide(idx) {
        slideIdx = ((idx % SLIDE_COUNT) + SLIDE_COUNT) % SLIDE_COUNT;
        if ($track) {
            $track.style.transform = `translateX(-${slideIdx * 100}%)`;
        }
        $dots.forEach(($d, i) => {
            $d.classList.toggle("s00__slider-dot--active", i === slideIdx);
        });
    }

    function nextSlide() {
        updateSlide(slideIdx + 1);
    }

    function startSlideTimer() {
        stopSlideTimer();
        slideTimer = setInterval(nextSlide, SLIDE_INTERVAL_MS);
    }

    function stopSlideTimer() {
        if (slideTimer) {
            clearInterval(slideTimer);
            slideTimer = null;
        }
    }

    // ---- 어트랙션 모드 ----
    let attractTimer = null;

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

    // ---- 활동 감지 ----
    ["click", "touchstart", "keydown", "pointerdown"].forEach((ev) => {
        document.addEventListener(ev, () => {
            if ($root && $root.classList.contains("s00--attract")) {
                exitAttract();
            } else {
                resetAttractTimer();
            }
        });
    });

    // ---- 초기화 ----
    document.addEventListener("DOMContentLoaded", () => {
        resetSession();
        resetAttractTimer();
        startSlideTimer();

        // 인디케이터 클릭
        $dots.forEach(($d, i) => {
            $d.addEventListener("click", (e) => {
                e.stopPropagation();
                updateSlide(i);
                startSlideTimer();
            });
        });

        // CTA 버튼
        const $cta = document.querySelector("[data-action='start-order']");
        if ($cta) {
            $cta.addEventListener("click", startOrder);
        }
    });
})();
