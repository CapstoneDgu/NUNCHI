package dgu.capstone.nunchi.domain.session.service;

import dgu.capstone.nunchi.domain.session.dto.request.AiToolCallLogSaveRequest;
import dgu.capstone.nunchi.domain.session.dto.request.ConversationMessageSaveRequest;
import dgu.capstone.nunchi.domain.session.dto.request.SessionCreateRequest;
import dgu.capstone.nunchi.domain.session.dto.request.SessionStepUpdateRequest;
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

import org.springframework.data.domain.PageRequest;

import java.util.Collections;
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
        KioskSession session = KioskSession.create(request.mode(), request.language(), request.orderType());
        kioskSessionRepository.save(session);
        return SessionResponse.from(session);
    }

    /**
     * 세션 종료 — 멱등 처리.
     * 아바타 모드에서 FastAPI MCP Tool 이 결제 완료 시 자동으로 종료를 호출하고,
     * 프론트(P05) 도 결제 완료 페이지 진입 시 동일 API 를 호출하는 흐름이 있어
     * 같은 세션에 대해 종료가 두 번 들어올 수 있다.
     * 단말기 연동 후엔 프론트가 결제 승인 후 단독으로 호출하므로 이 경로가 사라지지만,
     * 안전망으로 멱등 응답을 유지한다.
     * 이미 COMPLETED/EXPIRED 상태면 상태 변경 없이 현재 스냅샷을 반환한다.
     */
    @Transactional
    public SessionResponse completeSession(Long sessionId) {
        KioskSession session = kioskSessionRepository.findByIdWithLock(sessionId)
                .orElseThrow(() -> new SessionException(SessionErrorCode.NOT_FOUND_SESSION));

        if (session.getSessionStatus() == SessionStatus.ACTIVE) {
            session.complete();
        }
        return SessionResponse.from(session);
    }

    @Transactional
    public SessionResponse updateStep(Long sessionId, SessionStepUpdateRequest request) {
        KioskSession session = kioskSessionRepository.findByIdWithLock(sessionId)
                .orElseThrow(() -> new SessionException(SessionErrorCode.NOT_FOUND_SESSION));

        if (session.getSessionStatus() != SessionStatus.ACTIVE) {
            throw new SessionException(SessionErrorCode.SESSION_ALREADY_ENDED);
        }

        session.updateStep(request.step().name());
        return SessionResponse.from(session);
    }

    @Transactional(readOnly = true)
    public List<ConversationMessageResponse> getMessages(Long sessionId, int limit) {
        if (!kioskSessionRepository.existsById(sessionId)) {
            throw new SessionException(SessionErrorCode.NOT_FOUND_SESSION);
        }

        List<ConversationMessage> messages = conversationMessageRepository
                .findAllBySession_SessionIdOrderByCreatedAtDesc(sessionId, PageRequest.of(0, limit));
        Collections.reverse(messages);
        return messages.stream()
                .map(ConversationMessageResponse::from)
                .toList();
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

    public List<AiToolCallLogResponse> getToolCallLogs(Long sessionId, int limit) {
        if (!kioskSessionRepository.existsById(sessionId)) {
            throw new SessionException(SessionErrorCode.NOT_FOUND_SESSION);
        }

        return aiToolCallLogRepository.findAllBySessionSessionIdOrderByCreatedAtAsc(sessionId, PageRequest.of(0, limit))
                .stream()
                .map(AiToolCallLogResponse::from)
                .toList();
    }
}
