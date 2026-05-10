package dgu.capstone.nunchi.domain.order.dto.response;

import dgu.capstone.nunchi.domain.order.dto.cart.CartItem;

import java.util.List;

public record CartResponse(
        Long sessionId,
        List<CartItemInfo> items,
        Integer totalAmount
) {

    public record CartItemInfo(
            String itemId,
            Long menuId,
            String menuName,
            String imageUrl,
            Integer unitPrice,
            Integer quantity,
            Integer itemTotal,
            List<CartOptionInfo> options
    ) {
        public record CartOptionInfo(Long optionId, String optionName, Integer extraPrice) {}

        public static CartItemInfo from(CartItem item) {
            int optionExtra = item.getOptions() == null ? 0 :
                    item.getOptions().stream().mapToInt(o -> o.getExtraPrice() != null ? o.getExtraPrice() : 0).sum();
            int itemTotal = (item.getUnitPrice() + optionExtra) * item.getQuantity();

            List<CartOptionInfo> options = item.getOptions() == null ? List.of() :
                    item.getOptions().stream()
                            .map(o -> new CartOptionInfo(o.getOptionId(), o.getOptionName(), o.getExtraPrice()))
                            .toList();

            return new CartItemInfo(item.getItemId(), item.getMenuId(), item.getMenuName(),
                    item.getImageUrl(), item.getUnitPrice(), item.getQuantity(), itemTotal, options);
        }
    }

    public static CartResponse from(Long sessionId, List<CartItem> items) {
        List<CartItemInfo> itemInfos = items.stream().map(CartItemInfo::from).toList();
        int total = itemInfos.stream().mapToInt(CartItemInfo::itemTotal).sum();
        return new CartResponse(sessionId, itemInfos, total);
    }
}
