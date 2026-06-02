import { createIcons, icons } from 'lucide';
import { DeskEditor } from '../game/DeskEditor.js';

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
        logo.src = '/assets/images/logo.png';
        logo.alt = 'Game Logo';
        logo.style.maxWidth = '250px';
        logo.style.marginBottom = '10px';
        this.screens.home.insertBefore(logo, this.screens.home.firstChild);
    }

    this.bindGlobalEvents();
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
            name: document.getElementById('input-name').value || 'Player',
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
      li.innerHTML = `<i data-lucide="${p.avatar}"></i> ${p.name} ${p.is_host ? '(Host)' : ''}`;
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

  showGuessing(imageUrl, players, onGuess) {
      this.showScreen('guessing');
      document.getElementById('guessing-image').src = imageUrl;

      const list = document.getElementById('guessing-players-list');
      list.innerHTML = '';

      players.forEach(p => {
          const btn = document.createElement('button');
          btn.textContent = p.name;
          btn.onclick = () => {
              // disable all buttons
              Array.from(list.children).forEach(c => c.disabled = true);
              onGuess(p.id);
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
      const list = document.getElementById('results-list');
      list.innerHTML = '';

      // Sort by score
      const sorted = [...players].sort((a,b) => (b.score || 0) - (a.score || 0));

      sorted.forEach(p => {
          const li = document.createElement('li');
          li.innerHTML = `<i data-lucide="${p.avatar}"></i> ${p.name}: ${p.score || 0} pts`;
          list.appendChild(li);
      });
      createIcons({ icons });
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
