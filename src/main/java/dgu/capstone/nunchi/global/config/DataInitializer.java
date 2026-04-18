package dgu.capstone.nunchi.global.config;

import dgu.capstone.nunchi.domain.menu.entity.Menu;
import dgu.capstone.nunchi.domain.menu.entity.MenuCategory;
import dgu.capstone.nunchi.domain.menu.entity.MenuOption;
import dgu.capstone.nunchi.domain.menu.entity.MenuOptionGroup;
import dgu.capstone.nunchi.domain.menu.entity.SalesDaily;
import dgu.capstone.nunchi.domain.menu.repository.MenuCategoryRepository;
import dgu.capstone.nunchi.domain.menu.repository.MenuOptionGroupRepository;
import dgu.capstone.nunchi.domain.menu.repository.MenuOptionRepository;
import dgu.capstone.nunchi.domain.menu.repository.MenuRepository;
import dgu.capstone.nunchi.domain.menu.repository.SalesDailyRepository;
import dgu.capstone.nunchi.domain.order.entity.Order;
import dgu.capstone.nunchi.domain.order.entity.OrderItem;
import dgu.capstone.nunchi.domain.order.entity.OrderItemOption;
import dgu.capstone.nunchi.domain.order.repository.OrderItemOptionRepository;
import dgu.capstone.nunchi.domain.order.repository.OrderItemRepository;
import dgu.capstone.nunchi.domain.order.repository.OrderRepository;
import dgu.capstone.nunchi.domain.payment.entity.Payment;
import dgu.capstone.nunchi.domain.payment.entity.PaymentMethod;
import dgu.capstone.nunchi.domain.payment.repository.PaymentRepository;
import dgu.capstone.nunchi.domain.session.entity.AiToolCallLog;
import dgu.capstone.nunchi.domain.session.entity.ConversationMessage;
import dgu.capstone.nunchi.domain.session.entity.KioskSession;
import dgu.capstone.nunchi.domain.session.entity.MessageRole;
import dgu.capstone.nunchi.domain.session.entity.SessionMode;
import dgu.capstone.nunchi.domain.session.repository.AiToolCallLogRepository;
import dgu.capstone.nunchi.domain.session.repository.ConversationMessageRepository;
import dgu.capstone.nunchi.domain.session.repository.KioskSessionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;

@Component
@Profile("local")
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private static final int SALES_HISTORY_DAYS = 7;

    private final MenuCategoryRepository menuCategoryRepository;
    private final MenuRepository menuRepository;
    private final MenuOptionGroupRepository menuOptionGroupRepository;
    private final MenuOptionRepository menuOptionRepository;
    private final SalesDailyRepository salesDailyRepository;
    private final KioskSessionRepository kioskSessionRepository;
    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final OrderItemOptionRepository orderItemOptionRepository;
    private final PaymentRepository paymentRepository;
    private final ConversationMessageRepository conversationMessageRepository;
    private final AiToolCallLogRepository aiToolCallLogRepository;

    @Override
    @Transactional
    public void run(String... args) {
        if (menuCategoryRepository.count() > 0) {
            return;
        }

        MenuSeedData menuData = seedMenus();
        seedSalesHistory(menuData);

        SessionSeedData sessionData = seedSessions();
        seedConversationMessages(sessionData.avatarSession());
        seedAiToolCallLogs(sessionData.avatarSession());
        seedOrdersAndPayments(menuData, sessionData);
    }

    private MenuSeedData seedMenus() {
        MenuCategory catBurger = menuCategoryRepository.save(MenuCategory.create("버거", 1));
        MenuCategory catSide = menuCategoryRepository.save(MenuCategory.create("사이드", 2));
        MenuCategory catDrink = menuCategoryRepository.save(MenuCategory.create("음료", 3));
        MenuCategory catSet = menuCategoryRepository.save(MenuCategory.create("세트", 4));

        Menu burger1 = menuRepository.save(Menu.create("불고기버거", 4500, "/images/menu/bulgogi.jpg", catBurger));
        Menu burger2 = menuRepository.save(Menu.create("치킨버거", 4000, "/images/menu/chicken.jpg", catBurger));
        Menu burger3 = menuRepository.save(Menu.builder()
                .name("새우버거")
                .price(4200)
                .imageUrl("/images/menu/shrimp.jpg")
                .category(catBurger)
                .isSoldOut(true)
                .isRecommended(false)
                .build());
        Menu burger4 = menuRepository.save(Menu.builder()
                .name("더블패티버거")
                .price(5500)
                .imageUrl("/images/menu/double.jpg")
                .category(catBurger)
                .isSoldOut(false)
                .isRecommended(true)
                .build());

        Menu side1 = menuRepository.save(Menu.create("감자튀김", 1500, "/images/menu/fries.jpg", catSide));
        Menu side2 = menuRepository.save(Menu.create("어니언링", 2000, "/images/menu/onion.jpg", catSide));
        Menu side3 = menuRepository.save(Menu.builder()
                .name("코울슬로")
                .price(1200)
                .imageUrl("/images/menu/coleslaw.jpg")
                .category(catSide)
                .isSoldOut(false)
                .isRecommended(true)
                .build());

        Menu drink1 = menuRepository.save(Menu.create("콜라", 1000, "/images/menu/cola.jpg", catDrink));
        Menu drink2 = menuRepository.save(Menu.create("사이다", 1000, "/images/menu/cider.jpg", catDrink));
        Menu drink3 = menuRepository.save(Menu.create("오렌지주스", 1500, "/images/menu/oj.jpg", catDrink));
        Menu drink4 = menuRepository.save(Menu.builder()
                .name("아메리카노")
                .price(2000)
                .imageUrl("/images/menu/americano.jpg")
                .category(catDrink)
                .isSoldOut(false)
                .isRecommended(true)
                .build());

        Menu set1 = menuRepository.save(Menu.builder()
                .name("불고기버거세트")
                .price(6500)
                .imageUrl("/images/menu/bulgogi_set.jpg")
                .category(catSet)
                .isSoldOut(false)
                .isRecommended(true)
                .build());
        Menu set2 = menuRepository.save(Menu.create("치킨버거세트", 6000, "/images/menu/chicken_set.jpg", catSet));

        MenuOptionGroup sizeGroup = menuOptionGroupRepository.save(
                MenuOptionGroup.create("사이즈", false, 1, burger1));
        menuOptionRepository.save(MenuOption.create("기본", 0, sizeGroup));
        MenuOption optLarge = menuOptionRepository.save(MenuOption.create("라지", 500, sizeGroup));

        MenuOptionGroup sauceGroup = menuOptionGroupRepository.save(
                MenuOptionGroup.create("소스", false, 2, burger1));
        MenuOption optKetchup = menuOptionRepository.save(MenuOption.create("케첩", 0, sauceGroup));
        menuOptionRepository.save(MenuOption.create("머스타드", 0, sauceGroup));
        menuOptionRepository.save(MenuOption.create("마요네즈", 0, sauceGroup));

        MenuOptionGroup cookGroup = menuOptionGroupRepository.save(
                MenuOptionGroup.create("패티 굽기", true, 1, burger4));
        menuOptionRepository.save(MenuOption.create("웰던", 0, cookGroup));
        menuOptionRepository.save(MenuOption.create("미디엄", 0, cookGroup));
        menuOptionRepository.save(MenuOption.create("레어", 0, cookGroup));

        MenuOptionGroup saltGroup = menuOptionGroupRepository.save(
                MenuOptionGroup.create("소금 옵션", false, 1, side1));
        menuOptionRepository.save(MenuOption.create("소금 없이", 0, saltGroup));
        menuOptionRepository.save(MenuOption.create("소금 추가", 0, saltGroup));

        MenuOptionGroup drinkSize1 = menuOptionGroupRepository.save(
                MenuOptionGroup.create("사이즈", true, 1, drink1));
        menuOptionRepository.save(MenuOption.create("S", 0, drinkSize1));
        menuOptionRepository.save(MenuOption.create("M", 300, drinkSize1));
        menuOptionRepository.save(MenuOption.create("L", 500, drinkSize1));

        MenuOptionGroup drinkSize2 = menuOptionGroupRepository.save(
                MenuOptionGroup.create("사이즈", true, 1, drink2));
        menuOptionRepository.save(MenuOption.create("S", 0, drinkSize2));
        menuOptionRepository.save(MenuOption.create("M", 300, drinkSize2));
        menuOptionRepository.save(MenuOption.create("L", 500, drinkSize2));

        MenuOptionGroup setDrink = menuOptionGroupRepository.save(
                MenuOptionGroup.create("음료 선택", true, 1, set1));
        menuOptionRepository.save(MenuOption.create("콜라", 0, setDrink));
        menuOptionRepository.save(MenuOption.create("사이다", 0, setDrink));
        menuOptionRepository.save(MenuOption.create("오렌지주스", 500, setDrink));

        return new MenuSeedData(
                burger1,
                burger2,
                burger3,
                burger4,
                side1,
                side2,
                side3,
                drink1,
                drink2,
                drink3,
                drink4,
                set1,
                set2,
                optLarge,
                optKetchup
        );
    }

    private void seedSalesHistory(MenuSeedData menuData) {
        LocalDate today = LocalDate.now();

        for (int i = SALES_HISTORY_DAYS - 1; i >= 0; i--) {
            LocalDate date = today.minusDays(i);
            salesDailyRepository.save(SalesDaily.create(date, 30 + i * 3, (30 + i * 3) * 4500, menuData.bulgogiBurger()));
            salesDailyRepository.save(SalesDaily.create(date, 20 + i * 2, (20 + i * 2) * 4000, menuData.chickenBurger()));
            salesDailyRepository.save(SalesDaily.create(date, 25 + i, (25 + i) * 6500, menuData.bulgogiBurgerSet()));
            salesDailyRepository.save(SalesDaily.create(date, 40 + i * 4, (40 + i * 4) * 1500, menuData.frenchFries()));
            salesDailyRepository.save(SalesDaily.create(date, 50 + i * 5, (50 + i * 5) * 1000, menuData.cola()));
        }
    }

    private SessionSeedData seedSessions() {
        KioskSession activeSession = kioskSessionRepository.save(KioskSession.create(SessionMode.NORMAL, "ko"));
        KioskSession avatarSession = kioskSessionRepository.save(KioskSession.create(SessionMode.AVATAR, "ko"));
        KioskSession completedSession = kioskSessionRepository.save(KioskSession.create(SessionMode.NORMAL, "ko"));
        KioskSession expiredSession = kioskSessionRepository.save(KioskSession.create(SessionMode.AVATAR, "ko"));

        completedSession.complete();
        expiredSession.expire();

        return new SessionSeedData(activeSession, avatarSession, completedSession, expiredSession);
    }

    private void seedConversationMessages(KioskSession avatarSession) {
        conversationMessageRepository.save(
                ConversationMessage.create(avatarSession, MessageRole.USER, "안녕하세요, 메뉴 추천해 주세요"));
        conversationMessageRepository.save(
                ConversationMessage.create(avatarSession, MessageRole.ASSISTANT, "안녕하세요! 오늘의 추천 메뉴는 더블패티버거와 불고기버거세트입니다."));
        conversationMessageRepository.save(
                ConversationMessage.create(avatarSession, MessageRole.USER, "불고기버거세트 하나 주세요"));
        conversationMessageRepository.save(
                ConversationMessage.create(avatarSession, MessageRole.ASSISTANT, "불고기버거세트 1개를 장바구니에 담았습니다. 음료는 어떤 걸로 하시겠어요?"));
        conversationMessageRepository.save(
                ConversationMessage.create(avatarSession, MessageRole.USER, "콜라로 주세요"));
        conversationMessageRepository.save(
                ConversationMessage.create(avatarSession, MessageRole.ASSISTANT, "콜라로 설정했습니다. 결제를 진행할까요?"));
    }

    private void seedAiToolCallLogs(KioskSession avatarSession) {
        aiToolCallLogRepository.save(AiToolCallLog.create(
                avatarSession,
                "recommend_menu",
                "{\"userText\":\"안녕하세요, 메뉴 추천해 주세요\",\"mode\":\"AVATAR\",\"language\":\"ko\"}",
                "{\"recommendedMenus\":[{\"name\":\"더블패티버거\"},{\"name\":\"불고기버거세트\"}]}"
        ));

        aiToolCallLogRepository.save(AiToolCallLog.create(
                avatarSession,
                "add_to_cart",
                "{\"menuName\":\"불고기버거세트\",\"quantity\":1}",
                "{\"cartItems\":[{\"menuName\":\"불고기버거세트\",\"quantity\":1}],\"orderStatus\":\"PENDING\"}"
        ));

        aiToolCallLogRepository.save(AiToolCallLog.create(
                avatarSession,
                "select_menu_option",
                "{\"menuName\":\"불고기버거세트\",\"optionGroup\":\"음료 선택\",\"optionName\":\"콜라\"}",
                "{\"selectedOption\":{\"optionGroup\":\"음료 선택\",\"optionName\":\"콜라\"}}"
        ));
    }

    private void seedOrdersAndPayments(MenuSeedData menuData, SessionSeedData sessionData) {
        Order orderPending = orderRepository.save(Order.create(sessionData.activeSession().getSessionId()));

        Order orderCompleted = orderRepository.save(Order.create(sessionData.completedSession().getSessionId()));
        OrderItem completedBurgerItem = orderItemRepository.save(
                OrderItem.create(orderCompleted, menuData.bulgogiBurger().getMenuId(), 2, "불고기버거", 4500));
        orderItemRepository.save(
                OrderItem.create(orderCompleted, menuData.frenchFries().getMenuId(), 1, "감자튀김", 1500));
        orderItemOptionRepository.save(
                OrderItemOption.create(completedBurgerItem, menuData.largeOption().getOptionId(), "라지", 500));
        orderItemOptionRepository.save(
                OrderItemOption.create(completedBurgerItem, menuData.ketchupOption().getOptionId(), "케첩", 0));
        orderCompleted.updateTotalAmount(10500);
        orderCompleted.complete();

        Order orderCancelled = orderRepository.save(Order.create(sessionData.expiredSession().getSessionId()));
        orderItemRepository.save(
                OrderItem.create(orderCancelled, menuData.cola().getMenuId(), 1, "콜라", 1000));
        orderCancelled.cancel();

        Payment paymentSuccess = paymentRepository.save(
                Payment.create(orderCompleted.getOrderId(), PaymentMethod.IC_CARD));
        paymentSuccess.success();

        paymentRepository.save(Payment.create(orderPending.getOrderId(), PaymentMethod.VEIN_AUTH));

        Payment paymentFailed = paymentRepository.save(
                Payment.create(orderCancelled.getOrderId(), PaymentMethod.IC_CARD));
        paymentFailed.fail();
    }

    private record MenuSeedData(
            Menu bulgogiBurger,
            Menu chickenBurger,
            Menu shrimpBurger,
            Menu doublePattyBurger,
            Menu frenchFries,
            Menu onionRings,
            Menu coleslaw,
            Menu cola,
            Menu cider,
            Menu orangeJuice,
            Menu americano,
            Menu bulgogiBurgerSet,
            Menu chickenBurgerSet,
            MenuOption largeOption,
            MenuOption ketchupOption
    ) {
    }

    private record SessionSeedData(
            KioskSession activeSession,
            KioskSession avatarSession,
            KioskSession completedSession,
            KioskSession expiredSession
    ) {
    }
}
