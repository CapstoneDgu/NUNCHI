package dgu.capstone.nunchi.global.exception.errorcode;

import lombok.Getter;
import org.springframework.http.HttpStatus;

@Getter
public enum OrderErrorCode implements ErrorCode {

    /**
     * 400 BAD_REQUEST
     */
    ORDER_ALREADY_CONFIRMED(HttpStatus.BAD_REQUEST, 400, "이미 확정된 주문입니다."),
    ORDER_ALREADY_CANCELLED(HttpStatus.BAD_REQUEST, 400, "이미 취소된 주문입니다."),
    EMPTY_CART(HttpStatus.BAD_REQUEST, 400, "장바구니가 비어있습니다."),
    NOT_FOUND_CART_ITEM(HttpStatus.NOT_FOUND, 404, "장바구니에 존재하지 않는 아이템입니다."),

    /**
     * 404 NOT_FOUND
     */
    NOT_FOUND_ORDER(HttpStatus.NOT_FOUND, 404, "존재하지 않는 주문입니다."),
    NOT_FOUND_ORDER_ITEM(HttpStatus.NOT_FOUND, 404, "존재하지 않는 주문 항목입니다.");

    private final HttpStatus status;
    private final int code;
    private final String msg;

    OrderErrorCode(HttpStatus status, int code, String msg) {
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
