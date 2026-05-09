package dgu.capstone.nunchi.domain.order.service;

import dgu.capstone.nunchi.domain.menu.entity.MenuOption;
import dgu.capstone.nunchi.domain.menu.repository.MenuOptionRepository;
import dgu.capstone.nunchi.domain.menu.repository.MenuRepository;
import dgu.capstone.nunchi.domain.order.dto.cart.CartItem;
import dgu.capstone.nunchi.domain.order.dto.request.CartItemAddRequest;
import dgu.capstone.nunchi.domain.order.dto.request.CartItemUpdateRequest;
import dgu.capstone.nunchi.domain.order.dto.response.CartResponse;
import dgu.capstone.nunchi.domain.order.dto.response.OrderItemResponse;
import dgu.capstone.nunchi.domain.order.dto.response.OrderResponse;
import dgu.capstone.nunchi.domain.order.entity.Order;
import dgu.capstone.nunchi.domain.order.entity.OrderItem;
import dgu.capstone.nunchi.domain.order.entity.OrderStatus;
import dgu.capstone.nunchi.domain.order.entity.OrderItemOption;
import dgu.capstone.nunchi.domain.order.repository.CartRedisRepository;
import dgu.capstone.nunchi.domain.order.repository.OrderItemOptionRepository;
import dgu.capstone.nunchi.domain.order.repository.OrderItemRepository;
import dgu.capstone.nunchi.domain.order.repository.OrderRepository;
import dgu.capstone.nunchi.domain.session.entity.KioskSession;
import dgu.capstone.nunchi.domain.session.repository.KioskSessionRepository;
import dgu.capstone.nunchi.global.exception.domainException.MenuException;
import dgu.capstone.nunchi.global.exception.domainException.OrderException;
import dgu.capstone.nunchi.global.exception.domainException.SessionException;
import dgu.capstone.nunchi.global.exception.errorcode.MenuErrorCode;
import dgu.capstone.nunchi.global.exception.errorcode.OrderErrorCode;
import dgu.capstone.nunchi.global.exception.errorcode.SessionErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class OrderService {

    private final CartRedisRepository cartRedisRepository;
    private final MenuRepository menuRepository;
    private final MenuOptionRepository menuOptionRepository;
    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final OrderItemOptionRepository orderItemOptionRepository;
    private final KioskSessionRepository kioskSessionRepository;

    /** 장바구니 조회 */
    public CartResponse getCart(Long sessionId) {
        List<CartItem> items = cartRedisRepository.getItems(sessionId);
        return CartResponse.from(sessionId, items);
    }

    /** 장바구니에 아이템 추가 */
    @Transactional
    public CartResponse addItem(CartItemAddRequest request) {
        // 메뉴 조회 (스냅샷용)
        var menu = menuRepository.findById(request.menuId())
                .orElseThrow(() -> new MenuException(MenuErrorCode.NOT_FOUND_MENU));

        // 옵션 조회 및 CartOption 스냅샷 생성
        List<CartItem.CartOption> cartOptions = new ArrayList<>();
        if (request.optionIds() != null && !request.optionIds().isEmpty()) {
            for (Long optionId : request.optionIds()) {
                MenuOption menuOption = menuOptionRepository.findById(optionId)
                        .orElseThrow(() -> new MenuException(MenuErrorCode.NOT_FOUND_MENU_OPTION));
                cartOptions.add(CartItem.CartOption.builder()
                        .optionId(menuOption.getOptionId())
                        .optionName(menuOption.getName())
                        .extraPrice(menuOption.getExtraPrice())
                        .build());
            }
        }

        // 같은 메뉴 + 동일 옵션 조합이 이미 있으면 수량만 증가, 없으면 새 라인 추가
        List<CartItem> items = new ArrayList<>(cartRedisRepository.getItems(request.sessionId()));
        Set<Long> newOptionIds = cartOptions.stream()
                .map(CartItem.CartOption::getOptionId)
                .collect(Collectors.toSet());

        int existingIdx = -1;
        for (int i = 0; i < items.size(); i++) {
            CartItem it = items.get(i);
            if (!it.getMenuId().equals(menu.getMenuId())) continue;
            Set<Long> existingOptionIds = (it.getOptions() == null ? List.<CartItem.CartOption>of() : it.getOptions()).stream()
                    .map(CartItem.CartOption::getOptionId)
                    .collect(Collectors.toSet());
            if (existingOptionIds.equals(newOptionIds)) {
                existingIdx = i;
                break;
            }
        }

        if (existingIdx >= 0) {
            CartItem prev = items.get(existingIdx);
            CartItem merged = CartItem.builder()
                    .itemId(prev.getItemId())
                    .menuId(prev.getMenuId())
                    .menuName(prev.getMenuName())
                    .unitPrice(prev.getUnitPrice())
                    .quantity(prev.getQuantity() + request.quantity())
                    .options(prev.getOptions())
                    .build();
            items.set(existingIdx, merged);
        } else {
            items.add(CartItem.builder()
                    .itemId(UUID.randomUUID().toString())
                    .menuId(menu.getMenuId())
                    .menuName(menu.getName())
                    .unitPrice(menu.getPrice())
                    .quantity(request.quantity())
                    .options(cartOptions)
                    .build());
        }

        cartRedisRepository.saveItems(request.sessionId(), items);
        return CartResponse.from(request.sessionId(), items);
    }

    /** 장바구니 아이템 수량 수정 */
    @Transactional
    public CartResponse updateItem(Long sessionId, String itemId, CartItemUpdateRequest request) {
        List<CartItem> items = cartRedisRepository.getItems(sessionId);

        boolean exists = items.stream().anyMatch(item -> item.getItemId().equals(itemId));
        if (!exists) {
            throw new OrderException(OrderErrorCode.NOT_FOUND_CART_ITEM);
        }

        List<CartItem> updatedItems = items.stream()
                .map(item -> {
                    if (item.getItemId().equals(itemId)) {
                        return CartItem.builder()
                                .itemId(item.getItemId())
                                .menuId(item.getMenuId())
                                .menuName(item.getMenuName())
                                .unitPrice(item.getUnitPrice())
                                .quantity(request.quantity())
                                .options(item.getOptions())
                                .build();
                    }
                    return item;
                })
                .toList();

        cartRedisRepository.saveItems(sessionId, updatedItems);
        return CartResponse.from(sessionId, updatedItems);
    }

    /** 장바구니 아이템 삭제 */
    @Transactional
    public CartResponse removeItem(Long sessionId, String itemId) {
        List<CartItem> items = cartRedisRepository.getItems(sessionId);

        boolean exists = items.stream().anyMatch(item -> item.getItemId().equals(itemId));
        if (!exists) {
            throw new OrderException(OrderErrorCode.NOT_FOUND_CART_ITEM);
        }

        List<CartItem> updatedItems = items.stream()
                .filter(item -> !item.getItemId().equals(itemId))
                .toList();

        cartRedisRepository.saveItems(sessionId, updatedItems);
        return CartResponse.from(sessionId, updatedItems);
    }

    /** 주문 확정: Redis 장바구니 → PostgreSQL Order + OrderItem + OrderItemOption */
    @Transactional
    public OrderResponse confirmOrder(Long sessionId) {
        List<CartItem> cartItems = cartRedisRepository.getItems(sessionId);

        if (cartItems.isEmpty()) {
            throw new OrderException(OrderErrorCode.EMPTY_CART);
        }

        // 세션에서 orderType 조회
        KioskSession session = kioskSessionRepository.findById(sessionId)
                .orElseThrow(() -> new SessionException(SessionErrorCode.NOT_FOUND_SESSION));

        // Order 생성 및 저장
        Order order = Order.create(sessionId, session.getOrderType());
        orderRepository.save(order);

        int totalAmount = 0;
        List<OrderItemResponse> itemResponses = new ArrayList<>();

        // 각 CartItem → OrderItem + OrderItemOption 저장 (응답도 루프 내에서 함께 구성)
        for (CartItem cartItem : cartItems) {
            OrderItem orderItem = OrderItem.create(
                    order,
                    cartItem.getMenuId(),
                    cartItem.getQuantity(),
                    cartItem.getMenuName(),
                    cartItem.getUnitPrice()
            );
            orderItemRepository.save(orderItem);

            int optionExtra = 0;
            List<OrderItemOption> savedOptions = new ArrayList<>();
            if (cartItem.getOptions() != null) {
                for (CartItem.CartOption cartOption : cartItem.getOptions()) {
                    OrderItemOption itemOption = OrderItemOption.create(
                            orderItem,
                            cartOption.getOptionId(),
                            cartOption.getOptionName(),
                            cartOption.getExtraPrice()
                    );
                    orderItemOptionRepository.save(itemOption);
                    savedOptions.add(itemOption);
                    optionExtra += cartOption.getExtraPrice() != null ? cartOption.getExtraPrice() : 0;
                }
            }

            totalAmount += (cartItem.getUnitPrice() + optionExtra) * cartItem.getQuantity();
            itemResponses.add(OrderItemResponse.from(orderItem, savedOptions));
        }

        // 총금액 업데이트 및 주문 완료 처리
        order.updateTotalAmount(totalAmount);
        order.complete();

        // Redis 장바구니 삭제
        cartRedisRepository.deleteCart(sessionId);

        return OrderResponse.from(order, itemResponses);
    }

    /** 장바구니 전체 비우기 (세션 미존재 시에도 성공 - 멱등성 보장) */
    @Transactional
    public void clearCart(Long sessionId) {
        cartRedisRepository.deleteCart(sessionId);
    }

    /** 주문 취소 */
    @Transactional
    public OrderResponse cancelOrder(Long orderId) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new OrderException(OrderErrorCode.NOT_FOUND_ORDER));

        if (order.getOrderStatus() == OrderStatus.CANCELLED) {
            throw new OrderException(OrderErrorCode.ORDER_ALREADY_CANCELLED);
        }

        order.cancel();

        List<OrderItem> items = orderItemRepository.findAllByOrder(order);
        List<OrderItemResponse> itemResponses = items.stream()
                .map(item -> OrderItemResponse.from(item, orderItemOptionRepository.findAllByOrderItem(item)))
                .toList();

        return OrderResponse.from(order, itemResponses);
    }
}
