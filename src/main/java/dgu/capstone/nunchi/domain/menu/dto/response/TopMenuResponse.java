package dgu.capstone.nunchi.domain.menu.dto.response;

public record TopMenuResponse(
        Long menuId,
        String name,
        Integer price,
        Boolean isSoldOut,
        Long quantitySold,
        String imageUrl,
        String restaurantName,
        Integer floor
) {
}
