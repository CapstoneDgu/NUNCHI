package dgu.capstone.nunchi.global.exception.errorcode;

import org.springframework.http.HttpStatus;

public interface ErrorCode {

    HttpStatus getStatus();

    int getCode();

    String getMsg();
}
