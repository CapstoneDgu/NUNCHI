package dgu.capstone.nunchi.domain.admin.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "관리자 TOP 판매 메뉴 응답 DTO")
public record AdminTopMenuSalesResponse(

        @Schema(description = "메뉴 ID", example = "1")
        Long menuId,

        @Schema(description = "메뉴명", example = "제육덮밥")
        String menuName,

        @Schema(description = "판매 수량", example = "24")
        Long quantitySold,

        @Schema(description = "매출", example = "204000")
        Long salesAmount
) {
}