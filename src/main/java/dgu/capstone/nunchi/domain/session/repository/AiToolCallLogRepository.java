package dgu.capstone.nunchi.domain.session.repository;

import dgu.capstone.nunchi.domain.session.entity.AiToolCallLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AiToolCallLogRepository extends JpaRepository<AiToolCallLog, Long> {

    List<AiToolCallLog> findAllBySessionSessionIdOrderByCreatedAtAsc(Long sessionId);
}
