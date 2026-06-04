// ============================================================
// Merchant Realms — UI Outpost Module (extracted from ui.js)
// Extends window.UI with Outpost Management, Off-Sea Travel,
// and Skills Dialog functions
// ============================================================
(function(UI) {
    "use strict";
    if (!UI) throw new Error("UI must be loaded before ui_outpost.js");

    // Aliases for UI utilities
    var openModal = UI.openModal;
    var closeModal = UI.closeModal;
    var toast = UI.toast;
    var formatGold = UI.formatGold;
    var escapeHtml = UI.escapeHtml;
    var findResource = UI.findResource;

    function capitalize(s) {
        return s.charAt(0).toUpperCase() + s.slice(1);
    }
    // ═══════════════════════════════════════════════════════════
    //  OUTPOST MANAGEMENT DIALOG
    // ═══════════════════════════════════════════════════════════

    function openOutpostDialog(selectedTab) {
        var outposts = Player.getPlayerOutposts ? Player.getPlayerOutposts() : [];
        var cfg = CONFIG.OUTPOST_CONFIG || {};
        var body = '';

        if (outposts.length === 0) {
            body += '<div style="text-align:center;padding:30px">';
            body += '<div style="font-size:2em;margin-bottom:10px">⛺</div>';
            body += '<p style="font-size:1.1em;color:#ccc">You have no wilderness outposts.</p>';
            body += '<p style="color:#888;font-size:12px">Outposts extend your trade network into the wilderness.<br>';
            body += 'Found with: <span style="color:#ffd700">' + (cfg.foundingCost || 500) + 'g</span> + ' + _formatMats(cfg.foundingMaterials || {}) + '<br>';
            body += 'Starts with ' + (cfg.startingLandPlots || 4) + ' land plots and ' + (cfg.baseStorageCapacity || 200) + ' storage.</p>';
            body += '<div style="margin-top:15px">';
            body += '<button class="btn-medieval" data-action="enterOutpostPlacement" style="background:rgba(74,124,59,0.3);border-color:rgba(74,124,59,0.5);padding:8px 20px;">⛺ Found New Outpost</button>';
            body += '</div></div>';
        } else {
            body += '<div style="max-height:420px;overflow-y:auto;padding:4px">';
            for (var i = 0; i < outposts.length; i++) {
                var op = outposts[i];
                var statusIcon = op.abandoned ? '💀' : op.annexed ? '🏘️' : '⛺';
                var statusColor = op.abandoned ? '#c44e52' : op.annexed ? '#5588bb' : '#55a868';
                var housingCap = 0;
                for (var hi = 0; hi < (op.outpostHousing || []).length; hi++) {
                    var hCfg = CONFIG.OUTPOST_HOUSING && CONFIG.OUTPOST_HOUSING[op.outpostHousing[hi].type];
                    if (hCfg) housingCap += hCfg.capacity;
                }
                body += '<div style="border:1px solid #555;padding:10px;margin:5px 0;border-radius:6px;background:rgba(30,30,30,0.8);cursor:pointer" data-action="openOutpostDetail" data-id="' + op.townId + '">';
                body += '<div style="display:flex;justify-content:space-between;align-items:center">';
                body += '<h4 style="margin:0;color:#e0d6b8">' + statusIcon + ' ' + op.name + '</h4>';
                body += '<span style="color:' + statusColor + ';font-size:11px">' + (op.abandoned ? 'Abandoned' : op.annexed ? 'Village' : 'Active') + '</span>';
                body += '</div>';
                body += '<div style="display:flex;flex-wrap:wrap;gap:10px;margin:6px 0;font-size:11px;color:#aaa">';
                body += '<span>👥 ' + op.population + '/' + housingCap + '</span>';
                body += '<span>📐 ' + op.usedLandPlots + '/' + op.landPlots + ' plots</span>';
                body += '<span>👷 ' + op.workers + '</span>';
                body += '<span>🛡️ ' + op.guards + '</span>';
                body += '<span>🏰 Walls ' + op.walls + '</span>';
                body += '<span>📈 ' + Math.floor(op.prosperity) + '</span>';
                body += '<span>😊 ' + Math.floor(op.outpostHappiness || 50) + '</span>';
                body += '<span>💰 -' + Math.ceil(op.dailyCost) + 'g/day</span>';
                if (op.isPort) body += '<span style="color:#5599cc">⚓ Port</span>';
                if (op.hasRoad) body += '<span style="color:#55a868">🛤️ Road</span>';
                body += '</div>';
                // Show upgrades icons
                if ((op.outpostUpgrades || []).length > 0) {
                    body += '<div style="font-size:11px;color:#888;margin-top:2px">';
                    for (var ui = 0; ui < op.outpostUpgrades.length; ui++) {
                        var uCfg = CONFIG.OUTPOST_UPGRADES && CONFIG.OUTPOST_UPGRADES[op.outpostUpgrades[ui]];
                        if (uCfg) body += uCfg.icon + ' ';
                    }
                    body += '</div>';
                }
                body += '<div style="font-size:10px;color:#666;margin-top:2px">Click to manage →</div>';
                body += '</div>';
            }
            body += '</div>';
        }

        var footer = '<button class="btn-medieval" data-action="enterOutpostPlacement" style="background:rgba(74,124,59,0.3);border-color:rgba(74,124,59,0.5);padding:6px 15px;">⛺ Found New Outpost</button> ';
        footer += '<button class="btn-medieval" data-action="closeModal" style="padding:6px 15px;">Close</button>';
        openModal('⛺ Outpost Management (' + outposts.length + ')', body, footer);
    }

    function _formatMats(mats) {
        var parts = [];
        for (var k in mats) parts.push(mats[k] + ' ' + k);
        return parts.join(', ') || 'none';
    }

    function openOutpostDetail(townId) {
        var outposts = Player.getPlayerOutposts ? Player.getPlayerOutposts() : [];
        var op = null;
        for (var i = 0; i < outposts.length; i++) { if (outposts[i].townId === townId) { op = outposts[i]; break; } }
        if (!op) { toast('Outpost not found.', 'error'); return; }
        var cfg = CONFIG.OUTPOST_CONFIG || {};
        var costs = Player.getOutpostCosts ? Player.getOutpostCosts(townId) : null;
        var nearby = Player.getNearbyTownsForOutpost ? Player.getNearbyTownsForOutpost(townId) : [];
        var inv = Player.inventory || {};
        var gold = Player.gold || 0;
        var housingInfo = Player.getOutpostHousingInfo ? Player.getOutpostHousingInfo(townId) : null;
        var _atOutpost = (Player.townId === townId);

        var body = '<div style="padding:4px;max-height:460px;overflow-y:auto">';

        // === OVERVIEW ===
        body += '<div style="background:rgba(40,40,40,0.6);padding:10px;border-radius:6px;margin-bottom:8px">';
        body += '<h4 style="margin:0 0 6px;color:#e0d6b8">' + (op.isPort ? '⚓' : '⛺') + ' ' + op.name + '</h4>';
        body += '<div style="display:flex;flex-wrap:wrap;gap:12px;font-size:12px">';
        body += '<span>👥 Pop: ' + op.population + '/' + (cfg.maxPopulation || 30) + '</span>';
        body += '<span>📈 Prosperity: ' + Math.floor(op.prosperity) + '</span>';
        body += '<span>😊 Happiness: ' + Math.floor(op.outpostHappiness || 50) + '</span>';
        body += '<span>🏰 Walls: ' + op.walls + '/3</span>';
        body += '<span>💰 Daily: -' + Math.ceil(op.dailyCost) + 'g</span>';
        body += '<span>📅 Founded: Day ' + op.foundedDay + '</span>';
        body += '<span>📦 Storage: ' + (op.outpostStorage || 200) + '</span>';
        if (op.isPort) body += '<span style="color:#5599cc">⚓ Port</span>';
        if (op.hasRoad) body += '<span style="color:#55a868">🛤️ Connected</span>';
        body += '</div>';
        if (op.soilFertility > 0) body += '<div style="font-size:11px;color:#888;margin-top:4px">🌾 Soil fertility: ' + Math.floor(op.soilFertility * 100) + '%</div>';
        // v9p33river305: defensive guards — old/partial outpost data may lack
        // naturalDeposits / connectedRoads / connectedSeaRoutes, which would
        // crash the whole detail panel.
        var depNames = [];
        var _opDeposits = op.naturalDeposits || {};
        for (var dk in _opDeposits) { if (_opDeposits[dk] > 0) depNames.push(dk); }
        if (depNames.length > 0) body += '<div style="font-size:11px;color:#888">⛏️ Deposits: ' + depNames.join(', ') + '</div>';
        // NPC Needs display
        var _opTown = Engine.findTown(townId);
        if (_opTown && _opTown.npcNeeds && op.population > 0) {
            var _n = _opTown.npcNeeds;
            body += '<div style="margin-top:6px;font-size:11px">';
            body += '<strong style="color:#ccc">NPC Needs:</strong> ';
            var _needItems = [
                { label: '🍞 Food', val: _n.food },
                { label: '🛡️ Safety', val: _n.safety },
                { label: '😊 Happy', val: _n.happiness },
                { label: '❤️ Health', val: _n.health },
                { label: '💰 Wealth', val: _n.wealth }
            ];
            for (var _ni = 0; _ni < _needItems.length; _ni++) {
                var _nc = _needItems[_ni].val >= 60 ? '#55a868' : (_needItems[_ni].val >= 30 ? '#d4a844' : '#c44e52');
                body += '<span style="color:' + _nc + ';margin-right:8px">' + _needItems[_ni].label + ' ' + Math.round(_needItems[_ni].val) + '</span>';
            }
            body += '</div>';
        }
        body += '</div>';

        // === STORAGE ===
        body += '<div style="background:rgba(40,40,40,0.6);padding:10px;border-radius:6px;margin-bottom:8px">';
        // Use player.townStorage (where caravans and deposits actually store goods)
        var _pState = Player.state || {};
        var _pTownStorage = (_pState.townStorage || {})[townId] || {};
        // v9p33river317: previously preferred townStorage and only fell
        // back to legacy outpostStorageItems when townStorage was empty.
        // That left legacy items unwithdrawable if townStorage had even
        // one entry. Now merge: townStorage is the canonical store, but
        // any legacy items NOT also in townStorage are appended so they
        // remain visible and withdrawable.
        var storageItems = {};
        for (var _tk in _pTownStorage) {
            if (_pTownStorage[_tk] > 0) storageItems[_tk] = _pTownStorage[_tk];
        }
        var _osi = op.outpostStorageItems || {};
        for (var _ok in _osi) {
            if (_osi[_ok] > 0 && !(_ok in storageItems)) {
                storageItems[_ok] = _osi[_ok];
            }
        }
        var currentWeight = 0;
        for (var sk in storageItems) { var _sw = (findResource(sk) || {}).weight || 1; currentWeight += (storageItems[sk] || 0) * _sw; }
        var maxStorage = op.outpostStorage || 200;
        body += '<h5 style="margin:0 0 6px;color:#ccc">📦 Storage (' + currentWeight + '/' + maxStorage + ')</h5>';
        // Show stored items
        var storedKeys = Object.keys(storageItems).filter(function(k) { return storageItems[k] > 0; });
        if (storedKeys.length > 0) {
            body += '<div style="max-height:100px;overflow-y:auto;margin-bottom:6px">';
            for (var sti = 0; sti < storedKeys.length; sti++) {
                var _sResId = storedKeys[sti];
                var _sQty = storageItems[_sResId];
                var _sRes = findResource(_sResId);
                var _sName = _sRes ? _sRes.name : _sResId;
                var _sIcon = _sRes ? (_sRes.icon || '') : '';
                body += '<div style="display:flex;align-items:center;gap:6px;margin:2px 0;font-size:11px;flex-wrap:wrap">';
                body += '<span style="min-width:120px">' + _sIcon + ' ' + _sName + ': <strong>' + _sQty + '</strong></span>';
                if (Player.townId === townId) {
                    body += '<button data-action="_opOutpostWithdraw" data-id="' + townId + '" data-val="' + _sResId + '" data-qty="1" style="padding:1px 6px;font-size:10px;cursor:pointer">-1</button>';
                    body += '<button data-action="_opOutpostWithdraw" data-id="' + townId + '" data-val="' + _sResId + '" data-qty="10" style="padding:1px 6px;font-size:10px;cursor:pointer">-10</button>';
                    body += '<button data-action="_opOutpostWithdraw" data-id="' + townId + '" data-val="' + _sResId + '" data-qty="' + _sQty + '" style="padding:1px 6px;font-size:10px;cursor:pointer">All</button>';
                }
                body += '</div>';
            }
            body += '</div>';
        } else {
            body += '<div style="font-size:11px;color:#666;margin-bottom:4px">Storage is empty.</div>';
        }
        // Deposit from inventory
        if (Player.townId === townId) {
            var invKeys = [];
            var pInv = Player.inventory || {};
            for (var ik in pInv) { if (pInv[ik] > 0) invKeys.push(ik); }
            if (invKeys.length > 0 && currentWeight < maxStorage) {
                body += '<div style="margin-top:4px;font-size:11px;color:#ccc"><strong>Deposit from inventory:</strong></div>';
                body += '<div style="max-height:100px;overflow-y:auto">';
                for (var di = 0; di < invKeys.length; di++) {
                    var _dResId = invKeys[di];
                    var _dQty = pInv[_dResId];
                    var _dRes = findResource(_dResId);
                    var _dName = _dRes ? _dRes.name : _dResId;
                    var _dIcon = _dRes ? (_dRes.icon || '') : '';
                    body += '<div style="display:flex;align-items:center;gap:6px;margin:2px 0;font-size:11px;flex-wrap:wrap">';
                    body += '<span style="min-width:120px">' + _dIcon + ' ' + _dName + ' (' + _dQty + ')</span>';
                    body += '<button data-action="_opOutpostDeposit" data-id="' + townId + '" data-val="' + _dResId + '" data-qty="1" style="padding:1px 6px;font-size:10px;cursor:pointer">+1</button>';
                    body += '<button data-action="_opOutpostDeposit" data-id="' + townId + '" data-val="' + _dResId + '" data-qty="10" style="padding:1px 6px;font-size:10px;cursor:pointer">+10</button>';
                    body += '<button data-action="_opOutpostDeposit" data-id="' + townId + '" data-val="' + _dResId + '" data-qty="' + Math.min(_dQty, maxStorage - currentWeight) + '" style="padding:1px 6px;font-size:10px;cursor:pointer">Max</button>';
                    body += '</div>';
                }
                body += '</div>';
            } else if (currentWeight >= maxStorage) {
                body += '<div style="font-size:11px;color:#c44e52;margin-top:4px">⚠️ Storage is full!</div>';
            }
        } else {
            body += '<div style="font-size:11px;color:#888;margin-top:4px">Travel to this outpost to deposit/withdraw.</div>';
        }
        body += '</div>';

        // === LAND PLOTS ===
        body += '<div style="background:rgba(40,40,40,0.6);padding:10px;border-radius:6px;margin-bottom:8px">';
        body += '<h5 style="margin:0 0 6px;color:#ccc">📐 Land (' + (op.usedLandPlots || 0) + '/' + (op.landPlots || 4) + ' used)</h5>';
        if ((op.population || 0) < 10) {
            body += '<div style="font-size:11px;color:#888">Need at least 10 residents to expand land.</div>';
        } else if ((op.landPlots || 4) < (cfg.maxLandPlots || 10)) {
            if (_atOutpost) {
            var lpCost = cfg.landPlotCost || 150;
            var lpMats = cfg.landPlotMaterials || { wood: 10, stone: 5 };
            var canBuyLand = gold >= lpCost;
            for (var lmk in lpMats) { if ((inv[lmk] || 0) < lpMats[lmk]) canBuyLand = false; }
            body += '<button data-action="_opBuyLand" data-id="' + townId + '" style="padding:3px 10px;font-size:11px;cursor:pointer' + (canBuyLand ? '' : ';opacity:0.5') + '"' + (canBuyLand ? '' : ' disabled') + '>+ Buy Plot (' + lpCost + 'g + ' + _formatMats(lpMats) + ')</button>';
            } else {
                body += '<div style="font-size:11px;color:#888">📍 Travel here to buy land.</div>';
            }
        } else {
            body += '<div style="font-size:11px;color:#666">Maximum land plots reached.</div>';
        }
        body += '</div>';

        // === HOUSING ===
        body += '<div style="background:rgba(40,40,40,0.6);padding:10px;border-radius:6px;margin-bottom:8px">';
        var totalHCap = housingInfo ? housingInfo.totalCapacity : 0;
        body += '<h5 style="margin:0 0 6px;color:#ccc">🏠 Housing (' + op.population + '/' + totalHCap + ' residents)</h5>';
        // Show existing housing
        if (housingInfo && housingInfo.housing.length > 0) {
            for (var ehi = 0; ehi < housingInfo.housing.length; ehi++) {
                var eh = housingInfo.housing[ehi];
                body += '<div style="font-size:11px;color:#aaa;margin:2px 0">' + eh.icon + ' ' + eh.name + ' — ' + eh.capacity + ' capacity, comfort ' + eh.comfort + '</div>';
            }
        }
        if (housingInfo && housingInfo.playerCanRest) {
            body += '<div style="font-size:11px;color:#55a868;margin:4px 0">🛏️ You can rest here (housing has space)</div>';
        }
        // Build housing options
        var freePlots = (op.landPlots || 4) - (op.usedLandPlots || 0);
        if (freePlots > 0 && _atOutpost) {
            body += '<div style="margin-top:6px;font-size:12px;color:#ccc"><strong>Build Housing:</strong></div>';
            var hTypes = CONFIG.OUTPOST_HOUSING || {};
            for (var hk in hTypes) {
                var ht = hTypes[hk];
                if (!ht) continue;
                var hMats = ht.materials || {}; // v9p33river334: tolerate housing configs with no materials block.
                var canH = gold >= ht.cost && freePlots >= (ht.landSlots || 1);
                for (var hmk in hMats) { if ((inv[hmk] || 0) < hMats[hmk]) canH = false; }
                body += '<div style="display:flex;align-items:center;gap:6px;margin:3px 0;flex-wrap:wrap">';
                body += '<button data-action="_opBuildHousing" data-id="' + townId + '" data-val="' + hk + '" style="padding:2px 8px;font-size:11px;cursor:pointer' + (canH ? '' : ';opacity:0.5') + '"' + (canH ? '' : ' disabled') + '>Build</button>';
                body += '<span style="font-size:11px">' + ht.icon + ' ' + ht.name + ' <span style="color:#888">(' + ht.capacity + ' cap, comfort ' + ht.comfort + ' — ' + ht.cost + 'g + ' + _formatMats(hMats) + ')</span></span>';
                body += '</div>';
            }
        }
        body += '</div>';

        // === STAFF ===
        body += '<div style="background:rgba(40,40,40,0.6);padding:10px;border-radius:6px;margin-bottom:8px">';
        var maxW = cfg.maxOutpostWorkers || 15;
        var maxG = cfg.maxOutpostGuards || 4;
        body += '<h5 style="margin:0 0 6px;color:#ccc">👷 Staff (Workers: ' + op.workers + '/' + maxW + ', Guards: ' + op.guards + '/' + maxG + ')</h5>';

        // Hire/dismiss buttons
        body += '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:6px">';
        if (!op.abandoned && !op.annexed && op.population > 0 && _atOutpost) {
            body += '<button data-action="_opStaff" data-id="' + townId + '" data-val="hire" data-type="worker" style="padding:2px 8px;font-size:11px;cursor:pointer"' + (op.workers < maxW ? '' : ' disabled') + '>+ Hire Worker</button>';
            body += '<button data-action="_opStaff" data-id="' + townId + '" data-val="dismiss" data-type="worker" style="padding:2px 8px;font-size:11px;cursor:pointer"' + (op.workers > 0 ? '' : ' disabled') + '>− Dismiss Worker</button>';
            body += '<button data-action="_opStaff" data-id="' + townId + '" data-val="hire" data-type="guard" style="padding:2px 8px;font-size:11px;cursor:pointer"' + (op.guards < maxG ? '' : ' disabled') + '>+ Hire Guard</button>';
            body += '<button data-action="_opStaff" data-id="' + townId + '" data-val="dismiss" data-type="guard" style="padding:2px 8px;font-size:11px;cursor:pointer"' + (op.guards > 0 ? '' : ' disabled') + '>− Dismiss Guard</button>';
        }
        if (!_atOutpost && op.population > 0) body += '<div style="font-size:11px;color:#888">📍 Travel here to manage staff.</div>';
        if (op.population === 0) body += '<div style="font-size:11px;color:#c44e52">⚠️ Recruit NPCs before hiring staff.</div>';
        body += '</div>';
        body += '<div style="font-size:10px;color:#888;margin-bottom:6px">Workers: ' + (cfg.workerWagePerWeek || 10) + 'g/wk · Guards: ' + (cfg.guardWagePerWeek || 15) + 'g/wk</div>';

        // Worker assignments
        if (op.workers > 0) {
            body += '<div style="margin-top:4px;border-top:1px solid #444;padding-top:6px">';
            body += '<div style="font-size:12px;color:#ccc;margin-bottom:4px"><strong>Worker Assignments:</strong></div>';
            var workerIds = op.workerIds || [];
            for (var wi = 0; wi < workerIds.length; wi++) {
                var wNpc = Engine.findPerson(workerIds[wi]);
                var wName = wNpc ? wNpc.firstName + ' ' + wNpc.lastName : 'Worker';
                var wRole = Player.getWorkerAssignment ? Player.getWorkerAssignment(townId, workerIds[wi]) : null;
                var wRoleName = '⚠️ Unassigned';
                var wRoleColor = '#c44e52';
                if (wRole === 'building_maintenance') { wRoleName = '🔧 Building Maintenance'; wRoleColor = '#88aacc'; }
                else if (wRole) {
                    var wRoleCfg = CONFIG.OUTPOST_UPGRADES && CONFIG.OUTPOST_UPGRADES[wRole];
                    wRoleName = (wRoleCfg ? wRoleCfg.icon + ' ' + wRoleCfg.name : wRole);
                    wRoleColor = '#55a868';
                }
                body += '<div style="display:flex;align-items:center;gap:6px;margin:3px 0;flex-wrap:wrap">';
                body += '<span style="font-size:11px;min-width:120px">👷 ' + wName + '</span>';
                body += '<span style="font-size:10px;color:' + wRoleColor + '">' + wRoleName + '</span>';
                // Assignment dropdown (only when present)
                if (_atOutpost) {
                body += '<select onchange="UI._opAssignWorker(\'' + townId + '\',\'' + workerIds[wi] + '\',this.value)" style="font-size:10px;padding:1px 4px;background:#333;color:#ddd;border:1px solid #555">';
                body += '<option value="">-- Assign --</option>';
                body += '<option value="building_maintenance"' + (wRole === 'building_maintenance' ? ' selected' : '') + '>🔧 Building Maint.</option>';
                var upgradeRoles = ['clinic', 'tavern', 'market_stall', 'watchtower', 'chapel', 'food_hall'];
                for (var uri = 0; uri < upgradeRoles.length; uri++) {
                    var _ur = upgradeRoles[uri];
                    if ((op.outpostUpgrades || []).indexOf(_ur) >= 0) {
                        var _urCfg = CONFIG.OUTPOST_UPGRADES && CONFIG.OUTPOST_UPGRADES[_ur];
                        var _urName = _urCfg ? _urCfg.icon + ' ' + _urCfg.name : _ur;
                        body += '<option value="' + _ur + '"' + (wRole === _ur ? ' selected' : '') + '>' + _urName + '</option>';
                    }
                }
                body += '</select>';
                }
                body += '</div>';
            }
            // Building maintenance summary
            var maintCount = Player.getMaintenanceWorkerCount ? Player.getMaintenanceWorkerCount(townId) : 0;
            var playerBldCount = (op.buildings || []).filter(function(b) { return b.ownerId === 'player'; }).length;
            var maxMaint = cfg.maxMaintainedBuildings || 10;
            body += '<div style="font-size:11px;color:#88aacc;margin-top:6px">🔧 Maintenance workers: ' + maintCount + ' → supports ' + Math.min(maintCount, maxMaint) + ' buildings (you own ' + playerBldCount + ')</div>';
            if (playerBldCount > maintCount) {
                body += '<div style="font-size:11px;color:#c44e52">⚠️ Not enough maintenance workers! ' + (playerBldCount - maintCount) + ' building(s) degrading!</div>';
            }
            body += '</div>';
        }
        body += '</div>';

        // === RESIDENTS ===
        body += '<div style="background:rgba(40,40,40,0.6);padding:10px;border-radius:6px;margin-bottom:8px">';
        body += '<h5 style="margin:0 0 6px;color:#ccc">👥 Residents (' + op.population + ')</h5>';
        if (op.residents && op.residents.length > 0) {
            body += '<div style="max-height:80px;overflow-y:auto;font-size:11px;color:#aaa">';
            for (var rri = 0; rri < Math.min(op.residents.length, 20); rri++) {
                var resNpc = Engine.findPerson(op.residents[rri]);
                if (resNpc) {
                    var role = '';
                    if ((op.workerIds || []).indexOf(resNpc.id) >= 0) role = ' 👷';
                    if ((op.guardIds || []).indexOf(resNpc.id) >= 0) role = ' 🛡️';
                    body += '<span style="display:inline-block;margin:1px 4px">' + resNpc.firstName + ' ' + resNpc.lastName + role + '</span>';
                }
            }
            if (op.residents.length > 20) body += '<div style="color:#666">...and ' + (op.residents.length - 20) + ' more</div>';
            body += '</div>';
        } else {
            body += '<div style="font-size:11px;color:#666">No residents. Recruit NPCs from nearby towns.</div>';
        }
        body += '</div>';

        // === UPGRADES ===
        body += '<div style="background:rgba(40,40,40,0.6);padding:10px;border-radius:6px;margin-bottom:8px">';
        body += '<h5 style="margin:0 0 6px;color:#ccc">🔨 Upgrades</h5>';
        // Show installed upgrades with active/inactive status
        if ((op.outpostUpgrades || []).length > 0) {
            body += '<div style="margin-bottom:6px">';
            for (var iui = 0; iui < op.outpostUpgrades.length; iui++) {
                var _iuId = op.outpostUpgrades[iui];
                var iuCfg = CONFIG.OUTPOST_UPGRADES && CONFIG.OUTPOST_UPGRADES[_iuId];
                if (iuCfg) {
                    var _needsW = iuCfg.needsWorker;
                    var _isAct = !_needsW || (Player.isUpgradeActive && Player.isUpgradeActive(townId, _iuId));
                    var _statusColor = _needsW ? (_isAct ? '#55a868' : '#c44e52') : '#888';
                    var _statusText = _needsW ? (_isAct ? '✅ Active' : '❌ No worker') : '';
                    body += '<span style="display:inline-block;background:rgba(60,60,60,0.8);padding:3px 8px;border-radius:4px;font-size:11px;margin:2px;border:1px solid ' + (_needsW && !_isAct ? '#c44e52' : 'transparent') + '">';
                    body += iuCfg.icon + ' ' + iuCfg.name;
                    if (_statusText) body += ' <span style="color:' + _statusColor + ';font-size:10px">' + _statusText + '</span>';
                    body += '</span>';
                }
            }
            body += '</div>';
        }
        // Available upgrades
        if (_atOutpost) {
        var availUpgrades = CONFIG.OUTPOST_UPGRADES || {};
        var hasAvail = false;
        for (var auk in availUpgrades) {
            if ((op.outpostUpgrades || []).indexOf(auk) >= 0) continue;
            var au = availUpgrades[auk];
            if (!au) continue;
            hasAvail = true;
            var auMats = au.materials || {}; // v9p33river334: tolerate upgrades with no materials block.
            var canU = gold >= au.cost;
            for (var aumk in auMats) { if ((inv[aumk] || 0) < auMats[aumk]) canU = false; }
            var meetsReqs = true;
            if (au.requires) {
                for (var auri = 0; auri < au.requires.length; auri++) {
                    if ((op.outpostUpgrades || []).indexOf(au.requires[auri]) < 0) { meetsReqs = false; break; }
                }
            }
            body += '<div style="display:flex;align-items:center;gap:6px;margin:3px 0;flex-wrap:wrap">';
            body += '<button data-action="_opBuildUpgrade" data-id="' + townId + '" data-val="' + auk + '" style="padding:2px 8px;font-size:11px;cursor:pointer' + (canU && meetsReqs ? '' : ';opacity:0.5') + '"' + (canU && meetsReqs ? '' : ' disabled') + '>Build</button>';
            body += '<span style="font-size:11px">' + au.icon + ' ' + au.name;
            body += ' <span style="color:#888">(' + au.cost + 'g + ' + _formatMats(auMats) + ')</span>';
            if (au.recruitBonus) body += ' <span style="color:#55a868">+' + Math.round(au.recruitBonus * 100) + '% recruit</span>';
            if (!meetsReqs) body += ' <span style="color:#c44e52">[requires ' + (au.requires || []).join(', ') + ']</span>';
            body += '</span></div>';
        }
        if (!hasAvail) body += '<div style="font-size:11px;color:#666">All upgrades built!</div>';

        // Walls
        if (costs && costs.wallCost) {
            var wc = costs.wallCost;
            var canWall = gold >= wc.gold && (inv.stone || 0) >= wc.stone && (inv.wood || 0) >= wc.wood;
            body += '<div style="margin:6px 0;display:flex;align-items:center;gap:8px;flex-wrap:wrap">';
            body += '<button data-action="_opUpgradeWalls" data-id="' + townId + '" style="padding:2px 10px;font-size:11px;cursor:pointer' + (canWall ? '' : ';opacity:0.5') + '"' + (canWall ? '' : ' disabled') + '>Upgrade</button>';
            body += '<span style="font-size:11px">🏰 Walls → Lv.' + (op.walls + 1) + ' <span style="color:#888">(' + wc.gold + 'g + ' + wc.stone + ' stone + ' + wc.wood + ' wood)</span></span>';
            body += '</div>';
        } else {
            body += '<div style="font-size:11px;color:#666;margin-top:4px">🏰 Walls at max (3)</div>';
        }
        // Docks
        if (costs && !costs.isPort && costs.nearWater) {
            var dc = costs.dockCost;
            var canDock = gold >= dc.gold && (op.walls >= 1);
            for (var dMat in dc) { if (dMat !== 'gold' && (inv[dMat] || 0) < dc[dMat]) canDock = false; }
            var needWall = (op.walls < 1);
            body += '<div style="margin:4px 0;display:flex;align-items:center;gap:8px;flex-wrap:wrap">';
            if (needWall) {
                body += '<span style="font-size:11px;color:#c44e52">⚓ Docks require Walls Lv.1+</span>';
            } else {
                body += '<button data-action="_opBuildDocks" data-id="' + townId + '" style="padding:2px 10px;font-size:11px;cursor:pointer' + (canDock ? '' : ';opacity:0.5') + '"' + (canDock ? '' : ' disabled') + '>Build</button>';
                body += '<span style="font-size:11px">⚓ Docks <span style="color:#888">(' + dc.gold + 'g + ' + _formatMats(dc) + ')</span></span>';
            }
            body += '</div>';
        } else if (costs && costs.isPort) {
            body += '<div style="font-size:11px;color:#5599cc;margin-top:4px">⚓ Port — docks built</div>';
        }
        } else {
            body += '<div style="font-size:11px;color:#888;margin-top:6px">📍 Travel here to build upgrades, walls, and docks.</div>';
        }
        body += '</div>';

        // === INFRASTRUCTURE (Roads & Sea Routes) ===
        body += '<div style="background:rgba(40,40,40,0.6);padding:10px;border-radius:6px;margin-bottom:8px">';
        body += '<h5 style="margin:0 0 6px;color:#ccc">🛤️ Infrastructure</h5>';
        // v9p33river305/334: defensive — connectedRoads / connectedSeaRoutes
        // may be undefined or malformed on partial outpost data.
        var _opRoads = Array.isArray(op.connectedRoads) ? op.connectedRoads : [];
        var _opSeaRoutes = Array.isArray(op.connectedSeaRoutes) ? op.connectedSeaRoutes : [];
        if (_opRoads.length > 0) {
            for (var ri = 0; ri < _opRoads.length; ri++) {
                var cr = _opRoads[ri];
                body += '<div style="font-size:11px;color:#aaa;margin:2px 0">🛤️ Road → ' + cr.name + '</div>';
            }
        }
        if (_opSeaRoutes.length > 0) {
            for (var si = 0; si < _opSeaRoutes.length; si++) {
                var cs = _opSeaRoutes[si];
                body += '<div style="font-size:11px;color:#aaa;margin:2px 0">🚢 Sea Route → ' + cs.name + '</div>';
            }
        }
        if (_opRoads.length === 0 && _opSeaRoutes.length === 0) {
            body += '<div style="font-size:11px;color:#c44e52">⚠️ No connections — offroad access only!</div>';
        }
        // Build new road
        if (_atOutpost) {
        var landTargets = nearby.filter(function(n) { return !n.hasRoad; });
        if (landTargets.length > 0) {
            body += '<div style="margin-top:6px;font-size:12px"><strong>Build Road:</strong></div>';
            body += '<div style="max-height:80px;overflow-y:auto">';
            for (var li = 0; li < Math.min(landTargets.length, 8); li++) {
                var lt = landTargets[li];
                var rGold = Math.floor(100 + lt.dist * 0.5);
                var rWood = Math.floor(10 + lt.dist * 0.1);
                var rStone = Math.floor(8 + lt.dist * 0.08);
                if (Player.skills && Player.skills.cartographer) { rGold = Math.floor(rGold * 0.75); rWood = Math.floor(rWood * 0.75); rStone = Math.floor(rStone * 0.75); }
                var canRoad = gold >= rGold && (inv.wood || 0) >= rWood && (inv.stone || 0) >= rStone;
                body += '<div style="display:flex;align-items:center;gap:6px;margin:2px 0;flex-wrap:wrap">';
                body += '<button data-action="_opBuildRoad" data-id="' + townId + '" data-val="' + lt.townId + '" style="padding:2px 8px;font-size:11px;cursor:pointer' + (canRoad ? '' : ';opacity:0.5') + '"' + (canRoad ? '' : ' disabled') + '>Build</button>';
                body += '<span style="font-size:11px">' + lt.name + ' <span style="color:#888">(' + lt.category + ', ' + rGold + 'g + ' + rWood + ' wood + ' + rStone + ' stone)</span></span>';
                body += '</div>';
            }
            body += '</div>';
        }
        // Connect to nearby road (junction shortcut - cheaper if road passes close)
        if (_opRoads.length === 0) {
            var roadConn = Player.getNearestRoadConnection ? Player.getNearestRoadConnection(op.x, op.y, townId) : null;
            if (roadConn) {
                var jGold = Math.floor(100 + roadConn.perpDist * 0.5);
                var jWood = Math.floor(10 + roadConn.perpDist * 0.1);
                var jStone = Math.floor(8 + roadConn.perpDist * 0.08);
                if (Player.skills && Player.skills.cartographer) { jGold = Math.floor(jGold * 0.75); jWood = Math.floor(jWood * 0.75); jStone = Math.floor(jStone * 0.75); }
                var canJR = gold >= jGold && (inv.wood || 0) >= jWood && (inv.stone || 0) >= jStone;
                body += '<div style="margin-top:6px;font-size:12px;border:1px solid #6688aa;padding:6px;border-radius:4px;background:rgba(30,40,50,0.5)">';
                body += '<div style="color:#88bbdd;margin-bottom:4px"><strong>🔗 Connect to Nearby Road</strong></div>';
                body += '<div style="font-size:11px;color:#888;margin-bottom:4px">' + roadConn.fromTownName + '–' + roadConn.toTownName + ' road passes ~' + roadConn.perpDist + ' away. Creates a junction on the road.</div>';
                body += '<div style="display:flex;align-items:center;gap:6px">';
                body += '<button data-action="_opConnectToRoad" data-id="' + townId + '" style="padding:2px 8px;font-size:11px;cursor:pointer' + (canJR ? '' : ';opacity:0.5') + '"' + (canJR ? '' : ' disabled') + '>Connect</button>';
                body += '<span style="font-size:11px;color:#888">' + jGold + 'g + ' + jWood + ' wood + ' + jStone + ' stone</span>';
                body += '</div></div>';
            }
        }
        if (op.isPort) {
            var seaTargets = nearby.filter(function(n) { return n.isPort && !n.hasSeaRoute; });
            if (seaTargets.length > 0) {
                body += '<div style="margin-top:6px;font-size:12px"><strong>Build Sea Route:</strong></div>';
                for (var sti = 0; sti < Math.min(seaTargets.length, 8); sti++) {
                    var st = seaTargets[sti];
                    // v9p33river551: gold cost halved; rope/planks/cloth replaced with
                    // blasting_powder (1 per 250 dist) + demolition_tools (2 per 250 dist).
                    var sGold = Math.floor((200 + st.dist * 0.8) * 0.5);
                    var _stPer250 = Math.max(1, Math.ceil(st.dist / 250));
                    var sBlasting = _stPer250 * (CONFIG.TOLL_SEA_BLASTING_POWDER_PER_250 || 1);
                    var sDemo = _stPer250 * (CONFIG.TOLL_SEA_DEMOLITION_TOOLS_PER_250 || 2);
                    if (Player.skills && Player.skills.cartographer) {
                        sGold = Math.floor(sGold * 0.75);
                        sBlasting = Math.max(1, Math.floor(sBlasting * 0.75));
                        sDemo = Math.max(1, Math.floor(sDemo * 0.75));
                    }
                    var _pInv = (Player.inventory) || {};
                    var _haveGold = (Player.gold || 0) >= sGold;
                    var _haveBp = (_pInv.blasting_powder || 0) >= sBlasting;
                    var _haveDt = (_pInv.demolition_tools || 0) >= sDemo;
                    var _canBuildSr = _haveGold && _haveBp && _haveDt;
                    body += '<div style="display:flex;align-items:center;gap:6px;margin:2px 0;flex-wrap:wrap">';
                    body += '<button data-action="_opBuildSeaRoute" data-id="' + townId + '" data-val="' + st.townId + '" style="padding:2px 8px;font-size:11px;cursor:pointer' + (_canBuildSr ? '' : ';opacity:0.5') + '"' + (_canBuildSr ? '' : ' disabled') + '>Build</button>';
                    body += '<span style="font-size:11px">🚢 ' + st.name + ' <span style="color:' + (_haveGold ? '#888' : '#c44e52') + '">(' + sGold + 'g</span>';
                    body += ' <span style="color:' + (_haveBp ? '#888' : '#c44e52') + '">+ ' + sBlasting + ' blasting powder</span>';
                    body += ' <span style="color:' + (_haveDt ? '#888' : '#c44e52') + '">+ ' + sDemo + ' demolition tools)</span></span>';
                    body += '</div>';
                }
            }
        }
        } else {
            body += '<div style="font-size:11px;color:#888;margin-top:6px">📍 Travel here to build roads and sea routes.</div>';
        }
        body += '</div>';

        // === RECRUIT PEOPLE ===
        if (!_atOutpost) {
            // Player is at a town — can recruit people to their outpost
            var _recruitTownId = Player.townId;
            var _recruitFromTown = Engine.findTown(_recruitTownId);
            var _recruitPeople = [];
            if (_recruitFromTown && !_recruitFromTown.isWilderness && !_recruitFromTown.isOutpost) {
                try { _recruitPeople = Engine.getPeople(_recruitTownId); } catch(e) {}
                _recruitPeople = _recruitPeople.filter(function(p) {
                    return p.alive !== false && p.age >= 14 && p.occupation !== 'king' && p.occupation !== 'noble' && p.employerId !== 'player';
                });
            }
            if (_recruitPeople.length > 0) {
                body += '<div style="background:rgba(40,40,40,0.6);padding:10px;border-radius:6px;margin-bottom:8px">';
                body += '<h5 style="margin:0 0 6px;color:#a5d6a7">⛺ Recruit People</h5>';
                var maxPop = cfg.maxPopulation || 30;
                var atPopCap = (op.population || 0) >= maxPop;
                if (atPopCap) {
                    body += '<div style="font-size:11px;color:#c44e52">⚠️ Population cap reached (' + maxPop + '). Cannot recruit more.</div>';
                } else {
                    body += '<div style="font-size:11px;color:#aaa;margin-bottom:6px">Recruit people from <strong>' + _recruitFromTown.name + '</strong> to your outpost.</div>';
                    body += '<div style="max-height:280px;overflow-y:auto">';
                    // v9p33river542: precompute recruitment chance for each candidate and
                    // sort by chance descending so the best prospects show up first. Also
                    // bumped visible count from 20 → 100 per user request.
                    var _recruitShown = 0;
                    var _maxShow = 100;
                    var _curDay = Engine.getDay();
                    var _cdDays = cfg.recruitCooldownDays || 7;
                    var _recruitDecorated = [];
                    for (var _rpi0 = 0; _rpi0 < _recruitPeople.length; _rpi0++) {
                        var _rp0 = _recruitPeople[_rpi0];
                        var _rpCdKey0 = _rp0.id + '_' + townId;
                        var _rpLastAsked0 = (Player.state._outpostRecruitCooldowns || {})[_rpCdKey0] || 0;
                        var _rpDaysLeft0 = Math.max(0, _cdDays - (_curDay - _rpLastAsked0));
                        var _rpOnCd0 = _rpLastAsked0 > 0 && _rpDaysLeft0 > 0;
                        var _rpChance0 = Player.getOutpostRecruitChance ? Player.getOutpostRecruitChance(_rp0.id, townId) : 0.10;
                        _recruitDecorated.push({ p: _rp0, chance: _rpChance0, onCd: _rpOnCd0, daysLeft: _rpDaysLeft0 });
                    }
                    _recruitDecorated.sort(function(a, b) {
                        // Available candidates first, then by chance desc
                        if (a.onCd !== b.onCd) return a.onCd ? 1 : -1;
                        return b.chance - a.chance;
                    });
                    for (var _rpi = 0; _rpi < _recruitDecorated.length && _recruitShown < _maxShow; _rpi++) {
                        var _rec = _recruitDecorated[_rpi];
                        var _rp = _rec.p;
                        var _rpOcc = _rp.occupation ? capitalize(_rp.occupation) : 'None';
                        var _rpRel = Player.getRelationship ? Player.getRelationship(_rp.id) : { level: 0 };
                        var _rpRelLvl = _rpRel.level || 0;
                        var _rpDaysLeft = _rec.daysLeft;
                        var _rpOnCd = _rec.onCd;
                        var _rpChance = _rec.chance;
                        var _rpChancePct = Math.round(_rpChance * 100);
                        var _rpChanceColor = _rpChancePct >= 30 ? '#55a868' : _rpChancePct >= 15 ? '#ccaa33' : '#c44e52';

                        body += '<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 6px;border-bottom:1px solid rgba(200,170,100,0.08);font-size:11px;">';
                        body += '<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">';
                        body += (_rp.sex === 'M' ? '♂' : '♀') + ' ' + _rp.firstName + ' ' + _rp.lastName;
                        body += ' <span style="color:#888">' + _rpOcc + ', Age ' + (_rp.age || '?') + '</span>';
                        if (_rpRelLvl > 0) body += ' <span style="color:#aaa">❤' + Math.round(_rpRelLvl * 10) / 10 + '</span>';
                        body += '</span>';
                        body += '<span style="display:flex;align-items:center;gap:4px;flex-shrink:0;">';
                        body += '<span style="color:' + _rpChanceColor + ';font-size:10px">' + _rpChancePct + '%</span>';
                        if (_rpOnCd) {
                            body += '<span style="color:#888;font-size:10px">⏳' + _rpDaysLeft + 'd</span>';
                        } else {
                            body += '<button class="btn-medieval" data-action="openRecruitToOutpostDialog" data-id="' + _rp.id + '" data-val="' + townId + '" style="font-size:10px;padding:2px 6px;background:rgba(74,124,59,0.2);border-color:rgba(74,124,59,0.4);color:#a5d6a7;">Recruit</button>';
                        }
                        body += '</span></div>';
                        _recruitShown++;
                    }
                    body += '</div>';
                    if (_recruitPeople.length > _maxShow) {
                        body += '<div style="font-size:10px;color:#666;margin-top:4px">Showing first ' + _maxShow + ' of ' + _recruitPeople.length + ' eligible people (sorted by chance).</div>';
                    } else if (_recruitPeople.length > 0) {
                        body += '<div style="font-size:10px;color:#666;margin-top:4px">Sorted by recruitment chance.</div>';
                    }
                }
                body += '</div>';
            }
        } else {
            body += '<div style="font-size:11px;color:#888;margin-bottom:8px">⛺ Travel to a town to recruit people for this outpost.</div>';
        }

        // === RISK ASSESSMENT ===
        var _risks = CONFIG.OUTPOST_RISKS || {};
        if (_risks.banditRaid || _risks.buildingFire || _risks.workerDesertion || _risks.diseaseOutbreak) {
            body += '<div style="background:rgba(200,80,0,0.06);padding:10px;border-radius:6px;margin-bottom:8px;border:1px solid rgba(200,80,0,0.2)">';
            body += '<h5 style="margin:0 0 6px;color:#e0a060">⚠️ Risk Assessment</h5>';

            // Bandit Raid risk
            var _rRaid = _risks.banditRaid;
            if (_rRaid) {
                var _raidCh = _rRaid.baseChance;
                _raidCh *= (1 - (_rRaid.wallReduction[op.walls] || 0));
                _raidCh -= op.guards * _rRaid.guardReduction;
                var _hasWT = (op.outpostUpgrades || []).indexOf('watchtower') >= 0;
                if (_hasWT) _raidCh -= _rRaid.watchtowerReduction;
                _raidCh = Math.max(0.001, _raidCh);
                var _raidPct = Math.round(_raidCh * 1000) / 10;
                var _raidColor = _raidPct > 2 ? '#c44e52' : _raidPct > 0.5 ? '#d4a844' : '#55a868';
                body += '<div style="font-size:11px;margin:2px 0"><span style="color:' + _raidColor + '">🦹 Raid: ' + _raidPct + '%/day</span>';
                if (op.walls === 0) body += ' <span style="color:#888;font-size:10px">(build walls!)</span>';
                else if (op.guards === 0) body += ' <span style="color:#888;font-size:10px">(hire guards)</span>';
                body += '</div>';
            }

            // Fire risk
            var _rFire = _risks.buildingFire;
            if (_rFire && (op.buildings || []).length > 0) {
                var _fireCh = _rFire.baseChance;
                var _hasWellR = (op.outpostUpgrades || []).indexOf('well') >= 0;
                if (_hasWellR) _fireCh *= (1 - _rFire.wellReduction);
                if (_hasWT) _fireCh *= (1 - _rFire.watchtowerReduction);
                if (op.walls >= 2) _fireCh *= (1 - _rFire.stoneWallReduction);
                _fireCh = Math.max(0.001, _fireCh);
                var _firePct = Math.round(_fireCh * 1000) / 10;
                var _fireColor = _firePct > 1 ? '#c44e52' : _firePct > 0.3 ? '#d4a844' : '#55a868';
                body += '<div style="font-size:11px;margin:2px 0"><span style="color:' + _fireColor + '">🔥 Fire: ' + _firePct + '%/day/bldg</span>';
                if (!_hasWellR) body += ' <span style="color:#888;font-size:10px">(build a well!)</span>';
                body += '</div>';
            }

            // Desertion risk
            var _rDesert = _risks.workerDesertion;
            if (_rDesert && op.workers > 0) {
                var _hasTav = (op.outpostUpgrades || []).indexOf('tavern') >= 0;
                var _hasChap = (op.outpostUpgrades || []).indexOf('chapel') >= 0;
                var _hasFH = (op.outpostUpgrades || []).indexOf('food_hall') >= 0;
                var _desertLevel = 'Low';
                var _desertColor = '#55a868';
                if (!_hasTav && !_hasChap) { _desertLevel = 'High'; _desertColor = '#c44e52'; }
                else if (!_hasTav || !_hasChap) { _desertLevel = 'Medium'; _desertColor = '#d4a844'; }
                if (!_hasFH) { _desertLevel = _desertLevel === 'Low' ? 'Medium' : _desertLevel; _desertColor = _desertColor === '#55a868' ? '#d4a844' : _desertColor; }
                body += '<div style="font-size:11px;margin:2px 0"><span style="color:' + _desertColor + '">😞 Desertion: ' + _desertLevel + '</span>';
                if (!_hasTav) body += ' <span style="color:#888;font-size:10px">(build tavern)</span>';
                if (!_hasChap) body += ' <span style="color:#888;font-size:10px">(build chapel)</span>';
                body += '</div>';
            }

            // Disease risk
            var _rDisease = _risks.diseaseOutbreak;
            if (_rDisease && op.population >= 3) {
                var _diseaseCh = _rDisease.baseChance;
                var _hasClinicR = (op.outpostUpgrades || []).indexOf('clinic') >= 0;
                var _hasWellD = (op.outpostUpgrades || []).indexOf('well') >= 0;
                if (_hasClinicR) _diseaseCh *= (1 - _rDisease.clinicReduction);
                if (_hasWellD) _diseaseCh *= (1 - _rDisease.wellReduction);
                _diseaseCh = Math.max(0.001, _diseaseCh);
                var _diseasePct = Math.round(_diseaseCh * 1000) / 10;
                var _diseaseColor = _diseasePct > 0.5 ? '#c44e52' : _diseasePct > 0.2 ? '#d4a844' : '#55a868';
                body += '<div style="font-size:11px;margin:2px 0"><span style="color:' + _diseaseColor + '">🤒 Disease: ' + _diseasePct + '%/day</span>';
                if (!_hasClinicR) body += ' <span style="color:#888;font-size:10px">(build clinic)</span>';
                if (!_hasWellD) body += ' <span style="color:#888;font-size:10px">(build well)</span>';
                body += '</div>';
            }

            body += '</div>';
        }

        // === VILLAGE PETITION ===
        var minPop = cfg.villageConversionMinPop || 20;
        if (op.population >= minPop && _atOutpost) {
            body += '<div style="background:rgba(74,124,59,0.15);padding:10px;border-radius:6px;margin-bottom:8px;border:1px solid rgba(74,124,59,0.4)">';
            body += '<h5 style="margin:0 0 6px;color:#55a868">🏘️ Petition for Village Status</h5>';
            body += '<p style="font-size:11px;color:#aaa;margin:0 0 6px">Your outpost has ' + op.population + '+ residents! Petition the king to recognize it as an official village.</p>';
            body += '<button class="btn-medieval" data-action="_opPetitionVillage" data-id="' + townId + '" style="background:rgba(74,124,59,0.3);border-color:rgba(74,124,59,0.5);padding:5px 14px;font-size:12px">🏘️ Petition King</button>';
            body += '</div>';
        } else if (op.population >= minPop && !_atOutpost) {
            body += '<div style="font-size:11px;color:#888;margin-bottom:8px">🏘️ Travel here to petition for village status (' + op.population + '/' + minPop + ' residents).</div>';
        } else {
            body += '<div style="font-size:11px;color:#666;margin-bottom:8px">🏘️ Village conversion requires ' + minPop + '+ residents (' + op.population + '/' + minPop + ')</div>';
        }

        body += '</div>';

        var footer = '<button class="btn-medieval" data-action="openOutpostDialog" style="padding:6px 15px;">← Back</button> ';
        footer += '<button class="btn-medieval" data-action="closeModal" style="padding:6px 15px;">Close</button>';
        openModal('⛺ ' + op.name + ' — Management', body, footer);
    }

    // Outpost action helpers
    function _opStaff(townId, action, type) {
        var result = Player.manageOutpostStaff(townId, action, type);
        toast(result.message, result.success ? 'success' : 'error');
        openOutpostDetail(townId);
    }
    function _opAssignWorker(townId, workerId, role) {
        if (!role) {
            var result = Player.unassignOutpostWorker(townId, workerId);
            toast(result.message, result.success ? 'success' : 'info');
        } else {
            var result = Player.assignOutpostWorker(townId, workerId, role);
            toast(result.message, result.success ? 'success' : 'error');
        }
        openOutpostDetail(townId);
    }
    function _opUpgradeWalls(townId) {
        var result = Player.upgradeOutpostWalls(townId);
        toast(result.message, result.success ? 'success' : 'error');
        openOutpostDetail(townId);
    }
    function _opBuildDocks(townId) {
        var result = Player.buildOutpostDocks(townId);
        toast(result.message, result.success ? 'success' : 'error');
        openOutpostDetail(townId);
    }
    function _opBuildRoad(fromId, toId) {
        var toT = Engine.findTown(toId);
        var name = toT ? toT.name : 'unknown';
        if (!confirm('Build road to ' + name + '? This will cost gold + materials.')) return;
        var result = Player.buildOutpostRoad(fromId, toId);
        toast(result.message, result.success ? 'success' : 'error');
        openOutpostDetail(fromId);
    }
    function _opBuildSeaRoute(fromId, toId) {
        var toT = Engine.findTown(toId);
        var name = toT ? toT.name : 'unknown';
        if (!confirm('Build sea route to ' + name + '? This will cost gold + materials.')) return;
        var result = Player.buildOutpostSeaRoute(fromId, toId);
        toast(result.message, result.success ? 'success' : 'error');
        openOutpostDetail(fromId);
    }
    function _opConnectToRoad(outpostId) {
        if (!confirm('Connect to nearby road via junction? This will cost gold + materials.')) return;
        var result = Player.connectOutpostToRoad(outpostId);
        toast(result.message, result.success ? 'success' : 'error');
        openOutpostDetail(outpostId);
    }
    function _opBuyLand(townId) {
        var result = Player.buyOutpostLandPlot(townId);
        toast(result.message, result.success ? 'success' : 'error');
        openOutpostDetail(townId);
    }
    function _opBuildHousing(townId, housingType) {
        var result = Player.buildOutpostHousing(townId, housingType);
        toast(result.message, result.success ? 'success' : 'error');
        openOutpostDetail(townId);
    }
    function _opBuildUpgrade(townId, upgradeId) {
        var result = Player.buildOutpostUpgrade(townId, upgradeId);
        toast(result.message, result.success ? 'success' : 'error');
        openOutpostDetail(townId);
    }
    function _opPetitionVillage(townId) {
        if (!confirm('Petition the king to convert this outpost to a village? You will keep all land and buildings.')) return;
        var result = Player.petitionOutpostToVillage(townId);
        toast(result.message, result.success ? 'success' : 'error');
        if (result.success) openOutpostDialog();
        else openOutpostDetail(townId);
    }
    function _opOutpostDeposit(townId, resId, qty) {
        var result = Player.depositToOutpostStorage(townId, resId, qty);
        toast(result.message, result.success ? 'success' : 'error');
        openOutpostDetail(townId);
    }
    function _opOutpostWithdraw(townId, resId, qty) {
        var result = Player.withdrawFromOutpostStorage(townId, resId, qty);
        toast(result.message, result.success ? 'success' : 'error');
        openOutpostDetail(townId);
    }

    /**
     * Open recruit-to-outpost dialog for an NPC.
     */
    function openRecruitToOutpostDialog(npcId, fromOutpostId) {
        var npc = Engine.findPerson ? Engine.findPerson(npcId) : (Engine.getPerson ? Engine.getPerson(npcId) : null);
        if (!npc) { toast('NPC not found.', 'error'); return; }
        // Track source outpost so we can return to it
        window._recruitFromOutpostId = fromOutpostId || null;
        var outposts = Player.getPlayerOutposts ? Player.getPlayerOutposts() : [];
        outposts = outposts.filter(function(o) { return !o.abandoned && !o.annexed && o.isOutpost; });
        if (outposts.length === 0) { toast('No active outposts.', 'error'); return; }
        var cfg = CONFIG.OUTPOST_CONFIG || {};

        var html = '<div style="padding:8px">';
        html += '<p style="color:#aaa;font-size:12px;margin:0 0 8px">Convince <strong>' + npc.firstName + ' ' + npc.lastName + '</strong> to move to one of your outposts.</p>';

        for (var i = 0; i < outposts.length; i++) {
            var op = outposts[i];
            // Check housing capacity
            var housingCap = 0;
            for (var hi = 0; hi < (op.outpostHousing || []).length; hi++) {
                var hCfg = CONFIG.OUTPOST_HOUSING && CONFIG.OUTPOST_HOUSING[op.outpostHousing[hi].type];
                if (hCfg) housingCap += hCfg.capacity;
            }
            var hasSpace = op.population < housingCap;
            var maxPop = cfg.maxPopulation || 30;
            var atPopCap = (op.population || 0) >= maxPop;
            var chance = Player.getOutpostRecruitChance ? Player.getOutpostRecruitChance(npcId, op.townId) : 0.10;
            // Reflect no-housing penalty in displayed chance
            if (!hasSpace) chance = Math.max((cfg.recruitMinChance || 0.03), chance - 0.225);
            var chanceStr = Math.round(chance * 100);

            // Check cooldown
            var cooldownKey = npcId + '_' + op.townId;
            var lastAsked = (Player.state._outpostRecruitCooldowns || {})[cooldownKey] || 0;
            var daysLeft = Math.max(0, (cfg.recruitCooldownDays || 7) - (Engine.getDay() - lastAsked));
            var onCooldown = lastAsked > 0 && daysLeft > 0;

            html += '<div style="border:1px solid #555;padding:8px;margin:5px 0;border-radius:5px;background:rgba(30,30,30,0.8)">';
            html += '<div style="display:flex;justify-content:space-between;align-items:center">';
            html += '<strong style="color:#e0d6b8">' + op.name + '</strong>';
            html += '<span style="color:' + (chanceStr >= 30 ? '#55a868' : chanceStr >= 15 ? '#ccaa33' : '#c44e52') + ';font-size:13px">' + chanceStr + '% chance</span>';
            html += '</div>';
            html += '<div style="font-size:11px;color:#888;margin:4px 0">👥 ' + op.population + '/' + maxPop + ' residents (housing: ' + housingCap + ')';
            if (op.hasRoad) html += ' | 🛤️ Road';
            html += ' | Upgrades: ' + (op.outpostUpgrades || []).length;
            html += '</div>';

            if (atPopCap) {
                html += '<div style="font-size:11px;color:#c44e52">⚠️ Population cap reached (' + maxPop + '). Consider converting to village.</div>';
            } else if (onCooldown) {
                html += '<div style="font-size:11px;color:#c44e52">⏳ Cooldown: ' + daysLeft + ' day(s) remaining.</div>';
            } else {
                // No-housing warning and shelter item options
                if (!hasSpace) {
                    html += '<div style="font-size:11px;color:#cc8833;margin-bottom:4px">⚠️ No housing space — recruitment chance reduced by ~22%.</div>';
                    var _hasCK = (Player.inventory.camping_kit || 0) >= 1;
                    var _hasTent = (Player.inventory.tent || 0) >= 1;
                    var _hasBR = (Player.inventory.bedroll || 0) >= 1;
                    if (_hasCK || _hasTent || _hasBR) {
                        html += '<div style="font-size:11px;color:#aaa;margin-bottom:4px">Offer shelter to reduce penalty:</div>';
                        html += '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:4px">';
                        html += '<select id="recruit_shelter_' + op.townId + '" style="font-size:11px;padding:2px 4px;background:#222;color:#e0d6b8;border:1px solid #555">';
                        html += '<option value="">None</option>';
                        if (_hasCK) html += '<option value="camping_kit">🏕️ Camping Kit (-50% penalty)</option>';
                        if (_hasTent) html += '<option value="tent">⛺ Tent (-35% penalty)</option>';
                        if (_hasBR) html += '<option value="bedroll">🛏️ Bedroll (-25% penalty)</option>';
                        html += '</select></div>';
                    }
                }
                // Gold incentive + recruit button
                html += '<div style="display:flex;gap:6px;align-items:center;margin-top:4px">';
                html += '<span style="font-size:11px">Gold incentive:</span>';
                html += '<input type="number" id="recruit_gold_' + op.townId + '" value="0" min="0" step="50" style="width:60px;font-size:11px;padding:2px;background:#222;color:#e0d6b8;border:1px solid #555">';
                html += '<button class="btn-medieval" data-action="_doRecruitNpc" data-id="' + npcId + '" data-val="' + op.townId + '" style="font-size:11px;padding:3px 10px;background:rgba(74,124,59,0.3);border-color:rgba(74,124,59,0.5)">⛺ Recruit</button>';
                html += '</div>';
                html += '<div style="font-size:10px;color:#666">Each ' + (cfg.recruitGoldPerPercent || 50) + 'g adds ~1% chance (max +' + Math.round((cfg.recruitMaxGoldBonus || 0.20) * 100) + '%)</div>';
            }
            html += '</div>';
        }
        html += '</div>';
        var footer = '<button class="btn-medieval" data-action="_closeRecruitAndRestore" style="padding:6px 15px;">Close</button>';
        openModal('⛺ Recruit ' + npc.firstName + ' to Outpost', html, footer);
    }

    function _closeRecruitAndRestore() {
        if (window._recruitFromOutpostId) {
            var _retId = window._recruitFromOutpostId;
            window._recruitFromOutpostId = null;
            openOutpostDetail(_retId);
        } else if (window._townPeopleData) {
            UI._renderTownPeople(
                'name-asc', 'all', '', window._townPeoplePage || 0
            );
        } else {
            closeModal();
        }
    }

    function _doRecruitNpc(npcId, townId) {
        var goldInput = document.getElementById('recruit_gold_' + townId);
        var goldIncentive = goldInput ? parseInt(goldInput.value) || 0 : 0;
        var shelterSel = document.getElementById('recruit_shelter_' + townId);
        var shelterItem = shelterSel ? shelterSel.value : '';
        var result = Player.recruitNpcToOutpost(npcId, townId, goldIncentive, shelterItem);
        toast(result.message, result.success ? 'success' : 'warning');
        // Return to outpost management if opened from there
        if (window._recruitFromOutpostId) {
            var _retId = window._recruitFromOutpostId;
            window._recruitFromOutpostId = null;
            openOutpostDetail(_retId);
        } else if (window._townPeopleData) {
            UI._renderTownPeople(
                document.getElementById('people-sort') ? document.getElementById('people-sort').value : 'name-asc',
                document.getElementById('people-filter') ? document.getElementById('people-filter').value : 'all',
                document.getElementById('people-search') ? document.getElementById('people-search').value : '',
                window._townPeoplePage || 0
            );
        } else {
            if (result.success) closeModal();
            else openRecruitToOutpostDialog(npcId);
        }
    }

    function enterOutpostPlacement() {
        closeModal();
        toast('⛺ Right-click on the map where you want to found your outpost.', 'info');
        window._outpostPlacementMode = true;
    }

    function confirmOutpostPlacement(destX, destY) {
        var terrain = Engine.getTerrainAtPixel(destX, destY);
        if (terrain === 2) { toast('Cannot build on water.', 'error'); return; }
        if (terrain === 3) { toast('Cannot build on mountains.', 'error'); return; }
        // Minimum distance from existing locations
        var cfg = CONFIG.OUTPOST_CONFIG || {};
        var minDistTiles = cfg.minDistanceTiles || 5;
        var minDistPx = minDistTiles * (CONFIG.TILE_SIZE || 16);
        var allTownsCheck = Engine.getTowns ? Engine.getTowns() : [];
        for (var ci = 0; ci < allTownsCheck.length; ci++) {
            var ct = allTownsCheck[ci];
            if (ct.abandoned || ct.destroyed) continue;
            if (Math.hypot(destX - ct.x, destY - ct.y) < minDistPx) {
                toast('⚠️ Too close to ' + ct.name + '! Must be at least ' + minDistTiles + ' tiles from any location.', 'error');
                return;
            }
        }
        var playerX = Player.worldX || 0;
        var playerY = Player.worldY || 0;
        if (Player.townId) {
            var pTown = Engine.findTown(Player.townId);
            if (pTown) { playerX = pTown.x; playerY = pTown.y; }
        }
        var pathCheck = Engine.findTerrainPath(playerX, playerY, destX, destY, 'land');
        if (!pathCheck || !pathCheck.waypoints || pathCheck.waypoints.length === 0) {
            toast('⚠️ Cannot reach by land — water or mountains block the path.', 'error');
            return;
        }
        var baseCost = cfg.foundingCost || 500;
        var mats = cfg.foundingMaterials || {};
        var gold = Player.gold || 0;
        var inv = Player.inventory || {};
        var dist = Math.floor(Math.hypot(destX - playerX, destY - playerY));

        // Helper: build shortage text for a given gold + materials requirement
        function _shortageText(needGold, needMats) {
            var missing = [];
            if (gold < needGold) missing.push('Need ' + needGold + 'g (have ' + Math.floor(gold) + 'g)');
            for (var sk in needMats) { if ((inv[sk] || 0) < needMats[sk]) missing.push('Need ' + needMats[sk] + ' ' + sk + ' (have ' + (inv[sk] || 0) + ')'); }
            return missing.length > 0 ? '<div style="font-size:10px;color:#c44e52;margin-top:3px">⚠️ ' + missing.join(', ') + '</div>' : '';
        }

        // Find nearest settlement for road cost calc
        var allTowns = Engine.getTowns ? Engine.getTowns() : [];
        var nearestSettle = null, nearDist = Infinity;
        for (var ti = 0; ti < allTowns.length; ti++) {
            var t = allTowns[ti];
            if (t.category === 'outpost' || t.abandoned || t.isJunction) continue;
            var d = Math.hypot(destX - t.x, destY - t.y);
            if (d < nearDist) { nearDist = d; nearestSettle = t; }
        }
        var roadGold = nearestSettle ? Math.floor(100 + nearDist * 0.5) : 0;
        var roadWood = nearestSettle ? Math.floor(10 + nearDist * 0.1) : 0;
        var roadStone = nearestSettle ? Math.floor(8 + nearDist * 0.08) : 0;
        if (Player.skills && Player.skills.cartographer) { roadGold = Math.floor(roadGold * 0.75); roadWood = Math.floor(roadWood * 0.75); roadStone = Math.floor(roadStone * 0.75); }

        var totalWithRoad = baseCost + roadGold;
        var totalMatsWithRoad = {};
        for (var mk in mats) totalMatsWithRoad[mk] = mats[mk];
        totalMatsWithRoad.wood = (totalMatsWithRoad.wood || 0) + roadWood;
        totalMatsWithRoad.stone = (totalMatsWithRoad.stone || 0) + roadStone;

        var html = '<div style="padding:8px;">';
        html += '<p style="margin:0 0 8px;font-size:0.85rem;color:#aaa;">Found an outpost here. Distance: ~' + dist + '. Starts with ' + (cfg.startingLandPlots || 4) + ' land plots + ' + (cfg.baseStorageCapacity || 200) + ' storage.</p>';

        // Base costs
        html += '<div style="margin:6px 0;font-size:12px;color:#ccc"><strong>Base Cost:</strong> ' + baseCost + 'g + ' + _formatMats(mats) + '</div>';

        // Option 1: Without road
        var canBase = gold >= baseCost;
        var baseMatOk = true;
        for (var bmk in mats) { if ((inv[bmk] || 0) < mats[bmk]) { canBase = false; baseMatOk = false; } }
        html += '<div style="border:1px solid #555;padding:8px;margin:6px 0;border-radius:5px;background:rgba(30,30,30,0.8)">';
        html += '<div style="font-size:12px;color:#e0d6b8;margin-bottom:4px">🏕️ Found Without Road</div>';
        html += '<div style="font-size:11px;color:#888">Only reachable by offroad travel. Cost: ' + baseCost + 'g + ' + _formatMats(mats) + '</div>';
        html += '<button class="btn-medieval" data-action="_foundOutpostAtLocation" data-x="' + destX + '" data-y="' + destY + '" data-road="false" style="margin-top:5px;padding:4px 14px;font-size:11px;background:rgba(74,124,59,0.3);border-color:rgba(74,124,59,0.5)' + (canBase ? '' : ';opacity:0.5') + '"' + (canBase ? '' : ' disabled') + '>⛺ Found (No Road)</button>';
        if (!canBase) html += _shortageText(baseCost, mats);
        html += '</div>';

        // Option 2: With road to nearest settlement
        if (nearestSettle) {
            var canWithRoad = gold >= totalWithRoad;
            for (var rwmk in totalMatsWithRoad) { if ((inv[rwmk] || 0) < totalMatsWithRoad[rwmk]) canWithRoad = false; }
            html += '<div style="border:1px solid #555;padding:8px;margin:6px 0;border-radius:5px;background:rgba(30,30,30,0.8)">';
            html += '<div style="font-size:12px;color:#e0d6b8;margin-bottom:4px">🛤️ Found With Road to ' + nearestSettle.name + '</div>';
            html += '<div style="font-size:11px;color:#888">Integrates into travel/caravan system. Total: ' + totalWithRoad + 'g + ' + _formatMats(totalMatsWithRoad) + '</div>';
            html += '<div style="font-size:10px;color:#55a868">+15% NPC recruitment bonus with road!</div>';
            html += '<button class="btn-medieval" data-action="_foundOutpostAtLocation" data-x="' + destX + '" data-y="' + destY + '" data-road="true" style="margin-top:5px;padding:4px 14px;font-size:11px;background:rgba(74,124,59,0.3);border-color:rgba(74,124,59,0.5)' + (canWithRoad ? '' : ';opacity:0.5') + '"' + (canWithRoad ? '' : ' disabled') + '>🛤️ Found (With Road)</button>';
            if (!canWithRoad) html += _shortageText(totalWithRoad, totalMatsWithRoad);
            html += '</div>';
        }

        // Option 3: Connect to nearby road (if a road passes closer than nearest town)
        var roadConn = Player.getNearestRoadConnection ? Player.getNearestRoadConnection(destX, destY, null) : null;
        if (roadConn && nearestSettle && roadConn.perpDist < nearDist * 0.75) {
            var jRoadGold = Math.floor(100 + roadConn.perpDist * 0.5);
            var jRoadWood = Math.floor(10 + roadConn.perpDist * 0.1);
            var jRoadStone = Math.floor(8 + roadConn.perpDist * 0.08);
            if (Player.skills && Player.skills.cartographer) { jRoadGold = Math.floor(jRoadGold * 0.75); jRoadWood = Math.floor(jRoadWood * 0.75); jRoadStone = Math.floor(jRoadStone * 0.75); }
            var totalJunction = baseCost + jRoadGold;
            var totalJMats = {};
            for (var jmk in mats) totalJMats[jmk] = mats[jmk];
            totalJMats.wood = (totalJMats.wood || 0) + jRoadWood;
            totalJMats.stone = (totalJMats.stone || 0) + jRoadStone;
            var canJunction = gold >= totalJunction;
            for (var jrmk in totalJMats) { if ((inv[jrmk] || 0) < totalJMats[jrmk]) canJunction = false; }
            html += '<div style="border:1px solid #6688aa;padding:8px;margin:6px 0;border-radius:5px;background:rgba(30,40,50,0.8)">';
            html += '<div style="font-size:12px;color:#88bbdd;margin-bottom:4px">🔗 Connect to ' + roadConn.fromTownName + '–' + roadConn.toTownName + ' Road via new junction</div>';
            html += '<div style="font-size:11px;color:#888">Road passes ~' + roadConn.perpDist + ' away (cheaper than ' + nearDist + ' to ' + nearestSettle.name + '). Total: ' + totalJunction + 'g + ' + _formatMats(totalJMats) + '</div>';
            html += '<div style="font-size:10px;color:#55a868">+15% NPC recruitment bonus with road!</div>';
            html += '<button class="btn-medieval" data-action="_foundOutpostAtLocation" data-x="' + destX + '" data-y="' + destY + '" data-road="true" data-junction="true" style="margin-top:5px;padding:4px 14px;font-size:11px;background:rgba(59,89,124,0.3);border-color:rgba(59,89,124,0.5)' + (canJunction ? '' : ';opacity:0.5') + '"' + (canJunction ? '' : ' disabled') + '>🔗 Found (Connect to Road)</button>';
            if (!canJunction) html += _shortageText(totalJunction, totalJMats);
            html += '</div>';
        }

        html += '</div>';
        var footer = '<button class="btn-medieval" data-action="closeModal" style="padding:6px 16px;">Cancel</button>';
        openModal('⛺ Found Outpost Here', html, footer);
    }

    function _foundOutpostAtLocation(destX, destY, buildWithRoad, roadTargetTownId, viaJunction) {
        closeModal();
        // Start travel to location, then found on arrival
        var result = Player.travelToCoords ? Player.travelToCoords(destX, destY) : null;
        if (!result || !result.success) {
            toast((result && result.message) || 'Cannot travel there.', 'warning');
            return;
        }
        Player.state._pendingOutpostFound = true;
        Player.state._pendingOutpostRoad = !!buildWithRoad;
        if (roadTargetTownId) Player.state._pendingOutpostRoadTarget = roadTargetTownId;
        // v9p33river542: remember junction-connect intent so the post-travel
        // modal/click takes the junction-split path (not a long road build).
        if (viaJunction) Player.state._pendingOutpostJunction = true;
        toast('⛺ Traveling to location... Outpost founding will begin on arrival.', 'info');
    }

    function foundOutpostUI(buildWithRoad, roadTargetOverride, isJunction) {
        var name = prompt('Name your outpost:');
        if (!name || name.trim() === '') return;
        var opts = { buildWithRoad: !!buildWithRoad };
        // v9p33river542: pending-junction flag survives travel-then-found
        var junctionMode = !!isJunction || !!(Player.state && Player.state._pendingOutpostJunction);
        if (Player.state && Player.state._pendingOutpostJunction) delete Player.state._pendingOutpostJunction;
        // Check for road target override (legacy junction param — no-op now)
        var targetOverride = roadTargetOverride || (Player.state._pendingOutpostRoadTarget || null);
        if (targetOverride) delete Player.state._pendingOutpostRoadTarget;
        if (junctionMode) {
            // v9p33river542: junction-connect path — base outpost cost only;
            // road cost handled by connectOutpostToRoad after outpost is founded.
            opts.buildWithRoad = false;
            opts.connectViaJunction = true;
        } else if (buildWithRoad) {
            var cfg = CONFIG.OUTPOST_CONFIG || {};
            var allTowns = Engine.getTowns ? Engine.getTowns() : [];
            var px = Player.worldX || 0, py = Player.worldY || 0;
            if (Player.townId) { var pt = Engine.findTown(Player.townId); if (pt) { px = pt.x; py = pt.y; } }

            if (targetOverride) {
                // Use the specific target town and perpendicular distance for costing
                var roadConn = Player.getNearestRoadConnection ? Player.getNearestRoadConnection(px, py, null) : null;
                var costDist;
                if (roadConn && roadConn.connectTownId === targetOverride) {
                    costDist = roadConn.perpDist;
                } else {
                    var tt = Engine.findTown(targetOverride);
                    costDist = tt ? Math.hypot(px - tt.x, py - tt.y) : 200;
                }
                var roadGold = Math.floor(100 + costDist * 0.5);
                var roadWood = Math.floor(10 + costDist * 0.1);
                var roadStone = Math.floor(8 + costDist * 0.08);
                if (Player.skills && Player.skills.cartographer) { roadGold = Math.floor(roadGold * 0.75); roadWood = Math.floor(roadWood * 0.75); roadStone = Math.floor(roadStone * 0.75); }
                opts.roadCost = { gold: roadGold, wood: roadWood, stone: roadStone };
                opts.roadTargetTownId = targetOverride;
            } else {
                // Nearest settlement approach
                var nearestSettle = null, nearDist = Infinity;
                for (var ti = 0; ti < allTowns.length; ti++) {
                    var t = allTowns[ti];
                    if (t.category === 'outpost' || t.abandoned || t.isJunction) continue;
                    var d = Math.hypot(px - t.x, py - t.y);
                    if (d < nearDist) { nearDist = d; nearestSettle = t; }
                }
                if (nearestSettle) {
                    var roadGold2 = Math.floor(100 + nearDist * 0.5);
                    var roadWood2 = Math.floor(10 + nearDist * 0.1);
                    var roadStone2 = Math.floor(8 + nearDist * 0.08);
                    if (Player.skills && Player.skills.cartographer) { roadGold2 = Math.floor(roadGold2 * 0.75); roadWood2 = Math.floor(roadWood2 * 0.75); roadStone2 = Math.floor(roadStone2 * 0.75); }
                    opts.roadCost = { gold: roadGold2, wood: roadWood2, stone: roadStone2 };
                }
            }
        }
        var result = Player.foundPlayerOutpost(name, opts);
        toast(result.message, result.success ? 'success' : 'error');
        if (result.success) openOutpostDialog();
    }

    function foundOutpostFromTravel() {
        var cfg = CONFIG.OUTPOST_CONFIG || {};
        var cost = cfg.foundingCost || 500;
        var mats = cfg.foundingMaterials || {};
        var gold = Player.gold || 0;
        var inv = Player.inventory || {};

        // Helper: build shortage text
        function _shortageText(needGold, needMats) {
            var missing = [];
            if (gold < needGold) missing.push('Need ' + needGold + 'g (have ' + Math.floor(gold) + 'g)');
            for (var sk in needMats) { if ((inv[sk] || 0) < needMats[sk]) missing.push('Need ' + needMats[sk] + ' ' + sk + ' (have ' + (inv[sk] || 0) + ')'); }
            return missing.length > 0 ? '<div style="font-size:10px;color:#c44e52;margin-top:3px">⚠️ ' + missing.join(', ') + '</div>' : '';
        }

        // Calculate road cost to nearest settlement
        var allTowns = Engine.getTowns ? Engine.getTowns() : [];
        var px = Player.worldX || 0, py = Player.worldY || 0;
        var nearestSettle = null, nearDist = Infinity;
        for (var ti = 0; ti < allTowns.length; ti++) {
            var t = allTowns[ti];
            if (t.category === 'outpost' || t.abandoned || t.isJunction) continue;
            var d = Math.hypot(px - t.x, py - t.y);
            if (d < nearDist) { nearDist = d; nearestSettle = t; }
        }
        var roadGold = nearestSettle ? Math.floor(100 + nearDist * 0.5) : 0;
        var roadWood = nearestSettle ? Math.floor(10 + nearDist * 0.1) : 0;
        var roadStone = nearestSettle ? Math.floor(8 + nearDist * 0.08) : 0;
        if (Player.skills && Player.skills.cartographer) { roadGold = Math.floor(roadGold * 0.75); roadWood = Math.floor(roadWood * 0.75); roadStone = Math.floor(roadStone * 0.75); }

        var html = '<div style="padding:8px;">';

        // ── Advantages & Risks explanation ──
        html += '<div style="border:1px solid rgba(85,168,104,0.4);background:rgba(85,168,104,0.08);padding:8px;border-radius:5px;margin-bottom:8px;">';
        html += '<div style="font-size:12px;font-weight:bold;color:#8fc98a;margin-bottom:4px;">✅ Advantages of Outposts</div>';
        html += '<ul style="margin:0;padding-left:16px;font-size:10.5px;color:#c0b888;line-height:1.5;">';
        html += '<li><b>You own all the land</b> — build freely without competing for land plots in towns</li>';
        html += '<li>Great for building when towns run out of space</li>';
        html += '<li>Full control over production, workers, and storage</li>';
        html += '<li>Can grow into a village with enough population</li>';
        html += '<li>Private storage separate from town markets</li>';
        html += '</ul></div>';

        html += '<div style="border:1px solid rgba(200,80,0,0.4);background:rgba(200,80,0,0.08);padding:8px;border-radius:5px;margin-bottom:8px;">';
        html += '<div style="font-size:12px;font-weight:bold;color:#e0a060;margin-bottom:4px;">⚠️ Risks of Outposts</div>';
        html += '<ul style="margin:0;padding-left:16px;font-size:10.5px;color:#c0b888;line-height:1.5;">';
        html += '<li><b>🦹 Bandit Raids</b> — bandits steal goods and injure workers. <i>Mitigate with walls, guards, and a watchtower.</i></li>';
        html += '<li><b>🔥 Building Fires</b> — fires damage buildings and destroy inventory. <i>A well drastically reduces fire risk. A watchtower helps too.</i></li>';
        html += '<li><b>😞 Worker Desertion</b> — workers leave if morale is low. <i>Build a tavern, chapel, food hall, and decent housing.</i></li>';
        html += '<li><b>🤒 Disease Outbreaks</b> — sickness spreads without sanitation. <i>A clinic and well nearly eliminate outbreaks.</i></li>';
        html += '<li><b>💰 Daily Maintenance</b> — ' + (cfg.dailyMaintenanceCost || 10) + 'g/day base cost + worker/guard wages</li>';
        html += '</ul></div>';

        html += '<div style="border:1px solid rgba(100,140,200,0.3);background:rgba(100,140,200,0.06);padding:6px;border-radius:5px;margin-bottom:8px;font-size:10px;color:#8ab8d8;">';
        html += '💡 <b>Tip:</b> Build a <b>well</b> first (reduces fires by 80%), then walls and guards for raid protection. ';
        html += 'A tavern and chapel keep workers happy. Upgrade housing from tents to cabins/cottages as you grow.';
        html += '</div>';

        html += '<p style="margin:0 0 8px;font-size:0.85rem;color:#aaa;">Starts with ' + (cfg.startingLandPlots || 4) + ' land plots + ' + (cfg.baseStorageCapacity || 200) + ' storage.</p>';

        // Option 1: Without road
        var canBase = gold >= cost;
        for (var bmk in mats) { if ((inv[bmk] || 0) < mats[bmk]) canBase = false; }
        html += '<div style="border:1px solid #555;padding:8px;margin:6px 0;border-radius:5px">';
        html += '<div style="font-size:12px;color:#e0d6b8">🏕️ Without Road — ' + cost + 'g + ' + _formatMats(mats) + '</div>';
        html += '<button class="btn-medieval" data-action="foundOutpostUINoRoad" style="margin-top:4px;padding:4px 14px;font-size:11px;background:rgba(74,124,59,0.3);border-color:rgba(74,124,59,0.5)' + (canBase ? '' : ';opacity:0.5') + '"' + (canBase ? '' : ' disabled') + '>⛺ Found (No Road)</button>';
        if (!canBase) html += _shortageText(cost, mats);
        html += '</div>';

        // Option 2: With road to nearest settlement
        if (nearestSettle) {
            var totalGold = cost + roadGold;
            var totalMats = {};
            for (var mk in mats) totalMats[mk] = mats[mk];
            totalMats.wood = (totalMats.wood || 0) + roadWood;
            totalMats.stone = (totalMats.stone || 0) + roadStone;
            var canWithRoad = gold >= totalGold;
            for (var rwmk in totalMats) { if ((inv[rwmk] || 0) < totalMats[rwmk]) canWithRoad = false; }
            html += '<div style="border:1px solid #555;padding:8px;margin:6px 0;border-radius:5px">';
            html += '<div style="font-size:12px;color:#e0d6b8">🛤️ With Road to ' + nearestSettle.name + ' — ' + totalGold + 'g + ' + _formatMats(totalMats) + '</div>';
            html += '<button class="btn-medieval" data-action="foundOutpostUIWithRoad" style="margin-top:4px;padding:4px 14px;font-size:11px;background:rgba(74,124,59,0.3);border-color:rgba(74,124,59,0.5)' + (canWithRoad ? '' : ';opacity:0.5') + '"' + (canWithRoad ? '' : ' disabled') + '>🛤️ Found (With Road)</button>';
            if (!canWithRoad) html += _shortageText(totalGold, totalMats);
            html += '</div>';
        }

        // Option 3: Connect to nearby road (if a road passes closer than nearest town)
        var roadConn = Player.getNearestRoadConnection ? Player.getNearestRoadConnection(px, py, null) : null;
        if (roadConn && nearestSettle && roadConn.perpDist < nearDist * 0.75) {
            var jRoadGold = Math.floor(100 + roadConn.perpDist * 0.5);
            var jRoadWood = Math.floor(10 + roadConn.perpDist * 0.1);
            var jRoadStone = Math.floor(8 + roadConn.perpDist * 0.08);
            if (Player.skills && Player.skills.cartographer) { jRoadGold = Math.floor(jRoadGold * 0.75); jRoadWood = Math.floor(jRoadWood * 0.75); jRoadStone = Math.floor(jRoadStone * 0.75); }
            var totalJGold = cost + jRoadGold;
            var totalJMats = {};
            for (var jmk in mats) totalJMats[jmk] = mats[jmk];
            totalJMats.wood = (totalJMats.wood || 0) + jRoadWood;
            totalJMats.stone = (totalJMats.stone || 0) + jRoadStone;
            var canJunction = gold >= totalJGold;
            for (var jrmk in totalJMats) { if ((inv[jrmk] || 0) < totalJMats[jrmk]) canJunction = false; }
            html += '<div style="border:1px solid #6688aa;padding:8px;margin:6px 0;border-radius:5px;background:rgba(30,40,50,0.6)">';
            html += '<div style="font-size:12px;color:#88bbdd">🔗 Connect to ' + roadConn.fromTownName + '–' + roadConn.toTownName + ' Road via new junction</div>';
            html += '<div style="font-size:11px;color:#888">Road passes ~' + roadConn.perpDist + ' away (cheaper than ' + Math.floor(nearDist) + ' to ' + nearestSettle.name + '). Total: ' + totalJGold + 'g + ' + _formatMats(totalJMats) + '</div>';
            html += '<button class="btn-medieval" data-action="foundOutpostUIConnect" data-junction="true" style="margin-top:4px;padding:4px 14px;font-size:11px;background:rgba(59,89,124,0.3);border-color:rgba(59,89,124,0.5)' + (canJunction ? '' : ';opacity:0.5') + '"' + (canJunction ? '' : ' disabled') + '>🔗 Found (Connect to Road)</button>';
            if (!canJunction) html += _shortageText(totalJGold, totalJMats);
            html += '</div>';
        }

        html += '</div>';
        var footer = '<button class="btn-medieval" data-action="closeModal" style="padding:6px 16px;">Cancel</button>';
        openModal('⛺ Found Wilderness Outpost', html, footer);
    }

    // Legacy: travelAndFoundOutpost is now handled by _foundOutpostAtLocation
    function travelAndFoundOutpost(destX, destY) {
        _foundOutpostAtLocation(destX, destY, false);
    }

    function outpostStaffUI(townId, action, type) {
        var result = Player.manageOutpostStaff(townId, action, type);
        toast(result.message, result.success ? 'success' : 'error');
        openOutpostDialog();
    }

    // ═══════════════════════════════════════════════════════════
    //  OFF-SEA TRAVEL UI
    // ═══════════════════════════════════════════════════════════

    function showOffSeaDialog(destX, destY) {
        // Show ship selection and confirmation dialog
        var ships = (Player.ships || []).filter(function(s) {
            if (s.assignedCaravanId || s.assignedOffSea) return false;
            if (Player.travelOffSea) return s.id === Player.offSeaShipId;
            // v9p33river60: if the player just boarded a docked ship, only that one is selectable.
            if (Player.embarkedShipId) return s.id === Player.embarkedShipId;
            // v9p33river312: a coastal-docked ship (one moored at a
            // landed wilderness coordinate rather than a town port) has
            // townId === null. Don't filter it out — show it if the
            // player is standing at its docked coordinate.
            if (s.townId == null && s.dockX != null && s.dockY != null) {
                var _px = Player.worldX, _py = Player.worldY;
                if (_px != null && _py != null) {
                    var _dx = (_px - s.dockX), _dy = (_py - s.dockY);
                    if ((_dx*_dx + _dy*_dy) < 25) return true; // within ~5 tile radius
                }
            }
            return s.townId === Player.townId;
        });

        if (Player.travelOffSea) {
            // Already sailing — just redirect
            var result = Player.startOffSeaTravel(destX, destY);
            if (result.success) {
                toast(result.message || '⛵ Redirecting course!', 'success');
                if (typeof Engine.resume === 'function') Engine.resume();
            } else {
                toast(result.message, 'error');
            }
            return;
        }

        if (ships.length === 0) {
            toast('No available ships at this port.', 'error');
            return;
        }

        var html = '<div style="padding:8px">';
        html += '<p style="margin:0 0 10px;color:#aaa;font-size:12px">⛵ Sail into open waters. Off route sea travel is 50% speed of sea routes with increased pirate risk.</p>';

        for (var i = 0; i < ships.length; i++) {
            var s = ships[i];
            var st = CONFIG.SHIP_TYPES[s.type] || {};
            var hull = s.hullHealth != null ? s.hullHealth : 100;
            var hullColor = hull > 70 ? '#55a868' : hull > 30 ? '#ccaa33' : '#c44e52';
            html += '<div style="border:1px solid #555;padding:8px;margin:4px 0;border-radius:5px;background:rgba(30,30,30,0.8);cursor:pointer" data-action="_confirmOffSea" data-x="' + destX + '" data-y="' + destY + '" data-id="' + s.id + '">';
            html += '<div style="display:flex;justify-content:space-between;align-items:center">';
            html += '<span style="font-size:13px">' + (st.icon || '⛵') + ' ' + (s.name || st.name) + '</span>';
            html += '<span style="font-size:11px;color:' + hullColor + '">Hull: ' + hull + '%</span>';
            html += '</div>';
            html += '<div style="font-size:11px;color:#888;margin-top:3px">';
            html += 'Speed: ' + ((st.speed || 1.0) * 100).toFixed(0) + '% | Capacity: ' + (st.capacity || 0) + ' | Defense: ' + (st.defense || 0);
            html += '</div>';
            html += '</div>';
        }
        html += '</div>';

        var footer = '<button class="btn-medieval" data-action="closeModal" style="padding:6px 15px;">Cancel</button>';
        openModal('⛵ Off Route Sea Travel — Select Ship', html, footer);
    }

    function _confirmOffSea(destX, destY, shipId) {
        closeModal();
        var result = Player.startOffSeaTravel(destX, destY, shipId);
        if (result.success) {
            toast(result.message || '⛵ Setting sail!', 'success');
        } else {
            toast(result.message, 'error');
        }
    }

    function showLandingDialog(destX, destY) {
        var info = Player.attemptLanding(destX, destY);
        if (!info.success) {
            toast(info.message, 'error');
            return;
        }

        var terrainNames = { 0: 'Grassland', 1: 'Forest', 2: 'Water', 3: 'Mountain', 4: 'Hills', 5: 'Sandy Beach' };
        var terrainName = terrainNames[info.terrain] || 'Unknown';
        var successPct = Math.floor(info.successChance * 100);
        var riskPct = Math.floor(info.risk * 100);
        var successColor = successPct >= 80 ? '#55a868' : successPct >= 50 ? '#ccaa33' : '#c44e52';

        var html = '<div style="padding:8px;text-align:center">';
        html += '<div style="font-size:2em;margin-bottom:8px">⚓</div>';
        html += '<p style="margin:0 0 8px;font-size:14px">Terrain: <strong>' + terrainName + '</strong></p>';
        html += '<p style="margin:0 0 12px;font-size:24px;color:' + successColor + '">' + successPct + '% Success</p>';

        if (info.skillBonus > 0) html += '<p style="font-size:11px;color:#55a868;margin:2px 0">Skills: +' + Math.floor(info.skillBonus * 100) + '% bonus</p>';
        if (info.condPenalty > 0) html += '<p style="font-size:11px;color:#c44e52;margin:2px 0">Ship condition: -' + Math.floor(info.condPenalty * 100) + '% penalty</p>';
        if (riskPct > 0) html += '<p style="font-size:11px;color:#c44e52;margin:2px 0">Failure: ship takes ' + (CONFIG.OFFSEA_LANDING_DAMAGE_MIN || 10) + '-' + (CONFIG.OFFSEA_LANDING_DAMAGE_MAX || 30) + '% hull damage</p>';

        html += '</div>';

        var footer = '<button class="btn-medieval" data-action="_executeLanding" data-x="' + destX + '" data-y="' + destY + '" style="background:rgba(42,100,150,0.4);border-color:rgba(42,100,150,0.6);padding:6px 16px;">⚓ Attempt Landing (' + successPct + '%)</button> ';
        footer += '<button class="btn-medieval" data-action="closeModal" style="padding:6px 16px;">Cancel</button>';
        openModal('⚓ Attempt Landing', html, footer);
    }

    function _executeLanding(destX, destY) {
        closeModal();
        var result = Player.executeLanding(destX, destY);
        if (!result.success) {
            toast(result.message, 'error');
            return;
        }

        if (result.landed) {
            toast(result.message, 'success');
        } else if (result.died) {
            // Show death screen
            var html = '<div style="text-align:center;padding:20px">';
            html += '<div style="font-size:3em;margin-bottom:10px">💀</div>';
            html += '<h3 style="color:#c44e52">SHIPWRECK</h3>';
            html += '<p>Your ship was destroyed. You did not survive.</p>';
            html += '</div>';
            openModal('💀 Death at Sea', html, '<button class="btn-medieval" data-action="closeModal">Continue</button>');
        } else if (result.washedAshore) {
            var html2 = '<div style="text-align:center;padding:15px">';
            html2 += '<div style="font-size:3em;margin-bottom:10px">🌊</div>';
            html2 += '<h3 style="color:#ccaa33">SHIPWRECKED!</h3>';
            html2 += '<p>You washed ashore, barely alive.</p>';
            html2 += '<div style="text-align:left;margin:10px auto;max-width:300px;font-size:12px">';
            html2 += '<p>🤒 Shipwreck Exposure illness (' + result.illnessDays + ' days)</p>';
            html2 += '<p>💰 Gold lost: ' + result.goldLost + 'g</p>';
            html2 += '<p>📦 Most inventory lost</p>';
            html2 += '</div>';
            html2 += '</div>';
            openModal('🌊 Shipwreck!', html2, '<button class="btn-medieval" data-action="closeModal">Continue</button>');
        } else {
            toast(result.message, 'warning');
        }
    }
    let _skillBranch = 'commerce';

    function openSkillsDialog(branch) {
        if (branch && typeof branch === 'string') _skillBranch = branch;

        const sp = Player.skillPoints || 0;
        const playerSkills = Player.skills || {};

        // Build skill ability definitions — toggle features unlocked by skills
        var _abilities = [];
        if (playerSkills['regional_survey']) _abilities.push({ id: 'deposits', icon: '⛏️', name: 'Resource Deposits', desc: 'Show resource deposit icons scattered around towns on the map.' + (playerSkills['world_survey'] ? ' (World Survey: shows ALL towns)<br>💡 Right-click anywhere on the map to survey deposits in that area.' : ' (Your kingdom only)'), skill: 'Regional Survey', toggle: "Renderer.toggleDeposits()", isOn: typeof Renderer !== 'undefined' && Renderer.isDepositsOn && Renderer.isDepositsOn() });
        if (playerSkills['soil_knowledge']) _abilities.push({ id: 'fertility', icon: '🌾', name: 'Soil Fertility', desc: 'Show soil fertility colored regions and ratings around all towns.<br>💡 Right-click anywhere on the map to check fertility in that area.', skill: 'Soil Knowledge', toggle: "Renderer.toggleFertility()", isOn: typeof Renderer !== 'undefined' && Renderer.isFertilityOn && Renderer.isFertilityOn() });
        if (playerSkills['street_ears']) _abilities.push({ id: 'street_ears', icon: '👂', name: 'Street Ears', desc: 'Overhear local gossip — 25% chance to receive NPC activity notifications (merchant asset moves, kingdom finances, local happenings). Talk to townsfolk for full gossip.', skill: 'Street Ears', toggle: "Player.toggleStreetEars()", isOn: Player.state && Player.state._streetEarsActive });

        let tabsHtml = '';
        for (const [branchId, info] of Object.entries(SKILL_BRANCHES)) {
            const active = branchId === _skillBranch ? 'active' : '';
            const branchSkills = Object.keys(SKILLS).filter(id => SKILLS[id].branch === branchId);
            const unlocked = branchSkills.filter(id => playerSkills[id]).length;
            tabsHtml += `<button class="skill-tab ${active}" data-action="openSkillsDialog" data-id="${branchId}" style="border-bottom:3px solid ${active ? info.color : 'transparent'}">
                ${info.icon} ${info.name} <span class="skill-tab-count">${unlocked}/${branchSkills.length}</span>
            </button>`;
        }
        // Add Abilities tab if any abilities unlocked
        if (_abilities.length > 0) {
            var _abActive = _skillBranch === '_abilities' ? 'active' : '';
            tabsHtml += '<button class="skill-tab ' + _abActive + '" data-action="openSkillsDialog" data-id="_abilities" style="border-bottom:3px solid ' + (_abActive ? '#9b59b6' : 'transparent') + '">⚡ Abilities</button>';
        }

        var contentHtml = '';
        if (_skillBranch === '_abilities') {
            // Show toggle abilities
            contentHtml += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px;padding:8px 0;">';
            for (var _ai = 0; _ai < _abilities.length; _ai++) {
                var _ab = _abilities[_ai];
                var _abOn = _ab.isOn;
                var _abBorder = _abOn ? '1px solid #55a868' : '1px solid #555';
                var _abBg = _abOn ? 'rgba(85,168,104,0.12)' : 'rgba(255,255,255,0.03)';
                var _abStatusText = _abOn ? '<span style="color:#55a868;font-weight:bold;">● ON</span>' : '<span style="color:#888;">○ OFF</span>';
                var _abBtnClass = _abOn ? 'sell' : 'buy';
                var _abBtnText = _abOn ? '🔴 Turn Off' : '🟢 Turn On';
                contentHtml += '<div style="background:' + _abBg + ';border:' + _abBorder + ';border-radius:6px;padding:12px;">';
                contentHtml += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">';
                contentHtml += '<span style="font-size:0.9rem;font-weight:bold;">' + _ab.icon + ' ' + _ab.name + '</span>';
                contentHtml += _abStatusText;
                contentHtml += '</div>';
                contentHtml += '<div style="font-size:0.72rem;color:#aaa;margin-bottom:8px;">' + _ab.desc + '</div>';
                contentHtml += '<div style="font-size:0.68rem;color:#777;margin-bottom:8px;">Skill: ' + _ab.skill + '</div>';
                contentHtml += '<button class="btn-trade ' + _abBtnClass + '" style="font-size:0.78rem;padding:4px 16px;width:100%;" data-action="toggleAbilityAndRefresh" data-toggle="' + _ab.toggle.replace(/"/g, '&quot;') + '">' + _abBtnText + '</button>';
                contentHtml += '</div>';
            }
            contentHtml += '</div>';
        } else {
            // Normal branch skill grid
            const branchSkills = [];
            for (const id in SKILLS) {
                if (SKILLS[id].branch === _skillBranch) {
                    branchSkills.push({ id, ...SKILLS[id] });
                }
            }

            let skillsHtml = '<div class="skill-grid">';
            for (const skill of branchSkills) {
                const isUnlocked = playerSkills[skill.id];
                const canUnlock = Player.canUnlockSkill ? Player.canUnlockSkill(skill.id) : false;
                const reqsMet = skill.requires.every(r => playerSkills[r]);
                const costAffordable = sp >= skill.cost;
                const isRepeatable = !!skill.repeatable;
                // v9p33river351: any skill that has accumulated _skillProgress
                // is being learned through labor.
                var _workProgress = (Player.state && Player.state._skillProgress && Player.state._skillProgress[skill.id]) || 0;
                var _workTarget = (typeof CONFIG !== 'undefined' && CONFIG.WORK_EARNED_SKILL_SHIFTS) ? CONFIG.WORK_EARNED_SKILL_SHIFTS : 30;
                var _hasWorkProgress = _workProgress > 0 && !isUnlocked;

                let stateClass = 'skill-locked';
                let stateLabel = '🔒';
                if (isUnlocked && !isRepeatable) {
                    stateClass = 'skill-unlocked';
                    stateLabel = '✅';
                } else if (isUnlocked && isRepeatable) {
                    stateClass = 'skill-unlocked';
                    stateLabel = '🔄';
                } else if (canUnlock) {
                    stateClass = 'skill-available';
                    stateLabel = '';
                } else if (_hasWorkProgress) {
                    stateLabel = '🛠️';
                }

                // Show dynasty bank info for dynasty_founder
                let extraInfo = '';
                if (skill.id === 'dynasty_founder' && Player.dynastySPBank > 0) {
                    extraInfo = '<div style="font-size:0.72rem;color:#ffd700;margin-top:2px;">🏰 Bank: ' + Player.dynastySPBank + ' SP</div>';
                }
                // v9p33river351: show work-progress meter for any partially
                // earned-by-work skill.
                if (_hasWorkProgress) {
                    var _pct = Math.min(100, Math.round((_workProgress / _workTarget) * 100));
                    extraInfo += '<div style="font-size:0.72rem;color:#88c8ff;margin-top:2px;">🛠️ Learning by work: ' + _workProgress + '/' + _workTarget + ' shifts (' + _pct + '%)</div>';
                }

                const reqNames = skill.requires.map(r => SKILLS[r] ? SKILLS[r].name : r).join(', ');
                const missingReqs = skill.requires.filter(r => !playerSkills[r]);
                let reqHtml = '';
                if (skill.requires.length > 0) {
                    reqHtml = '<div class="skill-requires">Requires: ' + reqNames;
                    if (!isUnlocked && missingReqs.length > 0) {
                        for (const mr of missingReqs) {
                            const mrSkill = SKILLS[mr];
                            if (mrSkill && sp >= mrSkill.cost) {
                                reqHtml += ` <button class="btn-trade buy" style="font-size:0.65rem;padding:1px 6px;margin-left:4px;" data-action="learnSkill" data-id="${mr}">Learn ${mrSkill.name} (${mrSkill.cost} SP)</button>`;
                            }
                        }
                    }
                    reqHtml += '</div>';
                }

                skillsHtml += `<div class="skill-node ${stateClass}" title="${skill.desc}">
                    <div class="skill-icon">${skill.icon}</div>
                    <div class="skill-name">${skill.name} ${stateLabel}</div>
                    <div class="skill-cost">${skill.cost > 0 ? skill.cost + ' SP' : 'FREE'}${isRepeatable ? ' (repeatable)' : ''}</div>
                    <div class="skill-desc">${skill.desc}</div>
                    ${extraInfo}
                    ${reqHtml}
                    ${(!isUnlocked || isRepeatable) && canUnlock ? `<button class="btn-trade buy skill-learn-btn" data-action="learnSkill" data-id="${skill.id}">${isRepeatable && isUnlocked ? 'Invest Again' : 'Learn'}</button>` : ''}
                </div>`;
            }
            skillsHtml += '</div>';
            contentHtml = skillsHtml;
        }

        const html = `
            <div class="skill-header">
                <span class="skill-sp-display">📚 Skill Points: <strong>${sp}</strong></span>
                ${Player.dynastySPBank > 0 ? '<span style="color:#ffd700;font-size:0.8rem;margin-left:8px;">🏰 Dynasty Bank: ' + Player.dynastySPBank + ' SP</span>' : ''}
                <span class="skill-level-display">Level ${Player.level || 1} ${Player.getMerchantTitle ? Player.getMerchantTitle() : ''}</span>
            </div>
            <div class="skill-tabs">${tabsHtml}</div>
            ${contentHtml}
        `;

        openModal('📚 Skills', html);
    }

    function learnSkill(skillId) {
        if (typeof Player !== 'undefined' && Player.unlockSkill) {
            const success = Player.unlockSkill(skillId);
            if (success) {
                // Special toast for skills with toggle abilities
                var _abilitySkills = ['regional_survey', 'world_survey', 'soil_knowledge'];
                if (_abilitySkills.indexOf(skillId) >= 0) {
                    toast('Skill learned! Toggle it in the ⚡ Abilities tab.', 'success');
                }
                openSkillsDialog(_skillBranch);
            } else {
                toast('Cannot learn this skill.', 'warning');
            }
        }
    }
    // ─── Exports ─────────────────────────────────────────────
    // Outpost Management
    UI.openOutpostDialog = openOutpostDialog;
    UI.openOutpostDetail = openOutpostDetail;
    UI.foundOutpostUI = foundOutpostUI;
    UI.foundOutpostFromTravel = foundOutpostFromTravel;
    UI.travelAndFoundOutpost = travelAndFoundOutpost;
    UI.outpostStaffUI = outpostStaffUI;
    UI.enterOutpostPlacement = enterOutpostPlacement;
    UI.confirmOutpostPlacement = confirmOutpostPlacement;
    UI._opStaff = _opStaff;
    UI._opAssignWorker = _opAssignWorker;
    UI._opUpgradeWalls = _opUpgradeWalls;
    UI._opBuildDocks = _opBuildDocks;
    UI._opBuildRoad = _opBuildRoad;
    UI._opBuildSeaRoute = _opBuildSeaRoute;
    UI._opConnectToRoad = _opConnectToRoad;
    UI._opBuyLand = _opBuyLand;
    UI._opBuildHousing = _opBuildHousing;
    UI._opBuildUpgrade = _opBuildUpgrade;
    UI._opPetitionVillage = _opPetitionVillage;
    UI._opOutpostDeposit = _opOutpostDeposit;
    UI._opOutpostWithdraw = _opOutpostWithdraw;
    UI._foundOutpostAtLocation = _foundOutpostAtLocation;
    UI.openRecruitToOutpostDialog = openRecruitToOutpostDialog;
    UI._closeRecruitAndRestore = _closeRecruitAndRestore;
    UI._doRecruitNpc = _doRecruitNpc;
    // Off-Sea Travel
    UI.showOffSeaDialog = showOffSeaDialog;
    UI._confirmOffSea = _confirmOffSea;
    UI.showLandingDialog = showLandingDialog;
    UI._executeLanding = _executeLanding;
    // v9p33river60: re-board a previously-docked ship
    UI.boardDockedShipUI = function(shipId) {
        var result = Player.boardDockedShip(shipId);
        if (result.success) {
            toast(result.message, 'success');
        } else {
            toast(result.message, 'error');
        }
    };
    // v9p33river63/64: stash a pending board action on the player, then start
    // offroad travel to the ship's coords. On arrival, tickTravel auto-boards.
    UI.travelToDockedShip = function(shipId) {
        var ship = (Player.ships || []).find(function(s) { return s.id === shipId; });
        if (!ship || !ship.dockedCoords) {
            toast('Ship is not docked on the coast.', 'error');
            return;
        }
        // Clear any stale pending flag from a prior aborted attempt.
        if (Player.state) Player.state._pendingShipBoardId = null;
        // Start offroad travel directly (no extra confirm modal — the right-click
        // menu was the confirmation). Only set the pending flag if travel succeeds.
        var res = Player.travelToCoords(ship.dockedCoords.x, ship.dockedCoords.y);
        if (!res || !res.success) {
            toast(res && res.message ? res.message : 'Cannot travel to ship.', 'error');
            return;
        }
        if (Player.state) Player.state._pendingShipBoardId = shipId;
        toast('🥾 Traveling to ' + (ship.name || ship.type) + '. You will board on arrival.', 'info');
    };
    // Skills
    UI.openSkillsDialog = openSkillsDialog;
    UI.learnSkill = learnSkill;


    // ── Delegated action handlers (data-action) ──
    UI.registerAction('_opOutpostWithdraw', function(_t, d) { UI._opOutpostWithdraw(d.id, d.val, Number(d.qty)); });
    UI.registerAction('_opOutpostDeposit', function(_t, d) { UI._opOutpostDeposit(d.id, d.val, Number(d.qty)); });
    UI.registerAction('_foundOutpostAtLocation', function(_t, d) { UI._foundOutpostAtLocation(Number(d.x), Number(d.y), d.road === 'true', d.connect || undefined, d.junction === 'true'); });
    UI.registerAction('foundOutpostUINoRoad', function() { UI.foundOutpostUI(false); });
    UI.registerAction('foundOutpostUIWithRoad', function() { UI.foundOutpostUI(true); });
    UI.registerAction('foundOutpostUIConnect', function(_t, d) { UI.foundOutpostUI(true, d.id, d.junction === 'true'); });
    UI.registerAction('_confirmOffSea', function(_t, d) { UI._confirmOffSea(Number(d.x), Number(d.y), d.id); });
    UI.registerAction('_executeLanding', function(_t, d) { UI._executeLanding(Number(d.x), Number(d.y)); });
    UI.registerAction('toggleAbilityAndRefresh', function(_t, d) { (new Function(d.toggle.replace(/&quot;/g, '"')))(); UI.openSkillsDialog('_abilities'); });
    UI.registerAction('openSkillsDialog', function(_t, d) { UI.openSkillsDialog(d.id); });
    UI.registerAction('_opStaff', function(_t, d) { UI._opStaff(d.id, d.val, d.type); });
    UI.registerAction('_opBuildHousing', function(_t, d) { UI._opBuildHousing(d.id, d.val); });
    UI.registerAction('_opBuyLand', function(_t, d) { UI._opBuyLand(d.id); });
    UI.registerAction('_opBuildUpgrade', function(_t, d) { UI._opBuildUpgrade(d.id, d.val); });
    UI.registerAction('_opUpgradeWalls', function(_t, d) { UI._opUpgradeWalls(d.id); });
    UI.registerAction('_opBuildDocks', function(_t, d) { UI._opBuildDocks(d.id); });
    UI.registerAction('_opBuildRoad', function(_t, d) { UI._opBuildRoad(d.id, d.val); });
    UI.registerAction('_opConnectToRoad', function(_t, d) { UI._opConnectToRoad(d.id); });
    UI.registerAction('_opBuildSeaRoute', function(_t, d) { UI._opBuildSeaRoute(d.id, d.val); });
    UI.registerAction('openRecruitToOutpostDialog', function(_t, d) { UI.openRecruitToOutpostDialog(d.id, d.val); });
    UI.registerAction('_opPetitionVillage', function(_t, d) { UI._opPetitionVillage(d.id); });
    UI.registerAction('_doRecruitNpc', function(_t, d) { UI._doRecruitNpc(d.id, d.val); });
    UI.registerAction('openOutpostDetail', function(_t, d) { UI.openOutpostDetail(d.id); });
    UI.registerAction('learnSkill', function(_t, d) { UI.learnSkill(d.id); });

    // Simple passthrough handlers
    UI.registerAction('enterOutpostPlacement', function() { UI.enterOutpostPlacement(); });
    UI.registerAction('_closeRecruitAndRestore', function() { UI._closeRecruitAndRestore(); });
    UI.registerAction('foundOutpostFromTravel', function() { foundOutpostFromTravel(); });

})(window.UI);