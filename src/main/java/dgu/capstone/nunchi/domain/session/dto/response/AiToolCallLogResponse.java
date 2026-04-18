package dgu.capstone.nunchi.domain.session.dto.response;

import dgu.capstone.nunchi.domain.session.entity.AiToolCallLog;

import java.time.LocalDateTime;

public record AiToolCallLogResponse(
        Long logId,
        Long sessionId,
        String toolName,
        String request,
        String response,
        LocalDateTime createdAt
) {
    public static AiToolCallLogResponse from(AiToolCallLog log) {
        return new AiToolCallLogResponse(
                log.getLogId(),
                log.getSession().getSessionId(),
                log.getToolName(),
                log.getRequest(),
                log.getResponse(),
                log.getCreatedAt()
        );
    }
}
