package dgu.capstone.nunchi.domain.order.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public record CartItemAddRequest(
        @NotNull Long sessionId,
        @NotNull Long menuId,
        @NotNull @Min(1) Integer quantity,
        List<Long> optionIds
) {}
