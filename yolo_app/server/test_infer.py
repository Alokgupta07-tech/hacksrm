import traceback
import os
from hackathon.Source_Code.submission import get_pothole_data

try:
    # create a dummy valid image
    from PIL import Image
    img = Image.new('RGB', (100, 100), color = 'red')
    img.save('test_img.jpg')
    
    res = get_pothole_data('test_img.jpg', model_path='yolov8n.pt')
    print("SUCCESS")
    print(res)
except Exception as e:
    print("FAILED WITH EXCEPTION")
    traceback.print_exc()
