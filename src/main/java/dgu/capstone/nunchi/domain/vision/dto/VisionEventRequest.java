package dgu.capstone.nunchi.domain.vision.dto;

import java.util.Map;

public record VisionEventRequest(
        String type,
        String source,
        String event,
        String value,
        String level,
        Integer score,
        Map<String, Object> raw
) {
}