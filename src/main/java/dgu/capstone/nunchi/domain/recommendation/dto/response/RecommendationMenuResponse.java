package dgu.capstone.nunchi.domain.recommendation.dto.response;

import dgu.capstone.nunchi.domain.menu.entity.Menu;
import lombok.Builder;

@Builder
public record RecommendationMenuResponse(
        Long menuId,
        String name,
        Integer price,
        String imageUrl,
        String reason
) {
    public static RecommendationMenuResponse from(Menu menu, String reason){
        return RecommendationMenuResponse.builder()
                .menuId(menu.getMenuId())
                .name(menu.getName())
                .price(menu.getPrice())
                .imageUrl(menu.getImageUrl())
                .reason(reason)
                .build();
    }
}
