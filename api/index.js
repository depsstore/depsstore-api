// api/index.js - Vercel Serverless Function
// DepsStore API v2 - Complete Backend Integration
// Version: 2.9.4 - NO DUMMY DATA

const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();

// ============================================================
// MIDDLEWARE
// ============================================================

app.use(cors());
app.use(express.json());

// ============================================================
// KONFIGURASI
// ============================================================

const BQ_ACCOUNT_ID = process.env.BUATQRIS_ACCOUNT_ID;
const BQ_SECRET_TOKEN = process.env.BUATQRIS_SECRET_TOKEN;
const BQ_MODE = process.env.BUATQRIS_MODE || 'sandbox';
const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbyi-CMq3E2f1-99UA8kRoD7YobdoflwJEE-ZjksAKnhcZ62x0q21TjiDytxfFUvr0mC/exec';

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Call BuatQris API
 */
async function callBuatQris(params) {
    if (!BQ_ACCOUNT_ID || !BQ_SECRET_TOKEN) {
        console.error('BuatQris credentials not configured');
        return {
            status: 500,
            data: {
                success: false,
                error: 'BuatQris credentials not configured'
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

    console.log(`Calling BuatQris API with action: ${params.action}`);

    try {
        const response = await fetch(url, options);
        const data = await response.json();
        console.log('BuatQris response:', JSON.stringify(data).substring(0, 500));

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
        console.error('BuatQris error:', error);
        return {
            status: 500,
            data: {
                success: false,
                error: error.message
            }
        };
    }
}

/**
 * Call Google Apps Script dengan timeout
 */
async function callAppsScript(action, body = null) {
    const targetUrl = `${APPS_SCRIPT_URL}?action=${action}`;
    console.log('📡 Calling Apps Script URL:', targetUrl);
    
    const options = {
        method: body ? 'POST' : 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(15000)
    };
    
    if (body) {
        options.body = JSON.stringify(body);
        console.log('📦 Body:', JSON.stringify(body).substring(0, 500));
    }
    
    try {
        const response = await fetch(targetUrl, options);
        const text = await response.text();
        console.log('📥 Response status:', response.status);
        console.log('📥 Response preview:', text.substring(0, 300));
        
        if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
            console.error('❌ Apps Script returned HTML instead of JSON');
            return { 
                success: false, 
                error: 'Apps Script returned HTML',
                isHtml: true
            };
        }
        
        try {
            return JSON.parse(text);
        } catch (parseError) {
            console.error('❌ Failed to parse JSON:', parseError.message);
            return { 
                success: false, 
                error: 'Invalid JSON response',
                raw: text.substring(0, 200)
            };
        }
    } catch (error) {
        console.error('❌ Fetch error:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Generate transaction ID
 */
function generateTransactionId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 4; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result + '-' + Date.now().toString(36).toUpperCase();
}

/**
 * Generate order ID
 */
function generateOrderId() {
    return 'ORD-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4).toUpperCase();
}

// ============================================================
// ROOT & HEALTH ENDPOINTS
// ============================================================

app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'DepsStore API v2',
        version: '2.9.4',
        timestamp: new Date().toISOString()
    });
});

app.get('/api/v2', (req, res) => {
    res.json({
        success: true,
        message: 'DepsStore API v2',
        version: '2.9.4',
        timestamp: new Date().toISOString()
    });
});

app.get('/api/v2/system/health', (req, res) => {
    res.json({
        success: true,
        data: {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            version: '2.9.4',
            environment: process.env.NODE_ENV || 'development'
        }
    });
});

app.get('/api/v2/test', (req, res) => {
    res.json({
        success: true,
        message: 'Test endpoint berhasil',
        timestamp: new Date().toISOString()
    });
});

// ============================================================
// SYSTEM INFO - DARI APPS SCRIPT (TANPA DUMMY)
// ============================================================

app.get('/api/v2/system/info', async (req, res) => {
    try {
        const data = await callAppsScript('getSystemInfo');
        
        if (data && data.success && data.data) {
            res.json(data);
        } else {
            res.status(500).json({
                success: false,
                error: 'Failed to fetch system info',
                detail: data.error || 'Apps Script returned invalid response'
            });
        }
    } catch (error) {
        console.error('System info error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ============================================================
// AUTH ENDPOINTS - DARI APPS SCRIPT
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

        const data = await callAppsScript('login', { email, password });
        res.json(data);
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

        const data = await callAppsScript('register', { name, email, password });
        res.json(data);
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// SUPPORT ENDPOINTS - DARI APPS SCRIPT
// ============================================================

app.post('/api/v2/support', async (req, res) => {
    try {
        const data = await callAppsScript('createSupport', req.body);
        res.json(data);
    } catch (error) {
        console.error('Support error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// STATS & DASHBOARD - DARI APPS SCRIPT (TANPA DUMMY)
// ============================================================

app.get('/api/v2/stats', async (req, res) => {
    try {
        console.log('Fetching stats from Apps Script...');
        const data = await callAppsScript('getStats');
        console.log('Stats data:', data);
        
        if (data && data.success && data.data) {
            res.json(data);
        } else {
            res.status(500).json({
                success: false,
                error: 'Failed to fetch stats',
                detail: data.error || 'Apps Script returned invalid response'
            });
        }
    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.get('/api/v2/dashboard', async (req, res) => {
    try {
        const data = await callAppsScript('getStats');
        
        if (data && data.success && data.data) {
            res.json({
                success: true,
                data: data.data
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Failed to fetch dashboard data',
                detail: data.error || 'Apps Script returned invalid response'
            });
        }
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ============================================================
// PRODUCTS - DARI APPS SCRIPT (TANPA DUMMY)
// ============================================================

app.get('/api/v2/products', async (req, res) => {
    try {
        console.log('📦 Fetching products from Apps Script...');
        const data = await callAppsScript('getProducts');
        console.log('📦 Products data:', JSON.stringify(data).substring(0, 500));
        
        if (data && data.success && data.data && Array.isArray(data.data)) {
            res.json(data);
        } else {
            res.status(500).json({
                success: false,
                error: 'Failed to fetch products',
                detail: data.error || 'Apps Script returned invalid response'
            });
        }
    } catch (error) {
        console.error('Products error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ============================================================
// ORDERS - GET - DARI APPS SCRIPT (TANPA DUMMY)
// ============================================================

app.get('/api/v2/orders', async (req, res) => {
    try {
        console.log('📋 Fetching orders from Apps Script...');
        const data = await callAppsScript('getOrders');
        res.setHeader('Cache-Control', 'no-store');
        
        if (data && data.success && data.items && Array.isArray(data.items)) {
            console.log(`✅ Orders fetched: ${data.items.length} items`);
            res.json(data);
        } else {
            res.status(500).json({
                success: false,
                error: 'Failed to fetch orders',
                detail: data.error || 'Apps Script returned invalid response'
            });
        }
    } catch (error) {
        console.error('❌ Orders error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ============================================================
// ORDERS - CREATE
// ============================================================

app.post('/api/v2/orders', async (req, res) => {
    try {
        const data = req.body;
        console.log('Create order request:', JSON.stringify(data));

        if (!data.total_price && !data.amount) {
            return res.status(400).json({
                success: false,
                error: 'total_price or amount is required'
            });
        }

        const formattedData = {
            transaction_id: data.transaction_id || generateTransactionId(),
            order_id: data.order_id || generateOrderId(),
            order_number: data.order_number || data.order_id || generateOrderId(),
            amount: parseFloat(data.total_price || data.amount || 0),
            subtotal: parseFloat(data.subtotal || data.total_price || 0),
            total_price: parseFloat(data.total_price || data.amount || 0),
            status: data.status || 'pending',
            payment_status: data.payment_status || data.status || 'pending',
            customer_name: data.customer_name || data.customer?.name || 'Customer',
            customer_email: data.customer_email || data.customer?.email || '',
            customer_phone: data.customer_phone || data.customer?.phone || '',
            payment_method: data.payment_method || 'qris',
            qr_url: data.qr_url || '',
            payment_url: data.payment_url || '',
            is_test: data.is_test || false,
            notes: data.notes || data.description || '',
            product_id: data.product_id || '',
            quantity: data.quantity || 1,
            created_at: data.created_at || new Date().toISOString(),
            expired_at: data.expired_at || '',
            customer: data.customer || {},
            fee_admin: data.fee_admin || 0,
            service_fee: data.service_fee || 0
        };

        console.log('Formatted data:', JSON.stringify(formattedData));

        const response = await fetch(`${APPS_SCRIPT_URL}?action=saveTransaction`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formattedData)
        });

        const result = await response.json();
        console.log('Apps Script response:', JSON.stringify(result));

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error || 'Failed to save order',
                detail: result
            });
        }

        let qrisResult = null;
        if (data.createQris !== false) {
            try {
                qrisResult = await callBuatQris({
                    action: 'api_create_qris',
                    account_id: BQ_ACCOUNT_ID,
                    secret_token: BQ_SECRET_TOKEN,
                    amount: String(formattedData.amount),
                    description: data.description || 'Order ' + formattedData.order_id,
                    qris_method: 'qris_two',
                    fee_by: 'user',
                    test: formattedData.is_test ? '1' : '0'
                });
                console.log('QRIS created:', JSON.stringify(qrisResult));
            } catch (qrisError) {
                console.warn('QRIS creation failed:', qrisError.message);
            }
        }

        res.json({
            success: true,
            message: 'Order created successfully',
            data: {
                orderId: formattedData.order_id,
                transactionId: formattedData.transaction_id,
                ...result.data,
                qris: qrisResult?.data?.data || null
            }
        });

    } catch (error) {
        console.error('Create order error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ============================================================
// PAYMENT ENDPOINTS
// ============================================================

app.post('/api/v2/payment/create', async (req, res) => {
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

        const amountToBuatQris = subtotal || amount || 0;
        const feeAdminValue = feeAdmin || 0;
        
        const result = await callBuatQris({
            action: 'api_create_qris',
            account_id: BQ_ACCOUNT_ID,
            secret_token: BQ_SECRET_TOKEN,
            amount: String(amountToBuatQris),
            description: description || 'Pembayaran Order ' + orderId,
            qris_method: qrisMethod || 'qris_two',
            fee_by: feeBy || 'user',
            callback_url: callbackUrl || 'https://depsstore-api.vercel.app/api/webhook/buatqris',
            test: (isTest !== undefined ? isTest : (BQ_MODE === 'sandbox')) ? '1' : '0'
        });

        if (!result.data.success || !result.data.data) {
            return res.status(result.status || 400).json({
                success: false,
                error: result.data.error || 'BuatQris API error',
                detail: result.data.raw || null
            });
        }

        const qrisData = result.data.data;
        const transactionId = qrisData.transaction_id;

        const statusResult = await callBuatQris({
            action: 'api_check_status',
            account_id: BQ_ACCOUNT_ID,
            secret_token: BQ_SECRET_TOKEN,
            transaction_id: transactionId
        });

        if (!statusResult.data.success || !statusResult.data.data) {
            return res.status(statusResult.status || 400).json({
                success: false,
                error: statusResult.data.error || 'Failed to check status',
                detail: statusResult.data.raw || null
            });
        }

        const statusData = statusResult.data.data;
        const expiredAt = statusData.expired_at || new Date(Date.now() + 15 * 60 * 1000).toISOString();
        const serviceFee = (qrisData.total_amount || amountToBuatQris) - amountToBuatQris;
        const totalAmount = amountToBuatQris + feeAdminValue + serviceFee;

        // Simpan ke spreadsheet via Apps Script
        try {
            const formattedData = {
                transaction_id: transactionId,
                amount: amountToBuatQris,
                subtotal: amountToBuatQris,
                fee_admin: feeAdminValue,
                service_fee: serviceFee,
                total_amount: totalAmount,
                status: qrisData.status || 'pending',
                customer_name: customer?.name || 'Customer',
                customer_email: customer?.email || '',
                customer_phone: customer?.phone || '',
                payment_method: 'qris',
                qr_url: qrisData.qr_url || '',
                payment_url: qrisData.payment_url || '',
                is_test: (isTest !== undefined ? isTest : (BQ_MODE === 'sandbox')),
                created_at: new Date().toISOString(),
                expired_at: expiredAt,
                order_id: orderId || 'ORD-' + Date.now()
            };

            await fetch(`${APPS_SCRIPT_URL}?action=saveTransaction`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formattedData)
            });
            console.log('✅ Transaction saved to spreadsheet');
        } catch (saveError) {
            console.warn('⚠️ Failed to save to spreadsheet:', saveError.message);
        }

        res.json({
            success: true,
            data: {
                transactionId: transactionId,
                orderId: orderId || 'ORD-' + Date.now(),
                qrUrl: qrisData.qr_url || '',
                qrisImage: qrisData.qris_image || '',
                paymentUrl: qrisData.payment_url || '',
                amount: amountToBuatQris,
                subtotal: amountToBuatQris,
                totalAmount: totalAmount,
                serviceFee: serviceFee,
                feeAdmin: feeAdminValue,
                status: qrisData.status || 'pending',
                isTest: (isTest !== undefined ? isTest : (BQ_MODE === 'sandbox')),
                customer: customer,
                qrisMethod: qrisData.qris_method || 'qris_two',
                expiredAt: expiredAt
            }
        });

    } catch (error) {
        console.error('Payment create error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

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
                serviceFee: (statusData.total_amount || statusData.amount) - statusData.amount,
                isTest: statusData.is_test || false,
                expiredAt: statusData.expired_at || null
            }
        });

    } catch (error) {
        console.error('Payment status error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// WEBHOOK
// ============================================================

app.post('/api/webhook/buatqris', async (req, res) => {
    try {
        const data = req.body;
        console.log('Webhook received:', JSON.stringify(data));

        if (!data.transaction_id) {
            return res.status(400).json({
                success: false,
                error: 'transaction_id is required'
            });
        }

        // Update status di spreadsheet
        try {
            const response = await fetch(`${APPS_SCRIPT_URL}?action=updateOrderStatus`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    transaction_id: data.transaction_id,
                    status: data.status || 'success',
                    updated_at: new Date().toISOString()
                })
            });
            const result = await response.json();
            console.log('Status update result:', result);
        } catch (updateError) {
            console.warn('Failed to update status:', updateError.message);
            // Tidak fatal
        }

        res.json({
            success: true,
            message: 'Webhook processed',
            data: {
                transaction_id: data.transaction_id,
                status: data.status || 'success'
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
// 404 & ERROR HANDLER
// ============================================================

app.use((req, res) => {
    console.log(`404: ${req.method} ${req.path}`);
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        path: req.path,
        method: req.method
    });
});

app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        success: false,
        error: err.message || 'Internal server error'
    });
});

// ============================================================
// EXPORT
// ============================================================

module.exports = app;
