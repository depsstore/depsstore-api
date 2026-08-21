/**
 * server/routes.js
 * Route definitions - proxy ke Apps Script
 * @version 2.9.0
 */

import { api } from './api.js';
import { logger } from './utils.js';
import { AuthController } from '../components/controllers/authController.js';
import { ProductController } from '../components/controllers/productController.js';
import { OrderController } from '../components/controllers/orderController.js';
import { CustomerController } from '../components/controllers/customerController.js';
import { SupportController } from '../components/controllers/supportController.js';

export var router = {

    controllers: {
        auth: AuthController,
        product: ProductController,
        order: OrderController,
        customer: CustomerController,
        support: SupportController
    },

    routes: [],

    init: function() {
        logger.info('Router initialized');
        this.registerRoutes();
    },

    registerRoutes: function() {

        this.register('GET', '/api/v2', this.handleApiRoot);
        this.register('GET', '/api/v2/', this.handleApiRoot);

        // 🔥 TEST ENDPOINT - Cek koneksi ke Apps Script
        this.register('GET', '/api/v2/test', this.handleTest);

        // Auth
        this.register('POST', '/api/v2/auth/login', this.controllers.auth.login);
        this.register('POST', '/api/v2/auth/register', this.controllers.auth.register);
        this.register('GET', '/api/v2/auth/me', this.controllers.auth.getMe);
        this.register('POST', '/api/v2/auth/logout', this.controllers.auth.logout);
        this.register('POST', '/api/v2/auth/refresh', this.controllers.auth.refreshToken);

        // Products
        this.register('GET', '/api/v2/products', this.controllers.product.getAll);
        this.register('GET', '/api/v2/products/:id', this.controllers.product.getById);
        this.register('POST', '/api/v2/products', this.controllers.product.create);
        this.register('PUT', '/api/v2/products/:id', this.controllers.product.update);
        this.register('DELETE', '/api/v2/products/:id', this.controllers.product.delete);
        this.register('GET', '/api/v2/products/search', this.controllers.product.search);
        this.register('GET', '/api/v2/products/stats', this.controllers.product.getStats);
        this.register('PUT', '/api/v2/products/:id/stock', this.controllers.product.updateStock);
        this.register('GET', '/api/v2/products/category/:category', this.controllers.product.getByCategory);

        // Orders
        this.register('GET', '/api/v2/orders', this.controllers.order.getAll);
        this.register('GET', '/api/v2/orders/:id', this.controllers.order.getById);
        this.register('POST', '/api/v2/orders', this.controllers.order.create);
        this.register('PUT', '/api/v2/orders/:id', this.controllers.order.update);
        this.register('DELETE', '/api/v2/orders/:id', this.controllers.order.delete);
        this.register('PUT', '/api/v2/orders/:id/status', this.controllers.order.updateStatus);

        // Customers
        this.register('GET', '/api/v2/customers', this.controllers.customer.getAll);
        this.register('GET', '/api/v2/customers/:id', this.controllers.customer.getById);
        this.register('POST', '/api/v2/customers', this.controllers.customer.create);
        this.register('PUT', '/api/v2/customers/:id', this.controllers.customer.update);
        this.register('DELETE', '/api/v2/customers/:id', this.controllers.customer.delete);

        // Support
        this.register('GET', '/api/v2/support', this.controllers.support.getAll);
        this.register('GET', '/api/v2/support/:id', this.controllers.support.getById);
        this.register('POST', '/api/v2/support', this.controllers.support.create);
        this.register('PUT', '/api/v2/support/:id', this.controllers.support.update);
        this.register('DELETE', '/api/v2/support/:id', this.controllers.support.delete);

        // Dashboard
        this.register('GET', '/api/v2/dashboard', this.handleDashboard);
        this.register('GET', '/api/v2/dashboard/revenue', this.handleRevenue);
        this.register('GET', '/api/v2/dashboard/orders/stats', this.handleOrderStats);

        // Backup
        this.register('GET', '/api/v2/backups', this.handleBackups);
        this.register('POST', '/api/v2/backups', this.handleCreateBackup);
        this.register('GET', '/api/v2/backups/stats', this.handleBackupStats);
        this.register('DELETE', '/api/v2/backups/:id', this.handleDeleteBackup);
        this.register('POST', '/api/v2/backups/:id/restore', this.handleRestoreBackup);

        // Logs
        this.register('GET', '/api/v2/logs', this.handleLogs);
        this.register('GET', '/api/v2/logs/errors', this.handleErrors);
        this.register('GET', '/api/v2/logs/stats', this.handleLogStats);
        this.register('POST', '/api/v2/logs/cleanup', this.handleLogCleanup);

        // Health
        this.register('GET', '/api/v2/system/health', this.handleHealth);

        logger.success('All routes registered (' + this.routes.length + ' routes)');
    },

    register: function(method, path, handler) {
        this.routes.push({
            method: method,
            path: path,
            handler: handler
        });
    },

    findRoute: function(path, method) {
        for (var i = 0; i < this.routes.length; i++) {
            var route = this.routes[i];
            if (route.method !== method) continue;

            var pattern = route.path.replace(/:[^/]+/g, '([^/]+)');
            var regex = new RegExp('^' + pattern + '$');

            if (regex.test(path)) {
                return route;
            }
        }
        return null;
    },

    extractParams: function(path, routePath) {
        var params = {};
        var pathParts = path.split('/').filter(function(p) { return p; });
        var routeParts = routePath.split('/').filter(function(p) { return p; });

        for (var i = 0; i < routeParts.length; i++) {
            if (routeParts[i].charAt(0) === ':') {
                var paramName = routeParts[i].substring(1);
                params[paramName] = pathParts[i] || '';
            }
        }
        return params;
    },

    // Handle request
    handle: async function(req, res) {
        var path = req.path || '/';
        var method = req.method || 'GET';

        // Cari route
        var route = this.findRoute(path, method);

        if (!route) {
            res.status(404).json({
                success: false,
                error: 'Endpoint not found',
                path: path,
                method: method
            });
            return;
        }

        // Extract params
        req.params = this.extractParams(path, route.path);

        // Execute handler
        try {
            await route.handler(req, res);
        } catch (error) {
            logger.error('Route handler error: ' + error.message);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                message: error.message
            });
        }
    },

    // ============================================================
    // HANDLERS
    // ============================================================

    handleApiRoot: async function(req, res) {
        res.json({
            success: true,
            message: 'DepsStore API v2',
            version: '2.9.0',
            endpoints: {
                health: '/api/v2/system/health',
                test: '/api/v2/test',
                login: '/api/v2/auth/login',
                register: '/api/v2/auth/register',
                products: '/api/v2/products',
                orders: '/api/v2/orders',
                customers: '/api/v2/customers',
                users: '/api/v2/users',
                support: '/api/v2/support',
                dashboard: '/api/v2/dashboard',
                backups: '/api/v2/backups',
                logs: '/api/v2/logs'
            },
            timestamp: new Date().toISOString()
        });
    },

    handleTest: async function(req, res) {
        try {
            var result = await api.testConnection();
            res.json({
                success: true,
                message: 'Apps Script connection test',
                result: result,
                config: {
                    appsScriptUrl: api.baseUrl
                },
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message,
                stack: error.stack
            });
        }
    },

    handleHealth: async function(req, res) {
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            version: '2.9.0',
            environment: 'development',
            appsScriptUrl: api.baseUrl
        });
    },

    handleDashboard: async function(req, res) {
        try {
            var token = req.headers.authorization ? req.headers.authorization.replace('Bearer ', '') : null;
            var result = await api.getDashboard(token);
            res.json(result);
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    },

    handleRevenue: async function(req, res) {
        try {
            var token = req.headers.authorization ? req.headers.authorization.replace('Bearer ', '') : null;
            var period = req.query.period || 'monthly';
            var result = await api.getRevenueData(period, token);
            res.json(result);
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    },

    handleOrderStats: async function(req, res) {
        try {
            var token = req.headers.authorization ? req.headers.authorization.replace('Bearer ', '') : null;
            var result = await api.getOrderStats(token);
            res.json(result);
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    },

    handleBackups: async function(req, res) {
        try {
            var token = req.headers.authorization ? req.headers.authorization.replace('Bearer ', '') : null;
            var limit = req.query.limit || 20;
            var result = await api.getBackups(limit, token);
            res.json(result);
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    },

    handleCreateBackup: async function(req, res) {
        try {
            var token = req.headers.authorization ? req.headers.authorization.replace('Bearer ', '') : null;
            var description = req.body.description || 'Manual backup';
            var result = await api.createBackup(description, token);
            res.json(result);
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    },

    handleBackupStats: async function(req, res) {
        try {
            var token = req.headers.authorization ? req.headers.authorization.replace('Bearer ', '') : null;
            var result = await api.getBackupStats(token);
            res.json(result);
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    },

    handleDeleteBackup: async function(req, res) {
        try {
            var token = req.headers.authorization ? req.headers.authorization.replace('Bearer ', '') : null;
            var result = await api.deleteBackup(req.params.id, token);
            res.json(result);
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    },

    handleRestoreBackup: async function(req, res) {
        try {
            var token = req.headers.authorization ? req.headers.authorization.replace('Bearer ', '') : null;
            var result = await api.restoreBackup(req.params.id, token);
            res.json(result);
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    },

    handleLogs: async function(req, res) {
        try {
            var token = req.headers.authorization ? req.headers.authorization.replace('Bearer ', '') : null;
            var limit = req.query.limit || 100;
            var offset = req.query.offset || 0;
            var level = req.query.level || null;
            var result = await api.getLogs(limit, offset, level, token);
            res.json(result);
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    },

    handleErrors: async function(req, res) {
        try {
            var token = req.headers.authorization ? req.headers.authorization.replace('Bearer ', '') : null;
            var limit = req.query.limit || 100;
            var result = await api.getErrors(limit, token);
            res.json(result);
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    },

    handleLogStats: async function(req, res) {
        try {
            var token = req.headers.authorization ? req.headers.authorization.replace('Bearer ', '') : null;
            var result = await api.getLogStats(token);
            res.json(result);
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    },

    handleLogCleanup: async function(req, res) {
        try {
            var token = req.headers.authorization ? req.headers.authorization.replace('Bearer ', '') : null;
            var maxKeep = req.body.maxKeep || 50000;
            var result = await api.cleanupLogs(maxKeep, token);
            res.json(result);
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
};