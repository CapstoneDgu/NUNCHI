package dgu.capstone.nunchi.domain.order.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Getter
@Builder
@AllArgsConstructor
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Table(name = "order_item_option")
public class OrderItemOption {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "order_item_option_id")
    private Long orderItemOptionId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_item_id", nullable = false)
    private OrderItem orderItem;

    @Column(name = "option_id", nullable = false)
    private Long optionId;

    // 주문 당시 옵션명 스냅샷
    @Column(name = "option_name", length = 100)
    private String optionName;

    // 주문 당시 추가금액 스냅샷
    @Column(name = "extra_price")
    private Integer extraPrice;

    public static OrderItemOption create(OrderItem orderItem, Long optionId, String optionName, Integer extraPrice) {
        return OrderItemOption.builder()
                .orderItem(orderItem)
                .optionId(optionId)
                .optionName(optionName)
                .extraPrice(extraPrice)
                .build();
    }
}
