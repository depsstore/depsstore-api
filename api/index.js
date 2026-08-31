// api/index.js - Vercel Serverless Function (FIXED ORDER)
// DepsStore API v3.0.0

const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();

// ============================================================
// MIDDLEWARE
// ============================================================

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============================================================
// KONFIGURASI
// ============================================================

const BQ_ACCOUNT_ID = process.env.BUATQRIS_ACCOUNT_ID;
const BQ_SECRET_TOKEN = process.env.BUATQRIS_SECRET_TOKEN;
const BQ_MODE = process.env.BUATQRIS_MODE || 'sandbox';
const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL;

console.log('🚀 DepsStore API v3.0.0');
console.log(`📊 BuatQris Mode: ${BQ_MODE}`);
console.log(`📋 Account ID: ${BQ_ACCOUNT_ID ? '✅ Set' : '❌ Not Set'}`);
console.log(`📋 Apps Script URL: ${APPS_SCRIPT_URL ? '✅ Set' : '❌ Not Set'}`);

const DEFAULT_TIMEOUT = 60000;

// ============================================================
// 🔥 HELPER: CALL APPS SCRIPT (DEFINISIKAN DULU)
// ============================================================

// api/index.js - PERBAIKAN TIMEOUT

async function callAppsScript(action, body = null) {
    if (!APPS_SCRIPT_URL) {
        console.warn('APPS_SCRIPT_URL not configured');
        return { success: false, error: 'APPS_SCRIPT_URL not configured' };
    }

    const targetUrl = APPS_SCRIPT_URL;
    console.log(`Apps Script: ${action}`);

    const options = {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify({
            action: action,
            ...body
        }),
        // 🔥 TIMEOUT 60 DETIK (lebih lama)
        signal: AbortSignal.timeout(60000)
    };

    try {
        const response = await fetch(targetUrl, options);
        const text = await response.text();
        console.log(`Response status: ${response.status}`);
        console.log(`Response preview: ${text.substring(0, 300)}`);

        if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
            console.warn('Apps Script returned HTML');
            return { success: false, error: 'Apps Script returned HTML', isHtml: true };
        }

        try {
            const jsonData = JSON.parse(text);
            console.log(`Apps Script response:`, JSON.stringify(jsonData).substring(0, 300));
            return jsonData;
        } catch (parseError) {
            console.warn('Apps Script returned invalid JSON:', text.substring(0, 200));
            return { success: false, error: 'Invalid JSON', raw: text.substring(0, 200) };
        }
    } catch (error) {
        console.warn('Apps Script error:', error.message);
        return { success: false, error: error.message };
    }
}

// ============================================================
// 🔥 HELPER: CALL APPS SCRIPT WITH RETRY
// ============================================================

async function callAppsScriptWithRetry(action, body = null, maxRetries = 3) {
    let lastError = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`📡 Attempt ${attempt}/${maxRetries}: ${action}`);
            const result = await callAppsScript(action, body);
            
            if (result && result.success) {
                return result;
            }
            
            if (result && result.error && !result.error.includes('aborted')) {
                return result;
            }
            
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
// 🔥 HELPER: CALL BUATQRIS API
// ============================================================

async function callBuatQris(params) {
    if (!BQ_ACCOUNT_ID || !BQ_SECRET_TOKEN) {
        console.error('❌ BuatQris credentials not configured!');
        return {
            status: 500,
            data: {
                success: false,
                error: 'BuatQris credentials not configured.'
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
// 🔥 ROOT & HEALTH
// ============================================================

app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'DepsStore API v3.0.0',
        mode: BQ_MODE,
        timestamp: new Date().toISOString(),
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
            buatqris: BQ_ACCOUNT_ID && BQ_SECRET_TOKEN ? 'connected' : 'disconnected',
            appsScript: APPS_SCRIPT_URL ? 'connected' : 'disconnected'
        }
    });
});

// ============================================================
// 🔥 AUTH - LOGIN
// ============================================================

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
        
        const result = await callAppsScriptWithRetry('login', { email, password });
        
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

// ============================================================
// 🔥 AUTH - REGISTER
// ============================================================

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
        
        const result = await callAppsScriptWithRetry('register', { name, email, password });
        
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
// 🔥 PRODUCTS
// ============================================================

app.get('/api/v2/products', async (req, res) => {
    try {
        console.log('📦 Fetching products...');
        const data = await callAppsScript('getProducts');

        if (data && data.success) {
            if (data.items && Array.isArray(data.items)) {
                return res.json({
                    success: true,
                    data: data.items,
                    items: data.items,
                    total: data.items.length,
                    timestamp: new Date().toISOString()
                });
            }
            if (data.data && Array.isArray(data.data)) {
                return res.json({
                    success: true,
                    data: data.data,
                    items: data.data,
                    total: data.data.length,
                    timestamp: new Date().toISOString()
                });
            }
        }

        res.status(500).json({
            success: false,
            error: 'Products data unavailable',
            detail: data.error || 'No products found',
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
// 🔥 ORDERS
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
            res.status(500).json({
                success: false,
                error: 'Orders data unavailable',
                detail: data.error || 'Invalid response',
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
// 🔥 STATS
// ============================================================

app.get('/api/v2/stats', async (req, res) => {
    try {
        console.log('📊 Fetching stats...');
        const data = await callAppsScript('getStats');

        if (data && data.success && data.data) {
            return res.json(data);
        }

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
// 🔥 PAYMENT - CREATE QRIS
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

        const result = await callBuatQris({
            action: 'api_create_qris',
            amount: String(Math.floor(amountToBuatQris)),
            description: orderDescription.substring(0, 100),
            qris_method: qrisMethod || 'qris_two',
            fee_by: feeBy || 'user',
            callback_url: callbackUrl || 'https://depsstore-api.vercel.app/api/webhook/buatqris',
            test: (isTest !== undefined ? isTest : (BQ_MODE === 'sandbox')) ? '1' : '0'
        });

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

        // Simpan ke spreadsheet
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
            transaction_id: transactionId
        });

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
// 🔥 WEBHOOK - BUATQRIS
// ============================================================

// api/index.js - WEBHOOK HANDLER (SIMPLIFIED)

app.post('/api/webhook/buatqris', async (req, res) => {
    console.log('Webhook received');
    console.log('Body:', JSON.stringify(req.body));
    
    try {
        const data = req.body;
        
        if (!data || !data.transaction_id) {
            return res.status(400).json({
                success: false,
                error: 'transaction_id is required'
            });
        }
        
        // 🔥 SIMPAN KE APPS SCRIPT DENGAN TIMEOUT 60 DETIK
        const saveData = {
            transaction_id: data.transaction_id,
            order_id: data.order_id || 'ORD-' + Date.now(),
            amount: parseFloat(data.amount || data.total || 0),
            subtotal: parseFloat(data.subtotal || data.amount || 0),
            fee_admin: parseFloat(data.fee_admin || data.feeAdmin || 0),
            service_fee: parseFloat(data.service_fee || data.serviceFee || 0),
            total_amount: parseFloat(data.total_amount || data.total || data.amount || 0),
            status: data.status || 'pending',
            customer_name: data.customer_name || data.customer || 'Customer',
            customer_email: data.customer_email || data.email || '',
            customer_phone: data.customer_phone || data.phone || '',
            payment_method: data.payment_method || 'qris',
            qr_url: data.qr_url || '',
            payment_url: data.payment_url || '',
            is_test: data.is_test || data.isTest || false,
            expired_at: data.expired_at || data.expiredAt || '',
            created_at: data.created_at || new Date().toISOString()
        };
        
        console.log('Sending to Apps Script:', JSON.stringify(saveData));
        
        // 🔥 KIRIM KE APPS SCRIPT - TAPI JANGAN TUNGGU RESPONSE
        // Kirim async, langsung response ke BuatQris
        try {
            await fetch(APPS_SCRIPT_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    action: 'saveTransaction',
                    ...saveData
                }),
                signal: AbortSignal.timeout(60000)
            });
        } catch (fetchError) {
            console.error('Fetch error (non-critical):', fetchError.message);
            // Tetap lanjutkan response sukses
        }
        
        // 🔥 RESPONSE CEPAT KE BUATQRIS
        res.json({
            success: true,
            message: 'Webhook received',
            data: {
                transaction_id: data.transaction_id,
                status: 'processing'
            }
        });
        
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ============================================================
// 🔥 404 & ERROR HANDLER
// ============================================================

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
