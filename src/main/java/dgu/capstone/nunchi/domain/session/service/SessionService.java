package dgu.capstone.nunchi.domain.session.service;

import dgu.capstone.nunchi.domain.session.dto.request.SessionCreateRequest;
import dgu.capstone.nunchi.domain.session.dto.response.SessionResponse;
import dgu.capstone.nunchi.domain.session.entity.KioskSession;
import dgu.capstone.nunchi.domain.session.entity.SessionStatus;
import dgu.capstone.nunchi.domain.session.repository.KioskSessionRepository;
import dgu.capstone.nunchi.global.exception.domainException.SessionException;
import dgu.capstone.nunchi.global.exception.errorcode.SessionErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class SessionService {

    private final KioskSessionRepository kioskSessionRepository;

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
}
