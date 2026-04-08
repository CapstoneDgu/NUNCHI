package dgu.capstone.nunchi.domain.order.dto.request;

import jakarta.validation.constraints.NotNull;

public record OrderCreateRequest(
        @NotNull Long sessionId
) {}
