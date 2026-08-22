// api/index.js - TEST MINIMAL
const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.json({ message: 'TEST API BERJALAN!' });
});

app.post('/api/v2/payment/create', (req, res) => {
    res.json({ 
        success: true, 
        message: 'PAYMENT CREATE BERHASIL!',
        data: req.body 
    });
});

module.exports = app;
