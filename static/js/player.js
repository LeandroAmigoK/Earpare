class AudioPlayer {
  constructor() {
    this.audio = new Audio();
    this.audio.crossOrigin = "anonymous";
    this.queue = [];
    this.currentIndex = -1;
    this.isPlaying = false;
    this.isShuffle = false;
    this.isRepeat = false;
    this.currentSong = null;
    this.hasLoggedStream = false;

    // Synced lyrics data
    this.parsedLyrics = null;
    this.activeLyricIndex = -1;

    // Equalizer & Web Audio API
    this.audioCtx = null;
    this.audioSourceNode = null;
    this.eqFilters = [];
    this.eqFrequencies = [60, 250, 1000, 4000, 12000];
    this.eqPresets = {
      flat: [0, 0, 0, 0, 0],
      bass_boost: [6, 4, 1, 0, -1],
      treble_boost: [-2, 0, 2, 5, 7],
      vocal: [-3, 1, 4, 3, 1],
      electronic: [5, 3, 0, 3, 5],
      rock: [4, 2, -1, 2, 4],
      lofi: [-4, 3, 4, -2, -6]
    };
    this.currentPreset = 'flat';

    this.initElements();
    this.initEventListeners();
    this.initEqualizerUI();
    this.initWaveformVisualizer();
    this.loadSavedPreferences();
  }

  initElements() {
    this.playBtn = document.getElementById('player-play-btn');
    this.prevBtn = document.getElementById('player-prev-btn');
    this.nextBtn = document.getElementById('player-next-btn');
    this.shuffleBtn = document.getElementById('player-shuffle-btn');
    this.repeatBtn = document.getElementById('player-repeat-btn');
    
    this.progressBar = document.getElementById('player-progress');
    this.currentTimeEl = document.getElementById('player-current-time');
    this.durationTimeEl = document.getElementById('player-duration-time');
    
    this.volumeBar = document.getElementById('player-volume');
    this.volumeBtn = document.getElementById('player-volume-btn');
    
    this.thumbEl = document.getElementById('player-thumb');
    this.titleEl = document.getElementById('player-title');
    this.artistEl = document.getElementById('player-artist');
    this.likeBtn = document.getElementById('player-like-btn');
    this.canvas = document.getElementById('waveform-canvas');
    this.mascotBox = document.getElementById('mascot-avatar-box');

    // Queue / Up Next Elements
    this.queueBtn = document.getElementById('player-queue-btn');
    this.queuePanel = document.getElementById('queue-panel');
    this.queueListEl = document.getElementById('queue-list');
    this.queueNowPlayingEl = document.getElementById('queue-now-playing');
    this.queueBadgeEl = document.getElementById('queue-badge');
    this.queueClearBtn = document.getElementById('queue-clear-btn');
    this.queueCloseBtn = document.getElementById('queue-close-btn');
    this.isQueueOpen = false;

    // Lyrics Elements
    this.lyricsBtn = document.getElementById('player-lyrics-btn');
    this.lyricsPanel = document.getElementById('lyrics-panel');
    this.lyricsContentEl = document.getElementById('lyrics-content');
    this.lyricsSongTitleEl = document.getElementById('lyrics-song-title');
    this.lyricsCloseBtn = document.getElementById('lyrics-close-btn');
    this.isLyricsOpen = false;

    // Equalizer Button & Modal
    this.equalizerBtn = document.getElementById('player-equalizer-btn');
    this.equalizerModal = document.getElementById('modal-equalizer');

    // Fullscreen / Immersive Player Elements
    this.expandBtn = document.getElementById('player-expand-btn');
    this.fullscreenEl = document.getElementById('fullscreen-player');
    this.fullscreenCloseBtn = document.getElementById('fullscreen-close-btn');
    this.fullscreenBgEl = document.getElementById('fullscreen-bg');
    this.fullscreenCoverEl = document.getElementById('fullscreen-cover');
    this.fullscreenTitleEl = document.getElementById('fullscreen-title');
    this.fullscreenArtistEl = document.getElementById('fullscreen-artist');
    this.fullscreenAlbumEl = document.getElementById('fullscreen-album');
    this.fullscreenGenreEl = document.getElementById('fullscreen-genre');
    this.fullscreenLyricsTextEl = document.getElementById('fullscreen-lyrics-text');
    this.isFullscreenOpen = false;

    // Share Button
    this.shareBtn = document.getElementById('player-share-btn');
  }

  initEventListeners() {
    this.playBtn?.addEventListener('click', () => this.togglePlay());
    this.prevBtn?.addEventListener('click', () => this.prev());
    this.nextBtn?.addEventListener('click', () => this.next());
    this.shuffleBtn?.addEventListener('click', () => this.toggleShuffle());
    this.repeatBtn?.addEventListener('click', () => this.toggleRepeat());
    this.queueBtn?.addEventListener('click', () => this.toggleQueue());
    this.queueCloseBtn?.addEventListener('click', () => this.toggleQueue(false));
    this.queueClearBtn?.addEventListener('click', () => this.clearQueue());
    
    // Lyrics toggle
    this.lyricsBtn?.addEventListener('click', () => this.toggleLyrics());
    this.lyricsCloseBtn?.addEventListener('click', () => this.toggleLyrics(false));

    // Equalizer Modal toggle
    this.equalizerBtn?.addEventListener('click', () => {
      this.ensureAudioContext();
      if (this.equalizerModal) {
        this.equalizerModal.classList.add('open');
      }
    });

    // Fullscreen toggle
    this.expandBtn?.addEventListener('click', () => this.toggleFullscreen());
    this.thumbEl?.addEventListener('click', () => this.toggleFullscreen());
    this.fullscreenCloseBtn?.addEventListener('click', () => this.toggleFullscreen(false));

    // Share track
    this.shareBtn?.addEventListener('click', () => {
      if (this.currentSong) {
        window.app?.shareItem('song', this.currentSong.id, this.currentSong.title);
      }
    });

    this.likeBtn?.addEventListener('click', () => {
      if (this.currentSong) {
        window.app?.toggleFavorite(this.currentSong.id);
      }
    });

    this.audio.addEventListener('timeupdate', () => this.onTimeUpdate());
    this.audio.addEventListener('loadedmetadata', () => {
      if (this.durationTimeEl) this.durationTimeEl.textContent = this.formatTime(this.audio.duration || 0);
      if (this.progressBar) this.progressBar.max = Math.floor(this.audio.duration || 0);
    });
    this.audio.addEventListener('ended', () => this.onTrackEnded());

    this.progressBar?.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (this.currentTimeEl) this.currentTimeEl.textContent = this.formatTime(val);
      this.updateRangeFill(this.progressBar);
    });

    this.progressBar?.addEventListener('change', (e) => {
      this.audio.currentTime = parseFloat(e.target.value);
      this.updateSyncedLyrics(this.audio.currentTime);
    });

    this.volumeBar?.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      this.audio.volume = val;
      localStorage.setItem('earrape_volume', val);
      this.updateRangeFill(this.volumeBar);
    });

    this.volumeBtn?.addEventListener('click', () => {
      if (this.audio.volume > 0) {
        this.prevVolume = this.audio.volume;
        this.audio.volume = 0;
        if (this.volumeBar) this.volumeBar.value = 0;
      } else {
        this.audio.volume = this.prevVolume || 0.8;
        if (this.volumeBar) this.volumeBar.value = this.audio.volume;
      }
      if (this.volumeBar) this.updateRangeFill(this.volumeBar);
    });

    this.initKeyboardShortcuts();
    this.initMediaSession();
  }

  loadSavedPreferences() {
    const savedVol = localStorage.getItem('earrape_volume');
    if (savedVol !== null) {
      const v = parseFloat(savedVol);
      this.audio.volume = isNaN(v) ? 0.8 : v;
      if (this.volumeBar) this.volumeBar.value = this.audio.volume;
    } else {
      this.audio.volume = 0.8;
      if (this.volumeBar) this.volumeBar.value = 0.8;
    }
    if (this.volumeBar) this.updateRangeFill(this.volumeBar);

    const savedShuffle = localStorage.getItem('earrape_shuffle');
    if (savedShuffle === 'true') {
      this.isShuffle = true;
      this.shuffleBtn?.classList.add('active');
    }

    const savedRepeat = localStorage.getItem('earrape_repeat');
    if (savedRepeat === 'true') {
      this.isRepeat = true;
      this.repeatBtn?.classList.add('active');
    }
  }

  /* ==========================================================================
     WEB AUDIO API EQUALIZER
     ========================================================================== */
  ensureAudioContext() {
    if (this.audioCtx) return;

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.audioCtx = new AudioCtx();
      this.audioSourceNode = this.audioCtx.createMediaElementSource(this.audio);

      let lastNode = this.audioSourceNode;
      this.eqFilters = this.eqFrequencies.map((freq, idx) => {
        const filter = this.audioCtx.createBiquadFilter();
        if (idx === 0) {
          filter.type = 'lowshelf';
        } else if (idx === this.eqFrequencies.length - 1) {
          filter.type = 'highshelf';
        } else {
          filter.type = 'peaking';
          filter.Q.value = 1.0;
        }
        filter.frequency.value = freq;
        filter.gain.value = 0;

        lastNode.connect(filter);
        lastNode = filter;
        return filter;
      });

      lastNode.connect(this.audioCtx.destination);

      const savedPreset = localStorage.getItem('earrape_eq_preset') || 'flat';
      this.applyPreset(savedPreset);
    } catch (err) {
      console.warn("Web Audio API equalizer notice:", err);
    }
  }

  initEqualizerUI() {
    const presetBtns = document.querySelectorAll('.eq-preset-btn');
    presetBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const presetKey = btn.getAttribute('data-preset');
        this.applyPreset(presetKey);
      });
    });

    for (let i = 0; i < 5; i++) {
      const slider = document.getElementById(`eq-slider-${i}`);
      const valLabel = document.getElementById(`eq-val-${i}`);
      if (slider) {
        slider.addEventListener('input', (e) => {
          this.ensureAudioContext();
          const gain = parseFloat(e.target.value);
          if (valLabel) valLabel.textContent = `${gain > 0 ? '+' : ''}${gain}dB`;
          if (this.eqFilters[i]) {
            this.eqFilters[i].gain.value = gain;
          }
          document.querySelectorAll('.eq-preset-btn').forEach(b => b.classList.remove('active'));
        });
      }
    }
  }

  applyPreset(presetKey) {
    this.ensureAudioContext();
    const gains = this.eqPresets[presetKey] || this.eqPresets.flat;
    this.currentPreset = presetKey;
    localStorage.setItem('earrape_eq_preset', presetKey);

    document.querySelectorAll('.eq-preset-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-preset') === presetKey);
    });

    gains.forEach((gain, i) => {
      if (this.eqFilters[i]) {
        this.eqFilters[i].gain.value = gain;
      }
      const slider = document.getElementById(`eq-slider-${i}`);
      const valLabel = document.getElementById(`eq-val-${i}`);
      if (slider) slider.value = gain;
      if (valLabel) valLabel.textContent = `${gain > 0 ? '+' : ''}${gain}dB`;
    });
  }

  resetEqualizer() {
    this.applyPreset('flat');
    window.app?.showToast("Ecualizador restablecido a Plano");
  }

  /* ==========================================================================
     WAVEFORM VISUALIZER
     ========================================================================== */
  initWaveformVisualizer() {
    if (!this.canvas) return;
    const ctx = this.canvas.getContext('2d');
    let phase = 0;

    const render = () => {
      requestAnimationFrame(render);
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

      const numBars = 7;
      const barWidth = 3;
      const gap = 5;
      const totalWidth = (numBars * barWidth) + ((numBars - 1) * gap);
      const startX = (this.canvas.width - totalWidth) / 2;

      phase += 0.12;

      for (let i = 0; i < numBars; i++) {
        let barHeight = 4;
        if (this.isPlaying) {
          barHeight = 5 + Math.abs(Math.sin(phase + i * 0.9)) * 16;
        }

        const x = startX + i * (barWidth + gap);
        const y = (this.canvas.height - barHeight) / 2;

        const grad = ctx.createLinearGradient(0, y, 0, y + barHeight);
        grad.addColorStop(0, '#c084fc');
        grad.addColorStop(1, '#a855f7');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 2);
        ctx.fill();
      }
    };
    render();
  }

  /* ==========================================================================
     PLAYBACK FLOW
     ========================================================================== */
  playTrack(song, playlistQueue = null) {
    if (!song) return;

    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }

    if (playlistQueue && playlistQueue.length > 0) {
      this.queue = [...playlistQueue];
      this.currentIndex = this.queue.findIndex(s => s.id === song.id);
      if (this.currentIndex === -1) {
        this.queue.unshift(song);
        this.currentIndex = 0;
      }
    } else {
      if (this.queue.length === 0) {
        this.queue = [song];
        this.currentIndex = 0;
      } else {
        const found = this.queue.findIndex(s => s.id === song.id);
        if (found !== -1) {
          this.currentIndex = found;
        } else {
          this.queue.splice(this.currentIndex + 1, 0, song);
          this.currentIndex++;
        }
      }
    }

    this.currentSong = song;
    this.hasLoggedStream = false;
    this.audio.src = song.audio_url;
    
    this.parseAndSetupLyrics(song.lyrics);
    this.updatePlayerUI(song);
    this.renderQueue();
    
    this.audio.play().then(() => {
      this.isPlaying = true;
      this.updatePlayStateUI();
    }).catch(err => {
      console.warn("Playback requires click gesture:", err);
    });

    window.app?.onSongPlayed(song.id);
  }

  togglePlay() {
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }

    if (!this.currentSong) {
      if (this.queue.length > 0) {
        this.playTrack(this.queue[0], this.queue);
      }
      return;
    }

    if (this.isPlaying) {
      this.audio.pause();
      this.isPlaying = false;
    } else {
      this.audio.play();
      this.isPlaying = true;
    }
    this.updatePlayStateUI();
    window.app?.onSongPlayed(this.currentSong.id);
  }

  next() {
    if (this.queue.length === 0) return;
    if (this.isShuffle) {
      this.currentIndex = Math.floor(Math.random() * this.queue.length);
    } else {
      this.currentIndex = (this.currentIndex + 1) % this.queue.length;
    }
    this.playTrack(this.queue[this.currentIndex], this.queue);
  }

  prev() {
    if (this.queue.length === 0) return;
    if (this.audio.currentTime > 3) {
      this.audio.currentTime = 0;
      return;
    }
    this.currentIndex = (this.currentIndex - 1 + this.queue.length) % this.queue.length;
    this.playTrack(this.queue[this.currentIndex], this.queue);
  }

  toggleShuffle() {
    this.isShuffle = !this.isShuffle;
    this.shuffleBtn?.classList.toggle('active', this.isShuffle);
    localStorage.setItem('earrape_shuffle', this.isShuffle);
    window.app?.showToast(this.isShuffle ? "Aleatorio activado" : "Aleatorio desactivado");
  }

  toggleRepeat() {
    this.isRepeat = !this.isRepeat;
    this.repeatBtn?.classList.toggle('active', this.isRepeat);
    localStorage.setItem('earrape_repeat', this.isRepeat);
    window.app?.showToast(this.isRepeat ? "Repetición activada" : "Repetición desactivada");
  }

  onTrackEnded() {
    if (this.isRepeat) {
      this.audio.currentTime = 0;
      this.audio.play();
    } else {
      this.next();
    }
  }

  onTimeUpdate() {
    const cur = this.audio.currentTime || 0;
    const dur = this.audio.duration || 0;
    
    if (this.currentTimeEl) this.currentTimeEl.textContent = this.formatTime(cur);
    if (this.progressBar) {
      this.progressBar.value = Math.floor(cur);
      this.updateRangeFill(this.progressBar);
    }

    this.updateSyncedLyrics(cur);

    if (!this.hasLoggedStream && cur > 5 && this.currentSong) {
      this.hasLoggedStream = true;
      fetch(`/api/songs/${this.currentSong.id}/play`, { method: 'POST' }).catch(() => {});
    }
  }

  /* ==========================================================================
     SYNCED LRC LYRICS PARSER & ENGINE
     ========================================================================== */
  parseAndSetupLyrics(lyricsText) {
    this.parsedLyrics = null;
    this.activeLyricIndex = -1;

    if (!lyricsText || !lyricsText.trim()) return;

    const lines = [];
    const rawLines = lyricsText.split('\n');
    let hasTimestamps = false;

    for (let line of rawLines) {
      const res = /\[(\d{2}):(\d{2}(?:\.\d{1,3})?)\](.*)/.exec(line);
      if (res) {
        hasTimestamps = true;
        const mins = parseInt(res[1], 10);
        const secs = parseFloat(res[2]);
        const text = res[3].trim();
        lines.push({ time: mins * 60 + secs, text: text || '♪' });
      }
    }

    if (hasTimestamps && lines.length > 0) {
      lines.sort((a, b) => a.time - b.time);
      this.parsedLyrics = lines;
    }
  }

  renderLyricsUI(song) {
    if (this.lyricsSongTitleEl) {
      this.lyricsSongTitleEl.textContent = `— ${song.title}`;
    }

    if (!this.lyricsContentEl) return;

    if (!song.lyrics || !song.lyrics.trim()) {
      this.lyricsContentEl.innerHTML = `<p class="lyrics-placeholder">No hay letras disponibles para esta canción.<br><span style="font-size: 0.8rem; opacity: 0.7;">Los artistas pueden agregar la letra desde el Creator Studio.</span></p>`;
      if (this.fullscreenLyricsTextEl) this.fullscreenLyricsTextEl.innerHTML = 'No hay letras registradas para esta canción.';
      return;
    }

    if (this.parsedLyrics) {
      const html = this.parsedLyrics.map((item, idx) => `
        <div class="lyric-line" id="lyric-line-${idx}" data-idx="${idx}" data-time="${item.time}" onclick="window.app.player.seekToLyric(${item.time})">
          ${item.text}
        </div>
      `).join('');

      this.lyricsContentEl.innerHTML = `<div class="synced-lyrics-wrap">${html}</div>`;

      if (this.fullscreenLyricsTextEl) {
        const fsHtml = this.parsedLyrics.map((item, idx) => `
          <div class="lyric-line" id="fs-lyric-line-${idx}" data-idx="${idx}" data-time="${item.time}" onclick="window.app.player.seekToLyric(${item.time})">
            ${item.text}
          </div>
        `).join('');
        this.fullscreenLyricsTextEl.innerHTML = `<div class="synced-lyrics-wrap">${fsHtml}</div>`;
      }
    } else {
      this.lyricsContentEl.innerHTML = `<div style="line-height: 2.1; font-size: 1.05rem;">${song.lyrics.replace(/\n/g, '<br>')}</div>`;
      if (this.fullscreenLyricsTextEl) {
        this.fullscreenLyricsTextEl.innerHTML = `<div style="line-height: 2.1; font-size: 1.3rem;">${song.lyrics.replace(/\n/g, '<br>')}</div>`;
      }
    }
  }

  updateSyncedLyrics(currentTime) {
    if (!this.parsedLyrics || this.parsedLyrics.length === 0) return;

    let activeIdx = -1;
    for (let i = 0; i < this.parsedLyrics.length; i++) {
      if (currentTime >= this.parsedLyrics[i].time) {
        activeIdx = i;
      } else {
        break;
      }
    }

    if (activeIdx !== this.activeLyricIndex) {
      this.activeLyricIndex = activeIdx;

      document.querySelectorAll('#lyrics-content .lyric-line').forEach(el => el.classList.remove('active'));
      if (activeIdx >= 0) {
        const activeLineEl = document.getElementById(`lyric-line-${activeIdx}`);
        if (activeLineEl) {
          activeLineEl.classList.add('active');
          activeLineEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }

      document.querySelectorAll('#fullscreen-lyrics-text .lyric-line').forEach(el => el.classList.remove('active'));
      if (activeIdx >= 0) {
        const fsActiveLineEl = document.getElementById(`fs-lyric-line-${activeIdx}`);
        if (fsActiveLineEl) {
          fsActiveLineEl.classList.add('active');
          fsActiveLineEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }
  }

  seekToLyric(time) {
    if (this.audio) {
      this.audio.currentTime = time;
      this.updateSyncedLyrics(time);
    }
  }

  /* ==========================================================================
     UI UPDATERS
     ========================================================================== */
  updatePlayerUI(song) {
    if (!song) return;
    if (this.thumbEl) this.thumbEl.src = song.cover_url || '/static/assets/default_cover.png';
    if (this.titleEl) this.titleEl.textContent = song.title;
    if (this.artistEl) {
      this.artistEl.textContent = song.artist_name || 'Artista';
      this.artistEl.onclick = () => window.app?.navigate(`artist/${song.artist_id}`);
    }
    
    this.updateLikeButton(song.is_favorite);
    this.renderLyricsUI(song);

    if (this.fullscreenBgEl) this.fullscreenBgEl.style.backgroundImage = `url('${song.cover_url || '/static/assets/default_cover.png'}')`;
    if (this.fullscreenCoverEl) this.fullscreenCoverEl.src = song.cover_url || '/static/assets/default_cover.png';
    if (this.fullscreenTitleEl) this.fullscreenTitleEl.textContent = song.title;
    if (this.fullscreenArtistEl) this.fullscreenArtistEl.textContent = song.artist_name || 'Artista';
    if (this.fullscreenAlbumEl) this.fullscreenAlbumEl.textContent = song.album || 'Single';
    if (this.fullscreenGenreEl) this.fullscreenGenreEl.textContent = song.genre || 'MUSIC';

    this.updateMediaSession(song);
  }

  updateLikeButton(isLiked) {
    if (!this.likeBtn) return;
    if (isLiked) {
      this.likeBtn.classList.add('liked');
      this.likeBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2">
          <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
        </svg>`;
    } else {
      this.likeBtn.classList.remove('liked');
      this.likeBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
        </svg>`;
    }
  }

  updatePlayStateUI() {
    if (!this.playBtn) return;
    if (this.isPlaying) {
      this.playBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <rect x="6" y="4" width="4" height="16" rx="1"/>
          <rect x="14" y="4" width="4" height="16" rx="1"/>
        </svg>`;
      this.mascotBox?.classList.add('dancing');
    } else {
      this.playBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="5 3 19 12 5 21 5 3"/>
        </svg>`;
      this.mascotBox?.classList.remove('dancing');
    }
  }

  updateRangeFill(input) {
    if (!input) return;
    const min = input.min || 0;
    const max = input.max || 100;
    const val = input.value;
    const percentage = ((val - min) / (max - min)) * 100;
    input.style.background = `linear-gradient(to right, #a855f7 0%, #a855f7 ${percentage}%, rgba(168,85,247,0.2) ${percentage}%, rgba(168,85,247,0.2) 100%)`;
  }

  formatTime(secs) {
    const min = Math.floor(secs / 60);
    const sec = Math.floor(secs % 60);
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
  }

  /* ==========================================================================
     QUEUE / UP NEXT MANAGEMENT
     ========================================================================== */
  toggleQueue(force) {
    this.isQueueOpen = force !== undefined ? force : !this.isQueueOpen;
    this.queuePanel?.classList.toggle('open', this.isQueueOpen);
    this.queueBtn?.classList.toggle('active', this.isQueueOpen);
    if (this.isQueueOpen) {
      this.renderQueue();
    }
  }

  addToQueue(song) {
    if (!song) return;
    if (this.queue.length === 0) {
      this.playTrack(song, [song]);
      return;
    }
    this.queue.push(song);
    this.renderQueue();
    window.app?.showToast(`🎵 Añadido a la cola: "${song.title}"`);
  }

  removeFromQueue(actualIndex) {
    if (actualIndex < 0 || actualIndex >= this.queue.length) return;
    this.queue.splice(actualIndex, 1);
    if (actualIndex < this.currentIndex) {
      this.currentIndex--;
    }
    this.renderQueue();
    window.app?.showToast('Pista quitada de la cola');
  }

  moveQueueItem(actualIndex, direction) {
    const targetIndex = actualIndex + direction;
    if (targetIndex <= this.currentIndex || targetIndex >= this.queue.length) return;
    const temp = this.queue[actualIndex];
    this.queue[actualIndex] = this.queue[targetIndex];
    this.queue[targetIndex] = temp;
    this.renderQueue();
  }

  clearQueue() {
    if (this.currentSong) {
      this.queue = [this.currentSong];
      this.currentIndex = 0;
    } else {
      this.queue = [];
      this.currentIndex = -1;
    }
    this.renderQueue();
    window.app?.showToast('Cola de reproducción vaciada');
  }

  playFromQueue(actualIndex) {
    if (actualIndex >= 0 && actualIndex < this.queue.length) {
      this.currentIndex = actualIndex;
      this.playTrack(this.queue[this.currentIndex], this.queue);
    }
  }

  renderQueue() {
    if (!this.queuePanel) return;

    const upcomingCount = Math.max(0, this.queue.length - 1 - this.currentIndex);
    if (this.queueBadgeEl) {
      this.queueBadgeEl.textContent = `${upcomingCount} ${upcomingCount === 1 ? 'pista' : 'pistas'}`;
    }

    if (this.queueNowPlayingEl) {
      if (this.currentSong) {
        this.queueNowPlayingEl.innerHTML = `
          <img src="${this.currentSong.cover_url || '/static/assets/default_cover.png'}" class="queue-item-thumb" />
          <div class="queue-item-info">
            <div class="queue-item-title">${this.currentSong.title}</div>
            <div class="queue-item-artist">${this.currentSong.artist_name || 'Artista'} &bull; ${this.formatTime(this.currentSong.duration || 0)}</div>
          </div>
          <span style="color: var(--accent-purple-light); font-size: 0.72rem; font-weight: 800; text-transform: uppercase;">Sonando</span>
        `;
      } else {
        this.queueNowPlayingEl.innerHTML = `<p style="color: var(--text-muted); font-size: 0.85rem;">Ninguna pista en reproducción</p>`;
      }
    }

    if (this.queueListEl) {
      const upcomingTracks = [];
      for (let i = this.currentIndex + 1; i < this.queue.length; i++) {
        upcomingTracks.push({ track: this.queue[i], actualIndex: i, upcomingIndex: i - this.currentIndex });
      }

      if (upcomingTracks.length === 0) {
        this.queueListEl.innerHTML = `
          <p style="color: var(--text-muted); font-size: 0.85rem; padding: 18px 0; text-align: center;">
            No hay más canciones en la cola.<br>
            <span style="font-size: 0.78rem; opacity: 0.7;">Añade canciones desde el menú de cualquier pista.</span>
          </p>
        `;
      } else {
        this.queueListEl.innerHTML = upcomingTracks.map(({ track, actualIndex, upcomingIndex }, idx) => `
          <div class="queue-item" onclick="window.app.player.playFromQueue(${actualIndex})">
            <div class="queue-item-order-btns" onclick="event.stopPropagation()">
              <button class="queue-order-btn" title="Subir" ${idx === 0 ? 'disabled style="opacity:0.2;"' : ''} onclick="window.app.player.moveQueueItem(${actualIndex}, -1)">▲</button>
              <button class="queue-order-btn" title="Bajar" ${idx === upcomingTracks.length - 1 ? 'disabled style="opacity:0.2;"' : ''} onclick="window.app.player.moveQueueItem(${actualIndex}, 1)">▼</button>
            </div>
            <img src="${track.cover_url || '/static/assets/default_cover.png'}" class="queue-item-thumb" />
            <div class="queue-item-info">
              <div class="queue-item-title">${track.title}</div>
              <div class="queue-item-artist">${track.artist_name || 'Artista'} &bull; ${this.formatTime(track.duration || 0)}</div>
            </div>
            <button class="queue-remove-btn" title="Quitar de la cola" onclick="event.stopPropagation(); window.app.player.removeFromQueue(${actualIndex})">
              &times;
            </button>
          </div>
        `).join('');
      }
    }
  }

  /* ==========================================================================
     LYRICS DRAWER
     ========================================================================== */
  toggleLyrics(force) {
    this.isLyricsOpen = force !== undefined ? force : !this.isLyricsOpen;
    if (this.isLyricsOpen && this.isQueueOpen) {
      this.toggleQueue(false);
    }
    this.lyricsPanel?.classList.toggle('open', this.isLyricsOpen);
    this.lyricsBtn?.classList.toggle('active', this.isLyricsOpen);
    if (this.isLyricsOpen && this.currentSong) {
      this.renderLyricsUI(this.currentSong);
      this.updateSyncedLyrics(this.audio.currentTime);
    }
  }

  /* ==========================================================================
     FULLSCREEN / IMMERSIVE PLAYER
     ========================================================================== */
  toggleFullscreen(force) {
    this.isFullscreenOpen = force !== undefined ? force : !this.isFullscreenOpen;
    this.fullscreenEl?.classList.toggle('open', this.isFullscreenOpen);
    document.body.style.overflow = this.isFullscreenOpen ? 'hidden' : '';
    if (this.isFullscreenOpen && this.currentSong) {
      this.renderLyricsUI(this.currentSong);
      this.updateSyncedLyrics(this.audio.currentTime);
    }
  }

  /* ==========================================================================
     KEYBOARD SHORTCUTS
     ========================================================================== */
  initKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      if (e.code === 'Space') {
        e.preventDefault();
        this.togglePlay();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        this.audio.currentTime = Math.min((this.audio.duration || 0), (this.audio.currentTime || 0) + 5);
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        this.audio.currentTime = Math.max(0, (this.audio.currentTime || 0) - 5);
      } else if (e.code === 'ArrowUp') {
        e.preventDefault();
        this.audio.volume = Math.min(1, this.audio.volume + 0.05);
        if (this.volumeBar) this.volumeBar.value = this.audio.volume;
        this.updateRangeFill(this.volumeBar);
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        this.audio.volume = Math.max(0, this.audio.volume - 0.05);
        if (this.volumeBar) this.volumeBar.value = this.audio.volume;
        this.updateRangeFill(this.volumeBar);
      } else if (e.key.toLowerCase() === 'm') {
        this.volumeBtn?.click();
      } else if (e.key.toLowerCase() === 'l') {
        if (this.currentSong) window.app?.toggleFavorite(this.currentSong.id);
      } else if (e.key.toLowerCase() === 'q') {
        this.toggleQueue();
      } else if (e.key.toLowerCase() === 'e') {
        this.equalizerBtn?.click();
      } else if (e.key === 'Escape') {
        if (this.isFullscreenOpen) this.toggleFullscreen(false);
        if (this.isLyricsOpen) this.toggleLyrics(false);
        if (this.isQueueOpen) this.toggleQueue(false);
        window.app?.closeModals();
      }
    });
  }

  /* ==========================================================================
     MEDIASESSION API
     ========================================================================== */
  initMediaSession() {
    if (!('mediaSession' in navigator)) return;

    navigator.mediaSession.setActionHandler('play', () => this.togglePlay());
    navigator.mediaSession.setActionHandler('pause', () => this.togglePlay());
    navigator.mediaSession.setActionHandler('previoustrack', () => this.prev());
    navigator.mediaSession.setActionHandler('nexttrack', () => this.next());
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime !== undefined) {
        this.audio.currentTime = details.seekTime;
      }
    });
  }

  updateMediaSession(song) {
    if (!('mediaSession' in navigator) || !song) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: song.title,
      artist: song.artist_name || 'EarRape Music',
      album: song.album || 'Single',
      artwork: [
        { src: song.cover_url || '/static/assets/default_cover.png', sizes: '512x512', type: 'image/png' }
      ]
    });
  }
}

window.AudioPlayer = AudioPlayer;
