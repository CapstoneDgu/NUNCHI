// ========================================================
// S02-dine.js — 매장 / 포장 선택 (공용 진입)
// 요구사항: 1-1
// - 카드 클릭 → sessionStorage('dineOption') 저장
// - mode 에 따라 N02-menu (일반) 또는 A01-avatar (아바타) 로 분기
//
// Vision 정책:
// - 눈 인식은 vision-client.js가 담당한다.
// - vision-client.js가 현재 포커스된 .vision-selectable 요소의 click()을 호출한다.
// - 따라서 이 파일은 일반 클릭 이벤트만 처리하면 된다.
// ========================================================

(function () {
    function getNextUrl() {
        // 백엔드 SessionMode enum 형식(대문자)으로 통일. 옛 소문자 잔여물도 호환.
        var mode = (sessionStorage.getItem("mode") || "").toUpperCase();

        if (mode === "AVATAR") return "/avatar";
        if (mode === "NORMAL") {
            if (
                sessionStorage.getItem("nunchiVisionEnabled") === "true" &&
                sessionStorage.getItem("nunchiVisionCalibrated") !== "true"
            ) {
                return "/vision-calibration?next=/menu";
            }

            return "/menu";
        }

        // mode 가 없거나 잘못된 값 → 모드 선택으로 복귀
        return "/mode";
    }

    function selectDine(option) {
        if (option !== "dine_in" && option !== "take_out") {
            console.warn("[S02] unknown dine option:", option);
            return;
        }

        try {
            sessionStorage.setItem("dineOption", option);
            sessionStorage.setItem("currentStep", "S02");
        } catch (e) {
            console.warn("[S02] sessionStorage 쓰기 실패", e);
        }

        console.log("[S02] selected dine:", option);
        console.log("[S02] next url:", getNextUrl());

        location.href = getNextUrl();
    }

    function bindCardClickEvents() {
        var $cards = document.querySelectorAll("[data-dine]");

        $cards.forEach(function ($el) {
            $el.addEventListener("click", function () {
                var option = $el.getAttribute("data-dine");
                selectDine(option);
            });
        });
    }

    document.addEventListener("DOMContentLoaded", function () {
        bindCardClickEvents();
    });
})();
