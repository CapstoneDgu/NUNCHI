package dgu.capstone.nunchi.domain.menu.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Getter
@Builder
@AllArgsConstructor
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Table(name = "menu_option")
public class MenuOption {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "option_id")
    private Long optionId;

    @Column(name = "name", length = 100, nullable = false)
    private String name;

    @Column(name = "extra_price")
    private Integer extraPrice;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "option_group_id", nullable = false)
    private MenuOptionGroup optionGroup;

    // 정적 팩토리 메서드
    public static MenuOption create(String name, Integer extraPrice, MenuOptionGroup optionGroup) {
        return MenuOption.builder()
                .name(name)
                .extraPrice(extraPrice)
                .optionGroup(optionGroup)
                .build();
    }
}
