package dgu.capstone.nunchi.domain.session.entity;

import dgu.capstone.nunchi.global.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Getter
@Builder
@AllArgsConstructor
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Table(name = "stt_log")
public class SttLog extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "stt_id")
    private Long sttId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "session_id", nullable = false)
    private KioskSession session;

    @Column(name = "raw_text", columnDefinition = "TEXT", nullable = false)
    private String rawText;

    // STT 인식 신뢰도 (0.0 ~ 1.0)
    @Column(name = "confidence")
    private Float confidence;

    // 정적 팩토리 메서드
    public static SttLog create(KioskSession session, String rawText, Float confidence) {
        return SttLog.builder()
                .session(session)
                .rawText(rawText)
                .confidence(confidence)
                .build();
    }
}
