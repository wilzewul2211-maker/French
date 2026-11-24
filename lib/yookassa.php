<?php
/**
 * ЮKassa (YooKassa) REST API v3 — минимальный клиент без сторонних библиотек.
 * Используется для оплаты объявлений мастерами.
 */

function yookassa_config(): array
{
    return [
        'enabled'    => (bool)config('yookassa.enabled', false),
        'shop_id'    => trim((string)config('yookassa.shop_id', '')),
        'secret_key' => trim((string)config('yookassa.secret_key', '')),
        'return_url' => trim((string)config('yookassa.return_url', '')),
    ];
}

function yookassa_is_configured(): bool
{
    $cfg = yookassa_config();
    return $cfg['enabled'] && $cfg['shop_id'] !== '' && $cfg['secret_key'] !== '';
}

/** Адрес возврата после оплаты. */
function yookassa_return_url(string $subscriptionId): string
{
    $cfg = yookassa_config();
    if ($cfg['return_url'] !== '') {
        $glue = strpos($cfg['return_url'], '?') === false ? '?' : '&';
        return $cfg['return_url'] . $glue . 'sub=' . rawurlencode($subscriptionId);
    }
    $domain = rtrim((string)config('app.domain', ''), '/');
    return $domain . '/?tab=profile&payment=return&sub=' . rawurlencode($subscriptionId);
}

/**
 * Запрос к API ЮKassa.
 * @return array{ok: bool, status: int, data: array, error: string}
 */
function yookassa_request(string $method, string $path, ?array $body = null): array
{
    $cfg = yookassa_config();
    if (!yookassa_is_configured()) {
        return ['ok' => false, 'status' => 0, 'data' => [], 'error' => 'ЮKassa не настроена: заполните shop_id и secret_key.'];
    }

    $url = 'https://api.yookassa.ru/v3' . $path;
    $headers = [
        'Authorization: Basic ' . base64_encode($cfg['shop_id'] . ':' . $cfg['secret_key']),
        'Idempotence-Key: ' . uid('idem'),
        'Content-Type: application/json',
        'Accept: application/json',
    ];
    $payload = $body !== null ? json_encode($body, JSON_UNESCAPED_UNICODE) : null;

    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CUSTOMREQUEST  => strtoupper($method),
            CURLOPT_HTTPHEADER     => $headers,
            CURLOPT_TIMEOUT        => 25,
            CURLOPT_CONNECTTIMEOUT => 10,
        ]);
        if ($payload !== null) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
        }
        $raw  = curl_exec($ch);
        $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err  = curl_error($ch);
        curl_close($ch);
        if ($raw === false) {
            return ['ok' => false, 'status' => $code, 'data' => [], 'error' => 'Ошибка соединения с ЮKassa: ' . $err];
        }
    } else {
        $context = stream_context_create([
            'http' => [
                'method'        => strtoupper($method),
                'header'        => implode("\r\n", $headers),
                'content'       => $payload,
                'timeout'       => 25,
                'ignore_errors' => true,
            ],
        ]);
        $raw = @file_get_contents($url, false, $context);
        $code = 0;
        foreach ($http_response_header ?? [] as $line) {
            if (preg_match('#^HTTP/\S+\s+(\d{3})#', $line, $m)) {
                $code = (int)$m[1];
            }
        }
        if ($raw === false) {
            return ['ok' => false, 'status' => $code, 'data' => [], 'error' => 'Ошибка соединения с ЮKassa.'];
        }
    }

    $data = json_decode((string)$raw, true);
    if (!is_array($data)) {
        return ['ok' => false, 'status' => $code, 'data' => [], 'error' => 'Некорректный ответ ЮKassa (HTTP ' . $code . ').'];
    }
    if ($code < 200 || $code >= 300) {
        $message = $data['description'] ?? ($data['error'] ?? 'HTTP ' . $code);
        return ['ok' => false, 'status' => $code, 'data' => $data, 'error' => 'ЮKassa: ' . $message];
    }

    return ['ok' => true, 'status' => $code, 'data' => $data, 'error' => ''];
}

/** Создать платёж. */
function yookassa_create_payment(float $amount, string $description, array $metadata = []): array
{
    return yookassa_request('POST', '/payments', [
        'amount'       => ['value' => number_format($amount, 2, '.', ''), 'currency' => 'RUB'],
        'capture'      => true,
        'confirmation' => [
            'type'       => 'redirect',
            'return_url' => yookassa_return_url((string)($metadata['subscription_id'] ?? '')),
        ],
        'description'  => mb_substr($description, 0, 128),
        'metadata'     => $metadata,
    ]);
}

/** Получить платёж по id. */
function yookassa_get_payment(string $paymentId): array
{
    return yookassa_request('GET', '/payments/' . rawurlencode($paymentId));
}
