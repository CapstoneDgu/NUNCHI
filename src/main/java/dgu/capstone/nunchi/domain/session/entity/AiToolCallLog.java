package dgu.capstone.nunchi.domain.session.entity;

import dgu.capstone.nunchi.global.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Getter
@Builder
@AllArgsConstructor
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Table(name = "ai_tool_call_log")
public class AiToolCallLog extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "log_id")
    private Long logId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "session_id")
    private KioskSession session;

    // MCP Tool 이름 (예: mcp_db_tool, mcp_payment_tool)
    @Column(name = "tool_name", length = 100)
    private String toolName;

    @Column(name = "request", columnDefinition = "TEXT")
    private String request;

    @Column(name = "response", columnDefinition = "TEXT")
    private String response;

    // 정적 팩토리 메서드
    public static AiToolCallLog create(KioskSession session, String toolName, String request, String response) {
        return AiToolCallLog.builder()
                .session(session)
                .toolName(toolName)
                .request(request)
                .response(response)
                .build();
    }
}
