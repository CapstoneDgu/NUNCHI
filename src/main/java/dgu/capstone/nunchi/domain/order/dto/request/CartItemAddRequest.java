package dgu.capstone.nunchi.domain.order.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.util.List;

public record CartItemAddRequest(
        @NotNull @Positive @Schema(example = "1") Long sessionId,
        @NotNull @Positive @Schema(example = "1") Long menuId,
        @NotNull @Min(1) @Schema(example = "2") Integer quantity,
        @Schema(example = "[]") List<@NotNull @Positive Long> optionIds
) {}
