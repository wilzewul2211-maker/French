<?php
/**
 * Общие вспомогательные функции.
 */

/** Доступ к конфигу: config('db.host'). */
function config(?string $path = null, $default = null)
{
    $cfg = FRENCH_CONFIG;
    if ($path === null) {
        return $cfg;
    }
    $node = $cfg;
    foreach (explode('.', $path) as $key) {
        if (!is_array($node) || !array_key_exists($key, $node)) {
            return $default;
        }
        $node = $node[$key];
    }
    return $node;
}

/** Экранирование для HTML. */
function e($value): string
{
    return htmlspecialchars((string)($value ?? ''), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

/** JSON для вставки в <script>: безопасно для HTML-контекста. */
function json_for_js($value): string
{
    return json_encode(
        $value,
        JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_SLASHES
    );
}

/** Ответ API в формате JSON. */
function json_response($data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/** Ошибка API в том же формате, что и в исходном проекте: {"error": "..."}. */
function json_error(string $message, int $status = 400): void
{
    json_response(['error' => $message], $status);
}

/** Тело запроса как массив (поддерживает JSON и form-urlencoded). */
function request_input(): array
{
    static $cached = null;
    if ($cached !== null) {
        return $cached;
    }

    $raw = file_get_contents('php://input');
    $data = [];

    if ($raw !== false && $raw !== '') {
        $decoded = json_decode($raw, true);
        if (is_array($decoded)) {
            $data = $decoded;
        }
    }

    if (!$data && !empty($_POST)) {
        $data = $_POST;
    }

    $cached = $data;
    return $cached;
}

/** Значение из тела запроса. */
function input(string $key, $default = null)
{
    $data = request_input();
    return array_key_exists($key, $data) ? $data[$key] : $default;
}

/** Уникальный идентификатор в стиле исходного проекта: u_ab12cd34e. */
function uid(string $prefix): string
{
    $alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
    $out = '';
    for ($i = 0; $i < 9; $i++) {
        $out .= $alphabet[random_int(0, strlen($alphabet) - 1)];
    }
    return $prefix . '_' . $out;
}

/** Текущее время в ISO-8601 (как new Date().toISOString()). */
function now_iso(): string
{
    return gmdate('Y-m-d\TH:i:s.v\Z');
}

/** ISO-строка → timestamp. */
function iso_to_ts(?string $iso): int
{
    if (!$iso) {
        return 0;
    }
    $ts = strtotime($iso);
    return $ts === false ? 0 : $ts;
}

/** Количество дней между сегодня и датой (может быть отрицательным). */
function days_until(string $dateYmd): int
{
    $today = new DateTimeImmutable(date('Y-m-d'));
    $target = new DateTimeImmutable(substr($dateYmd, 0, 10));
    return (int)$today->diff($target)->format('%r%a');
}

/** Форматирование суммы «2 500 ₽». */
function money_ru($amount): string
{
    return number_format((float)$amount, 0, ',', ' ') . ' ₽';
}

/** Дата вида 18.11.2026. */
function date_ru(?string $isoOrYmd): string
{
    if (!$isoOrYmd) {
        return '';
    }
    $ts = strtotime($isoOrYmd);
    return $ts ? date('d.m.Y', $ts) : '';
}

/** Время вида 14:35. */
function time_ru(?string $iso): string
{
    $ts = iso_to_ts($iso);
    return $ts ? date('H:i', $ts) : '';
}

/** Аватар-заглушка (силуэт) — идентичен исходному проекту. */
function default_avatar(): string
{
    return 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23E2DDD5"/><circle cx="50" cy="36" r="18" fill="%23554F47"/><path d="M 18 88 C 18 62, 34 54, 50 54 C 66 54, 82 62, 82 88 Z" fill="%23554F47"/></svg>';
}

/** Заглушка для изображения работы. */
function default_portfolio_image(): string
{
    return 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect width="400" height="300" fill="%23ECE7DF"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%23554F47" font-family="sans-serif" font-size="16" font-weight="600">French Beauty Art</text></svg>';
}

/** Аватар пользователя или заглушка. */
function avatar_of(?array $user): string
{
    $src = $user['avatar'] ?? '';
    return $src !== '' ? $src : default_avatar();
}

/** Атрибут подстановки заглушки для <img>: onerror_attr() либо onerror_attr('work'). */
function onerror_attr(string $kind = 'avatar'): string
{
    return ' onerror="FR.imgError(this, \'' . $kind . '\')"';
}

/** Значения по умолчанию для зачёркивания длинных строк в атрибутах. */
function truncate(?string $text, int $limit = 60): string
{
    $text = trim((string)$text);
    if (mb_strlen($text) <= $limit) {
        return $text;
    }
    return mb_substr($text, 0, $limit - 1) . '…';
}

/** Декодирование JSON-колонки в массив. */
function json_decode_array($value): array
{
    if (is_array($value)) {
        return $value;
    }
    if (is_string($value) && $value !== '') {
        $decoded = json_decode($value, true);
        return is_array($decoded) ? $decoded : [];
    }
    return [];
}

/** Список категорий услуг (используется в поиске и профиле мастера). */
function service_categories(): array
{
    return [
        'Маникюр & Педикюр',
        'Визажист & Стилист',
        'Брови & Ресницы',
        'Парикмахер',
        'Косметолог',
        'Массажист',
    ];
}

/** Районы Москвы (используются в фильтрах поиска). */
function moscow_districts(): array
{
    return [
        'Тверской', 'Арбат', 'Пресненский', 'Мещанский', 'Басманный',
        'Замоскворечье', 'Хамовники', 'Таганский', 'Дорогомилово', 'Красносельский',
    ];
}
