package dgu.capstone.nunchi.domain.session.entity;

import dgu.capstone.nunchi.global.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Getter
@Builder
@AllArgsConstructor
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Table(name = "conversation_message")
public class ConversationMessage extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "conversation_id")
    private Long conversationId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "session_id")
    private KioskSession session;

    @Enumerated(EnumType.STRING)
    @Column(name = "role", length = 20)
    private MessageRole role;

    @Column(name = "text", columnDefinition = "TEXT")
    private String text;

    // 정적 팩토리 메서드
    public static ConversationMessage create(KioskSession session, MessageRole role, String text) {
        return ConversationMessage.builder()
                .session(session)
                .role(role)
                .text(text)
                .build();
    }
}
