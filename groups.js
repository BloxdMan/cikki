/* groups.js - renders groups and group views, uses CikkiStorage, IconSheet, CikkiModal */
(function () {
    function escapeHtml(str) {
        return String(str || '').replace(/[&<>"']/g, s => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[s]));
    }

    const rankInfo = {
        new: { label: 'New', rank: 1 },
        familiar: { label: 'Familiar', rank: 2 },
        memorized: { label: 'Memorized', rank: 3 },
        mastered: { label: 'Mastered', rank: 4 },
        unforgetable: { label: 'Unforgetable', rank: 5 }
    };

    const crystalRewards = { familiar: 3, memorized: 5, mastered: 10, unforgetable: 15 };

    function formatDate(timestamp) {
        if (!Number.isFinite(timestamp)) return '';
        return new Date(timestamp).toLocaleDateString(undefined, {
            year: 'numeric', month: 'short', day: 'numeric'
        });
    }

    function exportVocabulary() {
        const json = JSON.stringify({ groups: CikkiStorage.exportData() }, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `cikki-vocabulary-${new Date().toISOString().slice(0, 10)}.json`;
        link.click();
        URL.revokeObjectURL(link.href);
    }

    function serializeExportNote(note) {
        const source = note && typeof note === 'object' ? note : {};
        const fields = Array.isArray(source.fields)
            ? source.fields.filter(field => field && (field.label || field.value))
                .map(field => ({ label: String(field.label || ''), value: String(field.value || '') }))
            : [];
        return {
            title: String(source.title || source.word || '').trim(),
            translation: String(source.translation || source.Translition || source.translition || '').trim(),
            fields,
            translationRemoved: Boolean(source.translationRemoved),
            rating: Number.isInteger(source.rating) ? Math.max(0, Math.min(5, source.rating)) : 0
        };
    }

    function closeJsonDialog() {
        const root = document.getElementById('json-dialog-root');
        if (root) root.innerHTML = '';
        document.body.classList.remove('modal-open');
    }

    function openImportDialog() {
        closeJsonDialog();
        const root = document.getElementById('json-dialog-root');
        const groups = CikkiStorage.getGroups() || [];
        let selectedGroupId = groups.length ? groups[0].id : null;
        let selectedGroupIndex = 0;
        const overlay = document.createElement('div');
        overlay.className = 'json-overlay';
        overlay.innerHTML = `<section class="json-window" role="dialog" aria-modal="true" aria-label="Import JSON">
            <header><h2>Import to Group</h2><button type="button" class="json-close" aria-label="Close import window">×</button></header>
            <div class="export-carousel"><button type="button" class="export-arrow export-prev" aria-label="Previous group">←</button><strong class="import-group-name"></strong><button type="button" class="export-arrow export-next" aria-label="Next group">→</button></div>
            <textarea class="json-textarea" placeholder="Paste exported JSON or load a file..."></textarea>
            <div class="json-window-actions"><button type="button" class="json-load-file">Load File</button><button type="button" class="json-import-submit">Import</button></div>
            <input class="json-file-input" type="file" accept="application/json,.json" hidden>
        </section>`;
        root.appendChild(overlay);
        document.body.classList.add('modal-open');
        const textarea = overlay.querySelector('.json-textarea');
        const fileInput = overlay.querySelector('.json-file-input');
        const updateGroupDisplay = () => {
            const group = groups[selectedGroupIndex];
            overlay.querySelector('.import-group-name').textContent = group ? group.name : 'No groups';
            if (group) selectedGroupId = group.id;
        };
        const importText = text => {
            try {
                if (!selectedGroupId) throw new Error('No group selected');
                const summary = CikkiStorage.importDataToGroup(JSON.parse(text), selectedGroupId);
                if (!summary || !summary.success) throw new Error('No notes to import');
                closeJsonDialog();
                showImportSummary(summary);
                renderGroupsList();
            } catch (error) {
                window.alert('Import failed: ' + error.message);
            }
        };
        overlay.querySelector('.json-close').onclick = closeJsonDialog;
        overlay.querySelector('.export-prev').onclick = () => { selectedGroupIndex = (selectedGroupIndex - 1 + groups.length) % groups.length; updateGroupDisplay(); };
        overlay.querySelector('.export-next').onclick = () => { selectedGroupIndex = (selectedGroupIndex + 1) % groups.length; updateGroupDisplay(); };
        overlay.querySelector('.json-import-submit').onclick = () => importText(textarea.value);
        overlay.querySelector('.json-load-file').onclick = () => fileInput.click();
        fileInput.onchange = () => {
            const file = fileInput.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => { textarea.value = reader.result; importText(reader.result); };
            reader.readAsText(file);
        };
        updateGroupDisplay();
    }

    function openExportDialog() {
        closeJsonDialog();
        const root = document.getElementById('json-dialog-root');
        const groups = CikkiStorage.getGroups() || [];
        let selectedIndex = 0;
        const overlay = document.createElement('div');
        overlay.className = 'json-overlay';
        overlay.innerHTML = `<section class="json-window export-window" role="dialog" aria-modal="true" aria-label="Export JSON">
            <header><h2>Export Group</h2><button type="button" class="json-close" aria-label="Close export window">×</button></header>
            <div class="export-carousel"><button type="button" class="export-arrow export-prev" aria-label="Previous group">←</button><strong class="export-group-name"></strong><button type="button" class="export-arrow export-next" aria-label="Next group">→</button></div>
            <div class="export-monitor"><span>Notes</span><strong class="export-note-count"></strong></div>
            <div class="json-window-actions"><button type="button" class="json-copy">Copy</button><button type="button" class="json-export-submit">Download</button></div>
        </section>`;
        root.appendChild(overlay);
        document.body.classList.add('modal-open');
        const currentJson = () => JSON.stringify({ groups: [CikkiStorage.exportData()[selectedIndex]] }, null, 2);
        const update = () => {
            const group = groups[selectedIndex];
            overlay.querySelector('.export-group-name').textContent = group ? group.name : 'No groups';
            overlay.querySelector('.export-note-count').textContent = group ? group.notes.length : '0';
        };
        overlay.querySelector('.json-close').onclick = closeJsonDialog;
        overlay.querySelector('.export-prev').onclick = () => { selectedIndex = (selectedIndex - 1 + groups.length) % groups.length; update(); };
        overlay.querySelector('.export-next').onclick = () => { selectedIndex = (selectedIndex + 1) % groups.length; update(); };
        overlay.querySelector('.json-copy').onclick = async () => { await navigator.clipboard?.writeText(currentJson()); };
        overlay.querySelector('.json-export-submit').onclick = () => {
            const blob = new Blob([currentJson()], { type: 'application/json' });
            const link = document.createElement('a'); 
            link.href = URL.createObjectURL(blob); 
            link.download = `cikki-${groups[selectedIndex]?.name || 'vocabulary'}.json`; 
            link.click(); 
            URL.revokeObjectURL(link.href);
        };
        update();
    }

    function openSelectedNotesExportDialog(jsonText) {
        closeJsonDialog();
        const root = document.getElementById('json-dialog-root');
        const overlay = document.createElement('div');
        overlay.className = 'json-overlay';
        overlay.innerHTML = `<section class="json-window export-window" role="dialog" aria-modal="true" aria-label="Export selected notes">
            <header><h2>Export Selected</h2><button type="button" class="json-close" aria-label="Close export window">×</button></header>
            <textarea class="json-textarea" spellcheck="false" aria-label="Selected notes JSON"></textarea>
            <div class="json-window-actions">
                <button type="button" class="json-cancel">Cancel</button>
                <button type="button" class="json-copy">Copy JSON</button>
                <button type="button" class="json-export-submit">Export</button>
            </div>
        </section>`;
        root.appendChild(overlay);
        document.body.classList.add('modal-open');

        const textarea = overlay.querySelector('.json-textarea');
        textarea.value = jsonText;

        overlay.querySelector('.json-close').onclick = closeJsonDialog;
        overlay.querySelector('.json-cancel').onclick = closeJsonDialog;
        overlay.querySelector('.json-copy').onclick = async () => {
            await navigator.clipboard?.writeText(textarea.value);
        };
        overlay.querySelector('.json-export-submit').onclick = () => {
            const blob = new Blob([textarea.value], { type: 'application/json' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `cikki-selected-notes-${new Date().toISOString().slice(0, 10)}.json`;
            link.click();
            URL.revokeObjectURL(link.href);
        };
    }

    function showImportSummary(summary) {
        closeJsonDialog();
        const overlay = document.createElement('div');
        overlay.className = 'json-overlay';
        overlay.innerHTML = `<section class="json-window" role="dialog" aria-modal="true" aria-label="Import summary">
            <header><h2>Import Complete</h2><button type="button" class="json-close" aria-label="Close import summary">×</button></header>
            <div class="import-summary">
                <p>Added: ${summary.added} notes</p>
                <p>Skipped duplicates: ${summary.skipped} (Ask for replace, or skip)</p>
                <p>Failed: ${summary.failed}</p>
            </div>
            <div class="json-window-actions"><button type="button" class="json-import-summary-ok">OK</button></div>
        </section>`;
        document.getElementById('json-dialog-root').appendChild(overlay);
        document.body.classList.add('modal-open');

        overlay.querySelector('.json-close').onclick = closeJsonDialog;
        overlay.querySelector('.json-import-summary-ok').onclick = closeJsonDialog;
    }

    function importVocabulary(file) {
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const summary = CikkiStorage.importData(JSON.parse(reader.result));
                if (!summary || !summary.success) throw new Error('No groups found');
                showImportSummary(summary);
                renderGroupsList();
            } catch (error) {
                window.alert('That JSON file could not be imported.');
            }
        };
        reader.readAsText(file);
    }

    function getPractice(note) {
        const status = String(note.practice?.status || 'new').toLowerCase();
        return rankInfo[status]
            ? Object.assign({}, note.practice, { status })
            : { status: 'new', reviews: 0, lastReviewed: null };
    }

    function renderCrystalBalance() {
        const amount = document.getElementById('crystal-amount');
        if (amount) amount.textContent = CikkiStorage.getCrystals();
    }

    function reviewDayKey(date = new Date()) {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }

    function practiceIntervalDays(status) {
        return { new: 0, familiar: 0, memorized: 1, mastered: 3, unforgetable: 7 }[String(status || '').toLowerCase()] ?? 0;
    }

    function isPracticeDue(note) {
        const practice = getPractice(note);
        if (practice.status === 'new' || practice.status === 'familiar') return true;
        if (!Number.isFinite(practice.lastReviewed)) return true;
        const reviewed = new Date(practice.lastReviewed);
        const dueDate = new Date(reviewed.getFullYear(), reviewed.getMonth(), reviewed.getDate());
        dueDate.setDate(dueDate.getDate() + practiceIntervalDays(practice.status));
        const today = new Date();
        const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        return todayDate >= dueDate;
    }

    const achievements = [
        { group: 'Beginner', id: 'first-step', title: 'First Step', description: 'Create your first note.', target: 1, type: 'notesSaved', reward: 10 },
        { group: 'Beginner', id: 'getting-organized', title: 'Getting Organized', description: 'Create your first group.', target: 1, type: 'groupsCreated', reward: 10 },
        { group: 'Beginner', id: 'collector', title: 'Collector', description: 'Save 25 notes.', target: 25, type: 'notesSaved', reward: 10 },
        { group: 'Beginner', id: 'growing-library', title: 'Growing Library', description: 'Save 100 notes.', target: 100, type: 'notesSaved', reward: 20 },
        { group: 'Beginner', id: 'search-expert', title: 'Search Expert', description: 'Use search 20 times.', target: 20, type: 'searchesUsed', reward: 10 },
        { group: 'Learning', id: 'memory-spark', title: 'Memory Spark', description: 'Learn 10 words.', target: 10, type: 'learned', reward: 10 },
        { group: 'Learning', id: 'word-explorer', title: 'Word Explorer', description: 'Learn 50 words.', target: 50, type: 'learned', reward: 20 },
        { group: 'Learning', id: 'vocabulary-builder', title: 'Vocabulary Builder', description: 'Learn 250 words.', target: 250, type: 'learned', reward: 30 },
        { group: 'Learning', id: 'knowledge-vault', title: 'Knowledge Vault', description: 'Learn 500 words.', target: 500, type: 'learned', reward: 50 },
        { group: 'Learning', id: 'never-stop-learning', title: 'Never Stop Learning', description: 'Learn 2500 words.', target: 2500, type: 'learned', reward: 250 },
        { group: 'Consistency', id: 'one-good-day', title: 'One Good Day', description: 'Complete your first daily goal.', target: 1, type: 'completeDays', reward: 10 },
        { group: 'Consistency', id: 'on-fire', title: 'On Fire', description: 'Reach a 7-day streak.', target: 7, type: 'bestStreak', reward: 20 },
        { group: 'Consistency', id: 'unstoppable', title: 'Unstoppable', description: 'Reach a 30-day streak.', target: 30, type: 'bestStreak', reward: 50 },
        { group: 'Consistency', id: 'legendary-habit', title: 'Legendary Habit', description: 'Open Cikki for 100 days.', target: 100, type: 'loginDays', reward: 150 },
        { group: 'Consistency', id: 'daily-ritual', title: 'The Daily Ritual', description: 'Complete daily goals for 50 days.', target: 50, type: 'completeDays', reward: 100 },
        { group: 'Mastery', id: 'perfect-memory', title: 'Perfect Memory', description: 'Complete 10 no-mistake practice sessions in a row.', target: 10, type: 'perfectSessions', reward: 25 },
        { group: 'Mastery', id: 'sharp-mind', title: 'Sharp Mind', description: 'Upgrade 50 notes to Memorized.', target: 50, type: 'memorizedUpgrades', reward: 10 },
        { group: 'Mastery', id: 'rank-up', title: 'Rank Up', description: 'Obtain your first Mastered word.', target: 1, type: 'masteredWords', reward: 10 },
        { group: 'Mastery', id: 'master-achiever', title: 'Master Achiever', description: 'Upgrade 50 notes to Mastered.', target: 50, type: 'masteredUpgrades', reward: 20 },
        { group: 'Mastery', id: 'unforgettable', title: 'Unforgettable', description: 'Obtain your first Unforgetable word.', target: 1, type: 'unforgetableWords', reward: 30 },
        { group: 'Mastermind', id: 'good-memory', title: 'Good memory', description: 'Reach 20 turns in Find a word.', target: 20, type: 'wordGameTurns', reward: 15 },
        { group: 'Mastermind', id: 'im-speed', title: "I'm Speed", description: 'Send a word under 2 seconds in Find a word.', target: 1, type: 'wordGameFastWords', reward: 15 },
        { group: 'Mastermind', id: 'last-second', title: 'Last Second', description: 'Submit a correct word with less than 1 second remaining in Find a word.', target: 1, type: 'wordGameLastSecond', reward: 10 }
    ];

    const achievementGroups = ['Beginner', 'Learning', 'Consistency', 'Mastery', 'Mastermind'];

    function getAchievementProgress(groups) {
        const state = CikkiStorage.getAchievementState();
        const learned = groups.reduce((total, group) => total + (group.notes || []).filter(note => getPractice(note).status !== 'new').length, 0);
        const dailyState = getDailyGoalState(groups);
        const dailyGoals = getDailyGoals(groups);
        const completeDays = Array.isArray(dailyState.completedDays) ? dailyState.completedDays : [];
        if (dailyGoals.every(goal => goal.complete) && !completeDays.includes(todayKey())) {
            completeDays.push(todayKey());
            dailyState.completedDays = completeDays;
            localStorage.setItem(dailyGoalStorageKey, JSON.stringify(dailyState));
        }
        return Object.assign(state, {
            learned,
            masteredWords: groups.reduce((total, group) => total + (group.notes || []).filter(note => getPractice(note).status === 'mastered').length, 0),
            unforgetableWords: groups.reduce((total, group) => total + (group.notes || []).filter(note => getPractice(note).status === 'unforgetable').length, 0),
            completeDays: completeDays.length,
            loginDays: (dailyState.loginDays || []).length,
            bestStreak: getStreaks(dailyState).best
        });
    }

    function checkAchievements() {
        const groups = CikkiStorage.getGroups() || [];
        const progress = getAchievementProgress(groups);
        achievements.forEach(achievement => {
            if (progress[achievement.type] < achievement.target) return;
        });
        renderAchievements();
    }

    function renderAchievements() {
        const screen = document.getElementById('achievements-screen');
        if (!screen) return;
        const progress = getAchievementProgress(CikkiStorage.getGroups() || []);
        screen.innerHTML = `<div class="achievements-window"><header class="achievements-header"><h1>Achievements</h1><button id="achievements-close" type="button" aria-label="Close achievements">×</button></header>${achievementGroups.map(group => `<section class="achievement-group"><h2>${group}</h2><div class="achievement-list">${achievements.filter(achievement => achievement.group === group).map(achievement => { const claimed = progress.claimed.includes(achievement.id); const available = progress[achievement.type] >= achievement.target; const value = Math.min(progress[achievement.type], achievement.target); return `<article class="achievement-item ${claimed ? 'is-claimed' : available ? 'is-available' : ''}"><div class="achievement-copy"><h3>${achievement.title}</h3><p>${achievement.description}</p></div><div class="achievement-reward">${claimed ? '' : `<span class="reward-preview">+${achievement.reward}<img src="assets/icon/crystal.png" alt="Crystal"></span>`}<span class="achievement-progress">${claimed ? 'Claimed' : available ? '' : `${value}/${achievement.target}`}</span>${available && !claimed ? `<button type="button" class="achievement-claim" data-achievement-id="${achievement.id}">Claim</button>` : ''}</div></article>`; }).join('')}</div></section>`).join('')}</div>`;
        screen.querySelector('#achievements-close').onclick = closeAchievements;
        screen.querySelectorAll('.achievement-claim').forEach(button => {
            button.onclick = () => {
                const achievement = achievements.find(item => item.id === button.dataset.achievementId);
                if (!achievement || !CikkiStorage.claimAchievement(achievement.id)) return;
                CikkiStorage.addCrystals(achievement.reward);
                renderCrystalBalance();
                showCrystalReward(achievement.reward);
                renderAchievements();
            };
        });
    }

    function closeAchievements() {
        const screen = document.getElementById('achievements-screen');
        if (!screen) return;
        screen.hidden = true;
        document.getElementById('achievements-toggle')?.setAttribute('aria-expanded', 'false');
        document.body.classList.remove('achievements-open', 'modal-open');
    }

    function applyTheme() {
        document.body.dataset.theme = CikkiStorage.getTheme();
    }

    function updateMenuProfile() {
        const profile = CikkiStorage.getProfile();
        const username = document.getElementById('menu-username');
        const logo = document.getElementById('menu-logo');
        const logoPlaceholder = document.getElementById('menu-logo-placeholder');
        if (username) username.textContent = profile.username || 'Username';
        if (logo) {
            logo.hidden = !profile.logo;
            logo.src = profile.logo || '';
        }
        if (logoPlaceholder) logoPlaceholder.hidden = Boolean(profile.logo);
    }

    function closeMenuWindows() {
        document.querySelectorAll('.menu-window').forEach(windowElement => {
            windowElement.classList.remove('view-enter');
            if (windowElement.hidden) return;
            windowElement.classList.add('is-closing');
            window.setTimeout(() => {
                windowElement.hidden = true;
                windowElement.classList.remove('is-closing');
            }, 240);
        });
        document.body.classList.remove('modal-open', 'settings-open');
        document.getElementById('settings-toggle')?.setAttribute('aria-expanded', 'false');
        const menuBackdrop = document.getElementById('menu-backdrop');
        if (menuBackdrop) {
            menuBackdrop.classList.remove('is-open');
            menuBackdrop.hidden = true;
        }
    }

    function openMenuWindow(name) {
        const windowElement = document.getElementById(`${name}-screen`);
        if (!windowElement) return;
        document.getElementById('menu-sidebar').hidden = true;
        closeMenuWindows();
        windowElement.hidden = false;
        windowElement.classList.add('view-enter');
        document.body.classList.add('modal-open');
        if (name === 'settings') document.body.classList.add('settings-open');
        if (name === 'profile') {
            const profile = CikkiStorage.getProfile();
            document.getElementById('profile-username').value = profile.username;
            const preview = document.getElementById('profile-logo-preview');
            preview.src = profile.logo || '';
            preview.hidden = !profile.logo;
        }
        if (name === 'theme') renderThemeOptions();
    }

    function renderThemeOptions() {
        const options = document.getElementById('theme-options');
        if (!options) return;
        const currentTheme = CikkiStorage.getTheme();
        const themes = [
            ['default', 'Default'],
            ['blue', 'Dark blue'],
            ['purple', 'Dark purple'],
            ['white', 'Dark white'],
            ['red', 'Dark red']
        ];
        options.innerHTML = themes.map(([id, label]) => `<button type="button" class="theme-option theme-${id} ${id === currentTheme ? 'is-active' : ''}" data-theme-choice="${id}" ${id === currentTheme ? 'disabled' : ''}><span>${label}</span>${id === currentTheme ? '<small>Active</small>' : '<small><img src="assets/icon/crystal.png" alt="">400 crystals</small>'}</button>`).join('');
        options.querySelectorAll('[data-theme-choice]').forEach(button => {
            button.onclick = () => {
                if (CikkiStorage.getCrystals() < 400) {
                    window.alert('You need 400 crystals to unlock this theme.');
                    return;
                }
                if (!CikkiStorage.spendCrystals(400)) return;
                CikkiStorage.setTheme(button.dataset.themeChoice);
                applyTheme();
                renderCrystalBalance();
                renderThemeOptions();
            };
        });
    }

    function initMenu() {
        const menu = document.getElementById('menu-sidebar');
        const menuToggle = document.getElementById('settings-toggle');
        const menuBackdrop = document.getElementById('menu-backdrop');
        applyTheme();
        updateMenuProfile();
        const closeMenu = () => {
            menu.classList.remove('is-open');
            menuToggle.setAttribute('aria-expanded', 'false');
            if (menuBackdrop) {
                menuBackdrop.classList.remove('is-open');
                menuBackdrop.hidden = true;
            }
            const finishClose = () => {
                menu.hidden = true;
            };
            window.setTimeout(finishClose, 260);
            document.body.classList.remove('modal-open');
        };
        menuToggle.onclick = () => {
            if (menuToggle.dataset.noteMenu === 'true') return;
            menu.hidden = false;
            menu.offsetWidth;
            menu.classList.add('is-open');
            menuBackdrop.hidden = false;
            menuBackdrop.classList.add('is-open');
            menuToggle.setAttribute('aria-expanded', 'true');
            document.body.classList.add('modal-open');
        };
        document.getElementById('menu-close').onclick = closeMenu;
        menu.querySelectorAll('[data-menu-window]').forEach(button => {
            button.onclick = () => openMenuWindow(button.dataset.menuWindow);
        });
        menu.querySelectorAll('[data-menu-action]').forEach(button => {
            button.onclick = () => {
                const action = button.dataset.menuAction;
                closeMenu();
                if (action === 'export') openExportDialog();
                else if (action === 'import') openImportDialog();
            };
        });
        document.querySelectorAll('[data-window-close]').forEach(button => {
            button.onclick = () => {
                closeMenuWindows();
                menuToggle.setAttribute('aria-expanded', 'false');
            };
        });
        document.getElementById('profile-form').onsubmit = event => {
            event.preventDefault();
            const file = document.getElementById('profile-logo').files[0];
            const save = logo => {
                CikkiStorage.saveProfile({ username: document.getElementById('profile-username').value, logo });
                updateMenuProfile();
                closeMenuWindows();
            };
            if (!file) {
                save(CikkiStorage.getProfile().logo);
                return;
            }
            const reader = new FileReader();
            reader.onload = () => save(String(reader.result));
            reader.readAsDataURL(file);
        };
        document.getElementById('profile-logo').onchange = event => {
            const file = event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
                const preview = document.getElementById('profile-logo-preview');
                preview.src = reader.result;
                preview.hidden = false;
            };
            reader.readAsDataURL(file);
        };
        document.getElementById('leave-confirm').onclick = () => window.close();
    }

    const crystalRewardQueue = [];
    let crystalRewardShowing = false;

    function showCrystalReward(amount) {
        if (amount) crystalRewardQueue.push(amount);
        if (crystalRewardShowing) return;
        if (!crystalRewardQueue.length) return;

        const root = document.getElementById('crystal-reward-root');
        if (!root) return;
        crystalRewardShowing = true;
        const nextAmount = crystalRewardQueue.shift();
        const reward = document.createElement('div');
        reward.className = 'crystal-reward';
        reward.innerHTML = `<strong>+${nextAmount}</strong><img src="assets/icon/crystal.png" alt="Crystal">`;
        root.appendChild(reward);
        setTimeout(() => {
            reward.remove();
            crystalRewardShowing = false;
            if (crystalRewardQueue.length) showCrystalReward();
        }, 2200);
    }

    let editMode = false;
    let selectedId = null;
    let suppressClick = false;
    let dragState = null;
    let groupSortValue = 'latest';
    let practiceGroupIndex = 0;
    let statisticsGroupIndex = 0;
    let statisticsRange = '28';
    let statisticsChartObserver = null;
    let practiceGoalsExpanded = false;
    const dailyGoalStorageKey = 'cikki_daily_goals_v1';

    function todayKey() {
        return reviewDayKey();
    }

    function getGroupProgress(group) {
        const notes = group.notes || [];
        if (!notes.length) return 0;
        return Math.round(notes.reduce((total, note) => total + (rankInfo[getPractice(note).status].rank - 1) / 4, 0) / notes.length * 100);
    }

    function getDailyGoalState(groups) {
        const day = todayKey();
        const week = weekKey(new Date());
        let state;
        try {
            state = JSON.parse(localStorage.getItem(dailyGoalStorageKey) || '{}');
        } catch (error) {
            state = {};
        }
        const loginDays = Array.isArray(state.loginDays)
            ? [...new Set(state.loginDays.map(normalizeDayKey).filter(Boolean))]
            : [];
        const completedDays = Array.isArray(state.completedDays)
            ? [...new Set(state.completedDays.map(normalizeDayKey).filter(Boolean))]
            : [];
        if (!loginDays.includes(day)) loginDays.push(day);
        if (state.day !== day) {
            state = {
                day,
                week: state.week || week,
                opened: true,
                baselines: {},
                weeklyBaselines: state.weeklyBaselines || {},
                claimed: [],
                loginDays,
                completedDays
            };
            groups.forEach(group => { state.baselines[group.id] = getGroupProgress(group); });
        } else {
            state.opened = true;
            state.baselines = state.baselines || {};
            state.claimed = Array.isArray(state.claimed) ? state.claimed : [];
            state.week = state.week || week;
            state.weeklyBaselines = state.weeklyBaselines || {};
            state.loginDays = loginDays;
            state.completedDays = completedDays;
            groups.forEach(group => {
                if (!Number.isFinite(state.baselines[group.id])) state.baselines[group.id] = getGroupProgress(group);
            });
        }
        if (state.week !== week) {
            state.week = week;
            state.weeklyBaselines = {};
            groups.forEach(group => { state.weeklyBaselines[group.id] = getGroupProgress(group); });
        } else {
            groups.forEach(group => {
                if (!Number.isFinite(state.weeklyBaselines[group.id])) {
                    state.weeklyBaselines[group.id] = getGroupProgress(group);
                }
            });
        }
        localStorage.setItem(dailyGoalStorageKey, JSON.stringify(state));
        return state;
    }

    function weekKey(date) {
        const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
        return reviewDayKey(monday);
    }

    function isToday(timestamp) {
        if (!Number.isFinite(timestamp)) return false;
        const date = new Date(timestamp);
        const now = new Date();
        return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
    }

    function getDailyGoals(groups) {
        const state = getDailyGoalState(groups);
        const learned = groups.reduce((total, group) => total + (group.notes || []).filter(note =>
            isToday(note.created)
        ).length, 0);
        const day = todayKey();
        const practiced = groups.reduce((total, group) => total + (group.notes || []).filter(note =>
            getPractice(note).recallHistory?.some(item => item.day === day)
        ).length, 0);
        const increased = groups.some(group => getGroupProgress(group) - (state.baselines[group.id] || 0) >= 5);
        return [
            { label: 'Open app', complete: state.opened },
            { label: 'Create 3 notes', value: Math.min(learned, 3), target: 3, complete: learned >= 3 },
            { label: 'Practice 5 words', value: Math.min(practiced, 5), target: 5, complete: practiced >= 5 },
            { label: 'Increase a Group progress by 5%', complete: increased }
        ];
    }

    function getStreaks(state) {
        const loginDays = new Set(state.loginDays || []);
        const today = new Date();
        const currentStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        let current = 0;
        while (loginDays.has(todayKeyForDate(currentStart))) {
            current += 1;
            currentStart.setDate(currentStart.getDate() - 1);
        }
        let best = 0;
        let run = 0;
        let previous = null;
        [...loginDays].map(dateForDayKey)
            .filter(Boolean)
            .sort((first, second) => first - second)
            .forEach(date => {
            run = previous && (date - previous) / 86400000 === 1 ? run + 1 : 1;
            best = Math.max(best, run);
            previous = date;
            });
        best = Math.max(best, current);
        return { current, best };
    }

    function todayKeyForDate(date) {
        return reviewDayKey(date);
    }

    function dateForDayKey(value) {
        const [year, month, day] = String(value).split('-').map(Number);
        const date = new Date(year, month - 1, day);
        return Number.isFinite(date.getTime()) && date.getFullYear() === year &&
            date.getMonth() === month - 1 && date.getDate() === day ? date : null;
    }

    function normalizeDayKey(value) {
        const date = dateForDayKey(value);
        return date ? reviewDayKey(date) : null;
    }

    function getWordsDueToday(groups) {
        const day = todayKey();
        return groups.reduce((total, group) => total + (group.notes || []).filter(note => {
            const practice = getPractice(note);
            const practicedToday = practice.recallHistory?.some(item => item.day === day);
            return !practicedToday && (!practice.status || practice.status === 'new' || rankInfo[practice.status].rank >= 2);
        }).length, 0);
    }

    function renderDashboard() {
        const page = document.getElementById('dashboard-page');
        if (!page || window.Slider?.getCurrentPage() !== 2) return;
        const groups = CikkiStorage.getGroups() || [];
        const goals = getDailyGoals(groups);
        const completeGoals = goals.filter(goal => goal.complete).length;
        const state = getDailyGoalState(groups);
        const streaks = getStreaks(state);
        const dueToday = getWordsDueToday(groups);
        const allComplete = completeGoals === goals.length;
        page.innerHTML = ` 
            <header class="page-header"><h1>Dashboard</h1><p>Your daily learning overview</p></header>
            <section class="dashboard-panel daily-goal-card ${practiceGoalsExpanded ? 'is-expanded' : ''}" aria-label="Today's goals">
                <button class="daily-goal-summary" type="button" aria-expanded="${practiceGoalsExpanded}"><strong>Today's goals</strong><span>Progress: ${completeGoals}/${goals.length} Complete</span></button>
                <div class="daily-goal-monitor"><div class="daily-goal-list">${goals.map(goal => `<div class="daily-goal-item ${goal.complete ? 'is-complete' : ''}"><span class="goal-check" data-x="${goal.complete ? 3 : 4}" data-y="0" aria-hidden="true"></span><span>${goal.label}${goal.target ? ` <small>${goal.value}/${goal.target}</small>` : ''}</span></div>`).join('')}</div>
                    <div class="reward-progress"><span class="reward-progress-label">Reward progress</span><div class="reward-circles" aria-label="Daily goal rewards">${Array.from({ length: 5 }, (_, index) => { const unlocked = index < goals.length ? goals[index].complete : allComplete; const claimed = state.claimed.includes(index); const amount = index === 4 ? 20 : 10; return `<button class="reward-circle ${unlocked && !claimed ? 'is-unlocked' : ''} ${claimed ? 'is-collected' : ''} ${index === 4 ? 'final-reward' : ''}" type="button" data-reward-index="${index}" data-x="${claimed ? 3 : 4}" data-y="0" aria-label="${claimed ? 'Reward collected' : unlocked ? `Claim ${amount} crystals` : 'Reward locked'}" ${unlocked && !claimed ? '' : 'disabled'}></button>`; }).join('')}</div></div>
                </div>
            </section>
            <section class="dashboard-panel streak-panel" aria-label="Streak"><h2>Streak</h2><div><strong>${streaks.current}</strong><span>Current Streak</span></div><div><strong>${streaks.best}</strong><span>Best Streak</span></div></section>
            <section class="dashboard-panel due-panel" aria-label="Words due today"><div class="due-panel-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg></div><div class="due-panel-copy"><span>REVIEW QUEUE</span><strong>Words Due Today: ${dueToday}</strong></div></section>`;
        page.querySelector('.daily-goal-summary').onclick = () => { practiceGoalsExpanded = !practiceGoalsExpanded; renderDashboard(); };
        page.querySelectorAll('[data-x]').forEach(icon => IconSheet.setIcon(icon, Number(icon.dataset.x), Number(icon.dataset.y), 32));
        page.querySelectorAll('[data-reward-index]').forEach(reward => {
            reward.onclick = () => {
                const index = Number(reward.dataset.rewardIndex);
                const currentState = getDailyGoalState(CikkiStorage.getGroups() || []);
                if (currentState.claimed.includes(index)) return;
                currentState.claimed.push(index);
                localStorage.setItem(dailyGoalStorageKey, JSON.stringify(currentState));
                const amount = index === 4 ? 20 : 10;
                CikkiStorage.addCrystals(amount);
                renderCrystalBalance();
                showCrystalReward(amount);
                renderDashboard();
            };
        });
    }

    function ensureEnglishGroup() {
        const groups = CikkiStorage.getGroups() || [];
        if (groups.some(group => String(group.name).toLocaleLowerCase() === 'english')) return;
        const created = Date.now();
        const words = [
            ['Apple', 'Olma'], ['Book', 'Kitob'], ['Water', 'Suv'], ['House', 'Uy'],
            ['Friend', 'Do\'st'], ['School', 'Maktab'], ['Sun', 'Quyosh'], ['Moon', 'Oy'],
            ['Bread', 'Non'], ['Mother', 'Ona'], ['Father', 'Ota'], ['Child', 'Bola'],
            ['Good', 'Yaxshi'], ['Day', 'Kun'], ['Thank you', 'Rahmat']
        ];
        CikkiStorage.addGroup({
            id: 'g-english',
            name: 'English',
            color: 'blue',
            icon: { x: 0, y: 0 },
            created,
            notes: words.map(([title, translation], index) => ({
                id: `n-english-${index}`,
                title,
                translation,
                fields: [],
                created,
                practice: { status: 'new', reviews: 0, lastReviewed: null }
            }))
        });
    }

    function renderGroupsHeader() {
        const pageHeader = document.querySelector('#groups-page .page-header');
        if (!pageHeader) return;

        pageHeader.innerHTML = editMode
            ? '<button class="group-edit-cancel">Cancel</button><h1>Edit Vocabulary</h1><div class="group-edit-actions"><button class="group-edit-action">Edit</button><button class="group-delete-action" type="button">Delete</button></div>'
            : '<h1>Vocabulary</h1><p>Your vocabulary</p>';

        pageHeader.classList.toggle('group-editing-header', editMode);

        if (editMode) {
            const cancelBtn = pageHeader.querySelector('.group-edit-cancel');
            const actionBtn = pageHeader.querySelector('.group-edit-action');
            const deleteBtn = pageHeader.querySelector('.group-delete-action');

            if (cancelBtn) cancelBtn.onclick = exitEditMode;
            if (actionBtn) {
                actionBtn.onclick = () => {
                    if (!selectedId) return;
                    const existing = CikkiStorage.getGroup(selectedId);
                    CikkiModal.openGroupModal(existing).then(res => {
                        if (!res) return;
                        CikkiStorage.updateGroup(selectedId, { name: res.name, color: res.color, icon: res.icon });
                        exitEditMode();
                        renderGroupsList();
                    });
                };
            }
            if (deleteBtn) {
                deleteBtn.onclick = async () => {
                    if (!selectedId) return;
                    const confirmed = await CikkiModal.openConfirm('Are you sure you want to delete this group?');
                    if (!confirmed) return;
                    CikkiStorage.removeGroup(selectedId);
                    exitEditMode();
                    renderGroupsList();
                };
            }
        }
    }

    function exitEditMode() {
        editMode = false;
        selectedId = null;
        dragState = null;
        document.body.classList.remove('group-edit-mode');
        renderGroupsHeader();

        const container = document.querySelector('.groups-container');
        if (container) {
            container.querySelectorAll('.group-card').forEach(card => {
                card.classList.remove('group-selected');
                const removeBtn = card.querySelector('.group-remove');
                if (removeBtn) removeBtn.remove();
            });
        }
    }

    function enterEditMode(groupId) {
        editMode = true;
        selectedId = groupId;
        document.body.classList.add('group-edit-mode');
        renderGroupsHeader();

        const container = document.querySelector('.groups-container');
        if (!container) return;

        container.querySelectorAll('.group-card').forEach(card => {
            card.classList.toggle('group-selected', card.dataset.id === groupId);
        });

        const selected = container.querySelector(`[data-id="${groupId}"]`);
        if (selected && !selected.querySelector('.group-remove')) {
            const remove = document.createElement('button');
            remove.className = 'group-remove';
            remove.type = 'button';
            remove.textContent = '×';
            remove.setAttribute('aria-label', 'Delete group');
            remove.onclick = event => {
                event.stopPropagation();
                CikkiModal.openConfirm('Are you sure you want to delete this group?').then(yes => {
                    if (!yes) return;
                    CikkiStorage.removeGroup(groupId);
                    exitEditMode();
                    renderGroupsList();
                });
            };
            selected.appendChild(remove);
        }
    }

    function reorderGroup(container, card, clientY) {
        const cards = Array.from(container.querySelectorAll('.group-card')).filter(item => item !== card);
        const target = cards.find(item => {
            const rect = item.getBoundingClientRect();
            return clientY < rect.top + rect.height / 2;
        });

        if (target) {
            if (card.nextElementSibling !== target) {
                container.insertBefore(card, target);
            }
        } else {
            if (container.lastElementChild !== card) {
                container.appendChild(card);
            }
        }
    }

    function persistOrder(container) {
        const groups = CikkiStorage.getGroups() || [];
        const order = Array.from(container.querySelectorAll('.group-card'))
            .map(card => groups.find(group => group.id === card.dataset.id))
            .filter(Boolean);
        CikkiStorage.reorderGroups(order);
    }

    function createAddGroupModal() {
        CikkiModal.openGroupModal().then(res => {
            if (!res) return;
            const newGroup = {
                id: 'g' + Date.now(),
                name: res.name || 'Untitled',
                color: res.color || 'lime',
                icon: res.icon || { x: 0, y: 0 },
                notes: [],
                created: Date.now()
            };
            CikkiStorage.addGroup(newGroup);
            renderGroupsList();
        });
    }

    function renderGroupsList() {
        const page = document.getElementById('groups-page');
        if (!page || window.Slider?.getCurrentPage() !== 0) return;

        // Reset baseline structure and recreate the group creation control.
        page.innerHTML = `
            <header class="page-header"></header>
            <div class="group-search">
                <span class="search-glyph" aria-hidden="true"></span>
                <input class="group-search-input" type="search" placeholder="Search all vocabulary notes" aria-label="Search all vocabulary notes" readonly>
            </div>
            <div class="sort-row">
                <label for="group-sort">Groups</label>
                <div class="custom-select" id="group-sort">
                    <button type="button" class="select-trigger" aria-haspopup="listbox" aria-expanded="false">Latest</button>
                    <ul class="select-options" role="listbox" aria-label="Sort groups">
                        <li role="option" tabindex="-1" data-value="latest">Latest</li>
                        <li role="option" tabindex="-1" data-value="oldest">Oldest</li>
                        <li role="option" tabindex="-1" data-value="largest">Largest</li>
                        <li role="option" tabindex="-1" data-value="smallest">Smallest</li>
                    </ul>
                </div>
            </div>
            <button class="group-create-btn">Create Group</button>
            <div class="groups-container"></div>
        `;

        const addGroupBtn = page.querySelector('.group-create-btn');
        if (addGroupBtn) {
            addGroupBtn.addEventListener('click', createAddGroupModal);
        }

        const container = page.querySelector('.groups-container');
        const searchInput = page.querySelector('.group-search-input');
        const groupSort = page.querySelector('#group-sort');
        const sortTrigger = groupSort.querySelector('.select-trigger');
        const sortOptions = groupSort.querySelector('.select-options');
        const selectedSort = sortOptions.querySelector(`[data-value="${groupSortValue}"]`);
        sortTrigger.textContent = selectedSort ? selectedSort.textContent : 'Latest';
        sortOptions.querySelectorAll('[role="option"]').forEach(option => {
            option.setAttribute('aria-selected', option === selectedSort ? 'true' : 'false');
        });

        function closeSortOptions() {
            groupSort.classList.remove('open');
            sortTrigger.setAttribute('aria-expanded', 'false');
        }

        sortTrigger.addEventListener('click', () => {
            const isOpen = groupSort.classList.toggle('open');
            sortTrigger.setAttribute('aria-expanded', String(isOpen));
        });

        sortOptions.addEventListener('click', event => {
            const option = event.target.closest('[role="option"]');
            if (!option) return;
            groupSortValue = option.dataset.value;
            closeSortOptions();
            renderGroupsList();
        });

        sortTrigger.addEventListener('keydown', event => {
            if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                groupSort.classList.add('open');
                sortTrigger.setAttribute('aria-expanded', 'true');
            } else if (event.key === 'Escape') {
                closeSortOptions();
            }
        });

        page.addEventListener('click', event => {
            if (!groupSort.contains(event.target)) closeSortOptions();
        });
        document.body.classList.remove('group-edit-mode');

        const groups = CikkiStorage.getGroups() || [];
        renderGroupsHeader();

        function sortedGroups() {
            return [...groups].sort((a, b) => {
                if (groupSortValue === 'largest' || groupSortValue === 'smallest') {
                    const difference = (a.notes || []).length - (b.notes || []).length;
                    return groupSortValue === 'largest' ? -difference : difference;
                }
                const difference = (a.created || 0) - (b.created || 0);
                return groupSortValue === 'latest' ? -difference : difference;
            });
        }

        function openSearchedNote(group, note, closeSearch) {
            closeSearch();
            CikkiModal.openNoteModal({ groupId: group.id, note }).then(updated => {
                if (!updated) return;
                if (updated.deleted) {
                    CikkiStorage.removeNoteSilent(group.id, note.id);
                    group.notes = (group.notes || []).filter(item => item.id !== note.id);
                    return;
                }
                CikkiStorage.updateNoteSilent(group.id, note.id, updated);
                Object.assign(note, updated);
            });
        }

        function openSearchWindow() {
            CikkiStorage.recordAchievementEvent('searchesUsed');
            checkAchievements();
            const overlay = document.createElement('div');
            overlay.className = 'search-overlay';
            overlay.innerHTML = `
                <div class="search-window" role="dialog" aria-modal="true" aria-label="Search notes">
                    <header class="search-header">
                        <button class="search-close" type="button" aria-label="Close search">×</button>
                        <input class="search-window-input" type="search" placeholder="Search notes" aria-label="Search notes">
                    </header>
                    <div class="search-window-results" aria-live="polite"></div>
                </div>
            `;
            document.body.appendChild(overlay);
            document.body.classList.add('modal-open');

            const input = overlay.querySelector('.search-window-input');
            const results = overlay.querySelector('.search-window-results');
            let loadedCount = 15;

            function closeSearch() {
                document.body.classList.remove('modal-open');
                document.removeEventListener('keydown', handleKeydown);
                overlay.remove();
            }

            function handleKeydown(event) {
                if (event.key === 'Escape') closeSearch();
            }

            function renderSearchResults() {
                const normalizedQuery = input.value.trim().toLocaleLowerCase();
                results.innerHTML = '';
                if (!normalizedQuery) return;

                const matches = [];
                groups.forEach(group => {
                    (group.notes || []).forEach(note => {
                        const title = String(note.title || '').trim();
                        if (title.toLocaleLowerCase().startsWith(normalizedQuery)) {
                            matches.push({ group, note, title });
                        }
                    });
                });

                if (!matches.length) {
                    results.innerHTML = '<div class="group-search-empty">No notes found</div>';
                    return;
                }

                matches.slice(0, loadedCount).forEach(({ group, note, title }) => {
                    const result = document.createElement('button');
                    result.type = 'button';
                    result.className = 'group-search-result';
                    result.innerHTML = `<strong>${escapeHtml(title)}</strong><span>${escapeHtml(group.name)}</span>`;
                    result.onclick = () => openSearchedNote(group, note, closeSearch);
                    results.appendChild(result);
                });

                if (loadedCount < matches.length) {
                    const loadMore = document.createElement('button');
                    loadMore.type = 'button';
                    loadMore.className = 'search-load-more';
                    loadMore.textContent = 'Load more';
                    loadMore.onclick = () => {
                        loadedCount += 15;
                        renderSearchResults();
                    };
                    results.appendChild(loadMore);
                }
            }

            input.addEventListener('input', () => {
                loadedCount = 15;
                renderSearchResults();
            });
            overlay.querySelector('.search-close').onclick = closeSearch;
            overlay.addEventListener('click', event => {
                if (event.target === overlay) closeSearch();
            });
            document.addEventListener('keydown', handleKeydown);
            input.focus();
        }

        searchInput.addEventListener('click', openSearchWindow);

        sortedGroups().forEach(g => {
            const el = document.createElement('div');
            el.className = `group-card ${g.color || ''}`;
            el.dataset.id = g.id;

            const icon = document.createElement('div');
            icon.className = 'group-icon';

            const info = document.createElement('div');
            info.className = 'group-info';
            const count = g.notes ? g.notes.length : 0;
            const noteCountLabel = count === 0 ? 'Empty' : `${count} ${count === 1 ? 'note' : 'notes'}`;
            info.innerHTML = `<h3>${escapeHtml(g.name)}</h3><span>${noteCountLabel}</span><small class="created-date">${formatDate(g.created)}</small>`;

            el.appendChild(icon);
            el.appendChild(info);
            container.appendChild(el);

            if (g.icon && typeof g.icon.x === 'number' && window.IconSheet) {
                IconSheet.setIcon(icon, g.icon.x, g.icon.y, 48);
            }

            el.addEventListener('click', () => {
                if (suppressClick) {
                    suppressClick = false;
                    return;
                }
                if (editMode) {
                    if (selectedId === g.id) {
                        exitEditMode();
                    }
                    return;
                }
                openGroup(g.id);
            });

            let holdTimer = null;
            let startY = 0;

            const clearHold = () => {
                if (holdTimer) clearTimeout(holdTimer);
                holdTimer = null;
            };

            el.addEventListener('pointerdown', event => {
                if (editMode && selectedId !== g.id) return;

                startY = event.clientY;

                if (editMode && selectedId === g.id) {
                    dragState = { card: el, moved: false, pointerId: event.pointerId };
                    el.setPointerCapture?.(event.pointerId);
                } else {
                    holdTimer = setTimeout(() => {
                        holdTimer = null;
                        suppressClick = true;
                        enterEditMode(g.id);
                        dragState = { card: el, moved: false, pointerId: event.pointerId };
                        el.setPointerCapture?.(event.pointerId);
                    }, 500);
                }
            });

            el.addEventListener('pointermove', event => {
                if (holdTimer && Math.abs(event.clientY - startY) > 8) {
                    clearHold();
                }

                if (!dragState || dragState.card !== el || !editMode) return;

                dragState.moved = true;
                suppressClick = true;
                reorderGroup(container, el, event.clientY);
            });

            el.addEventListener('pointerup', event => {
                clearHold();
                if (dragState && dragState.card === el &&
                    (dragState.pointerId === undefined || dragState.pointerId === event.pointerId)) {
                    if (dragState.moved) {
                        persistOrder(container);
                    }
                    dragState = null;
                }
            });

            el.addEventListener('pointercancel', () => {
                clearHold();
                if (dragState && dragState.card === el) dragState = null;
            });
            el.addEventListener('contextmenu', event => event.preventDefault());
        });
    }

    function openGroup(groupId) {
        const group = CikkiStorage.getGroup(groupId);
        if (!group) return;

        const page = document.getElementById('groups-page');
        if (!page) return;
        const selectedNotes = new Set();
        let selectMode = false;
        let suppressSelectionClick = false;
        const settingsToggle = document.getElementById('settings-toggle');
        const settingsIcon = settingsToggle?.querySelector('span');
        const leaveSelectMode = () => {
            selectMode = false;
            selectedNotes.clear();
            page.classList.remove('note-select-mode');
            if (settingsToggle) {
                settingsToggle.dataset.noteMenu = 'false';
                settingsToggle.setAttribute('aria-label', 'Open settings');
                settingsToggle.innerHTML = '<span aria-hidden="true"></span>';
            }
            page.querySelectorAll('.note-card-selected').forEach(card => card.classList.remove('note-card-selected'));
        };
        window.exitNoteSelectMode = leaveSelectMode;
        const enterSelectMode = noteId => {
            selectMode = true;
            suppressSelectionClick = true;
            selectedNotes.add(noteId);
            page.classList.add('note-select-mode');
            if (settingsToggle) {
                settingsToggle.dataset.noteMenu = 'true';
                settingsToggle.setAttribute('aria-label', 'Open note actions');
                settingsToggle.innerHTML = '<span class="nav-icon" aria-hidden="true"></span>';
                const icon = settingsToggle.querySelector('.nav-icon');
                if (icon && window.IconSheet) IconSheet.setIcon(icon, 3, 1, 24);
            }
            renderNotes();
        };
        const getSelectedNotes = () => (group.notes || []).filter(note => selectedNotes.has(note.id));

        page.innerHTML = '';
        page.classList.add('view-enter');
        page.addEventListener('animationend', () => page.classList.remove('view-enter'), { once: true });

        const header = document.createElement('header');
        header.className = 'page-header';
        header.innerHTML = `
    <div class="TopHeader">
        <button id="group-back" class="BackButton" aria-label="Go back" title="Go back">
            <span class="nav-icon"></span>
        </button>
        <h1>${escapeHtml(group.name)}</h1>
    </div>
    <p>Notes</p>
`;

        const notesContainer = document.createElement('div');
        notesContainer.className = 'groups-container notes-container';

        const noteSort = document.createElement('div');
        noteSort.className = 'custom-select note-sort';
        noteSort.innerHTML = `
            <button type="button" class="select-trigger" aria-haspopup="listbox" aria-expanded="false">Latest</button>
            <ul class="select-options" role="listbox" aria-label="Sort notes">
                <li role="option" tabindex="-1" aria-selected="true" data-value="latest">Latest</li>
                <li role="option" tabindex="-1" aria-selected="false" data-value="oldest">Oldest</li>
                <li role="option" tabindex="-1" aria-selected="false" data-value="top">Top Rank</li>
                <li role="option" tabindex="-1" aria-selected="false" data-value="bottom">Bottom Rank</li>
            </ul>
        `;
        let noteSortValue = 'latest';
        const noteSortTrigger = noteSort.querySelector('.select-trigger');
        const noteSortOptions = noteSort.querySelector('.select-options');

        function closeNoteSortOptions() {
            noteSort.classList.remove('open');
            noteSortTrigger.setAttribute('aria-expanded', 'false');
        }

        noteSortTrigger.addEventListener('click', () => {
            const isOpen = noteSort.classList.toggle('open');
            noteSortTrigger.setAttribute('aria-expanded', String(isOpen));
        });

        noteSortOptions.addEventListener('click', event => {
            const option = event.target.closest('[role="option"]');
            if (!option) return;
            noteSortValue = option.dataset.value;
            noteSortTrigger.textContent = option.textContent;
            noteSortOptions.querySelectorAll('[role="option"]').forEach(item => {
                item.setAttribute('aria-selected', item === option ? 'true' : 'false');
            });
            closeNoteSortOptions();
            renderNotes();
        });

        noteSortTrigger.addEventListener('keydown', event => {
            if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                noteSort.classList.add('open');
                noteSortTrigger.setAttribute('aria-expanded', 'true');
            } else if (event.key === 'Escape') {
                closeNoteSortOptions();
            }
        });

        page.addEventListener('click', event => {
            if (!noteSort.contains(event.target)) closeNoteSortOptions();
        });

        const addNoteBtn = document.createElement('button');
        addNoteBtn.className = 'note-list-add';
        addNoteBtn.textContent = 'Add';

        page.appendChild(header);
        page.appendChild(noteSort);
        page.appendChild(addNoteBtn);
        page.appendChild(notesContainer);

        const originalSettingsToggleHandler = settingsToggle?.onclick;
        if (settingsToggle) settingsToggle.onclick = async event => {
            if (!selectMode) {
                if (originalSettingsToggleHandler) originalSettingsToggleHandler.call(settingsToggle, event);
                return;
            }
            event.stopPropagation();
            const choices = [
                { label: 'Select All', value: 'select' },
                { label: 'Delete Selected', value: 'delete' },
                { label: 'Export Selected', value: 'export' },
                { label: 'Cancel', value: 'cancel' }
            ];
            const action = await CikkiModal.openChoiceModal('Note actions', `${selectedNotes.size} selected`, choices);
            if (action === 'select') {
                (group.notes || []).forEach(note => selectedNotes.add(note.id));
                renderNotes();
            } else if (action === 'delete') {
                const confirmed = await CikkiModal.openConfirm(`Delete ${selectedNotes.size} selected notes?`);
                if (!confirmed) return;
                selectedNotes.forEach(noteId => CikkiStorage.removeNoteSilent(groupId, noteId));
                group.notes = (group.notes || []).filter(note => !selectedNotes.has(note.id));
                leaveSelectMode();
                renderNotes();
            } else if (action === 'export') {
                const selected = (getSelectedNotes() || []).map(serializeExportNote);
                const json = JSON.stringify(selected, null, 2);
                openSelectedNotesExportDialog(json);
            } else if (action === 'cancel') {
                leaveSelectMode();
            }
        };

        const backIcon = header.querySelector('.nav-icon');
        if (backIcon && window.IconSheet) IconSheet.setIcon(backIcon, 0, 0, 28);

        function renderNotes() {
            const shouldAnimate = !notesContainer.dataset.rendered;
            if (shouldAnimate) {
                notesContainer.classList.add('notes-initial');
                notesContainer.addEventListener('animationend', () => {
                    notesContainer.classList.remove('notes-initial');
                }, { once: true });
            }
            notesContainer.dataset.rendered = 'true';
            notesContainer.innerHTML = '';
            const notes = [...(group.notes || [])].sort((a, b) => {
                if (noteSortValue === 'top' || noteSortValue === 'bottom') {
                    const difference = rankInfo[getPractice(a).status].rank - rankInfo[getPractice(b).status].rank;
                    return noteSortValue === 'top' ? -difference : difference;
                }
                const difference = (a.created || 0) - (b.created || 0);
                return noteSortValue === 'latest' ? -difference : difference;
            });
            notes.forEach(n => {
                const card = document.createElement('div');
                const practice = getPractice(n);
                card.className = `group-card note-card rank-${practice.status}${selectedNotes.has(n.id) ? ' note-card-selected' : ''}`;
                const info = document.createElement('div');
                info.className = 'group-info';

                const primary = n.title || '';
                const trans = n.translation || '';
                const rating = Number.isInteger(n.rating) ? Math.max(0, Math.min(5, n.rating)) : 0;
                info.innerHTML = `<h3>${escapeHtml(primary)}</h3><span>${escapeHtml(trans)}</span><div class="note-rating-display" role="img" aria-label="Rated ${rating} out of 5">${Array.from({ length: 5 }, (_, index) => `<span class="${index < rating ? 'is-selected' : ''}" aria-hidden="true">${index < rating ? '&#9733;' : '&#9734;'}</span>`).join('')}</div><small class="created-date">${formatDate(n.created)}</small>`;
                card.appendChild(info);
                
                const badge = document.createElement('span');
                badge.className = `rank-badge rank-${practice.status}`;
                
                badge.style.background = 'transparent';
                badge.style.border = 'none';
            
                badge.textContent = rankInfo[practice.status].label; 
                
                card.appendChild(badge);
                notesContainer.appendChild(card);

                card.addEventListener('click', () => {
                    if (suppressSelectionClick) {
                        suppressSelectionClick = false;
                        return;
                    }
                    if (selectMode) {
                        if (selectedNotes.has(n.id)) selectedNotes.delete(n.id);
                        else selectedNotes.add(n.id);
                        if (!selectedNotes.size) leaveSelectMode();
                        renderNotes();
                        return;
                    }
                    CikkiModal.openNoteModal({ groupId, note: n }).then(updated => {
                        if (updated && updated.deleted) {
                            CikkiStorage.removeNoteSilent(groupId, n.id);
                            group.notes = (group.notes || []).filter(note => note.id !== n.id);
                            renderNotes();
                        } else if (updated) {
                            CikkiStorage.updateNoteSilent(groupId, n.id, updated);
                            Object.assign(n, updated);
                            renderNotes();
                        }
                    });
                });

                let holdTimer = null;
                let suppressClick = false;
                const clearHold = () => {
                    if (holdTimer) clearTimeout(holdTimer);
                    holdTimer = null;
                };
                card.addEventListener('pointerdown', () => {
                    holdTimer = setTimeout(async () => {
                        holdTimer = null;
                        suppressClick = true;
                        if (!selectMode) {
                            enterSelectMode(n.id);
                            return;
                        }
                        if (selectedNotes.has(n.id)) selectedNotes.delete(n.id);
                        else selectedNotes.add(n.id);
                        renderNotes();
                    }, 500);
                });
                ['pointerup', 'pointercancel', 'pointerleave'].forEach(eventName => {
                    card.addEventListener(eventName, clearHold);
                });
                card.addEventListener('click', event => {
                    if (suppressClick) {
                        suppressClick = false;
                        event.stopImmediatePropagation();
                    }
                }, true);
                card.addEventListener('contextmenu', event => event.preventDefault());
            });
        }

        renderNotes();

        document.getElementById('group-back').addEventListener('click', () => {
            leaveSelectMode();
            window.exitNoteSelectMode = null;
            renderGroupsList();
        });

        addNoteBtn.addEventListener('click', () => {
            CikkiModal.openNoteModal({ groupId }).then(note => {
                if (!note) return;
                note.created = Date.now();
                CikkiStorage.addNoteSilent(groupId, note);
                group.notes = group.notes || [];
                group.notes.unshift(note);
                renderNotes();
            });
        });
    }

    function renderPractice() {
        const page = document.getElementById('practice-page');
        if (!page || window.Slider?.getCurrentPage() !== 1) return;
        const groups = CikkiStorage.getGroups() || [];
        if (!groups.length) {
            page.innerHTML = '<section class="daily-goal-card"><div class="daily-goal-summary"><strong>Today\'s goal</strong><span>Progress: 1/4 Complete</span></div></section><header class="page-header"><h1>Practice</h1><p>Practice your words</p></header><div class="placeholder">Create a group to start practicing.</div>';
            return;
        }

        practiceGroupIndex = Math.min(practiceGroupIndex, groups.length - 1);
        const group = groups[practiceGroupIndex];
        const notes = group.notes || [];
        const eligibleNotes = notes.filter(note => !note.translationRemoved && note.translation);
        const today = todayKey();
        const failedReviewNotes = eligibleNotes.filter(note => {
            const reviewDue = getPractice(note).reviewDue;
            return Boolean(reviewDue);
        });
        const failedReviewIds = new Set(failedReviewNotes.map(note => note.id));
        const rankReviewNotes = eligibleNotes.filter(note => ['new', 'familiar'].includes(getPractice(note).status) && !failedReviewIds.has(note.id));
        const reviewNotes = failedReviewNotes.concat(rankReviewNotes);
        const notesToReview = reviewNotes.length ? reviewNotes : [...eligibleNotes].sort(() => Math.random() - .5).slice(0, 5);
        const dueNotes = eligibleNotes.filter(isPracticeDue);
        const counts = { new: 0, familiar: 0, memorized: 0, mastered: 0, unforgetable: 0 };
        notes.forEach(note => { counts[getPractice(note).status] += 1; });
        const canPractice = eligibleNotes.length > 0;
        const progress = getGroupProgress(group);
        const dailyGoals = getDailyGoals(groups);
        const completeGoals = dailyGoals.filter(goal => goal.complete).length;
        const dailyGoalState = getDailyGoalState(groups);
        const allGoalsComplete = completeGoals === dailyGoals.length;
        page.innerHTML = `
            <header class="page-header"><h1>Practice</h1><p>Practice your words</p></header>
            <section class="practice-review-panel" aria-label="Review">
                <div><h2>Review</h2><p>Amount of notes to examine: <strong>${notesToReview.length}</strong></p><p>Failed notes to check: <strong>${failedReviewNotes.length}</strong></p></div>
                <button class="practice-review-button" type="button" data-review-start ${notesToReview.length ? '' : 'disabled'}>Check</button>
            </section>
            <section class="practice-group-picker" aria-label="Practice group selection">
                <button class="practice-arrow" type="button" aria-label="Previous group">&#8592;</button>
                <div class="practice-group-name"><strong>${escapeHtml(group.name)}</strong><span>${notes.length} ${notes.length === 1 ? 'note' : 'notes'} <small>${formatDate(group.created)}</small></span></div>
                <button class="practice-arrow" type="button" aria-label="Next group">&#8594;</button>
            </section>
            <section class="practice-monitor" aria-label="Practice monitor">
                ${Object.entries(rankInfo).map(([status, info]) => `<div class="monitor-item rank-${status}"><strong>${counts[status]}</strong><span>${info.label}</span></div>`).join('')}
            </section>
            <section class="practice-start-panel ${group.color || ''}" aria-label="Start practice">
                <button class="practice-start-button" type="button" data-practice-start ${canPractice ? '' : 'disabled'}>Start practicing</button>
                <span>${canPractice ? (dueNotes.length ? `Words to learn today: ${dueNotes.length}` : `Redo practice: ${eligibleNotes.length} words`) : 'No words available for practice'}</span>
                <span class="practice-progress-percent">${progress}%</span>
                <span class="practice-progress-track" role="progressbar" aria-label="Practice progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress}"><span style="width: ${progress}%"></span></span>
            </section>`;

        const arrows = page.querySelectorAll('.practice-arrow');
        arrows[0].onclick = () => { practiceGroupIndex = (practiceGroupIndex - 1 + groups.length) % groups.length; renderPractice(); };
        arrows[1].onclick = () => { practiceGroupIndex = (practiceGroupIndex + 1) % groups.length; renderPractice(); };
        const startButton = page.querySelector('[data-practice-start]');
        if (startButton && canPractice) startButton.onclick = () => openPracticeSession(group, dueNotes.length === 0);
        const reviewButton = page.querySelector('[data-review-start]');
        if (reviewButton && notesToReview.length) reviewButton.onclick = () => openReviewSession(group, notesToReview);
    }

    function openReviewSession(group, reviewNotes) {
        if (!reviewNotes.length) return;
        const overlay = document.createElement('div');
        overlay.className = 'practice-overlay review-overlay';
        overlay.innerHTML = `<section class="practice-session review-session" role="dialog" aria-modal="true" aria-label="Review notes"><header class="practice-session-header"><strong>${escapeHtml(group.name)} Review</strong><button class="practice-session-close" type="button" aria-label="Leave review">&#215;</button></header><div class="review-note-content"></div><div class="review-next-actions"><button class="practice-again" type="button">Next</button></div></section>`;
        document.body.appendChild(overlay);
        document.body.classList.add('modal-open', 'practice-open');
        document.querySelector('.bottom-nav')?.style.setProperty('display', 'none');
        const content = overlay.querySelector('.review-note-content');
        let noteIndex = 0;

        function renderReviewNote() {
            const note = reviewNotes[noteIndex];
            const lines = [{ label: 'Word', value: note.title || 'Untitled' }, { label: 'Translation', value: note.translation || '' }]
                .concat((note.fields || []).filter(field => field && (field.label || field.value)).map(field => ({ label: field.label || 'Note', value: field.value || '' })));
            content.innerHTML = lines.map((line, index) => `<p class="review-note-line" style="--review-delay: ${index * 180}ms"><strong>${escapeHtml(line.label)}</strong><span>${escapeHtml(line.value)}</span></p>`).join('');
            const next = overlay.querySelector('.review-next-actions button');
            next.textContent = noteIndex === reviewNotes.length - 1 ? 'Done' : 'Next';
            if (note.practice?.reviewDue) {
                CikkiStorage.updateNoteSilent(group.id, note.id, { practice: Object.assign({}, note.practice, { reviewDue: null }) });
            }
        }

        function close() {
            document.body.classList.remove('modal-open', 'practice-open');
            document.querySelector('.bottom-nav')?.style.removeProperty('display');
            overlay.remove();
            renderPractice();
        }

        overlay.querySelector('.practice-session-close').onclick = close;
        overlay.querySelector('.review-next-actions button').onclick = () => {
            if (noteIndex >= reviewNotes.length - 1) close();
            else { noteIndex += 1; renderReviewNote(); }
        };
        overlay.onclick = event => { if (event.target === overlay) close(); };
        renderReviewNote();
    }

    function openPracticeSession(group, isRedo = false, reviewNotes = null) {
        const notes = group.notes || [];
        if (!notes.length) return;
        const today = todayKey();
        const eligibleNotes = notes.filter(note => !note.translationRemoved && note.translation);
        const dueNotes = eligibleNotes.filter(isPracticeDue);
        const sessionNotes = reviewNotes || (isRedo ? eligibleNotes : dueNotes);
        if (!sessionNotes.length) return;
        const sessionId = `practice-${Date.now()}-${Math.random().toString(36).slice(2)}`;

        const overlay = document.createElement('div');
        overlay.className = 'practice-overlay';
        overlay.innerHTML = `
            <section class="practice-session" role="dialog" aria-modal="true" aria-label="Practice session">
                <header class="practice-session-header">
                    <strong>${escapeHtml(group.name)}</strong>
                    <button class="practice-session-close" type="button" aria-label="Leave practice">&#215;</button>
                </header>
                <div class="practice-prompt">
                    <div class="practice-word-wrap"><strong class="practice-word"></strong><span class="practice-result" aria-live="polite" hidden></span></div>
                    <div class="practice-translation-wrap"><span class="practice-translation"></span><button class="practice-reveal" type="button">Reveal</button></div>
                </div>
                <div class="practice-test-area"></div>
                <div class="practice-next-actions" hidden>
                    <button class="practice-again" type="button">Again</button>
                </div>
            </section>`;
        document.body.appendChild(overlay);
        document.body.classList.add('modal-open');
        document.body.classList.add('practice-open');
        document.querySelector('.bottom-nav')?.style.setProperty('display', 'none');

        const word = overlay.querySelector('.practice-word');
        const translation = overlay.querySelector('.practice-translation');
        const translationWrap = overlay.querySelector('.practice-translation-wrap');
        const reveal = overlay.querySelector('.practice-reveal');
        const testArea = overlay.querySelector('.practice-test-area');
        const nextActions = overlay.querySelector('.practice-next-actions');
        let currentNote;
        let answerTransitionTimer = null;
        let answerComplete = false;
        let wrongAnswers = 0;
        const reviewedNotes = new Set();
        const rankUps = [];
        let earnedCrystals = 0;
        const progressBefore = getGroupProgress(group);

        function showSessionComplete() {
            CikkiStorage.recordPracticeSession(wrongAnswers === 0);
            checkAchievements();
            const progressGained = Math.max(0, getGroupProgress(group) - progressBefore);
            overlay.querySelector('.practice-session').innerHTML = `
                <section class="session-complete" aria-label="Session complete">
                    <h1>Session complete</h1>
                    <p>Words Reviewed: ${reviewedNotes.size}</p>
                    <p>Progress Gained: +${progressGained}%</p>
                    ${rankUps.length ? `<div class="session-rank-ups"><strong>Rank Ups:</strong>${rankUps.map(item => `<p>${escapeHtml(item.word)} &#8594; ${rankInfo[item.to].label}</p>`).join('')}</div>` : ''}
                    <p class="session-earned">Earned +${earnedCrystals} <img src="assets/icon/crystal.png" alt="Crystal"></p>
                    <button class="practice-session-done" type="button">Done</button>
                </section>`;
            overlay.querySelector('.practice-session-done').onclick = close;
        }

        function resetResult() {
            const result = overlay.querySelector('.practice-result');
            result.className = 'practice-result';
            result.hidden = true;
            result.textContent = '';
        }

        function todayKey() {
            return reviewDayKey();
        }

        function tomorrowKey() {
            const date = new Date();
            date.setDate(date.getDate() + 1);
            return reviewDayKey(date);
        }

        function fuzzyMatch(expected, actual) {
            const clean = value => String(value).toLocaleLowerCase().trim().replace(/\s+/g, ' ');
            const right = clean(actual);
            if (!right) return false;
            return String(expected).split(',').some(synonym => {
                const left = clean(synonym);
                if (left === right) return true;
                if (!left || Math.abs(left.length - right.length) > 2) return false;
                const row = Array.from({ length: right.length + 1 }, (_, index) => index);
                for (let i = 1; i <= left.length; i += 1) {
                    let diagonal = row[0];
                    row[0] = i;
                    for (let j = 1; j <= right.length; j += 1) {
                        const above = row[j];
                        row[j] = left[i - 1] === right[j - 1]
                            ? diagonal
                            : Math.min(diagonal + 1, row[j] + 1, row[j - 1] + 1);
                        diagonal = above;
                    }
                }
                return row[right.length] <= Math.max(1, Math.floor(left.length * .15));
            });
        }

        function exactMatch(expected, actual) {
            const answer = String(actual || '').trim().toLocaleLowerCase();
            return String(expected || '').split(',').some(synonym => synonym.trim().toLocaleLowerCase() === answer);
        }

        function hasReviewDays(note, requiredDays) {
            const days = new Set((getPractice(note).recallHistory || []).map(item => item.day));
            return days.size >= requiredDays;
        }

        function recordFailedAttempt(note) {
    const practice = getPractice(note);
    const currentStatus = rankInfo[practice.status] ? practice.status : 'new';
    const failedAttempts = (practice.failedAttempts || 0) + 1;

    // Check if we hit the 3-attempt threshold for a downgrade
    if (failedAttempts >= 3) {
        // Find the previous rank status, or keep current if it's already at the lowest rank/new
        const currentRank = rankInfo[currentStatus].rank;
        const nextStatus = currentStatus === 'new'
            ? 'new' 
            : Object.entries(rankInfo).find(([, info]) => info.rank === currentRank - 1)?.[0] || currentStatus;

        const nextPractice = Object.assign({}, practice, {
            failedAttempts: 0, // Reset counter after downgrade
            status: nextStatus,
            inReview: true // Single failed attempt triggers Review
        });

        note.practice = nextPractice;
        CikkiStorage.updateNoteSilent(group.id, note.id, { practice: nextPractice });
        return;
    }

    // Standard single failed attempt (under 3 total fails)
    const nextPractice = Object.assign({}, practice, {
        failedAttempts,
        inReview: true // Mark as added to Review immediately
    });

    note.practice = nextPractice;
    CikkiStorage.updateNoteSilent(group.id, note.id, { practice: nextPractice });
}

        function queueFailedReview(note) {
            updatePractice(note, { reviewDue: tomorrowKey() });
        }

        function renderMatchPairs() {
            const pairNotes = sessionNotes.filter(note => getPractice(note).status === 'familiar')
                .sort(() => Math.random() - .5).slice(0, 4);
            if (!pairNotes.length) return;
            const translations = pairNotes.map(note => note.translation).sort(() => Math.random() - .5);
            const practicePrompt = overlay.querySelector('.practice-prompt');
            practicePrompt.hidden = true;
            practicePrompt.style.setProperty('display', 'none', 'important');
            testArea.innerHTML = `<div class="match-pairs" aria-label="Match English words with translations"><strong class="match-title">Match pairs</strong><svg class="match-lines" aria-hidden="true"></svg><div class="match-column match-words">${pairNotes.map(note => `<button type="button" class="match-card" data-note-id="${note.id}" data-side="word">${escapeHtml(note.title || 'Untitled')}</button>`).join('')}</div><div class="match-column match-translations">${translations.map(translation => `<button type="button" class="match-card" data-translation="${escapeHtml(translation)}" data-side="translation">${escapeHtml(translation)}</button>`).join('')}</div></div>`;
            const board = testArea.querySelector('.match-pairs');
            let selectedWord = null;
            let selectedButton = null;
            const drawLine = (from, to, className) => {
                const bounds = board.getBoundingClientRect();
                const fromBounds = from.getBoundingClientRect();
                const toBounds = to.getBoundingClientRect();
                const x1 = fromBounds.right - bounds.left;
                const y1 = fromBounds.top + fromBounds.height / 2 - bounds.top;
                const x2 = toBounds.left - bounds.left;
                const y2 = toBounds.top + toBounds.height / 2 - bounds.top;
                const curve = Math.max(30, (x2 - x1) * .45);
                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                path.setAttribute('d', `M ${x1} ${y1} C ${x1 + curve} ${y1}, ${x2 - curve} ${y2}, ${x2} ${y2}`);
                path.setAttribute('class', className);
                board.querySelector('.match-lines').appendChild(path);
                setTimeout(() => path.remove(), 1000);
            };
            const clearSelection = () => {
                selectedButton?.classList.remove('is-selected');
                selectedWord = null;
                selectedButton = null;
            };
            board.querySelectorAll('.match-card').forEach(button => {
                button.onclick = () => {
                    if (button.disabled) return;
                    if (button.dataset.side === 'word') {
                        clearSelection();
                        selectedWord = pairNotes.find(note => note.id === button.dataset.noteId);
                        selectedButton = button;
                        button.classList.add('is-selected');
                        return;
                    }
                    if (!selectedWord) return;
                    const wordButton = selectedButton;
                    const correct = selectedWord.translation.split(',').some(value => value.trim() === button.dataset.translation.trim());
                    drawLine(wordButton, button, correct ? 'match-line-correct' : 'match-line-wrong');
                    if (correct) {
                        wordButton.disabled = true;
                        button.disabled = true;
                        currentNote = selectedWord;
                        updatePractice(currentNote, { status: 'memorized', failedAttempts: 0, reviewDue: null });
                        reviewedNotes.add(currentNote.id);
                        rankUps.push({ word: currentNote.title || 'Untitled', to: 'memorized' });
                        earnedCrystals += crystalRewards.memorized;
                        clearSelection();
                        if (!board.querySelector('.match-card[data-side="word"]:not(:disabled)')) {
                            testArea.hidden = true;
                            setTimeout(() => {
                                if (reviewedNotes.size >= sessionNotes.length) showSessionComplete();
                                else chooseNote();
                            }, 240);
                        }
                    } else {
                        recordFailedAttempt(selectedWord);
                        queueFailedReview(selectedWord);
                        button.classList.add('is-wrong');
                        setTimeout(() => button.classList.remove('is-wrong'), 400);
                        clearSelection();
                    }
                };
            });
        }

        function showResult(correct) {
            if (answerComplete) return;
            answerComplete = true;
            const result = overlay.querySelector('.practice-result');
            result.textContent = correct ? 'Correct' : 'Wrong';
            result.className = `practice-result ${correct ? 'correct' : 'wrong'}`;
            result.hidden = false;
            translationWrap.hidden = false;
            translation.classList.remove('practice-text-reveal');
            requestAnimationFrame(() => translation.classList.add('practice-text-reveal'));
            translation.classList.remove('is-blurred');
            reveal.hidden = true;
            testArea.classList.add('practice-actions-exit');
            const statusBefore = getPractice(currentNote).status;
            if (correct) updatePractice(currentNote, {});
            if (correct && statusBefore === 'new') {
                updatePractice(currentNote, { status: 'familiar' });
                if (!Number.isFinite(currentNote.learnedAt)) {
                    currentNote.learnedAt = Date.now();
                    CikkiStorage.updateNoteSilent(group.id, currentNote.id, { learnedAt: currentNote.learnedAt });
                }
            } else if (correct && statusBefore === 'familiar') {
                updatePractice(currentNote, { status: 'memorized', failedAttempts: 0 });
            } else if (correct && statusBefore === 'memorized') {
                updatePractice(currentNote, { status: hasReviewDays(currentNote, 2) ? 'mastered' : 'memorized' });
            } else if (correct && statusBefore === 'mastered') {
                updatePractice(currentNote, { status: hasReviewDays(currentNote, 4) ? 'unforgetable' : 'mastered' });
            }
            if (!correct) {
                wrongAnswers += 1;
                recordFailedAttempt(currentNote);
                queueFailedReview(currentNote);
            } else {
                updatePractice(currentNote, { reviewDue: null });
            }
            reviewedNotes.add(currentNote.id);
            const statusAfter = getPractice(currentNote).status;
            if (correct && statusAfter !== statusBefore) {
                rankUps.push({ word: currentNote.title || 'Untitled', to: statusAfter });
                earnedCrystals += crystalRewards[statusAfter] || 0;
                if (statusAfter === 'memorized') CikkiStorage.recordAchievementEvent('memorizedUpgrades');
                if (statusAfter === 'mastered') CikkiStorage.recordAchievementEvent('masteredUpgrades');
            }
            answerTransitionTimer = setTimeout(() => {
                answerTransitionTimer = null;
                testArea.hidden = true;
                testArea.classList.remove('practice-actions-exit');
                if (reviewedNotes.size >= sessionNotes.length) showSessionComplete();
                else nextActions.hidden = false;
            }, 240);
        }

        function updatePractice(note, patch) {
            const currentPractice = getPractice(note);
            const day = todayKey();
            const history = Array.isArray(currentPractice.recallHistory) ? currentPractice.recallHistory : [];
            const nextHistory = history.some(item => item.day === day)
                ? history
                : history.concat({ day, sessionId });
            const nextStatus = patch.status || currentPractice.status;
            const fromRank = rankInfo[currentPractice.status].rank;
            const toRank = rankInfo[nextStatus].rank;
            const rankHistory = Array.isArray(currentPractice.rankHistory) ? currentPractice.rankHistory : [];
            const nextRankHistory = fromRank === toRank
                ? rankHistory
                : rankHistory.concat({ time: Date.now(), fromRank, toRank });
            const practice = Object.assign({}, currentPractice, patch, {
                lastReviewed: Date.now(),
                recallHistory: nextHistory,
                rankHistory: nextRankHistory
            });
            note.practice = practice;
            CikkiStorage.updateNoteSilent(group.id, note.id, { practice });
            if (practice.status !== currentPractice.status && crystalRewards[practice.status]) {
                CikkiStorage.addCrystals(crystalRewards[practice.status]);
                renderCrystalBalance();
                showCrystalReward(crystalRewards[practice.status]);
            }
        }

        function renderTest(status, correctAnswer) {
            if (status === 'new') {
                const distractors = notes.filter(note => note.id !== currentNote.id && !note.translationRemoved && note.translation);
                const answers = distractors.sort(() => Math.random() - .5).slice(0, 3).map(note => note.translation);
                answers.push(correctAnswer);
                answers.sort(() => Math.random() - .5);
                testArea.innerHTML = `<div class="multiple-choice-options">${answers.map(answer => `<button type="button" class="multiple-choice-option">${escapeHtml(answer)}</button>`).join('')}</div>`;
                testArea.querySelectorAll('.multiple-choice-option').forEach(button => {
                    button.onclick = () => showResult(button.textContent === correctAnswer);
                });
                return;
            }
            if (status === 'familiar') {
                renderMatchPairs();
                return;
            }
            if (status === 'memorized' || status === 'mastered') {
                testArea.innerHTML = '<form class="type-recall-form"><input class="type-recall-input" type="text" autocomplete="off" placeholder="Type the exact translation" aria-label="Type the exact translation"><button type="submit">Check</button><span class="type-recall-feedback" aria-live="polite"></span></form>';
                const form = testArea.querySelector('.type-recall-form');
                const input = form.querySelector('input');
                form.onsubmit = event => {
                    event.preventDefault();
                    const correct = exactMatch(correctAnswer, input.value);
                    form.querySelector('.type-recall-feedback').textContent = correct ? 'Correct' : 'Try again next time';
                    showResult(correct);
                };
                input.focus();
                return;
            }
            testArea.innerHTML = '<div class="practice-answer-actions"><button class="practice-answer remember" type="button">I remember</button><button class="practice-answer forgot" type="button">I forgot</button></div>';
            testArea.querySelector('.remember').onclick = () => showResult(true);
            testArea.querySelector('.forgot').onclick = () => showResult(false);
        }

        function chooseNote() {
            if (answerTransitionTimer) {
                clearTimeout(answerTransitionTimer);
                answerTransitionTimer = null;
            }
            const chances = { new: 50, familiar: 30, memorized: 11, mastered: 6, unforgetable: 3 };
            const practiceNotes = sessionNotes.filter(note => !reviewedNotes.has(note.id));
            if (!practiceNotes.length) {
                showSessionComplete();
                return;
            }
            const available = Object.keys(chances).filter(status => practiceNotes.some(note => getPractice(note).status === status));
            if (!available.length) return;
            const totalChance = available.reduce((total, status) => total + chances[status], 0);
            let pick = Math.random() * totalChance;
            const status = available.find(candidate => {
                pick -= chances[candidate];
                return pick < 0;
            }) || available[0];
            const rankNotes = practiceNotes.filter(note => getPractice(note).status === status);
            currentNote = rankNotes[Math.floor(Math.random() * rankNotes.length)];
            const practicePrompt = overlay.querySelector('.practice-prompt');
            practicePrompt.hidden = false;
            practicePrompt.style.removeProperty('display');
            word.textContent = currentNote.title || 'Untitled';
            resetResult();
            const hasTranslation = !currentNote.translationRemoved && Boolean(currentNote.translation);
            translation.textContent = currentNote.translation || '';
            translation.classList.remove('practice-text-reveal');
            translation.classList.toggle('is-blurred', hasTranslation);
            const usesRecallTest = status === 'new' || status === 'familiar';
            translationWrap.hidden = !hasTranslation || usesRecallTest;
            reveal.hidden = !hasTranslation || usesRecallTest;
            answerComplete = false;
            testArea.classList.remove('practice-actions-exit');
            testArea.classList.remove('practice-answer-fade');
            testArea.hidden = false;
            nextActions.hidden = true;
            nextActions.querySelector('.practice-again').textContent = 'Again';
            renderTest(status, currentNote.translation || '');
        }

        function close() {
            document.body.classList.remove('modal-open');
            document.body.classList.remove('practice-open');
            document.querySelector('.bottom-nav')?.style.removeProperty('display');
            overlay.remove();
            renderPractice();
        }

        function startAgain() {
            const result = overlay.querySelector('.practice-result');
            result?.classList.add('is-exiting');
            setTimeout(chooseNote, 500);
        }

        reveal.onclick = () => {
            translation.classList.remove('practice-text-reveal');
            requestAnimationFrame(() => translation.classList.add('practice-text-reveal'));
            translation.classList.remove('is-blurred');
            reveal.hidden = true;
            wrongAnswers += 1;
            recordFailedAttempt(currentNote);
            queueFailedReview(currentNote);
            reviewedNotes.add(currentNote.id);
            testArea.classList.add('practice-answer-fade');
            nextActions.querySelector('.practice-again').textContent = 'Another';
            nextActions.hidden = false;
            setTimeout(() => {
                testArea.hidden = true;
                testArea.innerHTML = '';
            }, 300);
        };
        overlay.querySelector('.practice-again').onclick = startAgain;
        overlay.querySelector('.practice-session-close').onclick = close;
        overlay.onclick = event => { if (event.target === overlay) close(); };
        chooseNote();
    }

    function renderStatistics() {
    const page = document.getElementById('statistics-page');
    if (!page || window.Slider?.getCurrentPage() !== 3) return;
    const groups = CikkiStorage.getGroups() || [];
    if (!groups.length) {
        page.innerHTML = '<header class="page-header"><h1>Statistics</h1><p>Track your vocabulary growth</p></header><div class="placeholder">Create a group to see statistics.</div>';
        return;
    }

    statisticsGroupIndex = Math.min(statisticsGroupIndex, groups.length - 1);
    const group = groups[statisticsGroupIndex];
    const notes = group.notes || [];
    
    const today = new Date();
    const startOfDay = date => new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const todayStart = startOfDay(today);
    
    const endOfToday = new Date(todayStart);
    endOfToday.setHours(23, 59, 59, 999);

    const dayKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const dayLabel = date => `${date.getMonth() + 1}/${date.getDate()}`;
    
    const createdNotes = notes.filter(note => Number.isFinite(note.created) && note.created <= endOfToday.getTime());
    
    // FIX: Align the 28-day cutoff strictly to day boundaries
    const cutoff = new Date(todayStart);
    cutoff.setDate(cutoff.getDate() - 27);
    
    const firstNoteDate = createdNotes.length ? new Date(Math.min(...createdNotes.map(note => note.created))) : cutoff;
    const rangeStart = statisticsRange === '28' ? cutoff : new Date(firstNoteDate.getFullYear(), firstNoteDate.getMonth(), firstNoteDate.getDate());
    
    const chartDays = [];
    for (const cursor = new Date(rangeStart); cursor <= endOfToday; cursor.setDate(cursor.getDate() + 1)) {
        chartDays.push(new Date(cursor));
    }
    
    const dailyCounts = new Map();
    createdNotes.forEach(note => {
        const date = new Date(note.created);
        const key = dayKey(date);
        if (date >= rangeStart && date <= endOfToday) dailyCounts.set(key, (dailyCounts.get(key) || 0) + 1);
    });
    
    const chartValues = chartDays.map(date => dailyCounts.get(dayKey(date)) || 0);
    const selectedNotesTotal = chartValues.reduce((total, count) => total + count, 0);
    
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
    
    // FIX: Accurately calculate words Upgraded/Raised from 'new'
    const learnedNotes = notes.filter(note => getPractice(note).status !== 'new');
    const totalLearned = learnedNotes.length;

    const countLearnedSince = start => learnedNotes.filter(note => {
        const practice = getPractice(note);
        const time = note.learnedAt || practice.upgradedAt; 
        
        // Use explicit timestamps if your data model has them
        if (time) return dayKey(new Date(time)) >= dayKey(start);

        // Fallback: If relying on lastReviewed, only count it if the note was actually created 
        // within this timeframe to prevent old notes from skewing today's stats.
        if (practice.lastReviewed && note.created >= start.getTime()) {
            return dayKey(new Date(practice.lastReviewed)) >= dayKey(start);
        }
        return false;
    }).length;

    const learnedCounts = {
        total: totalLearned,
        today: countLearnedSince(todayStart),
        week: countLearnedSince(weekStart),
        month: countLearnedSince(cutoff)
    };

    const dailyState = getDailyGoalState(groups);
    const streaks = getStreaks(dailyState);
    
    const groupProgress = notes.length
        ? Math.round(notes.reduce((total, note) => total + (rankInfo[getPractice(note).status].rank - 1) / 4, 0) / notes.length * 100)
        : 0;
    const weeklyBaseline = dailyState.weeklyBaselines[group.id] || 0;
    const recentProgress = Math.round((groupProgress - weeklyBaseline));
    
    page.innerHTML = `
        <header class="page-header"><h1>Statistics</h1><p>Track your vocabulary growth</p></header>
        <section class="stats-group-picker" aria-label="Statistics group selection">
            <button class="stats-arrow" type="button" aria-label="Previous statistics group"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 19l-7-7 7-7"></path></svg></button>
            <div><strong>${escapeHtml(group.name)}</strong><span>${notes.length} total notes</span></div>
            <button class="stats-arrow" type="button" aria-label="Next statistics group"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"></path></svg></button>
        </section>
        <section class="stats-learning-panel" aria-label="Learning activity">
            <div class="stats-learning-counts">
                <h2>Gained this week</h2>
                <strong>Total: ${learnedCounts.total}</strong>
                <strong>Today: +${learnedCounts.today}</strong>
                <strong>This Week: +${learnedCounts.week}</strong>
                <strong>Last 28 Days: +${learnedCounts.month}</strong>
            </div>
            <div class="stats-streaks"><div><span>Current Streak</span><strong>${streaks.current} ${streaks.current === 1 ? 'Day' : 'Days'}</strong></div><div><span>Best Streak</span><strong>${streaks.best} ${streaks.best === 1 ? 'Day' : 'Days'}</strong></div></div>
        </section>
        <section class="stats-summary" aria-label="Vocabulary summary">
            <div class="stats-summary-heading"><span>Notes created</span><div class="custom-select stats-range-select" id="stats-range"><button type="button" class="select-trigger" aria-haspopup="listbox" aria-expanded="false">${statisticsRange === '28' ? '28 days' : 'Total'}</button><ul class="select-options" role="listbox" aria-label="Statistics range"><li role="option" tabindex="-1" aria-selected="${statisticsRange === '28' ? 'true' : 'false'}" data-value="28">28 days</li><li role="option" tabindex="-1" aria-selected="${statisticsRange === 'total' ? 'true' : 'false'}" data-value="total">Total</li></ul></div></div>
            <div class="stats-chart-total"><strong>${selectedNotesTotal}</strong><span>${statisticsRange === '28' ? 'notes in the last 28 days' : 'notes created all time'}</span></div>
            <div class="stats-chart-wrap"><canvas id="notes-created-chart" aria-label="Notes created by day" role="img"></canvas></div>
        </section>
        <section class="stats-metric-carousel" aria-label="Statistics monitors">
            <div class="stats-metric green"><small>Group progress</small><strong>${groupProgress}%</strong><span>Mastery average</span></div>
            <div class="stats-metric cyan">
                <small>Group state</small>
                <strong>+${recentProgress}%</strong>
                <span>Gained this week</span>
            </div>
        </section>`;

    const arrows = page.querySelectorAll('.stats-group-picker .stats-arrow');
    arrows[0].onclick = () => { statisticsGroupIndex = (statisticsGroupIndex - 1 + groups.length) % groups.length; renderStatistics(); };
    arrows[1].onclick = () => { statisticsGroupIndex = (statisticsGroupIndex + 1) % groups.length; renderStatistics(); };
    const rangeSelect = page.querySelector('#stats-range');
    const rangeTrigger = rangeSelect.querySelector('.select-trigger');
    const rangeOptions = rangeSelect.querySelector('.select-options');
    const closeRangeOptions = () => {
        rangeSelect.classList.remove('open');
        rangeTrigger.setAttribute('aria-expanded', 'false');
    };
    rangeTrigger.onclick = () => {
        const isOpen = rangeSelect.classList.toggle('open');
        rangeTrigger.setAttribute('aria-expanded', String(isOpen));
    };
    rangeOptions.onclick = event => {
        const option = event.target.closest('[role="option"]');
        if (!option) return;
        statisticsRange = option.dataset.value;
        closeRangeOptions();
        renderStatistics();
    };
    rangeTrigger.onkeydown = event => {
        if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            rangeSelect.classList.add('open');
            rangeTrigger.setAttribute('aria-expanded', 'true');
        } else if (event.key === 'Escape') {
            closeRangeOptions();
        }
    };
    page.onclick = event => {
        if (!rangeSelect.contains(event.target)) closeRangeOptions();
    };
    const canvas = page.querySelector('#notes-created-chart');
    const drawChart = () => {
        const bounds = canvas.getBoundingClientRect();
        if (!bounds.width || !bounds.height) return;
        const ratio = window.devicePixelRatio || 1;
        canvas.width = Math.round(bounds.width * ratio);
        canvas.height = Math.round(bounds.height * ratio);
        const context = canvas.getContext('2d');
        context.scale(ratio, ratio);
        const width = bounds.width;
        const height = bounds.height;
        const inset = 8;
        const max = chartValues.reduce((largest, value) => Math.max(largest, value), 1);
        const points = chartValues.map((value, index) => ({
            x: inset + index * (width - inset * 2) / Math.max(1, chartValues.length - 1),
            y: height - inset - value / max * (height - inset * 2)
        }));
        const fill = context.createLinearGradient(0, 0, 0, height);
        fill.addColorStop(0, 'rgba(56, 189, 248, .34)');
        fill.addColorStop(1, 'rgba(56, 189, 248, 0)');
        context.beginPath();
        points.forEach((point, index) => index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y));
        context.lineTo(points[points.length - 1].x, height - inset);
        context.lineTo(points[0].x, height - inset);
        context.closePath();
        context.fillStyle = fill;
        context.fill();
        context.beginPath();
        points.forEach((point, index) => index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y));
        context.strokeStyle = '#38bdf8';
        context.lineWidth = 2;
        context.stroke();
        context.fillStyle = '#909090';
        context.font = '12px Segoe UI, sans-serif';
        context.textAlign = 'right';
        context.fillText(String(chartDays[chartDays.length - 1].getDate()), width - inset, height - 1);
    };
    drawChart();
    statisticsChartObserver = 'ResizeObserver' in window ? new ResizeObserver(drawChart) : null;
    statisticsChartObserver?.observe(canvas);
}

    function init() {
        ensureEnglishGroup();
        renderCrystalBalance();
        initMenu();
        if ('serviceWorker' in navigator && location.protocol !== 'file:') {
            navigator.serviceWorker.register('service-worker.js')
                .then(() => {
                    console.log('Service Worker registered');
                })
                .catch(err => {
                    console.error('Service Worker failed:', err);
                });
        }
        const achievementsToggle = document.getElementById('achievements-toggle');
        achievementsToggle?.addEventListener('click', () => {
            renderAchievements();
            document.getElementById('achievements-screen').hidden = false;
            const achievementsScreen = document.getElementById('achievements-screen');
            achievementsScreen.hidden = false;
            achievementsScreen.classList.remove('view-enter');
            requestAnimationFrame(() => achievementsScreen.classList.add('view-enter'));
            achievementsToggle.setAttribute('aria-expanded', 'true');
            document.body.classList.add('achievements-open', 'modal-open');
        });
        document.getElementById('achievements-screen')?.addEventListener('click', event => {
            if (event.target.id === 'achievements-screen') closeAchievements();
        });
        checkAchievements();
        const clock = document.getElementById('app-clock');
        const updateClock = () => {
            if (clock) clock.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
        };
        updateClock();
        setInterval(updateClock, 60000);

        const settingsToggle = document.getElementById('settings-toggle');
        const settingsScreen = document.getElementById('settings-screen');
        const closeSettings = () => {
            if (!settingsScreen) return;
            settingsScreen.hidden = true;
            settingsToggle?.setAttribute('aria-expanded', 'false');
            document.body.classList.remove('settings-open');
            document.body.classList.remove('modal-open');
        };
        settingsToggle?.setAttribute('aria-label', 'Open menu');
        document.getElementById('settings-close')?.addEventListener('click', closeSettings);
        document.getElementById('settings-reset-statistics')?.addEventListener('click', async () => {
            const confirmed = await CikkiModal.openConfirm('Are you sure you want to reset statistics?');
            if (!confirmed) return;
            CikkiStorage.resetStatistics();
            closeSettings();
        });
        if (window.CikkiAssets) {
            CikkiAssets.register().then(() => {
                document.querySelectorAll('.nav-icon, .header-icon').forEach(el => {
                    if (el.dataset.asset && IconSheet.setAssetIcon) {
                        IconSheet.setAssetIcon(el, el.dataset.asset, 256, CikkiAssets);
                        return;
                    }
                    const dx = el.getAttribute('data-x');
                    const dy = el.getAttribute('data-y');
                    const fx = el.getAttribute('data-fallback-x');
                    const fy = el.getAttribute('data-fallback-y');
                    if (dx !== null && dy !== null) IconSheet.setIcon(el, parseInt(dx, 10), parseInt(dy, 10), 256, el.dataset.sheet || 'Icons', fx === null ? undefined : parseInt(fx, 10), fy === null ? undefined : parseInt(fy, 10));
                });
                renderGroupsList();
                renderDashboard();
            }).catch(() => { renderGroupsList(); renderDashboard(); });
        } else {
            renderGroupsList();
            renderDashboard();
        }

        window.addEventListener('cikki:storage:change', () => {
            applyTheme();
            updateMenuProfile();
            checkAchievements();
            renderActivePage();
        });

        window.addEventListener('cikki:tabchange', renderActivePage);
        document.querySelectorAll('.nav-btn').forEach((btn, i) => {
            btn.addEventListener('click', () => {
                window.exitNoteSelectMode?.();
                closeSettings();
                closeAchievements();
                closeJsonDialog();
                if (i === 4) window.renderMinigames?.();
                if (window.Slider && typeof window.Slider.goToPage === 'function') {
                    window.Slider.goToPage(i, true);
                } else {
                    document.querySelectorAll('.nav-btn').forEach((b, idx) => b.classList.toggle('active', idx === i));
                }
            });
        });
    }

    function renderActivePage() {
        if (window.Slider?.getCurrentPage() !== 3) {
            statisticsChartObserver?.disconnect();
            statisticsChartObserver = null;
        }
        switch (window.Slider?.getCurrentPage()) {
            case 0: renderGroupsList(); break;
            case 1: renderPractice(); break;
            case 2: renderDashboard(); break;
            case 3: renderStatistics(); break;
            case 4: window.renderMinigames?.(); break;
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();