// ========================================================
// S01-mode.js — 주문 방식 선택
// 요구사항: 0-3, 0-4
// ========================================================

(function () {
    // 두 모드 모두 S02 매장/포장 → 그 다음에 모드별 분기
    var NEXT_URL = "/S02-dine.html";

    function selectMode(mode) {
        if (mode !== "normal" && mode !== "avatar") {
            console.warn("[S01] unknown mode:", mode);
            return;
        }
        // 백엔드 SessionMode enum 형식(대문자)으로 저장
        sessionStorage.setItem("mode", mode.toUpperCase());
        sessionStorage.setItem("currentStep", "S02");
        location.href = NEXT_URL;
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
