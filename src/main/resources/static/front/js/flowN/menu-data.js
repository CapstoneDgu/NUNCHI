// ========================================================
// menu-data.js — 상록원 식당 · 메뉴 데이터 단일 소스
// 사용처: N02-menu (목록 + 상세 오버레이) 및 향후 P01 요약
//
// 구조:
//   window.__MENU_DATA__ = {
//       brand, floors[ { id, label, stores[ { id, name, hours, menus[] } ] } ]
//   }
//
// 메뉴 객체 필드:
//   id          숫자 ID
//   name        메뉴명
//   price       원
//   aiPick      (옵션) AI 추천 뱃지
//   badge       (옵션) "한정판매" 등 추가 뱃지 텍스트
//   dailyDate   (옵션, store 레벨에서도 사용) "03/25(수)" 등 변동 메뉴 날짜 표기
//   soldOut     (옵션) 품절
//
// 상세(메뉴구성/원산지/영양정보)는 buildMenuMeta(menu) 가
// 메뉴명 키워드를 기반으로 카테고리를 추정해 자동 생성한다.
// ========================================================

(function () {
    'use strict';

    // -------- 1. 사용자 제공 실제 메뉴 데이터 --------
    const DATA = {
        brand: "상록원",
        floors: [
            {
                id: "F1", label: "1층",
                stores: [
                    {
                        id: "sotn-noodle",
                        name: "솥앤누들",
                        hours: "11:00~19:00",
                        menus: [
                            { id: 101, name: "삼겹살김치철판",  price: 6000 },
                            { id: 102, name: "치즈불닭철판",    price: 7000, aiPick: true },
                            { id: 103, name: "데리야끼치킨솥밥", price: 5700 },
                            { id: 104, name: "숯불삼겹솥밥",    price: 5000 },
                            { id: 105, name: "우삼겹솥밥",      price: 6500 },
                            { id: 106, name: "콘치즈솥밥",      price: 5000 },
                            { id: 107, name: "우동",            price: 5000 },
                            { id: 108, name: "우동·돈가스 set", price: 6800 },
                            { id: 109, name: "우동·알밥 set",   price: 6500 },
                            { id: 110, name: "철판치즈돈가스",  price: 7000 },
                            { id: 111, name: "낙지삼겹솥밥",    price: 6500 },
                        ],
                    },
                    {
                        id: "bunsik",
                        name: "분식당",
                        hours: "10:00~14:00",
                        menus: [
                            { id: 121, name: "추억의도시락", price: 4000 },
                            { id: 122, name: "계란라면",     price: 3800 },
                            { id: 123, name: "치즈라면",     price: 4000 },
                            { id: 124, name: "해장라면",     price: 4000 },
                            { id: 125, name: "공기밥",       price: 1000 },
                        ],
                    },
                ],
            },
            {
                id: "F2", label: "2층",
                stores: [
                    {
                        id: "ilpum",
                        name: "일품",
                        hours: "11:00~14:00 / 15:00~16:00",
                        dailyDate: "03/25(수)",
                        menus: [
                            { id: 201, name: "매콤제육덮밥·핫도그·자율배식·배추김치/단무지", price: 4500 },
                        ],
                    },
                    {
                        id: "yang",
                        name: "양식",
                        hours: "11:00~14:00",
                        dailyDate: "03/25(수)",
                        menus: [
                            { id: 211, name: "치즈돈까스",            price: 6300 },
                            { id: 212, name: "토마토파스타·마늘빵",   price: 6000 },
                            { id: 213, name: "치즈오븐파스타",        price: 6500, badge: "한정판매" },
                        ],
                    },
                    {
                        id: "deojinguk",
                        name: "더진국",
                        hours: "11:00~14:00 / 15:00~16:00",
                        menus: [
                            { id: 221, name: "수육국밥·순대국밥", price: 6800 },
                            { id: 222, name: "얼큰국밥",          price: 7000 },
                        ],
                    },
                ],
            },
            {
                id: "F3", label: "3층",
                stores: [
                    {
                        id: "jipbap",
                        name: "집밥",
                        hours: "11:00~14:00 / 17:00~19:00",
                        dailyDate: "03/25(수)",
                        menus: [
                            { id: 301, name: "[중식] 샤브칼국수·삼겹살수육·도토리묵상추무침·샐러드·배추김치", price: 7000 },
                            { id: 302, name: "[석식] 파채고추장삼겹살·치킨너겟·미역줄기볶음·샐러드·배추김치", price: 7000 },
                        ],
                    },
                    {
                        id: "hangreut",
                        name: "한그릇",
                        hours: "12:00~14:00",
                        dailyDate: "03/25(수)",
                        menus: [
                            { id: 311, name: "[중식] 카레&그릴소세지·통새우볼튀김·마시는요플레·배추김치", price: 7000, badge: "한정판매" },
                        ],
                    },
                ],
            },
        ],
    };

    // -------- 2. 메뉴 카테고리 추정 --------
    // 가장 먼저 매칭된 카테고리를 사용 (배열 순서 = 우선순위)
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
        const name = menu.name;
        for (const rule of CATEGORY_RULES) {
            if (rule.keywords.some((kw) => name.toLowerCase().indexOf(kw.toLowerCase()) >= 0)) {
                return rule.id;
            }
        }
        return "etc";
    }

    // -------- 3. 카테고리별 데모 메타데이터 템플릿 --------
    // - components: 메뉴구성 칩에 표시될 구성품
    // - ingredients: 원재료/원산지 (기본 국내산, true면 수입산으로 표시)
    // - nutritionRatio: 가격에 비례해서 칼로리/영양소 추정에 쓰임 (대략적)
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

    // -------- 4. 메타 빌더 --------
    function buildMenuMeta(menu) {
        const cat = detectCategory(menu);
        const tpl = META_BY_CATEGORY[cat] || META_BY_CATEGORY.etc;

        // 가격에 비례해서 영양소를 ±10% 흔들어 다양성 부여 (결정론적)
        const seed = (menu.id % 7) - 3;          // -3 ~ +3
        const factor = 1 + (seed * 0.03);        // 0.91 ~ 1.09

        const n = tpl.nutritionBase;
        const nutrition = {
            kcal:    Math.round(n.kcal    * factor / 10) * 10,
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

    // -------- 5. 운영 시간 파싱 → 현재 운영중 여부 --------
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
        const date = now || new Date();
        const cur = date.getHours() * 60 + date.getMinutes();
        return parseHoursToRanges(hoursStr).some(function (r) {
            return cur >= r.startMin && cur < r.endMin;
        });
    }

    // -------- 6. 헬퍼 --------
    function formatPrice(won) {
        return "₩ " + Number(won).toLocaleString("ko-KR");
    }

    function findMenuById(id) {
        for (const f of DATA.floors) {
            for (const s of f.stores) {
                for (const m of s.menus) {
                    if (m.id === id) {
                        return { menu: m, store: s, floor: f };
                    }
                }
            }
        }
        return null;
    }

    // -------- 7. 외부 노출 --------
    window.__MENU_DATA__ = DATA;
    window.MenuData = {
        data: DATA,
        buildMenuMeta: buildMenuMeta,
        isOpenNow: isOpenNow,
        formatPrice: formatPrice,
        findMenuById: findMenuById,
    };
})();
