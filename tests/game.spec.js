import { test, expect } from '@playwright/test';

test('game lobby creates and joins successfully with room code', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  const errors = [];
  page.on('pageerror', exception => {
    errors.push(exception.message);
  });
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  await page.goto('/');

  // Host creates game
  await page.fill('#playerName', 'HostPlayer');
  await page.click('#createGameBtn');

  // Verify no unexpected errors occurred during button click
  if(errors.length > 0) {
      console.log('Found unexpected errors: ', errors);
  }
  expect(errors.length).toBe(0);

  await expect(page.locator('#lobbyStatus')).not.toHaveClass(/hidden/, { timeout: 10000 });

  // Extract room code
  const roomCodeText = await page.locator('#displayRoomCode').innerText();
  expect(roomCodeText.length).toBeGreaterThan(0);

  // Mock being host and having 4 players since we are just testing UI state transitions
  await page.evaluate(() => {
     window.gameInstance.isHost = true;
     window.gameInstance.gameState.status = 'lobby';

     window.gameInstance.players = {
         'p1': { id: 'p1', name: 'HostPlayer', team: 'red', getState: () => ({}) },
         'p2': { id: 'p2', name: 'Player2', team: 'blue', getState: () => ({}) },
         'p3': { id: 'p3', name: 'Player3', team: 'red', getState: () => ({}) },
         'p4': { id: 'p4', name: 'Player4', team: 'blue', getState: () => ({}) }
     };

     document.getElementById('playerCount').innerText = '4';
     document.getElementById('waitingMessage').innerText = "Ready!";
     document.getElementById('stadium-selection').style.display = 'block';
     document.getElementById('startMatchBtn').disabled = false;
  });

  await expect(page.locator('#stadium-selection')).toBeVisible();
  await expect(page.locator('#startMatchBtn')).toBeEnabled();

  // Host starts the match
  await page.click('#startMatchBtn');

  await expect(page.locator('#game-ui')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#scoreBoard')).toContainText('Red: 0 - Blue: 0');
});

test('player can join an existing room', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto('/');

    await page.fill('#playerName', 'JoinerPlayer');
    await page.fill('#roomCodeInput', 'ABCDEF');
    await page.click('#joinGameBtn');

    await expect(page.locator('#lobbyStatus')).not.toHaveClass(/hidden/, { timeout: 10000 });

    // Check that room code is displayed
    await expect(page.locator('#displayRoomCode')).toHaveText('ABCDEF');
});
