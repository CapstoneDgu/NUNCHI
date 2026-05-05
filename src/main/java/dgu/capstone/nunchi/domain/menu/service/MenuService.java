package dgu.capstone.nunchi.domain.menu.service;

import dgu.capstone.nunchi.domain.menu.dto.request.MenuFilterRequest;
import dgu.capstone.nunchi.domain.menu.dto.request.MenuSearchRequest;
import dgu.capstone.nunchi.domain.menu.dto.response.MenuCategoryResponse;
import dgu.capstone.nunchi.domain.menu.dto.response.MenuDetailResponse;
import dgu.capstone.nunchi.domain.menu.dto.response.MenuFilterResponse;
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
import java.util.Arrays;
import java.util.List;
import java.util.Map;
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

    // 전체 카테고리 조회
    public List<MenuCategoryResponse> getCategories() {
        return menuCategoryRepository.findAll().stream()
                .map(MenuCategoryResponse::from)
                .toList();
    }

    // 메뉴 목록 조회 (categoryId 없으면 전체, 있으면 해당 카테고리 필터)
    public List<MenuResponse> getMenus(Long categoryId) {
        List<Menu> menus = (categoryId == null)
                ? menuRepository.findAll()
                : menuRepository.findByCategory_CategoryId(categoryId);

        return menus.stream()
                .map(MenuResponse::from)
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
        if (request.name() == null || request.name().isBlank()) {
            throw new MenuException(MenuErrorCode.INVALID_SEARCH_KEYWORD);
        }
        Specification<Menu> spec = Specification.where(MenuSpecification.notSoldOut())
                .and(MenuSpecification.fetchCategory())
                .and(MenuSpecification.nameContains(request.name()));
        return menuRepository.findAll(spec).stream()
                .map(MenuResponse::from)
                .toList();
    }

    // 메뉴 상세 조회 (옵션그룹 + 옵션 포함, N+1 방지)
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

        return MenuDetailResponse.from(menu, groups, optionsByGroupId);
    }
}
