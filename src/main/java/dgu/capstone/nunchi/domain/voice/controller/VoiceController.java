package dgu.capstone.nunchi.domain.voice.controller;

import dgu.capstone.nunchi.domain.voice.dto.request.SynthesizeRequest;
import dgu.capstone.nunchi.domain.voice.dto.response.TranscribeResponse;
import dgu.capstone.nunchi.domain.voice.service.VoiceService;
import dgu.capstone.nunchi.global.response.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@Tag(name = "Voice", description = "Google Cloud STT / TTS 프록시 API")
@RestController
@RequestMapping("/api/voice")
@RequiredArgsConstructor
public class VoiceController {

    private final VoiceService voiceService;

    @Operation(summary = "음성 인식 (STT)",
            description = "프론트가 캡처한 audio/webm(opus) 파일을 multipart 로 업로드하면 한국어 텍스트로 변환.")
    @PostMapping(value = "/transcribe", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<TranscribeResponse>> transcribe(
            @RequestParam("audio") MultipartFile audio
    ) {
        TranscribeResponse response = voiceService.transcribe(audio);
        return ResponseEntity.ok(ApiResponse.ok(response));
    }

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
