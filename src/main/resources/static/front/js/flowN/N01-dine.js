// ========================================================
// N01-dine.js — 매장 / 포장 선택
// 요구사항: 1-1
// - 카드 클릭 → is-selected + sessionStorage('dineOption')
// - 0.5초 후 다음 화면 N02-menu.html 로 이동
// ========================================================

(function () {
    const NEXT_URL = "/flowN/N02-menu.html";
    const SELECT_DELAY_MS = 500;

    function selectDine(option, $card) {
        // 다른 카드의 선택 상태 해제
        document.querySelectorAll(".n01__card.is-selected").forEach(($el) => {
            $el.classList.remove("is-selected");
        });

        // 현재 카드 선택
        $card.classList.add("is-selected");

        // 세션 저장
        sessionStorage.setItem("dineOption", option);
        sessionStorage.setItem("currentStep", "N01");

        // 다음 화면 전환 (살짝 대기)
        setTimeout(() => {
            location.href = NEXT_URL;
        }, SELECT_DELAY_MS);
    }

    document.addEventListener("DOMContentLoaded", () => {
        const $cards = document.querySelectorAll("[data-dine]");
        $cards.forEach(($el) => {
            $el.addEventListener("click", () => {
                const option = $el.getAttribute("data-dine");
                selectDine(option, $el);
            });
        });
    });
})();
