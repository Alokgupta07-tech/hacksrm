import os
import shutil
from ultralytics import YOLO
from pathlib import Path
from PIL import Image
from PIL.ExifTags import TAGS, GPSTAGS

def get_decimal_from_dms(dms, ref):
    if not dms or not ref:
        return None
    
    # Handle potential Rational/tuple formats from different Pillow versions
    def to_float(val):
        if isinstance(val, tuple):
            return float(val[0]) / float(val[1]) if val[1] != 0 else 0.0
        return float(val)

    try:
        degrees = to_float(dms[0])
        minutes = to_float(dms[1])
        seconds = to_float(dms[2])
        
        decimal = degrees + (minutes / 60.0) + (seconds / 3600.0)
        if ref in ['S', 'W']:
            decimal = -decimal
        return decimal
    except Exception as e:
        print(f"Error converting DMS to decimal: {e}")
        return None

def get_gps_coordinates(image_path):
    print(f"[DEBUG] Extracting GPS from: {image_path}")
    try:
        image = Image.open(image_path)
        exif_data = image._getexif()
        if not exif_data:
            print("[DEBUG] No EXIF data found in image.")
            return None, None
        
        gps_info = {}
        for tag, value in exif_data.items():
            decoded = TAGS.get(tag, tag)
            if decoded == "GPSInfo":
                for t in value:
                    sub_decoded = GPSTAGS.get(t, t)
                    gps_info[sub_decoded] = value[t]
        
        if not gps_info:
            print("[DEBUG] No GPS info found in EXIF.")
            return None, None
            
        lat = get_decimal_from_dms(gps_info.get('GPSLatitude'), gps_info.get('GPSLatitudeRef'))
        lon = get_decimal_from_dms(gps_info.get('GPSLongitude'), gps_info.get('GPSLongitudeRef'))
        
        print(f"[DEBUG] Found GPS: Lat={lat}, Lon={lon}")
        return lat, lon
    except Exception as e:
        print(f"[DEBUG] Error extracting GPS: {e}")
        return None, None

def run_inference(image_path, model_path='best.pt'):
    """
    Run YOLO inference on a single image and return results directly from the results object.
    """
    model = YOLO(model_path)
    
    # Run prediction
    # We don't need save_txt=True anymore since we're using the results object directly
    results = model.predict(
        source=str(image_path),
        save=False,
        conf=0.25,
        augment=True
    )
    
    predictions = []
    for r in results:
        boxes = r.boxes
        for i in range(len(boxes)):
            # xywhn is normalized [x_center, y_center, width, height]
            xywhn = boxes.xywhn[i].tolist()
            predictions.append({
                "class": int(boxes.cls[i]),
                "className": r.names[int(boxes.cls[i])],
                "lat": xywhn[0],
                "lon": xywhn[1],
                "width": xywhn[2],
                "height": xywhn[3],
                "confidence": float(boxes.conf[i])
            })
    
    return predictions

def get_pothole_data(image_path, model_path='best.pt'):
    """
    Consolidated function to extract GPS coordinates AND run YOLO inference.
    """
    print(f"[DEBUG] get_pothole_data called for: {image_path} with model: {model_path}")
    # 1. Extract GPS
    lat, lon = get_gps_coordinates(image_path)
    
    # 2. Run Inference
    predictions = run_inference(image_path, model_path=model_path)
    print(f"[DEBUG] Detections found: {len(predictions)}")
    
    return {
        "lat": lat,
        "lon": lon,
        "predictions": predictions
    }

if __name__ == "__main__":
    # Original logic for manual submission
    model_path = 'best.pt'                 
    test_images = r"D:\DuckDuckGo Downloads\hackathon\images\test img 1.jpeg" 
    output_name = 'hackathon_submission'   

    print(f"Loading model: {model_path}...")
    model = YOLO(model_path)
    
    print("Running inference on test images...")
    results = model.predict(
        source=test_images,
        save=False,
        save_txt=True,
        save_conf=True,
        conf=0.25,
        augment=True,
        name=output_name,
        stream=True
    )

    for r in results:
        pass

    yolo_output_dir = os.path.join('runs', 'detect', output_name, 'labels')
    final_folder = 'predictions'

    if os.path.exists(final_folder):
        shutil.rmtree(final_folder)
    os.makedirs(final_folder)

    if os.path.exists(yolo_output_dir):
        for filename in os.listdir(yolo_output_dir):
            if filename.endswith(".txt"):
                shutil.copy(os.path.join(yolo_output_dir, filename), os.path.join(final_folder, filename))
    
    shutil.make_archive('submission', 'zip', root_dir='.', base_dir=final_folder)
    print(f"Successfully prepared submission.zip")

