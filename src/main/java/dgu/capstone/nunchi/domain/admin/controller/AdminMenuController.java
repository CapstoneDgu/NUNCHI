package dgu.capstone.nunchi.domain.admin.controller;

import dgu.capstone.nunchi.domain.admin.dto.request.AdminMenuCreateRequest;
import dgu.capstone.nunchi.domain.admin.dto.request.AdminMenuRecommendedUpdateRequest;
import dgu.capstone.nunchi.domain.admin.dto.request.AdminMenuSoldOutUpdateRequest;
import dgu.capstone.nunchi.domain.admin.dto.request.AdminMenuUpdateRequest;
import dgu.capstone.nunchi.domain.admin.dto.response.AdminMenuResponse;
import dgu.capstone.nunchi.domain.admin.service.AdminMenuService;
import dgu.capstone.nunchi.global.response.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@SecurityRequirement(name = "Bearer Authentication")
@Tag(name = "관리자 메뉴 API", description = "관리자페이지에서 메뉴를 조회, 등록, 수정, 삭제하고 품절/추천 상태를 관리하는 API입니다.")
@RestController
@RequestMapping("/api/admin/menus")
@RequiredArgsConstructor
public class AdminMenuController {

    private final AdminMenuService adminMenuService;

    @Operation(summary = "관리자 메뉴 목록 조회", description = "관리자페이지에서 전체 메뉴 목록을 조회합니다.")
    @GetMapping
    public ResponseEntity<ApiResponse<List<AdminMenuResponse>>> getMenus() {
        return ResponseEntity.ok(ApiResponse.ok(adminMenuService.getMenus()));
    }

    @Operation(summary = "관리자 메뉴 단건 조회", description = "메뉴 ID를 기준으로 특정 메뉴 정보를 조회합니다.")
    @GetMapping("/{menuId}")
    public ResponseEntity<ApiResponse<AdminMenuResponse>> getMenu(
            @Parameter(description = "조회할 메뉴 ID", example = "1")
            @PathVariable Long menuId
    ) {
        return ResponseEntity.ok(ApiResponse.ok(adminMenuService.getMenu(menuId)));
    }

    @Operation(summary = "관리자 메뉴 등록", description = "새로운 메뉴를 등록합니다.")
    @PostMapping
    public ResponseEntity<ApiResponse<AdminMenuResponse>> createMenu(
            @Valid @RequestBody AdminMenuCreateRequest request
    ) {
        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(ApiResponse.created(adminMenuService.createMenu(request)));
    }

    @Operation(summary = "관리자 메뉴 수정", description = "기존 메뉴의 메뉴명, 가격, 이미지 URL, 카테고리를 수정합니다.")
    @PatchMapping("/{menuId}")
    public ResponseEntity<ApiResponse<AdminMenuResponse>> updateMenu(
            @Parameter(description = "수정할 메뉴 ID", example = "1")
            @PathVariable Long menuId,
            @Valid @RequestBody AdminMenuUpdateRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.ok(adminMenuService.updateMenu(menuId, request)));
    }

    @Operation(summary = "메뉴 품절 상태 변경", description = "특정 메뉴의 품절 여부를 변경합니다.")
    @PatchMapping("/{menuId}/sold-out")
    public ResponseEntity<ApiResponse<AdminMenuResponse>> updateSoldOut(
            @Parameter(description = "품절 상태를 변경할 메뉴 ID", example = "1")
            @PathVariable Long menuId,
            @Valid @RequestBody AdminMenuSoldOutUpdateRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.ok(adminMenuService.updateSoldOut(menuId, request)));
    }

    @Operation(summary = "메뉴 추천 상태 변경", description = "특정 메뉴의 기본 추천 여부를 변경합니다.")
    @PatchMapping("/{menuId}/recommended")
    public ResponseEntity<ApiResponse<AdminMenuResponse>> updateRecommended(
            @Parameter(description = "추천 상태를 변경할 메뉴 ID", example = "1")
            @PathVariable Long menuId,
            @Valid @RequestBody AdminMenuRecommendedUpdateRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.ok(adminMenuService.updateRecommended(menuId, request)));
    }

    @Operation(summary = "관리자 메뉴 삭제", description = "메뉴 ID를 기준으로 메뉴를 삭제합니다.")
    @DeleteMapping("/{menuId}")
    public ResponseEntity<Void> deleteMenu(
            @Parameter(description = "삭제할 메뉴 ID", example = "1")
            @PathVariable Long menuId
    ) {
        adminMenuService.deleteMenu(menuId);
        return ResponseEntity.noContent().build();
    }
}