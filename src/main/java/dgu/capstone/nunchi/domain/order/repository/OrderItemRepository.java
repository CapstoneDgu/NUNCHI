package dgu.capstone.nunchi.domain.order.repository;

import dgu.capstone.nunchi.domain.admin.dto.response.AdminTopMenuSalesResponse;
import dgu.capstone.nunchi.domain.menu.entity.Menu;
import dgu.capstone.nunchi.domain.order.entity.Order;
import dgu.capstone.nunchi.domain.order.entity.OrderItem;
import dgu.capstone.nunchi.domain.order.entity.OrderStatus;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

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

    @Query("""
    SELECT new dgu.capstone.nunchi.domain.admin.dto.response.AdminTopMenuSalesResponse(
        oi.menuId,
        oi.menuName,
        COALESCE(SUM(oi.quantity), 0),
        COALESCE(SUM(oi.quantity * oi.unitPrice), 0)
    )
    FROM OrderItem oi
    JOIN oi.order o
    WHERE o.orderStatus = :orderStatus
    GROUP BY oi.menuId, oi.menuName
    ORDER BY SUM(oi.quantity) DESC
""")
    List<AdminTopMenuSalesResponse> findTopMenuSales(
            @Param("orderStatus") OrderStatus orderStatus,
            Pageable pageable
    );
}