(function() {
    'use strict';

    function _getWorld() {
        if (typeof Engine === 'undefined' || !Engine.getWorld) return null;
        return Engine.getWorld();
    }

    function _getRng() {
        if (typeof Engine === 'undefined' || !Engine.getRng) return null;
        return Engine.getRng();
    }

    function _clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function _roundLevel(value) {
        return Math.round(value * 10) / 10;
    }

    function _getMaxRank(person) {
        var maxRank = 0;
        var key;
        if (!person || !person.socialRank) return 0;
        for (key in person.socialRank) {
            if (person.socialRank.hasOwnProperty(key) && (person.socialRank[key] || 0) > maxRank) {
                maxRank = person.socialRank[key] || 0;
            }
        }
        return maxRank;
    }

    function _isNoble(person) {
        return !!(person && person.alive && _getMaxRank(person) >= 4);
    }

    function _isNotable(person) {
        return !!(person && person.alive && (person.isEliteMerchant || _getMaxRank(person) >= 4));
    }

    function _nameOf(person) {
        if (!person) return 'Unknown';
        if (person.name) return person.name;
        return ((person.firstName || 'Unknown') + ' ' + (person.lastName || '')).replace(/\s+/g, ' ').trim();
    }

    function _pairKey(aId, bId) {
        if (!aId || !bId) return '';
        return aId < bId ? (aId + '|' + bId) : (bId + '|' + aId);
    }

    function _getPairMilestoneStore(world) {
        if (!world._npcSocialPairMilestones) world._npcSocialPairMilestones = {};
        return world._npcSocialPairMilestones;
    }

    function _shareParent(a, b) {
        var i;
        if (!a || !b || !a.parentIds || !b.parentIds) return false;
        for (i = 0; i < a.parentIds.length; i++) {
            if (b.parentIds.indexOf(a.parentIds[i]) !== -1) return true;
        }
        return false;
    }

    function _isRelated(a, b) {
        if (!a || !b) return false;
        if (a.id === b.id) return true;
        if (a.spouseId && a.spouseId === b.id) return true;
        if (b.spouseId && b.spouseId === a.id) return true;
        if (a.parentIds && a.parentIds.indexOf(b.id) !== -1) return true;
        if (b.parentIds && b.parentIds.indexOf(a.id) !== -1) return true;
        if (a.childrenIds && a.childrenIds.indexOf(b.id) !== -1) return true;
        if (b.childrenIds && b.childrenIds.indexOf(a.id) !== -1) return true;
        return _shareParent(a, b);
    }

    function _canBeLovers(a, b) {
        if (!a || !b || !a.alive || !b.alive) return false;
        if (a.spouseId || b.spouseId) return false;
        if (_isRelated(a, b)) return false;
        if (a.age != null && a.age <= 16) return false;
        if (b.age != null && b.age <= 16) return false;
        return true;
    }

    function _canBeBusinessPartners(a, b) {
        if (!a || !b || !a.alive || !b.alive) return false;
        if (a.isEliteMerchant && b.isEliteMerchant) return true;
        if (a.isEliteMerchant && _isNoble(b)) return true;
        if (b.isEliteMerchant && _isNoble(a)) return true;
        return false;
    }

    function _personalityCompatibility(a, b) {
        var pa = a.personality || {};
        var pb = b.personality || {};
        var score = 0;
        score += 10 - Math.abs((pa.warmth || 50) - (pb.warmth || 50)) / 10;
        score += 10 - Math.abs((pa.honesty || 50) - (pb.honesty || 50)) / 10;
        if ((pa.ambition || 50) > 60 && (pb.ambition || 50) > 60) score -= 3;
        if ((pa.loyalty || 50) > 60 && (pb.loyalty || 50) > 60) score += 3;
        score -= Math.abs((pa.selfishness || 50) - (pb.selfishness || 50)) / 20;
        return score;
    }

    function _relationshipBaseline(a, b, rel) {
        var baseline = _personalityCompatibility(a, b) * 3;
        if (rel && rel.isLover) baseline += 12;
        if (rel && rel.isBizPartner) baseline += 8;
        return _clamp(_roundLevel(baseline), -30, 60);
    }

    function getRelationshipType(level) {
        if (level <= -50) return 'enemy';
        if (level <= -20) return 'rival';
        if (level < 0) return 'cold';
        if (level < 20) return 'acquaintance';
        if (level < 40) return 'friendly';
        if (level < 60) return 'friend';
        if (level < 80) return 'close_friend';
        return 'ally';
    }

    function getNPCRelationship(personA, personBId) {
        if (!personA || !personA.npcRelationships) return null;
        return personA.npcRelationships[personBId] || null;
    }

    function _emitSocialEvent(eventId, personA, personB, extra) {
        var params = {
            personAId: personA ? personA.id : null,
            personBId: personB ? personB.id : null,
            personAName: _nameOf(personA),
            personBName: _nameOf(personB),
            townId: personA ? personA.townId : null,
            kingdomId: (personA && personA.kingdomId) || (personB && personB.kingdomId) || null
        };
        var key;
        extra = extra || {};
        for (key in extra) {
            if (extra.hasOwnProperty(key)) params[key] = extra[key];
        }
        if (typeof EventTypes !== 'undefined' && EventTypes.emit) {
            EventTypes.emit(eventId, params, { _noToast: true });
        } else if (typeof Engine !== 'undefined' && Engine.logHiddenEvent) {
            Engine.logHiddenEvent(params.personAName + ' and ' + params.personBName + ' had a social milestone.', params, 'npc_activity');
        }
    }

    function _syncLegacyRelationship(personA, personBId, rel, personB) {
        var legacyLevel;
        if (!personA || !rel) return;
        personB = personB || ((typeof Engine !== 'undefined' && Engine.findPerson) ? Engine.findPerson(personBId) : null);
        legacyLevel = _roundLevel(rel.level || 0);

        if (personA.isEliteMerchant || (personB && personB.isEliteMerchant)) {
            if (!personA.relationships) personA.relationships = {};
            if (!personA.relationships[personBId] || typeof personA.relationships[personBId] === 'number') {
                personA.relationships[personBId] = { level: legacyLevel, type: getRelationshipType(legacyLevel) };
            } else {
                personA.relationships[personBId].level = legacyLevel;
                personA.relationships[personBId].type = getRelationshipType(legacyLevel);
            }
        }

        if (personB && ((personA.isEliteMerchant && _isNoble(personB)) || (_isNoble(personA) && personB.isEliteMerchant))) {
            if (!personA._nobleRelationships) personA._nobleRelationships = {};
            personA._nobleRelationships[personBId] = legacyLevel;
        }
    }

    function _ensureRelationship(personA, personBId, options) {
        var world = _getWorld();
        var day;
        var rel;
        options = options || {};
        if (!world || !personA || !personBId) return null;
        day = typeof world.day === 'number' ? world.day : 0;
        if (!personA.npcRelationships) personA.npcRelationships = {};
        rel = personA.npcRelationships[personBId];
        if (!rel) {
            rel = {
                level: 0,
                formedDay: options.formedDay != null ? options.formedDay : day,
                lastInteraction: options.lastInteraction != null ? options.lastInteraction : day
            };
            personA.npcRelationships[personBId] = rel;
        } else {
            if (rel.formedDay == null) rel.formedDay = options.formedDay != null ? options.formedDay : day;
            if (rel.lastInteraction == null) rel.lastInteraction = options.lastInteraction != null ? options.lastInteraction : day;
            if (typeof rel.level !== 'number' || isNaN(rel.level)) rel.level = 0;
        }
        return rel;
    }

    function _canEmitMilestone(pairKey, milestone, day) {
        var world = _getWorld();
        var store;
        var pairInfo;
        if (!world || !pairKey) return false;
        store = _getPairMilestoneStore(world);
        pairInfo = store[pairKey];
        if (!pairInfo) return true;
        if (pairInfo.milestone === milestone && (day - pairInfo.day) < 7) return false;
        if ((day - pairInfo.day) < 7) return false;
        return true;
    }

    function _recordMilestone(pairKey, milestone, day) {
        var world = _getWorld();
        var store;
        if (!world || !pairKey) return;
        store = _getPairMilestoneStore(world);
        store[pairKey] = { milestone: milestone, day: day };
    }

    function _checkMilestones(personA, personBId, oldLevel, rel, reason) {
        var world = _getWorld();
        var personB;
        var milestone = null;
        var eventId = null;
        var pairKey;
        var reverseRel;
        if (!world || !personA || !rel || personA.id === personBId) return;
        personB = (typeof Engine !== 'undefined' && Engine.findPerson) ? Engine.findPerson(personBId) : null;

        if (oldLevel < 80 && rel.level >= 80) {
            milestone = 'ally';
            eventId = 'NPC_BECAME_ALLIES';
        } else if (oldLevel < 40 && rel.level >= 40 && rel.level < 80) {
            milestone = 'friend';
            eventId = 'NPC_BECAME_FRIENDS';
        } else if (oldLevel > -50 && rel.level <= -50) {
            milestone = 'enemy';
            eventId = 'NPC_BECAME_ENEMIES';
        } else if (oldLevel > -20 && rel.level <= -20 && rel.level > -50) {
            if (oldLevel >= 20) {
                milestone = 'denounced';
                eventId = 'NPC_DENOUNCED';
            } else {
                milestone = 'rival';
                eventId = 'NPC_BECAME_RIVALS';
            }
        } else if (oldLevel <= -20 && rel.level > -20) {
            milestone = 'rivalry_ended';
            eventId = 'NPC_RIVALRY_ENDED';
        } else if (oldLevel >= 40 && rel.level < 40) {
            milestone = 'friendship_ended';
            eventId = 'NPC_FRIENDSHIP_ENDED';
        }

        if (!eventId || !milestone) return;
        pairKey = _pairKey(personA.id, personBId);
        if (!_canEmitMilestone(pairKey, milestone, world.day || 0)) return;
        if (rel.lastMilestone === milestone && rel.lastMilestoneDay != null && ((world.day || 0) - rel.lastMilestoneDay) < 7) return;

        rel.lastMilestone = milestone;
        rel.lastMilestoneDay = world.day || 0;
        if (personB && personB.npcRelationships && personB.npcRelationships[personA.id]) {
            reverseRel = personB.npcRelationships[personA.id];
            reverseRel.lastMilestone = milestone;
            reverseRel.lastMilestoneDay = world.day || 0;
        }
        _recordMilestone(pairKey, milestone, world.day || 0);
        _emitSocialEvent(eventId, personA, personB, { reason: reason, level: rel.level });
    }

    function _setRelationshipLevel(personA, personBId, newLevel, reason, options) {
        var world = _getWorld();
        var rel;
        var oldLevel;
        var day;
        options = options || {};
        if (!world || !personA || !personBId || personA.id === personBId) return null;
        day = typeof world.day === 'number' ? world.day : 0;
        rel = _ensureRelationship(personA, personBId, options);
        if (!rel) return null;
        oldLevel = rel.level || 0;
        rel.level = _roundLevel(_clamp(newLevel, -100, 100));
        if (options.touchInteraction === false) {
            if (options.lastInteraction != null) rel.lastInteraction = options.lastInteraction;
        } else {
            rel.lastInteraction = day;
        }
        _syncLegacyRelationship(personA, personBId, rel, options.targetPerson);
        if (!options.skipMilestones) _checkMilestones(personA, personBId, oldLevel, rel, reason);
        return rel;
    }

    function modifyNPCRelationship(personA, personBId, delta, reason) {
        var rel = getNPCRelationship(personA, personBId);
        var world = _getWorld();
        var day = world && typeof world.day === 'number' ? world.day : 0;
        if (!personA || !world || !personBId || personA.id === personBId) return;
        if (!rel) {
            rel = _ensureRelationship(personA, personBId, { formedDay: day, lastInteraction: day });
        }
        _setRelationshipLevel(personA, personBId, (rel ? rel.level : 0) + delta, reason, { touchInteraction: true });
    }

    function _removeRelationship(personA, personBId) {
        if (!personA || !personBId) return;
        if (personA.npcRelationships) delete personA.npcRelationships[personBId];
        if (personA.relationships) delete personA.relationships[personBId];
        if (personA._nobleRelationships) delete personA._nobleRelationships[personBId];
    }

    function _importLegacyRelationships(person) {
        var world = _getWorld();
        var relId;
        var legacy;
        var legacyLevel;
        var rel;
        if (!world || !person) return;
        if (!person.npcRelationships) person.npcRelationships = {};

        if (person.relationships) {
            for (relId in person.relationships) {
                if (!person.relationships.hasOwnProperty(relId) || person.npcRelationships[relId]) continue;
                legacy = person.relationships[relId];
                legacyLevel = typeof legacy === 'number' ? legacy : ((legacy && legacy.level) || 0);
                if (typeof legacyLevel !== 'number' || isNaN(legacyLevel)) continue;
                rel = _setRelationshipLevel(person, relId, legacyLevel, 'legacy_import', {
                    touchInteraction: false,
                    skipMilestones: true,
                    formedDay: world.day || 0,
                    lastInteraction: world.day || 0
                });
                if (!rel) continue;
                if (legacy && legacy.isLover) rel.isLover = true;
                if (legacy && legacy.isBizPartner) rel.isBizPartner = true;
            }
        }

        if (person._nobleRelationships) {
            for (relId in person._nobleRelationships) {
                if (!person._nobleRelationships.hasOwnProperty(relId) || person.npcRelationships[relId]) continue;
                legacyLevel = person._nobleRelationships[relId];
                if (typeof legacyLevel !== 'number' || isNaN(legacyLevel)) continue;
                _setRelationshipLevel(person, relId, legacyLevel, 'legacy_import', {
                    touchInteraction: false,
                    skipMilestones: true,
                    formedDay: world.day || 0,
                    lastInteraction: world.day || 0
                });
            }
        }
    }

    function _seedRelationshipPair(personA, personB, level, options) {
        var relA;
        var relB;
        options = options || {};
        relA = _setRelationshipLevel(personA, personB.id, level, options.reason || 'initial_seed', {
            touchInteraction: false,
            skipMilestones: true,
            targetPerson: personB,
            formedDay: options.formedDay,
            lastInteraction: options.lastInteraction
        });
        relB = _setRelationshipLevel(personB, personA.id, level, options.reason || 'initial_seed', {
            touchInteraction: false,
            skipMilestones: true,
            targetPerson: personA,
            formedDay: options.formedDay,
            lastInteraction: options.lastInteraction
        });
        return { a: relA, b: relB };
    }

    function _formLoverBond(personA, personB, reason, silent) {
        var world = _getWorld();
        var currentA;
        var currentB;
        var targetLevel;
        var rels;
        if (!world || !personA || !personB) return;
        currentA = getNPCRelationship(personA, personB.id);
        currentB = getNPCRelationship(personB, personA.id);
        targetLevel = Math.max((currentA && currentA.level) || 0, (currentB && currentB.level) || 0, Math.max(55, _roundLevel((_relationshipBaseline(personA, personB) || 0) + 12)));
        rels = _seedRelationshipPair(personA, personB, targetLevel, {
            reason: reason || 'lover_bond',
            formedDay: world.day || 0,
            lastInteraction: world.day || 0
        });
        if (!rels.a || !rels.b) return;
        if (rels.a.isLover && rels.b.isLover) return;
        rels.a.isLover = true;
        rels.b.isLover = true;
        _syncLegacyRelationship(personA, personB.id, rels.a, personB);
        _syncLegacyRelationship(personB, personA.id, rels.b, personA);
        if (!silent) _emitSocialEvent('NPC_LOVERS_FORMED', personA, personB, { reason: reason || 'lover_bond' });
    }

    function _formBusinessPartnership(personA, personB, reason, silent) {
        var world = _getWorld();
        var currentA;
        var currentB;
        var targetLevel;
        var rels;
        if (!world || !personA || !personB) return;
        currentA = getNPCRelationship(personA, personB.id);
        currentB = getNPCRelationship(personB, personA.id);
        targetLevel = Math.max((currentA && currentA.level) || 0, (currentB && currentB.level) || 0, Math.max(35, _roundLevel((_relationshipBaseline(personA, personB) || 0) + 8)));
        rels = _seedRelationshipPair(personA, personB, targetLevel, {
            reason: reason || 'business_partnership',
            formedDay: world.day || 0,
            lastInteraction: world.day || 0
        });
        if (!rels.a || !rels.b) return;
        if (rels.a.isBizPartner && rels.b.isBizPartner) return;
        rels.a.isBizPartner = true;
        rels.b.isBizPartner = true;
        _syncLegacyRelationship(personA, personB.id, rels.a, personB);
        _syncLegacyRelationship(personB, personA.id, rels.b, personA);
        if (!silent) _emitSocialEvent('NPC_BIZ_PARTNERSHIP', personA, personB, { reason: reason || 'business_partnership' });
    }

    function _scoreSeedCandidate(person, candidate) {
        return _personalityCompatibility(person, candidate);
    }

    function initNPCRelationships(person) {
        var world = _getWorld();
        var rng = _getRng();
        var sameTown = [];
        var sameKingdom = [];
        var anywhere = [];
        var allBuckets;
        var desired;
        var chosen = {};
        var bi;
        var i;
        if (!world || !rng || !person || !_isNotable(person)) return;
        if (!person.npcRelationships) person.npcRelationships = {};
        if (person._npcRelationshipsInit) return;

        _importLegacyRelationships(person);

        for (i = 0; i < world.people.length; i++) {
            var candidate = world.people[i];
            if (!candidate || candidate.id === person.id || !_isNotable(candidate)) continue;
            if (getNPCRelationship(person, candidate.id)) continue;
            if (candidate.townId && person.townId && candidate.townId === person.townId) {
                sameTown.push(candidate);
            } else if (candidate.kingdomId && person.kingdomId && candidate.kingdomId === person.kingdomId) {
                sameKingdom.push(candidate);
            } else {
                anywhere.push(candidate);
            }
        }

        sameTown.sort(function(a, b) { return _scoreSeedCandidate(person, b) - _scoreSeedCandidate(person, a); });
        sameKingdom.sort(function(a, b) { return _scoreSeedCandidate(person, b) - _scoreSeedCandidate(person, a); });
        anywhere.sort(function(a, b) { return _scoreSeedCandidate(person, b) - _scoreSeedCandidate(person, a); });

        allBuckets = [sameTown, sameKingdom, anywhere];
        desired = Math.min(sameTown.length + sameKingdom.length + anywhere.length, rng.randInt(2, 5));
        for (bi = 0; bi < allBuckets.length && Object.keys(chosen).length < desired; bi++) {
            for (i = 0; i < allBuckets[bi].length && Object.keys(chosen).length < desired; i++) {
                var target = allBuckets[bi][i];
                var initialLevel;
                if (!target || chosen[target.id]) continue;
                initialLevel = _clamp(Math.round(_relationshipBaseline(person, target) + rng.randInt(-15, 15)), -30, 50);
                _seedRelationshipPair(person, target, initialLevel, {
                    reason: 'initial_seed',
                    formedDay: world.day || 0,
                    lastInteraction: world.day || 0
                });
                if (rng.chance(0.08) && _canBeLovers(person, target)) {
                    _formLoverBond(person, target, 'initial_seed', (world.day || 0) <= 1);
                }
                if (rng.chance(0.15) && _canBeBusinessPartners(person, target)) {
                    _formBusinessPartnership(person, target, 'initial_seed', (world.day || 0) <= 1);
                }
                chosen[target.id] = true;
            }
        }

        person._npcRelationshipsInit = true;
    }

    function _hasTradeCompetition(a, b) {
        var invA;
        var invB;
        var goodId;
        if (!a || !b || !a.isEliteMerchant || !b.isEliteMerchant || a.townId !== b.townId) return false;
        if (a._focusGood && b._focusGood && a._focusGood === b._focusGood) return true;
        invA = a.npcMerchantInventory || {};
        invB = b.npcMerchantInventory || {};
        for (goodId in invA) {
            if (!invA.hasOwnProperty(goodId)) continue;
            if ((invA[goodId] || 0) > 2 && (invB[goodId] || 0) > 2) return true;
        }
        return false;
    }

    function _similarKingLoyalty(a, b) {
        var aLoyalty;
        var bLoyalty;
        if (!a || !b || !a.kingdomId || a.kingdomId !== b.kingdomId) return false;
        aLoyalty = a.kingLoyalty != null ? a.kingLoyalty : (((a.personality || {}).loyalty) || 50);
        bLoyalty = b.kingLoyalty != null ? b.kingLoyalty : (((b.personality || {}).loyalty) || 50);
        return Math.abs(aLoyalty - bLoyalty) <= 15;
    }

    function _applyPassiveDrift(person, targetId, rel) {
        var world = _getWorld();
        var target;
        var baseline;
        var diff;
        var newLevel;
        if (!world || !person || !rel) return;
        target = (typeof Engine !== 'undefined' && Engine.findPerson) ? Engine.findPerson(targetId) : null;
        if (!target || !target.alive) return;
        if ((world.day || 0) - (rel.lastInteraction || 0) <= 7) return;
        baseline = _relationshipBaseline(person, target, rel);
        diff = baseline - (rel.level || 0);
        if (Math.abs(diff) < 0.05) return;
        newLevel = (rel.level || 0) + (diff > 0 ? Math.min(0.2, diff) : Math.max(-0.2, diff));
        _setRelationshipLevel(person, targetId, newLevel, 'passive_drift', {
            touchInteraction: false,
            lastInteraction: rel.lastInteraction,
            targetPerson: target
        });
    }

    function _assignRivalUndercutTarget(person, townNotables) {
        var i;
        var candidate;
        var rel;
        var best = null;
        var bestLevel = 1;
        if (!person || !person.isEliteMerchant) return;
        person._rivalUndercutTarget = null;
        if (!townNotables) return;
        for (i = 0; i < townNotables.length; i++) {
            candidate = townNotables[i];
            if (!candidate || candidate.id === person.id || !candidate.isEliteMerchant) continue;
            rel = getNPCRelationship(person, candidate.id);
            if (!rel) continue;
            if (getRelationshipType(rel.level) !== 'rival' && getRelationshipType(rel.level) !== 'enemy') continue;
            if (best === null || rel.level < bestLevel) {
                best = candidate;
                bestLevel = rel.level;
            }
        }
        if (best) person._rivalUndercutTarget = best.id;
    }

    function tickNPCSocial() {
        var world = _getWorld();
        var rng = _getRng();
        var notables = [];
        var notablesByTown = {};
        var processed = 0;
        var startIndex = 0;
        var idx;
        if (!world || !rng || !world.people) return;

        for (idx = 0; idx < world.people.length; idx++) {
            var notable = world.people[idx];
            if (!_isNotable(notable)) continue;
            if (!notable._npcRelationshipsInit) initNPCRelationships(notable);
            if (!notable.npcRelationships) notable.npcRelationships = {};
            if (notable.isEliteMerchant) notable._rivalUndercutTarget = null;
            notables.push(notable);
            if (notable.townId) {
                if (!notablesByTown[notable.townId]) notablesByTown[notable.townId] = [];
                notablesByTown[notable.townId].push(notable);
            }
        }

        if (notables.length === 0) return;
        processed = Math.min(200, notables.length);
        startIndex = notables.length > processed ? ((world.day || 0) % notables.length) : 0;

        for (idx = 0; idx < processed; idx++) {
            var person = notables[(startIndex + idx) % notables.length];
            var relId;
            var rel;
            var townPeers;
            var encounterTarget;
            var compatibility;
            var shift;
            var personRel;
            var targetRel;
            if (!person || !person.alive) continue;

            for (relId in person.npcRelationships) {
                if (!person.npcRelationships.hasOwnProperty(relId)) continue;
                rel = person.npcRelationships[relId];
                if (!rel) continue;
                _applyPassiveDrift(person, relId, rel);
            }

            townPeers = notablesByTown[person.townId] || [];
            if (rng.chance(0.20) && townPeers.length > 1) {
                var candidates = [];
                var ci;
                for (ci = 0; ci < townPeers.length; ci++) {
                    if (townPeers[ci].id !== person.id) candidates.push(townPeers[ci]);
                }
                encounterTarget = candidates.length > 0 ? rng.pick(candidates) : null;
                if (encounterTarget) {
                    compatibility = _personalityCompatibility(person, encounterTarget);
                    shift = _clamp(Math.round(compatibility / 5 + rng.randInt(-2, 3)), -5, 5);
                    if (_hasTradeCompetition(person, encounterTarget)) shift -= 2;
                    if (_similarKingLoyalty(person, encounterTarget)) shift += 1;
                    shift = _clamp(shift, -5, 5);
                    modifyNPCRelationship(person, encounterTarget.id, shift, 'daily_encounter');
                    modifyNPCRelationship(encounterTarget, person.id, shift, 'daily_encounter');
                }
            }

            for (relId in person.npcRelationships) {
                var target;
                if (!person.npcRelationships.hasOwnProperty(relId)) continue;
                personRel = person.npcRelationships[relId];
                if (!personRel) continue;
                target = (typeof Engine !== 'undefined' && Engine.findPerson) ? Engine.findPerson(relId) : null;
                if (!target) {
                    _removeRelationship(person, relId);
                    continue;
                }
                if (!target.alive && ((world.day || 0) - (target._deathDay || target.deathDay || (world.day || 0))) > 30) {
                    _removeRelationship(person, relId);
                    continue;
                }
                if (rng.chance(0.01) && personRel.level > 50 && _canBeLovers(person, target)) {
                    targetRel = getNPCRelationship(target, person.id);
                    if (!personRel.isLover && !(targetRel && targetRel.isLover)) {
                        _formLoverBond(person, target, 'daily_chemistry', false);
                    }
                }
                if (rng.chance(0.02) && personRel.level > 30 && _canBeBusinessPartners(person, target)) {
                    targetRel = getNPCRelationship(target, person.id);
                    if (!personRel.isBizPartner && !(targetRel && targetRel.isBizPartner)) {
                        _formBusinessPartnership(person, target, 'trade_synergy', false);
                    }
                }
            }

            _assignRivalUndercutTarget(person, townPeers);

            // TODO: allied nobles of the player's noble friends should gain a petition-support bonus.
        }
    }

    if (typeof Engine !== 'undefined') {
        Engine.tickNPCSocial = tickNPCSocial;
        Engine.getNPCRelationship = getNPCRelationship;
        Engine.modifyNPCRelationship = modifyNPCRelationship;
        Engine.getRelationshipType = getRelationshipType;
        Engine.initNPCRelationships = initNPCRelationships;
    }
})();
