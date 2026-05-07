package dgu.capstone.nunchi.domain.admin.service;

import dgu.capstone.nunchi.domain.admin.dto.response.AdminTopMenuSalesResponse;
import dgu.capstone.nunchi.domain.order.entity.Order;
import dgu.capstone.nunchi.domain.order.entity.OrderStatus;
import dgu.capstone.nunchi.domain.order.repository.OrderItemRepository;
import dgu.capstone.nunchi.domain.order.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AdminSalesReportService {

    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;

    public byte[] createMonthlySalesExcel(String month) {
        YearMonth targetMonth = parseMonth(month);

        LocalDate startDate = targetMonth.atDay(1);
        LocalDate endDate = targetMonth.atEndOfMonth();

        LocalDateTime start = startDate.atStartOfDay();
        LocalDateTime end = endDate.atTime(23, 59, 59);

        List<Order> completedOrders = orderRepository.findAllByCreatedAtBetweenAndOrderStatus(
                start,
                end,
                OrderStatus.COMPLETED
        );

        List<AdminTopMenuSalesResponse> menuSales = orderItemRepository.findMenuSalesByPeriod(
                start,
                end,
                OrderStatus.COMPLETED
        );

        try (Workbook workbook = new XSSFWorkbook();
             ByteArrayOutputStream outputStream = new ByteArrayOutputStream()) {

            CellStyle headerStyle = createHeaderStyle(workbook);
            CellStyle moneyStyle = createMoneyStyle(workbook);

            createSummarySheet(workbook, headerStyle, moneyStyle, targetMonth, completedOrders, menuSales);
            createDashboardSheet(workbook, headerStyle, moneyStyle, targetMonth, completedOrders, menuSales);
            createDailySalesSheet(workbook, headerStyle, moneyStyle, targetMonth, completedOrders);
            createHourlySalesSheet(workbook, headerStyle, moneyStyle, completedOrders);
            createMenuSalesSheet(workbook, headerStyle, moneyStyle, menuSales);

            workbook.write(outputStream);
            return outputStream.toByteArray();
        } catch (Exception e) {
            throw new IllegalStateException("엑셀 리포트 생성에 실패했습니다.", e);
        }
    }

    public String createMonthlyFileName(String month) {
        YearMonth targetMonth = parseMonth(month);
        return "monthly-sales-report-" + targetMonth + ".xlsx";
    }

    private YearMonth parseMonth(String month) {
        if (month == null || month.isBlank()) {
            return YearMonth.now(ZoneId.of("Asia/Seoul"));
        }

        return YearMonth.parse(month);
    }

    private void createSummarySheet(
            Workbook workbook,
            CellStyle headerStyle,
            CellStyle moneyStyle,
            YearMonth targetMonth,
            List<Order> completedOrders,
            List<AdminTopMenuSalesResponse> menuSales
    ) {
        Sheet sheet = workbook.createSheet("요약");

        int totalOrderCount = completedOrders.size();
        int totalSalesAmount = completedOrders.stream()
                .mapToInt(order -> order.getTotalAmount() != null ? order.getTotalAmount() : 0)
                .sum();

        int averageOrderAmount = totalOrderCount == 0 ? 0 : totalSalesAmount / totalOrderCount;

        AdminTopMenuSalesResponse topMenu = menuSales.isEmpty() ? null : menuSales.get(0);

        int rowIndex = 0;

        Row titleRow = sheet.createRow(rowIndex++);
        titleRow.createCell(0).setCellValue("NUNCHI 월간 판매 리포트");

        rowIndex++;

        rowIndex = createSummaryRow(sheet, rowIndex, "기준 월", targetMonth.toString(), headerStyle, null);
        rowIndex = createSummaryRow(sheet, rowIndex, "총 주문 수", totalOrderCount + "건", headerStyle, null);
        rowIndex = createSummaryRow(sheet, rowIndex, "총 매출", totalSalesAmount, headerStyle, moneyStyle);
        rowIndex = createSummaryRow(sheet, rowIndex, "평균 주문 금액", averageOrderAmount, headerStyle, moneyStyle);
        rowIndex = createSummaryRow(
                sheet,
                rowIndex,
                "TOP 판매 메뉴",
                topMenu == null ? "-" : topMenu.menuName() + " (" + topMenu.quantitySold() + "개)",
                headerStyle,
                null
        );

        autoSizeColumns(sheet, 2);
    }

    private void createDashboardSheet(
            Workbook workbook,
            CellStyle headerStyle,
            CellStyle moneyStyle,
            YearMonth targetMonth,
            List<Order> completedOrders,
            List<AdminTopMenuSalesResponse> menuSales
    ) {
        Sheet sheet = workbook.createSheet("대시보드");

        int totalOrderCount = completedOrders.size();
        int totalSalesAmount = completedOrders.stream()
                .mapToInt(order -> order.getTotalAmount() != null ? order.getTotalAmount() : 0)
                .sum();

        int averageOrderAmount = totalOrderCount == 0 ? 0 : totalSalesAmount / totalOrderCount;
        AdminTopMenuSalesResponse topMenu = menuSales.isEmpty() ? null : menuSales.get(0);

        int rowIndex = 0;

        Row titleRow = sheet.createRow(rowIndex++);
        Cell titleCell = titleRow.createCell(0);
        titleCell.setCellValue("NUNCHI 월간 판매 대시보드");
        titleCell.setCellStyle(headerStyle);

        rowIndex++;

        rowIndex = createSummaryRow(sheet, rowIndex, "기준 월", targetMonth.toString(), headerStyle, null);
        rowIndex = createSummaryRow(sheet, rowIndex, "총 주문 수", totalOrderCount + "건", headerStyle, null);
        rowIndex = createSummaryRow(sheet, rowIndex, "총 매출", totalSalesAmount, headerStyle, moneyStyle);
        rowIndex = createSummaryRow(sheet, rowIndex, "평균 주문 금액", averageOrderAmount, headerStyle, moneyStyle);
        rowIndex = createSummaryRow(
                sheet,
                rowIndex,
                "TOP 판매 메뉴",
                topMenu == null ? "-" : topMenu.menuName() + " (" + topMenu.quantitySold() + "개)",
                headerStyle,
                null
        );

        rowIndex += 2;

        rowIndex = createDailySalesChartSection(sheet, rowIndex, headerStyle, moneyStyle, targetMonth, completedOrders);
        rowIndex += 2;

        rowIndex = createHourlySalesChartSection(sheet, rowIndex, headerStyle, moneyStyle, completedOrders);
        rowIndex += 2;

        createMenuSalesChartSection(sheet, rowIndex, headerStyle, moneyStyle, menuSales);

        autoSizeColumns(sheet, 5);
        setColumnWidths(sheet, 5000, 3000, 5000, 9000, 9000);
    }

    private int createDailySalesChartSection(
            Sheet sheet,
            int rowIndex,
            CellStyle headerStyle,
            CellStyle moneyStyle,
            YearMonth targetMonth,
            List<Order> completedOrders
    ) {
        Row sectionTitle = sheet.createRow(rowIndex++);
        Cell titleCell = sectionTitle.createCell(0);
        titleCell.setCellValue("최근 일별 매출 추이");
        titleCell.setCellStyle(headerStyle);

        Row header = sheet.createRow(rowIndex++);
        createHeaderCell(header, 0, "날짜", headerStyle);
        createHeaderCell(header, 1, "주문 수", headerStyle);
        createHeaderCell(header, 2, "매출", headerStyle);
        createHeaderCell(header, 3, "추이", headerStyle);

        Map<LocalDate, List<Order>> ordersByDate = completedOrders.stream()
                .collect(Collectors.groupingBy(order -> order.getCreatedAt().toLocalDate()));

        Map<LocalDate, Integer> salesByDate = new LinkedHashMap<>();

        for (int day = 1; day <= targetMonth.lengthOfMonth(); day++) {
            LocalDate date = targetMonth.atDay(day);
            List<Order> orders = ordersByDate.getOrDefault(date, List.of());

            int salesAmount = orders.stream()
                    .mapToInt(order -> order.getTotalAmount() != null ? order.getTotalAmount() : 0)
                    .sum();

            salesByDate.put(date, salesAmount);
        }

        int maxSales = salesByDate.values().stream()
                .mapToInt(Integer::intValue)
                .max()
                .orElse(0);

        for (Map.Entry<LocalDate, Integer> entry : salesByDate.entrySet()) {
            LocalDate date = entry.getKey();
            int salesAmount = entry.getValue();
            int orderCount = ordersByDate.getOrDefault(date, List.of()).size();

            Row row = sheet.createRow(rowIndex++);
            row.createCell(0).setCellValue(date.toString());
            row.createCell(1).setCellValue(orderCount);

            Cell salesCell = row.createCell(2);
            salesCell.setCellValue(salesAmount);
            salesCell.setCellStyle(moneyStyle);

            row.createCell(3).setCellValue(createBar(salesAmount, maxSales));
        }

        return rowIndex;
    }

    private int createHourlySalesChartSection(
            Sheet sheet,
            int rowIndex,
            CellStyle headerStyle,
            CellStyle moneyStyle,
            List<Order> completedOrders
    ) {
        Row sectionTitle = sheet.createRow(rowIndex++);
        Cell titleCell = sectionTitle.createCell(0);
        titleCell.setCellValue("시간대별 주문 현황");
        titleCell.setCellStyle(headerStyle);

        Row header = sheet.createRow(rowIndex++);
        createHeaderCell(header, 0, "시간대", headerStyle);
        createHeaderCell(header, 1, "주문 수", headerStyle);
        createHeaderCell(header, 2, "매출", headerStyle);
        createHeaderCell(header, 3, "주문량", headerStyle);

        Map<Integer, List<Order>> ordersByHour = completedOrders.stream()
                .collect(Collectors.groupingBy(order -> order.getCreatedAt().getHour()));

        int maxOrderCount = 0;

        for (int hour = 0; hour < 24; hour++) {
            int orderCount = ordersByHour.getOrDefault(hour, List.of()).size();
            maxOrderCount = Math.max(maxOrderCount, orderCount);
        }

        for (int hour = 0; hour < 24; hour++) {
            List<Order> orders = ordersByHour.getOrDefault(hour, List.of());

            int orderCount = orders.size();
            int salesAmount = orders.stream()
                    .mapToInt(order -> order.getTotalAmount() != null ? order.getTotalAmount() : 0)
                    .sum();

            Row row = sheet.createRow(rowIndex++);
            row.createCell(0).setCellValue(hour + "시");
            row.createCell(1).setCellValue(orderCount);

            Cell salesCell = row.createCell(2);
            salesCell.setCellValue(salesAmount);
            salesCell.setCellStyle(moneyStyle);

            row.createCell(3).setCellValue(createBar(orderCount, maxOrderCount));
        }

        return rowIndex;
    }

    private int createMenuSalesChartSection(
            Sheet sheet,
            int rowIndex,
            CellStyle headerStyle,
            CellStyle moneyStyle,
            List<AdminTopMenuSalesResponse> menuSales
    ) {
        Row sectionTitle = sheet.createRow(rowIndex++);
        Cell titleCell = sectionTitle.createCell(0);
        titleCell.setCellValue("TOP 판매 메뉴");
        titleCell.setCellStyle(headerStyle);

        Row header = sheet.createRow(rowIndex++);
        createHeaderCell(header, 0, "순위", headerStyle);
        createHeaderCell(header, 1, "메뉴명", headerStyle);
        createHeaderCell(header, 2, "판매 수량", headerStyle);
        createHeaderCell(header, 3, "매출", headerStyle);
        createHeaderCell(header, 4, "판매량", headerStyle);

        long maxQuantity = menuSales.stream()
                .mapToLong(menu -> menu.quantitySold() != null ? menu.quantitySold() : 0)
                .max()
                .orElse(0);

        for (int i = 0; i < menuSales.size(); i++) {
            AdminTopMenuSalesResponse menu = menuSales.get(i);

            long quantity = menu.quantitySold() != null ? menu.quantitySold() : 0;
            long salesAmount = menu.salesAmount() != null ? menu.salesAmount() : 0;

            Row row = sheet.createRow(rowIndex++);
            row.createCell(0).setCellValue(i + 1);
            row.createCell(1).setCellValue(menu.menuName());
            row.createCell(2).setCellValue(quantity);

            Cell salesCell = row.createCell(3);
            salesCell.setCellValue(salesAmount);
            salesCell.setCellStyle(moneyStyle);

            row.createCell(4).setCellValue(createBar(quantity, maxQuantity));
        }

        return rowIndex;
    }

    private int createSummaryRow(
            Sheet sheet,
            int rowIndex,
            String label,
            Object value,
            CellStyle headerStyle,
            CellStyle valueStyle
    ) {
        Row row = sheet.createRow(rowIndex);

        Cell labelCell = row.createCell(0);
        labelCell.setCellValue(label);
        labelCell.setCellStyle(headerStyle);

        Cell valueCell = row.createCell(1);

        if (value instanceof Number number) {
            valueCell.setCellValue(number.doubleValue());
        } else {
            valueCell.setCellValue(String.valueOf(value));
        }

        if (valueStyle != null) {
            valueCell.setCellStyle(valueStyle);
        }

        return rowIndex + 1;
    }

    private void createDailySalesSheet(
            Workbook workbook,
            CellStyle headerStyle,
            CellStyle moneyStyle,
            YearMonth targetMonth,
            List<Order> completedOrders
    ) {
        Sheet sheet = workbook.createSheet("일별 매출");

        Row header = sheet.createRow(0);
        createHeaderCell(header, 0, "날짜", headerStyle);
        createHeaderCell(header, 1, "주문 수", headerStyle);
        createHeaderCell(header, 2, "매출", headerStyle);

        Map<LocalDate, List<Order>> ordersByDate = completedOrders.stream()
                .collect(Collectors.groupingBy(order -> order.getCreatedAt().toLocalDate()));

        int rowIndex = 1;

        for (int day = 1; day <= targetMonth.lengthOfMonth(); day++) {
            LocalDate date = targetMonth.atDay(day);
            List<Order> orders = ordersByDate.getOrDefault(date, List.of());

            int orderCount = orders.size();
            int salesAmount = orders.stream()
                    .mapToInt(order -> order.getTotalAmount() != null ? order.getTotalAmount() : 0)
                    .sum();

            Row row = sheet.createRow(rowIndex++);
            row.createCell(0).setCellValue(date.toString());
            row.createCell(1).setCellValue(orderCount);

            Cell salesCell = row.createCell(2);
            salesCell.setCellValue(salesAmount);
            salesCell.setCellStyle(moneyStyle);
        }

        autoSizeColumns(sheet, 3);
        setColumnWidths(sheet, 4000, 3000, 5000);

    }

    private void createHourlySalesSheet(
            Workbook workbook,
            CellStyle headerStyle,
            CellStyle moneyStyle,
            List<Order> completedOrders
    ) {
        Sheet sheet = workbook.createSheet("시간대별 판매");

        Row header = sheet.createRow(0);
        createHeaderCell(header, 0, "시간대", headerStyle);
        createHeaderCell(header, 1, "주문 수", headerStyle);
        createHeaderCell(header, 2, "매출", headerStyle);

        Map<Integer, List<Order>> ordersByHour = completedOrders.stream()
                .collect(Collectors.groupingBy(order -> order.getCreatedAt().getHour()));

        int rowIndex = 1;

        for (int hour = 0; hour < 24; hour++) {
            List<Order> orders = ordersByHour.getOrDefault(hour, List.of());

            int orderCount = orders.size();
            int salesAmount = orders.stream()
                    .mapToInt(order -> order.getTotalAmount() != null ? order.getTotalAmount() : 0)
                    .sum();

            Row row = sheet.createRow(rowIndex++);
            row.createCell(0).setCellValue(hour + "시");
            row.createCell(1).setCellValue(orderCount);

            Cell salesCell = row.createCell(2);
            salesCell.setCellValue(salesAmount);
            salesCell.setCellStyle(moneyStyle);
        }

        autoSizeColumns(sheet, 3);
        setColumnWidths(sheet, 3000, 3000, 5000);
    }

    private void createMenuSalesSheet(
            Workbook workbook,
            CellStyle headerStyle,
            CellStyle moneyStyle,
            List<AdminTopMenuSalesResponse> menuSales
    ) {
        Sheet sheet = workbook.createSheet("메뉴별 판매");

        Row header = sheet.createRow(0);
        createHeaderCell(header, 0, "순위", headerStyle);
        createHeaderCell(header, 1, "메뉴 ID", headerStyle);
        createHeaderCell(header, 2, "메뉴명", headerStyle);
        createHeaderCell(header, 3, "판매 수량", headerStyle);
        createHeaderCell(header, 4, "매출", headerStyle);

        int rowIndex = 1;

        for (int i = 0; i < menuSales.size(); i++) {
            AdminTopMenuSalesResponse menu = menuSales.get(i);

            Row row = sheet.createRow(rowIndex++);
            row.createCell(0).setCellValue(i + 1);
            row.createCell(1).setCellValue(menu.menuId());
            row.createCell(2).setCellValue(menu.menuName());
            row.createCell(3).setCellValue(menu.quantitySold() != null ? menu.quantitySold() : 0);

            Cell salesCell = row.createCell(4);
            salesCell.setCellValue(menu.salesAmount() != null ? menu.salesAmount() : 0);
            salesCell.setCellStyle(moneyStyle);
        }

        autoSizeColumns(sheet, 5);
        setColumnWidths(sheet, 2500, 3000, 6000, 3000, 5000);
    }

    private CellStyle createHeaderStyle(Workbook workbook) {
        CellStyle style = workbook.createCellStyle();

        Font font = workbook.createFont();
        font.setBold(true);

        style.setFont(font);
        style.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);

        return style;
    }

    private CellStyle createMoneyStyle(Workbook workbook) {
        CellStyle style = workbook.createCellStyle();
        DataFormat format = workbook.createDataFormat();
        style.setDataFormat(format.getFormat("#,##0원"));
        return style;
    }

    private void createHeaderCell(Row row, int columnIndex, String value, CellStyle headerStyle) {
        Cell cell = row.createCell(columnIndex);
        cell.setCellValue(value);
        cell.setCellStyle(headerStyle);
    }

    private void autoSizeColumns(Sheet sheet, int columnCount) {
        for (int i = 0; i < columnCount; i++) {
            sheet.autoSizeColumn(i);
        }
    }

    private void setColumnWidths(Sheet sheet, int... widths) {
        for (int i = 0; i < widths.length; i++) {
            sheet.setColumnWidth(i, widths[i]);
        }
    }

    private String createBar(long value, long maxValue) {
        if (maxValue <= 0 || value <= 0) {
            return "";
        }

        int maxBarLength = 20;
        int barLength = (int) Math.ceil((double) value / maxValue * maxBarLength);

        return "█".repeat(Math.max(barLength, 1));
    }
}