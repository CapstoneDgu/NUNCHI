package dgu.capstone.nunchi.global.exception.handler;

import dgu.capstone.nunchi.global.exception.BusinessException;
import dgu.capstone.nunchi.global.exception.errorcode.GlobalErrorCode;
import dgu.capstone.nunchi.global.response.ApiResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

@RestControllerAdvice
public class GlobalExceptionHandler {

    // 커스텀 비즈니스 예외 처리
    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ApiResponse<Void>> handleBusinessException(BusinessException e) {
        return ResponseEntity
                .status(e.getErrorCode().getStatus())
                .body(ApiResponse.fail(e.getErrorCode().getCode(), e.getErrorCode().getMsg()));
    }

    // 지원하지 않는 URL 요청
    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ApiResponse<Void>> handleNoResourceFoundException(NoResourceFoundException e) {
        return ResponseEntity
                .status(GlobalErrorCode.NOT_FOUND_URL.getStatus())
                .body(ApiResponse.fail(GlobalErrorCode.NOT_FOUND_URL.getCode(), GlobalErrorCode.NOT_FOUND_URL.getMsg()));
    }

    // 지원하지 않는 HTTP Method (예: GET 엔드포인트에 POST 요청)
    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ApiResponse<Void>> handleMethodNotAllowed(HttpRequestMethodNotSupportedException e) {
        return ResponseEntity
                .status(GlobalErrorCode.METHOD_NOT_ALLOWED.getStatus())
                .body(ApiResponse.fail(GlobalErrorCode.METHOD_NOT_ALLOWED.getCode(), GlobalErrorCode.METHOD_NOT_ALLOWED.getMsg()));
    }

    // 요청 바디 파싱 실패 (JSON 형식 오류, 타입 불일치)
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiResponse<Void>> handleHttpMessageNotReadable(HttpMessageNotReadableException e) {
        return ResponseEntity
                .status(GlobalErrorCode.REQUEST_BODY_NOT_READABLE.getStatus())
                .body(ApiResponse.fail(GlobalErrorCode.REQUEST_BODY_NOT_READABLE.getCode(), GlobalErrorCode.REQUEST_BODY_NOT_READABLE.getMsg()));
    }

    // @RequestParam / @ModelAttribute enum 바인딩 실패 (예: temperatureType=INVALID)
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ApiResponse<Void>> handleTypeMismatch(MethodArgumentTypeMismatchException e) {
        return ResponseEntity
                .status(GlobalErrorCode.NOT_VALID_EXCEPTION.getStatus())
                .body(ApiResponse.fail(GlobalErrorCode.NOT_VALID_EXCEPTION.getCode(), GlobalErrorCode.NOT_VALID_EXCEPTION.getMsg()));
    }

    // @Valid 검증 실패
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Void>> handleValidationException(MethodArgumentNotValidException e) {
        return ResponseEntity
                .status(GlobalErrorCode.NOT_VALID_EXCEPTION.getStatus())
                .body(ApiResponse.fail(GlobalErrorCode.NOT_VALID_EXCEPTION.getCode(), GlobalErrorCode.NOT_VALID_EXCEPTION.getMsg()));
    }

    // 그 외 모든 예외
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleException(Exception e) {
        return ResponseEntity
                .status(GlobalErrorCode.INTERNAL_SERVER_ERROR.getStatus())
                .body(ApiResponse.fail(GlobalErrorCode.INTERNAL_SERVER_ERROR.getCode(), GlobalErrorCode.INTERNAL_SERVER_ERROR.getMsg()));
    }
}
