package dgu.capstone.nunchi.domain.session.dto.request;

import jakarta.validation.constraints.NotBlank;

public record AiToolCallLogSaveRequest(

        @NotBlank(message = "toolName은 필수입니다.")
        String toolName,

        @NotBlank(message = "request는 필수입니다.")
        String request,

        @NotBlank(message = "response는 필수입니다.")
        String response
) {
}
