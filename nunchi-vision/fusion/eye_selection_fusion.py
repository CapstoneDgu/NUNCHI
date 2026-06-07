# fusion/eye_selection_fusion.py

import time


class EyeSelectionFusion:
    def __init__(
            self,
            gaze_hold_threshold=0.5,
            blink_threshold=0.16,
            double_blink_interval=0.65,
            move_cooldown=0.65,
            click_cooldown=1.2,
            click_after_move_grace=0.9,
    ):
        # 시선을 이 시간 이상 유지해야 이동 이벤트 발생
        self.gaze_hold_threshold = gaze_hold_threshold

        # blink_ratio가 이 값보다 작으면 눈 감김으로 판단
        self.blink_threshold = blink_threshold

        # 더블 깜빡임으로 인정할 최대 간격
        self.double_blink_interval = double_blink_interval

        # 같은 방향 이동 이벤트가 너무 빠르게 반복되지 않도록 제한
        self.move_cooldown = move_cooldown

        # 클릭 이벤트가 너무 빠르게 반복되지 않도록 제한
        self.click_cooldown = click_cooldown
        self.click_after_move_grace = click_after_move_grace

        # 현재 시선 상태
        self.current_gaze = "NONE"
        self.gaze_started_at = None

        # 마지막 이동/클릭 시각
        self.last_move_at = 0
        self.last_click_at = 0

        # 깜빡임 상태
        self.eye_was_closed = False
        self.blink_times = []

    def update(self, vision_data):
        """
        vision_data 예시:
        {
            "face_detected": True,
            "gaze": "LEFT" | "CENTER" | "RIGHT" | "NONE",
            "blink_ratio": 0.23,
            "iris_ratio": 0.51,
            "face_box": {...}
        }

        return:
            events 리스트

        이벤트 예시:
        {
            "type": "vision_move",
            "direction": "LEFT"
        }

        {
            "type": "vision_click"
        }
        """

        now = time.time()
        events = []

        gaze = vision_data.get("gaze", "NONE")
        blink_ratio = vision_data.get("blink_ratio")
        face_detected = vision_data.get("face_detected", False)

        # 얼굴이 안 잡히면 전체 상태 초기화
        if not face_detected:
            self.reset()
            return events

        # 1. LEFT / RIGHT 시선 유지로 포커스 이동 이벤트 발생
        move_event = self._update_gaze_move(gaze, now)
        if move_event:
            events.append(move_event)

        # 2. 더블 깜빡임으로 현재 포커스 클릭 이벤트 발생
        click_event = self._update_blink_click(blink_ratio, gaze, now)
        if click_event:
            events.append(click_event)

        return events

    def _update_gaze_move(self, gaze, now):
        """
        LEFT/RIGHT 시선을 일정 시간 유지하면 vision_move 이벤트 발생.

        LEFT  -> 현재 포커스를 왼쪽/이전 요소로 이동
        RIGHT -> 현재 포커스를 오른쪽/다음 요소로 이동
        """

        # 일단 1차 테스트는 LEFT/RIGHT만 지원
        if gaze not in ["LEFT", "RIGHT"]:
            self._reset_gaze()
            return None

        # 새로운 방향을 보기 시작한 경우
        if gaze != self.current_gaze:
            self.current_gaze = gaze
            self.gaze_started_at = now
            return None

        if self.gaze_started_at is None:
            self.gaze_started_at = now
            return None

        hold_time = now - self.gaze_started_at

        # 일정 시간 이상 같은 방향을 봤고, 이동 쿨다운도 지났으면 이동 이벤트 발생
        if hold_time >= self.gaze_hold_threshold:
            if now - self.last_move_at < self.move_cooldown:
                return None

            self.last_move_at = now

            # 같은 방향을 계속 보고 있으면 일정 간격으로 반복 이동되도록 시작 시각 갱신
            self.gaze_started_at = now

            return {
                "type": "vision_move",
                "direction": gaze,
            }

        return None

    def _update_blink_click(self, blink_ratio, gaze, now):
        """
        더블 깜빡임을 감지하면 vision_click 이벤트 발생.
        현재 포커스된 요소를 클릭한다.
        """

        if blink_ratio is None:
            return None

        if now - self.last_move_at < self.click_after_move_grace:
            self.eye_was_closed = False
            self.blink_times.clear()
            return None

        is_closed = blink_ratio < self.blink_threshold

        # 열린 눈 -> 감긴 순간만 blink 1회로 인정
        if is_closed and not self.eye_was_closed:
            self.blink_times.append(now)

            # double_blink_interval 밖의 오래된 blink 제거
            self.blink_times = [
                t for t in self.blink_times
                if now - t <= self.double_blink_interval
            ]

        self.eye_was_closed = is_closed

        # 더블 깜빡임 감지
        if len(self.blink_times) >= 2:
            # 클릭 쿨다운
            if now - self.last_click_at < self.click_cooldown:
                self.blink_times.clear()
                return None

            self.last_click_at = now
            self.blink_times.clear()
            self.eye_was_closed = False

            return {
                "type": "vision_click",
            }

        return None

    def _reset_gaze(self):
        self.current_gaze = "NONE"
        self.gaze_started_at = None

    def reset(self):
        """
        얼굴 미감지, 사용자가 r 키 입력 등에서 전체 상태 초기화.
        """

        self.current_gaze = "NONE"
        self.gaze_started_at = None

        self.last_move_at = 0
        self.last_click_at = 0

        self.eye_was_closed = False
        self.blink_times.clear()
