/**
 * story_mode.js - Main Story Controller for Merchant Realms
 *
 * Manages the 19-chapter story campaign: quest objectives, chapter
 * progression, branching paths, NPC scripting, world-generation
 * overrides, family protection flags, and tab-button locking.
 *
 * Loaded via <script> tag. Attaches to the global `StoryMode` object.
 */
var StoryMode = (function () {
    'use strict';

    // ───────────────────────────────────────────────
    //  Story State
    // ───────────────────────────────────────────────
    var _storyState = {
        active: false,
        chapter: 0,
        path: null,           // null | 'diplomatic' | 'military'
        complete: false,
        objectives: {},       // objectiveId -> boolean
        flags: {
            suppressEncounters: true,
            suppressDisease: true,
            protectFamily: true,
            edmundInjured: false,
            edmundImprisoned: false,
            edmundFreed: false,
            margretIll: false,
            ashfordCaptured: false,
            ashfordLiberated: false,
            metLordCalder: false,
            metSeraphine: false,
            warDeclared: false
        },
        buttonsUnlocked: ['character', 'system'],
        dialogsSeen: [],
        chapterStartDay: 0
    };

    // ───────────────────────────────────────────────
    //  Chapter Definitions (0 = prologue, 1-19)
    // ───────────────────────────────────────────────
    var CHAPTERS = [
        // ── Ch 0: Prologue / Setup ──
        {
            id: 'ch0', title: 'Prologue', act: 0,
            startDialog: 'ch0_intro',
            objectives: [],
            endDialog: null,
            unlockButtons: [],
            onStart: '_onPrologueStart',
            onComplete: null
        },

        // ── Act I ──

        // Ch 1
        {
            id: 'ch1', title: 'A Birthday Gift', act: 1,
            startDialog: 'ch1_birthday_mother',
            objectives: [
                { id: 'ch1_buy_food',  type: 'buy_item',  item: 'category:food',  qty: 2, desc: 'Buy 2 food from the market', done: false },
                { id: 'ch1_buy_drink', type: 'buy_item',  item: 'water', qty: 1, desc: 'Buy a drink',                done: false }
            ],
            endDialog: 'ch1_complete',
            unlockButtons: ['actions'],
            onStart: '_onChapter1Start',
            onComplete: null
        },

        // Ch 2
        {
            id: 'ch2', title: 'The Forge', act: 1,
            startDialog: 'ch2_forge_father',
            objectives: [
                { id: 'ch2_work_shift',   type: 'work_shift',   building: 'blacksmith|smelter|toolsmith', desc: 'Work a shift at the forge', done: false }
            ],
            endDialog: 'ch2_complete',
            unlockButtons: ['business'],
            onStart: null,
            onComplete: null
        },

        // Ch 3
        {
            id: 'ch3', title: 'The Delivery', act: 1,
            startDialog: 'ch3_delivery_father',
            objectives: [
                { id: 'ch3_arrive_ferrowdale', type: 'arrive_town', town: 'Ferrowdale', desc: 'Travel to Ferrowdale',                       done: false },
                { id: 'ch3_sell_tools',        type: 'sell_item',   item: 'tools', desc: 'Deliver the tools (sell in Ferrowdale)', done: false }
            ],
            endDialog: 'ch3_complete',
            unlockButtons: ['world'],
            onStart: '_onChapter3Start',
            onComplete: null
        },

        // Ch 4
        {
            id: 'ch4', title: 'The Art of the Deal', act: 1,
            startDialog: 'ch4_harlan_teaches',
            objectives: [
                { id: 'ch4_buy_goods',  type: 'buy_item',  item: '*', qty: 1,  desc: 'Buy cheap goods in Ferrowdale',       done: false },
                { id: 'ch4_sell_goods', type: 'sell_item',  item: '*',          desc: 'Sell goods for profit in Ashford',    done: false },
                { id: 'ch4_own_gold',   type: 'own_gold',   amount: 30,         desc: 'Accumulate 30 gold',                 done: false }
            ],
            endDialog: 'ch4_complete',
            unlockButtons: [],
            onStart: null,
            onComplete: null
        },

        // Ch 5
        {
            id: 'ch5', title: 'A Place to Call Home', act: 1,
            startDialog: 'ch5_mother_housing',
            objectives: [
                { id: 'ch5_buy_housing', type: 'own_building', building: 'housing', desc: 'Acquire housing',        done: false },
                { id: 'ch5_rest',        type: 'custom',       fn: '_checkRested',  desc: 'Rest at your new home',  done: false }
            ],
            endDialog: 'ch5_complete',
            unlockButtons: [],
            onStart: null,
            onComplete: null
        },

        // Ch 6
        {
            id: 'ch6', title: 'The Apprentice', act: 1,
            startDialog: 'ch6_father_skills',
            objectives: [
                { id: 'ch6_buy_skill',  type: 'buy_skill',   skill: '*', desc: 'Learn a new skill',  done: false },
                { id: 'ch6_join_guild', type: 'join_guild',   guild: '*', desc: 'Join a guild',       done: false }
            ],
            endDialog: 'ch6_complete',
            unlockButtons: [],
            onStart: null,
            onComplete: null
        },

        // ── Act II ──

        // Ch 7
        {
            id: 'ch7', title: 'Drums of War', act: 2,
            startDialog: 'ch7_war_crier',
            objectives: [
                { id: 'ch7_read_announcement', type: 'custom', fn: '_checkWarDialogSeen', desc: 'Read the war announcement', done: false }
            ],
            endDialog: 'ch7_complete',
            unlockButtons: [],
            onStart: '_onChapter7Start',
            onComplete: null
        },

        // Ch 8
        {
            id: 'ch8', title: 'Fire and Iron', act: 2,
            startDialog: 'ch8_father_plan',
            objectives: [
                { id: 'ch8_arrive_ferrowdale', type: 'arrive_town',  town: 'Ferrowdale',                          desc: 'Travel to Ferrowdale',              done: false },
                { id: 'ch8_own_iron',          type: 'own_building',  building: 'iron_mine|smelter',               desc: 'Build an iron mine or smelter',     done: false }
            ],
            endDialog: 'ch8_complete',
            unlockButtons: [],
            onStart: null,
            onComplete: null
        },

        // Ch 9
        {
            id: 'ch9', title: 'Roads of Fortune', act: 2,
            startDialog: 'ch9_father_caravan',
            objectives: [
                { id: 'ch9_send_caravan', type: 'send_caravan', desc: 'Send a trade caravan', done: false }
            ],
            endDialog: 'ch9_complete',
            unlockButtons: [],
            onStart: null,
            onComplete: null
        },

        // Ch 10
        {
            id: 'ch10', title: 'Bread and Butter', act: 2,
            startDialog: 'ch10_mother_bread',
            objectives: [
                { id: 'ch10_own_mill',    type: 'own_building', building: 'flour_mill|bakery', desc: 'Build a flour mill or bakery', done: false },
                { id: 'ch10_hire_worker', type: 'hire_worker',                                  desc: 'Hire a worker',               done: false }
            ],
            endDialog: 'ch10_complete',
            unlockButtons: [],
            onStart: null,
            onComplete: null
        },

        // Ch 11
        {
            id: 'ch11', title: 'Fever and Steel', act: 2,
            startDialog: 'ch11_father_injury',
            objectives: [
                { id: 'ch11_treat_father', type: 'treat_person', person: 'Edmund',  desc: 'Treat father\'s injury',  done: false },
                { id: 'ch11_treat_mother', type: 'treat_person', person: 'Margret', desc: 'Treat mother\'s illness', done: false }
            ],
            endDialog: 'ch11_complete',
            unlockButtons: [],
            onStart: '_onChapter11Start',
            onComplete: '_onChapter11Complete'
        },

        // Ch 12
        {
            id: 'ch12', title: 'The Grand Festival', act: 2,
            startDialog: 'ch12_festival_start',
            objectives: [
                { id: 'ch12_attend_festival', type: 'custom', fn: '_checkFestivalAttended', desc: 'Attend the grand festival', done: false },
                { id: 'ch12_meet_calder',     type: 'custom', fn: '_checkMetCalder',        desc: 'Speak with Lord Calder',    done: false }
            ],
            endDialog: 'ch12_complete',
            unlockButtons: [],
            onStart: '_onChapter12Start',
            onComplete: null
        },

        // ── Act III ──

        // Ch 13
        {
            id: 'ch13', title: 'The Fall of Ashford', act: 3,
            startDialog: 'ch13_invasion',
            objectives: [
                { id: 'ch13_escape', type: 'arrive_town', town: '!Ashford', desc: 'Escape to a safe town', done: false }
            ],
            endDialog: 'ch13_escape_complete',
            unlockButtons: [],
            onStart: '_onChapter13Start',
            onComplete: null
        },

        // Ch 14
        {
            id: 'ch14', title: 'A Petition to the Crown', act: 3,
            startDialog: 'ch14_calder_plan',
            objectives: [
                { id: 'ch14_reach_burgher', type: 'reach_rank', rank: 3,         desc: 'Reach the rank of Burgher',    done: false },
                { id: 'ch14_meet_calder',   type: 'custom',     fn: '_checkMetCalderCapital', desc: 'Meet Lord Calder at the capital', done: false }
            ],
            endDialog: 'ch14_complete',
            unlockButtons: [],
            onStart: null,
            onComplete: null
        },

        // Ch 15
        {
            id: 'ch15', title: 'Master of the Guild', act: 3,
            startDialog: 'ch15_calder_wealth',
            objectives: [
                { id: 'ch15_guildmaster', type: 'reach_rank', rank: 3,       desc: 'Attain Guildmaster standing',   done: false },
                { id: 'ch15_own_gold',    type: 'own_gold',   amount: 5000,  desc: 'Accumulate 5 000 gold',         done: false }
            ],
            endDialog: 'ch15_complete',
            unlockButtons: [],
            onStart: null,
            onComplete: null
        },

        // Ch 16
        {
            id: 'ch16', title: 'Halls of Power', act: 3,
            startDialog: 'ch16_calder_nobility',
            objectives: [
                { id: 'ch16_reach_noble',   type: 'reach_rank',   rank: 4,  desc: 'Become a Minor Noble',   done: false },
                { id: 'ch16_attend_feast',  type: 'attend_feast',           desc: 'Attend a noble feast',   done: false },
                { id: 'ch16_attend_court',  type: 'attend_court',           desc: 'Attend the royal court', done: false }
            ],
            endDialog: 'ch16_complete',
            unlockButtons: [],
            onStart: null,
            onComplete: null
        },

        // Ch 17 — BRANCHING
        {
            id: 'ch17', title: 'The War Effort', act: 3,
            startDialog: 'ch17_choice',
            objectives: [],   // populated dynamically based on path
            endDialog: null,   // branch-specific: ch17a_complete or ch17b_complete
            unlockButtons: [], // path B adds 'world' (outposts)
            onStart: '_onChapter17Start',
            onComplete: null,
            branches: {
                diplomatic: [
                    { id: 'ch17a_trade_route', type: 'send_caravan',              desc: 'Establish a luxury trade route',     done: false },
                    { id: 'ch17a_rask',        type: 'custom', fn: '_checkConvincedRask', desc: 'Convince Count Rask to defect', done: false },
                    { id: 'ch17a_victory',     type: 'custom', fn: '_checkDiplomaticVictory', desc: 'Achieve diplomatic victory', done: false }
                ],
                military: [
                    { id: 'ch17b_weapons',  type: 'own_building',  building: 'weapons_smith', desc: 'Produce weapons',          done: false },
                    { id: 'ch17b_outpost',  type: 'build_building', building: 'outpost',      desc: 'Build a military outpost', done: false },
                    { id: 'ch17b_battle',   type: 'custom', fn: '_checkBattleWon',            desc: 'Win the decisive battle',  done: false }
                ]
            }
        },

        // Ch 18
        {
            id: 'ch18', title: 'Reunion', act: 3,
            startDialog: 'ch18_ashford_liberated',
            objectives: [
                { id: 'ch18_arrive_ashford', type: 'arrive_town', town: 'Ashford',                        desc: 'Return to Ashford',     done: false },
                { id: 'ch18_talk_edmund',    type: 'custom',      fn: '_checkTalkedToEdmund',             desc: 'Speak with your father', done: false }
            ],
            endDialog: 'ch18_complete',
            unlockButtons: [],
            onStart: '_onChapter18Start',
            onComplete: null
        },

        // Ch 19
        {
            id: 'ch19', title: 'A New Dawn', act: 4,
            startDialog: 'ch19_ceremony_start',
            objectives: [
                { id: 'ch19_ceremony', type: 'custom', fn: '_checkCeremonyAttended', desc: 'Attend the ceremony', done: false }
            ],
            endDialog: 'ch19_sandbox_unlock',
            unlockButtons: [],
            onStart: null,
            onComplete: '_onChapter19Complete'
        }
    ];

    // ───────────────────────────────────────────────
    //  Internal Helpers
    // ───────────────────────────────────────────────

    /** Deep-clone an array of objective templates so chapter restarts are clean. */
    function _cloneObjectives(arr) {
        var out = [];
        for (var i = 0; i < arr.length; i++) {
            var o = {};
            for (var k in arr[i]) {
                if (arr[i].hasOwnProperty(k)) { o[k] = arr[i][k]; }
            }
            o.done = false;
            out.push(o);
        }
        return out;
    }

    /** Mark an objective done by id and persist to _storyState.objectives map. */
    function _markDone(objId) {
        _storyState.objectives[objId] = true;
        var ch = _currentChapterDef();
        if (!ch) { return; }
        for (var i = 0; i < ch.objectives.length; i++) {
            if (ch.objectives[i].id === objId) {
                ch.objectives[i].done = true;
                break;
            }
        }
        _refreshTracker();
    }

    /** Get the chapter definition for the current chapter index. */
    function _currentChapterDef() {
        return CHAPTERS[_storyState.chapter] || null;
    }

    /** Push unique values into buttonsUnlocked. */
    function _unlockButtons(arr) {
        for (var i = 0; i < arr.length; i++) {
            if (_storyState.buttonsUnlocked.indexOf(arr[i]) === -1) {
                _storyState.buttonsUnlocked.push(arr[i]);
            }
        }
    }

    /** Show a story dialog by key (delegates to UI layer). */
    function _showDialog(key) {
        if (!key) { return; }
        if (typeof STORY_DIALOGS !== 'undefined' && STORY_DIALOGS[key]) {
            if (typeof UI !== 'undefined' && UI.showStoryDialog) {
                UI.showStoryDialog(STORY_DIALOGS[key]);
            }
        }
        if (_storyState.dialogsSeen.indexOf(key) === -1) {
            _storyState.dialogsSeen.push(key);
        }
    }

    /** Notify the quest tracker UI. */
    function _refreshTracker() {
        var ch = _currentChapterDef();
        if (ch && typeof UI !== 'undefined' && UI.updateStoryTracker) {
            UI.updateStoryTracker(ch, ch.objectives);
        }
    }

    /** Convenience toast. */
    function _toast(msg) {
        if (typeof UI !== 'undefined' && UI.showToast) { UI.showToast(msg); }
    }

    /** Convenience log. */
    function _log(msg) {
        if (typeof Engine !== 'undefined' && Engine.addLogEntry) {
            Engine.addLogEntry(msg, 'story');
        }
    }

    /** Safely call a named hook function. */
    function _callHook(name) {
        if (name && typeof _hooks[name] === 'function') { _hooks[name](); }
    }

    // ───────────────────────────────────────────────
    //  Objective Checking
    // ───────────────────────────────────────────────

    /**
     * Check whether a single objective is satisfied right now.
     * Called by tick() and onPlayerAction().
     */
    function _checkObjective(obj) {
        if (obj.done || _storyState.objectives[obj.id]) { return true; }

        switch (obj.type) {
            case 'own_gold':
                return typeof Player !== 'undefined' && Player.gold >= (obj.amount || 0);

            case 'reach_rank':
                return typeof Player !== 'undefined' && Player.rank >= (obj.rank || 0);

            case 'own_building':
                return _playerOwnsBuilding(obj.building);

            case 'arrive_town':
                // Check if player is currently in the target town
                if (typeof Player !== 'undefined' && Player.townId && !Player.traveling) {
                    var curTown = (typeof Engine !== 'undefined' && Engine.findTown) ? Engine.findTown(Player.townId) : null;
                    var curName = curTown ? curTown.name : '';
                    if (obj.town && obj.town.charAt(0) === '!') {
                        return curName !== obj.town.substring(1);
                    }
                    return curName === obj.town;
                }
                return false;

            case 'custom':
                if (obj.fn && typeof _hooks[obj.fn] === 'function') {
                    return !!_hooks[obj.fn]();
                }
                return false;

            // The remaining types (buy_item, sell_item, arrive_town, etc.)
            // are event-driven — they get marked done via onPlayerAction().
            default:
                return false;
        }
    }

    /** Check if the player owns a building matching a pattern (supports pipe-delimited alternatives). */
    function _playerOwnsBuilding(pattern) {
        if (typeof Player === 'undefined' || !Player.buildings) { return false; }
        var types = (pattern || '').split('|');
        for (var i = 0; i < Player.buildings.length; i++) {
            var b = Player.buildings[i];
            for (var t = 0; t < types.length; t++) {
                if (b.type === types[t] || b.subtype === types[t]) { return true; }
            }
        }
        return false;
    }

    /** Evaluate all objectives; return true if every non-optional one is complete. */
    function _allObjectivesMet() {
        var ch = _currentChapterDef();
        if (!ch) { return false; }
        for (var i = 0; i < ch.objectives.length; i++) {
            var obj = ch.objectives[i];
            if (obj.optional) { continue; }
            if (!obj.done && !_storyState.objectives[obj.id]) { return false; }
        }
        return ch.objectives.length > 0;
    }

    // ───────────────────────────────────────────────
    //  Chapter Lifecycle
    // ───────────────────────────────────────────────

    function _beginChapter(index) {
        if (index < 0 || index >= CHAPTERS.length) { return; }

        _storyState.chapter = index;
        _storyState.chapterStartDay = (typeof Engine !== 'undefined' && Engine.getDay) ? Engine.getDay() : 0;

        var ch = CHAPTERS[index];

        // For the branching chapter, inject the right objectives
        if (ch.branches && _storyState.path) {
            ch.objectives = _cloneObjectives(ch.branches[_storyState.path] || []);
            if (_storyState.path === 'military') {
                _unlockButtons(['world']); // outposts
            }
        } else {
            ch.objectives = _cloneObjectives(ch.objectives.length ? ch.objectives : []);
        }

        // Re-apply any previously-completed objectives (for save/load)
        for (var i = 0; i < ch.objectives.length; i++) {
            if (_storyState.objectives[ch.objectives[i].id]) {
                ch.objectives[i].done = true;
            }
        }

        _unlockButtons(ch.unlockButtons || []);
        _callHook(ch.onStart);
        _showDialog(ch.startDialog);

        _log('Chapter ' + index + ': ' + ch.title);
        _toast('Chapter ' + index + ': ' + ch.title);
        _refreshTracker();
    }

    function _completeChapter() {
        var ch = _currentChapterDef();
        if (!ch) { return; }

        _showDialog(ch.endDialog);
        _callHook(ch.onComplete);
        _log('Chapter ' + _storyState.chapter + ' complete.');

        // Advance to the next chapter
        var next = _storyState.chapter + 1;
        if (next < CHAPTERS.length) {
            _beginChapter(next);
        } else {
            _storyState.complete = true;
            _toast('Story complete — sandbox mode unlocked!');
            _log('The story is complete. All protections removed. Welcome to sandbox mode.');
        }
    }

    // ───────────────────────────────────────────────
    //  Event-Driven Objective Matching
    // ───────────────────────────────────────────────

    /**
     * Check if a bought/sold item matches an objective item spec.
     * Supports: '*' (any), exact id, or 'category:food' style category match.
     */
    function _itemMatches(spec, actualItem) {
        if (spec === '*') { return true; }
        if (spec === actualItem) { return true; }
        // Category match: 'category:food' matches any item with category 'food'
        if (spec && spec.indexOf('category:') === 0) {
            var cat = spec.substring(9);
            var rt = (typeof CONFIG !== 'undefined' && CONFIG.RESOURCE_TYPES)
                ? CONFIG.RESOURCE_TYPES : null;
            if (!rt) {
                // Fallback: check RESOURCE_TYPES on window
                rt = (typeof RESOURCE_TYPES !== 'undefined') ? RESOURCE_TYPES : null;
            }
            if (rt) {
                for (var k in rt) {
                    if (rt[k].id === actualItem && rt[k].category === cat) { return true; }
                }
            }
        }
        return false;
    }

    /**
     * Map an action type + data to matching objective types and mark them done.
     *
     * @param {string} actionType  e.g. 'buy_item', 'sell_item', 'arrive_town' …
     * @param {object} data        action-specific payload
     */
    function _matchAction(actionType, data) {
        var ch = _currentChapterDef();
        if (!ch) { return; }

        for (var i = 0; i < ch.objectives.length; i++) {
            var obj = ch.objectives[i];
            if (obj.done) { continue; }
            if (obj.type !== actionType) { continue; }

            var matched = false;
            switch (actionType) {
                case 'buy_item':
                    if (_itemMatches(obj.item, data.item)) {
                        var needed = obj.qty || 1;
                        var bought = data.qty || 1;
                        // Accumulate progress for multi-purchase objectives
                        if (!obj._progress) { obj._progress = 0; }
                        obj._progress += bought;
                        matched = obj._progress >= needed;
                    }
                    break;

                case 'sell_item':
                    matched = _itemMatches(obj.item, data.item);
                    break;

                case 'arrive_town':
                    var arrTown = data.town || data.townName || '';
                    if (obj.town && obj.town.charAt(0) === '!') {
                        matched = arrTown !== obj.town.substring(1);
                    } else {
                        matched = (arrTown === obj.town);
                    }
                    break;

                case 'own_building':
                    matched = _playerOwnsBuilding(obj.building);
                    break;

                case 'build_building':
                    var allowed = (obj.building || '').split('|');
                    matched = allowed.indexOf(data.building) !== -1;
                    break;

                case 'work_shift':
                    var wsBldg = data.building || data.buildingType || '';
                    if (!obj.building) { matched = true; }
                    else {
                        var wsAllowed = obj.building.split('|');
                        matched = wsAllowed.indexOf(wsBldg) !== -1;
                    }
                    break;

                case 'send_caravan':
                    matched = true;
                    break;

                case 'hire_worker':
                    matched = true;
                    break;

                case 'treat_person':
                    matched = !obj.person || data.person === obj.person;
                    break;

                case 'buy_skill':
                    matched = !obj.skill || obj.skill === '*' || data.skill === obj.skill;
                    break;

                case 'join_guild':
                    matched = !obj.guild || obj.guild === '*' || data.guild === obj.guild;
                    break;

                case 'attend_feast':
                    matched = true;
                    break;

                case 'attend_court':
                    matched = true;
                    break;

                case 'reach_rank':
                    matched = data.rank >= (obj.rank || 0);
                    break;

                case 'own_gold':
                    matched = (typeof Player !== 'undefined') && Player.gold >= (obj.amount || 0);
                    break;

                default:
                    break;
            }

            if (matched) {
                _markDone(obj.id);
                _toast('Objective complete: ' + obj.desc);
                _log('Objective complete: ' + obj.desc);
            }
        }
    }

    // ───────────────────────────────────────────────
    //  Chapter Hook Functions
    // ───────────────────────────────────────────────

    var _hooks = {};

    // ── Prologue ──
    _hooks._onPrologueStart = function () {
        // Prologue has no objectives; auto-advance after dialog
        _storyState.chapterStartDay = (typeof Engine !== 'undefined' && Engine.getDay) ? Engine.getDay() : 0;
    };

    // ── Ch 1 ──
    _hooks._onChapter1Start = function () {
        // Mother gives 15 gold
        if (typeof Player !== 'undefined') {
            if (Player.modifyGold) { Player.modifyGold(15, 'Birthday gift from mother'); }
            else { Player.state.gold += 15; }
            _log('Mother gives you 15 gold for your 18th birthday.');
        }
    };

    // ── Ch 3: The Delivery ──
    _hooks._onChapter3Start = function () {
        // Father gives tools to deliver to Millhaven
        if (typeof Player !== 'undefined' && Player.modifyInventory) {
            Player.modifyInventory(Player.state.inventory, 'tools', 5);
            _log('Father hands you 5 sets of tools to deliver to Ferrowdale.');
        }
    };

    // ── Ch 7: War ──
    _hooks._onChapter7Start = function () {
        _storyState.flags.warDeclared = true;
        if (typeof Engine !== 'undefined') {
            if (Engine.declareWar)     { Engine.declareWar('Valdren', 'Korvath'); }
            if (Engine.banExport)      { Engine.banExport('iron_bars'); }
        }
        _log('War has been declared between Valdren and Korvath.');
    };

    _hooks._checkWarDialogSeen = function () {
        return _storyState.dialogsSeen.indexOf('ch7_war_crier') !== -1;
    };

    // ── Ch 11: Family Crisis ──
    _hooks._onChapter11Start = function () {
        _storyState.flags.edmundInjured = true;
        _storyState.flags.margretIll    = true;
        // Bypass protections to apply conditions via engine
        if (typeof Engine !== 'undefined') {
            if (Engine.setNPCCondition) {
                Engine.setNPCCondition('Edmund', 'injured', true);
                Engine.setNPCCondition('Margret', 'illness', true);
            }
        }
        _log('Father has been injured at the forge. Mother has fallen ill.');
    };

    _hooks._onChapter11Complete = function () {
        _storyState.flags.edmundInjured = false;
        _storyState.flags.margretIll    = false;
    };

    // ── Ch 12: Festival ──
    _hooks._onChapter12Start = function () {
        if (typeof Engine !== 'undefined' && Engine.triggerFestival) {
            Engine.triggerFestival('Ashford');
        }
    };

    _hooks._checkFestivalAttended = function () {
        return !!_storyState.flags.festivalAttended;
    };

    _hooks._checkMetCalder = function () {
        return _storyState.flags.metLordCalder;
    };

    // ── Ch 13: Fall of Ashford ──
    _hooks._onChapter13Start = function () {
        _storyState.flags.ashfordCaptured   = true;
        _storyState.flags.edmundImprisoned  = true;
        if (typeof Engine !== 'undefined') {
            if (Engine.captureTown)     { Engine.captureTown('Ashford', 'Korvath'); }
            if (Engine.setNPCCondition) { Engine.setNPCCondition('Edmund', 'imprisoned', true); }
        }
        _log('Korvath has invaded Ashford. Father has been imprisoned.');
    };

    // ── Ch 14 ──
    _hooks._checkMetCalderCapital = function () {
        return !!_storyState.flags.metLordCalderCapital;
    };

    // ── Ch 5 ──
    _hooks._checkRested = function () {
        // Check if player has rested (energy > 80) while owning housing
        if (typeof Player !== 'undefined') {
            var hasHousing = Player.housing && Player.housing.length > 0;
            var rested = Player.energy >= 80;
            return hasHousing && rested;
        }
        return false;
    };

    // ── Ch 17: Branching ──
    _hooks._onChapter17Start = function () {
        // The start dialog presents a choice; once the player picks,
        // UI calls StoryMode.setWarPath('diplomatic'|'military').
        // Objectives are injected at that point.
    };

    _hooks._checkConvincedRask = function () {
        return !!_storyState.flags.convincedRask;
    };

    _hooks._checkDiplomaticVictory = function () {
        return !!_storyState.flags.diplomaticVictory;
    };

    _hooks._checkBattleWon = function () {
        return !!_storyState.flags.battleWon;
    };

    // ── Ch 18: Reunion ──
    _hooks._onChapter18Start = function () {
        _storyState.flags.ashfordLiberated  = true;
        _storyState.flags.ashfordCaptured   = false;
        _storyState.flags.edmundImprisoned  = false;
        _storyState.flags.edmundFreed       = true;
        if (typeof Engine !== 'undefined') {
            if (Engine.captureTown)     { Engine.captureTown('Ashford', 'Valdren'); }
            if (Engine.setNPCCondition) { Engine.setNPCCondition('Edmund', 'imprisoned', false); }
        }
        _log('Ashford has been liberated. Father is free.');
    };

    _hooks._checkTalkedToEdmund = function () {
        return !!_storyState.flags.talkedToEdmund;
    };

    // ── Ch 19: Finale ──
    _hooks._checkCeremonyAttended = function () {
        return !!_storyState.flags.ceremonyAttended;
    };

    _hooks._onChapter19Complete = function () {
        // Remove all story protections
        _storyState.flags.suppressEncounters = false;
        _storyState.flags.suppressDisease    = false;
        _storyState.flags.protectFamily      = false;
        _storyState.complete = true;

        // Unlock every tab
        var allTabs = ['actions', 'business', 'character', 'world', 'system'];
        _unlockButtons(allTabs);

        _log('All story protections removed. Sandbox mode is now active.');
        _toast('Congratulations! Sandbox mode unlocked.');
    };

    // ───────────────────────────────────────────────
    //  Public API
    // ───────────────────────────────────────────────

    /**
     * Initialize story mode.  Called once when a new game with origin
     * "story_mode" is created.
     */
    function init(player) {
        console.log('[StoryMode] StoryMode.init called. player?', !!player, 'gameStart:', player ? player.gameStart : 'N/A', 'origin:', player ? player.origin : 'N/A');
        if (!player) { return; }
        // Accept either player.origin or player.gameStart for compatibility
        var startId = player.origin || player.gameStart || '';
        console.log('[StoryMode] startId resolved to:', startId);
        if (startId !== 'story_mode') { console.warn('[StoryMode] startId !== story_mode, ABORTING init'); return; }

        _storyState.active  = true;
        _storyState.chapter = 0;
        _storyState.path    = null;
        _storyState.complete = false;
        _storyState.objectives = {};
        _storyState.dialogsSeen = [];
        _storyState.buttonsUnlocked = ['character', 'system'];
        _storyState.chapterStartDay = 0;

        // Reset flags
        var flags = _storyState.flags;
        flags.suppressEncounters = true;
        flags.suppressDisease    = true;
        flags.protectFamily      = true;
        flags.edmundInjured      = false;
        flags.edmundImprisoned   = false;
        flags.edmundFreed        = false;
        flags.margretIll         = false;
        flags.ashfordCaptured    = false;
        flags.ashfordLiberated   = false;
        flags.metLordCalder      = false;
        flags.metSeraphine       = false;
        flags.warDeclared        = false;

        _beginChapter(0);
    }

    /**
     * Called every in-game day tick.
     * Re-evaluates polled objectives (own_gold, reach_rank, own_building, custom).
     */
    function tick(player) {
        if (!_storyState.active || _storyState.complete) { return; }

        var ch = _currentChapterDef();
        if (!ch) { return; }

        // Prologue auto-advances after its dialog has been seen
        if (_storyState.chapter === 0 && _storyState.dialogsSeen.indexOf('ch0_intro') !== -1) {
            _completeChapter();
            return;
        }

        // Poll state-based objectives
        var changed = false;
        for (var i = 0; i < ch.objectives.length; i++) {
            var obj = ch.objectives[i];
            if (obj.done) { continue; }
            if (_checkObjective(obj)) {
                _markDone(obj.id);
                _toast('Objective complete: ' + obj.desc);
                _log('Objective complete: ' + obj.desc);
                changed = true;
            }
        }

        if (changed && _allObjectivesMet()) {
            _completeChapter();
        }
    }

    /**
     * Called by game systems whenever the player performs a notable action.
     *
     * @param {string} actionType  One of the objective type strings.
     * @param {object} data        Contextual payload (item, qty, town, building, etc.)
     */
    function onPlayerAction(actionType, data) {
        if (!_storyState.active || _storyState.complete) { return; }

        _matchAction(actionType, data || {});

        if (_allObjectivesMet()) {
            _completeChapter();
        }
    }

    /**
     * Called by the dialog UI when a dialog key has been shown/dismissed.
     * Useful for custom objectives that just need a dialog to have been seen.
     */
    function onDialogSeen(dialogKey) {
        if (_storyState.dialogsSeen.indexOf(dialogKey) === -1) {
            _storyState.dialogsSeen.push(dialogKey);
        }
    }

    /**
     * Called by the dialog UI when the player picks a branch in Ch 17.
     * @param {'diplomatic'|'military'} pathName
     */
    function setWarPath(pathName) {
        if (pathName !== 'diplomatic' && pathName !== 'military') { return; }
        _storyState.path = pathName;

        var ch = CHAPTERS[17]; // ch17
        if (ch && ch.branches && ch.branches[pathName]) {
            ch.objectives = _cloneObjectives(ch.branches[pathName]);
            if (pathName === 'military') {
                _unlockButtons(['world']); // outposts
            }
            _refreshTracker();
            _log('You chose the ' + pathName + ' path.');
        }
    }

    /**
     * Register that the player has met a named NPC (sets story flags).
     */
    function onMetNPC(npcName) {
        if (npcName === 'Lord Calder')  { _storyState.flags.metLordCalder  = true; }
        if (npcName === 'Seraphine')    { _storyState.flags.metSeraphine   = true; }
    }

    // ── Query API ──

    function getCurrentChapter() {
        return _currentChapterDef();
    }

    function getObjectives() {
        var ch = _currentChapterDef();
        return ch ? ch.objectives : [];
    }

    function isButtonUnlocked(tabCategory) {
        if (_storyState.complete) { return true; }
        if (!_storyState.active)  { return true; }
        return _storyState.buttonsUnlocked.indexOf(tabCategory) !== -1;
    }

    function isActive() {
        return _storyState.active && !_storyState.complete;
    }

    function isComplete() {
        return _storyState.complete;
    }

    // Map objective types to the button selector(s) needed to complete them.
    // Each entry is a button ID used by the tutorial highlight system.
    var _objectiveButtonMap = {
        'buy_item':        '#btnTrade',
        'sell_item':       '#btnTrade',
        'work_shift':      '#btnWork',
        'arrive_town':     '#btnRoutes',
        'own_building':    '#btnBuild',
        'build_building':  '#btnBuild',
        'hire_worker':     '#btnHire',
        'buy_skill':       '#btnSkills',
        'join_guild':      '#btnGuilds',
        'send_caravan':    '#btnCaravan',
        'treat_person':    '#btnTreatment',   // Treatment is under character tab
        'attend_feast':    '#btnKingdoms',
        'attend_court':    '#btnKingdoms',
        'own_gold':        null,
        'reach_rank':      null,
        'custom':          null
    };

    // Map button IDs to { tab, label } for highlighting both the tab and sub-button
    var _btnToTabLabel = {
        '#btnTrade':     { tab: 'actions',   label: 'Trade' },
        '#btnBuild':     { tab: 'actions',   label: 'Build' },
        '#btnHire':      { tab: 'actions',   label: 'Hire' },
        '#btnWork':      { tab: 'actions',   label: 'Work' },
        '#btnStreet':    { tab: 'actions',   label: 'Street' },
        '#btnRest':      { tab: 'actions',   label: 'Rest' },
        '#btnRoutes':    { tab: 'actions',   label: 'Travel' },
        '#btnTalk':      { tab: 'actions',   label: 'Talk' },
        '#btnCaravan':   { tab: 'business',  label: 'Caravan' },
        '#btnBuildings': { tab: 'business',  label: 'Buildings' },
        '#btnShips':     { tab: 'business',  label: 'Ships' },
        '#btnCharacter': { tab: 'character', label: 'Character' },
        '#btnSkills':    { tab: 'character', label: 'Skills' },
        '#btnFamily':    { tab: 'character', label: 'Family' },
        '#btnHousing':   { tab: 'character', label: 'Housing' },
        '#btnGuilds':    { tab: 'character', label: 'Guilds' },
        '#btnKingdoms':  { tab: 'world',     label: 'Kingdoms' },
        '#btnMap':       { tab: 'world',     label: 'Map' },
        '#btnTreatment': { tab: 'character', label: 'Treatment' }
    };

    // Map custom hook functions to button hints
    var _customFnButtonMap = {
        '_checkRested':           '#btnRest',
        '_checkWarDialogSeen':    '#btnTalk',
        '_checkFestivalAttended': '#btnStreet',
        '_checkMetCalder':        '#btnTalk',
        '_checkMetCalderCapital': '#btnTalk',
        '_checkTalkedToEdmund':   '#btnTalk',
        '_checkCeremonyAttended': '#btnKingdoms'
    };

    /**
     * Returns an array of { tab, label } hints for the first incomplete objective.
     * Only highlights the next action the player should take, not all at once.
     */
    function getButtonHints() {
        if (!_storyState.active || _storyState.complete) return [];
        var ch = _currentChapterDef();
        if (!ch) return [];
        // Find the first incomplete objective that maps to a button
        for (var i = 0; i < ch.objectives.length; i++) {
            var obj = ch.objectives[i];
            if (obj.done) continue;
            var btnId = _objectiveButtonMap[obj.type] || null;
            if (obj.type === 'custom' && obj.fn && _customFnButtonMap[obj.fn]) {
                btnId = _customFnButtonMap[obj.fn];
            }
            if (!btnId) continue;
            var info = _btnToTabLabel[btnId];
            if (!info) continue;
            return [{ tab: info.tab, label: info.label }];
        }
        return [];
    }

    function getStoryFlags() {
        // Return a shallow copy
        var copy = {};
        for (var k in _storyState.flags) {
            if (_storyState.flags.hasOwnProperty(k)) { copy[k] = _storyState.flags[k]; }
        }
        return copy;
    }

    function getChapterIndex() {
        return _storyState.chapter;
    }

    function getPath() {
        return _storyState.path;
    }

    // ── Testing / Debug ──

    function advanceChapter() {
        if (_storyState.complete) { return; }
        _completeChapter();
    }

    // ── Serialization ──

    function serialize() {
        return {
            active:           _storyState.active,
            chapter:          _storyState.chapter,
            path:             _storyState.path,
            complete:         _storyState.complete,
            objectives:       JSON.parse(JSON.stringify(_storyState.objectives)),
            flags:            JSON.parse(JSON.stringify(_storyState.flags)),
            buttonsUnlocked:  _storyState.buttonsUnlocked.slice(),
            dialogsSeen:      _storyState.dialogsSeen.slice(),
            chapterStartDay:  _storyState.chapterStartDay
        };
    }

    function deserialize(data) {
        if (!data) { return; }

        _storyState.active          = !!data.active;
        _storyState.chapter         = data.chapter || 0;
        _storyState.path            = data.path || null;
        _storyState.complete        = !!data.complete;
        _storyState.objectives      = data.objectives || {};
        _storyState.buttonsUnlocked = data.buttonsUnlocked || ['character'];
        _storyState.dialogsSeen     = data.dialogsSeen || [];
        _storyState.chapterStartDay = data.chapterStartDay || 0;

        // Restore flags
        if (data.flags) {
            for (var k in data.flags) {
                if (data.flags.hasOwnProperty(k)) {
                    _storyState.flags[k] = data.flags[k];
                }
            }
        }

        // Rebuild live chapter objectives from definitions + saved completion
        if (_storyState.active && !_storyState.complete) {
            var ch = CHAPTERS[_storyState.chapter];
            if (ch) {
                if (ch.branches && _storyState.path) {
                    ch.objectives = _cloneObjectives(ch.branches[_storyState.path] || []);
                } else {
                    ch.objectives = _cloneObjectives(ch.objectives.length ? ch.objectives : []);
                }
                for (var i = 0; i < ch.objectives.length; i++) {
                    if (_storyState.objectives[ch.objectives[i].id]) {
                        ch.objectives[i].done = true;
                    }
                }
            }
            _refreshTracker();
        }
    }

    // ───────────────────────────────────────────────
    //  Expose Public Interface
    // ───────────────────────────────────────────────

    return {
        init:              init,
        tick:              tick,
        onPlayerAction:    onPlayerAction,
        onDialogSeen:      onDialogSeen,
        setWarPath:        setWarPath,
        onMetNPC:          onMetNPC,

        getCurrentChapter: getCurrentChapter,
        getChapterIndex:   getChapterIndex,
        getObjectives:     getObjectives,
        isButtonUnlocked:  isButtonUnlocked,
        isActive:          isActive,
        isComplete:        isComplete,
        getButtonHints:    getButtonHints,
        getStoryFlags:     getStoryFlags,
        getPath:           getPath,

        advanceChapter:    advanceChapter,
        serialize:         serialize,
        deserialize:       deserialize
    };

})();
