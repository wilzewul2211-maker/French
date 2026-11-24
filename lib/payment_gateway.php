<?php
/**
 * Вебхук платёжной системы ЮKassa.
 *
 * Обрабатывает уведомления payment.succeeded / payment.canceled:
 * подтверждает оплату подписки мастера на объявления.
 * Остальные маршруты /api/payments* отвечают 501 — платёжный шлюз для записей не используется.
 */

function payment_gateway_handle(string $method, string $path): void
{
    if ($path === '/webhook' || str_ends_with($path, '/webhook') || str_ends_with($path, '/webhook/')) {
        payment_webhook_handle();
        return;
    }

    json_error('Платёжный шлюз не подключён для этого метода.', 501);
}

/** Вебхук ЮKassa: подтверждение/отмена платежа за подписку. */
function payment_webhook_handle(): void
{
    $raw = file_get_contents('php://input');
    $data = json_decode((string)$raw, true);

    if (!is_array($data) || empty($data['event']) || empty($data['object'])) {
        json_response(['status' => 'ignored']);
    }

    $event   = (string)$data['event'];
    $payment = (array)$data['object'];
    $paymentId = (string)($payment['id'] ?? '');
    $metadata  = (array)($payment['metadata'] ?? []);
    $subId     = (string)($metadata['subscription_id'] ?? '');

    if ($subId === '' && $paymentId !== '') {
        $sub = repo()->findSubscriptionByPaymentId($paymentId);
        $subId = $sub ? $sub['id'] : '';
    }
    if ($subId === '') {
        json_response(['status' => 'ignored']);
    }

    if ($event === 'payment.succeeded') {
        repo()->activateSubscription($subId, $paymentId);
    } elseif ($event === 'payment.canceled') {
        repo()->cancelSubscription($subId);
    }

    json_response(['status' => 'ok']);
}
