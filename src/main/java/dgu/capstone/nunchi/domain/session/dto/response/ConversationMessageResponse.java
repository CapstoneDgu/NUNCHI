package dgu.capstone.nunchi.domain.session.dto.response;

import dgu.capstone.nunchi.domain.session.entity.ConversationMessage;

import java.time.LocalDateTime;

public record ConversationMessageResponse(
        Long messageId,
        Long sessionId,
        String role,
        String text,
        LocalDateTime createdAt
) {
    public static ConversationMessageResponse from(ConversationMessage message) {
        return new ConversationMessageResponse(
                message.getConversationId(),
                message.getSession().getSessionId(),
                message.getRole().name(),
                message.getText(),
                message.getCreatedAt()
        );
    }
}
