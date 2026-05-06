package dgu.capstone.nunchi.domain.admin.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

@Schema(description = "관리자 메뉴 수정 요청 DTO")
public record AdminMenuUpdateRequest(

        @Schema(description = "수정할 메뉴명", example = "매콤 제육덮밥")
        @NotBlank(message = "메뉴명은 필수입니다.")
        String name,

        @Schema(description = "수정할 메뉴 가격", example = "9000")
        @NotNull(message = "가격은 필수입니다.")
        @Min(value = 0, message = "가격은 0원 이상이어야 합니다.")
        Integer price,

        @Schema(description = "수정할 메뉴 이미지 URL", example = "https://example.com/jeyuk-spicy.jpg")
        String imageUrl,

        @Schema(description = "수정할 카테고리 ID", example = "1")
        @NotNull(message = "카테고리 ID는 필수입니다.")
        Long categoryId
) {
}