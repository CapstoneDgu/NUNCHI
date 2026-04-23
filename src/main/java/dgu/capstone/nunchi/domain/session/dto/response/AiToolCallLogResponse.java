package dgu.capstone.nunchi.domain.session.dto.response;

import dgu.capstone.nunchi.domain.session.entity.AiToolCallLog;

import java.time.LocalDateTime;

public record AiToolCallLogResponse(
        Long logId,
        Long sessionId,
        String toolName,
        LocalDateTime createdAt
) {
    public static AiToolCallLogResponse from(AiToolCallLog log) {
        return new AiToolCallLogResponse(
                log.getLogId(),
                log.getSession().getSessionId(),
                log.getToolName(),
                log.getCreatedAt()
        );
    }
}
