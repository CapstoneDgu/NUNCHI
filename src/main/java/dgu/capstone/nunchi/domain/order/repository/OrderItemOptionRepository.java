package dgu.capstone.nunchi.domain.order.repository;

import dgu.capstone.nunchi.domain.order.entity.OrderItemOption;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrderItemOptionRepository extends JpaRepository<OrderItemOption, Long> {
}