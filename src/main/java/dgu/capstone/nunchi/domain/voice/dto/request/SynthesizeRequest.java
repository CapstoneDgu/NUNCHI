package dgu.capstone.nunchi.domain.voice.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;

public record SynthesizeRequest(
        @NotBlank
        @Schema(example = "안녕하세요, 무엇을 드시고 싶으세요?")
        String text,

        @Schema(example = "ko-KR-Neural2-A", description = "선택. 비우면 application.yml 기본 보이스.")
        String voice
) {}
