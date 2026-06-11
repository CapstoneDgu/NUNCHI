package dgu.capstone.nunchi.domain.menu.service;

import dgu.capstone.nunchi.domain.menu.dto.request.MenuFilterRequest;
import dgu.capstone.nunchi.domain.menu.dto.request.MenuSearchRequest;
import dgu.capstone.nunchi.domain.menu.dto.response.MenuCategoryResponse;
import dgu.capstone.nunchi.domain.menu.dto.response.MenuDetailResponse;
import dgu.capstone.nunchi.domain.menu.dto.response.MenuFilterResponse;
import dgu.capstone.nunchi.domain.menu.dto.response.MenuRecommendationResponse;
import dgu.capstone.nunchi.domain.menu.dto.response.MenuResponse;
import dgu.capstone.nunchi.domain.menu.dto.response.TopMenuResponse;
import dgu.capstone.nunchi.domain.menu.entity.Menu;
import dgu.capstone.nunchi.domain.menu.entity.MenuOption;
import dgu.capstone.nunchi.domain.menu.entity.MenuOptionGroup;
import dgu.capstone.nunchi.domain.menu.entity.enums.AllergyType;
import dgu.capstone.nunchi.domain.menu.entity.enums.Season;
import dgu.capstone.nunchi.domain.menu.entity.enums.TemperatureType;
import dgu.capstone.nunchi.domain.menu.repository.MenuCategoryRepository;
import dgu.capstone.nunchi.domain.menu.repository.MenuOptionGroupRepository;
import dgu.capstone.nunchi.domain.menu.repository.MenuOptionRepository;
import dgu.capstone.nunchi.domain.menu.repository.MenuRepository;
import dgu.capstone.nunchi.domain.menu.repository.MenuSpecification;
import dgu.capstone.nunchi.domain.menu.repository.SalesDailyRepository;
import dgu.capstone.nunchi.global.exception.domainException.MenuException;
import dgu.capstone.nunchi.global.exception.errorcode.MenuErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.Collections;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class MenuService {

    private final MenuRepository menuRepository;
    private final MenuCategoryRepository menuCategoryRepository;
    private final MenuOptionGroupRepository menuOptionGroupRepository;
    private final MenuOptionRepository menuOptionRepository;
    private final SalesDailyRepository salesDailyRepository;

    // 추천 메뉴 후보군 풀 크기 / 최종 랜덤 추출 개수
    private static final int RECOMMEND_POOL_SIZE = 10;
    private static final int RECOMMEND_PICK_COUNT = 3;
    // 추천에서 제외할 카테고리 (옵션성 추가메뉴, 음료)
    private static final List<String> RECOMMEND_EXCLUDED_CATEGORIES = List.of("추가메뉴", "음료");
    // 추천 이유 (Spring 서버는 AI를 호출하지 않으므로 카테고리(묶음)별 고정 문구 사용 — 같은 묶음의 메뉴는 동일 문구)
    private static final String BEST_SELLER_REASON = "오늘 가장 많은 분들이 선택한 인기 메뉴예요";
    private static final String LOW_FAT_REASON = "지방 함량이 적어 부담 없이 즐기실 수 있어요";
    private static final String HIGH_PROTEIN_REASON = "단백질이 풍부해 든든한 한 끼로 좋아요";
    private static final String LOW_CALORIE_REASON = "칼로리 부담이 적은 메뉴예요";
    private static final String COLD_REASON = "시원하게 즐기기 좋은 메뉴예요";
    private static final String HOT_REASON = "따뜻하게 즐기기 좋은 메뉴예요";

    // 전체 카테고리 조회
    public List<MenuCategoryResponse> getCategories() {
        return menuCategoryRepository.findAll().stream()
                .map(MenuCategoryResponse::from)
                .toList();
    }

    // 메뉴 목록 조회 (categoryId 없으면 전체, 있으면 해당 카테고리 필터)
    // "오늘의 베스트셀러"는 일반 목록에서도 isRecommended=true + 추천 이유를 함께 노출 (홈 화면 추천 라벨과 통일)
    public List<MenuResponse> getMenus(Long categoryId) {
        List<Menu> menus = (categoryId == null)
                ? menuRepository.findAll()
                : menuRepository.findByCategory_CategoryId(categoryId);

        Long bestSellerMenuId = resolveBestSellerMenuId();
        return menus.stream()
                .map(menu -> toMenuResponseWithBestSellerLabel(menu, bestSellerMenuId))
                .toList();
    }

    // 오늘 날짜 기준 판매량 상위 메뉴 조회
    public List<TopMenuResponse> getTopMenus(int limit) {
        return salesDailyRepository.findTopMenusByDate(LocalDate.now(), PageRequest.of(0, limit));
    }

    // 동적 필터 조회 (AI 추천 에이전트용)
    public List<MenuFilterResponse> filterMenus(MenuFilterRequest req) {
        Specification<Menu> spec = Specification.where(MenuSpecification.notSoldOut())
                .and(MenuSpecification.fetchCategory());

        if (req.maxCalorie() != null) spec = spec.and(MenuSpecification.maxCalorie(req.maxCalorie()));
        if (req.minCalorie() != null) spec = spec.and(MenuSpecification.minCalorie(req.minCalorie()));
        if (req.minProtein() != null) spec = spec.and(MenuSpecification.minProtein(req.minProtein()));
        if (req.maxSodium() != null) spec = spec.and(MenuSpecification.maxSodium(req.maxSodium()));
        if (req.maxSpicyLevel() != null) spec = spec.and(MenuSpecification.maxSpicyLevel(req.maxSpicyLevel()));
        if (req.minSpicyLevel() != null) spec = spec.and(MenuSpecification.minSpicyLevel(req.minSpicyLevel()));
        if (req.temperatureType() != null && req.temperatureType() != TemperatureType.BOTH) {
            spec = spec.and(MenuSpecification.temperatureType(req.temperatureType()));
        }
        if (req.vegetarianType() != null) spec = spec.and(MenuSpecification.vegetarianType(req.vegetarianType()));
        // season=ALL 전달 시 필터 없음 (전체 반환)
        if (req.season() != null && req.season() != Season.ALL) {
            spec = spec.and(MenuSpecification.season(req.season()));
        }
        if (req.categoryId() != null) spec = spec.and(MenuSpecification.categoryId(req.categoryId()));
        if (req.minPrice() != null) spec = spec.and(MenuSpecification.minPrice(req.minPrice()));
        if (req.maxPrice() != null) spec = spec.and(MenuSpecification.maxPrice(req.maxPrice()));
        if (req.restaurantName() != null && !req.restaurantName().isBlank()) spec = spec.and(MenuSpecification.restaurantName(req.restaurantName()));
        if (req.floor() != null) spec = spec.and(MenuSpecification.floor(req.floor()));
        if (req.excludeAllergies() != null && !req.excludeAllergies().isBlank()) {
            List<AllergyType> allergyList = Arrays.stream(req.excludeAllergies().split(","))
                    .map(String::trim)
                    .map(s -> {
                        try {
                            return AllergyType.valueOf(s);
                        } catch (IllegalArgumentException e) {
                            throw new MenuException(MenuErrorCode.INVALID_ALLERGY_TYPE);
                        }
                    })
                    .toList();
            spec = spec.and(MenuSpecification.excludeAllergies(allergyList));
        }

        List<Menu> menus = menuRepository.findAll(spec);
        Stream<Menu> stream = menus.stream();
        if (req.limit() != null) stream = stream.limit(req.limit());
        return stream.map(MenuFilterResponse::from).toList();
    }

    // 이름 퍼지 검색 (FastAPI NER 결과 → menuId 변환용)
    public List<MenuResponse> searchMenus(MenuSearchRequest request) {
        String keyword = request.name() == null ? "" : request.name().trim();
        if (keyword.isBlank()) {
            throw new MenuException(MenuErrorCode.INVALID_SEARCH_KEYWORD);
        }
        Specification<Menu> spec = Specification.where(MenuSpecification.notSoldOut())
                .and(MenuSpecification.fetchCategory())
                .and(MenuSpecification.nameContains(keyword));

        Long bestSellerMenuId = resolveBestSellerMenuId();
        return menuRepository.findAll(spec).stream()
                .map(menu -> toMenuResponseWithBestSellerLabel(menu, bestSellerMenuId))
                .toList();
    }

    // 메뉴 상세 조회 (옵션그룹 + 옵션 포함, N+1 방지)
    // "오늘의 베스트셀러"라면 isRecommended=true + 추천 이유를 함께 노출 (목록/홈 화면 추천 라벨과 통일, 상세보기에서 이유 확인 가능)
    public MenuDetailResponse getMenuDetail(Long menuId) {
        Menu menu = menuRepository.findById(menuId)
                .orElseThrow(() -> new MenuException(MenuErrorCode.NOT_FOUND_MENU));

        List<MenuOptionGroup> groups = menuOptionGroupRepository.findByMenu_MenuId(menuId);

        // 옵션그룹 ID 목록으로 옵션을 한 번에 조회 (N+1 방지)
        List<Long> groupIds = groups.stream()
                .map(MenuOptionGroup::getOptionGroupId)
                .toList();

        Map<Long, List<MenuOption>> optionsByGroupId = menuOptionRepository
                .findByOptionGroup_OptionGroupIdIn(groupIds)
                .stream()
                .collect(Collectors.groupingBy(option -> option.getOptionGroup().getOptionGroupId()));

        boolean isBestSeller = menuId.equals(resolveBestSellerMenuId());
        Boolean isRecommended = isBestSeller ? Boolean.TRUE : menu.getIsRecommended();
        String reason = isBestSeller ? BEST_SELLER_REASON : null;

        return MenuDetailResponse.from(menu, groups, optionsByGroupId, isRecommended, reason);
    }

    /**
     * 홈 화면 AI 추천 메뉴 모음 조회
     * - 저지방 / 고단백 / 저칼로리 / cold / hot 각 3개 랜덤 (묶음별 공통 추천 이유 포함)
     * - 오늘 판매량 1위 메뉴 1개 고정 (isRecommended=true + 추천 이유 포함)
     * - 옵션성 메뉴(추가메뉴)와 음료는 모든 항목에서 제외
     */
    public MenuRecommendationResponse getRecommendations() {
        Specification<Menu> baseSpec = Specification.where(MenuSpecification.notSoldOut())
                .and(MenuSpecification.fetchCategory())
                .and(MenuSpecification.excludeCategoryNames(RECOMMEND_EXCLUDED_CATEGORIES));
        List<Menu> eligibleMenus = menuRepository.findAll(baseSpec);

        List<Menu> withNutrition = eligibleMenus.stream()
                .filter(menu -> menu.getNutrition() != null)
                .toList();

        List<MenuResponse> lowFat = pickRandomFromTop(withNutrition,
                Comparator.comparing(menu -> menu.getNutrition().getFat(), Comparator.nullsLast(Comparator.naturalOrder())),
                LOW_FAT_REASON);
        List<MenuResponse> highProtein = pickRandomFromTop(withNutrition,
                Comparator.comparing((Menu menu) -> menu.getNutrition().getProtein(), Comparator.nullsLast(Comparator.naturalOrder())).reversed(),
                HIGH_PROTEIN_REASON);
        List<MenuResponse> lowCalorie = pickRandomFromTop(withNutrition,
                Comparator.comparing(menu -> menu.getNutrition().getCalorie(), Comparator.nullsLast(Comparator.naturalOrder())),
                LOW_CALORIE_REASON);

        List<Menu> coldMenus = eligibleMenus.stream()
                .filter(menu -> menu.getTemperatureType() == TemperatureType.COLD)
                .toList();
        List<Menu> hotMenus = eligibleMenus.stream()
                .filter(menu -> menu.getTemperatureType() == TemperatureType.HOT)
                .toList();

        List<MenuResponse> cold = pickRandom(coldMenus, RECOMMEND_PICK_COUNT, COLD_REASON);
        List<MenuResponse> hot = pickRandom(hotMenus, RECOMMEND_PICK_COUNT, HOT_REASON);

        MenuResponse bestSeller = getBestSellerRecommendation(eligibleMenus);

        return new MenuRecommendationResponse(lowFat, highProtein, lowCalorie, cold, hot, bestSeller);
    }

    // 정렬 기준 상위 RECOMMEND_POOL_SIZE개를 후보군으로 삼아 그중 RECOMMEND_PICK_COUNT개를 랜덤 추출 + 묶음 공통 추천 이유 부여
    private List<MenuResponse> pickRandomFromTop(List<Menu> candidates, Comparator<Menu> comparator, String reason) {
        List<Menu> pool = candidates.stream()
                .sorted(comparator)
                .limit(RECOMMEND_POOL_SIZE)
                .collect(Collectors.toCollection(ArrayList::new));
        Collections.shuffle(pool);
        return pool.stream()
                .limit(RECOMMEND_PICK_COUNT)
                .map(menu -> MenuResponse.ofRecommendation(menu, menu.getIsRecommended(), reason))
                .toList();
    }

    // 후보군 전체에서 랜덤으로 count개 추출 + 묶음 공통 추천 이유 부여
    private List<MenuResponse> pickRandom(List<Menu> candidates, int count, String reason) {
        List<Menu> shuffled = new ArrayList<>(candidates);
        Collections.shuffle(shuffled);
        return shuffled.stream()
                .limit(count)
                .map(menu -> MenuResponse.ofRecommendation(menu, menu.getIsRecommended(), reason))
                .toList();
    }

    // 오늘 판매량 1위 메뉴를 추천 후보(추가메뉴/음료 제외) 중에서 선정. 판매 데이터가 없으면 추천 후보 중 첫 메뉴로 대체
    private MenuResponse getBestSellerRecommendation(List<Menu> eligibleMenus) {
        if (eligibleMenus.isEmpty()) return null;

        Long bestSellerMenuId = resolveBestSellerMenuId();
        Menu bestSeller = (bestSellerMenuId != null)
                ? menuRepository.findById(bestSellerMenuId).orElse(eligibleMenus.get(0))
                : eligibleMenus.get(0);

        return MenuResponse.ofRecommendation(bestSeller, true, BEST_SELLER_REASON);
    }

    /**
     * 오늘의 베스트셀러 menuId 결정 (추가메뉴/음료/품절 제외)
     * - 오늘 판매 데이터가 있으면 판매량 1위, 없으면 후보 중 menuId 최소값으로 폴백.
     * 목록/검색/상세/홈 화면 추천이 모두 같은 메뉴를 베스트셀러로 라벨하도록 단일 소스로 사용한다.
     */
    private Long resolveBestSellerMenuId() {
        Specification<Menu> eligibleSpec = Specification.where(MenuSpecification.notSoldOut())
                .and(MenuSpecification.excludeCategoryNames(RECOMMEND_EXCLUDED_CATEGORIES));
        Set<Long> eligibleMenuIds = menuRepository.findAll(eligibleSpec).stream()
                .map(Menu::getMenuId)
                .collect(Collectors.toSet());
        if (eligibleMenuIds.isEmpty()) return null;

        List<TopMenuResponse> topSales = salesDailyRepository.findTopMenusByDate(LocalDate.now(), PageRequest.of(0, 20));
        return topSales.stream()
                .map(TopMenuResponse::menuId)
                .filter(eligibleMenuIds::contains)
                .findFirst()
                // 오늘 판매 데이터가 없으면 후보 중 menuId 최소값으로 폴백
                // (목록/검색/상세/홈추천이 모두 같은 메뉴를 베스트셀러로 라벨하도록 단일 소스 유지)
                .orElseGet(() -> eligibleMenuIds.stream().min(Comparator.naturalOrder()).orElse(null));
    }

    // 오늘의 베스트셀러라면 isRecommended=true + 추천 이유를 부여하고, 아니면 DB의 기존 값을 그대로 반환
    private MenuResponse toMenuResponseWithBestSellerLabel(Menu menu, Long bestSellerMenuId) {
        if (bestSellerMenuId != null && menu.getMenuId().equals(bestSellerMenuId)) {
            return MenuResponse.ofRecommendation(menu, true, BEST_SELLER_REASON);
        }
        return MenuResponse.from(menu);
    }
}
