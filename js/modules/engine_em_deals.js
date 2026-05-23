// ========================================================
// engine_em_deals.js
// Elite Merchant Deals System — recurring trade agreements
// between Elite Merchants and the player.
// ========================================================
(function(Engine) {
    "use strict";
    if (!Engine) throw new Error("Engine must be loaded before engine_em_deals.js");

    // ── Internal state ──
    var world;
    function _syncState() { world = Engine.getWorld(); }

    // ── Engine utilities ──
    var logEvent = function(msg, details, category) { Engine.logEvent(msg, details, category); };
    var findTown = function(id) { return Engine.findTown(id); };
    var findPerson = function(id) { return Engine.findPerson(id); };
    var findKingdom = function(id) { return Engine.findKingdom(id); };
    var findBuildingType = function(id) { return Engine.findBuildingType(id); };
    var findResourceById = function(id) { return Engine.findResourceById(id); };
    var getMarketPrice = function(town, resId) { return Engine.getMarketPrice(town, resId); };

    // ── Constants ──
    var RELATIONSHIP_DEAL_ACCEPT = 5;
    var RELATIONSHIP_PLAYER_CANCEL = -10;
    var RELATIONSHIP_PLAYER_BROKE = -30;
    var MAX_DEAL_VALUE_BONUS_PCT = 20;
    var PROACTIVE_CANCEL_THRESHOLD = 2; // intervals missed before EM cancels
    var AI_TICK_INTERVAL = 7;

    // ── Helpers ──

    function _getResourceBasePrice(goodId) {
        var res = findResourceById(goodId);
        if (res && res.basePrice) return res.basePrice;
        if (typeof RESOURCE_TYPES !== 'undefined') {
            var keys = Object.keys(RESOURCE_TYPES);
            for (var i = 0; i < keys.length; i++) {
                if (RESOURCE_TYPES[keys[i]].id === goodId) return RESOURCE_TYPES[keys[i]].basePrice || 1;
            }
        }
        return 1;
    }

    function _getBuildingConsumes(buildingType) {
        var bt = findBuildingType(buildingType);
        if (!bt) return {};
        return bt.consumes || {};
    }

    function _getEMBuildings(em) {
        var results = [];
        if (!em || !em.buildings) return results;
        var seenTowns = {};
        var seenBuildings = {};
        for (var bi = 0; bi < em.buildings.length; bi++) {
            var bRef = em.buildings[bi];
            var townId = (bRef && bRef.townId) || em.townId;
            if (!townId || seenTowns[townId]) continue;
            seenTowns[townId] = true;
            var town = findTown(townId);
            if (!town || !town.buildings) continue;
            for (var ti = 0; ti < town.buildings.length; ti++) {
                var bld = town.buildings[ti];
                var bKey = (bld.id || (townId + ':' + ti));
                // v9p33river333: don't duplicate owned buildings once per stale em.buildings ref.
                if (bld.ownerId === em.id && !seenBuildings[bKey]) {
                    seenBuildings[bKey] = true;
                    results.push({ building: bld, townId: townId, town: town });
                }
            }
        }
        return results;
    }

    function _getGoodsEMProduces(em) {
        var produced = {};
        var emBuildings = _getEMBuildings(em);
        for (var i = 0; i < emBuildings.length; i++) {
            var bt = findBuildingType(emBuildings[i].building.type);
            if (bt && bt.produces) {
                produced[bt.produces] = true;
            }
            if (bt && bt.canProduce) {
                for (var cp = 0; cp < bt.canProduce.length; cp++) {
                    produced[bt.canProduce[cp]] = true;
                }
            }
        }
        return produced;
    }

    function _emHasGoodsInInventory(em, goodId, qty) {
        if (!em || !em.npcMerchantInventory) return false;
        return (em.npcMerchantInventory[goodId] || 0) >= qty;
    }

    function _deductEMInventory(em, goodId, qty) {
        if (!em.npcMerchantInventory) em.npcMerchantInventory = {};
        em.npcMerchantInventory[goodId] = (em.npcMerchantInventory[goodId] || 0) - qty;
        if (em.npcMerchantInventory[goodId] <= 0) delete em.npcMerchantInventory[goodId];
    }

    function _addEMInventory(em, goodId, qty) {
        if (!em.npcMerchantInventory) em.npcMerchantInventory = {};
        em.npcMerchantInventory[goodId] = (em.npcMerchantInventory[goodId] || 0) + qty;
    }

    function _getPlayerState() {
        return (typeof Player !== 'undefined' && Player.state) ? Player.state : null;
    }

    function _getPlayerTownId(ps) {
        if (!ps) return null;
        // v9p33river367: Player.state uses townId; currentTownId only exists on petition simulations.
        return ps.townId || ps.currentTownId || null;
    }

    function _getPlayerRelationship(personId) {
        if (typeof Player !== 'undefined' && Player.getRelationship) {
            return Player.getRelationship(personId) || { level: 0, type: 'acquaintance' };
        }
        return { level: 0, type: 'acquaintance' };
    }

    function _modifyRelationship(personId, amount) {
        if (typeof Player !== 'undefined' && Player.modifyRelationship) {
            Player.modifyRelationship(personId, amount);
        }
    }

    // v9p33river460: add memory to elite merchant for deal outcomes
    function _addEMMemory(emId, category, detail, sentiment) {
        var em = findPerson(emId);
        if (!em) return;
        if (!em._emMemory) em._emMemory = { playerActions: [], nobleActions: [] };
        var day = 0; try { day = Engine.getDay(); } catch(e) {}
        em._emMemory.playerActions.push({
            type: 'deal',
            source: 'player',
            category: category,
            detail: detail || '',
            actorId: 'player',
            targetId: emId,
            day: day,
            sentiment: sentiment || 0,
            kingdomId: em.kingdomId || ''
        });
        // Cap at 50 memories
        while (em._emMemory.playerActions.length > 50) em._emMemory.playerActions.shift();
    }

    function _playerInTown(townId) {
        var ps = _getPlayerState();
        if (!ps) return false;
        return _getPlayerTownId(ps) === townId;
    }

    function _findBuildingInTown(townId, buildingId) {
        var town = findTown(townId);
        if (!town || !town.buildings) return null;
        for (var i = 0; i < town.buildings.length; i++) {
            var bld = town.buildings[i];
            var bldKey = bld.type + '_' + i;
            if (bldKey === buildingId || bld.id === buildingId) return bld;
        }
        return null;
    }

    // Check that both deal buildings still exist and are owned by correct parties
    function _dealBuildingsValid(deal) {
        // Check EM building (where player delivers)
        if (deal.playerGives && deal.playerGives.townId && deal.playerGives.buildingId) {
            var emBld = _findBuildingInTown(deal.playerGives.townId, deal.playerGives.buildingId);
            if (!emBld) return false;
            if (emBld.ownerId !== deal.emId) return false;
        }
        // Check player building (where EM delivers)
        if (deal.emGives && deal.emGives.buildingId) {
            var ps = _getPlayerState();
            if (!ps || !ps.buildings) return false;
            var found = false;
            for (var i = 0; i < ps.buildings.length; i++) {
                if (ps.buildings[i].id === deal.emGives.buildingId) { found = true; break; }
            }
            if (!found) return false;
        }
        return true;
    }

    // ================================================================
    // 1. tickEMDeals — called from engine tick, runs daily
    // ================================================================
    function tickEMDeals() {
        _syncState();
        if (!world) return;
        if (!world.emDeals) world.emDeals = [];

        var rng = world.rng;

        for (var di = world.emDeals.length - 1; di >= 0; di--) {
            var deal = world.emDeals[di];
            if (deal.status !== 'active') continue;

            // Check building validity — cancel if buildings destroyed or changed owners
            if (!_dealBuildingsValid(deal)) {
                deal.status = 'cancelled_buildings';
                var em0 = findPerson(deal.emId);
                EventTypes.emit('EM_DEAL_CANCELLED_BUILDING_LOST', {
                    dealId: deal.id,
                    emId: deal.emId,
                    emName: em0 && em0.name
                });
                continue;
            }

            // Not yet delivery day
            if (world.day < deal.nextDeliveryDay) continue;

            // Grace period still active
            if (deal.gracePeriodEnd && world.day <= deal.gracePeriodEnd) continue;

            // Delivery day has arrived — evaluate
            var em = findPerson(deal.emId);
            if (!em) {
                deal.status = 'cancelled_by_em';
                EventTypes.emit('EM_DEAL_CANCELLED_MERCHANT_UNAVAILABLE', {
                    dealId: deal.id
                });
                continue;
            }

            // EM delivery attempt
            if (!deal.emDelivered) {
                emAttemptDelivery(deal);
            }

            // Check outcomes
            if (deal.emDelivered && deal.playerDelivered) {
                // Both delivered — success, advance to next period
                deal.emDelivered = false;
                deal.playerDelivered = false;
                deal.emDeliveryMethod = null;
                deal.gracePeriodEnd = null;
                deal.missedCount = 0;
                deal.nextDeliveryDay = world.day + deal.interval;
                EventTypes.emit('EM_DEAL_FULFILLED', {
                    dealId: deal.id,
                    emId: deal.emId,
                    emName: em.name,
                    interval: deal.interval
                });
            } else if (deal.emDelivered && !deal.playerDelivered) {
                // EM delivered but player did not
                deal.missedCount = (deal.missedCount || 0) + 1;
                deal.status = 'broken_by_player';

                // Penalty: relationship hit
                _modifyRelationship(deal.emId, RELATIONSHIP_PLAYER_BROKE);
                _addEMMemory(deal.emId, 'deal_broken', 'Player broke a trade deal', -3);

                // Penalty: player pays base value of undelivered goods
                var penalty = _getResourceBasePrice(deal.playerGives.good) * deal.playerGives.qty;
                var ps = _getPlayerState();
                if (ps) {
                    ps.gold = (ps.gold || 0) - penalty;
                    if (ps.gold < 0) ps.gold = 0;
                }

                EventTypes.emit('EM_DEAL_BROKEN_BY_PLAYER_PENALTY', {
                    dealId: deal.id,
                    emId: deal.emId,
                    emName: em && em.name,
                    playerQty: deal.playerGives.qty,
                    playerGood: deal.playerGives.good,
                    penalty: penalty
                });
            } else if (!deal.emDelivered && deal.playerDelivered) {
                // EM failed to deliver but player did — EM broke deal
                deal.missedCount = (deal.missedCount || 0) + 1;
                if (deal.missedCount >= PROACTIVE_CANCEL_THRESHOLD) {
                    deal.status = 'broken_by_em';
                    EventTypes.emit('EM_DEAL_BROKEN_BY_EM', {
                        dealId: deal.id,
                        emId: deal.emId,
                        emName: em.name
                    });
                } else {
                    // Grace: advance to next period, EM gets another chance
                    deal.emDelivered = false;
                    deal.playerDelivered = false;
                    deal.nextDeliveryDay = world.day + deal.interval;
                    EventTypes.emit('EM_DEAL_MISSED_CONTINUES', {
                        dealId: deal.id,
                        emId: deal.emId,
                        emName: em.name
                    });
                }
            } else {
                // Neither delivered — both missed, advance
                deal.missedCount = (deal.missedCount || 0) + 1;
                if (deal.missedCount >= PROACTIVE_CANCEL_THRESHOLD) {
                    deal.status = 'cancelled_by_em';
                    EventTypes.emit('EM_DEAL_CANCELLED_NON_DELIVERY', {
                        dealId: deal.id,
                        emId: deal.emId,
                        emName: em.name
                    });
                } else {
                    deal.emDelivered = false;
                    deal.playerDelivered = false;
                    deal.nextDeliveryDay = world.day + deal.interval;
                }
            }
        }

        // Run AI every 7 days
        if (world.day % AI_TICK_INTERVAL === 0) {
            tickEMDealAI();
        }
    }

    // ================================================================
    // 2. tickEMDealAI — EM AI for deal management (runs every 7 days)
    // ================================================================
    function tickEMDealAI() {
        _syncState();
        if (!world || !world.people) return;

        var rng = world.rng;

        for (var pi = 0; pi < world.people.length; pi++) {
            var em = world.people[pi];
            if (!em.isEliteMerchant) continue;

            // ── Build deal desires ──
            var desires = [];
            var produced = _getGoodsEMProduces(em);
            var emBuildings = _getEMBuildings(em);

            for (var bi = 0; bi < emBuildings.length; bi++) {
                var entry = emBuildings[bi];
                var bld = entry.building;
                var bt = findBuildingType(bld.type);
                if (!bt || !bt.consumes) continue;

                var consumes = bt.consumes;
                var consumeKeys = Object.keys(consumes);
                for (var ci = 0; ci < consumeKeys.length; ci++) {
                    var good = consumeKeys[ci];
                    var consumeQty = consumes[good];

                    // Skip if EM produces this good
                    if (produced[good]) continue;

                    // Check local market conditions
                    var town = entry.town;
                    var marketPrice = getMarketPrice(town, good);
                    var basePrice = _getResourceBasePrice(good);
                    var supply = (town && town.market && town.market.supply) ? (town.market.supply[good] || 0) : 0;
                    var demand = (town && town.market && town.market.demand) ? (town.market.demand[good] || 0) : 1;

                    var urgency = 0;
                    if (supply < demand) urgency += 2;
                    if (marketPrice > basePrice * 1.5) urgency += 2;
                    if (supply === 0) urgency += 3;
                    if (urgency === 0) urgency = 1;

                    desires.push({
                        good: good,
                        qty: consumeQty * 7, // weekly consumption as baseline
                        urgency: urgency,
                        buildingType: bld.type,
                        townId: entry.townId
                    });
                }
            }

            em._dealDesires = desires;

            // ── Check existing deals ──
            var activeDeals = getActiveDealsForEM(em.id);
            for (var adi = 0; adi < activeDeals.length; adi++) {
                var deal = activeDeals[adi];
                var canFulfill = _emHasGoodsInInventory(em, deal.emGives.good, deal.emGives.qty) ||
                                 produced[deal.emGives.good];

                if (!canFulfill) {
                    deal._cannotFulfillCount = (deal._cannotFulfillCount || 0) + 1;
                    if (deal._cannotFulfillCount >= PROACTIVE_CANCEL_THRESHOLD) {
                        cancelDeal(deal.id, 'em');
                    }
                } else {
                    deal._cannotFulfillCount = 0;
                }
            }
        }
    }

    // ================================================================
    // 3. emAttemptDelivery — EM tries to deliver goods for a deal
    // ================================================================
    function emAttemptDelivery(deal) {
        _syncState();
        var em = findPerson(deal.emId);
        if (!em) return;

        var goodId = deal.emGives.good;
        var qty = deal.emGives.qty;

        if (!_emHasGoodsInInventory(em, goodId, qty)) return;

        var emTown = em.townId || em.currentTownId;
        var deliverTown = deal.emGives.townId;

        if (emTown === deliverTown) {
            // Personal delivery — same town
            _deductEMInventory(em, goodId, qty);
            deal.emDelivered = true;
            deal.emDeliveryMethod = 'personal';
            EventTypes.emit('EM_DEAL_DELIVERED_PERSONAL', {
                dealId: deal.id,
                emId: em.id,
                emName: em.name,
                good: goodId,
                qty: qty
            });
        } else {
            // Caravan delivery
            // v9p33river333: confirm the caravan can route before consuming inventory/marking delivered.
            var _dealRoute = Engine.findPath ? Engine.findPath(emTown, deliverTown) : null;
            if (!_dealRoute || _dealRoute.length === 0) return;
            _deductEMInventory(em, goodId, qty);
            deal.emDelivered = true;
            deal.emDeliveryMethod = 'caravan';

            if (!world.npcCaravans) world.npcCaravans = [];
            world._dealCaravanSeq = (world._dealCaravanSeq || 0) + 1;
            world.npcCaravans.push({
                id: 'deal_caravan_' + world.day + '_' + deal.id + '_' + world._dealCaravanSeq,
                ownerId: em.id,
                ownerType: 'em',
                fromTownId: emTown,
                toTownId: deliverTown,
                goods: (function() { var g = {}; g[goodId] = qty; return g; })(),
                capacity: qty * 10,
                progress: 0,
                speed: (typeof CONFIG !== 'undefined' && CONFIG.EM_CARAVAN_SPEED) ? CONFIG.EM_CARAVAN_SPEED : 0.08,
                startDay: world.day,
                status: 'traveling',
                mode: 'one_way',
                returnGoods: {},
                tripCount: 0,
                dealId: deal.id
            });

            EventTypes.emit('EM_DEAL_DISPATCHED_CARAVAN', {
                dealId: deal.id,
                emId: em.id,
                emName: em.name,
                good: goodId,
                qty: qty
            });
        }
    }

    // ================================================================
    // 4. playerDeliverDealGoods — player delivers goods for a deal
    // ================================================================
    function playerDeliverDealGoods(dealId) {
        _syncState();
        if (!world || !world.emDeals) return { success: false, message: 'No deals available.' };

        var deal = null;
        for (var i = 0; i < world.emDeals.length; i++) {
            if (world.emDeals[i].id === dealId) { deal = world.emDeals[i]; break; }
        }

        if (!deal) return { success: false, message: 'Deal not found.' };
        if (deal.status !== 'active') return { success: false, message: 'This deal is no longer active.' };
        if (deal.playerDelivered) return { success: false, message: 'You have already delivered for this period.' };

        var ps = _getPlayerState();
        if (!ps) return { success: false, message: 'Player state unavailable.' };

        var goodId = deal.playerGives.good;
        var qty = deal.playerGives.qty;
        var deliverTownId = deal.playerGives.townId;

        // Check player is in the right town
        if (!_playerInTown(deliverTownId)) {
            var town = findTown(deliverTownId);
            return { success: false, message: 'You must be in ' + ((town && town.name) || 'the delivery town') + ' to deliver goods.' };
        }

        // Check player has goods
        if (!ps.inventory || (ps.inventory[goodId] || 0) < qty) {
            return { success: false, message: 'You need ' + qty + ' ' + goodId + ' but do not have enough.' };
        }

        // Deduct from player inventory
        ps.inventory[goodId] = (ps.inventory[goodId] || 0) - qty;
        if (ps.inventory[goodId] <= 0) delete ps.inventory[goodId];

        deal.playerDelivered = true;

        var em = findPerson(deal.emId);
        EventTypes.emit('EM_DEAL_PLAYER_DELIVERED', {
            dealId: deal.id,
            emId: deal.emId,
            emName: em && em.name,
            good: goodId,
            qty: qty
        });

        return { success: true, message: 'Delivered ' + qty + ' ' + goodId + ' successfully.' };
    }

    // ================================================================
    // 5. createDealOffer — generate what an EM would offer
    // ================================================================
    function createDealOffer(emId) {
        _syncState();
        if (!world) return [];

        var em = findPerson(emId);
        if (!em || !em.isEliteMerchant) return [];

        var desires = em._dealDesires || [];
        if (desires.length === 0) return [];

        var rel = _getPlayerRelationship(emId);
        var relLevel = rel.level || 0;
        var personality = em.personality || {};
        var warmth = personality.warmth || 50;
        var selfishness = personality.selfishness || 50;

        // Bonus for player: higher relationship + warmth = better deal
        // Range: -10% (low rel, selfish) to +20% (high rel, warm)
        var warmthFactor = (warmth - 50) / 100;       // -0.5 to +0.5
        var selfFactor = (50 - selfishness) / 100;     // -0.5 to +0.5
        var relFactor = relLevel / 100;                // 0 to 1
        var bonusPct = (relFactor * 10 + warmthFactor * 5 + selfFactor * 5);
        if (bonusPct > MAX_DEAL_VALUE_BONUS_PCT) bonusPct = MAX_DEAL_VALUE_BONUS_PCT;
        if (bonusPct < -10) bonusPct = -10;

        // What the EM can offer (goods they produce or have surplus of)
        var produced = _getGoodsEMProduces(em);
        var inv = em.npcMerchantInventory || {};
        var surplus = [];
        var producedKeys = Object.keys(produced);
        for (var pk = 0; pk < producedKeys.length; pk++) {
            surplus.push(producedKeys[pk]);
        }
        var invKeys = Object.keys(inv);
        for (var ik = 0; ik < invKeys.length; ik++) {
            if (inv[invKeys[ik]] > 10 && surplus.indexOf(invKeys[ik]) === -1) {
                surplus.push(invKeys[ik]);
            }
        }

        if (surplus.length === 0) return [];

        var offers = [];
        var rng = world.rng;
        var intervals = [14, 30, 60];

        // Get EM buildings for delivery targets
        // v9p33river305: prefer the stable bld.id when present; only fall
        // back to the synthetic `type_N` form for legacy buildings without
        // an id. Synthetic IDs broke when town.buildings was reordered.
        var emBuildings = _getEMBuildings(em);
        var emBuildingRef = null;
        var emBuildingTown = null;
        if (emBuildings.length > 0) {
            var chosen = emBuildings[rng.randInt(0, emBuildings.length - 1)];
            emBuildingRef = (chosen.building && chosen.building.id) ? chosen.building.id : (chosen.building.type + '_0');
            emBuildingTown = chosen.townId;
        }

        // Player buildings for EM to deliver to
        var ps = _getPlayerState();
        var playerBuildingRef = null;
        var playerBuildingTown = null;
        var playerTownId = _getPlayerTownId(ps);
        if (ps && playerTownId) {
            var pTown = findTown(playerTownId);
            if (pTown && pTown.buildings) {
                for (var pbi = 0; pbi < pTown.buildings.length; pbi++) {
                    if (pTown.buildings[pbi].ownerId === 'player') {
                        var _pb = pTown.buildings[pbi];
                        playerBuildingRef = _pb.id || (_pb.type + '_' + pbi);
                        playerBuildingTown = playerTownId;
                        break;
                    }
                }
            }
        }

        // Generate up to 3 offers based on desires
        var maxOffers = Math.min(desires.length, 3);
        for (var oi = 0; oi < maxOffers; oi++) {
            var desire = desires[oi];
            var desiredGood = desire.good;
            var desiredQty = desire.qty;

            // Pick an EM surplus good to offer
            var offeredGood = surplus[rng.randInt(0, surplus.length - 1)];

            // Calculate roughly equal value exchange
            var desiredValue = _getResourceBasePrice(desiredGood) * desiredQty;
            var offeredBasePrice = _getResourceBasePrice(offeredGood);
            if (offeredBasePrice <= 0) offeredBasePrice = 1;

            // Apply bonus: EM gives more (or player gives less) with good relationship
            var adjustedValue = desiredValue * (1 + bonusPct / 100);
            var offeredQty = Math.max(1, Math.round(adjustedValue / offeredBasePrice));

            var interval = intervals[rng.randInt(0, intervals.length - 1)];

            // Scale quantities to interval
            var intervalScale = interval / 14;
            var scaledDesiredQty = Math.max(1, Math.round(desiredQty * intervalScale));
            var scaledOfferedQty = Math.max(1, Math.round(offeredQty * intervalScale));

            offers.push({
                emGives: {
                    good: offeredGood,
                    qty: scaledOfferedQty,
                    buildingId: playerBuildingRef,
                    townId: playerBuildingTown || _getPlayerTownId(ps)
                },
                playerGives: {
                    good: desiredGood,
                    qty: scaledDesiredQty,
                    buildingId: emBuildingRef,
                    townId: emBuildingTown || em.townId
                },
                interval: interval,
                bonusPct: Math.round(bonusPct * 10) / 10
            });
        }

        return offers;
    }

    // ================================================================
    // 6. acceptDeal — player accepts a deal offer
    // ================================================================
    function acceptDeal(emId, dealOffer) {
        _syncState();
        if (!world) return { success: false, message: 'World not loaded.' };

        var em = findPerson(emId);
        if (!em || !em.isEliteMerchant) return { success: false, message: 'Invalid merchant.' };

        if (!dealOffer || !dealOffer.emGives || !dealOffer.playerGives) {
            return { success: false, message: 'Invalid deal offer.' };
        }

        if (!world.emDeals) world.emDeals = [];

        var dealId = 'deal_' + world.day + '_' + world.emDeals.length;

        var deal = {
            id: dealId,
            emId: emId,
            playerId: 'player',
            status: 'active',
            createdDay: world.day,

            emGives: {
                good: dealOffer.emGives.good,
                qty: dealOffer.emGives.qty,
                buildingId: dealOffer.emGives.buildingId || null,
                townId: dealOffer.emGives.townId || null
            },
            playerGives: {
                good: dealOffer.playerGives.good,
                qty: dealOffer.playerGives.qty,
                buildingId: dealOffer.playerGives.buildingId || null,
                townId: dealOffer.playerGives.townId || null
            },

            interval: dealOffer.interval || 14,
            nextDeliveryDay: world.day + (dealOffer.interval || 14),

            emDelivered: false,
            playerDelivered: false,
            emDeliveryMethod: null,
            gracePeriodEnd: null,
            missedCount: 0
        };

        world.emDeals.push(deal);

        _modifyRelationship(emId, RELATIONSHIP_DEAL_ACCEPT);
        _addEMMemory(emId, 'deal_accepted', 'Player accepted a trade deal', 1);

        EventTypes.emit('EM_DEAL_ACCEPTED', {
            dealId: dealId,
            emId: emId,
            emName: em.name,
            playerQty: deal.playerGives.qty,
            playerGood: deal.playerGives.good,
            emQty: deal.emGives.qty,
            emGood: deal.emGives.good,
            interval: deal.interval
        });

        return { success: true, message: 'Deal accepted!', dealId: dealId };
    }

    // ================================================================
    // 7. cancelDeal — either party cancels
    // ================================================================
    function cancelDeal(dealId, cancelledBy) {
        _syncState();
        if (!world || !world.emDeals) return { success: false, message: 'No deals available.' };

        var deal = null;
        for (var i = 0; i < world.emDeals.length; i++) {
            if (world.emDeals[i].id === dealId) { deal = world.emDeals[i]; break; }
        }

        if (!deal) return { success: false, message: 'Deal not found.' };
        if (deal.status !== 'active') return { success: false, message: 'Deal is already inactive.' };

        var em = findPerson(deal.emId);
        var emName = (em && em.name) || 'Elite Merchant';

        if (cancelledBy === 'player') {
            deal.status = 'broken_by_player';
            _modifyRelationship(deal.emId, RELATIONSHIP_PLAYER_CANCEL);
            _addEMMemory(deal.emId, 'deal_cancelled', 'Player cancelled a trade deal', -2);
            EventTypes.emit('EM_DEAL_CANCELLED_BY_PLAYER', {
                dealId: dealId,
                emId: deal.emId,
                emName: emName
            });
        } else {
            deal.status = 'cancelled_by_em';
            EventTypes.emit('EM_DEAL_CANCELLED_BY_EM', {
                dealId: dealId,
                emId: deal.emId,
                emName: emName
            });
        }

        return { success: true, message: 'Deal cancelled.' };
    }

    // ================================================================
    // 8. getEMDeals — return all deals (for UI)
    // ================================================================
    function getEMDeals() {
        _syncState();
        if (!world || !world.emDeals) return [];
        return world.emDeals;
    }

    // ================================================================
    // 9. getActiveDealsForEM — get active deals with specific EM
    // ================================================================
    function getActiveDealsForEM(emId) {
        _syncState();
        if (!world || !world.emDeals) return [];
        var results = [];
        for (var i = 0; i < world.emDeals.length; i++) {
            if (world.emDeals[i].emId === emId && world.emDeals[i].status === 'active') {
                results.push(world.emDeals[i]);
            }
        }
        return results;
    }

    // ================================================================
    // 10. canPlayerDeliverToDeal — check if player can deliver
    // ================================================================
    function canPlayerDeliverToDeal(dealId) {
        _syncState();
        if (!world || !world.emDeals) return false;

        var deal = null;
        for (var i = 0; i < world.emDeals.length; i++) {
            if (world.emDeals[i].id === dealId) { deal = world.emDeals[i]; break; }
        }

        if (!deal || deal.status !== 'active') return false;
        if (deal.playerDelivered) return false;

        var ps = _getPlayerState();
        if (!ps) return false;

        // Check player is in the right town
        if (!_playerInTown(deal.playerGives.townId)) return false;

        // Check player has the goods
        var goodId = deal.playerGives.good;
        var qty = deal.playerGives.qty;
        if (!ps.inventory || (ps.inventory[goodId] || 0) < qty) return false;

        return true;
    }

    // ================================================================
    // Exports
    // ================================================================
    Engine.tickEMDeals = tickEMDeals;
    Engine.tickEMDealAI = tickEMDealAI;
    Engine.emAttemptDelivery = emAttemptDelivery;
    Engine.playerDeliverDealGoods = playerDeliverDealGoods;
    Engine.createDealOffer = createDealOffer;
    Engine.acceptDeal = acceptDeal;
    Engine.cancelDeal = cancelDeal;
    Engine.getEMDeals = getEMDeals;
    Engine.getActiveDealsForEM = getActiveDealsForEM;
    Engine.canPlayerDeliverToDeal = canPlayerDeliverToDeal;

})(typeof Engine !== 'undefined' ? Engine : null);

