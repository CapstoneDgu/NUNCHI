// ========================================================
// intent-matcher.js — 사용자 발화 → 백엔드 호출 의도 매핑
//
// 출력 형태:
//   matchFilter(text) → { params: <MenuFilterRequest>, summary: "매콤한", tags: [...] } | null
//   matchNavigation(text) → 'dine_in' | 'take_out' | 'payment' | 'cancel' | 'modify' | 'add_more' | 'recommend' | null
//   matchRecommend(text) → 'POPULAR' | 'DEFAULT' | null
//
// 매칭 결과는 A01-avatar.js 의 handleUserIntent() 에서 소비.
// ========================================================
(function () {
    'use strict';

    // 한국어 알레르기 → 백엔드 enum 명 매핑
    // (백엔드 AllergyType 의 정확한 enum 이름은 백엔드 변경 시 동기화 필요.)
    const ALLERGY_MAP = {
        '우유':   'MILK',
        '유제품': 'MILK',
        '계란':   'EGG',
        '달걀':   'EGG',
        '밀':     'WHEAT',
        '글루텐': 'WHEAT',
        '땅콩':   'PEANUT',
        '대두':   'SOYBEAN',
        '콩':     'SOYBEAN',
        '메밀':   'BUCKWHEAT',
        '복숭아': 'PEACH',
        '토마토': 'TOMATO',
        '돼지':   'PORK',
        '소':     'BEEF',
        '닭':     'CHICKEN',
        '새우':   'SHRIMP',
        '게':     'CRAB',
        '오징어': 'SQUID',
        '조개':   'SHELLFISH',
        '고등어': 'MACKEREL',
        '굴':     'OYSTER',
        '아황산': 'SULFITE'
    };

    // 토큰 기반 매칭 — 문자열 단순 includes 사용 (정규식보다 단순/빠름)
    function has(text, words) {
        return words.some((w) => text.includes(w));
    }

    /**
     * 발화에서 가격 숫자 추출. "3000원 이하" / "5천 원 이하" / "만원" 등 단순 케이스.
     * 백엔드 minPrice/maxPrice 는 원 단위 정수.
     */
    function extractPriceCap(text) {
        // "만원 이하", "1만원 이하"
        const manMatch = text.match(/([0-9]?)\s*만\s*원?/);
        // "3000원 이하" 류
        const wonMatch = text.match(/([0-9][0-9,]{2,})\s*원/);
        let value = null;
        if (manMatch) {
            const n = parseInt(manMatch[1] || '1', 10);
            value = n * 10000;
        } else if (wonMatch) {
            value = parseInt(wonMatch[1].replace(/,/g, ''), 10);
        }
        return value;
    }

    /**
     * 메뉴 필터 의도 매칭.
     *   - 매운/안매운, 차가운/뜨거운, 비건/채식
     *   - 저칼로리/단백질/저염
     *   - 알레르기 빼고
     *   - 가격 상한
     * 매칭된 항목이 하나라도 있으면 객체 반환, 아니면 null.
     */
    function matchFilter(text) {
        const t = (text || '').toLowerCase();
        const params = {};
        const tags = [];

        // 매운맛
        if (has(t, ['아주 매운', '엄청 매운', '엄청 맵', '매운 거', '매콤한', '매운', '맵게', '맵찔', '얼큰'])) {
            params.minSpicyLevel = 3;
            tags.push('매콤한');
        } else if (has(t, ['안 매운', '안매운', '순한', '덜 매운', '덜매운', '담백'])) {
            params.maxSpicyLevel = 1;
            tags.push('순한');
        }

        // 온도
        if (has(t, ['차가운', '시원한', '아이스', '얼음', '쿨'])) {
            params.temperatureType = 'COLD';
            tags.push('시원한');
        } else if (has(t, ['따뜻한', '뜨거운', '핫', '따끈', '온'])) {
            params.temperatureType = 'HOT';
            tags.push('따뜻한');
        }

        // 채식
        if (has(t, ['비건'])) {
            params.vegetarianType = 'VEGAN';
            tags.push('비건');
        } else if (has(t, ['채식', '베지', '베지테리언'])) {
            params.vegetarianType = 'VEGETARIAN';
            tags.push('채식');
        }

        // 저칼로리/다이어트
        if (has(t, ['저칼로리', '다이어트', '가벼운', '가볍게', '칼로리 낮은', '칼로리낮'])) {
            params.maxCalorie = 500;
            tags.push('가벼운');
        }

        // 단백질
        if (has(t, ['단백질', '프로틴', '운동'])) {
            params.minProtein = 15;
            tags.push('단백질');
        }

        // 저염
        if (has(t, ['저염', '나트륨', '싱겁'])) {
            params.maxSodium = 600;
            tags.push('저염');
        }

        // 가격 상한
        const cap = extractPriceCap(t);
        if (cap !== null && (has(t, ['이하', '이내', '안쪽', '아래']) || has(t, ['싼', '저렴', '값싼']))) {
            params.maxPrice = cap;
            tags.push(`${cap.toLocaleString('ko-KR')}원 이하`);
        } else if (has(t, ['싼', '저렴', '값싼']) && cap === null) {
            params.maxPrice = 5000;
            tags.push('저렴한');
        }

        // 알레르기 빼고
        const excludes = [];
        Object.keys(ALLERGY_MAP).forEach((kw) => {
            // "OO 빼고", "OO 알레르기", "OO 없는"
            const re = new RegExp(`${kw}\\s*(빼고|없|알레르기|제외)`);
            if (re.test(t) || (t.includes(`${kw} 알`)) ) {
                excludes.push(ALLERGY_MAP[kw]);
                tags.push(`${kw} 빼고`);
            }
        });
        if (excludes.length) {
            params.excludeAllergies = excludes.join(',');
        }

        if (Object.keys(params).length === 0) return null;
        params.limit = params.limit || 5;

        return { params, summary: tags.join(' · '), tags };
    }

    /**
     * 추천 의도 — type 만 식별. categoryId 추출은 카테고리 매칭 별도(추후).
     */
    function matchRecommend(text) {
        const t = (text || '').toLowerCase();
        if (has(t, ['인기', '베스트', '많이 팔리', '잘 팔리', '핫'])) return 'POPULAR';
        if (has(t, ['추천', '뭐 있', '뭐있', '뭐 먹', '뭐먹', '아무거나'])) return 'DEFAULT';
        return null;
    }

    /**
     * 비-필터 발화의 굵은 의도. 기존 KEYWORDS 와 의미적으로 겹치되,
     * A01-avatar.js 의 단계별 분기 입력으로 사용된다.
     */
    function matchNavigation(text) {
        const t = (text || '').toLowerCase();
        if (has(t, ['매장', '먹고 갈', '먹고갈', '여기서'])) return 'dine_in';
        if (has(t, ['포장', '가져갈', '테이크'])) return 'take_out';
        if (has(t, ['결제', '계산', '갈게', '진행', '끝낼게', '주문할게'])) return 'payment';
        if (has(t, ['취소', '아니', '별로', '다시'])) return 'cancel';
        if (has(t, ['수정', '바꿔', '잠깐', '빼고'])) return 'modify';
        if (has(t, ['더', '추가', '하나 더', '또'])) return 'add_more';
        if (has(t, ['추천', '뭐 있', '뭐있', '메뉴'])) return 'recommend';
        return null;
    }

    window.IntentMatcher = { matchFilter, matchRecommend, matchNavigation };
})();
