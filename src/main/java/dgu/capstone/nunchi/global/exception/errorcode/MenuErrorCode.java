package dgu.capstone.nunchi.global.exception.errorcode;

import lombok.Getter;
import org.springframework.http.HttpStatus;

@Getter
public enum MenuErrorCode implements ErrorCode {

    /**
     * 400 BAD_REQUEST
     */
    INVALID_ALLERGY_TYPE(HttpStatus.BAD_REQUEST, 400, "유효하지 않은 알레르기 항목입니다. (예: MILK, EGG, WHEAT)"),
    INVALID_SEARCH_KEYWORD(HttpStatus.BAD_REQUEST, 400, "검색어를 입력해주세요."),

    /**
     * 404 NOT_FOUND
     */
    NOT_FOUND_MENU(HttpStatus.NOT_FOUND, 404, "존재하지 않는 메뉴입니다."),
    NOT_FOUND_MENU_CATEGORY(HttpStatus.NOT_FOUND, 404, "존재하지 않는 메뉴 카테고리입니다."),
    NOT_FOUND_MENU_OPTION(HttpStatus.NOT_FOUND, 404, "존재하지 않는 메뉴 옵션입니다.");

    private final HttpStatus status;
    private final int code;
    private final String msg;

    MenuErrorCode(HttpStatus status, int code, String msg) {
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
