/**
 * server/api.js
 * API Service untuk komunikasi dengan Apps Script
 * @version 2.9.0
 */

import { config } from './config.js';
import { logger } from './utils.js';

export class AppsScriptAPI {
    constructor() {
        this.baseUrl = config.appsScriptUrl;
        this.timeout = config.appsScriptTimeout || 30000;
    }

    /**
     * Kirim request ke Apps Script menggunakan fetch
     */
    async request(method, path, data, token) {
        try {
            var url = this.baseUrl + path;
            var options = {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                timeout: this.timeout
            };

            if (token) {
                options.headers['Authorization'] = 'Bearer ' + token;
            }

            if (data && (method === 'POST' || method === 'PUT')) {
                options.body = JSON.stringify(data);
            }

            logger.debug('AppsScript Request: ' + method + ' ' + path);

            var response = await fetch(url, options);

            // 🔥 Cek response content-type
            var contentType = response.headers.get('content-type');
            var result;

            if (contentType && contentType.includes('application/json')) {
                result = await response.json();
            } else {
                // 🔥 Jika bukan JSON, baca sebagai text
                var text = await response.text();
                logger.error('AppsScript returned non-JSON response', {
                    status: response.status,
                    contentType: contentType,
                    preview: text.substring(0, 200)
                });

                // 🔥 Cek jika response adalah HTML (error dari Apps Script)
                if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
                    throw new Error('Apps Script returned HTML page. Please check the Apps Script deployment URL.');
                }

                throw new Error('Invalid response format: ' + text.substring(0, 100));
            }

            logger.debug('AppsScript Response: ' + method + ' ' + path + ' - ' + response.status);

            return result;

        } catch (error) {
            logger.error('AppsScript Error: ' + method + ' ' + path, {
                message: error.message,
                stack: error.stack
            });

            throw new Error('AppsScript service error: ' + error.message);
        }
    }

    // ============================================================
    // TEST - Cek koneksi ke Apps Script
    // ============================================================

    async testConnection() {
        try {
            var url = this.baseUrl + '/api/v2/products?limit=1';
            var response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                },
                timeout: this.timeout
            });

            var contentType = response.headers.get('content-type');
            var result;

            if (contentType && contentType.includes('application/json')) {
                result = await response.json();
            } else {
                var text = await response.text();
                return {
                    success: false,
                    status: response.status,
                    contentType: contentType,
                    preview: text.substring(0, 200),
                    isHTML: text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')
                };
            }

            return {
                success: true,
                status: response.status,
                data: result
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    // ============================================================
    // USERS
    // ============================================================

    async getUsers(query, token) {
        query = query || {};
        var qs = new URLSearchParams(query).toString();
        var path = '/api/v2/users' + (qs ? '?' + qs : '');
        return this.request('GET', path, null, token);
    }

    async getUser(id, token) {
        return this.request('GET', '/api/v2/users/' + id, null, token);
    }

    async updateUser(id, data, token) {
        return this.request('PUT', '/api/v2/users/' + id, data, token);
    }

    async deleteUser(id, token) {
        return this.request('DELETE', '/api/v2/users/' + id, null, token);
    }

    // ============================================================
    // SETTINGS
    // ============================================================

    async getSettings(key, token) {
        return this.request('GET', '/api/v2/settings?key=' + key, null, token);
    }

    async updateSettings(key, value, token) {
        return this.request('POST', '/api/v2/settings', { key: key, value: value }, token);
    }

    // ============================================================
    // AUTH
    // ============================================================

    async login(email, password) {
        return this.request('POST', '/api/v2/auth/login', { email: email, password: password });
    }

    async register(data) {
        return this.request('POST', '/api/v2/auth/register', data);
    }

    async getMe(token) {
        return this.request('GET', '/api/v2/auth/me', null, token);
    }

    async logout(userId, token) {
        return this.request('POST', '/api/v2/auth/logout', { user_id: userId }, token);
    }

    async refreshToken(userId, refreshToken) {
        return this.request('POST', '/api/v2/auth/refresh', {
            user_id: userId,
            refresh_token: refreshToken
        });
    }

    // ============================================================
    // PRODUCTS
    // ============================================================

    async getProducts(query) {
        query = query || {};
        var qs = new URLSearchParams(query).toString();
        var path = '/api/v2/products' + (qs ? '?' + qs : '');
        return this.request('GET', path);
    }

    async getProduct(id) {
        return this.request('GET', '/api/v2/products/' + id);
    }

    async createProduct(data, token) {
        return this.request('POST', '/api/v2/products', data, token);
    }

    async updateProduct(id, data, token) {
        return this.request('PUT', '/api/v2/products/' + id, data, token);
    }

    async deleteProduct(id, token) {
        return this.request('DELETE', '/api/v2/products/' + id, null, token);
    }

    async searchProducts(query) {
        var qs = new URLSearchParams(query).toString();
        return this.request('GET', '/api/v2/products/search?' + qs);
    }

    async getProductStats(token) {
        return this.request('GET', '/api/v2/products/stats', null, token);
    }

    async updateStock(id, quantity, reason, token) {
        return this.request('PUT', '/api/v2/products/' + id + '/stock', {
            quantity: quantity,
            reason: reason
        }, token);
    }

    async getProductsByCategory(category, query) {
        query = query || {};
        var qs = new URLSearchParams(query).toString();
        var path = '/api/v2/products/category/' + category + (qs ? '?' + qs : '');
        return this.request('GET', path);
    }

    // ============================================================
    // ORDERS
    // ============================================================

    async getOrders(query) {
        query = query || {};
        var qs = new URLSearchParams(query).toString();
        var path = '/api/v2/orders' + (qs ? '?' + qs : '');
        return this.request('GET', path);
    }

    async getOrder(id) {
        return this.request('GET', '/api/v2/orders/' + id);
    }

    async createOrder(data, token) {
        return this.request('POST', '/api/v2/orders', data, token);
    }

    async updateOrder(id, data, token) {
        return this.request('PUT', '/api/v2/orders/' + id, data, token);
    }

    async deleteOrder(id, token) {
        return this.request('DELETE', '/api/v2/orders/' + id, null, token);
    }

    async updateOrderStatus(id, status, token) {
        return this.request('PUT', '/api/v2/orders/' + id + '/status', { status: status }, token);
    }

    // ============================================================
    // CUSTOMERS
    // ============================================================

    async getCustomers(query) {
        query = query || {};
        var qs = new URLSearchParams(query).toString();
        var path = '/api/v2/customers' + (qs ? '?' + qs : '');
        return this.request('GET', path);
    }

    async getCustomer(id) {
        return this.request('GET', '/api/v2/customers/' + id);
    }

    async createCustomer(data, token) {
        return this.request('POST', '/api/v2/customers', data, token);
    }

    async updateCustomer(id, data, token) {
        return this.request('PUT', '/api/v2/customers/' + id, data, token);
    }

    async deleteCustomer(id, token) {
        return this.request('DELETE', '/api/v2/customers/' + id, null, token);
    }

    // ============================================================
    // SUPPORT
    // ============================================================

    async getSupports(query) {
        query = query || {};
        var qs = new URLSearchParams(query).toString();
        var path = '/api/v2/support' + (qs ? '?' + qs : '');
        return this.request('GET', path);
    }

    async getSupport(id) {
        return this.request('GET', '/api/v2/support/' + id);
    }

    async createSupport(data, token) {
        return this.request('POST', '/api/v2/support', data, token);
    }

    async updateSupport(id, data, token) {
        return this.request('PUT', '/api/v2/support/' + id, data, token);
    }

    async deleteSupport(id, token) {
        return this.request('DELETE', '/api/v2/support/' + id, null, token);
    }

    // ============================================================
    // DASHBOARD
    // ============================================================

    async getDashboard(token) {
        return this.request('GET', '/api/v2/dashboard', null, token);
    }

    async getRevenueData(period, token) {
        period = period || 'monthly';
        return this.request('GET', '/api/v2/dashboard/revenue?period=' + period, null, token);
    }

    async getOrderStats(token) {
        return this.request('GET', '/api/v2/dashboard/orders/stats', null, token);
    }

    // ============================================================
    // BACKUP
    // ============================================================

    async getBackups(limit, token) {
        limit = limit || 20;
        return this.request('GET', '/api/v2/backups?limit=' + limit, null, token);
    }

    async createBackup(description, token) {
        return this.request('POST', '/api/v2/backups', { description: description }, token);
    }

    async deleteBackup(id, token) {
        return this.request('DELETE', '/api/v2/backups/' + id, null, token);
    }

    async restoreBackup(id, token) {
        return this.request('POST', '/api/v2/backups/' + id + '/restore', null, token);
    }

    async getBackupStats(token) {
        return this.request('GET', '/api/v2/backups/stats', null, token);
    }

    // ============================================================
    // LOGS
    // ============================================================

    async getLogs(limit, offset, level, token) {
        limit = limit || 100;
        offset = offset || 0;
        var path = '/api/v2/logs?limit=' + limit + '&offset=' + offset;
        if (level) path += '&level=' + level;
        return this.request('GET', path, null, token);
    }

    async getErrors(limit, token) {
        limit = limit || 100;
        return this.request('GET', '/api/v2/logs/errors?limit=' + limit, null, token);
    }

    async getLogStats(token) {
        return this.request('GET', '/api/v2/logs/stats', null, token);
    }

    async cleanupLogs(maxKeep, token) {
        return this.request('POST', '/api/v2/logs/cleanup', { maxKeep: maxKeep }, token);
    }
}

// Singleton instance
export var api = new AppsScriptAPI();