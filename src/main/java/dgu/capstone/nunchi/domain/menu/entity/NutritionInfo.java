package dgu.capstone.nunchi.domain.menu.entity;

import jakarta.persistence.Embeddable;
import lombok.*;

@Embeddable
@Getter
@Builder
@AllArgsConstructor
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class NutritionInfo {

    private Integer calorie;
    private Double protein;
    private Double carbohydrate;
    private Double fat;
    private Integer sodium;
    private Double sugar;
    private Double transFat;
    private Integer cholesterol;
    private Double dietaryFiber;
}
