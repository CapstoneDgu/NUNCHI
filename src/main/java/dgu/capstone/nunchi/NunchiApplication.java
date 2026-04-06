package dgu.capstone.nunchi;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;

@SpringBootApplication
@EnableJpaAuditing
public class NunchiApplication {

    public static void main(String[] args) {
        SpringApplication.run(NunchiApplication.class, args);
    }
}
