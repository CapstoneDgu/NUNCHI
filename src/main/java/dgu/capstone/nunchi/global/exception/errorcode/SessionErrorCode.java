package dgu.capstone.nunchi.global.exception.errorcode;

import lombok.Getter;
import org.springframework.http.HttpStatus;

@Getter
public enum SessionErrorCode implements ErrorCode {

    /**
     * 400 BAD_REQUEST
     */
    SESSION_ALREADY_ENDED(HttpStatus.BAD_REQUEST, 400, "이미 종료된 세션입니다."),

    /**
     * 404 NOT_FOUND
     */
    NOT_FOUND_SESSION(HttpStatus.NOT_FOUND, 404, "존재하지 않는 세션입니다.");

    private final HttpStatus status;
    private final int code;
    private final String msg;

    SessionErrorCode(HttpStatus status, int code, String msg) {
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
