/**
 * Профиль мастера с записью (порт src/components/MasterProfileModal.tsx).
 * Оверлей 'master-profile': шапка профиля, вкладки «Календарь & Запись»,
 * «Услуги & Цены», «Портфолио», «Отзывы»; форма бронирования с календарём,
 * слотами времени и созданием записи через API.
 */
(function () {
  'use strict';

  var FR = window.FR;

  var OVERLAY_ID = 'master-profile';

  var TABS = [
    { id: 'calendar', label: 'Календарь & Запись', icon: 'calendar' },
    { id: 'services', label: 'Услуги & Цены', icon: 'scissors' },
    { id: 'portfolio', label: 'Портфолио', icon: 'sparkles' },
    { id: 'reviews', label: 'Отзывы', icon: 'star' }
  ];

  function tomorrowStr() {
    return new Date(Date.now() + 86400000).toISOString().split('T')[0];
  }

  FR.openMasterProfile = function (masterId) {
    if (!masterId) return;
    if (FR.isOverlayOpen(OVERLAY_ID)) FR.closeOverlay(OVERLAY_ID, true);

    var state = {
      masterId: masterId,
      data: null,
      loading: true,
      error: null,
      activeTab: 'calendar',
      selectedServiceId: null,
      selectedDate: tomorrowStr(),
      selectedTimeSlot: '',
      bookingNotes: '',
      bookingSubmitting: false,
      bookingError: null
    };

    var el = FR.openOverlay(
      OVERLAY_ID,
      '<div data-master-root class="relative w-full bg-[#FBF9F6] rounded-xl shadow-2xl overflow-hidden border border-[#E5E1DA] my-8 flex flex-col max-h-[90vh]"></div>',
      {}
    );
    if (!el) return;

    // Расширяем внутренний контейнер ядра (по умолчанию max-w-lg).
    var pop = el.querySelector('.fr-pop');
    if (pop) pop.className = 'fr-pop w-full max-w-3xl my-8';

    var root = el.querySelector('[data-master-root]');
    if (!root) return;

    /* -------------------- Данные -------------------- */
    function load() {
      state.loading = true;
      state.error = null;
      render();

      FR.api.getMasterDetails(state.masterId).then(function (res) {
        state.data = res;
        state.loading = false;
        if (res && res.services && res.services.length) {
          state.selectedServiceId = res.services[0].id;
        }
        render();
      }).catch(function (e) {
        state.loading = false;
        state.error = (e && e.message) || 'Не удалось загрузить профиль мастера';
        render();
      });
    }

    function selectedService() {
      if (!state.data || !state.data.services) return null;
      var list = state.data.services;
      for (var i = 0; i < list.length; i++) {
        if (list[i].id === state.selectedServiceId) return list[i];
      }
      return null;
    }

    function findWork(id) {
      if (!state.data || !state.data.works) return null;
      var list = state.data.works;
      for (var i = 0; i < list.length; i++) {
        if (list[i].id === id) return list[i];
      }
      return null;
    }

    /* Ближайшие 14 дней с учётом рабочих дней и отгулов графика. */
    function availableDays() {
      var schedule = (state.data && state.data.schedule) || {};
      var workingDays = schedule.workingDays || [];
      var offDates = schedule.offDates || [];
      var out = [];
      for (var i = 0; i < 14; i++) {
        var d = new Date(Date.now() + i * 86400000);
        var dateStr = d.toISOString().split('T')[0];
        var dow = d.getDay();
        out.push({
          dateStr: dateStr,
          dayNum: d.getDate(),
          monthName: d.toLocaleDateString('ru-RU', { month: 'short' }),
          dayName: d.toLocaleDateString('ru-RU', { weekday: 'short' }),
          isWorking: workingDays.indexOf(dow) !== -1 && offDates.indexOf(dateStr) === -1
        });
      }
      return out;
    }

    /* -------------------- Запись -------------------- */
    function handleCreateBooking() {
      var user = FR.state.user;
      if (!user) {
        FR.openAuth();
        return;
      }

      var svc = selectedService();
      if (!svc || !state.selectedDate || !state.selectedTimeSlot) {
        state.bookingError = 'Пожалуйста, выберите услугу, дату и время записи.';
        render();
        return;
      }

      state.bookingSubmitting = true;
      state.bookingError = null;
      render();

      FR.api.createBooking({
        clientId: user.id,
        masterId: state.masterId,
        serviceId: svc.id,
        date: state.selectedDate,
        timeSlot: state.selectedTimeSlot,
        notes: state.bookingNotes.trim() || undefined
      }).then(function () {
        FR.toast('Запись создана');
        FR.closeOverlay(OVERLAY_ID);
        FR.loadChats();
      }).catch(function (err) {
        state.bookingSubmitting = false;
        state.bookingError = (err && err.message) || 'Ошибка создания записи';
        render();
      });
    }

    /* -------------------- Разметка вкладок -------------------- */
    function calendarTab() {
      var data = state.data;
      var html = '<div class="space-y-6">';

      if (state.bookingError) {
        html += '<div class="p-3 bg-rose-50/50 border border-rose-200 rounded-lg text-rose-800 text-xs font-medium">' +
          FR.esc(state.bookingError) + '</div>';
      }

      /* Шаг 1. Услуга */
      html += '<div>' +
        '<label class="block text-[10px] uppercase tracking-[0.2em] font-medium text-[#8C8376] mb-2">1. Выберите услугу:</label>' +
        '<div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">' +
        (data.services || []).map(function (s) {
          var active = state.selectedServiceId === s.id;
          return '<div data-service="' + FR.esc(s.id) + '" class="p-3.5 rounded-lg border cursor-pointer transition-all ' +
              (active ? 'border-[#D4A373] bg-[#F1EDE4]' : 'border-[#E5E1DA] hover:border-[#D1CDC7] bg-[#FBF9F6]') + '">' +
              '<div class="flex items-center justify-between">' +
                '<span class="font-medium text-xs text-[#1A1A1A]">' + FR.esc(s.title) + '</span>' +
                '<span class="font-semibold text-xs text-[#1A1A1A]">' + FR.money(s.price) + ' ₽</span>' +
              '</div>' +
              '<div class="flex items-center justify-between text-[11px] text-[#8C8376] mt-1">' +
                '<span>' + FR.esc(s.category) + '</span>' +
                '<span class="flex items-center">' + FR.icon('clock', 'w-3 h-3 mr-0.5') + ' ' + FR.esc(s.durationMins) + ' мин</span>' +
              '</div>' +
            '</div>';
        }).join('') +
        '</div>' +
      '</div>';

      /* Шаг 2. Дата */
      html += '<div>' +
        '<label class="block text-[10px] uppercase tracking-[0.2em] font-medium text-[#8C8376] mb-2">2. Выберите свободный день:</label>' +
        '<div class="flex space-x-2 overflow-x-auto pb-2 no-scrollbar">' +
        availableDays().map(function (day) {
          var cls = !day.isWorking
            ? 'opacity-40 bg-[#F1EDE4] border-[#E5E1DA] cursor-not-allowed'
            : (state.selectedDate === day.dateStr
              ? 'bg-[#1A1A1A] text-white border-[#1A1A1A] shadow-xs'
              : 'bg-[#FBF9F6] border-[#E5E1DA] text-[#1A1A1A] hover:bg-[#F1EDE4]');
          return '<button data-day="' + FR.esc(day.dateStr) + '"' + (day.isWorking ? '' : ' disabled') +
              ' class="flex flex-col items-center p-3 min-w-[64px] rounded-lg border transition-all ' + cls + '">' +
              '<span class="text-[9px] uppercase font-bold opacity-80">' + FR.esc(day.dayName) + '</span>' +
              '<span class="text-base font-medium my-0.5">' + day.dayNum + '</span>' +
              '<span class="text-[9px] uppercase font-medium opacity-80">' + FR.esc(day.monthName) + '</span>' +
            '</button>';
        }).join('') +
        '</div>' +
      '</div>';

      /* Шаг 3. Слоты времени */
      html += '<div>' +
        '<label class="block text-[10px] uppercase tracking-[0.2em] font-medium text-[#8C8376] mb-2">3. Доступные слоты времени:</label>' +
        '<div class="grid grid-cols-3 sm:grid-cols-6 gap-2">' +
        ((data.schedule && data.schedule.timeSlots) || []).map(function (slot) {
          var active = state.selectedTimeSlot === slot;
          return '<button data-slot="' + FR.esc(slot) + '" class="py-2 px-3 text-xs font-medium rounded-lg border transition-all ' +
            (active
              ? 'bg-[#1A1A1A] text-white border-[#1A1A1A] shadow-2xs'
              : 'bg-[#FBF9F6] text-[#1A1A1A] border-[#E5E1DA] hover:bg-[#F1EDE4]') + '">' +
            FR.esc(slot) + '</button>';
        }).join('') +
        '</div>' +
      '</div>';

      /* Комментарий */
      html += '<div>' +
        '<label class="block text-[10px] uppercase tracking-[0.2em] font-medium text-[#8C8376] mb-1">Комментарий к записи / пожелания:</label>' +
        '<input data-notes type="text" value="' + FR.esc(state.bookingNotes) + '" placeholder="Например: хочу микро-френч или натуральные бежевые оттенки..." class="w-full px-4 py-2.5 bg-[#FBF9F6] border border-[#E5E1DA] rounded-lg text-xs focus:bg-white focus:outline-none focus:border-[#D4A373]">' +
      '</div>';

      /* Запись бесплатна */
      html += '<div class="p-3.5 bg-emerald-50/70 dark:bg-emerald-950/30 rounded-xl border border-emerald-100 dark:border-emerald-900/50 text-[11px] text-emerald-800 dark:text-emerald-300 flex items-start gap-2">' +
        FR.icon('info', 'w-4 h-4 shrink-0 mt-0.5') +
        '<span>Оплата за запись не требуется. После подтверждения мастером вам откроется личный чат для обсуждения деталей.</span>' +
      '</div>';

      /* Кнопка записи */
      html += '<div class="pt-2">' +
        '<button data-book' + (state.bookingSubmitting ? ' disabled' : '') + ' class="w-full py-3.5 bg-[#1A1A1A] hover:bg-[#2D2926] text-white font-medium text-[10px] uppercase tracking-widest rounded-lg shadow-2xs transition-all flex items-center justify-center space-x-2">' +
          FR.icon('message-square', 'w-3.5 h-3.5 text-[#D4A373]') +
          '<span>' + (state.bookingSubmitting ? 'Оформление...' : 'Записаться и открыть чат с мастером') + '</span>' +
        '</button>' +
        '<p class="text-[11px] text-center text-[#8C8376] mt-2">После записи вам автоматически откроется личный чат с мастером для обсуждения деталей и отправки референсов.</p>' +
      '</div>';

      html += '</div>';
      return html;
    }

    function servicesTab() {
      return '<div class="space-y-3">' +
        (state.data.services || []).map(function (s) {
          return '<div class="p-4 bg-[#FBF9F6] rounded-lg border border-[#E5E1DA] flex items-center justify-between">' +
            '<div>' +
              '<h4 class="font-medium text-xs text-[#1A1A1A]">' + FR.esc(s.title) + '</h4>' +
              '<p class="text-xs text-[#8C8376] mt-0.5">' + FR.esc(s.description || 'Высококачественное исполнение') + '</p>' +
              '<span class="inline-block text-[10px] text-[#8C8376] mt-1">' + FR.esc(s.durationMins) + ' минут</span>' +
            '</div>' +
            '<div class="text-right">' +
              '<span class="text-sm font-semibold text-[#1A1A1A]">' + FR.money(s.price) + ' ₽</span>' +
            '</div>' +
          '</div>';
        }).join('') +
      '</div>';
    }

    function portfolioTab() {
      var works = state.data.works || [];
      if (!works.length) {
        return '<p class="text-center py-8 text-xs text-[#554F47]">Пока нет работ в портфолио.</p>';
      }
      return '<div class="grid grid-cols-2 sm:grid-cols-3 gap-3">' +
        works.map(function (w) {
          var img = (w.images && w.images[0]) ? w.images[0] : '';
          return '<div data-work="' + FR.esc(w.id) + '" class="rounded-lg overflow-hidden border border-[#CFC9C0] group relative aspect-square bg-[#EBE6DC] cursor-pointer">' +
            '<img src="' + FR.esc(FR.imgSrc(img)) + '"' + FR.onerror('work') + ' alt="' + FR.esc(w.title) + '" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">' +
            '<div class="absolute inset-0 bg-[#111111]/80 opacity-0 group-hover:opacity-100 transition-opacity p-3 flex flex-col justify-end text-white text-xs">' +
              '<p class="font-bold line-clamp-1">' + FR.esc(w.title) + '</p>' +
              (w.price ? '<p class="text-[11px] text-[#B87B40] font-extrabold">' + FR.money(w.price) + ' ₽</p>' : '') +
            '</div>' +
          '</div>';
        }).join('') +
      '</div>';
    }

    function reviewsTab() {
      var reviews = state.data.reviews || [];
      if (!reviews.length) {
        return '<p class="text-center py-8 text-xs text-[#554F47]">Пока нет отзывов от клиентов.</p>';
      }
      return '<div class="space-y-3">' +
        reviews.map(function (r) {
          return '<div class="p-4 bg-[#F8F6F1] dark:bg-[#1A1A1A] rounded-lg border border-[#CFC9C0] dark:border-[#333333] space-y-2">' +
            '<div class="flex items-center justify-between">' +
              '<div class="flex items-center space-x-2">' +
                '<img src="' + FR.esc(FR.avatarSrc(r.clientAvatar)) + '"' + FR.onerror('avatar') + ' alt="' + FR.esc(r.clientName) + '" class="w-7 h-7 rounded-full object-cover ring-1 ring-[#CFC9C0]">' +
                '<span class="font-bold text-xs text-[#111111] dark:text-white">' + FR.esc(r.clientName) + '</span>' +
              '</div>' +
              '<div class="flex items-center text-[#B87B40] text-xs font-bold">' +
                FR.icon('star', 'w-3.5 h-3.5 fill-[#B87B40] mr-1') +
                '<span>' + FR.esc(r.rating) + '</span>' +
              '</div>' +
            '</div>' +
            '<p class="text-xs text-[#222222] dark:text-[#E0E0E0] font-normal">"' + FR.esc(r.text) + '"</p>' +
            '<p class="text-[10px] font-medium text-[#554F47] dark:text-[#A0988E]">Услуга: ' + FR.esc(r.serviceTitle) + ' • ' + FR.esc(r.date) + '</p>' +
          '</div>';
        }).join('') +
      '</div>';
    }

    /* -------------------- Общий вид -------------------- */
    function view() {
      var close =
        '<button type="button" data-close class="absolute top-4 right-4 z-10 p-2 text-[#8C8376] hover:text-[#1A1A1A] bg-[#F1EDE4]/80 backdrop-blur-xs rounded-full shadow-2xs">' +
          FR.icon('x', 'w-4 h-4') +
        '</button>';

      if (state.error) {
        return close + '<div class="p-16 text-center text-rose-600 text-xs font-light">' + FR.esc(state.error) + '</div>';
      }
      if (state.loading || !state.data) {
        return close + '<div class="p-16 text-center text-[#8C8376] text-xs font-light">Загрузка профиля мастера...</div>';
      }

      var master = state.data.master;

      var header = '<div class="bg-[#111111] p-6 text-white relative border-b border-[#333333]">' +
        '<div class="flex flex-col sm:flex-row items-start sm:items-center space-y-4 sm:space-y-0 sm:space-x-5">' +
          '<img src="' + FR.esc(FR.avatarSrc(master.avatar)) + '"' + FR.onerror('avatar') + ' alt="' + FR.esc(master.name) + '" class="w-20 h-20 sm:w-24 sm:h-24 rounded-xl object-cover ring-1 ring-[#333333] shadow-md shrink-0">' +
          '<div class="space-y-1">' +
            '<div class="flex items-center space-x-2">' +
              '<h2 class="font-sans font-bold text-2xl text-white">' + FR.esc(master.name) + '</h2>' +
              '<span class="bg-[#222222] text-[#B87B40] text-[10px] uppercase tracking-widest font-extrabold px-2.5 py-0.5 rounded-md border border-[#444444]">' +
                FR.esc(master.specialty || 'Мастер') + '</span>' +
            '</div>' +
            '<div class="flex items-center space-x-3 text-xs text-[#8C8376]">' +
              '<div class="flex items-center font-medium text-[#D4A373]">' +
                FR.icon('star', 'w-3.5 h-3.5 fill-[#D4A373] mr-1') +
                '<span>' + FR.esc(master.rating || 5.0) + '</span>' +
              '</div>' +
              '<span>•</span>' +
              '<span>' + FR.esc(master.reviewCount || 0) + ' отзывов</span>' +
              '<span>•</span>' +
              '<span class="flex items-center">' +
                FR.icon('map-pin', 'w-3.5 h-3.5 mr-0.5') +
                FR.esc(master.district) + ' (' + FR.esc(master.address) + ')' +
              '</span>' +
              (master.experienceYears
                ? '<span>•</span><span class="flex items-center">' + FR.icon('award', 'w-3.5 h-3.5 mr-0.5') +
                    'Опыт: ' + FR.esc(master.experienceYears) + ' лет</span>'
                : '') +
            '</div>' +
            '<p class="text-xs text-[#8C8376] leading-relaxed max-w-xl font-light">' + FR.esc(master.bio) + '</p>' +
          '</div>' +
        '</div>' +
      '</div>';

      var tabs = '<div class="flex border-b border-[#E5E1DA] bg-[#F1EDE4]/80 px-3 sm:px-6 overflow-x-auto no-scrollbar shrink-0 whitespace-nowrap">' +
        TABS.map(function (tab) {
          var active = state.activeTab === tab.id;
          return '<button type="button" data-tab="' + tab.id + '" class="flex items-center space-x-2 px-4 py-3 text-xs font-medium border-b-2 transition-colors ' +
            (active
              ? 'border-[#1A1A1A] text-[#1A1A1A] bg-[#FBF9F6]'
              : 'border-transparent text-[#8C8376] hover:text-[#1A1A1A]') + '">' +
            FR.icon(tab.icon, 'w-3.5 h-3.5') +
            '<span>' + tab.label + '</span>' +
          '</button>';
        }).join('') +
      '</div>';

      var body =
        state.activeTab === 'services' ? servicesTab() :
        state.activeTab === 'portfolio' ? portfolioTab() :
        state.activeTab === 'reviews' ? reviewsTab() :
        calendarTab();

      return close + header + tabs +
        '<div class="p-6 overflow-y-auto flex-1 space-y-6 bg-white">' + body + '</div>';
    }

    /* -------------------- Связывание событий -------------------- */
    function bind() {
      var closeBtn = root.querySelector('[data-close]');
      if (closeBtn) closeBtn.addEventListener('click', function () { FR.closeOverlay(OVERLAY_ID); });

      root.querySelectorAll('[data-tab]').forEach(function (b) {
        b.addEventListener('click', function () {
          state.activeTab = b.getAttribute('data-tab');
          render();
        });
      });

      root.querySelectorAll('[data-service]').forEach(function (b) {
        b.addEventListener('click', function () {
          state.selectedServiceId = b.getAttribute('data-service');
          render();
        });
      });

      root.querySelectorAll('[data-day]').forEach(function (b) {
        if (b.disabled) return;
        b.addEventListener('click', function () {
          state.selectedDate = b.getAttribute('data-day');
          state.selectedTimeSlot = '';
          render();
        });
      });

      root.querySelectorAll('[data-slot]').forEach(function (b) {
        b.addEventListener('click', function () {
          state.selectedTimeSlot = b.getAttribute('data-slot');
          render();
        });
      });

      var notes = root.querySelector('[data-notes]');
      if (notes) notes.addEventListener('input', function () { state.bookingNotes = notes.value; });

      var bookBtn = root.querySelector('[data-book]');
      if (bookBtn) bookBtn.addEventListener('click', handleCreateBooking);

      root.querySelectorAll('[data-work]').forEach(function (b) {
        b.addEventListener('click', function () {
          var w = findWork(b.getAttribute('data-work'));
          if (!w) return;
          var img = (w.images && w.images[0]) ? w.images[0] : '';
          FR.openLightbox(img, w.title);
        });
      });
    }

    function render() {
      root.innerHTML = view();
      bind();
    }

    load();
  };
})();
