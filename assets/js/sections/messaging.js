/**
 * Раздел «Чаты и референсы» (порт ChatsSection.tsx).
 * Двухколоночный интерфейс: список чатов слева, окно переписки справа.
 * Отправка текста и фото-референсов (сжатие на клиенте), автоскролл, бейджи непрочитанных.
 */
(function () {
  'use strict';
  var FR = window.FR;

  /* ------------------------------- Состояние ------------------------------- */
  var rootEl = null;                 // <main id="app-main">
  var messages = [];                 // сообщения активного чата
  var messageCache = {};             // chatId -> ChatMessage[] (мгновенный кэш)
  var textInput = '';                // набранный текст (сохраняется при обновлении)
  var attachedImage = null;          // прикреплённый фото-референс (dataURL)
  var loadingMessages = false;
  var loadedChatId = null;           // chatId, чьи сообщения сейчас показаны

  var BASE_LIST = 'md:col-span-1 border-r border-zinc-200 dark:border-zinc-800 flex flex-col bg-zinc-50/80 dark:bg-[#18181C] min-h-0';
  var BASE_CONV = 'md:col-span-2 flex flex-col h-full bg-white dark:bg-[#121215] min-h-0';

  /* -------------------------------- Хелперы -------------------------------- */
  function findChat(id) {
    var list = FR.state.chats || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return null;
  }

  function effectiveChat() {
    var list = FR.state.chats || [];
    var selected = FR.state.activeChatId;
    if (selected) {
      var c = findChat(selected);
      if (c) return c;
    }
    return list[0] || null;
  }

  function isMaster() {
    var u = FR.state.user;
    return !!(u && u.role === 'master');
  }

  function otherName(chat) { return isMaster() ? chat.clientName : chat.masterName; }

  function otherAvatar(chat) {
    return FR.avatarSrc(isMaster() ? chat.clientAvatar : chat.masterAvatar);
  }

  function unreadOf(chat) {
    return FR.num(isMaster() ? chat.unreadCountMaster : chat.unreadCountClient);
  }

  function el(sel) { return rootEl ? rootEl.querySelector(sel) : null; }

  /* -------------------------------- Разметка ------------------------------- */
  function renderAuthPrompt() {
    return '' +
      '<div class="max-w-xl mx-auto py-16 text-center space-y-4">' +
        FR.icon('message-square', 'w-12 h-12 text-rose-600 mx-auto block') +
        '<h2 class="text-xl font-serif italic font-light text-black dark:text-white">Чаты с мастерами и клиентами</h2>' +
        '<p class="text-xs text-zinc-500 dark:text-zinc-400">Войдите в аккаунт, чтобы просматривать активные переписки и обмениваться фото-референсами.</p>' +
        '<button data-action="open-auth" class="px-6 py-2.5 bg-black hover:bg-zinc-800 text-white font-bold text-[10px] uppercase tracking-widest rounded-xl shadow-md transition-all">' +
          'Войти в личный кабинет' +
        '</button>' +
      '</div>';
  }

  function renderChatItem(chat, activeId) {
    var name = otherName(chat);
    var avatar = otherAvatar(chat);
    var unread = unreadOf(chat);
    var isSelected = activeId === chat.id;

    return '' +
      '<div data-action="select-chat" data-chat-id="' + FR.esc(chat.id) + '" class="' +
        (isSelected
          ? 'bg-white dark:bg-[#121215] border-l-4 border-rose-600 shadow-2xs'
          : 'hover:bg-zinc-100 dark:hover:bg-zinc-800/60') +
        ' p-4 cursor-pointer transition-colors flex items-start space-x-3">' +
        '<img src="' + FR.esc(avatar) + '"' + FR.onerror('avatar') + ' alt="' + FR.esc(name) + '" class="w-10 h-10 rounded-xl object-cover ring-2 ring-zinc-200 dark:ring-zinc-700 shrink-0" />' +
        '<div class="flex-1 min-w-0">' +
          '<div class="flex items-center justify-between">' +
            '<h4 class="font-bold text-xs text-black dark:text-white truncate">' + FR.esc(name) + '</h4>' +
            '<div class="flex items-center space-x-1.5 shrink-0 pl-2">' +
              (unread > 0
                ? '<span class="min-w-5 h-5 px-1 inline-flex items-center justify-center rounded-full bg-rose-600 text-white text-[10px] font-bold">' + FR.esc(unread) + '</span>'
                : '') +
              (chat.lastMessageTime
                ? '<span class="text-[10px] text-zinc-400 font-medium">' + FR.esc(FR.fmtTimeShort(chat.lastMessageTime)) + '</span>'
                : '') +
            '</div>' +
          '</div>' +
          '<p class="text-[11px] font-bold text-rose-600 dark:text-rose-500 truncate mt-0.5">' + FR.esc(chat.serviceTitle) + ' (' + FR.esc(chat.bookingDate) + ')</p>' +
          '<p class="text-xs text-zinc-600 dark:text-zinc-400 truncate mt-0.5">' + FR.esc(chat.lastMessage || 'Нажмите, чтобы открыть диалог') + '</p>' +
        '</div>' +
      '</div>';
  }

  function layoutHtml() {
    return '' +
      '<div class="max-w-6xl w-full mx-auto h-full flex-1 bg-white dark:bg-[#121215] rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xl overflow-hidden grid grid-cols-1 md:grid-cols-3 min-h-0">' +
        /* Левая колонка: список чатов */
        '<div data-col-list class="' + BASE_LIST + ' flex">' +
          '<div class="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121215]">' +
            '<h2 class="font-sans font-black text-base sm:text-lg text-black dark:text-white flex items-center space-x-2">' +
              FR.icon('message-square', 'w-4 h-4 text-rose-600 shrink-0') +
              '<span>Сообщения &amp; Референсы</span>' +
            '</h2>' +
            '<p class="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">Чаты по созданным записям</p>' +
          '</div>' +
          '<div data-chat-list class="flex-1 overflow-y-auto divide-y divide-zinc-200 dark:divide-zinc-800"></div>' +
        '</div>' +
        /* Правая колонка: окно переписки */
        '<div data-col-conv class="' + BASE_CONV + ' hidden md:flex">' +
          '<div data-conv class="flex-1 flex flex-col min-h-0">' +
            '<div data-conv-header class="p-3 sm:p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#18181C] flex items-center justify-between shadow-2xs shrink-0"></div>' +
            '<div data-messages class="flex-1 p-4 overflow-y-auto space-y-4 bg-zinc-50/50 dark:bg-[#0A0A0C]/50"></div>' +
            '<div data-attach class="hidden p-3 bg-rose-50 dark:bg-rose-950/30 border-t border-rose-200 dark:border-rose-900 flex items-center justify-between shrink-0">' +
              '<div class="flex items-center space-x-3">' +
                '<img data-attach-img alt="Attachment" class="w-10 h-10 rounded-xl object-cover ring-2 ring-rose-500" />' +
                '<div>' +
                  '<p class="text-xs font-bold text-black dark:text-white">Прикреплен фото-референс</p>' +
                  '<p class="text-[10px] text-rose-600 dark:text-rose-400 font-medium">Готово к отправке мастером/клиентом</p>' +
                '</div>' +
              '</div>' +
              '<button data-action="remove-attach" type="button" class="p-1.5 text-zinc-500 hover:text-rose-600 bg-white dark:bg-zinc-800 rounded-full shadow-xs">' + FR.icon('x', 'w-4 h-4') + '</button>' +
            '</div>' +
            '<form data-form class="p-3 bg-white dark:bg-[#121215] border-t border-zinc-200 dark:border-zinc-800 flex items-center space-x-2 shrink-0 z-30">' +
              '<input data-file type="file" accept="image/*" class="hidden" />' +
              '<button data-action="attach" type="button" title="Прикрепить фото-референс" class="p-2.5 text-zinc-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-colors shrink-0">' + FR.icon('paperclip', 'w-4 h-4') + '</button>' +
              '<input data-text type="text" placeholder="Напишите сообщение или прикрепите фото-референс..." class="flex-1 px-4 py-2.5 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs text-black dark:text-white focus:outline-none focus:border-rose-600" />' +
              '<button data-send type="submit" disabled class="p-2.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-30 text-white rounded-xl shadow-md transition-colors shrink-0 font-bold">' + FR.icon('send', 'w-4 h-4') + '</button>' +
            '</form>' +
          '</div>' +
          '<div data-conv-empty class="flex-1 flex items-center justify-center p-8 text-zinc-400 text-xs text-center font-medium">Выберите чат слева для просмотра сообщений.</div>' +
        '</div>' +
      '</div>';
  }

  /* ------------------------------ Отрисовка частей ------------------------- */
  function renderChatList() {
    var list = el('[data-chat-list]');
    if (!list) return;
    var chats = FR.state.chats || [];
    var active = effectiveChat();
    var activeId = active ? active.id : null;

    if (!chats.length) {
      list.innerHTML = '<div class="p-8 text-center text-xs text-zinc-500 dark:text-zinc-400">У вас пока нет активных чатов. Выберите мастера и создайте запись!</div>';
      return;
    }
    list.innerHTML = chats.map(function (c) { return renderChatItem(c, activeId); }).join('');
  }

  function renderConvHeader() {
    var box = el('[data-conv-header]');
    if (!box) return;
    var chat = effectiveChat();
    if (!chat) { box.innerHTML = ''; return; }

    box.innerHTML = '' +
      '<div class="flex items-center space-x-2.5 min-w-0">' +
        '<button data-action="back" title="Назад к списку чатов" class="md:hidden p-1.5 text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-white rounded-lg hover:bg-zinc-200 transition-colors shrink-0">' + FR.icon('arrow-left', 'w-5 h-5') + '</button>' +
        '<img src="' + FR.esc(otherAvatar(chat)) + '"' + FR.onerror('avatar') + ' alt="Avatar" class="w-9 h-9 rounded-xl object-cover ring-2 ring-rose-600/70 shrink-0" />' +
        '<div class="min-w-0">' +
          '<h3 class="font-bold text-xs sm:text-sm text-black dark:text-white truncate">' + FR.esc(otherName(chat)) + '</h3>' +
          '<div class="flex items-center space-x-1.5 text-[10px] sm:text-[11px] font-bold text-zinc-600 dark:text-zinc-400 truncate">' +
            FR.icon('calendar', 'w-3 h-3 text-rose-600 shrink-0') +
            '<span class="truncate">' + FR.esc(chat.serviceTitle) + ' • ' + FR.esc(chat.bookingDate) + ' (' + FR.esc(FR.money(chat.bookingPrice)) + ' ₽)</span>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  /** Пометка состояния своего сообщения: кружок — отправляется, галочки — отправлено/прочитано, крестик — ошибка. */
  function statusIcon(msg) {
    if (msg.status === 'sending') return '<span class="text-zinc-400" title="Отправляется">' + FR.icon('circle', 'w-2.5 h-2.5 inline') + '</span>';
    if (msg.status === 'failed') return '<span class="text-rose-500" title="Не отправлено — нажмите, чтобы повторить">' + FR.icon('x', 'w-3 h-3') + '</span>';
    if (msg.readAt) return '<span class="text-sky-500" title="Прочитано">' + FR.icon('check-check', 'w-3.5 h-3.5 inline') + '</span>';
    return '<span class="text-zinc-400" title="Отправлено">' + FR.icon('check', 'w-3.5 h-3.5 inline') + '</span>';
  }

  function renderMessage(msg, u) {
    var mine = !!(u && msg.senderId === u.id);
    var bubble = mine
      ? 'bg-black dark:bg-rose-600 text-white rounded-br-none font-medium'
      : 'bg-white dark:bg-zinc-800 text-black dark:text-white border border-zinc-200 dark:border-zinc-700 rounded-bl-none';

    var avatarPart = mine
      ? ''
      : '<img src="' + FR.esc(FR.avatarSrc(msg.senderAvatar)) + '"' + FR.onerror('avatar') + ' alt="' + FR.esc(msg.senderName) + '" class="w-6 h-6 rounded-full object-cover shrink-0 ring-1 ring-zinc-300 dark:ring-zinc-700" />';

    var imagePart = msg.imageUrl
      ? '<div data-action="open-image" data-image-url="' + FR.esc(msg.imageUrl) + '" class="fr-chat-photo-wrap group relative rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700 cursor-pointer hover:opacity-95 transition-all shadow-md mt-1">' +
          '<img src="' + FR.esc(msg.imageUrl) + '"' + FR.onerror('work') + ' alt="Reference" loading="lazy" decoding="async" class="fr-chat-photo" />' +
          '<div class="bg-black/85 p-2 text-[10px] text-white flex items-center justify-between px-3">' +
            '<span class="font-bold flex items-center space-x-1 text-rose-400">' + FR.icon('image', 'w-3 h-3 mr-1 inline') + ' Фото-референс</span>' +
            '<span class="font-bold bg-rose-600 px-2 py-0.5 rounded-md flex items-center space-x-1 group-hover:scale-105 transition-transform">' + FR.icon('maximize-2', 'w-3 h-3 mr-0.5') + '<span>Увеличить / Скачать</span></span>' +
          '</div>' +
        '</div>'
      : '';

    var retry = (mine && msg.status === 'failed')
      ? ' data-action="retry-message" data-temp-id="' + FR.esc(msg.id) + '"'
      : '';

    return '' +
      '<div class="flex flex-col ' + (mine ? 'items-end' : 'items-start') + ' space-y-1"' + retry + '>' +
        '<div class="flex items-end space-x-2 max-w-[85%] ' + (msg.status === 'failed' ? 'cursor-pointer' : '') + '">' +
          avatarPart +
          '<div class="p-3 rounded-2xl text-xs space-y-2 shadow-xs ' + bubble + '">' +
            (msg.text ? '<p class="leading-relaxed">' + FR.esc(msg.text) + '</p>' : '') +
            imagePart +
          '</div>' +
        '</div>' +
        '<span class="flex items-center gap-1 text-[10px] text-zinc-400 font-mono px-1">' + FR.esc(FR.fmtTimeShort(msg.createdAt)) + (mine ? statusIcon(msg) : '') + '</span>' +
      '</div>';
  }

  function renderMessages(scroll) {
    var box = el('[data-messages]');
    if (!box) return;
    var u = FR.state.user;

    if (loadingMessages) {
      box.innerHTML = '<div class="text-center py-12 text-zinc-400 text-xs font-medium">Загрузка переписки...</div>';
    } else if (!messages.length) {
      box.innerHTML = '<div class="text-center py-12 text-zinc-400 text-xs font-medium">Начните диалог с мастером. Здесь можно отправлять текст и фото-референсы пожеланий.</div>';
    } else {
      box.innerHTML = messages.map(function (m) { return renderMessage(m, u); }).join('');
    }

    if (scroll) box.scrollTop = box.scrollHeight;
  }

  function updateView() {
    var listCol = el('[data-col-list]');
    var convCol = el('[data-col-conv]');
    if (!listCol || !convCol) return;

    var selected = !!FR.state.activeChatId;
    listCol.className = BASE_LIST + (selected ? ' hidden md:flex' : ' flex');
    convCol.className = BASE_CONV + (selected ? ' flex' : ' hidden md:flex');

    var conv = el('[data-conv]');
    var empty = el('[data-conv-empty]');
    if (!conv || !empty) return;
    if (effectiveChat()) {
      conv.classList.remove('hidden');
      empty.classList.add('hidden');
    } else {
      conv.classList.add('hidden');
      empty.classList.remove('hidden');
    }
  }

  function updateAttach() {
    var box = el('[data-attach]');
    if (!box) return;
    var img = el('[data-attach-img]');
    if (attachedImage) {
      if (img) img.src = attachedImage;
      box.classList.remove('hidden');
    } else {
      box.classList.add('hidden');
    }
  }

  function updateSendState() {
    var input = el('[data-text]');
    var btn = el('[data-send]');
    if (!btn) return;
    var val = input ? input.value.trim() : '';
    btn.disabled = !val && !attachedImage;
  }

  function setAttachedImage(value) {
    attachedImage = value;
    updateAttach();
    updateSendState();
  }

  /* ---------------------------- Загрузка сообщений ------------------------- */
  function fetchMessages(chatId) {
    FR.api.getMessages(chatId).then(function (res) {
      var list = (res && res.messages) || [];
      if (loadedChatId === chatId) {
        // Оставляем ещё не подтверждённые сервером сообщения (отправляется / ошибка).
        var pending = messages.filter(function (m) {
          return m && typeof m.id === 'string' && m.id.indexOf('temp_') === 0;
        });
        if (pending.length) list = list.concat(pending);
      }
      messageCache[chatId] = list;
      if (loadedChatId !== chatId) return;
      var prevLen = messages.length;
      var wasLoading = loadingMessages;
      messages = list;
      loadingMessages = false;
      renderMessages(wasLoading || list.length !== prevLen);
    }).catch(function (e) {
      console.error('Error fetching chat messages:', e);
      if (loadedChatId === chatId) {
        loadingMessages = false;
        renderMessages(false);
      }
    });
  }

  function maybeMarkRead(chat) {
    if (unreadOf(chat) <= 0) return;
    var u = FR.state.user;
    if (!u) return;
    FR.api.markChatRead(chat.id, u.id).then(function () {
      var c = findChat(chat.id);
      if (c) {
        if (isMaster()) c.unreadCountMaster = 0;
        else c.unreadCountClient = 0;
      }
      FR.updateUnread(FR.unreadCount());
      renderChatList();
    }).catch(function () { /* тихо */ });
  }

  /** Синхронизировать окно переписки с активным чатом. */
  function syncConv(force) {
    var chat = effectiveChat();

    if (!chat) {
      loadedChatId = null;
      messages = [];
      loadingMessages = false;
      renderConvHeader();
      renderMessages(false);
      updateView();
      return;
    }

    if (loadedChatId !== chat.id) {
      loadedChatId = chat.id;
      var cached = messageCache[chat.id];
      if (cached) {
        messages = cached;
        loadingMessages = false;
      } else {
        messages = [];
        loadingMessages = true;
      }
      renderConvHeader();
      renderMessages(true);
      updateView();
      fetchMessages(chat.id);
      maybeMarkRead(chat);
    } else {
      renderConvHeader();
      renderMessages(false);
      updateView();
      if (force) fetchMessages(chat.id);
    }
  }

  /* --------------------------------- Действия ------------------------------ */
  function selectChat(chatId) {
    if (!chatId) return;
    FR.state.activeChatId = chatId;
    syncConv(false);
  }

  function backToList() {
    FR.state.activeChatId = null;
    syncConv(false);
  }

  /** Отправить сообщение на сервер и обновить его состояние (отправлено / ошибка). */
  function deliver(chat, u, text, image, tempId) {
    FR.api.sendMessage(chat.id, u.id, text, image || undefined).then(function (res) {
      var actual = res && res.message;
      for (var i = 0; i < messages.length; i++) {
        if (messages[i].id === tempId) { messages[i] = actual || messages[i]; break; }
      }
      messageCache[chat.id] = messages;
      renderMessages(false);
    }).catch(function (e) {
      for (var i = 0; i < messages.length; i++) {
        if (messages[i].id === tempId) { messages[i].status = 'failed'; break; }
      }
      messageCache[chat.id] = messages;
      renderMessages(false);
      FR.toast((e && e.message) || 'Не удалось отправить. Нажмите на сообщение, чтобы повторить.');
    });
  }

  function handleSend() {
    var u = FR.state.user;
    var chat = effectiveChat();
    if (!u || !chat) return;

    var input = el('[data-text]');
    var text = (input ? input.value : '').trim();
    var image = attachedImage;
    if (!text && !image) return;

    var tempId = 'temp_' + Date.now();
    var optimistic = {
      id: tempId,
      chatId: chat.id,
      senderId: u.id,
      senderName: u.name,
      senderAvatar: u.avatar,
      text: text || undefined,
      imageUrl: image || undefined,
      status: 'sending',
      createdAt: new Date().toISOString()
    };

    // мгновенная очистка полей
    if (input) input.value = '';
    textInput = '';
    setAttachedImage(null);

    messages.push(optimistic);
    messageCache[chat.id] = messages;
    renderMessages(true);

    deliver(chat, u, text, image, tempId);
  }

  /** Повторная отправка сообщения, которое не ушло (крестик у сообщения). */
  function retryMessage(tempId) {
    var u = FR.state.user;
    var chat = effectiveChat();
    if (!u || !chat) return;
    var idx = -1;
    for (var i = 0; i < messages.length; i++) {
      if (messages[i].id === tempId) { idx = i; break; }
    }
    if (idx < 0 || messages[idx].status !== 'failed') return;
    messages[idx].status = 'sending';
    renderMessages(false);
    deliver(chat, u, messages[idx].text, messages[idx].imageUrl, tempId);
  }

  function onFileSelect(e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    FR.compressImage(file, { maxWidth: 1200, maxHeight: 1200, quality: 0.85 }).then(function (dataUrl) {
      setAttachedImage(dataUrl);
    }).catch(function (err) {
      console.error('Error compressing image:', err);
      FR.toast('Не удалось обработать изображение');
    });
    e.target.value = '';
  }

  /* --------------------------------- События ------------------------------- */
  function onClick(e) {
    var t = e.target.closest('[data-action]');
    if (!t) return;
    var action = t.getAttribute('data-action');
    if (action === 'select-chat') selectChat(t.getAttribute('data-chat-id'));
    else if (action === 'back') backToList();
    else if (action === 'open-image') FR.openLightbox(t.getAttribute('data-image-url'), 'Фото-референс');
    else if (action === 'attach') { var f = el('[data-file]'); if (f) f.click(); }
    else if (action === 'remove-attach') setAttachedImage(null);
    else if (action === 'retry-message') retryMessage(t.getAttribute('data-temp-id'));
    else if (action === 'open-auth') { if (FR.openAuth) FR.openAuth(); }
  }

  function onSubmit(e) {
    if (!e.target.matches('[data-form]')) return;
    e.preventDefault();
    handleSend();
  }

  function onInput(e) {
    if (!e.target.matches('[data-text]')) return;
    textInput = e.target.value;
    updateSendState();
  }

  function onChange(e) {
    if (e.target.matches('[data-file]')) onFileSelect(e);
  }

  /* ------------------------------- Регистрация ----------------------------- */
  FR.registerSection('chats', {
    render: function (root) {
      rootEl = root;

      if (!FR.state.user) {
        root.innerHTML = renderAuthPrompt();
        var authWrap = root.firstElementChild;
        if (authWrap) authWrap.addEventListener('click', onClick);
        return;
      }

      root.innerHTML = layoutHtml();
      var wrap = root.firstElementChild;
      if (wrap) {
        wrap.addEventListener('click', onClick);
        wrap.addEventListener('submit', onSubmit);
        wrap.addEventListener('input', onInput);
        wrap.addEventListener('change', onChange);
      }

      // восстановить возможный черновик и показать состояние
      var input = el('[data-text]');
      if (input) input.value = textInput;
      updateAttach();
      updateSendState();
      renderChatList();
      syncConv(false);
    },

    onChatsUpdated: function () {
      if (!rootEl || !FR.state.user) return;
      renderChatList();
      var chat = effectiveChat();
      if (!chat || loadedChatId !== chat.id) {
        syncConv(false);
        return;
      }
      renderConvHeader();
      updateView();
      fetchMessages(chat.id);
    },

    onEvent: function (type, payload) {
      if (!rootEl) return;
      if (type === 'NEW_CHAT_MESSAGE') {
        var chatId = payload && payload.chat && payload.chat.id;
        if (chatId && chatId === loadedChatId) fetchMessages(chatId);
      } else if (type === 'MESSAGES_READ') {
        var cid = payload && payload.chatId;
        if (cid && cid === loadedChatId) fetchMessages(cid);
      }
    }
  });
})();
