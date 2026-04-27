package dgu.capstone.nunchi.domain.menu.dto.request;

import dgu.capstone.nunchi.domain.menu.entity.enums.Season;
import dgu.capstone.nunchi.domain.menu.entity.enums.TemperatureType;
import dgu.capstone.nunchi.domain.menu.entity.enums.VegetarianType;

public record MenuFilterRequest(
        Integer maxCalorie,
        Integer minCalorie,
        Double minProtein,
        Double maxSodium,
        Integer maxSpicyLevel,
        Integer minSpicyLevel,
        TemperatureType temperatureType,
        VegetarianType vegetarianType,
        Season season,
        Long categoryId,
        String excludeAllergies,  // "MILK,EGG,WHEAT" 형태로 전달
        Integer minPrice,
        Integer maxPrice,
        Integer limit             // 반환할 최대 메뉴 수 (null이면 제한 없음)
) {}
