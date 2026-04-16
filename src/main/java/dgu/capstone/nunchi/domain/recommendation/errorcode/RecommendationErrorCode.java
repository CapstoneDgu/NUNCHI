package dgu.capstone.nunchi.domain.recommendation.errorcode;

import dgu.capstone.nunchi.global.exception.errorcode.ErrorCode;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

@Getter
@RequiredArgsConstructor
public enum RecommendationErrorCode implements ErrorCode {

    INVALID_RECOMMEND_TYPE(HttpStatus.BAD_REQUEST, 4001, "유효하지 않은 추천 타입입니다."),
    RECOMMENDATION_MENU_NOT_FOUND(HttpStatus.NOT_FOUND, 4002, "추천 가능한 메뉴가 없습니다."),
    CATEGORY_ID_REQUIRED(HttpStatus.BAD_REQUEST, 4003, "카테고리 추천에는 categoryId가 필요합니다.");

    private final HttpStatus status;
    private final int code;
    private final String msg;
}