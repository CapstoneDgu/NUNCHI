package dgu.capstone.nunchi.domain.admin.dto.response;

import dgu.capstone.nunchi.domain.menu.entity.Menu;
import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "관리자 메뉴 응답 DTO")
public record AdminMenuResponse(

        @Schema(description = "메뉴 ID", example = "1")
        Long menuId,

        @Schema(description = "메뉴명", example = "제육덮밥")
        String name,

        @Schema(description = "메뉴 가격", example = "8500")
        Integer price,

        @Schema(description = "품절 여부", example = "false")
        Boolean isSoldOut,

        @Schema(description = "메뉴 이미지 URL", example = "https://example.com/jeyuk.jpg")
        String imageUrl,

        @Schema(description = "기본 추천 여부", example = "true")
        Boolean isRecommended,

        @Schema(description = "카테고리 ID", example = "1")
        Long categoryId,

        @Schema(description = "카테고리명", example = "덮밥류")
        String categoryName
) {

    public static AdminMenuResponse from(Menu menu) {
        return new AdminMenuResponse(
                menu.getMenuId(),
                menu.getName(),
                menu.getPrice(),
                menu.getIsSoldOut(),
                menu.getImageUrl(),
                menu.getIsRecommended(),
                menu.getCategory().getCategoryId(),
                menu.getCategory().getName()
        );
    }
}