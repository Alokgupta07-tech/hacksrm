"""
RoadVision AI Pro - Production-Grade AI SaaS Platform
FastAPI Backend with Authentication, WebSockets, Stripe, and Admin Dashboard
"""

import os
import time
import json
import asyncio
import logging
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any, Set
from contextlib import asynccontextmanager
from pathlib import Path

try:
    import cv2
except Exception:
    cv2 = None
import numpy as np
from fastapi import (
    FastAPI, File, Form, UploadFile, HTTPException, Request, 
    Depends, status, WebSocket, WebSocketDisconnect, Query
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, HTMLResponse, StreamingResponse
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Boolean, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
try:
    from ultralytics import YOLO
    ULTRALYTICS_AVAILABLE = True
except Exception:
    YOLO = None
    ULTRALYTICS_AVAILABLE = False
import uvicorn
import shutil
import uuid
import tempfile

# Import video processing & submission utilities
try:
    from video_processor import VideoProcessor
    VIDEO_PROCESSOR_AVAILABLE = True
except ImportError:
    VideoProcessor = None
    VIDEO_PROCESSOR_AVAILABLE = False
    logger = logging.getLogger(__name__)  # will be re-assigned below

try:
    from hackathon.Source_Code.submission import get_pothole_data, get_gps_coordinates
    SUBMISSION_AVAILABLE = True
except ImportError:
    get_pothole_data = None
    get_gps_coordinates = None
    SUBMISSION_AVAILABLE = False

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# =============================================================================
# CONFIGURATION
# =============================================================================

class Settings:
    """Application settings from environment variables."""
    # Server
    PORT: int = int(os.getenv("PORT", 8000))
    HOST: str = os.getenv("HOST", "0.0.0.0")
    DEBUG: bool = os.getenv("DEBUG", "false").lower() == "true"
    
    # Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./roadvision.db")
    
    # Model
    MODEL_PATH: str = os.getenv("MODEL_PATH", "best.pt")
    DEMO_MODE: bool = os.getenv("DEMO_MODE", "true").lower() == "true"
    
    # Stripe
    STRIPE_SECRET_KEY: str = os.getenv("STRIPE_SECRET_KEY", "")
    STRIPE_WEBHOOK_SECRET: str = os.getenv("STRIPE_WEBHOOK_SECRET", "")
    
    # File Upload
    MAX_FILE_SIZE: int = int(os.getenv("MAX_FILE_SIZE", "10")) * 1024 * 1024
    
    # CORS
    CORS_ORIGINS: List[str] = os.getenv("CORS_ORIGINS", "*").split(",")

settings = Settings()

# =============================================================================
# DATABASE SETUP
# =============================================================================

Base = declarative_base()
engine = create_engine(settings.DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class User(Base):
    """User model for authentication."""
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    full_name = Column(String)
    role = Column(String, default="user")  # user, admin
    subscription_tier = Column(String, default="free")  # free, pro, enterprise
    subscription_status = Column(String, default="active")
    stripe_customer_id = Column(String, nullable=True)
    stripe_subscription_id = Column(String, nullable=True)
    scans_used = Column(Integer, default=0)
    scans_limit = Column(Integer, default=10)  # 10 for free, 500 for pro, unlimited for enterprise
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)

class Scan(Base):
    """Scan history model."""
    __tablename__ = "scans"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer)
    severity_score = Column(Float)
    severity_level = Column(String)
    crack_count = Column(Integer)
    avg_confidence = Column(Float)
    inference_time_ms = Column(Float)
    image_path = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class ModelVersion(Base):
    """Model versioning for training pipeline."""
    __tablename__ = "model_versions"
    
    id = Column(Integer, primary_key=True, index=True)
    version = Column(String, unique=True)
    path = Column(String)
    accuracy = Column(Float)
    loss = Column(Float)
    is_active = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    model_metadata = Column("metadata", Text, nullable=True)

# Create tables
Base.metadata.create_all(bind=engine)

# =============================================================================
# AUTHENTICATION
# =============================================================================

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Hash a password."""
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Create a JWT access token."""
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def get_db():
    """Get database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    """Get current authenticated user."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise credentials_exception
    return user

async def get_current_active_user(current_user: User = Depends(get_current_user)):
    """Get current active user."""
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user

async def require_admin(current_user: User = Depends(get_current_user)):
    """Require admin role."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

# =============================================================================
# GLOBAL STATE & METRICS
# =============================================================================

class SystemMetrics:
    """Global metrics tracking for production monitoring."""
    def __init__(self):
        self.total_requests: int = 0
        self.total_inference_time: float = 0.0
        self.server_start_time: float = time.time()
        self.average_inference_time: float = 0.0
        self.model_loaded: bool = False
        self.model_load_time: Optional[float] = None
        self.active_websockets: Set[WebSocket] = set()
        self.latest_inference: Dict[str, Any] = {}
    
    def update_inference_time(self, inference_time: float):
        """Update running average of inference time."""
        self.total_requests += 1
        self.total_inference_time += inference_time
        self.average_inference_time = self.total_inference_time / self.total_requests
    
    def get_uptime(self) -> float:
        """Get server uptime in seconds."""
        return time.time() - self.server_start_time
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert metrics to dictionary for API response."""
        return {
            "total_requests": self.total_requests,
            "average_inference_time": round(self.average_inference_time, 2),
            "uptime_seconds": round(self.get_uptime(), 2),
            "model_loaded": self.model_loaded,
            "active_websockets": len(self.active_websockets),
            "latest_inference": self.latest_inference
        }
    
    async def broadcast(self, message: dict):
        """Broadcast message to all connected WebSockets."""
        disconnected = set()
        for ws in self.active_websockets:
            try:
                await ws.send_json(message)
            except:
                disconnected.add(ws)
        
        # Remove disconnected clients
        self.active_websockets -= disconnected

# Global instances
metrics = SystemMetrics()
model = None
video_processor = None
_upload_dir = os.path.join(tempfile.gettempdir(), "roadvision_uploads")
_snapshots_dir = os.path.join(Path(__file__).resolve().parent, "snapshots")

# =============================================================================
# MODEL MANAGEMENT
# =============================================================================

def load_yolo_model(model_path: str = None):
    """Load real YOLOv8 model for road damage detection."""
    global model, metrics
    
    # Resolve model path — check multiple locations
    _backend_dir = Path(__file__).resolve().parent
    candidates = [
        model_path or settings.MODEL_PATH,
        str(_backend_dir / "best.pt"),
        str(_backend_dir / "hackathon" / "Source_Code" / "best.pt"),
    ]
    
    resolved_path = None
    for p in candidates:
        if p and os.path.exists(p):
            resolved_path = p
            break
    
    if resolved_path is None:
        raise FileNotFoundError(f"Model file not found in any of: {candidates}")
    
    if not ULTRALYTICS_AVAILABLE:
        raise ImportError("ultralytics package is required but not installed")
    
    try:
        logger.info(f"Loading YOLOv8 model from {resolved_path}")
        model = YOLO(resolved_path)
        metrics.model_loaded = True
        metrics.model_load_time = time.time()
        logger.info(f"✅ Model loaded successfully — classes: {model.names}")
        return model
    except Exception as e:
        logger.error(f"Failed to load model: {e}")
        raise

# =============================================================================
# LIFESPAN MANAGEMENT
# =============================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    global video_processor
    logger.info("🚀 RoadVision AI Pro Starting...")
    
    # Create required directories
    os.makedirs(_upload_dir, exist_ok=True)
    os.makedirs(_snapshots_dir, exist_ok=True)
    
    try:
        load_yolo_model()
        # Warm up model with a dummy image to trigger JIT compilation
        if model is not None:
            import numpy as np
            _dummy = np.zeros((640, 640, 3), dtype=np.uint8)
            model(_dummy, verbose=False, imgsz=640)
            logger.info("✅ Model warmed up (first-inference JIT done)")
        # Initialize video processor with same model path
        if VIDEO_PROCESSOR_AVAILABLE and model is not None:
            _backend_dir = Path(__file__).resolve().parent
            model_path = str(_backend_dir / "best.pt") if os.path.exists(_backend_dir / "best.pt") else settings.MODEL_PATH
            video_processor = VideoProcessor(model_path=model_path)
            logger.info("✅ VideoProcessor initialized")
        logger.info("✅ Server ready")
    except Exception as e:
        logger.error(f"⚠️ Server started with issues: {e}")
    
    yield
    
    logger.info("🛑 Server shutting down...")

# =============================================================================
# FASTAPI APPLICATION
# =============================================================================

app = FastAPI(
    title="RoadVision AI Pro",
    description="Production-grade AI SaaS for Road Crack Detection",
    version="2.0.0",
    lifespan=lifespan
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Resolve directories relative to the project root (parent of backend/)
_BASE_DIR = Path(__file__).resolve().parent.parent

# Mount static files
app.mount("/static", StaticFiles(directory=str(_BASE_DIR / "static")), name="static")

# Mount snapshots directory for auto-captured video frames
os.makedirs(_snapshots_dir, exist_ok=True)
app.mount("/snaps", StaticFiles(directory=_snapshots_dir), name="snapshots")

# Templates
templates = Jinja2Templates(directory=str(_BASE_DIR / "templates"))

# Class name map for the 5-class road damage model
CLASS_NAMES = {
    0: "Longitudinal Crack",
    1: "Transverse Crack",
    2: "Alligator Crack",
    3: "Other Corruption",
    4: "Pothole",
}

# =============================================================================
# MIDDLEWARE
# =============================================================================

@app.middleware("http")
async def timing_middleware(request: Request, call_next):
    """Track request timing."""
    start_time = time.time()
    response = await call_next(request)
    duration = time.time() - start_time
    response.headers["X-Request-Duration"] = str(duration)
    return response

# =============================================================================
# WEBSOCKET ENDPOINTS
# =============================================================================

@app.websocket("/ws/metrics")
async def websocket_metrics(websocket: WebSocket):
    """WebSocket for real-time metrics."""
    await websocket.accept()
    metrics.active_websockets.add(websocket)
    
    try:
        # Send initial metrics
        await websocket.send_json(metrics.to_dict())
        
        # Keep connection alive
        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=30)
                if data == "ping":
                    await websocket.send_text("pong")
            except asyncio.TimeoutError:
                await websocket.send_json({"type": "heartbeat"})
    except WebSocketDisconnect:
        pass
    finally:
        metrics.active_websockets.discard(websocket)

# =============================================================================
# AUTHENTICATION ENDPOINTS
# =============================================================================

@app.post("/auth/register")
async def register(
    email: str,
    password: str,
    full_name: str,
    db: Session = Depends(get_db)
):
    """Register a new user."""
    # Check if user exists
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    user = User(
        email=email,
        hashed_password=get_password_hash(password),
        full_name=full_name,
        scans_limit=10  # Free tier
    )
    
    db.add(user)
    db.commit()
    db.refresh(user)
    
    return {"message": "User created successfully", "user_id": user.id}

@app.post("/auth/login")
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """Login and get access token."""
    user = db.query(User).filter(User.email == form_data.username).first()
    
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email, "role": user.role},
        expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
            "subscription_tier": user.subscription_tier,
            "scans_used": user.scans_used,
            "scans_limit": user.scans_limit
        }
    }

@app.get("/auth/me")
async def get_me(current_user: User = Depends(get_current_active_user)):
    """Get current user info."""
    return {
        "email": current_user.email,
        "full_name": current_user.full_name,
        "role": current_user.role,
        "subscription_tier": current_user.subscription_tier,
        "scans_used": current_user.scans_used,
        "scans_limit": current_user.scans_limit
    }

# =============================================================================
# MAIN PAGES
# =============================================================================

@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    """Main application page."""
    return templates.TemplateResponse("index.html", {"request": request, "demo_mode": settings.DEMO_MODE})

@app.get("/demo")
async def demo(request: Request, mode: str = None):
    """Demo mode with optional investor mode."""
    return templates.TemplateResponse("demo.html", {
        "request": request,
        "investor_mode": mode == "investor"
    })

@app.get("/admin")
async def admin(request: Request):
    """Admin dashboard."""
    return templates.TemplateResponse("admin.html", {"request": request})

@app.get("/training")
async def training(request: Request):
    """AI training pipeline UI."""
    return templates.TemplateResponse("training.html", {"request": request})

# =============================================================================
# API ENDPOINTS
# =============================================================================

@app.get("/api/config")
async def get_config():
    """Return public application config."""
    return {
        "demo_mode": settings.DEMO_MODE,
        "version": "2.0.0"
    }

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "ok" if metrics.model_loaded else "degraded",
        "model_loaded": metrics.model_loaded,
        "uptime_seconds": round(metrics.get_uptime(), 2),
        "timestamp": datetime.utcnow().isoformat()
    }

@app.get("/metrics")
async def get_metrics():
    """Get system metrics."""
    return metrics.to_dict()

async def _get_optional_user(
    db: Session = Depends(get_db),
):
    """Return None when in demo mode; otherwise require auth."""
    if settings.DEMO_MODE:
        return None
    # Should not reach here because the /predict handler below uses
    # the real dependency when not in demo mode.
    return None

@app.post("/predict")
async def predict(
    file: UploadFile = File(...),
    browser_lat: Optional[float] = Form(None),
    browser_lon: Optional[float] = Form(None),
    current_user: User = Depends(_get_optional_user if settings.DEMO_MODE else get_current_active_user),
    db: Session = Depends(get_db)
):
    """Main prediction endpoint (auth-free in demo mode)."""
    global model, metrics
    
    # Check scan limit (skip in demo mode)
    if current_user and current_user.scans_used >= current_user.scans_limit:
        raise HTTPException(status_code=403, detail="Scan limit exceeded. Upgrade your plan.")
    
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    # Validate file
    allowed_extensions = {'.jpg', '.jpeg', '.png'}
    ext = os.path.splitext(file.filename.lower())[1]
    if ext not in allowed_extensions:
        raise HTTPException(status_code=400, detail="Invalid file type")
    
    temp_path = None
    
    try:
        # Save temp file
        temp_dir = tempfile.gettempdir()
        temp_path = os.path.join(temp_dir, f"{int(time.time())}_{file.filename}")
        contents = await file.read()
        
        if len(contents) > settings.MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail="File too large")
        
        with open(temp_path, "wb") as f:
            f.write(contents)
        
        # Process image
        image = cv2.imread(temp_path)
        if image is None:
            raise HTTPException(status_code=400, detail="Could not read image")
        
        height, width = image.shape[:2]
        total_image_area = height * width
        
        # Resize large images to speed up inference (YOLO rescales anyway)
        MAX_DIM = 1280
        if max(height, width) > MAX_DIM:
            scale = MAX_DIM / max(height, width)
            image = cv2.resize(image, (int(width * scale), int(height * scale)))
            logger.info(f"Resized {width}x{height} → {image.shape[1]}x{image.shape[0]}")
        
        # Run inference with balanced confidence threshold
        inference_start = time.time()  # measure only model time
        results = model(image, verbose=False, conf=0.35, imgsz=640)
        
        # Extract GPS coordinates from image EXIF (if available)
        gps_lat, gps_lon = None, None
        if get_gps_coordinates:
            try:
                gps_lat, gps_lon = get_gps_coordinates(temp_path)
            except Exception:
                pass
        
        # Fallback to browser-provided GPS if EXIF has no GPS data
        if gps_lat is None and gps_lon is None and browser_lat is not None and browser_lon is not None:
            gps_lat = browser_lat
            gps_lon = browser_lon
            logger.info(f"Using browser GPS: ({gps_lat}, {gps_lon})")
        
        # Process detections
        detections = []
        total_crack_area = 0
        
        logger.info(f"Inference complete — {sum(len(r.boxes) for r in results)} raw boxes")
        
        for result in results:
            for box in result.boxes:
                xyxy = box.xyxy[0]
                conf = box.conf[0]
                cls_id = box.cls[0]
                # Support both PyTorch tensors (.cpu().numpy()) and plain numpy arrays
                if hasattr(xyxy, 'cpu'):
                    xyxy = xyxy.cpu().numpy()
                if hasattr(conf, 'cpu'):
                    conf = float(conf.cpu().numpy())
                else:
                    conf = float(conf)
                if hasattr(cls_id, 'cpu'):
                    cls_id = int(cls_id.cpu().numpy())
                else:
                    cls_id = int(cls_id)
                x1, y1, x2, y2 = xyxy
                confidence = conf
                
                box_area = (x2 - x1) * (y2 - y1)
                total_crack_area += box_area
                
                # Class name from model or fallback map
                class_name = result.names.get(cls_id, CLASS_NAMES.get(cls_id, f"class_{cls_id}"))
                
                color = "#00FF00" if confidence >= 0.8 else "#FFFF00" if confidence >= 0.5 else "#FF0000"
                
                detections.append({
                    "x1": float(x1), "y1": float(y1),
                    "x2": float(x2), "y2": float(y2),
                    "confidence": round(confidence, 4),
                    "class_id": cls_id,
                    "class_name": class_name,
                    "color": color,
                    "depth": confidence  # For 3D visualization
                })
        
        # Calculate severity
        severity_score = min((total_crack_area / total_image_area) * 100, 100) if total_image_area > 0 else 0
        severity_level = "Low" if severity_score < 30 else "Moderate" if severity_score < 60 else "Severe"
        
        crack_count = len(detections)
        avg_confidence = sum(d["confidence"] for d in detections) / crack_count if crack_count > 0 else 0
        
        inference_time = (time.time() - inference_start) * 1000
        metrics.update_inference_time(inference_time)
        
        # Update user scan count (skip in demo mode)
        if current_user:
            current_user.scans_used += 1
            db.commit()
        
        # Save scan to history
        scan = Scan(
            user_id=current_user.id if current_user else 0,
            severity_score=severity_score,
            severity_level=severity_level,
            crack_count=crack_count,
            avg_confidence=avg_confidence,
            inference_time_ms=inference_time
        )
        db.add(scan)
        db.commit()
        
        # Update latest inference for WebSocket
        metrics.latest_inference = {
            "severity_score": severity_score,
            "severity_level": severity_level,
            "crack_count": crack_count,
            "inference_time_ms": inference_time,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        # Broadcast to WebSockets
        await metrics.broadcast({
            "type": "inference_complete",
            "data": metrics.latest_inference
        })
        
        return {
            "success": True,
            "detections": detections,
            "severity_score": round(severity_score, 2),
            "severity_level": severity_level,
            "crack_count": crack_count,
            "avg_confidence": round(avg_confidence, 4),
            "inference_time_ms": round(inference_time, 2),
            "scans_remaining": (current_user.scans_limit - current_user.scans_used) if current_user else 999,
            "image_dimensions": {"width": width, "height": height},
            "gps": {"lat": gps_lat, "lon": gps_lon}
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Prediction error: {e}")
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")
    finally:
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except:
                pass

# =============================================================================
# YOLO APP ENDPOINTS (Video / Camera / Analyze)
# =============================================================================

@app.post("/analyze")
async def analyze_image(file: UploadFile = File(...)):
    """Analyze an image using get_pothole_data — returns GPS + class-level predictions."""
    if not SUBMISSION_AVAILABLE:
        raise HTTPException(status_code=503, detail="Submission module not available")
    
    temp_path = None
    try:
        contents = await file.read()
        temp_path = os.path.join(tempfile.gettempdir(), f"{uuid.uuid4().hex}_{file.filename}")
        with open(temp_path, "wb") as f:
            f.write(contents)
        
        _backend_dir = Path(__file__).resolve().parent
        model_path = str(_backend_dir / "best.pt") if os.path.exists(_backend_dir / "best.pt") else settings.MODEL_PATH
        
        result = get_pothole_data(temp_path, model_path=model_path)
        return result
    except Exception as e:
        logger.error(f"Analyze error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except:
                pass

@app.post("/analyze_video")
async def analyze_video(file: UploadFile = File(...)):
    """Upload a video for MJPEG streaming analysis."""
    os.makedirs(_upload_dir, exist_ok=True)
    
    video_id = uuid.uuid4().hex
    ext = os.path.splitext(file.filename or "video.mp4")[1] or ".mp4"
    save_path = os.path.join(_upload_dir, f"{video_id}{ext}")
    
    contents = await file.read()
    with open(save_path, "wb") as f:
        f.write(contents)
    
    logger.info(f"Video uploaded: {save_path}")
    return {"video_id": video_id, "path": save_path}

@app.get("/video_feed/{video_id}")
async def video_feed(video_id: str, path: str = Query(...)):
    """Stream MJPEG video feed with real-time YOLO detections."""
    global video_processor
    
    if video_processor is None:
        raise HTTPException(status_code=503, detail="VideoProcessor not available")
    
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Video file not found")
    
    return StreamingResponse(
        video_processor.process_video(path, is_live=False),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )

@app.get("/camera_feed")
async def camera_feed(index: int = 0):
    """Live webcam MJPEG feed with YOLO detections."""
    global video_processor
    
    if video_processor is None:
        raise HTTPException(status_code=503, detail="VideoProcessor not available")
    
    return StreamingResponse(
        video_processor.process_video(index, is_live=True),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )

@app.get("/video_stats")
async def video_stats():
    """Get current video processing stats (GPS, detections, snapshots)."""
    global video_processor
    
    if video_processor is None:
        return {"lat": None, "lon": None, "detections": 0, "snapshot": None}
    
    return video_processor.get_current_stats()

# =============================================================================
# ADMIN ENDPOINTS
# =============================================================================

@app.get("/admin/stats")
async def admin_stats(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Get admin dashboard statistics."""
    total_users = db.query(User).count()
    total_scans = db.query(Scan).count()
    
    # Today's scans
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    today_scans = db.query(Scan).filter(Scan.created_at >= today).count()
    
    # Severity distribution
    severity_dist = db.query(Scan.severity_level, db.func.count(Scan.id)).group_by(Scan.severity_level).all()
    
    return {
        "total_users": total_users,
        "total_scans": total_scans,
        "today_scans": today_scans,
        "severity_distribution": {level: count for level, count in severity_dist},
        "system_metrics": metrics.to_dict()
    }

@app.get("/admin/users")
async def admin_users(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Get all users for admin."""
    users = db.query(User).all()
    return [{
        "id": u.id,
        "email": u.email,
        "full_name": u.full_name,
        "role": u.role,
        "subscription_tier": u.subscription_tier,
        "scans_used": u.scans_used,
        "created_at": u.created_at.isoformat() if u.created_at else None
    } for u in users]

@app.get("/admin/scans")
async def admin_scans(
    limit: int = 100,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get recent scans for admin."""
    scans = db.query(Scan).order_by(Scan.created_at.desc()).limit(limit).all()
    return [{
        "id": s.id,
        "user_id": s.user_id,
        "severity_score": s.severity_score,
        "severity_level": s.severity_level,
        "crack_count": s.crack_count,
        "inference_time_ms": s.inference_time_ms,
        "created_at": s.created_at.isoformat() if s.created_at else None
    } for s in scans]

# =============================================================================
# MAIN ENTRY
# =============================================================================

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level="info"
    )
