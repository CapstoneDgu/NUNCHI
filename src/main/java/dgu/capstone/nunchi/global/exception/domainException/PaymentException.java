package dgu.capstone.nunchi.global.exception.domainException;

import dgu.capstone.nunchi.global.exception.BusinessException;
import dgu.capstone.nunchi.global.exception.errorcode.ErrorCode;

public class PaymentException extends BusinessException {

    public PaymentException(ErrorCode errorCode) {
        super(errorCode);
    }
}
