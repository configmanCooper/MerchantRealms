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
        father: '\u{1F468}\u{1F3FD}', mother: '\u{1F469}\u{1F3FC}',
        father_edmund: '\u{1F468}\u{1F3FD}', mother_margret: '\u{1F469}\u{1F3FC}',
        edmund: '\u{1F468}\u{1F3FD}', margret: '\u{1F469}\u{1F3FC}',
        harlan: '\u{1F9D4}\u{1F3FC}', lord_calder: '\u{1F934}', seraphine: '\u{1F9D9}\u200D\u2640\uFE0F',
        king_aldric: '\u{1F451}', lady_elowen: '\u{1F478}', general_theron: '\u2694\uFE0F',
        count_rask: '\u{1F98A}', korvathi_commander: '\u{1F480}',
        narrator: '\u{1F4DC}', town_crier: '\u{1F4E2}', guild_keeper: '\u{1F9D1}\u200D\u{1F4BC}'
    };

    var SPEAKER_COLORS = {
        father: '#d4a843', mother: '#d4a843',
        father_edmund: '#d4a843', mother_margret: '#d4a843',
        edmund: '#d4a843', margret: '#d4a843',
        harlan: '#5588cc', lord_calder: '#5588cc', seraphine: '#bb88dd',
        king_aldric: '#ffd700', lady_elowen: '#5588cc', general_theron: '#cc6633',
        count_rask: '#cc4444', korvathi_commander: '#cc4444',
        narrator: '#aaa', town_crier: '#aaa', guild_keeper: '#88aa66'
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
    var _currentAudio = null;    // currently playing Audio element (pre-gen MP3)

    // ── TTS Voice System ──────────────────────────────────────
    var _ttsEnabled = true;      // on by default
    var _ttsReady = false;
    var _ttsVoices = [];
    var _ttsMaleVoice = null;
    var _ttsFemaleVoice = null;

    // Voice profiles: { rate, pitch, volume, preferFemale }
    // Tuned for Windows Neural/Natural voices which handle rate/pitch more naturally
    var VOICE_PROFILES = {
        father:              { rate: 0.88, pitch: 0.85, volume: 1.0, preferFemale: false },
        father_edmund:       { rate: 0.88, pitch: 0.85, volume: 1.0, preferFemale: false },
        mother:              { rate: 1.0,  pitch: 1.1,  volume: 1.0, preferFemale: true  },
        mother_margret:      { rate: 1.0,  pitch: 1.1,  volume: 1.0, preferFemale: true  },
        harlan:              { rate: 1.02, pitch: 0.95, volume: 1.0, preferFemale: false },
        narrator:            { rate: 0.92, pitch: 1.0,  volume: 0.85, preferFemale: false },
        king_aldric:         { rate: 0.85, pitch: 0.9,  volume: 1.0, preferFemale: false },
        lord_calder:         { rate: 0.88, pitch: 0.92, volume: 1.0, preferFemale: false },
        lady_elowen:         { rate: 0.92, pitch: 1.08, volume: 1.0, preferFemale: true  },
        seraphine:           { rate: 0.9,  pitch: 1.15, volume: 0.95, preferFemale: true },
        general_theron:      { rate: 0.9,  pitch: 0.82, volume: 1.0, preferFemale: false },
        count_rask:          { rate: 0.98, pitch: 0.88, volume: 1.0, preferFemale: false },
        korvathi_commander:  { rate: 0.82, pitch: 0.78, volume: 1.0, preferFemale: false },
        guild_keeper:        { rate: 0.98, pitch: 0.95, volume: 1.0, preferFemale: false },
        town_crier:          { rate: 1.05, pitch: 1.05, volume: 1.0, preferFemale: false }
    };

    // Default profiles for unknown speakers
    var DEFAULT_MALE   = { rate: 0.95, pitch: 0.9,  volume: 1.0, preferFemale: false };
    var DEFAULT_FEMALE = { rate: 0.95, pitch: 1.2,  volume: 1.0, preferFemale: true  };

    function _initTTS() {
        if (typeof speechSynthesis === 'undefined') return;
        function _pickVoices() {
            _ttsVoices = speechSynthesis.getVoices();
            if (!_ttsVoices || _ttsVoices.length === 0) return;
            _ttsReady = true;

            // Filter to English voices
            var enVoices = _ttsVoices.filter(function(v) { return v.lang && v.lang.indexOf('en') === 0; });
            if (enVoices.length === 0) enVoices = _ttsVoices;

            // Prioritize Neural/Natural/Online voices (much higher quality)
            var naturalVoices = enVoices.filter(function(v) {
                var n = v.name.toLowerCase();
                return n.indexOf('natural') !== -1 || n.indexOf('neural') !== -1 || n.indexOf('online') !== -1;
            });

            // Pick from natural voices first, fall back to all English voices
            var malePool = naturalVoices.length > 0 ? naturalVoices : enVoices;
            var femalePool = naturalVoices.length > 0 ? naturalVoices : enVoices;

            // Male voice preferences (in order): Guy, Andrew, Ryan, Mark, David, Eric, Christopher
            var malePrefs = ['guy', 'andrew', 'ryan', 'mark', 'david', 'eric', 'christopher', 'james', 'daniel', 'george'];
            // Female voice preferences (in order): Jenny, Aria, Sara, Zira, Hazel, Susan, Samantha
            var femalePrefs = ['jenny', 'aria', 'sara', 'zira', 'hazel', 'susan', 'samantha', 'karen', 'fiona', 'victoria'];

            _ttsMaleVoice = null;
            _ttsFemaleVoice = null;

            // Try preferred names in natural voices first, then all
            for (var mp = 0; mp < malePrefs.length && !_ttsMaleVoice; mp++) {
                for (var i = 0; i < malePool.length; i++) {
                    if (malePool[i].name.toLowerCase().indexOf(malePrefs[mp]) !== -1) {
                        _ttsMaleVoice = malePool[i]; break;
                    }
                }
            }
            for (var fp = 0; fp < femalePrefs.length && !_ttsFemaleVoice; fp++) {
                for (var j = 0; j < femalePool.length; j++) {
                    if (femalePool[j].name.toLowerCase().indexOf(femalePrefs[fp]) !== -1) {
                        _ttsFemaleVoice = femalePool[j]; break;
                    }
                }
            }

            // If still no match from preferred names, grab any natural voice
            if (!_ttsMaleVoice && naturalVoices.length > 0) _ttsMaleVoice = naturalVoices[0];
            if (!_ttsFemaleVoice && naturalVoices.length > 1) _ttsFemaleVoice = naturalVoices[1];
            if (!_ttsFemaleVoice && naturalVoices.length > 0) _ttsFemaleVoice = naturalVoices[0];

            // Final fallback to any English voice
            if (!_ttsMaleVoice) _ttsMaleVoice = enVoices[0];
            if (!_ttsFemaleVoice) _ttsFemaleVoice = enVoices.length > 1 ? enVoices[1] : enVoices[0];
        }
        // Voices may load asynchronously
        _pickVoices();
        if (speechSynthesis.onvoiceschanged !== undefined) {
            speechSynthesis.onvoiceschanged = _pickVoices;
        }
    }

    function _speakLine(text, speakerKey) {
        if (!_ttsEnabled) return;
        _stopSpeech();

        // Try pre-generated Kokoro MP3 first
        var dialogKey = _currentDialog ? _currentDialog._dialogKey : null;
        if (dialogKey) {
            var hasGender = /\{[^|]+\|[^}]+\}/.test(_currentDialog.lines[_lineIndex] || '');
            var suffix = '';
            if (hasGender) {
                var sex = (typeof Player !== 'undefined' && Player.sex === 'F') ? 'female' : 'male';
                suffix = '_' + sex;
            }
            var audioFile = 'audio/story/' + dialogKey + '_' + _lineIndex + suffix + '.mp3';
            console.log('[StoryAudio] Playing:', audioFile);
            var audio = new Audio(audioFile);
            audio.volume = 0.9;
            var playPromise = audio.play();
            if (playPromise && playPromise.then) {
                playPromise.then(function() {
                    _currentAudio = audio;
                }).catch(function(err) {
                    // MP3 not found or playback failed — fall back to browser TTS
                    _currentAudio = null;
                    _browserTTS(text, speakerKey);
                });
            } else {
                _currentAudio = audio;
            }
            return;
        }

        // No dialog key — use browser TTS directly
        _browserTTS(text, speakerKey);
    }

    function _browserTTS(text, speakerKey) {
        if (!_ttsReady || typeof speechSynthesis === 'undefined') return;

        var profile = VOICE_PROFILES[speakerKey] || (speakerKey && speakerKey.indexOf('lady') === 0 ? DEFAULT_FEMALE : DEFAULT_MALE);
        var utterance = new SpeechSynthesisUtterance(text);
        utterance.voice = profile.preferFemale ? _ttsFemaleVoice : _ttsMaleVoice;
        utterance.rate = profile.rate || 1.0;
        utterance.pitch = profile.pitch || 1.0;
        utterance.volume = profile.volume || 1.0;
        speechSynthesis.speak(utterance);
    }

    function _stopSpeech() {
        if (_currentAudio) {
            _currentAudio.pause();
            _currentAudio.currentTime = 0;
            _currentAudio = null;
        }
        if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
    }

    // Initialize TTS on load
    _initTTS();

    // ── Gender-aware text helper ───────────────────────────────

    var GENDER_TOKENS = [
        ['son', 'daughter'], ['he', 'she'], ['his', 'her'],
        ['him', 'her'], ['boy', 'girl'], ['man', 'woman'],
        ['Son', 'Daughter'], ['He', 'She'], ['His', 'Her'],
        ['Him', 'Her'], ['Boy', 'Girl'], ['Man', 'Woman']
    ];

    function _genderReplace(text) {
        var gender = (typeof Player !== 'undefined' && Player.sex === 'F') ? 'female' : 'male';
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
                '<div style="display:flex;align-items:center;gap:8px;">' +
                    '<div id="sdSpeaker" style="flex:1;"></div>' +
                    '<button id="sdTtsToggle" title="Toggle voice narration" style="' +
                        'background:none;border:1px solid rgba(180,160,120,0.4);border-radius:4px;' +
                        'color:#e8dcc8;font-size:1.1rem;cursor:pointer;padding:2px 6px;opacity:0.7;' +
                        'transition:opacity 0.2s;" >' +
                        (_ttsEnabled ? '\u{1F50A}' : '\u{1F507}') +
                    '</button>' +
                '</div>' +
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
            if (e.target.id === 'sdTtsToggle') return;
            if (_typing) {
                _skipTypewriter();
            }
        });

        document.getElementById('sdContinue').addEventListener('click', function(e) {
            e.stopPropagation();
            _advance();
        });

        // TTS toggle
        document.getElementById('sdTtsToggle').addEventListener('click', function(e) {
            e.stopPropagation();
            _ttsEnabled = !_ttsEnabled;
            this.textContent = _ttsEnabled ? '\u{1F50A}' : '\u{1F507}';
            this.title = _ttsEnabled ? 'Voice narration ON — click to mute' : 'Voice narration OFF — click to unmute';
            if (!_ttsEnabled) _stopSpeech();
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
                    if (typeof cb === 'function') {
                        cb();
                    } else if (typeof cb === 'string') {
                        // Map string actions to story mode functions
                        if (cb === 'path_diplomacy' && typeof StoryMode !== 'undefined' && StoryMode.setWarPath) {
                            StoryMode.setWarPath('diplomatic');
                        } else if (cb === 'path_military' && typeof StoryMode !== 'undefined' && StoryMode.setWarPath) {
                            StoryMode.setWarPath('military');
                        }
                    }
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
        // Speak the line with character voice
        _speakLine(text, _currentDialog.speaker || _currentDialog.portrait);
    }

    // ── Show / Begin ───────────────────────────────────────────

    function _beginDialog(dialogData, startLine) {
        _ensureOverlay();
        _currentDialog = dialogData;
        _lineIndex = (typeof startLine === 'number' && startLine > 0) ? startLine : 0;

        // Portrait — try to use actual NPC portrait for dynamic skin tones
        var portraitKey = dialogData.portrait || dialogData.speaker;
        var emoji = STORY_PORTRAITS[portraitKey] || '\u{1F464}';
        // For father/mother, look up live NPC portrait (may have dynamic skin tone)
        if (portraitKey === 'father' || portraitKey === 'mother' || portraitKey === 'father_edmund' || portraitKey === 'mother_margret') {
            var _smNPCsP = (typeof Player !== 'undefined' && Player.storyMode && Player.storyMode.storyNPCs) ? Player.storyMode.storyNPCs : null;
            if (_smNPCsP) {
                var _npcIdP = (portraitKey === 'mother' || portraitKey === 'mother_margret') ? _smNPCsP.motherId : _smNPCsP.fatherId;
                if (_npcIdP && typeof Engine !== 'undefined' && Engine.findPerson) {
                    var _npcP = Engine.findPerson(_npcIdP);
                    if (_npcP && _npcP.portrait) emoji = _npcP.portrait;
                }
            }
        }
        document.getElementById('sdPortraitBox').textContent = emoji;

        // Speaker name
        var speakerEl = document.getElementById('sdSpeaker');
        var displayName = (dialogData.speaker || 'Unknown').replace(/_/g, ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); });
        // For mother/father, append their actual first name
        if (dialogData.speaker === 'mother' || dialogData.speaker === 'father') {
            var _parentName = null;
            // Try storyNPCs lookup first
            try {
                var _sm = (typeof Player !== 'undefined' && Player.storyMode) ? Player.storyMode : null;
                if (_sm && _sm.storyNPCs) {
                    var _pid = dialogData.speaker === 'mother' ? _sm.storyNPCs.motherId : _sm.storyNPCs.fatherId;
                    if (_pid && typeof Engine !== 'undefined' && Engine.findPerson) {
                        var _pnpc = Engine.findPerson(_pid);
                        if (_pnpc && _pnpc.firstName) _parentName = _pnpc.firstName;
                    }
                }
            } catch(e) { /* ignore */ }
            // Fallback: search world people by familyRole
            if (!_parentName) {
                try {
                    var _w = (typeof Engine !== 'undefined' && Engine.getWorld) ? Engine.getWorld() : null;
                    if (_w && _w.people) {
                        for (var _pi = 0; _pi < _w.people.length; _pi++) {
                            if (_w.people[_pi].familyRole === dialogData.speaker && _w.people[_pi].isStoryNPC) {
                                _parentName = _w.people[_pi].firstName;
                                break;
                            }
                        }
                    }
                } catch(e) { /* ignore */ }
            }
            if (_parentName) displayName = displayName + ' - ' + _parentName;
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

        // Play starting line
        if (dialogData.lines && _lineIndex < dialogData.lines.length) {
            _playLine(_lineIndex);
        }
    }

    function _teardown() {
        if (_typeTimer) { clearInterval(_typeTimer); _typeTimer = null; }
        _typing = false;
        _currentDialog = null;
        _lineIndex = 0;
        _stopSpeech();

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

    function showStoryDialog(dialogData, startLine) {
        if (!dialogData || !dialogData.lines || dialogData.lines.length === 0) return;
        // If a dialog is active, queue this one
        if (_currentDialog) {
            _dialogQueue.push(dialogData);
            return;
        }
        _beginDialog(dialogData, startLine);
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

    function getStoryDialogState() {
        if (!_currentDialog || !_currentDialog._dialogKey) return null;
        return {
            dialogKey: _currentDialog._dialogKey,
            lineIndex: _lineIndex
        };
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

    UI.showStoryDialog      = showStoryDialog;
    UI.closeStoryDialog     = closeStoryDialog;
    UI.isStoryDialogOpen    = isStoryDialogOpen;
    UI.getStoryDialogState  = getStoryDialogState;
    UI.queueStoryDialog     = queueStoryDialog;
    UI.setStoryTTS       = function(enabled) {
        _ttsEnabled = !!enabled;
        var btn = document.getElementById('sdTtsToggle');
        if (btn) btn.textContent = _ttsEnabled ? '\u{1F50A}' : '\u{1F507}';
        if (!_ttsEnabled) _stopSpeech();
    };

})();
