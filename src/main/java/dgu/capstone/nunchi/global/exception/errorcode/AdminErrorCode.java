package dgu.capstone.nunchi.global.exception.errorcode;

import lombok.Getter;
import org.springframework.http.HttpStatus;

@Getter
public enum AdminErrorCode implements ErrorCode {

    INVALID_ADMIN_PASSWORD(HttpStatus.UNAUTHORIZED, 401, "관리자 비밀번호가 올바르지 않습니다."),
    INVALID_ADMIN_TOKEN(HttpStatus.UNAUTHORIZED, 401, "관리자 인증 토큰이 유효하지 않습니다."),
    REQUIRED_ADMIN_TOKEN(HttpStatus.UNAUTHORIZED, 401, "관리자 인증 토큰이 필요합니다.");

    private final HttpStatus status;
    private final int code;
    private final String msg;

    AdminErrorCode(HttpStatus status, int code, String msg) {
        this.status = status;
        this.code = code;
        this.msg = msg;
    }

    @Override
    public HttpStatus getStatus() {
        return status;
    }

    @Override
    public int getCode() {
        return code;
    }

    @Override
    public String getMsg() {
        return msg;
    }
}