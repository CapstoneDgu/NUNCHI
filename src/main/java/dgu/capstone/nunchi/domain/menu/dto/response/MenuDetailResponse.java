package dgu.capstone.nunchi.domain.menu.dto.response;

import dgu.capstone.nunchi.domain.menu.entity.Menu;
import dgu.capstone.nunchi.domain.menu.entity.MenuOption;
import dgu.capstone.nunchi.domain.menu.entity.MenuOptionGroup;

import java.util.List;
import java.util.Map;

public record MenuDetailResponse(
        Long menuId,
        String name,
        Integer price,
        Boolean isSoldOut,
        String imageUrl,
        List<OptionGroupInfo> optionGroups
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

    // groups 별로 options를 매핑해서 응답 생성
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
                groupInfos
        );
    }
}
