package dgu.capstone.nunchi.domain.admin.controller;

import dgu.capstone.nunchi.domain.admin.dto.request.AdminMenuCreateRequest;
import dgu.capstone.nunchi.domain.admin.dto.request.AdminMenuRecommendedUpdateRequest;
import dgu.capstone.nunchi.domain.admin.dto.request.AdminMenuSoldOutUpdateRequest;
import dgu.capstone.nunchi.domain.admin.dto.request.AdminMenuUpdateRequest;
import dgu.capstone.nunchi.domain.admin.dto.response.AdminMenuResponse;
import dgu.capstone.nunchi.domain.admin.service.AdminMenuService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "관리자 메뉴 API", description = "관리자페이지에서 메뉴를 조회, 등록, 수정, 삭제하고 품절/추천 상태를 관리하는 API입니다.")
@RestController
@RequestMapping("/api/admin/menus")
@RequiredArgsConstructor
public class AdminMenuController {

    private final AdminMenuService adminMenuService;

    @Operation(
            summary = "관리자 메뉴 목록 조회",
            description = "관리자페이지에서 전체 메뉴 목록을 조회합니다. 메뉴명, 가격, 이미지 URL, 카테고리, 품절 여부, 추천 여부를 함께 반환합니다."
    )
    @GetMapping
    public List<AdminMenuResponse> getMenus() {
        return adminMenuService.getMenus();
    }

    @Operation(
            summary = "관리자 메뉴 단건 조회",
            description = "메뉴 ID를 기준으로 특정 메뉴의 상세 정보를 조회합니다."
    )
    @GetMapping("/{menuId}")
    public AdminMenuResponse getMenu(
            @Parameter(description = "조회할 메뉴 ID", example = "1")
            @PathVariable Long menuId
    ) {
        return adminMenuService.getMenu(menuId);
    }

    @Operation(
            summary = "관리자 메뉴 등록",
            description = "새로운 메뉴를 등록합니다. 메뉴명, 가격, 이미지 URL, 카테고리 ID, 품절 여부, 추천 여부를 입력받습니다."
    )
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public AdminMenuResponse createMenu(
            @Valid @RequestBody AdminMenuCreateRequest request
    ) {
        return adminMenuService.createMenu(request);
    }

    @Operation(
            summary = "관리자 메뉴 수정",
            description = "기존 메뉴의 메뉴명, 가격, 이미지 URL, 카테고리를 수정합니다. 품절 여부와 추천 여부는 별도 API에서 변경합니다."
    )
    @PatchMapping("/{menuId}")
    public AdminMenuResponse updateMenu(
            @Parameter(description = "수정할 메뉴 ID", example = "1")
            @PathVariable Long menuId,
            @Valid @RequestBody AdminMenuUpdateRequest request
    ) {
        return adminMenuService.updateMenu(menuId, request);
    }

    @Operation(
            summary = "메뉴 품절 상태 변경",
            description = "특정 메뉴의 품절 여부를 변경합니다. 품절 처리된 메뉴는 키오스크 메뉴 조회 및 추천 결과에서 제외될 수 있습니다."
    )
    @PatchMapping("/{menuId}/sold-out")
    public AdminMenuResponse updateSoldOut(
            @Parameter(description = "품절 상태를 변경할 메뉴 ID", example = "1")
            @PathVariable Long menuId,
            @Valid @RequestBody AdminMenuSoldOutUpdateRequest request
    ) {
        return adminMenuService.updateSoldOut(menuId, request);
    }

    @Operation(
            summary = "메뉴 추천 상태 변경",
            description = "특정 메뉴의 기본 추천 여부를 변경합니다. 추천 상태가 true인 메뉴는 기본 추천 메뉴 조회에 활용됩니다."
    )
    @PatchMapping("/{menuId}/recommended")
    public AdminMenuResponse updateRecommended(
            @Parameter(description = "추천 상태를 변경할 메뉴 ID", example = "1")
            @PathVariable Long menuId,
            @Valid @RequestBody AdminMenuRecommendedUpdateRequest request
    ) {
        return adminMenuService.updateRecommended(menuId, request);
    }

    @Operation(
            summary = "관리자 메뉴 삭제",
            description = "메뉴 ID를 기준으로 메뉴를 삭제합니다. 추후 운영 안정성을 위해 실제 삭제 대신 비활성화 방식으로 변경할 수 있습니다."
    )
    @DeleteMapping("/{menuId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteMenu(
            @Parameter(description = "삭제할 메뉴 ID", example = "1")
            @PathVariable Long menuId
    ) {
        adminMenuService.deleteMenu(menuId);
    }
}