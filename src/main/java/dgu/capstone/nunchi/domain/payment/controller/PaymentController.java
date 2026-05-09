package dgu.capstone.nunchi.domain.payment.controller;

import dgu.capstone.nunchi.domain.payment.dto.request.BarcodePaymentRequest;
import dgu.capstone.nunchi.domain.payment.dto.request.PaymentCreateRequest;
import dgu.capstone.nunchi.domain.payment.dto.response.PaymentResponse;
import dgu.capstone.nunchi.domain.payment.service.PaymentService;
import dgu.capstone.nunchi.global.response.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@Tag(name = "Payment", description = "결제 API")
@RestController
@RequestMapping("/api/payments")
@RequiredArgsConstructor
public class PaymentController {

    private final PaymentService paymentService;

    @Operation(summary = "결제 요청", description = "확정된 주문에 대해 결제를 요청합니다.")
    @PostMapping
    public ResponseEntity<ApiResponse<PaymentResponse>> requestPayment(
            @RequestBody @Valid PaymentCreateRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created(paymentService.requestPayment(request)));
    }

    @Operation(summary = "바코드 결제", description = "바코드 값을 받아 즉시 결제 성공 처리합니다. 바코드 유효성 검증 없이 항상 성공합니다.")
    @PostMapping("/barcode")
    public ResponseEntity<ApiResponse<PaymentResponse>> payByBarcode(
            @RequestBody @Valid BarcodePaymentRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created(paymentService.payByBarcode(request)));
    }

    @Operation(summary = "결제 성공 처리", description = "결제를 성공 상태로 변경합니다.")
    @PatchMapping("/{paymentId}/success")
    public ResponseEntity<ApiResponse<PaymentResponse>> successPayment(
            @Parameter(description = "결제 ID") @PathVariable Long paymentId
    ) {
        return ResponseEntity.ok(ApiResponse.ok(paymentService.successPayment(paymentId)));
    }

    @Operation(summary = "결제 실패 처리", description = "결제를 실패 상태로 변경합니다.")
    @PatchMapping("/{paymentId}/fail")
    public ResponseEntity<ApiResponse<PaymentResponse>> failPayment(
            @Parameter(description = "결제 ID") @PathVariable Long paymentId
    ) {
        return ResponseEntity.ok(ApiResponse.ok(paymentService.failPayment(paymentId)));
    }

    @Operation(summary = "결제 조회", description = "결제 ID로 결제 정보를 조회합니다.")
    @GetMapping("/{paymentId}")
    public ResponseEntity<ApiResponse<PaymentResponse>> getPayment(
            @Parameter(description = "결제 ID") @PathVariable Long paymentId
    ) {
        return ResponseEntity.ok(ApiResponse.ok(paymentService.getPayment(paymentId)));
    }
}