package dgu.capstone.nunchi.domain.admin.controller;

import dgu.capstone.nunchi.domain.admin.dto.response.AdminDashboardAnalyticsResponse;
import dgu.capstone.nunchi.domain.admin.dto.response.AdminDashboardResponse;
import dgu.capstone.nunchi.domain.admin.service.AdminDashboardService;
import dgu.capstone.nunchi.global.response.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@SecurityRequirement(name = "Bearer Authentication")
@Tag(name = "관리자 대시보드 API", description = "관리자페이지 메인 화면에서 운영 현황 요약 및 분석 정보를 조회하는 API입니다.")
@RestController
@RequestMapping("/api/admin/dashboard")
@RequiredArgsConstructor
public class AdminDashboardController {

    private final AdminDashboardService adminDashboardService;

    @Operation(
            summary = "관리자 대시보드 조회",
            description = "오늘 주문 수, 오늘 매출, 전체 주문 수, 품절 메뉴 수, 추천 메뉴 수, 최근 주문 목록을 조회합니다."
    )
    @GetMapping
    public ResponseEntity<ApiResponse<AdminDashboardResponse>> getDashboard() {
        return ResponseEntity.ok(ApiResponse.ok(adminDashboardService.getDashboard()));
    }

    @Operation(
            summary = "관리자 대시보드 운영 분석 조회",
            description = "최근 7일 매출 추이, 오늘 시간대별 주문/매출, TOP 5 판매 메뉴를 조회합니다."
    )
    @GetMapping("/analytics")
    public ResponseEntity<ApiResponse<AdminDashboardAnalyticsResponse>> getDashboardAnalytics() {
        return ResponseEntity.ok(ApiResponse.ok(adminDashboardService.getDashboardAnalytics()));
    }
}