package dgu.capstone.nunchi.domain.admin.dto.response;

import dgu.capstone.nunchi.domain.order.entity.Order;
import dgu.capstone.nunchi.domain.order.entity.OrderStatus;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;

@Schema(description = "관리자 주문 목록 응답 DTO")
public record AdminOrderResponse(

        @Schema(description = "주문 ID", example = "1")
        Long orderId,

        @Schema(description = "세션 ID", example = "100")
        Long sessionId,

        @Schema(description = "총 주문 금액", example = "18000")
        Integer totalAmount,

        @Schema(description = "주문 상태", example = "COMPLETED")
        OrderStatus orderStatus,

        @Schema(description = "주문 상품 개수", example = "3")
        Integer itemCount,

        @Schema(description = "주문 생성 시간", example = "2026-05-05T12:31:00")
        LocalDateTime createdAt
) {

    public static AdminOrderResponse from(Order order, Integer itemCount) {
        return new AdminOrderResponse(
                order.getOrderId(),
                order.getSessionId(),
                order.getTotalAmount(),
                order.getOrderStatus(),
                itemCount,
                order.getCreatedAt()
        );
    }
}