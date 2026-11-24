<?php
/**
 * Единая точка входа: серверный каркас страницы + контейнер для разделов.
 * Навигация и шапка рендерятся сервером, содержимое разделов — на клиенте через API.
 */

require_once __DIR__ . '/bootstrap.php';

$user = current_user();
$siteSettings = admin_site_settings()['settings'];
$allowedTabs = ['feed', 'search', 'posts', 'chats', 'profile'];
if ($user && in_array($user['role'], ['admin', 'support'], true)) {
    $allowedTabs[] = 'admin';
}

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';

$page = 'app';
if (strpos($path, '/booking/success') !== false || strpos($path, '/payment/success') !== false) {
    $page = 'booking_success';
} elseif (strpos($path, '/booking/failed') !== false || strpos($path, '/payment/failed') !== false) {
    $page = 'booking_failed';
}

$tab = $_GET['tab'] ?? 'feed';
if (!in_array($tab, $allowedTabs, true)) {
    $tab = 'feed';
}

$unread = 0;
if ($user) {
    foreach (repo()->getUserChats($user['id']) as $chat) {
        $unread += (int)($user['role'] === 'master' ? ($chat['unreadCountMaster'] ?? 0) : ($chat['unreadCountClient'] ?? 0));
    }
}
$assetUrl = static function (string $path): string {
    $file = __DIR__ . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $path);
    $version = is_file($file) ? (string)filemtime($file) : '1';
    return '/' . $path . '?v=' . rawurlencode($version);
};
?>
<!DOCTYPE html>
<html lang="ru" data-tab="<?= e($tab) ?>">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>French Beauty Network — Бьюти-сеть и сообщество</title>
  <meta name="description" content="Эксклюзивная бьюти-сеть French: онлайн-запись к мастерам, портфолио, чаты и сообщество.">

  <!-- PWA: установка как приложение (Android / iOS) -->
  <link rel="manifest" href="/manifest.json">
  <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)">
  <meta name="theme-color" content="#0A0A0C" media="(prefers-color-scheme: dark)">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-title" content="French">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <link rel="icon" type="image/png" sizes="192x192" href="/assets/icons/icon-192.png">
  <link rel="apple-touch-icon" sizes="180x180" href="/assets/icons/apple-touch-icon.png">

  <link rel="stylesheet" href="<?= e($assetUrl('assets/css/app.css')) ?>">
  <style>:root{--fr-accent:<?= e($siteSettings['accentColor']) ?>}</style>
  <?php $elementCss = element_styles_css($siteSettings['elementStyles'] ?? []); ?>
  <?php if ($elementCss !== ''): ?>
  <style id="fr-element-styles"><?= $elementCss ?></style>
  <?php endif; ?>
  <style>
    /* ===== Раздел «Чаты»: фиксированная раскладка без прокрутки страницы ===== */
    html[data-tab="chats"] body { overflow: hidden; }
    html[data-tab="chats"] #app-root {
      height: 100vh;
      height: 100dvh;
      overflow: hidden;
      overscroll-behavior: none;
    }
    html[data-tab="chats"] #app-main {
      flex: 1 1 0%;
      min-height: 0;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    html[data-tab="chats"] #app-main > * { flex: 1 1 auto; min-height: 0; }
    html[data-tab="chats"] .fr-footer { display: none; }

    /* Внутренние области прокрутки не «протягивают» страницу и не дают свободного хода. */
    html[data-tab="chats"] [data-chat-list],
    html[data-tab="chats"] [data-messages] {
      overscroll-behavior: contain;
      -webkit-overflow-scrolling: touch;
    }

    /* Поле ввода всегда видно: учитываем «безопасную зону» снизу. */
    html[data-tab="chats"] [data-form] {
      padding-bottom: calc(0.75rem + env(safe-area-inset-bottom));
    }
    @media (max-width: 767px) {
      /* Оставляем место под фиксированную мобильную навигацию, чтобы поле не уходило под низ. */
      html[data-tab="chats"] #app-main {
        padding-bottom: calc(4.5rem + env(safe-area-inset-bottom));
      }
    }

    /* ===== Фото в чате: корректные пропорции без искажения ===== */
    .fr-chat-photo-wrap {
      width: 100%;
      max-width: min(20rem, 78vw);
    }
    .fr-chat-photo {
      display: block;
      width: 100%;
      height: auto;
      max-height: 60vh;
      object-fit: contain;
      background: #f4f4f5;
    }
    html.dark .fr-chat-photo { background: #18181b; }

    /* ===== Кнопка установки приложения ===== */
    [data-pwa-install-btn] { display: inline-flex; align-items: center; gap: 0.375rem; }
    [data-pwa-install-btn].hidden { display: none; }
    .fr-install-label { display: none; }
    @media (min-width: 640px) { .fr-install-label { display: inline; } }
  </style>
  <script>
    window.__ICONS = <?= json_for_js(icon_set()) ?>;
    window.__USER = <?= json_for_js($user) ?>;
    window.__TAB = <?= json_for_js($tab) ?>;
    window.__PAGE = <?= json_for_js($page) ?>;
    window.__PLATFORM_PERCENT = <?= (float)config('fees.platform_percent', 4) ?>;
    window.__SERVICE_CATEGORIES = <?= json_for_js(service_categories()) ?>;
    window.__MOSCOW_DISTRICTS = <?= json_for_js(moscow_districts()) ?>;
    window.__SITE_SETTINGS = <?= json_for_js($siteSettings) ?>;
    (function () {
      try {
        if (localStorage.getItem('french_theme') === 'dark') {
          document.documentElement.classList.add('dark');
        }
      } catch (e) {}
    })();
  </script>
</head>
<body class="bg-white dark:bg-[#0A0A0C] text-black dark:text-white">
  <div id="app-root" class="fr-root min-h-screen bg-white dark:bg-[#0A0A0C] text-black dark:text-white flex flex-col font-sans selection:bg-rose-600 selection:text-white">

    <?php include __DIR__ . '/partials/header.php'; ?>

    <main id="app-main" class="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 pb-20 md:pb-8"></main>

    <footer data-style-key="footer" class="fr-footer bg-white dark:bg-[#0A0A0C] border-t border-zinc-200 dark:border-zinc-800 py-6 text-center text-xs text-zinc-500 dark:text-zinc-400">
      <div class="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
        <p>© 2026 French Beauty Network. Корпоративная платформа записи и сообщества.</p>
        <div class="flex space-x-4 text-[11px] font-bold text-zinc-500">
          <span>Безопасные записи</span>
          <span>•</span>
          <span>Конфиденциальность</span>
          <span>•</span>
          <span class="text-rose-600">Поддержка мастеров</span>
        </div>
      </div>
    </footer>
  </div>

  <?php include __DIR__ . '/partials/mobile_nav.php'; ?>

  <div id="overlay-host"></div>
  <div id="toast-host"></div>

  <script src="<?= e($assetUrl('assets/js/core.js')) ?>"></script>
  <script src="<?= e($assetUrl('assets/js/modals/lightbox.js')) ?>"></script>
  <script src="<?= e($assetUrl('assets/js/modals/auth.js')) ?>"></script>
  <script src="<?= e($assetUrl('assets/js/modals/master.js')) ?>"></script>
  <script src="<?= e($assetUrl('assets/js/modals/survey.js')) ?>"></script>
  <script src="<?= e($assetUrl('assets/js/modals/dispute.js')) ?>"></script>
  <script src="<?= e($assetUrl('assets/js/modals/review.js')) ?>"></script>
  <script src="<?= e($assetUrl('assets/js/sections/feed.js')) ?>"></script>
  <script src="<?= e($assetUrl('assets/js/sections/search.js')) ?>"></script>
  <script src="<?= e($assetUrl('assets/js/sections/posts.js')) ?>"></script>
  <script src="<?= e($assetUrl('assets/js/sections/messaging.js')) ?>"></script>
  <script src="<?= e($assetUrl('assets/js/sections/profile.js')) ?>"></script>
  <script src="<?= e($assetUrl('assets/js/sections/admin.js')) ?>"></script>
  <script src="<?= e($assetUrl('assets/js/app.js')) ?>"></script>
  <script src="<?= e($assetUrl('assets/js/pwa.js')) ?>"></script>
</body>
</html>
