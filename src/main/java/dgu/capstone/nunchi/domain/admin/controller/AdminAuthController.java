package dgu.capstone.nunchi.domain.admin.controller;

import dgu.capstone.nunchi.domain.admin.dto.request.AdminUnlockRequest;
import dgu.capstone.nunchi.domain.admin.dto.response.AdminUnlockResponse;
import dgu.capstone.nunchi.domain.admin.service.AdminAuthService;
import dgu.capstone.nunchi.global.response.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@Tag(name = "관리자 인증 API", description = "키오스크 관리자 모드 접근을 위한 비밀번호 인증 API입니다.")
@RestController
@RequestMapping("/api/admin/auth")
@RequiredArgsConstructor
public class AdminAuthController {

    private final AdminAuthService adminAuthService;

    @Operation(
            summary = "관리자 모드 잠금 해제",
            description = "관리자 전용 비밀번호를 검증하고 관리자 API 접근용 JWT를 발급합니다."
    )
    @PostMapping("/unlock")
    public ResponseEntity<ApiResponse<AdminUnlockResponse>> unlock(
            @Valid @RequestBody AdminUnlockRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.ok(adminAuthService.unlock(request)));
    }

    @Operation(
            summary = "관리자 인증 확인",
            description = "관리자 JWT 인증이 정상적으로 통과되는지 확인합니다."
    )
    @GetMapping("/me")
    public ResponseEntity<ApiResponse<String>> me() {
        return ResponseEntity.ok(ApiResponse.ok("ADMIN"));
    }
}