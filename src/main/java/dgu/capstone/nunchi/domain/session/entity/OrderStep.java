package dgu.capstone.nunchi.domain.session.entity;

public enum OrderStep {
    BROWSE,     // 기: 카테고리 탐색 단계
    SELECT,     // 승: 메뉴 선택 단계
    CONFIGURE,  // 전: 수량/옵션 설정 단계
    CHECKOUT    // 결: 주문 요약 및 결제 단계
}
