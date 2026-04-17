package dgu.capstone.nunchi.domain.order.dto.response;

import dgu.capstone.nunchi.domain.order.entity.OrderItem;
import dgu.capstone.nunchi.domain.order.entity.OrderItemOption;

import java.util.List;

public record OrderItemResponse(
        Long orderItemId,
        Long menuId,
        String menuName,
        Integer unitPrice,
        Integer quantity,
        Integer itemTotal,
        List<OptionInfo> options
) {

    public record OptionInfo(Long optionId, String optionName, Integer extraPrice) {}

    public static OrderItemResponse from(OrderItem item, List<OrderItemOption> options) {
        List<OptionInfo> optionInfos = options.stream()
                .map(opt -> new OptionInfo(opt.getOptionId(), opt.getOptionName(), opt.getExtraPrice()))
                .toList();

        int optionExtra = optionInfos.stream()
                .mapToInt(o -> o.extraPrice() != null ? o.extraPrice() : 0)
                .sum();

        return new OrderItemResponse(
                item.getOrderItemId(),
                item.getMenuId(),
                item.getMenuName(),
                item.getUnitPrice(),
                item.getQuantity(),
                (item.getUnitPrice() + optionExtra) * item.getQuantity(),
                optionInfos
        );
    }
}
