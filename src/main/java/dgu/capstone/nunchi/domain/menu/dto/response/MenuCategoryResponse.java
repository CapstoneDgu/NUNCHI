package dgu.capstone.nunchi.domain.menu.dto.response;

import dgu.capstone.nunchi.domain.menu.entity.MenuCategory;

public record MenuCategoryResponse(Long categoryId, String name) {

    public static MenuCategoryResponse from(MenuCategory category) {
        return new MenuCategoryResponse(
                category.getCategoryId(),
                category.getName()
        );
    }
}
