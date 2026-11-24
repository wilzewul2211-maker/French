/**
 * Панель управления: мастера, оплата объявлений, служебные учётные записи,
 * поддержка и оформление сайта.
 *
 * Роли:
 *  - admin   — все разделы;
 *  - support — мастера, выдача бесплатных размещений (только 1 месяц), поддержка.
 *
 * Разрешённые поля настроек проверяются и нормализуются сервером; произвольный HTML не принимается.
 */
(function () {
  'use strict';
  var FR = window.FR;
  var root = null;
  var role = 'support';
  var isAdmin = false;
  var activeTab = '';
  var notice = '';

  /* Оформление сайта (общие настройки) */
  var settings = null;
  var baseline = null;
  var revision = 0;
  var historyRows = [];
  var settingsRequested = false;

  /* Живой редактор стилей элементов */
  var ELEMENT_STYLES = [
    { key: 'page',      label: 'Страница (общий фон)',   selector: '.fr-root' },
    { key: 'header',    label: 'Шапка сайта',            selector: 'header[data-style-key="header"]' },
    { key: 'mobileNav', label: 'Мобильная навигация',    selector: '[data-style-key="mobileNav"]' },
    { key: 'footer',    label: 'Подвал сайта',           selector: '[data-style-key="footer"]' },
    { key: 'feedHero',  label: 'Баннер в ленте',         selector: '[data-style-key="feedHero"]' },
    { key: 'feedCard',  label: 'Карточка работы',        selector: '[data-style-key="feedCard"]' }
  ];
  var activeElementKey = '';
  var liveStyleEl = null;

  /* Мастера */
  var masters = [];
  var mastersLoaded = false;
  var masterQuery = '';

  /* Служебные учётные записи */
  var techUsers = [];
  var techLoaded = false;
  var techForm = { login: '', password: '', name: '', role: 'support' };

  /* Поддержка */
  var tickets = [];
  var ticketsLoaded = false;
  var activeTicketId = null;
  var thread = null;
  var threadLoading = false;
  var replyText = '';

  var inputCls = 'w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3.5 py-3 text-sm text-black dark:text-white outline-none focus:border-rose-500';

  var NAV_TABS = [
    ['feed', 'Лента работ'],
    ['search', 'Поиск мастеров'],
    ['posts', 'Посты'],
    ['chats', 'Чаты'],
    ['profile', 'Профиль']
  ];

  var TABS = {
    masters: { label: 'Мастера', icon: 'users', roles: ['admin', 'support'] },
    listing: { label: 'Оплата объявлений', icon: 'credit-card', roles: ['admin'] },
    technical: { label: 'Тех. учётки', icon: 'user-plus', roles: ['admin'] },
    support: { label: 'Поддержка', icon: 'message-circle', roles: ['admin', 'support'] },
    design: { label: 'Оформление сайта', icon: 'settings', roles: ['admin'] }
  };
  var TAB_ORDER = ['masters', 'listing', 'technical', 'support', 'design'];

  function copy(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function allowedTabs() {
    return TAB_ORDER.filter(function (tab) {
      return TABS[tab].roles.indexOf(role) !== -1;
    });
  }

  function isDirty() {
    return !!settings && JSON.stringify(settings) !== JSON.stringify(baseline);
  }

  function roleLabel(r) {
    return { client: 'Клиент', master: 'Мастер', admin: 'Администратор', support: 'Поддержка' }[r] || (r || '—');
  }

  function pill(text, tone) {
    var map = {
      ok: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
      warn: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
      danger: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
      muted: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
    };
    return '<span class="inline-block rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ' + (map[tone] || map.muted) + '">' + FR.esc(text) + '</span>';
  }

  function card(title, subtitle, body) {
    return '<section class="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121215] p-5 sm:p-7">' +
      '<div class="mb-5"><h2 class="text-lg font-extrabold">' + title + '</h2>' +
      (subtitle ? '<p class="mt-1 text-xs text-zinc-500">' + subtitle + '</p>' : '') + '</div>' + body + '</section>';
  }

  function control(label, key, value, type) {
    if (type === 'textarea') {
      return '<label class="block space-y-2"><span class="text-xs font-bold text-zinc-700 dark:text-zinc-300">' + label + '</span>' +
        '<textarea data-field="' + key + '" rows="3" class="' + inputCls + ' resize-y">' + FR.esc(value) + '</textarea></label>';
    }
    return '<label class="block space-y-2"><span class="text-xs font-bold text-zinc-700 dark:text-zinc-300">' + label + '</span>' +
      '<input data-field="' + key + '" value="' + FR.esc(value) + '" class="' + inputCls + '" maxlength="120"></label>';
  }

  function numberField(label, key, value, min, max, hint) {
    return '<label class="block space-y-2"><span class="text-xs font-bold text-zinc-700 dark:text-zinc-300">' + label + '</span>' +
      '<input type="number" min="' + min + '" max="' + max + '" data-listing-field="' + key + '" value="' + FR.esc(value) + '" class="' + inputCls + '">' +
      (hint ? '<span class="text-[10px] text-zinc-400">' + hint + '</span>' : '') + '</label>';
  }

  /* =========================================================
     МАСТЕРА
     ========================================================= */

  function masterCard(m) {
    var blocked = !!m.isBlocked;
    var freeUntil = m.listingFreeUntil && new Date(m.listingFreeUntil).getTime() > Date.now() ? m.listingFreeUntil : null;
    var pills = blocked ? pill('Заблокирован', 'danger') : pill('Активен', 'ok');
    if (freeUntil) pills += ' ' + pill('Бесплатно до ' + FR.fmtDate(freeUntil), 'warn');

    var actions = '<button type="button" data-action="grant-free" data-user-id="' + FR.esc(m.id) + '" class="rounded-xl border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-[10px] font-extrabold uppercase tracking-wide hover:bg-zinc-100 dark:hover:bg-zinc-800">Бесплатные объявления</button>';
    if (isAdmin) {
      actions += '<button type="button" data-action="toggle-block" data-user-id="' + FR.esc(m.id) + '" data-blocked="' + (blocked ? '1' : '0') + '" class="rounded-xl px-3 py-2 text-[10px] font-extrabold uppercase tracking-wide text-white ' + (blocked ? 'bg-emerald-600' : 'bg-rose-600') + '">' + (blocked ? 'Разблокировать' : 'Заблокировать') + '</button>';
    }

    return '<article class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-4 border-b border-zinc-100 dark:border-zinc-800 last:border-0">' +
      '<div class="min-w-0">' +
        '<div class="flex flex-wrap items-center gap-2"><span class="text-sm font-extrabold">' + FR.esc(m.name || 'Без имени') + '</span>' + pills + '</div>' +
        '<p class="mt-1 text-xs text-zinc-500 truncate">' + FR.esc(m.email || '') + (m.city ? ' · ' + FR.esc(m.city) : '') + '</p>' +
        '<p class="mt-1 text-[10px] text-zinc-400">Регистрация: ' + FR.esc(FR.fmtDate(m.createdAt)) + '</p>' +
      '</div>' +
      '<div class="flex flex-wrap gap-2 shrink-0">' + actions + '</div>' +
    '</article>';
  }

  function mastersTab() {
    var body =
      '<div class="flex flex-col sm:flex-row gap-2 mb-4">' +
        '<input data-master-query value="' + FR.esc(masterQuery) + '" placeholder="Поиск по имени, email или логину" class="flex-1 ' + inputCls + '">' +
        '<button type="button" data-action="master-search" class="rounded-xl bg-black dark:bg-white dark:text-black px-5 py-3 text-xs font-extrabold text-white">Найти</button>' +
      '</div>' +
      '<div>' + (masters.length ? masters.map(masterCard).join('') : '<p class="py-6 text-center text-xs text-zinc-500">Мастера не найдены.</p>') + '</div>';
    return card('Мастера', 'Управляйте доступом мастеров и выдавайте бесплатные размещения объявлений.', body);
  }

  /* =========================================================
     ОПЛАТА ОБЪЯВЛЕНИЙ
     ========================================================= */

  function listingTab() {
    var s = settings;
    var body =
      '<label class="flex items-center justify-between rounded-xl bg-zinc-50 dark:bg-zinc-900 px-4 py-3.5 mb-5">' +
        '<span><span class="block text-sm font-bold">Оплата за объявления включена</span>' +
        '<span class="block text-[11px] text-zinc-500 mt-0.5">Если выключить, мастера смогут публиковать работы без оплаты.</span></span>' +
        '<input type="checkbox" data-listing-field="listingEnabled"' + (s.listingEnabled ? ' checked' : '') + ' class="h-4 w-4 accent-rose-600">' +
      '</label>' +
      '<div class="grid gap-4 sm:grid-cols-3">' +
        numberField('Цена одного объявления, ₽', 'listingPriceSingle', s.listingPriceSingle, 0, 1000000, 'Помесячная оплата за одно объявление в ленте.') +
        numberField('Цена пакета объявлений, ₽', 'listingPricePack', s.listingPricePack, 0, 1000000, 'Общая стоимость пакета.') +
        numberField('Объявлений в пакете', 'listingPackSize', s.listingPackSize, 1, 100, 'Сколько работ входит в пакет.') +
      '</div>' +
      '<p class="mt-5 rounded-xl bg-blue-50 dark:bg-blue-950/30 p-3 text-[11px] text-blue-900 dark:text-blue-200">Изменения цен и тумблера применяются после нажатия «Подтвердить изменения» вверху страницы.</p>';
    return card('Оплата объявлений', 'Настройте стоимость размещения работ и возможность отключить оплату.', body);
  }

  /* =========================================================
     СЛУЖЕБНЫЕ УЧЁТНЫЕ ЗАПИСИ
     ========================================================= */

  function technicalTab() {
    var selectRoles = [['support', 'Поддержка'], ['admin', 'Администратор']].map(function (r) {
      return '<option value="' + r[0] + '"' + (techForm.role === r[0] ? ' selected' : '') + '>' + r[1] + '</option>';
    }).join('');

    var form =
      '<div class="grid gap-4 sm:grid-cols-2">' +
        '<label class="block space-y-2"><span class="text-xs font-bold">Логин</span><input data-tech-field="login" value="' + FR.esc(techForm.login) + '" maxlength="60" class="' + inputCls + '"></label>' +
        '<label class="block space-y-2"><span class="text-xs font-bold">Пароль</span><input type="password" data-tech-field="password" value="' + FR.esc(techForm.password) + '" maxlength="80" class="' + inputCls + '"></label>' +
        '<label class="block space-y-2"><span class="text-xs font-bold">Имя</span><input data-tech-field="name" value="' + FR.esc(techForm.name) + '" maxlength="80" class="' + inputCls + '"></label>' +
        '<label class="block space-y-2"><span class="text-xs font-bold">Роль</span><select data-tech-field="role" class="' + inputCls + '">' + selectRoles + '</select></label>' +
      '</div>' +
      '<button type="button" data-action="create-tech" class="mt-5 rounded-xl bg-rose-600 px-5 py-3 text-xs font-extrabold text-white">Создать учётную запись</button>' +
      '<p class="mt-3 text-[11px] text-zinc-500">Такие учётки входят по логину и паролю без подтверждения email. Роль «Поддержка» видит мастеров, выдаёт бесплатные размещения только на 1 месяц и отвечает на обращения.</p>';

    var list = techUsers.length
      ? '<div class="mt-6">' + techUsers.map(function (u) {
          return '<div class="flex items-center justify-between gap-3 py-3 border-b border-zinc-100 dark:border-zinc-800 last:border-0">' +
            '<div class="min-w-0"><p class="text-sm font-bold truncate">' + FR.esc(u.name || '') + '</p>' +
            '<p class="text-[11px] text-zinc-500 truncate">Логин: ' + FR.esc(u.login || '—') + ' · ' + FR.esc(u.email || '') + '</p></div>' +
            pill(u.role === 'admin' ? 'Администратор' : 'Поддержка', u.role === 'admin' ? 'warn' : 'muted') +
          '</div>';
        }).join('') + '</div>'
      : '';

    return card('Технические учётные записи', 'Создавайте служебные аккаунты поддержки и администраторов.', form + list);
  }

  /* =========================================================
     ПОДДЕРЖКА
     ========================================================= */

  function ticketRow(t) {
    var active = t.id === activeTicketId;
    var unread = Number(t.unreadForSupport) || 0;
    return '<button type="button" data-action="open-ticket" data-ticket-id="' + FR.esc(t.id) + '" class="w-full text-left rounded-xl px-3 py-3 mb-1 transition-colors ' + (active ? 'bg-rose-50 dark:bg-rose-950/30' : 'hover:bg-zinc-50 dark:hover:bg-zinc-900') + '">' +
      '<div class="flex items-center justify-between gap-2">' +
        '<span class="text-sm font-bold truncate">' + FR.esc(t.subject || 'Обращение') + '</span>' +
        (unread > 0 ? '<span class="shrink-0 rounded-full bg-rose-600 px-2 py-0.5 text-[9px] font-black text-white">' + unread + '</span>' : '') +
      '</div>' +
      '<p class="mt-1 text-[11px] text-zinc-500 truncate">' + FR.esc(t.userName || '') + ' · ' + FR.esc(roleLabel(t.userRole)) + '</p>' +
      '<p class="mt-1 text-[11px] text-zinc-400 truncate">' + FR.esc(t.lastMessage || '') + '</p>' +
      '<p class="mt-1 text-[10px] text-zinc-400">' + FR.esc(FR.fmtDateTime(t.lastMessageTime || t.createdAt)) + '</p>' +
    '</button>';
  }

  function threadPanel() {
    if (!activeTicketId) {
      return '<div class="rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#121215] p-8 flex flex-col items-center justify-center text-center min-h-[320px]">' +
        FR.icon('message-circle', 'w-8 h-8 text-zinc-300') +
        '<p class="mt-3 text-xs text-zinc-500">Выберите обращение, чтобы прочитать и ответить.</p></div>';
    }
    if (threadLoading || !thread) {
      return '<div class="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121215] p-8 flex items-center justify-center min-h-[320px] text-xs text-zinc-500">Загружаем переписку...</div>';
    }
    var t = thread.ticket || {};
    var messages = (thread.messages || []).map(function (msg) {
      var staff = msg.senderRole === 'admin' || msg.senderRole === 'support';
      return '<div class="flex ' + (staff ? 'justify-end' : 'justify-start') + '">' +
        '<div class="max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ' + (staff ? 'bg-rose-600 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white') + '">' +
          '<p class="text-[10px] font-bold opacity-70 mb-1">' + FR.esc(msg.senderName || '') + ' · ' + FR.esc(roleLabel(msg.senderRole)) + '</p>' +
          '<p class="whitespace-pre-wrap break-words">' + FR.esc(msg.text) + '</p>' +
          '<p class="mt-1 text-[9px] opacity-60">' + FR.esc(FR.fmtDateTime(msg.createdAt)) + '</p>' +
        '</div></div>';
    }).join('');

    return '<div class="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121215] flex flex-col overflow-hidden">' +
      '<div class="p-4 border-b border-zinc-100 dark:border-zinc-800">' +
        '<p class="text-sm font-extrabold truncate">' + FR.esc(t.subject || 'Обращение') + '</p>' +
        '<p class="text-[11px] text-zinc-500">' + FR.esc(t.userName || '') + ' · ' + FR.esc(roleLabel(t.userRole)) + '</p>' +
      '</div>' +
      '<div data-thread-scroll class="flex-1 space-y-3 p-4 overflow-y-auto" style="max-height:420px">' + messages + '</div>' +
      '<div class="p-3 border-t border-zinc-100 dark:border-zinc-800 flex items-end gap-2">' +
        '<textarea data-reply rows="2" placeholder="Ответ клиенту или мастеру..." class="flex-1 resize-none rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-rose-500">' + FR.esc(replyText) + '</textarea>' +
        '<button type="button" data-action="send-reply" class="rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-extrabold text-white">' + FR.icon('send', 'w-4 h-4') + '</button>' +
      '</div>' +
    '</div>';
  }

  function supportTab() {
    var list = tickets.length
      ? tickets.map(ticketRow).join('')
      : '<p class="py-6 text-center text-xs text-zinc-500">Обращений пока нет.</p>';
    var left = '<div class="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121215] p-4 sm:p-5">' +
      '<h2 class="text-sm font-extrabold mb-3">Обратившиеся</h2>' + list + '</div>';
    return '<div class="grid gap-4 lg:grid-cols-2">' + left + threadPanel() + '</div>';
  }

  /* =========================================================
     ОФОРМЛЕНИЕ САЙТА
     ========================================================= */

  function renderBlocks() {
    if (!settings.customBlocks.length) {
      return '<div class="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-5 text-center text-xs text-zinc-500">Пока нет пользовательских блоков.</div>';
    }
    return settings.customBlocks.map(function (block, index) {
      return '<div class="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 space-y-3" data-block="' + index + '">' +
        '<div class="flex items-center justify-between gap-3"><span class="text-[10px] font-black uppercase tracking-widest text-rose-600">Блок ' + (index + 1) + '</span>' +
        '<button type="button" data-action="remove-block" data-index="' + index + '" class="text-xs font-bold text-rose-600 hover:text-rose-700">Удалить</button></div>' +
        '<label class="block space-y-1.5"><span class="text-xs font-bold">Заголовок</span><input data-block-field="title" data-index="' + index + '" value="' + FR.esc(block.title) + '" maxlength="80" class="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2.5 text-sm"></label>' +
        '<label class="block space-y-1.5"><span class="text-xs font-bold">Текст</span><textarea data-block-field="body" data-index="' + index + '" rows="3" maxlength="400" class="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2.5 text-sm">' + FR.esc(block.body) + '</textarea></label>' +
        '<label class="inline-flex items-center gap-2 text-xs font-semibold"><input type="checkbox" data-block-field="enabled" data-index="' + index + '"' + (block.enabled ? ' checked' : '') + '>Показывать в ленте</label>' +
      '</div>';
    }).join('');
  }

  function renderHistory() {
    if (!historyRows.length) {
      return '<p class="py-6 text-center text-xs text-zinc-500">История появится после первой публикации.</p>';
    }
    return historyRows.map(function (item) {
      var action = item.action === 'rollback' ? 'Откат' : 'Публикация';
      return '<article class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-4 border-b border-zinc-100 dark:border-zinc-800 last:border-0">' +
        '<div class="min-w-0"><div class="flex flex-wrap items-center gap-2"><span class="text-xs font-extrabold">Версия #' + item.revision + '</span>' +
        '<span class="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-zinc-500">' + action + '</span></div>' +
        '<p class="mt-1 text-xs text-zinc-600 dark:text-zinc-300">' + FR.esc(item.summary) + '</p>' +
        '<p class="mt-1 text-[10px] text-zinc-400">' + FR.esc(item.adminEmail) + ' · ' + FR.esc(FR.fmtDateTime(item.createdAt)) + '</p></div>' +
        '<button type="button" data-action="rollback" data-history-id="' + item.id + '" class="shrink-0 rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-[10px] font-extrabold uppercase tracking-wide hover:bg-zinc-100 dark:hover:bg-zinc-800">Откатить эту версию</button>' +
      '</article>';
    }).join('');
  }

  /* --------------------------------- Живой редактор стилей -------------------------------- */

  function elementMeta(key) {
    for (var i = 0; i < ELEMENT_STYLES.length; i++) {
      if (ELEMENT_STYLES[i].key === key) return ELEMENT_STYLES[i];
    }
    return null;
  }

  function ensureElStyle(key) {
    if (!key) return {};
    if (!settings.elementStyles || !(settings.elementStyles instanceof Object) || Array.isArray(settings.elementStyles)) {
      settings.elementStyles = {};
    }
    if (!settings.elementStyles[key]) settings.elementStyles[key] = {};
    return settings.elementStyles[key];
  }

  function styleDecls(style) {
    var decl = [];
    if (!style) return decl;
    if (style.bgColor) decl.push('background-color:' + style.bgColor);
    if (style.bgImage) {
      decl.push('background-image:url("' + String(style.bgImage).replace(/"/g, '%22') + '")');
      decl.push('background-size:' + (style.bgSize || 'cover'));
      decl.push('background-position:center');
      decl.push('background-repeat:no-repeat');
    }
    if (style.textColor) decl.push('color:' + style.textColor);
    if (typeof style.radius === 'number') decl.push('border-radius:' + style.radius + 'px');
    if (typeof style.padding === 'number') decl.push('padding:' + style.padding + 'px');
    return decl;
  }

  function applyLiveStyles() {
    var css = '';
    ELEMENT_STYLES.forEach(function (item) {
      var style = settings.elementStyles && settings.elementStyles[item.key];
      var decl = styleDecls(style);
      if (decl.length) css += item.selector + '{' + decl.join(';') + '}';
    });
    if (!liveStyleEl) {
      liveStyleEl = document.createElement('style');
      liveStyleEl.id = 'fr-element-styles-live';
      document.head.appendChild(liveStyleEl);
    }
    liveStyleEl.textContent = css;
  }

  function clearLiveStyles() {
    if (liveStyleEl) liveStyleEl.textContent = '';
  }

  function highlightElement(selector, on) {
    var el = document.querySelector(selector);
    if (!el) return;
    if (on) {
      el.style.outline = '2px dashed #E11D48';
      el.style.outlineOffset = '2px';
    } else {
      el.style.outline = '';
      el.style.outlineOffset = '';
    }
  }

  function refreshElPreview() {
    var box = root && root.querySelector('[data-el-preview]');
    if (!box) return;
    var style = settings.elementStyles && settings.elementStyles[activeElementKey];
    var decl = styleDecls(style);
    box.setAttribute('style', decl.join(';') + (decl.length ? ';' : '') + 'min-height:96px;display:flex;align-items:center;justify-content:center');
    box.textContent = decl.length ? '' : 'Без пользовательских стилей';
    box.className = 'rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 text-[11px] text-zinc-400';
  }

  function elementPropertyPanel() {
    var meta = elementMeta(activeElementKey);
    if (!meta) {
      return '<div class="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-8 text-center text-xs text-zinc-500">Наведите на элемент списка — он подсветится на сайте. Нажмите, чтобы выбрать и настроить.</div>';
    }
    var s = settings.elementStyles[activeElementKey] || {};
    var bgSizeOptions = ['cover', 'contain', 'auto'].map(function (v) {
      return '<option value="' + v + '"' + ((s.bgSize || 'cover') === v ? ' selected' : '') + '>' + v + '</option>';
    }).join('');
    var hasImg = !!s.bgImage;

    return '<div class="space-y-4">' +
      '<div class="flex items-center justify-between gap-2">' +
        '<span class="text-xs font-black uppercase tracking-wide text-rose-600">' + FR.esc(meta.label) + '</span>' +
        '<button type="button" data-el-reset="' + activeElementKey + '" class="text-[11px] font-bold text-rose-600 hover:text-rose-700">Сбросить стиль</button>' +
      '</div>' +
      '<div data-el-preview class="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 text-[11px] text-zinc-400"></div>' +
      '<div class="space-y-2">' +
        '<span class="text-xs font-bold text-zinc-700 dark:text-zinc-300">Фото / текстура как фон</span>' +
        '<div class="flex items-center gap-2">' +
          '<label class="flex-1 cursor-pointer rounded-xl border border-zinc-200 dark:border-zinc-700 px-3 py-2.5 text-center text-[11px] font-bold hover:bg-zinc-100 dark:hover:bg-zinc-800">' +
            '<input type="file" accept="image/*" data-el-upload class="hidden">Загрузить изображение</label>' +
          (hasImg ? '<button type="button" data-el-clear-image class="rounded-xl border border-zinc-200 dark:border-zinc-700 px-3 py-2.5 text-[11px] font-bold text-rose-600">Убрать</button>' : '') +
        '</div>' +
        (hasImg ? '<label class="block space-y-1.5"><span class="text-[11px] font-bold">Масштабирование фона</span><select data-el-bg-size class="' + inputCls + '">' + bgSizeOptions + '</select></label>' : '') +
      '</div>' +
      '<div class="grid gap-3 sm:grid-cols-2">' +
        '<label class="flex items-center justify-between rounded-xl bg-zinc-50 dark:bg-zinc-900 px-3 py-2.5"><span class="text-[11px] font-bold">Цвет фона</span>' +
          '<span class="flex items-center gap-1.5"><input type="color" data-el-bg-color value="' + FR.esc(s.bgColor || '#FFFFFF') + '" class="h-8 w-10 cursor-pointer rounded border-0 bg-transparent">' +
          '<button type="button" data-el-clear-bg class="text-zinc-400 hover:text-rose-600">' + FR.icon('x', 'w-4 h-4') + '</button></span></label>' +
        '<label class="flex items-center justify-between rounded-xl bg-zinc-50 dark:bg-zinc-900 px-3 py-2.5"><span class="text-[11px] font-bold">Цвет текста</span>' +
          '<span class="flex items-center gap-1.5"><input type="color" data-el-text-color value="' + FR.esc(s.textColor || '#111111') + '" class="h-8 w-10 cursor-pointer rounded border-0 bg-transparent">' +
          '<button type="button" data-el-clear-text class="text-zinc-400 hover:text-rose-600">' + FR.icon('x', 'w-4 h-4') + '</button></span></label>' +
      '</div>' +
      '<div class="grid gap-3 sm:grid-cols-2">' +
        '<label class="block space-y-1.5"><span class="text-[11px] font-bold">Скругление: <span data-el-radius-label>' + (typeof s.radius === 'number' ? s.radius : 0) + '</span> px</span>' +
          '<input type="range" min="0" max="64" step="1" data-el-radius value="' + (typeof s.radius === 'number' ? s.radius : 0) + '" class="w-full accent-rose-600"></label>' +
        '<label class="block space-y-1.5"><span class="text-[11px] font-bold">Внутренний отступ: <span data-el-padding-label>' + (typeof s.padding === 'number' ? s.padding : 0) + '</span> px</span>' +
          '<input type="range" min="0" max="80" step="1" data-el-padding value="' + (typeof s.padding === 'number' ? s.padding : 0) + '" class="w-full accent-rose-600"></label>' +
      '</div>' +
      '<p class="rounded-xl bg-blue-50 dark:bg-blue-950/30 p-3 text-[11px] text-blue-900 dark:text-blue-200">Предпросмотр применяется сразу. Чтобы изменения увидели посетители — нажмите «Подтвердить изменения» вверху страницы.</p>' +
    '</div>';
  }

  function elementEditorCard() {
    var list = ELEMENT_STYLES.map(function (item) {
      var on = item.key === activeElementKey;
      var has = !!(settings.elementStyles && settings.elementStyles[item.key]);
      return '<button type="button" data-el-pick="' + item.key + '" data-el-selector="' + FR.esc(item.selector) + '" class="w-full text-left rounded-xl px-3 py-2.5 text-xs font-bold transition-colors flex items-center justify-between gap-2 ' +
        (on ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300' : 'bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800') + '">' +
        '<span>' + FR.esc(item.label) + '</span>' +
        (has ? '<span class="h-2 w-2 shrink-0 rounded-full bg-rose-600"></span>' : '') +
      '</button>';
    }).join('');
    var body = '<div class="grid gap-4 lg:grid-cols-[240px_1fr]">' +
      '<div class="space-y-2">' + list + '</div>' +
      '<div>' + elementPropertyPanel() + '</div>' +
    '</div>';
    return card('Живой редактор стилей', 'Наведите на элемент — он подсветится на сайте. Выберите элемент и настройте фон (фото/цвет), цвет текста, скругление и отступы.', body);
  }

  function designTab() {
    var s = settings;
    return '<div class="space-y-6">' +
      elementEditorCard() +
      card('Брендинг и внешний вид', 'Изменения бренда отображаются в шапке, цвет применяется к основным акцентам сайта.',
        '<div class="grid gap-4 sm:grid-cols-2">' +
          control('Название бренда', 'brandName', s.brandName) +
          control('Подпись рядом с брендом', 'brandBadge', s.brandBadge) +
          control('Короткое описание в шапке', 'tagline', s.tagline) +
          control('Текст под заголовком входа', 'loginSubtitle', s.loginSubtitle) +
          '<label class="block space-y-2"><span class="text-xs font-bold text-zinc-700 dark:text-zinc-300">Акцентный цвет</span><span class="flex items-center gap-3 rounded-xl border border-zinc-200 dark:border-zinc-700 p-2.5"><input type="color" data-field="accentColor" value="' + FR.esc(s.accentColor) + '" class="h-9 w-12 cursor-pointer rounded border-0 bg-transparent"><span class="font-mono text-sm">' + FR.esc(s.accentColor) + '</span></span></label>' +
        '</div>') +
      card('Разделы навигации', 'Скрытый раздел не удаляется: его можно снова включить здесь.',
        '<div class="grid gap-2 sm:grid-cols-2">' + NAV_TABS.map(function (tab) {
          return '<label class="flex items-center justify-between rounded-xl bg-zinc-50 dark:bg-zinc-900 px-4 py-3 text-sm font-semibold"><span>' + tab[1] + '</span><input type="checkbox" data-visible-tab="' + tab[0] + '"' + (s.visibleTabs[tab[0]] ? ' checked' : '') + ' class="h-4 w-4 accent-rose-600"></label>';
        }).join('') + '</div>') +
      card('Информационные блоки', 'Добавляйте, редактируйте или удаляйте карточки в ленте. До 8 блоков.',
        '<div class="mb-4"><button type="button" data-action="add-block" class="rounded-xl bg-black px-4 py-2.5 text-xs font-extrabold text-white dark:bg-white dark:text-black">Добавить блок</button></div><div class="space-y-3">' + renderBlocks() + '</div>') +
      card('История изменений', 'Откат создаёт новую версию; предыдущая запись остаётся в журнале.', '<div>' + renderHistory() + '</div>') +
    '</div>';
  }

  /* =========================================================
     ОБЩИЙ РЕНДЕР
     ========================================================= */

  function hero() {
    var dirty = isDirty();
    var toolbar = '';
    if (isAdmin) {
      toolbar = '<div class="mt-5 flex flex-wrap items-center gap-3">' +
        '<span class="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-bold">Версия #' + revision + '</span>' +
        '<span data-dirty-state class="text-xs ' + (dirty ? 'font-extrabold text-amber-300' : 'font-semibold text-emerald-300') + '">' + (dirty ? 'Есть неопубликованные изменения' : 'Все изменения опубликованы') + '</span>' +
        '<div class="flex flex-wrap gap-2 sm:ml-auto">' +
          '<button type="button" data-action="discard" ' + (!dirty ? 'disabled' : '') + ' class="rounded-xl border border-white/20 px-4 py-2.5 text-[11px] font-bold text-white disabled:opacity-40">Вернуть изменения</button>' +
          '<button type="button" data-action="publish" ' + (!dirty ? 'disabled' : '') + ' class="rounded-xl bg-rose-600 px-5 py-2.5 text-[11px] font-extrabold text-white disabled:opacity-40">Подтвердить изменения</button>' +
        '</div></div>';
    }
    return '<section class="relative overflow-hidden rounded-3xl bg-zinc-950 p-6 text-white sm:p-8">' +
      '<div class="absolute -right-10 -top-16 h-56 w-56 rounded-full bg-rose-600/20 blur-3xl"></div>' +
      '<div class="relative">' +
        '<p class="text-[10px] font-black uppercase tracking-[.25em] text-rose-400">Управление сайтом</p>' +
        '<h1 class="mt-2 text-2xl font-black sm:text-3xl">' + (isAdmin ? 'Панель администратора' : 'Панель поддержки') + '</h1>' +
        '<p class="mt-2 max-w-2xl text-sm text-zinc-300">' + (isAdmin
          ? 'Управляйте мастерами, оплатой объявлений, служебными учётками, поддержкой и оформлением сайта.'
          : 'Просматривайте мастеров, выдавайте бесплатные размещения и отвечайте на обращения клиентов и мастеров.') + '</p>' +
        toolbar +
      '</div></section>';
  }

  function tabNav() {
    var unread = tickets.reduce(function (acc, t) { return acc + (Number(t.unreadForSupport) || 0); }, 0);
    return '<div class="flex flex-wrap gap-2">' + allowedTabs().map(function (tab) {
      var on = tab === activeTab;
      var badge = (tab === 'support' && unread > 0)
        ? '<span class="rounded-full bg-rose-600 px-1.5 py-0.5 text-[9px] font-black text-white">' + unread + '</span>'
        : '';
      return '<button type="button" data-action="switch-tab" data-tab="' + tab + '" class="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-extrabold transition-colors ' + (on ? 'bg-zinc-950 text-white dark:bg-white dark:text-black' : 'border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900') + '">' +
        FR.icon(TABS[tab].icon, 'w-4 h-4') + '<span>' + TABS[tab].label + '</span>' + badge + '</button>';
    }).join('') + '</div>';
  }

  function loadingCard() {
    return '<div class="py-20 text-center text-sm text-zinc-500">Загружаем данные...</div>';
  }

  function tabBody() {
    if (activeTab === 'masters') return mastersTab();
    if (activeTab === 'listing') return settings ? listingTab() : loadingCard();
    if (activeTab === 'technical') return technicalTab();
    if (activeTab === 'support') return supportTab();
    if (activeTab === 'design') return settings ? designTab() : loadingCard();
    return '';
  }

  function render() {
    if (!root) return;
    var user = FR.state.user;
    if (!user || (user.role !== 'admin' && user.role !== 'support')) {
      root.innerHTML = '<div class="mx-auto my-16 max-w-lg rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-sm font-bold text-rose-700">Доступ к панели разрешён только администратору и поддержке.</div>';
      return;
    }
    role = user.role;
    isAdmin = role === 'admin';

    var tabs = allowedTabs();
    if (tabs.indexOf(activeTab) === -1) activeTab = tabs[0];

    root.innerHTML = '<div class="mx-auto max-w-6xl space-y-6 pb-16">' +
      hero() +
      (notice ? '<div role="status" class="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">' + FR.esc(notice) + '</div>' : '') +
      tabNav() +
      '<div data-tab-body>' + tabBody() + '</div>' +
    '</div>';

    ensureLoads();
    bind();
    if (activeTab === 'design' && settings) {
      applyLiveStyles();
      refreshElPreview();
    } else {
      clearLiveStyles();
    }
  }

  function markDirty() {
    var status = root && root.querySelector('[data-dirty-state]');
    if (status) {
      status.textContent = isDirty() ? 'Есть неопубликованные изменения' : 'Все изменения опубликованы';
      status.className = 'text-xs ' + (isDirty() ? 'font-extrabold text-amber-300' : 'font-semibold text-emerald-300');
    }
    var discard = root && root.querySelector('[data-action="discard"]');
    var publishBtn = root && root.querySelector('[data-action="publish"]');
    if (discard) discard.disabled = !isDirty();
    if (publishBtn) publishBtn.disabled = !isDirty();
  }

  function scrollThread() {
    var box = root && root.querySelector('[data-thread-scroll]');
    if (box) box.scrollTop = box.scrollHeight;
  }

  /* =========================================================
     ЗАГРУЗКА ДАННЫХ
     ========================================================= */

  function ensureLoads() {
    if (!mastersLoaded) loadMasters();
    if (!ticketsLoaded) loadTickets();
    if (isAdmin && !settingsRequested) loadSettings();
    if (isAdmin && !techLoaded) loadTech();
  }

  function loadSettings() {
    settingsRequested = true;
    refreshSettings();
  }

  function refreshSettings() {
    FR.api.http.get('/api/admin/settings').then(function (res) {
      settings = res.settings;
      baseline = copy(settings);
      revision = res.revision;
      historyRows = res.history || [];
      render();
    }).catch(function (err) {
      notice = err.message || 'Не удалось загрузить настройки администратора';
      render();
    });
  }

  function loadMasters() {
    mastersLoaded = true;
    FR.api.getAdminMasters(masterQuery).then(function (res) {
      masters = res.masters || [];
      render();
    }).catch(function (err) {
      masters = [];
      notice = err.message || 'Не удалось загрузить мастеров';
      render();
    });
  }

  function reloadMasters() {
    mastersLoaded = false;
    loadMasters();
  }

  function loadTech() {
    techLoaded = true;
    Promise.all([
      FR.api.getAdminUsers('support'),
      FR.api.getAdminUsers('admin')
    ]).then(function (res) {
      techUsers = (res[0].users || []).concat(res[1].users || []);
      render();
    }).catch(function () {
      techUsers = [];
      render();
    });
  }

  function reloadTech() {
    techLoaded = false;
    loadTech();
  }

  function loadTickets() {
    ticketsLoaded = true;
    FR.api.getSupportTickets('all').then(function (res) {
      tickets = res.tickets || [];
      render();
    }).catch(function (err) {
      tickets = [];
      notice = err.message || 'Не удалось загрузить обращения';
      render();
    });
  }

  function loadThread(id) {
    thread = null;
    threadLoading = true;
    render();
    FR.api.getSupportThread(id).then(function (res) {
      if (activeTicketId !== id) return;
      thread = res;
      threadLoading = false;
      render();
      scrollThread();
    }).catch(function (err) {
      if (activeTicketId !== id) return;
      threadLoading = false;
      thread = null;
      notice = err.message || 'Не удалось загрузить переписку';
      render();
    });
  }

  /* =========================================================
     ДЕЙСТВИЯ
     ========================================================= */

  function publish() {
    if (!isDirty()) return;
    FR.confirm({
      title: 'Подтвердить изменения?',
      message: 'Новая версия настроек (оформление и оплата объявлений) будет опубликована для всех посетителей и сохранена в истории.',
      confirmText: 'Опубликовать',
      cancelText: 'Продолжить редактирование',
      type: 'info',
      iconType: 'info'
    }).then(function (ok) {
      if (!ok) return;
      FR.api.http.post('/api/admin/settings/publish', {
        settings: settings,
        expectedRevision: revision,
        summary: 'Опубликованы настройки сайта'
      }).then(function (res) {
        notice = 'Изменения опубликованы. Обновите страницу сайта, чтобы увидеть результат.';
        if (res && res.revision) revision = res.revision;
        baseline = copy(settings);
        refreshSettings();
      }).catch(function (err) {
        notice = err.message || 'Не удалось опубликовать настройки';
        render();
      });
    });
  }

  function rollback(historyId) {
    FR.confirm({
      title: 'Откатить настройки?',
      message: 'Выбранная версия станет новой опубликованной версией. Текущая останется в истории.',
      confirmText: 'Откатить',
      cancelText: 'Отмена',
      type: 'warning',
      iconType: 'warning'
    }).then(function (ok) {
      if (!ok) return;
      FR.api.http.post('/api/admin/settings/rollback', {
        historyId: Number(historyId),
        expectedRevision: revision
      }).then(function () {
        notice = 'Настройки восстановлены. Откат записан как новая версия.';
        refreshSettings();
      }).catch(function (err) {
        notice = err.message || 'Не удалось выполнить откат';
        render();
      });
    });
  }

  function toggleBlock(userId, currentlyBlocked) {
    var blocked = !currentlyBlocked;
    FR.confirm({
      title: blocked ? 'Заблокировать мастера?' : 'Разблокировать мастера?',
      message: blocked ? 'Мастер не сможет входить в сервис и публиковать работы.' : 'Мастер снова получит доступ к сервису.',
      confirmText: blocked ? 'Заблокировать' : 'Разблокировать',
      type: blocked ? 'danger' : 'info',
      iconType: blocked ? 'warning' : 'info'
    }).then(function (ok) {
      if (!ok) return;
      FR.api.setUserBlocked(userId, blocked).then(function () {
        FR.toast(blocked ? 'Мастер заблокирован' : 'Мастер разблокирован');
        reloadMasters();
      }).catch(function (err) {
        FR.toast((err && err.message) || 'Не удалось изменить доступ');
      });
    });
  }

  function grantFree(userId) {
    if (!isAdmin) {
      FR.confirm({
        title: 'Выдать бесплатные объявления?',
        message: 'Служебным учётным записям доступна выдача только на 1 месяц.',
        confirmText: 'Выдать на 1 месяц',
        cancelText: 'Отмена',
        type: 'info',
        iconType: 'info'
      }).then(function (ok) {
        if (ok) doGrant(userId, 1);
      });
      return;
    }
    openGrantModal(userId);
  }

  function doGrant(userId, months) {
    FR.api.grantFreeListing(userId, months).then(function () {
      FR.toast('Бесплатные объявления выданы');
      reloadMasters();
    }).catch(function (err) {
      FR.toast((err && err.message) || 'Не удалось выдать бесплатные объявления');
    });
  }

  function openGrantModal(userId) {
    var id = 'grant-' + Math.random().toString(36).slice(2, 8);
    var options = '';
    for (var i = 1; i <= 12; i++) options += '<option value="' + i + '">' + i + ' мес.</option>';
    var html = '<div class="relative w-full max-w-sm bg-[#F8F6F1] dark:bg-[#1A1A1A] rounded-2xl p-6 border border-[#CFC9C0] dark:border-[#333333] shadow-2xl space-y-4">' +
      '<button data-cancel class="absolute top-4 right-4 p-1.5 text-[#554F47] dark:text-[#A0988E] hover:text-[#111111] dark:hover:text-white rounded-lg">' + FR.icon('x', 'w-5 h-5') + '</button>' +
      '<h3 class="font-bold text-lg text-[#111111] dark:text-white pr-8">Бесплатные объявления</h3>' +
      '<p class="text-xs text-[#4A443C] dark:text-[#CCCCCC]">На сколько месяцев выдать мастеру бесплатное размещение работ?</p>' +
      '<select data-grant-months class="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3.5 py-3 text-sm outline-none focus:border-rose-500">' + options + '</select>' +
      '<div class="flex justify-end gap-2"><button data-cancel class="px-4 py-2.5 rounded-xl bg-[#EBE6DC] dark:bg-[#282624] text-xs font-bold">Отмена</button>' +
      '<button data-grant-submit class="px-5 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-extrabold">Выдать</button></div></div>';
    var el = FR.openOverlay(id, html);
    if (!el) return;
    el.querySelectorAll('[data-cancel]').forEach(function (b) {
      b.addEventListener('click', function () { FR.closeOverlay(id); });
    });
    el.querySelector('[data-grant-submit]').addEventListener('click', function () {
      var months = Number(el.querySelector('[data-grant-months]').value) || 1;
      FR.closeOverlay(id);
      doGrant(userId, months);
    });
  }

  function createTech() {
    var login = (techForm.login || '').trim();
    var password = techForm.password || '';
    if (!login || password.length < 4) {
      FR.toast('Укажите логин и пароль (минимум 4 символа)');
      return;
    }
    FR.api.createTechnicalUser({
      login: login,
      password: password,
      name: (techForm.name || '').trim(),
      role: techForm.role || 'support'
    }).then(function () {
      FR.toast('Учётная запись создана');
      techForm = { login: '', password: '', name: '', role: 'support' };
      reloadTech();
    }).catch(function (err) {
      FR.toast((err && err.message) || 'Не удалось создать учётную запись');
    });
  }

  function openTicket(id) {
    activeTicketId = id;
    replyText = '';
    tickets.forEach(function (t) { if (t.id === id) t.unreadForSupport = 0; });
    FR.api.markSupportRead(id).catch(function () {});
    loadThread(id);
  }

  function sendReply() {
    var text = (replyText || '').trim();
    if (!text || !activeTicketId) return;
    var id = activeTicketId;
    replyText = '';
    FR.api.sendSupportMessage(id, text).then(function () {
      loadThread(id);
      ticketsLoaded = false;
      loadTickets();
    }).catch(function (err) {
      FR.toast((err && err.message) || 'Не удалось отправить ответ');
      replyText = text;
      render();
    });
  }

  /* =========================================================
     ОБРАБОТЧИКИ
     ========================================================= */

  function bind() {
    root.querySelectorAll('[data-field]').forEach(function (el) {
      el.addEventListener('input', function () {
        var key = el.getAttribute('data-field');
        settings[key] = el.value;
        if (key === 'accentColor') {
          var label = el.closest('label').querySelector('span span');
          if (label) label.textContent = el.value.toUpperCase();
          settings.accentColor = el.value.toUpperCase();
        }
        markDirty();
      });
    });

    root.querySelectorAll('[data-visible-tab]').forEach(function (el) {
      el.addEventListener('change', function () {
        settings.visibleTabs[el.getAttribute('data-visible-tab')] = el.checked;
        markDirty();
      });
    });

    root.querySelectorAll('[data-block-field]').forEach(function (el) {
      var index = Number(el.getAttribute('data-index'));
      var key = el.getAttribute('data-block-field');
      el.addEventListener(key === 'enabled' ? 'change' : 'input', function () {
        settings.customBlocks[index][key] = key === 'enabled' ? el.checked : el.value;
        markDirty();
      });
    });

    root.querySelectorAll('[data-listing-field]').forEach(function (el) {
      var key = el.getAttribute('data-listing-field');
      var isCheckbox = el.type === 'checkbox';
      el.addEventListener(isCheckbox ? 'change' : 'input', function () {
        settings[key] = isCheckbox ? el.checked : Number(el.value);
        markDirty();
      });
    });

    root.querySelectorAll('[data-el-pick]').forEach(function (el) {
      var selector = el.getAttribute('data-el-selector');
      el.addEventListener('mouseenter', function () { highlightElement(selector, true); });
      el.addEventListener('mouseleave', function () { highlightElement(selector, false); });
      el.addEventListener('click', function () {
        highlightElement(selector, false);
        activeElementKey = el.getAttribute('data-el-pick');
        render();
      });
    });

    var elBgColor = root.querySelector('[data-el-bg-color]');
    if (elBgColor) elBgColor.addEventListener('input', function () {
      ensureElStyle(activeElementKey).bgColor = elBgColor.value.toUpperCase();
      applyLiveStyles(); refreshElPreview(); markDirty();
    });

    var elTextColor = root.querySelector('[data-el-text-color]');
    if (elTextColor) elTextColor.addEventListener('input', function () {
      ensureElStyle(activeElementKey).textColor = elTextColor.value.toUpperCase();
      applyLiveStyles(); refreshElPreview(); markDirty();
    });

    var elBgSize = root.querySelector('[data-el-bg-size]');
    if (elBgSize) elBgSize.addEventListener('change', function () {
      ensureElStyle(activeElementKey).bgSize = elBgSize.value;
      applyLiveStyles(); refreshElPreview(); markDirty();
    });

    var elRadius = root.querySelector('[data-el-radius]');
    if (elRadius) elRadius.addEventListener('input', function () {
      var val = Number(elRadius.value) || 0;
      ensureElStyle(activeElementKey).radius = val;
      var label = root.querySelector('[data-el-radius-label]');
      if (label) label.textContent = val;
      applyLiveStyles(); refreshElPreview(); markDirty();
    });

    var elPadding = root.querySelector('[data-el-padding]');
    if (elPadding) elPadding.addEventListener('input', function () {
      var val = Number(elPadding.value) || 0;
      ensureElStyle(activeElementKey).padding = val;
      var label = root.querySelector('[data-el-padding-label]');
      if (label) label.textContent = val;
      applyLiveStyles(); refreshElPreview(); markDirty();
    });

    var elUpload = root.querySelector('[data-el-upload]');
    if (elUpload) elUpload.addEventListener('change', function () {
      var file = elUpload.files && elUpload.files[0];
      if (!file) return;
      FR.compressImage(file, { maxWidth: 1600, maxHeight: 1600, quality: 0.8 }).then(function (dataUrl) {
        var style = ensureElStyle(activeElementKey);
        style.bgImage = dataUrl;
        if (!style.bgSize) style.bgSize = 'cover';
        markDirty();
        render();
      }).catch(function (err) {
        FR.toast((err && err.message) || 'Не удалось загрузить изображение');
      });
    });

    var elClearImage = root.querySelector('[data-el-clear-image]');
    if (elClearImage) elClearImage.addEventListener('click', function () {
      if (settings.elementStyles[activeElementKey]) delete settings.elementStyles[activeElementKey].bgImage;
      markDirty();
      render();
    });

    var elClearBg = root.querySelector('[data-el-clear-bg]');
    if (elClearBg) elClearBg.addEventListener('click', function () {
      if (settings.elementStyles[activeElementKey]) delete settings.elementStyles[activeElementKey].bgColor;
      markDirty();
      render();
    });

    var elClearText = root.querySelector('[data-el-clear-text]');
    if (elClearText) elClearText.addEventListener('click', function () {
      if (settings.elementStyles[activeElementKey]) delete settings.elementStyles[activeElementKey].textColor;
      markDirty();
      render();
    });

    var elReset = root.querySelector('[data-el-reset]');
    if (elReset) elReset.addEventListener('click', function () {
      var key = elReset.getAttribute('data-el-reset');
      if (settings.elementStyles && settings.elementStyles[key]) delete settings.elementStyles[key];
      markDirty();
      render();
    });

    root.querySelectorAll('[data-tech-field]').forEach(function (el) {
      var key = el.getAttribute('data-tech-field');
      el.addEventListener('input', function () { techForm[key] = el.value; });
      if (el.tagName === 'SELECT') {
        el.addEventListener('change', function () { techForm[key] = el.value; });
      }
    });

    var reply = root.querySelector('[data-reply]');
    if (reply) reply.addEventListener('input', function () { replyText = reply.value; });

    var search = root.querySelector('[data-master-query]');
    if (search) {
      search.addEventListener('input', function () { masterQuery = search.value; });
      search.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); reloadMasters(); }
      });
    }

    if (!root._adminClickBound) {
      root.addEventListener('click', onClick);
      root._adminClickBound = true;
    }
  }

  function onClick(event) {
    var button = event.target.closest('[data-action]');
    if (!button || !root.contains(button)) return;
    var action = button.getAttribute('data-action');

    switch (action) {
      case 'switch-tab':
        activeTab = button.getAttribute('data-tab');
        notice = '';
        render();
        break;
      case 'master-search':
        reloadMasters();
        break;
      case 'toggle-block':
        toggleBlock(button.getAttribute('data-user-id'), button.getAttribute('data-blocked') === '1');
        break;
      case 'grant-free':
        grantFree(button.getAttribute('data-user-id'));
        break;
      case 'create-tech':
        createTech();
        break;
      case 'open-ticket':
        openTicket(button.getAttribute('data-ticket-id'));
        break;
      case 'send-reply':
        sendReply();
        break;
      case 'add-block':
        if (settings && settings.customBlocks.length < 8) {
          settings.customBlocks.push({ id: 'block_' + Date.now().toString(36), title: 'Новый блок', body: 'Добавьте текст для посетителей сайта.', enabled: true });
          render();
        }
        break;
      case 'remove-block':
        if (settings) {
          settings.customBlocks.splice(Number(button.getAttribute('data-index')), 1);
          render();
        }
        break;
      case 'discard':
        if (settings) {
          settings = copy(baseline);
          notice = 'Черновые изменения отменены.';
          render();
        }
        break;
      case 'publish':
        publish();
        break;
      case 'rollback':
        rollback(button.getAttribute('data-history-id'));
        break;
    }
  }

  FR.registerSection('admin', {
    render: function (element) {
      root = element;
      render();
    }
  });
})();
