package dgu.capstone.nunchi.domain.voice.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * application.yml 의 google.cloud.* 설정 매핑.
 * kebab-case → camelCase relaxed binding.
 * 시작 시점 fail-fast 검증 — 필수값 누락 시 부팅 거부.
 */
@Validated
@ConfigurationProperties(prefix = "google.cloud")
public record GoogleVoiceProperties(
        @NotBlank
        String apiKey,

        @Valid
        Tts tts
) {
    public record Tts(
            @NotBlank String languageCode,
            @NotBlank String voiceName,
            @NotBlank String ssmlGender,
            @NotBlank String audioEncoding
    ) {}
}
