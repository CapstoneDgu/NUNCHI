package dgu.capstone.nunchi.domain.session.dto.request;

import dgu.capstone.nunchi.domain.session.entity.SessionMode;
import jakarta.validation.constraints.NotNull;

public record SessionCreateRequest(
        @NotNull SessionMode mode,
        String language
) {}
