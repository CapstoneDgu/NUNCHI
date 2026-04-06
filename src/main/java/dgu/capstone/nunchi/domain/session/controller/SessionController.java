package dgu.capstone.nunchi.domain.session.controller;

import dgu.capstone.nunchi.domain.session.dto.request.SessionCreateRequest;
import dgu.capstone.nunchi.domain.session.dto.response.SessionResponse;
import dgu.capstone.nunchi.domain.session.service.SessionService;
import dgu.capstone.nunchi.global.response.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@Tag(name = "Session", description = "세션 관리 API")
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
}
