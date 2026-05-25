package dgu.capstone.nunchi.domain.ai.controller;

import dgu.capstone.nunchi.domain.ai.service.AiOrderProxyService;
import dgu.capstone.nunchi.global.response.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/ai/order")
public class AiOrderProxyController {

    private final AiOrderProxyService aiOrderProxyService;

    @PostMapping("/start")
    public ApiResponse<Map<String, Object>> startOrder(
            @RequestBody Map<String, Object> request
    ) {
        Map<String, Object> response = aiOrderProxyService.startOrder(request);
        return ApiResponse.ok(response);
    }

    @PostMapping("/chat")
    public ApiResponse<Map<String, Object>> chatOrder(
            @RequestBody Map<String, Object> request
    ) {
        Map<String, Object> response = aiOrderProxyService.chatOrder(request);
        return ApiResponse.ok(response);
    }

    @PostMapping(value = "/chat/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public ResponseEntity<StreamingResponseBody> chatOrderStream(
            @RequestBody Map<String, Object> request
    ) {
        StreamingResponseBody response = aiOrderProxyService.chatOrderStream(request);

        return ResponseEntity.ok()
                .contentType(MediaType.TEXT_EVENT_STREAM)
                .body(response);
    }
}