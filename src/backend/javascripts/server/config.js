/**
 * server/config.js
 * Configuration untuk backend lokal
 * @version 2.9.0
 */

export const config = {
    env: 'development',
    port: 3000,

    // 🔥 GANTI DENGAN URL APPS SCRIPT YANG BARU
    appsScriptUrl: 'https://script.google.com/macros/s/AKfycbyi-CMq3E2f1-99UA8kRoD7YobdoflwJEE-ZjksAKnhcZ62x0q21TjiDytxfFUvr0mC/exec',
    appsScriptTimeout: 30000,

    jwtSecret: 'depsstore-secret-key-change-me',
    jwtExpiry: 7200,
    cacheTTL: 300,
    logLevel: 'info'
};