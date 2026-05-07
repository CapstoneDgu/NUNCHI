package dgu.capstone.nunchi.domain.admin.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

@Schema(description = "관리자 대시보드 운영 분석 응답 DTO")
public record AdminDashboardAnalyticsResponse(

        @Schema(description = "최근 7일 매출 추이")
        List<AdminDailySalesResponse> dailySales,

        @Schema(description = "오늘 시간대별 주문/매출")
        List<AdminHourlySalesResponse> hourlySales,

        @Schema(description = "TOP 5 판매 메뉴")
        List<AdminTopMenuSalesResponse> topMenus
) {
}