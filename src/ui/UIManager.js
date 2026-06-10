import { createIcons, icons } from 'https://esm.sh/lucide';
import { DeskEditor } from '../game/DeskEditor.js';
import confetti from 'https://esm.sh/canvas-confetti';

function escapeHTML(str) {
    if (!str) return '';
    return String(str).replace(/[&<>'"]/g, match => {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[match];
    });
}

export class UIManager {
  constructor() {
    this.screens = {
      home: document.getElementById('screen-home'),
      lobby: document.getElementById('screen-lobby'),
      decorating: document.getElementById('screen-decorating'),
      guessing: document.getElementById('screen-guessing'),
      replicating: document.getElementById('screen-replicating'),
      results: document.getElementById('screen-results'),
      waiting: document.getElementById('screen-waiting')
    };

    this.deskEditor = null;
    this.timerInterval = null;

    // UI Elements
    this.timerEl = document.getElementById('timer');
    this.themeToggleBtn = document.getElementById('theme-toggle');

    if (this.screens.home) {
        const logo = document.createElement('img');
        logo.src = './assets/images/logo.png';
        logo.alt = 'Game Logo';
        logo.style.maxWidth = '250px';
        logo.style.marginBottom = '10px';
        this.screens.home.insertBefore(logo, this.screens.home.firstChild);

        // Assign a random color on load
        const colorInput = document.getElementById('input-color');
        if (colorInput) {
            colorInput.value = '#' + Math.floor(Math.random() * 16777216).toString(16).padStart(6, '0');
        }

        // Avatar Preview Logic
        const avatarSelect = document.getElementById('select-avatar');
        const avatarPreview = document.getElementById('avatar-preview');
        
        if (avatarSelect && avatarPreview) {
            // Assign a random avatar on load
            const options = avatarSelect.options;
            if (options.length > 0) {
                const randomIdx = Math.floor(Math.random() * options.length);
                avatarSelect.selectedIndex = randomIdx;
            }

            avatarSelect.addEventListener('change', (e) => {
                avatarPreview.innerHTML = `<i data-lucide="${e.target.value}"></i>`;
                createIcons({ icons });
            });

            if (colorInput) {
                colorInput.addEventListener('input', (e) => {
                    avatarPreview.style.color = e.target.value;
                });
                // Apply initial random color to the icon
                avatarPreview.style.color = colorInput.value;
            }
            
            // Apply initial random avatar to the preview
            avatarPreview.innerHTML = `<i data-lucide="${avatarSelect.value}"></i>`;
        }
    }

    this.bindGlobalEvents();
  }

  // --- Audio Helpers ---
  playTone(freq, type, duration, vol) {
      try {
          const ctx = new (window.AudioContext || window.webkitAudioContext)();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = type;
          osc.frequency.setValueAtTime(freq, ctx.currentTime);
          gain.gain.setValueAtTime(vol, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + duration);
      } catch(e) { console.error("Audio failed", e); }
  }
  playCorrectSound() {
      this.playTone(523.25, 'sine', 0.1, 0.1); // C5
      setTimeout(() => this.playTone(659.25, 'sine', 0.2, 0.1), 100); // E5
  }
  playWrongSound() {
      this.playTone(300, 'sawtooth', 0.3, 0.1);
  }

  bindGlobalEvents() {
    this.themeToggleBtn.addEventListener('click', () => {
      document.body.classList.toggle('dark-mode');
    });
  }

  showScreen(screenId) {
    Object.values(this.screens).forEach(screen => {
      if (screen) screen.style.display = 'none';
    });
    if (this.screens[screenId]) {
      this.screens[screenId].style.display = 'flex';
      createIcons({ icons });
    }
  }

  showWaiting(message) {
      this.showScreen('waiting');
      document.getElementById('waiting-message').textContent = message;
  }

  bindHomeEvents({ onCreateRoom, onJoinRoom }) {
    const createBtn = document.getElementById('btn-create-room');
    const joinBtn = document.getElementById('btn-join-room');

    const getPlayerInfo = () => {
        return {
            name: document.getElementById('input-name').value.trim() || 'Player',
            color: document.getElementById('input-color').value,
            avatar: document.getElementById('select-avatar').value
        };
    };

    createBtn.addEventListener('click', () => {
      onCreateRoom(getPlayerInfo());
    });

    joinBtn.addEventListener('click', () => {
      const code = prompt('Enter Room Code:');
      if (code) onJoinRoom(code.toUpperCase(), getPlayerInfo());
    });
  }

  showLobby(code, players, isHost) {
    this.showScreen('lobby');
    document.getElementById('room-code-display').textContent = code;
    this.updateLobbyPlayers(players, isHost);
  }

  updateLobbyPlayers(players, isHost) {
    const list = document.getElementById('lobby-players-list');
    list.innerHTML = '';
    players.forEach(p => {
      const li = document.createElement('li');
      li.style.color = p.color;
      li.innerHTML = `<i data-lucide="${escapeHTML(p.avatar)}"></i> ${escapeHTML(p.name)} ${p.is_host ? '(Host)' : ''}`;
      list.appendChild(li);
    });
    createIcons({ icons });

    const startBtn = document.getElementById('btn-start-game');
    if (isHost) {
        startBtn.style.display = 'block';
    } else {
        startBtn.style.display = 'none';
    }
  }

  bindLobbyEvents({ onStart }) {
     document.getElementById('btn-start-game').onclick = onStart;
  }

  showDecorating(dataManager) {
    this.showScreen('decorating');
    if (!this.deskEditor) {
        this.deskEditor = new DeskEditor(document.getElementById('desk-canvas'), dataManager);
        this.populateAssetsList(dataManager);
    } else {
        this.deskEditor.clear();
    }
    this.updateItemsCounter(0);

    // Re-calculate mouse pointer offsets for Fabric.js when screen becomes visible
    setTimeout(() => this.deskEditor.recalcOffset(), 100);
  }

  populateAssetsList(dataManager) {
      const desksList = document.getElementById('desks-list');
      const itemsList = document.getElementById('items-list');
      const repDesksList = document.getElementById('replicating-desks-list');
      const repItemsList = document.getElementById('replicating-items-list');

      desksList.innerHTML = '';
      itemsList.innerHTML = '';
      if (repDesksList) repDesksList.innerHTML = '';
      if (repItemsList) repItemsList.innerHTML = '';

      dataManager.desks.forEach(desk => {
          const img = document.createElement('img');
          img.src = desk.url;
          img.onclick = () => this.deskEditor.setDesk(desk.id);
          desksList.appendChild(img);
          
          if (repDesksList) {
              const repImg = document.createElement('img');
              repImg.src = desk.url;
              repImg.onclick = () => this.deskEditor.setDesk(desk.id);
              repDesksList.appendChild(repImg);
          }
      });

      dataManager.items.forEach(item => {
          const img = document.createElement('img');
          img.src = item.url;
          img.onclick = () => this.deskEditor.addItem(item.id);
          itemsList.appendChild(img);

          if (repItemsList) {
              const repImg = document.createElement('img');
              repImg.src = item.url;
              repImg.onclick = () => this.deskEditor.addItem(item.id);
              repItemsList.appendChild(repImg);
          }
      });
  }

  getDecorationData() {
      return {
          state: this.deskEditor.getState(),
          screenshot: this.deskEditor.getScreenshot()
      };
  }

  bindEditorEvents({ onSaveDesk, onSaveReplica }) {
      const btnSaveDesk = document.getElementById('btn-save-desk');
      const btnSaveReplica = document.getElementById('btn-save-replica');
      
      if (btnSaveDesk) btnSaveDesk.onclick = onSaveDesk;
      if (btnSaveReplica) btnSaveReplica.onclick = onSaveReplica;
  }

  updateItemsCounter(currentCount) {
      const remaining = Math.max(0, 7 - currentCount);
      const itemsRem = document.getElementById('items-remaining');
      const repItemsRem = document.getElementById('replicating-items-remaining');
      
      if (itemsRem) itemsRem.textContent = remaining;
      if (repItemsRem) repItemsRem.textContent = remaining;
  }

  showGuessing(target, players, onGuess) {
      this.showScreen('guessing');
      document.getElementById('guessing-image').src = target.screenshot_url;

      const list = document.getElementById('guessing-players-list');
      list.innerHTML = '';

      let resultMsg = document.getElementById('guessing-result-msg');
      if (!resultMsg) {
          resultMsg = document.createElement('h3');
          resultMsg.id = 'guessing-result-msg';
          resultMsg.style.textAlign = 'center';
          resultMsg.style.marginTop = '15px';
          resultMsg.style.minHeight = '30px';
          list.parentNode.appendChild(resultMsg);
      }
      resultMsg.textContent = '';

      players.forEach(p => {
          const btn = document.createElement('button');
          btn.textContent = p.name;
          btn.dataset.playerId = p.id;
          btn.onclick = () => {
              // disable all buttons
              Array.from(list.children).forEach(c => c.disabled = true);

              // Highlight correct and incorrect guesses
              Array.from(list.children).forEach(c => {
                  if (c.dataset.playerId === target.id) {
                      c.style.backgroundColor = '#4ade80'; // Green for correct
                      c.style.color = '#111827';
                  } else if (c.dataset.playerId === p.id && p.id !== target.id) {
                      c.style.backgroundColor = '#ef4444'; // Red for incorrect
                  } else {
                      c.style.opacity = '0.5'; // Dim others
                  }
              });

              if (p.id === target.id) {
                  resultMsg.textContent = `Correct! It is ${target.name}'s desk!`;
                  resultMsg.style.color = '#4ade80';
                  this.playCorrectSound();
                  confetti({
                      particleCount: 100,
                      spread: 70,
                      origin: { y: 0.6 }
                  });
              } else {
                  resultMsg.textContent = `Wrong! It was ${target.name}'s desk.`;
                  resultMsg.style.color = '#ef4444';
                  this.playWrongSound();
              }

              // Wait 2.5 seconds to let the player read the result before advancing
              setTimeout(() => {
                  onGuess(p.id);
              }, 2500);
          };
          list.appendChild(btn);
      });
  }

  showReplicating(targetName, dataManager) {
      this.showScreen('replicating');
      document.getElementById('replicating-target').textContent = `Replicate ${targetName}'s desk!`;

      // We reuse the same canvas element, just clear it and append to the replicating screen
      const canvasContainer = document.getElementById('replicating-canvas-container');
      
      // Fabric JS wraps the canvas in a .canvas-container div, so we must append the wrapper if it exists
      const canvasElement = this.deskEditor.canvas.wrapperEl || (this.deskEditor.canvas.getElement ? this.deskEditor.canvas.getElement() : this.deskEditor.canvas);
      canvasContainer.insertBefore(canvasElement, document.getElementById('btn-save-replica'));
      
      this.deskEditor.clear();
      this.updateItemsCounter(0);

      // Re-calculate mouse pointer offsets after canvas wrapper is moved in the DOM
      setTimeout(() => this.deskEditor.recalcOffset(), 100);
  }

  showResults(players) {
      this.showScreen('results');
      const gallery = document.getElementById('results-gallery');
      gallery.innerHTML = '';

      // Sort by score
      const sorted = [...players].sort((a,b) => (b.score || 0) - (a.score || 0));

      sorted.forEach((p, index) => {
          const card = document.createElement('div');
          card.className = 'result-card';

          // Format rank
          const rank = index === 0 ? '🏆 1st Place' : `${index + 1}${index === 1 ? 'nd' : index === 2 ? 'rd' : 'th'} Place`;
          const safeName = escapeHTML(p.name);

          card.innerHTML = `
              <h3>${rank}</h3>
              <img src="${p.screenshot_url}" alt="${safeName}'s Desk">
              <div style="font-size: 1.2rem; font-weight: bold; margin-top: 10px;">
                  <i data-lucide="${escapeHTML(p.avatar)}"></i> ${safeName}
              </div>
              <div style="color: var(--primary); font-weight: bold; font-size: 1.1rem;">${p.score || 0} pts</div>
          `;

          // Add Download Button
          const downloadBtn = document.createElement('button');
          downloadBtn.className = 'download-btn';
          downloadBtn.innerHTML = '<i data-lucide="download" style="width: 16px; height: 16px; vertical-align: middle;"></i> Download Desk';
          downloadBtn.onclick = () => {
              const a = document.createElement('a');
              a.href = p.screenshot_url;
              a.download = `${p.name.replace(/\s+/g, '-').toLowerCase()}-dream-desk.jpg`;
              a.click();
          };

          card.appendChild(downloadBtn);
          gallery.appendChild(card);
      });
      createIcons({ icons });

      // Fire big confetti for the winner!
      confetti({ particleCount: 150, spread: 100, origin: { y: 0.3 }, zIndex: 1000 });
  }

  updateGameStats(currentRound, maxRounds, players) {
      const statsEl = document.getElementById('game-stats');
      if (!statsEl) return;
      statsEl.style.display = 'flex';

      const roundEl = document.getElementById('round-display');
      if (roundEl) {
          roundEl.textContent = `Round: ${currentRound} / ${maxRounds}`;
      }

      const boardEl = document.getElementById('mini-leaderboard');
      if (boardEl) {
          boardEl.innerHTML = '';
          const sorted = [...players].sort((a,b) => (b.score || 0) - (a.score || 0));
          sorted.forEach(p => {
              const div = document.createElement('div');
              div.textContent = `${p.name}: ${p.score || 0} pts`;
              div.style.color = p.color || 'var(--text-color)';
              boardEl.appendChild(div);
          });
      }
  }

  hideGameStats() {
      const statsEl = document.getElementById('game-stats');
      if (statsEl) statsEl.style.display = 'none';
  }

  startTimer(seconds, onComplete) {
      clearInterval(this.timerInterval);
      this.timerEl.style.display = 'block';
      let left = seconds;

      const tick = () => {
          this.timerEl.textContent = `Time left: ${left}s`;
          if (left <= 0) {
              clearInterval(this.timerInterval);
              this.timerEl.style.display = 'none';
              if (onComplete) onComplete();
          }
          left--;
      };

      tick();
      this.timerInterval = setInterval(tick, 1000);
  }

  stopTimer() {
      clearInterval(this.timerInterval);
      this.timerEl.style.display = 'none';
  }
}
