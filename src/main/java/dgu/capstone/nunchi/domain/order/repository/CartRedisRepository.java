package dgu.capstone.nunchi.domain.order.repository;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import dgu.capstone.nunchi.domain.order.dto.cart.CartItem;
import dgu.capstone.nunchi.global.exception.domainException.OrderException;
import dgu.capstone.nunchi.global.exception.errorcode.OrderErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.stereotype.Repository;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.function.Supplier;

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

    /** sessionId 단위 분산 락 설정 (read-modify-write 구간의 원자성 보장용) */
    private static final String LOCK_KEY_PREFIX = "cart-lock:";
    private static final long LOCK_TTL_MILLIS = 3000L;
    private static final long LOCK_RETRY_INTERVAL_MILLIS = 50L;
    private static final int LOCK_MAX_ATTEMPTS = 60;

    /** 락 보유자(token)가 일치할 때만 삭제 — TTL 만료 후 다른 요청이 잡은 락을 잘못 해제하는 것을 방지 */
    private static final RedisScript<Long> UNLOCK_SCRIPT = new DefaultRedisScript<>(
            "if redis.call('get', KEYS[1]) == ARGV[1] then "
                    + "return redis.call('del', KEYS[1]) "
                    + "else "
                    + "return 0 "
                    + "end",
            Long.class
    );

    /** Redis 키 생성 */
    private String key(Long sessionId) {
        return "cart:" + sessionId;
    }

    private String lockKey(Long sessionId) {
        return LOCK_KEY_PREFIX + sessionId;
    }

    /**
     * sessionId 단위 락을 획득한 뒤 동작을 실행한다.
     * 장바구니는 "조회 → 메모리에서 수정 → 전체 저장" 흐름이라 동시 요청 시 한쪽 쓰기가 다른 쪽을 덮어쓸 수 있는데,
     * 이 구간을 락으로 직렬화해 항목 유실(레이스 컨디션)을 방지한다.
     */
    public <T> T withLock(Long sessionId, Supplier<T> action) {
        String lockKey = lockKey(sessionId);
        String token = UUID.randomUUID().toString();

        for (int attempt = 0; attempt < LOCK_MAX_ATTEMPTS; attempt++) {
            Boolean acquired = redisTemplate.opsForValue()
                    .setIfAbsent(lockKey, token, LOCK_TTL_MILLIS, TimeUnit.MILLISECONDS);
            if (Boolean.TRUE.equals(acquired)) {
                try {
                    return action.get();
                } finally {
                    redisTemplate.execute(UNLOCK_SCRIPT, Collections.singletonList(lockKey), token);
                }
            }
            try {
                Thread.sleep(LOCK_RETRY_INTERVAL_MILLIS);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new OrderException(OrderErrorCode.CART_LOCK_ACQUIRE_FAILED);
            }
        }
        throw new OrderException(OrderErrorCode.CART_LOCK_ACQUIRE_FAILED);
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
