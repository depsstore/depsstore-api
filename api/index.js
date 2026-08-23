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
// 🔥 PAYMENT - CREATE QRIS
// ============================================================
app.post('/api/v2/payment/create', async (req, res) => {
    console.log('🔥🔥🔥 PAYMENT CREATE ENDPOINT HIT! 🔥🔥🔥');
    console.log('📦 Request body:', req.body);
    
    try {
        const { amount, subtotal, feeAdmin, customer, description, isTest, qrisMethod, feeBy, callbackUrl, orderId } = req.body;
        
        // 🔥 PENTING: amount yang dikirim ke BuatQris = subtotal + feeAdmin
        const amountToBuatQris = subtotal ? (subtotal + (feeAdmin || 0)) : amount;
        
        // Validasi
        if (!amountToBuatQris || amountToBuatQris < 1000) {
            return res.status(400).json({
                success: false,
                error: 'Minimal nominal Rp 1.000'
            });
        }
        
        if (!customer || !customer.name || !customer.email) {
            return res.status(400).json({
                success: false,
                error: 'Nama dan Email customer wajib diisi'
            });
        }
        
        // 🔥 ORDER ID UNTUK DESKRIPSI
        const orderDescription = description || `Pembayaran Order ${orderId || 'ORD-' + Date.now()}`;
        
        // 🔥 🔥 🔥 PANGGIL BUATQRIS 🔥 🔥 🔥
        const result = await callBuatQris({
            action: 'api_create_qris',
            account_id: BQ_ACCOUNT_ID,
            secret_token: BQ_SECRET_TOKEN,
            amount: String(amountToBuatQris),  // 🔥 SUBTOTAL + FEE ADMIN
            description: orderDescription,     // 🔥 ORDER ID
            qris_method: qrisMethod || 'qris_two',
            fee_by: feeBy || 'user',
            callback_url: callbackUrl || 'https://depsstore-api.vercel.app/',
            test: (isTest !== undefined ? isTest : (BQ_MODE === 'sandbox')) ? '1' : '0'
        });
        
        console.log(`📊 BuatQris result:`, result);
        
        if (!result.data.success) {
            console.log(`⚠️ BuatQris error:`, result.data.message);
            return res.status(result.status || 400).json({
                success: false,
                error: result.data.message || 'Failed to create payment'
            });
        }
        
        const qrisData = result.data.data;
        const transactionId = qrisData.transaction_id;
        
        // 🔥 HITUNG SERVICE FEE DENGAN BENAR
        // total_amount dari BuatQris = amount + serviceFee
        // Jadi serviceFee = total_amount - amount
        const serviceFee = (qrisData.total_amount || amountToBuatQris) - amountToBuatQris;
        
        // 🔥 AMBIL EXPIRED AT DARI BUATQRIS
        const expiredAt = qrisData.expired_at || qrisData.expiredAt || null;
        
        res.status(200).json({
            success: true,
            data: {
                transactionId: transactionId,
                orderId: orderId || 'ORD-' + Date.now(),
                qrUrl: qrisData.qr_url || '',
                qrisImage: qrisData.qris_image || '',
                paymentUrl: qrisData.payment_url || '',
                amount: amountToBuatQris,           // 🔥 SUBTOTAL + FEE ADMIN
                subtotal: subtotal || amountToBuatQris - (feeAdmin || 0),  // 🔥 SUBTOTAL PRODUK
                totalAmount: qrisData.total_amount || amountToBuatQris,      // 🔥 TOTAL DARI BUATQRIS
                serviceFee: serviceFee,              // 🔥 BIAYA LAYANAN (HANYA DARI BUATQRIS)
                feeAdmin: feeAdmin || 0,             // 🔥 FEE ADMIN
                status: qrisData.status || 'pending',
                isTest: (isTest !== undefined ? isTest : (BQ_MODE === 'sandbox')),
                customer: customer,
                qrisMethod: qrisData.qris_method || 'qris_two',
                expiredAt: expiredAt  // 🔥 KIRIM EXPIRED AT
            }
        });
        
    } catch (error) {
        console.error('❌ Payment create error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

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
        
        // 🔥🔥🔥 AMBIL EXPIRED_AT DARI BUATQRIS
        // BuatQris biasanya mengirim expired_at dalam format timestamp (detik) atau ISO string
        let expiredAt = statusData.expired_at || statusData.expiredAt || null;
        
        // 🔥 Jika expiredAt berupa angka (timestamp detik), konversi ke ISO string
        if (expiredAt && typeof expiredAt === 'number') {
            expiredAt = new Date(expiredAt * 1000).toISOString();
        }
        
        res.status(200).json({
            success: true,
            data: {
                transactionId: statusData.transaction_id || transactionId,
                status: statusData.status || 'pending',
                amount: statusData.amount || 0,
                totalAmount: statusData.total_amount || 0,
                creditAmount: statusData.credit_amount || 0,
                adminFee: statusData.admin_fee || 0,
                serviceFee: statusData.admin_fee || 0,
                expiredAt: expiredAt,  // 🔥 KIRIM EXPIRED AT DALAM FORMAT ISO
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
