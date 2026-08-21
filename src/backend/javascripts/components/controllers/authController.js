/**
 * components/controllers/authController.js
 * Auth Controller - menghubungkan ke Apps Script
 * @version 2.9.0
 */

import { api } from '../../server/api.js';
import { logger } from '../../server/utils.js';

export var AuthController = {

    login: async function(req, res) {
        try {
            var email = req.body.email;
            var password = req.body.password;

            if (!email || !password) {
                res.status(400).json({
                    success: false,
                    error: 'Email and password are required'
                });
                return;
            }

            var result = await api.login(email, password);
            res.json(result);

        } catch (error) {
            logger.error('Login error', { error: error.message });
            res.status(500).json({
                success: false,
                error: 'Login failed: ' + error.message
            });
        }
    },

    register: async function(req, res) {
        try {
            var name = req.body.name;
            var email = req.body.email;
            var password = req.body.password;

            if (!name || !email || !password) {
                res.status(400).json({
                    success: false,
                    error: 'Name, email and password are required'
                });
                return;
            }

            var result = await api.register(req.body);
            res.json(result);

        } catch (error) {
            logger.error('Register error', { error: error.message });
            res.status(500).json({
                success: false,
                error: 'Registration failed: ' + error.message
            });
        }
    },

    getMe: async function(req, res) {
        try {
            var token = req.headers.authorization ? req.headers.authorization.replace('Bearer ', '') : null;

            if (!token) {
                res.status(401).json({
                    success: false,
                    error: 'Authentication required'
                });
                return;
            }

            var result = await api.getMe(token);
            res.json(result);

        } catch (error) {
            logger.error('Get me error', { error: error.message });
            res.status(500).json({
                success: false,
                error: 'Failed to get user: ' + error.message
            });
        }
    },

    logout: async function(req, res) {
        try {
            var token = req.headers.authorization ? req.headers.authorization.replace('Bearer ', '') : null;
            var userId = req.body.user_id;

            if (!token || !userId) {
                res.status(400).json({
                    success: false,
                    error: 'Token and user_id are required'
                });
                return;
            }

            var result = await api.logout(userId, token);
            res.json(result);

        } catch (error) {
            logger.error('Logout error', { error: error.message });
            res.status(500).json({
                success: false,
                error: 'Logout failed: ' + error.message
            });
        }
    },

    refreshToken: async function(req, res) {
        try {
            var userId = req.body.user_id;
            var refreshToken = req.body.refresh_token;

            if (!userId || !refreshToken) {
                res.status(400).json({
                    success: false,
                    error: 'user_id and refresh_token are required'
                });
                return;
            }

            var result = await api.refreshToken(userId, refreshToken);
            res.json(result);

        } catch (error) {
            logger.error('Refresh token error', { error: error.message });
            res.status(500).json({
                success: false,
                error: 'Token refresh failed: ' + error.message
            });
        }
    }
};