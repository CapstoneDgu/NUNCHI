package dgu.capstone.nunchi.domain.session.repository;

import dgu.capstone.nunchi.domain.session.entity.SttLog;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SttLogRepository extends JpaRepository<SttLog, Long> {
}