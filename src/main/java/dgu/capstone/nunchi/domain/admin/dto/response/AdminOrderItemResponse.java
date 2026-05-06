package dgu.capstone.nunchi.domain.admin.dto.response;

import dgu.capstone.nunchi.domain.order.entity.OrderItem;
import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "관리자 주문 상품 응답 DTO")
public record AdminOrderItemResponse(

        @Schema(description = "주문 상품 ID", example = "1")
        Long orderItemId,

        @Schema(description = "메뉴 ID", example = "10")
        Long menuId,

        @Schema(description = "주문 당시 메뉴명", example = "제육덮밥")
        String menuName,

        @Schema(description = "수량", example = "2")
        Integer quantity,

        @Schema(description = "주문 당시 단가", example = "8500")
        Integer unitPrice,

        @Schema(description = "상품 총 금액", example = "17000")
        Integer totalPrice
) {

    public static AdminOrderItemResponse from(OrderItem orderItem) {
        int quantity = orderItem.getQuantity() != null ? orderItem.getQuantity() : 0;
        int unitPrice = orderItem.getUnitPrice() != null ? orderItem.getUnitPrice() : 0;

        return new AdminOrderItemResponse(
                orderItem.getOrderItemId(),
                orderItem.getMenuId(),
                orderItem.getMenuName(),
                quantity,
                unitPrice,
                quantity * unitPrice
        );
    }
}