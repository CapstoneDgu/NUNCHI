package dgu.capstone.nunchi.domain.menu.repository;

import dgu.capstone.nunchi.domain.menu.entity.Menu;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.List;
import java.util.Optional;

public interface MenuRepository extends JpaRepository<Menu, Long>, JpaSpecificationExecutor<Menu> {

    // 카테고리 ID로 메뉴 목록 조회
    List<Menu> findByCategory_CategoryId(Long categoryId);

    // 데이터 마이그레이션용 — 이름으로 단건 조회
    Optional<Menu> findByName(String name);

    // 추천 메뉴 조회
    List<Menu> findByIsRecommendedTrueAndIsSoldOutFalse();

    // 카테고리 기반 추천용
    List<Menu> findByCategory_CategoryIdAndIsSoldOutFalse(Long categoryId);

    // 전체 판매 가능 메뉴 조회
    List<Menu> findByIsSoldOutFalse();

    long countByIsSoldOutTrue();

    long countByIsRecommendedTrue();
}
