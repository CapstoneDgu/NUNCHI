// ========================================================
// S01-mode.js — 주문 방식 선택
// 요구사항: 0-3, 0-4
//
// Vision 정책:
// - 주문 방식(normal/avatar)과 눈 인식 ON/OFF를 분리한다.
// - 눈 인식이 켜져 있으면 normal/avatar 어느 모드를 선택해도 다음 화면에서 유지된다.
// - 즉, 아이트래킹 마우스 대체 입력은 특정 주문 방식에 종속되지 않는다.
// ========================================================

(function () {
    // 두 모드 모두 S02 매장/포장 → 그 다음에 모드별 분기
    var NEXT_URL = "/dine";

    function selectMode(mode) {
        if (mode !== "normal" && mode !== "avatar") {
            console.warn("[S01] unknown mode:", mode);
            return;
        }

        // 여기서 더 이상 Vision을 켜거나 끄지 않는다.
        // Vision은 별도의 입력 방식 상태로 유지한다.
        console.log("[S01] selected mode:", mode);
        console.log("[S01] vision enabled:", sessionStorage.getItem("nunchiVisionEnabled"));

        // 백엔드 SessionMode enum 형식(대문자)으로 저장
        sessionStorage.setItem("mode", mode.toUpperCase());
        sessionStorage.setItem("currentStep", "S02");

        location.href = NEXT_URL;
    }

    document.addEventListener("DOMContentLoaded", function () {
        var $cards = document.querySelectorAll("[data-mode]");

        $cards.forEach(function ($el) {
            $el.addEventListener("click", function () {
                var mode = $el.getAttribute("data-mode");
                selectMode(mode);
            });
        });
    });
})();