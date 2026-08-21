// api/index.js - Vercel Serverless Function
const express = require('express');
const cors = require('cors');

// Import dari backend Anda
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Import routes dari backend
const routes = require('../src/backend/javascripts/server/routes.js');

// Atau jika Anda punya express app di server.js
// const server = require('../src/backend/server.js');
// module.exports = server;

// ============================================================
// ROUTES - Dari backend Anda
// ============================================================

// Root
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'DepsStore API v2.9.0',
        endpoints: {
            health: '/api/v2/system/health',
            products: '/api/v2/products',
            orders: '/api/v2/orders',
            customers: '/api/v2/customers',
            auth: '/api/v2/auth/login'
        }
    });
});

// Health
app.get('/api/v2/system/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '2.9.0'
    });
});

// 🔥 IMPORT SEMUA ROUTES DARI BACKEND
// Karena routes.js menggunakan format sendiri, kita perlu adaptasi

// Atau langsung gunakan semua route dari routes.js
const { router } = require('../src/backend/javascripts/server/routes.js');

// Untuk setiap route yang terdaftar di router, kita daftarkan ke express
router.routes.forEach(route => {
    const method = route.method.toLowerCase();
    app[method](route.path, async (req, res) => {
        try {
            // Buat object req dan res yang kompatibel
            const requestObj = {
                method: req.method,
                path: req.path,
                url: req.url,
                query: req.query,
                body: req.body,
                headers: req.headers,
                params: req.params
            };

            const responseObj = {
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

            await route.handler(requestObj, responseObj);

            // Kirim response
            if (responseObj.headers['Content-Type'] === 'application/json') {
                res.status(responseObj.statusCode).json(JSON.parse(responseObj.body));
            } else {
                res.status(responseObj.statusCode).send(responseObj.body);
            }
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });
});

// Export untuk Vercel
module.exports = app;
