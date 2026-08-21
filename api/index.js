/**
 * api/index.js - Vercel Serverless Function
 * @version 2.9.0
 */

const https = require('https');
const http = require('http');
const url = require('url');

// 🔥 APPS SCRIPT URL - PAKAI YANG BARU DARI CONFIG
const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbyi-CMq3E2f1-99UA8kRoD7YobdoflwJEE-ZjksAKnhcZ62x0q21TjiDytxfFUvr0mC/exec';

// ============================================================
// HELPER: FETCH REQUEST
// ============================================================

function fetchRequest(targetUrl, options = {}) {
    return new Promise((resolve, reject) => {
        const parsedUrl = url.parse(targetUrl);
        const isHttps = parsedUrl.protocol === 'https:';
        const httpModule = isHttps ? https : http;

        const requestOptions = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || (isHttps ? 443 : 80),
            path: parsedUrl.path || '/',
            method: options.method || 'GET',
            headers: options.headers || {}
        };

        const req = httpModule.request(requestOptions, (response) => {
            let data = '';

            response.on('data', (chunk) => {
                data += chunk;
            });

            response.on('end', () => {
                resolve({
                    status: response.statusCode,
                    headers: response.headers,
                    data: data
                });
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        if (options.body) {
            req.write(options.body);
        }

        req.end();
    });
}

// ============================================================
// VERCELL SERVERLESS HANDLER
// ============================================================

module.exports = async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Max-Age', '3600');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const path = req.url || '/';
    console.log(`[${new Date().toISOString()}] ${req.method} ${path}`);

    try {
        // ROOT
        if (path === '/' || path === '') {
            res.status(200).json({
                success: true,
                message: 'DepsStore API v2',
                version: '2.9.0',
                endpoints: {
                    health: '/api/v2/system/health',
                    products: '/api/v2/products',
                    stats: '/api/v2/stats',
                    support: '/api/v2/support',
                    login: '/api/v2/auth/login'
                },
                timestamp: new Date().toISOString()
            });
            return;
        }

        // HEALTH
        if (path === '/health' || path === '/api/v2/system/health') {
            res.status(200).json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                version: '2.9.0',
                environment: 'production'
            });
            return;
        }

        // 🔥 STATS - Proxy ke Apps Script
        if (path === '/api/v2/stats') {
            const targetUrl = APPS_SCRIPT_URL + '?action=getStats';
            console.log(`  → Fetching stats: ${targetUrl}`);

            const response = await fetchRequest(targetUrl);
            
            try {
                const jsonData = JSON.parse(response.data);
                res.status(200).json(jsonData);
            } catch (e) {
                res.status(200).json({
                    success: true,
                    data: {
                        products: 0,
                        customers: 0,
                        users: 0,
                        timestamp: new Date().toISOString()
                    }
                });
            }
            return;
        }

        // 🔥 PRODUCTS - Proxy ke Apps Script
        if (path.startsWith('/api/v2/products')) {
            const queryString = path.includes('?') ? path.split('?')[1] : '';
            const targetUrl = APPS_SCRIPT_URL + '?action=getProducts' + (queryString ? '&' + queryString : '');
            console.log(`  → Fetching products: ${targetUrl}`);

            const response = await fetchRequest(targetUrl);

            try {
                const jsonData = JSON.parse(response.data);
                res.status(200).json(jsonData);
            } catch (e) {
                res.status(200).json({
                    success: true,
                    items: [],
                    total: 0,
                    timestamp: new Date().toISOString()
                });
            }
            return;
        }

        // 🔥 SUPPORT - Proxy ke Apps Script (POST)
        if (path === '/api/v2/support') {
            let body = '';
            if (req.method === 'POST') {
                req.on('data', (chunk) => { body += chunk; });
                await new Promise((resolve) => req.on('end', resolve));
            }

            const targetUrl = APPS_SCRIPT_URL + '?action=createSupport';
            console.log(`  → Proxying support to: ${targetUrl}`);
            console.log(`  → Body: ${body}`);

            const response = await fetchRequest(targetUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: body
            });

            try {
                const jsonData = JSON.parse(response.data);
                res.status(200).json(jsonData);
            } catch (e) {
                res.status(200).json({
                    success: true,
                    message: 'Pengaduan berhasil dikirim',
                    data: { id: 'SUP-' + Date.now(), status: 'new' }
                });
            }
            return;
        }

        // 🔥 AUTH - Proxy ke Apps Script
        if (path.startsWith('/api/v2/auth/')) {
            const targetUrl = APPS_SCRIPT_URL + path;
            console.log(`  → Proxying auth to: ${targetUrl}`);

            let body = '';
            if (req.method === 'POST' || req.method === 'PUT') {
                req.on('data', (chunk) => { body += chunk; });
                await new Promise((resolve) => req.on('end', resolve));
            }

            const headers = {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            };

            if (req.headers.authorization) {
                headers['Authorization'] = req.headers.authorization;
            }

            const response = await fetchRequest(targetUrl, {
                method: req.method,
                headers: headers,
                body: body
            });

            try {
                const jsonData = JSON.parse(response.data);
                res.status(response.status || 200).json(jsonData);
            } catch (e) {
                res.status(500).json({
                    success: false,
                    error: 'Invalid response from Apps Script'
                });
            }
            return;
        }

        // API V2 ROOT
        if (path === '/api/v2' || path === '/api/v2/') {
            res.status(200).json({
                success: true,
                message: 'DepsStore API v2',
                version: '2.9.0',
                endpoints: {
                    health: '/api/v2/system/health',
                    products: '/api/v2/products',
                    stats: '/api/v2/stats',
                    support: '/api/v2/support',
                    login: '/api/v2/auth/login'
                },
                timestamp: new Date().toISOString()
            });
            return;
        }

        // 404
        res.status(404).json({
            success: false,
            error: 'Endpoint not found',
            path: path,
            method: req.method
        });

    } catch (error) {
        console.error('❌ Error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message
        });
    }
};