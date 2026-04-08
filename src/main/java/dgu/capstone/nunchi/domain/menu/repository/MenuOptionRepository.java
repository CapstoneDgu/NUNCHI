package dgu.capstone.nunchi.domain.menu.repository;

import dgu.capstone.nunchi.domain.menu.entity.MenuOption;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MenuOptionRepository extends JpaRepository<MenuOption, Long> {

    // 옵션 그룹 ID 목록으로 옵션 목록 일괄 조회 (N+1 방지)
    List<MenuOption> findByOptionGroup_OptionGroupIdIn(List<Long> optionGroupIds);
}
