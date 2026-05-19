package dgu.capstone.nunchi.global.config;

import dgu.capstone.nunchi.domain.menu.repository.MenuRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * 메뉴 라벨 / 정리 마이그레이션.
 *
 *  - 사진 없는 메뉴 2건 (장조림버터솥밥 / 날치알김치불고기솥밥) 삭제
 *  - 분식당(1층) 메뉴 5건 라벨링 (스팸도시락 / 계란라면 / 치즈라면 / 해장라면 / 공기밥)
 *
 * 멱등성:
 *  - 매 부팅마다 실행되지만, 이미 라벨이 동일하면 변경 없음.
 *  - 메뉴가 이미 삭제되어 없으면 skip.
 *
 * DataInitializer 다음 순서로 실행되도록 @Order(2) 지정.
 */
@Slf4j
@Component
@Profile({"local", "dev"})
@Order(2)
@RequiredArgsConstructor
public class MenuLabelMigration implements ApplicationRunner {

    private static final String BUNSIK_HOURS = "10:00-14:00";
    private static final int    BUNSIK_FLOOR = 1;
    private static final String BUNSIK_NAME  = "분식당";

    private final MenuRepository menuRepository;

    @PersistenceContext
    private EntityManager em;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        // 1) 사진 없는 메뉴 삭제
        deleteIfExists("장조림버터솥밥");
        deleteIfExists("날치알김치불고기솥밥");

        // 2) 분식당 라벨링 — 이미 같은 라벨이면 no-op
        relabelToBunsik("스팸도시락");
        relabelToBunsik("계란라면");
        relabelToBunsik("치즈라면");
        relabelToBunsik("해장라면");
        relabelToBunsik("공기밥");
    }

    private void deleteIfExists(String name) {
        menuRepository.findByName(name).ifPresent(menu -> {
            Long id = menu.getMenuId();
            // FK 제약 — 옵션·옵션그룹·판매집계·알레르기 먼저 정리 후 menu 삭제
            em.createNativeQuery(
                    "DELETE FROM menu_option WHERE option_group_id IN " +
                    "(SELECT option_group_id FROM menu_option_group WHERE menu_id = :id)")
                    .setParameter("id", id).executeUpdate();
            em.createNativeQuery("DELETE FROM menu_option_group WHERE menu_id = :id")
                    .setParameter("id", id).executeUpdate();
            em.createNativeQuery("DELETE FROM sales_daily WHERE menu_id = :id")
                    .setParameter("id", id).executeUpdate();
            em.createNativeQuery("DELETE FROM menu_allergy WHERE menu_id = :id")
                    .setParameter("id", id).executeUpdate();
            em.flush();

            menuRepository.delete(menu);
            log.info("[MenuLabelMigration] 메뉴 삭제 완료: {} (menuId={})", name, id);
        });
    }

    private void relabelToBunsik(String name) {
        menuRepository.findByName(name).ifPresent(menu -> {
            boolean alreadyLabeled =
                    BUNSIK_FLOOR == (menu.getFloor() == null ? -1 : menu.getFloor())
                            && BUNSIK_NAME.equals(menu.getRestaurantName())
                            && BUNSIK_HOURS.equals(menu.getOperatingHours());
            if (alreadyLabeled) return;
            menu.relabel(BUNSIK_FLOOR, BUNSIK_NAME, BUNSIK_HOURS);
            log.info("[MenuLabelMigration] 분식당 라벨링: {} (menuId={})", name, menu.getMenuId());
        });
    }
}
