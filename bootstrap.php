<?php
/**
 * Точка входа для всех страниц: настройки, БД, сессия, репозиторий.
 */

$config = require __DIR__ . '/config.php';

require_once __DIR__ . '/lib/helpers.php';
require_once __DIR__ . '/lib/db.php';
require_once __DIR__ . '/lib/repository.php';
require_once __DIR__ . '/lib/auth.php';
require_once __DIR__ . '/lib/admin.php';
require_once __DIR__ . '/lib/mailer.php';
require_once __DIR__ . '/lib/webpush.php';
require_once __DIR__ . '/lib/yookassa.php';
require_once __DIR__ . '/lib/payment_gateway.php';
require_once __DIR__ . '/lib/icons.php';
require_once __DIR__ . '/lib/legal.php';

date_default_timezone_set(config('app.timezone', 'Europe/Moscow'));

if (config('app.debug')) {
    ini_set('display_errors', '1');
    error_reporting(E_ALL);
} else {
    ini_set('display_errors', '0');
}

auth_boot();

/** Ссылка на репозиторий (единый экземпляр на запрос). */
function repo(): Repository
{
    static $repository = null;
    if ($repository === null) {
        $repository = new Repository(db());
    }
    return $repository;
}
