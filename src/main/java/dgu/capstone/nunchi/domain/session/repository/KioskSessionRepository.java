package dgu.capstone.nunchi.domain.session.repository;

import dgu.capstone.nunchi.domain.session.entity.KioskSession;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;

public interface KioskSessionRepository extends JpaRepository<KioskSession, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT s FROM KioskSession s WHERE s.sessionId = :sessionId")
    Optional<KioskSession> findByIdWithLock(Long sessionId);
}