<?php
/**
 * Подключение к MySQL (PDO) и автоматическое создание схемы.
 */

/** PDO-соединение (единственное на запрос). */
function db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $db   = config('db');
    $dsn  = sprintf('mysql:host=%s;port=%d;charset=%s', $db['host'], $db['port'], $db['charset']);
    $opts = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ];

    if (!empty($db['auto_create'])) {
        $root = new PDO($dsn, $db['user'], $db['pass'], $opts);
        $root->exec('CREATE DATABASE IF NOT EXISTS `' . str_replace('`', '', $db['name']) . '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
    }

    $pdo = new PDO($dsn . ';dbname=' . $db['name'], $db['user'], $db['pass'], $opts);
    db_init_schema($pdo);

    return $pdo;
}

/** Создание таблиц, если их ещё нет. */
function db_init_schema(PDO $pdo): void
{
    static $done = false;
    if ($done) {
        return;
    }
    $done = true;

    $tables = [];

    $tables[] = "CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(40) NOT NULL PRIMARY KEY,
        email VARCHAR(190) NOT NULL,
        phone VARCHAR(40) NULL,
        name VARCHAR(190) NULL,
        role VARCHAR(16) NOT NULL DEFAULT 'client',
        avatar MEDIUMTEXT NULL,
        city VARCHAR(120) NULL,
        district VARCHAR(120) NULL,
        balance DECIMAL(12,2) NOT NULL DEFAULT 0,
        bio TEXT NULL,
        specialty VARCHAR(160) NULL,
        rating DECIMAL(3,2) NULL,
        review_count INT NOT NULL DEFAULT 0,
        client_rating DECIMAL(3,2) NULL,
        client_review_count INT NOT NULL DEFAULT 0,
        address VARCHAR(255) NULL,
        experience_years INT NULL,
        inn VARCHAR(20) NULL,
        allow_delayed_payment TINYINT(1) NOT NULL DEFAULT 0,
        privacy_settings JSON NULL,
        password_hash VARCHAR(255) NULL,
        login VARCHAR(64) NULL,
        is_blocked TINYINT(1) NOT NULL DEFAULT 0,
        listing_free_until VARCHAR(40) NULL,
        created_at VARCHAR(40) NULL,
        UNIQUE KEY users_email_unique (email),
        UNIQUE KEY users_login_unique (login)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";

    $tables[] = "CREATE TABLE IF NOT EXISTS services (
        id VARCHAR(40) NOT NULL PRIMARY KEY,
        master_id VARCHAR(40) NOT NULL,
        title VARCHAR(190) NULL,
        category VARCHAR(120) NULL,
        price DECIMAL(12,2) NOT NULL DEFAULT 0,
        duration_mins INT NOT NULL DEFAULT 60,
        description TEXT NULL,
        KEY services_master_idx (master_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";

    $tables[] = "CREATE TABLE IF NOT EXISTS works (
        id VARCHAR(40) NOT NULL PRIMARY KEY,
        master_id VARCHAR(40) NOT NULL,
        master_name VARCHAR(190) NULL,
        master_avatar MEDIUMTEXT NULL,
        master_specialty VARCHAR(160) NULL,
        master_district VARCHAR(120) NULL,
        title VARCHAR(190) NULL,
        description TEXT NULL,
        category VARCHAR(120) NULL,
        images JSON NULL,
        price DECIMAL(12,2) NULL,
        likes_count INT NOT NULL DEFAULT 0,
        comments_count INT NOT NULL DEFAULT 0,
        paid_until VARCHAR(40) NULL,
        archived TINYINT NOT NULL DEFAULT 0,
        expired_notified TINYINT NOT NULL DEFAULT 0,
        created_at VARCHAR(40) NULL,
        KEY works_master_idx (master_id),
        KEY works_paid_idx (paid_until)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";

    $tables[] = "CREATE TABLE IF NOT EXISTS posts (
        id VARCHAR(40) NOT NULL PRIMARY KEY,
        author_id VARCHAR(40) NOT NULL,
        author_name VARCHAR(190) NULL,
        author_avatar MEDIUMTEXT NULL,
        author_role VARCHAR(16) NULL,
        author_specialty VARCHAR(160) NULL,
        title VARCHAR(190) NULL,
        content TEXT NULL,
        images JSON NULL,
        tags JSON NULL,
        likes_count INT NOT NULL DEFAULT 0,
        comments_count INT NOT NULL DEFAULT 0,
        created_at VARCHAR(40) NULL,
        KEY posts_author_idx (author_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";

    $tables[] = "CREATE TABLE IF NOT EXISTS comments (
        id VARCHAR(40) NOT NULL PRIMARY KEY,
        seq BIGINT NOT NULL AUTO_INCREMENT,
        target_id VARCHAR(40) NOT NULL,
        target_type VARCHAR(16) NOT NULL,
        author_id VARCHAR(40) NULL,
        author_name VARCHAR(190) NULL,
        author_avatar MEDIUMTEXT NULL,
        author_role VARCHAR(16) NULL,
        text TEXT NULL,
        created_at VARCHAR(40) NULL,
        UNIQUE KEY comments_seq (seq),
        KEY comments_target_idx (target_id, target_type)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";

    $tables[] = "CREATE TABLE IF NOT EXISTS likes (
        user_id VARCHAR(40) NOT NULL,
        target_id VARCHAR(40) NOT NULL,
        target_type VARCHAR(16) NOT NULL,
        created_at VARCHAR(40) NULL,
        PRIMARY KEY (user_id, target_id, target_type),
        KEY likes_target_idx (target_id, target_type)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";

    $tables[] = "CREATE TABLE IF NOT EXISTS bookings (
        id VARCHAR(40) NOT NULL PRIMARY KEY,
        client_id VARCHAR(40) NOT NULL,
        client_name VARCHAR(190) NULL,
        client_phone VARCHAR(40) NULL,
        client_avatar MEDIUMTEXT NULL,
        master_id VARCHAR(40) NOT NULL,
        master_name VARCHAR(190) NULL,
        master_avatar MEDIUMTEXT NULL,
        master_address VARCHAR(255) NULL,
        service_id VARCHAR(40) NULL,
        service_title VARCHAR(190) NULL,
        service_price DECIMAL(12,2) NOT NULL DEFAULT 0,
        service_duration_mins INT NOT NULL DEFAULT 0,
        booking_date VARCHAR(40) NULL,
        time_slot VARCHAR(16) NULL,
        status VARCHAR(40) NOT NULL DEFAULT 'pending',
        is_paid TINYINT(1) NOT NULL DEFAULT 0,
        platform_fee DECIMAL(12,2) NOT NULL DEFAULT 0,
        master_payout DECIMAL(12,2) NOT NULL DEFAULT 0,
        master_inn VARCHAR(20) NULL,
        payment_method VARCHAR(20) NULL,
        payment_id VARCHAR(80) NULL,
        payment_url VARCHAR(500) NULL,
        payment_status VARCHAR(40) NULL,
        fiscal_receipt JSON NULL,
        allow_delayed_payment TINYINT(1) NOT NULL DEFAULT 0,
        payment_deadline VARCHAR(40) NULL,
        client_completed TINYINT(1) NOT NULL DEFAULT 0,
        client_completed_at VARCHAR(40) NULL,
        master_completed TINYINT(1) NOT NULL DEFAULT 0,
        master_completed_at VARCHAR(40) NULL,
        client_survey JSON NULL,
        master_survey JSON NULL,
        dispute JSON NULL,
        notes TEXT NULL,
        client_rating DECIMAL(3,2) NULL,
        master_rating DECIMAL(3,2) NULL,
        review_text TEXT NULL,
        created_at VARCHAR(40) NULL,
        KEY bookings_client_idx (client_id),
        KEY bookings_master_idx (master_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";

    $tables[] = "CREATE TABLE IF NOT EXISTS chats (
        id VARCHAR(40) NOT NULL PRIMARY KEY,
        booking_id VARCHAR(40) NULL,
        client_id VARCHAR(40) NOT NULL,
        client_name VARCHAR(190) NULL,
        client_avatar MEDIUMTEXT NULL,
        master_id VARCHAR(40) NOT NULL,
        master_name VARCHAR(190) NULL,
        master_avatar MEDIUMTEXT NULL,
        service_title VARCHAR(190) NULL,
        booking_date VARCHAR(40) NULL,
        booking_time_slot VARCHAR(16) NULL,
        booking_price DECIMAL(12,2) NOT NULL DEFAULT 0,
        last_message TEXT NULL,
        last_message_time VARCHAR(40) NULL,
        last_message_sender_id VARCHAR(40) NULL,
        unread_count_client INT NOT NULL DEFAULT 0,
        unread_count_master INT NOT NULL DEFAULT 0,
        KEY chats_client_idx (client_id),
        KEY chats_master_idx (master_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";

    $tables[] = "CREATE TABLE IF NOT EXISTS messages (
        id VARCHAR(40) NOT NULL PRIMARY KEY,
        seq BIGINT NOT NULL AUTO_INCREMENT,
        chat_id VARCHAR(40) NOT NULL,
        sender_id VARCHAR(40) NULL,
        sender_name VARCHAR(190) NULL,
        sender_avatar MEDIUMTEXT NULL,
        text TEXT NULL,
        image_url MEDIUMTEXT NULL,
        read_at VARCHAR(40) NULL,
        created_at VARCHAR(40) NULL,
        UNIQUE KEY messages_seq (seq),
        KEY messages_chat_idx (chat_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";

    $tables[] = "CREATE TABLE IF NOT EXISTS schedules (
        master_id VARCHAR(40) NOT NULL PRIMARY KEY,
        working_days JSON NULL,
        time_slots JSON NULL,
        off_dates JSON NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";

    $tables[] = "CREATE TABLE IF NOT EXISTS transactions (
        id VARCHAR(40) NOT NULL PRIMARY KEY,
        type VARCHAR(40) NOT NULL,
        booking_id VARCHAR(40) NULL,
        user_id VARCHAR(40) NULL,
        user_name VARCHAR(190) NULL,
        amount DECIMAL(12,2) NOT NULL DEFAULT 0,
        commission_fee DECIMAL(12,2) NULL,
        description TEXT NULL,
        payment_ref VARCHAR(80) NULL,
        payout_destination VARCHAR(255) NULL,
        status VARCHAR(24) NULL,
        created_at VARCHAR(40) NULL,
        KEY transactions_user_idx (user_id),
        KEY transactions_ref_idx (payment_ref)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";

    $tables[] = "CREATE TABLE IF NOT EXISTS reviews (
        id VARCHAR(40) NOT NULL PRIMARY KEY,
        booking_id VARCHAR(40) NULL,
        author_id VARCHAR(40) NULL,
        author_name VARCHAR(190) NULL,
        author_avatar MEDIUMTEXT NULL,
        author_role VARCHAR(16) NULL,
        target_user_id VARCHAR(40) NULL,
        target_user_name VARCHAR(190) NULL,
        rating DECIMAL(3,2) NULL,
        text TEXT NULL,
        created_at VARCHAR(40) NULL,
        KEY reviews_target_idx (target_user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";

    $tables[] = "CREATE TABLE IF NOT EXISTS email_codes (
        email VARCHAR(190) NOT NULL PRIMARY KEY,
        code VARCHAR(12) NOT NULL,
        expires_at BIGINT NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";

    $tables[] = "CREATE TABLE IF NOT EXISTS events (
        id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(40) NULL,
        type VARCHAR(60) NOT NULL,
        payload JSON NULL,
        created_at VARCHAR(40) NULL,
        KEY events_user_idx (user_id, id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";

    $tables[] = "CREATE TABLE IF NOT EXISTS admin_site_settings (
        id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
        settings_json JSON NOT NULL,
        revision INT UNSIGNED NOT NULL DEFAULT 0,
        updated_by VARCHAR(190) NULL,
        updated_at VARCHAR(40) NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";

    $tables[] = "CREATE TABLE IF NOT EXISTS admin_site_history (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        revision INT UNSIGNED NOT NULL,
        action VARCHAR(24) NOT NULL DEFAULT 'publish',
        summary VARCHAR(255) NOT NULL,
        admin_email VARCHAR(190) NOT NULL,
        settings_json JSON NOT NULL,
        created_at VARCHAR(40) NOT NULL,
        KEY admin_history_revision_idx (revision),
        KEY admin_history_created_idx (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";

    $tables[] = "CREATE TABLE IF NOT EXISTS work_subscriptions (
        id VARCHAR(40) NOT NULL PRIMARY KEY,
        master_id VARCHAR(40) NOT NULL,
        plan VARCHAR(16) NOT NULL DEFAULT 'single',
        slots_total INT NOT NULL DEFAULT 1,
        slots_used INT NOT NULL DEFAULT 0,
        amount DECIMAL(12,2) NOT NULL DEFAULT 0,
        paid_until VARCHAR(40) NULL,
        payment_id VARCHAR(80) NULL,
        status VARCHAR(24) NOT NULL DEFAULT 'pending',
        created_at VARCHAR(40) NULL,
        KEY work_subs_master_idx (master_id),
        KEY work_subs_payment_idx (payment_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";

    $tables[] = "CREATE TABLE IF NOT EXISTS support_tickets (
        id VARCHAR(40) NOT NULL PRIMARY KEY,
        user_id VARCHAR(40) NOT NULL,
        user_name VARCHAR(190) NULL,
        user_role VARCHAR(16) NULL,
        subject VARCHAR(190) NULL,
        status VARCHAR(24) NOT NULL DEFAULT 'open',
        last_message TEXT NULL,
        last_message_time VARCHAR(40) NULL,
        unread_for_support INT NOT NULL DEFAULT 0,
        unread_for_user INT NOT NULL DEFAULT 0,
        created_at VARCHAR(40) NULL,
        KEY support_tickets_user_idx (user_id),
        KEY support_tickets_status_idx (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";

    $tables[] = "CREATE TABLE IF NOT EXISTS support_messages (
        id VARCHAR(40) NOT NULL PRIMARY KEY,
        seq BIGINT NOT NULL AUTO_INCREMENT,
        ticket_id VARCHAR(40) NOT NULL,
        sender_id VARCHAR(40) NULL,
        sender_name VARCHAR(190) NULL,
        sender_role VARCHAR(16) NULL,
        text TEXT NULL,
        created_at VARCHAR(40) NULL,
        UNIQUE KEY support_messages_seq (seq),
        KEY support_messages_ticket_idx (ticket_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";

    $tables[] = "CREATE TABLE IF NOT EXISTS push_subscriptions (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(40) NOT NULL,
        endpoint_hash CHAR(64) NOT NULL,
        endpoint VARCHAR(500) NOT NULL,
        public_key VARCHAR(190) NOT NULL,
        auth_key VARCHAR(64) NOT NULL,
        content_encoding VARCHAR(32) NULL,
        user_agent VARCHAR(190) NULL,
        created_at VARCHAR(40) NULL,
        UNIQUE KEY push_subs_endpoint (endpoint_hash),
        KEY push_subs_user_idx (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";

    $tables[] = "CREATE TABLE IF NOT EXISTS push_vapid (
        id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
        public_key VARCHAR(190) NOT NULL,
        private_key MEDIUMTEXT NOT NULL,
        created_at VARCHAR(40) NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";

    foreach ($tables as $sql) {
        $pdo->exec($sql);
    }

    // CREATE TABLE IF NOT EXISTS не обновляет уже существующие таблицы.
    // На хостинге могли остаться таблицы старой версии — добавляем недостающие столбцы.
    $schemaColumns = [
        'users' => [
            'phone'                 => 'VARCHAR(40) NULL',
            'name'                  => 'VARCHAR(190) NULL',
            'role'                  => "VARCHAR(16) NOT NULL DEFAULT 'client'",
            'avatar'                => 'MEDIUMTEXT NULL',
            'city'                  => 'VARCHAR(120) NULL',
            'district'              => 'VARCHAR(120) NULL',
            'balance'               => 'DECIMAL(12,2) NOT NULL DEFAULT 0',
            'bio'                   => 'TEXT NULL',
            'specialty'             => 'VARCHAR(160) NULL',
            'rating'                => 'DECIMAL(3,2) NULL',
            'review_count'          => 'INT NOT NULL DEFAULT 0',
            'client_rating'         => 'DECIMAL(3,2) NULL',
            'client_review_count'   => 'INT NOT NULL DEFAULT 0',
            'address'               => 'VARCHAR(255) NULL',
            'experience_years'      => 'INT NULL',
            'inn'                   => 'VARCHAR(20) NULL',
            'allow_delayed_payment' => 'TINYINT(1) NOT NULL DEFAULT 0',
            'privacy_settings'      => 'JSON NULL',
            'password_hash'         => 'VARCHAR(255) NULL',
            'login'                 => 'VARCHAR(64) NULL',
            'is_blocked'            => 'TINYINT(1) NOT NULL DEFAULT 0',
            'listing_free_until'    => 'VARCHAR(40) NULL',
            'created_at'            => 'VARCHAR(40) NULL',
        ],
        'services' => [
            'master_id'     => 'VARCHAR(40) NOT NULL',
            'title'         => 'VARCHAR(190) NULL',
            'category'      => 'VARCHAR(120) NULL',
            'price'         => 'DECIMAL(12,2) NOT NULL DEFAULT 0',
            'duration_mins' => 'INT NOT NULL DEFAULT 60',
            'description'   => 'TEXT NULL',
        ],
        'works' => [
            'master_id'        => 'VARCHAR(40) NOT NULL',
            'master_name'      => 'VARCHAR(190) NULL',
            'master_avatar'    => 'MEDIUMTEXT NULL',
            'master_specialty' => 'VARCHAR(160) NULL',
            'master_district'  => 'VARCHAR(120) NULL',
            'title'            => 'VARCHAR(190) NULL',
            'description'      => 'TEXT NULL',
            'category'         => 'VARCHAR(120) NULL',
            'images'           => 'JSON NULL',
            'price'            => 'DECIMAL(12,2) NULL',
            'likes_count'      => 'INT NOT NULL DEFAULT 0',
            'comments_count'   => 'INT NOT NULL DEFAULT 0',
            'paid_until'       => 'VARCHAR(40) NULL',
            'archived'         => 'TINYINT NOT NULL DEFAULT 0',
            'expired_notified' => 'TINYINT NOT NULL DEFAULT 0',
            'created_at'       => 'VARCHAR(40) NULL',
        ],
        'posts' => [
            'author_id'        => 'VARCHAR(40) NOT NULL',
            'author_name'      => 'VARCHAR(190) NULL',
            'author_avatar'    => 'MEDIUMTEXT NULL',
            'author_role'      => 'VARCHAR(16) NULL',
            'author_specialty' => 'VARCHAR(160) NULL',
            'title'            => 'VARCHAR(190) NULL',
            'content'          => 'TEXT NULL',
            'images'           => 'JSON NULL',
            'tags'             => 'JSON NULL',
            'likes_count'      => 'INT NOT NULL DEFAULT 0',
            'comments_count'   => 'INT NOT NULL DEFAULT 0',
            'created_at'       => 'VARCHAR(40) NULL',
        ],
        'comments' => [
            'target_id'    => 'VARCHAR(40) NOT NULL',
            'target_type'  => 'VARCHAR(16) NOT NULL',
            'author_id'    => 'VARCHAR(40) NULL',
            'author_name'  => 'VARCHAR(190) NULL',
            'author_avatar'=> 'MEDIUMTEXT NULL',
            'author_role'  => 'VARCHAR(16) NULL',
            'text'         => 'TEXT NULL',
            'created_at'   => 'VARCHAR(40) NULL',
        ],
        'likes' => [
            'user_id'    => 'VARCHAR(40) NOT NULL',
            'target_id'  => 'VARCHAR(40) NOT NULL',
            'target_type'=> 'VARCHAR(16) NOT NULL',
            'created_at' => 'VARCHAR(40) NULL',
        ],
        'bookings' => [
            'client_id'             => 'VARCHAR(40) NOT NULL',
            'client_name'           => 'VARCHAR(190) NULL',
            'client_phone'          => 'VARCHAR(40) NULL',
            'client_avatar'         => 'MEDIUMTEXT NULL',
            'master_id'             => 'VARCHAR(40) NOT NULL',
            'master_name'           => 'VARCHAR(190) NULL',
            'master_avatar'         => 'MEDIUMTEXT NULL',
            'master_address'        => 'VARCHAR(255) NULL',
            'service_id'            => 'VARCHAR(40) NULL',
            'service_title'         => 'VARCHAR(190) NULL',
            'service_price'         => 'DECIMAL(12,2) NOT NULL DEFAULT 0',
            'service_duration_mins' => 'INT NOT NULL DEFAULT 0',
            'booking_date'          => 'VARCHAR(40) NULL',
            'time_slot'             => 'VARCHAR(16) NULL',
            'status'                => "VARCHAR(40) NOT NULL DEFAULT 'pending'",
            'is_paid'               => 'TINYINT(1) NOT NULL DEFAULT 0',
            'platform_fee'          => 'DECIMAL(12,2) NOT NULL DEFAULT 0',
            'master_payout'         => 'DECIMAL(12,2) NOT NULL DEFAULT 0',
            'master_inn'            => 'VARCHAR(20) NULL',
            'payment_method'        => 'VARCHAR(20) NULL',
            'payment_id'            => 'VARCHAR(80) NULL',
            'payment_url'           => 'VARCHAR(500) NULL',
            'payment_status'        => 'VARCHAR(40) NULL',
            'fiscal_receipt'        => 'JSON NULL',
            'allow_delayed_payment' => 'TINYINT(1) NOT NULL DEFAULT 0',
            'payment_deadline'      => 'VARCHAR(40) NULL',
            'client_completed'      => 'TINYINT(1) NOT NULL DEFAULT 0',
            'client_completed_at'   => 'VARCHAR(40) NULL',
            'master_completed'      => 'TINYINT(1) NOT NULL DEFAULT 0',
            'master_completed_at'   => 'VARCHAR(40) NULL',
            'client_survey'         => 'JSON NULL',
            'master_survey'         => 'JSON NULL',
            'dispute'               => 'JSON NULL',
            'notes'                 => 'TEXT NULL',
            'client_rating'         => 'DECIMAL(3,2) NULL',
            'master_rating'         => 'DECIMAL(3,2) NULL',
            'review_text'           => 'TEXT NULL',
            'created_at'            => 'VARCHAR(40) NULL',
        ],
        'chats' => [
            'booking_id'          => 'VARCHAR(40) NULL',
            'client_id'           => 'VARCHAR(40) NOT NULL',
            'client_name'         => 'VARCHAR(190) NULL',
            'client_avatar'       => 'MEDIUMTEXT NULL',
            'master_id'           => 'VARCHAR(40) NOT NULL',
            'master_name'         => 'VARCHAR(190) NULL',
            'master_avatar'       => 'MEDIUMTEXT NULL',
            'service_title'       => 'VARCHAR(190) NULL',
            'booking_date'        => 'VARCHAR(40) NULL',
            'booking_time_slot'   => 'VARCHAR(16) NULL',
            'booking_price'       => 'DECIMAL(12,2) NOT NULL DEFAULT 0',
            'last_message'        => 'TEXT NULL',
            'last_message_time'   => 'VARCHAR(40) NULL',
            'last_message_sender_id' => 'VARCHAR(40) NULL',
            'unread_count_client' => 'INT NOT NULL DEFAULT 0',
            'unread_count_master' => 'INT NOT NULL DEFAULT 0',
        ],
        'messages' => [
            'chat_id'      => 'VARCHAR(40) NOT NULL',
            'sender_id'    => 'VARCHAR(40) NULL',
            'sender_name'  => 'VARCHAR(190) NULL',
            'sender_avatar'=> 'MEDIUMTEXT NULL',
            'text'         => 'TEXT NULL',
            'image_url'    => 'MEDIUMTEXT NULL',
            'read_at'      => 'VARCHAR(40) NULL',
            'created_at'   => 'VARCHAR(40) NULL',
        ],
        'schedules' => [
            'working_days' => 'JSON NULL',
            'time_slots'   => 'JSON NULL',
            'off_dates'    => 'JSON NULL',
        ],
        'transactions' => [
            'type'             => 'VARCHAR(40) NOT NULL',
            'booking_id'       => 'VARCHAR(40) NULL',
            'user_id'          => 'VARCHAR(40) NULL',
            'user_name'        => 'VARCHAR(190) NULL',
            'amount'           => 'DECIMAL(12,2) NOT NULL DEFAULT 0',
            'commission_fee'   => 'DECIMAL(12,2) NULL',
            'description'      => 'TEXT NULL',
            'payment_ref'      => 'VARCHAR(80) NULL',
            'payout_destination'=> 'VARCHAR(255) NULL',
            'status'           => 'VARCHAR(24) NULL',
            'created_at'       => 'VARCHAR(40) NULL',
        ],
        'reviews' => [
            'booking_id'      => 'VARCHAR(40) NULL',
            'author_id'       => 'VARCHAR(40) NULL',
            'author_name'     => 'VARCHAR(190) NULL',
            'author_avatar'   => 'MEDIUMTEXT NULL',
            'author_role'     => 'VARCHAR(16) NULL',
            'target_user_id'  => 'VARCHAR(40) NULL',
            'target_user_name'=> 'VARCHAR(190) NULL',
            'rating'          => 'DECIMAL(3,2) NULL',
            'text'            => 'TEXT NULL',
            'created_at'      => 'VARCHAR(40) NULL',
        ],
        'email_codes' => [
            'code'       => 'VARCHAR(12) NOT NULL',
            'expires_at' => 'BIGINT NOT NULL',
        ],
        'events' => [
            'user_id'    => 'VARCHAR(40) NULL',
            'type'       => 'VARCHAR(60) NOT NULL',
            'payload'    => 'JSON NULL',
            'created_at' => 'VARCHAR(40) NULL',
        ],
        'admin_site_settings' => [
            'settings_json' => 'JSON NOT NULL',
            'revision'      => 'INT UNSIGNED NOT NULL DEFAULT 0',
            'updated_by'    => 'VARCHAR(190) NULL',
            'updated_at'    => 'VARCHAR(40) NULL',
        ],
        'admin_site_history' => [
            'revision'      => 'INT UNSIGNED NOT NULL',
            'action'        => "VARCHAR(24) NOT NULL DEFAULT 'publish'",
            'summary'       => 'VARCHAR(255) NOT NULL',
            'admin_email'   => 'VARCHAR(190) NOT NULL',
            'settings_json' => 'JSON NOT NULL',
            'created_at'    => 'VARCHAR(40) NOT NULL',
        ],
    ];

    foreach ($schemaColumns as $table => $cols) {
        $existing = [];
        try {
            foreach ($pdo->query("SHOW COLUMNS FROM `$table`")->fetchAll(PDO::FETCH_ASSOC) as $col) {
                $existing[$col['Field']] = true;
            }
        } catch (PDOException $e) {
            // Таблица могла не существовать (уже создана выше CREATE IF NOT EXISTS) — пропускаем.
            continue;
        }
        foreach ($cols as $field => $definition) {
            if (isset($existing[$field])) {
                continue;
            }
            try {
                $pdo->exec("ALTER TABLE `$table` ADD COLUMN `$field` $definition");
            } catch (PDOException $e) {
                // 1060 Duplicate column — другой запрос мог добавить столбец после проверки.
                if ((int)($e->errorInfo[1] ?? 0) !== 1060) {
                    throw $e;
                }
            }
        }
    }

    // В старых таблицах id мог быть INT AUTO_INCREMENT — приводим к VARCHAR(40),
    // иначе строковые id (u_xxx) обрезаются до 0.
    $idTables = ['users', 'services', 'works', 'posts', 'comments', 'bookings', 'chats', 'messages', 'schedules', 'transactions', 'reviews'];
    foreach ($idTables as $table) {
        try {
            $idCol = $pdo->query("SHOW COLUMNS FROM `$table` LIKE 'id'")->fetch(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {
            continue;
        }
        if (!$idCol) {
            continue;
        }
        $type = strtolower($idCol['Type'] ?? '');
        if (strpos($type, 'varchar(40)') !== false) {
            continue;
        }
        // Убираем AUTO_INCREMENT и меняем тип. Если есть внешние ключи, MySQL может отказать — игнорируем.
        try {
            $pdo->exec("ALTER TABLE `$table` MODIFY COLUMN `id` VARCHAR(40) NOT NULL");
        } catch (PDOException $e) {
            // Не критично — главная проблема решена в createUser.
        }
    }
}
