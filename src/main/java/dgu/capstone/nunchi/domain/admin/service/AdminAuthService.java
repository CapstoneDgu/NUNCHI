package dgu.capstone.nunchi.domain.admin.service;

import dgu.capstone.nunchi.domain.admin.dto.request.AdminUnlockRequest;
import dgu.capstone.nunchi.domain.admin.dto.response.AdminUnlockResponse;
import dgu.capstone.nunchi.global.exception.domainException.AdminException;
import dgu.capstone.nunchi.global.exception.errorcode.AdminErrorCode;
import dgu.capstone.nunchi.global.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AdminAuthService {

    private final JwtTokenProvider jwtTokenProvider;

    @Value("${admin.password}")
    private String adminPassword;

    public AdminUnlockResponse unlock(AdminUnlockRequest request) {
        if (!adminPassword.equals(request.password())) {
            throw new AdminException(AdminErrorCode.INVALID_ADMIN_PASSWORD);
        }

        String accessToken = jwtTokenProvider.createAdminToken();

        return new AdminUnlockResponse(accessToken, "Bearer");
    }
}