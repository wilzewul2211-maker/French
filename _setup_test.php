<?php
/** Временный скрипт для создания тестовых данных (клиент + мастер + чат). */
require_once __DIR__ . '/bootstrap.php';

$repo = repo();

// Мастер
$master = $repo->findUserByEmail('master@test.com');
if (!$master) {
    $master = $repo->createUser([
        'email' => 'master@test.com',
        'phone' => '+79000000001',
        'name'  => 'Test Master',
        'role'  => 'master',
        'avatar' => 'https://i.pravatar.cc/150?img=12',
        'city'  => 'Москва',
        'district' => 'Центральный',
        'specialty' => 'Бьюти-мастер',
        'balance' => 0,
    ]);
    echo "Created master: {$master['id']}\n";
    // Добавим услугу мастеру
    $repo->addService([
        'masterId' => $master['id'],
        'title'    => 'Маникюр',
        'category' => 'Ногти',
        'price'    => 2000,
        'durationMins' => 90,
    ]);
} else {
    echo "Master exists: {$master['id']}\n";
}

// Клиент
$client = $repo->findUserByEmail('client@test.com');
if (!$client) {
    $client = $repo->createUser([
        'email' => 'client@test.com',
        'phone' => '+79000000002',
        'name'  => 'Test Client',
        'role'  => 'client',
        'avatar' => 'https://i.pravatar.cc/150?img=5',
        'city'  => 'Москва',
        'district' => 'Центральный',
        'balance' => 5000,
    ]);
    echo "Created client: {$client['id']}\n";
} else {
    echo "Client exists: {$client['id']}\n";
}

// Создаём запись (и чат) между клиентом и мастером
$services = $repo->getMasterServices($master['id']);
if (!$repo->getUserChats($client['id'])) {
    $booking = $repo->createBooking([
        'clientId'  => $client['id'],
        'masterId'  => $master['id'],
        'serviceId' => $services[0]['id'],
        'date'      => '2026-12-01',
        'timeSlot'  => '14:00',
        'notes'     => 'Тестовая запись',
    ]);
    echo "Created booking + chat: {$booking['chat']['id']}\n";
}

echo "Done. Master email: master@test.com, Client email: client@test.com\n";
