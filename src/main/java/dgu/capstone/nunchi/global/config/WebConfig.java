package dgu.capstone.nunchi.global.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.http.CacheControl;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.ViewControllerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.concurrent.TimeUnit;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    /**
     * 잘 바뀌지 않는 정적 리소스(메뉴 이미지·폰트·라이브러리)는 브라우저 캐시를 길게 둔다.
     * 화면을 전환할 때마다 같은 이미지를 다시 내려받아 "사진이 계속 로드되는" 문제 방지. (QA #14)
     * JS/CSS 는 개발 중 수정 반영을 위해 캐시 핸들러에서 제외(기본 핸들러가 처리).
     */
    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/images/**")
                .addResourceLocations("classpath:/static/front/images/")
                .setCacheControl(CacheControl.maxAge(7, TimeUnit.DAYS).cachePublic());
        registry.addResourceHandler("/lib/**")
                .addResourceLocations("classpath:/static/front/lib/")
                .setCacheControl(CacheControl.maxAge(7, TimeUnit.DAYS).cachePublic());
    }

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
        registry.addViewController("/vision-calibration").setViewName("forward:/vision-calibration.html");
        registry.addViewController("/menu").setViewName("forward:/flowN/N02-menu.html");
        registry.addViewController("/avatar").setViewName("forward:/flowA/A01-avatar.html");
        registry.addViewController("/summary").setViewName("forward:/flowP/P01-summary.html");
        registry.addViewController("/payment").setViewName("forward:/flowP/P02-payment.html");
        registry.addViewController("/vein").setViewName("forward:/flowP/P03-vein.html");
        registry.addViewController("/processing").setViewName("forward:/flowP/P04-processing.html");
        registry.addViewController("/barcode").setViewName("forward:/flowP/P07-barcode.html");
        registry.addViewController("/complete").setViewName("forward:/flowP/P05-complete.html");
        registry.addViewController("/fail").setViewName("forward:/flowP/P06-fail.html");
    }
}
