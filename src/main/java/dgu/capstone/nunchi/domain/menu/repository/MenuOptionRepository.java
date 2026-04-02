package dgu.capstone.nunchi.domain.menu.repository;

import dgu.capstone.nunchi.domain.menu.entity.MenuOption;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MenuOptionRepository extends JpaRepository<MenuOption, Long> {
}