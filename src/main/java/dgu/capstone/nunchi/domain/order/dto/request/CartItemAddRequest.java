package dgu.capstone.nunchi.domain.order.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public record CartItemAddRequest(
        @NotNull @Schema(example = "1") Long sessionId,
        @NotNull @Schema(example = "1") Long menuId,
        @NotNull @Min(1) @Schema(example = "2") Integer quantity,
        @Schema(example = "[]") List<Long> optionIds
) {}
