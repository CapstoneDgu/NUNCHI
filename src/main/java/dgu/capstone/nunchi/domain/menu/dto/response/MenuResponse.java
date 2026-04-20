package dgu.capstone.nunchi.domain.menu.dto.response;

import dgu.capstone.nunchi.domain.menu.entity.Menu;
import dgu.capstone.nunchi.domain.menu.entity.enums.AllergyType;
import dgu.capstone.nunchi.domain.menu.entity.enums.Season;
import dgu.capstone.nunchi.domain.menu.entity.enums.TemperatureType;
import dgu.capstone.nunchi.domain.menu.entity.enums.VegetarianType;

import java.util.Set;

public record MenuResponse(
        Long menuId,
        String name,
        Integer price,
        Boolean isSoldOut,
        String imageUrl,
        Integer spicyLevel,
        TemperatureType temperatureType,
        VegetarianType vegetarianType,
        Season seasonRecommended,
        Set<AllergyType> allergies,
        Integer calorie
) {

    public static MenuResponse from(Menu menu) {
        return new MenuResponse(
                menu.getMenuId(),
                menu.getName(),
                menu.getPrice(),
                menu.getIsSoldOut(),
                menu.getImageUrl(),
                menu.getSpicyLevel(),
                menu.getTemperatureType(),
                menu.getVegetarianType(),
                menu.getSeasonRecommended(),
                menu.getAllergies(),
                menu.getNutrition() != null ? menu.getNutrition().getCalorie() : null
        );
    }
}
