import urllib.request
from urllib.error import HTTPError

from PIL import Image
img = Image.new('RGB', (100, 100), color='red')
img.save('test_real.jpg')

url = 'http://localhost:8000/analyze'

with open('test_real.jpg', 'rb') as f:
    img_data = f.read()

boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW'
body = (
    f'--{boundary}\r\n'
    f'Content-Disposition: form-data; name="file"; filename="test_real.jpg"\r\n'
    f'Content-Type: image/jpeg\r\n\r\n'
).encode('utf-8') + img_data + f'\r\n--{boundary}--\r\n'.encode('utf-8')

req = urllib.request.Request(url, data=body)
req.add_header('Content-Type', f'multipart/form-data; boundary={boundary}')

try:
    with urllib.request.urlopen(req) as response:
        print("Status", response.status)
        print(response.read().decode('utf-8'))
except HTTPError as e:
    print(f"Req failed {e.code}", e.read().decode('utf-8'))
