export class GameManager {
  constructor(supabaseManager, dataManager, uiManager) {
    this.supabase = supabaseManager;
    this.dataManager = dataManager;
    this.ui = uiManager;
    this.players = [];
    this.room = null;
    this.currentRound = 1;
    this.maxRounds = 3;
  }

  init() {
    this.ui.showScreen('home');
    this.ui.bindHomeEvents({
      onCreateRoom: this.handleCreateRoom.bind(this),
      onJoinRoom: this.handleJoinRoom.bind(this)
    });
  }

  async handleCreateRoom(playerInfo) {
    try {
      this.room = await this.supabase.createRoom();
      const player = await this.supabase.joinRoom(this.room.id, { ...playerInfo, is_host: true });
      this.setupSubscriptions();
      this.ui.showLobby(this.room.code, [player], true);
    } catch (e) {
      console.error(e);
      alert('Failed to create room');
    }
  }

  async handleJoinRoom(code, playerInfo) {
    try {
      this.room = await this.supabase.getRoomByCode(code);
      if (!this.room) throw new Error('Room not found');

      const player = await this.supabase.joinRoom(this.room.id, { ...playerInfo, is_host: false });
      this.setupSubscriptions();
      const currentPlayers = await this.supabase.getPlayers(this.room.id);
      this.ui.showLobby(this.room.code, currentPlayers, false);
    } catch (e) {
      console.error(e);
      alert('Failed to join room');
    }
  }

  setupSubscriptions() {
    this.supabase.subscribeToRoom(this.room.id, this.handleRoomUpdate.bind(this));
    this.supabase.subscribeToPlayers(this.room.id, this.handlePlayersUpdate.bind(this));

    // Bind Lobby Start
    this.ui.bindLobbyEvents({
        onStart: async () => {
             await this.supabase.updateRoomStatus(this.room.id, 'decorating');
        }
    });
  }

  async handleRoomUpdate(room) {
    const oldStatus = this.room?.status;
    this.room = room;

    // Advance the round for non-host players when transitioning from replicating back to guessing
    if (oldStatus === 'replicating' && room.status === 'guessing') {
        const me = this.players.find(p => p.id === this.supabase.playerId);
        if (!me?.is_host) {
            this.currentRound++;
        }
    }

    this.updateStatsUI();

    // Ignore real-time updates that don't change the game phase
    if (oldStatus === room.status) return;

    if (room.status === 'decorating') {
      this.maxRounds = 3; // Fixed to 3 rounds
      this.startDecoratingPhase();
    } else if (room.status === 'guessing') {
      this.startGuessingPhase();
    } else if (room.status === 'replicating') {
      this.startReplicatingPhase();
    } else if (room.status === 'results') {
      this.showResults();
    }
  }

  async handlePlayersUpdate() {
    this.players = await this.supabase.getPlayers(this.room.id);
    this.updateStatsUI();
    
    if (this.room.status === 'lobby') {
       const isHost = this.players.find(p => p.id === this.supabase.playerId)?.is_host;
       this.ui.updateLobbyPlayers(this.players, isHost);
    }

    // Check if everyone finished decorating
    if (this.room.status === 'decorating' && this.players.find(p => p.id === this.supabase.playerId)?.is_host) {
        const allDone = this.players.every(p => p.screenshot_url);
            if (allDone && this.players.length > 0) {
            await this.supabase.updateRoomStatus(this.room.id, 'guessing');
        }
    }

    // Check if everyone finished guessing
    if (this.room.status === 'guessing' && this.players.find(p => p.id === this.supabase.playerId)?.is_host) {
         // simplified: host just moves it forward after 10s
    }
  }

  async startDecoratingPhase() {
    this.ui.showDecorating(this.dataManager);
    
    const saveAndComplete = async () => {
        this.ui.stopTimer();
        const { state, screenshot } = this.ui.getDecorationData();
        const url = await this.supabase.uploadScreenshot(this.supabase.playerId, screenshot);
        await this.supabase.updatePlayerInfo(this.supabase.playerId, {
            desk_id: state.deskId,
            items: state.items,
            screenshot_url: url
        });
        this.ui.showWaiting('Waiting for others to finish decorating...');
    };

    this.ui.bindEditorEvents({
        onSaveDesk: saveAndComplete,
        onSaveReplica: () => {}
    });

    this.ui.startTimer(180, saveAndComplete);
  }

  async startGuessingPhase() {
     // Pick a random player's screenshot
     const otherPlayers = this.players.filter(p => p.id !== this.supabase.playerId);
     const target = otherPlayers[Math.floor(Math.random() * otherPlayers.length)] || this.players[0];

     this.ui.showGuessing(target.screenshot_url, this.players, async (guessedId) => {
         if (guessedId === target.id) {
             const me = this.players.find(p => p.id === this.supabase.playerId);
             await this.supabase.updatePlayerInfo(this.supabase.playerId, { score: me.score + 25 });
         }
         this.ui.showWaiting('Waiting for others to finish guessing...');

         // Host moves to replicating after 10s
         const me = this.players.find(p => p.id === this.supabase.playerId);
         if (me.is_host) {
            setTimeout(async () => {
               await this.supabase.updateRoomStatus(this.room.id, 'replicating');
            }, 5000);
         }
     });
  }

  async startReplicatingPhase() {
      const otherPlayers = this.players.filter(p => p.id !== this.supabase.playerId);
      const target = otherPlayers[Math.floor(Math.random() * otherPlayers.length)] || this.players[0];

      this.ui.showReplicating(target.name, this.dataManager);

      const saveAndComplete = async () => {
          this.ui.stopTimer();
          const { state } = this.ui.getDecorationData();
          let points = 0;

          if (state.deskId === target.desk_id) points += 15;

          // Basic item check (not checking exact positions for simplicity, just presence)
          const targetItemIds = target.items.map(i => i.id);
          state.items.forEach(item => {
              if (targetItemIds.includes(item.id)) points += 10;
          });

          const me = this.players.find(p => p.id === this.supabase.playerId);
          await this.supabase.updatePlayerInfo(this.supabase.playerId, { score: me.score + points });

          if (me.is_host) {
              setTimeout(async () => {
                  if (this.currentRound < this.maxRounds) {
                      this.currentRound++;
                      await this.supabase.updateRoomStatus(this.room.id, 'guessing', this.currentRound);
                  } else {
                      await this.supabase.updateRoomStatus(this.room.id, 'results');
                  }
              }, 2000); // Wait briefly to ensure all scores hit the database
          }
          this.ui.showWaiting('Waiting for others to finish replicating...');
      };

      this.ui.bindEditorEvents({
          onSaveDesk: () => {},
          onSaveReplica: saveAndComplete
      });

      this.ui.startTimer(180, saveAndComplete);
  }

  showResults() {
      this.ui.showResults(this.players);
  }

  updateStatsUI() {
      // Only show the leaderboard/rounds during active game play
      if (this.room && ['decorating', 'guessing', 'replicating'].includes(this.room.status)) {
          this.ui.updateGameStats(this.currentRound, this.maxRounds, this.players);
      } else {
          this.ui.hideGameStats();
      }
  }
}
