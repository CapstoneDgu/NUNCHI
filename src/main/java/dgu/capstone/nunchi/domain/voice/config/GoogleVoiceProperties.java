package dgu.capstone.nunchi.domain.voice.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * application.yml 의 google.cloud.* 설정 매핑.
 * kebab-case → camelCase relaxed binding 지원.
 */
@ConfigurationProperties(prefix = "google.cloud")
public record GoogleVoiceProperties(
        Credentials credentials,
        Stt stt,
        Tts tts
) {
    public record Credentials(String location) {}

    public record Stt(
            String languageCode,
            String encoding
    ) {}

    public record Tts(
            String languageCode,
            String voiceName,
            String ssmlGender,
            String audioEncoding
    ) {}
}
