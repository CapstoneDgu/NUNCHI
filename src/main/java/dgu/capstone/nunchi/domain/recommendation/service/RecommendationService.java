package dgu.capstone.nunchi.domain.recommendation.service;

import dgu.capstone.nunchi.domain.menu.entity.Menu;
import dgu.capstone.nunchi.domain.menu.repository.MenuRepository;
import dgu.capstone.nunchi.domain.order.repository.OrderItemRepository;
import dgu.capstone.nunchi.domain.recommendation.dto.response.RecommendationMenuResponse;
import dgu.capstone.nunchi.domain.recommendation.dto.response.RecommendationResponse;
import dgu.capstone.nunchi.domain.recommendation.entity.RecommendType;
import dgu.capstone.nunchi.domain.recommendation.errorcode.RecommendationErrorCode;
import dgu.capstone.nunchi.domain.recommendation.exception.RecommendationException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class RecommendationService {

    private final MenuRepository menuRepository;
    private final OrderItemRepository orderItemRepository;

    public RecommendationResponse getRecommendations(RecommendType type, Long categoryId) {
        List<Menu> menus = switch (type) {
            case DEFAULT -> menuRepository.findByIsRecommendedTrueAndIsSoldOutFalse();

            case CATEGORY -> {
                if (categoryId == null) {
                    throw new RecommendationException(RecommendationErrorCode.CATEGORY_ID_REQUIRED);
                }
                yield menuRepository.findByCategory_CategoryIdAndIsSoldOutFalse(categoryId);
            }

            case POPULAR -> {
                List<Menu> popularMenus = orderItemRepository.findPopularMenus(PageRequest.of(0, 5));

                if (popularMenus.isEmpty()) {
                    yield menuRepository.findByIsRecommendedTrueAndIsSoldOutFalse();
                }

                yield popularMenus;
            }
        };

        if (menus.isEmpty()) {
            throw new RecommendationException(RecommendationErrorCode.RECOMMENDATION_MENU_NOT_FOUND);
        }

        List<RecommendationMenuResponse> responses = menus.stream()
                .map(menu -> RecommendationMenuResponse.from(menu, createReason(type)))
                .toList();

        return RecommendationResponse.builder()
                .recommendType(type)
                .menus(responses)
                .build();
    }

    private String createReason(RecommendType type) {
        return switch (type) {
            case DEFAULT -> "추천 메뉴";
            case CATEGORY -> "카테고리 기반 추천";
            case POPULAR -> "인기 추천";
        };
    }
}