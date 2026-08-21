/**
 * components/controllers/orderController.js
 * Order Controller - menghubungkan ke Apps Script
 * @version 2.9.0
 */

import { api } from '../../server/api.js';
import { logger } from '../../server/utils.js';

export var OrderController = {

    getAll: async function(req, res) {
        try {
            var result = await api.getOrders(req.query);
            res.json(result);
        } catch (error) {
            logger.error('Get orders error', { error: error.message });
            res.status(500).json({ success: false, error: error.message });
        }
    },

    getById: async function(req, res) {
        try {
            var result = await api.getOrder(req.params.id);
            res.json(result);
        } catch (error) {
            logger.error('Get order error', { error: error.message });
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

            var result = await api.createOrder(req.body, token);
            res.json(result);
        } catch (error) {
            logger.error('Create order error', { error: error.message });
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

            var result = await api.updateOrder(req.params.id, req.body, token);
            res.json(result);
        } catch (error) {
            logger.error('Update order error', { error: error.message });
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

            var result = await api.deleteOrder(req.params.id, token);
            res.json(result);
        } catch (error) {
            logger.error('Delete order error', { error: error.message });
            res.status(500).json({ success: false, error: error.message });
        }
    },

    updateStatus: async function(req, res) {
        try {
            var token = req.headers.authorization ? req.headers.authorization.replace('Bearer ', '') : null;
            var status = req.body.status;

            if (!token) {
                res.status(401).json({
                    success: false,
                    error: 'Authentication required'
                });
                return;
            }

            if (!status) {
                res.status(400).json({
                    success: false,
                    error: 'status is required'
                });
                return;
            }

            var result = await api.updateOrderStatus(req.params.id, status, token);
            res.json(result);
        } catch (error) {
            logger.error('Update order status error', { error: error.message });
            res.status(500).json({ success: false, error: error.message });
        }
    }
};