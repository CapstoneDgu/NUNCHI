package dgu.capstone.nunchi.domain.menu.entity;

import dgu.capstone.nunchi.global.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Getter
@Builder
@AllArgsConstructor
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Table(name = "menu_category")
public class MenuCategory extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "category_id")
    private Long categoryId;

    @Column(name = "name", length = 50, nullable = false)
    private String name;

    @Column(name = "display_order")
    private Integer displayOrder;

    // 정적 팩토리 메서드
    public static MenuCategory create(String name, Integer displayOrder) {
        return MenuCategory.builder()
                .name(name)
                .displayOrder(displayOrder)
                .build();
    }
}
