package dgu.capstone.nunchi.domain.admin.controller;

import dgu.capstone.nunchi.domain.admin.service.AdminSalesReportService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;

@SecurityRequirement(name = "Bearer Authentication")
@Tag(name = "관리자 리포트 API", description = "관리자페이지에서 판매 리포트 파일을 다운로드하는 API입니다.")
@RestController
@RequestMapping("/api/admin/reports")
@RequiredArgsConstructor
public class AdminReportController {

    private final AdminSalesReportService adminSalesReportService;

    @Operation(
            summary = "월간 판매 리포트 엑셀 다운로드",
            description = "선택한 월의 주문/매출/메뉴별 판매 데이터를 엑셀 파일로 다운로드합니다. month 값이 없으면 현재 월 기준으로 생성합니다."
    )
    @GetMapping("/sales/excel")
    public ResponseEntity<byte[]> downloadMonthlySalesExcel(
            @Parameter(description = "조회 월 yyyy-MM 형식", example = "2026-05")
            @RequestParam(required = false) String month
    ) {
        byte[] excelFile = adminSalesReportService.createMonthlySalesExcel(month);
        String fileName = adminSalesReportService.createMonthlyFileName(month);

        ContentDisposition contentDisposition = ContentDisposition.attachment()
                .filename(fileName, StandardCharsets.UTF_8)
                .build();

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, contentDisposition.toString())
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(excelFile);
    }
}