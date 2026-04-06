package dgu.capstone.nunchi.domain.session.entity;

import dgu.capstone.nunchi.global.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Getter
@Builder
@AllArgsConstructor
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Table(name = "kiosk_session")
public class KioskSession extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "session_id")
    private Long sessionId;

    @Enumerated(EnumType.STRING)
    @Column(name = "mode", length = 20)
    private SessionMode mode;

    @Column(name = "language", length = 10)
    private String language;

    @Column(name = "current_step", length = 50)
    private String currentStep;

    @Enumerated(EnumType.STRING)
    @Column(name = "session_status", length = 20)
    @Builder.Default
    private SessionStatus sessionStatus = SessionStatus.ACTIVE;

    // 정적 팩토리 메서드
    public static KioskSession create(SessionMode mode, String language) {
        return KioskSession.builder()
                .mode(mode)
                .language(language)
                .build();
    }

    public void updateStep(String currentStep) {
        this.currentStep = currentStep;
    }

    public void complete() {
        this.sessionStatus = SessionStatus.COMPLETED;
    }

    public void expire() {
        this.sessionStatus = SessionStatus.EXPIRED;
    }
}
