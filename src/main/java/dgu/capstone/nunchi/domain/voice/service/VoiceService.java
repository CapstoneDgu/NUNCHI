package dgu.capstone.nunchi.domain.voice.service;

import dgu.capstone.nunchi.domain.voice.config.GoogleVoiceProperties;
import dgu.capstone.nunchi.domain.voice.dto.request.SynthesizeRequest;
import dgu.capstone.nunchi.global.exception.domainException.VoiceException;
import dgu.capstone.nunchi.global.exception.errorcode.VoiceErrorCode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.util.Base64;
import java.util.Map;

/**
 * Google Cloud Text-to-Speech REST API 호출.
 * STT 는 Web Speech API(브라우저 내장)로 처리.
 * 인증: API key (쿼리스트링 ?key=...).
 */
@Slf4j
@Service
@Transactional(readOnly = true)
public class VoiceService {

    private final RestClient textToSpeechClient;
    private final GoogleVoiceProperties props;

    public VoiceService(
            @Qualifier("googleTextToSpeechRestClient") RestClient textToSpeechClient,
            GoogleVoiceProperties props
    ) {
        this.textToSpeechClient = textToSpeechClient;
        this.props = props;
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
