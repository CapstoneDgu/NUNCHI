package dgu.capstone.nunchi.domain.menu.repository;

import dgu.capstone.nunchi.domain.menu.dto.response.TopMenuResponse;
import dgu.capstone.nunchi.domain.menu.entity.Menu;
import dgu.capstone.nunchi.domain.menu.entity.SalesDaily;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface SalesDailyRepository extends JpaRepository<SalesDaily, Long> {

    Optional<SalesDaily> findByMenuAndSalesDate(Menu menu, LocalDate salesDate);

    @Query("""
            SELECT new dgu.capstone.nunchi.domain.menu.dto.response.TopMenuResponse(
                s.menu.menuId, s.menu.name, s.menu.price, s.menu.isSoldOut, SUM(s.quantitySold),
                s.menu.imageUrl, s.menu.restaurantName, s.menu.floor
            )
            FROM SalesDaily s
            WHERE s.salesDate = :today
            GROUP BY s.menu.menuId, s.menu.name, s.menu.price, s.menu.isSoldOut,
                     s.menu.imageUrl, s.menu.restaurantName, s.menu.floor
            ORDER BY SUM(s.quantitySold) DESC
            """)
    List<TopMenuResponse> findTopMenusByDate(@Param("today") LocalDate today, Pageable pageable);
}