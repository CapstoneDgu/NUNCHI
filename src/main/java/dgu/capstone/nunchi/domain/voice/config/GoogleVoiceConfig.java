package dgu.capstone.nunchi.domain.voice.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import java.time.Duration;

/**
 * Google Cloud Text-to-Speech REST API 호출용 RestClient 빈.
 * API key 인증 — 인증은 매 요청 쿼리스트링(?key=...)으로 부여.
 * Timeout 명시 — 무한 블로킹 방지.
 */
@Configuration
@EnableConfigurationProperties(GoogleVoiceProperties.class)
public class GoogleVoiceConfig {

    private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(3);
    private static final Duration READ_TIMEOUT = Duration.ofSeconds(15);

    @Bean(name = "googleTextToSpeechRestClient")
    public RestClient googleTextToSpeechRestClient() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout((int) CONNECT_TIMEOUT.toMillis());
        factory.setReadTimeout((int) READ_TIMEOUT.toMillis());

        return RestClient.builder()
                .requestFactory(factory)
                .baseUrl("https://texttospeech.googleapis.com")
                .build();
    }
}
