/**
 * Раздел «Лента вдохновения» (порт FeedSection.tsx).
 * Публикации работ мастеров, лайки, комментарии, удаление своих работ.
 */
(function () {
  'use strict';
  var FR = window.FR;

  /* ----------------------------- Локальный стейт ----------------------------- */
  var listRoot = null;                 // <main id="app-main">
  var imageIndexMap = {};              // workId -> индекс активного изображения
  var activeCommentWorkId = null;      // открытая модалка комментариев
  var activeComments = [];             // комментарии открытой работы
  var loadingComments = false;

  /* -------------------------------- Хелперы --------------------------------- */
  function findWork(workId) {
    var list = FR.state.works || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === workId) return list[i];
    }
    return null;
  }

  function cardEl(workId) {
    if (!listRoot) return null;
    var cards = listRoot.querySelectorAll('[data-work-card]');
    for (var i = 0; i < cards.length; i++) {
      if (cards[i].getAttribute('data-work-card') === workId) return cards[i];
    }
    return null;
  }

  function canDelete(work) {
    var u = FR.state.user;
    return !!(u && (u.id === work.masterId || u.role === 'master'));
  }

  /* --------------------------------- Разметка -------------------------------- */
  function renderBanner() {
    return '' +
      '<div data-style-key="feedHero" class="bg-zinc-100 dark:bg-[#121215] rounded-xl p-6 sm:p-8 text-black dark:text-white shadow-xs relative overflow-hidden border border-zinc-200 dark:border-zinc-800">' +
        '<div class="absolute -right-12 -bottom-12 w-56 h-56 bg-rose-600/10 rounded-full blur-2xl pointer-events-none"></div>' +
        '<div class="relative z-10 max-w-xl space-y-3">' +
          '<span class="inline-flex items-center space-x-1.5 px-3 py-1 bg-white dark:bg-zinc-800 rounded-full text-[10px] uppercase tracking-[0.2em] font-extrabold text-rose-600 dark:text-rose-500 border border-zinc-200 dark:border-zinc-700 shadow-2xs">' +
            FR.icon('sparkles', 'w-3 h-3 text-rose-500') +
            '<span>Curated Artistry Feed</span>' +
          '</span>' +
          '<h1 class="text-2xl sm:text-3xl font-serif font-black tracking-tight text-black dark:text-white">Эстетика &amp; Высокое Искусство Бьюти</h1>' +
          '<p class="text-zinc-600 dark:text-zinc-400 text-xs sm:text-sm leading-relaxed font-normal">Эксклюзивная подборка авторских работ мастеров сети French. Выбирайте идеальные референсы и записывайтесь напрямую к лучшим авторам.</p>' +
        '</div>' +
      '</div>';
  }

  function renderEmpty() {
    return '' +
      '<div class="bg-white dark:bg-[#121215] rounded-xl border border-zinc-200 dark:border-zinc-800 p-12 text-center space-y-3 shadow-2xs">' +
        '<p class="font-sans font-extrabold text-black dark:text-white text-xl">Пока нет опубликованных работ</p>' +
        '<p class="text-xs text-zinc-500 dark:text-zinc-400 font-normal max-w-md mx-auto leading-relaxed">Лента сообщества пуста. Зарегистрируйтесь как мастер, чтобы опубликовать первые работы своего портфолио!</p>' +
      '</div>';
  }

  function renderCustomBlocks() {
    var blocks = (window.__SITE_SETTINGS && window.__SITE_SETTINGS.customBlocks) || [];
    return blocks.filter(function (block) { return block && block.enabled; }).map(function (block) {
      return '<aside class="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121215] p-5 sm:p-6 shadow-xs">' +
        '<h2 class="font-bold text-base text-black dark:text-white">' + FR.esc(block.title) + '</h2>' +
        '<p class="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300 whitespace-pre-line">' + FR.esc(block.body) + '</p>' +
      '</aside>';
    }).join('');
  }

  function likeButtonClasses(liked) {
    return 'flex items-center space-x-1.5 text-xs font-bold px-3 py-1.5 rounded-full transition-all ' +
      (liked
        ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900'
        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:text-black dark:hover:text-white');
  }

  function likeButtonInner(work) {
    var liked = !!work.likedByCurrentUser;
    return FR.icon('heart', 'w-4 h-4' + (liked ? ' fill-rose-600 text-rose-600 dark:fill-rose-400 dark:text-rose-400' : '')) +
      '<span>' + FR.esc(work.likesCount) + '</span>';
  }

  function renderDots(count, current) {
    var out = '';
    for (var i = 0; i < count; i++) {
      out += '<div class="w-2 h-2 rounded-full transition-all ' + (i === current ? 'bg-white w-4' : 'bg-white/50') + '"></div>';
    }
    return out;
  }

  function renderWorkCard(work) {
    var images = work.images || [];
    var idx = imageIndexMap[work.id] || 0;
    var currentImg = images[idx] || images[0];

    var header =
      '<div class="p-4 sm:p-5 flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800">' +
        '<div data-action="master" data-master-id="' + FR.esc(work.masterId) + '" class="flex items-center space-x-3 cursor-pointer group">' +
          '<img src="' + FR.esc(FR.avatarSrc(work.masterAvatar)) + '"' + FR.onerror('avatar') + ' alt="' + FR.esc(work.masterName) + '" class="w-11 h-11 rounded-full object-cover ring-2 ring-rose-600/30 group-hover:scale-105 transition-transform" />' +
          '<div>' +
            '<div class="flex items-center space-x-2">' +
              '<h3 class="font-sans font-bold text-base text-black dark:text-white group-hover:text-rose-600 dark:group-hover:text-rose-500 transition-colors">' + FR.esc(work.masterName) + '</h3>' +
              '<span class="bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-[9px] uppercase tracking-wider font-extrabold px-2.5 py-0.5 rounded-full border border-zinc-200 dark:border-zinc-700">' + FR.esc(work.masterSpecialty || 'Мастер') + '</span>' +
            '</div>' +
            '<div class="flex items-center space-x-2 text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mt-0.5">' +
              '<span class="flex items-center font-bold">' + FR.icon('map-pin', 'w-3 h-3 text-rose-600 dark:text-rose-500 mr-0.5') + FR.esc(work.masterDistrict) + '</span>' +
              '<span>•</span>' +
              '<span>' + FR.esc(FR.fmtDate(work.createdAt)) + '</span>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="flex items-center space-x-2">' +
          (canDelete(work)
            ? '<button data-action="delete" data-work-id="' + FR.esc(work.id) + '" title="Удалить работу" class="p-2 text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors">' + FR.icon('trash-2', 'w-4 h-4') + '</button>'
            : '') +
          '<button data-action="master" data-master-id="' + FR.esc(work.masterId) + '" class="px-4 py-2 bg-black dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-black text-[10px] uppercase tracking-widest font-extrabold rounded-lg transition-all flex items-center space-x-1.5 shadow-2xs">' +
            FR.icon('calendar', 'w-3.5 h-3.5 text-rose-500') +
            '<span>Записаться</span>' +
          '</button>' +
        '</div>' +
      '</div>';

    var slider =
      '<div class="relative bg-zinc-950 aspect-4/3 sm:aspect-16/10 group overflow-hidden">' +
        '<img data-slider-img src="' + FR.esc(FR.imgSrc(currentImg)) + '"' + FR.onerror('work') + ' alt="' + FR.esc(work.title) + '" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-101" />' +
        (work.price
          ? '<div class="absolute top-4 right-4 bg-black/80 backdrop-blur-md text-white font-black text-xs px-3.5 py-1.5 rounded-lg shadow-sm border border-white/20">от ' + FR.esc(FR.money(work.price)) + ' ₽</div>'
          : '') +
        (images.length > 1
          ? '<button data-action="prev-img" data-work-id="' + FR.esc(work.id) + '" class="absolute left-3 top-1/2 -translate-y-1/2 p-2 bg-black/60 text-white rounded-full opacity-80 hover:opacity-100 backdrop-blur-xs transition-opacity">' + FR.icon('chevron-left', 'w-4 h-4') + '</button>' +
            '<button data-action="next-img" data-work-id="' + FR.esc(work.id) + '" class="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-black/60 text-white rounded-full opacity-80 hover:opacity-100 backdrop-blur-xs transition-opacity">' + FR.icon('chevron-right', 'w-4 h-4') + '</button>' +
            '<div data-slider-dots class="absolute bottom-3 left-1/2 -translate-x-1/2 flex space-x-1.5">' + renderDots(images.length, idx) + '</div>'
          : '') +
      '</div>';

    var body =
      '<div class="p-5 space-y-3 bg-white dark:bg-[#121215]">' +
        '<div class="flex items-center justify-between pt-1">' +
          '<div class="flex items-center space-x-3">' +
            '<button data-action="like" data-work-id="' + FR.esc(work.id) + '" class="' + likeButtonClasses(!!work.likedByCurrentUser) + '">' + likeButtonInner(work) + '</button>' +
            '<button data-action="comments" data-work-id="' + FR.esc(work.id) + '" class="flex items-center space-x-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:text-black dark:hover:text-white transition-all">' +
              FR.icon('message-circle', 'w-4 h-4 text-zinc-500') +
              '<span>' + FR.esc(work.commentsCount) + ' коммент.</span>' +
            '</button>' +
          '</div>' +
          '<span class="text-[9px] uppercase tracking-widest font-extrabold text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 rounded-md border border-zinc-200 dark:border-zinc-700">' + FR.esc(work.category) + '</span>' +
        '</div>' +
        '<div>' +
          '<h4 class="font-sans font-bold text-lg text-black dark:text-white">' + FR.esc(work.title) + '</h4>' +
          '<p class="text-xs text-zinc-600 dark:text-zinc-400 mt-1 leading-relaxed font-normal">' + FR.esc(work.description) + '</p>' +
        '</div>' +
      '</div>';

    return '<article data-work-card="' + FR.esc(work.id) + '" data-style-key="feedCard" class="fr-fade-up bg-white dark:bg-[#121215] rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-2xs overflow-hidden hover:border-zinc-300 dark:hover:border-zinc-700 transition-all">' +
      header + slider + body +
    '</article>';
  }

  /* --------------------------------- Список ---------------------------------- */
  function renderList(root) {
    listRoot = root;
    var works = FR.state.works || [];

    var html = '<div class="max-w-4xl mx-auto space-y-8 pb-16">' +
      renderBanner() +
      renderCustomBlocks() +
      '<div class="space-y-8">' +
        (works.length === 0 ? renderEmpty() : works.map(renderWorkCard).join('')) +
      '</div>' +
    '</div>';

    root.innerHTML = html;
  }

  /* ------------------------------- Лайк работы ------------------------------- */
  function handleLike(workId, btn) {
    var u = FR.state.user;
    if (!u) { FR.openAuth(); return; }
    FR.api.toggleLikeWork(workId, u.id).then(function (res) {
      var work = findWork(workId);
      if (!work) return;
      work.likesCount = res.likesCount;
      work.likedByCurrentUser = res.isLiked;
      if (btn) {
        btn.className = likeButtonClasses(!!work.likedByCurrentUser);
        btn.innerHTML = likeButtonInner(work);
      }
    }).catch(function (e) {
      FR.toast(e.message || 'Не удалось изменить лайк');
    });
  }

  /* -------------------------------- Слайдер ---------------------------------- */
  function changeImage(workId, delta) {
    var work = findWork(workId);
    if (!work) return;
    var images = work.images || [];
    var max = images.length;
    if (max < 1) return;
    var cur = imageIndexMap[workId] || 0;
    imageIndexMap[workId] = ((cur + delta) % max + max) % max;

    var card = cardEl(workId);
    if (!card) return;
    var idx = imageIndexMap[workId];
    var img = card.querySelector('[data-slider-img]');
    if (img) img.src = FR.imgSrc(images[idx] || images[0]);
    var dots = card.querySelector('[data-slider-dots]');
    if (dots) dots.innerHTML = renderDots(max, idx);
  }

  /* ------------------------------- Удаление ---------------------------------- */
  function handleDelete(work) {
    FR.confirm({
      title: 'Удаление работы из портфолио',
      message: 'Вы действительно хотите удалить работу <strong>«' + FR.esc(work.title) + '»</strong>? Она будет удалена из портфолио и ленты вдохновения.',
      confirmText: 'Да, удалить',
      cancelText: 'Отмена',
      type: 'danger',
      iconType: 'trash'
    }).then(function (ok) {
      if (!ok) return;
      FR.api.deleteWork(work.id).then(function () {
        FR.state.works = (FR.state.works || []).filter(function (w) { return w.id !== work.id; });
        if (listRoot) renderList(listRoot);
      }).catch(function (e) {
        FR.toast(e.message || 'Не удалось удалить работу');
      });
    });
  }

  /* ------------------------------- Комментарии ------------------------------- */
  function commentsOverlayEl() {
    return document.querySelector('[data-overlay="feed-comments"]');
  }

  function renderComments() {
    var el = commentsOverlayEl();
    if (!el) return;
    var list = el.querySelector('[data-comments-list]');
    if (!list) return;

    if (loadingComments) {
      list.innerHTML = '<p class="text-center text-xs text-zinc-500 py-8">Загрузка комментариев...</p>';
      return;
    }
    if (!activeComments.length) {
      list.innerHTML = '<div class="text-center py-8 text-zinc-500 text-xs font-normal">Пока нет комментариев. Будьте первыми!</div>';
      return;
    }
    list.innerHTML = activeComments.map(function (c) {
      return '<div class="flex space-x-3 text-xs">' +
        '<img src="' + FR.esc(FR.avatarSrc(c.authorAvatar)) + '"' + FR.onerror('avatar') + ' alt="' + FR.esc(c.authorName) + '" class="w-8 h-8 rounded-full object-cover ring-1 ring-zinc-300 dark:ring-zinc-700" />' +
        '<div class="flex-1 bg-zinc-50 dark:bg-zinc-900 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800">' +
          '<div class="flex items-center justify-between mb-1">' +
            '<span class="font-extrabold text-black dark:text-white">' + FR.esc(c.authorName) + '</span>' +
            '<span class="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400">' + FR.esc(FR.fmtTimeShort(c.createdAt)) + '</span>' +
          '</div>' +
          '<p class="text-black dark:text-zinc-100 leading-relaxed font-normal">' + FR.esc(c.text) + '</p>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  function updateCommentFormState() {
    var el = commentsOverlayEl();
    if (!el) return;
    var input = el.querySelector('[data-comment-input]');
    var btn = el.querySelector('[data-comment-submit]');
    if (!input || !btn) return;
    btn.disabled = !FR.state.user || !input.value.trim();
  }

  function updateCommentCount(workId, count) {
    var card = cardEl(workId);
    if (!card) return;
    var btn = card.querySelector('[data-action="comments"]');
    if (!btn) return;
    var span = btn.querySelector('span');
    if (span) span.textContent = count + ' коммент.';
  }

  function handleSendComment() {
    var u = FR.state.user;
    if (!u) { FR.openAuth(); return; }

    var el = commentsOverlayEl();
    if (!el) return;
    var input = el.querySelector('[data-comment-input]');
    var text = (input && input.value ? input.value : '').trim();
    if (!text || !activeCommentWorkId) return;

    var btn = el.querySelector('[data-comment-submit]');
    if (btn) btn.disabled = true;

    FR.api.addComment({
      targetId: activeCommentWorkId,
      targetType: 'work',
      authorId: u.id,
      text: text
    }).then(function (res) {
      activeComments.push(res.comment);
      var work = findWork(activeCommentWorkId);
      if (work) {
        work.commentsCount = FR.num(work.commentsCount) + 1;
        updateCommentCount(work.id, work.commentsCount);
      }
      if (input) input.value = '';
      renderComments();
      updateCommentFormState();
    }).catch(function (e) {
      FR.toast(e.message || 'Не удалось отправить комментарий');
      updateCommentFormState();
    });
  }

  function openComments(work) {
    activeCommentWorkId = work.id;
    activeComments = [];
    loadingComments = true;

    var u = FR.state.user;
    var html =
      '<div class="relative w-full bg-white dark:bg-[#121215] rounded-xl shadow-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 flex flex-col max-h-[85vh]">' +
        '<div class="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-white dark:bg-[#121215]">' +
          '<div>' +
            '<h3 class="font-sans font-bold text-base text-black dark:text-white">Обсуждение</h3>' +
            '<p class="text-xs text-zinc-500 dark:text-zinc-400">' + FR.esc(work.title) + '</p>' +
          '</div>' +
          '<button data-comments-close class="p-1.5 text-zinc-500 hover:text-black dark:hover:text-white bg-zinc-100 dark:bg-zinc-800 rounded-full border border-zinc-200 dark:border-zinc-700">' + FR.icon('x', 'w-4 h-4') + '</button>' +
        '</div>' +
        '<div data-comments-list class="flex-1 overflow-y-auto p-4 space-y-4"></div>' +
        '<form data-comment-form class="p-3 bg-white dark:bg-[#121215] border-t border-zinc-200 dark:border-zinc-800 flex items-center space-x-2">' +
          '<input data-comment-input type="text" placeholder="' + (u ? 'Напишите комментарий...' : 'Войдите, чтобы комментировать') + '"' + (u ? '' : ' disabled') + ' class="flex-1 px-4 py-2.5 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs text-black dark:text-white focus:outline-none focus:border-rose-600" />' +
          '<button data-comment-submit type="submit" disabled class="p-2.5 bg-black dark:bg-white text-white dark:text-black disabled:opacity-40 rounded-lg shadow-2xs transition-colors">' + FR.icon('send', 'w-4 h-4 text-rose-500') + '</button>' +
        '</form>' +
      '</div>';

    var el = FR.openOverlay('feed-comments', html, {
      onClose: function () {
        activeCommentWorkId = null;
        activeComments = [];
        loadingComments = false;
      }
    });
    if (!el) return;

    el.querySelector('[data-comments-close]').addEventListener('click', function () {
      FR.closeOverlay('feed-comments');
    });

    var input = el.querySelector('[data-comment-input]');
    if (input) {
      input.addEventListener('input', updateCommentFormState);
    }
    var form = el.querySelector('[data-comment-form]');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        handleSendComment();
      });
    }

    renderComments();
    updateCommentFormState();

    FR.api.getComments('work', work.id).then(function (res) {
      activeComments = (res && res.comments) || [];
      loadingComments = false;
      renderComments();
    }).catch(function (e) {
      console.error('Error fetching comments:', e);
      loadingComments = false;
      renderComments();
    });
  }

  /* --------------------------------- События --------------------------------- */
  function onClick(e) {
    var t = e.target.closest('[data-action]');
    if (!t || !listRoot || !listRoot.contains(t)) return;

    var action = t.getAttribute('data-action');
    if (action === 'master') {
      FR.openMasterProfile(t.getAttribute('data-master-id'));
      return;
    }

    var workId = t.getAttribute('data-work-id');
    var work = findWork(workId);
    if (!work) return;

    if (action === 'like') handleLike(workId, t);
    else if (action === 'comments') openComments(work);
    else if (action === 'delete') handleDelete(work);
    else if (action === 'prev-img') changeImage(workId, -1);
    else if (action === 'next-img') changeImage(workId, 1);
  }

  function reloadWorks() {
    var uid = FR.state.user ? FR.state.user.id : null;
    FR.api.getWorks(uid).then(function (res) {
      FR.state.works = (res && res.works) || [];
      if (FR.state.tab === 'feed' && listRoot) renderList(listRoot);
    }).catch(function (e) {
      console.error('Error reloading works:', e);
    });
  }

  /* ------------------------------- Регистрация ------------------------------- */
  FR.registerSection('feed', {
    render: function (root) {
      renderList(root);
      if (!root._feedBound) {
        root.addEventListener('click', onClick);
        root._feedBound = true;
      }
    },
    onEvent: function (type) {
      if (type === 'WORK_ADDED' || type === 'WORK_DELETED' || type === 'WORK_LIKED') {
        if (FR.state.tab !== 'feed') return;
        reloadWorks();
      }
    }
  });
})();
