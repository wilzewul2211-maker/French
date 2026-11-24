<?php
/**
 * Настройки для хостинга ByetHost (french.byethost22.com).
 *
 * Файл лежит рядом с config.php и подхватывается автоматически.
 * Содержимое — только PHP-массив без вывода, поэтому через браузер данные не видны.
 */
return [
    'app' => [
        'domain' => 'https://french.byethost22.com',
        'debug'  => false,
    ],

    // Данные из панели ByetHost → MySQL Databases.
    'db' => [
        'host'    => 'sql111.byethost22.com',
        'port'    => 3306,
        'name'    => 'b22_43433579_french',
        'user'    => 'b22_43433579',
        'pass'    => 'TC6Sn*gN$Jj7LDK',
        'charset' => 'utf8mb4',
        // Базу создают в панели, прав CREATE DATABASE у пользователя нет.
        'auto_create' => false,
    ],

    // Gmail SMTP: адрес Gmail и пароль приложения (не обычный пароль аккаунта).
    'smtp' => [
        'host'       => 'smtp.gmail.com',
        'port'       => 587,
        'secure'     => 'tls',
        'timeout'    => 15,
        'user'       => 'ddmitruk870@gmail.com',
        'pass'       => 'xnzppfkyhjyzoluc',
        'from_name'  => 'French Beauty Network',
        'from_email' => 'ddmitruk870@gmail.com',
    ],

    'admin' => [
        'email' => 'ddmitruk870@gmail.com',
    ],

    // ЮKassa (тестовый магазин): приём оплаты за объявления мастеров.
    'yookassa' => [
        'enabled'    => true,
        'shop_id'    => '1539049',
        'secret_key' => 'test_GAvR0Cijql4ExV1sU9z9GoN3RQNj28aZkP8zwfD0g0U',
        // Если пусто — используется домен сайта (app.domain) + /?tab=profile.
        'return_url' => '',
    ],
];
