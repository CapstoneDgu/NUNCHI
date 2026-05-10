package dgu.capstone.nunchi.domain.voice.controller;

import dgu.capstone.nunchi.domain.voice.dto.request.SynthesizeRequest;
import dgu.capstone.nunchi.domain.voice.service.VoiceService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Google Cloud TTS 프록시. STT 는 Web Speech API(브라우저 내장)로 처리하므로 여기엔 없음.
 */
@Tag(name = "Voice", description = "Google Cloud TTS 프록시 API")
@RestController
@RequestMapping("/api/voice")
@RequiredArgsConstructor
public class VoiceController {

    private final VoiceService voiceService;

    @Operation(summary = "음성 합성 (TTS)",
            description = "텍스트를 한국어 음성(MP3) 으로 합성. 응답은 audio/mpeg 바이너리.")
    @PostMapping(value = "/synthesize", produces = "audio/mpeg")
    public ResponseEntity<byte[]> synthesize(
            @RequestBody @Valid SynthesizeRequest request
    ) {
        byte[] audioBytes = voiceService.synthesize(request);
        return ResponseEntity.ok()
                .contentType(MediaType.valueOf("audio/mpeg"))
                .body(audioBytes);
    }
}
