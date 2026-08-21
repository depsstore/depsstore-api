/**
 * main.js - BACKEND LOCAL ENTRY POINT
 * @version 2.9.0
 */

import { config } from './server/config.js';
import { router } from './server/routes.js';
import { logger } from './server/utils.js';
import { middleware } from './server/middleware.js';
import http from 'http';
import url from 'url';

// ============================================================
// HTTP SERVER
// ============================================================

var server = http.createServer(async function(req, res) {
    var parsedUrl = url.parse(req.url, true);
    var path = parsedUrl.pathname;
    var method = req.method;

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '3600');

    // Handle preflight
    if (method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // Health check
    if (path === '/health' || path === '/api/v2/system/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            version: '2.9.0',
            environment: config.env
        }));
        return;
    }

    // 🔥 TAMBAHKAN: Root API v2
    if (path === '/api/v2' || path === '/api/v2/') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: true,
            message: 'DepsStore API v2',
            version: '2.9.0',
            endpoints: {
                health: '/api/v2/system/health',
                login: '/api/v2/auth/login',
                register: '/api/v2/auth/register',
                products: '/api/v2/products',
                orders: '/api/v2/orders',
                customers: '/api/v2/customers',
                users: '/api/v2/users',
                support: '/api/v2/support',
                dashboard: '/api/v2/dashboard',
                backups: '/api/v2/backups',
                logs: '/api/v2/logs'
            },
            timestamp: new Date().toISOString()
        }));
        return;
    }

    // Root
    if (path === '/') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            message: 'DepsStore Backend API',
            version: '2.9.0',
            endpoints: {
                health: '/health',
                products: '/api/v2/products',
                login: '/api/v2/auth/login'
            }
        }));
        return;
    }

    // Parse body untuk POST/PUT
    var body = '';
    req.on('data', function(chunk) {
        body += chunk;
    });

    req.on('end', async function() {
        try {
            // Build request object
            var requestObj = {
                method: method,
                path: path,
                url: req.url,
                query: parsedUrl.query,
                body: body ? JSON.parse(body) : {},
                headers: req.headers,
                params: {},
                ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1'
            };

            // Build response object
            var responseObj = {
                statusCode: 200,
                headers: {},
                body: null,

                status: function(code) {
                    this.statusCode = code;
                    return this;
                },

                json: function(data) {
                    this.headers['Content-Type'] = 'application/json';
                    this.body = JSON.stringify(data);
                    return this;
                },

                send: function(data) {
                    this.body = data;
                    return this;
                },

                setHeader: function(key, value) {
                    this.headers[key] = value;
                    return this;
                }
            };

            logger.debug('Request: ' + method + ' ' + path);

            // Apply middleware
            middleware.cors(requestObj, responseObj, function() {});
            middleware.logging(requestObj, responseObj, function() {});

            // Handle route
            try {
                await router.handle(requestObj, responseObj);
            } catch (routeError) {
                logger.error('Route handler error:', routeError);
                responseObj.status(500).json({
                    success: false,
                    error: 'Route handler error',
                    message: config.env === 'development' ? routeError.message : undefined
                });
            }

            // Send response
            res.writeHead(responseObj.statusCode, responseObj.headers);
            res.end(responseObj.body || '');

        } catch (error) {
            logger.error('Server error:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                error: 'Internal server error',
                message: config.env === 'development' ? error.message : undefined
            }));
        }
    });
});

// ============================================================
// START SERVER
// ============================================================

var PORT = config.port || 3000;

// Inisialisasi router
router.init();

server.on('error', function(err) {
    if (err.code === 'EADDRINUSE') {
        logger.error('Port ' + PORT + ' sudah digunakan!');
        logger.info('Coba hentikan proses lain atau gunakan port berbeda');
        logger.info('Untuk menghentikan: taskkill /F /IM node.exe');
        process.exit(1);
    } else {
        logger.error('Server error:', err);
    }
});

server.listen(PORT, function() {
    logger.success('DepsStore Backend running on http://localhost:' + PORT);
    logger.info('Apps Script URL: ' + config.appsScriptUrl);
    logger.info('Environment: ' + config.env);
    logger.info('Routes registered: ' + router.routes.length);
});