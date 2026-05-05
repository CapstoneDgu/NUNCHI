package dgu.capstone.nunchi.domain.admin.service;

import dgu.capstone.nunchi.domain.admin.dto.request.AdminMenuCreateRequest;
import dgu.capstone.nunchi.domain.admin.dto.request.AdminMenuRecommendedUpdateRequest;
import dgu.capstone.nunchi.domain.admin.dto.request.AdminMenuSoldOutUpdateRequest;
import dgu.capstone.nunchi.domain.admin.dto.request.AdminMenuUpdateRequest;
import dgu.capstone.nunchi.domain.admin.dto.response.AdminMenuResponse;
import dgu.capstone.nunchi.domain.menu.entity.Menu;
import dgu.capstone.nunchi.domain.menu.entity.MenuCategory;
import dgu.capstone.nunchi.domain.menu.repository.MenuCategoryRepository;
import dgu.capstone.nunchi.domain.menu.repository.MenuRepository;
import dgu.capstone.nunchi.global.exception.domainException.MenuException;
import dgu.capstone.nunchi.global.exception.errorcode.MenuErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AdminMenuService {

    private final MenuRepository menuRepository;
    private final MenuCategoryRepository menuCategoryRepository;

    public List<AdminMenuResponse> getMenus() {
        return menuRepository.findAll()
                .stream()
                .map(AdminMenuResponse::from)
                .toList();
    }

    public AdminMenuResponse getMenu(Long menuId) {
        Menu menu = findMenu(menuId);
        return AdminMenuResponse.from(menu);
    }

    @Transactional
    public AdminMenuResponse createMenu(AdminMenuCreateRequest request) {
        MenuCategory category = findCategory(request.categoryId());

        Menu menu = Menu.create(
                request.name(),
                request.price(),
                request.imageUrl(),
                category
        );

        if (Boolean.TRUE.equals(request.isSoldOut())) {
            menu.markSoldOut();
        }

        if (Boolean.TRUE.equals(request.isRecommended())) {
            menu.updateRecommended(true);
        }

        Menu savedMenu = menuRepository.save(menu);
        return AdminMenuResponse.from(savedMenu);
    }

    @Transactional
    public AdminMenuResponse updateMenu(Long menuId, AdminMenuUpdateRequest request) {
        Menu menu = findMenu(menuId);
        MenuCategory category = findCategory(request.categoryId());

        menu.updateMenu(
                request.name(),
                request.price(),
                request.imageUrl(),
                category
        );

        return AdminMenuResponse.from(menu);
    }

    @Transactional
    public AdminMenuResponse updateSoldOut(Long menuId, AdminMenuSoldOutUpdateRequest request) {
        Menu menu = findMenu(menuId);

        if (Boolean.TRUE.equals(request.isSoldOut())) {
            menu.markSoldOut();
        } else {
            menu.markAvailable();
        }

        return AdminMenuResponse.from(menu);
    }

    @Transactional
    public AdminMenuResponse updateRecommended(Long menuId, AdminMenuRecommendedUpdateRequest request) {
        Menu menu = findMenu(menuId);
        menu.updateRecommended(request.isRecommended());

        return AdminMenuResponse.from(menu);
    }

    @Transactional
    public void deleteMenu(Long menuId) {
        Menu menu = findMenu(menuId);
        menuRepository.delete(menu);
    }

    private Menu findMenu(Long menuId) {
        return menuRepository.findById(menuId)
                .orElseThrow(() -> new MenuException(MenuErrorCode.NOT_FOUND_MENU));
    }

    private MenuCategory findCategory(Long categoryId) {
        return menuCategoryRepository.findById(categoryId)
                .orElseThrow(() -> new MenuException(MenuErrorCode.NOT_FOUND_MENU_CATEGORY));
    }
}