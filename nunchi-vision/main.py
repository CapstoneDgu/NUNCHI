# main.py

import asyncio
import os
import threading
import time
import cv2

from capture import CameraCapture
from server import VisionWebSocketServer

from detectors.face_mesh_detector import FaceMeshDetector
from detectors.presence import PresenceDetector
from detectors.hesitation import HesitationDetector

from fusion.eye_selection_fusion import EyeSelectionFusion
from fusion.presence_fusion import PresenceFusion
from fusion.hesitation_fusion import HesitationFusion


WS_HOST = "127.0.0.1"
WS_PORT = 8765


async def main():
    ws_server = VisionWebSocketServer()

    loop = asyncio.get_running_loop()

    vision_thread = threading.Thread(
        target=run_vision_loop,
        args=(ws_server, loop),
        daemon=True,
    )
    vision_thread.start()

    await ws_server.start()


def run_vision_loop(ws_server, loop):
    camera_index = int(os.environ.get("NUNCHI_CAMERA_INDEX", "0"))
    camera_backend = cv2.CAP_DSHOW if os.name == "nt" else None
    capture = CameraCapture(
        camera_index=camera_index,
        width=640,
        height=480,
        fps=15,
        backend=camera_backend,
    )

    face_detector = FaceMeshDetector()
    presence_detector = PresenceDetector()
    hesitation_detector = HesitationDetector()

    eye_fusion = EyeSelectionFusion()
    presence_fusion = PresenceFusion()
    hesitation_fusion = HesitationFusion()

    print("[VISION] vision loop started")
    print("[VISION] q: quit")

    while True:
        frame = capture.read()

        if frame is None:
            time.sleep(0.1)
            continue

        frame_height, frame_width = frame.shape[:2]

        vision_data, debug_frame = face_detector.detect(frame)

        handle_ws_commands(ws_server, face_detector)

        face_detected = vision_data.get("face_detected", False)
        face_box = vision_data.get("face_box")
        gaze = vision_data.get("gaze", "NONE")

        # 1. presence 접근/이탈 감지
        presence_data = presence_detector.detect(
            frame_width=frame_width,
            frame_height=frame_height,
            face_box=face_box,
        )

        presence_events = presence_fusion.update(presence_data)

        # 2. eye selection 감지
        eye_events = eye_fusion.update(vision_data)

        # 3. hesitation 점수 계산
        hesitation_data = hesitation_detector.update(
            gaze=gaze,
            face_detected=face_detected,
        )

        hesitation_events = hesitation_fusion.update(
            hesitation_data=hesitation_data,
            presence_data=presence_data,
            eye_events=eye_events,
        )

        all_events = []
        all_events.extend(presence_events)
        all_events.extend(eye_events)
        all_events.extend(hesitation_events)

        if ws_server.calibration_debug_enabled:
            all_events.append({
                "type": "vision_debug",
                "gaze": vision_data.get("gaze", "NONE"),
                "iris_ratio": vision_data.get("iris_ratio"),
                "blink_ratio": vision_data.get("blink_ratio"),
                "face_detected": vision_data.get("face_detected", False),
                "timestamp": time.time(),
            })

        for event in all_events:
            print("[VISION_EVENT]", event)

            asyncio.run_coroutine_threadsafe(
                ws_server.broadcast(event),
                loop,
            )

        draw_debug_text(
            debug_frame,
            presence_data,
            hesitation_data,
        )

        cv2.imshow("NUNCHI Vision", debug_frame)

        key = cv2.waitKey(1) & 0xFF

        if key == ord("q"):
            break

        if key == ord("r"):
            eye_fusion.reset()
            print("[VISION] reset")

    capture.release()
    cv2.destroyAllWindows()


def handle_ws_commands(ws_server, face_detector):
    for command in ws_server.drain_commands():
        command_type = command.get("type")

        if command_type == "calibration_debug":
            ws_server.calibration_debug_enabled = bool(command.get("enabled"))
            print("[VISION_CALIBRATION] debug", ws_server.calibration_debug_enabled)
            continue

        if command_type == "gaze_calibration":
            face_detector.set_gaze_calibration(
                center_ratio=command.get("center"),
                left_ratio=command.get("left"),
                right_ratio=command.get("right"),
            )


def draw_debug_text(frame, presence_data, hesitation_data):
    y = 30

    cv2.putText(
        frame,
        f"PRESENT: {presence_data.get('present')} area={presence_data.get('areaRatio')}",
        (20, y),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.6,
        (0, 255, 0),
        2,
    )

    y += 30

    cv2.putText(
        frame,
        f"HESITATION: switch={hesitation_data.get('gazeSwitchCount')} center={hesitation_data.get('centerRatio')}",
        (20, y),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.6,
        (0, 255, 255),
        2,
    )


if __name__ == "__main__":
    asyncio.run(main())
