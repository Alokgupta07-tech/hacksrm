import urllib.request
import urllib.parse
from urllib.error import HTTPError

url = 'http://localhost:8000/analyze'

# A tiny valid JPEG file signature to mimic an image upload (actually we can just send arbitrary bytes if we mock it right, but here goes)
body = (
    b'--boundary\r\n'
    b'Content-Disposition: form-data; name="file"; filename="test.jpg"\r\n'
    b'Content-Type: image/jpeg\r\n\r\n'
    b'fake_image_data\r\n'
    b'--boundary--\r\n'
)

req = urllib.request.Request(url, data=body)
req.add_header('Content-Type', 'multipart/form-data; boundary=boundary')

try:
    with urllib.request.urlopen(req) as response:
        print(response.read().decode('utf-8'))
except HTTPError as e:
    print(e.read().decode('utf-8'))
