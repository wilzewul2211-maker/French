<?php
/**
 * Сессии и авторизация (замена localStorage-сессии исходного проекта).
 */

/** Запуск сессии. */
function auth_boot(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    session_name(config('session.name', 'french_session'));
    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/',
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

/** id текущего пользователя или null. */
function current_user_id(): ?string
{
    auth_boot();
    $id = $_SESSION['user_id'] ?? null;
    return is_string($id) && $id !== '' ? $id : null;
}

/** Текущий пользователь (массив) или null. Кэшируется на запрос. */
function current_user(): ?array
{
    static $user = null;
    static $resolved = false;
    if ($resolved) {
        return $user;
    }
    $resolved = true;

    $id = current_user_id();
    if ($id === null) {
        $user = null;
        return null;
    }

    $user = repo()->findUserById($id) ?: null;
    if ($user === null) {
        auth_logout();
    } elseif (
        config('admin.email', '') !== ''
        && strcasecmp((string)$user['email'], (string)config('admin.email')) === 0
        && ($user['role'] ?? '') !== 'admin'
    ) {
        repo()->setUserRole($id, 'admin');
        $user = repo()->findUserById($id);
    }
    return $user;
}

/** Записать пользователя в сессию. */
function auth_login(string $userId): void
{
    auth_boot();
    session_regenerate_id(true);
    $_SESSION['user_id'] = $userId;
}

/** Сбросить сессию. */
function auth_logout(): void
{
    auth_boot();
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'] ?? '', (bool)($params['secure'] ?? false), (bool)($params['httponly'] ?? true));
    }
    session_destroy();
}

/**
 * id пользователя для операций записи: приоритет — сессия,
 * иначе (для совместимости с исходным API) значение из запроса.
 */
function acting_user_id($fallback = null): ?string
{
    $sessionId = current_user_id();
    if ($sessionId !== null) {
        return $sessionId;
    }
    return is_string($fallback) && $fallback !== '' ? $fallback : null;
}
