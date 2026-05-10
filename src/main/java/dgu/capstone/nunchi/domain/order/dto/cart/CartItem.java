package dgu.capstone.nunchi.domain.order.dto.cart;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.util.List;

@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CartItem {

    private String itemId;      // UUID
    private Long menuId;
    private String menuName;
    private String imageUrl;
    private Integer unitPrice;
    private Integer quantity;
    private List<CartOption> options;

    @Getter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class CartOption {
        private Long optionId;
        private String optionName;
        private Integer extraPrice;
    }
}
