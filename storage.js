/* Storage.js - robust localStorage-backed storage for groups and notes */
(function (global) {
    const KEY = 'cikki_groups_v1';
    const CRYSTAL_KEY = 'cikki_crystals_v1';
    const ACHIEVEMENT_KEY = 'cikki_achievements_v1';
    const PROFILE_KEY = 'cikki_profile_v1';
    const THEME_KEY = 'cikki_theme_v1';
    const WELCOME_CRYSTALS_KEY = 'cikki_welcome_crystals_v1';

    function safeParse(str, fallback) {
        try {
            return JSON.parse(str);
        } catch (e) {
            return fallback;
        }
    }

    function emitChange() {
        window.dispatchEvent(new CustomEvent('cikki:storage:change'));
    }

    function normalizeDayKey(value) {
        const parts = String(value).split('-').map(Number);
        if (parts.length !== 3 || parts.some(part => !Number.isInteger(part))) return null;
        const [year, month, day] = parts;
        const date = new Date(year, month - 1, day);
        if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }

    function normalizeNote(note) {
        const practice = note && note.practice ? note.practice : {};
        const validStatuses = ['new', 'familiar', 'memorized', 'mastered', 'unforgetable'];
        const recallHistory = Array.isArray(practice.recallHistory)
            ? practice.recallHistory.filter(item => item && item.day && item.sessionId)
                .map(item => ({ day: normalizeDayKey(item.day), sessionId: String(item.sessionId) }))
                .filter(item => item.day)
            : [];
        const status = String(practice.status || 'new').toLowerCase();
        return Object.assign({}, note, {
            created: Number.isFinite(note && note.created) ? note.created : Date.now(),
            learnedAt: Number.isFinite(note && note.learnedAt) ? note.learnedAt : null,
            translationRemoved: Boolean(note && note.translationRemoved),
            rating: Number.isInteger(note && note.rating) ? Math.max(0, Math.min(5, note.rating)) : 0,
            practice: {
                status: validStatuses.includes(status) ? status : 'new',
                reviews: Number.isFinite(practice.reviews) ? practice.reviews : 0,
                failedAttempts: Number.isFinite(practice.failedAttempts) ? practice.failedAttempts : 0,
                reviewDue: practice.reviewDue || null,
                lastReviewed: practice.lastReviewed || null,
                recallHistory,
                rankHistory: Array.isArray(practice.rankHistory)
                    ? practice.rankHistory.filter(item => item && Number.isFinite(item.time) &&
                        Number.isFinite(item.fromRank) && Number.isFinite(item.toRank))
                        .map(item => ({
                            time: item.time,
                            fromRank: item.fromRank,
                            toRank: item.toRank
                        }))
                    : []
            }
        });
    }

    function normalizeGroups(groups) {
        return (Array.isArray(groups) ? groups : []).map(group => Object.assign({}, group, {
            created: Number.isFinite(group && group.created) ? group.created : Date.now(),
            icon: group.icon && Number.isInteger(group.icon.x) && Number.isInteger(group.icon.y) &&
                group.icon.x >= 0 && group.icon.x < 6 && group.icon.y >= 0 && group.icon.y < 6
                ? group.icon
                : { x: 0, y: 0 },
            notes: (group.notes || []).map(normalizeNote)
        }));
    }

    function sanitizeExportNote(note) {
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

    function noteSignature(note) {
        const source = note && typeof note === 'object' ? note : {};
        const title = String(source.title || source.word || '').trim().toLowerCase();
        const translation = String(source.translation || source.Translition || source.translition || '').trim().toLowerCase();
        const fields = Array.isArray(source.fields)
            ? source.fields.filter(field => field && (field.label || field.value))
                .map(field => ({
                    label: String(field.label || '').trim().toLowerCase(),
                    value: String(field.value || '').trim().toLowerCase()
                }))
            : [];
        return JSON.stringify({ title, translation, fields });
    }

    function createImportedNote(note, index) {
        const source = note && typeof note === 'object' ? note : {};
        return normalizeNote({
            id: `n-import-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
            title: String(source.title || source.word || '').trim(),
            translation: String(source.translation || source.Translition || source.translition || '').trim(),
            translationRemoved: Boolean(source.translationRemoved),
            rating: Number.isInteger(source.rating) ? Math.max(0, Math.min(5, source.rating)) : 0,
            fields: Array.isArray(source.fields)
                ? source.fields.filter(field => field && (field.label || field.value))
                    .map(field => ({ label: String(field.label || ''), value: String(field.value || '') }))
                : [],
            created: Date.now(),
            practice: { status: 'new', reviews: 0, lastReviewed: null, recallHistory: [] }
        });
    }

    const Storage = {
        getAchievementState() {
            const state = safeParse(localStorage.getItem(ACHIEVEMENT_KEY) || '{}', {});
            return {
                groupsCreated: Number.isFinite(state.groupsCreated) ? state.groupsCreated : 0,
                notesSaved: Number.isFinite(state.notesSaved) ? state.notesSaved : 0,
                searchesUsed: Number.isFinite(state.searchesUsed) ? state.searchesUsed : 0,
                memorizedUpgrades: Number.isFinite(state.memorizedUpgrades) ? state.memorizedUpgrades : 0,
                masteredUpgrades: Number.isFinite(state.masteredUpgrades) ? state.masteredUpgrades : 0,
                perfectSessions: Number.isFinite(state.perfectSessions) ? state.perfectSessions : 0,
                perfectSessionStreak: Number.isFinite(state.perfectSessionStreak) ? state.perfectSessionStreak : 0,
                wordGameTurns: Number.isFinite(state.wordGameTurns) ? state.wordGameTurns : 0,
                wordGameFastWords: Number.isFinite(state.wordGameFastWords) ? state.wordGameFastWords : 0,
                wordGameLastSecond: Number.isFinite(state.wordGameLastSecond) ? state.wordGameLastSecond : 0,
                claimed: Array.isArray(state.claimed) ? state.claimed : []
            };
        },
        recordAchievementEvent(type, amount = 1) {
            const state = this.getAchievementState();
            if (Object.prototype.hasOwnProperty.call(state, type)) state[type] += amount;
            localStorage.setItem(ACHIEVEMENT_KEY, JSON.stringify(state));
        },
        recordPracticeSession(perfect) {
            const state = this.getAchievementState();
            state.perfectSessionStreak = perfect ? state.perfectSessionStreak + 1 : 0;
            state.perfectSessions = Math.max(state.perfectSessions, state.perfectSessionStreak);
            localStorage.setItem(ACHIEVEMENT_KEY, JSON.stringify(state));
        },
        claimAchievement(id) {
            const state = this.getAchievementState();
            if (state.claimed.includes(id)) return false;
            state.claimed.push(id);
            localStorage.setItem(ACHIEVEMENT_KEY, JSON.stringify(state));
            return true;
        },
        getCrystals() {
            const storedAmount = localStorage.getItem(CRYSTAL_KEY);
            if (storedAmount === null || (Number(storedAmount) === 0 && !localStorage.getItem(WELCOME_CRYSTALS_KEY))) {
                localStorage.setItem(CRYSTAL_KEY, '2000');
                localStorage.setItem(WELCOME_CRYSTALS_KEY, 'true');
                return 2000;
            }
            const amount = Number(storedAmount);
            return Number.isFinite(amount) && amount >= 0 ? amount : 0;
        },
        getProfile() {
            const profile = safeParse(localStorage.getItem(PROFILE_KEY) || '{}', {});
            return {
                username: typeof profile.username === 'string' ? profile.username : '',
                logo: typeof profile.logo === 'string' ? profile.logo : '',
                color: typeof profile.color === 'string' ? profile.color : '',
                hatIndex: Number.isInteger(profile.hatIndex) ? profile.hatIndex : 0,
                money: Number.isFinite(profile.money) && profile.money >= 0 ? profile.money : 0,
                digCoinLevel: Number.isInteger(profile.digCoinLevel) && profile.digCoinLevel >= 1 && profile.digCoinLevel <= 10 ? profile.digCoinLevel : 1,
                digCoinClaimedDay: Number.isInteger(profile.digCoinClaimedDay) && profile.digCoinClaimedDay >= 0 ? profile.digCoinClaimedDay : 0
            };
        },
        saveProfile(profile) {
            const current = this.getProfile();
            const next = {
                username: typeof (profile && profile.username) === 'string'
                    ? profile.username.trim().slice(0, 32)
                    : current.username,
                logo: typeof (profile && profile.logo) === 'string' ? profile.logo : current.logo,
                color: typeof (profile && profile.color) === 'string' ? profile.color : current.color,
                hatIndex: Number.isInteger(profile && profile.hatIndex) ? profile.hatIndex : current.hatIndex,
                money: Number.isFinite(profile && profile.money) && profile.money >= 0 ? profile.money : current.money,
                digCoinLevel: Number.isInteger(profile && profile.digCoinLevel) && profile.digCoinLevel >= 1 && profile.digCoinLevel <= 10 ? profile.digCoinLevel : current.digCoinLevel,
                digCoinClaimedDay: Number.isInteger(profile && profile.digCoinClaimedDay) && profile.digCoinClaimedDay >= 0 ? profile.digCoinClaimedDay : current.digCoinClaimedDay
            };
            localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
            emitChange();
            return next;
        },
        getTheme() {
            const theme = localStorage.getItem(THEME_KEY);
            return ['default', 'blue', 'purple', 'white', 'red'].includes(theme) ? theme : 'default';
        },
        setTheme(theme) {
            const nextTheme = ['default', 'blue', 'purple', 'white', 'red'].includes(theme) ? theme : 'default';
            localStorage.setItem(THEME_KEY, nextTheme);
            emitChange();
            return nextTheme;
        },
        addCrystals(amount) {
            const nextAmount = this.getCrystals() + Math.max(0, Number(amount) || 0);
            localStorage.setItem(CRYSTAL_KEY, String(nextAmount));
            emitChange();
            return nextAmount;
        },
        spendCrystals(amount) {
            const cost = Math.max(0, Number(amount) || 0);
            const current = this.getCrystals();
            if (current < cost) return false;
            localStorage.setItem(CRYSTAL_KEY, String(current - cost));
            emitChange();
            return true;
        },
        resetStatistics() {
            const groups = this.load();
            groups.forEach(group => {
                (group.notes || []).forEach(note => {
                    note.learnedAt = null;
                    note.practice = {
                        status: 'new',
                        reviews: 0,
                        lastReviewed: null,
                        recallHistory: []
                    };
                });
            });
            return this.save(groups);
        },
        load() {
            const raw = localStorage.getItem(KEY);
            if (!raw) return [];
            const groups = normalizeGroups(safeParse(raw, []));
            try {
                localStorage.setItem(KEY, JSON.stringify(groups));
            } catch (e) {
                console.warn('Storage migration failed', e);
            }
            return groups;
        },
        save(groups) {
            try {
                localStorage.setItem(KEY, JSON.stringify(normalizeGroups(groups)));
                emitChange();
                return true;
            } catch (e) {
                console.warn('Storage.save failed', e);
                return false;
            }
        },
        exportData() {
            return normalizeGroups(this.load()).map(group => ({
                name: group.name,
                color: group.color,
                icon: group.icon,
                notes: (group.notes || []).map(sanitizeExportNote)
            }));
        },
        importDataToGroup(data, targetGroupId) {
            if (!targetGroupId) return { success: false, added: 0, skipped: 0, failed: 0 };
            const groups = this.load();
            const targetGroup = groups.find(g => g.id === targetGroupId);
            if (!targetGroup) return { success: false, added: 0, skipped: 0, failed: 0 };
            const sourceGroups = Array.isArray(data) && data.every(note => note && !Array.isArray(note.notes))
                ? [{ notes: data }]
                : Array.isArray(data)
                    ? data
                : data && Array.isArray(data.groups)
                    ? data.groups
                    : data && Array.isArray(data.notes)
                        ? [{ notes: data.notes }]
                        : [];
            const existingKeys = new Set((targetGroup.notes || []).map(note => noteSignature(note)));
            let added = 0;
            let skipped = 0;
            let failed = 0;

            const importedNotes = [];
            sourceGroups.forEach((group, groupIndex) => {
                const notes = Array.isArray(group && group.notes) ? group.notes : [];
                notes.forEach((note, noteIndex) => {
                    try {
                        const normalized = createImportedNote(note, groupIndex * 1000 + noteIndex);
                        const key = noteSignature(normalized);
                        if (existingKeys.has(key)) {
                            skipped += 1;
                            return;
                        }
                        importedNotes.push(normalized);
                        existingKeys.add(key);
                        added += 1;
                    } catch (e) {
                        failed += 1;
                    }
                });
            });

            if (!importedNotes.length && !skipped && !failed) {
                return { success: false, added: 0, skipped: 0, failed: 0 };
            }

            targetGroup.notes = (targetGroup.notes || []).concat(importedNotes);
            this.save(groups);
            return { success: true, added, skipped, failed };
        },
        importData(data) {
            const sourceGroups = Array.isArray(data) && data.every(note => note && !Array.isArray(note.notes))
                ? [{ name: 'Imported', color: 'blue', icon: { x: 0, y: 0 }, notes: data }]
                : Array.isArray(data)
                    ? data
                : data && Array.isArray(data.groups)
                    ? data.groups
                    : data && Array.isArray(data.notes)
                        ? [{ name: 'Imported', color: 'blue', icon: { x: 0, y: 0 }, notes: data.notes }]
                        : [];
            const existingGroups = this.load();
            const existingKeys = new Set();
            existingGroups.forEach(group => {
                (group.notes || []).forEach(note => existingKeys.add(noteSignature(note)));
            });

            let added = 0;
            let skipped = 0;
            let failed = 0;
            const importedGroups = [];

            sourceGroups.forEach((group, groupIndex) => {
                try {
                    const notes = [];
                    const rawNotes = Array.isArray(group && group.notes) ? group.notes : [];
                    rawNotes.forEach((note, noteIndex) => {
                        try {
                            const normalized = createImportedNote(note, groupIndex * 1000 + noteIndex);
                            const key = noteSignature(normalized);
                            if (existingKeys.has(key)) {
                                skipped += 1;
                                return;
                            }
                            notes.push(normalized);
                            existingKeys.add(key);
                            added += 1;
                        } catch (e) {
                            failed += 1;
                        }
                    });

                    if (notes.length || rawNotes.length === 0) {
                        importedGroups.push({
                            id: `g-import-${Date.now()}-${groupIndex}-${Math.random().toString(36).slice(2, 8)}`,
                            name: String((group && group.name) || 'Imported'),
                            color: (group && group.color) || 'blue',
                            icon: (group && group.icon) || { x: 0, y: 0 },
                            created: Date.now(),
                            notes
                        });
                    }
                } catch (e) {
                    failed += 1;
                }
            });

            if (!importedGroups.length && !skipped && !failed) {
                return { success: false, added: 0, skipped: 0, failed: 0 };
            }

            this.save(importedGroups.concat(existingGroups));
            return { success: true, added, skipped, failed };
        },
        clear() {
            localStorage.removeItem(KEY);
            emitChange();
        },
        getGroups() {
            return this.load();
        },
        getGroup(id) {
            const groups = this.load();
            return groups.find(g => g.id === id) || null;
        },
        addGroup(group) {
            const groups = this.load();
            groups.unshift(group);
            this.save(groups);
            if (group.id !== 'g-english') this.recordAchievementEvent('groupsCreated');
            return group;
        },
        updateGroup(id, patch) {
            const groups = this.load();
            const i = groups.findIndex(g => g.id === id);
            if (i === -1) return null;
            groups[i] = Object.assign({}, groups[i], patch);
            this.save(groups);
            return groups[i];
        },
        reorderGroups(groups) {
            try {
                localStorage.setItem(KEY, JSON.stringify(groups));
                return groups;
            } catch (e) {
                console.warn('Storage.reorderGroups failed', e);
                return null;
            }
        },
        removeGroup(id) {
            let groups = this.load();
            groups = groups.filter(g => g.id !== id);
            this.save(groups);
        },
        addNote(groupId, note) {
            const groups = this.load();
            const g = groups.find(x => x.id === groupId);
            if (!g) return null;
            g.notes = g.notes || [];
            g.notes.unshift(normalizeNote(note));
            this.save(groups);
            this.recordAchievementEvent('notesSaved');
            return note;
        },
        updateNote(groupId, noteId, patch) {
            const groups = this.load();
            const g = groups.find(x => x.id === groupId);
            if (!g || !g.notes) return null;
            const i = g.notes.findIndex(n => n.id === noteId);
            if (i === -1) return null;
            const created = g.notes[i].created;
            g.notes[i] = Object.assign({}, g.notes[i], patch, { created });
            this.save(groups);
            return g.notes[i];
        },
        updateNoteSilent(groupId, noteId, patch) {
            const groups = this.load();
            const g = groups.find(x => x.id === groupId);
            if (!g || !g.notes) return null;
            const i = g.notes.findIndex(n => n.id === noteId);
            if (i === -1) return null;
            const created = g.notes[i].created;
            g.notes[i] = Object.assign({}, g.notes[i], patch, { created });
            try {
                localStorage.setItem(KEY, JSON.stringify(groups));
                return g.notes[i];
            } catch (e) {
                console.warn('Storage.updateNoteSilent failed', e);
                return null;
            }
        },
        addNoteSilent(groupId, note) {
            const groups = this.load();
            const g = groups.find(x => x.id === groupId);
            if (!g) return null;
            g.notes = g.notes || [];
            g.notes.unshift(normalizeNote(note));
            try {
                localStorage.setItem(KEY, JSON.stringify(groups));
                this.recordAchievementEvent('notesSaved');
                return note;
            } catch (e) {
                console.warn('Storage.addNoteSilent failed', e);
                return null;
            }
        },
        removeNote(groupId, noteId) {
            const groups = this.load();
            const g = groups.find(x => x.id === groupId);
            if (!g || !g.notes) return;
            g.notes = g.notes.filter(n => n.id !== noteId);
            this.save(groups);
        },
        removeNoteSilent(groupId, noteId) {
            const groups = this.load();
            const g = groups.find(x => x.id === groupId);
            if (!g || !g.notes) return;
            g.notes = g.notes.filter(n => n.id !== noteId);
            try {
                localStorage.setItem(KEY, JSON.stringify(groups));
            } catch (e) {
                console.warn('Storage.removeNoteSilent failed', e);
            }
        }
    };

    global.CikkiStorage = Storage;
})(window);
