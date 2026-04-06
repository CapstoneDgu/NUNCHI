package dgu.capstone.nunchi.domain.order.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Getter
@Builder
@AllArgsConstructor
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Table(name = "order_item")
public class OrderItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "order_item_id")
    private Long orderItemId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id")
    private Order order;

    @Column(name = "menu_id")
    private Long menuId;

    @Column(name = "quantity")
    private Integer quantity;

    // 주문 당시 메뉴명 스냅샷
    @Column(name = "menu_name", length = 255)
    private String menuName;

    // 주문 당시 단가 스냅샷
    @Column(name = "unit_price")
    private Integer unitPrice;

    public static OrderItem create(Order order, Long menuId, Integer quantity, String menuName, Integer unitPrice) {
        return OrderItem.builder()
                .order(order)
                .menuId(menuId)
                .quantity(quantity)
                .menuName(menuName)
                .unitPrice(unitPrice)
                .build();
    }

    public void updateQuantity(Integer quantity) {
        this.quantity = quantity;
    }
}
