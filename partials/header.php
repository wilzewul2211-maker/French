<?php
/**
 * Шапка сайта: логотип, основная навигация, переключатель темы, кошелёк, блок пользователя.
 * @var string   $tab
 * @var int      $unread
 * @var array|null $user
 */
$navItems = [
    ['id' => 'feed',    'label' => 'Лента работ',   'icon' => 'grid'],
    ['id' => 'search',  'label' => 'Поиск мастеров', 'icon' => 'search'],
    ['id' => 'posts',   'label' => 'Посты',          'icon' => 'newspaper'],
    ['id' => 'chats',   'label' => 'Чаты',           'icon' => 'message-square'],
    ['id' => 'profile', 'label' => 'Профиль',        'icon' => 'user'],
];
$visibility = $siteSettings['visibleTabs'] ?? [];
$navItems = array_values(array_filter($navItems, static function (array $item) use ($visibility): bool {
    return !array_key_exists($item['id'], $visibility) || $visibility[$item['id']];
}));
if ($user && in_array($user['role'], ['admin', 'support'], true)) {
    $navItems[] = [
        'id'    => 'admin',
        'label' => $user['role'] === 'admin' ? 'Админ-панель' : 'Поддержка',
        'icon'  => 'settings',
    ];
}
?>
<header data-style-key="header" class="sticky top-0 z-40 bg-white/95 dark:bg-[#0A0A0C]/95 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 shadow-xs">
  <div class="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
    <div class="flex items-center justify-between h-16 sm:h-20">

      <!-- Логотип и бренд -->
      <a href="/?tab=feed" data-nav-logo class="flex items-center space-x-2.5 cursor-pointer">
        <div class="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-black text-white flex items-center justify-center shadow-md border border-zinc-800">
          <span class="font-sans font-black text-lg sm:text-xl text-rose-500">F</span>
        </div>
        <div>
          <div class="flex items-center space-x-1.5">
            <span class="font-sans text-xl sm:text-2xl font-black text-black dark:text-white tracking-tight"><?= e($siteSettings['brandName'] ?? 'FRENCH') ?></span>
            <span class="text-[8px] sm:text-[9px] font-black tracking-[0.15em] uppercase bg-rose-600 text-white px-2 py-0.5 rounded-md shadow-xs"><?= e($siteSettings['brandBadge'] ?? 'Beauty') ?></span>
          </div>
          <p class="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-[0.15em] font-bold hidden sm:block"><?= e($siteSettings['tagline'] ?? 'Бьюти-сеть & Сообщество') ?></p>
        </div>
      </a>

      <!-- Навигация (десктоп) -->
      <nav class="hidden md:flex items-center space-x-1 bg-zinc-100 dark:bg-zinc-900/90 p-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800">
        <?php foreach ($navItems as $item):
            $active = $tab === $item['id'];
            $badge  = $item['id'] === 'chats';
            ?>
          <a href="/?tab=<?= e($item['id']) ?>" data-tab-link="<?= e($item['id']) ?>"
             class="relative flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-200 <?= $active ? 'text-black dark:text-white font-extrabold' : 'text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white' ?>">
            <span data-tab-pill class="<?= $active ? '' : 'hidden' ?> absolute inset-0 bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-700"></span>
            <span class="relative z-10 flex items-center space-x-2">
              <?= icon($item['icon'], 'w-3.5 h-3.5 ' . ($active ? 'text-rose-600 dark:text-rose-500' : 'text-zinc-500')) ?>
              <span><?= e($item['label']) ?></span>
              <?php if ($badge): ?>
                <span data-unread-badge class="<?= $unread > 0 ? '' : 'hidden' ?> ml-1 bg-rose-600 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full shadow-xs"><?= (int)$unread ?></span>
              <?php endif; ?>
            </span>
          </a>
        <?php endforeach; ?>
      </nav>

      <!-- Действия: установка приложения, уведомления, тема, кошелёк, пользователь -->
      <div class="flex items-center space-x-2 sm:space-x-3">

        <button type="button" data-pwa-install-btn title="Установить приложение"
                class="hidden shrink-0 p-2 sm:px-3 sm:py-2.5 rounded-xl text-rose-600 dark:text-rose-400 hover:text-white hover:bg-rose-600 dark:hover:bg-rose-600 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 transition-all shadow-2xs">
          <?= icon('download', 'w-4 h-4') ?>
          <span class="fr-install-label font-bold text-[11px] uppercase tracking-wider">Установить</span>
        </button>

        <button type="button" data-pwa-notify title="Включить уведомления"
                class="hidden p-2 sm:p-2.5 rounded-xl text-zinc-700 dark:text-zinc-300 hover:text-black dark:hover:text-white bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 transition-all shadow-2xs">
          <?= icon('bell', 'w-4 h-4') ?>
        </button>

        <button type="button" data-theme-toggle title="Переключить тему"
                class="p-2 sm:p-2.5 rounded-xl text-zinc-700 dark:text-zinc-300 hover:text-black dark:hover:text-white bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 transition-all shadow-2xs">
          <span data-theme-icon class="block"><?= icon('moon', 'w-4 h-4 text-zinc-700') ?></span>
        </button>

        <?php if ($user): ?>
          <div class="flex items-center space-x-2 sm:space-x-3">
            <a href="/?tab=profile"
               class="flex items-center space-x-2.5 bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 p-1 sm:p-1.5 sm:pr-3 rounded-xl border border-zinc-200 dark:border-zinc-800 cursor-pointer transition-colors shadow-2xs">
              <img src="<?= e(avatar_of($user)) ?>" <?= onerror_attr() ?> alt="<?= e($user['name']) ?>"
                   class="w-7 h-7 sm:w-8 sm:h-8 rounded-lg object-cover ring-2 ring-rose-600/80 shrink-0">
              <div class="text-left hidden lg:block">
                <p class="text-xs font-bold text-black dark:text-white leading-tight"><?= e($user['name']) ?></p>
                <div class="flex items-center space-x-1">
                  <?php if ($user['role'] === 'master'): ?>
                    <span class="text-[9px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-500 flex items-center">
                      <?= icon('scissors', 'w-2.5 h-2.5 mr-0.5') ?> Мастер
                    </span>
                  <?php elseif ($user['role'] === 'admin'): ?>
                    <span class="text-[9px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-500">Администратор</span>
                  <?php elseif ($user['role'] === 'support'): ?>
                    <span class="text-[9px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-500">Поддержка</span>
                  <?php else: ?>
                    <span class="text-[9px] font-bold uppercase tracking-wider text-zinc-500">Клиент</span>
                  <?php endif; ?>
                </div>
              </div>
            </a>

            <button type="button" data-logout title="Выйти"
                    class="p-2 rounded-xl text-zinc-500 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors">
              <?= icon('log-out', 'w-4 h-4') ?>
            </button>
          </div>
        <?php else: ?>
          <button type="button" data-open-auth
                  class="bg-black dark:bg-white text-white dark:text-black hover:bg-zinc-800 dark:hover:bg-zinc-200 font-extrabold text-[10px] sm:text-[11px] uppercase tracking-widest px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl shadow-md transition-all flex items-center space-x-1.5">
            <?= icon('sparkles', 'w-3.5 h-3.5 text-rose-500') ?>
            <span>Войти</span>
          </button>
        <?php endif; ?>
      </div>
    </div>
  </div>
</header>
