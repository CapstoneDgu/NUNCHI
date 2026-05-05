package dgu.capstone.nunchi.domain.admin.service;

import dgu.capstone.nunchi.domain.admin.dto.response.AdminPopularMenuResponse;
import dgu.capstone.nunchi.domain.admin.dto.response.AdminRecommendedMenuResponse;
import dgu.capstone.nunchi.domain.menu.dto.response.TopMenuResponse;
import dgu.capstone.nunchi.domain.menu.repository.MenuRepository;
import dgu.capstone.nunchi.domain.menu.repository.SalesDailyRepository;
import dgu.capstone.nunchi.domain.order.repository.OrderItemRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AdminRecommendationService {

    private final MenuRepository menuRepository;
    private final SalesDailyRepository salesDailyRepository;
    private final OrderItemRepository orderItemRepository;

    public List<AdminRecommendedMenuResponse> getDefaultRecommendations() {
        return menuRepository.findByIsRecommendedTrueAndIsSoldOutFalse()
                .stream()
                .map(AdminRecommendedMenuResponse::from)
                .toList();
    }

    public List<AdminPopularMenuResponse> getTodayPopularMenus() {
        List<TopMenuResponse> topMenus = salesDailyRepository.findTopMenusByDate(
                LocalDate.now(),
                PageRequest.of(0, 5)
        );

        return topMenus.stream()
                .map(AdminPopularMenuResponse::fromTopMenuResponse)
                .toList();
    }

    public List<AdminPopularMenuResponse> getOrderBasedPopularMenus() {
        return orderItemRepository.findPopularMenus(PageRequest.of(0, 5))
                .stream()
                .map(AdminPopularMenuResponse::fromMenu)
                .toList();
    }
}