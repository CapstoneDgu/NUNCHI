package dgu.capstone.nunchi.domain.session.dto.request;

import dgu.capstone.nunchi.domain.session.entity.OrderStep;
import jakarta.validation.constraints.NotNull;

public record SessionStepUpdateRequest(
        @NotNull OrderStep step
) {}
