package dgu.capstone.nunchi.domain.order.repository;

import dgu.capstone.nunchi.domain.order.entity.Order;
import dgu.capstone.nunchi.domain.order.entity.OrderStatus;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface OrderRepository extends JpaRepository<Order, Long> {

    Optional<Order> findBySessionIdAndOrderStatus(Long sessionId, OrderStatus orderStatus);

    long countByCreatedAtBetween(LocalDateTime start, LocalDateTime end);

    long countByCreatedAtBetweenAndOrderStatus(
            LocalDateTime start,
            LocalDateTime end,
            OrderStatus orderStatus
    );

    long countByOrderStatus(OrderStatus orderStatus);

    List<Order> findAllByOrderByCreatedAtDesc(Pageable pageable);

    @Query("""
        SELECT COALESCE(SUM(o.totalAmount), 0)
        FROM Order o
        WHERE o.createdAt BETWEEN :start AND :end
          AND o.orderStatus = :orderStatus
    """)
    Integer sumTotalAmountByCreatedAtBetweenAndOrderStatus(
            @Param("start") LocalDateTime start,
            @Param("end") LocalDateTime end,
            @Param("orderStatus") OrderStatus orderStatus
    );

    List<Order> findAllByCreatedAtBetweenAndOrderStatus(
            LocalDateTime start,
            LocalDateTime end,
            OrderStatus orderStatus
    );
}
