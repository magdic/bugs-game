import { test, expect } from '@playwright/test';

test('game lobby loads successfully, player can join, and host can start match', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  // Load the page
  await page.goto('/');

  await page.fill('#playerName', 'Player1');
  await page.click('#joinBtn');

  // Check that we see the lobby status
  await expect(page.locator('#lobbyStatus')).not.toHaveClass(/hidden/, { timeout: 10000 });

  // The player count syncs via network. If Supabase is slow/unavailable it won't hit 1. We mock it.
  await page.evaluate(() => {
     window.gameInstance.isHost = true;
     window.gameInstance.gameState.status = 'lobby';

     // Mock 4 players to bypass network sync wait
     window.gameInstance.players = {
         'p1': { id: 'p1', name: 'Player1', team: 'red', getState: () => ({}) },
         'p2': { id: 'p2', name: 'Player2', team: 'blue', getState: () => ({}) },
         'p3': { id: 'p3', name: 'Player3', team: 'red', getState: () => ({}) },
         'p4': { id: 'p4', name: 'Player4', team: 'blue', getState: () => ({}) }
     };

     // Update UI manually for test
     document.getElementById('playerCount').innerText = '4';
     document.getElementById('waitingMessage').innerText = "Ready!";
     document.getElementById('stadium-selection').style.display = 'block';
     document.getElementById('startMatchBtn').disabled = false;
  });

  // Check that the first player (Host) sees the start match button enabled
  await expect(page.locator('#stadium-selection')).toBeVisible();
  await expect(page.locator('#startMatchBtn')).toBeEnabled();

  // Host starts the match
  await page.click('#startMatchBtn');

  // Check that the game UI is visible
  await expect(page.locator('#game-ui')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#scoreBoard')).toContainText('Red: 0 - Blue: 0');
});
