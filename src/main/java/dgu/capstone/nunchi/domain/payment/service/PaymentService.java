package dgu.capstone.nunchi.domain.payment.service;

import dgu.capstone.nunchi.domain.order.entity.Order;
import dgu.capstone.nunchi.domain.order.entity.OrderStatus;
import dgu.capstone.nunchi.domain.order.repository.OrderRepository;
import dgu.capstone.nunchi.domain.payment.dto.request.PaymentCreateRequest;
import dgu.capstone.nunchi.domain.payment.dto.response.PaymentResponse;
import dgu.capstone.nunchi.domain.payment.entity.Payment;
import dgu.capstone.nunchi.domain.payment.entity.PaymentStatus;
import dgu.capstone.nunchi.domain.payment.repository.PaymentRepository;
import dgu.capstone.nunchi.global.exception.domainException.OrderException;
import dgu.capstone.nunchi.global.exception.domainException.PaymentException;
import dgu.capstone.nunchi.global.exception.errorcode.OrderErrorCode;
import dgu.capstone.nunchi.global.exception.errorcode.PaymentErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class PaymentService {

    private final PaymentRepository paymentRepository;
    private final OrderRepository orderRepository;

    /** 결제 요청 */
    @Transactional
    public PaymentResponse requestPayment(PaymentCreateRequest request) {
        Order order = orderRepository.findById(request.orderId())
                .orElseThrow(() -> new OrderException(OrderErrorCode.NOT_FOUND_ORDER));

        if (order.getOrderStatus() != OrderStatus.COMPLETED) {
            throw new PaymentException(PaymentErrorCode.ORDER_NOT_CONFIRMED);
        }

        // 기존 결제 조회 — PENDING/SUCCESS는 차단, FAILED만 재시도 허용
        paymentRepository.findTopByOrderIdOrderByCreatedAtDesc(request.orderId())
                .ifPresent(existing -> {
                    if (existing.getStatus() == PaymentStatus.PENDING || existing.getStatus() == PaymentStatus.SUCCESS) {
                        throw new PaymentException(PaymentErrorCode.PAYMENT_ALREADY_EXISTS);
                    }
                });

        Payment payment = paymentRepository.save(Payment.create(request.orderId(), request.method()));
        return PaymentResponse.from(payment);
    }

    /** 결제 성공 처리 */
    @Transactional
    public PaymentResponse successPayment(Long paymentId) {
        Payment payment = paymentRepository.findByIdWithLock(paymentId)
                .orElseThrow(() -> new PaymentException(PaymentErrorCode.NOT_FOUND_PAYMENT));

        if (payment.getStatus() != PaymentStatus.PENDING) {
            throw new PaymentException(PaymentErrorCode.PAYMENT_ALREADY_PROCESSED);
        }

        payment.success();
        return PaymentResponse.from(payment);
    }

    /** 결제 실패 처리 */
    @Transactional
    public PaymentResponse failPayment(Long paymentId) {
        Payment payment = paymentRepository.findByIdWithLock(paymentId)
                .orElseThrow(() -> new PaymentException(PaymentErrorCode.NOT_FOUND_PAYMENT));

        if (payment.getStatus() != PaymentStatus.PENDING) {
            throw new PaymentException(PaymentErrorCode.PAYMENT_ALREADY_PROCESSED);
        }

        payment.fail();
        return PaymentResponse.from(payment);
    }

    /** 결제 단건 조회 */
    public PaymentResponse getPayment(Long paymentId) {
        Payment payment = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new PaymentException(PaymentErrorCode.NOT_FOUND_PAYMENT));
        return PaymentResponse.from(payment);
    }
}