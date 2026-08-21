/**
 * components/controllers/productController.js
 * Product Controller - menghubungkan ke Apps Script
 * @version 2.9.0
 */

import { api } from '../../server/api.js';
import { logger } from '../../server/utils.js';

export var ProductController = {

    getAll: async function(req, res) {
        try {
            var result = await api.getProducts(req.query);
            res.json(result);
        } catch (error) {
            logger.error('Get products error', { error: error.message });
            res.status(500).json({ success: false, error: error.message });
        }
    },

    getById: async function(req, res) {
        try {
            var result = await api.getProduct(req.params.id);
            res.json(result);
        } catch (error) {
            logger.error('Get product error', { error: error.message });
            res.status(500).json({ success: false, error: error.message });
        }
    },

    create: async function(req, res) {
        try {
            var token = req.headers.authorization ? req.headers.authorization.replace('Bearer ', '') : null;

            if (!token) {
                res.status(401).json({
                    success: false,
                    error: 'Authentication required'
                });
                return;
            }

            var result = await api.createProduct(req.body, token);
            res.json(result);
        } catch (error) {
            logger.error('Create product error', { error: error.message });
            res.status(500).json({ success: false, error: error.message });
        }
    },

    update: async function(req, res) {
        try {
            var token = req.headers.authorization ? req.headers.authorization.replace('Bearer ', '') : null;

            if (!token) {
                res.status(401).json({
                    success: false,
                    error: 'Authentication required'
                });
                return;
            }

            var result = await api.updateProduct(req.params.id, req.body, token);
            res.json(result);
        } catch (error) {
            logger.error('Update product error', { error: error.message });
            res.status(500).json({ success: false, error: error.message });
        }
    },

    delete: async function(req, res) {
        try {
            var token = req.headers.authorization ? req.headers.authorization.replace('Bearer ', '') : null;

            if (!token) {
                res.status(401).json({
                    success: false,
                    error: 'Authentication required'
                });
                return;
            }

            var result = await api.deleteProduct(req.params.id, token);
            res.json(result);
        } catch (error) {
            logger.error('Delete product error', { error: error.message });
            res.status(500).json({ success: false, error: error.message });
        }
    },

    search: async function(req, res) {
        try {
            var result = await api.searchProducts(req.query);
            res.json(result);
        } catch (error) {
            logger.error('Search products error', { error: error.message });
            res.status(500).json({ success: false, error: error.message });
        }
    },

    getStats: async function(req, res) {
        try {
            var token = req.headers.authorization ? req.headers.authorization.replace('Bearer ', '') : null;

            if (!token) {
                res.status(401).json({
                    success: false,
                    error: 'Authentication required'
                });
                return;
            }

            var result = await api.getProductStats(token);
            res.json(result);
        } catch (error) {
            logger.error('Get product stats error', { error: error.message });
            res.status(500).json({ success: false, error: error.message });
        }
    },

    updateStock: async function(req, res) {
        try {
            var token = req.headers.authorization ? req.headers.authorization.replace('Bearer ', '') : null;
            var quantity = req.body.quantity;
            var reason = req.body.reason || 'Stock adjustment';

            if (!token) {
                res.status(401).json({
                    success: false,
                    error: 'Authentication required'
                });
                return;
            }

            if (!quantity) {
                res.status(400).json({
                    success: false,
                    error: 'quantity is required'
                });
                return;
            }

            var result = await api.updateStock(req.params.id, quantity, reason, token);
            res.json(result);
        } catch (error) {
            logger.error('Update stock error', { error: error.message });
            res.status(500).json({ success: false, error: error.message });
        }
    },

    getByCategory: async function(req, res) {
        try {
            var result = await api.getProductsByCategory(req.params.category, req.query);
            res.json(result);
        } catch (error) {
            logger.error('Get products by category error', { error: error.message });
            res.status(500).json({ success: false, error: error.message });
        }
    }
};