<p align="center">
  <img src="https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white" />
  <img src="https://img.shields.io/badge/FastAPI-0.109-009688?style=for-the-badge&logo=fastapi&logoColor=white" />
  <img src="https://img.shields.io/badge/YOLOv8-Ultralytics-FF6F00?style=for-the-badge&logo=yolo&logoColor=white" />
  <img src="https://img.shields.io/badge/Next.js-14-000000?style=for-the-badge&logo=next.js&logoColor=white" />
  <img src="https://img.shields.io/badge/Three.js-r128-000000?style=for-the-badge&logo=three.js&logoColor=white" />
  <img src="https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" />
</p>

<h1 align="center">🛣️ RoadVision AI Pro</h1>
<h3 align="center"><em>Every Crack Tells a Story.</em></h3>

<p align="center">
  AI-powered road damage detection platform — upload a photo or stream live video and instantly detect cracks, potholes, and surface damage with GPS-tagged reports, severity scoring, 3D visualization, and blockchain verification.
</p>

<p align="center">
  <strong>Trained on 40,000+ road surface images · 75%+ detection accuracy · <120ms inference</strong>
</p>

---

## What It Does

RoadVision AI Pro uses a custom-trained **YOLOv8** deep learning model to detect **5 types** of road surface damage in real time:

| Class | Description |
|-------|-------------|
| 🔴 **Longitudinal Crack** | Cracks running along the road direction |
| 🟠 **Transverse Crack** | Cracks running across the road |
| 🟡 **Alligator Crack** | Interconnected crack patterns resembling alligator skin |
| 🔵 **Other Corruption** | General surface degradation and wear |
| 🟢 **Pothole** | Circular depressions in the road surface |

---

## Key Features

- **Image Analysis** — Upload a road photo → get bounding-box detections, confidence scores, severity assessment, and GPS coordinates
- **Live Camera Detection** — Stream webcam/dashcam feed with real-time frame-by-frame YOLO inference
- **Video Processing** — Upload video files for automated analysis with auto-snapshot on high-confidence detections
- **GPS Tagging** — Extracts location from image EXIF metadata or browser Geolocation API
- **3D Visualization** — Detected damage rendered as extruded 3D depth boxes using Three.js
- **Severity Scoring** — Automated severity assessment (Low / Moderate / High / Critical) based on crack-area ratio
- **Web3 Verification** — Connect MetaMask to hash results on-chain for tamper-proof reporting
- **Admin Dashboard** — User management, scan history, model metrics, and system health monitoring
- **JSON Output Panel** — Raw detection data displayed as formatted JSON for developer inspection

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **AI Model** | YOLOv8 (Ultralytics), PyTorch, OpenCV |
| **Backend** | Python 3.10+, FastAPI, Uvicorn, SQLAlchemy |
| **Frontend** | Vanilla JS, Three.js, GSAP 3.12, Chart.js |
| **Modern UI** | Next.js 14, React 18, TypeScript, Tailwind CSS |
| **Database** | SQLite (dev) / PostgreSQL (prod) |
| **Auth** | JWT (python-jose), bcrypt |
| **Web3** | ethers.js v6, MetaMask, Web Crypto API |
| **Deploy** | Docker, Render, Nginx |

---

## Project Structure

This repo contains **two applications** built around the same YOLOv8 model:

```
hacksrm/
├── roadvision-ai-pro/          # Full-stack app (FastAPI + Vanilla JS + Three.js)
│   ├── backend/
│   │   ├── main.py             # FastAPI server — routes, auth, YOLO inference
│   │   ├── video_processor.py  # Video/camera processing pipeline
│   │   ├── gps_utils.py        # EXIF GPS extraction
│   │   └── best.pt             # Trained YOLOv8 model (40,000+ images)
│   ├── static/                 # CSS, JS (Three.js, GSAP, Charts)
│   └── templates/              # Jinja2 HTML templates
│
├── yolo_app/                   # Modern app (FastAPI + Next.js 14)
│   ├── server/                 # FastAPI backend + PostgreSQL + Alembic
│   └── client/                 # Next.js 14 + TypeScript + Tailwind
│
├── Dockerfile                  # Production Docker build (Render-ready)
└── README.md                   # ← You are here
```

---

## Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+ (for the Next.js app only)

### RoadVision AI Pro (Classic)

```bash
git clone https://github.com/Alokgupta07-tech/hacksrm.git
cd hacksrm/roadvision-ai-pro/backend

python -m venv venv
venv\Scripts\activate            # Windows
# source venv/bin/activate       # Linux/Mac

pip install -r requirements.txt
python main.py
```

Open **http://localhost:8000** — upload a road image and analyze!

### YOLO App (Next.js)

```bash
cd hacksrm/yolo_app

# Backend
cd server
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python main.py

# Frontend (new terminal)
cd ../client
npm install
npm run dev
```

- Backend: **http://localhost:8000**
- Frontend: **http://localhost:3000**

### Docker

```bash
cd hacksrm
docker compose -f roadvision-ai-pro/docker-compose.yml up --build
```

---

## API Reference

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/health` | Server uptime, model status, system info |
| `POST` | `/predict` | Upload image → detections + severity + GPS |
| `POST` | `/analyze_video` | Upload video → get streaming ID |
| `GET` | `/video_feed/{id}` | MJPEG stream of processed video |
| `GET` | `/camera_feed` | Live camera MJPEG stream |
| `GET` | `/video_stats` | GPS position + detection count |
| `GET` | `/metrics` | Total requests, avg inference time |
| `WS` | `/ws/metrics` | Real-time metrics WebSocket |
| `POST` | `/auth/register` | Create new user account |
| `POST` | `/auth/login` | Login → JWT access token |

### Sample Response (`/predict`)

```json
{
  "success": true,
  "detections": [
    {
      "x1": 125.5, "y1": 200.3, "x2": 310.7, "y2": 380.1,
      "confidence": 0.8723,
      "class_name": "Pothole",
      "color": "#00FF00"
    }
  ],
  "severity_score": 42.5,
  "severity_level": "Moderate",
  "crack_count": 3,
  "avg_confidence": 0.7891,
  "inference_time_ms": 45.2,
  "gps": { "lat": 28.6139, "lon": 77.2090 }
}
```

---

## Model Details

| Property | Value |
|----------|-------|
| Architecture | YOLOv8 (custom trained) |
| Training Data | **40,000+ road surface images** |
| Input Size | 640×640 |
| Classes | 5 (Longitudinal Crack, Transverse Crack, Alligator Crack, Other Corruption, Pothole) |
| Accuracy | **75%+** |
| Confidence Threshold | 0.35 |
| Inference | <120ms (CPU) |

---

## Deployment

The app is Docker-ready and optimized for **Render** free tier (512 MB RAM):

- CPU-only PyTorch (no GPU required)
- Lazy model loading (defers to first request)
- Single worker, memory-optimized env vars
- JPEG quality tuned for streaming bandwidth

```bash
# Build and run locally
docker build -t roadvision-ai-pro .
docker run -p 8000:8000 roadvision-ai-pro
```

---

## Author

**Alok Gupta** — [GitHub](https://github.com/Alokgupta07-tech)

Built for **HackSRM 2026**

---

## License

MIT
