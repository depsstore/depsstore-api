/**
 * components/models/userModel.js
 * User Model - data layer untuk user
 * @version 2.9.0
 */

import { api } from '../../server/api.js';
import { logger } from '../../server/utils.js';

export var UserModel = {

    // Cache untuk user data
    _cache: {},

    getById: function(id) {
        // Cek cache dulu
        if (this._cache[id]) {
            logger.debug('UserModel: cache hit for ' + id);
            return Promise.resolve(this._cache[id]);
        }

        // Jika tidak ada di cache, ambil dari API
        return api.getUser(id).then(function(result) {
            if (result && result.success && result.data) {
                this._cache[id] = result.data;
                logger.debug('UserModel: cached user ' + id);
            }
            return result;
        }.bind(this));
    },

    invalidateCache: function(id) {
        delete this._cache[id];
        logger.debug('UserModel: cache invalidated for ' + id);
    },

    clearCache: function() {
        this._cache = {};
        logger.debug('UserModel: cache cleared');
    }
};