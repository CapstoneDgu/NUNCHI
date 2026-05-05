package dgu.capstone.nunchi.domain.menu.dto.request;

public record MenuSearchRequest(
        String name   // 메뉴 이름 부분 검색 (LIKE %name%)
) {}
