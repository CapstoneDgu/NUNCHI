package dgu.capstone.nunchi.domain.menu.entity;

import dgu.capstone.nunchi.domain.menu.entity.enums.Season;
import dgu.capstone.nunchi.domain.menu.entity.enums.TemperatureType;
import dgu.capstone.nunchi.domain.menu.entity.enums.VegetarianType;
import dgu.capstone.nunchi.domain.menu.entity.enums.AllergyType;
import dgu.capstone.nunchi.global.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.util.HashSet;
import java.util.Set;

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

    @Column(name = "is_recommended")
    @Builder.Default
    private Boolean isRecommended = false;

    @Column(name = "image_url", length = 255)
    private String imageUrl;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id", nullable = false)
    private MenuCategory category;

    // 영양정보 (menu 테이블 컬럼으로 저장)
    @Embedded
    private NutritionInfo nutrition;

    // 알레르기 유발성분 (menu_allergy 별도 테이블)
    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(name = "menu_allergy", joinColumns = @JoinColumn(name = "menu_id"))
    @Enumerated(EnumType.STRING)
    @Column(name = "allergy")
    @Builder.Default
    @org.hibernate.annotations.BatchSize(size = 50)
    private Set<AllergyType> allergies = new HashSet<>();

    // 매운맛 단계 (0=안매움 ~ 5=매우매움)
    @Column(name = "spicy_level")
    @Builder.Default
    private Integer spicyLevel = 0;

    @Enumerated(EnumType.STRING)
    @Column(name = "temperature_type")
    @Builder.Default
    private TemperatureType temperatureType = TemperatureType.HOT;

    @Enumerated(EnumType.STRING)
    @Column(name = "vegetarian_type")
    @Builder.Default
    private VegetarianType vegetarianType = VegetarianType.NONE;

    @Enumerated(EnumType.STRING)
    @Column(name = "season_recommended")
    @Builder.Default
    private Season seasonRecommended = Season.ALL;

    @Column(name = "origin_info", length = 500)
    private String originInfo;

    @Column(name = "floor")
    private Integer floor;

    @Column(name = "restaurant_name", length = 100)
    private String restaurantName;

    // 영업시간. 다중 구간은 콤마로 구분. 예: "11:00-14:00,15:00-16:00"
    @Column(name = "operating_hours", length = 50)
    private String operatingHours;

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
