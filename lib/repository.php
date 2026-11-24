<?php
/**
 * Репозиторий: вся бизнес-логика приложения (порт french/database.ts на MySQL).
 * Возвращает массивы с ключами в camelCase — как в исходном API (src/types.ts).
 */

class Repository
{
    private PDO $pdo;

    public function __construct(PDO $pdo)
    {
        $this->pdo = $pdo;
    }

    // ================================================================
    //  Служебные хелперы
    // ================================================================

    private function q(string $sql, array $params = []): PDOStatement
    {
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        return $stmt;
    }

    private function one(string $sql, array $params = []): ?array
    {
        $row = $this->q($sql, $params)->fetch();
        return $row === false ? null : $row;
    }

    private function many(string $sql, array $params = []): array
    {
        return $this->q($sql, $params)->fetchAll();
    }

    private function scalar(string $sql, array $params = [])
    {
        $v = $this->q($sql, $params)->fetchColumn();
        return $v === false ? null : $v;
    }

    /** Разделение платежа: 4% платформе, 96% мастеру. */
    public static function calculatePaymentSplit(float $price): array
    {
        $platformFee  = round($price * 0.04, 2);
        $masterPayout = round($price * 0.96, 2);
        return ['platformFee' => $platformFee, 'masterPayout' => $masterPayout];
    }

    // ================================================================
    //  Преобразование строк БД → camelCase массивы
    // ================================================================

    private function mapUser(?array $r): ?array
    {
        if (!$r) {
            return null;
        }
        $privacy = json_decode_array($r['privacy_settings'] ?? null);
        if (!$privacy) {
            $privacy = ['hidePhone' => false, 'hideEmail' => true, 'allowDirectMessages' => true];
        }

        return [
            'id'                 => $r['id'],
            'email'              => $r['email'],
            'phone'              => $r['phone'] ?? '',
            'name'               => $r['name'] ?? '',
            'role'               => $r['role'],
            'avatar'             => $r['avatar'] ?? '',
            'city'               => $r['city'] ?? '',
            'district'           => $r['district'] ?? '',
            'balance'            => (float)($r['balance'] ?? 0),
            'bio'                => $r['bio'] ?? null,
            'specialty'          => $r['specialty'] ?? null,
            'rating'             => $r['rating'] !== null ? (float)$r['rating'] : null,
            'reviewCount'        => (int)($r['review_count'] ?? 0),
            'clientRating'       => $r['client_rating'] !== null ? (float)$r['client_rating'] : null,
            'clientReviewCount'  => (int)($r['client_review_count'] ?? 0),
            'address'            => $r['address'] ?? null,
            'experienceYears'    => $r['experience_years'] !== null ? (int)$r['experience_years'] : null,
            'inn'                => $r['inn'] ?? null,
            'allowDelayedPayment' => (bool)($r['allow_delayed_payment'] ?? false),
            'privacySettings'    => $privacy,
            'login'              => $r['login'] ?? null,
            'isBlocked'          => (bool)($r['is_blocked'] ?? false),
            'listingFreeUntil'   => $r['listing_free_until'] ?? null,
            'createdAt'          => $r['created_at'] ?? '',
        ];
    }

    private function mapService(array $r): array
    {
        return [
            'id'           => $r['id'],
            'masterId'     => $r['master_id'],
            'title'        => $r['title'] ?? '',
            'category'     => $r['category'] ?? '',
            'price'        => (float)($r['price'] ?? 0),
            'durationMins' => (int)($r['duration_mins'] ?? 60),
            'description'  => $r['description'] ?? null,
        ];
    }

    private function mapWork(array $r, ?string $userId = null): array
    {
        return [
            'id'                  => $r['id'],
            'masterId'            => $r['master_id'],
            'masterName'          => $r['master_name'] ?? '',
            'masterAvatar'        => $r['master_avatar'] ?? '',
            'masterSpecialty'     => $r['master_specialty'] ?? null,
            'masterDistrict'      => $r['master_district'] ?? '',
            'title'               => $r['title'] ?? '',
            'description'         => $r['description'] ?? '',
            'category'            => $r['category'] ?? '',
            'images'              => json_decode_array($r['images'] ?? null),
            'price'               => $r['price'] !== null ? (float)$r['price'] : null,
            'paidUntil'           => $r['paid_until'] ?? null,
            'archived'            => (int)($r['archived'] ?? 0) === 1,
            'expiredNotified'     => (int)($r['expired_notified'] ?? 0) === 1,
            'likesCount'          => (int)($r['likes_count'] ?? 0),
            'likedByCurrentUser'  => $userId !== null ? $this->isLiked($userId, $r['id']) : false,
            'commentsCount'       => (int)($r['comments_count'] ?? 0),
            'createdAt'           => $r['created_at'] ?? '',
        ];
    }

    private function mapPost(array $r, ?string $userId = null): array
    {
        return [
            'id'                  => $r['id'],
            'authorId'            => $r['author_id'],
            'authorName'          => $r['author_name'] ?? '',
            'authorAvatar'        => $r['author_avatar'] ?? '',
            'authorRole'          => $r['author_role'] ?? 'client',
            'authorSpecialty'     => $r['author_specialty'] ?? null,
            'title'               => $r['title'] ?? '',
            'content'             => $r['content'] ?? '',
            'images'              => json_decode_array($r['images'] ?? null),
            'tags'                => json_decode_array($r['tags'] ?? null),
            'likesCount'          => (int)($r['likes_count'] ?? 0),
            'likedByCurrentUser'  => $userId !== null ? $this->isLiked($userId, $r['id']) : false,
            'commentsCount'       => (int)($r['comments_count'] ?? 0),
            'createdAt'           => $r['created_at'] ?? '',
        ];
    }

    private function mapComment(array $r): array
    {
        return [
            'id'           => $r['id'],
            'targetId'     => $r['target_id'],
            'targetType'   => $r['target_type'],
            'authorId'     => $r['author_id'] ?? '',
            'authorName'   => $r['author_name'] ?? '',
            'authorAvatar' => $r['author_avatar'] ?? '',
            'authorRole'   => $r['author_role'] ?? 'client',
            'text'         => $r['text'] ?? '',
            'createdAt'    => $r['created_at'] ?? '',
        ];
    }

    private function mapBooking(array $r): array
    {
        $b = [
            'id'                  => $r['id'],
            'clientId'            => $r['client_id'],
            'clientName'          => $r['client_name'] ?? '',
            'clientPhone'         => $r['client_phone'] ?? '',
            'clientAvatar'        => $r['client_avatar'] ?? '',
            'masterId'            => $r['master_id'],
            'masterName'          => $r['master_name'] ?? '',
            'masterAvatar'        => $r['master_avatar'] ?? '',
            'masterAddress'       => $r['master_address'] ?? null,
            'masterInn'           => $r['master_inn'] ?? null,
            'serviceId'           => $r['service_id'] ?? '',
            'serviceTitle'        => $r['service_title'] ?? '',
            'servicePrice'        => (float)($r['service_price'] ?? 0),
            'serviceDurationMins' => (int)($r['service_duration_mins'] ?? 0),
            'date'                => $r['booking_date'] ?? '',
            'timeSlot'            => $r['time_slot'] ?? '',
            'status'              => $r['status'],
            'isPaid'              => (bool)($r['is_paid'] ?? false),
            'platformFee'         => (float)($r['platform_fee'] ?? 0),
            'masterPayout'        => (float)($r['master_payout'] ?? 0),
            'paymentMethod'       => $r['payment_method'] ?? null,
            'yookassaPaymentId'   => $r['payment_id'] ?? null,
            'yookassaPaymentUrl'  => $r['payment_url'] ?? null,
            'yookassaStatus'      => $r['payment_status'] ?? null,
            'paymasterStatus'     => $r['payment_status'] ?? null,
            'allowDelayedPayment' => (bool)($r['allow_delayed_payment'] ?? false),
            'clientCompleted'     => (bool)($r['client_completed'] ?? false),
            'clientCompletedAt'   => $r['client_completed_at'] ?? null,
            'masterCompleted'     => (bool)($r['master_completed'] ?? false),
            'masterCompletedAt'   => $r['master_completed_at'] ?? null,
            'notes'               => $r['notes'] ?? null,
            'createdAt'           => $r['created_at'] ?? '',
        ];

        $fiscal = $r['fiscal_receipt'] ?? null;
        if ($fiscal !== null && $fiscal !== '') {
            $decoded = json_decode((string)$fiscal, true);
            if (is_array($decoded)) {
                $b['fiscalReceiptJson'] = $decoded;
            }
        }

        if (!empty($r['payment_deadline'])) {
            $b['paymentDeadline'] = $r['payment_deadline'];
        }
        if (!empty($r['client_survey'])) {
            $s = json_decode((string)$r['client_survey'], true);
            if (is_array($s)) {
                $b['clientSurvey'] = $s;
            }
        }
        if (!empty($r['master_survey'])) {
            $s = json_decode((string)$r['master_survey'], true);
            if (is_array($s)) {
                $b['masterSurvey'] = $s;
            }
        }
        if (!empty($r['dispute'])) {
            $d = json_decode((string)$r['dispute'], true);
            if (is_array($d)) {
                $b['dispute'] = $d;
            }
        }
        if ($r['client_rating'] !== null) {
            $b['clientRating'] = (float)$r['client_rating'];
        }
        if ($r['master_rating'] !== null) {
            $b['masterRating'] = (float)$r['master_rating'];
        }
        if (!empty($r['review_text'])) {
            $b['reviewText'] = $r['review_text'];
        }

        return $b;
    }

    private function mapTransaction(array $r): array
    {
        return [
            'id'                 => $r['id'],
            'type'               => $r['type'],
            'bookingId'          => $r['booking_id'] ?? null,
            'userId'             => $r['user_id'] ?? '',
            'userName'           => $r['user_name'] ?? '',
            'amount'             => (float)($r['amount'] ?? 0),
            'commissionFee'      => $r['commission_fee'] !== null ? (float)$r['commission_fee'] : null,
            'description'        => $r['description'] ?? '',
            'yookassaPaymentId'  => $r['payment_ref'] ?? null,
            'payoutDestination'  => $r['payout_destination'] ?? null,
            'status'             => $r['status'] ?? null,
            'createdAt'          => $r['created_at'] ?? '',
        ];
    }

    private function mapReview(array $r): array
    {
        return [
            'id'             => $r['id'],
            'bookingId'      => $r['booking_id'] ?? '',
            'authorId'       => $r['author_id'] ?? '',
            'authorName'     => $r['author_name'] ?? '',
            'authorAvatar'   => $r['author_avatar'] ?? '',
            'authorRole'     => $r['author_role'] ?? 'client',
            'targetUserId'   => $r['target_user_id'] ?? '',
            'targetUserName' => $r['target_user_name'] ?? '',
            'rating'         => (float)($r['rating'] ?? 0),
            'text'           => $r['text'] ?? '',
            'createdAt'      => $r['created_at'] ?? '',
        ];
    }

    private function mapChat(array $r): array
    {
        return [
            'id'                => $r['id'],
            'bookingId'         => $r['booking_id'] ?? '',
            'clientId'          => $r['client_id'],
            'clientName'        => $r['client_name'] ?? '',
            'clientAvatar'      => $r['client_avatar'] ?? '',
            'masterId'          => $r['master_id'],
            'masterName'        => $r['master_name'] ?? '',
            'masterAvatar'      => $r['master_avatar'] ?? '',
            'serviceTitle'      => $r['service_title'] ?? '',
            'bookingDate'       => $r['booking_date'] ?? '',
            'bookingTimeSlot'   => $r['booking_time_slot'] ?? '',
            'bookingPrice'      => (float)($r['booking_price'] ?? 0),
            'lastMessage'       => $r['last_message'] ?? null,
            'lastMessageTime'   => $r['last_message_time'] ?? null,
            'lastMessageSenderId' => $r['last_message_sender_id'] ?? null,
            'unreadCountClient' => (int)($r['unread_count_client'] ?? 0),
            'unreadCountMaster' => (int)($r['unread_count_master'] ?? 0),
        ];
    }

    private function mapMessage(array $r): array
    {
        $m = [
            'id'           => $r['id'],
            'chatId'       => $r['chat_id'],
            'senderId'     => $r['sender_id'] ?? '',
            'senderName'   => $r['sender_name'] ?? '',
            'senderAvatar' => $r['sender_avatar'] ?? '',
            'text'         => $r['text'] ?? '',
            'createdAt'    => $r['created_at'] ?? '',
            'readAt'       => $r['read_at'] ?? null,
        ];
        if (!empty($r['image_url'])) {
            $m['imageUrl'] = $r['image_url'];
        }
        return $m;
    }

    // ================================================================
    //  Коды подтверждения email
    // ================================================================

    public function saveEmailCode(string $email, string $code): void
    {
        $expires = (int)round(microtime(true) * 1000) + 5 * 60 * 1000; // 5 минут
        $this->q(
            'INSERT INTO email_codes (email, code, expires_at) VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE code = VALUES(code), expires_at = VALUES(expires_at)',
            [mb_strtolower($email), $code, $expires]
        );
    }

    public function deleteEmailCode(string $email): void
    {
        $this->q('DELETE FROM email_codes WHERE email = ?', [mb_strtolower($email)]);
    }

    public function verifyEmailCode(string $email, string $code): bool
    {
        $email = mb_strtolower($email);
        $row   = $this->one('SELECT code, expires_at FROM email_codes WHERE email = ?', [$email]);
        if (!$row) {
            return false;
        }
        if ((int)round(microtime(true) * 1000) > (int)$row['expires_at']) {
            $this->q('DELETE FROM email_codes WHERE email = ?', [$email]);
            return false;
        }
        if (trim((string)$row['code']) === trim($code)) {
            return true;
        }
        return false;
    }

    // ================================================================
    //  Пользователи / авторизация
    // ================================================================

    public function findUserByEmail(string $email): ?array
    {
        $row = $this->one('SELECT * FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1', [trim($email)]);
        if ($row) {
            return $this->mapUser($row);
        }
        // Технические учётки входят по логину, введённому в поле email.
        $row = $this->one('SELECT * FROM users WHERE login IS NOT NULL AND LOWER(login) = LOWER(?) LIMIT 1', [trim($email)]);
        return $this->mapUser($row);
    }

    public function findUserByLogin(string $login): ?array
    {
        $row = $this->one('SELECT * FROM users WHERE login IS NOT NULL AND LOWER(login) = LOWER(?) LIMIT 1', [trim($login)]);
        return $this->mapUser($row);
    }

    public function findUserById(string $id): ?array
    {
        $row = $this->one('SELECT * FROM users WHERE id = ? LIMIT 1', [$id]);
        return $this->mapUser($row);
    }

    public function setUserRole(string $id, string $role): bool
    {
        if (!in_array($role, ['client', 'master', 'admin', 'support'], true)) {
            return false;
        }
        $this->q('UPDATE users SET role = ? WHERE id = ?', [$role, $id]);
        return true;
    }

    public function setUserBlocked(string $id, bool $blocked): bool
    {
        $this->q('UPDATE users SET is_blocked = ? WHERE id = ?', [$blocked ? 1 : 0, $id]);
        return true;
    }

    public function verifyPassword(string $userId, string $password): bool
    {
        $hash = $this->scalar('SELECT password_hash FROM users WHERE id = ?', [$userId]);
        if (!$hash) {
            return true; // пароль не задан — вход по email, как в исходном проекте
        }
        return password_verify($password, (string)$hash);
    }

    public function createUser(array $data): array
    {
        $id   = uid('u');
        $role = $data['role'] ?? 'client';
        if (!in_array($role, ['client', 'master', 'admin', 'support'], true)) {
            $role = 'client';
        }

        $inn = $data['inn'] ?? null;
        if ($role === 'master' && !$inn) {
            $inn = '7701' . str_pad((string)random_int(0, 99999999), 8, '0', STR_PAD_LEFT);
        }

        $privacy = $data['privacySettings']
            ?? ['hidePhone' => false, 'hideEmail' => true, 'allowDirectMessages' => true];

        $hash = null;
        if (!empty($data['password'])) {
            $hash = password_hash((string)$data['password'], PASSWORD_DEFAULT);
        }

        $this->q(
            'INSERT INTO users
              (id, email, phone, name, role, avatar, city, district, balance, bio, specialty,
               rating, review_count, client_rating, client_review_count, address, experience_years,
               inn, allow_delayed_payment, privacy_settings, password_hash, login, listing_free_until, created_at)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
            [
                $id,
                trim((string)$data['email']),
                $data['phone'] ?? null,
                $data['name'] ?? null,
                $role,
                $data['avatar'] ?? default_avatar(),
                $data['city'] ?? 'Москва',
                $data['district'] ?? 'Центральный',
                (float)($data['balance'] ?? 0),
                $data['bio'] ?? null,
                $data['specialty'] ?? null,
                $data['rating'] ?? null,
                (int)($data['reviewCount'] ?? 0),
                $data['clientRating'] ?? null,
                (int)($data['clientReviewCount'] ?? 0),
                $data['address'] ?? null,
                $data['experienceYears'] ?? null,
                $inn,
                !empty($data['allowDelayedPayment']) ? 1 : 0,
                json_encode($privacy, JSON_UNESCAPED_UNICODE),
                $hash,
                $data['login'] ?? null,
                $data['listingFreeUntil'] ?? null,
                now_iso(),
            ]
        );

        if ($role === 'master') {
            $this->getMasterSchedule($id);
        }

        $user = $this->findUserById($id);
        if ($user) {
            return $user;
        }

        // На старой базе столбец id мог быть INT — запись создалась с другим id.
        // Возвращаем данные из вставки, чтобы не падать.
        return [
            'id'                 => $id,
            'email'              => trim((string)$data['email']),
            'phone'              => $data['phone'] ?? '',
            'name'               => $data['name'] ?? '',
            'role'               => $role,
            'avatar'             => $data['avatar'] ?? default_avatar(),
            'city'               => $data['city'] ?? 'Москва',
            'district'           => $data['district'] ?? 'Центральный',
            'balance'            => (float)($data['balance'] ?? 0),
            'bio'                => $data['bio'] ?? null,
            'specialty'          => $data['specialty'] ?? null,
            'rating'             => $data['rating'] ?? null,
            'reviewCount'        => (int)($data['reviewCount'] ?? 0),
            'clientRating'       => $data['clientRating'] ?? null,
            'clientReviewCount'  => (int)($data['clientReviewCount'] ?? 0),
            'address'            => $data['address'] ?? null,
            'experienceYears'    => $data['experienceYears'] ?? null,
            'inn'                => $inn,
            'allowDelayedPayment'=> !empty($data['allowDelayedPayment']),
            'privacySettings'    => $privacy,
            'login'              => $data['login'] ?? null,
            'isBlocked'          => false,
            'listingFreeUntil'   => $data['listingFreeUntil'] ?? null,
            'createdAt'          => now_iso(),
        ];
    }

    public function updateUser(string $id, array $updates): ?array
    {
        $user = $this->findUserById($id);
        if (!$user) {
            return null;
        }

        $columns = [
            'email'               => 'email',
            'phone'               => 'phone',
            'name'                => 'name',
            'avatar'              => 'avatar',
            'city'                => 'city',
            'district'            => 'district',
            'balance'             => 'balance',
            'bio'                 => 'bio',
            'specialty'           => 'specialty',
            'rating'              => 'rating',
            'reviewCount'         => 'review_count',
            'clientRating'        => 'client_rating',
            'clientReviewCount'   => 'client_review_count',
            'address'             => 'address',
            'experienceYears'     => 'experience_years',
            'inn'                 => 'inn',
            'allowDelayedPayment' => 'allow_delayed_payment',
            'privacySettings'     => 'privacy_settings',
            'role'                => 'role',
            'login'               => 'login',
            'listingFreeUntil'    => 'listing_free_until',
        ];

        $sets   = [];
        $params = [];
        foreach ($columns as $key => $column) {
            if (!array_key_exists($key, $updates)) {
                continue;
            }
            $value = $updates[$key];
            if ($key === 'privacySettings') {
                $value = json_encode(is_array($value) ? $value : [], JSON_UNESCAPED_UNICODE);
            } elseif ($key === 'allowDelayedPayment') {
                $value = $value ? 1 : 0;
            }
            $sets[]   = "`$column` = ?";
            $params[] = $value;
        }

        if ($sets) {
            $params[] = $id;
            $this->q('UPDATE users SET ' . implode(', ', $sets) . ' WHERE id = ?', $params);
        }

        $updated = $this->findUserById($id);

        // Синхронизация данных мастера в работах и постах (как в исходном проекте)
        if (($updated['role'] ?? '') === 'master') {
            $this->q(
                'UPDATE works SET master_name = ?, master_avatar = ?, master_specialty = ?, master_district = ? WHERE master_id = ?',
                [$updated['name'], $updated['avatar'], $updated['specialty'], $updated['district'], $id]
            );
            $this->q(
                'UPDATE posts SET author_name = ?, author_avatar = ?, author_specialty = ? WHERE author_id = ?',
                [$updated['name'], $updated['avatar'], $updated['specialty'], $id]
            );
        }

        return $updated;
    }

    // ================================================================
    //  Кошелёк
    // ================================================================

    public function topUpBalance(string $userId, float $amount, ?string $paymentId = null): array
    {
        $user = $this->findUserById($userId);
        if (!$user) {
            throw new RuntimeException('Пользователь не найден');
        }
        if ($amount <= 0) {
            throw new RuntimeException('Сумма пополнения должна быть больше 0');
        }

        $yooId = $paymentId ?: ('yoo_topup_' . substr(uid('x'), 2));

        // Идемпотентность
        $existing = $this->one('SELECT * FROM transactions WHERE payment_ref = ? LIMIT 1', [$yooId]);
        if ($existing) {
            return ['user' => $user, 'transaction' => $this->mapTransaction($existing)];
        }

        $this->q('UPDATE users SET balance = balance + ? WHERE id = ?', [$amount, $userId]);

        $txId = uid('tx');
        $this->q(
            'INSERT INTO transactions (id, type, user_id, user_name, amount, description, payment_ref, status, created_at)
             VALUES (?,?,?,?,?,?,?,?,?)',
            [
                $txId, 'yookassa_payment', $user['id'], $user['name'], $amount,
                'Пополнение через ЮKassa (+' . $amount . ' ₽, Платеж #' . $yooId . ')',
                $yooId, 'completed', now_iso(),
            ]
        );

        return [
            'user'        => $this->findUserById($userId),
            'transaction' => $this->mapTransaction($this->one('SELECT * FROM transactions WHERE id = ?', [$txId])),
        ];
    }

    public function getTransactions(?string $userId = null): array
    {
        if ($userId) {
            $rows = $this->many(
                'SELECT * FROM transactions WHERE user_id = ? OR user_id = ? ORDER BY created_at DESC',
                [$userId, 'system_platform']
            );
        } else {
            $rows = $this->many('SELECT * FROM transactions ORDER BY created_at DESC');
        }
        return array_map(fn($r) => $this->mapTransaction($r), $rows);
    }

    // ================================================================
    //  Поиск мастеров
    // ================================================================

    public function searchMasters(array $filters): array
    {
        $rows = $this->many("SELECT * FROM users WHERE role = 'master' ORDER BY created_at DESC");
        $masters = array_map(fn($r) => $this->mapUser($r), $rows);

        $query      = $filters['query'] ?? null;
        $category   = $filters['category'] ?? null;
        $district   = $filters['district'] ?? null;
        $minRating  = $filters['minRating'] ?? null;
        $minPrice   = $filters['minPrice'] ?? null;
        $maxPrice   = $filters['maxPrice'] ?? null;

        if ($query) {
            $q = mb_strtolower($query);
            $masters = array_values(array_filter($masters, function ($m) use ($q) {
                return mb_strpos(mb_strtolower($m['name'] ?? ''), $q) !== false
                    || ($m['specialty'] && mb_strpos(mb_strtolower($m['specialty']), $q) !== false)
                    || ($m['bio'] && mb_strpos(mb_strtolower($m['bio']), $q) !== false);
            }));
        }

        if ($district) {
            $d = mb_strtolower($district);
            $masters = array_values(array_filter($masters, fn($m) => mb_strpos(mb_strtolower($m['district'] ?? ''), $d) !== false));
        }

        if ($minRating !== null) {
            $masters = array_values(array_filter($masters, fn($m) => (float)($m['rating'] ?? 0) >= (float)$minRating));
        }

        // Услуги всех мастеров одним запросом
        $servicesByMaster = [];
        foreach ($this->many('SELECT * FROM services') as $row) {
            $servicesByMaster[$row['master_id']][] = $this->mapService($row);
        }

        if ($category) {
            $cat = mb_strtolower($category);
            $masters = array_values(array_filter($masters, function ($m) use ($cat, $servicesByMaster) {
                foreach ($servicesByMaster[$m['id']] ?? [] as $s) {
                    if (mb_strpos(mb_strtolower($s['category']), $cat) !== false
                        || mb_strpos(mb_strtolower($s['title']), $cat) !== false) {
                        return true;
                    }
                }
                return $m['specialty'] && mb_strpos(mb_strtolower($m['specialty']), $cat) !== false;
            }));
        }

        if ($minPrice !== null || $maxPrice !== null) {
            $masters = array_values(array_filter($masters, function ($m) use ($servicesByMaster, $minPrice, $maxPrice) {
                $services = $servicesByMaster[$m['id']] ?? [];
                if (!$services) {
                    return true;
                }
                $prices = array_map(fn($s) => $s['price'], $services);
                $minP = min($prices);
                $maxP = max($prices);
                if ($minPrice !== null && $maxP < (float)$minPrice) {
                    return false;
                }
                if ($maxPrice !== null && $minP > (float)$maxPrice) {
                    return false;
                }
                return true;
            }));
        }

        return $masters;
    }

    // ================================================================
    //  Портфолио
    // ================================================================

    public function getWorks(?string $userId = null): array
    {
        // Ленивое автоснятие: просроченные объявления уходят в архив.
        $this->archiveExpiredWorks();

        $rows = $this->many('SELECT * FROM works ORDER BY created_at DESC');
        $out = [];
        foreach ($rows as $r) {
            $isArchived = (int)($r['archived'] ?? 0) === 1;
            $isOwner = $userId !== null && (string)$userId === (string)$r['master_id'];
            // Архивные объявления видны только владельцу (в его архиве), из ленты скрыты.
            if ($isArchived && !$isOwner) {
                continue;
            }
            $out[] = $this->mapWork($r, $userId);
        }
        return $out;
    }

    /**
     * Автоматически снять просроченные (неоплаченные) объявления в архив.
     * Мастер получает push-уведомление и запись в приложении о неоплаченной
     * выкладке услуги, которая сохранена в архиве.
     * Возвращает список заархивированных работ.
     */
    public function archiveExpiredWorks(?string $masterId = null): array
    {
        $settings = $this->listingSettings();
        if (!$settings['enabled']) {
            return [];
        }

        $sql = 'SELECT * FROM works WHERE archived = 0 AND paid_until IS NOT NULL';
        $params = [];
        if ($masterId !== null) {
            $sql .= ' AND master_id = ?';
            $params[] = $masterId;
        }

        $rows = $this->many($sql, $params);
        $now = time();
        $archived = [];
        foreach ($rows as $r) {
            if (iso_to_ts($r['paid_until'] ?? null) > $now) {
                continue;
            }
            $ownerId = (string)$r['master_id'];
            $this->q('UPDATE works SET archived = 1, expired_notified = 1 WHERE id = ?', [$r['id']]);
            $title = (string)($r['title'] ?? '');

            $this->pushEvent('WORK_ARCHIVED', [
                'workId' => $r['id'],
                'title'  => $title,
                'reason' => 'unpaid',
            ], [$ownerId]);

            push_queue([$ownerId], [
                'title' => 'Объявление снято в архив',
                'body'  => ($title !== '' ? '«' . $title . '»' : 'Объявление') .
                           ' снято с публикации: не оплачено продление. Оно сохранено в архиве.',
                'url'   => '/?tab=profile&section=portfolio',
                'tag'   => 'work-archive-' . $r['id'],
            ]);

            $archived[] = $r;
        }
        return $archived;
    }

    public function addWork(array $data): array
    {
        $id = uid('w');
        $this->q(
            'INSERT INTO works (id, master_id, master_name, master_avatar, master_specialty, master_district,
                                title, description, category, images, price, likes_count, comments_count, paid_until, created_at)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,0,0,?,?)',
            [
                $id,
                $data['masterId'],
                $data['masterName'] ?? '',
                $data['masterAvatar'] ?? '',
                $data['masterSpecialty'] ?? null,
                $data['masterDistrict'] ?? '',
                $data['title'] ?? '',
                $data['description'] ?? '',
                $data['category'] ?? '',
                json_encode(array_values((array)($data['images'] ?? [])), JSON_UNESCAPED_UNICODE),
                isset($data['price']) && $data['price'] !== null ? (float)$data['price'] : null,
                $data['paidUntil'] ?? null,
                now_iso(),
            ]
        );

        $row = $this->one('SELECT * FROM works WHERE id = ?', [$id]);
        return $this->mapWork($row);
    }

    public function deleteWork(string $workId): bool
    {
        $exists = $this->scalar('SELECT id FROM works WHERE id = ?', [$workId]);
        if (!$exists) {
            return false;
        }
        $this->q('DELETE FROM works WHERE id = ?', [$workId]);
        $this->q('DELETE FROM comments WHERE target_id = ?', [$workId]);
        $this->q('DELETE FROM likes WHERE target_id = ?', [$workId]);
        return true;
    }

    // ================================================================
    //  Лайки
    // ================================================================

    public function isLiked(string $userId, string $targetId): bool
    {
        return (bool)$this->scalar('SELECT 1 FROM likes WHERE user_id = ? AND target_id = ? LIMIT 1', [$userId, $targetId]);
    }

    public function toggleLike(string $userId, string $targetId, string $targetType): array
    {
        $table = $targetType === 'work' ? 'works' : 'posts';
        $row   = $this->one("SELECT id, likes_count FROM $table WHERE id = ?", [$targetId]);
        if (!$row) {
            return ['likesCount' => 0, 'isLiked' => false];
        }

        $liked = $this->isLiked($userId, $targetId);
        if ($liked) {
            $this->q('DELETE FROM likes WHERE user_id = ? AND target_id = ?', [$userId, $targetId]);
            $this->q("UPDATE $table SET likes_count = GREATEST(0, likes_count - 1) WHERE id = ?", [$targetId]);
        } else {
            $this->q(
                'INSERT IGNORE INTO likes (user_id, target_id, target_type, created_at) VALUES (?,?,?,?)',
                [$userId, $targetId, $targetType, now_iso()]
            );
            $this->q("UPDATE $table SET likes_count = likes_count + 1 WHERE id = ?", [$targetId]);
        }

        $count = (int)$this->scalar("SELECT likes_count FROM $table WHERE id = ?", [$targetId]);
        return ['likesCount' => $count, 'isLiked' => !$liked];
    }

    // ================================================================
    //  Комментарии
    // ================================================================

    public function getComments(string $targetId): array
    {
        $rows = $this->many('SELECT * FROM comments WHERE target_id = ? ORDER BY seq ASC', [$targetId]);
        return array_map(fn($r) => $this->mapComment($r), $rows);
    }

    public function addComment(array $data): array
    {
        $id = uid('c');
        $this->q(
            'INSERT INTO comments (id, target_id, target_type, author_id, author_name, author_avatar, author_role, text, created_at)
             VALUES (?,?,?,?,?,?,?,?,?)',
            [
                $id,
                $data['targetId'],
                $data['targetType'],
                $data['authorId'],
                $data['authorName'] ?? '',
                $data['authorAvatar'] ?? '',
                $data['authorRole'] ?? 'client',
                $data['text'] ?? '',
                now_iso(),
            ]
        );

        $table = $data['targetType'] === 'work' ? 'works' : 'posts';
        $this->q("UPDATE $table SET comments_count = comments_count + 1 WHERE id = ?", [$data['targetId']]);

        return $this->mapComment($this->one('SELECT * FROM comments WHERE id = ?', [$id]));
    }

    // ================================================================
    //  Посты сообщества
    // ================================================================

    public function getPosts(?string $userId = null): array
    {
        $rows = $this->many('SELECT * FROM posts ORDER BY created_at DESC');
        return array_map(fn($r) => $this->mapPost($r, $userId), $rows);
    }

    public function addPost(array $data): array
    {
        $id = uid('p');
        $this->q(
            'INSERT INTO posts (id, author_id, author_name, author_avatar, author_role, author_specialty,
                               title, content, images, tags, likes_count, comments_count, created_at)
             VALUES (?,?,?,?,?,?,?,?,?,?,0,0,?)',
            [
                $id,
                $data['authorId'],
                $data['authorName'] ?? '',
                $data['authorAvatar'] ?? '',
                $data['authorRole'] ?? 'client',
                $data['authorSpecialty'] ?? null,
                $data['title'] ?? '',
                $data['content'] ?? '',
                json_encode(array_values((array)($data['images'] ?? [])), JSON_UNESCAPED_UNICODE),
                json_encode(array_values((array)($data['tags'] ?? [])), JSON_UNESCAPED_UNICODE),
                now_iso(),
            ]
        );
        return $this->mapPost($this->one('SELECT * FROM posts WHERE id = ?', [$id]));
    }

    public function deletePost(string $postId): bool
    {
        if (!$this->scalar('SELECT id FROM posts WHERE id = ?', [$postId])) {
            return false;
        }
        $this->q('DELETE FROM posts WHERE id = ?', [$postId]);
        $this->q('DELETE FROM comments WHERE target_id = ?', [$postId]);
        $this->q('DELETE FROM likes WHERE target_id = ?', [$postId]);
        return true;
    }

    // ================================================================
    //  Услуги и график
    // ================================================================

    public function getMasterServices(string $masterId): array
    {
        $rows = $this->many('SELECT * FROM services WHERE master_id = ?', [$masterId]);
        return array_map(fn($r) => $this->mapService($r), $rows);
    }

    public function addService(array $data): array
    {
        $id = uid('s');
        $this->q(
            'INSERT INTO services (id, master_id, title, category, price, duration_mins, description)
             VALUES (?,?,?,?,?,?,?)',
            [
                $id,
                $data['masterId'],
                $data['title'] ?? '',
                $data['category'] ?? '',
                (float)($data['price'] ?? 0),
                (int)($data['durationMins'] ?? 60),
                $data['description'] ?? null,
            ]
        );
        return $this->mapService($this->one('SELECT * FROM services WHERE id = ?', [$id]));
    }

    public function deleteService(string $serviceId): bool
    {
        if (!$this->scalar('SELECT id FROM services WHERE id = ?', [$serviceId])) {
            return false;
        }
        $this->q('DELETE FROM services WHERE id = ?', [$serviceId]);
        return true;
    }

    public function getMasterSchedule(string $masterId): array
    {
        $row = $this->one('SELECT * FROM schedules WHERE master_id = ?', [$masterId]);
        if (!$row) {
            $schedule = [
                'masterId'    => $masterId,
                'workingDays' => [1, 2, 3, 4, 5, 6],
                'timeSlots'   => ['10:00', '12:00', '14:00', '16:00', '18:00'],
                'offDates'    => [],
            ];
            $this->q(
                'INSERT INTO schedules (master_id, working_days, time_slots, off_dates) VALUES (?,?,?,?)',
                [
                    $masterId,
                    json_encode($schedule['workingDays']),
                    json_encode($schedule['timeSlots']),
                    json_encode($schedule['offDates']),
                ]
            );
            return $schedule;
        }

        return [
            'masterId'    => $masterId,
            'workingDays' => array_map('intval', json_decode_array($row['working_days'])),
            'timeSlots'   => array_values(json_decode_array($row['time_slots'])),
            'offDates'    => array_values(json_decode_array($row['off_dates'])),
        ];
    }

    public function updateMasterSchedule(string $masterId, array $schedule): array
    {
        $existing = $this->getMasterSchedule($masterId);
        $merged = array_merge($existing, $schedule);

        $this->q(
            'UPDATE schedules SET working_days = ?, time_slots = ?, off_dates = ? WHERE master_id = ?',
            [
                json_encode(array_values(array_map('intval', (array)$merged['workingDays']))),
                json_encode(array_values((array)$merged['timeSlots'])),
                json_encode(array_values((array)$merged['offDates'])),
                $masterId,
            ]
        );

        return $this->getMasterSchedule($masterId);
    }

    // ================================================================
    //  Записи
    // ================================================================

    public function findBookingById(string $id): ?array
    {
        $row = $this->one('SELECT * FROM bookings WHERE id = ? LIMIT 1', [$id]);
        return $row ? $this->mapBooking($row) : null;
    }

    public function getBookingsForUser(string $userId, string $role): array
    {
        $column = $role === 'master' ? 'master_id' : 'client_id';
        $rows = $this->many("SELECT * FROM bookings WHERE $column = ? ORDER BY created_at DESC", [$userId]);
        return array_map(fn($r) => $this->mapBooking($r), $rows);
    }

    public function createBooking(array $data): array
    {
        $client  = $this->findUserById($data['clientId'] ?? '');
        $master  = $this->findUserById($data['masterId'] ?? '');
        $serviceRow = $this->one('SELECT * FROM services WHERE id = ?', [$data['serviceId'] ?? '']);

        if (!$client || !$master || !$serviceRow) {
            throw new RuntimeException('Некорректные данные клиента, мастера или услуги');
        }
        $service = $this->mapService($serviceRow);

        // Запись клиента бесплатная: без холдирования, комиссии и отложенной оплаты.
        $bookingId = uid('b');
        $masterInn = $master['inn'] ?: '770123456789';

        $this->q(
            'INSERT INTO bookings
              (id, client_id, client_name, client_phone, client_avatar, master_id, master_name, master_avatar,
               master_address, master_inn, service_id, service_title, service_price, service_duration_mins,
               booking_date, time_slot, status, is_paid, platform_fee, master_payout,
               payment_method, payment_status, allow_delayed_payment, payment_deadline, notes,
               client_completed, master_completed, created_at)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
            [
                $bookingId,
                $client['id'], $client['name'], $client['phone'], $client['avatar'],
                $master['id'], $master['name'], $master['avatar'],
                $master['address'] ?: 'Адрес уточняется в чате', $masterInn,
                $service['id'], $service['title'], $service['price'], $service['durationMins'],
                $data['date'], $data['timeSlot'], 'confirmed', 0,
                0, $service['price'],
                'none', 'not_required',
                0, null, $data['notes'] ?? null,
                0, 0, now_iso(),
            ]
        );

        $chatId = 'chat_' . $bookingId;
        $this->q(
            'INSERT INTO chats (id, booking_id, client_id, client_name, client_avatar, master_id, master_name,
                                master_avatar, service_title, booking_date, booking_time_slot, booking_price,
                                last_message, last_message_time, unread_count_client, unread_count_master)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,1)',
            [
                $chatId, $bookingId, $client['id'], $client['name'], $client['avatar'],
                $master['id'], $master['name'], $master['avatar'],
                $service['title'], $data['date'], $data['timeSlot'], $service['price'],
                sprintf('Запись создана на %s в %s', $data['date'], $data['timeSlot']),
                now_iso(),
            ]
        );

        $notes = !empty($data['notes']) ? ' Пожелание: ' . $data['notes'] : '';
        $greeting = sprintf(
            'Здравствуйте, %s! Я записалась на услугу "%s" на %s в %s.%s',
            $master['name'], $service['title'], $data['date'], $data['timeSlot'], $notes
        );

        $this->insertMessage([
            'chatId'       => $chatId,
            'senderId'     => $client['id'],
            'senderName'   => $client['name'],
            'senderAvatar' => $client['avatar'],
            'text'         => $greeting,
        ]);

        return [
            'booking' => $this->findBookingById($bookingId),
            'chat'    => $this->mapChat($this->one('SELECT * FROM chats WHERE id = ?', [$chatId])),
        ];
    }

    public function payDelayedBooking(string $bookingId, string $clientId): array
    {
        $booking = $this->findBookingById($bookingId);
        if (!$booking) {
            throw new RuntimeException('Запись не найдена');
        }
        if ($booking['clientId'] !== $clientId) {
            throw new RuntimeException('Нет прав для оплаты этой записи');
        }
        if ($booking['isPaid']) {
            return ['booking' => $booking, 'clientBalance' => (float)($this->findUserById($clientId)['balance'] ?? 0)];
        }

        $client = $this->findUserById($clientId);
        if (!$client) {
            throw new RuntimeException('Клиент не найден');
        }
        if ((float)$client['balance'] < $booking['servicePrice']) {
            throw new RuntimeException(sprintf(
                'Недостаточно средств. Для оплаты необходимо %s ₽, на вашем балансе %s ₽. Оплатите через СБП ЮKassa.',
                $booking['servicePrice'], $client['balance']
            ));
        }

        $this->q('UPDATE users SET balance = balance - ? WHERE id = ?', [$booking['servicePrice'], $clientId]);
        $this->q(
            "UPDATE bookings SET is_paid = 1, status = 'paid', allow_delayed_payment = 0 WHERE id = ?",
            [$bookingId]
        );

        $this->insertTransaction([
            'type'        => 'escrow_hold',
            'bookingId'   => $bookingId,
            'userId'      => $client['id'],
            'userName'    => $client['name'],
            'amount'      => $booking['servicePrice'],
            'description' => sprintf('Оплата отложенной брони #%s ("%s") через ЮKassa', $bookingId, $booking['serviceTitle']),
        ]);

        $chat = $this->one('SELECT * FROM chats WHERE booking_id = ?', [$bookingId]);
        if ($chat) {
            $this->insertMessage([
                'chatId'       => $chat['id'],
                'senderId'     => $client['id'],
                'senderName'   => $client['name'],
                'senderAvatar' => $client['avatar'],
                'text'         => sprintf('✓ Оплата %s ₽ успешно внесена через ЮKassa СБП. Бронь гарантирована!', $booking['servicePrice']),
            ]);
        }

        return [
            'booking'       => $this->findBookingById($bookingId),
            'clientBalance' => (float)$this->scalar('SELECT balance FROM users WHERE id = ?', [$clientId]),
        ];
    }

    public function completeBooking(string $bookingId, ?string $userId, ?string $userRole): array
    {
        $booking = $this->findBookingById($bookingId);
        if (!$booking) {
            throw new RuntimeException('Запись не найдена');
        }

        $isClient = ($userId && $booking['clientId'] === $userId) || $userRole === 'client';
        $isMaster = ($userId && $booking['masterId'] === $userId) || $userRole === 'master';

        if (!$isClient && !$isMaster) {
            throw new RuntimeException('Только клиент или мастер этой записи могут подтвердить завершение услуги');
        }

        if ($booking['status'] === 'completed') {
            $master = $this->findUserById($booking['masterId']);
            $split  = self::calculatePaymentSplit($booking['servicePrice']);
            return [
                'booking'          => $booking,
                'isFullyCompleted' => true,
                'platformFee'      => $split['platformFee'],
                'masterPayout'     => $split['masterPayout'],
                'masterBalance'    => (float)($master['balance'] ?? 0),
            ];
        }

        if ($isClient) {
            $this->q('UPDATE bookings SET client_completed = 1, client_completed_at = ? WHERE id = ?', [now_iso(), $bookingId]);
        }
        if ($isMaster) {
            $this->q('UPDATE bookings SET master_completed = 1, master_completed_at = ? WHERE id = ?', [now_iso(), $bookingId]);
        }

        $booking = $this->findBookingById($bookingId);
        $isFullyCompleted = $booking['clientCompleted'] && $booking['masterCompleted'];

        if ($isFullyCompleted) {
            $split = self::calculatePaymentSplit($booking['servicePrice']);

            $this->q(
                "UPDATE bookings SET status = 'completed', is_paid = 1, platform_fee = ?, master_payout = ?, payment_status = 'settled' WHERE id = ?",
                [$split['platformFee'], $split['masterPayout'], $bookingId]
            );
            $this->q('UPDATE users SET balance = balance + ? WHERE id = ?', [$split['masterPayout'], $booking['masterId']]);

            $this->insertTransaction([
                'type'          => 'master_payout',
                'bookingId'     => $bookingId,
                'userId'        => $booking['masterId'],
                'userName'      => $booking['masterName'],
                'amount'        => $split['masterPayout'],
                'commissionFee' => $split['platformFee'],
                'description'   => sprintf(
                    'Зачисление +%s ₽ за запись #%s ("%s") [Двустороннее подтверждение • ЮKassa Сплит 4%%: %s ₽, мастеру: %s ₽]',
                    $split['masterPayout'], $bookingId, $booking['serviceTitle'], $split['platformFee'], $split['masterPayout']
                ),
            ]);
            $this->insertTransaction([
                'type'          => 'platform_commission',
                'bookingId'     => $bookingId,
                'userId'        => 'system_platform',
                'userName'      => 'French Platform',
                'amount'        => $split['platformFee'],
                'commissionFee' => $split['platformFee'],
                'description'   => sprintf('Комиссия платформы 4%% (%s ₽) с завершенной услуги #%s [ЮKassa 54-ФЗ]', $split['platformFee'], $bookingId),
            ]);

            return [
                'booking'          => $this->findBookingById($bookingId),
                'isFullyCompleted' => true,
                'platformFee'      => $split['platformFee'],
                'masterPayout'     => $split['masterPayout'],
                'masterBalance'    => (float)$this->scalar('SELECT balance FROM users WHERE id = ?', [$booking['masterId']]),
            ];
        }

        return [
            'booking'          => $this->findBookingById($bookingId),
            'isFullyCompleted' => false,
            'masterBalance'    => (float)($this->findUserById($booking['masterId'])['balance'] ?? 0),
        ];
    }

    public function submitBookingSurvey(string $bookingId, string $userId, string $role, array $survey, ?array $evidence): array
    {
        $booking = $this->findBookingById($bookingId);
        if (!$booking) {
            throw new RuntimeException('Запись не найдена');
        }

        $isClient = ($userId && $booking['clientId'] === $userId) || $role === 'client';
        $isMaster = ($userId && $booking['masterId'] === $userId) || $role === 'master';

        if (!$isClient && !$isMaster) {
            throw new RuntimeException('Только участники этой записи могут пройти опрос завершения');
        }

        if ($isClient) {
            $qQuality   = ($survey['qQuality'] ?? true) !== false;
            $qPolite    = ($survey['qPolite'] ?? true) !== false;
            $qSatisfied = ($survey['qSatisfied'] ?? true) !== false;
            $isPositive = $qQuality && $qPolite && $qSatisfied;

            $clientSurvey = json_encode([
                'qQuality'    => $qQuality,
                'qPolite'     => $qPolite,
                'qSatisfied'  => $qSatisfied,
                'submittedAt' => now_iso(),
                'feedback'    => $survey['feedback'] ?? null,
            ], JSON_UNESCAPED_UNICODE);

            if ($isPositive) {
                $this->q('UPDATE bookings SET client_survey = ?, client_completed = 1, client_completed_at = ? WHERE id = ?',
                    [$clientSurvey, now_iso(), $bookingId]);
            } else {
                $dispute = json_encode([
                    'raisedBy'            => 'client',
                    'reason'              => $evidence['reason'] ?? $survey['feedback'] ?? 'Клиент указал на проблемы с качеством работы, вежливостью или результатом',
                    'clientEvidencePhotos' => $evidence['photos'] ?? [],
                    'status'              => 'open',
                    'createdAt'           => now_iso(),
                ], JSON_UNESCAPED_UNICODE);

                $this->q("UPDATE bookings SET client_survey = ?, status = 'disputed', dispute = ? WHERE id = ?",
                    [$clientSurvey, $dispute, $bookingId]);

                $chat = $this->one('SELECT * FROM chats WHERE booking_id = ?', [$bookingId]);
                if ($chat) {
                    $this->insertMessage([
                        'chatId'       => $chat['id'],
                        'senderId'     => 'system_support',
                        'senderName'   => 'Служба поддержки & Арбитраж',
                        'senderAvatar' => 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
                        'text'         => sprintf('⚠️ Внимание: Клиент открыл спор по качеству услуги. Средства (%s ₽) заморожены до рассмотрения доказательств поддержкой.', $booking['servicePrice']),
                    ]);
                }

                return ['booking' => $this->findBookingById($bookingId), 'isFullyCompleted' => false, 'isDisputed' => true];
            }
        }

        if ($isMaster) {
            $qPolite       = ($survey['qPolite'] ?? true) !== false;
            $qWelcomeAgain = ($survey['qWelcomeAgain'] ?? true) !== false;
            $isPositive    = $qPolite && $qWelcomeAgain;

            $masterSurvey = json_encode([
                'qPolite'       => $qPolite,
                'qWelcomeAgain' => $qWelcomeAgain,
                'submittedAt'   => now_iso(),
                'feedback'      => $survey['feedback'] ?? null,
            ], JSON_UNESCAPED_UNICODE);

            if ($isPositive) {
                $this->q('UPDATE bookings SET master_survey = ?, master_completed = 1, master_completed_at = ? WHERE id = ?',
                    [$masterSurvey, now_iso(), $bookingId]);
            } else {
                $dispute = json_encode([
                    'raisedBy'           => 'master',
                    'reason'             => $evidence['reason'] ?? $survey['feedback'] ?? 'Мастер зафиксировал грубое/агрессивное поведение или нарушение со стороны клиента',
                    'masterEvidenceVideos' => $evidence['videos'] ?? [],
                    'status'             => 'open',
                    'createdAt'          => now_iso(),
                ], JSON_UNESCAPED_UNICODE);

                $this->q("UPDATE bookings SET master_survey = ?, status = 'disputed', dispute = ? WHERE id = ?",
                    [$masterSurvey, $dispute, $bookingId]);

                $chat = $this->one('SELECT * FROM chats WHERE booking_id = ?', [$bookingId]);
                if ($chat) {
                    $this->insertMessage([
                        'chatId'       => $chat['id'],
                        'senderId'     => 'system_support',
                        'senderName'   => 'Служба поддержки & Арбитраж',
                        'senderAvatar' => 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
                        'text'         => sprintf('⚠️ Внимание: Мастер открыл спор по поведению клиента. Средства (%s ₽) заморожены до рассмотрения доказательств поддержкой.', $booking['servicePrice']),
                    ]);
                }

                return ['booking' => $this->findBookingById($bookingId), 'isFullyCompleted' => false, 'isDisputed' => true];
            }
        }

        $booking = $this->findBookingById($bookingId);
        $isFullyCompleted = $booking['clientCompleted'] && $booking['masterCompleted'];

        if ($isFullyCompleted) {
            $split = self::calculatePaymentSplit($booking['servicePrice']);
            $this->q(
                "UPDATE bookings SET status = 'Completed_and_Paid', is_paid = 1, platform_fee = ?, master_payout = ?, payment_status = 'succeeded' WHERE id = ?",
                [$split['platformFee'], $split['masterPayout'], $bookingId]
            );
            $this->q('UPDATE users SET balance = balance + ? WHERE id = ?', [$split['masterPayout'], $booking['masterId']]);

            $this->insertTransaction([
                'type'          => 'master_payout',
                'bookingId'     => $bookingId,
                'userId'        => $booking['masterId'],
                'userName'      => $booking['masterName'],
                'amount'        => $split['masterPayout'],
                'commissionFee' => $split['platformFee'],
                'description'   => sprintf(
                    'Зачисление +%s ₽ за запись #%s ("%s") [Обоюдное подтверждение опросов • ЮKassa Сплит 4%%: %s ₽, мастеру: %s ₽]',
                    $split['masterPayout'], $bookingId, $booking['serviceTitle'], $split['platformFee'], $split['masterPayout']
                ),
            ]);
            $this->insertTransaction([
                'type'          => 'platform_commission',
                'bookingId'     => $bookingId,
                'userId'        => 'system_platform',
                'userName'      => 'French Platform',
                'amount'        => $split['platformFee'],
                'commissionFee' => $split['platformFee'],
                'description'   => sprintf('Комиссия платформы 4%% (%s ₽) с успешно завершенной услуги #%s [ЮKassa 54-ФЗ]', $split['platformFee'], $bookingId),
            ]);

            $chat = $this->one('SELECT * FROM chats WHERE booking_id = ?', [$bookingId]);
            if ($chat) {
                $this->insertMessage([
                    'chatId'       => $chat['id'],
                    'senderId'     => 'system_support',
                    'senderName'   => 'Система Безопасной сделки & ЮKassa',
                    'senderAvatar' => 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
                    'text'         => sprintf('🎉 Обе стороны успешно ответили «Да» на все вопросы опроса! Заказ #%s выполнен. Средства (%s ₽) зачислены мастеру, сплит ЮKassa успешно завершен.', $bookingId, $split['masterPayout']),
                ]);
            }

            return [
                'booking'          => $this->findBookingById($bookingId),
                'isFullyCompleted' => true,
                'isDisputed'       => false,
                'platformFee'      => $split['platformFee'],
                'masterPayout'     => $split['masterPayout'],
                'masterBalance'    => (float)$this->scalar('SELECT balance FROM users WHERE id = ?', [$booking['masterId']]),
            ];
        }

        return [
            'booking'          => $booking,
            'isFullyCompleted' => false,
            'isDisputed'       => false,
            'masterBalance'    => (float)($this->findUserById($booking['masterId'])['balance'] ?? 0),
        ];
    }

    public function cancelAppointmentAuthorization(string $bookingId, string $reason = 'Отмена записи пользователем'): array
    {
        $booking = $this->findBookingById($bookingId);
        if (!$booking) {
            throw new RuntimeException('Запись не найдена');
        }

        $this->q(
            "UPDATE bookings SET status = 'Cancelled_and_Refunded', payment_status = 'canceled', is_paid = 0 WHERE id = ?",
            [$bookingId]
        );

        $chat = $this->one('SELECT * FROM chats WHERE booking_id = ?', [$bookingId]);
        if ($chat) {
            $this->insertMessage([
                'chatId'       => $chat['id'],
                'senderId'     => 'system_support',
                'senderName'   => 'ЮKassa Возврат средств',
                'senderAvatar' => 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
                'text'         => sprintf('🔓 Запись #%s отменена. Средства (%s ₽) возвращены на счет клиента через ЮKassa без комиссий.', $bookingId, $booking['servicePrice']),
            ]);
        }

        return [
            'booking'           => $this->findBookingById($bookingId),
            'clientBalance'     => (float)($this->findUserById($booking['clientId'])['balance'] ?? 0),
            'voidTransactionId' => 'yoo_refund_' . (int)round(microtime(true) * 1000),
        ];
    }

    public function cancelBooking(string $bookingId, string $reason = 'Отмена записи'): array
    {
        $booking = $this->findBookingById($bookingId);
        if (!$booking) {
            throw new RuntimeException('Запись не найдена');
        }

        if (in_array($booking['status'], ['canceled', 'Cancelled_and_Refunded'], true)) {
            return ['booking' => $booking, 'clientBalance' => (float)($this->findUserById($booking['clientId'])['balance'] ?? 0)];
        }

        $wasPaid = $booking['isPaid'];
        $this->q("UPDATE bookings SET status = 'Cancelled_and_Refunded', payment_status = 'canceled' WHERE id = ?", [$bookingId]);

        $clientBalance = null;
        if ($wasPaid) {
            $client = $this->findUserById($booking['clientId']);
            if ($client) {
                $this->q('UPDATE users SET balance = balance + ? WHERE id = ?', [$booking['servicePrice'], $client['id']]);
                $clientBalance = (float)$this->scalar('SELECT balance FROM users WHERE id = ?', [$client['id']]);

                $this->insertTransaction([
                    'type'        => 'client_refund',
                    'bookingId'   => $bookingId,
                    'userId'      => $client['id'],
                    'userName'    => $client['name'],
                    'amount'      => $booking['servicePrice'],
                    'description' => sprintf('100%% Возврат средств (+%s ₽) по отмененной записи #%s [ЮKassa Возврат • Без комиссий]', $booking['servicePrice'], $bookingId),
                ]);
            }
            $this->q('UPDATE bookings SET is_paid = 0 WHERE id = ?', [$bookingId]);
        }

        $chat = $this->one('SELECT * FROM chats WHERE booking_id = ?', [$bookingId]);
        if ($chat) {
            $this->insertMessage([
                'chatId'       => $chat['id'],
                'senderId'     => 'system_support',
                'senderName'   => 'Безопасная сделка & Отмена',
                'senderAvatar' => 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
                'text'         => sprintf('✕ Запись #%s отменена (Статус: Cancelled_and_Refunded). Средства (%s ₽) возвращены на счет клиента без комиссии.', $bookingId, $booking['servicePrice']),
            ]);
        }

        $result = ['booking' => $this->findBookingById($bookingId)];
        if ($clientBalance !== null) {
            $result['clientBalance'] = $clientBalance;
        }
        return $result;
    }

    public function updateBookingStatus(string $bookingId, string $status): ?array
    {
        $booking = $this->findBookingById($bookingId);
        if (!$booking) {
            return null;
        }
        $this->q('UPDATE bookings SET status = ? WHERE id = ?', [$status, $bookingId]);
        return $this->findBookingById($bookingId);
    }

    public function rateBooking(string $bookingId, string $raterRole, float $rating, ?string $reviewText = null): ?array
    {
        $booking = $this->findBookingById($bookingId);
        if (!$booking) {
            return null;
        }

        if ($raterRole === 'client') {
            $this->q('UPDATE bookings SET master_rating = ?, review_text = COALESCE(?, review_text) WHERE id = ?',
                [$rating, $reviewText, $bookingId]);

            $rows  = $this->many('SELECT master_rating FROM bookings WHERE master_id = ? AND master_rating IS NOT NULL', [$booking['masterId']]);
            $count = count($rows);
            if ($count > 0) {
                $total = array_sum(array_map(fn($r) => (float)$r['master_rating'], $rows));
                $this->q('UPDATE users SET rating = ?, review_count = ? WHERE id = ?',
                    [round($total / $count, 1), $count, $booking['masterId']]);
            }
        } else {
            $this->q('UPDATE bookings SET client_rating = ? WHERE id = ?', [$rating, $bookingId]);
        }

        return $this->findBookingById($bookingId);
    }

    public function resolveDispute(string $bookingId, string $decision, ?string $resolutionNotes = null): array
    {
        $booking = $this->findBookingById($bookingId);
        if (!$booking) {
            throw new RuntimeException('Запись не найдена');
        }

        $dispute = $booking['dispute'] ?? [];
        $chat = $this->one('SELECT * FROM chats WHERE booking_id = ?', [$bookingId]);

        if ($decision === 'client_refund') {
            $dispute['status'] = 'resolved_client_refund';
            $dispute['resolutionNotes'] = $resolutionNotes ?: 'Поддержка приняла решение в пользу клиента: 100% возврат средств.';
            $dispute['resolvedAt'] = now_iso();

            $this->q("UPDATE bookings SET status = 'canceled', dispute = ? WHERE id = ?",
                [json_encode($dispute, JSON_UNESCAPED_UNICODE), $bookingId]);

            $this->q('UPDATE users SET balance = balance + ? WHERE id = ?', [$booking['servicePrice'], $booking['clientId']]);
            $this->insertTransaction([
                'type'        => 'client_refund',
                'bookingId'   => $bookingId,
                'userId'      => $booking['clientId'],
                'userName'    => $booking['clientName'],
                'amount'      => $booking['servicePrice'],
                'description' => sprintf('100%% Возврат средств (+%s ₽) по диспуту #%s: %s', $booking['servicePrice'], $bookingId, $resolutionNotes ?: 'Решение в пользу клиента'),
            ]);

            if ($chat) {
                $this->insertMessage([
                    'chatId' => $chat['id'], 'senderId' => 'system_support', 'senderName' => 'Арбитраж поддержки',
                    'senderAvatar' => 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
                    'text' => sprintf('⚖️ Арбитраж завершён. Решение в пользу клиента. Средства (%s ₽) возвращены на баланс клиента.', $booking['servicePrice']),
                ]);
            }

            return [
                'booking'       => $this->findBookingById($bookingId),
                'clientBalance' => (float)$this->scalar('SELECT balance FROM users WHERE id = ?', [$booking['clientId']]),
                'masterBalance' => (float)($this->findUserById($booking['masterId'])['balance'] ?? 0),
            ];
        }

        $dispute['status'] = 'resolved_master_payout';
        $dispute['resolutionNotes'] = $resolutionNotes ?: 'Поддержка приняла решение в пользу мастера: выплата за оказанную услугу.';
        $dispute['resolvedAt'] = now_iso();

        $split = self::calculatePaymentSplit($booking['servicePrice']);
        $this->q(
            "UPDATE bookings SET status = 'completed', dispute = ?, platform_fee = ?, master_payout = ?, payment_status = 'settled' WHERE id = ?",
            [json_encode($dispute, JSON_UNESCAPED_UNICODE), $split['platformFee'], $split['masterPayout'], $bookingId]
        );

        $this->q('UPDATE users SET balance = balance + ? WHERE id = ?', [$split['masterPayout'], $booking['masterId']]);
        $this->insertTransaction([
            'type'          => 'master_payout',
            'bookingId'     => $bookingId,
            'userId'        => $booking['masterId'],
            'userName'      => $booking['masterName'],
            'amount'        => $split['masterPayout'],
            'commissionFee' => $split['platformFee'],
            'description'   => sprintf('Выплата мастеру +%s ₽ по решению арбитража #%s (Комиссия платформы 4%%: %s ₽)', $split['masterPayout'], $bookingId, $split['platformFee']),
        ]);
        $this->insertTransaction([
            'type'          => 'platform_commission',
            'bookingId'     => $bookingId,
            'userId'        => 'system_platform',
            'userName'      => 'French Platform',
            'amount'        => $split['platformFee'],
            'commissionFee' => $split['platformFee'],
            'description'   => sprintf('Комиссия платформы 4%% (%s ₽) по арбитражу #%s', $split['platformFee'], $bookingId),
        ]);

        if ($chat) {
            $this->insertMessage([
                'chatId' => $chat['id'], 'senderId' => 'system_support', 'senderName' => 'Арбитраж поддержки',
                'senderAvatar' => 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
                'text' => sprintf('⚖️ Арбитраж завершён. Решение в пользу мастера. Средства (%s ₽) переведены на баланс мастера.', $split['masterPayout']),
            ]);
        }

        return [
            'booking'       => $this->findBookingById($bookingId),
            'clientBalance' => (float)($this->findUserById($booking['clientId'])['balance'] ?? 0),
            'masterBalance' => (float)$this->scalar('SELECT balance FROM users WHERE id = ?', [$booking['masterId']]),
        ];
    }

    // ================================================================
    //  Отзывы
    // ================================================================

    public function addReview(array $data): array
    {
        $author = $this->findUserById($data['authorId'] ?? '');
        $target = $this->findUserById($data['targetUserId'] ?? '');
        if (!$author || !$target) {
            throw new RuntimeException('Автор или адресат отзыва не найдены');
        }

        $rating = max(1, min(5, (int)round((float)($data['rating'] ?? 5))));
        $id = uid('rev');

        $this->q(
            'INSERT INTO reviews (id, booking_id, author_id, author_name, author_avatar, author_role,
                                  target_user_id, target_user_name, rating, text, created_at)
             VALUES (?,?,?,?,?,?,?,?,?,?,?)',
            [
                $id, $data['bookingId'] ?? '', $author['id'], $author['name'], $author['avatar'], $author['role'],
                $target['id'], $target['name'], $rating, $data['text'] ?? '', now_iso(),
            ]
        );

        $rows  = $this->many('SELECT rating FROM reviews WHERE target_user_id = ?', [$target['id']]);
        $count = count($rows);
        $avg   = $count > 0 ? round(array_sum(array_map(fn($r) => (float)$r['rating'], $rows)) / $count, 1) : 0;

        if ($target['role'] === 'master') {
            $this->q('UPDATE users SET rating = ?, review_count = ? WHERE id = ?', [$avg, $count, $target['id']]);
        } else {
            $this->q('UPDATE users SET client_rating = ?, client_review_count = ? WHERE id = ?', [$avg, $count, $target['id']]);
        }

        if (!empty($data['bookingId']) && $this->scalar('SELECT id FROM bookings WHERE id = ?', [$data['bookingId']])) {
            if ($author['role'] === 'client') {
                $this->q('UPDATE bookings SET master_rating = ?, review_text = ? WHERE id = ?', [$rating, $data['text'] ?? '', $data['bookingId']]);
            } else {
                $this->q('UPDATE bookings SET client_rating = ? WHERE id = ?', [$rating, $data['bookingId']]);
            }
        }

        return $this->mapReview($this->one('SELECT * FROM reviews WHERE id = ?', [$id]));
    }

    public function getUserReviews(string $targetUserId): array
    {
        $rows = $this->many('SELECT * FROM reviews WHERE target_user_id = ? ORDER BY created_at DESC', [$targetUserId]);
        return array_map(fn($r) => $this->mapReview($r), $rows);
    }

    // ================================================================
    //  Чаты и сообщения
    // ================================================================

    public function getUserChats(string $userId): array
    {
        $rows = $this->many(
            "SELECT * FROM chats WHERE client_id = ? OR master_id = ? ORDER BY COALESCE(last_message_time, '') DESC",
            [$userId, $userId]
        );
        return array_map(fn($r) => $this->mapChat($r), $rows);
    }

    public function findChatById(string $chatId): ?array
    {
        $row = $this->one('SELECT * FROM chats WHERE id = ? LIMIT 1', [$chatId]);
        return $row ? $this->mapChat($row) : null;
    }

    public function getChatMessages(string $chatId): array
    {
        $rows = $this->many('SELECT * FROM messages WHERE chat_id = ? ORDER BY seq ASC', [$chatId]);
        return array_map(fn($r) => $this->mapMessage($r), $rows);
    }

    public function sendMessage(array $data): array
    {
        $sender = $this->findUserById($data['senderId'] ?? '');
        if (!$sender) {
            throw new RuntimeException('Пользователь не найден');
        }

        $text     = (string)($data['text'] ?? '');
        $imageUrl = $data['imageUrl'] ?? null;

        $message = $this->insertMessage([
            'chatId'       => $data['chatId'],
            'senderId'     => $sender['id'],
            'senderName'   => $sender['name'],
            'senderAvatar' => $sender['avatar'],
            'text'         => $text,
            'imageUrl'     => $imageUrl,
        ]);

        $chat = $this->one('SELECT * FROM chats WHERE id = ?', [$data['chatId']]);
        if ($chat) {
            $unreadColumn = $sender['id'] === $chat['client_id'] ? 'unread_count_master' : 'unread_count_client';
            $this->q(
                "UPDATE chats SET last_message = ?, last_message_time = ?, last_message_sender_id = ?, $unreadColumn = $unreadColumn + 1 WHERE id = ?",
                [$imageUrl ? '📷 Фото-референс' : $text, $message['createdAt'], $sender['id'], $data['chatId']]
            );
        }

        return $message;
    }

    public function markChatRead(string $chatId, string $readerId): void
    {
        $chat = $this->one('SELECT * FROM chats WHERE id = ?', [$chatId]);
        if (!$chat) {
            return;
        }
        $column = $readerId === $chat['client_id'] ? 'unread_count_client' : 'unread_count_master';
        $this->q("UPDATE chats SET $column = 0 WHERE id = ?", [$chatId]);
        // Помечаем прочитанными сообщения собеседника — для галочек «прочитано».
        $this->q(
            'UPDATE messages SET read_at = ? WHERE chat_id = ? AND sender_id <> ? AND read_at IS NULL',
            [now_iso(), $chatId, $readerId]
        );
    }

    private function insertMessage(array $data): array
    {
        $id = uid('msg');
        $text = (string)($data['text'] ?? '');
        $this->q(
            'INSERT INTO messages (id, chat_id, sender_id, sender_name, sender_avatar, text, image_url, created_at)
             VALUES (?,?,?,?,?,?,?,?)',
            [
                $id,
                $data['chatId'],
                $data['senderId'] ?? null,
                $data['senderName'] ?? null,
                $data['senderAvatar'] ?? null,
                $text,
                $data['imageUrl'] ?? null,
                now_iso(),
            ]
        );
        return $this->mapMessage($this->one('SELECT * FROM messages WHERE id = ?', [$id]));
    }

    private function insertTransaction(array $data): array
    {
        $id = uid('tx');
        $this->q(
            'INSERT INTO transactions (id, type, booking_id, user_id, user_name, amount, commission_fee,
                                       description, payment_ref, payout_destination, status, created_at)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
            [
                $id,
                $data['type'],
                $data['bookingId'] ?? null,
                $data['userId'] ?? null,
                $data['userName'] ?? null,
                (float)($data['amount'] ?? 0),
                isset($data['commissionFee']) ? (float)$data['commissionFee'] : null,
                $data['description'] ?? '',
                $data['paymentRef'] ?? null,
                $data['payoutDestination'] ?? null,
                $data['status'] ?? null,
                now_iso(),
            ]
        );
        return $this->mapTransaction($this->one('SELECT * FROM transactions WHERE id = ?', [$id]));
    }

    // ================================================================
    //  Оплата объявлений (подписка мастера на размещение работ)
    // ================================================================

    /** Настройки размещения объявлений из админ-панели. */
    public function listingSettings(): array
    {
        $defaults = ['enabled' => true, 'singlePrice' => 100.0, 'packPrice' => 300.0, 'packSize' => 6];
        try {
            $row = $this->one('SELECT settings_json FROM admin_site_settings WHERE id = 1');
        } catch (Throwable $e) {
            return $defaults;
        }
        $s = $row ? json_decode((string)$row['settings_json'], true) : null;
        if (!is_array($s)) {
            return $defaults;
        }
        return [
            'enabled'     => array_key_exists('listingEnabled', $s) ? (bool)$s['listingEnabled'] : $defaults['enabled'],
            'singlePrice' => isset($s['listingPriceSingle']) ? (float)$s['listingPriceSingle'] : $defaults['singlePrice'],
            'packPrice'   => isset($s['listingPricePack']) ? (float)$s['listingPricePack'] : $defaults['packPrice'],
            'packSize'    => isset($s['listingPackSize']) ? max(1, (int)$s['listingPackSize']) : $defaults['packSize'],
        ];
    }

    private function mapSubscription(array $r): array
    {
        $total = (int)($r['slots_total'] ?? 0);
        $used  = (int)($r['slots_used'] ?? 0);
        return [
            'id'         => $r['id'],
            'masterId'   => $r['master_id'],
            'plan'       => $r['plan'] ?? 'single',
            'slotsTotal' => $total,
            'slotsUsed'  => $used,
            'slotsLeft'  => max(0, $total - $used),
            'amount'     => (float)($r['amount'] ?? 0),
            'paidUntil'  => $r['paid_until'] ?? null,
            'paymentId'  => $r['payment_id'] ?? null,
            'status'     => $r['status'] ?? 'pending',
            'createdAt'  => $r['created_at'] ?? '',
        ];
    }

    public function createSubscription(string $masterId, string $plan): array
    {
        $settings = $this->listingSettings();
        $plan  = $plan === 'pack' ? 'pack' : 'single';
        $slots = $plan === 'pack' ? $settings['packSize'] : 1;
        $amount = $plan === 'pack' ? $settings['packPrice'] : $settings['singlePrice'];

        $id = uid('sub');
        $this->q(
            "INSERT INTO work_subscriptions (id, master_id, plan, slots_total, slots_used, amount, paid_until, payment_id, status, created_at)
             VALUES (?,?,?,?,0,?,NULL,NULL,'pending',?)",
            [$id, $masterId, $plan, $slots, $amount, now_iso()]
        );
        return $this->findSubscriptionById($id);
    }

    public function findSubscriptionById(string $id): ?array
    {
        $row = $this->one('SELECT * FROM work_subscriptions WHERE id = ? LIMIT 1', [$id]);
        return $row ? $this->mapSubscription($row) : null;
    }

    public function findSubscriptionByPaymentId(string $paymentId): ?array
    {
        $row = $this->one('SELECT * FROM work_subscriptions WHERE payment_id = ? ORDER BY created_at DESC LIMIT 1', [$paymentId]);
        return $row ? $this->mapSubscription($row) : null;
    }

    public function setSubscriptionPayment(string $id, string $paymentId): void
    {
        $this->q('UPDATE work_subscriptions SET payment_id = ? WHERE id = ?', [$paymentId, $id]);
    }

    /** Подтвердить оплату подписки: продлить срок на 1 месяц, активировать слоты. */
    public function activateSubscription(string $id, ?string $paymentId = null): ?array
    {
        $row = $this->one('SELECT * FROM work_subscriptions WHERE id = ? LIMIT 1', [$id]);
        if (!$row) {
            return null;
        }
        $now = time();
        $base = max($now, iso_to_ts($row['paid_until'] ?? null));
        // Продление: если у мастера уже есть действующая подписка — суммируем срок.
        $active = $this->getActiveSubscriptionExcluding((string)$row['master_id'], $id);
        if ($active && !empty($active['paidUntil'])) {
            $base = max($base, iso_to_ts($active['paidUntil']));
        }
        $paidUntil = date('c', $base + 30 * 86400);

        $this->q(
            "UPDATE work_subscriptions SET status = 'active', paid_until = ?, payment_id = COALESCE(?, payment_id) WHERE id = ?",
            [$paidUntil, $paymentId, $id]
        );
        return $this->findSubscriptionById($id);
    }

    public function cancelSubscription(string $id): ?array
    {
        $this->q("UPDATE work_subscriptions SET status = 'canceled' WHERE id = ? AND status <> 'active'", [$id]);
        return $this->findSubscriptionById($id);
    }

    public function getActiveSubscription(string $masterId): ?array
    {
        return $this->getActiveSubscriptionExcluding($masterId, null);
    }

    private function getActiveSubscriptionExcluding(string $masterId, ?string $excludeId): ?array
    {
        $rows = $this->many(
            "SELECT * FROM work_subscriptions WHERE master_id = ? AND status = 'active' ORDER BY paid_until DESC",
            [$masterId]
        );
        $now = time();
        foreach ($rows as $r) {
            if ($excludeId !== null && (string)$r['id'] === $excludeId) {
                continue;
            }
            if (iso_to_ts($r['paid_until'] ?? null) > $now) {
                return $this->mapSubscription($r);
            }
        }
        return null;
    }

    public function getMasterSubscriptions(string $masterId): array
    {
        $rows = $this->many(
            'SELECT * FROM work_subscriptions WHERE master_id = ? ORDER BY created_at DESC LIMIT 50',
            [$masterId]
        );
        return array_map(fn($r) => $this->mapSubscription($r), $rows);
    }

    /** Текущий статус размещения объявлений для мастера. */
    public function masterListingStatus(string $masterId): array
    {
        $settings = $this->listingSettings();
        $user = $this->findUserById($masterId);
        $freeUntil = $user['listingFreeUntil'] ?? null;
        $freeActive = iso_to_ts($freeUntil) > time();
        $sub = $this->getActiveSubscription($masterId);
        $slotsLeft = $sub ? max(0, (int)$sub['slotsTotal'] - (int)$sub['slotsUsed']) : 0;

        return [
            'paymentsEnabled' => $settings['enabled'],
            'singlePrice'     => $settings['singlePrice'],
            'packPrice'       => $settings['packPrice'],
            'packSize'        => $settings['packSize'],
            'freeUntil'       => $freeActive ? $freeUntil : null,
            'subscription'    => $sub,
            'slotsLeft'       => $freeActive ? null : $slotsLeft,
            'canPublish'      => !$settings['enabled'] || $freeActive || $slotsLeft > 0,
        ];
    }

    /**
     * Проверить право на публикацию и списать слот подписки.
     * Возвращает срок действия объявления (paid_until) либо null, если оплата выключена.
     */
    public function consumeListingForWork(string $masterId): ?string
    {
        $settings = $this->listingSettings();
        if (!$settings['enabled']) {
            return null;
        }
        $user = $this->findUserById($masterId);
        $freeUntil = $user['listingFreeUntil'] ?? null;
        if (iso_to_ts($freeUntil) > time()) {
            return $freeUntil;
        }
        $sub = $this->getActiveSubscription($masterId);
        if ($sub && (int)$sub['slotsUsed'] < (int)$sub['slotsTotal']) {
            $this->q('UPDATE work_subscriptions SET slots_used = slots_used + 1 WHERE id = ?', [$sub['id']]);
            return $sub['paidUntil'];
        }
        throw new RuntimeException('PAYMENT_REQUIRED');
    }

    // ================================================================
    //  Администрирование: пользователи, мастера, тех. учётки
    // ================================================================

    public function getAllUsers(?string $role = null, ?string $query = null): array
    {
        $sql = 'SELECT * FROM users';
        $where = [];
        $params = [];
        if ($role !== null && in_array($role, ['client', 'master', 'admin', 'support'], true)) {
            $where[] = 'role = ?';
            $params[] = $role;
        }
        if ($query !== null && trim($query) !== '') {
            $where[] = '(name LIKE ? OR email LIKE ? OR login LIKE ?)';
            $like = '%' . trim($query) . '%';
            $params[] = $like;
            $params[] = $like;
            $params[] = $like;
        }
        if ($where) {
            $sql .= ' WHERE ' . implode(' AND ', $where);
        }
        $sql .= ' ORDER BY created_at DESC LIMIT 500';
        return array_map(fn($r) => $this->mapUser($r), $this->many($sql, $params));
    }

    public function getAllMasters(?string $query = null): array
    {
        return $this->getAllUsers('master', $query);
    }

    /** Выдать бесплатное размещение объявлений на указанное число месяцев. */
    public function grantFreeListing(string $userId, int $months = 1): ?array
    {
        $months = max(1, min(12, $months));
        $user = $this->findUserById($userId);
        if (!$user) {
            return null;
        }
        $base = max(time(), iso_to_ts($user['listingFreeUntil'] ?? null));
        $until = date('c', $base + $months * 30 * 86400);
        $this->q('UPDATE users SET listing_free_until = ? WHERE id = ?', [$until, $userId]);
        return $this->findUserById($userId);
    }

    /** Создать техническую учётку со входом по логину и паролю без подтверждения email. */
    public function createTechnicalUser(array $data): array
    {
        $login = trim((string)($data['login'] ?? ''));
        $role  = in_array($data['role'] ?? '', ['support', 'admin', 'master', 'client'], true) ? $data['role'] : 'support';
        $email = trim((string)($data['email'] ?? ''));
        if ($email === '') {
            $email = $login . '@support.local';
        }
        return $this->createUser([
            'email'    => $email,
            'name'     => trim((string)($data['name'] ?? '')) ?: $login,
            'login'    => $login,
            'password' => (string)($data['password'] ?? ''),
            'role'     => $role,
            'phone'    => (string)($data['phone'] ?? ''),
            'city'     => (string)($data['city'] ?? 'Москва'),
            'district' => (string)($data['district'] ?? 'Центральный'),
        ]);
    }

    // ================================================================
    //  Поддержка (обращения клиентов и мастеров)
    // ================================================================

    private function mapSupportTicket(array $r): array
    {
        return [
            'id'              => $r['id'],
            'userId'          => $r['user_id'],
            'userName'        => $r['user_name'] ?? '',
            'userRole'        => $r['user_role'] ?? 'client',
            'subject'         => $r['subject'] ?? '',
            'status'          => $r['status'] ?? 'open',
            'lastMessage'     => $r['last_message'] ?? '',
            'lastMessageTime' => $r['last_message_time'] ?? null,
            'unreadForSupport'=> (int)($r['unread_for_support'] ?? 0),
            'unreadForUser'   => (int)($r['unread_for_user'] ?? 0),
            'createdAt'       => $r['created_at'] ?? '',
        ];
    }

    private function mapSupportMessage(array $r): array
    {
        return [
            'id'         => $r['id'],
            'ticketId'   => $r['ticket_id'],
            'senderId'   => $r['sender_id'] ?? '',
            'senderName' => $r['sender_name'] ?? '',
            'senderRole' => $r['sender_role'] ?? 'client',
            'text'       => $r['text'] ?? '',
            'createdAt'  => $r['created_at'] ?? '',
        ];
    }

    public function createSupportTicket(string $userId, string $subject, string $text): array
    {
        $user = $this->findUserById($userId);
        if (!$user) {
            throw new RuntimeException('Пользователь не найден');
        }
        $text = trim($text);
        if ($text === '') {
            throw new RuntimeException('Введите текст обращения');
        }
        $id = uid('st');
        $this->q(
            "INSERT INTO support_tickets (id, user_id, user_name, user_role, subject, status, last_message,
                last_message_time, unread_for_support, unread_for_user, created_at)
             VALUES (?,?,?,?,?,'open',?,?,1,0,?)",
            [
                $id, $user['id'], $user['name'], $user['role'],
                mb_substr(trim($subject), 0, 180) ?: 'Обращение в поддержку',
                mb_substr($text, 0, 500), now_iso(), now_iso(),
            ]
        );
        $this->insertSupportMessage($id, $user['id'], $user['name'], $user['role'], $text);
        return $this->findSupportTicket($id);
    }

    public function findSupportTicket(string $id): ?array
    {
        $row = $this->one('SELECT * FROM support_tickets WHERE id = ? LIMIT 1', [$id]);
        return $row ? $this->mapSupportTicket($row) : null;
    }

    public function getSupportTickets(?string $userId, bool $all): array
    {
        if ($all) {
            $rows = $this->many('SELECT * FROM support_tickets ORDER BY COALESCE(last_message_time, created_at) DESC LIMIT 200');
        } else {
            $rows = $this->many(
                'SELECT * FROM support_tickets WHERE user_id = ? ORDER BY COALESCE(last_message_time, created_at) DESC LIMIT 100',
                [$userId]
            );
        }
        return array_map(fn($r) => $this->mapSupportTicket($r), $rows);
    }

    public function getSupportMessages(string $ticketId): array
    {
        $rows = $this->many('SELECT * FROM support_messages WHERE ticket_id = ? ORDER BY seq ASC', [$ticketId]);
        return array_map(fn($r) => $this->mapSupportMessage($r), $rows);
    }

    private function insertSupportMessage(string $ticketId, ?string $senderId, ?string $senderName, string $senderRole, string $text): array
    {
        $id = uid('sm');
        $this->q(
            'INSERT INTO support_messages (id, ticket_id, sender_id, sender_name, sender_role, text, created_at)
             VALUES (?,?,?,?,?,?,?)',
            [$id, $ticketId, $senderId, $senderName, $senderRole, $text, now_iso()]
        );
        return $this->mapSupportMessage($this->one('SELECT * FROM support_messages WHERE id = ?', [$id]));
    }

    public function sendSupportMessage(string $ticketId, string $senderId, string $text): array
    {
        $ticket = $this->one('SELECT * FROM support_tickets WHERE id = ? LIMIT 1', [$ticketId]);
        if (!$ticket) {
            throw new RuntimeException('Обращение не найдено');
        }
        $sender = $this->findUserById($senderId);
        if (!$sender) {
            throw new RuntimeException('Пользователь не найден');
        }
        $text = trim($text);
        if ($text === '') {
            throw new RuntimeException('Введите текст сообщения');
        }
        $isStaff = in_array($sender['role'], ['admin', 'support'], true);
        $message = $this->insertSupportMessage($ticketId, $sender['id'], $sender['name'], $sender['role'], $text);
        $unreadCol = $isStaff ? 'unread_for_user' : 'unread_for_support';
        $this->q(
            "UPDATE support_tickets SET last_message = ?, last_message_time = ?, $unreadCol = $unreadCol + 1, status = ? WHERE id = ?",
            [mb_substr($text, 0, 500), now_iso(), $isStaff ? 'answered' : 'open', $ticketId]
        );
        return $message;
    }

    public function markSupportRead(string $ticketId, string $role): void
    {
        $isStaff = in_array($role, ['admin', 'support'], true);
        $col = $isStaff ? 'unread_for_support' : 'unread_for_user';
        $this->q("UPDATE support_tickets SET $col = 0 WHERE id = ?", [$ticketId]);
    }

    // ================================================================
    //  Аналитика мастера
    // ================================================================

    public function getMasterStats(string $masterId, string $period = 'month'): array
    {
        if (!in_array($period, ['week', 'month', 'year', 'all'], true)) {
            $period = 'month';
        }

        $rows = $this->many(
            "SELECT * FROM bookings WHERE master_id = ? AND status IN ('completed', 'Completed_and_Paid')",
            [$masterId]
        );
        $all = array_map(fn($r) => $this->mapBooking($r), $rows);

        $now = time();
        $periodBookings = array_values(array_filter($all, function ($b) use ($period, $now) {
            if ($period === 'all') {
                return true;
            }
            $ts = iso_to_ts($b['createdAt'] ?: $b['date']);
            if (!$ts) {
                return true;
            }
            $diffDays = ($now - $ts) / 86400;
            if ($period === 'week') {
                return $diffDays <= 7;
            }
            if ($period === 'month') {
                return $diffDays <= 30;
            }
            if ($period === 'year') {
                return $diffDays <= 365;
            }
            return true;
        }));

        $totalRevenue = array_sum(array_map(fn($b) => (float)$b['servicePrice'], $periodBookings));
        $count        = count($periodBookings);
        $uniqueClients = count(array_unique(array_map(fn($b) => $b['clientId'], $periodBookings)));
        $avgOrderValue = $count > 0 ? (int)round($totalRevenue / $count) : 0;

        $revenueByDay = [];
        if ($period === 'week') {
            $days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
            foreach ([1, 2, 3, 4, 5, 6, 0] as $dayIdx) {
                $group = array_values(array_filter($periodBookings, function ($b) use ($dayIdx) {
                    $ts = iso_to_ts($b['date']);
                    return $ts && (int)date('w', $ts) === $dayIdx;
                }));
                $revenueByDay[] = [
                    'label'    => $days[$dayIdx],
                    'amount'   => array_sum(array_map(fn($b) => (float)$b['servicePrice'], $group)),
                    'bookings' => count($group),
                ];
            }
        } elseif ($period === 'month') {
            foreach ([1, 2, 3, 4] as $wNum) {
                $group = array_values(array_filter($periodBookings, function ($b) use ($wNum) {
                    $ts = iso_to_ts($b['date']);
                    if (!$ts) {
                        return false;
                    }
                    $day = (int)date('j', $ts);
                    return $day > ($wNum - 1) * 7 && $day <= $wNum * 7;
                }));
                $revenueByDay[] = [
                    'label'    => $wNum . ' Нед',
                    'amount'   => array_sum(array_map(fn($b) => (float)$b['servicePrice'], $group)),
                    'bookings' => count($group),
                ];
            }
        } else {
            $months = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
            foreach ($months as $mIdx => $mName) {
                $group = array_values(array_filter($periodBookings, function ($b) use ($mIdx) {
                    $ts = iso_to_ts($b['date']);
                    return $ts && (int)date('n', $ts) - 1 === $mIdx;
                }));
                $revenueByDay[] = [
                    'label'    => $mName,
                    'amount'   => array_sum(array_map(fn($b) => (float)$b['servicePrice'], $group)),
                    'bookings' => count($group),
                ];
            }
        }

        $categoryMap = [];
        foreach ($periodBookings as $b) {
            $cat = $b['serviceTitle'] ?: 'Прочие услуги';
            $categoryMap[$cat]['count'] = ($categoryMap[$cat]['count'] ?? 0) + 1;
            $categoryMap[$cat]['total'] = ($categoryMap[$cat]['total'] ?? 0) + (float)$b['servicePrice'];
        }
        $categoryBreakdown = [];
        foreach ($categoryMap as $cat => $d) {
            $categoryBreakdown[] = [
                'category'   => $cat,
                'count'      => $d['count'],
                'percentage' => $totalRevenue > 0 ? (int)round(($d['total'] / $totalRevenue) * 100) : 0,
            ];
        }

        return [
            'period'                 => $period,
            'totalRevenue'           => $totalRevenue,
            'completedBookingsCount' => $count,
            'newClientsCount'        => $uniqueClients,
            'avgOrderValue'          => $avgOrderValue,
            'revenueByDay'           => $revenueByDay,
            'categoryBreakdown'      => $categoryBreakdown,
        ];
    }

    // ================================================================
    //  События реального времени (long-poll)
    // ================================================================

    public function pushEvent(string $type, $payload, array $targetUserIds = []): void
    {
        $json = json_encode($payload, JSON_UNESCAPED_UNICODE);
        if (!$targetUserIds) {
            $this->q('INSERT INTO events (user_id, type, payload, created_at) VALUES (NULL, ?, ?, ?)',
                [$type, $json, now_iso()]);
            return;
        }
        foreach (array_unique($targetUserIds) as $userId) {
            if (!is_string($userId) || $userId === '') {
                continue;
            }
            $this->q('INSERT INTO events (user_id, type, payload, created_at) VALUES (?, ?, ?, ?)',
                [$userId, $type, $json, now_iso()]);
        }
    }

    public function pollEvents(?string $userId, int $since): array
    {
        $sql = 'SELECT id, type, payload FROM events WHERE id > ? AND (user_id IS NULL';
        $params = [$since];
        if ($userId) {
            $sql .= ' OR user_id = ?';
            $params[] = $userId;
        }
        $sql .= ') ORDER BY id ASC LIMIT 100';

        $rows = $this->many($sql, $params);

        $items = [];
        $lastId = $since;
        foreach ($rows as $r) {
            $items[] = [
                'id'      => (int)$r['id'],
                'type'    => $r['type'],
                'payload' => json_decode((string)$r['payload'], true) ?: [],
            ];
            $lastId = (int)$r['id'];
        }

        return ['items' => $items, 'lastId' => $lastId];
    }

    // ================================================================
    //  Web Push: подписки устройств и ключи сервера (VAPID)
    // ================================================================

    /** Сохранить (или обновить) подписку устройства на push-уведомления. */
    public function savePushSubscription(string $userId, array $sub): void
    {
        $endpoint = trim((string)($sub['endpoint'] ?? ''));
        $publicKey = trim((string)($sub['publicKey'] ?? ''));
        $authKey = trim((string)($sub['authKey'] ?? ''));
        if ($userId === '' || $endpoint === '' || $publicKey === '' || $authKey === '') {
            return;
        }

        $hash = hash('sha256', $endpoint);
        $encoding = trim((string)($sub['contentEncoding'] ?? '')) ?: null;
        $userAgent = mb_substr(trim((string)($sub['userAgent'] ?? '')), 0, 190);
        $existing = $this->one('SELECT id FROM push_subscriptions WHERE endpoint_hash = ?', [$hash]);

        if ($existing) {
            $this->q(
                'UPDATE push_subscriptions SET user_id = ?, endpoint = ?, public_key = ?, auth_key = ?, content_encoding = ?, user_agent = ?, created_at = ? WHERE id = ?',
                [$userId, $endpoint, $publicKey, $authKey, $encoding, $userAgent, now_iso(), $existing['id']]
            );
            return;
        }

        $this->q(
            'INSERT INTO push_subscriptions (user_id, endpoint_hash, endpoint, public_key, auth_key, content_encoding, user_agent, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [$userId, $hash, $endpoint, $publicKey, $authKey, $encoding, $userAgent, now_iso()]
        );
    }

    /** Удалить подписку по endpoint (устройство отписано или устарело). */
    public function deletePushSubscription(string $endpoint): void
    {
        if ($endpoint === '') {
            return;
        }
        $this->q('DELETE FROM push_subscriptions WHERE endpoint_hash = ?', [hash('sha256', $endpoint)]);
    }

    /** Удалить подписку по внутреннему id (после ответа 404/410 от push-сервиса). */
    public function deletePushSubscriptionById(int $id): void
    {
        $this->q('DELETE FROM push_subscriptions WHERE id = ?', [$id]);
    }

    /** Все подписки пользователя (у одного пользователя их может быть несколько — телефон, планшет). */
    public function getPushSubscriptions(string $userId): array
    {
        if ($userId === '') {
            return [];
        }
        $rows = $this->many('SELECT id, endpoint, public_key, auth_key FROM push_subscriptions WHERE user_id = ?', [$userId]);
        return array_map(static function (array $r): array {
            return [
                'id'        => (int)$r['id'],
                'endpoint'  => (string)$r['endpoint'],
                'publicKey' => (string)$r['public_key'],
                'authKey'   => (string)$r['auth_key'],
            ];
        }, $rows);
    }

    /** Ключи VAPID сервера или null, если они ещё не созданы. */
    public function vapidKeys(): ?array
    {
        $row = $this->one('SELECT public_key, private_key FROM push_vapid WHERE id = 1');
        if (!$row) {
            return null;
        }
        return ['publicKey' => (string)$row['public_key'], 'privateKey' => (string)$row['private_key']];
    }

    /** Сохранить ключи VAPID сервера. */
    public function saveVapidKeys(string $publicKey, string $privateKey): void
    {
        $this->q(
            'INSERT INTO push_vapid (id, public_key, private_key, created_at) VALUES (1, ?, ?, ?)
             ON DUPLICATE KEY UPDATE public_key = VALUES(public_key), private_key = VALUES(private_key)',
            [$publicKey, $privateKey, now_iso()]
        );
    }
}
