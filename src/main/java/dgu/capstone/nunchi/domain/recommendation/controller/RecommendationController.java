package dgu.capstone.nunchi.domain.recommendation.controller;

import dgu.capstone.nunchi.domain.recommendation.dto.response.RecommendationResponse;
import dgu.capstone.nunchi.domain.recommendation.entity.RecommendType;
import dgu.capstone.nunchi.domain.recommendation.service.RecommendationService;
import dgu.capstone.nunchi.global.response.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@Tag(name = "Recommendation", description = "추천 API")
@RestController
@RequestMapping("/api/recommendations")
@RequiredArgsConstructor
public class RecommendationController {

    private final RecommendationService recommendationService;

    @Operation(summary = "추천 메뉴 조회", description = "추천 타입에 따라 메뉴를 조회합니다.")
    @GetMapping
    public ResponseEntity<ApiResponse<RecommendationResponse>> getRecommendations(
            @Parameter(description = "추천 타입(DEFAULT, CATEGORY, POPULAR)")
            @RequestParam RecommendType type,
            @Parameter(description = "카테고리 ID (CATEGORY일 때만 사용)")
            @RequestParam(required = false) Long categoryId
    ) {
        return ResponseEntity.ok(
                ApiResponse.ok(recommendationService.getRecommendations(type, categoryId))
        );
    }
}