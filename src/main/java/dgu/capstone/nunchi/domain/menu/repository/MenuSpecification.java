package dgu.capstone.nunchi.domain.menu.repository;

import dgu.capstone.nunchi.domain.menu.entity.Menu;
import dgu.capstone.nunchi.domain.menu.entity.enums.AllergyType;
import dgu.capstone.nunchi.domain.menu.entity.enums.Season;
import dgu.capstone.nunchi.domain.menu.entity.enums.TemperatureType;
import dgu.capstone.nunchi.domain.menu.entity.enums.VegetarianType;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;
import org.springframework.data.jpa.domain.Specification;

import java.util.List;

public class MenuSpecification {

    // 항상 적용: 품절 메뉴 제외
    public static Specification<Menu> notSoldOut() {
        return (root, query, cb) -> cb.equal(root.get("isSoldOut"), false);
    }

    // category N+1 방지: FETCH JOIN (COUNT 쿼리 시에는 생략)
    public static Specification<Menu> fetchCategory() {
        return (root, query, cb) -> {
            if (Long.class != query.getResultType()) {
                root.fetch("category", JoinType.LEFT);
            }
            return cb.conjunction();
        };
    }

    public static Specification<Menu> maxCalorie(Integer max) {
        return (root, query, cb) -> cb.lessThanOrEqualTo(root.get("nutrition").get("calorie"), max);
    }

    public static Specification<Menu> minCalorie(Integer min) {
        return (root, query, cb) -> cb.greaterThanOrEqualTo(root.get("nutrition").get("calorie"), min);
    }

    public static Specification<Menu> minProtein(Double min) {
        return (root, query, cb) -> {
            Expression<Double> protein = root.get("nutrition").get("protein");
            return cb.greaterThanOrEqualTo(protein, min);
        };
    }

    // sodium은 Integer 컬럼이므로 Double 파라미터를 int로 변환하여 비교
    public static Specification<Menu> maxSodium(Double max) {
        return (root, query, cb) -> {
            Expression<Integer> sodium = root.get("nutrition").get("sodium");
            return cb.lessThanOrEqualTo(sodium, max.intValue());
        };
    }

    public static Specification<Menu> maxSpicyLevel(Integer max) {
        return (root, query, cb) -> cb.lessThanOrEqualTo(root.get("spicyLevel"), max);
    }

    public static Specification<Menu> minSpicyLevel(Integer min) {
        return (root, query, cb) -> cb.greaterThanOrEqualTo(root.get("spicyLevel"), min);
    }

    public static Specification<Menu> temperatureType(TemperatureType type) {
        return (root, query, cb) -> cb.equal(root.get("temperatureType"), type);
    }

    public static Specification<Menu> vegetarianType(VegetarianType type) {
        return (root, query, cb) -> cb.equal(root.get("vegetarianType"), type);
    }

    // seasonRecommended = ALL인 메뉴는 어떤 계절 필터에도 항상 포함
    public static Specification<Menu> season(Season season) {
        return (root, query, cb) -> cb.or(
                cb.equal(root.get("seasonRecommended"), season),
                cb.equal(root.get("seasonRecommended"), Season.ALL)
        );
    }

    public static Specification<Menu> categoryId(Long id) {
        return (root, query, cb) -> cb.equal(root.get("category").get("categoryId"), id);
    }

    public static Specification<Menu> minPrice(Integer min) {
        return (root, query, cb) -> cb.greaterThanOrEqualTo(root.get("price"), min);
    }

    public static Specification<Menu> maxPrice(Integer max) {
        return (root, query, cb) -> cb.lessThanOrEqualTo(root.get("price"), max);
    }

    // 식당명 필터: 해당 식당 메뉴 + 공용 메뉴(restaurantName IS NULL) 포함
    public static Specification<Menu> restaurantName(String name) {
        return (root, query, cb) -> cb.or(
                cb.equal(root.get("restaurantName"), name),
                cb.isNull(root.get("restaurantName"))
        );
    }

    // 층 필터: 해당 층 메뉴 + 공용 메뉴(floor IS NULL) 포함
    public static Specification<Menu> floor(Integer floor) {
        return (root, query, cb) -> cb.or(
                cb.equal(root.get("floor"), floor),
                cb.isNull(root.get("floor"))
        );
    }

    // 메뉴 이름 부분 검색 (대소문자 무시, LIKE %name% / %, _ 이스케이프 처리)
    public static Specification<Menu> nameContains(String name) {
        String escaped = name.toLowerCase()
                .replace("\\", "\\\\")
                .replace("%", "\\%")
                .replace("_", "\\_");
        return (root, query, cb) -> cb.like(cb.lower(root.get("name")), "%" + escaped + "%", '\\');
    }

    // 지정 알레르기를 하나라도 포함하는 메뉴를 서브쿼리 NOT IN으로 제외
    public static Specification<Menu> excludeAllergies(List<AllergyType> allergyList) {
        return (root, query, cb) -> {
            Subquery<Long> subquery = query.subquery(Long.class);
            Root<Menu> subRoot = subquery.from(Menu.class);
            Join<Menu, AllergyType> allergyJoin = subRoot.join("allergies");
            subquery.select(subRoot.get("menuId"))
                    .where(allergyJoin.in(allergyList));
            return cb.not(root.get("menuId").in(subquery));
        };
    }
}
