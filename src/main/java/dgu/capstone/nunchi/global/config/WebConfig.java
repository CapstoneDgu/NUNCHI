package dgu.capstone.nunchi.global.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.ViewControllerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
                .allowedOriginPatterns("*")
                .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .allowCredentials(false);
    }

    /**
     * REST 스타일 페이지 URL → 정적 HTML forward.
     * 정적 리소스(static-locations: classpath:/static/front/, classpath:/templates_front/)
     * 안의 HTML 파일을 의미 있는 짧은 경로로 노출.
     * admin 페이지는 이번 라운드 제외.
     */
    @Override
    public void addViewControllers(ViewControllerRegistry registry) {
        registry.addViewController("/").setViewName("forward:/index.html");
        registry.addViewController("/start").setViewName("forward:/index.html");
        registry.addViewController("/mode").setViewName("forward:/S01-mode.html");
        registry.addViewController("/dine").setViewName("forward:/S02-dine.html");
        registry.addViewController("/menu").setViewName("forward:/flowN/N02-menu.html");
        registry.addViewController("/avatar").setViewName("forward:/flowA/A01-avatar.html");
        registry.addViewController("/summary").setViewName("forward:/flowP/P01-summary.html");
        registry.addViewController("/payment").setViewName("forward:/flowP/P02-payment.html");
        registry.addViewController("/vein").setViewName("forward:/flowP/P03-vein.html");
        registry.addViewController("/processing").setViewName("forward:/flowP/P04-processing.html");
        registry.addViewController("/complete").setViewName("forward:/flowP/P05-complete.html");
        registry.addViewController("/fail").setViewName("forward:/flowP/P06-fail.html");
    }
}
