/**
 * Запуск приложения: тема, навигация, модалка авторизации, выход,
 * роутинг разделов, realtime-опрос и страницы результата оплаты.
 */
(function () {
  'use strict';
  var FR = window.FR;

  /* ----------------------------- Тема ----------------------------- */
  FR.initTheme();

  /* --------------------------- Навигация -------------------------- */
  document.querySelectorAll('[data-tab-link], [data-tab-link-mobile], [data-nav-logo]').forEach(function (link) {
    link.addEventListener('click', function (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || (e.button !== undefined && e.button !== 0)) return;
      e.preventDefault();
      var tab = link.getAttribute('data-tab-link') || link.getAttribute('data-tab-link-mobile') || 'feed';
      FR.go(tab);
      window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
    });
  });

  var themeBtn = document.querySelector('[data-theme-toggle]');
  if (themeBtn) themeBtn.addEventListener('click', FR.toggleTheme);

  /* ---------------------------- Выход ----------------------------- */
  var logoutBtn = document.querySelector('[data-logout]');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function () {
      FR.confirm({
        title: 'Выход из аккаунта',
        message: 'Вы действительно хотите выйти из своей учетной записи?',
        confirmText: 'Выйти',
        cancelText: 'Отмена',
        type: 'warning',
        iconType: 'logout'
      }).then(function (ok) {
        if (!ok) return;
        FR.api.logout().then(function () { window.location.href = '/?tab=feed'; });
      });
    });
  }

  /* ------------------------- Авторизация -------------------------- */
  document.querySelectorAll('[data-open-auth]').forEach(function (btn) {
    btn.addEventListener('click', function () { FR.openAuth(); });
  });

  FR.openAuth = function () {
    FR.openAuthModal({
      onSuccess: function (user) {
        FR.state.user = user;
        FR.toast('С возвращением, ' + user.name + '!');
        window.location.href = '/?tab=profile';
      }
    });
  };

  /* --------------------------- Возврат ---------------------------- */
  window.addEventListener('popstate', function () {
    var params = new URLSearchParams(window.location.search);
    var tab = params.get('tab');
    if (tab && FR.sections[tab]) {
      FR.mount(tab);
    }
  });

  /* ---------------- Страницы результата оплаты -------------------- */
  FR.renderBookingPage = function (kind) {
    var root = document.getElementById('app-main');
    if (!root) return;

    if (kind === 'failed') {
      var params = new URLSearchParams(window.location.search);
      var errorMsg = params.get('error') || 'Авторизация платежа была отменена банком или пользователем.';
      root.innerHTML =
        '<div class="min-h-[80vh] flex items-center justify-center p-4">' +
          '<div class="max-w-lg w-full bg-white dark:bg-[#151518] rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xl p-6 sm:p-8 text-center space-y-6">' +
            '<div class="w-20 h-20 mx-auto rounded-full bg-rose-500/10 border-2 border-rose-500/30 flex items-center justify-center text-rose-600 dark:text-rose-400">' +
              FR.icon('x-circle', 'w-10 h-10') +
            '</div>' +
            '<div class="space-y-2">' +
              '<span class="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 text-xs font-bold rounded-full border border-rose-200 dark:border-rose-800">' +
                FR.icon('alert-triangle', 'w-3.5 h-3.5') + 'Оплата не завершена' +
              '</span>' +
              '<h1 class="text-2xl sm:text-3xl font-serif italic text-black dark:text-white">Платёж не завершён</h1>' +
              '<p class="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">' + FR.esc(errorMsg) + '</p>' +
            '</div>' +
            '<div class="p-4 bg-zinc-50 dark:bg-zinc-900/70 rounded-2xl border border-zinc-200 dark:border-zinc-800 text-left space-y-2 text-xs text-zinc-600 dark:text-zinc-400">' +
              '<p class="font-bold text-black dark:text-white flex items-center gap-1.5">' + FR.icon('help-circle', 'w-4 h-4 text-rose-500') + 'Возможные причины:</p>' +
              '<ul class="list-disc list-inside space-y-1 text-[11px] text-zinc-500 dark:text-zinc-400 pl-1">' +
                '<li>Недостаточно средств на банковской карте</li>' +
                '<li>Лимит на интернет-операции или 3D-Secure код не введен вовремя</li>' +
                '<li>Отмена операции пользователем в платежном окне</li>' +
              '</ul>' +
            '</div>' +
            '<div class="flex flex-col sm:flex-row gap-3 pt-2">' +
              '<button data-retry class="flex-1 py-3.5 px-5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-all shadow-md flex items-center justify-center gap-2">' +
                FR.icon('refresh-cw', 'w-4 h-4') + '<span>Попробовать снова</span>' +
              '</button>' +
              '<button data-home class="py-3.5 px-5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold text-xs uppercase tracking-widest rounded-xl transition-all border border-zinc-200 dark:border-zinc-700">На главную</button>' +
            '</div>' +
          '</div>' +
        '</div>';

      root.querySelector('[data-retry]').addEventListener('click', function () { FR.go('search'); });
      root.querySelector('[data-home]').addEventListener('click', function () { FR.go('feed'); });
      return;
    }

    root.innerHTML =
      '<div class="min-h-[80vh] flex items-center justify-center p-4">' +
        '<div class="max-w-lg w-full bg-white dark:bg-[#151518] rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xl p-6 sm:p-8 text-center space-y-6">' +
          '<div class="w-20 h-20 mx-auto rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">' +
            FR.icon('check-circle-2', 'w-10 h-10') +
          '</div>' +
          '<div class="space-y-2">' +
            '<span class="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-xs font-bold rounded-full border border-emerald-200 dark:border-emerald-800">' +
              FR.icon('check-circle-2', 'w-3.5 h-3.5') + 'Готово' +
            '</span>' +
            '<h1 class="text-2xl sm:text-3xl font-serif italic text-black dark:text-white">Операция выполнена!</h1>' +
            '<p class="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">' +
              'Запись оформлена. Вы можете обсудить детали с мастером в личном чате.' +
            '</p>' +
          '</div>' +
          '<div data-booking-details class="hidden"></div>' +
          '<div class="flex flex-col sm:flex-row gap-3 pt-2">' +
            '<button data-profile class="flex-1 py-3.5 px-5 bg-black dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-black font-bold text-xs uppercase tracking-widest rounded-xl transition-all shadow-md flex items-center justify-center gap-2">' +
              '<span>Перейти к записям</span>' + FR.icon('arrow-right', 'w-4 h-4') +
            '</button>' +
            '<button data-home class="py-3.5 px-5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold text-xs uppercase tracking-widest rounded-xl transition-all border border-zinc-200 dark:border-zinc-700">На главную</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    root.querySelector('[data-profile]').addEventListener('click', function () { FR.go('profile'); });
    root.querySelector('[data-home]').addEventListener('click', function () { FR.go('feed'); });

    var params2 = new URLSearchParams(window.location.search);
    var bookingId = params2.get('bookingId') || params2.get('LMI_PAYMENT_NO');
    if (bookingId && FR.state.user) {
      FR.api.getBookings(FR.state.user.id, 'client').then(function (res) {
        var booking = (res.bookings || []).filter(function (b) { return b.id === bookingId; })[0];
        if (!booking) return;
        var box = root.querySelector('[data-booking-details]');
        box.classList.remove('hidden');
        box.innerHTML =
          '<div class="p-4 bg-zinc-50 dark:bg-zinc-900/70 rounded-2xl border border-zinc-200 dark:border-zinc-800 text-left space-y-3 text-xs">' +
            '<div class="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2.5">' +
              '<div><span class="text-[10px] uppercase font-bold text-zinc-400">Услуга</span>' +
                '<p class="font-bold text-black dark:text-white text-sm">' + FR.esc(booking.serviceTitle) + '</p></div>' +
              '<div class="text-right"><span class="text-[10px] uppercase font-bold text-zinc-400">Сумма заказа</span>' +
                '<p class="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">' + FR.money(booking.servicePrice) + ' ₽</p></div>' +
            '</div>' +
            '<div class="grid grid-cols-2 gap-2 text-zinc-600 dark:text-zinc-400">' +
              '<div class="flex items-center gap-1.5">' + FR.icon('user-check', 'w-4 h-4 text-rose-500') + '<span>Мастер: <b>' + FR.esc(booking.masterName) + '</b></span></div>' +
              '<div class="flex items-center gap-1.5">' + FR.icon('calendar', 'w-4 h-4 text-rose-500') + '<span>' + FR.esc(booking.date) + ' в ' + FR.esc(booking.timeSlot) + '</span></div>' +
            '</div>' +
            '<div class="p-2.5 bg-blue-50 dark:bg-blue-950/30 rounded-xl border border-blue-200 dark:border-blue-800/50 flex items-start gap-2 text-[11px] text-blue-900 dark:text-blue-200">' +
              FR.icon('sparkles', 'w-4 h-4 text-blue-600 shrink-0 mt-0.5') +
              '<span>Общайтесь с мастером в личном чате: уточните детали, отправьте референсы и подтвердите время визита.</span>' +
            '</div>' +
          '</div>';
      }).catch(function () {});
    }
  };

  /* ---------------------------- Старт ----------------------------- */
  /** Переход в конкретную переписку по ссылке из push-уведомления (/?tab=chats&chat=...). */
  function applyDeepLink() {
    var params = new URLSearchParams(window.location.search);
    var chatId = params.get('chat');
    if (chatId && FR.state.user) {
      FR.state.activeChatId = chatId;
      FR.state.tab = 'chats';
    }
  }

  function start() {
    if (window.__PAGE === 'booking_success') {
      FR.renderBookingPage('success');
    } else if (window.__PAGE === 'booking_failed') {
      FR.renderBookingPage('failed');
    } else {
      applyDeepLink();
      FR.mount(FR.state.tab);
    }
    FR.startRealtime();
  }

  if (FR.state.user) {
    FR.loadWorksAndPosts().then(start, start);
  } else {
    start();
  }
})();
