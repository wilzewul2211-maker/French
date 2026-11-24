<?php
/**
 * Мобильная нижняя навигация (фиксированная).
 * @var string $tab
 * @var int    $unread
 */
if (!isset($navItems)) {
    $navItems = [
        ['id' => 'feed',    'label' => 'Лента работ',   'icon' => 'grid'],
        ['id' => 'search',  'label' => 'Поиск мастеров', 'icon' => 'search'],
        ['id' => 'posts',   'label' => 'Посты',          'icon' => 'newspaper'],
        ['id' => 'chats',   'label' => 'Чаты',           'icon' => 'message-square'],
        ['id' => 'profile', 'label' => 'Профиль',        'icon' => 'user'],
    ];
}
?>
<div data-style-key="mobileNav" class="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-[#0A0A0C]/95 backdrop-blur-md border-t border-zinc-200 dark:border-zinc-800 py-1.5 px-2 flex justify-around items-center shadow-lg">
  <?php foreach ($navItems as $item):
      $active = $tab === $item['id'];
      $badge  = $item['id'] === 'chats';
      $short  = explode(' ', $item['label'])[0];
      ?>
    <a href="/?tab=<?= e($item['id']) ?>" data-tab-link-mobile="<?= e($item['id']) ?>"
       class="flex flex-col items-center py-1 px-2.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-colors <?= $active ? 'text-black dark:text-white font-black' : 'text-zinc-500' ?>">
      <div class="relative">
        <?= icon($item['icon'], 'w-4 h-4 mb-0.5 ' . ($active ? 'text-rose-600 dark:text-rose-500' : 'text-zinc-500')) ?>
        <?php if ($badge): ?>
          <span data-unread-badge class="<?= $unread > 0 ? '' : 'hidden' ?> absolute -top-1.5 -right-2 bg-rose-600 text-white text-[8px] font-black px-1.5 py-0.2 rounded-full shadow-xs"><?= (int)$unread ?></span>
        <?php endif; ?>
      </div>
      <span class="text-[9px]"><?= e($short) ?></span>
    </a>
  <?php endforeach; ?>
</div>
