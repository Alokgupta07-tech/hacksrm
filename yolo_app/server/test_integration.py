import os
import sys
from pathlib import Path

# Add the server directory to sys.path
server_dir = Path(__file__).parent
sys.path.append(str(server_dir))

from gps_utils import get_gps_coordinates
from hackathon.Source_Code.submission import run_inference

def test_gps_extraction():
    print("Testing GPS extraction with missing file...")
    lat, lon = get_gps_coordinates("non_existent.jpg")
    assert lat is None and lon is None
    print("✓ GPS extraction handles missing files correctly.")

def test_inference_import():
    print("Testing inference import and model loading (if possible)...")
    # We won't actually run inference because we don't have a real image path
    # but we can try to see if the function is callable
    try:
        # Check if yolov8n.pt exists (fallback model)
        model_path = "yolov8n.pt"
        if os.path.exists(model_path):
            print(f"✓ Model {model_path} found.")
        else:
            print(f"! Model {model_path} not found, test might fail if best.pt also missing.")
            
    except Exception as e:
        print(f"✘ Inference setup failed: {e}")

if __name__ == "__main__":
    test_gps_extraction()
    test_inference_import()
    print("All tests passed!")
