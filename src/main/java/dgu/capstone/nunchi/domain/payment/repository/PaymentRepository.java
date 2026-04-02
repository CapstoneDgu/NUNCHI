package dgu.capstone.nunchi.domain.payment.repository;

import dgu.capstone.nunchi.domain.payment.entity.Payment;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PaymentRepository extends JpaRepository<Payment, Long> {
}