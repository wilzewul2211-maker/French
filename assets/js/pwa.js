/**
 * PWA: установка сайта как приложения (Android и iPhone) и push-уведомления.
 *
 * — регистрирует service worker (/sw.js);
 * — показывает окно с предложением установить приложение;
 * — запрашивает разрешение и подписывает устройство на уведомления о сообщениях и записях.
 *
 * Публичный интерфейс: FR.pwa.open(), FR.pwa.enableNotifications(), FR.pwa.isStandalone().
 */
(function () {
  'use strict';
  var FR = window.FR;
  if (!FR) return;

  var DISMISS_KEY = 'french_pwa_prompt_dismissed';
  var INSTALLED_KEY = 'french_pwa_installed';
  var PROMPT_DELAY = 5000;
  var SNOOZE_DAYS = 7;
  var ICON_SRC = '/assets/icons/icon-192.png';

  var deferredPrompt = null;
  var pushConfig = null;
  var swRegistration = null;
  var promptTimerSet = false;

  /* ------------------------------ Окружение ------------------------------ */

  function isStandalone() {
    try {
      return window.matchMedia('(display-mode: standalone)').matches
        || window.matchMedia('(display-mode: fullscreen)').matches
        || window.matchMedia('(display-mode: minimal-ui)').matches
        || window.navigator.standalone === true;
    } catch (e) {
      return false;
    }
  }

  function isIOS() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent)
      || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  function isAndroid() {
    return /android/i.test(navigator.userAgent);
  }

  /** Тип устройства для показа подходящей инструкции установки. */
  function deviceKind() {
    if (isIOS()) return 'ios';
    if (isAndroid()) return 'android';
    return 'desktop';
  }

  function store(key, value) {
    try {
      if (value === undefined) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch (e) { /* приватный режим */ }
  }

  function read(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }

  function snoozed() {
    var dismissedAt = Number(read(DISMISS_KEY) || 0);
    return dismissedAt > 0 && (Date.now() - dismissedAt) < SNOOZE_DAYS * 86400000;
  }

  /* --------------------------- Service worker ---------------------------- */

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return Promise.resolve(null);
    // updateViaCache: 'none' — скрипт SW всегда берём из сети, а не из HTTP-кэша,
    // иначе браузер может подолгу не видеть обновления сайта.
    return navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
      .then(function (registration) {
        swRegistration = registration;
        registration.update().catch(function () { /* тихо */ });
        return registration;
      })
      .catch(function (error) {
        console.warn('Не удалось зарегистрировать service worker:', error);
        return null;
      });
  }

  /* --------------------------- Push-подписка ----------------------------- */

  function notificationsSupported() {
    return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
  }

  function permissionState() {
    return notificationsSupported() ? Notification.permission : 'unsupported';
  }

  /** На iPhone уведомления работают только в установленном приложении. */
  function canEnableNotifications() {
    if (!notificationsSupported()) return false;
    if (isIOS() && !isStandalone()) return false;
    return true;
  }

  function loadPushConfig() {
    if (pushConfig) return Promise.resolve(pushConfig);
    return FR.api.get('/api/push/config')
      .then(function (config) { pushConfig = config || { enabled: false }; return pushConfig; })
      .catch(function () { pushConfig = { enabled: false }; return pushConfig; });
  }

  function urlBase64ToUint8Array(base64String) {
    var padding = new Array((4 - (base64String.length % 4)) % 4 + 1).join('=');
    var base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    var raw = window.atob(base64);
    var output = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
    return output;
  }

  /** Подписка устройства и её сохранение на сервере. */
  function subscribeDevice() {
    return loadPushConfig().then(function (config) {
      if (!config.enabled || !config.publicKey) {
        throw new Error('Уведомления недоступны на сервере');
      }
      return navigator.serviceWorker.ready.then(function (registration) {
        swRegistration = registration;
        return registration.pushManager.getSubscription().then(function (existing) {
          if (existing) return existing;
          return registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(config.publicKey)
          });
        });
      }).then(function (subscription) {
        return FR.api.post('/api/push/subscribe', { subscription: subscription.toJSON() });
      });
    });
  }

  /** Тихая синхронизация при запуске: разрешение уже выдано ранее. */
  function syncSubscription() {
    if (!FR.state.user || !canEnableNotifications() || Notification.permission !== 'granted') return;
    subscribeDevice().catch(function () { /* тихо */ });
  }

  /** Включение уведомлений по действию пользователя. */
  function enableNotifications() {
    if (!notificationsSupported()) {
      FR.toast('Браузер не поддерживает уведомления');
      return Promise.resolve(false);
    }
    if (!FR.state.user) {
      FR.toast('Войдите в аккаунт, чтобы получать уведомления');
      return Promise.resolve(false);
    }
    if (isIOS() && !isStandalone()) {
      FR.toast('Сначала установите приложение на экран «Домой»');
      return Promise.resolve(false);
    }

    return Notification.requestPermission().then(function (result) {
      if (result !== 'granted') {
        FR.toast('Разрешение на уведомления не выдано');
        return false;
      }
      return subscribeDevice().then(function () {
        FR.toast('Уведомления включены');
        refreshBell();
        return true;
      }).catch(function (error) {
        FR.toast((error && error.message) || 'Не удалось включить уведомления');
        return false;
      });
    });
  }

  /* ------------------------------- Модалка ------------------------------- */

  function featureRow(icon, title, text) {
    return '<div class="flex items-start gap-3">' +
      '<div class="shrink-0 p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/60">' +
        FR.icon(icon, 'w-4 h-4') +
      '</div>' +
      '<div>' +
        '<p class="text-xs font-bold text-black dark:text-white">' + FR.esc(title) + '</p>' +
        '<p class="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">' + FR.esc(text) + '</p>' +
      '</div>' +
    '</div>';
  }

  function stepsBlock(title, steps) {
    return '<div class="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 p-4 space-y-3">' +
      '<p class="text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">' + FR.esc(title) + '</p>' +
      '<ol class="space-y-2.5">' +
        steps.map(function (step, index) {
          return '<li class="flex items-center gap-2.5 text-[11px] text-zinc-700 dark:text-zinc-300">' +
            '<span class="shrink-0 w-6 h-6 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-rose-600 dark:text-rose-400">' + FR.icon(step[0], 'w-3.5 h-3.5') + '</span>' +
            '<span><b class="font-bold text-black dark:text-white">' + (index + 1) + '.</b> ' + FR.esc(step[1]) + '</span>' +
          '</li>';
        }).join('') +
      '</ol>' +
    '</div>';
  }

  function iosSteps() {
    return stepsBlock('Как установить на iPhone', [
      ['share-2', 'Нажмите «Поделиться» в Safari'],
      ['plus-square', 'Выберите «На экран «Домой»»'],
      ['check', 'Нажмите «Добавить»']
    ]);
  }

  function androidSteps() {
    return stepsBlock('Как установить на Android', [
      ['grid', 'Откройте меню браузера (три точки) вверху справа'],
      ['plus-square', 'Выберите «Установить приложение» или «Добавить на главный экран»'],
      ['check', 'Подтвердите установку']
    ]);
  }

  function deviceSteps() {
    var kind = deviceKind();
    if (kind === 'ios') return iosSteps();
    if (kind === 'android') return androidSteps();
    return desktopHint();
  }

  function desktopHint() {
    return stepsBlock('Как установить на компьютер', [
      ['grid', 'Откройте меню браузера'],
      ['plus-square', 'Выберите «Установить приложение» или «Создать ярлык»'],
      ['check', 'Подтвердите установку']
    ]);
  }

  function notificationsBlock() {
    if (!FR.state.user) {
      return '<p class="text-[11px] text-zinc-500 dark:text-zinc-400">Войдите в аккаунт, чтобы получать уведомления о новых сообщениях и записях.</p>';
    }
    if (!pushConfig || !pushConfig.enabled) {
      return '';
    }
    if (permissionState() === 'granted') {
      return '<div class="flex items-center gap-2.5 rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-3">' +
        '<span class="text-emerald-600 dark:text-emerald-400">' + FR.icon('check-circle-2', 'w-4 h-4') + '</span>' +
        '<span class="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">Уведомления включены</span>' +
      '</div>';
    }
    if (isIOS() && !isStandalone()) {
      return '<p class="text-[11px] text-zinc-500 dark:text-zinc-400">После установки приложения вы сможете включить уведомления — они будут приходить, даже когда приложение закрыто.</p>';
    }
    return '<button type="button" data-pwa-notify-now class="w-full py-3 px-4 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-black dark:text-white font-bold text-[11px] uppercase tracking-widest rounded-xl border border-zinc-200 dark:border-zinc-700 transition-all flex items-center justify-center gap-2">' +
      FR.icon('bell', 'w-3.5 h-3.5 text-rose-600') + '<span>Включить уведомления</span>' +
    '</button>';
  }

  function modalHtml() {
    var installBlock;
    if (deferredPrompt) {
      installBlock = '<button type="button" data-pwa-install class="w-full py-3.5 px-4 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-[11px] uppercase tracking-widest rounded-xl shadow-md transition-all flex items-center justify-center gap-2">' +
        FR.icon('download', 'w-4 h-4') + '<span>Установить приложение</span>' +
      '</button>';
    } else {
      installBlock = deviceSteps();
    }

    var kind = deviceKind();
    var installTitle = 'Установите приложение'
      + (kind === 'ios' ? ' на iPhone' : kind === 'android' ? ' на Android' : '');

    return '<div class="w-full max-w-md bg-white dark:bg-[#151518] rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">' +
      '<div class="relative bg-gradient-to-br from-rose-600 via-rose-500 to-pink-600 px-6 pt-7 pb-6 text-white">' +
        '<button type="button" data-pwa-close class="absolute top-4 right-4 p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/15 transition-colors">' + FR.icon('x', 'w-4 h-4') + '</button>' +
        '<img src="' + ICON_SRC + '" alt="French" class="w-16 h-16 rounded-2xl ring-2 ring-white/40 shadow-lg" />' +
        '<h3 class="mt-4 font-sans font-black text-xl leading-tight">' + FR.esc(installTitle) + '</h3>' +
        '<p class="mt-1 text-[12px] text-white/85 leading-relaxed">French Beauty всегда под рукой: запись к мастерам, портфолио и чаты — в один клик с экрана телефона.</p>' +
      '</div>' +
      '<div class="px-6 py-5 space-y-4">' +
        featureRow('bell', 'Уведомления о сообщениях и записях', 'Сразу узнаете, когда мастер ответил или появилась новая запись.') +
        featureRow('smartphone', 'Запуск без адресной строки', 'Приложение открывается на весь экран, как обычная программа.') +
        featureRow('sparkles', 'Быстрый доступ', 'Иконка на рабочем столе — и вы сразу в ленте работ.') +
        installBlock +
        notificationsBlock() +
      '</div>' +
      '<div class="px-6 pb-5">' +
        '<button type="button" data-pwa-later class="w-full py-2.5 text-[11px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors">Позже</button>' +
      '</div>' +
    '</div>';
  }

  function openModal() {
    if (FR.isOverlayOpen('pwa-install')) return;

    var overlay = FR.openOverlay('pwa-install', modalHtml(), {});
    if (!overlay) return;

    function close(snooze) {
      if (snooze) store(DISMISS_KEY, String(Date.now()));
      FR.closeOverlay('pwa-install');
    }

    overlay.querySelectorAll('[data-pwa-close], [data-pwa-later]').forEach(function (button) {
      button.addEventListener('click', function () { close(true); });
    });

    var installButton = overlay.querySelector('[data-pwa-install]');
    if (installButton) {
      installButton.addEventListener('click', function () {
        if (!deferredPrompt) return;
        var prompt = deferredPrompt;
        deferredPrompt = null;
        installButton.disabled = true;
        prompt.prompt();
        prompt.userChoice.then(function (choice) {
          if (choice && choice.outcome === 'accepted') {
            store(INSTALLED_KEY, '1');
            close(false);
          } else {
            close(true);
          }
        }).catch(function () { close(true); });
      });
    }

    var notifyButton = overlay.querySelector('[data-pwa-notify-now]');
    if (notifyButton) {
      notifyButton.addEventListener('click', function () {
        notifyButton.disabled = true;
        enableNotifications().then(function (ok) {
          if (ok) close(false);
          else notifyButton.disabled = false;
        });
      });
    }
  }

  /* ------------------------- Автопоказ окна установки -------------------- */

  function canOfferInstall() {
    if (isStandalone() || read(INSTALLED_KEY)) return false;
    if (snoozed()) return false;
    // На iPhone установка только вручную (Safari). На Android показываем
    // инструкцию, если браузер ещё не предложил нативный промпт.
    return isIOS() || isAndroid() || !!deferredPrompt;
  }

  function maybeOpenModal() {
    if (FR.isOverlayOpen('pwa-install') || !canOfferInstall()) return;

    var host = document.getElementById('overlay-host');
    if (host && host.children.length) {
      // Не перекрываем другие модалки — попробуем позже.
      window.setTimeout(maybeOpenModal, 5000);
      return;
    }

    openModal();
  }

  function schedulePrompt() {
    if (promptTimerSet) return;
    promptTimerSet = true;
    window.setTimeout(maybeOpenModal, PROMPT_DELAY);
  }

  /* ------------------------------ Кнопка-колокольчик --------------------- */

  function refreshBell() {
    var button = document.querySelector('[data-pwa-notify]');
    if (!button) return;
    var visible = !!(FR.state.user && pushConfig && pushConfig.enabled
      && canEnableNotifications() && permissionState() === 'default');
    button.classList.toggle('hidden', !visible);
  }

  /** Кнопка установки в шапке: видна, пока приложение не установлено. */
  function refreshInstallButton() {
    var button = document.querySelector('[data-pwa-install-btn]');
    if (!button) return;
    button.classList.toggle('hidden', isStandalone() || !!read(INSTALLED_KEY));
  }

  /* --------------------------------- Старт ------------------------------- */

  window.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault();
    deferredPrompt = event;
    // Если окно ещё не показывали, даём ему появиться раньше, чем обычно.
    if (!FR.isOverlayOpen('pwa-install') && canOfferInstall()) {
      window.setTimeout(maybeOpenModal, 1200);
    }
  });

  window.addEventListener('appinstalled', function () {
    store(INSTALLED_KEY, '1');
    FR.closeOverlay('pwa-install');
    refreshInstallButton();
    FR.toast('Приложение установлено');
  });

  document.addEventListener('DOMContentLoaded', function () {
    var bell = document.querySelector('[data-pwa-notify]');
    if (bell) bell.addEventListener('click', function () { enableNotifications(); });

    var installBtn = document.querySelector('[data-pwa-install-btn]');
    if (installBtn) installBtn.addEventListener('click', function () { openModal(); });

    registerServiceWorker()
      .then(loadPushConfig)
      .then(function () {
        refreshBell();
        refreshInstallButton();
        syncSubscription();
        schedulePrompt();
      });
  });

  FR.pwa = {
    isStandalone: isStandalone,
    open: openModal,
    enableNotifications: enableNotifications,
    notificationsSupported: notificationsSupported,
    permission: permissionState,
    refreshBell: refreshBell,
    refreshInstallButton: refreshInstallButton
  };
})();
