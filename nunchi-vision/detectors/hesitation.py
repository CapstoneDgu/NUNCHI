# detectors/hesitation.py

from collections import deque
import time


class HesitationDetector:
    def __init__(
            self,
            window_sec=5.0,
    ):
        self.window_sec = window_sec
        self.gaze_history = deque()

    def update(self, gaze, face_detected):
        now = time.time()

        if not face_detected:
            self.gaze_history.clear()
            return {
                "gazeSwitchCount": 0,
                "centerRatio": 0.0,
                "historyCount": 0,
            }

        self.gaze_history.append((now, gaze))

        while self.gaze_history and now - self.gaze_history[0][0] > self.window_sec:
            self.gaze_history.popleft()

        gazes = [g for _, g in self.gaze_history]

        if not gazes:
            return {
                "gazeSwitchCount": 0,
                "centerRatio": 0.0,
                "historyCount": 0,
            }

        switch_count = 0
        prev = gazes[0]

        for g in gazes[1:]:
            if g != prev and g in ["LEFT", "RIGHT", "CENTER"]:
                switch_count += 1
            prev = g

        center_count = gazes.count("CENTER")
        center_ratio = center_count / len(gazes)

        return {
            "gazeSwitchCount": switch_count,
            "centerRatio": round(center_ratio, 2),
            "historyCount": len(gazes),
        }