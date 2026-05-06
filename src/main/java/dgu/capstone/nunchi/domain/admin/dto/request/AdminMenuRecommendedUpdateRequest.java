package dgu.capstone.nunchi.domain.admin.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

@Schema(description = "메뉴 추천 상태 변경 요청 DTO")
public record AdminMenuRecommendedUpdateRequest(

        @Schema(description = "추천 여부", example = "true")
        @NotNull(message = "추천 여부는 필수입니다.")
        Boolean isRecommended
) {
}