/**
 * Раздел «Поиск бьюти-мастеров» (порт MasterSearchSection.tsx).
 * Фильтры (query, категория, район, цена, рейтинг) + список мастеров.
 * Перерисовывается только правая колонка результатов — ввод текста не теряет фокус.
 */
(function () {
  'use strict';
  var FR = window.FR;

  var DEBOUNCE_MS = 350;

  /* --------------------------- Локальное состояние --------------------------- */
  var query = '';
  var selectedCategory = '';
  var selectedDistrict = '';
  var minPrice;
  var maxPrice;
  var minRating;
  var showFiltersMobile = false;

  var masters = [];
  var loading = false;
  var debounceTimer = null;

  var rootEl = null;
  var resultsEl = null;

  /* --------------------------- Константы разметки --------------------------- */
  var CAT_BTN_BASE = 'w-full text-left px-3 py-1.5 rounded-lg text-xs font-bold transition-colors';
  var CAT_ACTIVE = 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 font-extrabold border border-rose-200 dark:border-rose-900';
  var CAT_INACTIVE = 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900';

  var RATING_BTN_BASE = 'flex-1 py-1.5 text-xs font-black rounded-lg border transition-colors';
  var RATING_ACTIVE = 'bg-rose-600 text-white border-rose-600 shadow-2xs';
  var RATING_INACTIVE = 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-800';

  /* --------------------------- Списки для фильтров --------------------------- */
  function categoriesList() {
    return ['Все услуги'].concat(window.__SERVICE_CATEGORIES || []);
  }

  function districtsList() {
    return window.__MOSCOW_DISTRICTS || [];
  }

  /* --------------------------- Построение фильтров --------------------------- */
  function buildFilters() {
    return {
      query: query.trim() || undefined,
      category: (selectedCategory && selectedCategory !== 'Все услуги') ? selectedCategory : undefined,
      district: selectedDistrict || undefined,
      minPrice: minPrice,
      maxPrice: maxPrice,
      minRating: minRating
    };
  }

  /* --------------------------- Правая колонка: результаты --------------------------- */
  function loadingHtml() {
    return '<div class="text-center py-16 text-zinc-500 text-xs font-normal">Поиск бьюти-артистов...</div>';
  }

  function emptyHtml() {
    return '<div class="bg-white dark:bg-[#121215] p-12 text-center rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-3 shadow-2xs">' +
      '<p class="font-sans font-extrabold text-black dark:text-white text-lg">Мастера по вашим критериям не найдены</p>' +
      '<p class="text-xs text-zinc-500 dark:text-zinc-400 font-normal">Попробуйте уменьшить фильтры цен или выбрать другой район.</p>' +
      '<button data-reset class="px-4 py-2 bg-black dark:bg-white text-white dark:text-black text-[10px] uppercase tracking-widest font-extrabold rounded-lg shadow-2xs hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors">Сбросить фильтры</button>' +
      '</div>';
  }

  function cardHtml(master) {
    return '<div class="bg-white dark:bg-[#121215] p-5 sm:p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-2xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-all flex flex-col sm:flex-row gap-5 items-start sm:items-center justify-between fr-fade-up">' +
      '<div class="flex items-start space-x-4">' +
        '<img src="' + FR.esc(FR.avatarSrc(master.avatar)) + '"' + FR.onerror('avatar') + ' alt="' + FR.esc(master.name) + '" class="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover ring-2 ring-rose-600/30 shrink-0">' +
        '<div class="space-y-1">' +
          '<div class="flex items-center space-x-2">' +
            '<h3 class="font-sans font-extrabold text-lg text-black dark:text-white">' + FR.esc(master.name) + '</h3>' +
            '<span class="bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-[9px] uppercase tracking-wider font-extrabold px-2.5 py-0.5 rounded-full border border-zinc-200 dark:border-zinc-700">' + FR.esc(master.specialty || 'Мастер') + '</span>' +
          '</div>' +
          '<div class="flex items-center space-x-3 text-xs">' +
            '<div class="flex items-center text-amber-500 font-bold">' +
              FR.icon('star', 'w-3.5 h-3.5 fill-amber-500 mr-1 text-amber-500') +
              '<span>' + FR.esc(master.rating || 5.0) + '</span>' +
            '</div>' +
            '<span class="text-zinc-300 dark:text-zinc-700">•</span>' +
            '<span class="text-zinc-500 dark:text-zinc-400 font-bold">' + FR.esc(master.reviewCount || 0) + ' отзывов</span>' +
            '<span class="text-zinc-300 dark:text-zinc-700">•</span>' +
            '<span class="text-zinc-500 dark:text-zinc-400 font-bold flex items-center">' +
              FR.icon('map-pin', 'w-3 h-3 text-rose-500 mr-0.5') + ' ' + FR.esc(master.district) +
            '</span>' +
          '</div>' +
          '<p class="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2 max-w-lg mt-1 font-normal leading-relaxed">' + FR.esc(master.bio || 'Опытный бьюти-мастер. Индивидуальный подход к каждому клиенту.') + '</p>' +
        '</div>' +
      '</div>' +
      '<div class="w-full sm:w-auto flex sm:flex-col items-end justify-between sm:justify-center border-t sm:border-t-0 pt-3 sm:pt-0 border-zinc-200 dark:border-zinc-800 gap-3 shrink-0">' +
        '<button data-open-master="' + FR.esc(master.id) + '" class="w-full sm:w-auto px-5 py-2.5 bg-black dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-black text-[10px] uppercase tracking-widest font-extrabold rounded-lg shadow-2xs transition-all flex items-center justify-center space-x-1.5">' +
          FR.icon('calendar', 'w-3.5 h-3.5 text-rose-500') +
          '<span>Профиль &amp; Календарь</span>' +
          FR.icon('chevron-right', 'w-3.5 h-3.5') +
        '</button>' +
      '</div>' +
    '</div>';
  }

  function renderResults() {
    if (!resultsEl) return;
    if (loading) {
      resultsEl.innerHTML = loadingHtml();
      return;
    }
    if (!masters.length) {
      resultsEl.innerHTML = emptyHtml();
      return;
    }
    resultsEl.innerHTML = masters.map(cardHtml).join('');
  }

  /* --------------------------- Загрузка данных --------------------------- */
  function loadMasters() {
    loading = true;
    renderResults();
    return FR.api.searchMasters(buildFilters()).then(function (res) {
      masters = (res && res.masters) || [];
    }).catch(function (e) {
      console.error('Error searching masters:', e);
      masters = [];
    }).then(function () {
      loading = false;
      renderResults();
    });
  }

  /* --------------------------- Обновление состояния кнопок --------------------------- */
  function updateCategoryButtons() {
    rootEl.querySelectorAll('[data-category]').forEach(function (btn) {
      var cat = btn.getAttribute('data-category');
      var active = (selectedCategory === cat) || (!selectedCategory && cat === 'Все услуги');
      btn.className = CAT_BTN_BASE + ' ' + (active ? CAT_ACTIVE : CAT_INACTIVE);
    });
  }

  function updateRatingButtons() {
    rootEl.querySelectorAll('[data-rating]').forEach(function (btn) {
      var attr = btn.getAttribute('data-rating');
      var val = attr === 'all' ? undefined : Number(attr);
      var active = minRating === val;
      btn.className = RATING_BTN_BASE + ' ' + (active ? RATING_ACTIVE : RATING_INACTIVE);
    });
  }

  /* --------------------------- Сброс фильтров --------------------------- */
  function setFieldValue(selector, value) {
    var el = rootEl.querySelector(selector);
    if (el) el.value = value;
  }

  function resetFilters() {
    query = '';
    selectedCategory = '';
    selectedDistrict = '';
    minPrice = undefined;
    maxPrice = undefined;
    minRating = undefined;

    if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null; }

    setFieldValue('[data-query]', '');
    setFieldValue('[data-district]', '');
    setFieldValue('[data-min-price]', '');
    setFieldValue('[data-max-price]', '');
    updateCategoryButtons();
    updateRatingButtons();

    loadMasters();
  }

  /* --------------------------- Мобильный тумблер фильтров --------------------------- */
  function toggleFiltersMobile() {
    showFiltersMobile = !showFiltersMobile;
    var sidebar = rootEl.querySelector('[data-sidebar]');
    if (sidebar) sidebar.classList.toggle('hidden', !showFiltersMobile);
  }

  /* --------------------------- Обработчики (навешиваются один раз) --------------------------- */
  function onClick(e) {
    var t = e.target;
    var btn = (t && t.closest) ? t.closest('[data-reset],[data-category],[data-rating],[data-open-master],[data-toggle-filters]') : null;
    if (!btn) return;

    if (btn.hasAttribute('data-reset')) {
      resetFilters();
      return;
    }
    if (btn.hasAttribute('data-toggle-filters')) {
      toggleFiltersMobile();
      return;
    }
    if (btn.hasAttribute('data-category')) {
      var cat = btn.getAttribute('data-category');
      selectedCategory = (cat === 'Все услуги') ? '' : cat;
      updateCategoryButtons();
      loadMasters();
      return;
    }
    if (btn.hasAttribute('data-rating')) {
      var attr = btn.getAttribute('data-rating');
      minRating = (attr === 'all') ? undefined : Number(attr);
      updateRatingButtons();
      loadMasters();
      return;
    }
    if (btn.hasAttribute('data-open-master')) {
      FR.openMasterProfile(btn.getAttribute('data-open-master'));
      return;
    }
  }

  function onInput(e) {
    var t = e.target;
    if (!t || !t.hasAttribute) return;

    if (t.hasAttribute('data-query')) {
      query = t.value;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(loadMasters, DEBOUNCE_MS);
      return;
    }
    if (t.hasAttribute('data-min-price')) {
      minPrice = t.value ? Number(t.value) : undefined;
      loadMasters();
      return;
    }
    if (t.hasAttribute('data-max-price')) {
      maxPrice = t.value ? Number(t.value) : undefined;
      loadMasters();
      return;
    }
  }

  function onChange(e) {
    var t = e.target;
    if (t && t.hasAttribute && t.hasAttribute('data-district')) {
      selectedDistrict = t.value;
      loadMasters();
    }
  }

  /* --------------------------- Разметка --------------------------- */
  function sidebarHtml() {
    var cats = categoriesList();
    var districts = districtsList();

    var catButtons = cats.map(function (cat) {
      var active = (!selectedCategory && cat === 'Все услуги');
      return '<button data-category="' + FR.esc(cat) + '" class="' + CAT_BTN_BASE + ' ' + (active ? CAT_ACTIVE : CAT_INACTIVE) + '">' + FR.esc(cat) + '</button>';
    }).join('');

    var districtOptions = districts.map(function (d) {
      return '<option value="' + FR.esc(d) + '">' + FR.esc(d) + '</option>';
    }).join('');

    var ratings = [undefined, 4.0, 4.5, 4.8];
    var ratingButtons = ratings.map(function (r) {
      var attr = (r === undefined) ? 'all' : String(r);
      var active = (minRating === r);
      var label = r ? (r + '★') : 'Все';
      return '<button data-rating="' + attr + '" class="' + RATING_BTN_BASE + ' ' + (active ? RATING_ACTIVE : RATING_INACTIVE) + '">' + FR.esc(label) + '</button>';
    }).join('');

    return '<aside data-sidebar class="md:col-span-1 bg-white dark:bg-[#121215] p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-2xs space-y-5 h-fit hidden md:block">' +
      '<div class="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800">' +
        '<span class="font-sans font-extrabold text-sm text-black dark:text-white flex items-center">' +
          FR.icon('sliders-horizontal', 'w-3.5 h-3.5 mr-2 text-rose-500') + ' Фильтры' +
        '</span>' +
        '<button data-reset class="text-[10px] uppercase tracking-widest font-bold text-zinc-500 hover:text-black dark:hover:text-white">Сбросить</button>' +
      '</div>' +

      '<div>' +
        '<label class="block text-[10px] uppercase tracking-[0.2em] font-extrabold text-zinc-500 dark:text-zinc-400 mb-1.5">Имя мастера / Услуга</label>' +
        '<div class="relative">' +
          FR.icon('search', 'w-3.5 h-3.5 text-zinc-400 absolute left-3 top-3') +
          '<input data-query type="text" value="' + FR.esc(query) + '" placeholder="Анна, Френч, Макияж..." class="w-full pl-9 pr-3 py-2 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs text-black dark:text-white focus:outline-none focus:border-rose-600">' +
        '</div>' +
      '</div>' +

      '<div>' +
        '<label class="block text-[10px] uppercase tracking-[0.2em] font-extrabold text-zinc-500 dark:text-zinc-400 mb-1.5">Категория</label>' +
        '<div class="space-y-1">' + catButtons + '</div>' +
      '</div>' +

      '<div>' +
        '<label class="block text-[10px] uppercase tracking-[0.2em] font-extrabold text-zinc-500 dark:text-zinc-400 mb-1.5">Район / Локация</label>' +
        '<select data-district class="w-full py-2 px-3 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs text-black dark:text-white focus:outline-none focus:border-rose-600">' +
          '<option value="">Все районы</option>' + districtOptions +
        '</select>' +
      '</div>' +

      '<div>' +
        '<label class="block text-[10px] uppercase tracking-[0.2em] font-extrabold text-zinc-500 dark:text-zinc-400 mb-1.5">Диапазон цен (₽)</label>' +
        '<div class="grid grid-cols-2 gap-2">' +
          '<div>' +
            '<span class="text-[9px] uppercase text-zinc-500 block mb-0.5 font-bold">От</span>' +
            '<input data-min-price type="number" value="' + FR.esc(minPrice === undefined ? '' : minPrice) + '" placeholder="1500" class="w-full px-3 py-1.5 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs text-black dark:text-white focus:outline-none focus:border-rose-600">' +
          '</div>' +
          '<div>' +
            '<span class="text-[9px] uppercase text-zinc-500 block mb-0.5 font-bold">До</span>' +
            '<input data-max-price type="number" value="' + FR.esc(maxPrice === undefined ? '' : maxPrice) + '" placeholder="8000" class="w-full px-3 py-1.5 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs text-black dark:text-white focus:outline-none focus:border-rose-600">' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div>' +
        '<label class="block text-[10px] uppercase tracking-[0.2em] font-extrabold text-zinc-500 dark:text-zinc-400 mb-1.5">Минимальный рейтинг</label>' +
        '<div class="flex space-x-2">' + ratingButtons + '</div>' +
      '</div>' +
    '</aside>';
  }

  /* --------------------------- Регистрация раздела --------------------------- */
  FR.registerSection('search', {
    render: function (root) {
      // Свежий монтаж раздела — состояние фильтров по умолчанию.
      query = '';
      selectedCategory = '';
      selectedDistrict = '';
      minPrice = undefined;
      maxPrice = undefined;
      minRating = undefined;
      showFiltersMobile = false;
      masters = [];
      loading = false;
      if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null; }

      rootEl = root;
      root.innerHTML =
        '<div class="max-w-6xl mx-auto space-y-6 pb-16">' +
          '<div class="flex flex-col md:flex-row md:items-center justify-between gap-4">' +
            '<div>' +
              '<h1 class="text-2xl font-sans font-black text-black dark:text-white flex items-center gap-2">' +
                '<span>Поиск бьюти-мастеров</span>' +
                FR.icon('sparkles', 'w-5 h-5 text-rose-500') +
              '</h1>' +
              '<p class="text-xs text-zinc-500 dark:text-zinc-400 mt-1 font-normal">Находите лучших бьюти-артистов по вашему району, ценовой категории и рейтингу</p>' +
            '</div>' +
            '<button data-toggle-filters class="md:hidden flex items-center justify-center space-x-2 px-4 py-2.5 bg-black dark:bg-white text-white dark:text-black text-[10px] uppercase tracking-widest font-extrabold rounded-xl shadow-2xs">' +
              FR.icon('sliders-horizontal', 'w-3.5 h-3.5 text-rose-500') +
              '<span>Фильтры и цены</span>' +
            '</button>' +
          '</div>' +

          '<div class="grid grid-cols-1 md:grid-cols-4 gap-6">' +
            sidebarHtml() +
            '<main data-results class="md:col-span-3 space-y-4"></main>' +
          '</div>' +
        '</div>';

      resultsEl = root.querySelector('[data-results]');

      // Обработчики навешиваются один раз после построения разметки.
      root.addEventListener('click', onClick);
      root.addEventListener('input', onInput);
      root.addEventListener('change', onChange);

      updateCategoryButtons();
      updateRatingButtons();
      loadMasters();
    }
  });
})();
