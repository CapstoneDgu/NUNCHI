package dgu.capstone.nunchi.domain.admin.controller;

import dgu.capstone.nunchi.domain.admin.dto.request.AdminOrderStatusUpdateRequest;
import dgu.capstone.nunchi.domain.admin.dto.response.AdminOrderDetailResponse;
import dgu.capstone.nunchi.domain.admin.dto.response.AdminOrderResponse;
import dgu.capstone.nunchi.domain.admin.service.AdminOrderService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "관리자 주문 API", description = "관리자페이지에서 주문 목록, 주문 상세, 주문 상태를 관리하는 API입니다.")
@RestController
@RequestMapping("/api/admin/orders")
@RequiredArgsConstructor
public class AdminOrderController {

    private final AdminOrderService adminOrderService;

    @Operation(
            summary = "관리자 주문 목록 조회",
            description = "관리자페이지에서 전체 주문 목록을 조회합니다. 주문 ID, 세션 ID, 총 주문 금액, 주문 상태, 주문 상품 개수, 주문 생성 시간을 반환합니다."
    )
    @GetMapping
    public List<AdminOrderResponse> getOrders() {
        return adminOrderService.getOrders();
    }

    @Operation(
            summary = "관리자 주문 상세 조회",
            description = "주문 ID를 기준으로 주문 상세 정보와 주문 상품 목록을 조회합니다."
    )
    @GetMapping("/{orderId}")
    public AdminOrderDetailResponse getOrder(
            @Parameter(description = "조회할 주문 ID", example = "1")
            @PathVariable Long orderId
    ) {
        return adminOrderService.getOrder(orderId);
    }

    @Operation(
            summary = "관리자 주문 상태 변경",
            description = "주문 ID를 기준으로 주문 상태를 변경합니다. 가능한 상태값은 PENDING, COMPLETED, CANCELLED입니다."
    )
    @PatchMapping("/{orderId}/status")
    public AdminOrderDetailResponse updateOrderStatus(
            @Parameter(description = "상태를 변경할 주문 ID", example = "1")
            @PathVariable Long orderId,
            @Valid @RequestBody AdminOrderStatusUpdateRequest request
    ) {
        return adminOrderService.updateOrderStatus(orderId, request);
    }
}