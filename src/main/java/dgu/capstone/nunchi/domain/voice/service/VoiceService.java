package dgu.capstone.nunchi.domain.voice.service;

import dgu.capstone.nunchi.domain.voice.config.GoogleVoiceProperties;
import dgu.capstone.nunchi.domain.voice.dto.request.SynthesizeRequest;
import dgu.capstone.nunchi.domain.voice.dto.response.TranscribeResponse;
import dgu.capstone.nunchi.global.exception.domainException.VoiceException;
import dgu.capstone.nunchi.global.exception.errorcode.VoiceErrorCode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Base64;
import java.util.List;
import java.util.Map;

/**
 * Google Cloud Speech-to-Text / Text-to-Speech REST API 호출.
 * 인증: API key (쿼리스트링 ?key=...).
 */
@Slf4j
@Service
@Transactional(readOnly = true)
public class VoiceService {

    private final RestClient speechClient;
    private final RestClient textToSpeechClient;
    private final GoogleVoiceProperties props;

    public VoiceService(
            @Qualifier("googleSpeechRestClient") RestClient speechClient,
            @Qualifier("googleTextToSpeechRestClient") RestClient textToSpeechClient,
            GoogleVoiceProperties props
    ) {
        this.speechClient = speechClient;
        this.textToSpeechClient = textToSpeechClient;
        this.props = props;
    }

    public TranscribeResponse transcribe(MultipartFile audio) {
        if (audio == null || audio.isEmpty()) {
            throw new VoiceException(VoiceErrorCode.INVALID_AUDIO_FORMAT);
        }
        if (props.apiKey() == null || props.apiKey().isBlank()) {
            throw new VoiceException(VoiceErrorCode.TRANSCRIBE_FAILED);
        }
        try {
            String base64Audio = Base64.getEncoder().encodeToString(audio.getBytes());

            Map<String, Object> body = Map.of(
                    "config", Map.of(
                            "encoding", props.stt().encoding(),
                            "languageCode", props.stt().languageCode(),
                            "enableAutomaticPunctuation", true
                    ),
                    "audio", Map.of("content", base64Audio)
            );

            Map<String, Object> response = speechClient.post()
                    .uri(uriBuilder -> uriBuilder
                            .path("/v1/speech:recognize")
                            .queryParam("key", props.apiKey())
                            .build())
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(Map.class);

            if (response == null) {
                throw new VoiceException(VoiceErrorCode.EMPTY_TRANSCRIPT);
            }
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> results = (List<Map<String, Object>>) response.get("results");
            if (results == null || results.isEmpty()) {
                throw new VoiceException(VoiceErrorCode.EMPTY_TRANSCRIPT);
            }
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> alternatives = (List<Map<String, Object>>) results.get(0).get("alternatives");
            if (alternatives == null || alternatives.isEmpty()) {
                throw new VoiceException(VoiceErrorCode.EMPTY_TRANSCRIPT);
            }
            Map<String, Object> alt = alternatives.get(0);
            String text = String.valueOf(alt.getOrDefault("transcript", "")).trim();
            if (text.isEmpty()) {
                throw new VoiceException(VoiceErrorCode.EMPTY_TRANSCRIPT);
            }
            double confidence = alt.get("confidence") instanceof Number n ? n.doubleValue() : 0.0;
            return TranscribeResponse.from(text, confidence);

        } catch (VoiceException e) {
            throw e;
        } catch (RestClientResponseException e) {
            log.warn("[Voice] STT REST 실패 status={} body={}", e.getStatusCode(), e.getResponseBodyAsString());
            throw new VoiceException(VoiceErrorCode.TRANSCRIBE_FAILED);
        } catch (IOException e) {
            log.warn("[Voice] STT 파일 읽기 실패", e);
            throw new VoiceException(VoiceErrorCode.TRANSCRIBE_FAILED);
        } catch (Exception e) {
            log.warn("[Voice] STT 알 수 없는 오류", e);
            throw new VoiceException(VoiceErrorCode.TRANSCRIBE_FAILED);
        }
    }

    public byte[] synthesize(SynthesizeRequest req) {
        if (props.apiKey() == null || props.apiKey().isBlank()) {
            throw new VoiceException(VoiceErrorCode.SYNTHESIZE_FAILED);
        }
        try {
            String voiceName = (req.voice() != null && !req.voice().isBlank())
                    ? req.voice()
                    : props.tts().voiceName();

            Map<String, Object> body = Map.of(
                    "input", Map.of("text", req.text()),
                    "voice", Map.of(
                            "languageCode", props.tts().languageCode(),
                            "name", voiceName,
                            "ssmlGender", props.tts().ssmlGender()
                    ),
                    "audioConfig", Map.of(
                            "audioEncoding", props.tts().audioEncoding()
                    )
            );

            Map<String, Object> response = textToSpeechClient.post()
                    .uri(uriBuilder -> uriBuilder
                            .path("/v1/text:synthesize")
                            .queryParam("key", props.apiKey())
                            .build())
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(Map.class);

            if (response == null || response.get("audioContent") == null) {
                throw new VoiceException(VoiceErrorCode.SYNTHESIZE_FAILED);
            }
            String base64Audio = String.valueOf(response.get("audioContent"));
            return Base64.getDecoder().decode(base64Audio);

        } catch (VoiceException e) {
            throw e;
        } catch (RestClientResponseException e) {
            log.warn("[Voice] TTS REST 실패 status={} body={}", e.getStatusCode(), e.getResponseBodyAsString());
            throw new VoiceException(VoiceErrorCode.SYNTHESIZE_FAILED);
        } catch (Exception e) {
            log.warn("[Voice] TTS 알 수 없는 오류", e);
            throw new VoiceException(VoiceErrorCode.SYNTHESIZE_FAILED);
        }
    }
}
