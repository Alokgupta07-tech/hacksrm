"use client";

import React, { useState, useCallback, useEffect } from "react";
import Head from "next/head";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import Editor from "@monaco-editor/react";
import {
    Upload,
    Search,
    Terminal,
    Cpu,
    Zap,
    Database,
    Loader2,
    MapPin,
    Brain,
    Shield,
    Layers,
    Coins,
    FileJson,
    Code2,
    Camera,
    Video,
    LogOut
} from "lucide-react";
import { Toaster, toast } from "react-hot-toast";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export default function Dashboard() {
    const router = useRouter();
    const [credits, setCredits] = useState(100);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [videoData, setVideoData] = useState<any>(null);
    const [isLiveMode, setIsLiveMode] = useState(false);
    const [liveStats, setLiveStats] = useState<any>({ lat: 0, lon: 0, detections: 0, snapshot: null });

    useEffect(() => {
       // const token = localStorage.getItem("access_token");
        const token = 'cghbjbkbkbvmv';
        if (!token) {
            router.push("/");
        }
    }, [router]);

    const handleLogout = () => {
        localStorage.removeItem("access_token");
        toast.success("Identity session terminated.");
        router.push("/");
    };

    const startStatsPolling = useCallback(() => {
        const interval = setInterval(async () => {
            try {
                const backendHost = window.location.hostname === 'localhost' ? 'localhost' : window.location.hostname;
                const res = await fetch(`http://${backendHost}:8000/video_stats`);
                if (res.ok) {
                    const stats = await res.json();
                    setLiveStats(stats);

                    if (stats.snapshot && (!result || stats.snapshot.image !== result.image_name)) {
                        setResult({
                            status: "success",
                            predictions: Array(stats.snapshot.detections).fill({ className: "Auto-Snapshot Detection" }),
                            gps: { lat: stats.snapshot.lat, lon: stats.snapshot.lon, available: true },
                            image_name: stats.snapshot.image,
                            isSnapshot: true
                        });
                    }
                }
            } catch (e) {
                console.error("Polling error", e);
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [result]);

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        if (acceptedFiles.length === 0) return;

        const file = acceptedFiles[0];
        const isVideo = file.type.startsWith('video/');

        if (credits < 5) {
            toast.error("Insufficient credits. Please top up!");
            return;
        }

        setPreview(URL.createObjectURL(file));
        setIsAnalyzing(true);
        setResult(null);
        setVideoData(null);

        const formData = new FormData();
        formData.append("file", file);

        try {
            const backendHost = window.location.hostname === 'localhost' ? 'localhost' : window.location.hostname;
            const endpoint = isVideo ? "/analyze_video" : "/analyze";
            const response = await fetch(`http://${backendHost}:8000${endpoint}`, {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                throw new Error("Analysis failed");
            }

            const data = await response.json();
            if (isVideo) {
                setVideoData(data);
                startStatsPolling();
            } else {
                setResult(data);
            }
            setCredits(prev => prev - 5);
            toast.success("Analysis complete! 5 credits deducted.");
        } catch (error) {
            console.error(error);
            toast.error("Error analyzing file.");
        } finally {
            setIsAnalyzing(false);
        }
    }, [credits, startStatsPolling]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'image/*': [], 'video/*': [] },
        multiple: false
    });

    return (
        <div className="min-h-screen bg-[#0a0a0c] text-slate-200 selection:bg-blue-500/30">
            <Toaster position="top-right" />

            <nav className="border-b border-white/5 bg-black/40 backdrop-blur-xl sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-4 group">
                        <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-[0_0_30px_-5px_rgba(37,99,235,0.4)] group-hover:scale-105 transition-transform duration-500">
                            <Shield className="w-7 h-7 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold bg-gradient-to-r from-white via-blue-100 to-slate-400 bg-clip-text text-transparent tracking-tight">
                                CrackDash
                            </h1>
                            <p className="text-[10px] text-blue-400 tracking-[0.2em] font-bold uppercase opacity-80">Drive.Detect.Fix</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        <button
                            onClick={() => {
                                const newMode = !isLiveMode;
                                setIsLiveMode(newMode);
                                if (newMode) startStatsPolling();
                            }}
                            className={`flex items-center gap-3 px-6 h-12 rounded-xl border transition-all duration-300 font-mono text-xs tracking-widest ${isLiveMode
                                    ? 'bg-red-500/10 border-red-500/40 text-red-400 shadow-[0_0_20px_-5px_rgba(239,68,68,0.3)]'
                                    : 'bg-slate-900 border-white/5 text-slate-400 hover:border-blue-500/30'
                                }`}
                        >
                            <div className={`w-2 h-2 rounded-full ${isLiveMode ? 'bg-red-500 animate-pulse' : 'bg-slate-600'}`} />
                            {isLiveMode ? 'STOP LIVE TRACKING' : 'START LIVE CAMERA'}
                        </button>
                        <div className="flex items-center gap-2 bg-slate-900/50 border border-slate-800 rounded-full px-4 py-1.5 shadow-inner">
                            <Coins className="w-4 h-4 text-amber-500" />
                            <span className="font-mono text-sm font-bold text-amber-500">{credits}</span>
                            <span className="text-[10px] text-slate-500 font-medium ml-1">CREDITS AVAILABLE</span>
                        </div>
                        <button 
                            onClick={handleLogout}
                            className="p-3 bg-red-500/5 hover:bg-red-500/10 rounded-xl border border-red-500/10 transition-colors text-red-500 group"
                            title="Terminate Session"
                        >
                            <LogOut className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
                        </button>
                    </div>
                </div>
            </nav>

            <div className="container mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 h-[calc(100vh-100px)]">
                <div className="lg:col-span-5 flex flex-col gap-6 overflow-hidden">
                    <section className="flex-1 flex flex-col gap-4 min-h-0">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Upload className="w-4 h-4 text-blue-400" />
                                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">Input Source</h2>
                            </div>
                            <span className="text-[10px] text-slate-500 font-mono">COST: 5 CREDITS / RUN</span>
                        </div>

                        <div
                            {...getRootProps()}
                            className={cn(
                                "relative flex-1 rounded-2xl border-2 border-dashed transition-all duration-300 group overflow-hidden flex flex-col items-center justify-center cursor-pointer bg-[#161b22]/40",
                                isDragActive ? "border-blue-500 bg-blue-500/5" : "border-slate-800 hover:border-slate-700",
                                preview ? "border-none shadow-none" : ""
                            )}
                        >
                            <input {...getInputProps()} />

                            {isLiveMode ? (
                                <div className="relative w-full h-full flex items-center justify-center bg-black/40 overflow-hidden">
                                    <img
                                        src={`http://${window.location.hostname === 'localhost' ? 'localhost' : window.location.hostname}:8000/camera_feed?index=0`}
                                        className="w-full h-full object-contain mix-blend-normal"
                                        alt="Live Camera Feed"
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).src = 'https://via.placeholder.com/640x480?text=Camera+Not+Found';
                                        }}
                                    />
                                    <div className="absolute top-6 left-6 flex items-center gap-3">
                                        <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(239,68,68,1)]" />
                                        <span className="text-[10px] font-mono font-bold tracking-[0.3em] text-white bg-black/60 px-3 py-1.5 rounded-full border border-white/10 backdrop-blur-md">LIVE SECURE FEED</span>
                                    </div>
                                </div>
                            ) : preview ? (
                                <div className="relative w-full h-full flex items-center justify-center bg-black/40">
                                    {videoData ? (
                                        <img
                                            src={`http://${window.location.hostname === 'localhost' ? 'localhost' : window.location.hostname}:8000/video_feed/${videoData.video_id}?path=${encodeURIComponent(videoData.video_path)}`}
                                            className="w-full h-full object-contain mix-blend-normal"
                                            alt="Video Feed"
                                        />
                                    ) : (
                                        <img
                                            src={preview}
                                            className="w-full h-full object-contain mix-blend-normal"
                                            alt="Preview"
                                        />
                                    )}
                                    {isAnalyzing && (
                                        <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex flex-col items-center justify-center gap-4 transition-all animate-in fade-in">
                                            <div className="relative">
                                                <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
                                                <div className="absolute inset-0 blur-lg bg-blue-500 animate-pulse opacity-20"></div>
                                            </div>
                                            <p className="text-sm font-mono text-blue-200 tracking-widest animate-pulse font-bold">ANALYZING FRAME...</p>
                                        </div>
                                    )}
                                    <div className="absolute top-4 right-4 group-hover:opacity-100 opacity-0 transition-opacity bg-black/80 p-2 rounded-lg border border-white/10 backdrop-blur-md">
                                        <p className="text-[10px] text-white/60">Click or drag to replace</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center p-8 flex flex-col items-center gap-6">
                                    <div className="w-20 h-20 bg-slate-900 border border-slate-800 rounded-3xl flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform duration-500 ring-1 ring-white/5">
                                        <Upload className="w-10 h-10 text-slate-600 group-hover:text-blue-500 transition-colors" />
                                    </div>
                                    <div className="space-y-2">
                                        <h3 className="text-sm font-mono font-bold text-white tracking-widest">INITIALIZE SYSTEM</h3>
                                        <p className="text-xs text-slate-500 max-w-[200px] leading-relaxed">Drag and drop dashcam footage (Image or Video) to begin automated analysis.</p>
                                    </div>
                                    <div className="flex gap-2">
                                        {["JPG", "PNG", "WEBP"].map(type => (
                                            <span key={type} className="px-2 py-1 bg-slate-900 border border-slate-800 rounded text-[10px] text-slate-500 font-mono">{type}</span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>

                    <div className="bg-[#161b22] border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-[60px] group-hover:bg-blue-500/20 transition-all rounded-full -mr-16 -mt-16"></div>

                        <div className="flex items-center gap-3 mb-6">
                            <Database className="w-5 h-5 text-indigo-400" />
                            <h3 className="font-bold text-slate-200 tracking-tight">System Status</h3>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-slate-500 flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]"></span>
                                    Gpu Instance
                                </span>
                                <span className="font-mono text-xs text-white">YOLO-V8.4-CONNECTED</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-slate-500">Latency</span>
                                <span className="font-mono text-xs text-slate-300">~240ms</span>
                            </div>
                            {(result?.gps?.available || videoData || isLiveMode) && (
                                <>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-slate-500 flex items-center gap-2">
                                            <MapPin className="w-3 h-3 text-red-400" />
                                            Latitude
                                        </span>
                                        <span className="font-mono text-xs text-white">
                                            {(videoData || isLiveMode) ? liveStats.lat.toFixed(6) : result?.gps?.lat?.toFixed(6)}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-slate-500 flex items-center gap-2">
                                            <MapPin className="w-3 h-3 text-blue-400" />
                                            Longitude
                                        </span>
                                        <span className="font-mono text-xs text-white">
                                            {(videoData || isLiveMode) ? liveStats.lon.toFixed(6) : result?.gps?.lon?.toFixed(6)}
                                        </span>
                                    </div>
                                    {(videoData || isLiveMode) && (
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-slate-500 flex items-center gap-2">
                                                <Brain className="w-3 h-3 text-purple-400" />
                                                Live Detections
                                            </span>
                                            <span className="font-mono text-xs text-white">{liveStats.detections}</span>
                                        </div>
                                    )}
                                </>
                            )}
                            {result?.isSnapshot && (
                                <div className="mt-4 pt-4 border-t border-slate-800">
                                    <p className="text-[10px] text-blue-400 uppercase font-bold mb-2 tracking-widest">Latest Auto-Snapshot</p>
                                    <div className="relative rounded-xl overflow-hidden border border-blue-500/30 bg-black shadow-[0_0_15px_rgba(59,130,246,0.1)]">
                                        <img
                                            src={`http://${window.location.hostname === 'localhost' ? 'localhost' : window.location.hostname}:8000/snaps/${result.image_name}`}
                                            alt="Latest Snapshot"
                                            className="w-full h-auto object-cover aspect-video"
                                        />
                                        <div className="absolute top-2 right-2 px-2 py-0.5 bg-blue-600 rounded text-[8px] font-bold text-white uppercase animate-pulse">New Detection</div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-7 flex flex-col h-full bg-[#161b22] rounded-2xl border border-slate-800 shadow-2xl overflow-hidden">
                    <div className="h-12 bg-[#0d1117]/80 flex items-center justify-between px-4 border-b border-slate-800/80">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                            <div className="w-3 h-3 rounded-full bg-amber-500/80"></div>
                            <div className="w-3 h-3 rounded-full bg-emerald-500/80"></div>
                            <div className="ml-4 h-8 bg-slate-800/40 rounded-t-lg px-4 flex items-center gap-2 border-x border-t border-slate-700/50">
                                <FileJson className="w-3 h-3 text-amber-500" />
                                <span className="text-xs text-slate-300 font-mono">prediction_results.json</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 text-slate-500">
                            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                <span className="text-[10px] text-blue-400 font-bold uppercase tracking-tighter">Live Output</span>
                            </div>
                            <Terminal className="w-4 h-4" />
                        </div>
                    </div>

                    <div className="flex-1 relative">
                        <Editor
                            height="100%"
                            defaultLanguage="json"
                            theme="vs-dark"
                            value={result ? JSON.stringify(result, null, 2) : "// Waiting for neural analysis input...\n// Results will appear here in real-time."}
                            options={{
                                minimap: { enabled: false },
                                fontSize: 14,
                                fontFamily: "var(--font-geist-mono), ui-mono, monospace",
                                lineNumbers: "on",
                                padding: { top: 20 },
                                readOnly: true,
                                scrollBeyondLastLine: false
                            }}
                        />
                    </div>

                    <div className="h-8 bg-[#0d1117] border-t border-slate-800/80 px-4 flex items-center justify-between text-[11px] font-mono text-slate-500">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1">
                                <Code2 className="w-3 h-3" />
                                <span>JSON</span>
                            </div>
                            <span>UTF-8</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <span>Ln 1, Col 1</span>
                            <span>Space: 2</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
