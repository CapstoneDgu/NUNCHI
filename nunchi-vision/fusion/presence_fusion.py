# fusion/presence_fusion.py

import time


class PresenceFusion:
    def __init__(
            self,
            enter_threshold_sec=0.8,
            leave_threshold_sec=2.0,
    ):
        self.enter_threshold_sec = enter_threshold_sec
        self.leave_threshold_sec = leave_threshold_sec

        self.is_present = False

        self.present_started_at = None
        self.absent_started_at = None

    def update(self, presence_data):
        now = time.time()
        events = []

        present = presence_data.get("present", False)
        area_ratio = presence_data.get("areaRatio", 0.0)

        if present:
            self.absent_started_at = None

            if self.present_started_at is None:
                self.present_started_at = now

            if not self.is_present:
                duration = now - self.present_started_at

                if duration >= self.enter_threshold_sec:
                    self.is_present = True

                    events.append({
                        "type": "presence",
                        "event": "entered",
                        "source": "presence",
                        "areaRatio": area_ratio,
                        "timestamp": now,
                    })

        else:
            self.present_started_at = None

            if self.absent_started_at is None:
                self.absent_started_at = now

            if self.is_present:
                duration = now - self.absent_started_at

                if duration >= self.leave_threshold_sec:
                    self.is_present = False

                    events.append({
                        "type": "presence",
                        "event": "left",
                        "source": "presence",
                        "timestamp": now,
                    })

        return events