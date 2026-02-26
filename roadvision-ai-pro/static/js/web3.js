/* ============================================================
   web3.js — Web3 Wallet Service  (v2)

   OPTIONAL hackathon demo module — can be deleted without
   breaking the core AI pipeline (app.js, renderer.js, api.js).

   Standalone MetaMask wallet integration for RoadVision AI Pro.
   Uses ethers v6 UMD global (window.ethers) loaded from CDN.
   No imports, no bundler — pure browser-safe vanilla JS.

   Exposed API  (window.Web3Service):
     connectWallet()      → { address, shortAddress, network }
     getAddress()         → wallet address string or null
     getWallet()          → alias for getAddress()
     isConnected()        → boolean
     disconnect()         → void
     hashScanResult(data) → SHA-256 hex string
     verifyReport(data)   → { txHash, dataHash, verified, mode … }
     verifyOnChain(data)  → alias for verifyReport()
     isMetaMaskAvailable()→ boolean

   Removal checklist:
     1. Delete this file
     2. Remove <script> tag from index.html
     3. Remove ethers.js CDN <script> from <head>
     4. Remove wallet button HTML (#connectWalletBtn)
     5. Remove #blockchain-badge HTML block
     Core app continues to work — all references are guarded
     with `typeof Web3Service === 'undefined'` checks.
   ============================================================ */

(function () {
    'use strict';

    /* ─── State ───────────────────────────────────────────── */
    const STORAGE_KEY = 'rv_wallet_address';
    const STORAGE_NET = 'rv_wallet_network';

    let _provider = null;
    let _signer   = null;
    let _address  = null;
    let _network  = null;

    /* ─── Utility: shorten address 0x12ab…89ef ────────────── */
    function shortenAddress(addr) {
        if (!addr || addr.length < 10) return addr || '';
        return addr.slice(0, 6) + '…' + addr.slice(-4);
    }

    /* ─── Utility: SHA-256 hash (Web Crypto API) ──────────── */
    async function sha256(message) {
        const encoder = new TextEncoder();
        const data = encoder.encode(message);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    /* ─── Utility: generate fake tx hash (demo-safe) ──────── */
    function generateTxHash() {
        const bytes = new Uint8Array(32);
        crypto.getRandomValues(bytes);
        return '0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    /* ─── Check MetaMask availability ─────────────────────── */
    function isMetaMaskAvailable() {
        return typeof window.ethereum !== 'undefined' && window.ethereum.isMetaMask;
    }

    /* ─── Restore session from localStorage ───────────────── */
    function restoreSession() {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved && isMetaMaskAvailable()) {
            _address = saved;
            _network = localStorage.getItem(STORAGE_NET) || 'unknown';
            console.log('[Web3] Restored session:', shortenAddress(_address));
            _dispatchEvent('walletRestored', { address: _address });
            /* Silently re-init provider (no popup) */
            _initProviderQuiet();
        }
    }

    /* ─── Quietly init provider without requesting accounts ── */
    async function _initProviderQuiet() {
        try {
            if (!isMetaMaskAvailable() || typeof ethers === 'undefined') return;
            _provider = new ethers.BrowserProvider(window.ethereum);
            const net = await _provider.getNetwork();
            _network = net.name || 'chain-' + net.chainId;
        } catch (e) {
            console.warn('[Web3] Quiet init failed:', e.message);
        }
    }

    /* ─── Dispatch custom event for UI updates ────────────── */
    function _dispatchEvent(name, detail) {
        window.dispatchEvent(new CustomEvent('web3:' + name, { detail }));
    }

    /* ─── Listen for account/chain changes ────────────────── */
    function _setupListeners() {
        if (!window.ethereum) return;

        window.ethereum.on('accountsChanged', (accounts) => {
            if (accounts.length === 0) {
                _disconnect();
                _dispatchEvent('disconnected', {});
            } else {
                _address = accounts[0];
                localStorage.setItem(STORAGE_KEY, _address);
                console.log('[Web3] Account changed:', shortenAddress(_address));
                _dispatchEvent('accountChanged', { address: _address });
            }
        });

        window.ethereum.on('chainChanged', () => {
            console.log('[Web3] Chain changed — refreshing provider');
            _initProviderQuiet();
            _dispatchEvent('chainChanged', {});
        });
    }

    /* ─── Connect Wallet ──────────────────────────────────── */
    async function connectWallet() {
        /* Check ethers loaded */
        if (typeof ethers === 'undefined') {
            console.error('[Web3] ethers.js not loaded');
            throw new Error('Web3 library not loaded. Please refresh the page.');
        }

        /* Check MetaMask */
        if (!isMetaMaskAvailable()) {
            console.warn('[Web3] MetaMask not detected');
            throw new Error('MetaMask not detected. Please install the MetaMask extension.');
        }

        try {
            _provider = new ethers.BrowserProvider(window.ethereum);

            /* Request account access (triggers MetaMask popup) */
            const accounts = await _provider.send('eth_requestAccounts', []);
            _signer = await _provider.getSigner();
            _address = await _signer.getAddress();

            /* Get network info */
            const net = await _provider.getNetwork();
            _network = net.name || 'chain-' + net.chainId;

            /* Persist */
            localStorage.setItem(STORAGE_KEY, _address);
            localStorage.setItem(STORAGE_NET, _network);

            console.log('[Web3] Connected:', _address, '| Network:', _network);
            _dispatchEvent('connected', { address: _address, network: _network });

            return {
                address: _address,
                shortAddress: shortenAddress(_address),
                network: _network
            };
        } catch (err) {
            if (err.code === 4001) {
                throw new Error('Connection rejected by user.');
            }
            console.error('[Web3] Connect failed:', err);
            throw new Error('Failed to connect wallet: ' + (err.message || 'Unknown error'));
        }
    }

    /* ─── Disconnect ──────────────────────────────────────── */
    function _disconnect() {
        _address = null;
        _signer = null;
        _network = null;
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(STORAGE_NET);
        console.log('[Web3] Disconnected');
    }

    function disconnect() {
        _disconnect();
        _dispatchEvent('disconnected', {});
    }

    /* ─── Getters ─────────────────────────────────────────── */
    function getWallet() {
        return _address;
    }

    function isConnected() {
        return !!_address;
    }

    function getShortAddress() {
        return shortenAddress(_address);
    }

    function getNetwork() {
        return _network;
    }

    /* ============================================================
       BLOCKCHAIN VERIFICATION FOR AI SCANS
       ============================================================ */

    /**
     * Hash scan result data into a SHA-256 digest.
     * @param {Object} scanData - { imageName, severity, confidence, detectionCount }
     * @returns {Promise<string>} hex hash
     */
    async function hashScanResult(scanData) {
        const payload = JSON.stringify({
            image:      scanData.imageName || 'unknown',
            severity:   scanData.severity || 0,
            confidence: scanData.confidence || 0,
            detections: scanData.detectionCount || 0,
            timestamp:  Date.now(),
            wallet:     _address || 'anonymous'
        });
        return await sha256(payload);
    }

    /**
     * Verify a scan result on-chain (or simulate in demo mode).
     * 
     * If wallet is connected:
     *   - Generates SHA-256 hash of scan data
     *   - Simulates an on-chain tx (generates realistic tx hash)
     *   - In production, this would call a smart contract
     * 
     * If wallet not connected:
     *   - Returns off-chain status with local hash
     * 
     * @param {Object} scanData - { imageName, severity, confidence, detectionCount }
     * @returns {Promise<Object>} { verified, txHash, dataHash, chain, timestamp, mode }
     */
    async function verifyOnChain(scanData) {
        const dataHash = await hashScanResult(scanData);
        const timestamp = new Date().toISOString();

        if (_address) {
            /* Wallet connected — simulate blockchain verification */
            /* In production: call contract.verifyReport(dataHash) */
            const txHash = generateTxHash();

            console.log('[Web3] On-chain verification:', {
                dataHash: dataHash.slice(0, 16) + '…',
                txHash: txHash.slice(0, 16) + '…',
                wallet: shortenAddress(_address)
            });

            return {
                verified:  true,
                txHash:    txHash,
                dataHash:  dataHash,
                chain:     _network || 'ethereum',
                wallet:    _address,
                timestamp: timestamp,
                mode:      'on-chain'
            };
        } else {
            /* No wallet — off-chain report */
            console.log('[Web3] Off-chain report (no wallet):', dataHash.slice(0, 16) + '…');

            return {
                verified:  false,
                txHash:    null,
                dataHash:  dataHash,
                chain:     null,
                wallet:    null,
                timestamp: timestamp,
                mode:      'off-chain'
            };
        }
    }

    /* ─── Lazy Init: defer listener setup + session restore
       until DOM is ready so we never run during hero animations
       or Three.js init (STEP 5 compliance) ─────────────────── */
    function _boot() {
        _setupListeners();
        restoreSession();
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _boot);
    } else {
        /* Script loaded after DOMContentLoaded already fired */
        _boot();
    }

    /* ─── Expose global API ───────────────────────────────── */
    window.Web3Service = {
        connectWallet:       connectWallet,
        disconnect:          disconnect,
        getWallet:           getWallet,
        getAddress:          getWallet,        /* spec alias */
        getShortAddress:     getShortAddress,
        getNetwork:          getNetwork,
        isConnected:         isConnected,
        isMetaMaskAvailable: isMetaMaskAvailable,
        hashScanResult:      hashScanResult,
        verifyReport:        verifyOnChain,    /* spec alias */
        verifyOnChain:       verifyOnChain,
        shortenAddress:      shortenAddress
    };

    console.log('%c⛓️ Web3Service v2 ready', 'color:#00F0FF;font-weight:bold');

})();
