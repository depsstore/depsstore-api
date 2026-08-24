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
    
    return {
        status: response.status,
        data: data
    };
}

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
        
        const statusData = result.data.data;
        
        // 🔥🔥🔥 HANYA KIRIM STATUS, JANGAN HITUNG ULANG EXPIRED_AT!
        res.status(200).json({
            success: true,
            data: {
                transactionId: statusData.transaction_id || req.params.transactionId,
                status: statusData.status || 'pending',
                amount: statusData.amount || 0,
                totalAmount: statusData.total_amount || 0,
                creditAmount: statusData.credit_amount || 0,
                adminFee: statusData.admin_fee || 0,
                serviceFee: statusData.admin_fee || 0,
                isTest: statusData.is_test || false
                // 🔥 HAPUS expiredAt DARI SINI!
            }
        });
        
    } catch (error) {
        console.error('❌ Payment status error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// 🔥 ENDPOINT LAIN (JANGAN DIUBAH)
// ============================================================

// AUTH - LOGIN
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

// AUTH - REGISTER
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
