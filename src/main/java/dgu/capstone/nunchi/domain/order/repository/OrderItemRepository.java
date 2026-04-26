package dgu.capstone.nunchi.domain.order.repository;

import dgu.capstone.nunchi.domain.menu.entity.Menu;
import dgu.capstone.nunchi.domain.order.entity.Order;
import dgu.capstone.nunchi.domain.order.entity.OrderItem;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface OrderItemRepository extends JpaRepository<OrderItem, Long> {

    List<OrderItem> findAllByOrder(Order order);

    @Query("""
        SELECT m
        FROM OrderItem oi
        JOIN Menu m ON m.menuId = oi.menuId
        WHERE m.isSoldOut = false
        GROUP BY m
        ORDER BY SUM(oi.quantity) DESC
    """)
    List<Menu> findPopularMenus(Pageable pageable);
}