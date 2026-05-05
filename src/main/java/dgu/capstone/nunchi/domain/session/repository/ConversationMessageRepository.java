package dgu.capstone.nunchi.domain.session.repository;

import dgu.capstone.nunchi.domain.session.entity.ConversationMessage;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ConversationMessageRepository extends JpaRepository<ConversationMessage, Long> {

    List<ConversationMessage> findAllBySession_SessionIdOrderByCreatedAtAsc(Long sessionId, Pageable pageable);
}