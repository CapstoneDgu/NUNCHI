package dgu.capstone.nunchi.domain.menu.dto.response;

import java.util.List;

public record MenuRecommendationResponse(
        List<MenuResponse> lowFat,
        List<MenuResponse> highProtein,
        List<MenuResponse> lowCalorie,
        List<MenuResponse> cold,
        List<MenuResponse> hot,
        MenuResponse bestSeller
) {
}
