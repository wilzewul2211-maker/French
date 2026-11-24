<?php
/**
 * Публичные настройки оформления и защищённые операции администрирования.
 */

function admin_settings_defaults(): array
{
    return [
        'brandName' => 'FRENCH',
        'brandBadge' => 'Beauty',
        'tagline' => 'Бьюти-сеть & Сообщество',
        'loginSubtitle' => 'Войдите, чтобы просматривать записи, общаться в чатах и вести профиль',
        'accentColor' => '#E11D48',
        'visibleTabs' => [
            'feed' => true,
            'search' => true,
            'posts' => true,
            'chats' => true,
            'profile' => true,
        ],
        'customBlocks' => [],
        // Оплата объявлений мастеров (подписка на размещение работ в ленте).
        'listingEnabled' => true,
        'listingPriceSingle' => 100,
        'listingPricePack' => 300,
        'listingPackSize' => 6,
        // Стили отдельных элементов сайта (живой редактор в админ-панели).
        // Формат: { элемент: { bgImage, bgColor, textColor, bgSize, radius, padding } }
        'elementStyles' => [],
    ];
}

/** Каталог редактируемых элементов: ключ => CSS-селектор. */
function element_style_catalog(): array
{
    return [
        'page'      => '.fr-root',
        'header'    => 'header[data-style-key="header"]',
        'mobileNav' => '[data-style-key="mobileNav"]',
        'footer'    => '[data-style-key="footer"]',
        'feedHero'  => '[data-style-key="feedHero"]',
        'feedCard'  => '[data-style-key="feedCard"]',
    ];
}

/** Нормализация одного стиля элемента: только безопасные свойства. */
function admin_normalize_element_style($style): array
{
    $style = is_array($style) ? $style : [];
    $clean = [];

    foreach (['bgColor', 'textColor'] as $field) {
        if (!empty($style[$field])) {
            $color = strtoupper(trim((string)$style[$field]));
            if (preg_match('/^#[0-9A-F]{6}$/', $color)) {
                $clean[$field] = $color;
            }
        }
    }

    if (!empty($style['bgImage'])) {
        $img = trim((string)$style['bgImage']);
        if (preg_match('#^(https?://|data:image/(?:png|jpe?g|webp|gif);base64,)#i', $img) && strlen($img) <= 1200000) {
            $clean['bgImage'] = $img;
        }
    }

    if (!empty($style['bgSize'])) {
        $size = (string)$style['bgSize'];
        $clean['bgSize'] = in_array($size, ['cover', 'contain', 'auto'], true) ? $size : 'cover';
    }
    if (array_key_exists('radius', $style)) {
        $clean['radius'] = max(0, min(64, (int)$style['radius']));
    }
    if (array_key_exists('padding', $style)) {
        $clean['padding'] = max(0, min(80, (int)$style['padding']));
    }
    return $clean;
}

/** Нормализация карты стилей элементов. */
function admin_normalize_element_styles($input): array
{
    $input = is_array($input) ? $input : [];
    $out = [];
    foreach (array_keys(element_style_catalog()) as $key) {
        $clean = admin_normalize_element_style($input[$key] ?? []);
        if ($clean) {
            $out[$key] = $clean;
        }
    }
    return $out;
}

/** Собрать CSS-правила для сохранённых стилей элементов. */
function element_styles_css(array $styles): string
{
    $css = '';
    foreach (element_style_catalog() as $key => $selector) {
        $style = $styles[$key] ?? null;
        if (!is_array($style)) {
            continue;
        }
        $decl = [];
        if (!empty($style['bgColor'])) {
            $decl[] = 'background-color:' . $style['bgColor'];
        }
        if (!empty($style['bgImage'])) {
            $decl[] = 'background-image:url("' . str_replace(['"', "\n", "\r"], ['%22', '', ''], (string)$style['bgImage']) . '")';
            $decl[] = 'background-size:' . ($style['bgSize'] ?? 'cover');
            $decl[] = 'background-position:center';
            $decl[] = 'background-repeat:no-repeat';
        }
        if (!empty($style['textColor'])) {
            $decl[] = 'color:' . $style['textColor'];
        }
        if (isset($style['radius'])) {
            $decl[] = 'border-radius:' . (int)$style['radius'] . 'px';
        }
        if (isset($style['padding'])) {
            $decl[] = 'padding:' . (int)$style['padding'] . 'px';
        }
        if ($decl) {
            $css .= $selector . '{' . implode(';', $decl) . '}';
        }
    }
    return $css;
}

/** Разрешаем только поля, которые безопасно редактировать из панели. */
function admin_settings_normalize($input): array
{
    $defaults = admin_settings_defaults();
    $input = is_array($input) ? $input : [];
    $text = static function ($value, string $fallback, int $limit): string {
        $value = trim(strip_tags((string)$value));
        if ($value === '') {
            return $fallback;
        }
        return mb_substr($value, 0, $limit);
    };

    $color = strtoupper(trim((string)($input['accentColor'] ?? $defaults['accentColor'])));
    if (!preg_match('/^#[0-9A-F]{6}$/', $color)) {
        $color = $defaults['accentColor'];
    }

    $visible = is_array($input['visibleTabs'] ?? null) ? $input['visibleTabs'] : [];
    $visibleTabs = [];
    foreach ($defaults['visibleTabs'] as $key => $defaultValue) {
        $value = $visible[$key] ?? $defaultValue;
        $visibleTabs[$key] = $value === true || $value === 1 || $value === '1';
    }

    $blocks = [];
    foreach (array_slice(is_array($input['customBlocks'] ?? null) ? $input['customBlocks'] : [], 0, 8) as $block) {
        if (!is_array($block)) {
            continue;
        }
        $title = $text($block['title'] ?? '', '', 80);
        $body = $text($block['body'] ?? '', '', 400);
        if ($title === '' || $body === '') {
            continue;
        }
        $blocks[] = [
            'id' => preg_match('/^[a-zA-Z0-9_-]{1,40}$/', (string)($block['id'] ?? ''))
                ? (string)$block['id']
                : uid('block'),
            'title' => $title,
            'body' => $body,
            'enabled' => !isset($block['enabled']) || $block['enabled'] === true || $block['enabled'] === 1 || $block['enabled'] === '1',
        ];
    }

    return [
        'brandName' => $text($input['brandName'] ?? '', $defaults['brandName'], 24),
        'brandBadge' => $text($input['brandBadge'] ?? '', $defaults['brandBadge'], 24),
        'tagline' => $text($input['tagline'] ?? '', $defaults['tagline'], 80),
        'loginSubtitle' => $text($input['loginSubtitle'] ?? '', $defaults['loginSubtitle'], 120),
        'accentColor' => $color,
        'visibleTabs' => $visibleTabs,
        'customBlocks' => $blocks,
        'listingEnabled' => !isset($input['listingEnabled'])
            ? $defaults['listingEnabled']
            : ($input['listingEnabled'] === true || $input['listingEnabled'] === 1 || $input['listingEnabled'] === '1'),
        'listingPriceSingle' => admin_int($input['listingPriceSingle'] ?? null, $defaults['listingPriceSingle'], 0, 1000000),
        'listingPricePack' => admin_int($input['listingPricePack'] ?? null, $defaults['listingPricePack'], 0, 1000000),
        'listingPackSize' => admin_int($input['listingPackSize'] ?? null, $defaults['listingPackSize'], 1, 100),
        'elementStyles' => admin_normalize_element_styles($input['elementStyles'] ?? null),
    ];
}

/** Привести значение настройки к целому числу в заданных границах. */
function admin_int($value, int $fallback, int $min, int $max): int
{
    if ($value === null || $value === '' || !is_numeric($value)) {
        return $fallback;
    }
    return max($min, min($max, (int)$value));
}

function admin_site_settings(): array
{
    $row = db()->query('SELECT settings_json, revision FROM admin_site_settings WHERE id = 1')->fetch();
    if (!$row) {
        return ['settings' => admin_settings_defaults(), 'revision' => 0];
    }
    $decoded = json_decode((string)$row['settings_json'], true);
    return [
        'settings' => admin_settings_normalize($decoded),
        'revision' => (int)$row['revision'],
    ];
}

function admin_site_history(int $limit = 30): array
{
    $stmt = db()->prepare(
        'SELECT id, revision, action, summary, admin_email, created_at
         FROM admin_site_history ORDER BY id DESC LIMIT ?'
    );
    $stmt->bindValue(1, max(1, min(100, $limit)), PDO::PARAM_INT);
    $stmt->execute();
    return array_map(static function (array $row): array {
        return [
            'id' => (int)$row['id'],
            'revision' => (int)$row['revision'],
            'action' => $row['action'],
            'summary' => $row['summary'],
            'adminEmail' => $row['admin_email'],
            'createdAt' => $row['created_at'],
        ];
    }, $stmt->fetchAll());
}

/** Публикация новой версии с проверкой, что черновик основан на актуальной ревизии. */
function admin_publish_settings(array $settings, string $adminEmail, int $expectedRevision, string $summary, string $action = 'publish'): array
{
    $pdo = db();
    $pdo->beginTransaction();
    try {
        $row = $pdo->query('SELECT revision FROM admin_site_settings WHERE id = 1 FOR UPDATE')->fetch();
        $currentRevision = $row ? (int)$row['revision'] : 0;
        if ($currentRevision !== $expectedRevision) {
            $pdo->rollBack();
            return ['conflict' => true, 'revision' => $currentRevision];
        }

        $revision = $currentRevision + 1;
        $json = json_encode(admin_settings_normalize($settings), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $now = now_iso();
        if ($row) {
            $stmt = $pdo->prepare(
                'UPDATE admin_site_settings SET settings_json = ?, revision = ?, updated_by = ?, updated_at = ? WHERE id = 1'
            );
            $stmt->execute([$json, $revision, $adminEmail, $now]);
        } else {
            $stmt = $pdo->prepare(
                'INSERT INTO admin_site_settings (id, settings_json, revision, updated_by, updated_at) VALUES (1, ?, ?, ?, ?)'
            );
            $stmt->execute([$json, $revision, $adminEmail, $now]);
        }

        $stmt = $pdo->prepare(
            'INSERT INTO admin_site_history (revision, action, summary, admin_email, settings_json, created_at)
             VALUES (?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([$revision, $action, mb_substr($summary, 0, 255), $adminEmail, $json, $now]);
        $historyId = (int)$pdo->lastInsertId();
        $pdo->commit();
        return ['conflict' => false, 'revision' => $revision, 'historyId' => $historyId];
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
}

function admin_rollback_settings(int $historyId, string $adminEmail, int $expectedRevision): array
{
    $stmt = db()->prepare('SELECT revision, settings_json FROM admin_site_history WHERE id = ? LIMIT 1');
    $stmt->execute([$historyId]);
    $target = $stmt->fetch();
    if (!$target) {
        return ['notFound' => true];
    }
    return admin_publish_settings(
        admin_settings_normalize(json_decode((string)$target['settings_json'], true)),
        $adminEmail,
        $expectedRevision,
        'Откат к версии #' . (int)$target['revision'],
        'rollback'
    );
}

function admin_require_user(): array
{
    $user = current_user();
    if (!$user || ($user['role'] ?? '') !== 'admin') {
        json_error('Доступ только для администратора', 403);
    }
    return $user;
}
