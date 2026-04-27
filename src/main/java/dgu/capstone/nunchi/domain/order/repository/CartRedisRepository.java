package dgu.capstone.nunchi.domain.order.repository;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import dgu.capstone.nunchi.domain.order.dto.cart.CartItem;
import dgu.capstone.nunchi.global.exception.domainException.OrderException;
import dgu.capstone.nunchi.global.exception.errorcode.OrderErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Repository;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;

@Repository
public class CartRedisRepository {

    private final RedisTemplate<String, String> redisTemplate;
    private final ObjectMapper objectMapper;

    public CartRedisRepository(RedisTemplate<String, String> redisTemplate,
                               @Qualifier("redisObjectMapper") ObjectMapper objectMapper) {
        this.redisTemplate = redisTemplate;
        this.objectMapper = objectMapper;
    }
    private static final long CART_TTL_SECONDS = 1800L;

    /** Redis 키 생성 */
    private String key(Long sessionId) {
        return "cart:" + sessionId;
    }

    /** 장바구니 아이템 목록 조회 */
    public List<CartItem> getItems(Long sessionId) {
        String json = redisTemplate.opsForValue().get(key(sessionId));
        if (json == null) return new ArrayList<>();
        try {
            return objectMapper.readValue(json, new TypeReference<List<CartItem>>() {});
        } catch (Exception e) {
            return new ArrayList<>();
        }
    }

    /** 장바구니 아이템 목록 저장 (TTL 1800초) */
    public void saveItems(Long sessionId, List<CartItem> items) {
        try {
            String json = objectMapper.writeValueAsString(items);
            redisTemplate.opsForValue().set(key(sessionId), json, CART_TTL_SECONDS, TimeUnit.SECONDS);
        } catch (Exception e) {
            throw new OrderException(OrderErrorCode.CART_SAVE_FAILED);
        }
    }

    /** 장바구니 삭제 */
    public void deleteCart(Long sessionId) {
        redisTemplate.delete(key(sessionId));
    }
}
