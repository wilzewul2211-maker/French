/**
 * Модалка опроса качества услуги (порт src/components/BookingSurveyModal.tsx).
 * Оверлей 'booking-survey': вопросы да/нет, при негативном ответе — раздел
 * претензии (причина + фото у клиента / видео у мастера), отправка через
 * FR.api.submitBookingSurvey(...).
 *
 * FR.openBookingSurvey({ booking, role, onSubmitted }) — role: 'client'|'master'.
 * FR.openSurveyModal — алиас.
 */
(function () {
  'use strict';
  var FR = window.FR;

  FR.openBookingSurvey = function (data) {
    data = data || {};
    var booking = data.booking || {};
    if (!booking.id) return;

    var user = FR.state.user || {};
    var role = data.role || user.role || 'client';
    var userId = user.id || '';
    var id = 'booking-survey';

    var state = {
      role: role,
      qQuality: true,
      qPoliteClient: true,
      qSatisfied: true,
      qPoliteMaster: true,
      qWelcomeAgain: true,
      feedback: '',
      evidenceReason: '',
      evidencePhotos: [],
      evidenceVideos: [],
      isCompressing: false,
      isSubmitting: false,
      error: ''
    };

    var el = FR.openOverlay(id, '<div data-survey-root class="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-rose-100 overflow-hidden"></div>', {
      onClose: function () { if (typeof data.onClose === 'function') data.onClose(); }
    });
    if (!el) return;
    var pop = el.querySelector('.fr-pop');
    if (pop) pop.style.maxWidth = '36rem';
    var root = el.querySelector('[data-survey-root]');
    if (!root) return;

    function isClient() { return state.role === 'client'; }

    function hasNegative() {
      return isClient()
        ? (state.qQuality === false || state.qPoliteClient === false || state.qSatisfied === false)
        : (state.qPoliteMaster === false || state.qWelcomeAgain === false);
    }

    /* -------------------- Фрагменты разметки -------------------- */
    function questionBlock(num, text, field, yesLabel, noLabel) {
      var val = state[field];
      var yesCls = val === true
        ? 'bg-emerald-500 text-white border-emerald-600 shadow-xs'
        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100';
      var noCls = val === false
        ? 'bg-rose-500 text-white border-rose-600 shadow-xs'
        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100';
      return '<div class="p-4 rounded-xl border border-gray-200 bg-gray-50/50 hover:bg-white transition-colors">' +
          '<p class="text-sm font-medium text-gray-800 mb-3">' + num + '. ' + FR.esc(text) + '</p>' +
          '<div class="flex gap-3">' +
            '<button type="button" data-answer="' + field + '" data-value="1" class="flex-1 py-2.5 px-4 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 border transition-all ' + yesCls + '">' +
              FR.icon('check-circle-2', 'w-4 h-4') + FR.esc(yesLabel) +
            '</button>' +
            '<button type="button" data-answer="' + field + '" data-value="0" class="flex-1 py-2.5 px-4 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 border transition-all ' + noCls + '">' +
              FR.icon('x-circle', 'w-4 h-4') + FR.esc(noLabel) +
            '</button>' +
          '</div>' +
        '</div>';
    }

    function photosBlock() {
      var thumbs = state.evidencePhotos.map(function (photo, idx) {
        return '<div class="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-300 group">' +
            '<img src="' + FR.esc(photo) + '" alt="Evidence ' + (idx + 1) + '" class="w-full h-full object-cover">' +
            '<button type="button" data-remove-photo="' + idx + '" class="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 hover:bg-rose-600 transition-colors">' + FR.icon('trash-2', 'w-3 h-3') + '</button>' +
          '</div>';
      }).join('');

      return '<div>' +
          '<label class="block text-xs font-semibold text-gray-800 mb-1.5 flex items-center justify-between">' +
            '<span class="flex items-center gap-1">' + FR.icon('camera', 'w-3.5 h-3.5 text-rose-500') + 'Фото доказательства с устройства <span class="text-rose-500">*</span></span>' +
            '<span class="text-[11px] text-gray-500 font-normal">Авто-сжатие картинок</span>' +
          '</label>' +
          '<div class="flex flex-wrap gap-2 mb-2">' +
            thumbs +
            '<label class="w-20 h-20 border-2 border-dashed border-amber-300 hover:border-amber-500 rounded-lg flex flex-col items-center justify-center cursor-pointer bg-white hover:bg-amber-100/50 transition-colors">' +
              FR.icon('camera', 'w-5 h-5 text-amber-600 mb-1') +
              '<span class="text-[10px] text-amber-800 font-medium">Добавить</span>' +
              '<input type="file" accept="image/*" multiple data-photo-input class="hidden">' +
            '</label>' +
          '</div>' +
          (state.isCompressing ? '<p class="text-[11px] text-amber-700 animate-pulse">Сжатие изображений...</p>' : '') +
        '</div>';
    }

    function videosBlock() {
      var thumbs = state.evidenceVideos.map(function (vid, idx) {
        return '<div class="relative w-28 h-20 rounded-lg overflow-hidden border border-gray-300 group bg-black">' +
            '<video src="' + FR.esc(vid) + '" class="w-full h-full object-cover"></video>' +
            '<button type="button" data-remove-video="' + idx + '" class="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 hover:bg-rose-600 transition-colors">' + FR.icon('trash-2', 'w-3 h-3') + '</button>' +
          '</div>';
      }).join('');

      return '<div>' +
          '<label class="block text-xs font-semibold text-gray-800 mb-1.5 flex items-center justify-between">' +
            '<span class="flex items-center gap-1">' + FR.icon('video', 'w-3.5 h-3.5 text-rose-500') + 'Видео / Фото доказательства агрессии (до 25 МБ)</span>' +
          '</label>' +
          '<div class="flex flex-wrap gap-2 mb-2">' +
            thumbs +
            '<label class="w-28 h-20 border-2 border-dashed border-amber-300 hover:border-amber-500 rounded-lg flex flex-col items-center justify-center cursor-pointer bg-white hover:bg-amber-100/50 transition-colors text-center p-1">' +
              FR.icon('video', 'w-5 h-5 text-amber-600 mb-1') +
              '<span class="text-[10px] text-amber-800 font-medium leading-tight">Загрузить видео/фото</span>' +
              '<input type="file" accept="video/*,image/*" multiple data-video-input class="hidden">' +
            '</label>' +
          '</div>' +
        '</div>';
    }

    function evidenceBlock() {
      return '<div class="p-4 bg-amber-50 rounded-xl border border-amber-200 space-y-4 animate-in fade-in duration-300">' +
          '<div class="flex items-start gap-2.5 text-amber-900">' +
            FR.icon('alert-triangle', 'w-5 h-5 text-amber-600 shrink-0 mt-0.5') +
            '<div class="text-xs space-y-1">' +
              '<p class="font-bold text-amber-950">Средства будут заморожены до рассмотрения спора поддержкой</p>' +
              '<p class="text-amber-800">' +
                (isClient()
                  ? 'Так как вы указали на недостатки, деньги мастера будут заморожены. Пожалуйста, прикрепите фото доказательства некачественной работы.'
                  : 'Так как вы указали на некорректное поведение клиента, средства будут заморожены до предоставления вами видео/фото доказательств.') +
              '</p>' +
            '</div>' +
          '</div>' +
          '<div>' +
            '<label class="block text-xs font-semibold text-gray-800 mb-1.5">Подробное описание претензии <span class="text-rose-500">*</span></label>' +
            '<textarea data-field="evidenceReason" rows="3" placeholder="' +
              (isClient()
                ? 'Опишите, что именно пошло не так с услугой (неровное покрытие, опоздание, испорченные ногти/волосы)...'
                : 'Опишите инцидент неадекватного поведения клиента (оскорбления, угрозы, порча имущества)...') +
              '" class="w-full px-3 py-2 text-xs border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white">' + FR.esc(state.evidenceReason) + '</textarea>' +
          '</div>' +
          (isClient() ? photosBlock() : videosBlock()) +
        '</div>';
    }

    function view() {
      var negative = hasNegative();
      return '<div class="bg-gradient-to-r from-rose-600 via-rose-500 to-pink-600 px-6 py-5 text-white">' +
          '<div class="flex items-center justify-between">' +
            '<div class="flex items-center gap-2.5">' +
              FR.icon('shield', 'w-6 h-6 text-white/90') +
              '<div>' +
                '<h3 class="text-lg font-bold tracking-tight">' + (isClient() ? 'Опрос качества услуги' : 'Завершение услуги мастером') + '</h3>' +
                '<p class="text-xs text-rose-100 font-medium">Безопасная сделка • Заказ #' + FR.esc(String(booking.id).substring(0, 8)) + '</p>' +
              '</div>' +
            '</div>' +
            '<button type="button" data-close class="p-1.5 text-white/80 hover:text-white rounded-lg hover:bg-white/10 transition-colors">' + FR.icon('x', 'w-5 h-5') + '</button>' +
          '</div>' +
        '</div>' +
        '<div class="p-6 space-y-6 max-h-[75vh] overflow-y-auto">' +
          '<div class="p-4 bg-rose-50/60 rounded-xl border border-rose-100 flex items-center justify-between">' +
            '<div>' +
              '<p class="text-xs font-semibold text-rose-800 uppercase tracking-wide">Услуга</p>' +
              '<h4 class="font-bold text-gray-900 text-sm mt-0.5">' + FR.esc(booking.serviceTitle) + '</h4>' +
              '<p class="text-xs text-gray-600 mt-0.5">' + FR.esc(booking.date) + ' в ' + FR.esc(booking.timeSlot) + ' • ' +
                (isClient() ? ('Мастер: ' + FR.esc(booking.masterName)) : ('Клиент: ' + FR.esc(booking.clientName))) + '</p>' +
            '</div>' +
            '<div class="text-right">' +
              '<span class="text-xs text-gray-500 block">Сумма заказа</span>' +
              '<span class="font-bold text-gray-900 text-base">' + FR.money(booking.servicePrice) + ' ₽</span>' +
            '</div>' +
          '</div>' +
          '<div class="space-y-4">' +
            '<h4 class="text-sm font-bold text-gray-900 flex items-center gap-1.5">' +
              FR.icon('help-circle', 'w-4 h-4 text-rose-500') + 'Пожалуйста, ответьте на вопросы для подтверждения выплаты:' +
            '</h4>' +
            (isClient()
              ? '<div class="space-y-3">' +
                  questionBlock(1, 'Качественно ли мастер выполнил свою работу?', 'qQuality', 'Да, всё отлично', 'Нет, есть претензии') +
                  questionBlock(2, 'Вежливо ли общался мастер?', 'qPoliteClient', 'Да, очень вежливо', 'Нет, было грубо') +
                  questionBlock(3, 'Довольны ли вы итоговым результатом?', 'qSatisfied', 'Да, полностью', 'Нет, недовольна') +
                '</div>'
              : '<div class="space-y-3">' +
                  questionBlock(1, 'Вежливо и корректно ли вел себя клиент?', 'qPoliteMaster', 'Да, отлично', 'Нет, клиент хамил / неадекватен') +
                  questionBlock(2, 'Ждали бы вы данного клиента снова?', 'qWelcomeAgain', 'Да, с удовольствием', 'Нет, больше не приму') +
                '</div>') +
          '</div>' +
          (negative ? evidenceBlock() : '') +
          (!negative
            ? '<div>' +
                '<label class="block text-xs font-semibold text-gray-700 mb-1.5">Комментарий или пожелание (необязательно)</label>' +
                '<textarea data-field="feedback" rows="2" placeholder="Напишите пару слов о вашем впечатлении..." class="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 bg-gray-50 focus:bg-white">' + FR.esc(state.feedback) + '</textarea>' +
              '</div>'
            : '') +
          (state.error
            ? '<div class="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium flex items-center gap-2">' +
                FR.icon('alert-triangle', 'w-4 h-4 shrink-0') + FR.esc(state.error) +
              '</div>'
            : '') +
        '</div>' +
        '<div class="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">' +
          '<button type="button" data-cancel class="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900 rounded-lg transition-colors">Отмена</button>' +
          '<button type="button" data-submit ' + ((state.isSubmitting || state.isCompressing) ? 'disabled ' : '') +
            'class="px-6 py-2.5 text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-2 ' +
            (negative ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-rose-600 hover:bg-rose-700 text-white') +
            ' disabled:opacity-50 disabled:cursor-not-allowed">' +
            (state.isSubmitting
              ? '<span class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>Отправка...'
              : negative
                ? FR.icon('alert-triangle', 'w-4 h-4') + 'Заморозить и открыть спор'
                : FR.icon('check-circle-2', 'w-4 h-4') + 'Подтвердить (Да, всё отлично)') +
          '</button>' +
        '</div>';
    }

    /* -------------------- Обработчики -------------------- */
    function onPhotos(e) {
      var input = e.target;
      if (!input.files || !input.files.length) return;
      var files = Array.prototype.slice.call(input.files);
      state.error = '';
      state.isCompressing = true;
      render();
      Promise.all(files.map(function (f) {
        return FR.compressImage(f, { maxWidth: 1200, maxHeight: 1200, quality: 0.85 });
      })).then(function (results) {
        state.evidencePhotos = state.evidencePhotos.concat(results);
      }).catch(function (err) {
        state.error = 'Ошибка обработки фото: ' + ((err && err.message) || '');
      }).then(function () {
        state.isCompressing = false;
        render();
      });
    }

    function onVideos(e) {
      var input = e.target;
      if (!input.files || !input.files.length) return;
      var files = Array.prototype.slice.call(input.files);
      var oversized = [];
      var tasks = [];
      files.forEach(function (file) {
        if (file.size > 25 * 1024 * 1024) { oversized.push(file.name); return; }
        tasks.push(new Promise(function (resolve) {
          var reader = new FileReader();
          reader.onload = function (evt) { resolve(evt.target ? evt.target.result : null); };
          reader.onerror = function () { resolve(null); };
          reader.readAsDataURL(file);
        }));
      });
      state.error = oversized.length
        ? ('Файл ' + oversized.join(', ') + ' слишком большой. Максимальный размер видео — 25 МБ.')
        : '';
      state.isCompressing = true;
      render();
      Promise.all(tasks).then(function (results) {
        state.evidenceVideos = state.evidenceVideos.concat(results.filter(Boolean));
      }).then(function () {
        state.isCompressing = false;
        render();
      });
    }

    function submit() {
      state.error = '';
      var client = isClient();
      if (client) {
        if (state.qQuality === null || state.qPoliteClient === null || state.qSatisfied === null) {
          state.error = 'Пожалуйста, ответьте на все вопросы опроса.';
          render(); return;
        }
        if (hasNegative() && !state.evidenceReason.trim()) {
          state.error = 'Пожалуйста, опишите причину претензии для службы поддержки.';
          render(); return;
        }
        if (hasNegative() && state.evidencePhotos.length === 0) {
          state.error = 'Для открытия диспута по качеству необходимо прикрепить хотя бы одно фото доказательство.';
          render(); return;
        }
      } else {
        if (state.qPoliteMaster === null || state.qWelcomeAgain === null) {
          state.error = 'Пожалуйста, ответьте на все вопросы опроса.';
          render(); return;
        }
        if (hasNegative() && !state.evidenceReason.trim()) {
          state.error = 'Пожалуйста, опишите причину претензии к поведению клиента.';
          render(); return;
        }
      }

      var surveyPayload = client
        ? {
            qQuality: state.qQuality === true,
            qPolite: state.qPoliteClient === true,
            qSatisfied: state.qSatisfied === true,
            feedback: state.feedback.trim()
          }
        : {
            qPolite: state.qPoliteMaster === true,
            qWelcomeAgain: state.qWelcomeAgain === true,
            feedback: state.feedback.trim()
          };

      var evidencePayload = hasNegative()
        ? { reason: state.evidenceReason.trim(), photos: state.evidencePhotos, videos: state.evidenceVideos }
        : null;

      state.isSubmitting = true;
      render();

      FR.api.submitBookingSurvey({
        bookingId: booking.id,
        userId: userId,
        role: state.role,
        survey: surveyPayload,
        evidence: evidencePayload
      }).then(function () {
        state.isSubmitting = false;
        FR.toast('Спасибо! Опрос успешно отправлен.');
        FR.closeOverlay(id, true);
        if (typeof data.onSubmitted === 'function') data.onSubmitted();
      }).catch(function (err) {
        state.isSubmitting = false;
        state.error = (err && err.message) || 'Произошла непредвиденная ошибка';
        render();
      });
    }

    /* -------------------- Связывание событий -------------------- */
    function bind() {
      var close = root.querySelector('[data-close]');
      if (close) close.addEventListener('click', function () { FR.closeOverlay(id); });
      var cancel = root.querySelector('[data-cancel]');
      if (cancel) cancel.addEventListener('click', function () { FR.closeOverlay(id); });
      var submitBtn = root.querySelector('[data-submit]');
      if (submitBtn) submitBtn.addEventListener('click', submit);

      root.querySelectorAll('[data-answer]').forEach(function (b) {
        b.addEventListener('click', function () {
          state[b.getAttribute('data-answer')] = b.getAttribute('data-value') === '1';
          render();
        });
      });

      root.querySelectorAll('[data-field]').forEach(function (inp) {
        inp.addEventListener('input', function () {
          state[inp.getAttribute('data-field')] = inp.value;
        });
      });

      root.querySelectorAll('[data-remove-photo]').forEach(function (b) {
        b.addEventListener('click', function () {
          state.evidencePhotos.splice(parseInt(b.getAttribute('data-remove-photo'), 10), 1);
          render();
        });
      });

      root.querySelectorAll('[data-remove-video]').forEach(function (b) {
        b.addEventListener('click', function () {
          state.evidenceVideos.splice(parseInt(b.getAttribute('data-remove-video'), 10), 1);
          render();
        });
      });

      var photoInput = root.querySelector('[data-photo-input]');
      if (photoInput) photoInput.addEventListener('change', onPhotos);
      var videoInput = root.querySelector('[data-video-input]');
      if (videoInput) videoInput.addEventListener('change', onVideos);
    }

    function render() {
      root.innerHTML = view();
      bind();
    }

    render();
  };

  /* Алиас, ожидаемый другими модулями. */
  FR.openSurveyModal = FR.openBookingSurvey;
})();
