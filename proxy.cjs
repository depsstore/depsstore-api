/**
 * proxy.cjs - CORS Proxy untuk Apps Script
 * Jalankan: node proxy.cjs
 */

const http = require('http');
const https = require('https');
const url = require('url');

// 🔥 GANTI DENGAN URL APPS SCRIPT YANG BARU
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyi-CMq3E2f1-99UA8kRoD7YobdoflwJEE-ZjksAKnhcZ62x0q21TjiDytxfFUvr0mC/exec';
const PORT = 3000;

const server = http.createServer((req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Max-Age', '3600');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    console.log('[' + new Date().toISOString() + '] ' + req.method + ' ' + req.url);

    // ROOT
    if (req.url === '/' || req.url === '') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: true,
            message: 'DepsStore API Proxy',
            version: '2.9.0',
            endpoints: {
                health: '/api/v2/system/health',
                products: '/api/v2/products',
                stats: '/api/v2/stats',
                support: '/api/v2/support',
                login: '/api/v2/auth/login'
            }
        }));
        return;
    }

    // HEALTH
    if (req.url === '/health' || req.url === '/api/v2/system/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            version: '2.9.0'
        }));
        return;
    }

    // 🔥 PRODUCTS
    if (req.url.startsWith('/api/v2/products')) {
        const queryString = req.url.includes('?') ? req.url.split('?')[1] : '';
        const targetUrl = APPS_SCRIPT_URL + '?action=getProducts' + (queryString ? '&' + queryString : '');
        console.log('  → Proxying products to: ' + targetUrl);

        const parsedUrl = url.parse(targetUrl);
        const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || 443,
            path: parsedUrl.path,
            method: req.method,
            headers: { 'Accept': 'application/json' }
        };

        const proxyReq = https.request(options, (proxyRes) => {
            let data = '';
            proxyRes.on('data', (chunk) => { data += chunk; });
            proxyRes.on('end', () => {
                res.writeHead(proxyRes.statusCode, {
                    'Content-Type': 'application/json'
                });
                res.end(data);
            });
        });

        proxyReq.on('error', (err) => {
            console.error('  ❌ Proxy error:', err.message);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                error: 'Proxy error: ' + err.message
            }));
        });

        proxyReq.end();
        return;
    }

    // 🔥 STATS
    if (req.url === '/api/v2/stats') {
        const targetUrl = APPS_SCRIPT_URL + '?action=getStats';
        console.log('  → Proxying stats to: ' + targetUrl);

        const parsedUrl = url.parse(targetUrl);
        const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || 443,
            path: parsedUrl.path,
            method: req.method,
            headers: { 'Accept': 'application/json' }
        };

        const proxyReq = https.request(options, (proxyRes) => {
            let data = '';
            proxyRes.on('data', (chunk) => { data += chunk; });
            proxyRes.on('end', () => {
                res.writeHead(proxyRes.statusCode, {
                    'Content-Type': 'application/json'
                });
                res.end(data);
            });
        });

        proxyReq.on('error', (err) => {
            console.error('  ❌ Proxy error:', err.message);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                error: 'Proxy error: ' + err.message
            }));
        });

        proxyReq.end();
        return;
    }

    // 🔥 SUPPORT
    if (req.url === '/api/v2/support' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => { body += chunk; });
        req.on('end', () => {
            const targetUrl = APPS_SCRIPT_URL + '?action=createSupport';
            console.log('  → Proxying support to: ' + targetUrl);

            const parsedUrl = url.parse(targetUrl);
            const options = {
                hostname: parsedUrl.hostname,
                port: parsedUrl.port || 443,
                path: parsedUrl.path,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(body)
                }
            };

            const proxyReq = https.request(options, (proxyRes) => {
                let data = '';
                proxyRes.on('data', (chunk) => { data += chunk; });
                proxyRes.on('end', () => {
                    res.writeHead(proxyRes.statusCode, {
                        'Content-Type': 'application/json'
                    });
                    res.end(data);
                });
            });

            proxyReq.on('error', (err) => {
                console.error('  ❌ Proxy error:', err.message);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    error: 'Proxy error: ' + err.message
                }));
            });

            proxyReq.write(body);
            proxyReq.end();
        });
        return;
    }

    // API V2 ROOT
    if (req.url === '/api/v2' || req.url === '/api/v2/') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
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
        }));
        return;
    }

    // 404
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
        success: false,
        error: 'Endpoint not found',
        path: req.url,
        method: req.method
    }));
});

server.listen(PORT, () => {
    console.log('==============================');
    console.log('🔄 CORS Proxy siap!');
    console.log('==============================');
    console.log('Port    : ' + PORT);
    console.log('Target  : ' + APPS_SCRIPT_URL);
    console.log('');
    console.log('📌 Products: http://localhost:' + PORT + '/api/v2/products');
    console.log('📌 Stats   : http://localhost:' + PORT + '/api/v2/stats');
    console.log('📌 Support : http://localhost:' + PORT + '/api/v2/support');
    console.log('==============================');
});