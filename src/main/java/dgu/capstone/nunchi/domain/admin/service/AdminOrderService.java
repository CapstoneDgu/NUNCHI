package dgu.capstone.nunchi.domain.admin.service;

import dgu.capstone.nunchi.domain.admin.dto.request.AdminOrderStatusUpdateRequest;
import dgu.capstone.nunchi.domain.admin.dto.response.AdminOrderDetailResponse;
import dgu.capstone.nunchi.domain.admin.dto.response.AdminOrderResponse;
import dgu.capstone.nunchi.domain.order.entity.Order;
import dgu.capstone.nunchi.domain.order.entity.OrderItem;
import dgu.capstone.nunchi.domain.order.repository.OrderItemRepository;
import dgu.capstone.nunchi.domain.order.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AdminOrderService {

    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;

    public List<AdminOrderResponse> getOrders() {
        return orderRepository.findAll()
                .stream()
                .map(order -> {
                    List<OrderItem> orderItems = orderItemRepository.findAllByOrder(order);

                    int itemCount = orderItems.stream()
                            .mapToInt(item -> item.getQuantity() != null ? item.getQuantity() : 0)
                            .sum();

                    return AdminOrderResponse.from(order, itemCount);
                })
                .toList();
    }

    public AdminOrderDetailResponse getOrder(Long orderId) {
        Order order = findOrder(orderId);
        List<OrderItem> orderItems = orderItemRepository.findAllByOrder(order);

        return AdminOrderDetailResponse.from(order, orderItems);
    }

    @Transactional
    public AdminOrderDetailResponse updateOrderStatus(Long orderId, AdminOrderStatusUpdateRequest request) {
        Order order = findOrder(orderId);
        order.updateStatus(request.orderStatus());

        List<OrderItem> orderItems = orderItemRepository.findAllByOrder(order);

        return AdminOrderDetailResponse.from(order, orderItems);
    }

    private Order findOrder(Long orderId) {
        return orderRepository.findById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 주문입니다. orderId=" + orderId));
    }
}