package dgu.capstone.nunchi.global.client;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

@Slf4j
@Component
public class FastApiClient {

    private final RestClient fastApiRestClient;

    public FastApiClient(@Qualifier("fastApiRestClient") RestClient fastApiRestClient) {
        this.fastApiRestClient = fastApiRestClient;
    }

    public <T> T post(String endpoint, Object request, Class<T> responseType) {
        long startTime = System.currentTimeMillis();

        try {
            T response = fastApiRestClient.post()
                    .uri(endpoint)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(request)
                    .retrieve()
                    .body(responseType);

            long elapsedMs = System.currentTimeMillis() - startTime;

            log.info("[AI_CALL] method=POST endpoint={} elapsedMs={} status=SUCCESS",
                    endpoint, elapsedMs);

            return response;

        } catch (RestClientResponseException e) {
            long elapsedMs = System.currentTimeMillis() - startTime;

            log.warn("[AI_CALL] method=POST endpoint={} elapsedMs={} status=FAILED httpStatus={} error={}",
                    endpoint, elapsedMs, e.getStatusCode(), e.getClass().getSimpleName());

            throw e;

        } catch (Exception e) {
            long elapsedMs = System.currentTimeMillis() - startTime;

            log.warn("[AI_CALL] method=POST endpoint={} elapsedMs={} status=FAILED error={}",
                    endpoint, elapsedMs, e.getClass().getSimpleName());

            throw e;
        }
    }

    public <T> T get(String endpoint, Class<T> responseType) {
        long startTime = System.currentTimeMillis();

        try {
            T response = fastApiRestClient.get()
                    .uri(endpoint)
                    .retrieve()
                    .body(responseType);

            long elapsedMs = System.currentTimeMillis() - startTime;

            log.info("[AI_CALL] method=GET endpoint={} elapsedMs={} status=SUCCESS",
                    endpoint, elapsedMs);

            return response;

        } catch (RestClientResponseException e) {
            long elapsedMs = System.currentTimeMillis() - startTime;

            log.warn("[AI_CALL] method=GET endpoint={} elapsedMs={} status=FAILED httpStatus={} error={}",
                    endpoint, elapsedMs, e.getStatusCode(), e.getClass().getSimpleName());

            throw e;

        } catch (Exception e) {
            long elapsedMs = System.currentTimeMillis() - startTime;

            log.warn("[AI_CALL] method=GET endpoint={} elapsedMs={} status=FAILED error={}",
                    endpoint, elapsedMs, e.getClass().getSimpleName());

            throw e;
        }
    }
}