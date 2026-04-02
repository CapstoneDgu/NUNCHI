package dgu.capstone.nunchi.domain.session.repository;

import dgu.capstone.nunchi.domain.session.entity.ConversationMessage;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ConversationMessageRepository extends JpaRepository<ConversationMessage, Long> {
}