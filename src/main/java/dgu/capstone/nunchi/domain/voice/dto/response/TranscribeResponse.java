package dgu.capstone.nunchi.domain.voice.dto.response;

public record TranscribeResponse(
        String text,
        double confidence
) {
    public static TranscribeResponse from(String text, double confidence) {
        return new TranscribeResponse(text, confidence);
    }
}
