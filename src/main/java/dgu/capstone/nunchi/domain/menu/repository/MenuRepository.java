package dgu.capstone.nunchi.domain.menu.repository;

import dgu.capstone.nunchi.domain.menu.entity.Menu;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MenuRepository extends JpaRepository<Menu, Long> {

    // 카테고리 ID로 메뉴 목록 조회
    List<Menu> findByCategory_CategoryId(Long categoryId);

    // 추천 메뉴 조회
    List<Menu> findByIsRecommendedTrueAndIsSoldOutFalse();

    // 카테고리 기반 추천용
    List<Menu> findByCategory_CategoryIdAndIsSoldOutFalse(Long categoryId);

    // 전체 판매 가능 메뉴 조회
    List<Menu> findByIsSoldOutFalse();

}
