/* modal.js - handles group modal and note modal */
(function (global) {
    function setModalInteractionLocked(locked) {
        document.body.classList.toggle('modal-open', locked);
    }

    function autoGrowTextarea(textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = `${textarea.scrollHeight}px`;
    }

    function setupTextarea(textarea) {
        textarea.addEventListener('input', () => autoGrowTextarea(textarea));
        autoGrowTextarea(textarea);
    }

    function createNoteModalHtml() {
        const overlay = document.createElement('div');
        overlay.id = 'note-modal-overlay';
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal fullscreen" id="note-modal">
                <div style="display:flex;justify-content:space-between;align-items:center">
                    <div id="note-modal-title" style="font-weight:700;font-size:1.1rem">New Note</div>
                    <div class="note-header-actions">
                        <button id="note-cancel" class="btn note-new-action">Cancel</button>
                        <button id="note-save" class="btn note-new-action">Save</button>
                        <button id="note-delete" class="modal-delete-btn" aria-label="Delete note">Delete</button>
                        <button id="note-close" class="modal-close-btn" aria-label="Close note editor">×</button>
                    </div>
                </div>
                <div class="modal-body">

                    <div>
                        <div class="field-label">Word</div>
                        <textarea id="note-title" class="flat-input large" rows="1" placeholder="Word"></textarea>
                    </div>

                    <div id="note-translation-section">
                        <div class="field-label">Translation</div>
                        <textarea id="note-translation" class="flat-input" rows="1" placeholder="Translation"></textarea>
                    </div>

                    <div class="note-rating-section">
                        <div class="field-label">Rating</div>
                        <div id="note-rating" class="note-rating-input" role="group" aria-label="Rate this note">
                            ${Array.from({ length: 5 }, (_, index) => `<button type="button" class="note-rating-star" data-rating="${index + 1}" aria-label="${index + 1} star" aria-pressed="false">☆</button>`).join('')}
                        </div>
                    </div>

                    <div id="note-extra-fields" style="margin-top:8px; display:flex; flex-direction:column; gap:8px"></div>
                    <div style="margin-top:12px; display:flex; justify-content:stretch; align-items:center">
                        <button id="note-add-field" class="btn">Add</button>
                    </div>

                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        return overlay;
    }

    function openChoiceModal(title, message, choices) {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay open choice-overlay';
        const box = document.createElement('div');
        box.className = 'modal open choice-modal';
        box.innerHTML = `
            <div class="choice-title">${title}</div>
            <div class="choice-message">${message}</div>
            <div class="choice-actions"></div>
        `;
        overlay.appendChild(box);
        document.body.appendChild(overlay);

        const actions = box.querySelector('.choice-actions');
        return new Promise(resolve => {
            function close(choice) {
                overlay.remove();
                resolve(choice);
            }

            choices.forEach(choice => {
                const button = document.createElement('button');
                button.className = 'btn';
                button.textContent = choice.label;
                button.onclick = () => close(choice.value);
                actions.appendChild(button);
            });
            overlay.onclick = event => {
                if (event.target === overlay) close('cancel');
            };
        });
    }

    let noteOverlay = null;

    function openNoteModal(opts) {
        // opts: { groupId, note }
        if (!noteOverlay) noteOverlay = createNoteModalHtml();
        const overlay = noteOverlay;
        const modal = overlay.querySelector('.modal');

        overlay.classList.add('open');
        modal.classList.add('open');
        setModalInteractionLocked(true);

        // elements
        const title = overlay.querySelector('#note-title');
        const translation = overlay.querySelector('#note-translation');
        const noteTitle = overlay.querySelector('#note-modal-title');
        const extra = overlay.querySelector('#note-extra-fields');
        const translationSection = overlay.querySelector('#note-translation-section');
        let translationRemoved = Boolean(opts && opts.note && opts.note.translationRemoved);
        let rating = Number.isInteger(opts && opts.note && opts.note.rating)
            ? Math.max(0, Math.min(5, opts.note.rating))
            : 0;
        const practiceLabels = { new: 'New', familiar: 'Familiar', memorized: 'Memorized', mastered: 'Mastered', unforgetable: 'Unforgetable' };

        function renderRating() {
            overlay.querySelectorAll('.note-rating-star').forEach(button => {
                const selected = Number(button.dataset.rating) <= rating;
                button.textContent = selected ? '★' : '☆';
                button.classList.toggle('is-selected', selected);
                button.setAttribute('aria-pressed', String(Number(button.dataset.rating) === rating));
            });
        }

        overlay.querySelectorAll('.note-rating-star').forEach(button => {
            button.addEventListener('click', () => {
                rating = Number(button.dataset.rating);
                renderRating();
            });
        });
        renderRating();

        function readNote() {
            const fields = [];
            Array.from(extra.children).forEach(row => {
                const textareas = row.querySelectorAll('textarea');
                if (textareas.length >= 2) {
                    const label = textareas[0].value.trim();
                    const value = textareas[1].value.trim();
                    if (label || value) fields.push({ label, value });
                }
            });
            return {
                title: title.value.trim(),
                translation: translation.value.trim(),
                translationRemoved,
                rating,
                fields,
                practice: {
                    status: opts && opts.note && opts.note.practice && practiceLabels[opts.note.practice.status]
                        ? opts.note.practice.status
                        : 'new',
                    reviews: opts && opts.note && opts.note.practice ? opts.note.practice.reviews || 0 : 0,
                    lastReviewed: opts && opts.note && opts.note.practice ? opts.note.practice.lastReviewed || null : null,
                    recallHistory: opts && opts.note && opts.note.practice ? opts.note.practice.recallHistory || [] : []
                }
            };
        }

        function closeEditor(note) {
            modal.classList.remove('open');
            setModalInteractionLocked(false);
            setTimeout(() => overlay.classList.remove('open'), 120);
            resolveNote(note);
        }

        let resolveNote;

        // populate
        extra.innerHTML = '';
        if (opts && opts.note) {
            noteTitle.textContent = 'Edit Note';
            title.value = opts.note.title || '';
            translation.value = opts.note.translation || '';
            if (translationRemoved) translationSection.remove();
            // practiceStatus.textContent = practiceLabels[opts.note.practice?.status] || 'New';
            if (opts.note.fields && Array.isArray(opts.note.fields)) {
                opts.note.fields.forEach(f => {
                    const row = document.createElement('div');
                    row.className = 'extra-field';
                    const k = document.createElement('textarea');
                    k.className = 'flat-input'; 
                    k.rows = 1;
                    k.placeholder = 'Label'; 
                    k.value = f.label || '';
                    
                    const v = document.createElement('textarea');
                    v.className = 'flat-input'; 
                    v.rows = 1;
                    v.placeholder = 'Value'; 
                    v.value = f.value || '';
                    
                    row.appendChild(k); row.appendChild(v);
                    extra.appendChild(row);
                    setupTextarea(k);
                    setupTextarea(v);
                    attachFieldLongPress(row);
                });
            }
        } else {
            noteTitle.textContent = 'New Note';
            title.value = '';
            translation.value = '';
            // practiceStatus.textContent = 'New';
        }

        overlay.querySelectorAll('.note-new-action').forEach(button => {
            button.hidden = Boolean(opts && opts.note);
        });
        overlay.querySelector('#note-delete').hidden = !opts || !opts.note;
        overlay.querySelector('#note-close').hidden = !opts || !opts.note;

        // add field button handler
        overlay.querySelector('#note-add-field').onclick = () => {
            const row = document.createElement('div');
            row.className = 'extra-field';
            const k = document.createElement('textarea');
            k.className = 'flat-input'; 
            k.rows = 1;
            k.placeholder = 'Label';
            
            const v = document.createElement('textarea');
            v.className = 'flat-input'; 
            v.rows = 1;
            v.placeholder = 'Value';
            
            row.appendChild(k); row.appendChild(v);
            extra.appendChild(row);
            setupTextarea(k);
            setupTextarea(v);
            attachFieldLongPress(row);
        };

        setupTextarea(title);
        if (!translationRemoved) {
            setupTextarea(translation);
            attachSectionLongPress(translationSection);
        }

        function attachSectionLongPress(section) {
            let timer = null;
            const clearTimer = () => {
                if (timer) clearTimeout(timer);
                timer = null;
            };
            section.addEventListener('pointerdown', () => {
                timer = setTimeout(async () => {
                    timer = null;
                    const confirmed = await openConfirm('Are you sure you want to delete the Translation section?');
                    if (confirmed) {
                        translationRemoved = true;
                        section.remove();
                    }
                }, 600);
            });
            ['pointerup', 'pointercancel', 'pointerleave'].forEach(eventName => {
                section.addEventListener(eventName, clearTimer);
            });
            section.addEventListener('contextmenu', event => event.preventDefault());
        }

        function attachFieldLongPress(row) {
            let timer = null;
            const clearTimer = () => {
                if (timer) clearTimeout(timer);
                timer = null;
            };
            row.addEventListener('pointerdown', () => {
                timer = setTimeout(async () => {
                    timer = null;
                    const choice = await openChoiceModal(
                        'Delete field?',
                        'This field will be removed from the note.',
                        [
                            { label: 'Delete', value: 'delete' },
                            { label: 'Cancel', value: 'cancel' }
                        ]
                    );
                    if (choice === 'delete') row.remove();
                }, 600);
            });
            ['pointerup', 'pointercancel', 'pointerleave'].forEach(eventName => {
                row.addEventListener(eventName, clearTimer);
            });
            row.addEventListener('contextmenu', event => event.preventDefault());
        }

        // focus first input for mobile
        setTimeout(() => { try { title.focus(); } catch (e) {} }, 120);

        return new Promise(resolve => {
            resolveNote = resolve;
            const initial = JSON.stringify(readNote());
            const saveNote = () => ({
                id: opts && opts.note ? opts.note.id : 'n' + Date.now(),
                ...readNote(),
                created: opts && opts.note ? opts.note.created : Date.now()
            });
            overlay.querySelector('#note-delete').onclick = async () => {
                const choice = await openChoiceModal(
                    'Delete note?',
                    'Are you sure you want to delete this note?',
                    [
                        { label: 'Delete', value: 'delete' },
                        { label: 'Cancel', value: 'cancel' }
                    ]
                );
                if (choice === 'delete') closeEditor({ deleted: true, id: opts.note.id });
            };
            overlay.querySelector('#note-cancel').onclick = () => closeEditor(null);
            overlay.querySelector('#note-save').onclick = () => closeEditor(saveNote());
            overlay.querySelector('#note-close').onclick = async () => {
                if (JSON.stringify(readNote()) === initial) {
                    closeEditor(null);
                    return;
                }

                const choice = await openChoiceModal(
                    'Unsaved changes',
                    'Do you want to save your changes?',
                    [
                        { label: 'Save', value: 'save' },
                        { label: 'Cancel', value: 'cancel' },
                        { label: 'Leave', value: 'leave' }
                    ]
                );
                if (choice === 'save') {
                    closeEditor(saveNote());
                } else if (choice === 'leave') {
                    closeEditor(null);
                }
            };
        });
    }

    // group modal uses existing markup in index.html
    function openGroupModal(existing) {
        const overlay = document.getElementById('modal-overlay');
        const modal = document.getElementById('modal');
        const nameInput = document.getElementById('group-name');
        const title = document.getElementById('modal-title');
        const presetContainer = document.getElementById('icon-presets');

        // default selections
        let selectedColor = 'lime';
        let selectedIcon = { x: 0, y: 0 };

        if (existing) {
            title.textContent = 'Edit Group';
            nameInput.value = existing.name || '';
            selectedColor = existing.color || selectedColor;
            selectedIcon = existing.icon || selectedIcon;
        } else {
            title.textContent = 'New Group';
            nameInput.value = '';
        }

        // wire color swatches
        document.querySelectorAll('.color-swatch').forEach(s => {
            s.classList.toggle('selected', s.getAttribute('data-color') === selectedColor);
            s.onclick = () => {
                selectedColor = s.getAttribute('data-color');
                document.querySelectorAll('.color-swatch').forEach(ss => ss.classList.remove('selected'));
                s.classList.add('selected');
            };
        });

        // build presets
        const presets = [
            { name: 'Gaming', asset: 'gaming' },
            { name: 'Japanese', asset: 'japanese' },
            { name: 'Pen', asset: 'pen' },
            { name: 'Lighting', asset: 'lighting' },
            { name: 'Card', asset: 'card' },
            { name: 'Book', asset: 'book' },
            { name: 'Profile', asset: 'profile' }
        ];
        presetContainer.innerHTML = '';
        presets.forEach(p => {
            const cell = window.CikkiAssets?.getCell('Icons', p.asset) || { x: 0, y: 0 };
            const d = document.createElement('div');
            d.className = 'preset';
            d.title = p.name;
            d.setAttribute('aria-label', p.name);
            d.setAttribute('role', 'button');
            const base = window.CikkiAssets?.sheets.Icons.coordinateBase || 0;
            const storedX = cell.x - base;
            const storedY = cell.y - base;
            d.setAttribute('data-x', storedX);
            d.setAttribute('data-y', storedY);
            if (storedX === selectedIcon.x && storedY === selectedIcon.y) d.classList.add('selected');
            d.onclick = () => {
                selectedIcon = { x: storedX, y: storedY };
                presetContainer.querySelectorAll('.preset').forEach(el => el.classList.remove('selected'));
                d.classList.add('selected');
            };
            presetContainer.appendChild(d);
            // draw icon into preset when IconSheet available
            if (window.IconSheet) {
                if (window.CikkiAssets?.getCell('Icons', p.asset)) IconSheet.setAssetIcon(d, p.asset, 40, CikkiAssets);
                else IconSheet.setIcon(d, cell.x, cell.y, 40);
            }
        });

        overlay.classList.add('open');
        setModalInteractionLocked(true);
        requestAnimationFrame(() => modal.classList.add('open'));

        return new Promise(resolve => {
            document.getElementById('modal-cancel').onclick = () => {
                modal.classList.remove('open');
                setModalInteractionLocked(false);
                setTimeout(() => overlay.classList.remove('open'), 220);
                resolve(null);
            };
            document.getElementById('modal-save').onclick = () => {
                const name = nameInput.value.trim() || 'Untitled';
                modal.classList.remove('open');
                setModalInteractionLocked(false);
                setTimeout(() => overlay.classList.remove('open'), 220);
                resolve({ name, color: selectedColor, icon: selectedIcon });
            };
        });
    }

    function openConfirm(message) {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay open';
        setModalInteractionLocked(true);
        const box = document.createElement('div');
        box.className = 'modal open confirm-modal';
        box.style.width = '280px';
        box.innerHTML = `
            <div class="confirm-content">
                <div class="confirm-message">${message}</div>
                <div class="confirm-actions">
                    <button id="confirm-no" class="btn">No</button>
                    <button id="confirm-yes" class="btn">Yes</button>
                </div>
            </div>
        `;
        overlay.appendChild(box);
        document.body.appendChild(overlay);

        return new Promise(resolve => {
            function cleanup() {
                setModalInteractionLocked(false);
                if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
            }
            overlay.querySelector('#confirm-no').onclick = () => { cleanup(); resolve(false); };
            overlay.querySelector('#confirm-yes').onclick = () => { cleanup(); resolve(true); };
            overlay.addEventListener('click', (ev) => { if (ev.target === overlay) { cleanup(); resolve(false); } });
        });
    }

    window.CikkiModal = { openChoiceModal, openConfirm, openGroupModal, openNoteModal };
})(window);