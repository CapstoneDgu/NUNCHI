package dgu.capstone.nunchi.domain.menu.controller;

import dgu.capstone.nunchi.domain.menu.dto.response.MenuCategoryResponse;
import dgu.capstone.nunchi.domain.menu.dto.response.MenuDetailResponse;
import dgu.capstone.nunchi.domain.menu.dto.response.MenuResponse;
import dgu.capstone.nunchi.domain.menu.dto.response.TopMenuResponse;
import dgu.capstone.nunchi.domain.menu.service.MenuService;
import dgu.capstone.nunchi.global.response.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "Menu", description = "메뉴 조회 API")
@RestController
@RequestMapping("/api/menus")
@RequiredArgsConstructor
public class MenuController {

    private final MenuService menuService;

    @Operation(summary = "오늘 판매량 상위 메뉴 조회", description = "오늘 날짜 기준 판매량 합산 후 내림차순 상위 N개 반환")
    @GetMapping("/top")
    public ResponseEntity<ApiResponse<List<TopMenuResponse>>> getTopMenus(
            @Parameter(description = "조회할 메뉴 수") @RequestParam(defaultValue = "5") int limit
    ) {
        return ResponseEntity.ok(ApiResponse.ok(menuService.getTopMenus(limit)));
    }

    @Operation(summary = "카테고리 목록 조회")
    @GetMapping("/categories")
    public ResponseEntity<ApiResponse<List<MenuCategoryResponse>>> getCategories() {
        return ResponseEntity.ok(ApiResponse.ok(menuService.getCategories()));
    }

    @Operation(summary = "메뉴 목록 조회", description = "categoryId 없으면 전체 조회")
    @GetMapping
    public ResponseEntity<ApiResponse<List<MenuResponse>>> getMenus(
            @Parameter(description = "카테고리 ID (선택)") @RequestParam(required = false) Long categoryId
    ) {
        return ResponseEntity.ok(ApiResponse.ok(menuService.getMenus(categoryId)));
    }

    @Operation(summary = "메뉴 상세 조회", description = "옵션그룹 및 옵션 포함")
    @GetMapping("/{menuId}")
    public ResponseEntity<ApiResponse<MenuDetailResponse>> getMenuDetail(
            @Parameter(description = "메뉴 ID") @PathVariable Long menuId
    ) {
        return ResponseEntity.ok(ApiResponse.ok(menuService.getMenuDetail(menuId)));
    }
}
