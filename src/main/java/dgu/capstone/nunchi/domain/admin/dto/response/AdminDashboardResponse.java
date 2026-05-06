package dgu.capstone.nunchi.domain.admin.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

@Schema(description = "관리자 대시보드 응답 DTO")
public record AdminDashboardResponse(

        @Schema(description = "오늘 주문 수", example = "12")
        Long todayOrderCount,

        @Schema(description = "오늘 매출", example = "96000")
        Integer todaySalesAmount,

        @Schema(description = "전체 주문 수", example = "154")
        Long totalOrderCount,

        @Schema(description = "품절 메뉴 수", example = "3")
        Long soldOutMenuCount,

        @Schema(description = "추천 메뉴 수", example = "5")
        Long recommendedMenuCount,

        @Schema(description = "최근 주문 목록")
        List<AdminOrderResponse> recentOrders
) {
}