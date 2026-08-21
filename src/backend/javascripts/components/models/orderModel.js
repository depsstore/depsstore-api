/**
 * components/models/orderModel.js
 * Order Model - data layer untuk order
 * @version 2.9.0
 */

import { api } from '../../server/api.js';
import { logger } from '../../server/utils.js';

export var OrderModel = {

    _cache: {},
    _listCache: null,
    _listCacheTime: null,
    _cacheTTL: 300000,

    getAll: function(query) {
        var cacheKey = JSON.stringify(query);
        if (this._listCache && this._listCache.key === cacheKey) {
            var now = Date.now();
            if (now - this._listCacheTime < this._cacheTTL) {
                logger.debug('OrderModel: list cache hit');
                return Promise.resolve(this._listCache.data);
            }
        }

        return api.getOrders(query).then(function(result) {
            if (result && result.success) {
                this._listCache = {
                    key: cacheKey,
                    data: result
                };
                this._listCacheTime = Date.now();
                logger.debug('OrderModel: list cached');
            }
            return result;
        }.bind(this));
    },

    getById: function(id) {
        if (this._cache[id]) {
            logger.debug('OrderModel: cache hit for ' + id);
            return Promise.resolve(this._cache[id]);
        }

        return api.getOrder(id).then(function(result) {
            if (result && result.success && result.data) {
                this._cache[id] = result.data;
                logger.debug('OrderModel: cached order ' + id);
            }
            return result;
        }.bind(this));
    },

    create: function(data, token) {
        this._listCache = null;
        this._listCacheTime = null;
        return api.createOrder(data, token);
    },

    update: function(id, data, token) {
        delete this._cache[id];
        this._listCache = null;
        this._listCacheTime = null;
        return api.updateOrder(id, data, token);
    },

    delete: function(id, token) {
        delete this._cache[id];
        this._listCache = null;
        this._listCacheTime = null;
        return api.deleteOrder(id, token);
    },

    updateStatus: function(id, status, token) {
        delete this._cache[id];
        this._listCache = null;
        this._listCacheTime = null;
        return api.updateOrderStatus(id, status, token);
    }
};