package dgu.capstone.nunchi.global.exception.errorcode;

import lombok.Getter;
import org.springframework.http.HttpStatus;

@Getter
public enum PaymentErrorCode implements ErrorCode {

    /**
     * 400 BAD_REQUEST
     */
    PAYMENT_ALREADY_PROCESSED(HttpStatus.BAD_REQUEST, 400, "이미 처리된 결제입니다."),
    PAYMENT_ALREADY_EXISTS(HttpStatus.BAD_REQUEST, 400, "이미 진행 중이거나 완료된 결제가 존재합니다."),
    ORDER_NOT_CONFIRMED(HttpStatus.BAD_REQUEST, 400, "확정된 주문이 아닙니다."),

    /**
     * 404 NOT_FOUND
     */
    NOT_FOUND_PAYMENT(HttpStatus.NOT_FOUND, 404, "존재하지 않는 결제입니다.");

    private final HttpStatus status;
    private final int code;
    private final String msg;

    PaymentErrorCode(HttpStatus status, int code, String msg) {
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
