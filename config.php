<?php
/**
 * French Beauty Network — конфигурация приложения.
 * Чистый PHP без фреймворков и сборки.
 *
 * Секреты загружаются из FRENCH_CONFIG_FILE или C:\laragon\etc\french.local.php.
 */

$config = [
    'app' => [
        'name'        => 'French Beauty Network',
        // Базовый адрес сайта (используется в письмах и редиректах).
        'domain'      => 'http://french.test',
        'timezone'    => 'Europe/Moscow',
        'debug'       => false,
    ],

    // MySQL (по умолчанию — Laragon: root без пароля).
    'db' => [
        'host'    => '127.0.0.1',
        'port'    => 3306,
        'name'    => 'french',
        'user'    => 'root',
        'pass'    => '',
        'charset' => 'utf8mb4',
        'auto_create' => true,
    ],

    // Почта для кода подтверждения регистрации (Gmail SMTP).
    'smtp' => [
        'host'       => 'smtp.gmail.com',
        'port'       => 587,
        'secure'     => 'tls',
        'timeout'    => 15,
        'user'       => '',
        'pass'       => '',
        'from_name'  => 'French Beauty Network',
        'from_email' => '',
    ],

    'admin' => [
        'email' => '',
    ],

    'payments' => [
        // Платёжный шлюз отключён — его подключает владелец проекта отдельно.
        'enabled' => false,
    ],

    // ЮKassa (YooKassa) — приём оплаты за объявления мастеров.
    'yookassa' => [
        'enabled'    => true,
        'shop_id'    => '',
        'secret_key' => '',
        // Если пусто — берётся домен сайта + /?tab=profile&payment=return
        'return_url' => '',
    ],

    'fees' => [
        // Комиссия платформы, % от стоимости услуги.
        'platform_percent' => 4,
    ],

    // Push-уведомления (PWA). Ключи VAPID создаются автоматически и хранятся в БД.
    'push' => [
        // Контакт для push-сервисов (например, mailto:admin@example.com).
        // Если пусто — берётся email администратора.
        'subject' => '',
        // Время жизни уведомления на устройстве, сек (по умолчанию 28 дней).
        'ttl'     => 2419200,
    ],

    'session' => [
        'name' => 'french_session',
    ],
];

$externalConfigFile = getenv('FRENCH_CONFIG_FILE')
    ?: dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'etc' . DIRECTORY_SEPARATOR . 'french.local.php';
$localConfigFile = is_file($externalConfigFile)
    ? $externalConfigFile
    : __DIR__ . '/config.local.php';
if (is_file($localConfigFile)) {
    $local = require $localConfigFile;
    if (is_array($local)) {
        $config = array_replace_recursive($config, $local);
    }
}

define('APP_ROOT', __DIR__);
define('FRENCH_CONFIG', $config);

return $config;
