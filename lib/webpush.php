<?php
/**
 * Web Push (RFC 8030 + RFC 8291) на чистом PHP — без composer-зависимостей.
 *
 * Реализует:
 *  - VAPID (RFC 8292): JWT ES256 для авторизации отправителя;
 *  - шифрование полезной нагрузки схемой aes128gcm;
 *  - очередь отправки, которая выполняется уже после ответа API (см. push_queue()).
 *
 * Ключи VAPID генерируются один раз и хранятся в таблице push_vapid.
 */

const WEBPUSH_SPKI_PREFIX = '3059301306072a8648ce3d020106082a8648ce3d030107034200';
const WEBPUSH_RECORD_SIZE  = 4096;

/** base64url без padding. */
function webpush_b64encode(string $bin): string
{
    return rtrim(strtr(base64_encode($bin), '+/', '-_'), '=');
}

/** base64url / base64 → бинарные данные. */
function webpush_b64decode(string $value): string
{
    $value = strtr(trim($value), '-_', '+/');
    $decoded = base64_decode($value, true);
    return $decoded === false ? '' : $decoded;
}

/** Несжатая точка EC (65 байт) → PEM публичного ключа. */
function webpush_raw_public_to_pem(string $raw): string
{
    $der = hex2bin(WEBPUSH_SPKI_PREFIX) . $raw;
    return "-----BEGIN PUBLIC KEY-----\n" . chunk_split(base64_encode($der), 64, "\n") . "-----END PUBLIC KEY-----\n";
}

/** HKDF-Expand (RFC 5869) с SHA-256. */
function webpush_hkdf_expand(string $prk, string $info, int $length): string
{
    $output = '';
    $block = '';
    for ($i = 1; strlen($output) < $length; $i++) {
        $block = hash_hmac('sha256', $block . $info . chr($i), $prk, true);
        $output .= $block;
    }
    return substr($output, 0, $length);
}

/** DER-подпись ECDSA → «сырой» вид R||S (по 32 байта). */
function webpush_der_to_raw_signature(string $der): string
{
    $offset = 0;
    if (($der[$offset++] ?? '') !== "\x30") {
        return '';
    }
    $seqLen = ord($der[$offset++]);
    if ($seqLen & 0x80) {
        $bytes = $seqLen & 0x7f;
        for ($i = 0; $i < $bytes; $i++) {
            $offset++;
        }
    }

    $parts = [];
    for ($part = 0; $part < 2; $part++) {
        if (($der[$offset++] ?? '') !== "\x02") {
            return '';
        }
        $intLen = ord($der[$offset++]);
        if ($intLen & 0x80) {
            $bytes = $intLen & 0x7f;
            $intLen = 0;
            for ($i = 0; $i < $bytes; $i++) {
                $intLen = ($intLen << 8) | ord($der[$offset++]);
            }
        }
        $value = ltrim(substr($der, $offset, $intLen), "\x00");
        $offset += $intLen;
        $parts[] = str_pad($value, 32, "\x00", STR_PAD_LEFT);
    }

    return $parts[0] . $parts[1];
}

/** Доступны ли расширения, необходимые для отправки push. */
function webpush_available(): bool
{
    return extension_loaded('openssl')
        && function_exists('hash_hkdf')
        && function_exists('openssl_pkey_derive')
        && (function_exists('curl_init') || (bool)ini_get('allow_url_fopen'));
}

/** Контактный адрес для push-сервисов (обязателен в VAPID). */
function webpush_subject(): string
{
    $subject = trim((string)config('push.subject', ''));
    if ($subject !== '') {
        return $subject;
    }
    $admin = trim((string)config('admin.email', ''));
    if ($admin !== '') {
        return 'mailto:' . $admin;
    }
    $host = parse_url((string)config('app.domain', 'http://localhost'), PHP_URL_HOST) ?: 'localhost';
    return 'mailto:admin@' . $host;
}

/** Ключи VAPID: существующие из БД или только что сгенерированные. */
function webpush_vapid(): ?array
{
    static $keys = null;
    static $resolved = false;
    if ($resolved) {
        return $keys;
    }
    $resolved = true;

    $stored = repo()->vapidKeys();
    if ($stored !== null && $stored['publicKey'] !== '' && $stored['privateKey'] !== '') {
        $public = webpush_b64decode($stored['publicKey']);
        if (strlen($public) === 65) {
            $keys = ['publicKey' => $public, 'privateKey' => $stored['privateKey']];
            return $keys;
        }
    }

    if (!extension_loaded('openssl') || !defined('OPENSSL_KEYTYPE_EC')) {
        error_log('Web Push: расширение openssl недоступно');
        return null;
    }

    $resource = openssl_pkey_new(['curve_name' => 'prime256v1', 'private_key_type' => OPENSSL_KEYTYPE_EC]);
    if ($resource === false) {
        error_log('Web Push: не удалось создать ключ VAPID — ' . (openssl_error_string() ?: 'unknown error'));
        return null;
    }

    $details = openssl_pkey_get_details($resource);
    if (!isset($details['ec']['x'], $details['ec']['y'])) {
        error_log('Web Push: не удалось прочитать параметры ключа VAPID');
        return null;
    }

    // У EC-ключей openssl_pkey_get_details()['key'] содержит публичную часть,
    // поэтому приватный ключ получаем отдельным экспортом.
    $private = '';
    if (!openssl_pkey_export($resource, $private) || $private === '') {
        error_log('Web Push: не удалось экспортировать приватный ключ VAPID — ' . (openssl_error_string() ?: 'unknown error'));
        return null;
    }

    $public = "\x04" . $details['ec']['x'] . $details['ec']['y'];
    repo()->saveVapidKeys(webpush_b64encode($public), $private);

    $keys = ['publicKey' => $public, 'privateKey' => $private];
    return $keys;
}

/** Публичный ключ VAPID в base64url (отдаётся клиенту). */
function webpush_public_key(): ?string
{
    $keys = webpush_vapid();
    return $keys ? webpush_b64encode($keys['publicKey']) : null;
}

/** Заголовок Authorization с подписанным VAPID-токеном. */
function webpush_authorization(string $endpoint, array $vapid): string
{
    $parts = parse_url($endpoint);
    $audience = ($parts['scheme'] ?? 'https') . '://' . ($parts['host'] ?? '');
    if (!empty($parts['port'])) {
        $audience .= ':' . $parts['port'];
    }

    $header = webpush_b64encode(json_encode(['typ' => 'JWT', 'alg' => 'ES256'], JSON_UNESCAPED_SLASHES));
    $claims = webpush_b64encode(json_encode([
        'aud' => $audience,
        'exp' => time() + 3600,
        'sub' => webpush_subject(),
    ], JSON_UNESCAPED_SLASHES));
    $signingInput = $header . '.' . $claims;

    $privateKey = openssl_pkey_get_private($vapid['privateKey']);
    if ($privateKey === false) {
        throw new RuntimeException('Не удалось прочитать приватный ключ VAPID');
    }
    if (!openssl_sign($signingInput, $signature, $privateKey, OPENSSL_ALGO_SHA256)) {
        throw new RuntimeException('Не удалось подписать VAPID-токен');
    }

    $jwt = $signingInput . '.' . webpush_b64encode(webpush_der_to_raw_signature($signature));
    return 'vapid t=' . $jwt . ', k=' . webpush_b64encode($vapid['publicKey']);
}

/**
 * Тело запроса по схеме aes128gcm (RFC 8291).
 * @param string $uaPublicRaw несжатая точка P-256 устройства (65 байт)
 * @param string $authSecret  секрет auth из подписки (16 байт)
 */
function webpush_build_body(string $uaPublicRaw, string $authSecret, string $plaintext): string
{
    $localKey = openssl_pkey_new(['curve_name' => 'prime256v1', 'private_key_type' => OPENSSL_KEYTYPE_EC]);
    if ($localKey === false) {
        throw new RuntimeException('Не удалось создать одноразовый ключ шифрования');
    }
    $localDetails = openssl_pkey_get_details($localKey);
    $localPublic = "\x04" . $localDetails['ec']['x'] . $localDetails['ec']['y'];

    $uaKey = openssl_pkey_get_public(webpush_raw_public_to_pem($uaPublicRaw));
    if ($uaKey === false) {
        throw new RuntimeException('Некорректный публичный ключ подписки');
    }
    $sharedSecret = openssl_pkey_derive($uaKey, $localKey, 32);
    if ($sharedSecret === false) {
        throw new RuntimeException('Не удалось вычислить общий секрет ECDH');
    }

    $authInfo = "WebPush: info\x00" . $uaPublicRaw . $localPublic;
    $ikm = hash_hkdf('sha256', $sharedSecret, 32, $authInfo, $authSecret);

    $salt = random_bytes(16);
    $prk = hash_hmac('sha256', $ikm, $salt, true);
    $cek = webpush_hkdf_expand($prk, "Content-Encoding: aes128gcm\x00", 16);
    $nonce = webpush_hkdf_expand($prk, "Content-Encoding: nonce\x00", 12);

    $tag = '';
    $ciphertext = openssl_encrypt($plaintext . "\x02", 'aes-128-gcm', $cek, OPENSSL_RAW_DATA, $nonce, $tag, '', 16);
    if ($ciphertext === false) {
        throw new RuntimeException('Не удалось зашифровать полезную нагрузку');
    }

    return $salt . pack('N', WEBPUSH_RECORD_SIZE) . chr(strlen($localPublic)) . $localPublic . $ciphertext . $tag;
}

/** HTTP-запрос к push-сервису. Возвращает код ответа (0 при сетевой ошибке). */
function webpush_http_post(string $url, string $body, array $headers): int
{
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $body,
            CURLOPT_HTTPHEADER     => $headers,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 15,
            CURLOPT_CONNECTTIMEOUT => 10,
        ]);
        curl_exec($ch);
        $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        return $status;
    }

    $context = stream_context_create(['http' => [
        'method'        => 'POST',
        'header'        => implode("\r\n", $headers),
        'content'       => $body,
        'timeout'       => 15,
        'ignore_errors' => true,
    ]]);
    $result = @file_get_contents($url, false, $context);
    if ($result === false && empty($http_response_header)) {
        return 0;
    }
    return isset($http_response_header[0]) && preg_match('#\s(\d{3})\s#', $http_response_header[0], $m) ? (int)$m[1] : 0;
}

/**
 * Отправить уведомление на все подписки пользователя.
 * @return array{ok:bool,status:int,error:string}
 */
function webpush_send(array $subscription, array $payload): array
{
    $vapid = webpush_vapid();
    if ($vapid === null) {
        return ['ok' => false, 'status' => 0, 'error' => 'VAPID-ключи недоступны'];
    }

    $publicRaw = webpush_b64decode((string)$subscription['publicKey']);
    $authSecret = webpush_b64decode((string)$subscription['authKey']);
    if (strlen($publicRaw) !== 65 || $authSecret === '') {
        return ['ok' => false, 'status' => 0, 'error' => 'Некорректные ключи подписки'];
    }

    try {
        $body = webpush_build_body($publicRaw, $authSecret, json_encode($payload, JSON_UNESCAPED_UNICODE));
        $headers = [
            'Authorization: ' . webpush_authorization((string)$subscription['endpoint'], $vapid),
            'Content-Encoding: aes128gcm',
            'Content-Type: application/octet-stream',
            'TTL: ' . (int)config('push.ttl', 2419200),
            'Urgency: high',
        ];
    } catch (Throwable $e) {
        return ['ok' => false, 'status' => 0, 'error' => $e->getMessage()];
    }

    $status = webpush_http_post((string)$subscription['endpoint'], $body, $headers);
    return [
        'ok'     => $status >= 200 && $status < 300,
        'status' => $status,
        'error'  => $status >= 200 && $status < 300 ? '' : 'HTTP ' . $status,
    ];
}

/**
 * Поставить уведомление в очередь. Отправка выполняется после ответа API,
 * чтобы не задерживать клиента (см. push_flush()).
 *
 * @param string[] $userIds
 * @param array{title?:string,body?:string,url?:string,tag?:string,chatId?:string} $payload
 */
function push_queue(array $userIds, array $payload, ?string $excludeUserId = null): void
{
    static $registered = false;
    if (!webpush_available()) {
        return;
    }

    $targets = [];
    $excludeUserId = $excludeUserId === null ? '' : (string)$excludeUserId;
    foreach ($userIds as $userId) {
        $userId = (string)$userId;
        if ($userId === '' || $userId === $excludeUserId) {
            continue;
        }
        $targets[$userId] = true;
    }
    if (!$targets) {
        return;
    }

    $GLOBALS['__push_queue'][] = ['users' => array_keys($targets), 'payload' => $payload];

    if (!$registered) {
        $registered = true;
        register_shutdown_function('push_flush');
    }
}

/** Отправить все накопленные уведомления (вызывается на завершении скрипта). */
function push_flush(): void
{
    $queue = $GLOBALS['__push_queue'] ?? [];
    unset($GLOBALS['__push_queue']);
    if (!$queue) {
        return;
    }

    // Браузер уже получил ответ API — продолжаем работу в фоне.
    ignore_user_abort(true);
    while (ob_get_level() > 0) {
        ob_end_flush();
    }
    flush();

    foreach ($queue as $item) {
        foreach ($item['users'] as $userId) {
            foreach (repo()->getPushSubscriptions($userId) as $subscription) {
                $result = webpush_send($subscription, $item['payload']);
                // 404/410 — подписка больше не существует, удаляем её.
                if (in_array($result['status'], [404, 410], true)) {
                    repo()->deletePushSubscriptionById((int)$subscription['id']);
                } elseif (!$result['ok'] && $result['status'] !== 0) {
                    error_log('Web Push: ошибка отправки (' . $result['error'] . ') для подписки #' . $subscription['id']);
                }
            }
        }
    }
}
