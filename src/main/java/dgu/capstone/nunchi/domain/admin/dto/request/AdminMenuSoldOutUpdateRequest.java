package dgu.capstone.nunchi.domain.admin.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

@Schema(description = "메뉴 품절 상태 변경 요청 DTO")
public record AdminMenuSoldOutUpdateRequest(

        @Schema(description = "품절 여부", example = "true")
        @NotNull(message = "품절 여부는 필수입니다.")
        Boolean isSoldOut
) {
}