# detectors/presence.py

class PresenceDetector:
    def __init__(
            self,
            min_face_area_ratio=0.03,
    ):
        self.min_face_area_ratio = min_face_area_ratio

    def detect(self, frame_width, frame_height, face_box):
        """
        face_box 예시:
        {
            "x": 120,
            "y": 80,
            "w": 220,
            "h": 260
        }
        """

        if face_box is None:
            return {
                "faceVisible": False,
                "areaRatio": 0.0,
                "present": False,
            }

        frame_area = frame_width * frame_height
        face_area = face_box["w"] * face_box["h"]

        area_ratio = face_area / frame_area if frame_area > 0 else 0.0

        present = area_ratio >= self.min_face_area_ratio

        return {
            "faceVisible": True,
            "areaRatio": round(area_ratio, 4),
            "present": present,
        }