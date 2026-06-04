import { SupabaseManager } from './network/SupabaseClient.js';
import { DataManager } from './game/DataManager.js';
import { UIManager } from './ui/UIManager.js';
import { GameManager } from './game/GameManager.js';
import { createIcons, icons } from 'https://esm.sh/lucide';

document.addEventListener('DOMContentLoaded', async () => {
    // Initialize icons
    createIcons({ icons });

    const supabaseManager = new SupabaseManager();
    const dataManager = new DataManager();
    const uiManager = new UIManager();

    // Pre-load assets data
    await dataManager.loadData();

    const gameManager = new GameManager(supabaseManager, dataManager, uiManager);
    gameManager.init();
});
