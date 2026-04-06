package dgu.capstone.nunchi.domain.order.repository;

import dgu.capstone.nunchi.domain.order.entity.Order;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrderRepository extends JpaRepository<Order, Long> {
}