package dgu.capstone.nunchi.domain.ai.service;

import dgu.capstone.nunchi.global.client.FastApiClient;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import java.util.Map;

@Service
@RequiredArgsConstructor
public class AiOrderProxyService {

    private final FastApiClient fastApiClient;

    public Map<String, Object> startOrder(Map<String, Object> request) {
        return fastApiClient.post(
                "/ai/order/start",
                request,
                Map.class
        );
    }

    public Map<String, Object> chatOrder(Map<String, Object> request) {
        return fastApiClient.post(
                "/ai/order/chat",
                request,
                Map.class
        );
    }
    public StreamingResponseBody chatOrderStream(Map<String, Object> request) {
        return outputStream -> fastApiClient.streamPost(
                "/ai/order/chat/stream",
                request,
                outputStream
        );
    }
}