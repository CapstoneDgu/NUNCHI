package dgu.capstone.nunchi.domain.session.dto.request;

import dgu.capstone.nunchi.domain.session.entity.MessageRole;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record ConversationMessageSaveRequest(

        @NotNull(message = "role은 필수입니다.")
        MessageRole role,

        @NotBlank(message = "text는 필수입니다.")
        String text
) {
}
