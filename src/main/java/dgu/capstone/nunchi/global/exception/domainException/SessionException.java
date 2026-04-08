package dgu.capstone.nunchi.global.exception.domainException;

import dgu.capstone.nunchi.global.exception.BusinessException;
import dgu.capstone.nunchi.global.exception.errorcode.ErrorCode;

public class SessionException extends BusinessException {

    public SessionException(ErrorCode errorCode) {
        super(errorCode);
    }
}
