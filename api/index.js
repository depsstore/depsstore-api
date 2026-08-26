// api/index.js - Vercel Serverless Function (LANGSUNG KE BUATQRIS)
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// ============================================================
// 🔥 KONFIGURASI BUATQRIS (dari Environment Variables)
// ============================================================
const BQ_ACCOUNT_ID = process.env.BUATQRIS_ACCOUNT_ID;
const BQ_SECRET_TOKEN = process.env.BUATQRIS_SECRET_TOKEN;
const BQ_MODE = process.env.BUATQRIS_MODE || 'sandbox';

// ============================================================
// 🔥 HELPER: PANGGIL BUATQRIS API
// ============================================================
async function callBuatQris(params) {
    if (!BQ_ACCOUNT_ID || !BQ_SECRET_TOKEN) {
        console.error('❌ BuatQris credentials not configured!');
        return {
            status: 500,
            data: {
                success: false,
                error: 'BuatQris credentials not configured. Please set BUATQRIS_ACCOUNT_ID and BUATQRIS_SECRET_TOKEN in environment variables.'
            }
        };
    }
    
    const url = 'https://api.buatqris.site';
    
    const formData = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        formData.append(key, value);
    }
    
    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData
    };
    
    console.log(`📡 Calling BuatQris API with action: ${params.action}`);
    
    const response = await fetch(url, options);
    const data = await response.json();
    
    console.log(`📊 BuatQris response:`, data);
    
    // 🔥 TAMBAHKAN FALLBACK
    if (!data.success || !data.data) {
        return {
            status: response.status,
            data: {
                success: false,
                error: data.message || 'BuatQris API error',
                raw: data
            }
        };
    }
    
    return {
        status: response.status,
        data: data
    };
}

// ============================================================
// 🔥 ROOT & HEALTH (TAMBAHAN BARU - PASTI 200)
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
            login: '/api/v2/auth/login',
            register: '/api/v2/auth/register',
            support: '/api/v2/support',
            stats: '/api/v2/stats',
            payment: {
                create: '/api/v2/payment/create (POST)',
                status: '/api/v2/payment/status/:id (GET)'
            }
        },
        timestamp: new Date().toISOString()
    });
});

// 🔥 TAMBAHKAN INI
app.get('/api/v2', (req, res) => {
    res.json({
        success: true,
        message: 'DepsStore API v2',
        version: '2.9.0',
        timestamp: new Date().toISOString()
    });
});

// 🔥 TAMBAHKAN INI
app.get('/api/v2/', (req, res) => {
    res.json({
        success: true,
        message: 'DepsStore API v2',
        version: '2.9.0',
        timestamp: new Date().toISOString()
    });
});

app.get('/api/v2/system/health', (req, res) => {
    res.json({
        success: true,
        data: {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            version: '2.9.0'
        }
    });
});

// ============================================================
// 🔥 PAYMENT - CREATE QRIS (AMBIL EXPIRED_AT DARI BUATQRIS)
// ============================================================
app.post('/api/v2/payment/create', async (req, res) => {
    try {
        const { amount, subtotal, feeAdmin, customer, description, isTest, qrisMethod, feeBy, callbackUrl, orderId } = req.body;
        
        const amountToBuatQris = subtotal ? (subtotal + (feeAdmin || 0)) : amount;
        
        // 🔥 1. CREATE QRIS
        const result = await callBuatQris({
            action: 'api_create_qris',
            account_id: BQ_ACCOUNT_ID,
            secret_token: BQ_SECRET_TOKEN,
            amount: String(amountToBuatQris),
            description: 'Pembayaran Order ' + orderId,
            qris_method: qrisMethod || 'qris_two',
            fee_by: feeBy || 'user',
            callback_url: callbackUrl || 'https://depsstore-api.vercel.app/',
            test: (isTest !== undefined ? isTest : (BQ_MODE === 'sandbox')) ? '1' : '0'
        });
        
        const qrisData = result.data.data;
        const transactionId = qrisData.transaction_id;
        
        // 🔥 2. PANGGIL STATUS UNTUK AMBIL EXPIRED_AT
        const statusResult = await callBuatQris({
            action: 'api_check_status',
            account_id: BQ_ACCOUNT_ID,
            secret_token: BQ_SECRET_TOKEN,
            transaction_id: transactionId
        });
        
        const statusData = statusResult.data.data;
        
        // 🔥 AMBIL EXPIRED_AT DARI BUATQRIS (jika ada)
        let expiredAt = statusData.expired_at || null;
        
        // 🔥 FALLBACK: Jika BuatQris tidak mengembalikan expired_at, hitung manual 15 menit
        if (!expiredAt) {
            expiredAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        }
        
        // 🔥 HITUNG SERVICE FEE
        const serviceFee = (qrisData.total_amount || amountToBuatQris) - amountToBuatQris;
        
        res.status(200).json({
            success: true,
            data: {
                transactionId: transactionId,
                orderId: orderId || 'ORD-' + Date.now(),
                qrUrl: qrisData.qr_url || '',
                qrisImage: qrisData.qris_image || '',
                paymentUrl: qrisData.payment_url || '',
                amount: amountToBuatQris,
                subtotal: subtotal || amountToBuatQris - (feeAdmin || 0),
                totalAmount: qrisData.total_amount || amountToBuatQris,
                serviceFee: serviceFee,
                feeAdmin: feeAdmin || 0,
                status: qrisData.status || 'pending',
                isTest: (isTest !== undefined ? isTest : (BQ_MODE === 'sandbox')),
                customer: customer,
                qrisMethod: qrisData.qris_method || 'qris_two',
                expiredAt: expiredAt  // ✅ DARI BUATQRIS (SINKRON!)
            }
        });
        
    } catch (error) {
        console.error('❌ Payment create error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// 🔥 PAYMENT - CHECK STATUS (HANYA UPDATE STATUS, JANGAN HITUNG EXPIRED_AT)
// ============================================================
app.get('/api/v2/payment/status/:transactionId', async (req, res) => {
    try {
        const result = await callBuatQris({
            action: 'api_check_status',
            account_id: BQ_ACCOUNT_ID,
            secret_token: BQ_SECRET_TOKEN,
            transaction_id: req.params.transactionId
        });
        
        if (!result.data.success) {
            return res.status(400).json({ success: false, error: result.data.message });
        }
        
        const statusData = result.data.data;
        
        res.json({
            success: true,
            data: {
                transactionId: statusData.transaction_id,
                status: statusData.status,
                amount: statusData.amount,
                totalAmount: statusData.total_amount,
                isTest: statusData.is_test
            }
        });
        
    } catch (error) {
        console.error('Payment status error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/v2/support', async (req, res) => {
    try {
        const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbyi-CMq3E2f1-99UA8kRoD7YobdoflwJEE-ZjksAKnhcZ62x0q21TjiDytxfFUvr0mC/exec';
        const targetUrl = `${APPS_SCRIPT_URL}?action=createSupport`;
        
        const response = await fetch(targetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body)
        });
        
        const data = await response.json();
        res.status(response.status).json(data);
        
    } catch (error) {
        console.error('Support error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// 🔥 TEST ENDPOINT (TAMBAHAN)
// ============================================================
app.get('/api/v2/test', (req, res) => {
    res.json({
        success: true,
        message: 'Test endpoint berhasil',
        timestamp: new Date().toISOString()
    });
});

// ============================================================
// 🔥 WEBHOOK BUATQRIS (TAMBAHAN)
// ============================================================
app.post('/api/webhook/buatqris', async (req, res) => {
    try {
        const data = req.body;
        console.log('Webhook received:', data);
        
        // 🔥 Update status payment di database
        // (Anda bisa menambahkan logika untuk update status)
        
        res.json({
            success: true,
            message: 'Webhook processed',
            data: data
        });
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// 🔥 PAYMENT SANDBOX COMPLETE (TAMBAHAN)
// ============================================================
app.post('/api/v2/payment/sandbox/complete', async (req, res) => {
    try {
        const { transactionId } = req.body;
        
        if (!transactionId) {
            return res.status(400).json({ success: false, error: 'Transaction ID is required' });
        }
        
        res.json({
            success: true,
            message: 'Sandbox transaction completed',
            data: {
                transactionId: transactionId,
                status: 'success'
            }
        });
    } catch (error) {
        console.error('Sandbox complete error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// 🔥 DASHBOARD (TAMBAHAN)
// ============================================================
app.get('/api/v2/dashboard', async (req, res) => {
    try {
        const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbyi-CMq3E2f1-99UA8kRoD7YobdoflwJEE-ZjksAKnhcZ62x0q21TjiDytxfFUvr0mC/exec';
        const targetUrl = `${APPS_SCRIPT_URL}?action=getStats`;
        
        const response = await fetch(targetUrl);
        const data = await response.json();
        res.status(response.status).json(data);
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// 🔥 BACKUPS (TAMBAHAN)
// ============================================================
app.get('/api/v2/backups', async (req, res) => {
    try {
        const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbyi-CMq3E2f1-99UA8kRoD7YobdoflwJEE-ZjksAKnhcZ62x0q21TjiDytxfFUvr0mC/exec';
        const targetUrl = `${APPS_SCRIPT_URL}?action=getBackups`;
        
        const response = await fetch(targetUrl);
        const data = await response.json();
        res.status(response.status).json(data);
    } catch (error) {
        console.error('Backups error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/v2/backups', async (req, res) => {
    try {
        const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbyi-CMq3E2f1-99UA8kRoD7YobdoflwJEE-ZjksAKnhcZ62x0q21TjiDytxfFUvr0mC/exec';
        const targetUrl = `${APPS_SCRIPT_URL}?action=createBackup`;
        
        const response = await fetch(targetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body || {})
        });
        
        const data = await response.json();
        res.status(response.status).json(data);
    } catch (error) {
        console.error('Backup error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// 🔥 LOGS (TAMBAHAN)
// ============================================================
app.get('/api/v2/logs', async (req, res) => {
    try {
        const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbyi-CMq3E2f1-99UA8kRoD7YobdoflwJEE-ZjksAKnhcZ62x0q21TjiDytxfFUvr0mC/exec';
        const targetUrl = `${APPS_SCRIPT_URL}?action=getLogs`;
        
        const response = await fetch(targetUrl);
        const data = await response.json();
        res.status(response.status).json(data);
    } catch (error) {
        console.error('Logs error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// 🔥 ENDPOINT LAIN (JANGAN DIUBAH)
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

        const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbyi-CMq3E2f1-99UA8kRoD7YobdoflwJEE-ZjksAKnhcZ62x0q21TjiDytxfFUvr0mC/exec';
        const targetUrl = `${APPS_SCRIPT_URL}?action=login`;
        
        const response = await fetch(targetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        res.status(response.status).json(data);
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/v2/auth/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        
        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Name, email and password are required'
            });
        }

        const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbyi-CMq3E2f1-99UA8kRoD7YobdoflwJEE-ZjksAKnhcZ62x0q21TjiDytxfFUvr0mC/exec';
        const targetUrl = `${APPS_SCRIPT_URL}?action=register`;
        
        const response = await fetch(targetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });
        
        const data = await response.json();
        res.status(response.status).json(data);
        
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// STATS
app.get('/api/v2/stats', async (req, res) => {
    try {
        const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbyi-CMq3E2f1-99UA8kRoD7YobdoflwJEE-ZjksAKnhcZ62x0q21TjiDytxfFUvr0mC/exec';
        const targetUrl = `${APPS_SCRIPT_URL}?action=getStats`;
        
        const response = await fetch(targetUrl);
        const data = await response.json();
        res.status(response.status).json(data);
    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// PRODUCTS
app.get('/api/v2/products', async (req, res) => {
    try {
        const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbyi-CMq3E2f1-99UA8kRoD7YobdoflwJEE-ZjksAKnhcZ62x0q21TjiDytxfFUvr0mC/exec';
        const queryString = new URLSearchParams(req.query).toString();
        const targetUrl = `${APPS_SCRIPT_URL}?action=getProducts${queryString ? '&' + queryString : ''}`;
        
        const response = await fetch(targetUrl);
        const data = await response.json();
        res.status(response.status).json(data);
    } catch (error) {
        console.error('Products error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ORDERS
app.get('/api/v2/orders', async (req, res) => {
    try {
        const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbyi-CMq3E2f1-99UA8kRoD7YobdoflwJEE-ZjksAKnhcZ62x0q21TjiDytxfFUvr0mC/exec';
        const queryString = new URLSearchParams(req.query).toString();
        const targetUrl = `${APPS_SCRIPT_URL}?action=getOrders${queryString ? '&' + queryString : ''}`;
        const response = await fetch(targetUrl);
        const data = await response.json();
        
        // 🔥 TAMBAHKAN CACHE CONTROL
        res.setHeader('Cache-Control', 'no-store');
        res.status(response.status).json(data);
    } catch (error) {
        console.error('Orders error:', error);
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
