<p align="center">
  <img src="https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white" />
  <img src="https://img.shields.io/badge/FastAPI-0.109-009688?style=for-the-badge&logo=fastapi&logoColor=white" />
  <img src="https://img.shields.io/badge/YOLOv8-Ultralytics-FF6F00?style=for-the-badge&logo=yolo&logoColor=white" />
  <img src="https://img.shields.io/badge/Next.js-14-000000?style=for-the-badge&logo=next.js&logoColor=white" />
  <img src="https://img.shields.io/badge/Three.js-r128-000000?style=for-the-badge&logo=three.js&logoColor=white" />
  <img src="https://img.shields.io/badge/PostgreSQL-15-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" />
  <img src="https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" />
</p>

# RoadVision AI Pro

> **Intelligent Road Damage Detection Platform** — Upload a photo or stream live video, and the AI detects cracks, potholes, and surface damage in real time with GPS-tagged reports, severity scoring, 3D visualizations, and optional blockchain verification.

Built for **HackSRM 2026** by **Alok Gupta**.

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Quick Start](#quick-start)
- [Running with Docker](#running-with-docker)
- [API Reference](#api-reference)
- [Pages & Routes](#pages--routes)
- [Configuration](#configuration)
- [Screenshots](#screenshots)
- [Roadmap](#roadmap)
- [License](#license)

---

## Overview

RoadVision AI Pro is a **full-stack AI SaaS platform** that combines deep learning (YOLOv8) with an immersive frontend to enable:

1. **Image Analysis** — Upload a road surface photo and get bounding-box detections with per-class labels, confidence scores, and severity assessment.
2. **Video & Live Camera** — Stream video files or a live webcam/dashcam feed with real-time frame-by-frame detection and GPS tracking.
3. **GPS-Tagged Reports** — Extracts GPS from image EXIF metadata **or** the browser's Geolocation API so every detection is pinned to a real-world coordinate.
4. **3D Visualization** — Detected damage regions are rendered as extruded 3D boxes with depth visualization and an animated severity gauge.
5. **Web3 Verification** — Connect MetaMask to hash scan results on-chain (SHA-256 + simulated tx) for tamper-proof reporting.
6. **Admin Dashboard** — Role-based access with user management, scan history, model metrics, and system health monitoring.

The project ships in **two flavors**:

| App | Stack | Path |
|-----|-------|------|
| **RoadVision AI Pro** | FastAPI + Vanilla JS + Three.js + GSAP | `roadvision-ai-pro/` |
| **YOLO App** | FastAPI + Next.js 14 + Tailwind + PostgreSQL | `yolo_app/` |

Both share the same YOLOv8 model (`best.pt`) trained on 5 road damage classes.

---

## Key Features

### AI / ML Pipeline
- **YOLOv8** custom-trained model detecting **5 classes**: Longitudinal Crack, Transverse Crack, Alligator Crack, Other Corruption, Pothole
- Confidence threshold tuned to **0.35** for balanced precision/recall
- Auto-resizing of large images (>1280px) before inference for speed
- Severity scoring based on crack-area-to-image-area ratio
- Video frame-by-frame processing with auto-snapshot when confidence > 0.7

### GPS & Location
- EXIF GPS extraction from uploaded images (via PIL/Pillow)
- Browser Geolocation API fallback — prompts the user for location on page load
- GPS coordinates displayed on every analysis result

### 3D Visualization & UI
- Three.js hero background with floating wireframe grid, neon lights, and particle system
- 3D crack depth extrusion with extruded bounding boxes
- Animated severity gauge with pulsing glow
- GSAP 3.12 scroll-triggered animations and hero entrance
- Chart.js analytics (confidence distribution, severity breakdown)
- Glassmorphism design with dark theme, Inter + JetBrains Mono fonts
- DPR-aware canvas rendering (capped at 2×) via ResizeObserver
- AI preview panel with procedural road textures + Ken Burns crossfade

### Web3 / Blockchain
- MetaMask wallet connect via ethers.js v6
- SHA-256 hashing of scan results (Web Crypto API)
- "Blockchain Verified" badge with simulated tx hash
- Graceful fallback to "Demo Mode — Off-chain Report"

### Authentication & Infra
- JWT-based auth with registration, login, role-based access (user / admin)
- Subscription tiers (Free / Pro / Enterprise) with scan limits
- SQLite (default) or PostgreSQL database
- WebSocket live metrics stream
- Docker + Docker Compose + Nginx reverse proxy
- Fully responsive (1024 / 768 / 480 breakpoints)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Python 3.10+, FastAPI, Uvicorn, SQLAlchemy, Alembic |
| **AI Model** | YOLOv8 (Ultralytics), PyTorch, OpenCV |
| **Frontend (Classic)** | Vanilla JS, Jinja2 Templates, Three.js, GSAP, Chart.js |
| **Frontend (Modern)** | Next.js 14, React 18, TypeScript, Tailwind CSS, Monaco Editor |
| **Database** | SQLite (dev) / PostgreSQL (prod) |
| **Auth** | JWT (python-jose), bcrypt (passlib) |
| **Web3** | ethers.js v6, MetaMask, Web Crypto API |
| **Infra** | Docker, Docker Compose, Nginx |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        Client Browser                            │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────────────┐ │
│  │  Upload UI   │  │  Three.js   │  │  Charts / Gauge / HUD    │ │
│  │  Drag & Drop │  │  3D Scene   │  │  GSAP Animations         │ │
│  └──────┬───────┘  └─────────────┘  └──────────────────────────┘ │
│         │                                                         │
│         │  POST /predict  (image + browser GPS)                   │
│         │  WS /ws/metrics (live stream)                           │
└─────────┼─────────────────────────────────────────────────────────┘
          │
          ▼
┌──────────────────────────────────────────────────────────────────┐
│                     FastAPI Backend (port 8000)                   │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌───────────┐ │
│  │  Auth/JWT   │  │  YOLOv8    │  │  GPS Utils │  │  Video    │ │
│  │  Middleware  │  │  Inference │  │  EXIF+API  │  │  Streamer │ │
│  └─────┬───────┘  └──────┬─────┘  └──────┬─────┘  └─────┬─────┘ │
│        │                 │               │               │       │
│        ▼                 ▼               ▼               ▼       │
│  ┌──────────────────────────────────────────────────────────────┐│
│  │           SQLAlchemy ORM  →  SQLite / PostgreSQL             ││
│  └──────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
hacksrm/
├── roadvision-ai-pro/              # Classic full-stack app
│   ├── backend/
│   │   ├── main.py                 # FastAPI — routes, auth, model, WebSockets
│   │   ├── video_processor.py      # Video/camera frame-by-frame YOLO processing
│   │   ├── gps_utils.py            # EXIF GPS coordinate extraction
│   │   ├── best.pt                 # Trained YOLOv8 model weights
│   │   ├── requirements.txt        # Python dependencies
│   │   ├── hackathon/              # Original hackathon submission code
│   │   └── snapshots/              # Auto-captured detection snapshots
│   ├── static/
│   │   ├── css/
│   │   │   ├── main.css            # Design system tokens + layout
│   │   │   ├── glass.css           # Glassmorphism card styles
│   │   │   └── animations.css      # Keyframe animations
│   │   └── js/
│   │       ├── app.js              # Main orchestrator — upload, predict, Web3
│   │       ├── api.js              # REST API client (fetch wrapper)
│   │       ├── renderer.js         # 2D canvas overlay + 3D depth view
│   │       ├── threeScene.js       # Three.js particle hero background
│   │       ├── particles.js        # Floating particles + light streaks
│   │       ├── dashboard.js        # Gauge, charts, scroll reveal, HUD
│   │       ├── uiEffects.js        # Modals, parallax, glow cursor
│   │       ├── web3.js             # MetaMask connect + SHA-256 verify
│   │       ├── aiPreviewRenderer.js # Hero live-detection preview
│   │       └── roadTextureGen.js   # Procedural road surface textures
│   ├── templates/
│   │   ├── index.html              # Main page — hero, upload, results
│   │   ├── demo.html               # Standalone demo
│   │   ├── admin.html              # Admin dashboard
│   │   └── training.html           # Training pipeline UI
│   ├── docker/
│   │   └── nginx.conf              # Nginx reverse proxy config
│   ├── Dockerfile
│   └── docker-compose.yml
│
└── yolo_app/                       # Modern Next.js app
    ├── server/
    │   ├── main.py                 # FastAPI backend with PostgreSQL
    │   ├── database.py             # SQLAlchemy + PostgreSQL setup
    │   ├── video_processor.py      # Video processing pipeline
    │   ├── gps_utils.py            # GPS extraction utilities
    │   ├── best.pt                 # YOLOv8 model weights
    │   ├── requirements.txt        # Python dependencies
    │   └── alembic/                # Database migrations
    ├── client/
    │   ├── src/app/
    │   │   ├── page.tsx            # Root page (redirects to dashboard)
    │   │   ├── layout.tsx          # Root layout with global styles
    │   │   ├── globals.css         # Tailwind global styles
    │   │   └── dashboard/
    │   │       ├── page.tsx        # Main dashboard (upload, analyze, results)
    │   │       └── dash-cam/       # Live camera feed page
    │   ├── package.json
    │   ├── tailwind.config.ts
    │   └── tsconfig.json
    └── start.bat                   # One-click launcher (Windows)
```

---

## Quick Start

### Prerequisites

- **Python 3.10+**
- **Node.js 18+** (for the Next.js app only)
- **Git**

### Option A: RoadVision AI Pro (Classic)

```bash
# Clone the repository
git clone https://github.com/Alokgupta07-tech/hacksrm.git
cd hacksrm/roadvision-ai-pro/backend

# Create virtual environment and install dependencies
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # Linux/Mac

pip install -r requirements.txt

# Start the server (demo mode — no GPU needed)
# Windows PowerShell:
$env:DEMO_MODE="true"; python main.py

# Linux / Mac:
DEMO_MODE=true python main.py
```

Open **http://localhost:8000** — upload a road image and analyze!

### Option B: YOLO App (Next.js + PostgreSQL)

```bash
cd hacksrm/yolo_app

# Start the backend
cd server
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python main.py

# In a new terminal — start the frontend
cd ../client
npm install
npm run dev
```

- Backend: **http://localhost:8000**
- Frontend: **http://localhost:3000**

---

## Running with Docker

```bash
cd hacksrm/roadvision-ai-pro
docker compose up --build
```

App at `http://localhost:8000` · API docs at `/docs` · Admin at `/admin`

---

## API Reference

### Core Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/health` | Server uptime, model status, system info |
| `POST` | `/predict` | Upload image → detections + severity + GPS |
| `POST` | `/analyze` | Upload image → detections + GPS (YOLO App) |
| `POST` | `/analyze_video` | Upload video → get streaming ID |
| `GET` | `/video_feed/{id}` | MJPEG stream of processed video |
| `GET` | `/camera_feed` | Live camera MJPEG stream |
| `GET` | `/video_stats` | Current GPS position + detection count |
| `GET` | `/metrics` | Total requests, avg inference time |
| `GET` | `/api/config` | Demo mode flag, feature toggles |
| `WS` | `/ws/metrics` | Real-time metrics WebSocket stream |

### Auth Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/auth/register` | Create new user account |
| `POST` | `/auth/login` | Login → JWT access token |
| `GET` | `/auth/me` | Get current user profile |

### Admin Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/admin/stats` | System-wide statistics |
| `GET` | `/admin/users` | List all users |

### Prediction Response Example

```json
{
  "success": true,
  "detections": [
    {
      "x1": 125.5, "y1": 200.3, "x2": 310.7, "y2": 380.1,
      "confidence": 0.8723,
      "class_id": 4,
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

## Pages & Routes

| URL | Page | App |
|-----|------|-----|
| `/` | Main app — hero, upload, results, blockchain badge | Classic |
| `/demo` | Interactive demo | Classic |
| `/demo?mode=investor` | Auto-playing investor walkthrough | Classic |
| `/admin` | Admin dashboard with user management | Classic |
| `/training` | Model training pipeline UI | Classic |
| `/dashboard` | Main dashboard — upload, analyze, results | Next.js |
| `/dashboard/dash-cam` | Live camera feed with real-time detection | Next.js |

---

## Configuration

Environment variables (optional `.env` file in `backend/`):

| Variable | Default | Description |
|----------|---------|-------------|
| `DEMO_MODE` | `true` | Run with mock model (no GPU needed) |
| `PORT` | `8000` | Server port |
| `HOST` | `0.0.0.0` | Server host |
| `SECRET_KEY` | `your-secret-key...` | JWT signing key |
| `MODEL_PATH` | `best.pt` | Path to YOLOv8 weights |
| `DATABASE_URL` | `sqlite:///./roadvision.db` | Database connection string |
| `MAX_FILE_SIZE` | `10` | Max upload size in MB |
| `CORS_ORIGINS` | `*` | Allowed CORS origins |
| `STRIPE_SECRET_KEY` | — | Stripe API key (optional) |

---

## Model Details

| Property | Value |
|----------|-------|
| Architecture | YOLOv8 |
| Input Size | 640×640 |
| Classes | 5 |
| Class Names | Longitudinal Crack, Transverse Crack, Alligator Crack, Other Corruption, Pothole |
| Confidence Threshold | 0.35 |
| Training Data | Custom road damage dataset |

---

## Screenshots

> Upload road images → get instant AI detection with bounding boxes, severity scores, GPS coordinates, and 3D visualization.

---

## Roadmap

- [ ] Live mobile camera feed for real-time road scanning
- [ ] Drone integration for aerial road inspection
- [ ] Damage heatmap overlay on interactive map (Leaflet/Mapbox)
- [ ] Real smart contract deployment (Polygon / Base) for immutable reports
- [ ] Cloud deployment with GPU inference endpoint
- [ ] Multi-language dashboard (i18n)
- [ ] PDF report generation with GPS-tagged damage map
- [ ] Progressive Web App (PWA) for offline-first mobile use

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m "Add my feature"`
4. Push to the branch: `git push origin feature/my-feature`
5. Open a Pull Request

---

## Author

**Alok Gupta** — [GitHub](https://github.com/Alokgupta07-tech)

Built for **HackSRM 2026**

## License

MIT
