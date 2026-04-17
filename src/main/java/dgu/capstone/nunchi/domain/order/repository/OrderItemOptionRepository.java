package dgu.capstone.nunchi.domain.order.repository;

import dgu.capstone.nunchi.domain.order.entity.OrderItem;
import dgu.capstone.nunchi.domain.order.entity.OrderItemOption;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface OrderItemOptionRepository extends JpaRepository<OrderItemOption, Long> {

    List<OrderItemOption> findAllByOrderItem(OrderItem orderItem);

    void deleteAllByOrderItem(OrderItem orderItem);
}