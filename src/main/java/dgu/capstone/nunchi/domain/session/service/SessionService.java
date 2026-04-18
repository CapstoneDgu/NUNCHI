package dgu.capstone.nunchi.domain.session.service;

import dgu.capstone.nunchi.domain.session.dto.request.AiToolCallLogSaveRequest;
import dgu.capstone.nunchi.domain.session.dto.request.ConversationMessageSaveRequest;
import dgu.capstone.nunchi.domain.session.dto.request.SessionCreateRequest;
import dgu.capstone.nunchi.domain.session.dto.response.AiToolCallLogResponse;
import dgu.capstone.nunchi.domain.session.dto.response.ConversationMessageResponse;
import dgu.capstone.nunchi.domain.session.dto.response.SessionResponse;
import dgu.capstone.nunchi.domain.session.entity.AiToolCallLog;
import dgu.capstone.nunchi.domain.session.entity.ConversationMessage;
import dgu.capstone.nunchi.domain.session.entity.KioskSession;
import dgu.capstone.nunchi.domain.session.entity.SessionStatus;
import dgu.capstone.nunchi.domain.session.repository.AiToolCallLogRepository;
import dgu.capstone.nunchi.domain.session.repository.ConversationMessageRepository;
import dgu.capstone.nunchi.domain.session.repository.KioskSessionRepository;
import dgu.capstone.nunchi.global.exception.domainException.SessionException;
import dgu.capstone.nunchi.global.exception.errorcode.SessionErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class SessionService {

    private final KioskSessionRepository kioskSessionRepository;
    private final ConversationMessageRepository conversationMessageRepository;
    private final AiToolCallLogRepository aiToolCallLogRepository;

    @Transactional
    public SessionResponse createSession(SessionCreateRequest request) {
        KioskSession session = KioskSession.create(request.mode(), request.language());
        kioskSessionRepository.save(session);
        return SessionResponse.from(session);
    }

    @Transactional
    public SessionResponse completeSession(Long sessionId) {
        KioskSession session = kioskSessionRepository.findByIdWithLock(sessionId)
                .orElseThrow(() -> new SessionException(SessionErrorCode.NOT_FOUND_SESSION));

        // 이미 종료된 세션이면 예외 처리
        if (session.getSessionStatus() != SessionStatus.ACTIVE) {
            throw new SessionException(SessionErrorCode.SESSION_ALREADY_ENDED);
        }

        session.complete();
        return SessionResponse.from(session);
    }

    @Transactional
    public ConversationMessageResponse saveMessage(Long sessionId, ConversationMessageSaveRequest request) {
        KioskSession session = kioskSessionRepository.findById(sessionId)
                .orElseThrow(() -> new SessionException(SessionErrorCode.NOT_FOUND_SESSION));

        ConversationMessage message = ConversationMessage.create(session, request.role(), request.text());
        conversationMessageRepository.save(message);

        return ConversationMessageResponse.from(message);
    }

    @Transactional
    public AiToolCallLogResponse saveToolCallLog(Long sessionId, AiToolCallLogSaveRequest request) {
        KioskSession session = kioskSessionRepository.findById(sessionId)
                .orElseThrow(() -> new SessionException(SessionErrorCode.NOT_FOUND_SESSION));

        AiToolCallLog log = AiToolCallLog.create(
                session,
                request.toolName(),
                request.request(),
                request.response()
        );
        aiToolCallLogRepository.save(log);

        return AiToolCallLogResponse.from(log);
    }

    public List<AiToolCallLogResponse> getToolCallLogs(Long sessionId) {
        if (!kioskSessionRepository.existsById(sessionId)) {
            throw new SessionException(SessionErrorCode.NOT_FOUND_SESSION);
        }

        return aiToolCallLogRepository.findAllBySessionSessionIdOrderByCreatedAtAsc(sessionId)
                .stream()
                .map(AiToolCallLogResponse::from)
                .toList();
    }
}
