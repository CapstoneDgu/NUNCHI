package dgu.capstone.nunchi.domain.menu.entity;

import dgu.capstone.nunchi.global.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Getter
@Builder
@AllArgsConstructor
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Table(name = "menu")
public class Menu extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "menu_id")
    private Long menuId;

    @Column(name = "name", length = 100)
    private String name;

    @Column(name = "price")
    private Integer price;

    @Column(name = "is_sold_out")
    @Builder.Default
    private Boolean isSoldOut = false;

    @Column(name = "image_url", length = 255)
    private String imageUrl;

    @Column(name = "is_recommended")
    @Builder.Default
    private Boolean isRecommended = false;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id", nullable = false)
    private MenuCategory category;

    // 정적 팩토리 메서드
    public static Menu create(String name, Integer price, String imageUrl, MenuCategory category) {
        return Menu.builder()
                .name(name)
                .price(price)
                .imageUrl(imageUrl)
                .category(category)
                .build();
    }

    public void markSoldOut() {
        this.isSoldOut = true;
    }

    public void markAvailable() {
        this.isSoldOut = false;
    }
}
