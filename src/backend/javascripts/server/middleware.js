/**
 * server/middleware.js
 * Middleware functions untuk backend lokal
 * @version 2.9.0
 */

import { logger } from './utils.js';

// Rate limit tracker
var rateLimitStore = {};

export var middleware = {

    // Auth middleware - validasi token
    auth: function(req, res, next) {
        var token = req.headers.authorization ? req.headers.authorization.replace('Bearer ', '') : null;

        if (!token) {
            res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
            return;
        }

        req.token = token;
        next();
    },

    // Role middleware (pass-through ke Apps Script)
    role: function(roles) {
        return function(req, res, next) {
            next();
        };
    },

    // Rate limit middleware
    rateLimit: function(limit, window) {
        limit = limit || 60;
        window = window || 60000;

        return function(req, res, next) {
            var ip = req.ip || req.connection.remoteAddress || '0.0.0.0';
            var now = Date.now();
            var key = ip;

            if (!rateLimitStore[key]) {
                rateLimitStore[key] = [];
            }

            rateLimitStore[key] = rateLimitStore[key].filter(function(t) {
                return t > now - window;
            });

            if (rateLimitStore[key].length >= limit) {
                logger.warn('Rate limit exceeded for ' + ip);
                res.status(429).json({
                    success: false,
                    error: 'Rate limit exceeded',
                    retryAfter: Math.ceil(window / 1000)
                });
                return;
            }

            rateLimitStore[key].push(now);
            next();
        };
    },

    // Logging middleware
    logging: function(req, res, next) {
        var start = Date.now();

        var originalJson = res.json;
        res.json = function(data) {
            var duration = Date.now() - start;
            logger.debug(req.method + ' ' + req.path + ' - ' + res.statusCode + ' (' + duration + 'ms)');
            originalJson.call(this, data);
        }.bind(res);

        next();
    },

    // Error handler middleware
    errorHandler: function(err, req, res, next) {
        logger.error('Error: ' + err.message, { stack: err.stack });

        res.status(err.status || 500).json({
            success: false,
            error: err.message || 'Internal server error'
        });
    },

    // Cors middleware
    cors: function(req, res, next) {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

        if (req.method === 'OPTIONS') {
            res.status(200).end();
            return;
        }

        next();
    },

    // Body parser
    bodyParser: function(req, res, next) {
        if (req.method === 'POST' || req.method === 'PUT') {
            var body = '';

            req.on('data', function(chunk) {
                body += chunk.toString();
            });

            req.on('end', function() {
                try {
                    if (body) {
                        req.body = JSON.parse(body);
                    } else {
                        req.body = {};
                    }
                } catch (e) {
                    req.body = {};
                }
                next();
            });
        } else {
            next();
        }
    },

    // Query parser
    queryParser: function(req, res, next) {
        var query = req.url.split('?')[1] || '';
        req.query = {};

        if (query) {
            var parts = query.split('&');
            for (var i = 0; i < parts.length; i++) {
                var pair = parts[i].split('=');
                if (pair[0]) {
                    req.query[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1] || '');
                }
            }
        }

        next();
    },

    // Params parser (dari URL path)
    paramsParser: function(req, res, next) {
        // Params akan diisi oleh router
        req.params = req.params || {};
        next();
    }
};