// api/index.js - Vercel Serverless Function
// DepsStore API v3.0.0 - OPTIMIZED FOR VERCEL

const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();

// ============================================================
// MIDDLEWARE - PERBAIKAN
// ============================================================

app.use(cors({
    origin: '*', // Izinkan semua origin untuk development
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// 🔥 PERBAIKAN: Tambahkan limit untuk payload besar
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============================================================
// KONFIGURASI - PERBAIKAN
// ============================================================

const BQ_ACCOUNT_ID = process.env.BUATQRIS_ACCOUNT_ID;
const BQ_SECRET_TOKEN = process.env.BUATQRIS_SECRET_TOKEN;
const BQ_MODE = process.env.BUATQRIS_MODE || 'sandbox';
const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL;

// 🔥 PERBAIKAN: Logging lebih informatif
console.log('🚀 DepsStore API v3.0.0');
console.log(`📊 BuatQris Mode: ${BQ_MODE}`);
console.log(`📋 Account ID: ${BQ_ACCOUNT_ID ? '✅ Set' : '❌ Not Set'}`);
console.log(`📋 Apps Script URL: ${APPS_SCRIPT_URL ? '✅ Set' : '❌ Not Set'}`);

// 🔥 PERBAIKAN: Tambahkan timeout default
const DEFAULT_TIMEOUT = 60000; // 30 detik

// api/index.js - TAMBAHKAN RETRY

async function callAppsScriptWithRetry(action, body = null, maxRetries = 3) {
    let lastError = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`📡 Attempt ${attempt}/${maxRetries}: ${action}`);
            const result = await callAppsScript(action, body);
            
            if (result && result.success) {
                return result;
            }
            
            // Jika gagal tapi bukan error timeout, langsung return
            if (result && result.error && !result.error.includes('aborted')) {
                return result;
            }
            
            // Tunggu sebelum retry
            if (attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            }
            
            lastError = result?.error || 'Unknown error';
        } catch (error) {
            lastError = error.message;
            if (attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            }
        }
    }
    
    return { success: false, error: lastError || 'Max retries exceeded' };
}

// ============================================================
// HELPER: CALL BUATQRIS API - PERBAIKAN
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
    formData.append('account_id', BQ_ACCOUNT_ID);
    formData.append('secret_token', BQ_SECRET_TOKEN);

    for (const [key, value] of Object.entries(params)) {
        if (key !== 'account_id' && key !== 'secret_token' && value !== undefined && value !== null) {
            formData.append(key, String(value));
        }
    }

    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
        // 🔥 PERBAIKAN: Tambahkan timeout
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT)
    };

    console.log(`📡 BuatQris: ${params.action}`);

    try {
        const response = await fetch(url, options);
        const data = await response.json();
        console.log(`📊 BuatQris response:`, JSON.stringify(data).substring(0, 500));

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
    } catch (error) {
        console.error('❌ BuatQris fetch error:', error.message);
        return {
            status: 500,
            data: {
                success: false,
                error: error.message
            }
        };
    }
}

// ============================================================
// HELPER: CALL APPS SCRIPT - PERBAIKAN
// ============================================================

async function callAppsScript(action, body = null) {
    if (!APPS_SCRIPT_URL) {
        console.warn('⚠️ APPS_SCRIPT_URL not configured');
        return { success: false, error: 'APPS_SCRIPT_URL not configured' };
    }

    const targetUrl = `${APPS_SCRIPT_URL}?action=${encodeURIComponent(action)}`;
    console.log(`📡 Apps Script: ${action}`);

    const options = {
        method: body ? 'POST' : 'GET',
        headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        // 🔥 PERBAIKAN: Tambahkan timeout lebih lama
        signal: AbortSignal.timeout(30000) // 30 detik (sebelumnya 15 detik)
    };

    if (body) {
        options.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(targetUrl, options);
        const text = await response.text();

        if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
            console.warn('⚠️ Apps Script returned HTML');
            return { success: false, error: 'Apps Script returned HTML', isHtml: true };
        }

        try {
            const jsonData = JSON.parse(text);
            console.log(`✅ Apps Script response:`, JSON.stringify(jsonData).substring(0, 300));
            return jsonData;
        } catch (parseError) {
            console.warn('⚠️ Apps Script returned invalid JSON:', text.substring(0, 200));
            return { success: false, error: 'Invalid JSON', raw: text.substring(0, 200) };
        }
    } catch (error) {
        console.warn('⚠️ Apps Script error:', error.message);
        return { success: false, error: error.message };
    }
}

// ============================================================
// AUTH - LOGIN & REGISTER
// ============================================================

// api/index.js - PERBAIKAN LOGIN

app.post('/api/v2/auth/login', async (req, res) => {
    console.log('🔐 Login attempt:', req.body.email);
    
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Email and password are required'
            });
        }
        
        // 🔥 PAKAI RETRY
        const result = await callAppsScriptWithRetry('login', { email, password });
        
        console.log('📥 Login result success:', result?.success);
        
        if (result && result.success) {
            console.log('✅ Login success:', email);
            return res.json(result);
        } else {
            const errorMsg = result?.message || result?.error || 'Invalid credentials';
            console.log('❌ Login failed:', email, errorMsg);
            return res.status(401).json({
                success: false,
                error: errorMsg
            });
        }
    } catch (error) {
        console.error('❌ Login error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
});

// api/index.js - PERBAIKAN REGISTER

app.post('/api/v2/auth/register', async (req, res) => {
    console.log('📝 Register attempt:', req.body.email);
    
    try {
        const { name, email, password } = req.body;
        
        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Name, email and password are required'
            });
        }
        
        // 🔥 PAKAI RETRY
        const result = await callAppsScriptWithRetry('register', { name, email, password });
        
        console.log('📥 Register result:', JSON.stringify(result));
        
        if (result && result.success) {
            console.log('✅ Register success:', email);
            return res.json(result);
        } else {
            const errorMsg = result?.message || result?.error || 'Registration failed';
            console.log('❌ Register failed:', email, errorMsg);
            return res.status(400).json({
                success: false,
                error: errorMsg
            });
        }
    } catch (error) {
        console.error('❌ Register error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
});

// ============================================================
// ROOT & HEALTH - PERBAIKAN
// ============================================================

app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'DepsStore API v3.0.0',
        mode: BQ_MODE,
        timestamp: new Date().toISOString(),
        // 🔥 PERBAIKAN: Tambahkan status koneksi
        connections: {
            buatqris: BQ_ACCOUNT_ID && BQ_SECRET_TOKEN ? 'configured' : 'missing',
            appsScript: APPS_SCRIPT_URL ? 'configured' : 'missing'
        }
    });
});

app.get('/api/v2', (req, res) => {
    res.json({
        success: true,
        message: 'DepsStore API v3.0.0',
        mode: BQ_MODE,
        timestamp: new Date().toISOString(),
        endpoints: [
            '/api/v2/products',
            '/api/v2/orders',
            '/api/v2/stats',
            '/api/v2/auth/login',
            '/api/v2/auth/register',
            '/api/v2/payment/create',
            '/api/v2/payment/status/:transactionId',
            '/api/v2/support'
        ]
    });
});

app.get('/api/v2/system/health', (req, res) => {
    res.json({
        success: true,
        data: {
            status: 'healthy',
            mode: BQ_MODE,
            timestamp: new Date().toISOString(),
            version: '3.0.0',
            // 🔥 PERBAIKAN: Cek koneksi ke BuatQris
            buatqris: BQ_ACCOUNT_ID && BQ_SECRET_TOKEN ? 'connected' : 'disconnected',
            appsScript: APPS_SCRIPT_URL ? 'connected' : 'disconnected'
        }
    });
});

// ============================================================
// PRODUCTS - PERBAIKAN
// ============================================================

app.get('/api/v2/products', async (req, res) => {
    try {
        console.log('📦 Fetching products...');
        const data = await callAppsScript('getProducts');

        // Cek beberapa format response
        if (data && data.success) {
            if (data.items && Array.isArray(data.items)) {
                console.log(`✅ Products from Apps Script: ${data.items.length} items`);
                return res.json({
                    success: true,
                    data: data.items,
                    items: data.items,
                    total: data.items.length,
                    timestamp: new Date().toISOString()
                });
            }
            if (data.data && Array.isArray(data.data)) {
                console.log(`✅ Products from Apps Script: ${data.data.length} items`);
                return res.json({
                    success: true,
                    data: data.data,
                    items: data.data,
                    total: data.data.length,
                    timestamp: new Date().toISOString()
                });
            }
        }

        // 🔥 PERBAIKAN: Response lebih informatif
        console.warn('⚠️ Products data unavailable');
        res.status(500).json({
            success: false,
            error: 'Products data unavailable',
            detail: data.error || 'No products found in spreadsheet',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Products error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// ============================================================
// ORDERS - PERBAIKAN
// ============================================================

app.get('/api/v2/orders', async (req, res) => {
    try {
        console.log('📋 Fetching orders...');
        const data = await callAppsScript('getOrders');
        res.setHeader('Cache-Control', 'no-store');

        if (data && data.success && data.items && Array.isArray(data.items)) {
            console.log(`✅ Orders from Apps Script: ${data.items.length} items`);
            res.json(data);
        } else {
            console.warn('⚠️ Orders data unavailable');
            res.status(500).json({
                success: false,
                error: 'Orders data unavailable',
                detail: data.error || 'Apps Script returned invalid response',
                timestamp: new Date().toISOString()
            });
        }
    } catch (error) {
        console.error('❌ Orders error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// ============================================================
// STATS - PERBAIKAN
// ============================================================

app.get('/api/v2/stats', async (req, res) => {
    try {
        console.log('📊 Fetching stats...');
        const data = await callAppsScript('getStats');

        if (data && data.success && data.data) {
            return res.json(data);
        }

        // Fallback
        console.warn('⚠️ Stats data unavailable, using fallback');
        res.json({
            success: true,
            data: {
                products: 0,
                customers: 0,
                users: 0,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('❌ Stats error:', error);
        res.json({
            success: true,
            data: {
                products: 0,
                customers: 0,
                users: 0,
                timestamp: new Date().toISOString()
            }
        });
    }
});

// ============================================================
// PAYMENT - CREATE QRIS - PERBAIKAN
// ============================================================

app.post('/api/v2/payment/create', async (req, res) => {
    console.log('🔥 PAYMENT CREATE ENDPOINT HIT!');
    console.log('📦 Request body:', req.body);

    try {
        const { 
            amount, 
            subtotal, 
            feeAdmin, 
            customer, 
            description, 
            isTest, 
            qrisMethod, 
            feeBy, 
            callbackUrl, 
            orderId 
        } = req.body;

        // Validasi minimum
        const amountToBuatQris = subtotal ? (subtotal + (feeAdmin || 0)) : amount;
        
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

        const orderDescription = description || `Pembayaran Order ${orderId || 'ORD-' + Date.now()}`;

        console.log(`💰 Amount to BuatQris: ${amountToBuatQris}`);
        console.log(`📝 Description: ${orderDescription}`);

        // 🔥 PERBAIKAN: Panggil BuatQris dengan parameter yang valid
        const result = await callBuatQris({
            action: 'api_create_qris',
            amount: String(Math.floor(amountToBuatQris)), // 🔥 PERBAIKAN: Pastikan integer
            description: orderDescription.substring(0, 100), // 🔥 PERBAIKAN: Batasi panjang
            qris_method: qrisMethod || 'qris_two',
            fee_by: feeBy || 'user',
            callback_url: callbackUrl || 'https://depsstore-api.vercel.app/api/webhook/buatqris',
            test: (isTest !== undefined ? isTest : (BQ_MODE === 'sandbox')) ? '1' : '0'
        });

        console.log(`📊 BuatQris result:`, JSON.stringify(result).substring(0, 500));

        if (!result.data.success) {
            return res.status(result.status || 400).json({
                success: false,
                error: result.data.message || 'Failed to create payment',
                detail: result.data.raw || null
            });
        }

        const qrisData = result.data.data;
        const transactionId = qrisData.transaction_id;

        const serviceFee = (qrisData.total_amount || amountToBuatQris) - amountToBuatQris;
        const expiredAt = qrisData.expired_at || qrisData.expiredAt || null;

        // 🔥 PERBAIKAN: Simpan ke spreadsheet dengan try-catch
        try {
            const saveData = {
                transaction_id: transactionId,
                order_id: orderId || 'ORD-' + Date.now(),
                amount: amountToBuatQris,
                subtotal: subtotal || 0,
                fee_admin: feeAdmin || 0,
                service_fee: serviceFee,
                total_amount: qrisData.total_amount || amountToBuatQris,
                status: qrisData.status || 'pending',
                customer_name: customer.name,
                customer_email: customer.email,
                customer_phone: customer.phone || '',
                payment_method: 'qris',
                qr_url: qrisData.qr_url || '',
                payment_url: qrisData.payment_url || '',
                is_test: (isTest !== undefined ? isTest : (BQ_MODE === 'sandbox')),
                expired_at: expiredAt,
                created_at: new Date().toISOString()
            };

            // 🔥 PERBAIKAN: Gunakan fetch dengan timeout
            const saveResponse = await fetch(`${APPS_SCRIPT_URL}?action=saveTransaction`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(saveData),
                signal: AbortSignal.timeout(10000)
            });
            
            if (!saveResponse.ok) {
                console.warn('⚠️ Failed to save to spreadsheet:', saveResponse.status);
            } else {
                console.log('✅ Transaction saved to spreadsheet');
            }
        } catch (saveError) {
            console.warn('⚠️ Failed to save to spreadsheet:', saveError.message);
            // 🔥 PERBAIKAN: Jangan gagalkan transaksi jika save gagal
        }

        res.status(200).json({
            success: true,
            data: {
                transactionId: transactionId,
                orderId: orderId || 'ORD-' + Date.now(),
                qrUrl: qrisData.qr_url || '',
                qrisImage: qrisData.qris_image || '',
                paymentUrl: qrisData.payment_url || '',
                amount: amountToBuatQris,
                subtotal: subtotal || 0,
                totalAmount: qrisData.total_amount || amountToBuatQris,
                serviceFee: serviceFee,
                feeAdmin: feeAdmin || 0,
                status: qrisData.status || 'pending',
                isTest: (isTest !== undefined ? isTest : (BQ_MODE === 'sandbox')),
                customer: customer,
                qrisMethod: qrisData.qris_method || 'qris_two',
                expiredAt: expiredAt
            }
        });

    } catch (error) {
        console.error('❌ Payment create error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// ============================================================
// PAYMENT - CHECK STATUS - PERBAIKAN
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
            transaction_id: transactionId
        });

        console.log(`📊 BuatQris status result:`, JSON.stringify(result).substring(0, 300));

        if (!result.data.success) {
            return res.status(result.status || 400).json({
                success: false,
                error: result.data.message || 'Failed to check status'
            });
        }

        const statusData = result.data.data;
        const expiredAt = statusData.expired_at || statusData.expiredAt || null;
        const serviceFee = (statusData.total_amount || statusData.amount || 0) - (statusData.amount || 0);

        res.status(200).json({
            success: true,
            data: {
                transactionId: statusData.transaction_id || transactionId,
                status: statusData.status || 'pending',
                amount: statusData.amount || 0,
                totalAmount: statusData.total_amount || 0,
                serviceFee: serviceFee > 0 ? serviceFee : 0,
                expiredAt: expiredAt,
                isTest: statusData.is_test || false
            }
        });

    } catch (error) {
        console.error('❌ Payment status error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// ============================================================
// 404 & ERROR HANDLER - PERBAIKAN
// ============================================================

// 🔥 PERBAIKAN: 404 handler yang lebih baik
app.use((req, res) => {
    console.log(`404: ${req.method} ${req.path}`);
    res.status(404).json({ 
        success: false, 
        error: 'Endpoint not found',
        path: req.path,
        method: req.method,
        timestamp: new Date().toISOString()
    });
});

// 🔥 PERBAIKAN: Error handler yang lebih baik
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ 
        success: false, 
        error: err.message || 'Internal server error',
        timestamp: new Date().toISOString()
    });
});

// ============================================================
// EXPORT
// ============================================================

module.exports = app;
