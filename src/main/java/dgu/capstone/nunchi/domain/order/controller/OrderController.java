package dgu.capstone.nunchi.domain.order.controller;

import dgu.capstone.nunchi.domain.order.dto.request.CartItemAddRequest;
import dgu.capstone.nunchi.domain.order.dto.request.CartItemUpdateRequest;
import dgu.capstone.nunchi.domain.order.dto.response.CartResponse;
import dgu.capstone.nunchi.domain.order.dto.response.OrderResponse;
import dgu.capstone.nunchi.domain.order.service.OrderService;
import dgu.capstone.nunchi.global.response.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@Tag(name = "Order", description = "주문/장바구니 API")
@RestController
@RequestMapping("/api/orders")
@RequiredArgsConstructor
public class OrderController {

    private final OrderService orderService;

    @Operation(summary = "장바구니 조회", description = "세션 ID로 Redis 장바구니를 조회합니다.")
    @GetMapping("/cart/{sessionId}")
    public ResponseEntity<ApiResponse<CartResponse>> getCart(
            @Parameter(description = "세션 ID") @PathVariable Long sessionId
    ) {
        return ResponseEntity.ok(ApiResponse.ok(orderService.getCart(sessionId)));
    }

    @Operation(summary = "장바구니 아이템 추가", description = "장바구니에 메뉴 아이템(옵션 포함)을 추가합니다.")
    @PostMapping("/cart/items")
    public ResponseEntity<ApiResponse<CartResponse>> addItem(
            @RequestBody @Valid CartItemAddRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.ok(orderService.addItem(request)));
    }

    @Operation(summary = "장바구니 아이템 수량 수정", description = "장바구니 아이템의 수량을 변경합니다.")
    @PutMapping("/cart/{sessionId}/items/{itemId}")
    public ResponseEntity<ApiResponse<CartResponse>> updateItem(
            @Parameter(description = "세션 ID") @PathVariable Long sessionId,
            @Parameter(description = "아이템 UUID") @PathVariable String itemId,
            @RequestBody @Valid CartItemUpdateRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.ok(orderService.updateItem(sessionId, itemId, request)));
    }

    @Operation(summary = "장바구니 아이템 삭제", description = "장바구니에서 아이템을 제거합니다.")
    @DeleteMapping("/cart/{sessionId}/items/{itemId}")
    public ResponseEntity<ApiResponse<CartResponse>> removeItem(
            @Parameter(description = "세션 ID") @PathVariable Long sessionId,
            @Parameter(description = "아이템 UUID") @PathVariable String itemId
    ) {
        return ResponseEntity.ok(ApiResponse.ok(orderService.removeItem(sessionId, itemId)));
    }

    @Operation(summary = "주문 확정", description = "Redis 장바구니를 PostgreSQL에 최종 주문으로 저장합니다.")
    @PostMapping("/confirm")
    public ResponseEntity<ApiResponse<OrderResponse>> confirmOrder(
            @RequestBody @Valid OrderConfirmRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.ok(orderService.confirmOrder(request.sessionId())));
    }

    @Operation(summary = "장바구니 전체 비우기", description = "세션의 Redis 장바구니를 전체 초기화합니다. 루프백 재시작 또는 세션 취소 시 사용.")
    @DeleteMapping("/cart/{sessionId}")
    public ResponseEntity<ApiResponse<Void>> clearCart(
            @Parameter(description = "세션 ID") @PathVariable Long sessionId
    ) {
        orderService.clearCart(sessionId);
        return ResponseEntity.ok(ApiResponse.noContent());
    }

    @Operation(summary = "주문 취소", description = "주문을 취소 상태로 변경합니다.")
    @PatchMapping("/{orderId}/cancel")
    public ResponseEntity<ApiResponse<OrderResponse>> cancelOrder(
            @Parameter(description = "주문 ID") @PathVariable Long orderId
    ) {
        return ResponseEntity.ok(ApiResponse.ok(orderService.cancelOrder(orderId)));
    }

    /** 주문 확정 요청 DTO */
    private record OrderConfirmRequest(@NotNull @Positive @Schema(example = "1") Long sessionId) {}
}
