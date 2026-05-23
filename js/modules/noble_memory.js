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
        noble._nobleRelationships[otherId] = _clamp(cur + delta, -100, 100);
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
        return _declarationToCause(memory.category);
    }
    function _isSuspiciousMemory(memory) {
        var detail = memory && memory.detail ? String(memory.detail).toLowerCase() : '';
        if (!memory) return false;
        if (memory.category === 'conspiracy_joined' || memory.category === 'conspiracy_formed') return true;
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
        var i;
        if (!k || !organizer || !organizer.alive || !cause || !rng) return null;
        if (!k._nobleCoalitions) k._nobleCoalitions = [];
        if (_hasActiveCoalition(k, cause, causeData && causeData.targetNobleId ? causeData.targetNobleId : null)) return null;
        if (k._nobleCoalitions.filter(function(entry) { return entry.status === 'forming'; }).length >= 3) return null;
        if (!_getCauseLabel(cause)) return null;

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
        if (cause === 'promote_noble' && causeData && causeData.targetNobleId) {
            coalition.causeData = { targetNobleId: causeData.targetNobleId, targetName: causeData.targetName || _getTargetName(causeData.targetNobleId) };
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
            if ((recruit.personality && recruit.personality.warmth || 50) > 70 && cause !== 'declare_war' && cause !== 'war_offensive') recruitChance += 0.05;
            if ((recruit.personality && recruit.personality.frugality || 50) > 70) recruitChance -= 0.03;
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
        var playerTownId;
        var playerRank;
        var targetInfo;
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
        if (!playerTownId || noble.townId !== playerTownId) return { success: false, message: 'You must speak to this noble in person.' };
        if (playerRank < 4) return { success: false, message: 'Only nobles may engage in this kind of political declaration.' };

        targetInfo = _getTargetInfo(category, targetData, kingdomId);
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
                var mi;
                if (!noble || !noble.alive) continue;
                _initNobleMemory(noble);
                np = noble.personality || {};
                playerRel = _getPlayerRelationshipLevel(noble.id);
                playerMemories = _getRecentPlayerMemories(noble, actionableDays);
                nobleMemories = _getRecentNobleMemories(noble, actionableDays);
                latestDecl = _getLatestDeclarationMemory(noble);

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

    // v9p33river442: expose noble memory API on Engine.
    Engine._initNobleMemory = _initNobleMemory;
    Engine._getMemoryLimits = _getMemoryLimits;
    Engine._addPlayerMemory = _addPlayerMemory;
    Engine._addNobleMemory = _addNobleMemory;
    Engine._getRecentPlayerMemories = _getRecentPlayerMemories;
    Engine._getRecentNobleMemories = _getRecentNobleMemories;
    Engine._hasRecentMemory = _hasRecentMemory;
    Engine.playerDeclareToNoble = playerDeclareToNoble;
    Engine.recordNobleObservation = recordNobleObservation;
    Engine.tickNobleMemoryAI = tickNobleMemoryAI;
    Engine.getNobleMemoryContext = getNobleMemoryContext;
})();
