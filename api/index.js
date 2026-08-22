// api/index.js - Vercel Serverless Function (DENGAN PAYMENT + DEBUG)
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// ============================================================
// 🔥 KONFIGURASI APPS SCRIPT
// ============================================================
const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbyi-CMq3E2f1-99UA8kRoD7YobdoflwJEE-ZjksAKnhcZ62x0q21TjiDytxfFUvr0mC/exec';

// ============================================================
// 🔥 HELPER: PROXY KE APPS SCRIPT
// ============================================================
async function proxyRequest(targetUrl, method, body, headers) {
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

    console.log(`📡 Proxying to: ${targetUrl}`);
    console.log(`📦 Method: ${method}`);
    console.log(`📦 Body:`, body);
    
    try {
        const response = await fetch(targetUrl, options);
        const contentType = response.headers.get('content-type');
        
        console.log(`📊 Response status: ${response.status}`);
        console.log(`📊 Content-Type: ${contentType}`);
        
        let data;
        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
        } else {
            const text = await response.text();
            console.log(`📊 Response text (first 200 chars): ${text.substring(0, 200)}`);
            // Coba parse sebagai JSON
            try {
                data = JSON.parse(text);
            } catch (e) {
                data = { success: false, error: 'Invalid JSON response', raw: text.substring(0, 200) };
            }
        }
        
        console.log(`📊 Response data:`, data);
        
        return {
            status: response.status,
            data: data
        };
    } catch (error) {
        console.error(`❌ Fetch error:`, error);
        return {
            status: 500,
            data: { success: false, error: error.message }
        };
    }
}

// ============================================================
// 🔥 HEALTH CHECK
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
// 🔥 ROOT (dengan daftar endpoint lengkap)
// ============================================================
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'DepsStore API v2',
        version: '2.9.0',
        endpoints: {
            health: '/api/v2/system/health',
            products: '/api/v2/products',
            stats: '/api/v2/stats',
            orders: '/api/v2/orders',
            customers: '/api/v2/customers',
            auth: '/api/v2/auth/login',
            register: '/api/v2/auth/register',
            support: '/api/v2/support',
            dashboard: '/api/v2/dashboard',
            payment: {
                create: '/api/v2/payment/create (POST)',
                status: '/api/v2/payment/status/:id (GET)',
                webhook: '/api/webhook/buatqris (POST)',
                sandbox: '/api/v2/payment/sandbox/complete (POST)'
            }
        },
        timestamp: new Date().toISOString()
    });
});

// ============================================================
// 🔥 PAYMENT - CREATE QRIS (POST) - DENGAN DEBUG
// ============================================================
app.post('/api/v2/payment/create', async (req, res) => {
    console.log('🔥🔥🔥 PAYMENT CREATE ENDPOINT HIT! 🔥🔥🔥');
    console.log('📦 Request body:', req.body);
    
    try {
        const { amount, customer, description, isTest, qrisMethod, feeBy } = req.body;
        
        console.log(`🔍 Amount: ${amount}`);
        console.log(`🔍 Customer:`, customer);
        
        // Validasi
        if (!amount || amount < 1000) {
            console.log('❌ Validation failed: amount < 1000');
            return res.status(400).json({
                success: false,
                error: 'Minimal nominal Rp 1.000'
            });
        }
        
        if (!customer || !customer.name || !customer.email) {
            console.log('❌ Validation failed: customer incomplete');
            return res.status(400).json({
                success: false,
                error: 'Nama dan Email customer wajib diisi'
            });
        }
        
        const targetUrl = `${APPS_SCRIPT_URL}?pathInfo=/api/v2/payment/create`;
        console.log(`  → Creating payment: ${targetUrl}`);
        
        const result = await proxyRequest(
            targetUrl,
            'POST',
            {
                amount: amount,
                customer: customer,
                description: description || 'Order #' + Date.now(),
                isTest: isTest !== undefined ? isTest : true,
                qrisMethod: qrisMethod || 'qris_two',
                feeBy: feeBy || 'user'
            }
        );
        
        console.log(`📊 Result from proxy:`, result);
        
        // 🔥 Jika Apps Script mengembalikan error, tetap kirim response dengan status yang sesuai
        if (result.data && !result.data.success) {
            console.log(`⚠️ Apps Script returned error:`, result.data);
            return res.status(result.status || 400).json(result.data);
        }
        
        res.status(result.status || 200).json(result.data || { success: true });
        
    } catch (error) {
        console.error('❌ Payment create error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// ============================================================
// 🔥 PAYMENT - CHECK STATUS (GET)
// ============================================================
app.get('/api/v2/payment/status/:transactionId', async (req, res) => {
    console.log(`🔍 PAYMENT STATUS CHECK: ${req.params.transactionId}`);
    try {
        const { transactionId } = req.params;
        
        if (!transactionId) {
            return res.status(400).json({
                success: false,
                error: 'Transaction ID is required'
            });
        }
        
        const targetUrl = `${APPS_SCRIPT_URL}?pathInfo=/api/v2/payment/status/${transactionId}`;
        console.log(`  → Checking status: ${targetUrl}`);
        
        const result = await proxyRequest(targetUrl, 'GET');
        res.status(result.status).json(result.data);
        
    } catch (error) {
        console.error('❌ Payment status error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ============================================================
// 🔥 PAYMENT - WEBHOOK (POST)
// ============================================================
app.post('/api/webhook/buatqris', async (req, res) => {
    console.log(`📩 WEBHOOK RECEIVED`);
    try {
        const data = req.body;
        const event = data.event || '';
        const transactionId = data.transaction_id || '';
        
        console.log(`📩 Webhook: ${event} | TX: ${transactionId}`);
        
        if (!transactionId) {
            return res.status(400).json({
                success: false,
                error: 'transaction_id is required'
            });
        }
        
        const targetUrl = `${APPS_SCRIPT_URL}?pathInfo=/api/webhook/buatqris`;
        console.log(`  → Forwarding webhook: ${targetUrl}`);
        
        const result = await proxyRequest(targetUrl, 'POST', data);
        res.status(result.status).json(result.data);
        
    } catch (error) {
        console.error('❌ Webhook error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ============================================================
// 🔥 PAYMENT - COMPLETE SANDBOX (POST)
// ============================================================
app.post('/api/v2/payment/sandbox/complete', async (req, res) => {
    console.log(`🏖️ SANDBOX COMPLETE: ${req.body.transactionId}`);
    try {
        const { transactionId } = req.body;
        const token = req.headers.authorization || '';
        
        if (!transactionId) {
            return res.status(400).json({
                success: false,
                error: 'Transaction ID is required'
            });
        }
        
        const targetUrl = `${APPS_SCRIPT_URL}?pathInfo=/api/v2/payment/sandbox/complete`;
        console.log(`  → Completing sandbox: ${targetUrl}`);
        
        const result = await proxyRequest(
            targetUrl,
            'POST',
            { transactionId: transactionId },
            { 'Authorization': token }
        );
        
        res.status(result.status).json(result.data);
        
    } catch (error) {
        console.error('❌ Sandbox complete error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ============================================================
// 🔥 AUTH - LOGIN
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
        console.log(`  → Proxying login to: ${targetUrl}`);

        const result = await proxyRequest(targetUrl, 'POST', { email, password });
        res.status(result.status).json(result.data);
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ============================================================
// 🔥 AUTH - REGISTER
// ============================================================
app.post('/api/v2/auth/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        
        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Name, email and password are required'
            });
        }

        const targetUrl = `${APPS_SCRIPT_URL}?action=register`;
        console.log(`  → Proxying register to: ${targetUrl}`);

        const result = await proxyRequest(targetUrl, 'POST', { name, email, password });
        res.status(result.status).json(result.data);
        
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ============================================================
// 🔥 STATS
// ============================================================
app.get('/api/v2/stats', async (req, res) => {
    try {
        const targetUrl = `${APPS_SCRIPT_URL}?action=getStats`;
        console.log(`  → Fetching stats: ${targetUrl}`);
        
        const result = await proxyRequest(targetUrl, 'GET');
        res.status(result.status).json(result.data);
    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.get('/api/v2/stat', async (req, res) => {
    try {
        const targetUrl = `${APPS_SCRIPT_URL}?action=getStats`;
        const result = await proxyRequest(targetUrl, 'GET');
        res.status(result.status).json(result.data);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ============================================================
// 🔥 PRODUCTS
// ============================================================
app.get('/api/v2/products', async (req, res) => {
    try {
        const queryString = new URLSearchParams(req.query).toString();
        const targetUrl = `${APPS_SCRIPT_URL}?action=getProducts${queryString ? '&' + queryString : ''}`;
        
        const result = await proxyRequest(targetUrl, 'GET');
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
        const result = await proxyRequest(targetUrl, 'GET');
        res.status(result.status).json(result.data);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// 🔥 ORDERS
// ============================================================
app.get('/api/v2/orders', async (req, res) => {
    try {
        const queryString = new URLSearchParams(req.query).toString();
        const targetUrl = `${APPS_SCRIPT_URL}?action=getOrders${queryString ? '&' + queryString : ''}`;
        const result = await proxyRequest(targetUrl, 'GET');
        res.status(result.status).json(result.data);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// 🔥 CUSTOMERS
// ============================================================
app.get('/api/v2/customers', async (req, res) => {
    try {
        const queryString = new URLSearchParams(req.query).toString();
        const targetUrl = `${APPS_SCRIPT_URL}?action=getCustomers${queryString ? '&' + queryString : ''}`;
        const result = await proxyRequest(targetUrl, 'GET');
        res.status(result.status).json(result.data);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// 🔥 SUPPORT
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
// 🔥 404 HANDLER
// ============================================================
app.use((req, res) => {
    console.log(`❌ 404: ${req.method} ${req.path}`);
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        path: req.path,
        method: req.method
    });
});

// ============================================================
// 🔥 ERROR HANDLER
// ============================================================
app.use((err, req, res, next) => {
    console.error('❌ Unhandled error:', err);
    res.status(500).json({
        success: false,
        error: err.message || 'Internal server error'
    });
});

// ============================================================
// 🔥 EXPORT UNTUK VERCELL
// ============================================================
module.exports = app;
