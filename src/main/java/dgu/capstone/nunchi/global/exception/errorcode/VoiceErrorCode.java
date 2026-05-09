package dgu.capstone.nunchi.global.exception.errorcode;

import lombok.Getter;
import org.springframework.http.HttpStatus;

@Getter
public enum VoiceErrorCode implements ErrorCode {

    /**
     * 500 INTERNAL_SERVER_ERROR
     */
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
