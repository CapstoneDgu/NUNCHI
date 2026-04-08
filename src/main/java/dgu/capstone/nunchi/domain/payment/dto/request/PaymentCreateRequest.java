package dgu.capstone.nunchi.domain.payment.dto.request;

import dgu.capstone.nunchi.domain.payment.entity.PaymentMethod;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record PaymentCreateRequest(
        @NotNull @Positive @Schema(example = "1") Long orderId,
        @NotNull @Schema(example = "IC_CARD") PaymentMethod method
) {
}
