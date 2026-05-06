package dgu.capstone.nunchi.domain.session.repository;

import dgu.capstone.nunchi.domain.session.entity.ConversationMessage;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ConversationMessageRepository extends JpaRepository<ConversationMessage, Long> {

    List<ConversationMessage> findAllBySession_SessionIdOrderByCreatedAtAsc(Long sessionId, Pageable pageable);

    // 최근 N개를 내림차순으로 가져온 뒤 서비스에서 역정렬해 시간순 반환
    List<ConversationMessage> findAllBySession_SessionIdOrderByCreatedAtDesc(Long sessionId, Pageable pageable);
}