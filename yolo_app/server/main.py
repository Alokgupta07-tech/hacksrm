import os
import hashlib
import shutil
import uuid
from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta
import json
from pathlib import Path

# Import custom utilities
from hackathon.Source_Code.submission import get_pothole_data
from video_processor import VideoProcessor
from database import SessionLocal, User, init_db, get_db

# Security Configuration
SECRET_KEY = "SUPER_SECRET_NEURAL_KEY_2026"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 # 1 day

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

app = FastAPI()

# Initialize Database
from database import DATABASE_URL
print(f"[INIT] Server starting with Password Fix and PostgreSQL support...")
print(f"[INIT] Database URL: {DATABASE_URL.split('@')[-1]}") # Log only host/db
init_db()

# Mount snapshots directory to serve captured images
os.makedirs("snapshots", exist_ok=True)
app.mount("/snaps", StaticFiles(directory="snapshots"), name="snaps")

# Helper functions
def get_password_hash(password: str):
    # Pre-hash with SHA-256 to overcome bcrypt's 72-byte limit
    pre_hash = hashlib.sha256(password.encode()).hexdigest()
    return pwd_context.hash(pre_hash)

def verify_session_password(plain_password, hashed_password):
    # Pre-hash with SHA-256 to match the stored hash
    pre_hash = hashlib.sha256(plain_password.encode()).hexdigest()
    return pwd_context.verify(pre_hash, hashed_password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

# Auth Endpoints
@app.post("/register")
async def register(data: dict, db: Session = Depends(get_db)):
    email = data.get("email")
    password = data.get("password")
    
    if not email or not password:
        raise HTTPException(status_code=400, detail="Email and password required")
        
    db_user = db.query(User).filter(User.email == email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Identity already registered")
        
    new_user = User(email=email, hashed_password=get_password_hash(password))
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return {"status": "success", "message": "Identity established in Neural Network"}

@app.post("/login")
async def login(data: dict, db: Session = Depends(get_db)):
    email = data.get("email")
    password = data.get("password")
    
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_session_password(password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid access credentials")
        
    access_token = create_access_token(data={"sub": user.email})
    return {"status": "success", "access_token": access_token, "token_type": "bearer"}

# Configure CORS
origins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    "http://127.0.0.1:3002",
    "http://192.168.56.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global VideoProcessor instance
video_processor = VideoProcessor(model_path="hackathon/Source_Code/best.pt" if os.path.exists("hackathon/Source_Code/best.pt") else "best.pt")

@app.post("/analyze")
async def analyze_image(file: UploadFile = File(...)):
    # Create temporary directory for this request
    request_id = str(uuid.uuid4())
    temp_dir = Path(f"temp_{request_id}")
    temp_dir.mkdir(exist_ok=True)
    
    try:
        # Save uploaded file
        file_path = temp_dir / file.filename
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        print(f"[DEBUG] File saved to: {file_path}")
        
        # 1. Run consolidated detection and GPS extraction
        model_path = "hackathon/Source_Code/best.pt"
        if not os.path.exists(model_path):
            model_path = "best.pt" if os.path.exists("best.pt") else "yolov8n.pt"
            
        print(f"[DEBUG] Using model: {model_path}")
        result_data = get_pothole_data(file_path, model_path=model_path)
        
        # Fallback GPS if null
        final_lat = result_data["lat"]
        final_lon = result_data["lon"]
        is_gps_available = final_lat is not None and final_lon is not None
        
        if not is_gps_available and result_data["predictions"]:
            # Use the first detection's lat/lon (formerly x/y) as fallback
            final_lat = result_data["predictions"][0]["lat"]
            final_lon = result_data["predictions"][0]["lon"]
            is_gps_available = True
            print(f"[DEBUG] Falling back to detection coordinates: {final_lat}, {final_lon}")
        
        return {
            "status": "success",
            "predictions": result_data["predictions"],
            "gps": {
                "lat": final_lat,
                "lon": final_lon,
                "available": is_gps_available
            },
            "image_name": file.filename,
            "request_id": request_id
        }
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # Cleanup temporary files
        if temp_dir.exists():
            shutil.rmtree(temp_dir)

@app.post("/analyze_video")
async def analyze_video(file: UploadFile = File(...)):
    # Save video temporarily to process
    request_id = str(uuid.uuid4())
    temp_dir = Path(f"temp_video_{request_id}")
    temp_dir.mkdir(exist_ok=True)
    video_path = temp_dir / file.filename
    with open(video_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    return {"status": "success", "video_id": request_id, "video_path": str(video_path)}

@app.get("/video_feed/{video_id}")
async def video_feed(video_id: str, path: str):
    # This route will stream the frames from the video_processor
    return StreamingResponse(video_processor.process_video(path, is_live=False),
                             media_type="multipart/x-mixed-replace; boundary=frame")

@app.get("/camera_feed")
async def camera_feed(index: int = 0):
    # index 0 is usually internal webcam, 1 is USB camera
    return StreamingResponse(video_processor.process_video(index, is_live=True),
                             media_type="multipart/x-mixed-replace; boundary=frame")

@app.get("/video_stats")
async def get_video_stats():
    return video_processor.get_current_stats()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
