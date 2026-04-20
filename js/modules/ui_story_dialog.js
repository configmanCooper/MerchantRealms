// ============================================================
// Merchant Realms — Story Dialog UI Module
// Provides a cinematic dialog overlay for Story Mode with
// typewriter text, emoji portraits, choices, and queuing.
// ============================================================
(function() {
    'use strict';
    if (!window.UI) throw new Error("UI must be loaded before ui_story_dialog.js");

    // ── Portrait & Color Maps ──────────────────────────────────

    var STORY_PORTRAITS = {
        father_edmund: '\u{1F468}\u200D\u{1F527}', mother_margret: '\u{1F469}\u200D\u{1F373}',
        harlan: '\u{1F9D4}', lord_calder: '\u{1F934}', seraphine: '\u{1F9D9}\u200D\u2640\uFE0F',
        king_aldric: '\u{1F451}', lady_elowen: '\u{1F478}', general_theron: '\u2694\uFE0F',
        count_rask: '\u{1F98A}', korvathi_commander: '\u{1F480}',
        narrator: '\u{1F4DC}', town_crier: '\u{1F4E2}'
    };

    var SPEAKER_COLORS = {
        father_edmund: '#d4a843', mother_margret: '#d4a843',
        harlan: '#5588cc', lord_calder: '#5588cc', seraphine: '#bb88dd',
        king_aldric: '#ffd700', lady_elowen: '#5588cc', general_theron: '#cc6633',
        count_rask: '#cc4444', korvathi_commander: '#cc4444',
        narrator: '#aaa', town_crier: '#aaa'
    };

    // ── State ──────────────────────────────────────────────────

    var _overlay = null;         // root DOM element
    var _currentDialog = null;   // active dialogData
    var _lineIndex = 0;          // current line in lines[]
    var _typeTimer = null;       // setInterval id for typewriter
    var _charIndex = 0;          // chars revealed so far
    var _fullText = '';          // current line full text
    var _typing = false;         // true while typewriter running
    var _dialogQueue = [];       // queued dialogData objects
    var _keyHandler = null;      // bound keydown listener

    // ── Gender-aware text helper ───────────────────────────────

    var GENDER_TOKENS = [
        ['son', 'daughter'], ['he', 'she'], ['his', 'her'],
        ['him', 'her'], ['boy', 'girl'], ['man', 'woman'],
        ['Son', 'Daughter'], ['He', 'She'], ['His', 'Her'],
        ['Him', 'Her'], ['Boy', 'Girl'], ['Man', 'Woman']
    ];

    function _genderReplace(text) {
        var gender = (typeof Player !== 'undefined' && Player.gender) ? Player.gender : 'male';
        var idx = gender === 'female' ? 1 : 0;
        var result = text;
        for (var i = 0; i < GENDER_TOKENS.length; i++) {
            var pair = GENDER_TOKENS[i];
            var pattern = '{' + pair[0] + '|' + pair[1] + '}';
            while (result.indexOf(pattern) !== -1) {
                result = result.replace(pattern, pair[idx]);
            }
        }
        return result;
    }

    // ── DOM Bootstrap ──────────────────────────────────────────

    function _ensureOverlay() {
        if (_overlay) return;

        // Inject scoped styles
        var style = document.createElement('style');
        style.textContent =
            '#storyDialogOverlay{' +
                'position:fixed;left:0;right:0;bottom:0;height:auto;min-height:33.3vh;' +
                'background:rgba(15,12,8,0.92);border-top:2px solid rgba(212,168,67,0.5);' +
                'z-index:9000;display:none;flex-direction:row;align-items:flex-start;' +
                'padding:18px 24px;gap:18px;font-family:inherit;' +
                'transform:translateY(100%);transition:transform 0.35s ease-out;' +
            '}' +
            '#storyDialogOverlay.sd-visible{display:flex;transform:translateY(0);}' +
            '#sdPortraitBox{' +
                'width:80px;height:80px;min-width:80px;border-radius:8px;' +
                'background:rgba(40,35,28,0.9);border:2px solid rgba(180,160,120,0.4);' +
                'display:flex;align-items:center;justify-content:center;font-size:2.5rem;' +
                'user-select:none;flex-shrink:0;' +
            '}' +
            '#sdContent{flex:1;display:flex;flex-direction:column;gap:6px;min-width:0;}' +
            '#sdSpeaker{font-weight:bold;font-size:1.05rem;text-shadow:0 1px 3px rgba(0,0,0,0.6);}' +
            '#sdText{color:#e8dcc8;font-size:1rem;line-height:1.6;min-height:3.2em;white-space:pre-wrap;}' +
            '#sdContinue{' +
                'display:none;align-self:flex-end;margin-top:8px;cursor:pointer;' +
                'font-size:0.85rem;padding:6px 18px;' +
            '}' +
            '#sdChoices{display:none;flex-wrap:wrap;gap:8px;margin-top:10px;}' +
            '#sdChoices .sd-choice-btn{' +
                'cursor:pointer;padding:8px 18px;font-size:0.9rem;' +
                'background:rgba(40,35,28,0.85);color:#e8dcc8;' +
                'border:2px solid rgba(212,168,67,0.5);border-radius:4px;' +
                'transition:background 0.2s,border-color 0.2s;' +
            '}' +
            '#sdChoices .sd-choice-btn:hover{' +
                'background:rgba(212,168,67,0.2);border-color:rgba(212,168,67,0.85);' +
                'color:#fff;' +
            '}';
        document.head.appendChild(style);

        // Build DOM
        _overlay = document.createElement('div');
        _overlay.id = 'storyDialogOverlay';
        _overlay.innerHTML =
            '<div id="sdPortraitBox"></div>' +
            '<div id="sdContent">' +
                '<div id="sdSpeaker"></div>' +
                '<div id="sdText"></div>' +
                '<div id="sdChoices"></div>' +
                '<button id="sdContinue" class="btn-medieval">Continue ▸</button>' +
            '</div>';
        document.body.appendChild(_overlay);

        // Click overlay to skip / advance
        _overlay.addEventListener('click', function(e) {
            // Ignore clicks on choice buttons or the continue button
            if (e.target.classList.contains('sd-choice-btn')) return;
            if (e.target.id === 'sdContinue') return;
            if (_typing) {
                _skipTypewriter();
            }
        });

        document.getElementById('sdContinue').addEventListener('click', function(e) {
            e.stopPropagation();
            _advance();
        });
    }

    // ── Typewriter ─────────────────────────────────────────────

    var TYPE_INTERVAL = 1000 / 30; // ~30 chars/sec

    function _startTypewriter(text) {
        _fullText = text;
        _charIndex = 0;
        _typing = true;
        var textEl = document.getElementById('sdText');
        textEl.textContent = '';
        _hideChoicesAndContinue();

        _typeTimer = setInterval(function() {
            _charIndex++;
            textEl.textContent = _fullText.substring(0, _charIndex);
            if (_charIndex >= _fullText.length) {
                _finishTypewriter();
            }
        }, TYPE_INTERVAL);
    }

    function _skipTypewriter() {
        if (!_typing) return;
        clearInterval(_typeTimer);
        _typeTimer = null;
        document.getElementById('sdText').textContent = _fullText;
        _finishTypewriter();
    }

    function _finishTypewriter() {
        clearInterval(_typeTimer);
        _typeTimer = null;
        _typing = false;

        // If this is the last line and there are choices, show them
        if (_currentDialog && _currentDialog.choices && _currentDialog.choices.length > 0 &&
            _lineIndex >= _currentDialog.lines.length - 1) {
            _showChoices();
        } else {
            _showContinue();
        }
    }

    // ── Continue / Choices UI ──────────────────────────────────

    function _showContinue() {
        var btn = document.getElementById('sdContinue');
        btn.style.display = 'inline-block';
    }

    function _hideChoicesAndContinue() {
        document.getElementById('sdContinue').style.display = 'none';
        var choicesEl = document.getElementById('sdChoices');
        choicesEl.style.display = 'none';
        choicesEl.innerHTML = '';
    }

    function _showChoices() {
        var choicesEl = document.getElementById('sdChoices');
        choicesEl.innerHTML = '';
        var choices = _currentDialog.choices;
        for (var i = 0; i < choices.length; i++) {
            var btn = document.createElement('button');
            btn.className = 'sd-choice-btn';
            btn.textContent = choices[i].label;
            btn.setAttribute('data-choice-idx', i);
            btn.addEventListener('click', (function(choice) {
                return function(e) {
                    e.stopPropagation();
                    var cb = choice.action;
                    _closeAndDequeue();
                    if (typeof cb === 'function') cb();
                };
            })(choices[i]));
            choicesEl.appendChild(btn);
        }
        choicesEl.style.display = 'flex';
    }

    // ── Advance / Close ────────────────────────────────────────

    function _advance() {
        if (!_currentDialog) return;

        _lineIndex++;
        if (_lineIndex < _currentDialog.lines.length) {
            _playLine(_lineIndex);
        } else {
            // Last line exhausted
            _closeAndDequeue();
        }
    }

    function _closeAndDequeue() {
        var cb = _currentDialog ? _currentDialog.onComplete : null;
        _teardown();
        if (typeof cb === 'function') cb();
        // Play next queued dialog
        if (_dialogQueue.length > 0) {
            _beginDialog(_dialogQueue.shift());
        }
    }

    function _playLine(idx) {
        var line = _currentDialog.lines[idx];
        var text = _genderReplace(line);
        _startTypewriter(text);
    }

    // ── Show / Begin ───────────────────────────────────────────

    function _beginDialog(dialogData) {
        _ensureOverlay();
        _currentDialog = dialogData;
        _lineIndex = 0;

        // Portrait
        var portraitKey = dialogData.portrait || dialogData.speaker;
        var emoji = STORY_PORTRAITS[portraitKey] || '\u{1F464}';
        document.getElementById('sdPortraitBox').textContent = emoji;

        // Speaker name
        var speakerEl = document.getElementById('sdSpeaker');
        var displayName = (dialogData.speaker || 'Unknown').replace(/_/g, ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); });
        // For mother/father, append their actual first name
        if (dialogData.speaker === 'mother' || dialogData.speaker === 'father') {
            var _smNPCs = (typeof Player !== 'undefined' && Player.storyMode && Player.storyMode.storyNPCs) ? Player.storyMode.storyNPCs : null;
            if (_smNPCs) {
                var _npcId = dialogData.speaker === 'mother' ? _smNPCs.motherId : _smNPCs.fatherId;
                if (_npcId && typeof Engine !== 'undefined' && Engine.findPerson) {
                    var _npc = Engine.findPerson(_npcId);
                    if (_npc && _npc.firstName) {
                        displayName = displayName + ' - ' + _npc.firstName;
                    }
                }
            }
        }
        speakerEl.textContent = displayName;
        speakerEl.style.color = SPEAKER_COLORS[dialogData.speaker] || '#e8dcc8';

        // Show overlay with slide-up
        _overlay.style.display = 'flex';
        // Force reflow for transition
        void _overlay.offsetHeight;
        _overlay.classList.add('sd-visible');

        // Keyboard listener
        _keyHandler = function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (_typing) {
                    _skipTypewriter();
                } else if (document.getElementById('sdContinue').style.display !== 'none') {
                    _advance();
                }
            }
        };
        document.addEventListener('keydown', _keyHandler);

        // Play first line
        if (dialogData.lines && dialogData.lines.length > 0) {
            _playLine(0);
        }
    }

    function _teardown() {
        if (_typeTimer) { clearInterval(_typeTimer); _typeTimer = null; }
        _typing = false;
        _currentDialog = null;
        _lineIndex = 0;

        if (_keyHandler) {
            document.removeEventListener('keydown', _keyHandler);
            _keyHandler = null;
        }

        if (_overlay) {
            _overlay.classList.remove('sd-visible');
            _overlay.style.display = 'none';
        }
    }

    // ── Public API ─────────────────────────────────────────────

    function showStoryDialog(dialogData) {
        if (!dialogData || !dialogData.lines || dialogData.lines.length === 0) return;
        // If a dialog is active, queue this one
        if (_currentDialog) {
            _dialogQueue.push(dialogData);
            return;
        }
        _beginDialog(dialogData);
    }

    function closeStoryDialog() {
        _dialogQueue = [];
        var cb = _currentDialog ? _currentDialog.onComplete : null;
        _teardown();
        if (typeof cb === 'function') cb();
    }

    function isStoryDialogOpen() {
        return !!_currentDialog;
    }

    function queueStoryDialog(dialogData) {
        if (!dialogData || !dialogData.lines || dialogData.lines.length === 0) return;
        if (_currentDialog) {
            _dialogQueue.push(dialogData);
        } else {
            _beginDialog(dialogData);
        }
    }

    // ── Expose on UI ───────────────────────────────────────────

    UI.showStoryDialog   = showStoryDialog;
    UI.closeStoryDialog  = closeStoryDialog;
    UI.isStoryDialogOpen = isStoryDialogOpen;
    UI.queueStoryDialog  = queueStoryDialog;

})();
