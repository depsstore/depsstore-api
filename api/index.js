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
    // 🔥 Cek kredensial
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
    
    return {
        status: response.status,
        data: data
    };
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
// 🔥 ROOT
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
                sandbox: '/api/v2/payment/sandbox/complete (POST)'
            }
        },
        timestamp: new Date().toISOString()
    });
});

function createQRISPayment(orderData) {
    var url = API_URL + '/api/v2/payment/create';

    console.log('Creating QRIS payment via Vercel API:', url);
    console.log('Order data:', orderData);

    return fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            // 🔥 KIRIM SUBTOTAL + FEE ADMIN KE BACKEND
            subtotal: orderData.subtotal,       // Subtotal produk
            feeAdmin: orderData.feeAdmin,       // Fee admin DepsStore
            amount: orderData.total,            // total = subtotal + feeAdmin (untuk fallback)
            orderId: orderData.orderId,         // 🔥 ORDER ID
            description: 'Pembayaran Order ' + orderData.orderId,  // 🔥 ORDER ID DI DESKRIPSI
            customer: {
                name: orderData.customer.name,
                email: orderData.customer.email,
                phone: orderData.customer.phone
            },
            items: orderData.items,
            callbackUrl: API_URL + '/api/webhook/buatqris',
            isTest: true
        })
    })
    .then(function(response) {
        if (!response.ok) {
            throw new Error('HTTP ' + response.status);
        }
        return response.json();
    })
    .then(function(data) {
        console.log('QRIS payment created (via Vercel):', data);

        if (!data.success) {
            throw new Error(data.error || 'Gagal membuat pembayaran QRIS');
        }

        // 🔥 NORMALISASI DATA DARI VERCEL API
        var result = {
            success: true,
            data: {
                transactionId: data.data.transactionId,
                orderId: data.data.orderId,
                qrUrl: data.data.qrUrl,
                qrisImage: data.data.qrisImage,
                paymentUrl: data.data.paymentUrl,
                amount: data.data.amount,          // subtotal + feeAdmin
                subtotal: data.data.subtotal,      // subtotal produk
                totalAmount: data.data.totalAmount, // total dari BuatQris
                serviceFee: data.data.serviceFee,   // 🔥 BIAYA LAYANAN (HANYA DARI BUATQRIS)
                feeAdmin: data.data.feeAdmin,        // fee admin DepsStore
                status: data.data.status,
                expiredAt: data.data.expiredAt,      // 🔥 EXPIRED AT
                isTest: data.data.isTest || false
            }
        };

        return result;
    })
    .catch(function(error) {
        console.error('QRIS payment error:', error);
        throw error;
    });
}

// ============================================================
// 🔥 PAYMENT - CHECK STATUS
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
        
        const result = await callBuatQris({
            action: 'api_check_status',
            account_id: BQ_ACCOUNT_ID,
            secret_token: BQ_SECRET_TOKEN,
            transaction_id: transactionId
        });
        
        console.log(`📊 BuatQris status result:`, result);
        
        if (!result.data.success) {
            return res.status(result.status || 400).json({
                success: false,
                error: result.data.message || 'Failed to check status'
            });
        }
        
        const statusData = result.data.data;
        
        // 🔥 AMBIL EXPIRED AT DARI BUATQRIS
        const expiredAt = statusData.expired_at || statusData.expiredAt || null;
        
        res.status(200).json({
            success: true,
            data: {
                transactionId: statusData.transaction_id || transactionId,
                status: statusData.status || 'pending',
                amount: statusData.amount || 0,
                totalAmount: statusData.total_amount || 0,
                creditAmount: statusData.credit_amount || 0,
                adminFee: statusData.admin_fee || 0,
                serviceFee: statusData.admin_fee || (statusData.total_amount - statusData.amount) || 0,
                expiredAt: expiredAt,  // 🔥 KIRIM EXPIRED AT KE FRONTEND
                isTest: statusData.is_test || false
            }
        });
        
    } catch (error) {
        console.error('❌ Payment status error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ============================================================
// 🔥 PAYMENT - COMPLETE SANDBOX
// ============================================================
app.post('/api/v2/payment/sandbox/complete', async (req, res) => {
    console.log(`🏖️ SANDBOX COMPLETE: ${req.body.transactionId}`);
    try {
        const { transactionId } = req.body;
        
        if (!transactionId) {
            return res.status(400).json({
                success: false,
                error: 'Transaction ID is required'
            });
        }
        
        const statusResult = await callBuatQris({
            action: 'api_check_status',
            account_id: BQ_ACCOUNT_ID,
            secret_token: BQ_SECRET_TOKEN,
            transaction_id: transactionId
        });
        
        if (!statusResult.data.success) {
            return res.status(400).json({
                success: false,
                error: statusResult.data.message || 'Transaction not found'
            });
        }
        
        res.status(200).json({
            success: true,
            message: 'Sandbox transaction completed',
            data: {
                transactionId: transactionId,
                status: 'success'
            }
        });
        
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

// ============================================================
// 🔥 PRODUCTS
// ============================================================
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

app.get('/api/v2/orders', async (req, res) => {
    try {
        const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbyi-CMq3E2f1-99UA8kRoD7YobdoflwJEE-ZjksAKnhcZ62x0q21TjiDytxfFUvr0mC/exec';
        const queryString = new URLSearchParams(req.query).toString();
        const targetUrl = `${APPS_SCRIPT_URL}?action=getOrders${queryString ? '&' + queryString : ''}`;
        const response = await fetch(targetUrl);
        const data = await response.json();
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
