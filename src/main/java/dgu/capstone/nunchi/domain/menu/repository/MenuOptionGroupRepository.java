package dgu.capstone.nunchi.domain.menu.repository;

import dgu.capstone.nunchi.domain.menu.entity.MenuOptionGroup;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MenuOptionGroupRepository extends JpaRepository<MenuOptionGroup, Long> {

    // 메뉴 ID로 옵션 그룹 목록 조회
    List<MenuOptionGroup> findByMenu_MenuId(Long menuId);
}
