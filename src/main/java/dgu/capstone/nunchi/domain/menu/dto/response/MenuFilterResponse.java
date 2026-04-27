package dgu.capstone.nunchi.domain.menu.dto.response;

import dgu.capstone.nunchi.domain.menu.entity.Menu;
import dgu.capstone.nunchi.domain.menu.entity.NutritionInfo;
import dgu.capstone.nunchi.domain.menu.entity.enums.AllergyType;
import dgu.capstone.nunchi.domain.menu.entity.enums.Season;
import dgu.capstone.nunchi.domain.menu.entity.enums.TemperatureType;
import dgu.capstone.nunchi.domain.menu.entity.enums.VegetarianType;

import java.util.HashSet;
import java.util.Set;

public record MenuFilterResponse(
        Long menuId,
        String name,
        Integer price,
        Long categoryId,
        String imageUrl,
        Integer spicyLevel,
        TemperatureType temperatureType,
        VegetarianType vegetarianType,
        Season seasonRecommended,
        Set<AllergyType> allergies,
        Boolean isSoldOut,
        NutritionResponse nutrition
) {

    public record NutritionResponse(
            Integer calorie,
            Double protein,
            Double carbohydrate,
            Double fat,
            Integer sodium,
            Double sugar,
            Double transFat,
            Integer cholesterol,
            Double dietaryFiber
    ) {
        public static NutritionResponse from(NutritionInfo info) {
            if (info == null) return null;
            return new NutritionResponse(
                    info.getCalorie(),
                    info.getProtein(),
                    info.getCarbohydrate(),
                    info.getFat(),
                    info.getSodium(),
                    info.getSugar(),
                    info.getTransFat(),
                    info.getCholesterol(),
                    info.getDietaryFiber()
            );
        }
    }

    public static MenuFilterResponse from(Menu menu) {
        return new MenuFilterResponse(
                menu.getMenuId(),
                menu.getName(),
                menu.getPrice(),
                menu.getCategory().getCategoryId(),
                menu.getImageUrl(),
                menu.getSpicyLevel(),
                menu.getTemperatureType(),
                menu.getVegetarianType(),
                menu.getSeasonRecommended(),
                new HashSet<>(menu.getAllergies()),
                menu.getIsSoldOut(),
                NutritionResponse.from(menu.getNutrition())
        );
    }
}
