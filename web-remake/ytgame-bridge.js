(function () {
  const STORAGE_KEY = "gem-sort-master-save-v1";
  const noop = function () {};

  function readLocal() {
    try {
      return localStorage.getItem(STORAGE_KEY) || "";
    } catch {
      return "";
    }
  }

  function writeLocal(value) {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      noop();
    }
  }

  if (!window.ytgame) {
    const pauseListeners = new Set();
    const resumeListeners = new Set();
    let audioEnabled = true;

    window.ytgame = {
      IN_PLAYABLES_ENV: false,
      game: {
        firstFrameReady: noop,
        gameReady: noop,
        loadData: async function () {
          return readLocal();
        },
        saveData: async function (value) {
          writeLocal(value);
        },
      },
      engagement: {
        sendScore: noop,
        openYTContent: noop,
      },
      system: {
        isAudioEnabled: function () {
          return audioEnabled;
        },
        onPause: function (callback) {
          if (typeof callback === "function") pauseListeners.add(callback);
        },
        onResume: function (callback) {
          if (typeof callback === "function") resumeListeners.add(callback);
        },
        onAudioEnabledChange: noop,
      },
    };

    window.gemSortDebugHost = {
      pause: function () {
        pauseListeners.forEach(function (callback) {
          callback();
        });
      },
      resume: function () {
        resumeListeners.forEach(function (callback) {
          callback();
        });
      },
      setAudioEnabled: function (enabled) {
        audioEnabled = Boolean(enabled);
      },
    };
  } else if (!window.ytgame.game?.loadData || !window.ytgame.game?.saveData) {
    const originalGame = window.ytgame.game || {};
    window.ytgame.game = {
      ...originalGame,
      loadData: originalGame.loadData
        ? originalGame.loadData.bind(originalGame)
        : async function () {
            return readLocal();
          },
      saveData: originalGame.saveData
        ? originalGame.saveData.bind(originalGame)
        : async function (value) {
            writeLocal(value);
          },
    };
  }
})();

