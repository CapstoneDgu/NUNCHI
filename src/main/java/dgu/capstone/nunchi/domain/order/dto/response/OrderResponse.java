package dgu.capstone.nunchi.domain.order.dto.response;

import dgu.capstone.nunchi.domain.order.entity.Order;

import java.util.List;

public record OrderResponse(
        Long orderId,
        Long sessionId,
        Integer totalAmount,
        String orderStatus,
        List<OrderItemResponse> items
) {

    public static OrderResponse from(Order order, List<OrderItemResponse> items) {
        return new OrderResponse(
                order.getOrderId(),
                order.getSessionId(),
                order.getTotalAmount(),
                order.getOrderStatus().name(),
                items
        );
    }
}
