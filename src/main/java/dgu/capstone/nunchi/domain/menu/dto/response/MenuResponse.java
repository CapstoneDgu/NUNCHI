package dgu.capstone.nunchi.domain.menu.dto.response;

import dgu.capstone.nunchi.domain.menu.entity.Menu;

public record MenuResponse(Long menuId, String name, Integer price, Boolean isSoldOut, String imageUrl) {

    public static MenuResponse from(Menu menu) {
        return new MenuResponse(
                menu.getMenuId(),
                menu.getName(),
                menu.getPrice(),
                menu.getIsSoldOut(),
                menu.getImageUrl()
        );
    }
}
