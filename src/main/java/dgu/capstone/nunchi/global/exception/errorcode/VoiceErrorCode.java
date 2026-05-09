package dgu.capstone.nunchi.global.exception.errorcode;

import lombok.Getter;
import org.springframework.http.HttpStatus;

@Getter
public enum VoiceErrorCode implements ErrorCode {

    /**
     * 400 BAD_REQUEST
     */
    INVALID_AUDIO_FORMAT(HttpStatus.BAD_REQUEST, 400, "오디오 데이터가 비어있거나 형식이 올바르지 않습니다."),

    /**
     * 422 UNPROCESSABLE_ENTITY
     */
    EMPTY_TRANSCRIPT(HttpStatus.UNPROCESSABLE_ENTITY, 422, "음성에서 텍스트를 추출하지 못했습니다."),

    /**
     * 500 INTERNAL_SERVER_ERROR
     */
    TRANSCRIBE_FAILED(HttpStatus.INTERNAL_SERVER_ERROR, 500, "음성 인식 처리에 실패했습니다."),
    SYNTHESIZE_FAILED(HttpStatus.INTERNAL_SERVER_ERROR, 500, "음성 합성 처리에 실패했습니다."),

    /**
     * 504 GATEWAY_TIMEOUT
     */
    GOOGLE_API_TIMEOUT(HttpStatus.GATEWAY_TIMEOUT, 504, "Google Cloud API 응답이 지연되었습니다.");

    private final HttpStatus status;
    private final int code;
    private final String msg;

    VoiceErrorCode(HttpStatus status, int code, String msg) {
        this.status = status;
        this.code = code;
        this.msg = msg;
    }

    @Override
    public HttpStatus getStatus() { return status; }

    @Override
    public int getCode() { return code; }

    @Override
    public String getMsg() { return msg; }
}
