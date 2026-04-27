package dgu.capstone.nunchi.domain.menu.repository;

import dgu.capstone.nunchi.domain.menu.entity.Menu;
import dgu.capstone.nunchi.domain.menu.entity.enums.AllergyType;
import dgu.capstone.nunchi.domain.menu.entity.enums.Season;
import dgu.capstone.nunchi.domain.menu.entity.enums.TemperatureType;
import dgu.capstone.nunchi.domain.menu.entity.enums.VegetarianType;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;
import org.springframework.data.jpa.domain.Specification;

import java.util.List;

public class MenuSpecification {

    // 항상 적용: 품절 메뉴 제외
    public static Specification<Menu> notSoldOut() {
        return (root, query, cb) -> cb.equal(root.get("isSoldOut"), false);
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
