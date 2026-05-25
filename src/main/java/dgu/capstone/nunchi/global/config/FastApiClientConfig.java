package dgu.capstone.nunchi.global.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import java.time.Duration;

@Slf4j
@Configuration
public class FastApiClientConfig {

    @Bean
    public RestClient fastApiRestClient(
            @Value("${fastapi.base-url}") String fastApiBaseUrl
    ) {
        log.info("[FASTAPI_CONFIG] baseUrl={}", fastApiBaseUrl);

        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofSeconds(3));
        requestFactory.setReadTimeout(Duration.ofSeconds(30));

        return RestClient.builder()
                .baseUrl(fastApiBaseUrl)
                .requestFactory(requestFactory)
                .build();
    }
}