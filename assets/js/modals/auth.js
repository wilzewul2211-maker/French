/**
 * Модалка авторизации и регистрации (порт src/components/AuthModal.tsx).
 * Один оверлей 'auth-modal': вход/регистрация, шаг подтверждения email-кода
 * (TTL 5 минут), просмотр публичной оферты.
 */
(function () {
  'use strict';

  var FR = window.FR;

  /* Публичная оферта — из window.__PUBLIC_OFFER_TEXT, иначе локальная копия lib/legal.php */
  var OFFER_TEXT = window.__PUBLIC_OFFER_TEXT || window.PUBLIC_OFFER_TEXT ||
    'ПУБЛИЧНАЯ ОФЕРТА (ПОЛЬЗОВАТЕЛЬСКОЕ СОГЛАШЕНИЕ) СЕРВИСА БЕЗОПАСНЫХ БЬЮТИ-УСЛУГ\n' +
    'г. Москва «14» августа 2026 г.\n\n' +
    'Индивидуальный предприниматель (далее — «Администрация Сервиса» или «Сервис French Beauty»), настоящим предлагает неограниченному кругу физических и юридических лиц заключить настоящий Договор-оферту на оказание информационно-посреднических услуг и использование программного комплекса сервиса на нижеследующих условиях.\n\n' +
    '1. ТЕРМИНЫ И ОПРЕДЕЛЕНИЯ\n' +
    '1.1. Сервис — аппаратно-программный комплекс «French Beauty», доступный в сети Интернет, обеспечивающий поиск, выбор, бронирование бьюти-услуг, коммуникацию и безопасные расчеты между Клиентами и Мастерами.\n' +
    '1.2. Клиент — дееспособное физическое лицо, прошедшее регистрацию в Сервисе с целью поиска и заказа услуг в сфере красоты.\n' +
    '1.3. Мастер — физическое лицо, самозанятый или индивидуальный предприниматель, зарегистрированный в Сервисе и оказывающий бьюти-услуги Клиентам.\n' +
    '1.4. Безопасная сделка (Эскроу-холдирование) — механизм обеспечения исполнения обязательств, при котором денежные средства Клиента за услугу замораживаются на внутреннем балансе Сервиса в момент подтверждения записи и перечисляются Мастеру только после обоюдного подтверждения факта качественного оказания услуги.\n' +
    '1.5. Двустороннее подтверждение оказания услуги — обязательный регламент Сервиса, согласно которому заказ считается полностью исполненным и переходит в статус «Завершено», а захолдированные средства перечисляются на баланс Мастера ТОЛЬКО после нажатия кнопки «Завершить услугу» как со стороны Клиента, так и со стороны Мастера (2 из 2 подтверждений).\n' +
    '1.6. Комиссия Сервиса — вознаграждение Администрации Сервиса в размере 3% (трех процентов) от стоимости оказанной услуги, удерживаемое при финальном расчете с Мастером.\n\n' +
    '2. ПРЕДМЕТ СОГЛАШЕНИЯ\n' +
    '2.1. Сервис предоставляет Клиентам и Мастерам технологическую платформу для взаимодействия, ведения рабочего графика, публикации портфолио, бронирования времени, обмена сообщениями и фото-референсами, а также безопасного проведения взаимных расчетов.\n' +
    '2.2. Сервис не является непосредственным исполнителем бьюти-услуг и выступает информационным и расчетным посредником, гарантирующим сохранность средств и соблюдение регламентов безопасности.\n\n' +
    '3. ПОРЯДОК РЕГИСТРАЦИИ И ВЕРИФИКАЦИИ\n' +
    '3.1. Регистрация Пользователя в Сервисе является бесплатной и добровольной.\n' +
    '3.2. Для завершения регистрации Пользователь обязан:\n' +
    '- Предоставить достоверный адрес электронной почты и номер телефона;\n' +
    '- Подтвердить владение указанным email путем ввода одноразового 6-значного кода, отправляемого Сервисом;\n' +
    '- Выразить безоговорочное согласие с условиями настоящей Публичной оферты и Политикой конфиденциальности путем проставления соответствующей отметки (галочки) в форме регистрации.\n' +
    '3.3. Акцепт настоящей Оферты означает полное согласие Пользователя со всеми положениями настоящего Договора без каких-либо изъятий и ограничений.\n\n' +
    '4. ПОРЯДОК ОПЛАТЫ, ХОЛДИРОВАНИЯ И ВЫПЛАТ\n' +
    '4.1. Клиент пополняет виртуальный баланс в Сервисе и производит бронирование услуги у выбранного Мастера на определенную дату и время.\n' +
    '4.2. При создании записи сумма стоимости услуги блокируется (холдируется) на балансе Клиента.\n' +
    '4.3. Окончательный расчет и перечисление средств Мастеру (за вычетом 3% комиссии Сервиса) производится в автоматическом режиме исключительно после получения ДВУХ подтверждений (нажатия кнопки «Завершить услугу» Клиентом и Мастером).\n' +
    '4.4. В случае отмены записи до начала оказания услуги или неявки одной из Сторон, захолдированные средства в полном объеме (100%) размораживаются и возвращаются на баланс Клиента.\n\n' +
    '5. ПРАВА И ОБЯЗАННОСТИ СТОРОН\n' +
    '5.1. Пользователь обязуется:\n' +
    '- Предоставлять достоверные контактные и учетные данные;\n' +
    '- Не передавать свои учетные данные третьим лицам;\n' +
    '- Своевременно прибывать на согласованные записи либо заблаговременно отменять их через функционал Сервиса;\n' +
    '- Соблюдать правила вежливости в чатах и не публиковать запрещенный законодательством РФ контент.\n' +
    '5.2. Сервис обязуется:\n' +
    '- Обеспечивать бесперебойное функционирование программной платформы;\n' +
    '- Гарантировать сохранность замороженных в рамках Безопасной сделки средств;\n' +
    '- Защищать персональные данные Пользователей в соответствии с Федеральным законом № 152-ФЗ «О персональных данных».\n\n' +
    '6. ОТВЕТСТВЕННОСТЬ СТОРОН\n' +
    '6.1. Мастер несет полную ответственность за качество и безопасность оказываемых бьюти-услуг, соблюдение санитарно-гигиенических норм и правил.\n' +
    '6.2. В случае возникновения спорных ситуаций (претензий к качеству услуги) Сервис вправе приостановить выплату до выяснения обстоятельств через службу поддержки.\n\n' +
    '7. СРОК ДЕЙСТВИЯ И ИЗМЕНЕНИЕ ОФЕРТЫ\n' +
    '7.1. Настоящая Оферта вступает в силу с момента ее публикации в Сервисе и действует бессрочно.\n' +
    '7.2. Администрация Сервиса оставляет за собой право вносить изменения в условия Оферты с обязательным уведомлением Пользователей в интерфейсе Сервиса.\n\n' +
    '8. РЕКВИЗИТЫ И КОНТАКТЫ\n' +
    'Платформа безопасных бьюти-услуг «French Beauty»\n' +
    'г. Москва, ул. Тверская, 12\n' +
    'Служба клиентской поддержки: support@french-beauty.ru / wilzewul2211@gmail.com\n' +
    'Технический отдел и безопасные расчеты: 2026 г.';

  var OFFER_VERSION = 'Версия от 14 августа 2026 г.';

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function categories() {
    return (window.__SERVICE_CATEGORIES && window.__SERVICE_CATEGORIES.length)
      ? window.__SERVICE_CATEGORIES
      : ['Маникюр & Педикюр', 'Визажист & Стилист', 'Брови & Ресницы', 'Парикмахер', 'Косметолог', 'Массажист'];
  }

  function districts() {
    return (window.__MOSCOW_DISTRICTS && window.__MOSCOW_DISTRICTS.length)
      ? window.__MOSCOW_DISTRICTS
      : ['Тверской', 'Арбат', 'Пресненский', 'Мещанский', 'Басманный', 'Замоскворечье', 'Хамовники', 'Таганский', 'Дорогомилово', 'Красносельский'];
  }

  /* =========================================================
     ОВЕРЛЕЙ ПУБЛИЧНОЙ ОФЕРТЫ
     ========================================================= */
  function openOffer(onAccept) {
    var offerId = 'auth-offer';
    if (FR.isOverlayOpen(offerId)) return;

    var html =
      '<div class="relative w-full max-w-2xl bg-white dark:bg-[#18181c] rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col max-h-[85vh] overflow-hidden">' +
        '<div class="p-5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 flex items-center justify-between">' +
          '<div class="flex items-center space-x-2.5 text-rose-600 dark:text-rose-400">' +
            FR.icon('file-text', 'w-5 h-5') +
            '<h3 class="font-bold text-sm sm:text-base text-black dark:text-white">Публичная оферта и регламент безопасных услуг</h3>' +
          '</div>' +
          '<button type="button" data-offer-close class="p-1.5 text-zinc-400 hover:text-black dark:hover:text-white rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800">' + FR.icon('x', 'w-5 h-5') + '</button>' +
        '</div>' +
        '<div class="p-6 overflow-y-auto space-y-4 text-xs text-zinc-700 dark:text-zinc-300 font-sans leading-relaxed whitespace-pre-wrap selection:bg-rose-500/20">' + FR.esc(OFFER_TEXT) + '</div>' +
        '<div class="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 flex items-center justify-between">' +
          '<span class="text-[11px] text-zinc-500 font-medium">' + OFFER_VERSION + '</span>' +
          '<button type="button" data-offer-accept class="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md transition-colors flex items-center space-x-1.5">' +
            FR.icon('check', 'w-4 h-4') + '<span>Принять условия</span>' +
          '</button>' +
        '</div>' +
      '</div>';

    // Escape закрывает только оферту, не затрагивая оверлей авторизации
    var keyHandler = function (e) {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        FR.closeOverlay(offerId);
      }
    };

    var el = FR.openOverlay(offerId, html, {
      onClose: function () { document.removeEventListener('keydown', keyHandler, true); }
    });
    if (!el) return;
    el.style.zIndex = '60';
    var pop = el.querySelector('.fr-pop');
    if (pop) pop.style.maxWidth = '42rem';
    document.addEventListener('keydown', keyHandler, true);

    el.querySelector('[data-offer-close]').addEventListener('click', function () { FR.closeOverlay(offerId); });
    el.querySelector('[data-offer-accept]').addEventListener('click', function () {
      FR.closeOverlay(offerId);
      if (onAccept) onAccept();
    });
  }

  /* =========================================================
     МОДАЛКА АВТОРИЗАЦИИ
     ========================================================= */
  FR.openAuthModal = function (opts) {
    opts = opts || {};
    var authId = 'auth-modal';
    if (FR.isOverlayOpen(authId)) return;

    var state = {
      mode: 'login',
      step: 'form',
      role: 'client',
      email: '',
      password: '',
      name: '',
      phone: '',
      city: 'Москва',
      district: 'Тверской',
      specialty: 'Маникюр & Педикюр',
      agreedToOffer: false,
      emailCode: '',
      demoCodeNotice: null,
      loading: false,
      error: null,
      secondsLeft: 300
    };

    var countdownTimer = null;

    var el = FR.openOverlay(authId, '<div data-auth-root class="relative w-full max-w-lg bg-[#FBF9F6] rounded-xl shadow-2xl overflow-hidden border border-[#E5E1DA] my-8"></div>', {
      onClose: function () {
        stopCountdown();
        FR.closeOverlay('auth-offer', true);
        if (opts.onClose) opts.onClose();
      }
    });
    if (!el) return;
    var root = el.querySelector('[data-auth-root]');
    if (!root) return;

    /* -------------------- Отсчёт TTL кода -------------------- */
    function stopCountdown() {
      if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
    }

    function updateCountdownLabel() {
      var label = root.querySelector('[data-countdown]');
      if (label) {
        label.textContent = state.secondsLeft <= 0 ? 'код истёк' : (pad(Math.floor(state.secondsLeft / 60)) + ':' + pad(state.secondsLeft % 60));
      }
      var btn = root.querySelector('[data-verify-submit]');
      if (btn) btn.disabled = state.loading || state.emailCode.length < 6 || state.secondsLeft <= 0;
    }

    function startCountdown() {
      stopCountdown();
      state.secondsLeft = 300;
      updateCountdownLabel();
      countdownTimer = setInterval(function () {
        if (state.secondsLeft > 0) state.secondsLeft -= 1;
        updateCountdownLabel();
        if (state.secondsLeft <= 0) stopCountdown();
      }, 1000);
    }

    /* -------------------- Рендер -------------------- */
    function roleButton(role, iconName, title, subtitle) {
      var active = state.role === role;
      return '<button type="button" data-role="' + role + '" class="p-3 rounded-xl border text-left flex items-center space-x-3 transition-all ' +
          (active
            ? 'border-rose-600 bg-rose-50 dark:bg-rose-950/30 text-black dark:text-white ring-2 ring-rose-600/50'
            : 'border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800/50') + '">' +
          '<div class="p-2 rounded-lg ' + (active ? 'bg-rose-600 text-white' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500') + '">' + FR.icon(iconName, 'w-4 h-4') + '</div>' +
          '<div><p class="text-xs font-bold">' + title + '</p><p class="text-[10px] text-zinc-400">' + subtitle + '</p></div>' +
        '</button>';
    }

    function specialtySelect() {
      var opts = categories().map(function (c) {
        return '<option value="' + FR.esc(c) + '"' + (c === state.specialty ? ' selected' : '') + '>' + FR.esc(c) + '</option>';
      }).join('');
      return '<div>' +
          '<label class="block text-[10px] uppercase tracking-[0.2em] font-bold text-zinc-500 mb-1">Специализация</label>' +
          '<select data-field="specialty" class="w-full py-2.5 px-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs text-black dark:text-white focus:outline-none focus:border-rose-600">' + opts + '</select>' +
        '</div>';
    }

    function cityInput() {
      return '<div>' +
          '<label class="block text-[10px] uppercase tracking-[0.2em] font-bold text-zinc-500 mb-1">Город</label>' +
          '<input data-field="city" type="text" value="' + FR.esc(state.city) + '" placeholder="Москва" class="w-full px-3 py-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs text-black dark:text-white focus:outline-none focus:border-rose-600">' +
        '</div>';
    }

    function mainForm() {
      return '<form class="space-y-4">' +
        (state.mode === 'register'
          ? '<div>' +
              '<label class="block text-[10px] uppercase tracking-[0.2em] font-bold text-zinc-500 mb-2">Выберите вашу роль:</label>' +
              '<div class="grid grid-cols-2 gap-3">' +
                roleButton('client', 'user', 'Клиент', 'Поиск &amp; Запись') +
                roleButton('master', 'scissors', 'Мастер', 'Портфолио &amp; График') +
              '</div>' +
            '</div>' +

            '<div>' +
              '<label class="block text-[10px] uppercase tracking-[0.2em] font-bold text-zinc-500 mb-1">ФИО / Имя</label>' +
              '<div class="relative">' + FR.icon('user', 'w-3.5 h-3.5 text-zinc-400 absolute left-3.5 top-3') +
                '<input data-field="name" type="text" required value="' + FR.esc(state.name) + '" placeholder="Екатерина Смирнова" class="w-full pl-9 pr-4 py-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs text-black dark:text-white focus:outline-none focus:border-rose-600">' +
              '</div>' +
            '</div>' +

            '<div>' +
              '<label class="block text-[10px] uppercase tracking-[0.2em] font-bold text-zinc-500 mb-1">Номер телефона</label>' +
              '<div class="relative">' + FR.icon('phone', 'w-3.5 h-3.5 text-zinc-400 absolute left-3.5 top-3') +
                '<input data-field="phone" type="tel" required value="' + FR.esc(state.phone) + '" placeholder="+7 (999) 000-00-00" class="w-full pl-9 pr-4 py-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs text-black dark:text-white focus:outline-none focus:border-rose-600">' +
              '</div>' +
            '</div>' +

            '<div class="grid grid-cols-2 gap-3">' +
              '<div>' +
                '<label class="block text-[10px] uppercase tracking-[0.2em] font-bold text-zinc-500 mb-1">Район / Адрес</label>' +
                '<div class="relative">' + FR.icon('map-pin', 'w-3.5 h-3.5 text-zinc-400 absolute left-3.5 top-3') +
                  '<input data-field="district" list="auth-district-list" type="text" required value="' + FR.esc(state.district) + '" placeholder="Тверской" class="w-full pl-9 pr-3 py-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs text-black dark:text-white focus:outline-none focus:border-rose-600">' +
                '</div>' +
              '</div>' +
              (state.role === 'master' ? specialtySelect() : cityInput()) +
            '</div>' +

            '<datalist id="auth-district-list">' + districts().map(function (d) { return '<option value="' + FR.esc(d) + '"></option>'; }).join('') + '</datalist>'
          : '') +

        '<div>' +
          '<label class="block text-[10px] uppercase tracking-[0.2em] font-bold text-zinc-500 mb-1">Электронная почта</label>' +
          '<div class="relative">' + FR.icon('mail', 'w-3.5 h-3.5 text-zinc-400 absolute left-3.5 top-3') +
            '<input data-field="email" type="email" required value="' + FR.esc(state.email) + '" placeholder="elena.french@beauty.ru" class="w-full pl-9 pr-4 py-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs text-black dark:text-white focus:outline-none focus:border-rose-600">' +
          '</div>' +
        '</div>' +

        '<div>' +
          '<label class="block text-[10px] uppercase tracking-[0.2em] font-bold text-zinc-500 mb-1">Пароль</label>' +
          '<div class="relative">' + FR.icon('lock', 'w-3.5 h-3.5 text-zinc-400 absolute left-3.5 top-3') +
            '<input data-field="password" type="password" required value="' + FR.esc(state.password) + '" placeholder="••••••••" class="w-full pl-9 pr-10 py-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs text-black dark:text-white focus:outline-none focus:border-rose-600">' +
            '<button type="button" data-toggle-pass title="Показать пароль" class="absolute right-2.5 top-2.5 p-0.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">' + FR.icon('eye', 'w-4 h-4') + '</button>' +
          '</div>' +
        '</div>' +

        (state.mode === 'register'
          ? '<div class="p-3 bg-zinc-50 dark:bg-zinc-900/90 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-2">' +
              '<label class="flex items-start space-x-3 cursor-pointer select-none">' +
                '<input data-field="agreedToOffer" type="checkbox" required' + (state.agreedToOffer ? ' checked' : '') + ' class="mt-0.5 w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 cursor-pointer shrink-0">' +
                '<span class="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">Я ознакомлен(а) и безоговорочно принимаю условия ' +
                  '<button type="button" data-open-offer class="text-rose-600 dark:text-rose-400 font-bold underline hover:text-rose-700 transition-colors">Публичной оферты (пользовательского соглашения)</button>' +
                  ' и регламента Безопасных бьюти-сделок.</span>' +
              '</label>' +
            '</div>'
          : '') +

        '<button type="submit" ' + ((state.loading || (state.mode === 'register' && !state.agreedToOffer)) ? 'disabled ' : '') +
          'class="w-full py-3 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold text-[10px] uppercase tracking-widest rounded-xl shadow-md transition-all flex items-center justify-center space-x-2">' +
          (state.loading
            ? '<span>Загрузка...</span>'
            : '<span>' + (state.mode === 'login' ? 'Войти' : 'Зарегистрироваться') + '</span>' + FR.icon('arrow-right', 'w-3.5 h-3.5 text-white')) +
        '</button>' +
      '</form>';
    }

    function verifyForm() {
      return '<form class="space-y-5">' +
        (state.demoCodeNotice
          ? '<div class="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold rounded-xl text-center">' + FR.esc(state.demoCodeNotice) + '</div>'
          : '') +
        '<div class="text-center space-y-2">' +
          '<label class="block text-xs uppercase tracking-[0.2em] font-bold text-zinc-600 dark:text-zinc-300">Введите 6-значный код из письма</label>' +
          '<input data-field="emailCode" type="text" maxlength="6" required value="' + FR.esc(state.emailCode) + '" placeholder="123456" class="w-full text-center text-3xl font-mono tracking-[0.5em] py-3.5 bg-zinc-50 dark:bg-zinc-900 border-2 border-zinc-300 dark:border-zinc-700 focus:border-rose-600 rounded-xl text-black dark:text-white font-bold focus:outline-none">' +
          '<p class="text-[11px] text-zinc-500 dark:text-zinc-400">Код действителен 5 минут. Проверьте папку Входящие или Спам. Осталось: <span data-countdown class="font-mono font-bold text-rose-600 dark:text-rose-400">05:00</span></p>' +
        '</div>' +
        '<div class="space-y-2 pt-2">' +
          '<button data-verify-submit type="submit" ' + ((state.loading || state.emailCode.length < 6 || state.secondsLeft <= 0) ? 'disabled ' : '') +
            'class="w-full py-3.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-widest rounded-xl shadow-md transition-all flex items-center justify-center space-x-2">' +
            (state.loading
              ? '<span>Проверка кода...</span>'
              : '<span>Подтвердить и завершить</span>' + FR.icon('arrow-right', 'w-4 h-4 text-white')) +
          '</button>' +
          '<div class="flex items-center justify-between pt-2">' +
            '<button type="button" data-back class="text-xs font-bold text-zinc-500 hover:text-black dark:hover:text-white transition-colors">← Изменить данных</button>' +
            '<button type="button" data-resend ' + (state.loading ? 'disabled ' : '') + 'class="text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline">Отправить код повторно</button>' +
          '</div>' +
        '</div>' +
      '</form>';
    }

    function footer() {
      return '<div class="text-center pt-2 border-t border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500">' +
        (state.mode === 'login'
          ? '<p>Ещё нет аккаунта? <button type="button" data-toggle-mode class="font-bold text-rose-600 dark:text-rose-500 hover:underline ml-1">Зарегистрироваться</button></p>'
          : '<p>Уже есть аккаунт? <button type="button" data-toggle-mode class="font-bold text-rose-600 dark:text-rose-500 hover:underline ml-1">Войти</button></p>') +
      '</div>';
    }

    function view() {
      var title = state.mode === 'login'
        ? 'Вход в личный кабинет'
        : state.step === 'verify_email'
          ? 'Подтверждение Email'
          : 'Создать аккаунт';

      var subtitle = state.mode === 'login'
        ? ((window.__SITE_SETTINGS && window.__SITE_SETTINGS.loginSubtitle) || 'Войдите, чтобы просматривать записи, общаться в чатах и вести профиль')
        : state.step === 'verify_email'
          ? ('Мы отправили 6-значный код на ' + state.email)
          : 'Зарегистрируйтесь как мастер или клиент для онлайн-записи и публикаций';

      return '<button type="button" data-close class="absolute top-4 right-4 z-10 p-2 text-[#8C8376] hover:text-[#1A1A1A] bg-[#F1EDE4]/80 hover:bg-[#E5E1DA] rounded-full transition-colors">' + FR.icon('x', 'w-4 h-4') + '</button>' +
        '<div class="bg-black p-8 text-white relative overflow-hidden border-b border-zinc-800">' +
          '<div class="absolute -right-8 -bottom-8 w-32 h-32 bg-rose-600/20 rounded-full blur-xl"></div>' +
          '<div class="flex items-center space-x-2 text-rose-500 text-[10px] font-bold uppercase tracking-[0.2em] mb-2">' +
            FR.icon('sparkles', 'w-3.5 h-3.5') + '<span>Artisanal Network</span>' +
          '</div>' +
          '<h2 class="text-2xl font-serif italic font-light">' + FR.esc(title) + '</h2>' +
          '<p class="text-zinc-300 text-xs mt-1 font-semibold">' + FR.esc(subtitle) + '</p>' +
        '</div>' +
        '<div class="p-6 sm:p-8 space-y-6 bg-white dark:bg-[#121215]">' +
          (state.error
            ? '<div class="p-3.5 bg-rose-500/10 border border-rose-600/30 rounded-xl text-rose-600 dark:text-rose-400 text-xs font-bold">' + FR.esc(state.error) + '</div>'
            : '') +
          (state.step === 'verify_email' ? verifyForm() : mainForm()) +
          footer() +
        '</div>';
    }

    /* -------------------- Действия -------------------- */
    function finish(user) {
      stopCountdown();
      FR.closeOverlay(authId, true);
      if (opts.onSuccess) opts.onSuccess(user);
    }

    function handleStart() {
      state.error = null;
      if (state.mode === 'register' && !state.agreedToOffer) {
        state.error = 'Для продолжения необходимо принять условия Публичной оферты.';
        render();
        return;
      }
      state.loading = true;
      render();

      if (state.mode === 'login') {
        FR.api.login(state.email, state.password).then(function (res) {
          state.loading = false;
          finish(res.user);
        }).catch(function (err) {
          state.loading = false;
          state.error = (err && err.message) || 'Ошибка обработки запроса';
          render();
        });
      } else {
        FR.api.sendEmailCode(state.email).then(function () {
          state.loading = false;
          state.step = 'verify_email';
          state.emailCode = '';
          state.demoCodeNotice = '✉️ 6-значный код отправлен на ' + state.email + '. Проверьте папку Входящие или Спам.';
          render();
          startCountdown();
        }).catch(function (err) {
          state.loading = false;
          state.error = (err && err.message) || 'Ошибка обработки запроса';
          render();
        });
      }
    }

    function handleVerifyAndRegister() {
      state.error = null;
      state.loading = true;
      render();

      FR.api.verifyEmailCode(state.email, state.emailCode).then(function () {
        return FR.api.register({
          email: state.email,
          password: state.password,
          name: state.name,
          phone: state.phone,
          role: state.role,
          city: state.city,
          district: state.district,
          specialty: state.role === 'master' ? state.specialty : undefined
        });
      }).then(function (res) {
        state.loading = false;
        finish(res.user);
      }).catch(function (err) {
        state.loading = false;
        state.error = (err && err.message) || 'Ошибка проверки кода';
        render();
      });
    }

    function handleResendCode() {
      state.error = null;
      state.loading = true;
      render();
      FR.api.sendEmailCode(state.email).then(function () {
        state.loading = false;
        state.demoCodeNotice = '✉️ Новый 6-значный код отправлен на ' + state.email + '. Проверьте папку Входящие или Спам.';
        render();
        startCountdown();
      }).catch(function (err) {
        state.loading = false;
        state.error = (err && err.message) || 'Не удалось переотправить код';
        render();
      });
    }

    /* -------------------- Связывание событий -------------------- */
    function bind() {
      root.querySelector('[data-close]').addEventListener('click', function () { FR.closeOverlay(authId); });

      var modeBtn = root.querySelector('[data-toggle-mode]');
      if (modeBtn) modeBtn.addEventListener('click', function () {
        state.mode = state.mode === 'login' ? 'register' : 'login';
        state.agreedToOffer = false;
        state.step = 'form';
        state.error = null;
        stopCountdown();
        render();
      });

      root.querySelectorAll('[data-role]').forEach(function (b) {
        b.addEventListener('click', function () {
          state.role = b.getAttribute('data-role');
          render();
        });
      });

      var passToggle = root.querySelector('[data-toggle-pass]');
      if (passToggle) passToggle.addEventListener('click', function () {
        var inp = root.querySelector('[data-field="password"]');
        if (!inp) return;
        var show = inp.type === 'password';
        inp.type = show ? 'text' : 'password';
        passToggle.title = show ? 'Скрыть пароль' : 'Показать пароль';
      });

      var agree = root.querySelector('[data-field="agreedToOffer"]');
      if (agree) agree.addEventListener('change', function () {
        state.agreedToOffer = agree.checked;
        render();
      });

      var offerLink = root.querySelector('[data-open-offer]');
      if (offerLink) offerLink.addEventListener('click', function (e) {
        e.preventDefault();
        openOffer(function () { state.agreedToOffer = true; render(); });
      });

      root.querySelectorAll('[data-field]').forEach(function (inp) {
        var key = inp.getAttribute('data-field');
        if (key === 'agreedToOffer') return;
        inp.addEventListener('input', function () {
          state[key] = inp.value;
          if (key === 'emailCode') updateCountdownLabel();
        });
      });

      var backBtn = root.querySelector('[data-back]');
      if (backBtn) backBtn.addEventListener('click', function () { state.step = 'form'; render(); });

      var resendBtn = root.querySelector('[data-resend]');
      if (resendBtn) resendBtn.addEventListener('click', handleResendCode);

      var form = root.querySelector('form');
      if (form) form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (state.step === 'verify_email') handleVerifyAndRegister(); else handleStart();
      });

      updateCountdownLabel();
    }

    function render() {
      root.innerHTML = view();
      bind();
    }

    render();
  };

  /* Запасная точка входа (app.js переопределяет её при загрузке). */
  FR.openAuth = function () {
    FR.openAuthModal({
      onSuccess: function (user) {
        FR.state.user = user;
        window.location.reload();
      }
    });
  };
})();
