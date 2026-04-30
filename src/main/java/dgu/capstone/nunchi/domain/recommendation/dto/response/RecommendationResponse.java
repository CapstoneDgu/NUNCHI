package dgu.capstone.nunchi.domain.recommendation.dto.response;

import dgu.capstone.nunchi.domain.recommendation.entity.RecommendType;
import lombok.Builder;

import java.util.List;

@Builder
public record RecommendationResponse(
        RecommendType recommendType,
        List<RecommendationMenuResponse> menus
) {
}
