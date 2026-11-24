/**
 * Раздел «Журнал сообщества» (порт CommunityPostsSection.tsx на ванильный JS).
 * Публикации мастеров: список, лайки, комментарии, создание и удаление постов.
 */
(function () {
  'use strict';
  var FR = window.FR;

  var DEFAULT_POST_IMAGE = 'https://images.unsplash.com/photo-1512496015851-a90fb38ba796?w=800&auto=format&fit=crop&q=80';

  /* ----------------------- Состояние раздела ----------------------- */
  var rootEl = null;             // корневой элемент #app-main
  var activeCommentPost = null;  // пост, открытый в оверлее комментариев
  var comments = [];             // комментарии активного поста

  /* --------------------------- Утилиты ---------------------------- */
  function findPost(id) {
    var posts = FR.state.posts || [];
    for (var i = 0; i < posts.length; i++) {
      if (String(posts[i].id) === String(id)) return posts[i];
    }
    return null;
  }

  /** Значение id, безопасное для использования в attribute-селекторе. */
  function attrSel(value) {
    return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  function likeButtonClass(post) {
    return post.likedByCurrentUser
      ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-300 dark:border-rose-800'
      : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white';
  }

  function likeButtonInner(post) {
    return FR.icon('heart', 'w-4 h-4' + (post.likedByCurrentUser ? ' fill-rose-500 text-rose-500' : '')) +
      '<span data-like-count>' + FR.num(post.likesCount) + '</span>';
  }

  /* --------------------------- Разметка --------------------------- */
  function headerHtml() {
    var isMaster = FR.state.user && FR.state.user.role === 'master';
    return '' +
      '<div class="flex items-center justify-between bg-white dark:bg-[#121215] p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-2xs">' +
        '<div>' +
          '<h1 class="text-2xl font-sans font-black text-black dark:text-white flex items-center space-x-2">' +
            FR.icon('newspaper', 'w-5 h-5 text-rose-500') +
            '<span>Журнал сообщества</span>' +
          '</h1>' +
          '<p class="text-xs text-zinc-500 dark:text-zinc-400 mt-1 font-normal">Авторские колонки мастеров о трендах, уходе и искусстве бьюти</p>' +
        '</div>' +
        (isMaster
          ? '<button data-action="create" class="px-5 py-2.5 bg-black dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-black text-[10px] uppercase tracking-widest font-extrabold rounded-lg shadow-2xs transition-all flex items-center space-x-2">' +
              FR.icon('plus', 'w-4 h-4 text-rose-500') +
              '<span>Опубликовать</span>' +
            '</button>'
          : '') +
      '</div>';
  }

  function emptyStateHtml() {
    return '' +
      '<div class="bg-white dark:bg-[#121215] rounded-xl border border-zinc-200 dark:border-zinc-800 p-12 text-center space-y-3 shadow-2xs">' +
        '<p class="font-sans font-extrabold text-black dark:text-white text-xl">Пока нет публикаций в журнале</p>' +
        '<p class="text-xs text-zinc-500 dark:text-zinc-400 font-normal max-w-md mx-auto leading-relaxed">' +
          'Журнал сообщества пуст. Мастера могут делиться советами по уходу, трендами и авторскими рекомендациями!' +
        '</p>' +
      '</div>';
  }

  function postCardHtml(post) {
    var user = FR.state.user;
    var canDelete = user && (user.id === post.authorId || user.role === 'master');

    var tagsHtml = (post.tags || []).map(function (t) {
      return '<span class="text-[9px] uppercase tracking-wider font-bold text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-900 px-2.5 py-1 rounded-md border border-zinc-200 dark:border-zinc-800">#' +
        FR.esc(t) + '</span>';
    }).join('');

    var imagesHtml = (post.images && post.images.length > 0)
      ? '<div class="rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 max-h-96">' +
          '<img src="' + FR.esc(post.images[0]) + '"' + FR.onerror('work') + ' alt="' + FR.esc(post.title) + '" class="w-full h-full object-cover" />' +
        '</div>'
      : '';

    var deleteHtml = canDelete
      ? '<button data-action="delete" data-post-id="' + FR.esc(post.id) + '" title="Удалить публикацию" class="p-2 text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors">' +
          FR.icon('trash-2', 'w-4 h-4') +
        '</button>'
      : '';

    return '' +
      '<article class="bg-white dark:bg-[#121215] p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-2xs space-y-4 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors fr-fade-up">' +
        '<div class="flex items-center justify-between">' +
          '<div class="flex items-center space-x-3">' +
            '<img src="' + FR.esc(FR.avatarSrc(post.authorAvatar)) + '"' + FR.onerror('avatar') + ' alt="' + FR.esc(post.authorName) + '" class="w-11 h-11 rounded-full object-cover ring-2 ring-rose-600/30" />' +
            '<div>' +
              '<div class="flex items-center space-x-2">' +
                '<h3 class="font-sans font-extrabold text-base text-black dark:text-white">' + FR.esc(post.authorName) + '</h3>' +
                '<span class="bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-[9px] uppercase tracking-wider font-extrabold px-2.5 py-0.5 rounded-full border border-zinc-200 dark:border-zinc-700">' +
                  FR.esc(post.authorSpecialty || 'Мастер') +
                '</span>' +
              '</div>' +
              '<p class="text-[10px] uppercase tracking-wider font-bold text-zinc-500 dark:text-zinc-400 mt-0.5">' + FR.fmtDate(post.createdAt) + '</p>' +
            '</div>' +
          '</div>' +
          deleteHtml +
        '</div>' +

        '<div class="space-y-2">' +
          '<h2 class="font-sans font-extrabold text-lg sm:text-xl text-black dark:text-white">' + FR.esc(post.title) + '</h2>' +
          '<p class="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-line font-normal">' + FR.esc(post.content) + '</p>' +
        '</div>' +

        imagesHtml +

        '<div class="flex items-center justify-between pt-3 border-t border-zinc-200 dark:border-zinc-800">' +
          '<div class="flex items-center space-x-1.5 overflow-x-auto">' + tagsHtml + '</div>' +
          '<div class="flex items-center space-x-3">' +
            '<button data-action="like" data-post-id="' + FR.esc(post.id) + '" class="flex items-center space-x-1.5 text-xs font-bold px-3 py-1.5 rounded-full transition-all ' + likeButtonClass(post) + '">' +
              likeButtonInner(post) +
            '</button>' +
            '<button data-action="comments" data-post-id="' + FR.esc(post.id) + '" class="flex items-center space-x-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white transition-all">' +
              FR.icon('message-circle', 'w-4 h-4 text-zinc-500') +
              '<span data-comments-count>' + FR.num(post.commentsCount) + '</span>' +
            '</button>' +
          '</div>' +
        '</div>' +
      '</article>';
  }

  /** Разметка области изображения в модалке создания (превью ИЛИ загрузка/ссылка). */
  function imageAreaHtml(value) {
    if (value) {
      return '' +
        '<div class="relative rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 group mb-2 max-h-48 bg-black/5 flex items-center justify-center">' +
          '<img src="' + FR.esc(value) + '" alt="Post preview"' + FR.onerror('work') + ' class="max-h-48 w-full object-cover" />' +
          '<button type="button" data-image-remove class="absolute top-2 right-2 p-1.5 bg-black/70 hover:bg-rose-600 text-white rounded-lg transition-colors text-xs flex items-center gap-1">' +
            FR.icon('trash-2', 'w-3.5 h-3.5') +
            'Удалить' +
          '</button>' +
        '</div>';
    }
    return '' +
      '<div class="space-y-2">' +
        '<label class="border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-rose-500 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer bg-zinc-50 dark:bg-zinc-900/50 hover:bg-rose-50/20 transition-all">' +
          FR.icon('cloud-upload', 'w-6 h-6 text-rose-500 mb-1') +
          '<span class="text-xs font-bold text-black dark:text-white">Загрузить фото с устройства</span>' +
          '<span class="text-[10px] text-zinc-500 mt-0.5">PNG, JPG, WebP (автоматическое сжатие)</span>' +
          '<input type="file" accept="image/*" data-image-file class="hidden" />' +
        '</label>' +
        '<div class="relative">' +
          '<div class="absolute inset-0 flex items-center"><div class="w-full border-t border-zinc-200 dark:border-zinc-800"></div></div>' +
          '<div class="relative flex justify-center text-[10px] uppercase"><span class="bg-white dark:bg-[#121215] px-2 text-zinc-400">или укажите ссылку</span></div>' +
        '</div>' +
        '<input type="url" data-image-url value="" placeholder="https://images.unsplash.com/photo-..." class="w-full px-4 py-2 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs text-black dark:text-white focus:outline-none focus:border-rose-600" />' +
      '</div>';
  }

  function commentHtml(c) {
    return '' +
      '<div class="flex space-x-3 text-xs">' +
        '<img src="' + FR.esc(FR.avatarSrc(c.authorAvatar)) + '"' + FR.onerror('avatar') + ' alt="' + FR.esc(c.authorName) + '" class="w-8 h-8 rounded-full object-cover ring-1 ring-zinc-200 dark:ring-zinc-800" />' +
        '<div class="flex-1 bg-zinc-50 dark:bg-zinc-900 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800">' +
          '<span class="font-extrabold text-black dark:text-white block mb-0.5">' + FR.esc(c.authorName) + '</span>' +
          '<p class="text-zinc-700 dark:text-zinc-300 font-normal leading-relaxed">' + FR.esc(c.text) + '</p>' +
        '</div>' +
      '</div>';
  }

  /* --------------------------- Рендер ----------------------------- */
  function render(root) {
    rootEl = root;
    var posts = FR.state.posts || [];
    var listHtml = posts.length
      ? posts.map(postCardHtml).join('')
      : emptyStateHtml();

    root.innerHTML = '' +
      '<div class="max-w-4xl mx-auto space-y-6 pb-16">' +
        headerHtml() +
        '<div class="space-y-6">' + listHtml + '</div>' +
      '</div>';

    root.onclick = onRootClick;
  }

  function onRootClick(e) {
    var actionEl = e.target && e.target.closest ? e.target.closest('[data-action]') : null;
    if (!actionEl || !rootEl.contains(actionEl)) return;

    var action = actionEl.getAttribute('data-action');
    var postId = actionEl.getAttribute('data-post-id');

    if (action === 'create') { openCreateModal(); return; }
    if (action === 'like') { handleLike(postId); return; }
    if (action === 'comments') { openComments(postId); return; }
    if (action === 'delete') { handleDelete(postId); return; }
  }

  /* --------------------------- Лайки ------------------------------ */
  function handleLike(postId) {
    var user = FR.state.user;
    if (!user) { FR.openAuth(); return; }

    FR.api.toggleLikePost(postId, user.id).then(function (res) {
      var post = findPost(postId);
      if (!post) return;
      post.likesCount = FR.num(res.likesCount);
      post.likedByCurrentUser = !!res.isLiked;
      updateLikeButton(post);
    }).catch(function (err) {
      console.error('Error toggling post like:', err);
    });
  }

  /** Локально обновляет только кнопку лайка (без перерисовки списка). */
  function updateLikeButton(post) {
    if (!rootEl) return;
    var btn = rootEl.querySelector('[data-action="like"][data-post-id="' + attrSel(post.id) + '"]');
    if (!btn) return;
    btn.className = 'flex items-center space-x-1.5 text-xs font-bold px-3 py-1.5 rounded-full transition-all ' + likeButtonClass(post);
    btn.innerHTML = likeButtonInner(post);
  }

  /* ------------------------- Комментарии -------------------------- */
  function openComments(postId) {
    var post = findPost(postId);
    if (!post) return;

    activeCommentPost = post;
    comments = [];
    var user = FR.state.user;

    var html = '' +
      '<div class="relative w-full bg-white dark:bg-[#121215] rounded-xl shadow-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 flex flex-col max-h-[85vh]">' +
        '<div class="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-white dark:bg-[#121215]">' +
          '<div>' +
            '<h3 class="font-sans font-extrabold text-base text-black dark:text-white">Обсуждение статьи</h3>' +
            '<p class="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-1 font-normal">' + FR.esc(post.title) + '</p>' +
          '</div>' +
          '<button type="button" data-comments-close class="p-1.5 text-zinc-400 hover:text-black dark:hover:text-white rounded-full">' +
            FR.icon('x', 'w-5 h-5') +
          '</button>' +
        '</div>' +
        '<div data-comments-body class="flex-1 overflow-y-auto p-4 space-y-4">' +
          '<p data-comments-loading class="text-center text-xs text-zinc-500 py-8 font-normal">Загрузка...</p>' +
          '<div data-comments-list class="space-y-4"></div>' +
        '</div>' +
        '<form data-comment-form class="p-3 bg-white dark:bg-[#121215] border-t border-zinc-200 dark:border-zinc-800 flex items-center space-x-2">' +
          '<input type="text" data-comment-input value=""' + (user ? '' : ' disabled') + ' placeholder="' + (user ? 'Ваш комментарий...' : 'Войдите, чтобы написать') + '" class="flex-1 px-4 py-2.5 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs text-black dark:text-white focus:outline-none focus:border-rose-600 disabled:opacity-60" />' +
          '<button type="submit" data-comment-send disabled class="p-2.5 bg-black dark:bg-white text-white dark:text-black rounded-lg disabled:opacity-50">' +
            FR.icon('send', 'w-4 h-4 text-rose-500') +
          '</button>' +
        '</form>' +
      '</div>';

    var el = FR.openOverlay('post-comments', html, { onClose: function () { activeCommentPost = null; } });
    if (!el) return;

    var bodyEl = el.querySelector('[data-comments-body]');
    var listEl = el.querySelector('[data-comments-list]');
    var loadingEl = el.querySelector('[data-comments-loading]');
    var formEl = el.querySelector('[data-comment-form]');
    var inputEl = el.querySelector('[data-comment-input]');
    var sendBtn = el.querySelector('[data-comment-send]');

    el.querySelector('[data-comments-close]').addEventListener('click', function () {
      FR.closeOverlay('post-comments');
    });

    function renderList() {
      if (!comments.length) {
        listEl.innerHTML = '<p class="text-center py-8 text-xs text-zinc-500 font-normal">Пока нет комментариев к этому посту.</p>';
        return;
      }
      listEl.innerHTML = comments.map(commentHtml).join('');
    }

    if (user) {
      inputEl.addEventListener('input', function () {
        sendBtn.disabled = !inputEl.value.trim();
      });
    }

    formEl.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!FR.state.user) { FR.openAuth(); return; }
      var text = inputEl.value.trim();
      if (!text || !activeCommentPost) return;

      sendBtn.disabled = true;
      FR.api.addComment({
        targetId: activeCommentPost.id,
        targetType: 'post',
        authorId: FR.state.user.id,
        text: text
      }).then(function (res) {
        comments.push(res.comment);
        activeCommentPost.commentsCount = FR.num(activeCommentPost.commentsCount) + 1;
        updateCommentsCount(activeCommentPost);
        inputEl.value = '';
        renderList();
        if (bodyEl) bodyEl.scrollTop = bodyEl.scrollHeight;
      }).catch(function (err) {
        console.error('Error sending post comment:', err);
        sendBtn.disabled = !inputEl.value.trim();
      });
    });

    FR.api.getComments('post', post.id).then(function (res) {
      comments = (res && res.comments) || [];
      if (loadingEl && loadingEl.parentNode) loadingEl.parentNode.removeChild(loadingEl);
      renderList();
    }).catch(function (err) {
      console.error('Error fetching post comments:', err);
      if (loadingEl && loadingEl.parentNode) loadingEl.parentNode.removeChild(loadingEl);
      listEl.innerHTML = '<p class="text-center py-8 text-xs text-zinc-500 font-normal">Не удалось загрузить комментарии.</p>';
    });
  }

  /** Локально обновляет счётчик комментариев на карточке поста. */
  function updateCommentsCount(post) {
    if (!rootEl) return;
    var btn = rootEl.querySelector('[data-action="comments"][data-post-id="' + attrSel(post.id) + '"]');
    if (!btn) return;
    var span = btn.querySelector('[data-comments-count]');
    if (span) span.textContent = String(FR.num(post.commentsCount));
  }

  /* ------------------------ Создание поста ------------------------ */
  function openCreateModal() {
    var user = FR.state.user;
    if (!user || user.role !== 'master') return;

    var imageData = '';
    var submitting = false;

    var html = '' +
      '<div class="relative w-full bg-white dark:bg-[#121215] rounded-xl shadow-xl p-6 border border-zinc-200 dark:border-zinc-800 space-y-4">' +
        '<div class="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800">' +
          '<h3 class="font-sans font-black text-lg text-black dark:text-white">Новая публикация</h3>' +
          '<button type="button" data-post-close class="p-1.5 text-zinc-400 hover:text-black dark:hover:text-white rounded-full">' +
            FR.icon('x', 'w-5 h-5') +
          '</button>' +
        '</div>' +
        '<form data-post-form class="space-y-4">' +
          '<div>' +
            '<label class="block text-[10px] uppercase tracking-[0.2em] font-extrabold text-zinc-500 dark:text-zinc-400 mb-1">Заголовок поста</label>' +
            '<input type="text" required data-post-title placeholder="Например: Авторские техники ухода за кожей..." class="w-full px-4 py-2.5 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs text-black dark:text-white focus:outline-none focus:border-rose-600" />' +
          '</div>' +
          '<div>' +
            '<label class="block text-[10px] uppercase tracking-[0.2em] font-extrabold text-zinc-500 dark:text-zinc-400 mb-1">Текст публикации</label>' +
            '<textarea required rows="4" data-post-content placeholder="Расскажите подробности, поделитесь рекомендациями..." class="w-full px-4 py-2.5 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs text-black dark:text-white focus:outline-none focus:border-rose-600"></textarea>' +
          '</div>' +
          '<div>' +
            '<label class="block text-[10px] uppercase tracking-[0.2em] font-extrabold text-zinc-500 dark:text-zinc-400 mb-1 flex items-center justify-between">' +
              '<span>Изображение для публикации</span>' +
              '<span class="text-[10px] font-normal text-rose-500">Авто-сжатие</span>' +
            '</label>' +
            '<div data-image-area>' + imageAreaHtml('') + '</div>' +
            '<p data-post-compressing class="hidden text-[11px] text-amber-600 dark:text-amber-400 mt-1 animate-pulse flex items-center gap-1">' +
              FR.icon('sparkles', 'w-3 h-3') + 'Оптимизация и сжатие изображения...' +
            '</p>' +
          '</div>' +
          '<div>' +
            '<label class="block text-[10px] uppercase tracking-[0.2em] font-extrabold text-zinc-500 dark:text-zinc-400 mb-1">Теги (через запятую)</label>' +
            '<input type="text" data-post-tags value="тренды, уход, макияж" placeholder="тренды, макияж, уход" class="w-full px-4 py-2.5 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs text-black dark:text-white focus:outline-none focus:border-rose-600" />' +
          '</div>' +
          '<button type="submit" data-post-submit class="w-full py-3 bg-black dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-black text-[10px] uppercase tracking-widest font-extrabold rounded-lg shadow-2xs transition-all">Опубликовать пост</button>' +
        '</form>' +
      '</div>';

    var el = FR.openOverlay('post-create', html);
    if (!el) return;

    var area = el.querySelector('[data-image-area]');
    var compressingEl = el.querySelector('[data-post-compressing]');
    var submitBtn = el.querySelector('[data-post-submit]');

    function renderImageArea() {
      area.innerHTML = imageAreaHtml(imageData);
    }

    function setCompressing(on) {
      compressingEl.classList.toggle('hidden', !on);
    }

    el.querySelector('[data-post-close]').addEventListener('click', function () {
      FR.closeOverlay('post-create');
    });

    el.addEventListener('click', function (e) {
      if (e.target && e.target.closest && e.target.closest('[data-image-remove]')) {
        imageData = '';
        renderImageArea();
      }
    });

    el.addEventListener('change', function (e) {
      var t = e.target;
      if (!t || !t.matches) return;
      if (t.matches('[data-image-file]')) {
        handleFile(t);
      } else if (t.matches('[data-image-url]')) {
        var v = t.value.trim();
        if (v) { imageData = v; renderImageArea(); }
      }
    });

    el.addEventListener('keydown', function (e) {
      var t = e.target;
      if (e.key === 'Enter' && t && t.matches && t.matches('[data-image-url]')) {
        e.preventDefault();
        var v = t.value.trim();
        if (v) { imageData = v; renderImageArea(); }
      }
    });

    function handleFile(input) {
      var file = input.files && input.files[0];
      if (!file) return;
      setCompressing(true);
      FR.compressImage(file, { maxWidth: 1200, maxHeight: 1200, quality: 0.85 })
        .then(function (dataUrl) {
          imageData = dataUrl;
          renderImageArea();
        })
        .catch(function (err) {
          FR.toast('Ошибка при сжатии изображения: ' + ((err && err.message) || err));
        })
        .then(function () {
          setCompressing(false);
          input.value = '';
        });
    }

    el.querySelector('[data-post-form]').addEventListener('submit', function (e) {
      e.preventDefault();
      if (submitting || !FR.state.user || FR.state.user.role !== 'master') return;

      var title = el.querySelector('[data-post-title]').value;
      var content = el.querySelector('[data-post-content]').value;
      var tagsVal = el.querySelector('[data-post-tags]').value;

      submitting = true;
      submitBtn.disabled = true;
      submitBtn.textContent = 'Публикация...';

      FR.api.addPost({
        authorId: FR.state.user.id,
        title: title,
        content: content,
        images: imageData ? [imageData] : [DEFAULT_POST_IMAGE],
        tags: tagsVal.split(',').map(function (t) { return t.trim(); }).filter(Boolean)
      }).then(function () {
        FR.closeOverlay('post-create');
        el.querySelector('[data-post-title]').value = '';
        el.querySelector('[data-post-content]').value = '';
        reloadAndRender();
      }).catch(function (err) {
        console.error('Error creating post:', err);
        FR.toast('Не удалось опубликовать пост');
        submitting = false;
        submitBtn.disabled = false;
        submitBtn.textContent = 'Опубликовать пост';
      });
    });
  }

  /* ------------------------ Удаление поста ------------------------ */
  function handleDelete(postId) {
    var post = findPost(postId);
    if (!post) return;

    FR.confirm({
      title: 'Удаление публикации',
      message: 'Вы действительно хотите удалить публикацию <strong>«' + FR.esc(post.title) + '»</strong>? Это действие удалит публикацию из журнала сообщества.',
      confirmText: 'Да, удалить',
      cancelText: 'Отмена',
      type: 'danger',
      iconType: 'trash'
    }).then(function (ok) {
      if (!ok) return;
      FR.api.deletePost(postId).then(function () {
        reloadAndRender();
      }).catch(function (err) {
        console.error('Error deleting post:', err);
        FR.toast('Не удалось удалить публикацию');
      });
    });
  }

  /* ------------------------ Загрузка списка ----------------------- */
  function loadPosts() {
    var uid = FR.state.user ? FR.state.user.id : null;
    return FR.api.getPosts(uid).then(function (res) {
      FR.state.posts = (res && res.posts) || [];
    }).catch(function (e) {
      console.error('Error loading posts:', e);
    });
  }

  function reloadAndRender() {
    return loadPosts().then(function () {
      if (FR.state.tab === 'posts' && rootEl && rootEl.isConnected) {
        render(rootEl);
      }
    });
  }

  /* --------------------------- События ---------------------------- */
  function onEvent(type) {
    if (type === 'POST_ADDED' || type === 'POST_DELETED') {
      reloadAndRender();
    }
  }

  /* --------------------------- Регистрация ------------------------ */
  FR.registerSection('posts', {
    render: render,
    onEvent: onEvent
  });
})();
