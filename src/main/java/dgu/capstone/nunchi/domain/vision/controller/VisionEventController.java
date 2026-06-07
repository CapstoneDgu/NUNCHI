package dgu.capstone.nunchi.domain.vision.controller;

import dgu.capstone.nunchi.domain.vision.dto.VisionEventRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Slf4j
@RestController
@RequestMapping("/api/vision")
public class VisionEventController {

    @PostMapping("/events")
    public ResponseEntity<Void> receiveVisionEvent(@RequestBody VisionEventRequest request) {

        log.info(
                "[VISION_EVENT] type={} source={} event={} value={} level={} score={} raw={}",
                request.type(),
                request.source(),
                request.event(),
                request.value(),
                request.level(),
                request.score(),
                request.raw()
        );

        return ResponseEntity.ok().build();
    }
}