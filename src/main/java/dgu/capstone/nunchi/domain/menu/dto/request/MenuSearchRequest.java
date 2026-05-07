package dgu.capstone.nunchi.domain.menu.dto.request;

import jakarta.validation.constraints.NotBlank;

public record MenuSearchRequest(
        @NotBlank(message = "검색어를 입력해주세요.") String name
) {}
