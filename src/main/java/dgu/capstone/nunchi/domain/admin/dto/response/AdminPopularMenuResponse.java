package dgu.capstone.nunchi.domain.admin.dto.response;

import dgu.capstone.nunchi.domain.menu.dto.response.TopMenuResponse;
import dgu.capstone.nunchi.domain.menu.entity.Menu;
import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "관리자 인기 메뉴 응답 DTO")
public record AdminPopularMenuResponse(

        @Schema(description = "메뉴 ID", example = "1")
        Long menuId,

        @Schema(description = "메뉴명", example = "제육덮밥")
        String name,

        @Schema(description = "가격", example = "8500")
        Integer price,

        @Schema(description = "품절 여부", example = "false")
        Boolean isSoldOut,

        @Schema(description = "판매 수량", example = "12")
        Long totalQuantity
) {

    public static AdminPopularMenuResponse fromTopMenuResponse(TopMenuResponse topMenuResponse) {
        return new AdminPopularMenuResponse(
                topMenuResponse.menuId(),
                topMenuResponse.name(),
                topMenuResponse.price(),
                topMenuResponse.isSoldOut(),
                topMenuResponse.quantitySold()
        );
    }

    public static AdminPopularMenuResponse fromMenu(Menu menu) {
        return new AdminPopularMenuResponse(
                menu.getMenuId(),
                menu.getName(),
                menu.getPrice(),
                menu.getIsSoldOut(),
                null
        );
    }
}