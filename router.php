<?php
/**
 * Router for PHP built-in server — mimics .htaccess rules.
 * Usage: php -S 127.0.0.1:8080 -t . router.php
 */
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$uri = ltrim($uri, '/');

// Existing files/dirs are served directly.
if ($uri !== '' && file_exists(__DIR__ . '/' . $uri)) {
    return false;
}

// /api/* -> api.php
if (preg_match('#^api(/.*)?$#', $uri)) {
    require __DIR__ . '/api.php';
    return true;
}

// Everything else -> index.php
require __DIR__ . '/index.php';
return true;
