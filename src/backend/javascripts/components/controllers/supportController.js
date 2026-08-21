/**
 * components/controllers/supportController.js
 * Support Controller - menghubungkan ke Apps Script
 * @version 2.9.0
 */

import { api } from '../../server/api.js';
import { logger } from '../../server/utils.js';

export var SupportController = {

    getAll: async function(req, res) {
        try {
            var result = await api.getSupports(req.query);
            res.json(result);
        } catch (error) {
            logger.error('Get supports error', { error: error.message });
            res.status(500).json({ success: false, error: error.message });
        }
    },

    getById: async function(req, res) {
        try {
            var result = await api.getSupport(req.params.id);
            res.json(result);
        } catch (error) {
            logger.error('Get support error', { error: error.message });
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

            var result = await api.createSupport(req.body, token);
            res.json(result);
        } catch (error) {
            logger.error('Create support error', { error: error.message });
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

            var result = await api.updateSupport(req.params.id, req.body, token);
            res.json(result);
        } catch (error) {
            logger.error('Update support error', { error: error.message });
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

            var result = await api.deleteSupport(req.params.id, token);
            res.json(result);
        } catch (error) {
            logger.error('Delete support error', { error: error.message });
            res.status(500).json({ success: false, error: error.message });
        }
    }
};