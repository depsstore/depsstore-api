/**
 * server/utils.js
 * Utility functions untuk backend lokal
 * @version 2.9.0
 */

import { config } from './config.js';

// ============================================================
// LOGGER
// ============================================================

export const logger = {
    log: function(level, message, data) {
        var timestamp = new Date().toISOString();
        var prefix = '[' + timestamp + '] [' + level + ']';

        console.log(prefix, message);
        if (data && typeof data === 'object') {
            console.log('  Data:', JSON.stringify(data, null, 2));
        }
    },

    info: function(message, data) {
        this.log('INFO', message, data);
    },

    error: function(message, data) {
        this.log('ERROR', message, data);
    },

    warn: function(message, data) {
        this.log('WARN', message, data);
    },

    debug: function(message, data) {
        if (config.env === 'development') {
            this.log('DEBUG', message, data);
        }
    },

    success: function(message, data) {
        this.log('SUCCESS', message, data);
    }
};

// ============================================================
// VALIDATOR
// ============================================================

export const validator = {
    isEmail: function(email) {
        return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);
    },

    isPhone: function(phone) {
        return /^(\+62|62|0)8[1-9][0-9]{6,12}$/.test(phone);
    },

    isUUID: function(uuid) {
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(uuid);
    },

    isURL: function(url) {
        try {
            new URL(url);
            return true;
        } catch (e) {
            return false;
        }
    },

    sanitize: function(input) {
        if (!input) return '';
        return String(input)
            .trim()
            .replace(/<[^>]*>/g, '')
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    },

    validateAll: function(data, rules) {
        var errors = {};
        var isValid = true;

        for (var field in rules) {
            var value = data[field];
            var rule = rules[field];

            if (rule.required && (!value || value === '')) {
                errors[field] = field + ' is required';
                isValid = false;
            }

            if (rule.min && value && value.length < rule.min) {
                errors[field] = field + ' must be at least ' + rule.min + ' characters';
                isValid = false;
            }

            if (rule.max && value && value.length > rule.max) {
                errors[field] = field + ' must not exceed ' + rule.max + ' characters';
                isValid = false;
            }

            if (rule.email && value && !this.isEmail(value)) {
                errors[field] = 'Invalid email format';
                isValid = false;
            }
        }

        return {
            valid: isValid,
            errors: errors
        };
    }
};

// ============================================================
// HELPER
// ============================================================

export const helper = {
    generateId: function() {
        return Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
    },

    getTimestamp: function() {
        return new Date().toISOString();
    },

    formatCurrency: function(amount) {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR'
        }).format(amount);
    },

    sleep: function(ms) {
        return new Promise(function(resolve) {
            setTimeout(resolve, ms);
        });
    },

    deepClone: function(obj) {
        return JSON.parse(JSON.stringify(obj));
    },

    isEmpty: function(obj) {
        if (!obj) return true;
        if (Array.isArray(obj)) return obj.length === 0;
        return Object.keys(obj).length === 0;
    },

    getValueByPath: function(obj, path, defaultValue) {
        defaultValue = defaultValue || null;
        var parts = path.split('.');
        var current = obj;

        for (var i = 0; i < parts.length; i++) {
            if (current === null || current === undefined || typeof current !== 'object') {
                return defaultValue;
            }
            current = current[parts[i]];
        }

        return current !== undefined ? current : defaultValue;
    }
};
}
};