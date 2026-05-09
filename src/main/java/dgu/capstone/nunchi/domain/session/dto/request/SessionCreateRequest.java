package dgu.capstone.nunchi.domain.session.dto.request;

import dgu.capstone.nunchi.domain.order.entity.OrderType;
import dgu.capstone.nunchi.domain.session.entity.SessionMode;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

public record SessionCreateRequest(
        @NotNull @Schema(example = "NORMAL") SessionMode mode,
        @Schema(example = "ko") String language,
        @NotNull @Schema(example = "DINE_IN", allowableValues = {"DINE_IN", "TAKEOUT"}) OrderType orderType
) {}
