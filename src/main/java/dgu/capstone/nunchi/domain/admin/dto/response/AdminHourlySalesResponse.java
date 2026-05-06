package dgu.capstone.nunchi.domain.admin.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "관리자 시간대별 매출 응답 DTO")
public record AdminHourlySalesResponse(

        @Schema(description = "시간대", example = "12")
        Integer hour,

        @Schema(description = "주문 수", example = "8")
        Long orderCount,

        @Schema(description = "매출", example = "72000")
        Integer salesAmount
) {
}