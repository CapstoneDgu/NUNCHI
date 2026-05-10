package dgu.capstone.nunchi.domain.menu.entity;

import dgu.capstone.nunchi.global.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;

@Entity
@Getter
@Builder
@AllArgsConstructor
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Table(name = "sales_daily")
public class SalesDaily extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "sales_date", nullable = false)
    private LocalDate salesDate;

    @Column(name = "quantity_sold", nullable = false)
    private Integer quantitySold;

    @Column(name = "sales_amount", nullable = false)
    private Integer salesAmount;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "menu_id")
    private Menu menu;

    public static SalesDaily create(LocalDate salesDate, Integer quantitySold, Integer salesAmount, Menu menu) {
        return SalesDaily.builder()
                .salesDate(salesDate)
                .quantitySold(quantitySold)
                .salesAmount(salesAmount)
                .menu(menu)
                .build();
    }

    public void addSales(int quantity, int amount) {
        this.quantitySold += quantity;
        this.salesAmount += amount;
    }
}
