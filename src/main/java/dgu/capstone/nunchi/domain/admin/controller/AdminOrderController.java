package dgu.capstone.nunchi.domain.admin.controller;

import dgu.capstone.nunchi.domain.admin.dto.request.AdminOrderStatusUpdateRequest;
import dgu.capstone.nunchi.domain.admin.dto.response.AdminOrderDetailResponse;
import dgu.capstone.nunchi.domain.admin.dto.response.AdminOrderResponse;
import dgu.capstone.nunchi.domain.admin.service.AdminOrderService;
import dgu.capstone.nunchi.global.response.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "관리자 주문 API", description = "관리자페이지에서 주문 목록, 주문 상세, 주문 상태를 관리하는 API입니다.")
@RestController
@RequestMapping("/api/admin/orders")
@RequiredArgsConstructor
public class AdminOrderController {

    private final AdminOrderService adminOrderService;

    @Operation(summary = "관리자 주문 목록 조회", description = "관리자페이지에서 전체 주문 목록을 조회합니다.")
    @GetMapping
    public ResponseEntity<ApiResponse<List<AdminOrderResponse>>> getOrders() {
        return ResponseEntity.ok(ApiResponse.ok(adminOrderService.getOrders()));
    }

    @Operation(summary = "관리자 주문 상세 조회", description = "주문 ID를 기준으로 주문 상세 정보와 주문 상품 목록을 조회합니다.")
    @GetMapping("/{orderId}")
    public ResponseEntity<ApiResponse<AdminOrderDetailResponse>> getOrder(
            @Parameter(description = "조회할 주문 ID", example = "1")
            @PathVariable Long orderId
    ) {
        return ResponseEntity.ok(ApiResponse.ok(adminOrderService.getOrder(orderId)));
    }

    @Operation(summary = "관리자 주문 상태 변경", description = "주문 ID를 기준으로 주문 상태를 변경합니다.")
    @PatchMapping("/{orderId}/status")
    public ResponseEntity<ApiResponse<AdminOrderDetailResponse>> updateOrderStatus(
            @Parameter(description = "상태를 변경할 주문 ID", example = "1")
            @PathVariable Long orderId,
            @Valid @RequestBody AdminOrderStatusUpdateRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.ok(adminOrderService.updateOrderStatus(orderId, request)));
    }
}