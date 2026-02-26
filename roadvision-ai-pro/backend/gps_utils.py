from PIL import Image
from PIL.ExifTags import TAGS, GPSTAGS

def get_decimal_from_dms(dms, ref):
    """
    Convert degrees, minutes, seconds to decimal degrees.
    """
    degrees = dms[0]
    minutes = dms[1]
    seconds = dms[2]
    
    decimal = degrees + (minutes / 60.0) + (seconds / 3600.0)
    if ref in ['S', 'W']:
        decimal = -decimal
    return decimal

def get_gps_coordinates(image_path):
    """
    Extract GPS longitude and latitude from image EXIF data.
    Returns: (lat, lon) or (None, None) if not found.
    """
    try:
        image = Image.open(image_path)
        exif_data = image._getexif()
        
        if not exif_data:
            return None, None
        
        gps_info = {}
        for tag, value in exif_data.items():
            decoded = TAGS.get(tag, tag)
            if decoded == "GPSInfo":
                for t in value:
                    sub_decoded = GPSTAGS.get(t, t)
                    gps_info[sub_decoded] = value[t]
        
        if not gps_info:
            return None, None
        
        lat = get_decimal_from_dms(gps_info.get('GPSLatitude'), gps_info.get('GPSLatitudeRef'))
        lon = get_decimal_from_dms(gps_info.get('GPSLongitude'), gps_info.get('GPSLongitudeRef'))
        
        return lat, lon
    except Exception as e:
        print(f"Error extracting GPS data: {e}")
        return None, None
