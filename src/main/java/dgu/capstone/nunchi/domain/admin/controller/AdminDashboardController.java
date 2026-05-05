package dgu.capstone.nunchi.domain.admin.controller;

import dgu.capstone.nunchi.domain.admin.dto.response.AdminDashboardResponse;
import dgu.capstone.nunchi.domain.admin.service.AdminDashboardService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@Tag(name = "관리자 대시보드 API", description = "관리자페이지 메인 화면에서 운영 현황 요약 정보를 조회하는 API입니다.")
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
    public AdminDashboardResponse getDashboard() {
        return adminDashboardService.getDashboard();
    }
}