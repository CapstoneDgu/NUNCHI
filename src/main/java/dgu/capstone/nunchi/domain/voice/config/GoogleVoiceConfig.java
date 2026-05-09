package dgu.capstone.nunchi.domain.voice.config;

import com.google.api.gax.core.FixedCredentialsProvider;
import com.google.auth.oauth2.GoogleCredentials;
import com.google.cloud.speech.v1.SpeechClient;
import com.google.cloud.speech.v1.SpeechSettings;
import com.google.cloud.texttospeech.v1.TextToSpeechClient;
import com.google.cloud.texttospeech.v1.TextToSpeechSettings;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.io.FileInputStream;
import java.io.IOException;

/**
 * Google Cloud Speech / TextToSpeech 클라이언트 빈 등록.
 * credentials.location 이 비어있으면 ADC(Application Default Credentials) 로 폴백.
 * 클라이언트는 무거운 객체이므로 싱글턴 빈으로 재사용.
 */
@Configuration
@EnableConfigurationProperties(GoogleVoiceProperties.class)
public class GoogleVoiceConfig {

    @Bean(destroyMethod = "close")
    public SpeechClient speechClient(GoogleVoiceProperties props) throws IOException {
        SpeechSettings.Builder settings = SpeechSettings.newBuilder();
        applyCredentials(props, settings::setCredentialsProvider);
        return SpeechClient.create(settings.build());
    }

    @Bean(destroyMethod = "close")
    public TextToSpeechClient textToSpeechClient(GoogleVoiceProperties props) throws IOException {
        TextToSpeechSettings.Builder settings = TextToSpeechSettings.newBuilder();
        applyCredentials(props, settings::setCredentialsProvider);
        return TextToSpeechClient.create(settings.build());
    }

    private void applyCredentials(GoogleVoiceProperties props,
                                  java.util.function.Consumer<FixedCredentialsProvider> setter) throws IOException {
        String location = props.credentials() != null ? props.credentials().location() : null;
        if (location == null || location.isBlank()) {
            return; // ADC 폴백
        }
        try (FileInputStream fis = new FileInputStream(location)) {
            GoogleCredentials credentials = GoogleCredentials.fromStream(fis);
            setter.accept(FixedCredentialsProvider.create(credentials));
        }
    }
}
