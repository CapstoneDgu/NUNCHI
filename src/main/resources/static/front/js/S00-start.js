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
        try {
            sessionStorage.setItem("currentStep", "S01");
            sessionStorage.setItem("nunchiVisionEnabled", "false");
            sessionStorage.removeItem("nunchiVisionCalibrated");
            sessionStorage.removeItem("nunchiVisionCalibration");
        } catch (e) {
            console.warn("[S00] sessionStorage 쓰기 실패", e);
        }
        location.href = "/mode";
    }

    function startVisionOrder() {
        try {
            sessionStorage.setItem("currentStep", "S00");
            sessionStorage.setItem("nunchiVisionEnabled", "true");
            sessionStorage.removeItem("nunchiVisionCalibrated");
            sessionStorage.removeItem("nunchiVisionCalibration");
        } catch (e) {
            console.warn("[S00] sessionStorage write failed", e);
        }
        location.href = "/vision-calibration?next=/mode";
    }

    // ---- 음식 슬라이드 캐러셀 ----
    const $track = document.querySelector("[data-slider-track]");
    const $dotsRoot = document.querySelector("[data-slider-dots]");
    let $dots  = document.querySelectorAll(".s00__slider-dot");
    let SLIDE_COUNT = $dots.length;
    let slideIdx = 0;
    let slideTimer = null;

    const nf = new Intl.NumberFormat("ko-KR");
    const fmtWon = (n) => "₩ " + nf.format(Math.max(0, Number(n) || 0));

    // ---- 백엔드 추천 데이터로 슬라이드 채우기 ----
    // GET /api/menus/recommendations → 광고판 3장 구성:
    //   ① 오늘의 베스트셀러 (고정)
    //   ② 저지방·고단백·저칼로리 묶음 중 랜덤 1테마 → 메뉴 1개
    //   ③ 차가운·따뜻한 중 랜덤 1테마 → 메뉴 1개
    function pickRandom(arr) {
        if (!Array.isArray(arr) || arr.length === 0) return null;
        return arr[Math.floor(Math.random() * arr.length)];
    }

    function toSlide(menu, badge, themeLabel) {
        if (!menu) return null;
        return {
            menuId: menu.menuId,
            name: menu.name,
            price: menu.price,
            isSoldOut: menu.isSoldOut,
            badge: badge,
            themeLabel: themeLabel,
            reason: menu.reason || "",
            imageCandidates: menu.imageUrl ? [menu.imageUrl] : []
        };
    }

    async function hydrateSlidesFromBackend() {
        if (!window.NunchiApi) return;
        try {
            const rec = await window.NunchiApi.Menus.recommendations();
            if (!rec) return;

            // ② 저지방/고단백/저칼로리 묶음 중 랜덤 1테마 → 그 안에서 메뉴 랜덤 1개
            const dietThemes = [
                { menus: rec.lowFat,      badge: "저지방",   label: "저지방 추천" },
                { menus: rec.highProtein, badge: "고단백",   label: "고단백 추천" },
                { menus: rec.lowCalorie,  badge: "다이어트", label: "다이어트 추천" }
            ].filter((t) => Array.isArray(t.menus) && t.menus.length);
            const diet = pickRandom(dietThemes);

            // ③ 차가운/따뜻한 중 랜덤 1테마 → 그 안에서 메뉴 랜덤 1개
            const tempThemes = [
                { menus: rec.cold, badge: "시원한", label: "시원한 메뉴 추천" },
                { menus: rec.hot,  badge: "뜨끈한", label: "뜨끈한 메뉴 추천" }
            ].filter((t) => Array.isArray(t.menus) && t.menus.length);
            const temp = pickRandom(tempThemes);

            const slides = [
                toSlide(rec.bestSeller, "베스트셀러", "오늘의 베스트셀러"),
                diet ? toSlide(pickRandom(diet.menus), diet.badge, diet.label) : null,
                temp ? toSlide(pickRandom(temp.menus), temp.badge, temp.label) : null
            ].filter(Boolean);

            // 그날 추천된 메뉴(슬라이드)를 세션에 저장 → 메뉴 목록/상세에서 동일하게 'AI 추천' 라벨/이유 노출
            try {
                const picks = slides.map((s) => ({ menuId: s.menuId, reason: s.reason }));
                sessionStorage.setItem("nunchiAiRecommend", JSON.stringify(picks));
            } catch (e) { /* sessionStorage 불가 시 무시 */ }

            if (slides.length) applySlides(slides);
        } catch (e) {
            console.warn("[S00] 추천 데이터 hydrate 실패 — 정적 슬라이드 유지", e);
        }
    }

    /**
     * 추천 결과(slides[])로 SLIDE 1~N 노드를 갱신.
     * concept 슬라이드(첫 번째)는 그대로 유지. 데이터 부족하면 남는 슬라이드는 숨긴다.
     * 판매량 % / 진행바 대신 추천 이유(reason)를 노출한다.
     */
    function applySlides(slides) {
        const $allSlides = document.querySelectorAll(".s00__slide");
        // 첫 번째는 concept 이라 건드리지 않음
        const $menuSlides = Array.from($allSlides).slice(1);

        $menuSlides.forEach(($s, i) => {
            const data = slides[i];
            if (!data) {
                $s.style.display = "none";
                return;
            }
            $s.style.display = "";

            const $media = $s.querySelector(".s00__slide-media");
            if ($media && data.imageCandidates && data.imageCandidates.length) {
                const $emblem = $media.querySelector(".s00__slide-emblem");
                let $img = $media.querySelector(".s00__slide-photo");
                if (!$img) {
                    $img = document.createElement("img");
                    $img.className = "s00__slide-photo";
                    $img.alt = data.name || "";
                    $media.insertBefore($img, $media.firstChild);
                }
                let attempt = 0;
                $img.addEventListener("error", () => {
                    attempt += 1;
                    if (attempt < data.imageCandidates.length) {
                        $img.src = data.imageCandidates[attempt];
                    } else {
                        // 모든 후보 실패 — 이미지 제거하고 emblem 을 다시 보여 빈 카드 방지
                        $img.remove();
                        if ($emblem) $emblem.style.display = "";
                    }
                });
                $img.src = data.imageCandidates[0];
                if ($emblem) $emblem.style.display = "none";
            }

            const $name  = $s.querySelector(".s00__slide-name");
            const $price = $s.querySelector(".s00__slide-price");
            if ($name)  $name.textContent  = data.name || "";
            if ($price) $price.textContent = fmtWon(data.price);

            // 배지 = 테마(저지방/시원한/오늘의 베스트셀러 등)
            const $badgeText = $s.querySelector(".s00__slide-badge span");
            if ($badgeText) $badgeText.textContent = data.badge || "AI 추천";

            // 통계 영역 → 추천 이유로 대체 (판매량 % / 진행바는 숨김)
            const $statsLabel = $s.querySelector(".s00__slide-stats-label");
            const $statsDesc  = $s.querySelector(".s00__slide-stats-desc");
            const $statsValue = $s.querySelector(".s00__slide-stats-value");
            const $progress   = $s.querySelector(".s00__slide-progress");

            if ($statsLabel) $statsLabel.textContent = data.themeLabel || "AI 추천";
            if ($statsDesc)  $statsDesc.textContent  = data.reason || "";
            if ($statsValue) $statsValue.style.display = "none";
            if ($progress)   $progress.style.display = "none";

            if (data.isSoldOut) {
                $s.classList.add("is-soldout");
                if ($price) $price.textContent = "품절";
            } else {
                $s.classList.remove("is-soldout");
            }
        });

        // dot 인디케이터 — 사용 가능한 슬라이드 수에 맞춰 hide/show
        const usableMenuCount = slides.filter(Boolean).length;
        const totalUsable = 1 + usableMenuCount; // concept + 추천
        if ($dotsRoot) {
            const $allDots = $dotsRoot.querySelectorAll(".s00__slider-dot");
            $allDots.forEach(($d, idx) => {
                $d.style.display = idx < totalUsable ? "" : "none";
            });
        }
        $dots = document.querySelectorAll(".s00__slider-dot:not([style*='display: none'])");
        SLIDE_COUNT = $dots.length;
    }

    function updateSlide(idx) {
        if (SLIDE_COUNT === 0) return;
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
        if (SLIDE_COUNT === 0) return;
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
    document.addEventListener("DOMContentLoaded", async () => {
        resetSession();
        resetAttractTimer();

        // 백엔드 데이터로 메뉴 슬라이드 채운 뒤 캐러셀 시작
        await hydrateSlidesFromBackend();
        startSlideTimer();

        // 인디케이터 클릭 (delegation — hydrate 후 dot 개수 변동 가능)
        if ($dotsRoot) {
            $dotsRoot.addEventListener("click", (e) => {
                const $d = e.target.closest(".s00__slider-dot");
                if (!$d) return;
                e.stopPropagation();
                const idx = Number($d.dataset.idx);
                if (!Number.isNaN(idx)) {
                    updateSlide(idx);
                    startSlideTimer();
                }
            });
        }

        // CTA 버튼
        const $cta = document.querySelector("[data-action='start-order']");
        if ($cta) {
            $cta.textContent = "\uD130\uCE58\uB85C \uC8FC\uBB38\uD558\uAE30";
            $cta.setAttribute("aria-label", "\uD130\uCE58\uB85C \uC8FC\uBB38 \uC2DC\uC791\uD558\uAE30");
            $cta.addEventListener("click", startOrder);
        }

        const $visionCta = document.querySelector("[data-action='start-vision-order']");
        if ($visionCta) {
            $visionCta.textContent = "\uC2DC\uC120\uC73C\uB85C \uC8FC\uBB38\uD558\uAE30";
            $visionCta.setAttribute("aria-label", "\uC2DC\uC120\uC73C\uB85C \uC8FC\uBB38 \uC2DC\uC791\uD558\uAE30");
            $visionCta.addEventListener("click", startVisionOrder);
        }

        const $hint = document.querySelector(".s00__cta-hint span");
        if ($hint) {
            $hint.textContent = "\uC6D0\uD558\uB294 \uC8FC\uBB38 \uBC29\uC2DD\uC744 \uC120\uD0DD\uD574\uC8FC\uC138\uC694";
        }
    });
})();
