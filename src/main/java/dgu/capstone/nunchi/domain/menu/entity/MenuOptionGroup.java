package dgu.capstone.nunchi.domain.menu.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Getter
@Builder
@AllArgsConstructor
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Table(name = "menu_option_group")
public class MenuOptionGroup {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "option_group_id")
    private Long optionGroupId;

    @Column(name = "name", length = 100, nullable = false)
    private String name;

    @Column(name = "is_required")
    @Builder.Default
    private Boolean isRequired = false;

    @Column(name = "max_select")
    private Integer maxSelect;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "menu_id", nullable = false)
    private Menu menu;

    // 정적 팩토리 메서드
    public static MenuOptionGroup create(String name, Boolean isRequired, Integer maxSelect, Menu menu) {
        return MenuOptionGroup.builder()
                .name(name)
                .isRequired(isRequired)
                .maxSelect(maxSelect)
                .menu(menu)
                .build();
    }
}
