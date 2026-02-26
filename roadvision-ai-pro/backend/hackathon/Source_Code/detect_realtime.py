import cv2
from ultralytics import YOLO

def main():
    # Load the trained model - replace 'best.pt' with your actual path if it's different
    model_path = "best.pt"
    model = YOLO(model_path)

    # Open the video capture. 
    # Use 0 for default laptop webcam.
    # Alternatively, you can pass a path to a dashcam video file, e.g., "dashcam_video.mp4"
    video_source = 0  # Change to "your_video.mp4" to process a recorded video
    cap = cv2.VideoCapture(video_source)

    if not cap.isOpened():
        print(f"Error: Could not open video source {video_source}.")
        return

    print(f"Starting real-time pothole detection using {model_path}...")
    print("Press 'q' on the keyboard to exit.")

    while True:
        # Read a frame from the capture
        ret, frame = cap.read()
        if not ret:
            print("End of video stream or error reading frame.")
            break

        # Run YOLO inference on the frame
        # You can adjust conf (confidence threshold) as needed to reduce false positives
        results = model(frame, conf=0.4)

        # Visualize the results on the frame
        # results[0].plot() automatically draws bounding boxes and labels onto the image array
        annotated_frame = results[0].plot()

        # Display the frame
        cv2.imshow("Real-Time Pothole Detection", annotated_frame)

        # Press 'q' on the keyboard to exit the loop
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    # Release resources
    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()
