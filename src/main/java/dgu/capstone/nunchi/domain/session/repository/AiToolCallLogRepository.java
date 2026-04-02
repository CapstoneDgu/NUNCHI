package dgu.capstone.nunchi.domain.session.repository;

import dgu.capstone.nunchi.domain.session.entity.AiToolCallLog;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AiToolCallLogRepository extends JpaRepository<AiToolCallLog, Long> {
}