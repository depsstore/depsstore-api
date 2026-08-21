/**
 * components/models/productModel.js
 * Product Model - data layer untuk product
 * @version 2.9.0
 */

import { api } from '../../server/api.js';
import { logger } from '../../server/utils.js';

export var ProductModel = {

    _cache: {},
    _listCache: null,
    _listCacheTime: null,
    _cacheTTL: 300000, // 5 menit

    getAll: function(query) {
        // Cek cache list
        var cacheKey = JSON.stringify(query);
        if (this._listCache && this._listCache.key === cacheKey) {
            var now = Date.now();
            if (now - this._listCacheTime < this._cacheTTL) {
                logger.debug('ProductModel: list cache hit');
                return Promise.resolve(this._listCache.data);
            }
        }

        return api.getProducts(query).then(function(result) {
            if (result && result.success) {
                this._listCache = {
                    key: cacheKey,
                    data: result
                };
                this._listCacheTime = Date.now();
                logger.debug('ProductModel: list cached');
            }
            return result;
        }.bind(this));
    },

    getById: function(id) {
        if (this._cache[id]) {
            logger.debug('ProductModel: cache hit for ' + id);
            return Promise.resolve(this._cache[id]);
        }

        return api.getProduct(id).then(function(result) {
            if (result && result.success && result.data) {
                this._cache[id] = result.data;
                logger.debug('ProductModel: cached product ' + id);
            }
            return result;
        }.bind(this));
    },

    create: function(data, token) {
        // Invalidate list cache setelah create
        this._listCache = null;
        this._listCacheTime = null;
        return api.createProduct(data, token);
    },

    update: function(id, data, token) {
        // Invalidate cache untuk product yang diupdate
        delete this._cache[id];
        this._listCache = null;
        this._listCacheTime = null;
        return api.updateProduct(id, data, token);
    },

    delete: function(id, token) {
        delete this._cache[id];
        this._listCache = null;
        this._listCacheTime = null;
        return api.deleteProduct(id, token);
    },

    search: function(query) {
        return api.searchProducts(query);
    },

    getStats: function(token) {
        return api.getProductStats(token);
    },

    updateStock: function(id, quantity, reason, token) {
        delete this._cache[id];
        this._listCache = null;
        this._listCacheTime = null;
        return api.updateStock(id, quantity, reason, token);
    },

    getByCategory: function(category, query) {
        return api.getProductsByCategory(category, query);
    },

    invalidateCache: function(id) {
        delete this._cache[id];
        this._listCache = null;
        this._listCacheTime = null;
        logger.debug('ProductModel: cache invalidated');
    }
};