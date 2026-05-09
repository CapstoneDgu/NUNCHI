package dgu.capstone.nunchi.domain.voice.service;

import com.google.cloud.speech.v1.RecognitionAudio;
import com.google.cloud.speech.v1.RecognitionConfig;
import com.google.cloud.speech.v1.RecognizeResponse;
import com.google.cloud.speech.v1.SpeechClient;
import com.google.cloud.speech.v1.SpeechRecognitionAlternative;
import com.google.cloud.speech.v1.SpeechRecognitionResult;
import com.google.cloud.texttospeech.v1.AudioConfig;
import com.google.cloud.texttospeech.v1.AudioEncoding;
import com.google.cloud.texttospeech.v1.SsmlVoiceGender;
import com.google.cloud.texttospeech.v1.SynthesisInput;
import com.google.cloud.texttospeech.v1.SynthesizeSpeechResponse;
import com.google.cloud.texttospeech.v1.TextToSpeechClient;
import com.google.cloud.texttospeech.v1.VoiceSelectionParams;
import com.google.protobuf.ByteString;
import dgu.capstone.nunchi.domain.voice.config.GoogleVoiceProperties;
import dgu.capstone.nunchi.domain.voice.dto.request.SynthesizeRequest;
import dgu.capstone.nunchi.domain.voice.dto.response.TranscribeResponse;
import dgu.capstone.nunchi.global.exception.domainException.VoiceException;
import dgu.capstone.nunchi.global.exception.errorcode.VoiceErrorCode;
import io.grpc.StatusRuntimeException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class VoiceService {

    private final SpeechClient speechClient;
    private final TextToSpeechClient textToSpeechClient;
    private final GoogleVoiceProperties props;

    public TranscribeResponse transcribe(MultipartFile audio) {
        if (audio == null || audio.isEmpty()) {
            throw new VoiceException(VoiceErrorCode.INVALID_AUDIO_FORMAT);
        }
        try {
            ByteString content = ByteString.copyFrom(audio.getBytes());

            RecognitionConfig.AudioEncoding encoding =
                    RecognitionConfig.AudioEncoding.valueOf(props.stt().encoding());

            RecognitionConfig config = RecognitionConfig.newBuilder()
                    .setEncoding(encoding)
                    .setLanguageCode(props.stt().languageCode())
                    .setEnableAutomaticPunctuation(true)
                    .build();

            RecognitionAudio recognitionAudio = RecognitionAudio.newBuilder()
                    .setContent(content)
                    .build();

            RecognizeResponse response = speechClient.recognize(config, recognitionAudio);

            if (response.getResultsCount() == 0) {
                throw new VoiceException(VoiceErrorCode.EMPTY_TRANSCRIPT);
            }

            SpeechRecognitionResult result = response.getResults(0);
            if (result.getAlternativesCount() == 0) {
                throw new VoiceException(VoiceErrorCode.EMPTY_TRANSCRIPT);
            }

            SpeechRecognitionAlternative alt = result.getAlternatives(0);
            String text = alt.getTranscript().trim();
            if (text.isEmpty()) {
                throw new VoiceException(VoiceErrorCode.EMPTY_TRANSCRIPT);
            }
            return TranscribeResponse.from(text, alt.getConfidence());

        } catch (VoiceException e) {
            throw e;
        } catch (StatusRuntimeException e) {
            log.warn("[Voice] STT gRPC 실패", e);
            throw new VoiceException(VoiceErrorCode.GOOGLE_API_TIMEOUT);
        } catch (IOException e) {
            log.warn("[Voice] STT 파일 읽기 실패", e);
            throw new VoiceException(VoiceErrorCode.TRANSCRIBE_FAILED);
        } catch (Exception e) {
            log.warn("[Voice] STT 알 수 없는 오류", e);
            throw new VoiceException(VoiceErrorCode.TRANSCRIBE_FAILED);
        }
    }

    public byte[] synthesize(SynthesizeRequest req) {
        try {
            SynthesisInput input = SynthesisInput.newBuilder()
                    .setText(req.text())
                    .build();

            String voiceName = (req.voice() != null && !req.voice().isBlank())
                    ? req.voice()
                    : props.tts().voiceName();

            VoiceSelectionParams voice = VoiceSelectionParams.newBuilder()
                    .setLanguageCode(props.tts().languageCode())
                    .setName(voiceName)
                    .setSsmlGender(SsmlVoiceGender.valueOf(props.tts().ssmlGender()))
                    .build();

            AudioConfig audioConfig = AudioConfig.newBuilder()
                    .setAudioEncoding(AudioEncoding.valueOf(props.tts().audioEncoding()))
                    .build();

            SynthesizeSpeechResponse response =
                    textToSpeechClient.synthesizeSpeech(input, voice, audioConfig);

            return response.getAudioContent().toByteArray();

        } catch (StatusRuntimeException e) {
            log.warn("[Voice] TTS gRPC 실패", e);
            throw new VoiceException(VoiceErrorCode.GOOGLE_API_TIMEOUT);
        } catch (Exception e) {
            log.warn("[Voice] TTS 알 수 없는 오류", e);
            throw new VoiceException(VoiceErrorCode.SYNTHESIZE_FAILED);
        }
    }
}
