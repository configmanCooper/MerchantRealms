(function() {
    "use strict";
    if (typeof Engine === 'undefined') return;

    // v9p33river442: noble memory declarations and coalition mappings.
    var DECLARATION_TYPES = {
        lower_taxes: { label: 'Lower Taxes', icon: '💰', opposite: 'raise_taxes' },
        raise_taxes: { label: 'Raise Taxes', icon: '💰', opposite: 'lower_taxes' },
        seek_peace: { label: 'Seek Peace', icon: '🕊️', opposite: 'declare_war' },
        declare_war: { label: 'Prepare for War', icon: '⚔️', opposite: 'seek_peace' },
        expand_trade: { label: 'Expand Trade', icon: '📈', opposite: null },
        build_infrastructure: { label: 'Build Infrastructure', icon: '🏗️', opposite: null },
        strengthen_military: { label: 'Strengthen Military', icon: '🛡️', opposite: 'seek_peace' },
        improve_happiness: { label: 'Improve Public Welfare', icon: '😊', opposite: null },
        enforce_law: { label: 'Enforce Law & Order', icon: '⚖️', opposite: null },
        promote_noble: { label: 'Promote a Noble', icon: '👑', opposite: null }
    };
    var DECLARATION_TO_CAUSE = {
        lower_taxes: 'lower_taxes',
        raise_taxes: 'raise_taxes',
        seek_peace: 'make_peace',
        declare_war: 'declare_war',
        expand_trade: 'form_alliance',
        build_infrastructure: 'build_infrastructure',
        strengthen_military: 'war_offensive',
        improve_happiness: 'improve_happiness',
        enforce_law: null,
        promote_noble: 'promote_noble'
    };
    var CAUSE_LABELS = {
        lower_taxes: 'Lower Taxes',
        raise_taxes: 'Raise Taxes',
        make_peace: 'Seek Peace',
        declare_war: 'Declare War',
        war_offensive: 'Military Offensive',
        form_alliance: 'Form Alliance',
        build_infrastructure: 'Build Infrastructure',
        build_walls: 'Fortify Towns',
        improve_happiness: 'Improve Public Welfare',
        medical_funding: 'Fund Plague Relief',
        promote_noble: 'Promote a Noble'
    };
    var NOBLE_QUESTION_DEFS = [
        { id: 'king_opinion', text: 'What do you think of our king?', tags: ['court'], trustRequired: -20, extract: function(target, kingdom, asker) { return _extractNobleKingOpinionFact(target, kingdom, asker); } },
        { id: 'court_state', text: 'How are things in court lately?', tags: ['court'], trustRequired: -20, extract: function(target, kingdom, asker) { return _extractNobleCourtStateFact(target, kingdom, asker); } },
        { id: 'noble_priority', text: 'What matters most to you?', tags: ['personal'], trustRequired: 30, extract: function(target, kingdom, asker) { return _extractNoblePriorityFact(target, kingdom, asker); } },
        { id: 'court_friend', text: 'Who do you get along with at court?', tags: ['court'], trustRequired: -20, extract: function(target, kingdom, asker) { return _extractNobleCourtFriendFact(target, kingdom, asker); } },
        { id: 'court_enemy', text: 'Is there a noble you can\'t stand?', tags: ['court', 'personal'], trustRequired: 30, extract: function(target, kingdom, asker) { return _extractNobleCourtEnemyFact(target, kingdom, asker); } },
        { id: 'noble_advice', text: 'What would you advise the king to do?', tags: ['political'], trustRequired: 30, extract: function(target, kingdom, asker) { return _extractNobleAdviceFact(target, kingdom, asker); } },
        { id: 'noble_direction', text: 'Do you think the kingdom is headed in the right direction?', tags: ['political'], trustRequired: 30, extract: function(target, kingdom, asker) { return _extractNobleDirectionFact(target, kingdom, asker); } },
        { id: 'noble_ambitions', text: 'What are your ambitions?', tags: ['personal'], trustRequired: 30, extract: function(target, kingdom, asker) { return _extractNobleAmbitionsFact(target, kingdom, asker); } },
        { id: 'noble_occupied', text: 'What have you been occupied with lately?', tags: ['court'], trustRequired: -20, extract: function(target, kingdom, asker) { return _extractNobleOccupiedFact(target, kingdom, asker); } },
        { id: 'noble_next_business', text: 'What business has your attention next?', tags: ['political'], trustRequired: 30, extract: function(target, kingdom, asker) { return _extractNobleNextBusinessFact(target, kingdom, asker); } },
        { id: 'court_allies', text: 'Who has your ear at court?', tags: ['court', 'political'], trustRequired: 30, extract: function(target, kingdom, asker) { return _extractNobleCourtAlliesFact(target, kingdom, asker); } },
        { id: 'favor_hook', text: 'What matter would you like settled?', tags: ['personal'], trustRequired: 30, extract: function(target, kingdom, asker) { return _extractNobleFavorHookFact(target, kingdom, asker); } },
        { id: 'win_support', text: 'What would win your support?', tags: ['political'], trustRequired: 30, extract: function(target, kingdom, asker) { return _extractNobleWinSupportFact(target, kingdom, asker); } },
        { id: 'noble_watch', text: 'Which noble should I watch?', tags: ['dangerous'], trustRequired: 65, extract: function(target, kingdom, asker) { return _extractNobleWatchFact(target, kingdom, asker); } },
        { id: 'court_forecast', text: 'What is the court likely to do next?', tags: ['political'], trustRequired: 30, extract: function(target, kingdom, asker) { return _extractNobleCourtForecastFact(target, kingdom, asker); } },
        { id: 'noble_investment', text: 'Are you looking for investment?', tags: ['personal'], trustRequired: 30, extract: function(target, kingdom, asker) { return _extractNobleInvestmentFact(target, kingdom, asker); } },
        { id: 'move_against_king', text: 'Would you ever move against the king?', tags: ['dangerous'], trustRequired: 65, extract: function(target, kingdom, asker) { return _extractNobleMoveAgainstKingFact(target, kingdom, asker); } },
        { id: 'noble_secret', text: 'What\'s your biggest secret?', tags: ['dangerous'], trustRequired: 65, extract: function(target, kingdom, asker) { return _extractNobleSecretFact(target, kingdom, asker); } },
        { id: 'noble_threat', text: 'Who do you think threatens the kingdom most?', tags: ['political'], trustRequired: 30, extract: function(target, kingdom, asker) { return _extractNobleThreatFact(target, kingdom, asker); } },
        { id: 'noble_as_king', text: 'If you were king, what would you change first?', tags: ['political'], trustRequired: 30, extract: function(target, kingdom, asker) { return _extractNobleAsKingFact(target, kingdom, asker); } }
    ];
    var NOBLE_QUESTION_ID_ALIASES = {
        noble_king_opinion: 'king_opinion',
        noble_court_state: 'court_state',
        noble_matters: 'noble_priority',
        noble_friends: 'court_friend',
        noble_enemy: 'court_enemy',
        noble_move_against_king: 'move_against_king',
        noble_if_king: 'noble_as_king',
        noble_court_allies: 'court_allies',
        noble_favor_hook: 'favor_hook',
        noble_win_support: 'win_support',
        noble_court_forecast: 'court_forecast'
    };

    // v9p33river442: local utility helpers with defensive guards.
    function _cfg(name, fallback) {
        try {
            if (typeof CONFIG !== 'undefined' && CONFIG && CONFIG[name] != null) return CONFIG[name];
        } catch (e) {}
        return fallback;
    }
    function _clamp(value, min, max) {
        value = Number(value);
        if (!isFinite(value)) value = min;
        return Math.max(min, Math.min(max, value));
    }
    function _chance(value) {
        return _clamp(value, 0, 0.98);
    }
    function _getWorld() {
        return Engine.getWorld ? Engine.getWorld() : null;
    }
    function _getDay() {
        return Engine.getDay ? Engine.getDay() : 0;
    }
    function _getRng() {
        return Engine.getRng ? Engine.getRng() : null;
    }
    function _getPlayerState() {
        try {
            if (typeof Player !== 'undefined' && Player.state) return Player.state;
        } catch (e) {}
        return null;
    }
    function _getPlayerTownId() {
        var ps = _getPlayerState();
        if (ps && ps.townId) return ps.townId;
        try {
            if (typeof Player !== 'undefined' && Player.townId) return Player.townId;
        } catch (e) {}
        return null;
    }
    function _getPlayerKingdomId() {
        var ps = _getPlayerState();
        if (ps && ps.citizenshipKingdomId) return ps.citizenshipKingdomId;
        try {
            if (typeof Player !== 'undefined' && Player.citizenshipKingdomId) return Player.citizenshipKingdomId;
        } catch (e) {}
        return null;
    }
    function _getPlayerRank(kingdomId) {
        var ps = _getPlayerState();
        if (ps && ps.socialRank && kingdomId) return ps.socialRank[kingdomId] || 0;
        try {
            if (typeof Player !== 'undefined' && Player.socialRank && kingdomId) return Player.socialRank[kingdomId] || 0;
        } catch (e) {}
        return 0;
    }
    function _isPlayerActor(actorId) {
        var playerId = 'player';
        try {
            if (typeof Player !== 'undefined' && Player.personId) playerId = Player.personId || 'player';
        } catch (e) {}
        return actorId === 'player' || actorId === playerId;
    }
    function _getPlayerRelationshipLevel(nobleId) {
        try {
            if (typeof Player !== 'undefined' && Player.getRelationship) {
                var rel = Player.getRelationship(nobleId);
                if (rel && rel.level != null) return rel.level;
            }
        } catch (e) {}
        var ps = _getPlayerState();
        if (ps && ps.relationships && ps.relationships[nobleId] && ps.relationships[nobleId].level != null) {
            return ps.relationships[nobleId].level;
        }
        return 50;
    }
    function _modifyPlayerRelationship(nobleId, delta) {
        try {
            if (typeof Player !== 'undefined' && Player.modifyRelationship) {
                Player.modifyRelationship(nobleId, delta);
                return true;
            }
        } catch (e) {}
        return false;
    }
    function _getNobleKingdomId(noble) {
        var sk;
        if (!noble) return null;
        if (noble.kingdomId) return noble.kingdomId;
        if (noble.socialRank && typeof noble.socialRank === 'object') {
            for (sk in noble.socialRank) {
                if ((noble.socialRank[sk] || 0) >= 4) return sk;
            }
        }
        if (noble.townId && Engine.findTown) {
            var town = Engine.findTown(noble.townId);
            if (town && town.kingdomId) return town.kingdomId;
        }
        return null;
    }
    function _getNobleRank(noble, kingdomId) {
        if (!noble) return 0;
        if (typeof noble.socialRank === 'number') return noble.socialRank;
        return (noble.socialRank && kingdomId) ? (noble.socialRank[kingdomId] || 0) : 0;
    }
    function _getNoblesInKingdom(kId) {
        var world = _getWorld();
        if (!world || !world.people || !kId) return [];
        return world.people.filter(function(p) {
            var rank;
            var pKingdomId;
            if (!p || !p.alive) return false;
            pKingdomId = p.kingdomId || _getNobleKingdomId(p);
            if (pKingdomId !== kId) return false;
            rank = _getNobleRank(p, kId);
            return rank >= 4 || p.occupation === 'noble';
        });
    }
    function _getNobleRelationshipScore(noble, otherId) {
        if (!noble || !noble._nobleRelationships || noble._nobleRelationships[otherId] == null) return 50;
        return noble._nobleRelationships[otherId];
    }
    function _modifyNobleRelationship(noble, otherId, delta) {
        var cur;
        if (!noble || !otherId) return;
        if (!noble._nobleRelationships) noble._nobleRelationships = {};
        cur = noble._nobleRelationships[otherId];
        if (cur == null) cur = 50;
        // v9p33river460: memory-based relationship cap
        var cap = 100;
        try {
            if (Engine.getNobleMemoryRelationshipCap) cap = Engine.getNobleMemoryRelationshipCap(noble, otherId);
        } catch(e) {}
        noble._nobleRelationships[otherId] = _clamp(cur + delta, -100, cap);
    }
    function _modifyObservedRelationship(observer, actorId, delta) {
        if (!observer || !actorId || !delta) return;
        if (_isPlayerActor(actorId)) {
            _modifyPlayerRelationship(observer.id, delta);
            return;
        }
        _modifyNobleRelationship(observer, actorId, delta);
    }
    function _getNobleName(noble) {
        if (!noble) return 'A noble';
        return ((noble.firstName || 'A noble') + ' ' + (noble.lastName || '')).replace(/\s+/g, ' ').trim();
    }
    function _getLogCategory(kingdomId) {
        return _getPlayerKingdomId() === kingdomId ? 'my_kingdom' : 'foreign_kingdoms';
    }
    function _declarationToCause(category) {
        return DECLARATION_TO_CAUSE[category] || null;
    }
    function _getOppositeCause(category) {
        var decl = DECLARATION_TYPES[category];
        if (!decl || !decl.opposite) return null;
        return _declarationToCause(decl.opposite);
    }
    function _getCauseLabel(cause) {
        return CAUSE_LABELS[cause] || cause || '';
    }
    function _getCategoryLabel(category) {
        return DECLARATION_TYPES[category] ? DECLARATION_TYPES[category].label : category;
    }
    function _getTargetName(targetId) {
        var noble;
        var kingdom;
        if (!targetId) return '';
        if (_isPlayerActor(targetId)) return 'you';
        noble = Engine.findPerson ? Engine.findPerson(targetId) : null;
        if (noble) return _getNobleName(noble);
        kingdom = Engine.findKingdom ? Engine.findKingdom(targetId) : null;
        if (kingdom) return kingdom.name || 'that kingdom';
        return String(targetId);
    }
    function _getTargetInfo(category, targetData, kingdomId) {
        var targetId = null;
        var targetName = '';
        if (typeof targetData === 'string') targetId = targetData;
        if (targetData && typeof targetData === 'object') {
            if (targetData.targetId) targetId = targetData.targetId;
            if (targetData.targetNobleId) targetId = targetData.targetNobleId;
            if (targetData.targetKingdomId) targetId = targetData.targetKingdomId;
            if (targetData.targetName) targetName = targetData.targetName;
        }
        if (category === 'promote_noble' && !targetId) targetId = 'player';
        if (!targetName && targetId) targetName = _getTargetName(targetId);
        if (!targetName && kingdomId) {
            var k = Engine.findKingdom ? Engine.findKingdom(kingdomId) : null;
            if (k) targetName = k.name || '';
        }
        return { targetId: targetId, targetName: targetName };
    }
    function _getPromotionTargetInfo(kingdomId, targetId) {
        var target;
        var targetRank;
        var targetKingdomId;
        var kingdom;
        if (!kingdomId || !targetId) return { ok: false, message: 'Choose a noble to promote.' };
        if (targetId === 'player') {
            targetRank = _getPlayerRank(kingdomId);
            if (targetRank < 4) return { ok: false, message: 'Only nobles may seek promotion through court politics.' };
            if (targetRank >= 6) return { ok: false, message: 'You already hold the highest promotable rank.' };
            return { ok: true, targetId: 'player', targetName: _getTargetName('player') };
        }
        target = Engine.findPerson ? Engine.findPerson(targetId) : null;
        if (!target || !target.alive) return { ok: false, message: 'That noble is unavailable.' };
        targetKingdomId = _getNobleKingdomId(target);
        if (targetKingdomId !== kingdomId) return { ok: false, message: _getNobleName(target) + ' is not a noble in this kingdom.' };
        targetRank = _getNobleRank(target, kingdomId);
        if (targetRank < 4) return { ok: false, message: _getNobleName(target) + ' is not a noble in this kingdom.' };
        if (targetRank >= 6) return { ok: false, message: _getNobleName(target) + ' already holds the highest promotable rank.' };
        kingdom = Engine.findKingdom ? Engine.findKingdom(kingdomId) : null;
        if (kingdom && kingdom.king === target.id) return { ok: false, message: 'You cannot petition to promote the king.' };
        return { ok: true, targetId: target.id, targetName: _getNobleName(target) };
    }
    function _buildDeclarationDetail(category, targetInfo) {
        var label = _getCategoryLabel(category);
        if (category === 'promote_noble' && targetInfo && targetInfo.targetName) {
            return 'The player urged support for promoting ' + targetInfo.targetName + '.';
        }
        if ((category === 'declare_war' || category === 'seek_peace') && targetInfo && targetInfo.targetName) {
            return 'The player declared support for ' + label + ' with ' + targetInfo.targetName + '.';
        }
        return 'The player declared support for: ' + label + '.';
    }
    function _memoryMatches(memory, category, actorId, withinDays) {
        if (!memory) return false;
        if (category && memory.category !== category) return false;
        if (actorId && memory.actorId !== actorId) return false;
        if ((_getDay() - (memory.day || 0)) > withinDays) return false;
        return true;
    }

    // v9p33river442: noble memory storage management.
    function _initNobleMemory(noble) {
        if (!noble) return null;
        if (!noble.nobleMemory || typeof noble.nobleMemory !== 'object') {
            noble.nobleMemory = { playerActions: [], nobleActions: [] };
        }
        if (!Array.isArray(noble.nobleMemory.playerActions)) noble.nobleMemory.playerActions = [];
        if (!Array.isArray(noble.nobleMemory.nobleActions)) noble.nobleMemory.nobleActions = [];
        return noble.nobleMemory;
    }
    function _getMemoryLimits(noble) {
        var intelligence = 50;
        if (noble && noble.personality && noble.personality.intelligence != null) intelligence = noble.personality.intelligence;
        if (intelligence >= 75) {
            return {
                playerMax: _cfg('NOBLE_MEMORY_PLAYER_MAX_BRILLIANT', 50),
                nobleMax: _cfg('NOBLE_MEMORY_NOBLE_MAX_BRILLIANT', 150)
            };
        }
        if (intelligence >= 40) {
            return {
                playerMax: _cfg('NOBLE_MEMORY_PLAYER_MAX_NORMAL', 30),
                nobleMax: _cfg('NOBLE_MEMORY_NOBLE_MAX_NORMAL', 100)
            };
        }
        return {
            playerMax: _cfg('NOBLE_MEMORY_PLAYER_MAX_DIM', 15),
            nobleMax: _cfg('NOBLE_MEMORY_NOBLE_MAX_DIM', 50)
        };
    }
    function _sanitizeMemoryEntry(entry, defaults) {
        var safe = entry || {};
        return {
            type: safe.type || defaults.type || 'observed',
            source: safe.source || defaults.source || 'observed',
            category: safe.category || defaults.category || 'unknown',
            detail: safe.detail || defaults.detail || '',
            actorId: safe.actorId || defaults.actorId || '',
            targetId: safe.targetId != null ? safe.targetId : (defaults.targetId != null ? defaults.targetId : null),
            day: safe.day != null ? safe.day : _getDay(),
            sentiment: safe.sentiment != null ? safe.sentiment : (defaults.sentiment != null ? defaults.sentiment : 0),
            kingdomId: safe.kingdomId || defaults.kingdomId || ''
        };
    }
    function _addPlayerMemory(noble, entry) {
        var memory = _initNobleMemory(noble);
        var limits = _getMemoryLimits(noble);
        if (!memory) return null;
        memory.playerActions.push(_sanitizeMemoryEntry(entry, { actorId: 'player' }));
        while (memory.playerActions.length > limits.playerMax) memory.playerActions.shift();
        return memory.playerActions[memory.playerActions.length - 1];
    }
    function _addNobleMemory(noble, entry) {
        var memory = _initNobleMemory(noble);
        var limits = _getMemoryLimits(noble);
        if (!memory) return null;
        memory.nobleActions.push(_sanitizeMemoryEntry(entry, {}));
        while (memory.nobleActions.length > limits.nobleMax) memory.nobleActions.shift();
        return memory.nobleActions[memory.nobleActions.length - 1];
    }
    function _getRecentPlayerMemories(noble, maxAgeDays) {
        var memory = _initNobleMemory(noble);
        var age = maxAgeDays == null ? 180 : maxAgeDays;
        if (!memory) return [];
        return memory.playerActions.filter(function(entry) {
            return (_getDay() - (entry.day || 0)) <= age;
        });
    }
    function _getRecentNobleMemories(noble, maxAgeDays) {
        var memory = _initNobleMemory(noble);
        var age = maxAgeDays == null ? 180 : maxAgeDays;
        if (!memory) return [];
        return memory.nobleActions.filter(function(entry) {
            return (_getDay() - (entry.day || 0)) <= age;
        });
    }
    function _hasRecentMemory(noble, category, actorId, withinDays) {
        var memory = _initNobleMemory(noble);
        var i;
        var age = withinDays == null ? _cfg('NOBLE_MEMORY_DEDUP_DAYS', 3) : withinDays;
        if (!memory) return false;
        for (i = 0; i < memory.playerActions.length; i++) {
            if (_memoryMatches(memory.playerActions[i], category, actorId, age)) return true;
        }
        for (i = 0; i < memory.nobleActions.length; i++) {
            if (_memoryMatches(memory.nobleActions[i], category, actorId, age)) return true;
        }
        return false;
    }

    // v9p33river442: declaration alignment and observation sentiment helpers.
    function _scoreDeclarationAlignment(noble, kingdomId, category, targetInfo) {
        var score = 0;
        var agenda = null;
        var cause = _declarationToCause(category);
        var oppositeCause = _getOppositeCause(category);
        var np = (noble && noble.personality) ? noble.personality : {};
        var loyalty = noble && noble.kingLoyalty != null ? noble.kingLoyalty : 50;
        var k = kingdomId && Engine.findKingdom ? Engine.findKingdom(kingdomId) : null;
        var relationToTarget = 50;
        var worstRel = 0;
        var relId;

        try {
            if (Engine.getNobleAgenda && noble) agenda = Engine.getNobleAgenda(noble.id);
        } catch (e) {}
        if (agenda && agenda.advice && cause) {
            for (var ai = 0; ai < agenda.advice.length; ai++) {
                if (agenda.advice[ai].actionId === cause) score += 2;
                if (oppositeCause && agenda.advice[ai].actionId === oppositeCause) score -= 2;
            }
        }

        switch (category) {
            case 'lower_taxes':
                if ((np.warmth || 50) > 60) score += 1;
                if ((np.frugality || 50) > 70) score -= 1;
                break;
            case 'raise_taxes':
                if ((np.frugality || 50) > 70) score += 1;
                if ((np.warmth || 50) > 70) score -= 1;
                break;
            case 'seek_peace':
                if ((np.warmth || 50) > 60) score += 1;
                if ((np.ambition || 50) > 70) score -= 1;
                break;
            case 'declare_war':
            case 'strengthen_military':
                if ((np.ambition || 50) > 65) score += 1;
                if ((np.warmth || 50) > 70) score -= 1;
                break;
            case 'expand_trade':
                if ((np.intelligence || 50) > 60 || (np.warmth || 50) > 55) score += 1;
                break;
            case 'build_infrastructure':
                if ((np.intelligence || 50) > 60 || (np.frugality || 50) > 55) score += 1;
                break;
            case 'improve_happiness':
                if ((np.warmth || 50) > 60) score += 2;
                if ((np.frugality || 50) > 75) score -= 1;
                break;
            case 'enforce_law':
                if (loyalty > 60 || (np.intelligence || 50) > 60) score += 1;
                break;
            case 'promote_noble':
                if (targetInfo && targetInfo.targetId) {
                    if (_isPlayerActor(targetInfo.targetId)) {
                        if ((np.warmth || 50) > 60) score += 1;
                    } else if (targetInfo.targetId === noble.id) {
                        score += 3;
                    } else {
                        relationToTarget = _getNobleRelationshipScore(noble, targetInfo.targetId);
                        if (relationToTarget > 60) score += 2;
                        if (relationToTarget < 20) score -= 2;
                    }
                }
                if ((np.ambition || 50) > 70 && (!targetInfo || targetInfo.targetId !== noble.id)) score -= 1;
                break;
        }

        if (loyalty > 70 && k) {
            if ((category === 'raise_taxes') && (k.gold || 0) < 2500) score += 1;
            if ((category === 'lower_taxes') && (k.gold || 0) < 2500) score -= 1;
            if ((category === 'improve_happiness') && (k.happiness || 50) < 45) score += 1;
            if ((category === 'seek_peace') && k.atWar && (k.atWar.size || (Array.isArray(k.atWar) ? k.atWar.length : 0)) > 0 && k.kingPersonality && k.kingPersonality.militarism === 'peaceful') score += 1;
            if ((category === 'declare_war' || category === 'strengthen_military') && k.kingPersonality && (k.kingPersonality.militarism === 'warlike' || k.kingPersonality.ambition === 'ambitious')) score += 1;
            if (category === 'declare_war' && k.relations) {
                for (relId in k.relations) {
                    if ((k.relations[relId] || 0) < worstRel) worstRel = k.relations[relId] || 0;
                }
                if (worstRel > -20) score -= 1;
            }
        }

        return score;
    }
    function _evaluateObservedSentiment(observer, eventData) {
        var loyalty = observer && observer.kingLoyalty != null ? observer.kingLoyalty : 50;
        var np = (observer && observer.personality) ? observer.personality : {};
        var detail = (eventData && eventData.detail ? String(eventData.detail) : '').toLowerCase();
        var cause = eventData && eventData.targetId ? eventData.targetId : null;
        if (!observer || !eventData) return 0;

        if (eventData.category === 'conspiracy_joined' || eventData.category === 'conspiracy_formed') {
            if (loyalty > 70) return -1;
            if (loyalty < 30 || (np.ambition || 50) > 70) return 1;
            return 0;
        }
        if (eventData.category === 'coalition_formed' && cause) {
            if (cause === 'lower_taxes' && (np.warmth || 50) > 60) return 1;
            if (cause === 'raise_taxes' && (np.frugality || 50) > 70) return 1;
            if ((cause === 'make_peace' || cause === 'form_alliance') && (np.warmth || 50) > 60) return 1;
            if ((cause === 'declare_war' || cause === 'war_offensive') && (np.ambition || 50) > 65) return 1;
            if (cause === 'promote_noble' && (np.ambition || 50) > 60) return 1;
            if (cause === 'lower_taxes' && (np.frugality || 50) > 70) return -1;
            if (cause === 'raise_taxes' && (np.warmth || 50) > 70) return -1;
        }
        if (eventData.category === 'feast_behavior') {
            if (detail.indexOf('toast to the king') >= 0 || detail.indexOf('praised the king') >= 0) {
                return loyalty < 35 ? -1 : 1;
            }
            if (detail.indexOf('whisper') >= 0 || detail.indexOf('dark corner') >= 0 || detail.indexOf('criticisms') >= 0) {
                return loyalty > 70 ? -1 : 1;
            }
            if (detail.indexOf('bitter argument') >= 0 && (np.warmth || 50) > 70) return -1;
        }
        return 0;
    }
    function _applyObservationConsequences(observer, eventData, sentiment) {
        var detail;
        var loyalty;
        if (!observer || !eventData || !eventData.actorId) return;
        detail = (eventData.detail ? String(eventData.detail) : '').toLowerCase();
        loyalty = observer.kingLoyalty != null ? observer.kingLoyalty : 50;

        if (_isPlayerActor(eventData.actorId)) {
            if ((eventData.category === 'conspiracy_joined' || eventData.category === 'conspiracy_formed') && loyalty > 70) {
                _modifyPlayerRelationship(observer.id, -5);
                return;
            }
            if (sentiment > 0) _modifyPlayerRelationship(observer.id, 1);
            if (sentiment < 0) _modifyPlayerRelationship(observer.id, eventData.category === 'coalition_formed' ? -2 : -1);
            return;
        }

        if (eventData.category === 'feast_behavior' && (detail.indexOf('toast to the king') >= 0 || detail.indexOf('praised the king') >= 0) && loyalty < 35) {
            _modifyNobleRelationship(observer, eventData.actorId, -3);
            return;
        }
        if (eventData.category === 'feast_behavior' && (detail.indexOf('whisper') >= 0 || detail.indexOf('dark corner') >= 0 || detail.indexOf('criticisms') >= 0) && loyalty > 70) {
            _modifyNobleRelationship(observer, eventData.actorId, -4);
            return;
        }
        if ((eventData.category === 'conspiracy_joined' || eventData.category === 'conspiracy_formed') && loyalty > 70) {
            _modifyNobleRelationship(observer, eventData.actorId, -5);
            return;
        }
        if (sentiment > 0) _modifyNobleRelationship(observer, eventData.actorId, 2);
        if (sentiment < 0) _modifyNobleRelationship(observer, eventData.actorId, -2);
    }
    function _memoryToCause(memory) {
        if (!memory) return null;
        if (memory.category === 'coalition_formed' && memory.targetId) return memory.targetId;
        if (memory.category === 'promote_noble') return 'promote_noble';
        if (memory.type === 'question_answer') {
            if (memory.category === 'noble_advice' || memory.category === 'noble_next_business' || memory.category === 'win_support' || memory.category === 'court_forecast' || memory.category === 'noble_as_king') {
                return CAUSE_LABELS[memory.detail] ? memory.detail : null;
            }
            if (memory.category === 'noble_investment' && memory.sentiment > 0) return 'build_infrastructure';
        }
        return _declarationToCause(memory.category);
    }
    function _isSuspiciousMemory(memory) {
        var detail = memory && memory.detail ? String(memory.detail).toLowerCase() : '';
        if (!memory) return false;
        if (memory.category === 'conspiracy_joined' || memory.category === 'conspiracy_formed' || memory.category === 'move_against_king_suspicion') return true;
        if (memory.type === 'question_answer' && memory.category === 'move_against_king' && detail === 'willing') return true;
        if (memory.category === 'feast_behavior' && (detail.indexOf('whisper') >= 0 || detail.indexOf('dark corner') >= 0 || detail.indexOf('criticisms') >= 0)) return true;
        return false;
    }
    function _hasActiveCoalition(k, cause, targetNobleId) {
        var i;
        if (!k || !cause || !k._nobleCoalitions) return false;
        for (i = 0; i < k._nobleCoalitions.length; i++) {
            if (k._nobleCoalitions[i].status !== 'forming') continue;
            if (k._nobleCoalitions[i].cause !== cause) continue;
            if (cause !== 'promote_noble') return true;
            if (!targetNobleId) return true;
            if (k._nobleCoalitions[i].causeData && k._nobleCoalitions[i].causeData.targetNobleId === targetNobleId) return true;
        }
        return false;
    }
    function _computeInfluence(noble, kingdomId) {
        var rank = _getNobleRank(noble, kingdomId);
        var base = rank >= 6 ? 4 : rank >= 5 ? 2 : 1;
        var loyalty = noble && noble.perceivedKingLoyalty != null ? noble.perceivedKingLoyalty : (noble && noble.kingLoyalty != null ? noble.kingLoyalty : 50);
        var np = (noble && noble.personality) ? noble.personality : {};
        return Math.max(0.5, base * (0.5 + (loyalty / 100)) + (((np.intelligence || 50) - 50) * 0.01) + (((np.warmth || 50) - 50) * 0.008));
    }
    function _rememberedCauseCount(memories, cause) {
        var count = 0;
        for (var i = 0; i < memories.length; i++) {
            if (_memoryToCause(memories[i]) === cause) count++;
        }
        return count;
    }
    function _findRumorSource(nobles, excludeId) {
        var best = null;
        var bestDay = -1;
        var memories;
        var i;
        var j;
        for (i = 0; i < nobles.length; i++) {
            if (!nobles[i] || !nobles[i].alive || nobles[i].id === excludeId) continue;
            memories = _getRecentPlayerMemories(nobles[i], _cfg('NOBLE_MEMORY_ACTIONABLE_DAYS', 90));
            for (j = memories.length - 1; j >= 0; j--) {
                if (memories[j].type === 'declaration' && memories[j].source === 'direct' && (memories[j].day || 0) > bestDay) {
                    best = nobles[i];
                    bestDay = memories[j].day || 0;
                    break;
                }
            }
        }
        return best;
    }
    function _getLatestDeclarationMemory(noble) {
        var memories = _getRecentPlayerMemories(noble, _cfg('NOBLE_MEMORY_ACTIONABLE_DAYS', 90));
        for (var i = memories.length - 1; i >= 0; i--) {
            if (memories[i].type === 'declaration') return memories[i];
        }
        return null;
    }
    function _addCoalitionInvitation(k, organizer, coalition) {
        if (!k || !organizer || !coalition) return;
        if (_getPlayerRank(k.id) < 4) return;
        if (!k._coalitionInvitations) k._coalitionInvitations = [];
        k._coalitionInvitations.push({
            coalitionId: coalition.id,
            cause: coalition.cause,
            causeLabel: coalition.causeLabel,
            targetName: coalition.causeData && coalition.causeData.targetName ? coalition.causeData.targetName : '', // v9p33river442: bugfix
            inviterName: _getNobleName(organizer),
            inviterId: organizer.id,
            day: _getDay()
        });
        while (k._coalitionInvitations.length > 5) k._coalitionInvitations.shift();
    }
    function _createMemoryCoalition(k, organizer, cause, causeData, reasonText) {
        var rng = _getRng();
        var nobles;
        var coalition;
        var promoteTargetInfo = null;
        var i;
        if (!k || !organizer || !organizer.alive || !cause || !rng) return null;
        if (!k._nobleCoalitions) k._nobleCoalitions = [];
        if (_hasActiveCoalition(k, cause, causeData && causeData.targetNobleId ? causeData.targetNobleId : null)) return null;
        if (k._nobleCoalitions.filter(function(entry) { return entry.status === 'forming'; }).length >= 3) return null;
        if (!_getCauseLabel(cause)) return null;
        if (cause === 'promote_noble') {
            promoteTargetInfo = _getPromotionTargetInfo(k.id, causeData && causeData.targetNobleId ? causeData.targetNobleId : null); // v9p33river442: bugfix
            if (!promoteTargetInfo.ok) return null;
        }

        coalition = {
            id: 'mem_coal_' + _getDay() + '_' + organizer.id + '_' + cause,
            cause: cause,
            causeLabel: _getCauseLabel(cause),
            organizer: organizer.id,
            organizerName: _getNobleName(organizer),
            members: [{ id: organizer.id, name: _getNobleName(organizer), influence: _computeInfluence(organizer, k.id) }],
            formedDay: _getDay(),
            status: 'forming'
        };
        if (cause === 'promote_noble' && promoteTargetInfo) {
            coalition.causeData = { targetNobleId: promoteTargetInfo.targetId, targetName: promoteTargetInfo.targetName };
        }

        nobles = _getNoblesInKingdom(k.id);
        for (i = 0; i < nobles.length; i++) {
            var recruit = nobles[i];
            var recruitChance = 0.08;
            var agenda = null;
            var relScore;
            if (!recruit || !recruit.alive || recruit.id === organizer.id || recruit.id === k.king) continue;
            try {
                if (Engine.getNobleAgenda) agenda = Engine.getNobleAgenda(recruit.id);
            } catch (e) {}
            if (agenda && agenda.advice) {
                for (var ai = 0; ai < agenda.advice.length; ai++) {
                    if (agenda.advice[ai].actionId === cause) {
                        recruitChance += 0.25;
                        break;
                    }
                }
            }
            relScore = _getNobleRelationshipScore(organizer, recruit.id);
            recruitChance += (relScore - 50) * 0.003;
            recruitChance += Math.min(0.18, _rememberedCauseCount(_getRecentNobleMemories(recruit, _cfg('NOBLE_MEMORY_ACTIONABLE_DAYS', 90)), cause) * 0.06);
            var recruitWarmth = recruit.personality ? (recruit.personality.warmth || 50) : 50; // v9p33river442: bugfix
            var recruitFrugality = recruit.personality ? (recruit.personality.frugality || 50) : 50; // v9p33river442: bugfix
            if (recruitWarmth > 70 && cause !== 'declare_war' && cause !== 'war_offensive') recruitChance += 0.05;
            if (recruitFrugality > 70) recruitChance -= 0.03;
            recruitChance = _chance(recruitChance);
            if (rng.chance(recruitChance)) {
                coalition.members.push({ id: recruit.id, name: _getNobleName(recruit), influence: _computeInfluence(recruit, k.id) });
            }
        }

        if (coalition.members.length < 2) return null;
        k._nobleCoalitions.push(coalition);
        _addCoalitionInvitation(k, organizer, coalition);
        Engine.logEvent('📜 ' + _getNobleName(organizer) + ' ' + reasonText + ' and is rallying support to ' + (cause === 'promote_noble' && coalition.causeData && coalition.causeData.targetName ? ('promote ' + coalition.causeData.targetName) : coalition.causeLabel.toLowerCase()) + '.', {
            type: 'noble_memory_coalition',
            kingdomId: k.id,
            cause: cause,
            organizerId: organizer.id
        }, _getLogCategory(k.id));
        return coalition;
    }

    // v9p33river442: direct player declarations to nobles.
    function playerDeclareToNoble(nobleId, category, targetData) {
        var noble = Engine.findPerson ? Engine.findPerson(nobleId) : null;
        var kingdomId;
        var nobleRank;
        var playerTownId;
        var playerRank;
        var targetInfo;
        var promotionTargetInfo;
        var playerRel;
        var alignmentScore;
        var sentiment = 0;
        var reaction = 'neutral';
        var message;
        if (!noble || !noble.alive) return { success: false, message: 'That noble is unavailable.' };
        if (!DECLARATION_TYPES[category]) return { success: false, message: 'Unknown declaration.' };
        if (!_getPlayerState()) return { success: false, message: 'Player data is not ready yet.' };

        kingdomId = _getNobleKingdomId(noble);
        playerTownId = _getPlayerTownId();
        playerRank = _getPlayerRank(kingdomId);
        if (!kingdomId) return { success: false, message: 'That noble has no recognized kingdom.' };
        nobleRank = _getNobleRank(noble, kingdomId);
        if (nobleRank < 4 && noble.occupation !== 'noble') return { success: false, message: 'That person is not part of the noble court.' }; // v9p33river442: bugfix
        if (!playerTownId || noble.townId !== playerTownId) return { success: false, message: 'You must speak to this noble in person.' };
        if (playerRank < 4) return { success: false, message: 'Only nobles may engage in this kind of political declaration.' };

        targetInfo = _getTargetInfo(category, targetData, kingdomId);
        if (category === 'promote_noble') {
            promotionTargetInfo = _getPromotionTargetInfo(kingdomId, targetInfo.targetId); // v9p33river442: bugfix
            if (!promotionTargetInfo.ok) return { success: false, message: promotionTargetInfo.message };
            targetInfo.targetId = promotionTargetInfo.targetId;
            targetInfo.targetName = promotionTargetInfo.targetName;
        }
        alignmentScore = _scoreDeclarationAlignment(noble, kingdomId, category, targetInfo);
        playerRel = _getPlayerRelationshipLevel(noble.id);

        if (typeof Game !== 'undefined' && Game.advanceTicks) Game.advanceTicks(2);
        try {
            if (typeof Player !== 'undefined' && Player.modifyEnergy) Player.modifyEnergy(-0.5);
        } catch (e) {}

        if (playerRel > 60) {
            if (alignmentScore > 0) {
                _modifyPlayerRelationship(noble.id, 3);
                sentiment = 1;
                reaction = 'supportive';
            } else {
                _modifyPlayerRelationship(noble.id, 1);
                sentiment = 0;
                reaction = alignmentScore < 0 ? 'neutral' : 'supportive';
            }
        } else if (playerRel < 20 && alignmentScore < 0) {
            _modifyPlayerRelationship(noble.id, -2);
            sentiment = -1;
            reaction = alignmentScore <= -2 ? 'hostile' : 'opposed';
        } else {
            sentiment = alignmentScore > 0 ? 1 : (alignmentScore < 0 ? -1 : 0);
            reaction = sentiment > 0 ? 'supportive' : (sentiment < 0 ? 'opposed' : 'neutral');
        }

        _addPlayerMemory(noble, {
            type: 'declaration',
            source: 'direct',
            category: category,
            detail: _buildDeclarationDetail(category, targetInfo),
            actorId: 'player',
            targetId: targetInfo.targetId || null,
            day: _getDay(),
            sentiment: sentiment,
            kingdomId: kingdomId
        });

        if (reaction === 'supportive') {
            message = noble.firstName + ' nods with clear approval. "Your position on ' + _getCategoryLabel(category) + ' has my sympathy."';
        } else if (reaction === 'hostile') {
            message = noble.firstName + ' stiffens. "I will remember this. Your vision threatens the order of the realm."';
        } else if (reaction === 'opposed') {
            message = noble.firstName + ' frowns. "I cannot agree with that course."';
        } else {
            message = noble.firstName + ' listens carefully and gives little away.';
        }

        return { success: true, message: message, reaction: reaction };
    }

    // v9p33river442: noble observation hook called by engine events.
    function recordNobleObservation(eventType, eventData, locationTownId) {
        var world = _getWorld();
        var rng = _getRng();
        var kingdomId;
        var nobles;
        var i;
        if (!world || !rng || !eventData) return;
        kingdomId = eventData.kingdomId || '';
        if (!kingdomId) return;
        nobles = _getNoblesInKingdom(kingdomId);

        for (i = 0; i < nobles.length; i++) {
            var observer = nobles[i];
            var noticeChance;
            var np;
            var sentiment;
            if (!observer || !observer.alive || observer.id === eventData.actorId) continue;
            np = observer.personality || {};
            noticeChance = observer.townId && locationTownId && observer.townId === locationTownId ? _cfg('NOBLE_MEMORY_OBSERVATION_SAME_TOWN', 0.70) : _cfg('NOBLE_MEMORY_OBSERVATION_DIFF_TOWN', 0.15);
            if ((np.intelligence || 50) >= 75) noticeChance += _cfg('NOBLE_MEMORY_INTEL_BRILLIANT_BONUS', 0.20);
            else if ((np.intelligence || 50) < 40) noticeChance -= _cfg('NOBLE_MEMORY_INTEL_DIM_PENALTY', 0.15);
            if ((np.ambition || 50) > 70) noticeChance += _cfg('NOBLE_MEMORY_AMBITION_BONUS', 0.10);
            if ((observer.kingLoyalty != null ? observer.kingLoyalty : (np.loyalty || 50)) > 70) noticeChance += _cfg('NOBLE_MEMORY_LOYALTY_BONUS', 0.10);
            if ((np.frugality || 50) > 70) noticeChance += 0.15;
            noticeChance = _chance(noticeChance);
            if (!rng.chance(noticeChance)) continue;
            if (_hasRecentMemory(observer, eventData.category, _isPlayerActor(eventData.actorId) ? 'player' : eventData.actorId, _cfg('NOBLE_MEMORY_DEDUP_DAYS', 3))) continue;

            sentiment = _evaluateObservedSentiment(observer, eventData);
            if (_isPlayerActor(eventData.actorId)) {
                _addPlayerMemory(observer, {
                    type: 'observed',
                    source: 'observed',
                    category: eventData.category || eventType || 'observed',
                    detail: eventData.detail || '',
                    actorId: 'player',
                    targetId: eventData.targetId || null,
                    day: _getDay(),
                    sentiment: sentiment,
                    kingdomId: kingdomId
                });
            } else {
                _addNobleMemory(observer, {
                    type: 'observed',
                    source: 'observed',
                    category: eventData.category || eventType || 'observed',
                    detail: eventData.detail || '',
                    actorId: eventData.actorId || '',
                    targetId: eventData.targetId || null,
                    day: _getDay(),
                    sentiment: sentiment,
                    kingdomId: kingdomId
                });
            }
            _applyObservationConsequences(observer, eventData, sentiment);
        }
    }

    function _getNobleEffectiveLoyalty(noble) {
        var personality = noble && noble.personality ? noble.personality : {};
        if (!noble) return 50;
        if (noble.kingLoyalty != null) return noble.kingLoyalty;
        if (personality.loyalty != null) return personality.loyalty;
        return 50;
    }
    function _normalizeNobleQuestionId(questionId) {
        return NOBLE_QUESTION_ID_ALIASES[questionId] || questionId || '';
    }
    function _getNobleQuestionDef(questionId) {
        var normalizedId = _normalizeNobleQuestionId(questionId);
        var i;
        for (i = 0; i < NOBLE_QUESTION_DEFS.length; i++) {
            if (NOBLE_QUESTION_DEFS[i].id === normalizedId) return NOBLE_QUESTION_DEFS[i];
        }
        return null;
    }
    function _questionHasTag(questionDef, tag) {
        return !!(questionDef && questionDef.tags && questionDef.tags.indexOf(tag) >= 0);
    }
    function _isKingdomAtWar(kingdom) {
        if (!kingdom || !kingdom.atWar) return false;
        if (Array.isArray(kingdom.atWar)) return kingdom.atWar.length > 0;
        return !!kingdom.atWar.size;
    }
    function _getNobleQuestionTrait(noble) {
        var personality = noble && noble.personality ? noble.personality : {};
        var traitKeys = ['loyalty', 'ambition', 'warmth', 'intelligence', 'honesty', 'selfishness', 'frugality'];
        var bestKey = 'loyalty';
        var bestValue = personality.loyalty != null ? personality.loyalty : 50;
        var i;
        for (i = 0; i < traitKeys.length; i++) {
            var key = traitKeys[i];
            var value = personality[key] != null ? personality[key] : 50;
            if (value > bestValue) {
                bestKey = key;
                bestValue = value;
            }
        }
        return { key: bestKey, value: bestValue };
    }
    function _findNobleQuestionRelationshipTarget(noble, kingdomId, wantLowest, excludeKing) {
        var rels = noble && noble._nobleRelationships ? noble._nobleRelationships : null;
        var kingId = null;
        var best = null;
        var bestScore = wantLowest ? 101 : -101;
        var otherId;
        if (!rels) return null;
        if (excludeKing && kingdomId && Engine.findKingdom) {
            var kingdom = Engine.findKingdom(kingdomId);
            if (kingdom && kingdom.king) kingId = kingdom.king;
        }
        for (otherId in rels) {
            var score;
            var other;
            var otherKingdomId;
            var otherRank;
            if (otherId === noble.id) continue;
            if (kingId && otherId === kingId) continue;
            score = rels[otherId];
            other = Engine.findPerson ? Engine.findPerson(otherId) : null;
            if (!other || other.alive === false) continue;
            otherKingdomId = _getNobleKingdomId(other);
            if (kingdomId && otherKingdomId !== kingdomId) continue;
            otherRank = _getNobleRank(other, otherKingdomId || kingdomId);
            if (otherRank < 4 && other.occupation !== 'noble') continue;
            if ((wantLowest && score < bestScore) || (!wantLowest && score > bestScore)) {
                bestScore = score;
                best = { person: other, score: score };
            }
        }
        return best;
    }
    function _findWorstKingdomRelation(kingdom) {
        var worstId = null;
        var worstScore = 1;
        var otherId;
        if (!kingdom || !kingdom.relations) return null;
        for (otherId in kingdom.relations) {
            var score = kingdom.relations[otherId] || 0;
            if (score < worstScore) {
                worstScore = score;
                worstId = otherId;
            }
        }
        if (!worstId) return null;
        return { kingdom: Engine.findKingdom ? Engine.findKingdom(worstId) : null, score: worstScore };
    }
    function _getNobleAgendaData(nobleId) {
        try {
            if (Engine.getNobleAgenda) return Engine.getNobleAgenda(nobleId) || null;
        } catch (e) {}
        return null;
    }
    function _getNobleAgendaActionId(agenda) {
        return agenda && agenda.advice && agenda.advice[0] ? (agenda.advice[0].actionId || '') : '';
    }
    function _hasAnyQuestionFactAbout(noble, targetId) {
        var memory = _initNobleMemory(noble);
        var i;
        if (!memory || !targetId) return false;
        for (i = 0; i < memory.nobleActions.length; i++) {
            if (memory.nobleActions[i].type === 'question_answer' && memory.nobleActions[i].actorId === targetId) return true;
        }
        return false;
    }
    function _hasQuestionFact(noble, questionId, targetId) {
        var memory = _initNobleMemory(noble);
        var normalizedId = _normalizeNobleQuestionId(questionId);
        var i;
        if (!memory || !targetId) return false;
        for (i = 0; i < memory.nobleActions.length; i++) {
            if (memory.nobleActions[i].type === 'question_answer' && memory.nobleActions[i].category === normalizedId && memory.nobleActions[i].actorId === targetId) return true;
        }
        return false;
    }
    function _pickWeightedEntry(entries, rng) {
        var total = 0;
        var i;
        var roll;
        if (!entries || !entries.length) return null;
        for (i = 0; i < entries.length; i++) total += Math.max(0, entries[i].weight || 0);
        if (!rng || !rng.random || total <= 0) return entries[0].value;
        roll = rng.random() * total;
        for (i = 0; i < entries.length; i++) {
            roll -= Math.max(0, entries[i].weight || 0);
            if (roll <= 0) return entries[i].value;
        }
        return entries[entries.length - 1].value;
    }
    function _getLatestRecentMemoryEntry(noble, maxAgeDays) {
        var memory = _initNobleMemory(noble);
        var best = null;
        var i;
        var age = maxAgeDays == null ? 30 : maxAgeDays;
        if (!memory) return null;
        for (i = 0; i < memory.playerActions.length; i++) {
            if ((_getDay() - (memory.playerActions[i].day || 0)) > age) continue;
            if (!best || (memory.playerActions[i].day || 0) > (best.day || 0)) best = memory.playerActions[i];
        }
        for (i = 0; i < memory.nobleActions.length; i++) {
            if ((_getDay() - (memory.nobleActions[i].day || 0)) > age) continue;
            if (!best || (memory.nobleActions[i].day || 0) > (best.day || 0)) best = memory.nobleActions[i];
        }
        return best;
    }
    function _memoryToOccupation(memory) {
        var cause;
        if (!memory) return null;
        if (memory.category === 'coalition_formed') return { detail: 'court_faction_building', sentiment: 0 };
        if (memory.category === 'conspiracy_joined' || memory.category === 'conspiracy_formed' || memory.category === 'move_against_king_suspicion') return { detail: 'plot_watching', sentiment: -1 };
        if (memory.type === 'question_asked') return { detail: 'sounding_out_court', sentiment: 0 };
        if (memory.category === 'feast_behavior') return { detail: 'court_maneuvering', sentiment: 0 };
        cause = _memoryToCause(memory);
        if (cause === 'declare_war' || cause === 'war_offensive' || cause === 'build_walls') return { detail: 'war_preparations', sentiment: 0 };
        if (cause === 'make_peace' || cause === 'form_alliance') return { detail: 'diplomatic_work', sentiment: 0 };
        if (cause === 'build_infrastructure' || cause === 'medical_funding') return { detail: 'public_works', sentiment: 1 };
        if (cause === 'lower_taxes' || cause === 'raise_taxes' || cause === 'improve_happiness') return { detail: 'policy_lobbying', sentiment: 0 };
        return null;
    }
    function _getNobleKingOpinionFact(noble, kingdom) {
        var loyalty = _getNobleEffectiveLoyalty(noble);
        if (loyalty >= 75) return { detail: 'approves', sentiment: 1, targetId: kingdom && kingdom.king ? kingdom.king : null };
        if (loyalty >= 50) return { detail: 'cautious', sentiment: 0, targetId: kingdom && kingdom.king ? kingdom.king : null };
        return { detail: 'disapproves', sentiment: -1, targetId: kingdom && kingdom.king ? kingdom.king : null };
    }
    function _extractNobleKingOpinionFact(target, kingdom) {
        var opinion = _getNobleKingOpinionFact(target, kingdom);
        return { category: 'king_opinion', detail: opinion.detail, sentiment: opinion.sentiment, targetId: opinion.targetId || null };
    }
    function _extractNobleCourtStateFact(target, kingdom) {
        var war = _isKingdomAtWar(kingdom);
        var happiness = kingdom && kingdom.happiness != null ? kingdom.happiness : 50;
        var treasury = kingdom && kingdom.gold ? kingdom.gold : 0;
        if (war && happiness < 40) return { category: 'court_state', detail: 'war_strained', sentiment: -1 };
        if (war) return { category: 'court_state', detail: 'war_focused', sentiment: 0 };
        if (treasury < 2000) return { category: 'court_state', detail: 'treasury_anxious', sentiment: -1 };
        if (happiness >= 65) return { category: 'court_state', detail: 'calm', sentiment: 1 };
        return { category: 'court_state', detail: 'watchful', sentiment: 0 };
    }
    function _extractNoblePriorityFact(target) {
        var trait = _getNobleQuestionTrait(target);
        return { category: 'noble_priority', detail: trait.key, sentiment: 0 };
    }
    function _extractNobleCourtFriendFact(target, kingdom) {
        var kingdomId = kingdom ? kingdom.id : _getNobleKingdomId(target);
        var best = _findNobleQuestionRelationshipTarget(target, kingdomId, false, true);
        if (!best || !best.person) return { category: 'court_friend', detail: 'guarded', sentiment: 0, targetId: null };
        return { category: 'court_friend', detail: best.score >= 50 ? 'trusted_friend' : 'easy_company', sentiment: best.score >= 50 ? 1 : 0, targetId: best.person.id };
    }
    function _extractNobleCourtEnemyFact(target, kingdom) {
        var kingdomId = kingdom ? kingdom.id : _getNobleKingdomId(target);
        var worst = _findNobleQuestionRelationshipTarget(target, kingdomId, true, true);
        if (!worst || !worst.person) return { category: 'court_enemy', detail: 'no_single_rival', sentiment: 0, targetId: null };
        return { category: 'court_enemy', detail: worst.score <= -50 ? 'bitter_rival' : 'rival', sentiment: -1, targetId: worst.person.id };
    }
    function _extractNobleAdviceFact(target) {
        var agenda = _getNobleAgendaData(target && target.id);
        var actionId = _getNobleAgendaActionId(agenda);
        if (actionId) return { category: 'noble_advice', detail: actionId, sentiment: 0, cause: actionId };
        return { category: 'noble_advice', detail: 'steady_governance', sentiment: 0, cause: '' };
    }
    function _extractNobleDirectionFact(target, kingdom) {
        var loyalty = _getNobleEffectiveLoyalty(target);
        var happiness = kingdom && kingdom.happiness != null ? kingdom.happiness : 50;
        if (loyalty >= 65 && happiness >= 55) return { category: 'noble_direction', detail: 'right_direction', sentiment: 1 };
        if (loyalty < 35 && happiness < 45) return { category: 'noble_direction', detail: 'wrong_direction', sentiment: -1 };
        if (happiness < 40) return { category: 'noble_direction', detail: 'people_strained', sentiment: -1 };
        if (loyalty < 40) return { category: 'noble_direction', detail: 'needs_better_guidance', sentiment: -1 };
        return { category: 'noble_direction', detail: 'cautious_stability', sentiment: 0 };
    }
    function _extractNobleAmbitionsFact(target, kingdom) {
        var ambition = target && target.personality && target.personality.ambition != null ? target.personality.ambition : 50;
        var rank = _getNobleRank(target, kingdom ? kingdom.id : _getNobleKingdomId(target));
        if (ambition >= 80 && rank < 7) return { category: 'noble_ambitions', detail: 'seeking_promotion', sentiment: 1 };
        if (ambition >= 60) return { category: 'noble_ambitions', detail: 'seeking_influence', sentiment: 1 };
        if (rank >= 6) return { category: 'noble_ambitions', detail: 'guarding_position', sentiment: 0 };
        return { category: 'noble_ambitions', detail: 'measured_service', sentiment: 0 };
    }
    function _extractNobleOccupiedFact(target, kingdom) {
        var latest = _getLatestRecentMemoryEntry(target, 30);
        var fromMemory = _memoryToOccupation(latest);
        var personality = target && target.personality ? target.personality : {};
        var loyalty = _getNobleEffectiveLoyalty(target);
        if (fromMemory) return { category: 'noble_occupied', detail: fromMemory.detail, sentiment: fromMemory.sentiment };
        if (_isKingdomAtWar(kingdom)) {
            if ((personality.ambition || 50) > 65) return { category: 'noble_occupied', detail: 'war_preparations', sentiment: 0 };
            return { category: 'noble_occupied', detail: 'war_logistics', sentiment: 0 };
        }
        if (kingdom && (kingdom.happiness != null ? kingdom.happiness : 50) < 35) return { category: 'noble_occupied', detail: 'calming_unrest', sentiment: 0 };
        if (loyalty > 70) return { category: 'noble_occupied', detail: 'supporting_crown', sentiment: 1 };
        if ((personality.ambition || 50) > 65) return { category: 'noble_occupied', detail: 'expanding_influence', sentiment: 0 };
        if ((personality.warmth || 50) > 60) return { category: 'noble_occupied', detail: 'settling_disputes', sentiment: 1 };
        if ((personality.frugality || 50) > 55) return { category: 'noble_occupied', detail: 'reviewing_accounts', sentiment: 0 };
        return { category: 'noble_occupied', detail: 'court_business', sentiment: 0 };
    }
    function _extractNobleNextBusinessFact(target, kingdom) {
        var agenda = _getNobleAgendaData(target && target.id);
        var actionId = _getNobleAgendaActionId(agenda);
        var personality = target && target.personality ? target.personality : {};
        var loyalty = _getNobleEffectiveLoyalty(target);
        if (actionId) return { category: 'noble_next_business', detail: actionId, sentiment: 0, cause: actionId };
        if ((personality.ambition || 50) > 65) return { category: 'noble_next_business', detail: 'advancement', sentiment: 0 };
        if (loyalty > 60) return { category: 'noble_next_business', detail: 'support_crown', sentiment: 1 };
        if (kingdom && (kingdom.happiness || 50) < 40) return { category: 'noble_next_business', detail: 'restore_order', sentiment: 0 };
        return { category: 'noble_next_business', detail: 'court_matters', sentiment: 0 };
    }
    function _extractNobleCourtAlliesFact(target, kingdom) {
        var kingdomId = kingdom ? kingdom.id : _getNobleKingdomId(target);
        var ally = _findNobleQuestionRelationshipTarget(target, kingdomId, false, true);
        if (ally && ally.person) return { category: 'court_allies', detail: 'ally_network', sentiment: 1, targetId: ally.person.id };
        return { category: 'court_allies', detail: 'independent', sentiment: 0, targetId: null };
    }
    function _extractNobleFavorHookFact(target, kingdom) {
        var personality = target && target.personality ? target.personality : {};
        if ((personality.selfishness || 50) > 55) return { category: 'favor_hook', detail: 'trade_dispute', sentiment: 0 };
        if ((personality.ambition || 50) > 60) return { category: 'favor_hook', detail: 'court_reputation', sentiment: 0 };
        if ((personality.warmth || 50) > 55) return { category: 'favor_hook', detail: 'tenant_relief', sentiment: 1 };
        if (_isKingdomAtWar(kingdom)) return { category: 'favor_hook', detail: 'war_supplies', sentiment: 0 };
        if (target && (target._financiallyStressed || (target.gold || 0) < 3000)) return { category: 'favor_hook', detail: 'needs_investor', sentiment: 1 };
        return { category: 'favor_hook', detail: 'public_works', sentiment: 1 };
    }
    function _extractNobleWinSupportFact(target) {
        var agenda = _getNobleAgendaData(target && target.id);
        var actionId = _getNobleAgendaActionId(agenda);
        var personality = target && target.personality ? target.personality : {};
        var loyalty = _getNobleEffectiveLoyalty(target);
        if (actionId) return { category: 'win_support', detail: actionId, sentiment: 1, cause: actionId };
        if (loyalty < 35) return { category: 'win_support', detail: 'regime_change', sentiment: -1 };
        if ((personality.ambition || 50) > 70) return { category: 'win_support', detail: 'personal_advancement', sentiment: 0 };
        return { category: 'win_support', detail: 'kingdom_service', sentiment: 1 };
    }
    function _extractNobleWatchFact(target, kingdom) {
        var kingdomId = kingdom ? kingdom.id : _getNobleKingdomId(target);
        var worst = _findNobleQuestionRelationshipTarget(target, kingdomId, true, true);
        if (worst && worst.person) return { category: 'noble_watch', detail: 'watch_rival', sentiment: -1, targetId: worst.person.id };
        return { category: 'noble_watch', detail: 'no_clear_watch', sentiment: 0, targetId: null };
    }
    function _extractNobleCourtForecastFact(target, kingdom) {
        var kingPersonality = kingdom && kingdom.kingPersonality ? kingdom.kingPersonality : {};
        var treasury = kingdom ? (kingdom.gold || 0) : 0;
        var happiness = kingdom && kingdom.happiness != null ? kingdom.happiness : 50;
        if (_isKingdomAtWar(kingdom)) return { category: 'court_forecast', detail: 'war_offensive', sentiment: -1, cause: 'war_offensive' };
        if (treasury < 2000) return { category: 'court_forecast', detail: 'raise_taxes', sentiment: -1, cause: 'raise_taxes' };
        if (happiness < 35) return { category: 'court_forecast', detail: 'improve_happiness', sentiment: 1, cause: 'improve_happiness' };
        if (kingPersonality.ambition === 'ambitious') return { category: 'court_forecast', detail: 'declare_war', sentiment: -1, cause: 'declare_war' };
        if (kingPersonality.temperament === 'kind' || kingPersonality.generosity === 'generous') return { category: 'court_forecast', detail: 'improve_happiness', sentiment: 1, cause: 'improve_happiness' };
        return { category: 'court_forecast', detail: 'steady_course', sentiment: 0, cause: '' };
    }
    function _isNobleInvestmentInterested(noble) {
        var personality = noble && noble.personality ? noble.personality : {};
        if (!noble) return false;
        if (noble._financiallyStressed || (noble.gold || 0) < 3000) return true;
        if ((personality.ambition || 50) > 60) return true;
        if (noble.buildings && noble.buildings.length > 0) return true;
        return false;
    }
    function _extractNobleInvestmentFact(target) {
        var personality = target && target.personality ? target.personality : {};
        if (target && (target._financiallyStressed || (target.gold || 0) < 3000)) return { category: 'noble_investment', detail: 'needs_capital', sentiment: 1 };
        if ((personality.ambition || 50) > 60) return { category: 'noble_investment', detail: 'seeks_expansion', sentiment: 1 };
        if (target && target.buildings && target.buildings.length > 0) return { category: 'noble_investment', detail: 'estate_improvements', sentiment: 1 };
        return { category: 'noble_investment', detail: 'not_interested', sentiment: 0 };
    }
    function _extractNobleMoveAgainstKingFact(target, kingdom) {
        var personality = target && target.personality ? target.personality : {};
        var loyalty = _getNobleEffectiveLoyalty(target);
        var ambition = personality.ambition != null ? personality.ambition : 50;
        if (loyalty < 30 && ambition > 70) return { category: 'move_against_king', detail: 'willing', sentiment: -1, targetId: kingdom && kingdom.king ? kingdom.king : null };
        if (loyalty >= 65) return { category: 'move_against_king', detail: 'loyal', sentiment: 1, targetId: kingdom && kingdom.king ? kingdom.king : null };
        return { category: 'move_against_king', detail: 'pressure_only', sentiment: 0, targetId: kingdom && kingdom.king ? kingdom.king : null };
    }
    function _extractNobleSecretFact(target) {
        var agenda = _getNobleAgendaData(target && target.id);
        var personality = target && target.personality ? target.personality : {};
        var loyalty = _getNobleEffectiveLoyalty(target);
        if ((personality.honesty || 50) < 35 && (personality.ambition || 50) > 60) return { category: 'noble_secret', detail: 'hidden_pacts', sentiment: -1 };
        if (loyalty < 35) return { category: 'noble_secret', detail: 'crown_doubts', sentiment: -1 };
        if ((personality.selfishness || 50) > 65) return { category: 'noble_secret', detail: 'house_first', sentiment: -1 };
        if (agenda && agenda.goals && agenda.goals.length > 0) return { category: 'noble_secret', detail: 'long_game', sentiment: 0 };
        return { category: 'noble_secret', detail: 'keen_observer', sentiment: 0 };
    }
    function _extractNobleThreatFact(target, kingdom) {
        var worst = _findWorstKingdomRelation(kingdom);
        var loyalty = _getNobleEffectiveLoyalty(target);
        if (worst && worst.kingdom && worst.score < -30) return { category: 'noble_threat', detail: 'foreign_threat', sentiment: -1, targetId: worst.kingdom.id };
        if ((kingdom && (kingdom.happiness != null ? kingdom.happiness : 50) < 40) || loyalty < 35) return { category: 'noble_threat', detail: 'internal_division', sentiment: -1 };
        return { category: 'noble_threat', detail: 'complacency', sentiment: 0 };
    }
    function _extractNobleAsKingFact(target) {
        var agenda = _getNobleAgendaData(target && target.id);
        var actionId = _getNobleAgendaActionId(agenda);
        if (actionId) return { category: 'noble_as_king', detail: actionId, sentiment: 0, cause: actionId };
        return { category: 'noble_as_king', detail: 'clearer_course', sentiment: 0, cause: '' };
    }
    function _getQuestionTruthfulness(asker, target, questionDef, trustScore) {
        var personality = target && target.personality ? target.personality : {};
        var honesty = personality.honesty != null ? personality.honesty : 50;
        var intelligence = personality.intelligence != null ? personality.intelligence : 50;
        var targetRel = _getNobleRelationshipScore(target, asker.id);
        var mutualTrust = Math.min(trustScore, targetRel);
        if (honesty > 65) return { truthfulness: 'honest', confidence: 0.8 };
        if (intelligence > 70 && honesty >= 45) return { truthfulness: 'honest', confidence: 0.8 };
        if (honesty < 35 && mutualTrust < 40 && intelligence <= 70) return { truthfulness: 'evasive', confidence: 0.4 };
        if (_questionHasTag(questionDef, 'dangerous') && honesty < 50 && mutualTrust < (questionDef.trustRequired + 10) && intelligence <= 70) return { truthfulness: 'evasive', confidence: 0.4 };
        if (intelligence > 70) return { truthfulness: 'partial', confidence: 0.7 };
        return { truthfulness: 'partial', confidence: 0.6 };
    }
    function _finalizeQuestionFact(asker, target, questionDef, fact, trustScore) {
        var truth = _getQuestionTruthfulness(asker, target, questionDef, trustScore);
        var finalFact = {
            category: fact && fact.category ? fact.category : questionDef.id,
            detail: fact && fact.detail ? fact.detail : 'unknown',
            sentiment: fact && fact.sentiment != null ? fact.sentiment : 0,
            targetId: fact && fact.targetId != null ? fact.targetId : null,
            kingdomId: fact && fact.kingdomId ? fact.kingdomId : (_getNobleKingdomId(target) || ''),
            cause: fact && fact.cause ? fact.cause : '',
            confidence: truth.confidence,
            truthfulness: truth.truthfulness
        };
        if (truth.truthfulness === 'evasive') {
            if (_questionHasTag(questionDef, 'dangerous')) {
                finalFact.detail = 'evasive';
                finalFact.sentiment = 0;
                finalFact.targetId = null;
                finalFact.cause = '';
            } else if (finalFact.targetId && _getNobleRelationshipScore(target, asker.id) < 30) {
                finalFact.targetId = null;
            }
        }
        if (truth.truthfulness === 'partial' && _questionHasTag(questionDef, 'dangerous') && finalFact.targetId) finalFact.targetId = null;
        return finalFact;
    }
    function _pickNobleQuestionTarget(asker, nobles, kingdom, rng) {
        var entries = [];
        var personality = asker && asker.personality ? asker.personality : {};
        var myRank = _getNobleRank(asker, kingdom ? kingdom.id : _getNobleKingdomId(asker));
        var myLoyalty = _getNobleEffectiveLoyalty(asker);
        var i;
        for (i = 0; i < nobles.length; i++) {
            var target = nobles[i];
            var rel;
            var targetRank;
            var targetLoyalty;
            var weight = 1;
            if (!target || !target.alive || target.id === asker.id) continue;
            if (kingdom && kingdom.king === target.id) continue;
            rel = _getNobleRelationshipScore(asker, target.id);
            targetRank = _getNobleRank(target, kingdom ? kingdom.id : _getNobleKingdomId(target));
            targetLoyalty = _getNobleEffectiveLoyalty(target);
            if (!_hasAnyQuestionFactAbout(asker, target.id)) weight += 1.5;
            if (rel >= 45 && rel <= 55) weight += 1.5;
            if ((personality.warmth || 50) > 60 && rel > 55) weight += 2;
            if ((personality.ambition || 50) > 70 && targetRank > myRank) weight += 2.5;
            if ((personality.intelligence || 50) > 70 && rel < 45) weight += 1.5;
            if (myLoyalty > 70 && targetLoyalty < 50) weight += 2;
            if ((personality.ambition || 50) > 65 && rel < 35) weight += 0.75;
            if (!target._nobleRelationships || target._nobleRelationships[asker.id] == null) weight += 0.5;
            entries.push({ value: target, weight: weight });
        }
        return _pickWeightedEntry(entries, rng);
    }
    function _pickNobleQuestionDef(asker, target, kingdom, rng) {
        var entries = [];
        var personality = asker && asker.personality ? asker.personality : {};
        var trustScore = _getNobleRelationshipScore(asker, target.id);
        var askerLoyalty = _getNobleEffectiveLoyalty(asker);
        var targetLoyalty = _getNobleEffectiveLoyalty(target);
        var askerRank = _getNobleRank(asker, kingdom ? kingdom.id : _getNobleKingdomId(asker));
        var targetRank = _getNobleRank(target, kingdom ? kingdom.id : _getNobleKingdomId(target));
        var askerAgenda = _getNobleAgendaData(asker && asker.id);
        var askerCause = _getNobleAgendaActionId(askerAgenda);
        var cooldownDays = _cfg('NOBLE_MEMORY_QUESTION_COOLDOWN_DAYS', 14);
        var i;
        for (i = 0; i < NOBLE_QUESTION_DEFS.length; i++) {
            var def = NOBLE_QUESTION_DEFS[i];
            var weight = 1;
            if (trustScore < def.trustRequired) continue;
            if (_hasRecentMemory(asker, 'question_asked_' + def.id, target.id, cooldownDays)) continue;
            if (!_hasQuestionFact(asker, def.id, target.id)) weight += 1.5;
            if ((personality.ambition || 50) > 70) {
                if (_questionHasTag(def, 'political')) weight += 2;
                if (_questionHasTag(def, 'dangerous')) weight += 1.5;
            }
            if ((personality.intelligence || 50) > 70) {
                if (_questionHasTag(def, 'dangerous')) weight += 2;
                if (_questionHasTag(def, 'political')) weight += 1.5;
                if (def.id === 'court_allies' || def.id === 'court_enemy' || def.id === 'noble_watch') weight += 1;
            }
            if (askerLoyalty > 70) {
                if (def.id === 'king_opinion') weight += 4;
                if (def.id === 'move_against_king') weight += 2.5;
                if (def.id === 'noble_threat') weight += 1;
            }
            if ((personality.warmth || 50) > 60) {
                if (_questionHasTag(def, 'personal')) weight += 2;
                if (_questionHasTag(def, 'court')) weight += 1.5;
            }
            if (askerCause && (def.id === 'noble_advice' || def.id === 'noble_next_business' || def.id === 'win_support' || def.id === 'noble_as_king')) weight += 1;
            if (targetRank > askerRank && ((personality.ambition || 50) > 70 || (personality.intelligence || 50) > 70) && (def.id === 'noble_ambitions' || def.id === 'noble_as_king' || def.id === 'noble_advice')) weight += 1.5;
            if (targetLoyalty < 45 && askerLoyalty > 70 && (def.id === 'king_opinion' || def.id === 'move_against_king' || def.id === 'noble_watch')) weight += 2;
            if (trustScore < 45 && (_questionHasTag(def, 'dangerous') || _questionHasTag(def, 'personal'))) weight -= 1;
            if (weight > 0) entries.push({ value: def, weight: weight });
        }
        return _pickWeightedEntry(entries, rng);
    }
    function _askNobleQuestionPair(asker, target, questionId, kingdom, rng, ignoreCooldown) {
        var def = _getNobleQuestionDef(questionId);
        var trustScore;
        var fact;
        if (!asker || !target || !kingdom) return { success: false, message: 'Questioning data is incomplete.' };
        if (target.id === asker.id) return { success: false, message: 'A noble cannot question themselves.' };
        if (kingdom.king === target.id) return { success: false, message: 'This question set is for non-royal nobles.' };
        if (_getNobleKingdomId(target) !== kingdom.id) return { success: false, message: 'Both nobles must belong to the same kingdom.' };
        if (!def) return { success: false, message: 'Unknown noble question.' };
        trustScore = _getNobleRelationshipScore(asker, target.id);
        if (trustScore < def.trustRequired) return { success: false, message: 'Trust is too low for that question.' };
        if (!ignoreCooldown && _hasRecentMemory(asker, 'question_asked_' + def.id, target.id, _cfg('NOBLE_MEMORY_QUESTION_COOLDOWN_DAYS', 14))) return { success: false, message: 'That question was asked too recently.' };
        fact = def.extract(target, kingdom, asker);
        if (!fact) return { success: false, message: 'No answer was gathered.' };
        fact = _finalizeQuestionFact(asker, target, def, fact, trustScore);
        _addNobleMemory(asker, {
            type: 'question_asked',
            source: 'direct',
            category: 'question_asked_' + def.id,
            detail: 'Asked ' + _getNobleName(target) + ': ' + def.text,
            actorId: target.id,
            targetId: null,
            day: _getDay(),
            sentiment: 0,
            kingdomId: kingdom.id
        });
        return {
            success: true,
            targetId: target.id,
            target: target,
            questionId: def.id,
            questionText: def.text,
            fact: fact,
            relationship: trustScore,
            memory: {
                type: 'question_answer',
                source: 'direct',
                category: def.id,
                detail: fact.detail,
                actorId: target.id,
                targetId: fact.targetId || null,
                day: _getDay(),
                sentiment: fact.sentiment,
                kingdomId: fact.kingdomId || kingdom.id || ''
            }
        };
    }
    function _nobleAskQuestion(asker, nobles, kingdom, rng) {
        var target = _pickNobleQuestionTarget(asker, nobles, kingdom, rng);
        var def;
        var result;
        if (!target) return null;
        def = _pickNobleQuestionDef(asker, target, kingdom, rng);
        if (!def) return null;
        result = _askNobleQuestionPair(asker, target, def.id, kingdom, rng, false);
        return result && result.success ? result : null;
    }
    function _upsertNobleQuestionFact(noble, questionId, targetId, fact, day) {
        var memory = _initNobleMemory(noble);
        var normalizedId = _normalizeNobleQuestionId(questionId);
        var i;
        if (!memory) return null;
        for (i = 0; i < memory.nobleActions.length; i++) {
            var m = memory.nobleActions[i];
            if (m.type === 'question_answer' && m.category === normalizedId && m.actorId === targetId) {
                m.day = day;
                m.detail = fact.detail;
                m.sentiment = fact.sentiment;
                m.targetId = fact.targetId || null;
                m.kingdomId = fact.kingdomId || m.kingdomId || '';
                return m;
            }
        }
        return _addNobleMemory(noble, {
            type: 'question_answer',
            source: 'direct',
            category: normalizedId,
            detail: fact.detail,
            actorId: targetId,
            targetId: fact.targetId || null,
            day: day,
            sentiment: fact.sentiment,
            kingdomId: fact.kingdomId || ''
        });
    }
    function _reactToLearnedFact(noble, questionResult, kingdom, rng) {
        var fact = questionResult ? questionResult.fact : null;
        var target = questionResult && questionResult.target ? questionResult.target : (questionResult && questionResult.targetId && Engine.findPerson ? Engine.findPerson(questionResult.targetId) : null);
        var learnedCause;
        var myOpinion;
        var myAgenda;
        var myCause;
        var sharedRel;
        var myRank;
        var targetRank;
        var personality = noble && noble.personality ? noble.personality : {};
        var loyalty = _getNobleEffectiveLoyalty(noble);
        if (!noble || !fact || !target || fact.truthfulness === 'evasive') return;
        learnedCause = fact.cause || (CAUSE_LABELS[fact.detail] ? fact.detail : '');
        switch (questionResult.questionId) {
            case 'king_opinion':
                myOpinion = _getNobleKingOpinionFact(noble, kingdom).detail;
                if (myOpinion === 'disapproves' && fact.detail === 'disapproves') _modifyNobleRelationship(noble, target.id, 3);
                else if ((myOpinion === 'approves' && fact.detail === 'disapproves') || (myOpinion === 'disapproves' && fact.detail === 'approves')) _modifyNobleRelationship(noble, target.id, -2);
                break;
            case 'noble_advice':
            case 'noble_next_business':
            case 'win_support':
            case 'noble_as_king':
                myAgenda = _getNobleAgendaData(noble.id);
                myCause = _getNobleAgendaActionId(myAgenda);
                if (myCause && learnedCause && myCause === learnedCause) {
                    _modifyNobleRelationship(noble, target.id, 2);
                    if (kingdom && !_hasActiveCoalition(kingdom, learnedCause, null) && rng && rng.chance(_chance(0.06 + ((personality.ambition || 50) > 70 ? 0.03 : 0)))) {
                        _createMemoryCoalition(kingdom, noble, learnedCause, null, 'found common cause through quiet questioning');
                    }
                }
                break;
            case 'court_friend':
            case 'court_allies':
                if (fact.targetId) {
                    sharedRel = _getNobleRelationshipScore(noble, fact.targetId);
                    if (sharedRel > 60) _modifyNobleRelationship(noble, target.id, 1);
                    else if (sharedRel < 30) _modifyNobleRelationship(noble, target.id, -1);
                }
                break;
            case 'court_enemy':
            case 'noble_watch':
                if (fact.targetId) {
                    sharedRel = _getNobleRelationshipScore(noble, fact.targetId);
                    if (sharedRel < 35) _modifyNobleRelationship(noble, target.id, 1);
                    else if (sharedRel > 60) _modifyNobleRelationship(noble, target.id, -1);
                }
                break;
            case 'move_against_king':
                if (fact.detail === 'willing') {
                    if (loyalty > 70) {
                        _modifyNobleRelationship(noble, target.id, -4);
                        _addNobleMemory(noble, {
                            type: 'observed',
                            source: 'questioning',
                            category: 'move_against_king_suspicion',
                            detail: _getNobleName(target) + ' hinted at moving against the crown.',
                            actorId: target.id,
                            targetId: kingdom && kingdom.king ? kingdom.king : null,
                            day: _getDay(),
                            sentiment: -1,
                            kingdomId: kingdom ? kingdom.id : ''
                        });
                        if (kingdom) {
                            Engine.logEvent('🕵️ ' + _getNobleName(noble) + ' grows suspicious of ' + _getNobleName(target) + ' after a quiet political question.', {
                                type: 'noble_question_suspicion',
                                kingdomId: kingdom.id,
                                actorId: noble.id,
                                targetId: target.id,
                                questionId: questionResult.questionId
                            }, _getLogCategory(kingdom.id));
                        }
                    } else if (loyalty < 35) {
                        _modifyNobleRelationship(noble, target.id, 5);
                        _addNobleMemory(noble, {
                            type: 'question_answer',
                            source: 'direct',
                            category: 'conspiracy_seed',
                            detail: 'Found shared disloyalty with ' + _getNobleName(target) + '.',
                            actorId: target.id,
                            targetId: kingdom && kingdom.king ? kingdom.king : null,
                            day: _getDay(),
                            sentiment: 1,
                            kingdomId: kingdom ? kingdom.id : ''
                        });
                    }
                }
                break;
            case 'noble_ambitions':
                myRank = _getNobleRank(noble, kingdom ? kingdom.id : _getNobleKingdomId(noble));
                targetRank = _getNobleRank(target, kingdom ? kingdom.id : _getNobleKingdomId(target));
                if (fact.detail === 'seeking_promotion' || fact.detail === 'seeking_influence') {
                    if (targetRank >= myRank && (personality.ambition || 50) > 55) _modifyNobleRelationship(noble, target.id, -3);
                    else if (targetRank < myRank || (personality.warmth || 50) > 60) _modifyNobleRelationship(noble, target.id, 1);
                }
                break;
            case 'noble_investment':
                if (fact.sentiment > 0 && _isNobleInvestmentInterested(noble)) {
                    _modifyNobleRelationship(noble, target.id, 1);
                    if (kingdom && !_hasActiveCoalition(kingdom, 'build_infrastructure', null) && rng && rng.chance(_chance(0.08 + ((personality.frugality || 50) > 60 ? 0.02 : 0)))) {
                        _createMemoryCoalition(kingdom, noble, 'build_infrastructure', null, 'found a practical ally through investment talk');
                    }
                }
                break;
        }
    }

    // v9p33river442: noble memory AI uses remembered declarations and observations.
    function tickNobleMemoryAI() {
        var rng;
        var world;
        var actionableDays;
        var ki;
        if (_getDay() % 7 !== 3) return;
        rng = _getRng();
        world = _getWorld();
        actionableDays = _cfg('NOBLE_MEMORY_ACTIONABLE_DAYS', 90);
        if (!world || !world.kingdoms || !rng) return;

        for (ki = 0; ki < world.kingdoms.length; ki++) {
            var k = world.kingdoms[ki];
            var nobles = _getNoblesInKingdom(k.id);
            var ni;
            if (!k || !k.id || !k.king) continue;

            for (ni = 0; ni < nobles.length; ni++) {
                var noble = nobles[ni];
                var np;
                var playerRel;
                var playerMemories;
                var nobleMemories;
                var latestDecl;
                var cause;
                var causeData;
                var oppositeCause;
                var adjustedChance;
                var sourceNoble;
                var sourceDecl;
                var topCause = null;
                var topCount = 0;
                var questionResult;
                var mi;
                if (!noble || !noble.alive) continue;
                _initNobleMemory(noble);
                np = noble.personality || {};
                playerRel = _getPlayerRelationshipLevel(noble.id);
                playerMemories = _getRecentPlayerMemories(noble, actionableDays);
                nobleMemories = _getRecentNobleMemories(noble, actionableDays);
                latestDecl = _getLatestDeclarationMemory(noble);

                if (rng.chance(_chance(_cfg('NOBLE_MEMORY_AI_QUESTION_CHANCE', 0.15)))) {
                    questionResult = _nobleAskQuestion(noble, nobles, k, rng);
                    if (questionResult && questionResult.fact) {
                        questionResult.memory = _upsertNobleQuestionFact(noble, questionResult.questionId, questionResult.targetId, questionResult.fact, _getDay());
                        _reactToLearnedFact(noble, questionResult, k, rng);
                    }
                }

                if (latestDecl) {
                    cause = _declarationToCause(latestDecl.category);
                    causeData = null;
                    if (cause === 'promote_noble' && latestDecl.targetId) {
                        causeData = { targetNobleId: latestDecl.targetId, targetName: _getTargetName(latestDecl.targetId) };
                    }

                    if (playerRel > 60 && cause && !_hasActiveCoalition(k, cause, causeData && causeData.targetNobleId ? causeData.targetNobleId : null)) {
                        adjustedChance = _cfg('NOBLE_MEMORY_AI_COALITION_SUPPORTIVE', 0.08);
                        if ((np.ambition || 50) > 70) adjustedChance += 0.05;
                        if ((np.frugality || 50) > 70) adjustedChance -= 0.03;
                        if (rng.chance(_chance(adjustedChance))) {
                            if (_createMemoryCoalition(k, noble, cause, causeData, 'was inspired by your views')) continue;
                        }
                    }

                    if (playerRel < 20) {
                        oppositeCause = _getOppositeCause(latestDecl.category);
                        if (oppositeCause && !_hasActiveCoalition(k, oppositeCause, null)) {
                            adjustedChance = _cfg('NOBLE_MEMORY_AI_COALITION_HOSTILE', 0.06);
                            if ((np.ambition || 50) > 70) adjustedChance += 0.05;
                            if ((np.frugality || 50) > 70) adjustedChance -= 0.03;
                            if (rng.chance(_chance(adjustedChance))) {
                                if (_createMemoryCoalition(k, noble, oppositeCause, null, 'opposes your vision')) continue;
                            }
                        }
                    }

                    if (playerRel >= 30 && playerRel <= 60 && cause && _scoreDeclarationAlignment(noble, k.id, latestDecl.category, { targetId: latestDecl.targetId }) > 0 && !_hasActiveCoalition(k, cause, causeData && causeData.targetNobleId ? causeData.targetNobleId : null)) {
                        adjustedChance = _cfg('NOBLE_MEMORY_AI_COALITION_CURRY', 0.05);
                        if ((np.warmth || 50) > 70) adjustedChance += 0.05;
                        if ((np.frugality || 50) > 70) adjustedChance -= 0.03;
                        if (rng.chance(_chance(adjustedChance))) {
                            if (_createMemoryCoalition(k, noble, cause, causeData, 'seeks your favor by backing your cause')) continue;
                        }
                    }
                }

                if (playerRel < 25 && rng.chance(_chance(_cfg('NOBLE_MEMORY_AI_ASK_AROUND', 0.03) + ((np.warmth || 50) > 70 ? 0.02 : 0)))) {
                    sourceNoble = _findRumorSource(nobles, noble.id);
                    if (sourceNoble) {
                        sourceDecl = _getLatestDeclarationMemory(sourceNoble);
                        if (sourceDecl && !_hasRecentMemory(noble, sourceDecl.category, 'player', _cfg('NOBLE_MEMORY_DEDUP_DAYS', 3))) {
                            _addPlayerMemory(noble, {
                                type: 'declaration',
                                source: 'rumor',
                                category: sourceDecl.category,
                                detail: 'Rumor from ' + _getNobleName(sourceNoble) + ': ' + sourceDecl.detail,
                                actorId: 'player',
                                targetId: sourceDecl.targetId || null,
                                day: _getDay(),
                                sentiment: 0,
                                kingdomId: k.id
                            });
                            oppositeCause = _getOppositeCause(sourceDecl.category);
                            if (oppositeCause && !_hasActiveCoalition(k, oppositeCause, null) && rng.chance(0.5)) {
                                if (_createMemoryCoalition(k, noble, oppositeCause, null, 'heard rumors of your intentions and is mobilizing against them')) continue;
                            }
                        }
                    }
                }

                for (mi = 0; mi < nobleMemories.length; mi++) {
                    var memoryCause = _memoryToCause(nobleMemories[mi]);
                    var count;
                    if (!memoryCause) continue;
                    count = _rememberedCauseCount(nobleMemories, memoryCause);
                    if (count > topCount) {
                        topCause = memoryCause;
                        topCount = count;
                    }
                }
                if (topCause && topCount >= 3 && !_hasActiveCoalition(k, topCause, null)) {
                    adjustedChance = 0.04;
                    if ((np.ambition || 50) > 70) adjustedChance += 0.05;
                    if ((np.frugality || 50) > 70) adjustedChance -= 0.03;
                    if (rng.chance(_chance(adjustedChance))) {
                        if (_createMemoryCoalition(k, noble, topCause, null, 'is leveraging remembered court maneuvers')) continue;
                    }
                }

                for (mi = nobleMemories.length - 1; mi >= 0; mi--) {
                    var followMemory = nobleMemories[mi];
                    var followCause = _memoryToCause(followMemory);
                    if (!followCause || !followMemory.actorId) continue;
                    if (_getNobleRelationshipScore(noble, followMemory.actorId) > 60 && !_hasActiveCoalition(k, followCause, null) && rng.chance(0.05)) {
                        if (_createMemoryCoalition(k, noble, followCause, followCause === 'promote_noble' && followMemory.targetId ? { targetNobleId: followMemory.targetId, targetName: _getTargetName(followMemory.targetId) } : null, 'is following the lead of trusted allies')) continue;
                    }
                    oppositeCause = DECLARATION_TYPES[followMemory.category] && DECLARATION_TYPES[followMemory.category].opposite ? _getOppositeCause(followMemory.category) : null;
                    if (oppositeCause && _getNobleRelationshipScore(noble, followMemory.actorId) < 40 && !_hasActiveCoalition(k, oppositeCause, null) && rng.chance(0.04)) {
                        if (_createMemoryCoalition(k, noble, oppositeCause, null, 'is countering a rival faction')) continue;
                    }
                }

                if ((np.ambition || 50) > 70 && _getNobleRank(noble, k.id) < 6 && !_hasActiveCoalition(k, 'promote_noble', noble.id)) {
                    adjustedChance = 0.05;
                    if ((np.frugality || 50) > 70) adjustedChance -= 0.03;
                    if (rng.chance(_chance(adjustedChance))) {
                        if (_createMemoryCoalition(k, noble, 'promote_noble', { targetNobleId: noble.id, targetName: _getNobleName(noble) }, 'sees an opening to press for promotion')) continue;
                    }
                }

                if ((np.warmth || 50) > 70) {
                    var sawPeace = false;
                    var sawWar = false;
                    for (mi = 0; mi < nobleMemories.length; mi++) {
                        var commonCause = _memoryToCause(nobleMemories[mi]);
                        if (commonCause === 'make_peace' || commonCause === 'form_alliance') sawPeace = true;
                        if (commonCause === 'declare_war' || commonCause === 'war_offensive') sawWar = true;
                    }
                    if (sawPeace && sawWar && !_hasActiveCoalition(k, 'build_infrastructure', null) && rng.chance(_chance(0.05 + ((np.warmth || 50) > 80 ? 0.02 : 0)))) {
                        if (_createMemoryCoalition(k, noble, 'build_infrastructure', null, 'is trying to build common ground between feuding factions')) continue;
                    }
                }

                if ((noble.kingLoyalty != null ? noble.kingLoyalty : (np.loyalty || 50)) > 70) {
                    for (mi = nobleMemories.length - 1; mi >= 0; mi--) {
                        if (_isSuspiciousMemory(nobleMemories[mi]) && rng.chance(0.05)) {
                            Engine.logEvent('🕵️ ' + _getNobleName(noble) + ' quietly reports suspicious political activity to the crown of ' + k.name + '.', {
                                type: 'noble_memory_report',
                                kingdomId: k.id,
                                actorId: nobleMemories[mi].actorId,
                                category: nobleMemories[mi].category
                            }, _getLogCategory(k.id));
                            if (_isPlayerActor(nobleMemories[mi].actorId)) _modifyPlayerRelationship(noble.id, -3);
                            else _modifyNobleRelationship(noble, nobleMemories[mi].actorId, -4);
                            break;
                        }
                    }
                }
            }
        }
    }

    // v9p33river442: UI/context helper for memory-aware noble dialogue.
    function getNobleMemoryContext(nobleId) {
        var noble = Engine.findPerson ? Engine.findPerson(nobleId) : null;
        var playerMemories;
        var nobleMemories;
        var recentPlayerDeclarations;
        var observedThreats = [];
        var allies = {};
        var rivals = {};
        var i;
        if (!noble || !noble.alive) {
            return {
                hasPlayerDeclarations: false,
                recentPlayerDeclarations: [],
                playerMemoryCount: 0,
                nobleMemoryCount: 0,
                isWatching: false,
                remembersPlayerConspiracy: false,
                remembersPlayerCoalition: false,
                observedThreats: [],
                allies: [],
                rivals: []
            };
        }

        playerMemories = _getRecentPlayerMemories(noble, 180);
        nobleMemories = _getRecentNobleMemories(noble, 180);
        recentPlayerDeclarations = playerMemories.filter(function(memory) {
            return memory.type === 'declaration';
        }).map(function(memory) {
            return {
                category: memory.category,
                label: _getCategoryLabel(memory.category),
                day: memory.day,
                sentiment: memory.sentiment
            };
        });

        for (i = 0; i < nobleMemories.length; i++) {
            if (_isSuspiciousMemory(nobleMemories[i])) {
                observedThreats.push({ actorId: nobleMemories[i].actorId, detail: nobleMemories[i].detail });
            }
            if (nobleMemories[i].actorId) {
                if (nobleMemories[i].sentiment > 0 || _getNobleRelationshipScore(noble, nobleMemories[i].actorId) > 60) allies[nobleMemories[i].actorId] = true;
                if (nobleMemories[i].sentiment < 0 || _getNobleRelationshipScore(noble, nobleMemories[i].actorId) < 40) rivals[nobleMemories[i].actorId] = true;
            }
        }

        return {
            hasPlayerDeclarations: recentPlayerDeclarations.length > 0,
            recentPlayerDeclarations: recentPlayerDeclarations,
            playerMemoryCount: noble.nobleMemory && noble.nobleMemory.playerActions ? noble.nobleMemory.playerActions.length : 0,
            nobleMemoryCount: noble.nobleMemory && noble.nobleMemory.nobleActions ? noble.nobleMemory.nobleActions.length : 0,
            isWatching: playerMemories.some(function(memory) {
                return memory.source === 'observed' && (_getDay() - (memory.day || 0)) <= 60;
            }),
            remembersPlayerConspiracy: playerMemories.some(function(memory) {
                return memory.category === 'conspiracy_joined' || memory.category === 'conspiracy_formed';
            }),
            remembersPlayerCoalition: playerMemories.some(function(memory) {
                return memory.category === 'coalition_formed';
            }),
            observedThreats: observedThreats,
            allies: Object.keys(allies),
            rivals: Object.keys(rivals)
        };
    }

    Engine.nobleAskNobleQuestion = function(askerId, targetId, questionId) {
        var asker = Engine.findPerson ? Engine.findPerson(askerId) : null;
        var target = Engine.findPerson ? Engine.findPerson(targetId) : null;
        var kingdomId;
        var kingdom;
        var rng = _getRng();
        var result;
        if (!asker || !asker.alive) return { success: false, message: 'That asking noble is unavailable.' };
        if (!target || !target.alive) return { success: false, message: 'That target noble is unavailable.' };
        kingdomId = _getNobleKingdomId(asker);
        if (!kingdomId || _getNobleKingdomId(target) !== kingdomId) return { success: false, message: 'Both nobles must belong to the same kingdom.' };
        kingdom = Engine.findKingdom ? Engine.findKingdom(kingdomId) : null;
        if (!kingdom) return { success: false, message: 'That kingdom could not be found.' };
        result = _askNobleQuestionPair(asker, target, questionId, kingdom, rng, false);
        if (!result || !result.success) return result || { success: false, message: 'No question was asked.' };
        result.memory = _upsertNobleQuestionFact(asker, result.questionId, result.targetId, result.fact, _getDay());
        _reactToLearnedFact(asker, result, kingdom, rng);
        return result;
    };

    // v9p33river442: expose noble memory API on Engine.
    Engine._initNobleMemory = _initNobleMemory;
    Engine._getMemoryLimits = _getMemoryLimits;
    Engine._addPlayerMemory = _addPlayerMemory;
    Engine._addNobleMemory = _addNobleMemory;
    Engine._getRecentPlayerMemories = _getRecentPlayerMemories;
    Engine._getRecentNobleMemories = _getRecentNobleMemories;
    Engine._hasRecentMemory = _hasRecentMemory;

    // v9p33river460: Memory-based relationship cap.
    // Negative memories reduce the max relationship, positive ones partially undo it.
    // Returns the effective max relationship (0..100).
    Engine.getMemoryRelationshipCap = function(personOrId) {
        var person = personOrId;
        if (typeof personOrId === 'string') {
            person = Engine.findPerson ? Engine.findPerson(personOrId) : null;
        }
        if (!person) return 100;
        var memory = person.nobleMemory || person._emMemory;
        if (!memory) return 100;
        var actions = memory.playerActions || [];
        var capDelta = 0;
        for (var i = 0; i < actions.length; i++) {
            var s = actions[i].sentiment || 0;
            if (s < 0) {
                // Negative memories reduce cap: sentiment -1 → -5, -2 → -12, -3 → -25
                var penalty = s === -1 ? -5 : s === -2 ? -12 : -25;
                capDelta += penalty;
            } else if (s > 0) {
                // Positive memories restore cap: sentiment +1 → +3, +2 → +6, +3 → +10
                var restore = s === 1 ? 3 : s === 2 ? 6 : 10;
                capDelta += restore;
            }
        }
        // Cap delta can only reduce (positive memories restore toward 0 but never above)
        if (capDelta > 0) capDelta = 0;
        // Clamp the total penalty to -100
        if (capDelta < -100) capDelta = -100;
        return Math.max(0, 100 + capDelta);
    };

    // Compute NPC-to-NPC memory relationship cap (noble memories of another noble).
    Engine.getNobleMemoryRelationshipCap = function(personOrId, otherPersonId) {
        var person = personOrId;
        if (typeof personOrId === 'string') {
            person = Engine.findPerson ? Engine.findPerson(personOrId) : null;
        }
        if (!person) return 100;
        var memory = person.nobleMemory || person._emMemory;
        if (!memory) return 100;
        var actions = memory.nobleActions || [];
        var capDelta = 0;
        for (var i = 0; i < actions.length; i++) {
            if (actions[i].actorId !== otherPersonId) continue;
            var s = actions[i].sentiment || 0;
            if (s < 0) {
                var penalty = s === -1 ? -5 : s === -2 ? -12 : -25;
                capDelta += penalty;
            } else if (s > 0) {
                var restore = s === 1 ? 3 : s === 2 ? 6 : 10;
                capDelta += restore;
            }
        }
        if (capDelta > 0) capDelta = 0;
        if (capDelta < -100) capDelta = -100;
        return Math.max(0, 100 + capDelta);
    };
    Engine.playerDeclareToNoble = playerDeclareToNoble;
    Engine.recordNobleObservation = recordNobleObservation;
    Engine.tickNobleMemoryAI = tickNobleMemoryAI;
    Engine.getNobleMemoryContext = getNobleMemoryContext;
})();
