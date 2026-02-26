from ultralytics import YOLO
import torch
from multiprocessing import freeze_support
import gc

def main():
    print("Starting Training (Native 1280px Resolution)...")
    
    # 1. GPU Check & Setup
    if torch.cuda.is_available():
        print(f" GPU Detected: {torch.cuda.get_device_name(0)}")
        print(f"   VRAM Available: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.2f} GB")
        torch.cuda.empty_cache()
        gc.collect()
    else:
        print("ERROR: GPU not found.")
        return
    
    # 2. Load Model
    model = YOLO('yolov8s.pt')
    
    # 3. Optimized Training Configuration
    # This config targets: 12-13GB RAM + High GPU Utilization
    model.train(
        data='data.yaml',
        
        # --- MEMORY OPTIMIZATION (Prevents System Crash) ---
        workers=2,           # Parallel data loading (balanced for 16GB RAM)
        batch=6,             # Optimized for 1280px + 16GB RAM + RTX 5070
        cache=False,         # DISABLED: Caching 1280px images would use 15+ GB RAM
        
        # --- RESOLUTION (NATIVE - Maximum Accuracy for Hackathon) ---
        imgsz=1280,          # NATIVE resolution - critical for detecting fine cracks
        rect=True,           # Rectangular training (ESSENTIAL to fit native res in memory)
        
        # --- GPU UTILIZATION BOOSTERS ---
        amp=True,            # Mixed Precision (30% faster, frees VRAM for larger batches)
        close_mosaic=10,     # Disable mosaic in last 10 epochs
        nbs=64,              # Nominal batch size for normalization
        
        # --- OPTIMIZER ---
        optimizer='AdamW',   # Better convergence than SGD
        lr0=0.001,           # Initial learning rate
        lrf=0.01,            # Final learning rate (1% of lr0)
        momentum=0.937,      
        weight_decay=0.0005,
        
        # --- AUGMENTATION (Aggressive for Hackathon-Winning Generalization) ---
        hsv_h=0.015,         # Hue (lighting variations)
        hsv_s=0.7,           # Saturation (weather conditions)
        hsv_v=0.4,           # Brightness (shadows, time of day)
        degrees=0.0,         # Rotation DISABLED (rect=True incompatible)
        translate=0.1,       # Translation (camera positioning)
        scale=0.5,           # Scaling (distance variations)
        shear=0.0,           # Shear DISABLED (rect=True incompatible)
        perspective=0.0,     # Perspective DISABLED (rect=True incompatible)
        fliplr=0.5,          # Horizontal flip (orientation invariance)
        flipud=0.0,          # Vertical flip OFF (cracks have gravity orientation)
        mosaic=0.0,          # Mosaic DISABLED (rect=True incompatible)
        mixup=0.0,           # Mixup (disabled - not ideal for crack detection)
        copy_paste=0.0,      # Copy-paste (disabled for structural integrity)
        
        # --- TRAINING PARAMETERS (Hackathon Optimized) ---
        epochs=100,          # More epochs for maximum accuracy
        patience=20,         # Higher patience (don't stop too early)
        save_period=5,       # Save checkpoint every 5 epochs (safety net)
        
        # --- RUNTIME ---
        device=0,
        project='Crackathon_Results',
        name='Hackathon_Winner_Native_Res',
        exist_ok=True,
        
        # --- VALIDATION ---
        val=True,
        plots=True,          # Generate training plots
        verbose=True
    )
    
    print(" Training Complete! Check 'Crackathon_Results/Hackathon_Winner_Native_Res' folder.")
    print(" Key files:")
    print("   - weights/best.pt (BEST MODEL - use this for submission!)")
    print("   - weights/last.pt (latest checkpoint)")
    print("   - results.png (training metrics)")
    print("   - confusion_matrix.png (model performance breakdown)")

if __name__ == '__main__':
    freeze_support()
    main()