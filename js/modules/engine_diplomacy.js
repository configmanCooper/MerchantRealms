// ========================================================
// engine_diplomacy.js
// Diplomacy, King Decisions & Proactive Economic Growth
// Extracted from engine.js sections §14, §14B, §17G-A
// ========================================================
(function(Engine) {
    "use strict";
    if (!Engine) throw new Error("Engine must be loaded before engine_diplomacy.js");

    // ── Internal state ──
    var world;
    var _tickCache;
    function _syncState() {
        world = Engine.getWorld();
        _tickCache = Engine._getTickCache ? Engine._getTickCache() : {};
    }

    // ── Already-exported Engine utilities ──
    var logEvent = function(msg, details, category) { Engine.logEvent(msg, details, category); };
    var logHiddenEvent = function(msg, details, category) { Engine.logHiddenEvent(msg, details, category); };
    var findTown = function(id) { return Engine.findTown(id); };
    var findKingdom = function(id) { return Engine.findKingdom(id); };
    var findPerson = function(id) { return Engine.findPerson(id); };
    var findBuildingType = function(id) { return Engine.findBuildingType(id); };
    var findResourceById = function(id) { return Engine.findResourceById(id); };
    var getPeopleInTown = function(id) { return Engine.getPeopleInTown(id); };
    var getPeopleInKingdom = function(id) { return Engine.getPeopleInKingdom(id); };
    var hasSpecialLaw = function(k, lawId) { return Engine.hasSpecialLaw(k, lawId); };
    var hasEmbargo = function(k1Id, k2Id) { return Engine.hasEmbargo(k1Id, k2Id); };
    var computeMilitaryStrength = function(k) { return Engine.computeMilitaryStrength(k); };
    var scoutEnemyStrength = function(k, other) { return Engine.scoutEnemyStrength(k, other); };
    var evaluatePeaceTerms = function(loser, winner) { return Engine.evaluatePeaceTerms(loser, winner); };
    var transferTown = function(townId, from, to, method) { return Engine.transferTown(townId, from, to, method); };
    var imposeServitude = function(town, kingdom) { return Engine.imposeServitude(town, kingdom); };
    var grantCitizenship = function(town, kingdom) { return Engine.grantCitizenship(town, kingdom); };
    var setKingMood = function(k, mood, reason) { return Engine.setKingMood(k, mood, reason); };
    var isPlayerRoyalAdvisorOf = function(k) { return Engine.isPlayerRoyalAdvisorOf(k); };
    var proposeKingDecision = function(k, decision) { return Engine.proposeKingDecision(k, decision); };
    var recruitSoldier = function(person, town, k, type) { return Engine.recruitSoldier(person, town, k, type); };
    var kingdomBuild = function(k, town, type, rng) { return Engine.kingdomBuild(k, town, type, rng); };
    var distributeConstructionWages = function(townId, amount, rng) { return Engine.distributeConstructionWages(townId, amount, rng); };
    var buildNewRoad = function(from, to, kingdomId, opts) { return Engine.buildNewRoad(from, to, kingdomId, opts); };
    var buildNewSeaRoute = function(from, to, kingdomId, opts) { return Engine.buildNewSeaRoute ? Engine.buildNewSeaRoute(from, to, kingdomId, opts) : null; };
    // v9p33river47: lightweight BFS over road / sea-route graph to estimate
    // existing connection distance between two towns (returns null if no path).
    // Used to gate cross-kingdom infrastructure: don't build a new route if
    // existing routing is already reasonably fast.
    function _shortestRoadDistance(townA, townB) {
        if (!townA || !townB) return null;
        var roads = (typeof world !== 'undefined' && world.roads) || (Engine.getRoads ? Engine.getRoads() : []);
        if (!roads || !roads.length) return null;
        var townMap = {};
        var allTowns = (typeof world !== 'undefined' && world.towns) || (Engine.getTowns ? Engine.getTowns() : []);
        for (var i = 0; i < allTowns.length; i++) townMap[allTowns[i].id] = allTowns[i];
        // Build adjacency
        var adj = {};
        for (var ri = 0; ri < roads.length; ri++) {
            var r = roads[ri];
            if (r.condition === 'destroyed') continue;
            // v9p33river300: defend against stale roads referencing
            // missing/removed towns — was previously dereferencing
            // .x/.y on undefined and throwing.
            var fromT = townMap[r.fromTownId];
            var toT = townMap[r.toTownId];
            if (!fromT || !toT) continue;
            var d = Math.hypot(fromT.x - toT.x, fromT.y - toT.y);
            if (!adj[r.fromTownId]) adj[r.fromTownId] = [];
            if (!adj[r.toTownId]) adj[r.toTownId] = [];
            adj[r.fromTownId].push({ id: r.toTownId, d });
            adj[r.toTownId].push({ id: r.fromTownId, d });
        }
        // Dijkstra-lite (simple priority via best-known per-node)
        var dist = {}; dist[townA.id] = 0;
        var queue = [{ id: townA.id, d: 0 }];
        var maxIter = 400;
        while (queue.length > 0 && maxIter-- > 0) {
            queue.sort(function(p, q) { return p.d - q.d; });
            var cur = queue.shift();
            if (cur.id === townB.id) return cur.d;
            if (cur.d > (dist[cur.id] || Infinity)) continue;
            var nb = adj[cur.id] || [];
            for (var ni = 0; ni < nb.length; ni++) {
                var alt = cur.d + nb[ni].d;
                if (alt < (dist[nb[ni].id] || Infinity)) {
                    dist[nb[ni].id] = alt;
                    queue.push({ id: nb[ni].id, d: alt });
                }
            }
        }
        return null;
    }
    function _shortestSeaDistance(townA, townB) {
        if (!townA || !townB) return null;
        var routes = (typeof world !== 'undefined' && world.seaRoutes) || (Engine.getSeaRoutes ? Engine.getSeaRoutes() : []);
        if (!routes || !routes.length) return null;
        var townMap = {};
        var allTowns = (typeof world !== 'undefined' && world.towns) || (Engine.getTowns ? Engine.getTowns() : []);
        for (var i = 0; i < allTowns.length; i++) townMap[allTowns[i].id] = allTowns[i];
        var adj = {};
        for (var ri = 0; ri < routes.length; ri++) {
            var r = routes[ri];
            if (r.condition === 'destroyed') continue;
            // v9p33river300: same stale-route crash as land path above.
            var fromT = townMap[r.fromTownId];
            var toT = townMap[r.toTownId];
            if (!fromT || !toT) continue;
            var d = Math.hypot(fromT.x - toT.x, fromT.y - toT.y);
            if (!adj[r.fromTownId]) adj[r.fromTownId] = [];
            if (!adj[r.toTownId]) adj[r.toTownId] = [];
            adj[r.fromTownId].push({ id: r.toTownId, d });
            adj[r.toTownId].push({ id: r.fromTownId, d });
        }
        var dist = {}; dist[townA.id] = 0;
        var queue = [{ id: townA.id, d: 0 }];
        var maxIter = 400;
        while (queue.length > 0 && maxIter-- > 0) {
            queue.sort(function(p, q) { return p.d - q.d; });
            var cur = queue.shift();
            if (cur.id === townB.id) return cur.d;
            if (cur.d > (dist[cur.id] || Infinity)) continue;
            var nb = adj[cur.id] || [];
            for (var ni = 0; ni < nb.length; ni++) {
                var alt = cur.d + nb[ni].d;
                if (alt < (dist[nb[ni].id] || Infinity)) {
                    dist[nb[ni].id] = alt;
                    queue.push({ id: nb[ni].id, d: alt });
                }
            }
        }
        return null;
    }
    var checkWaterPath = function(x1, y1, x2, y2) { return Engine.checkWaterPath(x1, y1, x2, y2); };
    var computeRoadImportance = function(a, b) { return Engine.computeRoadImportance(a, b); };
    var rebuildBridge = function(roadIndex, bridgeId) { return Engine.rebuildBridge(roadIndex, bridgeId); };
    var logKingAction = function(k, msg) { return Engine.logKingAction(k, msg); };
    var handleKingDeath = function(k, cause) { return Engine.handleKingDeath(k, cause); };
    var checkDirectedCommissionDeadline = function(k) { return Engine.checkDirectedCommissionDeadline(k); };
    var getMarketPrice = function(town, good) { return Engine.getMarketPrice(town, good); };
    var convertBuilding = function(town, index, newType, ownerId, owner) { return Engine.convertBuilding(town, index, newType, ownerId, owner); };
    var findArmyRoute = function(from, to, kingdomId) { return Engine.findArmyRoute(from, to, kingdomId); };
    var uid = function(prefix) { return Engine.uid ? Engine.uid(prefix) : (prefix || '') + '_' + Math.random().toString(36).substr(2, 9); };

    // ── Functions that must be newly exported from engine.js ──
    var tickWarExhaustion = function(k) { return Engine.tickWarExhaustion(k); };
    var applyWarExhaustionEffects = function(k, rng) { return Engine.applyWarExhaustionEffects(k, rng); };
    var getKingMoodModifiers = function(k) { return Engine.getKingMoodModifiers(k); };
    var shouldCallToArms = function(k, ally, isDefensive, meta) { return Engine.shouldCallToArms(k, ally, isDefensive, meta); };
    var processCallToArms = function(k, ally, enemy, war, isDefensive, meta) { return Engine.processCallToArms(k, ally, enemy, war, isDefensive, meta); };
    var initiateCouncilVote = function() { return Engine.initiateCouncilVote.apply(null, arguments); };
    var tickKingdomFinancialStrategy = function(k) { return Engine.tickKingdomFinancialStrategy(k); };
    var kingdomAI = function(k) { return Engine.kingdomAI(k); };
    var tickTownFounding = function(k) { return Engine.tickTownFounding(k); };
    var getKingdomHappiness = function(k) { return Engine.getKingdomHappiness(k); };
    var tickCouncilVotes = function(k) { return Engine.tickCouncilVotes(k); };
    var tickKingMood = function(k) { return Engine.tickKingMood(k); };
    var tickSuccessionCrisis = function(k) { return Engine.tickSuccessionCrisis(k); };
    var attemptEmergencySuccession = function(k) { return Engine.attemptEmergencySuccession(k); };
    var _resolvePendingElection = function(k, v) { return Engine._resolvePendingElection(k, v); };
    var tickRebellion = function(k) { return Engine.tickRebellion(k); };
    var tickKingdomHappinessConsequences = function(k) { return Engine.tickKingdomHappinessConsequences(k); };
    var tickSurrender = function(k) { return Engine.tickSurrender(k); };
    var tickNobleAI = function(k) { return Engine.tickNobleAI(k); };
    var tickKingFamilyAI = function(k) { return Engine.tickKingFamilyAI(k); };
    var tickKingdomPurchasing = function(k) { return Engine.tickKingdomPurchasing(k); };
    var tickKingTravel = function(k) { return Engine.tickKingTravel(k); };
    var tickPendingKingDecisions = function(k) { return Engine.tickPendingKingDecisions(k); };
    var tickKingdomFeasts = function(k) { return Engine.tickKingdomFeasts(k); };
    var tickKingdomFestivals = function(k) { return Engine.tickKingdomFestivals(k); };
    var tickKingdomCourt = function(k) { return Engine.tickKingdomCourt(k); };
    var tickNobleConspiracies = function(k) { return Engine.tickNobleConspiracies(k); };
    var tickKingUnrestResponse = function(k) { return Engine.tickKingUnrestResponse(k); };
    var tickNobleIncome = function() { return Engine.tickNobleIncome(); };
    var tickNobleRelationships = function() { return Engine.tickNobleRelationships(); };
    var tickNoblePersonalityActions = function() { return Engine.tickNoblePersonalityActions(); };
    var tickKingdomConstruction = function() { return Engine.tickKingdomConstruction(); };
    var tickTreaties = function() { return Engine.tickTreaties(); };
    var checkWarGoals = function() { return Engine.checkWarGoals(); };
    var wouldViolateNonAggression = function(a, b) { return Engine.wouldViolateNonAggression(a, b); };
    var handleNonAggressionViolation = function(k, treaty) { return Engine.handleNonAggressionViolation(k, treaty); };
    var generateWarGoals = function(a, b, rng) { return Engine.generateWarGoals(a, b, rng); };
    var declareEmbargo = function(a, b) { return Engine.declareEmbargo(a, b); };
    var liftEmbargo = function(a, b) { return Engine.liftEmbargo(a, b); };
    var isRoadSafe = function(road) { return Engine.isRoadSafe(road); };
    var createTreaty = function(a, b, isSurrender, loser, isExhaustion) { return Engine.createTreaty(a, b, isSurrender, loser, isExhaustion); };
    var getWarExhaustionRecruitMod = function(k) { return Engine.getWarExhaustionRecruitMod(k); };
    var getTentCampDiseaseMod = function(town) { return Engine.getTentCampDiseaseMod(town); };
    var recruitSoldier = function(person, town, kingdom, unitType) { return Engine.recruitSoldier(person, town, kingdom, unitType); };
    var findArmyRoute = function(from, to, kId) { return Engine.findArmyRoute(from, to, kId); };
    var killPerson = function(person, cause) { return Engine.killPerson(person, cause); };

    // ── Noble Army Leader Selection ──
    // King AI picks a minor noble or lord (NOT royal advisor) to lead an army
    function _pickNobleArmyLeader(kingdom, army, world) {
        if (!kingdom || !world) return null;
        var rng = world.rng;
        if (!rng) return null;

        // Check if this king's personality is warlike enough to assign leaders
        // v9p33river305: kingPersonality fields are militarism/temperament/
        // greed/intelligence/etc (see engine.js:1156-1167). There's no
        // `military` or `diplomatic` field — the old check was always false.
        var personality = kingdom.kingPersonality || {};
        var warlike = personality.militarism === 'warlike' || personality.militarism === 'aggressive';
        var strategic = personality.intelligence === 'brilliant' || personality.intelligence === 'clever';
        // Base chance: 40% for warlike kings, 25% for strategic, 15% for others
        var assignChance = warlike ? 0.40 : (strategic ? 0.25 : 0.15);
        // Higher chance for larger armies
        if (army.soldiers >= 30) assignChance += 0.10;
        if (army.soldiers >= 60) assignChance += 0.10;

        if (!rng.chance(assignChance)) return null;

        // Skip if player is king of this kingdom (player makes this decision via UI)
        if (typeof Player !== 'undefined' && Player.isPlayerKing && Player.isPlayerKing()) {
            var ps = Player.state;
            if (ps && ps.kingState && ps.kingState.kingdomId === kingdom.id) return null;
        }

        // Find eligible nobles: minor nobles (rank 4) and lords (rank 5), NOT royal advisors (rank 6)
        var nobles = (Engine.getPeopleInKingdom ? Engine.getPeopleInKingdom(kingdom.id) : []).filter(function(p) {
            if (!p.alive || !p.socialRank) return false;
            var rank = p.socialRank[kingdom.id] || 0;
            if (rank < 4 || rank > 5) return false; // Only minor nobles and lords
            // v9p33river306: canonical jail flag is _jailedUntilDay (a day
            // number). The legacy `_jailed` boolean is never set anywhere,
            // so jailed nobles could still be picked as army leaders.
            var _todayD = (typeof world !== 'undefined' && world.day) || 0;
            if (p._jailedUntilDay && p._jailedUntilDay > _todayD) return false;
            if (p.occupation === 'prisoner') return false;
            // Not already leading an army
            for (var _ai = 0; _ai < world.armies.length; _ai++) {
                if (world.armies[_ai].leaderId === p.id) return false;
            }
            return true;
        });

        if (nobles.length === 0) return null;

        // Prefer: minor nobles first (more expendable), then lords
        var minorNobles = nobles.filter(function(n) { return (n.socialRank[kingdom.id] || 0) === 4; });
        var lords = nobles.filter(function(n) { return (n.socialRank[kingdom.id] || 0) === 5; });

        // 70% chance to pick minor noble if available, 30% lord
        var pool = (minorNobles.length > 0 && rng.chance(0.70)) ? minorNobles : (lords.length > 0 ? lords : minorNobles);
        if (pool.length === 0) return null;

        return pool[rng.randInt(0, pool.length - 1)];
    }

    // ── Recruitment Postings Tick: NPCs respond to postings over time ──
    function _tickRecruitmentPostings(k, rng) {
        if (!k._recruitmentPostings || k._recruitmentPostings.length === 0) return;
        var dayNow = world.day;

        for (var pi = k._recruitmentPostings.length - 1; pi >= 0; pi--) {
            var post = k._recruitmentPostings[pi];
            var remaining = post.slotsTotal - post.slotsFilled;
            if (remaining <= 0) {
                k._recruitmentPostings.splice(pi, 1);
                continue;
            }
            // Expire old postings after 30 days, refund remaining gold
            if (dayNow - post.postedDay > 30) {
                var refund = remaining * post.payPerSoldier;
                k.gold = (k.gold || 0) + refund;
                logHiddenEvent('📜 Recruitment posting expired (' + post.slotsFilled + '/' + post.slotsTotal + ' filled). ' + refund + 'g refunded.', { kingdomId: k.id }, _eventKingdomCategory(k.id));
                k._recruitmentPostings.splice(pi, 1);
                continue;
            }

            // Each tick: 1-3 NPCs per town may respond (higher for conscription)
            var fillRate = post.isConscription ? 3 : 2;
            var filledThisTick = 0;

            for (var ti = 0; ti < post.towns.length && remaining > 0; ti++) {
                var town = findTown(post.towns[ti]);
                if (!town) continue;

                var eligible;
                if (post.isConscription) {
                    // Conscription: any male 18+, not already soldier/guard, not indentured
                    eligible = getPeopleInTown(town.id).filter(function(p) {
                        return p.alive && p.sex === 'M' && p.age >= 18 &&
                               p.occupation !== 'soldier' && p.occupation !== 'guard' &&
                               p.status !== 'indentured' && !p.conscripted;
                    });
                } else {
                    // Voluntary: idle laborers/unemployed willing to serve
                    eligible = getPeopleInTown(town.id).filter(function(p) {
                        return p.alive && (p.occupation === 'laborer' || p.occupation === 'none' || p.occupation === 'unemployed') &&
                               p.age >= (CONFIG.COMING_OF_AGE || 16) && p.age <= 50 &&
                               p.status !== 'indentured';
                    });
                }

                if (eligible.length === 0) continue;

                // Willingness check: higher for well-paid, lower for conscription
                var maxPerTown = Math.min(fillRate, remaining, eligible.length);
                for (var ei = 0; ei < maxPerTown; ei++) {
                    var candidate = eligible[ei];
                    var willingness = 0.3; // base 30% chance per tick

                    if (post.isConscription) {
                        willingness = 0.6; // forced, but not instant
                        // Penalty: people with established jobs resist more
                        if (candidate.occupation === 'farmer') willingness *= 0.7;
                        if (candidate.occupation === 'miner') willingness *= 0.6;
                        if (candidate.occupation === 'craftsman' || candidate.occupation === 'artisan') willingness *= 0.5;
                        if (candidate.occupation === 'merchant' || candidate.occupation === 'trader') willingness *= 0.3;
                    } else {
                        // Higher pay = more willing
                        if (post.payPerSoldier >= 50) willingness += 0.1;
                        if (post.payPerSoldier >= 75) willingness += 0.1;
                        // Patriotic/brave NPCs more willing
                        var _cP = candidate.personality || {};
                        if ((_cP.loyalty || 50) > 60) willingness += 0.1;
                        if ((_cP.courage || 50) > 60) willingness += 0.1;
                    }

                    if (rng.chance(Math.min(0.85, willingness))) {
                        var uType = 'infantry';
                        var townSupply = (town.market && town.market.supply) || {};
                        if ((townSupply.horses || 0) > 0 && (townSupply.saddles || 0) > 0 && rng.chance(0.15)) uType = 'cavalry';
                        else if ((townSupply.bows || 0) > 0 && rng.chance(0.25)) uType = 'archer';
                        if (post.isConscription) {
                            candidate.conscripted = true;
                            // Severe individual happiness blow for conscription
                            if (!candidate.needs) candidate.needs = {};
                            var _baseDrop = 25 + Math.floor(rng.random() * 20); // -25 to -44
                            var _cp = candidate.personality || {};
                            // Brave/loyal NPCs take it better
                            if ((_cp.courage || 50) > 65) _baseDrop = Math.round(_baseDrop * 0.6);
                            else if ((_cp.courage || 50) > 50) _baseDrop = Math.round(_baseDrop * 0.8);
                            // Ambitious NPCs see opportunity, less unhappy
                            if ((_cp.ambition || 50) > 60) _baseDrop = Math.round(_baseDrop * 0.75);
                            // NPCs with families suffer more
                            if (candidate.spouse || candidate.spouseId) _baseDrop = Math.round(_baseDrop * 1.3);
                            candidate.needs.happiness = Math.max(5, (candidate.needs.happiness || 50) - _baseDrop);
                        }
                        recruitSoldier(candidate, town, k, uType);
                        post.slotsFilled++;
                        remaining--;
                        filledThisTick++;
                    }
                }
            }

            // Notify periodically when recruits join
            if (filledThisTick > 0 && (post.slotsFilled % 5 === 0 || post.slotsFilled >= post.slotsTotal)) {
                var pctFilled = Math.round(post.slotsFilled / post.slotsTotal * 100);
                logHiddenEvent('🎖️ ' + (post.isConscription ? 'Conscription' : 'Recruitment') + ': ' + post.slotsFilled + '/' + post.slotsTotal + ' (' + pctFilled + '% filled)', { kingdomId: k.id }, _eventKingdomCategory(k.id));
            }

            // Complete posting
            if (post.slotsFilled >= post.slotsTotal) {
                k._recruitmentPostings.splice(pi, 1);
            }
        }
    }

    // ── Employee Postings Tick: NPCs respond to guard/procurer/royal_guard postings ──
    function _tickEmployeePostings(k, rng) {
        if (!k._employeePostings || k._employeePostings.length === 0) return;
        if (!k._employees) k._employees = { procurers: [], guards: [], royalGuards: [] };
        var dayNow = world.day;

        for (var pi = k._employeePostings.length - 1; pi >= 0; pi--) {
            var post = k._employeePostings[pi];
            var remaining = post.slotsTotal - post.slotsFilled;
            if (remaining <= 0) { k._employeePostings.splice(pi, 1); continue; }

            // Expire after 30 days
            if (dayNow - post.postedDay > 30) {
                var refundPerSlot = post.weeklyPay * 2;
                var refund = remaining * refundPerSlot;
                k.gold = (k.gold || 0) + refund;
                logHiddenEvent('📋 Employee posting expired (' + post.slotsFilled + '/' + post.slotsTotal + ' ' + post.type + 's filled). ' + refund + 'g refunded.', { kingdomId: k.id }, _eventKingdomCategory(k.id));
                k._employeePostings.splice(pi, 1);
                continue;
            }

            var filledThisTick = 0;
            for (var ti = 0; ti < post.towns.length && remaining > 0; ti++) {
                var town = findTown(post.towns[ti]);
                if (!town) continue;

                var eligible = getPeopleInTown(town.id).filter(function(p) {
                    if (!p.alive || p.occupation === 'soldier' || p.status === 'indentured') return false;
                    if (post.type === 'royal_guard') {
                        // 18-35, prior guard/soldier experience, citizen rank+
                        // v9p33river305: p.socialRank is a per-kingdom object
                        // map, not a number — `>= 1` was always false. Check
                        // the rank in THIS kingdom (k.id).
                        var _rgRank = (p.socialRank && typeof p.socialRank === 'object') ? (p.socialRank[k.id] || 0) : (p.socialRank || 0);
                        return p.age >= 18 && p.age <= 35 &&
                               (p.previousOccupation === 'soldier' || p.previousOccupation === 'guard' ||
                                p.combatSkill >= 20 || p.militaryExperience) &&
                               (_rgRank >= 1 || (p.citizenship && p.citizenship[k.id]));
                    } else if (post.type === 'guard') {
                        // 16-55, able-bodied
                        return p.age >= 16 && p.age <= 55 &&
                               (p.occupation === 'laborer' || p.occupation === 'none' || p.occupation === 'unemployed' ||
                                p.occupation === 'farmer' || p.occupation === 'guard');
                    } else {
                        // Procurer: anyone 16+ with some merchant/trading ability
                        return p.age >= 16 && p.age <= 60 &&
                               (p.occupation === 'laborer' || p.occupation === 'none' || p.occupation === 'unemployed' ||
                                p.occupation === 'merchant' || p.occupation === 'trader' || p.occupation === 'farmer');
                    }
                });
                if (eligible.length === 0) continue;

                var maxPerTown = Math.min(2, remaining, eligible.length);
                for (var ei = 0; ei < maxPerTown; ei++) {
                    var cand = eligible[ei];
                    // Willingness based on pay vs alternatives
                    var will = 0.25;
                    if (post.weeklyPay >= 30) will += 0.1;
                    if (post.weeklyPay >= 50) will += 0.15;
                    var _cp = cand.personality || {};
                    if (cand.occupation === 'unemployed' || cand.occupation === 'none') will += 0.2;
                    if ((_cp.loyalty || 50) > 60) will += 0.05;

                    if (rng.chance(Math.min(0.7, will))) {
                        var empRecord = {
                            id: 'emp_' + cand.id + '_' + dayNow,
                            npcId: cand.id,
                            name: (cand.firstName || '') + ' ' + (cand.lastName || ''),
                            type: post.type,
                            townId: town.id,
                            weeklyPay: post.weeklyPay,
                            hiredDay: dayNow
                        };

                        cand.previousOccupation = cand.occupation;
                        cand.occupation = post.type === 'procurer' ? 'procurer' : post.type === 'royal_guard' ? 'royal_guard' : 'guard';
                        cand.employerId = 'kingdom_' + k.id;

                        if (post.type === 'procurer') k._employees.procurers.push(empRecord);
                        else if (post.type === 'guard') k._employees.guards.push(empRecord);
                        else if (post.type === 'royal_guard') k._employees.royalGuards.push(empRecord);

                        post.slotsFilled++;
                        remaining--;
                        filledThisTick++;
                    }
                }
            }

            if (filledThisTick > 0) {
                var tLabel = post.type === 'procurer' ? 'Procurer' : post.type === 'guard' ? 'Guard' : 'Royal Guard';
                Engine.logHiddenEvent('👤 ' + tLabel + ' hiring: ' + post.slotsFilled + '/' + post.slotsTotal + ' filled', { kingdomId: k.id }, _eventKingdomCategory(k.id));
            }
            if (post.slotsFilled >= post.slotsTotal) k._employeePostings.splice(pi, 1);
        }
    }

    // ── Procurer Tick: procurers travel and buy goods for the kingdom ──
    function _tickProcurers(k, rng) {
        if (!k._employees || !k._employees.procurers || k._employees.procurers.length === 0) return;
        if (!k._procurementOrders || k._procurementOrders.length === 0) return;

        var activeOrders = k._procurementOrders.filter(function(o) { return o.remaining > 0; });
        if (activeOrders.length === 0) return;

        // Each procurer processes one order per tick
        for (var pi = 0; pi < k._employees.procurers.length; pi++) {
            var proc = k._employees.procurers[pi];
            if (activeOrders.length === 0) break;

            // Pick an order to work on
            var order = activeOrders[Math.floor(rng.random() * activeOrders.length)];

            // Find cheapest supply in the procurer's current town or nearby
            var procTown = findTown(proc.townId);
            if (!procTown) continue;

            var avail = (procTown.market && procTown.market.supply) ? (procTown.market.supply[order.goodId] || 0) : 0;
            if (avail >= 1) {
                var price = 10;
                try { price = getMarketPrice(procTown, order.goodId); } catch(e) {}
                if (price <= order.maxPrice && (k.gold || 0) >= price) {
                    var buyQty = Math.min(Math.floor(avail), order.remaining, 5); // procurers buy up to 5 per tick
                    var totalCost = Math.ceil(price * buyQty);
                    if ((k.gold || 0) >= totalCost) {
                        k.gold -= totalCost;
                        procTown.market.supply[order.goodId] -= buyQty;
                        if (!k.goodsStockpile) k.goodsStockpile = {};
                        // Military items go to military stockpile
                        var milItems = ['swords', 'armor', 'bows', 'arrows', 'horses', 'saddles', 'shields'];
                        if (milItems.indexOf(order.goodId) >= 0) {
                            if (!k.militaryStockpile) k.militaryStockpile = {};
                            k.militaryStockpile[order.goodId] = (k.militaryStockpile[order.goodId] || 0) + buyQty;
                        } else {
                            k.goodsStockpile[order.goodId] = (k.goodsStockpile[order.goodId] || 0) + buyQty;
                        }
                        order.remaining -= buyQty;
                        order.filled = (order.filled || 0) + buyQty;
                        if (Engine.recordKingdomTransaction) Engine.recordKingdomTransaction(k, 'expense', totalCost, 'Procurer bought ' + buyQty + 'x ' + order.goodId + ' in ' + (procTown.name || '?'), 'procurement');
                    }
                }
            } else {
                // No supply here — procurer "travels" to a different town next tick
                var kTowns = world.towns.filter(function(t) {
                    // v9p33river333: relocate procurers only to live, useful market towns with a chance to fill this order.
                    return k.territories.has(t.id) && t.id !== proc.townId && !t.abandoned && !t.destroyed && !t.isOutpost && !t.isJunction && t.market && t.market.supply && (t.market.supply[order.goodId] || 0) > 0;
                });
                if (kTowns.length === 0) {
                    kTowns = world.towns.filter(function(t) { return k.territories.has(t.id) && t.id !== proc.townId && !t.abandoned && !t.destroyed && t.market && t.market.supply; });
                }
                if (kTowns.length > 0) {
                    proc.townId = kTowns[Math.floor(rng.random() * kTowns.length)].id;
                }
            }
        }

        // Clean up completed orders
        for (var oi = k._procurementOrders.length - 1; oi >= 0; oi--) {
            if (k._procurementOrders[oi].remaining <= 0) {
                Engine.logHiddenEvent('✅ Procurement order fulfilled: ' + k._procurementOrders[oi].goodId + ' (' + k._procurementOrders[oi].filled + ' total)', { kingdomId: k.id }, _eventKingdomCategory(k.id));
                k._procurementOrders.splice(oi, 1);
            }
        }
    }

    // ── Employee Wages Tick: pay employees weekly ──
    function _tickEmployeeWages(k) {
        if (!k._employees) return;
        if (world.day % 7 !== 0) return; // weekly

        var lists = [k._employees.procurers, k._employees.guards, k._employees.royalGuards];
        var totalPaid = 0;
        for (var li = 0; li < lists.length; li++) {
            if (!lists[li]) continue;
            for (var ei = lists[li].length - 1; ei >= 0; ei--) {
                var emp = lists[li][ei];
                var pay = emp.weeklyPay || 20;
                if ((k.gold || 0) >= pay) {
                    k.gold -= pay;
                    totalPaid += pay;
                    // NPC gets paid
                    try {
                        var person = findPerson(emp.npcId);
                        if (person) person.gold = (person.gold || 0) + pay;
                    } catch(e) {}
                } else {
                    // Can't pay — employee quits
                    try {
                        var person2 = findPerson(emp.npcId);
                        if (person2) { person2.occupation = 'unemployed'; person2.employerId = null; }
                    } catch(e) {}
                    lists[li].splice(ei, 1);
                    logHiddenEvent('💸 Kingdom employee quit (unpaid): ' + (emp.name || 'unknown'), { kingdomId: k.id }, _eventKingdomCategory(k.id));
                }
            }
        }

        // Record aggregate employee wages in kingdom ledger
        if (totalPaid > 0 && Engine.recordKingdomTransaction) {
            var empCounts = (k._employees.procurers ? k._employees.procurers.length : 0) + (k._employees.guards ? k._employees.guards.length : 0) + (k._employees.royalGuards ? k._employees.royalGuards.length : 0);
            Engine.recordKingdomTransaction(k, 'expense', totalPaid, 'Weekly wages for ' + empCounts + ' employees', 'employee_wages');
        }

        // Guard crime reduction: each guard reduces theft/crime chance in their town
        // v9p33river334: reset this kingdom's per-tick guard bonus before recounting so crime reduction does not stack forever.
        var _guardTownIds = [];
        if (k.territories) {
            if (typeof k.territories.forEach === 'function') k.territories.forEach(function(id) { _guardTownIds.push(id); });
            else if (Array.isArray(k.territories)) _guardTownIds = k.territories.slice();
            else if (typeof k.territories === 'object') { for (var _gti in k.territories) if (k.territories[_gti]) _guardTownIds.push(_gti); }
        }
        for (var _gtri = 0; _gtri < _guardTownIds.length; _gtri++) {
            var _gtown = findTown(_guardTownIds[_gtri]);
            if (_gtown) _gtown._guardBonus = 0;
        }
        if (k._employees.guards) {
            for (var gi = 0; gi < k._employees.guards.length; gi++) {
                var guard = k._employees.guards[gi];
                var gTown = findTown(guard.townId);
                if (gTown) {
                    gTown.garrison = Math.max(gTown.garrison || 0, 1); // ensure at least 1 garrison for crime check
                    gTown._guardBonus = (gTown._guardBonus || 0) + 1; // tracked for crime reduction
                }
            }
        }
    }

    // ── AI King Employee Hiring: strategically hire guards, procurers, royal guards ──
    function _aiKingHireEmployees(k, rng) {
        if (!k._employees) k._employees = { procurers: [], guards: [], royalGuards: [] };
        if (!k._employeePostings) k._employeePostings = [];
        var treasury = k.gold || 0;
        if (treasury < 1000) return; // don't hire if poor

        // v9p33river334: tolerate legacy territory shapes (Set/array/object/null) when hiring employees.
        var _territoryIds = [];
        if (k.territories) {
            if (typeof k.territories.forEach === 'function') k.territories.forEach(function(id) { _territoryIds.push(id); });
            else if (Array.isArray(k.territories)) _territoryIds = k.territories.slice();
            else if (typeof k.territories === 'object') { for (var _tid in k.territories) if (k.territories[_tid]) _territoryIds.push(_tid); }
        }
        var _territoryMap = {};
        for (var _tmi = 0; _tmi < _territoryIds.length; _tmi++) _territoryMap[_territoryIds[_tmi]] = true;
        var kTowns = world.towns.filter(function(t) { return _territoryMap[t.id]; });
        var totalPop = 0;
        for (var i = 0; i < kTowns.length; i++) totalPop += kTowns[i].population || 0;

        // Guards: aim for 1 guard per 200 population, minimum 2 per town
        var desiredGuards = Math.max(kTowns.length * 2, Math.floor(totalPop / 200));
        var currentGuards = k._employees.guards.length;
        var pendingGuards = k._employeePostings.filter(function(p) { return p.type === 'guard'; }).reduce(function(s, p) { return s + (p.slotsTotal - p.slotsFilled); }, 0);

        if (currentGuards + pendingGuards < desiredGuards && treasury > 2000) {
            var hireGuards = Math.min(5, desiredGuards - currentGuards - pendingGuards);
            if (hireGuards > 0) {
                var guardPay = 15 + Math.floor(rng.random() * 10); // 15-24g/week
                k._employeePostings.push({
                    id: 'emp_guard_' + world.day + '_' + Math.floor(rng.random() * 9999),
                    type: 'guard', towns: kTowns.map(function(t) { return t.id; }),
                    slotsTotal: hireGuards, slotsFilled: 0,
                    weeklyPay: guardPay, reservedGold: 0, postedDay: world.day
                });
            }
        }

        // Royal Guards: aim for 3-6 based on assassination risk
        var assRisk = 0;
        try { assRisk = k.assassinationRisk || 0; } catch(e) {}
        var desiredRG = assRisk > 50 ? 6 : assRisk > 25 ? 4 : 3;
        var currentRG = k._employees.royalGuards.length;
        var pendingRG = k._employeePostings.filter(function(p) { return p.type === 'royal_guard'; }).reduce(function(s, p) { return s + (p.slotsTotal - p.slotsFilled); }, 0);

        if (currentRG + pendingRG < desiredRG && treasury > 3000) {
            var hireRG = Math.min(3, desiredRG - currentRG - pendingRG);
            if (hireRG > 0) {
                k._employeePostings.push({
                    id: 'emp_rg_' + world.day + '_' + Math.floor(rng.random() * 9999),
                    type: 'royal_guard', towns: kTowns.map(function(t) { return t.id; }),
                    slotsTotal: hireRG, slotsFilled: 0,
                    weeklyPay: 35 + Math.floor(rng.random() * 15), reservedGold: 0, postedDay: world.day
                });
            }
        }

        // Procurers: aim for 2-4 based on kingdom size
        var desiredProc = Math.min(4, Math.max(2, Math.floor(kTowns.length / 3)));
        var currentProc = k._employees.procurers.length;
        var pendingProc = k._employeePostings.filter(function(p) { return p.type === 'procurer'; }).reduce(function(s, p) { return s + (p.slotsTotal - p.slotsFilled); }, 0);

        if (currentProc + pendingProc < desiredProc && treasury > 2500) {
            var hireProc = Math.min(2, desiredProc - currentProc - pendingProc);
            if (hireProc > 0) {
                k._employeePostings.push({
                    id: 'emp_proc_' + world.day + '_' + Math.floor(rng.random() * 9999),
                    type: 'procurer', towns: kTowns.map(function(t) { return t.id; }),
                    slotsTotal: hireProc, slotsFilled: 0,
                    weeklyPay: 20 + Math.floor(rng.random() * 15), reservedGold: 0, postedDay: world.day
                });
            }
        }

        // AI procurement orders: during war, stock up military; peacetime, stock essentials
        if (!k._procurementOrders) k._procurementOrders = [];
        if (currentProc > 0 && k._procurementOrders.length < 5) {
            var atWar = k.atWar && k.atWar.size > 0;
            if (atWar) {
                var milNeeds = ['swords', 'armor', 'bows', 'arrows'];
                for (var mi = 0; mi < milNeeds.length; mi++) {
                    var stock = (k.militaryStockpile || {})[milNeeds[mi]] || 0;
                    if (stock < 30 && k._procurementOrders.filter(function(o) { return o.goodId === milNeeds[mi] && o.remaining > 0; }).length === 0) {
                        k._procurementOrders.push({
                            id: 'pord_ai_' + world.day + '_' + Math.floor(rng.random() * 9999),
                            goodId: milNeeds[mi], remaining: 20 + Math.floor(rng.random() * 20),
                            filled: 0, maxPrice: 100, createdDay: world.day
                        });
                        break; // one new order per tick
                    }
                }
            } else if (treasury > 5000) {
                // Peacetime: stock food and essential trade goods
                var peaceGoods = ['bread', 'wheat', 'cloth', 'tools'];
                var picked = peaceGoods[Math.floor(rng.random() * peaceGoods.length)];
                var existingOrder = k._procurementOrders.filter(function(o) { return o.goodId === picked && o.remaining > 0; });
                if (existingOrder.length === 0) {
                    k._procurementOrders.push({
                        id: 'pord_ai_' + world.day + '_' + Math.floor(rng.random() * 9999),
                        goodId: picked, remaining: 15 + Math.floor(rng.random() * 15),
                        filled: 0, maxPrice: 50, createdDay: world.day
                    });
                }
            }
        }
    }

    // ── Soldier Transfers Tick: soldiers arrive at destination ──
    function _tickSoldierTransfers(k) {
        if (!k._soldierTransfers || k._soldierTransfers.length === 0) return;
        var dayNow = world.day;
        for (var si = k._soldierTransfers.length - 1; si >= 0; si--) {
            var tr = k._soldierTransfers[si];
            if (dayNow >= tr.arrivalDay) {
                var toTown = findTown(tr.toTownId);
                if (toTown && toTown.kingdomId === k.id) {
                    toTown.garrison = (toTown.garrison || 0) + tr.count;
                    Engine.logHiddenEvent('🏰 ' + tr.count + ' soldiers arrived at ' + toTown.name + '.', { kingdomId: k.id }, _eventKingdomCategory(k.id));
                } else {
                    // Town changed hands during transfer — soldiers lost
                    Engine.logHiddenEvent('⚠️ ' + tr.count + ' soldiers arrived at a town no longer controlled. They dispersed.', { kingdomId: k.id }, _eventKingdomCategory(k.id));
                }
                k._soldierTransfers.splice(si, 1);
            }
        }
    }


    // ========================================================
    // §14 DIPLOMACY & KINGDOM AI TICK
    // ========================================================

    // Check if the player is king of the given kingdom
    function _isPlayerKingOf(k) {
        try {
            return Player && Player.isPlayerKing && Player.isPlayerKing() &&
                   Player.state && Player.state.kingState &&
                   Player.state.kingState.kingdomId === k.id;
        } catch (e) { return false; }
    }

    // v9p33river375: kingdom AI events must stay foreign for non-player kingdoms.
    function _eventKingdomCategory(kingdomId) {
        try {
            if (typeof Player !== 'undefined' && kingdomId) {
                var _playerCit = Player.citizenshipKingdomId || (Player.state && Player.state.citizenshipKingdomId);
                if (_playerCit === kingdomId) return 'my_kingdom';
                var _playerTownId = Player.townId || (Player.state && Player.state.townId);
                if (_playerTownId) {
                    var _playerTown = findTown(_playerTownId);
                    if (_playerTown && _playerTown.kingdomId === kingdomId) return 'my_kingdom';
                }
            }
        } catch (e) {}
        return 'foreign_kingdoms';
    }
    function _eventEitherKingdomCategory(kingdomAId, kingdomBId) {
        return _eventKingdomCategory(kingdomAId) === 'my_kingdom' || _eventKingdomCategory(kingdomBId) === 'my_kingdom'
            ? 'my_kingdom'
            : 'foreign_kingdoms';
    }

    // Generate an advisor suggestion for the player-king instead of AI executing
    function _addAdvisorSuggestion(k, category, icon, title, desc, actionId, actionData) {
        if (!k._advisorSuggestions) k._advisorSuggestions = [];
        // Don't duplicate suggestions of the same type within 10 days
        for (var _si = 0; _si < k._advisorSuggestions.length; _si++) {
            if (k._advisorSuggestions[_si].actionId === actionId) return;
        }
        // Cap at 12 suggestions
        if (k._advisorSuggestions.length >= 12) k._advisorSuggestions.shift();
        k._advisorSuggestions.push({
            id: actionId + '_' + (world.day || 0),
            category: category,
            icon: icon,
            title: title,
            desc: desc,
            actionId: actionId,
            actionData: actionData || {},
            createdDay: world.day || 0
        });
    }

    // Generate suggestions that mirror what kingdomAI would have done
    function _generateKingAISuggestions(k) {
        var rng = world.rng;
        var happiness = k.happiness || 50;
        var gold = k.gold || 0;
        // v9p33river334: advisor suggestions must handle Set/array/object legacy war state.
        var _suggWarCount = k.atWar ? (typeof k.atWar.size === 'number' ? k.atWar.size : (Array.isArray(k.atWar) ? k.atWar.length : (typeof k.atWar === 'object' ? Object.keys(k.atWar).filter(function(id) { return k.atWar[id]; }).length : 0))) : 0;
        var atWar = _suggWarCount > 0;
        var pers = k.kingPersonality || {};

        // Wartime suggestions
        if (atWar) {
            var soldiers = ((_tickCache.soldiersByKingdom || {})[k.id] || []).length;
            if (soldiers < 20) {
                _addAdvisorSuggestion(k, 'military', '🪖', 'Recruit More Soldiers',
                    'Your Majesty, our army is thin with only ' + soldiers + ' soldiers. We should recruit more fighters.',
                    'recruit_soldiers', { urgency: 'high' });
            }
            // Weapon procurement
            var stockpile = k.militaryStockpile || {};
            if ((stockpile.swords || 0) < soldiers * 0.5) {
                _addAdvisorSuggestion(k, 'military', '⚔️', 'Procure Weapons',
                    'We are short on swords. Many soldiers are under-equipped for battle.',
                    'procure_weapons', { item: 'swords', needed: Math.max(10, soldiers - (stockpile.swords || 0)) });
            }
            // Fortify borders
            var borderTowns = [];
            try {
                var kTowns = world.towns.filter(function(t) { return t.kingdomId === k.id; });
                for (var _bti = 0; _bti < kTowns.length; _bti++) {
                    if ((kTowns[_bti].garrison || 0) < 15) borderTowns.push(kTowns[_bti]);
                }
            } catch (e) {}
            if (borderTowns.length > 0) {
                _addAdvisorSuggestion(k, 'military', '🏰', 'Reinforce Town Garrisons',
                    borderTowns.length + ' town' + (borderTowns.length > 1 ? 's have' : ' has') + ' weak garrisons. Consider reinforcing defenses.',
                    'fortify_towns', { towns: borderTowns.slice(0, 3).map(function(t) { return t.id; }) });
            }
        }

        // Financial suggestions
        if (gold < 2000) {
            _addAdvisorSuggestion(k, 'economy', '💰', 'Treasury Running Low',
                'The royal treasury holds only ' + Math.floor(gold) + 'g. Consider raising taxes or commissioning trade.',
                'raise_revenue', { urgency: gold < 500 ? 'critical' : 'high' });
        }
        if (gold > 15000 && !atWar) {
            _addAdvisorSuggestion(k, 'economy', '🏗️', 'Invest Treasury Surplus',
                'The treasury overflows with ' + Math.floor(gold) + 'g. Invest in infrastructure or festivals.',
                'invest_surplus', {});
        }

        // Happiness suggestions
        if (happiness < 30) {
            _addAdvisorSuggestion(k, 'welfare', '😟', 'People Are Unhappy',
                'Kingdom happiness is dangerously low at ' + Math.round(happiness) + '%. Lower taxes, distribute food, or hold court.',
                'address_unrest', { urgency: happiness < 20 ? 'critical' : 'high' });
        }

        // Plague
        var plagueTowns = [];
        try {
            plagueTowns = world.towns.filter(function(t) { return t.kingdomId === k.id && t.plagueActive; });
        } catch (e) {}
        if (plagueTowns.length > 0) {
            _addAdvisorSuggestion(k, 'welfare', '🏥', 'Plague Spreading',
                plagueTowns.length + ' town' + (plagueTowns.length > 1 ? 's are' : ' is') + ' afflicted by plague. Send medical supplies or quarantine.',
                'combat_plague', { towns: plagueTowns.map(function(t) { return t.id; }) });
        }

        // Food shortage
        try {
            var hungryTowns = world.towns.filter(function(t) {
                return t.kingdomId === k.id && t.foodShortage;
            });
            if (hungryTowns.length > 0) {
                _addAdvisorSuggestion(k, 'welfare', '🌾', 'Food Shortage',
                    'People are starving in ' + hungryTowns.length + ' town' + (hungryTowns.length > 1 ? 's' : '') + '. Distribute grain immediately.',
                    'food_relief', { urgency: 'critical' });
            }
        } catch (e) {}

        // Infrastructure (peacetime)
        if (!atWar && gold > 3000) {
            try {
                var lowProsperity = world.towns.filter(function(t) {
                    return t.kingdomId === k.id && (t.prosperity || 50) < 35;
                });
                if (lowProsperity.length > 0) {
                    _addAdvisorSuggestion(k, 'infrastructure', '🏗️', 'Towns Need Development',
                        lowProsperity.length + ' town' + (lowProsperity.length > 1 ? 's have' : ' has') + ' low prosperity. Build infrastructure.',
                        'build_infrastructure', { towns: lowProsperity.slice(0, 3).map(function(t) { return t.id; }) });
                }
            } catch (e) {}
        }

        // Diplomatic (peacetime, hostile neighbor)
        if (!atWar) {
            try {
                var hostileK = [];
                for (var _hki = 0; _hki < world.kingdoms.length; _hki++) {
                    var _hk = world.kingdoms[_hki];
                    if (_hk.id === k.id) continue;
                    var rel = (k.relations || {})[_hk.id] || 0;
                    if (rel < -20) hostileK.push(_hk);
                }
                if (hostileK.length > 0) {
                    _addAdvisorSuggestion(k, 'diplomacy', '⚠️', 'Hostile Relations',
                        'Relations with ' + hostileK[0].name + ' are deteriorating. Prepare defenses or seek diplomacy.',
                        'hostile_neighbor', { kingdomId: hostileK[0].id });
                }
            } catch (e) {}
        }

        // Prune old suggestions (>30 days old)
        if (k._advisorSuggestions) {
            k._advisorSuggestions = k._advisorSuggestions.filter(function(s) {
                return (world.day - s.createdDay) < 30;
            });
        }
    }

    function tickDiplomacy() {
        const rng = world.rng;

        for (const k of world.kingdoms) {
            // v9p33river334: normalize per-kingdom maps/war ids locally for legacy saves without mutating shape.
            if (!k.relations) k.relations = {};
            var _kWarIds = [];
            if (k.atWar) {
                if (typeof k.atWar.forEach === 'function') k.atWar.forEach(function(id) { _kWarIds.push(id); });
                else if (Array.isArray(k.atWar)) _kWarIds = k.atWar.slice();
                else if (typeof k.atWar === 'object') { for (var _kwid in k.atWar) if (k.atWar[_kwid]) _kWarIds.push(_kwid); }
            }
            var _kWarMap = {};
            for (var _kwmi = 0; _kwmi < _kWarIds.length; _kwmi++) _kWarMap[_kWarIds[_kwmi]] = true;
            var _kWarCount = _kWarIds.length;
            // ---- War exhaustion tick ----
            tickWarExhaustion(k);
            applyWarExhaustionEffects(k, rng);

            // ---- Relation drift toward 0 ----
            for (const otherId in k.relations) {
                const val = k.relations[otherId];
                if (val > 0) k.relations[otherId] = Math.max(0, val - CONFIG.RELATION_DECAY_RATE);
                else if (val < 0) k.relations[otherId] = Math.min(0, val + CONFIG.RELATION_DECAY_RATE);
            }

            // ---- C5: Shared-enemy bonus (+2 relations/month with kingdoms fighting same enemy) ----
            if (_kWarCount > 0 && world.day % 30 === 0) {
                for (const other of world.kingdoms) {
                    if (!other.relations) other.relations = {};
                    var _otherWarMapSE = {};
                    if (other.atWar) {
                        if (typeof other.atWar.forEach === 'function') other.atWar.forEach(function(id) { _otherWarMapSE[id] = true; });
                        else if (Array.isArray(other.atWar)) { for (var _owsi = 0; _owsi < other.atWar.length; _owsi++) _otherWarMapSE[other.atWar[_owsi]] = true; }
                        else if (typeof other.atWar === 'object') { for (var _owk in other.atWar) if (other.atWar[_owk]) _otherWarMapSE[_owk] = true; }
                    }
                    if (other.id === k.id || _kWarMap[other.id]) continue;
                    // Check if other kingdom is at war with any of our enemies
                    var _sharedEnemies = 0;
                    for (var _sei = 0; _sei < _kWarIds.length; _sei++) {
                        if (_otherWarMapSE[_kWarIds[_sei]]) _sharedEnemies++;
                    }
                    if (_sharedEnemies > 0) {
                        var _seBonus = (CONFIG.SHARED_ENEMY_RELATION_BONUS || 2) * _sharedEnemies;
                        k.relations[other.id] = Math.min(100, (k.relations[other.id] || 0) + _seBonus);
                        other.relations[k.id] = Math.min(100, (other.relations[k.id] || 0) + _seBonus);
                    }
                }
            }

            // ---- C5: Proactive diplomatic AI — Non-Aggression Pacts ----
            if (world.day % 30 === 0 && rng.chance(0.08)) {
                var _napCandidates = world.kingdoms.filter(function(o) {
                    var _activeWar = false;
                    for (var _awid in (world.activeWars || {})) {
                        var _aw = world.activeWars[_awid];
                        if ((_aw.kingdomA === k.id && _aw.kingdomB === o.id) || (_aw.kingdomA === o.id && _aw.kingdomB === k.id)) { _activeWar = true; break; }
                    }
                    // v9p33river334: never create a NAP over an active/malformed war or existing active pact.
                    return o.id !== k.id && !_kWarMap[o.id] && !_activeWar &&
                           (k.relations[o.id] || 0) > -10 && (k.relations[o.id] || 0) < 40 &&
                           !(k.peaceTreaties && k.peaceTreaties[o.id] && world.day < k.peaceTreaties[o.id]);
                });
                if (_napCandidates.length > 0) {
                    var _napTarget = rng.pick(_napCandidates);
                    // Create a non-aggression pact (270 days, ~9 months)
                    if (!k.peaceTreaties) k.peaceTreaties = {};
                    if (!_napTarget.peaceTreaties) _napTarget.peaceTreaties = {};
                    var _napDuration = 270;
                    k.peaceTreaties[_napTarget.id] = world.day + _napDuration;
                    _napTarget.peaceTreaties[k.id] = world.day + _napDuration;
                    // Small relation boost
                    k.relations[_napTarget.id] = Math.min(100, (k.relations[_napTarget.id] || 0) + 5);
                    _napTarget.relations[k.id] = Math.min(100, (_napTarget.relations[k.id] || 0) + 5);
                    logEvent('🕊️ ' + k.name + ' and ' + _napTarget.name + ' sign a non-aggression pact! (' + _napDuration + ' days)',  {
                        type: 'non_aggression_pact',
                        cause: 'Diplomatic negotiations led to a peace agreement',
                        effects: ['Neither kingdom may declare war for ' + _napDuration + ' days', 'Relations +5 both ways'],
                        kingdoms: [k.id, _napTarget.id]
                    }, _eventEitherKingdomCategory(k.id, _napTarget.id));
                }
            }

            // ---- Random relation shifts (border disputes / trade agreements) ----
            if (rng.chance(CONFIG.DISPUTE_CHANCE || 0.03)) {
                const otherKingdoms = world.kingdoms.filter(o => o.id !== k.id);
                if (otherKingdoms.length > 0) {
                    const other = rng.pick(otherKingdoms);
                    if (rng.chance(0.6)) {
                        // Border dispute (60% of events — disputes more common than agreements)
                        const shift = -rng.randInt(CONFIG.DISPUTE_MIN || 8, CONFIG.DISPUTE_MAX || 25);
                        k.relations[other.id] = Math.max(-100, (k.relations[other.id] || 0) + shift);
                        other.relations[k.id] = Math.max(-100, (other.relations[k.id] || 0) + shift);
                        logEvent(`Border dispute between ${k.name} and ${other.name}! Relations worsen.`,  {
                            type: 'border_dispute',
                            cause: 'A territorial disagreement has flared up along the border.',
                            effects: [
                                'Relations dropped by ' + Math.abs(shift) + ' points',
                                'Current relations: ' + Math.round(k.relations[other.id]),
                                (k.relations[other.id] || 0) < CONFIG.RELATION_WAR_THRESHOLD ? '\u26A0\uFE0F Relations are dangerously close to war!' : 'Risk of further escalation exists'
                            ],
                            kingdoms: [k.id, other.id]
                        }, _eventEitherKingdomCategory(k.id, other.id));
                    } else {
                        // L4: Differentiated diplomatic proposals — trade agreements, mutual defense pacts, border accords
                        var _treatyRoll = rng.random();
                        if (_treatyRoll < 0.40) {
                            // TRADE AGREEMENT — deals with goods, tariffs, timed period
                            var _tradeGoods = ['grain', 'cloth', 'iron', 'wood', 'fish', 'spices', 'salt', 'wine'];
                            var _tradeGood = rng.pick(_tradeGoods);
                            var _tradeDuration = rng.randInt(90, 360); // 3 months to 1 year
                            var _tariffReduction = rng.randInt(10, 40); // percentage tariff reduction
                            var shift = rng.randInt(CONFIG.AGREEMENT_MIN || 5, CONFIG.AGREEMENT_MAX || 12);
                            k.relations[other.id] = Math.min(100, (k.relations[other.id] || 0) + shift);
                            other.relations[k.id] = Math.min(100, (other.relations[k.id] || 0) + shift);
                            // Store active treaty
                            if (!k._activeTreaties) k._activeTreaties = [];
                            if (!other._activeTreaties) other._activeTreaties = [];
                            var _treaty = { type: 'trade_agreement', partnerId: other.id, good: _tradeGood, tariffReduction: _tariffReduction, startDay: world.day, endDay: world.day + _tradeDuration };
                            k._activeTreaties.push(_treaty);
                            other._activeTreaties.push({ type: 'trade_agreement', partnerId: k.id, good: _tradeGood, tariffReduction: _tariffReduction, startDay: world.day, endDay: world.day + _tradeDuration });
                            logEvent('📦 Trade Agreement: ' + k.name + ' and ' + other.name + ' agree on ' + _tradeGood + ' trade terms for ' + _tradeDuration + ' days.',  {
                                type: 'trade_agreement',
                                cause: 'Merchants negotiated favorable trade terms for ' + _tradeGood + '.',
                                effects: [
                                    'Relations improved by ' + shift + ' points',
                                    _tariffReduction + '% tariff reduction on ' + _tradeGood,
                                    'Treaty lasts ' + _tradeDuration + ' days',
                                    '+0.3 passive relations boost while active'
                                ],
                                kingdoms: [k.id, other.id]
                            }, _eventEitherKingdomCategory(k.id, other.id));
                        } else if (_treatyRoll < 0.70) {
                            // MUTUAL DEFENSE PACT — defensive only (if attacked, partner helps)
                            var _mdpDuration = rng.randInt(180, 720); // 6 months to 2 years
                            var shift = rng.randInt(3, 8);
                            k.relations[other.id] = Math.min(100, (k.relations[other.id] || 0) + shift);
                            other.relations[k.id] = Math.min(100, (other.relations[k.id] || 0) + shift);
                            if (!k._activeTreaties) k._activeTreaties = [];
                            if (!other._activeTreaties) other._activeTreaties = [];
                            k._activeTreaties.push({ type: 'mutual_defense', partnerId: other.id, startDay: world.day, endDay: world.day + _mdpDuration });
                            other._activeTreaties.push({ type: 'mutual_defense', partnerId: k.id, startDay: world.day, endDay: world.day + _mdpDuration });
                            logEvent('🛡️ Mutual Defense Pact: ' + k.name + ' and ' + other.name + ' pledge to defend each other if attacked.',  {
                                type: 'mutual_defense_pact',
                                cause: 'Both kingdoms see benefit in mutual protection.',
                                effects: [
                                    'Relations improved by ' + shift + ' points',
                                    'If one is attacked (not the aggressor), the other joins the war',
                                    'Weaker than a full alliance — does not apply if you declare war',
                                    'Pact lasts ' + _mdpDuration + ' days',
                                    '+0.2 passive relations boost while active'
                                ],
                                kingdoms: [k.id, other.id]
                            }, _eventEitherKingdomCategory(k.id, other.id));
                        } else {
                            // BORDER ACCORD — allows passage even if laws prohibit
                            var _baDuration = rng.randInt(90, 360);
                            var shift = rng.randInt(2, 6);
                            k.relations[other.id] = Math.min(100, (k.relations[other.id] || 0) + shift);
                            other.relations[k.id] = Math.min(100, (other.relations[k.id] || 0) + shift);
                            if (!k._activeTreaties) k._activeTreaties = [];
                            if (!other._activeTreaties) other._activeTreaties = [];
                            k._activeTreaties.push({ type: 'border_accord', partnerId: other.id, startDay: world.day, endDay: world.day + _baDuration });
                            other._activeTreaties.push({ type: 'border_accord', partnerId: k.id, startDay: world.day, endDay: world.day + _baDuration });
                            logEvent('🤝 Border Accord: ' + k.name + ' and ' + other.name + ' open their borders to each other\'s citizens.',  {
                                type: 'border_accord',
                                cause: 'Diplomatic negotiations opened the borders.',
                                effects: [
                                    'Relations improved by ' + shift + ' points',
                                    'Citizens may cross borders freely even if immigration laws prohibit it',
                                    'Accord lasts ' + _baDuration + ' days',
                                    '+0.1 passive relations boost while active'
                                ],
                                kingdoms: [k.id, other.id]
                            }, _eventEitherKingdomCategory(k.id, other.id));
                        }
                    }
                }
            }

            // ---- C2: Casus Belli tracking (accumulates justification for war) ----
            if (!k._casusBelli) k._casusBelli = {};
            // Border raids (random event that creates war justification)
            if (rng.chance(0.01)) {
                // v9p33river334: stale non-Set atWar must not crash casus-belli target selection.
                var _cbTargets = world.kingdoms.filter(function(o) { return o.id !== k.id && !_kWarMap[o.id]; });
                if (_cbTargets.length > 0) {
                    var _cbTarget = rng.pick(_cbTargets);
                    var _cbAmt = rng.randInt(10, 25);
                    k._casusBelli[_cbTarget.id] = Math.min(100, (k._casusBelli[_cbTarget.id] || 0) + _cbAmt);
                    k.relations[_cbTarget.id] = Math.max(-100, (k.relations[_cbTarget.id] || 0) - Math.floor(_cbAmt * 0.5));
                    logEvent('🗡️ Raiders from ' + _cbTarget.name + ' attack ' + k.name + '\'s border settlements! (+' + _cbAmt + ' casus belli)',  {
                        type: 'border_raid', kingdoms: [k.id, _cbTarget.id],
                        cause: 'Armed raiders from across the border',
                        effects: ['War justification grows', 'Relations worsen by ' + Math.floor(_cbAmt * 0.5)]
                    }, _eventEitherKingdomCategory(k.id, _cbTarget.id));
                }
            }
            // Trade disputes create casus belli
            if (rng.chance(0.008)) {
                var _tdTargets = world.kingdoms.filter(function(o) { return o.id !== k.id && !_kWarMap[o.id] && (k.relations[o.id] || 0) < 0; });
                if (_tdTargets.length > 0) {
                    var _tdTarget = rng.pick(_tdTargets);
                    k._casusBelli[_tdTarget.id] = Math.min(100, (k._casusBelli[_tdTarget.id] || 0) + 15);
                    logEvent('⚖️ Trade dispute between ' + k.name + ' and ' + _tdTarget.name + '! Merchants demand action. (+15 casus belli)',  {
                        type: 'trade_dispute', kingdoms: [k.id, _tdTarget.id]
                    }, _eventEitherKingdomCategory(k.id, _tdTarget.id));
                }
            }
            // Insults between kings (personality-driven)
            if (rng.chance(0.005) && (k.kingPersonality || {}).temperament === 'aggressive') {
                var _insTargets = world.kingdoms.filter(function(o) { return o.id !== k.id && !_kWarMap[o.id]; });
                if (_insTargets.length > 0) {
                    var _insTarget = rng.pick(_insTargets);
                    k._casusBelli[_insTarget.id] = Math.min(100, (k._casusBelli[_insTarget.id] || 0) + 20);
                    _insTarget._casusBelli = _insTarget._casusBelli || {};
                    _insTarget._casusBelli[k.id] = Math.min(100, (_insTarget._casusBelli[k.id] || 0) + 10);
                    k.relations[_insTarget.id] = Math.max(-100, (k.relations[_insTarget.id] || 0) - 5);
                    _insTarget.relations[k.id] = Math.max(-100, (_insTarget.relations[k.id] || 0) - 5);
                    logEvent('😤 The king of ' + k.name + ' publicly insults ' + _insTarget.name + '! Diplomatic relations sour.',  {
                        type: 'diplomatic_insult', kingdoms: [k.id, _insTarget.id],
                        effects: ['Casus belli grows', 'Relations -5 both ways']
                    }, _eventEitherKingdomCategory(k.id, _insTarget.id));
                }
            }
            // Decay casus belli over time
            for (var _cbKey in k._casusBelli) {
                if (k._casusBelli[_cbKey] > 0) {
                    k._casusBelli[_cbKey] = Math.max(0, k._casusBelli[_cbKey] - (CONFIG.CASUS_BELLI_DECAY_PER_DAY || 0.5));
                }
            }

            // ---- C2: Periodic war evaluation (every 30-90 days based on personality) ----
            var _warEvalInterval = (k.kingPersonality || {}).temperament === 'aggressive'
                ? (CONFIG.WAR_EVAL_MIN_INTERVAL || 30)
                : ((k.kingPersonality || {}).ambition === 'ambitious'
                    ? rng.randInt(CONFIG.WAR_EVAL_MIN_INTERVAL || 30, 60)
                    : (CONFIG.WAR_EVAL_MAX_INTERVAL || 90));
            if (!k._lastWarEvalDay) k._lastWarEvalDay = world.day - _warEvalInterval;

            // ---- War declaration (original + casus belli enhanced + C3 improvements) ----
            for (const other of world.kingdoms) {
                if (other.id === k.id || (k.atWar && k.atWar.has(other.id))) continue;
                // Enforce peace treaties
                if (k.peaceTreaties && k.peaceTreaties[other.id] && world.day < k.peaceTreaties[other.id]) continue;
                // Enforce war immunity (devastated kingdoms get recovery time)
                if (other.warImmunityUntil && world.day < other.warImmunityUntil) continue;
                const rel = k.relations[other.id] || 0;
                let warChance = 0;
                // C3: Lowered from CONFIG.RELATION_WAR_THRESHOLD (-20) to -30
                if (rel < -30) {
                    warChance = CONFIG.WAR_CHANCE_PER_DAY;
                    // Marriage alliance halves war chance
                    if (k._marriageAlliances && k._marriageAlliances[other.id] && world.day < k._marriageAlliances[other.id]) {
                        warChance *= 0.5;
                    }
                }

                // C2: Casus belli provides additional war trigger
                var _cbScore = (k._casusBelli && k._casusBelli[other.id]) || 0;
                var _cbWarThreshold = CONFIG.CASUS_BELLI_WAR_THRESHOLD || -40;
                var _cbExhMax = CONFIG.CASUS_BELLI_EXHAUSTION_MAX || 30;
                if (_cbScore > 40 && rel < _cbWarThreshold && (k.warExhaustion || 0) < _cbExhMax) {
                    warChance += 0.015 * (_cbScore / 100); // Up to +1.5% daily from strong casus belli
                }

                // C3: Opportunity war — attack neighbors who are already at war with someone else
                if (other.atWar && other.atWar.size > 0 && rel < 0) {
                    var _kp2 = k.kingPersonality || {};
                    if (_kp2.ambition === 'ambitious' || _kp2.temperament === 'aggressive' || _kp2.militarism === 'warlike') {
                        var _oppStr = computeMilitaryStrength(k);
                        var _oppTheirStr = computeMilitaryStrength(other);
                        // C3: Lower military advantage threshold to 1.2x (was 2x for aggressive targeting)
                        if (_oppStr > _oppTheirStr * 1.2 && (k.warExhaustion || 0) < 20) {
                            warChance += 0.015; // Significant opportunity war bonus
                        }
                    }
                }

                // C3: Aggressive kings with 0 exhaustion and military superiority
                var _kpAgg = k.kingPersonality || {};
                if ((_kpAgg.militarism === 'warlike' || _kpAgg.militarism === 'aggressive') && (k.warExhaustion || 0) === 0) {
                    var _aggStr = computeMilitaryStrength(k);
                    var _aggTheirStr = computeMilitaryStrength(other);
                    if (_aggStr > _aggTheirStr * 1.2 && rel < 0) {
                        warChance += 0.008; // Aggressive kings are always looking for fights
                    }
                }

                // C2: Periodic war evaluation — aggressive kings evaluate weak neighbors
                if ((world.day - (k._lastWarEvalDay || 0)) >= _warEvalInterval) {
                    var _kp = k.kingPersonality || {};
                    if (_kp.temperament === 'aggressive' || _kp.ambition === 'ambitious') {
                        var _evalOurStr = computeMilitaryStrength(k);
                        var _evalTheirStr = computeMilitaryStrength(other);
                        // Aggressive kings target kingdoms at < 50% their strength
                        if (_evalOurStr > _evalTheirStr * 2 && rel < 10 && (k.warExhaustion || 0) < _cbExhMax) {
                            warChance += 0.02; // Strong bonus for targeting weak neighbors
                        }
                        // Ambitious kings target wealthy but militarily weak kingdoms
                        if (_kp.ambition === 'ambitious' && _evalOurStr > _evalTheirStr * 1.5 && (other.gold || 0) > (k.gold || 0) * 1.5) {
                            warChance += 0.01;
                        }
                    }
                }

                // Prosperity jealousy: ambitious kings may attack much more prosperous neighbors
                if (k.kingPersonality && k.kingPersonality.ambition === 'ambitious') {
                    var ourAvgProsp = 0, ourTownCount = 0;
                    // v9p33river334: materialize territories once; Array.from inside the loop made this O(n²).
                    var _ourTerritories = k.territories ? (Array.isArray(k.territories) ? k.territories : Array.from(k.territories)) : [];
                    for (var oti = 0; oti < _ourTerritories.length; oti++) {
                        var ot = findTown(_ourTerritories[oti]);
                        if (ot) { ourAvgProsp += (ot.prosperity || 50); ourTownCount++; }
                    }
                    ourAvgProsp = ourTownCount > 0 ? ourAvgProsp / ourTownCount : 50;
                    var theirAvgProsp = 0, theirTownCount = 0;
                    var _theirTerritories = other.territories ? (Array.isArray(other.territories) ? other.territories : Array.from(other.territories)) : [];
                    for (var tti = 0; tti < _theirTerritories.length; tti++) {
                        var tt = findTown(_theirTerritories[tti]);
                        if (tt) { theirAvgProsp += (tt.prosperity || 50); theirTownCount++; }
                    }
                    theirAvgProsp = theirTownCount > 0 ? theirAvgProsp / theirTownCount : 50;
                    if (theirAvgProsp > ourAvgProsp + 25) {
                        warChance += CONFIG.WAR_CHANCE_PER_DAY * 0.5; // Jealousy boost
                    }
                }
                // King mood affects war willingness
                var _wMood = getKingMoodModifiers(k);
                warChance *= (_wMood.warMod || 1.0);
                // Treasury spending AI: war eagerness from wealthy kingdoms
                if (k._warEagerness && k._warEagerness > 0) {
                    warChance += k._warEagerness * 0.001; // +0.1% per point
                    k._warEagerness = Math.max(0, k._warEagerness - 0.5); // decay
                }
                // Big treasury bonus: wealthy kingdoms are more willing to go to war
                if ((k.gold || 0) > 100000 && rel < 0) {
                    var _treasuryWarBonus = Math.min(0.02, ((k.gold || 0) - 100000) / 10000000);
                    warChance += _treasuryWarBonus;
                }
                if (warChance > 0 && rng.chance(warChance)) {
                    // Scout enemy strength before declaring war (M-4)
                    var scoutedEnemy = scoutEnemyStrength(k, other);
                    var ourStrength = computeMilitaryStrength(k);
                    // C3: Lower scouting threshold — declare if we're at least 60% of their strength (was 70%)
                    if (ourStrength >= scoutedEnemy * 0.6) {
                        // Reset war eval timer
                        k._lastWarEvalDay = world.day;
                        // Clear casus belli on war declaration
                        if (k._casusBelli) k._casusBelli[other.id] = 0;

                        if (isPlayerRoyalAdvisorOf(k)) {
                            var _cbJustification = _cbScore > 40 ? ' Casus belli: ' + Math.floor(_cbScore) + '/100.' : '';
                            proposeKingDecision(k, {
                                type: 'declare_war',
                                description: 'Declare war on ' + other.name,
                                details: 'Our military strength: ' + Math.floor(ourStrength) + '. Enemy estimate: ' + Math.floor(scoutedEnemy) + '. Relations: ' + Math.floor(k.relations[other.id] || 0) + '.' + _cbJustification,
                                conviction: Math.min(0.9, 0.5 + ((k.kingPersonality || {}).ambition === 'ambitious' ? 0.15 : 0) + ((k.kingPersonality || {}).temperament === 'aggressive' ? 0.15 : 0) + (_wMood.warMod > 1.5 ? 0.10 : _wMood.warMod < 0.5 ? -0.15 : 0)),
                                execute: (function(kRef, otherRef) { return function() { declareWar(kRef, otherRef); }; })(k, other)
                            });
                        } else if (hasSpecialLaw(k, 'noble_council')) {
                            initiateCouncilVote(k, 'Declare war on ' + other.name,
                                'Our military strength: ' + Math.floor(ourStrength) + '. Enemy estimate: ' + Math.floor(scoutedEnemy) + '. Relations: ' + Math.floor(k.relations[other.id] || 0),
                                'declare_war',
                                (function(kRef, otherRef) { return function() { declareWar(kRef, otherRef); }; })(k, other),
                                { action: 'declare_war', args: { kingdomAId: k.id, kingdomBId: other.id } }
                            );
                        } else {
                            declareWar(k, other);
                        }
                    }
                }
            }
            // Update war eval day
            if ((world.day - (k._lastWarEvalDay || 0)) >= _warEvalInterval) {
                k._lastWarEvalDay = world.day;
            }

            // ---- Alliance formation (relations >= threshold) ----
            // THREAT-BASED ALLIANCES: Small kingdoms ally against growing large ones
            if (!k.alliances) k.alliances = new Set();
            if (!k.allianceMeta) k.allianceMeta = {};

            // Check if any kingdom is much larger/stronger — seek alliances against them
            // Cooldown: only evaluate threat alliances every 30 days
            if ((world.day - (k._lastThreatAllianceCheck || 0)) >= 30) {
                k._lastThreatAllianceCheck = world.day;
            var kStrength = computeMilitaryStrength(k);
            var kTerritorySize = k.territories ? k.territories.size : 0;
            for (const threat of world.kingdoms) {
                if (threat.id === k.id) continue;
                if (k.alliances.has(threat.id)) continue; // already allied
                var threatStr = computeMilitaryStrength(threat);
                var threatSize = threat.territories ? threat.territories.size : 0;
                var threatGold = threat.gold || 0;
                // Is this kingdom a threat? Much stronger military, more territory, or much wealthier
                var isThreat = (threatStr > kStrength * 1.8) || (threatSize > kTerritorySize * 2 && threatSize >= 4) || (threatGold > (k.gold || 0) * 3 && threatGold > 100000);
                if (!isThreat) continue;
                // Look for other small kingdoms to ally with against this threat
                for (const ally of world.kingdoms) {
                    if (ally.id === k.id || ally.id === threat.id) continue;
                    if (k.alliances.has(ally.id)) continue; // already allied
                    if (_kWarMap[ally.id]) continue; // v9p33river334: tolerate missing/non-Set atWar.
                    var allyRel = k.relations[ally.id] || 0;
                    // Lower threshold for threat-based alliances (rel >= 15 instead of 50)
                    if (allyRel < 15) continue;
                    var allyStr = computeMilitaryStrength(ally);
                    var allySize = ally.territories ? ally.territories.size : 0;
                    // Ally must also be threatened by same kingdom
                    var allyThreatened = (threatStr > allyStr * 1.5) || (threatSize > allySize * 1.5);
                    if (!allyThreatened) continue;
                    // Reduced chance — once per 30 days evaluation
                    if (rng.chance(0.15)) {
                        if (!ally.alliances) ally.alliances = new Set();
                        if (!ally.allianceMeta) ally.allianceMeta = {};
                        k.alliances.add(ally.id);
                        ally.alliances.add(k.id);
                        k.allianceMeta[ally.id] = { type: 'defensive', formedDay: world.day, callsHonored: 0, callsRefused: 0, fatigue: 0, reason: 'threat_response' };
                        ally.allianceMeta[k.id] = { type: 'defensive', formedDay: world.day, callsHonored: 0, callsRefused: 0, fatigue: 0, reason: 'threat_response' };
                        logEvent('🛡️ ' + k.name + ' and ' + ally.name + ' form a defensive alliance against the growing power of ' + threat.name + '!',  {
                            type: 'alliance_formed', cause: threat.name + ' military strength and territory threaten smaller kingdoms',
                            effects: ['Defensive pact formed against shared threat', 'Both kingdoms will defend each other if attacked'],
                            kingdoms: [k.id, ally.id]
                        }, _eventEitherKingdomCategory(k.id, ally.id));
                        break; // one alliance per tick
                    }
                }
            }
            } // end 30-day threat alliance cooldown
            for (const other of world.kingdoms) {
                if (other.id === k.id) continue;
                if (!other.alliances) other.alliances = new Set();
                if (!other.allianceMeta) other.allianceMeta = {};
                const rel = k.relations[other.id] || 0;
                // Mood: fearful/worried kings seek alliances at lower relation threshold
                var _aMood = getKingMoodModifiers(k);
                var allianceRelThresh = CONFIG.RELATION_ALLIANCE_THRESHOLD;
                if (_aMood.warMod < 0.8) allianceRelThresh -= 10; // fearful/grieving — more eager for allies
                else if (_aMood.warMod > 1.5) allianceRelThresh += 5; // wrathful/ambitious — picky about allies
                // H3: Shared enemy bonus — kingdoms fighting the same enemy get relation boost
                var _otherWarIds = [];
                if (other.atWar) {
                    if (typeof other.atWar.forEach === 'function') other.atWar.forEach(function(id) { _otherWarIds.push(id); });
                    else if (Array.isArray(other.atWar)) _otherWarIds = other.atWar.slice();
                    else if (typeof other.atWar === 'object') { for (var _owid2 in other.atWar) if (other.atWar[_owid2]) _otherWarIds.push(_owid2); }
                }
                var _otherWarMap = {};
                for (var _owmi = 0; _owmi < _otherWarIds.length; _owmi++) _otherWarMap[_otherWarIds[_owmi]] = true;
                if (_kWarCount > 0 && _otherWarIds.length > 0) {
                    var _sharedEnemy = false;
                    for (var _shwi = 0; _shwi < _kWarIds.length; _shwi++) {
                        if (_otherWarMap[_kWarIds[_shwi]]) _sharedEnemy = true;
                    }
                    if (_sharedEnemy) {
                        allianceRelThresh -= 15; // Much easier to ally when fighting same enemy
                        // Modest daily relation boost for co-belligerents
                        // v9p33river323: was only updating k.relations[other];
                        // diplomatic relations should be symmetric, so update
                        // both sides each tick.
                        var _shBonus = rng.randFloat(0.05, 0.2);
                        // v9p33river334: bound relation boosts immediately so later consumers never see >100.
                        k.relations[other.id] = Math.min(100, (k.relations[other.id] || 0) + _shBonus);
                        if (!other.relations) other.relations = {};
                        other.relations[k.id] = Math.min(100, (other.relations[k.id] || 0) + _shBonus);
                    }
                }
                // H3: Diplomatic kings form alliances easier
                // v9p33river305: no kingPersonality.diplomatic field. Map to
                // non-warlike militarism + fair/kind temperament.
                var _kDip = k.kingPersonality || {};
                if (_kDip.militarism === 'passive' || _kDip.temperament === 'kind' || _kDip.temperament === 'fair') {
                    allianceRelThresh -= 5;
                }
                if (rel >= allianceRelThresh && !k.alliances.has(other.id) && !_kWarMap[other.id]) { // v9p33river334: tolerate malformed atWar.
                    // Daily roll gate — only 3% chance per day to actually form (prevents constant forming/dissolving)
                    if (!rng.chance(0.03)) continue;
                    // Form alliance — most alliances are defensive by default
                    var newAllianceType = rel >= 90 && rng.chance(0.25) ? 'offensive' : 'defensive';
                    if (isPlayerRoyalAdvisorOf(k)) {
                        var _alOther = other;
                        var _alType = newAllianceType;
                        proposeKingDecision(k, {
                            type: 'alliance_proposal',
                            description: 'Form ' + _alType + ' alliance with ' + _alOther.name,
                            details: 'Relations: ' + Math.round(rel) + '. ' + (_alType === 'offensive' ? 'Both kingdoms will support each other in ALL wars.' : 'Both kingdoms will defend each other when attacked.') + ' Their military strength: ~' + Math.floor(computeMilitaryStrength(_alOther)) + '. Treasury: ' + Math.floor(_alOther.gold || 0) + 'g.',
                            conviction: Math.min(0.85, 0.5 + (rel >= 85 ? 0.2 : 0.05) + (_alType === 'defensive' ? 0.1 : 0)),
                            execute: (function(kRef, otherRef, alType) { return function() {
                                kRef.alliances.add(otherRef.id);
                                otherRef.alliances.add(kRef.id);
                                if (!kRef.allianceMeta) kRef.allianceMeta = {};
                                if (!otherRef.allianceMeta) otherRef.allianceMeta = {};
                                kRef.allianceMeta[otherRef.id] = { type: alType, formedDay: world.day, callsHonored: 0, callsRefused: 0, fatigue: 0 };
                                otherRef.allianceMeta[kRef.id] = { type: alType, formedDay: world.day, callsHonored: 0, callsRefused: 0, fatigue: 0 };
                                logEvent('🤝 ' + kRef.name + ' and ' + otherRef.name + ' have formed a ' + alType + ' alliance!',  {
                                    type: 'alliance_formed',
                                    cause: 'Relations reached ' + Math.round(kRef.relations[otherRef.id] || 0) + ' (approved by Royal Advisor).',
                                    effects: [
                                        alType === 'defensive'
                                            ? 'Both kingdoms will defend each other when attacked (after 30-day delay)'
                                            : 'Both kingdoms will support each other in all wars (after 30-day delay)',
                                        'Trade between allied kingdoms is boosted',
                                        'Diplomatic relations are strengthened'
                                    ],
                                    kingdoms: [kRef.id, otherRef.id]
                                }, _eventEitherKingdomCategory(kRef.id, otherRef.id));
                            }; })(k, _alOther, _alType)
                        });
                    } else if (hasSpecialLaw(k, 'noble_council')) {
                        initiateCouncilVote(k, 'Form ' + newAllianceType + ' alliance with ' + other.name,
                            'Relations: ' + Math.round(rel) + '. ' + (newAllianceType === 'offensive' ? 'Both kingdoms will support each other in ALL wars.' : 'Both kingdoms will defend each other when attacked.'),
                            'alliance',
                            (function(kRef, otherRef, alType) { return function() {
                                kRef.alliances.add(otherRef.id);
                                otherRef.alliances.add(kRef.id);
                                if (!kRef.allianceMeta) kRef.allianceMeta = {};
                                if (!otherRef.allianceMeta) otherRef.allianceMeta = {};
                                kRef.allianceMeta[otherRef.id] = { type: alType, formedDay: world.day, callsHonored: 0, callsRefused: 0, fatigue: 0 };
                                otherRef.allianceMeta[kRef.id] = { type: alType, formedDay: world.day, callsHonored: 0, callsRefused: 0, fatigue: 0 };
                                logEvent('🤝 ' + kRef.name + ' and ' + otherRef.name + ' have formed a ' + alType + ' alliance!',  {
                                    type: 'alliance_formed',
                                    cause: 'Noble Council approved the alliance.',
                                    effects: [
                                        alType === 'defensive'
                                            ? 'Both kingdoms will defend each other when attacked (after 30-day delay)'
                                            : 'Both kingdoms will support each other in all wars (after 30-day delay)',
                                        'Trade between allied kingdoms is boosted',
                                        'Diplomatic relations are strengthened'
                                    ],
                                    kingdoms: [kRef.id, otherRef.id]
                                }, _eventEitherKingdomCategory(kRef.id, otherRef.id));
                            }; })(k, other, newAllianceType),
                            { action: 'form_alliance', args: { kingdomAId: k.id, kingdomBId: other.id, allianceType: newAllianceType } }
                        );
                    } else {
                        k.alliances.add(other.id);
                        other.alliances.add(k.id);
                        k.allianceMeta[other.id] = { type: newAllianceType, formedDay: world.day, callsHonored: 0, callsRefused: 0, fatigue: 0 };
                        other.allianceMeta[k.id] = { type: newAllianceType, formedDay: world.day, callsHonored: 0, callsRefused: 0, fatigue: 0 };
                        logEvent(`🤝 ${k.name} and ${other.name} have formed a ${newAllianceType} alliance!`,  {
                            type: 'alliance_formed',
                            cause: 'Relations between ' + k.name + ' and ' + other.name + ' reached ' + Math.round(rel) + ' (threshold: ' + CONFIG.RELATION_ALLIANCE_THRESHOLD + ').',
                            effects: [
                                newAllianceType === 'defensive'
                                    ? 'Both kingdoms will defend each other when attacked (after 30-day delay)'
                                    : 'Both kingdoms will support each other in all wars (after 30-day delay)',
                                'Trade between allied kingdoms is boosted',
                                'Diplomatic relations are strengthened'
                            ],
                            kingdoms: [k.id, other.id]
                        }, _eventEitherKingdomCategory(k.id, other.id));
                    }
                }
                // Alliance breaks if relations drop too low
                if (k.alliances.has(other.id) && rel < (CONFIG.ALLIANCE_BREAK_THRESHOLD || 40)) {
                    k.alliances.delete(other.id);
                    other.alliances.delete(k.id);
                    if (k.allianceMeta) delete k.allianceMeta[other.id];
                    if (other.allianceMeta) delete other.allianceMeta[k.id]; // v9p33river334: legacy allies may lack allianceMeta.
                    logEvent(`💔 The alliance between ${k.name} and ${other.name} has been dissolved!`,  {
                        type: 'alliance_dissolved',
                        cause: 'Relations between ' + k.name + ' and ' + other.name + ' dropped to ' + Math.round(rel) + ', below the alliance maintenance threshold.',
                        effects: [
                            'Mutual defense pact no longer applies',
                            'Trade bonuses between the kingdoms are lost',
                            'Risk of future conflict increases'
                        ],
                        kingdoms: [k.id, other.id]
                    }, _eventEitherKingdomCategory(k.id, other.id));
                }

                // ---- Alliance fatigue decay over time ----
                if (k.allianceMeta[other.id]) {
                    var meta = k.allianceMeta[other.id];
                    var allianceAge = world.day - (meta.formedDay || 0);
                    // Very old alliances (>720 days) can decay — fatigue builds passively
                    if (allianceAge > 720 && rng.chance(0.005)) {
                        meta.fatigue = Math.min(100, (meta.fatigue || 0) + rng.randInt(1, 3));
                        if (meta.fatigue >= 80 && rng.chance(0.02)) {
                            // Ancient, fatigued alliance may dissolve on its own
                            k.alliances.delete(other.id);
                            other.alliances.delete(k.id);
                            if (k.allianceMeta) delete k.allianceMeta[other.id];
                            if (other.allianceMeta) delete other.allianceMeta[k.id]; // v9p33river334: legacy allies may lack allianceMeta.
                            logEvent(`💔 The ancient alliance between ${k.name} and ${other.name} has withered away.`,  {
                                type: 'alliance_decayed',
                                cause: 'The ' + allianceAge + '-day old alliance has succumbed to fatigue and neglect.',
                                effects: [
                                    'Alliance dissolved after ' + allianceAge + ' days',
                                    'Both kingdoms must forge new diplomatic ties'
                                ],
                                kingdoms: [k.id, other.id]
                            }, _eventEitherKingdomCategory(k.id, other.id));
                        }
                    }
                    // Slow natural fatigue recovery during peaceful times
                    if (_kWarCount === 0 && meta.fatigue > 0) { // v9p33river334: guard non-Set atWar.
                        meta.fatigue = Math.max(0, meta.fatigue - 0.1);
                    }
                }
            }

            // ---- L4: Active Treaty Management — passive bonuses + expiration ----
            if (k._activeTreaties && k._activeTreaties.length > 0) {
                for (var _ati = k._activeTreaties.length - 1; _ati >= 0; _ati--) {
                    var _tr = k._activeTreaties[_ati];
                    // Expire old treaties
                    if (world.day >= _tr.endDay) {
                        k._activeTreaties.splice(_ati, 1);
                        continue;
                    }
                    // Cancel treaties with kingdoms we're at war with
                    if (_kWarMap[_tr.partnerId]) { // v9p33river334: guard non-Set atWar.
                        k._activeTreaties.splice(_ati, 1);
                        continue;
                    }
                    // Passive relations boost (daily tiny boost while active)
                    var _passiveBoost = 0;
                    if (_tr.type === 'trade_agreement') _passiveBoost = 0.01; // +0.3/month
                    else if (_tr.type === 'mutual_defense') _passiveBoost = 0.007; // +0.2/month
                    else if (_tr.type === 'border_accord') _passiveBoost = 0.003; // +0.1/month
                    if (_passiveBoost > 0) {
                        k.relations[_tr.partnerId] = Math.min(100, (k.relations[_tr.partnerId] || 0) + _passiveBoost);
                    }
                }
            }

            // ---- Alliance Call to Arms (nuanced evaluation system) ----
            for (const allyId of k.alliances) {
                const ally = findKingdom(allyId);
                if (!ally) continue;
                var _allyWarIds = [];
                if (ally.atWar) {
                    if (typeof ally.atWar.forEach === 'function') ally.atWar.forEach(function(id) { _allyWarIds.push(id); });
                    else if (Array.isArray(ally.atWar)) _allyWarIds = ally.atWar.slice();
                    else if (typeof ally.atWar === 'object') { for (var _awki in ally.atWar) if (ally.atWar[_awki]) _allyWarIds.push(_awki); }
                }
                for (var _awii = 0; _awii < _allyWarIds.length; _awii++) {
                    const enemyId = _allyWarIds[_awii];
                    if (enemyId === k.id) continue;
                    if (_kWarMap[enemyId]) continue;
                    if (k.alliances.has(enemyId)) continue;
                    if (k.peaceTreaties && k.peaceTreaties[enemyId] && world.day < k.peaceTreaties[enemyId]) continue;
                    const enemy = findKingdom(enemyId);
                    if (!enemy) continue;

                    // War age check (ally must have been at war for 30+ days before call)
                    const war = Object.values(world.activeWars || {}).find(w =>
                        (w.kingdomA === allyId && w.kingdomB === enemyId) ||
                        (w.kingdomB === allyId && w.kingdomA === enemyId)
                    );
                    const warAge = war ? world.day - war.startDay : 999;
                    if (warAge < (CONFIG.ALLIANCE_WAR_JOIN_DELAY || 30)) continue;

                    // Determine if this is a defensive war for the ally (they were attacked)
                    var isDefensive = war && war.aggressor === enemyId;
                    var allyMeta = (k.allianceMeta && k.allianceMeta[allyId]) || null;

                    // Defensive alliances only activate when the ally was attacked
                    if (allyMeta && allyMeta.type === 'defensive' && !isDefensive) continue;

                    // Check if alliance strength/fatigue allows the call
                    if (!shouldCallToArms(k, ally, isDefensive, allyMeta)) continue;

                    // Process the call to arms — kingdom decides whether to honor
                    processCallToArms(k, ally, enemy, war, isDefensive, allyMeta);
                }
            }

            // ---- Peace offering (enhanced negotiation) ----
            // Player-king decides peace manually via King UI
            if (_isPlayerKingOf(k)) {
                // Generate advisor suggestion if peace conditions are met
                for (var _ptwi = 0; _ptwi < _kWarIds.length; _ptwi++) {
                    const _ptId = _kWarIds[_ptwi];
                    const _ptOther = findKingdom(_ptId);
                    if (!_ptOther) continue;
                    const _ptMyStr = computeMilitaryStrength(k);
                    const _ptTheirStr = computeMilitaryStrength(_ptOther);
                    const _ptLosing = _ptMyStr < _ptTheirStr;
                    const _ptExh = k.warExhaustion || 0;
                    if (_ptLosing || _ptExh > 40) {
                        var _peaceDesc = 'Our military strength is ' + Math.floor(_ptMyStr) + ' vs ' + _ptOther.name + '\'s ' + Math.floor(_ptTheirStr) + '.';
                        if (_ptExh > 40) _peaceDesc += ' War exhaustion: ' + Math.floor(_ptExh) + '.';
                        if (_ptLosing) _peaceDesc += ' We are losing this war.';
                        _addAdvisorSuggestion(k, 'diplomacy', '🕊️', 'Negotiate Peace with ' + _ptOther.name,
                            _peaceDesc + ' Advisors recommend considering peace negotiations.',
                            'suggest_peace_' + _ptOther.id, { enemyId: _ptOther.id, enemyName: _ptOther.name });
                    }
                }
            } else {
            for (var _pwi = 0; _pwi < _kWarIds.length; _pwi++) {
                const warTargetId = _kWarIds[_pwi];
                const other = findKingdom(warTargetId);
                if (!other) continue;
                // Minimum war duration: no peace for first 90 days
                const warKey = Object.keys(world.activeWars || {}).find(wk => {
                    const w = world.activeWars[wk];
                    return (w.kingdomA === k.id && w.kingdomB === other.id) ||
                           (w.kingdomA === other.id && w.kingdomB === k.id);
                });
                const warData = warKey ? world.activeWars[warKey] : null;
                // v9p33river334: missing war metadata should not make a brand-new war eligible for instant peace.
                if (!warData) continue;
                const warAge = world.day - warData.startDay;
                if (warAge < 90) continue; // wars must last at least 90 days
                // Higher chance of peace if losing
                const myStrength = computeMilitaryStrength(k);
                const theirStrength = computeMilitaryStrength(other);
                const losingFactor = myStrength < theirStrength ? 3 : 1;
                // Duration factor: ramps from 1 to 3 over 360 days past the 90-day minimum
                const durationFactor = Math.min(3, 1 + Math.max(0, warAge - 90) / 180);
                // War exhaustion factor: up to 5× at exhaustion 100
                const exhaustionFactor = 1 + (k.warExhaustion || 0) / 25;
                if (rng.chance(CONFIG.PEACE_CHANCE_PER_DAY * losingFactor * durationFactor * exhaustionFactor)) {
                    // Use enhanced peace negotiation
                    const loser = myStrength < theirStrength ? k : other;
                    const winner = loser === k ? other : k;
                    const result = evaluatePeaceTerms(loser, winner);

                    if (result.accepted) {
                        // If the OTHER side is player-king, convert to peace offer petition
                        if (_isPlayerKingOf(other)) {
                            var _playerK = other;
                            if (!_playerK._pendingPetitions) _playerK._pendingPetitions = [];
                            _playerK._pendingPetitions.push({
                                id: 'peace_offer_' + k.id + '_' + (world.day || 0),
                                type: 'peace_offer',
                                from: k.name,
                                fromId: k.id,
                                title: '🕊️ ' + k.name + ' Seeks Peace',
                                description: k.name + ' has sent envoys requesting peace negotiations. They offer ' + Math.floor(result.offer.gold) + 'g and ' + result.offer.towns.length + ' town(s) as concessions.',
                                day: world.day,
                                peaceTerms: result
                            });
                            _addAdvisorSuggestion(_playerK, 'diplomacy', '🕊️', k.name + ' Offers Peace',
                                k.name + ' has sent peace envoys. Check your Court petitions to review their terms.',
                                'peace_offer_from_' + k.id, { enemyId: k.id, enemyName: k.name });
                        } else {
                            // Apply peace terms
                            loser.gold -= result.offer.gold;
                            winner.gold += result.offer.gold;

                            // Transfer ceded towns
                            for (const cededTownId of result.offer.towns) {
                                const cededTown = transferTown(cededTownId, loser.id, winner.id, 'peace_deal');
                                if (cededTown) {
                                    // Update people in ceded town
                                    // v9p33river323: also update citizenshipKingdomId
                                    // so the town's residents aren't left with stale
                                    // citizenship pointing at the loser kingdom.
                                    for (const p of world.people) {
                                        if (p.alive && p.townId === cededTownId) {
                                            p.kingdomId = winner.id;
                                            if (p.citizenshipKingdomId === loser.id) {
                                                p.citizenshipKingdomId = winner.id;
                                            }
                                        }
                                    }
                                    // Apply servitude if negotiated
                                    if (result.offer.concessions.includes('servitude_of_ceded')) {
                                        imposeServitude(cededTown, winner);
                                    } else {
                                        grantCitizenship(cededTown, winner);
                                    }
                                }
                            }

                            // Apply trade concessions
                            if (result.offer.concessions.includes('lower_tariffs') && loser.laws) {
                                loser.laws.tradeTariff = Math.round(Math.max(0, (loser.laws.tradeTariff || 0.05) * 0.5) * 10000) / 10000;
                            }

                            makePeace(k, other, result.level >= 3, result.level >= 3 ? loser : null);
                        }
                    }
                }
            }
            } // end player-king peace bypass

            // ---- Mutual exhaustion peace (both sides too tired to fight) ----
            // Player-king decides peace manually
            if (_isPlayerKingOf(k)) {
                // Generate advisor suggestion instead
                for (const warTargetId of k.atWar) {
                    const other = findKingdom(warTargetId);
                    if (!other) continue;
                    if ((k.warExhaustion > 60 && (other.warExhaustion || 0) > 60) ||
                        (k._bankruptDays > 60 && (other._bankruptDays || 0) > 60)) {
                        _addAdvisorSuggestion(k, 'diplomacy', '🕊️', 'Seek White Peace with ' + other.name,
                            'Both kingdoms are exhausted from the war. Our war exhaustion is ' + Math.floor(k.warExhaustion || 0) + ' and ' + other.name + '\'s is ' + Math.floor(other.warExhaustion || 0) + '. Advisors recommend ending the war with no concessions.',
                            'suggest_white_peace_' + other.id, { enemyId: other.id, enemyName: other.name });
                    }
                }
            } else {
            for (const warTargetId of k.atWar) {
                const other = findKingdom(warTargetId);
                if (!other) continue;
                if ((k.warExhaustion > 60 && (other.warExhaustion || 0) > 60) ||
                    (k._bankruptDays > 60 && (other._bankruptDays || 0) > 60)) {
                    // If OTHER side is player-king, send peace offer instead
                    if (_isPlayerKingOf(other)) {
                        _addAdvisorSuggestion(other, 'diplomacy', '🕊️', k.name + ' Seeks White Peace',
                            k.name + ' signals willingness for a white peace — both sides are exhausted. War exhaustion: ' + Math.floor(k.warExhaustion || 0) + ' vs our ' + Math.floor(other.warExhaustion || 0) + '.',
                            'enemy_white_peace_' + k.id, { enemyId: k.id, enemyName: k.name });
                    } else {
                        logEvent('🕊️ ' + k.name + ' and ' + other.name + ' agree to a white peace — both sides are exhausted from the war.', {
                            type: 'mutual_exhaustion_peace',
                            cause: 'Both kingdoms have war exhaustion above 60 or have been bankrupt for over 60 days.',
                            effects: ['War ends with no tribute or concessions', 'Both kingdoms begin recovery'],
                            kingdoms: [k.id, other.id]
                        }, 'military');
                        makePeace(k, other, false, null, true);
                    }
                    break;
                }
            }
            } // end mutual exhaustion bypass

            // ---- Multi-front war prioritization: seek peace with weakest enemy ----
            // Player-king decides peace manually
            if (_isPlayerKingOf(k)) {
                if (k.atWar.size > 1 && k.warExhaustion > 30) {
                    _addAdvisorSuggestion(k, 'diplomacy', '⚔️', 'Multi-Front War Pressure',
                        'Your Majesty, we are fighting on ' + k.atWar.size + ' fronts with war exhaustion at ' + Math.floor(k.warExhaustion) + '. Consider suing for peace with the weakest enemy to consolidate forces.',
                        'suggest_multi_front_peace', { fronts: k.atWar.size, exhaustion: Math.floor(k.warExhaustion) });
                }
            } else {
            if (k.atWar.size > 1) {
                var enemies = [];
                for (const eid of k.atWar) {
                    var eK = findKingdom(eid);
                    if (eK) enemies.push({ id: eid, strength: computeMilitaryStrength(eK) });
                }
                enemies.sort(function(a, b) { return a.strength - b.strength; });
                // If losing overall, increase desire to peace the weakest enemy
                if (enemies.length > 1 && k.warExhaustion > 30) {
                    var weakest = findKingdom(enemies[0].id);
                    if (weakest && rng.chance(0.02 * (k.warExhaustion / 50))) {
                        // If weakest enemy is player-king, send peace offer instead
                        if (_isPlayerKingOf(weakest)) {
                            _addAdvisorSuggestion(weakest, 'diplomacy', '🕊️', k.name + ' Seeks Peace (Multi-Front)',
                                k.name + ' is fighting on multiple fronts and signals willingness to end the war with us to consolidate forces.',
                                'enemy_multifront_peace_' + k.id, { enemyId: k.id, enemyName: k.name });
                        } else {
                            logEvent('🕊️ ' + k.name + ' sues for peace with ' + weakest.name + ' to focus on other fronts.', {
                                type: 'multi_front_peace', cause: 'Multi-front war pressure',
                                effects: [k.name + ' seeks to consolidate forces'], kingdoms: [k.id, weakest.id]
                            }, 'military');
                            makePeace(k, weakest, false, null);
                        }
                    }
                }
            }
            } // end multi-front bypass

            // ---- C-2: Financial peace-seeking — broke kingdoms seek peace ----
            // Player-king decides peace manually
            if (_isPlayerKingOf(k)) {
                if (k.atWar.size > 0 && k.gold < 1000 && (k.warExhaustion || 0) > 50) {
                    _addAdvisorSuggestion(k, 'diplomacy', '💸', 'Treasury Depleted — Seek Peace?',
                        'Your Majesty, our treasury has only ' + Math.floor(k.gold) + 'g and war exhaustion is at ' + Math.floor(k.warExhaustion || 0) + '. The kingdom cannot sustain this conflict much longer. Consider negotiating peace.',
                        'suggest_financial_peace', { gold: Math.floor(k.gold), exhaustion: Math.floor(k.warExhaustion || 0) });
                }
            } else {
            if (k.atWar.size > 0 && k.gold < 1000 && (k.warExhaustion || 0) > 50) {
                var _kp = k.kingPersonality || {};
                // Personality affects willingness: brave/ambitious resist, cowardly/cautious agree faster
                var peaceDesperation = 0.03;
                if (_kp.courage === 'cowardly') peaceDesperation = 0.08;
                else if (_kp.courage === 'cautious') peaceDesperation = 0.06;
                else if (_kp.courage === 'brave' && _kp.ambition === 'ambitious') peaceDesperation = 0.01;
                // Mood: fearful/grieving kings seek peace faster, wrathful/ambitious resist
                var _pMood = getKingMoodModifiers(k);
                if (_pMood.warMod < 0.8) peaceDesperation *= 1.5;
                else if (_pMood.warMod > 1.5) peaceDesperation *= 0.5;
                // Bankrupt days increase urgency
                peaceDesperation += (k._bankruptDays || 0) * 0.002;
                for (var _peaceEid of k.atWar) {
                    var _peaceEnemy = findKingdom(_peaceEid);
                    if (_peaceEnemy && rng.chance(peaceDesperation)) {
                        // If enemy is player-king, send peace offer instead
                        if (_isPlayerKingOf(_peaceEnemy)) {
                            _addAdvisorSuggestion(_peaceEnemy, 'diplomacy', '💸', k.name + ' Desperately Seeks Peace',
                                k.name + '\'s treasury is at ' + Math.floor(k.gold) + 'g. They are desperate for peace and may offer favorable terms.',
                                'enemy_financial_peace_' + k.id, { enemyId: k.id, enemyName: k.name });
                        } else {
                            logEvent('🕊️💸 ' + k.name + ' desperately seeks peace with ' + _peaceEnemy.name + ' — the treasury is empty!', {
                                type: 'financial_peace', cause: k.name + ' treasury at ' + Math.floor(k.gold) + 'g with war exhaustion ' + Math.floor(k.warExhaustion || 0),
                                effects: ['War ends — kingdom cannot sustain the conflict', 'Both sides begin recovery'],
                                kingdoms: [k.id, _peaceEnemy.id]
                            }, 'military');
                            makePeace(k, _peaceEnemy, false, null, true);
                        }
                        break;
                    }
                }
            }
            } // end financial peace bypass

            // ---- H-1: Daily base tax collection (smoothed, not seasonal lump) ----
            if (!(k._taxRevoltUntil && world.day < k._taxRevoltUntil)) {
                var dailyBaseTax = 0;
                for (var _txTid of k.territories) {
                    var _txTown = findTown(_txTid);
                    if (_txTown) {
                        var _txSupply = (_txTown.market && _txTown.market.supply) ? _txTown.market.supply : {};
                        // v9p33river333: daily tax must tolerate towns without markets/supply.
                        var _tradeBonus = Object.values(_txSupply).reduce(function(a, b) { return a + b; }, 0) * 0.05;
                        // Same formula as before but divided by 90 (days per season) for daily collection
                        dailyBaseTax += (_txTown.population * k.taxRate * 5 + _tradeBonus) / CONFIG.DAYS_PER_SEASON;
                    }
                }
                if (dailyBaseTax > 0) {
                    k.gold += dailyBaseTax;
                    k.taxRevenue = (k.taxRevenue || 0) + dailyBaseTax;
                }
            }

            // ---- Seasonal tariff + trade tax reset + soldier pay (still per-season) ----
            if (world.day % CONFIG.DAYS_PER_SEASON === 0 && !(k._taxRevoltUntil && world.day < k._taxRevoltUntil)) {
                // Enforce tariff collection on foreign trade (accumulated)
                let tariffRevenue = 0;
                for (const townId of k.territories) {
                    const town = findTown(townId);
                    if (!town) continue;
                    var foreignTraders = getPeopleInTown(town.id).filter(function(p) {
                        return p.kingdomId !== k.id &&
                        (p.occupation === 'merchant' || p.isEliteMerchant);
                    });
                    const tariffRate = (k.laws && k.laws.tradeTariff) || 0;
                    for (const ft of foreignTraders) {
                        const tariff = Math.floor((ft.gold || 0) * tariffRate * 0.1);
                        if (tariff > 0 && (ft.gold || 0) >= tariff) {
                            ft.gold -= tariff;
                            tariffRevenue += tariff;
                        }
                    }
                }
                k.gold += tariffRevenue;

                // Log seasonal summary and reset trade tax accumulator
                var seasonalTradeTotal = (k.tradeTaxRevenue || 0) + tariffRevenue;
                k._lastSeasonTaxRevenue = (k.taxRevenue || 0) + seasonalTradeTotal;
                k.taxRevenue = 0; // reset for next season's daily accumulation
                k.tradeTaxRevenue = 0;

                // Pay soldiers (adjusted by dynamic pay multiplier) — seasonal bonus pay
                var soldiers = ((_tickCache.soldiersByKingdom || {})[k.id] || []);
                const soldierCost = soldiers.length * CONFIG.SOLDIER_UPKEEP * (k.soldierPayMult || 1.0);
                k.gold = Math.max(0, k.gold - soldierCost);

                // ---- C-1: Guard hiring with caps (once per season, with multiple limits) ----
                if (!k._lastGuardHireDay) k._lastGuardHireDay = 0;
                if (world.day - k._lastGuardHireDay >= CONFIG.DAYS_PER_SEASON) {
                    k._lastGuardHireDay = world.day;
                    var _fs = Engine.getKingdomFinancialState(k);
                    // H-3: Only hire guards if treasury > 6 months of upkeep AND not at war
                    if (_fs.canHireGuards && k.gold > CONFIG.KINGDOM_GUARD_HIRE_THRESHOLD) {
                        // C-1: Cap budget at min(treasury * guardBudget, 25% of last season revenue)
                        var rawBudget = Math.floor(k.gold * (k.guardBudget || 0.15));
                        var revenueCap = Math.floor((_fs.lastSeasonRevenue || 1000) * 0.25);
                        var guardBudgetGold = Math.min(rawBudget, revenueCap);
                        var guardsToHire = Math.floor(guardBudgetGold / CONFIG.KINGDOM_GUARD_COST);
                        // C-1: Military-to-income ratio cap: don't hire if already > seasonalRevenue / 2
                        if (_fs.soldierCount > (_fs.lastSeasonRevenue / 2)) guardsToHire = 0;
                        // C-1: Population cap: 3% of total pop
                        var guardRoom = Math.max(0, _fs.maxGuards - _fs.soldierCount);
                        guardsToHire = Math.min(guardsToHire, guardRoom);
                        // M-3: Don't hire if it would dip below reserve
                        var maxSpend = Math.max(0, k.gold - _fs.minReserve);
                        guardsToHire = Math.min(guardsToHire, Math.floor(maxSpend / CONFIG.KINGDOM_GUARD_COST));

                        let hired = 0;
                        for (const townId of k.territories) {
                            if (hired >= guardsToHire) break;
                            const town = findTown(townId);
                            if (!town) continue;
                            var idle = getPeopleInTown(town.id).filter(function(p) {
                                return (p.occupation === 'laborer' || p.occupation === 'none') &&
                                p.age >= CONFIG.COMING_OF_AGE && p.age <= 50;
                            });
                            for (const p of idle) {
                                if (hired >= guardsToHire) break;
                                if (k.gold < CONFIG.KINGDOM_GUARD_COST) break;
                                p.occupation = 'guard';
                                p.skills.combat = Math.max(p.skills.combat, 15);
                                hired++;
                                k.gold -= CONFIG.KINGDOM_GUARD_COST;
                            }
                        }
                    }
                }
            }

            // ---- Kingdom AI priorities ----
            // When player is king: skip AI, generate suggestions instead
            var _playerIsKingHere = _isPlayerKingOf(k);
            const aiInterval = k.atWar.size > 0 ? 7 : 30;
            if (world.day % aiInterval === 0) {
                if (_playerIsKingHere) {
                    _generateKingAISuggestions(k);
                } else {
                    kingdomAI(k);
                }
                tickTownFounding(k);
            }

            // ---- Update kingdom happiness ----
            k.happiness = getKingdomHappiness(k);

            // ---- Noble Council vote processing (daily) ----
            tickCouncilVotes(k);

            // ---- King personal-treasury withdrawal (weekly, runs daily but gated %7) ----
            // v9p33river249: was previously buried inside tickKingMood (season-only) → never fired
            if (Engine.tickKingPersonalWithdrawal) Engine.tickKingPersonalWithdrawal(k);

            // ---- King decisions & rebellion (once per season) ----
            if (world.day % CONFIG.DAYS_PER_SEASON === 0 && world.day > 0) {
                // Recovery: if kingdom has no king or king person is missing/dead, attempt emergency succession
                if (!k.king || !findPerson(k.king) || !findPerson(k.king).alive) {
                    attemptEmergencySuccession(k);
                }
                if (!_playerIsKingHere) {
                    tickKingMood(k);
                    tickKingDecisions(k);
                }
                tickSuccessionCrisis(k);
                // Auto-resolve pending election after 30 days
                if (k._pendingElection && (world.day - k._pendingElection.startDay) >= 30) {
                    _resolvePendingElection(k, null);
                }
                tickRebellion(k);
                tickKingdomHappinessConsequences(k);
                // Player-king decides surrender manually
                if (!_playerIsKingHere) {
                    tickSurrender(k);
                }
                tickNobleAI(k);
                tickKingFamilyAI(k);
            }

            // ---- Revolt kingdom fast AI mode: every 5 days for first 30 days ----
            if (k._revoltFastAIUntil && world.day <= k._revoltFastAIUntil && world.day % 5 === 0 && !_playerIsKingHere) {
                // Run king decisions more frequently so new revolt kingdom can respond to threats
                if (world.day % CONFIG.DAYS_PER_SEASON !== 0) { // skip if already ran this tick
                    tickKingMood(k);
                    tickKingDecisions(k);
                }
                // Revolt survival AI: prioritize defense, diplomacy, and economic stability
                _tickRevoltSurvivalAI(k);
            }

            // ---- Kingdom purchasing from market (daily) ----
            // Player-king controls purchasing manually
            if (!_playerIsKingHere) {
                tickKingdomPurchasing(k);
            }

            // ---- King travel — royal progress & diplomatic missions (daily) ----
            if (!_playerIsKingHere) {
                tickKingTravel(k);
            }

            // ---- AI King employee management (monthly) ----
            if (!_playerIsKingHere && world.day % 30 === 0) {
                _aiKingHireEmployees(k, rng);
            }

            // ---- Process pending RA consultation decisions (daily) ----
            if (!_playerIsKingHere) {
                tickPendingKingDecisions(k);
            }

            // ---- Directed player commissions (daily deadline check) ----
            checkDirectedCommissionDeadline(k);

            // ---- Royal Feast system (daily) ----
            // Always tick feasts: activates pending feasts/courts, ends expired, runs events.
            // NPC auto-scheduling is guarded inside the function itself.
            tickKingdomFeasts(k);
            tickKingdomFestivals(k);

            // ---- AI Court system (daily check, runs every 30-60 days) ----
            // NPC-only: AI king processes petitions automatically
            if (!_playerIsKingHere) {
                tickKingdomCourt(k);
            }

            // ---- H2: Noble personality influence on governance (monthly) ----
            if (world.day % 30 === 0 && typeof Engine.tickNobleInfluence === 'function') Engine.tickNobleInfluence(k);
            // ---- Noble policy advocacy (weekly) ----
            if (world.day % 7 === 0 && typeof Engine.tickNoblePolicyAdvocacy === 'function') Engine.tickNoblePolicyAdvocacy(k);
            // ---- NPC local conversations (every 3 days) ----
            if (world.day % 3 === 0 && typeof Engine.tickLocalConversations === 'function') Engine.tickLocalConversations(k);
            // ---- Noble conspiracies & king unrest response (monthly) ----
            if (world.day % 30 === 0) {
                tickNobleConspiracies(k);
                if (!_playerIsKingHere) {
                    tickKingUnrestResponse(k);
                }
            }
            // ---- AI King proactive loyalty management (every 14 days) ----
            if (world.day % 14 === 0 && !_playerIsKingHere) {
                tickAIKingLoyaltyManagement(k);
            }

            // ---- Process recruitment postings (NPCs decide to enlist) ----
            _tickRecruitmentPostings(k, rng);

            // ---- Process employee postings (guards, procurers, royal guards) ----
            _tickEmployeePostings(k, rng);
            _tickProcurers(k, rng);
            _tickEmployeeWages(k);

            // ---- Process soldier transfers (arrivals) ----
            _tickSoldierTransfers(k);

            // ---- Update military strength and soldier count ----
            k.militaryStrength = computeMilitaryStrength(k);
            k.soldiers = ((_tickCache.soldiersByKingdom || {})[k.id] || []).length;

            // ---- Update prosperity ----
            const kTowns = world.towns.filter(t => t.kingdomId === k.id);
            if (kTowns.length > 0) {
                k.prosperity = kTowns.reduce((s, t) => s + t.prosperity, 0) / kTowns.length;
            }
        }

        // ---- Noble building income (every 10 days) ----
        tickNobleIncome();

        // ---- Noble relationships & king loyalty (every 30 days) ----
        tickNobleRelationships();

        // ---- M4: Noble personality-driven actions (every 30 days, offset) ----
        tickNoblePersonalityActions();

        // ---- Process construction & repair timers (daily) ----
        tickKingdomConstruction();

        // ---- Tick treaties (reparations, violations, expiry) ----
        tickTreaties();

        // ---- Check war goals for auto-peace ----
        checkWarGoals();
    }

    function declareWar(a, b, isStartingWar) {
        _syncState();
        // --- CHECK NON-AGGRESSION PACT ---
        var napTreaty = wouldViolateNonAggression(a.id, b.id);
        if (napTreaty) {
            handleNonAggressionViolation(a, napTreaty);
        }

        // --- M-4: WAR COST ESTIMATION (personality-driven) — skip for game-start wars ---
        if (!isStartingWar) {
            var _afs = Engine.getKingdomFinancialState(a);
            var aSoldiers = _afs.soldierCount;
            var monthlyMilitaryUpkeep = aSoldiers * CONFIG.KINGDOM_SOLDIER_DAILY_COST;
            var expectedRecruitCost = Math.max(0, 50 - aSoldiers) * 75;
            var sixMonthWarCost = (monthlyMilitaryUpkeep * 6) + expectedRecruitCost + 2000;

            var ap = a.kingPersonality || {};
            var warCostThreshold = 0.5;
            if (ap.courage === 'brave') warCostThreshold = 0.3;
            else if (ap.courage === 'cowardly' || ap.courage === 'cautious') warCostThreshold = 0.7;
            if (ap.intelligence === 'brilliant') warCostThreshold = Math.min(warCostThreshold + 0.15, 0.9);
            else if (ap.intelligence === 'clever') warCostThreshold = Math.min(warCostThreshold + 0.1, 0.8);
            else if (ap.intelligence === 'foolish') warCostThreshold = Math.max(warCostThreshold - 0.2, 0.1);
            if (ap.greed === 'greedy' || ap.greed === 'corrupt') warCostThreshold *= 0.7;

            if (a.gold < sixMonthWarCost * warCostThreshold) {
                logEvent(`${a.name}'s advisors warn against war with ${b.name} — the treasury cannot sustain it (${Math.floor(a.gold)}g vs estimated ${Math.floor(sixMonthWarCost)}g needed).`,  {
                    type: 'war_averted', cause: 'Insufficient treasury', effects: ['War declaration cancelled', 'Kingdom saves gold for buildup']
                }, _eventEitherKingdomCategory(a.id, b.id));
                return;
            }
        }

        // --- WAR DECLARATION COST (aggressor pays upfront) ---
        var soldiers = ((_tickCache.soldiersByKingdom || {})[a.id] || []);
        const warDeclarationCost = Math.min(2000, Math.max(500, soldiers.length * 10));
        if (a.gold < warDeclarationCost) {
            logEvent(`${a.name} cannot afford to declare war on ${b.name} (need ${warDeclarationCost}g).`, null, _eventEitherKingdomCategory(a.id, b.id));
            return;
        }
        a.gold -= warDeclarationCost;

        a.atWar.add(b.id);
        b.atWar.add(a.id);

        // H-2: Record war start day on both kingdoms for early-war spending caps
        a._lastWarStartDay = world.day;
        b._lastWarStartDay = world.day;

        // H-2: Trigger immediate financial strategy reassessment (skip during world gen)
        if (!isStartingWar) {
            tickKingdomFinancialStrategy(a);
            tickKingdomFinancialStrategy(b);
        }

        // Generate unique war ID and record war metadata
        const warId = 'war_' + a.id + '_' + b.id + '_day' + world.day;
        if (!world.activeWars) world.activeWars = {};
        const strengthA = computeMilitaryStrength(a);
        const strengthB = computeMilitaryStrength(b);
        world.activeWars[warId] = {
            id: warId,
            kingdomA: a.id,
            kingdomB: b.id,
            startDay: world.day,
            aggressor: a.id,
            strengthAtStart: { [a.id]: strengthA, [b.id]: strengthB },
            originalTowns: { [a.id]: a.territories.size, [b.id]: b.territories.size },
            warGoals: generateWarGoals(a, b, world.rng),
        };

        logEvent(`WAR! ${a.name} declares war on ${b.name}! (War chest: -${warDeclarationCost}g)`, {
            type: 'war_declared',
            cause: 'Relations between ' + a.name + ' and ' + b.name + ' have deteriorated to ' + Math.round(a.relations[b.id] || 0) + '. The threshold for war is ' + CONFIG.RELATION_WAR_THRESHOLD + '.',
            effects: [
                'War declaration cost: ' + warDeclarationCost + 'g deducted from ' + a.name + ' treasury',
                'Ongoing supply costs: 5g per soldier per day',
                'Trade embargoes may be enacted between the kingdoms',
                'Roads between the kingdoms become dangerous',
                'Military recruitment costs doubled during wartime (75g vs 50g)',
                'Merchants traveling between these kingdoms face ambush risk'
            ],
            kingdoms: [a.id, b.id]
        }, 'military');

        // Trade embargo — war often triggers an embargo
        if (world.rng.chance(0.7)) {
            declareEmbargo(a, b);
        }

        // Fire warDeclared event for UI to catch
        world.eventLog.push({
            day: world.day,
            message: `WAR DECLARED: ${a.name} vs ${b.name}`,
            type: 'warDeclared',
            warId: warId,
            kingdomA: a.id,
            kingdomB: b.id,
            nameA: a.name,
            nameB: b.name,
            strengthA: strengthA,
            strengthB: strengthB,
        });

        // Mark roads between warring kingdoms as unsafe
        for (const road of world.roads) {
            const fromTown = findTown(road.fromTownId);
            const toTown = findTown(road.toTownId);
            if (fromTown && toTown) {
                if ((fromTown.kingdomId === a.id && toTown.kingdomId === b.id) ||
                    (fromTown.kingdomId === b.id && toTown.kingdomId === a.id)) {
                    road.safe = false;
                }
            }
        }
        // Mood: defender becomes fearful, aggressor becomes ambitious
        setKingMood(b, 'fearful', 'war declared by ' + a.name);
        if (a.kingPersonality && a.kingPersonality.courage === 'brave') {
            setKingMood(a, 'ambitious', 'declared war on ' + b.name);
        }

        // L4: Mutual defense pact activation — defender's MDP partners join the war
        if (b._activeTreaties) {
            var _mdpRng = world.rng;
            for (var _mdpi = 0; _mdpi < b._activeTreaties.length; _mdpi++) {
                var _mdp = b._activeTreaties[_mdpi];
                if (_mdp.type !== 'mutual_defense') continue;
                if (world.day >= _mdp.endDay) continue;
                var _mdpPartner = findKingdom(_mdp.partnerId);
                if (!_mdpPartner || _mdpPartner.id === a.id) continue;
                if (_mdpPartner.atWar && _mdpPartner.atWar.has(a.id)) continue; // already at war
                // Partner evaluates — personality and strength factor
                var _mdpPers = _mdpPartner.kingPersonality || {};
                var _honorChance = 0.65; // 65% base chance to honor defense pact
                if (_mdpPers.loyalty === 'loyal' || (_mdpPers.loyalty || 50) > 65) _honorChance += 0.15;
                if (_mdpPers.courage === 'cowardly' || (_mdpPers.courage || 50) < 30) _honorChance -= 0.25;
                var _mdpStr = computeMilitaryStrength(_mdpPartner);
                var _aggStr = computeMilitaryStrength(a);
                if (_mdpStr < _aggStr * 0.3) _honorChance -= 0.3; // too weak to help
                if (_mdpRng.chance(Math.max(0.1, _honorChance))) {
                    _mdpPartner.atWar.add(a.id);
                    a.atWar.add(_mdpPartner.id);
                    _mdpPartner._lastWarStartDay = world.day;
                    logEvent('🛡️ ' + _mdpPartner.name + ' honors their mutual defense pact with ' + b.name + ' and declares war on ' + a.name + '!',  {
                        type: 'war_declared',
                        cause: 'Mutual defense pact with ' + b.name + ' triggered by ' + a.name + '\'s aggression.',
                        effects: [_mdpPartner.name + ' joins the war against ' + a.name],
                        kingdoms: [_mdpPartner.id, a.id]
                    }, _eventEitherKingdomCategory(_mdpPartner.id, a.id));
                }
            }
        }
    }

    function makePeace(a, b, isSurrender, loser, isExhaustion) {
        // Story mode: block peace between Valdren and Korvath while war is active in story
        if (typeof StoryMode !== 'undefined' && StoryMode.isActive && StoryMode.isActive()) {
            var _smFlags = StoryMode.getStoryFlags ? StoryMode.getStoryFlags() : {};
            if (_smFlags.warDeclared && !_smFlags.warEnded) {
                var _aName = (a.name || '').toLowerCase();
                var _bName = (b.name || '').toLowerCase();
                if ((_aName === 'valdren' && _bName === 'korvath') || (_aName === 'korvath' && _bName === 'valdren')) {
                    return; // War cannot end during active story
                }
            }
        }
        a.atWar.delete(b.id);
        b.atWar.delete(a.id);
        a.relations[b.id] = 0;
        b.relations[a.id] = 0;

        // Lift trade embargo on peace
        if (hasEmbargo(a.id, b.id)) {
            liftEmbargo(a, b);
        }

        // Find and close the active war
        let warId = null;
        let winner = null;
        if (world.activeWars) {
            for (const wid in world.activeWars) {
                const w = world.activeWars[wid];
                if ((w.kingdomA === a.id && w.kingdomB === b.id) ||
                    (w.kingdomA === b.id && w.kingdomB === a.id)) {
                    warId = wid;
                    if (isSurrender && loser) {
                        winner = loser.id === a.id ? b : a;
                    }
                    break;
                }
            }
        }

        if (isSurrender && loser) {
            const winnerK = loser.id === a.id ? b : a;

            // Tribute: loser pays 50% of treasury
            const tribute = Math.floor(loser.gold * 0.5);
            loser.gold -= tribute;
            winnerK.gold += tribute;

            logEvent(`${loser.name} surrenders to ${winnerK.name}! The war is over.`, {
                type: 'surrender',
                cause: loser.name + '\'s military was defeated and could no longer sustain the war.',
                effects: [
                    loser.name + ' pays ' + tribute + 'g tribute (50% of treasury)',
                    '720-day peace treaty enforced',
                    'Towns may be ceded to ' + winnerK.name,
                    loser.name + '\'s international reputation suffers'
                ],
                kingdoms: [loser.id, winnerK.id]
            }, 'military');

            // Peace treaty terms handled by createTreaty below

            // Territorial concessions handled by createTreaty below
        } else {
            logEvent(`Peace! ${a.name} and ${b.name} have ended their war.`, {
                type: 'peace',
                cause: 'Both kingdoms agreed to end hostilities.',
                effects: [
                    'Trade routes between kingdoms reopen',
                    'Road safety improves',
                    'Military demobilization begins'
                ],
                kingdoms: [a.id, b.id]
            }, 'military');
        }

        // Fire warEnded event
        world.eventLog.push({
            day: world.day,
            message: isSurrender ? `${loser ? loser.name : 'A kingdom'} surrenders!` : `Peace between ${a.name} and ${b.name}`,
            type: 'warEnded',
            warId: warId,
            kingdomA: a.id,
            kingdomB: b.id,
            winner: winner ? (winner.id || winner) : null,
            isSurrender: !!isSurrender,
        });

        // Mood: only set victor/loser moods if there was an actual winner
        if (winner && loser) {
            setKingMood(winner, 'jubilant', 'won the war against ' + loser.name);
            setKingMood(loser, 'wrathful', 'lost the war against ' + winner.name);
        } else {
            // White/negotiated peace — both relieved
            setKingMood(a, 'content', 'peace with ' + b.name);
            setKingMood(b, 'content', 'peace with ' + a.name);
        }

        // Clean up active war
        if (world.activeWars && warId) {
            delete world.activeWars[warId];
        }

        // Restore road safety
        for (const road of world.roads) {
            road.safe = isRoadSafe(road);
        }

        // Remove armies targeting the other
        world.armies = world.armies.filter(army =>
            !(army.kingdomId === a.id && army.targetKingdomId === b.id) &&
            !(army.kingdomId === b.id && army.targetKingdomId === a.id)
        );

        // Create binding peace treaty
        createTreaty(a, b, isSurrender, loser, !!isExhaustion);

        // Reset war exhaustion partially on peace
        a.warExhaustion = Math.max(0, (a.warExhaustion || 0) - 20);
        b.warExhaustion = Math.max(0, (b.warExhaustion || 0) - 20);
    }

    // ========================================================
    // §14B KING DECISIONS (called each season)
    // ========================================================
    function tickKingDecisions(k) {
        if (!k.king) return; // Guard: skip kingless kingdoms
        const rng = world.rng;
        const treasury = k.gold;
        const happiness = k.happiness != null ? k.happiness : 50;
        const atWar = k.atWar.size > 0;
        const p = k.kingPersonality;
        if (!p) return; // Guard: no personality data
        // King mood modifiers affect all decisions
        var mood = getKingMoodModifiers(k);

        // 1. TAX ADJUSTMENT (H-4 enhanced — personality-driven, prosperity-aware)
        // Personality-based max tax caps
        let maxTaxRate = 0.25;
        if (p.greed === 'generous') maxTaxRate = 0.10;
        else if (p.greed === 'fair') maxTaxRate = 0.15;
        else if (p.greed === 'greedy') maxTaxRate = 0.20;
        else if (p.greed === 'corrupt') maxTaxRate = 0.25;

        // Personality-based min "comfort" tax (kings won't voluntarily go below this)
        var minComfortTax = 0.05;
        if (p.greed === 'generous') minComfortTax = 0.03;
        else if (p.greed === 'greedy') minComfortTax = 0.08;
        else if (p.greed === 'corrupt') minComfortTax = 0.10;

        var _prevTaxRate = k.taxRate;
        var startGold = k._startingGold || 10000;
        var avgProsperity = 0;
        var _prosTownCount = 0;
        for (var _ptid of k.territories) {
            var _ptown = findTown(_ptid);
            if (_ptown) { avgProsperity += (_ptown.prosperity || 50); _prosTownCount++; }
        }
        avgProsperity = _prosTownCount > 0 ? avgProsperity / _prosTownCount : 50;

        // --- TAX RAISING logic (personality-driven) ---
        if (p.greed === 'greedy' || p.greed === 'corrupt') {
            // Greedy/corrupt: raise taxes frequently, especially when treasury is low
            var raiseChance = 0.25 + (k.gold < startGold * 0.5 ? 0.15 : 0);
            if (p.greed === 'corrupt') raiseChance += 0.10;
            var raiseAmt = rng.randFloat(0.01, 0.03) + (mood.taxMod > 0 ? mood.taxMod : 0);
            if (rng.chance(raiseChance) && k.taxRate < maxTaxRate) {
                k.taxRate = Math.min(maxTaxRate, k.taxRate + raiseAmt);
            }
        } else if (k.gold < startGold * 0.3) {
            // Any king raises taxes when treasury dangerously low
            var despRaiseChance = 0.15;
            if (p.intelligence === 'brilliant') despRaiseChance = 0.25; // smart kings react faster
            else if (p.intelligence === 'clever') despRaiseChance = 0.20;
            else if (p.intelligence === 'dim') despRaiseChance = 0.08;
            var despAmt = rng.randFloat(0.01, 0.02);
            if (rng.chance(despRaiseChance) && k.taxRate < maxTaxRate - 0.02) {
                k.taxRate = Math.min(maxTaxRate, k.taxRate + despAmt);
            }
        }

        // --- TAX LOWERING logic (H-4: proactive prosperity/wealth-driven) ---
        // A. Wealthy treasury: lower taxes to boost trade and prosperity
        if (k.gold > startGold * 2 && k.taxRate > 0.08) {
            var wealthLowerChance = 0.08;
            var wealthLowerAmt = rng.randFloat(0.01, 0.02);
            if (p.greed === 'generous') { wealthLowerChance = 0.25; wealthLowerAmt = rng.randFloat(0.02, 0.03); }
            else if (p.greed === 'fair') { wealthLowerChance = 0.15; wealthLowerAmt = rng.randFloat(0.01, 0.02); }
            else if (p.intelligence === 'brilliant') { wealthLowerChance = 0.18; wealthLowerAmt = rng.randFloat(0.01, 0.02); }
            else if (p.intelligence === 'clever') wealthLowerChance = 0.12;
            // Greedy/corrupt kings rarely lower even when wealthy
            if (p.greed === 'greedy') wealthLowerChance *= 0.3;
            if (p.greed === 'corrupt') wealthLowerChance *= 0.15;
            if (rng.chance(wealthLowerChance)) {
                k.taxRate = Math.max(minComfortTax, k.taxRate - wealthLowerAmt);
                logKingAction(k, '📉 Lowered taxes to ' + Math.round(k.taxRate * 100) + '% — treasury is strong');
            }
        }
        // B. Low prosperity: lower taxes to stimulate economy (smart/fair kings)
        if (avgProsperity < 40 && k.gold > 5000 && k.taxRate > 0.08) {
            var prosLowerChance = 0;
            var prosLowerAmt = rng.randFloat(0.01, 0.02);
            if (p.intelligence === 'brilliant') { prosLowerChance = 0.20; prosLowerAmt = rng.randFloat(0.02, 0.03); }
            else if (p.intelligence === 'clever') prosLowerChance = 0.12;
            else if (p.greed === 'generous') prosLowerChance = 0.15;
            else if (p.greed === 'fair') prosLowerChance = 0.10;
            // Even greedy kings may lower if prosperity is truly terrible
            if (avgProsperity < 25 && prosLowerChance === 0) prosLowerChance = 0.05;
            if (rng.chance(prosLowerChance)) {
                k.taxRate = Math.max(minComfortTax, k.taxRate - prosLowerAmt);
                logKingAction(k, '📉 Lowered taxes to ' + Math.round(k.taxRate * 100) + '% — stimulating the economy');
            }
        }
        // C. Generous kings lower when happiness is poor (existing but improved)
        if (p.greed === 'generous' && happiness < 50 && k.taxRate > minComfortTax) {
            if (rng.chance(0.35)) {
                k.taxRate = Math.max(minComfortTax, k.taxRate - rng.randFloat(0.01, 0.02));
                logKingAction(k, '📉 Lowered taxes to ' + Math.round(k.taxRate * 100) + '% — the people deserve relief');
            }
        }
        // D. Smart kings lower when happiness < 40 (existing but with variability)
        if ((p.intelligence === 'brilliant' || p.intelligence === 'clever') && happiness < 40 && k.taxRate > minComfortTax) {
            var smartLowerAmt = p.intelligence === 'brilliant' ? rng.randFloat(0.015, 0.025) : rng.randFloat(0.01, 0.02);
            if (rng.chance(p.intelligence === 'brilliant' ? 0.30 : 0.20)) {
                k.taxRate = Math.max(minComfortTax, k.taxRate - smartLowerAmt);
            }
        }

        // Mood-driven tax adjustment (emotional overlay on top of strategic)
        if (mood.taxMod > 0 && k.kingMood && k.kingMood.current !== 'content') {
            k.taxRate = Math.min(maxTaxRate, k.taxRate + mood.taxMod);
        } else if (mood.taxMod < 0) {
            k.taxRate = Math.max(minComfortTax, k.taxRate + mood.taxMod);
        }

        // Enforce personality cap
        k.taxRate = Math.min(k.taxRate, maxTaxRate);
        k.taxRate = Math.max(0.02, k.taxRate); // absolute floor

        // RA CONSULTATION: Intercept significant tax changes
        if (isPlayerRoyalAdvisorOf(k)) {
            var _taxDelta = k.taxRate - _prevTaxRate;
            if (Math.abs(_taxDelta) > 0.005) {
                var _capturedNewRate = k.taxRate;
                k.taxRate = _prevTaxRate; // revert — let RA decide
                var _taxDir = _taxDelta > 0 ? 'raise' : 'lower';
                var _taxConviction = _taxDir === 'raise' ? (k.gold < (k._startingGold || 10000) * 0.3 ? 0.85 : 0.5) : 0.3;
                proposeKingDecision(k, {
                    type: 'tax_change',
                    description: (_taxDir === 'raise' ? 'Raise' : 'Lower') + ' taxes from ' + Math.round(_prevTaxRate * 100) + '% to ' + Math.round(_capturedNewRate * 100) + '%',
                    details: _taxDir === 'raise' ? 'The treasury needs more revenue.' : 'The economy would benefit from lower taxes.',
                    conviction: _taxConviction,
                    execute: (function(kRef, newRate) { return function() {
                        kRef.taxRate = newRate;
                        if (newRate > _prevTaxRate) {
                            kRef.lastTaxIncreaseDay = world.day;
                            logKingAction(kRef, '📈 Raised taxes to ' + Math.round(newRate * 100) + '%');
                        } else {
                            logKingAction(kRef, '📉 Lowered taxes to ' + Math.round(newRate * 100) + '%');
                        }
                    }; })(k, _capturedNewRate)
                });
            }
        } else {
            // Log significant changes (non-RA path)
            if (k.taxRate > _prevTaxRate + 0.005) {
                k.lastTaxIncreaseDay = world.day;
                logKingAction(k, '📈 Raised taxes to ' + Math.round(k.taxRate * 100) + '%');
            } else if (k.taxRate < _prevTaxRate - 0.005) {
                logKingAction(k, '📉 Lowered taxes to ' + Math.round(k.taxRate * 100) + '%');
            }
        }

        // 2. MILITARY(ambitious/brave kings build more military, with budget awareness)
        var _milMoodMod = (mood.conscriptMod || 1.0);
        if (p.ambition === 'ambitious' && !atWar && rng.chance(0.2 * _milMoodMod)) {
            // Peacetime recruitment: only if budget is sustainable
            var _ptFs = Engine.getKingdomFinancialState(k);
            var _ptCanRecruit = _ptFs.canHireGuards && k.gold > _ptFs.minReserve;
            // Clever/brilliant kings also check if adding soldiers is affordable
            if (p.intelligence === 'brilliant' || p.intelligence === 'clever') {
                var _ptDailyInc = (_ptFs.lastSeasonRevenue || 0) / 90;
                var _ptDailyCost = _ptFs.soldierCount * 1 + _ptFs.soldierCount * CONFIG.KINGDOM_SOLDIER_DAILY_COST / 30 + _ptFs.monthlyBuildingCost / 30;
                if (_ptDailyInc - _ptDailyCost < 3) _ptCanRecruit = false;
            }
            if (_ptCanRecruit) {
                for (const townId of k.territories) {
                    const town = findTown(townId);
                    if (!town) continue;
                    var idle = getPeopleInTown(town.id).filter(function(pp) {
                        return (pp.occupation === 'laborer' || pp.occupation === 'none') &&
                        pp.age >= CONFIG.COMING_OF_AGE && pp.age <= 50;
                    });
                    if (idle.length > 0 && k.gold > 200) {
                        const recruit = idle[0];
                        recruitSoldier(recruit, town, k, 'infantry');
                        k.gold -= 50;
                        break;
                    }
                }
            }
        }

        // 3. INFRASTRUCTURE (clever/brilliant kings invest wisely)
        // H-3: Only build if treasury > 3 months upkeep; H-2: delay non-essential during war
        // Mood: jubilant/ambitious invest more, paranoid/wrathful/grieving invest less
        var _infraMoodChance = (mood.festivalMod > 0.5) ? 1.2 : (mood.festivalMod === 0) ? 0.3 : 1.0;
        var _infraFs = Engine.getKingdomFinancialState(k);
        if ((p.intelligence === 'brilliant' || p.intelligence === 'clever') && treasury > 1000 && rng.chance(0.2 * _infraMoodChance) && _infraFs.canConstruct && !_infraFs.atWar) {
            // Build missing essential buildings in towns that lack them
            for (const townId of k.territories) {
                const town = findTown(townId);
                if (!town) continue;
                const hasType = (type) => town.buildings.some(b => b.type === type);
                if (!hasType('bakery') && kingdomBuild(k, town, 'bakery', rng)) {
                    logKingAction(k, '🏗️ Built a bakery in ' + town.name);
                    break;
                }
                if (!hasType('blacksmith') && kingdomBuild(k, town, 'blacksmith', rng)) {
                    logKingAction(k, '🏗️ Built a blacksmith in ' + town.name);
                    break;
                }
            }
        } else if (p.intelligence === 'foolish' && rng.chance(0.15) && k.gold > 500) {
            // Foolish kings waste money on vanity projects
            var wasteAmount = Math.min(200, Math.floor(k.gold * 0.1));
            k.gold -= wasteAmount;
            logEvent('\uD83E\uDD34 The foolish ruler of ' + k.name + ' wastes ' + wasteAmount + 'g on a vanity project.',  {
                type: 'vanity_project', kingdomId: k.id, cause: 'Poor judgment by dim ruler',
                effects: ['Treasury -' + wasteAmount + 'g', 'No benefit to the kingdom']
            }, _eventKingdomCategory(k.id));
        }

        // 3a. NATIONALIZATION — greedy/corrupt kings may nationalize industries (rare, seasonal)
        if (!k.nationalizedIndustries) k.nationalizedIndustries = [];
        if ((p.greed === 'greedy' || p.greed === 'corrupt') && rng.chance(0.10 * (mood.warMod > 1.3 ? 1.5 : 1.0)) && k.nationalizedIndustries.length < 3) {
            const candidates = (CONFIG.KINGDOM_BUILDING_TYPES || []).filter(
                bt => !k.nationalizedIndustries.includes(bt) && !(CONFIG.KINGDOM_EXCLUSIVE_BUILDINGS || []).includes(bt)
            );
            if (candidates.length > 0) {
                const target = rng.pick(candidates);
                k.nationalizedIndustries.push(target);
                logEvent(`👑 ${k.name} has nationalized all ${target} operations! NPC-owned ${target}s can no longer produce.`, { kingdomId: k.id }, _eventKingdomCategory(k.id));
                // Kingdom builds nationalized buildings in towns that lack them
                for (const townId of k.territories) {
                    const town = findTown(townId);
                    if (!town) continue;
                    const hasOwned = town.buildings.some(b => b.type === target && b.ownerId === k.id);
                    if (!hasOwned) {
                        if (kingdomBuild(k, town, target, rng)) {
                            // Override ownerId to kingdom
                            var lastBld = town.buildings[town.buildings.length - 1];
                            if (lastBld) lastBld.ownerId = k.id;
                        }
                    }
                }
            }
        }

        // 3b. MAINTENANCE — repair degraded buildings, walls, and roads
        for (const townId of k.territories) {
            const town = findTown(townId);
            if (!town) continue;

            // Building maintenance — now uses time-based repair queue
            for (const bld of town.buildings) {
                if (bld.ownerId === 'player') continue; // player repairs their own
                if (bld.condition === 'under_construction' || bld.condition === 'repairing') continue; // already in progress
                const repairThreshold = (p.intelligence === 'brilliant' || p.intelligence === 'clever') ? 'used' : 'breaking';
                if (p.intelligence === 'foolish' || p.intelligence === 'dim') continue; // neglectful kings skip maintenance
                if (bld.condition === repairThreshold || bld.condition === 'breaking' || bld.condition === 'destroyed') {
                    const bt = findBuildingType(bld.type);
                    const repairCost = bld.condition === 'destroyed' ? Math.floor((bt ? bt.cost : 200) * 0.5)
                                     : bld.condition === 'breaking' ? Math.floor((bt ? bt.cost : 200) * 0.3)
                                     : Math.floor((bt ? bt.cost : 200) * 0.2);
                    if (k.gold >= repairCost) {
                        var repairTimes = CONFIG.KINGDOM_BUILD_TIMES ? CONFIG.KINGDOM_BUILD_TIMES[bld.type] : null;
                        var repairDays = repairTimes ? repairTimes.repair : 1;
                        if (repairDays > 1) {
                            bld.condition = 'repairing';
                            bld.repairComplete = world.day + repairDays;
                        } else {
                            bld.condition = 'new';
                            bld.lastRepairDay = world.day;
                        }
                        k.gold -= repairCost;
                        distributeConstructionWages(town.id, repairCost, rng);
                    }
                }
            }

            // Wall maintenance
            if (town.walls > 0 && town.wallCondition) {
                const wallRepairThreshold = (p.intelligence === 'brilliant' || p.intelligence === 'clever') ? 'used' : 'breaking';
                if (p.intelligence !== 'foolish' && p.intelligence !== 'dim') {
                    if (town.wallCondition === wallRepairThreshold || town.wallCondition === 'breaking' || town.wallCondition === 'destroyed') {
                        const wallCfg = CONFIG.WALL_LEVELS[town.walls];
                        const wallRepairCost = town.wallCondition === 'destroyed' ? Math.floor((wallCfg ? wallCfg.cost : 200) * 0.5)
                                             : town.wallCondition === 'breaking' ? Math.floor((wallCfg ? wallCfg.cost : 200) * 0.3)
                                             : Math.floor((wallCfg ? wallCfg.cost : 200) * 0.2);
                        if (k.gold >= wallRepairCost) {
                            town.wallCondition = 'new';
                            town.wallLastRepair = world.day;
                            k.gold -= wallRepairCost;
                        }
                    }
                }
            }
        }

        // Road maintenance — all kings do some road repair, smarter kings are more thorough
        {
            const isDimOrFoolish = p.intelligence === 'foolish' || p.intelligence === 'dim';
            const repairThreshold = (p.intelligence === 'brilliant' || p.intelligence === 'clever') ? 'used' : 'breaking';
            let repairsThisTick = 0;
            // Dim/foolish kings: only repair 1 destroyed road per tick, 30%/15% chance
            const dimRepairChance = p.intelligence === 'dim' ? 0.30 : p.intelligence === 'foolish' ? 0.15 : 1;
            const dimMaxRepairs = isDimOrFoolish ? 1 : 999;

            if (!isDimOrFoolish || rng.chance(dimRepairChance)) {
                for (const road of world.roads) {
                    if (repairsThisTick >= dimMaxRepairs) break;
                    const fromT = findTown(road.fromTownId);
                    const toT = findTown(road.toTownId);
                    if (!fromT && !toT) continue;
                    if ((fromT && k.territories.has(fromT.id)) || (toT && k.territories.has(toT.id))) {
                        // Dim/foolish: only repair destroyed roads; smart kings: repair at their threshold
                        const shouldRepair = isDimOrFoolish
                            ? road.condition === 'destroyed'
                            : (road.condition === repairThreshold || road.condition === 'breaking' || road.condition === 'destroyed');
                        if (shouldRepair) {
                            const roadRepairCost = road.condition === 'destroyed' ? 150 : road.condition === 'breaking' ? 80 : 40;
                            if (k.gold >= roadRepairCost) {
                                road.condition = 'new';
                                road.lastRepairDay = world.day;
                                k.gold -= roadRepairCost;
                                repairsThisTick++;
                            }
                        }
                    }
                }
            }
        }

        // Kings rebuild destroyed bridges — smart AI with prioritization
        if (p.intelligence !== 'foolish') {
            var _brCandidates = [];
            var _brRebuildCost = CONFIG.BRIDGE_REBUILD_COST || 1000;
            var _brMinDays = CONFIG.BRIDGE_REBUILD_DAYS || 30;
            // Personality modifiers for bridge repair urgency
            var _brGreed = p.greed || 'fair';
            var _brAmb = p.ambition || 'content';
            var _brIntel = p.intelligence || 'average';
            // Greedy/corrupt kings wait longer; ambitious/brilliant kings act faster
            var _brDayMult = 1.0;
            if (_brGreed === 'greedy') _brDayMult = 1.5;
            else if (_brGreed === 'corrupt') _brDayMult = 2.0;
            else if (_brGreed === 'generous') _brDayMult = 0.7;
            if (_brAmb === 'ambitious') _brDayMult *= 0.8;
            else if (_brAmb === 'lazy') _brDayMult *= 1.5;
            if (_brIntel === 'brilliant') _brDayMult *= 0.7;
            else if (_brIntel === 'clever') _brDayMult *= 0.85;
            else if (_brIntel === 'dim') _brDayMult *= 1.4;
            var _brEffMinDays = Math.max(10, Math.floor(_brMinDays * _brDayMult));
            // Treasury threshold: don't repair if it would drop treasury below 20% of starting
            var _brTreasuryFloor = Math.floor((CONFIG.KINGDOM_STARTING_TREASURY_MIN || 8000) * 0.2);
            // Build petition lookup: which roads have active petitions?
            var _brPetitions = {};
            if (k.petitions) {
                for (var _bpi = 0; _bpi < k.petitions.length; _bpi++) {
                    var _bpet = k.petitions[_bpi];
                    if (_bpet.typeId === 'repair_bridge' && _bpet.status === 'open') {
                        _brPetitions[_bpet.roadIndex] = (_brPetitions[_bpet.roadIndex] || 0) + (_bpet.support || 30);
                    }
                }
            }
            // Collect all destroyed bridges in kingdom territory
            for (var _bri = 0; _bri < world.roads.length; _bri++) {
                var _brRoad = world.roads[_bri];
                if (!_brRoad.hasBridge) continue;
                var _brFromT = findTown(_brRoad.fromTownId);
                var _brToT = findTown(_brRoad.toTownId);
                if (!_brFromT && !_brToT) continue;
                if (!(((_brFromT && k.territories.has(_brFromT.id)) || (_brToT && k.territories.has(_brToT.id))))) continue;
                var _brImportance = computeRoadImportance(_brFromT, _brToT);
                // Petition boost: petitions add urgency and halve the minimum wait
                var _brHasPetition = _brPetitions[_bri] || 0;
                var _brMinDaysForRoad = _brHasPetition > 0 ? Math.floor(_brEffMinDays * 0.5) : _brEffMinDays;
                if (_brRoad.bridges && _brRoad.bridges.length > 0) {
                    for (var _bri2 = 0; _bri2 < _brRoad.bridges.length; _bri2++) {
                        var _brB = _brRoad.bridges[_bri2];
                        if (!_brB.destroyed) continue;
                        var _brDaysDown = world.day - (_brB.destroyedDay || 0);
                        if (_brDaysDown < _brMinDaysForRoad) continue;
                        // Urgency increases with time — long-destroyed bridges get priority boost
                        var _brUrgency = _brImportance + Math.min(50, _brDaysDown * 0.15);
                        // Capital connections get urgent priority
                        if ((_brFromT && _brFromT.isCapital) || (_brToT && _brToT.isCapital)) _brUrgency += 40;
                        // Petition support boosts priority
                        _brUrgency += _brHasPetition * 0.5;
                        _brCandidates.push({ ri: _bri, bridgeId: _brB.id, importance: _brUrgency });
                    }
                } else if (_brRoad.bridgeDestroyed) {
                    var _brDaysDown2 = world.day - (_brRoad.bridgeDestroyedDay || 0);
                    if (_brDaysDown2 < _brMinDaysForRoad) continue;
                    var _brUrgency2 = _brImportance + Math.min(50, _brDaysDown2 * 0.15);
                    if ((_brFromT && _brFromT.isCapital) || (_brToT && _brToT.isCapital)) _brUrgency2 += 40;
                    _brUrgency2 += _brHasPetition * 0.5;
                    _brCandidates.push({ ri: _bri, bridgeId: null, importance: _brUrgency2 });
                }
            }
            // Sort by importance: fix the most critical bridges first
            _brCandidates.sort(function(a, b) { return b.importance - a.importance; });
            // Budget cap: spend at most 30% of treasury on bridges per tick
            var _brBudget = Math.floor(k.gold * 0.3);
            var _brSpent = 0;
            for (var _brc = 0; _brc < _brCandidates.length; _brc++) {
                if (k.gold - _brSpent < _brRebuildCost) break;
                if (_brSpent + _brRebuildCost > _brBudget) break;
                if (k.gold - _brSpent - _brRebuildCost < _brTreasuryFloor) break;
                _brSpent += _brRebuildCost;
                k.gold -= _brRebuildCost;
                rebuildBridge(_brCandidates[_brc].ri, _brCandidates[_brc].bridgeId);
                // Mark any petitions for this road as fulfilled
                if (k.petitions) {
                    for (var _bpc = k.petitions.length - 1; _bpc >= 0; _bpc--) {
                        if (k.petitions[_bpc].typeId === 'repair_bridge' && k.petitions[_bpc].roadIndex === _brCandidates[_brc].ri && k.petitions[_bpc].status === 'open') {
                            k.petitions[_bpc].status = 'fulfilled';
                            k.petitions[_bpc].fulfilledDay = world.day;
                        }
                    }
                }
            }
        }

        // Urgent: reconnect isolated towns (guaranteed, not random)
        if (k.gold >= 300) {
            var kTerrSet = k.territories instanceof Set ? k.territories : new Set(k.territories || []);
            var kTownsAll = world.towns.filter(function(t) { return kTerrSet.has(t.id) && !t.destroyed && !t.abandoned && !t.isOutpost; });
            for (var iti = 0; iti < kTownsAll.length; iti++) {
                var isolatedTown = kTownsAll[iti];
                var hasRoad = world.roads.some(function(r) {
                    return (r.fromTownId === isolatedTown.id || r.toTownId === isolatedTown.id) && r.condition !== 'destroyed';
                });
                if (hasRoad) continue;
                // Also check sea routes
                var hasSea = (world.seaRoutes || []).some(function(sr) {
                    return (sr.fromTownId === isolatedTown.id || sr.from === isolatedTown.id) ||
                           (sr.toTownId === isolatedTown.id || sr.to === isolatedTown.id);
                });
                if (hasSea) continue;

                // Find nearest connected town
                var bestTarget = null, bestDist = Infinity;
                for (var itj = 0; itj < world.towns.length; itj++) {
                    var cand = world.towns[itj];
                    if (cand.id === isolatedTown.id || cand.destroyed || cand.abandoned) continue;
                    var candHasRoad = world.roads.some(function(r) {
                        return (r.fromTownId === cand.id || r.toTownId === cand.id) && r.condition !== 'destroyed';
                    });
                    if (!candHasRoad) continue;
                    var d = Math.hypot((cand.x || 0) - (isolatedTown.x || 0), (cand.y || 0) - (isolatedTown.y || 0));
                    if (d < bestDist) { bestDist = d; bestTarget = cand; }
                }
                if (bestTarget && bestDist < 3000) {
                    // First try to repair existing destroyed road
                    var existingDestroyed = world.roads.find(function(r) {
                        return ((r.fromTownId === isolatedTown.id && r.toTownId === bestTarget.id) ||
                                (r.fromTownId === bestTarget.id && r.toTownId === isolatedTown.id)) &&
                               r.condition === 'destroyed';
                    });
                    if (existingDestroyed) {
                        existingDestroyed.condition = 'used';
                        existingDestroyed.lastRepairDay = world.day;
                        k.gold -= 150;
                    } else {
                        var buildCost = Math.floor(300 + bestDist * 0.5);
                        if (k.gold >= buildCost) {
                            k.gold -= buildCost;
                            buildNewRoad(isolatedTown.id, bestTarget.id, k.id);
                        }
                    }
                    break; // Only fix 1 per tick per kingdom
                }
            }
        }

        // Kingdom road construction — kings build new roads for economic benefit
        // All non-foolish kings build roads; smarter kings build more frequently
        // Road importance factors into pair selection
        var roadBuildChance = p.intelligence === 'brilliant' ? 0.02 : p.intelligence === 'clever' ? 0.01 : p.intelligence === 'average' ? 0.005 : p.intelligence === 'dim' ? 0.002 : 0.001;
        if (roadBuildChance > 0 && k.gold >= 2000 && rng.chance(roadBuildChance)) {
            const kTowns = world.towns.filter(t => k.territories.has(t.id) && !t.destroyed && !t.abandoned && !t.isOutpost);
            // Priority: connect roadless towns first
            var roadlessTowns = kTowns.filter(t => {
                return !world.roads.some(r =>
                    ((r.fromTownId === t.id || r.toTownId === t.id) && r.condition !== 'destroyed')
                );
            });
            var candidateTowns = roadlessTowns.length > 0 ? roadlessTowns : kTowns;
            let bestPair = null, bestPairScore = -Infinity;
            for (let ci = 0; ci < candidateTowns.length; ci++) {
                var connectedTargets = roadlessTowns.length > 0 ? kTowns : kTowns;
                for (let cj = 0; cj < connectedTargets.length; cj++) {
                    const a = candidateTowns[ci], b = connectedTargets[cj];
                    if (a.id === b.id) continue;
                    const directRoad = world.roads.find(r =>
                        ((r.fromTownId === a.id && r.toTownId === b.id) ||
                        (r.fromTownId === b.id && r.toTownId === a.id)) &&
                        r.condition !== 'destroyed'
                    );
                    if (directRoad) continue;
                    const waterFrac = checkWaterPath(a.x, a.y, b.x, b.y);
                    if (waterFrac > (CONFIG.ROAD_MAX_WATER_FRACTION || 0.15)) continue;
                    const d = Math.hypot(a.x - b.x, a.y - b.y);
                    if (d > 2000) continue;
                    // Score by road importance (population, prosperity, strategic value)
                    var pairScore = computeRoadImportance(a, b);
                    if (pairScore > bestPairScore) { bestPairScore = pairScore; bestPair = { a, b, dist: d }; }
                }
            }
            if (bestPair) {
                const buildCost = Math.floor(500 + bestPair.dist);
                if (k.gold >= buildCost) {
                    k.gold -= buildCost;
                    buildNewRoad(bestPair.a.id, bestPair.b.id, k.id);
                    logEvent(`\uD83D\uDC51 ${k.name} has commissioned a new road between ${bestPair.a.name} and ${bestPair.b.name}!`, {
                        type: 'road_construction', townId: bestPair.a.id, otherTownId: bestPair.b.id, kingdomId: k.id, _noToast: true
                    }, 'local_town');
                }
            }
        }

        // v9p33river47: CROSS-KINGDOM infrastructure cooperation.
        // If two kingdoms are allied OR have an active trade agreement, both kings
        // can chip in 50/50 to build a new road or sea route between their towns.
        // Smart filter: skip if existing routing is already reasonably fast (the
        // new connection wouldn't materially improve travel time).
        var coopChance = p.intelligence === 'brilliant' ? 0.018 : p.intelligence === 'clever' ? 0.010 : p.intelligence === 'average' ? 0.005 : p.intelligence === 'dim' ? 0.002 : 0;
        if (coopChance > 0 && k.gold >= 1500 && rng.chance(coopChance)) {
            // Find partner kingdoms (allied or active trade agreement)
            var partnerIds = new Set();
            if (k.alliances && k.alliances.size > 0) {
                k.alliances.forEach(function(aid) { partnerIds.add(aid); });
            }
            if (k._activeTreaties) {
                for (var ti = 0; ti < k._activeTreaties.length; ti++) {
                    var _tr = k._activeTreaties[ti];
                    if ((_tr.type === 'trade_agreement' || _tr.type === 'mutual_defense') && _tr.partnerId) {
                        partnerIds.add(_tr.partnerId);
                    }
                }
            }
            if (partnerIds.size > 0) {
                var kTowns = world.towns.filter(function(t) { return k.territories.has(t.id) && !t.destroyed && !t.abandoned && !t.isOutpost; });
                var bestCoopRoad = null, bestCoopRoadScore = -Infinity;
                var bestCoopSea  = null, bestCoopSeaScore  = -Infinity;
                partnerIds.forEach(function(pid) {
                    var partner = findKingdom(pid);
                    if (!partner || partner.destroyed) return;
                    if (partner.gold < 1500) return; // partner needs to chip in too
                    var pTowns = world.towns.filter(function(t) { return partner.territories.has(t.id) && !t.destroyed && !t.abandoned && !t.isOutpost; });
                    for (var ai = 0; ai < kTowns.length; ai++) for (var bi = 0; bi < pTowns.length; bi++) {
                        var a = kTowns[ai], b = pTowns[bi];
                        if (a.id === b.id) continue;
                        var d = Math.hypot(a.x - b.x, a.y - b.y);

                        // ── ROAD candidate: ≤1500px, low water fraction, no fast existing route
                        if (d <= 1500) {
                            var hasDirectRoad = world.roads.some(function(r) {
                                return ((r.fromTownId === a.id && r.toTownId === b.id) ||
                                        (r.fromTownId === b.id && r.toTownId === a.id)) && r.condition !== 'destroyed';
                            });
                            if (!hasDirectRoad) {
                                // Skip if existing roads can already get there in ≤1.5x straight-line distance
                                var existingPath = _shortestRoadDistance(a, b);
                                var skipBecauseFast = existingPath != null && existingPath <= d * 1.5;
                                if (!skipBecauseFast) {
                                    var waterFrac = checkWaterPath(a.x, a.y, b.x, b.y);
                                    if (waterFrac <= (CONFIG.ROAD_MAX_WATER_FRACTION || 0.15)) {
                                        var sc = computeRoadImportance(a, b);
                                        // Bonus for connecting an isolated town
                                        if (existingPath == null) sc += 50;
                                        if (sc > bestCoopRoadScore) { bestCoopRoadScore = sc; bestCoopRoad = { a, b, d, partner }; }
                                    }
                                }
                            }
                        }

                        // ── SEA ROUTE candidate: ≤2500px, both must be ports/islands
                        if (d <= 2500 && (a.isPort || a.isIsland) && (b.isPort || b.isIsland)) {
                            var hasDirectSea = (world.seaRoutes || []).some(function(sr) {
                                return ((sr.fromTownId === a.id && sr.toTownId === b.id) ||
                                        (sr.fromTownId === b.id && sr.toTownId === a.id)) && sr.condition !== 'destroyed';
                            });
                            if (!hasDirectSea) {
                                var existingSeaPath = _shortestSeaDistance(a, b);
                                var skipSeaBecauseFast = existingSeaPath != null && existingSeaPath <= d * 1.5;
                                if (!skipSeaBecauseFast) {
                                    var seaWaterFrac = 1 - checkWaterPath(a.x, a.y, b.x, b.y); // approximate inverse — checkWaterPath returns water fraction
                                    // A real sea path needs MOSTLY water, so inverse-check-water > ~0.85
                                    var ssc = computeRoadImportance(a, b);
                                    if (existingSeaPath == null) ssc += 40;
                                    if (ssc > bestCoopSeaScore) { bestCoopSeaScore = ssc; bestCoopSea = { a, b, d, partner }; }
                                }
                            }
                        }
                    }
                });

                // Pick whichever is more valuable; build it with 50/50 funding
                var chosen = null, chosenType = null;
                if (bestCoopRoad && bestCoopRoadScore >= (bestCoopSea ? bestCoopSeaScore : -Infinity)) {
                    chosen = bestCoopRoad; chosenType = 'road';
                } else if (bestCoopSea) {
                    chosen = bestCoopSea; chosenType = 'sea';
                }
                if (chosen) {
                    var totalCost = chosenType === 'road'
                        ? Math.floor(800 + chosen.d * 1.2)   // road slightly more expensive than intra-kingdom (border tariffs etc.)
                        : Math.floor(600 + chosen.d * 0.4);  // sea route mostly maintenance
                    var halfCost = Math.floor(totalCost / 2);
                    if (k.gold >= halfCost && chosen.partner.gold >= halfCost) {
                        k.gold -= halfCost;
                        chosen.partner.gold -= halfCost;
                        var built = false;
                        if (chosenType === 'road') {
                            var _r = buildNewRoad(chosen.a.id, chosen.b.id, k.id);
                            built = _r && _r.success;
                        } else {
                            var _s = buildNewSeaRoute(chosen.a.id, chosen.b.id, k.id);
                            built = _s && _s.success;
                        }
                        if (built) {
                            var infra = chosenType === 'road' ? '\uD83D\uDEE4\uFE0F road' : '\u26F5 sea route';
                            logEvent(`\uD83E\uDD1D ${k.name} and ${chosen.partner.name} jointly funded a new ${infra} between ${chosen.a.name} and ${chosen.b.name}!`, null, _eventEitherKingdomCategory(k.id, a.id));
                        } else {
                            // Refund if construction failed
                            k.gold += halfCost;
                            chosen.partner.gold += halfCost;
                        }
                    }
                }
            }
        }

        // 4. HAPPINESS MANAGEMENT
        if (happiness < 40 && p.temperament !== 'cruel') {
            if (p.intelligence === 'brilliant' || p.intelligence === 'clever') {
                // Smart: lower taxes, may throw a festival via new system
                k.taxRate = Math.max(0.02, k.taxRate - 0.01);
                if (k.gold > 2000 && rng.chance(0.3)) {
                    // Pick unhappiest town that's eligible for a festival
                    var _bestFestTown = null, _bestFestHapp = 999;
                    for (const tid of k.territories) {
                        const t = findTown(tid);
                        if (!t || (world.day - (t._lastFestivalDay || 0)) < 90) continue;
                        if ((t.happiness || 50) < _bestFestHapp) { _bestFestHapp = t.happiness || 50; _bestFestTown = t; }
                    }
                    if (_bestFestTown) {
                        var _festType = (_bestFestHapp < 30 && k.gold > 5000) ? 'large' : 'small';
                        var _festResult = Engine.startFestival(k.id, _bestFestTown.id, _festType);
                        if (_festResult && !_festResult.error) {
                            var _festCost = _festType === 'large' ? 2000 : 500;
                            logKingAction(k, '🎉 Held a ' + _festType + ' festival in ' + _bestFestTown.name + ' (-' + _festCost + 'g)');
                        }
                    }
                }
            } else if (p.intelligence === 'dim' || p.intelligence === 'foolish') {
                // Dim kings increase guards (makes it worse if already unhappy)
                if (rng.chance(0.3)) {
                    for (const townId of k.territories) {
                        const town = findTown(townId);
                        if (!town || town.garrison > 30) continue;
                        town.garrison = Math.min(50, town.garrison + 2);
                        break;
                    }
                }
            }
        }

        // 5. FORCED REQUISITION (corrupt/greedy kings only)
        if (p.greed === 'corrupt' && rng.chance(0.2)) {
            const hasReq = k.laws.specialLaws && k.laws.specialLaws.some(l => l.id === 'forced_requisition');
            if (!hasReq) {
                if (!k.laws.specialLaws) k.laws.specialLaws = [];
                k.laws.specialLaws.push({ id: 'forced_requisition', name: 'Forced Requisition', desc: 'Guards may seize goods from merchants.' });
                logEvent(`${k.name} enacts Forced Requisition laws!`,  {
                    type: 'forced_requisition', kingdomId: k.id,
                    cause: 'The corrupt ruler of ' + k.name + ' has authorized the seizure of merchant goods.',
                    effects: [
                        'Guards may seize goods from merchants',
                        'Merchant profits at risk in ' + k.name,
                        'Trade in the kingdom becomes more dangerous',
                        'Kingdom happiness may decrease'
                    ]
                }, _eventKingdomCategory(k.id));
                logKingAction(k, '⚠️ Enacted Forced Requisition');
            }
        }

        // 6. FESTIVALS (kind kings — now uses new festival system via tickKingdomFestivals)
        // The new tickKingdomFestivals handles AI scheduling with proper cooldowns/costs.
        // Kind kings still get an extra chance here for spontaneous festivals
        var festGate = (p.intelligence === 'foolish' || p.intelligence === 'dim') ? 100 : 2000;
        if (p.greed === 'greedy' || p.greed === 'corrupt') festGate = Infinity;
        if (p.temperament === 'kind' && k.gold > festGate && rng.chance(0.10)) {
            // Pick a random eligible town
            var _kindFestTowns = [];
            for (const tid of k.territories) {
                const t = findTown(tid);
                if (t && (world.day - (t._lastFestivalDay || 0)) >= 90) _kindFestTowns.push(t);
            }
            if (_kindFestTowns.length > 0) {
                var _kindTown = rng.pick(_kindFestTowns);
                var _kindType = k.gold > 5000 ? 'large' : 'small';
                Engine.startFestival(k.id, _kindTown.id, _kindType);
            }
        }

        // 6b. ROYAL TOURNAMENT — king sponsors a tournament at the capital
        // Expire any finished tournament (lasts 30 days)
        if (k.tournament && k.tournament.active && (world.day - k.tournament.startDay) > 30) {
            k.tournament.active = false;
            logEvent(`🏟️ The royal tournament in ${k.name} has concluded.`, { kingdomId: k.id, townId: k.tournament.townId }, _eventKingdomCategory(k.id));
        }
        // Kings can sponsor new tournaments when not at war, treasury > 1000g, no active tournament
        // H-3: Only if treasury > 12 months of upkeep (festivals/tournaments are lowest priority)
        var _tournFs = Engine.getKingdomFinancialState(k);
        // Higher chance for ambitious/brave kings, lower for miserly/cowardly
        if (!atWar && k.gold > 1000 && _tournFs.canFestival && (!k.tournament || !k.tournament.active)) {
            var tournamentChance = 0.02; // base 2% per tick
            if (p.ambition === 'ambitious') tournamentChance += 0.02;
            if (p.courage === 'brave') tournamentChance += 0.01;
            if (p.greed === 'generous' || p.greed === 'fair') tournamentChance += 0.01;
            if (p.greed === 'greedy' || p.greed === 'corrupt') tournamentChance -= 0.02;
            if (p.temperament === 'cruel') tournamentChance -= 0.01;
            if (tournamentChance > 0 && rng.chance(tournamentChance)) {
                var capitalTown = null;
                for (var _tid of k.territories) {
                    var _t = findTown(_tid);
                    if (_t && _t.isCapital) { capitalTown = _t; break; }
                }
                if (capitalTown) {
                    var entryFee = rng.randInt(5, 20);
                    var tournamentCost = 300 + entryFee * 10; // kingdom pays to organize
                    k.gold -= tournamentCost;
                    k.tournament = {
                        active: true,
                        startDay: world.day,
                        entryFee: entryFee,
                        townId: capitalTown.id,
                    };
                    boostKingdomHappiness(k, 5);
                    logEvent(`🏟️ The ruler of ${k.name} has announced a Royal Tournament in ${capitalTown.name}! Entry fee: ${entryFee}g.`,  {
                        type: 'tournament', kingdomId: k.id, townId: capitalTown.id, cause: 'Royal decree',
                        effects: ['Fighters from across the land gather', 'Kingdom happiness +5', 'Grand prizes for the champion']
                    }, _eventKingdomCategory(k.id));
                    logKingAction(k, '🏟️ Sponsored a royal tournament');
                }
            }
        }

        // 6c. TENT CAMP MANAGEMENT — respects No Tent Camps / Right to Camps laws
        // No Tent Camps law: soldiers destroy all existing camps
        // Right to Camps law: NPCs self-build (handled in tickNPCHousingAI), king stays out
        // Neither law: king decides based on personality (kind build, cruel destroy)
        if (world.day % 90 === 0) { // Seasonal review
            var hasBanLaw = hasSpecialLaw(k, 'no_tent_camps');
            var hasRightLaw = hasSpecialLaw(k, 'right_to_camps');

            for (const townId of k.territories) {
                const town = findTown(townId);
                if (!town) continue;
                var tcamps = (town.buildings || []).filter(function(b) { return b.type === 'tent_camp'; });

                // NO TENT CAMPS LAW: demolish ALL tent camps in the kingdom
                if (hasBanLaw && tcamps.length > 0) {
                    for (var _bci = tcamps.length - 1; _bci >= 0; _bci--) {
                        var banCamp = tcamps[_bci];
                        // Evict all occupants
                        for (var _beti = 0; _beti < (banCamp.tents || []).length; _beti++) {
                            var bEvTent = banCamp.tents[_beti];
                            if (bEvTent.occupantId) {
                                var bEvPerson = findPerson(bEvTent.occupantId);
                                if (bEvPerson) {
                                    bEvPerson.houseType = null;
                                    bEvPerson._tentCampId = null;
                                    bEvPerson._tentIndex = null;
                                }
                                bEvTent.occupantId = null;
                                bEvTent.occupantType = null;
                            }
                        }
                        var banIdx = town.buildings.indexOf(banCamp);
                        if (banIdx >= 0) town.buildings.splice(banIdx, 1);
                    }
                    if (tcamps.length > 0) {
                        logEvent('🚫 Soldiers of ' + k.name + ' demolished ' + tcamps.length + ' tent camp(s) in ' + town.name + ' under the No Tent Camps law.', {
                            type: 'tent_camp_demolition', townId: town.id, kingdomId: k.id, campCount: tcamps.length
                        }, 'local_town');
                        if (town.happiness !== undefined) town.happiness = Math.max(0, town.happiness - 3 * tcamps.length);
                    }
                    continue; // Don't build under ban law
                }

                // RIGHT TO CAMPS LAW: king stays out, NPCs self-build (handled in tickNPCHousingAI)
                if (hasRightLaw) continue;

                // NEITHER LAW: king decides based on personality
                var townPop = (town.population || 0);
                var homeless = getPeopleInTown(town.id).filter(function(pp) {
                    return pp.alive && pp.age >= 18 && !pp.houseType;
                }).length;
                var homelessRate = townPop > 0 ? homeless / townPop : 0;

                // Calculate king's disposition toward tent camps
                // Positive = wants more, negative = wants fewer
                var disposition = 0;
                if (p.temperament === 'kind') disposition += 3;
                else if (p.temperament === 'neutral') disposition += 1;
                else if (p.temperament === 'cruel') disposition -= 3;
                if (p.greed === 'generous') disposition += 2;
                else if (p.greed === 'fair') disposition += 1;
                else if (p.greed === 'greedy') disposition -= 1;
                else if (p.greed === 'corrupt') disposition -= 2;
                if (p.intelligence === 'brilliant' || p.intelligence === 'clever') {
                    var tentDisease = getTentCampDiseaseMod(town);
                    if (tentDisease > 0.01) disposition -= 1;
                    if (homelessRate > 0.3) disposition += 2;
                }
                if (p.intelligence === 'foolish') disposition += rng.randInt(-1, 2);

                // BUILD more tent camps if disposition positive and homeless are many
                if (disposition >= 2 && homelessRate > 0.15 && tcamps.length < 5) {
                    var usedLand = 0;
                    for (var _tbi = 0; _tbi < town.buildings.length; _tbi++) {
                        var _bt = findBuildingType(town.buildings[_tbi].type);
                        usedLand += (_bt && _bt.landSlots) || 1;
                    }
                    var totalLand = town.totalLand || (town.category === 'capital_city' ? 50 : town.category === 'city' ? 35 : town.category === 'town' ? 20 : 10);
                    if (usedLand < totalLand - 1 && k.gold >= 50) {
                        var tcBt = BUILDING_TYPES['tent_camp'];
                        var newTc = {
                            type: 'tent_camp',
                            level: 1,
                            ownerId: k.id,
                            condition: 'new',
                            _id: 'tc_' + town.id + '_' + town.buildings.length,
                            tents: [],
                            tentUpfrontCost: (tcBt && tcBt.tentUpfrontCost) || 20,
                            tentMonthlyCost: (tcBt && tcBt.tentMonthlyCost) || 5
                        };
                        var numTents = (tcBt && tcBt.tents) || 10;
                        for (var _nti = 0; _nti < numTents; _nti++) {
                            newTc.tents.push({ tentIndex: _nti, occupantId: null, occupantType: null, rentStartDay: null, lastRentDay: null });
                        }
                        town.buildings.push(newTc);
                        k.gold -= (tcBt && tcBt.cost) || 50;
                        logEvent('⛺ The ruler of ' + k.name + ' has ordered a tent camp built in ' + town.name + ' to shelter the homeless.', {
                            type: 'tent_camp_build', townId: town.id, kingdomId: k.id
                        }, 'local_town');
                        logKingAction(k, '⛺ Built tent camp in ' + town.name);
                    }
                }

                // DESTROY tent camps if disposition very negative or disease concern
                if (disposition <= -2 && tcamps.length > 0) {
                    var targetCamp = null;
                    for (var _dci = 0; _dci < tcamps.length; _dci++) {
                        var occ = 0;
                        for (var _dti = 0; _dti < (tcamps[_dci].tents || []).length; _dti++) {
                            if (tcamps[_dci].tents[_dti].occupantId) occ++;
                        }
                        if (occ === 0) { targetCamp = tcamps[_dci]; break; }
                    }
                    if (!targetCamp && (p.temperament === 'cruel' || disposition <= -4)) {
                        targetCamp = rng.pick(tcamps);
                    }
                    if (targetCamp) {
                        for (var _eti = 0; _eti < (targetCamp.tents || []).length; _eti++) {
                            var evTent = targetCamp.tents[_eti];
                            if (evTent.occupantId) {
                                var evPerson = findPerson(evTent.occupantId);
                                if (evPerson) {
                                    evPerson.houseType = null;
                                    evPerson._tentCampId = null;
                                    evPerson._tentIndex = null;
                                }
                                evTent.occupantId = null;
                                evTent.occupantType = null;
                            }
                        }
                        var tcIdx = town.buildings.indexOf(targetCamp);
                        if (tcIdx >= 0) town.buildings.splice(tcIdx, 1);
                        logEvent('🔥 The ruler of ' + k.name + ' ordered soldiers to demolish a tent camp in ' + town.name + '.', {
                            type: 'tent_camp_demolition', townId: town.id, kingdomId: k.id
                        }, 'local_town');
                        logKingAction(k, '🔥 Demolished tent camp in ' + town.name);
                        if (town.happiness !== undefined) town.happiness = Math.max(0, town.happiness - 5);
                    }
                }
            }
        }

        // 7. LAW CHANGES
        if (p.ambition === 'ambitious' && rng.chance(0.1)) {
            // Ambitious kings may add restrictive trade laws
            if (k.laws.tradeTariff < 0.15) {
                k.laws.tradeTariff = Math.min(0.15, k.laws.tradeTariff + 0.01);
                logKingAction(k, '📈 Raised trade tariff to ' + Math.round(k.laws.tradeTariff * 100) + '%');
            }
        }
        if (p.temperament === 'cruel' && rng.chance(0.1)) {
            k.taxRate = Math.min(0.25, k.taxRate + 0.01);
            k.lastTaxIncreaseDay = world.day;
            logKingAction(k, '📈 Cruel king raised taxes to ' + Math.round(k.taxRate * 100) + '%');
        }

        // =============================================
        // 8. WARTIME MILITARY DECISIONS
        // =============================================
        if (atWar) {
            // a. MASS RECRUITMENT — recruit with budget sustainability awareness
            // War exhaustion reduces or halts recruitment
            var recruitMod = getWarExhaustionRecruitMod(k);
            const recruitLimit = Math.floor((p.courage === 'brave' ? 4 :
                                 p.courage === 'cautious' ? 1 : 2) * recruitMod);
            // H-2: First 90 days of war — cap recruitment to 50%
            var _daysSinceWarStart = world.day - (k._lastWarStartDay || 0);
            var earlyWarMod = _daysSinceWarStart < 90 ? 0.5 : 1.0;
            var effectiveRecruitLimit = Math.max(0, Math.floor(recruitLimit * earlyWarMod));
            // H-2: Don't recruit if treasury is below war reserve
            var _warFs = Engine.getKingdomFinancialState(k);
            if (k.gold < _warFs.minReserve * 0.5) effectiveRecruitLimit = 0;
            // Budget sustainability: estimate if adding soldiers is affordable
            var _estDailyIncome = (_warFs.lastSeasonRevenue || 0) / 90;
            var _estDailyCost = _warFs.soldierCount * 1 + _warFs.soldierCount * CONFIG.KINGDOM_SOLDIER_DAILY_COST / 30 + _warFs.monthlyBuildingCost / 30;
            var _budgetMargin = _estDailyIncome - _estDailyCost;
            // Smart kings won't recruit if budget is unsustainable
            if (_budgetMargin < 0 && (p.intelligence === 'brilliant' || p.intelligence === 'clever')) {
                effectiveRecruitLimit = 0;
            } else if (_budgetMargin < 2) {
                effectiveRecruitLimit = Math.min(effectiveRecruitLimit, 1);
            }
            // RNG: sometimes kings recruit slightly more or less
            if (rng.chance(0.1)) effectiveRecruitLimit = Math.max(0, effectiveRecruitLimit + rng.randInt(-1, 1));
            let recruited = 0;
            for (const townId of k.territories) {
                if (recruited >= effectiveRecruitLimit) break;
                const town = findTown(townId);
                if (!town) continue;
                var idle = getPeopleInTown(town.id).filter(function(pp) {
                    return (pp.occupation === 'laborer' || pp.occupation === 'none') &&
                    pp.age >= CONFIG.COMING_OF_AGE && pp.age <= 50;
                });
                for (const person of idle) {
                    if (recruited >= effectiveRecruitLimit) break;
                    if (k.gold < 75) break;
                    var uType = 'infantry';
                    var townSupply = town.market.supply || {};
                    if ((townSupply.horses || 0) > 0 && (townSupply.saddles || 0) > 0 && rng.chance(0.15)) uType = 'cavalry';
                    else if ((townSupply.bows || 0) > 0 && rng.chance(0.25)) uType = 'archer';
                    recruitSoldier(person, town, k, uType);
                    k.gold -= 75;
                    recruited++;
                }
            }

            // b. BUY WEAPONS FROM MARKET — creates real demand (including quality tiers)
            const weaponGoods = ['swords', 'armor', 'bows', 'arrows', 'horses'];
            // Smart kings also buy quality weapons during war
            const qualityGoods = (p.intelligence === 'brilliant' || p.intelligence === 'clever')
                ? ['swords_good', 'armor_good', 'bows_good', 'arrows_good'] : [];
            const allWeaponGoods = weaponGoods.concat(qualityGoods);
            for (const townId of k.territories) {
                const town = findTown(townId);
                if (!town) continue;
                for (const good of allWeaponGoods) {
                    const available = town.market.supply[good] || 0;
                    const price = town.market.prices[good] || 20;
                    const toBuy = Math.min(available, Math.floor(k.gold / price), 5);
                    if (toBuy > 0 && k.gold >= toBuy * price) {
                        town.market.supply[good] = Math.max(0, available - toBuy);
                        k.gold -= toBuy * price;
                        town.market.demand[good] = (town.market.demand[good] || 0) + toBuy;
                    }
                }

                // Smart kings set military buildings to produce quality weapons
                for (const bld of town.buildings) {
                    const militaryTypes = ['blacksmith', 'armorer', 'fletcher', 'arrow_maker'];
                    if (militaryTypes.includes(bld.type) && (bld.ownerId === null || bld.ownerId === k.id)) {
                        if (p.intelligence === 'brilliant') {
                            bld.productionTier = 'good';
                        } else if (p.intelligence === 'clever') {
                            bld.productionTier = rng.chance(0.5) ? 'good' : 'basic';
                        }
                    }
                }
            }

            // c. FORTIFY THREATENED TOWNS — build/upgrade walls
            for (const townId of k.territories) {
                const town = findTown(townId);
                if (!town) continue;
                const wallLevel = town.walls || 0;
                if (wallLevel >= 3) continue;
                const nextLevel = wallLevel + 1;
                const wallConfig = CONFIG.WALL_LEVELS[nextLevel];
                if (!wallConfig) continue;
                // Check if town is near enemy
                const nearEnemy = world.towns.some(t =>
                    k.atWar.has(t.kingdomId) && Math.hypot(t.x - town.x, t.y - town.y) < 2000
                );
                if (!nearEnemy && !town.isCapital) continue;
                if (k.gold < wallConfig.cost) continue;
                // Check materials
                let hasMats = true;
                for (const [matId, qty] of Object.entries(wallConfig.materials)) {
                    if ((town.market.supply[matId] || 0) < qty) { hasMats = false; break; }
                }
                if (hasMats && rng.chance(0.2)) {
                    // Skip if wall already under construction
                    if (town._wallConstruction) continue;
                    for (const [matId, qty] of Object.entries(wallConfig.materials)) {
                        town.market.supply[matId] -= qty;
                    }
                    k.gold -= wallConfig.cost;
                    distributeConstructionWages(town.id, wallConfig.cost, rng);
                    var _wallBuildDays = (CONFIG.KINGDOM_BUILD_TIMES && CONFIG.KINGDOM_BUILD_TIMES.wall_upgrade) ? CONFIG.KINGDOM_BUILD_TIMES.wall_upgrade.build : 30;
                    town._wallConstruction = { targetLevel: nextLevel, completeDay: world.day + _wallBuildDays, name: wallConfig.name };
                    logEvent(`${kingdom_name(k)} begins building ${wallConfig.name} around ${town.name}!`, { kingdomId: k.id, townId: town.id }, _eventKingdomCategory(k.id));
                }
            }

            // d. DISPATCH ARMIES — handled in kingdomAI, but smart/aggressive kings target differently
            // (Already handled in kingdomAI function)

            // e. REINFORCE TOWNS — move garrison from safe towns to threatened ones
            if ((p.intelligence === 'brilliant' || p.intelligence === 'clever') && rng.chance(0.3)) {
                const safeTowns = [];
                const threatenedTowns = [];
                for (const townId of k.territories) {
                    const town = findTown(townId);
                    if (!town) continue;
                    const nearEnemy = world.towns.some(t =>
                        k.atWar.has(t.kingdomId) && Math.hypot(t.x - town.x, t.y - town.y) < 1500
                    );
                    if (nearEnemy) threatenedTowns.push(town);
                    else safeTowns.push(town);
                }
                for (const safe of safeTowns) {
                    if (safe.garrison <= CONFIG.GARRISON_MIN + 5) continue;
                    for (const threatened of threatenedTowns) {
                        if (threatened.garrison < CONFIG.GARRISON_MIN + 10) {
                            const transfer = Math.min(5, safe.garrison - CONFIG.GARRISON_MIN);
                            if (transfer > 0) {
                                // AI uses transfer system with travel time
                                safe.garrison -= transfer;
                                if (!k._soldierTransfers) k._soldierTransfers = [];
                                var _travelDays = 2;
                                try {
                                    var _route = findArmyRoute(safe.id, threatened.id, k.id);
                                    if (_route && _route.totalTime) _travelDays = Math.max(1, Math.ceil(_route.totalTime));
                                } catch(e) {}
                                k._soldierTransfers.push({
                                    fromTownId: safe.id, toTownId: threatened.id,
                                    count: transfer, departDay: world.day, arrivalDay: world.day + _travelDays
                                });
                            }
                        }
                    }
                }
            }

            // f. BUILD MILITARY BUILDINGS
            if (k.gold > 800 && rng.chance(0.15)) {
                for (const townId of k.territories) {
                    const town = findTown(townId);
                    if (!town) continue;
                    const hasBarracks = town.buildings.some(b => b.type === 'barracks');
                    if (!hasBarracks && k.gold >= 600) {
                        if (kingdomBuild(k, town, 'barracks', rng)) {
                            logKingAction(k, '🏗️ Built barracks in ' + town.name);
                            break;
                        }
                    }
                    // Build horse ranch if kingdom has no horse production
                    var hasHorseRanch = false;
                    for (var _hti = 0; _hti < town.buildings.length; _hti++) {
                        if (town.buildings[_hti].type === 'horse_ranch') { hasHorseRanch = true; break; }
                    }
                    if (!hasHorseRanch && k.gold >= 600 && rng.chance(0.3)) {
                        // Check if any kingdom town already has a horse ranch
                        var kingdomHasHorseRanch = false;
                        for (var _kti of k.territories) {
                            var _kt = findTown(_kti);
                            if (_kt && _kt.buildings.some(function(b) { return b.type === 'horse_ranch'; })) {
                                kingdomHasHorseRanch = true;
                                break;
                            }
                        }
                        if (!kingdomHasHorseRanch) {
                            if (kingdomBuild(k, town, 'horse_ranch', rng)) {
                                logKingAction(k, '🏗️ Built horse ranch in ' + town.name);
                                break;
                            }
                        }
                    }
                    // Build fletcher + hemp farm if kingdom lacks bow production
                    var hasFletcher = town.buildings.some(function(b) { return b.type === 'fletcher'; });
                    if (!hasFletcher && k.gold >= 400 && rng.chance(0.2)) {
                        if (kingdomBuild(k, town, 'fletcher', rng)) {
                            logKingAction(k, '🏗️ Built fletcher in ' + town.name);
                            // Also build hemp farm if town doesn't have one
                            if (!town.buildings.some(function(b) { return b.type === 'hemp_farm'; })) {
                                kingdomBuild(k, town, 'hemp_farm', rng);
                            }
                            break;
                        }
                    }
                }
            }

            // g. BUILD FORTRESS WALLS AT VULNERABLE SEAPORTS
            // Personality-driven: defensive/cautious kings prioritize, aggressive kings deprioritize
            if (k.gold > 4000) {
                var _fwCfg2 = CONFIG.FORTRESS_WALLS || {};
                var _fwCost = _fwCfg2.cost || 3500;
                for (var _fwTi = 0; _fwTi < Array.from(k.territories).length; _fwTi++) {
                    var _fwTownId = Array.from(k.territories)[_fwTi];
                    var _fwTown = findTown(_fwTownId);
                    if (!_fwTown || !_fwTown.isPort) continue;
                    var _hasFW = _fwTown.buildings.some(function(b) { return b.type === 'fortress_walls'; });
                    if (_hasFW) continue;

                    // Decision factors based on personality
                    var _fwChance = 0;
                    if (p.militarism === 'defensive') _fwChance += 0.15;
                    if (p.courage === 'cautious') _fwChance += 0.10;
                    if (p.militarism === 'aggressive' || p.militarism === 'warlike') _fwChance -= 0.08;
                    if (p.intelligence === 'brilliant') _fwChance += 0.08;
                    else if (p.intelligence === 'clever') _fwChance += 0.04;
                    if (p.generosity === 'miserly' || p.greed === 'greedy') _fwChance -= 0.05;
                    if (k.gold > 10000) _fwChance += 0.05;
                    // At war greatly increases urgency
                    if (k.atWar.size > 0) {
                        _fwChance += 0.12;
                        // Even more urgent if enemy has ships
                        for (var _eId of k.atWar) {
                            var _enemy = findKingdom(_eId);
                            if (_enemy && _enemy.navalFleet && _enemy.navalFleet.length > 0) {
                                _fwChance += 0.15;
                                break;
                            }
                        }
                    }

                    // Check materials
                    var _fwHasMats = true;
                    if (_fwCfg2.materials) {
                        for (var _fwMat in _fwCfg2.materials) {
                            if ((_fwTown.market.supply[_fwMat] || 0) < _fwCfg2.materials[_fwMat]) {
                                _fwHasMats = false;
                                break;
                            }
                        }
                    }

                    if (_fwHasMats && k.gold >= _fwCost && rng.chance(Math.max(0.01, _fwChance))) {
                        // Consume materials
                        if (_fwCfg2.materials) {
                            for (var _fwMat2 in _fwCfg2.materials) {
                                _fwTown.market.supply[_fwMat2] = Math.max(0, (_fwTown.market.supply[_fwMat2] || 0) - _fwCfg2.materials[_fwMat2]);
                            }
                        }
                        k.gold -= _fwCost;
                        distributeConstructionWages(_fwTown.id, _fwCost, rng);
                        var _fwBuildDays = (CONFIG.KINGDOM_BUILD_TIMES && CONFIG.KINGDOM_BUILD_TIMES.fortress_walls) ? CONFIG.KINGDOM_BUILD_TIMES.fortress_walls.build : 60;
                        _fwTown.buildings.push({
                            type: 'fortress_walls', level: 1, ownerId: null,
                            builtDay: world.day, condition: 'under_construction',
                            constructionComplete: world.day + _fwBuildDays,
                            lastRepairDay: 0,
                            fortressWallsHP: _fwCfg2.maxHP || 600,
                            fortressWallsMaxHP: _fwCfg2.maxHP || 600
                        });
                        logEvent('🏰 ' + kingdom_name(k) + ' begins constructing fortress walls at ' + _fwTown.name + '!',  {
                            type: 'construction_project', kingdomId: k.id, townId: _fwTown.id
                        }, _eventKingdomCategory(k.id));
                        logKingAction(k, '🏰 Ordered fortress wall construction at ' + _fwTown.name);
                        break;
                    }
                }
            }

            // h. STRATEGIC BRIDGE DESTRUCTION — destroy bridges to enemy territory
            // Kings evaluate: defensive value (slowing larger enemy army), trade disruption
            // Smart kings destroy bridges on invasion routes; desperate kings destroy any
            if (rng.chance(0.15)) { // Don't evaluate every tick
                for (var _bri = 0; _bri < world.roads.length; _bri++) {
                    var _road = world.roads[_bri];
                    if (!_road.hasBridge || _road.bridgeDestroyed) continue;
                    var _brFrom = findTown(_road.fromTownId);
                    var _brTo = findTown(_road.toTownId);
                    if (!_brFrom || !_brTo) continue;

                    // Only consider bridges connecting our territory to enemy territory
                    var ownFrom = k.territories.has(_road.fromTownId);
                    var ownTo = k.territories.has(_road.toTownId);
                    if (ownFrom === ownTo) continue; // Both ours or neither

                    var enemyTown = ownFrom ? _brTo : _brFrom;
                    var ourTown = ownFrom ? _brFrom : _brTo;
                    if (!k.atWar.has(enemyTown.kingdomId)) continue; // Not at war with bridge neighbor

                    var enemyK = findKingdom(enemyTown.kingdomId);
                    if (!enemyK) continue;

                    // Evaluate strategic value of destroying this bridge
                    var destroyScore = 0;
                    var myMilStr = computeMilitaryStrength(k);
                    var theirMilStr = computeMilitaryStrength(enemyK);

                    // DEFENSIVE: weaker kingdoms benefit more from bridge destruction
                    if (theirMilStr > myMilStr * 1.3) destroyScore += 3; // They're stronger — slow them down
                    else if (theirMilStr > myMilStr) destroyScore += 1;
                    else destroyScore -= 1; // We're stronger — we want the bridge for attacking

                    // TRADE DISRUPTION: does this bridge serve enemy trade?
                    var enemyTradeRoutes = 0;
                    for (var _eri = 0; _eri < (world.caravans || []).length; _eri++) {
                        var _c = world.caravans[_eri];
                        if (_c.route && (_c.route.some(function(leg) {
                            return (leg.from === _road.fromTownId && leg.to === _road.toTownId) ||
                                   (leg.from === _road.toTownId && leg.to === _road.fromTownId);
                        }))) enemyTradeRoutes++;
                    }
                    if (enemyTradeRoutes > 0) destroyScore += 1;

                    // PERSONALITY modifiers
                    if (p.intelligence === 'brilliant') destroyScore += 1; // Strategic thinker
                    else if (p.intelligence === 'foolish') destroyScore -= 2; // Doesn't think of this
                    else if (p.intelligence === 'dim') destroyScore -= 1;
                    if (p.courage === 'cowardly') destroyScore += 1; // Defensive instinct
                    if (p.temperament === 'cruel') destroyScore += 1; // Scorched earth
                    if (p.temperament === 'kind') destroyScore -= 1; // Reluctant to destroy infrastructure

                    // Is our town near enemy armies? Urgent defensive need
                    var nearbyEnemyArmies = (world.armies || []).filter(function(a) {
                        return a.kingdomId === enemyK.id && a.toTownId &&
                               (a.toTownId === ourTown.id || Math.hypot(
                                   (findTown(a.toTownId) || {}).x - ourTown.x,
                                   (findTown(a.toTownId) || {}).y - ourTown.y
                               ) < 1000);
                    });
                    if (nearbyEnemyArmies.length > 0) destroyScore += 3; // Urgent!

                    // Only destroy if score is convincingly positive
                    if (destroyScore >= 3) {
                        // Destroy all bridges on this road (wartime scorched earth)
                        Engine.destroyBridge(_bri);
                        if (_road.bridges) {
                            for (var _wbi = 0; _wbi < _road.bridges.length; _wbi++) {
                                _road.bridges[_wbi].destroyedBy = k.id;
                            }
                        }
                        _road.bridgeDestroyedBy = k.id;
                        logEvent('💥 ' + k.name + ' destroyed the bridge between ' + ourTown.name + ' and ' + enemyTown.name + '! ' +
                            (theirMilStr > myMilStr ? 'A desperate defensive measure.' : 'A strategic strike to cut off the enemy.'), {
                            type: 'bridge_destroyed', townId: ourTown.id, otherTownId: enemyTown.id, kingdomId: k.id, _noToast: true,
                            cause: 'Wartime strategic decision by ' + (k.king || 'ruler'),
                            effects: [
                                'Road between ' + ourTown.name + ' and ' + enemyTown.name + ' is now impassable',
                                'Armies must take slower off-road routes',
                                'Trade between towns disrupted'
                            ]
                        }, 'local_town');
                        logKingAction(k, '💥 Destroyed bridge to ' + enemyTown.name);
                        break; // Only destroy one bridge per tick
                    }
                }
            }

            // h. NEGOTIATE PEACE — if losing badly or war-exhausted
            for (const enemyId of k.atWar) {
                const enemy = findKingdom(enemyId);
                if (!enemy) continue;
                const myStr = computeMilitaryStrength(k);
                const theirStr = computeMilitaryStrength(enemy);
                const losing = myStr < theirStr * 0.6;
                const lostTowns = (kingdom => {
                    if (!world.activeWars) return 0;
                    for (const wid in world.activeWars) {
                        const w = world.activeWars[wid];
                        if ((w.kingdomA === k.id || w.kingdomB === k.id) &&
                            (w.kingdomA === enemyId || w.kingdomB === enemyId)) {
                            const origCount = w.originalTowns[k.id] || k.territories.size;
                            return origCount - k.territories.size;
                        }
                    }
                    return 0;
                })(k);

                var exhaustion = k.warExhaustion || 0;
                // C2: Raise exhaustion thresholds — wars should last longer with more battles
                var highExhaustion = exhaustion > 65;
                var criticalExhaustion = exhaustion > 85;

                const wantsPeace = (losing && lostTowns >= 3 && p.courage !== 'brave') ||
                                   (p.courage === 'cowardly' && losing && lostTowns >= 1) ||
                                   (p.intelligence === 'brilliant' && losing && lostTowns >= 2) ||
                                   (highExhaustion && p.courage !== 'brave' && losing) ||
                                   (criticalExhaustion) || // even brave kings consider peace at critical exhaustion
                                   (k.gold < 100 && (k._bankruptDays || 0) > 45);

                var peaceChance = 0.06;
                if (criticalExhaustion) peaceChance = 0.25;
                else if (highExhaustion) peaceChance = 0.12;
                if (k.atWar.size > 1) peaceChance += 0.08; // multi-front pressure

                if (wantsPeace && rng.chance(peaceChance)) {
                    // If enemy is player-king, send peace offer instead of auto-making peace
                    if (_isPlayerKingOf(enemy)) {
                        // Generate surrender terms — loser (k) pays tribute and may cede towns
                        var _surrenderTerms = evaluatePeaceTerms(k, enemy);
                        if (!enemy._pendingPetitions) enemy._pendingPetitions = [];
                        enemy._pendingPetitions.push({
                            id: 'surrender_offer_' + k.id + '_' + (world.day || 0),
                            type: 'surrender_offer',
                            from: k.name,
                            fromId: k.id,
                            title: '🏳️ ' + k.name + ' Wants to Surrender',
                            description: k.name + ' is losing and wants to surrender. They offer ' + Math.floor((_surrenderTerms.offer || {}).gold || 0) + 'g and ' + ((_surrenderTerms.offer || {}).towns || []).length + ' town(s).',
                            day: world.day,
                            peaceTerms: _surrenderTerms
                        });
                        _addAdvisorSuggestion(enemy, 'diplomacy', '🏳️', k.name + ' Wants to Surrender',
                            k.name + ' is losing the war (strength ' + Math.floor(myStr) + ' vs our ' + Math.floor(theirStr) + ') and seeks to negotiate peace terms. Check War Management to accept or reject.',
                            'surrender_offer_from_' + k.id, { enemyId: k.id, enemyName: k.name });
                    } else if (hasSpecialLaw(k, 'noble_council')) {
                        initiateCouncilVote(k, 'Negotiate peace with ' + enemy.name,
                            'We are losing the war. Military comparison: ' + Math.floor(myStr) + ' vs ' + Math.floor(theirStr) + '. War exhaustion: ' + Math.floor(exhaustion),
                            'make_peace',
                            (function(kRef, eRef) { return function() { makePeace(kRef, eRef, true, kRef); }; })(k, enemy),
                            { action: 'make_peace', args: { kingdomAId: k.id, kingdomBId: enemy.id, isSurrender: true, loserId: k.id, isExhaustion: false } }
                        );
                    } else {
                        makePeace(k, enemy, true, k);
                    }
                    break;
                }
            }
        }

        // Peacetime: reset military buildings to basic production
        if (!atWar) {
            for (const townId of k.territories) {
                const town = findTown(townId);
                if (!town) continue;
                for (const bld of town.buildings) {
                    if (['blacksmith', 'armorer', 'fletcher', 'arrow_maker'].includes(bld.type) && (bld.ownerId === null || bld.ownerId === k.id)) {
                        bld.productionTier = 'basic';
                    }
                }
            }
        }

        // =============================================
        // 8B. DYNAMIC SOLDIER PAY (runs both war & peace, once per kingdom)
        // =============================================
        var totalSoldiers = ((_tickCache.soldiersByKingdom || {})[k.id] || []).length;
        var desiredSoldiers = 0;
        for (var _dti of k.territories) {
            var _dt = findTown(_dti);
            if (_dt) desiredSoldiers += Math.max(5, Math.floor(getPeopleInTown(_dt.id).length * (atWar ? 0.12 : 0.06)));
        }
        var soldierRatio = desiredSoldiers > 0 ? totalSoldiers / desiredSoldiers : 1;
        k._soldierRatio = soldierRatio; // cache for conscription checks

        if (soldierRatio < 0.7) {
            // Need more soldiers — raise pay
            k.soldierPayMult = Math.min(3.0, (k.soldierPayMult || 1.0) + 0.03);
        } else if (soldierRatio < 0.9 && atWar) {
            // Wartime shortfall — slight pay bump
            k.soldierPayMult = Math.min(2.0, (k.soldierPayMult || 1.0) + 0.01);
        } else if (soldierRatio > 1.5) {
            // Well overstaffed — decrease pay back toward baseline
            k.soldierPayMult = Math.max(1.0, (k.soldierPayMult || 1.0) - 0.03);
        } else if (soldierRatio > 1.1 && !atWar) {
            // Peacetime surplus — slowly decrease
            k.soldierPayMult = Math.max(1.0, (k.soldierPayMult || 1.0) - 0.01);
        }

        // Pay-driven peacetime recruitment: higher pay attracts volunteers (budget-aware)
        if (!atWar && soldierRatio < 0.9 && k.gold > 500) {
            var _volFs = Engine.getKingdomFinancialState(k);
            var _volCanRecruit = k.gold > _volFs.minReserve; // only recruit above reserve
            if (_volCanRecruit) {
            var payMult = k.soldierPayMult || 1.0;
            // Higher pay = higher chance of volunteer per day (base 5%, up to 25% at 3x pay)
            var volunteerChance = 0.05 + (payMult - 1.0) * 0.10;
            if (rng.chance(volunteerChance)) {
                for (var _rti of k.territories) {
                    var _rt = findTown(_rti);
                    if (!_rt) continue;
                    var volunteerPool = getPeopleInTown(_rt.id).filter(function(vp) {
                        return (vp.occupation === 'laborer' || vp.occupation === 'none') &&
                            vp.age >= CONFIG.COMING_OF_AGE && vp.age <= 45;
                    });
                    if (volunteerPool.length > 0) {
                        var vol = volunteerPool[Math.floor(rng.random() * volunteerPool.length)];
                        var vType = 'infantry';
                        var vSupply = _rt.market.supply || {};
                        if ((vSupply.horses || 0) > 0 && (vSupply.saddles || 0) > 0 && rng.chance(0.15)) vType = 'cavalry';
                        else if ((vSupply.bows || 0) > 0 && rng.chance(0.25)) vType = 'archer';
                        recruitSoldier(vol, _rt, k, vType);
                        k.gold -= 50;
                        break; // one volunteer per day
                    }
                }
            }
            } // end _volCanRecruit
        }

        // =============================================
        // 8b. WARTIME FINANCIAL DECISIONS — personality-driven tax/seizure
        // =============================================
        if (atWar) {
            var _wfFs = Engine.getKingdomFinancialState(k);

            // --- WARTIME TAX RAISING (by personality) ---
            // Kings raise taxes preemptively or reactively during war based on personality
            if (k.gold < _wfFs.minReserve * 1.5) {
                var taxRaiseChance = 0;
                var taxRaiseAmount = 0;
                if (p.intelligence === 'brilliant' || p.intelligence === 'clever') {
                    // Smart kings raise taxes early and moderately
                    taxRaiseChance = 0.4;
                    taxRaiseAmount = rng.randFloat(0.01, 0.02);
                } else if (p.greed === 'greedy' || p.greed === 'corrupt') {
                    // Greedy/corrupt kings aggressively raise taxes
                    taxRaiseChance = 0.6;
                    taxRaiseAmount = rng.randFloat(0.02, 0.04);
                } else if (p.courage === 'brave' || p.ambition === 'ambitious') {
                    // Brave/ambitious kings raise taxes to fund the war effort
                    taxRaiseChance = 0.3;
                    taxRaiseAmount = rng.randFloat(0.01, 0.03);
                } else if (p.greed === 'generous') {
                    // Generous kings reluctant to raise taxes
                    taxRaiseChance = 0.1;
                    taxRaiseAmount = rng.randFloat(0.005, 0.01);
                } else {
                    taxRaiseChance = 0.2;
                    taxRaiseAmount = rng.randFloat(0.01, 0.02);
                }
                // More urgent if actually broke
                if (k.gold < 500) { taxRaiseChance += 0.3; taxRaiseAmount += 0.01; }

                if (rng.chance(taxRaiseChance) && k.taxRate < 0.25) {
                    k.taxRate = Math.min(0.25, k.taxRate + taxRaiseAmount);
                    k.lastTaxIncreaseDay = world.day;
                    logKingAction(k, '📈 Raised wartime taxes to ' + Math.round(k.taxRate * 100) + '%');
                    logEvent('📈 ' + k.name + ' raises taxes to ' + Math.round(k.taxRate * 100) + '% to fund the war effort.',  {
                        type: 'wartime_tax_increase', kingdomId: k.id, cause: 'War expenses depleting treasury (' + Math.floor(k.gold) + 'g)',
                        effects: ['Trade becomes more expensive', 'Citizens pay more taxes', 'War funding improved']
                    }, _eventKingdomCategory(k.id));
                }
            }

            // --- ASSET SEIZURE (cruel/corrupt/desperate kings) ---
            // Enact seizure law if not already active and king is willing
            if (!k._seizureLawActive) {
                var seizureLawChance = 0;
                if (p.temperament === 'cruel' && k.gold < _wfFs.minReserve) seizureLawChance = 0.15;
                if (p.greed === 'corrupt') seizureLawChance += 0.10;
                if (p.greed === 'greedy') seizureLawChance += 0.05;
                // Desperate kings of any personality may resort to seizure
                if (k.gold < 200 && (k._bankruptDays || 0) > 10) seizureLawChance += 0.20;
                // Just/kind kings strongly resist
                if (p.justice === 'just') seizureLawChance *= 0.2;
                if (p.temperament === 'kind') seizureLawChance *= 0.3;

                if (seizureLawChance > 0 && rng.chance(seizureLawChance)) {
                    k._seizureLawActive = true;
                    k._seizureLawDay = world.day;
                    k._seizureCount = 0;
                    k._seizureResentment = 0;
                    logEvent('⚖️👑 The ruler of ' + k.name + ' enacts the Right of Royal Requisition — the crown may seize assets for the war effort!',  {
                        type: 'seizure_law', cause: 'War treasury crisis (' + Math.floor(k.gold) + 'g)',
                        effects: ['The king can now seize buildings, gold, and goods from citizens',
                                  'Citizens will grow resentful if seizures are frequent',
                                  'Rebellion may follow if the king goes too far'],
                        kingdomId: k.id
                    }, _eventKingdomCategory(k.id));
                    logKingAction(k, '⚖️ Enacted Right of Royal Requisition');
                }
            }

            // Execute seizures if law is active and treasury is desperate
            if (k._seizureLawActive && k.gold < _wfFs.minReserve * 0.8) {
                // Personality-driven seizure target priority
                // Cruel: target poorest first (commoners), Corrupt: target wealthiest (more gold), Desperate: target anyone
                var seizureTargets = [];
                var kCitizens = Engine.getPeopleInKingdom(k.id).filter(function(c) {
                    return c.gold > 5 && c.occupation !== 'soldier' && c.occupation !== 'guard';
                });

                if (p.temperament === 'cruel') {
                    // Cruel kings squeeze commoners first, then merchants, then elites
                    seizureTargets = kCitizens.sort(function(a, b) { return (a.gold || 0) - (b.gold || 0); });
                } else if (p.greed === 'corrupt') {
                    // Corrupt kings target the wealthy (more gold to seize)
                    seizureTargets = kCitizens.sort(function(a, b) { return (b.gold || 0) - (a.gold || 0); });
                } else {
                    // Others target merchants and elites first (less backlash)
                    seizureTargets = kCitizens.filter(function(c) {
                        return c.occupation === 'merchant' || c.isEliteMerchant;
                    }).sort(function(a, b) { return (b.gold || 0) - (a.gold || 0); });
                    // If not enough merchants, add laborers
                    if (seizureTargets.length < 5) {
                        var others = kCitizens.filter(function(c) { return c.occupation !== 'merchant' && !c.isEliteMerchant; });
                        seizureTargets = seizureTargets.concat(others);
                    }
                }

                // Seize gold from citizens (up to 10% of their wealth, max 5 citizens per tick)
                var citizenSeized = 0;
                var goodsSeized = 0;
                var buildingSeized = 0;
                var seizedFrom = 0;
                var maxSeize = Math.min(5, seizureTargets.length);
                for (var si = 0; si < maxSeize; si++) {
                    var target = seizureTargets[si];
                    var seizeRate = p.temperament === 'cruel' ? 0.15 : (p.greed === 'corrupt' ? 0.12 : 0.08);
                    var seizeAmount = Math.floor((target.gold || 0) * seizeRate);
                    if (seizeAmount > 2 && (target.gold || 0) >= seizeAmount) {
                        target.gold -= seizeAmount;
                        citizenSeized += seizeAmount;
                        seizedFrom++;
                    }
                }
                // Add citizen gold to treasury
                k.gold += citizenSeized;

                // Seize goods from town markets (if gold seizure wasn't enough)
                if (citizenSeized < 100 && rng.chance(0.3)) {
                    for (var _stid of k.territories) {
                        var _sTown = findTown(_stid);
                        if (!_sTown) continue;
                        var valuableGoods = ['swords', 'armor', 'horses', 'jewelry', 'silk', 'wine'];
                        for (var vgi = 0; vgi < valuableGoods.length; vgi++) {
                            var gid = valuableGoods[vgi];
                            var avail = (_sTown.market.supply[gid] || 0);
                            var toSeize = Math.min(avail, 3);
                            if (toSeize > 0) {
                                _sTown.market.supply[gid] -= toSeize;
                                var val = (_sTown.market.prices[gid] || 10) * toSeize;
                                k.gold += Math.floor(val * 0.6); // sell at 60% value
                                goodsSeized += Math.floor(val * 0.6);
                            }
                        }
                        break; // one town per tick
                    }
                }

                // Seize a building (rare, last resort — only cruel/corrupt kings or extreme desperation)
                var totalSeized = citizenSeized + goodsSeized;
                if (totalSeized < 50 && (p.temperament === 'cruel' || p.greed === 'corrupt' || (k._bankruptDays || 0) > 20) && rng.chance(0.08)) {
                    for (var _btid of k.territories) {
                        var _bTown = findTown(_btid);
                        if (!_bTown) continue;
                        // Find a privately-owned building to seize
                        var seizable = _bTown.buildings.filter(function(bld) {
                            return bld.ownerId && bld.ownerId !== k.id && bld.ownerId !== 'player';
                        });
                        if (seizable.length > 0) {
                            var targetBld = rng.pick(seizable);
                            var bldValue = (_bTown.market.prices[targetBld.type] || 200) * 2;
                            var prevOwner = targetBld.ownerId;
                            targetBld.ownerId = k.id; // crown seizes it
                            k.gold += Math.floor(bldValue * 0.4); // immediate partial liquidation value
                            buildingSeized += Math.floor(bldValue * 0.4);
                            k._seizureCount = (k._seizureCount || 0) + 1;
                            logEvent('👑⚠️ The crown of ' + k.name + ' seizes a ' + targetBld.type + ' in ' + _bTown.name + '!',  {
                                type: 'building_seizure', cause: 'Royal Requisition for war effort',
                                effects: ['Building now crown property', 'Previous owner loses investment',
                                          'Citizens grow fearful and resentful'],
                                kingdomId: k.id, townId: _bTown.id
                            }, _eventKingdomCategory(k.id));
                            logKingAction(k, '👑 Seized a ' + targetBld.type + ' in ' + _bTown.name);
                            break;
                        }
                    }
                }

                totalSeized = citizenSeized + goodsSeized + buildingSeized;

                // Resentment accumulation
                k._seizureResentment = (k._seizureResentment || 0) + seizedFrom * 2 + (k._seizureCount || 0) * 5;

                if (totalSeized > 0) {
                    logEvent('💰 The crown of ' + k.name + ' requisitions ' + Math.floor(totalSeized) + 'g worth of assets for the war effort.',  {
                        type: 'asset_seizure', cause: 'War funding crisis',
                        effects: ['Treasury +' + Math.floor(totalSeized) + 'g', 'Citizen resentment grows (' + Math.floor(k._seizureResentment || 0) + ')'],
                        kingdomId: k.id
                    }, _eventKingdomCategory(k.id));
                }

                // REBELLION CHECK — seizure resentment can trigger rebellion
                if ((k._seizureResentment || 0) > 50) {
                    var rebellionChance = ((k._seizureResentment || 0) - 50) * 0.005;
                    // Low happiness multiplies rebellion chance
                    if (happiness < 30) rebellionChance *= 2;
                    if (happiness < 15) rebellionChance *= 3;
                    // Just kings get some grace
                    if (p.justice === 'just') rebellionChance *= 0.5;
                    rebellionChance = Math.min(0.3, rebellionChance);

                    if (rng.chance(rebellionChance)) {
                        var _seizKing = findPerson(k.king);
                        var _seizKingName = _seizKing ? ((_seizKing.firstName || '?') + ' ' + (_seizKing.lastName || '')) : 'the king';
                        logEvent('🔥⚔️ REBELLION in ' + k.name + '! Citizens revolt against the crown\'s seizure of assets!',  {
                            type: 'seizure_rebellion',
                            cause: 'Citizens of ' + k.name + ' rebel against ' + _seizKingName + '\'s tyrannical asset seizures',
                            kingName: _seizKingName,
                            kingId: k.king,
                            effects: ['Major happiness drop (-25)', 'Soldiers may defect', 'King faces overthrow risk',
                                      'Seizure law repealed by force'],
                            kingdomId: k.id
                        }, _eventKingdomCategory(k.id));
                        // Consequences
                        boostKingdomHappiness(k, -25);
                        k._seizureLawActive = false;
                        k._seizureResentment = 0;
                        // Some soldiers defect
                        var defectors = Math.floor(_wfFs.soldierCount * rng.randFloat(0.05, 0.20));
                        var defected = 0;
                        var kSoldiers = (Engine.getTickCache && Engine.getTickCache().soldiersByKingdom && Engine.getTickCache().soldiersByKingdom[k.id]) || Engine.getPeopleInKingdom(k.id).filter(function(s) {
                            return s.occupation === 'soldier';
                        });
                        var _defectorNames = [];
                        for (var di = 0; di < kSoldiers.length && defected < defectors; di++) {
                            _defectorNames.push((kSoldiers[di].firstName || '?') + ' ' + (kSoldiers[di].lastName || ''));
                            kSoldiers[di].occupation = 'laborer';
                            var dTown = findTown(kSoldiers[di].townId);
                            if (dTown && dTown.garrison > 0) dTown.garrison--;
                            defected++;
                        }
                        // King may be overthrown
                        if (rng.chance(0.25)) {
                            logEvent('👑💀 The ruler of ' + k.name + ' is overthrown by the rebellion!',  {
                                type: 'seizure_overthrow', kingdomId: k.id,
                                cause: _seizKingName + ' overthrown by popular uprising against tyrannical seizures',
                                overthrownKing: _seizKingName,
                                overthrownKingId: k.king,
                                defectors: _defectorNames.slice(0, 5),
                                effects: ['New ruler takes power', 'Seizure law permanently repealed', 'Period of instability']
                            }, _eventKingdomCategory(k.id));
                            handleKingDeath(k, 'rebellion');
                        }
                    }
                }
            }
        } else {
            // Peacetime: repeal seizure law if active, wind down resentment
            if (k._seizureLawActive) {
                k._seizureLawActive = false;
                logEvent('⚖️ ' + k.name + ' repeals the Right of Royal Requisition as peace returns.',  {
                    type: 'seizure_law_repeal', kingdomId: k.id, cause: 'War ended', effects: ['Citizens relieved', 'Normal property rights restored']
                }, _eventKingdomCategory(k.id));
            }
            if ((k._seizureResentment || 0) > 0) {
                k._seizureResentment = Math.max(0, (k._seizureResentment || 0) - 1); // slowly decays in peacetime
            }
        }

        // =============================================
        // 9. DIPLOMATIC ACTIONS (enhanced king decisions)
        // =============================================
        // a. Propose trade agreements — reduce tariffs with ally
        if (rng.chance(p.intelligence === 'brilliant' ? 0.3 : 0.10)) {
            const potentialPartners = world.kingdoms.filter(o =>
                o.id !== k.id && !k.atWar.has(o.id) && (k.relations[o.id] || 0) > 20
            );
            if (potentialPartners.length > 0) {
                const partner = rng.pick(potentialPartners);
                k.relations[partner.id] = Math.min(100, (k.relations[partner.id] || 0) + 5);
                partner.relations[k.id] = Math.min(100, (partner.relations[k.id] || 0) + 5);
                logEvent(`🤝 ${k.name} proposes a trade agreement with ${partner.name}. Relations improve.`,  {
                    type: 'trade_proposal', cause: 'Diplomatic initiative', effects: ['Relations +5 both ways', 'Trade may increase']
                }, _eventEitherKingdomCategory(k.id, partner.id));
            }
        }

        // b. Send diplomatic gifts (C4: cost scales with kingdom wealth)
        var _dipGiftCost = Math.max(CONFIG.KINGDOM_GIFT_DIPLOMACY_COST || 500, Math.floor(treasury * (CONFIG.DIPLOMATIC_GIFT_SCALE_FACTOR || 0.05)));
        if (treasury > _dipGiftCost * 2 && rng.chance(p.generosity === 'generous' ? 0.2 : 0.05)) {
            const worstRelation = world.kingdoms.filter(o => o.id !== k.id && !k.atWar.has(o.id))
                .sort((a, b) => (k.relations[a.id] || 0) - (k.relations[b.id] || 0))[0];
            if (worstRelation && (k.relations[worstRelation.id] || 0) < 30) {
                k.gold -= _dipGiftCost;
                // C4: Bigger gifts = bigger relation boost (scaled proportionally)
                var relBoost = Math.min(25, Math.floor((CONFIG.KINGDOM_GIFT_DIPLOMACY_RELATION || 15) * (_dipGiftCost / 500)));
                k.relations[worstRelation.id] = Math.min(100, (k.relations[worstRelation.id] || 0) + relBoost);
                worstRelation.relations[k.id] = Math.min(100, (worstRelation.relations[k.id] || 0) + Math.floor(relBoost * 0.5));
                logEvent(`🎁 ${k.name} sends a diplomatic gift to ${worstRelation.name} (${_dipGiftCost}g).`,  {
                    type: 'diplomatic_gift', cause: 'Improving strained relations', effects: ['Relations +' + relBoost, 'Treasury -' + _dipGiftCost + 'g']
                }, _eventEitherKingdomCategory(k.id, worstRelation.id));
            }
        }

        // c. Arrange royal marriage (rare, big impact — +30 relations, -50% war chance)
        if (!atWar && rng.chance(0.02) && (p.intelligence === 'brilliant' || p.intelligence === 'clever')) {
            const marriageTarget = world.kingdoms.filter(o =>
                o.id !== k.id && !k.atWar.has(o.id) && (k.relations[o.id] || 0) > 10 && (k.relations[o.id] || 0) < 70
            );
            if (marriageTarget.length > 0) {
                const target = rng.pick(marriageTarget);
                const relBoost = 30;
                k.relations[target.id] = Math.min(100, (k.relations[target.id] || 0) + relBoost);
                target.relations[k.id] = Math.min(100, (target.relations[k.id] || 0) + relBoost);
                // Marriage alliance: mark to reduce war probability
                if (!k._marriageAlliances) k._marriageAlliances = {};
                if (!target._marriageAlliances) target._marriageAlliances = {};
                k._marriageAlliances[target.id] = world.day + 720; // lasts 2 years
                target._marriageAlliances[k.id] = world.day + 720;
                logEvent(`💒 A royal marriage is arranged between ${k.name} and ${target.name}! Relations soar.`,  {
                    type: 'royal_marriage', cause: 'Diplomatic alliance through marriage',
                    effects: ['Relations +' + relBoost + ' both ways', 'War probability halved for 2 years', 'Alliance more likely']
                }, _eventEitherKingdomCategory(k.id, target.id));
            }
        }

        // d. Demand tribute from weaker kingdoms
        if ((p.ambition === 'ambitious' || p.greed === 'greedy') && rng.chance(0.05)) {
            const myStr = computeMilitaryStrength(k);
            const weakerKingdoms = world.kingdoms.filter(o =>
                o.id !== k.id && !k.atWar.has(o.id) &&
                computeMilitaryStrength(o) < myStr * (CONFIG.KINGDOM_TRIBUTE_DEMAND_THRESHOLD || 0.5)
            );
            if (weakerKingdoms.length > 0) {
                const target = rng.pick(weakerKingdoms);
                const tributeAmount = rng.randInt(200, 500);
                if (target.gold >= tributeAmount && rng.chance(0.4)) {
                    target.gold -= tributeAmount;
                    k.gold += tributeAmount;
                    target.relations[k.id] = Math.max(-100, (target.relations[k.id] || 0) - 15);
                    logEvent(`💰 ${k.name} demands and receives ${tributeAmount}g tribute from ${target.name}!`,  {
                        type: 'tribute_demand', cause: 'Military dominance', effects: ['Treasury +' + tributeAmount + 'g', 'Target kingdom resentful']
                    }, _eventEitherKingdomCategory(k.id, target.id));
                } else {
                    target.relations[k.id] = Math.max(-100, (target.relations[k.id] || 0) - 10);
                    logEvent(`😤 ${target.name} refuses ${k.name}'s demand for tribute!`,  {
                        type: 'tribute_refused', cause: 'Pride or lack of funds', effects: ['Relations worsen']
                    }, _eventEitherKingdomCategory(k.id, target.id));
                }
            }
        }

        // e. Economic embargo
        if ((p.temperament === 'stern' || p.temperament === 'cruel') && rng.chance(0.03)) {
            const enemies = world.kingdoms.filter(o =>
                o.id !== k.id && (k.relations[o.id] || 0) < -30 && !k.atWar.has(o.id)
            );
            if (enemies.length > 0) {
                const target = rng.pick(enemies);
                if (!hasEmbargo(k.id, target.id)) {
                    declareEmbargo(k, target);
                    logEvent(`🚫 ${k.name} declares an economic embargo against ${target.name}!`,  {
                        type: 'embargo_declared', cause: 'Poor relations and hostile policy', effects: ['Trade banned between kingdoms', 'Smuggling opportunities arise']
                    }, _eventEitherKingdomCategory(k.id, target.id));
                }
            }
        }

        // f. HIRE MERCENARIES FOR DEFENSE (rich kingdoms can buy soldiers, 500g for 20 soldiers, 30 days)
        if (!atWar && k.gold > 2000 && rng.chance(0.08) && (p.courage === 'cautious' || p.courage === 'cowardly' || p.temperament === 'kind')) {
            const mercCost = 500;
            const mercCount = 20;
            k.gold -= mercCost;
            // Add mercenaries to the kingdom's least-defended towns
            const kTowns2 = world.towns.filter(t => k.territories.has(t.id)).sort((a, b) => a.garrison - b.garrison);
            if (kTowns2.length > 0) {
                kTowns2[0].garrison += mercCount;
                kTowns2[0]._mercenaryExpiry = world.day + 30; // mercenaries leave after 30 days
                kTowns2[0]._mercenaryCount = (kTowns2[0]._mercenaryCount || 0) + mercCount;
                logEvent(`🛡️ ${k.name} hires ${mercCount} mercenaries for defense of ${kTowns2[0].name} (-${mercCost}g, 30 days).`,  {
                    type: 'mercenary_hire', cause: 'Preventive defense investment',
                    effects: ['Garrison +' + mercCount + ' in ' + kTowns2[0].name, 'Mercenaries serve for 30 days', 'Treasury -' + mercCost + 'g']
                }, _eventKingdomCategory(k.id));
            }
        }

        // g. PAY TRIBUTE TO AVOID WAR (weaker kingdoms pay 10-20% treasury to stronger neighbors)
        if (!atWar && (p.courage === 'cautious' || p.courage === 'cowardly') && rng.chance(0.05)) {
            const myStr = computeMilitaryStrength(k);
            const threats = world.kingdoms.filter(o =>
                o.id !== k.id && !k.atWar.has(o.id) &&
                (k.relations[o.id] || 0) < -20 &&
                computeMilitaryStrength(o) > myStr * 1.5
            );
            if (threats.length > 0) {
                const threat = rng.pick(threats);
                const tributeRate = rng.randFloat(0.10, 0.20);
                const tributeAmount = Math.floor(k.gold * tributeRate);
                if (tributeAmount > 50 && k.gold > tributeAmount * 2) {
                    k.gold -= tributeAmount;
                    threat.gold += tributeAmount;
                    k.relations[threat.id] = Math.min(100, (k.relations[threat.id] || 0) + 20);
                    threat.relations[k.id] = Math.min(100, (threat.relations[k.id] || 0) + 15);
                    logEvent(`💰 ${k.name} pays ${tributeAmount}g tribute to ${threat.name} to maintain peace.`, {
                        type: 'tribute_paid', cause: 'Fear of military aggression',
                        effects: ['Treasury -' + tributeAmount + 'g', 'Relations improved', 'War less likely']
                    }, 'military');
                }
            }
        }

        // =============================================
        // 10. ECONOMIC ACTIONS
        // =============================================
        // a. Commission construction projects
        if (treasury > 1500 && rng.chance(p.intelligence === 'brilliant' ? 0.25 : 0.08)) {
            const priorities = [];
            const kTowns = world.towns.filter(t => k.territories.has(t.id));
            for (const town of kTowns) {
                const hasType = (type) => town.buildings.some(b => b.type === type);
                // Prioritize buildings based on needs
                if (!hasType('hospital') && k.gold >= 1200) priorities.push({ town, type: 'hospital', cost: 1200 });
                if (!hasType('granary') && k.gold >= 500) priorities.push({ town, type: 'granary', cost: 500 });
                if (!hasType('guild_hall') && k.gold >= 700) priorities.push({ town, type: 'guild_hall', cost: 700 });
                if (!hasType('marketplace_royal') && k.gold >= 600) priorities.push({ town, type: 'marketplace_royal', cost: 600 });
                if (!hasType('courthouse') && k.gold >= 800 && (p.justice === 'just')) priorities.push({ town, type: 'courthouse', cost: 800 });
                if (!hasType('treasury_vault') && k.gold >= 1500 && town.isCapital) priorities.push({ town, type: 'treasury_vault', cost: 1500 });
                if (!hasType('cathedral') && k.gold >= 2000 && town.isCapital) priorities.push({ town, type: 'cathedral', cost: 2000 });
                if (!hasType('university') && k.gold >= 1500 && (p.intelligence === 'brilliant' || p.intelligence === 'clever')) priorities.push({ town, type: 'university', cost: 1500 });
                if (!hasType('training_grounds') && k.gold >= 800 && atWar) priorities.push({ town, type: 'training_grounds', cost: 800 });
                if (!hasType('stables') && k.gold >= 600 && (p.militarism === 'aggressive' || p.militarism === 'warlike')) priorities.push({ town, type: 'stables', cost: 600 });
                if (!hasType('castle') && town.isCapital && k.gold >= 3000) priorities.push({ town, type: 'castle', cost: 3000 });
                // Medical infrastructure — kings build based on need and personality
                var clinicCount = town.buildings.filter(function(b) { return b.type === 'clinic'; }).length;
                var hasHospital = hasType('hospital');
                if (!hasType('clinic') && k.gold >= 500) priorities.push({ town, type: 'clinic', cost: 500 });
                // Proactive kings (kind/cautious) or during war build extra medical
                if (atWar && !hasHospital && k.gold >= 1200) priorities.push({ town, type: 'hospital', cost: 1200 });
                if (atWar && clinicCount < 2 && k.gold >= 500) priorities.push({ town, type: 'clinic', cost: 500 });
                if ((p.temperament === 'kind' || p.courage === 'cautious') && !hasHospital && k.gold >= 1200) priorities.push({ town, type: 'hospital', cost: 1200 });
                if (p.temperament === 'kind' && clinicCount < 2 && k.gold >= 500) priorities.push({ town, type: 'clinic', cost: 500 });
                // Herb gardens and apothecaries for medical supply chain
                if (!hasType('herb_garden') && k.gold >= 150) priorities.push({ town, type: 'herb_garden', cost: 150 });
                if (!hasType('apothecary') && hasType('herb_garden') && k.gold >= 400) priorities.push({ town, type: 'apothecary', cost: 400 });
                if (!hasType('bandage_workshop') && k.gold >= 250) priorities.push({ town, type: 'bandage_workshop', cost: 250 });

                // Supply chain gap: processing buildings missing input sources
                var _inputSourceMap = {
                    wood: 'lumber_camp', iron_ore: 'iron_mine', wool: 'sheep_farm',
                    hide: 'hunting_lodge', hemp: 'hemp_farm', clay: 'clay_pit',
                    herbs: 'herb_garden', wheat: 'wheat_farm', flour: 'flour_mill'
                };
                for (var _sci = 0; _sci < town.buildings.length; _sci++) {
                    var _scBld = town.buildings[_sci];
                    var _scBt = findBuildingType(_scBld.type);
                    if (!_scBt || !_scBt.consumes || !_scBt.produces) continue;
                    for (var _scInput in _scBt.consumes) {
                        if ((town.market.supply[_scInput] || 0) < _scBt.consumes[_scInput] * 5) {
                            var _srcType = _inputSourceMap[_scInput];
                            if (_srcType && !hasType(_srcType)) {
                                var _srcBt = findBuildingType(_srcType);
                                if (_srcBt && k.gold >= _srcBt.cost) {
                                    priorities.push({ town: town, type: _srcType, cost: _srcBt.cost });
                                }
                            }
                        }
                    }
                }
            }
            if (priorities.length > 0) {
                const chosen = rng.pick(priorities);
                const bt = findBuildingType(chosen.type);
                let canBuild = true;
                if (bt && bt.materials) {
                    for (const [matId, qty] of Object.entries(bt.materials)) {
                        if ((chosen.town.market.supply[matId] || 0) < qty) { canBuild = false; break; }
                    }
                    if (canBuild) {
                        for (const [matId, qty] of Object.entries(bt.materials)) {
                            chosen.town.market.supply[matId] -= qty;
                        }
                    }
                }
                if (canBuild && k.gold >= chosen.cost) {
                    // RA consultation for major infrastructure (cost >= 800g)
                    if (chosen.cost >= 800 && isPlayerRoyalAdvisorOf(k)) {
                        var _ipTown = chosen.town;
                        var _ipType = chosen.type;
                        var _ipCost = chosen.cost;
                        var _ipBt = bt;
                        proposeKingDecision(k, {
                            type: 'infrastructure_project',
                            description: 'Build ' + (_ipBt ? _ipBt.name : _ipType) + ' in ' + _ipTown.name,
                            details: 'Cost: ' + _ipCost + 'g. Treasury: ' + Math.floor(k.gold) + 'g. Town population: ' + (_ipTown.population || 0) + '. This would strengthen ' + _ipTown.name + '\'s capabilities.',
                            conviction: Math.min(0.85, 0.4 + (_ipCost >= 2000 ? 0.2 : 0.1) + (p.intelligence === 'brilliant' ? 0.15 : 0)),
                            execute: (function(kRef, townRef, typeId, cost, btRef) { return function() {
                                townRef.buildings.push({ type: typeId, level: 1, ownerId: kRef.id, builtDay: world.day, condition: 'new', lastRepairDay: 0 });
                                kRef.gold -= cost;
                                logEvent('🏗️ ' + kRef.name + ' commissions a new ' + (btRef ? btRef.name : typeId) + ' in ' + townRef.name + '!', {
                                    type: 'construction_project', townId: townRef.id, kingdomId: kRef.id, _noToast: true,
                                    cause: 'Royal investment in infrastructure (approved by Royal Advisor)', effects: ['New building provides benefits', 'Treasury -' + cost + 'g']
                                }, 'local_town');
                            }; })(k, _ipTown, _ipType, _ipCost, _ipBt)
                        });
                    } else {
                        chosen.town.buildings.push({ type: chosen.type, level: 1, ownerId: k.id, builtDay: world.day, condition: 'new', lastRepairDay: 0 });
                        k.gold -= chosen.cost;
                        logEvent(`🏗️ ${k.name} commissions a new ${bt ? bt.name : chosen.type} in ${chosen.town.name}!`, {
                            type: 'construction_project', townId: chosen.town.id, kingdomId: k.id, _noToast: true,
                            cause: 'Royal investment in infrastructure', effects: ['New building provides benefits', 'Treasury -' + chosen.cost + 'g']
                        }, 'local_town');
                    }
                }
            }
        }

        // b. Create stockpile reserves (buy food/weapons when cheap)
        if (treasury > 2000 && rng.chance(0.15)) {
            if (!k.militaryStockpile) k.militaryStockpile = { swords: 0, armor: 0, bows: 0, arrows: 0, horses: 0 };
            const kTowns = world.towns.filter(t => k.territories.has(t.id));
            const essentials = ['bread', 'wheat', 'meat'];
            for (const town of kTowns) {
                for (const food of essentials) {
                    const avail = town.market.supply[food] || 0;
                    const price = town.market.prices[food] || 5;
                    if (avail > 20 && price < 8) {
                        const toBuy = Math.min(10, avail - 10);
                        if (k.gold >= toBuy * price) {
                            town.market.supply[food] -= toBuy;
                            k.gold -= toBuy * price;
                        }
                    }
                }
            }
        }

        // c. Set price controls (intelligent kings only)
        if ((p.intelligence === 'brilliant') && rng.chance(0.05) && happiness < 35) {
            logEvent(`📜 ${k.name}'s wise king sets price controls on essential goods to protect citizens.`,  {
                type: 'price_controls', kingdomId: k.id, cause: 'Protecting citizens from price gouging', effects: ['Essential goods prices capped', 'Merchants may be discouraged']
            }, _eventKingdomCategory(k.id));
            const kTowns = world.towns.filter(t => k.territories.has(t.id));
            for (const town of kTowns) {
                const essentials = ['bread', 'wheat', 'meat', 'fish'];
                for (const food of essentials) {
                    if (town.market.prices[food] > 15) {
                        town.market.prices[food] = Math.max(5, Math.floor(town.market.prices[food] * 0.7));
                    }
                }
            }
            boostKingdomHappiness(k, 3);
        }

        // =============================================
        // 11. SOCIAL/CIVIC ACTIONS
        // =============================================
        // 11. SOCIAL/CIVIC ACTIONS
        // =============================================
        // H-3: Festivals, public works, welfare only when treasury > 12 months upkeep
        var _civicFs = Engine.getKingdomFinancialState(k);
        // C4: Scale festival cost with kingdom wealth (min 300, 1% of treasury)
        var festCostCheck = Math.max(CONFIG.KINGDOM_FESTIVAL_COST || 300, Math.floor(treasury * (CONFIG.FEAST_COST_WEALTH_SCALE || 0.01)));
        var grandFestGate = (p.intelligence === 'foolish' || p.intelligence === 'dim') ? festCostCheck : Math.max(2000, festCostCheck * 5);
        if (p.greed === 'greedy' || p.greed === 'corrupt') grandFestGate = Infinity;
        if (k.gold > grandFestGate && _civicFs.canFestival && rng.chance(0.08)) {
            const festCost = festCostCheck;
            const festHappy = CONFIG.KINGDOM_FESTIVAL_HAPPINESS || 8;
            k.gold -= festCost;
            boostKingdomHappiness(k, festHappy);
            for (const tid of k.territories) { const t = findTown(tid); if (t) t._festivalDay = world.day; }
            logEvent(`🎉 ${k.name} holds a grand festival! The people celebrate. (+${festHappy} happiness, -${festCost}g)`,  {
                type: 'grand_festival', kingdomId: k.id, cause: 'Royal celebration to boost morale', effects: ['Happiness +' + festHappy, 'Treasury -' + festCost + 'g']
            }, _eventKingdomCategory(k.id));
        }

        // b. Issue pardons (just/kind kings)
        if ((p.justice === 'just' || p.temperament === 'kind') && rng.chance(0.05)) {
            boostKingdomHappiness(k, 3);
            logEvent(`⚖️ The king of ${k.name} issues royal pardons. Prisoners are freed. (+3 happiness)`,  {
                type: 'royal_pardon', kingdomId: k.id, cause: 'Act of mercy and justice', effects: ['Happiness +3', 'Some criminals released']
            }, _eventKingdomCategory(k.id));
        }

        // c. Crack down on crime (stern/just kings)
        if ((p.temperament === 'stern' || p.justice === 'just') && rng.chance(0.08) && treasury > 200) {
            k.gold -= 200;
            for (const townId of k.territories) {
                const town = findTown(townId);
                if (town) town.security = Math.min(100, (town.security || 50) + 10);
            }
            logEvent(`🛡️ ${k.name} cracks down on crime! Guards patrol the streets. (-200g, +10 security)`,  {
                type: 'crime_crackdown', kingdomId: k.id, cause: 'Royal order to restore order', effects: ['Security +10 in all towns', 'Treasury -200g']
            }, _eventKingdomCategory(k.id));
        }

        // d. Fund public works (require healthy treasury + H-3 12-month threshold)
        if (k.gold > Math.max(2000, (CONFIG.KINGDOM_PUBLIC_WORKS_COST || 200) * 5) && _civicFs.canFestival && rng.chance(0.06)) {
            const cost = CONFIG.KINGDOM_PUBLIC_WORKS_COST || 200;
            const happyBoost = CONFIG.KINGDOM_PUBLIC_WORKS_HAPPINESS || 3;
            k.gold -= cost;
            boostKingdomHappiness(k, happyBoost);
            for (const townId of k.territories) {
                const town = findTown(townId);
                if (town) town.prosperity = Math.min(100, town.prosperity + 2);
            }
            logEvent(`🏗️ ${k.name} funds public works projects. Roads and buildings are improved.`,  {
                type: 'public_works', kingdomId: k.id, cause: 'Investment in infrastructure', effects: ['Happiness +' + happyBoost, 'Prosperity +2', 'Treasury -' + cost + 'g']
            }, _eventKingdomCategory(k.id));
        }

        // e. Establish welfare (generous/kind kings — require healthy treasury + H-3 threshold)
        if ((p.generosity === 'generous' || p.temperament === 'kind') && k.gold > Math.max(2000, (CONFIG.KINGDOM_WELFARE_COST || 150) * 5) && _civicFs.canFestival && happiness < 40 && rng.chance(0.10)) {
            const cost = CONFIG.KINGDOM_WELFARE_COST || 150;
            const happyBoost = CONFIG.KINGDOM_WELFARE_HAPPINESS || 5;
            k.gold -= cost;
            boostKingdomHappiness(k, happyBoost);
            logEvent(`🤲 ${k.name}'s kind ruler distributes gold to the poorest citizens. (+${happyBoost} happiness)`,  {
                type: 'welfare_distribution', kingdomId: k.id, cause: 'Compassion for the less fortunate', effects: ['Happiness +' + happyBoost, 'Treasury -' + cost + 'g']
            }, _eventKingdomCategory(k.id));
            logKingAction(k, '🤲 Distributed gold to the poor (-' + cost + 'g, +' + happyBoost + ' happiness)');
        }

        // f. C4: Town Improvement Projects (gold sink — improves specific towns)
        if (k.gold > (CONFIG.KINGDOM_TOWN_IMPROVEMENT_COST || 400) * 3 && _civicFs.canFestival && rng.chance(0.04)) {
            var _tiCost = CONFIG.KINGDOM_TOWN_IMPROVEMENT_COST || 400;
            // Find lowest-prosperity town in kingdom
            var _tiTowns = [];
            for (var _tiTid of k.territories) { var _tiT = findTown(_tiTid); if (_tiT) _tiTowns.push(_tiT); }
            _tiTowns.sort(function(a, b) { return (a.prosperity || 50) - (b.prosperity || 50); });
            if (_tiTowns.length > 0 && _tiTowns[0].prosperity < 60) {
                k.gold -= _tiCost;
                _tiTowns[0].prosperity = Math.min(100, (_tiTowns[0].prosperity || 50) + 5);
                _tiTowns[0].happiness = Math.min(100, (_tiTowns[0].happiness || 50) + 3);
                logKingAction(k, '🏘️ Town improvement in ' + (_tiTowns[0].name || 'a town') + ' (-' + _tiCost + 'g, +5 prosperity, +3 happiness)');
                logEvent('🏘️ ' + k.name + ' invests in improving ' + (_tiTowns[0].name || 'a town') + '! Roads paved, wells dug, buildings repaired.',  {
                    type: 'town_improvement', kingdomId: k.id, townId: _tiTowns[0].id,
                    effects: ['Prosperity +5', 'Happiness +3', 'Treasury -' + _tiCost + 'g']
                }, _eventKingdomCategory(k.id));
            }
        }

        // g. C4: Grand Kingdom Projects (major gold sink — cathedral, grand market, great wall)
        var _gpCost = CONFIG.KINGDOM_GRAND_PROJECT_COST || 2000;
        var _gpDuration = CONFIG.KINGDOM_GRAND_PROJECT_DURATION || 90;
        if (!k._grandProject && k.gold > _gpCost * 3 && _civicFs.canFestival && rng.chance(0.02)) {
            var _gpTypes = [
                { name: 'Grand Cathedral', icon: '⛪', happyBoost: 8, prospBoost: 5, desc: 'A magnificent cathedral rises' },
                { name: 'Great Market Hall', icon: '🏛️', happyBoost: 5, prospBoost: 10, desc: 'A sprawling market hall is constructed' },
                { name: 'Royal Academy', icon: '📚', happyBoost: 4, prospBoost: 8, desc: 'A royal academy of learning is founded' },
                { name: 'Grand Fortification', icon: '🏰', happyBoost: 3, prospBoost: 3, desc: 'Massive walls and towers are erected' },
                { name: 'Monument to the Crown', icon: '🗿', happyBoost: 6, prospBoost: 2, desc: 'A grand monument commemorates the kingdom' }
            ];
            var _gpChoice = rng.pick(_gpTypes);
            var _gpCapital = null;
            for (var _gptId of k.territories) { var _gpt = findTown(_gptId); if (_gpt && _gpt.isCapital) { _gpCapital = _gpt; break; } }
            if (!_gpCapital) { for (var _gpt2Id of k.territories) { _gpCapital = findTown(_gpt2Id); break; } }
            if (_gpCapital) {
                k.gold -= _gpCost;
                k._grandProject = {
                    type: _gpChoice.name,
                    icon: _gpChoice.icon,
                    townId: _gpCapital.id,
                    startDay: world.day,
                    completeDay: world.day + _gpDuration,
                    happyBoost: _gpChoice.happyBoost,
                    prospBoost: _gpChoice.prospBoost
                };
                logKingAction(k, _gpChoice.icon + ' Began ' + _gpChoice.name + ' in ' + _gpCapital.name + ' (-' + _gpCost + 'g, ' + _gpDuration + ' days)');
                logEvent(_gpChoice.icon + ' ' + k.name + ' begins construction of a ' + _gpChoice.name + ' in ' + _gpCapital.name + '! (' + _gpDuration + ' days, ' + _gpCost + 'g)',  {
                    type: 'grand_project_start', kingdomId: k.id, townId: _gpCapital.id,
                    effects: ['Treasury -' + _gpCost + 'g', 'Completes in ' + _gpDuration + ' days', 'Will boost prosperity and happiness']
                }, _eventKingdomCategory(k.id));
            }
        }
        // Check for grand project completion
        if (k._grandProject && world.day >= k._grandProject.completeDay) {
            var _gpTown = findTown(k._grandProject.townId);
            if (_gpTown) {
                _gpTown.prosperity = Math.min(100, (_gpTown.prosperity || 50) + k._grandProject.prospBoost);
                boostKingdomHappiness(k, k._grandProject.happyBoost);
            }
            logEvent(k._grandProject.icon + ' The ' + k._grandProject.type + ' in ' + (_gpTown ? _gpTown.name : 'the capital') + ' is complete! ' + k.name + ' celebrates!',  {
                type: 'grand_project_complete', kingdomId: k.id,
                effects: ['Happiness +' + k._grandProject.happyBoost, 'Prosperity +' + k._grandProject.prospBoost, k._grandProject.type + ' stands as a symbol of the kingdom']
            }, _eventKingdomCategory(k.id));
            logKingAction(k, k._grandProject.icon + ' ' + k._grandProject.type + ' completed! (+' + k._grandProject.happyBoost + ' happiness, +' + k._grandProject.prospBoost + ' prosperity)');
            k._grandProject = null;
        }

        // =============================================
        // 11b. C1: MAJOR HAPPINESS-BOOSTING ACTIONS (90-day cooldown)
        // =============================================
        var happyBoostCooldown = CONFIG.KING_HAPPINESS_BOOST_COOLDOWN || 90;
        var canMajorHappyBoost = !k._lastHappinessBoostDay || (world.day - k._lastHappinessBoostDay) >= happyBoostCooldown;
        if (canMajorHappyBoost && happiness < 45) {
            var boostActionTaken = false;

            // Priority order depends on king personality and treasury
            // Games & Tournament: ambitious/brave kings, costs 1000g
            if (!boostActionTaken && (p.ambition === 'ambitious' || p.courage === 'brave') &&
                treasury > (CONFIG.KING_GAMES_TOURNAMENT_COST || 1000) * 2 && rng.chance(0.20)) {
                var gameCost = CONFIG.KING_GAMES_TOURNAMENT_COST || 1000;
                var gameHappy = CONFIG.KING_GAMES_TOURNAMENT_HAPPINESS || 18;
                k.gold -= gameCost;
                boostKingdomHappiness(k, gameHappy);
                k._lastHappinessBoostDay = world.day;
                boostActionTaken = true;
                logKingAction(k, '🏟️ Hosted a grand tournament (-' + gameCost + 'g, +' + gameHappy + ' happiness)');
                logEvent('🏟️ ' + k.name + ' hosts a grand tournament! Knights joust and the people cheer. (+' + gameHappy + ' happiness)',  {
                    type: 'games_tournament', kingdomId: k.id, cause: 'A spectacular display of martial prowess',
                    effects: ['Happiness +' + gameHappy, 'Treasury -' + gameCost + 'g', '90-day cooldown']
                }, _eventKingdomCategory(k.id));
            }

            // Grand Feast: generous/kind kings, costs 800g
            if (!boostActionTaken && (p.generosity === 'generous' || p.temperament === 'kind') &&
                treasury > (CONFIG.KING_GRAND_FEAST_COST || 800) * 2 && rng.chance(0.25)) {
                var feastCost = CONFIG.KING_GRAND_FEAST_COST || 800;
                var feastHappy = CONFIG.KING_GRAND_FEAST_HAPPINESS || 15;
                k.gold -= feastCost;
                boostKingdomHappiness(k, feastHappy);
                for (var _fti = 0; _fti < k.territories.size; _fti++) {
                    var _ftId = Array.from(k.territories)[_fti];
                    var _ft = findTown(_ftId);
                    if (_ft) _ft._festivalDay = world.day;
                }
                k._lastHappinessBoostDay = world.day;
                boostActionTaken = true;
                logKingAction(k, '🍖 Grand feast for the people (-' + feastCost + 'g, +' + feastHappy + ' happiness)');
                logEvent('🍖 ' + k.name + ' throws a grand feast for the common folk! Food and drink flow freely. (+' + feastHappy + ' happiness)',  {
                    type: 'grand_feast_people', kingdomId: k.id, cause: 'Generosity and concern for the people',
                    effects: ['Happiness +' + feastHappy, 'Treasury -' + feastCost + 'g', '90-day cooldown']
                }, _eventKingdomCategory(k.id));
            }

            // Tax Rebate: clever/brilliant kings, costs vary by pop
            if (!boostActionTaken && (p.intelligence === 'brilliant' || p.intelligence === 'clever')) {
                var totalPop = 0;
                for (var _trI = 0; _trI < (k.territories ? k.territories.size : 0); _trI++) {
                    var _trId = Array.from(k.territories)[_trI];
                    var _trT = findTown(_trId);
                    if (_trT) totalPop += (typeof _trT.population === 'number' ? _trT.population : 0);
                }
                var rebateCost = totalPop * (CONFIG.KING_TAX_REBATE_COST_PER_POP || 3);
                var rebateHappy = CONFIG.KING_TAX_REBATE_HAPPINESS || 12;
                if (rebateCost > 100 && treasury > rebateCost * 2 && rng.chance(0.15)) {
                    k.gold -= rebateCost;
                    boostKingdomHappiness(k, rebateHappy);
                    k._lastHappinessBoostDay = world.day;
                    boostActionTaken = true;
                    logKingAction(k, '💰 Tax rebate for citizens (-' + Math.floor(rebateCost) + 'g, +' + rebateHappy + ' happiness)');
                    logEvent('💰 ' + k.name + ' issues a tax rebate to all citizens! Gold flows back to the people. (+' + rebateHappy + ' happiness)',  {
                        type: 'tax_rebate', kingdomId: k.id, cause: 'Strategic tax relief to boost morale',
                        effects: ['Happiness +' + rebateHappy, 'Treasury -' + Math.floor(rebateCost) + 'g', '90-day cooldown']
                    }, _eventKingdomCategory(k.id));
                }
            }

            // Debt Forgiveness: just/kind kings, costs 500g
            if (!boostActionTaken && (p.justice === 'just' || p.temperament === 'kind') &&
                treasury > (CONFIG.KING_DEBT_FORGIVENESS_COST || 500) * 2 && rng.chance(0.20)) {
                var debtCost = CONFIG.KING_DEBT_FORGIVENESS_COST || 500;
                var debtHappy = CONFIG.KING_DEBT_FORGIVENESS_HAPPINESS || 10;
                k.gold -= debtCost;
                boostKingdomHappiness(k, debtHappy);
                k._lastHappinessBoostDay = world.day;
                boostActionTaken = true;
                logKingAction(k, '📜 Forgave debts of poorest citizens (-' + debtCost + 'g, +' + debtHappy + ' happiness)');
                logEvent('📜 ' + k.name + ' forgives the debts of its poorest citizens! Relief spreads through the land. (+' + debtHappy + ' happiness)',  {
                    type: 'debt_forgiveness', kingdomId: k.id, cause: 'Act of royal mercy',
                    effects: ['Happiness +' + debtHappy, 'Treasury -' + debtCost + 'g', '90-day cooldown']
                }, _eventKingdomCategory(k.id));
            }

            // Fallback: any king with enough gold can do basic happiness action
            if (!boostActionTaken && happiness < 30 && treasury > 600 && rng.chance(0.15)) {
                var basicCost = 400;
                var basicHappy = 8;
                k.gold -= basicCost;
                boostKingdomHappiness(k, basicHappy);
                k._lastHappinessBoostDay = world.day;
                logKingAction(k, '🎪 Public entertainments and food distribution (-' + basicCost + 'g, +' + basicHappy + ' happiness)');
                logEvent('🎪 ' + k.name + ' organizes public entertainments and food distribution. (+' + basicHappy + ' happiness)',  {
                    type: 'public_entertainment', kingdomId: k.id, cause: 'Desperate attempt to lift morale',
                    effects: ['Happiness +' + basicHappy, 'Treasury -' + basicCost + 'g', '90-day cooldown']
                }, _eventKingdomCategory(k.id));
            }
        }

        // 12. UPDATE ROYAL ADVISORS periodically
        if (world.day % CONFIG.ROYAL_ADVISOR_UPDATE_INTERVAL === 0) {
            Engine.updateRoyalAdvisors(k.id);
        }

        // =============================================
        // 13. NEW LAW AI — Kings enact/repeal new laws based on mood and personality
        // =============================================
        if (!k.laws) k.laws = {};
        if (!k.laws.specialLaws) k.laws.specialLaws = [];
        var moodCurrent = k.kingMood ? k.kingMood.current : 'content';

        // Noble Council — just/diplomatic kings may adopt when happiness is low
        if (!hasSpecialLaw(k, 'noble_council') &&
            (p.justice === 'just' || p.diplomacy === 'diplomatic') &&
            happiness < 40 && rng.chance(0.30)) {
            k.laws.specialLaws.push({ id: 'noble_council', name: 'Noble Council', desc: 'Major decisions require a vote of the nobility.', icon: '🗳️', effect: 'noble_council' });
            if (!k._activeVotes) k._activeVotes = [];
            boostKingdomHappiness(k, 10);
            // Noble council immediate loyalty boost on enactment
            var _ncEnactNobles = Engine.getNoblesInKingdom(k.id);
            for (var _ncei = 0; _ncei < _ncEnactNobles.length; _ncei++) {
                var _nceN = _ncEnactNobles[_ncei];
                _nceN.kingLoyalty = Math.min(100, (_nceN.kingLoyalty || 50) + 5);
                _nceN.fearOfKing = Math.max(0, (_nceN.fearOfKing || 15) - 3);
                _nceN.perceivedKingLoyalty = Math.min(100, (_nceN.perceivedKingLoyalty || _nceN.kingLoyalty || 50) + 3);
            }
            logKingAction(k, '🗳️ Established a Noble Council');
            logEvent('🗳️ ' + k.name + ' establishes a Noble Council! Major decisions now require noble approval. (+10 happiness)',  {
                type: 'law_change', kingdomId: k.id,
                cause: 'The ruler seeks to share power and stabilize the realm.',
                effects: ['Major decisions (war, peace, alliances, bans) now voted on', 'Kingdom happiness +10', 'Nobles gain political influence', 'Noble loyalty +5, fear -3']
            }, _eventKingdomCategory(k.id));
        }
        // Noble Council repeal — ambitious/greedy kings may repeal when stability returns
        if (hasSpecialLaw(k, 'noble_council') &&
            (p.ambition === 'ambitious' || p.greed === 'greedy' || p.greed === 'corrupt') &&
            happiness > 60 && rng.chance(0.05)) {
            k.laws.specialLaws = k.laws.specialLaws.filter(function(l) { return l.id !== 'noble_council'; });
            // Double-negative: -10 loyalty, -6 king relationship, +6 fear
            var _ncRepealNobles = Engine.getNoblesInKingdom(k.id);
            for (var _ncri = 0; _ncri < _ncRepealNobles.length; _ncri++) {
                var _ncrN = _ncRepealNobles[_ncri];
                _ncrN.kingLoyalty = Math.max(0, (_ncrN.kingLoyalty || 50) - 10);
                _ncrN.fearOfKing = Math.min(100, (_ncrN.fearOfKing || 15) + 6);
                _ncrN.perceivedKingLoyalty = Math.max(0, (_ncrN.perceivedKingLoyalty || _ncrN.kingLoyalty || 50) - 6);
            }
            boostKingdomHappiness(k, -10);
            logKingAction(k, '🗳️ Dissolved the Noble Council — power returns to the crown');
            logEvent('🗳️ ' + k.name + ' dissolves the Noble Council! The king seizes back all decision-making power. (-10 happiness, nobles furious)',  {
                type: 'law_change', kingdomId: k.id,
                cause: 'The king consolidates power by disbanding the council.',
                effects: ['Noble Council dissolved', 'Happiness -10', 'Noble loyalty -10, fear +6', 'Nobles lose political voice']
            }, _eventKingdomCategory(k.id));
        }

        // a. Price Controls — brilliant kings enact during crises, repeal when stable
        if (!hasSpecialLaw(k, 'price_controls') && (p.intelligence === 'brilliant' || p.intelligence === 'clever')
            && happiness < 30 && rng.chance(0.15 * (mood.conscriptMod || 1))) {
            k.laws.specialLaws.push({ id: 'price_controls', name: 'Price Controls', desc: 'Maximum prices on essential goods.', icon: '📊' });
            logKingAction(k, '📊 Enacted Price Controls to protect citizens');
            logEvent('📊 ' + k.name + ' enacts price controls on essential goods!',  { type: 'law_change', kingdomId: k.id }, _eventKingdomCategory(k.id));
        } else if (hasSpecialLaw(k, 'price_controls') && happiness > 60 && rng.chance(0.1)) {
            k.laws.specialLaws = k.laws.specialLaws.filter(function(l) { return l.id !== 'price_controls'; });
            logKingAction(k, '📊 Repealed Price Controls — economy is stable');
            logEvent('📊 ' + k.name + ' lifts price controls as prosperity returns.',  { type: 'law_change', kingdomId: k.id }, _eventKingdomCategory(k.id));
        }

        // b. Immigration Policy — traditionalist/paranoid kings close borders
        if (!hasSpecialLaw(k, 'immigration_policy') && (p.tradition === 'traditional' || moodCurrent === 'paranoid')
            && rng.chance(0.08)) {
            k.laws.specialLaws.push({ id: 'immigration_policy', name: 'Closed Borders', desc: 'Foreigners need citizenship to settle.', icon: '🚧' });
            k.immigrationPolicy = 'closed';
            logKingAction(k, '🚧 Closed borders to foreigners');
            logEvent('🚧 ' + k.name + ' closes its borders! Foreigners must earn citizenship.',  { type: 'law_change', kingdomId: k.id }, _eventKingdomCategory(k.id));
        } else if (hasSpecialLaw(k, 'immigration_policy') && (p.tradition === 'progressive' || moodCurrent === 'jubilant')
            && rng.chance(0.1)) {
            k.laws.specialLaws = k.laws.specialLaws.filter(function(l) { return l.id !== 'immigration_policy'; });
            k.immigrationPolicy = 'open';
            logKingAction(k, '🚧 Opened borders to foreigners');
            logEvent('🚧 ' + k.name + ' opens its borders! All are welcome.',  { type: 'law_change', kingdomId: k.id }, _eventKingdomCategory(k.id));
        }

        // c. Inheritance Tax — greedy/corrupt kings impose, generous repeal
        if (!hasSpecialLaw(k, 'inheritance_tax') && (p.greed === 'greedy' || p.greed === 'corrupt')
            && rng.chance(0.06)) {
            var taxRate = p.greed === 'corrupt'
                ? rng.randFloat(CONFIG.INHERITANCE_TAX.minRate + 0.05, CONFIG.INHERITANCE_TAX.maxRate)
                : rng.randFloat(CONFIG.INHERITANCE_TAX.minRate, CONFIG.INHERITANCE_TAX.maxRate - 0.05);
            k.laws.specialLaws.push({
                id: 'inheritance_tax', name: 'Inheritance Tax', desc: Math.round(taxRate * 100) + '% tax on inherited wealth.',
                icon: '💀', rate: taxRate
            });
            logKingAction(k, '💀 Imposed ' + Math.round(taxRate * 100) + '% inheritance tax');
            logEvent('💀 ' + k.name + ' enacts inheritance tax: ' + Math.round(taxRate * 100) + '% of inherited wealth goes to the crown!',  { type: 'law_change', kingdomId: k.id }, _eventKingdomCategory(k.id));
        } else if (hasSpecialLaw(k, 'inheritance_tax') && p.greed === 'generous' && rng.chance(0.12)) {
            k.laws.specialLaws = k.laws.specialLaws.filter(function(l) { return l.id !== 'inheritance_tax'; });
            logKingAction(k, '💀 Repealed inheritance tax');
            logEvent('💀 ' + k.name + ' abolishes the inheritance tax!',  { type: 'law_change', kingdomId: k.id }, _eventKingdomCategory(k.id));
        }

        // d. Draft Animal Law — traditionalist kings restrict horse ownership
        if (!hasSpecialLaw(k, 'draft_animal_law') && p.tradition === 'traditional'
            && (p.greed === 'greedy' || p.greed === 'corrupt') && rng.chance(0.05)) {
            k.laws.specialLaws.push({ id: 'draft_animal_law', name: 'Draft Animal Permits', desc: 'Commoners need permits for horses.', icon: '🐴' });
            logKingAction(k, '🐴 Restricted horse ownership — permits required');
            logEvent('🐴 ' + k.name + ' now requires permits for horse ownership by commoners!',  { type: 'law_change', kingdomId: k.id }, _eventKingdomCategory(k.id));
        } else if (hasSpecialLaw(k, 'draft_animal_law') && (p.tradition === 'progressive' || p.greed === 'generous')
            && rng.chance(0.1)) {
            k.laws.specialLaws = k.laws.specialLaws.filter(function(l) { return l.id !== 'draft_animal_law'; });
            logKingAction(k, '🐴 Lifted horse ownership restrictions');
            logEvent('🐴 ' + k.name + ' lifts restrictions on horse ownership!',  { type: 'law_change', kingdomId: k.id }, _eventKingdomCategory(k.id));
        }

        // e. Female Succession — progressive kings may allow, traditional may block
        if (!hasSpecialLaw(k, 'female_heir_law') && p.tradition === 'progressive'
            && rng.chance(0.03)) {
            k.laws.specialLaws.push({ id: 'female_heir_law', name: 'Female Succession', desc: 'Women may inherit the throne.', icon: '👑' });
            logKingAction(k, '👑 Enacted female succession law');
            logEvent('👑 ' + k.name + ' now allows women to inherit the throne!',  { type: 'law_change', kingdomId: k.id }, _eventKingdomCategory(k.id));
        }

        // f. Exclusive Citizenship — paranoid/traditional kings may forbid dual citizenship
        if (!hasSpecialLaw(k, 'no_dual_citizenship') && (p.tradition === 'traditional' || moodCurrent === 'paranoid')
            && rng.chance(0.04)) {
            k.laws.specialLaws.push({ id: 'no_dual_citizenship', name: 'Exclusive Citizenship', desc: 'Citizens may not hold citizenship in other kingdoms.', icon: '🛡️' });
            logKingAction(k, '🛡️ Enacted exclusive citizenship law');
            logEvent('🛡️ ' + k.name + ' now forbids dual citizenship!',  { type: 'law_change', kingdomId: k.id }, _eventKingdomCategory(k.id));
        } else if (hasSpecialLaw(k, 'no_dual_citizenship') && (p.tradition === 'progressive' || moodCurrent === 'jubilant')
            && rng.chance(0.08)) {
            k.laws.specialLaws = k.laws.specialLaws.filter(function(l) { return l.id !== 'no_dual_citizenship'; });
            logKingAction(k, '🛡️ Repealed exclusive citizenship law');
            logEvent('🛡️ ' + k.name + ' now allows dual citizenship!',  { type: 'law_change', kingdomId: k.id }, _eventKingdomCategory(k.id));
        }

        // g. No Tent Camps — cruel/greedy kings ban tent camps, considering disease vs compassion
        if (!hasSpecialLaw(k, 'no_tent_camps') && !hasSpecialLaw(k, 'right_to_camps')) {
            var wantsBan = false;
            if (p.temperament === 'cruel' && rng.chance(0.06)) wantsBan = true;
            else if (p.greed === 'corrupt' && rng.chance(0.04)) wantsBan = true;
            else if ((p.intelligence === 'brilliant' || p.intelligence === 'clever') && p.temperament !== 'kind') {
                // Smart kings ban if disease is a real problem from tent camps
                var diseaseFromCamps = 0;
                for (var _tcti of k.territories) {
                    var _tct = findTown(_tcti);
                    if (_tct) diseaseFromCamps += getTentCampDiseaseMod(_tct);
                }
                if (diseaseFromCamps > 0.02 && rng.chance(0.08)) wantsBan = true;
            }
            if (wantsBan) {
                k.laws.specialLaws.push({ id: 'no_tent_camps', name: 'No Tent Camps', desc: 'Tent camps are forbidden.', icon: '🚫' });
                logKingAction(k, '🚫 Banned tent camps across the kingdom');
                logEvent('🚫 ' + k.name + ' bans all tent camps! Soldiers will demolish existing camps.',  { type: 'law_change', kingdomId: k.id }, _eventKingdomCategory(k.id));
            }
        } else if (hasSpecialLaw(k, 'no_tent_camps') && (p.temperament === 'kind' || p.greed === 'generous') && rng.chance(0.10)) {
            k.laws.specialLaws = k.laws.specialLaws.filter(function(l) { return l.id !== 'no_tent_camps'; });
            logKingAction(k, '🚫 Lifted tent camp ban');
            logEvent('⛺ ' + k.name + ' lifts the ban on tent camps. The homeless may shelter again.',  { type: 'law_change', kingdomId: k.id }, _eventKingdomCategory(k.id));
        }

        // h. Right to Camps — kind/generous kings allow citizens to self-build tent camps
        if (!hasSpecialLaw(k, 'right_to_camps') && !hasSpecialLaw(k, 'no_tent_camps')) {
            var wantsRight = false;
            if (p.temperament === 'kind' && p.greed === 'generous' && rng.chance(0.08)) wantsRight = true;
            else if (p.temperament === 'kind' && rng.chance(0.04)) wantsRight = true;
            else if (p.tradition === 'progressive' && happiness < 40 && rng.chance(0.06)) wantsRight = true;
            if (wantsRight) {
                k.laws.specialLaws.push({ id: 'right_to_camps', name: 'Right to Camps', desc: 'Homeless citizens may build tent camps.', icon: '⛺' });
                logKingAction(k, '⛺ Granted Right to Camps for the homeless');
                logEvent('⛺ ' + k.name + ' grants the Right to Camps! Homeless citizens may build tent camps.',  { type: 'law_change', kingdomId: k.id }, _eventKingdomCategory(k.id));
            }
        } else if (hasSpecialLaw(k, 'right_to_camps') && (p.temperament === 'cruel' || p.greed === 'corrupt') && rng.chance(0.08)) {
            k.laws.specialLaws = k.laws.specialLaws.filter(function(l) { return l.id !== 'right_to_camps'; });
            logKingAction(k, '⛺ Revoked Right to Camps');
            logEvent('🚫 ' + k.name + ' revokes the Right to Camps. Only the king may authorize shelter.',  { type: 'law_change', kingdomId: k.id }, _eventKingdomCategory(k.id));
        }

        // =============================================
        // 13b. C3: UNPOPULAR KING DECISIONS (NPC kings make decisions that drain loyalty but serve a purpose)
        // =============================================
        if (world.day % 30 === 0 && !_isPlayerKingOf(k)) {
            // Greedy/corrupt kings raise taxes to fill treasury (drains loyalty but enriches kingdom)
            if ((p.greed === 'greedy' || p.greed === 'corrupt') && (k.taxRate || 0.10) < 0.20 && rng.chance(0.08)) {
                var oldTax = k.taxRate || 0.10;
                k.taxRate = Math.min(0.25, oldTax + 0.05);
                logKingAction(k, '💰 Raised taxes to ' + Math.round(k.taxRate * 100) + '% (greed)');
                logEvent('💰 The king of ' + k.name + ' raises taxes! Citizens grumble. (+' + Math.round((k.taxRate - oldTax) * 100) + '% tax)',  {
                    type: 'unpopular_decision', kingdomId: k.id,
                    cause: 'The king demands more gold from the people',
                    effects: ['Tax rate increased to ' + Math.round(k.taxRate * 100) + '%', 'Noble loyalty will suffer', 'Treasury income increases']
                }, _eventKingdomCategory(k.id));
            }

            // Ambitious kings seize noble estates (enriches crown but enrages nobles)
            if (p.ambition === 'ambitious' && treasury < 2000 && rng.chance(0.04)) {
                var _seizeNobles = Engine.getNoblesInKingdom(k.id).filter(function(np) {
                    return np.socialRank[k.id] <= 5 && (np.gold || 0) > 200;
                });
                if (_seizeNobles.length > 0) {
                    var _seizeTarget = rng.pick(_seizeNobles);
                    var _seizeAmt = Math.floor((_seizeTarget.gold || 0) * 0.3);
                    _seizeTarget.gold -= _seizeAmt;
                    k.gold += _seizeAmt;
                    _seizeTarget.kingLoyalty = Math.max(0, (_seizeTarget.kingLoyalty || 50) - 25);
                    logKingAction(k, '👑 Seized ' + _seizeAmt + 'g from ' + (_seizeTarget.firstName || 'a noble') + '\'s estate');
                    logEvent('👑 ' + k.name + '\'s king seizes wealth from ' + (_seizeTarget.firstName || 'a noble') + '\'s estate! (-' + _seizeAmt + 'g from noble, -25 loyalty)',  {
                        type: 'unpopular_decision', kingdomId: k.id,
                        cause: 'The king needs gold and takes it from the nobility',
                        effects: ['Treasury +' + _seizeAmt + 'g', 'Noble loyalty -25', 'Other nobles grow wary']
                    }, _eventKingdomCategory(k.id));
                    // Other nobles become wary
                    var _snNobles = Engine.getNoblesInKingdom(k.id).filter(function(np) {
                        return np.id !== _seizeTarget.id;
                    });
                    for (var _sni = 0; _sni < _snNobles.length; _sni++) {
                        _snNobles[_sni].kingLoyalty = Math.max(0, (_snNobles[_sni].kingLoyalty || 50) - 5);
                    }
                }
            }

            // Paranoid kings purge court members (removes threats but creates enemies)
            if (moodCurrent === 'paranoid' && rng.chance(0.06)) {
                var _purgeTargets = Engine.getNoblesInKingdom(k.id).filter(function(np) {
                    return np.socialRank[k.id] <= 5 && (np.perceivedKingLoyalty || 50) < 40;
                });
                if (_purgeTargets.length > 0) {
                    var _purgeTarget = rng.pick(_purgeTargets);
                    _purgeTarget.socialRank[k.id] = 3; // demoted to commoner
                    _purgeTarget.kingLoyalty = Math.max(0, (_purgeTarget.kingLoyalty || 50) - 30);
                    k.assassinationRisk = Math.max(0, (k.assassinationRisk || 0) - 10);
                    logKingAction(k, '😡 Stripped ' + (_purgeTarget.firstName || 'a noble') + ' of their title (paranoia)');
                    logEvent('😡 ' + k.name + '\'s king strips ' + (_purgeTarget.firstName || 'a noble') + ' of their noble title!',  {
                        type: 'unpopular_decision', kingdomId: k.id,
                        cause: 'The paranoid king suspects treachery',
                        effects: ['Noble stripped of rank', 'Assassination risk reduced', 'Other nobles fear the king more']
                    }, _eventKingdomCategory(k.id));
                    // Other nobles fear increases
                    var _pnNobles = Engine.getNoblesInKingdom(k.id).filter(function(np) {
                        return np.id !== _purgeTarget.id;
                    });
                    for (var _pni = 0; _pni < _pnNobles.length; _pni++) {
                        _pnNobles[_pni].fearOfKing = Math.min(100, (_pnNobles[_pni].fearOfKing || 15) + 10);
                    }
                }
            }

            // Wartime conscription (fills army but angers citizens and nobles)
            if (k.atWar && k.atWar.size > 0 && (k.soldiers || 0) < 20 && rng.chance(0.10)) {
                var _conscripts = 0;
                for (var _ctId of k.territories) {
                    var _ct = findTown(_ctId);
                    if (!_ct) continue;
                    var _ctPeople = getPeopleInTown(_ct.id);
                    var _ctEligible = _ctPeople.filter(function(cp) {
                        return cp.alive && cp.age >= 16 && cp.age <= 45 && cp.sex === 'M' &&
                               cp.occupation !== 'soldier' && cp.occupation !== 'guard';
                    });
                    var _ctCount = Math.min(3, _ctEligible.length);
                    for (var _cci = 0; _cci < _ctCount; _cci++) {
                        var _conscript = _ctEligible[_cci];
                        _conscript.occupation = 'soldier';
                        _conscript._conscripted = true;
                        _conscripts++;
                    }
                }
                if (_conscripts > 0) {
                    boostKingdomHappiness(k, -5);
                    k._lastConscriptionDay = world.day; // H1: Track for noble fear
                    logKingAction(k, '⚔️ Conscripted ' + _conscripts + ' citizens into the army');
                    logEvent('⚔️ ' + k.name + ' conscripts ' + _conscripts + ' citizens! Families weep as men are marched to war. (-5 happiness)',  {
                        type: 'unpopular_decision', kingdomId: k.id,
                        cause: 'Wartime desperation requires more soldiers',
                        effects: ['Army +' + _conscripts + ' soldiers', 'Happiness -5', 'Noble loyalty may suffer']
                    }, _eventKingdomCategory(k.id));
                }
            }
        }

        // =============================================
        // 13c. NOBLE COUNCIL VOTING LAW LOYALTY EFFECTS
        // =============================================
        if (world.day % 30 === 0 && hasSpecialLaw(k, 'noble_council')) {
            // +5 loyalty, +3 king relationship, -3 fear per 30 days for all nobles
            var _ncNobles = Engine.getNoblesInKingdom(k.id);
            for (var _nci = 0; _nci < _ncNobles.length; _nci++) {
                var _ncN = _ncNobles[_nci];
                _ncN.kingLoyalty = Math.min(100, (_ncN.kingLoyalty || 50) + 5);
                _ncN.fearOfKing = Math.max(0, (_ncN.fearOfKing || 15) - 3);
                // +3 king relationship: boost perceived loyalty as proxy
                _ncN.perceivedKingLoyalty = Math.min(100, (_ncN.perceivedKingLoyalty || _ncN.kingLoyalty || 50) + 3);
            }
        }

        // =============================================
        // 13d. H1: NOBLE FEAR ACTIVATION — King periodically punishes nobles, fear effects
        // =============================================
        if (world.day % 15 === 0 && !_isPlayerKingOf(k)) {
            var _h1Nobles = Engine.getNoblesInKingdom(k.id);
            if (_h1Nobles.length > 0) {
                var _h1Pers = k.kingPersonality || {};
                var _h1Mood = (k.kingMood && k.kingMood.current) || 'content';

                // Harsh/stern/paranoid kings punish nobles periodically
                var _h1PunishChance = 0.02; // base 2%
                if (_h1Pers.temperament === 'stern' || _h1Pers.temperament === 'cruel') _h1PunishChance += 0.08;
                if (_h1Pers.justice === 'draconian' || _h1Pers.justice === 'harsh') _h1PunishChance += 0.06;
                if (_h1Mood === 'paranoid') _h1PunishChance += 0.10;
                if (_h1Mood === 'wrathful') _h1PunishChance += 0.12;
                // Generous/kind kings almost never punish randomly
                if (_h1Pers.temperament === 'kind' || _h1Pers.generosity === 'generous') _h1PunishChance *= 0.3;

                if (rng.chance(_h1PunishChance)) {
                    // Pick a target: prefer nobles with low perceived loyalty
                    var _h1Targets = _h1Nobles.filter(function(n) { return (n.perceivedKingLoyalty || n.kingLoyalty || 50) < 50; });
                    if (_h1Targets.length === 0) _h1Targets = _h1Nobles; // harsh kings punish randomly
                    var _h1Target = rng.pick(_h1Targets);
                    var _h1TargetName = (_h1Target.firstName || 'a noble') + ' ' + (_h1Target.lastName || '');

                    // Severity: fine (common), imprisonment (moderate), execution (rare but devastating)
                    var _h1SeverityRoll = rng.random();
                    var _h1ExecThresh = (_h1Pers.temperament === 'cruel') ? 0.12 : ((_h1Pers.justice === 'draconian') ? 0.08 : 0.03);
                    var _h1JailThresh = _h1ExecThresh + ((_h1Pers.temperament === 'stern') ? 0.30 : 0.20);

                    if (_h1SeverityRoll < _h1ExecThresh) {
                        // EXECUTION — maximum fear spike
                        killPerson(_h1Target, 'executed_by_king');
                        logKingAction(k, '💀 Executed ' + _h1TargetName + ' for suspected disloyalty');
                        logEvent('💀 ' + k.name + '\'s king EXECUTES noble ' + _h1TargetName + '! The court trembles.',  {
                            type: 'noble_execution', kingdomId: k.id,
                            cause: 'The king suspects treachery',
                            effects: ['Noble killed', 'All nobles fear increases dramatically', 'Some may become more loyal, others may plot revenge']
                        }, _eventKingdomCategory(k.id));
                        // Massive fear spike for ALL nobles
                        for (var _h1fi = 0; _h1fi < _h1Nobles.length; _h1fi++) {
                            var _h1n = _h1Nobles[_h1fi];
                            if (_h1n.id === _h1Target.id) continue;
                            var _h1FearBoost = 25 + rng.randInt(0, 15);
                            _h1n.fearOfKing = Math.min(100, (_h1n.fearOfKing || 15) + _h1FearBoost);
                            // Fear personality effects on loyalty
                            var _h1np = _h1n.personality || {};
                            if ((_h1np.courage === 'cowardly' || (_h1np.ambition || 50) < 30) && (_h1n.kingLoyalty || 50) < 60) {
                                // Cowardly/unambitious nobles become more "loyal" (submissive) from fear
                                _h1n.kingLoyalty = Math.min(100, (_h1n.kingLoyalty || 50) + 8);
                                _h1n.perceivedKingLoyalty = Math.min(100, (_h1n.perceivedKingLoyalty || 50) + 15);
                            } else if (_h1np.courage === 'brave' || (_h1np.ambition || 50) > 70) {
                                // Brave/ambitious nobles become LESS loyal (resentful of tyranny)
                                _h1n.kingLoyalty = Math.max(0, (_h1n.kingLoyalty || 50) - 8);
                            } else {
                                // Average nobles: increase perceived loyalty (acting more carefully) but slight loyalty drop
                                _h1n.perceivedKingLoyalty = Math.min(100, (_h1n.perceivedKingLoyalty || 50) + 10);
                                _h1n.kingLoyalty = Math.max(0, (_h1n.kingLoyalty || 50) - 3);
                            }
                        }
                    } else if (_h1SeverityRoll < _h1JailThresh) {
                        // IMPRISONMENT — moderate fear spike
                        _h1Target._imprisoned = true;
                        _h1Target._imprisonedDay = world.day;
                        _h1Target._imprisonedDuration = 30 + rng.randInt(0, 60);
                        _h1Target.kingLoyalty = Math.max(0, (_h1Target.kingLoyalty || 50) - 20);
                        logKingAction(k, '⛓️ Imprisoned ' + _h1TargetName + ' for suspected disloyalty');
                        logEvent('⛓️ ' + k.name + '\'s king IMPRISONS noble ' + _h1TargetName + '!',  {
                            type: 'noble_imprisonment', kingdomId: k.id,
                            cause: 'The king suspects disloyalty',
                            effects: ['Noble imprisoned', 'Moderate fear increase for all nobles']
                        }, _eventKingdomCategory(k.id));
                        for (var _h1ji = 0; _h1ji < _h1Nobles.length; _h1ji++) {
                            var _h1jn = _h1Nobles[_h1ji];
                            if (_h1jn.id === _h1Target.id) continue;
                            _h1jn.fearOfKing = Math.min(100, (_h1jn.fearOfKing || 15) + 10 + rng.randInt(0, 5));
                            var _h1jp = _h1jn.personality || {};
                            if (_h1jp.courage === 'cowardly' || (_h1jp.ambition || 50) < 30) {
                                _h1jn.perceivedKingLoyalty = Math.min(100, (_h1jn.perceivedKingLoyalty || 50) + 8);
                            } else if (_h1jp.courage === 'brave' || (_h1jp.ambition || 50) > 70) {
                                _h1jn.kingLoyalty = Math.max(0, (_h1jn.kingLoyalty || 50) - 4);
                            }
                        }
                    } else {
                        // FINE — mild fear, common punishment
                        var _h1Fine = Math.min((_h1Target.gold || 0), Math.floor(rng.randFloat(50, 200)));
                        _h1Target.gold = Math.max(0, (_h1Target.gold || 0) - _h1Fine);
                        k.gold += _h1Fine;
                        _h1Target.kingLoyalty = Math.max(0, (_h1Target.kingLoyalty || 50) - 5);
                        logKingAction(k, '💰 Fined ' + _h1TargetName + ' ' + _h1Fine + 'g for displeasing the crown');
                        logEvent('💰 ' + k.name + '\'s king fines noble ' + _h1TargetName + ' ' + _h1Fine + 'g.',  {
                            type: 'noble_fine', kingdomId: k.id
                        }, _eventKingdomCategory(k.id));
                        for (var _h1fni = 0; _h1fni < _h1Nobles.length; _h1fni++) {
                            if (_h1Nobles[_h1fni].id !== _h1Target.id) {
                                _h1Nobles[_h1fni].fearOfKing = Math.min(100, (_h1Nobles[_h1fni].fearOfKing || 15) + 3);
                            }
                        }
                    }
                }

                // War victory fear boost (check monthly)
                if (k._recentBattleWins && k._recentBattleWins > 0) {
                    var _h1WinFear = Math.min(10, k._recentBattleWins * 3);
                    for (var _h1wi = 0; _h1wi < _h1Nobles.length; _h1wi++) {
                        _h1Nobles[_h1wi].fearOfKing = Math.min(100, (_h1Nobles[_h1wi].fearOfKing || 15) + _h1WinFear);
                        // War victories make cowardly nobles more loyal
                        var _h1wp = _h1Nobles[_h1wi].personality || {};
                        if (_h1wp.courage === 'cowardly') {
                            _h1Nobles[_h1wi].kingLoyalty = Math.min(100, (_h1Nobles[_h1wi].kingLoyalty || 50) + 2);
                        }
                    }
                    k._recentBattleWins = Math.max(0, k._recentBattleWins - 1); // decay
                }

                // Conscription and property seizure slightly increase fear (already handled above but ensure tracking)
                if (k._lastConscriptionDay && (world.day - k._lastConscriptionDay) < 30) {
                    for (var _h1ci = 0; _h1ci < _h1Nobles.length; _h1ci++) {
                        _h1Nobles[_h1ci].fearOfKing = Math.min(100, (_h1Nobles[_h1ci].fearOfKing || 15) + 2);
                    }
                }
            }
        }

        // ── Kingdom Transport Decision (every 30 days) ──
        if (world.day % 30 === 0) {
            var hasTransport = k.laws && k.laws.kingdomTransport;
            var kTowns = world.towns.filter(function(t) { return t.kingdomId === k.id; });
            var numTowns = kTowns.length;
            var setupCost = 500 * numTowns;
            var seasonalCost = (CONFIG.KINGDOM_TRANSPORT ? CONFIG.KINGDOM_TRANSPORT.baseCostPerTown : 50) * numTowns;

            if (!hasTransport) {
                // Consider implementing transport
                var wantTransport = false;

                // Progressive kings more likely
                if (p.tradition === 'progressive' && rng.chance(0.15)) wantTransport = true;
                // Generous kings want it for the people
                if (p.greed === 'generous' && p.temperament === 'kind' && rng.chance(0.12)) wantTransport = true;
                // Clever kings analyze cost/benefit
                if ((p.intelligence === 'brilliant' || p.intelligence === 'clever') && k.gold > setupCost * 2 && rng.chance(0.10)) wantTransport = true;
                // Ambitious kings see it as modernization
                if (p.ambition === 'ambitious' && k.gold > setupCost * 1.5 && rng.chance(0.08)) wantTransport = true;

                // Can they afford the setup cost?
                if (wantTransport && k.gold >= setupCost) {
                    k.gold -= setupCost;
                    if (!k.laws) k.laws = {};
                    k.laws.kingdomTransport = true;
                    if (!k.laws.transportRate) k.laws.transportRate = rng.randInt(10, 25);
                    logEvent('👑 ' + k.name + ' has established a kingdom transport service! Setup cost: ' + setupCost + 'g', 
                        { type: 'law_change', kingdomId: k.id }, _eventKingdomCategory(k.id));
                }
            } else {
                // Consider ending transport
                var wantEnd = false;

                // Treasury is too low
                if (k.gold < seasonalCost * 2) wantEnd = true;
                // Greedy/corrupt kings may end it to save money
                if ((p.greed === 'greedy' || p.greed === 'corrupt') && rng.chance(0.08)) wantEnd = true;
                // At war — divert funds
                if (k.atWar && k.atWar.size > 0 && k.gold < 2000 && rng.chance(0.20)) wantEnd = true;
                // Foolish king random cancelation
                if (p.intelligence === 'foolish' && rng.chance(0.05)) wantEnd = true;

                // Kings who like it keep it
                if (p.tradition === 'progressive' || p.greed === 'generous') wantEnd = false;
                // Override: bankruptcy forces it
                if (k.gold < seasonalCost) wantEnd = true;

                if (wantEnd) {
                    k.laws.kingdomTransport = false;
                    logEvent('📢 ' + k.name + ' has ended its kingdom transport service.', 
                        { type: 'law_change', kingdomId: k.id }, _eventKingdomCategory(k.id));
                }
            }
        }

        // Adjust transport rate (every 60 days)
        if (world.day % 60 === 0 && k.laws && k.laws.kingdomTransport) {
            var currentRate = k.laws.transportRate || 15;
            if (p.greed === 'greedy' || p.greed === 'corrupt') {
                // Increase rate
                k.laws.transportRate = Math.min(40, currentRate + rng.randInt(1, 5));
            } else if (p.greed === 'generous' && currentRate > 8) {
                // Decrease rate
                k.laws.transportRate = Math.max(5, currentRate - rng.randInt(1, 3));
            }
        }
    }

    function kingdom_name(k) { return k.name || 'Unknown Kingdom'; }

    function boostKingdomHappiness(k, amount) {
        // Apply happiness change to all towns in this kingdom
        for (var i = 0; i < world.towns.length; i++) {
            var t = world.towns[i];
            if (t.kingdomId !== k.id) continue;
            t.happiness = Math.max(0, Math.min(100, (t.happiness || 50) + amount));
        }
        // Also nudge citizen happiness so it stays in sync
        var citizens = getPeopleInKingdom(k.id);
        for (var ci = 0; ci < citizens.length; ci++) {
            citizens[ci].needs.happiness = Math.max(0, Math.min(100, citizens[ci].needs.happiness + amount * 0.5));
        }
    }

    // ========================================================
    // §17G-A  PROACTIVE KING ECONOMIC GROWTH STRATEGIES
    // ========================================================

    /**
     * Analyze the economy of a kingdom: per-town production, surpluses,
     * deficits, population trends, and supply chain gaps.
     */
    function analyzeKingdomEconomy(kingdom) {
        if (!kingdom || !kingdom.territories) return null;
        const towns = [];
        let totalPop = 0, totalHappiness = 0, totalProsperity = 0;
        const kingdomSupply = {};   // aggregate supply across kingdom
        const kingdomDemand = {};   // estimated demand
        const buildingCounts = {};  // how many of each building type exist

        for (const townId of kingdom.territories) {
            const town = findTown(townId);
            if (!town) continue;
            const pop = town.population || 0;
            totalPop += pop;
            totalHappiness += (town.happiness || 50);
            totalProsperity += (town.prosperity || 50);

            // Catalog buildings and production
            const produces = {};
            const consumes = {};
            const bldTypes = {};
            for (const bld of town.buildings) {
                bldTypes[bld.type] = (bldTypes[bld.type] || 0) + 1;
                buildingCounts[bld.type] = (buildingCounts[bld.type] || 0) + 1;
                const bt = findBuildingType(bld.type);
                if (!bt) continue;
                let ap = bt.produces, ac = bt.consumes, ar = bt.rate;
                if (bld.currentProduct && bt.availableProducts && bt.availableProducts[bld.currentProduct]) {
                    const r = bt.availableProducts[bld.currentProduct];
                    ap = r.produces; ac = r.consumes; ar = r.rate;
                } else if (bld.productionChoice && bt.availableProducts && bt.availableProducts[bld.productionChoice]) {
                    const r = bt.availableProducts[bld.productionChoice];
                    ap = r.produces; ac = r.consumes; ar = r.rate;
                }
                if (ap) produces[ap] = (produces[ap] || 0) + (ar || 1);
                if (ac) {
                    for (const [res, qty] of Object.entries(ac)) {
                        consumes[res] = (consumes[res] || 0) + qty;
                    }
                }
            }

            // Supply vs demand from market
            const surpluses = [];
            const deficits = [];
            for (const resId in town.market.supply) {
                const sup = town.market.supply[resId] || 0;
                kingdomSupply[resId] = (kingdomSupply[resId] || 0) + sup;
                if (sup > pop * 2) surpluses.push({ good: resId, amount: sup });
            }
            // Estimate demand: population food needs + building input consumption
            const foodDemand = Math.ceil(pop * 0.5);
            for (const foodId of ['bread', 'meat', 'wheat', 'fish', 'eggs']) {
                const dem = foodDemand;
                kingdomDemand[foodId] = (kingdomDemand[foodId] || 0) + dem;
                if ((town.market.supply[foodId] || 0) < dem * 0.5) {
                    deficits.push({ good: foodId, shortfall: dem - (town.market.supply[foodId] || 0) });
                }
            }
            for (const [res, qty] of Object.entries(consumes)) {
                kingdomDemand[res] = (kingdomDemand[res] || 0) + qty;
                if ((town.market.supply[res] || 0) < qty * 3) {
                    deficits.push({ good: res, shortfall: qty * 3 - (town.market.supply[res] || 0) });
                }
            }

            // Medical supply demand: based on sick/injured NPCs in town
            var _analysisPop = getPeopleInTown(town.id);
            var _analysisSick = 0;
            for (var _ai = 0; _ai < _analysisPop.length; _ai++) {
                if (_analysisPop[_ai].sick || _analysisPop[_ai].injured) _analysisSick++;
            }
            if (_analysisSick > 0) {
                var _medDemandGoods = { bandages: 1.0, herbal_remedy: 0.5, healing_tonic: 0.3, antidote: 0.15, fever_tonic: 0.2 };
                for (var _mdg in _medDemandGoods) {
                    var _medDem = Math.ceil(_analysisSick * _medDemandGoods[_mdg]);
                    kingdomDemand[_mdg] = (kingdomDemand[_mdg] || 0) + _medDem;
                    if ((town.market.supply[_mdg] || 0) < _medDem) {
                        deficits.push({ good: _mdg, shortfall: _medDem - (town.market.supply[_mdg] || 0) });
                    }
                }
            }

            // Building slots available
            const maxSlots = (CONFIG.TOWN_CATEGORIES[town.category] || {}).maxBuildingSlots || 10;
            const slotsUsed = town.buildings.length;

            // Trade volume estimate
            let tradeVolume = 0;
            for (const resId in town.market.supply) {
                tradeVolume += (town.market.supply[resId] || 0);
            }
            // v9p33river310: apply Royal Marketplace tradeVolumeBonus.
            // The building defines tradeVolumeBonus: 0.20 (config.js:1992)
            // but no consumer was reading it, leaving the advertised
            // effect dead.
            try {
                var _mrBonus = 0;
                for (var _mrBi = 0; _mrBi < town.buildings.length; _mrBi++) {
                    var _mrB = town.buildings[_mrBi];
                    var _mrBt = (typeof findBuildingType === 'function') ? findBuildingType(_mrB.type) : null;
                    if (_mrBt && _mrBt.tradeVolumeBonus) _mrBonus += _mrBt.tradeVolumeBonus;
                }
                if (_mrBonus > 0) tradeVolume = Math.round(tradeVolume * (1 + _mrBonus));
            } catch (e) {}

            towns.push({
                id: town.id,
                name: town.name,
                population: pop,
                happiness: town.happiness || 50,
                prosperity: town.prosperity || 50,
                buildings: bldTypes,
                produces: produces,
                consumes: consumes,
                surpluses: surpluses,
                deficits: deficits,
                slotsAvailable: maxSlots - slotsUsed,
                tradeVolume: tradeVolume,
                isPort: !!town.isPort,
                isCapital: !!town.isCapital,
            });
        }

        const numTowns = towns.length || 1;

        // Identify supply chain gaps: raw materials produced but no processor, or processor but no raw source
        const supplyChainGaps = [];
        for (const key in BUILDING_TYPES) {
            const bt = BUILDING_TYPES[key];
            if (!bt.produces || !bt.consumes) continue;
            for (const inputRes of Object.keys(bt.consumes)) {
                // Is input produced somewhere in kingdom?
                const inputProduced = towns.some(t => t.produces[inputRes] > 0);
                // Is processor present?
                const processorPresent = (buildingCounts[bt.id] || 0) > 0;
                if (inputProduced && !processorPresent) {
                    supplyChainGaps.push({ type: 'missing_processor', building: bt.id, input: inputRes, output: bt.produces });
                }
                if (processorPresent && !inputProduced && !(kingdomSupply[inputRes] > 0)) {
                    supplyChainGaps.push({ type: 'missing_source', building: bt.id, input: inputRes, output: bt.produces });
                }
            }
        }

        // Find single-industry towns (diversification concerns)
        const monoTowns = towns.filter(t => {
            const prodTypes = Object.keys(t.produces);
            return prodTypes.length <= 1 && t.population > 30;
        });

        return {
            towns: towns,
            totalPopulation: totalPop,
            avgHappiness: Math.round(totalHappiness / numTowns),
            avgProsperity: Math.round(totalProsperity / numTowns),
            kingdomSupply: kingdomSupply,
            kingdomDemand: kingdomDemand,
            buildingCounts: buildingCounts,
            supplyChainGaps: supplyChainGaps,
            monoTowns: monoTowns,
            treasury: kingdom.gold,
        };
    }

    /**
     * Every 30 days, the king reviews the economy and takes proactive
     * growth actions based on personality and analysis.
     */
    function tickKingEconomicStrategy(kingdom) {
        if (!world || !kingdom) return;
        const rng = world.rng;
        const p = kingdom.kingPersonality || {};
        const treasury = kingdom.gold;

        // Intelligence affects strategy review frequency
        var strategyInterval = CONFIG.KING_ECONOMY_STRATEGY_INTERVAL || 30;
        if (p.intelligence === 'brilliant' || p.intelligence === 'clever') strategyInterval = 7;
        else if (p.intelligence === 'dim' || p.intelligence === 'foolish') strategyInterval = 15;
        else strategyInterval = 10;
        if (!kingdom._lastStrategyDay) kingdom._lastStrategyDay = 0;
        if (world.day - kingdom._lastStrategyDay < strategyInterval) return;
        kingdom._lastStrategyDay = world.day;

        // Don't strategize if broke
        if (treasury < (CONFIG.KING_MIN_TREASURY_FOR_STRATEGY || 500)) return;

        // Initialize economic strategy fields
        if (!kingdom.landSubsidies) kingdom.landSubsidies = [];
        if (!kingdom.productionBounties) kingdom.productionBounties = [];
        if (!kingdom.tradeSubsidies) kingdom.tradeSubsidies = [];
        if (!kingdom.taxHolidays) kingdom.taxHolidays = [];
        if (!kingdom.immigrationIncentives) kingdom.immigrationIncentives = [];
        if (!kingdom.productionQuotas) kingdom.productionQuotas = [];
        if (!kingdom.exportRestrictions) kingdom.exportRestrictions = [];

        // Expire old policies
        const day = world.day;
        kingdom.landSubsidies = kingdom.landSubsidies.filter(s => s.expiresDay > day);
        kingdom.productionBounties = kingdom.productionBounties.filter(b => b.expiresDay > day);
        kingdom.tradeSubsidies = kingdom.tradeSubsidies.filter(s => s.expiresDay > day);
        kingdom.taxHolidays = kingdom.taxHolidays.filter(h => h.expiresDay > day);
        kingdom.immigrationIncentives = kingdom.immigrationIncentives.filter(i => i.expiresDay > day);
        kingdom.productionQuotas = kingdom.productionQuotas.filter(q => q.expiresDay > day);

        // Run analysis
        const analysis = analyzeKingdomEconomy(kingdom);
        if (!analysis) return;

        // Determine strategy count and weighting by personality
        let maxActions = CONFIG.KING_MAX_STRATEGIES_PER_CYCLE || 5;
        let carrotWeight = 0.5; // balanced default

        // Ambition affects count
        if (p.ambition === 'ambitious') maxActions = Math.min(7, maxActions + 2);
        else if (p.ambition === 'lazy') maxActions = Math.max(1, maxActions - 3);
        else if (p.ambition === 'content') maxActions = Math.max(2, maxActions - 1);

        // Greed/justice affects carrot vs stick weighting
        if (p.greed === 'generous' || p.greed === 'fair') carrotWeight += 0.2;
        if (p.justice === 'just' || p.temperament === 'kind') carrotWeight += 0.1;
        if (p.greed === 'greedy') carrotWeight -= 0.2;
        if (p.greed === 'corrupt') carrotWeight -= 0.3;
        if (p.temperament === 'stern' || p.temperament === 'cruel') carrotWeight -= 0.1;
        carrotWeight = Math.max(0.1, Math.min(0.9, carrotWeight));

        // Intelligence affects quality
        const isClever = p.intelligence === 'brilliant' || p.intelligence === 'clever';
        const isDim = p.intelligence === 'dim' || p.intelligence === 'foolish';

        // Intelligence-based strategy quality modifier
        var strategyQuality = 1.0;
        if (p.intelligence === 'brilliant') strategyQuality = 1.5;
        else if (p.intelligence === 'clever') strategyQuality = 1.2;
        else if (p.intelligence === 'dim') strategyQuality = 0.7;
        else if (p.intelligence === 'foolish') strategyQuality = 0.5;

        // Intelligence-based crisis detection: smart kings react earlier
        var crisisThreshold = 0.5; // standard: 50% of starting gold
        if (isClever) crisisThreshold = 0.7; // react at 70%
        else if (isDim) crisisThreshold = 0.3; // don't notice until 30%

        // Low-value goods that brilliant kings avoid subsidizing
        var lowValueGoods = ['gut_string', 'hide', 'wool', 'wheat'];

        // Foolish king: chance to waste gold on frivolity
        if (p.intelligence === 'foolish' && rng.chance(0.3)) {
            var wastedGold = rng.randInt(100, 500);
            wastedGold = Math.min(wastedGold, Math.floor(kingdom.gold * 0.1));
            if (wastedGold > 0 && kingdom.gold > wastedGold + 500) {
                kingdom.gold -= wastedGold;
                logEvent('\uD83E\uDD34 The foolish ruler of ' + kingdom.name + ' wastes ' + wastedGold + 'g on royal frivolity!',  {
                    type: 'royal_frivolity', kingdomId: kingdom.id, cause: 'Poor judgment by dim ruler',
                    effects: ['Treasury -' + wastedGold + 'g', 'Gold wasted on pointless vanity projects']
                }, _eventKingdomCategory(kingdom.id));
            }
        }

        // Gather candidate strategies
        const carrotStrategies = [];
        const stickStrategies = [];

        // ---- OPPORTUNITY SENSING: Supply Gap Buildings (priority 120, evaluated first) ----
        for (var sgGood in analysis.kingdomDemand) {
            var sgDemand = analysis.kingdomDemand[sgGood] || 0;
            var sgSupply = analysis.kingdomSupply[sgGood] || 0;
            if (sgDemand >= 20 && sgSupply === 0) {
                // Find building type that produces this good
                var sgBuildingType = null;
                for (var sgBtKey in BUILDING_TYPES) {
                    if (BUILDING_TYPES[sgBtKey].produces === sgGood) {
                        sgBuildingType = BUILDING_TYPES[sgBtKey];
                        break;
                    }
                }
                if (!sgBuildingType || sgBuildingType.cost > treasury * 0.4) continue;

                // Find best town: available slots, check deposit requirements
                var sgBestTown = null;
                for (var sgti = 0; sgti < analysis.towns.length; sgti++) {
                    var sgTownInfo = analysis.towns[sgti];
                    if (sgTownInfo.slotsAvailable <= 0) continue;
                    var sgDepReq = CONFIG.DEPOSIT_REQUIREMENTS ? CONFIG.DEPOSIT_REQUIREMENTS[sgBuildingType.id] : null;
                    if (sgDepReq) {
                        var sgFullTown = findTown(sgTownInfo.id);
                        if (!sgFullTown) continue;
                        var sgDeps = sgFullTown.naturalDeposits || {};
                        if (!sgDeps[sgDepReq.deposit] || sgDeps[sgDepReq.deposit] <= 0) continue;
                    }
                    sgBestTown = sgTownInfo;
                    break;
                }
                if (sgBestTown) {
                    carrotStrategies.push({
                        type: 'supply_gap_building',
                        townId: sgBestTown.id,
                        townName: sgBestTown.name,
                        buildingType: sgBuildingType.id,
                        buildingName: sgBuildingType.name,
                        good: sgGood,
                        cost: sgBuildingType.cost,
                        priority: 120,
                    });
                }
            }
        }

        // ---- CARROT STRATEGIES ----

        // a) Subsidized Land Program — for towns with deficits and available slots
        for (const ta of analysis.towns) {
            if (ta.slotsAvailable <= 0 || kingdom.landSubsidies.length >= 3) continue;
            if (kingdom.landSubsidies.some(s => s.townId === ta.id)) continue;
            for (const def of ta.deficits) {
                // Find building that produces this good
                for (const key in BUILDING_TYPES) {
                    const bt = BUILDING_TYPES[key];
                    if (bt.produces === def.good && bt.cost <= treasury * 0.3) {
                        carrotStrategies.push({
                            type: 'land_subsidy',
                            townId: ta.id,
                            townName: ta.name,
                            buildingType: bt.id,
                            buildingName: bt.name,
                            good: def.good,
                            discount: CONFIG.KING_LAND_SUBSIDY_DISCOUNT || 0.4,
                            priority: def.shortfall,
                        });
                        break;
                    }
                }
            }
        }

        // b) Production Bounties — for goods in deficit
        if (kingdom.productionBounties.length < (CONFIG.KING_MAX_BOUNTIES || 5)) {
            for (const ta of analysis.towns) {
                for (const def of ta.deficits) {
                    if (kingdom.productionBounties.some(b => b.good === def.good && b.townId === ta.id)) continue;
                    carrotStrategies.push({
                        type: 'bounty',
                        townId: ta.id,
                        townName: ta.name,
                        good: def.good,
                        reward: CONFIG.KING_BOUNTY_DEFAULT_REWARD || 50,
                        priority: def.shortfall,
                    });
                }
            }
        }

        // c) Trade Subsidies — for scarce goods kingdom-wide
        if (kingdom.tradeSubsidies.length < (CONFIG.KING_MAX_TRADE_SUBSIDIES || 3)) {
            for (const resId in analysis.kingdomDemand) {
                const dem = analysis.kingdomDemand[resId];
                const sup = analysis.kingdomSupply[resId] || 0;
                if (dem > sup * 2 && !kingdom.tradeSubsidies.some(s => s.good === resId)) {
                    carrotStrategies.push({
                        type: 'trade_subsidy',
                        good: resId,
                        bonusPerUnit: CONFIG.KING_TRADE_SUBSIDY_PER_UNIT || 2,
                        maxUnits: 100,
                        priority: dem - sup,
                    });
                }
            }
        }

        // d) Tax Holidays — for towns with low prosperity and available slots
        for (const ta of analysis.towns) {
            if (ta.prosperity >= 50 || ta.slotsAvailable <= 0) continue;
            if (kingdom.taxHolidays.some(h => h.townId === ta.id)) continue;
            carrotStrategies.push({
                type: 'tax_holiday',
                townId: ta.id,
                townName: ta.name,
                priority: 50 - ta.prosperity,
            });
        }

        // e) Immigration Incentives — for underpopulated towns
        for (const ta of analysis.towns) {
            if (ta.population >= 80 || kingdom.immigrationIncentives.some(i => i.townId === ta.id)) continue;
            carrotStrategies.push({
                type: 'immigration',
                townId: ta.id,
                townName: ta.name,
                priority: 80 - ta.population,
            });
        }

        // f) Infrastructure — build roads between complementary towns (handled by existing road AI, just boost priority)

        // l) Strategic Building — fill supply chain gaps
        var _scInputSourceMap = {
            wood: 'lumber_camp', iron_ore: 'iron_mine', wool: 'sheep_farm',
            hide: 'hunting_lodge', hemp: 'hemp_farm', clay: 'clay_pit',
            herbs: 'herb_garden', wheat: 'wheat_farm'
        };
        for (const gap of analysis.supplyChainGaps) {
            if (gap.type === 'missing_processor') {
                const bt = findBuildingType(gap.building);
                if (!bt || bt.cost > treasury * 0.4) continue;
                const bestTown = analysis.towns.find(t => t.produces[gap.input] > 0 && t.slotsAvailable > 0);
                if (bestTown) {
                    carrotStrategies.push({
                        type: 'strategic_building',
                        townId: bestTown.id,
                        townName: bestTown.name,
                        buildingType: bt.id,
                        buildingName: bt.name,
                        input: gap.input,
                        output: gap.output,
                        cost: bt.cost,
                        priority: 80,
                    });
                }
            } else if (gap.type === 'missing_source') {
                // Processor exists but no raw input source — build the source
                var _srcType = _scInputSourceMap[gap.input];
                if (!_srcType) continue;
                var _srcBt = findBuildingType(_srcType);
                if (!_srcBt || _srcBt.cost > treasury * 0.4) continue;
                // Place in the town that has the processor
                var _srcTown = analysis.towns.find(function(t) {
                    return t.slotsAvailable > 0 && t.buildings[gap.building] > 0;
                });
                if (_srcTown) {
                    carrotStrategies.push({
                        type: 'strategic_building',
                        townId: _srcTown.id,
                        townName: _srcTown.name,
                        buildingType: _srcType,
                        buildingName: _srcBt.name,
                        input: gap.input,
                        output: gap.output,
                        cost: _srcBt.cost,
                        priority: 85,
                    });
                }
            }
        }

        // n) Diversification — incentivize different production in mono-towns
        for (const mt of analysis.monoTowns) {
            if (mt.slotsAvailable <= 0) continue;
            const existingProds = Object.keys(mt.produces);
            for (const key in BUILDING_TYPES) {
                const bt = BUILDING_TYPES[key];
                if (!bt.produces || existingProds.includes(bt.produces)) continue;
                if (bt.cost > treasury * 0.3) continue;
                if ((CONFIG.KINGDOM_EXCLUSIVE_BUILDINGS || []).includes(bt.id)) continue;
                carrotStrategies.push({
                    type: 'land_subsidy',
                    townId: mt.id,
                    townName: mt.name,
                    buildingType: bt.id,
                    buildingName: bt.name,
                    good: bt.produces,
                    discount: (CONFIG.KING_LAND_SUBSIDY_DISCOUNT || 0.4) + 0.1,
                    priority: 60,
                });
                break;
            }
        }

        // o) Stockpile Management — brilliant kings buy low, sell high
        if (isClever) {
            for (const ta of analysis.towns) {
                for (const sur of ta.surpluses) {
                    const res = findResourceById(sur.good);
                    if (!res) continue;
                    const town = findTown(ta.id);
                    if (!town) continue;
                    const price = getMarketPrice(town, sur.good);
                    if (price < res.basePrice * (CONFIG.KING_STOCKPILE_BUY_THRESHOLD || 0.7)) {
                        carrotStrategies.push({
                            type: 'stockpile_buy',
                            townId: ta.id,
                            townName: ta.name,
                            good: sur.good,
                            price: price,
                            priority: 40,
                        });
                    }
                }
            }
        }

        // ---- STICK STRATEGIES ----

        // g) Production Quotas — for towns underperforming
        for (const ta of analysis.towns) {
            if (ta.prosperity >= 40 || kingdom.productionQuotas.some(q => q.townId === ta.id)) continue;
            const mainProd = Object.entries(ta.produces).sort((a, b) => b[1] - a[1])[0];
            if (mainProd) {
                stickStrategies.push({
                    type: 'quota',
                    townId: ta.id,
                    townName: ta.name,
                    good: mainProd[0],
                    minPerSeason: Math.ceil(mainProd[1] * 1.5),
                    priority: 40 - ta.prosperity,
                });
            }
        }

        // h) Forced Labor — for construction projects when treasury is low
        if (treasury < 2000) {
            for (const ta of analysis.towns) {
                if (ta.slotsAvailable <= 0) continue;
                const town = findTown(ta.id);
                if (!town) continue;
                const idle = world.people.filter(pp =>
                    pp.alive && pp.townId === ta.id &&
                    (pp.occupation === 'laborer' || pp.occupation === 'none') &&
                    pp.age >= CONFIG.COMING_OF_AGE
                );
                if (idle.length >= 3) {
                    stickStrategies.push({
                        type: 'forced_labor',
                        townId: ta.id,
                        townName: ta.name,
                        idleCount: idle.length,
                        priority: 30,
                    });
                }
            }
        }

        // i) Asset Seizure — corrupt kings only, target underperforming NPC buildings
        if (p.greed === 'corrupt') {
            for (const ta of analysis.towns) {
                const town = findTown(ta.id);
                if (!town) continue;
                for (const bld of town.buildings) {
                    if (!bld.ownerId || bld.ownerId === 'player' || bld.ownerId === kingdom.id) continue;
                    if (bld._profitTracker && bld._profitTracker.revenue < bld._profitTracker.costs) {
                        stickStrategies.push({
                            type: 'asset_seizure',
                            townId: ta.id,
                            townName: ta.name,
                            buildingType: bld.type,
                            ownerId: bld.ownerId,
                            priority: 20,
                        });
                        break;
                    }
                }
            }
        }

        // j) Export Restrictions — protect scarce goods
        if (kingdom.exportRestrictions.length < (CONFIG.KING_MAX_EXPORT_RESTRICTIONS || 3)) {
            for (const resId in analysis.kingdomDemand) {
                const dem = analysis.kingdomDemand[resId];
                const sup = analysis.kingdomSupply[resId] || 0;
                if (dem > sup * 3 && !kingdom.exportRestrictions.includes(resId)) {
                    stickStrategies.push({
                        type: 'export_restriction',
                        good: resId,
                        priority: dem - sup,
                    });
                }
            }
        }

        // p) Market Intelligence — adjust tariffs based on neighbors
        if (isClever) {
            stickStrategies.push({
                type: 'tariff_adjustment',
                priority: 25,
            });
        }

        // ---- SELECT STRATEGIES ----
        // Dim/foolish kings pick randomly; clever kings sort by priority
        let candidates = [];
        const carrotSlots = Math.ceil(maxActions * carrotWeight);
        const stickSlots = maxActions - carrotSlots;

        // Brilliant/clever kings: filter out low-value goods and boost priorities by supply/demand gap
        if (isClever) {
            for (var fi = carrotStrategies.length - 1; fi >= 0; fi--) {
                if (carrotStrategies[fi].good && lowValueGoods.indexOf(carrotStrategies[fi].good) >= 0) {
                    carrotStrategies.splice(fi, 1);
                }
            }
            // Boost priorities based on actual supply/demand gap analysis
            for (var si2 = 0; si2 < carrotStrategies.length; si2++) {
                var strat2 = carrotStrategies[si2];
                if (strat2.good) {
                    var demGap = (analysis.kingdomDemand[strat2.good] || 0) - (analysis.kingdomSupply[strat2.good] || 0);
                    if (demGap > 0) strat2.priority += Math.floor(demGap * strategyQuality);
                }
            }
            carrotStrategies.sort((a, b) => b.priority - a.priority);
            stickStrategies.sort((a, b) => b.priority - a.priority);
        } else if (isDim) {
            rng.shuffle(carrotStrategies);
            rng.shuffle(stickStrategies);
        } else {
            // Average intelligence: partially sorted with some randomness
            rng.shuffle(carrotStrategies);
            rng.shuffle(stickStrategies);
            carrotStrategies.sort((a, b) => (b.priority - a.priority) * 0.5 + rng.randFloat(-20, 20));
            stickStrategies.sort((a, b) => (b.priority - a.priority) * 0.5 + rng.randFloat(-20, 20));
        }

        candidates = candidates.concat(carrotStrategies.slice(0, carrotSlots));
        candidates = candidates.concat(stickStrategies.slice(0, stickSlots));

        // Warlike kings bias toward military production
        if (p.militarism === 'warlike' || p.militarism === 'aggressive') {
            candidates = candidates.filter(c => {
                if (c.good && ['swords', 'armor', 'bows', 'arrows', 'horses'].includes(c.good)) return true;
                return rng.chance(0.6); // drop some non-military strategies
            });
        }

        // ---- PLAYER KING: Queue as proposals instead of auto-executing ----
        if (_isPlayerKingOf(kingdom)) {
            if (!kingdom._economicProposals) kingdom._economicProposals = [];
            // Expire old proposals (15 days)
            kingdom._economicProposals = kingdom._economicProposals.filter(function(pr) { return (world.day - pr.createdDay) < 15; });
            // Cap total proposals
            if (kingdom._economicProposals.length >= 8) return;
            var _proposalCount = 0;
            for (var _pi = 0; _pi < candidates.length && _proposalCount < maxActions; _pi++) {
                var _ps = candidates[_pi];
                if (kingdom.gold < (CONFIG.KING_MIN_TREASURY_FOR_STRATEGY || 500)) break;
                // Skip if duplicate proposal already queued
                var _isDupe = false;
                for (var _di = 0; _di < kingdom._economicProposals.length; _di++) {
                    var _ex = kingdom._economicProposals[_di];
                    if (_ex.type === _ps.type && _ex.good === _ps.good && _ex.townId === _ps.townId) { _isDupe = true; break; }
                }
                if (_isDupe) continue;
                // Build human-readable description
                var _resInfo = _ps.good ? findResourceById(_ps.good) : null;
                var _goodName = _resInfo ? _resInfo.name : (_ps.good || '');
                var _desc = '';
                var _icon = '📋';
                var _title = '';
                switch (_ps.type) {
                    case 'land_subsidy':
                        _icon = '🏗️'; _title = 'Land Subsidy';
                        _desc = 'Offer ' + Math.round(Math.min(0.6, _ps.discount || 0.4) * 100) + '% land discount in ' + (_ps.townName || '?') + ' for ' + (_ps.buildingName || '?') + ' builders.';
                        break;
                    case 'bounty':
                        _icon = '📜'; _title = 'Production Bounty';
                        _desc = 'Offer ' + (_ps.reward || 50) + 'g bounty for ' + _goodName + ' production in ' + (_ps.townName || '?') + '.';
                        break;
                    case 'trade_subsidy':
                        _icon = '💰'; _title = 'Import Subsidy';
                        _desc = 'Subsidize ' + _goodName + ' imports — ' + (_ps.bonusPerUnit || 2) + 'g bonus per unit to merchants.';
                        break;
                    case 'tax_holiday':
                        _icon = '🎉'; _title = 'Tax Holiday';
                        _desc = 'Declare a tax holiday in ' + (_ps.townName || '?') + ' for ' + (CONFIG.KING_TAX_HOLIDAY_DURATION || 180) + ' days.';
                        break;
                    case 'immigration':
                        _icon = '🏘️'; _title = 'Immigration Incentive';
                        _desc = 'Attract settlers to ' + (_ps.townName || '?') + ' with ' + (CONFIG.KING_IMMIGRATION_BONUS || 50) + 'g signing bonus.';
                        break;
                    case 'production_quota':
                        _icon = '⚒️'; _title = 'Production Quota';
                        _desc = 'Set mandatory minimum production of ' + _goodName + ' in ' + (_ps.townName || '?') + '.';
                        break;
                    case 'supply_gap_building':
                        _icon = '🏭'; _title = 'Build ' + (_ps.buildingName || 'Facility');
                        _desc = 'Build a ' + (_ps.buildingName || '?') + ' in ' + (_ps.townName || '?') + ' to produce ' + _goodName + ' (cost: ' + (_ps.cost || 0) + 'g).';
                        break;
                    case 'forced_labor':
                        _icon = '⛓️'; _title = 'Forced Labor';
                        _desc = 'Conscript laborers in ' + (_ps.townName || '?') + ' to build a ' + (_ps.buildingName || '?') + ' at half cost (happiness penalty).';
                        break;
                    case 'asset_seizure':
                        _icon = '👑'; _title = 'Seize Asset';
                        _desc = 'Confiscate a ' + (_ps.buildingName || 'building') + ' in ' + (_ps.townName || '?') + ' for the crown.';
                        break;
                    case 'export_restriction':
                        _icon = '🚫'; _title = 'Export Restriction';
                        _desc = 'Restrict export of ' + _goodName + ' to protect domestic supply.';
                        break;
                    case 'tariff_adjustment':
                        _icon = '📊'; _title = 'Adjust Tariffs';
                        _desc = 'Lower trade tariffs to attract imports of scarce goods.';
                        break;
                    default:
                        _icon = '📋'; _title = _ps.type;
                        _desc = 'Economic strategy: ' + _ps.type + '.';
                }
                kingdom._economicProposals.push({
                    id: 'ep_' + world.day + '_' + _pi,
                    type: _ps.type,
                    icon: _icon,
                    title: _title,
                    desc: _desc,
                    stratData: _ps,
                    createdDay: world.day,
                    good: _ps.good || null,
                    townId: _ps.townId || null
                });
                _proposalCount++;
            }
            return; // Don't auto-execute for player kingdom
        }

        // ---- EXECUTE STRATEGIES (AI kingdoms only) ----
        let actionsThisCycle = 0;
        for (const strat of candidates) {
            if (actionsThisCycle >= maxActions) break;
            if (kingdom.gold < (CONFIG.KING_MIN_TREASURY_FOR_STRATEGY || 500)) break;

            switch (strat.type) {
                case 'land_subsidy': {
                    const discount = Math.min(0.6, strat.discount);
                    kingdom.landSubsidies.push({
                        townId: strat.townId,
                        buildingType: strat.buildingType,
                        discount: discount,
                        expiresDay: day + (CONFIG.KING_SUBSIDY_DURATION || 180),
                    });
                    logEvent(`👑 ${kingdom.name} offers cheap land in ${strat.townName} for anyone who builds a ${strat.buildingName}!`, {
                        type: 'economic_strategy', kingdomId: kingdom.id, cause: `${strat.good} deficit in ${strat.townName}`,
                        effects: [`${Math.round(discount * 100)}% discount on land for ${strat.buildingName} builders`, `Lasts ${CONFIG.KING_SUBSIDY_DURATION || 180} days`]
                    }, _eventKingdomCategory(kingdom.id));
                    actionsThisCycle++;
                    break;
                }
                case 'bounty': {
                    const reward = strat.reward;
                    kingdom.productionBounties.push({
                        good: strat.good,
                        townId: strat.townId,
                        reward: reward,
                        expiresDay: day + (CONFIG.KING_SUBSIDY_DURATION || 180),
                    });
                    const resInfo = findResourceById(strat.good);
                    const goodName = resInfo ? resInfo.name : strat.good;
                    logEvent(`📜 ${kingdom.name} seeks ${goodName} producers in ${strat.townName} — ${reward}g bounty!`, {
                        type: 'economic_strategy', kingdomId: kingdom.id, cause: `${goodName} shortage in ${strat.townName}`,
                        effects: [`${reward}g reward for building ${goodName} production`, 'NPCs may respond to this opportunity']
                    }, _eventKingdomCategory(kingdom.id));
                    actionsThisCycle++;
                    break;
                }
                case 'trade_subsidy': {
                    kingdom.tradeSubsidies.push({
                        good: strat.good,
                        bonusPerUnit: strat.bonusPerUnit,
                        maxUnits: strat.maxUnits,
                        unitsPaid: 0,
                        expiresDay: day + (CONFIG.KING_SUBSIDY_DURATION || 180),
                    });
                    const resInfo = findResourceById(strat.good);
                    const goodName = resInfo ? resInfo.name : strat.good;
                    logEvent(`💰 ${kingdom.name} subsidizes ${goodName} imports — ${strat.bonusPerUnit}g bonus per unit!`, {
                        type: 'economic_strategy', kingdomId: kingdom.id, cause: `${goodName} scarcity across kingdom`,
                        effects: [`Merchants get +${strat.bonusPerUnit}g per ${goodName} sold in kingdom`, 'Treasury funds the subsidy']
                    }, _eventKingdomCategory(kingdom.id));
                    actionsThisCycle++;
                    break;
                }
                case 'tax_holiday': {
                    kingdom.taxHolidays.push({
                        townId: strat.townId,
                        expiresDay: day + (CONFIG.KING_TAX_HOLIDAY_DURATION || 180),
                    });
                    logEvent(`🎉 ${kingdom.name} declares a tax holiday in ${strat.townName}! New businesses pay no property tax for ${CONFIG.KING_TAX_HOLIDAY_DURATION || 180} days.`, {
                        type: 'economic_strategy', kingdomId: kingdom.id, cause: `Low prosperity (${analysis.towns.find(t => t.id === strat.townId)?.prosperity || '?'}%) in ${strat.townName}`,
                        effects: ['No property tax for new buildings', 'Attracts investment']
                    }, _eventKingdomCategory(kingdom.id));
                    actionsThisCycle++;
                    break;
                }
                case 'immigration': {
                    kingdom.immigrationIncentives.push({
                        townId: strat.townId,
                        bonus: CONFIG.KING_IMMIGRATION_BONUS || 50,
                        expiresDay: day + (CONFIG.KING_SUBSIDY_DURATION || 180),
                    });
                    logEvent(`🏠 ${kingdom.name} offers ${CONFIG.KING_IMMIGRATION_BONUS || 50}g to families relocating to ${strat.townName}!`, {
                        type: 'economic_strategy', kingdomId: kingdom.id, cause: `${strat.townName} is underpopulated (${analysis.towns.find(t => t.id === strat.townId)?.population || '?'} people)`,
                        effects: ['Gold bonus for immigrants', 'Population may grow']
                    }, _eventKingdomCategory(kingdom.id));
                    actionsThisCycle++;
                    break;
                }
                case 'strategic_building': {
                    if (kingdom.gold < strat.cost) break;
                    const town = findTown(strat.townId);
                    if (!town) break;
                    const maxSlots = (CONFIG.TOWN_CATEGORIES[town.category] || {}).maxBuildingSlots || 10;
                    if (town.buildings.length >= maxSlots) {
                        // Try converting a for-sale building instead
                        var kbConvDone = false;
                        for (var kbCi = 0; kbCi < town.buildings.length; kbCi++) {
                            if (town.buildings[kbCi].forSale && town.buildings[kbCi].type !== strat.buildingType) {
                                var kbCvRes = convertBuilding(town, kbCi, strat.buildingType, kingdom.id, 'kingdom');
                                if (kbCvRes.success) {
                                    logEvent('\uD83D\uDC51\uD83D\uDD04 ' + kingdom.name + ' converts a building to ' + strat.buildingName + ' in ' + strat.townName + '.', {
                                        type: 'kingdom_conversion', kingdomId: kingdom.id, cause: 'No empty slots — converted for-sale building',
                                        effects: ['New ' + strat.buildingName + ' via conversion', 'Treasury spent on conversion']
                                    }, _eventKingdomCategory(kingdom.id));
                                    kbConvDone = true;
                                    actionsThisCycle++;
                                }
                                break;
                            }
                        }
                        if (!kbConvDone) break;
                        break;
                    }
                    town.buildings.push({
                        type: strat.buildingType, level: 1, ownerId: kingdom.id,
                        builtDay: day, condition: 'new', lastRepairDay: 0
                    });
                    kingdom.gold -= strat.cost;
                    logEvent(`🏗️ ${kingdom.name} builds a ${strat.buildingName} in ${strat.townName} to complete ${strat.input} → ${strat.output} supply chain!`, {
                        type: 'economic_strategy', kingdomId: kingdom.id, cause: `${strat.input} produced locally but no ${strat.buildingName} to process it`,
                        effects: [`New ${strat.buildingName} in ${strat.townName}`, `${strat.output} production begins`, `Treasury spent ${strat.cost}g`]
                    }, _eventKingdomCategory(kingdom.id));
                    actionsThisCycle++;
                    break;
                }
                case 'supply_gap_building': {
                    if (kingdom.gold < strat.cost) break;
                    var sgTown = findTown(strat.townId);
                    if (!sgTown) break;
                    var sgMaxSlots = (CONFIG.TOWN_CATEGORIES[sgTown.category] || {}).maxBuildingSlots || 10;
                    if (sgTown.buildings.length >= sgMaxSlots) {
                        // Try converting a for-sale building instead of building new
                        var sgConvDone = false;
                        for (var sgCi = 0; sgCi < sgTown.buildings.length; sgCi++) {
                            if (sgTown.buildings[sgCi].forSale && sgTown.buildings[sgCi].type !== strat.buildingType) {
                                var sgCvRes = convertBuilding(sgTown, sgCi, strat.buildingType, kingdom.id, 'kingdom');
                                if (sgCvRes.success) {
                                    logEvent('\uD83D\uDC51\uD83D\uDD04 ' + kingdom.name + ' converts a building to address ' + strat.good + ' shortage in ' + strat.townName + '.', {
                                        type: 'kingdom_conversion', kingdomId: kingdom.id, cause: 'No empty slots — converted for-sale building to produce ' + strat.good,
                                        effects: ['New ' + strat.buildingName + ' via conversion', strat.good + ' production begins']
                                    }, _eventKingdomCategory(kingdom.id));
                                    sgConvDone = true;
                                    actionsThisCycle++;
                                }
                                break;
                            }
                        }
                        if (!sgConvDone) break;
                        break;
                    }
                    sgTown.buildings.push({
                        type: strat.buildingType, level: 1, ownerId: kingdom.id,
                        builtDay: day, condition: 'new', lastRepairDay: 0
                    });
                    kingdom.gold -= strat.cost;
                    var sgKing = kingdom.king ? findPerson(kingdom.king) : null;
                    var sgKingName = sgKing ? (sgKing.firstName + ' ' + sgKing.lastName) : 'The ruler';
                    logEvent('\uD83D\uDC51\uD83D\uDCE6 ' + sgKingName + ' has ordered construction of a ' + strat.buildingName + ' to address the shortage of ' + strat.good + ' in ' + kingdom.name + '.', {
                        type: 'supply_gap_building', kingdomId: kingdom.id, cause: strat.good + ' has zero supply but high demand across ' + kingdom.name,
                        effects: ['New ' + strat.buildingName + ' in ' + strat.townName, strat.good + ' production begins', 'Treasury spent ' + strat.cost + 'g']
                    }, _eventKingdomCategory(kingdom.id));
                    // Royal Monopoly: greedy/corrupt kings may ban the good to control supply
                    if (p.greed === 'greedy' || p.greed === 'corrupt' || p.justice === 'corrupt') {
                        var monopolyChance = 0;
                        if (p.greed === 'greedy') monopolyChance += 0.40;
                        if (p.greed === 'corrupt') monopolyChance += 0.60;
                        if (p.justice === 'corrupt') monopolyChance += 0.20;
                        monopolyChance = Math.min(0.70, monopolyChance);
                        if (rng.chance(monopolyChance)) {
                            var sgCurrentBanned = kingdom.laws.bannedGoods || [];
                            if (sgCurrentBanned.indexOf(strat.good) === -1) {
                                var _sgExpanded = Engine._expandGoodsToTiers([strat.good]);
                                for (var _sge = 0; _sge < _sgExpanded.length; _sge++) {
                                    if (sgCurrentBanned.indexOf(_sgExpanded[_sge]) === -1) sgCurrentBanned.push(_sgExpanded[_sge]);
                                }
                                kingdom.laws.bannedGoods = sgCurrentBanned;
                                logEvent('\uD83D\uDC51\uD83D\uDEAB ' + sgKingName + ' of ' + kingdom.name + ' has declared a royal monopoly on ' + strat.good + '! Private trade in ' + strat.good + ' is now banned.',  {
                                    type: 'royal_monopoly', cause: sgKingName + ' seized control of ' + strat.good + ' trade after building production',
                                    effects: [strat.good + ' cannot be freely traded in ' + kingdom.name, 'Only kingdom-owned buildings produce ' + strat.good, 'A Royal Production Permit is required to trade ' + strat.good]
                                }, _eventKingdomCategory(kingdom.id));
                            }
                        }
                    }
                    actionsThisCycle++;
                    break;
                }
                case 'stockpile_buy': {
                    const town = findTown(strat.townId);
                    if (!town) break;
                    const avail = town.market.supply[strat.good] || 0;
                    const toBuy = Math.min(avail, Math.floor(treasury * 0.05 / Math.max(1, strat.price)));
                    if (toBuy <= 0) break;
                    const cost = toBuy * strat.price;
                    if (kingdom.gold < cost) break;
                    kingdom.gold -= cost;
                    town.market.supply[strat.good] -= toBuy;
                    // Store in military stockpile if military good, otherwise just remove from market (strategic reserve)
                    if (kingdom.militaryStockpile && kingdom.militaryStockpile[strat.good] !== undefined) {
                        kingdom.militaryStockpile[strat.good] += toBuy;
                    }
                    Engine.logHiddenEvent(`📦 ${kingdom.name} stockpiles ${toBuy} ${strat.good} from ${strat.townName} at low prices.`, {
                        type: 'economic_strategy', kingdomId: kingdom.id, cause: `${strat.good} priced below market value`,
                        effects: [`${toBuy} units purchased for ${cost}g`, 'Strategic reserves increased']
                    }, _eventKingdomCategory(kingdom.id));
                    actionsThisCycle++;
                    break;
                }
                case 'quota': {
                    kingdom.productionQuotas.push({
                        townId: strat.townId,
                        good: strat.good,
                        minPerSeason: strat.minPerSeason,
                        expiresDay: day + CONFIG.DAYS_PER_SEASON,
                    });
                    logEvent(`⚖️ ${kingdom.name} sets production quota for ${strat.good} in ${strat.townName}: minimum ${strat.minPerSeason} per season.`,  {
                        type: 'economic_strategy', cause: `Low prosperity in ${strat.townName} (${analysis.towns.find(t => t.id === strat.townId)?.prosperity || '?'}%)`,
                        effects: [`Towns failing quota lose ${CONFIG.KING_QUOTA_HAPPINESS_PENALTY || -5} happiness`, 'Workers pressured to produce more']
                    }, _eventKingdomCategory(kingdom.id));
                    actionsThisCycle++;
                    break;
                }
                case 'forced_labor': {
                    const town = findTown(strat.townId);
                    if (!town) break;
                    // Conscript idle for a kingdom building project
                    const neededBld = analysis.supplyChainGaps.find(g => g.type === 'missing_processor');
                    if (!neededBld) break;
                    const bt = findBuildingType(neededBld.building);
                    if (!bt) break;
                    const maxSlots = (CONFIG.TOWN_CATEGORIES[town.category] || {}).maxBuildingSlots || 10;
                    if (town.buildings.length >= maxSlots) break;
                    // Build at half cost but happiness penalty
                    const cost = Math.floor(bt.cost * 0.5);
                    if (kingdom.gold < cost) break;
                    kingdom.gold -= cost;
                    town.buildings.push({
                        type: bt.id, level: 1, ownerId: kingdom.id,
                        builtDay: day, condition: 'new', lastRepairDay: 0
                    });
                    town.happiness = Math.max(0, (town.happiness || 50) + (CONFIG.KING_FORCED_LABOR_HAPPINESS || -10));
                    logEvent(`⛓️ ${kingdom.name} conscripts laborers in ${strat.townName} to build a ${bt.name}!`,  {
                        type: 'economic_strategy', cause: 'Treasury too low for normal construction',
                        effects: [`${bt.name} built at half cost`, `Happiness in ${strat.townName} drops by ${Math.abs(CONFIG.KING_FORCED_LABOR_HAPPINESS || -10)}`]
                    }, _eventKingdomCategory(kingdom.id));
                    actionsThisCycle++;
                    break;
                }
                case 'asset_seizure': {
                    const town = findTown(strat.townId);
                    if (!town) break;
                    const bld = town.buildings.find(b => b.type === strat.buildingType && b.ownerId === strat.ownerId);
                    if (!bld) break;
                    const prevOwner = findPerson(strat.ownerId);
                    bld.ownerId = kingdom.id;
                    town.happiness = Math.max(0, (town.happiness || 50) - 15);
                    if (prevOwner) {
                        prevOwner.needs = prevOwner.needs || {};
                        prevOwner.needs.happiness = Math.max(0, (prevOwner.needs.happiness || 50) - 30);
                    }
                    const bt = findBuildingType(strat.buildingType);
                    logEvent(`👑 ${kingdom.name} seizes a ${bt ? bt.name : strat.buildingType} in ${strat.townName}!`,  {
                        type: 'economic_strategy', cause: 'Corrupt king confiscates underperforming business',
                        effects: ['Building transferred to kingdom ownership', `Happiness in ${strat.townName} drops sharply`, 'Former owner furious']
                    }, _eventKingdomCategory(kingdom.id));
                    actionsThisCycle++;
                    break;
                }
                case 'export_restriction': {
                    kingdom.exportRestrictions.push(strat.good);
                    const resInfo = findResourceById(strat.good);
                    const goodName = resInfo ? resInfo.name : strat.good;
                    logEvent(`🚫 ${kingdom.name} restricts export of ${goodName} to protect domestic supply!`,  {
                        type: 'economic_strategy', cause: `Severe ${goodName} shortage domestically`,
                        effects: [`${goodName} cannot be exported from ${kingdom.name}`, 'Domestic prices stabilize', 'Trade partners may be upset']
                    }, _eventKingdomCategory(kingdom.id));
                    actionsThisCycle++;
                    break;
                }
                case 'tariff_adjustment': {
                    // Clever kings adjust tariffs based on surpluses/deficits
                    if (!kingdom.laws) break;
                    const surplus = Object.entries(analysis.kingdomSupply)
                        .filter(([, v]) => v > analysis.totalPopulation * 3)
                        .map(([k]) => k);
                    // Lower tariffs on deficit goods (attract imports)
                    if (surplus.length > 0 && kingdom.laws.tradeTariff > 0.02) {
                        kingdom.laws.tradeTariff = Math.max(0.02, kingdom.laws.tradeTariff - 0.01);
                        logEvent(`📊 ${kingdom.name} lowers trade tariffs to attract imports of scarce goods.`,  {
                            type: 'economic_strategy', kingdomId: kingdom.id, cause: 'Market intelligence: goods needed from abroad',
                            effects: [`Tariffs reduced to ${Math.round(kingdom.laws.tradeTariff * 100)}%`]
                        }, _eventKingdomCategory(kingdom.id));
                    }
                    actionsThisCycle++;
                    break;
                }
            }
        }

        // Foolish kings occasionally do counterproductive things
        if (isDim && actionsThisCycle < maxActions && rng.chance(0.3)) {
            // Randomly ban a good that's already scarce
            const scarce = Object.entries(analysis.kingdomDemand)
                .filter(([resId, dem]) => (analysis.kingdomSupply[resId] || 0) < dem * 0.5)
                .map(([k]) => k);
            if (scarce.length > 0) {
                const bad = rng.pick(scarce);
                if (!kingdom.exportRestrictions.includes(bad)) {
                    kingdom.exportRestrictions.push(bad);
                    const resInfo = findResourceById(bad);
                    const goodName = resInfo ? resInfo.name : bad;
                    logEvent(`🤦 ${kingdom.name}'s foolish king restricts export of ${goodName} — which is already scarce!`, {
                        type: 'economic_strategy', kingdomId: kingdom.id, cause: 'Poor judgment by dim ruler',
                        effects: ['Already scarce goods become harder to get', 'Merchants frustrated']
                    }, _eventKingdomCategory(kingdom.id));
                }
            }
        }

        // Foolish kings: 20% chance to make a counterproductive decision
        if (p.intelligence === 'foolish' && rng.chance(0.2)) {
            var badAction = rng.randInt(0, 2);
            if (badAction === 0 && kingdom.happiness < 40) {
                // Raise taxes when happiness is already low
                kingdom.taxRate = Math.min(0.25, (kingdom.taxRate || 0.05) + 0.03);
                kingdom.lastTaxIncreaseDay = world.day;
                logEvent('\uD83E\uDD26 The foolish ruler of ' + kingdom.name + ' raises taxes despite widespread unhappiness!', {
                    type: 'bad_decision', kingdomId: kingdom.id, cause: 'Poor judgment',
                    effects: ['Tax rate increased to ' + Math.round(kingdom.taxRate * 100) + '%', 'Citizens grow more unhappy']
                }, _eventKingdomCategory(kingdom.id));
            } else if (badAction === 1) {
                // Subsidize a wrong good (pick a surplus good instead of a deficit good)
                var surplusGoods = Object.entries(analysis.kingdomSupply)
                    .filter(function(e) { return e[1] > (analysis.kingdomDemand[e[0]] || 0) * 2; })
                    .map(function(e) { return e[0]; });
                if (surplusGoods.length > 0 && kingdom.productionBounties.length < (CONFIG.KING_MAX_BOUNTIES || 5)) {
                    var wrongGood = rng.pick(surplusGoods);
                    var wrongTown = analysis.towns.length > 0 ? rng.pick(analysis.towns) : null;
                    if (wrongTown) {
                        kingdom.productionBounties.push({
                            good: wrongGood, townId: wrongTown.id,
                            reward: CONFIG.KING_BOUNTY_DEFAULT_REWARD || 50,
                            expiresDay: day + (CONFIG.KING_SUBSIDY_DURATION || 180),
                        });
                        var wrInfo = findResourceById(wrongGood);
                        logEvent('\uD83E\uDD26 ' + kingdom.name + ' offers bounties for ' + (wrInfo ? wrInfo.name : wrongGood) + ' — which is already in surplus!', {
                            type: 'bad_decision', kingdomId: kingdom.id, cause: 'Foolish ruler misreads the market',
                            effects: ['Gold wasted on unnecessary production']
                        }, _eventKingdomCategory(kingdom.id));
                    }
                }
            } else if (badAction === 2 && kingdom.laws) {
                // Raise tariffs when trade is needed
                kingdom.laws.tradeTariff = Math.min(0.20, (kingdom.laws.tradeTariff || 0.05) + 0.03);
                logEvent('\uD83E\uDD26 The dim ruler of ' + kingdom.name + ' raises trade tariffs, discouraging needed imports!', {
                    type: 'bad_decision', kingdomId: kingdom.id, cause: 'Poor economic understanding',
                    effects: ['Tariffs raised to ' + Math.round(kingdom.laws.tradeTariff * 100) + '%']
                }, _eventKingdomCategory(kingdom.id));
            }
        }
    }

    // ========================================================
    // §17G-B  TREASURY SPENDING AI — GOLD SINK SYSTEM
    // ========================================================
    // When kingdom treasuries grow large (>50K), AI kings aggressively spend
    // on recruitment, buildings, infrastructure, expansion, and war preparation.
    // Spending is personality-driven and creates organic price inflation.

    function tickTreasurySpending(k) {
        if (!world || !k || !k.territories) return;
        var rng = world.rng;
        var p = k.kingPersonality || {};
        var treasury = k.gold || 0;
        var startingGold = k._startingGold || 10000;

        // Skip player-king kingdoms (player manages spending manually)
        if (typeof Player !== 'undefined' && Player.state && Player.state.isKing && Player.state.kingState && Player.state.kingState.kingdomId === k.id) return;

        // Only activate when treasury is meaningfully large
        if (treasury < 20000) return;

        // Spending tiers — higher treasury = more aggressive spending
        var spendingPressure = 0; // 0-1 scale
        if (treasury >= 200000) spendingPressure = 1.0;
        else if (treasury >= 150000) spendingPressure = 0.85;
        else if (treasury >= 100000) spendingPressure = 0.65;
        else if (treasury >= 75000) spendingPressure = 0.45;
        else if (treasury >= 50000) spendingPressure = 0.3;
        else if (treasury >= 30000) spendingPressure = 0.18;
        else spendingPressure = 0.1;

        // Personality modifiers to spending eagerness
        var spendMod = 1.0;
        if (p.ambition === 'ambitious') spendMod += 0.3;
        else if (p.ambition === 'lazy') spendMod -= 0.4;
        if (p.greed === 'generous') spendMod += 0.2;
        else if (p.greed === 'greedy') spendMod -= 0.3;
        else if (p.greed === 'corrupt') spendMod -= 0.15; // corrupt hoard but also embezzle
        if (p.intelligence === 'brilliant') spendMod += 0.15;
        else if (p.intelligence === 'foolish') spendMod -= 0.2;
        if (p.courage === 'brave') spendMod += 0.1;

        var effectivePressure = Math.max(0.05, Math.min(1.0, spendingPressure * spendMod));

        // How much to spend this tick (percentage of treasury above reserve)
        var fs = Engine.getKingdomFinancialState(k);
        var reserveFloor = Math.max(fs.minReserve, 5000);
        var spendableGold = Math.max(0, treasury - reserveFloor);
        if (spendableGold < 500) return;

        // Budget per category — personality determines allocation
        var militaryWeight = 0.25, buildingWeight = 0.25, infraWeight = 0.2, expansionWeight = 0.15, warWeight = 0.15;
        if (p.militarism === 'warlike' || p.militarism === 'aggressive') {
            militaryWeight = 0.40; warWeight = 0.25; buildingWeight = 0.15; infraWeight = 0.10; expansionWeight = 0.10;
        } else if (p.militarism === 'defensive') {
            militaryWeight = 0.20; warWeight = 0.05; buildingWeight = 0.30; infraWeight = 0.25; expansionWeight = 0.20;
        }
        if (p.ambition === 'ambitious') { expansionWeight += 0.10; buildingWeight -= 0.05; infraWeight -= 0.05; }
        if (p.greed === 'corrupt') { militaryWeight += 0.1; buildingWeight -= 0.1; } // corrupt kings build armies
        if (p.intelligence === 'brilliant' || p.intelligence === 'clever') { infraWeight += 0.05; buildingWeight += 0.05; militaryWeight -= 0.05; warWeight -= 0.05; }

        // Normalize weights
        var totalWeight = militaryWeight + buildingWeight + infraWeight + expansionWeight + warWeight;
        militaryWeight /= totalWeight; buildingWeight /= totalWeight; infraWeight /= totalWeight; expansionWeight /= totalWeight; warWeight /= totalWeight;

        // Daily spending cap: spend 3-12% of spendable gold per tick based on pressure
        var dailyBudget = Math.floor(spendableGold * effectivePressure * rng.randFloat(0.03, 0.12));
        dailyBudget = Math.min(dailyBudget, Math.floor(treasury * 0.05)); // never more than 5% of total treasury per day
        if (dailyBudget < 30) return;

        var spent = 0;
        var territories = Array.from(k.territories);
        var atWar = k.atWar && k.atWar.size > 0;

        // Track spending for price inflation (monthly) and cumulative totals
        if (!k._treasurySpending) k._treasurySpending = { total: 0, military: 0, buildings: 0, infra: 0, lastDay: 0 };
        if (!k._treasurySpendingTotal) k._treasurySpendingTotal = { total: 0, military: 0, buildings: 0, infra: 0 };
        if (world.day - k._treasurySpending.lastDay > 30) {
            // Reset monthly tracking
            k._treasurySpending = { total: 0, military: 0, buildings: 0, infra: 0, lastDay: world.day };
        }

        // Each category can access up to 2.5x its weight share of the budget, capped by remaining
        // This allows meaningful purchases (buildings cost 300-2000g)
        var catBudget = function(weight) { return Math.min(Math.floor(dailyBudget * weight * 2.5), dailyBudget - spent); };

        // ═══════════════════════════════════════════
        // 1. MILITARY SPENDING — Recruitment & Equipment
        // ═══════════════════════════════════════════
        var milBudget = catBudget(militaryWeight);
        if (milBudget > 30 && rng.chance(0.4 + effectivePressure * 0.4)) {
            var targetGarrison = 15 + Math.floor(effectivePressure * 25); // 15-40 per town
            if (atWar) targetGarrison = Math.floor(targetGarrison * 1.5);
            if (p.militarism === 'warlike') targetGarrison = Math.floor(targetGarrison * 1.3);

            // Recruit soldiers in understaffed towns
            var milSpent = 0;
            var recruitCost = CONFIG.SOLDIER_RECRUIT_COST || 50;
            for (var mi = 0; mi < territories.length && milSpent < milBudget; mi++) {
                var mTown = findTown(territories[mi]);
                if (!mTown || mTown.isWilderness) continue;
                var garrison = mTown.garrison || 0;
                if (garrison >= targetGarrison) continue;
                var toRecruit = Math.min(
                    Math.floor((milBudget - milSpent) / recruitCost),
                    targetGarrison - garrison,
                    5 // max 5 per town per tick
                );
                if (toRecruit <= 0) continue;

                // Find eligible people
                var townPeople = getPeopleInTown(mTown.id);
                var recruited = 0;
                for (var ri = 0; ri < townPeople.length && recruited < toRecruit; ri++) {
                    var rPerson = townPeople[ri];
                    if (!rPerson.alive || rPerson.age < (CONFIG.COMING_OF_AGE || 16) || rPerson.age > 50) continue;
                    if (rPerson.occupation !== 'laborer' && rPerson.occupation !== 'none') continue;

                    var uType = 'infantry';
                    var sup = mTown.market.supply || {};
                    if ((sup.horses || 0) > 0 && (sup.saddles || 0) > 0 && rng.chance(0.15)) uType = 'cavalry';
                    else if ((sup.bows || 0) > 0 && rng.chance(0.25)) uType = 'archer';

                    recruitSoldier(rPerson, mTown, k, uType);
                    k.gold -= recruitCost;
                    milSpent += recruitCost;
                    recruited++;
                }
            }

            // Buy military equipment from markets
            var equipBudget = Math.min(milBudget - milSpent, Math.floor(milBudget * 0.4));
            if (equipBudget > 20) {
                var milGoods = ['swords', 'armor', 'bows', 'arrows', 'shields'];
                if (p.intelligence === 'brilliant' || p.intelligence === 'clever') {
                    milGoods = milGoods.concat(['swords_good', 'armor_good', 'bows_good']);
                }
                for (var eti = 0; eti < territories.length && equipBudget > 10; eti++) {
                    var eTown = findTown(territories[eti]);
                    if (!eTown || !eTown.market || !eTown.market.supply) continue;
                    for (var egi = 0; egi < milGoods.length && equipBudget > 5; egi++) {
                        var eGood = milGoods[egi];
                        var eAvail = eTown.market.supply[eGood] || 0;
                        if (eAvail <= 1) continue;
                        var ePrice = getMarketPrice(eTown, eGood) || 20;
                        var eToBuy = Math.min(Math.floor(equipBudget / ePrice), eAvail - 1, 5);
                        if (eToBuy <= 0) continue;
                        var eCost = eToBuy * ePrice;
                        eTown.market.supply[eGood] -= eToBuy;
                        eTown.market.demand[eGood] = (eTown.market.demand[eGood] || 0) + eToBuy;
                        k.gold -= eCost;
                        if (!k.militaryStockpile) k.militaryStockpile = {};
                        k.militaryStockpile[eGood] = (k.militaryStockpile[eGood] || 0) + eToBuy;
                        equipBudget -= eCost;
                        milSpent += eCost;
                    }
                }
            }
            spent += milSpent;
            k._treasurySpending.military += milSpent;
            k._treasurySpendingTotal.military += milSpent;
        }

        // ═══════════════════════════════════════════
        // 2. BUILDING CONSTRUCTION — Economy & Defense
        // ═══════════════════════════════════════════
        var bldBudget = catBudget(buildingWeight);
        if (bldBudget > 50 && rng.chance(0.25 + effectivePressure * 0.35)) {
            var bldSpent = 0;
            // Prioritize: wells/medical > economic buildings > defensive buildings
            var buildPriorities = [];
            var smartKing = p.intelligence === 'brilliant' || p.intelligence === 'clever';
            var lowWaterTownCount = 0;
            for (var lwti = 0; lwti < territories.length; lwti++) {
                var lwTown = findTown(territories[lwti]);
                if (!lwTown || !lwTown.market || !lwTown.market.supply) continue;
                if ((lwTown.market.supply.water || 0) < 50) lowWaterTownCount++;
            }
            for (var bti = 0; bti < territories.length; bti++) {
                var bTown = findTown(territories[bti]);
                if (!bTown) continue;
                var bBuildings = bTown.buildings || [];
                var maxSlots = (CONFIG.TOWN_CATEGORIES[bTown.category] || {}).maxBuildingSlots || 10;
                if (bBuildings.length >= maxSlots) continue;
                var hasTypes = {};
                var wellCount = 0;
                for (var bhi = 0; bhi < bBuildings.length; bhi++) {
                    var bType = bBuildings[bhi].type;
                    hasTypes[bType] = true;
                    if (bType === 'well') wellCount++;
                }

                var townPop = bTown.population || 0;
                var waterSupply = (bTown.market && bTown.market.supply) ? (bTown.market.supply.water || 0) : 0;
                var lowWater = waterSupply < 50;
                var proactiveWellNeed = (wellCount * 125) < (townPop * 1.2);
                if (lowWater || proactiveWellNeed) {
                    var wellShortage = Math.max(0, Math.ceil((townPop * 1.2) / 125) - wellCount);
                    var waterPriority = lowWater ? 125 : (smartKing ? 105 : 92);
                    if (waterSupply <= 0) waterPriority += 20;
                    else if (waterSupply < 20) waterPriority += 12;
                    if (proactiveWellNeed) waterPriority += smartKing ? 15 : 8;
                    if (wellCount === 0) waterPriority += 12;
                    if (wellShortage > 1) waterPriority += Math.min(18, wellShortage * 6);
                    if (lowWater && lowWaterTownCount > 1) waterPriority += 8 + Math.min(12, (lowWaterTownCount - 1) * 4);
                    buildPriorities.push({ town: bTown, type: 'well', priority: waterPriority });
                }

                // Medical buildings — high priority if population > 100
                if (townPop > 100 && !hasTypes['clinic'] && !hasTypes['hospital']) {
                    buildPriorities.push({ town: bTown, type: 'clinic', priority: 100 });
                }
                if ((bTown.population || 0) > 300 && hasTypes['clinic'] && !hasTypes['hospital']) {
                    buildPriorities.push({ town: bTown, type: 'hospital', priority: 90 });
                }

                // Defensive buildings — barracks, watchtower, walls
                if (!hasTypes['barracks'] && (bTown.population || 0) > 80) {
                    buildPriorities.push({ town: bTown, type: 'barracks', priority: 70 });
                }

                // Economic buildings based on culture
                var culture = k.culture || 'balanced';
                var econBuildings = [];
                if (culture === 'military') econBuildings = ['blacksmith', 'armorer', 'fletcher', 'smelter'];
                else if (culture === 'mercantile') econBuildings = ['warehouse', 'tailor', 'market_stall', 'jeweler'];
                else if (culture === 'industrial') econBuildings = ['brick_kiln', 'toolsmith', 'smelter', 'sawmill'];
                else if (culture === 'agricultural') econBuildings = ['smokehouse', 'pasture', 'pig_farm', 'bakery'];
                else econBuildings = ['bakery', 'blacksmith', 'sawmill', 'smelter', 'warehouse'];

                for (var ebi = 0; ebi < econBuildings.length; ebi++) {
                    if (!hasTypes[econBuildings[ebi]]) {
                        buildPriorities.push({ town: bTown, type: econBuildings[ebi], priority: 50 + ebi });
                    }
                }
            }

            // Sort by priority descending
            buildPriorities.sort(function(a, b) { return b.priority - a.priority; });

            // Try to build top priorities
            for (var bpi = 0; bpi < buildPriorities.length && bldSpent < bldBudget; bpi++) {
                var bp = buildPriorities[bpi];
                var bt = findBuildingType(bp.type);
                if (!bt) continue;
                var bCost = (bt.cost || 0);
                if (bCost > bldBudget - bldSpent) continue;
                if (bCost > k.gold * 0.15) continue; // don't spend >15% on one building
                if (kingdomBuild(k, bp.town, bp.type, rng)) {
                    bldSpent += bCost;
                    logEvent('🏗️ ' + k.name + ' invests treasury surplus into a ' + (bt.name || bp.type) + ' in ' + bp.town.name + '.', {
                        type: 'treasury_spending', townId: bp.town.id, kingdomId: k.id, _noToast: true,
                        cause: 'Large treasury drives kingdom investment',
                        effects: ['New ' + (bt.name || bp.type) + ' in ' + bp.town.name, 'Treasury -' + bCost + 'g']
                    }, _eventKingdomCategory(k.id));
                }
            }
            spent += bldSpent;
            k._treasurySpending.buildings += bldSpent;
            k._treasurySpendingTotal.buildings += bldSpent;
        }

        // ═══════════════════════════════════════════
        // 3. INFRASTRUCTURE — Roads, Docks, Ships, Walls
        // ═══════════════════════════════════════════
        var infraBudget = catBudget(infraWeight);
        if (infraBudget > 50 && rng.chance(0.2 + effectivePressure * 0.3)) {
            var infraSpent = 0;

            // 3a. Road quality upgrades
            if (rng.chance(0.4)) {
                var kRoads = world.roads.filter(function(r) {
                    var ft = findTown(r.fromTownId);
                    return ft && ft.kingdomId === k.id && r.quality < 3;
                });
                var upgradeCount = Math.min(kRoads.length, Math.floor(effectivePressure * 3) + 1);
                for (var rui = 0; rui < upgradeCount && infraSpent < infraBudget; rui++) {
                    var road = rng.pick(kRoads);
                    var roadCost = 150 + (road.quality * 100); // escalating cost
                    if (roadCost <= infraBudget - infraSpent && k.gold >= roadCost) {
                        road.quality++;
                        k.gold -= roadCost;
                        infraSpent += roadCost;
                    }
                }
            }

            // 3b. Build docks at coastal towns without them
            if (rng.chance(0.3)) {
                for (var dti = 0; dti < territories.length && infraSpent < infraBudget; dti++) {
                    var dTown = findTown(territories[dti]);
                    if (!dTown || dTown.isPort) continue;
                    // v9p33river138/139: authoritative water-proximity check.
                    // Must be OCEAN (connected to map edge) within
                    // PORT_WATER_PROXIMITY tiles — lakes/ponds don't qualify.
                    var isCoastal = (typeof Engine !== 'undefined' && Engine.townHasOceanNearby) ? Engine.townHasOceanNearby(dTown) : false;
                    if (!isCoastal) continue;
                    var dockCost = 500;
                    if (dockCost <= infraBudget - infraSpent && k.gold >= dockCost) {
                        dTown.isPort = true;
                        if (!dTown.buildings.some(function(b) { return b.type === 'dock'; })) {
                            dTown.buildings.push({ type: 'dock', level: 1, ownerId: null, builtDay: world.day, condition: 'new', lastRepairDay: 0 });
                        }
                        k.gold -= dockCost;
                        infraSpent += dockCost;
                        logEvent('⚓ ' + k.name + ' builds a dock at ' + dTown.name + ', opening it for sea trade!',  {
                            type: 'treasury_spending', kingdomId: k.id,
                            effects: [dTown.name + ' is now a port town', 'Treasury -' + dockCost + 'g']
                        }, _eventKingdomCategory(k.id));
                    }
                }
            }

            // 3c. Commission trading ships at ports
            if (rng.chance(0.2) && infraSpent < infraBudget) {
                for (var sti = 0; sti < territories.length && infraSpent < infraBudget; sti++) {
                    var sTown = findTown(territories[sti]);
                    if (!sTown || !sTown.isPort) continue;
                    var shipCost = 800 + Math.floor(rng.random() * 400); // 800-1200g for a trading ship
                    if (shipCost <= infraBudget - infraSpent && k.gold >= shipCost) {
                        if (!k._tradingShips) k._tradingShips = 0;
                        if (k._tradingShips < 5 + territories.length) {
                            k._tradingShips++;
                            k.gold -= shipCost;
                            infraSpent += shipCost;
                            logEvent('⛵ ' + k.name + ' commissions a new trading ship at ' + sTown.name + '!',  {
                                type: 'treasury_spending', kingdomId: k.id,
                                effects: ['Kingdom fleet +1 trading ship', 'Treasury -' + shipCost + 'g']
                            }, _eventKingdomCategory(k.id));
                        }
                    }
                }
            }

            // 3d. Wall upgrades for towns
            if (rng.chance(0.25) && infraSpent < infraBudget) {
                for (var wti = 0; wti < territories.length && infraSpent < infraBudget; wti++) {
                    var wTown = findTown(territories[wti]);
                    if (!wTown) continue;
                    var wallLevel = wTown.wallLevel || 0;
                    if (wallLevel >= 3) continue;
                    var wallCost = 300 + wallLevel * 500; // escalating
                    if (wallCost <= infraBudget - infraSpent && k.gold >= wallCost) {
                        wTown.wallLevel = wallLevel + 1;
                        k.gold -= wallCost;
                        infraSpent += wallCost;
                        logEvent('🧱 ' + k.name + ' upgrades walls in ' + wTown.name + ' to level ' + wTown.wallLevel + '!',  {
                            type: 'treasury_spending', kingdomId: k.id,
                            effects: ['Town defense improved', 'Treasury -' + wallCost + 'g']
                        }, _eventKingdomCategory(k.id));
                    }
                }
            }

            spent += infraSpent;
            k._treasurySpending.infra += infraSpent;
            k._treasurySpendingTotal.infra += infraSpent;
        }

        // ═══════════════════════════════════════════
        // 4. EXPANSION — Outpost→Village, New Territory Claims
        // ═══════════════════════════════════════════
        var expBudget = catBudget(expansionWeight);
        if (expBudget > 100 && rng.chance(0.12 + effectivePressure * 0.2)) {
            var expSpent = 0;

            // 4a. Boost small towns — invest in prosperity to help them grow
            for (var xti = 0; xti < territories.length && expSpent < expBudget; xti++) {
                var xTown = findTown(territories[xti]);
                if (!xTown) continue;
                // Invest in towns with low prosperity to boost them
                if ((xTown.prosperity || 50) < 60 && (xTown.population || 0) > 20) {
                    var investCost = 200 + Math.floor(rng.random() * 300);
                    if (investCost <= expBudget - expSpent && k.gold >= investCost) {
                        xTown.prosperity = Math.min(100, (xTown.prosperity || 50) + rng.randInt(3, 8));
                        xTown.happiness = Math.min(100, (xTown.happiness || 50) + 2);
                        k.gold -= investCost;
                        expSpent += investCost;
                        // Distribute some gold as wages to townsfolk
                        distributeConstructionWages(xTown.id, investCost, rng);
                        logEvent('💰 ' + k.name + ' invests ' + investCost + 'g in ' + xTown.name + ' development!',  {
                            type: 'treasury_spending', kingdomId: k.id,
                            effects: ['Prosperity boosted in ' + xTown.name, 'Treasury -' + investCost + 'g']
                        }, _eventKingdomCategory(k.id));
                    }
                }
            }

            // 4b. Immigration incentives for underpopulated towns
            if (expSpent < expBudget && rng.chance(0.3)) {
                for (var iti = 0; iti < territories.length && expSpent < expBudget; iti++) {
                    var iTown = findTown(territories[iti]);
                    if (!iTown) continue;
                    var popCap = ((CONFIG.TOWN_CATEGORIES[iTown.category] || {}).popCap) || (CONFIG.TOWN_POP_CAPS ? CONFIG.TOWN_POP_CAPS[iTown.category] : 200) || 200;
                    if ((iTown.population || 0) < popCap * 0.5) {
                        var immCost = 150;
                        if (immCost <= expBudget - expSpent && k.gold >= immCost) {
                            // Attract 1-3 settlers
                            var settlers = rng.randInt(1, 3);
                            iTown.population = Math.min(popCap, (iTown.population || 0) + settlers);
                            k.gold -= immCost;
                            expSpent += immCost;
                        }
                    }
                }
            }

            spent += expSpent;
        }

        // ═══════════════════════════════════════════
        // 5. WAR PREPARATION — Stockpiling & Aggression
        // ═══════════════════════════════════════════
        var warBudget = catBudget(warWeight);
        if (warBudget > 100) {
            // If at war: boost recruitment and offensive spending
            if (atWar && rng.chance(0.4 + effectivePressure * 0.3)) {
                // Extra wartime recruitment — big treasury means bigger armies
                var warRecruit = Math.min(Math.floor(warBudget / (CONFIG.SOLDIER_RECRUIT_COST || 50)), 5);
                var warRecruited = 0;
                for (var wri = 0; wri < territories.length && warRecruited < warRecruit; wri++) {
                    var wrTown = findTown(territories[wri]);
                    if (!wrTown || wrTown.isWilderness) continue;
                    var wrPeople = getPeopleInTown(wrTown.id);
                    for (var wrpi = 0; wrpi < wrPeople.length && warRecruited < warRecruit; wrpi++) {
                        var wrP = wrPeople[wrpi];
                        if (!wrP.alive || wrP.age < (CONFIG.COMING_OF_AGE || 16) || wrP.age > 50) continue;
                        if (wrP.occupation !== 'laborer' && wrP.occupation !== 'none') continue;
                        recruitSoldier(wrP, wrTown, k, 'infantry');
                        k.gold -= (CONFIG.SOLDIER_RECRUIT_COST || 50);
                        warRecruited++;
                    }
                }
                spent += warRecruited * (CONFIG.SOLDIER_RECRUIT_COST || 50);
            }

            // If NOT at war but treasury huge: evaluate war opportunity
            if (!atWar && treasury > 100000 && rng.chance(0.02 + effectivePressure * 0.04)) {
                // Wealthy kingdoms with aggressive/ambitious kings look for targets
                if (p.militarism === 'warlike' || p.militarism === 'aggressive' || p.ambition === 'ambitious') {
                    // Flag for war evaluation — boost war eagerness
                    if (!k._warEagerness) k._warEagerness = 0;
                    k._warEagerness = Math.min(50, (k._warEagerness || 0) + rng.randInt(2, 8));
                }
            }
        }

        // ═══════════════════════════════════════════
        // 6. NOBLE REACTIONS TO SPENDING
        // ═══════════════════════════════════════════
        if (spent > 500 && rng.chance(0.2)) {
            var nobles = Engine.getNoblesInKingdom(k.id);
            for (var ni = 0; ni < nobles.length; ni++) {
                var noble = nobles[ni];
                var nPers = noble.personality || {};
                var loyaltyDelta = 0;
                var relDelta = 0;

                // Military nobles like military spending
                if (k._treasurySpending.military > spent * 0.3) {
                    if ((nPers.courage || 50) > 60 || (nPers.ambition || 50) > 65) {
                        loyaltyDelta += rng.randFloat(0.5, 1.5);
                        relDelta += rng.randFloat(0.3, 1.0);
                    } else if ((nPers.warmth || 50) > 70) {
                        // Peacenik nobles dislike heavy military spending
                        loyaltyDelta -= rng.randFloat(0.3, 0.8);
                    }
                }

                // Infrastructure/building spending is generally liked
                if (k._treasurySpending.buildings + k._treasurySpending.infra > spent * 0.4) {
                    loyaltyDelta += rng.randFloat(0.3, 1.0);
                    if ((nPers.intelligence || 50) > 60) relDelta += rng.randFloat(0.2, 0.8);
                }

                // Very high spending when kingdom is poor → disapproval
                if (spent > treasury * 0.05 && (fs.lastSeasonRevenue || 0) < spent * 3) {
                    if ((nPers.intelligence || 50) > 55) {
                        loyaltyDelta -= rng.randFloat(0.5, 1.5);
                        relDelta -= rng.randFloat(0.3, 1.0);
                    }
                }

                // Apply
                if (loyaltyDelta !== 0 && noble.kingLoyalty !== undefined) {
                    noble.kingLoyalty = Math.max(0, Math.min(100, noble.kingLoyalty + loyaltyDelta));
                }
                if (relDelta !== 0) {
                    var kingPerson = k.king ? findPerson(k.king) : null;
                    if (kingPerson && noble.relationships) {
                        noble.relationships[kingPerson.id] = Math.max(-100, Math.min(100, (noble.relationships[kingPerson.id] || 0) + relDelta));
                    }
                }
            }
        }

        // ═══════════════════════════════════════════
        // 7. PRICE INFLATION FROM SPENDING
        // ═══════════════════════════════════════════
        k._treasurySpending.total += spent;
        k._treasurySpendingTotal.total += spent;

        // Kingdom spending drives up prices in kingdom towns (demand pressure)
        if (spent > 500) {
            var inflationFactor = Math.min(0.03, spent / (treasury + 1) * 0.5); // 0-3% price bump
            for (var ifti = 0; ifti < territories.length; ifti++) {
                var ifTown = findTown(territories[ifti]);
                if (!ifTown || !ifTown.market || !ifTown.market.prices) continue;
                // Bump demand on goods the kingdom bought
                for (var ifKey in ifTown.market.prices) {
                    var currentPrice = ifTown.market.prices[ifKey];
                    if (!currentPrice || currentPrice <= 0) continue;
                    // Small organic price increase from increased gold in circulation
                    var bump = currentPrice * inflationFactor * rng.randFloat(0.3, 1.0);
                    if (bump > 0.01) {
                        var resInfo = findResourceById(ifKey);
                        var basePrice = resInfo ? resInfo.basePrice : 10;
                        var ceiling = basePrice * (CONFIG.PRICE_CEILING_MULT || 6.0);
                        ifTown.market.prices[ifKey] = Math.min(ceiling, currentPrice + bump);
                    }
                }
            }
        }

        // Log major spending events
        if (spent > 1000) {
            var spendingType = 'balanced';
            if (k._treasurySpending.military > spent * 0.5) spendingType = 'military';
            else if (k._treasurySpending.buildings > spent * 0.4) spendingType = 'construction';
            else if (k._treasurySpending.infra > spent * 0.3) spendingType = 'infrastructure';
            logEvent('💎 ' + k.name + ' spends ' + Math.floor(spent) + 'g from its overflowing treasury on ' + spendingType + ' investments.',  {
                type: 'treasury_spending', kingdomId: k.id,
                cause: 'Kingdom treasury of ' + Math.floor(treasury) + 'g drives aggressive investment',
                effects: ['Military: ' + Math.floor(k._treasurySpending.military) + 'g', 'Buildings: ' + Math.floor(k._treasurySpending.buildings) + 'g', 'Infrastructure: ' + Math.floor(k._treasurySpending.infra) + 'g']
            }, _eventKingdomCategory(k.id));
        }
    }

    // ========================================================
    // §17G-C  RELATIONSHIP-LOYALTY MONTHLY LINK
    // ========================================================
    // Noble relationship with king slightly affects loyalty each month

    function tickNobleRelationshipLoyaltyLink(k) {
        if (!world || !k) return;
        // Run monthly
        if (world.day % 30 !== 0) return;

        var kingPerson = k.king ? findPerson(k.king) : null;
        if (!kingPerson) return;

        var nobles = Engine.getNoblesInKingdom(k.id);

        for (var ni = 0; ni < nobles.length; ni++) {
            var noble = nobles[ni];
            if (noble.kingLoyalty === undefined) continue;

            var rel = (noble.relationships && noble.relationships[kingPerson.id]) || 0;
            var loyaltyShift = 0;

            // Good relationship → slight loyalty gain
            if (rel > 50) loyaltyShift = Math.min(1.0, (rel - 50) / 50 * 1.0); // +0 to +1.0
            else if (rel > 20) loyaltyShift = (rel - 20) / 60 * 0.3; // +0 to +0.3
            else if (rel < -20) loyaltyShift = Math.max(-1.5, (rel + 20) / 40 * -1.5); // -0 to -1.5
            else if (rel < 0) loyaltyShift = rel / 40 * -0.5; // -0 to -0.5

            if (loyaltyShift !== 0) {
                noble.kingLoyalty = Math.max(0, Math.min(100, noble.kingLoyalty + loyaltyShift));
            }
        }
    }

    // ========================================================
    // §17G-D  INTER-KINGDOM TRADE DEALS
    // ========================================================
    // Kingdoms propose trade deals: gold for goods, goods for goods

    function tickInterKingdomTrade(k) {
        if (!world || !k) return;
        var rng = world.rng;
        var p = k.kingPersonality || {};

        // Only trade every 30-60 days
        if (!k._lastTradeDealDay) k._lastTradeDealDay = 0;
        var tradeInterval = 30;
        if (p.intelligence === 'brilliant') tradeInterval = 20;
        else if (p.intelligence === 'foolish') tradeInterval = 60;
        if (world.day - k._lastTradeDealDay < tradeInterval) return;
        k._lastTradeDealDay = world.day;

        // Don't trade if broke
        if ((k.gold || 0) < 2000) return;

        // Skip player-king
        if (typeof Player !== 'undefined' && Player.state && Player.state.isKing && Player.state.kingState && Player.state.kingState.kingdomId === k.id) return;

        // Find goods we need but don't have
        var analysis = analyzeKingdomEconomy(k);
        if (!analysis) return;

        var neededGoods = [];
        for (var di = 0; di < analysis.towns.length; di++) {
            for (var dfi = 0; dfi < analysis.towns[di].deficits.length; dfi++) {
                var def = analysis.towns[di].deficits[dfi];
                if (!neededGoods.some(function(n) { return n.good === def.good; })) {
                    neededGoods.push({ good: def.good, shortfall: def.shortfall });
                }
            }
        }
        if (neededGoods.length === 0) return;

        // Find potential trading partners (not at war, relations > -20)
        for (var ki = 0; ki < world.kingdoms.length; ki++) {
            var other = world.kingdoms[ki];
            if (other.id === k.id || !other.territories || other.territories.size === 0) continue;
            if (k.atWar && k.atWar.has(other.id)) continue;
            var rel = (k.relations && k.relations[other.id]) || 0;
            if (rel < -20) continue;

            // Check if they have surplus of what we need
            var otherAnalysis = analyzeKingdomEconomy(other);
            if (!otherAnalysis) continue;

            for (var ngi = 0; ngi < neededGoods.length; ngi++) {
                var need = neededGoods[ngi];
                var otherSupply = otherAnalysis.kingdomSupply[need.good] || 0;
                var otherDemand = otherAnalysis.kingdomDemand[need.good] || 0;
                if (otherSupply <= otherDemand * 1.5) continue; // they don't have surplus

                // Calculate trade: buy from their cheapest town
                var tradeTown = null;
                var tradePrice = Infinity;
                for (var oti = 0; oti < otherAnalysis.towns.length; oti++) {
                    var oTown = findTown(otherAnalysis.towns[oti].id);
                    if (!oTown || !oTown.market || !oTown.market.supply) continue;
                    if ((oTown.market.supply[need.good] || 0) < 3) continue;
                    var oPrice = getMarketPrice(oTown, need.good) || 10;
                    if (oPrice < tradePrice) {
                        tradeTown = oTown;
                        tradePrice = oPrice;
                    }
                }
                if (!tradeTown) continue;

                // Markup for inter-kingdom trade: 1.3x-1.8x based on relations
                var markup = 1.8 - (Math.max(0, rel) / 100) * 0.5; // 1.3 at rel=100, 1.8 at rel=0
                var finalPrice = Math.ceil(tradePrice * markup);
                var buyQty = Math.min(
                    Math.floor(k.gold * 0.02 / finalPrice), // max 2% of treasury per deal
                    Math.floor((tradeTown.market.supply[need.good] || 0) * 0.3), // max 30% of their supply
                    10 // max 10 units per deal
                );
                if (buyQty <= 0) continue;

                var totalCost = buyQty * finalPrice;
                if (totalCost > k.gold * 0.05) continue; // don't overspend

                // Execute trade
                tradeTown.market.supply[need.good] -= buyQty;
                tradeTown.market.demand[need.good] = (tradeTown.market.demand[need.good] || 0) + buyQty;
                k.gold -= totalCost;
                other.gold += totalCost;

                // Add to our stockpile or distribute to our market
                var ourCapital = null;
                for (var octi = 0; octi < Array.from(k.territories).length; octi++) {
                    var _oct = findTown(Array.from(k.territories)[octi]);
                    if (_oct && _oct.isCapital) { ourCapital = _oct; break; }
                }
                if (ourCapital && ourCapital.market && ourCapital.market.supply) {
                    ourCapital.market.supply[need.good] = (ourCapital.market.supply[need.good] || 0) + buyQty;
                } else if (!k.goodsStockpile) {
                    k.goodsStockpile = {};
                    k.goodsStockpile[need.good] = (k.goodsStockpile[need.good] || 0) + buyQty;
                } else {
                    k.goodsStockpile[need.good] = (k.goodsStockpile[need.good] || 0) + buyQty;
                }

                // Improve relations slightly from trade
                if (k.relations) {
                    k.relations[other.id] = (k.relations[other.id] || 0) + rng.randFloat(0.5, 2.0);
                    other.relations[k.id] = (other.relations[k.id] || 0) + rng.randFloat(0.3, 1.5);
                }

                var resInfo = findResourceById(need.good);
                var goodName = resInfo ? resInfo.name : need.good;
                logEvent('🤝 ' + k.name + ' purchases ' + buyQty + ' ' + goodName + ' from ' + other.name + ' for ' + totalCost + 'g.',  {
                    type: 'trade_deal', kingdomId: k.id,
                    cause: 'Inter-kingdom trade agreement for needed goods',
                    effects: [k.name + ' -' + totalCost + 'g', other.name + ' +' + totalCost + 'g', buyQty + ' ' + goodName + ' transferred']
                }, _eventEitherKingdomCategory(k.id, other.id));

                // Only one deal per tick
                return;
            }
        }
    }

    // ========================================================
    // §17G-E  REVOLT KINGDOM SURVIVAL AI
    // ========================================================
    function _tickRevoltSurvivalAI(k) {
        if (!world || !k) return;
        var rng = world.rng;
        var p = k.kingPersonality || {};
        var atWar = k.atWar && k.atWar.size > 0;
        var territories = Array.from(k.territories);
        var daysSinceRevolt = world.day - (k._revoltCreatedDay || world.day);

        // 1. Prioritize military defense — recruit all eligible laborers
        if (atWar) {
            var recruitCost = CONFIG.SOLDIER_RECRUIT_COST || 50;
            for (var ti = 0; ti < territories.length; ti++) {
                var town = findTown(territories[ti]);
                if (!town) continue;
                var people = getPeopleInTown(town.id);
                for (var pi = 0; pi < people.length; pi++) {
                    var person = people[pi];
                    if (!person.alive || person.age < 16 || person.age > 50) continue;
                    if (person.occupation !== 'laborer' && person.occupation !== 'none') continue;
                    if (k.gold < recruitCost * 2) break; // keep minimum reserve
                    recruitSoldier(person, town, k, 'infantry');
                    k.gold -= recruitCost;
                }
            }
        }

        // 2. Try to sue for peace — based on personality
        // v9p33river305: kingPersonality has no `diplomatic` field. Use
        // militarism/temperament instead (passive militarism + kind/fair
        // temperament = diplomatic king).
        if (atWar && daysSinceRevolt > 10) {
            var _isDiplomatic = p.militarism === 'passive' || p.temperament === 'kind' || p.temperament === 'fair';
            var courage = p.courage || 'cautious';
            k.atWar.forEach(function(enemyId) {
                var enemy = findKingdom(enemyId);
                if (!enemy) return;
                var ourStr = computeMilitaryStrength(k);
                var theirStr = computeMilitaryStrength(enemy);
                var peaceDesire = 0;
                // Weaker kingdoms want peace more
                if (ourStr < theirStr * 0.5) peaceDesire += 0.4;
                else if (ourStr < theirStr * 0.8) peaceDesire += 0.2;
                // Diplomatic kings seek peace sooner
                if (_isDiplomatic) peaceDesire += 0.2;
                // Brave/ambitious kings fight longer
                if (courage === 'brave' || p.ambition === 'ambitious') peaceDesire -= 0.15;
                // Low treasury pushes for peace
                if (k.gold < 200) peaceDesire += 0.3;

                if (peaceDesire > 0 && rng.chance(peaceDesire * 0.2)) {
                    // Attempt peace offer — enemy may refuse if much stronger
                    var acceptChance = 0.1;
                    if (theirStr < ourStr * 1.5) acceptChance += 0.2; // they're not much stronger, willing to stop
                    var ep = enemy.kingPersonality || {};
                    if (ep.temperament === 'fair' || ep.justice === 'just') acceptChance += 0.15;
                    if (ep.temperament === 'aggressive' || ep.ambition === 'ambitious') acceptChance -= 0.1;
                    // Enemy exhaustion makes peace more likely
                    if ((enemy.warExhaustion || 0) > 30) acceptChance += 0.2;

                    if (rng.chance(Math.max(0.02, acceptChance))) {
                        // Peace accepted!
                        k.atWar.delete(enemyId);
                        enemy.atWar.delete(k.id);
                        var treatyEnd = world.day + 360;
                        if (!k.peaceTreaties) k.peaceTreaties = {};
                        if (!enemy.peaceTreaties) enemy.peaceTreaties = {};
                        k.peaceTreaties[enemyId] = treatyEnd;
                        enemy.peaceTreaties[k.id] = treatyEnd;
                        k.relations[enemyId] = Math.min(0, (k.relations[enemyId] || -80) + 30);
                        enemy.relations[k.id] = Math.min(0, (enemy.relations[k.id] || -80) + 30);
                        logEvent('🕊️ ' + k.name + ' and ' + enemy.name + ' agree to a cease-fire!',  {
                            type: 'peace_treaty', cause: 'Revolt kingdom negotiated peace',
                            effects: ['War ends', '360-day peace treaty signed'],
                            kingdoms: [k.id, enemyId]
                        }, _eventEitherKingdomCategory(k.id, enemyId));
                    }
                }
            });
        }

        // 3. Seek alliances with enemies of the parent kingdom
        if (daysSinceRevolt <= 30) {
            for (var ki = 0; ki < world.kingdoms.length; ki++) {
                var other = world.kingdoms[ki];
                if (other.id === k.id) continue;
                if (k.alliances && k.alliances.has(other.id)) continue;
                var rel = (k.relations && k.relations[other.id]) || 0;
                // Lower threshold for revolt kingdoms seeking allies (rel >= 10 instead of 50)
                if (rel >= 10 && !k.atWar.has(other.id)) {
                    // Only if other kingdom also dislikes the parent
                    var parentEnemy = false;
                    k.atWar.forEach(function(warId) {
                        if ((other.relations && (other.relations[warId] || 0) < -20) || (other.atWar && other.atWar.has(warId))) {
                            parentEnemy = true;
                        }
                    });
                    if (parentEnemy && rng.chance(0.15)) {
                        if (!k.alliances) k.alliances = new Set();
                        if (!other.alliances) other.alliances = new Set();
                        k.alliances.add(other.id);
                        other.alliances.add(k.id);
                        if (!k.allianceMeta) k.allianceMeta = {};
                        if (!other.allianceMeta) other.allianceMeta = {};
                        k.allianceMeta[other.id] = { type: 'defensive', formedDay: world.day, callsHonored: 0, callsRefused: 0, fatigue: 0, reason: 'revolt_solidarity' };
                        other.allianceMeta[k.id] = { type: 'defensive', formedDay: world.day, callsHonored: 0, callsRefused: 0, fatigue: 0, reason: 'revolt_solidarity' };
                        logEvent('🤝 ' + k.name + ' forges an alliance with ' + other.name + ' against their common enemy!',  {
                            type: 'alliance_formed', kingdoms: [k.id, other.id],
                            cause: 'New revolt kingdom seeks protection'
                        }, _eventEitherKingdomCategory(k.id, other.id));
                    }
                }
            }
        }

        // 4. Try to recruit elite merchants
        if (daysSinceRevolt <= 15) {
            _tickRevoltEMRecruitment(k);
        }
    }

    // ========================================================
    // §17G-F  REVOLT KINGDOM ELITE MERCHANT RECRUITMENT
    // ========================================================
    function _tickRevoltEMRecruitment(k) {
        if (!world || !k || !world.eliteMerchants) return;
        var rng = world.rng;
        var territories = Array.from(k.territories);
        if (territories.length === 0) return;

        for (var ei = 0; ei < world.eliteMerchants.length; ei++) {
            var em = world.eliteMerchants[ei];
            if (!em || !em.alive) continue;
            if (em.kingdomId === k.id) continue; // already ours

            // Check if EM is in our territory (higher chance) or in parent kingdom (lower chance)
            var inOurTerritory = territories.indexOf(em.townId) >= 0;
            var inParentKingdom = false;
            k.atWar.forEach(function(warId) {
                var enemy = findKingdom(warId);
                if (enemy && enemy.territories && enemy.territories.has(em.townId)) {
                    inParentKingdom = true;
                }
            });

            if (!inOurTerritory && !inParentKingdom) continue;

            // Base acceptance chance
            var acceptChance = inOurTerritory ? 0.35 : 0.08;

            // EM personality factors
            var emPers = em.personality || {};
            // Risk-taking/ambitious EMs more likely to join
            if ((emPers.ambition || 50) > 60) acceptChance += 0.1;
            if ((emPers.courage || 50) > 60) acceptChance += 0.05;
            // Loyal/traditional EMs less likely
            if ((emPers.tradition || 50) > 65) acceptChance -= 0.1;

            // Relationship with parent kingdom
            var parentKingdomId = null;
            k.atWar.forEach(function(warId) { parentKingdomId = warId; });
            if (parentKingdomId) {
                var emRep = (em.reputation && em.reputation[parentKingdomId]) || 50;
                // Low rep with parent = more likely to defect
                if (emRep < 30) acceptChance += 0.15;
                else if (emRep < 50) acceptChance += 0.05;
                else if (emRep > 70) acceptChance -= 0.2; // loves the old kingdom
            }

            // Only attempt with some probability per day
            if (!rng.chance(acceptChance * 0.1)) continue; // 10% of acceptance chance as daily attempt rate

            // Offer accepted! Transfer EM to revolt kingdom
            var oldKingdomId = em.kingdomId;
            em.kingdomId = k.id;
            em.citizenshipKingdomId = k.id;

            // Grant guildmaster status (rank 3)
            if (!em.socialRank) em.socialRank = {};
            em.socialRank[k.id] = 3;
            if (!em.reputation) em.reputation = {};
            em.reputation[k.id] = 70;

            // Signing bonus: 50-200g from kingdom treasury
            var bonus = Math.min(Math.floor(k.gold * 0.1), rng.randInt(50, 200));
            if (bonus > 0 && k.gold >= bonus) {
                k.gold -= bonus;
                em.gold = (em.gold || 0) + bonus;
            }

            // Transfer some buildings in the location to EM
            var townInTerritory = findTown(territories[0]);
            if (townInTerritory) {
                var transferred = 0;
                for (var bi = 0; bi < townInTerritory.buildings.length && transferred < 2; bi++) {
                    var bld = townInTerritory.buildings[bi];
                    if (!bld.ownerId || bld.ownerId === k.id) {
                        bld.ownerId = em.id;
                        transferred++;
                    }
                }
            }

            // Remove status from old kingdom
            if (em.socialRank && oldKingdomId) delete em.socialRank[oldKingdomId];

            logEvent('🏪 Elite Merchant ' + (em.firstName || em.name || 'A merchant') + ' defects to ' + k.name + '!',  {
                type: 'em_defection', kingdomId: k.id,
                cause: 'Revolt kingdom recruited the merchant with status and gold',
                effects: ['Guildmaster status granted', bonus > 0 ? bonus + 'g signing bonus' : 'No bonus']
            }, _eventKingdomCategory(k.id));
        }
    }

    /**
     * NPC response to king's economic strategies — called during
     * NPC business evaluation tick (every 60 days).
     */
    function applyKingEconomicEffectsToNPCs() {
        if (!world) return;
        const rng = world.rng;
        const day = world.day;

        for (const k of world.kingdoms) {
            if (!k.productionBounties || !k.territories) continue;

            // NPCs respond to bounties — merchants/craftsmen with gold try to build requested buildings
            for (const bounty of k.productionBounties) {
                if (bounty.fulfilled) continue;
                const town = findTown(bounty.townId);
                if (!town) continue;
                const maxSlots = (CONFIG.TOWN_CATEGORIES[town.category] || {}).maxBuildingSlots || 10;
                if (town.buildings.length >= maxSlots) continue;

                // Find building that produces this good
                let targetBt = null;
                for (const key in BUILDING_TYPES) {
                    const bt = BUILDING_TYPES[key];
                    if (bt.produces === bounty.good) { targetBt = bt; break; }
                }
                if (!targetBt) continue;

                // Check natural deposit requirement
                var bountyDepReq = CONFIG.DEPOSIT_REQUIREMENTS ? CONFIG.DEPOSIT_REQUIREMENTS[targetBt.id] : null;
                if (bountyDepReq) {
                    var bTownDeps = town.naturalDeposits || {};
                    if (!bTownDeps[bountyDepReq.deposit] || bTownDeps[bountyDepReq.deposit] <= 0) continue;
                }

                // Look for NPCs with enough gold and relevant skills
                const candidates = world.people.filter(pp =>
                    pp.alive && pp.townId === bounty.townId &&
                    (pp.occupation === 'merchant' || pp.occupation === 'craftsman') &&
                    pp.gold >= targetBt.cost * 0.8 &&
                    !pp.buildings?.some(b => b.type === targetBt.id && b.townId === bounty.townId)
                );
                if (candidates.length > 0 && rng.chance(0.15)) {
                    const npc = rng.pick(candidates);
                    npc.gold -= targetBt.cost;
                    town.buildings.push({
                        type: targetBt.id, level: 1, ownerId: npc.id,
                        builtDay: day, condition: 'new', lastRepairDay: 0
                    });
                    if (!npc.buildings) npc.buildings = [];
                    npc.buildings.push({ type: targetBt.id, townId: town.id, level: 1 });
                    // Pay bounty
                    npc.gold += bounty.reward;
                    k.gold -= bounty.reward;
                    bounty.fulfilled = true;
                    logEvent(`✅ ${npc.firstName} ${npc.lastName} builds a ${targetBt.name} in ${town.name} and claims the ${bounty.reward}g bounty!`, {
                        type: 'bounty_fulfilled', townId: town.id, kingdomId: k.id, _noToast: true,
                        cause: `Kingdom bounty for ${bounty.good}`,
                        effects: [`New ${targetBt.name} in ${town.name}`, `${bounty.reward}g paid from treasury`]
                    }, _eventKingdomCategory(k.id));
                }
            }

            // NPCs respond to immigration incentives — unhappy NPCs in other kingdoms relocate
            for (const inc of (k.immigrationIncentives || [])) {
                if (inc.fulfilled) continue;
                const targetTown = findTown(inc.townId);
                if (!targetTown) continue;
                // Find unhappy people in other kingdoms
                const migrants = world.people.filter(pp =>
                    pp.alive && pp.kingdomId !== k.id &&
                    pp.needs && pp.needs.happiness < 30 &&
                    pp.age >= CONFIG.COMING_OF_AGE && pp.age <= 60
                );
                if (migrants.length > 0 && rng.chance(0.08)) {
                    const migrant = rng.pick(migrants);
                    const oldTown = findTown(migrant.townId);
                    migrant.townId = inc.townId;
                    migrant.kingdomId = k.id;
                    migrant.gold += inc.bonus;
                    k.gold -= inc.bonus;
                    migrant.needs.happiness = Math.min(100, (migrant.needs.happiness || 30) + 20);
                    targetTown.population++;
                    if (oldTown && oldTown.population > 0) oldTown.population--;
                    Engine.logHiddenEvent(`🚶 ${migrant.firstName} ${migrant.lastName} migrates to ${targetTown.name} in ${k.name}, drawn by the ${inc.bonus}g immigration bonus.`,  {
                        type: 'immigration', cause: 'Kingdom immigration incentive',
                        effects: [`${targetTown.name} gains a citizen`, `Treasury pays ${inc.bonus}g`]
                    }, _eventKingdomCategory(k.id));
                    inc.fulfilled = true; // Mark incentive as fulfilled
                }
            }

            // Apply quota happiness penalties
            if (day % CONFIG.DAYS_PER_SEASON === 0) {
                for (const quota of (k.productionQuotas || [])) {
                    const town = findTown(quota.townId);
                    if (!town) continue;
                    const currentProd = town.market.supply[quota.good] || 0;
                    if (currentProd < quota.minPerSeason) {
                        town.happiness = Math.max(0, (town.happiness || 50) + (CONFIG.KING_QUOTA_HAPPINESS_PENALTY || -5));
                        logEvent(`⚠️ ${town.name} fails to meet ${quota.good} production quota. Happiness drops.`,  {
                            type: 'quota_failure', kingdomId: k.id, townId: town.id, cause: `Produced ${currentProd} of ${quota.minPerSeason} required`,
                            effects: [`Happiness penalty: ${CONFIG.KING_QUOTA_HAPPINESS_PENALTY || -5}`]
                        }, _eventKingdomCategory(k.id));
                    }
                }
            }

            // Tax holiday effect: NPC building decisions favor tax-holiday towns
            for (const holiday of (k.taxHolidays || [])) {
                const town = findTown(holiday.townId);
                if (!town) continue;
                // Boost attractiveness: slightly increase prosperity perception
                // This happens naturally when property tax collection skips holiday towns
            }

            // Trade subsidies: applied in collectTradeTax, but clean up expired/exhausted ones
            if (k.tradeSubsidies) {
                k.tradeSubsidies = k.tradeSubsidies.filter(s => s.expiresDay > day && (s.unitsPaid || 0) < s.maxUnits);
            }
        }
    }

    // ── AI King Proactive Loyalty Management ──
    // Kings occasionally bestow gifts, grant titles, or hold private audiences
    // Frequency and target selection based on intelligence, warmth, and selfishness
    function tickAIKingLoyaltyManagement(k) {
        _syncState();
        if (!world || !k || !k.king) return;
        var rng = world.rng;
        if (!rng) return;

        var king = findPerson(k.king);
        if (!king || !king.alive) return;
        var kp = king.personality || {};
        var intelligence = kp.intelligence || 50;
        var warmth = kp.warmth || 50;
        var selfishness = kp.selfishness || 50;
        var frugality = kp.frugality || 50;

        // Base chance to act: smarter and warmer kings act more often
        // Range: ~5% (foolish+cruel) to ~30% (brilliant+kind) per check
        var actChance = 0.05 + (intelligence / 100) * 0.15 + (warmth / 100) * 0.10;
        // Selfish kings act less frequently on others' behalf
        actChance *= (1 - selfishness / 200); // 50-100% modifier
        if (!rng.chance(actChance)) return;

        // Get nobles in this kingdom
        var nobles = Engine.getNoblesInKingdom ? Engine.getNoblesInKingdom(k.id) : [];
        if (nobles.length === 0) return;

        // Target selection depends on selfishness and intelligence
        var target = null;
        if (selfishness > 65) {
            // Highly selfish: strongly prefer already-loyal nobles (reward sycophants)
            var loyalNobles = nobles.filter(function(n) {
                return n.alive && (n.perceivedKingLoyalty || n.kingLoyalty || 50) >= 60;
            });
            if (loyalNobles.length > 0) {
                // Among loyal nobles, prefer those with highest perceived loyalty
                loyalNobles.sort(function(a, b) {
                    return (b.perceivedKingLoyalty || b.kingLoyalty || 50) - (a.perceivedKingLoyalty || a.kingLoyalty || 50);
                });
                // Pick from top half
                var topHalf = Math.max(1, Math.floor(loyalNobles.length / 2));
                target = loyalNobles[rng.randInt(0, topHalf - 1)];
            } else {
                // No loyal nobles — selfish kings don't bother
                return;
            }
        } else if (intelligence >= 60) {
            // Smart kings target the most disloyal noble to bring them back
            var sortedByLoyalty = nobles.filter(function(n) { return n.alive; }).slice();
            sortedByLoyalty.sort(function(a, b) {
                return (a.kingLoyalty || 50) - (b.kingLoyalty || 50);
            });
            // Pick from bottom third (most disloyal)
            var bottomThird = Math.max(1, Math.floor(sortedByLoyalty.length / 3));
            target = sortedByLoyalty[rng.randInt(0, bottomThird - 1)];
        } else {
            // Average/dim kings pick randomly
            var aliveNobles = nobles.filter(function(n) { return n.alive; });
            if (aliveNobles.length === 0) return;
            target = rng.pick(aliveNobles);
        }
        if (!target) return;

        // Choose action based on personality
        // Actions: gift (gold), honorary_title, private_audience, land_grant
        var actions = [];
        // Generous kings (low frugality) more likely to give gold/land
        if (frugality < 50 && k.gold >= 200) actions.push('gold_gift');
        if (frugality < 40 && k.gold >= 400) actions.push('land_grant');
        // Warm kings prefer personal touch
        if (warmth >= 40) actions.push('private_audience');
        if (warmth >= 50) actions.push('private_audience'); // double weight
        // All kings can bestow honorary titles (free)
        actions.push('honorary_title');
        actions.push('honorary_title'); // double weight since it's free
        // Ambitious kings use military commissions
        if ((kp.ambition || 50) > 55 && k.gold >= 100) actions.push('military_command');

        if (actions.length === 0) return;
        var action = rng.pick(actions);

        var nobleName = (target.firstName || '') + ' ' + (target.lastName || '');

        if (action === 'private_audience') {
            // Private audience: loyalty +5-10 based on king warmth
            var loyaltyGain = 5 + Math.floor(warmth / 20);
            target.kingLoyalty = Math.min(100, (target.kingLoyalty || 50) + loyaltyGain);
            target.perceivedKingLoyalty = Math.min(100, (target.perceivedKingLoyalty || target.kingLoyalty || 50) + Math.floor(loyaltyGain * 0.7));
            target.fearOfKing = Math.max(0, (target.fearOfKing || 15) - 2);
            logEvent('👑 The king of ' + k.name + ' holds a private audience with ' + nobleName + '. (+' + loyaltyGain + ' loyalty)', {
                type: 'king_audience', category: 'npc_activity',
                effects: [nobleName + ' feels valued by the crown']
            }, 'npc_activity');
        } else if (action === 'gold_gift' && k.gold >= 200) {
            k.gold -= 200;
            target.gold = (target.gold || 0) + 200;
            var loyaltyGain2 = 8;
            target.kingLoyalty = Math.min(100, (target.kingLoyalty || 50) + loyaltyGain2);
            target.perceivedKingLoyalty = Math.min(100, (target.perceivedKingLoyalty || target.kingLoyalty || 50) + 5);
            // Jealousy from other nobles
            _applyNobleJealousy(k, target.id, nobles, 2, rng);
            logEvent('👑💰 The king of ' + k.name + ' bestows a royal gold gift upon ' + nobleName + '! (200g, +' + loyaltyGain2 + ' loyalty)', {
                type: 'king_gift', category: 'npc_activity',
                effects: [nobleName + ' receives 200g from the treasury']
            }, 'npc_activity');
        } else if (action === 'land_grant' && k.gold >= 400) {
            k.gold -= 400;
            var loyaltyGain3 = 15;
            target.kingLoyalty = Math.min(100, (target.kingLoyalty || 50) + loyaltyGain3);
            target.perceivedKingLoyalty = Math.min(100, (target.perceivedKingLoyalty || target.kingLoyalty || 50) + 10);
            _applyNobleJealousy(k, target.id, nobles, 3, rng);
            logEvent('👑🏰 The king of ' + k.name + ' grants land to ' + nobleName + '! (400g, +' + loyaltyGain3 + ' loyalty)', {
                type: 'king_gift', category: 'npc_activity',
                effects: [nobleName + ' receives a land grant from the crown']
            }, 'npc_activity');
        } else if (action === 'military_command' && k.gold >= 100) {
            k.gold -= 100;
            var loyaltyGain4 = 12;
            target.kingLoyalty = Math.min(100, (target.kingLoyalty || 50) + loyaltyGain4);
            target.perceivedKingLoyalty = Math.min(100, (target.perceivedKingLoyalty || target.kingLoyalty || 50) + 6);
            logEvent('👑⚔️ The king of ' + k.name + ' appoints ' + nobleName + ' to a military command! (+' + loyaltyGain4 + ' loyalty)', {
                type: 'king_gift', category: 'npc_activity',
                effects: [nobleName + ' receives a military commission']
            }, 'npc_activity');
        } else {
            // Honorary title (free)
            var loyaltyGain5 = 8;
            target.kingLoyalty = Math.min(100, (target.kingLoyalty || 50) + loyaltyGain5);
            target.perceivedKingLoyalty = Math.min(100, (target.perceivedKingLoyalty || target.kingLoyalty || 50) + 5);
            logEvent('👑🎖️ The king of ' + k.name + ' bestows an honorary title upon ' + nobleName + '! (+' + loyaltyGain5 + ' loyalty)', {
                type: 'king_gift', category: 'npc_activity',
                effects: [nobleName + ' is honored by the crown']
            }, 'npc_activity');
        }
    }

    // Apply mild jealousy to other nobles when one gets a gift
    function _applyNobleJealousy(k, recipientId, nobles, severity, rng) {
        for (var i = 0; i < nobles.length; i++) {
            var n = nobles[i];
            if (!n.alive || n.id === recipientId) continue;
            var np = n.personality || {};
            var jealousy = 0;
            if ((np.ambition || 50) > 60) jealousy -= 1;
            if ((np.selfishness || 50) > 65) jealousy -= 1;
            jealousy -= Math.floor(severity / 2);
            // Nobles with high loyalty to king don't mind
            if ((n.kingLoyalty || 50) > 70) jealousy = Math.max(jealousy, -1);
            if (jealousy !== 0) {
                n.kingLoyalty = Math.max(0, Math.min(100, (n.kingLoyalty || 50) + jealousy));
            }
        }
    }

    // ── Exports ──
    Engine.tickDiplomacy = tickDiplomacy;
    Engine.declareWar = declareWar;
    Engine.makePeace = makePeace;
    Engine.tickKingDecisions = tickKingDecisions;
    Engine.kingdom_name = kingdom_name;
    Engine.boostKingdomHappiness = boostKingdomHappiness;
    Engine.analyzeKingdomEconomy = function(kingdomId) {
        if (!world) return null;
        var k = typeof kingdomId === 'string' ? findKingdom(kingdomId) : kingdomId;
        return k ? analyzeKingdomEconomy(k) : null;
    };
    Engine.tickKingEconomicStrategy = tickKingEconomicStrategy;
    Engine.tickTreasurySpending = tickTreasurySpending;
    Engine.tickNobleRelationshipLoyaltyLink = tickNobleRelationshipLoyaltyLink;
    Engine.tickInterKingdomTrade = tickInterKingdomTrade;
    Engine.applyKingEconomicEffectsToNPCs = applyKingEconomicEffectsToNPCs;
    Engine.tickAIKingLoyaltyManagement = tickAIKingLoyaltyManagement;

    // Execute a player-approved economic proposal
    Engine.executeEconomicProposal = function(kingdom, proposal) {
        if (!world || !kingdom || !proposal) return { success: false, message: 'Invalid proposal.' };
        var day = world.day;
        var strat = proposal.stratData;
        if (!strat) return { success: false, message: 'Proposal data missing.' };
        if (kingdom.gold < (CONFIG.KING_MIN_TREASURY_FOR_STRATEGY || 500)) {
            return { success: false, message: 'Treasury too low (need ' + (CONFIG.KING_MIN_TREASURY_FOR_STRATEGY || 500) + 'g).' };
        }

        // Initialize arrays if needed
        if (!kingdom.landSubsidies) kingdom.landSubsidies = [];
        if (!kingdom.productionBounties) kingdom.productionBounties = [];
        if (!kingdom.tradeSubsidies) kingdom.tradeSubsidies = [];
        if (!kingdom.taxHolidays) kingdom.taxHolidays = [];
        if (!kingdom.immigrationIncentives) kingdom.immigrationIncentives = [];
        if (!kingdom.productionQuotas) kingdom.productionQuotas = [];
        if (!kingdom.exportRestrictions) kingdom.exportRestrictions = [];

        var _resInfo, _goodName;

        switch (strat.type) {
            case 'land_subsidy':
                var _disc = Math.min(0.6, strat.discount || 0.4);
                kingdom.landSubsidies.push({
                    townId: strat.townId, buildingType: strat.buildingType,
                    discount: _disc, expiresDay: day + (CONFIG.KING_SUBSIDY_DURATION || 180)
                });
                logEvent('👑 ' + kingdom.name + ' offers cheap land in ' + (strat.townName || '?') + ' for ' + (strat.buildingName || '?') + ' builders!',  {
                    type: 'economic_strategy', kingdomId: kingdom.id, townId: strat.townId, cause: (strat.good || 'goods') + ' deficit',
                    effects: [Math.round(_disc * 100) + '% discount on land']
                }, _eventKingdomCategory(kingdom.id));
                break;
            case 'bounty':
                kingdom.productionBounties.push({
                    good: strat.good, townId: strat.townId,
                    reward: strat.reward || (CONFIG.KING_BOUNTY_DEFAULT_REWARD || 50),
                    expiresDay: day + (CONFIG.KING_SUBSIDY_DURATION || 180)
                });
                _resInfo = findResourceById(strat.good);
                _goodName = _resInfo ? _resInfo.name : strat.good;
                logEvent('📜 ' + kingdom.name + ' seeks ' + _goodName + ' producers in ' + (strat.townName || '?') + ' — ' + (strat.reward || 50) + 'g bounty!',  {
                    type: 'economic_strategy', kingdomId: kingdom.id, townId: strat.townId, effects: [(strat.reward || 50) + 'g reward']
                }, _eventKingdomCategory(kingdom.id));
                break;
            case 'trade_subsidy':
                kingdom.tradeSubsidies.push({
                    good: strat.good, bonusPerUnit: strat.bonusPerUnit || 2,
                    maxUnits: strat.maxUnits || 200, unitsPaid: 0,
                    expiresDay: day + (CONFIG.KING_SUBSIDY_DURATION || 180)
                });
                _resInfo = findResourceById(strat.good);
                _goodName = _resInfo ? _resInfo.name : strat.good;
                logEvent('💰 ' + kingdom.name + ' subsidizes ' + _goodName + ' imports — ' + (strat.bonusPerUnit || 2) + 'g bonus per unit!',  {
                    type: 'economic_strategy', kingdomId: kingdom.id, effects: ['Merchants get +' + (strat.bonusPerUnit || 2) + 'g per ' + _goodName + ' sold']
                }, _eventKingdomCategory(kingdom.id));
                break;
            case 'tax_holiday':
                kingdom.taxHolidays.push({
                    townId: strat.townId,
                    expiresDay: day + (CONFIG.KING_TAX_HOLIDAY_DURATION || 180)
                });
                logEvent('🎉 ' + kingdom.name + ' declares a tax holiday in ' + (strat.townName || '?') + '!',  {
                    type: 'economic_strategy', kingdomId: kingdom.id, townId: strat.townId, effects: ['No property tax for new buildings']
                }, _eventKingdomCategory(kingdom.id));
                break;
            case 'immigration':
                kingdom.immigrationIncentives.push({
                    townId: strat.townId,
                    bonus: CONFIG.KING_IMMIGRATION_BONUS || 50,
                    expiresDay: day + (CONFIG.KING_SUBSIDY_DURATION || 180)
                });
                logEvent('🏘️ ' + kingdom.name + ' offers immigration bonuses for ' + (strat.townName || '?') + '!',  {
                    type: 'economic_strategy', kingdomId: kingdom.id, townId: strat.townId, effects: [(CONFIG.KING_IMMIGRATION_BONUS || 50) + 'g per settler']
                }, _eventKingdomCategory(kingdom.id));
                break;
            case 'supply_gap_building': {
                var _sgTown = findTown(strat.townId);
                var _sgBt = BUILDING_TYPES ? BUILDING_TYPES[strat.buildingType] : null;
                if (!_sgTown || !_sgBt) return { success: false, message: 'Town or building type not found.' };
                if (kingdom.gold < (_sgBt.cost || 0)) return { success: false, message: 'Not enough gold (' + (_sgBt.cost || 0) + 'g needed).' };
                kingdom.gold -= _sgBt.cost;
                _sgTown.buildings.push({
                    type: _sgBt.id, level: 1, ownerId: kingdom.id,
                    builtDay: day, condition: 'new', lastRepairDay: 0
                });
                logEvent('🏭 ' + kingdom.name + ' builds a ' + _sgBt.name + ' in ' + _sgTown.name + '!',  {
                    type: 'economic_strategy', kingdomId: kingdom.id, townId: _sgTown.id, effects: ['New ' + _sgBt.name + ' in ' + _sgTown.name, 'Treasury -' + _sgBt.cost + 'g']
                }, _eventKingdomCategory(kingdom.id));
                break;
            }
            case 'export_restriction':
                if (!kingdom.exportRestrictions.includes(strat.good)) {
                    kingdom.exportRestrictions.push(strat.good);
                }
                _resInfo = findResourceById(strat.good);
                _goodName = _resInfo ? _resInfo.name : strat.good;
                logEvent('🚫 ' + kingdom.name + ' restricts export of ' + _goodName + ' to protect domestic supply!',  {
                    type: 'economic_strategy', kingdomId: kingdom.id, effects: [_goodName + ' cannot be exported']
                }, _eventKingdomCategory(kingdom.id));
                break;
            case 'tariff_adjustment':
                if (kingdom.laws && kingdom.laws.tradeTariff > 0.02) {
                    kingdom.laws.tradeTariff = Math.max(0.02, kingdom.laws.tradeTariff - 0.01);
                    logEvent('📊 ' + kingdom.name + ' lowers trade tariffs to ' + Math.round(kingdom.laws.tradeTariff * 100) + '%.',  {
                        type: 'economic_strategy', kingdomId: kingdom.id, effects: ['Tariffs reduced']
                    }, _eventKingdomCategory(kingdom.id));
                }
                break;
            case 'forced_labor': {
                var _flTown = findTown(strat.townId);
                var _flBt = BUILDING_TYPES ? BUILDING_TYPES[strat.buildingType] : null;
                if (!_flTown || !_flBt) return { success: false, message: 'Town or building type not found.' };
                var _flCost = Math.floor((_flBt.cost || 0) * 0.5);
                if (kingdom.gold < _flCost) return { success: false, message: 'Not enough gold (' + _flCost + 'g needed).' };
                kingdom.gold -= _flCost;
                _flTown.buildings.push({
                    type: _flBt.id, level: 1, ownerId: kingdom.id,
                    builtDay: day, condition: 'new', lastRepairDay: 0
                });
                _flTown.happiness = Math.max(0, (_flTown.happiness || 50) + (CONFIG.KING_FORCED_LABOR_HAPPINESS || -10));
                logEvent('⛓️ ' + kingdom.name + ' conscripts laborers in ' + _flTown.name + ' to build a ' + _flBt.name + '!',  {
                    type: 'economic_strategy', kingdomId: kingdom.id, townId: _flTown.id, effects: [_flBt.name + ' built at half cost', 'Happiness drops']
                }, _eventKingdomCategory(kingdom.id));
                break;
            }
            case 'asset_seizure': {
                var _asTown = findTown(strat.townId);
                if (!_asTown) return { success: false, message: 'Town not found.' };
                var _asBld = _asTown.buildings.find(function(b) { return b.type === strat.buildingType && b.ownerId === strat.ownerId; });
                if (!_asBld) return { success: false, message: 'Building no longer exists.' };
                var _prevOwner = findPerson(strat.ownerId);
                _asBld.ownerId = kingdom.id;
                _asTown.happiness = Math.max(0, (_asTown.happiness || 50) - 15);
                if (_prevOwner) {
                    _prevOwner.needs = _prevOwner.needs || {};
                    _prevOwner.needs.happiness = Math.max(0, (_prevOwner.needs.happiness || 50) - 30);
                }
                var _asBt = BUILDING_TYPES ? BUILDING_TYPES[strat.buildingType] : null;
                logEvent('👑 ' + kingdom.name + ' seizes a ' + (_asBt ? _asBt.name : strat.buildingType) + ' in ' + _asTown.name + '!',  {
                    type: 'economic_strategy', kingdomId: kingdom.id, townId: _asTown.id, effects: ['Building transferred to crown', 'Happiness drops']
                }, _eventKingdomCategory(kingdom.id));
                break;
            }
            case 'production_quota':
                kingdom.productionQuotas.push({
                    good: strat.good, townId: strat.townId,
                    minOutput: strat.minOutput || 10,
                    expiresDay: day + (CONFIG.KING_SUBSIDY_DURATION || 180)
                });
                _resInfo = findResourceById(strat.good);
                _goodName = _resInfo ? _resInfo.name : strat.good;
                logEvent('⚒️ ' + kingdom.name + ' sets production quotas for ' + _goodName + ' in ' + (strat.townName || '?') + '.',  {
                    type: 'economic_strategy', kingdomId: kingdom.id, townId: strat.townId, effects: ['Minimum production mandated']
                }, _eventKingdomCategory(kingdom.id));
                break;
            default:
                return { success: false, message: 'Unknown proposal type: ' + strat.type };
        }

        // Remove from proposals queue
        if (kingdom._economicProposals) {
            kingdom._economicProposals = kingdom._economicProposals.filter(function(pr) { return pr.id !== proposal.id; });
        }
        return { success: true, message: proposal.icon + ' ' + proposal.title + ' enacted!' };
    };

    // Dismiss/deny a proposal
    Engine.dismissEconomicProposal = function(kingdom, proposalId) {
        if (!kingdom || !kingdom._economicProposals) return;
        kingdom._economicProposals = kingdom._economicProposals.filter(function(pr) { return pr.id !== proposalId; });
    };

    // ── Execute a military proposal (player-king approved) ──
    Engine.executeMilitaryProposal = function(kingdom, proposal) {
        if (!kingdom || !proposal) return { success: false, message: 'Invalid proposal.' };
        var world = Engine.getWorld();
        switch (proposal.type) {
            case 'attack':
                // Send army from the specified town to target
                var fromT = findTown(proposal.fromTownId);
                var tgtT = findTown(proposal.targetTownId);
                if (!fromT || !tgtT) return { success: false, message: 'Town not found.' };
                var soldiers = proposal.soldiers || 20;
                var minGar = Math.max(CONFIG.GARRISON_MIN || 3, Math.floor(fromT.garrison * (CONFIG.ARMY_MIN_GARRISON_RATIO || 0.4)));
                var avail = fromT.garrison - minGar;
                if (avail < 10) return { success: false, message: 'Not enough soldiers at ' + fromT.name + ' (need at least 10 available, have ' + avail + ').' };
                soldiers = Math.min(soldiers, avail);
                fromT.garrison -= soldiers;

                var inf = Math.floor(soldiers * 0.6);
                var arch = Math.floor(soldiers * 0.25);
                var cav = soldiers - inf - arch;

                var route = null;
                try { route = findArmyRoute(fromT.id, tgtT.id, kingdom.id); } catch(e) {}
                if (!route || !route.legs || route.legs.length === 0) {
                    fromT.garrison += soldiers;
                    return { success: false, message: 'No route to ' + tgtT.name + '.' };
                }

                // Consume equipment from town
                var townSupply = fromT.market && fromT.market.supply ? fromT.market.supply : {};
                var swordsUsed = Math.min(townSupply.swords || 0, soldiers);
                var armorUsed = Math.min(townSupply.armor || 0, inf);
                var bowsUsed = Math.min(townSupply.bows || 0, arch);
                var arrowsUsed = Math.min(townSupply.arrows || 0, arch * 5);
                if (townSupply.swords) townSupply.swords = Math.max(0, townSupply.swords - swordsUsed);
                if (townSupply.armor) townSupply.armor = Math.max(0, townSupply.armor - armorUsed);
                if (townSupply.bows) townSupply.bows = Math.max(0, townSupply.bows - bowsUsed);
                if (townSupply.arrows) townSupply.arrows = Math.max(0, townSupply.arrows - arrowsUsed);

                // Check if army should be mounted (proposal.mounted or enough horses)
                var _propMounted = !!proposal.mounted;
                if (_propMounted) {
                    var _pH = townSupply.horses || 0;
                    if (_pH >= soldiers) {
                        // Consume horses for mounted
                        townSupply.horses = Math.max(0, (townSupply.horses || 0) - soldiers);
                    } else {
                        _propMounted = false; // Not enough horses, send unmounted
                    }
                }

                var armyObj = {
                    id: uid('army'),
                    kingdomId: kingdom.id,
                    targetKingdomId: tgtT.kingdomId,
                    soldiers: soldiers,
                    fromTownId: fromT.id,
                    toTownId: tgtT.id,
                    progress: 0,
                    equipment: swordsUsed,
                    infantry: _propMounted ? 0 : inf, archers: _propMounted ? 0 : arch, cavalry: _propMounted ? soldiers : cav,
                    mounted: _propMounted,
                    morale: CONFIG.ARMY_DEFAULT_MORALE || 80,
                    supplies: CONFIG.ARMY_DEFAULT_SUPPLIES || 100,
                    demolitionTools: 0,
                    blastingPowder: 0
                };

                // AI: strategically send demolition tools and blasting powder from kingdom stockpile
                // v9p33river305: was kingdom.personality (doesn't exist) — the
                // canonical field is kingdom.kingPersonality.militarism.
                var _kingPersonality = kingdom.kingPersonality || {};
                var _isAggressive = _kingPersonality.militarism === 'warlike' || _kingPersonality.militarism === 'aggressive';
                var _demoAvail = 0, _blastAvail = 0;
                for (var _kti2 = 0; _kti2 < world.towns.length; _kti2++) {
                    var _kt2 = world.towns[_kti2];
                    if (!kingdom.territories.has(_kt2.id)) continue;
                    // v9p33river367: outposts/junctions can be kingdom territory
                    // without a market; siege resupply must not crash on them.
                    var _kt2Supply = (_kt2.market && _kt2.market.supply) ? _kt2.market.supply : {};
                    _demoAvail += (_kt2Supply.demolition_tools || 0);
                    _blastAvail += (_kt2Supply.blasting_powder || 0);
                }
                // Send up to 10 demolition tools if available (always if aggressive, 60% chance otherwise)
                var _sendDemo = Math.min(10, _demoAvail);
                if (_sendDemo > 0 && (_isAggressive || world.rng.chance(0.6))) {
                    armyObj.demolitionTools = _sendDemo;
                    // Consume from kingdom towns
                    var _demoLeft = _sendDemo;
                    for (var _kti3 = 0; _kti3 < world.towns.length && _demoLeft > 0; _kti3++) {
                        var _kt3 = world.towns[_kti3];
                        if (!kingdom.territories.has(_kt3.id)) continue;
                        var _kt3Supply = (_kt3.market && _kt3.market.supply) ? _kt3.market.supply : null;
                        if (!_kt3Supply) continue;
                        var _take = Math.min(_demoLeft, _kt3Supply.demolition_tools || 0);
                        if (_take > 0) { _kt3Supply.demolition_tools -= _take; _demoLeft -= _take; }
                    }
                }
                // Send up to 10 blasting powder if available (always if aggressive, 40% chance otherwise)
                var _sendBlast = Math.min(10, _blastAvail);
                if (_sendBlast > 0 && (_isAggressive || world.rng.chance(0.4))) {
                    armyObj.blastingPowder = _sendBlast;
                    var _blastLeft = _sendBlast;
                    for (var _kti4 = 0; _kti4 < world.towns.length && _blastLeft > 0; _kti4++) {
                        var _kt4 = world.towns[_kti4];
                        if (!kingdom.territories.has(_kt4.id)) continue;
                        var _kt4Supply = (_kt4.market && _kt4.market.supply) ? _kt4.market.supply : null;
                        if (!_kt4Supply) continue;
                        var _take2 = Math.min(_blastLeft, _kt4Supply.blasting_powder || 0);
                        if (_take2 > 0) { _kt4Supply.blasting_powder -= _take2; _blastLeft -= _take2; }
                    }
                }
                if (route.legs.length > 0) {
                    armyObj.route = route;
                    armyObj.legIndex = 0;
                    armyObj.legProgress = 0;
                }
                world.armies.push(armyObj);

                // Assign a noble leader if king AI decides (minor nobles/lords only, not royal advisors)
                var _nobleLeader = _pickNobleArmyLeader(kingdom, armyObj, world);
                if (_nobleLeader) {
                    armyObj.leaderId = _nobleLeader.id;
                    logEvent('🏰 ' + (_nobleLeader.firstName || 'A noble') + ' ' + (_nobleLeader.lastName || '') + ' leads the army to ' + tgtT.name + '.', null, 'military');
                }

                // Track in kingdom._armies for King UI
                if (!kingdom._armies) kingdom._armies = [];
                var travelD = route.totalTime ? Math.max(2, Math.ceil(_propMounted ? route.totalTime * 0.75 : route.totalTime)) : 10;
                kingdom._armies.push({
                    id: armyObj.id, soldiers: soldiers, targetTownId: tgtT.id,
                    targetName: tgtT.name, targetKingdomId: tgtT.kingdomId,
                    status: 'marching', morale: armyObj.morale, mounted: _propMounted,
                    departDay: world.day, arrivalDay: world.day + travelD,
                    stagingTownName: fromT.name
                });
                var _ml = _propMounted ? ' (🐴 mounted)' : '';
                logEvent('⚔️ ' + soldiers + (_propMounted ? ' mounted cavalry' : ' soldiers') + ' march from ' + fromT.name + ' to attack ' + tgtT.name + '!' + _ml, { kingdomId: kingdom.id, townId: tgtT.id, fromTownId: fromT.id }, _eventKingdomCategory(kingdom.id));
                break;

            case 'recruit':
                var recTown = findTown(proposal.townId);
                if (!recTown) return { success: false, message: 'Town not found.' };
                var cnt = proposal.count || 5;
                var costPer = CONFIG.SOLDIER_RECRUIT_COST || 50;
                var totalCost = cnt * costPer;
                if (kingdom.gold < totalCost) return { success: false, message: 'Need ' + totalCost + 'g (have ' + Math.floor(kingdom.gold) + 'g).' };
                kingdom.gold -= totalCost;
                // Use posting system instead of instant garrison
                if (!kingdom._recruitmentPostings) kingdom._recruitmentPostings = [];
                kingdom._recruitmentPostings.push({
                    id: 'prop_' + world.day + '_' + Math.floor(Math.random() * 9999),
                    towns: [recTown.id],
                    slotsTotal: cnt, slotsFilled: 0,
                    payPerSoldier: costPer, reservedGold: totalCost,
                    postedDay: world.day, isConscription: false
                });
                logEvent('📜 Recruitment posting for ' + cnt + ' soldiers at ' + recTown.name + '. Cost: ' + totalCost + 'g. NPCs will enlist over time.', { kingdomId: kingdom.id, townId: recTown.id }, _eventKingdomCategory(kingdom.id));
                break;

            case 'supply':
                var supTown = findTown(proposal.townId);
                if (!supTown) return { success: false, message: 'Town not found.' };
                var good = proposal.good;
                var qty = proposal.qty || 10;
                var price = getMarketPrice(supTown, good) || 10;
                var supCost = Math.round(qty * price);
                if (kingdom.gold < supCost) return { success: false, message: 'Need ' + supCost + 'g (have ' + Math.floor(kingdom.gold) + 'g).' };
                kingdom.gold -= supCost;
                if (!supTown.market.supply) supTown.market.supply = {};
                supTown.market.supply[good] = (supTown.market.supply[good] || 0) + qty;
                var _resInfo = findResourceById ? findResourceById(good) : null;
                logEvent('🗡️ Procured ' + qty + ' ' + (_resInfo ? _resInfo.name : good) + ' at ' + supTown.name + '. Cost: ' + supCost + 'g.', { kingdomId: kingdom.id, townId: supTown.id }, _eventKingdomCategory(kingdom.id));
                break;

            case 'build_ships':
                var shipTown = findTown(proposal.townId);
                if (!shipTown || !shipTown.isPort) return { success: false, message: 'Port town not found.' };
                var shipCost = proposal.cost || 300;
                if (kingdom.gold < shipCost) return { success: false, message: 'Need ' + shipCost + 'g (have ' + Math.floor(kingdom.gold) + 'g).' };
                kingdom.gold -= shipCost;
                if (!kingdom.navalFleet) kingdom.navalFleet = [];
                kingdom.navalFleet.push({
                    id: uid('ship'),
                    type: 'warship',
                    stationedAt: shipTown.id,
                    condition: 100,
                    mission: null,
                    builtDay: world.day
                });
                logEvent('⛵ New warship built at ' + shipTown.name + ' for ' + shipCost + 'g.', { kingdomId: kingdom.id, townId: shipTown.id }, _eventKingdomCategory(kingdom.id));
                break;

            case 'fortify':
                var fortTown = findTown(proposal.townId);
                if (!fortTown) return { success: false, message: 'Town not found.' };
                var fortCost = proposal.cost || 150;
                if (kingdom.gold < fortCost) return { success: false, message: 'Need ' + fortCost + 'g (have ' + Math.floor(kingdom.gold) + 'g).' };
                kingdom.gold -= fortCost;
                // Fortification creates a recruitment posting for 5 soldiers at this town
                if (!kingdom._recruitmentPostings) kingdom._recruitmentPostings = [];
                kingdom._recruitmentPostings.push({
                    id: 'fort_' + world.day + '_' + Math.floor(Math.random() * 9999),
                    towns: [fortTown.id],
                    slotsTotal: 5, slotsFilled: 0,
                    payPerSoldier: CONFIG.SOLDIER_RECRUIT_COST || 50,
                    reservedGold: 5 * (CONFIG.SOLDIER_RECRUIT_COST || 50),
                    postedDay: world.day, isConscription: false
                });
                logEvent('🏰 ' + fortTown.name + ' being fortified! Recruitment posted for 5 soldiers. Cost: ' + fortCost + 'g.', { kingdomId: kingdom.id, townId: fortTown.id }, _eventKingdomCategory(kingdom.id));
                break;

            default:
                return { success: false, message: 'Unknown military proposal type: ' + proposal.type };
        }

        // Remove from proposals queue
        if (kingdom._militaryProposals) {
            kingdom._militaryProposals = kingdom._militaryProposals.filter(function(pr) { return pr.id !== proposal.id; });
        }
        return { success: true, message: proposal.icon + ' ' + proposal.title + ' approved!' };
    };

    // Dismiss a military proposal
    Engine.dismissMilitaryProposal = function(kingdom, proposalId) {
        if (!kingdom || !kingdom._militaryProposals) return;
        kingdom._militaryProposals = kingdom._militaryProposals.filter(function(pr) { return pr.id !== proposalId; });
    };

    // ── Sync hook ──
    var _origTick = Engine.tick;
    Engine.tick = function() {
        _syncState();
        return _origTick.apply(this, arguments);
    };

    // ── Sync on generate ──
    var _origGenerate = Engine.generate;
    Engine.generate = function() {
        _syncState();
        var result = _origGenerate.apply(this, arguments);
        _syncState();
        return result;
    };

    // ── Sync on load ──
    var _origLoad = Engine.load;
    Engine.load = function() {
        var result = _origLoad.apply(this, arguments);
        _syncState();
        return result;
    };
})(window.Engine);