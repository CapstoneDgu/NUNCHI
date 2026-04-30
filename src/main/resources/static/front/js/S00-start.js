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
        } catch (e) {
            console.warn("[S00] sessionStorage 쓰기 실패", e);
        }
        location.href = "/S01-mode.html";
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

    // ---- 백엔드 데이터로 슬라이드 채우기 ----
    async function hydrateSlidesFromBackend() {
        if (!window.NunchiApi) return;
        try {
            // top 메뉴 + 모든 카테고리·메뉴 prefetch (categoryId·imageUrl 보강용)
            const [top, categories] = await Promise.all([
                window.NunchiApi.Menus.top(4),
                window.NunchiApi.Menus.categories()
            ]);
            const catNameById = new Map();
            (categories || []).forEach((c) => catNameById.set(c.categoryId, c.name));

            const allMenus = await Promise.all(
                (categories || []).map((c) =>
                    window.NunchiApi.Menus.list({ categoryId: c.categoryId })
                        .then((list) => (list || []).map((m) => ({ ...m, categoryId: m.categoryId == null ? c.categoryId : m.categoryId })))
                        .catch(() => [])
                )
            );
            const menuById = new Map();
            allMenus.flat().forEach((m) => menuById.set(m.menuId, m));

            const slides = (top || []).slice(0, 4).map((t) => {
                const detail = menuById.get(t.menuId) || {};
                // 한글 매핑 우선, 그 다음 백엔드 imageUrl
                const imageCandidates = [];
                const cgPath = resolveImagePath(detail.categoryId, t.name, catNameById);
                if (cgPath) imageCandidates.push(cgPath);
                if (detail.imageUrl) imageCandidates.push(detail.imageUrl);
                return {
                    menuId: t.menuId,
                    name: t.name,
                    price: t.price,
                    quantitySold: t.quantitySold || 0,
                    isSoldOut: t.isSoldOut,
                    imageCandidates
                };
            });

            applySlides(slides);
        } catch (e) {
            console.warn("[S00] 메뉴 데이터 hydrate 실패 — 정적 슬라이드 유지", e);
        }
    }

    function resolveImagePath(categoryId, name, catNameById) {
        if (categoryId == null) return null;
        const cat = catNameById.get(categoryId);
        if (!cat || !name) return null;
        return encodeURI(`/images/menu/${cat}/${name}.png`);
    }

    /**
     * top API 결과(slides[])로 1~4번 슬라이드 노드를 갱신.
     * concept 슬라이드(첫 번째)는 그대로 유지. 데이터 부족하면 남는 슬라이드는 숨긴다.
     */
    function applySlides(slides) {
        const $allSlides = document.querySelectorAll(".s00__slide");
        // 첫 번째는 concept 이라 건드리지 않음
        const $menuSlides = Array.from($allSlides).slice(1);
        // 1위 quantitySold 기준 비율
        const top1 = slides[0] && slides[0].quantitySold ? slides[0].quantitySold : 0;
        const rankBadges = ["지금 1위", "인기", "추천", "오늘의 픽"];
        const rankLabels = [
            (n) => "현재 판매량 1위",
            (n) => "지금 인기 메뉴 2위",
            (n) => "지금 인기 메뉴 3위",
            (n) => "지금 인기 메뉴 4위"
        ];

        $menuSlides.forEach(($s, i) => {
            const data = slides[i];
            if (!data) {
                $s.style.display = "none";
                return;
            }
            $s.style.display = "";

            const $media = $s.querySelector(".s00__slide-media");
            if ($media && data.imageCandidates && data.imageCandidates.length) {
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
                        $img.remove();
                    }
                });
                $img.src = data.imageCandidates[0];
                const $emblem = $media.querySelector(".s00__slide-emblem");
                if ($emblem) $emblem.style.display = "none";
            }

            const $name  = $s.querySelector(".s00__slide-name");
            const $price = $s.querySelector(".s00__slide-price");
            if ($name)  $name.textContent  = data.name || "";
            if ($price) $price.textContent = fmtWon(data.price);

            const $statsLabel = $s.querySelector(".s00__slide-stats-label");
            const $statsDesc  = $s.querySelector(".s00__slide-stats-desc");
            const $statsValue = $s.querySelector(".s00__slide-stats-value");
            const $progress   = $s.querySelector(".s00__slide-progress");
            const $progressFill = $s.querySelector(".s00__slide-progress-fill");

            if ($statsLabel) $statsLabel.textContent = rankLabels[i](data.quantitySold);
            if ($statsDesc)  $statsDesc.textContent  = `오늘 ${data.quantitySold || 0}개 주문`;

            const pct = top1 > 0 ? Math.round((data.quantitySold / top1) * 100) : 0;
            const safePct = Math.max(8, Math.min(100, pct)); // 너무 빈 그래프 방지
            if ($statsValue) $statsValue.textContent = pct + "%";
            if ($progressFill) $progressFill.style.width = safePct + "%";
            if ($progress) $progress.setAttribute("aria-valuenow", String(pct));

            const $badgeText = $s.querySelector(".s00__slide-badge span");
            if ($badgeText) $badgeText.textContent = rankBadges[i] || "추천";

            if (data.isSoldOut) {
                $s.classList.add("is-soldout");
                if ($price) $price.textContent = "품절";
            }
        });

        // dot 인디케이터 — 사용 가능한 슬라이드 수에 맞춰 hide/show
        const usableMenuCount = slides.filter(Boolean).length;
        const totalUsable = 1 + usableMenuCount; // concept + 메뉴
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
            $cta.addEventListener("click", startOrder);
        }
    });
})();
