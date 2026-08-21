/**
 * server-express.js - Backend dengan Express
 * Jalankan: node server-express.js
 */

import express from 'express';
import cors from 'cors';
import axios from 'axios';

const app = express();
const PORT = 3000;

// Middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// URL Apps Script
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz7PscckTNRF6nvp7Rrsi21luQJu67pt8Yq4lITtLDxvL_3n8Nlwoxuto-0jPQ2ATGV/exec';

// Root
app.get('/', (req, res) => {
    res.json({
        message: 'DepsStore Backend',
        version: '2.9.0',
        endpoints: {
            health: '/api/v2/system/health',
            products: '/api/v2/products',
            login: '/api/v2/auth/login'
        }
    });
});

// Proxy semua request ke Apps Script
app.all('/api/v2/*', async(req, res) => {
    try {
        const path = req.path.replace('/api/v2', '');
        const url = APPS_SCRIPT_URL + '/api/v2' + path;

        console.log('Proxy:', req.method, url);

        const response = await axios({
            method: req.method,
            url: url,
            data: req.body,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': req.headers.authorization || ''
            },
            timeout: 30000
        });

        res.json(response.data);

    } catch (error) {
        console.error('Proxy error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message,
            details: error.response ? .data || null
        });
    }
});

// Start server
app.listen(PORT, () => {
    console.log('========================================');
    console.log('DepsStore Backend running!');
    console.log('Port    : ' + PORT);
    console.log('URL     : http://localhost:' + PORT);
    console.log('========================================');
});