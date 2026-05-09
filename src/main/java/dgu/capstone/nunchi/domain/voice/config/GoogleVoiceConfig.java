package dgu.capstone.nunchi.domain.voice.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

/**
 * Google Cloud Speech / TextToSpeech REST API 호출용 RestClient 빈.
 * API key 인증 — 인증은 매 요청 쿼리스트링(?key=...)으로 부여.
 */
@Configuration
@EnableConfigurationProperties(GoogleVoiceProperties.class)
public class GoogleVoiceConfig {

    @Bean(name = "googleSpeechRestClient")
    public RestClient googleSpeechRestClient() {
        return RestClient.builder()
                .baseUrl("https://speech.googleapis.com")
                .build();
    }

    @Bean(name = "googleTextToSpeechRestClient")
    public RestClient googleTextToSpeechRestClient() {
        return RestClient.builder()
                .baseUrl("https://texttospeech.googleapis.com")
                .build();
    }
}
