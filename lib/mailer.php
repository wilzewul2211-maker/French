<?php
/**
 * Отправка письма с кодом подтверждения через SMTP.
 * Реализовано на стандартных потоках PHP — без сторонних библиотек и без модуля sockets.
 */

/**
 * Низкоуровневая отправка письма по SMTP.
 *
 * @return array{success: bool, error: string}
 */
function smtp_send(array $cfg, string $to, string $subject, string $html, string $plainText = ''): array
{
    $host   = $cfg['host'] ?? '';
    $port   = (int)($cfg['port'] ?? 587);
    $secure = strtolower((string)($cfg['secure'] ?? 'tls'));
    $timeout = max(5, min(30, (int)($cfg['timeout'] ?? 12)));
    $user   = (string)($cfg['user'] ?? '');
    $pass   = (string)($cfg['pass'] ?? '');
    $from   = (string)($cfg['from_name'] ?? 'French Beauty Network');
    // Адрес отправителя. В Postbox логин — идентификатор API-ключа, а From — подтверждённый адрес.
    $fromEmail = (string)($cfg['from_email'] ?? '') ?: $user;

    if ($host === '' || $user === '') {
        return ['success' => false, 'error' => 'SMTP не настроен'];
    }

    $transport = $secure === 'ssl' ? 'ssl://' : 'tcp://';
    $context   = stream_context_create([
        'ssl' => ['verify_peer' => true, 'verify_peer_name' => true, 'allow_self_signed' => false],
    ]);

    $errno = 0;
    $errstr = '';
    error_clear_last();
    $fp = @stream_socket_client($transport . $host . ':' . $port, $errno, $errstr, $timeout, STREAM_CLIENT_CONNECT, $context);
    if (!$fp) {
        $lastError = error_get_last();
        $detail = $errstr ?: ($lastError['message'] ?? ('код ' . $errno));
        error_log('SMTP connection failed for ' . $host . ':' . $port . ' — ' . $detail);
        return [
            'success' => false,
            'error' => 'Нет соединения с SMTP ' . $host . ':' . $port . ' (' . $detail . ')',
        ];
    }
    stream_set_timeout($fp, $timeout);

    /** Чтение ответа SMTP (все строки, пока не встретится «код + пробел»). */
    $read = static function ($fp): string {
        $data = '';
        while (($line = fgets($fp, 515)) !== false) {
            $data .= $line;
            if (strlen($line) >= 4 && $line[3] === ' ') {
                break;
            }
        }
        return $data;
    };

    /** Отправка команды и проверка ожидаемого кода ответа. */
    $send = static function (string $command, array $expectCodes) use ($fp, $read): array {
        if ($command !== '') {
            fwrite($fp, $command . "\r\n");
        }
        $response = $read($fp);
        $code = (int)substr(trim($response), 0, 3);
        if (!in_array($code, $expectCodes, true)) {
            return ['ok' => false, 'response' => trim($response)];
        }
        return ['ok' => true, 'response' => $response];
    };

    $greeting = $send('', [220]);
    if (!$greeting['ok']) {
        fclose($fp);
        return ['success' => false, 'error' => 'SMTP приветствие: ' . $greeting['response']];
    }

    $ehlo = $send('EHLO ' . (parse_url(config('app.domain'), PHP_URL_HOST) ?: 'localhost'), [250]);
    if (!$ehlo['ok']) {
        $ehlo = $send('HELO localhost', [250]);
        if (!$ehlo['ok']) {
            fclose($fp);
            return ['success' => false, 'error' => 'SMTP EHLO: ' . $ehlo['response']];
        }
    }

    if ($secure === 'tls') {
        $starttls = $send('STARTTLS', [220]);
        if (!$starttls['ok']) {
            fclose($fp);
            return ['success' => false, 'error' => 'STARTTLS: ' . $starttls['response']];
        }
        if (!stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
            fclose($fp);
            return ['success' => false, 'error' => 'Не удалось включить TLS'];
        }
        $send('EHLO ' . (parse_url(config('app.domain'), PHP_URL_HOST) ?: 'localhost'), [250]);
    }

    $auth = $send('AUTH LOGIN', [334]);
    if (!$auth['ok']) {
        fclose($fp);
        return ['success' => false, 'error' => 'SMTP AUTH: ' . $auth['response']];
    }
    $authUser = $send(base64_encode($user), [334]);
    $authPass = $send(base64_encode($pass), [235]);
    if (!$authPass['ok']) {
        fclose($fp);
        return ['success' => false, 'error' => 'Неверный логин или пароль SMTP: ' . $authPass['response']];
    }

    $mailFrom = $send('MAIL FROM:<' . $fromEmail . '>', [250]);
    if (!$mailFrom['ok']) {
        fclose($fp);
        return ['success' => false, 'error' => 'MAIL FROM: ' . $mailFrom['response']];
    }
    $rcpt = $send('RCPT TO:<' . $to . '>', [250, 251]);
    if (!$rcpt['ok']) {
        fclose($fp);
        return ['success' => false, 'error' => 'Получатель отклонён: ' . $rcpt['response']];
    }
    $data = $send('DATA', [354]);
    if (!$data['ok']) {
        fclose($fp);
        return ['success' => false, 'error' => 'SMTP DATA: ' . $data['response']];
    }

    $boundary = '=_French_' . bin2hex(random_bytes(12));
    $headers = [
        'Date: ' . date('r'),
        'From: "' . $from . '" <' . $fromEmail . '>',
        'To: <' . $to . '>',
        'Subject: =?UTF-8?B?' . base64_encode($subject) . '?=',
        'MIME-Version: 1.0',
        'Content-Type: multipart/alternative; boundary="' . $boundary . '"',
    ];

    $plainText = $plainText !== '' ? $plainText : trim(strip_tags($html));
    $body = '--' . $boundary . "\r\n"
        . "Content-Type: text/plain; charset=UTF-8\r\n"
        . "Content-Transfer-Encoding: base64\r\n\r\n"
        . chunk_split(base64_encode($plainText), 76, "\r\n")
        . '--' . $boundary . "\r\n"
        . "Content-Type: text/html; charset=UTF-8\r\n"
        . "Content-Transfer-Encoding: base64\r\n\r\n"
        . chunk_split(base64_encode($html), 76, "\r\n")
        . '--' . $boundary . "--\r\n";
    fwrite($fp, implode("\r\n", $headers) . "\r\n\r\n" . $body . "\r\n.\r\n");

    $sent = $read($fp);
    $code = (int)substr(trim($sent), 0, 3);
    $send('QUIT', [221]);
    fclose($fp);

    if ($code !== 250) {
        return ['success' => false, 'error' => 'SMTP отправка: ' . trim($sent)];
    }
    return ['success' => true, 'error' => ''];
}

/** Письмо с одноразовым кодом подтверждения. */
function mailer_send_verification_code(string $email, string $code): array
{
    $cfg = config('smtp');
    $safeCode = e($code);
    $html = <<<HTML
<!doctype html>
<html lang="ru">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Ваш одноразовый код для входа в French Beauty Network.</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e4e4e7;border-radius:20px;overflow:hidden;">
        <tr><td style="height:6px;background:#e11d48;font-size:0;line-height:0;">&nbsp;</td></tr>
        <tr><td style="padding:32px 32px 12px;text-align:center;">
          <div style="display:inline-block;width:42px;height:42px;line-height:42px;border-radius:13px;background:#09090b;color:#fb7185;font-size:22px;font-weight:800;">F</div>
          <div style="margin-top:12px;color:#09090b;font-size:20px;font-weight:800;letter-spacing:1.5px;">FRENCH <span style="color:#e11d48;">BEAUTY</span></div>
          <div style="margin-top:5px;color:#71717a;font-size:11px;letter-spacing:2px;text-transform:uppercase;">Beauty Network</div>
        </td></tr>
        <tr><td style="padding:20px 32px 32px;">
          <h1 style="margin:0 0 10px;text-align:center;color:#18181b;font-size:23px;line-height:1.3;">Подтвердите ваш email</h1>
          <p style="margin:0;text-align:center;color:#71717a;font-size:14px;line-height:1.7;">Введите этот одноразовый код в окне регистрации. Он действует 5 минут.</p>
          <div style="margin:26px 0;padding:21px 12px;text-align:center;background:#fff1f2;border:1px solid #fecdd3;border-radius:15px;">
            <span style="color:#be123c;font-family:Arial,Helvetica,sans-serif;font-size:34px;font-weight:800;letter-spacing:9px;">{$safeCode}</span>
          </div>
          <div style="padding:13px 15px;background:#fafafa;border:1px solid #e4e4e7;border-radius:12px;color:#52525b;font-size:12px;line-height:1.6;">
            В целях безопасности не сообщайте этот код другим людям. Сотрудники French Beauty Network никогда не попросят его у вас.
          </div>
          <p style="margin:24px 0 0;text-align:center;color:#a1a1aa;font-size:11px;line-height:1.6;">Если вы не запрашивали код, просто проигнорируйте это письмо.</p>
        </td></tr>
        <tr><td style="padding:17px 24px;background:#fafafa;border-top:1px solid #e4e4e7;text-align:center;color:#a1a1aa;font-size:10px;line-height:1.5;">
          French Beauty Network · Письмо отправлено автоматически
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
HTML;
    $plain = "Подтвердите email в French Beauty Network.\n\nВаш одноразовый код: {$code}\nКод действует 5 минут. Никому не сообщайте его.\n\nЕсли вы не запрашивали код, проигнорируйте это письмо.";

    return smtp_send($cfg, $email, 'Ваш код подтверждения — French Beauty Network', $html, $plain);
}
