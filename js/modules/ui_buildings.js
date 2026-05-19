// ============================================================
// Merchant Realms — UI Buildings Module (extracted from ui.js)
// Extends window.UI with Building/Construction functions
// ============================================================
(function(UI) {
    "use strict";
    if (!UI) throw new Error("UI must be loaded before ui_buildings.js");

    // Aliases for UI utilities
    var openModal = UI.openModal;
    var closeModal = UI.closeModal;
    var toast = UI.toast;
    var formatGold = UI.formatGold;
    var escapeHtml = UI.escapeHtml;
    var findResource = UI.findResource;
    var findBuildingType = UI.findBuildingType;

    // ── BUILD DIALOG ──

    function openBuildDialog() {
        if (typeof Player === 'undefined' || Player.townId == null) {
            toast('You must be in a town to build.', 'warning');
            return;
        }

        let town;
        try { town = Engine.getTown(Player.townId); } catch (e) { /* no-op */ }
        if (!town) {
            const towns = Engine.getTowns();
            town = towns ? towns.find(t => t.id === Player.townId) : null;
        }

        const categories = ['farm', 'mine', 'harvest', 'processing', 'finished', 'retail', 'medical', 'military', 'luxury', 'storage', 'trade'];
        const catNames = { farm: '🌾 Farms', mine: '⛏ Mines', harvest: '🪓 Harvest', processing: '⚙ Processing',
                           finished: '🏭 Finished', retail: '🏪 Retail', medical: '🏥 Medical', military: '⚔ Military', luxury: '👗 Luxury', storage: '📦 Storage', trade: '🏪 Trade', port: '⚓ Port' };

        let catHtml = '';
        for (const cat of categories) {
            catHtml += `<button class="btn-category" data-cat="${cat}" data-action="filterBuildings" data-id="${cat}">${catNames[cat] || cat}</button>`;
        }

        let gridHtml = '';
        for (const [key, bt] of Object.entries(BUILDING_TYPES)) {
            // Calculate dynamic material cost from local market
            var matCost = 0;
            var matsOk = true;
            var matDetails = [];
            if (bt.materials && town) {
                for (var matId in bt.materials) {
                    var qty = bt.materials[matId];
                    var pHas = (Player.inventory && Player.inventory[matId]) || 0;
                    var mHas = (town.market && town.market.supply[matId]) || 0;
                    if (pHas + mHas < qty) matsOk = false;
                    var needBuy = Math.max(0, qty - pHas);
                    var mp = 0;
                    if (needBuy > 0) {
                        try { mp = Engine.getMarketPrice(town.id, matId) || 0; } catch(e2) {}
                        if (mp <= 0) { var r2 = findResource(matId); mp = r2 ? (r2.basePrice || 5) : 5; }
                        matCost += needBuy * mp;
                    }
                    var matRes = findResource(matId);
                    matDetails.push({ id: matId, name: matRes ? matRes.name : matId, icon: matRes ? (matRes.icon || '') : '', qty: qty, have: Math.min(pHas, qty), toBuy: needBuy, price: mp, inMarket: mHas });
                }
            }
            var laborCost = bt.cost || 0;
            var totalBuildCost = laborCost + matCost;
            const canAfford = (Player.gold || 0) >= totalBuildCost && matsOk;

            // Deposit requirement check
            const depReq = CONFIG.DEPOSIT_REQUIREMENTS ? CONFIG.DEPOSIT_REQUIREMENTS[bt.id] : null;
            var hasDeposit = true;
            if (depReq && town && town.naturalDeposits) {
                hasDeposit = (town.naturalDeposits[depReq.deposit] || 0) > 0;
            } else if (depReq && town && !town.naturalDeposits) {
                hasDeposit = false;
            }

            // Consumes string — show deposit if applicable, otherwise show input goods
            var consumesStr;
            if (depReq) {
                consumesStr = '⛰️ ' + depReq.label;
            } else {
                consumesStr = Object.entries(bt.consumes || {}).map(([r, q]) => {
                    const res = findResource(r);
                    return `${res ? res.icon : ''} ${res ? res.name : r} ×${q}`;
                }).join(', ') || 'None';
            }

            // Produces string — special case for tree_plantation
            const producesRes = bt.produces ? findResource(bt.produces) : null;
            var producesStr;
            if (bt.id === 'tree_plantation') {
                producesStr = '🌲 Trees (Wood Deposit)';
            } else {
                var _hasConsumes = bt.consumes && Object.keys(bt.consumes).length > 0;
                var _storageAmt = bt.storage;
                var _storageLabel = 'storage';
                if (_storageAmt && !_hasConsumes && bt.category !== 'storage') {
                    _storageAmt = Math.floor(_storageAmt / 2);
                    _storageLabel = 'building extra storage';
                }
                producesStr = producesRes ? `${producesRes.icon} ${producesRes.name}` : (_storageAmt ? `📦 +${_storageAmt} ${_storageLabel}` : bt.salesBonus ? `📈 +${Math.round(bt.salesBonus * 100)}% sales` : bt.livestockCapacity ? `🐄 Holds ${bt.livestockCapacity} livestock` : bt.archerBonus ? `🏹 Archer +${Math.round(bt.archerBonus * 100)}%` : '—');
            }

            // Material requirements string with auto-buy details
            let materialsStr = '';
            if (matDetails.length > 0) {
                materialsStr = matDetails.map(function(m) {
                    var clr = m.have >= m.qty ? '#55a868' : (m.have + m.inMarket >= m.qty ? '#ffd700' : '#c44e52');
                    var s = m.icon + ' ' + m.name + ' <span style="color:' + clr + ';">' + m.have + '/' + m.qty + '</span>';
                    if (m.toBuy > 0 && m.inMarket >= m.toBuy) {
                        s += ' <span style="font-size:0.65rem;color:#ffd700;">(auto-buy ' + m.toBuy + ' @ ' + m.price + 'g)</span>';
                    } else if (m.toBuy > 0) {
                        s += ' <span style="font-size:0.65rem;color:#c44e52;">(need ' + m.toBuy + ', market has ' + m.inMarket + ')</span>';
                    }
                    return s;
                }).join(', ');
            }

            // Deposit warning string
            var depositWarning = '';
            if (depReq && !hasDeposit) {
                depositWarning = `<br><span style="color:#c44e52;">⛔ No ${depReq.label.toLowerCase()} here</span>`;
            }

            // Guild monopoly warning
            var guildWarning = '';
            if (town && (bt.category === 'processing' || bt.category === 'finished' || bt.category === 'military')) {
                var _gmKingdom = null;
                try { _gmKingdom = Engine.findKingdom(town.kingdomId); } catch(e) {}
                if (_gmKingdom && _gmKingdom.laws && _gmKingdom.laws.specialLaws) {
                    var _hasGM = _gmKingdom.laws.specialLaws.some(function(sl) { return sl.id === 'guild_monopoly' || sl.effect === 'build_rank_3'; });
                    if (_hasGM) {
                        var _gmRank = (Player.socialRank && Player.socialRank[_gmKingdom.id]) || 0;
                        var _gmGuild = null;
                        if (CONFIG.GUILDS) {
                            for (var _gk in CONFIG.GUILDS) {
                                if (CONFIG.GUILDS[_gk].categories && CONFIG.GUILDS[_gk].categories.indexOf(bt.category) >= 0) { _gmGuild = CONFIG.GUILDS[_gk]; break; }
                            }
                        }
                        var _gmInGuild = _gmGuild && Player.isGuildMember && Player.isGuildMember(_gmGuild.id);
                        if (_gmRank >= 3) {
                            guildWarning = '<br><span style="font-size:0.68rem;color:#55a868;">✅ Guildmaster rank exempts you from guild requirement</span>';
                        } else if (_gmInGuild) {
                            guildWarning = '<br><span style="font-size:0.68rem;color:#55a868;">✅ ' + _gmGuild.icon + ' ' + _gmGuild.name + ' member</span>';
                        } else {
                            guildWarning = '<br><span style="font-size:0.68rem;color:#ff9f43;">⚠️ Requires ' + (_gmGuild ? _gmGuild.icon + ' ' + _gmGuild.name + ' membership' : 'guild membership') + ' or Guildmaster rank</span>';
                        }
                    }
                }
            }

            gridHtml += `<div class="build-card ${canAfford && hasDeposit ? '' : 'cant-afford'}" data-category="${bt.category}" data-action="executeBuild" data-id="${bt.id}" data-val="${town ? town.id : ''}">
                <div class="build-name">${bt.name}</div>
                <div class="build-cost">🪙 ${Math.ceil(totalBuildCost)}g (labor: ${Math.ceil(laborCost)}g${matCost > 0 ? ' + materials: ' + Math.ceil(matCost) + 'g' : ''}) | 👥 ${bt.workers} workers</div>
                <div class="build-info">Produces: ${producesStr}<br>Consumes: ${consumesStr}<br>Rate: ${bt.rate}/day${materialsStr ? '<br>🔨 Materials: ' + materialsStr : ''}${!matsOk ? '<br><span style="color:#c44e52;">⚠ Not enough materials in inventory + market!</span>' : (matCost > 0 ? '<br><span style="font-size:0.68rem;color:#ffd700;">🛒 Will auto-buy missing materials from market (' + Math.ceil(matCost) + 'g)</span>' : '')}${depositWarning}${guildWarning}</div>
            </div>`;
        }

        // Pointer to Town Market for buying existing buildings
        let saleHtml = '';
        if (town) {
            const offers = Engine.getNPCBuildingSaleOffers(town.id);
            if (offers.length > 0) {
                saleHtml += '<div style="margin-top:12px;padding:8px;border:1px solid var(--border);border-radius:4px;text-align:center;">';
                saleHtml += '<div style="font-size:0.8rem;color:#aaa;margin-bottom:4px;">' + offers.length + ' existing building(s) for sale in this town</div>';
                saleHtml += '<button class="btn-medieval" data-action="openTownMarket" style="font-size:0.75rem;padding:3px 10px;">🏗️ Browse Town Buildings</button>';
                saleHtml += '</div>';
            }

            // Player-owned farm/livestock: conversion option
            var playerBlds = (Player.buildings || []).filter(function(b) { return b.townId === town.id; });
            var farmBlds = playerBlds.filter(function(b) {
                return (typeof Engine !== 'undefined') && (Engine.isCropFarm(b.type) || Engine.isLivestockFarm(b.type));
            });
            if (farmBlds.length > 0) {
                saleHtml += '<div style="margin-top:12px;padding:8px;border:1px solid rgba(120,160,80,0.4);border-radius:4px;background:rgba(60,80,40,0.1);">';
                saleHtml += '<div style="font-weight:bold;font-size:0.85rem;margin-bottom:6px;">🔄 CONVERT FARM / LIVESTOCK</div>';
                saleHtml += '<div style="font-size:0.75rem;color:#b0a080;margin-bottom:6px;">Crop farms: 1 free conversion/year, then ¼ cost. Livestock: 2/year at half cost.</div>';
                for (let fi = 0; fi < farmBlds.length; fi++) {
                    var fBld = farmBlds[fi];
                    var fBt = Engine.findBuildingType(fBld.type);
                    var fBldName = fBt ? fBt.name : fBld.type;
                    var fBldIdx = town.buildings.findIndex(function(tb) { return tb.ownerId === 'player' && tb.type === fBld.type; });
                    if (fBldIdx < 0) continue;
                    saleHtml += '<div class="build-card" style="display:flex;flex-direction:column;gap:4px;">';
                    saleHtml += '<div class="build-name">' + fBldName + '</div>';
                    saleHtml += '<button class="btn-medieval" style="font-size:0.7rem;padding:3px 8px;background:rgba(80,120,50,0.15);border-color:rgba(80,120,50,0.4);" data-action="openFarmConvertUI" data-idx="' + fBldIdx + '" data-id="' + town.id + '">🔄 Convert Type</button>';
                    saleHtml += '</div>';
                }
                saleHtml += '</div>';
            }

        }

        // v9p33river189: Land + categories anchored at top so they stay
        // visible while scrolling the build grid. Player gold shown to the
        // left of the land plots panel for at-a-glance affordability.
        let landHtml = '';
        let goldHtml = '';
        if (town) {
            const ownedLand = Player.getOwnedLand ? Player.getOwnedLand(town.id) : 0;
            const playerTownCat = town.category || 'village';
            const maxPlots = (CONFIG.LAND_PLOTS_BASE && CONFIG.LAND_PLOTS_BASE[playerTownCat]) || 5;
            const landCost = Player.getLandCost ? Player.getLandCost(town.id) : CONFIG.LAND_COST_BASE;
            const usedLand = Player.getUsedLandSlots ? Player.getUsedLandSlots(town.id) : 0;
            const freeLand = Math.max(0, ownedLand - usedLand);
            const playerGold = Math.floor(Player.gold || 0);
            goldHtml += '<div style="padding:8px 12px;border:1px solid var(--border);border-radius:4px;background:rgba(60,50,30,0.15);min-width:120px;display:flex;flex-direction:column;justify-content:center;align-items:center;">';
            goldHtml += '<div style="font-weight:bold;font-size:0.8rem;color:#d4af37;margin-bottom:4px;">🪙 Your Gold</div>';
            goldHtml += '<div style="font-size:1.05rem;color:#ffd700;font-weight:bold;">' + playerGold + 'g</div>';
            goldHtml += '</div>';
            landHtml += '<div style="padding:8px;border:1px solid var(--border);border-radius:4px;background:rgba(60,50,30,0.15);flex:1;">';
            landHtml += '<div style="font-weight:bold;font-size:0.85rem;margin-bottom:4px;">🏞️ Land Plots</div>';
            landHtml += '<div style="font-size:0.8rem;color:#ccc;margin-bottom:6px;">Owned: ' + ownedLand + ' (' + freeLand + ' free, ' + usedLand + ' used) | Max: ' + maxPlots + '</div>';
            if (ownedLand < maxPlots) {
                landHtml += '<button class="btn-medieval" data-action="buyLandUI" style="font-size:0.8rem;padding:4px 12px;">🏗️ Buy Land (' + landCost + 'g)</button>';
            } else {
                landHtml += '<div style="font-size:0.75rem;color:#888;">Maximum land plots reached.</div>';
            }
            landHtml += '</div>';
        }

        const html = `<div class="trade-sticky-header" style="display:flex;flex-direction:column;gap:8px;">
                <div style="display:flex;gap:8px;align-items:stretch;">${goldHtml}${landHtml}</div>
                <div class="build-categories" style="margin:0;">${catHtml}</div>
            </div>
            <div class="build-grid" id="buildGrid">${gridHtml}</div>${saleHtml}`;

        openModal(`🏗️ Build — ${town ? town.name : ''}`, html);
        // Auto-select first category
        setTimeout(() => filterBuildings('farm'), 0);
    }

    function filterBuildings(category) {
        const cards = document.querySelectorAll('.build-card');
        const btns = document.querySelectorAll('.btn-category');
        btns.forEach(b => b.classList.toggle('active', b.dataset.cat === category));
        cards.forEach(card => {
            card.style.display = card.dataset.category === category ? '' : 'none';
        });
    }

    function executeBuild(buildingType, townId) {
        try {
            var result = Player.buildBuilding(buildingType, townId);
            if (result && result.success === false) {
                toast(result.message || 'Cannot build', 'danger');
                return;
            }
            toast(`Built ${findBuildingType(buildingType)?.name || buildingType}!`, 'success', 'my_business');
            closeModal();
        } catch (e) {
            toast(e.message || 'Cannot build', 'danger');
        }
    }

    // ── BUILDING MANAGEMENT ──

    function openBuildingManagement() {
        var hasBuildings = Player.buildings && Player.buildings.length > 0;
        var hasLand = false;
        var landOwned = Player.state.landOwned || {};
        for (var lk in landOwned) { if (landOwned[lk] > 0) { hasLand = true; break; } }
        if (!hasBuildings && !hasLand) {
            toast('You have no buildings or land to manage.', 'warning');
            return;
        }

        // Collect all townIds with buildings or land
        var allTownIds = {};
        if (Player.buildings) {
            for (var bi = 0; bi < Player.buildings.length; bi++) {
                allTownIds[Player.buildings[bi].townId] = true;
            }
        }
        for (var lid in landOwned) {
            if (landOwned[lid] > 0) allTownIds[lid] = true;
        }

        // Group buildings by town
        const byTown = {};
        if (Player.buildings) {
            for (const bld of Player.buildings) {
                if (!byTown[bld.townId]) byTown[bld.townId] = [];
                byTown[bld.townId].push(bld);
            }
        }

        let html = '<div class="building-mgmt">';

        for (const townId of Object.keys(allTownIds)) {
            const town = Engine.findTown(townId);
            const tName = town ? town.name : 'Unknown';
            const buildings = byTown[townId] || [];
            var ownedLand = (landOwned[townId] || 0);
            var usedLand = Player.getUsedLandSlots ? Player.getUsedLandSlots(townId) : 0;
            var freeLand = Math.max(0, ownedLand - usedLand);

            html += `<div style="margin-bottom:12px;"><h4 style="font-size:0.85rem;margin-bottom:6px;border-bottom:1px solid var(--border);padding-bottom:4px;">📍 ${tName}</h4>`;

            // Land summary
            html += '<div style="font-size:0.78rem;margin-bottom:6px;padding:4px 6px;background:rgba(0,0,0,0.15);border-radius:3px;">';
            html += '🏗️ <b>Land:</b> ' + ownedLand + ' plot(s) owned — ' + usedLand + ' used, ' + freeLand + ' free';
            if (freeLand > 0) {
                html += ' <button class="btn-medieval" data-action="listLandForSaleUI" data-id="' + townId + '" style="font-size:0.65rem;padding:1px 6px;margin-left:6px;">📋 Sell Land</button>';
            }
            html += '</div>';

            for (const bld of buildings) {
                const info = Player.getBuildingStatus(bld.id);
                const bt = info ? info.type : Engine.findBuildingType(bld.type);
                const bName = bt ? bt.name : bld.type;

                // Status badge
                let statusBadge = '';
                if (info) {
                    const statusMap = {
                        producing: '<span style="color:#55a868;">✅ Producing</span>',
                        blocked: '<span style="color:var(--danger);">❌ Blocked</span>',
                        no_workers: '<span style="color:var(--gold);">👷 No Workers</span>',
                        inactive: '<span style="color:#888;">⏸️ Inactive</span>',
                        damaged: '<span style="color:var(--danger);">🔥 Damaged</span>',
                        depleted: '<span style="color:var(--danger);">⛏️ Depleted</span>',
                        idle: '<span style="color:#888;">💤 Idle</span>',
                        delivering: '<span style="color:#c4a35a;">📦 Delivering</span>',
                    };
                    statusBadge = statusMap[info.status] || '';
                    if (info.status === 'damaged' && bld.repairDay) {
                        var _rdCur = 0;
                        try { _rdCur = Engine.getDay(); } catch(e) {}
                        var _rdLeft = Math.max(0, bld.repairDay - _rdCur);
                        statusBadge += ' <span style="font-size:0.7rem;color:#aaa;">(' + _rdLeft + 'd)</span>';
                    }
                }

                // Condition
                const condCfg = CONFIG.CONDITION_LEVELS ? CONFIG.CONDITION_LEVELS[bld.condition || 'new'] : null;
                const condIcon = condCfg ? condCfg.icon : '✨';

                // Security
                let securityIcon = '';
                if (bld.hasGuard && bld.lockedStorage) securityIcon = '🛡️🔒';
                else if (bld.hasGuard) securityIcon = '🛡️';
                else if (bld.lockedStorage) securityIcon = '🔒';

                // Production info
                let prodInfo = '';
                if (info && bt && bt.produces) {
                    const prodRes = findResource(bt.produces);
                    const prodName = prodRes ? prodRes.name : bt.produces;
                    prodInfo = `<span style="font-size:0.72rem;color:#aaa;">📦 ${info.dailyOutput} ${prodName}/day</span>`;
                    if (info.stored > 0) {
                        prodInfo += ` <span style="font-size:0.72rem;color:var(--gold);">| Storage: ${info.stored}</span>`;
                    }
                    if (Object.keys(info.consumes).length > 0) {
                        const consumeStr = Object.entries(info.consumes).map(([rId, qty]) => {
                            const r = findResource(rId);
                            return qty + ' ' + (r ? r.name : rId);
                        }).join(', ');
                        prodInfo += `<br><span style="font-size:0.72rem;color:#aaa;">⚙️ Consumes: ${consumeStr}/day</span>`;
                    }
                    if (info.missingInputs.length > 0) {
                        const missingStr = info.missingInputs.map(m => {
                            const r = findResource(m.id);
                            return (r ? r.name : m.id) + ' (' + m.available + '/' + m.needed + ')';
                        }).join(', ');
                        prodInfo += `<br><span style="font-size:0.72rem;color:var(--danger);">⚠️ Missing: ${missingStr}</span>`;
                    }
                }

                // Retail info for retail buildings
                if (bt && bt.retailConfig) {
                    var rRev = bld.retailRevenue || 0;
                    var rStock = 0;
                    if (bld.retailStock) { for (var rk in bld.retailStock) rStock += bld.retailStock[rk]; }
                    var rMaxStock = (bt.retailConfig.maxStock || 50) * bld.level;
                    prodInfo += (prodInfo ? '<br>' : '') + '<span style="font-size:0.72rem;color:#aaa;">🏪 Stock: ' + rStock + '/' + rMaxStock + '</span>';
                    if (rRev > 0) prodInfo += ' <span style="font-size:0.72rem;color:var(--gold);">| 💰 Revenue: ' + Math.floor(rRev).toLocaleString() + 'g</span>';
                }

                // Workers
                const wCount = info ? info.workerCount : bld.workers.length;
                const wMax = info ? info.workerMax : (bt ? bt.workers : '?');

                html += `<div class="building-mgmt-card" style="border:1px solid var(--border);padding:8px;margin-bottom:6px;border-radius:4px;cursor:pointer;" data-action="showBuildingDetail" data-id="${bld.id}">
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <div>
                            <strong>${bName} ${condIcon}</strong> <span class="text-dim" style="font-size:0.75rem;">Lv.${bld.level}</span>
                            ${securityIcon ? '<span style="margin-left:4px;">' + securityIcon + '</span>' : ''}
                        </div>
                        <div style="display:flex;align-items:center;gap:8px;">
                            ${statusBadge}
                            <span style="font-size:0.72rem;color:#aaa;">👷 ${wCount}/${wMax}</span>
                        </div>
                    </div>
                    ${(function() {
                        let extra = '';
                        if (bld.transferEnabled && bld.transferTarget) {
                            const _targetBld = Player.buildings.find(function(b) { return b.id === bld.transferTarget; });
                            const _targetBt = _targetBld ? Engine.findBuildingType(_targetBld.type) : null;
                            const _targetName = bld.transferTarget === 'warehouse' ? 'Storage' : bld.transferTarget === 'market' ? 'Market' : (_targetBt ? _targetBt.name : '?');
                            extra += ' <span style="font-size:0.7rem;color:#55a868;">🚚→' + _targetName + '</span>';
                        }
                        if (bld._delivering) {
                            extra += ' <span style="font-size:0.7rem;color:#c4a35a;">📦 Delivering (' + (bld._deliveryDaysLeft || 0) + 'd)</span>';
                        }
                        return extra ? '<div style="margin-top:2px;">' + extra + '</div>' : '';
                    })()}
                    ${prodInfo ? '<div style="margin-top:4px;">' + prodInfo + '</div>' : ''}
                    <div style="text-align:right;margin-top:4px;">
                        <span style="font-size:0.7rem;color:var(--link);text-decoration:underline;">View Details →</span>
                    </div>
                </div>`;
            }
            html += '</div>';
        }
        html += '</div>';

        // Protection racket status
        if (Player.protectionRacket && Player.protectionRacket.active) {
            html += '<div style="border-top:1px solid var(--border);padding-top:8px;margin-top:12px;">';
            html += '<h4 style="font-size:0.8rem;color:var(--danger);margin-bottom:6px;">💀 Protection Racket</h4>';
            if (Player.protectionRacket.paying) {
                html += `<div style="font-size:0.78rem;">Currently paying ${CONFIG.PROTECTION_RACKET_FEE}g/season.</div>`;
                html += `<button class="btn-trade sell" style="font-size:0.7rem;margin-top:4px;" data-action="racketResponse" data-val="refuse">Stop Paying</button>`;
            } else {
                html += `<div style="font-size:0.78rem;color:var(--danger);">The criminal faction demands ${CONFIG.PROTECTION_RACKET_FEE}g/season for protection.</div>`;
                html += `<div style="display:flex;gap:8px;margin-top:6px;">
                    <button class="btn-trade buy" style="font-size:0.7rem;" data-action="racketResponse" data-val="pay">💰 Pay</button>
                    <button class="btn-trade sell" style="font-size:0.7rem;" data-action="racketResponse" data-val="refuse">✋ Refuse</button>
                    ${Player.hasSkill('intimidating_presence') ? '<button class="btn-trade" style="font-size:0.7rem;background:#4682b4;color:#fff;" data-action="racketResponse" data-val="intimidate">💪 Intimidate</button>' : ''}
                </div>`;
            }
            html += '</div>';
        }

        openModal('🏗️ Building Management', html);
    }

    // ── Town Buildings: buildings, land, and apartments for sale ──
    function openTownMarket() {
        if (typeof Player === 'undefined' || Player.traveling) { toast('Cannot browse buildings while traveling.', 'warning'); return; }
        var townId = Player.townId;
        var town = Engine.findTown(townId);
        if (!town) { toast('Not in a town.', 'warning'); return; }

        var html = '<div style="max-height:500px;overflow-y:auto;">';

        // === NPC/EM/Kingdom buildings for sale ===
        var offers = Engine.getNPCBuildingSaleOffers(town.id);
        html += '<h3 style="margin-bottom:6px;">🏗️ Buildings For Sale</h3>';
        if (offers.length === 0) {
            html += '<p style="color:#888;font-size:0.8rem;">No buildings currently for sale in ' + town.name + '.</p>';
        } else {
            for (var i = 0; i < offers.length; i++) {
                var offer = offers[i];
                var bldIdx = town.buildings.indexOf(offer.building);
                var obt = Engine.findBuildingType(offer.building.type);
                var bldName = obt ? obt.name : offer.building.type;
                var condLabel = offer.building.condition || 'new';
                var canAffordOffer = (Player.gold || 0) >= offer.price;
                html += '<div style="border:1px solid #444;padding:6px;margin:3px 0;border-radius:4px;opacity:' + (canAffordOffer ? '1' : '0.6') + ';">';
                html += '<div><strong>' + bldName + '</strong> (Lv.' + (offer.building.level || 1) + ') — <span style="color:#ffd700;">' + Math.ceil(+offer.price) + 'g</span> | ' + condLabel + '</div>';
                html += '<div style="font-size:0.75rem;color:#aaa;">' + offer.reason + '</div>';
                html += '<div style="display:flex;gap:4px;margin-top:4px;">';
                html += '<button class="btn-medieval" style="font-size:0.7rem;padding:3px 8px;" ' + (canAffordOffer ? '' : 'disabled') + ' data-action="purchaseNPCBuildingUI" data-idx="' + bldIdx + '" data-id="' + town.id + '">🏠 Buy</button>';
                html += '</div></div>';
            }
        }

        // === Player-listed buildings for sale (from other players' listings if any) ===
        // Future: show player.buildingsForSale listings here

        // === Apartment units for sale ===
        var aptBuildings = (town.buildings || []).filter(function(b) { return b.type === 'apartment_building'; });
        if (aptBuildings.length > 0) {
            html += '<h3 style="margin-top:12px;margin-bottom:6px;">🏢 Apartments For Sale</h3>';
            for (var ai = 0; ai < aptBuildings.length; ai++) {
                var aptBld = aptBuildings[ai];
                var units = aptBld.units || [];
                var availableUnits = units.filter(function(u) { return !u.occupantId; });
                var ownerName = 'Unknown';
                if (aptBld.ownerId === 'player') { ownerName = 'You'; }
                else if (aptBld.ownerId) {
                    var owner = Engine.findPerson(aptBld.ownerId);
                    if (owner) ownerName = (owner.firstName || '') + ' ' + (owner.lastName || '');
                    else {
                        var kingdom = Engine.findKingdom(aptBld.ownerId);
                        if (kingdom) ownerName = kingdom.name;
                    }
                }
                var unitPrice = aptBld.unitPrice || 0;
                // v9p33river322: prefer canonical weeklyFee
                var weeklyFee = aptBld.weeklyFee || aptBld.monthlyFee || 0;
                var unitPrice = aptBld.unitPrice || 0;
                html += '<div style="font-size:0.78rem;color:#aaa;">' + availableUnits.length + '/' + units.length + ' units available | Buy: <span style="color:#ffd700;">' + Math.ceil(unitPrice) + 'g</span> | Weekly: <span style="color:#ffd700;">' + Math.ceil(weeklyFee) + 'g</span></div>';
                html += '<div style="border:1px solid #555;padding:6px;margin:3px 0;border-radius:4px;">';
                html += '<div><strong>🏢 Apartment Building</strong> — Owner: ' + ownerName + '</div>';
                html += '<div style="font-size:0.78rem;color:#aaa;">' + availableUnits.length + '/' + units.length + ' units available | Buy: <span style="color:#ffd700;">' + Math.ceil(unitPrice) + 'g</span> | Weekly: <span style="color:#ffd700;">' + Math.ceil(monthlyFee) + 'g</span></div>';
                if (availableUnits.length > 0 && aptBld.ownerId !== 'player') {
                    var canAffordApt = (Player.gold || 0) >= unitPrice;
                    html += '<button class="btn-medieval" style="font-size:0.7rem;padding:3px 8px;margin-top:4px;" ' + (canAffordApt ? '' : 'disabled') + ' data-action="buyApartmentUnit" data-id="' + aptBld._id + '">🏢 Buy Apartment (' + Math.ceil(unitPrice) + 'g)</button>';
                }
                html += '</div>';
            }
        }

        // === Land for sale by other players (future) ===

        // === Tent camp tents for rent (only show camps with available tents) ===
        var tentCampBlds = (town.buildings || []).filter(function(b) { return b.type === 'tent_camp'; });
        var tentCampsWithAvail = tentCampBlds.filter(function(tc) {
            var tents = tc.tents || [];
            return tents.some(function(t) { return !t.occupantId; });
        });
        if (tentCampsWithAvail.length > 0) {
            var tcKingdom = Engine.findKingdom(town.kingdomId);
            var tcBanned = tcKingdom && tcKingdom.laws && tcKingdom.laws.specialLaws &&
                tcKingdom.laws.specialLaws.some(function(l) { return l.id === 'no_tent_camps'; });
            if (!tcBanned) {
                html += '<h3 style="margin-top:12px;margin-bottom:6px;">⛺ Tent Camps</h3>';
                for (var tci = 0; tci < tentCampsWithAvail.length; tci++) {
                    var tcBld = tentCampsWithAvail[tci];
                    var tcTents = tcBld.tents || [];
                    var tcAvailable = tcTents.filter(function(t) { return !t.occupantId; });
                    var tcUpfront = tcBld.tentUpfrontCost || 20;
                    var tcMonthly = tcBld.tentMonthlyCost || 5;
                    html += '<div style="border:1px solid #555;padding:6px;margin:3px 0;border-radius:4px;">';
                    html += '<div><strong>⛺ Tent Camp</strong></div>';
                    html += '<div style="font-size:0.78rem;color:#aaa;">' + tcAvailable.length + '/' + tcTents.length + ' tents available | Rent: <span style="color:#ffd700;">' + tcUpfront + 'g</span> upfront + <span style="color:#ffd700;">' + tcMonthly + 'g</span>/month</div>';
                    html += '<div style="font-size:0.72rem;color:#888;margin-top:2px;">⚠️ Barely better than sleeping on the ground. Disease risk is high.</div>';
                    if (tcAvailable.length > 0) {
                        var canAffordTent = (Player.gold || 0) >= tcUpfront;
                        var alreadyHasTent = Player.state && Player.state.houses && Player.state.houses.some(function(h) { return h.type === 'tent'; });
                        if (alreadyHasTent) {
                            html += '<div style="font-size:0.72rem;color:#cc8800;margin-top:3px;">You already rent a tent.</div>';
                        } else {
                            html += '<button class="btn-medieval" style="font-size:0.7rem;padding:3px 8px;margin-top:4px;" ' + (canAffordTent ? '' : 'disabled') + ' data-action="buyTentSlot" data-id="' + tcBld._id + '">⛺ Rent Tent (' + tcUpfront + 'g)</button>';
                        }
                    }
                    html += '</div>';
                }
            }
        }

        // === Town Buildings (not for sale, informational) ===
        var townBuildings = (town.buildings || []).filter(function(b) { return b.type !== 'tent_camp'; });
        if (townBuildings.length > 0) {
            html += '<h3 style="margin-top:12px;margin-bottom:6px;">🏗️ Town Buildings</h3>';
            html += '<div style="font-size:0.78rem;color:#aaa;margin-bottom:6px;">Buildings in ' + town.name + ':</div>';
            // Group by type
            var bldCounts = {};
            for (var tbi = 0; tbi < townBuildings.length; tbi++) {
                var tb = townBuildings[tbi];
                var tbType = tb.type || 'unknown';
                if (!bldCounts[tbType]) bldCounts[tbType] = { count: 0, forSale: 0, underConstruction: 0 };
                bldCounts[tbType].count++;
                if (tb.forSale) bldCounts[tbType].forSale++;
                if (tb.condition === 'under_construction') bldCounts[tbType].underConstruction++;
            }
            html += '<div style="display:flex;flex-wrap:wrap;gap:4px;">';
            for (var bType in bldCounts) {
                if (!bldCounts.hasOwnProperty(bType)) continue;
                var bc = bldCounts[bType];
                var bt = Engine.findBuildingType ? Engine.findBuildingType(bType) : null;
                var bName = bt ? bt.name : bType;
                var bIcon = bt ? (bt.icon || '🏠') : '🏠';
                var extra = '';
                if (bc.forSale > 0) extra += ' <span style="color:#5ac85a;">(' + bc.forSale + ' for sale)</span>';
                if (bc.underConstruction > 0) extra += ' <span style="color:#c4a35a;">(' + bc.underConstruction + ' building)</span>';
                html += '<div class="btn-medieval" data-action="openBuildingDetail" data-id="' + bType + '" data-val="' + town.id + '" style="cursor:pointer;border:1px solid #444;padding:3px 6px;border-radius:4px;font-size:0.75rem;background:rgba(0,0,0,0.2);">' + bIcon + ' ' + bName + ' ×' + bc.count + extra + '</div>';
            }
            html += '</div>';
        }

        html += '</div>';
        openModal('🏗️ Town Buildings — ' + town.name, html);
    }

    function listLandForSaleUI(townId) {
        var maxPrice = null;
        try { maxPrice = Engine.getPropertyMaxBuyPrice({ type: 'land' }, townId); } catch(e) {}
        var recommended = maxPrice ? Math.floor(maxPrice * 0.85) : 100;
        var hasAppraiser = Player.hasSkill && Player.hasSkill('property_appraiser');

        var html = '<div style="padding:8px;">';
        html += '<h3>📋 List Land For Sale</h3>';
        html += '<div style="margin:8px 0;">Recommended price: <b style="color:#ffd700;">' + recommended + 'g</b></div>';
        if (hasAppraiser) {
            html += '<div style="margin:4px 0;font-size:0.8rem;">🔎 Max any buyer will pay: <b style="color:#55a868;">' + maxPrice + 'g</b></div>';
        }
        html += '<div style="margin:8px 0;"><label>Your price: </label><input type="number" id="landSalePrice" value="' + recommended + '" min="1" style="width:80px;padding:2px 4px;background:#222;color:#eee;border:1px solid #555;border-radius:3px;"> g</div>';
        html += '<button class="btn-medieval" data-action="listLandConfirm" data-id="' + townId + '">📋 List For Sale</button>';

        // Show existing listing if any
        var existing = (Player.state.landForSale || []).find(function(l) { return l.townId === townId; });
        if (existing) {
            html += '<div style="margin-top:8px;padding:6px;border:1px solid #555;border-radius:3px;">Currently listed at <b>' + existing.price + 'g</b>';
            html += ' <button class="btn-medieval" style="font-size:0.7rem;padding:2px 6px;color:#c44e52;" data-action="cancelLandListing" data-id="' + townId + '">🚫 Cancel</button></div>';
        }
        html += '</div>';
        openModal('📋 Sell Land', html);
    }

    function buyApartmentUnit(aptBuildingId) {
        // Find the apartment building in the current town
        var town = Engine.findTown(Player.townId);
        if (!town) { toast('Not in a town.', 'warning'); return; }
        var aptBld = (town.buildings || []).find(function(b) { return b._id === aptBuildingId && b.type === 'apartment_building'; });
        if (!aptBld) { toast('Apartment building not found.', 'warning'); return; }
        var availableUnits = (aptBld.units || []).filter(function(u) { return !u.occupantId; });
        if (availableUnits.length === 0) { toast('No available apartments.', 'warning'); return; }
        var price = aptBld.unitPrice || 0;
        if ((Player.gold || 0) < price) { toast('Not enough gold. Need ' + price + 'g.', 'error'); return; }

        // Buy the first available unit
        var unit = availableUnits[0];
        unit.occupantId = 'player';
        unit.occupantType = 'player';
        unit.purchaseDay = Engine.getDay();
        unit.purchasePrice = price;

        // Deduct gold
        Player.state.gold -= price;
        Player.state.stats.totalGoldSpent = (Player.state.stats.totalGoldSpent || 0) + price;

        // Pay owner
        if (aptBld.ownerId && aptBld.ownerId !== 'player') {
            var owner = Engine.findPerson(aptBld.ownerId);
            if (owner) owner.gold = (owner.gold || 0) + price;
            else {
                var kingdom = Engine.findKingdom(aptBld.ownerId);
                if (kingdom) kingdom.treasury = (kingdom.treasury || 0) + price;
            }
        }

        // Create apartment house record for player
        var house = {
            id: 'apt_unit_' + aptBuildingId + '_' + unit.unitIndex,
            type: 'apartment',
            townId: Player.townId,
            purchaseDay: Engine.getDay(),
            occupants: [],
            homeStorage: {},
            isRental: false,
            rentAccumulated: 0,
            purchaseCost: price,
            fromApartmentBuilding: aptBuildingId,
            unitIndex: unit.unitIndex,
            // v9p33river322: prefer canonical weeklyFee
            weeklyMaintenance: aptBld.weeklyFee || aptBld.monthlyFee || 0,
            monthlyMaintenance: aptBld.weeklyFee || aptBld.monthlyFee || 0 // legacy alias
        };
        if (!Player.state.houses) Player.state.houses = [];
        Player.state.houses.push(house);
        if (!Player.state.primaryHouseId) Player.state.primaryHouseId = house.id;

        toast('🏢 Apartment purchased for ' + price + 'g! Weekly maintenance: ' + (aptBld.weeklyFee || aptBld.monthlyFee || 0) + 'g.', 'success');
        Engine.logEvent('🏢 ' + Player.state.fullName + ' bought an apartment in ' + (town ? town.name : 'unknown') + ' for ' + price + 'g.');
        if (typeof StoryMode !== 'undefined' && StoryMode.onPlayerAction) StoryMode.onPlayerAction('own_building', { building: 'housing' });
        openTownMarket(); // Refresh
    }

    function buyTentSlot(tcBuildingId) {
        var town = Engine.getTown ? Engine.getTown(Player.townId) : null;
        if (!town) { toast('Not in a town.', 'warning'); return; }
        var tcBld = null;
        for (var i = 0; i < town.buildings.length; i++) {
            if (town.buildings[i]._id === tcBuildingId && town.buildings[i].type === 'tent_camp') {
                tcBld = town.buildings[i];
                break;
            }
        }
        if (!tcBld || !tcBld.tents) { toast('Tent camp not found.', 'warning'); return; }
        var upfront = tcBld.tentUpfrontCost || 20;
        if ((Player.gold || 0) < upfront) { toast('Not enough gold (' + upfront + 'g required).', 'warning'); return; }
        // Check if player already has a tent
        if (Player.state && Player.state.houses && Player.state.houses.some(function(h) { return h.type === 'tent'; })) {
            toast('You already rent a tent.', 'warning');
            return;
        }
        // Find available tent
        var slot = null;
        for (var ti = 0; ti < tcBld.tents.length; ti++) {
            if (!tcBld.tents[ti].occupantId) { slot = tcBld.tents[ti]; break; }
        }
        if (!slot) { toast('No tents available.', 'warning'); return; }
        // Rent the tent
        if (Player.modifyGold) Player.modifyGold(-upfront, 'housing', 'Tent rental');
        slot.occupantId = Player.state.id || 'player';
        slot.occupantType = 'player';
        slot.rentStartDay = Engine.getDay();
        slot.lastRentDay = Engine.getDay();
        // Add house record to player
        if (!Player.state.houses) Player.state.houses = [];
        var tentHouseId = 'house_tent_' + town.id + '_' + slot.tentIndex;
        Player.state.houses.push({
            id: tentHouseId,
            type: 'tent',
            townId: town.id,
            fromTentCamp: tcBld._id,
            tentIndex: slot.tentIndex,
            rentStartDay: Engine.getDay(),
            monthlyCost: tcBld.tentMonthlyCost || 5
        });
        Player.state.houseType = 'tent';
        Player.state._tentCampId = tcBld._id;
        Player.state._tentIndex = slot.tentIndex;
        if (!Player.state.primaryHouseId) Player.state.primaryHouseId = tentHouseId;
        toast('⛺ You rented a tent for ' + upfront + 'g. Monthly rent: ' + (tcBld.tentMonthlyCost || 5) + 'g.', 'success');
        Engine.logEvent('⛺ ' + Player.state.fullName + ' rented a tent in ' + town.name + '.');
        openTownMarket(); // Refresh
    }

    function listBuildingForSaleUI(buildingId) {
        var bld = (Player.buildings || []).find(function(b) { return b.id === buildingId; });
        if (!bld) { toast('Building not found.', 'warning'); return; }

        // Toggle off if already for sale
        if (bld.forSale) {
            var result = Player.listBuildingForSale(buildingId);
            toast(result.message, result.success ? 'success' : 'error');
            if (result.success) showBuildingDetail(buildingId);
            return;
        }

        var bt = Engine.findBuildingType(bld.type);
        var bName = bt ? bt.name : bld.type;
        var maxPrice = null;
        try { maxPrice = Engine.getPropertyMaxBuyPrice(bld, bld.townId); } catch(e) {}
        var recommended = maxPrice ? Math.floor(maxPrice * 0.85) : Math.floor((bt ? bt.cost : 500) * 0.8);
        var hasAppraiser = Player.hasSkill && Player.hasSkill('property_appraiser');

        var html = '<div style="padding:8px;">';
        html += '<h3>📋 List ' + bName + ' For Sale</h3>';
        html += '<div style="margin:8px 0;">Recommended price: <b style="color:#ffd700;">' + recommended + 'g</b></div>';
        if (hasAppraiser) {
            html += '<div style="margin:4px 0;font-size:0.8rem;">🔎 Max any buyer will pay: <b style="color:#55a868;">' + maxPrice + 'g</b></div>';
        }
        html += '<div style="margin:8px 0;"><label>Your price: </label><input type="number" id="bldSalePrice" value="' + recommended + '" min="1" style="width:100px;padding:2px 4px;background:#222;color:#eee;border:1px solid #555;border-radius:3px;"> g</div>';
        html += '<button class="btn-medieval" data-action="listBldForSaleConfirm" data-id="' + buildingId + '">📋 List For Sale</button>';
        html += '</div>';
        openModal('📋 Sell Building', html);
    }

    // ── Building Detail sub-sections (H3 decomposition) ──

    function _buildMedicalSection(bld, bt, town) {
        var html = '';
        var _engBld = null;
        if (town && town.buildings) {
            for (var _ebi = 0; _ebi < town.buildings.length; _ebi++) {
                if (town.buildings[_ebi].id === bld.id) { _engBld = town.buildings[_ebi]; break; }
            }
        }
        var _medBld = _engBld || bld;
        html += '<div style="padding:8px;border:1px solid var(--border);border-radius:4px;margin-bottom:8px;">';
        html += '<div style="font-weight:bold;font-size:0.8rem;margin-bottom:6px;">🏥 MEDICAL PREPAREDNESS</div>';
        var _abEnabled = _medBld._autobuyEnabled !== false;
        html += '<div style="margin-bottom:6px;font-size:0.78rem;">';
        html += '<label style="cursor:pointer;"><input type="checkbox" ' + (_abEnabled ? 'checked' : '') + ' onchange="Engine.toggleMedicalAutobuy(\'' + bld.townId + '\',\'' + bld.id + '\');UI.showBuildingDetail(\'' + bld.id + '\');"> 🛒 Auto-buy medical supplies from local market</label>';
        html += '</div>';
        var _medStock = _medBld._medicalStock || {};
        var _retStock = _medBld.retailStock || bld.retailStock || {};
        // v9p33river112: also count items in the building's input storage
        // (deposited from inventory / town storage) toward Medical Stock so the
        // breakdown numbers and engine consumption agree.
        var _bldInv = bld.inventory || {};
        var _medGoods = ['bandages', 'herbal_remedy', 'healing_tonic', 'herbal_poultice', 'fever_tonic', 'antidote', 'splint'];
        var _medStockTotal = 0;
        for (var _msi = 0; _msi < _medGoods.length; _msi++) _medStockTotal += (_medStock[_medGoods[_msi]] || 0) + (_retStock[_medGoods[_msi]] || 0) + (_bldInv[_medGoods[_msi]] || 0);
        var _medStorageCap = (bt && bt.medicalStorage) || 40;
        var _medPct = _medStorageCap > 0 ? Math.round(_medStockTotal / _medStorageCap * 100) : 0;
        var _medColor = _medPct >= 60 ? '#55a868' : _medPct >= 25 ? 'var(--gold)' : 'var(--danger)';
        html += '<div style="font-size:0.78rem;margin-bottom:4px;">📦 Medical Stock: <span style="color:' + _medColor + ';">' + _medStockTotal + '/' + _medStorageCap + '</span> <span style="font-size:0.68rem;color:#888;">(dedicated + retail + storage)</span></div>';
        html += '<div style="background:#333;border-radius:3px;height:6px;margin-bottom:8px;overflow:hidden;">';
        html += '<div style="background:' + _medColor + ';height:100%;width:' + Math.min(100, _medPct) + '%;"></div></div>';
        html += '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px;">';
        for (var _mgi = 0; _mgi < _medGoods.length; _mgi++) {
            var _mgId = _medGoods[_mgi];
            var _mgDed = _medStock[_mgId] || 0;
            var _mgRet = _retStock[_mgId] || 0;
            var _mgInv = _bldInv[_mgId] || 0;
            var _mgQty = _mgDed + _mgRet + _mgInv;
            var _mgRes = findResource(_mgId);
            var _mgName = _mgRes ? _mgRes.name : _mgId;
            var _mgIcon = _mgRes ? (_mgRes.icon || '💊') : '💊';
            var _mgCol = _mgQty > 0 ? '#55a868' : '#666';
            var _detailParts = [];
            if (_mgDed > 0) _detailParts.push(_mgDed + 'd');
            if (_mgRet > 0) _detailParts.push(_mgRet + 'r');
            if (_mgInv > 0) _detailParts.push(_mgInv + 's');
            var _mgDetail = _detailParts.length > 1 ? ' (' + _detailParts.join('+') + ')' : '';
            html += '<span style="font-size:0.72rem;padding:2px 5px;border:1px solid #444;border-radius:3px;color:' + _mgCol + ';">' + _mgIcon + ' ' + _mgName + ': ' + _mgQty + _mgDetail + '</span>';
        }
        html += '</div>';
        var _treatSuppliesInjury = (typeof NPC_HEALTH_CONFIG !== 'undefined' && NPC_HEALTH_CONFIG.TREATMENT_SUPPLIES_INJURY) ? NPC_HEALTH_CONFIG.TREATMENT_SUPPLIES_INJURY : {};
        var _treatSuppliesIllness = (typeof NPC_HEALTH_CONFIG !== 'undefined' && NPC_HEALTH_CONFIG.TREATMENT_SUPPLIES_ILLNESS) ? NPC_HEALTH_CONFIG.TREATMENT_SUPPLIES_ILLNESS : {};
        var _treatTicks = (typeof NPC_HEALTH_CONFIG !== 'undefined' && NPC_HEALTH_CONFIG.TREATMENT_TICKS) ? NPC_HEALTH_CONFIG.TREATMENT_TICKS : {};
        var _isClinc = bld.type === 'clinic';
        html += '<div style="font-weight:bold;font-size:0.75rem;margin-bottom:4px;">Treatment Capabilities:</div>';
        html += '<table style="width:100%;font-size:0.72rem;border-collapse:collapse;">';
        html += '<tr style="border-bottom:1px solid #444;"><th style="text-align:left;padding:3px;">Severity</th><th style="text-align:left;padding:3px;">Injury Supplies</th><th style="text-align:left;padding:3px;">Illness Supplies</th><th style="text-align:center;padding:3px;">Time</th><th style="text-align:center;padding:3px;">Ready?</th></tr>';
        var _sevLevels = ['minor', 'moderate', 'serious', 'severe'];
        var _sevLabels = { minor: '🟢 Minor', moderate: '🟡 Moderate', serious: '🟠 Serious', severe: '🔴 Severe' };
        var _medRank = (typeof NPC_HEALTH_CONFIG !== 'undefined' && NPC_HEALTH_CONFIG.MEDICINE_RANK) ? NPC_HEALTH_CONFIG.MEDICINE_RANK : ['herbal_remedy', 'fever_tonic', 'healing_tonic', 'antidote'];
        for (var _si = 0; _si < _sevLevels.length; _si++) {
            var _sev = _sevLevels[_si];
            var _blocked = false;
            var _isClinicSevere = _isClinc && _sev === 'severe';
            var _injSupplies = _treatSuppliesInjury[_sev] || {};
            var _illSupplies = _treatSuppliesIllness[_sev] || {};
            var _ticks = _treatTicks[_sev] || 0;
            if (_isClinicSevere) _ticks = _ticks * 2;
            var _hours = Math.round(_ticks / 2.5);
            var _readyInj = true, _readyIll = true;
            var _buildInjList = function(supplies) {
                var list = [];
                var allOk = true;
                for (var _supRes in supplies) {
                    var _supQty = supplies[_supRes];
                    var _supHave = (_medStock[_supRes] || 0) + (_retStock[_supRes] || 0) + (_bldInv[_supRes] || 0);
                    var _supMkt = (town && town.market && town.market.supply[_supRes]) || 0;
                    var _supAvail = _supHave + _supMkt;
                    var _rIdx = _medRank.indexOf(_supRes);
                    if (!(_supAvail >= _supQty) && _rIdx >= 0) {
                        for (var _ssi = _rIdx + 1; _ssi < _medRank.length; _ssi++) {
                            var _altHave = (_medStock[_medRank[_ssi]] || 0) + (_retStock[_medRank[_ssi]] || 0) + (_bldInv[_medRank[_ssi]] || 0);
                            var _altMkt = (town && town.market && town.market.supply[_medRank[_ssi]]) || 0;
                            if (_altHave + _altMkt >= _supQty) { _supAvail = _supQty; break; }
                        }
                    }
                    var _supOk = _supAvail >= _supQty;
                    var _supRe = findResource(_supRes);
                    var _supName = _supRe ? _supRe.name : _supRes;
                    list.push('<span style="color:' + (_supOk ? '#55a868' : 'var(--danger)') + ';">' + _supQty + ' ' + _supName + (_supOk ? ' ✓' : ' ✗') + '</span>');
                    // v9p33river274: keep iterating so ALL required supplies appear in the list,
                    // not just the first one (early return was hiding splints/poultices/tonics).
                    if (!_supOk) allOk = false;
                }
                return { list: list, ready: allOk };
            };
            var _injResult = _buildInjList(_injSupplies);
            var _illResult = _buildInjList(_illSupplies);
            var _rowStyle = _blocked ? 'color:#555;' : '';
            html += '<tr style="border-bottom:1px solid #333;' + _rowStyle + '">';
            html += '<td style="padding:3px;">' + (_blocked ? '🚫 ' : '') + _sevLabels[_sev] + (_isClinicSevere ? ' <span style="font-size:0.65rem;color:#e67e22;">(2x time)</span>' : '') + '</td>';
            html += '<td style="padding:3px;">' + (_injResult.list.length > 0 ? _injResult.list.join(', ') : '<span style="color:#555;">—</span>') + '</td>';
            html += '<td style="padding:3px;">' + (_illResult.list.length > 0 ? _illResult.list.join(', ') : '<span style="color:#555;">—</span>') + '</td>';
            html += '<td style="text-align:center;padding:3px;">' + (_blocked ? '—' : '~' + _hours + 'h') + '</td>';
            html += '<td style="text-align:center;padding:3px;">' + (_blocked ? '🚫' : ((_injResult.ready && _illResult.ready) ? '<span style="color:#55a868;">✅</span>' : '<span style="color:var(--danger);">❌</span>')) + '</td>';
            html += '</tr>';
        }
        html += '</table>';
        html += '<div style="font-weight:bold;font-size:0.75rem;margin-top:8px;margin-bottom:4px;">Common Conditions & Treatment:</div>';
        html += '<table style="width:100%;font-size:0.70rem;border-collapse:collapse;">';
        html += '<tr style="border-bottom:1px solid #444;"><th style="text-align:left;padding:2px;">Condition</th><th style="text-align:left;padding:2px;">Type</th><th style="text-align:center;padding:2px;">Severity</th><th style="text-align:left;padding:2px;">Key Supply</th><th style="text-align:right;padding:2px;">Fee</th><th style="text-align:right;padding:2px;">Supply Cost</th></tr>';
        var _condTable = [
            { name: 'Common Cold', type: 'Illness', sev: 'minor', supply: 'herbal_remedy' },
            { name: 'Food Poisoning', type: 'Illness', sev: 'minor', supply: 'herbal_remedy' },
            { name: 'Influenza', type: 'Illness', sev: 'moderate', supply: 'fever_tonic' },
            { name: 'Dysentery', type: 'Illness', sev: 'moderate', supply: 'fever_tonic' },
            { name: 'Pneumonia', type: 'Illness', sev: 'serious', supply: 'healing_tonic' },
            { name: 'Plague', type: 'Illness', sev: 'severe', supply: 'antidote' },
            { name: 'Minor Wound', type: 'Injury', sev: 'minor', supply: 'bandages' },
            { name: 'Broken Bone', type: 'Injury', sev: 'moderate', supply: 'splint' },
            { name: 'Severe Trauma', type: 'Injury', sev: 'serious', supply: 'herbal_poultice' },
            { name: 'Crushed Limb', type: 'Injury', sev: 'severe', supply: 'healing_tonic' },
        ];
        var _tFees = _medBld._treatmentFees || {};
        var _tSupInjury = (typeof NPC_HEALTH_CONFIG !== 'undefined' && NPC_HEALTH_CONFIG.TREATMENT_SUPPLIES_INJURY) ? NPC_HEALTH_CONFIG.TREATMENT_SUPPLIES_INJURY : {};
        var _tSupIllness = (typeof NPC_HEALTH_CONFIG !== 'undefined' && NPC_HEALTH_CONFIG.TREATMENT_SUPPLIES_ILLNESS) ? NPC_HEALTH_CONFIG.TREATMENT_SUPPLIES_ILLNESS : {};
        var _sevColors = { minor: '#55a868', moderate: 'var(--gold)', serious: '#e67e22', severe: 'var(--danger)' };
        for (var _ci = 0; _ci < _condTable.length; _ci++) {
            var _cond = _condTable[_ci];
            var _cBlocked = false;
            var _cIsClinicSevere = _isClinc && _cond.sev === 'severe';
            var _cSupRes = findResource(_cond.supply);
            var _cSupName = _cSupRes ? _cSupRes.name : _cond.supply;
            var _cHaveSupply = ((_medStock[_cond.supply] || 0) + (_retStock[_cond.supply] || 0) + ((town && town.market && town.market.supply[_cond.supply]) || 0)) > 0;
            var _cFee = _tFees[_cond.sev] || 0;
            var _cSupCost = 0;
            var _cSupDef = _cond.type === 'Illness' ? (_tSupIllness[_cond.sev] || {}) : (_tSupInjury[_cond.sev] || {});
            for (var _csk in _cSupDef) {
                var _cPrice = (Engine.getMarketPrice ? Engine.getMarketPrice(town.id, _csk) : 5) || 5;
                _cSupCost += _cPrice * _cSupDef[_csk];
            }
            var _cProfit = _cFee - _cSupCost;
            var _cProfitColor = _cProfit > 0 ? '#55a868' : _cProfit < 0 ? 'var(--danger)' : '#888';
            html += '<tr style="border-bottom:1px solid #222;' + (_cBlocked ? 'color:#555;' : '') + '">';
            html += '<td style="padding:2px;">' + _cond.name + '</td>';
            html += '<td style="padding:2px;">' + (_cond.type === 'Illness' ? '🤒' : '🩹') + ' ' + _cond.type + '</td>';
            html += '<td style="text-align:center;padding:2px;color:' + (_sevColors[_cond.sev] || '#aaa') + ';">' + _cond.sev + (_cIsClinicSevere ? ' (2x)' : '') + '</td>';
            html += '<td style="padding:2px;">' + (_cBlocked ? '🚫' : (_cHaveSupply ? '✅ ' : '❌ ') + _cSupName) + '</td>';
            html += '<td style="text-align:right;padding:2px;color:var(--gold);">' + _cFee + 'g</td>';
            html += '<td style="text-align:right;padding:2px;color:' + _cProfitColor + ';">' + Math.round(_cSupCost * 100) / 100 + 'g</td>';
            html += '</tr>';
        }
        html += '</table>';
        var _queue = _medBld._treatmentQueue || [];
        var _maxH = (bt && bt.maxHealers) || 2;
        html += '<div style="font-size:0.75rem;margin-top:8px;">📋 Treatment Queue: <strong>' + _queue.length + '</strong> patients | Capacity: ' + _maxH + ' simultaneous</div>';
        if (_queue.length > 0) {
            html += '<div style="margin-top:4px;max-height:160px;overflow-y:auto;font-size:0.72rem;">';
            html += '<div style="display:grid;grid-template-columns:2fr 1.2fr 0.8fr 0.8fr 24px;gap:2px;padding:2px 4px;border-bottom:1px solid #444;color:#888;font-size:0.68rem;">';
            html += '<span>Patient</span><span>Condition</span><span>Severity</span><span style="text-align:right;">Time</span><span></span>';
            html += '</div>';
            for (var _qi = 0; _qi < _queue.length; _qi++) {
                var _qp = _queue[_qi];
                var _qPerson = Engine.findPerson ? Engine.findPerson(_qp.personId) : null;
                var _qName = _qPerson ? (_qPerson.firstName + ' ' + (_qPerson.lastName || '')) : _qp.personId;
                var _qActive = _qi < _maxH;
                var _qDaysLeft = Math.round((_qp.ticksRemaining || 0) / 60 * 10) / 10;
                var _qSev = _qp.severity || (_qPerson ? (_qPerson.injurySeverity || _qPerson.illnessSeverity || 'minor') : 'minor');
                var _qIsIll = _qp.isIllness != null ? (_qp.isIllness !== false) : (_qPerson ? !!_qPerson.sick : true);
                var _qSevColor = _qSev === 'severe' ? 'var(--danger)' : _qSev === 'serious' ? '#e67e22' : _qSev === 'moderate' ? 'var(--gold)' : '#55a868';
                var _qCondition = '';
                if (_qPerson) {
                    if (_qIsIll && _qPerson.illness) _qCondition = _qPerson.illness;
                    else if (!_qIsIll && _qPerson.injuryName) _qCondition = _qPerson.injuryName;
                }
                var _qTypeIcon = _qIsIll ? '🤒' : '🩹';
                html += '<div style="display:grid;grid-template-columns:2fr 1.2fr 0.8fr 0.8fr 24px;gap:2px;padding:2px 4px;border-bottom:1px solid #333;align-items:center;">';
                html += '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + (_qActive ? '💊 ' : '⏳ ') + '<a href="#" data-action="showNPCDetail" data-id="' + _qp.personId + '" style="color:var(--link);text-decoration:underline;cursor:pointer;">' + _qName + '</a></span>';
                html += '<span style="font-size:0.68rem;color:#aaa;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + _qTypeIcon + ' ' + (_qCondition || (_qIsIll ? 'Illness' : 'Injury')) + '</span>';
                html += '<span style="color:' + _qSevColor + ';">' + _qSev + '</span>';
                html += '<span style="color:#aaa;text-align:right;">~' + _qDaysLeft + 'd</span>';
                html += '<span style="text-align:center;"><a href="#" data-action="kickPatientAction" data-id="' + _qp.personId + '" data-val="' + bld.id + '" data-type="' + bld.townId + '" style="color:#888;text-decoration:none;cursor:pointer;font-size:0.8rem;" title="Remove from queue">✕</a></span>';
                html += '</div>';
            }
            html += '</div>';
        }
        var _tStats = _medBld._treatmentStats || { treated: 0, feeEarned: 0, supplyCost: 0 };
        var _netProfit = _tStats.feeEarned - _tStats.supplyCost;
        var _profitColor = _netProfit > 0 ? '#55a868' : _netProfit < 0 ? 'var(--danger)' : '#aaa';
        html += '<div style="margin-top:8px;padding:6px;background:rgba(0,0,0,0.2);border-radius:4px;">';
        html += '<div style="font-weight:bold;font-size:0.75rem;margin-bottom:4px;">📊 Treatment Log</div>';
        html += '<div style="font-size:0.73rem;display:flex;flex-wrap:wrap;gap:8px;">';
        html += '<span>🩺 Patients Treated: <strong>' + _tStats.treated + '</strong></span>';
        html += '<span>💰 Fees Earned: <strong style="color:var(--gold);">' + Math.round(_tStats.feeEarned) + 'g</strong></span>';
        html += '<span>📦 Supply Cost: <strong style="color:#e67e22;">' + Math.round(_tStats.supplyCost) + 'g</strong></span>';
        html += '<span>📈 Net Profit: <strong style="color:' + _profitColor + ';">' + ((_netProfit >= 0 ? '+' : '') + Math.round(_netProfit)) + 'g</strong></span>';
        html += '</div></div>';
        html += '</div>';
        return html;
    }

    function showBuildingDetail(buildingId) {
        try { return _showBuildingDetailInner(buildingId); } catch (e) {
            console.error('showBuildingDetail error:', e, e.stack);
            toast('Error showing building detail: ' + (e.message || e), 'danger');
        }
    }
    function _showBuildingDetailInner(buildingId) {
        const info = Player.getBuildingStatus(buildingId);
        if (!info) { toast('Building not found.', 'warning'); return; }
        const bld = info.building;
        const bt = info.type;
        const town = info.town;
        const bName = bt ? bt.name : bld.type;
        const tName = town ? town.name : 'Unknown';

        // Condition display
        const condCfg = CONFIG.CONDITION_LEVELS ? CONFIG.CONDITION_LEVELS[bld.condition || 'new'] : null;
        const condIcon = condCfg ? condCfg.icon : '✨';
        const condName = condCfg ? condCfg.name : 'New';
        const condEff = info.conditionEfficiency;

        // Status display
        const statusLabels = {
            producing: '✅ Producing',
            blocked: '❌ Blocked',
            no_workers: '👷 No Workers',
            inactive: '⏸️ Inactive',
            damaged: '🔥 Damaged',
            depleted: '⛏️ Deposit Depleted',
            idle: '💤 Idle',
            delivering: '📦 Delivering Goods',
        };
        let statusText = statusLabels[info.status] || info.status;
        if (info.status === 'blocked' && info.missingInputs.length > 0) {
            const missing = info.missingInputs.map(m => { const r = findResource(m.id); return (r ? r.name : m.id) + ' (have ' + m.available + ', need ' + m.needed + ')'; }).join(', ');
            statusText += ' — need: ' + missing;
        }
        if (info.status === 'damaged' && bld.repairDay) {
            var _curDay = 0;
            try { _curDay = Engine.getDay(); } catch(e) {}
            var _daysLeft = Math.max(0, bld.repairDay - _curDay);
            statusText += ' — repairs in ' + _daysLeft + ' day' + (_daysLeft !== 1 ? 's' : '') + ' (day ' + bld.repairDay + ')';
        }

        let html = '<div style="max-height:70vh;overflow-y:auto;">';

        // Header
        html += `<div style="padding:8px;border-bottom:1px solid var(--border);margin-bottom:8px;">
            <div style="font-size:1rem;font-weight:bold;">🏭 ${bName} (Level ${bld.level}) — ${tName}</div>
            <div style="font-size:0.8rem;margin-top:4px;">Condition: ${condIcon} ${condName} (${Math.round(condEff * 100)}% efficiency)</div>
            <div style="font-size:0.8rem;margin-top:2px;">Status: ${statusText}</div>
        </div>`;

        // PRODUCTION section
        if (bt.produces) {
            const currentProduct = bld.currentProduct || bld.productionChoice || bt.produces;
            // Resolve actual output resource — recipe key may differ (e.g. rope_from_cloth → rope)
            var _curRecipe = bt.availableProducts && bt.availableProducts[currentProduct];
            var _actualOutputId = (_curRecipe && _curRecipe.produces) ? _curRecipe.produces : currentProduct;
            const prodRes = findResource(_actualOutputId);
            const prodName = prodRes ? (prodRes.icon || '') + ' ' + prodRes.name : currentProduct;

            html += `<div style="padding:8px;border:1px solid var(--border);border-radius:4px;margin-bottom:8px;">
                <div style="font-weight:bold;font-size:0.8rem;margin-bottom:6px;">📦 PRODUCTION</div>`;

            // Product selection dropdown for multi-product buildings
            const productOptions = bt.canProduce || (bt.availableProducts ? Object.keys(bt.availableProducts) : null);
            if (productOptions && productOptions.length > 1) {
                var _bldLevel = bld.level || 1;
                html += `<div style="margin-bottom:6px;font-size:0.78rem;">
                    <span>Producing: </span>
                    <select id="productSelect" style="font-size:0.75rem;padding:2px 4px;background:#2a2520;color:#e8dcc8;border:1px solid #555;border-radius:4px;">`;
                for (const pId of productOptions) {
                    const pRes = findResource(pId);
                    var _recipe = bt.availableProducts && bt.availableProducts[pId];
                    const pName = (_recipe && _recipe.name) ? _recipe.name : (pRes ? pRes.name : pId);
                    const selected = pId === currentProduct ? 'selected' : '';
                    // Check minLevel requirement
                    var _locked = _recipe && _recipe.minLevel && _bldLevel < _recipe.minLevel;
                    // Quality chance label for tiered products
                    var _qLabel = '';
                    if (pRes && (pRes.tier === 'good' || pRes.tier === 'excellent') && pRes.baseItem && Player.qualityCraftChance) {
                        var _dropChance = Math.round(Player.qualityCraftChance(pRes.tier, pRes.baseItem, info.avgWorkerSkill || 10) * 100);
                        _qLabel = ' (' + _dropChance + '% chance)';
                    }
                    if (_locked) {
                        html += `<option value="${pId}" disabled ${selected}>${pName} (Lv${_recipe.minLevel}+)</option>`;
                    } else {
                        html += `<option value="${pId}" ${selected}>${pName}${_qLabel}</option>`;
                    }
                }
                html += `</select>
                    <button class="btn-trade buy" style="font-size:0.7rem;margin-left:4px;" data-action="setBuildingProductUI" data-id="${bld.id}">Set</button>
                </div>`;
            }

            // Consumes (from building input storage only)
            if (Object.keys(info.consumes).length > 0) {
                for (const [resId, qty] of Object.entries(info.consumes)) {
                    const r = findResource(resId);
                    const rName = r ? r.name : resId;
                    const bldSupply = (bld.inventory && bld.inventory[resId]) || 0;
                    const townSupply = (town && town.market && town.market.supply[resId]) || 0;
                    const supplyColor = bldSupply >= qty ? '#55a868' : '#c44e52';
                    const daysLeft = qty > 0 ? Math.floor(bldSupply / qty) : 0;
                    html += `<div style="font-size:0.78rem;">⚙️ Consumes: ${qty} ${rName}/day <span style="color:${supplyColor};">— 📥 ${bldSupply} in storage</span>`;
                    if (daysLeft > 0 && daysLeft < 999) html += ` <span style="font-size:0.68rem;color:#aaa;">(~${daysLeft} days)</span>`;
                    if (bldSupply < qty) html += ` <span style="font-size:0.68rem;color:#aaa;">(market has ${Math.floor(townSupply)}${bld.autoBuy ? ' — auto-buy on' : ''})</span>`;
                    html += `</div>`;
                }
            }

            // Produces
            html += `<div style="font-size:0.78rem;">🔨 Produces: ${info.dailyOutput} ${prodName}/day</div>`;

            // Quality crafting chance display
            if (info.qualityChance) {
                var _qcHtml = '<div style="font-size:0.75rem;margin-top:4px;padding:4px 6px;background:rgba(100,60,200,0.15);border:1px solid rgba(120,80,220,0.3);border-radius:4px;">';
                _qcHtml += '🎲 <b>Quality Chance:</b> ';
                if (info.qualityChance.excellent != null) {
                    var _excColor = info.qualityChance.excellent >= 40 ? '#a855f7' : info.qualityChance.excellent >= 20 ? '#c084fc' : '#9ca3af';
                    _qcHtml += '<span style="color:' + _excColor + ';">🟣 Excellent: ' + info.qualityChance.excellent + '%</span>';
                    _qcHtml += ' · ';
                    var _goodColor = info.qualityChance.good >= 60 ? '#3b82f6' : info.qualityChance.good >= 40 ? '#60a5fa' : '#9ca3af';
                    _qcHtml += '<span style="color:' + _goodColor + ';">🔵 Good: ' + info.qualityChance.good + '% (if exc. fails)</span>';
                } else if (info.qualityChance.good != null) {
                    var _goodColor2 = info.qualityChance.good >= 60 ? '#3b82f6' : info.qualityChance.good >= 40 ? '#60a5fa' : '#9ca3af';
                    _qcHtml += '<span style="color:' + _goodColor2 + ';">🔵 Good: ' + info.qualityChance.good + '%</span>';
                }
                _qcHtml += '</div>';
                html += _qcHtml;
            }

            // Output rate breakdown
            var _lvlMod = (1 + ((bld.level || 1) - 1) * 0.10).toFixed(2);
            var _skillMod = info.workerSkillMod ? info.workerSkillMod.toFixed(2) : '1.00';
            html += `<div style="font-size:0.72rem;color:#aaa;margin-top:4px;">Output: ${bt.rate} base × ${info.workerFraction.toFixed(2)} workers × ${info.seasonMod} season × ${_lvlMod} level × ${info.prodBonus.toFixed(2)} bonus × ${_skillMod} skill = ${info.dailyOutput}</div>`;

            // Current storage — show ALL tiers combined (weight-aware)
            var bldStorageCap = Math.floor((bt.storage || 0) * (1 + (((bld.level || 1) - 1) * 0.50)));
            if (bldStorageCap > 0) {
                // v9p33river97: removed the misleading aggregated "Building
                // Storage: N items - X/Y wt" line. Buildings actually have
                // separate Output Storage and Input Storage (each rendered
                // below with their own weight bars). The combined line was
                // computing weight as items × outputProductWeight which gave
                // wrong totals (e.g. 18 items × 5 = 90 wt vs the real 39 wt
                // split across input + output).
                if (info.storedByTier && Object.keys(info.storedByTier).length > 0) {
                    var _tierParts = [];
                    for (var _tierKey in info.storedByTier) {
                        var _tierRes = (typeof findResource !== 'undefined') ? findResource(_tierKey) : null;
                        var _tierName = _tierRes ? _tierRes.name : _tierKey;
                        var _tierIcon = _tierRes ? (_tierRes.icon || '') : '';
                        _tierParts.push(_tierIcon + ' ' + info.storedByTier[_tierKey] + ' ' + _tierName);
                    }
                    html += `<div style="font-size:0.72rem;color:#aaa;margin-top:2px;">${_tierParts.join(' · ')}</div>`;
                }
            } else {
                html += `<div style="font-size:0.78rem;margin-top:4px;">📋 Current Storage: ${info.storedAllTiers} items</div>`;
                if (info.storedByTier && Object.keys(info.storedByTier).length > 0) {
                    var _tierParts2 = [];
                    for (var _tierKey2 in info.storedByTier) {
                        var _tierRes2 = (typeof findResource !== 'undefined') ? findResource(_tierKey2) : null;
                        var _tierName2 = _tierRes2 ? _tierRes2.name : _tierKey2;
                        _tierParts2.push(info.storedByTier[_tierKey2] + ' ' + _tierName2);
                    }
                    html += `<div style="font-size:0.72rem;color:#aaa;margin-top:2px;">${_tierParts2.join(' · ')}</div>`;
                }
            }

            // Collect buttons — one per tier that has stock
            if (info.storedAllTiers > 0 && bld.townId === Player.townId) {
                html += `<div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:6px;">`;
                for (var _colKey in info.storedByTier) {
                    var _colQty = info.storedByTier[_colKey];
                    var _colRes = (typeof findResource !== 'undefined') ? findResource(_colKey) : null;
                    var _colName = _colRes ? _colRes.name : _colKey;
                    html += `<button class="btn-trade buy" style="font-size:0.7rem;" data-action="collectOutputUI" data-id="${bld.id}" data-val="${_colKey}" data-qty="${_colQty}">Collect ${_colName} (${_colQty})</button>`;
                }
                html += `</div>`;
            }

            html += '</div>';
        }

        // RETAIL section (for retail/service buildings)
        if (bt.retailConfig) {
            var rc = bt.retailConfig;
            var retailStatus = Player.getRetailBuildingStatus ? Player.getRetailBuildingStatus(bld.id) : null;
            var stockTotal = retailStatus ? retailStatus.stockTotal : 0;
            var maxStock = retailStatus ? retailStatus.maxStock : (rc.maxStock || 50);
            var markup = retailStatus ? retailStatus.markup : ((rc.markup || 1.5).toFixed(1));
            var revenue = bld.retailRevenue || 0;
            var totalSold = bld.retailTotalSold || 0;
            var totalEarned = bld.retailTotalEarned || 0;
            var stockPct = maxStock > 0 ? Math.round(stockTotal / maxStock * 100) : 0;
            var stockColor = stockPct > 60 ? '#55a868' : stockPct > 20 ? 'var(--gold)' : 'var(--danger)';

            html += '<div style="padding:8px;border:1px solid var(--border);border-radius:4px;margin-bottom:8px;">';
            html += '<div style="font-weight:bold;font-size:0.8rem;margin-bottom:6px;">🏪 RETAIL</div>';

            // Revenue display
            html += '<div style="display:flex;justify-content:space-between;font-size:0.78rem;margin-bottom:4px;">';
            html += '<span>💰 Uncollected Revenue: <strong style="color:var(--gold);">' + Math.floor(revenue).toLocaleString() + 'g</strong></span>';
            html += '<span style="color:#888;">Lifetime: ' + Math.floor(totalEarned).toLocaleString() + 'g (' + totalSold + ' sales)</span>';
            html += '</div>';

            if (revenue > 0 && bld.townId === Player.townId) {
                html += '<button class="btn-trade buy" style="font-size:0.7rem;margin-bottom:6px;" data-action="collectRetailRevenueUI" data-id="' + bld.id + '">💰 Collect ' + Math.floor(revenue).toLocaleString() + 'g</button> ';
            }

            // Markup info
            // v9p33river315: configs use maxCustomersPerDay (config.js:2079+),
            // not customersPerDay. Was always falling back to 5.
            html += '<div style="font-size:0.75rem;color:#aaa;margin-bottom:4px;">📊 Markup: ' + (typeof markup === 'number' ? markup.toFixed(1) : markup) + 'x | Motivation: ' + (rc.motivation || 'need') + ' | Max Customers: ' + (rc.maxCustomersPerDay || rc.customersPerDay || 5) + '/day</div>';

            // Stock level bar
            html += '<div style="font-size:0.78rem;margin-bottom:4px;">📦 Stock: <span style="color:' + stockColor + ';">' + stockTotal + '/' + maxStock + '</span></div>';
            html += '<div style="background:#333;border-radius:3px;height:8px;margin-bottom:6px;overflow:hidden;">';
            html += '<div style="background:' + stockColor + ';height:100%;width:' + stockPct + '%;transition:width 0.3s;"></div></div>';

            // Current stock items
            if (retailStatus && retailStatus.stock && retailStatus.stock.length > 0) {
                html += '<div style="font-size:0.75rem;margin-bottom:6px;">';
                for (var si = 0; si < retailStatus.stock.length; si++) {
                    var item = retailStatus.stock[si];
                    html += '<span style="margin-right:8px;">' + (item.icon || '📦') + ' ' + item.name + ': ' + item.qty + '</span>';
                }
                html += '</div>';
            }

            // Stock/Unstock controls — only when player is in same town
            if (bld.townId === Player.townId) {
                var acceptsGoods = rc.acceptsGoods || [];
                html += '<div style="margin-top:4px;"><strong style="font-size:0.75rem;">Stock Items:</strong></div>';
                html += '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px;">';
                for (var gi = 0; gi < acceptsGoods.length; gi++) {
                    var goodId = acceptsGoods[gi];
                    var goodRes = findResource(goodId);
                    var goodName = goodRes ? goodRes.name : goodId;
                    var goodIcon = goodRes ? (goodRes.icon || '📦') : '📦';
                    var playerHas = (Player.inventory && Player.inventory[goodId]) || 0;
                    var inStock = (bld.retailStock && bld.retailStock[goodId]) || 0;
                    if (playerHas > 0 || inStock > 0) {
                        html += '<div style="border:1px solid #444;border-radius:4px;padding:3px 6px;font-size:0.72rem;background:rgba(0,0,0,0.2);">';
                        html += goodIcon + ' ' + goodName + ' (inv:' + playerHas + ' stock:' + inStock + ') ';
                        if (playerHas > 0) {
                            html += '<button class="btn-trade buy" style="font-size:0.65rem;padding:1px 6px;" data-action="stockRetailUI" data-id="' + bld.id + '" data-val="' + goodId + '" data-qty="5">+5</button> ';
                            html += '<button class="btn-trade buy" style="font-size:0.65rem;padding:1px 6px;" data-action="stockRetailUI" data-id="' + bld.id + '" data-val="' + goodId + '" data-qty="' + playerHas + '">All</button> ';
                        }
                        if (inStock > 0) {
                            html += '<button class="btn-trade sell" style="font-size:0.65rem;padding:1px 6px;" data-action="unstockRetailUI" data-id="' + bld.id + '" data-val="' + goodId + '" data-qty="' + inStock + '">↩</button>';
                        }
                        html += '</div>';
                    }
                }
                html += '</div>';

                // Show items player has that could be stocked but aren't shown yet
                var unstockedGoods = acceptsGoods.filter(function(gid) {
                    var playerQ = (Player.inventory && Player.inventory[gid]) || 0;
                    var stockQ = (bld.retailStock && bld.retailStock[gid]) || 0;
                    return playerQ === 0 && stockQ === 0;
                });
                if (unstockedGoods.length > 0) {
                    html += '<div style="font-size:0.7rem;color:#666;margin-top:4px;">Also accepts: ' + unstockedGoods.map(function(g) { var r = findResource(g); return r ? r.name : g; }).join(', ') + '</div>';
                }
            }

            // Service building info
            if (rc.serviceType) {
                html += '<div style="font-size:0.75rem;color:#aaa;margin-top:6px;">🏥 Service: ' + (rc.serviceType || 'treatment') + ' | Fee: ' + (rc.serviceFee || 5) + 'g/customer</div>';
                if (rc.consumesPerService) {
                    var consumeList = [];
                    for (var cKey in rc.consumesPerService) {
                        consumeList.push(rc.consumesPerService[cKey] + ' ' + cKey);
                    }
                    html += '<div style="font-size:0.72rem;color:#888;">Consumes per service: ' + consumeList.join(', ') + '</div>';
                }
            }

            html += '</div>';
        }

        // MEDICAL PREPAREDNESS section (for hospitals/clinics)
        if (bld.type === 'hospital' || bld.type === 'clinic') {
            html += _buildMedicalSection(bld, bt, town);
        }


        // ── BUILDING STORAGE (output + input as INDEPENDENT pools) ──
        if (bld.townId === Player.townId) {
            var _bldCap = Math.floor((bt.storage || 0) * (1 + (((bld.level || 1) - 1) * 0.50)));
            // Build output goods set — but exclude anything the active recipe consumes
            var _producesId = bt.produces || null;
            var _outputSet2 = {};
            if (_producesId) _outputSet2[_producesId] = true;
            if (bt.canProduce) { for (var _ci0 = 0; _ci0 < bt.canProduce.length; _ci0++) _outputSet2[bt.canProduce[_ci0]] = true; }
            // Gather consumed goods set for this building's active recipe
            var _consumedSet = Player.getBuildingConsumedGoods ? Player.getBuildingConsumedGoods(bt) : {};
            // Consumed goods are INPUTS, not outputs — remove from output set
            for (var _ck in _consumedSet) { delete _outputSet2[_ck]; }
            // Calculate output and input weights separately
            var _outputWeight = 0;
            var _inputWeight = 0;
            if (bld.inventory) {
                for (var _bk in bld.inventory) {
                    var _br = findResource(_bk);
                    var _bw = (bld.inventory[_bk] || 0) * (_br ? (_br.weight || 1) : 1);
                    if (_outputSet2[_bk]) _outputWeight += _bw;
                    else _inputWeight += _bw;
                }
            }
            // v9p33river111: include the pending transfer buffer in Output Storage
            // so the displayed total matches the "Deliver Now" button (the
            // transfer buffer is logically output that hasn't shipped yet).
            var _xferBuffer = bld._transferBuffer || 0;
            if (_xferBuffer > 0 && _producesId) {
                var _xRes = findResource(_producesId);
                _outputWeight += _xferBuffer * (_xRes ? (_xRes.weight || 1) : 1);
            }
            var _inputOnly = bld.inputOnly !== false;
            if (_bldCap > 0) {
                html += '<div style="padding:8px;border:1px solid var(--border);border-radius:4px;margin-bottom:8px;">';
                html += '<div style="font-weight:bold;font-size:0.85rem;margin-bottom:4px;">📦 BUILDING STORAGE</div>';

                // ── Output Storage (independent pool) ──
                if (_producesId) {
                    html += '<div style="margin-bottom:6px;">';
                    html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:2px;">';
                    html += '<span style="font-size:0.78rem;font-weight:bold;color:#7cb342;">📤 Output Storage</span>';
                    html += '<span style="font-size:0.72rem;color:#aaa;">' + Math.round(_outputWeight) + ' / ' + _bldCap + ' (' + Math.round(Math.max(0, _bldCap - _outputWeight)) + ' free)</span>';
                    html += '</div>';
                    var _outputPct = _bldCap > 0 ? Math.min(100, Math.round((_outputWeight / _bldCap) * 100)) : 0;
                    var _outputBarColor = _outputPct >= 90 ? '#e74c3c' : _outputPct >= 60 ? '#e67e22' : '#7cb342';
                    html += '<div style="height:5px;background:#333;border-radius:3px;margin-bottom:4px;"><div style="height:100%;width:' + _outputPct + '%;background:' + _outputBarColor + ';border-radius:3px;"></div></div>';
                    var _hasOutput = false;
                    for (var _ok in _outputSet2) {
                        var _oQty = (bld.inventory && bld.inventory[_ok]) || 0;
                        if (_oQty <= 0) continue;
                        _hasOutput = true;
                        var _or = findResource(_ok);
                        var _oName = _or ? ((_or.icon || '') + ' ' + _or.name) : _ok;
                        html += '<div style="display:flex;align-items:center;gap:6px;margin:2px 0;font-size:0.78rem;">';
                        html += '<span style="min-width:130px;">' + _oName + ': ' + _oQty + '</span>';
                        html += '<button class="btn-trade buy" style="font-size:0.65rem;padding:1px 6px;" data-action="collectOutputUI" data-id="' + bld.id + '" data-val="' + _ok + '" data-qty="1">Take 1</button>';
                        if (_oQty >= 5) html += '<button class="btn-trade buy" style="font-size:0.65rem;padding:1px 6px;" data-action="collectOutputUI" data-id="' + bld.id + '" data-val="' + _ok + '" data-qty="5">5</button>';
                        html += '<button class="btn-trade buy" style="font-size:0.65rem;padding:1px 6px;" data-action="collectOutputUI" data-id="' + bld.id + '" data-val="' + _ok + '" data-qty="' + _oQty + '">All</button>';
                        html += '</div>';
                    }
                    if (!_hasOutput && _xferBuffer <= 0) html += '<div style="font-size:0.72rem;color:#888;">No output stored.</div>';
                    // v9p33river111: show pending transfer buffer so the displayed
                    // total matches the "Deliver Now" button count.
                    if (_xferBuffer > 0 && _producesId) {
                        var _xRes2 = findResource(_producesId);
                        var _xName2 = _xRes2 ? ((_xRes2.icon || '') + ' ' + _xRes2.name) : _producesId;
                        html += '<div style="font-size:0.72rem;color:#aaa;margin-top:2px;">🚚 Pending delivery: ' + _xferBuffer + ' ' + _xName2 + '</div>';
                    }
                    if (_outputPct >= 100 && !bld.transferEnabled) {
                        html += '<div style="font-size:0.72rem;color:#7cb342;margin-top:2px;">💰 Storage full — overflow auto-selling to market</div>';
                    }
                    html += '</div>';
                }

                // ── Input Storage (independent pool — same cap as output) ──
                var _inputCap = _bldCap;

                html += '<div style="margin-bottom:6px;">';
                html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap;">';
                html += '<span style="font-size:0.78rem;font-weight:bold;color:#64b5f6;">📥 Input Storage</span>';
                html += '<span style="font-size:0.72rem;color:#aaa;">' + Math.round(_inputWeight) + ' / ' + Math.round(_inputCap) + ' (' + Math.round(Math.max(0, _inputCap - _inputWeight)) + ' free)</span>';
                if (_producesId) {
                    html += '<label style="font-size:0.68rem;color:#aaa;cursor:pointer;"><input type="checkbox" ' + (_inputOnly ? 'checked' : '') + ' onchange="(function(){var r=Player.toggleBuildingInputOnly(\'' + bld.id + '\');UI.toast(r.message,r.success?\'success\':\'warning\');UI.showBuildingDetail(\'' + bld.id + '\');})()" style="margin-right:3px;vertical-align:middle;"> Only accept consumed goods</label>';
                }
                html += '</div>';
                // Capacity bar
                var _inputPct = _inputCap > 0 ? Math.min(100, Math.round((_inputWeight / _inputCap) * 100)) : 0;
                var _inputBarColor = _inputPct >= 90 ? '#e74c3c' : _inputPct >= 60 ? '#e67e22' : '#64b5f6';
                html += '<div style="height:5px;background:#333;border-radius:3px;margin-bottom:6px;"><div style="height:100%;width:' + _inputPct + '%;background:' + _inputBarColor + ';border-radius:3px;"></div></div>';

                // Items currently in input storage — withdraw section
                var _hasInput = false;
                if (bld.inventory) {
                    for (var _ik in bld.inventory) {
                        if (_outputSet2[_ik] || bld.inventory[_ik] <= 0) continue;
                        _hasInput = true;
                        var _ir = findResource(_ik);
                        var _iName = _ir ? ((_ir.icon || '') + ' ' + _ir.name) : _ik;
                        var _isConsumed = _consumedSet[_ik];
                        var _iQty = bld.inventory[_ik];
                        html += '<div style="display:flex;align-items:center;gap:4px;margin:3px 0;font-size:0.78rem;flex-wrap:wrap;">';
                        html += '<span style="min-width:120px;">' + _iName + ': <strong>' + _iQty + '</strong>' + (_isConsumed ? ' <span style="color:#7cb342;font-size:0.6rem;">(used)</span>' : '') + '</span>';
                        html += '<span style="display:flex;gap:2px;align-items:center;">';
                        var _wQtys = [1, 5, 10];
                        for (var _qi = 0; _qi < _wQtys.length; _qi++) {
                            if (_iQty >= _wQtys[_qi]) html += '<button class="btn-trade buy" style="font-size:0.6rem;padding:1px 5px;" data-action="_bldWithdraw" data-id="' + bld.id + '" data-val="' + _ik + '" data-qty="' + _wQtys[_qi] + '">' + _wQtys[_qi] + '</button>';
                        }
                        html += '<button class="btn-trade buy" style="font-size:0.6rem;padding:1px 5px;" data-action="_bldWithdraw" data-id="' + bld.id + '" data-val="' + _ik + '" data-qty="' + _iQty + '">All</button>';
                        html += '</span>';
                        html += '</div>';
                    }
                }
                if (!_hasInput) html += '<div style="font-size:0.72rem;color:#888;">No input items stored.</div>';

                // Deposit from player inventory + town storage
                if (bld.townId === Player.townId) {
                    html += '<div style="margin-top:8px;border-top:1px solid var(--border);padding-top:6px;">';
                    html += '<div style="font-size:0.72rem;font-weight:bold;color:#aaa;margin-bottom:4px;">📤 Deposit from Inventory / Town Storage</div>';
                    var _hasDepositable = false;
                    var _inv = Player.inventory || {};
                    var _townSt = (Player.state && Player.state.townStorage && Player.state.townStorage[bld.townId]) || {};
                    // Merge keys from both inventory and town storage
                    var _allDepKeys = {};
                    for (var _ik2 in _inv) { if (_inv[_ik2] > 0) _allDepKeys[_ik2] = true; }
                    for (var _tk2 in _townSt) { if (_townSt[_tk2] > 0) _allDepKeys[_tk2] = true; }
                    for (var _dk in _allDepKeys) {
                        var _invQty = _inv[_dk] || 0;
                        var _tsQty = _townSt[_dk] || 0;
                        var _totalQty = _invQty + _tsQty;
                        if (_totalQty <= 0) continue;
                        var _dr = findResource(_dk);
                        if (!_dr) continue;
                        // Filter: livestock only to livestock buildings, horses only to horse buildings
                        if (_dr.category === 'livestock') continue;
                        if (_dk === 'horses') continue;
                        // Input-only filter: allow consumed goods (from all available product recipes)
                        if (_inputOnly && _producesId && !_consumedSet[_dk]) {
                            // Fallback: also check bt.consumes directly in case getBuildingConsumedGoods missed it
                            var _directConsumed = bt.consumes && bt.consumes[_dk];
                            if (!_directConsumed) continue;
                        }
                        // Skip output goods (these belong in output storage)
                        if (_outputSet2[_dk]) continue;
                        _hasDepositable = true;
                        var _dName = (_dr.icon || '') + ' ' + _dr.name;
                        var _dWeight = _dr.weight || 1;
                        var _dMaxFit = _inputCap > _inputWeight ? Math.floor((_inputCap - _inputWeight) / _dWeight) : 0;
                        var _dMax = Math.min(_totalQty, _dMaxFit);
                        var _dIsConsumed = _consumedSet[_dk];
                        var _srcNote = _invQty > 0 && _tsQty > 0 ? ' <span style="color:#aaa;font-size:0.6rem;">(' + _invQty + ' inv + ' + _tsQty + ' storage)</span>' : (_tsQty > 0 && _invQty === 0 ? ' <span style="color:#64b5f6;font-size:0.6rem;">(town storage)</span>' : '');
                        html += '<div style="display:flex;align-items:center;gap:4px;margin:3px 0;font-size:0.78rem;flex-wrap:wrap;">';
                        html += '<span style="min-width:120px;">' + _dName + ': ' + _totalQty + _srcNote + (_dIsConsumed ? ' <span style="color:#7cb342;font-size:0.6rem;">(used)</span>' : '') + '</span>';
                        html += '<span style="display:flex;gap:2px;align-items:center;">';
                        var _sQtys = [1, 5, 10, 25];
                        for (var _si = 0; _si < _sQtys.length; _si++) {
                            if (_dMax >= _sQtys[_si]) html += '<button class="btn-trade sell" style="font-size:0.6rem;padding:1px 5px;" data-action="_bldDeposit" data-id="' + bld.id + '" data-val="' + _dk + '" data-qty="' + _sQtys[_si] + '">' + _sQtys[_si] + '</button>';
                        }
                        if (_dMax > 0) html += '<button class="btn-trade sell" style="font-size:0.6rem;padding:1px 5px;" data-action="_bldDeposit" data-id="' + bld.id + '" data-val="' + _dk + '" data-qty="' + _dMax + '">All (' + _dMax + ')</button>';
                        html += '</span>';
                        html += '</div>';
                    }
                    if (!_hasDepositable) html += '<div style="font-size:0.72rem;color:#888;">Nothing to deposit' + (_inputOnly && _producesId ? ' (input filter on)' : '') + '</div>';
                    html += '</div>';
                }
                html += '</div>';
                html += '</div>';
            }
        }

        // WORKERS section
        html += `<div style="padding:8px;border:1px solid var(--border);border-radius:4px;margin-bottom:8px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                <span style="font-weight:bold;font-size:0.8rem;">👷 WORKERS (${info.workerCount}/${info.workerMax} staffed)</span>
                <label style="font-size:0.7rem;color:var(--text-dim);cursor:pointer;">
                    <input type="checkbox" ${Player.autoRaiseWages ? 'checked' : ''} onchange="Player.autoRaiseWages=this.checked;"> Auto-raise wages
                </label>
            </div>`;

        if (bld.workers.length > 0) {
            for (const wId of bld.workers) {
                const person = Engine.findPerson(wId);
                const pName = person ? (person.firstName + ' ' + person.lastName) : wId;
                const skill = (person && person.workerSkill != null) ? person.workerSkill : 0;
                const skillDisplay = Math.floor(skill * 10) / 10; // show 1 decimal
                let skillLabel = 'Unskilled';
                if (skill >= 81) skillLabel = 'Master';
                else if (skill >= 61) skillLabel = 'Expert';
                else if (skill >= 31) skillLabel = 'Skilled';
                else if (skill >= 10) skillLabel = 'Trained';

                var _wSat = typeof Player.getWorkerSatisfaction === 'function' ? Player.getWorkerSatisfaction(wId) : 50;
                var _wSatRound = Math.round(_wSat);
                var _wSatColor = _wSat >= 70 ? '#55a868' : _wSat >= 40 ? '#ccb974' : '#c44e52';
                var _wSatIcon = _wSat >= 70 ? '😊' : _wSat >= 40 ? '😐' : _wSat >= 20 ? '😠' : '🤬';

                html += `<div style="padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
                    <div style="display:flex;justify-content:space-between;align-items:center;font-size:0.78rem;">
                        <span>• ${pName} — Skill: ${skillDisplay} (${skillLabel})</span>
                        <span style="font-size:0.72rem;">${_wSatIcon} <span style="color:${_wSatColor};font-weight:bold;">${_wSatRound}%</span></span>
                    </div>
                    <div style="height:3px;background:#333;border-radius:2px;margin:2px 0;overflow:hidden;">
                        <div style="width:${_wSatRound}%;height:100%;background:${_wSatColor};"></div>
                    </div>
                    <div style="display:flex;gap:3px;flex-wrap:wrap;margin-top:3px;">
                        <button class="btn btn-sm" style="font-size:0.65rem;padding:1px 5px;" data-action="praiseWorkerAction" data-id="${wId}" data-val="${bld.id}">👏 Praise</button>
                        <button class="btn btn-sm" style="font-size:0.65rem;padding:1px 5px;" data-action="giveWorkerDayOffAction" data-id="${wId}" data-val="${bld.id}">🏖️ Day Off</button>
                        <button class="btn btn-sm" style="font-size:0.65rem;padding:1px 5px;" data-action="giveWorkerBonusAction" data-id="${wId}" data-val="${bld.id}">💰 Bonus</button>
                        <button class="btn btn-sm" style="font-size:0.65rem;padding:1px 5px;" data-action="giveWorkerRaiseAction" data-id="${wId}" data-val="${bld.id}">⬆️ Raise</button>
                        <button class="btn-trade sell" style="font-size:0.65rem;padding:1px 5px;" data-action="removeWorkerUI" data-id="${wId}" data-val="${bld.id}">✕ Remove</button>
                    </div>
                </div>`;
            }
        } else {
            html += '<div style="font-size:0.78rem;color:#888;">No workers assigned.</div>';
        }

        // Assign worker button
        if (info.workerCount < info.workerMax) {
            const unassigned = Player.employees.filter(eId => {
                for (const b of Player.buildings) {
                    if (b.workers.includes(eId)) return false;
                }
                return true;
            });
            if (unassigned.length > 0) {
                html += `<div style="margin-top:6px;"><select id="assignWorkerSelect" style="font-size:0.75rem;padding:2px 4px;margin-right:4px;">`;
                for (const eId of unassigned) {
                    const p = Engine.findPerson(eId);
                    const nm = p ? (p.firstName + ' ' + p.lastName) : eId;
                    html += `<option value="${eId}">${nm}</option>`;
                }
                html += `</select><button class="btn-trade buy" style="font-size:0.7rem;" data-action="assignWorkerUI" data-id="${bld.id}">+ Assign</button></div>`;
            } else {
                html += `<div style="font-size:0.72rem;color:#aaa;margin-top:4px;">No unassigned employees. <button class="btn-trade" style="font-size:0.7rem;" data-action="openHireDialog">Hire Workers</button></div>`;
            }
        }

        html += '</div>';

        // SUPPLY INPUTS section
        if (Object.keys(info.consumes).length > 0) {
            html += `<div style="padding:8px;border:1px solid var(--border);border-radius:4px;margin-bottom:8px;">
                <div style="font-weight:bold;font-size:0.8rem;margin-bottom:6px;">📥 SUPPLY INPUTS</div>`;

            for (const [resId, qty] of Object.entries(info.consumes)) {
                const r = findResource(resId);
                const rName = r ? r.name : resId;
                const townSupply = (town && town.market && town.market.supply[resId]) || 0;
                const playerHas = Player.inventory[resId] || 0;

                html += `<div style="font-size:0.78rem;margin-bottom:4px;">${rName}: Town has ${Math.floor(townSupply)} | You carry ${playerHas}</div>`;
                if (playerHas > 0 && bld.townId === Player.townId) {
                    const supplyQty = Math.min(5, playerHas);
                    html += `<div style="display:flex;gap:4px;margin-bottom:4px;">
                        <button class="btn-trade buy" style="font-size:0.7rem;" data-action="supplyBuildingUI" data-id="${bld.id}" data-val="${resId}" data-qty="${supplyQty}">Supply ${supplyQty}</button>
                        <button class="btn-trade buy" style="font-size:0.7rem;" data-action="supplyBuildingUI" data-id="${bld.id}" data-val="${resId}" data-qty="${playerHas}">Supply All (${playerHas})</button>
                    </div>`;
                }
            }

            // Auto-buy toggle
            html += `<div style="margin-top:6px;font-size:0.78rem;">
                <label style="cursor:pointer;"><input type="checkbox" ${info.autoBuy ? 'checked' : ''} onchange="UI.toggleAutoBuyUI('${bld.id}')"> Auto-buy inputs from market</label>
            </div>`;

            html += '</div>';
        }

        // ── SUPPLY CHAIN TRANSFER ──
        if (bt.produces) {
            const targets = Player.getTransferTargets(buildingId);
            const currentTarget = bld.transferTarget;
            const transferEnabled = bld.transferEnabled || false;
            const hasGuild = Player.hasTransportGuild(bld.townId);
            
            html += '<div style="padding:8px;border:1px solid var(--border);border-radius:4px;margin-bottom:8px;">';
            html += '<div style="font-weight:bold;font-size:0.85rem;margin-bottom:6px;">🚚 SUPPLY CHAIN TRANSFER</div>';
            
            if (info.delivering) {
                html += '<div style="color:#c4a35a;font-size:0.8rem;">📦 Workers delivering goods... (' + info.deliveryDaysLeft + ' days left)</div>';
            }
            
            html += '<div style="font-size:0.75rem;color:#aaa;margin-bottom:6px;">';
            if (hasGuild) {
                html += '✅ Transport Guild active — instant transfers';
            } else {
                html += '⚠️ No Transport Guild — workers will pause production for ' + (CONFIG.TRANSFER_WORKER_DELIVERY_DAYS || 1) + ' day to deliver when output storage is full';
            }
            html += '</div>';
            
            html += '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">';
            html += '<span style="font-size:0.8rem;">Send ' + bt.produces + ' to:</span>';
            html += '<select id="transferTargetSelect" style="padding:4px 8px;background:#2a2520;color:#e8dcc8;border:1px solid #555;border-radius:4px;font-size:0.8rem;">';
            html += '<option value="">-- None (Building Storage) --</option>';
            for (const t of targets) {
                var selected = currentTarget === t.id ? 'selected' : '';
                var warning = !t.makesSense ? ' ⚠️' : '';
                var label;
                if (t.id === 'player') label = '🧑 ' + t.name;
                else if (t.id === 'warehouse') label = '📦 ' + t.name;
                else if (t.id === 'market') label = '🏪 ' + t.name;
                else if (t.isWarehouse) label = '📦 ' + t.name + ' Lv.' + t.level;
                else label = '🏭 ' + t.name + ' Lv.' + t.level + warning;
                html += '<option value="' + t.id + '" ' + selected + '>' + label + '</option>';
            }
            html += '</select>';
            html += '<button class="btn-small" data-action="setTransferTarget" data-id="' + buildingId + '" style="font-size:0.75rem;">Set</button>';
            if (transferEnabled) {
                html += '<button class="btn-small" data-action="clearTransfer" data-id="' + buildingId + '" style="font-size:0.75rem;background:rgba(200,60,50,0.3);">Clear</button>';
            }
            html += '</div>';
            
            if (transferEnabled && currentTarget) {
                var targetName = currentTarget === 'player' ? 'Your Inventory' : currentTarget === 'warehouse' ? 'Town Storage' : currentTarget === 'market' ? 'Town Market' : '?';
                if (currentTarget !== 'player' && currentTarget !== 'warehouse' && currentTarget !== 'market') {
                    var tb = Player.buildings.find(function(b) { return b.id === currentTarget; });
                    if (tb) {
                        var tbt = Engine.findBuildingType(tb.type);
                        targetName = tbt ? tbt.name : currentTarget;
                    }
                }
                html += '<div style="font-size:0.8rem;color:#55a868;margin-top:4px;">✅ Transferring ' + bt.produces + ' → ' + targetName + '</div>';

                // Deliver Now button
                var _bufferAmt = info.transferBuffer || 0;
                var _bldInvAmt = (bld.inventory && bld.inventory[bt.produces]) || 0;
                var _deliverable = _bufferAmt + _bldInvAmt;
                html += '<div style="margin-top:6px;">';
                if (_deliverable > 0) {
                    html += '<button class="btn-medieval" data-action="deliverNowAction" data-id="' + buildingId + '" style="font-size:0.75rem;padding:4px 12px;background:rgba(85,168,104,0.2);border-color:rgba(85,168,104,0.4);">📦 Deliver Now (' + _deliverable + ' ' + bt.produces + ')</button>';
                } else {
                    html += '<button class="btn-medieval" disabled style="font-size:0.75rem;padding:4px 12px;opacity:0.5;">📦 Deliver Now (nothing to deliver)</button>';
                }
                html += '</div>';
            }
            
            html += '</div>';
        }

        // UPGRADE section
        if (bt.cost) {
            var currentLevel = bld.level || 1;
            if (currentLevel >= 5) {
                html += `<div style="padding:8px;border:1px solid var(--border);border-radius:4px;margin-bottom:8px;">
                    <div style="font-weight:bold;font-size:0.8rem;margin-bottom:6px;">⬆️ UPGRADE</div>
                    <div style="font-size:0.78rem;color:#55a868;">✅ Maximum level reached (Level 5)</div>
                </div>`;
            } else {
                var upgradeInfo = (Player.getUpgradeCost) ? Player.getUpgradeCost(bld.id) : null;
                var upgradeCost = upgradeInfo ? upgradeInfo.cost : '?';
                const nextLevel = currentLevel + 1;
                var curWorkerMax = bt.workers + (currentLevel - 1);
                var nextWorkerMax = bt.workers + (nextLevel - 1);
                var curStorageCap = Math.floor((bt.storage || 0) * (1 + ((currentLevel - 1) * 0.50)));
                var nextStorageCap = Math.floor((bt.storage || 0) * (1 + ((nextLevel - 1) * 0.50)));

                html += `<div style="padding:8px;border:1px solid var(--border);border-radius:4px;margin-bottom:8px;">
                    <div style="font-weight:bold;font-size:0.8rem;margin-bottom:6px;">⬆️ UPGRADE (${currentLevel}/5)</div>
                    <div style="font-size:0.78rem;">Level ${currentLevel} → ${nextLevel} (Cost: ${upgradeCost}g)</div>
                    <div style="font-size:0.72rem;color:#aaa;">+10% production output per level</div>
                    <div style="font-size:0.72rem;color:#aaa;">Workers: ${curWorkerMax} → ${nextWorkerMax} slots</div>`;
                if (bt.storage) {
                    html += `<div style="font-size:0.72rem;color:#aaa;">Storage: ${curStorageCap} → ${nextStorageCap} units</div>`;
                }
                html += `<button class="btn-trade buy" style="font-size:0.7rem;margin-top:4px;" data-action="upgradeBuildingUI" data-id="${bld.id}">⬆️ Upgrade (${upgradeCost}g)</button>
                </div>`;
            }
        }

        // MAINTENANCE section
        const needsRepair = bld.condition === 'used' || bld.condition === 'breaking' || bld.condition === 'destroyed';
        const repairCostEst = bt ? (bld.condition === 'destroyed' ? Math.floor(bt.cost * 0.5) : bld.condition === 'breaking' ? Math.floor(bt.cost * 0.3) : Math.floor(bt.cost * 0.2)) : '?';
        const warehouseTypes = ['warehouse', 'warehouse_small', 'warehouse_large'];
        const day = Engine.getDay ? Engine.getDay() : 0;
        const isFireRepair = bld._fireRepairUntil && day < bld._fireRepairUntil;

        html += `<div style="padding:8px;border:1px solid var(--border);border-radius:4px;margin-bottom:8px;">
            <div style="font-weight:bold;font-size:0.8rem;margin-bottom:6px;">🔧 MAINTENANCE</div>`;
        if (isFireRepair) {
            var _frDaysLeft = bld._fireRepairUntil - day;
            html += `<div style="padding:6px;background:rgba(200,80,0,0.15);border:1px solid rgba(200,80,0,0.3);border-radius:4px;margin-bottom:6px;font-size:0.75rem;color:#e8a050;">🔥 <b>Fire Damage — Repairing</b> (${_frDaysLeft} day${_frDaysLeft !== 1 ? 's' : ''} remaining). Production paused.</div>`;
        }
        html += `<div style="display:flex;gap:6px;flex-wrap:wrap;">`;

        if (needsRepair) {
            html += `<button class="btn-trade buy" style="font-size:0.7rem;background:rgba(200,100,0,0.15);border-color:rgba(200,100,0,0.3);" data-action="repairBuilding" data-id="${bld.id}">🔨 Repair (${repairCostEst}g)</button>`;
        }
        html += `<button class="btn-trade ${bld.hasGuard ? 'sell' : 'buy'}" style="font-size:0.7rem;" data-action="toggleGuardAndRefresh" data-id="${bld.id}">
            ${bld.hasGuard ? '🛡️ Dismiss Guard' : '🛡️ Hire Guard (' + CONFIG.BUILDING_GUARD_COST_PER_SEASON + 'g/season)'}
        </button>`;
        if (!bld.lockedStorage) {
            html += `<button class="btn-trade buy" style="font-size:0.7rem;" data-action="buyLockedStorageAndRefresh" data-id="${bld.id}">🔒 Lock Storage (${CONFIG.BUILDING_LOCKED_STORAGE_COST}g)</button>`;
        }
        if (bt && bt.category === 'farm') {
            html += `<button class="btn-trade" style="font-size:0.7rem;${bld.fallow ? 'background:rgba(85,168,104,0.15);border-color:rgba(85,168,104,0.3);' : 'background:rgba(200,160,0,0.15);border-color:rgba(200,160,0,0.3);'}" data-action="toggleFarmFallowAndRefresh" data-id="${bld.id}">${bld.fallow ? '🌾 Resume Farming' : '🌿 Set Fallow'}</button>`;
        }
        if (warehouseTypes.includes(bld.type)) {
            html += `<button class="btn-trade buy" style="font-size:0.7rem;" data-action="openWarehouseSecurityDialog" data-id="${bld.id}">🔐 Security Upgrades</button>`;
        }

        // Farm/livestock conversion button
        if (bt && (Engine.isCropFarm(bld.type) || Engine.isLivestockFarm(bld.type)) && town && bld.townId === Player.townId) {
            var _convBldIdx = town.buildings.findIndex(function(b) { return b.ownerId === 'player' && b.type === bld.type; });
            if (_convBldIdx >= 0) {
                var _isCrop = Engine.isCropFarm(bld.type);
                var _curYear = Math.floor((Engine.getDay ? Engine.getDay() : 0) / (CONFIG.DAYS_PER_SEASON || 90));
                var _convYear = bld._conversionYear || -1;
                var _convCount = (_convYear === _curYear) ? (bld._conversionsThisYear || 0) : 0;
                var _freeMax = _isCrop ? (CONFIG.FARM_FREE_CONVERSIONS_PER_YEAR || 1) : 0;
                var _maxPer = _isCrop ? 999 : (CONFIG.LIVESTOCK_CONVERSIONS_PER_YEAR || 2);
                var _convHint = '';
                if (_isCrop && _convCount < _freeMax) {
                    _convHint = ' (FREE — ' + (_freeMax - _convCount) + ' left this year)';
                } else if (!_isCrop && _convCount < _maxPer) {
                    _convHint = ' (' + (_maxPer - _convCount) + '/' + _maxPer + ' left this year)';
                } else if (!_isCrop) {
                    _convHint = ' (none left this year)';
                }
                html += '<button class="btn-trade" style="font-size:0.7rem;background:rgba(100,160,220,0.15);border-color:rgba(100,160,220,0.3);" data-action="openFarmConvertUI" data-idx="' + _convBldIdx + '" data-id="' + bld.townId + '">🔄 Convert Farm Type' + _convHint + '</button>';
            }
        }

        // Demolish button (inside MAINTENANCE section)
        if (town && bld.townId === Player.townId) {
            var _demCost = Player.getLandCost ? Math.floor(Player.getLandCost(bld.townId) / 2) : 500;
            var _hasBp = (Player.inventory && Player.inventory.blasting_powder >= 1);
            var _hasDt = (Player.inventory && Player.inventory.demolition_tools >= 2);
            var _demReq = _hasBp ? '1 💥 blasting powder' : _hasDt ? '2 ⛏️ demolition tools' : '1 💥 blast powder or 2 ⛏️ demo tools';
            html += '<button class="btn-trade sell" style="font-size:0.7rem;background:rgba(200,50,50,0.15);border-color:rgba(200,50,50,0.3);" data-action="confirmDemolishUI" data-id="' + bld.id + '" data-val="' + bld.townId + '">💥 Demolish (' + _demCost + 'g + ' + _demReq + ')</button>';
        }

        // List building for sale button (inside MAINTENANCE section)
        html += '<button class="btn-trade" style="font-size:0.7rem;background:rgba(80,180,80,0.15);border-color:rgba(80,180,80,0.3);" data-action="listBuildingForSaleUI" data-id="' + bld.id + '">' + (bld.forSale ? '🚫 Remove Listing' : '📋 List For Sale') + '</button>';

        html += '</div></div>'; // close MAINTENANCE flex + border container

        // ──── OPERATIONS (Work / Manager) ────
        html += '<div style="padding:8px;border:1px solid var(--border);border-radius:4px;margin-bottom:8px;">';
        html += '<div style="font-weight:bold;font-size:0.8rem;margin-bottom:6px;">💼 OPERATIONS</div>';
        html += '<div style="display:flex;gap:6px;flex-wrap:wrap;">';

        // Work Here Today button
        if (Player.workAtBuilding && bld.townId === Player.townId && bld.active) {
            var _workedToday = bld._playerWorkedDay === (Engine.getDay ? Engine.getDay() : -1);
            if (_workedToday) {
                html += '<button class="btn-trade" style="font-size:0.7rem;opacity:0.5;" disabled>✅ Already Worked Today</button>';
            } else {
                html += '<button class="btn-trade buy" style="font-size:0.7rem;background:rgba(80,160,80,0.15);border-color:rgba(80,160,80,0.3);" data-action="workHereTodayUI" data-id="' + bld.id + '">🔨 Work Here Today</button>';
            }
        }

        // Manager section
        if (bld._managerId) {
            var _mgrSkillLabel = bld._managerSkill >= 70 ? '⭐ Skilled' : bld._managerSkill >= 40 ? 'Trained' : 'Learning';
            var _mgrEff = bld._managerEfficiency ? Math.round(bld._managerEfficiency * 100) : 100;
            html += '<div style="font-size:0.72rem;padding:4px 8px;background:rgba(100,150,220,0.1);border:1px solid rgba(100,150,220,0.3);border-radius:4px;width:100%;">';
            html += '👔 <b>Manager:</b> ' + (bld._managerName || 'Unknown') + ' — ' + _mgrSkillLabel + ' (' + Math.round(bld._managerSkill || 0) + '/100) — ' + _mgrEff + '% efficiency — ' + (bld._managerSalary || 0) + 'g/day';
            html += '<div style="margin-top:4px;display:flex;gap:4px;">';
            html += '<button class="btn-trade sell" style="font-size:0.65rem;" data-action="fireManagerUI" data-id="' + bld.id + '">🚫 Fire</button>';
            html += '<button class="btn-trade" style="font-size:0.65rem;" data-action="toggleManagerCaravansUI" data-id="' + bld.id + '">' + (bld._managerCaravans ? '🚫 Disable Caravans' : '🐫 Enable Caravans') + '</button>';
            html += '</div>';
            if (bld._managerRaiseRequest) {
                html += '<div style="margin-top:4px;padding:4px;background:rgba(200,160,0,0.15);border:1px solid rgba(200,160,0,0.3);border-radius:3px;font-size:0.7rem;">⚠️ ' + (bld._managerRaiseRequest.managerName || bld._managerName) + ' wants a ' + bld._managerRaiseRequest.raisePercent + '% raise or they will leave! ';
                html += '<button class="btn-trade buy" style="font-size:0.6rem;" data-action="respondManagerRaiseUI" data-id="' + bld.id + '" data-val="accept">✅ Accept</button> ';
                html += '<button class="btn-trade sell" style="font-size:0.6rem;" data-action="respondManagerRaiseUI" data-id="' + bld.id + '" data-val="decline">❌ Decline</button>';
                html += '</div>';
            }
            html += '</div>';
        } else if (Player.hireManager) {
            // Show hire manager button if player is guildmaster
            // v9p33river315: socialRank 5+ in any kingdom is the canonical
            // guildmaster status; also accept memberships explicitly flagged
            // 'guildmaster'. Was checking only .rank which doesn't exist on
            // membership records — hid the button from every valid GM.
            var _isGM = false;
            var _pState = Player.state;
            if (_pState && _pState.socialRank) {
                for (var _gsr in _pState.socialRank) {
                    if ((_pState.socialRank[_gsr] || 0) >= 5) { _isGM = true; break; }
                }
            }
            if (!_isGM && _pState && _pState.guildMemberships) {
                for (var _gk in _pState.guildMemberships) {
                    var _gmRec = _pState.guildMemberships[_gk];
                    if (_gmRec && (_gmRec.rank === 'guildmaster' || _gmRec.type === 'guildmaster')) { _isGM = true; break; }
                }
            }
            if (_isGM) {
                html += '<button class="btn-trade buy" style="font-size:0.7rem;background:rgba(100,150,220,0.15);border-color:rgba(100,150,220,0.3);" data-action="hireManagerUI" data-id="' + bld.id + '">👔 Hire Manager</button>';
            } else {
                html += '<span style="font-size:0.65rem;color:rgba(200,200,200,0.5);padding:4px;">👔 Manager (requires Guildmaster rank)</span>';
            }
        }

        // Building name (for retail)
        if (bt && bt.retailConfig) {
            html += '<button class="btn-trade" style="font-size:0.7rem;background:rgba(200,160,80,0.15);border-color:rgba(200,160,80,0.3);" data-action="nameBuildingUI" data-id="' + bld.id + '">✏️ ' + (bld._repName ? 'Rename' : 'Name Your Shop') + '</button>';
            if (bld._reputation != null) {
                var _repLabel = bld._reputation >= 80 ? '⭐ Famous' : bld._reputation >= 60 ? '👍 Well-Known' : bld._reputation >= 40 ? 'Known' : bld._reputation >= 20 ? 'New' : '❌ Poor';
                html += '<span style="font-size:0.7rem;padding:4px 8px;">📊 Reputation: ' + Math.round(bld._reputation) + '/100 (' + _repLabel + ')</span>';
            }
        }

        html += '</div></div>'; // close OPERATIONS flex + border container


        html += `<div style="text-align:center;margin-top:8px;">
            <button class="btn-trade" style="font-size:0.75rem;" data-action="openBuildingManagement">← Back to All Buildings</button>
        </div>`;

        html += '</div>';

        openModal('🏭 ' + bName + ' — Details', html);
    }

    function supplyBuildingUI(buildingId, resourceId, quantity) {
        const result = Player.supplyBuilding(buildingId, resourceId, quantity);
        toast(result.message, result.success ? 'success' : 'warning');
        if (result.success) showBuildingDetail(buildingId);
    }

    function collectOutputUI(buildingId, resourceId, quantity) {
        const result = Player.collectBuildingOutput(buildingId, resourceId, quantity);
        toast(result.message, result.success ? 'success' : 'warning');
        if (result.success) showBuildingDetail(buildingId);
    }

    function stockRetailUI(buildingId, resourceId, quantity) {
        if (!Player.stockRetailBuilding) { toast('Retail stocking not available', 'warning'); return; }
        var result = Player.stockRetailBuilding(buildingId, resourceId, quantity);
        toast(result.message, result.success ? 'success' : 'warning');
        if (result.success) showBuildingDetail(buildingId);
    }

    function unstockRetailUI(buildingId, resourceId, quantity) {
        if (!Player.unstockRetailBuilding) { toast('Retail unstocking not available', 'warning'); return; }
        var result = Player.unstockRetailBuilding(buildingId, resourceId, quantity);
        toast(result.message, result.success ? 'success' : 'warning');
        if (result.success) showBuildingDetail(buildingId);
    }

    function collectRetailRevenueUI(buildingId) {
        if (!Player.collectRetailRevenue) { toast('Revenue collection not available', 'warning'); return; }
        var result = Player.collectRetailRevenue(buildingId);
        toast(result.message, result.success ? 'success' : 'warning');
        if (result.success) showBuildingDetail(buildingId);
    }

    // ── BUILDING STORAGE TRANSFER UI ──
    function openBuildingStorageUI(buildingId) {
        var bld = (Player.buildings || []).find(function(b) { return b.id === buildingId; });
        if (!bld) { toast('Building not found.', 'error'); return; }
        var bt = null;
        for (var key in BUILDING_TYPES) { if (BUILDING_TYPES[key].id === bld.type) { bt = BUILDING_TYPES[key]; break; } }
        var bName = bt ? bt.name : bld.type;
        var bldCap = Math.floor((bt ? (bt.storage || 0) : 0) * (1 + (((bld.level || 1) - 1) * 0.50)));
        var bldUsed = 0;
        if (bld.inventory) { for (var bk in bld.inventory) { var br = findResource(bk); bldUsed += (bld.inventory[bk] || 0) * (br ? (br.weight || 1) : 1); } }
        var prodStored = bld.storedOutput || 0;
        if (bt && bt.produces) { var pr = findResource(bt.produces); bldUsed += prodStored * (pr ? (pr.weight || 1) : 1); }

        var isLivestockBld = bt && (bt.category === 'farming' || bt.livestockCapacity || (bt.id && bt.id.indexOf('livestock') >= 0));
        var isHorseBld = bt && (bt.cavalryCapacity || bt.id === 'horse_market' || bt.id === 'stable' || (bt.id && bt.id.indexOf('horse') >= 0) || (bt.id && bt.id.indexOf('cavalry') >= 0));

        var html = '<div style="max-height:400px;overflow-y:auto;">';
        html += '<div style="font-size:0.85rem;margin-bottom:8px;">📦 Building Storage: <strong>' + Math.round(bldUsed) + '/' + bldCap + '</strong></div>';

        // Stored items — withdraw
        html += '<h4 style="margin:8px 0 4px;">Stored in Building</h4>';
        var hasStored = false;
        if (bld.inventory) {
            for (var sk in bld.inventory) {
                if (bld.inventory[sk] <= 0) continue;
                hasStored = true;
                var sr = findResource(sk);
                var sName = sr ? ((sr.icon || '') + ' ' + sr.name) : sk;
                var sQty = bld.inventory[sk];
                html += '<div style="display:flex;align-items:center;gap:6px;margin:2px 0;font-size:0.8rem;">';
                html += '<span style="min-width:140px;">' + sName + ': ' + sQty + '</span>';
                html += '<button class="btn-trade buy" style="font-size:0.65rem;padding:1px 6px;" data-action="_bldWithdraw" data-id="' + buildingId + '" data-val="' + sk + '" data-qty="1">Take 1</button>';
                if (sQty >= 5) html += '<button class="btn-trade buy" style="font-size:0.65rem;padding:1px 6px;" data-action="_bldWithdraw" data-id="' + buildingId + '" data-val="' + sk + '" data-qty="5">5</button>';
                html += '<button class="btn-trade buy" style="font-size:0.65rem;padding:1px 6px;" data-action="_bldWithdraw" data-id="' + buildingId + '" data-val="' + sk + '" data-qty="' + sQty + '">All</button>';
                html += '</div>';
            }
        }
        if (!hasStored) html += '<div style="color:#888;font-size:0.8rem;">Empty</div>';

        // Player inventory + town storage — deposit
        html += '<h4 style="margin:12px 0 4px;">Your Inventory / Town Storage</h4>';
        // inputOnly filter info
        var inputOnly = bld.inputOnly !== false;
        var consumedGoods = Player.getBuildingConsumedGoods ? Player.getBuildingConsumedGoods(bt) : {};
        var producesId = bt ? bt.produces : null;
        if (inputOnly && producesId) {
            html += '<div style="font-size:0.7rem;color:#aaa;margin-bottom:4px;">🔒 Filtered to goods this building consumes. Uncheck "Only accept consumed goods" in building detail to accept all.</div>';
        }
        var hasInv = false;
        var inv = Player.inventory || {};
        var _tsModal = (Player.state && Player.state.townStorage && Player.state.townStorage[bld.townId]) || {};
        var _allModalKeys = {};
        for (var _mk1 in inv) { if (inv[_mk1] > 0) _allModalKeys[_mk1] = true; }
        for (var _mk2 in _tsModal) { if (_tsModal[_mk2] > 0) _allModalKeys[_mk2] = true; }
        for (var ik in _allModalKeys) {
            var _mInvQty = inv[ik] || 0;
            var _mTsQty = _tsModal[ik] || 0;
            var iQty = _mInvQty + _mTsQty;
            if (iQty <= 0) continue;
            var ir = findResource(ik);
            if (!ir) continue;
            // Filter: livestock only to livestock buildings, horses only to horse buildings
            if (ir.category === 'livestock' && !isLivestockBld) continue;
            if (ik === 'horses' && !isHorseBld) continue;
            // Input-only filter: skip goods this building doesn't consume
            if (inputOnly && producesId && !consumedGoods[ik]) {
                var _directConsumedM = bt && bt.consumes && bt.consumes[ik];
                if (!_directConsumedM) continue;
            }
            hasInv = true;
            var iName = (ir.icon || '') + ' ' + ir.name;
            var isConsumedGood = consumedGoods[ik];
            var _mSrcNote = _mInvQty > 0 && _mTsQty > 0 ? ' <span style="font-size:0.6rem;color:#aaa;">(' + _mInvQty + ' inv + ' + _mTsQty + ' stored)</span>' : (_mTsQty > 0 && _mInvQty === 0 ? ' <span style="font-size:0.6rem;color:#64b5f6;">📦 stored</span>' : '');
            html += '<div style="display:flex;align-items:center;gap:6px;margin:2px 0;font-size:0.8rem;">';
            html += '<span style="min-width:140px;">' + iName + ': ' + iQty + _mSrcNote + (isConsumedGood ? ' <span style="color:#7cb342;font-size:0.6rem;">(used)</span>' : '') + '</span>';
            html += '<button class="btn-trade sell" style="font-size:0.65rem;padding:1px 6px;" data-action="_bldDeposit" data-id="' + buildingId + '" data-val="' + ik + '" data-qty="1">Store 1</button>';
            if (iQty >= 5) html += '<button class="btn-trade sell" style="font-size:0.65rem;padding:1px 6px;" data-action="_bldDeposit" data-id="' + buildingId + '" data-val="' + ik + '" data-qty="5">5</button>';
            html += '<button class="btn-trade sell" style="font-size:0.65rem;padding:1px 6px;" data-action="_bldDeposit" data-id="' + buildingId + '" data-val="' + ik + '" data-qty="' + iQty + '">All</button>';
            html += '</div>';
        }
        if (!hasInv) html += '<div style="color:#888;font-size:0.8rem;">Nothing transferable' + (inputOnly && producesId ? ' (input filter on)' : '') + '</div>';

        html += '</div>';
        openModal('📦 ' + bName + ' Storage', html,
            '<button class="btn-medieval" data-action="showBuildingDetail" data-id="' + buildingId + '">Back</button>');
    }

    function _bldDeposit(buildingId, resId, qty) {
        var result = Player.depositToBuilding(buildingId, resId, qty);
        toast(result.message, result.success ? 'success' : 'error');
        showBuildingDetail(buildingId);
    }

    function _bldWithdraw(buildingId, resId, qty) {
        var result = Player.withdrawFromBuilding(buildingId, resId, qty);
        toast(result.message, result.success ? 'success' : 'error');
        showBuildingDetail(buildingId);
    }

    function toggleAutoBuyUI(buildingId) {
        const result = Player.toggleAutoBuy(buildingId);
        toast(result.message, result.success ? 'success' : 'info');
        if (result.success) showBuildingDetail(buildingId);
    }

    function setTransferTargetUI(buildingId) {
        const select = document.getElementById('transferTargetSelect');
        if (!select) return;
        const targetId = select.value || null;
        const result = Player.setTransferTarget(buildingId, targetId);
        toast(result.message, result.success ? 'success' : 'warning');
        if (result.success) showBuildingDetail(buildingId);
    }
    
    function clearTransferUI(buildingId) {
        const result = Player.setTransferTarget(buildingId, null);
        toast(result.message, result.success ? 'success' : 'warning');
        if (result.success) showBuildingDetail(buildingId);
    }

    function setBuildingProductUI(buildingId) {
        const select = document.getElementById('productSelect');
        if (!select || !select.value) { toast('Select a product first.', 'warning'); return; }
        const result = Player.setBuildingProduct(buildingId, select.value);
        toast(result.message, result.success ? 'success' : 'warning');
        if (result.success) showBuildingDetail(buildingId);
    }

    function purchaseNPCBuildingUI(buildingIndex, townId) {
        const result = Player.purchaseNPCBuilding(buildingIndex, townId);
        toast(result.message, result.success ? 'success' : 'warning');
        if (result.success) {
            if (typeof StoryMode !== 'undefined' && StoryMode.onPlayerAction) {
                StoryMode.onPlayerAction('purchase_existing_building', { building: result.building });
            }
            openBuildDialog();
        }
    }

    function openConvertBuildingUI(buildingIndex, townId) {
        var town = Engine.findTown(townId);
        if (!town) { toast('Town not found.', 'warning'); return; }
        var bld = town.buildings[buildingIndex];
        if (!bld) { toast('Building not found.', 'warning'); return; }
        var oldBt = Engine.findBuildingType(bld.type);
        var oldName = oldBt ? oldBt.name : bld.type;
        var salePrice = bld.salePrice || 0;

        var html = '<p>Convert <strong>' + oldName + '</strong> to a new building type.</p>';
        html += '<p style="font-size:0.8rem;color:var(--text-dim);">Cost: 🪙 ' + salePrice + 'g (sale) + 500g (demolition) + 💥 1 blasting powder</p>';
        html += '<div style="max-height:300px;overflow-y:auto;">';

        // List all available building types
        var buildingTypes = typeof BUILDING_TYPES !== 'undefined' ? BUILDING_TYPES : {};
        for (var bKey in buildingTypes) {
            var bt = buildingTypes[bKey];
            if (!bt || !bt.id || bt.id === bld.type) continue;
            if (bt.capitalOnly && !town.isCapital) continue;
            if (bt.villageOnly && town.category !== 'village') continue;
            if (bt.portOnly && !town.isPort) continue;
            if ((CONFIG.KINGDOM_EXCLUSIVE_BUILDINGS || []).indexOf(bt.id) !== -1) continue;
            // Check deposit requirements
            var depReq = CONFIG.DEPOSIT_REQUIREMENTS ? CONFIG.DEPOSIT_REQUIREMENTS[bt.id] : null;
            if (depReq) {
                var townDeps = town.naturalDeposits || {};
                if (!townDeps[depReq.deposit] || townDeps[depReq.deposit] <= 0) continue;
            }
            var totalCost = salePrice + 500;
            var canAfford = (Player.gold || 0) >= totalCost;
            var producesInfo = bt.produces ? (' → produces ' + bt.produces) : ' (no production)';
            html += '<div class="build-card' + (canAfford ? '' : ' cant-afford') + '" style="cursor:pointer;margin-bottom:4px;" data-action="executeConvertBuildingUI" data-idx="' + buildingIndex + '" data-id="' + townId + '" data-val="' + bt.id + '">';
            html += '<div class="build-name">' + (bt.icon || '') + ' ' + bt.name + '</div>';
            html += '<div class="build-cost">🪙 ' + totalCost + 'g + 💥' + producesInfo + '</div>';
            if (bt.description) html += '<div class="build-info" style="font-size:0.7rem;">' + bt.description + '</div>';
            html += '</div>';
        }
        html += '</div>';
        openModal('🔄 Convert ' + oldName, html);
    }

    function executeConvertBuildingUI(buildingIndex, townId, newBuildingTypeId) {
        var result = Player.playerConvertBuilding(buildingIndex, townId, newBuildingTypeId);
        toast(result.message, result.success ? 'success' : 'warning');
        if (result.success) {
            openBuildDialog();
        }
    }

    function _findTownBuildingIndex(buildingId, townId) {
        var town = Engine.findTown(townId);
        if (!town || !town.buildings) return -1;
        // Try by id first
        var idx = town.buildings.findIndex(function(b) { return b.id && b.id === buildingId; });
        if (idx >= 0) return idx;
        // Fallback: find by player building type match
        var pBld = Player.state && Player.state.buildings ? Player.state.buildings.find(function(b) { return b.id === buildingId; }) : null;
        if (pBld) {
            idx = town.buildings.findIndex(function(b) { return b.ownerId === 'player' && b.type === pBld.type; });
        }
        return idx;
    }

    function demolishBuildingUI(buildingId, townId) {
        var buildingIndex = _findTownBuildingIndex(buildingId, townId);
        if (buildingIndex < 0) { toast('Building not found in town records.', 'warning'); return; }
        var result = Player.playerDemolishBuilding(buildingIndex, townId);
        toast(result.message, result.success ? 'success' : 'warning');
        if (result.success) {
            openBuildDialog();
        }
    }

    function confirmDemolishUI(buildingId, townId) {
        var buildingIndex = _findTownBuildingIndex(buildingId, townId);
        var town = Engine.findTown(townId);
        var bld = (buildingIndex >= 0 && town) ? town.buildings[buildingIndex] : null;
        var pBld = Player.state && Player.state.buildings ? Player.state.buildings.find(function(b) { return b.id === buildingId; }) : null;
        var bt = bld ? Engine.findBuildingType(bld.type) : (pBld ? Engine.findBuildingType(pBld.type) : null);
        var bName = bt ? bt.name : 'Building';
        var hasBp = (Player.inventory && (Player.inventory.blasting_powder || 0) >= 1);
        var hasDt = (Player.inventory && (Player.inventory.demolition_tools || 0) >= 2);
        var methodNote;
        if (hasBp) methodNote = '1 💥 blasting powder (from inventory)';
        else if (hasDt) methodNote = '2 ⛏️ demolition tools (from inventory)';
        else methodNote = '1 💥 blasting powder or 2 ⛏️ demolition tools (will buy from market/kingdom)';
        var html = '<div style="padding:10px;">';
        html += '<p>Are you sure you want to demolish <strong>' + bName + '</strong>?</p>';
        html += '<p style="font-size:0.85rem;">Cost: <strong>' + (Player.getLandCost ? Math.floor(Player.getLandCost(townId) / 2) : 500) + 'g</strong> + <strong>' + methodNote + '</strong></p>';
        html += '<p style="font-size:0.8rem;color:#c44e52;">⚠️ This action cannot be undone. The building will be destroyed and the land plot freed.</p>';
        html += '<div style="display:flex;gap:8px;margin-top:12px;">';
        html += '<button class="btn-medieval" style="flex:1;background:rgba(200,50,50,0.3);" data-action="demolishBuildingUI" data-id="' + buildingId + '" data-val="' + townId + '">💥 Confirm Demolish</button>';
        html += '<button class="btn-medieval" style="flex:1;" data-action="showBuildingDetail" data-id="' + buildingId + '">Cancel</button>';
        html += '</div></div>';
        openModal('💥 Demolish ' + bName + '?', html);
    }

    function openFarmConvertUI(buildingIndex, townId) {
        var town = Engine.findTown(townId);
        if (!town) { toast('Town not found.', 'warning'); return; }
        var bld = town.buildings[buildingIndex];
        if (!bld) { toast('Building not found.', 'warning'); return; }
        var bt = Engine.findBuildingType(bld.type);
        var oldName = bt ? bt.name : bld.type;

        var isCrop = Engine.isCropFarm(bld.type);
        var isLivestock = Engine.isLivestockFarm(bld.type);
        var targetTypes = isCrop ? (CONFIG.FARM_CROP_TYPES || []) : isLivestock ? (CONFIG.FARM_LIVESTOCK_TYPES || []) : [];

        var html = '<div style="padding:10px;">';
        html += '<p style="font-size:0.85rem;color:#b0a080;margin-bottom:10px;">Convert <strong>' + oldName + '</strong> to:</p>';

        for (var i = 0; i < targetTypes.length; i++) {
            var tId = targetTypes[i];
            if (tId === bld.type) continue;
            var tBt = Engine.findBuildingType(tId);
            if (!tBt) continue;
            var costInfo = Engine.getFarmConversionCost(bld, tId);
            if (!costInfo) {
                html += '<div style="padding:6px 10px;margin-bottom:4px;border:1px solid rgba(120,60,60,0.3);border-radius:4px;opacity:0.5;">';
                html += '<strong>' + tBt.name + '</strong> <span style="color:#c06040;">— no conversions remaining this year</span>';
                html += '</div>';
                continue;
            }

            var costDesc = '';
            if (costInfo.free) {
                costDesc = '<span style="color:#80b080;">FREE (seasonal)</span>';
            } else {
                var parts = [];
                if (costInfo.gold > 0) parts.push(costInfo.gold + 'g');
                for (var m in costInfo.materials) {
                    if (costInfo.materials[m] > 0) {
                        var mRes = findResource(m);
                        parts.push(costInfo.materials[m] + ' ' + (mRes ? mRes.name : m));
                    }
                }
                costDesc = parts.join(', ') || 'Free';
            }

            var canAfford = true;
            if (costInfo.gold > (Player.gold || 0)) canAfford = false;
            for (var cm in costInfo.materials) {
                if (costInfo.materials[cm] > 0 && (Player.inventory[cm] || 0) < costInfo.materials[cm]) canAfford = false;
            }

            html += '<div style="padding:6px 10px;margin-bottom:4px;border:1px solid rgba(120,100,60,0.3);border-radius:4px;' + (canAfford ? '' : 'opacity:0.5;') + '">';
            html += '<strong>' + tBt.name + '</strong> — ' + costDesc;
            if (tBt.produces) {
                var pRes = findResource(tBt.produces);
                html += ' <span style="color:#a09070;">(produces ' + (pRes ? pRes.name : tBt.produces) + ')</span>';
            }
            html += '<br><button class="btn-medieval" style="font-size:0.7rem;padding:2px 8px;margin-top:4px;" ' + (canAfford ? '' : 'disabled') + ' data-action="executeFarmConvertUI" data-idx="' + buildingIndex + '" data-id="' + townId + '" data-val="' + tId + '">Convert</button>';
            html += '</div>';
        }

        html += '</div>';
        openModal('🔄 Convert ' + oldName, html);
    }

    function executeFarmConvertUI(buildingIndex, townId, newTypeId) {
        var result = Player.playerConvertFarm(buildingIndex, townId, newTypeId);
        toast(result.message, result.success ? 'success' : 'warning');
        if (result.success) {
            closeModal();
            openBuildDialog();
        }
    }

    function assignWorkerUI(buildingId) {
        try {
            const sel = document.getElementById('assignWorkerSelect');
            if (!sel || !sel.value) { toast('Select a worker first.', 'warning'); return; }
            const result = Player.assignWorker(sel.value, buildingId);
            toast(result.message, result.success ? 'success' : 'warning');
            if (result.success) showBuildingDetail(buildingId);
        } catch (e) {
            console.error('assignWorkerUI error:', e, e.stack);
            toast('Error assigning worker: ' + (e.message || e), 'danger');
        }
    }

    function removeWorkerUI(personId, buildingId) {
        const result = Player.removeWorkerFromBuilding(personId, buildingId);
        toast(result.message, result.success ? 'success' : 'warning');
        if (result.success) showBuildingDetail(buildingId);
    }

    function upgradeBuildingUI(buildingId) {
        const result = Player.upgradeBuilding(buildingId);
        toast(result.message, result.success ? 'success' : 'warning');
        if (result.success) showBuildingDetail(buildingId);
    }

    function toggleGuard(buildingId) {
        const result = Player.toggleBuildingGuard(buildingId);
        toast(result.message, result.success ? 'success' : 'warning');
        openBuildingManagement();
    }

    function buyLockedStorage(buildingId) {
        const result = Player.purchaseLockedStorage(buildingId);
        toast(result.message, result.success ? 'success' : 'warning');
        openBuildingManagement();
    }

    function toggleFarmFallow(buildingId) {
        const bld = (Player.buildings || []).find(b => b.id === buildingId);
        if (!bld) { toast('Building not found.', 'warning'); return; }
        const result = Player.setFarmFallow(buildingId, !bld.fallow);
        toast(result.message, result.success ? 'success' : 'warning');
        openBuildingManagement();
    }

    function openWarehouseSecurityDialog(buildingId) {
        const bld = (Player.buildings || []).find(b => b.id === buildingId);
        if (!bld) { toast('Building not found.', 'warning'); return; }
        const bt = Engine.findBuildingType(bld.type);
        const bName = bt ? bt.name : bld.type;

        let html = '<div style="padding:8px;">';
        html += '<h4 style="margin-bottom:8px;">🔐 Security Upgrades for ' + bName + '</h4>';

        const installed = bld.securityUpgrades || [];
        for (const [upgradeId, cfg] of Object.entries(CONFIG.WAREHOUSE_SECURITY)) {
            const isInstalled = installed.includes(upgradeId);
            const matStr = Object.entries(cfg.materials).map(function(e) { return e[0].replace('_', ' ') + ': ' + e[1]; }).join(', ');
            html += '<div style="border:1px solid var(--border);padding:8px;margin:6px 0;border-radius:4px;' + (isInstalled ? 'opacity:0.6;' : '') + '">';
            html += '<div><strong>' + cfg.icon + ' ' + cfg.name + '</strong></div>';
            html += '<div style="font-size:0.8rem;">Theft reduction: -' + Math.round(cfg.theftReduction * 100) + '%</div>';
            if (cfg.catchChance) html += '<div style="font-size:0.8rem;">Catch chance: ' + Math.round(cfg.catchChance * 100) + '%</div>';
            if (cfg.wageCost) html += '<div style="font-size:0.8rem;">Daily wage: ' + cfg.wageCost + 'g</div>';
            html += '<div style="font-size:0.75rem;color:#888;">Cost: ' + cfg.cost + 'g | Materials: ' + matStr + '</div>';
            if (isInstalled) {
                html += '<div style="color:#55a868;font-size:0.8rem;margin-top:4px;">✅ Installed</div>';
            } else {
                html += '<button class="btn-trade buy" style="font-size:0.7rem;margin-top:4px;" data-action="installWarehouseSecurity" data-id="' + buildingId + '" data-val="' + upgradeId + '">Install (' + cfg.cost + 'g)</button>';
            }
            html += '</div>';
        }
        html += '</div>';
        openModal('🔐 Warehouse Security', html);
    }

    function installWarehouseSecurity(buildingId, upgradeId) {
        const result = Player.installWarehouseSecurity(buildingId, upgradeId);
        toast(result.message, result.success ? 'success' : 'warning');
        if (result.success) openWarehouseSecurityDialog(buildingId);
    }

    function racketResponse(response) {
        const result = Player.respondToRacket(response);
        toast(result.message, result.success ? 'success' : 'warning');
        openBuildingManagement();
    }

    // Register functions on UI namespace
    UI.openBuildDialog = openBuildDialog;
    UI.filterBuildings = filterBuildings;
    UI.executeBuild = executeBuild;
    UI.openBuildingManagement = openBuildingManagement;
    UI.openTownMarket = openTownMarket;
    UI.listLandForSaleUI = listLandForSaleUI;
    UI.buyApartmentUnit = buyApartmentUnit;
    UI.buyTentSlot = buyTentSlot;
    UI.listBuildingForSaleUI = listBuildingForSaleUI;
    UI.showBuildingDetail = showBuildingDetail;
    UI.supplyBuildingUI = supplyBuildingUI;
    UI.collectOutputUI = collectOutputUI;
    UI.stockRetailUI = stockRetailUI;
    UI.unstockRetailUI = unstockRetailUI;
    UI.collectRetailRevenueUI = collectRetailRevenueUI;
    UI.openBuildingStorageUI = openBuildingStorageUI;
    UI._bldDeposit = _bldDeposit;
    UI._bldWithdraw = _bldWithdraw;
    UI.toggleAutoBuyUI = toggleAutoBuyUI;
    UI.setTransferTarget = setTransferTargetUI;
    UI.clearTransfer = clearTransferUI;
    UI.setBuildingProductUI = setBuildingProductUI;
    UI.purchaseNPCBuildingUI = purchaseNPCBuildingUI;
    UI.openConvertBuildingUI = openConvertBuildingUI;
    UI.executeConvertBuildingUI = executeConvertBuildingUI;
    UI.demolishBuildingUI = demolishBuildingUI;
    UI.confirmDemolishUI = confirmDemolishUI;
    UI.openFarmConvertUI = openFarmConvertUI;
    UI.executeFarmConvertUI = executeFarmConvertUI;
    UI.assignWorkerUI = assignWorkerUI;
    UI.removeWorkerUI = removeWorkerUI;
    UI.upgradeBuildingUI = upgradeBuildingUI;
    UI.toggleGuard = toggleGuard;
    UI.buyLockedStorage = buyLockedStorage;
    UI.toggleFarmFallow = toggleFarmFallow;
    UI.openWarehouseSecurityDialog = openWarehouseSecurityDialog;
    UI.installWarehouseSecurity = installWarehouseSecurity;
    UI.racketResponse = racketResponse;

    // ── Action delegation registrations ──
    UI.registerAction('filterBuildings', function(_t, d) { UI.filterBuildings(d.id); });
    UI.registerAction('executeBuild', function(_t, d) { UI.executeBuild(d.id, d.val); });
    UI.registerAction('openTownMarket', function() { UI.openTownMarket(); });
    UI.registerAction('openFarmConvertUI', function(_t, d) { UI.openFarmConvertUI(parseInt(d.idx), d.id); });
    UI.registerAction('listLandForSaleUI', function(_t, d) { UI.listLandForSaleUI(d.id); });
    UI.registerAction('showBuildingDetail', function(_t, d) { UI.showBuildingDetail(d.id); });
    UI.registerAction('racketResponse', function(_t, d) { UI.racketResponse(d.val); });
    UI.registerAction('purchaseNPCBuildingUI', function(_t, d) { UI.purchaseNPCBuildingUI(parseInt(d.idx), d.id); });
    UI.registerAction('buyApartmentUnit', function(_t, d) { UI.buyApartmentUnit(d.id); });
    UI.registerAction('buyTentSlot', function(_t, d) { UI.buyTentSlot(d.id); });
    UI.registerAction('listLandConfirm', function(_t, d) {
        var p = parseInt(document.getElementById('landSalePrice').value) || 0;
        var r = Player.listLandForSale(d.id, p);
        UI.toast(r.message, r.success ? 'success' : 'error');
        if (r.success) UI.closeModal();
    });
    UI.registerAction('cancelLandListing', function(_t, d) {
        Player.cancelLandListing(d.id);
        UI.toast('Listing removed.', 'success');
        UI.closeModal();
    });
    UI.registerAction('listBldForSaleConfirm', function(_t, d) {
        var p = parseInt(document.getElementById('bldSalePrice').value) || 0;
        var r = Player.listBuildingForSale(d.id, p);
        UI.toast(r.message, r.success ? 'success' : 'error');
        if (r.success) { UI.closeModal(); UI.showBuildingDetail(d.id); }
    });
    UI.registerAction('showNPCDetail', function(_t, d) { if (UI.talkToPerson) UI.talkToPerson(d.id); });
    UI.registerAction('kickPatientAction', function(_t, d) {
        Engine.kickPatientFromQueue(d.type, d.val, d.id);
        UI.showBuildingDetail(d.val);
    });
    UI.registerAction('setBuildingProductUI', function(_t, d) { UI.setBuildingProductUI(d.id); });
    UI.registerAction('collectOutputUI', function(_t, d) { UI.collectOutputUI(d.id, d.val, parseInt(d.qty)); });
    UI.registerAction('collectRetailRevenueUI', function(_t, d) { UI.collectRetailRevenueUI(d.id); });
    UI.registerAction('stockRetailUI', function(_t, d) { UI.stockRetailUI(d.id, d.val, parseInt(d.qty)); });
    UI.registerAction('unstockRetailUI', function(_t, d) { UI.unstockRetailUI(d.id, d.val, parseInt(d.qty)); });
    UI.registerAction('_bldWithdraw', function(_t, d) { UI._bldWithdraw(d.id, d.val, parseInt(d.qty)); });
    UI.registerAction('_bldDeposit', function(_t, d) { UI._bldDeposit(d.id, d.val, parseInt(d.qty)); });
    UI.registerAction('praiseWorkerAction', function(_t, d) {
        var r = Player.praiseWorker(d.id);
        UI.toast(r.message, r.success ? 'success' : 'warning');
        UI.showBuildingDetail(d.val);
    });
    UI.registerAction('giveWorkerDayOffAction', function(_t, d) {
        var r = Player.giveWorkerDayOff(d.id);
        UI.toast(r.message, r.success ? 'success' : 'warning');
        UI.showBuildingDetail(d.val);
    });
    UI.registerAction('giveWorkerBonusAction', function(_t, d) {
        var r = Player.giveWorkerBonus(d.id);
        UI.toast(r.message, r.success ? 'success' : 'warning');
        UI.showBuildingDetail(d.val);
    });
    UI.registerAction('giveWorkerRaiseAction', function(_t, d) {
        var r = Player.giveWorkerRaise(d.id);
        UI.toast(r.message, r.success ? 'success' : 'warning');
        UI.showBuildingDetail(d.val);
    });
    UI.registerAction('removeWorkerUI', function(_t, d) { UI.removeWorkerUI(d.id, d.val); });
    UI.registerAction('assignWorkerUI', function(_t, d) { UI.assignWorkerUI(d.id); });
    UI.registerAction('supplyBuildingUI', function(_t, d) { UI.supplyBuildingUI(d.id, d.val, parseInt(d.qty)); });
    UI.registerAction('setTransferTarget', function(_t, d) { UI.setTransferTarget(d.id); });
    UI.registerAction('clearTransfer', function(_t, d) { UI.clearTransfer(d.id); });
    UI.registerAction('deliverNowAction', function(_t, d) {
        var r = Player.deliverNow(d.id);
        UI.toast(r.message, r.success ? 'success' : 'warning');
        UI.showBuildingDetail(d.id);
    });
    UI.registerAction('upgradeBuildingUI', function(_t, d) { UI.upgradeBuildingUI(d.id); });
    UI.registerAction('repairBuilding', function(_t, d) { UI.repairBuilding(d.id); });
    UI.registerAction('toggleGuardAndRefresh', function(_t, d) { UI.toggleGuard(d.id); UI.showBuildingDetail(d.id); });
    UI.registerAction('buyLockedStorageAndRefresh', function(_t, d) { UI.buyLockedStorage(d.id); UI.showBuildingDetail(d.id); });
    UI.registerAction('toggleFarmFallowAndRefresh', function(_t, d) { UI.toggleFarmFallow(d.id); UI.showBuildingDetail(d.id); });
    UI.registerAction('openWarehouseSecurityDialog', function(_t, d) { UI.openWarehouseSecurityDialog(d.id); });
    UI.registerAction('confirmDemolishUI', function(_t, d) { UI.confirmDemolishUI(d.id, d.val); });
    UI.registerAction('listBuildingForSaleUI', function(_t, d) { UI.listBuildingForSaleUI(d.id); });
    UI.registerAction('openBuildingManagement', function() { UI.openBuildingManagement(); });
    UI.registerAction('executeConvertBuildingUI', function(_t, d) { UI.executeConvertBuildingUI(parseInt(d.idx), d.id, d.val); });
    UI.registerAction('demolishBuildingUI', function(_t, d) { UI.demolishBuildingUI(d.id, d.val); });
    UI.registerAction('executeFarmConvertUI', function(_t, d) { UI.executeFarmConvertUI(parseInt(d.idx), d.id, d.val); });
    UI.registerAction('installWarehouseSecurity', function(_t, d) { UI.installWarehouseSecurity(d.id, d.val); });

    // ──── Building Management Actions ────
    UI.registerAction('workHereTodayUI', function(_t, d) {
        if (!Player.workAtBuilding) { UI.toast('Feature not available.', 'warning'); return; }
        var r = Player.workAtBuilding(d.id);
        UI.toast(r.message, r.success ? 'success' : 'warning');
        UI.showBuildingDetail(d.id);
    });
    UI.registerAction('hireManagerUI', function(_t, d) {
        if (!Player.hireManager) { UI.toast('Feature not available.', 'warning'); return; }
        var r = Player.hireManager(d.id);
        UI.toast(r.message, r.success ? 'success' : 'warning');
        UI.showBuildingDetail(d.id);
    });
    UI.registerAction('fireManagerUI', function(_t, d) {
        if (!Player.fireManager) { UI.toast('Feature not available.', 'warning'); return; }
        var r = Player.fireManager(d.id);
        UI.toast(r.message, r.success ? 'success' : 'warning');
        UI.showBuildingDetail(d.id);
    });
    UI.registerAction('toggleManagerCaravansUI', function(_t, d) {
        if (!Player.toggleManagerCaravans) { UI.toast('Feature not available.', 'warning'); return; }
        var r = Player.toggleManagerCaravans(d.id);
        UI.toast(r.message, r.success ? 'info' : 'warning');
        UI.showBuildingDetail(d.id);
    });
    UI.registerAction('respondManagerRaiseUI', function(_t, d) {
        if (!Player.respondToManagerRaise) { UI.toast('Feature not available.', 'warning'); return; }
        var accept = d.val === 'accept';
        var r = Player.respondToManagerRaise(d.id, accept);
        UI.toast(r.message, accept ? 'success' : 'info');
        UI.showBuildingDetail(d.id);
    });
    UI.registerAction('nameBuildingUI', function(_t, d) {
        var current = '';
        var pState = Player.state;
        if (pState && pState.buildings) {
            var b = pState.buildings.find(function(bb) { return bb.id === d.id; });
            if (b) current = b._repName || '';
        }
        var name = prompt('Enter a name for your shop (2-40 characters):', current);
        if (name !== null && name.length >= 2) {
            var r = Player.nameBuildingRetail(d.id, name);
            UI.toast(r.message, r.success ? 'success' : 'warning');
            UI.showBuildingDetail(d.id);
        }
    });

    // =========================================================================
    // Building Detail Popup — shows info about a building type in a town
    // Used by town market badges + quest interactions (search for evidence, etc.)
    // =========================================================================

    var _WORKABLE_BUILDINGS = {
        bakery:1, blacksmith:1, smelter:1, toolsmith:1, dock:1, fishery:1,
        warehouse:1, market_stall:1, wheat_farm:1, sheep_farm:1, chicken_farm:1,
        hemp_farm:1, tailor:1, weaver:1, lumber_camp:1, iron_mine:1, gold_mine:1, quarry:1
    };
    function _isWorkableBuilding(type) { return !!_WORKABLE_BUILDINGS[type]; }

    function openBuildingDetail(buildingType, townId) {
        var town = Engine.findTown(townId);
        if (!town) { toast('Town not found.', 'warning'); return; }
        var bt = Engine.findBuildingType ? Engine.findBuildingType(buildingType) : null;
        var bName = bt ? bt.name : buildingType;
        var bIcon = bt ? (bt.icon || '🏠') : '🏠';

        // Find all buildings of this type in the town
        var buildings = (town.buildings || []).filter(function(b) { return b.type === buildingType; });

        var html = '<div style="max-height:450px;overflow-y:auto;padding:4px;">';

        // Building type header
        html += '<div style="background:rgba(0,0,0,0.2);padding:8px;border-radius:6px;margin-bottom:8px;">';
        html += '<div style="font-size:1rem;color:#d4c9a0;margin-bottom:4px;">' + bIcon + ' ' + bName + '</div>';
        if (bt && bt.desc) html += '<div style="font-size:0.72rem;color:#aaa;margin-bottom:4px;">' + bt.desc + '</div>';

        // Building type stats
        html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:0.68rem;">';
        html += '<div style="color:#888;">Count in town: <span style="color:#d4c9a0;">' + buildings.length + '</span></div>';
        if (bt && bt.category) html += '<div style="color:#888;">Category: <span style="color:#5dade2;">' + bt.category + '</span></div>';
        if (bt && bt.buildCost) html += '<div style="color:#888;">Build cost: <span style="color:#e0c58a;">' + bt.buildCost + 'g</span></div>';
        if (bt && bt.maxWorkers) html += '<div style="color:#888;">Max workers: <span style="color:#d4c9a0;">' + bt.maxWorkers + '</span></div>';
        if (bt && bt.produces) {
            var prodName = bt.produces;
            var prodDef = CONFIG.ITEMS ? CONFIG.ITEMS[prodName] : null;
            html += '<div style="color:#888;">Produces: <span style="color:#55a868;">' + (prodDef ? prodDef.name : prodName) + '</span></div>';
        }
        if (bt && bt.requires) {
            var reqNames = [];
            var reqs = Array.isArray(bt.requires) ? bt.requires : [bt.requires];
            for (var _ri = 0; _ri < reqs.length; _ri++) {
                var _rd = CONFIG.ITEMS ? CONFIG.ITEMS[reqs[_ri]] : null;
                reqNames.push(_rd ? _rd.name : reqs[_ri]);
            }
            html += '<div style="color:#888;">Requires: <span style="color:#e67e22;">' + reqNames.join(', ') + '</span></div>';
        }
        html += '</div></div>';

        // Individual buildings
        if (buildings.length > 0) {
            html += '<div style="font-size:0.8rem;color:#d4a843;margin-bottom:4px;">📋 Individual Buildings</div>';
            for (var _bi = 0; _bi < buildings.length; _bi++) {
                var bld = buildings[_bi];
                var ownerName = 'Unknown';
                if (bld.ownerId === 'player') ownerName = 'You';
                else if (bld.ownerId) {
                    var _ow = Engine.findPerson(bld.ownerId);
                    if (_ow) ownerName = (_ow.firstName || '') + ' ' + (_ow.lastName || '');
                    else {
                        var _owK = Engine.findKingdom(bld.ownerId);
                        if (_owK) ownerName = _owK.name + ' (Kingdom)';
                    }
                }
                var cond = bld.condition || 'good';
                var condColor = cond === 'good' || cond === 'new' ? '#55a868' : cond === 'worn' ? '#e67e22' : cond === 'damaged' ? '#c44e52' : cond === 'under_construction' ? '#5dade2' : '#d4c9a0';

                html += '<div style="background:rgba(0,0,0,0.15);padding:6px;border-radius:4px;margin-bottom:4px;border-left:3px solid ' + condColor + ';cursor:pointer;" data-action="_toggleBldExpand" data-id="bldExpand_' + _bi + '">';
                html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
                html += '<span style="font-size:0.72rem;color:#d4c9a0;">' + bIcon + ' Lv.' + (bld.level || 1) + '</span>';
                html += '<span style="font-size:0.65rem;color:' + condColor + ';">' + cond + ' <span style="opacity:0.5;font-size:0.6rem;">▼</span></span>';
                html += '</div>';
                html += '<div style="font-size:0.65rem;color:#888;">Owner: ' + ownerName + '</div>';

                // Expandable detail section
                html += '<div id="bldExpand_' + _bi + '" style="display:none;margin-top:4px;padding-top:4px;border-top:1px solid rgba(255,255,255,0.06);">';

                // Workers
                var workers = bld.workers || [];
                if (workers.length > 0 || (bt && bt.maxWorkers)) {
                    html += '<div style="font-size:0.65rem;color:#888;">👷 Workers: ' + workers.length + '/' + (bt && bt.maxWorkers ? bt.maxWorkers : '?') + '</div>';
                }

                // Production rate (level affects rate)
                if (bt && bt.produces) {
                    var _prodRate = bt.rate || 1;
                    var _lvlMult = 1 + ((bld.level || 1) - 1) * 0.15;
                    var _condMult = cond === 'damaged' ? 0.5 : cond === 'worn' ? 0.75 : cond === 'used' ? 0.9 : 1.0;
                    var _wMult = workers.length > 0 ? 1 : 0.3;
                    var _dailyOut = (_prodRate * _lvlMult * _condMult * _wMult).toFixed(1);
                    var _prodDef = CONFIG.ITEMS ? CONFIG.ITEMS[bt.produces] : null;
                    html += '<div style="font-size:0.65rem;color:#55a868;">⚙️ Output: ~' + _dailyOut + ' ' + (_prodDef ? _prodDef.name : bt.produces) + '/day</div>';
                }

                // Building age
                if (bld.builtDay != null && typeof Engine !== 'undefined' && Engine.getDay) {
                    var _age = Engine.getDay() - bld.builtDay;
                    var _ageYears = (_age / (CONFIG.DAYS_PER_SEASON || 90)).toFixed(1);
                    if (_age > 0) html += '<div style="font-size:0.65rem;color:#888;">📅 Age: ' + _ageYears + ' years (' + _age + ' days)</div>';
                }

                // Output buffer
                if (bld.outputBuffer) {
                    var outKeys = Object.keys(bld.outputBuffer).filter(function(k) { return bld.outputBuffer[k] > 0; });
                    if (outKeys.length > 0) {
                        var outStr = outKeys.map(function(k) {
                            var _od = CONFIG.ITEMS ? CONFIG.ITEMS[k] : null;
                            return (_od ? _od.name : k) + ': ' + Math.floor(bld.outputBuffer[k]);
                        }).join(', ');
                        html += '<div style="font-size:0.65rem;color:#55a868;">📦 Stock: ' + outStr + '</div>';
                    }
                }

                // For sale indicator
                if (bld.forSale) {
                    html += '<div style="font-size:0.65rem;color:#5ac85a;">💰 For sale: ' + Math.ceil(bld.forSalePrice || 0) + 'g</div>';
                }

                // Player-owned building: link to management
                if (bld.ownerId === 'player' && bld.id) {
                    html += '<button class="btn-medieval" data-action="showBuildingDetail" data-id="' + bld.id + '" style="font-size:0.6rem;padding:2px 6px;margin-top:3px;">🔧 Manage</button>';
                }

                // Enter/shop at NPC retail buildings
                if (bld.ownerId !== 'player' && bt && bt.retailConfig && bld.condition !== 'destroyed' && bld.condition !== 'under_construction') {
                    var _shopLabel = bt.category === 'service' ? '🛁 Visit' : bt.retailConfig.npcMotivation === 'happiness' ? '🍺 Visit' : '🛒 Shop Here';
                    var _bldIdx2 = town.buildings.indexOf(bld);
                    html += '<button class="btn-medieval" data-action="enterNPCRetailShop" data-id="' + townId + '" data-val="' + _bldIdx2 + '" style="font-size:0.6rem;padding:2px 6px;margin-top:3px;">' + _shopLabel + '</button>';
                }

                // Work at this building (if workable and player doesn't own it)
                if (bld.ownerId !== 'player' && bld.condition !== 'destroyed' && bld.condition !== 'under_construction' && _isWorkableBuilding(buildingType)) {
                    var _isHere = typeof Player !== 'undefined' && Player.townId === townId && !Player.traveling;
                    if (_isHere) {
                        var _bldIdx3 = town.buildings.indexOf(bld);
                        html += ' <button class="btn-medieval" data-action="workAtSpecificBuilding" data-id="' + townId + '" data-val="' + _bldIdx3 + '" style="font-size:0.6rem;padding:2px 6px;margin-top:3px;background:rgba(85,168,104,0.2);border-color:rgba(85,168,104,0.4);">💼 Work Here</button>';
                    }
                }

                html += '</div>'; // close expandable section
                html += '</div>'; // close building entry
            }
        }

        // Quest interaction buttons — search for evidence, etc.
        var _questButtons = _getBuildingQuestButtons(buildingType, townId);
        if (_questButtons) html += _questButtons;

        html += '</div>';
        openModal(bIcon + ' ' + bName + ' — ' + town.name, html, '<button class="btn-medieval" data-action="openTownMarket">← Market</button> <button class="btn-medieval" data-action="closeModal">Close</button>');
    }

    // Returns HTML for quest-related buttons on building detail (search for evidence, etc.)
    function _getBuildingQuestButtons(buildingType, townId) {
        if (!Player.state || !Player.state.kingState) return '';
        var kingdom = Engine.findKingdom(Player.state.kingState.kingdomId);
        if (!kingdom) return '';

        var html = '';
        // Check active directives for interactive steps targeting this building type/town
        var directives = kingdom._kingDirectives || [];
        var playerDirectives = Player.state._activeDirectives || [];
        // Also check the nobility directives (player's own royal directives)
        var allDirectives = directives.concat(playerDirectives);

        for (var _di = 0; _di < allDirectives.length; _di++) {
            var dir = allDirectives[_di];
            if (!dir.interactiveData) continue;
            var iData = dir.interactiveData;

            // Evidence search step
            if (iData.currentStep === 'gather_evidence' && iData.evidenceBuildings) {
                for (var _ei = 0; _ei < iData.evidenceBuildings.length; _ei++) {
                    var eb = iData.evidenceBuildings[_ei];
                    if (eb.townId === townId && eb.buildingType === buildingType && !eb.searched) {
                        html += '<div style="background:rgba(212,168,67,0.15);padding:8px;border-radius:6px;border:1px solid rgba(212,168,67,0.3);margin-top:8px;">';
                        html += '<div style="font-size:0.8rem;color:#d4a843;">🔍 Royal Directive: Search for Evidence</div>';
                        html += '<div style="font-size:0.68rem;color:#aaa;margin:4px 0;">Your directive requires searching this building for evidence of ' + (dir.title || 'criminal activity') + '.</div>';
                        html += '<button class="btn-medieval" data-action="searchBuildingEvidence" data-id="' + _di + '" data-val="' + _ei + '" style="font-size:0.72rem;padding:4px 10px;">🔍 Search for Evidence</button>';
                        html += '</div>';
                    }
                }
            }
        }

        // Check kingdom quest interactive data for search_buildings targets
        var kqInteractive = Player.state._kqInteractiveData || {};
        for (var qid in kqInteractive) {
            var qiData = kqInteractive[qid];
            if (!qiData || qiData.type !== 'search_buildings') continue;
            for (var _ti = 0; _ti < qiData.targets.length; _ti++) {
                var tgt = qiData.targets[_ti];
                if (tgt.townId === townId && tgt.buildingType === buildingType && !tgt.searched) {
                    // Find the quest title
                    var questTitle = '';
                    try {
                        var kqData = Player.state.kingdomQuests || {};
                        for (var kid in kqData) {
                            var active = kqData[kid].active || [];
                            for (var qi = 0; qi < active.length; qi++) {
                                if (active[qi].id === qid) { questTitle = active[qi].title; break; }
                            }
                            if (questTitle) break;
                        }
                    } catch(e) {}
                    var safQid = qid.replace(/"/g, '&quot;');
                    html += '<div style="background:rgba(212,168,67,0.15);padding:8px;border-radius:6px;border:1px solid rgba(212,168,67,0.3);margin-top:8px;">';
                    html += '<div style="font-size:0.8rem;color:#d4a843;">🔍 Kingdom Quest: Search for Evidence</div>';
                    if (questTitle) html += '<div style="font-size:0.65rem;color:#aaa;margin:2px 0;">Quest: ' + UI.escapeHtml(questTitle) + '</div>';
                    html += '<div style="font-size:0.68rem;color:#aaa;margin:4px 0;">Search this building for evidence. (' + (qiData.evidenceFound || 0) + '/' + qiData.evidenceNeeded + ' found)</div>';
                    html += '<button class="btn-medieval" data-action="searchBuildingForQuestUI" data-id="' + safQid + '" data-val="' + _ti + '" style="font-size:0.72rem;padding:4px 10px;">🔍 Search for Evidence</button>';
                    html += '</div>';
                }
            }
        }

        return html;
    }

    UI.openBuildingDetail = openBuildingDetail;

    // ── NPC Retail Shop Interaction ──
    function enterNPCRetailShop(townId, buildingIndex) {
        var town = Engine.findTown(townId);
        if (!town) { toast('Town not found.', 'warning'); return; }
        var bld = town.buildings[buildingIndex];
        if (!bld) { toast('Building not found.', 'warning'); return; }
        var bt = Engine.findBuildingType ? Engine.findBuildingType(bld.type) : null;
        if (!bt || !bt.retailConfig) { toast('This is not a shop.', 'warning'); return; }

        var rc = bt.retailConfig;
        var bIcon = bt.icon || '🏠';
        var bName = bld._repName || bt.name;
        var ownerName = 'Unknown';
        if (bld.ownerId) {
            var owner = Engine.findPerson(bld.ownerId);
            if (owner) ownerName = (owner.firstName || '') + ' ' + (owner.lastName || '');
            else {
                var k = Engine.findKingdom(bld.ownerId);
                if (k) ownerName = k.name + ' (Crown)';
            }
        }

        var html = '<div style="max-height:450px;overflow-y:auto;padding:4px;">';
        html += '<div style="background:rgba(0,0,0,0.2);padding:8px;border-radius:6px;margin-bottom:8px;">';
        html += '<div style="font-size:1rem;color:#d4c9a0;">' + bIcon + ' ' + bName + '</div>';
        html += '<div style="font-size:0.72rem;color:#aaa;">Owner: ' + ownerName + ' | Level ' + (bld.level || 1) + '</div>';
        if (bld._reputation != null) {
            var repLbl = bld._reputation >= 80 ? '⭐ Famous' : bld._reputation >= 60 ? '👍 Popular' : bld._reputation >= 40 ? 'Known' : bld._reputation >= 20 ? 'New' : 'Unknown';
            html += '<div style="font-size:0.68rem;color:#888;">Reputation: ' + Math.round(bld._reputation) + '/100 (' + repLbl + ')</div>';
        }
        html += '</div>';

        // Available goods for purchase
        var stock = bld.retailStock || bld.outputBuffer || {};
        var acceptsGoods = rc.acceptsGoods || [];
        var markup = bld._retailMarkup || rc.baseMarkup || 1.3;
        var hasStock = false;

        // Service buildings (clinic, bathhouse)
        if (rc.serviceFee) {
            html += '<div style="padding:6px;border:1px solid var(--border);border-radius:4px;margin-bottom:6px;">';
            html += '<div style="font-weight:bold;font-size:0.8rem;margin-bottom:4px;">🛎️ Services</div>';
            var canServe = true;
            if (rc.consumesPerService) {
                for (var sRes in rc.consumesPerService) {
                    var sNeeded = rc.consumesPerService[sRes];
                    var sHave = (stock[sRes] || 0);
                    if (sHave < sNeeded) canServe = false;
                }
            }
            var fee = rc.serviceFee * markup;
            var canAfford = (Player.gold || 0) >= fee;
            var serviceLabel = bld.type === 'clinic' ? '💊 Get Treatment' : bld.type === 'bathhouse' ? '🛁 Take a Bath' : '🛎️ Use Service';
            var serviceDesc = bld.type === 'clinic' ? 'Treats illness and disease. Reduces plague risk.' : bld.type === 'bathhouse' ? 'Improves hygiene and health. Reduces disease risk.' : 'Use this service.';
            html += '<div style="font-size:0.72rem;color:#aaa;margin-bottom:4px;">' + serviceDesc + '</div>';
            html += '<div style="font-size:0.75rem;">Cost: <span style="color:#ffd700;">' + Math.ceil(fee) + 'g</span></div>';
            if (canServe && canAfford) {
                html += '<button class="btn-medieval" style="font-size:0.7rem;padding:3px 8px;margin-top:4px;" data-action="useNPCServiceUI" data-id="' + townId + '" data-val="' + buildingIndex + '">' + serviceLabel + '</button>';
            } else if (!canServe) {
                html += '<div style="font-size:0.68rem;color:#c44e52;margin-top:3px;">⚠️ Out of supplies</div>';
            } else {
                html += '<div style="font-size:0.68rem;color:#c44e52;margin-top:3px;">⚠️ Not enough gold</div>';
            }
            html += '</div>';
        }

        // Goods for sale
        html += '<div style="padding:6px;border:1px solid var(--border);border-radius:4px;margin-bottom:6px;">';
        html += '<div style="font-weight:bold;font-size:0.8rem;margin-bottom:4px;">📦 Goods For Sale</div>';
        var goodsHtml = '';
        for (var gi = 0; gi < acceptsGoods.length; gi++) {
            var gid = acceptsGoods[gi];
            var qty = stock[gid] || 0;
            if (qty <= 0) continue;
            hasStock = true;
            var gDef = CONFIG.ITEMS ? CONFIG.ITEMS[gid] : null;
            var gName = gDef ? gDef.name : gid;
            var basePrice = gDef ? (gDef.basePrice || 5) : 5;
            // Check local market price for comparison
            var mktPrice = (town.market && town.market.prices && town.market.prices[gid]) || basePrice;
            var shopPrice = Math.ceil(mktPrice * markup);
            var canBuy = (Player.gold || 0) >= shopPrice;
            var priceDiff = shopPrice > mktPrice ? ' <span style="color:#c44e52;font-size:0.6rem;">(+' + Math.round((markup - 1) * 100) + '% markup)</span>' : '';
            goodsHtml += '<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0;border-bottom:1px solid rgba(255,255,255,0.05);">';
            goodsHtml += '<span style="font-size:0.72rem;">' + gName + ' <span style="color:#888;">×' + Math.floor(qty) + '</span></span>';
            goodsHtml += '<span style="font-size:0.7rem;">';
            goodsHtml += '<span style="color:#ffd700;">' + shopPrice + 'g</span>' + priceDiff + ' ';
            if (canBuy) {
                goodsHtml += '<button class="btn-medieval" style="font-size:0.6rem;padding:2px 6px;" data-action="buyFromNPCShopUI" data-id="' + townId + '" data-val="' + buildingIndex + '" data-qty="' + gid + '">Buy 1</button>';
                if (qty >= 5 && (Player.gold || 0) >= shopPrice * 5) {
                    goodsHtml += ' <button class="btn-medieval" style="font-size:0.6rem;padding:2px 6px;" data-action="buyFromNPCShop5UI" data-id="' + townId + '" data-val="' + buildingIndex + '" data-qty="' + gid + '">Buy 5</button>';
                }
            }
            goodsHtml += '</span></div>';
        }
        if (!hasStock && !rc.serviceFee) {
            goodsHtml = '<div style="font-size:0.72rem;color:#888;">This shop has no stock right now.</div>';
        }
        html += goodsHtml;
        html += '</div>';

        // Social interaction (tavern: drink and converse; restaurant: eat)
        if (bld.type === 'tavern') {
            html += '<div style="padding:6px;border:1px solid var(--border);border-radius:4px;margin-bottom:6px;">';
            html += '<div style="font-weight:bold;font-size:0.8rem;margin-bottom:4px;">🍻 Tavern Activities</div>';
            var aleQty = (stock.ale || 0) + (stock.mead || 0) + (stock.wine || 0) + (stock.cider || 0);
            if (aleQty > 0) {
                var drinkPrice = Math.ceil(((town.market && town.market.prices && town.market.prices.ale) || 3) * markup);
                html += '<button class="btn-medieval" style="font-size:0.7rem;padding:3px 8px;margin-right:4px;" data-action="tavernDrinkUI" data-id="' + townId + '" data-val="' + buildingIndex + '">🍺 Have a Drink (' + drinkPrice + 'g)</button>';
            }
            html += '<button class="btn-medieval" style="font-size:0.7rem;padding:3px 8px;" data-action="tavernConverseUI" data-id="' + townId + '" data-val="' + buildingIndex + '">💬 Chat with Patrons</button>';
            html += '</div>';
        }

        // Player performance (if musician)
        var pState = Player.state;
        if (bld.type === 'tavern' && pState && pState.skills && pState.skills.musician) {
            var hasInstrument = pState.inventory && (pState.inventory.lute || pState.inventory.drum || pState.inventory.flute || pState.inventory.harp);
            html += '<div style="padding:6px;border:1px solid rgba(200,160,80,0.3);border-radius:4px;margin-bottom:6px;background:rgba(200,160,80,0.05);">';
            html += '<div style="font-weight:bold;font-size:0.8rem;margin-bottom:4px;">🎵 Perform</div>';
            if (hasInstrument) {
                html += '<button class="btn-medieval" style="font-size:0.7rem;padding:3px 8px;" data-action="tavernPerformUI" data-id="' + townId + '" data-val="' + buildingIndex + '">🎶 Perform for Tips</button>';
            } else {
                html += '<div style="font-size:0.68rem;color:#888;">You need an instrument to perform.</div>';
            }
            html += '</div>';
        }

        html += '<div style="font-size:0.65rem;color:#666;margin-top:6px;">💰 Your gold: <span style="color:#ffd700;">' + Math.floor(Player.gold || 0) + 'g</span></div>';
        html += '</div>';

        openModal(bIcon + ' ' + bName, html, '<button class="btn-medieval" data-action="openBuildingDetail" data-id="' + bld.type + '" data-val="' + townId + '">← Back</button> <button class="btn-medieval" data-action="closeModal">Close</button>');
    }

    // Buy goods from NPC shop
    function buyFromNPCShop(townId, buildingIndex, resourceId, quantity) {
        var town = Engine.findTown(townId);
        if (!town) { toast('Town not found.', 'warning'); return; }
        var bld = town.buildings[buildingIndex];
        if (!bld) { toast('Building not found.', 'warning'); return; }
        var bt = Engine.findBuildingType ? Engine.findBuildingType(bld.type) : null;
        if (!bt || !bt.retailConfig) { toast('Not a shop.', 'warning'); return; }

        var stock = bld.retailStock || bld.outputBuffer || {};
        var available = stock[resourceId] || 0;
        var qty = Math.min(quantity, Math.floor(available));
        if (qty <= 0) { toast('Item not in stock.', 'warning'); return; }

        var markup = bld._retailMarkup || bt.retailConfig.baseMarkup || 1.3;
        var mktPrice = (town.market && town.market.prices && town.market.prices[resourceId]) || 5;
        var shopPrice = Math.ceil(mktPrice * markup);
        var totalCost = shopPrice * qty;

        if ((Player.gold || 0) < totalCost) { toast('Not enough gold.', 'warning'); return; }

        // Execute purchase
        Player.state.gold -= totalCost;
        if (bld.retailStock) bld.retailStock[resourceId] = (bld.retailStock[resourceId] || 0) - qty;
        else if (bld.outputBuffer) bld.outputBuffer[resourceId] = (bld.outputBuffer[resourceId] || 0) - qty;

        // Revenue goes to building owner
        if (bld.ownerId && bld.ownerId !== 'player') {
            var owner = Engine.findPerson(bld.ownerId);
            if (owner) owner.gold = (owner.gold || 0) + totalCost;
        }

        // Add to player inventory
        if (!Player.state.inventory) Player.state.inventory = {};
        Player.state.inventory[resourceId] = (Player.state.inventory[resourceId] || 0) + qty;

        // Track stats
        Player.state.stats = Player.state.stats || {};
        Player.state.stats.totalGoldSpent = (Player.state.stats.totalGoldSpent || 0) + totalCost;

        // Building reputation boost from sale
        if (bld._reputation != null) {
            bld._reputation = Math.min(100, bld._reputation + (bt.retailConfig.repPerSale || 0.1));
        }

        var gDef = CONFIG.ITEMS ? CONFIG.ITEMS[resourceId] : null;
        var gName = gDef ? gDef.name : resourceId;
        toast('Bought ' + qty + ' ' + gName + ' for ' + totalCost + 'g.', 'success');
        enterNPCRetailShop(townId, buildingIndex);
    }

    // Use NPC service (clinic, bathhouse)
    function useNPCService(townId, buildingIndex) {
        var town = Engine.findTown(townId);
        if (!town) { toast('Town not found.', 'warning'); return; }
        var bld = town.buildings[buildingIndex];
        if (!bld) { toast('Building not found.', 'warning'); return; }
        var bt = Engine.findBuildingType ? Engine.findBuildingType(bld.type) : null;
        if (!bt || !bt.retailConfig || !bt.retailConfig.serviceFee) { toast('No service available.', 'warning'); return; }

        var rc = bt.retailConfig;
        var markup = bld._retailMarkup || rc.baseMarkup || 1.0;
        var fee = Math.ceil(rc.serviceFee * markup);
        var stock = bld.retailStock || bld.outputBuffer || {};

        if ((Player.gold || 0) < fee) { toast('Not enough gold.', 'warning'); return; }

        // Check supplies
        if (rc.consumesPerService) {
            for (var sRes in rc.consumesPerService) {
                if ((stock[sRes] || 0) < rc.consumesPerService[sRes]) {
                    toast('Shop is out of supplies.', 'warning'); return;
                }
            }
            // Consume supplies
            for (var cRes in rc.consumesPerService) {
                if (bld.retailStock) bld.retailStock[cRes] = (bld.retailStock[cRes] || 0) - rc.consumesPerService[cRes];
                else if (bld.outputBuffer) bld.outputBuffer[cRes] = (bld.outputBuffer[cRes] || 0) - rc.consumesPerService[cRes];
            }
        }

        Player.state.gold -= fee;
        Player.state.stats = Player.state.stats || {};
        Player.state.stats.totalGoldSpent = (Player.state.stats.totalGoldSpent || 0) + fee;

        // Owner gets revenue
        if (bld.ownerId && bld.ownerId !== 'player') {
            var owner = Engine.findPerson(bld.ownerId);
            if (owner) owner.gold = (owner.gold || 0) + fee;
        }

        // Apply health effects
        var ps = Player.state;
        if (bld.type === 'clinic') {
            if (ps.health != null) ps.health = Math.min(100, ps.health + 15);
            if (ps.diseased) { ps.diseased = false; toast('💊 Treatment received! Disease cured. (-' + fee + 'g)', 'success'); }
            else { toast('💊 Treated at clinic. Health improved. (-' + fee + 'g)', 'success'); }
        } else if (bld.type === 'bathhouse') {
            if (ps.hygiene != null) ps.hygiene = Math.min(100, ps.hygiene + 25);
            if (ps.health != null) ps.health = Math.min(100, ps.health + 5);
            toast('🛁 Refreshing bath taken! Hygiene and health improved. (-' + fee + 'g)', 'success');
        } else {
            toast('🛎️ Service used. (-' + fee + 'g)', 'success');
        }

        enterNPCRetailShop(townId, buildingIndex);
    }

    // Tavern activities
    function tavernDrink(townId, buildingIndex) {
        var town = Engine.findTown(townId);
        if (!town) return;
        var bld = town.buildings[buildingIndex];
        if (!bld) return;
        var stock = bld.retailStock || bld.outputBuffer || {};
        var drinkType = stock.ale > 0 ? 'ale' : stock.mead > 0 ? 'mead' : stock.wine > 0 ? 'wine' : stock.cider > 0 ? 'cider' : null;
        if (!drinkType) { toast('No drinks available.', 'warning'); return; }

        var bt = Engine.findBuildingType ? Engine.findBuildingType(bld.type) : null;
        var markup = (bld._retailMarkup || (bt && bt.retailConfig ? bt.retailConfig.baseMarkup : 1.5));
        var price = Math.ceil(((town.market && town.market.prices && town.market.prices[drinkType]) || 3) * markup);
        if ((Player.gold || 0) < price) { toast('Not enough gold for a drink.', 'warning'); return; }

        Player.state.gold -= price;
        if (bld.retailStock) bld.retailStock[drinkType] = (bld.retailStock[drinkType] || 0) - 1;
        else if (bld.outputBuffer) bld.outputBuffer[drinkType] = (bld.outputBuffer[drinkType] || 0) - 1;
        if (bld.ownerId && bld.ownerId !== 'player') {
            var owner = Engine.findPerson(bld.ownerId);
            if (owner) owner.gold = (owner.gold || 0) + price;
        }

        // Social/happiness effects
        var ps = Player.state;
        ps.happiness = Math.min(100, (ps.happiness || 50) + 3);
        ps.xp = (ps.xp || 0) + 1;

        var drinkName = drinkType.charAt(0).toUpperCase() + drinkType.slice(1);
        toast('🍺 Enjoyed a ' + drinkName + '! Happiness +3. (-' + price + 'g)', 'success');
        enterNPCRetailShop(townId, buildingIndex);
    }

    function tavernConverse(townId, buildingIndex) {
        var town = Engine.findTown(townId);
        if (!town) return;
        // Generate a random rumor or social interaction
        var rumors = [
            'A merchant whispers about high prices for silk in the north.',
            'A traveler mentions bandits on the eastern road.',
            'You hear gossip about the king\'s latest feast.',
            'A farmer complains about the poor harvest this season.',
            'A soldier boasts about a recent battle victory.',
            'Someone mentions a new trade route opening soon.',
            'A noble\'s servant hints at political intrigue at court.',
            'You overhear talk of a wealthy merchant looking for partners.',
        ];
        var rng = Engine.getRng ? Engine.getRng() : null;
        var rumor = rumors[rng ? Math.floor(rng.random() * rumors.length) : Math.floor(Math.random() * rumors.length)];

        // Slight social/fame boost
        var ps = Player.state;
        ps.fame = Math.min(1000, (ps.fame || 0) + 1);
        ps.xp = (ps.xp || 0) + 1;

        toast('💬 ' + rumor + ' (+1 fame, +1 XP)', 'info');
    }

    UI.enterNPCRetailShop = enterNPCRetailShop;
    UI.buyFromNPCShop = buyFromNPCShop;
    UI.useNPCService = useNPCService;
    UI.tavernDrink = tavernDrink;
    UI.tavernConverse = tavernConverse;

    // Work at a specific building from the building detail popup
    function _workAtSpecificBuilding(townId, bldIdx) {
        if (typeof Player === 'undefined') return;
        if (Player.traveling) { toast('Cannot work while traveling.', 'warning'); return; }
        var town = Engine.findTown(townId);
        if (!town || !town.buildings || bldIdx < 0 || bldIdx >= town.buildings.length) {
            toast('Building not found.', 'warning'); return;
        }
        var bld = town.buildings[bldIdx];
        if (bld.ownerId === 'player') { toast('You own this building — manage it from Buildings.', 'info'); return; }
        if (bld.condition === 'destroyed' || bld.condition === 'under_construction') {
            toast('This building is not operational.', 'warning'); return;
        }
        // Find matching job index from getAvailableJobs
        var jobs = Player.getAvailableJobs();
        var matchIdx = -1;
        for (var i = 0; i < jobs.length; i++) {
            if (jobs[i].buildingType === bld.type && jobs[i].type === 'building') {
                matchIdx = i; break;
            }
        }
        if (matchIdx === -1) {
            // Try apprentice jobs
            for (var j = 0; j < jobs.length; j++) {
                if (jobs[j].buildingType === bld.type && jobs[j].type === 'apprentice') {
                    matchIdx = j; break;
                }
            }
        }
        if (matchIdx === -1) {
            toast('No work available at this building right now.', 'warning'); return;
        }
        var result = Player.doWork(matchIdx);
        if (result.success) {
            toast(result.message, 'success');
            closeModal();
        } else {
            toast(result.message, 'warning');
        }
    }

    UI.registerAction('openBuildingDetail', function(_t, d) { UI.openBuildingDetail(d.id, d.val); });
    UI.registerAction('workAtSpecificBuilding', function(_t, d) { _workAtSpecificBuilding(d.id, parseInt(d.val)); });
    UI.registerAction('_toggleBldExpand', function(_t, d) {
        var el = document.getElementById(d.id);
        if (el) el.style.display = el.style.display === 'none' ? '' : 'none';
    });
    UI.registerAction('searchBuildingEvidence', function(_t, d) {
        var r = Player.searchBuildingForEvidence ? Player.searchBuildingForEvidence(parseInt(d.id), parseInt(d.val)) : { success: false, message: 'Evidence search not available.' };
        UI.toast(r.message, r.success ? 'success' : 'warning');
        if (r.success) UI.openTownMarket();
    });
    UI.registerAction('searchBuildingForQuestUI', function(_t, d) {
        var r = Player.searchBuildingForEvidence ? Player.searchBuildingForEvidence(d.id, parseInt(d.val)) : { success: false, message: 'Evidence search not available.' };
        UI.toast(r.message, r.success ? 'success' : 'warning');
        if (r.success) UI.openTownMarket();
    });

    // NPC Retail Shop actions
    UI.registerAction('enterNPCRetailShop', function(_t, d) { UI.enterNPCRetailShop(d.id, parseInt(d.val)); });
    UI.registerAction('buyFromNPCShopUI', function(_t, d) { UI.buyFromNPCShop(d.id, parseInt(d.val), d.qty, 1); });
    UI.registerAction('buyFromNPCShop5UI', function(_t, d) { UI.buyFromNPCShop(d.id, parseInt(d.val), d.qty, 5); });
    UI.registerAction('useNPCServiceUI', function(_t, d) { UI.useNPCService(d.id, parseInt(d.val)); });
    UI.registerAction('tavernDrinkUI', function(_t, d) { UI.tavernDrink ? UI.tavernDrink(d.id, parseInt(d.val)) : null; });
    UI.registerAction('tavernConverseUI', function(_t, d) { UI.tavernConverse ? UI.tavernConverse(d.id, parseInt(d.val)) : null; });
    UI.registerAction('tavernPerformUI', function(_t, d) {
        // Perform at tavern for tips
        var ps = Player.state;
        if (!ps) return;
        var rng = Engine.getRng ? Engine.getRng() : null;
        var skillMult = ps.skills && ps.skills.musician ? 1.5 : 0.8;
        var tips = Math.floor((5 + (rng ? Math.floor(rng.random() * 10) : 5)) * skillMult);
        ps.gold = (ps.gold || 0) + tips;
        ps.fame = Math.min(1000, (ps.fame || 0) + 2);
        ps.xp = (ps.xp || 0) + 3;
        ps.stats = ps.stats || {};
        ps.stats.totalGoldEarned = (ps.stats.totalGoldEarned || 0) + tips;
        UI.toast('🎶 You performed at the tavern! Earned ' + tips + 'g in tips. (+2 fame, +3 XP)', 'success');
    });

})(window.UI);