package dgu.capstone.nunchi.domain.order.repository;

import dgu.capstone.nunchi.domain.order.entity.Order;
import dgu.capstone.nunchi.domain.order.entity.OrderItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface OrderItemRepository extends JpaRepository<OrderItem, Long> {

    List<OrderItem> findAllByOrder(Order order);
}