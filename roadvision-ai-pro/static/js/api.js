/**
 * RoadVision AI Pro - API Client
 * REST API and WebSocket communication
 */

class APIClient {
    constructor() {
        this.baseURL = window.location.origin.includes('localhost') 
            ? 'http://localhost:8000' 
            : '';
        this.token = localStorage.getItem('token');
        this.ws = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
    }
    
    // HTTP Headers
    getHeaders() {
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }
        
        return headers;
    }
    
    // Health Check
    async healthCheck() {
        try {
            const response = await fetch(`${this.baseURL}/health`);
            return await response.json();
        } catch (error) {
            console.error('Health check failed:', error);
            return { status: 'error', model_loaded: false };
        }
    }
    
    // Get Metrics
    async getMetrics() {
        try {
            const response = await fetch(`${this.baseURL}/metrics`);
            return await response.json();
        } catch (error) {
            console.error('Metrics fetch failed:', error);
            return null;
        }
    }
    
    // Predict
    async predict(file, browserLat = null, browserLon = null) {
        const formData = new FormData();
        formData.append('file', file);
        if (browserLat != null && browserLon != null) {
            formData.append('browser_lat', browserLat);
            formData.append('browser_lon', browserLon);
        }
        
        const headers = {};
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }
        
        const response = await fetch(`${this.baseURL}/predict`, {
            method: 'POST',
            headers: headers,
            body: formData
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Prediction failed');
        }
        
        return await response.json();
    }
    
    // Authentication
    async login(email, password) {
        const formData = new URLSearchParams();
        formData.append('username', email);
        formData.append('password', password);
        
        const response = await fetch(`${this.baseURL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: formData
        });
        
        if (!response.ok) {
            throw new Error('Login failed');
        }
        
        const data = await response.json();
        this.token = data.access_token;
        localStorage.setItem('token', this.token);
        
        return data;
    }
    
    async register(email, password, fullName) {
        const response = await fetch(`${this.baseURL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, full_name: fullName })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Registration failed');
        }
        
        return await response.json();
    }
    
    async getMe() {
        const response = await fetch(`${this.baseURL}/auth/me`, {
            headers: this.getHeaders()
        });
        
        if (!response.ok) {
            throw new Error('Failed to get user info');
        }
        
        return await response.json();
    }
    
    logout() {
        this.token = null;
        localStorage.removeItem('token');
    }
    
    // Admin Endpoints
    async getAdminStats() {
        const response = await fetch(`${this.baseURL}/admin/stats`, {
            headers: this.getHeaders()
        });
        
        if (!response.ok) {
            throw new Error('Failed to get admin stats');
        }
        
        return await response.json();
    }
    
    async getAdminUsers() {
        const response = await fetch(`${this.baseURL}/admin/users`, {
            headers: this.getHeaders()
        });
        
        if (!response.ok) {
            throw new Error('Failed to get users');
        }
        
        return await response.json();
    }
    
    // =========================================================================
    // Video / Camera / Analyze Endpoints
    // =========================================================================
    
    /**
     * Analyze image via /analyze — returns GPS + per-class predictions.
     */
    async analyze(file) {
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await fetch(`${this.baseURL}/analyze`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Analysis failed');
        }
        
        return await response.json();
    }
    
    /**
     * Upload video for streaming analysis. Returns { video_id, path }.
     */
    async analyzeVideo(file) {
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await fetch(`${this.baseURL}/analyze_video`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Video upload failed');
        }
        
        return await response.json();
    }
    
    /**
     * Get the MJPEG streaming URL for a processed video.
     */
    getVideoFeedUrl(videoId, videoPath) {
        return `${this.baseURL}/video_feed/${videoId}?path=${encodeURIComponent(videoPath)}`;
    }
    
    /**
     * Get the MJPEG streaming URL for live camera feed.
     */
    getCameraFeedUrl(cameraIndex = 0) {
        return `${this.baseURL}/camera_feed?index=${cameraIndex}`;
    }
    
    /**
     * Get current video processing stats (GPS position, detections, snapshots).
     */
    async getVideoStats() {
        try {
            const response = await fetch(`${this.baseURL}/video_stats`);
            return await response.json();
        } catch (error) {
            console.error('Video stats fetch failed:', error);
            return null;
        }
    }
    
    // WebSocket
    connectWebSocket() {
        const wsUrl = this.baseURL.replace('http', 'ws') + '/ws/metrics';
        
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            console.log('WebSocket connected');
            this.reconnectAttempts = 0;
        };
        
        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.handleWebSocketMessage(data);
        };
        
        this.ws.onclose = () => {
            console.log('WebSocket disconnected');
            this.attemptReconnect();
        };
        
        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
    }
    
    attemptReconnect() {
        /* Don't reconnect when tab is hidden — saves network churn */
        if (document.hidden) return;
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = Math.min(3000 * Math.pow(2, this.reconnectAttempts - 1), 30000);
            this._reconnectTimer = setTimeout(() => {
                console.log(`Reconnecting... Attempt ${this.reconnectAttempts}`);
                this.connectWebSocket();
            }, delay);
        }
    }
    
    handleWebSocketMessage(data) {
        // Dispatch custom event for other components
        const event = new CustomEvent('ws-message', { detail: data });
        document.dispatchEvent(event);
        
        // Update HUD if available
        if (window.systemHUD) {
            if (data.total_requests !== undefined) {
                window.systemHUD.updateRequests(data.total_requests);
            }
        }
    }
    
    disconnectWebSocket() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
}

// Initialize API client
document.addEventListener('DOMContentLoaded', () => {
    window.api = new APIClient();
    
    // Connect WebSocket
    window.api.connectWebSocket();
    
    // Disconnect WS when tab hidden, reconnect when visible
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            clearTimeout(window.api._reconnectTimer);
            window.api.disconnectWebSocket();
        } else {
            window.api.reconnectAttempts = 0;
            window.api.connectWebSocket();
        }
    });
    
    // Listen for WebSocket messages
    document.addEventListener('ws-message', (e) => {
        const data = e.detail;
        
        if (data.type === 'inference_complete') {
            // Update UI with latest inference
            console.log('Inference complete:', data.data);
        }
    });
});
