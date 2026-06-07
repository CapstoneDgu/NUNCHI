# fusion/hesitation_fusion.py

import time


class HesitationFusion:
    def __init__(
            self,
            emit_interval_sec=3.0,
            high_score_threshold=75,
    ):
        self.emit_interval_sec = emit_interval_sec
        self.high_score_threshold = high_score_threshold
        self.last_emit_at = 0

    def update(self, hesitation_data, presence_data, eye_events):
        now = time.time()
        events = []

        present = presence_data.get("present", False)

        if not present:
            return events

        # 입력 이벤트가 발생한 직후에는 망설임 이벤트를 내보내지 않음
        for event in eye_events:
            if event.get("type") in ("vision_move", "vision_click"):
                self.last_emit_at = now
                return events

        gaze_switch_count = hesitation_data.get("gazeSwitchCount", 0)
        center_ratio = hesitation_data.get("centerRatio", 0.0)
        history_count = hesitation_data.get("historyCount", 0)

        # 데이터가 너무 적을 때는 판단하지 않음
        if history_count < 10:
            return events

        score = self._calculate_score(
            gaze_switch_count=gaze_switch_count,
            center_ratio=center_ratio,
        )

        if now - self.last_emit_at < self.emit_interval_sec:
            return events

        self.last_emit_at = now

        level = self._to_level(score)

        events.append({
            "type": "hesitation",
            "source": "hesitation",
            "score": score,
            "level": level,
            "gazeSwitchCount": gaze_switch_count,
            "centerRatio": center_ratio,
            "timestamp": now,
        })

        return events

    def _calculate_score(self, gaze_switch_count, center_ratio):
        score = 0

        # CENTER 오래 응시: 최대 35점
        score += int(center_ratio * 35)

        # 좌우/중앙 시선 변화: 최대 55점
        score += min(gaze_switch_count * 5, 55)

        # 너무 낮은 점수는 노이즈로 간주
        if score < 25:
            score = 0

        return max(0, min(score, 100))

    def _to_level(self, score):
        if score >= 75:
            return "HIGH"
        if score >= 45:
            return "MEDIUM"
        return "LOW"
