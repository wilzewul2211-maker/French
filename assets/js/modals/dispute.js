/**
 * Модалка арбитража и безопасного спора (порт src/components/DisputeArbitrationModal.tsx).
 * Оверлей 'dispute-modal': карточка спора, доказательства сторон и действия.
 *
 * Ветка по роли FR.state.user.role:
 *   • admin  — вынесение решения через FR.api.resolveDispute(...) (как в референсе);
 *   • client — отмена записи с возвратом средств через FR.api.cancelAppointmentAuthorization(...);
 *   • master — только просмотр статуса и доказательств.
 *
 * FR.openDisputeModal(booking) — booking: Booking (требует booking.dispute).
 */
(function () {
  'use strict';
  var FR = window.FR;

  FR.openDisputeModal = function (booking) {
    booking = booking || {};
    var dispute = booking.dispute;
    if (!booking.id || !dispute) return;

    var user = FR.state.user || {};
    var role = user.role || 'client';
    var isAdmin = role === 'admin';
    var isClient = role === 'client';
    var isResolved = dispute.status !== 'open';
    var id = 'dispute-modal';

    var state = {
      resolutionNotes: '',
      reason: dispute.reason || '',
      isSubmitting: false,
      error: ''
    };

    var el = FR.openOverlay(id, '<div data-dispute-root class="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-amber-200 overflow-hidden"></div>', {});
    if (!el) return;
    var pop = el.querySelector('.fr-pop');
    if (pop) pop.style.maxWidth = '42rem';
    var root = el.querySelector('[data-dispute-root]');
    if (!root) return;

    var masterPayout = Math.round(FR.num(booking.servicePrice) * (1 - FR.PLATFORM_PERCENT / 100));

    function statusBadge() {
      var cls = dispute.status === 'open'
        ? 'bg-amber-200 text-amber-900 animate-pulse'
        : dispute.status === 'resolved_client_refund'
          ? 'bg-emerald-100 text-emerald-800'
          : 'bg-indigo-100 text-indigo-800';
      var label = dispute.status === 'open'
        ? 'На рассмотрении'
        : dispute.status === 'resolved_client_refund'
          ? 'Возврат клиенту (100%)'
          : 'Выплата мастеру';
      return '<span class="text-[11px] font-bold px-2.5 py-1 rounded-full ' + cls + '">' + FR.esc(label) + '</span>';
    }

    function evidencePhotosBlock() {
      var photos = dispute.clientEvidencePhotos || [];
      if (!photos.length) return '';
      var grid = photos.map(function (photo, i) {
        return '<div data-photo="' + FR.esc(photo) + '" class="relative aspect-square rounded-xl overflow-hidden border border-gray-200 cursor-pointer group shadow-2xs hover:shadow-md transition-all">' +
            '<img src="' + FR.esc(photo) + '" alt="Evidence ' + (i + 1) + '" class="w-full h-full object-cover group-hover:scale-105 transition-transform">' +
            '<div class="absolute inset-0 bg-black/20 group-hover:bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs font-medium">Увеличить</div>' +
          '</div>';
      }).join('');
      return '<div>' +
          '<h4 class="text-xs font-bold uppercase tracking-wider text-gray-700 mb-2 flex items-center gap-1.5">' +
            FR.icon('image', 'w-4 h-4 text-rose-500') + 'Фото доказательства клиента (' + photos.length + ')' +
          '</h4>' +
          '<div class="grid grid-cols-3 gap-2.5">' + grid + '</div>' +
        '</div>';
    }

    function evidenceVideosBlock() {
      var videos = dispute.masterEvidenceVideos || [];
      if (!videos.length) return '';
      var list = videos.map(function (vid) {
        return '<div class="rounded-xl overflow-hidden border border-gray-300 bg-black">' +
            '<video src="' + FR.esc(vid) + '" controls class="w-full max-h-60 object-contain mx-auto"></video>' +
          '</div>';
      }).join('');
      return '<div>' +
          '<h4 class="text-xs font-bold uppercase tracking-wider text-gray-700 mb-2 flex items-center gap-1.5">' +
            FR.icon('video', 'w-4 h-4 text-rose-500') + 'Видео / Фото доказательства мастера (' + videos.length + ')' +
          '</h4>' +
          '<div class="space-y-3">' + list + '</div>' +
        '</div>';
    }

    function resolutionResultBlock() {
      if (!isResolved || !dispute.resolutionNotes) return '';
      return '<div class="p-4 bg-emerald-50 rounded-xl border border-emerald-200">' +
          '<h5 class="text-xs font-bold text-emerald-900 mb-1">Решение службы поддержки:</h5>' +
          '<p class="text-xs text-emerald-800">' + FR.esc(dispute.resolutionNotes) + '</p>' +
          (dispute.resolvedAt
            ? '<p class="text-[10px] text-emerald-600 mt-1">Дата решения: ' + FR.esc(FR.fmtDateTime(dispute.resolvedAt)) + '</p>'
            : '') +
        '</div>';
    }

    function adminControls() {
      return '<div class="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-4">' +
          '<h4 class="text-xs font-bold text-gray-900 flex items-center gap-1.5">' +
            FR.icon('user-check', 'w-4 h-4 text-indigo-600') + 'Вынесение решения (Арбитраж):' +
          '</h4>' +
          '<div>' +
            '<label class="block text-xs font-medium text-gray-700 mb-1">Обоснование вердикта поддержки</label>' +
            '<textarea data-field="resolutionNotes" rows="2" placeholder="Укажите причину принятого решения на основе присланных доказательств..." class="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 bg-white">' + FR.esc(state.resolutionNotes) + '</textarea>' +
          '</div>' +
          '<div class="flex gap-3">' +
            '<button type="button" data-resolve="client_refund" ' + (state.isSubmitting ? 'disabled ' : '') +
              'class="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs disabled:opacity-50">' +
              FR.icon('rotate-ccw', 'w-4 h-4') + 'Возврат 100% клиенту (' + FR.money(booking.servicePrice) + ' ₽)' +
            '</button>' +
            '<button type="button" data-resolve="master_payout" ' + (state.isSubmitting ? 'disabled ' : '') +
              'class="flex-1 py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs disabled:opacity-50">' +
              FR.icon('check-circle-2', 'w-4 h-4') + 'Выплата мастеру (' + FR.money(masterPayout) + ' ₽)' +
            '</button>' +
          '</div>' +
        '</div>';
    }

    function clientControls() {
      return '<div class="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-4">' +
          '<h4 class="text-xs font-bold text-gray-900 flex items-center gap-1.5">' +
            FR.icon('scale', 'w-4 h-4 text-rose-600') + 'Отмена записи и возврат средств:' +
          '</h4>' +
          '<div>' +
            '<label class="block text-xs font-medium text-gray-700 mb-1">Причина отмены / претензии</label>' +
            '<textarea data-field="reason" rows="2" placeholder="Опишите причину отмены записи..." class="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 bg-white">' + FR.esc(state.reason) + '</textarea>' +
          '</div>' +
          '<button type="button" data-cancel-booking ' + (state.isSubmitting ? 'disabled ' : '') +
            'class="w-full py-2.5 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs disabled:opacity-50">' +
            FR.icon('rotate-ccw', 'w-4 h-4') + 'Отменить запись и вернуть средства' +
          '</button>' +
        '</div>';
    }

    function view() {
      return '<div class="bg-gradient-to-r from-amber-600 via-orange-600 to-rose-600 px-6 py-5 text-white">' +
          '<div class="flex items-center justify-between">' +
            '<div class="flex items-center gap-2.5">' +
              FR.icon('shield-alert', 'w-6 h-6 text-white') +
              '<div>' +
                '<h3 class="text-lg font-bold tracking-tight">Арбитраж и безопасный спор • Заказ #' + FR.esc(String(booking.id).substring(0, 8)) + '</h3>' +
                '<p class="text-xs text-amber-100 font-medium">' + (isResolved ? 'Спор рассмотрен' : 'Средства заморожены на платформе') + '</p>' +
              '</div>' +
            '</div>' +
            '<button type="button" data-close class="p-1.5 text-white/80 hover:text-white rounded-lg hover:bg-white/10 transition-colors">' + FR.icon('x', 'w-5 h-5') + '</button>' +
          '</div>' +
        '</div>' +
        '<div class="p-6 space-y-6 max-h-[75vh] overflow-y-auto">' +
          '<div class="p-4 bg-amber-50 rounded-xl border border-amber-200">' +
            '<div class="flex items-center justify-between mb-2">' +
              '<span class="text-xs font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1.5">' +
                FR.icon('alert-triangle', 'w-4 h-4 text-amber-600') + 'Инициатор спора: ' + (dispute.raisedBy === 'client' ? 'Клиент' : 'Мастер') +
              '</span>' +
              statusBadge() +
            '</div>' +
            '<p class="text-sm font-semibold text-gray-900 mb-1">Причина претензии:</p>' +
            '<p class="text-xs text-gray-700 bg-white p-3 rounded-lg border border-amber-100 italic">«' + FR.esc(dispute.reason) + '»</p>' +
          '</div>' +
          '<div class="grid grid-cols-2 gap-3 text-xs bg-gray-50 p-4 rounded-xl border border-gray-200">' +
            '<div><span class="text-gray-500 block">Услуга:</span><span class="font-bold text-gray-900">' + FR.esc(booking.serviceTitle) + '</span></div>' +
            '<div><span class="text-gray-500 block">Сумма в удержании:</span><span class="font-bold text-gray-900">' + FR.money(booking.servicePrice) + ' ₽</span></div>' +
            '<div><span class="text-gray-500 block">Клиент:</span><span class="font-medium text-gray-800">' + FR.esc(booking.clientName) + '</span></div>' +
            '<div><span class="text-gray-500 block">Мастер:</span><span class="font-medium text-gray-800">' + FR.esc(booking.masterName) + '</span></div>' +
          '</div>' +
          evidencePhotosBlock() +
          evidenceVideosBlock() +
          resolutionResultBlock() +
          (!isResolved && isAdmin ? adminControls() : '') +
          (!isResolved && isClient ? clientControls() : '') +
          (state.error
            ? '<div class="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium flex items-center gap-2">' +
                FR.icon('alert-triangle', 'w-4 h-4 shrink-0') + FR.esc(state.error) +
              '</div>'
            : '') +
        '</div>' +
        '<div class="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end">' +
          '<button type="button" data-cancel class="px-5 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold text-xs rounded-xl transition-colors">Закрыть</button>' +
        '</div>';
    }

    function handleResolve(decision) {
      state.isSubmitting = true;
      state.error = '';
      render();
      FR.api.resolveDispute(booking.id, decision, state.resolutionNotes.trim())
        .then(function () {
          state.isSubmitting = false;
          FR.toast('Решение по спору сохранено');
          FR.closeOverlay(id, true);
        })
        .catch(function (err) {
          state.isSubmitting = false;
          state.error = (err && err.message) || 'Ошибка вынесения решения по спору';
          render();
        });
    }

    function handleCancelBooking() {
      state.isSubmitting = true;
      state.error = '';
      render();
      FR.api.cancelAppointmentAuthorization(booking.id, state.reason.trim() || dispute.reason || 'Отмена записи пользователем')
        .then(function () {
          state.isSubmitting = false;
          FR.toast('Запись отменена, средства возвращены');
          FR.closeOverlay(id, true);
        })
        .catch(function (err) {
          state.isSubmitting = false;
          state.error = (err && err.message) || 'Ошибка отмены записи';
          render();
        });
    }

    function bind() {
      var close = root.querySelector('[data-close]');
      if (close) close.addEventListener('click', function () { FR.closeOverlay(id); });
      var cancel = root.querySelector('[data-cancel]');
      if (cancel) cancel.addEventListener('click', function () { FR.closeOverlay(id); });

      root.querySelectorAll('[data-resolve]').forEach(function (b) {
        b.addEventListener('click', function () { handleResolve(b.getAttribute('data-resolve')); });
      });

      var cancelBooking = root.querySelector('[data-cancel-booking]');
      if (cancelBooking) cancelBooking.addEventListener('click', handleCancelBooking);

      root.querySelectorAll('[data-field]').forEach(function (inp) {
        inp.addEventListener('input', function () {
          state[inp.getAttribute('data-field')] = inp.value;
        });
      });

      root.querySelectorAll('[data-photo]').forEach(function (box) {
        box.addEventListener('click', function () {
          FR.openLightbox(box.getAttribute('data-photo'), 'Доказательство клиента');
        });
      });
    }

    function render() {
      root.innerHTML = view();
      bind();
    }

    render();
  };
})();
