# detectors/face_mesh_detector.py

import cv2
import mediapipe as mp
import math


class FaceMeshDetector:
    def __init__(self):
        self.mp_face_mesh = mp.solutions.face_mesh
        self.face_mesh = self.mp_face_mesh.FaceMesh(
            static_image_mode=False,
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5,
        )

        # 왼쪽 눈 기준 landmark
        self.LEFT_EYE = [33, 133, 159, 145]

        # 오른쪽 눈 기준 landmark
        self.RIGHT_EYE = [362, 263, 386, 374]

        # MediaPipe refine_landmarks=True일 때 왼쪽 홍채 중심
        self.LEFT_IRIS_CENTER = 468
        self.gaze_center_ratio = 0.5
        self.gaze_left_threshold = 0.45
        self.gaze_right_threshold = 0.55

    def detect(self, frame):
        """
        main.py에서 호출하는 표준 메서드.

        return:
            vision_data, debug_frame
        """

        debug_frame = frame.copy()
        frame_height, frame_width = frame.shape[:2]

        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = self.face_mesh.process(rgb)

        if not results.multi_face_landmarks:
            vision_data = {
                "face_detected": False,
                "face_box": None,
                "gaze": "NONE",
                "blink_ratio": None,
                "iris_ratio": None,
            }

            cv2.putText(
                debug_frame,
                "NO FACE",
                (20, 40),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.8,
                (0, 0, 255),
                2,
            )

            return vision_data, debug_frame

        face_landmarks = results.multi_face_landmarks[0]

        landmarks = face_landmarks.landmark

        face_box = self._calculate_face_box(
            landmarks,
            frame_width,
            frame_height,
        )

        iris_ratio = self._calculate_iris_ratio(
            landmarks,
            frame_width,
            frame_height,
        )

        gaze = self._classify_gaze(iris_ratio)

        blink_ratio = self._calculate_blink_ratio(
            landmarks,
            frame_width,
            frame_height,
        )

        vision_data = {
            "face_detected": True,
            "face_box": face_box,
            "gaze": gaze,
            "blink_ratio": blink_ratio,
            "iris_ratio": iris_ratio,
        }

        self._draw_debug(
            debug_frame,
            landmarks,
            frame_width,
            frame_height,
            face_box,
            gaze,
            iris_ratio,
            blink_ratio,
        )

        return vision_data, debug_frame

    def _calculate_face_box(self, landmarks, frame_width, frame_height):
        xs = [int(lm.x * frame_width) for lm in landmarks]
        ys = [int(lm.y * frame_height) for lm in landmarks]

        x_min = max(min(xs), 0)
        y_min = max(min(ys), 0)
        x_max = min(max(xs), frame_width)
        y_max = min(max(ys), frame_height)

        return {
            "x": x_min,
            "y": y_min,
            "w": x_max - x_min,
            "h": y_max - y_min,
        }

    def _calculate_iris_ratio(self, landmarks, frame_width, frame_height):
        left_outer = landmarks[33]
        left_inner = landmarks[133]
        iris = landmarks[self.LEFT_IRIS_CENTER]

        outer_x = left_outer.x * frame_width
        inner_x = left_inner.x * frame_width
        iris_x = iris.x * frame_width

        eye_width = abs(inner_x - outer_x)

        if eye_width == 0:
            return 0.5

        ratio = (iris_x - outer_x) / eye_width

        return round(ratio, 3)

    def _classify_gaze(self, iris_ratio):
        if iris_ratio is None:
            return "NONE"

        if iris_ratio < self.gaze_left_threshold:
            return "LEFT"

        if iris_ratio > self.gaze_right_threshold:
            return "RIGHT"

        return "CENTER"

    def set_gaze_calibration(self, center_ratio, left_ratio=None, right_ratio=None):
        center = self._clamp_ratio(center_ratio, 0.5)
        left = self._clamp_ratio(left_ratio, None)
        right = self._clamp_ratio(right_ratio, None)

        min_margin = 0.04

        if left is not None and left < center:
            left_threshold = (left + center) / 2
        else:
            left_threshold = center - 0.06

        if right is not None and right > center:
            right_threshold = (right + center) / 2
        else:
            right_threshold = center + 0.06

        left_threshold = min(left_threshold, center - min_margin)
        right_threshold = max(right_threshold, center + min_margin)

        self.gaze_center_ratio = round(center, 3)
        self.gaze_left_threshold = round(max(0.2, left_threshold), 3)
        self.gaze_right_threshold = round(min(0.8, right_threshold), 3)

        print(
            "[VISION_CALIBRATION]",
            {
                "center": self.gaze_center_ratio,
                "leftThreshold": self.gaze_left_threshold,
                "rightThreshold": self.gaze_right_threshold,
            },
        )

    def _clamp_ratio(self, value, default):
        try:
            ratio = float(value)
        except (TypeError, ValueError):
            return default

        return max(0.0, min(1.0, ratio))

    def _calculate_blink_ratio(self, landmarks, frame_width, frame_height):
        left_ratio = self._eye_open_ratio(
            landmarks,
            self.LEFT_EYE,
            frame_width,
            frame_height,
        )

        right_ratio = self._eye_open_ratio(
            landmarks,
            self.RIGHT_EYE,
            frame_width,
            frame_height,
        )

        return round((left_ratio + right_ratio) / 2, 3)

    def _eye_open_ratio(self, landmarks, eye_indexes, frame_width, frame_height):
        left_idx, right_idx, top_idx, bottom_idx = eye_indexes

        left = self._point(landmarks[left_idx], frame_width, frame_height)
        right = self._point(landmarks[right_idx], frame_width, frame_height)
        top = self._point(landmarks[top_idx], frame_width, frame_height)
        bottom = self._point(landmarks[bottom_idx], frame_width, frame_height)

        horizontal = self._distance(left, right)
        vertical = self._distance(top, bottom)

        if horizontal == 0:
            return 0.0

        return vertical / horizontal

    def _point(self, landmark, frame_width, frame_height):
        return (
            int(landmark.x * frame_width),
            int(landmark.y * frame_height),
        )

    def _distance(self, p1, p2):
        return math.dist(p1, p2)

    def _draw_debug(
            self,
            frame,
            landmarks,
            frame_width,
            frame_height,
            face_box,
            gaze,
            iris_ratio,
            blink_ratio,
    ):
        # face box
        x = face_box["x"]
        y = face_box["y"]
        w = face_box["w"]
        h = face_box["h"]

        cv2.rectangle(
            frame,
            (x, y),
            (x + w, y + h),
            (0, 255, 0),
            2,
        )

        # left eye points
        for idx in self.LEFT_EYE:
            px, py = self._point(landmarks[idx], frame_width, frame_height)
            cv2.circle(frame, (px, py), 3, (255, 0, 0), -1)

        # right eye points
        for idx in self.RIGHT_EYE:
            px, py = self._point(landmarks[idx], frame_width, frame_height)
            cv2.circle(frame, (px, py), 3, (255, 0, 0), -1)

        # iris
        iris_x, iris_y = self._point(
            landmarks[self.LEFT_IRIS_CENTER],
            frame_width,
            frame_height,
        )
        cv2.circle(frame, (iris_x, iris_y), 4, (0, 255, 255), -1)

        cv2.putText(
            frame,
            f"GAZE: {gaze}",
            (20, 40),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            (0, 255, 0),
            2,
        )

        cv2.putText(
            frame,
            f"iris_ratio: {iris_ratio}",
            (20, 70),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            (0, 255, 255),
            2,
        )

        cv2.putText(
            frame,
            f"blink_ratio: {blink_ratio}",
            (20, 100),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            (255, 255, 0),
            2,
        )
