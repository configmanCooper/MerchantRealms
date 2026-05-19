(function(Player) {
    "use strict";
    if (!Player) throw new Error("Player must be loaded before player_dark_deeds.js");

    var player;
    function _sync() { player = Player.state; }

    // Aliases for Player functions
    var hasSkill = Player.hasSkill;
    var grantXP = Player.grantXP;
    var unlockAchievement = Player.unlockAchievement;
    var modifyRelationship = Player.modifyRelationship;
    var getRelationship = Player.getRelationship;
    var findResource = Player.findResource;
    var getCrimePunishment = Player.getCrimePunishment;
    var getForeignNobleStatus = Player.getForeignNobleStatus;
    var getMerchantLeaderboard = Player.getMerchantLeaderboard;
    var handleForeignNobleCrime = Player.handleForeignNobleCrime;

    // Noble Notoriety helper: add notoriety and check for punishment
    // Called when caught doing noble-level schemes (sabotage, blackmail, assassination, etc.)
    function _addNobleNotorietyAndCheck(amount, actionDesc) {
        _sync();
        // Check punishment BEFORE adding new notoriety (current value = % chance)
        var punishResult = null;
        if (Player.checkNobleNotorietyPunishment) {
            punishResult = Player.checkNobleNotorietyPunishment(actionDesc);
        }
        // Now add the notoriety
        player.nobleNotoriety = Math.min(CONFIG.NOBLE_NOTORIETY_MAX || 100,
            (player.nobleNotoriety || 0) + amount);
        return punishResult;
    }

    // M1: Scheme cooldown system — 7-14 day cooldowns per scheme per target
    function _checkSchemeCooldown(schemeId, targetId) {
        if (!player._schemeCooldowns) player._schemeCooldowns = {};
        var key = schemeId + '_' + targetId;
        var expires = player._schemeCooldowns[key] || 0;
        var day = Engine.getDay ? Engine.getDay() : 0;
        if (day < expires) {
            return { blocked: true, daysLeft: Math.ceil(expires - day) };
        }
        return { blocked: false };
    }
    function _setSchemeCooldown(schemeId, targetId, days) {
        if (!player._schemeCooldowns) player._schemeCooldowns = {};
        var key = schemeId + '_' + targetId;
        player._schemeCooldowns[key] = (Engine.getDay ? Engine.getDay() : 0) + days;
    }

    // Helper: check if two kingdoms are at war
    function _areKingdomsAtWar(kingdomIdA, kingdomIdB) {
        if (typeof Engine === 'undefined' || !Engine.findKingdom) return false;
        var kA = Engine.findKingdom(kingdomIdA);
        if (kA && kA.atWar && kA.atWar.has && kA.atWar.has(kingdomIdB)) return true;
        return false;
    }

    // M6: Escalating detection for repeat targeting
    function _getRepeatTargetPenalty(nobleId) {
        if (!player._schemeTargetHistory) player._schemeTargetHistory = {};
        var count = player._schemeTargetHistory[nobleId] || 0;
        return count * 0.05; // +5% detection per previous targeting
    }
    function _recordSchemeTarget(nobleId) {
        if (!player._schemeTargetHistory) player._schemeTargetHistory = {};
        player._schemeTargetHistory[nobleId] = (player._schemeTargetHistory[nobleId] || 0) + 1;
    }

    // M4: Scheme outcome log
    function _logSchemeOutcome(schemeId, targetName, success, caught, message) {
        if (!player._schemeLog) player._schemeLog = [];
        player._schemeLog.push({
            scheme: schemeId,
            target: targetName,
            success: success,
            caught: caught || false,
            message: message,
            day: Engine.getDay ? Engine.getDay() : 0
        });
        // Keep last 20 entries
        if (player._schemeLog.length > 20) player._schemeLog.shift();
    }

    function calculateCorruptDetection(baseDetection, town) {
        _sync();
        let detection = baseDetection;
        detection += ((town && town.security) || 50) * 0.005;
        const w = Engine.getWorld ? Engine.getWorld() : null;
        const hour = w ? (w.hour || 0) : 12;
        if (hour >= 20 || hour <= 5) detection *= 0.7;
        if (hasSkill('shadow_dealings')) detection *= 0.85;
        if (hasSkill('ghost')) detection *= 0.5;
        if (hasSkill('master_disguise')) detection *= 0.90;
        if (hasSkill('shadow_step')) detection *= 0.90;
        // Tunnel rat: permanent detection reduction in towns with hidden warehouses
        if (hasSkill('tunnel_rat') && town && player.hiddenWarehouses) {
            var _hasTunnel = player.hiddenWarehouses.some(function(hw) { return hw.townId === town.id; });
            if (_hasTunnel) detection *= 0.70;
        }
        // Notoriety significantly increases detection chance
        var _notoriety = player.notoriety || 0;
        if (_notoriety >= 80) {
            detection *= 1.5;  // WANTED: 50% harder to avoid detection
        } else if (_notoriety >= 50) {
            detection *= 1.3;  // Notorious: 30% harder
        } else if (_notoriety >= 25) {
            detection *= 1.15; // Suspicious: 15% harder
        }
        detection += _notoriety * 0.002; // additional flat scaling
        // Noble notoriety: smooth continuous detection scaling (0-40% increase)
        var _nobleNot = player.nobleNotoriety || 0;
        if (_nobleNot > 0) {
            detection *= 1 + (_nobleNot * 0.004);
        }
        // Bribed guards reduction
        if (town && player.bribedGuards[town.id]) {
            const bg = player.bribedGuards[town.id];
            const day = Engine.getDay();
            if (bg.expiresDay > day) {
                detection *= (1 - (bg.reductionPct || 40) / 100);
            }
        }
        // Alibi reduces detection
        if (player.alibi && Engine.getDay() <= player.alibi.expiresDay) {
            detection *= 0.8;
        }
        // v9p33river205: global ~15% reduction across the board so every
        // crime path feels slightly more forgiving (post-detection manhunt
        // already ramps risk over time).
        detection *= 0.85;
        // v9p33river213: god-mode crime stealth (debug toggle in god panel)
        if (typeof window !== 'undefined' && window._godCrimeStealth) detection *= 0.05;
        return Math.max(0.02, Math.min(0.95, detection));
    }

    // v9p33river217: rank-scaled detection bump for noble targets. Schemes
    // against high-rank targets are dramatically more likely to be detected
    // because they have personal guards, courtly informants, and political
    // allies who notice things ordinary citizens miss.
    //   - Minor Noble (rank 4):    1.30x catch (was 1.20x)
    //   - Lord (rank 5):           1.65x catch
    //   - Royal Advisor (rank 6):  2.00x catch
    //   - King:                    2.50x catch
    //   - Generic .isNoble flag (no rank info): 1.30x
    // v9p33river306: numeric (legacy) socialRank — fall back to the bare
    // number so old-style NPCs are correctly classified as nobles instead
    // of treated as commoners (which gave the scheme a too-easy success/
    // detection profile).
    function _nobleTargetMult(targetPersonId) {
        if (!targetPersonId) return 1.0;
        var t = Engine.findPerson ? Engine.findPerson(targetPersonId) : null;
        if (!t) return 1.0;
        if (t.isKing || t.occupation === 'king') return 2.50;
        // Look up max social rank across kingdoms for this NPC
        var maxRank = 0;
        if (t.socialRank) {
            if (typeof t.socialRank === 'object') {
                for (var _kk in t.socialRank) {
                    if ((t.socialRank[_kk] || 0) > maxRank) maxRank = t.socialRank[_kk];
                }
            } else if (typeof t.socialRank === 'number') {
                maxRank = t.socialRank;
            }
        }
        if (maxRank >= 6) return 2.00;  // Royal Advisor
        if (maxRank >= 5) return 1.65;  // Lord
        if (maxRank >= 4) return 1.30;  // Minor Noble
        if (t.isNoble || t.occupation === 'noble') return 1.30;
        return 1.0;
    }

    // v9p33river217: rank-scaled success-rate PENALTY for noble targets.
    // Multiplies the base success chance (independent of catch chance).
    // Together with the higher catch chance, this means schemes against
    // high-rank nobles are both harder to pull off AND harder to get away with.
    //   - Minor Noble:   0.85x success
    //   - Lord:          0.65x success
    //   - Royal Advisor: 0.45x success
    //   - King:          0.30x success
    function _nobleSuccessMult(targetPersonId) {
        if (!targetPersonId) return 1.0;
        var t = Engine.findPerson ? Engine.findPerson(targetPersonId) : null;
        if (!t) return 1.0;
        if (t.isKing || t.occupation === 'king') return 0.30;
        var maxRank = 0;
        // v9p33river315: numeric-socialRank fallback. Old saves can have
        // socialRank as a single number; iterating it gives nothing.
        if (typeof t.socialRank === 'number') {
            maxRank = t.socialRank;
        } else if (t.socialRank) {
            for (var _kk2 in t.socialRank) {
                if ((t.socialRank[_kk2] || 0) > maxRank) maxRank = t.socialRank[_kk2];
            }
        }
        if (maxRank >= 6) return 0.45;
        if (maxRank >= 5) return 0.65;
        if (maxRank >= 4) return 0.85;
        if (t.isNoble || t.occupation === 'noble') return 0.85;
        return 1.0;
    }

    // Public for the UI confirm dialog.
    Player._nobleTargetMult = _nobleTargetMult;
    Player._nobleSuccessMult = _nobleSuccessMult;
    Player.calculateCorruptDetection = calculateCorruptDetection;

    // v9p33river223: rank-scaled cost multiplier for noble targets.
    // Killing/poisoning a noble requires more sophisticated agents, more
    // bribes for accomplices, and more cover-up.
    //   Minor Noble (4): 2.5x
    //   Lord (5):        5.0x
    //   Royal Advisor (6): 10.0x
    //   King:            10.0x  (v9p33river226: lowered from 25.0x)
    function _nobleTargetCostMult(targetPersonId) {
        if (!targetPersonId) return 1.0;
        var t = Engine.findPerson ? Engine.findPerson(targetPersonId) : null;
        if (!t) return 1.0;
        if (t.isKing || t.occupation === 'king') return 10.0;
        var maxRank = 0;
        if (t.socialRank) {
            for (var _kkc in t.socialRank) {
                if ((t.socialRank[_kkc] || 0) > maxRank) maxRank = t.socialRank[_kkc];
            }
        }
        if (maxRank >= 6) return 10.0;
        if (maxRank >= 5) return 5.0;
        if (maxRank >= 4) return 2.5;
        if (t.isNoble || t.occupation === 'noble') return 2.5;
        return 1.0;
    }
    Player._nobleTargetCostMult = _nobleTargetCostMult;

    // v9p33river225: target wealth multiplier — wealthier targets cost more
    // because they have better-paid guards, more bribed witnesses, harder
    // access. Stacks with _nobleTargetCostMult. Net worth = gold + ~2k per
    // building. Capped at 1.5x — rank multiplier does the heavy lifting.
    function _targetWealthCostMult(targetPersonId) {
        if (!targetPersonId) return 1.0;
        var t = Engine.findPerson ? Engine.findPerson(targetPersonId) : null;
        if (!t) return 1.0;
        var nw = (t.gold || 0);
        if (t.buildings) nw += (t.buildings.length || 0) * 2000;
        // Tiers: <5k → 1.0x; 5–20k → 1.10x; 20–50k → 1.20x; 50–100k → 1.35x; 100k+ → 1.50x
        if (nw >= 100000) return 1.50;
        if (nw >= 50000) return 1.35;
        if (nw >= 20000) return 1.20;
        if (nw >= 5000) return 1.10;
        return 1.0;
    }
    Player._targetWealthCostMult = _targetWealthCostMult;

    // v9p33river224: target wealth detection multiplier — same logic but for
    // catch chance. Wealthy NPCs (especially EMs) have informants, paid
    // guards, suspicious neighbors. Lighter scale than cost since detection
    // already gets a boost from noble target mult.
    //   <5k: 1.0x; 5–20k: 1.10x; 20–50k: 1.20x; 50k+: 1.30x; 100k+: 1.45x
    function _targetWealthDetectMult(targetPersonId) {
        if (!targetPersonId) return 1.0;
        var t = Engine.findPerson ? Engine.findPerson(targetPersonId) : null;
        if (!t) return 1.0;
        var nw = (t.gold || 0);
        if (t.buildings) nw += (t.buildings.length || 0) * 2000;
        if (nw >= 100000) return 1.45;
        if (nw >= 50000) return 1.30;
        if (nw >= 20000) return 1.20;
        if (nw >= 5000) return 1.10;
        return 1.0;
    }
    Player._targetWealthDetectMult = _targetWealthDetectMult;

    // v9p33river212: roll catch and success chance INDEPENDENTLY.
    // Marginal probabilities preserved (catch% and success% match what the
    // scheme had before — schemes used to treat caught == failed, so success%
    // was implicitly 1-catch%). Now rolled separately so all 4 outcomes are
    // possible: success+caught, success+uncaught, fail+caught, fail+uncaught.
    // v9p33river217: optional successMult arg lets callers down-weight the
    // success chance independently (used for noble-target schemes).
    function _rollSchemeOutcome(detection, rng, successMult) {
        var rngObj = rng || Engine.getRng();
        var c = rngObj && rngObj.chance ? rngObj.chance(detection) : (Math.random() < detection);
        var sm = (typeof successMult === 'number') ? successMult : 1.0;
        var successChance = Math.max(0.02, Math.min(0.98, (1 - detection) * sm));
        var s = rngObj && rngObj.chance ? rngObj.chance(successChance) : (Math.random() < successChance);
        return { caught: c, successful: s };
    }
    Player._rollSchemeOutcome = _rollSchemeOutcome;

    // v9p33river212: generic 4-outcome outcome message builder.
    // Pass: { successful, caught, successMsg, caughtMsg, partialMsg, failMsg }
    // Returns { success, caught, message } with success-with-caught annotated.
    function _schemeResult(opts) {
        var s = !!opts.successful;
        var c = !!opts.caught;
        if (s && !c) return { success: true, message: opts.successMsg || '✅ Success.' };
        if (s && c) return { success: true, caught: true, message: '⚠️ ' + (opts.partialMsg || (opts.successMsg + ' But you were SEEN! ' + opts.caughtMsg)) };
        if (!s && c) return { success: false, caught: true, message: opts.caughtMsg + ' (Attempt failed.)' };
        return { success: false, message: opts.failMsg || '❌ Attempt failed but you got away unseen.' };
    }
    Player._schemeResult = _schemeResult;

    function isInTown(townId) {
        _sync();
        return !player.traveling && player.townId === townId;
    }

    function isJailed() {
        _sync();
        return player.jailedUntilDay > 0 && Engine.getDay() < player.jailedUntilDay;
    }

    // v9p33river258: centralized "imprison player" helper. Whenever the player
    // gets jailed (manhunt catch, scheme jailing, etc.), guarantee that
    // (a) travel state is fully cleared so the travel UI goes away, and
    // (b) if jailKingdomId is provided and the player isn't already there,
    //     warp to the closest town inside that kingdom — guards aren't going
    //     to drag them across the world map; closest jail makes sense.
    function _imprisonPlayer(days, jailKingdomId, opts) {
        if (!days || days <= 0) return null;
        opts = opts || {};
        var dayNow = Engine.getDay ? Engine.getDay() : 0;
        // Apply jail-break reduction if not opted out
        if (!opts.skipJailBreakReduction && hasSkill('jail_break')) {
            days = Math.max(1, Math.floor(days * 0.5));
        }
        player.jailedUntilDay = dayNow + days;

        // Warp to closest hunting-kingdom town if needed
        var huntKingdom = (jailKingdomId && Engine.findKingdom) ? Engine.findKingdom(jailKingdomId) : null;
        var currentTown = player.townId ? Engine.findTown(player.townId) : null;
        var inHuntKingdom = !!(currentTown && jailKingdomId && currentTown.kingdomId === jailKingdomId);
        var jailTown = currentTown;
        var warpedFrom = null;
        // v9p33river291: huntKingdom is a raw kingdom object — towns are in
        // `territories` (a Set), not `towns`. The old `.towns` field never
        // existed, so cross-kingdom jail warping never happened.
        var _hkTerr = huntKingdom && huntKingdom.territories
            ? (Array.isArray(huntKingdom.territories) ? huntKingdom.territories : Array.from(huntKingdom.territories))
            : [];
        if (!inHuntKingdom && huntKingdom && _hkTerr.length) {
            var pPos = null;
            try { if (Player.getPlayerWorldPosition) pPos = Player.getPlayerWorldPosition(); } catch(_e) {}
            if (!pPos && currentTown) pPos = { x: currentTown.x, y: currentTown.y };
            var bestTown = null, bestDist = Infinity;
            for (var hi = 0; hi < _hkTerr.length; hi++) {
                var ht = Engine.findTown(_hkTerr[hi]);
                if (!ht) continue;
                var d = pPos ? Math.hypot(ht.x - pPos.x, ht.y - pPos.y) : 0;
                if (d < bestDist) { bestDist = d; bestTown = ht; }
            }
            if (bestTown) {
                warpedFrom = currentTown ? currentTown.name : 'the wilderness';
                player.townId = bestTown.id;
                jailTown = bestTown;
            }
        }

        // Always clear travel state when imprisoned — UI must reflect jail
        player.traveling = false;
        player.travelProgress = 0;
        player.travelDestination = null;
        player.travelDestCoords = null;
        player.travelWaypoints = null;
        player.travelRoute = null;
        player.travelTotalDist = 0;
        player.travelBySea = false;
        player.travelOffroad = false;
        player.travelOffSea = false;
        player.offSeaShipId = null;
        player.travelPaid = false;
        player.travelMode = null;
        player.travelSeaMode = null;
        player.travelOrigin = null;
        player.travelCompanions = [];
        player._campPromptNeeded = false;
        player.worldX = null;
        player.worldY = null;

        return { jailTown: jailTown, warpedFrom: warpedFrom, days: days };
    }
    Player._imprisonPlayer = _imprisonPlayer;

    function recordCorruptAction(actionId, caught, kingdomId, crimeId) {
        player.corruptActions = (player.corruptActions || 0) + 1;
        player.crimesCommitted[actionId] = (player.crimesCommitted[actionId] || 0) + 1;
        if (!caught) {
            player.corruptionStreak = (player.corruptionStreak || 0) + 1;
            // v9p33river200: refund half of any tracked notoriety added during
            // this scheme attempt. _trackedNotoriety pushes each += amount onto
            // _schemeNotorietyPlanned so we know how much to halve.
            if (player._schemeNotorietyPlanned > 0) {
                var refund = player._schemeNotorietyPlanned * 0.5;
                player.notoriety = Math.max(0, (player.notoriety || 0) - refund);
            }
            // v9p33river203: small chance the crime is found out after the
            // fact. If so, the kingdom opens a manhunt that ticks daily.
            if (kingdomId && crimeId) {
                _maybeStartManhunt(actionId, kingdomId, crimeId);
            }
        } else {
            player.corruptionStreak = 0;
        }
        player._schemeNotorietyPlanned = 0;
        // Achievement checks
        if (player.corruptActions === 1) unlockAchievement('first_crime');
        if (player.corruptActions >= 50) unlockAchievement('crime_lord');
        if (player.corruptionStreak >= 20) unlockAchievement('untouchable_crimes');
    }

    // v9p33river200: tracks the planned notoriety bump so recordCorruptAction
    // can refund half on uncaught outcomes. Returns the value unchanged so
    // call sites read like `notoriety = (notoriety||0) + _trackedNotoriety(N)`.
    function _trackedNotoriety(amount) {
        player._schemeNotorietyPlanned = (player._schemeNotorietyPlanned || 0) + amount;
        return amount;
    }

    // ========================================================
    // v9p33river203: POST-CRIME DETECTION / MANHUNT SYSTEM
    // ========================================================
    // After an uncaught crime there's a small chance the kingdom belatedly
    // discovers the player was responsible. They then "open a manhunt" that
    // ticks daily, with catch chance depending on the player's current
    // location (in-kingdom vs ally vs sanctuary), town security, and skills.
    //
    // Severity tiers (drives post-detect chance + manhunt duration):
    //   minor    (theft, smuggling, forgery, trespassing, poaching)      → 4% chance, 3-15d
    //   moderate (sabotage, counterfeiting, blackmail, bribery, arson)    → 7% chance, 15-45d
    //   severe   (murder, treason, poison)                                 → 12% chance, 30-90d
    function _crimeSeverity(crimeId) {
        if (!crimeId) return 'minor';
        switch (crimeId) {
            case 'murder': case 'treason': case 'poison':
                return 'severe';
            case 'sabotage': case 'counterfeiting': case 'blackmail':
            case 'bribery': case 'arson':
                return 'moderate';
            default:
                return 'minor';
        }
    }

    function _postDetectChance(crimeId) {
        var s = _crimeSeverity(crimeId);
        if (s === 'severe') return 0.12;
        if (s === 'moderate') return 0.07;
        return 0.04;
    }

    function _manhuntDurationDays(crimeId, rng) {
        var s = _crimeSeverity(crimeId);
        var min, max;
        if (s === 'severe') { min = 30; max = 90; }
        else if (s === 'moderate') { min = 15; max = 45; }
        else { min = 3; max = 15; }
        return rng ? rng.randInt(min, max) : Math.floor((min + max) / 2);
    }

    function _maybeStartManhunt(actionId, kingdomId, crimeId) {
        if (!kingdomId || !crimeId) return;
        if (!player.activeManhunts) player.activeManhunts = {};
        // If already hunting for this crime from this kingdom, don't stack.
        var existing = player.activeManhunts[kingdomId];
        if (existing && existing.crimeId === crimeId) {
            // Extend duration slightly instead.
            existing.untilDay = Math.max(existing.untilDay, Engine.getDay() + 7);
            return;
        }
        var rng = Engine.getRng();
        var detectChance = _postDetectChance(crimeId);
        // Notoriety widens the noose: every 10 notoriety adds +1% detect chance.
        var notoriety = player.notoriety || 0;
        detectChance += (notoriety / 1000);
        // Repeat-offender escalation per kingdom for this crime type.
        var prior = 0;
        if (player.criminalRecord && player.criminalRecord[kingdomId]) {
            prior = (player.criminalRecord[kingdomId][crimeId] || 0);
        }
        detectChance += prior * 0.01;
        detectChance = Math.min(0.40, detectChance);
        if (!rng || !rng.chance(detectChance)) return;
        var day = Engine.getDay ? Engine.getDay() : 0;
        var dur = _manhuntDurationDays(crimeId, rng);
        var originTownId = player.townId || null;
        player.activeManhunts[kingdomId] = {
            crimeId: crimeId,
            schemeId: actionId,
            severity: _crimeSeverity(crimeId),
            startDay: day,
            untilDay: day + dur,
            originTownId: originTownId
        };
        // Also bump the criminal record so subsequent rolls escalate.
        if (!player.criminalRecord) player.criminalRecord = {};
        if (!player.criminalRecord[kingdomId]) player.criminalRecord[kingdomId] = {};
        player.criminalRecord[kingdomId][crimeId] = (player.criminalRecord[kingdomId][crimeId] || 0) + 1;

        var kName = 'a kingdom';
        if (Engine.findKingdom) {
            var k = Engine.findKingdom(kingdomId);
            if (k) kName = k.name;
        }
        var crimeName = crimeId.charAt(0).toUpperCase() + crimeId.slice(1).replace(/_/g, ' ');
        Engine.logEvent('🚨 ' + kName + ' has discovered your involvement in ' + crimeName + '! A manhunt has begun. (' + dur + ' days)', null, 'my_actions');
        if (typeof UI !== 'undefined' && UI.toast) {
            UI.toast('🚨 WANTED! ' + kName + ' is hunting you for ' + crimeName + ' (' + dur + 'd).', 'danger', 'critical');
        }
    }

    // Daily catch-roll for an open manhunt. Returns chance in [0,1].
    // Calibration targets:
    //   • In hunting kingdom, no skills, high security  → ~90%
    //   • In hunting kingdom, some skills, medium sec   → ~30%
    //   • Outside, not allied, some skills              → ~3%
    //   • Outside, allied with current kingdom          → only slightly reduced
    //   • Outside, sanctuary law in current kingdom     → almost 0
    function _calcManhuntCatchChance(huntKingdomId) {
        var currentTown = player.townId ? Engine.findTown(player.townId) : null;
        var inHuntKingdom = !!(currentTown && currentTown.kingdomId === huntKingdomId);

        var skillReduction = 0;
        if (hasSkill('ghost')) skillReduction += 0.30;
        if (hasSkill('master_disguise')) skillReduction += 0.25;
        if (hasSkill('shadow_step')) skillReduction += 0.20;
        if (hasSkill('master_smuggler')) skillReduction += 0.15;
        if (hasSkill('discrete')) skillReduction += 0.15;
        if (hasSkill('shadow_dealings')) skillReduction += 0.10;
        if (hasSkill('smugglers_run')) skillReduction += 0.10;
        skillReduction = Math.min(0.85, skillReduction);

        // v9p33river232: town.security is 0–100 in this codebase (not 0–1).
        // Normalize to 0–1 here so locFactor stays sensible.
        var _rawSec = (currentTown && typeof currentTown.security === 'number') ? currentTown.security : 40;
        var security = Math.max(0, Math.min(1, _rawSec / 100));

        var base, locFactor;
        if (inHuntKingdom) {
            base = 0.95;
            // High security amplifies, low security dampens (security 0..1 → factor 0.5..1.0)
            locFactor = 0.5 + 0.5 * security;
        } else {
            // Outside the hunting kingdom. Default 'not allied' base is ~10%
            // (with some skills → ~3% per spec). Sanctuary kills it. Allied
            // is closer to in-kingdom (~60%) so still risky but slightly reduced.
            var allianceMult = 0.10;
            var myK = currentTown && currentTown.kingdomId ? Engine.findKingdom(currentTown.kingdomId) : null;
            if (myK) {
                if (Engine.hasSpecialLaw && Engine.hasSpecialLaw(myK, 'sanctuary_law')) {
                    allianceMult = 0.01;
                } else {
                    var huntK = Engine.findKingdom(huntKingdomId);
                    if (huntK && huntK.alliances) {
                        if (typeof huntK.alliances.has === 'function') {
                            if (huntK.alliances.has(myK.id)) allianceMult = 0.60;
                        } else if (Array.isArray(huntK.alliances)) {
                            if (huntK.alliances.indexOf(myK.id) >= 0) allianceMult = 0.60;
                        }
                    }
                    // At war with hunting kingdom? They can't reach you easily.
                    if (myK.atWar && typeof myK.atWar.has === 'function' && myK.atWar.has(huntKingdomId)) {
                        allianceMult = 0.02;
                    }
                }
            } else {
                // Wilderness — same as non-allied outside
                allianceMult = 0.10;
            }
            base = allianceMult;
            locFactor = 0.5 + 0.5 * security; // security still helps locate you
        }

        var chance = base * (1 - skillReduction) * locFactor;
        // v9p33river229: ~30% global reduction so manhunts feel less inevitable.
        // High-risk situations (in-kingdom, no skills) still bite hard, but
        // ordinary day-to-day exposure is more forgiving.
        chance *= 0.70;
        return Math.max(0.001, Math.min(0.99, chance));
    }

    // v9p33river205: convert a per-day catch chance to a verbal descriptor for
    // UI surfaces (no exact percentages). Used by the manhunt banner.
    function _manhuntCatchLabel(chance) {
        if (chance >= 0.70) return { word: 'CERTAIN', color: '#ff3030' };
        if (chance >= 0.45) return { word: 'VERY HIGH', color: '#ff6644' };
        if (chance >= 0.25) return { word: 'HIGH', color: '#ff8c2a' };
        if (chance >= 0.12) return { word: 'MODERATE', color: '#e0c020' };
        if (chance >= 0.05) return { word: 'LOW', color: '#7fc24c' };
        if (chance >= 0.015) return { word: 'VERY LOW', color: '#3aa869' };
        return { word: 'NEGLIGIBLE', color: '#8db4d8' };
    }

    // v9p33river228: success-chance verbal label (inverted color scale —
    // high success is green, low is red, since success is desirable).
    function _successChanceLabel(chance) {
        if (chance >= 0.85) return { word: 'CERTAIN', color: '#3aa869' };
        if (chance >= 0.65) return { word: 'VERY HIGH', color: '#7fc24c' };
        if (chance >= 0.45) return { word: 'HIGH', color: '#a8d860' };
        if (chance >= 0.25) return { word: 'MODERATE', color: '#e0c020' };
        if (chance >= 0.10) return { word: 'LOW', color: '#ff8c2a' };
        if (chance >= 0.03) return { word: 'VERY LOW', color: '#ff6644' };
        return { word: 'NEGLIGIBLE', color: '#ff3030' };
    }
    Player._successChanceLabel = _successChanceLabel;

    // Called once daily from Player.tick(). Rolls catch for each open manhunt,
    // expires manhunts that have run their duration.
    function tickManhunts() {
        _sync();
        if (!player.activeManhunts) { player.activeManhunts = {}; return; }
        var day = Engine.getDay ? Engine.getDay() : 0;
        var rng = Engine.getRng();
        var inJail = (player.jailedUntilDay || 0) > day;
        var currentTown = player.townId ? Engine.findTown(player.townId) : null;
        var kIds = Object.keys(player.activeManhunts);
        for (var i = 0; i < kIds.length; i++) {
            var kId = kIds[i];
            var hunt = player.activeManhunts[kId];
            if (!hunt) continue;
            // Expire
            if (day > hunt.untilDay) {
                var k = Engine.findKingdom ? Engine.findKingdom(kId) : null;
                Engine.logEvent('🕊️ ' + (k ? k.name : 'the kingdom') + ' has given up the manhunt against you for ' + hunt.crimeId + '.', null, 'my_actions');
                if (typeof UI !== 'undefined' && UI.toast) UI.toast('🕊️ Manhunt expired: ' + (k ? k.name : 'kingdom') + ' / ' + hunt.crimeId, 'info');
                delete player.activeManhunts[kId];
                continue;
            }
            // v9p33river205: if already imprisoned in the hunting kingdom,
            // they have you behind bars — instant catch (extradition isn't
            // needed). Trial deferral still applies for nobles.
            if (inJail && currentTown && currentTown.kingdomId === kId) {
                _manhuntCatch(kId, hunt, currentTown, true);
                continue;
            }
            if (inJail) continue; // jailed elsewhere, manhunt waits
            var chance = _calcManhuntCatchChance(kId);
            if (!rng || !rng.chance(chance)) continue;
            _manhuntCatch(kId, hunt, currentTown, false);
        }
    }

    // v9p33river205: shared catch-resolution body so jail-autocatch + daily
    // roll both go through the same penalty pipeline.
    function _manhuntCatch(kId, hunt, currentTown, viaJail) {
        var huntKingdom = Engine.findKingdom ? Engine.findKingdom(kId) : null;
        var townForPenalty = currentTown;
        if (!townForPenalty && huntKingdom && huntKingdom.towns && huntKingdom.towns.length) {
            townForPenalty = Engine.findTown(huntKingdom.towns[0]);
        }

        // v9p33river240: extradition warp.
        // If the player is caught for a manhunt while NOT inside the hunting
        // kingdom, the guards extradite them to the closest town within the
        // hunting kingdom and imprison them there. This makes "running across
        // the border" still result in real jail time at the offended kingdom's
        // own jail (rather than being magically locked up in some foreign town
        // they happened to be standing in).
        var _wasExtradited = false;
        var _extraditionTown = null;
        var _origLocLabel = currentTown ? currentTown.name : 'the wilderness';
        var _playerInHuntKingdom = !!(currentTown && currentTown.kingdomId === kId);
        // v9p33river291: huntKingdom comes from Engine.findKingdom (raw),
        // so towns are in `territories` (a Set). The old `.towns` field was
        // undefined → manhunt extradition never warped the player.
        var _hkTerr2 = huntKingdom && huntKingdom.territories
            ? (Array.isArray(huntKingdom.territories) ? huntKingdom.territories : Array.from(huntKingdom.territories))
            : [];
        if (!_playerInHuntKingdom && huntKingdom && _hkTerr2.length) {
            // Find player's current world position
            var _pPos = null;
            try { if (Player.getPlayerWorldPosition) _pPos = Player.getPlayerWorldPosition(); } catch (_e) {}
            if (!_pPos && currentTown) _pPos = { x: currentTown.x, y: currentTown.y };
            // Find closest town in hunting kingdom
            var _bestTown = null;
            var _bestDist = Infinity;
            for (var _hi = 0; _hi < _hkTerr2.length; _hi++) {
                var _ht = Engine.findTown(_hkTerr2[_hi]);
                if (!_ht) continue;
                var _d;
                if (_pPos) _d = Math.hypot(_ht.x - _pPos.x, _ht.y - _pPos.y);
                else _d = 0;
                if (_d < _bestDist) { _bestDist = _d; _bestTown = _ht; }
            }
            if (_bestTown) {
                // Warp player there + clear travel state
                player.townId = _bestTown.id;
                player.traveling = false;
                player.travelProgress = 0;
                player.travelDestination = null;
                player.travelDestCoords = null;
                player.travelWaypoints = null;
                player.travelRoute = null;
                player.travelTotalDist = 0;
                player.travelBySea = false;
                player.travelOffroad = false;
                player.travelOffSea = false;
                player.offSeaShipId = null;
                player.travelPaid = false;
                player.travelMode = null;
                player.travelSeaMode = null;
                player._campPromptNeeded = false;
                player.worldX = null;
                player.worldY = null;
                townForPenalty = _bestTown;
                currentTown = _bestTown;
                _wasExtradited = true;
                _extraditionTown = _bestTown;
            }
        }
        var fine = 0;
        var jailDays = 0;
        var exile = false;
        var repLoss = 25;
        if (hunt.severity === 'severe') { exile = true; repLoss = 50; }
        applyCorruptPenalty(townForPenalty, huntKingdom, fine, repLoss, jailDays, exile, hunt.crimeId, { isManhunt: true });
        var day = Engine.getDay ? Engine.getDay() : 0;
        if (player.jailedUntilDay && player.jailedUntilDay > day) {
            var extra = Math.floor((player.jailedUntilDay - day) * 0.5);
            player.jailedUntilDay += extra;
        }
        player.notoriety = (player.notoriety || 0) + 30;
        var howCaught = viaJail ? '⛓️ The guards already had you behind bars when '
            : '⛓️ Caught by ';
        var msg = howCaught + (huntKingdom ? huntKingdom.name : 'the kingdom') +
            (viaJail ? '\'s warrant arrived for ' : '\'s manhunt for ') +
            hunt.crimeId + '! Penalty applied.';
        if (_wasExtradited && _extraditionTown) {
            msg += ' You were dragged from ' + _origLocLabel + ' and locked up in ' + _extraditionTown.name + '.';
        }
        Engine.logEvent(msg, null, 'my_actions');
        if (typeof UI !== 'undefined' && UI.toast) {
            UI.toast('⛓️ MANHUNT CAUGHT! ' + (huntKingdom ? huntKingdom.name : 'kingdom') + ' / ' + hunt.crimeId, 'error', 'critical');
            if (_wasExtradited && _extraditionTown) {
                UI.toast('🚔 Extradited to ' + _extraditionTown.name + ' for trial.', 'warning');
            }
        }
        delete player.activeManhunts[kId];
    }


    // ========================================================
    // CRIME IMMUNITY — Lords (in lord town) & Royal Advisors (kingdom-wide)
    // ========================================================
    // Returns { immune: true/false, scope: 'lord_town'|'kingdom'|null, repPenalty: 1-5 }
    function checkCrimeImmunity(townId, kingdomId) {
        _sync();
        var kId = kingdomId || null;
        if (!kId && townId) {
            var t = Engine.findTown(townId);
            if (t) kId = t.kingdomId;
        }
        if (!kId) return { immune: false, scope: null, repPenalty: 0 };

        var rank = player.socialRank[kId] || 0;

        // v9p33river206: King has TOTAL crime immunity in their own kingdom.
        // Kings cannot be accused, jailed, fined, or exiled in the kingdom
        // they rule. The trial system also skips them entirely.
        if (player.isKing && player.kingState && player.kingState.kingdomId === kId) {
            return { immune: true, scope: 'king', repPenalty: 0 };
        }

        // Royal Advisor (rank 6): immune throughout entire kingdom
        if (rank >= 6) {
            return { immune: true, scope: 'kingdom', repPenalty: 2 };
        }

        // Lord (rank 5): immune only in their lord town
        if (rank >= 5 && player.lordTownId && player.lordTownId === townId) {
            return { immune: true, scope: 'lord_town', repPenalty: 3 };
        }

        return { immune: false, scope: null, repPenalty: 0 };
    }

    function applyCorruptPenalty(town, kingdom, fine, repLoss, jailDays, exile, crimeId) {
        _sync();
        const kId = kingdom ? kingdom.id : (town ? town.kingdomId : null);
        var townId = town ? (town.id || town) : player.townId;

        // Crime immunity check — Lords in lord town, Royal Advisors kingdom-wide
        var immunity = checkCrimeImmunity(townId, kId);
        if (immunity.immune) {
            // Immune: no fine, no jail, no exile — but still lose reputation
            var immuneRepLoss = Math.max(immunity.repPenalty, repLoss > 0 ? Math.min(repLoss, 5) : immunity.repPenalty);
            if (kId) player.reputation[kId] = Math.max(0, (player.reputation[kId] || 50) - immuneRepLoss);
            var scopeLabel = immunity.scope === 'king' ? 'King of this kingdom'
                : immunity.scope === 'kingdom' ? 'Royal Advisor'
                : 'Lord of this town';
            Engine.logEvent('🔓 ' + player.fullName + ' committed a crime but is immune as ' + scopeLabel + '. (-' + immuneRepLoss + ' reputation)');
            if (typeof UI !== 'undefined' && UI.toast) UI.toast('🔓 Crime immunity! (-' + immuneRepLoss + ' rep)', 'info');
            // Still track criminal record for RP purposes
            if (crimeId && kId) {
                if (!player.criminalRecord) player.criminalRecord = {};
                if (!player.criminalRecord[kId]) player.criminalRecord[kId] = {};
                player.criminalRecord[kId][crimeId] = (player.criminalRecord[kId][crimeId] || 0) + 1;
            }
            return 0;
        }

        // If a crimeId is specified, look up the kingdom's punishment
        // v9p33river202: kingdom law NOW takes precedence over the hard-coded
        // fine/jail args when crimeId is supplied. Old behavior only used the
        // override if the caller passed 0 — meant most schemes were never
        // affected by kingdom temperament. Now kingdom-set values win, with
        // the caller's values acting only as a fallback when the kingdom has
        // no entry. exile/repLoss/etc. still come from caller. Execution-type
        // punishment promotes the call to exile + heavy jail automatically.
        if (crimeId && kId) {
            var punishment = getCrimePunishment(kId, crimeId);
            if (punishment) {
                if (punishment.fine > 0) fine = punishment.fine;
                if (punishment.jailDays > 0) jailDays = punishment.jailDays;
                if (punishment.type === 'execution') {
                    exile = true;
                    jailDays = Math.max(jailDays, punishment.jailDays || 360);
                }
            }
            // Track criminal record
            if (!player.criminalRecord) player.criminalRecord = {};
            if (!player.criminalRecord[kId]) player.criminalRecord[kId] = {};
            player.criminalRecord[kId][crimeId] = (player.criminalRecord[kId][crimeId] || 0) + 1;
        }

        // v9p33river205: NOBLE COUNCIL TRIAL DEFERRAL
        // If the player is a noble (rank >= 4) in a kingdom with the
        // noble_council law and faces exile or de-facto execution (jail >= 180d),
        // defer the punishment to a trial. The trial vote (yes=acquit, no=guilty)
        // resolves over 10-20 days. If the verdict is GUILTY, the trial system
        // calls back into applyCorruptPenalty with opts.fromTrial=true to actually
        // enact the sentence (avoids infinite recursion).
        var _opts205 = arguments[7] || null;
        var _fromTrial = (_opts205 && typeof _opts205 === 'object' && _opts205.fromTrial) ? true : false;
        if (kId && !_fromTrial) {
            var _isNobleHere = (player.socialRank && (player.socialRank[kId] || 0) >= 4);
            // v9p33river206: King of this kingdom can never be put on trial
            // (also caught by checkCrimeImmunity above, but extra-safe here).
            var _isKingHere = !!(player.isKing && player.kingState && player.kingState.kingdomId === kId);
            var _facingDeath = exile || jailDays >= 180;
            if (!_isKingHere && _isNobleHere && _facingDeath && Engine.scheduleNobleTrial) {
                var _kForTrial = Engine.findKingdom ? Engine.findKingdom(kId) : null;
                if (_kForTrial && Engine.hasSpecialLaw && Engine.hasSpecialLaw(_kForTrial, 'noble_council')) {
                    var _trial = Engine.scheduleNobleTrial({
                        kingdomId: kId,
                        accusedIsPlayer: true,
                        crimeId: crimeId || 'misc',
                        originalPunishment: {
                            fine: fine, repLoss: repLoss, jailDays: jailDays, exile: exile,
                            execution: exile && jailDays >= 360,
                            town: town
                        }
                    });
                    if (_trial) {
                        // Block travel + force-travel to court town
                        player._activeTrial = {
                            voteId: _trial.id,
                            kingdomId: kId,
                            crimeId: crimeId || 'misc',
                            courtDay: _trial.deadlineDay,
                            courtTownId: _trial.trial.courtTownId
                        };
                        // Trigger forced travel (deferred so caller flow completes first)
                        if (typeof setTimeout !== 'undefined') {
                            setTimeout(function() {
                                try { if (Player._forceTravelToTrial) Player._forceTravelToTrial(); } catch(_e) {}
                            }, 50);
                        }
                        Engine.logEvent('⚖️ As a noble of ' + _kForTrial.name + ', your case has been deferred to the Noble Council trial.', null, 'my_actions');
                        if (typeof UI !== 'undefined' && UI.toast) UI.toast('⚖️ TRIAL SCHEDULED — court convenes day ' + _trial.deadlineDay, 'warning', 'critical');
                        return 0;
                    }
                }
            }
        }


        // Foreign Noble crime handling
        if (kId && getForeignNobleStatus(kId) && (jailDays > 0 || exile)) {
            var isExecution = exile || jailDays >= 180;
            var fnResult = handleForeignNobleCrime(kId, jailDays, isExecution);
            if (fnResult && fnResult.paid) {
                // Foreign noble fine paid - skip jail/execution
                if (kId && repLoss > 0) {
                    player.reputation[kId] = Math.max(0, (player.reputation[kId] || 50) - repLoss);
                }
                return fnResult.fine;
            }
        }

        if (fine > 0) {
            var _kingdom = Engine.findKingdom ? Engine.findKingdom(kId) : null;
            Player.deductGoldOrDebt(fine, 'kingdom', kId || 'unknown', _kingdom ? _kingdom.name : 'Kingdom', 'Criminal fine (' + (crimeId || 'offense') + ')');
        }
        // v9p33river104: repLoss is now TOWN reputation loss by default. Kingdom
        // rep loss can be passed via the 8th argument as either a number or a
        // {kingdomRepLoss: N, isNobleTarget: bool} options object. Noble-targeting
        // schemes auto-add an extra -10 kingdom rep on top.
        var _opts = arguments[7] || null;
        var _kRepLoss = 0;
        if (typeof _opts === 'number') _kRepLoss = _opts;
        else if (_opts && typeof _opts === 'object') {
            _kRepLoss = _opts.kingdomRepLoss || 0;
            if (_opts.isNobleTarget) _kRepLoss += 10;
        }
        // Town reputation loss (was kingdom rep — now TOWN rep)
        if (townId && repLoss > 0) {
            if (Player.modifyTownReputation) {
                Player.modifyTownReputation(townId, -repLoss);
            } else {
                player.townReputation = player.townReputation || {};
                player.townReputation[townId] = Math.max(0, (player.townReputation[townId] || 50) - repLoss);
            }
        }
        // Kingdom reputation loss (only when explicitly requested or noble-target)
        if (kId && _kRepLoss > 0) {
            player.reputation[kId] = Math.max(0, (player.reputation[kId] || 50) - _kRepLoss);
        }
        if (jailDays > 0) {
            // v9p33river258: route through centralized helper — clears travel
            // state and warps to closest hunting-kingdom town if we're outside
            var _jailRes = _imprisonPlayer(jailDays, kId, {});
            if (_jailRes && _jailRes.warpedFrom) {
                Engine.logEvent('🚔 You were dragged from ' + _jailRes.warpedFrom + ' and locked up in ' + (_jailRes.jailTown ? _jailRes.jailTown.name : 'the kingdom') + '.', null, 'my_actions');
                if (typeof UI !== 'undefined' && UI.toast) UI.toast('🚔 Extradited to ' + (_jailRes.jailTown ? _jailRes.jailTown.name : 'kingdom') + '.', 'warning');
            }
        }
        if (exile && kId) {
            // Exile: reputation to 0, lose all buildings in kingdom
            player.reputation[kId] = 0;
            // v9p33river203: record real exile so border guards enforce it on
            // re-entry. Stores reason (crimeId) and day for flavor / scaling.
            if (!player.exiledFromKingdoms) player.exiledFromKingdoms = {};
            player.exiledFromKingdoms[kId] = {
                day: Engine.getDay ? Engine.getDay() : 0,
                reason: crimeId || 'misc'
            };
            // Clear any open manhunt from this kingdom (you've been "dealt with")
            if (player.activeManhunts && player.activeManhunts[kId]) {
                delete player.activeManhunts[kId];
            }
            Engine.logEvent(`${player.fullName} has been exiled from ${kingdom ? kingdom.name : 'the kingdom'}!`);
        }
        return fine;
    }

    // ── (a) Sabotage Building ──
    function sabotageBuilding(buildingIndex, townId) {
        _sync();
        if (isJailed()) return { success: false, message: 'You are in jail.' };
        if (!hasSkill('shadow_dealings') && !hasSkill('arsonist_skill')) return { success: false, message: 'Requires Shadow Dealings or Arsonist skill.' };
        if (!isInTown(townId)) return { success: false, message: 'You must be in the town.' };
        const town = Engine.findTown(townId);
        if (!town) return { success: false, message: 'Town not found.' };
        const bld = town.buildings[buildingIndex];
        if (!bld) return { success: false, message: 'Building not found.' };
        const toolQty = player.inventory.tools || 0;
        if (toolQty < 2) return { success: false, message: 'Need 2 tools in inventory.' };

        player.inventory.tools -= 2;
        const rng = Engine.getRng();
        const detection = calculateCorruptDetection(0.25, town);
        // v9p33river212: independent rolls
        var _o = _rollSchemeOutcome(detection, rng, _nobleSuccessMult(personId));
        var caught = _o.caught;
        var successful = _o.successful;

        // Apply success effect first
        var disabledDays = 0;
        if (successful) {
            disabledDays = rng ? rng.randInt(15, 30) : 20;
            player.sabotagedBuildings.push({ townId, buildingIdx: buildingIndex, expiresDay: Engine.getDay() + disabledDays });
            bld._disabledUntil = Engine.getDay() + disabledDays;
            grantXP(10, 'Sabotaged building');
            if (player.doubleNobleAgent) {
                var _sbBt = bld.type ? bld.type.toLowerCase() : '';
                if (_sbBt.indexOf('barracks') >= 0 || _sbBt.indexOf('armory') >= 0 || _sbBt.indexOf('weapon') >= 0 || _sbBt.indexOf('military') >= 0 || _sbBt.indexOf('forge') >= 0 || _sbBt.indexOf('fletcher') >= 0) {
                    if (town.kingdomId === player.doubleNobleAgent.targetKingdomId) { _trackDnaTask('sabotage_military'); _trackDnaTask('weaken_army'); }
                }
            }
            Engine.logEvent(`A building in ${town.name} has been sabotaged! Production halted for ${disabledDays} days.`);
            if (typeof StoryMode !== 'undefined' && StoryMode.onPlayerAction) {
                StoryMode.onPlayerAction('player_sabotage', { townId: townId, kingdomId: town.kingdomId });
            }
        }

        // Apply caught penalty
        var caughtMsg = '';
        if (caught) {
            const kingdom = Engine.findKingdom ? Engine.findKingdom(town.kingdomId) : null;
            const actualFine = applyCorruptPenalty(town, kingdom, 200, 15, 5, false, 'sabotage');
            recordCorruptAction('sabotage_building', true, (typeof town !== 'undefined' && town ? town.kingdomId : null), 'sabotage');
            player.notoriety = (player.notoriety || 0) + _trackedNotoriety(8);
            var _nnResult = _addNobleNotorietyAndCheck(CONFIG.NOBLE_NOTORIETY_DARK_DEED_ADD || 12, 'sabotaging buildings');
            var _nnMsg = _nnResult && _nnResult.punished ? ' ' + _nnResult.message : '';
            Engine.logEvent(`${player.fullName} was caught sabotaging a building in ${town.name}!`);
            caughtMsg = `🚨 CAUGHT! Fined ${actualFine}g, jailed 5d, rep -15.` + _nnMsg;
        } else {
            recordCorruptAction('sabotage_building', false, (typeof town !== 'undefined' && town ? town.kingdomId : null), 'sabotage');
            player.notoriety = (player.notoriety || 0) + _trackedNotoriety(8);
        }

        if (successful && !caught) return { success: true, message: `✅ Building sabotaged! Disabled for ${disabledDays} days.` };
        if (successful && caught) return { success: true, caught: true, message: `⚠️ Building sabotaged (disabled ${disabledDays}d) but you were SEEN. ` + caughtMsg };
        if (!successful && caught) return { success: false, caught: true, message: caughtMsg + ' (Sabotage attempt failed.)' };
        return { success: false, message: '❌ Sabotage attempt failed but you slipped away unseen.' };
    }

    // ── (b) Sabotage Road ──
    function sabotageRoad(roadIdx) {
        _sync();
        if (isJailed()) return { success: false, message: 'You are in jail.' };
        if (!hasSkill('shadow_dealings') && !hasSkill('arsonist_skill')) return { success: false, message: 'Requires Shadow Dealings or Arsonist skill.' };
        const toolQty = player.inventory.tools || 0;
        if (toolQty < 5) return { success: false, message: 'Need 5 tools in inventory.' };
        const roads = Engine.getRoads ? Engine.getRoads() : [];
        const road = roads[roadIdx];
        if (!road) return { success: false, message: 'Road not found.' };
        // Must be at one end
        if (player.townId !== road.fromTownId && player.townId !== road.toTownId) {
            return { success: false, message: 'Must be at one end of the road.' };
        }

        player.inventory.tools -= 5;
        const town = Engine.findTown(player.townId);
        const rng = Engine.getRng();
        const detection = calculateCorruptDetection(0.15, town);
        // v9p33river303: was passing undeclared `targetMerchantId` — in
        // strict mode that throws ReferenceError and aborts the whole
        // sabotage call. Road sabotage has no per-noble target; pass null
        // so _nobleSuccessMult returns the neutral 1.0 multiplier.
        var _o = _rollSchemeOutcome(detection, rng, _nobleSuccessMult(null));
        var caught = _o.caught;
        var successful = _o.successful;

        var origQuality = road.quality || 1;
        if (successful) {
            road.quality = Math.max(0, origQuality - 1);
            player.sabotagedRoads.push({ roadIdx, expiresDay: Engine.getDay() + 60, origQuality });
            grantXP(15, 'Sabotaged road');
            if (player.doubleNobleAgent && road) {
                var _srFrom = Engine.findTown(road.fromTownId);
                var _srTo = Engine.findTown(road.toTownId);
                if ((_srFrom && _srFrom.kingdomId === player.doubleNobleAgent.targetKingdomId) || (_srTo && _srTo.kingdomId === player.doubleNobleAgent.targetKingdomId)) _trackDnaTask('destroy_road');
            }
            Engine.logEvent('A road has been sabotaged! Travel slowed.');
        }

        var caughtMsg = '';
        if (caught) {
            const kingdom = Engine.findKingdom ? Engine.findKingdom(town ? town.kingdomId : null) : null;
            const actualFine = applyCorruptPenalty(town, kingdom, 300, 20, 0, false, 'sabotage');
            recordCorruptAction('sabotage_road', true, (typeof town !== 'undefined' && town ? town.kingdomId : null), 'sabotage');
            player.notoriety = (player.notoriety || 0) + _trackedNotoriety(10);
            Engine.logEvent(`${player.fullName} was caught sabotaging a road!`);
            caughtMsg = `🚨 CAUGHT! Fined ${actualFine}g, rep -20.`;
        } else {
            recordCorruptAction('sabotage_road', false, (typeof town !== 'undefined' && town ? town.kingdomId : null), 'sabotage');
            player.notoriety = (player.notoriety || 0) + _trackedNotoriety(10);
        }

        return _schemeResult({
            successful: successful, caught: caught,
            successMsg: '✅ Road sabotaged! Quality reduced for 60 days.',
            caughtMsg: caughtMsg,
            partialMsg: 'Road sabotaged but you were SEEN. ' + caughtMsg,
            failMsg: '❌ Sabotage attempt failed but you slipped away unseen.'
        });
    }

    // ── (c) Arson ──
    function commitArson(buildingIndex, townId) {
        _sync();
        if (isJailed()) return { success: false, message: 'You are in jail.' };
        if (!hasSkill('arsonist_skill')) return { success: false, message: 'Requires Arsonist skill.' };
        if (!isInTown(townId)) return { success: false, message: 'You must be in the town.' };
        const town = Engine.findTown(townId);
        if (!town) return { success: false, message: 'Town not found.' };
        const bld = town.buildings[buildingIndex];
        if (!bld) return { success: false, message: 'Building not found.' };
        const woodQty = player.inventory.wood || 0;
        if (woodQty < 1) return { success: false, message: 'Need wood for fire materials.' };
        if (player.gold < 10) return { success: false, message: 'Need 10g for oil.' };

        player.inventory.wood = (player.inventory.wood || 0) - 1;
        player.gold -= 10;

        let baseDetect = 0.40;
        if (hasSkill('arsonist_skill')) baseDetect *= 0.5;
        const rng = Engine.getRng();
        const detection = calculateCorruptDetection(baseDetect, town);
        var _o = _rollSchemeOutcome(detection, rng);
        var caught = _o.caught;
        var successful = _o.successful;

        if (successful) {
            town.buildings.splice(buildingIndex, 1);
            player.arsonCount = (player.arsonCount || 0) + 1;
            grantXP(25, 'Arson');
            if (player.arsonCount >= 5) unlockAchievement('arsonist_ach');
            if (player.doubleNobleAgent && town.kingdomId === player.doubleNobleAgent.targetKingdomId) _trackDnaTask('burn_supplies');
            Engine.logEvent(`A building in ${town.name} has been destroyed by fire!`);
        }

        var caughtMsg = '';
        if (caught) {
            const kingdom = Engine.findKingdom ? Engine.findKingdom(town.kingdomId) : null;
            const doExile = rng && rng.chance(0.3);
            const actualFine = applyCorruptPenalty(town, kingdom, 1000, 30, 15, doExile, 'arson');
            recordCorruptAction('arson', true, (typeof town !== 'undefined' && town ? town.kingdomId : null), 'arson');
            player.notoriety = (player.notoriety || 0) + _trackedNotoriety(25);
            var _nnResult = _addNobleNotorietyAndCheck(CONFIG.NOBLE_NOTORIETY_DARK_DEED_ADD || 12, 'committing arson');
            Engine.logEvent(`${player.fullName} was caught committing arson in ${town.name}!`);
            caughtMsg = `🚨 CAUGHT! Fined ${actualFine}g, jailed 15d, rep -30.` +
                (doExile ? ' EXILED from kingdom!' : '') +
                ((_nnResult && _nnResult.punished) ? ' ' + _nnResult.message : '');
        } else {
            recordCorruptAction('arson', false, (typeof town !== 'undefined' && town ? town.kingdomId : null), 'arson');
            player.notoriety = (player.notoriety || 0) + _trackedNotoriety(25);
        }

        return _schemeResult({
            successful: successful, caught: caught,
            successMsg: '✅ Building destroyed by fire!',
            caughtMsg: caughtMsg,
            partialMsg: 'Building burned but you were SEEN! ' + caughtMsg,
            failMsg: '❌ The fire failed to take hold but you slipped away unseen.'
        });
    }

    // ── (d) Steal Goods ──
    function stealGoods(resourceId, qty, townId) {
        _sync();
        qty = Number(qty);
        if (!qty || !isFinite(qty) || qty <= 0) return { success: false, message: 'Invalid quantity.' };
        qty = Math.floor(qty);
        if (isJailed()) return { success: false, message: 'You are in jail.' };
        if (!hasSkill('discrete')) return { success: false, message: 'Requires Discrete skill.' };
        if (!isInTown(townId)) return { success: false, message: 'You must be in the town.' };
        const town = Engine.findTown(townId);
        if (!town) return { success: false, message: 'Town not found.' };
        qty = Math.min(qty, 20);
        const available = (town.market && town.market.supply[resourceId]) || 0;
        if (available < qty) return { success: false, message: `Only ${available} available in market.` };

        const w = Engine.getWorld ? Engine.getWorld() : null;
        const hour = w ? (w.hour || 0) : 12;
        const baseDetect = (hour >= 20 || hour <= 5) ? 0.20 : 0.35;
        const rng = Engine.getRng();
        const res = findResource(resourceId);
        // Use local market price for value and detection scaling
        const localPrice = (town.market && town.market.prices && town.market.prices[resourceId]) || (res ? res.basePrice : 10);
        const value = Math.floor(localPrice * qty);
        // Higher-value theft = higher detection (merchants watch expensive goods more closely)
        // Under 50g: no extra detection; 50-200g: moderate; 200g+: significant
        var valueDetectMult = 1.0;
        if (value > 200) valueDetectMult = 1.5;
        else if (value > 100) valueDetectMult = 1.3;
        else if (value > 50) valueDetectMult = 1.15;
        const detection = calculateCorruptDetection(baseDetect * valueDetectMult, town);
        var _o = _rollSchemeOutcome(detection, rng);
        var caught = _o.caught;
        var successful = _o.successful;

        if (successful) {
            town.market.supply[resourceId] -= qty;
            player.inventory[resourceId] = (player.inventory[resourceId] || 0) + qty;
            const xpBonus = Math.min(10, Math.floor(value / 50));
            grantXP(5 + xpBonus, 'Stole goods');
            if (player.doubleNobleAgent && town.kingdomId === player.doubleNobleAgent.targetKingdomId) _trackDnaTask('steal_treasury', value);
            Engine.logEvent(`Goods went missing from ${town.name}'s market.`);
        }

        var caughtMsg = '';
        if (caught) {
            const kingdom = Engine.findKingdom ? Engine.findKingdom(town.kingdomId) : null;
            const actualFine = applyCorruptPenalty(town, kingdom, value * 2, 10, 0, false, 'theft');
            recordCorruptAction('steal_goods', true, (typeof town !== 'undefined' && town ? town.kingdomId : null), 'theft');
            player.notoriety = (player.notoriety || 0) + _trackedNotoriety(5);
            Engine.logEvent(`${player.fullName} was caught stealing in ${town.name}!`);
            caughtMsg = `🚨 CAUGHT! Fined ${actualFine}g, rep -10. Goods confiscated.`;
            // If we got the goods AND were caught, they're confiscated
            if (successful) {
                town.market.supply[resourceId] += qty;
                player.inventory[resourceId] = Math.max(0, (player.inventory[resourceId] || 0) - qty);
            }
        } else {
            recordCorruptAction('steal_goods', false, (typeof town !== 'undefined' && town ? town.kingdomId : null), 'theft');
            player.notoriety = (player.notoriety || 0) + _trackedNotoriety(5);
        }

        return _schemeResult({
            successful: successful, caught: caught,
            successMsg: `✅ Stole ${qty} ${res ? res.name : resourceId}! (worth ~${value}g)`,
            caughtMsg: caughtMsg,
            partialMsg: `Stole ${qty} ${res ? res.name : resourceId} but were SEEN — goods confiscated! ` + caughtMsg,
            failMsg: '❌ Failed to grab the goods but slipped away unseen.'
        });
    }

    // ── (d2) Pickpocket ──
    function pickpocket(townId) {
        _sync();
        if (isJailed()) return { success: false, message: 'You are in jail.' };
        if (!hasSkill('discrete')) return { success: false, message: 'Requires Discrete skill.' };
        if (!isInTown(townId)) return { success: false, message: 'You must be in the town.' };
        const town = Engine.findTown(townId);
        if (!town) return { success: false, message: 'Town not found.' };

        const w = Engine.getWorld ? Engine.getWorld() : null;
        const hour = w ? (w.hour || 0) : 12;
        const isNight = (hour >= 20 || hour <= 5);
        const rng = Engine.getRng();
        const detection = calculateCorruptDetection(isNight ? 0.15 : 0.30, town);
        var _o = _rollSchemeOutcome(detection, rng);
        var caught = _o.caught;
        var successful = _o.successful;
        const yield_ = 5 + Math.floor(Math.random() * 26); // 5-30g

        if (successful) {
            player.gold += yield_;
            player.stats.totalGoldEarned += yield_;
            grantXP(3, 'Pickpocketed');
            Engine.logEvent('A townsfolk reported missing coins.');
        }

        var caughtMsg = '';
        if (caught) {
            const kingdom = Engine.findKingdom ? Engine.findKingdom(town.kingdomId) : null;
            const actualFine = applyCorruptPenalty(town, kingdom, yield_ * 3, 5, 3, false, 'theft');
            recordCorruptAction('pickpocket', true, (typeof town !== 'undefined' && town ? town.kingdomId : null), 'theft');
            player.notoriety = (player.notoriety || 0) + _trackedNotoriety(3);
            Engine.logEvent(`${player.fullName} was caught pickpocketing in ${town.name}!`);
            caughtMsg = `🚨 CAUGHT! Fined ${actualFine}g, jailed 3d.`;
            if (successful) { player.gold = Math.max(0, player.gold - yield_); }
        } else {
            recordCorruptAction('pickpocket', false, (typeof town !== 'undefined' && town ? town.kingdomId : null), 'theft');
            player.notoriety = (player.notoriety || 0) + _trackedNotoriety(2);
        }

        return _schemeResult({
            successful: successful, caught: caught,
            successMsg: `✅ Lifted ${yield_}g from an unsuspecting local!`,
            caughtMsg: caughtMsg,
            partialMsg: `Lifted ${yield_}g but were SEEN — coins recovered! ` + caughtMsg,
            failMsg: '❌ Couldn\'t get a clean grab but slipped away unseen.'
        });
    }

    // ── (d2b) Steal from NPC (targeted theft from person view) ──
    function stealFromNpc(npcId) {
        _sync();
        if (isJailed()) return { success: false, message: 'You are in jail.' };
        if (!hasSkill('discrete')) return { success: false, message: 'Requires Discrete skill.' };
        var npc = Engine.findPerson ? Engine.findPerson(npcId) : null;
        if (!npc || !npc.alive) return { success: false, message: 'Target not found.' };
        if (npc.townId !== player.townId) return { success: false, message: 'Target is not in your location.' };
        var town = Engine.findTown(player.townId);
        if (!town) return { success: false, message: 'Not in a town.' };

        // Cooldown check
        var day = Engine.getDay();
        player.schemeCooldowns = player.schemeCooldowns || {};
        var cdKey = 'steal_npc_' + npcId;
        if (player.schemeCooldowns[cdKey] && day < player.schemeCooldowns[cdKey]) {
            return { success: false, message: 'Too risky to target ' + (npc.firstName || 'them') + ' again so soon. Wait ' + (player.schemeCooldowns[cdKey] - day) + ' days.' };
        }

        var rng = Engine.getRng();
        var w = Engine.getWorld ? Engine.getWorld() : null;
        var hour = w ? (w.hour || 0) : 12;
        var baseDetect = (hour >= 20 || hour <= 5) ? 0.18 : 0.30;
        if (npc.isEliteMerchant) baseDetect += 0.15;
        if (npc.occupation === 'noble' || npc.occupation === 'king') baseDetect += 0.20;
        var detection = Math.min(0.95, calculateCorruptDetection(baseDetect, town) * _nobleTargetMult(npcId));
        // v9p33river212: independent rolls for caught & success
        // v9p33river217: noble success penalty
        var _o = _rollSchemeOutcome(detection, rng, _nobleSuccessMult(npcId));
        var caught = _o.caught;
        var successful = _o.successful;

        // Determine what to steal: gold or inventory item
        var stolenGold = 0;
        var stolenItem = null;
        var stolenQty = 0;
        var npcGold = npc.gold || 0;
        var npcInv = npc.inventory || {};
        var invKeys = Object.keys(npcInv).filter(function(k) { return npcInv[k] > 0; });
        var hasLoot = (npcGold > 10 || invKeys.length > 0);

        // Apply success effect (steal gold or item) if successful AND there's loot
        if (successful && hasLoot) {
            if (npcGold > 10 && (invKeys.length === 0 || rng.chance(0.6))) {
                // v9p33river303: when npcGold was ~30-33, the upper bound
                // floor(npcGold * 0.3) collapsed below 10, making rng.randInt
                // (10, 9) → NaN with this RNG. Clamp the max to >= the min.
                var _stealMax = Math.max(10, Math.min(100, Math.floor(npcGold * 0.3)));
                stolenGold = Math.min(npcGold, rng.randInt(10, _stealMax));
                if (npc.gold != null) npc.gold -= stolenGold;
                player.gold += stolenGold;
                player.stats.totalGoldEarned += stolenGold;
            } else if (invKeys.length > 0) {
                stolenItem = rng.pick(invKeys);
                stolenQty = Math.min(npcInv[stolenItem], rng.randInt(1, 5));
                npcInv[stolenItem] -= stolenQty;
                if (npcInv[stolenItem] <= 0) delete npcInv[stolenItem];
                player.inventory[stolenItem] = (player.inventory[stolenItem] || 0) + stolenQty;
            }
        }

        // Apply caught penalty (always if caught)
        var caughtMsg = '';
        if (caught) {
            var kingdom = Engine.findKingdom ? Engine.findKingdom(town.kingdomId) : null;
            var _isNobleTarget = npc.occupation === 'noble' || npc.occupation === 'king';
            var actualFine = applyCorruptPenalty(town, kingdom, 100, 5, 5, false, 'theft', _isNobleTarget ? { kingdomRepLoss: 5 } : null);
            recordCorruptAction('steal_npc', true, (typeof town !== 'undefined' && town ? town.kingdomId : null), 'theft');
            player.notoriety = (player.notoriety || 0) + _trackedNotoriety(5);
            player.schemeCooldowns[cdKey] = day + 30;
            if (!player.relationships) player.relationships = {};
            if (!player.relationships[npcId]) player.relationships[npcId] = { level: 50, type: 'stranger' };
            player.relationships[npcId].level = Math.max(0, (player.relationships[npcId].level || 50) - 20);
            Engine.logEvent(player.fullName + ' was caught trying to steal from ' + (npc.firstName || 'someone') + '!');
            caughtMsg = '🚨 CAUGHT! Fined ' + actualFine + 'g, jailed 5d, town rep -5' + (_isNobleTarget ? ', kingdom rep -5' : '') + ', relationship -20.';
        } else {
            recordCorruptAction('steal_npc', false, (typeof town !== 'undefined' && town ? town.kingdomId : null), 'theft');
            player.notoriety = (player.notoriety || 0) + _trackedNotoriety(3);
            player.schemeCooldowns[cdKey] = day + 15;
        }

        // Build outcome message — all 4 cases
        if (successful && hasLoot) grantXP(5, 'Stole from NPC');
        var lootDesc = '';
        if (stolenGold > 0) lootDesc = stolenGold + 'g';
        else if (stolenItem) { var res = findResource(stolenItem); lootDesc = stolenQty + ' ' + (res ? res.name : stolenItem); }

        if (successful && !caught && hasLoot) {
            return { success: true, message: '✅ Stole ' + lootDesc + ' from ' + (npc.firstName || 'them') + ' clean.' };
        }
        if (successful && caught && hasLoot) {
            return { success: true, caught: true, message: '⚠️ Stole ' + lootDesc + ' from ' + (npc.firstName || 'them') + ' but were SEEN. ' + caughtMsg };
        }
        if (!successful && caught) {
            return { success: false, caught: true, message: caughtMsg + ' (Failed to grab anything.)' };
        }
        // !successful && !caught (or no loot)
        if (!hasLoot) {
            return { success: false, message: (npc.firstName || 'They') + ' has nothing worth stealing.' };
        }
        return { success: false, message: '❌ You fumbled the attempt and slipped away empty-handed.' };
    }

    // ── (d3) Warehouse Heist ──
    function warehouseHeist(townId) {
        _sync();
        if (isJailed()) return { success: false, message: 'You are in jail.' };
        if (!isInTown(townId)) return { success: false, message: 'You must be in the town.' };
        if (!hasSkill('shadow_dealings') && !hasSkill('discrete')) return { success: false, message: 'Requires Shadow Dealings or Discrete skill.' };
        if ((player.inventory.tools || 0) < 1) return { success: false, message: 'Need 1 tools to break in.' };
        const town = Engine.findTown(townId);
        if (!town) return { success: false, message: 'Town not found.' };

        player.inventory.tools -= 1;
        const w = Engine.getWorld ? Engine.getWorld() : null;
        const hour = w ? (w.hour || 0) : 12;
        const isNight = (hour >= 20 || hour <= 5);
        const rng = Engine.getRng();
        const detection = calculateCorruptDetection(isNight ? 0.25 : 0.45, town);
        var _o = _rollSchemeOutcome(detection, rng);
        var caught = _o.caught;
        var successful = _o.successful;

        // Pick random goods from town market
        const marketKeys = Object.keys(town.market.supply || {}).filter(k => (town.market.supply[k] || 0) > 5);
        if (marketKeys.length === 0) return { success: false, message: 'Nothing worth stealing here.' };

        var stolenMsg = [];
        var totalValue = 0;
        var stolenLog = []; // for unwinding if caught + successful
        if (successful) {
            const numGoods = 1 + Math.floor(Math.random() * 3);
            for (let g = 0; g < numGoods && g < marketKeys.length; g++) {
                const resId = marketKeys[Math.floor(Math.random() * marketKeys.length)];
                const avail = town.market.supply[resId] || 0;
                const qty = Math.min(avail, 10 + Math.floor(Math.random() * 41));
                if (qty <= 0) continue;
                town.market.supply[resId] -= qty;
                player.inventory[resId] = (player.inventory[resId] || 0) + qty;
                stolenLog.push({ resId: resId, qty: qty });
                const res = findResource(resId);
                const localP = (town.market && town.market.prices && town.market.prices[resId]) || (res ? res.basePrice : 10);
                totalValue += Math.floor(localP * qty);
                stolenMsg.push(`${qty} ${res ? res.name : resId}`);
            }
            grantXP(15, 'Warehouse heist');
            Engine.logEvent('A warehouse in ' + town.name + ' was broken into overnight.');
        }

        var caughtMsg = '';
        if (caught) {
            const kingdom = Engine.findKingdom ? Engine.findKingdom(town.kingdomId) : null;
            var estValue = 0;
            for (var _ek = 0; _ek < Math.min(3, marketKeys.length); _ek++) {
                var _eResId = marketKeys[_ek];
                var _ePrice = (town.market.prices && town.market.prices[_eResId]) || 10;
                estValue += _ePrice * 20;
            }
            var heistFine = Math.max(200, Math.floor(estValue * 2));
            const actualFine = applyCorruptPenalty(town, kingdom, heistFine, 20, 10, false, 'theft');
            recordCorruptAction('warehouse_heist', true, (typeof town !== 'undefined' && town ? town.kingdomId : null), 'theft');
            player.notoriety = (player.notoriety || 0) + _trackedNotoriety(10);
            Engine.logEvent(`${player.fullName} was caught breaking into a warehouse in ${town.name}!`);
            caughtMsg = `🚨 CAUGHT! Fined ${actualFine}g, jailed 10d, rep -20.`;
            // Unwind any loot if caught
            if (successful) {
                for (var _ul = 0; _ul < stolenLog.length; _ul++) {
                    var _u = stolenLog[_ul];
                    town.market.supply[_u.resId] += _u.qty;
                    player.inventory[_u.resId] = Math.max(0, (player.inventory[_u.resId] || 0) - _u.qty);
                }
            }
        } else {
            recordCorruptAction('warehouse_heist', false, (typeof town !== 'undefined' && town ? town.kingdomId : null), 'theft');
            player.notoriety = (player.notoriety || 0) + _trackedNotoriety(8);
        }

        return _schemeResult({
            successful: successful, caught: caught,
            successMsg: `✅ Heist successful! Stole: ${stolenMsg.join(', ')} (worth ~${totalValue}g)`,
            caughtMsg: caughtMsg,
            partialMsg: `Heist netted ${stolenMsg.join(', ')} but you were SEEN — goods confiscated! ` + caughtMsg,
            failMsg: '❌ The lock held; you slipped away unseen but empty-handed.'
        });
    }

    // ── (d4) Rob Traveler ──
    function robTraveler(townId) {
        _sync();
        if (isJailed()) return { success: false, message: 'You are in jail.' };
        if (!isInTown(townId)) return { success: false, message: 'You must be in the town.' };
        if (!hasSkill('shadow_dealings')) return { success: false, message: 'Requires Shadow Dealings skill.' };
        const town = Engine.findTown(townId);
        if (!town) return { success: false, message: 'Town not found.' };

        const rng = Engine.getRng();
        const detection = calculateCorruptDetection(0.20, town);
        var _o = _rollSchemeOutcome(detection, rng);
        var caught = _o.caught;
        // robTraveler's success check is the combat roll below — _o.successful
        // is unused (combat decides the loot outcome). caught is now independent.

        // Combat check — having weapon/armor helps, bows need arrows
        const hasWeapon = !!player.weapon;
        const hasArmor = !!player.armor;
        var weaponPower = 5;
        if (hasWeapon) {
            var isBowDD = player.weapon && typeof player.weapon === 'object' &&
                (player.weapon.id === 'short_bow' || player.weapon.id === 'hunting_bow' || player.weapon.id === 'longbow' || player.weapon.id === 'war_bow');
            if (isBowDD) {
                var inv = player.inventory || {};
                if ((inv.arrows_excellent || 0) > 0 || (inv.arrows_good || 0) > 0 || (inv.arrows || 0) > 0) {
                    weaponPower = 30;
                    if (isBowDD && typeof Player !== 'undefined' && Player.consumePlayerArrows) Player.consumePlayerArrows();
                } else {
                    weaponPower = 5; // bow without arrows = useless
                }
            } else {
                weaponPower = 30;
            }
        }
        const combatPower = weaponPower + (hasArmor ? 20 : 0) + (player.militaryRank ? 15 : 0);
        const travelerFight = 10 + Math.floor(Math.random() * 40); // 10-50
        const playerWins = combatPower > travelerFight;

        // Apply success effect if combat won (independent of caught)
        var goldStolen = 0;
        var goodsMsg = '';
        if (playerWins) {
            goldStolen = 20 + Math.floor(Math.random() * 81);
            player.gold += goldStolen;
            player.stats.totalGoldEarned += goldStolen;
            if (Math.random() < 0.5) {
                const possibleGoods = ['bread', 'cloth', 'wine', 'jewelry', 'herbs', 'salt'];
                const resId = possibleGoods[Math.floor(Math.random() * possibleGoods.length)];
                const qty = 1 + Math.floor(Math.random() * 5);
                player.inventory[resId] = (player.inventory[resId] || 0) + qty;
                const res = findResource(resId);
                goodsMsg = ` + ${qty} ${res ? res.name : resId}`;
            }
            grantXP(10, 'Robbed traveler');
            Engine.logEvent('A traveler was robbed on the road near ' + town.name + '.', null, 'local_town');
        }

        var caughtMsg = '';
        if (caught) {
            const kingdom = Engine.findKingdom ? Engine.findKingdom(town.kingdomId) : null;
            const actualFine = applyCorruptPenalty(town, kingdom, 300, 15, 7, false, 'theft');
            recordCorruptAction('rob_traveler', true, (typeof town !== 'undefined' && town ? town.kingdomId : null), 'theft');
            player.notoriety = (player.notoriety || 0) + _trackedNotoriety(8);
            Engine.logEvent(`${player.fullName} was caught robbing travelers near ${town.name}!`, null, 'my_actions');
            caughtMsg = `🚨 CAUGHT! Fined ${actualFine}g, jailed 7d.`;
        } else {
            recordCorruptAction('rob_traveler', false, (typeof town !== 'undefined' && town ? town.kingdomId : null), 'theft');
            player.notoriety = (player.notoriety || 0) + _trackedNotoriety(playerWins ? 6 : 5);
        }

        if (!playerWins && !caught) {
            return { success: false, message: '⚔️ The traveler fought back! You fled empty-handed.' };
        }
        if (!playerWins && caught) {
            return { success: false, caught: true, message: '⚔️ The traveler fought back AND guards spotted you! ' + caughtMsg };
        }
        return _schemeResult({
            successful: playerWins, caught: caught,
            successMsg: `✅ Robbed a traveler for ${goldStolen}g${goodsMsg}!`,
            caughtMsg: caughtMsg,
            partialMsg: `Robbed a traveler for ${goldStolen}g${goodsMsg} but were SEEN! ` + caughtMsg,
            failMsg: '❌ Failed.'
        });
    }

    // ── (d5) Raid Caravan ──
    function raidCaravan(townId) {
        _sync();
        if (isJailed()) return { success: false, message: 'You are in jail.' };
        if (!isInTown(townId)) return { success: false, message: 'You must be in the town.' };
        if (player.gold < 200) return { success: false, message: 'Need 200g to hire bandits.' };
        if (!hasSkill('dark_connections') && player.notoriety < 40) return { success: false, message: 'Requires Dark Connections skill or 40+ notoriety.' };
        const town = Engine.findTown(townId);
        if (!town) return { success: false, message: 'Town not found.' };

        player.gold -= 200;
        player.stats.totalGoldSpent += 200;

        const rng = Engine.getRng();
        const detection = calculateCorruptDetection(0.35, town);
        var _o = _rollSchemeOutcome(detection, rng);
        var caught = _o.caught;
        var successful = _o.successful;

        // 20% chance bandits just take the money and run (overrides success)
        if (Math.random() < 0.2) {
            recordCorruptAction('raid_caravan', true, (typeof town !== 'undefined' && town ? town.kingdomId : null), 'theft');
            player.notoriety = (player.notoriety || 0) + _trackedNotoriety(3);
            Engine.logEvent('The bandits you hired took your gold and disappeared.');
            return { success: false, message: '💀 The bandits took your 200g and vanished! Never trust criminals.' };
        }

        var stolenMsg = [];
        var totalValue = 0;
        if (successful) {
            const possibleGoods = ['wheat', 'iron', 'cloth', 'wine', 'tools', 'weapons', 'armor', 'silk', 'spices', 'jewelry'];
            const numGoods = 2 + Math.floor(Math.random() * 3); // 2-4 types
            for (let g = 0; g < numGoods; g++) {
                const resId = possibleGoods[Math.floor(Math.random() * possibleGoods.length)];
                const qty = 10 + Math.floor(Math.random() * 41); // 10-50
                player.inventory[resId] = (player.inventory[resId] || 0) + qty;
                const res = findResource(resId);
                totalValue += (res ? res.basePrice : 15) * qty;
                stolenMsg.push(`${qty} ${res ? res.name : resId}`);
            }
            grantXP(25, 'Raided caravan');
            Engine.logEvent('A trade caravan was ambushed on the roads near ' + town.name + '.');
        }

        var caughtMsg = '';
        if (caught) {
            const kingdom = Engine.findKingdom ? Engine.findKingdom(town.kingdomId) : null;
            const actualFine = applyCorruptPenalty(town, kingdom, 1000, 30, 15, true, 'theft');
            recordCorruptAction('raid_caravan', true, (typeof town !== 'undefined' && town ? town.kingdomId : null), 'theft');
            player.notoriety = (player.notoriety || 0) + _trackedNotoriety(15);
            Engine.logEvent(`${player.fullName} was linked to a caravan raid near ${town.name}!`);
            caughtMsg = `🚨 CAUGHT! Fined ${actualFine}g, jailed 15d, rep -30, EXILED. Serious crime!`;
        } else {
            recordCorruptAction('raid_caravan', false, (typeof town !== 'undefined' && town ? town.kingdomId : null), 'theft');
            player.notoriety = (player.notoriety || 0) + _trackedNotoriety(12);
        }

        return _schemeResult({
            successful: successful, caught: caught,
            successMsg: `✅ Caravan raid successful! Loot: ${stolenMsg.join(', ')} (worth ~${totalValue}g)`,
            caughtMsg: caughtMsg,
            partialMsg: `Raid netted ${stolenMsg.join(', ')} but you were LINKED to it! ` + caughtMsg,
            failMsg: '❌ The raid failed (200g lost) but no one connected you to it.'
        });
    }

    // ── (e) Sell Counterfeit Goods ──
    function sellCounterfeit(resourceId, qty, townId) {
        _sync();
        qty = Number(qty);
        if (!qty || !isFinite(qty) || qty <= 0) return { success: false, message: 'Invalid quantity.' };
        qty = Math.floor(qty);
        if (isJailed()) return { success: false, message: 'You are in jail.' };
        if (!hasSkill('master_forger')) return { success: false, message: 'Requires Master Forger skill.' };
        if (!isInTown(townId)) return { success: false, message: 'You must be in the town.' };
        const town = Engine.findTown(townId);
        if (!town) return { success: false, message: 'Town not found.' };
        const allowedGoods = ['jewelry', 'wine', 'cloth'];
        if (!allowedGoods.includes(resourceId)) return { success: false, message: 'Can only counterfeit jewelry, wine, or cloth.' };
        const res = findResource(resourceId);
        if (!res) return { success: false, message: 'Resource not found.' };

        const rng = Engine.getRng();
        const detection = calculateCorruptDetection(0.30, town);
        var _o = _rollSchemeOutcome(detection, rng);
        var caught = _o.caught;
        var successful = _o.successful;
        const revenue = Math.floor(res.basePrice * qty * ((town.market && town.market.prices[resourceId]) ? town.market.prices[resourceId] / res.basePrice : 1));

        if (successful) {
            player.gold += revenue;
            player.stats.totalGoldEarned += revenue;
            grantXP(15, 'Sold counterfeit goods');
        }

        var caughtMsg = '';
        if (caught) {
            const kingdom = Engine.findKingdom ? Engine.findKingdom(town.kingdomId) : null;
            const actualFine = applyCorruptPenalty(town, kingdom, revenue * 3, 25, 10, false, 'counterfeiting');
            const kId = town.kingdomId;
            if (kId && player.licenses[kId]) player.licenses[kId] = [];
            recordCorruptAction('counterfeit', true, (typeof town !== 'undefined' && town ? town.kingdomId : null), 'counterfeiting');
            player.notoriety = (player.notoriety || 0) + _trackedNotoriety(15);
            Engine.logEvent(`${player.fullName} was caught selling counterfeit goods in ${town.name}!`);
            caughtMsg = `🚨 CAUGHT! Fined ${actualFine}g, jailed 10d, all licenses revoked.`;
        } else {
            recordCorruptAction('counterfeit', false, (typeof town !== 'undefined' && town ? town.kingdomId : null), 'counterfeiting');
            player.notoriety = (player.notoriety || 0) + _trackedNotoriety(15);
        }

        return _schemeResult({
            successful: successful, caught: caught,
            successMsg: `✅ Sold ${qty} counterfeit ${res.name} for ${revenue}g!`,
            caughtMsg: caughtMsg,
            partialMsg: `Sold ${qty} counterfeit ${res.name} for ${revenue}g — but the buyer reported you! ` + caughtMsg,
            failMsg: '❌ The buyers refused the goods (no sale) but no one suspects you.'
        });
    }

    // ── (f) Bribe Guards ──
    function bribeGuards(townId, amount) {
        _sync();
        amount = Number(amount);
        if (!amount || !isFinite(amount) || amount <= 0) return { success: false, message: 'Invalid bribe amount.' };
        amount = Math.floor(amount);
        if (isJailed()) return { success: false, message: 'You are in jail.' };
        if (!isInTown(townId)) return { success: false, message: 'You must be in the town.' };
        const town = Engine.findTown(townId);
        if (!town) return { success: false, message: 'Town not found.' };
        const security = (town.security || 50);
        const minCost = Math.floor(50 + security * 4.5);
        if (!amount || amount < minCost) return { success: false, message: `Minimum bribe: ${minCost}g for this town's security level.` };
        if (amount > 500) amount = 500;
        if (player.gold < amount) return { success: false, message: 'Not enough gold.' };

        player.gold -= amount;
        const rng = Engine.getRng();
        let detection = calculateCorruptDetection(0.10, town);
        if (hasSkill('silver_tongue_dark')) detection *= 0.75;
        var _o = _rollSchemeOutcome(detection, rng);
        var caught = _o.caught;
        var successful = _o.successful;

        if (successful) {
            player.bribedGuards[townId] = { expiresDay: Engine.getDay() + 30, reductionPct: 40 };
            player.achievementStats.bribesGiven = (player.achievementStats.bribesGiven || 0) + 1;
            grantXP(5, 'Bribed guards');
            Engine.logEvent(`Guards in ${town.name} have been bribed.`);
        }

        var caughtMsg = '';
        if (caught) {
            const kingdom = Engine.findKingdom ? Engine.findKingdom(town.kingdomId) : null;
            const actualFine = applyCorruptPenalty(town, kingdom, amount * 2, 15, 0, false, 'bribery');
            recordCorruptAction('bribe_guards', true, (typeof town !== 'undefined' && town ? town.kingdomId : null), 'bribery');
            player.notoriety = (player.notoriety || 0) + _trackedNotoriety(3);
            Engine.logEvent(`${player.fullName} was caught trying to bribe guards in ${town.name}!`);
            caughtMsg = `🚨 CAUGHT! Fined ${actualFine}g, rep -15.`;
        } else {
            recordCorruptAction('bribe_guards', false, (typeof town !== 'undefined' && town ? town.kingdomId : null), 'bribery');
            player.notoriety = (player.notoriety || 0) + _trackedNotoriety(3);
        }

        return _schemeResult({
            successful: successful, caught: caught,
            successMsg: `✅ Guards bribed! Detection -40% in ${town.name} for 30 days.`,
            caughtMsg: caughtMsg,
            partialMsg: `Guards bribed (-40% detection 30d) but you were SEEN making the offer! ` + caughtMsg,
            failMsg: '❌ The guards refused your bribe (' + amount + 'g lost) but didn\'t report you.'
        });
    }

    // ── (g) Bribe Royal Advisor ──
    function bribeAdvisor(kingdomId, voteDirection) {
        _sync();
        if (isJailed()) return { success: false, message: 'You are in jail.' };
        const kingdom = Engine.findKingdom ? Engine.findKingdom(kingdomId) : null;
        if (!kingdom) return { success: false, message: 'Kingdom not found.' };
        if (!hasSkill('silver_tongue_dark')) {
            // Check relationship with advisor NPCs
            const towns = Engine.getTowns ? Engine.getTowns() : [];
            let hasAdvisorRel = false;
            for (const t of towns) {
                if (t.kingdomId !== kingdomId) continue;
                const people = Engine.getPeople ? Engine.getPeople(t.id) : [];
                for (const p of people) {
                    if (p.occupation === 'noble' || p.occupation === 'advisor') {
                        const rel = player.relationships[p.id];
                        if (rel && rel.level >= 30) { hasAdvisorRel = true; break; }
                    }
                }
                if (hasAdvisorRel) break;
            }
            if (!hasAdvisorRel) return { success: false, message: 'Need relationship >= 30 with an advisor, or Silver Tongue skill.' };
        }

        const prosperity = kingdom.prosperity || 50;
        const cost = Math.floor(500 + prosperity * 15);
        if (player.gold < cost) return { success: false, message: `Need ${cost}g to bribe advisor.` };

        player.gold -= cost;
        const town = Engine.findTown(player.townId);
        const rng = Engine.getRng();
        let detection = calculateCorruptDetection(0.20, town);
        if (hasSkill('silver_tongue_dark')) detection *= 0.75;
        if (hasSkill('kingmaker_skill')) detection *= 0.8;
        var _o = _rollSchemeOutcome(detection, rng);
        var caught = _o.caught;
        var successful = _o.successful;

        if (successful) {
            grantXP(25, 'Bribed royal advisor');
            const kBribes = (player.crimesCommitted['bribe_advisor_' + kingdomId] || 0) + 1;
            player.crimesCommitted['bribe_advisor_' + kingdomId] = kBribes;
            if (kBribes >= 5) unlockAchievement('shadow_emperor');
            Engine.logEvent(`A royal advisor in ${kingdom.name} has been influenced.`);
        }

        var caughtMsg = '';
        if (caught) {
            const actualFine = applyCorruptPenalty(town, kingdom, 2000, 30, 0, true, 'bribery', { isNobleTarget: true });
            recordCorruptAction('bribe_advisor', true, (typeof town !== 'undefined' && town ? town.kingdomId : null), 'bribery');
            player.notoriety = (player.notoriety || 0) + _trackedNotoriety(12);
            Engine.logEvent(`${player.fullName} was caught bribing a royal advisor in ${kingdom.name}!`);
            caughtMsg = `🚨 CAUGHT! Fined ${actualFine}g, exiled from ${kingdom.name}!`;
        } else {
            recordCorruptAction('bribe_advisor', false, (typeof town !== 'undefined' && town ? town.kingdomId : null), 'bribery');
            player.notoriety = (player.notoriety || 0) + _trackedNotoriety(12);
        }

        return _schemeResult({
            successful: successful, caught: caught,
            successMsg: `✅ Advisor bribed! The next ${voteDirection || 'vote'} will go your way.`,
            caughtMsg: caughtMsg,
            partialMsg: `Advisor was bribed but the king's spies caught wind of it! ` + caughtMsg,
            failMsg: '❌ The advisor refused your bribe (' + cost + 'g lost) but didn\'t report you.'
        });
    }

    // ── (h) Cultivate the Heir ──
    function cultivateHeir(kingdomId) {
        _sync();
        if (isJailed()) return { success: false, message: 'You are in jail.' };
        const kingdom = Engine.findKingdom ? Engine.findKingdom(kingdomId) : null;
        if (!kingdom) return { success: false, message: 'Kingdom not found.' };
        // Check for luxury goods to gift
        const luxuryGoods = ['jewelry', 'wine', 'silk', 'pearls', 'gold_ore'];
        let giftValue = 0;
        let giftsUsed = {};
        for (const g of luxuryGoods) {
            const qty = player.inventory[g] || 0;
            if (qty > 0) {
                const res = findResource(g);
                const useQty = Math.min(qty, 5);
                giftValue += (res ? res.basePrice : 20) * useQty;
                giftsUsed[g] = useQty;
            }
        }
        if (giftValue < 100) return { success: false, message: 'Need at least 100g worth of luxury goods (jewelry, wine, silk, pearls, gold ore).' };

        // Consume gifts
        for (const [resId, qty] of Object.entries(giftsUsed)) {
            player.inventory[resId] = (player.inventory[resId] || 0) - qty;
        }

        // Increase favor
        const favorGain = Math.min(15, Math.floor(giftValue / 50));
        player.heirFavor[kingdomId] = Math.min(100, (player.heirFavor[kingdomId] || 0) + favorGain);
        grantXP(5, 'Cultivated heir');
        if (player.heirFavor[kingdomId] >= 80) unlockAchievement('master_puppeteer');
        Engine.logEvent(`${player.fullName} gifted luxury goods to the heir of ${kingdom.name}.`);
        return { success: true, message: `✅ Heir favor in ${kingdom.name}: ${player.heirFavor[kingdomId]}/100 (+${favorGain}).` };
    }

    // ── (i) Blackmail NPC ──
    function blackmailNPC(personId) {
        _sync();
        if (isJailed()) return { success: false, message: 'You are in jail.' };
        if (!hasSkill('shadow_dealings') && !hasSkill('silver_tongue_dark')) return { success: false, message: 'Requires Shadow Dealings or Silver Tongue (Dark) skill.' };
        const person = Engine.findPerson ? Engine.findPerson(personId) : null;
        if (!person || !person.alive) return { success: false, message: 'Person not found or dead.' };
        if (player.blackmailTargets[personId]) return { success: false, message: 'Already blackmailing this person.' };

        const town = Engine.findTown(person.townId || player.townId);
        const rng = Engine.getRng();
        const detection = Math.min(0.95, calculateCorruptDetection(0.25, town) * _nobleTargetMult(personId) * _targetWealthDetectMult(personId));
        var _o = _rollSchemeOutcome(detection, rng);
        var caught = _o.caught;
        var successful = _o.successful;

        var payment = 0;
        if (successful) {
            payment = rng ? rng.randInt(50, 200) : 100;
            player.blackmailTargets[personId] = { paymentPerSeason: payment, nextPayDay: Engine.getDay() + 90 };
            grantXP(15, 'Blackmailed NPC');
            if (player.doubleNobleAgent && person.occupation === 'noble') {
                var _blkTown = Engine.findTown(person.townId || player.townId);
                if (_blkTown && _blkTown.kingdomId === player.doubleNobleAgent.targetKingdomId) _trackDnaTask('blackmail_noble');
            }
            Engine.logEvent(`${person.firstName} is now being blackmailed.`);
        }

        var caughtMsg = '';
        if (caught) {
            const kingdom = Engine.findKingdom ? Engine.findKingdom(town ? town.kingdomId : null) : null;
            var _isNoble = person && (person.occupation === 'noble' || person.occupation === 'king');
            applyCorruptPenalty(town, kingdom, 0, 20, 0, false, 'blackmail', _isNoble ? { isNobleTarget: true } : null);
            if (player.relationships[personId]) player.relationships[personId].level = 0;
            // v9p33river323: was recording as 'forgery' — wrong crime
            // profile for blackmail. Now records the actual offense.
            recordCorruptAction('blackmail', true, (typeof town !== 'undefined' && town ? town.kingdomId : null), 'blackmail');
            player.notoriety = (player.notoriety || 0) + _trackedNotoriety(10);
            var _nnResult = _addNobleNotorietyAndCheck(CONFIG.NOBLE_NOTORIETY_DIRECT_NOBLE_ADD || 20, 'blackmailing a noble');
            var _nnMsg = _nnResult && _nnResult.punished ? ' ' + _nnResult.message : '';
            Engine.logEvent(`${player.fullName} was exposed trying to blackmail ${person.firstName}!`);
            caughtMsg = `🚨 CAUGHT! Reputation -20, relationship with ${person.firstName} destroyed.` + _nnMsg;
        } else {
            recordCorruptAction('blackmail', false, (typeof town !== 'undefined' && town ? town.kingdomId : null), 'blackmail');
            player.notoriety = (player.notoriety || 0) + _trackedNotoriety(10);
        }

        return _schemeResult({
            successful: successful, caught: caught,
            successMsg: `✅ Blackmailing ${person.firstName} for ${payment}g per season!`,
            caughtMsg: caughtMsg,
            partialMsg: `Blackmail set up (${payment}g/season) but you were exposed! ` + caughtMsg,
            failMsg: `❌ ${person.firstName} didn't bite — but you slipped away unseen.`
        });
    }

    // ── (j) Spread Rumors ──
    function spreadRumors(targetMerchantId) {
        _sync();
        if (isJailed()) return { success: false, message: 'You are in jail.' };
        if (!hasSkill('silver_tongue_dark') && !hasSkill('discrete')) return { success: false, message: 'Requires Silver Tongue (Dark) or Discrete skill.' };
        if (player.gold < 50) return { success: false, message: 'Need 50g to pay gossips.' };

        player.gold -= 50;
        const town = Engine.findTown(player.townId);
        const rng = Engine.getRng();
        const detection = Math.min(0.95, calculateCorruptDetection(0.15, town) * _nobleTargetMult(targetMerchantId) * _targetWealthDetectMult(targetMerchantId));
        var _o = _rollSchemeOutcome(detection, rng);
        var caught = _o.caught;
        var successful = _o.successful;

        if (successful) {
            player.rumorTargets[targetMerchantId] = { expiresDay: Engine.getDay() + 60 };
            grantXP(8, 'Spread rumors');
            if (player.doubleNobleAgent && targetMerchantId) {
                var _rumTarget = Engine.findPerson ? Engine.findPerson(targetMerchantId) : null;
                if (_rumTarget && _rumTarget.isKing) {
                    var _rumTown = Engine.findTown(_rumTarget.townId);
                    if (_rumTown && _rumTown.kingdomId === player.doubleNobleAgent.targetKingdomId) _trackDnaTask('spread_rumors_king');
                }
            }
            Engine.logEvent('Rumors are spreading about a merchant...');
        }

        var caughtMsg = '';
        if (caught) {
            const kingdom = Engine.findKingdom ? Engine.findKingdom(town ? town.kingdomId : null) : null;
            // v9p33river323: caught rumor-spreading was being recorded
            // and punished as 'forgery' / 'blackmail' crime profiles.
            // Now uses the canonical 'spread_rumors' crime id (or
            // 'fraud' fallback) for both penalty + record.
            applyCorruptPenalty(town, kingdom, 0, 10, 0, false, 'fraud');
            if (player.relationships[targetMerchantId]) player.relationships[targetMerchantId].level = 0;
            recordCorruptAction('spread_rumors', true, (typeof town !== 'undefined' && town ? town.kingdomId : null), 'fraud');
            player.notoriety = (player.notoriety || 0) + _trackedNotoriety(5);
            caughtMsg = '🚨 CAUGHT! Reputation -10. Target knows you spread rumors.';
        } else {
            recordCorruptAction('spread_rumors', false, (typeof town !== 'undefined' && town ? town.kingdomId : null), 'forgery');
            player.notoriety = (player.notoriety || 0) + _trackedNotoriety(5);
        }

        return _schemeResult({
            successful: successful, caught: caught,
            successMsg: '✅ Rumors spread! Target reputation damaged for 60 days.',
            caughtMsg: caughtMsg,
            partialMsg: 'Rumors spread but you were SEEN! ' + caughtMsg,
            failMsg: '❌ The gossips ignored you (50g lost) but no one suspects you.'
        });
    }

    // ── (k) Frame Competitor ──
    function frameCompetitor(targetMerchantId, crimeType) {
        _sync();
        if (isJailed()) return { success: false, message: 'You are in jail.' };
        if (!hasSkill('shadow_dealings') && !hasSkill('master_forger')) return { success: false, message: 'Requires Shadow Dealings or Master Forger skill.' };
        if (player.gold < 200) return { success: false, message: 'Need 200g for planting evidence.' };
        const town = Engine.findTown(player.townId);
        if (!town) return { success: false, message: 'Must be in a town.' };

        player.gold -= 200;
        const rng = Engine.getRng();
        const detection = Math.min(0.95, calculateCorruptDetection(0.30, town) * _nobleTargetMult(targetMerchantId) * _targetWealthDetectMult(targetMerchantId));
        var _o2 = _rollSchemeOutcome(detection, rng, _nobleSuccessMult(targetMerchantId));
        var caught = _o2.caught;
        var successful = _o2.successful;

        if (successful) {
            grantXP(20, 'Framed competitor');
            Engine.logEvent('A merchant has been falsely accused of a crime!');
        }

        var caughtMsg = '';
        if (caught) {
            const kingdom = Engine.findKingdom ? Engine.findKingdom(town.kingdomId) : null;
            var _ftarget = Engine.findPerson ? Engine.findPerson(targetMerchantId) : null;
            var _fIsNoble = _ftarget && (_ftarget.occupation === 'noble' || _ftarget.occupation === 'king');
            const actualFine = applyCorruptPenalty(town, kingdom, 500, 25, 10, false, 'forgery', _fIsNoble ? { isNobleTarget: true } : null);
            recordCorruptAction('frame_competitor', true, (typeof town !== 'undefined' && town ? town.kingdomId : null), 'forgery');
            player.notoriety = (player.notoriety || 0) + _trackedNotoriety(15);
            Engine.logEvent(`${player.fullName} was caught trying to frame a competitor!`);
            caughtMsg = `🚨 CAUGHT! Fined ${actualFine}g, jailed 10d, rep -25.`;
        } else {
            recordCorruptAction('frame_competitor', false, (typeof town !== 'undefined' && town ? town.kingdomId : null), 'forgery');
            player.notoriety = (player.notoriety || 0) + _trackedNotoriety(15);
        }

        return _schemeResult({
            successful: successful, caught: caught,
            successMsg: `✅ Competitor framed for ${crimeType || 'smuggling'}! They face fines and jail.`,
            caughtMsg: caughtMsg,
            partialMsg: `Competitor framed but the planted evidence pointed back at you! ` + caughtMsg,
            failMsg: '❌ The evidence didn\'t convince anyone (200g lost) but you escaped suspicion.'
        });
    }

    // ── (l/m/n) Hire Assassin ──
    function hireAssassin(targetId, type) {
        _sync();
        if (isJailed()) return { success: false, message: 'You are in jail.' };
        if (!hasSkill('dark_connections') && !hasSkill('assassin')) return { success: false, message: 'Requires Dark Connections or Assassin skill.' };
        const rng = Engine.getRng();
        const town = Engine.findTown(player.townId);

        if (type === 'king') {
            if (!hasSkill('kingmaker_skill') && !hasSkill('dark_connections')) {
                return { success: false, message: 'Requires Kingmaker or Dark Connections skill.' };
            }
            const kingdom = Engine.findKingdom ? Engine.findKingdom(targetId) : null;
            if (!kingdom) return { success: false, message: 'Kingdom not found.' };
            const cost = rng ? rng.randInt(10000, 25000) : 15000;
            if (player.gold < cost) return { success: false, message: `Need ${cost}g to hire assassin for a king.` };

            player.gold -= cost;
            let detection = calculateCorruptDetection(0.50, town);
            if (hasSkill('kingmaker_skill')) detection *= 0.7;
            var _ko = _rollSchemeOutcome(detection, rng, 0.30); // King success penalty
            var caught = _ko.caught;
            var successful = _ko.successful;

            if (successful) {
                grantXP(100, 'Assassinated king');
                unlockAchievement('kingslayer_ach');
                Engine.logEvent(`The king of ${kingdom.name} has been assassinated!`);
            }

            var caughtMsg = '';
            if (caught) {
                const kingdoms = Engine.getKingdoms ? Engine.getKingdoms() : [];
                for (const k of kingdoms) {
                    player.reputation[k.id] = 0;
                }
                player.jailedUntilDay = 0;
                recordCorruptAction('assassinate_king', true, (typeof town !== 'undefined' && town ? town.kingdomId : null), 'murder');
                player.notoriety = (player.notoriety || 0) + _trackedNotoriety(100);
                _addNobleNotorietyAndCheck(CONFIG.NOBLE_NOTORIETY_DIRECT_NOBLE_ADD || 20, 'plotting regicide');
                Engine.logEvent(`${player.fullName} was caught plotting regicide against ${kingdom.name}!`);
                caughtMsg = '🚨 CAUGHT! Exiled from ALL kingdoms! All reputation lost! Permanent bounty!';
            } else {
                recordCorruptAction('assassinate_king', false, (typeof town !== 'undefined' && town ? town.kingdomId : null), 'murder');
                player.notoriety = (player.notoriety || 0) + _trackedNotoriety(100);
            }

            return _schemeResult({
                successful: successful, caught: caught,
                successMsg: `✅ The king of ${kingdom.name} is dead! The heir now rules.`,
                caughtMsg: caughtMsg,
                partialMsg: `The king is dead but you were exposed as the conspirator! ` + caughtMsg,
                failMsg: '❌ The assassin failed (' + cost + 'g lost) but no one connected the plot to you.'
            });
        }

        if (type === 'guard_captain') {
            const cost = rng ? rng.randInt(2000, 5000) : 3000;
            if (player.gold < cost) return { success: false, message: `Need ${cost}g to hire assassin for guard captain.` };

            player.gold -= cost;
            const detection = calculateCorruptDetection(0.25, town);
            var _gco = _rollSchemeOutcome(detection, rng);
            var caught = _gco.caught;
            var successful = _gco.successful;

            if (successful) {
                if (town) town.security = Math.max(0, (town.security || 50) - 30);
                grantXP(40, 'Assassinated guard captain');
                if (player.doubleNobleAgent && town && town.kingdomId === player.doubleNobleAgent.targetKingdomId) _trackDnaTask('weaken_army');
                Engine.logEvent(`The guard captain in ${town ? town.name : 'a town'} has been assassinated!`);
            }

            var caughtMsg = '';
            if (caught) {
                const kingdom = Engine.findKingdom ? Engine.findKingdom(town ? town.kingdomId : null) : null;
                applyCorruptPenalty(town, kingdom, 0, 0, 0, true, 'murder', { isNobleTarget: true });
                recordCorruptAction('assassinate_guard_captain', true, (typeof town !== 'undefined' && town ? town.kingdomId : null), 'murder');
                player.notoriety = (player.notoriety || 0) + _trackedNotoriety(40);
                _addNobleNotorietyAndCheck(CONFIG.NOBLE_NOTORIETY_DIRECT_NOBLE_ADD || 20, 'assassinating guard captain');
                Engine.logEvent(`${player.fullName} was caught hiring an assassin for the guard captain!`);
                caughtMsg = '🚨 CAUGHT! Exiled! All kingdom assets seized!';
            } else {
                recordCorruptAction('assassinate_guard_captain', false, (typeof town !== 'undefined' && town ? town.kingdomId : null), 'murder');
                player.notoriety = (player.notoriety || 0) + _trackedNotoriety(40);
            }

            return _schemeResult({
                successful: successful, caught: caught,
                successMsg: `✅ Guard captain eliminated! Town security dropped 30 for 90d.`,
                caughtMsg: caughtMsg,
                partialMsg: `Guard captain killed but you were named as the conspirator! ` + caughtMsg,
                failMsg: '❌ The assassin failed (' + cost + 'g lost) but no one suspects you.'
            });
        }

        // type === 'competitor' (default)
        // v9p33river224: cost = 10k–20k base × wealth mult × noble cost mult.
        // Wealth mult helper does the tiering. Detection also wealth-scales.
        var costBase = rng ? rng.randInt(10000, 20000) : 15000;
        const cost = Math.floor(costBase * _targetWealthCostMult(targetId) * _nobleTargetCostMult(targetId));
        if (player.gold < cost) return { success: false, message: `Need ${cost.toLocaleString()}g to hire assassin (target's wealth/standing makes this expensive).` };

        player.gold -= cost;
        const detection = Math.min(0.95, calculateCorruptDetection(0.20, town) * _nobleTargetMult(targetId) * _targetWealthDetectMult(targetId));
        var _ho = _rollSchemeOutcome(detection, rng, _nobleSuccessMult(targetId));
        var caught = _ho.caught;
        var successful = _ho.successful;

        var _hatarget = Engine.findPerson ? Engine.findPerson(targetId) : null;
        if (successful && _hatarget && _hatarget.alive) {
            _hatarget.alive = false;
            _hatarget.deathCause = 'assassinated';
            grantXP(30, 'Hired assassin');
            if (player.doubleNobleAgent && (_hatarget.occupation === 'noble' || _hatarget.isNoble)) {
                var _assTown = Engine.findTown(_hatarget.townId);
                if (_assTown && _assTown.kingdomId === player.doubleNobleAgent.targetKingdomId) _trackDnaTask('assassinate_noble');
            }
            Engine.logEvent('A merchant has been found dead under suspicious circumstances.');
        }

        var caughtMsg = '';
        if (caught) {
            const kingdom = Engine.findKingdom ? Engine.findKingdom(town ? town.kingdomId : null) : null;
            var _haIsNoble = _hatarget && (_hatarget.occupation === 'noble' || _hatarget.occupation === 'king' || _hatarget.isKing);
            applyCorruptPenalty(town, kingdom, 0, 0, 0, true, 'murder', _haIsNoble ? { isNobleTarget: true } : null);
            recordCorruptAction('assassinate_competitor', true, (typeof town !== 'undefined' && town ? town.kingdomId : null), 'murder');
            player.notoriety = (player.notoriety || 0) + _trackedNotoriety(30);
            _addNobleNotorietyAndCheck(CONFIG.NOBLE_NOTORIETY_DARK_DEED_ADD || 12, 'hiring an assassin');
            Engine.logEvent(`${player.fullName} was caught hiring an assassin!`);
            caughtMsg = '🚨 CAUGHT! Exiled! All kingdom assets seized! Bounty placed!';
        } else {
            recordCorruptAction('assassinate_competitor', false, (typeof town !== 'undefined' && town ? town.kingdomId : null), 'murder');
            player.notoriety = (player.notoriety || 0) + _trackedNotoriety(30);
        }

        return _schemeResult({
            successful: successful, caught: caught,
            successMsg: '✅ Target eliminated. Their properties may become available.',
            caughtMsg: caughtMsg,
            partialMsg: 'Target killed but the trail led back to you! ' + caughtMsg,
            failMsg: '❌ The assassin failed (' + cost + 'g lost) but no one suspects you.'
        });
    }

    // ── (o) Poison Target — pay an agent to plant poison in food/drink ──
    function poisonTarget(targetId) {
        _sync();
        if (isJailed()) return { success: false, message: 'You are in jail.' };
        if (!hasSkill('poisoner')) return { success: false, message: 'Requires Poisoner skill.' };
        if ((player.inventory.poison || 0) < 1) return { success: false, message: 'You need a vial of poison in your inventory.' };
        const town = Engine.findTown(player.townId);
        const rng = Engine.getRng();
        var cost = rng ? rng.randInt(1000, 3000) : 2000;
        // v9p33river223+v9p33river224: scale cost up sharply for noble/royal
        // targets AND for wealthy targets (well-paid bodyguards, more
        // bribes for staff). Detection also scales with wealth.
        cost = Math.floor(cost * _nobleTargetCostMult(targetId) * _targetWealthCostMult(targetId));
        if (player.gold < cost) return { success: false, message: 'Need ' + cost.toLocaleString() + 'g to pay an agent to plant the poison.' };
        const detection = Math.min(0.95, calculateCorruptDetection(0.15, town) * _nobleTargetMult(targetId) * _targetWealthDetectMult(targetId));
        var _po = _rollSchemeOutcome(detection, rng, _nobleSuccessMult(targetId));
        var caught = _po.caught;
        var successful = _po.successful;
        player.gold -= cost;
        player.inventory.poison = Math.max(0, (player.inventory.poison || 0) - 1);
        if ((player.inventory.poison || 0) === 0) delete player.inventory.poison;

        var _ptarget2 = Engine.findPerson ? Engine.findPerson(targetId) : null;
        if (successful && _ptarget2 && _ptarget2.alive && typeof Engine.infectNPC === 'function') {
            try { Engine.infectNPC(_ptarget2, 'poisoned', 'poisoned_by_player'); } catch(e) {}
            // v9p33river256: initial HP shock 90 → 85
            if (_ptarget2.illnesses && _ptarget2.illnesses.length > 0) {
                var lastIll = _ptarget2.illnesses[_ptarget2.illnesses.length - 1];
                if (lastIll) {
                    lastIll.severity = 'severe'; lastIll.source = 'poisoned';
                    if (_ptarget2.health > 85) _ptarget2.health = 85;
                }
            } else {
                _ptarget2.illness = 'poisoned'; _ptarget2.illnessSeverity = 'severe';
                _ptarget2.illnessSource = 'poisoned'; _ptarget2.sick = true;
                if (_ptarget2.health > 85) _ptarget2.health = 85;
            }
            player.poisonTargets.push({ targetId, startDay: Engine.getDay(), duration: 30, illness: 'poisoned' });
            grantXP(20, 'Poisoned target');
            if (player.doubleNobleAgent && _ptarget2 && (_ptarget2.occupation === 'noble' || _ptarget2.isNoble)) {
                var _poisTown = Engine.findTown(_ptarget2.townId);
                if (_poisTown && _poisTown.kingdomId === player.doubleNobleAgent.targetKingdomId) _trackDnaTask('poison_noble');
            }
            Engine.logEvent('Someone has fallen mysteriously ill...');
        }

        var caughtMsg = '';
        if (caught) {
            const kingdom = Engine.findKingdom ? Engine.findKingdom(town ? town.kingdomId : null) : null;
            var _pIsNoble = _ptarget2 && (_ptarget2.occupation === 'noble' || _ptarget2.occupation === 'king' || _ptarget2.isKing);
            applyCorruptPenalty(town, kingdom, 500, 25, 10, false, 'poison', _pIsNoble ? { isNobleTarget: true } : null);
            recordCorruptAction('poison', true, (typeof town !== 'undefined' && town ? town.kingdomId : null), 'poison');
            player.notoriety = (player.notoriety || 0) + _trackedNotoriety(20);
            var _nnResult = _addNobleNotorietyAndCheck(CONFIG.NOBLE_NOTORIETY_DARK_DEED_ADD || 12, 'poisoning someone');
            var _nnMsg = _nnResult && _nnResult.punished ? ' ' + _nnResult.message : '';
            Engine.logEvent(`${player.fullName} was caught paying an agent to poison someone!`);
            caughtMsg = '🚨 CAUGHT! Lost ' + cost + 'g + 500g fine, jailed 10d, town rep -25.' + _nnMsg;
        } else {
            recordCorruptAction('poison', false, (typeof town !== 'undefined' && town ? town.kingdomId : null), 'poison');
            player.notoriety = (player.notoriety || 0) + _trackedNotoriety(20);
        }

        return _schemeResult({
            successful: successful, caught: caught,
            successMsg: '✅ Agent planted poison (' + cost + 'g paid + vial used). Target sickened with severe poisoning — they may recover if treated quickly.',
            caughtMsg: caughtMsg,
            partialMsg: 'Target poisoned but the agent was caught and named you! ' + caughtMsg,
            failMsg: '❌ The agent failed to plant the poison (' + cost + 'g + vial lost) but no one suspects you.'
        });
    }

    // v9p33river201: Hire an assassin to kill any NPC target. Costs 3000-5000g.
    // Detection 0.25. Requires dark_connections OR assassin skill.
    function hireAssassinAnyNpc(targetId) {
        _sync();
        if (isJailed()) return { success: false, message: 'You are in jail.' };
        if (!hasSkill('dark_connections') && !hasSkill('assassin')) {
            return { success: false, message: 'Requires Dark Connections or Assassin skill.' };
        }
        var target = Engine.findPerson ? Engine.findPerson(targetId) : null;
        if (!target || !target.alive) return { success: false, message: 'Target not found or already dead.' };
        var rng = Engine.getRng();
        var cost = rng ? rng.randInt(3000, 5000) : 4000;
        // v9p33river223+v9p33river224: scale by rank AND wealth
        cost = Math.floor(cost * _nobleTargetCostMult(targetId) * _targetWealthCostMult(targetId));
        if (player.gold < cost) return { success: false, message: 'Need ' + cost.toLocaleString() + 'g.' };
        var town = Engine.findTown(player.townId);
        var detection = Math.min(0.95, calculateCorruptDetection(0.25, town) * _nobleTargetMult(targetId) * _targetWealthDetectMult(targetId));
        var _aho = _rollSchemeOutcome(detection, rng, _nobleSuccessMult(targetId));
        var caught = _aho.caught;
        var successful = _aho.successful;
        player.gold -= cost;

        if (successful) {
            target.alive = false;
            target.deathCause = 'assassinated (paid hit)';
            grantXP(35, 'Hired assassin');
            if (player.doubleNobleAgent && (target.occupation === 'noble' || target.isNoble)) {
                var _ahTown = Engine.findTown(target.townId);
                if (_ahTown && _ahTown.kingdomId === player.doubleNobleAgent.targetKingdomId) _trackDnaTask('assassinate_noble');
            }
            Engine.logEvent((target.firstName || 'A person') + ' ' + (target.lastName || '') + ' was found dead — assassinated by an unknown blade.');
        }

        var caughtMsg = '';
        if (caught) {
            var kingdom = Engine.findKingdom ? Engine.findKingdom(town ? town.kingdomId : null) : null;
            var _isNoble = target.occupation === 'noble' || target.occupation === 'king' || target.isKing || target.isNoble;
            applyCorruptPenalty(town, kingdom, 0, 0, 0, true, 'murder', _isNoble ? { isNobleTarget: true } : null);
            recordCorruptAction('hire_assassin_npc', true, (typeof town !== 'undefined' && town ? town.kingdomId : null), 'murder');
            player.notoriety = (player.notoriety || 0) + _trackedNotoriety(35);
            _addNobleNotorietyAndCheck(CONFIG.NOBLE_NOTORIETY_DARK_DEED_ADD || 12, 'hiring an assassin');
            Engine.logEvent(player.fullName + ' was caught hiring an assassin to kill ' + (target.firstName || 'someone') + '!');
            caughtMsg = '🚨 CAUGHT! Lost ' + cost + 'g, exiled, all assets seized.';
        } else {
            recordCorruptAction('hire_assassin_npc', false, (typeof town !== 'undefined' && town ? town.kingdomId : null), 'murder');
            player.notoriety = (player.notoriety || 0) + _trackedNotoriety(35);
        }

        return _schemeResult({
            successful: successful, caught: caught,
            successMsg: '✅ ' + (target.firstName || 'Target') + ' eliminated. Cost: ' + cost + 'g.',
            caughtMsg: caughtMsg,
            partialMsg: (target.firstName || 'Target') + ' eliminated but the trail led back to you! ' + caughtMsg,
            failMsg: '❌ The assassin failed (' + cost + 'g lost) but no one suspects you.'
        });
    }

    // v9p33river201: Direct kill — player murders the target themselves.
    function directKillNpc(targetId) {
        _sync();
        if (isJailed()) return { success: false, message: 'You are in jail.' };
        if (!hasSkill('combat_trained')) return { success: false, message: 'Requires Combat Trained skill.' };
        if (!hasSkill('assassin') && !hasSkill('shadow_dealings')) return { success: false, message: 'Requires Assassin or Shadow Dealings skill.' };
        if (!player.weapon) return { success: false, message: 'You need an equipped weapon.' };
        var target = Engine.findPerson ? Engine.findPerson(targetId) : null;
        if (!target || !target.alive) return { success: false, message: 'Target not found or already dead.' };
        if (target.id === (player.id || '__player')) return { success: false, message: 'Cannot target yourself.' };

        var rng = Engine.getRng();
        var town = Engine.findTown(player.townId);

        // v9p33river227: noble/royal targets require bribing guards/witnesses
        // even when the player does the killing themselves. Cost = 10% of the
        // equivalent hire-assassin cost (10k–20k base × wealth × rank).
        var dkCost = 0;
        var rankMult = _nobleTargetCostMult(targetId);
        if (rankMult > 1.0) {
            var dkBase = rng ? rng.randInt(10000, 20000) : 15000;
            dkCost = Math.floor(dkBase * rankMult * _targetWealthCostMult(targetId) * 0.10);
            if (player.gold < dkCost) {
                return { success: false, message: 'Need ' + dkCost.toLocaleString() + 'g to bribe guards/witnesses (10% of hire-assassin cost for noble targets).' };
            }
        }

        var detection = Math.min(0.95, calculateCorruptDetection(0.40, town) * _nobleTargetMult(targetId) * _targetWealthDetectMult(targetId));
        var _dko = _rollSchemeOutcome(detection, rng, _nobleSuccessMult(targetId));
        var caught = _dko.caught;
        var successful = _dko.successful;

        // Pay the bribe cost up-front (whether or not the kill succeeds)
        if (dkCost > 0) {
            player.gold -= dkCost;
            player.stats.totalGoldSpent += dkCost;
        }

        if (successful) {
            target.alive = false;
            target.deathCause = 'murdered';
            grantXP(50, 'Direct kill');
            if (player.doubleNobleAgent && (target.occupation === 'noble' || target.isNoble)) {
                var _dkTown = Engine.findTown(target.townId);
                if (_dkTown && _dkTown.kingdomId === player.doubleNobleAgent.targetKingdomId) _trackDnaTask('assassinate_noble');
            }
            Engine.logEvent((target.firstName || 'A person') + ' ' + (target.lastName || '') + ' was found murdered (perpetrator unknown).');
        }

        var caughtMsg = '';
        if (caught) {
            var kingdom = Engine.findKingdom ? Engine.findKingdom(town ? town.kingdomId : null) : null;
            var _isNobleD = target.occupation === 'noble' || target.occupation === 'king' || target.isKing || target.isNoble;
            applyCorruptPenalty(town, kingdom, 0, 0, 0, true, 'murder', _isNobleD ? { isNobleTarget: true } : null);
            recordCorruptAction('direct_kill', true, (typeof town !== 'undefined' && town ? town.kingdomId : null), 'murder');
            player.notoriety = (player.notoriety || 0) + _trackedNotoriety(50);
            _addNobleNotorietyAndCheck(CONFIG.NOBLE_NOTORIETY_DIRECT_NOBLE_ADD || 20, 'committing direct murder');
            Engine.logEvent(player.fullName + ' was caught murdering ' + (target.firstName || 'someone') + ' with their own blade!');
            caughtMsg = '🚨 CAUGHT red-handed! Murder charge — exile + assets seized.';
        } else {
            recordCorruptAction('direct_kill', false, (typeof town !== 'undefined' && town ? town.kingdomId : null), 'murder');
            player.notoriety = (player.notoriety || 0) + _trackedNotoriety(50);
        }

        return _schemeResult({
            successful: successful, caught: caught,
            successMsg: '✅ ' + (target.firstName || 'Target') + ' is dead. You slipped away unseen.',
            caughtMsg: caughtMsg,
            partialMsg: (target.firstName || 'Target') + ' is dead but you were SEEN! ' + caughtMsg,
            failMsg: '❌ ' + (target.firstName || 'They') + ' fought you off and you fled — but no one identified you.'
        });
    }

    // ── (p) Build Hidden Warehouse ──
    function buildHiddenWarehouse(townId) {
        _sync();
        if (isJailed()) return { success: false, message: 'You are in jail.' };
        if (!isInTown(townId)) return { success: false, message: 'You must be in the town.' };
        if (player.gold < 800) return { success: false, message: 'Need 800g.' };
        const woodQty = player.inventory.wood || 0;
        const stoneQty = player.inventory.stone || 0;
        if (woodQty < 20) return { success: false, message: 'Need 20 wood.' };
        if (stoneQty < 15) return { success: false, message: 'Need 15 stone.' };
        // v9p33river323: guard hiddenWarehouses before .some/.push so
        // legacy saves without the field don't crash.
        if (!player.hiddenWarehouses) player.hiddenWarehouses = [];
        // Check if already have one in this town
        if (player.hiddenWarehouses.some(hw => hw.townId === townId)) {
            return { success: false, message: 'Already have a hidden warehouse in this town.' };
        }

        player.gold -= 800;
        player.inventory.wood -= 20;
        player.inventory.stone -= 15;
        player.hiddenWarehouses.push({ townId, inventory: {}, capacity: 50 });
        grantXP(15, 'Built hidden warehouse');
        Engine.logEvent(`${player.fullName} constructed something in ${Engine.findTown(townId)?.name || 'a town'}.`, null, 'my_business');
        return { success: true, message: '✅ Hidden warehouse built! 50 capacity, invisible to tax collectors.' };
    }

    // ── (q) Cook the Books ──
    function cookTheBooks() {
        _sync();
        if (isJailed()) return { success: false, message: 'You are in jail.' };
        const town = Engine.findTown(player.townId);
        if (!town) return { success: false, message: 'Must be in a town.' };
        const hasBuildings = player.buildings.some(b => b.townId === player.townId);
        if (!hasBuildings) return { success: false, message: 'Need buildings in this town.' };
        if (player.cookingBooks) return { success: false, message: 'Already cooking the books this season.' };

        player.cookingBooks = true;
        player.notoriety = (player.notoriety || 0) + _trackedNotoriety(3);
        recordCorruptAction('cook_books', false, (typeof town !== 'undefined' && town ? town.kingdomId : null), 'forgery');
        grantXP(5, 'Cooking the books');
        Engine.logEvent(`${player.fullName} is underreporting trade volumes.`);
        return { success: true, message: '✅ Books cooked! Trade taxes reduced ~30% this season. Audit chance: 10%.' };
    }

    // ── (r) Market Manipulation Tracking ──
    function checkMarketManipulator() {
        _sync();
        const town = Engine.findTown(player.townId);
        if (!town || !town.market) return;
        for (const resKey in RESOURCE_TYPES) {
            const res = RESOURCE_TYPES[resKey];
            const totalSupply = town.market.supply[res.id] || 0;
            const playerQty = player.inventory[res.id] || 0;
            if (totalSupply > 0 && playerQty > 0) {
                const totalInTown = totalSupply + playerQty;
                if (playerQty / totalInTown >= 0.75) {
                    unlockAchievement('market_manipulator');
                    return;
                }
            }
        }
    }

    // ── (s) Insider Trading ──
    function insiderTrading(kingdomId) {
        _sync();
        if (isJailed()) return { success: false, message: 'You are in jail.' };
        if (player.gold < 300) return { success: false, message: 'Need 300g to bribe an official.' };
        const kingdom = Engine.findKingdom ? Engine.findKingdom(kingdomId) : null;
        if (!kingdom) return { success: false, message: 'Kingdom not found.' };

        player.gold -= 300;
        const town = Engine.findTown(player.townId);
        const rng = Engine.getRng();
        const detection = calculateCorruptDetection(0.20, town);
        var _o = _rollSchemeOutcome(detection, rng);
        var caught = _o.caught;
        var successful = _o.successful;

        var infoMsg = '';
        var profitTip = '';
        if (successful) {
            const infoTypes = ['tax_change', 'ban_good', 'unban_good', 'new_law'];
            const infoType = infoTypes[rng ? rng.randInt(0, infoTypes.length - 1) : 0];
            const info = { kingdomId, type: infoType, revealDay: Engine.getDay(), effectDay: Engine.getDay() + 30 };
            player.insiderInfo.push(info);
            grantXP(10, 'Insider trading');
            if (infoType === 'ban_good') profitTip = 'Buy up stock before the ban — prices will skyrocket on the black market!';
            else if (infoType === 'unban_good') profitTip = 'Stock up now while black market prices are low — legal demand will spike!';
            else if (infoType === 'tax_change') profitTip = 'Tax changes affect trade margins — consider adjusting your trade routes.';
            else if (infoType === 'new_law') profitTip = 'New laws may restrict or enable industries — check your buildings.';
            infoMsg = `Upcoming ${infoType.replace(/_/g, ' ')} in ${kingdom.name} in ~30 days.`;
        }

        var caughtMsg = '';
        if (caught) {
            const actualFine = applyCorruptPenalty(town, kingdom, 500, 10, 0, false, 'forgery');
            recordCorruptAction('insider_trading', true, (typeof town !== 'undefined' && town ? town.kingdomId : null), 'forgery');
            player.notoriety = (player.notoriety || 0) + _trackedNotoriety(5);
            caughtMsg = `🚨 CAUGHT! Fined ${actualFine}g, rep -10.`;
        } else {
            recordCorruptAction('insider_trading', false, (typeof town !== 'undefined' && town ? town.kingdomId : null), 'forgery');
            player.notoriety = (player.notoriety || 0) + _trackedNotoriety(5);
        }

        return _schemeResult({
            successful: successful, caught: caught,
            successMsg: '✅ Insider info: ' + infoMsg + (profitTip ? ' 💡 ' + profitTip : ''),
            caughtMsg: caughtMsg,
            partialMsg: 'Got insider info (' + infoMsg + ') but the official reported you! ' + caughtMsg,
            failMsg: '❌ The official refused (300g lost) but didn\'t report you.'
        });
    }

    // ── Dark Deeds Tick (called from playerTick) ──
    function darkDeedsTick() {
        _sync();
        const day = Engine.getDay();
        const rng = Engine.getRng();

        // Expire bribed guards
        for (const townId in player.bribedGuards) {
            if (player.bribedGuards[townId].expiresDay <= day) {
                delete player.bribedGuards[townId];
            }
        }

        // Expire rumor targets
        for (const mid in player.rumorTargets) {
            if (player.rumorTargets[mid].expiresDay <= day) {
                delete player.rumorTargets[mid];
            }
        }

        // Process poison targets
        // v9p33river210: now that poisonTarget routes through Engine.infectNPC
        // and the real illness system decides life/death, this ticker just
        // tracks kill-count for achievements when the target actually dies.
        // Old behavior fired a misleading "succumbed" event after a fixed
        // duration regardless of NPC state.
        for (let i = player.poisonTargets.length - 1; i >= 0; i--) {
            const pt = player.poisonTargets[i];
            const target = Engine.findPerson ? Engine.findPerson(pt.targetId) : null;
            // Target died — credit the poisoner
            if (target && !target.alive) {
                player.poisonKills = (player.poisonKills || 0) + 1;
                if (player.poisonKills >= 3) unlockAchievement('poisoner_ach');
                player.poisonTargets.splice(i, 1);
                Engine.logEvent('☠️ ' + ((target.firstName || '') + ' ' + (target.lastName || '')).trim() + ' has succumbed to the poison you arranged.', null, 'my_actions');
                continue;
            }
            // Target recovered — illness gone after the cooldown
            if (target && target.alive && day >= pt.startDay + pt.duration) {
                var stillSick = false;
                if (target.illnesses) {
                    for (var _ii = 0; _ii < target.illnesses.length; _ii++) {
                        var _ill = target.illnesses[_ii];
                        if (_ill && (_ill.source === 'poisoned' || (_ill.source && _ill.source.indexOf('poisoned') >= 0))) {
                            stillSick = true; break;
                        }
                    }
                }
                if (!stillSick) {
                    player.poisonTargets.splice(i, 1);
                    Engine.logEvent('A poisoning target appears to have recovered.', null, 'my_actions');
                }
                continue;
            }
            // Target gone (despawned) — drop entry quietly
            if (!target && day >= pt.startDay + pt.duration) {
                player.poisonTargets.splice(i, 1);
            }
        }

        // Process blackmail payments
        for (const personId in player.blackmailTargets) {
            const bt = player.blackmailTargets[personId];
            if (day >= bt.nextPayDay) {
                // Deduct from target NPC if they exist and can pay
                var bTarget = Engine.findPerson(personId);
                if (bTarget && bTarget.alive) {
                    var bPayment = Math.min(bt.paymentPerSeason, bTarget.gold || 0);
                    if (bTarget.gold != null) bTarget.gold -= bPayment;
                    player.gold += bPayment;
                    player.stats.totalGoldEarned += bPayment;
                } else {
                    // Target gone — blackmail ends
                    delete player.blackmailTargets[personId];
                    continue;
                }
                bt.nextPayDay = day + 90;
            }
        }

        // ── Process Spy Networks ──
        player.spyNetworks = player.spyNetworks || {};
        for (var _snTownId in player.spyNetworks) {
            var _sn = player.spyNetworks[_snTownId];
            if (day >= _sn.expiresDay) {
                delete player.spyNetworks[_snTownId];
                if (typeof UI !== 'undefined' && UI.toast) UI.toast('🕵️ Spy network in ' + (_snTownId || '?') + ' has dissolved.', 'info', 'my_business');
            } else if (day % 30 === 0) {
                // Monthly intelligence report — warn of upcoming changes
                var _snKingdom = _sn.kingdomId ? (Engine.findKingdom ? Engine.findKingdom(_sn.kingdomId) : null) : null;
                if (_snKingdom && rng) {
                    var _intelType = rng.randInt(1, 4);
                    if (_intelType === 1 && _snKingdom.pendingLaws && _snKingdom.pendingLaws.length > 0) {
                        Engine.logEvent('🕵️ Intelligence: ' + _snKingdom.name + ' is planning new legislation.');
                        if (typeof UI !== 'undefined' && UI.toast) UI.toast('🕵️ Intel: ' + _snKingdom.name + ' planning new laws.', 'info', 'my_business');
                    } else if (_intelType === 2 && (_snKingdom.stability || 50) < 40) {
                        Engine.logEvent('🕵️ Intelligence: ' + _snKingdom.name + ' is experiencing instability (' + Math.round(_snKingdom.stability || 0) + '%).');
                        if (typeof UI !== 'undefined' && UI.toast) UI.toast('🕵️ Intel: ' + _snKingdom.name + ' instability at ' + Math.round(_snKingdom.stability || 0) + '%', 'info', 'my_business');
                    } else if (_intelType === 3) {
                        // Price trend intel
                        var _snTown = Engine.findTown(_snTownId);
                        if (_snTown && _snTown.market && _snTown.market.prices) {
                            var _pKeys = Object.keys(_snTown.market.prices);
                            if (_pKeys.length > 0) {
                                var _pRes = rng.pick(_pKeys);
                                var _pPrice = _snTown.market.prices[_pRes];
                                var _pRes2 = findResource(_pRes);
                                var _trend = _pPrice > (_pRes2 ? _pRes2.basePrice : 10) * 1.3 ? 'high' : (_pPrice < (_pRes2 ? _pRes2.basePrice : 10) * 0.7 ? 'low' : 'normal');
                                Engine.logEvent('🕵️ Intelligence: ' + (_pRes2 ? _pRes2.name : _pRes) + ' prices are ' + _trend + ' in ' + _snTown.name + '.');
                            }
                        }
                    }
                }
            }
        }

        // ── Process Smuggling Routes — passive income ──
        player.smugglingRoutes = player.smugglingRoutes || [];
        for (var _smri = player.smugglingRoutes.length - 1; _smri >= 0; _smri--) {
            var _sr = player.smugglingRoutes[_smri];
            if (day >= _sr.expiresDay) {
                player.smugglingRoutes.splice(_smri, 1);
                if (typeof UI !== 'undefined' && UI.toast) UI.toast('🥷 A smuggling route has expired.', 'info', 'my_business');
            } else if (day % 7 === 0) {
                // Weekly income from smuggling
                var _smuggleIncome = (rng ? rng.randInt(15, 50) : 25);
                if (hasSkill('contraband_network')) _smuggleIncome = Math.floor(_smuggleIncome * 1.5);
                player.gold += _smuggleIncome;
                player.stats.totalGoldEarned += _smuggleIncome;
                _sr.goldEarned = (_sr.goldEarned || 0) + _smuggleIncome;
                // Small chance of discovery each week
                if (rng && rng.chance(0.03)) {
                    var _smrTown = Engine.findTown(_sr.fromTownId);
                    var _smrKingdom = _smrTown ? (Engine.findKingdom ? Engine.findKingdom(_smrTown.kingdomId) : null) : null;
                    player.smugglingRoutes.splice(_smri, 1);
                    player.notoriety = (player.notoriety || 0) + _trackedNotoriety(10);
                    if (_smrKingdom) player.reputation[_smrKingdom.id] = Math.max(0, (player.reputation[_smrKingdom.id] || 50) - 10);
                    Engine.logEvent('🚨 A smuggling route was discovered and shut down!');
                    if (typeof UI !== 'undefined' && UI.toast) UI.toast('🚨 Smuggling route busted! Rep -10.', 'danger', 'my_business');
                }
            }
        }

        // ── Process Protection Rackets — weekly collection ──
        player.protectionRackets = player.protectionRackets || {};
        for (var _prTownId in player.protectionRackets) {
            var _pr = player.protectionRackets[_prTownId];
            if (day >= _pr.lastCollectDay + 7) {
                _pr.lastCollectDay = day;
                var _prIncome = _pr.paymentPerWeek || 30;
                player.gold += _prIncome;
                player.stats.totalGoldEarned += _prIncome;
                // Chance of resistance/discovery each week
                if (rng && rng.chance(0.05)) {
                    delete player.protectionRackets[_prTownId];
                    player.notoriety = (player.notoriety || 0) + _trackedNotoriety(8);
                    var _prTown = Engine.findTown(_prTownId);
                    var _prKingdom = _prTown ? (Engine.findKingdom ? Engine.findKingdom(_prTown.kingdomId) : null) : null;
                    if (_prKingdom) player.reputation[_prKingdom.id] = Math.max(0, (player.reputation[_prKingdom.id] || 50) - 8);
                    Engine.logEvent('🚨 Protection racket in ' + (_prTown ? _prTown.name : '?') + ' was exposed! Merchants reported to authorities.');
                    if (typeof UI !== 'undefined' && UI.toast) UI.toast('🚨 Protection racket exposed in ' + (_prTown ? _prTown.name : '?') + '!', 'danger', 'my_business');
                }
            }
        }

        // ── Process Double Agent — seasonal payments ──
        if (player.doubleAgentActive) {
            var _da = player.doubleAgentActive;
            // Auto-end if no longer in military
            if (!player.militaryService || !player.militaryService.active) {
                player.doubleAgentActive = null;
            } else if (day >= _da.nextPayDay) {
                player.gold += _da.paymentPerSeason;
                player.stats.totalGoldEarned += _da.paymentPerSeason;
                _da.nextPayDay = day + 90;
                // Chance of discovery each payment cycle
                if (rng && rng.chance(0.08)) {
                    var _myKingId = player.militaryService.kingdomId;
                    var _myK = Engine.findKingdom ? Engine.findKingdom(_myKingId) : null;
                    var _daTown = Engine.findTown(player.townId);
                    applyCorruptPenalty(_daTown, _myK, 3000, 40, 20, true, 'treason', { isNobleTarget: true });
                    player.doubleAgentActive = null;
                    player.militaryService.active = false;
                    player.notoriety = (player.notoriety || 0) + _trackedNotoriety(30);
                    Engine.logEvent('🚨 ' + player.fullName + ' was exposed as a double agent! Dishonorably discharged and exiled.', null, 'my_actions');
                    if (typeof UI !== 'undefined' && UI.toast) UI.toast('🚨 TREASON! Discovered as a double agent! Exiled!', 'danger', 'critical');
                }
            }
        }

        // ── Expire Forged Documents ──
        player.forgedDocuments = player.forgedDocuments || {};
        for (var _fdType in player.forgedDocuments) {
            if (player.forgedDocuments[_fdType] <= day) {
                delete player.forgedDocuments[_fdType];
                if (typeof UI !== 'undefined' && UI.toast) UI.toast('📝 Your forged ' + _fdType.replace(/_/g, ' ') + ' has expired.', 'info', 'my_business');
            }
        }
        player.forgedKingdomDocs = player.forgedKingdomDocs || {};
        for (var _fkd in player.forgedKingdomDocs) {
            var _docs = player.forgedKingdomDocs[_fkd];
            for (var _dk in _docs) {
                if (_docs[_dk] <= day) delete _docs[_dk]; // v9p33river329: expire kingdom-scoped forged docs daily.
            }
            if (!_docs.license && !_docs.citizenship) delete player.forgedKingdomDocs[_fkd];
        }

        // Auto-repair sabotaged roads
        for (let i = player.sabotagedRoads.length - 1; i >= 0; i--) {
            const sr = player.sabotagedRoads[i];
            if (day >= sr.expiresDay) {
                const roads = Engine.getRoads ? Engine.getRoads() : [];
                if (roads[sr.roadIdx]) roads[sr.roadIdx].quality = sr.origQuality;
                player.sabotagedRoads.splice(i, 1);
            }
        }

        // Auto-repair sabotaged buildings
        for (let i = player.sabotagedBuildings.length - 1; i >= 0; i--) {
            const sb = player.sabotagedBuildings[i];
            if (day >= sb.expiresDay) {
                const town = Engine.findTown(sb.townId);
                if (town && town.buildings[sb.buildingIdx]) {
                    delete town.buildings[sb.buildingIdx]._disabledUntil;
                }
                player.sabotagedBuildings.splice(i, 1);
            }
        }

        // Hidden warehouse audit (each season = 90 days)
        if (day % 90 === 0 && player.hiddenWarehouses && player.hiddenWarehouses.length > 0) {
            for (let i = player.hiddenWarehouses.length - 1; i >= 0; i--) {
                const hw = player.hiddenWarehouses[i];
                const hasGoods = Object.values(hw.inventory).some(q => q > 0);
                if (!hasGoods) continue;
                // v9p33river323: guard offenseCount before [] access.
                const _hwK = Engine.findTown(hw.townId)?.kingdomId;
                const _ofc = (player.offenseCount && _hwK) ? (player.offenseCount[_hwK] || 0) : 0;
                const auditChance = 0.05 + _ofc * 0.02;
                if (rng && rng.chance(auditChance)) {
                    hw.inventory = {};
                    player.gold = Math.max(0, player.gold - 500);
                    Engine.logEvent(`${player.fullName}'s hidden warehouse was discovered! Goods confiscated, fined 500g.`);
                    if (typeof UI !== 'undefined' && UI.toast) UI.toast('🚨 Hidden warehouse audited! Goods confiscated, fined 500g.', 'danger', 'my_business');
                }
            }
        }

        // Cook the books audit (each season)
        if (day % 90 === 0 && player.cookingBooks) {
            const auditChance = 0.10;
            if (rng && rng.chance(auditChance)) {
                const taxesDodged = Math.floor(player.taxesEvaded * 0.3) || 100;
                const fine = taxesDodged * 3;
                player.gold = Math.max(0, player.gold - fine);
                const town = Engine.findTown(player.townId);
                const kingdom = Engine.findKingdom ? Engine.findKingdom(town ? town.kingdomId : null) : null;
                if (kingdom) player.reputation[kingdom.id] = Math.max(0, (player.reputation[kingdom.id] || 50) - 15);
                Engine.logEvent(`${player.fullName}'s books were audited! Fined ${fine}g for tax evasion.`);
                if (typeof UI !== 'undefined' && UI.toast) UI.toast(`🚨 Audit! Fined ${fine}g for cooking the books.`, 'danger', 'my_business');
            }
            player.cookingBooks = false;
        }

        // Market manipulator check
        checkMarketManipulator();

        // ── Process Notoriety Reduction (lay_low / cleanse_identity) ──
        if (player.notorietyReduction) {
            var _nr = player.notorietyReduction;
            if (day >= _nr.endDay) {
                // Finished
                if (typeof UI !== 'undefined' && UI.toast) {
                    if (_nr.type === 'lay_low') UI.toast('🕶️ You\'ve finished laying low. The heat has died down.', 'success', 'my_business');
                    else UI.toast('🧹 Identity cleansed! Your reputation in the underworld has been scrubbed.', 'success', 'my_business');
                }
                Engine.logEvent(player.fullName + '\'s notoriety reduction (' + _nr.type.replace(/_/g, ' ') + ') is complete.');
                player.notorietyReduction = null;
            } else {
                // Daily notoriety reduction tick
                player.notoriety = Math.max(0, (player.notoriety || 0) - (_nr.dailyReduction || 0));
            }
        }

        // Clean hands check
        if (player.corruptActions === 0) {
            // Check if any social rank is >= 5 (Royal Advisor level)
            for (const kId in player.socialRank) {
                if ((player.socialRank[kId] || 0) >= 5) {
                    unlockAchievement('clean_hands');
                    break;
                }
            }
        }

        // ── NPC-vs-Player Scheming ──
        // Only once player is a noble (socialRank >= 4 in any kingdom) or top-10 merchant
        var _playerIsTarget = false;
        for (var _srk in player.socialRank) {
            if ((player.socialRank[_srk] || 0) >= 4) { _playerIsTarget = true; break; }
        }
        if (!_playerIsTarget && typeof getMerchantLeaderboard === 'function') {
            var _rankings = getMerchantLeaderboard();
            if (_rankings) {
                for (var _ri = 0; _ri < Math.min(10, _rankings.length); _ri++) {
                    if (_rankings[_ri] && _rankings[_ri].isPlayer) { _playerIsTarget = true; break; }
                }
            }
        }

        if (_playerIsTarget && day % 30 === 0) {
            // Check once per month — very rare events
            player.npcSchemesAgainstPlayer = player.npcSchemesAgainstPlayer || [];

            // Base chance: 8% per month check, very rare
            var _schemeBaseChance = 0.08;
            // Notoriety makes you a bigger target — NPCs hear about your criminal exploits
            var _playerNotoriety = player.notoriety || 0;
            if (_playerNotoriety >= 80) _schemeBaseChance *= 2.0;       // WANTED: double the scheming
            else if (_playerNotoriety >= 50) _schemeBaseChance *= 1.6;  // Notorious: 60% more
            else if (_playerNotoriety >= 25) _schemeBaseChance *= 1.3;  // Suspicious: 30% more
            else if (_playerNotoriety >= 10) _schemeBaseChance *= 1.1;  // Whispered: 10% more
            // Defensive skills reduce chance
            if (hasSkill('inner_circle')) _schemeBaseChance *= 0.70;
            if (hasSkill('fortified_reputation')) _schemeBaseChance *= 0.80;
            if (hasSkill('counter_intelligence')) _schemeBaseChance *= 0.85;
            if (hasSkill('vigilant_merchant')) _schemeBaseChance *= 0.75;

            if (rng && rng.chance(_schemeBaseChance)) {
                // Determine scheme type — weighted by rarity
                var _schemeRoll = rng.random();
                var _npcScheme = null;

                if (_schemeRoll < 0.30) {
                    // Rumors (most common) — NPC spreads rumors about player
                    var _rumorDuration = rng.randInt(30, 90);
                    var _rumorKingdom = player.citizenshipKingdomId;
                    var _repLoss = rng.randInt(3, 8);
                    if (hasSkill('fortified_reputation')) _repLoss = Math.floor(_repLoss * 0.6);
                    if (_rumorKingdom && player.reputation[_rumorKingdom]) {
                        player.reputation[_rumorKingdom] = Math.max(0, player.reputation[_rumorKingdom] - _repLoss);
                    }
                    _npcScheme = { type: 'rumors', day: day, repLoss: _repLoss, duration: _rumorDuration };
                    Engine.logEvent('🤫 Rumors are being spread about ' + player.fullName + '! Reputation -' + _repLoss + '.');
                    if (typeof UI !== 'undefined' && UI.toast) UI.toast('🤫 Someone is spreading rumors about you! Reputation -' + _repLoss, 'warning', 'my_business');

                } else if (_schemeRoll < 0.52) {
                    // Theft (common) — NPC steals gold from player
                    var _stolenAmt = rng.randInt(20, Math.min(200, Math.floor((player.gold || 0) * 0.05)));
                    if (hasSkill('vigilant_merchant')) _stolenAmt = Math.floor(_stolenAmt * 0.5);
                    if (_stolenAmt > 0 && player.gold >= _stolenAmt) {
                        player.gold -= _stolenAmt;
                        _npcScheme = { type: 'theft', day: day, amount: _stolenAmt };
                        Engine.logEvent('💰 ' + player.fullName + ' had ' + _stolenAmt + 'g stolen by an unknown thief!');
                        if (typeof UI !== 'undefined' && UI.toast) UI.toast('💰 A thief stole ' + _stolenAmt + 'g from you!', 'danger', 'my_business');
                    }

                } else if (_schemeRoll < 0.70) {
                    // Sabotage (uncommon) — damage a player building
                    var _playerBuildings = player.buildings.filter(function(b) { return !b._disabledUntil; });
                    if (_playerBuildings.length > 0) {
                        var _sabTarget = rng.pick(_playerBuildings);
                        var _sabDays = rng.randInt(10, 25);
                        if (hasSkill('vigilant_merchant')) _sabDays = Math.floor(_sabDays * 0.6);
                        _sabTarget._disabledUntil = day + _sabDays;
                        _npcScheme = { type: 'sabotage', day: day, buildingType: _sabTarget.type, duration: _sabDays };
                        Engine.logEvent('🔨 One of ' + player.fullName + '\'s buildings was sabotaged! Disabled for ' + _sabDays + ' days.');
                        if (typeof UI !== 'undefined' && UI.toast) UI.toast('🔨 Your ' + (_sabTarget.type || 'building') + ' was sabotaged! Disabled for ' + _sabDays + ' days.', 'danger', 'my_business');
                    }

                } else if (_schemeRoll < 0.84) {
                    // Price manipulation (uncommon) — NPC manipulates market prices against player
                    var _priceTown = Engine.findTown(player.townId);
                    if (_priceTown && _priceTown.market && _priceTown.market.prices) {
                        var _priceKeys = Object.keys(_priceTown.market.prices);
                        if (_priceKeys.length > 0) {
                            var _priceRes = rng.pick(_priceKeys);
                            var _priceInflation = 1 + rng.randFloat(0.15, 0.35);
                            _priceTown.market.prices[_priceRes] = Math.floor(_priceTown.market.prices[_priceRes] * _priceInflation);
                            _npcScheme = { type: 'price_manipulation', day: day, resource: _priceRes };
                            Engine.logEvent('📈 Market prices for ' + _priceRes + ' in ' + _priceTown.name + ' have been artificially inflated.');
                            if (typeof UI !== 'undefined' && UI.toast) UI.toast('📈 Someone manipulated ' + _priceRes + ' prices in ' + _priceTown.name + '!', 'warning', 'my_business');
                        }
                    }

                } else if (_schemeRoll < 0.94) {
                    // Framing (rare) — NPC frames player for a crime
                    var _frameFine = rng.randInt(50, 300);
                    var _frameJailDays = rng.randInt(2, 7);
                    if (hasSkill('counter_intelligence')) {
                        // Detected the frame! No penalty
                        _npcScheme = { type: 'frame_detected', day: day };
                        Engine.logEvent('🕵️ ' + player.fullName + '\'s intelligence network uncovered a framing attempt!');
                        if (typeof UI !== 'undefined' && UI.toast) UI.toast('🕵️ Your intelligence network uncovered a plot to frame you!', 'success', 'my_business');
                    } else {
                        var _frameTown = Engine.findTown(player.townId);
                        var _frameKingdom = _frameTown ? (Engine.findKingdom ? Engine.findKingdom(_frameTown.kingdomId) : null) : null;
                        if (_frameKingdom) player.reputation[_frameKingdom.id] = Math.max(0, (player.reputation[_frameKingdom.id] || 50) - 10);
                        player.gold = Math.max(0, player.gold - _frameFine);
                        _npcScheme = { type: 'framed', day: day, fine: _frameFine, jailDays: _frameJailDays };
                        Engine.logEvent('🎭 ' + player.fullName + ' has been falsely accused of a crime! Fined ' + _frameFine + 'g.');
                        if (typeof UI !== 'undefined' && UI.toast) UI.toast('🎭 You\'ve been framed for a crime! Fined ' + _frameFine + 'g, reputation -10.', 'danger', 'my_business');
                    }

                } else {
                    // Assassination attempt (extremely rare — 6% of an already 8% monthly chance)
                    // Additional gates: only if player has notoriety >= 20 OR is noble rank 5+
                    var _canAssassinate = (player.notoriety || 0) >= 20;
                    if (!_canAssassinate) {
                        for (var _ask in player.socialRank) {
                            if ((player.socialRank[_ask] || 0) >= 5) { _canAssassinate = true; break; }
                        }
                    }
                    if (_canAssassinate) {
                        var _assassinChance = 0.60; // 60% chance the assassin succeeds in injuring
                        if (hasSkill('counter_intelligence')) _assassinChance *= 0.50;
                        if (hasSkill('inner_circle')) _assassinChance *= 0.70;
                        if (hasSkill('intimidating_presence')) _assassinChance *= 0.80;
                        // Player guards reduce chance
                        var _guardCount = (player.guards || []).length;
                        if (_guardCount > 0) _assassinChance *= Math.max(0.2, 1 - _guardCount * 0.15);

                        if (rng.chance(_assassinChance)) {
                            // Injured, not killed
                            player.injuries = player.injuries || [];
                            player.injuries.push({ type: 'assassination_wound', name: 'Assassination Wound', severity: 'severe', dayOccurred: day, treated: false });
                            var _assassinGoldLoss = rng.randInt(100, 500);
                            player.gold = Math.max(0, player.gold - _assassinGoldLoss);
                            _npcScheme = { type: 'assassination_attempt', day: day, success: true, goldLost: _assassinGoldLoss };
                            Engine.logEvent('🗡️ An assassin attacked ' + player.fullName + '! Severely wounded, lost ' + _assassinGoldLoss + 'g.');
                            if (typeof UI !== 'undefined' && UI.toast) UI.toast('🗡️ An assassin attacked you! Severely wounded, lost ' + _assassinGoldLoss + 'g.', 'danger', 'critical');
                        } else {
                            _npcScheme = { type: 'assassination_attempt', day: day, success: false };
                            Engine.logEvent('🛡️ An assassin targeted ' + player.fullName + ' but was thwarted!');
                            if (typeof UI !== 'undefined' && UI.toast) UI.toast('🛡️ An assassination attempt on you was foiled!', 'warning', 'critical');
                        }
                    }
                }

                if (_npcScheme) {
                    player.npcSchemesAgainstPlayer.push(_npcScheme);
                    // Keep only last 20 records
                    if (player.npcSchemesAgainstPlayer.length > 20) player.npcSchemesAgainstPlayer.shift();
                }
            }
        }

        // Check Double Noble Agent task progress
        if (player.doubleNobleAgent) {
            checkDoubleNobleAgentProgress();
        }

        // Track corrupt_two_nobles for DNA task
        if (player.doubleNobleAgent && player._dnaTaskProgress) {
            var _dnaKid = player.doubleNobleAgent.targetKingdomId;
            var _corruptCount = 0;
            var _dnaNobles = _getKingdomNobles(_dnaKid);
            for (var _cni = 0; _cni < _dnaNobles.length; _cni++) {
                var _cnId = _dnaNobles[_cni].id;
                var _cnRel = getRelationship(_cnId);
                var _isCorrupt = false;
                if (player.blackmailTargets && player.blackmailTargets[_cnId]) _isCorrupt = true;
                if (!_isCorrupt) {
                    var _cnLoans = (player._nobleLoans || []).filter(function(l) { return l.nobleId === _cnId && l.status === 'active'; });
                    if (_cnLoans.length > 0) _isCorrupt = true;
                }
                if (!_isCorrupt && _cnRel && _cnRel.level >= 80) _isCorrupt = true;
                if (_isCorrupt) _corruptCount++;
            }
            player._dnaTaskProgress.corrupt_two_nobles = _corruptCount;

            // Track forge_alliance_enemy — need 2 nobles with 60+ relationship in sponsor kingdom
            var _sponsorNobles = _getKingdomNobles(player.doubleNobleAgent.sponsorKingdomId);
            var _allyCount = 0;
            for (var _ani = 0; _ani < _sponsorNobles.length; _ani++) {
                var _anRel = getRelationship(_sponsorNobles[_ani].id);
                if (_anRel && _anRel.level >= 60) _allyCount++;
            }
            player._dnaTaskProgress.forge_alliance_enemy = _allyCount;
        }
    }

    // Helper to get available corrupt actions for current location
    function getAvailableCorruptActions() {
        _sync();
        const town = Engine.findTown(player.townId);
        const actions = [];
        const day = Engine.getDay();
        const w = Engine.getWorld ? Engine.getWorld() : null;
        const hour = w ? (w.hour || 0) : 12;
        const isNight = hour >= 20 || hour <= 5;

        if (!town || player.traveling || isJailed()) return actions;

        const kingdom = Engine.findKingdom ? Engine.findKingdom(town.kingdomId) : null;

        // Sabotage tab — requires shadow_dealings or arsonist_skill
        if (hasSkill('shadow_dealings') || hasSkill('arsonist_skill')) {

        // Build list of buildings with owner info for the dropdown
        var _sabBuildingList = [];
        for (let i = 0; i < town.buildings.length; i++) {
            const bld = town.buildings[i];
            const bt = Engine.findBuildingType ? Engine.findBuildingType(bld.type) : null;
            var ownerName = 'Town';
            if (bld.ownerId === 'player') {
                ownerName = 'You';
            } else if (bld.ownerId) {
                var _ownerPerson = Engine.findPerson ? Engine.findPerson(bld.ownerId) : null;
                if (_ownerPerson) ownerName = (_ownerPerson.firstName || '') + ' ' + (_ownerPerson.lastName || '');
                else ownerName = 'NPC';
            }
            _sabBuildingList.push({ index: i, name: bt ? bt.name : bld.type, owner: ownerName.trim() });
        }

        // Single sabotage entry with building dropdown
        if (town.buildings.length > 0) {
            actions.push({
                id: 'sabotage_building', tab: 'sabotage',
                name: 'Sabotage Building',
                desc: 'Disable building production for 15-30 days.',
                cost: '2 tools', detection: calculateCorruptDetection(0.25, town),
                reward: 'Production halted', xp: 10,
                requiresSkill: ['shadow_dealings', 'arsonist_skill'],
                requires: 'Shadow Dealings or Arsonist',
                available: (hasSkill('shadow_dealings') || hasSkill('arsonist_skill')) && (player.inventory.tools || 0) >= 2,
                _needsBuildingSelect: true,
                _buildingList: _sabBuildingList,
                _townId: town.id,
                params: [0, town.id],
            });
        }

        const roads = Engine.getRoads ? Engine.getRoads() : [];
        for (let i = 0; i < roads.length; i++) {
            const road = roads[i];
            if (player.townId === road.fromTownId || player.townId === road.toTownId) {
                const otherTown = Engine.findTown(road.fromTownId === player.townId ? road.toTownId : road.fromTownId);
                actions.push({
                    id: 'sabotage_road', tab: 'sabotage',
                    name: `Sabotage Road to ${otherTown ? otherTown.name : '?'}`,
                    desc: 'Reduce road quality for 60 days.',
                    cost: '5 tools', detection: calculateCorruptDetection(0.15, town),
                    requiresSkill: ['shadow_dealings', 'arsonist_skill'],
                    requires: 'Shadow Dealings or Arsonist', available: (player.inventory.tools || 0) >= 5,
                    params: [i],
                });
            }
        }

        // Single arson entry with building dropdown
        if (town.buildings.length > 0) {
            let baseDetect = 0.40;
            if (hasSkill('arsonist_skill')) baseDetect *= 0.5;
            actions.push({
                id: 'arson', tab: 'sabotage',
                name: 'Arson',
                desc: 'DESTROY building permanently.',
                cost: '1 wood + 10g', detection: calculateCorruptDetection(baseDetect, town),
                reward: 'Building destroyed', xp: 25,
                requiresSkill: ['arsonist_skill'],
                requires: 'Arsonist',
                available: hasSkill('arsonist_skill') && (player.inventory.wood || 0) >= 1 && player.gold >= 10,
                _needsBuildingSelect: true,
                _buildingList: _sabBuildingList,
                _townId: town.id,
                params: [0, town.id],
            });
        }
        } // end sabotage skill gate

        // Steal/pickpocket — requires discrete
        if (hasSkill('discrete')) {
        actions.push({
            id: 'steal_goods', tab: 'sabotage',
            name: 'Steal Goods',
            desc: `Take goods from market without paying. Max 20 units.${isNight ? ' (Night bonus!)' : ''}`,
            cost: 'Free', detection: calculateCorruptDetection(isNight ? 0.20 : 0.35, town),
            reward: 'Free goods', xp: 5,
            requires: 'Discrete', available: true,
            params: [null, null, town.id],
        });

        // Pickpocket — steal gold from NPCs
        actions.push({
            id: 'pickpocket', tab: 'sabotage',
            name: 'Pickpocket Townsfolk',
            desc: `Lift gold from unsuspecting locals. Yield: 5-30g.${isNight ? ' (Night bonus!)' : ''}`,
            cost: 'Free', detection: calculateCorruptDetection(isNight ? 0.15 : 0.30, town),
            reward: '5-30g', xp: 3,
            requires: 'Discrete', available: true,
            params: [town.id],
        });
        } // end discrete gate

        // Warehouse Heist — steal from NPC-owned warehouses/buildings
        if (hasSkill('shadow_dealings') || hasSkill('discrete')) {
            var npcBuildings = town.buildings.filter(function(b) { return b.ownerId && b.ownerId !== 'player'; });
            if (npcBuildings.length > 0) {
                actions.push({
                    id: 'warehouse_heist', tab: 'sabotage',
                    name: 'Warehouse Heist',
                    desc: `Break into a rival's warehouse and steal stored goods. High reward, high risk!${isNight ? ' (Night bonus!)' : ''}`,
                    cost: '1 tools', detection: calculateCorruptDetection(isNight ? 0.25 : 0.45, town),
                    reward: '10-50 units of goods', xp: 15,
                    requires: 'Shadow Dealings or Discrete', available: (player.inventory.tools || 0) >= 1,
                    params: [town.id],
                });
            }
        }

        // Rob Traveler — ambush people on roads near town
        if (hasSkill('shadow_dealings')) {
            actions.push({
                id: 'rob_traveler', tab: 'sabotage',
                name: 'Rob Traveler',
                desc: 'Ambush a merchant or traveler on the road near town. Risk of combat!',
                cost: 'Free (weapon recommended)', detection: calculateCorruptDetection(0.20, town),
                reward: '20-100g + random goods', xp: 10,
                requires: 'Shadow Dealings', available: true,
                params: [town.id],
            });
        }

        // Raid Caravan — intercept an NPC caravan
        if (hasSkill('dark_connections') || player.notoriety >= 40) {
            actions.push({
                id: 'raid_caravan', tab: 'sabotage',
                name: 'Raid a Caravan',
                desc: 'Hire bandits to intercept a trade caravan. Very profitable but extremely risky.',
                cost: '200g (bandit fee)', detection: calculateCorruptDetection(0.35, town),
                reward: '50-200 units of goods', xp: 25,
                requires: 'Dark Connections or 40+ notoriety', available: player.gold >= 200,
                params: [town.id],
            });
        }

        if (hasSkill('master_forger')) {
            actions.push({
                id: 'counterfeit', tab: 'sabotage',
                name: 'Sell Counterfeit Goods',
                desc: 'Sell fake jewelry/wine/cloth at full price.',
                cost: 'Free (no goods needed)', detection: calculateCorruptDetection(0.30, town),
                reward: 'Gold from nothing', xp: 15,
                requires: 'master_forger', available: true,
                params: [null, null, town.id],
            });
        }

        // Political tab
        const security = (town.security || 50);
        const minBribe = Math.floor(50 + security * 4.5);
        if (hasSkill('bribe_expert') || hasSkill('silver_tongue_dark')) {
        actions.push({
            id: 'bribe_guards', tab: 'political',
            name: 'Bribe Guards',
            desc: `Reduce detection chance in this town by 40% for 30 days.`,
            cost: `${minBribe}-500g`, detection: calculateCorruptDetection(0.10, town),
            reward: '-40% detection', xp: 5,
            requires: 'Bribe Expert or Silver Tongue (Dark)', available: player.gold >= minBribe,
            params: [town.id, minBribe],
        });
        }

        if (kingdom) {
            const advCost = Math.floor(500 + (kingdom.prosperity || 50) * 15);
            if (hasSkill('silver_tongue_dark') || hasSkill('kingmaker_skill')) {
            actions.push({
                id: 'bribe_advisor', tab: 'political',
                name: 'Bribe Royal Advisor',
                desc: 'Influence the next advisor vote.',
                cost: `${advCost}g`, detection: calculateCorruptDetection(0.20, town),
                reward: 'Political influence', xp: 25,
                requires: 'Silver Tongue (Dark) or Kingmaker',
                available: player.gold >= advCost,
                params: [kingdom.id, null],
            });
            }

            if (hasSkill('kingmaker_skill') || hasSkill('silver_tongue_dark')) {
            actions.push({
                id: 'cultivate_heir', tab: 'political',
                name: 'Cultivate the Heir',
                desc: `Gift luxury goods to heir. Current favor: ${player.heirFavor[kingdom.id] || 0}/100.`,
                cost: '100g+ in luxury goods', detection: 0,
                reward: 'Future political power', xp: 5,
                requires: 'Kingmaker or Silver Tongue (Dark)', available: true,
                params: [kingdom.id],
            });
            }

            if (hasSkill('shadow_dealings')) {
            actions.push({
                id: 'insider_trading', tab: 'market',
                name: 'Insider Trading',
                desc: 'Learn about upcoming law/tax changes 30 days early.',
                cost: '300g', detection: calculateCorruptDetection(0.20, town),
                reward: 'Advance knowledge', xp: 10,
                requires: 'Shadow Dealings', available: player.gold >= 300,
                params: [kingdom.id],
            });
            }
        }

        if (hasSkill('silver_tongue_dark') || hasSkill('discrete')) {
        actions.push({
            id: 'spread_rumors', tab: 'political',
            name: 'Spread Rumors',
            desc: 'Damage a competitor\'s reputation for 60 days.',
            cost: '50g', detection: calculateCorruptDetection(0.15, town),
            reward: 'Competitor weakened', xp: 8,
            requires: 'Silver Tongue (Dark) or Discrete', available: player.gold >= 50,
            params: [null],
        });
        }

        if (hasSkill('shadow_dealings') || hasSkill('master_forger')) {
        actions.push({
            id: 'frame_competitor', tab: 'political',
            name: 'Frame Competitor',
            desc: 'Plant evidence to get a competitor arrested.',
            cost: '200g', detection: calculateCorruptDetection(0.30, town),
            reward: 'Competitor jailed/fined', xp: 20,
            requires: 'Shadow Dealings or Master Forger', available: player.gold >= 200,
            params: [null, null],
        });
        }

        // Assassination tab — requires dark_connections or assassin
        if (hasSkill('dark_connections') || hasSkill('assassin')) {
        actions.push({
            id: 'assassinate_competitor', tab: 'assassination',
            name: 'Hire Assassin (Competitor)',
            desc: 'Eliminate a rival merchant. Their buildings become available.',
            cost: '1000-3000g', detection: calculateCorruptDetection(0.20, town),
            reward: 'Competitor eliminated', xp: 30,
            requires: 'Dark Connections or Assassin', available: player.gold >= 1000,
            params: [null, 'competitor'],
        });

        actions.push({
            id: 'assassinate_guard_captain', tab: 'assassination',
            name: 'Hire Assassin (Guard Captain)',
            desc: 'Reduce town security by 30 for 90 days.',
            cost: '2000-5000g', detection: calculateCorruptDetection(0.25, town),
            reward: 'Town security drop', xp: 40,
            requires: 'Dark Connections or Assassin', available: player.gold >= 2000,
            params: [town.id, 'guard_captain'],
        });
        }

        if (kingdom && (hasSkill('kingmaker_skill') || hasSkill('dark_connections'))) {
            actions.push({
                id: 'assassinate_king', tab: 'assassination',
                name: '👑 Assassinate King',
                desc: `EXTREMELY DANGEROUS. Kill the king of ${kingdom.name}.`,
                cost: '10000-25000g', detection: calculateCorruptDetection(0.50, town),
                reward: 'Regime change', xp: 100,
                requires: 'kingmaker_skill or dark_connections',
                available: player.gold >= 10000,
                params: [kingdom.id, 'king'],
            });
        }

        // Assassinate elite merchant passenger (requires active transport with elite merchant)
        if (player.activeTransport && player.activeTransport.passengers && player.activeTransport.passengers.length > 0 &&
            (hasSkill('assassin') || hasSkill('dark_connections'))) {
            var hasElitePassenger = player.activeTransport.passengers.some(function(pass) {
                var person = Engine.findPerson ? Engine.findPerson(pass.personId) : null;
                return person && person.isEliteMerchant;
            });
            if (hasElitePassenger) {
                actions.push({
                    id: 'assassinate_passenger', tab: 'assassination',
                    name: '\u2620\uFE0F Assassinate Passenger',
                    desc: 'Kill an elite merchant during transport. Loot half their gold. Their dynasty may collapse.',
                    cost: 'None', detection: calculateCorruptDetection(0.30, town),
                    reward: 'Gold loot + empire disruption', xp: 50,
                    requires: 'assassin or dark_connections',
                    available: true,
                    params: [0],
                });
            }
        }

        if (hasSkill('poisoner')) {
            actions.push({
                id: 'poison', tab: 'assassination',
                name: 'Poison Target',
                desc: 'Slow kill (5-15 days), lower detection.',
                cost: '1 poison', detection: calculateCorruptDetection(0.15, town),
                reward: 'Target dies slowly', xp: 20,
                requires: 'poisoner', available: (player.inventory.poison || 0) >= 1,
                params: [null],
            });
        }

        // Tax Evasion tab — requires discrete or shadow_dealings
        if (hasSkill('discrete') || hasSkill('shadow_dealings')) {
        if (!player.hiddenWarehouses.some(hw => hw.townId === town.id)) {
            actions.push({
                id: 'hidden_warehouse', tab: 'tax_evasion',
                name: 'Build Hidden Warehouse',
                desc: 'Store goods invisible to tax collectors. 50 capacity.',
                cost: '800g + 20 wood + 15 stone', detection: 0,
                reward: 'Tax-free storage', xp: 15,
                requires: 'Discrete or Shadow Dealings',
                available: player.gold >= 800 && (player.inventory.wood || 0) >= 20 && (player.inventory.stone || 0) >= 15,
                params: [town.id],
            });
        }
        }

        if (hasSkill('master_forger') || hasSkill('shadow_dealings')) {
        if (!player.cookingBooks) {
            const hasLocalBuildings = player.buildings.some(b => b.townId === player.townId);
            actions.push({
                id: 'cook_books', tab: 'tax_evasion',
                name: 'Cook the Books',
                desc: 'Underreport trade volume by 30%. Saves ~30% on taxes this season.',
                cost: 'Free', detection: 0.10,
                reward: '~30% tax savings', xp: 5,
                requires: 'Master Forger or Shadow Dealings',
                available: hasLocalBuildings,
                params: [],
            });
        }
        }

        // ── Espionage tab (new schemes) ──
        if (hasSkill('discrete') && hasSkill('dark_connections')) {
            if (!player.spyNetworks || !player.spyNetworks[town.id]) {
                actions.push({
                    id: 'spy_network', tab: 'political',
                    name: '🕵️ Plant Spy Network',
                    desc: 'Establish intelligence contacts. Get advance warning of price changes, wars, and laws for 180 days.',
                    cost: '500g', detection: calculateCorruptDetection(0.20, town),
                    reward: 'Information advantage', xp: 20,
                    requires: 'Discrete + Dark Connections', available: player.gold >= 500,
                    params: [town.id],
                });
            }
        }

        if (hasSkill('master_smuggler') && hasSkill('contraband_network')) {
            var _srCount = (player.smugglingRoutes || []).length;
            if (_srCount < 3) {
                // Find towns connected by road to offer as destinations
                var _connRoads = (Engine.getRoads ? Engine.getRoads() : []).filter(function(r) {
                    return r.fromTownId === town.id || r.toTownId === town.id;
                });
                for (var _sri = 0; _sri < Math.min(3, _connRoads.length); _sri++) {
                    var _destId = _connRoads[_sri].fromTownId === town.id ? _connRoads[_sri].toTownId : _connRoads[_sri].fromTownId;
                    var _destTown = Engine.findTown(_destId);
                    var _routeExists = (player.smugglingRoutes || []).some(function(r) {
                        return (r.fromTownId === town.id && r.toTownId === _destId) || (r.fromTownId === _destId && r.toTownId === town.id);
                    });
                    if (!_routeExists && _destTown) {
                        actions.push({
                            id: 'smuggling_route', tab: 'market',
                            name: '🥷 Smuggling Route to ' + _destTown.name,
                            desc: 'Establish permanent smuggling route. Generates passive gold for 1 year. (' + _srCount + '/3 active)',
                            cost: '1000g', detection: calculateCorruptDetection(0.25, town),
                            reward: 'Passive income', xp: 25,
                            requires: 'Master Smuggler + Contraband Network', available: player.gold >= 1000,
                            params: [town.id, _destId],
                        });
                    }
                }
            }
        }

        if (hasSkill('master_forger')) {
            var _fd = player.forgedDocuments || {};
            if (!_fd.trade_permit || _fd.trade_permit <= day) {
                actions.push({
                    id: 'forge_documents', tab: 'market',
                    name: '📝 Forge Trade Permit',
                    desc: 'Create fake trade permit. Bypass tariffs and trade restrictions for 90 days.',
                    cost: '200g', detection: calculateCorruptDetection(0.20, town),
                    reward: 'Trade freedom', xp: 15,
                    requires: 'Master Forger', available: player.gold >= 200,
                    params: ['trade_permit'],
                });
            }
            if (!_fd.noble_title || _fd.noble_title <= day) {
                actions.push({
                    id: 'forge_documents', tab: 'political',
                    name: '📝 Forge Noble Title',
                    desc: 'Create fake noble credentials. Treated as minor nobility for 60 days.',
                    cost: '800g', detection: calculateCorruptDetection(0.35, town),
                    reward: 'Social access', xp: 15,
                    requires: 'Master Forger', available: player.gold >= 800,
                    params: ['noble_title'],
                });
            }
            if (!_fd.travel_papers || _fd.travel_papers <= day) {
                actions.push({
                    id: 'forge_documents', tab: 'market',
                    name: '📝 Forge Travel Papers',
                    desc: 'Create fake travel papers. Cross closed borders freely for 120 days.',
                    cost: '150g', detection: calculateCorruptDetection(0.15, town),
                    reward: 'Border freedom', xp: 15,
                    requires: 'Master Forger', available: player.gold >= 150,
                    params: ['travel_papers'],
                });
            }
        }

        if (hasSkill('dark_connections')) {
            actions.push({
                id: 'sabotage_caravan', tab: 'sabotage',
                name: '⚔️ Sabotage Rival Caravan',
                desc: 'Hire bandits to ambush an elite merchant or noble\'s caravan near this town.',
                cost: '300g', detection: calculateCorruptDetection(0.30, town),
                reward: 'Loot + rival disruption', xp: 20,
                requires: 'Dark Connections', available: player.gold >= 300,
                params: [null],
            });
        }

        if (hasSkill('master_forger') && hasSkill('discrete')) {
            actions.push({
                id: 'plant_evidence', tab: 'political',
                name: '🎭 Plant Evidence on NPC',
                desc: 'Plant contraband on an NPC to get them arrested. Disrupts their operations.',
                cost: '150g', detection: calculateCorruptDetection(0.25, town),
                reward: 'Rival removed', xp: 20,
                requires: 'Master Forger + Discrete', available: player.gold >= 150,
                params: [null],
            });
        }

        if (hasSkill('kingmaker_skill') && kingdom) {
            actions.push({
                id: 'incite_revolt', tab: 'political',
                name: '🔥 Incite Revolt',
                desc: 'Fund agitators to destabilize ' + kingdom.name + '. Reduces stability, prosperity, increases unrest.',
                cost: '2000g', detection: calculateCorruptDetection(0.40, town),
                reward: 'Kingdom weakened', xp: 40,
                requires: 'Kingmaker', available: player.gold >= 2000,
                params: [kingdom.id],
            });
        }

        // ── Noble Intrigue Schemes (require rank 4+ in current kingdom) ──
        if (kingdom && (player.socialRank[kingdom.id] || 0) >= 4) {
            var _intNobles = _getKingdomNobles(kingdom.id);
            if (_intNobles.length >= 2 && (hasSkill('silver_tongue_dark') || hasSkill('kingmaker_skill'))) {
                actions.push({
                    id: 'pit_nobles', tab: 'political',
                    name: '🗡️ Pit Nobles Against Each Other',
                    desc: 'Sow discord between two nobles. Having them indebted/blackmailed increases success. (' + _intNobles.length + ' nobles in kingdom)',
                    cost: '300g', detection: calculateCorruptDetection(0.25, town),
                    reward: 'Noble rivalry', xp: 20,
                    requires: 'Noble rank + Silver Tongue (Dark) or Kingmaker', available: player.gold >= 300,
                    params: [null, null], _needsNobleSelect: 2, _nobles: _intNobles,
                });
            }
            if (_intNobles.length >= 1 && hasSkill('kingmaker_skill')) {
                actions.push({
                    id: 'turn_noble_against_king', tab: 'political',
                    name: '🏴 Turn Noble Against King',
                    desc: 'Undermine a noble\'s loyalty to the crown. Ambitious/disloyal nobles are easier targets.',
                    cost: '500g', detection: calculateCorruptDetection(0.30, town),
                    reward: 'Noble disloyal', xp: 25,
                    requires: 'Noble rank + Kingmaker', available: player.gold >= 500,
                    params: [null], _needsNobleSelect: 1, _nobles: _intNobles,
                });
            }
            if (_intNobles.length >= 1 && (hasSkill('shadow_dealings') || hasSkill('silver_tongue_dark'))) {
                actions.push({
                    id: 'discredit_noble', tab: 'political',
                    name: '📜 Discredit Noble',
                    desc: 'Spread misinformation to damage a noble\'s reputation at court. Forger skill helps.',
                    cost: '400g', detection: calculateCorruptDetection(0.25, town),
                    reward: 'Noble weakened', xp: 20,
                    requires: 'Noble rank + Shadow Dealings or Silver Tongue (Dark)', available: player.gold >= 400,
                    params: [null], _needsNobleSelect: 1, _nobles: _intNobles,
                });
            }
            if (_intNobles.length >= 1 && (hasSkill('silver_tongue_dark') || hasSkill('kingmaker_skill'))) {
                actions.push({
                    id: 'manipulate_vote', tab: 'political',
                    name: '🤝 Manipulate Noble\'s Vote',
                    desc: 'Sway a noble to support your political positions through bribes and favors.',
                    cost: '200g', detection: calculateCorruptDetection(0.15, town),
                    reward: 'Political support', xp: 15,
                    requires: 'Noble rank + Silver Tongue (Dark) or Kingmaker', available: player.gold >= 200,
                    params: [null, 'general'], _needsNobleSelect: 1, _nobles: _intNobles,
                });
            }
            if (_intNobles.length >= 1 && (hasSkill('dark_connections') || hasSkill('shadow_dealings'))) {
                actions.push({
                    id: 'expose_secrets', tab: 'political',
                    name: '💥 Expose Noble\'s Secrets',
                    desc: 'Dig up and publicize a noble\'s secrets. Spy networks help. Devastating if successful.',
                    cost: '600g', detection: calculateCorruptDetection(0.20, town),
                    reward: 'Noble ruined', xp: 30,
                    requires: 'Noble rank + Dark Connections or Shadow Dealings', available: player.gold >= 600,
                    params: [null], _needsNobleSelect: 1, _nobles: _intNobles,
                });
            }

            // Double Noble Agent — contact an enemy kingdom
            if (hasSkill('shadow_dealings') && (hasSkill('kingmaker_skill') || hasSkill('silver_tongue_dark')) && !player.doubleNobleAgent) {
                var _dnaKingdoms = Engine.getWorld ? Engine.getWorld().kingdoms : [];
                for (var _dki = 0; _dki < _dnaKingdoms.length; _dki++) {
                    var _dk = _dnaKingdoms[_dki];
                    if (_dk.id === kingdom.id) continue;
                    // Check if hostile
                    var _dkHostile = false;
                    if (_dk.atWar && _dk.atWar.has && _dk.atWar.has(kingdom.id)) _dkHostile = true;
                    if (!_dkHostile) {
                        var _dkDiplo = (_dk.diplomaticRelations || {})[kingdom.id] || 0;
                        if (_dkDiplo < -30) _dkHostile = true;
                    }
                    if (_dkHostile) {
                        actions.push({
                            id: 'double_noble_agent', tab: 'political',
                            name: '🎭 Double Agent for ' + _dk.name,
                            desc: 'Contact ' + _dk.name + ' to become a double noble agent. Receive 5 tasks to destabilize ' + kingdom.name + '. Huge reward on completion.',
                            cost: 'Your loyalty', detection: calculateCorruptDetection(0.20, town),
                            reward: '5000-20000g + Minor Noble rank in ' + _dk.name, xp: 100,
                            requires: 'Noble rank + Shadow Dealings + (Kingmaker or Silver Tongue Dark)', available: true,
                            params: [_dk.id],
                        });
                    }
                }
            }
            // Abandon Double Noble Agent
            if (player.doubleNobleAgent) {
                actions.push({
                    id: 'abandon_double_noble', tab: 'political',
                    name: '❌ Abandon Double Agent Mission',
                    desc: 'Give up your double noble agent mission. Sponsor loses trust. (' + (player.doubleNobleAgent.completed || 0) + '/5 tasks done)',
                    cost: '-15 sponsor rep', detection: 0,
                    reward: 'Freedom', xp: 0,
                    requires: 'Active mission', available: true,
                    params: [],
                });
            }
        }

        if (hasSkill('shadow_dealings') && player.militaryService && player.militaryService.active && !player.doubleAgentActive) {
            // Find enemy kingdoms at war with player's service kingdom
            var _myMilKingdom = player.militaryService.kingdomId;
            var _activeWars = Engine.getActiveWars ? Engine.getActiveWars() : {};
            for (var _wId in _activeWars) {
                var _war = _activeWars[_wId];
                var _enemyId = null;
                if (_war.kingdomA === _myMilKingdom) _enemyId = _war.kingdomB;
                else if (_war.kingdomB === _myMilKingdom) _enemyId = _war.kingdomA;
                if (_enemyId) {
                    var _enemyK = Engine.findKingdom ? Engine.findKingdom(_enemyId) : null;
                    if (_enemyK) {
                        actions.push({
                            id: 'double_agent', tab: 'political',
                            name: '🕵️ Double Agent for ' + _enemyK.name,
                            desc: 'Sell military secrets to the enemy. High risk treason — devastating if caught.',
                            cost: 'Free', detection: calculateCorruptDetection(0.30, town),
                            reward: 'Gold per season', xp: 30,
                            requires: 'Shadow Dealings + Active Military', available: true,
                            params: [_enemyId],
                        });
                    }
                }
            }
        }

        if (hasSkill('intimidating_presence') && hasSkill('shadow_dealings')) {
            if (!player.protectionRackets || !player.protectionRackets[town.id]) {
                actions.push({
                    id: 'protection_racket', tab: 'market',
                    name: '💪 Protection Racket',
                    desc: 'Extort local merchants for weekly "protection" payments. Creates enemies but generates passive income.',
                    cost: 'Free', detection: calculateCorruptDetection(0.25, town),
                    reward: 'Weekly gold', xp: 20,
                    requires: 'Intimidating Presence + Shadow Dealings', available: true,
                    params: [town.id],
                });
            }
        }

        // ── Notoriety Reduction Schemes ──
        if ((player.notoriety || 0) > 0 && !player.notorietyReduction) {
            // Lay Low — expensive, slow, no skill requirement
            actions.push({
                id: 'lay_low', tab: 'political',
                name: '🕶️ Lay Low',
                desc: 'Pay a hefty sum to disappear from the public eye. Slowly reduces notoriety over 30-60 days.',
                cost: '1,500g', detection: 0,
                reward: 'Notoriety -25 to -45', xp: 5,
                requires: 'Notoriety > 0', available: player.gold >= 1500,
                params: [],
            });
            // Cleanse Identity — cheaper, faster, skill-gated
            if (hasSkill('master_forger') || hasSkill('silver_tongue_dark') || hasSkill('discrete')) {
                var _ciCost = 400;
                var _ciSkills = 0;
                if (hasSkill('master_forger')) _ciSkills++;
                if (hasSkill('silver_tongue_dark')) _ciSkills++;
                if (hasSkill('discrete')) _ciSkills++;
                if (_ciSkills >= 3) _ciCost = 200;
                else if (_ciSkills >= 2) _ciCost = 300;
                var _ciRewardDesc = _ciSkills >= 3 ? 'Notoriety -35 to -50' : _ciSkills >= 2 ? 'Notoriety -25 to -40' : 'Notoriety -20 to -35';
                actions.push({
                    id: 'cleanse_identity', tab: 'political',
                    name: '🧹 Cleanse Identity',
                    desc: 'Use your skills to forge new records, talk your way out of suspicion, and erase evidence. Fast notoriety reduction over 7-14 days.',
                    cost: _ciCost + 'g', detection: 0,
                    reward: _ciRewardDesc, xp: 10,
                    requires: 'Master Forger / Silver Tongue (Dark) / Discrete', available: player.gold >= _ciCost,
                    params: [],
                });
            }
        }

        return actions;
    }

    function assassinatePassenger(passengerIndex) {
        _sync();
        if (!player.activeTransport) return { success: false, message: 'No active transport.' };
        if (!hasSkill('assassin') && !hasSkill('dark_connections')) return { success: false, message: 'Requires Assassin or Dark Connections skill.' };
        var transport = player.activeTransport;
        if (!transport.passengers || !transport.passengers[passengerIndex]) return { success: false, message: 'Invalid passenger.' };
        var passenger = transport.passengers[passengerIndex];

        var person = Engine.findPerson ? Engine.findPerson(passenger.personId) : null;
        if (!person || !person.isEliteMerchant) return { success: false, message: 'Target is not an elite merchant.' };

        // High risk — 30% base detection
        var detection = 0.30;
        if (hasSkill('assassin')) detection *= 0.5;
        if (hasSkill('poisoner')) detection *= 0.7;
        var rng = Engine.getRng();

        if (rng && rng.chance(detection)) {
            // Caught! Severe punishment
            player.notoriety = (player.notoriety || 0) + 30;
            var town = Engine.findTown(player.townId);
            var kingdom = town ? (Engine.findKingdom ? Engine.findKingdom(town.kingdomId) : null) : null;
            var _passIsNoble = person && (person.occupation === 'noble' || person.occupation === 'king' || person.isKing);
            applyCorruptPenalty(town, kingdom, 5000, 50, 30, true, 'murder', _passIsNoble ? { isNobleTarget: true } : null);
            recordCorruptAction('assassinate_passenger', true, (typeof town !== 'undefined' && town ? town.kingdomId : null), 'murder');
            // Remove all passengers — they flee
            transport.passengers = [];
            Engine.logEvent(player.fullName + ' was caught attempting to assassinate ' + person.firstName + '!');
            return { success: false, caught: true, message: '\uD83D\uDEA8 CAUGHT! Massive fine, jailed 30 days, reputation destroyed.' };
        }

        // Success — kill the merchant
        if (Engine.killPerson) Engine.killPerson(person, 'assassination');
        player.notoriety = (player.notoriety || 0) + 15;
        recordCorruptAction('assassinate_passenger', false, (typeof town !== 'undefined' && town ? town.kingdomId : null), 'murder');
        grantXP(50, 'Assassination');

        // Remove from passenger list
        transport.passengers.splice(passengerIndex, 1);
        transport.totalRevenue = (transport.totalRevenue || 0) - (passenger.fare || 0);

        // Loot their gold
        var loot = Math.floor((person.gold || 0) * 0.5);
        player.gold += loot;

        Engine.logEvent('An elite merchant was found dead during transport. Foul play suspected.');
        return { success: true, message: '\u2620\uFE0F ' + person.firstName + ' eliminated. Looted ' + loot + 'g. Their empire will pass to an heir... or collapse.' };
    }

    // ── (p1) Spy Network ──
    function plantSpyNetwork(townId) {
        _sync();
        if (isJailed()) return { success: false, message: 'You are in jail.' };
        if (!hasSkill('discrete') || !hasSkill('dark_connections')) return { success: false, message: 'Requires Discrete + Dark Connections skills.' };
        if (player.gold < 500) return { success: false, message: 'Need 500g to establish spy network.' };
        var town = Engine.findTown(townId);
        if (!town) return { success: false, message: 'Town not found.' };
        player.spyNetworks = player.spyNetworks || {};
        if (player.spyNetworks[townId]) return { success: false, message: 'Already have a spy network in ' + town.name + '.' };

        var rng = Engine.getRng();
        var detection = calculateCorruptDetection(0.20, town);
        var _o = _rollSchemeOutcome(detection, rng);
        var caught = _o.caught;
        var successful = _o.successful;
        player.gold -= 500;

        if (successful) {
            player.spyNetworks[townId] = { expiresDay: Engine.getDay() + 180, kingdomId: town.kingdomId };
            grantXP(20, 'Established spy network');
            Engine.logEvent(player.fullName + ' established intelligence contacts in ' + town.name + '.');
        }

        var caughtMsg = '';
        if (caught) {
            var kingdom = Engine.findKingdom ? Engine.findKingdom(town.kingdomId) : null;
            applyCorruptPenalty(town, kingdom, 300, 15, 5, false, 'forgery');
            recordCorruptAction('spy_network', true, (typeof town !== 'undefined' && town ? town.kingdomId : null), 'forgery');
            player.notoriety = (player.notoriety || 0) + _trackedNotoriety(10);
            caughtMsg = '🚨 CAUGHT! Fined 300g, jailed 5d.';
        } else {
            recordCorruptAction('spy_network', false, (typeof town !== 'undefined' && town ? town.kingdomId : null), 'forgery');
            player.notoriety = (player.notoriety || 0) + _trackedNotoriety(5);
        }

        return _schemeResult({
            successful: successful, caught: caught,
            successMsg: '🕵️ Spy network established in ' + town.name + '! Advance warnings for 180 days.',
            caughtMsg: caughtMsg,
            partialMsg: 'Spy network established but a contact betrayed you! ' + caughtMsg,
            failMsg: '❌ The contacts didn\'t pan out (500g lost) but no one suspects you.'
        });
    }

    // ── (p2) Smuggling Route ──
    function establishSmugglingRoute(fromTownId, toTownId) {
        _sync();
        if (isJailed()) return { success: false, message: 'You are in jail.' };
        if (!hasSkill('master_smuggler') || !hasSkill('contraband_network')) return { success: false, message: 'Requires Master Smuggler + Contraband Network skills.' };
        if (player.gold < 1000) return { success: false, message: 'Need 1000g to bribe contacts along the route.' };
        var fromTown = Engine.findTown(fromTownId);
        var toTown = Engine.findTown(toTownId);
        if (!fromTown || !toTown) return { success: false, message: 'Towns not found.' };
        if (fromTownId === toTownId) return { success: false, message: 'Cannot smuggle to the same town.' };

        player.smugglingRoutes = player.smugglingRoutes || [];
        var exists = player.smugglingRoutes.some(function(r) {
            return (r.fromTownId === fromTownId && r.toTownId === toTownId) || (r.fromTownId === toTownId && r.toTownId === fromTownId);
        });
        if (exists) return { success: false, message: 'Already have a smuggling route between these towns.' };
        if (player.smugglingRoutes.length >= 3) return { success: false, message: 'Maximum 3 smuggling routes. Close one first.' };

        var rng = Engine.getRng();
        var detection = calculateCorruptDetection(0.25, fromTown);
        var _o = _rollSchemeOutcome(detection, rng);
        var caught = _o.caught;
        var successful = _o.successful;
        player.gold -= 1000;

        if (successful) {
            player.smugglingRoutes.push({ fromTownId: fromTownId, toTownId: toTownId, expiresDay: Engine.getDay() + CONFIG.DAYS_PER_SEASON, goldEarned: 0 });
            grantXP(25, 'Established smuggling route');
            Engine.logEvent('A new smuggling route has been established between ' + fromTown.name + ' and ' + toTown.name + '.');
        }

        var caughtMsg = '';
        if (caught) {
            var kingdom = Engine.findKingdom ? Engine.findKingdom(fromTown.kingdomId) : null;
            applyCorruptPenalty(fromTown, kingdom, 500, 20, 10, false, 'smuggling');
            recordCorruptAction('smuggling_route', true, fromTown && fromTown.kingdomId, 'smuggling');
            player.notoriety = (player.notoriety || 0) + _trackedNotoriety(15);
            caughtMsg = '🚨 CAUGHT! Fined 500g, jailed 10d.';
        } else {
            recordCorruptAction('smuggling_route', false, fromTown && fromTown.kingdomId, 'smuggling');
            player.notoriety = (player.notoriety || 0) + _trackedNotoriety(8);
        }

        return _schemeResult({
            successful: successful, caught: caught,
            successMsg: '🥷 Smuggling route established: ' + fromTown.name + ' ↔ ' + toTown.name + '! Generates passive income for 1 year.',
            caughtMsg: caughtMsg,
            partialMsg: 'Smuggling route established but customs caught wind of it! ' + caughtMsg,
            failMsg: '❌ The route fell through (1000g lost) but you weren\'t identified.'
        });
    }

    // ── (p3) Forge Documents ──
    function forgeDocuments(docType, targetKingdomId) {
        _sync();
        if (isJailed()) return { success: false, message: 'You are in jail.' };
        if (!hasSkill('master_forger')) return { success: false, message: 'Requires Master Forger skill.' };
        player.forgedDocuments = player.forgedDocuments || {};

        var rng = Engine.getRng();
        var town = Engine.findTown(player.townId);
        var day = Engine.getDay();
        var cost, duration, detection, reward;

        // v9p33river198: temp_license & temp_citizenship docs target a specific
        // kingdom for 30 days. Stored under player.forgedKingdomDocs[kingdomId]
        // = { license: expDay, citizenship: expDay } so they can stack across
        // multiple kingdoms independently.
        if (docType === 'temp_license' || docType === 'temp_citizenship') {
            if (!targetKingdomId) return { success: false, message: 'Choose a target kingdom.' };
            var targetK = Engine.findKingdom(targetKingdomId);
            if (!targetK) return { success: false, message: 'Unknown kingdom.' };
            cost = (docType === 'temp_citizenship') ? 600 : 250;
            duration = 30;
            detection = (docType === 'temp_citizenship') ? 0.30 : 0.18;
            var actualSubject = (docType === 'temp_citizenship') ? 'citizenship' : 'trade license';
            reward = 'Forged ' + actualSubject + ' in ' + targetK.name + ' for 30 days';
            if (player.gold < cost) return { success: false, message: 'Need ' + cost + 'g.' };
            player.forgedKingdomDocs = player.forgedKingdomDocs || {};
            if (!player.forgedKingdomDocs[targetKingdomId]) player.forgedKingdomDocs[targetKingdomId] = {};
            var existing = player.forgedKingdomDocs[targetKingdomId][docType === 'temp_citizenship' ? 'citizenship' : 'license'];
            if (existing && existing > day) return { success: false, message: 'Already have an active forged ' + actualSubject + ' in ' + targetK.name + '.' };
            var detectChanceK = calculateCorruptDetection(detection, town);
            var _ofk = _rollSchemeOutcome(detectChanceK, rng);
            var caughtK = _ofk.caught;
            var successfulK = _ofk.successful;
            player.gold -= cost;

            if (successfulK) {
                player.forgedKingdomDocs[targetKingdomId][docType === 'temp_citizenship' ? 'citizenship' : 'license'] = day + duration;
                grantXP(15, 'Forged ' + actualSubject);
            }

            var caughtMsgK = '';
            if (caughtK) {
                var kingdomCaught = Engine.findKingdom ? Engine.findKingdom(town ? town.kingdomId : null) : null;
                var fineK = applyCorruptPenalty(town, kingdomCaught, cost * 3, 20, 7, false, 'forgery');
                recordCorruptAction('forge_documents', true, (typeof town !== 'undefined' && town ? town.kingdomId : null), 'forgery');
                player.notoriety = (player.notoriety || 0) + _trackedNotoriety(12);
                caughtMsgK = '🚨 CAUGHT forging ' + actualSubject + '! Fined ' + fineK + 'g, jailed 7d.';
            } else {
                recordCorruptAction('forge_documents', false, (typeof town !== 'undefined' && town ? town.kingdomId : null), 'forgery');
                player.notoriety = (player.notoriety || 0) + _trackedNotoriety(5);
            }

            return _schemeResult({
                successful: successfulK, caught: caughtK,
                successMsg: '📝 ' + reward + '!',
                caughtMsg: caughtMsgK,
                partialMsg: 'Got the forged ' + actualSubject + ' but the forger turned you in! ' + caughtMsgK,
                failMsg: '❌ Forgery botched (' + cost + 'g + materials lost) but no one suspects you.'
            });
        }

        if (docType === 'trade_permit') {
            cost = 200;
            duration = 90;
            detection = 0.20;
            reward = 'Bypass trade restrictions and tariffs for 90 days';
        } else if (docType === 'noble_title') {
            cost = 800;
            duration = 60;
            detection = 0.35;
            reward = 'Treated as minor nobility for 60 days — access to noble-only areas and audiences';
        } else if (docType === 'travel_papers') {
            cost = 150;
            duration = 120;
            detection = 0.15;
            reward = 'Cross closed borders freely for 120 days';
        } else {
            return { success: false, message: 'Unknown document type.' };
        }

        if (player.gold < cost) return { success: false, message: 'Need ' + cost + 'g for materials and bribes.' };
        if (player.forgedDocuments[docType] && player.forgedDocuments[docType] > day) {
            return { success: false, message: 'Already have active forged ' + docType.replace(/_/g, ' ') + '.' };
        }

        var detectChance = calculateCorruptDetection(detection, town);
        var _ofd = _rollSchemeOutcome(detectChance, rng);
        var caught = _ofd.caught;
        var successful = _ofd.successful;
        player.gold -= cost;

        if (successful) {
            player.forgedDocuments[docType] = day + duration;
            grantXP(15, 'Forged documents');
        }

        var caughtMsg = '';
        if (caught) {
            var kingdom = Engine.findKingdom ? Engine.findKingdom(town ? town.kingdomId : null) : null;
            var fine = applyCorruptPenalty(town, kingdom, cost * 3, 20, 7, false, 'forgery');
            recordCorruptAction('forge_documents', true, (typeof town !== 'undefined' && town ? town.kingdomId : null), 'forgery');
            player.notoriety = (player.notoriety || 0) + _trackedNotoriety(12);
            caughtMsg = '🚨 CAUGHT forging documents! Fined ' + fine + 'g, jailed 7d.';
        } else {
            recordCorruptAction('forge_documents', false, (typeof town !== 'undefined' && town ? town.kingdomId : null), 'forgery');
            player.notoriety = (player.notoriety || 0) + _trackedNotoriety(5);
        }

        return _schemeResult({
            successful: successful, caught: caught,
            successMsg: '📝 Forged ' + docType.replace(/_/g, ' ') + ' created! ' + reward + '.',
            caughtMsg: caughtMsg,
            partialMsg: 'Got the forged ' + docType.replace(/_/g, ' ') + ' but were exposed! ' + caughtMsg,
            failMsg: '❌ Forgery botched (' + cost + 'g lost) but no one suspects you.'
        });
    }

    // v9p33river198: helper queries for forged kingdom-scoped docs
    function hasForgedLicense(kingdomId) {
        _sync();
        if (!kingdomId || !player.forgedKingdomDocs || !player.forgedKingdomDocs[kingdomId]) return false;
        var exp = player.forgedKingdomDocs[kingdomId].license;
        return exp && exp > (Engine.getDay ? Engine.getDay() : 0);
    }
    function hasForgedCitizenship(kingdomId) {
        _sync();
        if (!kingdomId || !player.forgedKingdomDocs || !player.forgedKingdomDocs[kingdomId]) return false;
        var exp = player.forgedKingdomDocs[kingdomId].citizenship;
        return exp && exp > (Engine.getDay ? Engine.getDay() : 0);
    }

    // ── (p4) Sabotage Competitor Caravan ──
    function sabotageCaravan(targetType) {
        _sync();
        if (isJailed()) return { success: false, message: 'You are in jail.' };
        if (!hasSkill('dark_connections')) return { success: false, message: 'Requires Dark Connections skill.' };
        if (player.gold < 300) return { success: false, message: 'Need 300g to hire bandits.' };
        var town = Engine.findTown(player.townId);
        if (!town) return { success: false, message: 'Must be in a town.' };

        // Find elite merchant or noble caravans near this town
        var rng = Engine.getRng();
        var people = Engine.getPeople ? Engine.getPeople(player.townId) : [];
        var targets = [];
        for (var i = 0; i < people.length; i++) {
            var p = people[i];
            if (p && p.alive && (p.isEliteMerchant || p.occupation === 'noble') && p.caravans && p.caravans.length > 0) {
                targets.push(p);
            }
        }
        if (targets.length === 0) return { success: false, message: 'No elite merchant or noble caravans found near this town.' };

        var target = rng.pick(targets);
        var detection = calculateCorruptDetection(0.30, town);
        var _osc = _rollSchemeOutcome(detection, rng);
        var caught = _osc.caught;
        var successful = _osc.successful;
        player.gold -= 300;

        var loot = 0;
        if (successful) {
            loot = rng.randInt(50, 300);
            player.gold += loot;
            player.stats.totalGoldEarned += loot;
            if (target.gold != null) target.gold = Math.max(0, target.gold - loot * 2);
            grantXP(20, 'Sabotaged caravan');
            Engine.logEvent('A caravan belonging to ' + (target.firstName || 'a merchant') + ' was raided by bandits near ' + town.name + '.');
        }

        var caughtMsg = '';
        if (caught) {
            var kingdom = Engine.findKingdom ? Engine.findKingdom(town.kingdomId) : null;
            var fine = applyCorruptPenalty(town, kingdom, 800, 25, 10, false, 'blackmail');
            recordCorruptAction('sabotage_caravan', true, (typeof town !== 'undefined' && town ? town.kingdomId : null), 'sabotage');
            player.notoriety = (player.notoriety || 0) + _trackedNotoriety(20);
            caughtMsg = '🚨 CAUGHT sabotaging ' + (target.firstName || 'a merchant') + '\'s caravan! Fined ' + fine + 'g, jailed 10d.';
        } else {
            recordCorruptAction('sabotage_caravan', false, (typeof town !== 'undefined' && town ? town.kingdomId : null), 'sabotage');
            player.notoriety = (player.notoriety || 0) + _trackedNotoriety(12);
        }

        return _schemeResult({
            successful: successful, caught: caught,
            successMsg: '⚔️ Caravan sabotaged! Looted ' + loot + 'g from ' + (target.firstName || 'the merchant') + '\'s goods.',
            caughtMsg: caughtMsg,
            partialMsg: 'Caravan sabotaged (' + loot + 'g looted) but you were SEEN! ' + caughtMsg,
            failMsg: '❌ The bandits failed to find the caravan (300g lost).'
        });
    }

    // ── (p5) Plant Evidence ──
    function plantEvidence(npcId) {
        _sync();
        if (isJailed()) return { success: false, message: 'You are in jail.' };
        if (!hasSkill('master_forger') || !hasSkill('discrete')) return { success: false, message: 'Requires Master Forger + Discrete skills.' };
        if (player.gold < 150) return { success: false, message: 'Need 150g for fake contraband.' };
        var npc = Engine.findPerson ? Engine.findPerson(npcId) : null;
        if (!npc || !npc.alive) return { success: false, message: 'Target not found.' };
        if (npc.townId !== player.townId) return { success: false, message: 'Target must be in your location.' };

        var town = Engine.findTown(player.townId);
        var rng = Engine.getRng();
        var detection = calculateCorruptDetection(0.25, town);
        var _ope = _rollSchemeOutcome(detection, rng, _nobleSuccessMult(npcId));
        var caught = _ope.caught;
        var successful = _ope.successful;
        player.gold -= 150;

        var npcFine = 0;
        if (successful) {
            npcFine = rng.randInt(100, 500);
            if (npc.gold != null) npc.gold = Math.max(0, npc.gold - npcFine);
            npc._jailedUntilDay = Engine.getDay() + rng.randInt(10, 30);
            npc._jailedCrimeId = 'framed_evidence'; // v9p33river264
            if (npc.isEliteMerchant && npc.caravans) {
                for (var ci = 0; ci < npc.caravans.length; ci++) npc.caravans[ci].paused = true;
            }
            grantXP(20, 'Planted evidence');
            if (player.doubleNobleAgent && npc && (npc.occupation === 'noble' || npc.isNoble)) {
                if (town && town.kingdomId === player.doubleNobleAgent.targetKingdomId) _trackDnaTask('plant_evidence_noble');
            }
            Engine.logEvent((npc.firstName || 'A merchant') + ' was arrested after contraband was found in their possession!');
        }

        var caughtMsg = '';
        if (caught) {
            var kingdom = Engine.findKingdom ? Engine.findKingdom(town ? town.kingdomId : null) : null;
            var fine = applyCorruptPenalty(town, kingdom, 400, 20, 8, false, 'sabotage');
            recordCorruptAction('plant_evidence', true, (typeof town !== 'undefined' && town ? town.kingdomId : null), 'forgery');
            player.notoriety = (player.notoriety || 0) + _trackedNotoriety(15);
            if (player.relationships[npcId]) player.relationships[npcId].level = 0;
            caughtMsg = '🚨 CAUGHT planting evidence on ' + (npc.firstName || 'them') + '! Fined ' + fine + 'g, jailed 8d.';
        } else {
            recordCorruptAction('plant_evidence', false, (typeof town !== 'undefined' && town ? town.kingdomId : null), 'forgery');
            player.notoriety = (player.notoriety || 0) + _trackedNotoriety(8);
        }

        return _schemeResult({
            successful: successful, caught: caught,
            successMsg: '🎭 ' + (npc.firstName || 'Target') + ' arrested! Fined ' + npcFine + 'g and jailed. Their operations are disrupted.',
            caughtMsg: caughtMsg,
            partialMsg: (npc.firstName || 'Target') + ' arrested but you were SEEN planting the evidence! ' + caughtMsg,
            failMsg: '❌ The contraband was discovered before you could plant it (150g lost) but no one suspects you.'
        });
    }

    // ── (p6) Incite Revolt ──
    function inciteRevolt(kingdomId) {
        _sync();
        if (isJailed()) return { success: false, message: 'You are in jail.' };
        if (!hasSkill('kingmaker_skill')) return { success: false, message: 'Requires Kingmaker skill.' };
        if (player.gold < 2000) return { success: false, message: 'Need 2000g to fund agitators.' };
        var kingdom = Engine.findKingdom ? Engine.findKingdom(kingdomId) : null;
        if (!kingdom) return { success: false, message: 'Kingdom not found.' };

        var town = Engine.findTown(player.townId);
        var rng = Engine.getRng();
        var detection = calculateCorruptDetection(0.40, town);
        var _oir = _rollSchemeOutcome(detection, rng);
        var caught = _oir.caught;
        var successful = _oir.successful;
        player.gold -= 2000;

        if (successful) {
            kingdom.stability = Math.max(0, (kingdom.stability || 50) - rng.randInt(10, 25));
            kingdom.prosperity = Math.max(0, (kingdom.prosperity || 50) - rng.randInt(5, 15));
            kingdom.unrest = (kingdom.unrest || 0) + rng.randInt(15, 30);
            grantXP(40, 'Incited revolt');
            if (player.doubleNobleAgent && kingdom.id === player.doubleNobleAgent.targetKingdomId) _trackDnaTask('incite_unrest');
            Engine.logEvent('Unrest is brewing in ' + kingdom.name + '! Agitators are spreading dissent.');
        }

        var caughtMsg = '';
        if (caught) {
            var fine = applyCorruptPenalty(town, kingdom, 3000, 40, 20, true, 'treason', { isNobleTarget: true });
            recordCorruptAction('incite_revolt', true, (typeof town !== 'undefined' && town ? town.kingdomId : null), 'treason');
            player.notoriety = (player.notoriety || 0) + _trackedNotoriety(30);
            caughtMsg = '🚨 CAUGHT inciting revolt! Fined ' + fine + 'g, jailed 20d, EXILED!';
        } else {
            recordCorruptAction('incite_revolt', false, (typeof town !== 'undefined' && town ? town.kingdomId : null), 'treason');
            player.notoriety = (player.notoriety || 0) + _trackedNotoriety(20);
        }

        return _schemeResult({
            successful: successful, caught: caught,
            successMsg: '🔥 Revolt incited in ' + kingdom.name + '! Stability and prosperity reduced, unrest rising.',
            caughtMsg: caughtMsg,
            partialMsg: 'Revolt incited but you were exposed as the agitator! ' + caughtMsg,
            failMsg: '❌ The agitators failed to gain traction (2000g lost) but no one suspects you.'
        });
    }

    // ── (p7) Double Agent ──
    function activateDoubleAgent(enemyKingdomId) {
        _sync();
        if (isJailed()) return { success: false, message: 'You are in jail.' };
        if (!hasSkill('shadow_dealings')) return { success: false, message: 'Requires Shadow Dealings skill.' };
        if (!player.militaryService || !player.militaryService.active) return { success: false, message: 'Must be actively serving in a kingdom\'s military.' };
        if (player.doubleAgentActive) return { success: false, message: 'Already operating as a double agent.' };

        var myKingdom = Engine.findKingdom ? Engine.findKingdom(player.militaryService.kingdomId) : null;
        var enemyKingdom = Engine.findKingdom ? Engine.findKingdom(enemyKingdomId) : null;
        if (!myKingdom || !enemyKingdom) return { success: false, message: 'Kingdom not found.' };
        if (myKingdom.id === enemyKingdom.id) return { success: false, message: 'Cannot spy for your own kingdom.' };

        // Check if the kingdoms are actually at war or hostile
        var atWar = false;
        if (typeof Engine !== 'undefined' && Engine.getActiveWars) {
            var wars = Engine.getActiveWars();
            for (var wId in wars) {
                var war = wars[wId];
                if ((war.kingdomA === myKingdom.id && war.kingdomB === enemyKingdom.id) || (war.kingdomB === myKingdom.id && war.kingdomA === enemyKingdom.id)) {
                    atWar = true; break;
                }
            }
        }
        if (!atWar) return { success: false, message: 'The kingdoms must be at war.' };

        var town = Engine.findTown(player.townId);
        var rng = Engine.getRng();
        var detection = calculateCorruptDetection(0.30, town);
        var _oda = _rollSchemeOutcome(detection, rng);
        var caught = _oda.caught;
        var successful = _oda.successful;

        var payPerSeason = 0;
        if (successful) {
            payPerSeason = rng.randInt(200, 600);
            player.doubleAgentActive = { enemyKingdomId: enemyKingdomId, startDay: Engine.getDay(), paymentPerSeason: payPerSeason, nextPayDay: Engine.getDay() + 90 };
            grantXP(30, 'Became double agent');
            Engine.logEvent(player.fullName + ' has begun selling military secrets.');
        }

        var caughtMsg = '';
        if (caught) {
            var fine = applyCorruptPenalty(town, myKingdom, 5000, 50, 30, true, 'treason', { isNobleTarget: true });
            recordCorruptAction('double_agent', true, (typeof town !== 'undefined' && town ? town.kingdomId : null), 'treason');
            player.notoriety = (player.notoriety || 0) + _trackedNotoriety(40);
            player.militaryService.active = false;
            caughtMsg = '🚨 TREASON DISCOVERED! Fined ' + fine + 'g, jailed 30d, EXILED, dishonorably discharged!';
        } else {
            recordCorruptAction('double_agent', false, (typeof town !== 'undefined' && town ? town.kingdomId : null), 'treason');
            player.notoriety = (player.notoriety || 0) + _trackedNotoriety(10);
        }

        return _schemeResult({
            successful: successful, caught: caught,
            successMsg: '🕵️ Now operating as a double agent! Selling secrets to ' + enemyKingdom.name + ' for ' + payPerSeason + 'g per season.',
            caughtMsg: caughtMsg,
            partialMsg: 'Made contact with the enemy but their handler turned you in! ' + caughtMsg,
            failMsg: '❌ The enemy handler refused to deal — but no one suspects you.'
        });
    }

    // ── (p8) Protection Racket ──
    function startProtectionRacket(townId) {
        _sync();
        if (isJailed()) return { success: false, message: 'You are in jail.' };
        if (!hasSkill('intimidating_presence') || !hasSkill('shadow_dealings')) return { success: false, message: 'Requires Intimidating Presence + Shadow Dealings skills.' };
        if (!isInTown(townId)) return { success: false, message: 'Must be in the town.' };
        player.protectionRackets = player.protectionRackets || {};
        if (player.protectionRackets[townId]) return { success: false, message: 'Already running a protection racket here.' };

        var town = Engine.findTown(townId);
        if (!town) return { success: false, message: 'Town not found.' };

        var rng = Engine.getRng();
        var detection = calculateCorruptDetection(0.25, town);
        var _opr = _rollSchemeOutcome(detection, rng);
        var caught = _opr.caught;
        var successful = _opr.successful;

        var weeklyPay = 0;
        if (successful) {
            weeklyPay = rng.randInt(20, 60 + Math.floor((town.population || 100) * 0.1));
            player.protectionRackets[townId] = { paymentPerWeek: weeklyPay, lastCollectDay: Engine.getDay(), npcsIntimidated: rng.randInt(2, 6) };
            grantXP(20, 'Started protection racket');
            Engine.logEvent('Local merchants in ' + town.name + ' are being extorted for "protection" money.');
        }

        var caughtMsg = '';
        if (caught) {
            var kingdom = Engine.findKingdom ? Engine.findKingdom(town.kingdomId) : null;
            var fine = applyCorruptPenalty(town, kingdom, 500, 25, 10, false, 'blackmail');
            recordCorruptAction('protection_racket', true, (typeof town !== 'undefined' && town ? town.kingdomId : null), 'blackmail');
            player.notoriety = (player.notoriety || 0) + _trackedNotoriety(15);
            caughtMsg = '🚨 CAUGHT! Fined ' + fine + 'g, jailed 10d.';
        } else {
            recordCorruptAction('protection_racket', false, (typeof town !== 'undefined' && town ? town.kingdomId : null), 'blackmail');
            player.notoriety = (player.notoriety || 0) + _trackedNotoriety(10);
        }

        return _schemeResult({
            successful: successful, caught: caught,
            successMsg: '💪 Protection racket established in ' + town.name + '! Collecting ' + weeklyPay + 'g/week.',
            caughtMsg: caughtMsg,
            partialMsg: 'Racket established but a victim went to the guards! ' + caughtMsg,
            failMsg: '❌ The merchants refused to pay — but no one reported you.'
        });
    }

    function layLow() {
        _sync();
        if (isJailed()) return { success: false, message: 'You are in jail.' };
        if ((player.notoriety || 0) <= 0) return { success: false, message: 'Your notoriety is already at zero.' };
        if (player.notorietyReduction) return { success: false, message: 'Already working on reducing notoriety. Wait for "' + player.notorietyReduction.type.replace(/_/g, ' ') + '" to finish.' };
        var cost = 1500;
        if (player.gold < cost) return { success: false, message: 'Need ' + cost + 'g. You have ' + Math.floor(player.gold) + 'g.' };
        var rng = Engine.getRng();
        var day = Engine.getDay();
        var duration = rng ? rng.randInt(30, 60) : 45;
        var totalReduction = Math.min(player.notoriety || 0, rng ? rng.randInt(25, 45) : 35);
        var dailyReduction = totalReduction / duration;
        player.gold -= cost;
        player.notorietyReduction = { type: 'lay_low', startDay: day, endDay: day + duration, dailyReduction: dailyReduction, totalPlanned: totalReduction };
        Engine.logEvent(player.fullName + ' is paying ' + cost + 'g to lay low and let the heat die down.');
        if (typeof UI !== 'undefined' && UI.toast) UI.toast('🕶️ Laying low... Notoriety will drop by ~' + Math.floor(totalReduction) + ' over ' + duration + ' days. Cost: ' + cost + 'g.', 'success', 'my_business');
        return { success: true, message: '🕶️ Laying low for ' + duration + ' days. Notoriety will drop by ~' + Math.floor(totalReduction) + '. Cost: ' + cost + 'g.' };
    }

    // v9p33river197: JAILBREAK SCHEME
    // Break a target NPC out of a town's jail. Base 5% success.
    // Modifiers (player skills): jail_break +20%, shadow_dealings +15%,
    // discrete +10%, master_disguise +10%, ghost +20%, lockpick +15%
    // Town security reduces success by (security/100 * 0.50).
    // Notoriety > 50 reduces success by 0.10. Caught = arson-tier penalty
    // (jail + fine in current town), success = freed NPC + +10 player notoriety.
    function canJailbreak() {
        _sync();
        if (isJailed()) return false;
        return hasSkill('jail_break') || hasSkill('shadow_dealings') || hasSkill('master_forger') || hasSkill('ghost');
    }
    function attemptJailbreak(targetNpcId, townId) {
        _sync();
        if (isJailed()) return { success: false, message: 'You are in jail yourself.' };
        if (!canJailbreak()) return { success: false, message: 'Requires Jail Break, Shadow Dealings, Master Forger, or Ghost skill.' };
        if (!isInTown(townId)) return { success: false, message: 'You must be in the town to attempt a jailbreak there.' };

        var town = Engine.findTown(townId);
        if (!town) return { success: false, message: 'Town not found.' };
        var kingdom = Engine.findKingdom ? Engine.findKingdom(town.kingdomId) : null;
        var target = Engine.findPerson ? Engine.findPerson(targetNpcId) : null;
        if (!target || !target.alive) return { success: false, message: 'Target not found.' };
        var day = Engine.getDay ? Engine.getDay() : 0;
        if (!target._jailedUntilDay || target._jailedUntilDay <= day) return { success: false, message: target.firstName + ' is not currently jailed.' };
        if (target.townId !== townId) return { success: false, message: target.firstName + ' is not jailed in this town.' };

        var rng = Engine.getRng();
        if (!rng) return { success: false, message: 'No RNG.' };

        // Base success 5%
        var success = 0.05;
        if (hasSkill('jail_break')) success += 0.20;
        if (hasSkill('shadow_dealings')) success += 0.15;
        if (hasSkill('discrete')) success += 0.10;
        if (hasSkill('master_disguise')) success += 0.10;
        if (hasSkill('ghost')) success += 0.20;
        if (hasSkill('master_forger')) success += 0.10;
        if (hasSkill('untouchable')) success += 0.10;
        // Town security drag: 0% sec → +0, 100% sec → -50%
        success -= ((town.security || 50) / 100) * 0.50;
        // Notoriety drag
        if ((player.notoriety || 0) >= 50) success -= 0.10;
        // Nighttime bonus
        var w = Engine.getWorld ? Engine.getWorld() : null;
        var hr = w ? (w.hour || 12) : 12;
        if (hr >= 20 || hr <= 5) success += 0.10;
        success = Math.max(0.02, Math.min(0.90, success));

        if (typeof Game !== 'undefined' && Game.advanceTicks) Game.advanceTicks(8);

        if (rng.random() < success) {
            // Success: free the NPC, bump player notoriety + town crime
            target._jailedUntilDay = 0;
            target._jailedCrimeId = null; // v9p33river264
            player.notoriety = Math.min(100, (player.notoriety || 0) + 10);
            town.crime = Math.min(100, (town.crime || 0) + 3);
            recordCorruptAction('jailbreak', false, (typeof town !== 'undefined' && town ? town.kingdomId : null), 'sabotage');

            // v9p33river199: massive relationship boost + reset all favor
            // cooldowns with the rescued NPC (you literally saved them).
            player.relationships = player.relationships || {};
            var existing = player.relationships[targetNpcId] || { level: 0, type: 'acquaintance' };
            var oldRel = existing.level || 0;
            var newRel;
            if (oldRel >= 50) {
                newRel = Math.min(100, oldRel + 20);
            } else {
                newRel = Math.max(60, oldRel);
            }
            existing.level = newRel;
            existing.lastInteraction = day;
            player.relationships[targetNpcId] = existing;
            // Reset every per-NPC cooldown so the rescued NPC is immediately
            // available for asks/favors/intros/etc.
            try {
                if (player._npcInteractions) delete player._npcInteractions[targetNpcId];
                if (player._npcGossipCooldowns) delete player._npcGossipCooldowns[targetNpcId];
                if (player._nobleFavorRequests) delete player._nobleFavorRequests[targetNpcId];
                if (player.introductionCooldowns) delete player.introductionCooldowns[targetNpcId];
                if (player._npcJobCooldowns) {
                    var prefix = targetNpcId + '_';
                    for (var ck in player._npcJobCooldowns) {
                        if (ck === targetNpcId || ck.indexOf(prefix) === 0) delete player._npcJobCooldowns[ck];
                    }
                }
                if (player._lastInteractionDay) delete player._lastInteractionDay[targetNpcId];
                if (player._nobleVoteSupport) delete player._nobleVoteSupport[targetNpcId];
            } catch(_e) {}

            Engine.logEvent('🔓 ' + player.fullName + ' broke ' + target.firstName + ' ' + (target.lastName || '') + ' out of jail in ' + town.name + '! Relationship: ' + Math.round(oldRel) + ' → ' + Math.round(newRel) + '. (+10 notoriety)');
            if (typeof UI !== 'undefined' && UI.toast) UI.toast('🔓 Jailbreak successful! ' + target.firstName + ' is free. Relationship → ' + Math.round(newRel) + '. (+10 notoriety)', 'success', 'my_business');
            return { success: true, message: 'Jailbreak successful — ' + target.firstName + ' is free. Relationship +' + Math.round(newRel - oldRel) + '.' };
        } else {
            // Caught: roll detection (separate from success)
            var detected = rng.chance(calculateCorruptDetection(0.55, town));
            recordCorruptAction('jailbreak', detected, (typeof town !== 'undefined' && town ? town.kingdomId : null), 'sabotage');
            if (detected) {
                var actualFine = applyCorruptPenalty(town, kingdom, 800, 25, 14, false, 'sabotage');
                Engine.logEvent('⛓️ ' + player.fullName + ' caught attempting jailbreak in ' + town.name + ' — fined ' + actualFine + 'g, jailed 14 days.');
                if (typeof UI !== 'undefined' && UI.toast) UI.toast('⛓️ Jailbreak failed and you were caught! Fined ' + actualFine + 'g, jailed.', 'danger', 'my_business');
                return { success: false, message: 'Jailbreak failed — you were caught and jailed.' };
            }
            Engine.logEvent('🚪 ' + player.fullName + '\'s jailbreak attempt failed but they slipped away unnoticed.');
            if (typeof UI !== 'undefined' && UI.toast) UI.toast('🚪 Jailbreak failed but you escaped detection.', 'warning', 'my_business');
            return { success: false, message: 'Jailbreak failed — you escaped without being caught.' };
        }
    }

    function cleanseIdentity() {
        _sync();
        if (isJailed()) return { success: false, message: 'You are in jail.' };
        if ((player.notoriety || 0) <= 0) return { success: false, message: 'Your notoriety is already at zero.' };
        if (player.notorietyReduction) return { success: false, message: 'Already working on reducing notoriety. Wait for "' + player.notorietyReduction.type.replace(/_/g, ' ') + '" to finish.' };
        if (!hasSkill('master_forger') && !hasSkill('silver_tongue_dark') && !hasSkill('discrete')) {
            return { success: false, message: 'Requires Master Forger, Silver Tongue (Dark), or Discrete skill.' };
        }
        var cost = 400;
        // Skill combo discounts
        var skillCount = 0;
        if (hasSkill('master_forger')) skillCount++;
        if (hasSkill('silver_tongue_dark')) skillCount++;
        if (hasSkill('discrete')) skillCount++;
        if (skillCount >= 3) cost = 200;
        else if (skillCount >= 2) cost = 300;
        if (player.gold < cost) return { success: false, message: 'Need ' + cost + 'g. You have ' + Math.floor(player.gold) + 'g.' };
        var rng = Engine.getRng();
        var day = Engine.getDay();
        var duration = rng ? rng.randInt(7, 14) : 10;
        // More skills = more reduction
        var baseReduction = rng ? rng.randInt(20, 35) : 27;
        if (skillCount >= 3) baseReduction = rng ? rng.randInt(35, 50) : 42;
        else if (skillCount >= 2) baseReduction = rng ? rng.randInt(25, 40) : 32;
        var totalReduction = Math.min(player.notoriety || 0, baseReduction);
        var dailyReduction = totalReduction / duration;
        player.gold -= cost;
        player.notorietyReduction = { type: 'cleanse_identity', startDay: day, endDay: day + duration, dailyReduction: dailyReduction, totalPlanned: totalReduction };
        var skillNames = [];
        if (hasSkill('master_forger')) skillNames.push('forged records');
        if (hasSkill('silver_tongue_dark')) skillNames.push('smooth talking');
        if (hasSkill('discrete')) skillNames.push('discretion');
        Engine.logEvent(player.fullName + ' is using ' + skillNames.join(' & ') + ' to cleanse their identity.');
        if (typeof UI !== 'undefined' && UI.toast) UI.toast('🧹 Cleansing identity using ' + skillNames.join(' & ') + '! Notoriety -' + Math.floor(totalReduction) + ' over ' + duration + ' days. Cost: ' + cost + 'g.', 'success', 'my_business');
        return { success: true, message: '🧹 Cleansing identity over ' + duration + ' days. Notoriety will drop by ~' + Math.floor(totalReduction) + '. Cost: ' + cost + 'g.' };
    }

    // ══════════════════════════════════════════════════════
    // §N1 NOBLE INTRIGUE SCHEMES
    // ══════════════════════════════════════════════════════

    function _getKingdomNobles(kingdomId) {
        var towns = Engine.getWorld ? Engine.getWorld().towns : [];
        var nobles = [];
        for (var ti = 0; ti < towns.length; ti++) {
            if (towns[ti].kingdomId !== kingdomId) continue;
            var people = Engine.getPeople ? Engine.getPeople(towns[ti].id) : [];
            if (!people) continue;
            for (var pi = 0; pi < people.length; pi++) {
                var p = people[pi];
                if (p.alive && (p.occupation === 'noble' || p.isNoble) && !p.isKing) nobles.push(p);
            }
        }
        return nobles;
    }

    function _getNobleInfluenceBonus(nobleId) {
        var bonus = 0;
        var rel = getRelationship(nobleId);
        if (rel && rel.level >= 60) bonus += 0.10;
        if (rel && rel.level >= 80) bonus += 0.10;
        // Loan leverage
        var loans = player._nobleLoans || [];
        for (var li = 0; li < loans.length; li++) {
            if (loans[li].nobleId === nobleId && loans[li].status === 'active') { bonus += 0.15; break; }
        }
        // Blackmail leverage
        if (player.blackmailTargets && player.blackmailTargets[nobleId]) bonus += 0.20;
        return bonus;
    }

    function _trackDnaTask(taskId, amount) {
        if (!player.doubleNobleAgent) return;
        if (!player._dnaTaskProgress) player._dnaTaskProgress = {};
        player._dnaTaskProgress[taskId] = (player._dnaTaskProgress[taskId] || 0) + (amount || 1);
    }

    // (N1a) Pit Nobles Against Each Other — make two nobles rivals
    function pitNoblesAgainstEachOther(nobleAId, nobleBId) {
        _sync();
        if (isJailed()) return { success: false, message: 'You are in jail.' };
        if (!hasSkill('silver_tongue_dark') && !hasSkill('kingmaker_skill')) return { success: false, message: 'Requires Silver Tongue (Dark) or Kingmaker skill.' };
        var myRank = 0;
        var town = Engine.findTown(player.townId);
        var kingdom = town ? Engine.findKingdom(town.kingdomId) : null;
        if (kingdom) myRank = player.socialRank[kingdom.id] || 0;
        if (myRank < 4) return { success: false, message: 'You must be at least a Minor Noble to engage in noble intrigue.' };

        if (player.gold < 300) return { success: false, message: 'Need 300g to orchestrate this scheme.' };
        var nobleA = Engine.findPerson ? Engine.findPerson(nobleAId) : null;
        var nobleB = Engine.findPerson ? Engine.findPerson(nobleBId) : null;
        if (!nobleA || !nobleA.alive || !nobleB || !nobleB.alive) return { success: false, message: 'Both nobles must be alive.' };
        if (nobleAId === nobleBId) return { success: false, message: 'Must select two different nobles.' };

        // Foreign kingdom cost multiplier
        var isForeign = kingdom && kingdom.id !== player.citizenshipKingdomId;
        var isAtWar = isForeign && _areKingdomsAtWar(player.citizenshipKingdomId, kingdom.id);
        var costMultiplier = isAtWar ? 4 : (isForeign ? 2 : 1);
        var adjustedCost = 300 * costMultiplier;
        if (player.gold < adjustedCost) return { success: false, message: 'Need ' + adjustedCost + 'g to orchestrate this scheme.' + (isForeign ? ' (foreign kingdom penalty)' : '') };

        // M1: Cooldown check
        var _cdA = _checkSchemeCooldown('pit_nobles', nobleAId);
        var _cdB = _checkSchemeCooldown('pit_nobles', nobleBId);
        if (_cdA.blocked) return { success: false, message: 'You must wait ' + _cdA.daysLeft + ' more days before targeting ' + nobleA.firstName + ' again.' };
        if (_cdB.blocked) return { success: false, message: 'You must wait ' + _cdB.daysLeft + ' more days before targeting ' + nobleB.firstName + ' again.' };

        var rng = Engine.getRng();
        var detection = calculateCorruptDetection(0.25, town);
        // M6: Escalating detection for repeat targeting
        detection += _getRepeatTargetPenalty(nobleAId) + _getRepeatTargetPenalty(nobleBId);
        // Foreign kingdom detection increase
        if (isForeign) detection += 0.15;
        if (isAtWar) detection += 0.10;
        detection = Math.min(0.95, detection);

        // Influence bonuses from having nobles in your pocket
        var bonusA = _getNobleInfluenceBonus(nobleAId);
        var bonusB = _getNobleInfluenceBonus(nobleBId);
        var totalBonus = bonusA + bonusB;
        var baseSuccess = 0.35;
        if (hasSkill('kingmaker_skill')) baseSuccess += 0.10;
        if (hasSkill('silver_tongue_dark')) baseSuccess += 0.10;
        var successChance = Math.min(0.90, baseSuccess + totalBonus);

        player.gold -= adjustedCost;
        if (typeof Game !== 'undefined' && Game.advanceTicks) Game.advanceTicks(CONFIG.ACTION_TICK_COSTS.scheme || 4);

        if (rng && rng.chance(detection)) {
            applyCorruptPenalty(town, kingdom, 500, 15, 0, false, 'blackmail', { isNobleTarget: true });
            recordCorruptAction('pit_nobles', true, (typeof town !== 'undefined' && town ? town.kingdomId : null), 'blackmail');
            player.notoriety = (player.notoriety || 0) + _trackedNotoriety(10);
            var _nnResult = _addNobleNotorietyAndCheck(CONFIG.NOBLE_NOTORIETY_DIRECT_NOBLE_ADD || 20, 'manipulating nobles');
            modifyRelationship(nobleAId, -20);
            modifyRelationship(nobleBId, -20);
            _recordSchemeTarget(nobleAId); _recordSchemeTarget(nobleBId);
            _setSchemeCooldown('pit_nobles', nobleAId, 14);
            _setSchemeCooldown('pit_nobles', nobleBId, 14);
            // Foreign kingdom: harsher caught penalties
            if (isForeign) {
                var extraJail = isAtWar ? 14 : 5;
                player.jailedUntilDay = Math.max(player.jailedUntilDay || 0, Engine.getDay() + extraJail);
                player.nobleNotoriety = Math.min(100, (player.nobleNotoriety || 0) + (isAtWar ? 15 : 8));
                if (isAtWar && rng && rng.chance(0.15)) {
                    player.gold = Math.max(0, player.gold - 5000);
                    player.jailedUntilDay = Engine.getDay() + 30;
                    Engine.logEvent('⚔️ ' + player.fullName + ' was nearly executed as a spy! Massive fine and extended imprisonment.');
                }
            }
            var _nnMsg = _nnResult && _nnResult.punished ? ' ' + _nnResult.message : '';
            var _cMsg = '🚨 CAUGHT! ' + nobleA.firstName + ' and ' + nobleB.firstName + ' realized your manipulation. -500g fine, -20 relationship with both.' + _nnMsg;
            _logSchemeOutcome('pit_nobles', nobleA.firstName + ' & ' + nobleB.firstName, false, true, _cMsg);
            return { success: false, caught: true, message: _cMsg };
        }

        if (rng && rng.chance(successChance)) {
            if (!nobleA._nobleRelationships) nobleA._nobleRelationships = {};
            if (!nobleB._nobleRelationships) nobleB._nobleRelationships = {};
            var damage = rng.randInt(15, 30);
            nobleA._nobleRelationships[nobleBId] = Math.max(-100, (nobleA._nobleRelationships[nobleBId] || 0) - damage);
            nobleB._nobleRelationships[nobleAId] = Math.max(-100, (nobleB._nobleRelationships[nobleAId] || 0) - damage);
            recordCorruptAction('pit_nobles', false, (typeof town !== 'undefined' && town ? town.kingdomId : null), 'blackmail');
            grantXP(20, 'Pitted nobles against each other');
            player.notoriety = (player.notoriety || 0) + _trackedNotoriety(5);
            _trackDnaTask('pit_two_nobles');
            _setSchemeCooldown('pit_nobles', nobleAId, 10);
            _setSchemeCooldown('pit_nobles', nobleBId, 10);
            _recordSchemeTarget(nobleAId); _recordSchemeTarget(nobleBId);
            var _msg = '🗡️ Successfully pitted ' + nobleA.firstName + ' against ' + nobleB.firstName + '! Their relationship dropped by ' + damage + '. (' + Math.round(successChance * 100) + '% chance)';
            _logSchemeOutcome('pit_nobles', nobleA.firstName + ' & ' + nobleB.firstName, true, false, _msg);
            Engine.logEvent('🗡️ Tensions rise between ' + nobleA.firstName + ' and ' + nobleB.firstName + '.');
            // Notify story mode — relationship damage between nobles
            if (typeof StoryMode !== 'undefined' && StoryMode.onPlayerAction) {
                StoryMode.onPlayerAction('noble_intrigue', { relationshipDamage: damage * 2, targetKingdomId: kingdom.id, nobleId: nobleAId });
            }
            return { success: true, message: _msg };
        }

        _setSchemeCooldown('pit_nobles', nobleAId, 7);
        _setSchemeCooldown('pit_nobles', nobleBId, 7);
        recordCorruptAction('pit_nobles', false, (typeof town !== 'undefined' && town ? town.kingdomId : null), 'blackmail');
        player.notoriety = (player.notoriety || 0) + _trackedNotoriety(2);
        var _failMsg = 'Your scheming didn\'t take hold. ' + nobleA.firstName + ' and ' + nobleB.firstName + ' saw through the manipulation. (' + Math.round(successChance * 100) + '% chance)';
        _logSchemeOutcome('pit_nobles', nobleA.firstName + ' & ' + nobleB.firstName, false, false, _failMsg);
        return { success: false, message: _failMsg };
    }

    // (N1b) Turn Noble Against King — undermine a noble's loyalty
    function turnNobleAgainstKing(nobleId) {
        _sync();
        if (isJailed()) return { success: false, message: 'You are in jail.' };
        if (!hasSkill('kingmaker_skill')) return { success: false, message: 'Requires Kingmaker skill.' };
        var town = Engine.findTown(player.townId);
        var kingdom = town ? Engine.findKingdom(town.kingdomId) : null;
        if (!kingdom) return { success: false, message: 'Not in a kingdom.' };
        var myRank = player.socialRank[kingdom.id] || 0;
        if (myRank < 4) return { success: false, message: 'You must be at least a Minor Noble to engage in noble intrigue.' };
        if (player.gold < 500) return { success: false, message: 'Need 500g to fund this campaign.' };
        var noble = Engine.findPerson ? Engine.findPerson(nobleId) : null;
        if (!noble || !noble.alive) return { success: false, message: 'Noble not found or dead.' };

        // Foreign kingdom cost multiplier
        var isForeign = kingdom && kingdom.id !== player.citizenshipKingdomId;
        var isAtWar = isForeign && _areKingdomsAtWar(player.citizenshipKingdomId, kingdom.id);
        var costMultiplier = isAtWar ? 4 : (isForeign ? 2 : 1);
        var adjustedCost = 500 * costMultiplier;
        if (player.gold < adjustedCost) return { success: false, message: 'Need ' + adjustedCost + 'g to fund this campaign.' + (isForeign ? ' (foreign kingdom penalty)' : '') };

        // M1: Cooldown check
        var _cd = _checkSchemeCooldown('turn_noble', nobleId);
        if (_cd.blocked) return { success: false, message: 'You must wait ' + _cd.daysLeft + ' more days before targeting ' + noble.firstName + ' again.' };

        var rng = Engine.getRng();
        var detection = calculateCorruptDetection(0.30, town);
        detection += _getRepeatTargetPenalty(nobleId); // M6
        // Foreign kingdom detection increase
        if (isForeign) detection += 0.15;
        if (isAtWar) detection += 0.10;
        detection = Math.min(0.95, detection);
        var influenceBonus = _getNobleInfluenceBonus(nobleId);
        var baseSuccess = 0.25;
        if (hasSkill('silver_tongue_dark')) baseSuccess += 0.10;
        // Noble's personality affects susceptibility
        if (noble.personality) {
            if (noble.personality.ambition > 0.6) baseSuccess += 0.10;
            if (noble.personality.loyalty !== undefined && noble.personality.loyalty < 0.4) baseSuccess += 0.10;
            if (noble.personality.greed > 0.6) baseSuccess += 0.05;
        }
        var successChance = Math.min(0.85, baseSuccess + influenceBonus);

        // Find the king first — refund if not found (H4 fix)
        var king = null;
        var people = Engine.getPeople ? Engine.getPeople(noble.townId || town.id) : [];
        if (people) {
            for (var ki = 0; ki < people.length; ki++) {
                if (people[ki].isKing) { king = people[ki]; break; }
            }
        }
        if (!king) {
            var kTowns = Engine.getWorld ? Engine.getWorld().towns.filter(function(t) { return t.kingdomId === kingdom.id; }) : [];
            for (var kti = 0; kti < kTowns.length && !king; kti++) {
                var kp = Engine.getPeople(kTowns[kti].id);
                if (kp) for (var kpi = 0; kpi < kp.length; kpi++) { if (kp[kpi].isKing) { king = kp[kpi]; break; } }
            }
        }
        if (!king) {
            return { success: false, message: 'The kingdom has no king to undermine. Gold refunded.' };
        }

        player.gold -= adjustedCost;
        if (typeof Game !== 'undefined' && Game.advanceTicks) Game.advanceTicks(CONFIG.ACTION_TICK_COSTS.scheme || 4);

        if (rng && rng.chance(detection)) {
            applyCorruptPenalty(town, kingdom, 1000, 25, 5, false, 'treason', { kingdomRepLoss: 5 });
            recordCorruptAction('turn_noble_against_king', true, (typeof town !== 'undefined' && town ? town.kingdomId : null), 'treason');
            player.notoriety = (player.notoriety || 0) + _trackedNotoriety(15);
            var _nnResult = _addNobleNotorietyAndCheck(CONFIG.NOBLE_NOTORIETY_DIRECT_NOBLE_ADD || 20, 'turning a noble against the king');
            modifyRelationship(nobleId, -15);
            _recordSchemeTarget(nobleId);
            _setSchemeCooldown('turn_noble', nobleId, 14);
            // Foreign kingdom: harsher caught penalties
            if (isForeign) {
                var extraJail = isAtWar ? 14 : 5;
                player.jailedUntilDay = Math.max(player.jailedUntilDay || 0, Engine.getDay() + extraJail);
                player.nobleNotoriety = Math.min(100, (player.nobleNotoriety || 0) + (isAtWar ? 15 : 8));
                if (isAtWar && rng && rng.chance(0.15)) {
                    player.gold = Math.max(0, player.gold - 5000);
                    player.jailedUntilDay = Engine.getDay() + 30;
                    Engine.logEvent('⚔️ ' + player.fullName + ' was nearly executed as a spy! Massive fine and extended imprisonment.');
                }
            }
            var _nnMsg = _nnResult && _nnResult.punished ? ' ' + _nnResult.message : '';
            var _cMsg = '🚨 CAUGHT trying to turn ' + noble.firstName + ' against the king! Fined 1000g, jailed 5 days, -25 rep, -15 relationship.' + _nnMsg;
            _logSchemeOutcome('turn_noble', noble.firstName, false, true, _cMsg);
            return { success: false, caught: true, message: _cMsg };
        }

        if (rng && rng.chance(successChance)) {
            if (king) {
                if (!noble._nobleRelationships) noble._nobleRelationships = {};
                var loyaltyDrop = rng.randInt(15, 30);
                noble._nobleRelationships[king.id] = Math.max(-100, (noble._nobleRelationships[king.id] || 0) - loyaltyDrop);
                noble.kingLoyalty = Math.max(0, (noble.kingLoyalty || 50) - loyaltyDrop);
                modifyRelationship(nobleId, 5);
                recordCorruptAction('turn_noble_against_king', false, (typeof town !== 'undefined' && town ? town.kingdomId : null), 'treason');
                grantXP(25, 'Turned noble against king');
                player.notoriety = (player.notoriety || 0) + _trackedNotoriety(8);
                _trackDnaTask('turn_noble_king');
                _setSchemeCooldown('turn_noble', nobleId, 14);
                _recordSchemeTarget(nobleId);
                var _sMsg = '🏴 ' + noble.firstName + ' is now more disillusioned with the king! Loyalty dropped by ' + loyaltyDrop + '. (' + Math.round(successChance * 100) + '% chance)';
                _logSchemeOutcome('turn_noble', noble.firstName, true, false, _sMsg);
                Engine.logEvent('🏴 ' + noble.firstName + '\'s loyalty to the crown wavers.');
                // Notify story mode of loyalty reduction
                if (typeof StoryMode !== 'undefined' && StoryMode.onPlayerAction) {
                    StoryMode.onPlayerAction('noble_intrigue', { loyaltyReduced: loyaltyDrop, targetKingdomId: kingdom.id, nobleId: nobleId });
                }
                return { success: true, message: _sMsg };
            }
        }

        _setSchemeCooldown('turn_noble', nobleId, 7);
        recordCorruptAction('turn_noble_against_king', false, (typeof town !== 'undefined' && town ? town.kingdomId : null), 'treason');
        player.notoriety = (player.notoriety || 0) + _trackedNotoriety(3);
        var _fMsg = noble.firstName + ' remains loyal to the crown. Your persuasion failed. (' + Math.round(successChance * 100) + '% chance)';
        _logSchemeOutcome('turn_noble', noble.firstName, false, false, _fMsg);
        return { success: false, message: _fMsg };
    }

    // (N1c) Discredit Noble — damage a noble's standing with the king and court
    function discreditNoble(nobleId) {
        _sync();
        if (isJailed()) return { success: false, message: 'You are in jail.' };
        if (!hasSkill('shadow_dealings') && !hasSkill('silver_tongue_dark')) return { success: false, message: 'Requires Shadow Dealings or Silver Tongue (Dark).' };
        var town = Engine.findTown(player.townId);
        var kingdom = town ? Engine.findKingdom(town.kingdomId) : null;
        if (!kingdom) return { success: false, message: 'Not in a kingdom.' };
        var myRank = player.socialRank[kingdom.id] || 0;
        if (myRank < 4) return { success: false, message: 'You must be at least a Minor Noble.' };
        if (player.gold < 400) return { success: false, message: 'Need 400g to spread misinformation.' };
        var noble = Engine.findPerson ? Engine.findPerson(nobleId) : null;
        if (!noble || !noble.alive) return { success: false, message: 'Noble not found or dead.' };

        // Foreign kingdom cost multiplier
        var isForeign = kingdom && kingdom.id !== player.citizenshipKingdomId;
        var isAtWar = isForeign && _areKingdomsAtWar(player.citizenshipKingdomId, kingdom.id);
        var costMultiplier = isAtWar ? 4 : (isForeign ? 2 : 1);
        var adjustedCost = 400 * costMultiplier;
        if (player.gold < adjustedCost) return { success: false, message: 'Need ' + adjustedCost + 'g to spread misinformation.' + (isForeign ? ' (foreign kingdom penalty)' : '') };

        var _cd = _checkSchemeCooldown('discredit', nobleId);
        if (_cd.blocked) return { success: false, message: 'You must wait ' + _cd.daysLeft + ' more days before targeting ' + noble.firstName + ' again.' };

        var rng = Engine.getRng();
        var detection = calculateCorruptDetection(0.25, town);
        detection += _getRepeatTargetPenalty(nobleId);
        // Foreign kingdom detection increase
        if (isForeign) detection += 0.15;
        if (isAtWar) detection += 0.10;
        detection = Math.min(0.95, detection);
        var influenceBonus = _getNobleInfluenceBonus(nobleId);
        var baseSuccess = 0.30;
        if (hasSkill('master_forger')) baseSuccess += 0.15; // forged evidence
        if (hasSkill('silver_tongue_dark')) baseSuccess += 0.10;
        if (hasSkill('shadow_dealings')) baseSuccess += 0.05;
        var successChance = Math.min(0.85, baseSuccess + influenceBonus);

        player.gold -= adjustedCost;
        if (typeof Game !== 'undefined' && Game.advanceTicks) Game.advanceTicks(CONFIG.ACTION_TICK_COSTS.scheme || 4);

        if (rng && rng.chance(detection)) {
            applyCorruptPenalty(town, kingdom, 600, 20, 0, false, 'forgery', { isNobleTarget: true });
            recordCorruptAction('discredit_noble', true, (typeof town !== 'undefined' && town ? town.kingdomId : null), 'forgery');
            player.notoriety = (player.notoriety || 0) + _trackedNotoriety(12);
            var _nnResult = _addNobleNotorietyAndCheck(CONFIG.NOBLE_NOTORIETY_DIRECT_NOBLE_ADD || 20, 'discrediting a noble');
            modifyRelationship(nobleId, -25);
            _recordSchemeTarget(nobleId);
            _setSchemeCooldown('discredit', nobleId, 14);
            // Foreign kingdom: harsher caught penalties
            if (isForeign) {
                var extraJail = isAtWar ? 14 : 5;
                player.jailedUntilDay = Math.max(player.jailedUntilDay || 0, Engine.getDay() + extraJail);
                player.nobleNotoriety = Math.min(100, (player.nobleNotoriety || 0) + (isAtWar ? 15 : 8));
                if (isAtWar && rng && rng.chance(0.15)) {
                    player.gold = Math.max(0, player.gold - 5000);
                    player.jailedUntilDay = Engine.getDay() + 30;
                    Engine.logEvent('⚔️ ' + player.fullName + ' was nearly executed as a spy! Massive fine and extended imprisonment.');
                }
            }
            var _nnMsg = _nnResult && _nnResult.punished ? ' ' + _nnResult.message : '';
            var _cMsg = '🚨 CAUGHT trying to discredit ' + noble.firstName + '! -600g fine, -20 rep, ' + noble.firstName + ' despises you (-25 relationship).' + _nnMsg;
            _logSchemeOutcome('discredit', noble.firstName, false, true, _cMsg);
            return { success: false, caught: true, message: _cMsg };
        }

        if (rng && rng.chance(successChance)) {
            if (noble.socialRank && noble.socialRank[kingdom.id] !== undefined) {
                var nobles = _getKingdomNobles(kingdom.id);
                for (var ni = 0; ni < nobles.length; ni++) {
                    if (nobles[ni].id === nobleId) continue;
                    if (!nobles[ni]._nobleRelationships) nobles[ni]._nobleRelationships = {};
                    nobles[ni]._nobleRelationships[nobleId] = Math.max(-100, (nobles[ni]._nobleRelationships[nobleId] || 0) - rng.randInt(5, 15));
                }
            }
            if (noble.reputation === undefined) noble.reputation = {};
            var repDrop = rng.randInt(10, 20);
            noble.reputation[kingdom.id] = Math.max(0, (noble.reputation[kingdom.id] || 50) - repDrop);
            // Discrediting lowers how loyal the king *perceives* the noble to be
            var perceivedDrop = rng.randInt(8, 15);
            noble.perceivedKingLoyalty = Math.max(0, (noble.perceivedKingLoyalty !== undefined ? noble.perceivedKingLoyalty : (noble.kingLoyalty || 50)) - perceivedDrop);

            recordCorruptAction('discredit_noble', false, (typeof town !== 'undefined' && town ? town.kingdomId : null), 'forgery');
            grantXP(20, 'Discredited noble');
            player.notoriety = (player.notoriety || 0) + _trackedNotoriety(6);
            _trackDnaTask('discredit_noble');
            _setSchemeCooldown('discredit', nobleId, 10);
            _recordSchemeTarget(nobleId);
            var _sMsg = '📜 Successfully discredited ' + noble.firstName + '! Their standing with the court has dropped. (' + Math.round(successChance * 100) + '% chance)';
            _logSchemeOutcome('discredit', noble.firstName, true, false, _sMsg);
            Engine.logEvent('📜 Rumors about ' + noble.firstName + '\'s incompetence spread through the court.');
            // Notify story mode — perceived loyalty and reputation damage
            if (typeof StoryMode !== 'undefined' && StoryMode.onPlayerAction) {
                StoryMode.onPlayerAction('noble_intrigue', { perceivedLoyaltyReduced: perceivedDrop, relationshipDamage: repDrop, targetKingdomId: kingdom.id, nobleId: nobleId });
            }
            return { success: true, message: _sMsg };
        }

        _setSchemeCooldown('discredit', nobleId, 7);
        recordCorruptAction('discredit_noble', false, (typeof town !== 'undefined' && town ? town.kingdomId : null), 'forgery');
        player.notoriety = (player.notoriety || 0) + _trackedNotoriety(2);
        var _fMsg = 'Your misinformation campaign failed to gain traction. (' + Math.round(successChance * 100) + '% chance)';
        _logSchemeOutcome('discredit', noble.firstName, false, false, _fMsg);
        return { success: false, message: _fMsg };
    }

    // (N1d) Manipulate Noble's Vote — sway a noble's position on a proposal
    function manipulateNobleVote(nobleId, proposalType) {
        _sync();
        if (isJailed()) return { success: false, message: 'You are in jail.' };
        if (!hasSkill('silver_tongue_dark') && !hasSkill('kingmaker_skill')) return { success: false, message: 'Requires Silver Tongue (Dark) or Kingmaker skill.' };
        var town = Engine.findTown(player.townId);
        var kingdom = town ? Engine.findKingdom(town.kingdomId) : null;
        if (!kingdom) return { success: false, message: 'Not in a kingdom.' };
        var myRank = player.socialRank[kingdom.id] || 0;
        if (myRank < 4) return { success: false, message: 'You must be at least a Minor Noble.' };
        if (player.gold < 200) return { success: false, message: 'Need 200g for bribes and favors.' };
        var noble = Engine.findPerson ? Engine.findPerson(nobleId) : null;
        if (!noble || !noble.alive) return { success: false, message: 'Noble not found or dead.' };

        var _cd = _checkSchemeCooldown('manipulate_vote', nobleId);
        if (_cd.blocked) return { success: false, message: 'You must wait ' + _cd.daysLeft + ' more days before targeting ' + noble.firstName + ' again.' };

        var rng = Engine.getRng();
        var detection = calculateCorruptDetection(0.15, town);
        detection += _getRepeatTargetPenalty(nobleId);
        var influenceBonus = _getNobleInfluenceBonus(nobleId);
        var baseSuccess = 0.35;
        if (hasSkill('kingmaker_skill')) baseSuccess += 0.15;
        if (hasSkill('silver_tongue_dark')) baseSuccess += 0.10;
        if (hasSkill('bribe_expert')) baseSuccess += 0.10;
        var successChance = Math.min(0.90, baseSuccess + influenceBonus);

        player.gold -= 200;
        if (typeof Game !== 'undefined' && Game.advanceTicks) Game.advanceTicks(CONFIG.ACTION_TICK_COSTS.scheme || 4);

        if (rng && rng.chance(detection)) {
            applyCorruptPenalty(town, kingdom, 300, 10, 0, false, 'forgery', { isNobleTarget: true });
            recordCorruptAction('manipulate_vote', true, (typeof town !== 'undefined' && town ? town.kingdomId : null), 'forgery');
            player.notoriety = (player.notoriety || 0) + _trackedNotoriety(5);
            var _nnResult = _addNobleNotorietyAndCheck(CONFIG.NOBLE_NOTORIETY_DIRECT_NOBLE_ADD || 20, 'manipulating noble votes');
            modifyRelationship(nobleId, -10);
            _recordSchemeTarget(nobleId);
            _setSchemeCooldown('manipulate_vote', nobleId, 14);
            var _nnMsg = _nnResult && _nnResult.punished ? ' ' + _nnResult.message : '';
            var _cMsg = '🚨 CAUGHT trying to buy ' + noble.firstName + '\'s vote! -300g fine.' + _nnMsg;
            _logSchemeOutcome('manipulate_vote', noble.firstName, false, true, _cMsg);
            return { success: false, caught: true, message: _cMsg };
        }

        if (rng && rng.chance(successChance)) {
            if (!noble._manipulatedVotes) noble._manipulatedVotes = {};
            noble._manipulatedVotes[proposalType || 'general'] = Engine.getDay() + 60;
            modifyRelationship(nobleId, 3);
            recordCorruptAction('manipulate_vote', false, (typeof town !== 'undefined' && town ? town.kingdomId : null), 'forgery');
            grantXP(15, 'Manipulated noble vote');
            player.notoriety = (player.notoriety || 0) + _trackedNotoriety(3);
            _trackDnaTask('manipulate_votes');
            _setSchemeCooldown('manipulate_vote', nobleId, 10);
            _recordSchemeTarget(nobleId);
            var _sMsg = '🤝 ' + noble.firstName + ' will support your position for 60 days. (' + Math.round(successChance * 100) + '% chance)';
            _logSchemeOutcome('manipulate_vote', noble.firstName, true, false, _sMsg);
            return { success: true, message: _sMsg };
        }

        _setSchemeCooldown('manipulate_vote', nobleId, 7);
        recordCorruptAction('manipulate_vote', false, (typeof town !== 'undefined' && town ? town.kingdomId : null), 'forgery');
        player.notoriety = (player.notoriety || 0) + _trackedNotoriety(1);
        var _fMsg = noble.firstName + ' refused your influence. (' + Math.round(successChance * 100) + '% chance)';
        _logSchemeOutcome('manipulate_vote', noble.firstName, false, false, _fMsg);
        return { success: false, message: _fMsg };
    }

    // (N1e) Expose Noble's Secrets — use spies/information to publicly shame a noble
    function exposeNobleSecrets(nobleId) {
        _sync();
        if (isJailed()) return { success: false, message: 'You are in jail.' };
        if (!hasSkill('dark_connections') && !hasSkill('shadow_dealings')) return { success: false, message: 'Requires Dark Connections or Shadow Dealings.' };
        var town = Engine.findTown(player.townId);
        var kingdom = town ? Engine.findKingdom(town.kingdomId) : null;
        if (!kingdom) return { success: false, message: 'Not in a kingdom.' };
        var myRank = player.socialRank[kingdom.id] || 0;
        if (myRank < 4) return { success: false, message: 'You must be at least a Minor Noble.' };
        if (player.gold < 600) return { success: false, message: 'Need 600g to dig up and publicize secrets.' };
        var noble = Engine.findPerson ? Engine.findPerson(nobleId) : null;
        if (!noble || !noble.alive) return { success: false, message: 'Noble not found or dead.' };

        // Foreign kingdom cost multiplier
        var isForeign = kingdom && kingdom.id !== player.citizenshipKingdomId;
        var isAtWar = isForeign && _areKingdomsAtWar(player.citizenshipKingdomId, kingdom.id);
        var costMultiplier = isAtWar ? 4 : (isForeign ? 2 : 1);
        var adjustedCost = 600 * costMultiplier;
        if (player.gold < adjustedCost) return { success: false, message: 'Need ' + adjustedCost + 'g to dig up and publicize secrets.' + (isForeign ? ' (foreign kingdom penalty)' : '') };

        var _cd = _checkSchemeCooldown('expose_secrets', nobleId);
        if (_cd.blocked) return { success: false, message: 'You must wait ' + _cd.daysLeft + ' more days before targeting ' + noble.firstName + ' again.' };

        var hasLocalSpy = player.spyNetworks && player.spyNetworks[town.id];

        var rng = Engine.getRng();
        var detection = calculateCorruptDetection(0.20, town);
        detection += _getRepeatTargetPenalty(nobleId);
        // Foreign kingdom detection increase
        if (isForeign) detection += 0.15;
        if (isAtWar) detection += 0.10;
        detection = Math.min(0.95, detection);
        var influenceBonus = _getNobleInfluenceBonus(nobleId);
        var baseSuccess = 0.25;
        if (hasSkill('dark_connections')) baseSuccess += 0.10;
        if (hasSkill('shadow_dealings')) baseSuccess += 0.05;
        if (hasSkill('discrete')) baseSuccess += 0.05;
        if (hasLocalSpy) baseSuccess += 0.15;
        var successChance = Math.min(0.85, baseSuccess + influenceBonus);

        player.gold -= adjustedCost;
        if (typeof Game !== 'undefined' && Game.advanceTicks) Game.advanceTicks(CONFIG.ACTION_TICK_COSTS.scheme || 4);

        if (rng && rng.chance(detection)) {
            applyCorruptPenalty(town, kingdom, 800, 25, 3, false, 'forgery', { kingdomRepLoss: 2 });
            recordCorruptAction('expose_secrets', true, (typeof town !== 'undefined' && town ? town.kingdomId : null), 'forgery');
            player.notoriety = (player.notoriety || 0) + _trackedNotoriety(15);
            var _nnResult = _addNobleNotorietyAndCheck(CONFIG.NOBLE_NOTORIETY_DIRECT_NOBLE_ADD || 20, 'exposing noble secrets');
            modifyRelationship(nobleId, -30);
            _recordSchemeTarget(nobleId);
            _setSchemeCooldown('expose_secrets', nobleId, 14);
            // Foreign kingdom: harsher caught penalties
            if (isForeign) {
                var extraJail = isAtWar ? 14 : 5;
                player.jailedUntilDay = Math.max(player.jailedUntilDay || 0, Engine.getDay() + extraJail);
                player.nobleNotoriety = Math.min(100, (player.nobleNotoriety || 0) + (isAtWar ? 15 : 8));
                if (isAtWar && rng && rng.chance(0.15)) {
                    player.gold = Math.max(0, player.gold - 5000);
                    player.jailedUntilDay = Engine.getDay() + 30;
                    Engine.logEvent('⚔️ ' + player.fullName + ' was nearly executed as a spy! Massive fine and extended imprisonment.');
                }
            }
            var _nnMsg = _nnResult && _nnResult.punished ? ' ' + _nnResult.message : '';
            var _cMsg = '🚨 CAUGHT investigating ' + noble.firstName + '\'s secrets! -800g fine, 3 days jail, ' + noble.firstName + ' is your enemy (-30 rel).' + _nnMsg;
            _logSchemeOutcome('expose_secrets', noble.firstName, false, true, _cMsg);
            return { success: false, caught: true, message: _cMsg };
        }

        if (rng && rng.chance(successChance)) {
            var allNobles = _getKingdomNobles(kingdom.id);
            for (var ni = 0; ni < allNobles.length; ni++) {
                if (allNobles[ni].id === nobleId) continue;
                if (!allNobles[ni]._nobleRelationships) allNobles[ni]._nobleRelationships = {};
                allNobles[ni]._nobleRelationships[nobleId] = Math.max(-100, (allNobles[ni]._nobleRelationships[nobleId] || 0) - rng.randInt(15, 30));
            }
            if (noble.reputation === undefined) noble.reputation = {};
            noble.reputation[kingdom.id] = Math.max(0, (noble.reputation[kingdom.id] || 50) - rng.randInt(20, 35));
            noble._scandalized = true;
            noble._scandalDay = Engine.getDay();

            var secretTypes = ['embezzlement', 'affair', 'treason_letters', 'hidden_debts', 'forged_documents', 'secret_alliance', 'bribery', 'tax_evasion'];
            var secretType = rng.pick(secretTypes);
            if (!player._discoveredSecrets) player._discoveredSecrets = [];
            player._discoveredSecrets.push({
                nobleId: nobleId,
                nobleName: noble.firstName + ' ' + (noble.lastName || ''),
                type: secretType,
                day: Engine.getDay(),
                kingdomId: kingdom.id,
                used: false
            });
            if (!player.blackmailTargets) player.blackmailTargets = {};
            if (!player.blackmailTargets[nobleId]) {
                player.blackmailTargets[nobleId] = {
                    type: secretType,
                    day: Engine.getDay(),
                    leverage: 'exposed_secrets'
                };
            }

            var exposePerceivedDrop = rng.randInt(12, 25);
            noble.perceivedKingLoyalty = Math.max(0, (noble.perceivedKingLoyalty !== undefined ? noble.perceivedKingLoyalty : (noble.kingLoyalty || 50)) - exposePerceivedDrop);

            recordCorruptAction('expose_secrets', false, (typeof town !== 'undefined' && town ? town.kingdomId : null), 'forgery');
            grantXP(30, 'Exposed noble secrets');
            player.notoriety = (player.notoriety || 0) + _trackedNotoriety(10);
            _trackDnaTask('expose_noble');
            _setSchemeCooldown('expose_secrets', nobleId, 14);
            _recordSchemeTarget(nobleId);
            var _sMsg = '💥 ' + noble.firstName + '\'s secrets exposed (' + secretType.replace(/_/g, ' ') + ')! Reputation devastated, all nobles distance themselves. You now have blackmail leverage. (' + Math.round(successChance * 100) + '% chance)';
            _logSchemeOutcome('expose_secrets', noble.firstName, true, false, _sMsg);
            Engine.logEvent('💥 Scandalous revelations about ' + noble.firstName + ' ' + (noble.lastName || '') + ' rock the court of ' + kingdom.name + '!');
            // Notify story mode — perceived loyalty and relationship damage
            if (typeof StoryMode !== 'undefined' && StoryMode.onPlayerAction) {
                var exposeRelDmg = 20; // average of 15-30 per noble
                StoryMode.onPlayerAction('noble_intrigue', { perceivedLoyaltyReduced: exposePerceivedDrop, relationshipDamage: exposeRelDmg, targetKingdomId: kingdom.id, nobleId: nobleId });
            }
            return { success: true, message: _sMsg };
        }

        _setSchemeCooldown('expose_secrets', nobleId, 7);
        recordCorruptAction('expose_secrets', false, (typeof town !== 'undefined' && town ? town.kingdomId : null), 'forgery');
        player.notoriety = (player.notoriety || 0) + _trackedNotoriety(3);
        var _fMsg = 'Couldn\'t find anything damaging on ' + noble.firstName + '. (' + Math.round(successChance * 100) + '% chance)';
        _logSchemeOutcome('expose_secrets', noble.firstName, false, false, _fMsg);
        return { success: false, message: _fMsg };
    }

    // ══════════════════════════════════════════════════════
    // §N2 DOUBLE NOBLE AGENT
    // ══════════════════════════════════════════════════════

    var DOUBLE_NOBLE_TASK_POOL = [
        { id: 'pit_two_nobles', name: 'Pit Two Nobles Against Each Other', desc: 'Successfully use the Pit Nobles scheme to create a rivalry.', check: function() { return (player._dnaTaskProgress || {}).pit_two_nobles >= 1; } },
        { id: 'turn_noble_king', name: 'Turn a Noble Against the King', desc: 'Successfully turn a noble against their king.', check: function() { return (player._dnaTaskProgress || {}).turn_noble_king >= 1; } },
        { id: 'discredit_noble', name: 'Discredit a Noble', desc: 'Successfully discredit a noble at court.', check: function() { return (player._dnaTaskProgress || {}).discredit_noble >= 1; } },
        { id: 'expose_noble', name: 'Expose a Noble\'s Secrets', desc: 'Successfully expose a noble\'s secrets publicly.', check: function() { return (player._dnaTaskProgress || {}).expose_noble >= 1; } },
        { id: 'blackmail_noble', name: 'Blackmail a Noble', desc: 'Successfully blackmail a noble of the target kingdom.', check: function() { return (player._dnaTaskProgress || {}).blackmail_noble >= 1; } },
        { id: 'plant_evidence_noble', name: 'Plant Evidence on a Noble', desc: 'Frame a noble with planted contraband.', check: function() { return (player._dnaTaskProgress || {}).plant_evidence_noble >= 1; } },
        { id: 'incite_unrest', name: 'Incite Civil Unrest', desc: 'Successfully incite revolt to destabilize the kingdom.', check: function() { return (player._dnaTaskProgress || {}).incite_unrest >= 1; } },
        { id: 'sabotage_military', name: 'Sabotage Military Building', desc: 'Sabotage a military building (barracks, armory, etc).', check: function() { return (player._dnaTaskProgress || {}).sabotage_military >= 1; } },
        { id: 'assassinate_noble', name: 'Assassinate a Noble', desc: 'Have a noble of the target kingdom assassinated.', check: function() { return (player._dnaTaskProgress || {}).assassinate_noble >= 1; } },
        { id: 'steal_treasury', name: 'Steal from the Treasury', desc: 'Steal at least 1000g worth of goods/gold from the kingdom.', check: function() { return (player._dnaTaskProgress || {}).steal_treasury >= 1000; } },
        { id: 'corrupt_two_nobles', name: 'Corrupt Two Nobles', desc: 'Have 2+ nobles in your pocket (blackmailed, indebted, or relationship 80+).', check: function() { return (player._dnaTaskProgress || {}).corrupt_two_nobles >= 2; } },
        { id: 'ban_key_goods', name: 'Get Key Goods Banned', desc: 'Influence the king to ban a good important to the economy.', check: function() { return (player._dnaTaskProgress || {}).ban_key_goods >= 1; } },
        { id: 'weaken_army', name: 'Weaken the Army', desc: 'Reduce kingdom military strength through sabotage or assassination of military leaders.', check: function() { return (player._dnaTaskProgress || {}).weaken_army >= 1; } },
        { id: 'spread_rumors_king', name: 'Undermine the King\'s Authority', desc: 'Spread rumors about the king to reduce kingdom happiness by 10+.', check: function() { return (player._dnaTaskProgress || {}).spread_rumors_king >= 1; } },
        { id: 'forge_alliance_enemy', name: 'Forge Alliance with Enemy', desc: 'Build relationship 60+ with 2 nobles in the sponsoring kingdom.', check: function() { return (player._dnaTaskProgress || {}).forge_alliance_enemy >= 2; } },
        { id: 'burn_supplies', name: 'Burn Supply Warehouses', desc: 'Commit arson on 2 buildings in the target kingdom.', check: function() { return (player._dnaTaskProgress || {}).burn_supplies >= 2; } },
        { id: 'manipulate_votes', name: 'Manipulate Noble Votes', desc: 'Successfully manipulate 3 noble votes.', check: function() { return (player._dnaTaskProgress || {}).manipulate_votes >= 3; } },
        { id: 'poison_noble', name: 'Poison a Noble', desc: 'Successfully poison a noble of the target kingdom.', check: function() { return (player._dnaTaskProgress || {}).poison_noble >= 1; } },
        { id: 'destroy_road', name: 'Sabotage Infrastructure', desc: 'Sabotage a road in the target kingdom.', check: function() { return (player._dnaTaskProgress || {}).destroy_road >= 1; } },
        { id: 'drain_economy', name: 'Drain the Economy', desc: 'Cause the kingdom\'s prosperity to drop by 15+ points.', check: function() { return (player._dnaTaskProgress || {}).drain_economy >= 15; } },
    ];

    function startDoubleNobleAgent(sponsorKingdomId) {
        _sync();
        if (isJailed()) return { success: false, message: 'You are in jail.' };
        if (!hasSkill('shadow_dealings')) return { success: false, message: 'Requires Shadow Dealings skill.' };
        if (!hasSkill('kingmaker_skill') && !hasSkill('silver_tongue_dark')) return { success: false, message: 'Also requires Kingmaker or Silver Tongue (Dark).' };
        if (player.doubleNobleAgent) return { success: false, message: 'Already operating as a double noble agent.' };

        var town = Engine.findTown(player.townId);
        var kingdom = town ? Engine.findKingdom(town.kingdomId) : null;
        if (!kingdom) return { success: false, message: 'Not in a kingdom.' };

        var myRank = player.socialRank[kingdom.id] || 0;
        if (myRank < 4) return { success: false, message: 'You must be at least a Minor Noble to become a double noble agent.' };

        var sponsor = Engine.findKingdom ? Engine.findKingdom(sponsorKingdomId) : null;
        if (!sponsor) return { success: false, message: 'Sponsoring kingdom not found.' };
        if (sponsor.id === kingdom.id) return { success: false, message: 'Cannot spy for your own kingdom.' };

        // Sponsor must be hostile or at war with target
        var isHostile = false;
        if (sponsor.atWar && sponsor.atWar.has && sponsor.atWar.has(kingdom.id)) isHostile = true;
        if (!isHostile && sponsor.atWar && sponsor.atWar.size > 0) {
            // Check if they share an enemy
            if (kingdom.atWar && kingdom.atWar.has) {
                sponsor.atWar.forEach(function(wk) { if (kingdom.atWar.has(wk)) isHostile = true; });
            }
        }
        // Also allow if kingdom relations are poor
        if (!isHostile) {
            var diplomatic = (sponsor.diplomaticRelations || {})[kingdom.id] || 0;
            if (diplomatic < -30) isHostile = true;
        }
        if (!isHostile) return { success: false, message: sponsor.name + ' has no interest in undermining ' + kingdom.name + '. They must be at war, share an enemy, or have poor relations.' };

        var rng = Engine.getRng();
        // Initial contact — can be caught as a traitor
        var detection = calculateCorruptDetection(0.20, town);
        if (typeof Game !== 'undefined' && Game.advanceTicks) Game.advanceTicks(CONFIG.ACTION_TICK_COSTS.scheme || 4);

        if (rng && rng.chance(detection)) {
            applyCorruptPenalty(town, kingdom, 3000, 40, 15, true, 'treason', { isNobleTarget: true });
            recordCorruptAction('double_noble_agent', true, (typeof town !== 'undefined' && town ? town.kingdomId : null), 'treason');
            player.notoriety = (player.notoriety || 0) + _trackedNotoriety(30);
            return { success: false, caught: true, message: '🚨 TREASON! Caught contacting ' + sponsor.name + '! Fined 3000g, jailed 15 days, EXILED, reputation destroyed!' };
        }

        // Select 5 random tasks from the pool
        var shuffled = rng.shuffle(DOUBLE_NOBLE_TASK_POOL.slice());
        var selectedTasks = [];
        for (var ti = 0; ti < Math.min(5, shuffled.length); ti++) {
            selectedTasks.push({ id: shuffled[ti].id, name: shuffled[ti].name, desc: shuffled[ti].desc, completed: false });
        }

        // Calculate difficulty for gold reward later
        var difficulty = 0;
        for (var di = 0; di < selectedTasks.length; di++) {
            var t = selectedTasks[di];
            if (t.id === 'assassinate_noble' || t.id === 'steal_treasury' || t.id === 'drain_economy') difficulty += 3;
            else if (t.id === 'incite_unrest' || t.id === 'poison_noble' || t.id === 'weaken_army') difficulty += 2;
            else difficulty += 1;
        }

        player.doubleNobleAgent = {
            targetKingdomId: kingdom.id,
            sponsorKingdomId: sponsorKingdomId,
            tasks: selectedTasks,
            startDay: Engine.getDay(),
            completed: 0,
            difficulty: difficulty,
            _initialProsperity: kingdom.prosperity || 50
        };
        player._dnaTaskProgress = {};
        recordCorruptAction('double_noble_agent', false, (typeof town !== 'undefined' && town ? town.kingdomId : null), 'treason');
        grantXP(30, 'Became double noble agent');
        player.notoriety = (player.notoriety || 0) + _trackedNotoriety(10);
        Engine.logEvent('🕵️ ' + player.fullName + ' has begun a dangerous double life as a noble agent for ' + sponsor.name + '.', null, 'my_actions');

        var taskList = '';
        for (var tli = 0; tli < selectedTasks.length; tli++) {
            taskList += '\n  ' + (tli + 1) + '. ' + selectedTasks[tli].name + ' — ' + selectedTasks[tli].desc;
        }
        return { success: true, message: '🕵️ You are now a double noble agent for ' + sponsor.name + '! Complete these 5 tasks to destabilize ' + kingdom.name + ':' + taskList };
    }

    function checkDoubleNobleAgentProgress() {
        _sync();
        if (!player.doubleNobleAgent) return null;
        var dna = player.doubleNobleAgent;
        var anyCompleted = false;
        for (var ti = 0; ti < dna.tasks.length; ti++) {
            if (dna.tasks[ti].completed) continue;
            var poolTask = null;
            for (var pi = 0; pi < DOUBLE_NOBLE_TASK_POOL.length; pi++) {
                if (DOUBLE_NOBLE_TASK_POOL[pi].id === dna.tasks[ti].id) { poolTask = DOUBLE_NOBLE_TASK_POOL[pi]; break; }
            }
            if (poolTask && poolTask.check()) {
                dna.tasks[ti].completed = true;
                dna.completed++;
                anyCompleted = true;
                Engine.logEvent('🕵️ Double agent task completed: ' + dna.tasks[ti].name + ' (' + dna.completed + '/5)', null, 'my_actions');
                if (typeof UI !== 'undefined' && UI.toast) UI.toast('🕵️ Task complete: ' + dna.tasks[ti].name + ' (' + dna.completed + '/5)', 'success', 'schemes');
            }
        }

        // Track prosperity drain
        if (player._dnaTaskProgress) {
            var kingdom = Engine.findKingdom(dna.targetKingdomId);
            if (kingdom) {
                var prosLoss = (dna._initialProsperity || 50) - (kingdom.prosperity || 50);
                if (prosLoss > 0) player._dnaTaskProgress.drain_economy = Math.max(player._dnaTaskProgress.drain_economy || 0, prosLoss);
            }
        }

        // All 5 completed? Trigger completion
        if (dna.completed >= 5) {
            return completeDoubleNobleAgent();
        }
        return anyCompleted ? { tasksRemaining: 5 - dna.completed } : null;
    }

    function completeDoubleNobleAgent() {
        var dna = player.doubleNobleAgent;
        if (!dna) return null;

        var targetKingdom = Engine.findKingdom(dna.targetKingdomId);
        var sponsor = Engine.findKingdom(dna.sponsorKingdomId);
        if (!targetKingdom || !sponsor) {
            player.doubleNobleAgent = null;
            player._dnaTaskProgress = null;
            return { success: false, message: 'One of the kingdoms no longer exists. Mission void.' };
        }

        var rng = Engine.getRng();

        // Calculate reward based on difficulty and sponsor's resources
        var baseGold = 5000 + (dna.difficulty || 10) * 1000;
        var maxGold = Math.min(20000, Math.floor((sponsor.gold || 10000) * 0.15));
        var reward = Math.max(5000, Math.min(maxGold, baseGold));
        // King personality affects payment
        var sponsorKing = null;
        var sTowns = Engine.getWorld ? Engine.getWorld().towns.filter(function(t) { return t.kingdomId === sponsor.id; }) : [];
        for (var sti = 0; sti < sTowns.length && !sponsorKing; sti++) {
            var sp = Engine.getPeople(sTowns[sti].id);
            if (sp) for (var spi = 0; spi < sp.length; spi++) { if (sp[spi].isKing) { sponsorKing = sp[spi]; break; } }
        }
        if (sponsorKing && sponsorKing.personality) {
            if (sponsorKing.personality.generosity > 0.6) reward = Math.floor(reward * 1.25);
            if (sponsorKing.personality.greed > 0.6) reward = Math.floor(reward * 0.80);
        }

        // Demote in target kingdom to citizen
        player.socialRank[dna.targetKingdomId] = 1; // citizen
        if (player.lordTownId) {
            var lordTown = Engine.findTown(player.lordTownId);
            if (lordTown && lordTown.kingdomId === dna.targetKingdomId) player.lordTownId = null;
        }

        // Promote to Minor Noble in sponsor kingdom
        player.socialRank[dna.sponsorKingdomId] = Math.max(player.socialRank[dna.sponsorKingdomId] || 0, 4);

        // Relationship changes
        player.reputation[dna.sponsorKingdomId] = Math.min(100, (player.reputation[dna.sponsorKingdomId] || 50) + 20);
        player.reputation[dna.targetKingdomId] = Math.max(0, (player.reputation[dna.targetKingdomId] || 50) - 10);

        // King relationship with sponsor
        if (sponsorKing) modifyRelationship(sponsorKing.id, 40);

        // Pay reward - cap at available gold
        reward = Math.min(reward, Math.max(5000, sponsor.gold || 0));
        sponsor.gold = Math.max(0, (sponsor.gold || 0) - reward);
        player.gold += reward;
        if (player.stats) player.stats.totalGoldEarned = (player.stats.totalGoldEarned || 0) + reward;

        // Travel ban from target kingdom for 90 days
        player._kingdomTravelBan = player._kingdomTravelBan || {};
        player._kingdomTravelBan[dna.targetKingdomId] = Engine.getDay() + 90;

        // Transport to sponsor's capital
        var capitalTown = null;
        for (var ct = 0; ct < sTowns.length; ct++) {
            if (sTowns[ct].isCapital) { capitalTown = sTowns[ct]; break; }
        }
        if (!capitalTown && sTowns.length > 0) capitalTown = sTowns[0];
        if (capitalTown) {
            player.townId = capitalTown.id;
            player.traveling = false;
        }

        // Achievement
        unlockAchievement('double_noble_agent');

        var msg = '🎭 MISSION COMPLETE!\n\n' +
            'You have successfully destabilized ' + targetKingdom.name + ' from within!\n\n' +
            '• Transported to ' + (capitalTown ? capitalTown.name : 'sponsor capital') + '\n' +
            '• Received ' + reward + 'g from ' + sponsor.name + '\n' +
            '• Promoted to Minor Noble of ' + sponsor.name + '\n' +
            '• +20 ' + sponsor.name + ' reputation, +40 relationship with ' + (sponsorKing ? sponsorKing.firstName : 'their king') + '\n' +
            '• Demoted to Citizen in ' + targetKingdom.name + '\n' +
            '• -10 ' + targetKingdom.name + ' reputation\n' +
            '• Banned from ' + targetKingdom.name + ' for 90 days';

        Engine.logEvent('🎭 ' + player.fullName + ' revealed as a double agent! Fled to ' + sponsor.name + ' with ' + reward + 'g reward.', null, 'my_actions');

        player.doubleNobleAgent = null;
        player._dnaTaskProgress = null;
        grantXP(100, 'Completed double noble agent mission');

        return { success: true, message: msg, reward: reward };
    }

    function abandonDoubleNobleAgent() {
        _sync();
        if (!player.doubleNobleAgent) return { success: false, message: 'Not operating as a double noble agent.' };
        var dna = player.doubleNobleAgent;
        var sponsor = Engine.findKingdom(dna.sponsorKingdomId);
        player.doubleNobleAgent = null;
        player._dnaTaskProgress = null;
        // Sponsor loses trust
        if (sponsor) {
            player.reputation[sponsor.id] = Math.max(0, (player.reputation[sponsor.id] || 50) - 15);
        }
        player.notoriety -= 5;
        return { success: true, message: 'Mission abandoned. ' + (sponsor ? sponsor.name : 'The sponsoring kingdom') + ' is disappointed (-15 rep).' };
    }

    function executeCorruptAction(actionId, params) {
        _sync();
        // Cooldown check
        player.schemeCooldowns = player.schemeCooldowns || {};
        var day = Engine.getDay();
        var cdKey = actionId;
        if (player.schemeCooldowns[cdKey] && day < player.schemeCooldowns[cdKey]) {
            return { success: false, message: 'Too soon to attempt this again. Wait ' + (player.schemeCooldowns[cdKey] - day) + ' days.' };
        }

        var result;
        switch (actionId) {
            case 'sabotage_building': result = sabotageBuilding(params[0], params[1]); break;
            case 'sabotage_road': result = sabotageRoad(params[0]); break;
            case 'arson': result = commitArson(params[0], params[1]); break;
            case 'steal_goods': result = stealGoods(params[0], params[1], params[2]); break;
            case 'pickpocket': result = pickpocket(params[0]); break;
            case 'warehouse_heist': result = warehouseHeist(params[0]); break;
            case 'rob_traveler': result = robTraveler(params[0]); break;
            case 'raid_caravan': result = raidCaravan(params[0]); break;
            case 'counterfeit': result = sellCounterfeit(params[0], params[1], params[2]); break;
            case 'bribe_guards': result = bribeGuards(params[0], params[1]); break;
            case 'bribe_advisor': result = bribeAdvisor(params[0], params[1]); break;
            case 'cultivate_heir': result = cultivateHeir(params[0]); break;
            case 'blackmail': result = blackmailNPC(params[0]); break;
            case 'spread_rumors': result = spreadRumors(params[0]); break;
            case 'frame_competitor': result = frameCompetitor(params[0], params[1]); break;
            case 'assassinate_competitor':
            case 'assassinate_guard_captain':
            case 'assassinate_king':
                result = hireAssassin(params[0], params[1]); break;
            case 'assassinate_passenger': result = assassinatePassenger(params[0]); break;
            case 'poison': result = poisonTarget(params[0]); break;
            case 'hire_assassin_npc': result = hireAssassinAnyNpc(params[0]); break;
            case 'direct_kill': result = directKillNpc(params[0]); break;
            case 'hidden_warehouse': result = buildHiddenWarehouse(params[0]); break;
            case 'cook_books': result = cookTheBooks(); break;
            case 'insider_trading': result = insiderTrading(params[0]); break;
            case 'spy_network': result = plantSpyNetwork(params[0]); break;
            case 'smuggling_route': result = establishSmugglingRoute(params[0], params[1]); break;
            case 'forge_documents': result = forgeDocuments(params[0]); break;
            case 'sabotage_caravan': result = sabotageCaravan(params[0]); break;
            case 'plant_evidence': result = plantEvidence(params[0]); break;
            case 'incite_revolt': result = inciteRevolt(params[0]); break;
            case 'double_agent': result = activateDoubleAgent(params[0]); break;
            case 'protection_racket': result = startProtectionRacket(params[0]); break;
            case 'pit_nobles': result = pitNoblesAgainstEachOther(params[0], params[1]); break;
            case 'turn_noble_against_king': result = turnNobleAgainstKing(params[0]); break;
            case 'discredit_noble': result = discreditNoble(params[0]); break;
            case 'manipulate_vote': result = manipulateNobleVote(params[0], params[1]); break;
            case 'expose_secrets': result = exposeNobleSecrets(params[0]); break;
            case 'double_noble_agent': result = startDoubleNobleAgent(params[0]); break;
            case 'abandon_double_noble': result = abandonDoubleNobleAgent(); break;
            case 'lay_low': result = layLow(); break;
            case 'cleanse_identity': result = cleanseIdentity(); break;
            default: return { success: false, message: 'Unknown action.' };
        }

        // Apply cooldown after attempt (longer if caught)
        var SCHEME_COOLDOWNS = {
            sabotage_building: 15, sabotage_road: 20, arson: 30, steal_goods: 3, pickpocket: 2,
            warehouse_heist: 20, rob_traveler: 10, raid_caravan: 30, counterfeit: 7,
            bribe_guards: 30, bribe_advisor: 60, cultivate_heir: 30, blackmail: 30,
            spread_rumors: 15, frame_competitor: 30,
            assassinate_competitor: 60, assassinate_guard_captain: 90, assassinate_king: 180,
            assassinate_passenger: 60, poison: 20, hire_assassin_npc: 75, direct_kill: 45,
            hidden_warehouse: 90, cook_books: 90, insider_trading: 30,
            spy_network: 90, smuggling_route: 120, forge_documents: 30, sabotage_caravan: 30,
            plant_evidence: 30, incite_revolt: 120, double_agent: 180, protection_racket: 60,
            lay_low: 60, cleanse_identity: 30,
            pit_nobles: 20, turn_noble_against_king: 30, discredit_noble: 30,
            manipulate_vote: 15, expose_secrets: 45, double_noble_agent: 90, abandon_double_noble: 90
        };
        var baseCd = SCHEME_COOLDOWNS[actionId] || 10;
        // Getting caught doubles cooldown; escalation from prior catches
        var catchMult = (result && result.caught) ? 2 : 1;
        var escalation = Math.min(5, (player.crimesCommitted[actionId] || 0));
        player.schemeCooldowns[cdKey] = day + Math.floor(baseCd * catchMult) + escalation;

        return result;
    }

    function shouldShowSchemesButton() {
        _sync();
        // Show once player has any underworld skill, notoriety, or has committed crimes
        if ((player.notoriety || 0) > 0) return true;
        if ((player.corruptActions || 0) > 0) return true;
        var skills = player.skills || [];
        for (var i = 0; i < skills.length; i++) {
            var sk = CONFIG.SKILLS ? CONFIG.SKILLS.find(function(s) { return s.id === skills[i]; }) : null;
            if (sk && sk.branch === 'underworld') return true;
        }
        return false;
    }
    // Register on Player namespace
    Player.calculateCorruptDetection = calculateCorruptDetection;
    Player.isInTown = isInTown;
    Player.isJailed = isJailed;
    Player.recordCorruptAction = recordCorruptAction;
    Player.tickManhunts = tickManhunts;
    Player._calcManhuntCatchChance = _calcManhuntCatchChance;
    Player._manhuntCatchLabel = _manhuntCatchLabel;
    Player._forceTravelToTrial = function() {
        _sync();
        if (!player._activeTrial || !player._activeTrial.courtTownId) return;
        var ct = Engine.findTown(player._activeTrial.courtTownId);
        if (!ct) return;
        if (player.townId === ct.id) return; // already there
        // Use the standard travelTo if available; otherwise teleport.
        if (Player.travelTo) {
            try {
                var r = Player.travelTo(ct.id, { force: true, skipQuarantineCheck: true, _trialAutoTravel: true });
                if (r && r.success === false && typeof UI !== 'undefined' && UI.toast) {
                    UI.toast('⚖️ Auto-travel to court failed: ' + (r.message || ''), 'warning');
                }
            } catch (_e) {}
        }
    };
    Player.castTrialVote = function(voteId, kingdomId, choice) {
        // choice: 'guilty' | 'not_guilty'
        var k = Engine.findKingdom(kingdomId);
        if (!k || !k._activeVotes) return { success: false, message: 'Kingdom or vote not found.' };
        for (var i = 0; i < k._activeVotes.length; i++) {
            var v = k._activeVotes[i];
            if (v.id !== voteId) continue;
            for (var vi = 0; vi < v.voters.length; vi++) {
                if (v.voters[vi].isPlayer) {
                    v.voters[vi].vote = choice === 'guilty' ? 'no' : 'yes';
                    return { success: true, message: 'Vote cast: ' + (choice === 'guilty' ? 'GUILTY' : 'NOT GUILTY') };
                }
            }
            return { success: false, message: 'You are not a voter on this trial.' };
        }
        return { success: false, message: 'Trial not found.' };
    };
    Player.getActiveTrials = function() {
        // Returns array of active trials in any kingdom that involve player as accused or voter
        var out = [];
        if (!Engine.getKingdoms) return out;
        var ks = Engine.getKingdoms();
        for (var i = 0; i < ks.length; i++) {
            var k = ks[i];
            if (!k._activeVotes) continue;
            for (var vi = 0; vi < k._activeVotes.length; vi++) {
                var v = k._activeVotes[vi];
                if (v.resolved || v.type !== 'noble_trial') continue;
                var role = null;
                if (v.trial && v.trial.accusedIsPlayer) role = 'accused';
                else for (var voi = 0; voi < v.voters.length; voi++) {
                    if (v.voters[voi].isPlayer) { role = 'voter'; break; }
                }
                if (role) out.push({ vote: v, kingdom: k, role: role });
            }
        }
        return out;
    };
    Player.checkCrimeImmunity = checkCrimeImmunity;
    Player.applyCorruptPenalty = applyCorruptPenalty;
    Player.sabotageBuilding = sabotageBuilding;
    Player.sabotageRoad = sabotageRoad;
    Player.commitArson = commitArson;
    Player.stealGoods = stealGoods;
    Player.pickpocket = pickpocket;
    Player.stealFromNpc = stealFromNpc;
    Player.warehouseHeist = warehouseHeist;
    Player.robTraveler = robTraveler;
    Player.raidCaravan = raidCaravan;
    Player.sellCounterfeit = sellCounterfeit;
    Player.bribeGuards = bribeGuards;
    Player.bribeAdvisor = bribeAdvisor;
    Player.cultivateHeir = cultivateHeir;
    Player.blackmailNPC = blackmailNPC;
    Player.spreadRumors = spreadRumors;
    Player.frameCompetitor = frameCompetitor;
    Player.hireAssassin = hireAssassin;
    Player.hireAssassinAnyNpc = hireAssassinAnyNpc;
    Player.directKillNpc = directKillNpc;
    Player.assassinatePassenger = assassinatePassenger;
    Player.poisonTarget = poisonTarget;
    Player.buildHiddenWarehouse = buildHiddenWarehouse;
    Player.cookTheBooks = cookTheBooks;
    Player.checkMarketManipulator = checkMarketManipulator;
    Player.insiderTrading = insiderTrading;
    Player.darkDeedsTick = darkDeedsTick;
    Player.getAvailableCorruptActions = getAvailableCorruptActions;
    Player.plantSpyNetwork = plantSpyNetwork;
    Player.establishSmugglingRoute = establishSmugglingRoute;
    Player.forgeDocuments = forgeDocuments;
    Player.sabotageCaravan = sabotageCaravan;
    Player.plantEvidence = plantEvidence;
    Player.inciteRevolt = inciteRevolt;
    Player.activateDoubleAgent = activateDoubleAgent;
    Player.startProtectionRacket = startProtectionRacket;
    Player.layLow = layLow;
    Player.canJailbreak = canJailbreak;
    Player.attemptJailbreak = attemptJailbreak;
    Player.hasForgedLicense = hasForgedLicense;
    Player.hasForgedCitizenship = hasForgedCitizenship;
    Player.cleanseIdentity = cleanseIdentity;
    Player.pitNoblesAgainstEachOther = pitNoblesAgainstEachOther;
    Player.turnNobleAgainstKing = turnNobleAgainstKing;
    Player.discreditNoble = discreditNoble;
    Player.manipulateNobleVote = manipulateNobleVote;
    Player.exposeNobleSecrets = exposeNobleSecrets;
    Player.startDoubleNobleAgent = startDoubleNobleAgent;
    Player.checkDoubleNobleAgentProgress = checkDoubleNobleAgentProgress;
    Player.completeDoubleNobleAgent = completeDoubleNobleAgent;
    Player.abandonDoubleNobleAgent = abandonDoubleNobleAgent;
    Player.executeCorruptAction = executeCorruptAction;
    Player.shouldShowSchemesButton = shouldShowSchemesButton;

})(window.Player);
