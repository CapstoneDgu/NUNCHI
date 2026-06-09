# capture.py

import cv2


class CameraCapture:
    def __init__(self, camera_index=0, width=640, height=480, fps=8, backend=None):
        self.camera_index = camera_index
        self.width = width
        self.height = height
        self.fps = fps
        self.backend = backend
        self.failed_reads = 0

        self.cap = self._open_capture()

        if not self.cap.isOpened():
            raise RuntimeError(f"[VISION] Failed to open camera index={self.camera_index}")

        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, self.width)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.height)
        self.cap.set(cv2.CAP_PROP_FPS, self.fps)

        print(
            f"[VISION] Camera opened index={self.camera_index}, "
            f"size={self.width}x{self.height}, fps={self.fps}"
        )

    def read(self):
        ret, frame = self.cap.read()

        if not ret:
            self.failed_reads += 1
            if self.failed_reads == 1 or self.failed_reads % 30 == 0:
                print(
                    f"[VISION] can't grab frame "
                    f"camera_index={self.camera_index} failed_reads={self.failed_reads}"
                )
            return None

        self.failed_reads = 0

        # 키오스크 화면 기준으로 좌우 직관적으로 보이게 반전
        frame = cv2.flip(frame, 1)

        return frame

    def release(self):
        if self.cap:
            self.cap.release()

    def _open_capture(self):
        if self.backend is None:
            return cv2.VideoCapture(self.camera_index)

        return cv2.VideoCapture(self.camera_index, self.backend)
