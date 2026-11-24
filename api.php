<?php
/**
 * REST API приложения. Пути и формат ответов совпадают с исходным проектом.
 * Платёжный шлюз намеренно не реализован (см. lib/payment_gateway.php).
 */

require_once __DIR__ . '/bootstrap.php';

header('Bypass-Tunnel-Reminder: true');

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$path   = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$path   = rtrim($path, '/');
if ($path === '') {
    $path = '/';
}

/** Простой роутер: маршрут + метод. */
function route(string $method, string $pattern, callable $handler, string $requestMethod, string $path): void
{
    if (strtoupper($method) !== $requestMethod) {
        return;
    }
    $regex = '#^' . str_replace(['\{id\}', '\{chatId\}', '\{targetType\}', '\{targetId\}'], ['([^/]+)', '([^/]+)', '([^/]+)', '([^/]+)'], preg_quote($pattern, '#')) . '$#';
    $regex = str_replace(['\\\{id\\\}', '\\\{chatId\\\}', '\\\{targetType\\\}', '\\\{targetId\\\}'], ['([^/]+)', '([^/]+)', '([^/]+)', '([^/]+)'], $regex);
    if (preg_match($regex, $path, $matches)) {
        array_shift($matches);
        $handler(...$matches);
        exit;
    }
}

function route_regex(string $pattern, callable $handler): void
{
    global $method, $path;
    [$m, $p] = explode(' ', $pattern, 2);
    if (strtoupper($m) !== $method) {
        return;
    }
    $regex = '#^' . preg_replace('#\\\\\{(\w+)\\\\\}#', '([^/]+)', preg_quote($p, '#')) . '$#';
    if (preg_match($regex, $path, $matches)) {
        array_shift($matches);
        $handler(...$matches);
        exit;
    }
}

/** Выполнить обработчик с единой обработкой исключений. */
function handle(callable $fn, int $errorStatus = 400): void
{
    try {
        $fn();
    } catch (Throwable $e) {
        json_error($e->getMessage() ?: 'Внутренняя ошибка сервера', $errorStatus);
    }
}

$r = repo();

// ---------------------------------------------------------------- Авторизация

route_regex('POST /api/auth/send-email-code', function () {
    handle(function () {
        $email = trim((string)input('email', ''));
        if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            json_error('Укажите корректный email адрес', 400);
        }

        $code = (string)random_int(100000, 999999);
        repo()->saveEmailCode($email, $code);

        $sent = mailer_send_verification_code($email, $code);
        if (!$sent['success']) {
            repo()->deleteEmailCode($email);
            error_log('Email verification delivery failed: ' . $sent['error']);
            json_error('Не удалось отправить код подтверждения. Проверьте настройки SMTP и доступ к почтовому серверу.', 500);
        }

        json_response([
            'success'   => true,
            'emailSent' => true,
            'message'   => 'Одноразовый код выслан на ' . $email,
        ]);
    }, 500);
});

route_regex('POST /api/auth/verify-email-code', function () {
    handle(function () {
        $email = trim((string)input('email', ''));
        $code  = trim((string)input('code', ''));
        if ($email === '' || $code === '') {
            json_error('Email и код обязательны', 400);
        }
        if (!repo()->verifyEmailCode($email, $code)) {
            json_error('Неверный или просроченный код подтверждения', 400);
        }
        $_SESSION['verified_email'] = mb_strtolower($email);
        json_response(['success' => true, 'message' => 'Email успешно подтвержден']);
    }, 500);
});

route_regex('POST /api/auth/register', function () {
    handle(function () {
        $email = trim((string)input('email', ''));
        $name  = trim((string)input('name', ''));
        $role  = (string)input('role', 'client');

        if ($email === '' || $name === '' || $role === '') {
            json_error('Пожалуйста, заполните все обязательные поля', 400);
        }
        $verifiedEmail = (string)($_SESSION['verified_email'] ?? '');
        if ($verifiedEmail === '' || !hash_equals(mb_strtolower($email), $verifiedEmail)) {
            json_error('Сначала подтвердите email кодом', 403);
        }
        if (!in_array($role, ['client', 'master'], true)) {
            $role = 'client';
        }
        $adminEmail = trim((string)config('admin.email', ''));
        $isConfiguredAdmin = $adminEmail !== '' && strcasecmp($email, $adminEmail) === 0;
        if ($isConfiguredAdmin) {
            $role = 'admin';
        }
        if (repo()->findUserByEmail($email)) {
            json_error('Пользователь с таким email уже зарегистрирован', 400);
        }

        $user = repo()->createUser([
            'email'    => $email,
            'phone'    => (string)input('phone', '+7 (900) 000-00-00'),
            'name'     => $name,
            'role'     => $role,
            'avatar'   => default_avatar(),
            'city'     => (string)input('city', 'Москва'),
            'district' => (string)input('district', 'Центральный'),
            'specialty' => $role === 'master' ? (string)input('specialty', 'Бьюти-мастер') : null,
            'balance'  => 0,
            'password' => (string)input('password', ''),
        ]);

        repo()->deleteEmailCode($email);
        unset($_SESSION['verified_email']);
        auth_login($user['id']);
        json_response(['success' => true, 'user' => $user]);
    }, 500);
});

route_regex('POST /api/auth/login', function () {
    handle(function () {
        // Вход по email или по логину (для технических/служебных учёток).
        $login    = trim((string)input('email', ''));
        $password = (string)input('password', '');
        $user     = repo()->findUserByEmail($login);

        if (!$user) {
            json_error('Неверный логин или пароль', 401);
        }
        if (!empty($user['isBlocked'])) {
            json_error('Учётная запись заблокирована. Обратитесь в поддержку.', 403);
        }
        if (!repo()->verifyPassword($user['id'], $password)) {
            json_error('Неверный логин или пароль', 401);
        }

        $adminEmail = trim((string)config('admin.email', ''));
        if ($adminEmail !== '' && strcasecmp((string)$user['email'], $adminEmail) === 0 && $user['role'] !== 'admin') {
            repo()->setUserRole($user['id'], 'admin');
        }
        auth_login($user['id']);
        $user = repo()->findUserById($user['id']);
        json_response(['success' => true, 'user' => $user]);
    }, 500);
});

route_regex('POST /api/auth/logout', function () {
    auth_logout();
    json_response(['success' => true]);
});

route_regex('GET /api/auth/me', function () {
    json_response(['user' => current_user()]);
});

route_regex('GET /api/auth/user/{id}', function ($id) {
    $user = repo()->findUserById($id);
    if (!$user) {
        json_error('Пользователь не найден', 404);
    }
    json_response(['user' => $user]);
});

route_regex('PUT /api/users/profile', function () {
    handle(function () {
        $data = request_input();
        $id   = acting_user_id($data['id'] ?? null);
        if (!$id) {
            json_error('ID пользователя обязателен', 400);
        }
        unset($data['id'], $data['password'], $data['role']);

        $updated = repo()->updateUser($id, $data);
        if (!$updated) {
            json_error('Пользователь не найден', 404);
        }
        json_response(['success' => true, 'user' => $updated]);
    }, 500);
});

// ---------------------------------------------------------------- Кошелёк

route_regex('POST /api/users/top-up-balance', function () {
    handle(function () {
        $data   = request_input();
        $userId = acting_user_id($data['userId'] ?? null);
        $amount = (float)($data['amount'] ?? 0);
        if (!$userId || $amount <= 0) {
            json_error('userId и amount обязательны', 400);
        }

        $result = repo()->topUpBalance($userId, $amount);
        $r = repo();
        $r->pushEvent('BALANCE_UPDATED', ['userId' => $result['user']['id'], 'balance' => $result['user']['balance'], 'transaction' => $result['transaction']], [$result['user']['id']]);

        json_response(['success' => true, 'user' => $result['user'], 'transaction' => $result['transaction']]);
    }, 500);
});

route_regex('GET /api/users/transactions', function () {
    $userId = $_GET['userId'] ?? null;
    json_response(['transactions' => repo()->getTransactions($userId)]);
});

// ---------------------------------------------------------------- Мастера

route_regex('GET /api/masters/search', function () {
    $filters = [
        'query'     => $_GET['query'] ?? null,
        'category'  => $_GET['category'] ?? null,
        'district'  => $_GET['district'] ?? null,
        'minPrice'  => isset($_GET['minPrice']) && $_GET['minPrice'] !== '' ? (float)$_GET['minPrice'] : null,
        'maxPrice'  => isset($_GET['maxPrice']) && $_GET['maxPrice'] !== '' ? (float)$_GET['maxPrice'] : null,
        'minRating' => isset($_GET['minRating']) && $_GET['minRating'] !== '' ? (float)$_GET['minRating'] : null,
    ];
    json_response(['masters' => repo()->searchMasters($filters)]);
});

route_regex('GET /api/masters/{id}', function ($id) {
    $master = repo()->findUserById($id);
    if (!$master || $master['role'] !== 'master') {
        json_error('Мастер не найден', 404);
    }

    $services = repo()->getMasterServices($master['id']);
    $viewerId = $_GET['userId'] ?? current_user_id();
    $works    = array_values(array_filter(repo()->getWorks($viewerId), fn($w) => $w['masterId'] === $master['id']));

    $reviews = [];
    foreach (repo()->getBookingsForUser($master['id'], 'master') as $b) {
        if (!empty($b['masterRating']) && !empty($b['reviewText'])) {
            $reviews[] = [
                'id'          => $b['id'],
                'clientName'  => $b['clientName'],
                'clientAvatar' => $b['clientAvatar'],
                'rating'      => $b['masterRating'],
                'text'        => $b['reviewText'],
                'date'        => $b['date'],
                'serviceTitle' => $b['serviceTitle'],
            ];
        }
    }

    json_response([
        'master'   => $master,
        'services' => $services,
        'works'    => $works,
        'schedule' => repo()->getMasterSchedule($master['id']),
        'reviews'  => $reviews,
    ]);
});

// ---------------------------------------------------------------- Портфолио

route_regex('GET /api/portfolio', function () {
    $userId = $_GET['userId'] ?? current_user_id();
    json_response(['works' => repo()->getWorks($userId)]);
});

route_regex('POST /api/portfolio', function () {
    handle(function () {
        $data     = request_input();
        $masterId = acting_user_id($data['masterId'] ?? null);
        $master   = $masterId ? repo()->findUserById($masterId) : null;

        if (!$master || $master['role'] !== 'master') {
            json_error('Только мастера могут добавлять работы', 403);
        }

        // Публикация объявления: списываем слот подписки (или разрешаем бесплатно,
        // если оплата объявлений отключена администратором).
        try {
            $paidUntil = repo()->consumeListingForWork($master['id']);
        } catch (RuntimeException $e) {
            if ($e->getMessage() === 'PAYMENT_REQUIRED') {
                json_error('PAYMENT_REQUIRED', 402);
            }
            throw $e;
        }

        $images = array_values(array_filter((array)($data['images'] ?? []), fn($i) => is_string($i) && $i !== ''));
        if (!$images) {
            $images = ['https://images.unsplash.com/photo-1604654894610-df63bc536371?w=800&auto=format&fit=crop&q=80'];
        }

        $work = repo()->addWork([
            'masterId'        => $master['id'],
            'masterName'      => $master['name'],
            'masterAvatar'    => $master['avatar'],
            'masterSpecialty' => $master['specialty'] ?? null,
            'masterDistrict'  => $master['district'] ?? '',
            'title'           => (string)($data['title'] ?? 'Работа'),
            'description'     => (string)($data['description'] ?? ''),
            'category'        => (string)($data['category'] ?? 'Красота'),
            'images'          => $images,
            'price'           => isset($data['price']) && $data['price'] !== '' ? (float)$data['price'] : null,
            'paidUntil'       => $paidUntil,
        ]);

        repo()->pushEvent('WORK_ADDED', $work);
        json_response(['success' => true, 'work' => $work]);
    }, 500);
});

route_regex('POST /api/portfolio/{id}/like', function ($id) {
    handle(function () use ($id) {
        $userId = acting_user_id(input('userId'));
        if (!$userId) {
            json_error('userId обязателен', 400);
        }
        $result = repo()->toggleLike($userId, $id, 'work');
        repo()->pushEvent('WORK_LIKED', array_merge(['workId' => $id], $result));
        json_response($result);
    }, 500);
});

route_regex('DELETE /api/portfolio/{id}', function ($id) {
    $ok = repo()->deleteWork($id);
    if ($ok) {
        repo()->pushEvent('WORK_DELETED', ['workId' => $id]);
    }
    json_response(['success' => $ok]);
});

// ---------------------------------------------------------------- Посты и комментарии

route_regex('POST /api/posts/{id}/like', function ($id) {
    handle(function () use ($id) {
        $userId = acting_user_id(input('userId'));
        if (!$userId) {
            json_error('userId обязателен', 400);
        }
        $result = repo()->toggleLike($userId, $id, 'post');
        repo()->pushEvent('POST_LIKED', array_merge(['postId' => $id], $result));
        json_response($result);
    }, 500);
});

route_regex('GET /api/comments/{targetType}/{targetId}', function ($targetType, $targetId) {
    json_response(['comments' => repo()->getComments($targetId)]);
});

route_regex('POST /api/comments', function () {
    handle(function () {
        $data   = request_input();
        $authorId = acting_user_id($data['authorId'] ?? null);
        $author = $authorId ? repo()->findUserById($authorId) : null;
        if (!$author) {
            json_error('Автор не найден', 404);
        }

        $comment = repo()->addComment([
            'targetId'     => (string)($data['targetId'] ?? ''),
            'targetType'   => (string)($data['targetType'] ?? 'work'),
            'authorId'     => $author['id'],
            'authorName'   => $author['name'],
            'authorAvatar' => $author['avatar'],
            'authorRole'   => $author['role'],
            'text'         => (string)($data['text'] ?? ''),
        ]);

        repo()->pushEvent('COMMENT_ADDED', [
            'comment'    => $comment,
            'targetId'   => $comment['targetId'],
            'targetType' => $comment['targetType'],
        ]);

        json_response(['success' => true, 'comment' => $comment]);
    }, 500);
});

route_regex('GET /api/posts', function () {
    $userId = $_GET['userId'] ?? current_user_id();
    json_response(['posts' => repo()->getPosts($userId)]);
});

route_regex('POST /api/posts', function () {
    handle(function () {
        $data   = request_input();
        $authorId = acting_user_id($data['authorId'] ?? null);
        $author = $authorId ? repo()->findUserById($authorId) : null;
        if (!$author) {
            json_error('Автор не найден', 404);
        }

        $images = array_values(array_filter((array)($data['images'] ?? []), fn($i) => is_string($i) && $i !== ''));
        $tags   = array_values(array_filter((array)($data['tags'] ?? []), fn($t) => is_string($t) && $t !== ''));

        $post = repo()->addPost([
            'authorId'        => $author['id'],
            'authorName'      => $author['name'],
            'authorAvatar'    => $author['avatar'],
            'authorRole'      => $author['role'],
            'authorSpecialty' => $author['specialty'] ?? null,
            'title'           => (string)($data['title'] ?? ''),
            'content'         => (string)($data['content'] ?? ''),
            'images'          => $images,
            'tags'            => $tags ?: ['бьюти', 'советы'],
        ]);

        repo()->pushEvent('POST_ADDED', $post);
        json_response(['success' => true, 'post' => $post]);
    }, 500);
});

route_regex('DELETE /api/posts/{id}', function ($id) {
    $ok = repo()->deletePost($id);
    if ($ok) {
        repo()->pushEvent('POST_DELETED', ['postId' => $id]);
    }
    json_response(['success' => $ok]);
});

// ---------------------------------------------------------------- Услуги и график

route_regex('GET /api/services/{masterId}', function ($masterId) {
    json_response(['services' => repo()->getMasterServices($masterId)]);
});

route_regex('POST /api/services', function () {
    handle(function () {
        $data = request_input();
        $masterId = acting_user_id($data['masterId'] ?? null);
        $data['masterId'] = $masterId;
        json_response(['success' => true, 'service' => repo()->addService($data)]);
    }, 500);
});

route_regex('DELETE /api/services/{id}', function ($id) {
    json_response(['success' => repo()->deleteService($id)]);
});

route_regex('GET /api/schedule/{masterId}', function ($masterId) {
    json_response(['schedule' => repo()->getMasterSchedule($masterId)]);
});

route_regex('PUT /api/schedule/{masterId}', function ($masterId) {
    handle(function () use ($masterId) {
        json_response(['success' => true, 'schedule' => repo()->updateMasterSchedule($masterId, request_input())]);
    }, 500);
});

// ---------------------------------------------------------------- Записи

route_regex('POST /api/bookings', function () {
    handle(function () {
        $data     = request_input();
        $clientId = acting_user_id($data['clientId'] ?? null);
        if (!$clientId) {
            json_error('Требуется авторизация', 401);
        }

        $result = repo()->createBooking([
            'clientId'            => $clientId,
            'masterId'            => (string)($data['masterId'] ?? ''),
            'serviceId'           => (string)($data['serviceId'] ?? ''),
            'date'                => (string)($data['date'] ?? ''),
            'timeSlot'            => (string)($data['timeSlot'] ?? ''),
            'notes'               => $data['notes'] ?? null,
            'allowDelayedPayment' => !empty($data['allowDelayedPayment']),
        ]);

        repo()->pushEvent('NEW_BOOKING', $result, [$result['booking']['masterId'], $result['booking']['clientId']]);
        repo()->pushEvent('BALANCE_UPDATED', ['userId' => $clientId, 'balance' => $result['clientBalance']], [$clientId]);

        $booking = $result['booking'];
        push_queue(
            [$booking['clientId'], $booking['masterId']],
            [
                'title' => 'Новая запись',
                'body'  => trim(($booking['clientName'] ?? 'Клиент') . ': ' . ($booking['serviceTitle'] ?? '') . ' • ' . ($booking['date'] ?? '') . ' ' . ($booking['timeSlot'] ?? '')),
                'url'   => '/?tab=profile',
                'tag'   => 'booking-' . $booking['id'],
            ],
            $clientId
        );

        json_response(array_merge(['success' => true], $result));
    }, 400);
});

route_regex('GET /api/bookings', function () {
    $userId = $_GET['userId'] ?? current_user_id();
    $role   = $_GET['role'] ?? 'client';
    if (!$userId) {
        json_error('userId и role обязательны', 400);
    }
    json_response(['bookings' => repo()->getBookingsForUser($userId, $role === 'master' ? 'master' : 'client')]);
});

route_regex('POST /api/bookings/{id}/complete', 'api_complete_booking');
route_regex('POST /api/appointments/{id}/complete', 'api_complete_booking');

function api_complete_booking(string $id): void
{
    handle(function () use ($id) {
        $data  = request_input();
        $actor = acting_user_id($data['userId'] ?? $data['masterId'] ?? null);
        $role  = $data['role'] ?? null;

        $result = repo()->completeBooking($id, $actor, $role);
        api_broadcast_booking($result);
        json_response(array_merge(['success' => true], $result));
    }, 400);
}

route_regex('POST /api/bookings/{id}/survey', function ($id) {
    handle(function () use ($id) {
        $data  = request_input();
        $actor = acting_user_id($data['userId'] ?? null);
        $role  = ($data['role'] ?? '') === 'master' ? 'master' : 'client';

        $result = repo()->submitBookingSurvey($id, (string)$actor, $role, (array)($data['survey'] ?? []), $data['evidence'] ?? null);
        api_broadcast_booking($result);
        json_response(array_merge(['success' => true], $result));
    }, 400);
});

route_regex('POST /api/bookings/{id}/pay', function ($id) {
    handle(function () use ($id) {
        $clientId = acting_user_id(input('clientId'));
        $result   = repo()->payDelayedBooking($id, (string)$clientId);
        api_broadcast_booking($result);
        repo()->pushEvent('BALANCE_UPDATED', ['userId' => $clientId, 'balance' => $result['clientBalance']], [$clientId]);
        json_response(array_merge(['success' => true], $result));
    }, 400);
});

route_regex('POST /api/bookings/{id}/cancel-authorization', function ($id) {
    handle(function () use ($id) {
        $result = repo()->cancelAppointmentAuthorization($id, (string)input('reason', 'Отмена записи пользователем'));
        api_broadcast_booking($result);
        if (isset($result['clientBalance'])) {
            repo()->pushEvent('BALANCE_UPDATED', ['userId' => $result['booking']['clientId'], 'balance' => $result['clientBalance']], [$result['booking']['clientId']]);
        }
        json_response(array_merge(['success' => true], $result));
    }, 400);
});

route_regex('POST /api/bookings/{id}/cancel', 'api_cancel_booking');
route_regex('POST /api/appointments/{id}/cancel', 'api_cancel_booking');

function api_cancel_booking(string $id): void
{
    handle(function () use ($id) {
        $result = repo()->cancelBooking($id);
        api_broadcast_booking($result);
        if (isset($result['clientBalance'])) {
            repo()->pushEvent('BALANCE_UPDATED', ['userId' => $result['booking']['clientId'], 'balance' => $result['clientBalance']], [$result['booking']['clientId']]);
        }
        json_response(array_merge(['success' => true], $result));
    }, 400);
}

route_regex('PUT /api/bookings/{id}/status', function ($id) {
    $status = (string)input('status', '');
    if ($status === 'completed') {
        api_complete_booking($id);
        return;
    }
    if ($status === 'canceled') {
        api_cancel_booking($id);
        return;
    }

    $booking = repo()->updateBookingStatus($id, $status);
    if (!$booking) {
        json_error('Запись не найдена', 404);
    }
    repo()->pushEvent('BOOKING_STATUS_CHANGED', $booking, [$booking['clientId'], $booking['masterId']]);
    json_response(['success' => true, 'booking' => $booking]);
});

route_regex('POST /api/bookings/{id}/rate', function ($id) {
    $booking = repo()->rateBooking($id, (string)input('raterRole', 'client'), (float)input('rating', 5), (string)input('reviewText', ''));
    if (!$booking) {
        json_error('Запись не найдена', 404);
    }
    json_response(['success' => true, 'booking' => $booking]);
});

route_regex('GET /api/bookings/{id}/fiscal-receipt', function ($id) {
    $booking = repo()->findBookingById($id);
    if (!$booking) {
        json_error('Запись не найдена', 404);
    }
    json_response([
        'success'       => true,
        'bookingId'     => $booking['id'],
        'isPaid'        => $booking['isPaid'],
        'status'        => $booking['status'],
        'masterInn'     => $booking['masterInn'] ?? null,
        'platformFee'   => $booking['platformFee'] ?? 0,
        'masterPayout'  => $booking['masterPayout'] ?? 0,
        'fiscalReceipt' => $booking['fiscalReceipt'] ?? null,
    ]);
});

route_regex('POST /api/bookings/{id}/resolve-dispute', function ($id) {
    handle(function () use ($id) {
        $decision = input('decision', 'client_refund') === 'master_payout' ? 'master_payout' : 'client_refund';
        $result   = repo()->resolveDispute($id, $decision, input('resolutionNotes'));
        api_broadcast_booking($result);
        foreach (['clientBalance' => 'clientId', 'masterBalance' => 'masterId'] as $key => $field) {
            if (isset($result[$key])) {
                repo()->pushEvent('BALANCE_UPDATED', ['userId' => $result['booking'][$field], 'balance' => $result[$key]], [$result['booking'][$field]]);
            }
        }
        json_response(array_merge(['success' => true], $result));
    }, 400);
});

/** Общая рассылка событий по записи. */
function api_broadcast_booking(array $result): void
{
    $booking = $result['booking'] ?? null;
    if (!$booking) {
        return;
    }
    repo()->pushEvent('BOOKING_STATUS_CHANGED', $booking, [$booking['clientId'], $booking['masterId']]);
    if (!empty($result['isFullyCompleted']) && isset($result['masterBalance'])) {
        repo()->pushEvent('BALANCE_UPDATED', ['userId' => $booking['masterId'], 'balance' => $result['masterBalance']], [$booking['masterId']]);
    }
}

// ---------------------------------------------------------------- Отзывы

route_regex('GET /api/reviews/{userId}', function ($userId) {
    json_response(['reviews' => repo()->getUserReviews($userId)]);
});

route_regex('POST /api/reviews', function () {
    handle(function () {
        $data = request_input();
        $authorId = acting_user_id($data['authorId'] ?? null);
        $review = repo()->addReview([
            'bookingId'    => (string)($data['bookingId'] ?? ''),
            'authorId'     => (string)$authorId,
            'targetUserId' => (string)($data['targetUserId'] ?? ''),
            'rating'       => (float)($data['rating'] ?? 5),
            'text'         => (string)($data['text'] ?? ''),
        ]);
        repo()->pushEvent('REVIEW_ADDED', $review, [$review['targetUserId'], $review['authorId']]);
        json_response(['success' => true, 'review' => $review]);
    }, 400);
});

// ---------------------------------------------------------------- Чаты

route_regex('GET /api/chats', function () {
    $userId = $_GET['userId'] ?? current_user_id();
    if (!$userId) {
        json_error('userId обязателен', 400);
    }
    json_response(['chats' => repo()->getUserChats($userId)]);
});

route_regex('GET /api/chats/{chatId}/messages', function ($chatId) {
    json_response(['messages' => repo()->getChatMessages($chatId)]);
});

route_regex('POST /api/chats/{chatId}/messages', function ($chatId) {
    handle(function () use ($chatId) {
        $data     = request_input();
        $senderId = acting_user_id($data['senderId'] ?? null);
        if (!$senderId) {
            json_error('Требуется авторизация', 401);
        }

        $message = repo()->sendMessage([
            'chatId'   => $chatId,
            'senderId' => $senderId,
            'text'     => (string)($data['text'] ?? ''),
            'imageUrl' => $data['imageUrl'] ?? null,
        ]);

        $chat = repo()->findChatById($chatId);
        if ($chat) {
            // Событие и push уходят только собеседнику — отправителю своё сообщение не напоминаем.
            $recipientId = (string)$senderId === (string)$chat['clientId']
                ? (string)$chat['masterId']
                : (string)$chat['clientId'];
            repo()->pushEvent('NEW_CHAT_MESSAGE', ['message' => $message, 'chat' => $chat], [$recipientId]);
            push_queue(
                [$recipientId],
                [
                    'title'  => (string)($message['senderName'] ?? 'Новое сообщение'),
                    'body'   => trim((string)($message['text'] ?? '')) !== '' ? (string)$message['text'] : '📷 Фото-референс',
                    'url'    => '/?tab=chats&chat=' . rawurlencode($chatId),
                    'tag'    => 'chat-' . $chatId,
                    'chatId' => $chatId,
                ],
                $senderId
            );
        }
        json_response(['success' => true, 'message' => $message]);
    }, 500);
});

route_regex('POST /api/chats/{chatId}/read', function ($chatId) {
    $readerId = (string)acting_user_id(input('userId'));
    repo()->markChatRead($chatId, $readerId);
    // Уведомляем собеседника, чтобы у него галочки стали «прочитано».
    $chat = repo()->findChatById($chatId);
    if ($chat) {
        $otherId = $readerId === (string)$chat['clientId'] ? (string)$chat['masterId'] : (string)$chat['clientId'];
        repo()->pushEvent('MESSAGES_READ', ['chatId' => $chatId, 'readerId' => $readerId], [$otherId]);
    }
    json_response(['success' => true]);
});

// ---------------------------------------------------------------- Статистика

route_regex('GET /api/stats/master/{masterId}', function ($masterId) {
    $period = $_GET['period'] ?? 'month';
    json_response(['stats' => repo()->getMasterStats($masterId, $period)]);
});

// ---------------------------------------------------------------- Realtime (long-poll поверх очереди событий)

route_regex('GET /api/site/settings', function () {
    json_response(admin_site_settings());
});

route_regex('GET /api/admin/settings', function () {
    admin_require_user();
    $current = admin_site_settings();
    json_response([
        'settings' => $current['settings'],
        'revision' => $current['revision'],
        'history' => admin_site_history(),
    ]);
});

route_regex('POST /api/admin/settings/publish', function () {
    handle(function () {
        $admin = admin_require_user();
        $data = request_input();
        $result = admin_publish_settings(
            is_array($data['settings'] ?? null) ? $data['settings'] : [],
            $admin['email'],
            (int)($data['expectedRevision'] ?? -1),
            trim((string)($data['summary'] ?? 'Обновлены настройки сайта')) ?: 'Обновлены настройки сайта'
        );
        if ($result['conflict']) {
            json_error('Настройки уже изменились в другой сессии. Обновите страницу и повторите изменения.', 409);
        }
        json_response(['success' => true, 'revision' => $result['revision'], 'historyId' => $result['historyId']]);
    }, 500);
});

route_regex('POST /api/admin/settings/rollback', function () {
    handle(function () {
        $admin = admin_require_user();
        $data = request_input();
        $result = admin_rollback_settings(
            (int)($data['historyId'] ?? 0),
            $admin['email'],
            (int)($data['expectedRevision'] ?? -1)
        );
        if (!empty($result['notFound'])) {
            json_error('Версия настроек не найдена', 404);
        }
        if (!empty($result['conflict'])) {
            json_error('Настройки уже изменились в другой сессии. Обновите страницу и повторите откат.', 409);
        }
        json_response(['success' => true, 'revision' => $result['revision'], 'historyId' => $result['historyId']]);
    }, 500);
});

route_regex('GET /api/events/poll', function () {
    $userId = $_GET['userId'] ?? current_user_id();
    $since  = (int)($_GET['since'] ?? 0);
    $events = repo()->pollEvents($userId, $since);
    json_response(['events' => $events['items'], 'lastId' => $events['lastId']]);
});

// ---------------------------------------------------------------- Push-уведомления (PWA)

route_regex('GET /api/push/config', function () {
    $publicKey = webpush_available() ? webpush_public_key() : null;
    json_response([
        'enabled'   => $publicKey !== null,
        'publicKey' => $publicKey,
    ]);
});

route_regex('POST /api/push/subscribe', function () {
    handle(function () {
        $userId = current_user_id();
        if (!$userId) {
            json_error('Требуется авторизация', 401);
        }

        $data = request_input();
        $subscription = is_array($data['subscription'] ?? null) ? $data['subscription'] : $data;
        $keys = is_array($subscription['keys'] ?? null) ? $subscription['keys'] : $subscription;

        $endpoint = trim((string)($subscription['endpoint'] ?? ''));
        if (!preg_match('#^https://#i', $endpoint)) {
            json_error('Некорректный адрес подписки', 400);
        }

        repo()->savePushSubscription($userId, [
            'endpoint'        => $endpoint,
            'publicKey'       => (string)($keys['p256dh'] ?? $keys['publicKey'] ?? ''),
            'authKey'         => (string)($keys['auth'] ?? $keys['authKey'] ?? ''),
            'contentEncoding' => (string)($subscription['contentEncoding'] ?? ''),
            'userAgent'       => (string)($_SERVER['HTTP_USER_AGENT'] ?? ''),
        ]);

        json_response(['success' => true]);
    }, 500);
});

route_regex('POST /api/push/unsubscribe', function () {
    $endpoint = trim((string)input('endpoint', ''));
    if ($endpoint !== '') {
        repo()->deletePushSubscription($endpoint);
    }
    json_response(['success' => true]);
});

// ---------------------------------------------------------------- Оплата объявлений (подписка мастера)

/** Доступ только для сотрудников (администратор или поддержка). */
function api_require_staff(): array
{
    $user = current_user();
    if (!$user || !in_array($user['role'] ?? '', ['admin', 'support'], true)) {
        json_error('Доступ только для сотрудников поддержки', 403);
    }
    return $user;
}

route_regex('GET /api/masters/listing/status', function () {
    $userId = $_GET['userId'] ?? current_user_id();
    if (!$userId) {
        json_error('userId обязателен', 400);
    }
    json_response(['listing' => repo()->masterListingStatus((string)$userId)]);
});

route_regex('GET /api/masters/listing/subscriptions', function () {
    $userId = $_GET['userId'] ?? current_user_id();
    if (!$userId) {
        json_error('userId обязателен', 400);
    }
    json_response(['subscriptions' => repo()->getMasterSubscriptions((string)$userId)]);
});

route_regex('POST /api/masters/listing/pay', function () {
    handle(function () {
        $data     = request_input();
        $masterId = acting_user_id($data['masterId'] ?? null);
        $master   = $masterId ? repo()->findUserById($masterId) : null;
        if (!$master || $master['role'] !== 'master') {
            json_error('Оплатить объявления может только мастер', 403);
        }
        $settings = repo()->listingSettings();
        if (!$settings['enabled']) {
            json_error('Оплата за объявления отключена администратором', 400);
        }
        if (!yookassa_is_configured()) {
            json_error('Платёжная система не настроена. Обратитесь к администратору.', 500);
        }

        $plan = (string)($data['plan'] ?? 'single') === 'pack' ? 'pack' : 'single';
        $sub  = repo()->createSubscription($master['id'], $plan);
        $description = $plan === 'pack'
            ? sprintf('Пакет до %d объявлений на месяц', (int)$sub['slotsTotal'])
            : 'Размещение одного объявления на месяц';

        $payment = yookassa_create_payment((float)$sub['amount'], $description, [
            'subscription_id' => $sub['id'],
            'master_id'       => $master['id'],
            'plan'            => $plan,
        ]);
        if (!$payment['ok']) {
            json_error($payment['error'] ?: 'Не удалось создать платёж', 502);
        }

        $paymentId = (string)($payment['data']['id'] ?? '');
        repo()->setSubscriptionPayment($sub['id'], $paymentId);
        $confirmationUrl = (string)($payment['data']['confirmation']['confirmation_url'] ?? '');

        json_response([
            'success'         => true,
            'subscription'    => repo()->findSubscriptionById($sub['id']),
            'paymentId'       => $paymentId,
            'confirmationUrl' => $confirmationUrl,
        ]);
    }, 500);
});

route_regex('POST /api/masters/listing/confirm', function () {
    handle(function () {
        $data  = request_input();
        $subId = (string)($data['subscriptionId'] ?? '');
        $sub   = $subId !== '' ? repo()->findSubscriptionById($subId) : null;
        if (!$sub) {
            json_error('Подписка не найдена', 404);
        }
        $paymentId = (string)($sub['paymentId'] ?? '');
        if ($paymentId === '') {
            json_error('Платёж ещё не создан', 400);
        }
        $res = yookassa_get_payment($paymentId);
        if (!$res['ok']) {
            json_error($res['error'] ?: 'Не удалось проверить платёж', 502);
        }
        $paymentStatus = (string)($res['data']['status'] ?? '');
        if ($paymentStatus === 'succeeded') {
            repo()->activateSubscription($sub['id'], $paymentId);
        } elseif ($paymentStatus === 'canceled') {
            repo()->cancelSubscription($sub['id']);
        }
        json_response([
            'success'       => true,
            'paymentStatus' => $paymentStatus,
            'listing'       => repo()->masterListingStatus((string)$sub['masterId']),
        ]);
    }, 500);
});

// ---------------------------------------------------------------- Поддержка

route_regex('GET /api/support/tickets', function () {
    $user = current_user();
    if (!$user) {
        json_error('Требуется авторизация', 401);
    }
    $isStaff = in_array($user['role'], ['admin', 'support'], true);
    $all     = $isStaff && (($_GET['scope'] ?? '') === 'all');
    json_response(['tickets' => repo()->getSupportTickets((string)$user['id'], $all)]);
});

route_regex('POST /api/support/tickets', function () {
    handle(function () {
        $user = current_user();
        if (!$user) {
            json_error('Требуется авторизация', 401);
        }
        $data = request_input();
        $ticket = repo()->createSupportTicket(
            (string)$user['id'],
            (string)($data['subject'] ?? ''),
            (string)($data['text'] ?? '')
        );
        json_response(['success' => true, 'ticket' => $ticket]);
    }, 400);
});

/** Проверить, что пользователь вправе работать с обращением. */
function api_support_guard(array $user, string $ticketId): array
{
    $ticket = repo()->findSupportTicket($ticketId);
    if (!$ticket) {
        json_error('Обращение не найдено', 404);
    }
    $isStaff = in_array($user['role'], ['admin', 'support'], true);
    if (!$isStaff && (string)$ticket['userId'] !== (string)$user['id']) {
        json_error('Нет доступа к этому обращению', 403);
    }
    return $ticket;
}

route_regex('GET /api/support/tickets/{id}/messages', function ($id) {
    $user = current_user();
    if (!$user) {
        json_error('Требуется авторизация', 401);
    }
    $ticket = api_support_guard($user, $id);
    json_response(['ticket' => $ticket, 'messages' => repo()->getSupportMessages($id)]);
});

route_regex('POST /api/support/tickets/{id}/messages', function ($id) {
    handle(function () use ($id) {
        $user = current_user();
        if (!$user) {
            json_error('Требуется авторизация', 401);
        }
        api_support_guard($user, $id);
        $data = request_input();
        $message = repo()->sendSupportMessage($id, (string)$user['id'], (string)($data['text'] ?? ''));
        json_response(['success' => true, 'message' => $message]);
    }, 400);
});

route_regex('POST /api/support/tickets/{id}/read', function ($id) {
    $user = current_user();
    if (!$user) {
        json_error('Требуется авторизация', 401);
    }
    api_support_guard($user, $id);
    repo()->markSupportRead($id, (string)$user['role']);
    json_response(['success' => true]);
});

// ---------------------------------------------------------------- Администрирование

route_regex('GET /api/admin/users', function () {
    admin_require_user();
    json_response(['users' => repo()->getAllUsers($_GET['role'] ?? null, $_GET['query'] ?? null)]);
});

route_regex('GET /api/admin/masters', function () {
    api_require_staff();
    json_response(['masters' => repo()->getAllMasters($_GET['query'] ?? null)]);
});

route_regex('POST /api/admin/users/block', function () {
    handle(function () {
        admin_require_user();
        $data = request_input();
        repo()->setUserBlocked((string)($data['userId'] ?? ''), !empty($data['blocked']));
        json_response(['success' => true]);
    }, 400);
});

route_regex('POST /api/admin/users/role', function () {
    handle(function () {
        admin_require_user();
        $data = request_input();
        $ok = repo()->setUserRole((string)($data['userId'] ?? ''), (string)($data['role'] ?? 'client'));
        json_response(['success' => $ok]);
    }, 400);
});

route_regex('POST /api/admin/masters/free-listing', function () {
    handle(function () {
        $staff = api_require_staff();
        $data  = request_input();
        // Технические учётки (поддержка) выдают бесплатное размещение только на 1 месяц.
        $months = $staff['role'] === 'admin' ? (int)($data['months'] ?? 1) : 1;
        $user   = repo()->grantFreeListing((string)($data['userId'] ?? ''), $months);
        if (!$user) {
            json_error('Пользователь не найден', 404);
        }
        json_response(['success' => true, 'user' => $user]);
    }, 400);
});

route_regex('POST /api/admin/users/technical', function () {
    handle(function () {
        admin_require_user();
        $data     = request_input();
        $login    = trim((string)($data['login'] ?? ''));
        $password = (string)($data['password'] ?? '');
        if ($login === '' || mb_strlen($password) < 4) {
            json_error('Укажите логин и пароль (минимум 4 символа)', 400);
        }
        if (repo()->findUserByLogin($login) || repo()->findUserByEmail($login)) {
            json_error('Логин уже занят', 400);
        }
        $user = repo()->createTechnicalUser([
            'login'    => $login,
            'password' => $password,
            'name'     => (string)($data['name'] ?? ''),
            'role'     => (string)($data['role'] ?? 'support'),
        ]);
        json_response(['success' => true, 'user' => $user]);
    }, 400);
});

// ---------------------------------------------------------------- Платёжный шлюз (только вебхук ЮKassa)

if (str_starts_with($path, '/api/payments') || str_starts_with($path, '/api/paymaster') || $path === '/webhook') {
    payment_gateway_handle($method, $path);
    exit;
}

json_error('Метод API не найден: ' . $method . ' ' . $path, 404);
