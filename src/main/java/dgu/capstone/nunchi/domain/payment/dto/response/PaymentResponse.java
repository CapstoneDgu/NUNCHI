package dgu.capstone.nunchi.domain.payment.dto.response;

import dgu.capstone.nunchi.domain.payment.entity.Payment;

import java.time.LocalDateTime;

public record PaymentResponse(
        Long paymentId,
        Long orderId,
        String method,
        String status,
        LocalDateTime createdAt
) {
    public static PaymentResponse from(Payment payment) {
        return new PaymentResponse(
                payment.getPaymentId(),
                payment.getOrderId(),
                payment.getMethod().name(),
                payment.getStatus().name(),
                payment.getCreatedAt()
        );
    }
}
