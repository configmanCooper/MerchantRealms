// ============================================================
// Merchant Realms — UI Elite Merchant Trades & Deals Module
// Provides trade UI for buying EM inventory/buildings and deal management
// ============================================================
(function(UI) {
    "use strict";
    if (!UI) throw new Error("UI must be loaded before ui_em_deals.js");

    var openModal = UI.openModal;
    var closeModal = UI.closeModal;
    var toast = UI.toast;
    var formatGold = UI.formatGold;

    // v9p33river367: tolerate missing top-level RESOURCE_TYPES by falling back
    // to CONFIG.ITEMS, which is the canonical lowercase mirror.
    function _findTradeResource(goodId) {
        var source = (typeof RESOURCE_TYPES !== 'undefined' && RESOURCE_TYPES) ? RESOURCE_TYPES : ((typeof CONFIG !== 'undefined' && CONFIG.ITEMS) ? CONFIG.ITEMS : null);
        if (!source) return null;
        if (source[goodId]) return source[goodId];
        for (var rk in source) {
            if (source[rk] && source[rk].id === goodId) return source[rk];
        }
        return null;
    }

    // ── EM TRADE DIALOG ──
    // Trade goods from EM inventory with relationship-based discounts
    function openEMTrade(emId) {
        var em = Engine.findPerson(emId);
        if (!em || !em.alive || !em.isEliteMerchant) {
            toast('Elite merchant not found.', 'error');
            return;
        }
        var playerTown = Engine.findTown(Player.townId);
        if (!playerTown || em.townId !== Player.townId) {
            toast('You must be in the same town as the merchant.', 'warning');
            return;
        }

        var rel = Player.getRelationship ? Player.getRelationship(emId) : { level: 0 };
        var relLevel = rel.level || 0;
        // Discount: max 10% at 100 relationship + up to 5% from trading skill
        var tradingSkill = (Player.state && Player.state.skills) ? (Player.state.skills.trading || 0) : 0;
        var relDiscount = Math.min(10, Math.floor(relLevel / 10));
        var skillDiscount = Math.min(5, Math.floor(tradingSkill / 20));
        var totalDiscount = relDiscount + skillDiscount;

        var emName = (em.firstName || '') + ' ' + (em.lastName || '');

        // Build inventory tab
        var inv = em.npcMerchantInventory || {};
        var invKeys = Object.keys(inv).filter(function(k) { return (inv[k] || 0) > 0; });

        var html = '<div style="max-height:500px;overflow-y:auto;">';

        // Tab bar
        html += '<div style="display:flex;gap:4px;margin-bottom:8px;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:6px;">';
        html += '<button class="btn-medieval emtrade-tab active" data-action="emTradeTab" data-tab="goods" data-emid="' + emId + '" style="font-size:0.72rem;padding:4px 10px;">🛒 Goods</button>';
        html += '<button class="btn-medieval emtrade-tab" data-action="emTradeTab" data-tab="buildings" data-emid="' + emId + '" style="font-size:0.72rem;padding:4px 10px;">🏗️ Buildings</button>';
        html += '</div>';

        // Discount info
        html += '<div style="font-size:0.7rem;color:#6ab4ff;margin-bottom:6px;">💎 Your discount: ' + totalDiscount + '% (Relationship ' + relDiscount + '% + Skill ' + skillDiscount + '%)</div>';

        // Goods tab
        html += '<div id="emTradeGoods">';
        if (invKeys.length === 0) {
            html += '<div style="color:#888;font-size:0.8rem;text-align:center;padding:20px;">This merchant has no goods available for trade.</div>';
        } else {
            html += '<div style="display:grid;grid-template-columns:1fr auto auto auto;gap:2px;font-size:0.72rem;">';
            html += '<div style="font-weight:bold;color:#aaa;padding:4px;">Item</div>';
            html += '<div style="font-weight:bold;color:#aaa;padding:4px;text-align:center;">Avail</div>';
            html += '<div style="font-weight:bold;color:#aaa;padding:4px;text-align:center;">Price</div>';
            html += '<div style="font-weight:bold;color:#aaa;padding:4px;text-align:center;">Buy</div>';
            for (var i = 0; i < invKeys.length; i++) {
                var goodId = invKeys[i];
                var qty = inv[goodId];
                var res = _findTradeResource(goodId);
                var resName = res ? ((res.icon || '') + ' ' + res.name) : goodId;
                var basePrice = res ? (res.basePrice || 10) : 10;
                // Check local market price too
                var marketPrice = (playerTown.market && playerTown.market.prices && playerTown.market.prices[goodId]) ?
                    playerTown.market.prices[goodId] : basePrice;
                // EM sells at market price minus discount
                var sellPrice = Math.max(1, Math.round(marketPrice * (1 - totalDiscount / 100)));
                html += '<div style="padding:4px;border-top:1px solid rgba(255,255,255,0.05);">' + resName + '</div>';
                html += '<div style="padding:4px;text-align:center;border-top:1px solid rgba(255,255,255,0.05);">' + qty + '</div>';
                html += '<div style="padding:4px;text-align:center;color:var(--gold);border-top:1px solid rgba(255,255,255,0.05);">' + sellPrice + 'g</div>';
                html += '<div style="padding:4px;text-align:center;border-top:1px solid rgba(255,255,255,0.05);">';
                html += '<input type="number" min="1" max="' + qty + '" value="1" id="emBuyQty_' + goodId + '" style="width:40px;font-size:0.7rem;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.15);border-radius:3px;color:#fff;padding:2px;text-align:center;">';
                html += '<button class="btn-medieval" data-action="emBuyGood" data-emid="' + emId + '" data-good="' + goodId + '" data-price="' + sellPrice + '" style="font-size:0.65rem;padding:2px 6px;margin-left:2px;">Buy</button>';
                html += '</div>';
            }
            html += '</div>';
        }
        html += '</div>';

        // Buildings tab (hidden by default)
        html += '<div id="emTradeBuildings" style="display:none;">';
        html += _buildEMBuildingsTab(em, relLevel, totalDiscount);
        html += '</div>';

        html += '</div>';

        openModal('💼 Trade with ' + emName, html);
    }

    function _buildEMBuildingsTab(em, relLevel, discount) {
        var html = '';
        // Find all buildings owned by this EM
        var emBuildings = [];
        var towns = Engine.getTowns ? Engine.getTowns() : [];
        for (var ti = 0; ti < towns.length; ti++) {
            var t = towns[ti];
            if (!t.buildings) continue;
            for (var bi = 0; bi < t.buildings.length; bi++) {
                var b = t.buildings[bi];
                if (b.ownerId === em.id) {
                    emBuildings.push({ building: b, town: t, index: bi });
                }
            }
        }

        if (emBuildings.length === 0) {
            html += '<div style="color:#888;font-size:0.8rem;text-align:center;padding:20px;">This merchant owns no buildings.</div>';
            return html;
        }

        // Player social rank
        var playerRank = 0;
        if (Player.state && Player.state.socialRank) {
            for (var srk in Player.state.socialRank) {
                if ((Player.state.socialRank[srk] || 0) > playerRank) playerRank = Player.state.socialRank[srk];
            }
        }
        var emRank = 0;
        if (em.socialRank) {
            for (var erk in em.socialRank) {
                if ((em.socialRank[erk] || 0) > emRank) emRank = em.socialRank[erk];
            }
        }

        html += '<div style="font-size:0.68rem;color:#888;margin-bottom:6px;">Buildings available depends on relationship and merchant willingness.</div>';

        for (var ei = 0; ei < emBuildings.length; ei++) {
            var entry = emBuildings[ei];
            var b = entry.building;
            var t = entry.town;
            var bType = Engine.findBuildingType ? Engine.findBuildingType(b.type) : null;
            if (!bType) {
                for (var btk in BUILDING_TYPES) {
                    if (BUILDING_TYPES[btk].id === b.type) { bType = BUILDING_TYPES[btk]; break; }
                }
            }
            var bName = bType ? bType.name : b.type;
            var baseCost = bType ? (bType.cost || 500) : 500;

            // Valuation: land cost + materials*level + last 90 days profit
            var landBase = (typeof CONFIG !== 'undefined' && CONFIG.LAND_COST_BASE) ? CONFIG.LAND_COST_BASE : 200;
            var sizeMult = (typeof CONFIG !== 'undefined' && CONFIG.LAND_COST_MULTIPLIER && CONFIG.LAND_COST_MULTIPLIER[t.category]) ? CONFIG.LAND_COST_MULTIPLIER[t.category] : 1.0;
            var landCost = Math.floor(landBase * sizeMult * Math.max(0.5, (t.prosperity || 50) / 50));
            var materialsCost = baseCost;
            var levelMultiplier = b.level || 1;
            var profit90 = b._profitTracker ? (b._profitTracker.totalProfit || 0) : 0;
            var valuation = (landCost + materialsCost * levelMultiplier) + Math.max(0, profit90);
            // Strategy-critical buildings: premium
            var isStrategic = false;
            if (em.strategy && bType) {
                var stratGoods = _getStrategyGoods(em.strategy);
                if (stratGoods && bType.produces && stratGoods.indexOf(bType.produces) >= 0) {
                    isStrategic = true;
                    valuation *= 1.5;
                }
            }
            // Apply discount
            var finalPrice = Math.max(baseCost, Math.round(valuation * (1 - discount / 100)));

            // Stacking markup from previous purchases
            var purchaseCount = (Player.state._emBuildingPurchases && Player.state._emBuildingPurchases[em.id]) || 0;
            var stackingMarkup = Math.min(purchaseCount * 0.10, 1.0);
            if (stackingMarkup > 0) {
                finalPrice = Math.round(finalPrice * (1 + stackingMarkup));
            }
            var markupPct = Math.round(stackingMarkup * 100);

            // Willingness to sell
            var willing = true;
            var reason = '';
            if (isStrategic && relLevel < 80) {
                willing = false;
                reason = 'Critical to strategy (need 80+ relationship)';
            } else if (isStrategic && playerRank < emRank) {
                willing = false;
                reason = 'Requires equal or higher social rank';
            } else if (relLevel < 30) {
                willing = false;
                reason = 'Relationship too low (need 30+)';
            }

            var rowBg = willing ? 'rgba(100,180,100,0.05)' : 'rgba(150,80,80,0.05)';
            html += '<div style="padding:8px;margin-bottom:4px;background:' + rowBg + ';border:1px solid rgba(255,255,255,0.08);border-radius:4px;">';
            html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
            html += '<div>';
            html += '<div style="font-size:0.78rem;font-weight:bold;">' + bName + (b.level > 1 ? ' (Lv' + b.level + ')' : '') + '</div>';
            html += '<div style="font-size:0.65rem;color:#888;">📍 ' + t.name;
            if (bType && bType.produces) html += ' | Produces: ' + bType.produces;
            if (isStrategic) html += ' | ⚠️ Strategic';
            if (markupPct > 0) html += ' | <span style="color:#e67e22;">(+' + markupPct + '% markup from previous purchases)</span>';
            html += '</div>';
            html += '</div>';
            html += '<div style="text-align:right;">';
            if (willing) {
                html += '<div style="font-size:0.8rem;color:var(--gold);font-weight:bold;">' + formatGold(finalPrice) + '</div>';
                html += '<button class="btn-medieval" data-action="emBuyBuilding" data-emid="' + em.id + '" data-town="' + t.id + '" data-bindex="' + entry.index + '" data-price="' + finalPrice + '" style="font-size:0.65rem;padding:2px 8px;">Buy</button>';
            } else {
                html += '<div style="font-size:0.65rem;color:#c44e52;">❌ ' + reason + '</div>';
            }
            html += '</div></div></div>';
        }
        return html;
    }

    function _getStrategyGoods(strategy) {
        // v9p33river399: removed invalid ids (weapons, shields, exotic_goods, instruments, books, art, clothes, furniture, pottery)
        var map = {
            food_monopoly: ['wheat', 'bread', 'flour', 'meat', 'poultry', 'eggs', 'fish', 'preserved_food'],
            military_supplier: ['iron', 'steel', 'swords', 'bows', 'arrows', 'armor', 'horses'],
            luxury_trader: ['wine', 'jewelry', 'silk', 'perfume', 'spices'],
            diversified: [],
            political_climber: [],
            war_profiteer: ['swords', 'armor', 'horses', 'iron', 'steel'],
            land_baron: [],
            trade_network: [],
            medical_supplier: ['herbs', 'medicine', 'bandages'],
            culture_trader: ['paper', 'ink', 'dye'],
            retail_mogul: ['cloth', 'tools', 'leather', 'rope']
        };
        return map[strategy] || [];
    }

    // ── BUY GOOD FROM EM ──
    function emBuyGood(emId, goodId, pricePerUnit) {
        var em = Engine.findPerson(emId);
        if (!em || !em.alive) { toast('Merchant not available.', 'error'); return; }
        if (em.townId !== Player.townId) { toast('Must be in same town.', 'warning'); return; }

        var qtyEl = document.getElementById('emBuyQty_' + goodId);
        var qty = qtyEl ? parseInt(qtyEl.value) || 1 : 1;
        var available = (em.npcMerchantInventory || {})[goodId] || 0;
        if (qty > available) { toast('Only ' + available + ' available.', 'warning'); return; }

        var totalCost = pricePerUnit * qty;
        if ((Player.state.gold || 0) < totalCost) {
            toast('Not enough gold. Need ' + formatGold(totalCost) + '.', 'warning');
            return;
        }

        // Execute trade
        Player.state.gold -= totalCost;
        em.gold = (em.gold || 0) + totalCost;
        em.npcMerchantInventory[goodId] -= qty;
        if (em.npcMerchantInventory[goodId] <= 0) delete em.npcMerchantInventory[goodId];
        if (!Player.state.inventory) Player.state.inventory = {};
        Player.state.inventory[goodId] = (Player.state.inventory[goodId] || 0) + qty;

        // Relationship boost for trading
        if (Player.modifyRelationship) Player.modifyRelationship(emId, 1);

        var res = _findTradeResource(goodId);
        var resName = res ? res.name : goodId;
        toast('✅ Bought ' + qty + ' ' + resName + ' for ' + formatGold(totalCost), 'success');

        // Refresh the trade dialog
        openEMTrade(emId);
    }

    // ── BUY BUILDING FROM EM ──
    function emBuyBuilding(emId, townId, buildingIndex, price) {
        var em = Engine.findPerson(emId);
        if (!em || !em.alive) { toast('Merchant not available.', 'error'); return; }
        var town = Engine.findTown(townId);
        if (!town || !town.buildings || !town.buildings[buildingIndex]) {
            toast('Building not found.', 'error'); return;
        }
        var b = town.buildings[buildingIndex];
        if (b.ownerId !== em.id) { toast('Merchant no longer owns this building.', 'error'); return; }
        if ((Player.state.gold || 0) < price) {
            toast('Not enough gold. Need ' + formatGold(price) + '.', 'warning'); return;
        }

        // Transfer ownership
        Player.state.gold -= price;
        em.gold = (em.gold || 0) + price;
        // v9p33river305: previously the player-side building was a fresh
        // clone (with a new id) while the town-side building's `id` was
        // ALSO mutated. That created two divergent records. Reuse the
        // town building object directly so there's a single source of
        // truth, then transfer ownership in-place. Also: the EM-building
        // filter below was per-(town, type) which deleted ALL same-type
        // buildings the EM owned in that town. Now we filter by exact
        // building reference (or id, if available).
        var _sameRef = b;
        b.ownerId = 'player';
        b.workers = [];
        b.inventory = b.inventory || {};
        b.active = true;
        b.level = b.level || 1;
        b.builtDay = b.builtDay || (Engine.getDay ? Engine.getDay() : 0);
        b.condition = b.condition || 'new';
        b.lastRepairDay = b.lastRepairDay || 0;
        b.transferTarget = null;
        b.transferEnabled = false;
        if (!b.id) b.id = 'bld_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);

        // Update EM's building list — remove only the specific building purchased
        // v9p33river317: EM building refs are usually pushed without
        // IDs (8 sites in engine_elite_merchants.js push {type,townId,
        // level} only). The id-only match never fired, leaving stale
        // ownership refs after every sale. Now: prefer id match; fall
        // back to first (townId, type) match so the right stale ref is
        // removed without deleting all same-type refs.
        if (em.buildings) {
            var _refRemoved = false;
            em.buildings = em.buildings.filter(function(br) {
                if (br.id && b.id && br.id === b.id) return false;
                if (!_refRemoved && !br.id && br.townId === townId && br.type === b.type) {
                    _refRemoved = true;
                    return false;
                }
                return true;
            });
        }

        // Add to player buildings list (point to the same town building)
        if (!Player.state.buildings) Player.state.buildings = [];
        Player.state.buildings.push({
            id: b.id,
            type: b.type,
            townId: townId,
            workers: [],
            active: true,
            level: b.level,
            builtDay: b.builtDay,
            condition: b.condition,
            lastRepairDay: b.lastRepairDay,
            transferTarget: null,
            transferEnabled: false,
        });

        // Relationship boost
        if (Player.modifyRelationship) Player.modifyRelationship(emId, 3);

        // Track purchase count for stacking markup
        if (!Player.state._emBuildingPurchases) Player.state._emBuildingPurchases = {};
        Player.state._emBuildingPurchases[emId] = ((Player.state._emBuildingPurchases[emId]) || 0) + 1;

        var bType = Engine.findBuildingType ? Engine.findBuildingType(b.type) : null;
        var bName = bType ? bType.name : b.type;
        toast('✅ Purchased ' + bName + ' in ' + town.name + ' for ' + formatGold(price), 'success');

        // Refresh
        openEMTrade(emId);
    }

    // ── Helper: check if a player building can accept a good ──
    function _buildingAcceptsGood(bld, goodId) {
        var bt = null;
        if (typeof BUILDING_TYPES !== 'undefined') {
            for (var btk in BUILDING_TYPES) {
                if (BUILDING_TYPES[btk].id === bld.type) { bt = BUILDING_TYPES[btk]; break; }
            }
        }
        if (!bt && Engine.findBuildingType) bt = Engine.findBuildingType(bld.type);
        if (!bt) return false;
        // Storage buildings (warehouses) accept anything
        if (bt.category === 'storage') return true;
        // Check primary consumes
        if (bt.consumes && bt.consumes[goodId]) return true;
        // Check all available product recipes
        if (bt.availableProducts) {
            for (var pk in bt.availableProducts) {
                var recipe = bt.availableProducts[pk];
                if (recipe.consumes && recipe.consumes[goodId]) return true;
            }
        }
        return false;
    }

    // ── Helper: get player buildings that can accept a good ──
    function _getPlayerBuildingsForGood(goodId) {
        var results = [];
        if (!Player.state || !Player.state.buildings) return results;
        for (var i = 0; i < Player.state.buildings.length; i++) {
            var bld = Player.state.buildings[i];
            if (_buildingAcceptsGood(bld, goodId)) {
                var town = Engine.findTown ? Engine.findTown(bld.townId) : null;
                var bt = Engine.findBuildingType ? Engine.findBuildingType(bld.type) : null;
                if (!bt && typeof BUILDING_TYPES !== 'undefined') {
                    for (var btk in BUILDING_TYPES) {
                        if (BUILDING_TYPES[btk].id === bld.type) { bt = BUILDING_TYPES[btk]; break; }
                    }
                }
                results.push({
                    building: bld,
                    index: i,
                    townName: town ? town.name : 'Unknown',
                    townId: bld.townId,
                    buildingName: bt ? bt.name : bld.type,
                    buildingId: bld.id
                });
            }
        }
        return results;
    }

    // ── EM DEALS UI ──
    function openEMDeals(emId) {
        var em = Engine.findPerson(emId);
        if (!em || !em.alive || !em.isEliteMerchant) {
            toast('Elite merchant not found.', 'error'); return;
        }

        var emName = (em.firstName || '') + ' ' + (em.lastName || '');
        var rel = Player.getRelationship ? Player.getRelationship(emId) : { level: 0 };
        var relLevel = rel.level || 0;

        // Check if player has at least one building
        var playerBuildings = (Player.state && Player.state.buildings) ? Player.state.buildings : [];
        if (playerBuildings.length === 0) {
            var html = '<div style="text-align:center;padding:30px;">';
            html += '<div style="font-size:1.1rem;margin-bottom:10px;">🏗️ No Buildings</div>';
            html += '<div style="font-size:0.8rem;color:#aaa;">You need at least one building before you can make deals with elite merchants. The merchant needs somewhere to deliver goods to.</div>';
            html += '</div>';
            openModal('🤝 Deals with ' + emName, html);
            return;
        }

        // Get existing deals with this EM
        var allDeals = Engine.getEMDeals ? Engine.getEMDeals() : [];
        var activeDeals = allDeals.filter(function(d) { return d.emId === emId && d.status === 'active'; });

        var html = '<div style="max-height:500px;overflow-y:auto;">';
        html += '<div style="font-size:0.7rem;color:#888;margin-bottom:8px;">Relationship: ' + relLevel + '/100 | Active deals: ' + activeDeals.length + '</div>';

        // Active deals
        if (activeDeals.length > 0) {
            html += '<div style="margin-bottom:12px;">';
            html += '<div style="font-size:0.82rem;font-weight:bold;color:#6ab4ff;margin-bottom:6px;">📋 Active Deals</div>';
            for (var di = 0; di < activeDeals.length; di++) {
                html += _buildDealRow(activeDeals[di]);
            }
            html += '</div>';
        }

        // New deal offers
        var offers = Engine.createDealOffer ? Engine.createDealOffer(emId) : [];
        if (offers.length > 0) {
            html += '<div style="margin-bottom:8px;">';
            html += '<div style="font-size:0.82rem;font-weight:bold;color:#55a868;margin-bottom:6px;">🤝 Available Deals</div>';
            html += '<div style="font-size:0.65rem;color:#888;margin-bottom:6px;">Deals the merchant is willing to make with you.</div>';
            for (var oi = 0; oi < offers.length; oi++) {
                html += _buildOfferRow(offers[oi], emId, oi);
            }
            html += '</div>';
        } else {
            html += '<div style="color:#888;font-size:0.75rem;padding:10px;text-align:center;">No deal offers available right now. Check back later or improve your relationship.</div>';
        }

        html += '</div>';
        openModal('🤝 Deals with ' + emName, html);
    }

    function _buildDealRow(deal) {
        var em = Engine.findPerson(deal.emId);
        var emName = em ? ((em.firstName || '') + ' ' + (em.lastName || '')) : 'Unknown';

        var emGoodRes = _findRes(deal.emGives.good);
        var plGoodRes = _findRes(deal.playerGives.good);
        var emGoodName = emGoodRes ? ((emGoodRes.icon || '') + ' ' + emGoodRes.name) : deal.emGives.good;
        var plGoodName = plGoodRes ? ((plGoodRes.icon || '') + ' ' + plGoodRes.name) : deal.playerGives.good;

        var emTown = Engine.findTown(deal.emGives.townId);
        var plTown = Engine.findTown(deal.playerGives.townId);

        var day = Engine.getDay ? Engine.getDay() : 0;
        var daysLeft = Math.max(0, (deal.nextDeliveryDay || 0) - day);

        var statusColor = '#55a868';
        var statusText = '✅ Active';
        if (!deal.emDelivered && daysLeft <= 3) { statusColor = '#ccb974'; statusText = '⏳ EM delivery pending'; }
        if (!deal.playerDelivered && daysLeft <= 3) { statusColor = '#c44e52'; statusText = '⚠️ Your delivery due soon'; }

        var html = '<div style="padding:8px;margin-bottom:4px;background:rgba(100,180,255,0.05);border:1px solid rgba(100,180,255,0.15);border-radius:4px;">';
        html += '<div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:4px;">';
        html += '<div style="font-size:0.78rem;font-weight:bold;">' + emGoodName + ' ↔ ' + plGoodName + '</div>';
        html += '<span style="font-size:0.65rem;color:' + statusColor + ';">' + statusText + '</span>';
        html += '</div>';
        html += '<div style="font-size:0.68rem;color:#aaa;">';
        // Show building names if available
        var emBldName = '';
        if (deal.emGives.buildingId) {
            var pBlds = (Player.state && Player.state.buildings) || [];
            for (var pb = 0; pb < pBlds.length; pb++) {
                if (pBlds[pb].id === deal.emGives.buildingId) {
                    var pbt = Engine.findBuildingType ? Engine.findBuildingType(pBlds[pb].type) : null;
                    emBldName = pbt ? pbt.name : pBlds[pb].type;
                    break;
                }
            }
        }
        html += 'You receive: ' + deal.emGives.qty + ' ' + (emGoodRes ? emGoodRes.name : deal.emGives.good) + ' at ' + (emBldName ? emBldName + ', ' : '') + (emTown ? emTown.name : '?') + '<br>';
        html += 'You deliver: ' + deal.playerGives.qty + ' ' + (plGoodRes ? plGoodRes.name : deal.playerGives.good) + ' to ' + (plTown ? plTown.name : '?') + '<br>';
        html += 'Every ' + deal.interval + ' days | Next: ' + daysLeft + ' days';
        html += '</div>';
        html += '<div style="margin-top:4px;display:flex;gap:4px;">';
        // Player deliver button if in right town and has goods
        if (Engine.canPlayerDeliverToDeal && Engine.canPlayerDeliverToDeal(deal.id)) {
            html += '<button class="btn-medieval" data-action="emDealDeliver" data-dealid="' + deal.id + '" style="font-size:0.65rem;padding:2px 8px;background:rgba(0,150,80,0.2);border-color:rgba(0,150,80,0.4);">📦 Deliver</button>';
        }
        html += '<button class="btn-medieval" data-action="emDealCancel" data-dealid="' + deal.id + '" style="font-size:0.65rem;padding:2px 8px;background:rgba(200,50,50,0.15);border-color:rgba(200,50,50,0.3);">❌ Cancel</button>';
        html += '</div></div>';
        return html;
    }

    function _buildOfferRow(offer, emId, index) {
        var emGoodRes = _findRes(offer.emGives.good);
        var plGoodRes = _findRes(offer.playerGives.good);
        var emGoodName = emGoodRes ? ((emGoodRes.icon || '') + ' ' + emGoodRes.name) : offer.emGives.good;
        var plGoodName = plGoodRes ? ((plGoodRes.icon || '') + ' ' + plGoodRes.name) : offer.playerGives.good;

        var emTown = Engine.findTown(offer.emGives.townId);
        var plTown = Engine.findTown(offer.playerGives.townId);

        var emBasePrice = emGoodRes ? (emGoodRes.basePrice || 10) : 10;
        var plBasePrice = plGoodRes ? (plGoodRes.basePrice || 10) : 10;
        var emValue = emBasePrice * offer.emGives.qty;
        var plValue = plBasePrice * offer.playerGives.qty;
        var valueDiff = emValue - plValue;
        var valueLabel = valueDiff > 0 ? '+' + valueDiff + 'g in your favor' : (valueDiff < 0 ? Math.abs(valueDiff) + 'g in their favor' : 'Fair value');
        var valueColor = valueDiff >= 0 ? '#55a868' : '#ccb974';

        // Check if player has a building that can accept the EM's offered good
        var compatibleBuildings = _getPlayerBuildingsForGood(offer.emGives.good);
        var canAccept = compatibleBuildings.length > 0;

        var html = '<div style="padding:8px;margin-bottom:4px;background:rgba(80,180,80,0.05);border:1px solid rgba(80,180,80,0.15);border-radius:4px;">';
        html += '<div style="display:flex;justify-content:space-between;align-items:start;">';
        html += '<div>';
        html += '<div style="font-size:0.78rem;font-weight:bold;">Receive ' + offer.emGives.qty + ' ' + emGoodName + '</div>';
        html += '<div style="font-size:0.72rem;color:#aaa;">Deliver ' + offer.playerGives.qty + ' ' + plGoodName + '</div>';
        html += '<div style="font-size:0.65rem;color:#888;">';
        html += 'Delivered to: ' + (emTown ? emTown.name : '?') + ' → ' + (plTown ? plTown.name : '?');
        html += ' | Every ' + offer.interval + ' days';
        html += '</div>';
        html += '<div style="font-size:0.65rem;color:' + valueColor + ';">' + valueLabel + '</div>';
        if (!canAccept) {
            html += '<div style="font-size:0.63rem;color:#c44e52;margin-top:2px;">❌ No building can receive ' + (emGoodRes ? emGoodRes.name : offer.emGives.good) + '</div>';
        }
        html += '</div>';
        if (canAccept) {
            html += '<button class="btn-medieval" data-action="emAcceptDeal" data-emid="' + emId + '" data-offerindex="' + index + '" style="font-size:0.72rem;padding:4px 10px;background:rgba(0,150,80,0.2);border-color:rgba(0,150,80,0.4);">Accept</button>';
        } else {
            html += '<div style="font-size:0.65rem;color:#888;padding:4px 8px;opacity:0.5;">Unavailable</div>';
        }
        html += '</div></div>';
        return html;
    }

    function _findRes(goodId) {
        if (!goodId || typeof RESOURCE_TYPES === 'undefined') return null;
        if (RESOURCE_TYPES[goodId]) return RESOURCE_TYPES[goodId];
        for (var rk in RESOURCE_TYPES) {
            if (RESOURCE_TYPES[rk].id === goodId) return RESOURCE_TYPES[rk];
        }
        return null;
    }

    // ── ALL DEALS MANAGEMENT (from business menu) ──
    function openAllDealsUI() {
        var allDeals = Engine.getEMDeals ? Engine.getEMDeals() : [];
        var activeDeals = allDeals.filter(function(d) { return d.status === 'active'; });
        var pastDeals = allDeals.filter(function(d) { return d.status !== 'active'; }).slice(-10);

        var html = '<div style="max-height:500px;overflow-y:auto;">';

        // Active deals
        html += '<div style="font-size:0.85rem;font-weight:bold;color:#6ab4ff;margin-bottom:8px;">📋 Active Deals (' + activeDeals.length + ')</div>';
        if (activeDeals.length === 0) {
            html += '<div style="color:#888;font-size:0.78rem;text-align:center;padding:15px;">No active deals. Visit elite merchants to negotiate deals.</div>';
        } else {
            for (var i = 0; i < activeDeals.length; i++) {
                var d = activeDeals[i];
                var em = Engine.findPerson(d.emId);
                var emName = em ? ((em.firstName || '') + ' ' + (em.lastName || '')) : 'Unknown';
                html += '<div style="font-size:0.7rem;color:#6ab4ff;margin-top:6px;margin-bottom:2px;">With ' + emName + ':</div>';
                html += _buildDealRow(d);
            }
        }

        // Past deals
        if (pastDeals.length > 0) {
            html += '<div style="margin-top:12px;border-top:1px solid rgba(255,255,255,0.1);padding-top:8px;">';
            html += '<div style="font-size:0.82rem;font-weight:bold;color:#888;margin-bottom:6px;">📜 Past Deals</div>';
            for (var pi = 0; pi < pastDeals.length; pi++) {
                var pd = pastDeals[pi];
                var pem = Engine.findPerson(pd.emId);
                var pemName = pem ? ((pem.firstName || '') + ' ' + (pem.lastName || '')) : 'Unknown';
                var statusLabels = {
                    broken_by_player: '❌ Broken by you',
                    broken_by_em: '❌ Broken by EM',
                    cancelled_by_em: '🚫 Cancelled by merchant',
                    cancelled_by_player: '🚫 Cancelled by you',
                    completed: '✅ Completed'
                };
                html += '<div style="padding:4px 8px;font-size:0.7rem;color:#666;border-bottom:1px solid rgba(255,255,255,0.03);">';
                html += pemName + ': ' + (pd.emGives ? pd.emGives.good : '?') + ' ↔ ' + (pd.playerGives ? pd.playerGives.good : '?');
                html += ' — <span style="color:#999;">' + (statusLabels[pd.status] || pd.status) + '</span>';
                html += '</div>';
            }
            html += '</div>';
        }

        html += '</div>';
        openModal('🤝 EM Deal Management', html);
    }

    // ── ACTION HANDLERS ──
    UI.registerAction('openEMTrade', function(_t, d) { if (d.id) openEMTrade(d.id); });
    UI.registerAction('openEMDeals', function(_t, d) { if (d.id) openEMDeals(d.id); });
    UI.registerAction('openAllDealsUI', function() { openAllDealsUI(); });

    UI.registerAction('emTradeTab', function(_t, d) {
        var goodsTab = document.getElementById('emTradeGoods');
        var bldTab = document.getElementById('emTradeBuildings');
        var btns = document.querySelectorAll('.emtrade-tab');
        for (var bi = 0; bi < btns.length; bi++) btns[bi].classList.remove('active');
        _t.classList.add('active');
        if (d.tab === 'goods') {
            if (goodsTab) goodsTab.style.display = '';
            if (bldTab) bldTab.style.display = 'none';
        } else {
            if (goodsTab) goodsTab.style.display = 'none';
            if (bldTab) bldTab.style.display = '';
        }
    });

    UI.registerAction('emBuyGood', function(_t, d) {
        if (d.emid && d.good && d.price) emBuyGood(d.emid, d.good, parseInt(d.price));
    });

    UI.registerAction('emBuyBuilding', function(_t, d) {
        if (d.emid && d.town && d.bindex != null && d.price) {
            var priceVal = parseInt(d.price);
            var em = Engine.findPerson(d.emid);
            var town = Engine.findTown(d.town);
            var b = (town && town.buildings) ? town.buildings[parseInt(d.bindex)] : null;
            var bType = b && Engine.findBuildingType ? Engine.findBuildingType(b.type) : null;
            if (!bType && b) {
                for (var btk in BUILDING_TYPES) {
                    if (BUILDING_TYPES[btk].id === b.type) { bType = BUILDING_TYPES[btk]; break; }
                }
            }
            var bName = bType ? bType.name : (b ? b.type : 'Building');
            var tName = town ? town.name : 'Unknown';
            var bLevel = b ? (b.level || 1) : 1;

            var bodyHtml = '<div style="text-align:center;padding:10px;">';
            bodyHtml += '<div style="font-size:1.1rem;font-weight:bold;margin-bottom:8px;">🏗️ ' + bName + '</div>';
            bodyHtml += '<div style="font-size:0.8rem;color:#ccc;margin-bottom:4px;">📍 ' + tName + ' | Level ' + bLevel + '</div>';
            bodyHtml += '<div style="font-size:1rem;color:var(--gold);font-weight:bold;margin-top:10px;">💰 ' + formatGold(priceVal) + '</div>';
            bodyHtml += '</div>';

            var footerHtml = '<button class="btn-medieval" data-action="emBuyBuildingConfirm" data-emid="' + d.emid + '" data-town="' + d.town + '" data-bindex="' + d.bindex + '" data-price="' + d.price + '" style="background:rgba(0,150,80,0.2);border-color:rgba(0,150,80,0.4);">✅ Confirm Purchase</button>';
            footerHtml += '<button class="btn-medieval" data-action="emBuyBuildingCancel" data-emid="' + d.emid + '" style="background:rgba(150,80,80,0.2);border-color:rgba(150,80,80,0.4);margin-left:8px;">❌ Cancel</button>';

            openModal('Confirm Building Purchase', bodyHtml, footerHtml);
        }
    });

    UI.registerAction('emBuyBuildingConfirm', function(_t, d) {
        if (d.emid && d.town && d.bindex != null && d.price) {
            closeModal();
            emBuyBuilding(d.emid, d.town, parseInt(d.bindex), parseInt(d.price));
        }
    });

    UI.registerAction('emBuyBuildingCancel', function(_t, d) {
        closeModal();
        if (d.emid) openEMTrade(d.emid);
    });

    UI.registerAction('emAcceptDeal', function(_t, d) {
        if (d.emid && d.offerindex != null) {
            var offers = Engine.createDealOffer ? Engine.createDealOffer(d.emid) : [];
            var offer = offers[parseInt(d.offerindex)];
            if (!offer) { toast('Offer no longer available.', 'error'); return; }

            // Get compatible player buildings for the EM's offered good
            var compatible = _getPlayerBuildingsForGood(offer.emGives.good);
            if (compatible.length === 0) {
                toast('You have no building that can receive ' + offer.emGives.good + '.', 'error');
                return;
            }

            var emGoodRes = _findRes(offer.emGives.good);
            var plGoodRes = _findRes(offer.playerGives.good);
            var emGoodName = emGoodRes ? emGoodRes.name : offer.emGives.good;
            var plGoodName = plGoodRes ? plGoodRes.name : offer.playerGives.good;

            var bodyHtml = '<div style="padding:8px;">';
            bodyHtml += '<div style="font-size:0.85rem;font-weight:bold;margin-bottom:8px;">📦 Select Delivery Building</div>';
            bodyHtml += '<div style="font-size:0.72rem;color:#aaa;margin-bottom:10px;">Choose where the merchant will deliver <strong>' + offer.emGives.qty + ' ' + emGoodName + '</strong>:</div>';

            for (var ci = 0; ci < compatible.length; ci++) {
                var cb = compatible[ci];
                bodyHtml += '<div style="padding:6px 8px;margin-bottom:4px;background:rgba(100,180,100,0.08);border:1px solid rgba(100,180,100,0.15);border-radius:4px;cursor:pointer;">';
                bodyHtml += '<button class="btn-medieval" data-action="emAcceptDealWithBuilding" data-emid="' + d.emid + '" data-offerindex="' + d.offerindex + '" data-buildingid="' + cb.buildingId + '" data-buildingtownid="' + cb.townId + '" style="width:100%;text-align:left;font-size:0.72rem;padding:4px 8px;">';
                bodyHtml += '🏗️ <strong>' + cb.buildingName + '</strong>';
                if (cb.building.level > 1) bodyHtml += ' (Lv' + cb.building.level + ')';
                bodyHtml += ' — 📍 ' + cb.townName;
                bodyHtml += '</button></div>';
            }

            bodyHtml += '<div style="font-size:0.65rem;color:#888;margin-top:8px;">You will deliver ' + offer.playerGives.qty + ' ' + plGoodName + ' to the merchant every ' + offer.interval + ' days.</div>';
            bodyHtml += '</div>';

            var footerHtml = '<button class="btn-medieval" data-action="emAcceptDealGoBack" data-emid="' + d.emid + '" style="background:rgba(100,100,100,0.2);border-color:rgba(100,100,100,0.4);">← Back</button>';

            openModal('Accept Deal', bodyHtml, footerHtml);
        }
    });

    UI.registerAction('emAcceptDealWithBuilding', function(_t, d) {
        if (d.emid && d.offerindex != null && d.buildingid && d.buildingtownid) {
            var offers = Engine.createDealOffer ? Engine.createDealOffer(d.emid) : [];
            var offer = offers[parseInt(d.offerindex)];
            if (!offer) { toast('Offer no longer available.', 'error'); closeModal(); return; }

            // Set the delivery building on the offer
            offer.emGives.buildingId = d.buildingid;
            offer.emGives.townId = d.buildingtownid;

            if (Engine.acceptDeal) {
                var result = Engine.acceptDeal(d.emid, offer);
                if (result.success) {
                    closeModal();
                    toast('✅ ' + result.message, 'success');
                    openEMDeals(d.emid);
                } else {
                    toast('❌ ' + result.message, 'error');
                }
            }
        }
    });

    UI.registerAction('emAcceptDealGoBack', function(_t, d) {
        closeModal();
        if (d.emid) openEMDeals(d.emid);
    });

    UI.registerAction('emDealDeliver', function(_t, d) {
        if (d.dealid && Engine.playerDeliverDealGoods) {
            var result = Engine.playerDeliverDealGoods(d.dealid);
            if (result.success) {
                toast('✅ ' + result.message, 'success');
                // Find the deal to get emId for refresh
                var deals = Engine.getEMDeals ? Engine.getEMDeals() : [];
                var deal = deals.find(function(dd) { return dd.id === d.dealid; });
                if (deal) openEMDeals(deal.emId);
            } else {
                toast('❌ ' + result.message, 'error');
            }
        }
    });

    UI.registerAction('emDealCancel', function(_t, d) {
        if (d.dealid && Engine.cancelDeal) {
            var bodyHtml = '<div style="text-align:center;padding:10px;">';
            bodyHtml += '<div style="font-size:1.1rem;margin-bottom:8px;">⚠️ Cancel Deal?</div>';
            bodyHtml += '<div style="font-size:0.85rem;color:#e8a050;margin-bottom:8px;">This will cost <strong>-10 relationship</strong> with the merchant.</div>';
            bodyHtml += '</div>';

            var footerHtml = '<button class="btn-medieval" data-action="emDealCancelConfirm" data-dealid="' + d.dealid + '" style="background:rgba(200,50,50,0.2);border-color:rgba(200,50,50,0.4);">⚠️ Confirm Cancel</button>';
            footerHtml += '<button class="btn-medieval" data-action="emDealCancelAbort" style="background:rgba(100,100,100,0.2);border-color:rgba(100,100,100,0.4);margin-left:8px;">Go Back</button>';

            openModal('Cancel Deal', bodyHtml, footerHtml);
        }
    });

    UI.registerAction('emDealCancelConfirm', function(_t, d) {
        if (d.dealid && Engine.cancelDeal) {
            closeModal();
            var result = Engine.cancelDeal(d.dealid, 'player');
            toast(result.success ? '✅ Deal cancelled.' : '❌ ' + result.message, result.success ? 'info' : 'error');
            openAllDealsUI();
        }
    });

    UI.registerAction('emDealCancelAbort', function() {
        closeModal();
        openAllDealsUI();
    });

    // ── EM DELIVERY MISSED POPUP ──
    // Called from engine when EM fails to deliver
    Engine._showEMDeliveryMissedUI = function(deal) {
        var em = Engine.findPerson(deal.emId);
        var emName = em ? ((em.firstName || '') + ' ' + (em.lastName || '')) : 'Unknown Merchant';
        var emGoodRes = _findRes(deal.emGives.good);
        var goodName = emGoodRes ? emGoodRes.name : deal.emGives.good;
        var baseValue = emGoodRes ? ((emGoodRes.basePrice || 10) * deal.emGives.qty) : (10 * deal.emGives.qty);

        var bodyHtml = '<div style="text-align:center;padding:10px;">';
        bodyHtml += '<div style="font-size:1.2rem;margin-bottom:8px;">⚠️ Missed Delivery</div>';
        bodyHtml += '<div style="font-size:0.85rem;color:#ccc;margin-bottom:12px;">' + emName + ' failed to deliver ' + deal.emGives.qty + ' ' + goodName + ' on time.</div>';
        bodyHtml += '<div style="font-size:0.78rem;color:#aaa;margin-bottom:12px;">You can cancel the deal (they pay you ' + formatGold(baseValue) + ') or give them 14 more days (+10 relationship).</div>';
        bodyHtml += '</div>';

        var footerHtml = '<button class="btn-medieval" data-action="emMissedCancel" data-dealid="' + deal.id + '" data-value="' + baseValue + '" style="background:rgba(200,50,50,0.2);border-color:rgba(200,50,50,0.4);">❌ Cancel & Collect ' + formatGold(baseValue) + '</button>';
        footerHtml += '<button class="btn-medieval" data-action="emMissedGrace" data-dealid="' + deal.id + '" style="background:rgba(0,150,80,0.2);border-color:rgba(0,150,80,0.4);margin-left:8px;">🕐 Give 14 More Days</button>';

        openModal('⚠️ Deal Issue', bodyHtml, footerHtml);
    };

    UI.registerAction('emMissedCancel', function(_t, d) {
        if (d.dealid && Engine.cancelDeal) {
            var baseValue = parseInt(d.value) || 0;
            var deals = Engine.getEMDeals ? Engine.getEMDeals() : [];
            var deal = deals.find(function(dd) { return dd.id === d.dealid; });
            if (deal) {
                var em = Engine.findPerson(deal.emId);
                if (em) {
                    var compensation = Math.min(baseValue, em.gold || 0);
                    em.gold = Math.max(0, (em.gold || 0) - compensation);
                    Player.state.gold = (Player.state.gold || 0) + compensation;
                }
            }
            Engine.cancelDeal(d.dealid, 'em_breach');
            toast('✅ Deal cancelled. Received ' + formatGold(parseInt(d.value) || 0) + ' compensation.', 'success');
            closeModal();
        }
    });

    UI.registerAction('emMissedGrace', function(_t, d) {
        if (d.dealid) {
            var deals = Engine.getEMDeals ? Engine.getEMDeals() : [];
            var deal = deals.find(function(dd) { return dd.id === d.dealid; });
            if (deal) {
                deal.gracePeriodEnd = (Engine.getDay ? Engine.getDay() : 0) + 14;
                deal.emDelivered = false; // Reset delivery flag
                if (Player.modifyRelationship) Player.modifyRelationship(deal.emId, 10);
                toast('🕐 Grace period granted. +10 relationship.', 'success');
            }
            closeModal();
        }
    });

    // Exports
    UI.openEMTrade = openEMTrade;
    UI.openEMDeals = openEMDeals;
    UI.openAllDealsUI = openAllDealsUI;

})(typeof UI !== 'undefined' ? UI : null);
