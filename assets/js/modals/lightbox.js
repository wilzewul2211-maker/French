/**
 * Модалка просмотра изображения с зумом и скачиванием (порт ImageLightboxModal.tsx).
 */
(function () {
  'use strict';
  var FR = window.FR;

  var ZOOM_STEP = 0.35;
  var ZOOM_MIN = 0.5;
  var ZOOM_MAX = 3;

  FR.openLightbox = function (imageUrl, title) {
    if (!imageUrl) return;
    var id = 'lightbox';
    var zoom = 1;

    var html =
      '<div class="fixed inset-0 z-[55] flex items-center justify-center bg-black/92 backdrop-blur-md p-3 sm:p-6 overflow-hidden">' +
        '<div class="absolute top-4 left-4 right-4 z-20 flex items-center justify-between text-white bg-zinc-900/80 backdrop-blur-md border border-zinc-800 px-4 py-2.5 rounded-xl shadow-2xl">' +
          '<div class="flex items-center space-x-2 min-w-0">' +
            FR.icon('image', 'w-4 h-4 text-rose-500 shrink-0') +
            '<span class="font-bold text-xs sm:text-sm truncate">' + FR.esc(title || 'Фото-референс') + '</span>' +
          '</div>' +
          '<div class="flex items-center space-x-1.5 sm:space-x-3">' +
            '<button data-zoom-out title="Уменьшить" class="p-2 text-zinc-300 hover:text-white hover:bg-zinc-800 disabled:opacity-30 rounded-lg transition-colors">' + FR.icon('zoom-out', 'w-4 h-4') + '</button>' +
            '<button data-zoom-reset title="Сбросить масштаб" class="px-2.5 py-1 text-[11px] font-mono font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg transition-colors flex items-center space-x-1">' +
              '<span data-zoom-label>100%</span>' + FR.icon('refresh-cw', 'w-3 h-3 text-rose-400') +
            '</button>' +
            '<button data-zoom-in title="Увеличить" class="p-2 text-zinc-300 hover:text-white hover:bg-zinc-800 disabled:opacity-30 rounded-lg transition-colors">' + FR.icon('zoom-in', 'w-4 h-4') + '</button>' +
            '<div class="h-4 w-[1px] bg-zinc-700 mx-1"></div>' +
            '<button data-download title="Скачать фото на устройство" class="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-lg transition-colors flex items-center space-x-1.5 shadow-md shrink-0">' +
              FR.icon('download', 'w-4 h-4') + '<span class="hidden sm:inline">Скачать</span>' +
            '</button>' +
            '<button data-close title="Закрыть" class="p-2 text-zinc-400 hover:text-white hover:bg-rose-950/80 hover:text-rose-400 rounded-lg transition-colors">' + FR.icon('x', 'w-5 h-5') + '</button>' +
          '</div>' +
        '</div>' +
        '<div class="relative w-full h-full flex items-center justify-center overflow-auto p-4 pt-20">' +
          '<img data-zoom-img src="' + FR.esc(imageUrl) + '" alt="Reference Zoom" ' + FR.onerror('work') +
            ' class="max-w-full max-h-[82vh] object-contain rounded-lg shadow-2xl transition-transform duration-200 origin-center cursor-grab active:cursor-grabbing" style="transform:scale(1)">' +
        '</div>' +
      '</div>';

    var el = FR.openOverlay(id, html, {});
    if (!el) return;
    // фон модалки должен быть полностью чёрным, как в референсе
    el.className = 'fixed inset-0 z-[55] overflow-hidden';

    var img = el.querySelector('[data-zoom-img]');
    var label = el.querySelector('[data-zoom-label]');
    var outBtn = el.querySelector('[data-zoom-out]');
    var inBtn = el.querySelector('[data-zoom-in]');

    function apply() {
      img.style.transform = 'scale(' + zoom + ')';
      label.textContent = Math.round(zoom * 100) + '%';
      outBtn.disabled = zoom <= ZOOM_MIN;
      inBtn.disabled = zoom >= ZOOM_MAX;
    }

    el.querySelector('[data-zoom-in]').addEventListener('click', function () {
      zoom = Math.min(zoom + ZOOM_STEP, ZOOM_MAX); apply();
    });
    el.querySelector('[data-zoom-out]').addEventListener('click', function () {
      zoom = Math.max(zoom - ZOOM_STEP, ZOOM_MIN); apply();
    });
    el.querySelector('[data-zoom-reset]').addEventListener('click', function () { zoom = 1; apply(); });
    el.querySelector('[data-close]').addEventListener('click', function () { FR.closeOverlay(id); });

    el.querySelector('[data-download]').addEventListener('click', function () {
      download(imageUrl);
    });

    apply();
  };

  function download(url) {
    fetch(url)
      .then(function (r) { return r.blob(); })
      .then(function (blob) {
        var objUrl = window.URL.createObjectURL(blob);
        var link = document.createElement('a');
        link.href = objUrl;
        link.download = 'french_reference_' + Date.now() + '.jpg';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(objUrl);
      })
      .catch(function () {
        var link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.download = 'reference.jpg';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      });
  }
})();
