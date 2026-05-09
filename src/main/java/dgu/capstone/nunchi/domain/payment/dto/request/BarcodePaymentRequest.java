package dgu.capstone.nunchi.domain.payment.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record BarcodePaymentRequest(
        @NotNull @Positive @Schema(example = "1") Long orderId,
        @NotBlank @Schema(example = "1234567890123") String barcodeValue
) {
}
