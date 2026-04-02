package dgu.capstone.nunchi.global.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import org.springframework.http.HttpStatus;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record ApiResponse<T>(int code, String msg, T data) {

    public static <T> ApiResponse<T> ok(T data) {
        return new ApiResponse<>(HttpStatus.OK.value(), "요청이 성공했습니다.", data);
    }

    public static <T> ApiResponse<T> ok(T data, String msg) {
        return new ApiResponse<>(HttpStatus.OK.value(), msg, data);
    }

    public static <T> ApiResponse<T> created(T data) {
        return new ApiResponse<>(HttpStatus.CREATED.value(), "생성이 완료되었습니다.", data);
    }

    public static <T> ApiResponse<Void> noContent() {
        return new ApiResponse<>(HttpStatus.NO_CONTENT.value(), "처리가 완료되었습니다.", null);
    }

    public static <T> ApiResponse<T> fail(int code, String msg) {
        return new ApiResponse<>(code, msg, null);
    }
}
