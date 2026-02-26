import cv2
from ultralytics import YOLO
import time
import os

class VideoProcessor:
    def __init__(self, model_path='best.pt', start_lat=40.7128, start_lon=-74.0060):
        self.model = YOLO(model_path)
        self.lat = start_lat
        self.lon = start_lon
        self.detection_count = 0

    def process_video(self, source, is_live=False):
        # source can be path or camera index
        cap = cv2.VideoCapture(source)
        if not cap.isOpened():
            print(f"Error: Could not open source {source}")
            return

        os.makedirs("snapshots", exist_ok=True)
        self.latest_snapshot_path = None
        self.latest_snapshot_data = None

        frame_count = 0
        while cap.isOpened():
            success, frame = cap.read()
            if not success:
                break

            # Process every 5th frame for performance
            if frame_count % 5 == 0:
                results = self.model.predict(frame, conf=0.25, verbose=False)
                
                # Annotate frame
                for r in results:
                    self.detection_count = len(r.boxes)
                    # Auto-snapshot logic: if any box > 0.7 confidence
                    should_snap = any(float(box.conf[0]) > 0.7 for box in r.boxes)
                    
                    if should_snap:
                        snap_name = f"snap_{int(time.time())}.jpg"
                        snap_path = os.path.join("snapshots", snap_name)
                        cv2.imwrite(snap_path, frame)
                        self.latest_snapshot_path = snap_path
                        # Store prediction data for this snap
                        self.latest_snapshot_data = {
                            "image": snap_name,
                            "detections": len(r.boxes),
                            "lat": self.lat,
                            "lon": self.lon
                        }
                        print(f"[DEBUG] Auto-snapshot saved: {snap_path}")

                    for box in r.boxes:
                        x1, y1, x2, y2 = map(int, box.xyxy[0])
                        conf = float(box.conf[0])
                        cls = int(box.cls[0])
                        label = f"{r.names[cls]} {conf:.2f}"
                        
                        # Draw bounding box
                        cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
                        cv2.putText(frame, label, (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)

                # Simulate GPS movement
                self.lat += 0.00001
                self.lon += 0.00001

            # Encode frame to JPEG
            ret, buffer = cv2.imencode('.jpg', frame)
            frame_bytes = buffer.tobytes()

            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')

            frame_count += 1
            if not is_live:
                 # Small sleep for file processing to not finish instantly
                 time.sleep(0.01)

        cap.release()

    def get_current_stats(self):
        return {
            "lat": self.lat,
            "lon": self.lon,
            "detections": self.detection_count,
            "snapshot": self.latest_snapshot_data
        }
