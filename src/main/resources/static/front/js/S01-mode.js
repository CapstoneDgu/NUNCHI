// ========================================================
// S01-mode.js — 주문 방식 선택
// 요구사항: 0-3, 0-4
// ========================================================

(function () {
    // 모드별 다음 화면 매핑
    const NEXT_BY_MODE = {
        normal: "/flowN/N01-dine.html",
        avatar: "/flowA/A01-avatar.html",
    };

    function selectMode(mode) {
        if (!NEXT_BY_MODE[mode]) {
            console.warn("[S01] unknown mode:", mode);
            return;
        }
        sessionStorage.setItem("mode", mode);
        sessionStorage.setItem("currentStep", mode === "normal" ? "N01" : "A01");
        location.href = NEXT_BY_MODE[mode];
    }

    document.addEventListener("DOMContentLoaded", () => {
        const $cards = document.querySelectorAll("[data-mode]");
        $cards.forEach(($el) => {
            $el.addEventListener("click", () => {
                const mode = $el.getAttribute("data-mode");
                selectMode(mode);
            });
        });
    });
})();
