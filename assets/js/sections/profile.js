/**
 * Раздел «Профиль» (порт ProfileSection.tsx на ванильный JS).
 * Табы: записи, личные данные; для мастера — объявления (подписка через ЮKassa),
 * статистика, рабочий календарь, услуги, портфолио.
 */
(function () {
  'use strict';
  var FR = window.FR;

  /* ------------------------------ Константы ------------------------------ */
  var DEFAULT_WORK_IMAGE = 'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=800&auto=format&fit=crop&q=80';
  var SERVICE_CATEGORIES = window.__SERVICE_CATEGORIES || [];
  var DAY_NAMES = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  var STATUSES = ['pending', 'confirmed', 'completed', 'canceled'];
  var PRESETS = [
    ['10:00', '12:00', '14:00', '16:00', '18:00', '20:00'],
    ['09:00', '10:30', '12:00', '13:30', '15:00', '16:30', '18:00', '19:30'],
    ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'],
    ['17:00', '18:30', '20:00', '21:30']
  ];

  /* ------------------------------ Состояние ------------------------------ */
  var rootEl = null;              // <main id="app-main">
  var activeTab = 'bookings';     // активный таб
  var bookings = [];
  var stats = null;
  var schedule = null;
  var services = [];
  var works = [];
  var statsPeriod = 'month';
  var editing = false;
  var scheduleNotice = null;
  var customSlot = '11:00';
  var listing = null;             // статус подписки на объявления (мастер)
  var subscriptions = [];         // история подписок мастера
  var listingPlan = 'single';     // выбранный тариф: single | pack
  var listingBusy = false;
  var listingReturnChecked = false;

  var form = { _userId: null, name: '', phone: '', email: '', avatar: '', district: '', bio: '', specialty: '' };
  var privacy = { hidePhone: false, hideEmail: true, allowDirectMessages: true };
  var newService = { title: '', category: '', price: '2500', duration: '60', description: '' };
  var newWork = { title: '', description: '', category: '', price: '', img: '' };
  var isCompressingAvatar = false;
  var isCompressingWork = false;

  var masterTabs = { listing: 1, stats: 1, calendar: 1, services: 1, portfolio: 1 };

  /* Поддержка (обращения пользователя) */
  var supportTickets = [];
  var supportActiveId = null;
  var supportThread = null;
  var supportLoading = false;
  var supportForm = { subject: '', text: '' };
  var supportReply = '';

  /* ------------------------------- Хелперы ------------------------------- */
  function isMaster() {
    var u = FR.state.user;
    return !!(u && u.role === 'master');
  }

  function notify(msg) {
    scheduleNotice = msg;
    paint();
    setTimeout(function () {
      if (scheduleNotice === msg) { scheduleNotice = null; paint(); }
    }, 3000);
  }

  /** Синхронизирует локальные поля формы с текущим пользователем. */
  function ensureInit(force) {
    var u = FR.state.user;
    if (!u) return;
    if (!force && form._userId === u.id) return;
    form = {
      _userId: u.id,
      name: u.name || '', phone: u.phone || '', email: u.email || '',
      avatar: u.avatar || '', district: u.district || '',
      bio: u.bio || '', specialty: u.specialty || ''
    };
    var ps = u.privacySettings || {};
    privacy = {
      hidePhone: !!ps.hidePhone,
      hideEmail: ps.hideEmail === undefined ? true : !!ps.hideEmail,
      allowDirectMessages: ps.allowDirectMessages === undefined ? true : !!ps.allowDirectMessages
    };
    if (!newService.category) newService.category = SERVICE_CATEGORIES[0] || 'Маникюр';
    if (!newWork.category) newWork.category = SERVICE_CATEGORIES[0] || 'Маникюр';
  }

  function bookingById(id) {
    for (var i = 0; i < bookings.length; i++) {
      if (String(bookings[i].id) === String(id)) return bookings[i];
    }
    return null;
  }

  function replaceBooking(booking) {
    if (!booking) return;
    for (var i = 0; i < bookings.length; i++) {
      if (String(bookings[i].id) === String(booking.id)) { bookings[i] = booking; return; }
    }
    bookings.unshift(booking);
  }

  /* --------------------------- Загрузка данных --------------------------- */
  function loadData() {
    var u = FR.state.user;
    if (!u) return Promise.resolve();
    return FR.api.getBookings(u.id, u.role).then(function (res) {
      bookings = (res && res.bookings) || [];
      if (!isMaster()) return null;
      return Promise.all([
        FR.api.getMasterStats(u.id, statsPeriod),
        FR.api.getMasterDetails(u.id),
        FR.api.getListingStatus(u.id),
        FR.api.getSubscriptions(u.id)
      ]).then(function (r) {
        stats = (r[0] && r[0].stats) || null;
        var d = r[1] || {};
        schedule = d.schedule || null;
        services = d.services || [];
        works = d.works || [];
        listing = (r[2] && r[2].listing) || null;
        subscriptions = (r[3] && r[3].subscriptions) || [];
      });
    }).catch(function (err) {
      console.error('Error loading profile data:', err);
    }).then(function () {
      if (rootEl && rootEl.isConnected) paint();
    });
  }

  /* ------------------------------ Рендер -------------------------------- */
  function render(root) {
    rootEl = root;
    if (!FR.state.user) { renderGuest(root); return; }
    paint();
    loadData();
    confirmListingReturn();
  }

  function paint() {
    if (!rootEl || !rootEl.isConnected) return;
    if (!FR.state.user) { renderGuest(rootEl); return; }
    ensureInit(false);
    stopListingTimer();
    rootEl.innerHTML = '<div class="max-w-6xl mx-auto space-y-6 pb-16">' +
      headerHtml() + tabsHtml() + contentHtml() +
    '</div>';
    rootEl.onclick = onClick;
    rootEl.onsubmit = onSubmit;
    rootEl.onchange = onChange;
    rootEl.oninput = onInput;
    if (activeTab === 'listing') startListingTimer();
  }

  function renderGuest(root) {
    root.innerHTML = '<div class="max-w-md mx-auto my-16 text-center space-y-4">' +
      '<p class="text-sm text-zinc-500">Войдите, чтобы просмотреть личный профиль.</p>' +
      '<button type="button" id="profile-auth-btn" class="px-5 py-3 bg-black dark:bg-white text-white dark:text-black text-xs font-extrabold uppercase tracking-widest rounded-xl">Войти</button>' +
    '</div>';
    var btn = root.querySelector('#profile-auth-btn');
    if (btn) btn.addEventListener('click', function () { if (FR.openAuth) FR.openAuth(); });
  }

  /* --------------------------- Шапка профиля ---------------------------- */
  function headerHtml() {
    var u = FR.state.user, master = isMaster();
    return '<div class="bg-white dark:bg-[#1A1A1A] p-6 sm:p-8 rounded-xl border border-[#CFC9C0] dark:border-[#333333] shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-6">' +
      '<div class="flex items-center space-x-5">' +
        '<div class="relative">' +
          '<img src="' + FR.esc(FR.avatarSrc(u.avatar)) + '"' + FR.onerror('avatar') + ' alt="' + FR.esc(u.name) + '" class="w-20 h-20 sm:w-24 sm:h-24 rounded-xl object-cover ring-1 ring-[#CFC9C0] shadow-xs" />' +
          (master ? '<span class="absolute -bottom-1 -right-1 bg-[#111111] text-[#B87B40] p-1.5 rounded-md shadow-xs border border-[#333333]">' + FR.icon('scissors', 'w-3.5 h-3.5') + '</span>' : '') +
        '</div>' +
        '<div class="space-y-1">' +
          '<div class="flex items-center space-x-2">' +
            '<h1 class="font-sans font-extrabold text-2xl text-[#111111] dark:text-white">' + FR.esc(u.name) + '</h1>' +
            '<span class="bg-[#EBE6DC] text-[#4A443C] text-[10px] uppercase tracking-widest font-extrabold px-2.5 py-0.5 rounded-md border border-[#CFC9C0]">' + (master ? 'Бьюти-мастер' : 'Клиент') + '</span>' +
          '</div>' +
          '<div class="flex items-center space-x-3 text-xs text-[#8C8376]">' +
            '<span class="flex items-center">' + FR.icon('phone', 'w-3.5 h-3.5 mr-1 text-[#8C8376]') + ' ' + FR.esc(u.phone) + '</span>' +
            '<span>•</span>' +
            '<span class="flex items-center">' + FR.icon('map-pin', 'w-3.5 h-3.5 mr-1 text-[#D4A373]') + ' ' + FR.esc(u.district) + ' (' + FR.esc(u.city) + ')</span>' +
          '</div>' +
          (master ? '<div class="flex items-center space-x-2 text-xs font-semibold text-[#1A1A1A] dark:text-white pt-1">' +
            FR.icon('star', 'w-3.5 h-3.5 fill-[#D4A373] text-[#D4A373]') +
            '<span>' + FR.num(u.rating || 5) + ' (' + FR.num(u.reviewCount) + ' отзывов)</span>' +
            '<span class="text-[#8C8376] font-normal">• Специализация: ' + FR.esc(u.specialty || '') + '</span>' +
          '</div>' : '') +
        '</div>' +
      '</div>' +
      '<div class="flex items-center space-x-3">' +
        '<button type="button" data-action="privacy-open" class="px-4 py-2 bg-[#F1EDE4] hover:bg-[#E5E1DA] text-[#1A1A1A] dark:text-white text-xs font-medium rounded-lg border border-[#E5E1DA] dark:border-[#333333] transition-colors flex items-center space-x-1.5">' +
          FR.icon('shield', 'w-3.5 h-3.5 text-[#D4A373]') + '<span>Конфиденциальность</span>' +
        '</button>' +
        '<button type="button" data-action="toggle-edit" class="px-4 py-2 bg-[#1A1A1A] hover:bg-[#2D2926] text-white text-xs font-medium rounded-lg transition-colors flex items-center space-x-1.5">' +
          FR.icon('edit-3', 'w-3.5 h-3.5 text-[#D4A373]') + '<span>' + (editing ? 'Отмена' : 'Редактировать профиль') + '</span>' +
        '</button>' +
      '</div>' +
    '</div>';
  }

  /* ------------------------------- Табы --------------------------------- */
  function tabsHtml() {
    var master = isMaster();
    var tabs = [];
    if (master) {
      tabs.push({ id: 'listing', label: 'Объявления & Оплата', icon: 'credit-card' });
    }
    tabs.push({ id: 'bookings', label: master ? 'Записи клиентов' : 'Мои записи', icon: 'calendar' });
    tabs.push({ id: 'details', label: 'Данные аккаунта', icon: 'user' });
    if (master) {
      tabs.push({ id: 'stats', label: 'Статистика', icon: 'bar-chart-3' });
      tabs.push({ id: 'calendar', label: 'Рабочий календарь', icon: 'clock' });
      tabs.push({ id: 'services', label: 'Услуги', icon: 'scissors' });
      tabs.push({ id: 'portfolio', label: 'Портфолио', icon: 'plus' });
    }
    tabs.push({ id: 'support', label: 'Поддержка', icon: 'message-circle' });
    return '<div class="flex border-b border-[#E5E1DA] dark:border-zinc-800 overflow-x-auto bg-white dark:bg-[#1A1A1A] rounded-xl px-4 no-scrollbar shadow-2xs">' +
      tabs.map(function (t) {
        var on = activeTab === t.id;
        return '<button type="button" data-action="tab" data-tab="' + t.id + '" class="flex items-center space-x-2 px-5 py-3.5 text-xs font-bold border-b-2 transition-colors whitespace-nowrap ' +
          (on ? 'border-rose-600 text-rose-600 dark:text-rose-400' : 'border-transparent text-zinc-500 hover:text-black dark:hover:text-white') + '">' +
          FR.icon(t.icon, 'w-4 h-4') + '<span>' + FR.esc(t.label) + '</span></button>';
      }).join('') +
    '</div>';
  }

  /* ---------------------------- Контент таба ---------------------------- */
  function contentHtml() {
    if (masterTabs[activeTab] && !isMaster()) activeTab = 'bookings';
    switch (activeTab) {
      case 'listing': return listingHtml();
      case 'bookings': return bookingsHtml();
      case 'details': return detailsHtml();
      case 'stats': return statsHtml();
      case 'calendar': return calendarHtml();
      case 'services': return servicesHtml();
      case 'portfolio': return portfolioHtml();
      case 'support': return supportHtml();
    }
    return '';
  }

  /* ------------------------------ Таб details --------------------------- */
  function fieldHtml(label, type, name, value) {
    return '<div>' +
      '<label class="block text-[10px] uppercase tracking-[0.2em] font-medium text-[#8C8376] mb-1">' + FR.esc(label) + '</label>' +
      '<input type="' + type + '" data-field="' + name + '" value="' + FR.esc(value) + '"' + (editing ? '' : ' disabled') +
        ' class="w-full px-4 py-2.5 bg-[#FBF9F6] dark:bg-[#222222] border border-[#E5E1DA] dark:border-[#333333] rounded-lg text-xs text-[#1A1A1A] dark:text-white disabled:opacity-70 focus:bg-white dark:focus:bg-[#2A2A2A] focus:outline-none focus:border-[#D4A373]" />' +
    '</div>';
  }

  function avatarFieldHtml() {
    var body;
    if (editing) {
      body = '<div class="space-y-2">' +
        '<label class="flex-1 px-3 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-lg text-xs font-semibold cursor-pointer flex items-center justify-center gap-1.5 transition-colors">' +
          FR.icon('camera', 'w-3.5 h-3.5') +
          '<span>' + (isCompressingAvatar ? 'Сжатие...' : 'Загрузить фото с устройства') + '</span>' +
          '<input type="file" accept="image/*" data-file="avatar" class="hidden" />' +
        '</label>' +
        '<input type="url" data-field="avatar" value="' + FR.esc(form.avatar) + '" placeholder="или вставьте прямую ссылку (URL)" class="w-full px-3 py-2 bg-[#FBF9F6] dark:bg-[#222222] border border-[#E5E1DA] dark:border-[#333333] rounded-lg text-xs text-[#1A1A1A] dark:text-white focus:outline-none focus:border-[#D4A373]" />' +
      '</div>';
    } else {
      body = '<div class="flex items-center gap-3 p-2 bg-[#FBF9F6] dark:bg-[#222222] border border-[#E5E1DA] dark:border-[#333333] rounded-lg">' +
        '<img src="' + FR.esc(FR.avatarSrc(form.avatar)) + '"' + FR.onerror('avatar') + ' alt="Avatar" class="w-8 h-8 rounded-full object-cover" />' +
        '<span class="text-xs text-[#8C8376] dark:text-zinc-400 truncate">' + (form.avatar ? 'Фото установлено' : 'Стандартный силуэт') + '</span>' +
      '</div>';
    }
    return '<div><label class="block text-[10px] uppercase tracking-[0.2em] font-medium text-[#8C8376] mb-1">Аватар профиля</label>' + body + '</div>';
  }

  function detailsHtml() {
    var master = isMaster();
    return '<form data-form="profile" class="bg-white dark:bg-[#1A1A1A] p-6 sm:p-8 rounded-xl border border-[#E5E1DA] dark:border-zinc-800 shadow-2xs space-y-6">' +
      '<h2 class="font-serif italic font-light text-xl text-[#1A1A1A] dark:text-white border-b border-[#E5E1DA] dark:border-zinc-800 pb-3">Личные данные & Пароль</h2>' +
      '<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">' +
        fieldHtml('ФИО / Имя', 'text', 'name', form.name) +
        fieldHtml('Номер телефона', 'text', 'phone', form.phone) +
        fieldHtml('Email почта', 'email', 'email', form.email) +
        '<div><label class="block text-[10px] uppercase tracking-[0.2em] font-medium text-[#8C8376] mb-1">Пароль</label>' +
          '<input type="password" disabled value="••••••••" class="w-full px-4 py-2.5 bg-[#FBF9F6] dark:bg-[#222222] border border-[#E5E1DA] dark:border-[#333333] rounded-lg text-xs text-[#1A1A1A] dark:text-white disabled:opacity-70 focus:outline-none" />' +
        '</div>' +
        fieldHtml('Район города', 'text', 'district', form.district) +
        avatarFieldHtml() +
      '</div>' +
      (master ? '<div class="space-y-4 pt-2">' +
        fieldHtml('Специализация мастера', 'text', 'specialty', form.specialty) +
        '<div><label class="block text-[10px] uppercase tracking-[0.2em] font-medium text-[#8C8376] mb-1">О себе / Биография</label>' +
          '<textarea rows="3" data-field="bio"' + (editing ? '' : ' disabled') + ' class="w-full px-4 py-2.5 bg-[#FBF9F6] dark:bg-[#222222] border border-[#E5E1DA] dark:border-[#333333] rounded-lg text-xs text-[#1A1A1A] dark:text-white disabled:opacity-70 focus:bg-white dark:focus:bg-[#2A2A2A] focus:outline-none focus:border-[#D4A373]">' + FR.esc(form.bio) + '</textarea>' +
        '</div>' +
      '</div>' : '') +
      (editing ? '<button type="submit" class="px-6 py-3 bg-[#1A1A1A] hover:bg-[#2D2926] text-white font-medium text-[10px] uppercase tracking-widest rounded-lg shadow-2xs transition-all flex items-center space-x-2">' +
        FR.icon('save', 'w-3.5 h-3.5 text-[#D4A373]') + '<span>Сохранить изменения</span>' +
      '</button>' : '') +
    '</form>';
  }

  /* --------------------------- Обработчики ------------------------------ */
  function onClick(e) {
    var t = e.target;
    var elm = t && t.closest ? t.closest('[data-action]') : null;
    if (!elm || !rootEl.contains(elm)) return;
    var action = elm.getAttribute('data-action');
    switch (action) {
      case 'tab': setTab(elm.getAttribute('data-tab')); break;
      case 'privacy-open': openPrivacyModal(); break;
      case 'toggle-edit': editing = !editing; if (editing) activeTab = 'details'; paint(); break;
      case 'listing-plan': listingPlan = elm.getAttribute('data-plan') === 'pack' ? 'pack' : 'single'; paint(); break;
      case 'listing-pay': startListingPayment(); break;
      case 'go-listing': activeTab = 'listing'; paint(); break;
      case 'review': openReview(elm.getAttribute('data-booking-id')); break;
      case 'confirm-booking': changeStatus(elm.getAttribute('data-booking-id'), 'confirmed'); break;
      case 'cancel-booking': confirmCancel(elm.getAttribute('data-booking-id')); break;
      case 'chat': openBookingChat(elm.getAttribute('data-booking-id')); break;
      case 'toggle-day': toggleWorkingDay(parseInt(elm.getAttribute('data-day'), 10)); break;
      case 'remove-slot': removeTimeSlot(elm.getAttribute('data-slot')); break;
      case 'add-slot': addTimeSlot(customSlot); break;
      case 'preset': applyPreset(parseInt(elm.getAttribute('data-preset'), 10)); break;
      case 'stats-period': changeStatsPeriod(elm.getAttribute('data-period')); break;
      case 'delete-service': confirmDeleteService(elm.getAttribute('data-service-id')); break;
      case 'remove-work-image': newWork.img = ''; paint(); break;
      case 'delete-work': confirmDeleteWork(elm.getAttribute('data-work-id')); break;
      case 'support-open': openSupportTicket(elm.getAttribute('data-ticket-id')); break;
      case 'support-close': supportActiveId = null; supportThread = null; supportReply = ''; paint(); break;
      case 'support-create': createSupportTicket(); break;
      case 'support-send': sendSupportReply(); break;
    }
  }

  function setTab(tab) {
    if (masterTabs[tab] && !isMaster()) tab = 'bookings';
    activeTab = tab || 'bookings';
    if (activeTab === 'support') loadSupport();
    paint();
  }

  function onSubmit(e) {
    var f = e.target;
    if (!f || !f.getAttribute) return;
    var which = f.getAttribute('data-form');
    if (!which) return;
    e.preventDefault();
    if (which === 'profile') saveProfile();
    else if (which === 'service') addService();
    else if (which === 'work') addWork();
  }

  function onChange(e) {
    var t = e.target;
    if (!t || !t.getAttribute) return;
    var file = t.getAttribute('data-file');
    if (file === 'avatar') { handleAvatarFile(t); return; }
    if (file === 'work') { handleWorkFile(t); return; }
    var statusId = t.getAttribute('data-booking-status');
    if (statusId) { changeStatus(statusId, t.value); return; }
    var f = t.getAttribute('data-field');
    if (f === 'svc-category') newService.category = t.value;
    else if (f === 'work-category') newWork.category = t.value;
  }

  function onInput(e) {
    var t = e.target;
    if (!t || !t.getAttribute) return;
    var f = t.getAttribute('data-field');
    if (!f) return;
    if (f === 'name' || f === 'phone' || f === 'email' || f === 'district' || f === 'specialty' || f === 'bio' || f === 'avatar') form[f] = t.value;
    else if (f === 'svc-title') newService.title = t.value;
    else if (f === 'svc-price') newService.price = t.value;
    else if (f === 'svc-duration') newService.duration = t.value;
    else if (f === 'svc-desc') newService.description = t.value;
    else if (f === 'work-title') newWork.title = t.value;
    else if (f === 'work-desc') newWork.description = t.value;
    else if (f === 'work-price') newWork.price = t.value;
    else if (f === 'work-url') newWork.img = t.value;
    else if (f === 'custom-slot') customSlot = t.value;
    else if (f === 'support-subject') supportForm.subject = t.value;
    else if (f === 'support-text') supportForm.text = t.value;
    else if (f === 'support-reply') supportReply = t.value;
  }

  /* --------------------------- Загрузка фото ---------------------------- */
  function handleAvatarFile(input) {
    var file = input.files && input.files[0];
    if (!file) return;
    isCompressingAvatar = true; paint();
    FR.compressImage(file, { maxWidth: 600, maxHeight: 600, quality: 0.85 }).then(function (url) {
      form.avatar = url;
    }).catch(function (err) {
      FR.toast('Ошибка обработки фото аватарки: ' + ((err && err.message) || err));
    }).then(function () {
      isCompressingAvatar = false;
      if (input) input.value = '';
      paint();
    });
  }

  function handleWorkFile(input) {
    var file = input.files && input.files[0];
    if (!file) return;
    isCompressingWork = true; paint();
    FR.compressImage(file, { maxWidth: 1200, maxHeight: 1200, quality: 0.85 }).then(function (url) {
      newWork.img = url;
    }).catch(function (err) {
      FR.toast('Ошибка обработки фото работы: ' + ((err && err.message) || err));
    }).then(function () {
      isCompressingWork = false;
      if (input) input.value = '';
      paint();
    });
  }

  /* ------------------------------ События ------------------------------- */
  function onEvent(type) {
    if (type === 'BOOKING_STATUS_CHANGED' || type === 'NEW_BOOKING' || type === 'WORK_ADDED' || type === 'WORK_DELETED' || type === 'LISTING_UPDATED' || type === 'WORK_ARCHIVED') {
      if (rootEl && rootEl.isConnected) loadData();
    }
  }

  /* ---------------------------- Таб listing ----------------------------- */
  function fmtUntil(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  /* Обратный отсчёт до окончания размещения (следующего продления/списания). */
  var listingTick = null;

  function listingTargetDate() {
    if (!listing) return null;
    var iso = listing.freeUntil || (listing.subscription && listing.subscription.paidUntil) || null;
    if (!iso) return null;
    var d = new Date(iso);
    return isNaN(d.getTime()) ? null : d;
  }

  function countdownParts(d) {
    var ms = d.getTime() - Date.now();
    if (ms < 0) ms = 0;
    var totalMin = Math.floor(ms / 60000);
    return {
      ms:        ms,
      days:      Math.floor(totalMin / 1440),
      hours:     Math.floor((totalMin % 1440) / 60),
      minutes:   totalMin % 60
    };
  }

  function countdownText(d) {
    var p = countdownParts(d);
    if (p.days > 0) return p.days + ' дн ' + p.hours + ' ч';
    if (p.hours > 0) return p.hours + ' ч ' + p.minutes + ' мин';
    return p.minutes + ' мин';
  }

  function stopListingTimer() {
    if (listingTick) { clearInterval(listingTick); listingTick = null; }
  }

  function startListingTimer() {
    stopListingTimer();
    var el = rootEl && rootEl.querySelector('[data-listing-countdown]');
    if (!el) return;
    listingTick = setInterval(function () {
      var target = listingTargetDate();
      if (!target || !el.isConnected) { stopListingTimer(); return; }
      el.textContent = 'Осталось: ' + countdownText(target);
    }, 30000);
  }

  function listingCountdownHtml() {
    var target = listingTargetDate();
    if (!target) return '';
    var p = countdownParts(target);
    var urgent = p.ms < 7 * 86400000;   // меньше недели — предупреждаем
    var expired = p.ms <= 0;
    var cls = expired || urgent
      ? 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
      : 'bg-sky-500/10 border-sky-500/30 text-sky-700 dark:text-sky-300';
    var label = listing && listing.freeUntil ? 'Бесплатное размещение действует до ' : 'Размещение оплачено до ';
    var hint = expired
      ? 'Срок истёк — объявления снимаются в архив. Продлите размещение.'
      : 'После этой даты объявления без оплаты автоматически уходят в архив.';
    return '<div class="p-4 rounded-xl border ' + cls + ' flex flex-col sm:flex-row sm:items-center justify-between gap-3">' +
      '<div class="flex items-start gap-2.5">' + FR.icon('timer', 'w-5 h-5 shrink-0 mt-0.5') +
        '<div>' +
          '<p class="text-sm font-bold" data-listing-countdown>Осталось: ' + FR.esc(countdownText(target)) + '</p>' +
          '<p class="text-[10px] opacity-80 mt-0.5">' + FR.esc(label) + FR.esc(fmtUntil(target.toISOString())) + '. ' + FR.esc(hint) + '</p>' +
        '</div>' +
      '</div>' +
      '<button type="button" data-action="go-listing" class="shrink-0 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold uppercase tracking-widest">Продлить</button>' +
    '</div>';
  }

  function subscriptionStatusHtml() {
    if (!listing) return '';
    if (listing.freeUntil) {
      return '<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 text-[11px] font-bold">' +
        FR.icon('badge-check', 'w-3.5 h-3.5') + 'Бесплатно до ' + FR.esc(fmtUntil(listing.freeUntil)) + '</span>';
    }
    var sub = listing.subscription;
    if (sub && sub.paidUntil) {
      return '<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/30 text-[11px] font-bold">' +
        FR.icon('check-circle-2', 'w-3.5 h-3.5') + 'Подписка до ' + FR.esc(fmtUntil(sub.paidUntil)) + '</span>';
    }
    return '<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 text-[11px] font-bold">' +
      FR.icon('info', 'w-3.5 h-3.5') + 'Подписки нет</span>';
  }

  function planCardHtml(id, title, price, note, selected) {
    return '<button type="button" data-action="listing-plan" data-plan="' + id + '" class="text-left p-5 rounded-xl border-2 transition-all ' +
      (selected ? 'border-rose-600 bg-rose-500/5 shadow-md' : 'border-zinc-200 dark:border-zinc-800 hover:border-rose-400') + '">' +
      '<div class="flex items-center justify-between">' +
        '<span class="text-sm font-bold text-black dark:text-white">' + FR.esc(title) + '</span>' +
        '<span class="w-4 h-4 rounded-full border-2 ' + (selected ? 'border-rose-600 bg-rose-600' : 'border-zinc-300 dark:border-zinc-600') + '"></span>' +
      '</div>' +
      '<p class="text-2xl font-extrabold font-mono text-black dark:text-white mt-2">' + FR.money(price) + ' ₽</p>' +
      '<p class="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">' + FR.esc(note) + '</p>' +
    '</button>';
  }

  function listingHtml() {
    if (!isMaster()) return bookingsHtml();
    var paymentsEnabled = listing ? listing.paymentsEnabled : true;
    var singlePrice = listing ? listing.singlePrice : 100;
    var packPrice = listing ? listing.packPrice : 300;
    var packSize = listing ? listing.packSize : 6;
    var slotsLeft = listing ? listing.slotsLeft : null;
    var sub = listing ? listing.subscription : null;

    var slotsLine;
    if (listing && listing.freeUntil) {
      slotsLine = 'В период бесплатного размещения объявления публикуются без списания слотов.';
    } else if (slotsLeft !== null && slotsLeft !== undefined) {
      slotsLine = 'Свободных слотов в подписке: <b>' + slotsLeft + '</b>' + (sub ? ' из ' + sub.slotsTotal : '') + '.';
    } else {
      slotsLine = 'Оформите подписку, чтобы публиковать объявления в ленте.';
    }

    var historyHtml = subscriptions.length
      ? '<div class="space-y-2">' + subscriptions.map(function (s) {
          var label = s.plan === 'pack' ? 'Пакет до ' + s.slotsTotal + ' объявлений' : 'Одно объявление';
          var st = s.status === 'active' ? 'Активна' : (s.status === 'canceled' ? 'Отменена' : 'Ожидает оплаты');
          return '<div class="p-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 flex items-center justify-between gap-3 text-xs">' +
            '<div>' +
              '<p class="font-bold text-black dark:text-white">' + FR.esc(label) + '</p>' +
              '<p class="text-[10px] text-zinc-500 mt-0.5">' + FR.fmtDateTime(s.createdAt) + (s.paidUntil ? ' • до ' + FR.esc(fmtUntil(s.paidUntil)) : '') + '</p>' +
            '</div>' +
            '<div class="text-right">' +
              '<span class="font-mono font-bold text-black dark:text-white">' + FR.money(s.amount) + ' ₽</span>' +
              '<p class="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">' + FR.esc(st) + '</p>' +
            '</div>' +
          '</div>';
        }).join('') + '</div>'
      : '<p class="text-center py-8 text-xs text-zinc-500">Оплат за объявления пока не было.</p>';

    var plansHtml;
    if (paymentsEnabled) {
      plansHtml = '<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">' +
          planCardHtml('single', 'Одно объявление', singlePrice, 'Помесячная оплата за 1 объявление в ленте', listingPlan === 'single') +
          planCardHtml('pack', 'Пакет до ' + packSize + ' объявлений', packPrice, 'Выгоднее: до ' + packSize + ' объявлений вместо ' + FR.money(singlePrice * packSize) + ' ₽', listingPlan === 'pack') +
        '</div>' +
        '<button type="button" data-action="listing-pay"' + (listingBusy ? ' disabled' : '') + ' class="w-full py-3.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-60 text-white font-bold text-xs uppercase tracking-widest rounded-xl shadow-lg transition-all flex items-center justify-center gap-2">' +
          FR.icon('credit-card', 'w-4 h-4') + '<span>' + (listingBusy ? 'Переход к оплате...' : 'Оплатить через ЮKassa') + '</span>' +
        '</button>' +
        '<p class="text-[11px] text-zinc-500 text-center">Оплата проходит на защищённой странице ЮKassa. Срок действия — 1 месяц. Для публикации ещё одного объявления оформите подписку повторно.</p>';
    } else {
      plansHtml = '<div class="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-700 dark:text-emerald-300 flex items-start gap-2">' +
        FR.icon('info', 'w-4 h-4 shrink-0 mt-0.5') + '<span>Оплата за объявления временно отключена администратором — публикация работ в ленте бесплатна.</span></div>';
    }

    return '<div class="space-y-6">' +
      '<div class="bg-white dark:bg-[#1A1A1A] p-6 sm:p-8 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-2xs space-y-4">' +
        '<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800 pb-4">' +
          '<div>' +
            '<h2 class="font-bold text-xl text-black dark:text-white flex items-center gap-2">' + FR.icon('credit-card', 'w-5 h-5 text-rose-500') + 'Объявления в ленте</h2>' +
            '<p class="text-xs text-zinc-500 mt-0.5">' + slotsLine + '</p>' +
          '</div>' +
          subscriptionStatusHtml() +
        '</div>' +
        listingCountdownHtml() +
        plansHtml +
      '</div>' +
      '<div class="bg-white dark:bg-[#1A1A1A] p-6 sm:p-8 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-2xs space-y-4">' +
        '<h3 class="font-bold text-lg text-black dark:text-white border-b border-zinc-200 dark:border-zinc-800 pb-3 flex items-center gap-2">' + FR.icon('refresh-cw', 'w-4 h-4 text-rose-500') + 'История оплат</h3>' +
        historyHtml +
      '</div>' +
    '</div>';
  }

  /** Запуск оплаты подписки: создаёт платёж и переносит на страницу ЮKassa. */
  function startListingPayment() {
    var u = FR.state.user;
    if (!u || listingBusy) return;
    listingBusy = true;
    paint();
    FR.api.payListing(u.id, listingPlan).then(function (res) {
      if (res && res.confirmationUrl) {
        window.location.href = res.confirmationUrl;
        return;
      }
      listingBusy = false;
      paint();
      FR.toast('Не удалось получить ссылку на оплату');
    }).catch(function (err) {
      listingBusy = false;
      paint();
      FR.toast((err && err.message) || 'Ошибка создания платежа');
    });
  }

  /** Подтвердить оплату после возврата со страницы ЮKassa. */
  function confirmListingReturn() {
    if (listingReturnChecked) return;
    var params = new URLSearchParams(window.location.search);
    if (params.get('payment') !== 'return') return;
    listingReturnChecked = true;
    var subId = params.get('sub');
    try { history.replaceState({ tab: 'profile' }, '', '/?tab=profile'); } catch (e) {}
    if (!subId) { loadData(); return; }
    FR.api.confirmListing(subId).then(function (res) {
      if (res && res.listing) listing = res.listing;
      if (res && res.paymentStatus === 'succeeded') FR.toast('Подписка активирована');
      else if (res && res.paymentStatus === 'canceled') FR.toast('Оплата отменена');
      loadData();
    }).catch(function () { loadData(); });
  }

  /* ----------------------------- Таб bookings --------------------------- */
  function bookingBadgeHtml(b, isConfirmed, isCompleted, isCanceled) {
    var cls = isCompleted
      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
      : isCanceled
        ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30'
        : isConfirmed
          ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30'
          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30';
    var text = isCompleted ? '✓ Завершено' : isCanceled ? '✕ Отменено' : isConfirmed ? '✓ Подтверждено' : '⏳ Ожидает подтверждения';
    return '<span class="px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ' + cls + '">' + text + '</span>';
  }

  function bookingCardHtml(b) {
    var master = isMaster();
    var isConfirmed = b.status === 'confirmed';
    var isCompleted = b.status === 'completed';
    var isCanceled = b.status === 'canceled';
    var isPending = b.status === 'pending';

    var cardCls = isCompleted
      ? 'bg-emerald-50/40 dark:bg-emerald-950/10 border-emerald-200 dark:border-emerald-900/40'
      : isCanceled
        ? 'bg-zinc-50 dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-800 opacity-80'
        : 'bg-zinc-50 dark:bg-zinc-900/80 border-zinc-200 dark:border-zinc-800';

    var actions = [];
    actions.push('<button type="button" data-action="chat" data-booking-id="' + FR.esc(b.id) + '" class="px-3 py-1.5 bg-[#1A1A1A] dark:bg-white text-white dark:text-black hover:opacity-90 text-xs font-bold rounded-lg transition-colors flex items-center gap-1">' +
      FR.icon('message-circle', 'w-3.5 h-3.5') + '<span>Чат</span></button>');
    if (master && isPending) {
      actions.push('<button type="button" data-action="confirm-booking" data-booking-id="' + FR.esc(b.id) + '" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors">Подтвердить</button>');
    }
    if ((isConfirmed || isPending) && !isCanceled) {
      actions.push('<button type="button" data-action="cancel-booking" data-booking-id="' + FR.esc(b.id) + '" class="px-3 py-1.5 bg-rose-600/10 hover:bg-rose-600 text-rose-600 hover:text-white text-xs font-bold rounded-lg border border-rose-600/30 transition-colors">Отменить</button>');
    }
    if (isCompleted) {
      actions.push('<button type="button" data-action="review" data-booking-id="' + FR.esc(b.id) + '" class="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl transition-all flex items-center space-x-1">' +
        FR.icon('star', 'w-3.5 h-3.5 fill-white') + '<span>' + (master ? 'Оценить клиента' : 'Оставить отзыв') + '</span></button>');
    }

    var statusSelect = master
      ? '<select data-booking-status data-booking-id="' + FR.esc(b.id) + '" class="text-[10px] font-bold uppercase tracking-wider bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg px-2 py-1 text-black dark:text-white">' +
          STATUSES.map(function (s) { return '<option value="' + s + '"' + (b.status === s ? ' selected' : '') + '>' + s + '</option>'; }).join('') +
        '</select>'
      : '';

    return '<div class="p-5 rounded-xl border transition-all ' + cardCls + ' flex flex-col gap-4">' +
      '<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">' +
        '<div class="flex items-start space-x-4">' +
          '<img src="' + FR.esc(FR.avatarSrc(master ? b.clientAvatar : b.masterAvatar)) + '"' + FR.onerror('avatar') + ' alt="Avatar" class="w-12 h-12 rounded-xl object-cover ring-2 ring-rose-600/30 shrink-0" />' +
          '<div>' +
            '<h4 class="font-bold text-sm text-black dark:text-white">' + FR.esc(b.serviceTitle) + '</h4>' +
            '<p class="text-xs font-bold text-rose-600 dark:text-rose-400 mt-0.5">' + (master ? 'Клиент: ' + FR.esc(b.clientName) + ' (' + FR.esc(b.clientPhone) + ')' : 'Мастер: ' + FR.esc(b.masterName)) + '</p>' +
            '<div class="flex items-center space-x-2 text-xs text-zinc-500 dark:text-zinc-400 mt-1 flex-wrap">' +
              '<span class="flex items-center">' + FR.icon('calendar', 'w-3.5 h-3.5 mr-1 text-rose-500') + ' ' + FR.esc(b.date) + ' в ' + FR.esc(b.timeSlot) + '</span>' +
              '<span>•</span>' +
              '<span class="font-bold text-black dark:text-white font-mono">' + FR.money(b.servicePrice) + ' ₽</span>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="flex flex-col sm:items-end space-y-2 shrink-0">' +
          bookingBadgeHtml(b, isConfirmed, isCompleted, isCanceled) +
          statusSelect +
          '<div class="flex flex-wrap gap-2 justify-end">' + actions.join('') + '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function bookingsHtml() {
    var master = isMaster();
    var list = bookings.length
      ? '<div class="space-y-4">' + bookings.map(bookingCardHtml).join('') + '</div>'
      : '<p class="text-center py-12 text-xs text-zinc-500">У вас пока нет активных записей.</p>';

    return '<div class="bg-white dark:bg-[#1A1A1A] p-6 sm:p-8 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-2xs space-y-4">' +
      '<div class="border-b border-zinc-200 dark:border-zinc-800 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">' +
        '<div>' +
          '<h2 class="font-bold text-xl text-black dark:text-white">' + (master ? 'Управление записями клиентов' : 'Ваши записи на услуги') + '</h2>' +
          '<p class="text-xs text-zinc-500 font-medium mt-0.5">' + (master ? 'Подтверждайте записи и общайтесь с клиентами в чате' : 'Записи к мастерам и общение в чате — бесплатно') + '</p>' +
        '</div>' +
        '<span class="text-xs text-rose-600 font-bold bg-rose-50 dark:bg-rose-950/30 px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900 self-start sm:self-auto">Записей: ' + bookings.length + '</span>' +
      '</div>' +
      list +
    '</div>';
  }

  /* ------------------------------ Таб stats ----------------------------- */
  function statsHtml() {
    if (!stats) {
      return '<div class="bg-white dark:bg-[#1A1A1A] p-8 rounded-xl border border-[#E5E1DA] dark:border-zinc-800 shadow-2xs text-center text-xs text-[#8C8376] py-12">Загрузка статистики...</div>';
    }
    var periods = [
      { id: 'week', label: 'Неделя' }, { id: 'month', label: 'Месяц' },
      { id: 'year', label: 'Год' }, { id: 'all', label: 'За всё время' }
    ];
    var days = stats.revenueByDay || [];
    var maxAmount = 1;
    days.forEach(function (d) { maxAmount = Math.max(maxAmount, FR.num(d.amount)); });

    var bars = days.map(function (item) {
      var amount = FR.num(item.amount);
      var heightPercent = amount > 0 ? Math.max(15, Math.round((amount / maxAmount) * 100)) : 8;
      return '<div class="flex-1 flex flex-col items-center gap-1.5 group h-full justify-end min-w-[24px]">' +
        '<div class="opacity-0 group-hover:opacity-100 transition-opacity text-[9px] font-medium bg-[#1A1A1A] text-white px-1.5 py-0.5 rounded-md whitespace-nowrap pointer-events-none">' + FR.money(amount) + ' ₽ (' + FR.num(item.bookings) + ')</div>' +
        '<div style="height:' + heightPercent + '%" class="w-full max-w-[32px] rounded-t-md transition-all ' + (amount > 0 ? 'bg-[#1A1A1A] group-hover:bg-[#D4A373]' : 'bg-[#E5E1DA]/60') + '"></div>' +
        '<span class="text-[9px] sm:text-[10px] uppercase font-medium text-[#8C8376] truncate">' + FR.esc(item.label) + '</span>' +
      '</div>';
    }).join('');

    return '<div class="space-y-6">' +
      '<div class="bg-white dark:bg-[#1A1A1A] p-4 rounded-xl border border-[#E5E1DA] dark:border-zinc-800 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 overflow-hidden">' +
        '<h2 class="font-serif italic font-light text-lg sm:text-xl text-[#1A1A1A] dark:text-white flex items-center space-x-2 shrink-0">' +
          FR.icon('bar-chart-3', 'w-5 h-5 text-[#D4A373] shrink-0') + '<span class="truncate">Статистика & Выручка</span>' +
        '</h2>' +
        '<div class="flex space-x-1 bg-[#F1EDE4] dark:bg-[#2A2825] p-1 rounded-lg overflow-x-auto no-scrollbar max-w-full">' +
          periods.map(function (p) {
            var on = statsPeriod === p.id;
            return '<button type="button" data-action="stats-period" data-period="' + p.id + '" class="px-2.5 sm:px-3 py-1 text-[11px] sm:text-xs font-medium rounded-md transition-all whitespace-nowrap ' + (on ? 'bg-[#1A1A1A] text-white shadow-2xs' : 'text-[#8C8376] hover:text-[#1A1A1A] dark:hover:text-white') + '">' + p.label + '</button>';
          }).join('') +
        '</div>' +
      '</div>' +

      '<div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">' +
        metricCard('Доход', FR.money(stats.totalRevenue) + ' ₽', stats.totalRevenue ? 'Из записей клиентов' : 'Записей нет', true) +
        metricCard('Заказы', String(FR.num(stats.completedBookingsCount)), 'Подтвержденные', false) +
        metricCard('Средний чек', FR.money(stats.avgOrderValue) + ' ₽', stats.avgOrderValue ? 'За услугу' : '0 ₽', true) +
        metricCard('Клиентов', String(FR.num(stats.newClientsCount)), 'Из сервиса', false) +
      '</div>' +

      '<div class="bg-white dark:bg-[#1A1A1A] p-4 sm:p-6 rounded-xl border border-[#E5E1DA] dark:border-zinc-800 shadow-2xs space-y-4 overflow-hidden">' +
        '<h3 class="font-serif italic text-base text-[#1A1A1A] dark:text-white">Динамика записей и дохода</h3>' +
        '<div class="overflow-x-auto no-scrollbar pb-2">' +
          '<div class="h-44 sm:h-48 flex items-end justify-between gap-2 sm:gap-3 pt-6 border-b border-[#E5E1DA] dark:border-zinc-800 min-w-[300px]">' + bars + '</div>' +
        '</div>' +
        (FR.num(stats.totalRevenue) === 0 ? '<p class="text-center text-xs text-[#8C8376] pt-1">За выбранный период пока нет подтвержденных доходов от записей.</p>' : '') +
      '</div>' +
    '</div>';
  }

  function metricCard(label, value, sub, highlighted) {
    return '<div class="bg-white dark:bg-[#1A1A1A] p-4 sm:p-5 rounded-xl border border-[#E5E1DA] dark:border-zinc-800 shadow-2xs space-y-1.5 overflow-hidden">' +
      '<span class="text-[10px] font-medium text-[#8C8376] uppercase tracking-widest block truncate">' + label + '</span>' +
      '<p class="text-xl sm:text-2xl font-serif italic font-light text-[#1A1A1A] dark:text-white truncate">' + value + '</p>' +
      (highlighted
        ? '<span class="text-[10px] text-[#1A1A1A] dark:text-white font-medium bg-[#F1EDE4] dark:bg-[#2A2825] px-2 py-0.5 rounded-md border border-[#E5E1DA] dark:border-zinc-800 inline-block truncate max-w-full">' + sub + '</span>'
        : '<span class="text-[10px] text-[#8C8376] font-normal block truncate">' + sub + '</span>') +
    '</div>';
  }

  /* ---------------------------- Таб calendar ---------------------------- */
  function calendarHtml() {
    if (!schedule) {
      return '<div class="bg-white dark:bg-[#1A1A1A] p-8 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-2xs text-center text-xs text-zinc-500 py-12">Загрузка рабочего графика...</div>';
    }
    var workingDays = schedule.workingDays || [];
    var timeSlots = schedule.timeSlots || [];

    var days = DAY_NAMES.map(function (name, idx) {
      var isWorking = workingDays.indexOf(idx) !== -1;
      return '<button type="button" data-action="toggle-day" data-day="' + idx + '" class="py-3 sm:py-4 px-1 rounded-xl border font-bold text-xs transition-all flex flex-col items-center justify-center ' +
        (isWorking
          ? 'bg-black text-white dark:bg-white dark:text-black border-black dark:border-white shadow-md'
          : 'bg-zinc-100 text-zinc-400 dark:bg-zinc-900 dark:text-zinc-600 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300') + '">' +
        '<span class="text-xs sm:text-sm font-bold">' + name + '</span>' +
        '<span class="text-[9px] uppercase tracking-wider mt-1 opacity-90 hidden xs:inline">' + (isWorking ? '✓ Рабочий' : 'Выходной') + '</span>' +
      '</button>';
    }).join('');

    var slots = timeSlots.map(function (slot) {
      return '<div class="group flex items-center space-x-2 px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-black dark:text-white rounded-xl shadow-xs text-xs font-mono font-bold hover:border-rose-500 transition-colors">' +
        FR.icon('clock', 'w-3.5 h-3.5 text-rose-600 shrink-0') +
        '<span>' + FR.esc(slot) + '</span>' +
        '<button type="button" data-action="remove-slot" data-slot="' + FR.esc(slot) + '" title="Удалить этот интервал" class="p-0.5 text-zinc-400 hover:text-rose-600 transition-colors rounded">' + FR.icon('x', 'w-3.5 h-3.5') + '</button>' +
      '</div>';
    }).join('');

    var presets = [
      { i: 0, label: '⚡ 10:00 - 20:00 (каждые 2 ч)' },
      { i: 1, label: '⚡ 09:00 - 20:00 (каждые 1.5 ч)' },
      { i: 2, label: '⚡ Плотный 09:00 - 21:00 (каждый час)' },
      { i: 3, label: '⚡ Вечерний 17:00 - 22:00' }
    ].map(function (p) {
      return '<button type="button" data-action="preset" data-preset="' + p.i + '" class="px-2.5 py-1.5 bg-white dark:bg-zinc-800 hover:bg-rose-50 dark:hover:bg-rose-950/30 border border-zinc-200 dark:border-zinc-700 text-[11px] font-bold text-zinc-700 dark:text-zinc-300 rounded-lg transition-colors">' + p.label + '</button>';
    }).join('');

    return '<div class="bg-white dark:bg-[#1A1A1A] p-6 sm:p-8 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-2xs space-y-8">' +
      '<div class="border-b border-zinc-200 dark:border-zinc-800 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">' +
        '<div>' +
          '<h2 class="font-bold text-xl text-black dark:text-white">Часы приёма и рабочий график</h2>' +
          '<p class="text-xs text-zinc-500 mt-0.5">Настройте рабочие дни и часы приёма для онлайн-записи клиентов</p>' +
        '</div>' +
        (scheduleNotice ? '<span class="px-3 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold rounded-lg border border-emerald-500/30 animate-pulse">' + FR.esc(scheduleNotice) + '</span>' : '') +
      '</div>' +

      '<div class="space-y-3">' +
        '<label class="block text-[11px] uppercase tracking-[0.2em] font-bold text-zinc-500">1. Рабочие дни недели (нажмите для переключения):</label>' +
        '<div class="grid grid-cols-7 gap-1.5 sm:gap-2.5">' + days + '</div>' +
      '</div>' +

      '<div class="space-y-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">' +
        '<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">' +
          '<label class="block text-[11px] uppercase tracking-[0.2em] font-bold text-zinc-500">2. Часы приёма клиентов (временные интервалы):</label>' +
          '<span class="text-xs text-zinc-500">Всего слотов: <strong class="text-black dark:text-white font-mono">' + timeSlots.length + '</strong></span>' +
        '</div>' +
        '<div class="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 flex flex-wrap gap-2.5 items-center min-h-[70px]">' + (slots || '<span class="text-xs text-zinc-500">Слотов пока нет.</span>') + '</div>' +

        '<div class="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">' +
          '<div class="p-4 bg-zinc-50 dark:bg-zinc-900/60 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-3">' +
            '<span class="text-xs font-bold text-black dark:text-white block">Добавить индивидуальное время приёма</span>' +
            '<div class="flex items-center space-x-2">' +
              '<input type="time" data-field="custom-slot" value="' + FR.esc(customSlot) + '" class="px-3 py-2.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-mono text-black dark:text-white focus:outline-none focus:border-rose-600" />' +
              '<button type="button" data-action="add-slot" class="px-4 py-2.5 bg-black hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-black font-bold text-xs rounded-xl transition-colors flex items-center space-x-1.5">' +
                FR.icon('plus', 'w-4 h-4') + '<span>Добавить</span>' +
              '</button>' +
            '</div>' +
          '</div>' +
          '<div class="p-4 bg-zinc-50 dark:bg-zinc-900/60 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-3">' +
            '<span class="text-xs font-bold text-black dark:text-white block">Быстрые шаблоны расписания</span>' +
            '<div class="flex flex-wrap gap-2">' + presets + '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* ---------------------------- Таб services ---------------------------- */
  function categoryOptions(selected) {
    var list = SERVICE_CATEGORIES.length ? SERVICE_CATEGORIES : ['Маникюр'];
    return list.map(function (c) {
      return '<option value="' + FR.esc(c) + '"' + (String(c) === String(selected) ? ' selected' : '') + '>' + FR.esc(c) + '</option>';
    }).join('');
  }

  function serviceRowHtml(s) {
    return '<div class="p-3.5 bg-[#FBF9F6] dark:bg-[#222222] rounded-lg border border-[#E5E1DA] dark:border-zinc-800 flex items-center justify-between gap-3">' +
      '<div>' +
        '<h4 class="font-medium text-xs text-[#1A1A1A] dark:text-white">' + FR.esc(s.title) + '</h4>' +
        '<span class="text-[10px] text-[#8C8376]">' + FR.esc(s.category) + ' • ' + FR.num(s.durationMins) + ' мин</span>' +
      '</div>' +
      '<div class="flex items-center space-x-3">' +
        '<span class="font-medium text-xs text-[#1A1A1A] dark:text-white">' + FR.money(s.price) + ' ₽</span>' +
        '<button type="button" data-action="delete-service" data-service-id="' + FR.esc(s.id) + '" title="Удалить услугу" class="p-1 text-[#8C8376] hover:text-rose-700 transition-colors">' + FR.icon('trash-2', 'w-3.5 h-3.5') + '</button>' +
      '</div>' +
    '</div>';
  }

  function servicesHtml() {
    var list = services.length
      ? '<div class="space-y-2">' + services.map(serviceRowHtml).join('') + '</div>'
      : '<p class="text-center py-8 text-xs text-[#8C8376]">Услуги ещё не добавлены.</p>';

    return '<div class="bg-white dark:bg-[#1A1A1A] p-6 sm:p-8 rounded-xl border border-[#E5E1DA] dark:border-zinc-800 shadow-2xs space-y-6">' +
      '<h2 class="font-serif italic font-light text-xl text-[#1A1A1A] dark:text-white border-b border-[#E5E1DA] dark:border-zinc-800 pb-3">Управление вашими услугами</h2>' +
      '<form data-form="service" class="bg-[#F1EDE4]/60 dark:bg-[#2A2825]/60 p-4 rounded-lg border border-[#E5E1DA] dark:border-zinc-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">' +
        '<input type="text" data-field="svc-title" value="' + FR.esc(newService.title) + '" placeholder="Название (напр.: Классический френч)" class="sm:col-span-2 px-3 py-2 bg-white dark:bg-zinc-900 border border-[#E5E1DA] dark:border-zinc-800 rounded-md text-xs text-[#1A1A1A] dark:text-white focus:outline-none focus:border-[#D4A373]" />' +
        '<select data-field="svc-category" class="px-3 py-2 bg-white dark:bg-zinc-900 border border-[#E5E1DA] dark:border-zinc-800 rounded-md text-xs text-[#1A1A1A] dark:text-white focus:outline-none focus:border-[#D4A373]">' + categoryOptions(newService.category) + '</select>' +
        '<input type="number" data-field="svc-price" value="' + FR.esc(newService.price) + '" placeholder="Цена в ₽" class="px-3 py-2 bg-white dark:bg-zinc-900 border border-[#E5E1DA] dark:border-zinc-800 rounded-md text-xs text-[#1A1A1A] dark:text-white focus:outline-none focus:border-[#D4A373]" />' +
        '<input type="number" data-field="svc-duration" value="' + FR.esc(newService.duration) + '" placeholder="Мин." class="px-3 py-2 bg-white dark:bg-zinc-900 border border-[#E5E1DA] dark:border-zinc-800 rounded-md text-xs text-[#1A1A1A] dark:text-white focus:outline-none focus:border-[#D4A373]" />' +
        '<textarea data-field="svc-desc" rows="1" placeholder="Описание (необязательно)" class="sm:col-span-2 lg:col-span-3 px-3 py-2 bg-white dark:bg-zinc-900 border border-[#E5E1DA] dark:border-zinc-800 rounded-md text-xs text-[#1A1A1A] dark:text-white focus:outline-none focus:border-[#D4A373]">' + FR.esc(newService.description) + '</textarea>' +
        '<button type="submit" class="px-4 py-2 bg-[#1A1A1A] hover:bg-[#2D2926] text-white text-[10px] uppercase tracking-widest font-medium rounded-md">Добавить</button>' +
      '</form>' +
      list +
    '</div>';
  }

  /* --------------------------- Таб portfolio ---------------------------- */
  function workImageAreaHtml() {
    if (newWork.img) {
      return '<div class="relative rounded-xl overflow-hidden border border-[#E5E1DA] dark:border-zinc-800 mb-2 max-h-48 bg-black/5 flex items-center justify-center">' +
        '<img src="' + FR.esc(newWork.img) + '"' + FR.onerror('work') + ' alt="Work preview" class="max-h-48 w-full object-cover" />' +
        '<button type="button" data-action="remove-work-image" class="absolute top-2 right-2 p-1.5 bg-black/70 hover:bg-rose-600 text-white rounded-lg transition-colors text-xs flex items-center gap-1">' +
          FR.icon('trash-2', 'w-3.5 h-3.5') + 'Удалить' +
        '</button>' +
      '</div>';
    }
    return '<div class="space-y-2">' +
      '<label class="border-2 border-dashed border-[#E5E1DA] dark:border-zinc-700 hover:border-[#D4A373] rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer bg-[#FBF9F6] dark:bg-[#222222] hover:bg-[#F1EDE4]/50 transition-all">' +
        FR.icon('upload-cloud', 'w-6 h-6 text-[#D4A373] mb-1') +
        '<span class="text-xs font-bold text-[#1A1A1A] dark:text-white">Загрузить фото работы с устройства</span>' +
        '<span class="text-[10px] text-[#8C8376] mt-0.5">PNG, JPG, WebP (автоматическая оптимизация)</span>' +
        '<input type="file" accept="image/*" data-file="work" class="hidden" />' +
      '</label>' +
      '<div class="relative">' +
        '<div class="absolute inset-0 flex items-center"><div class="w-full border-t border-[#E5E1DA] dark:border-zinc-800"></div></div>' +
        '<div class="relative flex justify-center text-[10px] uppercase"><span class="bg-white dark:bg-[#1A1A1A] px-2 text-[#8C8376]">или укажите прямую ссылку</span></div>' +
      '</div>' +
      '<input type="url" data-field="work-url" value="" placeholder="Ссылка на фото работы" class="w-full px-4 py-2 bg-[#FBF9F6] dark:bg-[#222222] border border-[#E5E1DA] dark:border-zinc-800 rounded-lg text-xs text-[#1A1A1A] dark:text-white focus:outline-none focus:border-[#D4A373]" />' +
    '</div>';
  }

  function workRowHtml(w) {
    var img = (w.images && w.images[0]) || DEFAULT_WORK_IMAGE;
    var archived = !!w.archived;
    var badge = archived
      ? '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 text-[9px] font-bold uppercase tracking-wider shrink-0">' + FR.icon('folder-open', 'w-3 h-3') + 'В архиве</span>'
      : '';
    var renewBtn = archived
      ? '<button type="button" data-action="go-listing" class="p-1 text-rose-600 hover:text-rose-700 transition-colors shrink-0" title="Продлить и вернуть в ленту">' + FR.icon('refresh-cw', 'w-3.5 h-3.5') + '</button>'
      : '';
    return '<div class="p-3.5 bg-[#FBF9F6] dark:bg-[#222222] rounded-lg border ' + (archived ? 'border-amber-500/40' : 'border-[#E5E1DA] dark:border-zinc-800') + ' flex items-center justify-between gap-3' + (archived ? ' opacity-90' : '') + '">' +
      '<div class="flex items-center gap-3 min-w-0">' +
        '<img src="' + FR.esc(FR.imgSrc(img)) + '"' + FR.onerror('work') + ' alt="' + FR.esc(w.title) + '" class="w-12 h-12 rounded-lg object-cover border border-[#E5E1DA] dark:border-zinc-800 shrink-0' + (archived ? ' grayscale' : '') + '" />' +
        '<div class="min-w-0">' +
          '<h4 class="font-medium text-xs text-[#1A1A1A] dark:text-white truncate">' + FR.esc(w.title) + '</h4>' +
          '<div class="flex items-center gap-2 mt-0.5">' +
            '<span class="text-[10px] text-[#8C8376]">' + FR.esc(w.category || '') + (w.price ? ' • ' + FR.money(w.price) + ' ₽' : '') + '</span>' +
            badge +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="flex items-center gap-1 shrink-0">' + renewBtn +
        '<button type="button" data-action="delete-work" data-work-id="' + FR.esc(w.id) + '" title="Удалить работу" class="p-1 text-[#8C8376] hover:text-rose-700 transition-colors shrink-0">' + FR.icon('trash-2', 'w-3.5 h-3.5') + '</button>' +
      '</div>' +
    '</div>';
  }

  function portfolioHtml() {
    var activeWorks = works.filter(function (w) { return !w.archived; });
    var archivedWorks = works.filter(function (w) { return !!w.archived; });

    var worksList = activeWorks.length
      ? '<div class="space-y-2">' + activeWorks.map(workRowHtml).join('') + '</div>'
      : '<p class="text-center py-8 text-xs text-[#8C8376]">В портфолио пока нет работ.</p>';

    var publishBlocked = !!(listing && listing.paymentsEnabled && !listing.canPublish);
    var gateHtml = publishBlocked
      ? '<div class="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2">' +
          FR.icon('circle-alert', 'w-4 h-4 shrink-0 mt-0.5') +
          '<span>Нет активной оплаты за объявления — публикация недоступна. Оформите или продлите подписку во вкладке «Объявления & Оплата». ' +
          '<button type="button" data-action="go-listing" class="font-bold underline">Перейти к оплате</button></span>' +
        '</div>'
      : '';

    var archiveHtml = archivedWorks.length
      ? '<div class="space-y-3 pt-4 border-t border-[#E5E1DA] dark:border-zinc-800">' +
          '<div class="flex items-center justify-between">' +
            '<h3 class="font-serif italic text-base text-[#1A1A1A] dark:text-white flex items-center gap-2">' + FR.icon('folder-open', 'w-4 h-4 text-amber-500') + 'Архив объявлений</h3>' +
            '<span class="text-[10px] uppercase font-bold tracking-wider text-amber-600 dark:text-amber-400">' + archivedWorks.length + ' шт.</span>' +
          '</div>' +
          '<div class="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-700 dark:text-amber-300 flex items-start gap-2">' +
            FR.icon('alert-triangle', 'w-3.5 h-3.5 shrink-0 mt-0.5') +
            '<span>В архиве есть неоплаченные выкладки услуг: они сняты с публикации в ленте из-за неоплаты продления. Оформите новую оплату и опубликуйте объявление заново, чтобы вернуть его в ленту.</span>' +
          '</div>' +
          '<div class="space-y-2">' + archivedWorks.map(workRowHtml).join('') + '</div>' +
        '</div>'
      : '';

    return '<div class="bg-white dark:bg-[#1A1A1A] p-6 sm:p-8 rounded-xl border border-[#E5E1DA] dark:border-zinc-800 shadow-2xs space-y-6">' +
      '<h2 class="font-serif italic font-light text-xl text-[#1A1A1A] dark:text-white border-b border-[#E5E1DA] dark:border-zinc-800 pb-3">Выставить новую работу в ленту</h2>' +
      gateHtml +
      '<form data-form="work" class="space-y-4">' +
        '<input type="text" required data-field="work-title" value="' + FR.esc(newWork.title) + '" placeholder="Заголовок работы (например: Французский маникюр с омбре)" class="w-full px-4 py-2.5 bg-[#FBF9F6] dark:bg-[#222222] border border-[#E5E1DA] dark:border-zinc-800 rounded-lg text-xs text-[#1A1A1A] dark:text-white focus:outline-none focus:border-[#D4A373]" />' +
        '<textarea rows="2" data-field="work-desc" placeholder="Описание работы..." class="w-full px-4 py-2.5 bg-[#FBF9F6] dark:bg-[#222222] border border-[#E5E1DA] dark:border-zinc-800 rounded-lg text-xs text-[#1A1A1A] dark:text-white focus:outline-none focus:border-[#D4A373]">' + FR.esc(newWork.description) + '</textarea>' +
        '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">' +
          '<select data-field="work-category" class="px-3 py-2 bg-[#FBF9F6] dark:bg-[#222222] border border-[#E5E1DA] dark:border-zinc-800 rounded-lg text-xs text-[#1A1A1A] dark:text-white focus:outline-none focus:border-[#D4A373]">' + categoryOptions(newWork.category) + '</select>' +
          '<input type="number" data-field="work-price" value="' + FR.esc(newWork.price) + '" placeholder="Цена, ₽ (необязательно)" class="px-3 py-2 bg-[#FBF9F6] dark:bg-[#222222] border border-[#E5E1DA] dark:border-zinc-800 rounded-lg text-xs text-[#1A1A1A] dark:text-white focus:outline-none focus:border-[#D4A373]" />' +
        '</div>' +
        '<div>' +
          '<label class="block text-[10px] uppercase tracking-[0.2em] font-medium text-[#8C8376] mb-1.5 flex items-center justify-between">' +
            '<span>Фотография работы</span><span class="text-[10px] font-normal text-rose-500">Авто-сжатие</span>' +
          '</label>' +
          workImageAreaHtml() +
          (isCompressingWork ? '<p class="text-[11px] text-amber-600 mt-1 animate-pulse flex items-center gap-1">' + FR.icon('sparkles', 'w-3 h-3') + ' Оптимизация изображения...</p>' : '') +
        '</div>' +
        '<button type="submit"' + (publishBlocked ? ' disabled' : '') + ' class="px-6 py-3 bg-[#1A1A1A] hover:bg-[#2D2926] disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-[10px] uppercase tracking-widest rounded-lg shadow-2xs">Опубликовать работу в ленту</button>' +
      '</form>' +
      '<div class="space-y-2 pt-2 border-t border-[#E5E1DA] dark:border-zinc-800">' +
        '<h3 class="font-serif italic text-base text-[#1A1A1A] dark:text-white">Ваши работы</h3>' +
        worksList +
      '</div>' +
      archiveHtml +
    '</div>';
  }

  /* ---------------------- Действия: профиль / приватность ---------------------- */
  function saveProfile() {
    var u = FR.state.user;
    if (!u) return;
    var payload = {
      name: form.name,
      phone: form.phone,
      email: form.email,
      avatar: form.avatar,
      district: form.district,
      privacySettings: {
        hidePhone: privacy.hidePhone,
        hideEmail: privacy.hideEmail,
        allowDirectMessages: privacy.allowDirectMessages
      }
    };
    if (isMaster()) {
      payload.bio = form.bio;
      payload.specialty = form.specialty;
    }
    FR.api.updateProfile(u.id, payload).then(function (res) {
      if (res && res.user) Object.assign(FR.state.user, res.user);
      ensureInit(true);
      editing = false;
      FR.toast('Профиль сохранён');
      paint();
    }).catch(function (err) {
      FR.toast('Ошибка сохранения профиля: ' + ((err && err.message) || err));
    });
  }

  function openPrivacyModal() {
    var id = 'profile-privacy';
    var el = FR.openOverlay(id, '<div data-privacy-root></div>', {});
    if (!el) return;
    var box = el.querySelector('[data-privacy-root]');
    var pop = el.querySelector('.fr-pop');
    if (pop) pop.style.maxWidth = '28rem';

    box.innerHTML = '<div class="relative w-full max-w-md bg-[#FBF9F6] dark:bg-[#1A1A1A] rounded-xl p-6 border border-[#E5E1DA] dark:border-zinc-800 shadow-2xl space-y-4">' +
      '<div class="flex items-center justify-between pb-3 border-b border-[#E5E1DA] dark:border-zinc-800">' +
        '<h3 class="font-serif italic text-base text-[#1A1A1A] dark:text-white flex items-center">' + FR.icon('shield', 'w-4 h-4 mr-2 text-[#D4A373]') + ' Настройки конфиденциальности</h3>' +
        '<button type="button" data-privacy-close class="p-1 text-[#8C8376] hover:text-[#1A1A1A] dark:hover:text-white">' + FR.icon('x', 'w-4 h-4') + '</button>' +
      '</div>' +
      '<div class="space-y-3 text-xs">' +
        '<label class="flex items-center justify-between p-3 bg-white dark:bg-[#222222] border border-[#E5E1DA] dark:border-zinc-800 rounded-lg cursor-pointer">' +
          '<span class="text-[#1A1A1A] dark:text-white">Скрывать телефон от других</span>' +
          '<input type="checkbox" data-privacy="hidePhone"' + (privacy.hidePhone ? ' checked' : '') + ' class="w-4 h-4" />' +
        '</label>' +
        '<label class="flex items-center justify-between p-3 bg-white dark:bg-[#222222] border border-[#E5E1DA] dark:border-zinc-800 rounded-lg cursor-pointer">' +
          '<span class="text-[#1A1A1A] dark:text-white">Скрывать email в профиле</span>' +
          '<input type="checkbox" data-privacy="hideEmail"' + (privacy.hideEmail ? ' checked' : '') + ' class="w-4 h-4" />' +
        '</label>' +
        '<label class="flex items-center justify-between p-3 bg-white dark:bg-[#222222] border border-[#E5E1DA] dark:border-zinc-800 rounded-lg cursor-pointer">' +
          '<span class="text-[#1A1A1A] dark:text-white">Разрешить личные сообщения</span>' +
          '<input type="checkbox" data-privacy="allowDirectMessages"' + (privacy.allowDirectMessages ? ' checked' : '') + ' class="w-4 h-4" />' +
        '</label>' +
      '</div>' +
      '<div class="pt-2 text-[11px] text-[#8C8376] space-y-1 bg-[#F1EDE4] dark:bg-[#2A2825] p-3 rounded-lg border border-[#E5E1DA] dark:border-zinc-800">' +
        '<p class="font-bold text-[#1A1A1A] dark:text-white">Политика защиты персональных данных French:</p>' +
        '<p>Все сообщения и данные записей шифруются. Контактные данные передаются мастеру только после подтверждения онлайн-записи.</p>' +
      '</div>' +
      '<button type="button" data-privacy-save class="w-full py-2.5 bg-[#1A1A1A] dark:bg-white text-white dark:text-black font-medium text-[10px] uppercase tracking-widest rounded-lg shadow-2xs">Сохранить настройки</button>' +
    '</div>';

    var closeBtn = box.querySelector('[data-privacy-close]');
    if (closeBtn) closeBtn.addEventListener('click', function () { FR.closeOverlay(id); });
    var saveBtn = box.querySelector('[data-privacy-save]');
    if (saveBtn) saveBtn.addEventListener('click', function () { FR.closeOverlay(id); paint(); });
    box.querySelectorAll('[data-privacy]').forEach(function (cb) {
      cb.addEventListener('change', function () { privacy[cb.getAttribute('data-privacy')] = !!cb.checked; });
    });
  }

  /* ---------------------------- Действия: записи ---------------------------- */
  function confirmCancel(bookingId) {
    var b = bookingById(bookingId);
    if (!b) return;
    FR.confirm({
      title: 'Отмена записи',
      message: 'Вы действительно хотите отменить запись на услугу <strong class="font-bold text-[#111111] dark:text-white">«' + FR.esc(b.serviceTitle) + '»</strong> на <span class="font-semibold text-[#B87B40]">' + FR.esc(b.date) + ' в ' + FR.esc(b.timeSlot) + '</span>?',
      confirmText: 'Да, отменить запись',
      cancelText: 'Вернуться',
      type: 'warning',
      iconType: 'calendar'
    }).then(function (ok) {
      if (!ok) return;
      FR.api.cancelAppointment(bookingId).then(function (res) {
        if (res && res.booking) replaceBooking(res.booking);
        loadData();
      }).catch(function (err) {
        FR.toast((err && err.message) || 'Ошибка отмены записи');
      });
    });
  }

  function changeStatus(bookingId, status) {
    if (!bookingId || !status) return;
    FR.api.updateBookingStatus(bookingId, status).then(function (res) {
      if (res && res.booking) replaceBooking(res.booking);
      loadData();
    }).catch(function (err) {
      FR.toast((err && err.message) || 'Ошибка изменения статуса записи');
    });
  }

  function openReview(bookingId) {
    var b = bookingById(bookingId);
    if (!b || !FR.openReviewModal) return;
    FR.openReviewModal(b);
  }

  function openBookingChat(bookingId) {
    function selectAndGo() {
      var list = FR.state.chats || [];
      for (var i = 0; i < list.length; i++) {
        if (String(list[i].bookingId) === String(bookingId)) { FR.state.activeChatId = list[i].id; break; }
      }
      if (FR.go) FR.go('chats');
    }
    var list = FR.state.chats || [];
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].bookingId) === String(bookingId)) { FR.state.activeChatId = list[i].id; if (FR.go) FR.go('chats'); return; }
    }
    if (FR.loadChats) FR.loadChats().then(selectAndGo);
    else selectAndGo();
  }

  /* --------------------------- Действия: расписание --------------------------- */
  function saveSchedule(updates, successMsg) {
    var u = FR.state.user;
    if (!u) return;
    FR.api.updateSchedule(u.id, updates).then(function (res) {
      if (res && res.schedule) schedule = res.schedule;
      if (successMsg) notify(successMsg); else paint();
    }).catch(function (err) {
      FR.toast((err && err.message) || 'Ошибка сохранения расписания');
    });
  }

  function toggleWorkingDay(dayIndex) {
    if (!schedule || isNaN(dayIndex)) return;
    var current = (schedule.workingDays || []).slice();
    var pos = current.indexOf(dayIndex);
    if (pos === -1) current.push(dayIndex); else current.splice(pos, 1);
    current.sort(function (a, b) { return a - b; });
    saveSchedule({ workingDays: current }, 'Рабочие дни обновлены');
  }

  function addTimeSlot(slot) {
    if (!schedule) return;
    slot = (slot || '').trim();
    if (!slot) { FR.toast('Укажите время приёма'); return; }
    var slots = (schedule.timeSlots || []).slice();
    if (slots.indexOf(slot) !== -1) { FR.toast('Этот временной интервал уже добавлен в расписание'); return; }
    slots.push(slot);
    slots.sort();
    saveSchedule({ timeSlots: slots }, 'Интервал ' + slot + ' добавлен в часы приёма');
  }

  function removeTimeSlot(slot) {
    if (!schedule) return;
    var slots = (schedule.timeSlots || []).slice();
    if (slots.length <= 1) { FR.toast('Должен оставаться хотя бы один рабочий слот для записи клиентов'); return; }
    var pos = slots.indexOf(slot);
    if (pos === -1) return;
    slots.splice(pos, 1);
    saveSchedule({ timeSlots: slots }, 'Интервал ' + slot + ' удалён');
  }

  function applyPreset(index) {
    if (!schedule) return;
    var preset = PRESETS[index];
    if (!preset) return;
    saveSchedule({ timeSlots: preset.slice() }, 'Шаблон часов приёма успешно применён');
  }

  /* --------------------------- Действия: статистика --------------------------- */
  function changeStatsPeriod(period) {
    if (!period || period === statsPeriod) return;
    statsPeriod = period;
    paint();
    var u = FR.state.user;
    if (!u || !isMaster()) return;
    FR.api.getMasterStats(u.id, statsPeriod).then(function (res) {
      stats = (res && res.stats) || null;
      paint();
    }).catch(function (err) {
      console.error('Error loading master stats:', err);
      paint();
    });
  }

  /* ---------------------- Действия: услуги и портфолио ---------------------- */
  function confirmDeleteService(serviceId) {
    var svc = null;
    for (var i = 0; i < services.length; i++) {
      if (String(services[i].id) === String(serviceId)) { svc = services[i]; break; }
    }
    if (!svc) return;
    FR.confirm({
      title: 'Удаление услуги',
      message: 'Вы действительно хотите удалить услугу <strong class="font-bold text-[#111111] dark:text-white">«' + FR.esc(svc.title) + '»</strong>? Она больше не будет доступна для онлайн-записи клиентов в вашем профиле.',
      confirmText: 'Да, удалить',
      cancelText: 'Отмена',
      type: 'danger',
      iconType: 'trash'
    }).then(function (ok) {
      if (!ok) return;
      FR.api.deleteService(serviceId).then(function () {
        services = services.filter(function (s) { return String(s.id) !== String(serviceId); });
        paint();
      }).catch(function (err) {
        FR.toast((err && err.message) || 'Ошибка удаления услуги');
      });
    });
  }

  function confirmDeleteWork(workId) {
    var work = null;
    for (var i = 0; i < works.length; i++) {
      if (String(works[i].id) === String(workId)) { work = works[i]; break; }
    }
    if (!work) return;
    FR.confirm({
      title: 'Удаление работы',
      message: 'Удалить работу <strong class="font-bold text-[#111111] dark:text-white">«' + FR.esc(work.title) + '»</strong> из портфолио?',
      confirmText: 'Да, удалить',
      cancelText: 'Отмена',
      type: 'danger',
      iconType: 'trash'
    }).then(function (ok) {
      if (!ok) return;
      FR.api.deleteWork(workId).then(function () {
        works = works.filter(function (w) { return String(w.id) !== String(workId); });
        paint();
      }).catch(function (err) {
        FR.toast((err && err.message) || 'Ошибка удаления работы');
      });
    });
  }

  function addService() {
    var u = FR.state.user;
    if (!u) return;
    var title = (newService.title || '').trim();
    if (!title) { FR.toast('Укажите название услуги'); return; }
    FR.api.addService({
      masterId: u.id,
      title: title,
      category: newService.category || (SERVICE_CATEGORIES[0] || 'Маникюр'),
      price: FR.num(newService.price) || 2000,
      durationMins: FR.num(newService.duration) || 60,
      description: (newService.description || '').trim()
    }).then(function (res) {
      if (res && res.service) services.push(res.service);
      newService.title = '';
      newService.description = '';
      paint();
    }).catch(function (err) {
      FR.toast((err && err.message) || 'Ошибка добавления услуги');
    });
  }

  function addWork() {
    var u = FR.state.user;
    if (!u) return;
    var title = (newWork.title || '').trim();
    if (!title) { FR.toast('Укажите заголовок работы'); return; }
    FR.api.addWork({
      masterId: u.id,
      title: title,
      description: (newWork.description || '').trim() || 'Новая работа в портфолио',
      category: newWork.category || form.specialty || 'Маникюр',
      images: newWork.img ? [newWork.img] : [DEFAULT_WORK_IMAGE],
      price: newWork.price
    }).then(function (res) {
      if (res && res.work) works.unshift(res.work);
      newWork.title = '';
      newWork.description = '';
      newWork.price = '';
      newWork.img = '';
      paint();
    }).catch(function (err) {
      if (err && (err.message === 'PAYMENT_REQUIRED' || err.status === 402)) {
        FR.toast('Для публикации объявления нужна подписка');
        activeTab = 'listing';
        paint();
        return;
      }
      FR.toast((err && err.message) || 'Ошибка публикации работы');
    });
  }

  /* --------------------------- Таб support ------------------------------ */
  function loadSupport() {
    FR.api.getSupportTickets().then(function (res) {
      supportTickets = (res && res.tickets) || [];
      paint();
    }).catch(function (err) {
      FR.toast((err && err.message) || 'Не удалось загрузить обращения');
      paint();
    });
  }

  function openSupportTicket(id) {
    supportActiveId = id;
    supportThread = null;
    supportLoading = true;
    supportReply = '';
    paint();
    FR.api.markSupportRead(id).catch(function () {});
    FR.api.getSupportThread(id).then(function (res) {
      if (supportActiveId !== id) return;
      supportThread = res;
      supportLoading = false;
      paint();
    }).catch(function () {
      if (supportActiveId !== id) return;
      supportLoading = false;
      paint();
    });
  }

  function createSupportTicket() {
    var subject = (supportForm.subject || '').trim();
    var text = (supportForm.text || '').trim();
    if (!text) { FR.toast('Опишите ваш вопрос'); return; }
    FR.api.createSupportTicket({ subject: subject || 'Обращение в поддержку', text: text }).then(function (res) {
      FR.toast('Обращение отправлено');
      supportForm = { subject: '', text: '' };
      if (res && res.ticket) openSupportTicket(res.ticket.id);
      loadSupport();
    }).catch(function (err) {
      FR.toast((err && err.message) || 'Не удалось отправить обращение');
    });
  }

  function sendSupportReply() {
    var text = (supportReply || '').trim();
    if (!text || !supportActiveId) return;
    var id = supportActiveId;
    supportReply = '';
    FR.api.sendSupportMessage(id, text).then(function () {
      return FR.api.getSupportThread(id);
    }).then(function (res) {
      if (supportActiveId === id) { supportThread = res; paint(); }
      loadSupport();
    }).catch(function (err) {
      FR.toast((err && err.message) || 'Не удалось отправить сообщение');
      supportReply = text;
      paint();
    });
  }

  function supportHtml() {
    var list = supportTickets.length
      ? supportTickets.map(function (t) {
          var on = t.id === supportActiveId;
          var unread = Number(t.unreadForUser) || 0;
          return '<button type="button" data-action="support-open" data-ticket-id="' + FR.esc(t.id) + '" class="w-full text-left px-3.5 py-3 rounded-lg border transition-colors mb-1.5 ' +
            (on ? 'border-rose-300 bg-rose-50 dark:bg-rose-950/20 dark:border-rose-900/50' : 'border-[#E5E1DA] dark:border-zinc-800 hover:bg-[#FBF9F6] dark:hover:bg-zinc-900') + '">' +
            '<div class="flex items-center justify-between gap-2">' +
              '<span class="text-xs font-bold text-[#1A1A1A] dark:text-white truncate">' + FR.esc(t.subject || 'Обращение') + '</span>' +
              (unread > 0 ? '<span class="shrink-0 rounded-full bg-rose-600 px-2 py-0.5 text-[9px] font-black text-white">' + unread + '</span>' : '') +
            '</div>' +
            '<p class="mt-0.5 text-[11px] text-[#8C8376] dark:text-zinc-400 truncate">' + FR.esc(t.lastMessage || '') + '</p>' +
            '<p class="mt-0.5 text-[10px] text-[#B0A99E]">' + FR.esc(FR.fmtDateTime(t.lastMessageTime || t.createdAt)) + '</p>' +
          '</button>';
        }).join('')
      : '<p class="py-4 text-center text-[11px] text-[#8C8376] dark:text-zinc-400">Обращений пока нет.</p>';

    var thread = '';
    if (supportActiveId) {
      if (supportLoading || !supportThread) {
        thread = '<div class="bg-white dark:bg-[#1A1A1A] p-6 rounded-xl border border-[#E5E1DA] dark:border-zinc-800 text-center text-[11px] text-[#8C8376] dark:text-zinc-400">Загружаем переписку...</div>';
      } else {
        var t = supportThread.ticket || {};
        var msgs = (supportThread.messages || []).map(function (m) {
          var staff = m.senderRole === 'admin' || m.senderRole === 'support';
          return '<div class="flex ' + (staff ? 'justify-start' : 'justify-end') + '">' +
            '<div class="max-w-[85%] rounded-2xl px-3 py-2 text-xs ' + (staff ? 'bg-[#F1EDE4] dark:bg-zinc-800 text-[#1A1A1A] dark:text-white' : 'bg-rose-600 text-white') + '">' +
              '<p class="text-[9px] font-bold opacity-70 mb-0.5">' + FR.esc(m.senderName || '') + (staff ? ' · Поддержка' : '') + '</p>' +
              '<p class="whitespace-pre-wrap break-words">' + FR.esc(m.text) + '</p>' +
              '<p class="mt-0.5 text-[9px] opacity-60">' + FR.esc(FR.fmtDateTime(m.createdAt)) + '</p>' +
            '</div></div>';
        }).join('');
        thread = '<div class="bg-white dark:bg-[#1A1A1A] rounded-xl border border-[#E5E1DA] dark:border-zinc-800 overflow-hidden">' +
          '<div class="flex items-center justify-between px-4 py-3 border-b border-[#E5E1DA] dark:border-zinc-800">' +
            '<p class="text-xs font-bold text-[#1A1A1A] dark:text-white truncate pr-3">' + FR.esc(t.subject || 'Обращение') + '</p>' +
            '<button type="button" data-action="support-close" class="shrink-0 text-[10px] font-bold text-[#8C8376] hover:text-black dark:hover:text-white">Закрыть</button>' +
          '</div>' +
          '<div class="space-y-2.5 p-4 max-h-72 overflow-y-auto bg-[#FBF9F6] dark:bg-[#181818]">' + msgs + '</div>' +
          '<div class="flex items-end gap-2 p-3 border-t border-[#E5E1DA] dark:border-zinc-800">' +
            '<textarea data-field="support-reply" rows="2" placeholder="Ваш ответ..." class="flex-1 resize-none px-3 py-2 bg-white dark:bg-[#222222] border border-[#E5E1DA] dark:border-[#333333] rounded-lg text-xs text-[#1A1A1A] dark:text-white focus:outline-none focus:border-[#D4A373]">' + FR.esc(supportReply) + '</textarea>' +
            '<button type="button" data-action="support-send" class="px-3.5 py-2.5 bg-[#1A1A1A] hover:bg-[#2D2926] text-white rounded-lg text-[11px] font-bold">' + FR.icon('send', 'w-3.5 h-3.5') + '</button>' +
          '</div>' +
        '</div>';
      }
    }

    return '<div class="space-y-5">' +
      '<div class="bg-white dark:bg-[#1A1A1A] p-6 sm:p-8 rounded-xl border border-[#E5E1DA] dark:border-zinc-800 shadow-2xs space-y-4">' +
        '<h2 class="font-serif italic font-light text-xl text-[#1A1A1A] dark:text-white border-b border-[#E5E1DA] dark:border-zinc-800 pb-3">Обращение в поддержку</h2>' +
        '<p class="text-[11px] text-[#8C8376] dark:text-zinc-400">Опишите вопрос — служба поддержки ответит прямо здесь.</p>' +
        '<input data-field="support-subject" value="' + FR.esc(supportForm.subject) + '" maxlength="120" placeholder="Тема (необязательно)" class="w-full px-4 py-2.5 bg-[#FBF9F6] dark:bg-[#222222] border border-[#E5E1DA] dark:border-[#333333] rounded-lg text-xs text-[#1A1A1A] dark:text-white focus:outline-none focus:border-[#D4A373]">' +
        '<textarea data-field="support-text" rows="4" placeholder="Ваш вопрос..." class="w-full px-4 py-2.5 bg-[#FBF9F6] dark:bg-[#222222] border border-[#E5E1DA] dark:border-[#333333] rounded-lg text-xs text-[#1A1A1A] dark:text-white focus:outline-none focus:border-[#D4A373] resize-y">' + FR.esc(supportForm.text) + '</textarea>' +
        '<button type="button" data-action="support-create" class="px-5 py-2.5 bg-[#1A1A1A] hover:bg-[#2D2926] text-white rounded-lg text-[10px] font-bold uppercase tracking-widest">Отправить обращение</button>' +
      '</div>' +
      '<div class="bg-white dark:bg-[#1A1A1A] p-6 sm:p-8 rounded-xl border border-[#E5E1DA] dark:border-zinc-800 shadow-2xs">' +
        '<h2 class="text-sm font-bold text-[#1A1A1A] dark:text-white mb-3">Мои обращения</h2>' +
        list +
      '</div>' +
      thread +
    '</div>';
  }

  FR.registerSection('profile', { render: render, onEvent: onEvent });
})();
