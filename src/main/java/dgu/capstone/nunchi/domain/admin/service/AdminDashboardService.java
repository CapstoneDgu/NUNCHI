package dgu.capstone.nunchi.domain.admin.service;

import dgu.capstone.nunchi.domain.admin.dto.response.AdminDashboardResponse;
import dgu.capstone.nunchi.domain.admin.dto.response.AdminOrderResponse;
import dgu.capstone.nunchi.domain.menu.repository.MenuRepository;
import dgu.capstone.nunchi.domain.order.entity.OrderItem;
import dgu.capstone.nunchi.domain.order.entity.OrderStatus;
import dgu.capstone.nunchi.domain.order.repository.OrderItemRepository;
import dgu.capstone.nunchi.domain.order.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AdminDashboardService {

    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final MenuRepository menuRepository;

    public AdminDashboardResponse getDashboard() {
        LocalDate today = LocalDate.now();
        LocalDateTime startOfDay = LocalDateTime.of(today, LocalTime.MIN);
        LocalDateTime endOfDay = LocalDateTime.of(today, LocalTime.MAX);

        Long todayOrderCount = orderRepository.countByCreatedAtBetween(startOfDay, endOfDay);

        Integer todaySalesAmount = orderRepository.sumTotalAmountByCreatedAtBetweenAndOrderStatus(
                startOfDay,
                endOfDay,
                OrderStatus.COMPLETED
        );

        Long totalOrderCount = orderRepository.count();

        Long soldOutMenuCount = menuRepository.countByIsSoldOutTrue();

        Long recommendedMenuCount = menuRepository.countByIsRecommendedTrue();

        List<AdminOrderResponse> recentOrders = orderRepository.findAllByOrderByCreatedAtDesc(PageRequest.of(0, 5))
                .stream()
                .map(order -> {
                    List<OrderItem> orderItems = orderItemRepository.findAllByOrder(order);

                    int itemCount = orderItems.stream()
                            .mapToInt(item -> item.getQuantity() != null ? item.getQuantity() : 0)
                            .sum();

                    return AdminOrderResponse.from(order, itemCount);
                })
                .toList();

        return new AdminDashboardResponse(
                todayOrderCount,
                todaySalesAmount,
                totalOrderCount,
                soldOutMenuCount,
                recommendedMenuCount,
                recentOrders
        );
    }
}