package dgu.capstone.nunchi.global.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

@Configuration
public class FastApiClientConfig {

    @Bean
    public RestClient fastApiRestClient(
            @Value("${fastapi.base-url}") String fastApiBaseUrl
    ) {
        return RestClient.builder()
                .baseUrl(fastApiBaseUrl)
                .build();
    }
}