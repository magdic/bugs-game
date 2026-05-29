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
  }

  populateAssetsList(dataManager) {
      const desksList = document.getElementById('desks-list');
      const itemsList = document.getElementById('items-list');

      desksList.innerHTML = '';
      itemsList.innerHTML = '';

      dataManager.desks.forEach(desk => {
          const img = document.createElement('img');
          img.src = desk.url;
          img.onclick = () => this.deskEditor.setDesk(desk.id);
          desksList.appendChild(img);
      });

      dataManager.items.forEach(item => {
          const img = document.createElement('img');
          img.src = item.url;
          img.onclick = () => this.deskEditor.addItem(item.id);
          itemsList.appendChild(img);
      });
  }

  getDecorationData() {
      return {
          state: this.deskEditor.getState(),
          screenshot: this.deskEditor.getScreenshot()
      };
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
      canvasContainer.appendChild(this.deskEditor.canvas);
      this.deskEditor.clear();
  }

  showResults(players) {
      this.showScreen('results');
      const list = document.getElementById('results-list');
      list.innerHTML = '';

      // Sort by score
      const sorted = [...players].sort((a,b) => b.score - a.score);

      sorted.forEach(p => {
          const li = document.createElement('li');
          li.innerHTML = `<i data-lucide="${p.avatar}"></i> ${p.name}: ${p.score} pts`;
          list.appendChild(li);
      });
      createIcons({ icons });
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
}
