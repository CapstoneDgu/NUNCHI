package dgu.capstone.nunchi.domain.session.controller;

import dgu.capstone.nunchi.domain.session.dto.request.SessionCreateRequest;
import dgu.capstone.nunchi.domain.session.dto.response.SessionResponse;
import dgu.capstone.nunchi.domain.session.service.SessionService;
import dgu.capstone.nunchi.global.response.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/sessions")
@RequiredArgsConstructor
public class SessionController {

    private final SessionService sessionService;

    // 세션 생성
    @PostMapping
    public ResponseEntity<ApiResponse<SessionResponse>> createSession(
            @RequestBody @Valid SessionCreateRequest request
    ) {
        SessionResponse response = sessionService.createSession(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created(response));
    }

    // 세션 완료 처리
    @PatchMapping("/{sessionId}/complete")
    public ResponseEntity<ApiResponse<SessionResponse>> completeSession(
            @PathVariable Long sessionId
    ) {
        SessionResponse response = sessionService.completeSession(sessionId);
        return ResponseEntity.ok(ApiResponse.ok(response));
    }
}
