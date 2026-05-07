package dgu.capstone.nunchi.domain.admin.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDate;

@Schema(description = "관리자 일별 매출 응답 DTO")
public record AdminDailySalesResponse(

        @Schema(description = "날짜", example = "2026-05-06")
        LocalDate date,

        @Schema(description = "주문 수", example = "12")
        Long orderCount,

        @Schema(description = "매출", example = "96000")
        Integer salesAmount
) {
}