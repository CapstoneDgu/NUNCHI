package dgu.capstone.nunchi.domain.menu.controller;

import dgu.capstone.nunchi.domain.menu.dto.response.MenuCategoryResponse;
import dgu.capstone.nunchi.domain.menu.dto.response.MenuDetailResponse;
import dgu.capstone.nunchi.domain.menu.dto.response.MenuResponse;
import dgu.capstone.nunchi.domain.menu.service.MenuService;
import dgu.capstone.nunchi.global.response.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/menus")
@RequiredArgsConstructor
public class MenuController {

    private final MenuService menuService;

    // 전체 카테고리 조회
    @GetMapping("/categories")
    public ResponseEntity<ApiResponse<List<MenuCategoryResponse>>> getCategories() {
        return ResponseEntity.ok(ApiResponse.ok(menuService.getCategories()));
    }

    // 메뉴 목록 조회 (categoryId 파라미터 없으면 전체 조회)
    @GetMapping
    public ResponseEntity<ApiResponse<List<MenuResponse>>> getMenus(
            @RequestParam(required = false) Long categoryId
    ) {
        return ResponseEntity.ok(ApiResponse.ok(menuService.getMenus(categoryId)));
    }

    // 메뉴 상세 조회 (옵션 포함)
    @GetMapping("/{menuId}")
    public ResponseEntity<ApiResponse<MenuDetailResponse>> getMenuDetail(
            @PathVariable Long menuId
    ) {
        return ResponseEntity.ok(ApiResponse.ok(menuService.getMenuDetail(menuId)));
    }
}
