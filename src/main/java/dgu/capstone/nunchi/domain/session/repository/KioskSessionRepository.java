package dgu.capstone.nunchi.domain.session.repository;

import dgu.capstone.nunchi.domain.session.entity.KioskSession;
import org.springframework.data.jpa.repository.JpaRepository;

public interface KioskSessionRepository extends JpaRepository<KioskSession, Long> {
}