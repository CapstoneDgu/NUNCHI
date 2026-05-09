package dgu.capstone.nunchi.domain.order.entity;

import dgu.capstone.nunchi.global.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Getter
@Builder
@AllArgsConstructor
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Table(name = "orders")
public class Order extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "order_id")
    private Long orderId;

    @Column(name = "session_id")
    private Long sessionId;

    @Column(name = "total_amount")
    @Builder.Default
    private Integer totalAmount = 0;

    @Enumerated(EnumType.STRING)
    @Column(name = "order_status", length = 20)
    @Builder.Default
    private OrderStatus orderStatus = OrderStatus.PENDING;

    @Enumerated(EnumType.STRING)
    @Column(name = "order_type", length = 10, nullable = false)
    private OrderType orderType;

    public static Order create(Long sessionId, OrderType orderType) {
        return Order.builder()
                .sessionId(sessionId)
                .orderType(orderType)
                .build();
    }

    public void updateTotalAmount(Integer totalAmount) {
        this.totalAmount = totalAmount;
    }

    public void complete() {
        this.orderStatus = OrderStatus.COMPLETED;
    }

    public void cancel() {
        this.orderStatus = OrderStatus.CANCELLED;
    }

    public void updateStatus(OrderStatus orderStatus) {
        this.orderStatus = orderStatus;
    }
}
