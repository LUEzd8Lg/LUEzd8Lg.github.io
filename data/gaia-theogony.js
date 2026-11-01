/* ===========================================================================
   盖亚神谱 · 挂载脚本
   把《盖亚神谱》的神祇图鉴与全书抄本并入 window.ARCHIVE_DATA。
   依赖：data/gaia-theogony-deities.js（window.GAIA_DEITIES）
         data/gaia-theogony-book.js（window.GAIA_BOOK_ERAS）
   =========================================================================== */
(function () {
  var A = window.ARCHIVE_DATA;
  if (!A) return;

  if (window.GAIA_DEITIES && window.GAIA_DEITIES.length) {
    A.deities = (A.deities || []).concat(window.GAIA_DEITIES);
  }

  if (window.GAIA_BOOK_ERAS && window.GAIA_BOOK_ERAS.length) {
    A.eras = (A.eras || []).concat(window.GAIA_BOOK_ERAS);
  }
})();
