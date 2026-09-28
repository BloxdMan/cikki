/* minigames.js - Find a Word */
(function (global) {
    const fallbackWords = 'apple|book|chair|dance|earth|fish|green|house|jump|kind|lemon|music|night|orange|paper|quiet|river|school|table|under|voice|water|yellow|zebra|anchor|breeze|cactus|diamond|engine|forest|galaxy|harvest|island|jacket|kingdom|lantern|mountain|notebook|ocean|planet|quarter|rocket|sunlight|thunder|uniform|village|xylophone|young|zephyr|abacus|bilingual|circumference|discovery|equilibrium|fluorescent|hypothesis|juxtaposition|kaleidoscope|lexicography|metamorphosis|onomatopoeia|quintessential|reverberation|sesquipedalian|transcendental|ubiquitous|vulnerability|whimsical|xenodochy|yottabyte|zeitgeist'.split('|');
    const playerSeconds = 12;
    const botDelay = 4000;
    const introDelay = 3000;
    const rewardKey = 'cikki_minigame_rewards_v1';
    const alphabet = 'abcdefghijklmnopqrstuvwxyz';
    let words = fallbackWords;
    let wordSet = new Set(words);
    let game = null;
    let timer = null;
    let botTimer = null;
    let introTimer = null;

    function recordAchievement(type) {
        global.CikkiStorage?.recordAchievementEvent(type);
    }

    function escapeHtml(value) {
        return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
    }

    function dayKey(date = new Date()) {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }

    function loadWords() {
        fetch('words.txt').then(response => response.ok ? response.text() : '').then(text => {
            const loaded = text.toLowerCase().split(/\s+/).filter(word => /^[a-z]+$/.test(word));
            if (loaded.length) {
                words = [...new Set(loaded)];
                wordSet = new Set(words);
            }
        }).catch(() => {});
    }

    const wordsReady = loadWords();

    function clearTimers() {
        clearInterval(timer);
        clearTimeout(botTimer);
        clearInterval(introTimer);
        timer = botTimer = introTimer = null;
    }

    function getRewardState() {
        let state;
        try { state = JSON.parse(localStorage.getItem(rewardKey) || '{}'); } catch (error) { state = {}; }
        if (state.day !== dayKey()) state = { day: dayKey(), words: 0, crystals: 0 };
        return state;
    }

    function awardForWord() {
        const state = getRewardState();
        state.words += 1;
        let reward = 0;
        if (state.words % 5 === 0 && state.crystals < 200) {
            const multiplier = Math.min(3, Math.floor(state.words / 10) + 1);
            reward = Math.min(3 * multiplier, 200 - state.crystals);
            state.crystals += reward;
            global.CikkiStorage?.addCrystals(reward);
        }
        saveRewardState(state);
        return { reward, multiplier: Math.min(3, Math.floor(state.words / 10) + 1), crystals: state.crystals };
    }

    function saveRewardState(state) { localStorage.setItem(rewardKey, JSON.stringify(state)); }
    function randomLetter() { return alphabet[Math.floor(Math.random() * alphabet.length)]; }

    function botWord(letter) {
        const available = words.filter(word => word[0] === letter && !game.used.has(word));
        return available[Math.floor(Math.random() * available.length)] || null;
    }

    function renderGame() {
        const root = document.querySelector('.wordgame-shell');
        if (!root || !game) return;
        const intro = game.phase === 'intro';
        const complete = game.phase === 'complete';
        const reward = getRewardState();
        const previousMessageCount = game.renderedMessageCount || 0;
        root.innerHTML = complete ? `
            <section class="wordgame-complete"><span class="game-kicker">Match complete</span><h1>Session complete</h1><p>${escapeHtml(game.message)}</p><div class="wordgame-results"><div><strong>${game.playerWords}</strong><span>Your words</span></div><div><strong>${game.round - 1}</strong><span>Bot replies</span></div><div><strong>+${game.sessionReward}</strong><span>Crystals earned</span></div></div><button type="button" class="wordgame-back">Back to games</button></section>` : `
            <header class="wordgame-header"><div class="wordgame-title"><div class="wordgame-multiplier"><strong>${game.multiplier}x</strong><span>multiplier</span></div><div><span class="game-kicker">Find a word</span><h2>Word Chain</h2></div></div><button type="button" class="wordgame-exit">Exit</button></header>
            <div class="wordgame-scorebar"><span>Words ${game.playerWords}</span><span class="wordgame-turn">${intro ? 'Get ready...' : game.waiting ? 'Bot is thinking...' : 'Your turn'}</span><span class="wordgame-timer"><strong>${intro ? Math.ceil(game.introRemaining / 1000) : game.seconds}</strong>s</span></div>
            ${intro ? `<section class="wordgame-intro"><div class="wordgame-letter-card"><span>Find a word using</span><strong>'${game.required.toUpperCase()}'</strong></div></section>` : `<div class="wordgame-prompt"><span>Find a word using</span><strong>${game.required.toUpperCase()}</strong></div><div class="wordgame-chat-log">${game.messages.map((message, index) => `<div class="wordgame-message ${message.type} ${index >= previousMessageCount ? 'is-new' : ''}"><span>${escapeHtml(message.author)}</span><strong>${escapeHtml(message.text)}</strong></div>`).join('')}</div><div class="wordgame-controls"><form class="wordgame-form"><input class="wordgame-input" type="text" autocomplete="off" placeholder="Type a word..." ${game.waiting ? 'disabled' : ''} aria-label="Your word"><button type="submit" ${game.waiting ? 'disabled' : ''}>Send</button></form><p class="wordgame-status" aria-live="polite">${escapeHtml(game.status || 'Use a new word beginning with the highlighted letter.')}</p><span class="wordgame-daily-reward">Today: ${reward.crystals}/200 crystals</span></div>`}`;
        game.renderedMessageCount = game.messages.length;
        const chatLog = root.querySelector('.wordgame-chat-log');
        if (chatLog) requestAnimationFrame(() => chatLog.scrollTo({ top: chatLog.scrollHeight, behavior: 'smooth' }));
        root.querySelector('.wordgame-exit')?.addEventListener('click', stopGame);
        root.querySelector('.wordgame-back')?.addEventListener('click', stopGame);
        root.querySelector('.wordgame-form')?.addEventListener('submit', event => { event.preventDefault(); submitWord(root.querySelector('.wordgame-input').value); });
        if (!intro && !complete && !game.waiting) root.querySelector('.wordgame-input')?.focus();
    }



    function startPlayerTimer() {
        clearInterval(timer);
        game.seconds = playerSeconds;
        game.turnStartedAt = Date.now();
        timer = setInterval(() => {
            game.seconds = Math.max(0, playerSeconds - Math.floor((Date.now() - game.turnStartedAt) / 1000));
            const value = document.querySelector('.wordgame-timer strong');
            if (value) value.textContent = game.seconds;
            if (Date.now() - game.turnStartedAt >= playerSeconds * 1000) finishGame('Time is up. LexiBot wins this round.');
        }, 1000);
    }

    function startMatch() {
        game.phase = 'playing';
        game.introRemaining = 0;
        game.waiting = false;
        renderGame();
        startPlayerTimer();
    }

    async function submitWord(rawWord) {
        if (!game || game.phase !== 'playing' || game.waiting) return;
        await wordsReady;
        if (!game || game.phase !== 'playing' || game.waiting) return;
        const word = rawWord.trim().toLowerCase();
        if (!/^[a-z]+$/.test(word) || !wordSet.has(word) || word[0] !== game.required || game.used.has(word)) {
            game.status = game.used.has(word) ? 'That word was already used.' : !wordSet.has(word) ? 'That word is not in the word list.' : `Use a new word beginning with ${game.required.toUpperCase()}.`;
            renderGame();
            return;
        }
        clearInterval(timer);
        const elapsed = Date.now() - game.turnStartedAt;
        const remaining = playerSeconds * 1000 - elapsed;
        game.used.add(word);
        game.playerWords += 1;
        recordAchievement('wordGameTurns');
        if (elapsed < 2000) recordAchievement('wordGameFastWords');
        if (remaining < 1000) recordAchievement('wordGameLastSecond');
        game.sessionReward += awardForWord().reward;
        game.multiplier = getRewardState().words >= 10 ? Math.min(3, Math.floor(getRewardState().words / 10) + 1) : 1;
        game.lastWord = word;
        game.waiting = true;
        game.status = '';
        game.messages.push({ author: 'You', text: word, type: 'player' });
        renderGame();
        botTimer = setTimeout(() => {
            if (!game || game.phase !== 'playing' || !game.waiting) return;
            const answer = botWord(game.lastWord[game.lastWord.length - 1]);
            if (!answer) return finishGame('LexiBot could not find a word. You win!');
            game.used.add(answer);
            game.required = answer[answer.length - 1];
            game.round += 1;
            game.waiting = false;
            game.messages.push({ author: 'LexiBot', text: answer, type: 'bot' });
            renderGame();
            startPlayerTimer();
        }, botDelay);
    }

    function finishGame(message) {
        if (!game || game.phase === 'complete') return;
        clearTimers();
        game.phase = 'complete';
        game.message = message;
        game.waiting = true;
        renderGame();
    }

    function startGame() {
        clearTimers();
        document.body.classList.add('minigame-open');
        document.body.classList.add('minigame-running');
        const required = randomLetter();
        const reward = getRewardState();
        game = { phase: 'intro', required, used: new Set(), messages: [], round: 1, playerWords: 0, sessionReward: 0, multiplier: reward.words >= 10 ? Math.min(3, Math.floor(reward.words / 10) + 1) : 1, waiting: true, seconds: playerSeconds, introRemaining: introDelay, status: '' };
        renderMinigames();
        renderGame();
        const startedAt = Date.now();
        introTimer = setInterval(() => {
            game.introRemaining = Math.max(0, introDelay - (Date.now() - startedAt));
            const value = document.querySelector('.wordgame-timer strong');
            if (value) value.textContent = Math.ceil(game.introRemaining / 1000);
            if (!game.introRemaining) { clearInterval(introTimer); startMatch(); }
        }, 100);
    }

    function stopGame() {
        clearTimers();
        document.body.classList.remove('minigame-open');
        document.body.classList.remove('minigame-running');
        const shell = document.querySelector('.wordgame-shell');
        shell?.remove();
        game = null;
        renderMinigames();
    }

    function renderMinigames() {
        const page = document.getElementById('minigames-page');
        if (!page) return;
        if (game) {
            if (!document.querySelector('.wordgame-shell')) {
                const shell = document.createElement('div');
                shell.className = 'wordgame-shell';
                document.body.appendChild(shell);
            }
            return;
        }
        page.innerHTML = `<header class="page-header"><h1>Minigames</h1><p>Quick word challenges</p></header><div class="minigames-grid"><article class="minigame-card find-word-card"><div class="minigame-icon">Aa</div><div><span class="game-kicker">Player vs. bot</span><h2>Find a word</h2><p>Build a chain before LexiBot can answer.</p></div><button type="button" class="start-wordgame">Play now</button></article></div>`;
        page.querySelector('.start-wordgame')?.addEventListener('click', startGame);
    }

    function isActivePage() { return global.Slider?.getCurrentPage() === 4; }

    global.renderMinigames = () => { if (isActivePage()) renderMinigames(); };
    global.addEventListener('cikki:tabchange', event => { if (event.detail.index === 4) renderMinigames(); });
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', global.renderMinigames);
    else global.renderMinigames();
})(window);