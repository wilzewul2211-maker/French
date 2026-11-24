/**
 * Модалка отзыва со звёздами (порт src/components/ReviewModal.tsx).
 * Оверлей 'review-modal': оценка 1–5, быстрые впечатления, текст отзыва,
 * отправка через FR.api.rateBooking(...).
 *
 * FR.openReviewModal(booking) — booking: Booking.
 */
(function () {
  'use strict';
  var FR = window.FR;

  var LABELS = {
    5: '⭐️⭐️⭐️⭐️⭐️ Превосходно!',
    4: '⭐️⭐️⭐️⭐️ Очень хорошо',
    3: '⭐️⭐️⭐️ Нормально',
    2: '⭐️⭐️ Есть недостатки',
    1: '⭐️ Плохо'
  };

  FR.openReviewModal = function (booking) {
    booking = booking || {};
    if (!booking.id) return;

    var user = FR.state.user || {};
    var raterRole = user.role === 'master' ? 'master' : 'client';
    var isClient = raterRole === 'client';
    var targetUserName = isClient ? booking.masterName : booking.clientName;
    var id = 'review-modal';

    var quickTags = isClient
      ? ['✨ Идеальное покрытие', '☕ Уютная атмосфера', '⏱️ Очень быстро', '💅 Аккуратная работа', '💖 Приятное общение']
      : ['⭐ Пунктуальный клиент', '👍 Приятное общение', '🌸 Аккуратность', '❤️ Буду рада видеть снова'];

    var state = {
      rating: 5,
      hover: null,
      reviewText: '',
      isSubmitting: false,
      error: ''
    };

    var el = FR.openOverlay(id, '<div data-review-root class="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-rose-100 overflow-hidden"></div>', {});
    if (!el) return;
    var root = el.querySelector('[data-review-root]');
    if (!root) return;

    function currentStar() { return state.hover !== null ? state.hover : state.rating; }

    function starClass(active) {
      return 'w-9 h-9 transition-colors ' + (active ? 'fill-amber-400 text-amber-400 filter drop-shadow-xs' : 'fill-gray-100 text-gray-300');
    }

    function starsRow() {
      var html = '';
      var active = currentStar();
      for (var s = 1; s <= 5; s++) {
        html += '<button type="button" data-star="' + s + '" class="p-1 transition-transform hover:scale-115 focus:outline-none">' +
          FR.icon('star', starClass(active >= s)) + '</button>';
      }
      return html;
    }

    function tagsRow() {
      return quickTags.map(function (tag) {
        return '<button type="button" data-tag="' + FR.esc(tag) + '" class="text-xs bg-rose-50 hover:bg-rose-100 text-rose-700 font-medium px-3 py-1.5 rounded-full border border-rose-200 transition-colors">' + FR.esc(tag) + '</button>';
      }).join('');
    }

    function view() {
      return '<div class="bg-gradient-to-r from-rose-600 via-rose-500 to-pink-600 px-6 py-5 text-white">' +
          '<div class="flex items-center justify-between">' +
            '<div class="flex items-center gap-2.5">' +
              FR.icon('sparkles', 'w-6 h-6 text-amber-200') +
              '<div>' +
                '<h3 class="text-lg font-bold tracking-tight">' + (isClient ? 'Оцените работу мастера' : 'Оцените клиента') + '</h3>' +
                '<p class="text-xs text-rose-100 font-medium">' + FR.esc(targetUserName) + '</p>' +
              '</div>' +
            '</div>' +
            '<button type="button" data-close class="p-1.5 text-white/80 hover:text-white rounded-lg hover:bg-white/10 transition-colors">' + FR.icon('x', 'w-5 h-5') + '</button>' +
          '</div>' +
        '</div>' +
        '<div class="p-6 space-y-6">' +
          '<div class="text-center space-y-2">' +
            '<p class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Ваша общая оценка</p>' +
            '<div class="flex items-center justify-center gap-2 py-2">' + starsRow() + '</div>' +
            '<p data-rating-label class="text-sm font-bold text-gray-800">' + FR.esc(LABELS[state.rating] || '') + '</p>' +
          '</div>' +
          '<div>' +
            '<p class="text-xs font-semibold text-gray-600 mb-2">Быстрые впечатления:</p>' +
            '<div class="flex flex-wrap gap-1.5">' + tagsRow() + '</div>' +
          '</div>' +
          '<div>' +
            '<label class="block text-xs font-semibold text-gray-700 mb-1.5">Ваш текстовый отзыв</label>' +
            '<textarea data-field="reviewText" rows="4" placeholder="' +
              (isClient
                ? 'Поделитесь впечатлениями о качестве, скорости и атмосфере...'
                : 'Опишите впечатление о сотрудничестве с клиентом...') +
              '" class="w-full px-3.5 py-2.5 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 bg-gray-50 focus:bg-white transition-all">' + FR.esc(state.reviewText) + '</textarea>' +
          '</div>' +
          (state.error
            ? '<div class="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium">' + FR.esc(state.error) + '</div>'
            : '') +
        '</div>' +
        '<div class="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">' +
          '<button type="button" data-cancel class="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900 rounded-lg transition-colors">Позже</button>' +
          '<button type="button" data-submit ' + (state.isSubmitting ? 'disabled ' : '') +
            'class="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-2 disabled:opacity-50">' +
            (state.isSubmitting
              ? '<span class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>Публикация...'
              : FR.icon('check', 'w-4 h-4') + 'Оставить отзыв') +
          '</button>' +
        '</div>';
    }

    function paintStars() {
      var active = currentStar();
      root.querySelectorAll('[data-star]').forEach(function (b) {
        var s = parseInt(b.getAttribute('data-star'), 10);
        var svg = b.querySelector('svg');
        if (svg) svg.setAttribute('class', starClass(active >= s));
      });
      var label = root.querySelector('[data-rating-label]');
      if (label) label.textContent = LABELS[state.rating] || '';
    }

    function addTag(tag) {
      if (state.reviewText.indexOf(tag) !== -1) return;
      state.reviewText = state.reviewText ? state.reviewText + ' • ' + tag : tag;
      var area = root.querySelector('[data-field="reviewText"]');
      if (area) area.value = state.reviewText;
    }

    function submit() {
      if (state.rating < 1 || state.rating > 5) {
        state.error = 'Пожалуйста, выберите оценку от 1 до 5 звезд';
        render();
        return;
      }
      state.error = '';
      state.isSubmitting = true;
      render();

      FR.api.rateBooking(booking.id, raterRole, state.rating, state.reviewText.trim() || 'Отличная работа, всё понравилось!')
        .then(function () {
          state.isSubmitting = false;
          FR.toast('Отзыв опубликован');
          FR.closeOverlay(id, true);
        })
        .catch(function (err) {
          state.isSubmitting = false;
          state.error = (err && err.message) || 'Произошла ошибка при отправке отзыва';
          render();
        });
    }

    function bind() {
      var close = root.querySelector('[data-close]');
      if (close) close.addEventListener('click', function () { FR.closeOverlay(id); });
      var cancel = root.querySelector('[data-cancel]');
      if (cancel) cancel.addEventListener('click', function () { FR.closeOverlay(id); });
      var submitBtn = root.querySelector('[data-submit]');
      if (submitBtn) submitBtn.addEventListener('click', submit);

      root.querySelectorAll('[data-star]').forEach(function (b) {
        var s = parseInt(b.getAttribute('data-star'), 10);
        b.addEventListener('mouseenter', function () { state.hover = s; paintStars(); });
        b.addEventListener('mouseleave', function () { state.hover = null; paintStars(); });
        b.addEventListener('click', function () { state.rating = s; state.hover = null; paintStars(); });
      });

      root.querySelectorAll('[data-tag]').forEach(function (b) {
        b.addEventListener('click', function () { addTag(b.getAttribute('data-tag')); });
      });

      var area = root.querySelector('[data-field="reviewText"]');
      if (area) area.addEventListener('input', function () { state.reviewText = area.value; });
    }

    function render() {
      root.innerHTML = view();
      bind();
    }

    render();
  };
})();
