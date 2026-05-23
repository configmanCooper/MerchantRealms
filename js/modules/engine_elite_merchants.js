// ========================================================
// engine_elite_merchants.js
// Elite Merchant AI, NPC Merchant AI, and Family Member Simulation
// Extracted from engine.js sections §19A1, §19A1B, §19A2, §19A3, §19B, §19B1b
// ========================================================
(function(Engine) {
    "use strict";
    if (!Engine) throw new Error("Engine must be loaded before engine_elite_merchants.js");

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
    var getPeopleInTown = function(id) { return Engine.getPeopleInTown(id); };
    var hasEmbargo = function(k1, k2) { return Engine.hasEmbargo(k1, k2); };
    var hasSpecialLaw = function(k, law) { return Engine.hasSpecialLaw(k, law); };

    function _isPlayerRelevantTown(townId) {
        if (typeof Player === 'undefined') return false;
        if ((Player.townId || (Player.state && Player.state.townId)) === townId) return true;
        if (Array.isArray(Player.buildings)) {
            for (var i = 0; i < Player.buildings.length; i++) {
                if (Player.buildings[i].townId === townId) return true;
            }
        }
        return false;
    }
    var convertBuilding = Engine.convertBuilding;
    var convertFarmBuilding = Engine.convertFarmBuilding;
    var getFarmConversionCost = Engine.getFarmConversionCost;
    var isCropFarm = Engine.isCropFarm;
    var isLivestockFarm = Engine.isLivestockFarm;
    var buyBlastingPowderFromKingdom = Engine.buyBlastingPowderFromKingdom;
    var _storeBackgroundGossip = function(type, msg, meta) { if (Engine.storeBackgroundGossip) Engine.storeBackgroundGossip(type, msg, meta); };

    function _bridgeNPCRelationship(personA, personBId, delta, reason) {
        if (typeof Engine !== 'undefined' && Engine.modifyNPCRelationship) {
            Engine.modifyNPCRelationship(personA, personBId, delta, reason);
            return true;
        }
        return false;
    }

    function _legacyRelationshipType(level) {
        if (level <= -50) return 'enemy';
        if (level <= -20) return 'rival';
        if (level < 40) return 'acquaintance';
        if (level < 80) return 'friend';
        return 'ally';
    }

    // ── Functions that MUST be newly exported from engine.js ──
    // These are internal engine.js functions not currently on window.Engine.
    // engine.js must add exports for each before this module can work.
    var uid = function() { return Engine.uid.apply(null, arguments); };
    var assignRandomQuirks = function(rng) { return Engine.assignRandomQuirks(rng); };
    var findResourceById = function(id) { return Engine.findResourceById(id); };
    var getMarketPrice = function(town, resId) { return Engine.getMarketPrice(town, resId); };
    var collectTradeTax = function(kId, amount, goodId) { Engine.collectTradeTax(kId, amount, goodId); };
    var distributeConstructionWages = function(townId, gold, rng) { Engine.distributeConstructionWages(townId, gold, rng); };
    var rebuildBridge = function(roadIdx, bridgeId) { return Engine.rebuildBridge(roadIdx, bridgeId); };
    var destroyBridge = function(roadIdx, bridgeId) { return Engine.destroyBridge(roadIdx, bridgeId); };
    var buildNewRoad = function(from, to, builtBy, opts) { return Engine.buildNewRoad(from, to, builtBy, opts); };
    var checkWaterPath = function(x1, y1, x2, y2) { return Engine.checkWaterPath(x1, y1, x2, y2); };
    var computeRoadImportance = function(a, b) { return Engine.computeRoadImportance(a, b); };
    var consumeFromMarket = function(town, resId, qty) { return Engine.consumeFromMarket(town, resId, qty); };
    var _checkSuppliesAvailable = function(bld, town, sev, isIll) { return Engine._checkSuppliesAvailable(bld, town, sev, isIll); };
    var getAverageWorkerSkill = function(bld, town) { return Engine.getAverageWorkerSkill(bld, town); };

    // ========================================================
    // §19A1 through §19A3 — Elite Merchant AI
    // Lines 23741-28531 from engine.js
    // ========================================================
    // §19A1  ELITE MERCHANT COUNT MANAGEMENT
    // ========================================================
    function createEliteMerchantFromNPC(npc) {
        npc.isEliteMerchant = true;
        // Preserve noble occupation — nobles can be elite merchants too
        if (npc.occupation !== 'noble') npc.occupation = 'merchant';
        npc.wealthClass = 'upper';
        npc.name = (npc.firstName || '') + ' ' + (npc.lastName || '');
        if (!npc.npcMerchantInventory) npc.npcMerchantInventory = {};
        if (!npc.buildings) npc.buildings = [];
        if (npc.npcMerchantCooldown == null) npc.npcMerchantCooldown = 0;
        // Ensure at least Burgher rank (2) in their kingdom
        if (!npc.socialRank) npc.socialRank = {};
        var emKingdomId = npc.kingdomId || npc.citizenshipKingdomId;
        if (emKingdomId) {
            var curRank = npc.socialRank[emKingdomId] || 0;
            if (curRank < 2) npc.socialRank[emKingdomId] = 2;
        }
        // Promotion gold bonus — ensure EMs start with enough capital to operate
        var minGold = 2000;
        var age = npc.age || 30;
        if (age <= 35) minGold = 1500;
        else if (age <= 50) minGold = 3000;
        else minGold = 5000;
        // Promotion bonus: +500g on top of whatever they have
        npc.gold = (npc.gold || 0) + 500;
        if (npc.gold < minGold) {
            npc.gold = minGold + Math.floor((world.rng ? world.rng.random() : Math.random()) * 2000);
        }
        // Assign unused heraldry
        if (!npc.heraldry && typeof ELITE_MERCHANT_HERALDRY !== 'undefined' && ELITE_MERCHANT_HERALDRY.length > 0) {
            var usedHeraldry = world.eliteMerchants.map(function(m) { return m.heraldry; }).filter(Boolean);
            var available = ELITE_MERCHANT_HERALDRY.filter(function(h) { return usedHeraldry.indexOf(h) === -1; });
            if (available.length > 0) {
                // v9p33river333: heraldry generation can run before world.rng is hydrated.
                npc.heraldry = available[Math.floor((world.rng ? world.rng.random() : Math.random()) * available.length)];
            } else {
                var hIdx = 0;
                for (var ci = 0; ci < (npc.id || '').length; ci++) hIdx = (hIdx * 31 + (npc.id || '').charCodeAt(ci)) | 0;
                hIdx = Math.abs(hIdx) % ELITE_MERCHANT_HERALDRY.length;
                npc.heraldry = ELITE_MERCHANT_HERALDRY[hIdx];
            }
        }
        npc._eliteFieldsInit = false;
        if (typeof Engine !== 'undefined' && Engine.initNPCRelationships) Engine.initNPCRelationships(npc);
        return npc;
    }

    function generateFreshEliteMerchant() {
        var rng = world.rng;
        if (!rng) return null;
        // Weighted town selection — higher prosperity towns attract more elite merchants
        var townWeights = world.towns.map(function(t) {
            var base = t.population || 100;
            var prospBonus = (t.prosperity || 50) / 50; // 0-2x multiplier
            var tierBonus = t.tier === 'capital' ? 3 : t.tier === 'city' ? 2 : t.tier === 'town' ? 1 : 0.3;
            return base * prospBonus * tierBonus;
        });
        var totalWeight = townWeights.reduce(function(s, w) { return s + w; }, 0);
        var roll = rng.random() * totalWeight;
        var cumulative = 0;
        var selectedTown = world.towns[0];
        for (var twi = 0; twi < world.towns.length; twi++) {
            cumulative += townWeights[twi];
            if (roll <= cumulative) { selectedTown = world.towns[twi]; break; }
        }
        var town = selectedTown;
        if (!town) return null;
        var sex = rng.chance(0.5) ? 'M' : 'F';
        var firstName = sex === 'M' ? rng.pick(NAMES.male) : rng.pick(NAMES.female);
        var lastName = rng.pick(NAMES.surnames);
        var age = rng.randInt(25, 55);
        var gold;
        if (age <= 35) gold = rng.randInt(500, 2000);
        else if (age <= 50) gold = rng.randInt(2000, 8000);
        else gold = rng.randInt(5000, 15000);

        var person = {
            id: uid('p'),
            firstName: firstName,
            lastName: lastName,
            age: age,
            sex: sex,
            alive: true,
            townId: town.id,
            kingdomId: town.kingdomId,
            occupation: 'merchant',
            employerId: null,
            needs: {
                food: rng.randInt(50, 80),
                shelter: rng.randInt(55, 85),
                safety: rng.randInt(50, 80),
                wealth: rng.randInt(40, 70),
                happiness: rng.randInt(50, 75),
            },
            gold: gold,
            skills: { farming: 5, mining: 5, crafting: 5, trading: rng.randInt(30, 70), combat: 5 },
            workerSkill: rng.randInt(30, 70),
            spouseId: null,
            childrenIds: [],
            parentIds: [],
            wealthClass: 'upper',
            isEliteMerchant: true,
            npcMerchantInventory: {},
            buildings: [],
            npcMerchantCooldown: 0,
            personality: {
                loyalty:      Math.floor((rng.random() + rng.random() + rng.random()) / 3 * 100),
                ambition:     Math.floor((rng.random() + rng.random() + rng.random()) / 3 * 100),
                frugality:    Math.floor((rng.random() + rng.random() + rng.random()) / 3 * 100),
                intelligence: Math.floor((rng.random() + rng.random() + rng.random()) / 3 * 100),
                warmth:       Math.floor((rng.random() + rng.random() + rng.random()) / 3 * 100),
                honesty:      Math.floor((rng.random() + rng.random() + rng.random()) / 3 * 100),
                selfishness:  Math.floor((rng.random() + rng.random() + rng.random()) / 3 * 100),
            },
            quirks: assignRandomQuirks(rng),
            foodPreferences: { bread: 1, meat: 1, poultry: 1, fish: 1, eggs: 1, preserved_food: 1 },
            recentFoods: [],
            medicalKnowledge: rng.chance(0.3) ? 'moderate' : (rng.chance(0.25) ? 'minor' : 'none'),
            health: 100,
            sick: false,
            illness: null,
            illnessDay: 0,
            injured: false,
            injuryDay: 0,
            houseType: gold > 5000 ? 'manor' : 'townhouse',
        };
        // Assign heraldry
        if (typeof ELITE_MERCHANT_HERALDRY !== 'undefined' && ELITE_MERCHANT_HERALDRY.length > 0) {
            var usedHeraldry = world.eliteMerchants.map(function(m) { return m.heraldry; }).filter(Boolean);
            var available = ELITE_MERCHANT_HERALDRY.filter(function(h) { return usedHeraldry.indexOf(h) === -1; });
            if (available.length > 0) {
                // v9p33river333: guard missing RNG during heraldry generation.
                person.heraldry = available[Math.floor((rng && rng.random ? rng.random() : Math.random()) * available.length)];
            } else {
                person.heraldry = ELITE_MERCHANT_HERALDRY[Math.floor((rng && rng.random ? rng.random() : Math.random()) * ELITE_MERCHANT_HERALDRY.length)];
            }
        }
        person._eliteFieldsInit = false;
        person.name = firstName + ' ' + lastName;
        world.people.push(person);
        if (town) town.population++;
        if (world._alivePopCount != null) world._alivePopCount++;
        if (typeof Engine !== 'undefined' && Engine.initNPCRelationships) Engine.initNPCRelationships(person);
        return person;
    }

    function emitTrackedEMNotification(em, message, details) {
        if (typeof Player === 'undefined') return;
        if (!Player.hasSkill || !Player.hasSkill('elite_tracker')) return;
        if (!Player.isTrackingMerchant || !Player.isTrackingMerchant(em.id)) return;
        // 50% chance to receive the notification
        if (world.rng && world.rng.random() > 0.50) return;
        var fullMsg = '⭐ ' + (em.firstName || 'Unknown') + ' ' + (em.lastName || '') + ': ' + message;
        logEvent(fullMsg,  Object.assign({ category: 'tracked', emId: em.id }, details || {}), 'npc_activity');
        if (typeof UI !== 'undefined' && UI.toast) {
            UI.toast(fullMsg, 'info', 'tracked');
        }
    }

    function tickEliteMerchantDynamics() {
        _syncState();
        if (!world || !world.eliteMerchants) return;
        
        // Count only alive, active EMs (not dead/demoted ones still in the list)
        var activeEmCount = 0;
        for (var aei = 0; aei < world.eliteMerchants.length; aei++) {
            if (world.eliteMerchants[aei].alive && world.eliteMerchants[aei].isEliteMerchant) activeEmCount++;
        }
        var emTarget = Math.max(CONFIG.ELITE_MERCHANT_MIN, Math.min(CONFIG.ELITE_MERCHANT_MAX, Math.ceil(world.towns.length / CONFIG.ELITE_MERCHANT_PER_TOWNS)));
        
        // ── Growth check: Organic EM emergence ──
        // Check every growth interval if new EMs should emerge
        if (world.day % (CONFIG.ELITE_MERCHANT_GROWTH_INTERVAL || 60) === 0) {
            // Organic promotion: wealthy NPC merchants can rise to EM status
            // B: Increased from 0.35 to 0.50 for faster growth
            var promotionChance = 0.50;
            
            // Only do growth-based spawning if below target
            var canGrowBeyondCurrent = activeEmCount < emTarget;
            
            // Find qualifying towns: any town with decent prosperity (>50) and tier city+
            var qualifyingTowns = world.towns.filter(function(t) {
                return (t.prosperity || 0) > 50 && (t.tier === 'capital' || t.tier === 'city' || (t.prosperity || 0) > 70);
            });
            
            if (qualifyingTowns.length > 0) {
                // Pick a random qualifying town
                var candidateTown = qualifyingTowns[Math.floor(world.rng.random() * qualifyingTowns.length)];
                var qk = findKingdom(candidateTown.kingdomId);
                
                // Kingdom must exist and have some gold (relaxed from 3000)
                if (qk && (qk.gold || 0) > 500) {
                    // Find wealthy NPC merchants in that town or nearby
                    var candidates = world.people.filter(function(p) {
                        return p.alive && (p.occupation === 'merchant' || p.occupation === 'noble') && !p.isEliteMerchant 
                            && p.townId === candidateTown.id && (p.gold || 0) > 200;
                    });
                    // Also check connected towns if none found locally
                    if (candidates.length === 0) {
                        var connTowns = [];
                        for (var cri = 0; cri < world.roads.length; cri++) {
                            var cr = world.roads[cri];
                            var _ctId = null;
                            if (cr.fromTownId === candidateTown.id) _ctId = cr.toTownId;
                            else if (cr.toTownId === candidateTown.id) _ctId = cr.fromTownId;
                            // v9p33river333: ignore stale road endpoints so null/deleted towns don't qualify merchants.
                            if (_ctId && findTown(_ctId) && connTowns.indexOf(_ctId) < 0) connTowns.push(_ctId);
                        }
                        candidates = world.people.filter(function(p) {
                            return p.alive && (p.occupation === 'merchant' || p.occupation === 'noble') && !p.isEliteMerchant 
                                && connTowns.indexOf(p.townId) >= 0 && (p.gold || 0) > 200;
                        });
                    }
                    candidates.sort(function(a, b) {
                        // Prefer guildmasters (rank 3) over lower-rank merchants
                        var aRank = (a.socialRank && a.socialRank[a.kingdomId]) || 0;
                        var bRank = (b.socialRank && b.socialRank[b.kingdomId]) || 0;
                        if (bRank !== aRank) return bRank - aRank;
                        return (b.gold || 0) - (a.gold || 0);
                    });
                    
                    if (candidates.length > 0 && world.rng.random() < promotionChance) {
                        if (canGrowBeyondCurrent || activeEmCount < CONFIG.ELITE_MERCHANT_MAX) {
                            var promoted = candidates[0];
                            createEliteMerchantFromNPC(promoted);
                            world.eliteMerchants.push(promoted);
                            activeEmCount++;
                            logEvent('🌟 ' + (promoted.firstName || '') + ' ' + (promoted.lastName || '') + ' of ' + (candidateTown.name || 'unknown') + ' has risen to become a renowned elite merchant! Their shrewd trading and growing wealth earned them a place among the elite.',  { 
                                type: 'elite_promotion',
                                townId: promoted.townId, 
                                category: 'npc_activity',
                                cause: (promoted.firstName || '') + ' accumulated ' + (promoted.gold || 0) + 'g through trading.',
                                effects: [
                                    'A new elite merchant dynasty begins',
                                    (promoted.firstName || '') + ' gains access to elite trade networks',
                                    'Competition among elite merchants intensifies'
                                ]
                            ,
                            _noToast: true}, 'npc_activity');
                            // B: Allow a second promotion per check if still below target
                            if (candidates.length > 1 && activeEmCount < emTarget && world.rng.random() < 0.30) {
                                var promoted2 = candidates[1];
                                createEliteMerchantFromNPC(promoted2);
                                world.eliteMerchants.push(promoted2);
                                activeEmCount++;
                                var _p2Town = findTown(promoted2.townId);
                                logEvent('🌟 ' + (promoted2.firstName || '') + ' ' + (promoted2.lastName || '') + ' of ' + (_p2Town ? _p2Town.name : 'unknown') + ' has also risen to elite merchant status!',  { 
                                    type: 'elite_promotion', townId: promoted2.townId, category: 'npc_activity'
                                ,
                                _noToast: true}, 'npc_activity');
                            }
                        }
                    }
                }
            }
            
            // E: Economic boom promotion — thriving towns have extra chance to spawn EMs
            if (activeEmCount < emTarget) {
                var thrivingTowns = world.towns.filter(function(t) { return (t.prosperity || 0) > 80; });
                for (var _tti = 0; _tti < thrivingTowns.length && activeEmCount < emTarget; _tti++) {
                    if (world.rng.random() < 0.08) { // 8% chance per thriving town per check
                        var _tt = thrivingTowns[_tti];
                        var _ttCands = world.people.filter(function(p) {
                            return p.alive && p.occupation === 'merchant' && !p.isEliteMerchant 
                                && p.townId === _tt.id && (p.gold || 0) > 150;
                        });
                        _ttCands.sort(function(a, b) { return (b.gold || 0) - (a.gold || 0); });
                        if (_ttCands.length > 0) {
                            var _boomEM = _ttCands[0];
                            createEliteMerchantFromNPC(_boomEM);
                            world.eliteMerchants.push(_boomEM);
                            activeEmCount++;
                            logEvent('🌟 The thriving economy of ' + _tt.name + ' has produced a new elite merchant: ' + (_boomEM.firstName || '') + ' ' + (_boomEM.lastName || '') + '!',  { 
                                type: 'elite_promotion', townId: _boomEM.townId, category: 'npc_activity',
                                cause: 'Economic boom in ' + _tt.name + ' (prosperity ' + Math.round(_tt.prosperity) + ')'
                            ,
                            _noToast: true}, 'npc_activity');
                        }
                    }
                }
            }
            
            // Fallback: if BELOW minimum active EMs, still force-fill (game needs some EMs)
            if (activeEmCount < CONFIG.ELITE_MERCHANT_MIN) {
                var fallbackCandidates = world.people.filter(function(p) {
                    return p.alive && p.occupation === 'merchant' && !p.isEliteMerchant && (p.gold || 0) > 200;
                });
                fallbackCandidates.sort(function(a, b) { return (b.gold || 0) - (a.gold || 0); });
                if (fallbackCandidates.length > 0) {
                    var fb = fallbackCandidates[0];
                    createEliteMerchantFromNPC(fb);
                    world.eliteMerchants.push(fb);
                    logEvent('🎯 ' + (fb.firstName || '') + ' ' + (fb.lastName || '') + ' has risen to fill the ranks of elite merchants.',  { townId: fb.townId, category: 'npc_activity' , _noToast: true}, 'npc_activity');
                } else {
                    var newFb = generateFreshEliteMerchant();
                    if (newFb) world.eliteMerchants.push(newFb);
                }
            }
        }
        
        // ── Decline: check for bankrupt EMs ──
        for (var bi = world.eliteMerchants.length - 1; bi >= 0; bi--) {
            var em = world.eliteMerchants[bi];
            if (!em || !em.alive) continue;
            
            if ((em.gold || 0) < (CONFIG.ELITE_MERCHANT_BANKRUPTCY_GOLD || 50)) {
                em._bankruptDays = (em._bankruptDays || 0) + 1;
                if (em._bankruptDays === 1) {
                    emitTrackedEMNotification(em, 'is struggling financially! Gold below ' + (CONFIG.ELITE_MERCHANT_BANKRUPTCY_GOLD || 50) + 'g.', { townId: em.townId });
                }
            } else {
                em._bankruptDays = 0;
            }
            
            // Demote if bankrupt too long AND we're above minimum
            if (em._bankruptDays >= (CONFIG.ELITE_MERCHANT_BANKRUPTCY_DAYS || 30) && 
                world.eliteMerchants.length > CONFIG.ELITE_MERCHANT_MIN) {
                em.isEliteMerchant = false;
                em.wealthClass = em.occupation === 'noble' ? 'upper' : 'middle';
                em._eliteFieldsInit = false;
                // Demoted EMs retain Guildmaster rank (3), but nobles keep their noble rank
                if (!em.socialRank) em.socialRank = {};
                var _emDemKid = em.kingdomId || em.citizenshipKingdomId;
                if (_emDemKid) {
                    var _curDemRank = em.socialRank[_emDemKid] || 0;
                    if (_curDemRank < 3) em.socialRank[_emDemKid] = 3;
                }
                world.eliteMerchants.splice(bi, 1);
                logEvent('📉 ' + (em.firstName || '') + ' ' + (em.lastName || '') + ' has lost their elite merchant status due to bankruptcy.',  { townId: em.townId, category: 'npc_activity' , _noToast: true}, 'npc_activity');
            }
        }
    }

    function ensureEliteMerchantCount() {
        _syncState();
        if (!world || !world.eliteMerchants) return;
        // Remove dead ones
        world.eliteMerchants = world.eliteMerchants.filter(function(m) { return m.alive !== false; });

        // Refill only to minimum — dynamic target is reached organically via tickEliteMerchantDynamics
        while (world.eliteMerchants.length < CONFIG.ELITE_MERCHANT_MIN) {
            var merchants = world.people.filter(function(p) {
                return p.alive && p.occupation === 'merchant' && !p.isEliteMerchant;
            });
            // Calculate value: gold + building count * 500 as rough proxy
            merchants.sort(function(a, b) {
                var aVal = (a.gold || 0) + ((a.buildings ? a.buildings.length : 0) * 500);
                var bVal = (b.gold || 0) + ((b.buildings ? b.buildings.length : 0) * 500);
                return bVal - aVal;
            });

            if (merchants.length > 0) {
                var promoted = merchants[0];
                createEliteMerchantFromNPC(promoted);
                world.eliteMerchants.push(promoted);
                logEvent('\uD83D\uDCC8 ' + promoted.firstName + ' ' + (promoted.lastName || '') + ' has risen to become a renowned elite merchant!', {
                    type: 'elite_promotion',
                    cause: promoted.firstName + ' ' + (promoted.lastName || '') + ' accumulated enough wealth and reputation to join the elite merchant ranks.',
                    effects: [
                        'A new elite merchant dynasty begins',
                        promoted.firstName + ' gains access to elite trade networks',
                        'Competition among elite merchants intensifies'
                    ]
                }, 'npc_activity');
            } else {
                var newElite = generateFreshEliteMerchant();
                if (newElite) {
                    world.eliteMerchants.push(newElite);
                }
            }
        }
    }

    // ========================================================
    // §19A1B  ELITE MERCHANT GUILD AI
    // ========================================================
    // Maps EM strategies to relevant guild IDs
    var STRATEGY_GUILDS = {
        food_monopoly:     ['farmers', 'merchants'],
        military_supplier: ['miners', 'armorsmiths', 'merchants'],
        luxury_trader:     ['luxury', 'craftsmen', 'merchants'],
        diversified:       ['merchants', 'artisans', 'farmers'],
        political_climber: ['luxury', 'merchants'],
        war_profiteer:     ['armorsmiths', 'miners', 'merchants'],
        land_baron:        ['farmers', 'harvesters', 'miners'],
        trade_network:     ['merchants', 'artisans', 'maritime'],
        medical_supplier:  ['healers', 'harvesters'],
    };

    function tickEMGuildAI() {
        _syncState();
        if (!world) return;
        if (world.day % 60 !== 25) return; // Every 60 days
        var rng = world.rng;
        if (!rng) return;

        var guilds = CONFIG.GUILDS;
        if (!guilds || guilds.length === 0) return;

        var elites = (_tickCache.eliteMerchants || world.people.filter(function(p) { return p.alive && p.isEliteMerchant; }));
        for (var i = 0; i < elites.length; i++) {
            var em = elites[i];
            if (!em.guilds) em.guilds = {};

            // Determine which guilds this EM should join based on strategy
            var targetGuildIds = STRATEGY_GUILDS[em.strategy] || ['merchants'];

            // Also add guilds matching any buildings the EM owns
            var emTown = em.townId ? world.towns.find(function(t) { return t.id === em.townId; }) : null;
            if (emTown && Array.isArray(emTown.buildings)) {
                // v9p33river333: some legacy towns have no buildings array.
                var emBuildings = emTown.buildings.filter(function(b) { return b && b.ownerId === em.id; });
                for (var ebi = 0; ebi < emBuildings.length; ebi++) {
                    var ebType = findBuildingType(emBuildings[ebi].type);
                    if (ebType && ebType.category) {
                        for (var _gKey in guilds) {
                            var _gDef = guilds[_gKey];
                            if (_gDef.categories && _gDef.categories.indexOf(ebType.category) >= 0 && targetGuildIds.indexOf(_gKey) < 0) {
                                targetGuildIds.push(_gKey);
                            }
                        }
                    }
                }
            }

            for (var gi = 0; gi < targetGuildIds.length; gi++) {
                var guildId = targetGuildIds[gi];
                var membership = em.guilds[guildId];

                // Already a member and not expired
                if (membership && membership.expiresDay && membership.expiresDay > world.day) continue;

                // Cost: yearly membership (200g for normal, 800g for merchants)
                var cost = guildId === 'merchants' ? 800 : 200;
                // Wealthy EMs always join; poorer ones only join primary guild
                var isHighPriority = gi === 0; // First guild in list is highest priority
                var minGold = isHighPriority ? cost * 2 : cost * 5;

                if ((em.gold || 0) < minGold) continue;

                // Join probability: high priority = 90%, secondary = 40%
                if (!isHighPriority && !rng.chance(0.4)) continue;

                em.gold -= cost;
                em.guilds[guildId] = {
                    joinedDay: world.day,
                    expiresDay: world.day + CONFIG.DAYS_PER_SEASON,
                    type: 'yearly'
                };

                // Guild benefits: production bonus, trade discount tracked on EM
                if (!em._guildBonuses) em._guildBonuses = {};
                em._guildBonuses[guildId] = {
                    productionBonus: 0.10,   // 10% production efficiency
                    tradeDiscount: 0.05,     // 5% better prices
                    reputationBoost: 5       // +5 reputation in kingdom
                };

                // Small reputation boost for joining
                if (em.kingdomId) {
                    // v9p33river333: initialize missing reputation map before applying guild bonus.
                    if (!em.reputation) em.reputation = {};
                    em.reputation[em.kingdomId] = Math.min(100, (em.reputation[em.kingdomId] || 50) + 3);
                }

                // Mark EM-owned buildings in this guild's categories as inGuild
                if (emTown) {
                    var gDef = guilds[guildId];
                    if (gDef && gDef.categories) {
                        for (var mbi = 0; mbi < emTown.buildings.length; mbi++) {
                            var mbld = emTown.buildings[mbi];
                            if (mbld.ownerId !== em.id) continue;
                            var mbType = findBuildingType(mbld.type);
                            if (mbType && gDef.categories.indexOf(mbType.category) >= 0) {
                                mbld.inGuild = true;
                            }
                        }
                    }
                }
            }

            // Let expired memberships lapse — frugal EMs or struggling ones won't renew
            for (var gk in em.guilds) {
                if (em.guilds[gk].expiresDay && em.guilds[gk].expiresDay <= world.day) {
                    delete em.guilds[gk];
                    if (em._guildBonuses) delete em._guildBonuses[gk];
                    // Remove inGuild from EM buildings in this guild's categories
                    if (emTown) {
                        var expGDef = guilds[gk];
                        if (expGDef && expGDef.categories) {
                            for (var xbi = 0; xbi < emTown.buildings.length; xbi++) {
                                var xbld = emTown.buildings[xbi];
                                if (xbld.ownerId !== em.id) continue;
                                var xbType = findBuildingType(xbld.type);
                                if (xbType && expGDef.categories.indexOf(xbType.category) >= 0) {
                                    xbld.inGuild = false;
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // ========================================================
    // §19A2  ELITE MERCHANT DEEP AI SIMULATION
    // ========================================================
    const ELITE_STRATEGIES = ['food_monopoly', 'military_supplier', 'luxury_trader', 'diversified', 'political_climber', 'war_profiteer', 'land_baron', 'trade_network', 'medical_supplier', 'culture_trader', 'retail_mogul'];

    const STRATEGY_GOODS = {
        food_monopoly:     ['wheat', 'bread', 'meat', 'fish', 'eggs', 'flour', 'preserved_food'],
        military_supplier: ['swords', 'swords_good', 'swords_excellent', 'armor', 'armor_good', 'armor_excellent', 'bows', 'bows_good', 'bows_excellent', 'iron', 'iron_ore', 'tools', 'blasting_powder', 'demolition_tools', 'arrows', 'arrows_good', 'steel', 'charcoal', 'coal'],
        luxury_trader:     ['jewelry', 'wine', 'silk', 'spices', 'gold_ore', 'dye', 'furniture', 'fine_clothes', 'cloth', 'drum', 'lute', 'harp'],
        diversified:       ['wheat', 'cloth', 'tools', 'iron', 'wood', 'bread', 'wool'],
        political_climber: ['wine', 'jewelry', 'silk', 'furniture', 'spices'],
        war_profiteer:     ['swords', 'swords_good', 'swords_excellent', 'armor', 'armor_good', 'armor_excellent', 'bows', 'bows_good', 'bows_excellent', 'bread', 'preserved_food', 'iron', 'blasting_powder', 'demolition_tools', 'arrows', 'arrows_good', 'steel', 'charcoal', 'coal'],
        land_baron:        ['wheat', 'wood', 'stone', 'wool', 'iron_ore'],
        trade_network:     ['cloth', 'tools', 'salt', 'spices', 'wine', 'dye', 'leather', 'preserved_food', 'ale'],
        culture_trader:    ['drum', 'flute', 'lute', 'harp', 'hurdy_gurdy', 'gut_string', 'cloth', 'silk', 'fine_clothes', 'clothes', 'wool', 'dye'],
        retail_mogul:      ['ale', 'mead', 'wine', 'bread', 'meat', 'clothes', 'fine_clothes', 'tools', 'furniture', 'jewelry', 'silk', 'leather'],
    };

    const STRATEGY_BUILDINGS = {
        food_monopoly:     ['wheat_farm', 'flour_mill', 'bakery', 'cattle_ranch', 'fishery', 'smokehouse', 'chicken_farm', 'restaurant', 'warehouse_small'],
        military_supplier: ['blacksmith', 'iron_mine', 'smelter', 'toolsmith', 'armory_shop', 'warehouse_small', 'wheelwright', 'powder_works', 'armorer', 'fletcher', 'arrow_maker', 'charcoal_kiln', 'coal_mine', 'lumber_camp'],
        luxury_trader:     ['jeweler', 'vineyard', 'winery', 'weaver', 'jewelers_boutique', 'clothing_shop', 'warehouse_small', 'silk_weaver', 'fine_tailor'],
        diversified:       ['wheat_farm', 'bakery', 'blacksmith', 'weaver', 'sawmill', 'tanner', 'general_store', 'tavern', 'warehouse_small', 'wheelwright'],
        political_climber: ['vineyard', 'winery', 'jeweler', 'market_stall', 'jewelers_boutique', 'warehouse_small'],
        war_profiteer:     ['blacksmith', 'smelter', 'iron_mine', 'bakery', 'armory_shop', 'warehouse', 'armorer', 'fletcher', 'arrow_maker', 'charcoal_kiln', 'coal_mine', 'lumber_camp'],
        land_baron:        ['wheat_farm', 'cattle_ranch', 'sheep_farm', 'lumber_camp', 'iron_mine', 'pig_farm', 'restaurant', 'warehouse', 'wheelwright'],
        trade_network:     ['market_stall', 'weaver', 'salt_works', 'tanner', 'toolsmith', 'brewery', 'smokehouse', 'general_store', 'warehouse', 'wheelwright'],
        medical_supplier:  ['herb_garden', 'apothecary', 'advanced_apothecary', 'bandage_workshop', 'clinic', 'herbalist_hut', 'warehouse_small'],
        culture_trader:    ['instrument_workshop', 'drum_maker', 'weaver', 'silk_weaver', 'fine_tailor', 'clothing_shop', 'tanner', 'sheep_farm', 'tavern', 'warehouse_small'],
        retail_mogul:      ['tavern', 'restaurant', 'clothing_shop', 'general_store', 'jewelers_boutique', 'armory_shop', 'brewery', 'bakery', 'weaver', 'warehouse_small'],
    };

    function ensureEliteMerchantFields(em) {
        _syncState();
        if (em._eliteFieldsInit) return;
        var rng = world.rng;
        // Personality — extend existing; preserve old values
        if (!em.personality) em.personality = {};
        var p = em.personality;
        if (p.ambition == null || typeof p.ambition === 'string') p.ambition = Math.floor((rng.random() + rng.random() + rng.random()) / 3 * 100);
        if (p.greed == null || typeof p.greed === 'string') p.greed = Math.floor((rng.random() + rng.random() + rng.random()) / 3 * 100);
        if (p.risk_tolerance == null) p.risk_tolerance = Math.floor((rng.random() + rng.random() + rng.random()) / 3 * 100);
        if (p.honesty == null || typeof p.honesty === 'string') p.honesty = Math.floor((rng.random() + rng.random() + rng.random()) / 3 * 100);
        if (p.social == null) p.social = Math.floor((rng.random() + rng.random() + rng.random()) / 3 * 100);
        if (p.loyalty == null || typeof p.loyalty === 'string') p.loyalty = Math.floor((rng.random() + rng.random() + rng.random()) / 3 * 100);
        if (p.militarism == null) p.militarism = Math.floor((rng.random() + rng.random() + rng.random()) / 3 * 100);
        if (p.patience == null) p.patience = Math.floor((rng.random() + rng.random() + rng.random()) / 3 * 100);

        if (!em.strategy) {
            // Pick strategy influenced by personality
            if (p.militarism > 65) em.strategy = rng.chance(0.5) ? 'military_supplier' : 'war_profiteer';
            else if (p.ambition > 70 && p.social > 60) em.strategy = 'political_climber';
            else if (p.social > 70 && p.patience > 45) em.strategy = rng.chance(0.3) ? 'retail_mogul' : rng.chance(0.5) ? 'culture_trader' : 'luxury_trader';
            else if (p.greed > 65 && p.patience > 55) em.strategy = 'land_baron';
            else if (p.risk_tolerance > 65) em.strategy = rng.pick(['luxury_trader', 'trade_network']);
            else if ((em.personality.warmth || p.warmth || 0) > 70 && p.patience > 50) em.strategy = 'medical_supplier';
            else if (p.patience > 60) em.strategy = 'food_monopoly';
            else em.strategy = rng.pick(ELITE_STRATEGIES);
        }

        if (!em.relationships) em.relationships = {};
        if (!em.socialRank) em.socialRank = {};
        if (em.citizenshipKingdomId == null) em.citizenshipKingdomId = em.kingdomId || null;
        if (!em.reputation) {
            em.reputation = {};
            if (em.kingdomId) em.reputation[em.kingdomId] = 50 + Math.floor(rng.random() * 30);
        }
        if (!em.familyName) em.familyName = em.lastName || em.firstName || 'Unknown';
        if (!em.name || em.name === 'Unknown') em.name = (em.firstName || '') + ' ' + (em.lastName || em.familyName || '');
        if (em.heirId === undefined) em.heirId = null;
        if (em.netWorth === undefined) em.netWorth = 0;
        if (em.ordersCompleted === undefined) em.ordersCompleted = 0;
        if (em.ordersFailed === undefined) em.ordersFailed = 0;
        if (em.crimesCommitted === undefined) em.crimesCommitted = 0;
        if (!em.criminalRecord) em.criminalRecord = {};
        if (em.tradingStartDay === undefined) em.tradingStartDay = 0;
        if (!em.supplyDeals) em.supplyDeals = [];
        if (em.jailedUntilDay === undefined) em.jailedUntilDay = 0;
        // Kingdom-aware AI tracking fields
        if (!em._kingdomAwareness) em._kingdomAwareness = {};
        if (em._lastCollapseCheck === undefined) em._lastCollapseCheck = 0;
        if (em._lastMigrationCheck === undefined) em._lastMigrationCheck = 0;
        if (em._assetsDiversified === undefined) em._assetsDiversified = false;
        if (em._seizureVictim === undefined) em._seizureVictim = false;
        if (em._nationalizedPivot === undefined) em._nationalizedPivot = false;
        if (em._bountiesFulfilled === undefined) em._bountiesFulfilled = 0;
        if (em._kingRelationship === undefined) em._kingRelationship = {};
        if (em._competitorTracking === undefined) em._competitorTracking = {};
        // Financial distress tracking
        if (em._lowGoldDays === undefined) em._lowGoldDays = 0;
        if (em._criticalGoldDays === undefined) em._criticalGoldDays = 0;
        // Wagon/transport ownership
        if (em._wagons === undefined) em._wagons = 0;
        if (em._lastWagonCheck === undefined) em._lastWagonCheck = 0;
        // Elite merchant skill system
        if (!em.emSkills) em.emSkills = {};
        if (em.emXp === undefined) em.emXp = 0;
        if (em.emTotalXp === undefined) em.emTotalXp = 0;
        if (em.emLevel === undefined) em.emLevel = 1;
        if (em.emSkillPoints === undefined) em.emSkillPoints = 0;
        if (em._lastSkillCheck === undefined) em._lastSkillCheck = 0;
        // Social rank init: 1 (citizen) for most, higher for wealthy
        if (!em.socialRank[em.kingdomId || '']) {
            var rankIdx = 1;
            if ((em.gold || 0) >= 5000) rankIdx = 2;
            if ((em.gold || 0) >= 20000) rankIdx = 3;
            if (em.kingdomId) em.socialRank[em.kingdomId] = rankIdx;
        }

        // Seed starting skills for new EMs
        if (Object.keys(em.emSkills).length === 0) {
            // All EMs start with keen_eye (basic market awareness)
            em.emSkills.keen_eye = true;

            // Older/wealthier EMs have more skills
            var startingSkills = 1;
            if ((em.gold || 0) >= 5000) startingSkills += 1;
            if ((em.gold || 0) >= 10000) startingSkills += 1;
            if ((em.age || 30) >= 40) startingSkills += 1;
            if ((em.age || 30) >= 50) startingSkills += 1;

            // Personality-driven skill choices
            var candidateSkills = [];
            var p2 = em.personality;

            // Commerce skills based on trading ability
            if (p2.greed > 50) candidateSkills.push('haggler', 'silver_tongue');
            if (p2.patience > 50) candidateSkills.push('market_scout', 'bulk_trader');
            if (p2.ambition > 60) candidateSkills.push('trade_network', 'master_haggler');

            // Industry skills for builders
            var strat = em.strategy || 'diversified';
            if (strat === 'land_baron' || strat === 'food_monopoly') candidateSkills.push('efficient_builder', 'foreman', 'master_builder');
            if (strat === 'military_supplier') candidateSkills.push('efficient_builder', 'foreman', 'war_profiteer');

            // Social skills for climbers
            if (p2.social > 50 || strat === 'political_climber') candidateSkills.push('charming', 'political_connections', 'court_etiquette');

            // Transport for traders
            if (strat === 'trade_network' || strat === 'luxury_trader') candidateSkills.push('road_knowledge', 'caravan_master', 'expert_navigator');

            // Underworld for dishonest
            if (p2.honesty < 35) candidateSkills.push('discrete', 'bribe_expert');
            if (p2.honesty < 25 && p2.risk_tolerance > 60) candidateSkills.push('master_smuggler', 'black_market_contacts');
            // v9p33river197: more underworld skill leanings — gives EMs the
            // tools to actually run the new scheme types (frame, forge,
            // bribe officials, etc.) and the social/disguise skills they
            // need to do them quietly.
            if (p2.honesty < 30 && p2.risk_tolerance > 50) candidateSkills.push('shadow_dealings');
            if (p2.honesty < 30 && p2.greed > 55) candidateSkills.push('master_forger', 'silver_tongue_dark');
            if (p2.honesty < 35 && p2.risk_tolerance > 60) candidateSkills.push('arsonist_skill', 'jail_break');
            // v9p33river211: poisoner skill for selfish + dishonest EMs
            if (p2.honesty < 30 && p2.selfishness > 55) candidateSkills.push('poisoner');
            if (p2.honesty < 25 && p2.risk_tolerance > 70) candidateSkills.push('master_disguise', 'ghost', 'untouchable');

            // Survival for military types
            if (p2.militarism > 50) candidateSkills.push('combat_trained', 'street_smart');

            // Remove duplicates
            var uniqueCandidates = [];
            for (var sci = 0; sci < candidateSkills.length; sci++) {
                if (uniqueCandidates.indexOf(candidateSkills[sci]) === -1 && SKILLS[candidateSkills[sci]]) {
                    uniqueCandidates.push(candidateSkills[sci]);
                }
            }

            // Shuffle and pick
            for (var ssi = uniqueCandidates.length - 1; ssi > 0; ssi--) {
                var swapIdx = Math.floor(rng.random() * (ssi + 1));
                var tmp = uniqueCandidates[ssi];
                uniqueCandidates[ssi] = uniqueCandidates[swapIdx];
                uniqueCandidates[swapIdx] = tmp;
            }

            // Assign skills, respecting prerequisites
            var assigned = 0;
            for (var asi = 0; asi < uniqueCandidates.length && assigned < startingSkills; asi++) {
                var skillId = uniqueCandidates[asi];
                var skillDef = SKILLS[skillId];
                if (!skillDef || em.emSkills[skillId]) continue;
                // Check prerequisites
                var prereqsMet = true;
                if (skillDef.requires) {
                    for (var pri = 0; pri < skillDef.requires.length; pri++) {
                        if (!em.emSkills[skillDef.requires[pri]]) { prereqsMet = false; break; }
                    }
                }
                if (prereqsMet) {
                    em.emSkills[skillId] = true;
                    assigned++;
                }
            }

            // Set starting XP/level based on skills
            em.emLevel = 1 + Object.keys(em.emSkills).length;
            em.emTotalXp = em.emLevel * 500;
        }

        // Land ownership tracking (mirrors player.landOwned)
        if (!em.landOwned) {
            em.landOwned = {};
            // Backfill: count existing buildings as owned land
            if (em.buildings) {
                for (var _li = 0; _li < em.buildings.length; _li++) {
                    var _lt = em.buildings[_li].townId;
                    if (_lt) em.landOwned[_lt] = (em.landOwned[_lt] || 0) + 1;
                }
            }
        }

        em._eliteFieldsInit = true;

        // Heraldry assignment (fallback for merchants without heraldry)
        if (!em.heraldry && typeof ELITE_MERCHANT_HERALDRY !== 'undefined' && ELITE_MERCHANT_HERALDRY.length > 0) {
            var hIdx = 0;
            for (var ci = 0; ci < (em.id || '').length; ci++) hIdx = (hIdx * 31 + (em.id || '').charCodeAt(ci)) | 0;
            hIdx = Math.abs(hIdx) % ELITE_MERCHANT_HERALDRY.length;
            em.heraldry = ELITE_MERCHANT_HERALDRY[hIdx];
        }

        // Housing: assign house type based on wealth
        if (!em.houseType) {
            if ((em.gold || 0) > 5000) em.houseType = rng.pick(['merchant_house', 'manor']);
            else if ((em.gold || 0) > 1000) em.houseType = 'townhouse';
            else if ((em.gold || 0) > 200) em.houseType = 'cottage';
            else em.houseType = rng.chance(0.7) ? 'shack' : null;
        }
    }

    function emHasSkill(em, skillId) {
        return em.emSkills && em.emSkills[skillId] === true;
    }

    function grantEmXp(em, amount, reason) {
        if (!em || amount <= 0) return;
        em.emXp = (em.emXp || 0) + amount;
        em.emTotalXp = (em.emTotalXp || 0) + amount;
        // v9p33river308: MERCHANT_LEVELS and SKILL_POINTS_PER_LEVEL are
        // top-level consts (config.js:3417, 3455), NOT CONFIG properties.
        // Was always early-returning so EMs gained XP but never leveled.
        var levels = (typeof MERCHANT_LEVELS !== 'undefined') ? MERCHANT_LEVELS : null;
        if (!levels) return;
        var newLevel = em.emLevel || 1;
        for (var li = 0; li < levels.length; li++) {
            if (em.emTotalXp >= levels[li].xp) newLevel = levels[li].level;
        }
        if (newLevel > (em.emLevel || 1)) {
            var levelsGained = newLevel - (em.emLevel || 1);
            var _spPerLvl = (typeof SKILL_POINTS_PER_LEVEL !== 'undefined') ? SKILL_POINTS_PER_LEVEL : 4;
            em.emSkillPoints = (em.emSkillPoints || 0) + levelsGained * _spPerLvl;
            em.emLevel = newLevel;
            logEvent(em.name + ' has reached merchant level ' + newLevel + '!',  {
                type: 'elite_level_up',
                townId: em.townId,
                cause: em.name + ' gained enough experience to level up.',
                // v9p33river315: was reading CONFIG.SKILL_POINTS_PER_LEVEL
                // which doesn't exist (top-level const), producing NaN in
                // the toast text. Use the _spPerLvl resolved above.
                effects: [em.name + ' is now level ' + newLevel, 'Gained ' + (levelsGained * _spPerLvl) + ' skill points']
            ,
            _noToast: true}, 'npc_activity');
        }
    }

    // ── NPC Caravan System (EM + Kingdom) ──────────────────────────

    function tickEMCaravans() {
        _syncState();
        if (!world || !world.eliteMerchants) return;
        if (world.day % (CONFIG.EM_CARAVAN_DECISION_INTERVAL || 7) !== 0) return;

        var rng = world.rng;
        if (!rng) return;
        if (!world.npcCaravans) world.npcCaravans = [];

        for (var ei = 0; ei < world.eliteMerchants.length; ei++) {
            var em = world.eliteMerchants[ei];
            if (!em || !em.alive || em.traveling) continue;

            // Count active caravans for this EM
            var activeCaravans = 0;
            for (var ci = 0; ci < world.npcCaravans.length; ci++) {
                if (world.npcCaravans[ci].ownerId === em.id && world.npcCaravans[ci].status !== 'completed') {
                    activeCaravans++;
                }
            }
            if (activeCaravans >= (CONFIG.EM_CARAVAN_MAX_PER_EM || 4)) continue;

            // Can they afford it?
            var hireCost = CONFIG.EM_CARAVAN_HIRE_COST || 200;
            if ((em.gold || 0) < hireCost * 1.5) continue;

            // Find best destination based on strategy and arbitrage
            var town = findTown(em.townId);
            if (!town || !town.connectedTowns || town.connectedTowns.length === 0) continue;

            var strategy = em.strategy || 'diversified';
            var preferredGoods = (typeof STRATEGY_GOODS !== 'undefined' && STRATEGY_GOODS[strategy]) || [];
            var inv = em.npcMerchantInventory || {};

            var bestDest = null;
            var bestScore = 0;
            var bestGoods = {};

            for (var di = 0; di < town.connectedTowns.length; di++) {
                var dest = findTown(town.connectedTowns[di]);
                if (!dest || !dest.market) continue;

                var score = 0;
                var sendGoods = {};
                var totalWeight = 0;
                var maxCapacity = Math.min(CONFIG.EM_CARAVAN_CAPACITY_MAX || 200,
                                           CONFIG.EM_CARAVAN_CAPACITY_MIN + Math.floor((em.gold || 0) / 50));
                // v9p33river194: tier-weighted transport capacity bonus
                // (was flat +100 per wagon). Reads em._transports if set,
                // otherwise falls back to flat +100 × em._wagons (legacy EMs).
                var _wagonBonus = 0;
                if (em._transports) {
                    var _tCaps = { backpack: 15, cart: 40, small_wagon: 70, wagon: 100, large_wagon: 150 };
                    for (var _tk in _tCaps) {
                        _wagonBonus += (em._transports[_tk] || 0) * _tCaps[_tk];
                    }
                    // Cap at 450 (3× large wagon equivalent) so a hoarder isn't infinite
                    if (_wagonBonus > 450) _wagonBonus = 450;
                } else {
                    _wagonBonus = Math.min((em._wagons || 0), 3) * 100;
                }
                maxCapacity += _wagonBonus;

                // Score based on goods we can send from inventory
                for (var resId in inv) {
                    if ((inv[resId] || 0) <= 2) continue;
                    var localPrice = (town.market.prices[resId] || 0);
                    var destPrice = (dest.market.prices[resId] || 0);

                    if (destPrice > localPrice * 1.2) {
                        var _resDef = findResourceById ? findResourceById(resId) : null;
                        var _unitWeight = (_resDef && _resDef.weight) || 1;
                        var sendQty = Math.min(inv[resId] - 2, Math.floor((maxCapacity - totalWeight) / _unitWeight));
                        if (sendQty > 0) {
                            sendGoods[resId] = sendQty;
                            totalWeight += sendQty * _unitWeight; // v9p33river329: capacity is weight, not item count.
                            score += (destPrice - localPrice) * sendQty;
                        }
                    }
                }

                // Score buying opportunities at destination (for return trip)
                for (var rk in dest.market.prices) {
                    var dPrice = dest.market.prices[rk] || 0;
                    var lPrice = town.market.prices[rk] || 0;
                    if (dPrice > 0 && lPrice > dPrice * 1.3) {
                        score += (lPrice - dPrice) * 5;
                    }
                }

                // Prosperity bonus for destination
                score += (dest.prosperity || 50) * 0.5;

                if (score > bestScore) {
                    bestScore = score;
                    bestDest = dest.id;
                    bestGoods = sendGoods;
                }
            }

            if (bestDest && bestScore > 50) {
                em.gold -= hireCost;

                // Remove goods from EM inventory
                for (var gk in bestGoods) {
                    inv[gk] = (inv[gk] || 0) - bestGoods[gk];
                    if (inv[gk] <= 0) delete inv[gk];
                }

                // Decide mode based on personality
                var mode = 'roundtrip';
                if (em.personality && em.personality.patience > 60 && rng.random() > 0.4) {
                    mode = 'continuous';
                } else if (rng.random() > 0.7) {
                    mode = 'one_way';
                }

                world.npcCaravans.push({
                    id: 'npc_caravan_' + world.day + '_' + ei,
                    ownerId: em.id,
                    ownerType: 'em',
                    fromTownId: em.townId,
                    toTownId: bestDest,
                    goods: bestGoods,
                    // v9p33river311: spawn now uses the same wealth-aware
                    // formula the scoring loop computed in `maxCapacity`,
                    // so a low-wealth merchant can't launch a 200+wagon-
                    // bonus caravan they couldn't actually have planned.
                    capacity: maxCapacity,
                    progress: 0,
                    speed: CONFIG.EM_CARAVAN_SPEED || 0.08,
                    startDay: world.day,
                    status: 'traveling',
                    mode: mode,
                    returnGoods: {},
                    tripCount: 0,
                });
                emitTrackedEMNotification(em, 'hired a caravan to ' + ((findTown(bestDest) || {}).name || 'unknown'), { townId: em.townId });
            }
        }
    }

    function tickNPCCaravans() {
        _syncState();
        if (!world || !world.npcCaravans) return;

        for (var ci = world.npcCaravans.length - 1; ci >= 0; ci--) {
            var caravan = world.npcCaravans[ci];
            if (!caravan || caravan.status === 'completed') {
                world.npcCaravans.splice(ci, 1);
                continue;
            }

            // Move caravan
            caravan.progress = (caravan.progress || 0) + (caravan.speed || 0.08);

            if (caravan.progress >= 1.0) {
                caravan.progress = 0;

                if (caravan.status === 'traveling') {
                    // Arrived at destination — sell goods
                    var destTown = findTown(caravan.toTownId);
                    if (destTown && destTown.market) {
                        var totalRevenue = 0;
                        var totalTariffPaid = 0;
                        // Determine tariff: foreign caravans pay destination kingdom tariff
                        var _cDestK = destTown.kingdomId ? findKingdom(destTown.kingdomId) : null;
                        var _cOriginTown = findTown(caravan.fromTownId);
                        var _cOriginKId = _cOriginTown ? _cOriginTown.kingdomId : null;
                        var _cTariffRate = 0;
                        if (_cDestK && _cDestK.laws && _cOriginKId !== destTown.kingdomId) {
                            _cTariffRate = _cDestK.laws.tradeTariff || 0;
                            var _cSpecLaws = _cDestK.laws.specialLaws || [];
                            for (var _sli = 0; _sli < _cSpecLaws.length; _sli++) {
                                var _csId = typeof _cSpecLaws[_sli] === 'string' ? _cSpecLaws[_sli] : (_cSpecLaws[_sli].id || '');
                                if (_csId === 'open_market') { _cTariffRate = 0; break; }
                                if (_csId === 'foreign_ban') _cTariffRate += 0.25;
                            }
                            _cTariffRate = Math.min(_cTariffRate, 0.35);
                        }
                        for (var resId in caravan.goods) {
                            var qty = caravan.goods[resId] || 0;
                            if (qty <= 0) continue;
                            var price = destTown.market.prices[resId] || 1;
                            var grossRevenue = Math.floor(price * qty * 0.85); // 15% caravan overhead
                            var tariffAmt = Math.floor(grossRevenue * _cTariffRate);
                            var revenue = grossRevenue - tariffAmt;
                            totalRevenue += revenue;
                            totalTariffPaid += tariffAmt;
                            destTown.market.supply[resId] = (destTown.market.supply[resId] || 0) + qty;
                        }
                        // Credit tariff to destination kingdom
                        if (totalTariffPaid > 0 && _cDestK) {
                            _cDestK.gold = (_cDestK.gold || 0) + totalTariffPaid;
                            _cDestK.taxRevenue = (_cDestK.taxRevenue || 0) + totalTariffPaid;
                            _cDestK.tariffRevenue = (_cDestK.tariffRevenue || 0) + totalTariffPaid;
                        }

                        // Credit owner
                        if (caravan.ownerType === 'em') {
                            var owner = world.people.find(function(p) { return p.id === caravan.ownerId; });
                            if (owner) owner.gold = (owner.gold || 0) + totalRevenue;
                        } else if (caravan.ownerType === 'kingdom') {
                            var kingdom = findKingdom(caravan.ownerId);
                            if (kingdom) kingdom.gold = (kingdom.gold || 0) + totalRevenue;
                        }

                        caravan.tripCount = (caravan.tripCount || 0) + 1;
                        caravan.goods = {};

                        // Decide what to do next
                        if (caravan.mode === 'one_way') {
                            caravan.status = 'completed';
                        } else {
                            // Buy goods at destination for return trip
                            caravan.status = 'returning';
                            var fromTown = findTown(caravan.fromTownId);
                            if (fromTown && fromTown.market) {
                                var budget = Math.min(totalRevenue * 0.8, 500);
                                var spent = 0;
                                var returnGoods = {};
                                for (var rk in destTown.market.prices) {
                                    var dPrice = destTown.market.prices[rk] || 0;
                                    var fPrice = fromTown.market.prices[rk] || 0;
                                    if (dPrice > 0 && fPrice > dPrice * 1.2 && (destTown.market.supply[rk] || 0) > 10) {
                                        var buyQty = Math.min(
                                            Math.floor((budget - spent) / dPrice),
                                            Math.floor((destTown.market.supply[rk] || 0) * 0.2),
                                            caravan.capacity
                                        );
                                        if (buyQty > 0) {
                                            var cost = Math.ceil(dPrice * buyQty);
                                            if (caravan.ownerType === 'em') {
                                                var emOwner = world.people.find(function(p) { return p.id === caravan.ownerId; });
                                                if (emOwner && (emOwner.gold || 0) >= cost) {
                                                    emOwner.gold -= cost;
                                                    destTown.market.supply[rk] -= buyQty;
                                                    returnGoods[rk] = buyQty;
                                                    spent += cost;
                                                }
                                            } else if (caravan.ownerType === 'kingdom') {
                                                var kOwner = findKingdom(caravan.ownerId);
                                                if (kOwner && (kOwner.gold || 0) >= cost) {
                                                    kOwner.gold -= cost;
                                                    destTown.market.supply[rk] -= buyQty;
                                                    returnGoods[rk] = buyQty;
                                                    spent += cost;
                                                }
                                            }
                                        }
                                    }
                                }
                                caravan.goods = returnGoods;
                            }
                        }
                    }
                } else if (caravan.status === 'returning') {
                    // Arrived back at origin — sell return goods
                    var originTown = findTown(caravan.fromTownId);
                    if (originTown && originTown.market) {
                        var returnRevenue = 0;
                        var returnTariffPaid = 0;
                        // Determine tariff for return leg
                        var _rDestK = originTown.kingdomId ? findKingdom(originTown.kingdomId) : null;
                        var _rFromTown = findTown(caravan.toTownId);
                        var _rFromKId = _rFromTown ? _rFromTown.kingdomId : null;
                        var _rTariffRate = 0;
                        if (_rDestK && _rDestK.laws && _rFromKId !== originTown.kingdomId) {
                            _rTariffRate = _rDestK.laws.tradeTariff || 0;
                            var _rSpecLaws = _rDestK.laws.specialLaws || [];
                            for (var _rsli = 0; _rsli < _rSpecLaws.length; _rsli++) {
                                var _rsId = typeof _rSpecLaws[_rsli] === 'string' ? _rSpecLaws[_rsli] : (_rSpecLaws[_rsli].id || '');
                                if (_rsId === 'open_market') { _rTariffRate = 0; break; }
                                if (_rsId === 'foreign_ban') _rTariffRate += 0.25;
                            }
                            _rTariffRate = Math.min(_rTariffRate, 0.35);
                        }
                        for (var rr in caravan.goods) {
                            var rQty = caravan.goods[rr] || 0;
                            if (rQty <= 0) continue;
                            var rPrice = originTown.market.prices[rr] || 1;
                            var rGross = Math.floor(rPrice * rQty * 0.85);
                            var rTarAmt = Math.floor(rGross * _rTariffRate);
                            var rRev = rGross - rTarAmt;
                            returnRevenue += rRev;
                            returnTariffPaid += rTarAmt;
                            originTown.market.supply[rr] = (originTown.market.supply[rr] || 0) + rQty;
                        }
                        // Credit tariff to origin kingdom
                        if (returnTariffPaid > 0 && _rDestK) {
                            _rDestK.gold = (_rDestK.gold || 0) + returnTariffPaid;
                            _rDestK.taxRevenue = (_rDestK.taxRevenue || 0) + returnTariffPaid;
                            _rDestK.tariffRevenue = (_rDestK.tariffRevenue || 0) + returnTariffPaid;
                        }

                        if (caravan.ownerType === 'em') {
                            var retOwner = world.people.find(function(p) { return p.id === caravan.ownerId; });
                            if (retOwner) retOwner.gold = (retOwner.gold || 0) + returnRevenue;
                        } else if (caravan.ownerType === 'kingdom') {
                            var retK = findKingdom(caravan.ownerId);
                            if (retK) retK.gold = (retK.gold || 0) + returnRevenue;
                        }

                        caravan.goods = {};
                        caravan.tripCount = (caravan.tripCount || 0) + 1;
                    }

                    if (caravan.mode === 'continuous') {
                        // Reload goods from owner inventory and go again
                        caravan.status = 'traveling';
                        if (caravan.ownerType === 'em') {
                            var contOwner = world.people.find(function(p) { return p.id === caravan.ownerId; });
                            if (contOwner && contOwner.npcMerchantInventory) {
                                var contTown = findTown(caravan.fromTownId);
                                var destTownCont = findTown(caravan.toTownId);
                                if (contTown && destTownCont && destTownCont.market) {
                                    var loadGoods = {};
                                    var loadWeight = 0;
                                    var contInv = contOwner.npcMerchantInventory;
                                    for (var lk in contInv) {
                                        if ((contInv[lk] || 0) <= 2) continue;
                                        var lLocal = contTown.market.prices[lk] || 0;
                                        var lDest = destTownCont.market.prices[lk] || 0;
                                        if (lDest > lLocal * 1.1) {
                                            var lQty = Math.min(contInv[lk] - 2, caravan.capacity - loadWeight);
                                            if (lQty > 0) {
                                                loadGoods[lk] = lQty;
                                                contInv[lk] -= lQty;
                                                if (contInv[lk] <= 0) delete contInv[lk];
                                                loadWeight += lQty;
                                            }
                                        }
                                    }
                                    caravan.goods = loadGoods;

                                    // Cancel continuous if no goods to send
                                    if (loadWeight === 0) {
                                        caravan.status = 'completed';
                                    }
                                }
                            }
                        }
                    } else {
                        caravan.status = 'completed';
                    }
                }
            }
        }

        // Cleanup completed caravans
        world.npcCaravans = world.npcCaravans.filter(function(c) { return c.status !== 'completed'; });

        // Elite merchants consider buying ships at port towns
        if (world.day % 30 === 0) {
            for (var esi = 0; esi < world.eliteMerchants.length; esi++) {
                var esm = world.eliteMerchants[esi];
                if (!esm || !esm.alive) continue;
                var esmTown = findTown(esm.townId);
                if (!esmTown || !esmTown.isPort) continue;
                if ((esm.gold || 0) < 500) continue;

                // Count EM ships
                if (!esm.ships) esm.ships = [];
                if (esm.ships.length >= 2) continue; // max 2 ships per EM

                // Only buy if they have active sea trade
                var hasSeaTrade = false;
                for (var eci = 0; eci < world.npcCaravans.length; eci++) {
                    if (world.npcCaravans[eci].ownerId === esm.id && world.npcCaravans[eci].routeType === 'sea') {
                        hasSeaTrade = true; break;
                    }
                }
                // Or if there are sea routes from this port
                if (!hasSeaTrade) {
                    var sr = world.seaRoutes || [];
                    for (var sri = 0; sri < sr.length; sri++) {
                        if (sr[sri].fromTownId === esm.townId || sr[sri].toTownId === esm.townId) {
                            hasSeaTrade = true; break;
                        }
                    }
                }
                if (!hasSeaTrade) continue;

                // Pick affordable ship: sloop → cog → caravel based on wealth
                var emShipTypes = ['sloop', 'cog', 'caravel'];
                for (var esti = emShipTypes.length - 1; esti >= 0; esti--) {
                    var estDef = CONFIG.SHIP_TYPES[emShipTypes[esti]];
                    if (!estDef) continue;
                    var estCost = estDef.laborCost || 80;
                    for (var esm2 in (estDef.materials || {})) {
                        var esp = (esmTown.market.prices[esm2] || 10);
                        estCost += (estDef.materials[esm2] || 0) * esp;
                    }
                    if ((esm.gold || 0) >= estCost * 3 && world.rng && world.rng.chance(0.15)) { // must have 3x cost and 15% chance
                        var matOk = true;
                        for (var esm3 in (estDef.materials || {})) {
                            if ((esmTown.market.supply[esm3] || 0) < (estDef.materials[esm3] || 0)) { matOk = false; break; }
                        }
                        if (matOk) {
                            for (var esm4 in (estDef.materials || {})) {
                                esmTown.market.supply[esm4] = (esmTown.market.supply[esm4] || 0) - (estDef.materials[esm4] || 0);
                            }
                            esm.gold -= estCost;
                            esm.ships.push({
                                id: uid('emship'),
                                type: emShipTypes[esti],
                                name: estDef.name,
                                townId: esm.townId,
                                capacity: estDef.capacity,
                                speed: estDef.speed || 1.0,
                            });
                            emitTrackedEMNotification(esm, 'bought a ' + estDef.name + ' at ' + esmTown.name, { townId: esm.townId });
                            break;
                        }
                    }
                }
            }
        }
    }

    function tickKingdomCaravans() {
        _syncState();
        if (!world) return;
        if (world.day % (CONFIG.KINGDOM_CARAVAN_INTERVAL || 14) !== 0) return;
        if (!world.npcCaravans) world.npcCaravans = [];

        var rng = world.rng;
        if (!rng) return;

        for (var ki = 0; ki < world.kingdoms.length; ki++) {
            var k = world.kingdoms[ki];
            if (!k || !k.id) continue;
            if ((k.gold || 0) < (CONFIG.KINGDOM_CARAVAN_TREASURY_MIN || 5000)) continue;

            // Only kingdoms with transport law OR generous/ambitious personality
            var hasTransport = k.laws && k.laws.kingdomTransport;
            var isProsperous = k.kingPersonality && (k.kingPersonality.greed === 'generous' || k.kingPersonality.ambition === 'ambitious');
            if (!hasTransport && !isProsperous) continue;

            // Count active kingdom caravans
            var activeKC = 0;
            for (var aci = 0; aci < world.npcCaravans.length; aci++) {
                if (world.npcCaravans[aci].ownerId === k.id && world.npcCaravans[aci].ownerType === 'kingdom') {
                    activeKC++;
                }
            }
            if (activeKC >= (CONFIG.KINGDOM_CARAVAN_MAX || 2)) continue;

            // Find kingdom towns
            var kTowns = world.towns.filter(function(t) { return t.kingdomId === k.id; });
            if (kTowns.length < 2) continue;

            // Find biggest supply gap between kingdom towns
            var bestFrom = null, bestTo = null, bestGap = 0, bestResource = null;
            var stapleGoods = ['wheat', 'bread', 'wood', 'stone', 'planks', 'tools', 'iron', 'meat',
                'bandages', 'herbal_remedy', 'healing_tonic', 'antidote', 'herbal_poultice', 'fever_tonic', 'splint'];

            for (var fi = 0; fi < kTowns.length; fi++) {
                for (var ti = 0; ti < kTowns.length; ti++) {
                    if (fi === ti) continue;
                    var fromT = kTowns[fi];
                    var toT = kTowns[ti];
                    if (!fromT.market || !toT.market) continue;

                    // Check if connected
                    if (!fromT.connectedTowns || fromT.connectedTowns.indexOf(toT.id) === -1) continue;

                    for (var si = 0; si < stapleGoods.length; si++) {
                        var good = stapleGoods[si];
                        var fromSupply = fromT.market.supply[good] || 0;
                        var toSupply = toT.market.supply[good] || 0;
                        var gap = fromSupply - toSupply;
                        // Medical goods get priority weighting during health crises
                        var _isMedGood = si >= 8; // medical goods start at index 8
                        if (_isMedGood) {
                            var _toSickPct = 0;
                            var _toPop = getPeopleInTown(toT.id);
                            if (_toPop.length > 0) {
                                var _toSick = 0;
                                for (var _sp = 0; _sp < _toPop.length; _sp++) { if (_toPop[_sp].sick || _toPop[_sp].injured) _toSick++; }
                                _toSickPct = _toSick / _toPop.length;
                            }
                            // Boost gap score for medical goods in sick towns
                            if (_toSickPct > 0.1) gap *= (1 + _toSickPct * 5);
                        }
                        if (gap > 30 && gap > bestGap) {
                            bestGap = gap;
                            bestFrom = fromT.id;
                            bestTo = toT.id;
                            bestResource = good;
                        }
                    }
                }
            }

            if (bestFrom && bestTo && bestResource) {
                var cost = CONFIG.KINGDOM_CARAVAN_COST || 150;
                if ((k.gold || 0) < cost) continue;
                k.gold -= cost;

                var fromTownK = findTown(bestFrom);
                var sendQty = Math.min(bestGap, CONFIG.KINGDOM_CARAVAN_CAPACITY || 100);
                var goods = {};
                goods[bestResource] = sendQty;

                // Remove from source town supply
                if (fromTownK && fromTownK.market) {
                    fromTownK.market.supply[bestResource] = Math.max(0, (fromTownK.market.supply[bestResource] || 0) - sendQty);
                }

                world.npcCaravans.push({
                    id: 'k_caravan_' + world.day + '_' + ki,
                    ownerId: k.id,
                    ownerType: 'kingdom',
                    fromTownId: bestFrom,
                    toTownId: bestTo,
                    goods: goods,
                    capacity: CONFIG.KINGDOM_CARAVAN_CAPACITY || 100,
                    progress: 0,
                    speed: CONFIG.KINGDOM_CARAVAN_SPEED || 0.10,
                    startDay: world.day,
                    status: 'traveling',
                    mode: 'one_way',
                    returnGoods: {},
                    tripCount: 0,
                });
            }
        }
    }

    /**
     * King AI: emergency medical supply transport via soldiers.
     * When a town has high illness/injury rates and low medical supplies,
     * the king dispatches soldier escorts to move medical goods from surplus towns.
     */
    function tickKingdomMedicalLogistics() {
        _syncState();
        if (!world) return;
        if (world.day % 7 !== 0) return; // check weekly
        if (!world.npcCaravans) world.npcCaravans = [];
        var rng = world.rng;
        if (!rng) return;

        var medGoods = ['bandages', 'herbal_remedy', 'healing_tonic', 'antidote', 'herbal_poultice', 'fever_tonic', 'splint'];

        for (var ki = 0; ki < world.kingdoms.length; ki++) {
            var k = world.kingdoms[ki];
            if (!k || !k.id) continue;
            if ((k.gold || 0) < 300) continue;

            var kTowns = world.towns.filter(function(t) { return t.kingdomId === k.id; });
            if (kTowns.length < 2) continue;

            // Count active medical caravans for this kingdom
            var activeMedCaravans = 0;
            for (var aci = 0; aci < world.npcCaravans.length; aci++) {
                if (world.npcCaravans[aci].ownerId === k.id && world.npcCaravans[aci]._isMedical) {
                    activeMedCaravans++;
                }
            }
            if (activeMedCaravans >= 3) continue;

            // Find towns in medical crisis (>15% sick/injured, low medical supply)
            var crisisTowns = [];
            for (var cti = 0; cti < kTowns.length; cti++) {
                var ct = kTowns[cti];
                var ctPop = getPeopleInTown(ct.id);
                if (ctPop.length < 5) continue;
                var sickCount = 0;
                for (var cpi = 0; cpi < ctPop.length; cpi++) {
                    if (ctPop[cpi].sick || ctPop[cpi].injured) sickCount++;
                }
                var sickPct = sickCount / ctPop.length;
                if (sickPct < 0.15) continue;
                // Check medical supply levels
                var medSupply = 0;
                for (var mgi = 0; mgi < medGoods.length; mgi++) {
                    medSupply += (ct.market.supply[medGoods[mgi]] || 0);
                }
                if (medSupply < sickCount * 2) {
                    crisisTowns.push({ town: ct, sickPct: sickPct, sickCount: sickCount, medSupply: medSupply });
                }
            }
            if (crisisTowns.length === 0) continue;

            // Sort by severity
            crisisTowns.sort(function(a, b) { return b.sickPct - a.sickPct; });

            // For the worst crisis town, find a surplus source
            var crisis = crisisTowns[0];
            var bestSource = null;
            var bestMedSurplus = 0;
            for (var sti = 0; sti < kTowns.length; sti++) {
                var st = kTowns[sti];
                if (st.id === crisis.town.id) continue;
                if (!st.connectedTowns || st.connectedTowns.indexOf(crisis.town.id) === -1) continue;
                var surplus = 0;
                for (var mgi2 = 0; mgi2 < medGoods.length; mgi2++) {
                    surplus += (st.market.supply[medGoods[mgi2]] || 0);
                }
                if (surplus > bestMedSurplus) {
                    bestMedSurplus = surplus;
                    bestSource = st;
                }
            }

            if (!bestSource || bestMedSurplus < 5) continue;

            // Dispatch military medical supply convoy
            var convoyGoods = {};
            var totalSent = 0;
            var maxSend = Math.min(50, bestMedSurplus);
            for (var mgi3 = 0; mgi3 < medGoods.length && totalSent < maxSend; mgi3++) {
                var mgId = medGoods[mgi3];
                var avail = bestSource.market.supply[mgId] || 0;
                var toSend = Math.min(avail, Math.ceil((maxSend - totalSent) / (medGoods.length - mgi3)));
                if (toSend > 0) {
                    bestSource.market.supply[mgId] -= toSend;
                    convoyGoods[mgId] = toSend;
                    totalSent += toSend;
                }
            }

            if (totalSent > 0) {
                var convoyCost = Math.floor(totalSent * 2); // soldier escort cost
                if ((k.gold || 0) < convoyCost) continue;
                k.gold -= convoyCost;

                world.npcCaravans.push({
                    id: 'k_med_' + world.day + '_' + ki,
                    ownerId: k.id,
                    ownerType: 'kingdom',
                    fromTownId: bestSource.id,
                    toTownId: crisis.town.id,
                    goods: convoyGoods,
                    capacity: 50,
                    progress: 0,
                    speed: (CONFIG.KINGDOM_CARAVAN_SPEED || 0.10) * 1.5, // soldier escorts move faster
                    startDay: world.day,
                    status: 'traveling',
                    mode: 'one_way',
                    returnGoods: {},
                    tripCount: 0,
                    _isMedical: true,
                });

                logEvent('⚕️ ' + k.name + ' dispatched medical supplies from ' + bestSource.name + ' to ' + crisis.town.name + ' (' + totalSent + ' units).', { type: 'kingdom_medical', kingdomId: k.id, townId: crisis.town.id, _noToast: true }, (typeof Player !== 'undefined' && Player.citizenshipKingdomId === k.id ? 'my_kingdom' : 'foreign_kingdoms'));
            }
        }
    }

    function tickEliteMerchantAI() {
        _syncState();
        if (!world) return;
        var rng = world.rng;
        if (!rng) return;
        var day = world.day;

        var elites = (_tickCache.eliteMerchants || world.people.filter(function(p) { return p.alive && p.isEliteMerchant; }));
        for (var i = 0; i < elites.length; i++) {
            var em = elites[i];
            // v9p33river435: agenda system — elite merchant trade gossip
            if (day % 30 === 0) {
                try {
                    var _emGName = (em.firstName || '') + ' ' + (em.lastName || '');
                    var _emStrat = em.strategy || 'diversified';
                    var _emStratLabels = {
                        food_monopoly: 'cornering the food market',
                        military_supplier: 'stockpiling weapons and armor',
                        luxury_trader: 'trading in luxury goods',
                        war_profiteer: 'profiting from the war',
                        land_baron: 'acquiring property',
                        trade_network: 'expanding trade routes',
                        medical_supplier: 'dealing in medicines',
                        culture_trader: 'investing in culture and instruments',
                        retail_mogul: 'building a retail empire',
                        political_climber: 'buying political influence',
                        diversified: 'diversifying their investments'
                    };
                    var _emGossipText = _emGName.trim() + ' is said to be ' + (_emStratLabels[_emStrat] || 'making moves in the market');
                    if (typeof _storeBackgroundGossip === 'function') {
                        _storeBackgroundGossip('trade', _emGossipText, { personId: em.id, type: 'em_trade_gossip' });
                    } else if (typeof Engine !== 'undefined' && Engine.storeBackgroundGossip) {
                        Engine.storeBackgroundGossip('trade', _emGossipText, { personId: em.id, type: 'em_trade_gossip' });
                    }
                } catch(_emGErr) {}
            }
            // Stagger: each elite ticks every 3 days on their own slot
            var hash = 0;
            for (var ci = 0; ci < em.id.length; ci++) hash = (hash * 31 + em.id.charCodeAt(ci)) | 0;
            if (Math.abs(hash) % 3 !== day % 3) continue;

            ensureEliteMerchantFields(em);

            // Ensure EM always has at least Burgher rank (2) in current kingdom
            var _emKid = em.kingdomId || em.citizenshipKingdomId;
            if (_emKid) {
                if (!em.socialRank) em.socialRank = {};
                if ((em.socialRank[_emKid] || 0) < 2) em.socialRank[_emKid] = 2;
            }

            // Skip if jailed
            // v9p33river315: punishment writes _jailedUntilDay (line ~3848)
            // but this check was reading jailedUntilDay (no underscore),
            // so EMs sentenced via the crime system kept running caravans
            // and bidding on deals. Accept either flag name.
            if ((em._jailedUntilDay || em.jailedUntilDay) && (em._jailedUntilDay || em.jailedUntilDay) > day) continue;

            // ---- SYNC em.buildings with town.buildings (catch untracked purchases/transfers) ----
            if (!em.buildings) em.buildings = [];
            if (day % 30 === 0) {
                // Monthly reconciliation: scan all towns for buildings owned by this EM
                for (var sti = 0; sti < world.towns.length; sti++) {
                    var syncTown = world.towns[sti];
                    if (!syncTown.buildings) continue;
                    for (var sbi = 0; sbi < syncTown.buildings.length; sbi++) {
                        if (syncTown.buildings[sbi].ownerId === em.id) {
                            var syncType = syncTown.buildings[sbi].type;
                            // v9p33river317: include id when town building
                            // has one, and also backfill missing ids on
                            // existing em.buildings refs to match the
                            // town building (so removal filters work).
                            var _syncId = syncTown.buildings[sbi].id || null;
                            var _syncMatch = em.buildings.find(function(bb) { return bb.townId === syncTown.id && bb.type === syncType; });
                            if (_syncMatch) {
                                if (!_syncMatch.id && _syncId) _syncMatch.id = _syncId;
                            } else {
                                em.buildings.push({ id: _syncId, townId: syncTown.id, type: syncType });
                            }
                        }
                    }
                }
                // Prune stale entries (building no longer exists or no longer owned)
                for (var pbi = em.buildings.length - 1; pbi >= 0; pbi--) {
                    var pRef = em.buildings[pbi];
                    var pTown = findTown(pRef.townId);
                    if (!pTown) { em.buildings.splice(pbi, 1); continue; }
                    var stillOwns = pTown.buildings.some(function(tb) { return tb.ownerId === em.id && tb.type === pRef.type; });
                    if (!stillOwns) em.buildings.splice(pbi, 1);
                }
            }

            // ---- 0. PASSIVE BUILDING REVENUE (every tick) ----
            // EMs earn passive income from their buildings based on town prosperity
            var emBuildings = em.buildings || [];
            // Initialize income log (rolling 30-day window)
            if (!em._incomeLog) em._incomeLog = { buildings: 0, buildingsByTown: {}, trade: 0, expenses: 0, lastReset: world.day };
            if (world.day - em._incomeLog.lastReset >= 30) {
                em._incomeLog = { buildings: 0, buildingsByTown: {}, trade: 0, expenses: 0, lastReset: world.day };
            }
            if (emBuildings.length > 0) {
                var buildingIncome = 0;
                for (var bi2 = 0; bi2 < emBuildings.length; bi2++) {
                    var bld = emBuildings[bi2];
                    if (bld && bld.condition !== 'destroyed') {
                        var bldTown = findTown(bld.townId);
                        var prosper = bldTown ? (bldTown.prosperity || 30) / 100 : 0.3;
                        var biBt = findBuildingType(bld.type);
                        var _bldInc = 0;
                        if (biBt && biBt.produces) {
                            _bldInc = Math.floor(2 + 3 * prosper);
                        } else {
                            _bldInc = Math.floor(5 + 10 * prosper);
                        }
                        buildingIncome += _bldInc;
                        if (bldTown) {
                            em._incomeLog.buildingsByTown[bldTown.name] = (em._incomeLog.buildingsByTown[bldTown.name] || 0) + _bldInc;
                        }
                    }
                }
                em.gold = (em.gold || 0) + buildingIncome;
                em._incomeLog.buildings += buildingIncome;
            }
            // Minimum sustenance: EMs always earn a small amount from their trade networks
            var _tradeInc = Math.floor(3 + rng.random() * 5);
            em.gold = (em.gold || 0) + _tradeInc;
            em._incomeLog.trade += _tradeInc;
            // v9p33river85: trade income comes from the town's market gold pool.
            try {
                if (em.townId && Engine.adjustTownMarketGold) Engine.adjustTownMarketGold(em.townId, -_tradeInc);
            } catch (_e) {}
            grantEmXp(em, 1, 'daily');

            // ---- FINANCIAL DISTRESS & BANKRUPTCY ----
            if ((em.gold || 0) < 2000) {
                em._lowGoldDays = (em._lowGoldDays || 0) + 1;
            } else {
                em._lowGoldDays = 0;
            }
            if ((em.gold || 0) < 1000) {
                em._criticalGoldDays = (em._criticalGoldDays || 0) + 1;
            } else {
                em._criticalGoldDays = 0;
            }

            // Distress mode: < 2000g for 7+ days — sell buildings, do jobs
            if ((em._lowGoldDays || 0) >= 7 && (em.gold || 0) < 2000) {
                // Put buildings up for sale
                if (em.buildings && em.buildings.length > 0) {
                    for (var dbi = 0; dbi < em.buildings.length; dbi++) {
                        var distBld = em.buildings[dbi];
                        var distTown = findTown(distBld.townId);
                        if (!distTown) continue;
                        for (var dtbi = 0; dtbi < distTown.buildings.length; dtbi++) {
                            if (distTown.buildings[dtbi].ownerId === em.id && distTown.buildings[dtbi].type === distBld.type && !distTown.buildings[dtbi].forSale) {
                                var distBt = findBuildingType(distBld.type);
                                var distVal = distBt ? Math.floor(distBt.cost * 0.6) : 200;
                                distTown.buildings[dtbi].forSale = true;
                                distTown.buildings[dtbi].salePrice = distVal;
                                break;
                            }
                        }
                    }
                }
                // Sell excess inventory to raise cash
                var distInv = em.npcMerchantInventory || {};
                var distTownRef = findTown(em.townId);
                if (distTownRef && distTownRef.market) {
                    for (var distGood in distInv) {
                        if ((distInv[distGood] || 0) > 0) {
                            var distSellQty = Math.min(distInv[distGood], rng.randInt(2, 6));
                            var distPrice = distTownRef.market.prices[distGood] || 5;
                            em.gold += Math.floor(distPrice * distSellQty * 0.8);
                            distInv[distGood] -= distSellQty;
                            distTownRef.market.supply[distGood] = (distTownRef.market.supply[distGood] || 0) + distSellQty;
                        }
                    }
                }
                // Do odd jobs for gold
                em.gold += rng.randInt(5, 20);
            }

            // Bankruptcy: < 1000g for 30+ days — force sell to kingdom, demote to NPC
            if ((em._criticalGoldDays || 0) >= 30 && (em.gold || 0) < 1000) {
                var bankKingdom = findKingdom(em.kingdomId);
                // Force-sell all buildings to kingdom at 50% value
                if (em.buildings && em.buildings.length > 0 && bankKingdom) {
                    var kingPers = bankKingdom.kingPersonality || {};
                    for (var fsi = em.buildings.length - 1; fsi >= 0; fsi--) {
                        var fsBld = em.buildings[fsi];
                        var fsBt = findBuildingType(fsBld.type);
                        var fsVal = fsBt ? Math.floor(fsBt.cost * 0.5) : 100;
                        // King personality affects purchase chance (generous kings always buy, greedy sometimes refuse)
                        var kingBuyChance = 0.85;
                        if (kingPers.generosity === 'generous') kingBuyChance = 1.0;
                        if (kingPers.greed === 'greedy') kingBuyChance = 0.6;
                        if (kingPers.greed === 'corrupt') kingBuyChance = 0.4;
                        // v9p33river305: previously em.buildings.splice ran
                        // OUTSIDE the rng.chance branch — so EM tracking
                        // dropped the building even when the kingdom REFUSED
                        // to buy. Now removal only happens after a successful
                        // transfer.
                        if (rng.chance(kingBuyChance)) {
                            em.gold += fsVal;
                            bankKingdom.gold = Math.max(0, (bankKingdom.gold || 0) - fsVal);
                            // Transfer building to kingdom
                            var fsTown = findTown(fsBld.townId);
                            if (fsTown) {
                                for (var fsbi = 0; fsbi < fsTown.buildings.length; fsbi++) {
                                    if (fsTown.buildings[fsbi].ownerId === em.id && fsTown.buildings[fsbi].type === fsBld.type) {
                                        fsTown.buildings[fsbi].ownerId = 'kingdom_' + bankKingdom.id;
                                        fsTown.buildings[fsbi].forSale = true;
                                        fsTown.buildings[fsbi].salePrice = Math.floor(fsVal * 1.5);
                                        break;
                                    }
                                }
                            }
                            em.buildings.splice(fsi, 1);
                        }
                    }
                }
                // Sell all remaining inventory
                var bankInv = em.npcMerchantInventory || {};
                var bankTown = findTown(em.townId);
                if (bankTown && bankTown.market) {
                    for (var bankGood in bankInv) {
                        if ((bankInv[bankGood] || 0) > 0) {
                            var bankPrice = bankTown.market.prices[bankGood] || 3;
                            em.gold += Math.floor(bankPrice * bankInv[bankGood] * 0.5);
                            bankTown.market.supply[bankGood] = (bankTown.market.supply[bankGood] || 0) + bankInv[bankGood];
                            bankInv[bankGood] = 0;
                        }
                    }
                }
                // Demote: strip elite merchant status
                logEvent('💸 ' + em.firstName + ' ' + (em.lastName || '') + ' goes bankrupt and is demoted from Elite Merchant status!',  {
                    type: 'elite_bankruptcy',
                    cause: em.firstName + ' was below 1000g for 30+ days.',
                    effects: [
                        em.firstName + ' loses Elite Merchant status',
                        'All buildings sold to the kingdom',
                        em.firstName + ' becomes a common NPC'
                    ]
                ,
                _noToast: true}, 'npc_activity');
                em.isEliteMerchant = false;
                // Nobles keep their noble occupation even when losing EM status
                if (em.occupation !== 'noble') em.occupation = 'laborer';
                em._lowGoldDays = 0;
                em._criticalGoldDays = 0;
                continue; // skip rest of EM AI for this now-demoted NPC
            }

            var town = findTown(em.townId);
            if (!town) continue;
            var personality = em.personality;
            var strategy = em.strategy || 'diversified';

            // ── Strategy-driven personality modifiers ──
            // Each strategy type gets behavioral biases that affect how frequently they use various AI systems
            var stratMods = {
                food_monopoly:     { tradeFreq: 5, buildFreq: 12, socialFreq: 45, travelFreq: 10 },
                military_supplier: { tradeFreq: 5, buildFreq: 10, socialFreq: 30, travelFreq: 7 },
                luxury_trader:     { tradeFreq: 3, buildFreq: 15, socialFreq: 20, travelFreq: 5 },
                diversified:       { tradeFreq: 7, buildFreq: 15, socialFreq: 30, travelFreq: 7 },
                political_climber: { tradeFreq: 7, buildFreq: 15, socialFreq: 10, travelFreq: 7 },
                war_profiteer:     { tradeFreq: 3, buildFreq: 10, socialFreq: 30, travelFreq: 5 },
                land_baron:        { tradeFreq: 10, buildFreq: 8, socialFreq: 30, travelFreq: 10 },
                trade_network:     { tradeFreq: 3, buildFreq: 12, socialFreq: 25, travelFreq: 3 },
                medical_supplier:  { tradeFreq: 5, buildFreq: 12, socialFreq: 30, travelFreq: 7 }
            };
            var sMod = stratMods[strategy] || stratMods.diversified;

            // political_climber: boost relationship building & rank attempts
            if (strategy === 'political_climber') {
                if (personality.ambition < 70) personality.ambition = 70;
                if (personality.social < 65) personality.social = 65;
            }
            // war_profiteer: more aggressive in wartime, seeks war zones
            if (strategy === 'war_profiteer' && world.activeWars) {
                var atWarNow = Object.values(world.activeWars).some(function(w) { return w.active !== false; });
                if (atWarNow) {
                    sMod.tradeFreq = 2; // trade every 2 days during war
                    sMod.buildFreq = 7; // build more urgently
                }
            }
            // land_baron: prioritize land & building acquisition
            if (strategy === 'land_baron' && personality.ambition < 60) personality.ambition = 60;

            // ---- 1. TRADING LOGIC ----
            if (day % sMod.tradeFreq === 0) {
                eliteTradeAI(em, town, rng, strategy);
            }

            // ---- 1b. BRIDGE REPAIR AI ----
            // If EM wants to reach a town but a bridge is destroyed, decide to repair or petition
            if (day % 7 === 0 && !em.traveling && (em.gold || 0) > 3000) {
                var _emRoads = world.roads;
                for (var _eri = 0; _eri < _emRoads.length; _eri++) {
                    var _eRoad = _emRoads[_eri];
                    if (_eRoad.fromTownId !== em.townId && _eRoad.toTownId !== em.townId) continue;
                    if (!_eRoad.bridges || _eRoad.bridges.length === 0) continue;
                    var _needsRepair = false;
                    for (var _ebri = 0; _ebri < _eRoad.bridges.length; _ebri++) {
                        if (_eRoad.bridges[_ebri].destroyed) { _needsRepair = true; break; }
                    }
                    if (!_needsRepair) continue;
                    // This road has a destroyed bridge — decide what to do
                    var _repCost = CONFIG.BRIDGE_REBUILD_COST || 1000;
                    var _repMats = CONFIG.BRIDGE_REPAIR_MATERIALS || { wood: 20, stone: 10 };
                    // Check if town market has materials
                    var _hasMats = true;
                    for (var _mk in _repMats) {
                        if ((town.market && town.market.supply && (town.market.supply[_mk] || 0) >= _repMats[_mk])) continue;
                        _hasMats = false; break;
                    }
                    // Wealthy + smart EMs repair themselves; others petition king
                    var _intel = (personality.intelligence || 50);
                    var _amb = (personality.ambition || 50);
                    if ((em.gold || 0) >= _repCost * 2 && _hasMats && (_intel > 40 || _amb > 60)) {
                        // Self-repair: deduct gold and materials from market
                        em.gold -= _repCost;
                        for (var _mk2 in _repMats) {
                            if (town.market && town.market.supply) {
                                town.market.supply[_mk2] = Math.max(0, (town.market.supply[_mk2] || 0) - _repMats[_mk2]);
                            }
                        }
                        rebuildBridge(_eri);
                        var _brFromT = findTown(_eRoad.fromTownId);
                        var _brToT = findTown(_eRoad.toTownId);
                        logEvent('🌉 ' + (em.firstName || em.name || 'An elite merchant') + ' repaired the bridge between ' +
                            (_brFromT ? _brFromT.name : '?') + ' and ' + (_brToT ? _brToT.name : '?') + '.', { type: 'bridge_repaired' }, 'npc_activity');
                        break; // One repair per tick
                    } else if (rng.chance(0.3)) {
                        // Petition the king — need citizenship
                        var _emKingdom = findKingdom(em.kingdomId);
                        if (_emKingdom) {
                            if (!_emKingdom.petitions) _emKingdom.petitions = [];
                            // Check if a repair petition already exists for this road
                            var _petExists = _emKingdom.petitions.some(function(pet) {
                                return pet.typeId === 'repair_bridge' && pet.roadIndex === _eri && pet.status === 'open';
                            });
                            if (!_petExists) {
                                _emKingdom.petitions.push({
                                    id: 'pet_' + uid('pet'),
                                    typeId: 'repair_bridge',
                                    creatorId: em.id,
                                    creatorName: em.firstName + ' ' + (em.lastName || ''),
                                    kingdomId: _emKingdom.id,
                                    roadIndex: _eri,
                                    signatures: 1,
                                    requiredSignatures: 3,
                                    status: 'open',
                                    createdDay: day,
                                    support: Math.floor(30 + rng.random() * 40)
                                });
                                logEvent('📜 ' + (em.firstName || 'An elite merchant') + ' petitioned ' + _emKingdom.name + ' to repair a bridge.', { type: 'petition' }, 'npc_activity');
                            }
                        }
                    }
                }
            }

            // ---- 1b. FEAST ATTENDANCE — travel to feast if invited ----
            if (em._feastInvitation && !em.traveling) {
                var fInv = em._feastInvitation;
                var fKingdom = findKingdom(fInv.kingdomId);
                if (fKingdom && fKingdom._activeFeast && fKingdom._activeFeast.daysLeft > 0) {
                    var fCapital = findTown(fKingdom.capitalTownId);
                    if (fCapital && em.townId !== fCapital.id) {
                        // Travel to feast location
                        em.townId = fCapital.id;
                        em.traveling = false;
                    }
                } else {
                    // Feast over, clear invitation
                    delete em._feastInvitation;
                }
            }

            // ---- 1c. NOBLE RELATIONSHIP BUILDING — proactively converse with nobles ----
            if (day % 5 === 0 && !em.traveling && rng.chance(0.25)) {
                var emTown = findTown(em.townId);
                if (emTown) {
                    var localNobles = world.people.filter(function(p) {
                        return p.alive && p.townId === em.townId && p.socialRank && p.id !== em.id;
                    });
                    for (var lni = 0; lni < localNobles.length; lni++) {
                        var ln = localNobles[lni];
                        var lnRank = 0;
                        for (var lnk in (ln.socialRank || {})) { if ((ln.socialRank[lnk] || 0) > lnRank) lnRank = ln.socialRank[lnk]; }
                        if (lnRank < 4) continue; // only minor nobles+
                        // Check rank restriction
                        var emRank = 0;
                        for (var ek in (em.socialRank || {})) { if ((em.socialRank[ek] || 0) > emRank) emRank = em.socialRank[ek]; }
                        if (lnRank - emRank > 1) continue; // can't talk to someone 2+ ranks above
                        // Build relationship
                        var relGain = rng.randFloat(0.5, 2.0);
                        if ((em.personality || {}).social > 55) relGain += 0.5;
                        if (_bridgeNPCRelationship(em, ln.id, relGain, 'noble_conversation')) {
                            _bridgeNPCRelationship(ln, em.id, relGain * 0.5, 'noble_conversation');
                        } else {
                            if (!em._nobleRelationships) em._nobleRelationships = {};
                            em._nobleRelationships[ln.id] = Math.min(100, (em._nobleRelationships[ln.id] || 0) + relGain);
                            if (!ln._nobleRelationships) ln._nobleRelationships = {};
                            ln._nobleRelationships[em.id] = Math.min(100, (ln._nobleRelationships[em.id] || 0) + relGain * 0.5);
                        }
                        break; // one conversation per tick
                    }
                }
            }

            // ---- 2. TRAVEL DECISIONS ----
            if (day % sMod.travelFreq === 0 && !em.traveling) {
                eliteTravelAI(em, town, rng, strategy);
            }

            // ---- 3. BUILD DECISIONS (strategy + ambition driven) ----
            var buildInterval = Math.max(5, Math.floor(sMod.buildFreq * ((personality.ambition || 50) > 65 ? 0.7 : 1.0)));
            if (day % buildInterval === 0) {
                eliteBuildAI(em, town, rng, strategy);
            }

            // ---- 3a. TRANSPORT ACQUISITION (every 15 days) ----
            // v9p33river194: EMs now consider ALL transport tiers (backpack →
            // cart → small_wagon → wagon → large_wagon) when boosting caravan
            // capacity. They prefer the largest they can afford, with cart
            // and large_wagon previously missing from their AI. Tracked in
            // em._transports {backpack, cart, small_wagon, wagon, large_wagon}
            // with em._wagons retained as a count for back-compat.
            if (day % 15 === 0 && (em._wagons || 0) < 3 && (em.gold || 0) > 100) {
                var _wantWagon = (em._wagons || 0) === 0 || (em.gold || 0) > 2000;
                if (_wantWagon) {
                    if (!em._transports) em._transports = { backpack: 0, cart: 0, small_wagon: 0, wagon: 0, large_wagon: 0 };
                    // Priority: try the biggest the EM can afford from market
                    var _transportTiers = [
                        { id: 'large_wagon', minGold: 1500, name: 'Large Wagon' },
                        { id: 'wagon',       minGold: 500,  name: 'Wagon' },
                        { id: 'small_wagon', minGold: 200,  name: 'Small Wagon' },
                        { id: 'cart',        minGold: 80,   name: 'Cart' },
                        { id: 'backpack',    minGold: 30,   name: 'Backpack' }
                    ];
                    var _wagonBought = false;
                    for (var _tti = 0; _tti < _transportTiers.length && !_wagonBought; _tti++) {
                        var _tier = _transportTiers[_tti];
                        if ((em.gold || 0) < _tier.minGold) continue;
                        if (!town.market || (town.market.supply[_tier.id] || 0) <= 0) continue;
                        var _tPrice = town.market.prices[_tier.id] || 50;
                        if ((em.gold || 0) < _tPrice) continue;
                        em.gold -= _tPrice;
                        town.market.supply[_tier.id] = (town.market.supply[_tier.id] || 0) - 1;
                        em._transports[_tier.id] = (em._transports[_tier.id] || 0) + 1;
                        em._wagons = (em._wagons || 0) + 1;
                        _wagonBought = true;
                        logEvent(em.firstName + ' acquired a ' + _tier.name + ' for ' + Math.round(_tPrice) + 'g — caravan capacity boosted.',  {
                            type: 'elite_logistics',
                            cause: em.firstName + ' invested in better transport.',
                            effects: ['Caravan capacity +' + (
                                _tier.id === 'large_wagon' ? 150 :
                                _tier.id === 'wagon' ? 100 :
                                _tier.id === 'small_wagon' ? 70 :
                                _tier.id === 'cart' ? 40 : 15)]
                        ,
                        _noToast: true}, 'npc_activity');
                    }
                    // If no transport available and EM is wealthy, consider building a wheelwright
                    if (!_wagonBought && (em._lastWagonCheck || 0) + 60 < day && (em.gold || 0) > 1500) {
                        em._lastWagonCheck = day;
                        var _hasWheelwright = (em.buildings || []).some(function(b) { return b.type === 'wheelwright'; });
                        if (!_hasWheelwright) {
                            // Check if there's a wheelwright in town at all
                            var _townHasWW = (town.buildings || []).some(function(b) { return b.type === 'wheelwright'; });
                            if (!_townHasWW) {
                                // Check town has a sawmill for planks supply chain
                                var _townHasSawmill = (town.buildings || []).some(function(b) { return b.type === 'sawmill'; });
                                if (_townHasSawmill) {
                                    var _wwBt = findBuildingType('wheelwright');
                                    if (_wwBt && (em.gold || 0) >= _wwBt.cost) {
                                        var maxR_ww = 0;
                                        for (var rkId_ww in em.socialRank) { if ((em.socialRank[rkId_ww] || 0) > maxR_ww) maxR_ww = em.socialRank[rkId_ww]; }
                                        var rDef_ww = CONFIG.SOCIAL_RANKS[maxR_ww] || CONFIG.SOCIAL_RANKS[0];
                                        var _maxBlds = rDef_ww.maxBuildings || 2;
                                        var _maxSlots = CONFIG.TOWN_CATEGORIES[town.category] ? CONFIG.TOWN_CATEGORIES[town.category].maxBuildingSlots : 10;
                                        if ((em.buildings || []).length < _maxBlds && town.buildings.length < _maxSlots) {
                                            em.gold -= _wwBt.cost;
                                            var _wwBld = { type: 'wheelwright', level: 1, ownerId: em.id, townId: town.id, workers: [], upgrades: [], builtDay: day, currentProduct: 'wagon' };
                                            town.buildings.push(_wwBld);
                                            if (!em.buildings) em.buildings = [];
                                            em.buildings.push({ type: 'wheelwright', townId: town.id, level: 1 });
                                            logEvent(em.firstName + ' ' + (em.lastName || '') + ' builds a Wheelwright to produce wagons for caravans.',  {
                                                type: 'elite_supply_chain',
                                                cause: em.firstName + ' invests in wagon production for trade logistics.',
                                                effects: ['New Wheelwright produces wagons', em.firstName + ' invested ' + _wwBt.cost + 'g']
                                            ,
                                            _noToast: true}, 'npc_activity');
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // ---- 3b. WORKER HIRING & MANAGEMENT (every 7 days) ----
            if (day % 7 === 0) {
                eliteWorkerAI(em, town, rng);
            }

            // ---- 4. SOCIAL DECISIONS (strategy-driven frequency) ----
            if (day % sMod.socialFreq === 0) {
                eliteSocialAI(em, town, rng, personality);
            }

            // ---- 5. RANK ADVANCEMENT (ambitious: 30 days, normal: 60 days) ----
            var rankInterval = (personality.ambition || 50) > 60 ? 30 : 60;
            if (day % rankInterval === 0 && (personality.ambition || 50) > 30) {
                eliteRankAI(em, rng);
            }

            // ---- 5b. SKILL LEARNING (every 30 days) ----
            if (day % 30 === 0) {
                eliteSkillAI(em, rng);
            }

            // ---- 5c. NPC SKILL GROWTH (every 15 days) ----
            if (day % 15 === 0) {
                if (!em.skills) em.skills = {};
                // Trading activity grows trading skill
                var tradeGrowth = (em.npcMerchantInventory && Object.keys(em.npcMerchantInventory).length > 0) ? 1 : 0;
                if (tradeGrowth > 0) em.skills.trading = Math.min(100, (em.skills.trading || 5) + rng.randInt(1, 3));
                // Building ownership grows crafting
                if (em.buildings && em.buildings.length > 0) em.skills.crafting = Math.min(100, (em.skills.crafting || 3) + rng.randInt(0, 2));
                // Traveling grows a general skill
                if (em.traveling) em.skills.trading = Math.min(100, (em.skills.trading || 5) + 1);
                // Gold accumulation grows general business sense (mining as proxy for resource management)
                if ((em.gold || 0) > 2000) em.skills.mining = Math.min(100, (em.skills.mining || 3) + rng.randInt(0, 1));
                // Farming skill grows if owns farms
                if (em.buildings) {
                    var ownsFarm = em.buildings.some(function(b) { return b.type && b.type.indexOf('farm') >= 0; });
                    if (ownsFarm) em.skills.farming = Math.min(100, (em.skills.farming || 5) + rng.randInt(0, 2));
                }
            }

            // ---- 6. CRIME DECISIONS (every 14 days, gated by personality) ----
            // v9p33river196: was 30-day gate. Tightened to 14 days so the new
            // EM-on-EM sabotage / theft layers actually surface in the world.
            if (day % 14 === 0 && personality.honesty < 50 && personality.risk_tolerance > 50) {
                eliteCrimeAI(em, town, rng, personality);
            }

            // ---- 7. KINGDOM ORDER FULFILLMENT (every 7 days) ----
            // Bidding handled by tickEliteMerchantBidding; delivery logic here (Bug 2 fix)
            if (day % 7 === 0) {
                var inv = em.npcMerchantInventory || {};
                for (var ki = 0; ki < world.kingdoms.length; ki++) {
                    var k = world.kingdoms[ki];
                    if (!k.procurement || !k.procurement.orders) continue;
                    for (var oi = 0; oi < k.procurement.orders.length; oi++) {
                        var order = k.procurement.orders[oi];
                        if (order.status !== 'assigned' || order.assignedTo !== em.id) continue;
                        var remaining = order.qty - order.qtyDelivered;
                        if (remaining <= 0) continue;

                        // Deliver from inventory first
                        var available = inv[order.resourceId] || 0;
                        if (available > 0) {
                            var deliverQty = Math.min(available, remaining);
                            order.qtyDelivered += deliverQty;
                            inv[order.resourceId] -= deliverQty;
                            var payment = deliverQty * order.assignedPrice;
                            // v9p33river335: cap payment to available treasury
                            // so EM deliveries can't drive kingdom gold negative
                            // (matches Engine.deliverKingdomOrder cap from v312).
                            var _emActualPay = Math.min(payment, Math.max(0, k.gold || 0));
                            em.gold = (em.gold || 0) + _emActualPay;
                            k.gold -= _emActualPay;
                            collectTradeTax(k.id, _emActualPay, order.resourceId);
                            if (k.militaryStockpile && k.militaryStockpile.hasOwnProperty(order.resourceId)) {
                                k.militaryStockpile[order.resourceId] = (k.militaryStockpile[order.resourceId] || 0) + deliverQty;
                            } else {
                                // v9p33river399: non-military goods go to goodsStockpile (was silently dropped)
                                if (!k.goodsStockpile) k.goodsStockpile = {};
                                k.goodsStockpile[order.resourceId] = (k.goodsStockpile[order.resourceId] || 0) + deliverQty;
                            }
                            remaining = order.qty - order.qtyDelivered;
                        }

                        // If still unmet, buy from local market to fill the order
                        if (remaining > 0 && town.market && town.market.supply) {
                            var marketAvail = town.market.supply[order.resourceId] || 0;
                            var buyQty = Math.min(marketAvail, remaining, Math.floor(marketAvail * 0.5));
                            var buyPrice = getMarketPrice(town, order.resourceId);
                            if (buyQty > 0 && (em.gold || 0) >= buyPrice * buyQty) {
                                em.gold -= Math.floor(buyPrice * buyQty);
                                town.market.supply[order.resourceId] -= buyQty;
                                collectTradeTax(town.kingdomId, Math.floor(buyPrice * buyQty), order.resourceId);
                                // Deliver immediately
                                order.qtyDelivered += buyQty;
                                var pay2 = buyQty * order.assignedPrice;
                                // v9p33river335: same treasury cap as above.
                                var _emActualPay2 = Math.min(pay2, Math.max(0, k.gold || 0));
                                em.gold = (em.gold || 0) + _emActualPay2;
                                k.gold -= _emActualPay2;
                                if (k.militaryStockpile && k.militaryStockpile.hasOwnProperty(order.resourceId)) {
                                    k.militaryStockpile[order.resourceId] = (k.militaryStockpile[order.resourceId] || 0) + buyQty;
                                } else {
                                    // v9p33river399: non-military goods go to goodsStockpile
                                    if (!k.goodsStockpile) k.goodsStockpile = {};
                                    k.goodsStockpile[order.resourceId] = (k.goodsStockpile[order.resourceId] || 0) + buyQty;
                                }
                            }
                        }

                        // Check completion
                        if (order.qtyDelivered >= order.qty) {
                            order.status = 'completed';
                            var pref = k.procurement.preferredMerchants[em.id] || { reliability: 50, completedOrders: 0, failedOrders: 0 };
                            pref.reliability = Math.min(100, pref.reliability + 10);
                            pref.completedOrders = (pref.completedOrders || 0) + 1;
                            k.procurement.preferredMerchants[em.id] = pref;
                            // v9p33river295: also deduct the completion bonus
                            // from kingdom treasury (was previously minted —
                            // EM gained the bonus but kingdom didn't pay).
                            // v9p33river335: cap bonus to available treasury so
                            // empty-treasury kingdoms don't fund EM bonuses
                            // from negative gold (matches Engine.deliverKingdomOrder).
                            var _emBonus = order.bonusOnCompletion || 0;
                            var _emActualBonus = Math.min(_emBonus, Math.max(0, k.gold || 0));
                            em.gold = (em.gold || 0) + _emActualBonus;
                            if (_emActualBonus > 0) k.gold = (k.gold || 0) - _emActualBonus;
                            em.ordersCompleted = (em.ordersCompleted || 0) + 1;
                            grantEmXp(em, Math.max(5, Math.floor(order.qty / 10)), 'order');
                        }
                    }
                }
                em.npcMerchantInventory = inv;
            }

            // ---- 8. NET WORTH UPDATE (every ~30 days, stagger-safe) ----
            if (!em._lastNetWorthDay || day - em._lastNetWorthDay >= 27) {
                em.netWorth = calculateNetWorth(em);
                em._lastNetWorthDay = day;
            }

            // ---- 9. CONQUEST & SERVITUDE RESPONSE (daily check) ----
            eliteConquestResponseAI(em, town, rng, personality);

            // ---- 10. FRONTLINE RESPONSE (every 3 days) ----
            if (day % 3 === 0) {
                eliteFrontlineAI(em, town, rng, personality);
            }

            // ---- 11. KING POLICY RESPONSE (every 7 days) ----
            if (day % 7 === 0) {
                eliteKingPolicyAI(em, town, rng, strategy, personality);
            }

            // ---- 12. ECONOMIC COLLAPSE RESPONSE (every 5 days) ----
            if (day % 5 === 0) {
                eliteCollapseAI(em, town, rng, personality);
            }

            // ---- 13. MIGRATION WAVE RESPONSE (every 10 days) ----
            if (day % 10 === 0) {
                eliteMigrationAI(em, town, rng, strategy);
            }

            // ---- 14. SUPPLY CHAIN AI (every 15 days) ----
            if (day % 15 === 0) {
                eliteSupplyChainAI(em, town, rng, strategy);
            }

            // ---- 14b. MEDICAL SUPPLY AI (every 10 days) ----
            if (day % 10 === 0) {
                eliteMedicalSupplyAI(em, town, rng);
            }

            // ---- 15. COMPETITION AI (every 20 days) ----
            if (day % 20 === 0) {
                eliteCompetitionAI(em, town, rng, strategy, personality);
            }

            // ---- 16. NATIONALIZATION RESPONSE (every 10 days) ----
            if (day % 10 === 0) {
                eliteNationalizationAI(em, town, rng, strategy);
            }

            // ---- 17. KINGDOM RELATIONSHIP AI (every 30 days) ----
            if (day % 30 === 0) {
                eliteKingdomRelationshipAI(em, town, rng, personality);
            }

            // Safety: prevent gold from going negative
            if (em.gold < 0) em.gold = 0;
        }
    }

    // ── Elite Merchant Storage Capacity ──
    function getEmStorageCapacity(em) {
        var capacity = 50; // base capacity without warehouses
        if (!em.buildings) return capacity;
        for (var wi = 0; wi < em.buildings.length; wi++) {
            var bRef = em.buildings[wi];
            if (!bRef || !bRef.type) continue;
            var bt = findBuildingType(bRef.type);
            if (bt && bt.storage) {
                capacity += Math.floor(bt.storage * (1 + (((bRef.level || 1) - 1) * 0.50)));
            }
        }
        return capacity;
    }

    function getEmCurrentInventory(inv) {
        var total = 0;
        for (var key in inv) {
            if (inv[key] > 0) total += inv[key];
        }
        return total;
    }

    function eliteTradeAI(em, town, rng, strategy) {
        if (!town.market) return;
        var inv = em.npcMerchantInventory || {};
        var preferredGoods = STRATEGY_GOODS[strategy] || STRATEGY_GOODS.diversified;
        // Player-requested focus good: prioritize this good and its supply chain
        if (em._focusGood) {
            var fg = em._focusGood;
            if (preferredGoods.indexOf(fg) < 0) {
                preferredGoods = [fg].concat(preferredGoods);
            } else {
                preferredGoods = [fg].concat(preferredGoods.filter(function(g) { return g !== fg; }));
            }
        }
        var currentStock = getEmCurrentInventory(inv);
        // Storage capacity: base 200 + 100 per warehouse building
        var storageCapacity = 200;
        if (em.buildings) {
            for (var _sci = 0; _sci < em.buildings.length; _sci++) {
                var _bld = em.buildings[_sci];
                var _bType = typeof _bld === 'string' ? _bld : (_bld.type || _bld.buildingType || '');
                if (_bType === 'warehouse') storageCapacity += 200;
                else if (_bType === 'warehouse_small') storageCapacity += 100;
            }
        }

        // Check for active trade subsidies in this kingdom
        var kingdom = findKingdom(town.kingdomId);
        var subsidizedGoods = {};
        if (kingdom && kingdom.tradeSubsidies) {
            for (var si = 0; si < kingdom.tradeSubsidies.length; si++) {
                var sub = kingdom.tradeSubsidies[si];
                if (sub.expiresDay > world.day && (sub.unitsPaid || 0) < (sub.maxUnits || 100)) {
                    subsidizedGoods[sub.good] = sub.bonusPerUnit || 2;
                }
            }
        }

        // Opportunity Sensing: find goods with zero supply but demand in known towns
        var opportunityGoods = {};
        var osKnownTownIds = [town.id];
        for (var ori = 0; ori < world.roads.length; ori++) {
            var oRoad = world.roads[ori];
            if (oRoad.fromTownId === town.id) osKnownTownIds.push(oRoad.toTownId);
            else if (oRoad.toTownId === town.id) osKnownTownIds.push(oRoad.fromTownId);
        }
        for (var oti = 0; oti < osKnownTownIds.length; oti++) {
            var osTown = findTown(osKnownTownIds[oti]);
            if (!osTown || !osTown.market) continue;
            for (var osGood in osTown.market.demand) {
                if ((osTown.market.demand[osGood] || 0) >= 10 && (osTown.market.supply[osGood] || 0) === 0) {
                    opportunityGoods[osGood] = true;
                }
            }
        }

        // Buy goods aligned with strategy at good prices
        var isTradeNetworkStrat = (strategy === 'trade_network');
        // M-5: Personality-based trade modifiers
        var pers = em.personality || {};
        var greedMod = ((pers.greed || 50) > 65) ? 1.2 : 1.0; // greedy EMs hold for 20% higher sell prices
        var frugalMod = ((pers.frugality || 50) > 65) ? 0.7 : 1.0; // frugal EMs spend 30% less per buy
        var intelMod = ((pers.intelligence || 50) > 65) ? 1.15 : 1.0; // intelligent EMs detect 15% smaller arbitrage spreads
        if ((em.gold || 0) > 20 && currentStock < storageCapacity) {
            var buyAttempts = isTradeNetworkStrat ? Math.min(preferredGoods.length, 5) : Math.min(preferredGoods.length, 3);
            for (var gi = 0; gi < buyAttempts; gi++) {
                if (currentStock >= storageCapacity) break;
                var remainingSpace = storageCapacity - currentStock;
                var resId = preferredGoods[rng.randInt(0, preferredGoods.length - 1)];
                var supply = (town.market.supply[resId] || 0);
                var price = (town.market.prices[resId] || 999);
                var res = findResourceById(resId);
                if (!res) continue;
                // More aggressive buying for subsidized goods (effective price is lower)
                var effectiveThreshold = res.basePrice * 1.2;
                if (subsidizedGoods[resId]) {
                    effectiveThreshold = res.basePrice * 1.5; // buy at higher prices since subsidy offsets cost
                }
                // Opportunity Sensing: willing to pay more for goods with zero supply elsewhere
                if (opportunityGoods[resId]) {
                    effectiveThreshold *= 1.3;
                }
                // Buy if price is below threshold and there's supply
                if (supply > 3 && price < effectiveThreshold && em.gold >= price * 3) {
                    var maxBudget = Math.floor(em.gold * (isTradeNetworkStrat ? 0.25 : 0.15) * frugalMod);
                    if (subsidizedGoods[resId]) maxBudget = Math.floor(em.gold * (isTradeNetworkStrat ? 0.35 : 0.25) * frugalMod);
                    var qty = Math.min(rng.randInt(2, isTradeNetworkStrat ? 12 : 8), Math.floor(supply * (isTradeNetworkStrat ? 0.25 : 0.15)), Math.floor(maxBudget / price));
                    if (qty > 0) {
                        var buyMult = emHasSkill(em, 'master_haggler') ? 0.90 : emHasSkill(em, 'haggler') ? 0.95 : 1.0;
                        var adjBuyPrice = Math.floor(price * buyMult);
                        em.gold -= Math.floor(adjBuyPrice * qty);
                        inv[resId] = (inv[resId] || 0) + qty;
                        town.market.supply[resId] -= qty;
                        collectTradeTax(town.kingdomId, Math.floor(adjBuyPrice * qty), resId);
                        grantEmXp(em, Math.max(1, Math.floor(adjBuyPrice * qty / 50)), 'trade');
                        emitTrackedEMNotification(em, 'bought ' + qty + ' ' + resId + ' in ' + (town.name || 'town'), { townId: town.id });
                    }
                }
            }
        }

        // Opportunistic buying: scarce goods elsewhere that we can trade (requires market_scout or trade_network strategy)
        if ((emHasSkill(em, 'market_scout') || isTradeNetworkStrat) && (em.gold || 0) > 100 && currentStock < storageCapacity) {
            for (var resKey in town.market.supply) {
                if (currentStock >= storageCapacity) break;
                if ((town.market.supply[resKey] || 0) < 5) continue;
                var scarcityPrice = town.market.prices[resKey] || 999;
                var scarcityRes = findResourceById(resKey);
                if (!scarcityRes) continue;
                // Buy cheap goods that might be scarce in other towns
                var remainOpp = storageCapacity - currentStock;
                if (scarcityPrice < scarcityRes.basePrice * 0.7 && (inv[resKey] || 0) < 15) {
                    var scarceQty = Math.min(rng.randInt(1, 4), Math.floor(em.gold * 0.05 / scarcityPrice), remainOpp);
                    if (scarceQty > 0 && em.gold >= scarcityPrice * scarceQty) {
                        em.gold -= Math.floor(scarcityPrice * scarceQty);
                        inv[resKey] = (inv[resKey] || 0) + scarceQty;
                        town.market.supply[resKey] -= scarceQty;
                        currentStock += scarceQty;
                        collectTradeTax(town.kingdomId, Math.floor(scarcityPrice * scarceQty), resKey);
                    }
                }
            }
        }

        // Demand exploitation: sell high-demand goods at premium (requires market_scout or trade_network strategy)
        if ((emHasSkill(em, 'market_scout') || isTradeNetworkStrat) && (em.gold || 0) > 200 && town.market.demand) {
            for (var demResId in town.market.demand) {
                var demDemand = town.market.demand[demResId] || 0;
                var demSupply = town.market.supply[demResId] || 0;
                var demPrice = town.market.prices[demResId] || 0;
                var demRes = findResourceById(demResId);
                if (!demRes || demDemand < 5 || demSupply > demDemand * 0.7) continue;
                if (demPrice < demRes.basePrice * 1.2) continue;

                var demHeldQty = inv[demResId] || 0;
                if (demHeldQty > 0 && demPrice > demRes.basePrice * 1.3) {
                    var demSellQty = Math.min(demHeldQty, rng.randInt(1, 4));
                    var demSellMult = emHasSkill(em, 'golden_tongue') ? 1.10 : emHasSkill(em, 'silver_tongue') ? 1.05 : 1.0;
                    var demAdjPrice = Math.floor(demPrice * demSellMult);
                    em.gold += Math.floor(demAdjPrice * demSellQty);
                    inv[demResId] -= demSellQty;
                    town.market.supply[demResId] = (town.market.supply[demResId] || 0) + demSellQty;
                    collectTradeTax(town.kingdomId, Math.floor(demAdjPrice * demSellQty), demResId);
                    grantEmXp(em, Math.max(1, Math.floor(demAdjPrice * demSellQty / 50)), 'demand_trade');
                    emitTrackedEMNotification(em, 'exploited demand: sold ' + demSellQty + ' ' + demResId + ' in ' + (town.name || 'town'), { townId: town.id });
                }
            }
        }

        // Sell overstock or goods at high price
        for (var resId2 in inv) {
            if ((inv[resId2] || 0) <= 0) continue;
            var price2 = (town.market.prices[resId2] || 1);
            var sellMult = emHasSkill(em, 'golden_tongue') ? 1.10 : emHasSkill(em, 'silver_tongue') ? 1.05 : 1.0;
            var adjSellPrice = Math.floor(price2 * sellMult);
            var res2 = findResourceById(resId2);
            if (!res2) continue;
            var isPreferred = preferredGoods.indexOf(resId2) >= 0;
            // Sell if price is 40%+ above base, or 80%+ for preferred (hoard preferred goods)
            // Trade network EMs sell more aggressively — lower thresholds
            var sellThresh = isPreferred ? 1.8 : 1.4;
            if (isTradeNetworkStrat) sellThresh = isPreferred ? 1.4 : 1.2;
            // Lower sell threshold for subsidized goods (bonus income makes selling more attractive)
            if (subsidizedGoods[resId2]) sellThresh = isPreferred ? 1.4 : 1.1;
            // Greedy EMs hold out for higher prices
            sellThresh *= greedMod;
            if (price2 > res2.basePrice * sellThresh) {
                var sellQty = Math.min(inv[resId2], rng.randInt(1, 5));
                if (isPreferred && !subsidizedGoods[resId2]) sellQty = Math.min(sellQty, Math.floor(inv[resId2] * 0.3)); // keep 70% of preferred
                if (sellQty > 0) {
                    em.gold += Math.floor(adjSellPrice * sellQty);
                    inv[resId2] -= sellQty;
                    town.market.supply[resId2] = (town.market.supply[resId2] || 0) + sellQty;
                    collectTradeTax(town.kingdomId, Math.floor(adjSellPrice * sellQty), resId2);
                    grantEmXp(em, Math.max(1, Math.floor(adjSellPrice * sellQty / 50)), 'trade');
                    emitTrackedEMNotification(em, 'sold ' + sellQty + ' ' + resId2 + ' in ' + (town.name || 'town'), { townId: town.id });
                }
            }
        }
        em.npcMerchantInventory = inv;

        // War profiteer: aggressive military goods trading when wars exist
        if (strategy === 'war_profiteer') {
            var warringKingdoms = world.kingdoms.filter(function(kk) { return kk.atWar && kk.atWar.size > 0; });
            if (warringKingdoms.length > 0) {
                var militaryGoods = ['swords', 'armor', 'bows', 'arrows', 'horses', 'iron', 'preserved_food'];
                var isInWarZone = warringKingdoms.some(function(kk) { return kk.id === town.kingdomId; });
                inv = em.npcMerchantInventory;

                if (isInWarZone) {
                    // In a warring kingdom: sell military goods at premium (lower sell threshold)
                    for (var wsi = 0; wsi < militaryGoods.length; wsi++) {
                        var wGood = militaryGoods[wsi];
                        var wQty = inv[wGood] || 0;
                        if (wQty <= 0) continue;
                        var wPrice = town.market.prices[wGood] || 1;
                        var wRes = findResourceById(wGood);
                        if (!wRes) continue;
                        // Sell at any price above base (wartime premium)
                        if (wPrice >= wRes.basePrice * 1.1) {
                            var wSellQty = Math.min(wQty, rng.randInt(1, Math.max(2, Math.floor(wQty * 0.5))));
                            if (wSellQty > 0) {
                                em.gold += Math.floor(wPrice * wSellQty);
                                inv[wGood] -= wSellQty;
                                town.market.supply[wGood] = (town.market.supply[wGood] || 0) + wSellQty;
                            }
                        }
                    }
                } else if (emHasSkill(em, 'trade_network')) {
                    // Not in a warring kingdom: buy military goods cheaply to sell in war zones (requires trade_network)
                    for (var wbi = 0; wbi < militaryGoods.length; wbi++) {
                        if (currentStock >= storageCapacity) break;
                        var wbGood = militaryGoods[wbi];
                        var wbSupply = town.market.supply[wbGood] || 0;
                        var wbPrice = town.market.prices[wbGood] || 999;
                        var wbRes = findResourceById(wbGood);
                        if (!wbRes || wbSupply < 3) continue;
                        var wbRemain = storageCapacity - currentStock;
                        // Buy aggressively at or below base price
                        if (wbPrice <= wbRes.basePrice * 1.3 && em.gold >= wbPrice * 3) {
                            var wbMaxBudget = Math.floor(em.gold * 0.2);
                            var wbBuyQty = Math.min(rng.randInt(2, 10), Math.floor(wbSupply * 0.3), Math.floor(wbMaxBudget / wbPrice), wbRemain);
                            if (wbBuyQty > 0) {
                                em.gold -= Math.floor(wbPrice * wbBuyQty);
                                inv[wbGood] = (inv[wbGood] || 0) + wbBuyQty;
                                town.market.supply[wbGood] -= wbBuyQty;
                                currentStock += wbBuyQty;
                            }
                        }
                    }
                }
                em.npcMerchantInventory = inv;
            }
        }
    }

    function eliteTravelAI(em, currentTown, rng, strategy) {
        // Find best destination based on strategy
        var bestTown = null;
        var bestScore = -1;
        var preferredGoods = STRATEGY_GOODS[strategy] || STRATEGY_GOODS.diversified;
        if (em._focusGood) {
            var fg2 = em._focusGood;
            if (preferredGoods.indexOf(fg2) < 0) preferredGoods = [fg2].concat(preferredGoods);
            else preferredGoods = [fg2].concat(preferredGoods.filter(function(g) { return g !== fg2; }));
        }

        var connected = [];
        for (var ri = 0; ri < world.roads.length; ri++) {
            var road = world.roads[ri];
            if (road.condition === 'destroyed') continue;
            // Skip roads with destroyed bridges
            var _emBrDest = false;
            if (road.bridges && road.bridges.length > 0) {
                for (var _ebi = 0; _ebi < road.bridges.length; _ebi++) {
                    if (road.bridges[_ebi].destroyed) { _emBrDest = true; break; }
                }
            } else if (road.hasBridge && road.bridgeDestroyed) { _emBrDest = true; }
            if (_emBrDest) continue;
            if (road.fromTownId === em.townId) connected.push(road.toTownId);
            else if (road.toTownId === em.townId) connected.push(road.fromTownId);
        }
        // Sea routes
        for (var si = 0; si < world.seaRoutes.length; si++) {
            var sr = world.seaRoutes[si];
            if (sr.fromTownId === em.townId) connected.push(sr.toTownId);
            else if (sr.toTownId === em.townId) connected.push(sr.fromTownId);
        }

        // Check for trade subsidies in connected town kingdoms
        var subsidyMap = {};
        for (var ki = 0; ki < world.kingdoms.length; ki++) {
            var kdom = world.kingdoms[ki];
            if (kdom.tradeSubsidies) {
                for (var tsi = 0; tsi < kdom.tradeSubsidies.length; tsi++) {
                    var tsub = kdom.tradeSubsidies[tsi];
                    if (tsub.expiresDay > world.day && (tsub.unitsPaid || 0) < (tsub.maxUnits || 100)) {
                        subsidyMap[tsub.good + '_' + kdom.id] = tsub.bonusPerUnit || 2;
                    }
                }
            }
        }

        for (var ci2 = 0; ci2 < connected.length; ci2++) {
            var destTown = findTown(connected[ci2]);
            if (!destTown || !destTown.market) continue;
            var score = 0;
            var isCrossKingdom = destTown.kingdomId !== em.kingdomId;
            var destKingdom = findKingdom(destTown.kingdomId);
            var tariffRate = (isCrossKingdom && destKingdom && destKingdom.laws) ? (destKingdom.laws.tradeTariff || 0) : 0;

            // Score based on trade opportunities
            // Intelligence modifier: smarter EMs detect smaller price spreads
            var travelIntelMod = ((em.personality || {}).intelligence || 50) > 65 ? 0.85 : 1.0;
            for (var pi2 = 0; pi2 < preferredGoods.length; pi2++) {
                var gId = preferredGoods[pi2];
                var destPrice = destTown.market.prices[gId] || 0;
                var localPrice = currentTown.market.prices[gId] || 0;
                var destSupply = destTown.market.supply[gId] || 0;
                var r = findResourceById(gId);
                if (!r) continue;
                // Good buy opportunity: cheap goods at dest
                if (destSupply > 5 && destPrice < r.basePrice * (0.9 * travelIntelMod)) score += 10;
                // Good sell opportunity: high price at dest, we have inventory
                if (destPrice > r.basePrice * (1.5 * travelIntelMod) && (em.npcMerchantInventory[gId] || 0) > 0) score += 20;
                // Arbitrage: cheaper at dest than here (intelligent EMs detect smaller spreads)
                if (destPrice < localPrice * (0.7 / travelIntelMod) && destSupply > 3) score += 15;
                // Trade subsidy bonus: prefer destinations where our goods are subsidized
                if (subsidyMap[gId + '_' + destTown.kingdomId] && (em.npcMerchantInventory[gId] || 0) > 0) score += 12;

                // Opportunity Sensing: boost destinations with unmet demand for goods we carry
                if ((em.npcMerchantInventory[gId] || 0) > 0) {
                    var osDemand = destTown.market.demand[gId] || 0;
                    var osSupply = destTown.market.supply[gId] || 0;
                    if (osSupply === 0 && osDemand >= 10) score += 25;
                }

                // Cross-kingdom arbitrage: evaluate actual profit after tariffs (requires trade_network or global_trade_intel)
                if (isCrossKingdom && (emHasSkill(em, 'trade_network') || emHasSkill(em, 'global_trade_intel'))) {
                    var heldQty = em.npcMerchantInventory[gId] || 0;
                    if (heldQty > 0 && destPrice > 0) {
                        var netSellPrice = destPrice * (1 - tariffRate);
                        var arbitrageProfit = netSellPrice - localPrice;
                        if (arbitrageProfit > 5) score += Math.min(40, Math.floor(arbitrageProfit * heldQty * 0.5));
                    }
                    // Buy opportunity in foreign market (cheaper even after tariff to bring home)
                    if (destSupply > 3 && destPrice > 0) {
                        var effectiveBuyPrice = destPrice * (1 + tariffRate);
                        if (effectiveBuyPrice < localPrice * 0.7) score += 12;
                    }
                }
            }

            // Cross-kingdom bonus: evaluate ALL inventory for arbitrage (requires trade_network or global_trade_intel)
            if (isCrossKingdom && (emHasSkill(em, 'trade_network') || emHasSkill(em, 'global_trade_intel'))) {
                for (var invKey in em.npcMerchantInventory) {
                    if ((em.npcMerchantInventory[invKey] || 0) <= 0) continue;
                    if (preferredGoods.indexOf(invKey) >= 0) continue; // already scored
                    var invDestPrice = destTown.market.prices[invKey] || 0;
                    var invLocalPrice = currentTown.market.prices[invKey] || 0;
                    if (invDestPrice > 0) {
                        var invNetPrice = invDestPrice * (1 - tariffRate);
                        var invProfit = invNetPrice - invLocalPrice;
                        if (invProfit > 5) score += Math.min(20, Math.floor(invProfit * 0.3));
                    }
                }
            }

            // Bonus for larger towns (more market activity)
            score += (destTown.prosperity || 0) * 0.1;
            // Skill-based scoring adjustments
            if (!emHasSkill(em, 'market_scout')) score *= 0.5; // guessing without market knowledge
            if (emHasSkill(em, 'global_trade_intel')) score += 5; // perfect market info bonus
            // Penalize same kingdom for luxury_trader (they want long-distance)
            if (strategy === 'luxury_trader' && destTown.kingdomId === em.kingdomId) score *= 0.5;

            // Penalize frontline towns (dangerous for merchants)
            if (destTown.isFrontline) score *= 0.3;
            // Penalize recently conquered towns
            if (destTown._justConquered) score *= 0.1;
            // Penalize very low-happiness towns (unrest)
            if ((destTown.happiness || 50) < 20) score *= 0.6;
            // Bonus for tax holiday towns (good investment destination)
            if (destKingdom && destKingdom.taxHolidays) {
                for (var thi = 0; thi < destKingdom.taxHolidays.length; thi++) {
                    if (destKingdom.taxHolidays[thi].townId === destTown.id && destKingdom.taxHolidays[thi].expiresDay > world.day) {
                        score += 8;
                        break;
                    }
                }
            }
            // War profiteer: prioritize warring kingdom towns with high military demand
            if (strategy === 'war_profiteer' && destKingdom && destKingdom.atWar && destKingdom.atWar.size > 0) {
                // Warring kingdoms have high demand for military goods — big bonus
                score += 30;
                // Extra bonus for towns with high garrison (more demand)
                score += Math.min(20, (destTown.garrison || 0) * 0.5);
                // Don't penalize frontline towns — that's where the profit is
                if (destTown.isFrontline) score *= 3.0; // override the penalty
                // Check if we have military goods to sell
                var milGoods = ['swords', 'armor', 'bows', 'arrows', 'horses', 'iron'];
                for (var mgi = 0; mgi < milGoods.length; mgi++) {
                    if ((em.npcMerchantInventory[milGoods[mgi]] || 0) > 0) {
                        var mgDestPrice = destTown.market.prices[milGoods[mgi]] || 0;
                        var mgRes = findResourceById(milGoods[mgi]);
                        if (mgRes && mgDestPrice > mgRes.basePrice * 1.2) {
                            score += Math.floor(mgDestPrice * 0.5);
                        }
                    }
                }
            } else if (strategy === 'war_profiteer') {
                // No wars: war profiteers still want cheap military goods to stockpile
                var wpMilGoods = ['swords', 'armor', 'bows', 'arrows', 'iron'];
                for (var wpgi = 0; wpgi < wpMilGoods.length; wpgi++) {
                    var wpSupply = destTown.market.supply[wpMilGoods[wpgi]] || 0;
                    var wpPrice = destTown.market.prices[wpMilGoods[wpgi]] || 999;
                    var wpRes = findResourceById(wpMilGoods[wpgi]);
                    if (wpRes && wpSupply > 5 && wpPrice < wpRes.basePrice * 0.8) {
                        score += 10; // good stockpiling opportunity
                    }
                }
            }

            // Bonus for immigration incentive towns (growing economy = opportunity)
            if (destKingdom && destKingdom.immigrationIncentives) {
                for (var imi = 0; imi < destKingdom.immigrationIncentives.length; imi++) {
                    if (destKingdom.immigrationIncentives[imi].townId === destTown.id && destKingdom.immigrationIncentives[imi].expiresDay > world.day) {
                        score += 5;
                        break;
                    }
                }
            }

            if (score > bestScore) {
                bestScore = score;
                bestTown = destTown;
            }
        }

        // Only travel if good opportunity (score > 15) or random wanderlust
        if (bestTown && (bestScore > 15 || rng.chance(0.1))) {
            var emOldTown = findTown(em.townId);
            if (emOldTown && emOldTown.population > 0) emOldTown.population--;
            em.townId = bestTown.id;
            em.kingdomId = bestTown.kingdomId;
            bestTown.population = (bestTown.population || 0) + 1;
            if (Engine.moveYoungChildrenWithParent) Engine.moveYoungChildrenWithParent(em, bestTown.id, bestTown.kingdomId);
        }
    }

    function eliteBuildAI(em, town, rng, strategy) {
        var preferredBuildings = STRATEGY_BUILDINGS[strategy] || STRATEGY_BUILDINGS.diversified;
        var ownedCount = (em.buildings || []).length;
        // Rank limits
        var maxRank = 0;
        for (var kId in em.socialRank) { if ((em.socialRank[kId] || 0) > maxRank) maxRank = em.socialRank[kId]; }
        var rankDef = CONFIG.SOCIAL_RANKS[maxRank] || CONFIG.SOCIAL_RANKS[0];
        var maxBuildings = rankDef.maxBuildings || 2;
        if (ownedCount >= maxBuildings) return;

        // Can afford?
        if ((em.gold || 0) < 200) return;

        // Check for land subsidies and tax holidays to pick optimal town
        var kingdom = findKingdom(town.kingdomId);
        var buildTown = town;
        var subsidyDiscount = 0;
        var hasTaxHoliday = false;

        // Search for subsidized/tax-holiday towns in our kingdom (requires market_scout or trade_network)
        if (kingdom && (emHasSkill(em, 'market_scout') || emHasSkill(em, 'trade_network'))) {
            var bestSubsidyScore = 0;
            for (var ti = 0; ti < world.towns.length; ti++) {
                var candidateTown = world.towns[ti];
                if (candidateTown.kingdomId !== kingdom.id) continue;
                var candidateScore = 0;
                var candidateDiscount = 0;

                // Check land subsidies for this town
                if (kingdom.landSubsidies) {
                    for (var lsi = 0; lsi < kingdom.landSubsidies.length; lsi++) {
                        var ls = kingdom.landSubsidies[lsi];
                        if (ls.townId === candidateTown.id && ls.expiresDay > world.day) {
                            if (preferredBuildings.indexOf(ls.buildingType) >= 0) {
                                candidateScore += 20;
                                candidateDiscount = ls.discount || 0.4;
                            }
                        }
                    }
                }

                // Check tax holidays
                if (kingdom.taxHolidays) {
                    for (var thi2 = 0; thi2 < kingdom.taxHolidays.length; thi2++) {
                        if (kingdom.taxHolidays[thi2].townId === candidateTown.id && kingdom.taxHolidays[thi2].expiresDay > world.day) {
                            candidateScore += 15;
                            break;
                        }
                    }
                }

                // Bonus for being current town (no travel needed)
                if (candidateTown.id === town.id) candidateScore += 5;
                // Penalty for frontline towns
                if (candidateTown.isFrontline) candidateScore -= 20;
                // Bonus for prosperous towns
                candidateScore += (candidateTown.prosperity || 0) * 0.05;

                if (candidateScore > bestSubsidyScore) {
                    bestSubsidyScore = candidateScore;
                    buildTown = candidateTown;
                    subsidyDiscount = candidateDiscount;
                    hasTaxHoliday = candidateScore >= 15;
                }
            }
        }

        // Supply chain gap detection in current + connected towns
        var demandGapType = null;
        var demandGapTown = null;
        var demandGapScore = 0;

        if (emHasSkill(em, 'keen_eye')) {
            var checkTowns = [town];
            // With market_scout, also check connected towns
            if (emHasSkill(em, 'market_scout') && town.connectedTowns) {
                for (var cti = 0; cti < Math.min(town.connectedTowns.length, 5); cti++) {
                    var ct = findTown(town.connectedTowns[cti]);
                    if (ct && ct.market) checkTowns.push(ct);
                }
            }

            for (var dti = 0; dti < checkTowns.length; dti++) {
                var dTown = checkTowns[dti];
                if (!dTown.market) continue;
                for (var dResId in dTown.market.demand) {
                    var dDemand = dTown.market.demand[dResId] || 0;
                    var dSupply = dTown.market.supply[dResId] || 0;
                    if (dDemand <= 2 || dSupply >= dDemand * 0.6) continue;

                    // Check if there's no local producer
                    var hasProducer = dTown.buildings.some(function(b) {
                        var bt2 = findBuildingType(b.type);
                        return bt2 && bt2.produces === dResId;
                    });
                    if (hasProducer) continue;

                    // Find what building makes this
                    var producerTypeId = null;
                    for (var btKey in BUILDING_TYPES) {
                        if (BUILDING_TYPES[btKey].produces === dResId) {
                            producerTypeId = btKey;
                            break;
                        }
                    }
                    if (!producerTypeId) continue;

                    var gapScore = (dDemand - dSupply) * 2;
                    // Opportunity Sensing: double attractiveness when supply is completely absent
                    if (dSupply === 0 && dDemand >= 10) gapScore *= 2.0;
                    // Prefer current town (no travel needed)
                    if (dTown.id === town.id) gapScore += 10;
                    // Prefer higher demand gaps
                    var dPrice = dTown.market.prices[dResId] || 0;
                    var dRes = findResourceById(dResId);
                    if (dRes && dPrice > dRes.basePrice * 1.3) gapScore += 10;

                    // supply_chain_expert bonus
                    if (emHasSkill(em, 'supply_chain_expert')) gapScore += Math.floor(gapScore * 0.2);

                    if (gapScore > demandGapScore) {
                        demandGapScore = gapScore;
                        demandGapType = producerTypeId;
                        demandGapTown = dTown;
                    }
                }
            }
        }

        var bType = rng.pick(preferredBuildings);

        // ── Clinic/Hospital intelligence: ANY EM considers building medical facilities if town lacks them ──
        var townHasClinic = buildTown.buildings.some(function(b) {
            return b.type === 'clinic' || b.type === 'hospital';
        });
        if (!townHasClinic && buildTown.population > 100) {
            // Medical strategy EMs always prioritize clinics
            if (strategy === 'medical_supplier') {
                bType = 'clinic';
            }
            // Other EMs consider it if town health is poor or population is large
            else if ((buildTown.healthRating || 50) < 40 || buildTown.population > 300) {
                if (rng.chance(0.25)) bType = 'clinic';
            }
        }
        // Hospital upgrade: medical EMs with enough capital build hospitals in large towns
        if (strategy === 'medical_supplier' && townHasClinic && (em.gold || 0) > 3000 && buildTown.population > 250) {
            var townHasHospital = buildTown.buildings.some(function(b) { return b.type === 'hospital'; });
            if (!townHasHospital && rng.chance(0.3)) {
                bType = 'hospital';
            }
        }
        // Advanced Apothecary: medical EMs consider building one in cities/capitals that lack it
        if (strategy === 'medical_supplier' && (em.gold || 0) > 2000) {
            var _bCat = buildTown.category || 'village';
            var _hasAdvApoth = buildTown.buildings.some(function(b) { return b.type === 'advanced_apothecary'; });
            var _hasApoth = buildTown.buildings.some(function(b) { return b.type === 'apothecary'; });
            if (!_hasAdvApoth && _hasApoth && (_bCat === 'city' || _bCat === 'capital_city' || _bCat === 'town') && rng.chance(0.35)) {
                bType = 'advanced_apothecary';
            }
        }

        // If we found a high-value demand gap, prefer building that over random strategy building
        if (demandGapType && demandGapScore > 15 && rng.chance(0.4)) {
            bType = demandGapType;
            if (demandGapTown && demandGapTown.id !== town.id) {
                buildTown = demandGapTown;
            }
        }
        // If there's a specific subsidized building type, prefer it
        // NPCs that take the subsidy MUST build the subsidized building type
        var subsidizedBuildingType = null;
        if (subsidyDiscount > 0 && kingdom && kingdom.landSubsidies) {
            for (var lsi2 = 0; lsi2 < kingdom.landSubsidies.length; lsi2++) {
                var ls2 = kingdom.landSubsidies[lsi2];
                if (ls2.townId === buildTown.id && ls2.expiresDay > world.day) {
                    subsidizedBuildingType = ls2.buildingType;
                    if (preferredBuildings.indexOf(ls2.buildingType) >= 0) {
                        bType = ls2.buildingType;
                    }
                    break;
                }
            }
        }
        // Subsidy discount only applies if building the subsidized building type
        if (bType !== subsidizedBuildingType) {
            subsidyDiscount = 0;
        }

        var bt = findBuildingType(bType);
        if (!bt) return;

        // Check minTownCategory requirement
        if (bt.minTownCategory) {
            var _tcRank = { outpost: 0, village: 1, town: 2, city: 3, capital_city: 4 };
            var _btMinRank = _tcRank[bt.minTownCategory] || 0;
            var _btTownRank = _tcRank[buildTown.category] || 0;
            if (_btTownRank < _btMinRank) return;
        }

        // Check natural deposit requirement
        var depReq = CONFIG.DEPOSIT_REQUIREMENTS ? CONFIG.DEPOSIT_REQUIREMENTS[bt.id] : null;
        if (depReq) {
            var townDeps = buildTown.naturalDeposits || {};
            if (!townDeps[depReq.deposit] || townDeps[depReq.deposit] <= 0) return;
        }

        // Calculate material cost from local market + check availability
        var materialCost = 0;
        if (bt.materials) {
            for (var matId in bt.materials) {
                var qtyNeeded = bt.materials[matId];
                var marketHas = (buildTown.market && buildTown.market.supply[matId]) || 0;
                if (marketHas < qtyNeeded) return; // Materials not available — skip
                var matPrice = getMarketPrice(buildTown, matId) || 5;
                materialCost += qtyNeeded * matPrice;
            }
        }
        var buildSkillMult = emHasSkill(em, 'master_builder') ? 0.80 : emHasSkill(em, 'efficient_builder') ? 0.90 : 1.0;
        // Guild member discount: 10% off labor for buildings in guild's category
        var emGuildDiscount = 1.0;
        if (bt.category && em.guilds && CONFIG.GUILDS) {
            for (var _egk in CONFIG.GUILDS) {
                var _eguild = CONFIG.GUILDS[_egk];
                if (_eguild.categories && _eguild.categories.indexOf(bt.category) >= 0) {
                    var _emMem = em.guilds[_egk];
                    if (_emMem && _emMem.expiresDay && _emMem.expiresDay > world.day) {
                        emGuildDiscount = 0.90;
                        break;
                    }
                }
            }
        }
        var laborCost = Math.floor(bt.cost * (1 - subsidyDiscount) * buildSkillMult * emGuildDiscount);
        var effectiveCost = laborCost + materialCost;

        // Land purchase requirement (mirrors player system)
        if (!em.landOwned) em.landOwned = {};
        var emLandInTown = em.landOwned[buildTown.id] || 0;
        var emBuildingsInTown = 0;
        for (var _eli = 0; _eli < buildTown.buildings.length; _eli++) {
            if (buildTown.buildings[_eli].ownerId === em.id) emBuildingsInTown++;
        }
        if (emBuildingsInTown >= emLandInTown) {
            // Need to buy land first — check rank-based land cap
            var emMaxRank = 0;
            for (var _erk in em.socialRank) { if ((em.socialRank[_erk] || 0) > emMaxRank) emMaxRank = em.socialRank[_erk]; }
            var emRankDef = CONFIG.SOCIAL_RANKS[emMaxRank] || CONFIG.SOCIAL_RANKS[0];
            var emTotalLand = 0;
            for (var _etl in em.landOwned) emTotalLand += (em.landOwned[_etl] || 0);
            if (emRankDef.maxLand !== undefined && emTotalLand >= emRankDef.maxLand) return; // at land cap

            // Calculate land cost
            var emLandCat = buildTown.category || 'town';
            var emLandSizeMult = (CONFIG.LAND_COST_MULTIPLIER && CONFIG.LAND_COST_MULTIPLIER[emLandCat]) || (CONFIG.HOUSING_LABOR_MULTIPLIER && CONFIG.HOUSING_LABOR_MULTIPLIER[emLandCat]) || 1.0;
            var emLandProspMult = Math.max(0.5, (buildTown.prosperity || 50) / 50);
            var emLandCost = Math.floor((CONFIG.LAND_COST_BASE || 250) * emLandSizeMult * emLandProspMult);
            if (subsidyDiscount > 0) emLandCost = Math.floor(emLandCost * (1 - subsidyDiscount));

            var totalNeeded = effectiveCost + emLandCost;
            if (em.gold < totalNeeded) return; // can't afford land + building

            // Buy the land
            em.gold -= emLandCost;
            em.landOwned[buildTown.id] = (em.landOwned[buildTown.id] || 0) + 1;
            // Note: land cost already deducted above, don't add to effectiveCost
        }

        if (em.gold < effectiveCost) return;

        // Check town slots
        var maxSlots = CONFIG.TOWN_CATEGORIES[buildTown.category] ? CONFIG.TOWN_CATEGORIES[buildTown.category].maxBuildingSlots : 10;
        if (buildTown.buildings.length >= maxSlots) {
            // Town is full — consider converting an owned farm to fill demand gaps
            if (demandGapType && (isCropFarm(demandGapType) || isLivestockFarm(demandGapType))) {
                for (var eci = 0; eci < buildTown.buildings.length; eci++) {
                    var ecBld = buildTown.buildings[eci];
                    if (ecBld.ownerId !== em.id) continue;
                    if (ecBld.type === demandGapType) continue;
                    if (isCropFarm(ecBld.type) && isCropFarm(demandGapType)) {
                        var ecCost = getFarmConversionCost(ecBld, demandGapType);
                        if (ecCost && em.gold >= ecCost.gold) {
                            convertFarmBuilding(buildTown, eci, demandGapType, em.id, 'elite');
                        }
                        break;
                    }
                    if (isLivestockFarm(ecBld.type) && isLivestockFarm(demandGapType)) {
                        var elCost = getFarmConversionCost(ecBld, demandGapType);
                        if (elCost && em.gold >= elCost.gold) {
                            convertFarmBuilding(buildTown, eci, demandGapType, em.id, 'elite');
                        }
                        break;
                    }
                }
            }
            return;
        }

        // Consume materials from town market
        if (bt.materials) {
            for (var matId2 in bt.materials) {
                buildTown.market.supply[matId2] = Math.max(0, (buildTown.market.supply[matId2] || 0) - bt.materials[matId2]);
            }
        }

        em.gold -= effectiveCost;
        // Distribute construction wages to local NPCs (EM building)
        distributeConstructionWages(buildTown.id, effectiveCost, world.rng);
        if (!em.buildings) em.buildings = [];
        var emGuildChance = buildTown.population >= 5000 ? 0.75 : buildTown.population >= 2000 ? 0.60 : buildTown.population >= 500 ? 0.45 : 0.30;
        var newBld = { type: bType, level: 1, ownerId: em.id, townId: buildTown.id, workers: [], upgrades: [], builtDay: world.day, _profitTracker: { revenue: 0, costs: 0, days: 0 }, inGuild: world.rng ? world.rng.chance(emGuildChance) : Math.random() < emGuildChance };
        buildTown.buildings.push(newBld);
        em.buildings.push({ type: bType, townId: buildTown.id, level: 1 });
        var subsidyNote = subsidyDiscount > 0 ? ' (with ' + Math.round(subsidyDiscount * 100) + '% land subsidy)' : '';
        var holidayNote = hasTaxHoliday ? ' Tax holiday active.' : '';
        var _emBuildMsg = em.firstName + ' ' + (em.lastName || '') + ' built a ' + bt.name + ' in ' + buildTown.name + '. (materials: ' + (+materialCost).toFixed(2) + 'g, labor: ' + (+laborCost).toFixed(2) + 'g)' + subsidyNote;
        var _emBuildDetails = {
            type: 'elite_construction',
            townId: buildTown.id,
            cause: em.firstName + ' ' + (em.lastName || '') + ' invested in ' + buildTown.name + '\'s economy.' + holidayNote,
            effects: [
                'New ' + bt.name + ' provides jobs and production',
                em.firstName + ' spent ' + effectiveCost + 'g on construction' + subsidyNote,
                'Town economy should improve over time'
            ]
        ,
        _noToast: true};
        if (_isPlayerRelevantTown(buildTown.id)) {
            logEvent(_emBuildMsg, _emBuildDetails, 'npc_activity');
        } else {
            logHiddenEvent(_emBuildMsg, _emBuildDetails, 'npc_activity');
        }
        grantEmXp(em, 10, 'build');
    }

    // ── Elite Merchant Worker Hiring & Management AI ──
    function eliteWorkerAI(em, town, rng) {
        // Collect ALL buildings owned by this EM across all towns
        // Each entry: { bld: buildingObj, townId: string }
        var allEmBuildings = [];
        var seenBldIds = {};

        // Check current town first
        if (town && town.buildings) {
            for (var bi = 0; bi < town.buildings.length; bi++) {
                if (town.buildings[bi].ownerId === em.id) {
                    allEmBuildings.push({ bld: town.buildings[bi], townId: town.id });
                    seenBldIds[town.id + '_' + bi] = true;
                }
            }
        }

        // Check buildings in other towns via em.buildings references
        if (em.buildings) {
            for (var ebi = 0; ebi < em.buildings.length; ebi++) {
                var emBRef = em.buildings[ebi];
                if (!emBRef.townId) continue;
                if (town && emBRef.townId === town.id) continue; // already checked
                var otherTown = findTown(emBRef.townId);
                if (!otherTown || !otherTown.buildings) continue;
                for (var obi = 0; obi < otherTown.buildings.length; obi++) {
                    if (otherTown.buildings[obi].ownerId === em.id) {
                        var key = emBRef.townId + '_' + obi;
                        if (!seenBldIds[key]) {
                            allEmBuildings.push({ bld: otherTown.buildings[obi], townId: emBRef.townId });
                            seenBldIds[key] = true;
                        }
                    }
                }
            }
        }

        if (allEmBuildings.length === 0) return;

        var totalHired = 0;
        var totalFired = 0;

        for (var i = 0; i < allEmBuildings.length; i++) {
            var entry = allEmBuildings[i];
            var bld = entry.bld;
            var bldTownId = entry.townId;
            var bt = findBuildingType(bld.type);
            if (!bt) continue;
            var requiredWorkers = (bt.workers || 0) * (bld.level || 1);
            if (requiredWorkers <= 0) continue;

            if (!bld.workers) bld.workers = [];

            // Ensure _profitTracker exists for revenue tracking
            if (!bld._profitTracker) bld._profitTracker = { revenue: 0, costs: 0, days: 0 };

            // Clean dead/invalid workers
            for (var wi = bld.workers.length - 1; wi >= 0; wi--) {
                var worker = findPerson(bld.workers[wi]);
                if (!worker || !worker.alive) {
                    bld.workers.splice(wi, 1);
                }
            }

            var currentWorkers = bld.workers.length;
            var bldTown = findTown(bldTownId);
            if (!bldTown) continue;

            // ---- HIRE: fill vacant slots ----
            if (currentWorkers < requiredWorkers) {
                var vacancies = requiredWorkers - currentWorkers;
                // Find unemployed/laborer NPCs in the building's town
                var candidates = [];
                for (var pi = 0; pi < world.people.length; pi++) {
                    var p = world.people[pi];
                    if (!p.alive || p.townId !== bldTownId) continue;
                    if (p.isEliteMerchant || p.id === em.id) continue;
                    if (p.employerId && p.employerId !== em.id) continue;
                    if (p.occupation === 'unemployed' || p.occupation === 'laborer' || p.occupation === 'none' || !p.occupation) {
                        candidates.push(p);
                    }
                }

                // Sort by relevant skill (higher skill = better worker)
                var relevantSkill = bt.skillType || 'crafting';
                candidates.sort(function(a, b) {
                    return ((b.skills && b.skills[relevantSkill]) || 0) - ((a.skills && a.skills[relevantSkill]) || 0);
                });

                var hired = Math.min(vacancies, candidates.length);
                for (var hi = 0; hi < hired; hi++) {
                    var c = candidates[hi];
                    bld.workers.push(c.id);
                    c.employerId = em.id;
                    c.occupation = bt.jobTitle || 'worker';
                    totalHired++;
                }
            }

            // ---- FIRE: unprofitable buildings — reduce staff to cut costs ----
            var relevantSkillFire = bt.skillType || 'crafting';
            if (bld._profitTracker && bld._profitTracker.days >= 30) {
                var isUnprofitable = bld._profitTracker.revenue < bld._profitTracker.costs * 0.4;
                if (isUnprofitable && currentWorkers > 1 && (em.gold || 0) < 100) {
                    // Fire worst worker to cut costs
                    var worstIdx = -1;
                    var worstSkill = Infinity;
                    for (var fwi = 0; fwi < bld.workers.length; fwi++) {
                        var fw = findPerson(bld.workers[fwi]);
                        if (!fw) continue;
                        var fSkill = (fw.skills && fw.skills[relevantSkillFire]) || 0;
                        if (fSkill < worstSkill) {
                            worstSkill = fSkill;
                            worstIdx = fwi;
                        }
                    }
                    if (worstIdx >= 0) {
                        var fired = findPerson(bld.workers[worstIdx]);
                        if (fired) {
                            fired.occupation = 'laborer';
                            fired.employerId = null;
                        }
                        bld.workers.splice(worstIdx, 1);
                        totalFired++;
                    }
                }
            }
        }

        // M-4: Building upgrade AI — upgrade profitable buildings to higher levels
        if (em.buildings && em.buildings.length > 0 && (em.gold || 0) > 200 && rng.chance(0.3)) {
            for (var ugi = 0; ugi < em.buildings.length; ugi++) {
                var ugRef = em.buildings[ugi];
                var ugBt = findBuildingType(ugRef.type);
                if (!ugBt) continue;
                var ugLevel = ugRef.level || 1;
                if (ugLevel >= 5) continue;
                var ugTown = findTown(ugRef.townId);
                if (!ugTown) continue;
                var ugBld = null;
                for (var ugbi = 0; ugbi < ugTown.buildings.length; ugbi++) {
                    if (ugTown.buildings[ugbi].ownerId === em.id && ugTown.buildings[ugbi].type === ugRef.type) {
                        ugBld = ugTown.buildings[ugbi];
                        break;
                    }
                }
                if (!ugBld) continue;
                var ugTracker = ugBld._profitTracker || {};
                var ugAge = world.day - (ugBld.builtDay || 0);
                var ugProfitable = (ugTracker.revenue || 0) > 0 || ugAge > 60;
                if (!ugProfitable) continue;
                var _ugBaseLaborHalf = Math.floor((ugBt.cost || 0) * 0.5);
                var _ugBaseMaterialHalf = 0;
                if (ugBt.materials) {
                    for (var _ugMatId in ugBt.materials) {
                        var _ugQty = ugBt.materials[_ugMatId];
                        var _ugMatPrice = 0;
                        try { _ugMatPrice = getMarketPrice(ugRef.townId, _ugMatId) || 0; } catch(e) { console.warn('[EM] getMarketPrice error:', e.message); }
                        if (_ugMatPrice <= 0) { var _ugRes = findResourceById(_ugMatId); _ugMatPrice = _ugRes ? (_ugRes.basePrice || 5) : 5; }
                        _ugBaseMaterialHalf += Math.floor(_ugQty * _ugMatPrice * 0.5);
                    }
                }
                var upgradeCost = Math.floor((_ugBaseLaborHalf + _ugBaseMaterialHalf) * Math.pow(2, ugLevel - 1));
                if (em.gold < upgradeCost) continue;
                var ugMaxR = 0;
                for (var ugRkId in em.socialRank) { if ((em.socialRank[ugRkId] || 0) > ugMaxR) ugMaxR = em.socialRank[ugRkId]; }
                if (ugMaxR < 2 && ugLevel >= 2) continue;
                em.gold -= upgradeCost;
                ugBld.level = ugLevel + 1;
                ugRef.level = ugLevel + 1;
                ugBld.maxWorkers = (ugBt.maxWorkers || 2) + ugLevel;
                var _ugMsg = em.firstName + ' ' + (em.lastName || '') + ' upgrades ' + ugBt.name + ' to level ' + (ugLevel + 1) + ' in ' + (ugTown.name || 'town') + '.';
                var _ugDet = {
                    type: 'elite_building_upgrade',
                    cause: em.firstName + ' invests in expanding profitable operations.',
                    effects: [ugBt.name + ' upgraded to level ' + (ugLevel + 1), 'Invested ' + upgradeCost + 'g in the upgrade', 'Increased production capacity and worker slots']
                ,
                _noToast: true};
                if (_isPlayerRelevantTown(ugTown.id)) {
                    logEvent(_ugMsg, _ugDet, 'npc_activity');
                } else {
                    logHiddenEvent(_ugMsg, _ugDet, 'npc_activity');
                }
                break;
            }
        }

        // M-4b: Apothecary upgrade priority — upgrade to level 3 to unlock Healing Tonic production
        if (em.buildings && em.buildings.length > 0 && (em.gold || 0) > 150 && rng.chance(0.4)) {
            for (var _api = 0; _api < em.buildings.length; _api++) {
                var _apRef = em.buildings[_api];
                if (_apRef.type !== 'apothecary') continue;
                var _apLvl = _apRef.level || 1;
                if (_apLvl >= 3) continue; // already can make healing tonic
                var _apTown = findTown(_apRef.townId);
                if (!_apTown || !_apTown.market) continue;
                // Check if healing tonic has demand and ingredients are available
                var _htDemand = _apTown.market.demand.healing_tonic || 0;
                var _htSupply = _apTown.market.supply.healing_tonic || 0;
                var _herbsAvail = (_apTown.market.supply.herbs || 0) >= 4;
                var _honeyAvail = (_apTown.market.supply.honey || 0) >= 1;
                if (_htDemand > _htSupply && _herbsAvail && _honeyAvail) {
                    // Find the actual building and upgrade it
                    var _apBld = null;
                    for (var _abi = 0; _abi < _apTown.buildings.length; _abi++) {
                        if (_apTown.buildings[_abi].ownerId === em.id && _apTown.buildings[_abi].type === 'apothecary') {
                            _apBld = _apTown.buildings[_abi]; break;
                        }
                    }
                    if (!_apBld) continue;
                    var _apBt = findBuildingType('apothecary');
                    var _apUpCost = Math.floor(((_apBt.cost || 400) * 0.5) * Math.pow(2, _apLvl - 1));
                    if (em.gold >= _apUpCost) {
                        em.gold -= _apUpCost;
                        _apBld.level = _apLvl + 1;
                        _apRef.level = _apLvl + 1;
                        var _unlockMsg = (_apLvl + 1 >= 3) ? ' 🔓 Can now produce Healing Tonics!' : '';
                        var _apUgMsg = em.firstName + ' ' + (em.lastName || '') + ' upgrades Apothecary to level ' + (_apLvl + 1) + ' in ' + (_apTown.name || 'town') + '.' + _unlockMsg;
                        var _apUgDet = {
                            type: 'elite_building_upgrade',
                            cause: 'High demand for Healing Tonics motivates investment.',
                            effects: ['Apothecary upgraded to level ' + (_apLvl + 1), _unlockMsg || 'Closer to unlocking Healing Tonic production']
                        ,
                        _noToast: true};
                        if (_isPlayerRelevantTown(_apTown.id)) {
                            logEvent(_apUgMsg, _apUgDet, 'npc_activity');
                        } else {
                            logHiddenEvent(_apUgMsg, _apUgDet, 'npc_activity');
                        }
                        break;
                    }
                }
            }
        }

        // Update em.employees count for display
        var empCount = 0;
        for (var eci = 0; eci < allEmBuildings.length; eci++) {
            var ecBld = allEmBuildings[eci].bld;
            empCount += (ecBld.workers ? ecBld.workers.length : 0);
        }
        em.employees = empCount;
    }

    // ── NPC Production Optimization ──
    // NPCs periodically evaluate building products and military quality tiers
    function npcOptimizeProduction() {
        _syncState();
        if (!world || !world.towns) return;
        if (world.day % 14 !== 0) return;
        var rng = world.rng;
        if (!rng) return;

        for (var ti = 0; ti < world.towns.length; ti++) {
            var town = world.towns[ti];
            if (!town.buildings || !town.market) continue;
            var kingdom = findKingdom(town.kingdomId);
            var isAtWar = kingdom && kingdom.atWar && kingdom.atWar.size > 0;

            for (var bi = 0; bi < town.buildings.length; bi++) {
                var bld = town.buildings[bi];
                if (bld.ownerId === 'player') continue;
                var bt = findBuildingType(bld.type);
                if (!bt) continue;

                // Fix 2: NPC product switching for multi-product buildings
                if (bt.availableProducts && Object.keys(bt.availableProducts).length > 1) {
                    var bestProduct = null;
                    var bestMargin = -Infinity;

                    for (var prodKey in bt.availableProducts) {
                        var recipe = bt.availableProducts[prodKey];
                        if (!recipe.produces) continue;
                        // Enforce minLevel requirement for AI buildings
                        if (recipe.minLevel && (bld.level || 1) < recipe.minLevel) continue;
                        var sellPrice = getMarketPrice(town, recipe.produces) || 0;
                        var outputRes = findResourceById(recipe.produces);
                        if (!outputRes) continue;

                        var inputCost = 0;
                        var inputsAvailable = true;
                        if (recipe.consumes) {
                            for (var inputId in recipe.consumes) {
                                var inputPrice = getMarketPrice(town, inputId) || 0;
                                inputCost += inputPrice * (recipe.consumes[inputId] || 1);
                                if ((town.market.supply[inputId] || 0) < (recipe.consumes[inputId] || 1)) {
                                    inputsAvailable = false;
                                }
                            }
                        }

                        var demandBonus = 0;
                        var pDemand = town.market.demand[recipe.produces] || 0;
                        var pSupply = town.market.supply[recipe.produces] || 0;
                        // Opportunity Sensing: strong signal for zero-supply goods with real demand
                        if (pSupply === 0 && pDemand >= 10) demandBonus = 15;
                        else if (pDemand > pSupply * 1.5) demandBonus = 5;
                        else if (pDemand > pSupply) demandBonus = 2;

                        // Wartime boost for military goods and steel
                        if (isAtWar) {
                            var warGoods = ['swords', 'swords_good', 'swords_excellent', 'armor', 'armor_good', 'armor_excellent', 'bows', 'bows_good', 'bows_excellent', 'arrows', 'arrows_good', 'arrows_excellent', 'steel', 'blasting_powder', 'demolition_tools'];
                            if (warGoods.indexOf(recipe.produces) >= 0) demandBonus += 10;
                        }

                        var margin = ((sellPrice * (recipe.rate || 1)) - inputCost) + demandBonus;
                        if (!inputsAvailable) margin *= 0.3;

                        if (margin > bestMargin) {
                            bestMargin = margin;
                            bestProduct = prodKey;
                        }
                    }

                    if (bestProduct && bestProduct !== (bld.currentProduct || bld.productionChoice || '')) {
                        bld.currentProduct = bestProduct;
                        bld.productionChoice = bestProduct;
                    }
                }
                else if (bt.canProduce && bt.canProduce.length > 1) {
                    var bestProd2 = null;
                    var bestPrice2 = -1;
                    for (var cpi = 0; cpi < bt.canProduce.length; cpi++) {
                        var cpId = bt.canProduce[cpi];
                        var cpPrice = getMarketPrice(town, cpId) || 0;
                        var cpDemand = town.market.demand[cpId] || 0;
                        var cpSupply = town.market.supply[cpId] || 0;
                        // Opportunity Sensing: strong boost for zero-supply goods with real demand
                        var cpScore = cpPrice + (cpSupply === 0 && cpDemand >= 10 ? 10 : (cpDemand > cpSupply ? 3 : 0));
                        if (cpScore > bestPrice2) {
                            bestPrice2 = cpScore;
                            bestProd2 = cpId;
                        }
                    }
                    if (bestProd2 && bestProd2 !== bld.currentProduct) {
                        bld.currentProduct = bestProd2;
                    }
                }

                // Fix 3: NPC military quality tier upgrades
                var militaryTypes = ['blacksmith', 'armorer', 'fletcher', 'arrow_maker'];
                if (militaryTypes.indexOf(bld.type) >= 0) {
                    var avgSkill = getAverageWorkerSkill(bld, town);
                    var currentTier = bld.productionTier || 'basic';
                    var newTier = 'basic';

                    if (avgSkill > 60 && isAtWar) {
                        newTier = 'excellent';
                    } else if (avgSkill > 60) {
                        newTier = rng.chance(0.3) ? 'excellent' : 'good';
                    } else if (avgSkill > 40) {
                        newTier = 'good';
                    } else if (avgSkill > 25 && isAtWar) {
                        newTier = 'good';
                    }

                    if (newTier !== currentTier) {
                        bld.productionTier = newTier;
                    }
                }
            }
        }

        // ── Kingdom wartime production directives ──
        // Warring kingdoms ensure at least one smelter produces steel
        // and prioritize military output from blacksmiths/armorers
        if (world.kingdoms) {
            for (var ki = 0; ki < world.kingdoms.length; ki++) {
                var k = world.kingdoms[ki];
                if (!k.atWar || k.atWar.size === 0) continue;

                var kTowns = world.towns.filter(function(t) { return k.territories.has(t.id); });
                var hasSteelProd = false;
                var idleSmelters = [];

                for (var kti = 0; kti < kTowns.length; kti++) {
                    var kt = kTowns[kti];
                    if (!kt.buildings) continue;
                    for (var kbi = 0; kbi < kt.buildings.length; kbi++) {
                        var kb = kt.buildings[kbi];
                        if (kb.ownerId === 'player') continue;
                        if (kb.type === 'smelter') {
                            if (kb.currentProduct === 'steel') {
                                hasSteelProd = true;
                            } else {
                                idleSmelters.push(kb);
                            }
                        }
                    }
                }

                // If no steel production during war, convert one smelter
                if (!hasSteelProd && idleSmelters.length > 0) {
                    // Pick smelter in town with charcoal supply
                    var bestSmelter = null;
                    for (var si = 0; si < idleSmelters.length; si++) {
                        var sTown = kTowns.find(function(t) {
                            return t.buildings && t.buildings.indexOf(idleSmelters[si]) >= 0;
                        });
                        if (sTown && (sTown.market.supply.charcoal || 0) > 0 && (sTown.market.supply.iron || 0) > 0) {
                            bestSmelter = idleSmelters[si];
                            break;
                        }
                    }
                    if (!bestSmelter) bestSmelter = idleSmelters[0];
                    bestSmelter.currentProduct = 'steel';
                    bestSmelter.productionChoice = 'steel';
                }
            }
        }
    }

    // ── NPC-Owned Retail Building Tick ──
    // Processes sales for all NPC-owned retail/service buildings in all towns
    function tickNPCRetailBuildings() {
        _syncState();
        if (!world || !world.towns) return;
        var rng = world.rng;
        if (!rng) return;
        var day = world.day || 0;

        for (var ti = 0; ti < world.towns.length; ti++) {
            var town = world.towns[ti];
            if (!town.buildings) continue;

            // Only towns and above have retail
            if (town.category === 'village') continue;

            var kingdom = findKingdom(town.kingdomId);
            var tariffRate = (kingdom && kingdom.laws && kingdom.laws.tradeTariff) || 0.05;

            for (var bi = 0; bi < town.buildings.length; bi++) {
                var bld = town.buildings[bi];
                if (!bld.ownerId) continue; // skip town-owned
                var bt = findBuildingType(bld.type);
                if (!bt || !bt.retailConfig) continue;

                // Skip player-owned — handled in player.js
                if (typeof Player !== 'undefined' && Player.buildings) {
                    var isPlayerOwned = Player.buildings.some(function(pb) { return pb.id === bld.id; });
                    if (isPlayerOwned) continue;
                }

                // Init retail fields
                bld.retailStock = bld.retailStock || {};
                bld.retailRevenue = bld.retailRevenue || 0;

                // NPC owners auto-stock from market when low
                var stockTotal = 0;
                for (var sk in bld.retailStock) stockTotal += (bld.retailStock[sk] || 0);
                var maxStock = (bt.retailConfig.maxStock || 50) * (bld.level || 1);

                if (stockTotal < maxStock * 0.3) {
                    // Auto-restock: buy from market
                    var goods = bt.retailConfig.acceptsGoods || [];
                    for (var gi = 0; gi < goods.length && stockTotal < maxStock * 0.7; gi++) {
                        var gid = goods[gi];
                        var avail = town.market.supply[gid] || 0;
                        var toBuy = Math.min(avail, Math.floor((maxStock - stockTotal) / goods.length));
                        if (toBuy > 0) {
                            town.market.supply[gid] -= toBuy;
                            bld.retailStock[gid] = (bld.retailStock[gid] || 0) + toBuy;
                            stockTotal += toBuy;
                        }
                    }
                }

                // Process sales (simplified version of player retail tick)
                var maxCust = Math.floor((bt.retailConfig.maxCustomersPerDay || 5) * (bld.level || 1) * Math.min(2.0, (town.population || 50) / 100));
                if (maxCust < 1) maxCust = 1;
                var markup = bt.retailConfig.baseMarkup || 1.3;

                // EM Employee delegation: better employees boost sales
                if (bld._employees && bld._employees.length > 0) {
                    var avgSkill = 0;
                    var liveCount = 0;
                    for (var ei = bld._employees.length - 1; ei >= 0; ei--) {
                        var emp = findPerson(bld._employees[ei].id);
                        if (!emp || !emp.alive) { bld._employees.splice(ei, 1); continue; }
                        avgSkill += (bld._employees[ei].skill || 20);
                        liveCount++;
                    }
                    if (liveCount > 0) {
                        avgSkill /= liveCount;
                        var empBonus = 1.0 + (avgSkill / 100) * 0.3; // up to +30% customers
                        maxCust = Math.floor(maxCust * empBonus);
                    }
                }

                // Reputation modifier on customers
                if (bld._reputation != null) {
                    var repMod = 0.7 + (bld._reputation / 100) * 0.6;
                    maxCust = Math.floor(maxCust * repMod);
                }

                // Competition: count same-type retail buildings in town
                var competitorCount = 0;
                for (var cci = 0; cci < town.buildings.length; cci++) {
                    if (town.buildings[cci].type === bld.type && cci !== bi && town.buildings[cci].ownerId) competitorCount++;
                }
                var baseVisitChance = 0.4;
                if (competitorCount === 0) {
                    // Monopoly bonus
                    baseVisitChance = 0.6;
                    if (markup < 2.0) markup = Math.min(bt.retailConfig.maxMarkup || 2.5, markup * 1.15); // can charge more
                } else {
                    // Split customers based on competition
                    baseVisitChance = Math.max(0.15, 0.4 / (1 + competitorCount * 0.4));
                    // Price competition: shops with lower markup steal customers
                    if (bld._retailMarkup && bld._retailMarkup < markup) baseVisitChance += 0.05;
                }

                for (var ci = 0; ci < maxCust; ci++) {
                    if (!rng.chance(baseVisitChance)) continue;

                    if (bt.retailConfig.serviceFee) {
                        var canServe = true;
                        var svcCost = bt.retailConfig.consumesPerService || {};
                        for (var sr in svcCost) {
                            if ((bld.retailStock[sr] || 0) < svcCost[sr]) { canServe = false; break; }
                        }
                        if (!canServe) continue;
                        for (var sr2 in svcCost) {
                            bld.retailStock[sr2] -= svcCost[sr2];
                            if (bld.retailStock[sr2] <= 0) delete bld.retailStock[sr2];
                        }
                        var fee = bt.retailConfig.serviceFee * (bld.level || 1);
                        var tax = Math.floor(fee * tariffRate);
                        if (kingdom) kingdom.gold = (kingdom.gold || 0) + tax;
                        bld.retailRevenue += (fee - tax);
                        continue;
                    }

                    var sKeys = Object.keys(bld.retailStock).filter(function(k) { return bld.retailStock[k] > 0; });
                    if (sKeys.length === 0) break;

                    var itemId = sKeys[Math.floor(rng.random() * sKeys.length)];
                    var mktPrice = town.market.prices[itemId] || 5;
                    var mktSupply = town.market.supply[itemId] || 0;

                    // NPC decision: market or this shop?
                    if (mktSupply > 10 && rng.chance(0.6)) continue; // market has stock, skip shop

                    var salePrice = Math.round(mktPrice * markup);
                    bld.retailStock[itemId]--;
                    if (bld.retailStock[itemId] <= 0) delete bld.retailStock[itemId];
                    var saleTax = Math.floor(salePrice * tariffRate);
                    if (kingdom) kingdom.gold = (kingdom.gold || 0) + saleTax;
                    bld.retailRevenue += (salePrice - saleTax);
                }

                // Owner collects revenue periodically
                if (bld.retailRevenue > 0) {
                    var owner = findPerson(bld.ownerId);
                    if (owner && owner.alive) {
                        // Pay employee wages first
                        if (bld._employees && bld._employees.length > 0) {
                            var totalWages = 0;
                            for (var wi = 0; wi < bld._employees.length; wi++) {
                                totalWages += (bld._employees[wi].wage || 5);
                            }
                            var netRevenue = Math.max(0, bld.retailRevenue - totalWages);
                            // Pay wages from owner's pocket if revenue doesn't cover
                            if (bld.retailRevenue < totalWages) {
                                var deficit = totalWages - bld.retailRevenue;
                                owner.gold = Math.max(0, (owner.gold || 0) - deficit);
                            }
                            owner.gold = (owner.gold || 0) + netRevenue;
                        } else {
                            owner.gold = (owner.gold || 0) + bld.retailRevenue;
                        }
                        bld.retailRevenue = 0;
                    }
                }

                // EM Employee hiring/management (every 14 days)
                if (day % 14 === 0 && bld.ownerId) {
                    var emOwner = findPerson(bld.ownerId);
                    if (emOwner && emOwner.alive && emOwner.isEliteMerchant) {
                        if (!bld._employees) bld._employees = [];
                        var neededEmp = Math.min(3, Math.max(1, (bld.level || 1)));
                        // Hire if short-staffed
                        if (bld._employees.length < neededEmp && (emOwner.gold || 0) > 100) {
                            var townPeople = world.people.filter(function(np) {
                                return np.alive && np.townId === town.id && np.age >= 16 && np.age <= 55 &&
                                    !np.isEliteMerchant && !np.isKing && !np.isNoble &&
                                    (!np.occupation || np.occupation === 'laborer' || np.occupation === 'none');
                            });
                            if (townPeople.length > 0) {
                                // Pick best by social/intelligence
                                townPeople.sort(function(a, b) {
                                    var aS = ((a.personality && a.personality.social) || 30) + ((a.personality && a.personality.intelligence) || 30);
                                    var bS = ((b.personality && b.personality.social) || 30) + ((b.personality && b.personality.intelligence) || 30);
                                    return bS - aS;
                                });
                                var hire = townPeople[0];
                                var wage = 3 + Math.floor(((hire.personality && hire.personality.social) || 30) * 0.08);
                                bld._employees.push({
                                    id: hire.id,
                                    name: ((hire.firstName || '') + ' ' + (hire.lastName || '')).trim(),
                                    skill: ((hire.personality && hire.personality.social) || 30),
                                    wage: wage,
                                    hireDay: day
                                });
                            }
                        }
                        // Fire underperformers (10% chance to evaluate)
                        if (bld._employees.length > 1 && rng.chance(0.1)) {
                            var worstIdx = 0;
                            var worstSkill = 999;
                            for (var fei = 0; fei < bld._employees.length; fei++) {
                                if ((bld._employees[fei].skill || 0) < worstSkill) {
                                    worstSkill = bld._employees[fei].skill || 0;
                                    worstIdx = fei;
                                }
                            }
                            if (worstSkill < 25) bld._employees.splice(worstIdx, 1);
                        }
                        // Employee skill growth
                        for (var egi = 0; egi < bld._employees.length; egi++) {
                            if ((bld._employees[egi].skill || 0) < 80) {
                                bld._employees[egi].skill = (bld._employees[egi].skill || 20) + 0.1;
                            }
                        }
                    }
                }

                // Building reputation growth for NPC buildings
                if (day % 5 === 0 && bld._reputation == null) bld._reputation = 30;
                if (bld._reputation != null) {
                    var _sTotal = 0;
                    for (var _rk in bld.retailStock) _sTotal += (bld.retailStock[_rk] || 0);
                    if (_sTotal > maxStock * 0.3) bld._reputation = Math.min(100, bld._reputation + 0.1);
                    else bld._reputation = Math.max(0, bld._reputation - 0.2);
                    if (bld._employees && bld._employees.length > 0) bld._reputation = Math.min(100, bld._reputation + 0.05);
                }
            }
        }
    }

    function eliteSocialAI(em, town, rng, personality) {
        // Marriage already handled in tickPeople — this handles relationship building
        if (personality.social > 50 || em.strategy === 'political_climber') {
            // Build relationships with nobles and other elite merchants in town
            var targets = world.people.filter(function(c) {
                return c.alive && c.townId === em.townId && c.id !== em.id &&
                    (c.occupation === 'noble' || c.isEliteMerchant) &&
                    c.age >= 16;
            });
            for (var ti = 0; ti < Math.min(targets.length, 2); ti++) {
                var target = targets[ti];
                var gain = Math.floor(personality.social * 0.1 + rng.random() * 5);
                if (_bridgeNPCRelationship(em, target.id, gain, 'elite_social_ai')) continue;
                if (!em.relationships[target.id] || typeof em.relationships[target.id] === 'number') {
                    em.relationships[target.id] = { level: em.relationships[target.id] || 10, type: 'acquaintance' };
                }
                em.relationships[target.id].level = Math.min(100, em.relationships[target.id].level + gain);
                em.relationships[target.id].type = _legacyRelationshipType(em.relationships[target.id].level);
            }
        }

        // Choose heir from children
        if (em.childrenIds && em.childrenIds.length > 0) {
            var bestHeir = null;
            var bestHeirScore = -1;
            for (var hi = 0; hi < em.childrenIds.length; hi++) {
                var child = findPerson(em.childrenIds[hi]);
                if (!child || !child.alive || child.age < 14) continue;
                var hScore = (child.age || 0) + (child.skills ? (child.skills.trading || 0) : 0) * 0.5;
                if (hScore > bestHeirScore) { bestHeirScore = hScore; bestHeir = child; }
            }
            if (bestHeir) em.heirId = bestHeir.id;
        }
    }

    function eliteRankAI(em, rng) {
        var kId = em.citizenshipKingdomId || em.kingdomId;
        if (!kId) return;
        var currentRank = (em.socialRank[kId] || 0);
        if (currentRank >= 6) return; // Royal Advisor is max
        var nextRank = CONFIG.SOCIAL_RANKS[currentRank + 1];
        if (!nextRank) return;

        // Basic requirements: gold earned, reputation, fee
        var goldEarned = em.goldEarnedInKingdom ? (em.goldEarnedInKingdom[kId] || 0) : (em.gold || 0);
        if (goldEarned < (nextRank.goldReq || 0)) return;
        if ((em.reputation[kId] || 0) < (nextRank.repReq || 0)) return;
        var fee = nextRank.fee || 0;
        if (em.gold < fee * 1.5) return; // EMs keep a buffer

        // Rank-specific requirements (mirrors player canPetitionForPromotion)
        if (nextRank.id === 'citizen') {
            var tradingStart = em.tradingStartDay || 0;
            if (world.day - tradingStart < 90) return;
        }
        if (nextRank.id === 'burgher') {
            var emBldCountBurgher = (em.buildings || []).filter(function(b) {
                var t = findTown(b.townId); return t && t.kingdomId === kId;
            }).length;
            if (emBldCountBurgher < 1) return;
            if (world.day - (em.tradingStartDay || world.day) < 90) return;
        }
        if (nextRank.id === 'guildmaster') {
            var emProdBlds = (em.buildings || []).filter(function(b) {
                var bt = findBuildingType(b.type);
                var t = findTown(b.townId);
                return bt && (bt.category === 'processing' || bt.category === 'finished') && t && t.kingdomId === kId;
            }).length;
            if (emProdBlds < 3) return;
            var emWorkerCount = em.employees ? em.employees.length : 0;
            if (emWorkerCount < 8) return;
            var emTownsWithBlds = new Set((em.buildings || []).filter(function(b) {
                var t = findTown(b.townId); return t && t.kingdomId === kId;
            }).map(function(b) { return b.townId; })).size;
            if (emTownsWithBlds < 2) return;
        }
        if (nextRank.id === 'minor_noble') {
            // Need 5 noble endorsements (friends with rank >= 4, rel >= 60)
            var emEndorsements = 0;
            if (em.relationships) {
                for (var epid in em.relationships) {
                    if (em.relationships[epid].level >= 60) {
                        var endorser = findPerson(epid);
                        if (endorser && endorser.alive) {
                            var eRank = (endorser.socialRank && endorser.socialRank[kId]) ? endorser.socialRank[kId] : (endorser.occupation === 'noble' ? 4 : 0);
                            if (eRank >= 4) emEndorsements++;
                        }
                    }
                }
            }
            if (emEndorsements < 5) return;
            var emTownsWithPropMN = new Set((em.buildings || []).filter(function(b) {
                var t = findTown(b.townId); return t && t.kingdomId === kId;
            }).map(function(b) { return b.townId; })).size;
            if (emTownsWithPropMN < 3) return;
        }
        if (nextRank.id === 'lord') {
            var emTownsLord = new Set((em.buildings || []).filter(function(b) {
                var t = findTown(b.townId); return t && t.kingdomId === kId;
            }).map(function(b) { return b.townId; })).size;
            if (emTownsLord < 4) return;
            var emTotalWorkers = em.employees ? em.employees.length : 0;
            if (emTotalWorkers < 40) return;
            var emInfra = (em.roadsBuilt || 0) + (em.bridgesBuilt || 0) + (em.seaRoutesBuilt || 0);
            if (emInfra < 2) return;
            var emRankSince = em.rankSince ? (em.rankSince[kId] || world.day) : world.day;
            if ((world.day - emRankSince) / CONFIG.DAYS_PER_SEASON < 2) return;
        }
        if (nextRank.id === 'royal_advisor') {
            var emRankSinceRA = em.rankSince ? (em.rankSince[kId] || world.day) : world.day;
            if ((world.day - emRankSinceRA) / CONFIG.DAYS_PER_SEASON < 3) return;
            if (!em.hasSuppliedMilitary) return;
            var emNobleFriends = 0;
            if (em.relationships) {
                for (var enf in em.relationships) {
                    if (em.relationships[enf].level >= 80) {
                        var nfPerson = findPerson(enf);
                        if (nfPerson && nfPerson.alive && (nfPerson.occupation === 'noble' || nfPerson.wealthClass === 'upper')) {
                            emNobleFriends++;
                        }
                    }
                }
            }
            if (emNobleFriends < 3) return;
        }

        // Pay fee and advance
        em.gold -= fee;
        em.socialRank[kId] = currentRank + 1;
        if (!em.rankSince) em.rankSince = {};
        em.rankSince[kId] = world.day;
        logEvent(em.firstName + ' ' + (em.lastName || '') + ' has been elevated to ' + nextRank.name + '!', { kingdomId: kId, _noToast: true }, (typeof Player !== 'undefined' && Player.citizenshipKingdomId === kId ? 'my_kingdom' : 'foreign_kingdoms'));
        grantEmXp(em, 50, 'rank_up');

        // Becoming a Minor Noble makes an elite merchant a noble
        if (currentRank + 1 >= 4 && em.occupation !== 'noble') {
            em.occupation = 'noble';
            em.wealthClass = 'upper';
            logEvent('🏰 ' + em.firstName + ' ' + (em.lastName || '') + ' has entered the aristocracy!', { kingdomId: kId, _noToast: true }, (typeof Player !== 'undefined' && Player.citizenshipKingdomId === kId ? 'my_kingdom' : 'foreign_kingdoms'));
            // Kingdom grants 4 personal guards
            if (!em.guards) em.guards = [];
            var guardsToAdd = Math.min(4, 4 - em.guards.length);
            for (var egi = 0; egi < guardsToAdd; egi++) {
                em.guards.push({
                    id: 'emguard_' + em.id + '_' + egi,
                    name: 'Royal Guard ' + (egi + 1),
                    hiredDay: world.day,
                    kingdomPaid: true
                });
            }
            logEvent('🛡️ ' + em.firstName + ' ' + (em.lastName || '') + ' has been granted ' + guardsToAdd + ' guards by the kingdom.', { kingdomId: kId, _noToast: true }, (typeof Player !== 'undefined' && Player.citizenshipKingdomId === kId ? 'my_kingdom' : 'foreign_kingdoms'));
        }
    }

    function eliteSkillAI(em, rng) {
        if ((em.emSkillPoints || 0) <= 0) return;

        var personality = em.personality || {};
        var strategy = em.strategy || 'diversified';

        // Build prioritized skill wish list based on strategy + personality
        var skillScores = {};

        // Strategy-driven preferences
        if (strategy === 'food_monopoly' || strategy === 'land_baron') {
            skillScores.efficient_builder = 15; skillScores.master_builder = 12;
            skillScores.foreman = 15; skillScores.master_foreman = 12;
            skillScores.supply_chain_expert = 20; skillScores.property_magnate = 18;
        }
        if (strategy === 'military_supplier' || strategy === 'war_profiteer') {
            skillScores.war_profiteer = 20; skillScores.siege_supplier = 15;
            skillScores.combat_trained = 10; skillScores.fortified_caravans = 12;
        }
        if (strategy === 'luxury_trader' || strategy === 'trade_network') {
            skillScores.trade_network = 20; skillScores.global_trade_intel = 15;
            skillScores.road_knowledge = 12; skillScores.caravan_master = 12;
            skillScores.expert_navigator = 10; skillScores.fleet_admiral = 10;
        }
        if (strategy === 'political_climber') {
            skillScores.court_etiquette = 20; skillScores.economic_advisor = 15;
            skillScores.political_connections = 18; skillScores.royal_favor = 12;
            skillScores.charming = 10; skillScores.charismatic = 10;
        }

        // Personality-driven preferences (additive)
        if (personality.greed > 60) {
            skillScores.haggler = (skillScores.haggler || 0) + 10;
            skillScores.master_haggler = (skillScores.master_haggler || 0) + 8;
            skillScores.golden_tongue = (skillScores.golden_tongue || 0) + 8;
        }
        if (personality.social > 60) {
            skillScores.charming = (skillScores.charming || 0) + 8;
            skillScores.smooth_talker = (skillScores.smooth_talker || 0) + 6;
        }
        if (personality.ambition > 60) {
            skillScores.market_scout = (skillScores.market_scout || 0) + 10;
            skillScores.trade_network = (skillScores.trade_network || 0) + 10;
            skillScores.property_magnate = (skillScores.property_magnate || 0) + 8;
        }
        if (personality.honesty < 35) {
            skillScores.discrete = (skillScores.discrete || 0) + 12;
            skillScores.master_smuggler = (skillScores.master_smuggler || 0) + 10;
            skillScores.bribe_expert = (skillScores.bribe_expert || 0) + 10;
        }
        if (personality.patience > 60) {
            skillScores.efficient_logistics = (skillScores.efficient_logistics || 0) + 8;
            skillScores.supply_chain_expert = (skillScores.supply_chain_expert || 0) + 8;
        }
        if (personality.militarism > 50) {
            skillScores.combat_trained = (skillScores.combat_trained || 0) + 8;
            skillScores.street_smart = (skillScores.street_smart || 0) + 6;
        }
        if (personality.risk_tolerance > 60) {
            skillScores.black_market_contacts = (skillScores.black_market_contacts || 0) + 6;
        }

        // Universal useful skills everyone values somewhat
        skillScores.keen_eye = (skillScores.keen_eye || 0) + 5;
        skillScores.market_scout = (skillScores.market_scout || 0) + 5;
        skillScores.silver_tongue = (skillScores.silver_tongue || 0) + 5;
        skillScores.haggler = (skillScores.haggler || 0) + 5;
        skillScores.road_knowledge = (skillScores.road_knowledge || 0) + 3;
        skillScores.endurance_1 = (skillScores.endurance_1 || 0) + 3;
        skillScores.street_smart = (skillScores.street_smart || 0) + 3;
        skillScores.first_aid = (skillScores.first_aid || 0) + 2;

        // Find the best learnable skill
        var bestSkill = null;
        var bestScore = -1;

        for (var sid in skillScores) {
            if (em.emSkills[sid]) continue;
            var sDef = SKILLS[sid];
            if (!sDef) continue;
            if ((sDef.cost || 0) > (em.emSkillPoints || 0)) continue;

            var prereqOk = true;
            if (sDef.requires) {
                for (var pri2 = 0; pri2 < sDef.requires.length; pri2++) {
                    if (!em.emSkills[sDef.requires[pri2]]) { prereqOk = false; break; }
                }
            }
            if (!prereqOk) continue;

            var score = skillScores[sid] + rng.random() * 5;
            if (score > bestScore) {
                bestScore = score;
                bestSkill = sid;
            }
        }

        if (bestSkill) {
            var bDef = SKILLS[bestSkill];
            em.emSkillPoints -= (bDef.cost || 0);
            em.emSkills[bestSkill] = true;
            logEvent(em.name + ' learned skill: ' + (bDef.name || bestSkill),  {
                type: 'elite_skill_learned',
                townId: em.townId,
                cause: em.name + ' invested time in learning ' + (bDef.name || bestSkill) + '.',
                effects: [em.name + ' now has ' + Object.keys(em.emSkills).length + ' skills']
            ,
            _noToast: true}, 'npc_activity');
        }
    }

    // v9p33river196: shared detection-chance calculator for EMs/NPCs.
    // Mirrors player calculateCorruptDetection: town security + actor
    // notoriety + skills + crime base.
    function _calcActorDetection(actor, town, baseDetection) {
        var detection = baseDetection;
        detection += ((town && town.security) || 50) * 0.005;
        var hour = world ? (world.hour || 12) : 12;
        if (hour >= 20 || hour <= 5) detection *= 0.7; // night cover
        // EM skill reductions
        if (actor.skills) {
            if (emHasSkill(actor, 'discrete')) detection *= 0.85;
            if (emHasSkill(actor, 'master_smuggler')) detection *= 0.65;
            if (emHasSkill(actor, 'shadow_dealings')) detection *= 0.85;
            if (emHasSkill(actor, 'ghost')) detection *= 0.55;
        }
        // Notoriety raises detection (uses crimesCommitted as proxy)
        var notor = actor.notoriety != null ? actor.notoriety : Math.min(80, (actor.crimesCommitted || 0) * 4);
        if (notor >= 80) detection *= 1.5;
        else if (notor >= 50) detection *= 1.3;
        else if (notor >= 25) detection *= 1.15;
        detection += notor * 0.002;
        // Personality: honest people aren't smooth criminals
        if (actor.personality && actor.personality.honesty != null) {
            if (actor.personality.honesty > 60) detection *= 1.20;
        }
        return Math.max(0.02, Math.min(0.95, detection));
    }

    // v9p33river196: apply player-style penalty to an EM/NPC actor — uses
    // CONFIG.CRIME_TYPES to resolve real fines/jail per kingdom law. Mirrors
    // Player.applyCorruptPenalty.
    function _applyActorCrimePenalty(actor, town, kingdom, crimeId, fineMult) {
        if (!actor || !kingdom) return 0;
        var crimeType = (CONFIG.CRIME_TYPES || []).find(function(c) { return c.id === crimeId; });
        if (!crimeType) return 0;
        var fine = crimeType.defaultFine || 100;
        var jailDays = crimeType.defaultJailDays || 0;
        var ptype = crimeType.defaultPunishment || 'fine';
        // Kingdom-level overrides
        if (kingdom.crimePunishments && kingdom.crimePunishments[crimeId]) {
            var ov = kingdom.crimePunishments[crimeId];
            if (ov.fine) fine = ov.fine;
            if (ov.jailDays) jailDays = ov.jailDays;
            if (ov.type) ptype = ov.type;
        }
        if (fineMult) fine = Math.round(fine * fineMult);
        // Apply
        actor.gold = Math.max(0, (actor.gold || 0) - fine);
        if (!actor.criminalRecord) actor.criminalRecord = {};
        actor.criminalRecord[kingdom.id] = (actor.criminalRecord[kingdom.id] || 0) + 1;
        actor.notoriety = Math.min(100, (actor.notoriety || 0) + 5);
        if (actor.reputation) actor.reputation[kingdom.id] = Math.max(0, (actor.reputation[kingdom.id] || 50) - 8);
        // v9p33river205: NPC noble council trial deferral
        // If the actor is a noble in this kingdom and the kingdom uses the
        // Noble Council law, defer execution to a trial. The trial system will
        // call _applyTrialVerdict on the actor when resolved.
        var _actorRank = (actor.socialRank && actor.socialRank[kingdom.id]) || 0;
        var _isNoble = _actorRank >= 4 || actor.isNoble;
        if (ptype === 'execution' && _isNoble && Engine.scheduleNobleTrial && Engine.hasSpecialLaw && Engine.hasSpecialLaw(kingdom, 'noble_council')) {
            var _emTrial = Engine.scheduleNobleTrial({
                kingdomId: kingdom.id,
                accusedNpcId: actor.id,
                crimeId: crimeId,
                originalPunishment: { execution: true, exile: true, jailDays: jailDays || 360, fine: fine, town: town }
            });
            if (_emTrial) {
                logEvent('⚖️ ' + (actor.firstName || 'A merchant') + ' ' + (actor.lastName || '') + ' faces a Noble Council trial in ' + kingdom.name + ' for ' + crimeType.name + '.',  {
                    type: 'npc_noble_trial', cause: 'Noble Council law deferred execution to trial.', townId: town && town.id, kingdomId: kingdom.id
                ,
                _noToast: true}, (typeof Player !== 'undefined' && Player.citizenshipKingdomId === kingdom.id ? 'my_kingdom' : 'foreign_kingdoms'));
                return fine;
            }
        }
        // Execution / heavy jail: kill the actor for severe crimes
        if (ptype === 'execution') {
            actor.alive = false;
            actor.deathCause = 'executed for ' + crimeType.name;
            logEvent('☠️ ' + (actor.firstName || 'A merchant') + ' ' + (actor.lastName || '') + ' was executed in ' + (town ? town.name : 'a town') + ' for ' + crimeType.name + '.',  {
                type: 'npc_executed', cause: crimeType.name + ' (capital crime).', townId: town && town.id, kingdomId: kingdom.id
            ,
            _noToast: true}, (typeof Player !== 'undefined' && Player.citizenshipKingdomId === kingdom.id ? 'my_kingdom' : 'foreign_kingdoms'));
        } else if (jailDays > 0) {
            actor._jailedUntilDay = (world.day || 0) + jailDays;
            actor._jailedCrimeId = crimeId || null; // v9p33river264
        }
        return fine;
    }

    // v9p33river196: EM-on-EM sabotage. Pick a rival EM in same town and
    // disable one of their buildings for N days. Strategic — favors targets
    // with high competitor overlap (same product) or higher gold than the
    // attacker's. Uses sabotage crime category.
    function _eliteSabotageRival(em, town, rng, personality) {
        if (!town || !world) return false;
        var rivals = world.people.filter(function(p) {
            return p.alive && p.isEliteMerchant && p.id !== em.id && p.townId === town.id && (p.buildings || []).length > 0;
        });
        if (rivals.length === 0) return false;
        // Score rivals: prefer richer + same-product producers
        var emProducts = {};
        for (var b = 0; b < (em.buildings || []).length; b++) {
            var bt0 = findBuildingType(em.buildings[b].type);
            if (bt0 && bt0.produces) emProducts[bt0.produces] = true;
        }
        var bestRival = null, bestScore = -Infinity;
        for (var ri = 0; ri < rivals.length; ri++) {
            var rv = rivals[ri];
            var sc = (rv.gold || 0) * 0.001;
            for (var rb = 0; rb < rv.buildings.length; rb++) {
                var bt = findBuildingType(rv.buildings[rb].type);
                if (bt && bt.produces && emProducts[bt.produces]) sc += 5;
            }
            // Don't sabotage your own kingdom's allies as readily — risk-tolerance gates
            if (rv.kingdomId !== em.kingdomId && (personality.risk_tolerance || 50) > 60) sc += 3;
            if (sc > bestScore) { bestScore = sc; bestRival = rv; }
        }
        if (!bestRival || bestScore <= 0) return false;
        var targetBldEntry = bestRival.buildings[Math.floor(rng.random() * bestRival.buildings.length)];
        if (!targetBldEntry) return false;
        // Find the actual town building (rival.buildings is owned-list with townId+type)
        var tt = findTown(targetBldEntry.townId || town.id);
        if (!tt || !tt.buildings) return false;
        var realBld = tt.buildings.find(function(b) { return b.ownerId === bestRival.id && b.type === targetBldEntry.type && !b._disabledUntil; });
        if (!realBld) return false;

        var detection = _calcActorDetection(em, town, 0.30);
        var caught = rng.chance(detection);
        em.crimesCommitted = (em.crimesCommitted || 0) + 1;
        var kingdom = findKingdom(town.kingdomId);

        if (caught) {
            var fine = _applyActorCrimePenalty(em, town, kingdom, 'sabotage', 1.0);
            logEvent('⚖️ ' + em.firstName + ' ' + (em.lastName || '') + ' caught sabotaging ' + bestRival.firstName + '\'s ' + (findBuildingType(realBld.type) || {name:realBld.type}).name + ' in ' + town.name + '! Fined ' + fine + 'g.',  {
                type: 'em_crime_sabotage_caught', cause: 'EM-vs-EM sabotage attempt failed.',
                effects: [fine + 'g fine', 'Notoriety +5', 'Reputation damaged'], townId: town.id, kingdomId: kingdom && kingdom.id
            ,
            _noToast: true}, 'npc_activity');
            return true;
        }
        // Success — disable target building 10–25 days
        var disableDays = 10 + Math.floor(rng.random() * 16);
        realBld._disabledUntil = (world.day || 0) + disableDays;
        logEvent('💣 ' + bestRival.firstName + ' ' + (bestRival.lastName || '') + '\'s ' + (findBuildingType(realBld.type) || {name:realBld.type}).name + ' in ' + town.name + ' was sabotaged by an unknown rival! Disabled ' + disableDays + ' days.',  {
            type: 'em_crime_sabotage_success', townId: town.id, kingdomId: kingdom && kingdom.id,
            cause: 'Rival merchant sabotage (perpetrator unknown to authorities).'
        ,
        _noToast: true}, 'npc_activity');
        return true;
    }

    // v9p33river196: EM-on-EM theft. Steal gold from a rival EM in same town.
    // Smaller stakes than sabotage; classified as 'theft'.
    function _eliteStealFromRival(em, town, rng, personality) {
        if (!town || !world) return false;
        var rivals = world.people.filter(function(p) {
            return p.alive && p.isEliteMerchant && p.id !== em.id && p.townId === town.id && (p.gold || 0) > 200;
        });
        if (rivals.length === 0) return false;
        // Pick the richest rival the attacker is willing to risk
        rivals.sort(function(a, b) { return (b.gold || 0) - (a.gold || 0); });
        var target = rivals[0];

        var detection = _calcActorDetection(em, town, 0.20);
        var caught = rng.chance(detection);
        em.crimesCommitted = (em.crimesCommitted || 0) + 1;
        var kingdom = findKingdom(town.kingdomId);
        var stolen = Math.min(target.gold, 50 + Math.floor(rng.random() * Math.min(500, target.gold * 0.05)));

        if (caught) {
            var fine = _applyActorCrimePenalty(em, town, kingdom, 'theft', 1.0);
            logEvent('⚖️ ' + em.firstName + ' ' + (em.lastName || '') + ' caught attempting to rob ' + target.firstName + ' in ' + town.name + '! Fined ' + fine + 'g.',  {
                type: 'em_crime_theft_caught', cause: 'EM-vs-EM theft attempt failed.',
                effects: [fine + 'g fine', 'Notoriety +5'], townId: town.id, kingdomId: kingdom && kingdom.id
            ,
            _noToast: true}, 'npc_activity');
            return true;
        }
        target.gold -= stolen;
        em.gold = (em.gold || 0) + stolen;
        logEvent('💰 ' + target.firstName + ' ' + (target.lastName || '') + ' was robbed of ' + stolen + 'g in ' + town.name + ' (perpetrator unknown).',  {
            type: 'em_crime_theft_success', townId: town.id, kingdomId: kingdom && kingdom.id,
            cause: 'Robbery in the merchant district.'
        ,
        _noToast: true}, 'npc_activity');
        return true;
    }

    function eliteCrimeAI(em, town, rng, personality) {

        // ── v9p33river197 — extended EM scheme palette (player-parity) ──

        function _spreadRumorsScheme(em, town, rng, personality) {
            // Skill: silver_tongue_dark required (player parity)
            if (!emHasSkill(em, 'silver_tongue_dark')) return false;
            var rivals = world.people.filter(function(p) { return p.alive && p.isEliteMerchant && p.id !== em.id && p.townId === town.id; });
            // v9p33river356: if this EM is hostile/rival toward the player AND
            // the player is in the same town, the player joins the rivals
            // pool — hostile EMs may now spread rumors against you.
            try {
                if (typeof Player !== 'undefined' && Player.state && Player.state.townId === town.id && Engine.isPlayerRival && Engine.isPlayerRival(em)) {
                    rivals.push({ id: 'player', firstName: Player.state.firstName || 'the player', lastName: Player.state.lastName || '', reputation: Player.state.reputation, _isPlayer: true });
                }
            } catch (e) {}
            if (rivals.length === 0) return false;
            var target = rivals[Math.floor(rng.random() * rivals.length)];
            var detection = _calcActorDetection(em, town, 0.10);
            em.crimesCommitted = (em.crimesCommitted || 0) + 1;
            var kingdom = findKingdom(town.kingdomId);
            if (rng.chance(detection)) {
                var fine = _applyActorCrimePenalty(em, town, kingdom, 'forgery', 0.4);
                logEvent('⚖️ ' + em.firstName + ' caught spreading malicious rumors about ' + target.firstName + ' in ' + town.name + ' — fined ' + fine + 'g.',  { type: 'em_scheme_rumors_caught', townId: town.id , _noToast: true}, 'npc_activity');
            } else {
                var repLoss = 4 + Math.floor(rng.random() * 5);
                if (target._isPlayer) {
                    // Hit player kingdom reputation
                    try {
                        if (Player.state.reputation && kingdom) {
                            Player.state.reputation[kingdom.id] = Math.max(0, (Player.state.reputation[kingdom.id] || 50) - repLoss);
                        }
                    } catch (e) {}
                    // Record a memory on the EM so the player can reference it back.
                    try { Engine.recordPlayerSchemeAgainst && Engine.recordPlayerSchemeAgainst(em, 'spread_rumors'); } catch (e) {}
                    logEvent('🤫 Whispers spread by ' + em.firstName + ' damage your reputation in ' + town.name + ' (-' + repLoss + ').',  { type: 'em_scheme_rumors_vs_player', townId: town.id , _noToast: true}, 'npc_activity');
                } else if (target.reputation && kingdom) {
                    target.reputation[kingdom.id] = Math.max(0, (target.reputation[kingdom.id] || 50) - repLoss);
                    logEvent('🤫 Whispers about ' + target.firstName + ' ' + (target.lastName || '') + ' damage their reputation in ' + town.name + ' (-' + repLoss + ').',  { type: 'em_scheme_rumors_success', townId: town.id , _noToast: true}, 'npc_activity');
                }
            }
            return true;
        }

        function _frameCompetitorScheme(em, town, rng, personality) {
            // Skill: master_forger required (player parity)
            if (!emHasSkill(em, 'master_forger')) return false;
            var rivals = world.people.filter(function(p) { return p.alive && p.isEliteMerchant && p.id !== em.id && p.townId === town.id; });
            if (rivals.length === 0) return false;
            // Target the richest rival
            rivals.sort(function(a, b) { return (b.gold || 0) - (a.gold || 0); });
            var target = rivals[0];
            var detection = _calcActorDetection(em, town, 0.25);
            em.crimesCommitted = (em.crimesCommitted || 0) + 1;
            var kingdom = findKingdom(town.kingdomId);
            if (rng.chance(detection)) {
                var fine = _applyActorCrimePenalty(em, town, kingdom, 'forgery', 1.5);
                logEvent('⚖️ ' + em.firstName + ' caught framing ' + target.firstName + ' for a crime in ' + town.name + ' — fined ' + fine + 'g.',  { type: 'em_scheme_frame_caught', townId: town.id , _noToast: true}, 'npc_activity');
            } else {
                // Apply forgery penalty to the framed target (charged with the planted crime)
                _applyActorCrimePenalty(target, town, kingdom, 'forgery', 1.0);
                logEvent('📝 ' + target.firstName + ' ' + (target.lastName || '') + ' was framed for forgery in ' + town.name + ' — record blemished.',  { type: 'em_scheme_frame_success', townId: town.id , _noToast: true}, 'npc_activity');
            }
            return true;
        }

        function _bribeGuardsScheme(em, town, rng, personality) {
            // Skill: bribe_expert required (player parity)
            if (!emHasSkill(em, 'bribe_expert')) return false;
            var bribeCost = 100 + Math.floor(rng.random() * 200);
            if ((em.gold || 0) < bribeCost) return false;
            var detection = _calcActorDetection(em, town, 0.08);
            em.crimesCommitted = (em.crimesCommitted || 0) + 1;
            var kingdom = findKingdom(town.kingdomId);
            em.gold -= bribeCost;
            if (rng.chance(detection)) {
                var fine = _applyActorCrimePenalty(em, town, kingdom, 'bribery', 1.0);
                logEvent('⚖️ ' + em.firstName + ' caught bribing town guards in ' + town.name + ' — fined ' + fine + 'g.',  { type: 'em_scheme_bribe_caught', townId: town.id , _noToast: true}, 'npc_activity');
            } else {
                if (!em._bribedGuards) em._bribedGuards = {};
                em._bribedGuards[town.id] = { expiresDay: world.day + 30, reductionPct: 35 };
                logEvent('💸 ' + em.firstName + ' ' + (em.lastName || '') + ' bribes guards in ' + town.name + ' (covert).',  { type: 'em_scheme_bribe_success', townId: town.id , _noToast: true}, 'npc_activity');
            }
            return true;
        }

        function _forgeDocumentsScheme(em, town, rng, personality) {
            // Skill: master_forger required (player parity)
            if (!emHasSkill(em, 'master_forger')) return false;
            var detection = _calcActorDetection(em, town, 0.18);
            em.crimesCommitted = (em.crimesCommitted || 0) + 1;
            var kingdom = findKingdom(town.kingdomId);
            // v9p33river198: strategically choose citizenship vs license vs cash
            // - Pick a kingdom OTHER than the EM's home where they don't already
            //   have rank, biased toward kingdoms whose laws block non-citizens
            //   (closed_borders) OR where the EM has a building / sees high rep.
            var emKId = em.kingdomId;
            var candidates = world.kingdoms.filter(function(k) {
                if (k.id === emKId) return false;
                if ((em.socialRank && em.socialRank[k.id]) || 0) return false; // already has real rank
                return true;
            });
            var bestK = null, bestScore = -Infinity;
            for (var ki = 0; ki < candidates.length; ki++) {
                var k = candidates[ki];
                var sc = (em.reputation && em.reputation[k.id] ? em.reputation[k.id] : 50) * 0.05;
                if (k.laws && (k.laws.closedBorders || (k.laws.specialLaws || []).some(function(sl){return sl.effect==='closed_borders';}))) sc += 5;
                // EM owns building in this kingdom -> wants license
                if ((em.buildings || []).some(function(b){var t=findTown(b.townId);return t && t.kingdomId===k.id;})) sc += 4;
                if (sc > bestScore) { bestScore = sc; bestK = k; }
            }
            // Decision tree
            var docKind = 'cash'; // default fallback if no good kingdom
            if (bestK) {
                docKind = (personality.greed > 60 ? 'temp_citizenship' : 'temp_license');
            }
            // Cost gate
            var docCost = (docKind === 'temp_citizenship') ? 600 : (docKind === 'temp_license' ? 250 : 0);
            if (docCost > 0 && (em.gold || 0) < docCost) docKind = 'cash';

            if (rng.chance(detection)) {
                var fine = _applyActorCrimePenalty(em, town, kingdom, 'forgery', 2.0);
                logEvent('⚖️ ' + em.firstName + ' caught forging documents in ' + town.name + ' — fined ' + fine + 'g.',  { type: 'em_scheme_forge_caught', townId: town.id , _noToast: true}, 'npc_activity');
                return true;
            }
            if (docKind === 'cash') {
                var revenue = 300 + Math.floor(rng.random() * 500);
                em.gold = (em.gold || 0) + revenue;
                logEvent('📝 ' + em.firstName + ' ' + (em.lastName || '') + ' profits ' + revenue + 'g from forged documents in ' + town.name + ' (covert).',  { type: 'em_scheme_forge_success', townId: town.id , _noToast: true}, 'npc_activity');
            } else {
                em.gold -= docCost;
                em._forgedKingdomDocs = em._forgedKingdomDocs || {};
                if (!em._forgedKingdomDocs[bestK.id]) em._forgedKingdomDocs[bestK.id] = {};
                var docKey = (docKind === 'temp_citizenship') ? 'citizenship' : 'license';
                em._forgedKingdomDocs[bestK.id][docKey] = (world.day || 0) + 30;
                logEvent('📝 ' + em.firstName + ' ' + (em.lastName || '') + ' forges 30-day ' + (docKind === 'temp_citizenship' ? 'citizenship' : 'trade license') + ' for ' + bestK.name + ' (covert).',  { type: 'em_scheme_forge_success', townId: town.id, kingdomId: bestK.id , _noToast: true}, (typeof Player !== 'undefined' && Player.citizenshipKingdomId === bestK.id ? 'my_kingdom' : 'foreign_kingdoms'));
            }
            return true;
        }

        function _arsonScheme(em, town, rng, personality) {
            // Skill: arsonist_skill required (player parity)
            if (!emHasSkill(em, 'arsonist_skill')) return false;
            var rivals = world.people.filter(function(p) { return p.alive && p.isEliteMerchant && p.id !== em.id && p.townId === town.id && (p.buildings || []).length > 0; });
            if (rivals.length === 0) return false;
            var target = rivals[Math.floor(rng.random() * rivals.length)];
            var bldEntry = target.buildings[Math.floor(rng.random() * target.buildings.length)];
            if (!bldEntry) return false;
            var tt = findTown(bldEntry.townId || town.id);
            var realBld = tt && tt.buildings ? tt.buildings.find(function(b) { return b.ownerId === target.id && b.type === bldEntry.type; }) : null;
            if (!realBld) return false;
            var detection = _calcActorDetection(em, town, 0.40);
            em.crimesCommitted = (em.crimesCommitted || 0) + 1;
            var kingdom = findKingdom(town.kingdomId);
            if (rng.chance(detection)) {
                var fine = _applyActorCrimePenalty(em, town, kingdom, 'arson', 1.0);
                logEvent('⚖️ ' + em.firstName + ' caught attempting arson in ' + town.name + ' — fined ' + fine + 'g.',  { type: 'em_scheme_arson_caught', townId: town.id , _noToast: true}, 'npc_activity');
            } else {
                realBld.condition = 'destroyed';
                realBld._destroyedDay = world.day;
                logEvent('🔥 A fire of suspicious origin destroyed ' + target.firstName + '\'s ' + (findBuildingType(realBld.type) || {name:realBld.type}).name + ' in ' + town.name + '.',  { type: 'em_scheme_arson_success', townId: town.id , _noToast: true}, 'npc_activity');
            }
            return true;
        }

        // v9p33river211: EM poison scheme — pay an agent (1k-3k g) to plant
        // 'poisoned' illness in a rival merchant's food/drink. Uses same
        // 'poison' crime category. Caught chance bumped 1.20x for noble target
        // (mirrors player). Severe illness, 2.5%/d death risk via tickNPCHealth.
        function _poisonScheme(em, town, rng, personality) {
            if (!emHasSkill(em, 'poisoner')) return false;
            // Need gold to pay the planter (covers poison + agent fee).
            // Player needs an actual vial; for EMs we assume the planter
            // sources the poison themselves.
            if ((em.gold || 0) < 1500) return false;
            var rivals = world.people.filter(function(p) {
                return p.alive && p.id !== em.id && p.townId === town.id &&
                    (p.isEliteMerchant || p.isNoble || p.occupation === 'noble');
            });
            if (rivals.length === 0) return false;
            var target = rivals[Math.floor(rng.random() * rivals.length)];
            var nobleMult = (target.isKing || target.occupation === 'king') ? 1.30
                : (target.isNoble || target.occupation === 'noble') ? 1.20 : 1.0;
            var detection = Math.min(0.95, _calcActorDetection(em, town, 0.18) * nobleMult);
            var cost = 1000 + Math.floor(rng.random() * 2001);
            em.gold = Math.max(0, em.gold - cost);
            em.crimesCommitted = (em.crimesCommitted || 0) + 1;
            var kingdom = findKingdom(town.kingdomId);
            if (rng.chance(detection)) {
                var fine = _applyActorCrimePenalty(em, town, kingdom, 'poison', 1.0);
                logEvent('☠️ ' + em.firstName + ' ' + (em.lastName || '') + ' caught paying an agent to poison ' +
                    (target.firstName || '') + ' ' + (target.lastName || '') + ' in ' + town.name + ' — fined ' + fine + 'g.', 
                    { type: 'em_scheme_poison_caught', townId: town.id, kingdomId: kingdom && kingdom.id , _noToast: true}, 'npc_activity');
            } else {
                // Inflict 'poisoned' (severe) on the target via the real illness system
                if (typeof Engine.infectNPC === 'function') {
                    try { Engine.infectNPC(target, 'poisoned', 'poisoned_by_em'); } catch(_e) {}
                    if (target.illnesses && target.illnesses.length > 0) {
                        var li = target.illnesses[target.illnesses.length - 1];
                        if (li) { li.severity = 'severe'; li.source = 'poisoned'; }
                    } else {
                        target.illness = 'poisoned';
                        target.illnessSeverity = 'severe';
                        target.illnessSource = 'poisoned';
                        target.sick = true;
                    }
                    if (target.health > 75) target.health = 75;
                }
                logEvent('☠️ ' + (target.firstName || '') + ' ' + (target.lastName || '') + ' has fallen mysteriously ill in ' + town.name + '...', 
                    { type: 'em_scheme_poison_success', townId: town.id , _noToast: true}, 'npc_activity');
            }
            return true;
        }


        // v9p33river255: always rebuild — functions don't serialize, so after
        // save/load em._schemeFns exists as `{}` (truthy) but .forge etc are
        // undefined. Old `||` guard skipped rebuild → TypeError on .forge().
        em._schemeFns = {
            rumors: _spreadRumorsScheme,
            frame: _frameCompetitorScheme,
            bribe: _bribeGuardsScheme,
            forge: _forgeDocumentsScheme,
            arson: _arsonScheme,
            poison: _poisonScheme
        };
        // ── end scheme palette ──


        // Removed honesty >= 40 early return — tick gate already checks honesty < 40
        if ((em.gold || 0) < 100) return; // too poor to risk
        var kingdom = findKingdom(em.kingdomId);
        if (!kingdom) return;
        if (!em.criminalRecord) em.criminalRecord = {};
        var kId = em.kingdomId;
        var detectionReduction = emHasSkill(em, 'master_smuggler') ? 0.4 : emHasSkill(em, 'discrete') ? 0.7 : 1.0;

        // War profiteering (existing)
        if (em.strategy === 'war_profiteer' && personality.risk_tolerance > 50) {
            if (kingdom.atWar && kingdom.atWar.size > 0) {
                var profit = Math.floor(50 + rng.random() * 200);
                em.gold += profit;
                em.crimesCommitted = (em.crimesCommitted || 0) + 1;
                if (!em.criminalRecord[kId]) em.criminalRecord[kId] = 0;
                if (rng.chance(0.05 * detectionReduction)) {
                    em.criminalRecord[kId]++;
                    var fine = Math.floor(profit * 2);
                    em.gold = Math.max(0, em.gold - fine);
                    em.reputation[kId] = Math.max(0, (em.reputation[kId] || 50) - 10);
                    logEvent(em.firstName + ' ' + (em.lastName || '') + ' was fined ' + fine + 'g for war profiteering!',  {
                        type: 'elite_crime_caught', cause: 'War profiteering detected by kingdom authorities.',
                        effects: [fine + 'g fine levied', 'Reputation damaged']
                    ,
                    _noToast: true}, 'npc_activity');
                }
            }
        }

        // Smuggling banned goods: buy banned goods cheaply elsewhere, sell at premium
        if (personality.risk_tolerance > 55 && kingdom.laws && kingdom.laws.bannedGoods && kingdom.laws.bannedGoods.length > 0) {
            var bannedList = kingdom.laws.bannedGoods;
            var emInv = em.npcMerchantInventory || {};
            // Sell banned goods we're holding at huge markup
            for (var smi = 0; smi < bannedList.length; smi++) {
                var smugGood = bannedList[smi];
                if ((emInv[smugGood] || 0) > 0 && rng.chance(0.3)) {
                    var smugQty = Math.min(emInv[smugGood], rng.randInt(1, 3));
                    var smugRes = findResourceById(smugGood);
                    var smugPrice = smugRes ? Math.floor(smugRes.basePrice * (2.0 + rng.random())) : 30;
                    em.gold += smugPrice * smugQty;
                    emInv[smugGood] -= smugQty;
                    em.crimesCommitted = (em.crimesCommitted || 0) + 1;
                    if (rng.chance(0.08 * detectionReduction)) {
                        em.criminalRecord[kId] = (em.criminalRecord[kId] || 0) + 1;
                        var smugFine = smugPrice * smugQty * 3;
                        em.gold = Math.max(0, em.gold - smugFine);
                        em.reputation[kId] = Math.max(0, (em.reputation[kId] || 50) - 15);
                        logEvent('⚖️ ' + em.firstName + ' ' + (em.lastName || '') + ' caught smuggling ' + smugQty + ' ' + smugGood + '! Fined ' + smugFine + 'g.',  {
                            type: 'elite_crime_smuggling', cause: 'Smuggling banned goods: ' + smugGood,
                            effects: [smugFine + 'g fine', 'Criminal record increased', 'Reputation severely damaged']
                        ,
                        _noToast: true}, 'npc_activity');
                    } else {
                        logEvent(em.firstName + ' ' + (em.lastName || '') + ' secretly sells ' + smugQty + ' smuggled ' + smugGood + '.',  {
                            type: 'elite_smuggle_success', cause: 'Black market sale of banned goods.',
                            effects: [smugPrice * smugQty + 'g earned from black market']
                        ,
                        _noToast: true}, 'npc_activity');
                    }
                }
            }
        }

        // Tax evasion: under-report trade income
        if (personality.honesty < 30 && personality.greed > 50 && (em.gold || 0) > 500 && rng.chance(0.2)) {
            var evadedTax = Math.floor(em.gold * 0.02);
            em.gold += evadedTax; // keep what would have been taxed
            em.crimesCommitted = (em.crimesCommitted || 0) + 1;
            if (rng.chance(0.03 * detectionReduction)) {
                em.criminalRecord[kId] = (em.criminalRecord[kId] || 0) + 1;
                var taxPenalty = evadedTax * 5;
                em.gold = Math.max(0, em.gold - taxPenalty);
                em.reputation[kId] = Math.max(0, (em.reputation[kId] || 50) - 8);
                logEvent('⚖️ ' + em.firstName + ' ' + (em.lastName || '') + ' audited for tax evasion! Penalty: ' + taxPenalty + 'g.',  {
                    type: 'elite_crime_tax_evasion', cause: 'Kingdom tax audit uncovered unreported income.',
                    effects: [taxPenalty + 'g penalty', 'Criminal record increased']
                ,
                _noToast: true}, 'npc_activity');
            }
        }

        // Bribery: spend gold to boost reputation or reduce criminal record
        if (personality.honesty < 35 && (em.criminalRecord[kId] || 0) > 0 && (em.gold || 0) > 300 && rng.chance(0.15)) {
            var bribeCost = Math.floor(100 + rng.random() * 200);
            if (em.gold >= bribeCost) {
                em.gold -= bribeCost;
                em.crimesCommitted = (em.crimesCommitted || 0) + 1;
                if (rng.chance(0.1 * detectionReduction)) {
                    em.criminalRecord[kId] = (em.criminalRecord[kId] || 0) + 2;
                    em.reputation[kId] = Math.max(0, (em.reputation[kId] || 50) - 20);
                    logEvent('⚖️ ' + em.firstName + ' ' + (em.lastName || '') + ' caught bribing officials! Record worsened.',  {
                        type: 'elite_crime_bribery_caught', cause: 'Attempted bribery of kingdom officials failed.',
                        effects: ['Criminal record increased by 2', 'Reputation severely damaged']
                    ,
                    _noToast: true}, 'npc_activity');
                } else {
                    em.criminalRecord[kId] = Math.max(0, em.criminalRecord[kId] - 1);
                    em.reputation[kId] = Math.min(100, (em.reputation[kId] || 50) + 5);
                }
            }
        }

        // v9p33river196: EM-on-EM crimes — strategic targeting of rivals
        // SABOTAGE: high-risk, high-reward — disable rival's competing building
        if (personality.honesty < 30 && personality.risk_tolerance > 65 && rng.chance(0.18)) {
            _eliteSabotageRival(em, town, rng, personality);
        }
        // THEFT: lower stakes — quick gold from a rich rival
        if (personality.honesty < 35 && personality.greed > 55 && rng.chance(0.22)) {
            _eliteStealFromRival(em, town, rng, personality);
        }
        // v9p33river197: extended player-parity schemes — gated by skill +
        // personality so EMs use exactly the toolkit they invested in.
        if (em._schemeFns) {
            // Spread rumors — silver_tongue_dark + greed
            if (personality.greed > 55 && rng.chance(0.20)) em._schemeFns.rumors(em, town, rng, personality);
            // Frame competitor — master_forger + selfishness
            if (personality.selfishness > 55 && rng.chance(0.12)) em._schemeFns.frame(em, town, rng, personality);
            // Bribe guards — bribe_expert + honesty<30
            if (personality.honesty < 30 && rng.chance(0.15)) em._schemeFns.bribe(em, town, rng, personality);
            // Forge documents — master_forger + greed
            if (personality.greed > 55 && rng.chance(0.18)) em._schemeFns.forge(em, town, rng, personality);
            // Arson — arsonist_skill + risk_tolerance>75
            if (personality.risk_tolerance > 75 && rng.chance(0.06)) em._schemeFns.arson(em, town, rng, personality);
            // v9p33river211: Poison — poisoner skill + selfishness>60 + risk_tolerance>50
            if (personality.selfishness > 60 && personality.risk_tolerance > 50 && rng.chance(0.05)) em._schemeFns.poison(em, town, rng, personality);
        }
    }

    // ---- NET WORTH & LEADERBOARD ----
    function calculateNetWorth(entity) {
        var worth = entity.gold || 0;

        // Inventory value (check both npcMerchantInventory and inventory)
        var inv = entity.npcMerchantInventory || entity.inventory || {};
        for (var resId in inv) {
            var qty = inv[resId] || 0;
            if (qty <= 0) continue;
            var res = findResourceById(resId);
            worth += qty * (res ? res.basePrice : 10);
        }
        // Also check regular inventory if different
        if (entity.inventory && entity.npcMerchantInventory) {
            for (var resId2 in entity.inventory) {
                var qty2 = entity.inventory[resId2] || 0;
                if (qty2 <= 0) continue;
                var res2 = findResourceById(resId2);
                worth += qty2 * (res2 ? res2.basePrice : 10);
            }
        }
        // Town storage
        if (entity.townStorage) {
            for (var tid in entity.townStorage) {
                for (var resId3 in entity.townStorage[tid]) {
                    var qty3 = entity.townStorage[tid][resId3] || 0;
                    if (qty3 <= 0) continue;
                    var res3 = findResourceById(resId3);
                    worth += qty3 * (res3 ? res3.basePrice : 10);
                }
            }
        }

        // Building value
        if (entity.buildings) {
            for (var bi = 0; bi < entity.buildings.length; bi++) {
                var bld = entity.buildings[bi];
                var bt = findBuildingType(bld.type);
                if (bt) worth += bt.cost * (1 + ((bld.level || 1) - 1) * 0.5);
            }
        }

        // Social rank prestige
        if (entity.socialRank) {
            for (var kId in entity.socialRank) {
                worth += (entity.socialRank[kId] || 0) * 5000;
            }
        }

        // Ships
        if (entity.ships) {
            var shipVal = 0;
            if (typeof entity.ships === 'number') shipVal = entity.ships * 1500;
            else if (Array.isArray(entity.ships)) {
                for (var si2 = 0; si2 < entity.ships.length; si2++) {
                    var st = CONFIG.SHIP_TYPES ? CONFIG.SHIP_TYPES[entity.ships[si2].type] : null;
                    shipVal += st ? st.cost * ((entity.ships[si2].condition || 100) / 100) * 0.7 : 1500;
                }
            }
            worth += shipVal;
        }

        // Horses
        if (entity.horses) {
            if (typeof entity.horses === 'number') worth += entity.horses * 60;
            else if (Array.isArray(entity.horses)) worth += entity.horses.length * 60;
        }

        return Math.floor(worth);
    }

    function getHighestRank(socialRank) {
        var highest = 0;
        for (var kId in socialRank) {
            if ((socialRank[kId] || 0) > highest) highest = socialRank[kId];
        }
        return highest;
    }

    function getLeaderboard() {
        _syncState();
        var entries = [];

        // Add player — use the Player module's getters directly
        if (typeof Player !== 'undefined' && Player.alive) {
            entries.push({
                id: 'player',
                name: Player.fullName || ((Player.firstName || '') + ' ' + (Player.lastName || '')),
                familyName: Player.lastName || Player.firstName || 'Unknown',
                netWorth: (Player.getNetWorth ? Player.getNetWorth() : calculateNetWorth({
                    gold: Player.gold, inventory: Player.inventory, buildings: Player.buildings,
                    socialRank: Player.socialRank, ships: Player.ships, horses: Player.horses,
                    townStorage: Player.townStorage
                })),
                gold: Player.gold || 0,
                buildings: Player.buildings ? Player.buildings.length : 0,
                employees: Player.employees ? Player.employees.length : 0,
                primaryKingdom: Player.citizenshipKingdomId,
                highestRank: getHighestRank(Player.socialRank || {}),
                strategy: 'Player',
                isPlayer: true,
                townId: Player.townId,
                heraldry: null,
            });
        }

        // Add elite merchants
        if (world && world.people) {
            var elites = world.people.filter(function(m) { return m.alive && m.isEliteMerchant; });
            for (var i = 0; i < elites.length; i++) {
                var m = elites[i];
                ensureEliteMerchantFields(m);
                entries.push({
                    id: m.id,
                    name: (m.firstName || '') + ' ' + (m.lastName || ''),
                    familyName: m.familyName || m.lastName || m.firstName || 'Unknown',
                    netWorth: m.netWorth || calculateNetWorth(m),
                    gold: m.gold || 0,
                    buildings: m.buildings ? m.buildings.length : 0,
                    employees: (function() {
                        var count = 0;
                        if (m.id && world.towns) {
                            for (var ti = 0; ti < world.towns.length; ti++) {
                                var tBlds = world.towns[ti].buildings;
                                if (!tBlds) continue;
                                for (var bi = 0; bi < tBlds.length; bi++) {
                                    if (tBlds[bi].ownerId === m.id && tBlds[bi].workers) {
                                        count += tBlds[bi].workers.length;
                                    }
                                }
                            }
                        }
                        return count;
                    })(),
                    primaryKingdom: m.citizenshipKingdomId || m.kingdomId,
                    highestRank: getHighestRank(m.socialRank || {}),
                    strategy: m.strategy || 'diversified',
                    isPlayer: false,
                    townId: m.townId,
                    heraldry: m.heraldry || null,
                });
            }
        }

        entries.sort(function(a, b) { return b.netWorth - a.netWorth; });
        return entries;
    }

    // ========================================================
    // §19A3  ELITE MERCHANT KINGDOM-AWARE AI
    // ========================================================

    // ---- CONQUEST RESPONSE: Buy freedom, flee raids, react to conquest ----
    function eliteConquestResponseAI(em, town, rng, personality) {
        // If indentured, immediately buy freedom (elite merchants are wealthy)
        if (em.status === 'indentured') {
            var freedomCost = em.servitudeFreedomCost || CONFIG.SERVITUDE_FREEDOM_COST || 1000;
            if ((em.gold || 0) >= freedomCost) {
                var servKingdom = findKingdom(em.servitudeKingdomId);
                em.gold -= freedomCost;
                if (servKingdom) servKingdom.gold += freedomCost;
                em.status = 'citizen';
                delete em.servitudeEndDay;
                delete em.servitudeFreedomCost;
                delete em.servitudeKingdomId;
                logEvent(em.firstName + ' ' + (em.lastName || '') + ' immediately buys their freedom for ' + freedomCost + 'g!',  {
                    type: 'elite_freedom_buyout',
                    cause: 'Wealthy elite merchant refuses to remain in servitude.',
                    effects: [
                        em.firstName + ' pays ' + freedomCost + 'g to regain freedom',
                        'Elite merchant resumes trading operations',
                        'Kingdom treasury receives ' + freedomCost + 'g'
                    ]
                ,
                _noToast: true}, 'npc_activity');
                // After buying freedom, try to relocate to a safer town
                eliteEmergencyRelocate(em, rng);
            }
            return; // Don't do anything else while indentured
        }

        // If town was just conquered, consider fleeing
        if (town._justConquered && rng.chance(0.7)) {
            eliteEmergencyRelocate(em, rng);
        }
    }

    // ---- FRONTLINE RESPONSE: Flee dangerous frontline towns ----
    function eliteFrontlineAI(em, town, rng, personality) {
        if (!town.isFrontline) return;
        // 60% chance to relocate from frontline towns
        if (rng.chance(0.6)) {
            var safeTowns = world.towns.filter(function(t) {
                return !t.isFrontline && t.kingdomId === em.kingdomId && t.id !== em.townId && (t.happiness || 50) > 25;
            });
            if (safeTowns.length > 0) {
                // Prefer prosperous, safe towns
                safeTowns.sort(function(a, b) { return (b.prosperity || 0) - (a.prosperity || 0); });
                var dest = safeTowns[0];
                var oldTown = town.name;
                em.townId = dest.id;
                em.kingdomId = dest.kingdomId;
                // Fix population bookkeeping on flee
                if (town.population > 0) town.population--;
                dest.population = (dest.population || 0) + 1;
                if (Engine.moveYoungChildrenWithParent) Engine.moveYoungChildrenWithParent(em, dest.id, dest.kingdomId);
                logEvent(em.firstName + ' ' + (em.lastName || '') + ' flees the frontline in ' + oldTown + ' for safety in ' + dest.name + '.',  {
                    type: 'elite_frontline_flee',
                    cause: oldTown + ' is on the front lines of war — too dangerous for trade.',
                    effects: [
                        em.firstName + ' relocates to ' + dest.name,
                        'Trading operations disrupted temporarily',
                        'Buildings in ' + oldTown + ' left unmanned'
                    ]
                ,
                _noToast: true}, 'npc_activity');
            }
        }
    }

    // ---- Emergency relocation helper ----
    function eliteEmergencyRelocate(em, rng) {
        var safeTowns = world.towns.filter(function(t) {
            return !t.isFrontline && !t._justConquered && t.id !== em.townId && (t.happiness || 50) > 20;
        });
        // Prefer towns in same kingdom, then any town
        var sameKingdom = safeTowns.filter(function(t) { return t.kingdomId === em.kingdomId; });
        var choices = sameKingdom.length > 0 ? sameKingdom : safeTowns;
        if (choices.length > 0) {
            choices.sort(function(a, b) { return (b.prosperity || 0) - (a.prosperity || 0); });
            var dest = choices[Math.min(rng.randInt(0, 2), choices.length - 1)];
            // Fix population bookkeeping
            var oldEliteTown = findTown(em.townId);
            if (oldEliteTown && oldEliteTown.population > 0) oldEliteTown.population--;
            dest.population = (dest.population || 0) + 1;
            em.townId = dest.id;
            em.kingdomId = dest.kingdomId;
            if (Engine.moveYoungChildrenWithParent) Engine.moveYoungChildrenWithParent(em, dest.id, dest.kingdomId);
        }
    }

    // ---- KING POLICY RESPONSE: Bounties, subsidies, tax holidays, seizure threat ----
    function eliteKingPolicyAI(em, town, rng, strategy, personality) {
        var kingdom = findKingdom(em.kingdomId);
        if (!kingdom) return;
        var preferredGoods = STRATEGY_GOODS[strategy] || STRATEGY_GOODS.diversified;
        var preferredBuildings = STRATEGY_BUILDINGS[strategy] || STRATEGY_BUILDINGS.diversified;

        // -- Respond to production bounties --
        if (kingdom.productionBounties && kingdom.productionBounties.length > 0) {
            for (var bi = 0; bi < kingdom.productionBounties.length; bi++) {
                var bounty = kingdom.productionBounties[bi];
                if (bounty.fulfilled || bounty.expiresDay <= world.day) continue;

                // Can we produce this good?
                var canFulfill = false;
                var hasBuilding = em.buildings && em.buildings.some(function(b) {
                    var bt = findBuildingType(b.type);
                    return bt && bt.produces === bounty.good;
                });
                var canBuildForIt = preferredBuildings.some(function(bType) {
                    var bt = findBuildingType(bType);
                    return bt && bt.produces === bounty.good;
                });
                var hasInventory = (em.npcMerchantInventory[bounty.good] || 0) > 0;

                if (hasBuilding || hasInventory || canBuildForIt) canFulfill = true;

                // 40% chance to pursue bounty if they can fulfill it
                if (canFulfill && rng.chance(0.4)) {
                    // If we have inventory, deliver immediately
                    if (hasInventory) {
                        var deliverQty = Math.min(em.npcMerchantInventory[bounty.good] || 0, 10);
                        if (deliverQty > 0) {
                            em.npcMerchantInventory[bounty.good] -= deliverQty;
                            var reward = (bounty.reward || CONFIG.KING_BOUNTY_DEFAULT_REWARD || 50) * deliverQty;
                            em.gold += reward;
                            if (kingdom.gold >= reward) kingdom.gold -= reward;
                            em._bountiesFulfilled = (em._bountiesFulfilled || 0) + 1;
                            em.reputation[kingdom.id] = Math.min(100, (em.reputation[kingdom.id] || 50) + 5);
                            logEvent(em.firstName + ' ' + (em.lastName || '') + ' fulfills a royal bounty for ' + bounty.good + ', earning ' + reward + 'g.',  {
                                type: 'elite_bounty_fulfilled',
                                cause: 'Kingdom requested ' + bounty.good + ' production.',
                                effects: [
                                    em.firstName + ' delivers ' + deliverQty + ' ' + bounty.good,
                                    'Earned ' + reward + 'g bounty reward',
                                    'Royal reputation increased'
                                ]
                            ,
                            _noToast: true}, (typeof Player !== 'undefined' && Player.citizenshipKingdomId === kingdom.id ? 'my_kingdom' : 'foreign_kingdoms'));
                        }
                    }
                    // If we don't have inventory but can build, consider building (handled in eliteBuildAI with subsidies)
                    break; // Only pursue one bounty at a time
                }
            }
        }

        // -- Asset seizure threat: Move wealth to other kingdoms --
        var kp = kingdom.kingPersonality || {};
        var isGreedyKing = kp.greed === 'greedy' || kp.greed === 'corrupt';
        var isCruelKing = kp.temperament === 'cruel' || kp.temperament === 'stern';
        var kingdomBankrupt = (kingdom._bankruptDays || 0) > 5;

        if ((isGreedyKing || kingdomBankrupt) && (em.gold || 0) > 2000 && personality.risk_tolerance > 40) {
            // Consider moving some assets to a different kingdom
            if (rng.chance(0.25)) {
                var otherKingdoms = world.kingdoms.filter(function(k) {
                    return k.id !== kingdom.id && k.gold > 500 && !(k._bankruptDays > 0);
                });
                if (otherKingdoms.length > 0) {
                    // Find a safe town in another kingdom to buy property
                    var safeKingdom = otherKingdoms.sort(function(a, b) { return (b.gold || 0) - (a.gold || 0); })[0];
                    var safeTowns = world.towns.filter(function(t) {
                        return t.kingdomId === safeKingdom.id && !t.isFrontline && (t.prosperity || 0) > 20;
                    });
                    if (safeTowns.length > 0 && !em._assetsDiversified) {
                        em._assetsDiversified = true;
                        var diverseAmt = Math.floor(em.gold * 0.15);
                        em.gold -= diverseAmt;
                        // Simulate investment: store as cached gold in a safe kingdom
                        if (!em._foreignInvestments) em._foreignInvestments = {};
                        em._foreignInvestments[safeKingdom.id] = (em._foreignInvestments[safeKingdom.id] || 0) + diverseAmt;
                        _storeBackgroundGossip('npc_finance', em.firstName + ' ' + (em.lastName || '') + ' quietly moves ' + diverseAmt + 'g in assets to ' + safeKingdom.name + '.', {
                            townId: em.townId,
                            kingdomId: kingdom.id,
                            personId: em.id
                        });
                    }
                }
            }
        }
    }

    // ---- ECONOMIC COLLAPSE RESPONSE: Flee collapsing kingdoms, buy cheap, offer bailout ----
    function eliteCollapseAI(em, town, rng, personality) {
        var kingdom = findKingdom(em.kingdomId);
        if (!kingdom) return;
        var strategy = em.strategy || 'diversified';
        var bankruptDays = kingdom._bankruptDays || 0;

        // Phase 1: Kingdom nearing collapse (bankrupt > 30 days) — start moving assets
        if (bankruptDays > 30 && !em._assetsDiversified) {
            if (rng.chance(0.4)) {
                var safeKingdoms = world.kingdoms.filter(function(k) {
                    return k.id !== kingdom.id && !(k._bankruptDays > 0) && k.gold > 1000;
                });
                if (safeKingdoms.length > 0) {
                    var bestRefuge = safeKingdoms.sort(function(a, b) { return (b.gold || 0) - (a.gold || 0); })[0];
                    var moveAmount = Math.floor(em.gold * 0.3);
                    if (moveAmount > 100) {
                        em.gold -= moveAmount;
                        if (!em._foreignInvestments) em._foreignInvestments = {};
                        em._foreignInvestments[bestRefuge.id] = (em._foreignInvestments[bestRefuge.id] || 0) + moveAmount;
                        em._assetsDiversified = true;
                        logEvent(em.firstName + ' ' + (em.lastName || '') + ' evacuates ' + moveAmount + 'g from collapsing ' + kingdom.name + '.',  {
                            type: 'elite_collapse_flight',
                            cause: kingdom.name + ' has been bankrupt for ' + bankruptDays + ' days.',
                            effects: [
                                moveAmount + 'g moved to ' + bestRefuge.name + ' for safety',
                                em.firstName + ' prepares for potential kingdom collapse',
                                'Elite merchants losing confidence in ' + kingdom.name
                            ]
                        ,
                        _noToast: true}, (typeof Player !== 'undefined' && Player.citizenshipKingdomId === kingdom.id ? 'my_kingdom' : 'foreign_kingdoms'));
                    }
                }
            }
        }

        // Phase 2: If collapse happens and merchant is wealthy, offer bailout
        if (kingdom._collapseTriggered && (em.gold || 0) >= 3000 && personality.ambition > 50) {
            if (rng.chance(0.3)) {
                var bailoutCost = Math.min(em.gold, rng.randInt(3000, 5000));
                em.gold -= bailoutCost;
                kingdom.gold += bailoutCost;
                kingdom._bankruptDays = 0;
                kingdom._collapseTriggered = false;
                // Gain noble title and tax exemption
                var kId = kingdom.id;
                em.socialRank[kId] = Math.max((em.socialRank[kId] || 0), 3); // Noble rank
                em.reputation[kId] = Math.min(100, (em.reputation[kId] || 50) + 30);
                em._kingRelationship[kId] = (em._kingRelationship[kId] || 0) + 50;
                logEvent('\uD83D\uDC51 ' + em.firstName + ' ' + (em.lastName || '') + ' bails out ' + kingdom.name + ' with ' + bailoutCost + 'g! Elevated to nobility.',  {
                    type: 'elite_bailout',
                    cause: em.firstName + ' saves ' + kingdom.name + ' from complete economic collapse.',
                    effects: [
                        em.firstName + ' pays ' + bailoutCost + 'g to save the kingdom',
                        'Elevated to noble rank for service to the crown',
                        'Kingdom avoids collapse and begins recovery',
                        em.firstName + ' gains massive political influence'
                    ]
                ,
                _noToast: true}, (typeof Player !== 'undefined' && Player.citizenshipKingdomId === kingdom.id ? 'my_kingdom' : 'foreign_kingdoms'));
                return;
            }
        }

        // Phase 3: Buy cheap assets in collapsing economies (opportunistic)
        if (bankruptDays > 15 && (em.gold || 0) > 500 && personality.greed > 40) {
            // Look for cheap buildings for sale in bankrupt kingdoms
            for (var tIdx = 0; tIdx < world.towns.length; tIdx++) {
                var cheapTown = world.towns[tIdx];
                if (cheapTown.kingdomId !== kingdom.id && cheapTown.kingdomId) {
                    var cheapK = findKingdom(cheapTown.kingdomId);
                    if (!cheapK || (cheapK._bankruptDays || 0) < 10) continue;
                }
                // Look for buildings marked for sale
                for (var bldIdx = 0; bldIdx < cheapTown.buildings.length; bldIdx++) {
                    var bld = cheapTown.buildings[bldIdx];
                    if (!bld.forSale) continue;
                    if (bld.ownerId === em.id) continue;
                    var bType = findBuildingType(bld.type);
                    if (!bType) continue;
                    var discountedPrice = Math.floor(bType.cost * 0.5); // 50% value in crisis
                    if (em.gold >= discountedPrice && rng.chance(0.2)) {
                        var maxR = 0;
                        for (var rkId in em.socialRank) { if ((em.socialRank[rkId] || 0) > maxR) maxR = em.socialRank[rkId]; }
                        var rDef = CONFIG.SOCIAL_RANKS[maxR] || CONFIG.SOCIAL_RANKS[0];
                        if ((em.buildings || []).length >= (rDef.maxBuildings || 2)) break;
                        var prevOwner = bld.ownerId;
                        em.gold -= discountedPrice;
                        bld.ownerId = em.id;
                        bld.forSale = false;
                        if (!em.buildings) em.buildings = [];
                        em.buildings.push({ type: bld.type, townId: cheapTown.id, level: bld.level || 1 });
                        // Pay previous owner if they exist
                        if (prevOwner) {
                            var prevPerson = findPerson(prevOwner);
                            if (prevPerson) prevPerson.gold = (prevPerson.gold || 0) + discountedPrice;
                        }
                        var _distMsg = em.firstName + ' ' + (em.lastName || '') + ' buys a distressed ' + bType.name + ' in ' + cheapTown.name + ' for ' + discountedPrice + 'g (50% off).';
                        var _distDet = {
                            type: 'elite_distressed_purchase',
                            cause: 'Economic collapse creates buying opportunities.',
                            effects: [
                                em.firstName + ' acquires ' + bType.name + ' at half price',
                                'New asset in ' + cheapTown.name,
                                'Opportunistic investment during economic downturn'
                            ]
                        ,
                        _noToast: true};
                        if (_isPlayerRelevantTown(cheapTown.id)) {
                            logEvent(_distMsg, _distDet, 'npc_activity');
                        } else {
                            logHiddenEvent(_distMsg, _distDet, 'npc_activity');
                        }
                        break; // One purchase per cycle
                    }
                }
            }
        }

        // Phase 4: Consider converting for-sale buildings to preferred types
        if ((em.gold || 0) > 1000 && personality.greed > 30) {
            var emPreferred = STRATEGY_BUILDINGS[strategy] || STRATEGY_BUILDINGS.diversified;
            for (var cvTIdx = 0; cvTIdx < world.towns.length; cvTIdx++) {
                var cvTown = world.towns[cvTIdx];
                for (var cvIdx = 0; cvIdx < cvTown.buildings.length; cvIdx++) {
                    var cvBld = cvTown.buildings[cvIdx];
                    if (!cvBld.forSale || cvBld.ownerId === em.id) continue;
                    var cvBt = findBuildingType(cvBld.type);
                    if (!cvBt) continue;
                    // Check if building already matches EM preferences
                    if (emPreferred.indexOf(cvBld.type) !== -1) continue;
                    // Find a preferred building type to convert to
                    for (var cvPi = 0; cvPi < emPreferred.length; cvPi++) {
                        var cvTarget = emPreferred[cvPi];
                        var cvTargetBt = findBuildingType(cvTarget);
                        if (!cvTargetBt || !cvTargetBt.produces) continue;
                        // Check deposit requirements
                        var cvDepReq = CONFIG.DEPOSIT_REQUIREMENTS ? CONFIG.DEPOSIT_REQUIREMENTS[cvTarget] : null;
                        if (cvDepReq) {
                            var cvDeps = cvTown.naturalDeposits || {};
                            if (!cvDeps[cvDepReq.deposit] || cvDeps[cvDepReq.deposit] <= 0) continue;
                        }
                        // Calculate profitability
                        var cvSalePrice = cvBld.salePrice || Math.floor(cvBt.cost * 0.5);
                        var cvBpCost = 60; // estimated blasting powder cost
                        if (em.npcMerchantInventory && (em.npcMerchantInventory.blasting_powder || 0) >= 1) cvBpCost = 0;
                        var cvConversionCost = cvSalePrice + 500 + cvBpCost;
                        var cvDailyProfit = 0;
                        if (cvTargetBt.produces) {
                            var cvMktPrice = getMarketPrice(cvTown, cvTargetBt.produces);
                            cvDailyProfit = cvMktPrice * (cvTargetBt.rate || 1) - (cvTargetBt.workers || 1) * (CONFIG.BASE_WAGE || 4);
                        }
                        var cvExpectedRevenue = cvDailyProfit * 180;
                        if (cvExpectedRevenue > cvConversionCost * 1.5 && em.gold >= cvConversionCost + 200) {
                            // Check building limit
                            var cvMaxR = 0;
                            for (var cvRkId in em.socialRank) { if ((em.socialRank[cvRkId] || 0) > cvMaxR) cvMaxR = em.socialRank[cvRkId]; }
                            var cvRDef = CONFIG.SOCIAL_RANKS[cvMaxR] || CONFIG.SOCIAL_RANKS[0];
                            if ((em.buildings || []).length >= (cvRDef.maxBuildings || 2)) break;
                            // Acquire blasting powder if needed
                            var cvHasBp = (em.npcMerchantInventory && (em.npcMerchantInventory.blasting_powder || 0) >= 1);
                            if (!cvHasBp) {
                                var cvMktBp = (cvTown.market && cvTown.market.supply && cvTown.market.supply.blasting_powder) || 0;
                                if (cvMktBp >= 1) {
                                    cvHasBp = true;
                                } else {
                                    // Buy from kingdom
                                    var cvKingdom = findKingdom(cvTown.kingdomId);
                                    if (cvKingdom) {
                                        var cvKResult = buyBlastingPowderFromKingdom(cvKingdom.id, em.gold);
                                        if (cvKResult.success) {
                                            em.gold -= cvKResult.price;
                                            cvHasBp = true;
                                            if (!em.npcMerchantInventory) em.npcMerchantInventory = {};
                                            em.npcMerchantInventory.blasting_powder = (em.npcMerchantInventory.blasting_powder || 0) + 1;
                                        }
                                    }
                                }
                            }
                            if (!cvHasBp) continue;
                            var cvResult = convertBuilding(cvTown, cvIdx, cvTarget, em.id, 'em');
                            if (cvResult.success) {
                                if (!em.buildings) em.buildings = [];
                                em.buildings.push({ type: cvTarget, townId: cvTown.id, level: 1 });
                                var _cvMsg = em.firstName + ' ' + (em.lastName || '') + ' converted a ' + (cvBt.name || cvBld.type) + ' to a ' + cvTargetBt.name + ' in ' + cvTown.name + '.';
                                var _cvDet = {
                                    type: 'elite_conversion',
                                    cause: em.firstName + ' saw better opportunity in ' + cvTargetBt.name + ' production.',
                                    effects: ['Old building demolished with blasting powder', 'New ' + cvTargetBt.name + ' built', 'Investment: ' + cvConversionCost + 'g']
                                ,
                                _noToast: true};
                                if (_isPlayerRelevantTown(cvTown.id)) {
                                    logEvent(_cvMsg, _cvDet, 'npc_activity');
                                } else {
                                    logHiddenEvent(_cvMsg, _cvDet, 'npc_activity');
                                }
                            }
                            return; // One conversion per cycle
                        }
                    }
                }
            }
        }
    }

    // ---- MIGRATION WAVE RESPONSE: Buy/sell property based on population trends ----
    function eliteMigrationAI(em, town, rng, strategy) {
        // Check all towns for migration trends
        for (var tIdx = 0; tIdx < world.towns.length; tIdx++) {
            var checkTown = world.towns[tIdx];
            if (!checkTown.migrationLog || checkTown.migrationLog.length === 0) continue;

            var recentIn = 0;
            var recentOut = 0;
            for (var mi = 0; mi < checkTown.migrationLog.length; mi++) {
                var entry = checkTown.migrationLog[mi];
                if (entry.day >= world.day - 30) {
                    recentIn += (entry.in || 0);
                    recentOut += (entry.out || 0);
                }
            }

            // Refugees flooding in: buy property (values about to rise)
            if (recentIn >= (CONFIG.MIGRATION_WAVE_THRESHOLD || 5) && checkTown.id === em.townId) {
                if ((em.gold || 0) > 500 && rng.chance(0.2)) {
                    // Try to buy a building for sale in this growing town
                    for (var bIdx = 0; bIdx < checkTown.buildings.length; bIdx++) {
                        var bld2 = checkTown.buildings[bIdx];
                        if (!bld2.forSale || bld2.ownerId === em.id) continue;
                        var bType2 = findBuildingType(bld2.type);
                        if (!bType2 || em.gold < bType2.cost) continue;
                        var maxR2 = 0;
                        for (var rkId2 in em.socialRank) { if ((em.socialRank[rkId2] || 0) > maxR2) maxR2 = em.socialRank[rkId2]; }
                        var rDef2 = CONFIG.SOCIAL_RANKS[maxR2] || CONFIG.SOCIAL_RANKS[0];
                        if ((em.buildings || []).length >= (rDef2.maxBuildings || 2)) break;
                        em.gold -= bType2.cost;
                        bld2.ownerId = em.id;
                        bld2.forSale = false;
                        if (!em.buildings) em.buildings = [];
                        em.buildings.push({ type: bld2.type, townId: checkTown.id, level: bld2.level || 1 });
                        var _snapMsg = em.firstName + ' ' + (em.lastName || '') + ' snaps up a ' + bType2.name + ' in booming ' + checkTown.name + '.';
                        var _snapDet = {
                            type: 'elite_growth_investment',
                            cause: 'Population influx makes ' + checkTown.name + ' a growth market.',
                            effects: [
                                em.firstName + ' acquires ' + bType2.name + ' as migrants arrive',
                                'Property values expected to rise',
                                'Smart investment in growing town'
                            ]
                        ,
                        _noToast: true};
                        if (_isPlayerRelevantTown(checkTown.id)) {
                            logEvent(_snapMsg, _snapDet, 'npc_activity');
                        } else {
                            logHiddenEvent(_snapMsg, _snapDet, 'npc_activity');
                        }
                        break;
                    }
                }
            }

            // People fleeing: sell property before values drop
            if (recentOut >= (CONFIG.MIGRATION_WAVE_THRESHOLD || 5) && em.buildings) {
                for (var ebIdx = 0; ebIdx < em.buildings.length; ebIdx++) {
                    if (em.buildings[ebIdx].townId !== checkTown.id) continue;
                    if (rng.chance(0.15)) {
                        // Mark building for sale in the declining town
                        for (var tbIdx = 0; tbIdx < checkTown.buildings.length; tbIdx++) {
                            if (checkTown.buildings[tbIdx].ownerId === em.id && !checkTown.buildings[tbIdx].forSale) {
                                checkTown.buildings[tbIdx].forSale = true;
                                var _decMsg = em.firstName + ' ' + (em.lastName || '') + ' puts their ' + checkTown.buildings[tbIdx].type + ' up for sale in declining ' + checkTown.name + '.';
                                var _decDet = {
                                    type: 'elite_decline_sale',
                                    cause: 'Population exodus from ' + checkTown.name + ' signals declining property values.',
                                    effects: [
                                        em.firstName + ' liquidates assets before further decline',
                                        'Building listed for sale in ' + checkTown.name
                                    ]
                                ,
                                _noToast: true};
                                if (_isPlayerRelevantTown(checkTown.id)) {
                                    logEvent(_decMsg, _decDet, 'npc_activity');
                                } else {
                                    logHiddenEvent(_decMsg, _decDet, 'npc_activity');
                                }
                                break;
                            }
                        }
                        break;
                    }
                }
            }
        }

        // Track market scarcity: if a good is scarce somewhere, consider trading it there
        if (em.npcMerchantInventory) {
            for (var invRes in em.npcMerchantInventory) {
                if ((em.npcMerchantInventory[invRes] || 0) <= 2) continue;
                // Find towns where this good is very expensive (scarce)
                for (var stIdx = 0; stIdx < world.towns.length; stIdx++) {
                    var scarceTown = world.towns[stIdx];
                    if (!scarceTown.market || scarceTown.id === em.townId) continue;
                    var scarcePrice = scarceTown.market.prices[invRes] || 0;
                    var localPrice = town.market ? (town.market.prices[invRes] || 0) : 0;
                    var invRes2 = findResourceById(invRes);
                    if (invRes2 && scarcePrice > invRes2.basePrice * 2.0 && scarcePrice > localPrice * 1.5) {
                        // This good is scarce there — flag for travel AI
                        if (!em._kingdomAwareness) em._kingdomAwareness = {};
                        em._kingdomAwareness.scarcityTarget = { townId: scarceTown.id, good: invRes, price: scarcePrice };
                        break;
                    }
                }
            }
        }
    }

    // ---- SUPPLY CHAIN AI: Understand production chains, secure inputs ----
    function eliteSupplyChainAI(em, town, rng, strategy) {
        // Requires at least basic market awareness
        if (!emHasSkill(em, 'keen_eye')) return;
        if (!em.buildings || em.buildings.length === 0) return;
        var preferredBuildings = STRATEGY_BUILDINGS[strategy] || STRATEGY_BUILDINGS.diversified;

        // Map of intermediate inputs needed by our buildings
        var inputNeeds = {};
        for (var bIdx2 = 0; bIdx2 < em.buildings.length; bIdx2++) {
            var ownedBld = em.buildings[bIdx2];
            var ownedBt = findBuildingType(ownedBld.type);
            if (!ownedBt) continue;
            // Check if building consumes inputs (fixed: was checking .inputs which doesn't exist)
            if (ownedBt.consumes) {
                for (var inputId in ownedBt.consumes) {
                    inputNeeds[inputId] = (inputNeeds[inputId] || 0) + (ownedBt.consumes[inputId] || 1);
                }
            }
            // Check availableProducts for current production choice
            if (ownedBt.availableProducts) {
                var currentProd = ownedBld.currentProduct || ownedBld.productionChoice;
                var recipe = currentProd ? ownedBt.availableProducts[currentProd] : null;
                if (recipe && recipe.consumes) {
                    for (var rInputId in recipe.consumes) {
                        inputNeeds[rInputId] = (inputNeeds[rInputId] || 0) + (recipe.consumes[rInputId] || 1);
                    }
                }
            }
        }

        // Do we own buildings that produce our inputs? If not, consider building one.
        for (var needId in inputNeeds) {
            var ownsProducer = em.buildings.some(function(b) {
                var bt2 = findBuildingType(b.type);
                return bt2 && bt2.produces === needId;
            });
            if (ownsProducer) continue;

            // Find what building produces this input
            var producerType = null;
            for (var pbi = 0; pbi < preferredBuildings.length; pbi++) {
                var pbt = findBuildingType(preferredBuildings[pbi]);
                if (pbt && pbt.produces === needId) {
                    producerType = preferredBuildings[pbi];
                    break;
                }
            }

            // If not in preferred, search all building types
            if (!producerType) {
                if (typeof BUILDING_TYPES !== 'undefined') {
                    for (var btKey in BUILDING_TYPES) {
                        var btCheck = BUILDING_TYPES[btKey];
                        if (btCheck && btCheck.produces === needId) {
                            producerType = btKey;
                            break;
                        }
                    }
                }
            }

            if (producerType && rng.chance(0.2)) {
                var pBt = findBuildingType(producerType);
                if (!pBt || em.gold < pBt.cost) continue;
                // Check building limits
                var maxR3 = 0;
                for (var rkId3 in em.socialRank) { if ((em.socialRank[rkId3] || 0) > maxR3) maxR3 = em.socialRank[rkId3]; }
                var rDef3 = CONFIG.SOCIAL_RANKS[maxR3] || CONFIG.SOCIAL_RANKS[0];
                if ((em.buildings || []).length >= (rDef3.maxBuildings || 2)) continue;
                // Check town slots
                var maxSlots2 = CONFIG.TOWN_CATEGORIES[town.category] ? CONFIG.TOWN_CATEGORIES[town.category].maxBuildingSlots : 10;
                if (town.buildings.length >= maxSlots2) continue;

                em.gold -= pBt.cost;
                var chainBld = { type: producerType, level: 1, ownerId: em.id, townId: town.id, workers: [], upgrades: [], builtDay: world.day };
                town.buildings.push(chainBld);
                em.buildings.push({ type: producerType, townId: town.id, level: 1 });
                logEvent(em.firstName + ' ' + (em.lastName || '') + ' builds a ' + pBt.name + ' to secure ' + needId + ' supply chain.',  {
                    type: 'elite_supply_chain',
                    cause: em.firstName + ' vertically integrates to secure raw material supply.',
                    effects: [
                        'New ' + pBt.name + ' secures ' + needId + ' production',
                        em.firstName + ' invested ' + pBt.cost + 'g in supply chain',
                        'Reduced dependency on external suppliers'
                    ]
                ,
                _noToast: true}, 'npc_activity');
                break; // One supply chain investment per cycle
            }
        }

        // Buy building inputs from market if town supply is low (skill-gated visibility)
        if (town.market && Object.keys(inputNeeds).length > 0 && (em.gold || 0) > 50) {
            var scCap = getEmStorageCapacity(em);
            var scUsed = getEmCurrentInventory(em.npcMerchantInventory || {});
            for (var scNeedId in inputNeeds) {
                if (scUsed >= scCap) break;
                var scTownSupply = town.market.supply[scNeedId] || 0;
                var scNeeded = inputNeeds[scNeedId] || 1;
                var scInv = (em.npcMerchantInventory || {})[scNeedId] || 0;
                // Only buy if we don't have enough and there's supply
                if (scInv >= scNeeded * 3) continue;
                // keen_eye = see own town market; market_scout = connected towns too
                if (scTownSupply >= 3) {
                    var scPrice = town.market.prices[scNeedId] || 999;
                    var scRes = findResourceById(scNeedId);
                    if (!scRes || scPrice > scRes.basePrice * 2.0) continue;
                    var scBuyQty = Math.min(scNeeded * 2, Math.floor(scTownSupply * 0.3), scCap - scUsed, Math.floor(em.gold * 0.1 / scPrice));
                    if (scBuyQty > 0 && em.gold >= scPrice * scBuyQty) {
                        em.gold -= Math.floor(scPrice * scBuyQty);
                        if (!em.npcMerchantInventory) em.npcMerchantInventory = {};
                        em.npcMerchantInventory[scNeedId] = (em.npcMerchantInventory[scNeedId] || 0) + scBuyQty;
                        town.market.supply[scNeedId] -= scBuyQty;
                        scUsed += scBuyQty;
                        collectTradeTax(town.kingdomId, Math.floor(scPrice * scBuyQty), scNeedId);
                    }
                } else if (emHasSkill(em, 'market_scout') && scTownSupply < scNeeded) {
                    // Check connected towns for input materials
                    var connRoads = town.roads || [];
                    for (var scri = 0; scri < connRoads.length && scri < 3; scri++) {
                        var scConnTown = findTown(connRoads[scri]);
                        if (!scConnTown || !scConnTown.market) continue;
                        var scConnSupply = scConnTown.market.supply[scNeedId] || 0;
                        if (scConnSupply < 5) continue;
                        var scConnPrice = scConnTown.market.prices[scNeedId] || 999;
                        if (scConnPrice > (findResourceById(scNeedId) || {}).basePrice * 1.5) continue;
                        // Flag this as a travel target for the EM
                        if (!em._supplyChainTargets) em._supplyChainTargets = {};
                        em._supplyChainTargets[scNeedId] = scConnTown.id;
                        break;
                    }
                }
            }
        }

        // ── Enhanced: Dispatch caravans for scarce inputs ──
        if (emHasSkill(em, 'supply_chain_expert') && em._supplyChainTargets && (em.gold || 0) > 300) {
            for (var scTarget in em._supplyChainTargets) {
                var scTargetTownId = em._supplyChainTargets[scTarget];
                // Check if we already have a caravan going there
                var hasCaravan = (world.npcCaravans || []).some(function(c) {
                    return c.ownerId === em.id && c.toTownId === scTargetTownId && !c.completed;
                });
                if (hasCaravan) continue;
                var scTargetTown = findTown(scTargetTownId);
                if (!scTargetTown || !scTargetTown.market) continue;
                var scTargetSupply = scTargetTown.market.supply[scTarget] || 0;
                if (scTargetSupply < 5) continue;
                var scTargetPrice = scTargetTown.market.prices[scTarget] || 5;
                var scCaravanQty = Math.min(scTargetSupply - 2, 20, Math.floor(em.gold * 0.15 / scTargetPrice));
                if (scCaravanQty < 3) continue;
                var scCaravanCost = Math.floor(scTargetPrice * scCaravanQty + 50); // goods + carrier fee
                if (em.gold < scCaravanCost) continue;
                em.gold -= scCaravanCost;
                if (!world.npcCaravans) world.npcCaravans = [];
                world.npcCaravans.push({
                    id: 'em_sc_' + em.id + '_' + world.day,
                    ownerId: em.id,
                    fromTownId: scTargetTownId,
                    toTownId: town.id,
                    goods: [{ id: scTarget, qty: scCaravanQty }],
                    carriers: 2,
                    progress: 0,
                    startDay: world.day,
                    completed: false,
                    isSupplyChain: true
                });
                scTargetTown.market.supply[scTarget] -= scCaravanQty;
                delete em._supplyChainTargets[scTarget];
                logEvent('📦 ' + em.firstName + ' dispatches a caravan from ' + scTargetTown.name + ' to import ' + scCaravanQty + ' ' + scTarget + '.',
                    { type: 'elite_supply_caravan' }, 'npc_activity');
                break; // one supply caravan per cycle
            }
        }

        // Check for supply gaps in current town (town needs something but has no producer)
        if (town.market && rng.chance(0.1)) {
            // ── Enhanced: Multi-town gap analysis for market_scout EMs ──
            var gapCheckTowns = [town];
            if (emHasSkill(em, 'market_scout') && town.connectedTowns) {
                for (var gcti = 0; gcti < Math.min(town.connectedTowns.length, 4); gcti++) {
                    var gcTown = findTown(town.connectedTowns[gcti]);
                    if (gcTown && gcTown.market && gcTown.kingdomId === town.kingdomId) gapCheckTowns.push(gcTown);
                }
            }
            for (var gcIdx = 0; gcIdx < gapCheckTowns.length; gcIdx++) {
                var gapTown = gapCheckTowns[gcIdx];
                if (!gapTown.market) continue;
            for (var gapRes in gapTown.market.demand) {
                var gapDemand = gapTown.market.demand[gapRes] || 0;
                var gapSupply = gapTown.market.supply[gapRes] || 0;
                if (gapDemand <= 0 || gapSupply >= gapDemand * 0.5) continue;
                // No local producer
                var hasLocalProducer = gapTown.buildings.some(function(b) {
                    var bt3 = findBuildingType(b.type);
                    return bt3 && bt3.produces === gapRes;
                });
                if (hasLocalProducer) continue;
                // Check building limits
                var maxR4 = 0;
                for (var rkId4 in em.socialRank) { if ((em.socialRank[rkId4] || 0) > maxR4) maxR4 = em.socialRank[rkId4]; }
                var rDef4 = CONFIG.SOCIAL_RANKS[maxR4] || CONFIG.SOCIAL_RANKS[0];
                if ((em.buildings || []).length >= (rDef4.maxBuildings || 2)) break;

                // Find building that produces it
                var gapProducer = null;
                if (typeof BUILDING_TYPES !== 'undefined') {
                    for (var gbtKey in BUILDING_TYPES) {
                        var gbtCheck = BUILDING_TYPES[gbtKey];
                        if (gbtCheck && gbtCheck.produces === gapRes) {
                            gapProducer = gbtKey;
                            break;
                        }
                    }
                }
                if (gapProducer) {
                    var gapBt = findBuildingType(gapProducer);
                    if (gapBt && em.gold >= gapBt.cost) {
                        var maxSlots3 = CONFIG.TOWN_CATEGORIES[gapTown.category] ? CONFIG.TOWN_CATEGORIES[gapTown.category].maxBuildingSlots : 10;
                        if (gapTown.buildings.length < maxSlots3) {
                            em.gold -= gapBt.cost;
                            var gapBld = { type: gapProducer, level: 1, ownerId: em.id, townId: gapTown.id, workers: [], upgrades: [], builtDay: world.day };
                            gapTown.buildings.push(gapBld);
                            em.buildings.push({ type: gapProducer, townId: gapTown.id, level: 1 });
                            logEvent(em.firstName + ' ' + (em.lastName || '') + ' identifies supply gap: builds ' + gapBt.name + ' in ' + gapTown.name + '.',  {
                                type: 'elite_supply_gap',
                                cause: gapTown.name + ' lacks local production of ' + gapRes + ' despite high demand.',
                                effects: [
                                    'New ' + gapBt.name + ' fills supply gap',
                                    em.firstName + ' invested ' + gapBt.cost + 'g to fill market need',
                                    'Town should see lower ' + gapRes + ' prices'
                                ]
                            ,
                            _noToast: true}, 'npc_activity');
                            break;
                        }
                    }
                }
            }
            }
        }
    }

    /**
     * EM medical facility supply AI: EMs that own hospitals/clinics
     * proactively source medical supplies their facilities need.
     */
    function eliteMedicalSupplyAI(em, town, rng) {
        if (!em.buildings || em.buildings.length === 0) return;
        var medGoods = ['bandages', 'herbal_remedy', 'healing_tonic', 'herbal_poultice', 'fever_tonic', 'antidote', 'splint'];

        for (var mbi = 0; mbi < em.buildings.length; mbi++) {
            var emBld = em.buildings[mbi];
            if (emBld.type !== 'hospital' && emBld.type !== 'clinic') continue;
            // Find the actual town building
            var bldTown = findTown(emBld.townId);
            if (!bldTown) continue;
            var actualBld = null;
            for (var abi = 0; abi < bldTown.buildings.length; abi++) {
                if (bldTown.buildings[abi].ownerId === em.id &&
                    (bldTown.buildings[abi].type === 'hospital' || bldTown.buildings[abi].type === 'clinic')) {
                    actualBld = bldTown.buildings[abi]; break;
                }
            }
            if (!actualBld) continue;
            if (!actualBld._medicalStock) actualBld._medicalStock = {};

            // Assess what's needed based on treatment supply config
            var treatSupplies = NPC_HEALTH_CONFIG.TREATMENT_SUPPLIES || {};
            var neededGoods = {};
            for (var sev in treatSupplies) {
                for (var res in treatSupplies[sev]) {
                    neededGoods[res] = (neededGoods[res] || 0) + treatSupplies[sev][res];
                }
            }

            // Check stock levels and buy what's low
            for (var ngi = 0; ngi < medGoods.length; ngi++) {
                var mgId = medGoods[ngi];
                var currentStock = actualBld._medicalStock[mgId] || 0;
                var targetStock = Math.max(5, (neededGoods[mgId] || 1) * 3);
                if (currentStock >= targetStock) continue;

                var deficit = targetStock - currentStock;
                // Try local market first
                var localAvail = (bldTown.market && bldTown.market.supply[mgId]) || 0;
                if (localAvail > 0 && (em.gold || 0) > 20) {
                    var toBuy = Math.min(deficit, localAvail, Math.floor(em.gold * 0.05 / (getMarketPrice(bldTown, mgId) || 5)));
                    if (toBuy > 0) {
                        var cost = toBuy * (getMarketPrice(bldTown, mgId) || 5);
                        if (em.gold >= cost) {
                            em.gold -= cost;
                            consumeFromMarket(bldTown, mgId, toBuy);
                            actualBld._medicalStock[mgId] = currentStock + toBuy;
                        }
                    }
                } else if (emHasSkill(em, 'market_scout') && bldTown.connectedTowns) {
                    // Check connected towns for medical supplies
                    for (var cmi = 0; cmi < Math.min(bldTown.connectedTowns.length, 3); cmi++) {
                        var connMedTown = findTown(bldTown.connectedTowns[cmi]);
                        if (!connMedTown || !connMedTown.market) continue;
                        var connAvail = connMedTown.market.supply[mgId] || 0;
                        if (connAvail < 3) continue;
                        // Dispatch supply caravan
                        if ((em.gold || 0) < 100) break;
                        var caravanQty = Math.min(deficit, connAvail - 1, 15);
                        if (caravanQty < 2) continue;
                        var caravanCost = caravanQty * (getMarketPrice(connMedTown, mgId) || 5) + 30;
                        if (em.gold < caravanCost) continue;
                        em.gold -= caravanCost;
                        connMedTown.market.supply[mgId] -= caravanQty;
                        // Deliver directly to medical stock (simplified — no travel delay for EM)
                        actualBld._medicalStock[mgId] = (actualBld._medicalStock[mgId] || 0) + caravanQty;
                        collectTradeTax(connMedTown.kingdomId, caravanQty * (getMarketPrice(connMedTown, mgId) || 5), mgId);
                        break;
                    }
                }
            }
        }
    }

    // ---- COMPETITION AI: Track and respond to competitor behavior ----
    function eliteCompetitionAI(em, town, rng, strategy, personality) {
        var elites = world.people.filter(function(p) {
            return p.alive && p.isEliteMerchant && p.id !== em.id;
        });
        if (elites.length === 0) return;

        var preferredGoods = STRATEGY_GOODS[strategy] || STRATEGY_GOODS.diversified;

        // Track competitors in same town
        var localCompetitors = elites.filter(function(e) { return e.townId === em.townId; });
        em._competitorTracking = em._competitorTracking || {};

        for (var ci = 0; ci < localCompetitors.length; ci++) {
            var competitor = localCompetitors[ci];
            em._competitorTracking[competitor.id] = {
                strategy: competitor.strategy || 'diversified',
                gold: competitor.gold || 0,
                buildings: competitor.buildings ? competitor.buildings.length : 0,
                lastSeen: world.day
            };
        }

        // Check if another elite merchant is cornering a market (hoarding a good)
        for (var ei = 0; ei < elites.length; ei++) {
            var rival = elites[ei];
            if (rival.townId !== em.townId) continue;
            var rivalInv = rival.npcMerchantInventory || {};
            for (var rGood in rivalInv) {
                if ((rivalInv[rGood] || 0) < 20) continue; // Not cornering
                // Rival has a lot of this good — consider undercutting
                if (preferredGoods.indexOf(rGood) >= 0 && (em.npcMerchantInventory[rGood] || 0) > 0) {
                    var undercutChance = 0.3;
                    if (em._rivalUndercutTarget && em._rivalUndercutTarget === rival.id) undercutChance = Math.min(0.95, undercutChance * 1.3);
                    // Sell some of this good to undercut the rival
                    if (town.market && rng.chance(undercutChance)) {
                        var underQty = Math.min(em.npcMerchantInventory[rGood] || 0, rng.randInt(2, 5));
                        var underPrice = Math.floor((town.market.prices[rGood] || 10) * 0.85); // 15% below market
                        if (underQty > 0 && underPrice > 0) {
                            em.gold += underPrice * underQty;
                            em.npcMerchantInventory[rGood] -= underQty;
                            town.market.supply[rGood] = (town.market.supply[rGood] || 0) + underQty;
                            // v9p33river377: elite-merchant maneuvers should stay in NPC Activity even when toast-suppressed.
                            logEvent(em.firstName + ' ' + (em.lastName || '') + ' undercuts ' + rival.firstName + '\'s ' + rGood + ' monopoly.', {
                                type: 'elite_market_competition', townId: town.id,
                                cause: rival.firstName + ' was hoarding ' + rGood + '; ' + em.firstName + ' floods the market.',
                                effects: [
                                    em.firstName + ' sells ' + underQty + ' ' + rGood + ' at discount',
                                    'Market price pressure on ' + rGood,
                                    'Competition intensifies between elite merchants'
                                ],
                                _noToast: true
                            }, 'npc_activity');
                        }
                    }
                }
            }
        }

        // Diversification: don't invest in same goods/buildings as nearby competitors
        if (rng.chance(0.15) && personality.risk_tolerance > 50) {
            var competitorStrategies = {};
            for (var ci2 = 0; ci2 < localCompetitors.length; ci2++) {
                var cStrat = localCompetitors[ci2].strategy || 'diversified';
                competitorStrategies[cStrat] = (competitorStrategies[cStrat] || 0) + 1;
            }
            // If 2+ competitors share our strategy, consider switching
            if ((competitorStrategies[strategy] || 0) >= 2) {
                var altStrategies = ELITE_STRATEGIES.filter(function(s) { return s !== strategy && !(competitorStrategies[s] > 1); });
                if (altStrategies.length > 0 && rng.chance(0.1)) {
                    var oldStrategy = em.strategy;
                    em.strategy = rng.pick(altStrategies);
                    logEvent(em.firstName + ' ' + (em.lastName || '') + ' pivots strategy from ' + oldStrategy + ' to ' + em.strategy + ' to avoid competition.',  {
                        type: 'elite_strategy_pivot',
                        cause: 'Too many competitors pursuing ' + oldStrategy + ' strategy.',
                        effects: [
                            em.firstName + ' diversifies into ' + em.strategy + ' goods',
                            'New trading patterns and building priorities',
                            'Reduced direct competition with rival merchants'
                        ]
                    }, 'npc_activity');
                }
            }
        }

        // Supply buyout: aggressive EMs buy up cheap goods before competitors can
        if ((personality.greed || 50) > 60 && (em.gold || 0) > 500 && town.market && localCompetitors.length > 0) {
            var storeCap = getEmStorageCapacity(em);
            var storeUsed = getEmCurrentInventory(em.npcMerchantInventory || {});
            if (storeUsed < storeCap * 0.8) {
                for (var sbi = 0; sbi < preferredGoods.length && sbi < 2; sbi++) {
                    var sbGood = preferredGoods[sbi];
                    var sbSupply = town.market.supply[sbGood] || 0;
                    var sbPrice = town.market.prices[sbGood] || 999;
                    var sbRes = findResourceById(sbGood);
                    if (!sbRes || sbSupply < 10) continue;
                    // Buy up to 30% of supply to corner the market
                    if (sbPrice < sbRes.basePrice * 1.1 && rng.chance(0.25)) {
                        var sbQty = Math.min(Math.floor(sbSupply * 0.3), storeCap - storeUsed, Math.floor(em.gold * 0.2 / sbPrice));
                        if (sbQty > 2) {
                            em.gold -= Math.floor(sbPrice * sbQty);
                            em.npcMerchantInventory[sbGood] = (em.npcMerchantInventory[sbGood] || 0) + sbQty;
                            town.market.supply[sbGood] -= sbQty;
                            storeUsed += sbQty;
                            collectTradeTax(town.kingdomId, Math.floor(sbPrice * sbQty), sbGood);
                        }
                    }
                }
            }
        }

        // Territorial response: if a competitor builds in our town, accelerate our own building
        if (localCompetitors.length > 0 && (personality.ambition || 50) > 50 && em.buildings) {
            var localCompBlds = 0;
            for (var tci = 0; tci < localCompetitors.length; tci++) {
                var tcBlds = localCompetitors[tci].buildings || [];
                for (var tcbi = 0; tcbi < tcBlds.length; tcbi++) {
                    if (tcBlds[tcbi].townId === town.id) localCompBlds++;
                }
            }
            var myLocalBlds = 0;
            for (var mbi = 0; mbi < em.buildings.length; mbi++) {
                if (em.buildings[mbi].townId === town.id) myLocalBlds++;
            }
            // If competitors have more buildings here than us, mark for urgent building
            if (localCompBlds > myLocalBlds && rng.chance(0.3)) {
                em._urgentBuild = true;
            }
        }

        // Price war: if losing market share, dump excess goods at a loss to drive competitors out
        if ((personality.risk_tolerance || 50) > 65 && (em.gold || 0) > 2000 && localCompetitors.length > 1) {
            var emInv = em.npcMerchantInventory || {};
            for (var pwGood in emInv) {
                if ((emInv[pwGood] || 0) < 8) continue;
                // Check if competitors also hold this good
                var competitorsHolding = 0;
                for (var pwci = 0; pwci < localCompetitors.length; pwci++) {
                    if (((localCompetitors[pwci].npcMerchantInventory || {})[pwGood] || 0) > 5) {
                        competitorsHolding++;
                    }
                }
                if (competitorsHolding >= 2 && rng.chance(0.15)) {
                    var dumpQty = Math.min(emInv[pwGood], rng.randInt(3, 8));
                    var dumpPrice = Math.floor((town.market.prices[pwGood] || 10) * 0.7);
                    if (dumpQty > 0 && dumpPrice > 0) {
                        em.gold += dumpPrice * dumpQty;
                        emInv[pwGood] -= dumpQty;
                        town.market.supply[pwGood] = (town.market.supply[pwGood] || 0) + dumpQty;
                        logEvent(em.firstName + ' ' + (em.lastName || '') + ' dumps ' + dumpQty + ' ' + pwGood + ' to undercut competitors.',  {
                            type: 'elite_price_war',
                            cause: 'Multiple competitors stockpiling ' + pwGood + ' in ' + (town.name || 'town'),
                            effects: [pwGood + ' prices collapse in ' + (town.name || 'town'), 'Competitors forced to sell at lower margins']
                        }, 'npc_activity');
                        break;
                    }
                }
            }
        }
    }

    // ---- NATIONALIZATION RESPONSE: Pivot away from nationalized industries ----
    function eliteNationalizationAI(em, town, rng, strategy) {
        var kingdom = findKingdom(em.kingdomId);
        if (!kingdom || !kingdom.nationalizedIndustries || kingdom.nationalizedIndustries.length === 0) return;

        var preferredBuildings = STRATEGY_BUILDINGS[strategy] || STRATEGY_BUILDINGS.diversified;

        // Check if any of our buildings are in a nationalized industry
        var affectedBuildings = [];
        if (em.buildings) {
            for (var bi2 = 0; bi2 < em.buildings.length; bi2++) {
                if (kingdom.nationalizedIndustries.indexOf(em.buildings[bi2].type) >= 0) {
                    affectedBuildings.push(em.buildings[bi2]);
                }
            }
        }

        if (affectedBuildings.length === 0) return;

        // React to nationalization
        if (!em._nationalizedPivot) {
            em._nationalizedPivot = true;
            // Reputation drops with this kingdom
            em.reputation[kingdom.id] = Math.max(0, (em.reputation[kingdom.id] || 50) - 15);
            em._kingRelationship[kingdom.id] = (em._kingRelationship[kingdom.id] || 0) - 20;

            // Sell nationalized buildings (mark for sale)
            for (var abi = 0; abi < affectedBuildings.length; abi++) {
                var affBld = affectedBuildings[abi];
                var affTown = findTown(affBld.townId);
                if (affTown) {
                    for (var tbIdx2 = 0; tbIdx2 < affTown.buildings.length; tbIdx2++) {
                        if (affTown.buildings[tbIdx2].ownerId === em.id && affTown.buildings[tbIdx2].type === affBld.type) {
                            affTown.buildings[tbIdx2].forSale = true;
                            break;
                        }
                    }
                }
            }

            // Consider pivoting to a different strategy if many buildings affected
            if (affectedBuildings.length >= 2 || rng.chance(0.5)) {
                var safeStrategies = ELITE_STRATEGIES.filter(function(s) {
                    var sBlds = STRATEGY_BUILDINGS[s] || [];
                    return !sBlds.some(function(bt) { return kingdom.nationalizedIndustries.indexOf(bt) >= 0; });
                });
                if (safeStrategies.length > 0) {
                    var oldStrat = em.strategy;
                    em.strategy = rng.pick(safeStrategies);
                    logEvent(em.firstName + ' ' + (em.lastName || '') + ' pivots from ' + oldStrat + ' after ' + kingdom.name + ' nationalizes their industry.',  {
                        type: 'elite_nationalization_pivot',
                        cause: kingdom.name + ' nationalized ' + affectedBuildings[0].type + ', forcing ' + em.firstName + ' to adapt.',
                        effects: [
                            em.firstName + ' abandons ' + oldStrat + ' strategy',
                            'Pivoting to ' + em.strategy + ' to avoid nationalized sectors',
                            'Buildings marked for sale',
                            'Relationship with ' + kingdom.name + ' damaged'
                        ]
                    }, 'npc_activity');
                }
            }

            // Consider relocating to a kingdom without nationalization
            if (rng.chance(0.3)) {
                var freeKingdoms = world.kingdoms.filter(function(k) {
                    return k.id !== kingdom.id && (!k.nationalizedIndustries || k.nationalizedIndustries.length === 0) && k.gold > 500;
                });
                if (freeKingdoms.length > 0) {
                    var freeK = freeKingdoms[rng.randInt(0, freeKingdoms.length - 1)];
                    var freeTowns = world.towns.filter(function(t) { return t.kingdomId === freeK.id && !t.isFrontline; });
                    if (freeTowns.length > 0) {
                        var freeDest = freeTowns.sort(function(a, b) { return (b.prosperity || 0) - (a.prosperity || 0); })[0];
                        // Fix population bookkeeping
                        var oldNatTown = findTown(em.townId);
                        if (oldNatTown && oldNatTown.population > 0) oldNatTown.population--;
                        freeDest.population = (freeDest.population || 0) + 1;
                        em.townId = freeDest.id;
                        em.kingdomId = freeDest.kingdomId;
                        if (Engine.moveYoungChildrenWithParent) Engine.moveYoungChildrenWithParent(em, freeDest.id, freeDest.kingdomId);
                        logEvent(em.firstName + ' ' + (em.lastName || '') + ' relocates to ' + freeDest.name + ' in ' + freeK.name + ' to escape nationalization.',  {
                            type: 'elite_nationalization_flee',
                            cause: 'Nationalization policies in ' + kingdom.name + ' threaten ' + em.firstName + '\'s business.',
                            effects: [
                                em.firstName + ' relocates to free-market ' + freeK.name,
                                'Business operations resume in ' + freeDest.name,
                                'Capital flight from ' + kingdom.name
                            ]
                        }, 'npc_activity');
                    }
                }
            }
        }
    }

    // ---- KINGDOM RELATIONSHIP AI: Build king relationships, react to seizure ----
    function eliteKingdomRelationshipAI(em, town, rng, personality) {
        var kingdom = findKingdom(em.kingdomId);
        if (!kingdom) return;
        if (!em._kingRelationship) em._kingRelationship = {};
        var kId = kingdom.id;
        var rel = em._kingRelationship[kId] || 0;

        // Build relationship through bounty fulfillment
        if ((em._bountiesFulfilled || 0) > 0) {
            rel += em._bountiesFulfilled * 3;
            em._bountiesFulfilled = 0;
        }

        // Build relationship through tax compliance (wealthy merchants paying high taxes)
        if ((em.gold || 0) > 1000 && (kingdom.incomeTaxRate || 0.05) > 0) {
            rel += 1; // Passive loyalty from being a good taxpayer
        }

        // Damage from crime
        if (em.criminalRecord && (em.criminalRecord[kId] || 0) > 0) {
            rel -= em.criminalRecord[kId] * 5;
        }

        // React to having been a seizure victim
        if (em._seizureVictim) {
            rel -= 30;
            em._seizureVictim = false;
            // May relocate to a different kingdom
            if (rng.chance(0.4) && personality.loyalty < 60) {
                var betterKingdoms = world.kingdoms.filter(function(k) {
                    var kp2 = k.kingPersonality || {};
                    return k.id !== kId && kp2.greed !== 'corrupt' && kp2.greed !== 'greedy' && k.gold > 1000;
                });
                if (betterKingdoms.length > 0) {
                    var betterK = betterKingdoms[rng.randInt(0, betterKingdoms.length - 1)];
                    var destTowns = world.towns.filter(function(t) { return t.kingdomId === betterK.id && !t.isFrontline; });
                    if (destTowns.length > 0) {
                        var dest = destTowns.sort(function(a, b) { return (b.prosperity || 0) - (a.prosperity || 0); })[0];
                        em.townId = dest.id;
                        em.kingdomId = dest.kingdomId;
                        if (Engine.moveYoungChildrenWithParent) Engine.moveYoungChildrenWithParent(em, dest.id, dest.kingdomId);
                        logEvent(em.firstName + ' ' + (em.lastName || '') + ' abandons ' + kingdom.name + ' after royal seizure, relocating to ' + betterK.name + '.',  {
                            type: 'elite_seizure_response',
                            cause: 'Royal confiscation destroyed trust between ' + em.firstName + ' and ' + kingdom.name + '.',
                            effects: [
                                em.firstName + ' relocates to ' + dest.name + ' in ' + betterK.name,
                                'Major capital flight from ' + kingdom.name,
                                'Elite merchant loyalty to crown shattered'
                            ]
                        }, 'npc_activity');
                    }
                }
            }
        }

        // Wealthy merchants attempt to bribe king for favorable policies
        if (rel > 20 && (em.gold || 0) > 3000 && personality.ambition > 60 && rng.chance(0.1)) {
            var bribeAmount = Math.floor(em.gold * 0.05);
            em.gold -= bribeAmount;
            kingdom.gold += bribeAmount;
            rel += 10;
            em.reputation[kId] = Math.min(100, (em.reputation[kId] || 50) + 5);
            logEvent(em.firstName + ' ' + (em.lastName || '') + ' makes a ' + bribeAmount + 'g "gift" to the crown of ' + kingdom.name + '.', {
                type: 'elite_king_gift', kingdomId: kingdom.id,
                cause: em.firstName + ' cultivates royal favor through generous donations.',
                effects: [
                    bribeAmount + 'g donated to ' + kingdom.name + '\'s treasury',
                    'Royal relationship strengthened',
                    em.firstName + '\'s influence at court grows'
                ],
                _noToast: true
            }, 'npc_activity');
        }

        // Petition for trade subsidies on goods we produce (requires social rank 2+ and good relationship)
        var emRank = em.socialRank[kId] || 0;
        if (emRank >= 2 && rel > 10 && (em.gold || 0) > 1000 && (personality.ambition || 50) > 40 && rng.chance(0.15)) {
            // Find a good we produce that doesn't have an active subsidy
            var emProduces = [];
            if (em.buildings) {
                for (var epbi = 0; epbi < em.buildings.length; epbi++) {
                    var epBt = findBuildingType(em.buildings[epbi].type);
                    if (epBt && epBt.produces && emProduces.indexOf(epBt.produces) < 0) {
                        emProduces.push(epBt.produces);
                    }
                }
            }
            var existingSubGods = {};
            if (kingdom.tradeSubsidies) {
                for (var esi = 0; esi < kingdom.tradeSubsidies.length; esi++) {
                    if (kingdom.tradeSubsidies[esi].expiresDay > world.day) {
                        existingSubGods[kingdom.tradeSubsidies[esi].good] = true;
                    }
                }
            }
            for (var epi = 0; epi < emProduces.length; epi++) {
                var petGood = emProduces[epi];
                if (existingSubGods[petGood]) continue;
                // Petition fee scales with rank
                var petitionFee = Math.floor(50 + emRank * 100);
                if (em.gold < petitionFee) continue;
                // King decides based on their personality and kingdom needs
                var kp3 = kingdom.kingPersonality || {};
                var approvalChance = 0.15;
                if (kp3.generosity === 'generous' || kp3.tradePolicy === 'free_market') approvalChance += 0.15;
                if (kp3.greed === 'greedy' || kp3.greed === 'corrupt') approvalChance -= 0.10;
                if (rel > 40) approvalChance += 0.10;
                if (emRank >= 3) approvalChance += 0.10;
                em.gold -= petitionFee;
                kingdom.gold += petitionFee;
                if (rng.chance(Math.max(0.05, approvalChance))) {
                    if (!kingdom.tradeSubsidies) kingdom.tradeSubsidies = [];
                    kingdom.tradeSubsidies.push({
                        good: petGood,
                        bonusPerUnit: rng.randInt(2, 5),
                        expiresDay: world.day + rng.randInt(60, 180),
                        maxUnits: rng.randInt(50, 200),
                        unitsPaid: 0,
                        requestedBy: em.id
                    });
                    rel += 5;
                    // v9p33river377: keep elite-merchant court lobbying under NPC Activity instead of inferred local/world buckets.
                    logEvent(em.firstName + ' ' + (em.lastName || '') + ' persuades ' + kingdom.name + ' to subsidize ' + petGood + ' trade!', {
                        type: 'elite_petition_subsidy', kingdomId: kingdom.id,
                        cause: em.firstName + ' lobbied the crown for trade subsidies.',
                        effects: [petGood + ' trade subsidized in ' + kingdom.name, em.firstName + '\'s influence at court grows'],
                        _noToast: true
                    }, 'npc_activity');
                } else {
                    logEvent(em.firstName + ' ' + (em.lastName || '') + '\'s petition for ' + petGood + ' subsidies was denied by ' + kingdom.name + '.', {
                        type: 'elite_petition_denied', kingdomId: kingdom.id,
                        cause: em.firstName + ' lobbied the crown, but was rebuffed.',
                        effects: [petitionFee + 'g spent on failed petition'],
                        _noToast: true
                    }, 'npc_activity');
                }
                break; // one petition per cycle
            }
        }

        // Lobby against high tariffs (social EMs with good relationship)
        var _lobbyTariff = (kingdom.laws && kingdom.laws.tradeTariff) || 0;
        if (emRank >= 2 && rel > 15 && (personality.social || 50) > 55 && _lobbyTariff > 0.10 && rng.chance(0.1)) {
            var lobbyFee = Math.floor(100 + emRank * 150);
            if ((em.gold || 0) >= lobbyFee) {
                em.gold -= lobbyFee;
                kingdom.gold += lobbyFee;
                var kp4 = kingdom.kingPersonality || {};
                var tariffReduceChance = 0.2;
                if (kp4.tradePolicy === 'free_market') tariffReduceChance += 0.2;
                if (kp4.greed === 'miserly') tariffReduceChance -= 0.15;
                if (rel > 40) tariffReduceChance += 0.1;
                if (rng.chance(Math.max(0.05, tariffReduceChance))) {
                    var oldTariff = _lobbyTariff;
                    kingdom.laws.tradeTariff = Math.max(0.01, oldTariff - 0.02);
                    rel += 3;
                    logEvent(em.firstName + ' ' + (em.lastName || '') + ' successfully lobbies ' + kingdom.name + ' to reduce tariffs from ' + Math.round(oldTariff * 100) + '% to ' + Math.round(kingdom.laws.tradeTariff * 100) + '%.', {
                        type: 'elite_lobby_tariff', kingdomId: kingdom.id,
                        cause: em.firstName + ' uses court influence to push for trade reform.',
                        effects: ['Tariff reduced by 2%', 'All merchants benefit from lower trade costs'],
                        _noToast: true
                    }, 'npc_activity');
                }
            }
        }

        // Gift-giving for low-relationship EMs trying to get in good graces (more accessible than bribery)
        if (rel <= 10 && (em.gold || 0) > 500 && (personality.social || 50) > 40 && rng.chance(0.2)) {
            var giftAmount = Math.floor(Math.min(em.gold * 0.03, 200));
            if (giftAmount >= 20) {
                em.gold -= giftAmount;
                kingdom.gold += giftAmount;
                rel += Math.floor(giftAmount / 20);
                em.reputation[kId] = Math.min(100, (em.reputation[kId] || 50) + 2);
            }
        }

        // ── Enhanced Petition Types ──

        // Road construction petition (EMs want better trade routes)
        if (emRank >= 1 && rel > 5 && (em.gold || 0) > 500 && (personality.ambition || 50) > 30 && rng.chance(0.05)) {
            var emTown = findTown(em.townId);
            if (emTown) {
                var connectedTowns = world.roads.filter(function(r) { return r.fromTownId === emTown.id || r.toTownId === emTown.id; })
                    .map(function(r) { return r.fromTownId === emTown.id ? r.toTownId : r.fromTownId; });
                var unconnectedTowns = world.towns.filter(function(t) {
                    return t.id !== emTown.id && t.kingdomId === kId && connectedTowns.indexOf(t.id) < 0;
                });
                if (unconnectedTowns.length > 0) {
                    var targetTown = unconnectedTowns.sort(function(a, b) { return (b.prosperity || 0) - (a.prosperity || 0); })[0];
                    var roadPetFee = Math.floor(100 + emRank * 200);
                    if ((em.gold || 0) >= roadPetFee) {
                        em.gold -= roadPetFee;
                        kingdom.gold += roadPetFee;
                        if (!kingdom.petitions) kingdom.petitions = [];
                        var roadPetExists = kingdom.petitions.some(function(pe) {
                            return pe.type === 'build_road' && pe.fromTownId === emTown.id && pe.toTownId === targetTown.id;
                        });
                        if (!roadPetExists) {
                            kingdom.petitions.push({
                                type: 'build_road',
                                fromTownId: emTown.id,
                                toTownId: targetTown.id,
                                petitionerId: em.id,
                                signatures: rng.randInt(1, 3),
                                day: world.day,
                                status: 'pending'
                            });
                            logEvent('📜 ' + em.firstName + ' ' + (em.lastName || '') + ' petitions ' + kingdom.name + ' to build a road between ' +
                                emTown.name + ' and ' + targetTown.name + '.', { type: 'petition' }, 'npc_activity');
                        }
                    }
                }
            }
        }

        // Tax relief petition (EMs with many buildings want lower taxes)
        if (emRank >= 3 && rel > 20 && (em.buildings || []).length >= 5 && (kingdom.taxRate || 0) > 0.10 && rng.chance(0.06)) {
            var taxPetFee = Math.floor(200 + emRank * 200);
            if ((em.gold || 0) >= taxPetFee) {
                em.gold -= taxPetFee;
                kingdom.gold += taxPetFee;
                var kp5 = kingdom.kingPersonality || {};
                var taxRelief = 0.2;
                if (kp5.tradePolicy === 'free_market') taxRelief += 0.15;
                if (kp5.greed === 'greedy' || kp5.greed === 'corrupt') taxRelief -= 0.10;
                if (rel > 50) taxRelief += 0.10;
                if (rng.chance(Math.max(0.05, taxRelief))) {
                    var oldTax = kingdom.taxRate || 0;
                    kingdom.taxRate = Math.max(0.02, oldTax - 0.02);
                    logEvent('📜 ' + em.firstName + ' ' + (em.lastName || '') + ' secures a tax reduction in ' + kingdom.name +
                        ' (' + Math.round(oldTax * 100) + '% → ' + Math.round(kingdom.taxRate * 100) + '%).', {
                        type: 'elite_petition_tax', kingdomId: kingdom.id,
                        effects: ['Business taxes reduced', 'Economic growth encouraged'],
                        _noToast: true
                    }, 'npc_activity');
                } else {
                    logEvent(em.firstName + '\'s tax relief petition to ' + kingdom.name + ' was denied.', { type: 'elite_petition_denied', kingdomId: kingdom.id, _noToast: true }, 'npc_activity');
                }
            }
        }

        // Market building petition (EMs want marketplace in their town)
        if (emRank >= 2 && rel > 10 && (em.gold || 0) > 800 && rng.chance(0.04)) {
            var petTown = findTown(em.townId);
            if (petTown && !petTown.hasMarketplace) {
                var mktPetFee = Math.floor(150 + emRank * 100);
                em.gold -= mktPetFee;
                kingdom.gold += mktPetFee;
                if (!kingdom.petitions) kingdom.petitions = [];
                kingdom.petitions.push({
                    type: 'build_marketplace',
                    townId: em.townId,
                    petitionerId: em.id,
                    signatures: rng.randInt(2, 5),
                    day: world.day,
                    status: 'pending'
                });
                logEvent('📜 ' + em.firstName + ' ' + (em.lastName || '') + ' petitions ' + kingdom.name +
                    ' to build a marketplace in ' + petTown.name + '.', { type: 'petition' }, 'npc_activity');
            }
        }

        em._kingRelationship[kId] = Math.max(-100, Math.min(100, rel));
    }

    // ========================================================
    // Elite Merchant Bidding on Kingdom Orders
    // Lines 29233-29279 from engine.js
    // ========================================================
    // Elite merchant bidding on kingdom orders
    function tickEliteMerchantBidding() {
        _syncState();
        if (!world) return;
        if (world.day % 7 !== 0) return;
        const rng = world.rng;
        if (!rng) return;

        const eliteMerchants = world.people.filter(p => p.alive && p.isEliteMerchant && p.occupation === 'merchant');
        for (const em of eliteMerchants) {
            for (const k of world.kingdoms) {
                if (!k.procurement || !k.procurement.orders) continue;
                const openOrders = k.procurement.orders.filter(o => o.status === 'open');
                for (const order of openOrders) {
                    // Skip if already bid
                    if (order.bids.some(b => b.merchantId === em.id)) continue;
                    // Check if merchant has relevant inventory or production
                    const inv = em.npcMerchantInventory || {};
                    const hasGoods = (inv[order.resourceId] || 0) > 0;
                    const hasBuildings = em.buildings && em.buildings.some(b => {
                        const bt = findBuildingType(b.type);
                        return bt && bt.produces === order.resourceId;
                    });
                    if (!hasGoods && !hasBuildings && !rng.chance(0.3)) continue;

                    // Bid price based on personality
                    const res = findResourceById(order.resourceId);
                    const basePrice = res ? res.basePrice : 10;
                    const personality = em.personality || {};
                    let priceMult = 1.0;
                    if ((personality.greed || 0) > 65) priceMult = 1.1 + rng.random() * 0.1;
                    else if ((personality.ambition || 0) > 65) priceMult = 0.9 + rng.random() * 0.1;
                    else priceMult = 0.95 + rng.random() * 0.15;
                    const bidPrice = Math.ceil(basePrice * priceMult);
                    if (bidPrice > order.maxPricePerUnit) continue;

                    order.bids.push({
                        merchantId: em.id,
                        pricePerUnit: bidPrice,
                        merchantType: 'elite',
                        bidDay: world.day,
                        netWorth: em.netWorth || em.gold || 0,
                        reputation: (em.reputation && em.reputation[k.id]) || 50,
                    });
                }
            }
        }
    }

    // ========================================================
    // §19B NPC MERCHANT TICK
    // Lines 29281-29684 from engine.js
    // ========================================================
    // ========================================================
    // §19B  NPC MERCHANT TICK (lightweight)
    // ========================================================
    function tickNPCMerchants() {
        _syncState();
        if (!world) return;
        const rng = world.rng;
        if (!rng) return;
        // Only run every 3rd day for performance
        if (world.day % 3 !== 0) return;

        var _npcMerchAlive = (typeof Engine !== 'undefined' && Engine.getTickCache) ? (Engine.getTickCache().alivePeople || world.people) : world.people;
        for (var _nmi = 0; _nmi < _npcMerchAlive.length; _nmi++) {
            var p = _npcMerchAlive[_nmi];
            if (!p.alive || p.occupation !== 'merchant') continue;
            if (!p.npcMerchantInventory) continue;
            if (p.employerId) continue; // employed by player, skip
            if (p.npcMerchantCooldown > 0) { p.npcMerchantCooldown--; continue; }

            // NPC merchants returning home after travel
            if (!p.isEliteMerchant && p._returnHome && world.day >= (p._homeReturnDay || 0)) {
                p.traveling = true;
                p.travelProgress = 0;
                p.travelDestination = p.travelOriginTown;
                p.travelOriginTown = p.townId;
                p._returnHome = false;
                p._homeReturnDay = 0;
                continue;
            }

            // ── Merchant Travel Progress (elite and regular NPC) ──
            if (p.traveling) {
                // v9p33river58: off-sea EMs are slower than sea-route, off-road EMs slower than road.
                var progressRate;
                if (p.isEliteMerchant) {
                    if (p.travelOffSea) progressRate = 0.08;
                    else if (p.travelOffroad) progressRate = 0.07;
                    else progressRate = 0.15;
                } else {
                    progressRate = 0.05;
                }
                p.travelProgress = (p.travelProgress || 0) + progressRate;

                // ── EM Travel Encounters (bandits/pirates/soldiers) ──
                if (p.isEliteMerchant && rng.chance(0.08)) {
                    var emOriginTown = findTown(p.travelOriginTown || p.townId);
                    var emDestTown = findTown(p.travelDestination);
                    var encounterType = null;
                    var encounterChance = 0;

                    // Check road danger between origin and destination
                    if (emOriginTown && emDestTown) {
                        var emRoad = world.roads.find(function(r) {
                            return (r.fromTownId === emOriginTown.id && r.toTownId === emDestTown.id) ||
                                   (r.toTownId === emOriginTown.id && r.fromTownId === emDestTown.id);
                        });
                        var roadThreat = emRoad ? (emRoad.banditThreat || 0) : 0;

                        // Sea travel: pirates (covers sea route, off-sea, or recorded sea flag)
                        if (p.travelBySea || p.travelOffSea || (emRoad && emRoad.seaRoute)) {
                            encounterType = 'pirate';
                            encounterChance = p.travelOffSea ? 0.20 : 0.15; // open-water riskier
                        }
                        // War zone: soldiers
                        else if (emOriginTown.kingdomId !== emDestTown.kingdomId) {
                            var atWar = world.activeWars ? Object.values(world.activeWars).some(function(w) {
                                return w.active !== false &&
                                    ((w.kingdomA === emOriginTown.kingdomId && w.kingdomB === emDestTown.kingdomId) ||
                                     (w.kingdomA === emDestTown.kingdomId && w.kingdomB === emOriginTown.kingdomId));
                            }) : false;
                            if (atWar) {
                                encounterType = 'soldier';
                                encounterChance = 0.25;
                            } else if (roadThreat > 0) {
                                encounterType = 'bandit';
                                encounterChance = Math.min(0.35, roadThreat / 100);
                            }
                        }
                        // Normal road: bandits based on threat
                        else if (roadThreat > 0) {
                            encounterType = 'bandit';
                            encounterChance = Math.min(0.35, roadThreat / 100);
                        }
                        // Off-road: higher bandit chance
                        if (p.travelOffroad && !encounterType) {
                            encounterType = 'bandit';
                            encounterChance = 0.12;
                        }
                    }

                    if (encounterType && rng.chance(encounterChance)) {
                        // Resolve encounter based on EM skills and resources
                        var emCombatSkill = (p.skills && p.skills.combat) || 0;
                        var emGuardCount = 0;
                        if (p.guards && Array.isArray(p.guards)) emGuardCount = p.guards.length;
                        var emDefense = emCombatSkill * 2 + emGuardCount * 15;

                        // Skill bonuses
                        if (emHasSkill(p, 'combat_trained')) emDefense += 20;
                        if (emHasSkill(p, 'street_smart')) emDefense += 15;
                        if (emHasSkill(p, 'fortified_caravans')) emDefense += 25;
                        if (encounterType === 'pirate' && emHasSkill(p, 'fleet_admiral')) emDefense += 30;

                        var threatStrength = 20 + rng.randInt(0, 40);
                        if (encounterType === 'soldier') threatStrength += 20;

                        if (emDefense >= threatStrength) {
                            // Victory — EM fought off the encounter
                            logEvent('⚔️ ' + p.firstName + ' ' + (p.lastName || '') + ' fought off ' +
                                (encounterType === 'pirate' ? 'pirates' : encounterType === 'soldier' ? 'enemy soldiers' : 'bandits') +
                                ' while traveling.', { type: 'encounter' }, 'npc_activity');
                            grantEmXp(p, 5, 'combat');
                        } else {
                            // Defeat — lose gold and possibly goods
                            var goldLoss = Math.floor(p.gold * (0.05 + rng.random() * 0.15));
                            p.gold = Math.max(0, p.gold - goldLoss);
                            // Lose some inventory
                            if (p.npcMerchantInventory) {
                                for (var invKey in p.npcMerchantInventory) {
                                    if (p.npcMerchantInventory[invKey] > 0 && rng.chance(0.3)) {
                                        var lostQty = Math.ceil(p.npcMerchantInventory[invKey] * (0.1 + rng.random() * 0.2));
                                        p.npcMerchantInventory[invKey] = Math.max(0, p.npcMerchantInventory[invKey] - lostQty);
                                    }
                                }
                            }
                            // Guard casualties
                            if (emGuardCount > 0 && p.guards && rng.chance(0.3)) {
                                p.guards.pop(); // lose one guard
                            }
                            logEvent('💀 ' + p.firstName + ' ' + (p.lastName || '') + ' was robbed by ' +
                                (encounterType === 'pirate' ? 'pirates' : encounterType === 'soldier' ? 'enemy soldiers' : 'bandits') +
                                ', losing ' + goldLoss + 'g.', { type: 'encounter', goldLoss: goldLoss }, 'npc_activity');
                            // Bribe option for street_smart EMs
                            if (emHasSkill(p, 'bribe_expert') && encounterType === 'bandit') {
                                p.gold += Math.floor(goldLoss * 0.5); // recovered half via bribery
                            }
                        }
                    }
                }

                if (p.travelProgress >= 1.0) {
                    p.townId = p.travelDestination;
                    p.traveling = false;
                    p.travelProgress = 0;
                    p.travelDestination = null;
                    p.travelOffroad = false;
                    p.travelOffSea = false;
                    p.travelBySea = false;
                    // NPC merchants return home after selling
                    if (!p.isEliteMerchant && p.travelOriginTown) {
                        p._returnHome = true;
                        p._homeReturnDay = world.day + 5; // stay 5 days then return
                    }
                    var arrivalTown = findTown(p.townId);
                    if (p.isEliteMerchant) {
                        logEvent('📦 Elite merchant ' + (p.firstName || 'Unknown') + ' ' + (p.lastName || '') + ' has arrived in ' + (arrivalTown ? arrivalTown.name : 'unknown') + '.',
                            { type: 'merchant' }, 'npc_activity');
                        emitTrackedEMNotification(p, 'has arrived in ' + (arrivalTown ? arrivalTown.name : 'town'), { townId: p.townId });
                    }
                }
                continue; // Skip other actions while traveling
            }

            const town = findTown(p.townId);
            if (!town || !town.market) continue;

            // Buy cheap goods
            if (p.gold > 10) {
                const goodIds = Object.keys(town.market.prices);
                if (goodIds.length > 0) {
                    const resId = rng.pick(goodIds);
                    const price = town.market.prices[resId] || 999;
                    const supply = town.market.supply[resId] || 0;
                    const res = findResourceById(resId);
                    if (res && supply > 5 && price < res.basePrice && p.gold >= price * 2) {
                        const qty = Math.min(rng.randInt(1, 3), Math.floor(supply * 0.1), Math.floor(p.gold / price));
                        if (qty > 0) {
                            p.gold -= Math.floor(price * qty);
                            p.npcMerchantInventory[resId] = (p.npcMerchantInventory[resId] || 0) + qty;
                            town.market.supply[resId] -= qty;
                            collectTradeTax(town.kingdomId, Math.floor(price * qty), resId);
                        }
                    }
                }
            }

            // Sell when profitable
            for (const resId in p.npcMerchantInventory) {
                if ((p.npcMerchantInventory[resId] || 0) <= 0) continue;
                const price = town.market.prices[resId] || 1;
                const res = findResourceById(resId);
                if (res && price > res.basePrice * 1.3) {
                    const qty = Math.min(p.npcMerchantInventory[resId], rng.randInt(1, 3));
                    if (qty > 0) {
                        p.gold += Math.floor(price * qty);
                        p.npcMerchantInventory[resId] -= qty;
                        town.market.supply[resId] = (town.market.supply[resId] || 0) + qty;
                        collectTradeTax(town.kingdomId, Math.floor(price * qty), resId);
                    }
                }
            }

            // Occasionally buy 1 building if wealthy
            if (p.gold > 500 && rng.chance(0.005) && (!p.buildings || p.buildings.length < 2)) {
                const cheapBuildings = ['market_stall', 'wheat_farm', 'bakery'];
                const bType = rng.pick(cheapBuildings);
                const bt = findBuildingType(bType);
                if (bt && p.gold >= bt.cost) {
                    p.gold -= bt.cost;
                    if (!p.buildings) p.buildings = [];
                    p.buildings.push({ type: bType, townId: p.townId, level: 1 });
                    town.buildings.push({ type: bType, level: 1, ownerId: p.id });
                }
            }

            // Aggressive elite merchants may sabotage bridges to hurt competitors
            if (p.isEliteMerchant && p.wealthClass === 'upper' && rng.chance(0.002)) {
                const bridgeRoads = world.roads.map((r, idx) => ({ road: r, idx }))
                    .filter(e => (e.road.hasBridge || false) && !e.road.bridgeDestroyed &&
                        e.road.fromTownId !== p.townId && e.road.toTownId !== p.townId);
                if (bridgeRoads.length > 0) {
                    const target = bridgeRoads[rng.randInt(0, bridgeRoads.length - 1)];
                    destroyBridge(target.idx);
                    logEvent(`\uD83D\uDC80 An unknown saboteur has destroyed the bridge between ${findTown(target.road.fromTownId)?.name || '?'} and ${findTown(target.road.toTownId)?.name || '?'}!`, null, 'npc_activity');
                }
            }

            // Wealthy elite merchants may build toll routes — scored by road importance
            if (p.isEliteMerchant && (p.gold || 0) > 20000 && rng.chance(CONFIG.ELITE_MERCHANT_ROUTE_BUILD_CHANCE || 0.001)) {
                const homeTown = findTown(p.townId);
                if (homeTown) {
                    const potentialTargets = world.towns.filter(t => {
                        if (t.id === p.townId) return false;
                        if (t.isIsland) return false;
                        const d = Math.hypot(homeTown.x - t.x, homeTown.y - t.y);
                        if (d > 2500 || d < 200) return false;
                        const hasRoad = world.roads.some(r =>
                            (r.fromTownId === p.townId && r.toTownId === t.id) ||
                            (r.fromTownId === t.id && r.toTownId === p.townId)
                        );
                        if (hasRoad) return false;
                        const wf = checkWaterPath(homeTown.x, homeTown.y, t.x, t.y);
                        if (wf > 0.15) return false;
                        return true;
                    });
                    if (potentialTargets.length > 0) {
                        // Pick highest importance target instead of random
                        var bestEmTarget = null;
                        var bestEmScore = -Infinity;
                        for (var eti = 0; eti < potentialTargets.length; eti++) {
                            var emScore = computeRoadImportance(homeTown, potentialTargets[eti]);
                            if (emScore > bestEmScore) { bestEmScore = emScore; bestEmTarget = potentialTargets[eti]; }
                        }
                        if (bestEmTarget) {
                            const d = Math.hypot(homeTown.x - bestEmTarget.x, homeTown.y - bestEmTarget.y);
                            const cost = 3000 + Math.floor(d * 5);
                            if ((p.gold || 0) >= cost) {
                                p.gold -= cost;
                                buildNewRoad(p.townId, bestEmTarget.id, p.id, {
                                    ownerId: p.id,
                                    tollRate: 3 + rng.randInt(0, 7),
                                    isTollRoad: true,
                                    quality: 2,
                                });
                                logEvent(`\uD83D\uDEE4\uFE0F Elite merchant ${p.name} has built a toll road between ${homeTown.name} and ${bestEmTarget.name}!`, null, 'npc_activity');
                            }
                        }
                    }
                }
            }

            // ── Elite Merchant Travel Decision (every 7 days, staggered) ──
            if (p.isEliteMerchant && world.day % 7 === (p.id % 7)) {
                var emTown = findTown(p.townId);
                if (emTown) {
                    var emKingdom = findKingdom(emTown.kingdomId);

                    // Evaluate travel to nearby towns
                    var bestDest = null;
                    var bestScore = 0;

                    // Find connected towns (roads + sea routes)
                    var connectedTowns = [];
                    for (var ri = 0; ri < (world.roads || []).length; ri++) {
                        var road = world.roads[ri];
                        if (road.fromTownId === p.townId) connectedTowns.push(road.toTownId);
                        if (road.toTownId === p.townId) connectedTowns.push(road.fromTownId);
                    }
                    for (var si = 0; si < (world.seaRoutes || []).length; si++) {
                        var sr = world.seaRoutes[si];
                        if (sr.fromTownId === p.townId) connectedTowns.push(sr.toTownId);
                        if (sr.toTownId === p.townId) connectedTowns.push(sr.fromTownId);
                    }

                    for (var ci = 0; ci < connectedTowns.length; ci++) {
                        var candTown = findTown(connectedTowns[ci]);
                        if (!candTown || !candTown.market) continue;

                        var score = 0;

                        // Score based on price differences (arbitrage opportunity)
                        var inv = p.npcMerchantInventory || {};
                        for (var resId in inv) {
                            if ((inv[resId] || 0) > 3) {
                                var localPrice = emTown.market.prices[resId] || 0;
                                var destPrice = candTown.market.prices[resId] || 0;
                                if (destPrice > localPrice * 1.3) {
                                    score += (destPrice - localPrice) * inv[resId];
                                }
                            }
                        }

                        // Score based on supply gaps (goods the dest town needs)
                        for (var gId in (candTown.market.demand || {})) {
                            var destSupply = (candTown.market.supply || {})[gId] || 0;
                            var destDemand = candTown.market.demand[gId] || 0;
                            if (destDemand > destSupply * 1.5) {
                                score += (destDemand - destSupply) * 2;
                            }
                        }

                        // Flee from war zone
                        if (emKingdom && emKingdom.atWar && emKingdom.atWar.size > 0) {
                            var candKingdom = findKingdom(candTown.kingdomId);
                            if (candKingdom && (!candKingdom.atWar || candKingdom.atWar.size === 0)) {
                                score += 500; // Strong incentive to flee war
                            }
                        }

                        // Higher prosperity = more attractive
                        score += (candTown.prosperity || 50) * 0.5;

                        // Penalty for leaving home town (EMs prefer stability)
                        score -= 100;

                        if (score > bestScore) {
                            bestScore = score;
                            bestDest = connectedTowns[ci];
                        }
                    }

                    // If no good connected town, consider off-road or off-sea travel.
                    // v9p33river58: Both modes evaluated; AI picks the better-scored option
                    // and validates the path with Engine.findTerrainPath so EMs follow the
                    // same land/sea constraints the player does.
                    if (!bestDest || bestScore < 200) {
                        var allTowns = world.towns.filter(function(t) {
                            return t.id !== p.townId && !t.isIsland;
                        });

                        var bestOffroadDest = null, bestOffroadScore = 0;
                        var bestOffSeaDest = null, bestOffSeaScore = 0;
                        var emInPort = !!(emTown && emTown.isPort);
                        var _findPath = (typeof Engine !== 'undefined' && Engine.findTerrainPath) ? Engine.findTerrainPath : null;

                        for (var ati = 0; ati < Math.min(allTowns.length, 5); ati++) {
                            var randTown = allTowns[rng.randInt(0, allTowns.length - 1)];
                            if (!randTown || !randTown.market) continue;

                            var dist = Math.hypot((randTown.x || 0) - (emTown.x || 0), (randTown.y || 0) - (emTown.y || 0));
                            var distPenalty = dist * 0.1;

                            // Score arbitrage potential
                            var arbScore = 0;
                            var oInv = p.npcMerchantInventory || {};
                            for (var oResId in oInv) {
                                var oLocal = emTown.market.prices[oResId] || 0;
                                var oDest = randTown.market.prices[oResId] || 0;
                                if (oDest > oLocal * 1.5) {
                                    arbScore += (oDest - oLocal) * (oInv[oResId] || 0);
                                }
                            }

                            // ── Off-road land travel: <=3000px, validated land path
                            if (dist <= 3000 && _findPath) {
                                var landScore = arbScore - distPenalty;
                                if (landScore > bestOffroadScore && landScore > 400) {
                                    var landPath = _findPath(emTown.x, emTown.y, randTown.x, randTown.y, 'land');
                                    var landWp = (landPath && Array.isArray(landPath)) ? landPath
                                        : (landPath && landPath.waypoints) ? landPath.waypoints : null;
                                    if (landWp && landWp.length >= 2) {
                                        bestOffroadScore = landScore;
                                        bestOffroadDest = randTown.id;
                                    }
                                }
                            }

                            // ── Off-sea travel: requires both ports, <=5000px, validated sea path.
                            // Slower distance penalty (sea has fewer obstacles than wilderness).
                            if (emInPort && randTown.isPort && dist <= 5000 && _findPath) {
                                var seaScore = arbScore - dist * 0.06;
                                if (seaScore > bestOffSeaScore && seaScore > 350) {
                                    var seaPath = _findPath(emTown.x, emTown.y, randTown.x, randTown.y, 'sea');
                                    var seaWp = (seaPath && Array.isArray(seaPath)) ? seaPath
                                        : (seaPath && seaPath.waypoints) ? seaPath.waypoints : null;
                                    if (seaWp && seaWp.length >= 2) {
                                        bestOffSeaScore = seaScore;
                                        bestOffSeaDest = randTown.id;
                                    }
                                }
                            }
                        }

                        // Pick the better of the two (or override the on-road bestScore)
                        if (bestOffSeaDest && bestOffSeaScore > bestOffroadScore && bestOffSeaScore > bestScore) {
                            p.traveling = true;
                            p.travelDestination = bestOffSeaDest;
                            p.travelProgress = 0;
                            p.travelOffroad = false;
                            p.travelOffSea = true;
                            p.travelBySea = true;
                            bestDest = null; // suppress the on-road branch below
                            var seaDestName = findTown(bestOffSeaDest) ? findTown(bestOffSeaDest).name : 'unknown';
                            logEvent('⛵ Elite merchant ' + (p.firstName || 'Unknown') + ' ' + (p.lastName || '') + ' set sail from ' + emTown.name + ' bound for ' + seaDestName + ' across open water.',
                                { type: 'merchant' }, 'npc_activity');
                            emitTrackedEMNotification(p, 'is sailing open water to ' + seaDestName, { townId: p.townId });
                        } else if (bestOffroadDest && bestOffroadScore > bestScore) {
                            p.traveling = true;
                            p.travelDestination = bestOffroadDest;
                            p.travelProgress = 0;
                            p.travelOffroad = true;
                            p.travelOffSea = false;
                            p.travelBySea = false;
                            bestDest = null; // suppress the on-road branch below
                            var offDestName = findTown(bestOffroadDest) ? findTown(bestOffroadDest).name : 'unknown';
                            logEvent('📦 Elite merchant ' + (p.firstName || 'Unknown') + ' ' + (p.lastName || '') + ' departed from ' + emTown.name + ' heading off-road to ' + offDestName + '.',
                                { type: 'merchant' }, 'npc_activity');
                            emitTrackedEMNotification(p, 'is traveling off-road to ' + offDestName, { townId: p.townId });
                        }
                    }

                    // On-road travel if score threshold met (and not already started off-road above)
                    if (!p.traveling && bestDest && bestScore > 200) {
                        p.traveling = true;
                        p.travelDestination = bestDest;
                        p.travelProgress = 0;
                        p.travelOffroad = false;

                        // Use kingdom transport if available
                        if (emKingdom && emKingdom.laws && emKingdom.laws.kingdomTransport) {
                            var transportCost = emKingdom.laws.transportRate || 15;
                            if ((p.gold || 0) >= transportCost) {
                                p.gold -= transportCost;
                                emKingdom.gold = (emKingdom.gold || 0) + transportCost;
                                p.travelProgress = 0.3; // Faster with kingdom transport
                            }
                        }

                        var destName = findTown(bestDest) ? findTown(bestDest).name : 'unknown';
                        logEvent('📦 Elite merchant ' + (p.firstName || 'Unknown') + ' ' + (p.lastName || '') + ' departed from ' + emTown.name + ' heading to ' + destName + '.',
                            { type: 'merchant' }, 'npc_activity');
                        emitTrackedEMNotification(p, 'is traveling to ' + destName, { townId: p.townId });
                    }
                }
            }

            p.npcMerchantCooldown = rng.randInt(1, 3);
        }
    }

    // ========================================================
    // NPC Merchant Travel
    // Lines 29691-29760 from engine.js
    // ========================================================
    function tickNPCMerchantTravel() {
        _syncState();
        if (!world) return;
        // Only check every NPC_MERCHANT_TRAVEL_INTERVAL days
        if (world.day % (CONFIG.NPC_MERCHANT_TRAVEL_INTERVAL || 30) !== 0) return;
        
        var rng = world.rng;
        if (!rng) return;
        
        var _merchAlive = (typeof Engine !== 'undefined' && Engine.getTickCache) ? (Engine.getTickCache().alivePeople || world.people) : world.people;
        for (var mi = 0; mi < _merchAlive.length; mi++) {
            var m = _merchAlive[mi];
            if (!m.alive || m.occupation !== 'merchant' || m.isEliteMerchant) continue;
            if (m.employerId) continue; // employed by player
            if (m.traveling) continue; // already traveling
            if ((m.gold || 0) < (CONFIG.NPC_MERCHANT_TRAVEL_GOLD_MIN || 500)) continue;
            
            // Only ~10% of qualifying merchants actually consider traveling
            if (rng.random() > 0.10) continue;
            
            var town = findTown(m.townId);
            if (!town || !town.connectedTowns || town.connectedTowns.length === 0) continue;
            
            // Check 1-2 nearest connected towns for price differentials
            var checkCount = Math.min(town.connectedTowns.length, 2);
            var bestDest = null;
            var bestProfit = 0;
            
            for (var ci = 0; ci < checkCount; ci++) {
                var neighbor = findTown(town.connectedTowns[ci]);
                if (!neighbor || !neighbor.market) continue;
                // Skip destinations under trade embargo
                if (town.kingdomId && neighbor.kingdomId && town.kingdomId !== neighbor.kingdomId && hasEmbargo(town.kingdomId, neighbor.kingdomId)) continue;
                
                // Check inventory for selling opportunities
                var inv = m.npcMerchantInventory || {};
                for (var resId in inv) {
                    if ((inv[resId] || 0) <= 0) continue;
                    var localPrice = town.market.prices[resId] || 0;
                    var destPrice = neighbor.market.prices[resId] || 0;
                    if (destPrice > localPrice * (CONFIG.NPC_MERCHANT_TRAVEL_PRICE_SELL_THRESHOLD || 1.5)) {
                        var profit = (destPrice - localPrice) * inv[resId];
                        if (profit > bestProfit) {
                            bestProfit = profit;
                            bestDest = neighbor.id;
                        }
                    }
                }
                
                // Check for buying opportunities at destination
                for (var rk in neighbor.market.prices) {
                    var nPrice = neighbor.market.prices[rk] || 0;
                    var lPrice = town.market.prices[rk] || 0;
                    if (nPrice > 0 && lPrice > 0 && nPrice < lPrice * (CONFIG.NPC_MERCHANT_TRAVEL_PRICE_BUY_THRESHOLD || 0.6)) {
                        var buyProfit = (lPrice - nPrice) * 5; // assume buying ~5 units
                        if (buyProfit > bestProfit) {
                            bestProfit = buyProfit;
                            bestDest = neighbor.id;
                        }
                    }
                }
            }
            
            if (bestDest && bestProfit > 20) {
                m.traveling = true;
                m.travelProgress = 0;
                m.travelDestination = bestDest;
                m.travelOriginTown = m.townId;
                m.travelOffroad = false;
            }
        }
    }

    // ========================================================
    // §19B1b FAMILY MEMBER ENHANCED SIMULATION
    // Lines 29762-30202 from engine.js
    // ========================================================
    // ========================================================
    // §19B1b  FAMILY MEMBER ENHANCED SIMULATION
    // ========================================================
    // Family members get more simulation than normal NPCs but less than elite merchants.
    // Runs every 5 days (vs NPCs daily, elite merchants every 3 days).

    function tickFamilyMembers() {
        _syncState();
        if (!world) return;
        const rng = world.rng;
        if (!rng) return;
        if (world.day % 5 !== 0) return;

        // Get player family member IDs
        const playerObj = typeof Player !== 'undefined' ? Player : null;
        if (!playerObj || !playerObj.familyMembers) return;
        const familyIds = new Set();
        for (var fi = 0; fi < playerObj.familyMembers.length; fi++) {
            familyIds.add(playerObj.familyMembers[fi].npcId);
        }
        if (familyIds.size === 0) return;

        for (const p of world.people) {
            if (!p.alive || !familyIds.has(p.id)) continue;
            if (p.employerId) continue; // employed by player, let player manage them

            const town = findTown(p.townId);
            if (!town || !town.market) continue;

            // Initialize family merchant inventory if not present
            if (!p.npcMerchantInventory) p.npcMerchantInventory = {};
            if (!p.familySimulated) p.familySimulated = true;

            // 1. SMART TRADING — buy underpriced goods, sell overpriced (better than NPC merchants)
            if ((p.gold || 0) > 5 && town.market.prices && town.market.supply) {
                const goodIds = Object.keys(town.market.prices);
                // Try to find a good deal (check up to 5 goods)
                for (var gi = 0; gi < Math.min(5, goodIds.length); gi++) {
                    const resId = rng.pick(goodIds);
                    const price = town.market.prices[resId] || 999;
                    const supply = town.market.supply[resId] || 0;
                    const res = findResourceById(resId);
                    if (!res) continue;
                    // Buy if price < 80% of base (smarter than NPC's 100% threshold)
                    if (supply > 3 && price < res.basePrice * 0.8 && p.gold >= price * 3) {
                        const qty = Math.min(rng.randInt(1, 5), Math.floor(supply * 0.15), Math.floor(p.gold / price / 2));
                        if (qty > 0) {
                            p.gold -= Math.floor(price * qty);
                            p.npcMerchantInventory[resId] = (p.npcMerchantInventory[resId] || 0) + qty;
                            town.market.supply[resId] -= qty;
                            collectTradeTax(town.kingdomId, Math.floor(price * qty), resId);
                            break;
                        }
                    }
                }
            }

            // Sell when profitable (lower threshold than NPC merchants — 120% vs 130%)
            if (town.market.prices && town.market.supply) {
            for (const resId in p.npcMerchantInventory) {
                if ((p.npcMerchantInventory[resId] || 0) <= 0) continue;
                const price = town.market.prices[resId] || 1;
                const res = findResourceById(resId);
                if (res && price > res.basePrice * 1.2) {
                    const qty = Math.min(p.npcMerchantInventory[resId], rng.randInt(1, 4));
                    if (qty > 0) {
                        p.gold += Math.floor(price * qty);
                        p.npcMerchantInventory[resId] -= qty;
                        town.market.supply[resId] = (town.market.supply[resId] || 0) + qty;
                        collectTradeTax(town.kingdomId, Math.floor(price * qty), resId);
                    }
                }
            }
            }

            // 2. JOB SEEKING — if unemployed and not a merchant, try to find work
            if (!p.occupation || p.occupation === 'unemployed' || p.occupation === 'none') {
                // Look for open positions in town buildings
                var hired = false;
                for (var bi = 0; bi < town.buildings.length && !hired; bi++) {
                    var bldg = town.buildings[bi];
                    var bt = findBuildingType(bldg.type);
                    if (!bt || !bt.workers) continue;
                    var currentWorkers = bldg.workers ? bldg.workers.length : 0;
                    var maxWorkers = bt.workers + ((bldg.level || 1) - 1);
                    if (currentWorkers < maxWorkers) {
                        p.occupation = bt.jobTitle || 'worker';
                        if (!bldg.workers) bldg.workers = [];
                        bldg.workers.push(p.id);
                        p.employerId = bldg.ownerId || null;
                        hired = true;
                    }
                }
                if (!hired) {
                    p.occupation = 'merchant';
                }
            }

            // 3. WEALTH ACCUMULATION — family members save more aggressively
            // Small passive income to represent family connections (5-15g every 5 days)
            if (rng.chance(0.4)) {
                var familyIncome = rng.randInt(5, 15);
                p.gold = (p.gold || 0) + familyIncome;
            }

            // 4. BUILDING PURCHASE — can own up to 2 buildings (less than elite unlimited)
            if ((p.gold || 0) > 300 && rng.chance(0.01) && (!p.buildings || p.buildings.length < 2)) {
                const affordableBuildings = ['market_stall', 'wheat_farm', 'bakery', 'chicken_farm', 'lumber_camp'];
                const bType = rng.pick(affordableBuildings);
                var bt = findBuildingType(bType);
                if (bt && p.gold >= bt.cost) {
                    p.gold -= bt.cost;
                    if (!p.buildings) p.buildings = [];
                    p.buildings.push({ type: bType, townId: p.townId, level: 1 });
                    town.buildings.push({ type: bType, level: 1, ownerId: p.id });
                    logEvent(`Your family member ${p.firstName || p.name || 'relative'} opened a ${bt.name} in ${town.name}.`, null, 'npc_activity');
                }
            }

            // 5. SOCIAL CONNECTIONS — family members build relationships in their town
            if (rng.chance(0.05)) {
                // Slight reputation boost in their town's kingdom
                if (town.kingdomId && playerObj.reputation) {
                    var currentRep = playerObj.reputation[town.kingdomId] || 50;
                    if (currentRep < 80) {
                        // Family presence slowly builds reputation
                        playerObj.state.reputation[town.kingdomId] = Math.min(100, currentRep + 0.5);
                    }
                }
            }

            // ── FAMILY AI: Smart use of gold and items ──
            var _fGold = p.gold || 0;
            var _fRank = 0;
            if (p.socialRank) {
                for (var _rk in p.socialRank) { if (p.socialRank[_rk] > _fRank) _fRank = p.socialRank[_rk]; }
            }
            if (!_fRank && p.occupation === 'noble') _fRank = 4;
            var _fMarket = town.market;
            var _fSupply = _fMarket.supply || {};
            var _fPrices = _fMarket.prices || {};
            var _fName = p.firstName || p.name || 'family member';

            // 6. SELF-TREATMENT — highest priority: seek medical care
            if (p.sick || p.injured) {
                var _fSev = p.injured ? (p.injurySeverity || 'minor') : (p.illnessSeverity || 'minor');

                // 6a. Try hospital/clinic queue if not already being treated
                if (!p._illnessTreatPaid) {
                    var _fTreated = false;
                    for (var _mbi = 0; _mbi < town.buildings.length && !_fTreated; _mbi++) {
                        var _mBld = town.buildings[_mbi];
                        if (_mBld.type !== 'hospital' && _mBld.type !== 'clinic') continue;
                        if (!_mBld._treatmentQueue) _mBld._treatmentQueue = [];
                        // Already queued?
                        var _alreadyQ = false;
                        for (var _qi = 0; _qi < _mBld._treatmentQueue.length; _qi++) {
                            if (_mBld._treatmentQueue[_qi].personId === p.id) { _alreadyQ = true; break; }
                        }
                        if (_alreadyQ) { _fTreated = true; break; }
                        // Check supplies available before payment
                        if (!_checkSuppliesAvailable(_mBld, town, _fSev, !!p.sick)) continue;
                        var _tFee = (_mBld._treatmentFees && _mBld._treatmentFees[_fSev]) || (_fSev === 'severe' ? 60 : _fSev === 'moderate' ? 30 : 10);
                        if (_fGold >= _tFee) {
                            p.gold -= _tFee;
                            _fGold -= _tFee;
                            p._illnessTreatPaid = true;
                            var _tTicks = _fSev === 'severe' ? 40 : _fSev === 'moderate' ? 25 : 15;
                            if (_mBld.type === 'clinic' && _fSev === 'severe') _tTicks *= 2;
                            _mBld._treatmentQueue.push({
                                personId: p.id, severity: _fSev,
                                isIllness: !!p.sick, ticksRemaining: _tTicks,
                                admittedDay: world.day
                            });
                            // Revenue to building owner
                            if (_mBld.ownerId) {
                                var _bOwner = findPerson(_mBld.ownerId);
                                if (_bOwner) _bOwner.gold = (_bOwner.gold || 0) + Math.floor(_tFee * 0.7);
                            }
                            _fTreated = true;
                        }
                    }

                    // 6b. No facility or can't afford — buy medical supplies from market
                    if (!_fTreated && _fGold > 0) {
                        var _medItems = p.injured
                            ? ['bandages', 'splint', 'herbal_poultice', 'healing_tonic']
                            : ['herbal_remedy', 'fever_tonic', 'healing_tonic', 'bandages'];
                        for (var _mi = 0; _mi < _medItems.length; _mi++) {
                            var _mId = _medItems[_mi];
                            if ((_fSupply[_mId] || 0) > 0) {
                                var _mCost = _fPrices[_mId] || 10;
                                if (_fGold >= _mCost) {
                                    p.gold -= _mCost;
                                    _fGold -= _mCost;
                                    _fSupply[_mId] = (_fSupply[_mId] || 0) - 1;
                                    p.health = Math.min(100, (p.health || 50) + 5);
                                    break;
                                }
                            }
                        }
                    }
                }
            }

            // 7. BUY EQUIPMENT — weapon and armor if they can afford it
            if (!p.weapon && _fGold > 15) {
                // Choose weapon tier based on wealth and social rank
                var _weapPref;
                if (_fRank >= 4 || _fGold > 300) _weapPref = ['swords_excellent', 'swords_good', 'bows_excellent', 'swords', 'bows_good', 'bows'];
                else if (_fRank >= 2 || _fGold > 100) _weapPref = ['swords_good', 'swords', 'bows_good', 'bows'];
                else _weapPref = ['swords', 'bows'];
                for (var _wi = 0; _wi < _weapPref.length; _wi++) {
                    var _wId = _weapPref[_wi];
                    if ((_fSupply[_wId] || 0) > 0) {
                        var _wCost = _fPrices[_wId] || 50;
                        if (_fGold >= _wCost && _fGold - _wCost >= 10) { // keep at least 10g reserve
                            p.gold -= _wCost;
                            _fGold -= _wCost;
                            _fSupply[_wId] = (_fSupply[_wId] || 0) - 1;
                            // Find matching equipment def and equip
                            var _eqWeap = null;
                            for (var _ewi = 0; _ewi < EQUIPMENT_TYPES.weapons.length; _ewi++) {
                                if (EQUIPMENT_TYPES.weapons[_ewi].resource === _wId) {
                                    if (!_eqWeap || EQUIPMENT_TYPES.weapons[_ewi].combatBonus > _eqWeap.combatBonus) _eqWeap = EQUIPMENT_TYPES.weapons[_ewi];
                                }
                            }
                            if (_eqWeap) {
                                p.weapon = { id: _eqWeap.id, name: _eqWeap.name, quality: _eqWeap.quality, combatBonus: _eqWeap.combatBonus };
                                logEvent('⚔️ Your ' + (p._familyRole || 'family member') + ' ' + _fName + ' bought and equipped a ' + _eqWeap.name + '.', null, 'npc_activity');
                            }
                            break;
                        }
                    }
                }
            }
            // Upgrade weapon if they have gold and better is available
            if (p.weapon && _fGold > 100) {
                var _curCB = (typeof p.weapon === 'object') ? (p.weapon.combatBonus || 0) : 0.1;
                var _upgWeapRes = ['swords_excellent', 'swords_good', 'bows_excellent', 'bows_good'];
                for (var _uwi = 0; _uwi < _upgWeapRes.length; _uwi++) {
                    var _uwId = _upgWeapRes[_uwi];
                    if ((_fSupply[_uwId] || 0) > 0) {
                        var _uwCost = _fPrices[_uwId] || 100;
                        if (_fGold >= _uwCost && _fGold - _uwCost >= 20) {
                            var _uwDef = null;
                            for (var _udi = 0; _udi < EQUIPMENT_TYPES.weapons.length; _udi++) {
                                if (EQUIPMENT_TYPES.weapons[_udi].resource === _uwId && EQUIPMENT_TYPES.weapons[_udi].combatBonus > _curCB) {
                                    if (!_uwDef || EQUIPMENT_TYPES.weapons[_udi].combatBonus > _uwDef.combatBonus) _uwDef = EQUIPMENT_TYPES.weapons[_udi];
                                }
                            }
                            if (_uwDef) {
                                p.gold -= _uwCost;
                                _fGold -= _uwCost;
                                _fSupply[_uwId] = (_fSupply[_uwId] || 0) - 1;
                                p.weapon = { id: _uwDef.id, name: _uwDef.name, quality: _uwDef.quality, combatBonus: _uwDef.combatBonus };
                                logEvent('⚔️ ' + _fName + ' upgraded to a ' + _uwDef.name + '.', null, 'npc_activity');
                                break;
                            }
                        }
                    }
                }
            }

            if (!p.armor && _fGold > 30) {
                var _armPref;
                if (_fRank >= 4 || _fGold > 500) _armPref = ['armor_excellent', 'armor_good', 'armor'];
                else if (_fRank >= 2 || _fGold > 150) _armPref = ['armor_good', 'armor'];
                else _armPref = ['armor'];
                for (var _ai = 0; _ai < _armPref.length; _ai++) {
                    var _aId = _armPref[_ai];
                    if ((_fSupply[_aId] || 0) > 0) {
                        var _aCost = _fPrices[_aId] || 80;
                        if (_fGold >= _aCost && _fGold - _aCost >= 10) {
                            p.gold -= _aCost;
                            _fGold -= _aCost;
                            _fSupply[_aId] = (_fSupply[_aId] || 0) - 1;
                            var _eqArm = null;
                            for (var _eai = 0; _eai < EQUIPMENT_TYPES.armor.length; _eai++) {
                                if (EQUIPMENT_TYPES.armor[_eai].resource === _aId) {
                                    if (!_eqArm || EQUIPMENT_TYPES.armor[_eai].combatBonus > _eqArm.combatBonus) _eqArm = EQUIPMENT_TYPES.armor[_eai];
                                }
                            }
                            if (_eqArm) {
                                p.armor = { id: _eqArm.id, name: _eqArm.name, quality: _eqArm.quality, combatBonus: _eqArm.combatBonus };
                                logEvent('🛡️ ' + _fName + ' bought and equipped ' + _eqArm.name + '.', null, 'npc_activity');
                            }
                            break;
                        }
                    }
                }
            }
            // Upgrade armor similarly
            if (p.armor && _fGold > 200) {
                var _curAB = (typeof p.armor === 'object') ? (p.armor.combatBonus || 0) : 0.15;
                var _upgArmRes = ['armor_excellent', 'armor_good'];
                for (var _uai = 0; _uai < _upgArmRes.length; _uai++) {
                    var _uaId = _upgArmRes[_uai];
                    if ((_fSupply[_uaId] || 0) > 0) {
                        var _uaCost = _fPrices[_uaId] || 200;
                        if (_fGold >= _uaCost && _fGold - _uaCost >= 20) {
                            var _uaDef = null;
                            for (var _uadi = 0; _uadi < EQUIPMENT_TYPES.armor.length; _uadi++) {
                                if (EQUIPMENT_TYPES.armor[_uadi].resource === _uaId && EQUIPMENT_TYPES.armor[_uadi].combatBonus > _curAB) {
                                    if (!_uaDef || EQUIPMENT_TYPES.armor[_uadi].combatBonus > _uaDef.combatBonus) _uaDef = EQUIPMENT_TYPES.armor[_uadi];
                                }
                            }
                            if (_uaDef) {
                                p.gold -= _uaCost;
                                _fGold -= _uaCost;
                                _fSupply[_uaId] = (_fSupply[_uaId] || 0) - 1;
                                p.armor = { id: _uaDef.id, name: _uaDef.name, quality: _uaDef.quality, combatBonus: _uaDef.combatBonus };
                                logEvent('🛡️ ' + _fName + ' upgraded to ' + _uaDef.name + '.', null, 'npc_activity');
                                break;
                            }
                        }
                    }
                }
            }

            // 8. BUY HORSE — if wealthy enough and horses are available
            if (!p.horse && _fGold >= 80 && (_fSupply.horses || 0) > 0) {
                var _hCost = _fPrices.horses || 60;
                // Nobles/wealthy buy horses more eagerly
                var _horseThreshold = _fRank >= 3 ? _hCost : _hCost * 2; // commoners need more cushion
                if (_fGold >= _horseThreshold && _fGold - _hCost >= 20) {
                    p.gold -= _hCost;
                    _fGold -= _hCost;
                    _fSupply.horses = (_fSupply.horses || 0) - 1;
                    p.horse = { name: 'Horse', stamina: 100 };
                    logEvent('🐴 ' + _fName + ' bought a horse!', null, 'npc_activity');
                }
            }

            // 9. INSTRUMENT PRACTICE — if they own an instrument, practice it
            if (!p._familyInstruments) p._familyInstruments = {};
            // Check if they have instruments in their merchant inventory (from gifts)
            var _instIds = INSTRUMENT_IDS || ['drum', 'flute', 'lute', 'hurdy_gurdy', 'harp'];
            for (var _ii = 0; _ii < _instIds.length; _ii++) {
                var _instId = _instIds[_ii];
                // If they received this instrument (tracked via npcMerchantInventory or direct flag)
                if (p._familyInstruments[_instId] || (p.npcMerchantInventory && (p.npcMerchantInventory[_instId] || 0) > 0)) {
                    if (p.npcMerchantInventory && p.npcMerchantInventory[_instId] > 0) {
                        // Transfer from inventory to owned instruments
                        p._familyInstruments[_instId] = true;
                        p.npcMerchantInventory[_instId] = (p.npcMerchantInventory[_instId] || 0) - 1;
                    }
                    // Practice: skill increases
                    if (!p._familyInstrumentSkill) p._familyInstrumentSkill = {};
                    var _curSkill = p._familyInstrumentSkill[_instId] || 0;
                    if (_curSkill < 100) {
                        var _skillGain = Math.max(0.5, 2 - _curSkill / 50);
                        p._familyInstrumentSkill[_instId] = Math.min(100, _curSkill + _skillGain);
                        // Occasional log at milestones
                        var _newSkill = p._familyInstrumentSkill[_instId];
                        var _instDef = INSTRUMENTS[_instId];
                        var _instName = _instDef ? _instDef.name : _instId;
                        if ((_curSkill < 26 && _newSkill >= 26) || (_curSkill < 51 && _newSkill >= 51) || (_curSkill < 76 && _newSkill >= 76)) {
                            var _tier = _newSkill >= 76 ? 'Master' : _newSkill >= 51 ? 'Expert' : 'Competent';
                            logEvent('🎵 ' + _fName + ' reached ' + _tier + ' level on the ' + _instName + '!', null, 'npc_activity');
                        }
                    }
                }
            }
            // Buy an instrument if they have gold, musical interest, and none owned yet
            var _ownsInstrument = false;
            for (var _oi in p._familyInstruments) { if (p._familyInstruments[_oi]) { _ownsInstrument = true; break; } }
            if (!_ownsInstrument && _fGold > 40 && rng.chance(0.03)) {
                // Preference based on social rank
                var _instPref;
                if (_fRank >= 4) _instPref = ['harp', 'hurdy_gurdy', 'lute'];
                else if (_fRank >= 2) _instPref = ['lute', 'hurdy_gurdy', 'flute'];
                else _instPref = ['drum', 'flute', 'lute'];
                for (var _ipi = 0; _ipi < _instPref.length; _ipi++) {
                    var _ipId = _instPref[_ipi];
                    if ((_fSupply[_ipId] || 0) > 0) {
                        var _ipCost = _fPrices[_ipId] || 20;
                        if (_fGold >= _ipCost && _fGold - _ipCost >= 10) {
                            p.gold -= _ipCost;
                            _fGold -= _ipCost;
                            _fSupply[_ipId] = (_fSupply[_ipId] || 0) - 1;
                            p._familyInstruments[_ipId] = true;
                            var _bInstDef = INSTRUMENTS[_ipId];
                            logEvent('🎵 ' + _fName + ' bought a ' + (_bInstDef ? _bInstDef.name : _ipId) + ' and started learning to play!', null, 'npc_activity');
                            break;
                        }
                    }
                }
            }

            // 10. FOOD & BEVERAGES — buy food/drink if they have gold (basic survival)
            if (_fGold > 5 && rng.chance(0.3)) {
                var _foodItems = ['bread', 'meat', 'fish', 'poultry', 'eggs', 'vegetables'];
                var _boughtFood = false;
                for (var _fdi = 0; _fdi < _foodItems.length && !_boughtFood; _fdi++) {
                    var _fdId = _foodItems[_fdi];
                    if ((_fSupply[_fdId] || 0) > 0) {
                        var _fdCost = _fPrices[_fdId] || 3;
                        if (_fGold >= _fdCost) {
                            p.gold -= _fdCost;
                            _fGold -= _fdCost;
                            _fSupply[_fdId] = (_fSupply[_fdId] || 0) - 1;
                            p.health = Math.min(100, (p.health || 80) + 1);
                            _boughtFood = true;
                        }
                    }
                }
            }

            // 11. STATUS-APPROPRIATE LUXURY SPENDING — nobles buy fine goods
            if (_fRank >= 3 && _fGold > 100 && rng.chance(0.08)) {
                var _luxItems = ['wine', 'silk', 'jewelry', 'perfume', 'fine_clothes', 'pearls'];
                for (var _li = 0; _li < _luxItems.length; _li++) {
                    var _lId = _luxItems[_li];
                    if ((_fSupply[_lId] || 0) > 0) {
                        var _lCost = _fPrices[_lId] || 30;
                        if (_fGold >= _lCost && _fGold - _lCost >= 30) {
                            p.gold -= _lCost;
                            _fGold -= _lCost;
                            _fSupply[_lId] = (_fSupply[_lId] || 0) - 1;
                            // Store for potential resale
                            p.npcMerchantInventory[_lId] = (p.npcMerchantInventory[_lId] || 0) + 1;
                            break;
                        }
                    }
                }
            }

            // 12. CHILDREN education — younger family members build skills
            if (p.age && p.age >= 8 && p.age < 18 && rng.chance(0.1)) {
                p.workerSkill = Math.min(50, (p.workerSkill || 0) + 1);
                // Small chance to gain medical knowledge from schooling
                if (!p.medicalKnowledge && rng.chance(0.02)) {
                    p.medicalKnowledge = 'basic';
                }
            }

            // Store the family role for logging purposes
            var _member = playerObj.familyMembers.find(function(m) { return m.npcId === p.id; });
            if (_member) p._familyRole = _member.role;
        }
    }

    // ========================================================
    // EM-NPC Relationship Favors System
    // EMs with high relationships (60+) occasionally receive favors
    // ========================================================
    function tickEMRelationshipFavors() {
        if (!world || !world.people) return;
        var day = world.day || 0;
        // Only run every 7 days
        if (day % 7 !== 0) return;
        var rng = world.rng;
        if (!rng) return;

        var elites = world.people.filter(function(p) { return p.alive && p.isEliteMerchant; });
        for (var i = 0; i < elites.length; i++) {
            var em = elites[i];
            if (!em.relationships) continue;

            for (var relId in em.relationships) {
                var rel = em.relationships[relId];
                if (!rel || rel.level < 60) continue;

                // Higher relationship = higher favor chance (1-5% per week)
                var favorChance = (rel.level - 55) * 0.001;
                if (!rng.chance(favorChance)) continue;

                var npc = Engine.findPerson(relId);
                if (!npc || !npc.alive || npc.isEliteMerchant) continue;

                // Pick a favor type based on NPC personality
                var personality = npc.personality || {};
                var generosity = (personality.warmth || 50) + (personality.loyalty || 50);
                var favorRoll = rng.random() * 100;
                var favorGiven = false;

                if (favorRoll < 30 && generosity > 60) {
                    // Gold gift: 5-50g based on NPC wealth and relationship
                    var npcGold = npc.gold || 0;
                    var giftAmount = Math.min(Math.floor(npcGold * 0.05), Math.floor(5 + (rel.level - 60) * 1.5));
                    if (giftAmount >= 5 && npcGold > giftAmount * 2) {
                        npc.gold -= giftAmount;
                        em.gold = (em.gold || 0) + giftAmount;
                        favorGiven = true;
                    }
                } else if (favorRoll < 55) {
                    // Trade tip: small boost to EM's trading skill
                    if (em.skills && em.skills.trading != null) {
                        em.skills.trading = Math.min(100, (em.skills.trading || 0) + 0.5);
                        favorGiven = true;
                    }
                } else if (favorRoll < 75 && rel.level >= 70) {
                    // Introduction: boost relationship with another NPC in town
                    var townPeople = world.people.filter(function(tp) {
                        return tp.alive && tp.townId === em.townId && tp.id !== em.id && tp.id !== relId &&
                               (!em.relationships[tp.id] || em.relationships[tp.id].level < 40);
                    });
                    if (townPeople.length > 0) {
                        var introduced = rng.pick(townPeople);
                        var introDelta = (!em.relationships[introduced.id]) ? 15 : 10;
                        var reverseDelta = (!introduced.relationships || !introduced.relationships[em.id]) ? 10 : 8;
                        if (_bridgeNPCRelationship(em, introduced.id, introDelta, 'relationship_introduction')) {
                            _bridgeNPCRelationship(introduced, em.id, reverseDelta, 'relationship_introduction');
                        } else {
                            if (!em.relationships[introduced.id]) {
                                em.relationships[introduced.id] = { level: 15, type: 'acquaintance' };
                            } else {
                                em.relationships[introduced.id].level = Math.min(100, em.relationships[introduced.id].level + 10);
                                em.relationships[introduced.id].type = _legacyRelationshipType(em.relationships[introduced.id].level);
                            }
                            if (!introduced.relationships) introduced.relationships = {};
                            if (!introduced.relationships[em.id]) {
                                introduced.relationships[em.id] = { level: 10, type: 'acquaintance' };
                            } else {
                                introduced.relationships[em.id].level = Math.min(100, introduced.relationships[em.id].level + 8);
                                introduced.relationships[em.id].type = _legacyRelationshipType(introduced.relationships[em.id].level);
                            }
                        }
                        favorGiven = true;
                    }
                } else if (favorRoll < 90) {
                    // Relationship boost: mutual relationship grows from interaction
                    if (_bridgeNPCRelationship(em, relId, 2, 'relationship_favor')) {
                        _bridgeNPCRelationship(npc, em.id, 2, 'relationship_favor');
                    } else {
                        rel.level = Math.min(100, rel.level + 2);
                        rel.type = _legacyRelationshipType(rel.level);
                        if (npc.relationships && npc.relationships[em.id]) {
                            npc.relationships[em.id].level = Math.min(100, npc.relationships[em.id].level + 2);
                            npc.relationships[em.id].type = _legacyRelationshipType(npc.relationships[em.id].level);
                        }
                    }
                    favorGiven = true;
                }

                // Max 1 favor per EM per week
                if (favorGiven) break;
            }
        }
    }

    // ========================================================
    // Register extracted functions on Engine namespace
    // ========================================================

    // §19A1 — Elite Merchant Count Management
    Engine.createEliteMerchantFromNPC = createEliteMerchantFromNPC;
    Engine.generateFreshEliteMerchant = generateFreshEliteMerchant;
    Engine.emitTrackedEMNotification = emitTrackedEMNotification;
    Engine.tickEliteMerchantDynamics = tickEliteMerchantDynamics;
    Engine.ensureEliteMerchantCount = ensureEliteMerchantCount;

    // §19A1B — Elite Merchant Guild AI
    Engine.tickEMGuildAI = tickEMGuildAI;

    // §19A2 — Elite Merchant Deep AI Simulation
    Engine.ensureEliteMerchantFields = ensureEliteMerchantFields;
    Engine.emHasSkill = emHasSkill;
    Engine.grantEmXp = grantEmXp;
    Engine.tickEMCaravans = tickEMCaravans;
    Engine.tickNPCCaravans = tickNPCCaravans;
    Engine.tickKingdomCaravans = tickKingdomCaravans;
    Engine.tickKingdomMedicalLogistics = tickKingdomMedicalLogistics;
    Engine.tickEliteMerchantAI = tickEliteMerchantAI;
    Engine.getEmStorageCapacity = getEmStorageCapacity;
    Engine.getEmCurrentInventory = getEmCurrentInventory;
    Engine.npcOptimizeProduction = npcOptimizeProduction;
    Engine.tickNPCRetailBuildings = tickNPCRetailBuildings;
    Engine.calculateNetWorth = calculateNetWorth;
    Engine.getHighestRank = getHighestRank;
    Engine.getLeaderboard = getLeaderboard;

    // §19A3 — Elite Merchant Kingdom-Aware AI (all internal, called from tickEliteMerchantAI)

    // Elite Merchant Bidding
    Engine.tickEliteMerchantBidding = tickEliteMerchantBidding;

    // §19B — NPC Merchant Tick
    Engine.tickNPCMerchants = tickNPCMerchants;
    Engine.tickNPCMerchantTravel = tickNPCMerchantTravel;

    // §19B1b — Family Member Simulation
    Engine.tickFamilyMembers = tickFamilyMembers;

    // EM-NPC Relationship Favors
    Engine.tickEMRelationshipFavors = tickEMRelationshipFavors;

    // v9p33river434: Elite Merchant Agenda — parallel to getNobleAgenda for nobles
    function getEliteMerchantAgenda(emId) {
        _syncState();
        var em = findPerson(emId);
        if (!em || !em.alive || !em.isEliteMerchant) return null;
        ensureEliteMerchantFields(em);

        var p = em.personality || {};
        var strategy = em.strategy || 'diversified';
        var kId = em.kingdomId || em.citizenshipKingdomId;
        var k = kId ? findKingdom(kId) : null;
        var day = world ? world.day : 0;

        // Financial health assessment
        var gold = em.gold || 0;
        var nw = em.netWorth || calculateNetWorth(em);
        var bldCount = em.buildings ? em.buildings.length : 0;
        var caravanCount = em.emCaravans ? em.emCaravans.length : 0;
        var financialHealth = 'stable';
        if (gold < 1000 || (em._criticalGoldDays || 0) >= 10) financialHealth = 'distressed';
        else if (gold < 2000 || (em._lowGoldDays || 0) >= 3) financialHealth = 'struggling';
        else if (gold >= 10000 && bldCount >= 3) financialHealth = 'thriving';

        // Kingdom context
        var atWar = false;
        if (k && k.atWar) atWar = (Array.isArray(k.atWar) ? k.atWar.length : k.atWar.size) > 0;
        var lowTreasury = k && (k.gold || 0) < 2000;
        var hasPlague = false;
        try {
            if (k) {
                var _emTowns = Engine.getTownsForKingdom ? Engine.getTownsForKingdom(kId) : [];
                for (var _ti = 0; _ti < _emTowns.length; _ti++) { if (_emTowns[_ti].plagueActive) { hasPlague = true; break; } }
            }
        } catch(e) {}

        var goals = [];
        var plans = [];
        var concerns = [];

        // ── Strategy-driven goals ──
        var STRAT_LABELS = {
            food_monopoly: 'Food Monopolist', military_supplier: 'Military Supplier',
            luxury_trader: 'Luxury Trader', diversified: 'Diversified Trader',
            political_climber: 'Political Climber', war_profiteer: 'War Profiteer',
            land_baron: 'Land Baron', trade_network: 'Trade Network',
            medical_supplier: 'Medical Supplier', culture_trader: 'Culture Trader',
            retail_mogul: 'Retail Mogul'
        };
        var STRAT_ICONS = {
            food_monopoly: '🌾', military_supplier: '⚔️', luxury_trader: '💎',
            diversified: '📦', political_climber: '👑', war_profiteer: '🔥',
            land_baron: '🏗️', trade_network: '🛤️', medical_supplier: '🏥',
            culture_trader: '🎵', retail_mogul: '🏪'
        };

        goals.push({ icon: STRAT_ICONS[strategy] || '🎯', text: 'Pursuing ' + (STRAT_LABELS[strategy] || strategy) + ' strategy', weight: 80 });

        // Personality-driven goals
        if ((p.ambition || 50) >= 60) {
            var emRank = 0;
            if (em.socialRank && kId) emRank = em.socialRank[kId] || 0;
            if (emRank < 4) {
                goals.push({ icon: '⬆️', text: 'Seeking noble status through wealth and influence', weight: p.ambition });
            } else if (emRank < 6) {
                goals.push({ icon: '👑', text: 'Climbing the ranks of the court', weight: p.ambition });
            }
        }
        if ((p.greed || 50) >= 55) {
            goals.push({ icon: '💰', text: 'Maximizing profits above all else', weight: p.greed });
        }
        if ((p.social || 50) >= 60) {
            goals.push({ icon: '🤝', text: 'Building a network of trade relationships', weight: p.social });
        }
        if ((p.militarism || 50) >= 55 && atWar) {
            goals.push({ icon: '⚔️', text: 'Profiting from the war effort', weight: p.militarism + 10 });
        }
        if ((p.honesty || 50) < 35) {
            goals.push({ icon: '🎭', text: 'Operating in the shadows — smuggling, bribes', weight: 80 - (p.honesty || 50) });
        }
        if ((p.patience || 50) >= 60 && bldCount > 0) {
            goals.push({ icon: '📊', text: 'Steady growth through careful investment', weight: p.patience });
        }

        // ── Expansion plans ──
        var stratBlds = STRATEGY_BUILDINGS[strategy] || [];
        if (bldCount < 3 && gold >= 3000) {
            var nextBld = null;
            for (var sbi = 0; sbi < stratBlds.length; sbi++) {
                var hasBld = false;
                if (em.buildings) {
                    for (var ebi = 0; ebi < em.buildings.length; ebi++) {
                        if (em.buildings[ebi].type === stratBlds[sbi]) { hasBld = true; break; }
                    }
                }
                if (!hasBld) { nextBld = stratBlds[sbi]; break; }
            }
            if (nextBld) {
                var bldLabel = nextBld.replace(/_/g, ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); });
                plans.push({ icon: '🏗️', text: 'Looking to build a ' + bldLabel, weight: 70 });
            }
        } else if (bldCount >= 3 && gold >= 5000) {
            plans.push({ icon: '🏰', text: 'Expanding business empire with more buildings', weight: 60 });
        }

        if (caravanCount === 0 && bldCount >= 1 && gold >= 2000) {
            plans.push({ icon: '🐪', text: 'Planning to establish trade caravans', weight: 65 });
        } else if (caravanCount > 0) {
            plans.push({ icon: '🐪', text: 'Operating ' + caravanCount + ' trade caravan' + (caravanCount !== 1 ? 's' : ''), weight: 50 });
        }

        // Guild aspirations
        if (em._guildBonuses && Object.keys(em._guildBonuses).length > 0) {
            plans.push({ icon: '🏛️', text: 'Leveraging guild connections for advantage', weight: 55 });
        } else if ((p.social || 50) >= 50) {
            plans.push({ icon: '🏛️', text: 'Seeking guild membership', weight: 45 });
        }

        // Kingdom service
        if (em.ordersCompleted > 0) {
            plans.push({ icon: '📜', text: 'Fulfilling royal procurement orders (' + em.ordersCompleted + ' completed)', weight: 55 });
        }

        // Political climbing
        if (strategy === 'political_climber' && k) {
            plans.push({ icon: '🍷', text: 'Courting noble favor through luxury gifts', weight: 70 });
        }

        // Fallback
        if (plans.length === 0) {
            plans.push({ icon: '📈', text: 'Conducting daily trade operations', weight: 40 });
        }

        // ── Concerns ──
        if (financialHealth === 'distressed') {
            concerns.push({ icon: '💸', text: 'Facing bankruptcy — selling assets to survive', weight: 95 });
        } else if (financialHealth === 'struggling') {
            concerns.push({ icon: '⚠️', text: 'Finances under strain — seeking ways to cut costs', weight: 75 });
        }

        if (atWar && strategy !== 'war_profiteer' && strategy !== 'military_supplier') {
            concerns.push({ icon: '⚔️', text: 'War disrupting trade routes and markets', weight: 70 });
        }

        if (hasPlague) {
            if (strategy === 'medical_supplier') {
                plans.push({ icon: '🏥', text: 'Ramping up medical supply production', weight: 80 });
            } else {
                concerns.push({ icon: '🦠', text: 'Plague threatening business operations', weight: 65 });
            }
        }

        if (lowTreasury && k) {
            concerns.push({ icon: '🏦', text: 'Kingdom treasury low — tax hikes likely', weight: 60 });
        }

        if (em._seizureVictim) {
            concerns.push({ icon: '🔒', text: 'Assets previously seized — rebuilding cautiously', weight: 70 });
        }

        if (em.crimesCommitted > 0 || (em.criminalRecord && Object.keys(em.criminalRecord).length > 0)) {
            concerns.push({ icon: '🎭', text: 'Criminal record could attract unwanted attention', weight: 55 });
        }

        // Competition
        if (em._competitorTracking && Object.keys(em._competitorTracking).length > 0) {
            concerns.push({ icon: '🔍', text: 'Watching rival merchants closely', weight: 45 });
        }

        // Jail risk
        if ((em._jailedUntilDay || em.jailedUntilDay) && (em._jailedUntilDay || em.jailedUntilDay) > day) {
            concerns.push({ icon: '⛓️', text: 'Currently imprisoned', weight: 100 });
        }

        // Fallback
        if (concerns.length === 0) {
            if (financialHealth === 'thriving') {
                concerns.push({ icon: '✅', text: 'Business thriving — no major concerns', weight: 20 });
            } else {
                concerns.push({ icon: '📊', text: 'Maintaining steady operations', weight: 30 });
            }
        }

        // Sort by weight
        goals.sort(function(a, b) { return b.weight - a.weight; });
        plans.sort(function(a, b) { return b.weight - a.weight; });
        concerns.sort(function(a, b) { return b.weight - a.weight; });

        // Compute market influence (based on wealth, buildings, caravans, rank)
        var influence = 0;
        influence += Math.min(30, Math.floor(gold / 1000));
        influence += bldCount * 8;
        influence += caravanCount * 5;
        if (em.socialRank && kId) influence += (em.socialRank[kId] || 0) * 4;
        if (em.emLevel) influence += em.emLevel * 2;
        influence = Math.min(100, Math.max(0, influence));

        return {
            merchantId: emId,
            kingdomId: kId,
            strategy: strategy,
            strategyLabel: STRAT_LABELS[strategy] || strategy,
            goals: goals.slice(0, 3),
            plans: plans.slice(0, 3),
            concerns: concerns.slice(0, 3),
            financialHealth: financialHealth,
            netWorth: nw,
            influence: influence
        };
    }
    Engine.getEliteMerchantAgenda = getEliteMerchantAgenda;
    // v9p33river435: agenda system — expose strategy goods for trade intel
    Engine.getEMStrategyGoods = function(strategy) {
        return STRATEGY_GOODS[strategy] || STRATEGY_GOODS['diversified'] || [];
    };

})(window.Engine);