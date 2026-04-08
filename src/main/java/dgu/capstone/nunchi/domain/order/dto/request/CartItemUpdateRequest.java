package dgu.capstone.nunchi.domain.order.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record CartItemUpdateRequest(
        @NotNull @Min(1) @Schema(example = "3") Integer quantity
) {}
