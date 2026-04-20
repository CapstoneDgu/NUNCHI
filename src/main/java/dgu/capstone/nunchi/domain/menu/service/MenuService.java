package dgu.capstone.nunchi.domain.menu.service;

import dgu.capstone.nunchi.domain.menu.dto.response.MenuCategoryResponse;
import dgu.capstone.nunchi.domain.menu.dto.response.MenuDetailResponse;
import dgu.capstone.nunchi.domain.menu.dto.response.MenuResponse;
import dgu.capstone.nunchi.domain.menu.dto.response.TopMenuResponse;
import dgu.capstone.nunchi.domain.menu.entity.Menu;
import dgu.capstone.nunchi.domain.menu.entity.MenuOption;
import dgu.capstone.nunchi.domain.menu.entity.MenuOptionGroup;
import dgu.capstone.nunchi.domain.menu.repository.MenuCategoryRepository;
import dgu.capstone.nunchi.domain.menu.repository.MenuOptionGroupRepository;
import dgu.capstone.nunchi.domain.menu.repository.MenuOptionRepository;
import dgu.capstone.nunchi.domain.menu.repository.MenuRepository;
import dgu.capstone.nunchi.domain.menu.repository.SalesDailyRepository;
import dgu.capstone.nunchi.global.exception.domainException.MenuException;
import dgu.capstone.nunchi.global.exception.errorcode.MenuErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

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
