package dgu.capstone.nunchi.global.exception.domainException;

import dgu.capstone.nunchi.global.exception.BusinessException;
import dgu.capstone.nunchi.global.exception.errorcode.ErrorCode;

public class MenuException extends BusinessException {

    public MenuException(ErrorCode errorCode) {
        super(errorCode);
    }
}
