package dgu.capstone.nunchi.domain.session.controller;

import dgu.capstone.nunchi.domain.session.dto.request.AiToolCallLogSaveRequest;
import dgu.capstone.nunchi.domain.session.dto.request.ConversationMessageSaveRequest;
import dgu.capstone.nunchi.domain.session.dto.request.SessionCreateRequest;
import dgu.capstone.nunchi.domain.session.dto.request.SessionStepUpdateRequest;
import dgu.capstone.nunchi.domain.session.dto.response.AiToolCallLogResponse;
import dgu.capstone.nunchi.domain.session.dto.response.ConversationMessageResponse;
import dgu.capstone.nunchi.domain.session.dto.response.SessionResponse;
import dgu.capstone.nunchi.domain.session.service.SessionService;
import dgu.capstone.nunchi.global.response.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "Session", description = "세션 관리 API")
@Validated
@RestController
@RequestMapping("/api/sessions")
@RequiredArgsConstructor
public class SessionController {

    private final SessionService sessionService;

    @Operation(summary = "세션 생성", description = "키오스크 주문 세션 시작. mode(NORMAL/AVATAR)와 language 전달")
    @PostMapping
    public ResponseEntity<ApiResponse<SessionResponse>> createSession(
            @RequestBody @Valid SessionCreateRequest request
    ) {
        SessionResponse response = sessionService.createSession(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created(response));
    }

    @Operation(summary = "세션 완료 처리", description = "주문 완료 또는 취소 후 세션 종료 시 호출")
    @PatchMapping("/{sessionId}/complete")
    public ResponseEntity<ApiResponse<SessionResponse>> completeSession(
            @Parameter(description = "세션 ID") @PathVariable Long sessionId
    ) {
        SessionResponse response = sessionService.completeSession(sessionId);
        return ResponseEntity.ok(ApiResponse.ok(response));
    }

    @Operation(summary = "대화 메시지 저장", description = "FastAPI가 사용자 발화 및 AI 응답을 저장할 때 호출. role: USER / ASSISTANT")
    @PostMapping("/{sessionId}/messages")
    public ResponseEntity<ApiResponse<ConversationMessageResponse>> saveMessage(
            @Parameter(description = "세션 ID") @PathVariable Long sessionId,
            @RequestBody @Valid ConversationMessageSaveRequest request
    ) {
        ConversationMessageResponse response = sessionService.saveMessage(sessionId, request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created(response));
    }

    @Operation(summary = "세션 스텝 업데이트", description = "FastAPI가 기/승/전/결 단계 판별 후 Spring에 동기화. step: BROWSE(기) / SELECT(승) / CONFIGURE(전) / CHECKOUT(결)")
    @PatchMapping("/{sessionId}/step")
    public ResponseEntity<ApiResponse<SessionResponse>> updateStep(
            @Parameter(description = "세션 ID") @PathVariable Long sessionId,
            @RequestBody @Valid SessionStepUpdateRequest request
    ) {
        SessionResponse response = sessionService.updateStep(sessionId, request);
        return ResponseEntity.ok(ApiResponse.ok(response));
    }

    @Operation(summary = "대화 기록 조회", description = "세션에 연결된 대화 메시지를 시간 순으로 조회. FastAPI 세션 복원 시 사용.")
    @GetMapping("/{sessionId}/messages")
    public ResponseEntity<ApiResponse<List<ConversationMessageResponse>>> getMessages(
            @Parameter(description = "세션 ID") @PathVariable Long sessionId,
            @Parameter(description = "조회 최대 개수") @Min(1) @RequestParam(defaultValue = "100") int limit
    ) {
        List<ConversationMessageResponse> response = sessionService.getMessages(sessionId, limit);
        return ResponseEntity.ok(ApiResponse.ok(response));
    }

    @Operation(summary = "AI 툴 호출 로그 저장", description = "FastAPI가 툴 호출 결과를 session 단위로 저장할 때 호출")
    @PostMapping("/{sessionId}/tool-logs")
    public ResponseEntity<ApiResponse<AiToolCallLogResponse>> saveToolCallLog(
            @Parameter(description = "세션 ID") @PathVariable Long sessionId,
            @RequestBody @Valid AiToolCallLogSaveRequest request
    ) {
        AiToolCallLogResponse response = sessionService.saveToolCallLog(sessionId, request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created(response));
    }

    @Operation(summary = "AI 툴 호출 로그 조회", description = "세션에 연결된 AI 툴 호출 로그를 생성 시각 순으로 조회")
    @GetMapping("/{sessionId}/tool-logs")
    public ResponseEntity<ApiResponse<List<AiToolCallLogResponse>>> getToolCallLogs(
            @Parameter(description = "세션 ID") @PathVariable Long sessionId,
            @Parameter(description = "조회 최대 개수") @Min(1) @RequestParam(defaultValue = "50") int limit
    ) {
        List<AiToolCallLogResponse> response = sessionService.getToolCallLogs(sessionId, limit);
        return ResponseEntity.ok(ApiResponse.ok(response));
    }
}
