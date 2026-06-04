export class GameManager {
  constructor(supabaseManager, dataManager, uiManager) {
    this.supabase = supabaseManager;
    this.dataManager = dataManager;
    this.ui = uiManager;
    this.players = [];
    this.room = null;
    this.currentRound = 1;
    this.maxRounds = 4;
    this.isTransitioning = false;
    this.hostTimer = null;
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

  clearHostTimer() {
      if (this.hostTimer) {
          clearTimeout(this.hostTimer);
          this.hostTimer = null;
      }
  }

  setHostTimer(seconds, action) {
      this.clearHostTimer();
      const me = this.players.find(p => p.id === this.supabase.playerId);
      if (me?.is_host) {
          this.hostTimer = setTimeout(action, seconds * 1000);
      }
  }

  setupSubscriptions() {
    this.supabase.subscribeToRoom(this.room.id, this.handleRoomUpdate.bind(this));
    this.supabase.subscribeToPlayers(this.room.id, this.handlePlayersUpdate.bind(this));

    // Bind Lobby Start
    this.ui.bindLobbyEvents({
        onStart: async () => {
             try {
                 this.isTransitioning = true;
                 await this.supabase.updateRoomStatus(this.room.id, 'decorating');
             } catch (err) {
                 console.error('Failed to start game:', err);
                 this.isTransitioning = false;
             }
        }
    });
  }

  async handleRoomUpdate(room) {
    const oldStatus = this.room?.status;
    this.room = room;

    // Ensure non-host players have their local round number updated
    if (room.round) {
        this.currentRound = room.round;
    }

    this.isTransitioning = false;
    
    if (oldStatus !== room.status) {
        this.clearHostTimer();
    }

    // Ignore real-time updates that don't change the game phase
    if (oldStatus === room.status) return;

    if (room.status === 'decorating') {
      this.maxRounds = 4; // Fixed to 4 rounds
      this.startDecoratingPhase();
    } else if (room.status === 'guessing') {
      this.startGuessingPhase();
    } else if (room.status === 'replicating') {
      this.startReplicatingPhase();
    } else if (room.status === 'results') {
      this.showResults();
    }

    this.updateStatsUI();
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
        if (allDone && this.players.length > 0 && !this.isTransitioning) {
            this.isTransitioning = true;
            this.clearHostTimer();
            try {
                await this.supabase.updateRoomStatus(this.room.id, 'guessing');
            } catch (err) {
                console.error('Failed to transition to guessing:', err);
                this.isTransitioning = false;
            }
        }
    }

    // Check if everyone finished guessing or replicating
    if (['guessing', 'replicating'].includes(this.room.status) && this.players.find(p => p.id === this.supabase.playerId)?.is_host) {
        const phaseId = `${this.room.status}_${this.currentRound}`;
        const allDone = this.players.every(p => p.current_phase === phaseId);
        
        if (allDone && this.players.length > 0 && !this.isTransitioning) {
            this.isTransitioning = true;
            this.clearHostTimer();
            try {
                if (this.room.status === 'guessing') {
                    await this.supabase.updateRoomStatus(this.room.id, 'replicating');
                } else if (this.room.status === 'replicating') {
                    if (this.currentRound < this.maxRounds) {
                        this.currentRound++;
                        await this.supabase.updateRoomStatus(this.room.id, 'guessing', this.currentRound);
                    } else {
                        await this.supabase.updateRoomStatus(this.room.id, 'results');
                    }
                }
            } catch (err) {
                console.error(`Failed to transition from ${this.room.status}:`, err);
                this.isTransitioning = false;
            }
        }
    }
  }

  async startDecoratingPhase() {
    this.ui.showDecorating(this.dataManager);
    
    let isSaving = false;
    const saveAndComplete = async () => {
        if (isSaving) return;
        isSaving = true;
        this.ui.stopTimer();
        this.ui.showWaiting('Saving your desk...');
        
        try {
            const { state, screenshot } = this.ui.getDecorationData();
            const url = await this.supabase.uploadScreenshot(this.supabase.playerId, screenshot);
            await this.supabase.updatePlayerInfo(this.supabase.playerId, {
                desk_id: state.deskId,
                items: state.items,
                screenshot_url: url
            });
            this.ui.showWaiting('Waiting for others to finish decorating...');
        } catch (err) {
            console.error('Failed to save desk:', err);
            isSaving = false;
            alert('Failed to save desk! An Adblocker or browser extension might be blocking the connection. Please try again.');
            this.ui.showScreen('decorating');
        }
    };

    this.ui.bindEditorEvents({
        onSaveDesk: saveAndComplete,
        onSaveReplica: () => {}
    });

    this.ui.startTimer(180, saveAndComplete);

    // Host enforces a strict timer to transition if not everyone finishes early
    this.setHostTimer(180, async () => {
        if (this.room.status === 'decorating' && !this.isTransitioning) {
            this.isTransitioning = true;
            try {
                await this.supabase.updateRoomStatus(this.room.id, 'guessing');
            } catch (err) {
                console.error('Failed to transition to guessing:', err);
            }
        }
    });
  }

  async startGuessingPhase() {
     // Pick a random player's screenshot
     const otherPlayers = this.players.filter(p => p.id !== this.supabase.playerId);
     // Guarantee they never guess their own desk (unless playing completely solo)
     const target = otherPlayers.length > 0 ? otherPlayers[Math.floor(Math.random() * otherPlayers.length)] : this.players[0];

     this.ui.showGuessing(target, this.players, async (guessedId) => {
         const me = this.players.find(p => p.id === this.supabase.playerId);
         let updates = { current_phase: `guessing_${this.currentRound}` };
         if (guessedId === target.id) {
             updates.score = (me.score || 0) + 25;
         }
         try {
             await this.supabase.updatePlayerInfo(this.supabase.playerId, updates);
         } catch (err) {
             if (err?.code === 'PGRST204') {
                 console.warn("Missing 'current_phase' column in DB. Auto-skip disabled. Retrying score update...");
                 delete updates.current_phase;
                 if (Object.keys(updates).length > 0) {
                     await this.supabase.updatePlayerInfo(this.supabase.playerId, updates).catch(console.error);
                 }
             } else {
                 console.error('Failed to update score/phase:', err);
             }
         }
         this.ui.showWaiting('Waiting for others to finish guessing...');
     });

     // Give players a 30s timer for the guessing phase
     this.ui.startTimer(30, () => {
         this.ui.showWaiting('Time is up! Waiting for next round...');
     });

     this.setHostTimer(30, async () => {
         if (this.room.status === 'guessing' && !this.isTransitioning) {
             this.isTransitioning = true;
             try {
                 await this.supabase.updateRoomStatus(this.room.id, 'replicating');
             } catch (err) {
                 console.error('Failed to move to replicating:', err);
                 this.isTransitioning = false;
             }
         }
     });
  }

  async startReplicatingPhase() {
      const otherPlayers = this.players.filter(p => p.id !== this.supabase.playerId);
      // Guarantee they never replicate their own desk (unless playing completely solo)
      const target = otherPlayers.length > 0 ? otherPlayers[Math.floor(Math.random() * otherPlayers.length)] : this.players[0];

      this.ui.showReplicating(target.name, this.dataManager);

      let isSaving = false;
      const saveAndComplete = async () => {
          if (isSaving) return;
          isSaving = true;
          this.ui.stopTimer();
          this.ui.showWaiting('Saving your replica...');
          const { state } = this.ui.getDecorationData();
          let points = 0;

          if (state.deskId === target.desk_id) points += 15;

          // Basic item check (not checking exact positions for simplicity, just presence)
          const targetItemIds = target.items.map(i => i.id);
          state.items.forEach(item => {
              if (targetItemIds.includes(item.id)) points += 10;
          });

          const me = this.players.find(p => p.id === this.supabase.playerId);
          let updates = {
              score: (me.score || 0) + points,
              current_phase: `replicating_${this.currentRound}`
          };
          
          try {
              await this.supabase.updatePlayerInfo(this.supabase.playerId, updates);
          } catch (err) {
             if (err?.code === 'PGRST204') {
                 console.warn("Missing 'current_phase' column in DB. Auto-skip disabled. Retrying score update...");
                 delete updates.current_phase;
                 await this.supabase.updatePlayerInfo(this.supabase.playerId, updates).catch(console.error);
             } else {
                 console.error('Failed to update score/phase:', err);
                 isSaving = false;
                 alert('Failed to save replica! An Adblocker or browser extension might be blocking the connection. Please try again.');
                 this.ui.showScreen('replicating');
                 return;
             }
          }

          this.ui.showWaiting('Waiting for others to finish replicating...');
      };

      this.ui.bindEditorEvents({
          onSaveDesk: () => {},
          onSaveReplica: saveAndComplete
      });

      this.ui.startTimer(180, saveAndComplete);

      this.setHostTimer(180, async () => {
          if (this.room.status === 'replicating' && !this.isTransitioning) {
              this.isTransitioning = true;
              try {
                  if (this.currentRound < this.maxRounds) {
                      this.currentRound++;
                      await this.supabase.updateRoomStatus(this.room.id, 'guessing', this.currentRound);
                  } else {
                      await this.supabase.updateRoomStatus(this.room.id, 'results');
                  }
              } catch (err) {
                  console.error('Failed to change round:', err);
                  this.isTransitioning = false;
              }
          }
      });
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
