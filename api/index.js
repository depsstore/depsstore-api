// api/index.js - Vercel Serverless Function
const express = require('express');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// ============================================================
// HEALTH CHECK
// ============================================================
app.get('/api/v2/system/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '2.9.0',
        environment: 'production'
    });
});

// ============================================================
// ROOT
// ============================================================
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'DepsStore API v2',
        version: '2.9.0',
        endpoints: {
            health: '/api/v2/system/health',
            products: '/api/v2/products',
            orders: '/api/v2/orders',
            customers: '/api/v2/customers',
            auth: '/api/v2/auth/login',
            support: '/api/v2/support',
            dashboard: '/api/v2/dashboard'
        },
        timestamp: new Date().toISOString()
    });
});

// ============================================================
// 🔥 PROXY KE APPS SCRIPT
// ============================================================
const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbyi-CMq3E2f1-99UA8kRoD7YobdoflwJEE-ZjksAKnhcZ62x0q21TjiDytxfFUvr0mC/exec';

// Helper function untuk proxy request
async function proxyRequest(targetUrl, method, body, headers) {
    const fetch = require('node-fetch');
    
    const options = {
        method: method || 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...headers
        }
    };

    if (body && (method === 'POST' || method === 'PUT')) {
        options.body = JSON.stringify(body);
    }

    const response = await fetch(targetUrl, options);
    const data = await response.json();
    
    return {
        status: response.status,
        data: data
    };
}

// ============================================================
// PRODUCTS
// ============================================================
app.get('/api/v2/products', async (req, res) => {
    try {
        const queryString = new URLSearchParams(req.query).toString();
        const targetUrl = `${APPS_SCRIPT_URL}?action=getProducts${queryString ? '&' + queryString : ''}`;
        
        const result = await proxyRequest(targetUrl);
        res.status(result.status).json(result.data);
    } catch (error) {
        console.error('Products error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.get('/api/v2/products/:id', async (req, res) => {
    try {
        const targetUrl = `${APPS_SCRIPT_URL}?action=getProduct&id=${req.params.id}`;
        const result = await proxyRequest(targetUrl);
        res.status(result.status).json(result.data);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// ORDERS
// ============================================================
app.get('/api/v2/orders', async (req, res) => {
    try {
        const queryString = new URLSearchParams(req.query).toString();
        const targetUrl = `${APPS_SCRIPT_URL}?action=getOrders${queryString ? '&' + queryString : ''}`;
        const result = await proxyRequest(targetUrl);
        res.status(result.status).json(result.data);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// CUSTOMERS
// ============================================================
app.get('/api/v2/customers', async (req, res) => {
    try {
        const queryString = new URLSearchParams(req.query).toString();
        const targetUrl = `${APPS_SCRIPT_URL}?action=getCustomers${queryString ? '&' + queryString : ''}`;
        const result = await proxyRequest(targetUrl);
        res.status(result.status).json(result.data);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// AUTH - LOGIN
// ============================================================
app.post('/api/v2/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Email and password are required'
            });
        }

        const targetUrl = `${APPS_SCRIPT_URL}?action=login`;
        const result = await proxyRequest(targetUrl, 'POST', { email, password });
        res.status(result.status).json(result.data);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// SUPPORT
// ============================================================
app.post('/api/v2/support', async (req, res) => {
    try {
        const targetUrl = `${APPS_SCRIPT_URL}?action=createSupport`;
        const result = await proxyRequest(targetUrl, 'POST', req.body);
        res.status(result.status).json(result.data);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// 404 HANDLER
// ============================================================
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        path: req.path,
        method: req.method
    });
});

// ============================================================
// ERROR HANDLER
// ============================================================
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        success: false,
        error: err.message || 'Internal server error'
    });
});

// ============================================================
// EXPORT UNTUK VERCELL
// ============================================================
module.exports = app;
