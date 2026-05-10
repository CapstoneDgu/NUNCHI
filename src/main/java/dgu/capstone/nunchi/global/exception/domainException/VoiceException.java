package dgu.capstone.nunchi.global.exception.domainException;

import dgu.capstone.nunchi.global.exception.BusinessException;
import dgu.capstone.nunchi.global.exception.errorcode.ErrorCode;

public class VoiceException extends BusinessException {

    public VoiceException(ErrorCode errorCode) {
        super(errorCode);
    }
}
