package dgu.capstone.nunchi.domain.admin.dto.request;

import dgu.capstone.nunchi.domain.order.entity.OrderStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

@Schema(description = "관리자 주문 상태 변경 요청 DTO")
public record AdminOrderStatusUpdateRequest(

        @Schema(description = "변경할 주문 상태", example = "COMPLETED")
        @NotNull(message = "주문 상태는 필수입니다.")
        OrderStatus orderStatus
) {
}