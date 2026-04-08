package dgu.capstone.nunchi.domain.session.dto.response;

import dgu.capstone.nunchi.domain.session.entity.KioskSession;

import java.time.LocalDateTime;

public record SessionResponse(
        Long sessionId,
        String mode,
        String status,
        String language,
        LocalDateTime createdAt
) {
    public static SessionResponse from(KioskSession session) {
        return new SessionResponse(
                session.getSessionId(),
                session.getMode().name(),
                session.getSessionStatus().name(),
                session.getLanguage(),
                session.getCreatedAt()
        );
    }
}
