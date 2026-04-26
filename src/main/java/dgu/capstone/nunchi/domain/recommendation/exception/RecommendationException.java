package dgu.capstone.nunchi.domain.recommendation.exception;

import dgu.capstone.nunchi.global.exception.BusinessException;
import dgu.capstone.nunchi.global.exception.errorcode.ErrorCode;

public class RecommendationException extends BusinessException {

    public RecommendationException(ErrorCode errorCode) {
        super(errorCode);
    }
}