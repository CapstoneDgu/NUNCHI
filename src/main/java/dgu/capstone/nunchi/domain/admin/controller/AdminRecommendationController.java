package dgu.capstone.nunchi.domain.admin.controller;

import dgu.capstone.nunchi.domain.admin.dto.response.AdminPopularMenuResponse;
import dgu.capstone.nunchi.domain.admin.dto.response.AdminRecommendedMenuResponse;
import dgu.capstone.nunchi.domain.admin.service.AdminRecommendationService;
import dgu.capstone.nunchi.global.response.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@SecurityRequirement(name = "Bearer Authentication")
@Tag(name = "관리자 추천 API", description = "관리자페이지에서 기본 추천 메뉴와 인기 메뉴 현황을 조회하는 API입니다.")
@RestController
@RequestMapping("/api/admin/recommendations")
@RequiredArgsConstructor
public class AdminRecommendationController {

    private final AdminRecommendationService adminRecommendationService;

    @Operation(
            summary = "관리자 기본 추천 메뉴 조회",
            description = "관리자가 추천 메뉴로 설정한 메뉴 목록을 조회합니다. 품절 메뉴는 제외됩니다."
    )
    @GetMapping("/default")
    public ResponseEntity<ApiResponse<List<AdminRecommendedMenuResponse>>> getDefaultRecommendations() {
        return ResponseEntity.ok(
                ApiResponse.ok(adminRecommendationService.getDefaultRecommendations())
        );
    }

    @Operation(
            summary = "관리자 오늘 인기 메뉴 조회",
            description = "SalesDaily 통계 데이터를 기준으로 오늘 가장 많이 판매된 메뉴를 조회합니다."
    )
    @GetMapping("/popular/today")
    public ResponseEntity<ApiResponse<List<AdminPopularMenuResponse>>> getTodayPopularMenus() {
        return ResponseEntity.ok(
                ApiResponse.ok(adminRecommendationService.getTodayPopularMenus())
        );
    }

    @Operation(
            summary = "관리자 주문 기반 인기 메뉴 조회",
            description = "OrderItem 주문 데이터를 기준으로 누적 인기 메뉴를 조회합니다."
    )
    @GetMapping("/popular/orders")
    public ResponseEntity<ApiResponse<List<AdminPopularMenuResponse>>> getOrderBasedPopularMenus() {
        return ResponseEntity.ok(
                ApiResponse.ok(adminRecommendationService.getOrderBasedPopularMenus())
        );
    }
}