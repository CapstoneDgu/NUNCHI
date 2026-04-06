package dgu.capstone.nunchi.domain.payment.dto.request;

import dgu.capstone.nunchi.domain.payment.entity.PaymentMethod;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

public record PaymentCreateRequest(
        @NotNull @Schema(example = "1") Long orderId,
        @NotNull @Schema(example = "IC_CARD") PaymentMethod method
) {
}
