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
                serviceFee: statusData.admin_fee || 0,
                expiredAt: expiredAt,  // 🔥 KIRIM EXPIRED AT
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

module.exports = app;
