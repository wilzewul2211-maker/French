<?php
require __DIR__ . '/bootstrap.php';
$r = repo();
$u = $r->findUserByEmail('master@test.com');
echo $u ? ('FOUND: ' . $u['id'] . ' ' . $u['name'] . ' role=' . $u['role'] . "\n") : "NOT FOUND\n";

$chats = $r->getUserChats($u['id'] ?? 'none');
echo "Chats count: " . count($chats) . "\n";
foreach ($chats as $c) {
    echo "  Chat: " . $c['id'] . " client=" . $c['clientName'] . " master=" . $c['masterName'] . "\n";
    $msgs = $r->getChatMessages($c['id']);
    echo "    Messages: " . count($msgs) . "\n";
}
