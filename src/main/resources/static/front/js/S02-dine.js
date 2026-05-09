// ========================================================
// S02-dine.js — 매장 / 포장 선택 (공용 진입)
// 요구사항: 1-1
// - 카드 클릭 → sessionStorage('dineOption') 저장
// - mode 에 따라 N02-menu (일반) 또는 A01-avatar (아바타) 로 분기
// ========================================================

(function () {
    function getNextUrl() {
        // 백엔드 SessionMode enum 형식(대문자)으로 통일. 옛 소문자 잔여물도 호환.
        var mode = (sessionStorage.getItem("mode") || "").toUpperCase();
        if (mode === "AVATAR") return "/flowA/A01-avatar.html";
        if (mode === "NORMAL") return "/flowN/N02-menu.html";
        // mode 가 없거나 잘못된 값 → 모드 선택으로 복귀
        return "/S01-mode.html";
    }

    function selectDine(option) {
        try {
            sessionStorage.setItem("dineOption", option);
            sessionStorage.setItem("currentStep", "S02");
        } catch (e) {
            console.warn("[S02] sessionStorage 쓰기 실패", e);
        }
        location.href = getNextUrl();
    }

    document.addEventListener("DOMContentLoaded", function () {
        var $cards = document.querySelectorAll("[data-dine]");
        $cards.forEach(function ($el) {
            $el.addEventListener("click", function () {
                var option = $el.getAttribute("data-dine");
                selectDine(option);
            });
        });
    });
})();
