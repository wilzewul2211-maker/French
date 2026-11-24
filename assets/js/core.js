/**
 * French — клиентское ядро (без фреймворков и сборки).
 * Предоставляет пространство имён window.FR: иконки, форматирование, API-клиент,
 * состояние, оверлеи/модалки, тосты, тему, роутинг разделов и realtime-опрос.
 */
(function () {
  'use strict';

  var FR = (window.FR = window.FR || {});

  /* =========================================================
     ИКОНКИ (набор отдаётся сервером в window.__ICONS)
     ========================================================= */
  var ICON_SET = window.__ICONS || {};

  FR.icon = function (name, cls) {
    var inner = ICON_SET[name] || '';
    return '<svg class="' + (cls || 'icon') + '" width="24" height="24" viewBox="0 0 24 24" fill="none" ' +
      'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      inner + '</svg>';
  };

  /* =========================================================
     УТИЛИТЫ
     ========================================================= */
  FR.esc = function (value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  /** Безопасный JSON внутри HTML-атрибута. */
  FR.attrJson = function (obj) {
    return FR.esc(JSON.stringify(obj || {}));
  };

  FR.num = function (v) {
    var n = Number(v || 0);
    return isNaN(n) ? 0 : n;
  };

  FR.money = function (v) {
    return FR.num(v).toLocaleString('ru-RU');
  };

  function toDate(iso) {
    if (!iso) return null;
    var d = new Date(iso);
    return isNaN(d.getTime()) ? null : d;
  }

  FR.fmtDate = function (iso) {
    var d = toDate(iso);
    return d ? d.toLocaleDateString('ru-RU') : '';
  };

  FR.fmtTime = function (iso) {
    var d = toDate(iso);
    return d ? d.toLocaleTimeString('ru-RU') : '';
  };

  FR.fmtTimeShort = function (iso) {
    var d = toDate(iso);
    return d ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
  };

  FR.fmtDateTime = function (iso) {
    var d = toDate(iso);
    return d ? d.toLocaleDateString('ru-RU') + ', ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
  };

  FR.PLATFORM_PERCENT = window.__PLATFORM_PERCENT || 4;

  /* =========================================================
     ИЗОБРАЖЕНИЯ ПО УМОЛЧАНИЮ
     ========================================================= */
  FR.DEFAULT_AVATAR = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23E2DDD5"/><circle cx="50" cy="36" r="18" fill="%23554F47"/><path d="M 18 88 C 18 62, 34 54, 50 54 C 66 54, 82 62, 82 88 Z" fill="%23554F47"/></svg>';

  FR.DEFAULT_IMAGE = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect width="400" height="300" fill="%23ECE7DF"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%23554F47" font-family="sans-serif" font-size="16" font-weight="600">French Beauty Art</text></svg>';

  /** Обработчик onerror для <img> — ставит заглушку. */
  FR.imgError = function (el, kind) {
    el.onerror = null;
    el.src = kind === 'work' ? FR.DEFAULT_IMAGE : FR.DEFAULT_AVATAR;
  };

  /** Атрибут заглушки для <img>: FR.onerror('avatar'|'work') */
  FR.onerror = function (kind) {
    return ' onerror="FR.imgError(this, \'' + (kind || 'avatar') + '\')"';
  };

  FR.avatarSrc = function (url) {
    return url && url !== '' ? url : FR.DEFAULT_AVATAR;
  };

  FR.imgSrc = function (url) {
    return url && url !== '' ? url : FR.DEFAULT_IMAGE;
  };

  /**
   * Клиентское сжатие изображения (порт utils/imageCompression.ts).
   * @param {File} file
   * @param {{maxWidth?:number,maxHeight?:number,quality?:number,outputType?:string}} [opts]
   * @returns {Promise<string>} dataURL
   */
  FR.compressImage = function (file, opts) {
    opts = opts || {};
    return new Promise(function (resolve, reject) {
      if (!file || !file.type || file.type.indexOf('image/') !== 0) {
        reject(new Error('Выбранный файл не является изображением'));
        return;
      }
      var maxWidth = opts.maxWidth || 1280;
      var maxHeight = opts.maxHeight || 1280;
      var quality = opts.quality === undefined ? 0.82 : opts.quality;
      var outputType = opts.outputType || 'image/jpeg';

      var reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = function (ev) {
        var img = new Image();
        img.src = ev.target.result;
        img.onload = function () {
          var width = img.width;
          var height = img.height;
          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
          } else if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
          var canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          var ctx = canvas.getContext('2d');
          if (!ctx) { resolve(ev.target.result); return; }
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);
          try {
            resolve(canvas.toDataURL(outputType, quality));
          } catch (err) {
            resolve(ev.target.result);
          }
        };
        img.onerror = function () { reject(new Error('Не удалось обработать изображение')); };
      };
      reader.onerror = function () { reject(new Error('Ошибка чтения файла')); };
    });
  };

  /* =========================================================
     ЗВУК СООБЩЕНИЯ
     ========================================================= */
  FR.playMessageSound = function () {
    try {
      var AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      var ctx = new AudioCtx();
      if (ctx.state === 'suspended') ctx.resume();
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(783.99, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch (err) {
      console.warn('Audio playback suppressed by browser policy:', err);
    }
  };

  /* =========================================================
     HTTP-КЛИЕНТ И API
     ========================================================= */
  function http(method, url, body) {
    var opts = {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin'
    };
    if (body !== undefined) opts.body = JSON.stringify(body);
    if (method === 'GET') delete opts.headers['Content-Type'];

    return fetch(url, opts).then(function (res) {
      return res.text().then(function (text) {
        var json = null;
        try { json = text ? JSON.parse(text) : null; } catch (e) { json = null; }
        if (!res.ok) {
          var msg = (json && json.error) ? json.error : ('Ошибка запроса (' + res.status + ')');
          var err = new Error(msg);
          err.status = res.status;
          throw err;
        }
        return json;
      });
    });
  }

  var api = {
    get: function (u) { return http('GET', u); },
    post: function (u, b) { return http('POST', u, b === undefined ? {} : b); },
    put: function (u, b) { return http('PUT', u, b === undefined ? {} : b); },
    del: function (u) { return http('DELETE', u); }
  };

  FR.api = {
    http: api,
    get: api.get,
    post: api.post,
    put: api.put,
    del: api.del,

    /* --- Авторизация и email-код --- */
    sendEmailCode: function (email) {
      return api.post('/api/auth/send-email-code', { email: email });
    },
    verifyEmailCode: function (email, code) {
      return api.post('/api/auth/verify-email-code', { email: email, code: code });
    },
    register: function (data) {
      return api.post('/api/auth/register', data);
    },
    login: function (email, password) {
      return api.post('/api/auth/login', { email: email, password: password });
    },
    logout: function () {
      return api.post('/api/auth/logout', {});
    },
    getUser: function (id) {
      return api.get('/api/auth/user/' + encodeURIComponent(id));
    },
    updateProfile: function (id, updates) {
      var body = Object.assign({ id: id }, updates || {});
      return api.put('/api/users/profile', body);
    },

    /* --- Кошелёк (платёжный шлюз подключается отдельно) --- */
    topUpBalance: function (userId, amount) {
      return api.post('/api/payments/top-up-confirm', { userId: userId, amount: amount });
    },
    initTopUp: function (userId, amount) {
      return api.post('/api/payments/top-up-init', { userId: userId, amount: amount });
    },
    getTransactions: function (userId) {
      return api.get('/api/users/transactions' + (userId ? '?userId=' + encodeURIComponent(userId) : ''));
    },

    /* --- Мастера --- */
    searchMasters: function (filters) {
      var params = new URLSearchParams();
      filters = filters || {};
      if (filters.query) params.append('query', filters.query);
      if (filters.category) params.append('category', filters.category);
      if (filters.district) params.append('district', filters.district);
      if (filters.minPrice !== undefined && filters.minPrice !== null && filters.minPrice !== '') params.append('minPrice', String(filters.minPrice));
      if (filters.maxPrice !== undefined && filters.maxPrice !== null && filters.maxPrice !== '') params.append('maxPrice', String(filters.maxPrice));
      if (filters.minRating !== undefined && filters.minRating !== null && filters.minRating !== '') params.append('minRating', String(filters.minRating));
      return api.get('/api/masters/search?' + params.toString());
    },
    getMasterDetails: function (id) {
      return api.get('/api/masters/' + encodeURIComponent(id));
    },

    /* --- Портфолио --- */
    getWorks: function (userId) {
      return api.get('/api/portfolio' + (userId ? '?userId=' + encodeURIComponent(userId) : ''));
    },
    addWork: function (data) {
      return api.post('/api/portfolio', data);
    },
    toggleLikeWork: function (workId, userId) {
      return api.post('/api/portfolio/' + encodeURIComponent(workId) + '/like', { userId: userId });
    },
    deleteWork: function (workId) {
      return api.del('/api/portfolio/' + encodeURIComponent(workId));
    },

    /* --- Посты --- */
    getPosts: function (userId) {
      return api.get('/api/posts' + (userId ? '?userId=' + encodeURIComponent(userId) : ''));
    },
    addPost: function (data) {
      return api.post('/api/posts', data);
    },
    toggleLikePost: function (postId, userId) {
      return api.post('/api/posts/' + encodeURIComponent(postId) + '/like', { userId: userId });
    },
    deletePost: function (postId) {
      return api.del('/api/posts/' + encodeURIComponent(postId));
    },

    /* --- Комментарии --- */
    getComments: function (targetType, targetId) {
      return api.get('/api/comments/' + targetType + '/' + encodeURIComponent(targetId));
    },
    addComment: function (data) {
      return api.post('/api/comments', data);
    },

    /* --- Услуги и график --- */
    addService: function (data) {
      return api.post('/api/services', data);
    },
    deleteService: function (id) {
      return api.del('/api/services/' + encodeURIComponent(id));
    },
    updateSchedule: function (masterId, schedule) {
      return api.put('/api/schedule/' + encodeURIComponent(masterId), schedule);
    },

    /* --- Записи --- */
    createBooking: function (data) {
      return api.post('/api/bookings', data);
    },
    getBookings: function (userId, role) {
      return api.get('/api/bookings?userId=' + encodeURIComponent(userId) + '&role=' + role);
    },
    updateBookingStatus: function (bookingId, status) {
      return api.put('/api/bookings/' + encodeURIComponent(bookingId) + '/status', { status: status });
    },
    completeAppointment: function (bookingId, userId, role) {
      return api.post('/api/appointments/' + encodeURIComponent(bookingId) + '/complete', { userId: userId, masterId: userId, role: role });
    },
    cancelAppointment: function (bookingId) {
      return api.post('/api/appointments/' + encodeURIComponent(bookingId) + '/cancel', {});
    },
    cancelAppointmentAuthorization: function (bookingId, reason) {
      return api.post('/api/bookings/' + encodeURIComponent(bookingId) + '/cancel-authorization', { reason: reason });
    },
    rateBooking: function (bookingId, raterRole, rating, reviewText) {
      return api.post('/api/bookings/' + encodeURIComponent(bookingId) + '/rate', { raterRole: raterRole, rating: rating, reviewText: reviewText });
    },
    submitBookingSurvey: function (data) {
      return api.post('/api/bookings/' + encodeURIComponent(data.bookingId) + '/survey', data);
    },
    payDelayedBooking: function (bookingId, clientId) {
      return api.post('/api/bookings/' + encodeURIComponent(bookingId) + '/pay', { clientId: clientId });
    },
    resolveDispute: function (bookingId, decision, resolutionNotes) {
      return api.post('/api/bookings/' + encodeURIComponent(bookingId) + '/resolve-dispute', { decision: decision, resolutionNotes: resolutionNotes });
    },

    /* --- Отзывы --- */
    addReview: function (data) {
      return api.post('/api/reviews', data);
    },
    getReviews: function (userId) {
      return api.get('/api/reviews/' + encodeURIComponent(userId));
    },

    /* --- Чаты --- */
    getChats: function (userId) {
      return api.get('/api/chats?userId=' + encodeURIComponent(userId));
    },
    getMessages: function (chatId) {
      return api.get('/api/chats/' + encodeURIComponent(chatId) + '/messages');
    },
    sendMessage: function (chatId, senderId, text, imageUrl) {
      return api.post('/api/chats/' + encodeURIComponent(chatId) + '/messages', { senderId: senderId, text: text, imageUrl: imageUrl });
    },
    markChatRead: function (chatId, userId) {
      return api.post('/api/chats/' + encodeURIComponent(chatId) + '/read', { userId: userId });
    },

    /* --- Статистика --- */
    getMasterStats: function (masterId, period) {
      return api.get('/api/stats/master/' + encodeURIComponent(masterId) + '?period=' + period);
    },

    /* --- Подписка мастера на объявления --- */
    getListingStatus: function (userId) {
      return api.get('/api/masters/listing/status' + (userId ? '?userId=' + encodeURIComponent(userId) : ''));
    },
    getSubscriptions: function (userId) {
      return api.get('/api/masters/listing/subscriptions' + (userId ? '?userId=' + encodeURIComponent(userId) : ''));
    },
    payListing: function (masterId, plan) {
      return api.post('/api/masters/listing/pay', { masterId: masterId, plan: plan });
    },
    confirmListing: function (subscriptionId) {
      return api.post('/api/masters/listing/confirm', { subscriptionId: subscriptionId });
    },

    /* --- Поддержка --- */
    getSupportTickets: function (scope) {
      return api.get('/api/support/tickets' + (scope === 'all' ? '?scope=all' : ''));
    },
    createSupportTicket: function (data) {
      return api.post('/api/support/tickets', data);
    },
    getSupportThread: function (ticketId) {
      return api.get('/api/support/tickets/' + encodeURIComponent(ticketId) + '/messages');
    },
    sendSupportMessage: function (ticketId, text) {
      return api.post('/api/support/tickets/' + encodeURIComponent(ticketId) + '/messages', { text: text });
    },
    markSupportRead: function (ticketId) {
      return api.post('/api/support/tickets/' + encodeURIComponent(ticketId) + '/read', {});
    },

    /* --- Админ: пользователи и мастера --- */
    getAdminUsers: function (role, query) {
      var p = new URLSearchParams();
      if (role) p.append('role', role);
      if (query) p.append('query', query);
      var q = p.toString();
      return api.get('/api/admin/users' + (q ? '?' + q : ''));
    },
    getAdminMasters: function (query) {
      return api.get('/api/admin/masters' + (query ? '?query=' + encodeURIComponent(query) : ''));
    },
    setUserBlocked: function (userId, blocked) {
      return api.post('/api/admin/users/block', { userId: userId, blocked: !!blocked });
    },
    setUserRole: function (userId, role) {
      return api.post('/api/admin/users/role', { userId: userId, role: role });
    },
    grantFreeListing: function (userId, months) {
      return api.post('/api/admin/masters/free-listing', { userId: userId, months: months || 1 });
    },
    createTechnicalUser: function (data) {
      return api.post('/api/admin/users/technical', data);
    }
  };

  /* =========================================================
     СОСТОЯНИЕ
     ========================================================= */
  FR.state = {
    user: window.__USER || null,
    tab: window.__TAB || 'feed',
    works: [],
    posts: [],
    chats: [],
    activeChatId: null,
    lastEventId: 0
  };

  /* =========================================================
     ТОСТЫ
     ========================================================= */
  FR.toast = function (msg) {
    var host = document.getElementById('toast-host');
    if (!host) return;
    var el = document.createElement('div');
    el.className = 'fixed top-20 right-4 z-[60] bg-black text-white text-xs font-bold px-4 py-3 rounded-xl shadow-2xl border border-rose-600/50 flex items-center space-x-2 fr-fade-up';
    el.innerHTML = '<span class="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span><span>' + FR.esc(msg) + '</span>';
    host.appendChild(el);
    setTimeout(function () {
      el.style.transition = 'opacity .3s ease';
      el.style.opacity = '0';
      setTimeout(function () { el.remove(); }, 320);
    }, 4000);
  };

  /* =========================================================
     ОВЕРЛЕИ / МОДАЛКИ
     ========================================================= */
  var overlays = {};

  /**
   * Открыть оверлей.
   * @param {string} id      уникальный идентификатор
   * @param {string} html    внутренняя разметка (обрезается до контейнера)
   * @param {object} [opts]  {wrap: 'class строки обёртки', onClose: fn, persist: bool}
   * @returns {HTMLElement} корневой элемент оверлея
   */
  FR.openOverlay = function (id, html, opts) {
    opts = opts || {};
    FR.closeOverlay(id, true);

    var host = document.getElementById('overlay-host');
    if (!host) return null;

    var wrap = document.createElement('div');
    wrap.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs overflow-y-auto';
    wrap.setAttribute('data-overlay', id);
    wrap.innerHTML = '<div class="fr-pop w-full max-w-lg my-8">' + html + '</div>';

    // закрытие по клику на подложку
    wrap.addEventListener('mousedown', function (e) {
      if (e.target === wrap) FR.closeOverlay(id);
    });

    host.appendChild(wrap);
    document.documentElement.style.overflow = 'hidden';
    overlays[id] = { el: wrap, onClose: opts.onClose || null };

    var onKey = function (e) {
      if (e.key === 'Escape') {
        FR.closeOverlay(id);
        document.removeEventListener('keydown', onKey);
      }
    };
    document.addEventListener('keydown', onKey);
    overlays[id].offKey = function () { document.removeEventListener('keydown', onKey); };

    return wrap;
  };

  FR.closeOverlay = function (id, silent) {
    var rec = overlays[id];
    if (!rec) return;
    if (rec.offKey) rec.offKey();
    rec.el.remove();
    delete overlays[id];
    if (!Object.keys(overlays).length) document.documentElement.style.overflow = '';
    if (!silent && rec.onClose) rec.onClose();
  };

  FR.isOverlayOpen = function (id) {
    return !!overlays[id];
  };

  /* =========================================================
     МОДАЛКА ПОДТВЕРЖДЕНИЯ (порт ConfirmationModal.tsx)
     ========================================================= */
  FR.confirm = function (opts) {
    opts = opts || {};
    var title = opts.title || 'Подтверждение';
    var message = opts.message || '';
    var confirmText = opts.confirmText || 'Подтвердить';
    var cancelText = opts.cancelText || 'Отмена';
    var type = opts.type || 'danger';
    var iconType = opts.iconType || 'warning';

    var iconName = {
      trash: 'trash-2', calendar: 'calendar', logout: 'log-out', warning: 'alert-triangle', info: 'info'
    }[iconType] || 'alert-triangle';

    var iconColor = {
      trash: 'text-rose-600 dark:text-rose-400',
      calendar: 'text-amber-600 dark:text-amber-400',
      logout: 'text-[#B87B40]',
      info: 'text-blue-600 dark:text-blue-400',
      warning: 'text-amber-600 dark:text-amber-400'
    }[iconType] || 'text-amber-600 dark:text-amber-400';

    var bg = {
      danger: 'bg-rose-100 dark:bg-rose-950/50 border-rose-200 dark:border-rose-900/60',
      warning: 'bg-amber-100 dark:bg-amber-950/50 border-amber-200 dark:border-amber-900/60',
      info: 'bg-[#EBE6DC] dark:bg-[#2A2825] border-[#CFC9C0] dark:border-[#444444]'
    }[type] || 'bg-amber-100 dark:bg-amber-950/50 border-amber-200 dark:border-amber-900/60';

    var btnStyle = type === 'danger'
      ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-xs'
      : type === 'warning'
        ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-xs'
        : 'bg-[#111111] hover:bg-[#222222] dark:bg-white dark:text-[#111111] text-white shadow-xs';

    var id = 'confirm-' + Math.random().toString(36).slice(2, 8);

    return new Promise(function (resolve) {
      var html =
        '<div class="relative w-full max-w-md bg-[#F8F6F1] dark:bg-[#1A1A1A] rounded-2xl p-6 border border-[#CFC9C0] dark:border-[#333333] shadow-2xl space-y-5">' +
          '<button data-cancel class="absolute top-4 right-4 p-1.5 text-[#554F47] dark:text-[#A0988E] hover:text-[#111111] dark:hover:text-white rounded-lg hover:bg-[#EBE6DC] dark:hover:bg-[#282624] transition-colors">' + FR.icon('x', 'w-5 h-5') + '</button>' +
          '<div class="flex items-start space-x-4">' +
            '<div class="p-3 rounded-xl border ' + bg + ' shrink-0">' + FR.icon(iconName, 'w-6 h-6 ' + iconColor) + '</div>' +
            '<div class="space-y-1 pr-6">' +
              '<h3 class="font-sans font-bold text-lg text-[#111111] dark:text-white leading-tight">' + FR.esc(title) + '</h3>' +
              '<div class="text-xs sm:text-sm text-[#4A443C] dark:text-[#CCCCCC] leading-relaxed pt-1">' + message + '</div>' +
            '</div>' +
          '</div>' +
          '<div class="flex items-center justify-end space-x-3 pt-2 border-t border-[#CFC9C0]/60 dark:border-[#333333]">' +
            '<button data-cancel class="px-4 py-2.5 bg-[#EBE6DC] dark:bg-[#282624] hover:bg-[#E0DAD0] dark:hover:bg-[#333333] text-[#111111] dark:text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all border border-[#CFC9C0] dark:border-[#444444]">' + FR.esc(cancelText) + '</button>' +
            '<button data-confirm class="px-5 py-2.5 text-xs font-extrabold uppercase tracking-wider rounded-xl transition-all flex items-center space-x-2 ' + btnStyle + '"><span>' + FR.esc(confirmText) + '</span></button>' +
          '</div>' +
        '</div>';

      var el = FR.openOverlay(id, html, { onClose: function () { resolve(false); } });

      function finish(value) {
        var rec = overlays[id];
        if (rec && rec.offKey) rec.offKey();
        var node = rec ? rec.el : null;
        delete overlays[id];
        if (node) node.remove();
        if (!Object.keys(overlays).length) document.documentElement.style.overflow = '';
        resolve(value);
      }

      el.querySelectorAll('[data-cancel]').forEach(function (b) {
        b.addEventListener('click', function () { finish(false); });
      });
      el.querySelector('[data-confirm]').addEventListener('click', function () { finish(true); });
    });
  };

  /** Блокировка кнопки подтверждения на время асинхронной операции. */
  FR.confirmBusy = function (overlay, busy, busyText) {
    if (!overlay) return;
    var btn = overlay.querySelector('[data-confirm]');
    if (!btn) return;
    btn.disabled = !!busy;
    if (busy) {
      btn.dataset.original = btn.dataset.original || btn.innerHTML;
      btn.innerHTML = '<span class="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"></span><span>' + FR.esc(busyText || 'Выполнение...') + '</span>';
    } else if (btn.dataset.original) {
      btn.innerHTML = btn.dataset.original;
    }
  };

  /* =========================================================
     ТЕМА
     ========================================================= */
  FR.applyTheme = function (dark) {
    document.documentElement.classList.toggle('dark', !!dark);
    try { localStorage.setItem('french_theme', dark ? 'dark' : 'light'); } catch (e) {}
    var btns = document.querySelectorAll('[data-theme-icon]');
    btns.forEach(function (b) { b.innerHTML = dark ? FR.icon('sun', 'w-4 h-4 text-rose-500') : FR.icon('moon', 'w-4 h-4 text-zinc-700'); });
  };

  FR.initTheme = function () {
    var dark = false;
    try { dark = localStorage.getItem('french_theme') === 'dark'; } catch (e) {}
    FR.applyTheme(dark);
  };

  FR.toggleTheme = function () {
    FR.applyTheme(!document.documentElement.classList.contains('dark'));
  };

  /* =========================================================
     ШАПКА: живые значения (баланс, непрочитанные)
     ========================================================= */
  FR.updateWallet = function (balance) {
    if (FR.state.user) FR.state.user.balance = FR.num(balance);
    var nodes = document.querySelectorAll('[data-wallet-amount]');
    nodes.forEach(function (n) { n.textContent = FR.money(balance) + ' ₽'; });
  };

  FR.updateUnread = function (count) {
    var badges = document.querySelectorAll('[data-unread-badge]');
    badges.forEach(function (b) {
      b.textContent = String(count);
      b.classList.toggle('hidden', !(count > 0));
    });
  };

  FR.unreadCount = function () {
    var u = FR.state.user;
    if (!u) return 0;
    return (FR.state.chats || []).reduce(function (acc, c) {
      return acc + FR.num(u.role === 'master' ? c.unreadCountMaster : c.unreadCountClient);
    }, 0);
  };

  /* =========================================================
     РАЗДЕЛЫ (регистрация и переключение)
     ========================================================= */
  FR.sections = {};

  /**
   * @param {string} name
   * @param {{render: function(HTMLElement), onEvent?: function(string, object)}} def
   */
  FR.registerSection = function (name, def) {
    FR.sections[name] = def;
  };

  FR.setActiveTab = function (tab) {
    document.documentElement.setAttribute('data-tab', tab);

    document.querySelectorAll('[data-tab-link]').forEach(function (btn) {
      var on = btn.getAttribute('data-tab-link') === tab;
      btn.classList.toggle('text-black', on);
      btn.classList.toggle('dark:text-white', on);
      btn.classList.toggle('font-extrabold', on);
      btn.classList.toggle('text-zinc-600', !on);
      btn.classList.toggle('dark:text-zinc-400', !on);

      var pill = btn.querySelector('[data-tab-pill]');
      if (pill) pill.classList.toggle('hidden', !on);

      var ic = btn.querySelector('svg');
      if (ic) {
        ic.classList.toggle('text-rose-600', on);
        ic.classList.toggle('dark:text-rose-500', on);
        ic.classList.toggle('text-zinc-500', !on);
      }
    });

    document.querySelectorAll('[data-tab-link-mobile]').forEach(function (btn) {
      var on = btn.getAttribute('data-tab-link-mobile') === tab;
      btn.classList.toggle('text-black', on);
      btn.classList.toggle('dark:text-white', on);
      btn.classList.toggle('font-black', on);
      btn.classList.toggle('text-zinc-500', !on);

      var ic = btn.querySelector('svg');
      if (ic) {
        ic.classList.toggle('text-rose-600', on);
        ic.classList.toggle('dark:text-rose-500', on);
        ic.classList.toggle('text-zinc-500', !on);
      }
    });
  };

  /** Карта скриптов разделов — для ленивой подгрузки, если модуль не зарегистрировался. */
  var SECTION_SCRIPTS = {
    feed: 'assets/js/sections/feed.js',
    search: 'assets/js/sections/search.js',
    posts: 'assets/js/sections/posts.js',
    chats: 'assets/js/sections/messaging.js',
    profile: 'assets/js/sections/profile.js',
    admin: 'assets/js/sections/admin.js'
  };
  var sectionLoading = {};

  function sectionFallback(tab) {
    return '<div class="max-w-md mx-auto my-16 text-center space-y-4">' +
      '<p class="text-sm font-bold text-zinc-600 dark:text-zinc-300">Раздел временно недоступен</p>' +
      '<p class="text-xs text-zinc-500 dark:text-zinc-400">Не удалось загрузить содержимое раздела. Попробуйте обновить страницу.</p>' +
      '<div class="flex items-center justify-center gap-2">' +
        '<button type="button" class="px-4 py-2 bg-black text-white dark:bg-white dark:text-black text-xs font-bold rounded-xl" onclick="location.reload()">Обновить</button>' +
        '<button type="button" class="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 text-xs font-bold rounded-xl" onclick="FR.go(\'feed\')">На главную</button>' +
      '</div>' +
    '</div>';
  }

  /** Подгрузить скрипт раздела, если он ещё не зарегистрирован. */
  FR.loadSection = function (tab) {
    if (FR.sections[tab]) return Promise.resolve();
    var src = SECTION_SCRIPTS[tab];
    if (!src || sectionLoading[tab]) return Promise.resolve();
    sectionLoading[tab] = true;
    return new Promise(function (resolve) {
      var s = document.createElement('script');
      s.src = '/' + src + '?v=' + Date.now();
      s.onload = function () { sectionLoading[tab] = false; resolve(); };
      s.onerror = function () { sectionLoading[tab] = false; resolve(); };
      document.head.appendChild(s);
    });
  };

  FR.mount = function (tab) {
    FR.state.tab = tab;
    FR.setActiveTab(tab);

    var root = document.getElementById('app-main');
    if (!root) return;
    root.innerHTML = '';

    var def = FR.sections[tab];
    if (def) {
      try {
        def.render(root);
      } catch (err) {
        console.error('Ошибка рендера раздела "' + tab + '":', err);
        root.innerHTML = sectionFallback(tab);
      }
      return;
    }

    // Раздел ещё не зарегистрирован — пробуем подгрузить его скрипт и повторить.
    root.innerHTML = '<div class="py-20 text-center text-sm text-zinc-500">Загружаем раздел...</div>';
    FR.loadSection(tab).then(function () {
      var loaded = FR.sections[tab];
      if (loaded) {
        try { loaded.render(root); }
        catch (err) { console.error(err); root.innerHTML = sectionFallback(tab); }
      } else {
        root.innerHTML = sectionFallback(tab);
      }
    });
  };

  FR.go = function (tab, push) {
    if (push !== false) {
      try { history.pushState({ tab: tab }, '', '/?tab=' + tab); } catch (e) {}
    }
    FR.mount(tab);
  };

  /* =========================================================
     ЗАГРУЗКА ДАННЫХ
     ========================================================= */
  FR.loadWorksAndPosts = function () {
    var uid = FR.state.user ? FR.state.user.id : null;
    return Promise.all([
      FR.api.getWorks(uid),
      FR.api.getPosts(uid)
    ]).then(function (res) {
      FR.state.works = res[0].works || [];
      FR.state.posts = res[1].posts || [];
      if (FR.state.user) {
        return FR.loadChats();
      }
    }).catch(function (e) {
      console.error('Error loading initial feed:', e);
    });
  };

  FR.loadChats = function () {
    if (!FR.state.user) return Promise.resolve();
    return FR.api.getChats(FR.state.user.id).then(function (res) {
      FR.state.chats = res.chats || [];
      FR.updateUnread(FR.unreadCount());
    }).catch(function (e) {
      console.error('Error loading chats:', e);
    });
  };

  FR.refresh = function () {
    return FR.loadWorksAndPosts().then(function () {
      FR.mount(FR.state.tab);
    });
  };

  /* =========================================================
     REALTIME: опрос очереди событий + опрос чатов
     ========================================================= */

  /** Открыта ли переписка с этим чатом прямо сейчас — её читают на экране. */
  FR.isConversationOpen = function (chatId) {
    return !document.hidden
      && FR.state.tab === 'chats'
      && !!chatId
      && String(FR.state.activeChatId) === String(chatId);
  };

  /** Имя собеседника в чате (для текста уведомления). */
  function chatPartnerName(chat) {
    var u = FR.state.user;
    return (u && u.role === 'master' ? chat.clientName : chat.masterName) || 'собеседник';
  }

  /**
   * Показать уведомление о входящем сообщении ровно один раз.
   * Событие realtime и опрос списка чатов могут сработать на одно и то же
   * сообщение — второй раз звук и тост не показываем.
   */
  var lastIncomingNotice = { key: '', at: 0 };
  function notifyIncoming(chatId, partnerName) {
    var key = chatId == null ? '' : String(chatId);
    var now = Date.now();
    if (key && lastIncomingNotice.key === key && (now - lastIncomingNotice.at) < 5000) return;
    lastIncomingNotice = { key: key, at: now };
    FR.playMessageSound();
    FR.toast('🔔 Новое сообщение от ' + partnerName);
  }

  FR.startRealtime = function () {
    // Опрос списка чатов (уведомления о новых сообщениях)
    if (FR.state.user) {
      setInterval(function () {
        if (document.hidden) return;
        var prev = {};
        (FR.state.chats || []).forEach(function (c) { prev[c.id] = c.lastMessageTime || ''; });

        FR.api.getChats(FR.state.user.id).then(function (res) {
          var chats = res.chats || [];
          var me = FR.state.user ? String(FR.state.user.id) : '';
          var fresh = null;
          chats.forEach(function (nc) {
            var old = prev[nc.id];
            var changed = old && nc.lastMessageTime && new Date(nc.lastMessageTime) > new Date(old);
            // Своё сообщение не уведомляем; открытую переписку тоже.
            var senderId = nc.lastMessageSenderId == null ? '' : String(nc.lastMessageSenderId);
            if (changed && senderId !== me && !FR.isConversationOpen(nc.id)) fresh = nc;
          });
          FR.state.chats = chats;
          FR.updateUnread(FR.unreadCount());
          if (fresh) notifyIncoming(fresh.id, chatPartnerName(fresh));
          var sec = FR.sections.chats;
          if (sec && sec.onChatsUpdated && FR.state.tab === 'chats') sec.onChatsUpdated();
        }).catch(function () { /* тихий опрос */ });
      }, 3000);
    }

    // Опрос очереди событий (лента, посты, записи, баланс)
    function poll() {
      if (document.hidden) { setTimeout(poll, 2000); return; }
      FR.api.get('/api/events/poll?since=' + FR.state.lastEventId + (FR.state.user ? '&userId=' + encodeURIComponent(FR.state.user.id) : ''))
        .then(function (res) {
          FR.state.lastEventId = res.lastId || FR.state.lastEventId;
          (res.events || []).forEach(function (ev) { handleEvent(ev); });
        })
        .catch(function () {})
        .then(function () { setTimeout(poll, 2500); });
    }
    setTimeout(poll, 1500);
  };

  function handleEvent(ev) {
    var type = ev.type;
    var payload = ev.payload || {};

    switch (type) {
      case 'NEW_CHAT_MESSAGE': {
        var own = !!(payload.message && FR.state.user
          && String(payload.message.senderId) === String(FR.state.user.id));
        // Своё сообщение не уведомляем; открытую переписку тоже (сообщение и так на экране).
        if (!own && !FR.isConversationOpen(payload.chat && payload.chat.id)) {
          var fromName = (payload.message && payload.message.senderName) || 'собеседник';
          notifyIncoming(payload.chat && payload.chat.id, fromName);
        }
        FR.loadChats().then(function () {
          var sec = FR.sections.chats;
          if (sec && sec.onChatsUpdated && FR.state.tab === 'chats') sec.onChatsUpdated();
        });
        break;
      }

      case 'NEW_BOOKING':
        FR.playMessageSound();
        FR.toast('🎉 Новая запись успешно создана!');
        FR.loadChats();
        break;

      case 'BALANCE_UPDATED':
        if (FR.state.user && payload.userId === FR.state.user.id && payload.balance !== undefined) {
          FR.updateWallet(payload.balance);
        }
        break;

      case 'WORK_ARCHIVED':
        FR.playMessageSound();
        FR.toast('🗂 Объявление' + (payload.title ? ' «' + payload.title + '»' : '') + ' снято в архив: не оплачено продление');
        break;
    }

    var sec = FR.sections[FR.state.tab];
    if (sec && sec.onEvent) sec.onEvent(type, payload);
  }

  FR.emitLocal = function (type, payload) {
    handleEvent({ type: type, payload: payload });
  };
})();
