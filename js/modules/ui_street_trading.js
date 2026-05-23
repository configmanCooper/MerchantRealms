// ============================================================
// Merchant Realms — UI Street Trading Module (extracted from ui.js)
// Extends window.UI with street trading dialog functions
// ============================================================
(function(UI) {
    "use strict";
    if (!UI) throw new Error("UI must be loaded before ui_street_trading.js");

    // Aliases for UI utilities
    var openModal = UI.openModal;
    var closeModal = UI.closeModal;
    var toast = UI.toast;
    var formatGold = UI.formatGold;
    var escapeHtml = UI.escapeHtml;

    // Selected foreign kingdom for Noble Intrigue tab
    var _selectedForeignKingdom = null;

    // Global refresh function for intrigue tab kingdom dropdown
    window._refreshIntrigueTab = function(kingdomId) {
        var citizenKId = (typeof Player !== 'undefined' && Player.state) ? Player.state.citizenshipKingdomId : null;
        _selectedForeignKingdom = (kingdomId && kingdomId !== citizenKId) ? kingdomId : null;
        if (typeof openNobilityDialog === 'function') openNobilityDialog();
    };

    // ═══════════════════════════════════════════════════════════
    //  STREET TRADING DIALOG
    // ═══════════════════════════════════════════════════════════

function openStreetTrading() {
    if (typeof Player === 'undefined') return;
    if (Player.state && Player.state.storyMode) {
        Player.state.storyMode._openedStreetTrading = true;
    }
    if (typeof StoryMode !== 'undefined' && StoryMode.onPlayerAction) {
        StoryMode.onPlayerAction('open_street_trading', {});
    }
    if (Player.traveling) { toast('Cannot trade while traveling.', 'warning'); return; }

    // Outpost-specific messaging
    var _stTown = Engine.findTown(Player.townId);
    if (_stTown && _stTown.isOutpost) {
        if (!_stTown.outpostResidents || _stTown.outpostResidents.length === 0) {
            toast('No residents at this outpost for street trading.', 'warning'); return;
        }
        if (!_stTown.outpostUpgrades || _stTown.outpostUpgrades.indexOf('market_stall') < 0) {
            toast('Build Market Stalls upgrade to enable street trading here.', 'warning'); return;
        }
        if (!_stTown.workerAssignments || !_stTown.workerAssignments.market_stall) {
            toast('Assign a worker to Market Stalls to enable street trading.', 'warning'); return;
        }
    }

    const trades = Player.getStreetTrades();
    let html = '<p class="street-intro">Local townsfolk looking to buy specific goods at premium prices.</p>';

    if (trades.length === 0) {
        html += '<p>No street trading opportunities right now. Check back in a few days.</p>';
    } else {
        html += '<div class="street-trade-list">';
        for (let i = 0; i < trades.length; i++) {
            const t = trades[i];
            const held = (Player.inventory[t.resourceId] || 0);
            const canSell = held >= t.qty;
            html += '<div class="street-trade-item">';
            html += '<div class="street-trade-info">';
            html += '<span class="street-npc-name">' + t.npcName + '</span> wants ';
            html += '<strong>' + t.qty + ' ' + t.resourceIcon + ' ' + t.resourceName + '</strong>';
            const premiumPct = t.marketPrice > 0 ? Math.round(((t.pricePerUnit - t.marketPrice) / t.marketPrice) * 100) : 0;
            const isBelowMarket = t.pricePerUnit < t.marketPrice;
            const premiumColor = isBelowMarket ? '#c44e52' : '#55a868';
            const premiumSign = premiumPct >= 0 ? '+' : '';
            html += ' — will pay <span class="street-price">' + t.pricePerUnit + 'g each</span>';
            html += ' <span style="color:' + premiumColor + ';font-weight:bold;font-size:0.85em;">';
            html += '(' + premiumSign + premiumPct + '% ' + (isBelowMarket ? 'below' : 'above') + ' market)';
            html += '</span>';
            if (isBelowMarket) {
                html += ' <span style="color:#c44e52;font-weight:bold;">⚠️ Below market price!</span>';
            }
            html += '</div>';
            html += '<div class="street-trade-actions">';
            html += '<span class="street-have">You have: ' + held + '</span>';
            html += '<button class="btn-medieval btn-street-sell" ' + (canSell ? 'data-action="executeStreetTrade" data-idx="' + i + '"' : 'disabled') + '>';
            html += 'Sell ' + t.qty + ' for ' + (t.pricePerUnit * t.qty) + 'g</button>';
            html += '</div>';
            html += '</div>';
        }
        html += '</div>';
    }

    // Skill discount summary for buy offers
    var _sdSkills = [];
    var _sdTotal = 0;
    if (typeof Player !== 'undefined') {
        if (Player.hasSkill('haggler') || Player.hasSkill('master_haggler')) { _sdSkills.push(Player.hasSkill('master_haggler') ? '💰 Master Haggler -10%' : '🤝 Haggler -10%'); _sdTotal += 10; }
        if (Player.hasSkill('silver_tongue') || Player.hasSkill('golden_tongue')) { _sdSkills.push(Player.hasSkill('golden_tongue') ? '👅 Golden Tongue -5%' : '👄 Silver Tongue -5%'); _sdTotal += 5; }
        if (Player.hasSkill('charming') || Player.hasSkill('charismatic')) { _sdSkills.push(Player.hasSkill('charismatic') ? '✨ Charismatic -5%' : '😊 Charming -5%'); _sdTotal += 5; }
        if (Player.hasSkill('black_market_contacts')) { _sdSkills.push('🕶️ Black Market Contacts -10%'); _sdTotal += 10; }
        if (Player.hasSkill('corruption_expert')) { _sdSkills.push('💀 Corruption Expert -5%'); _sdTotal += 5; }
        _sdTotal = Math.min(30, _sdTotal);
    }
    if (_sdSkills.length > 0) {
        html += '<hr style="border-color:#555;margin:12px 0;">';
        html += '<div style="background:rgba(85,168,104,0.12);border:1px solid #55a868;border-radius:6px;padding:6px 10px;margin-bottom:8px;">';
        html += '<span style="color:#55a868;font-weight:bold;">🏷️ Your Skill Discounts on Buy Prices:</span> ';
        html += _sdSkills.join(', ');
        html += ' <span style="color:#55a868;font-weight:bold;">(Total: -' + _sdTotal + '%' + (_sdTotal >= 30 ? ' MAX' : '') + ')</span>';
        html += '</div>';
    }

    // Street BUY offers (contraband + scarce goods from street vendors)
    if (typeof Player !== 'undefined' && Player.getStreetBuyOffers) {
        var buyOffers = Player.getStreetBuyOffers();
        if (buyOffers.length > 0) {
            // Split into contraband and scarce
            var contrabandBuys = buyOffers.filter(function(o) { return o.category === 'contraband'; });
            var scarceBuys = buyOffers.filter(function(o) { return o.category === 'scarce'; });

            if (contrabandBuys.length > 0) {
                html += '<hr style="border-color:#555;margin:12px 0;">';
                html += '<p class="street-intro">🚫 <strong>Buy Contraband</strong> — Shady characters selling banned goods at black market prices.</p>';
                html += '<div class="street-trade-list">';
                for (var bi = 0; bi < contrabandBuys.length; bi++) {
                    var bo = contrabandBuys[bi];
                    var boIdx = buyOffers.indexOf(bo);
                    var boTotal = bo.pricePerUnit * bo.qty;
                    var boCanAfford = (Player.gold || 0) >= boTotal;
                    html += '<div class="street-trade-item" style="border-left:3px solid #c44e52;">';
                    html += '<div class="street-trade-info">';
                    html += '<span class="street-npc-name">' + bo.npcName + '</span> offers ';
                    html += '<strong>' + bo.qty + ' ' + (bo.resourceIcon || '') + ' ' + bo.resourceName + '</strong>';
                    html += ' — price <span class="street-price">' + bo.pricePerUnit + 'g each</span>';
                    html += ' <span style="color:#c44e52;font-weight:bold;font-size:0.85em;cursor:help;" title="Banned items are illegal to make or sell, but legal to buy or own in small amounts.">🚫 Banned</span>';
                    html += '</div>';
                    html += '<div class="street-trade-actions">';
                    html += '<span class="street-have">Total: ' + boTotal + 'g</span>';
                    html += '<button class="btn-medieval btn-street-sell" ' + (boCanAfford ? 'data-action="executeStreetBuyUI" data-idx="' + boIdx + '"' : 'disabled') + '>';
                    html += 'Buy ' + bo.qty + ' for ' + boTotal + 'g</button>';
                    html += '</div></div>';
                }
                html += '</div>';
            }

            if (scarceBuys.length > 0) {
                html += '<hr style="border-color:#555;margin:12px 0;">';
                html += '<p class="street-intro">🛒 <strong>Buy Scarce Goods</strong> — Traveling merchants selling goods not available locally. Above-market prices.</p>';
                html += '<div class="street-trade-list">';
                for (var sbi = 0; sbi < scarceBuys.length; sbi++) {
                    var so = scarceBuys[sbi];
                    var soIdx = buyOffers.indexOf(so);
                    var soTotal = so.pricePerUnit * so.qty;
                    var soCanAfford = (Player.gold || 0) >= soTotal;
                    var soPremPct = so.marketPrice > 0 ? Math.round(((so.pricePerUnit - so.marketPrice) / so.marketPrice) * 100) : 0;
                    html += '<div class="street-trade-item" style="border-left:3px solid #e6c422;">';
                    html += '<div class="street-trade-info">';
                    html += '<span class="street-npc-name">' + so.npcName + '</span> offers ';
                    html += '<strong>' + so.qty + ' ' + (so.resourceIcon || '') + ' ' + so.resourceName + '</strong>';
                    html += ' — <span class="street-price">' + so.pricePerUnit + 'g each</span>';
                    html += ' <span style="color:#e67e22;font-weight:bold;font-size:0.85em;">(+' + soPremPct + '% above market)</span>';
                    html += ' <span style="color:#e6c422;font-size:0.8em;">📦 Not in local market</span>';
                    html += '</div>';
                    html += '<div class="street-trade-actions">';
                    html += '<span class="street-have">Total: ' + soTotal + 'g</span>';
                    html += '<button class="btn-medieval btn-street-sell" ' + (soCanAfford ? 'data-action="executeStreetBuyUI" data-idx="' + soIdx + '"' : 'disabled') + '>';
                    html += 'Buy ' + so.qty + ' for ' + soTotal + 'g</button>';
                    html += '</div></div>';
                }
                html += '</div>';
            }
        }
    }

    // Contraband SELL offers — sell your banned/restricted goods to shady NPCs
    if (typeof Player !== 'undefined' && Player.getStreetContrabandOffers) {
        var contrabandOffers = Player.getStreetContrabandOffers();
        if (contrabandOffers.length > 0) {
            html += '<hr style="border-color:#555;margin:12px 0;">';
            html += '<p class="street-intro">🚫 <strong>Sell Contraband</strong> — Offload banned or restricted goods. Risk of detection and punishment!</p>';
            html += '<div class="street-trade-list">';
            for (var ci = 0; ci < contrabandOffers.length; ci++) {
                var co = contrabandOffers[ci];
                var coHeld = co.heldQty || 0;
                var coCanSell = coHeld > 0;
                var coTotal = co.pricePerUnit * coHeld;
                var coPremiumPct = co.marketPrice > 0 ? Math.round(((co.pricePerUnit - co.marketPrice) / co.marketPrice) * 100) : 0;
                var coLabel = co.isBanned ? '🚫 Banned' : '⚠️ No License';
                var coTooltip = co.isBanned ? 'Banned items are illegal to make or sell, but legal to buy or own in small amounts.' : 'Legal to buy. Illegal to sell or produce without a license. Purchase a license from the Kingdom menu.';
                var coColor = co.isBanned ? '#c44e52' : '#d4a74a';
                html += '<div class="street-trade-item" style="border-left:3px solid ' + coColor + ';">';
                html += '<div class="street-trade-info">';
                html += '<span class="street-npc-name">' + co.npcName + '</span> will buy ';
                html += '<strong>' + co.resourceIcon + ' ' + co.resourceName + '</strong>';
                html += ' — <span class="street-price">' + co.pricePerUnit + 'g each</span>';
                html += ' <span style="color:' + (coPremiumPct >= 0 ? '#55a868' : '#c44e52') + ';font-weight:bold;font-size:0.85em;">';
                html += '(' + (coPremiumPct >= 0 ? '+' : '') + coPremiumPct + '% vs market)</span>';
                html += ' <span style="color:' + coColor + ';font-weight:bold;font-size:0.85em;cursor:help;" title="' + coTooltip + '">' + coLabel + '</span>';
                html += '</div>';
                html += '<div class="street-trade-actions">';
                html += '<span class="street-have">You have: ' + coHeld + '</span>';
                if (coCanSell && coHeld > 1) {
                    html += '<button class="btn-medieval btn-street-sell" data-action="executeStreetContrabandSellUI" data-idx="' + ci + '" data-qty="1" style="font-size:0.7rem;padding:2px 6px;">Sell 1 (' + co.pricePerUnit + 'g)</button>';
                }
                html += '<button class="btn-medieval btn-street-sell" ' + (coCanSell ? 'data-action="executeStreetContrabandSellUI" data-idx="' + ci + '" data-qty="' + coHeld + '"' : 'disabled') + '>';
                html += 'Sell All ' + coHeld + ' (' + coTotal + 'g)</button>';
                html += '</div></div>';
            }
            html += '</div>';
        }
    }

    // --- Request Specific Goods section ---
    if (typeof Player !== 'undefined' && Player.getStreetRequestableGoods) {
        html += '<hr style="border-color:#555;margin:12px 0;">';
        html += '<div style="background:rgba(100,149,237,0.10);border:1px solid #6495ed;border-radius:8px;padding:10px 14px;">';
        html += '<p class="street-intro" style="margin-top:0;">📋 <strong>Request Specific Goods</strong> — Put out word that you\'re looking for a good not currently in the market. A merchant may or may not have it.</p>';

        // Show pending offer if one exists
        if (Player._streetGoodsOffer) {
            var sgo = Player._streetGoodsOffer;
            var sgoTotal = sgo.pricePerUnit * sgo.qty;
            var sgoCanAfford = (Player.gold || 0) >= sgoTotal;
            html += '<div class="street-trade-item" style="border-left:3px solid #6495ed;background:rgba(100,149,237,0.08);margin:8px 0;">';
            html += '<div class="street-trade-info">';
            html += '<span style="color:#6495ed;font-weight:bold;">📬 Pending Offer:</span> ';
            html += '<span class="street-npc-name">' + sgo.npcName + '</span> has ';
            html += '<strong>' + sgo.qty + ' ' + (sgo.resourceIcon || '') + ' ' + sgo.resourceName + '</strong>';
            html += ' — <span class="street-price">' + sgo.pricePerUnit + 'g each</span>';
            html += ' <span style="color:#e67e22;font-weight:bold;font-size:0.85em;">(+' + sgo.premiumPct + '% above market)</span>';
            html += '</div>';
            html += '<div class="street-trade-actions">';
            html += '<span class="street-have">Total: ' + sgoTotal + 'g</span>';
            html += '<button class="btn-medieval" style="background:#55a868;color:#fff;padding:4px 12px;margin-right:4px;" ' + (sgoCanAfford ? 'data-action="_streetAcceptOffer"' : 'disabled title="Not enough gold"') + '>✅ Accept</button>';
            html += '<button class="btn-medieval" style="background:#c44e52;color:#fff;padding:4px 12px;" data-action="_streetDeclineOffer">❌ Decline</button>';
            html += '</div></div>';
        }

        // Show dropdown to request
        var reqGoods = Player.getStreetRequestableGoods();
        if (reqGoods.length > 0) {
            // Cooldown check
            var _reqCdDays = (typeof Player !== 'undefined' && Player.hasSkill && Player.hasSkill('black_market_contacts')) ? 1 : 3;
            var _reqCd = Player._streetGoodsRequestDay ? (_reqCdDays - ((typeof Engine !== 'undefined' && Engine.getDay ? Engine.getDay() : 9999) - Player._streetGoodsRequestDay)) : 0;
            var _reqOnCd = _reqCd > 0;

            html += '<div style="margin-top:8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">';
            html += '<select id="streetGoodsRequestSelect" onchange="UI._streetUpdateChancePreview()" style="padding:5px 8px;border-radius:4px;border:1px solid #6495ed;background:#1a1a2e;color:#e0d8c0;font-size:0.9rem;min-width:180px;">';
            html += '<option value="">-- Select a good --</option>';
            for (var rgi = 0; rgi < reqGoods.length; rgi++) {
                var rg = reqGoods[rgi];
                html += '<option value="' + rg.id + '">' + rg.icon + ' ' + rg.name + ' (base ' + rg.basePrice + 'g)</option>';
            }
            html += '</select>';
            html += '<button class="btn-medieval" style="background:#6495ed;color:#fff;padding:5px 14px;" ';
            if (_reqOnCd) {
                html += 'disabled title="Cooldown: ' + _reqCd + ' day' + (_reqCd !== 1 ? 's' : '') + '">';
                html += '⏳ Request (' + _reqCd + 'd cooldown)';
            } else {
                html += 'data-action="_streetSubmitRequest">';
                html += '📋 Request Good';
            }
            html += '</button>';
            html += '</div>';
            // Chance preview area — populated by onchange
            html += '<div id="streetRequestChancePreview" style="margin-top:6px;font-size:0.85em;color:#ccc;"></div>';
        } else {
            html += '<p style="color:#888;margin-top:4px;">All goods are available in the local market.</p>';
        }
        html += '</div>';
    }

    // Add NPC Chat section for indentured servants seeking escape hints
    if (typeof Player !== 'undefined' && Player.indentured && Player.indentured.active) {
        html += '<hr style="border-color:#555;margin:12px 0;">';
        html += '<p class="street-intro">💬 <strong>Talk to Townsfolk</strong> — Chat with locals to learn about the town and maybe discover ways out of your contract.</p>';
        // Get NPCs in current town
        const townId = Player.townId;
        const townNpcs = (typeof Engine !== 'undefined' && Engine.getPeople) ? Engine.getPeople(townId) : [];
        const chatNpcs = [];
        for (let n = 0; n < Math.min(townNpcs.length, 50); n++) {
            const npc = townNpcs[n];
            if (npc && npc.alive && npc.id !== Player.indentured.masterId) {
                chatNpcs.push(npc);
            }
        }
        // Show up to 6 random NPCs to chat with
        const shuffled = chatNpcs.sort(() => Math.random() - 0.5).slice(0, 6);
        if (shuffled.length > 0) {
            html += '<div class="street-trade-list">';
            for (let c = 0; c < shuffled.length; c++) {
                const npc = shuffled[c];
                const occ = npc.occupation || npc.title || 'Townsfolk';
                const occDisplay = occ.charAt(0).toUpperCase() + occ.slice(1);
                html += '<div class="street-trade-item" style="padding:6px 10px;">';
                html += '<div class="street-trade-info">';
                html += '<span class="street-npc-name">' + (npc.firstName || npc.fullName || 'Someone') + ' ' + (npc.lastName || '') + '</span>';
                html += ' <span class="text-dim">(' + occDisplay + ')</span>';
                html += '</div>';
                html += '<button class="btn-medieval" style="font-size:0.7rem;padding:3px 10px;" data-action="chatWithNPC" data-id="' + npc.id + '">💬 Chat</button>';
                html += '</div>';
            }
            html += '</div>';
        } else {
            html += '<p class="text-dim">No one around to talk to right now.</p>';
        }
    }

    openModal('🤝 Street Trading', html);
}

function chatWithNPC(npcId) {
    if (typeof Player === 'undefined' || !Player.checkNPCEscapeHints) return;
    var hint = Player.checkNPCEscapeHints(npcId);
    if (hint) {
        toast('💡 ' + hint, 'success');
    } else {
        // Generic chat responses
        var npc = (typeof Engine !== 'undefined') ? Engine.findPerson(npcId) : null;
        var name = npc ? (npc.firstName || 'They') : 'They';
        var chatLines = [
            name + ' nods politely but has nothing useful to say.',
            name + ' talks about the weather and rising grain prices.',
            name + ' grumbles about taxes and moves along.',
            name + ' shares gossip about a merchant who went bankrupt.',
            name + ' mentions the roads have been dangerous lately.',
            name + ' tells you about their family troubles.',
            name + ' warns you about the war affecting trade routes.'
        ];
        toast('💬 ' + chatLines[Math.floor(Math.random() * chatLines.length)], 'info');
    }
    openStreetTrading(); // Refresh to show new NPCs
}

function executeStreetTradeUI(tradeIndex) {
    const result = Player.executeStreetTrade(tradeIndex);
    if (result.success) {
        toast(result.message, 'success');
        openStreetTrading(); // refresh
    } else {
        toast(result.message, 'warning');
    }
}

function executeStreetBuyUI(buyIndex) {
    var result = Player.executeStreetBuy(buyIndex);
    if (result.success) {
        toast(result.message, 'success');
        openStreetTrading(); // refresh
    } else {
        toast(result.message, result.caught ? 'error' : 'warning');
    }
}

function executeStreetContrabandSellUI(offerIndex, qty) {
    var result = Player.executeStreetContrabandSell(offerIndex, qty);
    if (result.success) {
        toast(result.message, result.smuggled ? 'success' : 'success');
        openStreetTrading(); // refresh
    } else {
        toast(result.message, result.caught ? 'error' : 'warning');
        openStreetTrading(); // refresh to update quantities
    }
}

function _streetSubmitRequest() {
    var sel = document.getElementById('streetGoodsRequestSelect');
    if (!sel || !sel.value) { toast('Select a good to request.', 'warning'); return; }
    var result = Player.submitStreetGoodsRequest(sel.value);
    if (!result.success) { toast(result.message, 'warning'); return; }
    if (result.found) {
        toast(result.message, 'success');
    } else {
        toast(result.message, 'info');
    }
    openStreetTrading(); // refresh to show offer or cooldown
}

function _streetAcceptOffer() {
    var result = Player.acceptStreetGoodsOffer();
    if (result.success) {
        toast(result.message, 'success');
    } else {
        toast(result.message, 'warning');
    }
    openStreetTrading();
}

function _streetDeclineOffer() {
    Player.declineStreetGoodsOffer();
    toast('Offer declined.', 'info');
    openStreetTrading();
}

function _streetUpdateChancePreview() {
    var preview = document.getElementById('streetRequestChancePreview');
    if (!preview) return;
    var sel = document.getElementById('streetGoodsRequestSelect');
    if (!sel || !sel.value) { preview.innerHTML = ''; return; }

    var info = Player.getStreetRequestChance(sel.value);
    if (!info) { preview.innerHTML = ''; return; }

    var chanceColor = info.chance >= 30 ? '#55a868' : info.chance >= 15 ? '#e6c422' : '#c44e52';
    var html = '<div style="background:rgba(100,149,237,0.08);border:1px solid rgba(100,149,237,0.3);border-radius:5px;padding:6px 10px;margin-top:4px;">';
    html += '<span style="font-weight:bold;color:' + chanceColor + ';font-size:1.05em;">🎯 Chance: ' + info.chance + '%</span>';

    // Breakdown
    html += '<div style="margin-top:4px;display:flex;flex-wrap:wrap;gap:4px 12px;">';
    for (var bi = 0; bi < info.breakdown.length; bi++) {
        var b = info.breakdown[bi];
        var bColor = b.value >= 0 ? '#55a868' : '#c44e52';
        html += '<span style="color:' + bColor + ';font-size:0.82em;">' + b.label + ' ' + (b.value >= 0 ? '+' : '') + b.value + '%</span>';
    }
    html += '</div>';

    // Skills that could boost
    if (info.boostSkills.length > 0) {
        html += '<div style="margin-top:5px;color:#6495ed;font-size:0.8em;">💡 <strong>Skills that increase chance:</strong> ';
        html += info.boostSkills.join(', ');
        html += '</div>';
    }
    html += '</div>';
    preview.innerHTML = html;
}

// ========================================================
// DARK DEEDS — SCHEMES DIALOG
// ========================================================

UI._schemesTab = 'sabotage';

function switchSchemesTab(tab) {
    UI._schemesTab = tab;
    const tabs = ['sabotage', 'political', 'assassination', 'tax_evasion', 'market'];
    const btns = document.querySelectorAll('.schemes-tabs .btn-tab');
    btns.forEach((btn, i) => {
        btn.classList.toggle('active', tabs[i] === tab);
    });
    for (const t of tabs) {
        const el = document.getElementById('schemesTab_' + t);
        if (el) el.style.display = t === tab ? '' : 'none';
    }
}

function getDetectionColor(pct) {
    if (pct < 0.20) return '#55a868';
    if (pct < 0.50) return '#ccb974';
    return '#c44e52';
}

// ============================================================
// §NOBILITY — Nobility Panel (rank 4+ privileges, commissions, standing)
// ============================================================

var _nobilityTab = 'status'; // 'status' or 'intrigue'

function openNobilityDialog() {
    // v9p33river367: use active kingdom (Player.citizenshipKingdomId set in Character UI)
    var citizenKingdomId = Player.citizenshipKingdomId || '';
    var playerRank = 0;
    if (citizenKingdomId && Player.socialRank) {
        playerRank = Player.socialRank[citizenKingdomId] || 0;
    }
    if (playerRank < 4) {
        // Check foreign noble status in the active kingdom
        var _fnActive = citizenKingdomId && Player.getForeignNobleStatus ? Player.getForeignNobleStatus(citizenKingdomId) : false;
        if (!(_fnActive === 'foreign_noble' || _fnActive === 'foreign_minor_noble')) {
            // Active kingdom doesn't qualify — check any kingdom with rank 4+
            var _foundNobleK = false;
            if (Player.socialRank) {
                for (var _nk in Player.socialRank) {
                    if ((Player.socialRank[_nk] || 0) >= 4) {
                        citizenKingdomId = _nk;
                        playerRank = Player.socialRank[_nk];
                        _foundNobleK = true;
                        break;
                    }
                }
            }
            if (!_foundNobleK) {
                // Check foreign noble in any kingdom
                try {
                    var _allKingdoms = Engine.getKingdoms ? Engine.getKingdoms() : [];
                    for (var _fni = 0; _fni < _allKingdoms.length; _fni++) {
                        var _fnCheck = Player.getForeignNobleStatus ? Player.getForeignNobleStatus(_allKingdoms[_fni].id) : false;
                        if (_fnCheck === 'foreign_noble' || _fnCheck === 'foreign_minor_noble') {
                            citizenKingdomId = _allKingdoms[_fni].id;
                            _foundNobleK = true;
                            break;
                        }
                    }
                } catch (e) {}
            }
            if (!_foundNobleK) {
                toast('You must be at least a Minor Noble to access this panel.', 'warning');
                return;
            }
        }
    }

    var rankDef = CONFIG.SOCIAL_RANKS[playerRank] || CONFIG.SOCIAL_RANKS[4];
    var kingdom = null;
    var kingPerson = null;
    var kingRel = 0;
    var kingdoms = [];
    try {
        kingdoms = Engine.getKingdoms ? Engine.getKingdoms() : [];
        kingdom = kingdoms.find(function(k) { return k.id === citizenKingdomId; });
        if (kingdom && kingdom.king) {
            kingPerson = Engine.findPerson(kingdom.king);
            var kRel = Player.getRelationship ? Player.getRelationship(kingdom.king) : null;
            kingRel = kRel ? kRel.level : 0;
        }
    } catch (e) { /* ignore */ }

    var rep = Player.reputation ? (Player.reputation[citizenKingdomId] || 0) : 0;
    var day = 0;
    try { day = Engine.getDay(); } catch (e) {}
    var polCap = Player.politicalCapital || 0;
    var maxPolCap = CONFIG.ADVISE_KING_POLITICAL_CAPITAL_MAX || 3;
    var lordTownId = Player.lordTownId || null;
    var lordTown = lordTownId ? Engine.findTown(lordTownId) : null;

    // Determine demotion danger
    var demotionDanger = false;
    var demotionDaysLeft = 0;
    var demotionReason = '';
    var repThreshold = playerRank >= 6 ? 80 : playerRank >= 5 ? 70 : 60;
    var kingRelThreshold = playerRank >= 6 ? 70 : playerRank >= 5 ? 60 : 0;
    if (rep < repThreshold) {
        demotionDanger = true;
        demotionReason = 'Kingdom reputation (' + Math.floor(rep) + ') is below ' + repThreshold;
    }
    if (kingRelThreshold > 0 && kingRel < kingRelThreshold) {
        demotionDanger = true;
        demotionReason += (demotionReason ? ' AND ' : '') + 'King relationship (' + Math.floor(kingRel) + ') is below ' + kingRelThreshold;
    }
    var _repWarn = Player._repWarnDay || {};
    if (_repWarn[citizenKingdomId]) {
        demotionDaysLeft = Math.max(0, 30 - (day - _repWarn[citizenKingdomId]));
    }

    // Commission data
    var commission = kingdom ? kingdom.directedPlayerCommission : null;

    // Pending RA decisions
    var pendingDecisions = [];
    if (playerRank >= 6 && Player.getPendingKingDecisions) {
        try { pendingDecisions = Player.getPendingKingDecisions() || []; } catch (e) {}
        pendingDecisions = pendingDecisions.filter(function(d) { return !d.resolved; });
    }

    // === Build HTML ===
    var html = '';

    // ── Status Header ──
    html += '<div style="background:linear-gradient(135deg,rgba(201,168,76,0.15),rgba(201,168,76,0.05));border:1px solid rgba(201,168,76,0.3);border-radius:8px;padding:12px;margin-bottom:10px;">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">';
    html += '<div>';
    html += '<div style="font-size:1.1rem;font-weight:bold;color:var(--gold);">' + (rankDef.icon || '👑') + ' ' + (rankDef.name || 'Noble') + '</div>';
    html += '<div style="font-size:0.78rem;color:#aaa;">Kingdom of ' + (kingdom ? kingdom.name : '?') + '</div>';
    html += '</div>';
    html += '<div style="text-align:right;">';
    html += '<div style="font-size:0.75rem;color:#aaa;">Kingdom Rep: <span style="color:' + (rep >= repThreshold ? '#55a868' : rep >= repThreshold - 10 ? '#ccb974' : '#c44e52') + ';font-weight:bold;">' + Math.floor(rep) + '</span></div>';
    if (kingPerson) {
        html += '<div style="font-size:0.75rem;color:#aaa;">King ' + kingPerson.firstName + ': <span style="color:' + (kingRel >= (kingRelThreshold || 60) ? '#55a868' : kingRel >= 40 ? '#ccb974' : '#c44e52') + ';font-weight:bold;">' + Math.floor(kingRel) + '</span></div>';
    }
    if (playerRank >= 6) {
        html += '<div style="font-size:0.75rem;color:#aaa;">Political Capital: <span style="color:var(--gold);font-weight:bold;">' + polCap + '/' + maxPolCap + '</span></div>';
    }
    html += '</div></div>';

    // Rep bar with threshold marker
    html += '<div style="margin-top:8px;">';
    html += '<div style="position:relative;height:8px;background:rgba(0,0,0,0.3);border-radius:4px;overflow:visible;">';
    html += '<div style="height:100%;width:' + Math.min(100, rep) + '%;background:linear-gradient(90deg,' + (rep >= repThreshold ? '#55a868' : '#c44e52') + ',var(--gold));border-radius:4px;transition:width 0.3s;"></div>';
    html += '<div style="position:absolute;top:-2px;left:' + repThreshold + '%;width:2px;height:12px;background:#fff;opacity:0.6;" title="Demotion threshold: ' + repThreshold + '"></div>';
    html += '</div>';
    html += '<div style="display:flex;justify-content:space-between;font-size:0.65rem;color:#666;margin-top:2px;"><span>0</span><span style="color:#aaa;">Threshold: ' + repThreshold + '</span><span>100</span></div>';
    html += '</div></div>';

    // ── DEMOTION WARNING ──
    if (demotionDanger) {
        html += '<div style="background:rgba(196,78,82,0.15);border:2px solid rgba(196,78,82,0.5);border-radius:8px;padding:10px;margin-bottom:10px;animation:pulse 2s infinite;">';
        html += '<div style="font-size:0.9rem;font-weight:bold;color:#c44e52;">⚠️ DEMOTION DANGER</div>';
        html += '<div style="font-size:0.78rem;color:#ccc;margin-top:4px;">' + demotionReason + '</div>';
        if (demotionDaysLeft > 0) {
            html += '<div style="font-size:0.85rem;font-weight:bold;color:#e74c3c;margin-top:6px;">⏰ ' + demotionDaysLeft + ' days until demotion!</div>';
            html += '<div style="font-size:0.7rem;color:#aaa;">Raise your reputation above ' + repThreshold + ' to cancel the countdown.</div>';
        } else if (_repWarn[citizenKingdomId]) {
            html += '<div style="font-size:0.85rem;font-weight:bold;color:#e74c3c;margin-top:6px;">⏰ Demotion imminent!</div>';
        }
        html += '</div>';
    }

    // ── NOBLE NOTORIETY BAR ──
    var _nobleNot = Player.nobleNotoriety || 0;
    var _nobleNotColor = _nobleNot >= 70 ? '#c44e52' : _nobleNot >= 40 ? '#e67e22' : _nobleNot >= 15 ? '#ccb974' : '#55a868';
    var _nobleNotLabel = _nobleNot >= 80 ? 'Infamous' : _nobleNot >= 60 ? 'Highly Suspicious' : _nobleNot >= 40 ? 'Suspicious' : _nobleNot >= 20 ? 'Whispers' : _nobleNot > 0 ? 'Noticed' : 'Clean';
    html += '<div style="background:rgba(0,0,0,0.2);border:1px solid rgba(201,168,76,0.15);border-radius:8px;padding:10px;margin-bottom:10px;">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">';
    html += '<div style="font-size:0.85rem;color:var(--gold);">🕵️ Noble Notoriety</div>';
    html += '<div style="font-size:0.78rem;color:' + _nobleNotColor + ';font-weight:bold;">' + Math.floor(_nobleNot) + '/100 — ' + _nobleNotLabel + '</div>';
    html += '</div>';
    html += '<div style="position:relative;height:10px;background:rgba(0,0,0,0.3);border-radius:5px;overflow:hidden;">';
    html += '<div style="height:100%;width:' + Math.min(100, _nobleNot) + '%;background:linear-gradient(90deg,' + _nobleNotColor + ',' + (_nobleNot >= 50 ? '#c44e52' : _nobleNotColor) + ');border-radius:5px;transition:width 0.3s;"></div>';
    html += '</div>';
    html += '<div style="font-size:0.65rem;color:#888;margin-top:4px;">';
    if (_nobleNot >= 50) {
        html += '⚠️ The nobility is watching you closely. Each time an agent is caught, there is a <b>' + Math.floor(_nobleNot) + '%</b> chance the king will deliver punishment.';
    } else if (_nobleNot > 0) {
        html += 'Suspicion level among nobles. Decays by 1 per day. Higher values increase the risk of being caught and punished by the king.';
    } else {
        html += 'The nobility has no suspicions about you. Keep it that way — or don\'t.';
    }
    html += '</div></div>';

    // ── DISCOVERED SECRETS (H2 fix) ──
    var _secrets = Player.getState ? Player.getState()._discoveredSecrets : null;
    if (_secrets && _secrets.length > 0) {
        html += '<div style="background:rgba(0,0,0,0.2);border:1px solid rgba(201,168,76,0.15);border-radius:8px;padding:10px;margin-bottom:10px;">';
        html += '<div style="font-size:0.85rem;color:var(--gold);margin-bottom:6px;">📜 Discovered Secrets (' + _secrets.length + ')</div>';
        var _shown = 0;
        for (var _si = _secrets.length - 1; _si >= 0 && _shown < 5; _si--) {
            var _sec = _secrets[_si];
            var _secType = (_sec.type || 'unknown').replace(/_/g, ' ');
            var _secColor = _sec.used ? '#666' : '#c9a84c';
            var _secIcon = _sec.used ? '✓' : '🔗';
            html += '<div style="font-size:0.78rem;color:' + _secColor + ';padding:2px 0;">';
            html += _secIcon + ' <b>' + escapeHtml(_sec.nobleName || 'Unknown') + '</b> — ' + escapeHtml(_secType);
            if (_sec.used) html += ' <span style="color:#555;">(used)</span>';
            html += '</div>';
            _shown++;
        }
        if (_secrets.length > 5) {
            html += '<div style="font-size:0.7rem;color:#888;">...and ' + (_secrets.length - 5) + ' more</div>';
        }
        html += '<div style="font-size:0.65rem;color:#888;margin-top:4px;">Exposed secrets grant blackmail leverage over nobles, boosting scheme success rates.</div>';
        html += '</div>';
    }

    // ── COURT INTELLIGENCE (M2 — noble relationship viewer) ──
    try {
        var _myKingdomId = null;
        for (var _ck = 0; _ck < kingdoms.length; _ck++) {
            if ((Player.getState ? Player.getState().socialRank : {})[kingdoms[_ck].id] >= 4) {
                _myKingdomId = kingdoms[_ck].id;
                break;
            }
        }
        if (_myKingdomId && typeof Engine !== 'undefined' && Engine.getWorld && Engine.getPeople) {
            var _ciTowns = Engine.getWorld().towns || [];
            var _courtNobles = [];
            var _ciPlayerPId = (typeof Player !== 'undefined' && Player.personId) ? Player.personId : 'player';
            for (var _cti = 0; _cti < _ciTowns.length; _cti++) {
                if (_ciTowns[_cti].kingdomId !== _myKingdomId) continue;
                var _ciPeople = Engine.getPeople(_ciTowns[_cti].id);
                if (!_ciPeople) continue;
                for (var _cn = 0; _cn < _ciPeople.length; _cn++) {
                    var _p = _ciPeople[_cn];
                    if (_p && _p.alive && _p.id !== _ciPlayerPId && (_p.occupation === 'noble' || _p.isNoble) && !_p.isKing) {
                        _courtNobles.push(_p);
                    }
                }
            }
            if (_courtNobles.length > 0) {
                html += '<div style="background:rgba(0,0,0,0.2);border:1px solid rgba(108,155,209,0.15);border-radius:8px;padding:10px;margin-bottom:10px;">';
                html += '<div style="font-size:0.85rem;color:#6c9bd1;margin-bottom:6px;">🏛️ Court Intelligence (' + _courtNobles.length + ' nobles)</div>';
                var _kingPerson = null;
                var _myK = Engine.findKingdom ? Engine.findKingdom(_myKingdomId) : null;
                if (_myK && _myK.king) _kingPerson = Engine.findPerson ? Engine.findPerson(_myK.king) : null;
                for (var _ci = 0; _ci < Math.min(8, _courtNobles.length); _ci++) {
                    var _cn2 = _courtNobles[_ci];
                    var _cnRank = (_cn2.socialRank && _cn2.socialRank[_myKingdomId]) || 4;
                    var _cnRankLabel = _cnRank >= 6 ? 'RA' : _cnRank >= 5 ? 'Lord' : 'Noble';
                    var _cnLoyalty = _cn2._nobleRelationships && _kingPerson ? (_cn2._nobleRelationships[_kingPerson.id] || 0) : 0;
                    var _cnLoyColor = _cnLoyalty >= 30 ? '#55a868' : _cnLoyalty >= 0 ? '#ccb974' : '#c44e52';
                    var _cnRep = (_cn2.reputation && _cn2.reputation[_myKingdomId]) ? _cn2.reputation[_myKingdomId] : 50;
                    var _cnScan = _cn2._scandalized ? ' 💥' : '';
                    var _cnFaction = _cn2._faction ? (' [' + _cn2._faction.charAt(0).toUpperCase() + _cn2._faction.slice(1) + ']') : '';
                    html += '<div style="font-size:0.78rem;padding:2px 0;color:#ccc;">';
                    html += '<b>' + escapeHtml(_cn2.firstName || '?') + '</b> [' + _cnRankLabel + ']';
                    html += ' — King rel: <span style="color:' + _cnLoyColor + ';">' + _cnLoyalty + '</span>';
                    html += ' | Rep: ' + Math.floor(_cnRep) + _cnScan + _cnFaction;
                    html += '</div>';
                }
                if (_courtNobles.length > 8) html += '<div style="font-size:0.7rem;color:#888;">...and ' + (_courtNobles.length - 8) + ' more</div>';
                html += '<div style="font-size:0.65rem;color:#888;margin-top:4px;">Shows noble-to-king relationships and reputation. Use schemes to shift the balance of power.</div>';
                html += '</div>';
            }
        }
    } catch(e) {}

    // ── ALERTS SECTION ──
    var alerts = [];
    if (commission && commission.status === 'pending') {
        alerts.push({ icon: '📜', text: 'New commission from the king awaits your response!', color: '#6c9bd1' });
    }
    if (commission && commission.status === 'accepted') {
        var _dLeft = (commission.deadlineDay || 0) - day;
        if (_dLeft <= 10 && _dLeft > 0) {
            alerts.push({ icon: '⏳', text: 'Commission deadline in ' + _dLeft + ' days!', color: '#ccb974' });
        } else if (_dLeft <= 0) {
            alerts.push({ icon: '❗', text: 'Commission deadline PASSED!', color: '#c44e52' });
        }
    }
    if (pendingDecisions.length > 0) {
        alerts.push({ icon: '👑', text: pendingDecisions.length + ' pending king decision' + (pendingDecisions.length > 1 ? 's' : '') + ' await your counsel!', color: '#6c9bd1' });
    }
    // Check for wars affecting foreign noble status
    for (var _wi = 0; _wi < kingdoms.length; _wi++) {
        var _wk = kingdoms[_wi];
        // v9p33river367: atWar is an array (serialized from Set), not warTarget
        if (_wk.id !== citizenKingdomId && _wk.atWar && _wk.atWar.indexOf(citizenKingdomId) >= 0) {
            alerts.push({ icon: '⚔️', text: _wk.name + ' is at war with your kingdom!', color: '#c44e52' });
        }
    }

    if (alerts.length > 0) {
        html += '<div style="margin-bottom:10px;">';
        for (var _ai = 0; _ai < alerts.length; _ai++) {
            html += '<div style="background:rgba(' + (alerts[_ai].color === '#c44e52' ? '196,78,82' : alerts[_ai].color === '#ccb974' ? '204,185,116' : '108,155,209') + ',0.12);border:1px solid ' + alerts[_ai].color + '33;border-radius:6px;padding:6px 10px;margin-bottom:4px;font-size:0.78rem;">';
            html += '<span style="margin-right:4px;">' + alerts[_ai].icon + '</span><span style="color:' + alerts[_ai].color + ';">' + alerts[_ai].text + '</span></div>';
        }
        html += '</div>';
    }

    // ── TAB BUTTONS ──
    html += '<div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap;">';
    html += '<button class="btn-tab' + (_nobilityTab === 'status' ? ' active' : '') + '" data-action="switchNobilityTab" data-id="status" style="font-size:0.85rem;padding:6px 14px;">📊 Status</button>';
    html += '<button class="btn-tab' + (_nobilityTab === 'influence' ? ' active' : '') + '" data-action="switchNobilityTab" data-id="influence" style="font-size:0.85rem;padding:6px 14px;">🎭 Influence</button>';
    html += '<button class="btn-tab' + (_nobilityTab === 'intrigue' ? ' active' : '') + '" data-action="switchNobilityTab" data-id="intrigue" style="font-size:0.85rem;padding:6px 14px;">🗡️ Noble Intrigue</button>';
    html += '</div>';

    // ── STATUS TAB ──
    html += '<div id="nobilityTab_status" style="display:' + (_nobilityTab === 'status' ? '' : 'none') + ';">';

    // ── KING'S COMMISSION (rank 4+) ──
    html += '<div style="background:rgba(0,0,0,0.2);border:1px solid rgba(201,168,76,0.2);border-radius:8px;padding:10px;margin-bottom:10px;">';
    html += '<h3 style="margin:0 0 8px 0;font-size:0.9rem;color:var(--gold);">📜 King\'s Commission</h3>';
    if (commission && commission.status !== 'completed' && commission.status !== 'failed' && commission.status !== 'refused' && commission.status !== 'expired') {
        var _commItem = commission.resourceId || commission.item || commission.goodId || '?';
        var _commQty = commission.quantity || commission.amount || 0;
        var _commDeadline = commission.deadlineDay || 0;
        var _commReward = commission.reward || commission.rewardGold || 0;
        var _commStatus = commission.status || 'pending';
        var _commDaysLeft = _commDeadline - day;
        var _commDelivered = commission.delivered || 0;
        var _commProgress = _commQty > 0 ? Math.min(100, Math.floor((_commDelivered / _commQty) * 100)) : 0;

        // v9p33river395: Resolve resource name from CONFIG.ITEMS (lowercase-keyed mirror of RESOURCE_TYPES)
        var _itemName = _commItem;
        if (CONFIG.ITEMS && CONFIG.ITEMS[_commItem]) {
            _itemName = (CONFIG.ITEMS[_commItem].icon || '') + ' ' + CONFIG.ITEMS[_commItem].name;
        } else if (typeof RESOURCE_TYPES !== 'undefined') {
            var _gKey = _commItem.toUpperCase();
            if (RESOURCE_TYPES[_gKey] && RESOURCE_TYPES[_gKey].name) {
                _itemName = (RESOURCE_TYPES[_gKey].icon || '') + ' ' + RESOURCE_TYPES[_gKey].name;
            }
        }
        // Final fallback: prettify the raw id
        if (_itemName === _commItem) _itemName = _commItem.replace(/_/g, ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); });

        html += '<div style="font-size:0.8rem;color:#ccc;">';
        html += '<div style="margin-bottom:6px;"><strong>Deliver:</strong> ' + _commQty + 'x ' + _itemName + '</div>';
        html += '<div style="margin-bottom:6px;"><strong>Deadline:</strong> Day ' + _commDeadline + ' <span style="color:' + (_commDaysLeft <= 5 ? '#c44e52' : _commDaysLeft <= 15 ? '#ccb974' : '#55a868') + ';">(' + (_commDaysLeft > 0 ? _commDaysLeft + ' days left' : 'OVERDUE!') + ')</span></div>';
        html += '<div style="margin-bottom:6px;"><strong>Reward:</strong> <span class="gold-value">' + formatGold(_commReward) + '</span></div>';
        if (_commStatus === 'accepted') {
            var _playerHas = (Player.state && Player.state.inventory) ? (Player.state.inventory[_commItem] || 0) : 0;
            html += '<div style="margin-bottom:4px;"><strong>Progress:</strong> ' + _commDelivered + '/' + _commQty + ' <span style="font-size:0.72rem;color:#aaa;">(You have: ' + _playerHas + ')</span></div>';
            html += '<div style="height:6px;background:rgba(0,0,0,0.3);border-radius:3px;margin-bottom:8px;"><div style="height:100%;width:' + _commProgress + '%;background:' + (_commProgress >= 100 ? '#55a868' : 'var(--gold)') + ';border-radius:3px;transition:width 0.3s;"></div></div>';
            var _canDeliver = _playerHas >= (_commQty - _commDelivered);
            html += '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px;align-items:center;">';
            if (_canDeliver) {
                html += '<button class="btn-medieval" data-action="deliverKingCommissionAction" style="font-size:0.78rem;padding:6px 16px;background:rgba(85,168,104,0.25) !important;border-color:rgba(85,168,104,0.5) !important;animation:pulse 2s infinite;">📦 Deliver Goods</button>';
            } else {
                html += '<div style="font-size:0.72rem;color:#888;">📦 Gather ' + (_commQty - _commDelivered - _playerHas) + ' more ' + _itemName + ' to deliver</div>';
            }
            html += '</div>';
        }
        html += '</div>';

        if (_commStatus === 'pending') {
            var _isLord = playerRank >= 5;
            html += '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px;align-items:center;">';
            html += '<button class="btn-medieval" data-action="acceptKingCommissionAction" style="font-size:0.75rem;padding:5px 12px;background:rgba(85,168,104,0.15);border-color:rgba(85,168,104,0.3);">✅ Accept</button>';
            html += '<button class="btn-medieval" data-action="refuseKingCommissionAction" data-lord="' + (_isLord ? 'true' : 'false') + '" style="font-size:0.75rem;padding:5px 12px;background:rgba(196,78,82,0.15);border-color:rgba(196,78,82,0.3);">🚫 Refuse</button>';
            if (_isLord) {
                html += '<div style="font-size:0.7rem;color:#c44e52;">⚠️ Refusal triggers demotion!</div>';
            }
            html += '</div>';
        }
    } else {
        html += '<div style="font-size:0.78rem;color:#888;font-style:italic;">No active commission. The king may assign you a task when the kingdom has need.</div>';
    }
    html += '</div>';

    // ── LORDSHIP SECTION (rank 5+) ──
    if (playerRank >= 5) {
        html += '<div style="background:rgba(0,0,0,0.2);border:1px solid rgba(201,168,76,0.2);border-radius:8px;padding:10px;margin-bottom:10px;">';
        html += '<h3 style="margin:0 0 8px 0;font-size:0.9rem;color:var(--gold);">🏰 Your Lordship</h3>';
        if (lordTown) {
            html += '<div style="font-size:0.8rem;color:#ccc;">';
            html += '<div style="margin-bottom:4px;"><strong>Lord of:</strong> ' + lordTown.name + '</div>';
            html += '<div style="margin-bottom:4px;"><strong>Population:</strong> ' + (lordTown.population || '?') + '</div>';
            html += '<div style="margin-bottom:4px;"><strong>Prosperity:</strong> ' + Math.floor(lordTown.prosperity || 0) + '</div>';
            html += '<div style="margin-bottom:4px;"><strong>Crime Immunity:</strong> <span style="color:#55a868;">✓ Active in ' + lordTown.name + '</span></div>';
            html += '</div>';
            // Kingdom building request
            html += '<div style="margin-top:8px;">';
            html += '<button class="btn-medieval" data-action="_nobilityRequestBuilding" data-id="' + lordTown.id + '" style="font-size:0.75rem;padding:5px 12px;">🏗️ Request Kingdom Building</button>';
            html += '</div>';
        } else {
            html += '<div style="font-size:0.78rem;color:#888;font-style:italic;">You have not yet been assigned a town. The king will offer you a choice of towns to govern.</div>';
        }
        html += '</div>';
    }

    // ── ROYAL ADVISORY (rank 6) ──
    if (playerRank >= 6) {
        html += '<div style="background:rgba(0,0,0,0.2);border:1px solid rgba(201,168,76,0.2);border-radius:8px;padding:10px;margin-bottom:10px;">';
        html += '<h3 style="margin:0 0 8px 0;font-size:0.9rem;color:var(--gold);">👑 Royal Advisory</h3>';

        // Political capital bar
        html += '<div style="margin-bottom:8px;">';
        html += '<div style="font-size:0.75rem;color:#aaa;margin-bottom:3px;">Political Capital: ' + polCap + '/' + maxPolCap + '</div>';
        html += '<div style="height:6px;background:rgba(0,0,0,0.3);border-radius:3px;"><div style="height:100%;width:' + (maxPolCap > 0 ? Math.floor((polCap / maxPolCap) * 100) : 0) + '%;background:var(--gold);border-radius:3px;"></div></div>';
        html += '</div>';

        // Pending decisions
        if (pendingDecisions.length > 0) {
            html += '<div style="font-size:0.78rem;color:#6c9bd1;font-weight:bold;margin-bottom:6px;">📋 ' + pendingDecisions.length + ' Pending Decision' + (pendingDecisions.length > 1 ? 's' : '') + '</div>';
            for (var _di = 0; _di < pendingDecisions.length; _di++) {
                var _dec = pendingDecisions[_di];
                var _convPct = Math.floor((_dec.conviction || 0) * 100);
                var _convColor = _convPct >= 80 ? '#c44e52' : _convPct >= 50 ? '#ccb974' : '#55a868';
                html += '<div style="background:rgba(108,155,209,0.08);border:1px solid rgba(108,155,209,0.2);border-radius:6px;padding:8px;margin-bottom:6px;">';
                html += '<div style="font-size:0.8rem;font-weight:bold;color:#ddd;">' + (_dec.description || _dec.type || 'Unknown Decision') + '</div>';
                if (_dec.details) html += '<div style="font-size:0.72rem;color:#aaa;margin-top:2px;">' + _dec.details + '</div>';
                html += '<div style="font-size:0.7rem;color:#aaa;margin-top:4px;">King\'s conviction: <span style="color:' + _convColor + ';font-weight:bold;">' + _convPct + '%</span> ' + (_convPct >= 80 ? '(Very determined)' : _convPct >= 50 ? '(Moderate)' : '(Easily swayed)') + '</div>';
                html += '<div style="display:flex;gap:6px;margin-top:6px;">';
                html += '<button class="btn-medieval" data-action="respondToKingDecisionAgree" data-id="' + _dec.id + '" style="font-size:0.72rem;padding:4px 10px;background:rgba(85,168,104,0.15);border-color:rgba(85,168,104,0.3);">✅ Agree</button>';
                html += '<button class="btn-medieval" data-action="respondToKingDecisionOppose" data-id="' + _dec.id + '" style="font-size:0.72rem;padding:4px 10px;background:rgba(196,78,82,0.15);border-color:rgba(196,78,82,0.3);">🚫 Oppose</button>';
                html += '</div></div>';
            }
        } else {
            html += '<div style="font-size:0.78rem;color:#888;font-style:italic;margin-bottom:8px;">No pending king decisions. The king will consult you on major policy changes.</div>';
        }

        // Direct advice
        html += '<div style="margin-top:8px;border-top:1px solid rgba(201,168,76,0.15);padding-top:8px;">';
        html += '<div style="font-size:0.78rem;font-weight:bold;color:#ddd;margin-bottom:6px;">🗣️ Advise the King</div>';
        var _adviceTypes = [
            { id: 'lower_taxes', icon: '📉', label: 'Lower Taxes', tip: 'Suggest the king lower taxes to boost trade' },
            { id: 'raise_taxes', icon: '📈', label: 'Raise Taxes', tip: 'Suggest the king raise taxes for more revenue' },
            { id: 'build_walls', icon: '🏰', label: 'Build Walls', tip: 'Suggest fortifying towns' },
            { id: 'make_peace', icon: '🕊️', label: 'Make Peace', tip: 'Urge the king to seek peace' },
            { id: 'declare_war', icon: '⚔️', label: 'Declare War', tip: 'Urge military action' }
        ];
        html += '<div style="display:flex;flex-wrap:wrap;gap:4px;">';
        for (var _adi = 0; _adi < _adviceTypes.length; _adi++) {
            var _adv = _adviceTypes[_adi];
            var _advDisabled = polCap <= 0;
            html += '<button class="btn-medieval" data-action="adviseKingAction" data-id="' + citizenKingdomId + '" data-val="' + _adv.id + '" title="' + _adv.tip + '" style="font-size:0.7rem;padding:4px 8px;' + (_advDisabled ? 'opacity:0.4;cursor:not-allowed;' : '') + '"' + (_advDisabled ? ' disabled' : '') + '>' + _adv.icon + ' ' + _adv.label + '</button>';
        }
        html += '</div>';
        if (polCap <= 0) {
            html += '<div style="font-size:0.68rem;color:#c44e52;margin-top:4px;">No political capital remaining. Capital regenerates over time.</div>';
        }
        html += '</div>';

        // Propose law & Propose action
        html += '<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;">';
        html += '<button class="btn-medieval" data-action="_nobilityProposeLaw" data-id="' + citizenKingdomId + '" style="font-size:0.75rem;padding:5px 12px;" ' + (polCap <= 0 ? 'disabled style="font-size:0.75rem;padding:5px 12px;opacity:0.4;cursor:not-allowed;"' : '') + '>📜 Propose New Law</button>';
        html += '<button class="btn-medieval" data-action="_nobilityProposeAction" data-id="' + citizenKingdomId + '" style="font-size:0.75rem;padding:5px 12px;background:rgba(44,100,60,0.5) !important;border:2px solid rgba(80,180,100,0.5) !important;color:#f0e0c0 !important;" ' + (polCap <= 0 ? 'disabled' : '') + '>👑 Propose Action</button>';
        html += '</div>';

        // Crime immunity note
        html += '<div style="margin-top:8px;font-size:0.72rem;color:#55a868;">🛡️ Full criminal immunity in ' + (kingdom ? kingdom.name : 'your kingdom') + ' (crimes still affect reputation)</div>';
        html += '</div>';
    }

    // ── COUNCIL VOTES ──
    var _activeVotes = [];
    try { _activeVotes = Engine.getActiveVotes ? Engine.getActiveVotes() : []; } catch (e) {}
    if (_activeVotes.length > 0) {
        html += '<div style="background:rgba(100,50,200,0.1);border:1px solid rgba(150,100,255,0.3);border-radius:8px;padding:10px;margin-bottom:10px;">';
        html += '<h3 style="margin:0 0 8px 0;font-size:0.9rem;color:#c8a0ff;">🗳️ Active Council Votes (' + _activeVotes.length + ')</h3>';
        for (var _avi = 0; _avi < _activeVotes.length; _avi++) {
            var _av = _activeVotes[_avi];
            var _avDays = Math.max(0, (_av.deadlineDay || 0) - day);
            html += '<button class="btn-medieval" data-action="openVotingDialog" data-id="' + _av.id + '" style="display:block;width:100%;text-align:left;padding:6px 10px;margin-bottom:4px;font-size:0.78rem;">';
            html += '📜 ' + escapeHtml(_av.title || 'Decision') + ' <span style="color:#aaa;font-size:0.7rem;">(' + _avDays + 'd left)</span>';
            html += '</button>';
        }
        html += '</div>';
    }

    // ── Collect kingdoms relevant for feasts/courts ──
    // Show feasts/courts for: active kingdom, current location kingdom, and kingdoms where player has foreign noble status
    var _feastCourtKingdoms = [citizenKingdomId];
    var _playerLocKingdomId = '';
    try {
        if (!Player.traveling && Player.townId) {
            var _plTown = Engine.findTown(Player.townId);
            if (_plTown && _plTown.kingdomId) _playerLocKingdomId = _plTown.kingdomId;
        } else if (Player.traveling && Player.worldX != null) {
            var _nearT = Engine.findNearestTown ? Engine.findNearestTown(Player.worldX, Player.worldY) : null;
            if (_nearT && _nearT.kingdomId) _playerLocKingdomId = _nearT.kingdomId;
        }
    } catch (e) {}
    if (_playerLocKingdomId && _feastCourtKingdoms.indexOf(_playerLocKingdomId) === -1) {
        // Check if player has rank 4+ or foreign noble status in this kingdom
        var _locRank = (Player.socialRank && Player.socialRank[_playerLocKingdomId]) || 0;
        var _locFN = Player.getForeignNobleStatus ? Player.getForeignNobleStatus(_playerLocKingdomId) : false;
        if (_locRank >= 4 || _locFN === 'foreign_noble' || _locFN === 'foreign_minor_noble') {
            _feastCourtKingdoms.push(_playerLocKingdomId);
        }
    }
    // Also add kingdoms where player has foreign noble status
    try {
        var _allK = Engine.getKingdoms ? Engine.getKingdoms() : [];
        for (var _aki = 0; _aki < _allK.length; _aki++) {
            var _akId = _allK[_aki].id;
            if (_feastCourtKingdoms.indexOf(_akId) !== -1) continue;
            var _akFN = Player.getForeignNobleStatus ? Player.getForeignNobleStatus(_akId) : false;
            if (_akFN === 'foreign_noble' || _akFN === 'foreign_minor_noble') {
                _feastCourtKingdoms.push(_akId);
            }
        }
    } catch (e) {}

    // ── ROYAL FEASTS (multi-kingdom) ──
    var _shownFeastKingdoms = {};
    for (var _fki = 0; _fki < _feastCourtKingdoms.length; _fki++) {
        var _fkId = _feastCourtKingdoms[_fki];
        if (!_fkId || _shownFeastKingdoms[_fkId]) continue;
        _shownFeastKingdoms[_fkId] = true;
        var _fkName = '';
        try { var _fkObj = Engine.findKingdom(_fkId); if (_fkObj) _fkName = _fkObj.name; } catch (e) {}
        var _fkLabel = (_fkId !== citizenKingdomId && _fkName) ? ' <span style="color:#aaa;font-size:0.7rem;">(' + escapeHtml(_fkName) + ')</span>' : '';

        var _activeFeast = null;
        try { _activeFeast = Engine.getActiveFeast ? Engine.getActiveFeast(_fkId) : null; } catch (e) {}
        if (_activeFeast) {
            var _feastDaysLeft = Math.max(0, (_activeFeast.endDay || 0) - day);
            var _feastTownName = '';
            try { var _fTown = Engine.findTown(_activeFeast.townId); _feastTownName = _fTown ? _fTown.name : ''; } catch (e) {}
            var _playerAtFeast = Player.townId === _activeFeast.townId && !Player.traveling;
            html += '<div style="background:rgba(200,150,50,0.12);border:1px solid rgba(200,150,50,0.3);border-radius:8px;padding:10px;margin-bottom:10px;">';
            html += '<h3 style="margin:0 0 6px 0;font-size:0.9rem;color:#f0c040;">🎪 Royal Feast' + _fkLabel + '</h3>';
            html += '<div style="font-size:0.78rem;color:#ccc;">A royal feast is being held in <strong>' + escapeHtml(_feastTownName) + '</strong>!</div>';
            html += '<div style="font-size:0.72rem;color:#aaa;margin-top:2px;">' + _feastDaysLeft + ' day' + (_feastDaysLeft !== 1 ? 's' : '') + ' remaining • Actions used today: ' + (_activeFeast._playerActionsToday || 0) + '/3</div>';
            if (_playerAtFeast) {
                html += '<button class="btn-medieval" data-action="openFeastDialog" data-id="' + _fkId + '" style="font-size:0.78rem;padding:6px 14px;margin-top:6px;background:rgba(200,150,50,0.3) !important;border-color:rgba(200,150,50,0.5) !important;">🍷 Attend Feast</button>';
            } else {
                html += '<div style="font-size:0.72rem;color:#e67e22;margin-top:4px;">📍 You must travel to ' + escapeHtml(_feastTownName) + ' to attend.</div>';
            }
            html += '</div>';
        }

        var _pendingFeast = null;
        try { _pendingFeast = Engine.getPendingFeast ? Engine.getPendingFeast(_fkId) : null; } catch (e) {}
        if (_pendingFeast && !_activeFeast) {
            var _pfDaysUntil = Math.max(0, (_pendingFeast.startDay || 0) - day);
            var _pfTownName = _pendingFeast.townName || '';
            if (!_pfTownName) {
                try { var _pfT = Engine.findTown(_pendingFeast.townId); _pfTownName = _pfT ? _pfT.name : 'the capital'; } catch (e) { _pfTownName = 'the capital'; }
            }
            html += '<div style="background:rgba(200,150,50,0.08);border:1px solid rgba(200,150,50,0.2);border-radius:8px;padding:10px;margin-bottom:10px;">';
            html += '<h3 style="margin:0 0 6px 0;font-size:0.9rem;color:#f0c040;">📅 Upcoming Feast' + _fkLabel + '</h3>';
            html += '<div style="font-size:0.78rem;color:#ccc;">A Royal Feast is scheduled in <strong>' + escapeHtml(_pfTownName) + '</strong> in <strong>' + _pfDaysUntil + ' day' + (_pfDaysUntil !== 1 ? 's' : '') + '</strong>.</div>';
            html += '<div style="font-size:0.72rem;color:#aaa;margin-top:2px;">Begins day ' + (_pendingFeast.startDay || '?') + ' • Ends day ' + (_pendingFeast.endDay || '?') + '</div>';
            html += '<div style="font-size:0.72rem;color:#e67e22;margin-top:4px;">📍 Make sure to travel to ' + escapeHtml(_pfTownName) + ' before it begins!</div>';
            html += '</div>';
        }
    }

    // ── PENDING / SCHEDULED COURT (multi-kingdom) ──
    var _shownCourtKingdoms = {};
    for (var _cki = 0; _cki < _feastCourtKingdoms.length; _cki++) {
        var _ckId = _feastCourtKingdoms[_cki];
        if (!_ckId || _shownCourtKingdoms[_ckId]) continue;
        _shownCourtKingdoms[_ckId] = true;
        var _ckName = '';
        try { var _ckObj = Engine.findKingdom(_ckId); if (_ckObj) _ckName = _ckObj.name; } catch (e) {}
        var _ckLabel = (_ckId !== citizenKingdomId && _ckName) ? ' <span style="color:#aaa;font-size:0.7rem;">(' + escapeHtml(_ckName) + ')</span>' : '';

        var _hasActiveCourtSession = false;
        try {
            var _ckActive = Engine.findKingdom(_ckId);
            if (_ckActive && _ckActive._activeCourtSession && _ckActive._activeCourtSession._playerActionsLeft > 0) {
                _hasActiveCourtSession = true;
            }
        } catch (e) {}
        var _pendingCourt = null;
        if (!_hasActiveCourtSession) {
            try { _pendingCourt = Engine.getPendingCourt ? Engine.getPendingCourt(_ckId) : null; } catch (e) {}
        }
        var _nextCourtDay = null;
        if (!_pendingCourt && !_hasActiveCourtSession) {
            try {
                var _ckk = Engine.findKingdom(_ckId);
                if (_ckk && _ckk._nextCourtDay && _ckk._nextCourtDay > day) {
                    _nextCourtDay = _ckk._nextCourtDay;
                }
            } catch (e) {}
        }
        if (_hasActiveCourtSession) {
            var _activeCourtK = Engine.findKingdom(_ckId);
            var _acActions = _activeCourtK._activeCourtSession._playerActionsLeft;
            html += '<div style="background:rgba(80,120,200,0.15);border:2px solid rgba(80,120,200,0.5);border-radius:8px;padding:12px;margin-bottom:10px;">';
            html += '<h3 style="margin:0 0 6px 0;font-size:0.95rem;color:#5dade2;">⚖️ Royal Court is in Session!' + _ckLabel + '</h3>';
            html += '<div style="font-size:0.85rem;color:#ddd;">The king is holding court today. You have <strong>' + _acActions + ' action' + (_acActions !== 1 ? 's' : '') + '</strong> remaining.</div>';
            html += '<div style="font-size:0.78rem;color:#f0c040;margin-top:6px;">👉 Go to the <strong>Influence</strong> tab to take court actions!</div>';
            html += '</div>';
        } else if (_pendingCourt) {
            var _pcDaysUntil = Math.max(0, (_pendingCourt.courtDay || 0) - day);
            var _pcTownName = '';
            try { var _pcT = Engine.findTown(_pendingCourt.townId); _pcTownName = _pcT ? _pcT.name : 'the capital'; } catch (e) { _pcTownName = 'the capital'; }
            html += '<div style="background:rgba(80,120,200,0.08);border:1px solid rgba(80,120,200,0.2);border-radius:8px;padding:10px;margin-bottom:10px;">';
            html += '<h3 style="margin:0 0 6px 0;font-size:0.9rem;color:#5dade2;">📅 Upcoming Royal Court' + _ckLabel + '</h3>';
            html += '<div style="font-size:0.78rem;color:#ccc;">A Royal Court session is scheduled in <strong>' + escapeHtml(_pcTownName) + '</strong> in <strong>' + _pcDaysUntil + ' day' + (_pcDaysUntil !== 1 ? 's' : '') + '</strong>.</div>';
            html += '<div style="font-size:0.72rem;color:#aaa;margin-top:2px;">Court day: day ' + (_pendingCourt.courtDay || '?') + '</div>';
            html += '<div style="font-size:0.72rem;color:#e67e22;margin-top:4px;">📍 Make sure to travel to ' + escapeHtml(_pcTownName) + ' before it begins!</div>';
            html += '</div>';
        } else if (_nextCourtDay) {
            var _ncdDaysUntil = _nextCourtDay - day;
            var _ncdTownName = 'the capital';
            try {
                var _ckk2 = Engine.findKingdom(_ckId);
                if (_ckk2) {
                    var _ncdTown = Engine.findTown(_ckk2.capitalTownId || '');
                    if (_ncdTown) _ncdTownName = _ncdTown.name;
                }
            } catch (e) {}
            html += '<div style="background:rgba(80,120,200,0.08);border:1px solid rgba(80,120,200,0.2);border-radius:8px;padding:10px;margin-bottom:10px;">';
            html += '<h3 style="margin:0 0 6px 0;font-size:0.9rem;color:#5dade2;">📅 Upcoming Royal Court' + _ckLabel + '</h3>';
            html += '<div style="font-size:0.78rem;color:#ccc;">The king will hold court in <strong>' + escapeHtml(_ncdTownName) + '</strong> in <strong>' + _ncdDaysUntil + ' day' + (_ncdDaysUntil !== 1 ? 's' : '') + '</strong>.</div>';
            html += '<div style="font-size:0.72rem;color:#aaa;margin-top:2px;">Court day: day ' + _nextCourtDay + '</div>';
            html += '<div style="font-size:0.72rem;color:#e67e22;margin-top:4px;">📍 Make sure to be at ' + escapeHtml(_ncdTownName) + ' before it begins!</div>';
            html += '</div>';
        }
    }

    // ── PRIVILEGES SUMMARY ──
    html += '<div style="background:rgba(0,0,0,0.2);border:1px solid rgba(201,168,76,0.2);border-radius:8px;padding:10px;margin-bottom:10px;">';
    html += '<h3 style="margin:0 0 8px 0;font-size:0.9rem;color:var(--gold);">🏅 Noble Privileges</h3>';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 12px;font-size:0.75rem;">';
    if (rankDef.taxExempt) {
        html += '<div style="color:#aaa;">Tax Status:</div><div style="color:#55a868;font-weight:bold;">Exempt from all kingdom taxes</div>';
    } else if (rankDef.lordTaxFree) {
        var _lordTownName = 'your lord town';
        try { if (Player.lordTownId) { var _lt = Engine.findTown(Player.lordTownId); if (_lt) _lordTownName = _lt.name; } } catch(e) {}
        html += '<div style="color:#aaa;">Tax Status:</div><div style="color:#55a868;font-weight:bold;">Tax-free in ' + _lordTownName + ', 10% discount elsewhere</div>';
    } else {
        html += '<div style="color:#aaa;">Tax Discount:</div><div style="color:#55a868;font-weight:bold;">' + Math.floor((rankDef.taxDiscount || 0) * 100) + '%' + (playerRank >= 1 ? ' + no foreign surcharge' : '') + '</div>';
    }
    if (rankDef.petitionBonus) {
        html += '<div style="color:#aaa;">Petition Bonus:</div><div style="color:#55a868;font-weight:bold;">+' + Math.floor((rankDef.petitionBonus || 0) * 100) + '%</div>';
    }
    if (rankDef.signatureBonus) {
        html += '<div style="color:#aaa;">Signature Weight:</div><div style="color:#55a868;font-weight:bold;">+' + Math.floor((rankDef.signatureBonus || 0) * 100) + '%</div>';
    }
    html += '<div style="color:#aaa;">Max Workers:</div><div>' + (rankDef.maxWorkers >= 9999 ? '∞' : rankDef.maxWorkers) + '</div>';
    html += '<div style="color:#aaa;">Max Buildings:</div><div>' + (rankDef.maxBuildings >= 9999 ? '∞' : rankDef.maxBuildings) + '</div>';
    html += '<div style="color:#aaa;">Max Land:</div><div>' + (rankDef.maxLand >= 9999 ? '∞' : rankDef.maxLand) + '</div>';
    html += '</div>';

    // Abilities list
    var abilities = rankDef.abilities || [];
    if (abilities.length > 0) {
        var abilityNames = {
            'influence_king': '🗣️ Influence the King',
            'production_permits': '📋 Production Permits',
            'attend_court': '🏰 Attend Court',
            'noble_marriage': '💍 Noble Marriage',
            'signature_bonus': '✍️ Petition Signature Bonus',
            'build_anywhere': '🏗️ Build in Any Town',
            'revitalize_towns': '🌱 Town Revitalization',
            'raise_militia': '⚔️ Raise Militia',
            'local_trade_policies': '📊 Local Trade Policies',
            'crime_immunity': '🛡️ Crime Immunity (Lord Town)',
            'propose_laws': '📜 Propose Laws',
            'declare_emergencies': '🚨 Declare Emergencies',
            'override_officials': '⚖️ Override Officials',
            'petition_bonus': '📋 Petition Success Bonus',
            'king_consults': '👑 King Consults You'
        };
        html += '<div style="margin-top:8px;border-top:1px solid rgba(201,168,76,0.1);padding-top:6px;">';
        html += '<div style="font-size:0.72rem;color:#aaa;margin-bottom:4px;">Abilities:</div>';
        html += '<div style="display:flex;flex-wrap:wrap;gap:3px;">';
        for (var _abi = 0; _abi < abilities.length; _abi++) {
            var _abName = abilityNames[abilities[_abi]] || abilities[_abi];
            html += '<span style="font-size:0.68rem;padding:2px 6px;border-radius:4px;background:rgba(201,168,76,0.1);border:1px solid rgba(201,168,76,0.2);">' + _abName + '</span>';
        }
        html += '</div></div>';
    }
    html += '</div>';

    // ── STANDING & REPUTATION DETAILS ──
    html += '<div style="background:rgba(0,0,0,0.2);border:1px solid rgba(201,168,76,0.2);border-radius:8px;padding:10px;margin-bottom:10px;">';
    html += '<h3 style="margin:0 0 8px 0;font-size:0.9rem;color:var(--gold);">📊 Standing & Reputation</h3>';
    html += '<div style="font-size:0.78rem;color:#ccc;">';

    // Per-kingdom reputation
    for (var _rki = 0; _rki < kingdoms.length; _rki++) {
        var _rkk = kingdoms[_rki];
        var _rkRep = Player.reputation ? (Player.reputation[_rkk.id] || 0) : 0;
        var _rkRank = (Player.socialRank && Player.socialRank[_rkk.id]) || 0;
        if (_rkRank === 0 && _rkRep === 0) continue;
        var _rkDef = CONFIG.SOCIAL_RANKS[_rkRank] || CONFIG.SOCIAL_RANKS[0];
        var _isHome = _rkk.id === citizenKingdomId;
        html += '<div style="margin-bottom:6px;' + (_isHome ? 'border-left:3px solid var(--gold);padding-left:8px;' : '') + '">';
        html += '<div style="font-size:0.75rem;">' + (_rkDef.icon || '') + ' ' + _rkk.name + ' — ' + (_rkDef.name || 'Peasant') + (_isHome ? ' <span style="color:var(--gold);font-size:0.68rem;">(Home)</span>' : '') + '</div>';
        html += '<div style="height:5px;background:rgba(0,0,0,0.3);border-radius:3px;margin-top:2px;"><div style="height:100%;width:' + Math.min(100, Math.max(0, _rkRep)) + '%;background:' + (_rkRep >= 80 ? '#55a868' : _rkRep >= 50 ? '#ccb974' : '#c44e52') + ';border-radius:3px;"></div></div>';
        html += '<div style="font-size:0.65rem;color:#777;margin-top:1px;">Rep: ' + Math.floor(_rkRep) + '/100</div>';
        html += '</div>';
    }

    // King relationship
    if (kingPerson) {
        html += '<div style="margin-top:6px;border-top:1px solid rgba(201,168,76,0.1);padding-top:6px;">';
        html += '<div style="font-size:0.75rem;">👑 Relationship with King ' + kingPerson.firstName + ': <span style="color:' + (kingRel >= 80 ? '#55a868' : kingRel >= 50 ? '#ccb974' : '#c44e52') + ';font-weight:bold;">' + Math.floor(kingRel) + '/100</span></div>';
        html += '</div>';
    }

    // Next rank requirements (if not max)
    if (playerRank < 6) {
        var nextRankDef = CONFIG.SOCIAL_RANKS[playerRank + 1];
        if (nextRankDef) {
            html += '<div style="margin-top:8px;border-top:1px solid rgba(201,168,76,0.1);padding-top:6px;">';
            html += '<div style="font-size:0.78rem;font-weight:bold;color:var(--gold);">Next Rank: ' + (nextRankDef.icon || '') + ' ' + nextRankDef.name + '</div>';
            html += '<div style="font-size:0.72rem;color:#aaa;margin-top:2px;">';
            if (nextRankDef.goldReq) html += '💰 Gold: ' + formatGold(nextRankDef.goldReq) + '<br>';
            if (nextRankDef.repReq) html += '⭐ Kingdom Rep: ' + nextRankDef.repReq + '+<br>';
            if (nextRankDef.extraReq) html += '📋 ' + nextRankDef.extraReq;
            html += '</div></div>';
        }
    }

    html += '</div></div>';

    // ── KINGDOM NOBLES PANEL ──
    html += '<div style="background:rgba(0,0,0,0.2);border:1px solid rgba(201,168,76,0.2);border-radius:8px;padding:10px;margin-bottom:10px;">';
    html += '<div style="font-size:0.9rem;font-weight:bold;color:var(--gold);margin-bottom:8px;">🏛️ Kingdom Nobles</div>';
    try {
        var _allPeople = Engine.getPeople ? Engine.getPeople() : [];
        var _nobles = [];
        for (var _ni = 0; _ni < _allPeople.length; _ni++) {
            var _np = _allPeople[_ni];
            if (!_np.socialRank || !_np.alive) continue;
            var _npRank = 0;
            if (typeof _np.socialRank === 'object') {
                _npRank = _np.socialRank[citizenKingdomId] || 0;
            } else if (typeof _np.socialRank === 'number') {
                _npRank = _np.socialRank;
            }
            if (_npRank >= 4) {
                _nobles.push({ person: _np, rank: _npRank });
            }
        }
        // Sort by rank descending, then name
        _nobles.sort(function(a, b) {
            if (b.rank !== a.rank) return b.rank - a.rank;
            return (a.person.firstName || '').localeCompare(b.person.firstName || '');
        });
        if (_nobles.length === 0) {
            html += '<div style="font-size:0.75rem;color:#888;font-style:italic;">No other nobles found in this kingdom.</div>';
        } else {
            html += '<div style="max-height:200px;overflow-y:auto;">';
            for (var _nbi = 0; _nbi < _nobles.length; _nbi++) {
                var _nb = _nobles[_nbi];
                var _nbPerson = _nb.person;
                var _nbRankDef = CONFIG.SOCIAL_RANKS[_nb.rank] || CONFIG.SOCIAL_RANKS[4];
                var _nbRel = Player.getRelationship ? Player.getRelationship(_nbPerson.id) : { level: 0 };
                var _nbRelLvl = _nbRel.level || 0;
                var _nbRelColor = _nbRelLvl >= 60 ? '#55a868' : _nbRelLvl >= 30 ? '#ccb974' : _nbRelLvl >= 0 ? '#aaa' : '#c44e52';
                var _nbTown = _nbPerson.townId ? Engine.findTown(_nbPerson.townId) : null;
                var _sameLocation = _nbPerson.townId === Player.townId;
                var _isKing = _nb.rank >= 7 || _nbPerson.isKing;
                var _nbSafeIdClick = String(_nbPerson.id).replace(/'/g, "\\'");
                html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;margin-bottom:4px;background:rgba(0,0,0,0.15);border-radius:6px;border-left:3px solid ' + (_sameLocation ? 'var(--gold)' : 'transparent') + ';">';
                html += '<div style="flex:1;min-width:0;cursor:pointer;" data-action="closeAndShowPerson" data-id="' + _nbSafeIdClick + '" title="View details">';
                html += '<div style="font-size:0.78rem;font-weight:bold;color:#ddd;">' + (_nbRankDef.icon || '👑') + ' ' + (_nbPerson.firstName || '') + ' ' + (_nbPerson.lastName || '') + '</div>';
                html += '<div style="font-size:0.68rem;color:#999;">' + (_nbRankDef.name || 'Noble');
                if (_nbTown) html += ' — ' + _nbTown.name;
                if (_sameLocation) html += ' <span style="color:var(--gold);">📍 Here</span>';
                html += '</div>';
                html += '<div style="font-size:0.65rem;color:' + _nbRelColor + ';">Relationship: ' + Math.floor(_nbRelLvl) + '/100</div>';
                html += '</div>';
                // Actions if in same location
                if (_sameLocation) {
                    html += '<div style="display:flex;gap:4px;flex-shrink:0;">';
                    var _nbSafeId = String(_nbPerson.id).replace(/'/g, "\\'");
                    html += '<button class="btn-medieval" data-action="interactNPCSmallTalk" data-id="' + _nbSafeId + '" style="font-size:0.6rem;padding:3px 6px;" title="Small Talk">💬</button>';
                    html += '<button class="btn-medieval" data-action="closeAndGift" data-id="' + _nbSafeId + '" style="font-size:0.6rem;padding:3px 6px;" title="Give Gift">🎁</button>';
                    if (!_isKing) {
                        html += '<button class="btn-medieval" data-action="closeAndSchemes" data-id="' + _nbSafeId + '" style="font-size:0.6rem;padding:3px 6px;" title="Scheme Against">🗡️</button>';
                    }
                    html += '</div>';
                }
                html += '</div>';
            }
            html += '</div>';
        }
    } catch (e) {
        html += '<div style="font-size:0.75rem;color:#888;">Could not load nobles list.</div>';
    }
    html += '</div>';

    // ── NOBLE AGENTS ──
    html += _buildAgentsSection();

    // ── ROYAL DIRECTIVES (Kingdom Quests) ──
    html += _buildRoyalDirectivesSection(citizenKingdomId, day);

    html += '</div>'; // close status tab

    // ── INFLUENCE TAB ── (loyalty manipulation: flatter king, whisper against nobles, feast invitations)
    html += '<div id="nobilityTab_influence" style="display:' + (_nobilityTab === 'influence' ? '' : 'none') + ';">';
    html += _buildNobleInfluenceTab(citizenKingdomId, kingdom, playerRank);
    html += '</div>';

    // ── INTRIGUE TAB ──
    html += '<div id="nobilityTab_intrigue" style="display:' + (_nobilityTab === 'intrigue' ? '' : 'none') + ';">';
    html += _buildNobleIntrigueTab(citizenKingdomId, kingdom, playerRank, _selectedForeignKingdom || null);
    html += '</div>';

    // Open modal
    var footerHtml = '<button class="btn-medieval" data-action="closeModal">Close</button>';
    openModal('👑 Nobility — ' + (rankDef.name || 'Noble'), html, footerHtml);
}

// ── Noble Influence Tab Builder ──
function _buildNobleInfluenceTab(citizenKingdomId, kingdom, playerRank) {
    var html = '';
    var _isKing = typeof Player !== 'undefined' && Player.state && Player.state.isKing;

    // ── Feast Invitations ──
    var invitations = (typeof Player !== 'undefined' && Player.state && Player.state._feastInvitations) || [];
    if (invitations.length > 0) {
        html += '<div style="background:rgba(201,168,76,0.1);border:1px solid rgba(201,168,76,0.3);border-radius:8px;padding:10px;margin-bottom:10px;">';
        html += '<h3 style="margin:0 0 8px 0;font-size:0.95rem;color:var(--gold);">🎪 Feast Invitations</h3>';
        for (var fi = 0; fi < invitations.length; fi++) {
            var inv = invitations[fi];
            html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.05);">';
            html += '<span>Royal Feast in <b>' + escapeHtml(inv.townName || '?') + '</b> (' + escapeHtml(inv.kingdomName || '?') + ') — ends day ' + (inv.endDay || '?') + '</span>';
            html += '<span>';
            html += '<button class="btn-medieval btn-sm" data-action="acceptFeastInvite" data-id="' + fi + '" style="margin-right:4px;">✅ Accept</button>';
            html += '<button class="btn-medieval btn-sm" data-action="declineFeastInvite" data-id="' + fi + '">❌ Decline</button>';
            html += '</span></div>';
        }
        html += '</div>';
    }

    if (_isKing) {
        html += '<p style="color:#999;font-style:italic;">As king, use the King panel for loyalty management.</p>';
        return html;
    }

    // ── Active Court Session ──
    var _courtSession = null;
    try {
        var _ck = Engine.findKingdom(citizenKingdomId);
        if (_ck && _ck._activeCourtSession && _ck._activeCourtSession._playerActionsLeft > 0) {
            _courtSession = _ck._activeCourtSession;
        }
    } catch(e) {}
    if (_courtSession) {
        var _courtTownId = _ck ? _ck.capitalTownId : null;
        var _playerAtCourt = !_courtTownId || Player.townId === _courtTownId;
        html += '<div style="background:rgba(80,120,200,0.1);border:1px solid rgba(80,120,200,0.3);border-radius:8px;padding:10px;margin-bottom:10px;">';
        html += '<h3 style="margin:0 0 8px 0;font-size:0.95rem;color:#5dade2;">⚖️ Court in Session — ' + _courtSession._playerActionsLeft + ' actions left</h3>';
        if (!_playerAtCourt) {
            var _courtTown = Engine.findTown ? Engine.findTown(_courtTownId) : null;
            var _courtTownName = _courtTown ? _courtTown.name : 'the capital';
            html += '<p style="color:#e8a735;font-size:0.85rem;margin:0;">⚠️ You must travel to <b>' + _courtTownName + '</b> to attend court.</p>';
        } else {
            html += '<p style="color:#bbb;font-size:0.8rem;margin:0 0 8px 0;">The king is holding court. Take formal actions to influence your standing.</p>';
            var _courtActions = [
                { id: 'address_king', icon: '🎙️', label: 'Address the King', desc: 'Formally speak before the court (+3-7 perceived loyalty)' },
                { id: 'petition_king', icon: '📜', label: 'Present a Petition', desc: 'Present a petition directly to the king' },
                { id: 'observe_nobles', icon: '👁️', label: 'Observe Nobles', desc: 'Learn about a noble\'s true loyalty and personality' },
                { id: 'network_nobles', icon: '🤝', label: 'Network with Nobles', desc: 'Improve relationship with a random noble' },
                { id: 'praise_noble_loyalty', icon: '🏅', label: 'Praise a Noble\'s Loyalty', desc: 'Tell the king how loyal a specific noble is (+3-6 perceived loyalty)' }
            ];
            for (var _ca = 0; _ca < _courtActions.length; _ca++) {
                var _act = _courtActions[_ca];
                html += '<button class="btn-medieval" data-action="doCourtAction" data-id="' + _act.id + '" data-kingdom-id="' + citizenKingdomId + '" style="width:100%;text-align:left;padding:8px 12px;margin-bottom:5px;color:#1a1a2e;background:linear-gradient(135deg,#c9a84c,#e8c76a);border:1px solid #a08030;font-size:0.9rem;">';
                html += _act.icon + ' <b>' + _act.label + '</b> <span style="color:#3a2a10;font-size:0.8rem;">— ' + _act.desc + '</span>';
                html += '</button>';
            }
        }
        html += '</div>';
    }

    // ── Loyalty Manipulation Actions ──
    html += '<div style="background:rgba(0,0,0,0.2);border:1px solid rgba(201,168,76,0.2);border-radius:8px;padding:10px;margin-bottom:10px;">';
    html += '<h3 style="margin:0 0 8px 0;font-size:0.95rem;color:var(--gold);">🎭 Loyalty Manipulation</h3>';
    html += '<p style="color:#bbb;font-size:0.8rem;margin:0 0 8px 0;">Influence how the king perceives you and other nobles. Risky — you may be discovered!</p>';

    // Flatter the King
    html += '<div style="margin-bottom:8px;">';
    html += '<button class="btn-medieval" data-action="nobleFlatterKing" style="width:100%;text-align:left;padding:8px 12px;">';
    html += '😊 <b>Flatter the King</b> — Boost how loyal the king thinks you are';
    html += '</button>';
    html += '<div style="color:#888;font-size:0.75rem;margin-top:2px;">+4-10 perceived loyalty · 5-day cooldown · Risk: king may see through it</div>';
    html += '</div>';

    // Whisper Against Noble (needs target selector)
    html += '<div style="margin-bottom:8px;">';
    html += '<div style="display:flex;gap:6px;align-items:center;">';
    html += '<select id="whisperTarget" style="flex:1;background:#1a1a2e;color:#eee;border:1px solid rgba(201,168,76,0.3);border-radius:4px;padding:4px;">';
    html += '<option value="">— Select noble to slander —</option>';
    // Get nobles
    var _nobles = [];
    try {
        var _allP = Engine.getPeople ? Engine.getPeople() : [];
        for (var _ni = 0; _ni < _allP.length; _ni++) {
            var _np = _allP[_ni];
            if (_np && _np.alive && _np.socialRank && _np.socialRank[citizenKingdomId] >= 4 && _np.id !== (Player.personId || 'player')) {
                _nobles.push(_np);
            }
        }
    } catch(e) {}
    for (var _nj = 0; _nj < _nobles.length; _nj++) {
        var _nn = _nobles[_nj];
        var _nnName = ((_nn.firstName || '') + ' ' + (_nn.lastName || '')).trim();
        html += '<option value="' + _nn.id + '">' + escapeHtml(_nnName) + '</option>';
    }
    html += '</select>';
    html += '<button class="btn-medieval btn-sm" data-action="nobleWhisperAgainst" style="white-space:nowrap;">🗣️ Whisper Against</button>';
    html += '</div>';
    html += '<div style="color:#888;font-size:0.75rem;margin-top:2px;">-3-8 target\'s perceived loyalty · 7-day cooldown · Risk: they may find out!</div>';
    html += '</div>';

    // Boost Ally
    html += '<div style="margin-bottom:8px;">';
    html += '<div style="display:flex;gap:6px;align-items:center;">';
    html += '<select id="boostTarget" style="flex:1;background:#1a1a2e;color:#eee;border:1px solid rgba(201,168,76,0.3);border-radius:4px;padding:4px;">';
    html += '<option value="">— Select noble to vouch for —</option>';
    for (var _nk = 0; _nk < _nobles.length; _nk++) {
        var _nb = _nobles[_nk];
        var _nbName = ((_nb.firstName || '') + ' ' + (_nb.lastName || '')).trim();
        html += '<option value="' + _nb.id + '">' + escapeHtml(_nbName) + '</option>';
    }
    html += '</select>';
    html += '<button class="btn-medieval btn-sm" data-action="nobleBoostAlly" style="white-space:nowrap;">🤝 Vouch For</button>';
    html += '</div>';
    html += '<div style="color:#888;font-size:0.75rem;margin-top:2px;">+3-6 target\'s perceived loyalty · 7-day cooldown · Safe action</div>';
    html += '</div>';

    html += '</div>';

    return html;
}

// ── Noble Intrigue Tab Builder ──
function _buildNobleIntrigueTab(citizenKingdomId, kingdom, playerRank, foreignKingdomId) {
    var html = '';

    // Determine which kingdom to show nobles from
    var targetKingdomId = foreignKingdomId || citizenKingdomId;
    var isForeignTarget = targetKingdomId !== citizenKingdomId;
    var isAtWarWithTarget = false;
    if (isForeignTarget) {
        try {
            var _playerK = (typeof Engine !== 'undefined' && Engine.findKingdom) ? Engine.findKingdom(citizenKingdomId) : null;
            if (_playerK && _playerK.atWar && _playerK.atWar.has && _playerK.atWar.has(targetKingdomId)) isAtWarWithTarget = true;
        } catch(e) {}
    }

    // Target Kingdom dropdown
    var _allKingdoms = [];
    try {
        var _wdK = (typeof Engine !== 'undefined' && Engine.getWorld) ? Engine.getWorld() : null;
        if (_wdK && _wdK.kingdoms) _allKingdoms = _wdK.kingdoms;
    } catch(e) {}
    if (_allKingdoms.length > 1) {
        html += '<div style="background:rgba(0,0,0,0.2);border:1px solid rgba(201,168,76,0.2);border-radius:8px;padding:8px 10px;margin-bottom:10px;display:flex;align-items:center;gap:8px;">';
        html += '<span style="font-size:0.82rem;color:var(--gold);">🌍 Target Kingdom:</span>';
        html += '<select id="intrigue_target_kingdom" style="font-size:0.75rem;padding:3px;flex:1;" onchange="if(typeof _refreshIntrigueTab===\'function\')_refreshIntrigueTab(this.value)">';
        for (var _ki = 0; _ki < _allKingdoms.length; _ki++) {
            var _kdom = _allKingdoms[_ki];
            var _kSelected = (_kdom.id === targetKingdomId) ? ' selected' : '';
            var _kLabel = _kdom.name || _kdom.id;
            if (_kdom.id === citizenKingdomId) _kLabel += ' (yours)';
            var _kPlayerK2 = (typeof Engine !== 'undefined' && Engine.findKingdom) ? Engine.findKingdom(citizenKingdomId) : null;
            if (_kdom.id !== citizenKingdomId && _kPlayerK2 && _kPlayerK2.atWar && _kPlayerK2.atWar.has && _kPlayerK2.atWar.has(_kdom.id)) _kLabel += ' ⚔️ AT WAR';
            html += '<option value="' + _kdom.id + '"' + _kSelected + '>' + _kLabel + '</option>';
        }
        html += '</select>';
        html += '</div>';
    }

    // Foreign kingdom warning
    if (isForeignTarget) {
        var _targetK = (typeof Engine !== 'undefined' && Engine.findKingdom) ? Engine.findKingdom(targetKingdomId) : null;
        var _targetName = _targetK ? _targetK.name : targetKingdomId;
        var _warTag = isAtWarWithTarget ? ' <span style="color:#c44e52;font-weight:bold;">⚔️ AT WAR — 4x costs, +25% detection</span>' : ' <span style="color:#e67e22;">2x costs, +15% detection</span>';
        html += '<div style="background:rgba(196,78,82,0.12);border:1px solid rgba(196,78,82,0.3);border-radius:8px;padding:8px 10px;margin-bottom:10px;">';
        html += '<div style="font-size:0.82rem;color:#e67e22;">🌍 Foreign Intrigue: <b>' + escapeHtml(_targetName) + '</b>' + _warTag + '</div>';
        html += '<div style="font-size:0.72rem;color:#aaa;margin-top:2px;">Schemes against foreign nobles carry harsher penalties if caught.</div>';
        html += '</div>';
    }

    // Get kingdom nobles for target selection (same approach as _getKingdomNobles in player_dark_deeds)
    var nobles = [];
    try {
        if (typeof Engine !== 'undefined' && Engine.getWorld && Engine.getPeople) {
            var _wd = Engine.getWorld();
            var _towns = _wd && _wd.towns ? _wd.towns : [];
            var _playerPersonId = (typeof Player !== 'undefined' && Player.personId) ? Player.personId : 'player';
            for (var _ti = 0; _ti < _towns.length; _ti++) {
                if (_towns[_ti].kingdomId !== targetKingdomId) continue;
                var _townPeople = Engine.getPeople(_towns[_ti].id);
                if (!_townPeople) continue;
                for (var _pi = 0; _pi < _townPeople.length; _pi++) {
                    var _p = _townPeople[_pi];
                    if (_p && _p.alive && _p.id !== _playerPersonId && (_p.occupation === 'noble' || _p.isNoble) && !_p.isKing) {
                        nobles.push(_p);
                    }
                }
            }
        }
    } catch(e) {}

    // ═══ Conspiracy Participation Section ═══
    var _conspiracy = null;
    try { _conspiracy = Engine.getKingdomConspiracy(citizenKingdomId); } catch(e) {}

    html += '<div style="background:rgba(139,69,19,0.12);border:1px solid rgba(139,69,19,0.3);border-radius:8px;padding:10px;margin-bottom:10px;">';
    html += '<div style="font-size:0.95rem;font-weight:bold;color:#d4a76a;margin-bottom:6px;">🗡️ Conspiracies</div>';

    if (_conspiracy && _conspiracy.playerInvolved) {
        // Player is in an active conspiracy — show status
        var _cStrColor = _conspiracy.strength >= 80 ? '#2ecc71' : _conspiracy.strength >= 50 ? '#e67e22' : '#c44e52';
        var _cStrLabel = _conspiracy.strength >= 80 ? 'Ready to strike!' : _conspiracy.strength >= 50 ? 'Growing stronger' : 'Still gathering support';
        var _cTypeLabel = _conspiracy.type === 'revolt_support' ? 'revolt support' : _conspiracy.type;
        html += '<div style="background:rgba(0,0,0,0.25);border-radius:6px;padding:8px;margin-bottom:6px;">';
        html += '<div style="font-size:0.85rem;color:#f0d0a0;">You are part of a <strong>' + _cTypeLabel + '</strong> conspiracy</div>';
        if (_conspiracy.type === 'revolt_support' && _conspiracy.revoltTargetTownName) {
            html += '<div style="font-size:0.78rem;color:#e67e22;margin-top:2px;">Target: Funding revolt in <b>' + escapeHtml(_conspiracy.revoltTargetTownName) + '</b></div>';
        }
        html += '<div style="font-size:0.78rem;color:#ccc;margin-top:4px;">Plotters: ' + escapeHtml(_conspiracy.plotterNames.join(', ')) + ' (' + _conspiracy.plotterCount + ' total)</div>';
        html += '<div style="font-size:0.78rem;color:' + _cStrColor + ';margin-top:2px;">Strength: ' + Math.floor(_conspiracy.strength) + '/80 — ' + _cStrLabel + '</div>';
        if (_conspiracy.strength >= 80) {
            var _readyMsg = _conspiracy.type === 'revolt_support' ? '⚡ Resources are ready to deliver to the rebels!' : '⚡ The conspirators are ready to act! The plot will unfold soon.';
            html += '<div style="font-size:0.78rem;color:#2ecc71;margin-top:4px;font-weight:bold;">' + _readyMsg + '</div>';
        }
        html += '<div style="margin-top:6px;">';
        html += '<button class="btn-medieval" data-action="playerLeaveConspiracy" data-id="' + citizenKingdomId + '" style="font-size:0.75rem;padding:4px 10px;background:rgba(196,78,82,0.3);border-color:rgba(196,78,82,0.5);">🚪 Withdraw from Conspiracy</button>';
        html += '</div></div>';
    } else if (_conspiracy && !_conspiracy.playerInvolved) {
        // Active conspiracy exists that player could join
        var _cTypeLabel2 = _conspiracy.type === 'revolt_support' ? 'revolt support' : _conspiracy.type;
        // v9p33river425: guard plotterCount
        var _cPlotCount = _conspiracy.plotterCount || 0;
        html += '<div style="background:rgba(0,0,0,0.25);border-radius:6px;padding:8px;margin-bottom:6px;">';
        html += '<div style="font-size:0.85rem;color:#e67e22;">🤫 Rumours of a <strong>' + _cTypeLabel2 + '</strong> plot are circulating...</div>';
        if (_conspiracy.type === 'revolt_support' && _conspiracy.revoltTargetTownName) {
            html += '<div style="font-size:0.75rem;color:#e67e22;margin-top:2px;">Nobles seek to fund revolt in <b>' + escapeHtml(_conspiracy.revoltTargetTownName) + '</b></div>';
        }
        var _cPlotLabel = _cPlotCount === 1 ? '1 noble is involved' : (_cPlotCount + ' nobles are involved');
        html += '<div style="font-size:0.78rem;color:#aaa;margin-top:4px;">' + _cPlotLabel + '</div>';
        html += '<div style="margin-top:6px;">';
        html += '<button class="btn-medieval" data-action="playerJoinConspiracy" data-id="' + citizenKingdomId + '" style="font-size:0.75rem;padding:4px 10px;background:rgba(139,69,19,0.3);border-color:rgba(139,69,19,0.6);">🗡️ Join the Conspiracy</button>';
        html += '</div></div>';
    } else {
        // No conspiracy — player can form one with a discontented noble
        // v9p33river425: use citizen kingdom nobles only, not foreign target nobles
        var _citizenNobles = [];
        try {
            if (typeof Engine !== 'undefined' && Engine.getWorld && Engine.getPeople) {
                var _cwNobles = Engine.getWorld();
                var _cwTowns = _cwNobles && _cwNobles.towns ? _cwNobles.towns : [];
                var _cwPlayerId = (typeof Player !== 'undefined' && Player.personId) ? Player.personId : 'player';
                for (var _cwi = 0; _cwi < _cwTowns.length; _cwi++) {
                    if (_cwTowns[_cwi].kingdomId !== citizenKingdomId) continue;
                    var _cwPeople = Engine.getPeople(_cwTowns[_cwi].id);
                    if (!_cwPeople) continue;
                    for (var _cwp = 0; _cwp < _cwPeople.length; _cwp++) {
                        var _cwN = _cwPeople[_cwp];
                        if (_cwN && _cwN.alive && _cwN.id !== _cwPlayerId && (_cwN.occupation === 'noble' || _cwN.isNoble) && !_cwN.isKing) {
                            _citizenNobles.push(_cwN);
                        }
                    }
                }
            }
        } catch(e) {}
        var _discontented = _citizenNobles.filter(function(n) { return (n.kingLoyalty != null ? n.kingLoyalty : 50) <= 55; });
        if (_discontented.length > 0) {
            html += '<div style="font-size:0.8rem;color:#aaa;margin-bottom:6px;">No active conspiracy. You could form one with a discontented noble.</div>';
            html += '<div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap;">';
            html += '<select id="conspiracy_target" style="font-size:0.72rem;padding:2px;flex:1;min-width:120px;">';
            for (var _di = 0; _di < _discontented.length; _di++) {
                var _dn = _discontented[_di];
                // v9p33river425: show loyalty descriptor only at 60+ relationship, never exact number
                var _dnRel = (typeof Player !== 'undefined' && Player.getRelationship) ? Player.getRelationship(_dn.id) : null;
                var _dnRelLevel = (_dnRel && _dnRel.level) || 0;
                var _dnLoyDesc = '';
                if (_dnRelLevel >= 60) {
                    var _dnLoy = _dn.kingLoyalty != null ? _dn.kingLoyalty : 50;
                    if (_dnLoy <= 30) _dnLoyDesc = ' — disloyal';
                    else if (_dnLoy <= 69) _dnLoyDesc = ' — wavering';
                    else _dnLoyDesc = ' — loyal';
                }
                html += '<option value="' + _dn.id + '">' + escapeHtml((_dn.firstName || '?') + ' ' + (_dn.lastName || '')) + _dnLoyDesc + '</option>';
            }
            html += '</select>';
            html += '<select id="conspiracy_type" style="font-size:0.72rem;padding:2px;">';
            html += '<option value="assassination">Assassination</option>';
            html += '<option value="coup">Coup</option>';
            html += '<option value="revolt_support">Revolt Support</option>';
            html += '</select>';
            html += '<button class="btn-medieval" data-action="playerFormConspiracy" data-id="' + citizenKingdomId + '" style="font-size:0.72rem;padding:4px 10px;background:rgba(139,69,19,0.3);border-color:rgba(139,69,19,0.6);">🗡️ Form Plot</button>';
            html += '</div>';
        } else {
            html += '<div style="font-size:0.8rem;color:#888;font-style:italic;">No discontented nobles available to conspire with. Nobles must have low loyalty to the king.</div>';
        }
    }
    html += '</div>';

    // ═══ Revolt Support Section ═══
    var _revoltRequests = (typeof Player !== 'undefined' && Player.state && Player.state._revoltSupportRequests) || [];
    var _brewingRevolts = [];
    try { _brewingRevolts = Engine.getBrewingRevolts(citizenKingdomId) || []; } catch(e) {}
    var _supportedRevolt = (typeof Player !== 'undefined' && Player.state) ? Player.state._supportedRevolt : null;

    if (_revoltRequests.length > 0 || _brewingRevolts.length > 0 || _supportedRevolt) {
        html += '<div style="background:rgba(196,78,82,0.10);border:1px solid rgba(196,78,82,0.3);border-radius:8px;padding:10px;margin-bottom:10px;">';
        html += '<div style="font-size:0.95rem;font-weight:bold;color:#e67e22;margin-bottom:6px;">🔥 Revolt Support</div>';

        // Active support pledge
        if (_supportedRevolt && _supportedRevolt.kingdomId === citizenKingdomId) {
            html += '<div style="background:rgba(0,0,0,0.25);border-radius:6px;padding:8px;margin-bottom:6px;">';
            html += '<div style="font-size:0.82rem;color:#e67e22;">You are supporting dissidents in <b>' + escapeHtml(_supportedRevolt.townName) + '</b></div>';
            html += '<div style="font-size:0.75rem;color:#aaa;margin-top:2px;">Pledged: ' + (_supportedRevolt.gold || 0) + 'g on day ' + (_supportedRevolt.day || '?') + '</div>';
            html += '</div>';
        }

        // Incoming requests from revolt organizers
        for (var _rri = 0; _rri < _revoltRequests.length; _rri++) {
            var _rr = _revoltRequests[_rri];
            if (_rr.kingdomId !== citizenKingdomId) continue;
            html += '<div style="background:rgba(0,0,0,0.25);border-radius:6px;padding:8px;margin-bottom:6px;">';
            html += '<div style="font-size:0.85rem;color:#f0d0a0;">📜 Citizens of <b>' + escapeHtml(_rr.townName) + '</b> seek your support!</div>';
            html += '<div style="font-size:0.75rem;color:#aaa;margin-top:2px;">';
            html += 'Unrest level: <span style="color:#c44e52;">' + (_rr.pressureDays || 0) + ' days</span>';
            if (_rr.pledgedNobles > 0) html += ' | <span style="color:#e67e22;">' + _rr.pledgedNobles + ' noble(s) already pledged</span>';
            if (_rr.pledgedGold > 0) html += ' | <span style="color:var(--gold);">' + _rr.pledgedGold + 'g raised</span>';
            html += '</div>';
            html += '<div style="margin-top:6px;display:flex;gap:4px;align-items:center;flex-wrap:wrap;">';
            html += '<label style="font-size:0.72rem;color:#ccc;">Pledge gold:</label>';
            html += '<input type="number" id="revolt_gold_' + _rri + '" value="100" min="10" max="5000" style="width:70px;font-size:0.72rem;padding:2px;">';
            html += '<button class="btn-medieval" data-action="playerSupportRevolt" data-id="' + _rr.townId + '" data-idx="' + _rri + '" style="font-size:0.72rem;padding:4px 10px;background:rgba(196,78,82,0.3);border-color:rgba(196,78,82,0.5);">🔥 Support Revolt</button>';
            html += '<button class="btn-medieval" data-action="playerDeclineRevolt" data-id="' + _rr.townId + '" style="font-size:0.72rem;padding:4px 10px;">❌ Decline</button>';
            html += '</div></div>';
        }

        // Brewing revolts the player can proactively support
        var _hasRequests = {};
        for (var _hri = 0; _hri < _revoltRequests.length; _hri++) _hasRequests[_revoltRequests[_hri].townId] = true;
        for (var _bri = 0; _bri < _brewingRevolts.length; _bri++) {
            var _br = _brewingRevolts[_bri];
            if (_hasRequests[_br.townId] || _br.playerPledged) continue;
            html += '<div style="background:rgba(0,0,0,0.15);border-radius:6px;padding:6px;margin-bottom:4px;">';
            html += '<div style="font-size:0.78rem;color:#ccc;">';
            html += '🏚️ <b>' + escapeHtml(_br.townName) + '</b> — happiness: <span style="color:#c44e52;">' + Math.floor(_br.happiness) + '</span>';
            html += ' | pressure: ' + _br.pressureDays + ' days';
            if (_br.pledgedNobles > 0) html += ' | ' + _br.pledgedNobles + ' noble backer(s)';
            html += '</div>';
            html += '<div style="margin-top:4px;">';
            html += '<input type="number" id="revolt_proactive_' + _bri + '" value="100" min="10" max="5000" style="width:60px;font-size:0.7rem;padding:2px;">';
            html += '<button class="btn-medieval" data-action="playerSupportRevolt" data-id="' + _br.townId + '" data-idx="proactive_' + _bri + '" style="font-size:0.7rem;padding:3px 8px;margin-left:4px;background:rgba(196,78,82,0.2);border-color:rgba(196,78,82,0.4);">🔥 Fund</button>';
            html += '</div></div>';
        }

        html += '</div>';
    }

    // Also update conspiracy display for revolt_support type
    if (_conspiracy && _conspiracy.type === 'revolt_support' && _conspiracy.playerInvolved) {
        html += '<div style="background:rgba(196,78,82,0.12);border:1px solid rgba(196,78,82,0.25);border-radius:6px;padding:8px;margin-bottom:8px;">';
        html += '<div style="font-size:0.82rem;color:#e67e22;">🔥 Your conspiracy is funneling resources to revolt in <b>' + escapeHtml(_conspiracy.revoltTargetTownName || '?') + '</b></div>';
        html += '<div style="font-size:0.75rem;color:#aaa;margin-top:2px;">When strength reaches 80, gold and weapons will be delivered to the dissidents.</div>';
        html += '</div>';
    }

    // Define all 5 schemes with their requirements
    var _costMultiplier = isAtWarWithTarget ? 4 : (isForeignTarget ? 2 : 1);
    var _baseDetectionMap = { pit_nobles: 0.25, turn_noble_against_king: 0.30, discredit_noble: 0.25, expose_secrets: 0.20, manipulate_vote: 0.15 };
    var _foreignDetBonus = isAtWarWithTarget ? 0.25 : (isForeignTarget ? 0.15 : 0);
    var _baseCosts = { pit_nobles: 300, turn_noble_against_king: 500, discredit_noble: 400, manipulate_vote: 200, expose_secrets: 600 };
    var schemes = [
        { id: 'pit_nobles', name: '⚔️ Pit Nobles Against Each Other', desc: 'Create rivalry between two nobles, damaging their relationship.', cost: (_baseCosts.pit_nobles * _costMultiplier) + 'g', skill: 'shadow_dealings', skillAlt: null, needTwo: true },
        { id: 'turn_noble_against_king', name: '🏴 Turn Noble Against King', desc: 'Undermine a noble\'s loyalty to the crown.', cost: (_baseCosts.turn_noble_against_king * _costMultiplier) + 'g', skill: 'kingmaker_skill', skillAlt: null, needTwo: false },
        { id: 'discredit_noble', name: '📜 Discredit Noble', desc: 'Damage a noble\'s standing with the court through misinformation.', cost: (_baseCosts.discredit_noble * _costMultiplier) + 'g', skill: 'shadow_dealings', skillAlt: 'silver_tongue_dark', needTwo: false },
        { id: 'manipulate_vote', name: '🤝 Manipulate Noble Vote', desc: 'Sway a noble\'s position on council proposals for 60 days.', cost: (_baseCosts.manipulate_vote * _costMultiplier) + 'g', skill: 'silver_tongue_dark', skillAlt: 'kingmaker_skill', needTwo: false },
        { id: 'expose_secrets', name: '💥 Expose Noble Secrets', desc: 'Dig up and publicize a noble\'s secrets. Devastates reputation, grants blackmail leverage.', cost: (_baseCosts.expose_secrets * _costMultiplier) + 'g', skill: 'dark_connections', skillAlt: 'shadow_dealings', needTwo: false }
    ];

    // Check which schemes the player can use
    var hasSkillFn = Player.hasSkill || function() { return false; };
    var availableSchemes = [];
    var lockedSchemes = [];
    for (var _si = 0; _si < schemes.length; _si++) {
        var _s = schemes[_si];
        var _hasSkill = hasSkillFn(_s.skill) || (_s.skillAlt && hasSkillFn(_s.skillAlt));
        if (_hasSkill && playerRank >= 4) {
            availableSchemes.push(_s);
        } else {
            lockedSchemes.push(_s);
        }
    }

    // Noble Notoriety bar at top of intrigue tab
    var _nobleNot2 = (typeof Player !== 'undefined' && Player.nobleNotoriety != null) ? Player.nobleNotoriety : 0;
    var _nn2Color = _nobleNot2 >= 70 ? '#c44e52' : _nobleNot2 >= 40 ? '#e67e22' : _nobleNot2 >= 15 ? '#ccb974' : '#55a868';
    var _nn2Label = _nobleNot2 >= 80 ? 'Infamous' : _nobleNot2 >= 60 ? 'Highly Suspicious' : _nobleNot2 >= 40 ? 'Suspicious' : _nobleNot2 >= 20 ? 'Whispers' : _nobleNot2 > 0 ? 'Noticed' : 'Clean';
    html += '<div style="background:rgba(0,0,0,0.2);border:1px solid rgba(201,168,76,0.15);border-radius:8px;padding:8px 10px;margin-bottom:10px;">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">';
    html += '<span style="font-size:0.82rem;color:var(--gold);">🕵️ Noble Notoriety</span>';
    html += '<span style="font-size:0.78rem;color:' + _nn2Color + ';font-weight:bold;">' + Math.floor(_nobleNot2) + '/100 — ' + _nn2Label + '</span>';
    html += '</div>';
    html += '<div style="height:6px;background:#222;border-radius:3px;overflow:hidden;">';
    html += '<div style="width:' + Math.min(100, _nobleNot2) + '%;height:100%;background:' + _nn2Color + ';border-radius:3px;"></div>';
    html += '</div></div>';

    // Show locked schemes at the top if any
    if (lockedSchemes.length > 0) {
        html += '<div style="background:rgba(196,78,82,0.08);border:1px solid rgba(196,78,82,0.2);border-radius:8px;padding:8px 10px;margin-bottom:10px;">';
        html += '<div style="font-size:0.82rem;color:#c44e52;margin-bottom:4px;">🔒 Locked Schemes (' + lockedSchemes.length + ')</div>';
        html += '<div style="font-size:0.72rem;color:#aaa;margin-bottom:6px;">You are missing skills for these noble intrigue schemes:</div>';
        for (var _li = 0; _li < lockedSchemes.length; _li++) {
            var _ls = lockedSchemes[_li];
            var _skillName = (_ls.skill || '').replace(/_/g, ' ');
            var _altName = _ls.skillAlt ? (' or ' + _ls.skillAlt.replace(/_/g, ' ')) : '';
            html += '<div style="font-size:0.75rem;color:#888;padding:2px 0;">🔒 <b>' + _ls.name + '</b> — requires: <span style="color:#c44e52;">' + _skillName + _altName + '</span></div>';
        }
        html += '</div>';
    }

    // Scheme Log
    try {
        var _schemeLog = Player.getState ? Player.getState()._schemeLog : null;
        if (_schemeLog && _schemeLog.length > 0) {
            html += '<div style="background:rgba(0,0,0,0.2);border:1px solid rgba(201,168,76,0.15);border-radius:8px;padding:10px;margin-bottom:10px;">';
            html += '<div style="font-size:0.85rem;color:var(--gold);margin-bottom:6px;">📜 Scheme Log</div>';
            var _logStart = Math.max(0, _schemeLog.length - 8);
            for (var _sli = _schemeLog.length - 1; _sli >= _logStart; _sli--) {
                var _le = _schemeLog[_sli];
                var _leIcon = _le.caught ? '🚨' : _le.success ? '✅' : '❌';
                var _leColor = _le.caught ? '#c44e52' : _le.success ? '#55a868' : '#aaa';
                var _leScheme = (_le.scheme || '').replace(/_/g, ' ');
                html += '<div style="font-size:0.75rem;color:' + _leColor + ';margin:2px 0;padding:3px 6px;background:rgba(0,0,0,0.15);border-radius:3px;">';
                html += _leIcon + ' Day ' + (_le.day || '?') + ' — <b>' + escapeHtml(_leScheme) + '</b> vs ' + escapeHtml(_le.target || '?');
                html += '</div>';
            }
            html += '</div>';
        }
    } catch(e) {}

    // Available schemes
    if (availableSchemes.length === 0) {
        html += '<div style="text-align:center;padding:20px;color:#888;font-size:0.85rem;">';
        html += '🔒 You need noble intrigue skills to access schemes.<br>';
        html += '<span style="font-size:0.75rem;">Train skills like Shadow Dealings, Kingmaker, Silver Tongue (Dark), or Dark Connections.</span>';
        html += '</div>';
    } else {
        html += '<div style="font-size:0.82rem;color:#ccc;margin-bottom:8px;">🗡️ Available Schemes (' + availableSchemes.length + '/' + schemes.length + ')</div>';
        for (var _ai = 0; _ai < availableSchemes.length; _ai++) {
            var _as = availableSchemes[_ai];
            html += '<div style="border:1px solid rgba(201,168,76,0.2);border-radius:6px;padding:10px;margin-bottom:8px;background:rgba(0,0,0,0.15);">';
            html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
            html += '<strong style="font-size:0.9rem;">' + _as.name + '</strong>';
            var _detBase = _baseDetectionMap[_as.id] || 0.20;
            var _detDisplay = Math.min(95, Math.round((_detBase + _foreignDetBonus) * 100));
            html += '<span style="font-size:0.75rem;color:var(--gold);">' + _as.cost + ' · <span style="color:' + (_detDisplay >= 40 ? '#c44e52' : _detDisplay >= 25 ? '#e67e22' : '#ccb974') + ';">🎯' + _detDisplay + '%</span></span>';
            html += '</div>';
            html += '<div style="font-size:0.75rem;color:#aaa;margin-top:4px;">' + _as.desc + '</div>';

            // Noble select
            if (nobles.length > 0) {
                html += '<div style="margin-top:6px;display:flex;gap:4px;align-items:center;flex-wrap:wrap;">';
                html += '<select id="nob_intA_' + _ai + '" style="font-size:0.7rem;padding:2px;flex:1;min-width:100px;">';
                for (var _nj = 0; _nj < nobles.length; _nj++) {
                    var _n = nobles[_nj];
                    var _nName = (_n.firstName || '?') + ' ' + (_n.lastName || '');
                    var _nRank = (_n.socialRank && _n.socialRank[targetKingdomId]) || 4;
                    var _nRL = _nRank >= 6 ? ' [RA]' : _nRank >= 5 ? ' [Lord]' : ' [Noble]';
                    var _nFact = _n._faction ? ' (' + _n._faction.charAt(0).toUpperCase() + _n._faction.slice(1) + ')' : '';
                    html += '<option value="' + _n.id + '">' + _nName.trim() + _nRL + _nFact + '</option>';
                }
                html += '</select>';
                if (_as.needTwo) {
                    html += '<select id="nob_intB_' + _ai + '" style="font-size:0.7rem;padding:2px;flex:1;min-width:100px;">';
                    for (var _nk = 0; _nk < nobles.length; _nk++) {
                        var _n2 = nobles[_nk];
                        html += '<option value="' + _n2.id + '">' + (_n2.firstName || '?') + ' ' + (_n2.lastName || '') + '</option>';
                    }
                    html += '</select>';
                }
                html += '<button class="btn-trade sell" style="font-size:0.7rem;" data-action="executeNobilityIntrigue" data-id="' + _as.id + '" data-idx="' + _ai + '">⚡ Execute</button>';
                html += '</div>';
            } else {
                html += '<div style="font-size:0.75rem;color:#888;margin-top:4px;">No nobles available to target.</div>';
            }
            html += '</div>';
        }
    }

    // Court Intelligence (also show here for easy reference)
    try {
        if (nobles.length > 0) {
            html += '<div style="background:rgba(0,0,0,0.2);border:1px solid rgba(108,155,209,0.15);border-radius:8px;padding:10px;margin-bottom:10px;">';
            html += '<div style="font-size:0.85rem;color:#6c9bd1;margin-bottom:6px;">🏛️ Court Intelligence (' + nobles.length + ' nobles)</div>';
            var _kingPerson = null;
            if (kingdom && kingdom.king && typeof Engine !== 'undefined' && Engine.findPerson) _kingPerson = Engine.findPerson(kingdom.king);
            for (var _ci = 0; _ci < Math.min(12, nobles.length); _ci++) {
                var _cn = nobles[_ci];
                var _cnRank = (_cn.socialRank && _cn.socialRank[targetKingdomId]) || 4;
                var _cnRL = _cnRank >= 6 ? 'RA' : _cnRank >= 5 ? 'Lord' : 'Noble';
                var _cnLoy = _cn._nobleRelationships && _kingPerson ? (_cn._nobleRelationships[_kingPerson.id] || 0) : 0;
                var _cnLC = _cnLoy >= 30 ? '#55a868' : _cnLoy >= 0 ? '#ccb974' : '#c44e52';
                var _cnRep = (_cn.reputation && _cn.reputation[targetKingdomId]) ? Math.floor(_cn.reputation[targetKingdomId]) : 50;
                var _cnScan = _cn._scandalized ? ' 💥' : '';
                var _cnFact2 = _cn._faction ? (' [' + _cn._faction.charAt(0).toUpperCase() + _cn._faction.slice(1) + ']') : '';
                // Player relationship
                var _cnPRel = 0;
                try { var _pr = Player.getRelationship ? Player.getRelationship(_cn.id) : null; _cnPRel = _pr ? _pr.level : 0; } catch(e) {}
                var _cnPRC = _cnPRel >= 40 ? '#55a868' : _cnPRel >= 10 ? '#ccb974' : _cnPRel > -10 ? '#aaa' : '#c44e52';
                html += '<div style="font-size:0.75rem;padding:2px 0;color:#ccc;">';
                html += '<b>' + escapeHtml(_cn.firstName || '?') + '</b> [' + _cnRL + ']';
                html += ' — King: <span style="color:' + _cnLC + ';">' + _cnLoy + '</span>';
                html += ' | Rep: ' + _cnRep + _cnScan;
                html += ' | You: <span style="color:' + _cnPRC + ';">' + _cnPRel + '</span>';
                html += _cnFact2;
                html += '</div>';
            }
            if (nobles.length > 12) html += '<div style="font-size:0.7rem;color:#888;">...and ' + (nobles.length - 12) + ' more</div>';
            html += '</div>';
        }
    } catch(e) {}

    return html;
}

// ── Noble Agents UI ──
var _agentExpandedId = null; // which agent's details are expanded

function _buildAgentsSection() {
    var html = '';
    var data = null;
    try { data = Player.getAgentData(); } catch(e) { return ''; }
    if (!data) return '';

    html += '<div style="background:rgba(44,62,80,0.2);border:1px solid rgba(155,89,182,0.3);border-radius:8px;padding:10px;margin-bottom:10px;">';
    html += '<h3 style="margin:0 0 8px 0;font-size:0.9rem;color:#9b59b6;">🕵️ Agents (' + data.agents.length + '/' + data.maxAgents + ')</h3>';

    if (data.maxAgents === 0) {
        html += '<div style="font-size:0.78rem;color:#888;font-style:italic;">Agents are available once you reach Minor Noble rank.</div>';
        html += '</div>';
        return html;
    }

    // Hire button
    if (data.agents.length < data.maxAgents) {
        html += '<button class="btn-medieval" data-action="hireAgentAction" style="font-size:0.75rem;padding:4px 10px;margin-bottom:8px;background:rgba(155,89,182,0.2);border-color:rgba(155,89,182,0.4);">➕ Hire Agent (' + data.hireCost + 'g)</button>';
    }

    // Agent list
    if (data.agents.length === 0) {
        html += '<div style="font-size:0.78rem;color:#888;font-style:italic;">No agents hired. Agents can trade, spy, sabotage, and more on your behalf.</div>';
    }

    for (var i = 0; i < data.agents.length; i++) {
        var ag = data.agents[i];
        var isExpanded = _agentExpandedId === ag.id;
        var statusColor = ag.status === 'idle' ? '#55a868' : ag.status === 'working' ? '#5dade2' : ag.status === 'traveling' ? '#ccb974' : ag.status === 'jailed' ? '#c44e52' : ag.status === 'caught' ? '#e67e22' : '#888';
        var statusIcon = ag.status === 'idle' ? '⏸️' : ag.status === 'working' ? '⚡' : ag.status === 'traveling' ? '🚶' : ag.status === 'jailed' ? '🔒' : ag.status === 'caught' ? '🚨' : '❓';
        var townName = '';
        try { var _at = Engine.findTown(ag.townId); townName = _at ? _at.name : '?'; } catch(e) {}

        html += '<div style="background:rgba(0,0,0,0.15);border:1px solid rgba(155,89,182,0.2);border-radius:6px;padding:8px;margin-bottom:6px;">';

        // Header row
        html += '<div style="display:flex;justify-content:space-between;align-items:center;cursor:pointer;" data-action="toggleAgentExpand" data-id="' + ag.id + '">';
        html += '<div>';
        html += '<span style="font-size:0.82rem;font-weight:bold;color:#d4b5e0;">' + escapeHtml(ag.name) + '</span>';
        html += ' <span style="font-size:0.68rem;color:' + statusColor + ';">' + statusIcon + ' ' + ag.status + '</span>';
        html += '</div>';
        html += '<div style="font-size:0.68rem;color:#aaa;">📍' + escapeHtml(townName) + ' · ' + ag.dailyCost + 'g/day · ' + (isExpanded ? '▼' : '▶') + '</div>';
        html += '</div>';

        // Skills bar
        html += '<div style="font-size:0.65rem;color:#999;margin-top:2px;">⚔️' + ag.skills.combat + ' 🥷' + ag.skills.stealth + ' 📊' + ag.skills.trade + ' 🗣️' + ag.skills.persuasion + ' · ❤️ Loyalty: ' + ag.loyalty + '</div>';

        // Current task summary
        if (ag.task) {
            var tDef = data.taskDefs[ag.task.type];
            var taskLabel = tDef ? (tDef.icon + ' ' + tDef.label) : ag.task.type;
            var targetName = '';
            if (ag.task.targetId) {
                try { var _tp = Engine.findPerson(ag.task.targetId); if (_tp) targetName = ' → ' + (_tp.firstName || '') + ' ' + (_tp.lastName || ''); } catch(e) {}
            }
            html += '<div style="font-size:0.72rem;color:#ccc;margin-top:3px;">Task: <strong>' + taskLabel + '</strong>' + escapeHtml(targetName) + '</div>';
        }

        // Expanded details
        if (isExpanded) {
            html += _buildAgentExpandedUI(ag, data);
        }

        html += '</div>';
    }

    html += '</div>';
    return html;
}

function _buildAgentExpandedUI(agent, data) {
    var html = '<div style="margin-top:8px;border-top:1px solid rgba(155,89,182,0.15);padding-top:8px;">';

    // Earnings summary
    html += '<div style="font-size:0.7rem;color:#aaa;margin-bottom:6px;">💰 Total earnings: ' + (agent.earnings || 0) + 'g · 🚨 Times caught: ' + (agent.catchCount || 0) + '</div>';

    // Task assignment (if idle or to change task)
    if (agent.status === 'idle' || agent.status === 'working') {
        html += '<div style="margin-bottom:6px;">';
        html += '<div style="font-size:0.72rem;color:#bbb;margin-bottom:4px;font-weight:bold;">Assign Task:</div>';

        // Task category tabs
        html += '<div style="display:flex;gap:3px;margin-bottom:6px;flex-wrap:wrap;">';
        var cats = [
            { id: 'hostile', label: '⚔️ Hostile', color: '#c44e52' },
            { id: 'business', label: '📊 Business', color: '#55a868' },
            { id: 'intel', label: '🕵️ Intel', color: '#5dade2' },
            { id: 'diplomatic', label: '🕊️ Diplomatic', color: '#d4a017' }
        ];
        for (var ci = 0; ci < cats.length; ci++) {
            var cat = cats[ci];
            html += '<button class="btn-medieval" data-action="showAgentTaskCategory" data-id="' + agent.id + '" data-val="' + cat.id + '" style="font-size:0.65rem;padding:3px 8px;border-color:' + cat.color + '40;color:' + cat.color + ';">' + cat.label + '</button>';
        }
        html += '</div>';

        // Task input area (populated by JS when category is selected)
        html += '<div id="agentTaskArea_' + agent.id + '"></div>';
        html += '</div>';
    }

    // Reports (last 5)
    var reports = agent.reports || [];
    if (reports.length > 0) {
        html += '<div style="font-size:0.68rem;color:#bbb;font-weight:bold;margin-bottom:3px;">📋 Recent Reports:</div>';
        var showReports = reports.slice(-5).reverse();
        for (var ri = 0; ri < showReports.length; ri++) {
            var r = showReports[ri];
            html += '<div style="font-size:0.65rem;color:#999;margin-bottom:2px;padding:2px 4px;background:rgba(0,0,0,0.1);border-radius:3px;">';
            html += '<span style="color:#777;">Day ' + (r.day || '?') + ':</span> ' + escapeHtml(r.msg);
            html += '</div>';
        }
    }

    // Action buttons
    html += '<div style="display:flex;gap:4px;margin-top:6px;">';
    if (agent.task) {
        html += '<button class="btn-medieval" data-action="cancelAgentTaskAction" data-id="' + agent.id + '" style="font-size:0.65rem;padding:3px 8px;background:rgba(204,185,116,0.2);border-color:rgba(204,185,116,0.4);color:#ccb974;">⏹️ Cancel Task</button>';
    }
    if (agent.townId !== Player.townId) {
        html += '<button class="btn-medieval" data-action="recallAgentAction" data-id="' + agent.id + '" style="font-size:0.65rem;padding:3px 8px;background:rgba(93,173,226,0.2);border-color:rgba(93,173,226,0.4);color:#5dade2;">📍 Recall</button>';
    }
    html += '<button class="btn-medieval" data-action="fireAgentAction" data-id="' + agent.id + '" style="font-size:0.65rem;padding:3px 8px;background:rgba(196,78,82,0.2);border-color:rgba(196,78,82,0.4);color:#c44e52;">🚫 Dismiss</button>';
    html += '</div>';

    html += '</div>';
    return html;
}

function toggleAgentExpand(agentId) {
    _agentExpandedId = (_agentExpandedId === agentId) ? null : agentId;
    openNobilityDialog();
}

function hireAgentAction() {
    var result = Player.hireAgent(Player.townId);
    toast(result.message, result.success ? 'success' : 'warning');
    if (result.success) openNobilityDialog();
}

function fireAgentAction(agentId) {
    var result = Player.fireAgent(agentId);
    toast(result.message, result.success ? 'success' : 'warning');
    openNobilityDialog();
}

function cancelAgentTaskAction(agentId) {
    var result = Player.cancelAgentTask(agentId);
    toast(result.message, result.success ? 'success' : 'warning');
    openNobilityDialog();
}

function recallAgentAction(agentId) {
    var result = Player.recallAgent(agentId);
    toast(result.message, result.success ? 'success' : 'warning');
    openNobilityDialog();
}

function showAgentTaskCategory(agentId, category) {
    var area = document.getElementById('agentTaskArea_' + agentId);
    if (!area) return;
    var data = null;
    try { data = Player.getAgentData(); } catch(e) { return; }
    var defs = data.taskDefs;
    var html = '';

    if (category === 'hostile') {
        html += _buildHostileTaskUI(agentId, defs);
    } else if (category === 'business') {
        html += _buildBusinessTaskUI(agentId, defs);
    } else if (category === 'intel') {
        html += _buildIntelTaskUI(agentId, defs);
    } else if (category === 'diplomatic') {
        html += _buildDiplomaticTaskUI(agentId, defs);
    }

    area.innerHTML = html;
}

function _buildHostileTaskUI(agentId, defs) {
    var html = '';
    // Target selection dropdown
    html += '<div style="margin-bottom:6px;">';
    html += '<label style="font-size:0.7rem;color:#ccc;">Target:</label> ';
    html += '<select id="agentTarget_' + agentId + '" style="font-size:0.7rem;padding:2px;max-width:200px;">';

    // Get nobles and EMs
    var people = [];
    try {
        var world = Engine.getWorld ? Engine.getWorld() : null;
        if (world && world.people) {
            for (var pi = 0; pi < world.people.length; pi++) {
                var p = world.people[pi];
                if (!p.alive) continue;
                if (p.occupation === 'noble' || p.isEliteMerchant) {
                    var pTown = Engine.findTown(p.townId);
                    var label = (p.firstName || '') + ' ' + (p.lastName || '') + ' (' + (p.isEliteMerchant ? 'EM' : 'Noble') + (pTown ? ', ' + pTown.name : '') + ')';
                    people.push({ id: p.id, label: label.trim() });
                }
            }
        }
    } catch(e) {}

    for (var i = 0; i < people.length; i++) {
        html += '<option value="' + people[i].id + '">' + escapeHtml(people[i].label) + '</option>';
    }
    html += '</select>';
    html += '</div>';

    // Action checkboxes
    html += '<div style="font-size:0.68rem;color:#ccc;margin-bottom:4px;">Allowed Actions:</div>';
    var hostileTasks = ['sabotage_buildings', 'arson_buildings', 'raid_caravans', 'spread_rumors', 'steal_goods', 'intimidate'];
    for (var hi = 0; hi < hostileTasks.length; hi++) {
        var ht = hostileTasks[hi];
        var hd = defs[ht];
        if (!hd) continue;
        html += '<label style="font-size:0.68rem;color:#ddd;display:block;margin:2px 0;cursor:pointer;">';
        html += '<input type="checkbox" id="agentAction_' + agentId + '_' + ht + '" value="' + ht + '" style="margin-right:4px;">';
        html += hd.icon + ' ' + hd.label + ' <span style="color:#888;">(' + Math.round(hd.baseDetection * 100) + '% base detection)</span>';
        html += '</label>';
    }

    html += '<button class="btn-medieval" data-action="assignHostileTask" data-id="' + agentId + '" style="font-size:0.7rem;padding:4px 10px;margin-top:6px;background:rgba(196,78,82,0.2);border-color:rgba(196,78,82,0.4);color:#c44e52;">⚡ Assign Hostile Task</button>';
    return html;
}

function _buildBusinessTaskUI(agentId, defs) {
    var html = '';
    // Task type dropdown
    html += '<div style="margin-bottom:4px;">';
    html += '<label style="font-size:0.7rem;color:#ccc;">Task:</label> ';
    html += '<select id="agentBizTask_' + agentId + '" style="font-size:0.7rem;padding:2px;" onchange="UI.onAgentBizTaskChange(\'' + agentId + '\')">';
    var bizTasks = ['run_caravan', 'scout_markets', 'buy_sell_goods', 'manage_properties', 'establish_contacts', 'guard_properties'];
    for (var bi = 0; bi < bizTasks.length; bi++) {
        var bd = defs[bizTasks[bi]];
        if (!bd) continue;
        html += '<option value="' + bizTasks[bi] + '">' + bd.icon + ' ' + bd.label + '</option>';
    }
    html += '</select>';
    html += '</div>';

    // Town selection
    html += '<div style="margin-bottom:4px;">';
    html += '<label style="font-size:0.7rem;color:#ccc;">Town:</label> ';
    html += '<select id="agentBizTown_' + agentId + '" style="font-size:0.7rem;padding:2px;">';
    try {
        var towns = Engine.getTowns ? Engine.getTowns() : [];
        for (var ti = 0; ti < towns.length; ti++) {
            var selected = towns[ti].id === Player.townId ? ' selected' : '';
            html += '<option value="' + towns[ti].id + '"' + selected + '>' + escapeHtml(towns[ti].name) + '</option>';
        }
    } catch(e) {}
    html += '</select>';
    html += '</div>';

    // Monthly budget
    html += '<div style="margin-bottom:4px;">';
    html += '<label style="font-size:0.7rem;color:#ccc;">Monthly Budget:</label> ';
    html += '<input type="number" id="agentBizBudget_' + agentId + '" value="500" min="50" max="10000" step="50" style="font-size:0.7rem;padding:2px;width:80px;"> g';
    html += '</div>';

    // Description area
    html += '<div id="agentBizDesc_' + agentId + '" style="font-size:0.65rem;color:#888;margin-bottom:4px;font-style:italic;">' + (defs.run_caravan ? defs.run_caravan.desc : '') + '</div>';

    html += '<button class="btn-medieval" data-action="assignBusinessTask" data-id="' + agentId + '" style="font-size:0.7rem;padding:4px 10px;margin-top:4px;background:rgba(85,168,104,0.2);border-color:rgba(85,168,104,0.4);color:#55a868;">⚡ Assign Business Task</button>';
    return html;
}

function _buildIntelTaskUI(agentId, defs) {
    var html = '';
    // Task type
    html += '<div style="margin-bottom:4px;">';
    html += '<label style="font-size:0.7rem;color:#ccc;">Task:</label> ';
    html += '<select id="agentIntelTask_' + agentId + '" style="font-size:0.7rem;padding:2px;">';
    html += '<option value="spy_on_target">' + defs.spy_on_target.icon + ' ' + defs.spy_on_target.label + '</option>';
    html += '<option value="counter_intel">' + defs.counter_intel.icon + ' ' + defs.counter_intel.label + '</option>';
    html += '</select>';
    html += '</div>';

    // Target for spy (only needed for spy_on_target)
    html += '<div style="margin-bottom:4px;">';
    html += '<label style="font-size:0.7rem;color:#ccc;">Target:</label> ';
    html += '<select id="agentIntelTarget_' + agentId + '" style="font-size:0.7rem;padding:2px;max-width:200px;">';
    try {
        var world = Engine.getWorld ? Engine.getWorld() : null;
        if (world && world.people) {
            for (var pi = 0; pi < world.people.length; pi++) {
                var p = world.people[pi];
                if (!p.alive) continue;
                if (p.occupation === 'noble' || p.isEliteMerchant) {
                    var pTown = Engine.findTown(p.townId);
                    var label = (p.firstName || '') + ' ' + (p.lastName || '') + ' (' + (p.isEliteMerchant ? 'EM' : 'Noble') + (pTown ? ', ' + pTown.name : '') + ')';
                    html += '<option value="' + p.id + '">' + escapeHtml(label.trim()) + '</option>';
                }
            }
        }
    } catch(e) {}
    html += '</select>';
    html += '</div>';

    html += '<button class="btn-medieval" data-action="assignIntelTask" data-id="' + agentId + '" style="font-size:0.7rem;padding:4px 10px;margin-top:4px;background:rgba(93,173,226,0.2);border-color:rgba(93,173,226,0.4);color:#5dade2;">⚡ Assign Intel Task</button>';
    return html;
}

function _buildDiplomaticTaskUI(agentId, defs) {
    var html = '';
    // Target selection dropdown (nobles only)
    html += '<div style="margin-bottom:6px;">';
    html += '<label style="font-size:0.7rem;color:#ccc;">Target Noble:</label> ';
    html += '<select id="agentDiploTarget_' + agentId + '" style="font-size:0.7rem;padding:2px;max-width:200px;">';

    try {
        var world = Engine.getWorld ? Engine.getWorld() : null;
        if (world && world.people) {
            for (var pi = 0; pi < world.people.length; pi++) {
                var p = world.people[pi];
                if (!p.alive || p.occupation !== 'noble') continue;
                var pTown = Engine.findTown(p.townId);
                var pKingdom = pTown && pTown.kingdomId ? (Engine.findKingdom ? Engine.findKingdom(pTown.kingdomId) : null) : null;
                var label = (p.firstName || '') + ' ' + (p.lastName || '') + ' (Noble' + (pTown ? ', ' + pTown.name : '') + (pKingdom ? ', ' + pKingdom.name : '') + ')';
                html += '<option value="' + p.id + '">' + escapeHtml(label.trim()) + '</option>';
            }
        }
    } catch(e) {}
    html += '</select>';
    html += '</div>';

    // Action checkboxes
    html += '<div style="font-size:0.68rem;color:#ccc;margin-bottom:4px;">Allowed Actions:</div>';
    var diploTasks = ['build_noble_relationship', 'diplomatic_courier', 'noble_intrigue_turn', 'noble_intrigue_discredit', 'noble_intrigue_expose'];
    for (var di = 0; di < diploTasks.length; di++) {
        var dt = diploTasks[di];
        var dd = defs[dt];
        if (!dd) continue;
        html += '<label style="font-size:0.68rem;color:#ddd;display:block;margin:2px 0;cursor:pointer;">';
        html += '<input type="checkbox" id="agentAction_' + agentId + '_' + dt + '" value="' + dt + '" style="margin-right:4px;">';
        html += dd.icon + ' ' + dd.label + ' <span style="color:#888;">(' + Math.round(dd.baseDetection * 100) + '% base detection)</span>';
        html += '</label>';
    }

    html += '<button class="btn-medieval" data-action="assignDiplomaticTask" data-id="' + agentId + '" style="font-size:0.7rem;padding:4px 10px;margin-top:6px;background:rgba(212,160,23,0.2);border-color:rgba(212,160,23,0.4);color:#d4a017;">⚡ Assign Diplomatic Task</button>';
    return html;
}

function onAgentBizTaskChange(agentId) {
    var sel = document.getElementById('agentBizTask_' + agentId);
    var descEl = document.getElementById('agentBizDesc_' + agentId);
    if (!sel || !descEl) return;
    var data = null;
    try { data = Player.getAgentData(); } catch(e) { return; }
    var def = data.taskDefs[sel.value];
    descEl.textContent = def ? def.desc : '';
}

function assignHostileTask(agentId) {
    var targetSel = document.getElementById('agentTarget_' + agentId);
    if (!targetSel || !targetSel.value) { toast('Select a target.', 'warning'); return; }

    // Find first checked action to use as task type
    var hostileTasks = ['sabotage_buildings', 'arson_buildings', 'raid_caravans', 'spread_rumors', 'steal_goods', 'intimidate'];
    var allowedActions = {};
    var firstChecked = null;
    for (var i = 0; i < hostileTasks.length; i++) {
        var cb = document.getElementById('agentAction_' + agentId + '_' + hostileTasks[i]);
        if (cb && cb.checked) {
            allowedActions[hostileTasks[i]] = true;
            if (!firstChecked) firstChecked = hostileTasks[i];
        }
    }
    if (!firstChecked) { toast('Check at least one action.', 'warning'); return; }

    var result = Player.assignAgentTask(agentId, firstChecked, {
        targetId: targetSel.value,
        allowedActions: allowedActions
    });
    toast(result.message, result.success ? 'success' : 'warning');
    if (result.success) openNobilityDialog();
}

function assignBusinessTask(agentId) {
    var taskSel = document.getElementById('agentBizTask_' + agentId);
    var townSel = document.getElementById('agentBizTown_' + agentId);
    var budgetEl = document.getElementById('agentBizBudget_' + agentId);
    if (!taskSel) return;

    var result = Player.assignAgentTask(agentId, taskSel.value, {
        targetTownId: townSel ? townSel.value : null,
        monthlyBudget: budgetEl ? parseInt(budgetEl.value) || 500 : 500
    });
    toast(result.message, result.success ? 'success' : 'warning');
    if (result.success) openNobilityDialog();
}

function assignIntelTask(agentId) {
    var taskSel = document.getElementById('agentIntelTask_' + agentId);
    var targetSel = document.getElementById('agentIntelTarget_' + agentId);
    if (!taskSel) return;

    var params = {};
    if (taskSel.value === 'spy_on_target' && targetSel) {
        params.targetId = targetSel.value;
    }
    var result = Player.assignAgentTask(agentId, taskSel.value, params);
    toast(result.message, result.success ? 'success' : 'warning');
    if (result.success) openNobilityDialog();
}

function assignDiplomaticTask(agentId) {
    var targetSel = document.getElementById('agentDiploTarget_' + agentId);
    if (!targetSel || !targetSel.value) { toast('Select a target noble.', 'warning'); return; }

    var diploTasks = ['build_noble_relationship', 'diplomatic_courier', 'noble_intrigue_turn', 'noble_intrigue_discredit', 'noble_intrigue_expose'];
    var allowedActions = {};
    var firstChecked = null;
    for (var i = 0; i < diploTasks.length; i++) {
        var cb = document.getElementById('agentAction_' + agentId + '_' + diploTasks[i]);
        if (cb && cb.checked) {
            allowedActions[diploTasks[i]] = true;
            if (!firstChecked) firstChecked = diploTasks[i];
        }
    }
    if (!firstChecked) { toast('Check at least one action.', 'warning'); return; }

    var result = Player.assignAgentTask(agentId, firstChecked, {
        targetId: targetSel.value,
        allowedActions: allowedActions
    });
    toast(result.message, result.success ? 'success' : 'warning');
    if (result.success) openNobilityDialog();
}

// ── Royal Directives (Kingdom Quests) UI ──
var _kqTab = 'available'; // available, active, log

function _buildRoyalDirectivesSection(kingdomId, day) {
    var html = '';
    var kqData = null;
    try { kqData = Player.getKingdomQuestData(kingdomId); } catch(e) {}
    if (!kqData) {
        // Try generating
        try { Player.generateKingdomQuests(kingdomId); kqData = Player.getKingdomQuestData(kingdomId); } catch(e2) {}
    }
    if (!kqData) return '';

    var activeCount = (kqData.active || []).length;
    var availCount = (kqData.available || []).length + (kqData.personalAssignment ? 1 : 0);
    var completedCount = (kqData.completed || []).length;

    html += '<div style="background:rgba(44,62,80,0.2);border:1px solid rgba(52,152,219,0.3);border-radius:8px;padding:10px;margin-bottom:10px;">';
    html += '<h3 style="margin:0 0 8px 0;font-size:0.9rem;color:#5dade2;">📜 Royal Directives</h3>';

    // Tab buttons
    html += '<div style="display:flex;gap:4px;margin-bottom:8px;">';
    var tabs = [
        { id: 'available', label: '📋 Available (' + availCount + ')' },
        { id: 'active', label: '⚡ Active (' + activeCount + ')' },
        { id: 'log', label: '📖 Log (' + completedCount + ')' }
    ];
    for (var ti = 0; ti < tabs.length; ti++) {
        var tab = tabs[ti];
        var isActive = _kqTab === tab.id;
        html += '<button class="btn-medieval" data-action="_switchKQTab" data-tab="' + tab.id + '" data-kingdom="' + kingdomId + '" style="font-size:0.7rem;padding:4px 10px;' + (isActive ? 'background:rgba(52,152,219,0.25);border-color:rgba(52,152,219,0.5);color:#5dade2;' : '') + '">' + tab.label + '</button>';
    }
    html += '</div>';

    // Tab content
    if (_kqTab === 'available') {
        html += _buildKQAvailableTab(kqData, kingdomId, day);
    } else if (_kqTab === 'active') {
        html += _buildKQActiveTab(kqData, kingdomId, day);
    } else if (_kqTab === 'log') {
        html += _buildKQLogTab(kqData, day);
    }

    html += '</div>';
    return html;
}

function _buildKQAvailableTab(kqData, kingdomId, day) {
    var html = '';

    // Personal assignment first
    if (kqData.personalAssignment) {
        var pa = kqData.personalAssignment;
        html += '<div style="background:rgba(231,76,60,0.12);border:2px solid rgba(231,76,60,0.4);border-radius:8px;padding:10px;margin-bottom:8px;animation:pulse 2s infinite;">';
        html += '<div style="font-size:0.82rem;font-weight:bold;color:#e74c3c;">⚠️ Personal Royal Assignment</div>';
        html += '<div style="font-size:0.72rem;color:#aaa;margin-bottom:4px;">The King demands your attention!</div>';
        html += _buildKQCard(pa, kingdomId, day, true);
        html += '</div>';
    }

    // Available quests
    if ((kqData.available || []).length === 0 && !kqData.personalAssignment) {
        html += '<div style="font-size:0.78rem;color:#888;font-style:italic;">No royal directives available. Check back later.</div>';
    }
    for (var i = 0; i < (kqData.available || []).length; i++) {
        html += _buildKQCard(kqData.available[i], kingdomId, day, false);
    }
    return html;
}

function _buildKQActiveTab(kqData, kingdomId, day) {
    var html = '';
    if ((kqData.active || []).length === 0) {
        html += '<div style="font-size:0.78rem;color:#888;font-style:italic;">No active kingdom quests. Accept some from the Available tab.</div>';
        return html;
    }
    for (var i = 0; i < kqData.active.length; i++) {
        var q = kqData.active[i];
        var progress = null;
        try { progress = Player.checkKingdomQuestProgress(q.id, kingdomId); } catch(e) {}
        html += _buildKQActiveCard(q, kingdomId, day, progress);
    }
    return html;
}

function _buildKQLogTab(kqData, day) {
    var html = '';
    var completed = (kqData.completed || []).slice().reverse();
    if (completed.length === 0) {
        html += '<div style="font-size:0.78rem;color:#888;font-style:italic;">No completed quests yet.</div>';
        return html;
    }
    for (var i = 0; i < completed.length; i++) {
        var q = completed[i];
        var daysAgo = day - (q.completedDay || 0);
        html += '<div style="background:rgba(0,0,0,0.15);border:1px solid rgba(85,168,104,0.3);border-radius:6px;padding:6px 8px;margin-bottom:4px;">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
        html += '<span style="font-size:0.75rem;color:#55a868;">✅ ' + escapeHtml(q.title) + '</span>';
        html += '<span style="font-size:0.65rem;color:#777;">' + daysAgo + 'd ago</span>';
        html += '</div>';
        var rew = q.rewards || {};
        html += '<div style="font-size:0.65rem;color:#888;">' + _kqCatIcon(q.category) + ' ' + (q.category || '') + ' · ' + (q.difficulty || '') + ' · +' + (rew.gold || 0) + 'g +' + (rew.kingdomRep || 0) + ' rep</div>';
        html += '</div>';
    }
    return html;
}

function _buildKQCard(quest, kingdomId, day, isPersonal) {
    var html = '';
    var daysLeft = Math.max(0, (quest.expiresDay || 0) - day);
    var diffColors = { easy: '#55a868', medium: '#ccb974', hard: '#e67e22', elite: '#e74c3c' };
    var urgColors = { low: '#55a868', normal: '#ccb974', high: '#e67e22', critical: '#e74c3c' };
    var diffBars = { easy: '■□□□', medium: '■■□□', hard: '■■■□', elite: '■■■■' };

    html += '<div style="background:rgba(0,0,0,0.15);border:' + (isPersonal ? '2px solid rgba(255,215,0,0.6)' : '1px solid rgba(201,168,76,0.2)') + ';border-radius:6px;padding:8px;margin-bottom:6px;' + (isPersonal ? 'box-shadow:0 0 8px rgba(255,215,0,0.15);' : '') + '">';

    // Personal quest label
    if (isPersonal) {
        var _kingName = '';
        try {
            var _kqKdoms = Engine.getKingdoms ? Engine.getKingdoms() : [];
            for (var _ki = 0; _ki < _kqKdoms.length; _ki++) {
                if (_kqKdoms[_ki].id === kingdomId && _kqKdoms[_ki].king) {
                    var _kPerson = Engine.findPerson(_kqKdoms[_ki].king);
                    if (_kPerson) _kingName = _kPerson.firstName;
                    break;
                }
            }
        } catch(e) {}
        html += '<div style="font-size:0.65rem;color:#ffd700;margin-bottom:3px;font-style:italic;">👑 ' + (_kingName ? 'King ' + escapeHtml(_kingName) + ' personally requests...' : 'Personal royal directive') + '</div>';
    }

    // Title row
    html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;">';
    html += '<div style="font-size:0.82rem;font-weight:bold;color:#f0e0c0;">' + _kqCatIcon(quest.category) + ' ' + escapeHtml(quest.title) + '</div>';
    html += '<span style="font-size:0.65rem;color:' + (urgColors[quest.urgency] || '#ccb974') + ';font-weight:bold;text-transform:uppercase;">' + (quest.urgency || 'normal') + '</span>';
    html += '</div>';

    // Description
    html += '<div style="font-size:0.72rem;color:#aaa;margin:4px 0;">' + escapeHtml(quest.description) + '</div>';

    // Stats row
    html += '<div style="display:flex;gap:12px;font-size:0.68rem;color:#888;margin-bottom:4px;">';
    html += '<span>Difficulty: <span style="color:' + (diffColors[quest.difficulty] || '#ccb974') + ';">' + (diffBars[quest.difficulty] || '■■□□') + ' ' + (quest.difficulty || 'medium') + '</span></span>';
    html += '<span>⏰ ' + daysLeft + 'd left</span>';
    html += '</div>';

    // Rewards
    var rew = quest.rewards || {};
    html += '<div style="font-size:0.7rem;color:#aaa;">';
    html += 'Reward: <span style="color:var(--gold);">' + (rew.gold || 0) + 'g</span>';
    html += ' · <span style="color:#5dade2;">+' + (rew.kingdomRep || 0) + ' rep</span>';
    html += ' · <span style="color:#bb8fce;">+' + (rew.kingRelationship || 0) + ' king rel</span>';
    if (rew.special) {
        html += ' · <span style="color:#f39c12;">⭐ ' + escapeHtml(rew.special.replace(/_/g, ' ')) + '</span>';
    }
    html += '</div>';

    // H1: Show requirements before accepting
    var reqs = quest.requirements || {};
    var _hasReqs = false;
    var _reqHtml = '<div style="font-size:0.68rem;color:#bbb;margin:4px 0;padding:4px 6px;background:rgba(0,0,0,0.15);border-radius:4px;">';
    _reqHtml += '<div style="color:#999;font-weight:bold;margin-bottom:2px;">📋 Requirements:</div>';
    if (reqs.deliver && Object.keys(reqs.deliver).length > 0) {
        _hasReqs = true;
        for (var _dr in reqs.deliver) {
            var _drName = _dr.replace(/_/g, ' ');
            var _drHas = (Player.state.inventory || {})[_dr] || 0;
            _reqHtml += '<div style="color:' + (_drHas >= reqs.deliver[_dr] ? '#55a868' : '#e67e22') + ';">📦 Deliver: ' + reqs.deliver[_dr] + ' ' + _drName + ' (have: ' + _drHas + ')</div>';
        }
    }
    if (reqs.gold > 0) {
        _hasReqs = true;
        var _gHas = Player.state.gold || 0;
        _reqHtml += '<div style="color:' + (_gHas >= reqs.gold ? '#55a868' : '#e67e22') + ';">💰 Gold: ' + reqs.gold + 'g (have: ' + Math.floor(_gHas) + ')</div>';
    }
    if (reqs.action) {
        _hasReqs = true;
        var _actM = (typeof ACTION_QUEST_MECHANICS !== 'undefined') ? ACTION_QUEST_MECHANICS[reqs.action.type] : null;
        if (reqs.action.type && reqs.action.type.indexOf('visit') >= 0) {
            _reqHtml += '<div>🏘️ Visit ' + (reqs.action.count || 1) + ' ' + (reqs.action.townType || '').replace(/_/g, ' ') + ' towns</div>';
        } else if (reqs.action.goldTarget > 0) {
            _reqHtml += '<div>💰 Raise ' + reqs.action.goldTarget + 'g through trade</div>';
        } else if (_actM) {
            _reqHtml += '<div>⏱️ Time: ' + (_actM.tickCost || 5) + ' days</div>';
            if (_actM.goldCost > 0) _reqHtml += '<div>💰 Cost: ' + _actM.goldCost + 'g</div>';
            if (_actM.locationReq === 'capital') _reqHtml += '<div>📍 Location: Kingdom capital</div>';
            var _estC = Math.round((_actM.successBase || 0.60) * 100);
            _reqHtml += '<div>🎲 Success: ~' + _estC + '%</div>';
        }
    }
    _reqHtml += '</div>';
    if (_hasReqs) html += _reqHtml;

    // H2: How to complete instructions
    var _howTo = '';
    if (reqs.deliver && Object.keys(reqs.deliver).length > 0) {
        _howTo = 'Gather the required items and return to complete delivery.';
    } else if (reqs.gold > 0) {
        _howTo = 'You need ' + reqs.gold + 'g to fund this directive.';
    } else if (reqs.action) {
        if (reqs.action.type && reqs.action.type.indexOf('visit') >= 0) {
            _howTo = 'Travel to ' + (reqs.action.count || 1) + ' qualifying towns to complete.';
        } else if (reqs.action.goldTarget > 0) {
            _howTo = 'Trade goods until you raise ' + reqs.action.goldTarget + 'g in commerce.';
        } else {
            var _actMh = (typeof ACTION_QUEST_MECHANICS !== 'undefined') ? ACTION_QUEST_MECHANICS[reqs.action.type] : null;
            if (_actMh) {
                _howTo = 'Click the action button below, pay the cost, and attempt the task. Your ' + (_actMh.skillKey || 'skills') + ' skill improves chances.';
            }
        }
    }
    if (_howTo) {
        html += '<div style="font-size:0.65rem;color:#88aacc;margin:3px 0;font-style:italic;">📖 ' + _howTo + '</div>';
    }

    // Action buttons
    html += '<div style="display:flex;gap:6px;margin-top:6px;">';
    var safeId = quest.id.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    var safeKid = kingdomId.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    html += '<button class="btn-medieval" data-action="acceptKingdomQuestAction" data-id="' + safeId + '" data-kingdom="' + safeKid + '" style="font-size:0.72rem;padding:4px 12px;background:rgba(46,204,113,0.2) !important;border-color:rgba(46,204,113,0.4) !important;">✅ Accept</button>';

    // Reject button with penalty info
    var rejPen = quest.rejectionPenalty || { rep: 2, kingRel: 3 };
    var rejLabel = isPersonal ? 'Reject (-' + (rejPen.rep * 2) + ' rep)' : 'Decline';
    html += '<button class="btn-medieval" data-action="rejectKingdomQuestAction" data-id="' + safeId + '" data-kingdom="' + safeKid + '" style="font-size:0.72rem;padding:4px 12px;' + (isPersonal ? 'background:rgba(231,76,60,0.15) !important;border-color:rgba(231,76,60,0.3) !important;color:#e74c3c;' : '') + '">' + (isPersonal ? '❌ ' : '') + rejLabel + '</button>';
    html += '</div>';

    html += '</div>';
    return html;
}

// Build interactive step UI for quest active card
function _buildInteractiveStepUI(questId, iData, kingdomId) {
    var html = '';
    var safQid = questId.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    var safKid = kingdomId.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

    if (iData.type === 'search_buildings') {
        html += '<div style="background:rgba(212,168,67,0.1);padding:6px 8px;border-radius:6px;border:1px solid rgba(212,168,67,0.25);margin:4px 0 4px 8px;">';
        html += '<div style="font-size:0.68rem;color:#d4a843;font-weight:bold;margin-bottom:4px;">🔍 Search these buildings for evidence (' + (iData.evidenceFound || 0) + '/' + iData.evidenceNeeded + '):</div>';
        for (var si = 0; si < iData.targets.length; si++) {
            var t = iData.targets[si];
            var icon = t.searched ? (t.foundEvidence ? '✅' : '❌') : '⬜';
            var color = t.searched ? (t.foundEvidence ? '#55a868' : '#888') : '#e67e22';
            var bName = t.buildingType.replace(/_/g, ' ');
            bName = bName.charAt(0).toUpperCase() + bName.slice(1);
            html += '<div style="font-size:0.62rem;color:' + color + ';margin-left:4px;">' + icon + ' ' + escapeHtml(bName) + ' in ' + escapeHtml(t.townName);
            if (!t.searched) html += ' <span style="color:#888;font-style:italic;">— go to Town Market in ' + escapeHtml(t.townName) + '</span>';
            html += '</div>';
        }
        html += '</div>';
    } else if (iData.type === 'interview_npcs') {
        html += '<div style="background:rgba(100,150,212,0.1);padding:6px 8px;border-radius:6px;border:1px solid rgba(100,150,212,0.25);margin:4px 0 4px 8px;">';
        html += '<div style="font-size:0.68rem;color:#6496d4;font-weight:bold;margin-bottom:4px;">🗣️ Interview these people (' + (iData.infoGathered || 0) + '/' + iData.infoNeeded + '):</div>';
        for (var ni = 0; ni < iData.targets.length; ni++) {
            var n = iData.targets[ni];
            var nIcon = n.interviewed ? (n.hadInfo ? '✅' : '❌') : '⬜';
            var nColor = n.interviewed ? (n.hadInfo ? '#55a868' : '#888') : '#6496d4';
            html += '<div style="font-size:0.62rem;color:' + nColor + ';margin-left:4px;">' + nIcon + ' ' + escapeHtml(n.npcName) + ' in ' + escapeHtml(n.townName);
            if (!n.interviewed) html += ' <span style="color:#888;font-style:italic;">— find them in town</span>';
            html += '</div>';
        }
        html += '</div>';
    } else if (iData.type === 'ask_npcs') {
        html += '<div style="background:rgba(180,120,60,0.1);padding:6px 8px;border-radius:6px;border:1px solid rgba(180,120,60,0.25);margin:4px 0 4px 8px;">';
        html += '<div style="font-size:0.68rem;color:#b4783c;font-weight:bold;margin-bottom:4px;">🔎 Track down ' + escapeHtml(iData.criminalName) + ':</div>';
        html += '<div style="font-size:0.6rem;color:#999;margin-bottom:4px;">Last seen in: ';
        var townNames = [];
        for (var lsi = 0; lsi < (iData.lastSeenTowns || []).length; lsi++) {
            townNames.push(escapeHtml(iData.lastSeenTowns[lsi].name || '?'));
        }
        html += townNames.join(', ') + '</div>';
        if (iData.clues && iData.clues.length > 0) {
            html += '<div style="font-size:0.58rem;color:#888;margin-bottom:3px;font-style:italic;">Clues: ' + escapeHtml(iData.clues[0]) + '</div>';
        }
        html += '<div style="font-size:0.62rem;color:#aaa;margin-bottom:2px;">Ask NPCs in these towns:</div>';
        for (var ci = 0; ci < iData.npcClues.length; ci++) {
            var c = iData.npcClues[ci];
            var cIcon = c.asked ? '✅' : '⬜';
            var cColor = c.asked ? '#888' : '#b4783c';
            html += '<div style="font-size:0.62rem;color:' + cColor + ';margin-left:4px;">' + cIcon + ' ' + escapeHtml(c.npcName) + ' in ' + escapeHtml(c.townName);
            if (!c.asked) html += ' <span style="color:#888;font-style:italic;">— find them</span>';
            html += '</div>';
        }
        if (iData.criminalFound) {
            html += '<div style="font-size:0.65rem;color:#55a868;font-weight:bold;margin-top:4px;">✅ Location revealed: ' + escapeHtml(iData.criminalTownName || '?') + '</div>';
        }
        html += '</div>';
    } else if (iData.type === 'capture') {
        html += '<div style="background:rgba(200,60,60,0.1);padding:6px 8px;border-radius:6px;border:1px solid rgba(200,60,60,0.25);margin:4px 0 4px 8px;">';
        html += '<div style="font-size:0.68rem;color:#c83c3c;font-weight:bold;">🎯 Capture ' + escapeHtml(iData.targetName) + '</div>';
        html += '<div style="font-size:0.62rem;color:#aaa;margin-top:2px;">Location: ' + escapeHtml(iData.targetTownName || '?') + ' — travel there and attempt capture</div>';
        html += '<button class="btn-medieval" data-action="attemptCaptureCriminalUI" data-id="' + safQid + '" data-kingdom="' + safKid + '" style="font-size:0.68rem;padding:4px 10px;margin-top:4px;background:rgba(200,60,60,0.2) !important;border-color:rgba(200,60,60,0.4) !important;">🎯 Attempt Capture</button>';
        html += '</div>';
    }

    return html;
}

function _buildKQActiveCard(quest, kingdomId, day, progress) {
    var html = '';
    var daysLeft = Math.max(0, (quest.expiresDay || 0) - day);
    var isComplete = progress && progress.complete;
    var borderColor = isComplete ? 'rgba(46,204,113,0.5)' : daysLeft <= 5 ? 'rgba(231,76,60,0.4)' : 'rgba(52,152,219,0.3)';

    html += '<div style="background:rgba(0,0,0,0.15);border:2px solid ' + borderColor + ';border-radius:6px;padding:8px;margin-bottom:6px;">';

    // Title
    html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
    html += '<div style="font-size:0.82rem;font-weight:bold;color:#f0e0c0;">' + _kqCatIcon(quest.category) + ' ' + escapeHtml(quest.title) + (quest.isPersonal ? ' 👑' : '') + '</div>';
    html += '<span style="font-size:0.68rem;color:' + (daysLeft <= 5 ? '#e74c3c' : daysLeft <= 10 ? '#e67e22' : '#aaa') + ';">⏰ ' + daysLeft + 'd</span>';
    html += '</div>';

    // Description
    html += '<div style="font-size:0.72rem;color:#aaa;margin:4px 0;">' + escapeHtml(quest.description) + '</div>';

    // Progress section
    var reqs = quest.requirements || {};
    html += '<div style="margin:6px 0;">';
    if (reqs.deliver) {
        html += '<div style="font-size:0.7rem;color:#ddd;margin-bottom:2px;">📦 Goods Required:</div>';
        for (var resId in reqs.deliver) {
            var needed = reqs.deliver[resId];
            var have = 0;
            try { have = (Player.state.inventory || {})[resId] || 0; } catch(e) {}
            var met = have >= needed;
            var resName = resId;
            try {
                var rType = RESOURCE_TYPES[resId.toUpperCase()];
                if (rType) resName = (rType.icon || '') + ' ' + rType.name;
            } catch(e) {}
            html += '<div style="font-size:0.68rem;color:' + (met ? '#55a868' : '#e67e22') + ';margin-left:8px;">' + (met ? '✅' : '⬜') + ' ' + escapeHtml(resName) + ': ' + Math.min(have, needed) + '/' + needed + '</div>';
        }
    }
    if (reqs.gold > 0) {
        var goldMet = (Player.state.gold || 0) >= reqs.gold;
        html += '<div style="font-size:0.68rem;color:' + (goldMet ? '#55a868' : '#e67e22') + ';">' + (goldMet ? '✅' : '⬜') + ' 💰 Gold: ' + Math.floor(Player.state.gold || 0) + '/' + reqs.gold + '</div>';
    }
    if (reqs.action) {
        var act = reqs.action;
        if (act.type === 'visit_towns' || act.type === 'visit_foreign' || act.type === 'visit_enemy_towns') {
            var visited = (Player.state._kqVisitedTowns || {})[quest.id] || [];
            var visitMet = visited.length >= act.count;
            var visitLabel = act.type === 'visit_foreign' ? 'Visit foreign towns' : act.type === 'visit_enemy_towns' ? 'Visit enemy towns' : 'Visit towns';
            html += '<div style="font-size:0.68rem;color:' + (visitMet ? '#55a868' : '#e67e22') + ';">' + (visitMet ? '✅' : '⬜') + ' 🏘️ ' + visitLabel + ': ' + visited.length + '/' + act.count + '</div>';

            // M4: Show qualifying towns
            try {
                var _towns = Engine.getTowns ? Engine.getTowns() : [];
                var _playerKingdomId = null;
                try { var _pt = Engine.findTown(Player.townId); if (_pt) _playerKingdomId = _pt.kingdomId; } catch(e2) {}
                var _qualTowns = [];
                for (var _ti = 0; _ti < _towns.length && _qualTowns.length < 8; _ti++) {
                    var _t = _towns[_ti];
                    if (_t.isWilderness || _t.isOutpost) continue;
                    var _isVisited = visited.indexOf(_t.id) >= 0;
                    var _qualifies = false;
                    if (act.type === 'visit_foreign') _qualifies = _t.kingdomId !== _playerKingdomId;
                    else if (act.type === 'visit_enemy_towns') {
                        try {
                            var _pKdom = Engine.findKingdom(_playerKingdomId);
                            _qualifies = _pKdom && _pKdom.atWar && (_pKdom.atWar.has ? _pKdom.atWar.has(_t.kingdomId) : false);
                        } catch(e3) {}
                    } else {
                        _qualifies = _t.kingdomId === _playerKingdomId;
                    }
                    if (_qualifies) _qualTowns.push({ name: _t.name, visited: _isVisited });
                }
                if (_qualTowns.length > 0) {
                    html += '<div style="font-size:0.62rem;color:#777;margin-left:12px;margin-top:2px;">';
                    for (var _qi2 = 0; _qi2 < _qualTowns.length; _qi2++) {
                        html += '<span style="color:' + (_qualTowns[_qi2].visited ? '#55a868' : '#888') + ';">' + (_qualTowns[_qi2].visited ? '✓' : '○') + ' ' + escapeHtml(_qualTowns[_qi2].name) + '</span>';
                        if (_qi2 < _qualTowns.length - 1) html += ' · ';
                    }
                    html += '</div>';
                }
            } catch(e) { /* no-op */ }
        } else if (act.goldTarget > 0) {
            var spent = (Player.state._kqGoldSpent || {})[quest.id] || 0;
            var spentMet = spent >= act.goldTarget;
            html += '<div style="font-size:0.68rem;color:' + (spentMet ? '#55a868' : '#e67e22') + ';">' + (spentMet ? '✅' : '⬜') + ' 💰 Raise gold: ' + spent + '/' + act.goldTarget + '</div>';
        } else {
            var actionDone = (Player.state._kqActionDone || {})[quest.id] || false;
            // Look up action mechanics for rich display
            var _aqMech = (typeof ACTION_QUEST_MECHANICS !== 'undefined') ? ACTION_QUEST_MECHANICS[act.type] : null;
            var _aqLabel = _aqMech ? _aqMech.label : act.type.replace(/_/g, ' ');
            var _aqAttempts = (Player.state._kqActionAttempts || {})[quest.id] || 0;

            // M5: Check for multi-step action
            var _msConfig = (typeof MULTISTEP_ACTIONS !== 'undefined') ? MULTISTEP_ACTIONS[act.type] : null;
            if (!_msConfig && typeof Player.getMultiStepConfig === 'function') { try { _msConfig = Player.getMultiStepConfig(act.type); } catch(e2){} }
            var _msProgress = (Player.state._kqStepProgress || {})[quest.id] || 0;

            if (actionDone) {
                html += '<div style="font-size:0.68rem;color:#55a868;">✅ ' + escapeHtml(_aqLabel) + ' — completed!' + (_aqAttempts > 1 ? ' (took ' + _aqAttempts + ' attempts)' : '') + '</div>';
            } else if (_msConfig && _aqMech) {
                // Multi-step action display
                html += '<div style="font-size:0.72rem;color:#d4a843;margin-bottom:4px;font-weight:bold;">📋 ' + escapeHtml(_aqLabel) + ' <span style="font-size:0.62rem;color:#888;">(' + _msProgress + '/' + _msConfig.totalSteps + ' steps)</span></div>';

                // Step progress bar
                html += '<div style="background:rgba(0,0,0,0.3);border-radius:4px;height:6px;margin:4px 8px;overflow:hidden;">';
                html += '<div style="height:100%;background:linear-gradient(90deg,#55a868,#4caf50);width:' + Math.round((_msProgress / _msConfig.totalSteps) * 100) + '%;border-radius:4px;transition:width 0.3s;"></div></div>';

                // Show each step with status
                for (var _si = 0; _si < _msConfig.steps.length; _si++) {
                    var _step = _msConfig.steps[_si];
                    var _stepDone = _si < _msProgress;
                    var _stepCurrent = _si === _msProgress;
                    var _stepColor = _stepDone ? '#55a868' : _stepCurrent ? '#e67e22' : '#666';
                    var _stepIcon = _stepDone ? '✅' : _stepCurrent ? '▶️' : '⬜';
                    html += '<div style="font-size:0.65rem;color:' + _stepColor + ';margin-left:8px;' + (_stepCurrent ? 'font-weight:bold;' : '') + '">';
                    html += _stepIcon + ' Step ' + (_si + 1) + ': ' + escapeHtml(_step.label);
                    if (_stepCurrent) {
                        var _costs = [];
                        if (_step.goldCost > 0) _costs.push('💰' + _step.goldCost + 'g');
                        if (_step.tickCost > 0) _costs.push('⏳' + _step.tickCost + 'd');
                        var _pct = Math.round((_step.successBase || 0.70) * 100);
                        _costs.push('🎲' + _pct + '%');
                        html += ' <span style="color:#aaa;font-weight:normal;">(' + _costs.join(', ') + ')</span>';
                    }
                    html += '</div>';
                }

                // Narrative for current step
                if (_msConfig.steps[_msProgress]) {
                    html += '<div style="font-size:0.62rem;color:#999;margin:4px 0 4px 12px;font-style:italic;">' + escapeHtml(_msConfig.steps[_msProgress].narrative || '') + '</div>';
                }

                if (_aqAttempts > 0 && _msProgress < _msConfig.totalSteps) {
                    html += '<div style="font-size:0.62rem;color:#e67e22;margin-left:12px;">⚠️ ' + _aqAttempts + ' total attempt' + (_aqAttempts > 1 ? 's' : '') + ' so far</div>';
                }

                // Check for interactive step
                var _curStep = _msConfig.steps[_msProgress];
                var _interactiveType = _curStep ? _curStep.interactive : null;
                var _iData = (Player.state._kqInteractiveData || {})[quest.id];

                if (_interactiveType && _iData) {
                    // Show interactive targets
                    html += _buildInteractiveStepUI(quest.id, _iData, kingdomId);
                }

                // Always show the regular action button as fallback
                var safActId2 = quest.id.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
                var safKid2 = kingdomId.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
                var _curStepBtn = _msConfig.steps[_msProgress];
                if (_interactiveType && _iData) {
                    html += '<div style="font-size:0.58rem;color:#666;margin-top:4px;margin-left:8px;">Or use the manual action:</div>';
                }
                html += '<button class="btn-medieval" data-action="_attemptKQActionUI" data-id="' + safActId2 + '" data-kingdom="' + safKid2 + '" style="font-size:0.7rem;padding:4px 12px;margin-top:4px;background:rgba(231,126,35,0.2) !important;border-color:rgba(231,126,35,0.4) !important;">▶️ ' + escapeHtml(_curStepBtn ? _curStepBtn.label : 'Next Step') + '</button>';
            } else if (_aqMech) {
                // Show action details with proper attempt button
                html += '<div style="font-size:0.68rem;color:#e67e22;margin-bottom:4px;">⬜ ' + escapeHtml(_aqLabel) + '</div>';
                html += '<div style="font-size:0.65rem;color:#999;margin:2px 0 4px 12px;font-style:italic;">' + escapeHtml(_aqMech.narrative || '') + '</div>';
                // Requirements
                html += '<div style="font-size:0.65rem;color:#aaa;margin-left:12px;">';
                if (_aqMech.goldCost > 0) {
                    var _hasGold = (Player.state.gold || 0) >= _aqMech.goldCost;
                    html += '<div style="color:' + (_hasGold ? '#55a868' : '#e74c3c') + ';">💰 Cost: ' + _aqMech.goldCost + 'g' + (!_hasGold ? ' (need ' + (_aqMech.goldCost - Math.floor(Player.state.gold || 0)) + ' more)' : '') + '</div>';
                }
                html += '<div>⏳ Time: ~' + (_aqMech.tickCost || 5) + ' days</div>';
                if (_aqMech.locationReq === 'capital') {
                    var _inCapital = false;
                    try { var _pTown = Engine.findTown(Player.townId); _inCapital = _pTown && _pTown.isCapital; } catch(e) {}
                    html += '<div style="color:' + (_inCapital ? '#55a868' : '#e74c3c') + ';">📍 Must be in kingdom capital' + (!_inCapital ? ' (travel there first)' : ' ✓') + '</div>';
                }
                // Success chance estimate
                var _estChance = Math.round((_aqMech.successBase || 0.60) * 100);
                var _chanceColor = _estChance >= 70 ? '#55a868' : _estChance >= 50 ? '#ccb974' : '#e67e22';
                html += '<div>🎲 Base success: <span style="color:' + _chanceColor + ';">' + _estChance + '%</span> (skills improve this)</div>';
                if (_aqAttempts > 0) {
                    html += '<div style="color:#e67e22;">⚠️ Failed ' + _aqAttempts + ' time' + (_aqAttempts > 1 ? 's' : '') + ' already</div>';
                }
                html += '</div>';

                var safActId = quest.id.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
                var safKid = kingdomId.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
                html += '<button class="btn-medieval" data-action="_attemptKQActionUI" data-id="' + safActId + '" data-kingdom="' + safKid + '" style="font-size:0.7rem;padding:4px 12px;margin-top:4px;background:rgba(231,126,35,0.2) !important;border-color:rgba(231,126,35,0.4) !important;">' + escapeHtml(_aqMech.actionLabel || '⚡ Attempt Action') + '</button>';
            } else {
                // No mechanic defined for this action type — show unavailable
                html += '<div style="font-size:0.68rem;color:#e67e22;">⬜ Complete: ' + escapeHtml(act.type.replace(/_/g, ' ')) + '</div>';
                html += '<div style="font-size:0.65rem;color:#c44e52;margin-left:12px;font-style:italic;">⚠️ Quest action unavailable — no mechanic defined for this action type.</div>';
            }
        }
    }
    html += '</div>';

    // Progress bar
    var totalReqs = 0;
    var metReqs = 0;
    if (reqs.deliver) {
        for (var r in reqs.deliver) {
            totalReqs++;
            try { if (((Player.state.inventory || {})[r] || 0) >= reqs.deliver[r]) metReqs++; } catch(e) {}
        }
    }
    if (reqs.gold > 0) {
        totalReqs++;
        if ((Player.state.gold || 0) >= reqs.gold) metReqs++;
    }
    if (reqs.action) {
        totalReqs++;
        if (reqs.action.type && (reqs.action.type.indexOf('visit') >= 0)) {
            var v = (Player.state._kqVisitedTowns || {})[quest.id] || [];
            if (v.length >= (reqs.action.count || 1)) metReqs++;
        } else if (reqs.action.goldTarget > 0) {
            var s = (Player.state._kqGoldSpent || {})[quest.id] || 0;
            if (s >= reqs.action.goldTarget) metReqs++;
        } else {
            if ((Player.state._kqActionDone || {})[quest.id]) metReqs++;
        }
    }
    var pctComplete = totalReqs > 0 ? Math.floor((metReqs / totalReqs) * 100) : 0;
    html += '<div style="height:4px;background:rgba(0,0,0,0.3);border-radius:2px;margin:4px 0;">';
    html += '<div style="height:100%;width:' + pctComplete + '%;background:' + (isComplete ? '#2ecc71' : '#3498db') + ';border-radius:2px;transition:width 0.3s;"></div>';
    html += '</div>';
    html += '<div style="font-size:0.62rem;color:#777;text-align:right;">' + pctComplete + '% complete</div>';

    // Buttons
    html += '<div style="display:flex;gap:6px;margin-top:4px;">';
    var safeId = quest.id.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    var safeKid = kingdomId.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    if (isComplete) {
        html += '<button class="btn-medieval" data-action="completeKingdomQuestAction" data-id="' + safeId + '" data-kingdom="' + safeKid + '" style="font-size:0.72rem;padding:5px 14px;background:rgba(46,204,113,0.3) !important;border-color:rgba(46,204,113,0.5) !important;color:#2ecc71;font-weight:bold;">🎉 Complete Quest</button>';
    }
    html += '<button class="btn-medieval" data-action="abandonKingdomQuestAction" data-id="' + safeId + '" data-kingdom="' + safeKid + '" style="font-size:0.68rem;padding:3px 8px;opacity:0.6;">Abandon</button>';
    html += '</div>';

    html += '</div>';
    return html;
}

function _kqCatIcon(cat) {
    var icons = { military: '🗡️', economic: '💰', diplomatic: '🤝', espionage: '🕵️', justice: '⚖️', infrastructure: '🏗️', social: '👑', corrupt: '🏴' };
    return icons[cat] || '📜';
}

function _attemptKQActionUI(questId, kingdomId) {
    if (!Player.attemptKQAction) {
        toast('Action system not available.', 'warning');
        return;
    }

    // Look up mechanics to show confirmation
    var _aqMech = null;
    try {
        var _kqD = Player.getKingdomQuestData(kingdomId);
        var _kqQ = null;
        if (_kqD) {
            for (var _qi = 0; _qi < (_kqD.active || []).length; _qi++) {
                if (_kqD.active[_qi].id === questId) { _kqQ = _kqD.active[_qi]; break; }
            }
        }
        if (_kqQ && _kqQ.requirements && _kqQ.requirements.action) {
            _aqMech = (typeof ACTION_QUEST_MECHANICS !== 'undefined') ? ACTION_QUEST_MECHANICS[_kqQ.requirements.action.type] : null;
        }
    } catch(e) {}

    if (_aqMech) {
        // Check for multi-step config
        var _msConf = (typeof MULTISTEP_ACTIONS !== 'undefined' && _kqQ && _kqQ.requirements && _kqQ.requirements.action) ? MULTISTEP_ACTIONS[_kqQ.requirements.action.type] : null;
        var _msProg = _msConf ? ((Player.state._kqStepProgress || {})[questId] || 0) : 0;
        var _msStep = _msConf ? _msConf.steps[_msProg] : null;

        var _confHtml = '<div style="padding:10px;">';
        if (_msConf && _msStep) {
            _confHtml += '<div style="font-size:0.9rem;color:#d4a843;margin-bottom:6px;font-weight:bold;">Step ' + (_msProg + 1) + '/' + _msConf.totalSteps + ': ' + escapeHtml(_msStep.label) + '</div>';
            _confHtml += '<div style="font-size:0.78rem;color:#999;margin-bottom:10px;font-style:italic;">' + escapeHtml(_msStep.narrative || '') + '</div>';
        } else {
            _confHtml += '<div style="font-size:0.9rem;color:#ddd;margin-bottom:10px;">Are you sure you want to attempt this action?</div>';
        }
        _confHtml += '<div style="background:rgba(0,0,0,0.2);border-radius:6px;padding:10px;font-size:0.82rem;">';
        var _dispGold = (_msConf && _msStep) ? (_msStep.goldCost || 0) : (_aqMech.goldCost || 0);
        var _dispTime = (_msConf && _msStep) ? (_msStep.tickCost || 1) : (_aqMech.tickCost || 5);
        var _dispChance = (_msConf && _msStep) ? (_msStep.successBase || 0.70) : (_aqMech.successBase || 0.60);
        if (_dispGold > 0) _confHtml += '<div style="color:#e67e22;">💰 Cost: ' + _dispGold + 'g</div>';
        _confHtml += '<div style="color:#5dade2;">⏳ Time: ~' + _dispTime + ' days (you will be occupied)</div>';
        var _confChance = Math.round(_dispChance * 100);
        _confHtml += '<div style="color:' + (_confChance >= 70 ? '#55a868' : _confChance >= 50 ? '#ccb974' : '#e67e22') + ';">🎲 Base success chance: ' + _confChance + '%</div>';
        if (_aqMech.locationReq === 'capital') _confHtml += '<div style="color:#aaa;">📍 Requires: Kingdom capital</div>';
        _confHtml += '</div>';
        _confHtml += '<div style="font-size:0.75rem;color:#999;margin-top:8px;font-style:italic;">Gold and time are consumed whether you succeed or fail.</div>';
        _confHtml += '</div>';

        var _safQid = questId.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        var _safKid = kingdomId.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        openModal('⚡ Confirm Action', _confHtml,
            '<button class="btn-medieval" data-action="closeAndExecuteKQAction" data-id="' + _safQid + '" data-kingdom="' + _safKid + '" style="background:rgba(231,126,35,0.3) !important;border-color:rgba(231,126,35,0.5) !important;">⚡ Proceed</button>' +
            '<button class="btn-medieval" data-action="closeAndOpenNobilityDialog">Cancel</button>'
        );
    } else {
        // No mechanic — just try and show error
        _executeKQAction(questId, kingdomId);
    }
}

function _executeKQAction(questId, kingdomId) {
    var result = Player.attemptKQAction(questId, kingdomId);
    if (!result) { toast('Failed to attempt action.', 'warning'); return; }

    // If it's a validation error (not enough gold, wrong location), just toast
    if (!result.success) {
        toast(result.message, 'warning');
        openNobilityDialog();
        return;
    }

    // Show result modal with narrative
    var isSuccess = result.actionSuccess;
    var isStepSuccess = result.stepSuccess || false;
    var html = '<div style="padding:15px;">';
    html += '<div style="text-align:center;margin-bottom:12px;">';

    // M5: Multi-step result header
    if (result.isMultiStep) {
        if (isSuccess) {
            html += '<div style="font-size:2.5em;">🏆</div>';
            html += '<h3 style="color:#2ecc71;margin:5px 0;">Mission Complete!</h3>';
        } else if (isStepSuccess) {
            html += '<div style="font-size:2.5em;">✅</div>';
            html += '<h3 style="color:#d4a843;margin:5px 0;">Step Complete — ' + (result.stepCompleted || '?') + '/' + (result.totalSteps || '?') + '</h3>';
        } else {
            html += '<div style="font-size:2.5em;">❌</div>';
            html += '<h3 style="color:#e74c3c;margin:5px 0;">Step Failed</h3>';
        }
    } else {
        html += '<div style="font-size:2.5em;">' + (isSuccess ? '✅' : '❌') + '</div>';
        html += '<h3 style="color:' + (isSuccess ? '#2ecc71' : '#e74c3c') + ';margin:5px 0;">' + (isSuccess ? 'Success!' : 'Failed!') + '</h3>';
    }
    html += '</div>';

    // Result text
    html += '<p style="font-size:0.9rem;color:#ddd;margin:10px 0;">' + escapeHtml(result.message) + '</p>';

    // M5: Step progress bar for multi-step
    if (result.isMultiStep && result.totalSteps) {
        var _done = result.stepCompleted || 0;
        if (!isStepSuccess && result.currentStep) _done = result.currentStep - 1;
        html += '<div style="margin:8px 0;">';
        html += '<div style="font-size:0.75rem;color:#aaa;margin-bottom:3px;">Progress: ' + _done + '/' + result.totalSteps + ' steps</div>';
        html += '<div style="background:rgba(0,0,0,0.3);border-radius:4px;height:8px;overflow:hidden;">';
        html += '<div style="height:100%;background:linear-gradient(90deg,#55a868,#4caf50);width:' + Math.round((_done / result.totalSteps) * 100) + '%;border-radius:4px;transition:width 0.3s;"></div></div>';
        if (result.nextStepLabel) {
            html += '<div style="font-size:0.72rem;color:#d4a843;margin-top:4px;">Next step: ' + escapeHtml(result.nextStepLabel) + '</div>';
        }
        html += '</div>';
    }

    // Cost summary
    html += '<div style="margin:12px 0;padding:8px;background:rgba(0,0,0,0.2);border-radius:6px;font-size:0.8rem;">';
    html += '<div style="color:#aaa;margin-bottom:4px;">📊 Action Summary:</div>';
    if (result.goldSpent > 0) html += '<div style="color:#e67e22;">💰 Gold spent: ' + result.goldSpent + 'g</div>';
    if (result.ticksSpent > 0) html += '<div style="color:#5dade2;">⏳ Time spent: ~' + result.ticksSpent + ' days</div>';
    html += '<div style="color:#aaa;">🎲 Success chance was: ' + (result.chance || '?') + '%</div>';
    if (result.attempt > 1) html += '<div style="color:#ccb974;">📝 Attempt #' + result.attempt + '</div>';
    html += '</div>';

    // Consequences for espionage/corrupt quests (failure or success)
    if (result.consequences && result.consequences.length > 0) {
        var _conBg = isSuccess ? 'rgba(52,152,219,0.15)' : 'rgba(196,78,82,0.15)';
        var _conBorder = isSuccess ? 'rgba(52,152,219,0.3)' : 'rgba(196,78,82,0.3)';
        var _conColor = isSuccess ? '#5dade2' : '#c44e52';
        html += '<div style="background:' + _conBg + ';border:1px solid ' + _conBorder + ';border-radius:6px;padding:8px;margin-top:8px;">';
        html += '<div style="font-size:0.8rem;color:' + _conColor + ';font-weight:bold;">' + (isSuccess ? '📋' : '⚠️') + ' Consequences:</div>';
        for (var _ci = 0; _ci < result.consequences.length; _ci++) {
            html += '<div style="font-size:0.78rem;color:#ddd;margin-top:3px;">' + escapeHtml(result.consequences[_ci]) + '</div>';
        }
        html += '</div>';
    }

    if (!isSuccess && !isStepSuccess) {
        var retryMsg = result.isMultiStep
            ? 'You can retry this step, but it will cost more gold and time.'
            : 'You can try again, but it will cost more gold and time. Improve your skills to increase your chances.';
        html += '<p style="font-size:0.8rem;color:#e67e22;font-style:italic;margin-top:8px;">' + retryMsg + '</p>';
    }

    html += '</div>';

    openModal(isSuccess ? '✅ Action Succeeded' : '❌ Action Failed', html,
        '<button class="btn-medieval" data-action="closeAndOpenNobilityDialog">Continue</button>'
    );
}

function _switchKQTab(tabId, kingdomId) {
    _kqTab = tabId;
    openNobilityDialog();
}

// Helper: Request kingdom building from nobility panel
function _nobilityRequestBuilding(townId) {
    // Show a simple selection of building types the kingdom might build
    var buildingTypes = [];
    if (typeof BUILDING_TYPES !== 'undefined') {
        for (var i in BUILDING_TYPES) {
            var bt = BUILDING_TYPES[i];
            if (bt.category !== 'military' && bt.cost && bt.cost <= 5000) {
                buildingTypes.push(bt);
            }
        }
    }
    var html = '<div style="font-size:0.8rem;color:#ccc;margin-bottom:8px;">Request the kingdom to construct a building in your lord town:</div>';
    html += '<div style="max-height:300px;overflow-y:auto;">';
    for (var i = 0; i < Math.min(15, buildingTypes.length); i++) {
        var bt = buildingTypes[i];
        html += '<button class="btn-medieval" data-action="requestKingdomBuilding" data-id="' + townId + '" data-val="' + bt.id + '" style="display:block;width:100%;text-align:left;font-size:0.75rem;padding:5px 10px;margin-bottom:3px;">' + (bt.icon || '🏗️') + ' ' + bt.name + ' (' + formatGold(bt.cost || 0) + ')</button>';
    }
    html += '</div>';
    openModal('🏗️ Request Kingdom Building', html, '<button class="btn-medieval" data-action="closeAndOpenNobilityDialog">Back</button>');
}

// Helper: Propose law from nobility panel
// v9p33river385: use Engine.getProposableLaws() instead of CONFIG.SPECIAL_LAWS
// so the IDs match what Engine.proposeLaw() expects.
function _nobilityProposeLaw(kingdomId) {
    var proposable = Engine.getProposableLaws ? Engine.getProposableLaws(kingdomId) : [];
    if (!proposable.length) { toast('No laws available to propose.', 'warning'); return; }
    var html = '<div style="font-size:0.8rem;color:#ccc;margin-bottom:8px;">Propose a new law for the kingdom (costs 1 political capital):</div>';
    html += '<div style="max-height:350px;overflow-y:auto;">';
    for (var i = 0; i < proposable.length; i++) {
        var law = proposable[i];
        var chanceColor = law.chance >= 60 ? '#8f8' : law.chance >= 30 ? '#ff8' : '#f88';
        var affordTag = (law.requiresGold > 0 && !law.canAfford) ? ' <span style="color:#f66;">(treasury too low)</span>' : '';
        html += '<button class="btn-medieval" data-action="proposeLawAction" data-id="' + kingdomId + '" data-val="' + law.id + '" style="display:block;width:100%;text-align:left;font-size:0.75rem;padding:6px 10px;margin-bottom:3px;">';
        html += '<span>' + (law.icon || '📜') + ' <strong>' + law.name + '</strong> <span style="color:' + chanceColor + ';font-size:0.65rem;">(' + law.chance + '% chance)</span>' + affordTag + '</span><br>';
        html += '<span style="font-size:0.7rem;color:#d4c9a0;">' + (law.description || '') + '</span>';
        html += '</button>';
    }
    html += '</div>';
    openModal('📜 Propose Law', html, '<button class="btn-medieval" data-action="closeAndOpenNobilityDialog">Back</button>');
}

// Helper: Propose action from nobility panel (Royal Advisor)
var _proposeActionTab = 'economic';
function _nobilityProposeAction(kingdomId) {
    if (!Player.getProposableActions) { toast('Feature not available.', 'warning'); return; }
    var actions = Player.getProposableActions(kingdomId);
    if (!actions || actions.length === 0) { toast('No actions available.', 'warning'); return; }

    var categories = [
        { id: 'economic', icon: '💰', name: 'Economic' },
        { id: 'military', icon: '⚔️', name: 'Military & Diplomacy' },
        { id: 'infrastructure', icon: '🏗️', name: 'Infrastructure' },
        { id: 'policy', icon: '📋', name: 'Policy & Laws' },
        { id: 'health', icon: '🏥', name: 'Health' },
        { id: 'kingdom', icon: '👑', name: 'Kingdom' }
    ];

    var html = '<div style="font-size:0.8rem;color:#ccc;margin-bottom:8px;">Propose an action to the king (costs 1 political capital). Success depends on king personality, treasury, and your influence.</div>';

    // Category tabs
    html += '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px;">';
    for (var ci = 0; ci < categories.length; ci++) {
        var cat = categories[ci];
        var catCount = actions.filter(function(a) { return a.category === cat.id; }).length;
        if (catCount === 0) continue;
        var isActive = _proposeActionTab === cat.id;
        html += '<button class="btn-medieval" data-action="_switchProposeActionTab" data-id="' + cat.id + '" data-val="' + kingdomId + '" style="font-size:0.7rem;padding:4px 8px;' + (isActive ? 'background:rgba(201,168,76,0.25);border-color:rgba(201,168,76,0.5);color:#f0d0a0;' : '') + '">' + cat.icon + ' ' + cat.name + ' (' + catCount + ')</button>';
    }
    html += '</div>';

    // Actions for current tab
    var tabActions = actions.filter(function(a) { return a.category === _proposeActionTab; });
    html += '<div style="max-height:350px;overflow-y:auto;">';
    if (tabActions.length === 0) {
        html += '<div style="font-size:0.78rem;color:#888;font-style:italic;">No actions in this category.</div>';
    }
    for (var ai = 0; ai < tabActions.length; ai++) {
        var a = tabActions[ai];
        var pct = Math.round(a.finalChance * 100);
        var pctColor = pct >= 60 ? '#2ecc71' : pct >= 35 ? '#e67e22' : '#e74c3c';
        var actionSafeId = a.id.replace(/[^a-zA-Z0-9_]/g, '_');

        html += '<div style="background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.08);border-radius:6px;padding:8px;margin-bottom:6px;">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">';
        html += '<span style="font-size:0.82rem;font-weight:bold;color:#f0d0a0;">' + a.icon + ' ' + a.name + '</span>';
        html += '<span style="font-size:0.85rem;font-weight:bold;color:' + pctColor + ';">' + pct + '%</span>';
        html += '</div>';
        html += '<div style="font-size:0.72rem;color:#bbb;margin-bottom:6px;">' + a.desc + '</div>';

        // Show modifiers breakdown
        if (a.displayMods && a.displayMods.length > 0) {
            html += '<div style="font-size:0.65rem;color:#999;margin-bottom:6px;">';
            for (var mi = 0; mi < a.displayMods.length; mi++) {
                var mod = a.displayMods[mi];
                var modSign = mod.val >= 0 ? '+' : '';
                var modColor = mod.val >= 0 ? '#55a868' : '#c44e52';
                html += '<span style="color:' + modColor + ';">' + modSign + Math.round(mod.val * 100) + '% ' + mod.name + '</span>';
                if (mi < a.displayMods.length - 1) html += ' · ';
            }
            html += '</div>';
        }

        // Sub-choice dropdown for actions that need a target
        if (a.needsSubChoice && a.subChoiceOptions && a.subChoiceOptions.length > 0) {
            var selectId = '_raSubChoice_' + actionSafeId;
            var subLabel = a.needsSubChoice === 'good' ? 'Select Good:' :
                           a.needsSubChoice === 'banned_good' ? 'Select Banned Good:' :
                           a.needsSubChoice === 'town' ? 'Select Town:' :
                           a.needsSubChoice === 'port_town' ? 'Select Port:' : 'Select:';
            html += '<div style="margin-bottom:6px;">';
            html += '<label style="font-size:0.72rem;color:#ccc;margin-right:6px;">' + subLabel + '</label>';
            html += '<select id="' + selectId + '" style="font-size:0.75rem;padding:3px 8px;background:rgba(40,35,25,0.9);color:#e8c080;border:1px solid rgba(180,150,80,0.4);border-radius:4px;max-width:200px;">';
            for (var si = 0; si < a.subChoiceOptions.length; si++) {
                var opt = a.subChoiceOptions[si];
                html += '<option value="' + opt.value + '">' + opt.label + '</option>';
            }
            html += '</select></div>';

            // Propose button that reads the dropdown value
            html += '<button class="btn-medieval" data-action="proposeKingActionSelect" data-selectid="' + selectId + '" data-kingdom="' + kingdomId + '" data-id="' + a.id + '" style="font-size:0.75rem;padding:5px 14px;background:rgba(44,100,60,0.5) !important;border:2px solid rgba(80,180,100,0.5) !important;color:#f0e0c0 !important;">👑 Propose (' + pct + '% chance)</button>';
        } else if (a.needsSubChoice && (!a.subChoiceOptions || a.subChoiceOptions.length === 0)) {
            // Action needs a sub-choice but no options available
            html += '<div style="font-size:0.72rem;color:#888;font-style:italic;margin-bottom:4px;">No valid targets available.</div>';
            html += '<button class="btn-medieval" disabled style="font-size:0.75rem;padding:5px 14px;opacity:0.4;">👑 No targets</button>';
        } else {
            // Normal action — no sub-choice needed
            html += '<button class="btn-medieval" data-action="proposeKingActionSimple" data-kingdom="' + kingdomId + '" data-id="' + a.id + '" style="font-size:0.75rem;padding:5px 14px;background:rgba(44,100,60,0.5) !important;border:2px solid rgba(80,180,100,0.5) !important;color:#f0e0c0 !important;">👑 Propose (' + pct + '% chance)</button>';
        }
        html += '</div>';
    }
    html += '</div>';

    openModal('👑 Propose Action to the King', html, '<button class="btn-medieval" data-action="closeAndOpenNobilityDialog">Back</button>');
}

function _switchProposeActionTab(tabId, kingdomId) {
    _proposeActionTab = tabId;
    _nobilityProposeAction(kingdomId);
}


    // ═══════════════════════════════════════════════════════════
    // §REVOLT-DEAL  Revolt Kingdom Player Deal System
    // ═══════════════════════════════════════════════════════════

    function checkRevoltDealOffer() {
        if (typeof Player === 'undefined' || !Player.state) return;
        var deal = Player.state._revoltDealOffer;
        if (!deal) return;
        var day = 0;
        try { day = Engine.getDay(); } catch(e) {}
        if (deal.expires && day > deal.expires) {
            delete Player.state._revoltDealOffer;
            return;
        }
        // Show deal notification once per session
        if (!deal._notified) {
            deal._notified = true;
            openRevoltDealDialog();
        }
    }

    function openRevoltDealDialog() {
        if (typeof Player === 'undefined' || !Player.state) return;
        var deal = Player.state._revoltDealOffer;
        if (!deal) { toast('No pending kingdom offers.', 'info'); return; }
        var day = 0;
        try { day = Engine.getDay(); } catch(e) {}
        if (deal.expires && day > deal.expires) {
            delete Player.state._revoltDealOffer;
            toast('The offer has expired.', 'warning');
            return;
        }

        var daysLeft = Math.max(0, (deal.expires || 0) - day);
        var html = '';
        html += '<div style="background:linear-gradient(135deg,rgba(196,78,82,0.15),rgba(201,168,76,0.1));border:1px solid rgba(201,168,76,0.4);border-radius:8px;padding:14px;margin-bottom:12px;">';
        html += '<div style="font-size:1.1rem;font-weight:bold;color:var(--gold);margin-bottom:8px;">📜 A Message from ' + escapeHtml(deal.kingdomName) + '</div>';

        if (deal.playerHelped) {
            html += '<p style="color:#ddd;font-size:0.88rem;margin-bottom:10px;">';
            html += '"Your valor in our revolution has not gone unnoticed. The people of <strong>' + escapeHtml(deal.townName) + '</strong> ';
            html += 'owe their freedom to brave souls like yourself. We offer you a place of honor in our new kingdom."';
            html += '</p>';
        } else {
            html += '<p style="color:#ddd;font-size:0.88rem;margin-bottom:10px;">';
            html += '"The Kingdom of <strong>' + escapeHtml(deal.kingdomName) + '</strong> is newly born and seeks talented individuals. ';
            html += 'We offer you status and wealth in exchange for your allegiance."';
            html += '</p>';
        }

        html += '<div style="background:rgba(0,0,0,0.3);border-radius:6px;padding:10px;margin-bottom:10px;">';
        html += '<div style="font-size:0.9rem;font-weight:bold;color:#f0d0a0;margin-bottom:6px;">The Offer:</div>';
        html += '<div style="font-size:0.85rem;color:#ccc;margin-bottom:4px;">👑 <strong>' + escapeHtml(deal.offeredRankName) + '</strong> status in ' + escapeHtml(deal.kingdomName) + '</div>';
        html += '<div style="font-size:0.85rem;color:#ccc;margin-bottom:4px;">💰 <strong>' + deal.offeredGold + ' gold</strong> signing bonus</div>';
        if (deal.offeredBuildings && deal.offeredBuildings.length > 0) {
            html += '<div style="font-size:0.85rem;color:#ccc;margin-bottom:4px;">🏗️ <strong>' + deal.offeredBuildings.length + ' building' + (deal.offeredBuildings.length > 1 ? 's' : '') + '</strong> in ' + escapeHtml(deal.townName) + ':';
            for (var bi = 0; bi < deal.offeredBuildings.length; bi++) {
                html += ' ' + escapeHtml(deal.offeredBuildings[bi].name);
                if (bi < deal.offeredBuildings.length - 1) html += ',';
            }
            html += '</div>';
        }
        html += '</div>';

        html += '<div style="font-size:0.75rem;color:#888;margin-bottom:10px;">⏳ This offer expires in ' + daysLeft + ' day' + (daysLeft !== 1 ? 's' : '') + '.</div>';

        html += '<div style="display:flex;gap:8px;justify-content:center;">';
        html += '<button class="btn-medieval" data-action="acceptRevoltDeal" style="padding:8px 20px;background:rgba(46,204,113,0.3);border-color:rgba(46,204,113,0.6);">✅ Accept Offer</button>';
        html += '<button class="btn-medieval" data-action="declineRevoltDeal" style="padding:8px 20px;background:rgba(196,78,82,0.3);border-color:rgba(196,78,82,0.6);">❌ Decline</button>';
        html += '</div>';
        html += '</div>';

        openModal('📜 Kingdom Offer — ' + escapeHtml(deal.kingdomName), html);
    }

    UI.registerAction('acceptRevoltDeal', function() {
        if (typeof Player === 'undefined' || !Player.state) return;
        var deal = Player.state._revoltDealOffer;
        if (!deal) { toast('No pending offer.', 'warning'); UI.closeModal(); return; }

        var ps = Player.state;
        // Grant rank
        if (!ps.socialRank) ps.socialRank = {};
        ps.socialRank[deal.kingdomId] = deal.offeredRank;
        if (deal.offeredRank >= 4) {
            ps.isNoble = true;
        }

        // Grant gold
        ps.gold = (ps.gold || 0) + deal.offeredGold;

        // Transfer buildings
        if (deal.offeredBuildings && deal.offeredBuildings.length > 0) {
            try {
                var town = Engine.findTown(deal.townId);
                if (town && town.buildings) {
                    for (var bi = 0; bi < deal.offeredBuildings.length; bi++) {
                        var bIdx = deal.offeredBuildings[bi].index;
                        if (town.buildings[bIdx]) {
                            town.buildings[bIdx].ownerId = 'player';
                        }
                    }
                }
            } catch(e) {}
        }

        // Set citizenship
        ps.citizenshipKingdomId = deal.kingdomId;

        // Set reputation
        if (!ps.reputation) ps.reputation = {};
        ps.reputation[deal.kingdomId] = Math.max(ps.reputation[deal.kingdomId] || 0, 60);

        // Clean up
        delete ps._revoltDealOffer;
        delete ps._helpedRevolt;

        // Log and notify
        if (typeof Engine !== 'undefined' && Engine.logEvent) {
            Engine.logEvent('📜 You accepted the offer from ' + deal.kingdomName + '! ' + deal.offeredRankName + ' status, ' + deal.offeredGold + 'g, and ' + (deal.offeredBuildings ? deal.offeredBuildings.length : 0) + ' building(s) received.', null, 'my_actions');
        }
        toast('✅ You are now a ' + deal.offeredRankName + ' of ' + deal.kingdomName + '! +' + deal.offeredGold + 'g', 'success');

        if (typeof Player !== 'undefined' && Player.recordJournalEntry) {
            // v9p33river300: was Player.addJournalEntry (nonexistent).
            Player.recordJournalEntry('politics', 'Accepted an offer from ' + deal.kingdomName + '. Granted ' + deal.offeredRankName + ' status and ' + deal.offeredGold + ' gold.', { mood: 'pleased' });
        }

        UI.closeModal();
    });

    UI.registerAction('declineRevoltDeal', function() {
        if (typeof Player === 'undefined' || !Player.state) return;
        delete Player.state._revoltDealOffer;
        toast('You declined the offer.', 'info');
        UI.closeModal();
    });

    // Conspiracy participation actions
    UI.registerAction('playerJoinConspiracy', function(el) {
        var kId = el.getAttribute('data-id');
        if (!kId || typeof Engine === 'undefined') return;
        var result = Engine.playerJoinConspiracy(kId);
        if (result.success) {
            toast(result.message, 'success');
        } else {
            toast(result.message, 'warning');
        }
        openNobilityDialog(); // refresh
    });

    UI.registerAction('playerLeaveConspiracy', function(el) {
        var kId = el.getAttribute('data-id');
        if (!kId || typeof Engine === 'undefined') return;
        var result = Engine.playerLeaveConspiracy(kId);
        if (result.success) {
            toast(result.message, 'info');
        } else {
            toast(result.message, 'warning');
        }
        openNobilityDialog(); // refresh
    });

    UI.registerAction('playerFormConspiracy', function(el) {
        var kId = el.getAttribute('data-id');
        if (!kId || typeof Engine === 'undefined') return;
        var targetSel = document.getElementById('conspiracy_target');
        var typeSel = document.getElementById('conspiracy_type');
        if (!targetSel || !typeSel) { toast('Select a target noble and plot type.', 'warning'); return; }
        var result = Engine.playerFormConspiracy(kId, targetSel.value, typeSel.value);
        if (result.success) {
            toast(result.message, 'success');
        } else {
            toast(result.message, 'warning');
        }
        openNobilityDialog(); // refresh
    });

    // Revolt support actions
    UI.registerAction('playerSupportRevolt', function(el) {
        var townId = el.getAttribute('data-id');
        var idx = el.getAttribute('data-idx');
        if (!townId || typeof Engine === 'undefined') return;
        // v9p33river323: data-idx was sometimes "proactive_N" (prefixed)
        // and sometimes a plain index. The input element is always
        // "revolt_proactive_N", so concatenating "revolt_proactive_" +
        // "proactive_N" produced a non-existent id and the typed gold
        // amount was silently ignored (fell back to 100g default).
        // Normalize by stripping any leading "proactive_" before lookup.
        var _normIdx = (idx || '').replace(/^proactive_/, '');
        var goldInput = document.getElementById('revolt_gold_' + _normIdx) ||
                        document.getElementById('revolt_proactive_' + _normIdx) ||
                        // Legacy fallback for any handler still passing raw idx
                        document.getElementById('revolt_proactive_' + idx);
        var goldAmount = goldInput ? parseInt(goldInput.value) || 100 : 100;
        var result = Engine.playerSupportRevolt(townId, goldAmount);
        if (result.success) {
            toast(result.message, 'success');
        } else {
            toast(result.message, 'warning');
        }
        openNobilityDialog();
    });

    UI.registerAction('playerDeclineRevolt', function(el) {
        var townId = el.getAttribute('data-id');
        if (!townId || typeof Engine === 'undefined') return;
        var result = Engine.playerDeclineRevoltSupport(townId);
        if (result.success) {
            toast('You declined the revolt support request.', 'info');
        }
        openNobilityDialog();
    });

    // Register on UI namespace
    // -- Street Trading --
    UI.openStreetTrading = openStreetTrading;
    UI.openStreetTradingDialog = openStreetTrading;
    UI.executeStreetTrade = executeStreetTradeUI;
    UI.executeStreetBuyUI = executeStreetBuyUI;
    UI.executeStreetContrabandSellUI = executeStreetContrabandSellUI;
    UI._streetSubmitRequest = _streetSubmitRequest;
    UI._streetAcceptOffer = _streetAcceptOffer;
    UI._streetDeclineOffer = _streetDeclineOffer;
    UI._streetUpdateChancePreview = _streetUpdateChancePreview;
    UI.chatWithNPC = chatWithNPC;
    // -- Dark Deeds: Schemes helpers --
    UI.switchSchemesTab = switchSchemesTab;
    UI.getDetectionColor = getDetectionColor;
    // -- Nobility --
    UI.openNobilityDialog = openNobilityDialog;
    UI._nobilityRequestBuilding = _nobilityRequestBuilding;
    UI._nobilityProposeLaw = _nobilityProposeLaw;
    UI._nobilityProposeAction = _nobilityProposeAction;
    UI._switchProposeActionTab = _switchProposeActionTab;
    // -- Noble Agents --
    UI.toggleAgentExpand = toggleAgentExpand;
    UI.hireAgentAction = hireAgentAction;
    UI.fireAgentAction = fireAgentAction;
    UI.cancelAgentTaskAction = cancelAgentTaskAction;
    UI.recallAgentAction = recallAgentAction;
    UI.showAgentTaskCategory = showAgentTaskCategory;
    UI.onAgentBizTaskChange = onAgentBizTaskChange;
    UI.assignHostileTask = assignHostileTask;
    UI.assignBusinessTask = assignBusinessTask;
    UI.assignIntelTask = assignIntelTask;
    UI.assignDiplomaticTask = assignDiplomaticTask;
    // -- Revolt Deal --
    UI.openRevoltDealDialog = openRevoltDealDialog;
    UI.checkRevoltDealOffer = checkRevoltDealOffer;
    // -- Kingdom Quests --
    UI._buildRoyalDirectivesSection = _buildRoyalDirectivesSection;
    UI._switchKQTab = _switchKQTab;
    UI._attemptKQActionUI = _attemptKQActionUI;
    UI._executeKQAction = _executeKQAction;

    // ── Register data-action handlers ──
    UI.registerAction('executeStreetTrade', function(_t, d) { UI.executeStreetTrade(parseInt(d.idx)); });
    UI.registerAction('executeStreetBuyUI', function(_t, d) { UI.executeStreetBuyUI(parseInt(d.idx)); });
    UI.registerAction('executeStreetContrabandSellUI', function(_t, d) {
        UI.executeStreetContrabandSellUI(parseInt(d.idx), parseInt(d.qty));
    });
    UI.registerAction('_streetAcceptOffer', function() { UI._streetAcceptOffer(); });
    UI.registerAction('_streetDeclineOffer', function() { UI._streetDeclineOffer(); });
    UI.registerAction('_streetSubmitRequest', function() { UI._streetSubmitRequest(); });
    UI.registerAction('chatWithNPC', function(_t, d) { if (d.id) UI.chatWithNPC(d.id); });
    UI.registerAction('closeModal', function() { UI.closeModal(); });
    UI.registerAction('hireAgentAction', function() { UI.hireAgentAction(); });
    UI.registerAction('toggleAgentExpand', function(_t, d) { if (d.id) UI.toggleAgentExpand(d.id); });
    UI.registerAction('showAgentTaskCategory', function(_t, d) { if (d.id && d.val) UI.showAgentTaskCategory(d.id, d.val); });
    UI.registerAction('cancelAgentTaskAction', function(_t, d) { if (d.id) UI.cancelAgentTaskAction(d.id); });
    UI.registerAction('recallAgentAction', function(_t, d) { if (d.id) UI.recallAgentAction(d.id); });
    UI.registerAction('fireAgentAction', function(_t, d) { if (d.id) UI.fireAgentAction(d.id); });
    UI.registerAction('assignHostileTask', function(_t, d) { if (d.id) UI.assignHostileTask(d.id); });
    UI.registerAction('assignBusinessTask', function(_t, d) { if (d.id) UI.assignBusinessTask(d.id); });
    UI.registerAction('assignIntelTask', function(_t, d) { if (d.id) UI.assignIntelTask(d.id); });
    UI.registerAction('assignDiplomaticTask', function(_t, d) { if (d.id) UI.assignDiplomaticTask(d.id); });
    UI.registerAction('_switchProposeActionTab', function(_t, d) { if (d.id && d.val) UI._switchProposeActionTab(d.id, d.val); });
    UI.registerAction('_nobilityRequestBuilding', function(_t, d) { if (d.id) UI._nobilityRequestBuilding(d.id); });
    UI.registerAction('_nobilityProposeLaw', function(_t, d) { if (d.id) UI._nobilityProposeLaw(d.id); });
    UI.registerAction('_nobilityProposeAction', function(_t, d) { if (d.id) UI._nobilityProposeAction(d.id); });
    UI.registerAction('switchNobilityTab', function(_t, d) {
        _nobilityTab = d.id || 'status';
        openNobilityDialog();
    });
    UI.registerAction('executeNobilityIntrigue', function(_t, d) {
        var schemeId = d.id || '';
        var nobleAId = '';
        var nobleBId = '';
        try {
            var _selA = document.getElementById('nob_intA_' + d.idx);
            if (_selA) nobleAId = _selA.value;
            var _selB = document.getElementById('nob_intB_' + d.idx);
            if (_selB) nobleBId = _selB.value;
        } catch(e) {}
        var result = Player.executeCorruptAction(schemeId, [nobleAId, nobleBId]);
        if (result && result.success) {
            UI.toast(result.message, 'success');
        } else if (result && result.caught) {
            UI.toast(result.message, 'danger');
        } else {
            UI.toast(result ? result.message : 'Failed.', 'warning');
        }
        _nobilityTab = 'intrigue';
        openNobilityDialog();
    });
    UI.registerAction('openFeastDialog', function(_t, d) { if (d.id) UI.openFeastDialog(d.id); });
    UI.registerAction('openVotingDialog', function(_t, d) { if (d.id) UI.openVotingDialog(d.id); });

    // ── Noble Influence Actions ──
    UI.registerAction('nobleFlatterKing', function() {
        var result = Player.nobleFlatterKing();
        if (result && result.success) {
            UI.toast(result.message, 'success');
            if (typeof StoryMode !== 'undefined' && StoryMode.onPlayerAction) {
                StoryMode.onPlayerAction('attend_court', { kingdomId: Player.citizenshipKingdomId });
            }
        } else {
            UI.toast(result ? result.message : 'Failed.', 'warning');
        }
        _nobilityTab = 'influence';
        openNobilityDialog();
    });
    UI.registerAction('nobleWhisperAgainst', function() {
        var sel = document.getElementById('whisperTarget');
        var targetId = sel ? sel.value : '';
        if (!targetId) { UI.toast('Select a noble to whisper against.', 'warning'); return; }
        var result = Player.nobleWhisperAgainst(targetId);
        if (result && result.success) {
            UI.toast(result.message, 'success');
            if (typeof StoryMode !== 'undefined' && StoryMode.onPlayerAction) {
                StoryMode.onPlayerAction('attend_court', { kingdomId: Player.citizenshipKingdomId });
            }
        } else {
            UI.toast(result ? result.message : 'Failed.', result && result.success === false && result.message && result.message.indexOf('caught') >= 0 ? 'danger' : 'warning');
        }
        _nobilityTab = 'influence';
        openNobilityDialog();
    });
    UI.registerAction('nobleBoostAlly', function() {
        var sel = document.getElementById('boostTarget');
        var targetId = sel ? sel.value : '';
        if (!targetId) { UI.toast('Select a noble to vouch for.', 'warning'); return; }
        var result = Player.nobleBoostAlly(targetId);
        if (result && result.success) {
            UI.toast(result.message, 'success');
            if (typeof StoryMode !== 'undefined' && StoryMode.onPlayerAction) {
                StoryMode.onPlayerAction('attend_court', { kingdomId: Player.citizenshipKingdomId });
            }
        } else {
            UI.toast(result ? result.message : 'Failed.', 'warning');
        }
        _nobilityTab = 'influence';
        openNobilityDialog();
    });
    UI.registerAction('acceptFeastInvite', function(_t, d) {
        var idx = parseInt(d.id, 10);
        var result = Player.nobleAcceptFeastInvite(idx);
        if (result && result.success) {
            UI.toast(result.message, 'success');
        } else {
            UI.toast(result ? result.message : 'Failed.', 'warning');
        }
        _nobilityTab = 'influence';
        openNobilityDialog();
    });
    UI.registerAction('declineFeastInvite', function(_t, d) {
        var idx = parseInt(d.id, 10);
        var result = Player.nobleDeclineFeastInvite(idx);
        if (result && result.success) {
            UI.toast(result.message, 'info');
        } else {
            UI.toast(result ? result.message : 'Failed.', 'warning');
        }
        _nobilityTab = 'influence';
        openNobilityDialog();
    });
    UI.registerAction('doCourtAction', function(_t, d) {
        var kId = d.kingdomId || Player.citizenshipKingdomId;
        if (!kId) { UI.toast('No kingdom.', 'warning'); return; }
        // Intercept petition_king to show selection UI
        if (d.id === 'petition_king') {
            _openCourtPetitionModal(kId);
            return;
        }
        var result = Engine.doCourtAction(kId, d.id);
        if (result && result.success) {
            UI.toast(result.message, 'success');
            if (typeof StoryMode !== 'undefined' && StoryMode.onPlayerAction) {
                StoryMode.onPlayerAction('attend_court', { kingdomId: kId });
            }
        } else {
            UI.toast(result ? result.message : 'Failed.', 'warning');
        }
        _nobilityTab = 'influence';
        openNobilityDialog();
    });
    UI.registerAction('_switchKQTab', function(_t, d) { UI._switchKQTab(d.tab, d.kingdom); });
    UI.registerAction('_attemptKQActionUI', function(_t, d) { if (d.id && d.kingdom) UI._attemptKQActionUI(d.id, d.kingdom); });

    // Court petition modal: select a petition type and present it directly to the king
    function _openCourtPetitionModal(kingdomId) {
        var PTYPES = typeof PETITION_TYPES !== 'undefined' ? PETITION_TYPES : [];
        var kingdoms = Engine.getKingdoms ? Engine.getKingdoms() : [];

        var html = '<div style="padding:10px;max-height:400px;overflow-y:auto;">';
        html += '<p style="color:#ccc;font-size:0.85rem;margin:0 0 12px 0;">Present a petition directly to the king during court. No signatures needed, but success depends on the petition cost, king\'s personality, your reputation, and your relationships.</p>';
        if (PTYPES.length === 0) {
            html += '<p style="color:#e74c3c;">No petition types available.</p>';
        } else {
            for (var a = 0; a < PTYPES.length; a++) {
                var pt = PTYPES[a];
                // Skip petitions needing complex targets (town, road, etc.) — those need the full petition system
                if (pt.requiresTarget && pt.targetType !== 'kingdom') continue;
                var costLabel = pt.costFactor > 0 ? ' <span style="color:#8b0000;font-size:0.72rem;">(costly − harder to pass)</span>' : '';
                if (!pt.requiresTarget) {
                    // Simple petition — direct submit
                    html += '<button class="btn-medieval" data-action="submitCourtPetition" data-pettype="' + pt.id + '" data-kingdom="' + kingdomId + '" ';
                    html += 'style="width:100%;text-align:left;padding:8px 12px;margin-bottom:5px;color:#1a1a2e;background:linear-gradient(135deg,#c9a84c,#e8c76a);border:1px solid #a08030;font-size:0.88rem;">';
                    html += pt.icon + ' <b>' + pt.name + '</b>' + costLabel;
                    html += '<br><span style="color:#3a2a10;font-size:0.75rem;">' + pt.desc + '</span>';
                    html += '</button>';
                } else if (pt.targetType === 'kingdom') {
                    // Kingdom-target petition — show dropdown for target selection
                    var targetKingdoms = kingdoms.filter(function(k) { return k.id !== kingdomId && !k.defeated; });
                    if (pt.id === 'seek_peace') {
                        var playerK = Engine.findKingdom(kingdomId);
                        targetKingdoms = targetKingdoms.filter(function(k) { return playerK && playerK.atWar && playerK.atWar.has(k.id); });
                    } else if (pt.id === 'declare_war') {
                        var playerK2 = Engine.findKingdom(kingdomId);
                        targetKingdoms = targetKingdoms.filter(function(k) { return !playerK2 || !playerK2.atWar || !playerK2.atWar.has(k.id); });
                    }
                    if (targetKingdoms.length > 0) {
                        html += '<div style="background:rgba(201,168,76,0.08);border:1px solid rgba(201,168,76,0.2);border-radius:6px;padding:8px;margin-bottom:5px;">';
                        html += '<div style="font-size:0.88rem;color:#e8c76a;margin-bottom:6px;">' + pt.icon + ' <b>' + pt.name + '</b>' + costLabel + '</div>';
                        html += '<div style="color:#3a2a10;font-size:0.75rem;margin-bottom:6px;">' + pt.desc + '</div>';
                        for (var tk = 0; tk < targetKingdoms.length; tk++) {
                            html += '<button class="btn-medieval" data-action="submitCourtPetition" data-pettype="' + pt.id + '" data-kingdom="' + kingdomId + '" data-target="' + targetKingdoms[tk].id + '" ';
                            html += 'style="width:100%;text-align:left;padding:6px 12px;margin-bottom:3px;color:#1a1a2e;background:linear-gradient(135deg,#b8944c,#d4b05a);border:1px solid #906020;font-size:0.82rem;">';
                            html += '🏰 ' + targetKingdoms[tk].name;
                            html += '</button>';
                        }
                        html += '</div>';
                    }
                }
            }
        }
        html += '</div>';
        openModal('📜 Present a Petition at Court', html, '<button class="btn-medieval" onclick="closeModal()">Cancel</button>');
    }

    UI.registerAction('submitCourtPetition', function(_t, d) {
        var kId = d.kingdom || Player.citizenshipKingdomId;
        if (!kId) { UI.toast('No kingdom.', 'warning'); return; }
        var petId = d.pettype;
        if (!petId) { UI.toast('No petition type selected.', 'warning'); return; }
        var extraData = { petitionTypeId: petId };
        if (d.target) extraData.targetKingdomId = d.target;
        var result = Engine.doCourtAction(kId, 'petition_king', extraData);
        if (result && result.success) {
            UI.toast(result.message, result.message.indexOf('GRANTED') >= 0 ? 'success' : 'info');
            if (typeof StoryMode !== 'undefined' && StoryMode.onPlayerAction) {
                StoryMode.onPlayerAction('attend_court', { kingdomId: kId });
            }
        } else {
            UI.toast(result ? result.message : 'Failed.', 'warning');
        }
        if (typeof closeModal === 'function') closeModal();
        _nobilityTab = 'influence';
        openNobilityDialog();
    });

    UI.registerAction('attemptCaptureCriminalUI', function(_t, d) {
        var r = Player.attemptCaptureCriminal ? Player.attemptCaptureCriminal(d.id) : { success: false, message: 'Capture not available.' };
        UI.toast(r.message, r.success ? 'success' : 'warning');
        UI.openStreetTrading();
    });

    // Complex IIFE handlers
    UI.registerAction('deliverKingCommissionAction', function() {
        var r = Player.deliverKingCommission ? Player.deliverKingCommission() : {success:false, message:'Delivery not available.'};
        UI.toast(r.message || 'Delivered!', r.success ? 'success' : 'warning');
        UI.openNobilityDialog();
    });
    UI.registerAction('acceptKingCommissionAction', function() {
        var r = Player.acceptKingCommission ? Player.acceptKingCommission() : {success:false};
        UI.toast(r.message || 'Commission accepted!', r.success ? 'success' : 'warning');
        UI.openNobilityDialog();
    });
    UI.registerAction('refuseKingCommissionAction', function(_t, d) {
        if (d.lord === 'true' && !confirm('\u26a0\ufe0f As a Lord, refusing a royal commission will trigger demotion! Are you sure?')) return;
        var r = Player.refuseKingCommission ? Player.refuseKingCommission() : {success:false};
        UI.toast(r.message || 'Commission refused.', r.success ? 'success' : 'warning');
        UI.openNobilityDialog();
    });
    UI.registerAction('respondToKingDecisionAgree', function(_t, d) {
        var r = Player.respondToKingDecision(d.id, 'agree');
        UI.toast(r && r.message ? r.message : 'Agreed.', 'success');
        UI.openNobilityDialog();
    });
    UI.registerAction('respondToKingDecisionOppose', function(_t, d) {
        var r = Player.respondToKingDecision(d.id, 'oppose');
        UI.toast(r && r.message ? r.message : 'Opposed.', r && r.success ? 'success' : 'warning');
        UI.openNobilityDialog();
    });
    UI.registerAction('adviseKingAction', function(_t, d) {
        var r = Player.adviseKing(d.id, d.val);
        UI.toast(r && (r.message || r.reason) ? r.message || r.reason : 'Advice given.', r && r.success ? 'success' : 'warning');
        UI.openNobilityDialog();
    });
    UI.registerAction('closeAndShowPerson', function(_t, d) {
        UI.closeModal();
        var p = Engine.findPerson(d.id);
        if (p) UI.showPersonDetail(p);
    });
    UI.registerAction('interactNPCSmallTalk', function(_t, d) {
        var r = Player.interactWithNPC(d.id, 'small_talk');
        UI.toast(r && r.message || 'Spoke with noble.', r && r.success ? 'success' : 'warning');
        UI.openNobilityDialog();
    });
    UI.registerAction('closeAndGift', function(_t, d) {
        UI.closeModal(); UI.openGiftDialog(d.id);
    });
    UI.registerAction('closeAndSchemes', function(_t, d) {
        UI.closeModal(); UI.openSchemesDialog(d.id);
    });
    UI.registerAction('acceptKingdomQuestAction', function(_t, d) {
        var r = Player.acceptKingdomQuest(d.id, d.kingdom);
        UI.toast(r && r.message || 'Quest updated', r && r.success ? 'success' : 'warning');
        if (r && r.success) UI.openNobilityDialog();
    });
    UI.registerAction('rejectKingdomQuestAction', function(_t, d) {
        var r = Player.rejectKingdomQuest(d.id, d.kingdom);
        UI.toast(r && r.message || 'Quest updated', r && r.success ? 'success' : 'warning');
        UI.openNobilityDialog();
    });
    UI.registerAction('completeKingdomQuestAction', function(_t, d) {
        var r = Player.completeKingdomQuest(d.id, d.kingdom);
        UI.toast(r && r.message || 'Quest completed!', r && r.success ? 'success' : 'warning');
        if (r && r.success) UI.openNobilityDialog();
    });
    UI.registerAction('abandonKingdomQuestAction', function(_t, d) {
        if (!confirm('Abandon this quest? You may lose reputation and face penalties.')) return;
        var r = Player.abandonKingdomQuest ? Player.abandonKingdomQuest(d.id, d.kingdom) : null;
        UI.toast(r && r.message || 'Quest abandoned.', r && r.success ? 'success' : 'warning');
        UI.openNobilityDialog();
    });
    UI.registerAction('requestKingdomBuilding', function(_t, d) {
        var r = Player.requestKingdomBuilding(d.id, d.val, 0);
        UI.toast(r && r.message ? r.message : 'Request sent.', r && r.success ? 'success' : 'warning');
        UI.openNobilityDialog();
    });
    UI.registerAction('proposeLawAction', function(_t, d) {
        var r = Player.proposeLaw(d.id, d.val);
        UI.toast(r && (r.reason || r.message) ? (r.reason || r.message) : 'Law proposed.', r && r.success ? 'success' : 'warning');
        UI.openNobilityDialog();
    });
    UI.registerAction('proposeKingActionSelect', function(_t, d) {
        var sel = document.getElementById(d.selectid);
        var sc = sel ? sel.value : '';
        if (!sc) { UI.toast('Select a target first.', 'warning'); return; }
        var r = Player.proposeKingAction(d.kingdom, d.id, sc);
        UI.toast(r && r.message ? r.message : 'Action proposed.', r && r.success ? 'success' : 'warning');
        UI.openNobilityDialog();
    });
    UI.registerAction('proposeKingActionSimple', function(_t, d) {
        var r = Player.proposeKingAction(d.kingdom, d.id);
        UI.toast(r && r.message ? r.message : 'Action proposed.', r && r.success ? 'success' : 'warning');
        UI.openNobilityDialog();
    });
    UI.registerAction('closeAndExecuteKQAction', function(_t, d) {
        UI.closeModal(); UI._executeKQAction(d.id, d.kingdom);
    });
    UI.registerAction('closeAndOpenNobilityDialog', function() {
        UI.closeModal(); UI.openNobilityDialog();
    });
})(window.UI);
