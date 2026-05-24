package dgu.capstone.nunchi.domain.ai.controller;

import dgu.capstone.nunchi.domain.ai.service.AiOrderProxyService;
import dgu.capstone.nunchi.global.response.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

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
}