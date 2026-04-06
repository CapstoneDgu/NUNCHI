package dgu.capstone.nunchi.domain.payment.dto.request;

import dgu.capstone.nunchi.domain.payment.entity.PaymentMethod;
import jakarta.validation.constraints.NotNull;

public record PaymentCreateRequest(
        @NotNull Long orderId,
        @NotNull PaymentMethod method
) {
}
