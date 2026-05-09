package dgu.capstone.nunchi.global.config;

import dgu.capstone.nunchi.domain.menu.entity.*;
import dgu.capstone.nunchi.domain.menu.entity.enums.AllergyType;
import dgu.capstone.nunchi.domain.menu.entity.enums.Season;
import dgu.capstone.nunchi.domain.menu.entity.enums.TemperatureType;
import dgu.capstone.nunchi.domain.menu.entity.enums.VegetarianType;
import dgu.capstone.nunchi.domain.menu.repository.*;
import dgu.capstone.nunchi.domain.order.entity.Order;
import dgu.capstone.nunchi.domain.order.entity.OrderItem;
import dgu.capstone.nunchi.domain.order.entity.OrderType;
import dgu.capstone.nunchi.domain.order.repository.OrderItemOptionRepository;
import dgu.capstone.nunchi.domain.order.repository.OrderItemRepository;
import dgu.capstone.nunchi.domain.order.repository.OrderRepository;
import dgu.capstone.nunchi.domain.payment.entity.Payment;
import dgu.capstone.nunchi.domain.payment.entity.PaymentMethod;
import dgu.capstone.nunchi.domain.payment.repository.PaymentRepository;
import dgu.capstone.nunchi.domain.session.entity.*;
import dgu.capstone.nunchi.domain.session.repository.AiToolCallLogRepository;
import dgu.capstone.nunchi.domain.session.repository.ConversationMessageRepository;
import dgu.capstone.nunchi.domain.session.repository.KioskSessionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.HashSet;
import java.util.Set;

@Component
@Profile({"local", "dev"})
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
        if (menuCategoryRepository.count() > 0) return;

        MenuSeedData menuData = seedMenus();
        seedSalesHistory(menuData);
        SessionSeedData sessionData = seedSessions();
        seedConversationMessages(sessionData.avatarSession());
        seedAiToolCallLogs(sessionData.avatarSession());
        seedOrdersAndPayments(menuData, sessionData);
    }

    private MenuSeedData seedMenus() {

        // ===== 카테고리 =====
        MenuCategory catBap      = menuCategoryRepository.save(MenuCategory.create("밥류", 1));
        MenuCategory catDeopbap  = menuCategoryRepository.save(MenuCategory.create("덮밥류", 2));
        MenuCategory catCheolpan = menuCategoryRepository.save(MenuCategory.create("철판류", 3));
        MenuCategory catMyeon    = menuCategoryRepository.save(MenuCategory.create("면류", 4));
        MenuCategory catSet      = menuCategoryRepository.save(MenuCategory.create("세트메뉴", 5));
        MenuCategory catExtra    = menuCategoryRepository.save(MenuCategory.create("추가메뉴", 6));
        MenuCategory catDrink    = menuCategoryRepository.save(MenuCategory.create("음료", 7));

        // ===== 밥류 =====
        Menu teriyakiChicken = menuRepository.save(Menu.builder()
                .name("데리야끼치킨솥밥").price(7500).imageUrl("/images/menu/밥류/데리야끼치킨솥밥.png")
                .category(catBap).isSoldOut(false).isRecommended(true)
                .nutrition(nutrition(650, 28.0, 90.0, 14.0, 820, 8.0, 0.1, 75, 3.0))
                .allergies(allergies(AllergyType.WHEAT, AllergyType.SOY, AllergyType.CHICKEN, AllergyType.EGG))
                .spicyLevel(0).temperatureType(TemperatureType.HOT).vegetarianType(VegetarianType.NONE)
                .seasonRecommended(Season.ALL).originInfo("쌀:국내산, 닭고기:국내산").floor(1).restaurantName("솥앤누들").build());

        Menu charcoalPork = menuRepository.save(Menu.builder()
                .name("숯불삼겹솥밥").price(8000).imageUrl("/images/menu/밥류/숯불삼겹솥밥.png")
                .category(catBap).isSoldOut(false)
                .nutrition(nutrition(780, 25.0, 88.0, 24.0, 760, 3.0, 0.2, 80, 2.5))
                .allergies(allergies(AllergyType.WHEAT, AllergyType.SOY, AllergyType.PORK))
                .spicyLevel(0).temperatureType(TemperatureType.HOT).vegetarianType(VegetarianType.NONE)
                .seasonRecommended(Season.ALL).originInfo("쌀:국내산, 돼지고기:국내산").floor(1).restaurantName("솥앤누들").build());

        Menu tunaMayo = menuRepository.save(Menu.builder()
                .name("참치마요솥밥").price(7000).imageUrl("/images/menu/밥류/참치마요솥밥.png")
                .category(catBap).isSoldOut(false)
                .nutrition(nutrition(620, 22.0, 85.0, 16.0, 680, 4.0, 0.1, 45, 2.0))
                .allergies(allergies(AllergyType.EGG, AllergyType.SOY))
                .spicyLevel(0).temperatureType(TemperatureType.HOT).vegetarianType(VegetarianType.NONE)
                .seasonRecommended(Season.ALL).originInfo("쌀:국내산, 참치:원양산").floor(1).restaurantName("솥앤누들").build());

        Menu cornCheese = menuRepository.save(Menu.builder()
                .name("콘치즈솥밥").price(7000).imageUrl("/images/menu/밥류/콘치즈솥밥.png")
                .category(catBap).isSoldOut(false)
                .nutrition(nutrition(600, 15.0, 92.0, 13.0, 720, 6.0, 0.2, 30, 3.5))
                .allergies(allergies(AllergyType.MILK, AllergyType.EGG, AllergyType.WHEAT))
                .spicyLevel(0).temperatureType(TemperatureType.HOT).vegetarianType(VegetarianType.VEGETARIAN)
                .seasonRecommended(Season.ALL).originInfo("쌀:국내산, 옥수수:미국산, 치즈:뉴질랜드산").floor(1).restaurantName("솥앤누들").build());

        Menu octopusPork = menuRepository.save(Menu.builder()
                .name("낙지삼겹솥밥").price(8500).imageUrl("/images/menu/밥류/낙지삼겹솥밥.png")
                .category(catBap).isSoldOut(false)
                .nutrition(nutrition(720, 27.0, 82.0, 22.0, 980, 5.0, 0.2, 120, 2.0))
                .allergies(allergies(AllergyType.SQUID, AllergyType.PORK, AllergyType.WHEAT, AllergyType.SOY))
                .spicyLevel(4).temperatureType(TemperatureType.HOT).vegetarianType(VegetarianType.NONE)
                .seasonRecommended(Season.FALL).originInfo("쌀:국내산, 낙지:국내산, 돼지고기:국내산").floor(1).restaurantName("솥앤누들").build());

        Menu spamKimchi = menuRepository.save(Menu.builder()
                .name("스팸김치솥밥").price(7500).imageUrl("/images/menu/밥류/스팸김치솥밥.png")
                .category(catBap).isSoldOut(false)
                .nutrition(nutrition(700, 20.0, 88.0, 18.0, 1100, 4.0, 0.3, 55, 3.0))
                .allergies(allergies(AllergyType.PORK, AllergyType.WHEAT, AllergyType.SOY))
                .spicyLevel(1).temperatureType(TemperatureType.HOT).vegetarianType(VegetarianType.NONE)
                .seasonRecommended(Season.ALL).originInfo("쌀:국내산, 돼지고기:미국산, 배추:국내산").floor(1).restaurantName("솥앤누들").build());

        Menu jangjorimButter = menuRepository.save(Menu.builder()
                .name("장조림버터솥밥").price(7500).imageUrl("/images/menu/jangjorim_butter.jpg")
                .category(catBap).isSoldOut(false)
                .nutrition(nutrition(680, 26.0, 86.0, 16.0, 750, 5.0, 0.2, 85, 2.0))
                .allergies(allergies(AllergyType.BEEF, AllergyType.MILK, AllergyType.WHEAT, AllergyType.SOY, AllergyType.EGG))
                .spicyLevel(0).temperatureType(TemperatureType.HOT).vegetarianType(VegetarianType.NONE)
                .seasonRecommended(Season.WINTER).originInfo("쌀:국내산, 쇠고기:호주산").floor(1).restaurantName("솥앤누들").build());

        Menu flyingFishBulgogi = menuRepository.save(Menu.builder()
                .name("날치알김치불고기솥밥").price(8500).imageUrl("/images/menu/flying_fish_bulgogi.jpg")
                .category(catBap).isSoldOut(false)
                .nutrition(nutrition(740, 29.0, 84.0, 20.0, 920, 6.0, 0.1, 90, 2.5))
                .allergies(allergies(AllergyType.BEEF, AllergyType.WHEAT, AllergyType.SOY, AllergyType.EGG))
                .spicyLevel(1).temperatureType(TemperatureType.HOT).vegetarianType(VegetarianType.NONE)
                .seasonRecommended(Season.ALL).originInfo("쌀:국내산, 쇠고기:국내산, 날치알:러시아산").floor(1).restaurantName("솥앤누들").build());

        Menu spamLunchbox = menuRepository.save(Menu.builder()
                .name("스팸도시락").price(5500).imageUrl("/images/menu/밥류/스팸도시락.png")
                .category(catBap).isSoldOut(false)
                .nutrition(nutrition(620, 18.0, 82.0, 20.0, 980, 3.0, 0.3, 50, 2.0))
                .allergies(allergies(AllergyType.PORK, AllergyType.WHEAT, AllergyType.SOY))
                .spicyLevel(0).temperatureType(TemperatureType.HOT).vegetarianType(VegetarianType.NONE)
                .seasonRecommended(Season.ALL).originInfo("쌀:국내산, 돼지고기:미국산").floor(1).restaurantName("솥앤누들").build());

        // 2층 더진국 (국밥류) — 영업시간: 점심+오후
        menuRepository.save(Menu.builder()
                .name("수육국밥").price(6800).imageUrl("/images/menu/밥류/suyuk_gukbap.png")
                .category(catBap).isSoldOut(false)
                .nutrition(nutrition(600, 35.0, 70.0, 18.0, 1700, 5.0, 0.2, 90, 3.0))
                .allergies(allergies(AllergyType.PORK))
                .spicyLevel(0).temperatureType(TemperatureType.HOT).vegetarianType(VegetarianType.NONE)
                .seasonRecommended(Season.ALL).originInfo("돼지고기:국내산, 대파:국내산, 양파:국내산, 마늘:국내산").floor(2).restaurantName("더진국")
                .operatingHours("11:00-14:00,15:00-16:00").build());

        menuRepository.save(Menu.builder()
                .name("순대국밥").price(6800).imageUrl("/images/menu/밥류/sundae_gukbap.png")
                .category(catBap).isSoldOut(false)
                .nutrition(nutrition(620, 30.0, 75.0, 20.0, 1800, 4.0, 0.3, 100, 3.0))
                .allergies(allergies(AllergyType.PORK))
                .spicyLevel(0).temperatureType(TemperatureType.HOT).vegetarianType(VegetarianType.NONE)
                .seasonRecommended(Season.ALL).originInfo("돼지고기(순대 포함):국내산, 양파:국내산, 마늘:국내산").floor(2).restaurantName("더진국")
                .operatingHours("11:00-14:00,15:00-16:00").build());

        menuRepository.save(Menu.builder()
                .name("얼큰국밥").price(7000).imageUrl("/images/menu/밥류/eolkeun_gukbap.png")
                .category(catBap).isSoldOut(false)
                .nutrition(nutrition(580, 28.0, 70.0, 17.0, 1900, 6.0, 0.2, 80, 4.0))
                .allergies(allergies(AllergyType.BEEF, AllergyType.SOY))
                .spicyLevel(3).temperatureType(TemperatureType.HOT).vegetarianType(VegetarianType.NONE)
                .seasonRecommended(Season.ALL).originInfo("쇠고기:국내산, 콩나물:국내산, 무:국내산, 고춧가루:국내산").floor(2).restaurantName("더진국")
                .operatingHours("11:00-14:00,15:00-16:00").build());

        // 솥밥 8개 국 선택 + 공기밥 추가 옵션 (스팸도시락 제외)
        for (Menu sotbap : new Menu[]{teriyakiChicken, charcoalPork, tunaMayo, cornCheese, octopusPork, spamKimchi, jangjorimButter, flyingFishBulgogi}) {
            MenuOptionGroup soupGroup = menuOptionGroupRepository.save(MenuOptionGroup.create("국 선택", true, 1, sotbap));
            menuOptionRepository.save(MenuOption.create("된장국", 0, soupGroup));
            menuOptionRepository.save(MenuOption.create("미역국", 0, soupGroup));

            MenuOptionGroup riceGroup = menuOptionGroupRepository.save(MenuOptionGroup.create("공기밥 추가", false, 1, sotbap));
            menuOptionRepository.save(MenuOption.create("없음", 0, riceGroup));
            menuOptionRepository.save(MenuOption.create("공기밥 추가", 500, riceGroup));
        }

        // ===== 덮밥류 =====
        Menu curryRice = menuRepository.save(Menu.builder()
                .name("일식카레덮밥").price(7000).imageUrl("/images/menu/덮밥류/일식카레덮밥.png")
                .category(catDeopbap).isSoldOut(false)
                .nutrition(nutrition(680, 14.0, 108.0, 14.0, 860, 8.0, 0.1, 20, 5.0))
                .allergies(allergies(AllergyType.WHEAT, AllergyType.SOY, AllergyType.MILK))
                .spicyLevel(1).temperatureType(TemperatureType.HOT).vegetarianType(VegetarianType.VEGETARIAN)
                .seasonRecommended(Season.ALL).originInfo("쌀:국내산").floor(1).restaurantName("솥앤누들").build());

        Menu katsudon = menuRepository.save(Menu.builder()
                .name("가츠동").price(8000).imageUrl("/images/menu/덮밥류/가츠동.png")
                .category(catDeopbap).isSoldOut(false)
                .nutrition(nutrition(820, 34.0, 88.0, 28.0, 920, 6.0, 0.3, 110, 2.5))
                .allergies(allergies(AllergyType.PORK, AllergyType.WHEAT, AllergyType.EGG, AllergyType.SOY))
                .spicyLevel(0).temperatureType(TemperatureType.HOT).vegetarianType(VegetarianType.NONE)
                .seasonRecommended(Season.ALL).originInfo("쌀:국내산, 돼지고기:국내산, 밀:미국산").floor(1).restaurantName("솥앤누들").build());

        Menu ikura = menuRepository.save(Menu.builder()
                .name("알밥").price(7500).imageUrl("/images/menu/덮밥류/알밥.png")
                .category(catDeopbap).isSoldOut(false)
                .nutrition(nutrition(720, 22.0, 96.0, 20.0, 980, 5.0, 0.2, 180, 2.0))
                .allergies(allergies(AllergyType.EGG, AllergyType.WHEAT, AllergyType.SOY, AllergyType.SQUID))
                .spicyLevel(0).temperatureType(TemperatureType.HOT).vegetarianType(VegetarianType.NONE)
                .seasonRecommended(Season.ALL).originInfo("쌀:국내산, 날치알:러시아산").floor(1).restaurantName("솥앤누들").build());

        Menu mazeDon = menuRepository.save(Menu.builder()
                .name("마제덮밥").price(8000).imageUrl("/images/menu/덮밥류/마제덮밥.png")
                .category(catDeopbap).isSoldOut(false)
                .nutrition(nutrition(750, 26.0, 90.0, 24.0, 860, 4.0, 0.2, 95, 3.0))
                .allergies(allergies(AllergyType.PORK, AllergyType.WHEAT, AllergyType.SOY, AllergyType.EGG))
                .spicyLevel(1).temperatureType(TemperatureType.HOT).vegetarianType(VegetarianType.NONE)
                .seasonRecommended(Season.ALL).originInfo("쌀:국내산, 돼지고기:국내산").floor(1).restaurantName("솥앤누들").build());

        // 덮밥류 계란 추가 옵션
        for (Menu deopbap : new Menu[]{curryRice, katsudon, ikura, mazeDon}) {
            MenuOptionGroup eggGroup = menuOptionGroupRepository.save(MenuOptionGroup.create("계란 추가", false, 1, deopbap));
            menuOptionRepository.save(MenuOption.create("없음", 0, eggGroup));
            menuOptionRepository.save(MenuOption.create("1개", 500, eggGroup));
            menuOptionRepository.save(MenuOption.create("2개", 1000, eggGroup));
        }

        // ===== 철판류 =====
        Menu porkKimchiCheolpan = menuRepository.save(Menu.builder()
                .name("삼겹살김치철판").price(8500).imageUrl("/images/menu/철판류/삼겹김치철판.png")
                .category(catCheolpan).isSoldOut(false)
                .nutrition(nutrition(820, 32.0, 65.0, 38.0, 1050, 5.0, 0.3, 95, 4.0))
                .allergies(allergies(AllergyType.PORK, AllergyType.WHEAT, AllergyType.SOY))
                .spicyLevel(1).temperatureType(TemperatureType.HOT).vegetarianType(VegetarianType.NONE)
                .seasonRecommended(Season.ALL).originInfo("돼지고기:국내산, 배추:국내산").floor(1).restaurantName("솥앤누들").build());

        Menu cheeseBuldak = menuRepository.save(Menu.builder()
                .name("치즈불닭철판").price(9000).imageUrl("/images/menu/철판류/치즈불닭철판.png")
                .category(catCheolpan).isSoldOut(false)
                .nutrition(nutrition(880, 36.0, 68.0, 35.0, 1300, 6.0, 0.4, 110, 3.0))
                .allergies(allergies(AllergyType.CHICKEN, AllergyType.MILK, AllergyType.WHEAT, AllergyType.SOY, AllergyType.EGG))
                .spicyLevel(5).temperatureType(TemperatureType.HOT).vegetarianType(VegetarianType.NONE)
                .seasonRecommended(Season.ALL).originInfo("닭고기:국내산, 치즈:뉴질랜드산").floor(1).restaurantName("솥앤누들").build());

        Menu cheeseDonkatsu = menuRepository.save(Menu.builder()
                .name("철판치즈돈가스").price(8000).imageUrl("/images/menu/철판류/철판치즈돈까스.png")
                .category(catCheolpan).isSoldOut(false)
                .nutrition(nutrition(850, 35.0, 72.0, 36.0, 980, 4.0, 0.4, 100, 2.5))
                .allergies(allergies(AllergyType.PORK, AllergyType.MILK, AllergyType.WHEAT, AllergyType.EGG))
                .spicyLevel(0).temperatureType(TemperatureType.HOT).vegetarianType(VegetarianType.NONE)
                .seasonRecommended(Season.ALL).originInfo("돼지고기:국내산, 치즈:뉴질랜드산, 밀:미국산").floor(1).restaurantName("솥앤누들").build());

        // 삼겹살김치철판 옵션
        MenuOptionGroup porkEggGroup = menuOptionGroupRepository.save(MenuOptionGroup.create("계란 추가", false, 1, porkKimchiCheolpan));
        menuOptionRepository.save(MenuOption.create("없음", 0, porkEggGroup));
        menuOptionRepository.save(MenuOption.create("1개", 500, porkEggGroup));
        menuOptionRepository.save(MenuOption.create("2개", 1000, porkEggGroup));

        // 치즈불닭철판 옵션
        MenuOptionGroup spicyGroup = menuOptionGroupRepository.save(MenuOptionGroup.create("매운맛 조절", false, 1, cheeseBuldak));
        menuOptionRepository.save(MenuOption.create("순하게", 0, spicyGroup));
        menuOptionRepository.save(MenuOption.create("기본 (신라면)", 0, spicyGroup));
        menuOptionRepository.save(MenuOption.create("맵게 (불닭볶음면)", 0, spicyGroup));
        MenuOptionGroup buldakEggGroup = menuOptionGroupRepository.save(MenuOptionGroup.create("계란 추가", false, 1, cheeseBuldak));
        menuOptionRepository.save(MenuOption.create("없음", 0, buldakEggGroup));
        menuOptionRepository.save(MenuOption.create("1개", 500, buldakEggGroup));
        menuOptionRepository.save(MenuOption.create("2개", 1000, buldakEggGroup));

        // 철판치즈돈가스 옵션
        MenuOptionGroup sauceGroup = menuOptionGroupRepository.save(MenuOptionGroup.create("소스 선택", true, 1, cheeseDonkatsu));
        menuOptionRepository.save(MenuOption.create("돈가스소스", 0, sauceGroup));
        menuOptionRepository.save(MenuOption.create("카레소스", 0, sauceGroup));
        menuOptionRepository.save(MenuOption.create("크림소스", 500, sauceGroup));
        MenuOptionGroup wasabiGroup = menuOptionGroupRepository.save(MenuOptionGroup.create("와사비", false, 1, cheeseDonkatsu));
        menuOptionRepository.save(MenuOption.create("와사비 없이", 0, wasabiGroup));
        menuOptionRepository.save(MenuOption.create("와사비 추가", 0, wasabiGroup));
        MenuOptionGroup saltGroup = menuOptionGroupRepository.save(MenuOptionGroup.create("소금", false, 1, cheeseDonkatsu));
        menuOptionRepository.save(MenuOption.create("소금 없이", 0, saltGroup));
        menuOptionRepository.save(MenuOption.create("소금 추가", 0, saltGroup));
        MenuOptionGroup donkatsuEggGroup = menuOptionGroupRepository.save(MenuOptionGroup.create("계란 추가", false, 1, cheeseDonkatsu));
        menuOptionRepository.save(MenuOption.create("없음", 0, donkatsuEggGroup));
        menuOptionRepository.save(MenuOption.create("1개", 500, donkatsuEggGroup));
        menuOptionRepository.save(MenuOption.create("2개", 1000, donkatsuEggGroup));

        // ===== 면류 =====
        Menu naengmomil = menuRepository.save(Menu.builder()
                .name("냉모밀").price(7000).imageUrl("/images/menu/면류/냉모밀.png")
                .category(catMyeon).isSoldOut(false)
                .nutrition(nutrition(480, 18.0, 78.0, 6.0, 720, 10.0, 0.0, 20, 3.0))
                .allergies(allergies(AllergyType.WHEAT, AllergyType.SOY, AllergyType.EGG, AllergyType.BUCKWHEAT))
                .spicyLevel(0).temperatureType(TemperatureType.COLD).vegetarianType(VegetarianType.NONE)
                .seasonRecommended(Season.SUMMER).originInfo("메밀:국내산").floor(1).restaurantName("솥앤누들").build());

        Menu shrimpUdon = menuRepository.save(Menu.builder()
                .name("새우튀김우동").price(7500).imageUrl("/images/menu/면류/새우튀김우동.png")
                .category(catMyeon).isSoldOut(false)
                .nutrition(nutrition(620, 24.0, 82.0, 14.0, 980, 4.0, 0.2, 85, 2.5))
                .allergies(allergies(AllergyType.WHEAT, AllergyType.SHRIMP, AllergyType.EGG))
                .spicyLevel(0).temperatureType(TemperatureType.HOT).vegetarianType(VegetarianType.NONE)
                .seasonRecommended(Season.WINTER).originInfo("새우:베트남산, 밀:미국산").floor(1).restaurantName("솥앤누들").build());

        Menu fishcakeUdon = menuRepository.save(Menu.builder()
                .name("어묵우동").price(6500).imageUrl("/images/menu/면류/어묵우동.png")
                .category(catMyeon).isSoldOut(false)
                .nutrition(nutrition(520, 20.0, 76.0, 8.0, 1100, 3.0, 0.1, 30, 2.0))
                .allergies(allergies(AllergyType.WHEAT, AllergyType.SOY))
                .spicyLevel(0).temperatureType(TemperatureType.HOT).vegetarianType(VegetarianType.NONE)
                .seasonRecommended(Season.WINTER).originInfo("어묵:국내산, 밀:미국산").floor(1).restaurantName("솥앤누들").build());

        Menu bibimUdon = menuRepository.save(Menu.builder()
                .name("비빔우동").price(7000).imageUrl("/images/menu/면류/비빔우동.png")
                .category(catMyeon).isSoldOut(false)
                .nutrition(nutrition(550, 16.0, 88.0, 10.0, 860, 12.0, 0.1, 15, 3.5))
                .allergies(allergies(AllergyType.WHEAT, AllergyType.SOY, AllergyType.EGG))
                .spicyLevel(1).temperatureType(TemperatureType.COLD).vegetarianType(VegetarianType.NONE)
                .seasonRecommended(Season.SUMMER).originInfo("밀:미국산, 배추:국내산").floor(1).restaurantName("솥앤누들").build());

        Menu seafoodJjambbong = menuRepository.save(Menu.builder()
                .name("해물짬뽕우동").price(8000).imageUrl("/images/menu/면류/해물짬뽕우동.png")
                .category(catMyeon).isSoldOut(false)
                .nutrition(nutrition(580, 26.0, 72.0, 12.0, 1400, 4.0, 0.1, 95, 3.0))
                .allergies(allergies(AllergyType.WHEAT, AllergyType.SHRIMP, AllergyType.CRAB, AllergyType.SQUID, AllergyType.CLAM))
                .spicyLevel(3).temperatureType(TemperatureType.HOT).vegetarianType(VegetarianType.NONE)
                .seasonRecommended(Season.ALL).originInfo("새우:베트남산, 오징어:국내산, 조개:국내산").floor(1).restaurantName("솥앤누들").build());

        // 우동/모밀 면 양 조절 옵션
        for (Menu udon : new Menu[]{naengmomil, shrimpUdon, fishcakeUdon, bibimUdon, seafoodJjambbong}) {
            MenuOptionGroup noodleGroup = menuOptionGroupRepository.save(MenuOptionGroup.create("면 양 조절", false, 1, udon));
            menuOptionRepository.save(MenuOption.create("보통", 0, noodleGroup));
            menuOptionRepository.save(MenuOption.create("곱배기", 1000, noodleGroup));
        }
        // 냉모밀 와사비 옵션
        MenuOptionGroup wasabiNaeng = menuOptionGroupRepository.save(MenuOptionGroup.create("와사비", false, 1, naengmomil));
        menuOptionRepository.save(MenuOption.create("와사비 없이", 0, wasabiNaeng));
        menuOptionRepository.save(MenuOption.create("와사비 추가", 0, wasabiNaeng));

        // 라면류
        Menu eggRamen = menuRepository.save(Menu.builder()
                .name("계란라면").price(4000).imageUrl("/images/menu/면류/계란라면.png")
                .category(catMyeon).isSoldOut(false)
                .nutrition(nutrition(480, 14.0, 68.0, 14.0, 1600, 2.0, 0.2, 185, 2.5))
                .allergies(allergies(AllergyType.WHEAT, AllergyType.EGG))
                .spicyLevel(3).temperatureType(TemperatureType.HOT).vegetarianType(VegetarianType.VEGETARIAN)
                .seasonRecommended(Season.ALL).originInfo("계란:국내산, 밀:미국산").floor(1).restaurantName("솥앤누들").build());

        Menu cheeseRamen = menuRepository.save(Menu.builder()
                .name("치즈라면").price(4500).imageUrl("/images/menu/면류/치즈라면.png")
                .category(catMyeon).isSoldOut(false)
                .nutrition(nutrition(540, 16.0, 70.0, 18.0, 1700, 3.0, 0.3, 195, 2.0))
                .allergies(allergies(AllergyType.WHEAT, AllergyType.EGG, AllergyType.MILK))
                .spicyLevel(3).temperatureType(TemperatureType.HOT).vegetarianType(VegetarianType.VEGETARIAN)
                .seasonRecommended(Season.WINTER).originInfo("계란:국내산, 밀:미국산, 치즈:뉴질랜드산").floor(1).restaurantName("솥앤누들").build());

        Menu haejangramen = menuRepository.save(Menu.builder()
                .name("해장라면").price(4500).imageUrl("/images/menu/면류/해장라면.png")
                .category(catMyeon).isSoldOut(false)
                .nutrition(nutrition(460, 12.0, 66.0, 12.0, 1800, 2.0, 0.1, 30, 2.5))
                .allergies(allergies(AllergyType.WHEAT, AllergyType.BEEF))
                .spicyLevel(3).temperatureType(TemperatureType.HOT).vegetarianType(VegetarianType.NONE)
                .seasonRecommended(Season.ALL).originInfo("밀:미국산, 쇠고기:호주산").floor(1).restaurantName("솥앤누들").build());

        // 2층 양식 (파스타류) — 영업시간: 점심
        menuRepository.save(Menu.builder()
                .name("토마토파스타+마늘빵").price(6000).imageUrl("/images/menu/면류/tomato_pasta_garlic_bread.png")
                .category(catMyeon).isSoldOut(false)
                .nutrition(nutrition(750, 25.0, 110.0, 20.0, 1000, 12.0, 0.2, 30, 6.0))
                .allergies(allergies(AllergyType.WHEAT))
                .spicyLevel(0).temperatureType(TemperatureType.HOT).vegetarianType(VegetarianType.NONE)
                .seasonRecommended(Season.ALL).originInfo("밀:미국산, 토마토:국내산, 마늘:국내산, 버터:뉴질랜드산").floor(2).restaurantName("양식")
                .operatingHours("11:00-14:00").build());

        menuRepository.save(Menu.builder()
                .name("치즈오븐파스타").price(6500).imageUrl("/images/menu/면류/cheese_oven_pasta.png")
                .category(catMyeon).isSoldOut(false)
                .nutrition(nutrition(850, 35.0, 95.0, 35.0, 1300, 10.0, 0.4, 75, 5.0))
                .allergies(allergies(AllergyType.WHEAT, AllergyType.MILK, AllergyType.EGG))
                .spicyLevel(0).temperatureType(TemperatureType.HOT).vegetarianType(VegetarianType.NONE)
                .seasonRecommended(Season.ALL).originInfo("밀:미국산, 치즈:뉴질랜드산, 우유:국내산, 버터:뉴질랜드산").floor(2).restaurantName("양식")
                .operatingHours("11:00-14:00").build());

        // 라면 토핑 옵션
        for (Menu ramen : new Menu[]{eggRamen, cheeseRamen, haejangramen}) {
            MenuOptionGroup ramenEgg = menuOptionGroupRepository.save(MenuOptionGroup.create("계란 추가", false, 1, ramen));
            menuOptionRepository.save(MenuOption.create("없음", 0, ramenEgg));
            menuOptionRepository.save(MenuOption.create("계란 추가", 500, ramenEgg));

            MenuOptionGroup ramenCheese = menuOptionGroupRepository.save(MenuOptionGroup.create("치즈 추가", false, 1, ramen));
            menuOptionRepository.save(MenuOption.create("없음", 0, ramenCheese));
            menuOptionRepository.save(MenuOption.create("치즈 추가", 500, ramenCheese));

            MenuOptionGroup ramenTuna = menuOptionGroupRepository.save(MenuOptionGroup.create("참치 추가", false, 1, ramen));
            menuOptionRepository.save(MenuOption.create("없음", 0, ramenTuna));
            menuOptionRepository.save(MenuOption.create("참치 추가", 500, ramenTuna));
        }

        // ===== 세트메뉴 =====
        Menu setNaengDonkatsu = menuRepository.save(Menu.builder()
                .name("냉모밀+돈가스 세트").price(13000).imageUrl("/images/menu/세트메뉴/냉모밀+돈까스.png")
                .category(catSet).isSoldOut(false)
                .nutrition(nutrition(1330, 53.0, 150.0, 42.0, 1700, 14.0, 0.4, 120, 5.5))
                .allergies(allergies(AllergyType.WHEAT, AllergyType.SOY, AllergyType.EGG, AllergyType.PORK, AllergyType.MILK))
                .spicyLevel(0).temperatureType(TemperatureType.BOTH).vegetarianType(VegetarianType.NONE)
                .seasonRecommended(Season.SUMMER).originInfo("메밀:국내산, 돼지고기:국내산, 치즈:뉴질랜드산, 밀:미국산").floor(1).restaurantName("솥앤누들").build());

        Menu setNaengIkura = menuRepository.save(Menu.builder()
                .name("냉모밀+알밥 세트").price(12500).imageUrl("/images/menu/세트메뉴/냉모밀+알밥.png")
                .category(catSet).isSoldOut(false)
                .nutrition(nutrition(1200, 40.0, 174.0, 26.0, 1700, 15.0, 0.1, 200, 5.0))
                .allergies(allergies(AllergyType.WHEAT, AllergyType.SOY, AllergyType.EGG, AllergyType.SQUID))
                .spicyLevel(0).temperatureType(TemperatureType.BOTH).vegetarianType(VegetarianType.NONE)
                .seasonRecommended(Season.SUMMER).originInfo("메밀:국내산, 쌀:국내산, 날치알:러시아산").floor(1).restaurantName("솥앤누들").build());

        Menu setDonkatsuCurry = menuRepository.save(Menu.builder()
                .name("돈가스+카레 세트").price(13500).imageUrl("/images/menu/세트메뉴/돈까스+카레.png")
                .category(catSet).isSoldOut(false)
                .nutrition(nutrition(1530, 49.0, 180.0, 50.0, 1840, 12.0, 0.5, 120, 7.5))
                .allergies(allergies(AllergyType.PORK, AllergyType.MILK, AllergyType.WHEAT, AllergyType.EGG, AllergyType.SOY))
                .spicyLevel(1).temperatureType(TemperatureType.HOT).vegetarianType(VegetarianType.NONE)
                .seasonRecommended(Season.ALL).originInfo("돼지고기:국내산, 치즈:뉴질랜드산, 밀:미국산, 쌀:국내산").floor(1).restaurantName("솥앤누들").build());

        Menu setUdonKatsudon = menuRepository.save(Menu.builder()
                .name("우동+가츠동 세트").price(13000).imageUrl("/images/menu/세트메뉴/우동+가츠동.png")
                .category(catSet).isSoldOut(false)
                .nutrition(nutrition(1440, 58.0, 170.0, 42.0, 1900, 10.0, 0.5, 195, 5.0))
                .allergies(allergies(AllergyType.WHEAT, AllergyType.SHRIMP, AllergyType.EGG, AllergyType.PORK, AllergyType.SOY))
                .spicyLevel(0).temperatureType(TemperatureType.HOT).vegetarianType(VegetarianType.NONE)
                .seasonRecommended(Season.WINTER).originInfo("새우:베트남산, 밀:미국산, 쌀:국내산, 돼지고기:국내산").floor(1).restaurantName("솥앤누들").build());

        // 돈가스+카레 세트만 국 선택 옵션
        MenuOptionGroup setSoupGroup = menuOptionGroupRepository.save(MenuOptionGroup.create("국 선택", false, 1, setDonkatsuCurry));
        menuOptionRepository.save(MenuOption.create("없음", 0, setSoupGroup));
        menuOptionRepository.save(MenuOption.create("된장국", 0, setSoupGroup));
        menuOptionRepository.save(MenuOption.create("미역국", 0, setSoupGroup));

        // 2층 일품 — 영업시간: 점심+오후
        menuRepository.save(Menu.builder()
                .name("매콤제육덮밥+핫도그").price(4500).imageUrl("/images/menu/세트메뉴/spicy_pork_hotdog.png")
                .category(catSet).isSoldOut(false)
                .nutrition(nutrition(950, 35.0, 100.0, 35.0, 1500, 15.0, 0.5, 80, 5.0))
                .allergies(allergies(AllergyType.PORK, AllergyType.WHEAT, AllergyType.SOY))
                .spicyLevel(2).temperatureType(TemperatureType.HOT).vegetarianType(VegetarianType.NONE)
                .seasonRecommended(Season.ALL).originInfo("돼지고기(제육·소시지):국내산, 밀:미국산, 양파:국내산, 고춧가루:국내산").floor(2).restaurantName("일품")
                .operatingHours("11:00-14:00,15:00-16:00").build());

        // 2층 양식 (단품) — 영업시간: 점심
        menuRepository.save(Menu.builder()
                .name("치즈돈까스").price(6300).imageUrl("/images/menu/세트메뉴/cheese_donkatsu.png")
                .category(catSet).isSoldOut(false)
                .nutrition(nutrition(850, 40.0, 70.0, 45.0, 1200, 8.0, 0.3, 100, 3.0))
                .allergies(allergies(AllergyType.PORK, AllergyType.WHEAT, AllergyType.MILK, AllergyType.EGG))
                .spicyLevel(0).temperatureType(TemperatureType.HOT).vegetarianType(VegetarianType.NONE)
                .seasonRecommended(Season.ALL).originInfo("돼지고기:국내산, 치즈:뉴질랜드산, 밀:미국산, 양배추:국내산").floor(2).restaurantName("양식")
                .operatingHours("11:00-14:00").build());

        // 3층 집밥 — 일자별로 메뉴가 변경되는 백반 (현재값은 03/25 기준)
        menuRepository.save(Menu.builder()
                .name("[중식백반] 샤브칼국수+삼겹살수육+도토리묵상추무침").price(7000)
                .imageUrl("/images/menu/세트메뉴/jibab_lunch_set.png")
                .category(catSet).isSoldOut(false)
                .nutrition(nutrition(800, 40.0, 90.0, 28.0, 1800, 7.0, 0.3, 95, 6.0))
                .allergies(allergies(AllergyType.PORK, AllergyType.WHEAT, AllergyType.SOY))
                .spicyLevel(0).temperatureType(TemperatureType.HOT).vegetarianType(VegetarianType.NONE)
                .seasonRecommended(Season.ALL).originInfo("돼지고기:국내산, 밀:미국산, 도토리:국내산, 상추:국내산").floor(3).restaurantName("집밥")
                .operatingHours("11:00-14:00").build());

        menuRepository.save(Menu.builder()
                .name("[석식백반] 파채고추장삼겹살+치킨너겟+미역줄기볶음").price(7000)
                .imageUrl("/images/menu/세트메뉴/jibab_dinner_set.png")
                .category(catSet).isSoldOut(false)
                .nutrition(nutrition(900, 45.0, 80.0, 40.0, 1700, 12.0, 0.4, 110, 5.0))
                .allergies(allergies(AllergyType.PORK, AllergyType.CHICKEN, AllergyType.WHEAT, AllergyType.SOY))
                .spicyLevel(2).temperatureType(TemperatureType.HOT).vegetarianType(VegetarianType.NONE)
                .seasonRecommended(Season.ALL).originInfo("돼지고기:국내산, 닭고기:국내산, 미역:국내산, 고추장:국내산").floor(3).restaurantName("집밥")
                .operatingHours("17:00-19:00").build());

        // 3층 한그릇 — 일자별로 메뉴가 변경되는 백반 (현재값은 03/25 기준, 한정판매)
        menuRepository.save(Menu.builder()
                .name("[중식백반] 카레&그릴소세지+통새우볼튀김+마시는요플레").price(7000)
                .imageUrl("/images/menu/세트메뉴/hangreut_lunch_set.png")
                .category(catSet).isSoldOut(false)
                .nutrition(nutrition(850, 30.0, 100.0, 30.0, 1500, 18.0, 0.4, 90, 4.0))
                .allergies(allergies(AllergyType.PORK, AllergyType.SHRIMP, AllergyType.WHEAT, AllergyType.MILK, AllergyType.EGG))
                .spicyLevel(0).temperatureType(TemperatureType.HOT).vegetarianType(VegetarianType.NONE)
                .seasonRecommended(Season.ALL).originInfo("돼지고기(소시지):국내산, 새우:베트남산, 카레가루:인도산, 우유:국내산").floor(3).restaurantName("한그릇")
                .operatingHours("11:00-14:00").build());

        // ===== 추가메뉴 =====
        Menu friedEgg = menuRepository.save(Menu.builder()
                .name("계란후라이").price(500).imageUrl("/images/menu/추가메뉴/계란후라이.png")
                .category(catExtra).isSoldOut(false)
                .nutrition(nutrition(90, 6.0, 0.5, 7.0, 150, 0.0, 0.1, 185, 0.0))
                .allergies(allergies(AllergyType.EGG))
                .spicyLevel(0).temperatureType(TemperatureType.HOT).vegetarianType(VegetarianType.VEGETARIAN)
                .seasonRecommended(Season.ALL).originInfo("계란:국내산").build());

        menuRepository.save(Menu.builder()
                .name("소시지").price(800).imageUrl("/images/menu/추가메뉴/소세지.png")
                .category(catExtra).isSoldOut(false)
                .nutrition(nutrition(180, 7.0, 4.0, 14.0, 580, 2.0, 0.3, 35, 0.0))
                .allergies(allergies(AllergyType.PORK, AllergyType.WHEAT))
                .spicyLevel(0).temperatureType(TemperatureType.HOT).vegetarianType(VegetarianType.NONE)
                .seasonRecommended(Season.ALL).originInfo("돼지고기:국내산").build());

        Menu plainRice = menuRepository.save(Menu.builder()
                .name("공기밥").price(1000).imageUrl("/images/menu/추가메뉴/공기밥.png")
                .category(catExtra).isSoldOut(false)
                .nutrition(nutrition(300, 5.0, 66.0, 0.5, 0, 0.0, 0.0, 0, 0.5))
                .allergies(new HashSet<>())
                .spicyLevel(0).temperatureType(TemperatureType.HOT).vegetarianType(VegetarianType.VEGAN)
                .seasonRecommended(Season.ALL).originInfo("쌀:국내산").build());

        menuRepository.save(Menu.builder()
                .name("해시브라운").price(800).imageUrl("/images/menu/추가메뉴/해시브라운.png")
                .category(catExtra).isSoldOut(false)
                .nutrition(nutrition(150, 2.0, 18.0, 8.0, 280, 0.5, 0.2, 0, 1.5))
                .allergies(new HashSet<>())
                .spicyLevel(0).temperatureType(TemperatureType.HOT).vegetarianType(VegetarianType.VEGETARIAN)
                .seasonRecommended(Season.ALL).originInfo("감자:국내산").build());

        // ===== 음료 =====
        menuRepository.save(Menu.builder()
                .name("콜라").price(1500).imageUrl("/images/menu/음료/콜라.png")
                .category(catDrink).isSoldOut(false)
                .nutrition(nutrition(140, 0.0, 38.0, 0.0, 45, 38.0, 0.0, 0, 0.0))
                .allergies(new HashSet<>())
                .spicyLevel(0).temperatureType(TemperatureType.COLD).vegetarianType(VegetarianType.VEGAN)
                .seasonRecommended(Season.ALL).originInfo(null).build());

        menuRepository.save(Menu.builder()
                .name("제로콜라").price(1500).imageUrl("/images/menu/음료/제로콜라.png")
                .category(catDrink).isSoldOut(false)
                .nutrition(nutrition(0, 0.0, 0.0, 0.0, 40, 0.0, 0.0, 0, 0.0))
                .allergies(new HashSet<>())
                .spicyLevel(0).temperatureType(TemperatureType.COLD).vegetarianType(VegetarianType.VEGAN)
                .seasonRecommended(Season.ALL).originInfo(null).build());

        menuRepository.save(Menu.builder()
                .name("사이다").price(1500).imageUrl("/images/menu/음료/사이다.png")
                .category(catDrink).isSoldOut(false)
                .nutrition(nutrition(130, 0.0, 34.0, 0.0, 35, 34.0, 0.0, 0, 0.0))
                .allergies(new HashSet<>())
                .spicyLevel(0).temperatureType(TemperatureType.COLD).vegetarianType(VegetarianType.VEGAN)
                .seasonRecommended(Season.ALL).originInfo(null).build());

        menuRepository.save(Menu.builder()
                .name("환타").price(1500).imageUrl("/images/menu/음료/환타.png")
                .category(catDrink).isSoldOut(false)
                .nutrition(nutrition(160, 0.0, 43.0, 0.0, 30, 43.0, 0.0, 0, 0.0))
                .allergies(new HashSet<>())
                .spicyLevel(0).temperatureType(TemperatureType.COLD).vegetarianType(VegetarianType.VEGAN)
                .seasonRecommended(Season.ALL).originInfo(null).build());

        return new MenuSeedData(
                teriyakiChicken, flyingFishBulgogi,
                porkKimchiCheolpan, cheeseDonkatsu,
                curryRice, katsudon,
                shrimpUdon, setNaengDonkatsu,
                eggRamen, plainRice, naengmomil, friedEgg
        );
    }

    private void seedSalesHistory(MenuSeedData d) {
        LocalDate today = LocalDate.now();
        int[][] data = {
                {45}, {38}, {32}, {40}, {50}, {35}, {28}, {22}, {30}
        };
        Menu[] menus = {
                d.teriyakiChicken(), d.flyingFishBulgogi(),
                d.porkKimchiCheolpan(), d.cheeseDonkatsu(),
                d.curryRice(), d.katsudon(),
                d.shrimpUdon(), d.setNaengDonkatsu(),
                d.eggRamen()
        };
        int[] prices = {7500, 8500, 8500, 8000, 7000, 8000, 7500, 13000, 4000};

        for (int i = SALES_HISTORY_DAYS - 1; i >= 0; i--) {
            LocalDate date = today.minusDays(i);
            for (int m = 0; m < menus.length; m++) {
                int qty = data[m][0] + i * 2;
                salesDailyRepository.save(SalesDaily.create(date, qty, qty * prices[m], menus[m]));
            }
        }
    }

    private SessionSeedData seedSessions() {
        KioskSession activeSession    = kioskSessionRepository.save(KioskSession.create(SessionMode.NORMAL, "ko", OrderType.DINE_IN));
        KioskSession avatarSession    = kioskSessionRepository.save(KioskSession.create(SessionMode.AVATAR, "ko", OrderType.DINE_IN));
        KioskSession completedSession = kioskSessionRepository.save(KioskSession.create(SessionMode.NORMAL, "ko", OrderType.TAKEOUT));
        KioskSession expiredSession   = kioskSessionRepository.save(KioskSession.create(SessionMode.AVATAR, "ko", OrderType.TAKEOUT));
        completedSession.complete();
        expiredSession.expire();
        return new SessionSeedData(activeSession, avatarSession, completedSession, expiredSession);
    }

    private void seedConversationMessages(KioskSession avatarSession) {
        conversationMessageRepository.save(ConversationMessage.create(avatarSession, MessageRole.USER, "오늘 추천 메뉴 뭐야?"));
        conversationMessageRepository.save(ConversationMessage.create(avatarSession, MessageRole.ASSISTANT, "안녕하세요! 오늘의 추천 메뉴는 일식카레덮밥과 날치알김치불고기솥밥입니다."));
        conversationMessageRepository.save(ConversationMessage.create(avatarSession, MessageRole.USER, "날치알김치불고기솥밥 하나 담아줘"));
        conversationMessageRepository.save(ConversationMessage.create(avatarSession, MessageRole.ASSISTANT, "날치알김치불고기솥밥 1개를 장바구니에 담았습니다. 국은 어떤 걸로 하시겠어요?"));
        conversationMessageRepository.save(ConversationMessage.create(avatarSession, MessageRole.USER, "된장국으로 줘"));
        conversationMessageRepository.save(ConversationMessage.create(avatarSession, MessageRole.ASSISTANT, "된장국으로 설정했습니다. 결제를 진행할까요?"));
    }

    private void seedAiToolCallLogs(KioskSession avatarSession) {
        aiToolCallLogRepository.save(AiToolCallLog.create(
                avatarSession, "recommend_menu",
                "{\"userText\":\"오늘 추천 메뉴 뭐야?\",\"mode\":\"AVATAR\",\"language\":\"ko\"}",
                "{\"recommendedMenus\":[{\"name\":\"일식카레덮밥\"},{\"name\":\"날치알김치불고기솥밥\"}]}"
        ));
        aiToolCallLogRepository.save(AiToolCallLog.create(
                avatarSession, "add_to_cart",
                "{\"menuName\":\"날치알김치불고기솥밥\",\"quantity\":1}",
                "{\"cartItems\":[{\"menuName\":\"날치알김치불고기솥밥\",\"quantity\":1}],\"orderStatus\":\"PENDING\"}"
        ));
        aiToolCallLogRepository.save(AiToolCallLog.create(
                avatarSession, "select_menu_option",
                "{\"menuName\":\"날치알김치불고기솥밥\",\"optionGroup\":\"국 선택\",\"optionName\":\"된장국\"}",
                "{\"selectedOption\":{\"optionGroup\":\"국 선택\",\"optionName\":\"된장국\"}}"
        ));
    }

    private void seedOrdersAndPayments(MenuSeedData menuData, SessionSeedData sessionData) {
        orderRepository.save(Order.create(sessionData.activeSession().getSessionId(), OrderType.DINE_IN));

        Order orderCompleted = orderRepository.save(Order.create(sessionData.completedSession().getSessionId(), OrderType.DINE_IN));
        OrderItem completedItem = orderItemRepository.save(
                OrderItem.create(orderCompleted, menuData.teriyakiChicken().getMenuId(), 1, "데리야끼치킨솥밥", 7500));
        orderItemRepository.save(
                OrderItem.create(orderCompleted, menuData.plainRice().getMenuId(), 1, "공기밥", 1000));
        orderCompleted.updateTotalAmount(8500);
        orderCompleted.complete();

        Order orderCancelled = orderRepository.save(Order.create(sessionData.expiredSession().getSessionId(), OrderType.TAKEOUT));
        orderItemRepository.save(
                OrderItem.create(orderCancelled, menuData.naengmomil().getMenuId(), 1, "냉모밀", 7000));
        orderCancelled.cancel();

        Payment paymentSuccess = paymentRepository.save(Payment.create(orderCompleted.getOrderId(), PaymentMethod.IC_CARD));
        paymentSuccess.success();
        paymentRepository.save(Payment.create(orderRepository.save(Order.create(sessionData.activeSession().getSessionId(), OrderType.TAKEOUT)).getOrderId(), PaymentMethod.VEIN_AUTH));
        Payment paymentFailed = paymentRepository.save(Payment.create(orderCancelled.getOrderId(), PaymentMethod.IC_CARD));
        paymentFailed.fail();
    }

    // ===== 헬퍼 메서드 =====

    private NutritionInfo nutrition(int calorie, double protein, double carb, double fat,
                                    int sodium, double sugar, double transFat, int cholesterol, double fiber) {
        return NutritionInfo.builder()
                .calorie(calorie).protein(protein).carbohydrate(carb).fat(fat)
                .sodium(sodium).sugar(sugar).transFat(transFat).cholesterol(cholesterol).dietaryFiber(fiber)
                .build();
    }

    private Set<AllergyType> allergies(AllergyType... types) {
        return new HashSet<>(Set.of(types));
    }

    private record MenuSeedData(
            Menu teriyakiChicken,
            Menu flyingFishBulgogi,
            Menu porkKimchiCheolpan,
            Menu cheeseDonkatsu,
            Menu curryRice,
            Menu katsudon,
            Menu shrimpUdon,
            Menu setNaengDonkatsu,
            Menu eggRamen,
            Menu plainRice,
            Menu naengmomil,
            Menu friedEgg
    ) {}

    private record SessionSeedData(
            KioskSession activeSession,
            KioskSession avatarSession,
            KioskSession completedSession,
            KioskSession expiredSession
    ) {}
}
