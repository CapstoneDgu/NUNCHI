package dgu.capstone.nunchi.domain.admin.dto.response;

import dgu.capstone.nunchi.domain.order.entity.Order;
import dgu.capstone.nunchi.domain.order.entity.OrderItem;
import dgu.capstone.nunchi.domain.order.entity.OrderStatus;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;
import java.util.List;

@Schema(description = "관리자 주문 상세 응답 DTO")
public record AdminOrderDetailResponse(

        @Schema(description = "주문 ID", example = "1")
        Long orderId,

        @Schema(description = "세션 ID", example = "100")
        Long sessionId,

        @Schema(description = "총 주문 금액", example = "18000")
        Integer totalAmount,

        @Schema(description = "주문 상태", example = "COMPLETED")
        OrderStatus orderStatus,

        @Schema(description = "주문 생성 시간", example = "2026-05-05T12:31:00")
        LocalDateTime createdAt,

        @Schema(description = "주문 상품 목록")
        List<AdminOrderItemResponse> items
) {

    public static AdminOrderDetailResponse from(Order order, List<OrderItem> orderItems) {
        return new AdminOrderDetailResponse(
                order.getOrderId(),
                order.getSessionId(),
                order.getTotalAmount(),
                order.getOrderStatus(),
                order.getCreatedAt(),
                orderItems.stream()
                        .map(AdminOrderItemResponse::from)
                        .toList()
        );
    }
}