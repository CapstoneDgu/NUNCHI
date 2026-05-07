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
        Boolean isRecommended,
        String imageUrl,
        Integer spicyLevel,
        TemperatureType temperatureType,
        VegetarianType vegetarianType,
        Season seasonRecommended,
        Set<AllergyType> allergies,
        Integer calorie,
        Integer floor,
        String restaurantName,
        String operatingHours
) {

    public static MenuResponse from(Menu menu) {
        return new MenuResponse(
                menu.getMenuId(),
                menu.getName(),
                menu.getPrice(),
                menu.getIsSoldOut(),
                menu.getIsRecommended(),
                menu.getImageUrl(),
                menu.getSpicyLevel(),
                menu.getTemperatureType(),
                menu.getVegetarianType(),
                menu.getSeasonRecommended(),
                new java.util.HashSet<>(menu.getAllergies()),
                menu.getNutrition() != null ? menu.getNutrition().getCalorie() : null,
                menu.getFloor(),
                menu.getRestaurantName(),
                menu.getOperatingHours()
        );
    }
}
