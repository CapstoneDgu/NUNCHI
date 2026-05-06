// ========================================================
// menu-data.js — 상록원 식당 · 메뉴 데이터 어댑터
// 사용처: N02-menu (목록 + 상세 오버레이) 및 향후 P01 요약
//
// 책임:
//   - GET /api/menus 호출 → floors[ stores[ menus[] ] ] 트리 변환
//   - 운영시간 문자열 형식 정규화 ("11:00-14:00,15:00-16:00" → "11:00~14:00 / 15:00~16:00")
//   - 카테고리 키워드 기반 메뉴 메타(설명/구성/원산지/영양) 추정 — 백엔드 메타 보강 전까지 사용
//
// 외부 노출:
//   await window.MenuData.load();     // 최초 1회 호출
//   window.MenuData.data              // { brand, floors[] }
//   window.MenuData.findMenuById(id)  // {menu, store, floor}
//   window.MenuData.buildMenuMeta(m)  // {description, components, ingredients, nutrition}
//   window.MenuData.isOpenNow(hours)  // boolean
//   window.MenuData.formatPrice(won)  // "₩ 5,000"
// ========================================================

(function () {
    'use strict';

    // -------- 1. 빈 데이터 컨테이너 (load() 호출 전) --------
    const DATA = {
        brand: "상록원",
        floors: [],
    };

    // -------- 2. 운영시간 형식 변환 (DB → 화면 표기) --------
    // DB:    "11:00-14:00,15:00-16:00"
    // 화면:  "11:00~14:00 / 15:00~16:00"
    function normalizeHours(raw) {
        if (!raw) return "";
        return String(raw)
            .split(",")
            .map((s) => s.trim().replace(/-/g, "~"))
            .filter(Boolean)
            .join(" / ");
    }

    // -------- 3. 층 라벨 ("1층", "지하1층" 등) --------
    function floorLabel(floorNum) {
        if (floorNum == null) return "기타";
        if (floorNum < 0) return "지하" + Math.abs(floorNum) + "층";
        return floorNum + "층";
    }

    function floorId(floorNum) {
        if (floorNum == null) return "F0";
        if (floorNum < 0) return "B" + Math.abs(floorNum);
        return "F" + floorNum;
    }

    function storeIdFrom(floorNum, restaurantName) {
        const safe = String(restaurantName || "unknown")
            .replace(/\s+/g, "-")
            .toLowerCase();
        return floorId(floorNum) + "-" + safe;
    }

    // -------- 4. API 응답 → floors[ stores[ menus[] ] ] 그룹핑 --------
    // floor / restaurantName 가 null 인 메뉴는 "추가메뉴" 로 분류되어 N02 트리에서 제외.
    // (추가메뉴는 향후 별도 UI 에서 표시)
    function groupMenus(apiMenus) {
        // floor → restaurantName → menus[]
        const floorMap = new Map();

        for (const m of apiMenus) {
            if (m.floor == null || !m.restaurantName) continue;

            const fNum  = m.floor;
            const rName = m.restaurantName;
            const fKey  = floorId(fNum);

            if (!floorMap.has(fKey)) {
                floorMap.set(fKey, {
                    id:     fKey,
                    num:    fNum,
                    label:  floorLabel(fNum),
                    stores: new Map(),
                });
            }
            const floor = floorMap.get(fKey);

            const sKey = storeIdFrom(fNum, rName);
            if (!floor.stores.has(sKey)) {
                floor.stores.set(sKey, {
                    id:    sKey,
                    name:  rName,
                    hours: normalizeHours(m.operatingHours),
                    menus: [],
                });
            }
            const store = floor.stores.get(sKey);

            store.menus.push({
                id:       m.menuId,
                name:     m.name,
                price:    m.price,
                imageUrl: m.imageUrl,
                aiPick:   !!m.isRecommended,
                soldOut:  !!m.isSoldOut,
                allergies:    m.allergies || [],
                spicyLevel:   m.spicyLevel,
                temperature:  m.temperatureType,
                calorie:      m.calorie,
            });
        }

        // Map → 정렬된 배열 (층 번호 오름차순)
        const floors = Array.from(floorMap.values())
            .sort((a, b) => (a.num ?? 99) - (b.num ?? 99))
            .map((f) => ({
                id:     f.id,
                label:  f.label,
                stores: Array.from(f.stores.values()),
            }));

        return floors;
    }

    // -------- 5. API 로드 --------
    async function load() {
        if (!window.Api || !window.Api.menu) {
            throw new Error("Api 모듈이 로드되지 않았습니다. api.js 를 먼저 포함해 주세요.");
        }
        const apiMenus = await window.Api.menu.list();
        DATA.floors = groupMenus(apiMenus || []);
        return DATA;
    }

    // -------- 6. 메뉴 카테고리 추정 (메뉴명 키워드) --------
    const CATEGORY_RULES = [
        { id: "ramen",       keywords: ["라면"] },
        { id: "udon",        keywords: ["우동"] },
        { id: "pasta",       keywords: ["파스타"] },
        { id: "donkkasu",    keywords: ["돈가스", "돈까스"] },
        { id: "guk",         keywords: ["국밥", "해장"] },
        { id: "chulpan",     keywords: ["철판"] },
        { id: "sotbap",      keywords: ["솥밥"] },
        { id: "deopbap",     keywords: ["덮밥"] },
        { id: "dosirak",     keywords: ["도시락"] },
        { id: "rice-extra",  keywords: ["공기밥"] },
        { id: "set",         keywords: ["set", "세트"] },
        { id: "korean-set",  keywords: ["[중식]", "[석식]", "샐러드", "배추김치"] },
    ];

    function detectCategory(menu) {
        const name = menu.name || "";
        for (const rule of CATEGORY_RULES) {
            if (rule.keywords.some((kw) => name.toLowerCase().indexOf(kw.toLowerCase()) >= 0)) {
                return rule.id;
            }
        }
        return "etc";
    }

    // -------- 7. 카테고리별 메타 템플릿 (백엔드 메타 보강 전 임시) --------
    const META_BY_CATEGORY = {
        ramen: {
            description: "얼큰한 국물에 쫄깃한 면발을 즐기는 따끈한 한 그릇",
            components: ["라면사리", "국물 베이스", "계란", "대파", "김치"],
            ingredients: [
                { name: "라면사리(밀)", origin: "수입산", imported: true },
                { name: "계란",         origin: "국내산" },
                { name: "대파",         origin: "국내산" },
                { name: "고춧가루",     origin: "국내산" },
                { name: "배추김치",     origin: "국내산" },
            ],
            nutritionBase: { kcal: 540, protein: 18, carb: 78, fat: 18 },
        },
        udon: {
            description: "진한 가쓰오 육수와 부드러운 우동면의 조화",
            components: ["우동면", "가쓰오 육수", "유부", "쪽파", "어묵"],
            ingredients: [
                { name: "우동면(밀)", origin: "국내산" },
                { name: "가쓰오부시", origin: "수입산", imported: true },
                { name: "유부",       origin: "국내산" },
                { name: "쪽파",       origin: "국내산" },
                { name: "간장",       origin: "국내산" },
            ],
            nutritionBase: { kcal: 580, protein: 16, carb: 92, fat: 14 },
        },
        pasta: {
            description: "이탈리안 정통 레시피로 풍미 가득한 파스타",
            components: ["스파게티 면", "토마토 소스", "마늘", "올리브오일", "파마산 치즈"],
            ingredients: [
                { name: "스파게티(밀)", origin: "수입산", imported: true },
                { name: "토마토",       origin: "국내산" },
                { name: "마늘",         origin: "국내산" },
                { name: "올리브오일",   origin: "수입산", imported: true },
                { name: "파마산 치즈",  origin: "수입산", imported: true },
            ],
            nutritionBase: { kcal: 720, protein: 22, carb: 95, fat: 26 },
        },
        donkkasu: {
            description: "두툼한 등심을 바삭하게 튀긴 정통 일식 돈가스",
            components: ["돈가스 등심", "빵가루", "양배추 샐러드", "데미글라스 소스", "밥"],
            ingredients: [
                { name: "돼지고기 등심", origin: "국내산" },
                { name: "빵가루(밀)",    origin: "국내산" },
                { name: "양배추",        origin: "국내산" },
                { name: "데미글라스",    origin: "국내산" },
                { name: "쌀",            origin: "국내산" },
            ],
            nutritionBase: { kcal: 820, protein: 32, carb: 78, fat: 36 },
        },
        guk: {
            description: "사골을 우려낸 깊은 국물에 푸짐한 건더기",
            components: ["사골 육수", "수육·내장", "대파", "다진양념", "공기밥"],
            ingredients: [
                { name: "한우 사골", origin: "국내산" },
                { name: "돼지고기",  origin: "국내산" },
                { name: "대파",      origin: "국내산" },
                { name: "고춧가루",  origin: "국내산" },
                { name: "쌀",        origin: "국내산" },
            ],
            nutritionBase: { kcal: 760, protein: 38, carb: 72, fat: 22 },
        },
        chulpan: {
            description: "뜨거운 철판에서 바로 볶아낸 한국식 볶음 요리",
            components: ["철판볶음밥", "메인 단백질", "묵은지", "대파", "참기름", "깨"],
            ingredients: [
                { name: "삼겹살(돼지)", origin: "국내산" },
                { name: "쌀",           origin: "국내산" },
                { name: "배추김치",     origin: "국내산" },
                { name: "대파",         origin: "국내산" },
                { name: "참기름",       origin: "국내산" },
                { name: "고춧가루",     origin: "국내산" },
            ],
            nutritionBase: { kcal: 720, protein: 28, carb: 82, fat: 24 },
        },
        sotbap: {
            description: "뜨거운 솥에 갓 지은 밥과 메인 토핑이 어우러진 한 그릇",
            components: ["솥에 지은 밥", "메인 토핑", "쪽파", "참기름", "구운 김"],
            ingredients: [
                { name: "쌀",       origin: "국내산" },
                { name: "닭가슴살", origin: "국내산" },
                { name: "쪽파",     origin: "국내산" },
                { name: "참기름",   origin: "국내산" },
                { name: "구운김",   origin: "국내산" },
            ],
            nutritionBase: { kcal: 700, protein: 26, carb: 88, fat: 18 },
        },
        deopbap: {
            description: "갓 지은 밥 위에 매콤한 양념을 더한 한 끼 식사",
            components: ["흰쌀밥", "메인 토핑", "양념장", "야채", "단무지"],
            ingredients: [
                { name: "쌀",         origin: "국내산" },
                { name: "돼지고기",   origin: "국내산" },
                { name: "양파",       origin: "국내산" },
                { name: "고추장",     origin: "국내산" },
                { name: "단무지",     origin: "국내산" },
            ],
            nutritionBase: { kcal: 680, protein: 24, carb: 92, fat: 18 },
        },
        dosirak: {
            description: "옛날 학교 도시락 그대로의 정겨운 한 끼",
            components: ["흰쌀밥", "스팸", "계란말이", "김치", "단무지"],
            ingredients: [
                { name: "쌀",     origin: "국내산" },
                { name: "스팸",   origin: "국내산" },
                { name: "계란",   origin: "국내산" },
                { name: "배추김치", origin: "국내산" },
                { name: "단무지", origin: "국내산" },
            ],
            nutritionBase: { kcal: 620, protein: 20, carb: 78, fat: 22 },
        },
        "rice-extra": {
            description: "갓 지은 따끈한 밥 한 공기",
            components: ["쌀밥"],
            ingredients: [
                { name: "쌀", origin: "국내산" },
            ],
            nutritionBase: { kcal: 310, protein: 6, carb: 68, fat: 1 },
        },
        set: {
            description: "두 가지 메뉴를 한 번에 즐기는 풍성한 세트",
            components: ["메인 메뉴", "사이드 메뉴", "반찬", "음료"],
            ingredients: [
                { name: "쌀",         origin: "국내산" },
                { name: "돼지고기",   origin: "국내산" },
                { name: "밀가루",     origin: "수입산", imported: true },
                { name: "양배추",     origin: "국내산" },
            ],
            nutritionBase: { kcal: 880, protein: 28, carb: 110, fat: 28 },
        },
        "korean-set": {
            description: "오늘의 한식 정찬 — 메인 + 반찬 구성",
            components: ["메인 요리", "샐러드", "배추김치", "공기밥", "반찬"],
            ingredients: [
                { name: "쌀",         origin: "국내산" },
                { name: "삼겹살(돼지)", origin: "국내산" },
                { name: "배추",       origin: "국내산" },
                { name: "고춧가루",   origin: "국내산" },
                { name: "참기름",     origin: "국내산" },
            ],
            nutritionBase: { kcal: 760, protein: 30, carb: 85, fat: 24 },
        },
        etc: {
            description: "오늘의 메뉴 — 정성껏 준비한 한 끼",
            components: ["메인 구성", "사이드", "반찬"],
            ingredients: [
                { name: "쌀",     origin: "국내산" },
                { name: "야채",   origin: "국내산" },
                { name: "양념",   origin: "국내산" },
            ],
            nutritionBase: { kcal: 650, protein: 22, carb: 80, fat: 20 },
        },
    };

    // -------- 8. 메타 빌더 --------
    function buildMenuMeta(menu) {
        const cat = detectCategory(menu);
        const tpl = META_BY_CATEGORY[cat] || META_BY_CATEGORY.etc;

        // 영양: 백엔드 calorie 가 있으면 그걸 사용, 없으면 카테고리 베이스에 ID 기반 ±10% 흔들림
        const seed = (Number(menu.id) % 7) - 3;
        const factor = 1 + (seed * 0.03);
        const n = tpl.nutritionBase;
        const nutrition = {
            kcal:    menu.calorie != null ? menu.calorie : Math.round(n.kcal * factor / 10) * 10,
            protein: Math.round(n.protein * factor),
            carb:    Math.round(n.carb    * factor),
            fat:     Math.round(n.fat     * factor),
        };

        return {
            category: cat,
            description: tpl.description,
            components:  tpl.components.slice(),
            ingredients: tpl.ingredients.map(function (i) { return Object.assign({}, i); }),
            nutrition: nutrition,
        };
    }

    // -------- 9. 운영 시간 파싱 → 현재 운영중 여부 --------
    // hours 예: "11:00~19:00", "11:00~14:00 / 15:00~16:00"
    function parseHoursToRanges(hoursStr) {
        if (!hoursStr) return [];
        return hoursStr.split("/").map(function (chunk) {
            const m = chunk.trim().match(/(\d{1,2}):(\d{2})\s*~\s*(\d{1,2}):(\d{2})/);
            if (!m) return null;
            return {
                startMin: (+m[1]) * 60 + (+m[2]),
                endMin:   (+m[3]) * 60 + (+m[4]),
            };
        }).filter(Boolean);
    }

    function isOpenNow(hoursStr, now) {
        const ranges = parseHoursToRanges(hoursStr);
        if (ranges.length === 0) return true; // 운영시간 미등록은 일단 운영중으로 표시
        const date = now || new Date();
        const cur = date.getHours() * 60 + date.getMinutes();
        return ranges.some(function (r) {
            return cur >= r.startMin && cur < r.endMin;
        });
    }

    // -------- 10. 헬퍼 --------
    function formatPrice(won) {
        return "₩ " + Number(won || 0).toLocaleString("ko-KR");
    }

    function findMenuById(id) {
        const target = Number(id);
        for (const f of DATA.floors) {
            for (const s of f.stores) {
                for (const m of s.menus) {
                    if (Number(m.id) === target) {
                        return { menu: m, store: s, floor: f };
                    }
                }
            }
        }
        return null;
    }

    // -------- 11. 외부 노출 --------
    window.__MENU_DATA__ = DATA;
    window.MenuData = {
        data: DATA,
        load: load,
        buildMenuMeta: buildMenuMeta,
        isOpenNow: isOpenNow,
        formatPrice: formatPrice,
        findMenuById: findMenuById,
    };
})();
