/**
 * components/controllers/customerController.js
 * Customer Controller - menghubungkan ke Apps Script
 * @version 2.9.0
 */

import { api } from '../../server/api.js';
import { logger } from '../../server/utils.js';

export var CustomerController = {

    getAll: async function(req, res) {
        try {
            var result = await api.getCustomers(req.query);
            res.json(result);
        } catch (error) {
            logger.error('Get customers error', { error: error.message });
            res.status(500).json({ success: false, error: error.message });
        }
    },

    getById: async function(req, res) {
        try {
            var result = await api.getCustomer(req.params.id);
            res.json(result);
        } catch (error) {
            logger.error('Get customer error', { error: error.message });
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

            var result = await api.createCustomer(req.body, token);
            res.json(result);
        } catch (error) {
            logger.error('Create customer error', { error: error.message });
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

            var result = await api.updateCustomer(req.params.id, req.body, token);
            res.json(result);
        } catch (error) {
            logger.error('Update customer error', { error: error.message });
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

            var result = await api.deleteCustomer(req.params.id, token);
            res.json(result);
        } catch (error) {
            logger.error('Delete customer error', { error: error.message });
            res.status(500).json({ success: false, error: error.message });
        }
    }
};