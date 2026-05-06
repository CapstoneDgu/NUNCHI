package dgu.capstone.nunchi.domain.admin.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "관리자 모드 잠금 해제 응답 DTO")
public record AdminUnlockResponse(

        @Schema(description = "관리자 API 접근용 JWT Access Token")
        String accessToken,

        @Schema(description = "토큰 타입", example = "Bearer")
        String tokenType
) {
}