// ============================================================
// Merchant Realms — UI Caravans Module (extracted from ui.js)
// Extends window.UI with caravan dialog and management functions
// ============================================================
(function(UI) {
    "use strict";
    if (!UI) throw new Error("UI must be loaded before ui_caravans.js");

    // Aliases for UI utilities
    var openModal = UI.openModal;
    var closeModal = UI.closeModal;
    var toast = UI.toast;
    var formatGold = UI.formatGold;
    var escapeHtml = UI.escapeHtml;
    var findResource = UI.findResource;

    // ── CARAVAN DIALOG ──

    // ── Caravan order state ──
    var _caravanOrders = []; // current order list being built
    var _caravanEditFromTownId = null; // source town of caravan being edited/created
    var _caravanEditToTownId = null;   // destination town of caravan being edited/created

    // Populate building dropdown for store/pickup orders
    function _populateBuildingDropdown(sel, action) {
        if (!sel) return;
        sel.innerHTML = '<option value="">📦 Any (general storage)</option>';
        // Get the town where the action will happen
        var locSel = document.getElementById('orderLocation');
        var townId = null;
        if (locSel) {
            if (locSel.value === 'destination') {
                townId = _caravanEditToTownId;
                if (!townId) { try { var d = document.getElementById('caravanDest'); if (d) townId = d.value; } catch(e) {} }
            } else if (locSel.value === 'source') {
                townId = _caravanEditFromTownId || (typeof Player !== 'undefined' ? Player.townId : null);
            } else if (locSel.value && locSel.value.indexOf('waypoint:') === 0) {
                townId = locSel.value.replace('waypoint:', '');
            }
        }
        if (!townId) return;
        var town = Engine.findTown(townId);
        if (!town || !town.buildings) return;
        for (var bi = 0; bi < town.buildings.length; bi++) {
            var b = town.buildings[bi];
            if (b.ownerId !== 'player') continue;
            var bType = Engine.findBuildingType ? Engine.findBuildingType(b.type) : null;
            var bName = bType ? bType.name : b.type;
            sel.innerHTML += '<option value="' + (b.type + '_' + bi) + '">🏗️ ' + bName + (b.level > 1 ? ' (Lv' + b.level + ')' : '') + '</option>';
        }
    }

    function _getAllResourceList() {
        var list = [];
        for (var key in RESOURCE_TYPES) {
            var r = RESOURCE_TYPES[key];
            if (r && r.id) list.push(r);
        }
        list.sort(function(a, b) { return a.name.localeCompare(b.name); });
        return list;
    }

    function _buildOrderRow(order, index) {
        var res = findResource(order.good);
        var resName = res ? (res.icon + ' ' + res.name) : order.good;
        var actionLabel = { buy: '🛒 Buy', sell: '💰 Sell', store: '📥 Store', pickup: '📦 Pickup' }[order.action] || order.action;
        // Resolve location to actual town name using caravan context
        var locLabel;
        if (order.location && order.location.indexOf('waypoint:') === 0) {
            var wpTownId = order.location.replace('waypoint:', '');
            var wpTown = Engine.findTown(wpTownId);
            locLabel = '📍 ' + (wpTown ? wpTown.name : wpTownId);
        } else if (order.location === 'source') {
            var srcTown = _caravanEditFromTownId ? Engine.findTown(_caravanEditFromTownId) : null;
            if (!srcTown) { try { srcTown = Engine.findTown(Player.townId); } catch(e) {} }
            locLabel = '📍 ' + (srcTown ? srcTown.name : 'Source');
        } else {
            // destination
            var dstTown = _caravanEditToTownId ? Engine.findTown(_caravanEditToTownId) : null;
            if (!dstTown) {
                try {
                    var destEl2 = document.getElementById('caravanDest');
                    if (destEl2) dstTown = Engine.findTown(destEl2.value);
                } catch(e) {}
            }
            locLabel = '🏁 ' + (dstTown ? dstTown.name : 'Destination');
        }
        var qtyLabel = order.qty === 'max' ? 'Max' : order.qty;
        var bldLabel = '';
        if (order.buildingId) {
            var bParts = order.buildingId.split('_');
            var bTypeId = bParts.slice(0, -1).join('_');
            var bTypeDef = Engine.findBuildingType ? Engine.findBuildingType(bTypeId) : null;
            bldLabel = ' → ' + (bTypeDef ? bTypeDef.name : bTypeId);
        }
        var priceLabel = '';
        if (order.action === 'buy' && order.priceLimit) priceLabel = ' (max ' + order.priceLimit + 'g)';
        if (order.action === 'sell' && order.priceLimit) priceLabel = ' (min ' + order.priceLimit + 'g)';

        // Check for banned/restricted warning on sell orders
        var _warnBadge = '';
        var _rowBorder = 'background:rgba(255,255,255,0.03);';
        if (order.action === 'sell') {
            var _rowTownId = null;
            if (order.location && order.location.indexOf('waypoint:') === 0) _rowTownId = order.location.replace('waypoint:', '');
            else if (order.location === 'source') _rowTownId = _caravanEditFromTownId || (typeof Player !== 'undefined' ? Player.townId : null);
            else { _rowTownId = _caravanEditToTownId; if (!_rowTownId) { try { var _rEl = document.getElementById('caravanDest'); if (_rEl) _rowTownId = _rEl.value; } catch(e) {} } }
            if (_rowTownId) {
                var _rowTown = Engine.findTown(_rowTownId);
                var _rowK = _rowTown && _rowTown.kingdomId ? Engine.findKingdom(_rowTown.kingdomId) : null;
                if (_rowK && _rowK.laws) {
                    if (_rowK.laws.bannedGoods && _rowK.laws.bannedGoods.indexOf(order.good) >= 0) {
                        _warnBadge = ' <span style="color:#f44;font-size:0.6rem;font-weight:bold;cursor:help;" title="Banned items are illegal to make or sell, but legal to buy or own in small amounts. Selling via caravan will attempt smuggling.">🚫 BANNED</span>';
                        _rowBorder = 'background:rgba(200,50,50,0.1);border:1px solid rgba(200,50,50,0.3);';
                    } else if (_rowK.laws.restrictedGoods && _rowK.laws.restrictedGoods.indexOf(order.good) >= 0) {
                        var _rowHasLic = typeof Player !== 'undefined' && Player.hasLicense ? Player.hasLicense(_rowK.id, order.good) : false;
                        if (!_rowHasLic) {
                            _warnBadge = ' <span style="color:#f90;font-size:0.6rem;font-weight:bold;cursor:help;" title="Legal to buy. Illegal to sell or produce without a license. Purchase a license from the Kingdom menu.">⚠️ NO LICENSE</span>';
                            _rowBorder = 'background:rgba(200,150,50,0.1);border:1px solid rgba(200,150,50,0.3);';
                        }
                    }
                }
            }
        }

        return '<div style="display:flex;align-items:center;gap:6px;padding:4px 6px;' + _rowBorder + 'border-radius:4px;margin-bottom:3px;font-size:0.75rem;">' +
            '<span style="flex:1;">' + resName + _warnBadge + '</span>' +
            '<span style="color:var(--gold);min-width:60px;">' + actionLabel + '</span>' +
            '<span style="min-width:50px;">' + qtyLabel + priceLabel + '</span>' +
            '<span style="color:#888;min-width:55px;">' + locLabel + bldLabel + '</span>' +
            '<button data-action="_removeCaravanOrder" data-val="' + index + '" style="background:rgba(200,50,50,0.3);border:1px solid rgba(200,50,50,0.5);color:#fff;border-radius:3px;cursor:pointer;padding:1px 6px;font-size:0.7rem;">✕</button>' +
        '</div>';
    }

    function _removeCaravanOrder(index) {
        _caravanOrders.splice(index, 1);
        _refreshOrderList();
    }

    function _refreshOrderList() {
        var container = document.getElementById('caravanOrderList');
        if (!container) return;
        if (_caravanOrders.length === 0) {
            container.innerHTML = '<div class="text-dim" style="text-align:center;font-size:0.75rem;">No orders added yet. Use ➕ to add orders.</div>';
        } else {
            var html = '';
            for (var i = 0; i < _caravanOrders.length; i++) {
                html += _buildOrderRow(_caravanOrders[i], i);
            }
            container.innerHTML = html;
        }
    }

    function _addCaravanOrder() {
        var goodInput = document.getElementById('orderGoodInput');
        var actionSel = document.getElementById('orderAction');
        var locSel = document.getElementById('orderLocation');
        var qtyInput = document.getElementById('orderQty');
        var maxCheck = document.getElementById('orderMaxQty');
        var priceInput = document.getElementById('orderPriceLimit');

        if (!goodInput || !actionSel) return false;
        var goodId = goodInput.dataset.selectedId || '';

        // Auto-resolve: if user typed a name but didn't click dropdown, try to match
        if (!goodId && goodInput.value.trim()) {
            var typed = goodInput.value.trim().toLowerCase();
            var allRes = _getAllResourceList();
            for (var ri = 0; ri < allRes.length; ri++) {
                if (allRes[ri].name.toLowerCase() === typed ||
                    allRes[ri].id.toLowerCase() === typed ||
                    (allRes[ri].icon + ' ' + allRes[ri].name).toLowerCase() === typed) {
                    goodId = allRes[ri].id;
                    goodInput.dataset.selectedId = goodId;
                    break;
                }
            }
        }

        if (!goodId) { toast('Select a good first.', 'warning'); return false; }
        var action = actionSel.value;
        var location = locSel ? locSel.value : 'destination';
        var qty = maxCheck && maxCheck.checked ? 'max' : (parseInt(qtyInput.value) || 0);
        if (qty !== 'max' && qty <= 0) { toast('Enter a quantity or check Max.', 'warning'); return false; }
        var priceLimit = parseInt(priceInput.value) || 0;
        if (priceLimit <= 0) priceLimit = null;

        var actionLabel = { buy: 'Buy', sell: 'Sell', store: 'Store', pickup: 'Pickup' }[action] || action;
        var res = findResource(goodId);
        var resLabel = res ? res.name : goodId;

        // Block buy/sell orders at outpost locations (no market until upgraded to village)
        if (action === 'buy' || action === 'sell') {
            var _checkTownId = null;
            if (location === 'destination') {
                _checkTownId = _caravanEditToTownId;
                if (!_checkTownId) { try { var _dEl2 = document.getElementById('caravanDest'); if (_dEl2) _checkTownId = _dEl2.value; } catch(e) {} }
            } else if (location === 'source') {
                _checkTownId = _caravanEditFromTownId || (typeof Player !== 'undefined' ? Player.townId : null);
            } else if (location && location.indexOf('waypoint:') === 0) {
                _checkTownId = location.replace('waypoint:', '');
            }
            if (_checkTownId) {
                var _chkTown = Engine.findTown(_checkTownId);
                if (_chkTown && _chkTown.isOutpost) {
                    toast('🚫 Cannot ' + action + ' at outpost ' + (_chkTown.name || 'outpost') + ' — outposts have no market. Upgrade to village first.', 'warning');
                    return false;
                }
            }
        }

        // Get building target for store/pickup
        var buildingTarget = null;
        if (action === 'store' || action === 'pickup') {
            var bSel = document.getElementById('orderBuilding');
            if (bSel && bSel.value) buildingTarget = bSel.value;
        }

        _caravanOrders.push({
            good: goodId,
            action: action,
            location: location,
            qty: qty,
            priceLimit: priceLimit,
            buildingId: buildingTarget
        });

        toast('✅ Order added: ' + actionLabel + ' ' + (qty === 'max' ? 'Max' : qty) + ' ' + resLabel, 'success');

        // Warn if sell/buy order targets a town where the good is banned or restricted
        if (action === 'sell') {
            var _warnTownId = null;
            if (location === 'destination') {
                _warnTownId = _caravanEditToTownId;
                if (!_warnTownId) { try { var _dEl = document.getElementById('caravanDest'); if (_dEl) _warnTownId = _dEl.value; } catch(e) {} }
            } else if (location === 'source') {
                _warnTownId = _caravanEditFromTownId || (typeof Player !== 'undefined' ? Player.townId : null);
            } else if (location && location.indexOf('waypoint:') === 0) {
                _warnTownId = location.replace('waypoint:', '');
            }
            if (_warnTownId) {
                var _wTown = Engine.findTown(_warnTownId);
                var _wKingdom = _wTown && _wTown.kingdomId ? Engine.findKingdom(_wTown.kingdomId) : null;
                if (_wKingdom && _wKingdom.laws) {
                    var _isBanned = _wKingdom.laws.bannedGoods && _wKingdom.laws.bannedGoods.indexOf(goodId) >= 0;
                    var _isRestricted = _wKingdom.laws.restrictedGoods && _wKingdom.laws.restrictedGoods.indexOf(goodId) >= 0;
                    var _hasLic = typeof Player !== 'undefined' && Player.hasLicense ? Player.hasLicense(_wKingdom.id, goodId) : false;
                    if (_isBanned) {
                        toast('🚫 WARNING: ' + resLabel + ' is BANNED in ' + (_wKingdom.name || 'this kingdom') + '! Your caravan will attempt to smuggle it. Risk of detection, fines, and jail.', 'warning');
                    } else if (_isRestricted && !_hasLic) {
                        toast('⚠️ WARNING: ' + resLabel + ' is RESTRICTED in ' + (_wKingdom.name || 'this kingdom') + ' and you have no license! Risk of detection and penalties.', 'warning');
                    }
                }
            }
        }

        // Reset inputs for next order
        goodInput.value = '';
        goodInput.dataset.selectedId = '';
        if (qtyInput) { qtyInput.value = ''; qtyInput.disabled = false; }
        if (maxCheck) maxCheck.checked = false;
        if (priceInput) priceInput.value = '';
        var dropdown = document.getElementById('orderGoodDropdown');
        if (dropdown) dropdown.style.display = 'none';

        _refreshOrderList();
        return true;
    }

    // Auto-add any partially filled order form before send/save.
    // Returns true if OK to proceed (no pending input, or it was added).
    // Returns false if there IS pending input but it failed validation — stay in UI.
    function _autoAddPendingOrder() {
        var goodInput = document.getElementById('orderGoodInput');
        if (!goodInput) return true;
        // Detect if user has typed anything at all
        var hasText = goodInput.value.trim().length > 0;
        var hasSelectedId = !!(goodInput.dataset.selectedId);
        if (!hasText && !hasSelectedId) return true; // form is empty — nothing pending
        // There's something in the form — try to add it
        var result = _addCaravanOrder();
        if (result === false) return false; // validation failed — stay in UI
        return true;
    }

    function openCaravanDialog() {
        if (typeof Player === 'undefined' || Player.townId == null) {
            // If traveling or no location, show caravan management instead of send dialog
            if (Player.traveling || Player.travelOffSea) {
                openCaravanManagement();
                return;
            }
            // No townId and not traveling — show management if player has caravans
            openCaravanManagement();
            return;
        }

        // Check if current location has any road connections — if not, show management
        var _curTown = Engine.findTown(Player.townId);
        if (_curTown && _curTown.isOutpost) {
            var _hasConnection = false;
            var _allRoads = Engine.getRoads ? Engine.getRoads() : [];
            for (var _ri = 0; _ri < _allRoads.length; _ri++) {
                if (_allRoads[_ri].fromTownId === Player.townId || _allRoads[_ri].toTownId === Player.townId) {
                    _hasConnection = true; break;
                }
            }
            if (!_hasConnection) {
                var _allSea = Engine.getSeaRoutes ? Engine.getSeaRoutes() : [];
                for (var _si = 0; _si < _allSea.length; _si++) {
                    if (_allSea[_si].fromTownId === Player.townId || _allSea[_si].toTownId === Player.townId) {
                        _hasConnection = true; break;
                    }
                }
            }
            if (!_hasConnection) {
                // Outpost with no roads/sea routes — show caravan management
                openCaravanManagement();
                return;
            }
        }

        _caravanOrders = [];
        _caravanEditFromTownId = Player.townId;
        _caravanEditToTownId = null;

        const roads = Engine.getRoads ? Engine.getRoads() : [];
        const towns = Engine.getTowns ? Engine.getTowns() : [];
        const townMap = {};
        for (const t of towns) townMap[t.id] = t;

        // Find connected towns (land) — multi-hop if player has extended_routes or caravan_network skill
        var maxHops = 1;
        var hasExtended = typeof Player !== 'undefined' && Player.hasSkill && Player.hasSkill('extended_routes');
        var hasTradeNet = typeof Player !== 'undefined' && Player.hasSkill && Player.hasSkill('caravan_network');        if (hasTradeNet) maxHops = 5;
        else if (hasExtended) maxHops = 3;

        // Always BFS up to 5 hops to show locked destinations
        var searchHops = 5;

        const connectedTowns = [];
        const visitedTowns = {};
        visitedTowns[Player.townId] = true;

        // BFS to find all towns up to searchHops away
        var frontier = [{ townId: Player.townId, hops: 0 }];
        while (frontier.length > 0) {
            var current = frontier.shift();
            if (current.hops >= searchHops) continue;
            for (const road of roads) {
                var neighborId = null;
                if (road.fromTownId === current.townId && townMap[road.toTownId]) neighborId = road.toTownId;
                else if (road.toTownId === current.townId && townMap[road.fromTownId]) neighborId = road.fromTownId;
                if (neighborId && !visitedTowns[neighborId]) {
                    visitedTowns[neighborId] = true;
                    var hops = current.hops + 1;
                    connectedTowns.push({ town: townMap[neighborId], road: road, routeType: 'land', hops: hops });
                    if (hops < searchHops) frontier.push({ townId: neighborId, hops: hops });
                }
            }
        }

        // Find sea route destinations
        const seaDestinations = (typeof Player !== 'undefined' && Player.getSeaDestinations) ? Player.getSeaDestinations() : [];

        let destOptions = connectedTowns.filter(({ town }) => !town.isJunction).map(({ town, road, hops }) => {
            const safeStr = road.safe !== false ? '✓' : '⚠';
            const threat = road.banditThreat || 0;
            const dangerStr = threat > CONFIG.BANDIT_THREAT_DANGER_THRESHOLD ? ` ☠${Math.round(threat)}` : '';
            const hopLabel = hops > 1 ? ` ${hops}🔗` : '';

            // Determine if this destination is locked behind a skill
            var locked = hops > maxHops;
            var requiredSkill = '';
            if (locked) {
                if (hops <= 3) requiredSkill = 'Extended Routes';
                else requiredSkill = 'Caravan Network';
            }

            if (locked) {
                return `<option value="${town.id}" disabled style="color:#666;">🔒 ${town.name}${hopLabel} — requires ${requiredSkill} skill</option>`;
            }
            return `<option value="${town.id}" data-route="land" data-threat="${threat}" data-hops="${hops}">🚶 ${town.name}${hopLabel} (${safeStr} Q:${road.quality || 1}${dangerStr})</option>`;
        }).join('');

        for (const sd of seaDestinations) {
            if (sd.town && sd.town.isJunction) continue;
            destOptions += `<option value="${sd.town.id}" data-route="sea">⛵ ${sd.town.name} (Sea ~${sd.estimatedDays}d)</option>`;
        }

        if (!destOptions) destOptions = '<option value="">No connected towns</option>';

        // Goods selector (from inventory AND town storage)
        let goodsHtml = '';
        const allGoods = {};
        for (const [resId, qty] of Object.entries(Player.inventory || {})) {
            if (qty > 0) allGoods[resId] = (allGoods[resId] || 0) + qty;
        }
        const townStorage = Player.state && Player.state.townStorage && Player.state.townStorage[Player.townId] ? Player.state.townStorage[Player.townId] : {};
        for (const [resId, qty] of Object.entries(townStorage)) {
            if (qty > 0) allGoods[resId] = (allGoods[resId] || 0) + qty;
        }
        for (const [resId, qty] of Object.entries(allGoods)) {
            if (qty <= 0) continue;
            const res = findResource(resId);
            if (!res) continue;
            goodsHtml += `<div class="caravan-good-row">
                <span>${res.icon} ${res.name} (${qty})</span>
                <input type="number" class="qty-select" id="caravanGood_${resId}" min="0" max="${qty}" value="0" style="width:60px">
            </div>`;
        }
        if (!goodsHtml) goodsHtml = '<div class="text-dim text-center">No goods available to load</div>';

        // Ship capacity info
        let shipInfo = '';
        if (Player.ships && Player.ships.length > 0) {
            const bestShip = Player.getBestShip ? Player.getBestShip() : Player.ships.reduce((a, b) => (a.capacity || 0) > (b.capacity || 0) ? a : b);
            if (bestShip) {
                const effCap = Player.getShipEffectiveCapacity ? Player.getShipEffectiveCapacity(bestShip) : bestShip.capacity;
                const shipDef = Player.getShipDefense ? Player.getShipDefense(bestShip) : 0;
                const hullPct = bestShip.hullHealth !== undefined ? bestShip.hullHealth : 100;
                shipInfo = `<div class="text-dim" style="font-size:0.75rem;margin-top:4px;">⛵ ${bestShip.name} | Cap: ${effCap} | 🛡️${shipDef} | Hull: ${hullPct}% | Spd: ${(bestShip.speed || 1.0).toFixed(1)}x</div>`;
            }
        }

        // Build order builder (searchable dropdown + action + location + qty + price)
        var orderBuilderHtml = '<div style="margin-top:10px;padding:10px;background:rgba(0,100,200,0.06);border:1px solid rgba(0,100,200,0.15);border-radius:6px;">';
        orderBuilderHtml += '<label style="font-size:0.85rem;color:var(--gold);font-weight:bold;">📋 Caravan Orders</label>';
        orderBuilderHtml += '<div class="text-dim" style="font-size:0.7rem;margin-bottom:6px;">Orders tell the caravan what to buy, sell, store, or pick up at each location.</div>';

        // Story mode hint for caravan orders
        if (typeof StoryMode !== 'undefined' && StoryMode.isActive && StoryMode.isActive()) {
            var _smCh = StoryMode.getCurrentChapter ? StoryMode.getCurrentChapter() : null;
            if (_smCh && _smCh.id === 'ch9') {
                orderBuilderHtml += '<div style="margin-bottom:8px;padding:8px 10px;background:rgba(255,200,50,0.12);border:1px solid rgba(255,200,50,0.3);border-radius:6px;font-size:0.75rem;color:#f0d060;">';
                orderBuilderHtml += '💡 <strong>Story Hint:</strong> Add two orders for this caravan:<br>';
                orderBuilderHtml += '&nbsp;&nbsp;1. Search "<strong>iron ore</strong>", set action to <strong>📦 Pickup</strong>, location to <strong>📍 Source</strong> (Ferrowdale)<br>';
                orderBuilderHtml += '&nbsp;&nbsp;2. Search "<strong>iron ore</strong>", set action to <strong>💰 Sell</strong>, location to <strong>🏁 Destination</strong> (Ashford)<br>';
                orderBuilderHtml += 'This tells the caravan to load iron ore in Ferrowdale and sell it in Ashford!</div>';
            }
        }

        // Order list
        orderBuilderHtml += '<div id="caravanOrderList" style="max-height:150px;overflow-y:auto;margin-bottom:8px;">';
        orderBuilderHtml += '<div class="text-dim" style="text-align:center;font-size:0.75rem;">No orders added yet. Use ➕ to add orders.</div>';
        orderBuilderHtml += '</div>';

        // Add order form
        orderBuilderHtml += '<div style="border-top:1px solid rgba(255,255,255,0.08);padding-top:8px;">';
        // Row 1: Good search + Action
        orderBuilderHtml += '<div style="display:flex;gap:6px;align-items:flex-start;flex-wrap:wrap;margin-bottom:6px;">';
        orderBuilderHtml += '<div style="position:relative;flex:1;min-width:140px;">';
        orderBuilderHtml += '<input type="text" id="orderGoodInput" placeholder="🔍 Search goods..." autocomplete="off" style="width:100%;padding:4px 8px;font-size:0.75rem;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.15);border-radius:4px;color:#fff;">';
        orderBuilderHtml += '<div id="orderGoodDropdown" style="display:none;position:absolute;top:100%;left:0;right:0;max-height:160px;overflow-y:auto;background:rgba(20,20,30,0.98);border:1px solid rgba(255,255,255,0.2);border-radius:0 0 4px 4px;z-index:100;"></div>';
        orderBuilderHtml += '</div>';
        orderBuilderHtml += '<select id="orderAction" style="padding:4px 6px;font-size:0.75rem;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.15);border-radius:4px;color:#fff;">';
        orderBuilderHtml += '<option value="buy">🛒 Buy</option><option value="sell">💰 Sell</option><option value="store">📥 Store</option><option value="pickup">📦 Pickup</option>';
        orderBuilderHtml += '</select>';
        orderBuilderHtml += '<select id="orderLocation" style="padding:4px 6px;font-size:0.75rem;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.15);border-radius:4px;color:#fff;">';
        var _srcTown = Engine.findTown(Player.townId);
        var _srcName = _srcTown ? _srcTown.name : 'Source';
        orderBuilderHtml += '<option value="destination">🏁 Destination</option><option value="source">📍 ' + _srcName + '</option>';
        orderBuilderHtml += '</select>';
        orderBuilderHtml += '</div>';
        // Row 1b: Building target (shown only for Store action)
        orderBuilderHtml += '<div id="orderBuildingRow" style="display:none;margin-bottom:6px;">';
        orderBuilderHtml += '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">';
        orderBuilderHtml += '<label style="font-size:0.7rem;color:#aaa;">At building:</label>';
        orderBuilderHtml += '<select id="orderBuilding" style="flex:1;padding:4px 6px;font-size:0.75rem;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.15);border-radius:4px;color:#fff;">';
        orderBuilderHtml += '<option value="">📦 Any (general storage)</option>';
        orderBuilderHtml += '</select>';
        orderBuilderHtml += '<label style="font-size:0.7rem;color:#aaa;cursor:pointer;"><input type="checkbox" id="orderOverflow" checked> Overflow</label>';
        orderBuilderHtml += '</div>';
        orderBuilderHtml += '</div>';
        // Row 2: Qty + Max + Price + Add button
        orderBuilderHtml += '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">';
        orderBuilderHtml += '<label style="font-size:0.7rem;color:#aaa;">Qty:</label>';
        orderBuilderHtml += '<input type="number" id="orderQty" min="1" max="9999" value="" placeholder="amt" style="width:55px;padding:3px 5px;font-size:0.75rem;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.15);border-radius:4px;color:#fff;">';
        orderBuilderHtml += '<label style="font-size:0.7rem;color:#aaa;cursor:pointer;"><input type="checkbox" id="orderMaxQty"> Max</label>';
        orderBuilderHtml += '<label style="font-size:0.7rem;color:#aaa;margin-left:6px;">Price:</label>';
        orderBuilderHtml += '<input type="number" id="orderPriceLimit" min="0" max="9999" value="" placeholder="limit" style="width:55px;padding:3px 5px;font-size:0.75rem;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.15);border-radius:4px;color:#fff;">';
        orderBuilderHtml += '<span style="font-size:0.65rem;color:#666;">g</span>';
        orderBuilderHtml += '<button data-action="_addCaravanOrder" style="padding:4px 12px;font-size:0.75rem;background:rgba(0,150,80,0.3);border:1px solid rgba(0,150,80,0.5);color:#fff;border-radius:4px;cursor:pointer;font-weight:bold;">➕ Add</button>';
        orderBuilderHtml += '</div>';
        orderBuilderHtml += '<div class="text-dim" style="font-size:0.6rem;margin-top:4px;">Buy/Pickup load onto caravan. Sell/Store unload from caravan. Price = max buy or min sell price.</div>';
        orderBuilderHtml += '</div></div>';

        // Active caravans — link to management panel
        let activeCount = Player.caravans ? Player.caravans.filter(function(c) { return c.active; }).length : 0;
        let totalCount = Player.caravans ? Player.caravans.length : 0;
        var mgmtLink = '';
        if (totalCount > 0) {
            mgmtLink = '<div style="margin-top:10px;text-align:center;">' +
                '<button class="btn-medieval" data-action="openCaravanManagement" style="font-size:0.8rem;padding:6px 16px;">📊 Manage Caravans (' + activeCount + ' active / ' + totalCount + ' total)</button>' +
            '</div>';
        }

        // Get dynamic hire rates for current town
        var hireRates = { carrierWage: 4, guardWage: 6 };
        try { hireRates = Player.getCaravanHireRates(Player.townId); } catch(e) {}
        var horsesOwned = (Player.inventory || {})['horses'] || 0;
        var swordsOwned = (Player.inventory || {})['swords'] || 0;
        var armorOwned = (Player.inventory || {})['armor'] || 0;

        // Crew & Equipment section
        var crewHtml = '<div style="margin-top:8px;padding:10px;background:rgba(140,100,40,0.08);border:1px solid rgba(140,100,40,0.2);border-radius:6px;">';
        crewHtml += '<label style="font-size:0.85rem;color:var(--gold);font-weight:bold;">👥 Crew & Equipment</label>';
        crewHtml += '<div class="text-dim" style="font-size:0.68rem;margin-bottom:8px;">Hire rates at this town — Carrier: ' + hireRates.carrierWage + 'g/day, Guard: ' + hireRates.guardWage + 'g/day</div>';

        // Row: Carriers + Guards
        crewHtml += '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:6px;">';
        crewHtml += '<div style="flex:1;min-width:120px;">';
        crewHtml += '<label style="font-size:0.75rem;color:#ccc;">🧳 Carriers</label>';
        crewHtml += '<input type="number" id="caravanCarriers" min="1" max="20" value="1" style="width:60px;padding:3px 5px;font-size:0.75rem;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.15);border-radius:4px;color:#fff;margin-left:6px;" onchange="UI._updateCaravanPreview()">';
        crewHtml += '<span style="font-size:0.65rem;color:#888;margin-left:4px;">' + (CONFIG.CARAVAN_CARRIER_BASE_CAPACITY || 30) + ' weight each</span>';
        crewHtml += '</div>';
        crewHtml += '<div style="flex:1;min-width:120px;">';
        crewHtml += '<label style="font-size:0.75rem;color:#ccc;">⚔️ Guards</label>';
        crewHtml += '<input type="number" id="caravanGuards" min="0" max="20" value="1" style="width:60px;padding:3px 5px;font-size:0.75rem;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.15);border-radius:4px;color:#fff;margin-left:6px;" onchange="UI._updateCaravanPreview()">';
        crewHtml += '<span style="font-size:0.65rem;color:#888;margin-left:4px;">reduce theft/kill chance</span>';
        crewHtml += '</div>';
        crewHtml += '</div>';

        // Row: Carrier Equipment — Horses, Carts, Wagons
        var cartsOwned = (Player.inventory && Player.inventory['cart']) || 0;
        var wagonsOwned = (Player.inventory && Player.inventory['wagon']) || 0;
        crewHtml += '<div style="border-top:1px solid rgba(255,255,255,0.06);padding-top:6px;margin-bottom:6px;">';
        crewHtml += '<label style="font-size:0.75rem;color:#c9a84c;">🐴 Carrier Equipment</label>';
        crewHtml += '<span style="font-size:0.6rem;color:#888;margin-left:6px;">(Own: 🐴' + horsesOwned + ' horses, 🛒' + cartsOwned + ' carts, 🚛' + wagonsOwned + ' wagons)</span>';
        crewHtml += '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:4px;">';
        crewHtml += '<div><label style="font-size:0.7rem;color:#aaa;">Horses</label> <input type="number" id="caravanHorses" min="0" max="' + Math.min(20, horsesOwned) + '" value="0" style="width:50px;padding:2px 4px;font-size:0.75rem;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.15);border-radius:4px;color:#fff;" onchange="UI._updateCaravanPreview()"> <span style="font-size:0.6rem;color:#666;">≤ carriers, +speed & capacity</span></div>';
        crewHtml += '<div><label style="font-size:0.7rem;color:#aaa;">Carts</label> <input type="number" id="caravanCarts" min="0" max="' + Math.min(20, cartsOwned) + '" value="0" style="width:50px;padding:2px 4px;font-size:0.75rem;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.15);border-radius:4px;color:#fff;" onchange="UI._updateCaravanPreview()"> <span style="font-size:0.6rem;color:#666;">+' + (CONFIG.CARAVAN_CART_CAPACITY || 80) + ' wt, from inv</span></div>';
        crewHtml += '<div><label style="font-size:0.7rem;color:#aaa;">Wagons</label> <input type="number" id="caravanWagons" min="0" max="' + Math.min(20, wagonsOwned) + '" value="0" style="width:50px;padding:2px 4px;font-size:0.75rem;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.15);border-radius:4px;color:#fff;" onchange="UI._updateCaravanPreview()"> <span style="font-size:0.6rem;color:#666;">+' + (CONFIG.CARAVAN_WAGON_CAPACITY || 200) + ' wt, from inv</span></div>';
        crewHtml += '</div>';
        crewHtml += '<div style="font-size:0.6rem;color:#777;margin-top:2px;">Carts + Wagons ≤ Horses (each needs a horse to pull)</div>';
        crewHtml += '</div>';

        // Row: Guard Equipment — Weapons, Armor
        crewHtml += '<div style="border-top:1px solid rgba(255,255,255,0.06);padding-top:6px;">';
        crewHtml += '<label style="font-size:0.75rem;color:#c9a84c;">🛡️ Guard Equipment</label>';
        crewHtml += '<span style="font-size:0.6rem;color:#888;margin-left:6px;">(You own: ⚔' + swordsOwned + ' swords, 🛡️' + armorOwned + ' armor)</span>';
        crewHtml += '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:4px;">';
        crewHtml += '<div><label style="font-size:0.7rem;color:#aaa;">Weapons</label> <input type="number" id="caravanWeapons" min="0" max="' + Math.min(20, swordsOwned) + '" value="0" style="width:50px;padding:2px 4px;font-size:0.75rem;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.15);border-radius:4px;color:#fff;" onchange="UI._updateCaravanPreview()"> <span style="font-size:0.6rem;color:#666;">≤ guards, from swords inv</span></div>';
        crewHtml += '<div><label style="font-size:0.7rem;color:#aaa;">Armor</label> <input type="number" id="caravanArmor" min="0" max="' + Math.min(20, armorOwned) + '" value="0" style="width:50px;padding:2px 4px;font-size:0.75rem;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.15);border-radius:4px;color:#fff;" onchange="UI._updateCaravanPreview()"> <span style="font-size:0.6rem;color:#666;">≤ guards, from armor inv</span></div>';
        crewHtml += '</div>';
        crewHtml += '</div>';
        crewHtml += '</div>';

        // Preview panel
        var previewHtml = '<div id="caravanPreview" style="margin-top:8px;padding:8px 10px;background:rgba(0,180,100,0.06);border:1px solid rgba(0,180,100,0.15);border-radius:6px;">';
        previewHtml += '<label style="font-size:0.85rem;color:var(--gold);font-weight:bold;">📊 Caravan Preview</label>';
        previewHtml += '<div id="caravanPreviewContent" style="font-size:0.75rem;color:#bbb;margin-top:4px;">Select a destination to see stats.</div>';
        previewHtml += '</div>';

        // Ship selection for sea caravans (hidden by default, shown when sea route selected)
        var shipSelectHtml = '<div id="caravanShipSection" style="display:none;margin-top:6px;padding:8px 10px;background:rgba(0,100,180,0.08);border:1px solid rgba(0,100,180,0.18);border-radius:6px;">';
        shipSelectHtml += '<label style="font-size:0.85rem;color:var(--gold);font-weight:bold;">⛵ Ship Selection</label>';
        shipSelectHtml += '<select id="caravanShipSelect" style="width:100%;padding:4px 6px;font-size:0.8rem;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.15);border-radius:4px;color:#fff;margin-top:4px;" onchange="UI._updateCaravanPreview()">';
        // Own ships at port
        var _ownShips = Player.getAvailableShipsAtPort ? Player.getAvailableShipsAtPort(Player.townId) : [];
        // Also filter out ships assigned to off-sea travel
        _ownShips = _ownShips.filter(function(s) { return !s.assignedOffSea; });
        if (_ownShips.length > 0) {
            shipSelectHtml += '<optgroup label="Your Ships at Port (Free)">';
            for (var _osi = 0; _osi < _ownShips.length; _osi++) {
                var _os = _ownShips[_osi];
                var _ost = CONFIG.SHIP_TYPES[_os.type] || {};
                var _hull = _os.hullHealth != null ? _os.hullHealth : 100;
                shipSelectHtml += '<option value="own:' + _os.id + '">' + (_ost.icon || '⛵') + ' ' + (_os.name || _ost.name) + ' (Cap:' + (_ost.capacity || 0) + ', Spd:' + (_ost.speed || 1).toFixed(1) + ', Hull:' + _hull + '%) — FREE</option>';
            }
            shipSelectHtml += '</optgroup>';
        }
        // Rental ships
        shipSelectHtml += '<optgroup label="Rent a Ship">';
        for (var _rtId in CONFIG.SHIP_TYPES) {
            var _rtt = CONFIG.SHIP_TYPES[_rtId];
            var _rCost = Player.getShipRentalCost ? Player.getShipRentalCost(_rtId, Player.townId) : 0;
            shipSelectHtml += '<option value="rent:' + _rtId + '">' + (_rtt.icon || '⛵') + ' ' + _rtt.name + ' (Cap:' + _rtt.capacity + ', Spd:' + _rtt.speed + ') — ' + _rCost.toFixed(1) + 'g/day</option>';
        }
        shipSelectHtml += '</optgroup>';
        shipSelectHtml += '</select>';
        shipSelectHtml += '<div id="caravanShipCrewInfo" style="font-size:0.72rem;color:#aaa;margin-top:3px;"></div>';
        shipSelectHtml += '</div>';

        const html = `<div class="caravan-form">
            ${mgmtLink}
            <div class="form-group">
                <label>Destination</label>
                <select id="caravanDest" onchange="UI._updateCaravanPreview()">${destOptions}</select>
            </div>
            ${shipInfo}
            ${shipSelectHtml}
            <div class="form-group">
                <label>Goods to Load</label>
                <div class="caravan-goods-list" style="max-height:120px;overflow-y:auto;">${goodsHtml}</div>
            </div>
            ${crewHtml}
            <div class="form-group" style="margin-top:8px;">
                <label style="font-size:0.8rem;">Route Type</label>
                <div style="display:flex;gap:12px;flex-wrap:wrap;">
                    <label style="font-size:0.75rem;cursor:pointer;"><input type="radio" name="routeMode" value="oneway" checked> One-Way</label>
                    <label style="font-size:0.75rem;cursor:pointer;"><input type="radio" name="routeMode" value="roundtrip"> Round Trip</label>
                    <label style="font-size:0.75rem;cursor:pointer;"><input type="radio" name="routeMode" value="recurring"> 🔄 Recurring Route</label>
                </div>
            </div>
            ${orderBuilderHtml}
            <div class="form-group" style="margin-top:8px;">
                <label style="font-size:0.8rem;">🛡️ Security Options</label>
                <div style="display:flex;gap:10px;flex-wrap:wrap;">
                    <label style="font-size:0.7rem;cursor:pointer;"><input type="checkbox" id="caravanFortified"> Fortified Wagon (${CONFIG.CARAVAN_FORTIFIED_WAGON_COST || 150}g, +30% defense)</label>
                    <label style="font-size:0.7rem;cursor:pointer;"><input type="checkbox" id="caravanDecoy"> Decoy (${CONFIG.CARAVAN_DECOY_COST || 50}g, -40% attack chance)</label>
                    <label style="font-size:0.7rem;cursor:pointer;"><input type="checkbox" id="caravanArmedEscort"> Armed Escort (${CONFIG.CARAVAN_ARMED_ESCORT_COST || 80}g, +50% guard power)</label>
                </div>
            </div>
            <div class="form-group" style="margin-top:8px;">
                <label style="font-size:0.8rem;">🚌 Passenger Options</label>
                <div style="display:flex;gap:10px;flex-wrap:wrap;">
                    <label style="font-size:0.7rem;cursor:pointer;"><input type="checkbox" id="caravanAutoPickup"> Auto-pickup travelers (earn fares from NPCs traveling along your route)</label>
                </div>
            </div>
            ${previewHtml}
            <div class="caravan-danger-info" style="font-size:0.75rem;margin-top:6px;">
                ${connectedTowns.filter(ct => (ct.road.banditThreat || 0) > CONFIG.BANDIT_THREAT_DANGER_THRESHOLD).map(ct => {
                    const threat = ct.road.banditThreat || 0;
                    const color = threat > 75 ? 'var(--danger)' : threat > 50 ? 'var(--gold)' : '#888';
                    return `<div style="color:${color};">⚠️ Route to ${ct.town.name}: Bandit Threat ${Math.round(threat)}/100</div>`;
                }).join('')}
            </div>
        </div>
        ${buildTransportSection(connectedTowns, seaDestinations)}
        ${buildNPCTransportSection()}`;

        const footer = `<button class="btn-medieval" data-action="executeSendCaravan" style="font-size:0.85rem;padding:8px 24px;">
            🐴 Send Caravan
        </button>`;

        openModal('🐴 Caravan & Transport', html, footer);

        // Wire up searchable goods dropdown + trigger initial preview
        setTimeout(function() {
            _updateCaravanPreview();

            var input = document.getElementById('orderGoodInput');
            var dropdown = document.getElementById('orderGoodDropdown');
            if (!input || !dropdown) return;

            var allRes = _getAllResourceList();

            function renderDropdown(filter) {
                var filtered = filter ? allRes.filter(function(r) {
                    return r.name.toLowerCase().indexOf(filter.toLowerCase()) !== -1 ||
                           r.id.toLowerCase().indexOf(filter.toLowerCase()) !== -1 ||
                           (r.category && r.category.toLowerCase().indexOf(filter.toLowerCase()) !== -1);
                }) : allRes;
                if (filtered.length === 0) {
                    dropdown.innerHTML = '<div style="padding:6px 8px;color:#888;font-size:0.7rem;">No matches</div>';
                    dropdown.style.display = 'block';
                    return;
                }
                var html = '';
                for (var i = 0; i < Math.min(filtered.length, 40); i++) {
                    var r = filtered[i];
                    html += '<div class="order-good-option" data-id="' + r.id + '" style="padding:4px 8px;cursor:pointer;font-size:0.75rem;border-bottom:1px solid rgba(255,255,255,0.05);" ' +
                        'onmouseover="this.style.background=\'rgba(200,170,80,0.15)\'" onmouseout="this.style.background=\'none\'">' +
                        r.icon + ' ' + r.name + ' <span style="color:#666;font-size:0.65rem;">(' + r.category + ')</span></div>';
                }
                if (filtered.length > 40) html += '<div style="padding:4px 8px;color:#888;font-size:0.65rem;">...and ' + (filtered.length - 40) + ' more. Type to filter.</div>';
                dropdown.innerHTML = html;
                dropdown.style.display = 'block';

                // Attach click handlers
                var opts = dropdown.querySelectorAll('.order-good-option');
                for (var j = 0; j < opts.length; j++) {
                    opts[j].addEventListener('click', function() {
                        var rid = this.dataset.id;
                        var res = findResource(rid);
                        input.value = res ? (res.icon + ' ' + res.name) : rid;
                        input.dataset.selectedId = rid;
                        dropdown.style.display = 'none';
                    });
                }
            }

            input.addEventListener('focus', function() { renderDropdown(input.value); });
            input.addEventListener('input', function() {
                input.dataset.selectedId = '';
                renderDropdown(input.value);
            });

            // Close dropdown when clicking outside
            document.addEventListener('click', function(e) {
                if (!input.contains(e.target) && !dropdown.contains(e.target)) {
                    dropdown.style.display = 'none';
                }
            });

            // Qty/Max interaction
            var maxCheck = document.getElementById('orderMaxQty');
            var qtyInput = document.getElementById('orderQty');
            if (maxCheck && qtyInput) {
                maxCheck.addEventListener('change', function() {
                    qtyInput.disabled = maxCheck.checked;
                    if (maxCheck.checked) qtyInput.value = '';
                });
            }

            // Update price label and building row based on action
            var actionSel = document.getElementById('orderAction');
            var priceInput = document.getElementById('orderPriceLimit');
            if (actionSel && priceInput) {
                actionSel.addEventListener('change', function() {
                    priceInput.placeholder = (actionSel.value === 'buy') ? 'max price' : (actionSel.value === 'sell') ? 'min price' : 'limit';
                    // Show building row for store/pickup
                    var bRow = document.getElementById('orderBuildingRow');
                    var bSel = document.getElementById('orderBuilding');
                    if (bRow) {
                        var show = (actionSel.value === 'store' || actionSel.value === 'pickup');
                        bRow.style.display = show ? '' : 'none';
                        // Update label
                        var bLabel = bRow.querySelector('label');
                        if (bLabel) bLabel.textContent = actionSel.value === 'store' ? 'Store in:' : 'Pickup from:';
                        // Populate building dropdown with player buildings at relevant town
                        if (show && bSel) {
                            _populateBuildingDropdown(bSel, actionSel.value);
                        }
                    }
                });
            }
        }, 50);
    }

    function buildTransportSection(connectedTowns, seaDestinations) {
        const currentTown = Engine.findTown(Player.townId);
        if (!currentTown) return '';

        const travelDemand = currentTown.travelDemand || [];
        const landCap = Player.getTransportCapacity ? Player.getTransportCapacity() : 0;
        const seaCap = Player.getSeaTransportCapacity ? Player.getSeaTransportCapacity() : 0;
        const hasLandTransport = landCap > 0 && Player.horses && Player.horses.length > 0;
        const hasSeaTransport = seaCap > 0;
        const canTransport = hasLandTransport || hasSeaTransport;

        // Active transport manifest
        let manifestHtml = '';
        const transport = Player.activeTransport;
        if (transport) {
            const destTown = Engine.findTown(transport.toTownId);
            manifestHtml = `<div style="background:rgba(0,180,100,0.1);border:1px solid rgba(0,180,100,0.3);border-radius:6px;padding:8px;margin-bottom:10px;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <div style="font-weight:bold;color:var(--gold);">\uD83D\uDE8C Active Transport to ${destTown ? destTown.name : '?'}</div>
                    <button class="btn-medieval" style="font-size:0.65rem;padding:2px 8px;color:#e74c3c;" data-action="cancelTransportUI">❌ Cancel</button>
                </div>
                <div style="font-size:0.75rem;color:#ccc;">${transport.passengers.length} passengers | ${transport.totalRevenue}g revenue on arrival</div>
                <div style="font-size:0.7rem;margin-top:4px;">${transport.passengers.map(function(p) {
                    var icon = p.wealthClass === 'upper' ? '\uD83D\uDC51' : p.wealthClass === 'middle' ? '\uD83D\uDCBC' : '\uD83D\uDC64';
                    return icon + ' ' + p.name + ' (' + p.fare + 'g)';
                }).join(', ')}</div>
            </div>`;
        }

        if (!canTransport && travelDemand.length === 0 && !transport) return '';

        // Group demand by destination
        var destGroups = {};
        for (var i = 0; i < travelDemand.length; i++) {
            var d = travelDemand[i];
            if (!destGroups[d.destinationTownId]) {
                destGroups[d.destinationTownId] = { name: d.destinationName, travelers: [], isSea: false };
            }
            destGroups[d.destinationTownId].travelers.push(d);
        }

        // Check which destinations are reachable by land or sea
        var landDestIds = {};
        for (var li = 0; li < connectedTowns.length; li++) {
            landDestIds[connectedTowns[li].town.id] = true;
        }
        var seaDestIds = {};
        for (var si = 0; si < seaDestinations.length; si++) {
            seaDestIds[seaDestinations[si].town.id] = true;
        }

        // Build destination rows
        var demandHtml = '';
        var destIds = Object.keys(destGroups);
        for (var di = 0; di < destIds.length; di++) {
            var destId = destIds[di];
            var group = destGroups[destId];
            var isLandRoute = !!landDestIds[destId];
            var isSeaRoute = !!seaDestIds[destId];
            if (!isLandRoute && !isSeaRoute) continue;

            var routeType = isSeaRoute && !isLandRoute ? 'sea' : 'land';
            var routeIcon = routeType === 'sea' ? '\u26F5' : '\uD83D\uDE90';
            var maxCap = routeType === 'sea' ? seaCap : landCap;
            var canServe = routeType === 'sea' ? hasSeaTransport : hasLandTransport;

            // Sort by maxPrice descending
            if (!group.travelers) group.travelers = [];
            group.travelers.sort(function(a, b) { return b.maxPrice - a.maxPrice; });

            var travelerList = group.travelers.map(function(t) {
                var wIcon = t.wealthClass === 'upper' ? '\uD83D\uDC51' : t.wealthClass === 'middle' ? '\uD83D\uDCBC' : '\uD83D\uDC64';
                var urgIcon = t.urgency >= 3 ? '\u203C\uFE0F' : t.urgency >= 2 ? '\u2757' : '';
                return '<span style="font-size:0.7rem;display:inline-block;margin:1px 3px;background:rgba(255,255,255,0.05);border-radius:3px;padding:1px 4px;">' + wIcon + ' ' + t.personName + ' (max ' + t.maxPrice + 'g' + urgIcon + ')</span>';
            }).join('');

            demandHtml += '<div style="border:1px solid rgba(255,255,255,0.1);border-radius:6px;padding:8px;margin-bottom:6px;">' +
                '<div style="display:flex;justify-content:space-between;align-items:center;">' +
                    '<span style="font-weight:bold;">' + routeIcon + ' ' + group.name + ' <span style="font-size:0.75rem;color:#aaa;">(' + group.travelers.length + ' waiting)</span></span>' +
                    (canServe && !transport ? '<span style="font-size:0.7rem;color:#aaa;">Capacity: ' + maxCap + '</span>' : '') +
                '</div>' +
                '<div style="margin:4px 0;">' + travelerList + '</div>' +
                (canServe && !transport ?
                    '<div style="display:flex;gap:6px;align-items:center;margin-top:4px;">' +
                        '<label style="font-size:0.75rem;">Price/passenger:</label>' +
                        '<input type="number" id="transportPrice_' + destId + '" min="1" max="500" value="' + Math.floor(group.travelers.reduce(function(s,t){ return s + t.maxPrice; }, 0) / group.travelers.length) + '" class="qty-select" style="width:60px;">' +
                        '<button class="btn-medieval" data-action="setupTransportUI" data-id="' + destId + '" data-val="' + (routeType === 'sea') + '" style="font-size:0.7rem;padding:4px 10px;">' +
                            '\uD83D\uDE8C Board Passengers' +
                        '</button>' +
                    '</div>'
                : '') +
            '</div>';
        }

        if (!demandHtml && !manifestHtml && !canTransport) return '';

        var capacityInfo = '';
        if (hasLandTransport) capacityInfo += '\uD83D\uDE90 Land: ' + landCap + ' seats';
        if (hasSeaTransport) capacityInfo += (capacityInfo ? ' | ' : '') + '\u26F5 Sea: ' + seaCap + ' seats';
        if (!canTransport) capacityInfo = '<span style="color:#888;">Need wagon+horses or ship to transport passengers</span>';

        return '<div style="border-top:1px solid rgba(255,255,255,0.1);margin-top:12px;padding-top:10px;">' +
            '<h3 style="font-family:var(--font-display);font-size:0.85rem;color:var(--gold-dark);margin-bottom:6px;">\uD83D\uDE8C Passenger Transport</h3>' +
            '<div style="font-size:0.7rem;color:#aaa;margin-bottom:8px;">' + capacityInfo + '</div>' +
            manifestHtml +
            (demandHtml || '<div style="font-size:0.75rem;color:#888;text-align:center;">No passengers waiting to travel from this town.</div>') +
        '</div>';
    }

    function buildNPCTransportSection() {
        if (typeof Player === 'undefined' || Player.townId == null) return '';
        var town = Engine.findTown(Player.townId);
        if (!town || !town.npcTransportServices || town.npcTransportServices.length === 0) return '';
        var html = '<div style="border-top:1px solid rgba(255,255,255,0.1);margin-top:12px;padding-top:10px;">';
        html += '<h3 style="font-family:var(--font-display);font-size:0.85rem;color:var(--gold-dark);margin-bottom:6px;">\uD83D\uDE90 NPC Transport Services</h3>';
        html += '<div style="font-size:0.72rem;color:#aaa;margin-bottom:6px;">Pay for a ride \u2014 cheap travel without needing your own horse!</div>';
        for (var i = 0; i < town.npcTransportServices.length; i++) {
            var s = town.npcTransportServices[i];
            var typeIcon = s.isSea ? '\u26F5' : '\uD83D\uDC34';
            var seatsColor = s.capacity <= 1 ? 'var(--danger)' : s.capacity <= 3 ? 'var(--gold)' : '#aaa';
            var canAfford = typeof Player !== 'undefined' && Player.gold >= s.price;
            var btnStyle = canAfford ? '' : 'opacity:0.5;cursor:not-allowed;';
            var daysLeft = s.duration - ((Engine.getDay ? Engine.getDay() : 0) - s.createdDay);
            html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.08);">';
            html += '<div style="flex:1;"><span style="font-size:0.75rem;">' + typeIcon + ' <strong>' + s.operatorName + '</strong> \u2192 ' + s.destinationName + '</span>';
            html += '<div style="font-size:0.7rem;color:#888;">' + s.capacity + ' seat' + (s.capacity !== 1 ? 's' : '') + ' left \u00B7 departs in ' + daysLeft + 'd</div></div>';
            html += '<button class="btn-medieval" data-action="useNPCTransportUI" data-val="' + i + '" style="font-size:0.7rem;padding:3px 10px;' + btnStyle + '">' + s.price + 'g Board</button>';
            html += '</div>';
        }
        html += '</div>';
        return html;
    }

    function useNPCTransportUI(serviceIndex) {
        var result = Player.useNPCTransport(Player.townId, serviceIndex);
        toast(result.message, result.success ? 'success' : 'error');
        if (result.success) closeModal();
    }

    function setupTransportUI(destTownId, isSea) {
        var priceInput = document.getElementById('transportPrice_' + destTownId);
        var price = parseInt(priceInput ? priceInput.value : 20);
        if (isNaN(price) || price < 1) { toast('Enter a valid price.', 'warning'); return; }
        var result = Player.setupTransport(Player.townId, destTownId, price, isSea);
        toast(result.message, result.success ? 'success' : 'error');
        if (result.success) openCaravanDialog();
    }

    function cancelTransportUI() {
        var result = Player.cancelTransport();
        toast(result.message, result.success ? 'success' : 'error');
        if (result.success) openCaravanDialog();
    }

    function _updateCaravanPreview() {
        var container = document.getElementById('caravanPreviewContent');
        if (!container) return;

        var destEl = document.getElementById('caravanDest');
        if (!destEl || !destEl.value) {
            container.innerHTML = 'Select a destination to see stats.';
            return;
        }
        // Track destination for order row labels
        _caravanEditToTownId = destEl.value;

        // Update order location dropdown with waypoint towns if caravan_network skill
        var locSel = document.getElementById('orderLocation');
        if (locSel) {
            var prevVal = locSel.value;
            var _destTown = Engine.findTown(destEl.value);
            var _srcTown2 = Engine.findTown(Player.townId);
            var _destLabel = _destTown ? _destTown.name : 'Destination';
            var _srcLabel = _srcTown2 ? _srcTown2.name : 'Source';
            var locHtml = '<option value="destination">🏁 ' + _destLabel + '</option><option value="source">📍 ' + _srcLabel + '</option>';
            // Show waypoint towns for multi-hop routes
            try {
                var route = Engine.findPath(Player.townId, destEl.value);
                if (route && route.length > 1) {
                    var waypointSeen = {};
                    for (var wi = 0; wi < route.length; wi++) {
                        var wpIds = [route[wi].fromTownId, route[wi].toTownId];
                        for (var wj = 0; wj < wpIds.length; wj++) {
                            var wpId = wpIds[wj];
                            if (wpId === Player.townId || wpId === destEl.value || waypointSeen[wpId]) continue;
                            waypointSeen[wpId] = true;
                            var wpTown = Engine.findTown(wpId);
                            if (wpTown) locHtml += '<option value="waypoint:' + wpId + '">📍 ' + wpTown.name + ' (waypoint)</option>';
                            }
                        }
                    }
                } catch(e) {}
            locSel.innerHTML = locHtml;
            // Restore previous value if still valid
            if (prevVal) {
                for (var oi = 0; oi < locSel.options.length; oi++) {
                    if (locSel.options[oi].value === prevVal) { locSel.value = prevVal; break; }
                }
            }
        }

        // Detect sea vs land route and toggle ship selection / land equipment
        var _selectedOpt = destEl.options[destEl.selectedIndex];
        var _isSeaRoute = _selectedOpt && _selectedOpt.dataset && _selectedOpt.dataset.route === 'sea';
        var _shipSection = document.getElementById('caravanShipSection');
        var _horsesInput = document.getElementById('caravanHorses');
        var _cartsInput = document.getElementById('caravanCarts');
        var _wagonsInput = document.getElementById('caravanWagons');
        var _carrierLabel = document.querySelector('label[for="caravanCarriers"]') || (document.getElementById('caravanCarriers') ? document.getElementById('caravanCarriers').previousElementSibling : null);
        var _shipCrewInfo = document.getElementById('caravanShipCrewInfo');

        if (_isSeaRoute) {
            if (_shipSection) _shipSection.style.display = '';
            // Hide land equipment inputs
            if (_horsesInput) _horsesInput.parentElement.style.display = 'none';
            if (_cartsInput) _cartsInput.parentElement.style.display = 'none';
            if (_wagonsInput) _wagonsInput.parentElement.style.display = 'none';
            // Update carrier label to "Crew"
            if (_carrierLabel) _carrierLabel.textContent = '👥 Crew';
            // Show min crew info for selected ship
            var _shipSelect = document.getElementById('caravanShipSelect');
            if (_shipSelect && _shipCrewInfo) {
                var _shipVal = _shipSelect.value || '';
                var _minCrew = 1;
                var _shipName = '';
                if (_shipVal.indexOf('own:') === 0) {
                    var _ownId = _shipVal.substring(4);
                    var _ownShipsList = Player.getAvailableShipsAtPort ? Player.getAvailableShipsAtPort(Player.townId) : [];
                    for (var _si = 0; _si < _ownShipsList.length; _si++) {
                        if (_ownShipsList[_si].id === _ownId) {
                            var _st = CONFIG.SHIP_TYPES[_ownShipsList[_si].type] || {};
                            _minCrew = _st.minCrew || 1;
                            _shipName = _ownShipsList[_si].name || _st.name || 'Ship';
                            break;
                        }
                    }
                } else if (_shipVal.indexOf('rent:') === 0) {
                    var _rentType = _shipVal.substring(5);
                    var _rentST = CONFIG.SHIP_TYPES[_rentType] || {};
                    _minCrew = _rentST.minCrew || 1;
                    _shipName = _rentST.name || 'Ship';
                }
                _shipCrewInfo.innerHTML = '👥 Min crew: ' + _minCrew + ' for ' + _shipName;
                // Enforce min crew on carriers input
                var _carrierInput = document.getElementById('caravanCarriers');
                if (_carrierInput) {
                    _carrierInput.min = _minCrew;
                    if (parseInt(_carrierInput.value) < _minCrew) _carrierInput.value = _minCrew;
                }
            }
        } else {
            if (_shipSection) _shipSection.style.display = 'none';
            // Restore land equipment inputs
            if (_horsesInput) _horsesInput.parentElement.style.display = '';
            if (_cartsInput) _cartsInput.parentElement.style.display = '';
            if (_wagonsInput) _wagonsInput.parentElement.style.display = '';
            // Restore carrier label
            if (_carrierLabel) _carrierLabel.textContent = '🧳 Carriers';
            // Reset min crew
            var _carrierInputLand = document.getElementById('caravanCarriers');
            if (_carrierInputLand) _carrierInputLand.min = 1;
        }

        var carriers = parseInt((document.getElementById('caravanCarriers') || {}).value) || 1;
        var guards = parseInt((document.getElementById('caravanGuards') || {}).value) || 0;
        var horses = parseInt((document.getElementById('caravanHorses') || {}).value) || 0;
        var carts = parseInt((document.getElementById('caravanCarts') || {}).value) || 0;
        var wagons = parseInt((document.getElementById('caravanWagons') || {}).value) || 0;
        var weapons = parseInt((document.getElementById('caravanWeapons') || {}).value) || 0;
        var armor = parseInt((document.getElementById('caravanArmor') || {}).value) || 0;

        // Enforce constraints visually
        if (horses > carriers) { horses = carriers; document.getElementById('caravanHorses').value = horses; }
        if (carts + wagons > horses) {
            var excess = (carts + wagons) - horses;
            if (wagons >= excess) { wagons -= excess; document.getElementById('caravanWagons').value = wagons; }
            else { carts -= (excess - wagons); wagons = 0; document.getElementById('caravanCarts').value = carts; document.getElementById('caravanWagons').value = 0; }
        }
        if (weapons > guards) { weapons = guards; document.getElementById('caravanWeapons').value = weapons; }
        if (armor > guards) { armor = guards; document.getElementById('caravanArmor').value = armor; }

        try {
            var stats = Player.getCaravanStats({
                fromTownId: Player.townId,
                toTownId: destEl.value,
                carriers: carriers,
                guardCount: guards,
                carrierHorses: horses,
                carts: carts,
                wagons: wagons,
                guardWeapons: weapons,
                guardArmor: armor
            });

            var theftColor = stats.yearlyTheftPct > 50 ? '#e74c3c' : stats.yearlyTheftPct > 20 ? '#f39c12' : '#2ecc71';
            var killColor = stats.yearlyKillPct > 30 ? '#e74c3c' : stats.yearlyKillPct > 10 ? '#f39c12' : '#2ecc71';

            var h = '<div style="display:flex;gap:14px;flex-wrap:wrap;">';
            h += '<div>📦 <b>Capacity:</b> ' + stats.capacity + ' weight</div>';
            h += '<div>🕐 <b>Trip:</b> ' + stats.tripDays + ' days (RT: ' + stats.roundTripDays + ')</div>';
            h += '<div>💵 <b>Daily wage:</b> ' + stats.dailyWage + 'g/day</div>';
            h += '</div>';
            // Horse transport info for road caravans
            if (!_isSeaRoute) {
                var _maxHorseCap = carriers * (CONFIG.CARAVAN_HORSES_PER_CARRIER || 4);
                h += '<div style="font-size:0.65rem;color:#8d8;margin-top:2px;">🐴 Horse transport: up to ' + _maxHorseCap + ' horses (0 weight — walk alongside, ' + (CONFIG.CARAVAN_HORSES_PER_CARRIER || 4) + ' per carrier)</div>';
            } else {
                h += '<div style="font-size:0.65rem;color:#cc8;margin-top:2px;">🐴 Horse transport: ' + (CONFIG.CARAVAN_HORSE_SEA_WEIGHT || 15) + ' wt each (deck cargo)</div>';
            }
            h += '<div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:4px;">';
            h += '<div style="color:' + theftColor + ';">🏴‍☠️ <b>Theft risk:</b> ' + stats.yearlyTheftPct + '%/yr</div>';
            h += '<div style="color:' + killColor + ';">💀 <b>Kill risk:</b> ' + stats.yearlyKillPct + '%/yr</div>';
            h += '</div>';
            // Risk factors
            var factors = [];
            if (stats.roadUnsafe) factors.push('⚠️ Unsafe road');
            if (stats.atWar) factors.push('⚔️ At war');
            if (stats.connUnsafe) factors.push('🏚️ Unsafe connections');
            if (factors.length > 0) {
                h += '<div style="margin-top:3px;font-size:0.68rem;color:#e67e22;">' + factors.join(' • ') + '</div>';
            }
            // Hire cost estimate (carts/wagons now from inventory, not gold)
            var hireCost = carriers * (CONFIG.CARAVAN_CARRIER_HIRE_COST || 20) + guards * (CONFIG.CARAVAN_GUARD_HIRE_COST || 30);
            h += '<div style="margin-top:3px;font-size:0.68rem;color:#aaa;">💰 Hire cost: <b>' + hireCost + 'g</b>';
            if (carts > 0 || wagons > 0) h += ' + ' + carts + ' 🛒 carts + ' + wagons + ' 🚛 wagons from inventory';
            h += '</div>';
            // Show ship cost for sea routes
            if (_isSeaRoute) {
                var _prevShipSel = document.getElementById('caravanShipSelect');
                var _prevShipVal = _prevShipSel ? _prevShipSel.value : '';
                if (_prevShipVal.indexOf('own:') === 0) {
                    h += '<div style="font-size:0.68rem;color:#55a868;margin-top:2px;">⛵ Using your own ship — <b>FREE</b> (no rental fees)</div>';
                } else if (_prevShipVal.indexOf('rent:') === 0) {
                    var _prevRentType = _prevShipVal.substring(5);
                    var _prevRentCost = Player.getShipRentalCost ? Player.getShipRentalCost(_prevRentType, Player.townId) : 0;
                    h += '<div style="font-size:0.68rem;color:#ccaa33;margin-top:2px;">⛵ Ship rental: <b>' + _prevRentCost.toFixed(1) + 'g/day</b></div>';
                }
            }

            container.innerHTML = h;
        } catch(e) {
            container.innerHTML = '<span style="color:#888;">Could not calculate preview.</span>';
        }
    }

    function executeSendCaravan() {
        // Auto-add any pending order the user typed but didn't click Add
        if (!_autoAddPendingOrder()) return;

        const destSelect = document.getElementById('caravanDest');
        if (!destSelect || !destSelect.value) {
            toast('Select a destination.', 'warning');
            return;
        }

        const goods = {};
        const allGoods = {};
        for (const [resId, qty] of Object.entries(Player.inventory || {})) {
            if (qty > 0) allGoods[resId] = true;
        }
        const ts = Player.state && Player.state.townStorage && Player.state.townStorage[Player.townId] ? Player.state.townStorage[Player.townId] : {};
        for (const resId in ts) { if (ts[resId] > 0) allGoods[resId] = true; }

        for (const resId of Object.keys(allGoods)) {
            const input = document.getElementById('caravanGood_' + resId);
            if (input) {
                const qty = parseInt(input.value) || 0;
                if (qty > 0) goods[resId] = qty;
            }
        }

        // Allow empty goods if there are pickup or buy orders
        var hasPickupOrBuyOrders = _caravanOrders.some(function(o) { return o.action === 'pickup' || o.action === 'buy'; });
        if (Object.keys(goods).length === 0 && !hasPickupOrBuyOrders && _caravanOrders.length === 0) {
            toast('Load goods or add orders.', 'warning');
            return;
        }

        const guardsInput = document.getElementById('caravanGuards');
        const guards = guardsInput ? parseInt(guardsInput.value) || 0 : 0;

        // Crew & equipment
        var carriers = parseInt((document.getElementById('caravanCarriers') || {}).value) || 1;
        var carrierHorses = parseInt((document.getElementById('caravanHorses') || {}).value) || 0;
        var carts = parseInt((document.getElementById('caravanCarts') || {}).value) || 0;
        var wagons = parseInt((document.getElementById('caravanWagons') || {}).value) || 0;
        var guardWeapons = parseInt((document.getElementById('caravanWeapons') || {}).value) || 0;
        var guardArmor = parseInt((document.getElementById('caravanArmor') || {}).value) || 0;

        // Route mode
        const routeModeRadio = document.querySelector('input[name="routeMode"]:checked');
        const routeMode = routeModeRadio ? routeModeRadio.value : 'oneway';
        const roundTrip = routeMode === 'roundtrip';
        const recurring = routeMode === 'recurring';

        // Security options
        const fortified = document.getElementById('caravanFortified') ? document.getElementById('caravanFortified').checked : false;
        const decoy = document.getElementById('caravanDecoy') ? document.getElementById('caravanDecoy').checked : false;
        const armedEscort = document.getElementById('caravanArmedEscort') ? document.getElementById('caravanArmedEscort').checked : false;
        const autoPickupTravelers = document.getElementById('caravanAutoPickup') ? document.getElementById('caravanAutoPickup').checked : false;

        // Detect if sea route was selected
        const selectedOption = destSelect.options[destSelect.selectedIndex];
        const routeType = selectedOption && selectedOption.dataset && selectedOption.dataset.route;

        // Build options with crew, equipment, and order system
        const options = {
            orders: _caravanOrders.length > 0 ? _caravanOrders.slice() : null,
            roundTrip: roundTrip,
            recurring: recurring,
            fortified: fortified,
            decoy: decoy,
            armedEscort: armedEscort,
            carriers: carriers,
            guardCount: guards,
            carrierHorses: carrierHorses,
            carts: carts,
            wagons: wagons,
            guardWeapons: guardWeapons,
            guardArmor: guardArmor,
            autoPickupTravelers: autoPickupTravelers
        };

        try {
            let result;
            if (routeType === 'sea' && Player.sendSeaCaravan) {
                var shipSelect = document.getElementById('caravanShipSelect');
                var shipVal = shipSelect ? shipSelect.value : '';
                var seaOptions = {
                    carriers: parseInt((document.getElementById('caravanCarriers') || {}).value) || 1,
                    orders: _caravanOrders.length > 0 ? _caravanOrders.slice() : null,
                    roundTrip: roundTrip,
                    recurring: recurring,
                    overflowSell: false,
                    autoPickupTravelers: autoPickupTravelers
                };
                if (shipVal.indexOf('own:') === 0) {
                    seaOptions.shipId = shipVal.substring(4);
                } else if (shipVal.indexOf('rent:') === 0) {
                    seaOptions.rentalShipType = shipVal.substring(5);
                }
                result = Player.sendSeaCaravan(Player.townId, destSelect.value, goods, guards, seaOptions);
            } else {
                result = Player.sendCaravan(Player.townId, destSelect.value, goods, guards, false, options);
            }
            if (result && result.success) {
                toast(result.message || 'Caravan dispatched!', 'success', 'my_business');
                _caravanOrders = [];
                closeModal();
            } else {
                toast((result && result.message) || 'Cannot send caravan', 'warning');
            }
        } catch (e) {
            toast(e.message || 'Cannot send caravan', 'danger');
        }
    }

    // ── CARAVAN MANAGEMENT PANEL ──

    function openCaravanManagement() {
        if (!Player.caravans || Player.caravans.length === 0) {
            toast('No caravans to manage.', 'info');
            return;
        }

        var towns = Engine.getTowns ? Engine.getTowns() : [];
        var townMap = {};
        for (var i = 0; i < towns.length; i++) townMap[towns[i].id] = towns[i];

        var html = '<div style="max-height:400px;overflow-y:auto;">';

        // Active caravans first, then completed
        var sorted = Player.caravans.slice().sort(function(a, b) {
            if (a.active && !b.active) return -1;
            if (!a.active && b.active) return 1;
            return (b.daysSent || 0) - (a.daysSent || 0);
        });

        for (var ci = 0; ci < sorted.length; ci++) {
            var c = sorted[ci];
            var from = townMap[c.fromTownId];
            var to = townMap[c.toTownId];
            var progress = Math.round((c.progress || 0) * 100);
            var routeIcon = c.routeType === 'sea' ? '⛵' : '🐴';
            var statusColor = c.active ? (c.status === 'blocked' ? 'var(--danger)' : 'rgba(0,180,100,0.8)') : '#888';
            var statusLabel = c.active ? (c.status === 'blocked' ? '⛔ Blocked' : (c.returnTrip ? '↩️ Returning' : '→ Outbound')) : (c.status === 'destroyed' ? '💀 Destroyed' : '✅ Complete');
            var recurLabel = c.recurring ? ' 🔄' : (c.roundTrip ? ' ↔️' : '');

            html += '<div style="border:1px solid rgba(255,255,255,0.1);border-radius:6px;padding:10px;margin-bottom:8px;background:rgba(255,255,255,0.02);">';

            // Header row
            html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">';
            var displayFrom = c.returnTrip ? to : from;
            var displayTo = c.returnTrip ? from : to;
            html += '<span style="font-weight:bold;font-size:0.85rem;">' + routeIcon + ' ' + (displayFrom ? displayFrom.name : '?') + ' → ' + (displayTo ? displayTo.name : '?') + recurLabel + '</span>';
            html += '<span style="font-size:0.75rem;color:' + statusColor + ';">' + statusLabel + '</span>';
            html += '</div>';

            // Progress bar (if active)
            if (c.active) {
                html += '<div style="background:rgba(255,255,255,0.1);border-radius:3px;height:6px;margin-bottom:6px;">';
                html += '<div style="background:var(--gold);border-radius:3px;height:100%;width:' + progress + '%;"></div>';
                html += '</div>';
            }

            // Stats row
            html += '<div style="display:flex;gap:12px;font-size:0.7rem;color:#aaa;margin-bottom:6px;flex-wrap:wrap;">';
            html += '<span>💰 Profit: ' + (c.totalProfit || 0) + 'g</span>';
            html += '<span>💸 Spent: ' + (c.totalSpent || 0) + 'g</span>';
            html += '<span>📊 Trips: ' + (c.tripCount || 0) + '</span>';
            html += '<span>🧳 Carriers: ' + (c.carriers || 1) + '</span>';
            if (c.guards) html += '<span>⚔️ Guards: ' + c.guards + '</span>';
            if (c.carrierHorses) html += '<span>🐴 Horses: ' + c.carrierHorses + '</span>';
            if (c.carts) html += '<span>🛒 Carts: ' + c.carts + '</span>';
            if (c.wagons) html += '<span>🚗 Wagons: ' + c.wagons + '</span>';
            if (c.guardWeapons) html += '<span>⚔ Weapons: ' + c.guardWeapons + '</span>';
            if (c.guardArmor) html += '<span>🛡️ Armor: ' + c.guardArmor + '</span>';
            var cDailyWage = (c.carriers || 1) * (c.carrierWage || 4) + (c.guards || 0) * (c.guardWage || 6);
            html += '<span>💵 Wage: ' + cDailyWage + 'g/day</span>';
            if (c.daysUnpaid > 0) html += '<span style="color:#e74c3c;">⚠️ ' + c.daysUnpaid + ' days unpaid!</span>';
            if (c.disbanding) html += '<span style="color:#d4a017;">🏳️ Disbanding</span>';
            html += '</div>';

            // Current cargo
            var cargoEntries = Object.entries(c.goods || {}).filter(function(e) { return e[1] > 0; });
            if (cargoEntries.length > 0) {
                html += '<div style="font-size:0.7rem;color:#bbb;margin-bottom:4px;">📦 Cargo: ';
                html += cargoEntries.map(function(e) {
                    var r = findResource(e[0]);
                    return (r ? r.icon + ' ' : '') + (r ? r.name : e[0]) + ' ×' + e[1];
                }).join(', ');
                html += '</div>';
            }

            // Passengers
            if (c.passengers && c.passengers.length > 0) {
                html += '<div style="font-size:0.7rem;color:#bbb;margin-bottom:4px;">🚌 Passengers: ';
                html += c.passengers.map(function(p) {
                    return p.name + ' → ' + (p.destinationName || '?');
                }).join(', ');
                html += '</div>';
            }

            // Orders summary
            if (c.orders && c.orders.length > 0) {
                html += '<details style="margin-bottom:4px;"><summary style="font-size:0.7rem;color:var(--gold);cursor:pointer;">📋 ' + c.orders.length + ' Orders</summary>';
                html += '<div style="padding:4px 0;">';
                for (var oi = 0; oi < c.orders.length; oi++) {
                    var o = c.orders[oi];
                    var oRes = findResource(o.good);
                    var oName = oRes ? (oRes.icon + ' ' + oRes.name) : o.good;
                    var oAction = { buy: '🛒 Buy', sell: '💰 Sell', store: '📥 Store', pickup: '📦 Pickup' }[o.action] || o.action;
                    var oLoc = o.location === 'source' ? (from ? from.name : 'Source') : o.location === 'destination' ? (to ? to.name : 'Dest') : o.location;
                    if (o.location && o.location.indexOf('waypoint:') === 0) {
                        var wpT = Engine.findTown(o.location.replace('waypoint:', ''));
                        oLoc = wpT ? wpT.name : o.location;
                    }
                    var oQty = o.qty === 'max' ? 'Max' : o.qty;
                    var oPrice = '';
                    if (o.action === 'buy' && o.priceLimit) oPrice = ' max ' + o.priceLimit + 'g';
                    if (o.action === 'sell' && o.priceLimit) oPrice = ' min ' + o.priceLimit + 'g';
                    html += '<div style="font-size:0.68rem;padding:1px 0;">' + oAction + ' ' + oQty + ' ' + oName + ' @ ' + oLoc + oPrice + '</div>';
                }
                html += '</div></details>';
            }

            // Log (collapsible)
            if (c.log && c.log.length > 0) {
                var recentLog = c.log.slice(-15).reverse();
                html += '<details><summary style="font-size:0.7rem;color:#888;cursor:pointer;">📜 Log (' + c.log.length + ' entries)</summary>';
                html += '<div style="max-height:120px;overflow-y:auto;padding:4px;background:rgba(0,0,0,0.2);border-radius:4px;margin-top:4px;">';
                for (var li = 0; li < recentLog.length; li++) {
                    html += '<div style="font-size:0.65rem;color:#999;padding:1px 0;border-bottom:1px solid rgba(255,255,255,0.03);">';
                    html += '<span style="color:#666;">Day ' + recentLog[li].day + ':</span> ' + recentLog[li].message;
                    html += '</div>';
                }
                html += '</div></details>';
            }

            // Overflow sell toggle
            if (c.active) {
                var _ovChecked = c.overflowSell ? 'checked' : '';
                html += '<div style="margin-top:6px;font-size:0.7rem;">';
                html += '<label style="color:#aaa;cursor:pointer;"><input type="checkbox" ' + _ovChecked + ' onchange="(function(){var cv=Player.caravans.find(function(x){return x.id===\'' + c.id + '\'});if(cv){cv.overflowSell=!cv.overflowSell;UI.toast(cv.overflowSell?\'Overflow: sell to market\':\'Overflow: keep on caravan\',\'info\');UI.openCaravanManagement();}})()" style="margin-right:4px;vertical-align:middle;"> Sell overflow to market (when buildings are full)</label>';
                html += '</div>';
                var _apChecked = c.autoPickupTravelers ? 'checked' : '';
                var _apCap = (c.carriers || 1) + (c.carts || 0) * 4 + (c.wagons || 0) * 8;
                var _apCount = c.passengers ? c.passengers.length : 0;
                html += '<div style="margin-top:3px;font-size:0.7rem;">';
                html += '<label style="color:#aaa;cursor:pointer;"><input type="checkbox" ' + _apChecked + ' onchange="(function(){var cv=Player.caravans.find(function(x){return x.id===\'' + c.id + '\'});if(cv){cv.autoPickupTravelers=!cv.autoPickupTravelers;if(!cv.passengers)cv.passengers=[];UI.toast(cv.autoPickupTravelers?\'Auto-pickup: ON\':\'Auto-pickup: OFF\',\'info\');UI.openCaravanManagement();}})()" style="margin-right:4px;vertical-align:middle;"> 🚌 Auto-pickup travelers (' + _apCount + '/' + _apCap + ' seats)</label>';
                html += '</div>';
            }

            // Auto-disband conditions summary
            if (c.autoDisbandConditions && c.autoDisbandConditions.length > 0) {
                html += '<div style="margin-top:4px;font-size:0.65rem;color:#8ab;padding:3px 6px;background:rgba(80,120,180,0.15);border-radius:4px;border-left:2px solid rgba(80,120,180,0.5);">';
                html += '<span style="color:#9cc;">🔄 Auto-disband (' + c.autoDisbandConditions.length + '):</span> ';
                var condStrs = [];
                for (var _ci = 0; _ci < c.autoDisbandConditions.length; _ci++) {
                    var _cond = c.autoDisbandConditions[_ci];
                    var _loc = _cond.location === 'source' ? 'src' : 'dest';
                    if (_cond.type === 'no_supply') condStrs.push('no ' + _cond.good + ' @ ' + _loc);
                    else if (_cond.type === 'storage_full') condStrs.push('storage full @ ' + _loc);
                    else if (_cond.type === 'price_above') condStrs.push(_cond.good + ' ≥ ' + _cond.price + 'g @ ' + _loc);
                    else if (_cond.type === 'price_below') condStrs.push(_cond.good + ' ≤ ' + _cond.price + 'g @ ' + _loc);
                    else if (_cond.type === 'trip_count') condStrs.push('after ' + _cond.count + ' trips');
                    else if (_cond.type === 'profit_below') condStrs.push('avg profit < ' + _cond.amount + 'g');
                }
                html += condStrs.join(', ');
                html += '</div>';
            }

            // Action buttons
            html += '<div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap;">';
            if (c.status === 'blocked' && c.active !== false) {
                html += '<button class="btn-medieval" style="font-size:0.7rem;padding:3px 10px;" data-action="rescueCaravan" data-id="' + c.id + '">🆘 Rescue</button>';
            }
            if (c.recurring && c.active) {
                html += '<button class="btn-medieval" style="font-size:0.7rem;padding:3px 10px;background:rgba(200,60,50,0.3);" data-action="cancelRecurringRoute" data-id="' + c.id + '">⏹️ Stop Route</button>';
            }
            if (c.active && c.orders) {
                html += '<button class="btn-medieval" style="font-size:0.7rem;padding:3px 10px;" data-action="openEditCaravanOrders" data-id="' + c.id + '">📝 Edit Orders</button>';
            }
            if (c.active && !c.disbanding) {
                html += '<button class="btn-medieval" style="font-size:0.7rem;padding:3px 10px;background:rgba(180,140,50,0.3);" data-action="finishDisbandCaravan" data-id="' + c.id + '">🏳️ Finish & Disband</button>';
                html += '<button class="btn-medieval" style="font-size:0.7rem;padding:3px 10px;" data-action="openEditCaravanEquipment" data-id="' + c.id + '">⚙️ Equipment</button>';
                html += '<button class="btn-medieval" style="font-size:0.7rem;padding:3px 10px;background:rgba(80,120,180,0.3);" data-action="openAutoDisbandEditor" data-id="' + c.id + '">🔄 Auto-Disband</button>';
            }
            if (c.disbanding && c.active) {
                html += '<span style="font-size:0.7rem;color:#d4a017;padding:3px 6px;">🏳️ Disbanding…</span>';
                html += '<button class="btn-medieval" style="font-size:0.65rem;padding:2px 8px;background:rgba(200,50,50,0.3);" data-action="forceDisbandCaravan" data-id="' + c.id + '">❌ Force Now</button>';
            }
            html += '</div>';

            html += '</div>';
        }

        html += '</div>';

        var footer = '<button class="btn-medieval" data-action="openCaravanDialog">← Back to Send</button>';
        openModal('📊 Caravan Management', html, footer);
    }

    // ═══════════════════════════════════════════════════════════
    // AUTO-DISBAND CONDITION EDITOR
    // ═══════════════════════════════════════════════════════════
    var _adConditions = []; // temp state for editor

    function openAutoDisbandEditor(caravanId) {
        var caravan = null;
        for (var i = 0; i < Player.caravans.length; i++) {
            if (Player.caravans[i].id === caravanId) { caravan = Player.caravans[i]; break; }
        }
        if (!caravan) { toast('Caravan not found.', 'warning'); return; }

        _adConditions = caravan.autoDisbandConditions ? JSON.parse(JSON.stringify(caravan.autoDisbandConditions)) : [];

        _renderAutoDisbandEditor(caravanId);
    }

    function _renderAutoDisbandEditor(caravanId) {
        var caravan = null;
        for (var i = 0; i < Player.caravans.length; i++) {
            if (Player.caravans[i].id === caravanId) { caravan = Player.caravans[i]; break; }
        }
        if (!caravan) return;

        var fromTown = Engine.findTown(caravan.fromTownId);
        var toTown = Engine.findTown(caravan.toTownId);
        var fromName = fromTown ? fromTown.name : caravan.fromTownId;
        var toName = toTown ? toTown.name : caravan.toTownId;

        // Build goods list for dropdown
        var allGoods = [];
        if (typeof CONFIG !== 'undefined' && CONFIG.RESOURCES) {
            for (var rk in CONFIG.RESOURCES) {
                var r = CONFIG.RESOURCES[rk];
                if (r && r.id) allGoods.push({ id: r.id, name: r.name || r.id });
            }
        }
        allGoods.sort(function(a, b) { return a.name.localeCompare(b.name); });

        var html = '<div style="max-height:400px;overflow-y:auto;">';

        // Existing conditions
        if (_adConditions.length > 0) {
            html += '<div style="margin-bottom:10px;">';
            html += '<div style="font-size:0.75rem;color:#d4a017;margin-bottom:4px;">Current Conditions:</div>';
            for (var ci = 0; ci < _adConditions.length; ci++) {
                var cond = _adConditions[ci];
                var desc = _describeCondition(cond, fromName, toName);
                html += '<div style="display:flex;align-items:center;gap:6px;padding:3px 6px;margin:2px 0;background:rgba(80,120,180,0.15);border-radius:4px;font-size:0.7rem;">';
                html += '<span style="flex:1;color:#bcd;">' + desc + '</span>';
                html += '<button class="btn-medieval" style="font-size:0.6rem;padding:1px 6px;background:rgba(200,50,50,0.3);" data-action="_removeADCondition" data-idx="' + ci + '" data-id="' + caravanId + '">✕</button>';
                html += '</div>';
            }
            html += '</div>';
        } else {
            html += '<div style="font-size:0.7rem;color:#888;margin-bottom:10px;font-style:italic;">No auto-disband conditions set. Caravan runs until manually stopped.</div>';
        }

        // Add new condition form
        html += '<div style="border:1px solid rgba(255,255,255,0.1);border-radius:6px;padding:8px;background:rgba(0,0,0,0.2);">';
        html += '<div style="font-size:0.75rem;color:#d4a017;margin-bottom:6px;">➕ Add Condition</div>';

        // Condition type
        html += '<div style="margin-bottom:6px;">';
        html += '<label style="font-size:0.65rem;color:#999;">Type:</label><br>';
        html += '<select id="ad-type" style="width:100%;padding:3px;font-size:0.7rem;background:#2a2a2a;color:#ddd;border:1px solid #555;border-radius:3px;" onchange="UI._adTypeChanged()">';
        html += '<option value="no_supply">No supply of a good</option>';
        html += '<option value="storage_full">All building storage full</option>';
        html += '<option value="price_above">Price goes above threshold</option>';
        html += '<option value="price_below">Price drops below threshold</option>';
        html += '<option value="trip_count">After X trips</option>';
        html += '<option value="profit_below">Average profit per trip below</option>';
        html += '</select>';
        html += '</div>';

        // Good selector (for supply/price conditions)
        html += '<div id="ad-good-row" style="margin-bottom:6px;">';
        html += '<label style="font-size:0.65rem;color:#999;">Good:</label><br>';
        html += '<select id="ad-good" style="width:100%;padding:3px;font-size:0.7rem;background:#2a2a2a;color:#ddd;border:1px solid #555;border-radius:3px;">';
        for (var gi = 0; gi < allGoods.length; gi++) {
            html += '<option value="' + allGoods[gi].id + '">' + allGoods[gi].name + '</option>';
        }
        html += '</select>';
        html += '</div>';

        // Location selector
        html += '<div id="ad-loc-row" style="margin-bottom:6px;">';
        html += '<label style="font-size:0.65rem;color:#999;">Location:</label><br>';
        html += '<select id="ad-location" style="width:100%;padding:3px;font-size:0.7rem;background:#2a2a2a;color:#ddd;border:1px solid #555;border-radius:3px;">';
        html += '<option value="source">Source (' + fromName + ')</option>';
        html += '<option value="destination">Destination (' + toName + ')</option>';
        html += '</select>';
        html += '</div>';

        // Price/amount input (for price/trip/profit conditions)
        html += '<div id="ad-value-row" style="margin-bottom:6px;display:none;">';
        html += '<label id="ad-value-label" style="font-size:0.65rem;color:#999;">Price threshold:</label><br>';
        html += '<input id="ad-value" type="number" min="1" value="10" style="width:80px;padding:3px;font-size:0.7rem;background:#2a2a2a;color:#ddd;border:1px solid #555;border-radius:3px;">';
        html += '</div>';

        html += '<button class="btn-medieval" style="font-size:0.7rem;padding:4px 12px;margin-top:4px;" data-action="_addADCondition" data-id="' + caravanId + '">➕ Add</button>';
        html += '</div>';

        html += '</div>';

        var footer = '<button class="btn-medieval" data-action="saveADConditions" data-id="' + caravanId + '" style="background:rgba(50,150,80,0.3);">✅ Save & Close</button>';
        footer += ' <button class="btn-medieval" data-action="openCaravanManagement">← Back</button>';
        openModal('🔄 Auto-Disband Conditions', html, footer);

        // Initialize visibility
        setTimeout(function() { _adTypeChanged(); }, 50);
    }

    function _describeCondition(cond, fromName, toName) {
        var locName = cond.location === 'source' ? fromName : toName;
        var resObj = cond.good ? (CONFIG.RESOURCES ? CONFIG.RESOURCES[Object.keys(CONFIG.RESOURCES).find(function(k) { return CONFIG.RESOURCES[k].id === cond.good; })] : null) : null;
        var goodName = resObj ? resObj.name : (cond.good || '');
        if (cond.type === 'no_supply') return '📦 Disband if no <b>' + goodName + '</b> at <b>' + locName + '</b>';
        if (cond.type === 'storage_full') return '🏭 Disband if all building storage full at <b>' + locName + '</b>';
        if (cond.type === 'price_above') return '📈 Disband if <b>' + goodName + '</b> ≥ <b>' + cond.price + 'g</b> at <b>' + locName + '</b>';
        if (cond.type === 'price_below') return '📉 Disband if <b>' + goodName + '</b> ≤ <b>' + cond.price + 'g</b> at <b>' + locName + '</b>';
        if (cond.type === 'trip_count') return '🔢 Disband after <b>' + cond.count + '</b> trips';
        if (cond.type === 'profit_below') return '💰 Disband if avg profit/trip below <b>' + cond.amount + 'g</b>';
        return '❓ Unknown condition';
    }

    function _adTypeChanged() {
        var typeEl = document.getElementById('ad-type');
        var goodRow = document.getElementById('ad-good-row');
        var locRow = document.getElementById('ad-loc-row');
        var valRow = document.getElementById('ad-value-row');
        var valLabel = document.getElementById('ad-value-label');
        if (!typeEl) return;
        var t = typeEl.value;
        // Show/hide good selector
        if (goodRow) goodRow.style.display = (t === 'no_supply' || t === 'price_above' || t === 'price_below') ? '' : 'none';
        // Show/hide location
        if (locRow) locRow.style.display = (t === 'trip_count' || t === 'profit_below') ? 'none' : '';
        // Show/hide value input
        if (valRow) valRow.style.display = (t === 'price_above' || t === 'price_below' || t === 'trip_count' || t === 'profit_below') ? '' : 'none';
        if (valLabel) {
            if (t === 'price_above' || t === 'price_below') valLabel.textContent = 'Price threshold (gold):';
            else if (t === 'trip_count') valLabel.textContent = 'Trip count:';
            else if (t === 'profit_below') valLabel.textContent = 'Min avg profit/trip (gold):';
        }
    }

    function _addADCondition(caravanId) {
        var typeEl = document.getElementById('ad-type');
        var goodEl = document.getElementById('ad-good');
        var locEl = document.getElementById('ad-location');
        var valEl = document.getElementById('ad-value');
        if (!typeEl) return;

        var t = typeEl.value;
        var cond = { type: t };

        if (t === 'no_supply' || t === 'price_above' || t === 'price_below') {
            cond.good = goodEl ? goodEl.value : '';
            cond.location = locEl ? locEl.value : 'destination';
        }
        if (t === 'storage_full') {
            cond.location = locEl ? locEl.value : 'destination';
        }
        if (t === 'price_above' || t === 'price_below') {
            cond.price = Math.max(1, Math.floor(Number(valEl ? valEl.value : 10)));
        }
        if (t === 'trip_count') {
            cond.count = Math.max(1, Math.floor(Number(valEl ? valEl.value : 5)));
        }
        if (t === 'profit_below') {
            cond.amount = Math.max(0, Math.floor(Number(valEl ? valEl.value : 10)));
        }

        _adConditions.push(cond);
        _renderAutoDisbandEditor(caravanId);
    }

    function _removeADCondition(index, caravanId) {
        _adConditions.splice(index, 1);
        _renderAutoDisbandEditor(caravanId);
    }

    function _getADConditions() {
        return _adConditions;
    }

    function openEditCaravanOrders(caravanId) {
        var caravan = null;
        for (var i = 0; i < Player.caravans.length; i++) {
            if (Player.caravans[i].id === caravanId) { caravan = Player.caravans[i]; break; }
        }
        if (!caravan) { toast('Caravan not found.', 'warning'); return; }

        // Load existing orders into the order builder
        _caravanOrders = caravan.orders ? caravan.orders.slice() : [];
        _caravanEditFromTownId = caravan.fromTownId;
        _caravanEditToTownId = caravan.toTownId;

        var html = '<div>';
        var _editFromName = (_editSrcTown ? _editSrcTown.name : 'Source');
        var _editToName = (_editDestTown ? _editDestTown.name : 'Destination');
        html += '<div style="margin-bottom:8px;font-size:0.8rem;color:#aaa;">Editing orders for caravan: ' + _editFromName + ' ↔ ' + _editToName + '</div>';

        // Order list
        html += '<div id="caravanOrderList" style="max-height:200px;overflow-y:auto;margin-bottom:10px;">';
        if (_caravanOrders.length === 0) {
            html += '<div class="text-dim" style="text-align:center;font-size:0.75rem;">No orders. Use ➕ to add.</div>';
        } else {
            for (var j = 0; j < _caravanOrders.length; j++) {
                html += _buildOrderRow(_caravanOrders[j], j);
            }
        }
        html += '</div>';

        // Add order form (same as in caravan dialog)
        html += '<div style="border-top:1px solid rgba(255,255,255,0.08);padding-top:8px;">';
        html += '<div style="display:flex;gap:6px;align-items:flex-start;flex-wrap:wrap;margin-bottom:6px;">';
        html += '<div style="position:relative;flex:1;min-width:140px;">';
        html += '<input type="text" id="orderGoodInput" placeholder="🔍 Search goods..." autocomplete="off" style="width:100%;padding:4px 8px;font-size:0.75rem;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.15);border-radius:4px;color:#fff;">';
        html += '<div id="orderGoodDropdown" style="display:none;position:absolute;top:100%;left:0;right:0;max-height:160px;overflow-y:auto;background:rgba(20,20,30,0.98);border:1px solid rgba(255,255,255,0.2);border-radius:0 0 4px 4px;z-index:100;"></div>';
        html += '</div>';
        html += '<select id="orderAction" style="padding:4px 6px;font-size:0.75rem;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.15);border-radius:4px;color:#fff;">';
        html += '<option value="buy">🛒 Buy</option><option value="sell">💰 Sell</option><option value="store">📥 Store</option><option value="pickup">📦 Pickup</option>';
        html += '</select>';
        html += '<select id="orderLocation" style="padding:4px 6px;font-size:0.75rem;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.15);border-radius:4px;color:#fff;">';
        var _editDestTown = Engine.findTown(caravan.toTownId);
        var _editSrcTown = Engine.findTown(caravan.fromTownId);
        html += '<option value="destination">🏁 ' + (_editDestTown ? _editDestTown.name : 'Destination') + '</option><option value="source">📍 ' + (_editSrcTown ? _editSrcTown.name : 'Source') + '</option>';
        html += '</select>';
        html += '</div>';
        // Building target row (shown only for Store)
        html += '<div id="orderBuildingRow" style="display:none;margin-bottom:6px;">';
        html += '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">';
        html += '<label style="font-size:0.7rem;color:#aaa;">Store in:</label>';
        html += '<select id="orderBuilding" style="flex:1;padding:4px 6px;font-size:0.75rem;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.15);border-radius:4px;color:#fff;">';
        html += '<option value="">📦 Any (general storage)</option>';
        html += '</select>';
        html += '<label style="font-size:0.7rem;color:#aaa;cursor:pointer;"><input type="checkbox" id="orderOverflow" checked> Overflow</label>';
        html += '</div>';
        html += '</div>';
        html += '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">';
        html += '<label style="font-size:0.7rem;color:#aaa;">Qty:</label>';
        html += '<input type="number" id="orderQty" min="1" max="9999" value="" placeholder="amt" style="width:55px;padding:3px 5px;font-size:0.75rem;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.15);border-radius:4px;color:#fff;">';
        html += '<label style="font-size:0.7rem;color:#aaa;cursor:pointer;"><input type="checkbox" id="orderMaxQty"> Max</label>';
        html += '<label style="font-size:0.7rem;color:#aaa;margin-left:6px;">Price:</label>';
        html += '<input type="number" id="orderPriceLimit" min="0" max="9999" value="" placeholder="limit" style="width:55px;padding:3px 5px;font-size:0.75rem;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.15);border-radius:4px;color:#fff;">';
        html += '<button data-action="_addCaravanOrder" style="padding:4px 12px;font-size:0.75rem;background:rgba(0,150,80,0.3);border:1px solid rgba(0,150,80,0.5);color:#fff;border-radius:4px;cursor:pointer;font-weight:bold;">➕ Add</button>';
        html += '</div>';
        html += '</div>';
        html += '</div>';

        var footer = '<button class="btn-medieval" data-action="saveCaravanOrders" data-id="' + caravanId + '" style="margin-right:8px;">✅ Save Orders</button>';
        footer += '<button class="btn-medieval" data-action="openCaravanManagement">Cancel</button>';

        openModal('📝 Edit Caravan Orders', html, footer);

        // Wire up searchable dropdown (same setup)
        setTimeout(function() {
            var input = document.getElementById('orderGoodInput');
            var dropdown = document.getElementById('orderGoodDropdown');
            if (!input || !dropdown) return;
            var allRes = _getAllResourceList();
            function renderDropdown(filter) {
                var filtered = filter ? allRes.filter(function(r) {
                    return r.name.toLowerCase().indexOf(filter.toLowerCase()) !== -1 ||
                           r.id.toLowerCase().indexOf(filter.toLowerCase()) !== -1 ||
                           (r.category && r.category.toLowerCase().indexOf(filter.toLowerCase()) !== -1);
                }) : allRes;
                if (filtered.length === 0) {
                    dropdown.innerHTML = '<div style="padding:6px 8px;color:#888;font-size:0.7rem;">No matches</div>';
                    dropdown.style.display = 'block';
                    return;
                }
                var dhtml = '';
                for (var i = 0; i < Math.min(filtered.length, 40); i++) {
                    var r = filtered[i];
                    dhtml += '<div class="order-good-option" data-id="' + r.id + '" style="padding:4px 8px;cursor:pointer;font-size:0.75rem;border-bottom:1px solid rgba(255,255,255,0.05);" ' +
                        'onmouseover="this.style.background=\'rgba(200,170,80,0.15)\'" onmouseout="this.style.background=\'none\'">' +
                        r.icon + ' ' + r.name + ' <span style="color:#666;font-size:0.65rem;">(' + r.category + ')</span></div>';
                }
                dropdown.innerHTML = dhtml;
                dropdown.style.display = 'block';
                var opts = dropdown.querySelectorAll('.order-good-option');
                for (var j = 0; j < opts.length; j++) {
                    opts[j].addEventListener('click', function() {
                        var rid = this.dataset.id;
                        var res = findResource(rid);
                        input.value = res ? (res.icon + ' ' + res.name) : rid;
                        input.dataset.selectedId = rid;
                        dropdown.style.display = 'none';
                    });
                }
            }
            input.addEventListener('focus', function() { renderDropdown(input.value); });
            input.addEventListener('input', function() { input.dataset.selectedId = ''; renderDropdown(input.value); });
            document.addEventListener('click', function(e) {
                if (!input.contains(e.target) && !dropdown.contains(e.target)) dropdown.style.display = 'none';
            });
            var maxCheck = document.getElementById('orderMaxQty');
            var qtyInput = document.getElementById('orderQty');
            if (maxCheck && qtyInput) {
                maxCheck.addEventListener('change', function() { qtyInput.disabled = maxCheck.checked; if (maxCheck.checked) qtyInput.value = ''; });
            }
        }, 50);
    }

    function _getCaravanOrders() {
        return _caravanOrders.slice();
    }

    function openEditCaravanEquipment(caravanId) {
        var caravan = null;
        for (var i = 0; i < Player.caravans.length; i++) {
            if (Player.caravans[i].id === caravanId) { caravan = Player.caravans[i]; break; }
        }
        if (!caravan) { toast('Caravan not found.', 'warning'); return; }

        var horsesOwned = (Player.inventory || {})['horses'] || 0;
        var swordsOwned = (Player.inventory || {})['swords'] || 0;
        var armorOwned = (Player.inventory || {})['armor'] || 0;
        var carriers = caravan.carriers || 1;
        var guards = caravan.guards || 0;
        var curHorses = caravan.carrierHorses || 0;
        var curWeapons = caravan.guardWeapons || 0;
        var curArmor = caravan.guardArmor || 0;
        var curCarts = caravan.carts || 0;
        var curWagons = caravan.wagons || 0;
        var maxAddHorses = Math.min(carriers - curHorses, horsesOwned);
        var maxAddWeapons = Math.min(guards - curWeapons, swordsOwned);
        var maxAddArmor = Math.min(guards - curArmor, armorOwned);

        var toName = (Engine.findTown(caravan.toTownId) || {}).name || '?';
        var html = '<div>';
        html += '<div style="font-size:0.8rem;color:#aaa;margin-bottom:10px;">Caravan to <b>' + toName + '</b></div>';

        // Current equipment display
        html += '<div style="padding:8px;background:rgba(255,255,255,0.03);border-radius:6px;margin-bottom:10px;font-size:0.75rem;">';
        html += '<div style="font-weight:bold;color:var(--gold);margin-bottom:4px;">Current Equipment</div>';
        html += '<div style="display:flex;gap:12px;flex-wrap:wrap;color:#bbb;">';
        html += '<span>🧳 Carriers: ' + carriers + '</span>';
        html += '<span>⚔️ Guards: ' + guards + '</span>';
        html += '<span>🐴 Horses: ' + curHorses + '/' + carriers + '</span>';
        html += '<span>🛒 Carts: ' + curCarts + '</span>';
        html += '<span>🚗 Wagons: ' + curWagons + '</span>';
        html += '<span>⚔ Weapons: ' + curWeapons + '/' + guards + '</span>';
        html += '<span>🛡️ Armor: ' + curArmor + '/' + guards + '</span>';
        html += '</div></div>';

        // Add equipment form
        html += '<div style="font-weight:bold;color:var(--gold);margin-bottom:6px;font-size:0.8rem;">Add Equipment (from inventory)</div>';
        html += '<div style="display:flex;gap:10px;flex-wrap:wrap;font-size:0.75rem;">';
        if (maxAddHorses > 0) {
            html += '<div>🐴 Add Horses: <input type="number" id="editEqHorses" min="0" max="' + maxAddHorses + '" value="0" style="width:50px;padding:2px 4px;font-size:0.75rem;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.15);border-radius:4px;color:#fff;"> <span style="color:#888;">(own: ' + horsesOwned + ')</span></div>';
        } else {
            html += '<div style="color:#888;">🐴 No horses to add (' + (carriers <= curHorses ? 'all carriers equipped' : 'none in inventory') + ')</div>';
        }
        if (maxAddWeapons > 0) {
            html += '<div>⚔ Add Weapons: <input type="number" id="editEqWeapons" min="0" max="' + maxAddWeapons + '" value="0" style="width:50px;padding:2px 4px;font-size:0.75rem;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.15);border-radius:4px;color:#fff;"> <span style="color:#888;">(own: ' + swordsOwned + ')</span></div>';
        } else {
            html += '<div style="color:#888;">⚔ No weapons to add (' + (guards <= curWeapons ? 'all guards equipped' : 'none in inventory') + ')</div>';
        }
        if (maxAddArmor > 0) {
            html += '<div>🛡️ Add Armor: <input type="number" id="editEqArmor" min="0" max="' + maxAddArmor + '" value="0" style="width:50px;padding:2px 4px;font-size:0.75rem;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.15);border-radius:4px;color:#fff;"> <span style="color:#888;">(own: ' + armorOwned + ')</span></div>';
        } else {
            html += '<div style="color:#888;">🛡️ No armor to add (' + (guards <= curArmor ? 'all guards equipped' : 'none in inventory') + ')</div>';
        }
        html += '</div>';

        // Daily wage info
        var cWage = caravan.carrierWage || 4;
        var gWage = caravan.guardWage || 6;
        var dailyCost = carriers * cWage + guards * gWage;
        html += '<div style="margin-top:8px;font-size:0.7rem;color:#aaa;">💵 Daily wage: ' + dailyCost + 'g/day (Carrier: ' + cWage + 'g, Guard: ' + gWage + 'g)</div>';
        if (caravan.daysUnpaid > 0) {
            html += '<div style="font-size:0.7rem;color:#e74c3c;">⚠️ ' + caravan.daysUnpaid + ' days unpaid!</div>';
        }
        html += '</div>';

        var footer = '<button class="btn-medieval" data-action="saveCaravanEquipment" data-id="' + caravanId + '" style="margin-right:8px;">✅ Apply</button>';
        footer += '<button class="btn-medieval" data-action="openCaravanManagement">Cancel</button>';

        openModal('⚙️ Edit Caravan Equipment', html, footer);
    }


    // Register public functions on UI namespace
    UI._getAllResourceList = _getAllResourceList;
    UI._buildOrderRow = _buildOrderRow;
    UI._removeCaravanOrder = _removeCaravanOrder;
    UI._refreshOrderList = _refreshOrderList;
    UI._addCaravanOrder = _addCaravanOrder;
    UI._autoAddPendingOrder = _autoAddPendingOrder;
    UI.openCaravanDialog = openCaravanDialog;
    UI.buildTransportSection = buildTransportSection;
    UI.buildNPCTransportSection = buildNPCTransportSection;
    UI.useNPCTransportUI = useNPCTransportUI;
    UI.setupTransportUI = setupTransportUI;
    UI.cancelTransportUI = cancelTransportUI;
    UI._updateCaravanPreview = _updateCaravanPreview;
    UI.executeSendCaravan = executeSendCaravan;
    UI.openCaravanManagement = openCaravanManagement;
    UI.openAutoDisbandEditor = openAutoDisbandEditor;
    UI._renderAutoDisbandEditor = _renderAutoDisbandEditor;
    UI._describeCondition = _describeCondition;
    UI._adTypeChanged = _adTypeChanged;
    UI._addADCondition = _addADCondition;
    UI._removeADCondition = _removeADCondition;
    UI._getADConditions = _getADConditions;
    UI.openEditCaravanOrders = openEditCaravanOrders;
    UI._getCaravanOrders = _getCaravanOrders;
    UI.openEditCaravanEquipment = openEditCaravanEquipment;

    // --- Delegated action handlers ---
    UI.registerAction('rescueCaravan', function(_t, d) { var r = Player.rescueCaravan(d.id); UI.toast(r.message, r.success ? 'success' : 'warning'); UI.openCaravanManagement(); });
    UI.registerAction('cancelRecurringRoute', function(_t, d) { var r = Player.cancelRecurringRoute(d.id); UI.toast(r.message, r.success ? 'success' : 'warning'); UI.openCaravanManagement(); });
    UI.registerAction('finishDisbandCaravan', function(_t, d) { if (!confirm('Finish last run and disband this caravan? Goods will be dropped to storage, not sold.')) return; var r = Player.disbandCaravan(d.id); UI.toast(r.message, r.success ? 'success' : 'warning'); UI.openCaravanManagement(); });
    UI.registerAction('forceDisbandCaravan', function(_t, d) { if (!confirm('Force disband immediately? Goods will be dropped at nearest town or lost.')) return; var r = Player.forceDisbandCaravan(d.id); UI.toast(r.message, r.success ? 'success' : 'warning'); UI.openCaravanManagement(); });
    UI.registerAction('saveADConditions', function(_t, d) { var r = Player.setAutoDisbandConditions(d.id, UI._getADConditions()); UI.toast(r.message, r.success ? 'success' : 'warning'); UI.openCaravanManagement(); });
    UI.registerAction('saveCaravanOrders', function(_t, d) { if (!UI._autoAddPendingOrder()) return; var r = Player.editCaravanOrders(d.id, UI._getCaravanOrders()); UI.toast(r.message, r.success ? 'success' : 'warning'); UI.openCaravanManagement(); });
    UI.registerAction('saveCaravanEquipment', function(_t, d) { var h = parseInt((document.getElementById('editEqHorses') || {}).value) || 0; var w = parseInt((document.getElementById('editEqWeapons') || {}).value) || 0; var a = parseInt((document.getElementById('editEqArmor') || {}).value) || 0; if (h === 0 && w === 0 && a === 0) { UI.toast('No equipment changes.', 'warning'); return; } var r = Player.editCaravanEquipment(d.id, {addHorses: h, addWeapons: w, addArmor: a}); UI.toast(r.message, r.success ? 'success' : 'warning'); if (r.success) UI.openCaravanManagement(); });

    UI.registerAction('_addADCondition', function(_t, d) { UI._addADCondition(d.id); });
    UI.registerAction('_removeADCondition', function(_t, d) { UI._removeADCondition(parseInt(d.idx), d.id); });
    UI.registerAction('_addCaravanOrder', function() { UI._addCaravanOrder(); });
    UI.registerAction('_removeCaravanOrder', function(_t, d) { UI._removeCaravanOrder(parseInt(d.val)); });
    UI.registerAction('cancelTransportUI', function() { UI.cancelTransportUI(); });
    UI.registerAction('executeSendCaravan', function() { UI.executeSendCaravan(); });
    UI.registerAction('openAutoDisbandEditor', function(_t, d) { UI.openAutoDisbandEditor(d.id); });
    UI.registerAction('openEditCaravanEquipment', function(_t, d) { UI.openEditCaravanEquipment(d.id); });
    UI.registerAction('openEditCaravanOrders', function(_t, d) { UI.openEditCaravanOrders(d.id); });
    UI.registerAction('setupTransportUI', function(_t, d) { UI.setupTransportUI(d.id, d.val === 'true'); });
    UI.registerAction('useNPCTransportUI', function(_t, d) { UI.useNPCTransportUI(parseInt(d.val)); });
})(window.UI);