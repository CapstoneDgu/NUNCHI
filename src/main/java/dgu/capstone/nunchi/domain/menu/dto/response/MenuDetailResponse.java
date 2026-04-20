package dgu.capstone.nunchi.domain.menu.dto.response;

import dgu.capstone.nunchi.domain.menu.entity.Menu;
import dgu.capstone.nunchi.domain.menu.entity.MenuOption;
import dgu.capstone.nunchi.domain.menu.entity.MenuOptionGroup;
import dgu.capstone.nunchi.domain.menu.entity.NutritionInfo;
import dgu.capstone.nunchi.domain.menu.entity.enums.AllergyType;
import dgu.capstone.nunchi.domain.menu.entity.enums.Season;
import dgu.capstone.nunchi.domain.menu.entity.enums.TemperatureType;
import dgu.capstone.nunchi.domain.menu.entity.enums.VegetarianType;

import java.util.List;
import java.util.Map;
import java.util.Set;

public record MenuDetailResponse(
        Long menuId,
        String name,
        Integer price,
        Boolean isSoldOut,
        String imageUrl,
        List<OptionGroupInfo> optionGroups,
        NutritionInfo nutrition,
        Set<AllergyType> allergies,
        Integer spicyLevel,
        TemperatureType temperatureType,
        VegetarianType vegetarianType,
        Season seasonRecommended,
        String originInfo
) {

    public record OptionGroupInfo(Long groupId, String groupName, List<OptionInfo> options) {

        public static OptionGroupInfo from(MenuOptionGroup group, List<MenuOption> options) {
            List<OptionInfo> optionInfos = options.stream()
                    .map(OptionInfo::from)
                    .toList();
            return new OptionGroupInfo(group.getOptionGroupId(), group.getName(), optionInfos);
        }
    }

    public record OptionInfo(Long optionId, String name, Integer extraPrice) {

        public static OptionInfo from(MenuOption option) {
            return new OptionInfo(option.getOptionId(), option.getName(), option.getExtraPrice());
        }
    }

    public static MenuDetailResponse from(Menu menu, List<MenuOptionGroup> groups, Map<Long, List<MenuOption>> optionsByGroupId) {
        List<OptionGroupInfo> groupInfos = groups.stream()
                .map(group -> OptionGroupInfo.from(
                        group,
                        optionsByGroupId.getOrDefault(group.getOptionGroupId(), List.of())
                ))
                .toList();

        return new MenuDetailResponse(
                menu.getMenuId(),
                menu.getName(),
                menu.getPrice(),
                menu.getIsSoldOut(),
                menu.getImageUrl(),
                groupInfos,
                menu.getNutrition(),
                new java.util.HashSet<>(menu.getAllergies()),
                menu.getSpicyLevel(),
                menu.getTemperatureType(),
                menu.getVegetarianType(),
                menu.getSeasonRecommended(),
                menu.getOriginInfo()
        );
    }
}
