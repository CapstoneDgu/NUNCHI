package dgu.capstone.nunchi.domain.admin.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;

@Schema(description = "관리자 모드 잠금 해제 요청 DTO")
public record AdminUnlockRequest(

        @Schema(description = "관리자 전용 비밀번호", example = "1234")
        @NotBlank(message = "관리자 비밀번호는 필수입니다.")
        String password
) {
}