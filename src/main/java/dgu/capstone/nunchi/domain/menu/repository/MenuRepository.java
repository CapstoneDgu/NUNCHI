package dgu.capstone.nunchi.domain.menu.repository;

import dgu.capstone.nunchi.domain.menu.entity.Menu;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MenuRepository extends JpaRepository<Menu, Long> {
}