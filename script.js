// IndexedDB 工具
const DB_NAME = "mono-player-db";
const DB_VERSION = 1;
const STORE_NAME = "tracks";
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
      }
    };
  });
}
async function saveTracksToDB(tracks) {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);
  await Promise.all(tracks.map(track => {
    return new Promise(res => {
      store.put(track);
      res();
    });
  }));
  return tx.complete;
}
async function loadTracksFromDB() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}
async function clearDB() {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).clear();
  return tx.complete;
}

(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const mqMobile = window.matchMedia('(max-width: 768px)');
  const lyricsToggleBtn = document.getElementById('lyricsToggleBtn');
  const queueToggleBtn = document.getElementById('queueToggleBtn');
  const lyricsToggleBtnMobile = document.getElementById('lyricsToggleBtnMobile');
  const queueToggleBtnMobile = document.getElementById('queueToggleBtnMobile');
  const clearLibraryBtn = document.getElementById('clearLibraryBtn');
  const lyricsTabBtn = document.getElementById('lyricsTabBtn');
  const queueTabBtn = document.getElementById('queueTabBtn');
  const contextPanels = {
    lyrics: document.getElementById('lyricsPanel'),
    queue: document.getElementById('queuePanel')
  };
  const contextTabMap = { lyrics: lyricsTabBtn, queue: queueTabBtn };
  const headerButtonMap = { lyrics: lyricsToggleBtn, queue: queueToggleBtn };
  let activePanel = 'lyrics';
  const setActiveDesktopPanel = panel => {
    if (!contextPanels[panel]) return;
    activePanel = panel;
    Object.entries(contextPanels).forEach(([key, node]) => {
      if (!node) return;
      node.classList.toggle('active', key === panel);
      node.setAttribute('aria-hidden', key === panel ? 'false' : 'true');
    });
    Object.entries(contextTabMap).forEach(([key, btn]) => {
      if (!btn) return;
      const isActive = key === panel;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-selected', String(isActive));
    });
  };
  const updateHeaderState = panel => {
    Object.entries(headerButtonMap).forEach(([key, btn]) => {
      if (!btn) return;
      btn.classList.toggle('active', !mqMobile.matches && key === panel);
    });
  };
  const handlePanelRequest = panel => {
    if (!(panel in contextPanels)) return;
    activePanel = panel;
    setActiveDesktopPanel(panel);
    updateHeaderState(panel);
  };

  setActiveDesktopPanel(activePanel);
  updateHeaderState(activePanel);
  const audio = $('audioPlayer');
  const albumCover = $('albumCover');
  const bgArt = $('bgArt');
  const statusBadge = $('statusBadge');
  const trackTitle = $('trackTitle');
  const trackArtist = $('trackArtist');
  const currentTimeEl = $('currentTime');
  const totalTimeEl = $('totalTime');
  const progressBar = $('progressBar');
  const progressFill = $('progressFill');
  const progressThumb = $('progressThumb');
  const progressTooltip = $('progressTooltip');
  const playBtn = $('playBtn');
  const favoriteToggleBtn = document.getElementById('favoriteToggleBtn');
  const prevBtn = $('prevBtn');
  const nextBtn = $('nextBtn');
  const shuffleBtn = $('shuffleBtn');
  const repeatBtn = $('repeatBtn');
  const lyricsContent = $('lyricsContent');
  const vinyl = document.getElementById('vinyl');
  let parsedLyrics = null, isSyncedLyrics = false, activeLyricIndex = -1;
  let lyricsScrollSuppressUntil = 0;
  let userIsScrollingLyrics = false;
  let lyricsScrollTimeout = null;
  const volumeSlider = $('volumeSlider');
  const volumeIcon = $('volumeIcon');
  const fileInput = $('fileInput');
  const dropZone = document.getElementById('dropZone');
  const playlist = $('playlist');
  const miniPlayer = $('miniPlayer');
  const miniCover = $('miniCover');
  const miniTitle = $('miniTitle');
  const miniArtist = $('miniArtist');
  const miniPlayBtn = $('miniPlayBtn');
  const miniPrevBtn = $('miniPrevBtn');
  const miniNextBtn = $('miniNextBtn');
  const notifications = $('notifications');
  const prevBtnMobile = document.getElementById('prevBtnMobile');
  const playBtnMobile = document.getElementById('playBtnMobile');
  const nextBtnMobile = document.getElementById('nextBtnMobile');
  const shuffleBtnMobile = document.getElementById('shuffleBtnMobile');
  const repeatBtnMobile = document.getElementById('repeatBtnMobile');
  lyricsToggleBtnMobile?.addEventListener('click', () => handlePanelRequest('lyrics'));
  queueToggleBtnMobile?.addEventListener('click', () => handlePanelRequest('queue'));


  let currentPage = 0; // 0=歌詞, 1=清單


  lyricsTabBtn?.addEventListener('click', () => handlePanelRequest('lyrics'));
  queueTabBtn?.addEventListener('click', () => handlePanelRequest('queue'));
  lyricsToggleBtn?.addEventListener('click', () => handlePanelRequest('lyrics'));
  queueToggleBtn?.addEventListener('click', () => handlePanelRequest('queue'));
  const handleViewportChange = () => {
    updateHeaderState(activePanel);
    if (!mqMobile.matches) {
      setActiveDesktopPanel(activePanel);
    }
  };
  if (mqMobile.addEventListener) mqMobile.addEventListener('change', handleViewportChange);
  else if (mqMobile.addListener) mqMobile.addListener(handleViewportChange);
  clearLibraryBtn?.addEventListener('click', async () => {
    if (!currentPlaylist.length) {
      showNotification('播放清單目前為空', 'warning');
      return;
    }
    if (!confirm('確定要清空播放清單嗎？')) return;
    currentPlaylist = [];
    currentTrackIndex = -1;
    stopPlayback();
    updatePlaylistUI();
    try {
      await saveState();
      showNotification('已清空播放清單', 'success');
    } catch (e) {
      console.warn('清空失敗', e);
      showNotification('清空播放清單失敗', 'error');
    }
  });


  // 加入左右滑偵測
  let startX = 0;

  function syncMobileTransportState() {
    // 播放鍵圖示同步
    if (!audio.paused) {
      playBtnMobile.innerHTML = '<i class="fa-solid fa-pause"></i>';
      playBtnMobile.setAttribute('aria-pressed', 'true');
    } else {
      playBtnMobile.innerHTML = '<i class="fa-solid fa-play"></i>';
      playBtnMobile.setAttribute('aria-pressed', 'false');
    }
    // 隨機 / 循環 pressed 狀態同步
    shuffleBtnMobile.setAttribute('aria-pressed', String(isShuffleMode));
    repeatBtnMobile.setAttribute('aria-pressed', String(repeatMode > 0));
  }

  // 綁定手機控制按鈕
  if (prevBtnMobile) {
    prevBtnMobile.addEventListener('click', () => {
      playPrevious();
      syncMobileTransportState();
    });
  }

  if (nextBtnMobile) {
    nextBtnMobile.addEventListener('click', () => {
      playNext();
      syncMobileTransportState();
    });
  }

  if (shuffleBtnMobile) {
    shuffleBtnMobile.addEventListener('click', () => {
      shuffleBtn.click();
      syncMobileTransportState();
    });
  }

  if (repeatBtnMobile) {
    repeatBtnMobile.addEventListener('click', () => {
      repeatBtn.click();
      syncMobileTransportState();
    });
  }

  // 當播放狀態改變時也同步一次
  audio.addEventListener('play', syncMobileTransportState);
  audio.addEventListener('pause', syncMobileTransportState);

  function getDominantColor(imageUrl) {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous'; // 若封面圖可支援 CORS
      img.src = imageUrl;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 10;
        canvas.height = 10;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, 10, 10);
        const data = ctx.getImageData(0, 0, 10, 10).data;
        let r = 0, g = 0, b = 0, count = 0;
        for (let i = 0; i < data.length; i += 4) {
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          count++;
        }
        resolve([r / count | 0, g / count | 0, b / count | 0]);
      };
      img.onerror = () => {
        resolve([27, 30, 37]); // fallback color（深藍灰）
      };
    });
  }
  let currentPlaylist = [];
  let currentTrackIndex = -1;
  let isShuffleMode = false;
  let repeatMode = 0;
  let isDragging = false;
  let isPlaying = false;
  let savedVolume = 0.7;
  let playbackRate = 1;
  const sleepDurations = [0, 15, 30, 60];
  let sleepTimerIndex = 0;
  let sleepTimerId = null;
  let sleepTimerTicker = null;
  let sleepTimerEndsAt = null;
  const formatTime = s => { if (!isFinite(s)) return '0:00'; const m = Math.floor(s / 60); const sec = Math.floor(s % 60); return `${m}:${sec.toString().padStart(2, '0')}` };
  const createGradientFromText = text => { let hash = 0; for (let i = 0; i < text.length; i++) { hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0 } const h1 = Math.abs(hash) % 360; const h2 = (h1 + 180) % 360; return `linear-gradient(135deg, hsl(${h1}, 8%, 36%), hsl(${h2}, 8%, 24%))` };
  const fetchLyrics = async (title, artist) => { const safe = s => encodeURIComponent((s || '').trim()); const endpoints = [`https://lrclib.net/api/search?track_name=${safe(title)}&artist_name=${safe(artist)}`, `https://lrclib.net/api/search?track_name=${safe(title)}`]; for (const url of endpoints) { try { const r = await fetch(url, { headers: { 'Accept': 'application/json' } }); if (!r.ok) continue; const data = await r.json(); if (Array.isArray(data) && data.length) { const best = data[0]; const text = best.syncedLyrics || best.plainLyrics || ''; if (text) { return text } } } catch (_) { } } throw new Error('NO_LYRICS') };
  const showNotification = (message, type = 'default') => { const n = document.createElement('div'); n.className = `notification ${type}`; n.textContent = message; notifications.appendChild(n); setTimeout(() => { n.classList.add('fade-out'); setTimeout(() => n.remove(), 220) }, 2800) };
  const updateBadge = t => { statusBadge.textContent = ''; const icon = document.createElement('i'); icon.className = 'fa-solid fa-circle'; icon.style.fontSize = '6px'; statusBadge.appendChild(icon); statusBadge.insertAdjacentText('beforeend', ' ' + t) };
  function updateFavoriteButtonState() {
    if (!favoriteToggleBtn) return;
    const hasTrack = currentTrackIndex >= 0 && currentTrackIndex < currentPlaylist.length;
    favoriteToggleBtn.disabled = !hasTrack;
    if (!hasTrack) {
      favoriteToggleBtn.classList.remove('active');
      favoriteToggleBtn.setAttribute('aria-pressed', 'false');
      favoriteToggleBtn.setAttribute('aria-label', '加入最愛');
      favoriteToggleBtn.title = '加入最愛';
      favoriteToggleBtn.innerHTML = '<i class="fa-regular fa-heart"></i>';
      return;
    }
    const track = currentPlaylist[currentTrackIndex];
    const isFav = !!track.favorite;
    favoriteToggleBtn.classList.toggle('active', isFav);
    favoriteToggleBtn.setAttribute('aria-pressed', String(isFav));
    favoriteToggleBtn.setAttribute('aria-label', isFav ? '移除最愛' : '加入最愛');
    favoriteToggleBtn.title = isFav ? '移除最愛' : '加入最愛';
    favoriteToggleBtn.innerHTML = `<i class="${isFav ? 'fa-solid fa-heart' : 'fa-regular fa-heart'}"></i>`;
  }

  function clearSleepTimerHandles() {
    if (sleepTimerId) {
      clearTimeout(sleepTimerId);
      sleepTimerId = null;
    }
    if (sleepTimerTicker) {
      clearInterval(sleepTimerTicker);
      sleepTimerTicker = null;
    }
  }

  function updateSleepTimerStatus() {
    if (!sleepTimerStatus) return;
    if (!sleepTimerEndsAt) {
      sleepTimerStatus.textContent = '點擊按鈕循環切換 15/30/60 分鐘';
      return;
    }
    const remaining = Math.max(0, sleepTimerEndsAt - Date.now());
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    sleepTimerStatus.textContent = `剩餘 ${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  function applySleepTimerState(minutes, { announce = true } = {}) {
    if (!sleepTimerBtn || !sleepTimerStatus) return;
    clearSleepTimerHandles();
    if (!Number.isFinite(minutes) || minutes <= 0) {
      sleepTimerEndsAt = null;
      sleepTimerBtn.textContent = '未啟用';
      sleepTimerBtn.classList.remove('active');
      sleepTimerBtn.setAttribute('aria-pressed', 'false');
      sleepTimerStatus.textContent = '點擊按鈕循環切換 15/30/60 分鐘';
      if (announce) showNotification('已關閉睡眠定時', 'default');
      return;
    }
    sleepTimerEndsAt = Date.now() + minutes * 60000;
    sleepTimerBtn.textContent = `${minutes} 分鐘`;
    sleepTimerBtn.classList.add('active');
    sleepTimerBtn.setAttribute('aria-pressed', 'true');
    updateSleepTimerStatus();
    sleepTimerTicker = setInterval(updateSleepTimerStatus, 1000);
    sleepTimerId = setTimeout(() => {
      clearSleepTimerHandles();
      sleepTimerEndsAt = null;
      audio.pause();
      showNotification('睡眠定時器時間到，播放已暫停', 'warning');
      sleepTimerIndex = 0;
      applySleepTimerState(0, { announce: false });
    }, minutes * 60000);
    if (announce) showNotification(`已設定睡眠定時：${minutes} 分鐘`, 'success');
  }
  function toggleFavorite(index = currentTrackIndex) {
    if (index < 0 || index >= currentPlaylist.length) return;
    const track = currentPlaylist[index];
    const nextState = !track.favorite;
    track.favorite = nextState;
    const title = track.title;
    updatePlaylistUI();
    saveState();
    showNotification(nextState ? `已收藏《${title}》` : `已取消收藏《${title}》`, nextState ? 'success' : 'default');
  }

  function performPlaylistAction(action, index) {
    if (typeof index !== 'number' || index < 0 || index >= currentPlaylist.length) return;
    switch (action) {
      case 'favorite':
        toggleFavorite(index);
        break;
      case 'move-up':
        if (index > 0) {
          [currentPlaylist[index - 1], currentPlaylist[index]] = [currentPlaylist[index], currentPlaylist[index - 1]];
          if (currentTrackIndex === index) currentTrackIndex = index - 1;
          else if (currentTrackIndex === index - 1) currentTrackIndex = index;
          updatePlaylistUI();
          saveState();
        }
        break;
      case 'move-down':
        if (index < currentPlaylist.length - 1) {
          [currentPlaylist[index + 1], currentPlaylist[index]] = [currentPlaylist[index], currentPlaylist[index + 1]];
          if (currentTrackIndex === index) currentTrackIndex = index + 1;
          else if (currentTrackIndex === index + 1) currentTrackIndex = index;
          updatePlaylistUI();
          saveState();
        }
        break;
      case 'play-next':
        if (index !== currentTrackIndex) {
          const t = currentPlaylist.splice(index, 1)[0];
          const insertIndex = currentTrackIndex + 1;
          currentPlaylist.splice(insertIndex, 0, t);
          if (index < currentTrackIndex) currentTrackIndex--;
          updatePlaylistUI();
          saveState();
          showNotification('已加入播放佇列下一首', 'success');
        }
        break;
      case 'remove':
        const was = index === currentTrackIndex;
        currentPlaylist.splice(index, 1);
        if (!currentPlaylist.length) {
          currentTrackIndex = -1;
          stopPlayback();
        } else if (was) {
          currentTrackIndex = Math.min(currentTrackIndex, currentPlaylist.length - 1);
          if (currentTrackIndex >= 0) {
            playTrack(currentTrackIndex);
          }
        } else if (index < currentTrackIndex) {
          currentTrackIndex--;
        }
        updatePlaylistUI();
        saveState();
        showNotification('已移除歌曲', 'success');
        break;
    }
  }

  const setArtwork = async (imageUrl, fallbackText = 'Music') => {
    // 中央標貼（albumCover）與 mini 封面
    if (imageUrl) {
      albumCover.style.backgroundImage = `url(${imageUrl})`;
      miniCover.style.backgroundImage = `url(${imageUrl})`;
    } else {
      albumCover.style.backgroundImage = 'linear-gradient(135deg, #1e2230, #131722)';
      miniCover.style.backgroundImage = 'linear-gradient(135deg, #1e2230, #131722)';
    }
    // 背景光暈：能抓到圖就取色，否則落到預設漸層
    try {
      if (imageUrl) {
        const [r, g, b] = await getDominantColor(imageUrl);
        const bgGradient = `radial-gradient(circle at 50% 40%, rgba(${r},${g},${b},0.5), rgba(0,0,0,0.9))`;
        bgArt.style.backgroundImage = bgGradient;
        bgArt.style.opacity = '1';
      } else {
        throw new Error('no-image');
      }
    } catch (_) {
      bgArt.style.backgroundImage = 'linear-gradient(to bottom, #1b1e24, #000)';
      bgArt.style.opacity = '0.6';
    }
  };
  const playTrack = async index => {
    if (index < 0 || index >= currentPlaylist.length) return;
    currentTrackIndex = index;
    const track = currentPlaylist[index];
    audio.src = track.url;
    audio.load();
    audio.playbackRate = playbackRate;
    // ✅ 加上這段！
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist,
        album: 'Monochrome Music Player',
        artwork: [
          { src: track.imageUrl || 'fallback.png', sizes: '512x512', type: 'image/png' },
          { src: track.imageUrl || 'fallback.png', sizes: '256x256', type: 'image/png' }
        ]
      });
    }
    trackTitle.textContent = track.title;
    trackArtist.textContent = track.artist;
    miniTitle.textContent = track.title;
    miniArtist.textContent = track.artist;
    setArtwork(track.imageUrl, track.title + track.artist);
    miniCover.style.backgroundImage = track.imageUrl
      ? `url(${track.imageUrl})`
      : createGradientFromText(track.title);
    updatePlaylistUI();
    try {
      await audio.play();
      updateBadge('播放中');
    } catch (e) {
      console.warn('播放失敗:', e);
      showNotification('播放失敗', 'error');
    } finally {
      loadLyricsSafely(track.title, track.artist);
    }
    saveState();
  };



  const togglePlayPause = async () => {
    if (currentPlaylist.length === 0) {
      showNotification('請先添加音樂', 'warning');
      return;
    }

    // 如果還沒選歌，就播第一首；否則播目前索引
    if (currentTrackIndex === -1) {
      currentTrackIndex = 0;
    }

    if (audio.src === '') {
      await playTrack(currentTrackIndex);
      return;
    }

    if (audio.paused) {
      try { await audio.play(); }
      catch (_) { showNotification('播放失敗', 'error'); }
    } else {
      audio.pause();
    }
  };

  const playPrevious = () => { if (!currentPlaylist.length) return;
    if (isShuffleMode) { const r = Math.floor(Math.random() * currentPlaylist.length); playTrack(r) }
    else { const p = currentTrackIndex > 0 ? currentTrackIndex - 1 : (repeatMode === 2 ? currentPlaylist.length - 1 : currentTrackIndex);
      if (p !== currentTrackIndex) playTrack(p); }
  };
  const playNext = () => { if (!currentPlaylist.length) return;
    if (isShuffleMode) { const r = Math.floor(Math.random() * currentPlaylist.length); playTrack(r) }
    else {
      const atEnd = currentTrackIndex >= currentPlaylist.length - 1;
      const n = !atEnd ? currentTrackIndex + 1 : (repeatMode === 2 ? 0 : currentTrackIndex);
      if (n !== currentTrackIndex || repeatMode === 2) playTrack(n);
    }
  }; const mobileProgressBar = document.getElementById('mobileProgressBar');
  const mobileProgressFill = document.getElementById('mobileProgressFill');
  const mobileProgressThumb = document.getElementById('mobileProgressThumb');
  const mobileCurrentTime = document.getElementById('mobileCurrentTime');
  const mobileTotalTime = document.getElementById('mobileTotalTime');

  const updateProgress = () => {
    if (!audio.duration) return;
    const p = (audio.currentTime / audio.duration) * 100;

    // 更新桌面版进度条
    progressFill.style.width = `${p}%`;
    currentTimeEl.textContent = formatTime(audio.currentTime);
    totalTimeEl.textContent = formatTime(audio.duration);
    const x = (p / 100) * progressBar.offsetWidth;
    progressThumb.style.left = `${x}px`;
    progressTooltip.style.left = `${x}px`;
    progressTooltip.textContent = formatTime(audio.currentTime);
    progressBar.setAttribute('aria-valuenow', Math.round(p));

    // 更新移动版进度条
    mobileProgressFill.style.width = `${p}%`;
    mobileCurrentTime.textContent = formatTime(audio.currentTime);
    mobileTotalTime.textContent = formatTime(audio.duration);
    const mobileX = (p / 100) * mobileProgressBar.offsetWidth;
    mobileProgressThumb.style.left = `${mobileX}px`;
    mobileProgressBar.setAttribute('aria-valuenow', Math.round(p));
  };

  // 移动版进度条事件处理
  mobileProgressBar.addEventListener('pointerdown', e => {
    isDragging = true;
    mobileProgressBar.classList.add('dragging');
    seekTo(e.clientX);
    mobileProgressBar.setPointerCapture(e.pointerId);
  });

  mobileProgressBar.addEventListener('pointermove', e => {
    if (isDragging) seekTo(e.clientX);
  });

  mobileProgressBar.addEventListener('pointerup', e => {
    isDragging = false;
    mobileProgressBar.classList.remove('dragging');
    mobileProgressBar.releasePointerCapture(e.pointerId);
  });

  mobileProgressBar.addEventListener('touchstart', e => {
    e.preventDefault();
    isDragging = true;
    mobileProgressBar.classList.add('dragging');
    seekTo(e.touches[0].clientX);
  }, { passive: false });

  mobileProgressBar.addEventListener('touchmove', e => {
    e.preventDefault();
    if (isDragging) seekTo(e.touches[0].clientX);
  }, { passive: false });

  mobileProgressBar.addEventListener('touchend', e => {
    isDragging = false;
    mobileProgressBar.classList.remove('dragging');
  });
  function mobileSeek(clientX) {
    if (!audio.duration) return;
    const rect = mobileProgressBar.getBoundingClientRect();
    const percent = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    audio.currentTime = percent * audio.duration;
    updateProgress();
  }

  // 然後把原本的 touch / pointer handler 改成呼叫 mobileSeek：
  mobileProgressBar.addEventListener('pointerdown', e => {
    isDragging = true;
    mobileProgressBar.classList.add('dragging');
    mobileSeek(e.clientX);              // <- 改這裡
    mobileProgressBar.setPointerCapture(e.pointerId);
  });
  mobileProgressBar.addEventListener('pointermove', e => {
    if (isDragging) mobileSeek(e.clientX);  // <- 這裡也
  });
  mobileProgressBar.addEventListener('pointerup', e => {
    isDragging = false;
    mobileProgressBar.classList.remove('dragging');
    mobileProgressBar.releasePointerCapture(e.pointerId);
  });

  mobileProgressBar.addEventListener('touchstart', e => {
    e.preventDefault();
    isDragging = true;
    mobileProgressBar.classList.add('dragging');
    mobileSeek(e.touches[0].clientX);       // <- 以及這裡
  }, { passive: false });
  mobileProgressBar.addEventListener('touchmove', e => {
    e.preventDefault();
    if (isDragging) mobileSeek(e.touches[0].clientX);
  }, { passive: false });
  mobileProgressBar.addEventListener('touchend', e => {
    isDragging = false;
    mobileProgressBar.classList.remove('dragging');
  });
  const seekTo = clientX => { if (!audio.duration) return; const rect = progressBar.getBoundingClientRect(); const percent = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)); audio.currentTime = percent * audio.duration; updateProgress() };
  const updatePlaylistUI = () => {
    playlist.innerHTML = '';
    if (!currentPlaylist.length) {
      playlist.innerHTML = `
      <div class="playlist-empty">
        <i class="fa-solid fa-music"></i>
        <p>播放清單尚未加入任何歌曲</p>
        <button type="button" data-action="open-upload">立即匯入</button>
      </div>`;
      playlist.querySelector('[data-action="open-upload"]')?.addEventListener('click', () => fileInput?.click());
      return;
    }
    currentPlaylist.forEach((track, index) => {
      const item = document.createElement('div');
      item.className = `playlist-item ${index === currentTrackIndex ? 'active' : ''} ${track.favorite ? 'favorite' : ''}`;
      item.dataset.index = index;
      item.innerHTML = `
      <div class="playlist-thumb" style="background-image: ${track.imageUrl ? `url(${track.imageUrl})` : createGradientFromText(track.title)}"></div>
      <div class="playlist-info">
        <div class="playlist-title">${track.title}</div>
        <div class="playlist-artist">${track.artist}</div>
      </div>
      <div class="playlist-actions">
        <button class="action-btn ${track.favorite ? 'active' : ''}" data-action="favorite" title="${track.favorite ? '移除最愛' : '加入最愛'}"><i class="${track.favorite ? 'fa-solid fa-heart' : 'fa-regular fa-heart'}"></i></button>
        <button class="action-btn" data-action="move-up" title="上移" ${index === 0 ? 'disabled' : ''}><i class="fa-solid fa-chevron-up"></i></button>
        <button class="action-btn" data-action="move-down" title="下移" ${index === currentPlaylist.length - 1 ? 'disabled' : ''}><i class="fa-solid fa-chevron-down"></i></button>
        <button class="action-btn" data-action="play-next" title="下一首播放"><i class="fa-solid fa-forward"></i></button>
        <button class="action-btn" data-action="remove" title="移除"><i class="fa-solid fa-xmark"></i></button>
      </div>
    `;

      // 綁定點擊事件播放歌曲
      item.addEventListener('click', e => {
        if (e.target.closest('.action-btn')) return;
        playTrack(index);
        if ('mediaSession' in navigator) {
          navigator.mediaSession.metadata = new MediaMetadata({
            title: track.title,
            artist: track.artist,
            album: 'Monochrome Music Player',
            artwork: [
              { src: track.imageUrl || 'fallback.png', sizes: '512x512', type: 'image/png' }
            ]
          });
          navigator.mediaSession.setActionHandler('play', () => audio.play());
          navigator.mediaSession.setActionHandler('pause', () => audio.pause());
          navigator.mediaSession.setActionHandler('previoustrack', () => playPrevious());
          navigator.mediaSession.setActionHandler('nexttrack', () => playNext());
        }
      });

      // 綁定操作按鈕事件
      item.querySelectorAll('.action-btn').forEach(btn => {
        btn.addEventListener('click', e => {
          e.stopPropagation();
          performPlaylistAction(btn.dataset.action, index);
        });
      });
      playlist.appendChild(item);
    });

  };

  const stopPlayback = () => { audio.pause(); audio.removeAttribute('src'); audio.load(); trackTitle.textContent = '請選擇歌曲'; trackArtist.textContent = '上傳 MP3 或拖放檔案進來'; miniTitle.textContent = '—'; miniArtist.textContent = '—'; setArtwork(null, 'Music'); updateProgress(); isPlaying = false; updateBadge('待機中'); playBtn.innerHTML = '<i class="fa-solid fa-play"></i>'; playBtn.setAttribute('aria-pressed', 'false'); miniPlayBtn.innerHTML = '<i class="fa-solid fa-play"></i>' };

  const handleFiles = files => {
    if (!files || files.length === 0) {
      showNotification('沒有選擇任何文件', 'warning');
      return;
    }

    const audioFiles = Array.from(files).filter(f => f.type.startsWith('audio/') || /\.(mp3|wav|m4a|ogg|flac)$/i.test(f.name));
    if (!audioFiles.length) {
      showNotification('沒有找到可播放的音頻文件', 'warning');
      return;
    }

    let loaded = 0;
    audioFiles.forEach(file => {
      extractMetadata(file, track => {
        currentPlaylist.push(track);
        loaded++;
        if (loaded === audioFiles.length) {
          updatePlaylistUI();
          saveState();
          showNotification(`成功加入 ${audioFiles.length} 首歌曲`, 'success');

          // 如果是第一次添加歌曲，自動播放第一首
          if (currentTrackIndex === -1 && currentPlaylist.length > 0) {
            playTrack(0);
          }
        }
      });
    });
  };

  const extractMetadata = (file, cb) => { jsmediatags.read(file, { onSuccess: tag => { const title = tag.tags.title || file.name.replace(/\.[^.]+$/, ''); const artist = tag.tags.artist || '未知藝術家'; let imageUrl = null; if (tag.tags.picture) { const p = tag.tags.picture; const blob = new Blob([new Uint8Array(p.data)], { type: p.format }); imageUrl = URL.createObjectURL(blob) } cb({ title, artist, url: URL.createObjectURL(file), imageUrl, favorite: false }) }, onError: () => { cb({ title: file.name.replace(/\.[^.]+$/, ''), artist: '未知藝術家', url: URL.createObjectURL(file), imageUrl: null, favorite: false }) } }) };
  const STORAGE_KEY = 'mono-player-state-v1';
  const saveState = async () => {
    const s = {
      shuffle: isShuffleMode,
      repeatMode,
      volume: audio.volume,
      playbackRate,
      currentTrackIndex
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
      // 存播放清單到 IndexedDB
      const dbTracks = await Promise.all(currentPlaylist.map(async (t, idx) => {
        let audioBlob = null;
        let imageBlob = null;
        // 把 blob:URL 轉成 blob
        if (t.url && t.url.startsWith("blob:")) {
          const resp = await fetch(t.url);
          audioBlob = await resp.blob();
        }
        if (t.imageUrl && t.imageUrl.startsWith("blob:")) {
          const resp = await fetch(t.imageUrl);
          imageBlob = await resp.blob();
        }
        return {
          id: idx, // 播放清單順序
          title: t.title,
          artist: t.artist,
          favorite: !!t.favorite,
          audioBlob,
          imageBlob
        };
      }));
      await clearDB(); // 清空舊資料
      await saveTracksToDB(dbTracks);
    } catch (e) {
      console.warn("保存失敗", e);
    }
  };
  const restoreState = async () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      isShuffleMode = !!s.shuffle;
      repeatMode = Number.isInteger(s.repeatMode) ? s.repeatMode : (s.repeat ? 1 : 0); // 舊版相容
      savedVolume = typeof s.volume === 'number' ? s.volume : 0.7;
      audio.volume = savedVolume;
      volumeSlider.value = savedVolume;
      const storedRate = parseFloat(s.playbackRate);
      playbackRate = Number.isFinite(storedRate) && storedRate > 0 ? storedRate : 1;
      if (playbackSpeedSelect) {
        const allowedValues = Array.from(playbackSpeedSelect.options).map(opt => opt.value);
        if (allowedValues.includes(String(playbackRate))) {
          playbackSpeedSelect.value = String(playbackRate);
        } else {
          playbackRate = 1;
          playbackSpeedSelect.value = '1';
        }
      }
      audio.playbackRate = playbackRate;
      shuffleBtn.setAttribute('aria-pressed', String(isShuffleMode));
      repeatBtn.setAttribute('aria-pressed', String(repeatMode > 0));
      updateRepeatButtonUI();
      updateVolumeIcon();
      // 🚀 從 IndexedDB 撈取歌曲
      const dbTracks = await loadTracksFromDB();
      if (dbTracks.length) {
        currentPlaylist = dbTracks.map(t => {
          const audioUrl = t.audioBlob ? URL.createObjectURL(t.audioBlob) : null;
          const imageUrl = t.imageBlob ? URL.createObjectURL(t.imageBlob) : null;
          return {
            title: t.title,
            artist: t.artist,
            url: audioUrl,
            imageUrl,
            favorite: !!t.favorite
          };
        });
        updatePlaylistUI();
        const storedIndex = typeof s.currentTrackIndex === 'number' ? s.currentTrackIndex : 0;
        currentTrackIndex = Math.min(storedIndex, currentPlaylist.length - 1);

        // 如果有保存的播放位置，自動播放
        if (currentTrackIndex >= 0 && currentTrackIndex < currentPlaylist.length) {
          updatePlaylistUI()
          showNotification('已恢復清單，請點擊播放開始', 'success')
        }
      }
    } catch (e) {
      console.warn("恢復失敗", e);
    }
  };
  const updateVolumeIcon = () => { const v = audio.volume; let c = 'fa-solid '; if (v === 0) c += 'fa-volume-xmark'; else if (v < .3) c += 'fa-volume-off'; else if (v < .7) c += 'fa-volume-low'; else c += 'fa-volume-high'; volumeIcon.className = c + ' volume-icon' };

  // 綁定所有播放控制按鈕
  playBtn.addEventListener('click', togglePlayPause);
  prevBtn.addEventListener('click', playPrevious);
  nextBtn.addEventListener('click', playNext);
  miniPlayBtn.addEventListener('click', togglePlayPause);
  miniPrevBtn.addEventListener('click', playPrevious);
  miniNextBtn.addEventListener('click', playNext);

  shuffleBtn.addEventListener('click', () => { isShuffleMode = !isShuffleMode; shuffleBtn.setAttribute('aria-pressed', String(isShuffleMode)); showNotification(isShuffleMode ? '隨機播放：開啟' : '隨機播放：關閉', 'success'); saveState() });
  repeatBtn.addEventListener('click', () => {
    repeatMode = (repeatMode + 1) % 3;
    repeatBtn.setAttribute('aria-pressed', String(repeatMode > 0));
    updateRepeatButtonUI();
    const msg = repeatMode === 1 ? '單曲循環：開啟' : (repeatMode === 2 ? '清單循環：開啟' : '循環播放：關閉');
    showNotification(msg, 'success');
    saveState();
  });

  favoriteToggleBtn?.addEventListener('click', () => toggleFavorite(currentTrackIndex));

  playbackSpeedSelect?.addEventListener('change', e => {
    const rate = parseFloat(e.target.value);
    playbackRate = Number.isFinite(rate) && rate > 0 ? rate : 1;
    audio.playbackRate = playbackRate;
    saveState();
    const formattedRate = Number(playbackRate.toFixed(2)).toString();
    showNotification(`播放速度：${formattedRate}×`, 'success');
  });

  sleepTimerBtn?.addEventListener('click', () => {
    sleepTimerIndex = (sleepTimerIndex + 1) % sleepDurations.length;
    applySleepTimerState(sleepDurations[sleepTimerIndex]);
  });

  function updateRepeatButtonUI() {
    if (repeatMode === 1) {
      // 單曲循環
      repeatBtn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22"
        fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 12a9 9 0 1 1-3-6.7" />
      <polyline points="21 3 21 9 15 9" />
      <text x="12" y="16" font-size="8" text-anchor="middle"
            fill="currentColor" font-family="Inter, 'Noto Sans TC', Arial, sans-serif"
            font-weight="300">1</text>
    </svg>`;
      repeatBtn.setAttribute('title', '單曲循環');
    } else if (repeatMode === 2) {
      // 清單循環
      repeatBtn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22"
        fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="17 1 21 5 17 9" />
      <polyline points="7 23 3 19 7 15" />
      <path d="M21 5H8a4 4 0 0 0-4 4v1" />
      <path d="M3 19h13a4 4 0 0 0 4-4v-1" />
      <text x="12" y="16" font-size="8" text-anchor="middle"
            fill="currentColor" font-family="Inter, 'Noto Sans TC', Arial, sans-serif"
            font-weight="300">1</text>
    </svg>`;
      repeatBtn.setAttribute('title', '清單循環');
    } else {
      // 關閉循環
      repeatBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.5">
        <polyline points="17 1 21 5 17 9" />
        <polyline points="7 23 3 19 7 15" />
        <path d="M21 5H8a4 4 0 0 0-4 4v1" />
        <path d="M3 19h13a4 4 0 0 0 4-4v-1" />
      </svg>`;
      repeatBtn.setAttribute('title', '關閉循環');
    }
  }

  progressBar.addEventListener('pointerdown', e => { isDragging = true; progressBar.classList.add('dragging'); seekTo(e.clientX); progressBar.setPointerCapture(e.pointerId) });
  progressBar.addEventListener('pointermove', e => { if (isDragging) seekTo(e.clientX) });
  progressBar.addEventListener('pointerup', e => { isDragging = false; progressBar.classList.remove('dragging'); progressBar.releasePointerCapture(e.pointerId) });
  volumeSlider.addEventListener('input', () => { audio.volume = parseFloat(volumeSlider.value); savedVolume = audio.volume; updateVolumeIcon(); saveState() });
  volumeIcon.addEventListener('click', () => { if (audio.volume > 0) { savedVolume = audio.volume; audio.volume = 0; volumeSlider.value = 0 } else { audio.volume = savedVolume; volumeSlider.value = savedVolume } updateVolumeIcon(); showNotification(audio.volume === 0 ? '已靜音' : '取消靜音', 'success') });

  // 修復拖放和點擊上傳功能
  dropZone.addEventListener('click', () => fileInput.click());

  ['dragover', 'dragleave', 'drop', 'keydown'].forEach(eventName => {
    dropZone.addEventListener(eventName, e => {
      if (eventName === 'dragover') {
        e.preventDefault();
        dropZone.classList.add('dragover');
      }
      if (eventName === 'dragleave') {
        if (!e.relatedTarget || !dropZone.contains(e.relatedTarget)) {
          dropZone.classList.remove('dragover');
        }
      }
      if (eventName === 'drop') {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        handleFiles(e.dataTransfer.files);
      }
      if (eventName === 'keydown' && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        fileInput.click();
      }
    });
  });

  // 文件選擇事件
  fileInput.addEventListener('change', e => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  });

  audio.addEventListener('loadedmetadata', updateProgress);
  audio.addEventListener('timeupdate', () => {
    if (!isDragging) updateProgress();
    if (isSyncedLyrics && parsedLyrics && !userIsScrollingLyrics) {
      updateLyricsHighlight(audio.currentTime);
    }
  });
  audio.addEventListener('play', () => { isPlaying = true; playBtn.innerHTML = '<i class="fa-solid fa-pause"></i>'; playBtn.setAttribute('aria-pressed', 'true'); miniPlayBtn.innerHTML = '<i class="fa-solid fa-pause"></i>'; updateBadge('播放中'); vinyl.classList.add('spinning') }); // 已移除 updateEqualizer(true)
  audio.addEventListener('pause', () => { isPlaying = false; playBtn.innerHTML = '<i class="fa-solid fa-play"></i>'; playBtn.setAttribute('aria-pressed', 'false'); miniPlayBtn.innerHTML = '<i class="fa-solid fa-play"></i>'; updateBadge('已暫停'); vinyl.classList.remove('spinning'); }); // 已移除 updateEqualizer(false)
  audio.addEventListener('ended', () => {
    if (repeatMode === 1) { audio.currentTime = 0; audio.play(); }
    else { playNext(); }
  });
  document.addEventListener('keydown', e => { if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return; switch (e.key) { case ' ': e.preventDefault(); togglePlayPause(); break; case 'ArrowLeft': if (audio.duration) audio.currentTime = Math.max(0, audio.currentTime - 10); break; case 'ArrowRight': if (audio.duration) audio.currentTime = Math.min(audio.duration, audio.currentTime + 10); break; case 'ArrowUp': e.preventDefault(); audio.volume = Math.min(1, audio.volume + 0.1); volumeSlider.value = audio.volume; updateVolumeIcon(); break; case 'ArrowDown': e.preventDefault(); audio.volume = Math.max(0, audio.volume - 0.1); volumeSlider.value = audio.volume; updateVolumeIcon(); break; case 'm': case 'M': volumeIcon.click(); break; case 's': case 'S': shuffleBtn.click(); break; case 'r': case 'R': repeatBtn.click(); break; case 'n': case 'N': playNext(); break; case 'p': case 'P': playPrevious(); break } });

  const initialize = async () => {
    audio.volume = savedVolume;
    volumeSlider.value = savedVolume;
    updateVolumeIcon();
    await restoreState();   // 撈資料、updatePlaylistUI()
    // 再確保一次：手動刷新畫面
    updatePlaylistUI();
    setArtwork(null, 'Music');
    updateBadge('待機中');
    // 已移除 updateEqualizer(false);
    setTimeout(() => showNotification('歡迎使用單色音樂播放器！拖放音樂檔案即可開始播放。', 'success'), 800);
  };

  const cleanup = () => { currentPlaylist.forEach(t => { if (t.url && t.url.startsWith('blob:')) URL.revokeObjectURL(t.url); if (t.imageUrl && t.imageUrl.startsWith('blob:')) URL.revokeObjectURL(t.imageUrl) }) };
  window.addEventListener('beforeunload', cleanup);
  initialize();

  // 修復手機播放按鈕
  if (playBtnMobile) {
    playBtnMobile.addEventListener('click', () => {
      if (currentPlaylist.length === 0) {
        showNotification('請先添加音樂', 'warning');
        return;
      }

      // 如果還沒選歌 → 直接播放第一首
      if (currentTrackIndex === -1) {
        playTrack(0);
      } else {
        togglePlayPause();
      }

      syncMobileTransportState();
    });
  }

  // 改善的歌詞處理功能
  function setLyricsLoading() {
    lyricsContent.textContent = '正在擷取歌詞…';
    parsedLyrics = null;
    isSyncedLyrics = false;
    activeLyricIndex = -1;
  }
  function setLyricsNotFound() {
    lyricsContent.innerHTML = '<span class="lyrics-empty">找不到歌詞，請確認檔名。</span>';
    parsedLyrics = null;
    isSyncedLyrics = false;
    activeLyricIndex = -1;
  }
  function applyLyrics(text) {
    const parsed = parseLRC(text);
    if (parsed && parsed.length) {
      parsedLyrics = parsed;
      isSyncedLyrics = true;
      renderSyncedLyrics(parsedLyrics);
    } else {
      isSyncedLyrics = false;
      parsedLyrics = null;
      renderPlainLyrics(text);
    }
  }
  function renderPlainLyrics(text) {
    const desktopEl = document.getElementById('lyricsContent');
    if (!desktopEl) return;
    desktopEl.textContent = '';

    const notice = document.createElement('div');
    notice.className = 'lyrics-static-notice';
    notice.textContent = '靜態歌詞（無時間軸）';
    desktopEl.appendChild(notice);

    const lines = text.split(/\r?\n/);
    lines.forEach(line => {
      if (!line.trim()) return;
      const div = document.createElement('div');
      div.className = 'lyrics-line';
      div.textContent = line.trim();
      desktopEl.appendChild(div);
    });
  }
  function renderSyncedLyrics(list) {
    const desktopEl = document.getElementById('lyricsContent');
    if (!desktopEl) return;
    desktopEl.textContent = '';
    list.forEach((item) => {
      const div = document.createElement('div');
      div.className = 'lyrics-line';
      div.dataset.time = String(item.time);
      div.textContent = item.text || ' ';
      div.addEventListener('click', () => {
        audio.currentTime = item.time;
        userIsScrollingLyrics = true;
        clearTimeout(lyricsScrollTimeout);
        lyricsScrollTimeout = setTimeout(() => {
          userIsScrollingLyrics = false;
        }, 35);
      });
      desktopEl.appendChild(div);
    });
    activeLyricIndex = -1;
    updateLyricsHighlight(audio.currentTime);
  }
  function updateLyricsHighlight(current) {
    if (!parsedLyrics || !parsedLyrics.length) return;

    // 找出目前應該高亮的行
    let i = parsedLyrics.findIndex((l, idx) =>
      idx < parsedLyrics.length - 1
        ? (current >= l.time && current < parsedLyrics[idx + 1].time)
        : (current >= l.time)
    );
    if (i === -1) i = 0;

    // 如果還沒切換，直接返回
    if (i === activeLyricIndex) return;

    [document.getElementById('lyricsContent'),
    ].forEach(container => {
      if (!container) return;

      container.querySelectorAll('.lyrics-line.active').forEach(el => {
        el.classList.remove('active');
      });

      // 設定新的 active
      const next = container.children[i];
      if (next) {
        next.classList.add('active');

        // 自動捲動
        if (!userIsScrollingLyrics) {
          next.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest'
          });
        }
      }
    });

    activeLyricIndex = i;
  }
  function parseLRC(text) {
    if (!text) return null;
    const lines = text.split(/\r?\n/);
    const result = [];
    const timeTag = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g;
    for (const raw of lines) {
      // 跳過元數據標籤
      if (/^\s*\[(ti|ar|al|by|offset):/i.test(raw)) continue;
      let match;
      const times = [];
      // 重置正則表達式的lastIndex
      timeTag.lastIndex = 0;
      // 提取所有時間標籤
      while ((match = timeTag.exec(raw))) {
        const min = parseInt(match[1], 10) || 0;
        const sec = parseInt(match[2], 10) || 0;
        const ms = parseInt((match[3] || '0').padEnd(3, '0').slice(0, 3), 10) || 0;
        const totalSeconds = min * 60 + sec + (ms / 1000);
        times.push(totalSeconds);
      }
      // 提取歌詞文本（移除所有時間標籤）
      const textPart = raw.replace(/\[\d{1,2}:\d{2}(?:\.\d{1,3})?\]/g, '').trim();
      // 為每個時間點創建歌詞條目
      if (times.length > 0) {
        times.forEach(time => {
          result.push({ time: time, text: textPart });
        });
      }
    }
    // 按時間排序
    result.sort((a, b) => a.time - b.time);
    return result.length > 0 ? result : null;
  }
  // 用戶滾動檢測
  let isUserScrolling = false;
  let scrollEndTimer = null;
  function handleUserScroll() {
    userIsScrollingLyrics = true;
    clearTimeout(lyricsScrollTimeout);
    // 用戶停止滾動2秒後恢復自動滾動
    lyricsScrollTimeout = setTimeout(() => {
      userIsScrollingLyrics = false;
    }, 2000);
  }
  // 監聽用戶滾動事件
  lyricsContent.addEventListener('scroll', handleUserScroll, { passive: true });
  lyricsContent.addEventListener('wheel', handleUserScroll, { passive: true });
  lyricsContent.addEventListener('touchstart', handleUserScroll, { passive: true });
  lyricsContent.addEventListener('touchmove', handleUserScroll, { passive: true });
  const loadLyricsSafely = async (title, artist) => {
    if (!title && !artist) return;
    setLyricsLoading();
    try {
      const text = await fetchLyrics(title, artist);
      applyLyrics(text);
    } catch (_) {
      setLyricsNotFound();
    }
  };
  audio.addEventListener('error', () => {
    let msg = '播放出現錯誤';
    const err = audio.error || null;
    const code = err && typeof err.code === 'number' ? err.code : null;
    const mediaErr = (typeof MediaError !== 'undefined' && MediaError) || err || {};
    switch (code) {
      case mediaErr.MEDIA_ERR_ABORTED: msg = '播放被中止'; break;
      case mediaErr.MEDIA_ERR_NETWORK: msg = '網絡錯誤'; break;
      case mediaErr.MEDIA_ERR_DECODE: msg = '解碼錯誤'; break;
      case mediaErr.MEDIA_ERR_SRC_NOT_SUPPORTED: msg = '不支持的音頻格式'; break;
    }
    showNotification(msg, 'error');
    setTimeout(() => {
      if (currentPlaylist.length > 1) playNext()
    }, 1500);
  });
  window.playTrack = playTrack;
  window.syncMobileTransportState = syncMobileTransportState;
})();


const playerEl = document.querySelector('.player');
let touchStartY = 0, touchStartX = 0;

playerEl?.addEventListener('touchstart', e => {
  if (e.touches.length === 1) {
    touchStartY = e.touches[0].clientY;
    touchStartX = e.touches[0].clientX;
  }
});
// 播放狀態切換時的平滑過渡
function togglePlay() {
  const isPlaying = audioPlayer.paused;
  const vinyl = document.getElementById('vinyl');
  
  // 添加過渡效果
  vinyl.style.transition = 'transform 0.5s ease-out';
  
  if (isPlaying) {
    audioPlayer.play();
    playBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
    playBtnMobile.innerHTML = '<i class="fa-solid fa-pause"></i>';
    vinyl.classList.add('spinning');
    
    // 狀態標誌動畫
    statusBadge.innerHTML = '<i class="fa-solid fa-circle-pulse" style="font-size:6px"></i> 播放中';
    statusBadge.style.transition = 'all 0.3s ease';
    statusBadge.style.background = 'rgba(144, 238, 144, 0.2)';
    statusBadge.style.borderColor = 'rgba(144, 238, 144, 0.3)';
  } else {
    audioPlayer.pause();
    playBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
    playBtnMobile.innerHTML = '<i class="fa-solid fa-play"></i>';
    vinyl.classList.remove('spinning');
    
    // 狀態標誌動畫
    statusBadge.innerHTML = '<i class="fa-solid fa-circle" style="font-size:6px"></i> 已暫停';
    statusBadge.style.background = 'rgba(255, 209, 102, 0.2)';
    statusBadge.style.borderColor = 'rgba(255, 209, 102, 0.3)';
  }
}

// 音量變化時的圖標切換
volumeSlider.addEventListener('input', function() {
  const volume = this.value;
  const icon = document.getElementById('volumeIcon');
  
  if (volume == 0) {
    icon.className = 'fa-solid fa-volume-off volume-icon';
    icon.classList.add('muted');
  } else if (volume < 0.5) {
    icon.className = 'fa-solid fa-volume-low volume-icon';
    icon.classList.remove('muted');
  } else {
    icon.className = 'fa-solid fa-volume-high volume-icon';
    icon.classList.remove('muted');
  }
});