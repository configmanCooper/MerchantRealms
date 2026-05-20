// ========================================================
// engine_kingdom_finances.js
// Kingdom Finances & Bankruptcy, Economic Collapse System
// Extracted from engine.js sections §19F, §19F2
// ========================================================
(function(Engine) {
    "use strict";
    if (!Engine) throw new Error("Engine must be loaded before engine_kingdom_finances.js");

    // ── Internal state ──
    var world;
    var _tickCache;
    function _syncState() {
        world = Engine.getWorld();
        _tickCache = Engine._getTickCache ? Engine._getTickCache() : {};
    }

    // ── Already-exported Engine utilities ──
    var logEvent = function(msg, details, category) { Engine.logEvent(msg, details, category); };
    var findTown = function(id) { return Engine.findTown(id); };
    var findKingdom = function(id) { return Engine.findKingdom(id); };
    var findPerson = function(id) { return Engine.findPerson(id); };
    var findBuildingType = function(id) { return Engine.findBuildingType(id); };
    var getPeopleInTown = function(id) { return Engine.getPeopleInTown(id); };
    var getPeopleInKingdom = function(id) { return Engine.getPeopleInKingdom(id); };
    var hasSpecialLaw = function(k, lawId) { return Engine.hasSpecialLaw(k, lawId); };
    var dischargeSoldier = function(s, town) { return Engine.dischargeSoldier(s, town); };
    var kingdomBuild = function(kingdom, town, buildingTypeId, rng) { return Engine.kingdomBuild(kingdom, town, buildingTypeId, rng); };
    var computeMilitaryStrength = function(k) { return Engine.computeMilitaryStrength(k); };
    var _storeBackgroundGossip = function(type, msg, meta) { if (Engine.storeBackgroundGossip) Engine.storeBackgroundGossip(type, msg, meta); };

    // ── Functions that MUST be newly exported from engine.js ──
    var boostKingdomHappiness = function(k, amount) { return Engine.boostKingdomHappiness(k, amount); };
    var handleKingDeath = function(k, cause) { return Engine.handleKingDeath(k, cause); };
    var logKingAction = function(k, message) { return Engine.logKingAction(k, message); };

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

    // ========================================================
    // §19F  KINGDOM FINANCES & BANKRUPTCY
    // ========================================================

    // ---- Kingdom Financial Ledger ----
    // Records every income/expense transaction for reporting
    var LEDGER_MAX = 500;
    function recordKingdomTransaction(k, type, amount, description, category) {
        if (!k || !amount) return;
        if (!k._financialLedger) k._financialLedger = [];
        k._financialLedger.push({
            day: world ? world.day : 0,
            type: type,           // 'income' or 'expense'
            amount: Math.abs(amount),
            category: category || 'other', // trade_tax, property_tax, income_tax, transport, stockpile_sale, soldier_upkeep, building_upkeep, employee_wages, procurement, war, construction, coronation, other
            desc: description || ''
        });
        // Cap ledger size
        if (k._financialLedger.length > LEDGER_MAX) {
            k._financialLedger = k._financialLedger.slice(-LEDGER_MAX);
        }
    }

    function getKingdomLedger(k, days) {
        if (!k || !k._financialLedger) return [];
        if (!days) return k._financialLedger;
        var cutoff = (world ? world.day : 0) - days;
        return k._financialLedger.filter(function(e) { return e.day >= cutoff; });
    }

    function getKingdomLedgerSummary(k, days) {
        var entries = getKingdomLedger(k, days);
        var income = {}, expenses = {}, totalIncome = 0, totalExpenses = 0;
        for (var i = 0; i < entries.length; i++) {
            var e = entries[i];
            if (e.type === 'income') {
                income[e.category] = (income[e.category] || 0) + e.amount;
                totalIncome += e.amount;
            } else {
                expenses[e.category] = (expenses[e.category] || 0) + e.amount;
                totalExpenses += e.amount;
            }
        }
        return { income: income, expenses: expenses, totalIncome: totalIncome, totalExpenses: totalExpenses, net: totalIncome - totalExpenses, entries: entries.length };
    }

    // ---- Trade Tax Collection (called from market transactions) ----
    // v9p33river313: optional 4th `isImport` param. When false (export
    // transaction), trade subsidies do NOT fire — subsidies are designed
    // to reward importing scarce goods, not paying merchants twice for
    // exporting them. Defaults to true so legacy callers behave as before.
    // Optional 5th `townId` param lets us apply per-town GUILD_HALL
    // tradeBonus (config.js:1991, dead before — no consumer was reading
    // bt.tradeBonus). With townId present, kingdom-level tax is boosted
    // by the summed tradeBonus of civic buildings in that town.
    // v9p33river338: now RETURNS { taxCollected, subsidyAwarded } so
    // callers can credit the subsidy to the merchant/player. Previously
    // the subsidy was deducted from kingdom gold but never paid to
    // anyone — it was effectively burned. Callers that ignore the
    // return value still get correct tax collection.
    function collectTradeTax(kingdomId, amount, goodId, isImport, townId) {
        if (!world || !kingdomId || amount <= 0) return { taxCollected: 0, subsidyAwarded: 0 };
        const k = findKingdom(kingdomId);
        if (!k) return { taxCollected: 0, subsidyAwarded: 0 };

        // Skip tax collection during tax revolt
        if (k._taxRevoltUntil && world.day < k._taxRevoltUntil) return { taxCollected: 0, subsidyAwarded: 0 };

        // Check export restrictions
        if (goodId && k.exportRestrictions && k.exportRestrictions.includes(goodId)) {
            // Block or penalize export — reduce amount by 50% as penalty
            amount = Math.floor(amount * 0.5);
        }

        let taxAmount = Math.floor(amount * (k.taxRate || 0.10));
        // Per-town tradeBonus boost (e.g. GUILD_HALL.tradeBonus 0.15)
        if (townId) {
            const _town = findTown(townId);
            if (_town && _town.buildings) {
                let _tbBonus = 0;
                for (let _tbi = 0; _tbi < _town.buildings.length; _tbi++) {
                    const _tb = _town.buildings[_tbi];
                    if (_tb.condition === 'destroyed') continue;
                    const _tbt = findBuildingType(_tb.type);
                    if (_tbt && _tbt.tradeBonus) _tbBonus += _tbt.tradeBonus;
                }
                if (_tbBonus > 0) taxAmount = Math.floor(taxAmount * (1 + Math.min(0.5, _tbBonus)));
            }
        }
        if (taxAmount > 0) {
            k.gold += taxAmount;
            k.tradeTaxRevenue = (k.tradeTaxRevenue || 0) + taxAmount;
            k.taxRevenue = (k.taxRevenue || 0) + taxAmount;
            recordKingdomTransaction(k, 'income', taxAmount, 'Trade tax' + (goodId ? ' (' + goodId + ')' : ''), 'trade_tax');
        }

        // Trade subsidy: pay bonus to merchants importing subsidized goods.
        // v9p33river313: gated by isImport — subsidies only fire on imports.
        // Default isImport=true preserves legacy behavior for callers that
        // haven't been updated. Callers selling/exporting now pass false.
        // v9p33river338: also accumulate into subsidyAwarded so caller can
        // credit the merchant. Previously deducted from kingdom but never
        // paid to anyone — gold burned.
        const _isImport = (isImport === undefined) ? true : !!isImport;
        let _subsidyAwarded = 0;
        if (_isImport && goodId && k.tradeSubsidies) {
            for (const sub of k.tradeSubsidies) {
                if (sub.good === goodId && (sub.unitsPaid || 0) < sub.maxUnits && sub.expiresDay > world.day) {
                    const bonus = sub.bonusPerUnit || CONFIG.KING_TRADE_SUBSIDY_PER_UNIT || 2;
                    if (k.gold >= bonus) {
                        k.gold -= bonus;
                        sub.unitsPaid = (sub.unitsPaid || 0) + 1;
                        _subsidyAwarded += bonus;
                        recordKingdomTransaction(k, 'expense', bonus, 'Trade subsidy (' + goodId + ')', 'subsidies');
                    }
                }
            }
        }
        return { taxCollected: taxAmount, subsidyAwarded: _subsidyAwarded };
    }

    // ---- Property Tax Collection (monthly) ----
    function collectPropertyTaxes(k) {
        if (!k || !k.territories) return;
        const rate = k.propertyTaxRate || CONFIG.KINGDOM_DEFAULT_PROPERTY_TAX_RATE || 0.02;
        let totalPropertyTax = 0;
        // v9p33river334: tolerate legacy territory shapes and towns without iterable building lists.
        const territoryIds = (k.territories && typeof k.territories[Symbol.iterator] === 'function') ? Array.from(k.territories) : Object.keys(k.territories || {}).filter(id => k.territories[id]);

        for (const townId of territoryIds) {
            const town = findTown(townId);
            if (!town) continue;
            const townBuildings = Array.isArray(town.buildings) ? town.buildings : [];
            for (const bld of townBuildings) {
                if (bld.ownerId === k.id || bld.ownerId === null) continue; // skip kingdom-owned & town-owned
                // Tax holiday: skip buildings in towns with active tax holidays (built after holiday started)
                if (k.taxHolidays && k.taxHolidays.some(h => h.townId === townId && h.expiresDay > world.day && bld.builtDay > (h.expiresDay - (CONFIG.KING_TAX_HOLIDAY_DURATION || 180)))) { // v9p33river334: edge-day buildings predate the holiday.
                    continue;
                }
                const bt = findBuildingType(bld.type);
                const buildingValue = bt ? bt.cost : 200;
                const prosperityMult = 1 + (town.prosperity || 50) / 200;
                const tax = Math.floor(buildingValue * rate * prosperityMult);
                if (tax > 0) {
                    // v9p33river300: previously the full `tax` was added to
                    // totalPropertyTax before discounts. Keep the discounted
                    // amount; v9p33river334 also records assessed arrears so
                    // kingdom revenue/debt ledgers do not silently go stale.
                    if (bld.ownerId === 'player') {
                        // v9p33river340: honor the player's tax exemption
                        // (granted by king's-favor `tax_exemption` reward at
                        // player.js:37618; stored as expiry-day per kingdom
                        // on Player.state.taxExemption). Skip the property
                        // tax for buildings in this kingdom while the
                        // exemption is active. Income tax (line 262) does
                        // not currently tax the player directly, so no
                        // exemption hook is needed there yet.
                        if (typeof Player !== 'undefined' && Player.state && Player.state.taxExemption
                            && Player.state.taxExemption[k.id]
                            && Player.state.taxExemption[k.id] > world.day) {
                            continue; // exempt — skip property tax for this building
                        }
                        // Property Magnate: -10% property tax
                        var playerTax = tax;
                        if (typeof Player !== 'undefined' && Player.hasSkill && Player.hasSkill('property_magnate')) {
                            playerTax = Math.floor(tax * 0.90);
                        }
                        if (typeof Player !== 'undefined' && Player.gold >= playerTax) {
                            Player.state.gold -= playerTax;
                            if (typeof Player.state.stats !== 'undefined') Player.state.stats.totalGoldSpent += playerTax;
                            totalPropertyTax += playerTax;
                        } else if (typeof Player !== 'undefined' && playerTax > 0) {
                            // v9p33river320: broke owners now accrue arrears
                            // (kingdom-owed debt) instead of just skipping
                            // the tax. Tracked on Player.state._propertyTaxArrears
                            // and recorded as a debt to the kingdom.
                            if (!Player.state._propertyTaxArrears) Player.state._propertyTaxArrears = {};
                            Player.state._propertyTaxArrears[k.id] = (Player.state._propertyTaxArrears[k.id] || 0) + playerTax;
                            totalPropertyTax += playerTax; // v9p33river334: credit assessed arrears immediately so kingdom revenue is not stale.
                        }
                    } else if (bld.ownerId && bld.ownerId !== 'player') {
                        const owner = findPerson(bld.ownerId);
                        if (owner && owner.alive && owner.gold >= tax) {
                            owner.gold -= tax;
                            totalPropertyTax += tax;
                        } else if (owner && owner.alive && tax > 0) {
                            // v9p33river320: NPC owner arrears tracked on
                            // the person record so kingdom can collect
                            // later or seize the building.
                            if (!owner._propertyTaxArrears) owner._propertyTaxArrears = {};
                            owner._propertyTaxArrears[k.id] = (owner._propertyTaxArrears[k.id] || 0) + tax;
                            totalPropertyTax += tax; // v9p33river334: assessed arrears count as kingdom revenue immediately.
                        } else if (tax > 0) {
                            // v9p33river334: dead/removed owner debt stays with the building instead of disappearing.
                            if (!bld._propertyTaxArrears) bld._propertyTaxArrears = {};
                            bld._propertyTaxArrears[k.id] = (bld._propertyTaxArrears[k.id] || 0) + tax;
                            totalPropertyTax += tax;
                        }
                    }
                }
            }
        }

        // Treasury vault bonus
        // v9p33river311: was hardcoded +0.10 per treasury_vault; now reads
        // bt.taxEfficiency from config (config.js:1989 TREASURY_VAULT
        // taxEfficiency: 0.10), so any building that defines taxEfficiency
        // contributes — keeps existing behaviour when only treasury_vault
        // has the property.
        let vaultBonus = 0;
        for (const townId of territoryIds) {
            const town = findTown(townId);
            if (!town) continue;
            const _vaultBuildings = Array.isArray(town.buildings) ? town.buildings : [];
            let _bestTownVaultBonus = 0;
            for (const _vb of _vaultBuildings) {
                if (!_vb || _vb.condition === 'destroyed') continue;
                const _vbt = findBuildingType(_vb.type);
                if (_vbt && _vbt.taxEfficiency) _bestTownVaultBonus = Math.max(_bestTownVaultBonus, _vbt.taxEfficiency);
            }
            vaultBonus += _bestTownVaultBonus; // v9p33river334: cap duplicate vault effects to one/best bonus per town.
        }
        totalPropertyTax = Math.floor(totalPropertyTax * (1 + vaultBonus));

        k.gold += totalPropertyTax;
        // v9p33river320: was overwriting per cycle, losing prior collections.
        // Now accumulates so cumulative-revenue UI/AI reads are accurate.
        k.propertyTaxRevenue = (k.propertyTaxRevenue || 0) + totalPropertyTax;
        k.taxRevenue = (k.taxRevenue || 0) + totalPropertyTax;
        if (totalPropertyTax > 0) recordKingdomTransaction(k, 'income', totalPropertyTax, 'Monthly property taxes', 'property_tax');
        if (totalPropertyTax > 50) {
            logEvent(`📜 ${k.name} collects ${totalPropertyTax}g in property taxes.`, {
                type: 'property_tax', kingdomId: k.id, cause: 'Monthly property tax collection', effects: [], _noToast: true
            }, _eventKingdomCategory(k.id));
        }
    }

    // ---- Income Tax Collection (seasonal) ----
    function collectIncomeTaxes(k) {
        if (!k || !k.territories) return;
        // H-1: Now collected monthly (every 30 days) instead of quarterly (90 days)
        // Use 1/3 of the full rate per collection to keep total revenue the same
        const fullRate = k.incomeTaxRate || CONFIG.KINGDOM_DEFAULT_INCOME_TAX_RATE || 0.05;
        const rate = fullRate / 3;
        let totalIncomeTax = 0;

        // Tax NPC citizens based on accumulated wealth (use cache)
        const kPeople = getPeopleInKingdom(k.id);
        for (var _tci = 0; _tci < kPeople.length; _tci++) {
            var c = kPeople[_tci];
            if (c.gold <= 10) continue;
            const tax = Math.floor(c.gold * rate);
            if (tax > 0 && c.gold >= tax) {
                c.gold -= tax;
                totalIncomeTax += tax;
            }
        }

        // Tax elite merchants in kingdom territories
        const elites = (_tickCache.eliteMerchants || world.people.filter(p => p.alive && p.isEliteMerchant));
        for (const em of elites) {
            const emTown = findTown(em.townId);
            if (!emTown || emTown.kingdomId !== k.id) continue;
            const tax = Math.floor((em.gold || 0) * rate);
            if (tax > 0 && (em.gold || 0) >= tax) {
                em.gold -= tax;
                totalIncomeTax += tax;
            }
        }

        k.gold += totalIncomeTax;
        // v9p33river320: same overwrite fix — accumulate.
        k.incomeTaxRevenue = (k.incomeTaxRevenue || 0) + totalIncomeTax;
        k.taxRevenue = (k.taxRevenue || 0) + totalIncomeTax;
        if (totalIncomeTax > 0) recordKingdomTransaction(k, 'income', totalIncomeTax, 'Seasonal income taxes', 'income_tax');
        if (totalIncomeTax > 100) {
            logEvent(`📜 ${k.name} collects ${totalIncomeTax}g in seasonal income taxes.`, {
                type: 'income_tax', kingdomId: k.id, cause: 'Seasonal income tax assessment', effects: [], _noToast: true
            }, _eventKingdomCategory(k.id));
        }
    }

    // ---- Smart Financial Strategy (monthly, 4 levels) ----
    function tickKingdomFinancialStrategy(k) {
        if (!k) return;
        const rng = world.rng;
        const p = k.kingPersonality || {};
        const treasury = k.gold;
        const bankruptDays = k._bankruptDays || 0;
        if (!k._financialActions) k._financialActions = [];

        const soldiers = (_tickCache.soldiersByKingdom || {})[k.id] || [];

        // ---- LEDGER-BASED FINANCIAL AWARENESS ----
        // Use real financial ledger data for 90-day trend analysis
        var _ledgerSum90 = getKingdomLedgerSummary(k, 90);
        var _ledgerSum30 = getKingdomLedgerSummary(k, 30);
        var _incomeGrowing = _ledgerSum30.totalIncome > 0 && _ledgerSum90.entries > 10 ? (_ledgerSum30.totalIncome * 3) > _ledgerSum90.totalIncome : false;
        var _expenseGrowing = _ledgerSum30.totalExpenses > 0 && _ledgerSum90.entries > 10 ? (_ledgerSum30.totalExpenses * 3) > _ledgerSum90.totalExpenses : false;

        // ---- BUDGET SUSTAINABILITY REVIEW ----
        var _bsFs = getKingdomFinancialState(k);
        // Prefer ledger data if available, fall back to old revenue tracking
        var _bsDailyIncome = _ledgerSum90.entries > 5 ? _ledgerSum90.totalIncome / 90 : (_bsFs.lastSeasonRevenue || 0) / 90;
        var _bsDailyCost = _ledgerSum90.entries > 5 ? _ledgerSum90.totalExpenses / 90 : (soldiers.length * 1 + soldiers.length * CONFIG.KINGDOM_SOLDIER_DAILY_COST / 30 + _bsFs.monthlyBuildingCost / 30);
        var _bsBalance = _bsDailyIncome - _bsDailyCost;
        // If expenses exceed income, kings take corrective action
        if (_bsBalance < -2 && (soldiers.length > 5 || treasury < 3000)) {
            // How urgently to react depends on intelligence and treasury buffer
            var _monthsOfReserve = _bsDailyCost > 0 ? treasury / (_bsDailyCost * 30) : 99;
            var _shouldAct = false;
            if (p.intelligence === 'brilliant') _shouldAct = _monthsOfReserve < 4;
            else if (p.intelligence === 'clever') _shouldAct = _monthsOfReserve < 3;
            else if (p.intelligence === 'average') _shouldAct = _monthsOfReserve < 2;
            else _shouldAct = _monthsOfReserve < 1; // foolish kings wait until near-crisis

            if (_shouldAct) {
                var _bsActionsTaken = 0;

                // ---- REVENUE-GENERATING OPTIONS ----

                // 1. Raise trade tax (if not already high)
                // Greedy/corrupt kings jump to this first; generous kings avoid it
                var _bsTaxRaiseChance = 0;
                if (p.greed === 'greedy' || p.greed === 'corrupt') _bsTaxRaiseChance = 0.7;
                else if (p.greed === 'generous') _bsTaxRaiseChance = 0.1;
                else _bsTaxRaiseChance = 0.4;
                if (k.taxRate < 0.20 && rng.chance(_bsTaxRaiseChance) && _bsActionsTaken < 2) {
                    var _bsTaxInc = rng.randFloat(0.01, 0.03);
                    if (p.intelligence === 'brilliant') _bsTaxInc = Math.min(_bsTaxInc, 0.02); // moderate
                    k.taxRate = Math.min(0.20, k.taxRate + _bsTaxInc);
                    k.lastTaxIncreaseDay = world.day;
                    logEvent('📈 ' + k.name + ' raises trade taxes to ' + Math.round(k.taxRate * 100) + '% for budget sustainability.', {
                        type: 'tax_increase', kingdomId: k.id, cause: 'Budget review', effects: ['Trade more expensive']
                    }, _eventKingdomCategory(k.id));
                    _bsActionsTaken++;
                }

                // 2. Raise property tax (slower revenue, but sustainable)
                if ((k.propertyTaxRate || 0.02) < 0.05 && rng.chance(0.3) && _bsActionsTaken < 2) {
                    k.propertyTaxRate = Math.min(0.05, (k.propertyTaxRate || 0.02) + rng.randFloat(0.005, 0.01));
                    logEvent('📈 ' + k.name + ' raises property taxes to ' + Math.round(k.propertyTaxRate * 100) + '%.', {
                        type: 'tax_increase', kingdomId: k.id, cause: 'Budget review', effects: ['Building owners pay more']
                    }, _eventKingdomCategory(k.id));
                    _bsActionsTaken++;
                }

                // 3. Raise income tax (smart kings use this as a last resort)
                if ((k.incomeTaxRate || 0.05) < 0.10 && rng.chance(p.greed === 'corrupt' ? 0.5 : 0.15) && _bsActionsTaken < 2) {
                    var _itInc = rng.randFloat(0.01, 0.02);
                    k.incomeTaxRate = Math.min(0.10, (k.incomeTaxRate || 0.05) + _itInc);
                    logEvent('📈 ' + k.name + ' raises income tax to ' + Math.round(k.incomeTaxRate * 100) + '%.', {
                        type: 'tax_increase', kingdomId: k.id, cause: 'Budget review', effects: ['Citizens pay more income tax']
                    }, _eventKingdomCategory(k.id));
                    _bsActionsTaken++;
                }

                // 3b. Raise healthcare tax (if illness is widespread or budget tight)
                if ((k.healthcareTaxRate || 0.10) < (CONFIG.KINGDOM_HEALTHCARE_TAX_MAX || 0.30) && rng.chance(0.2) && _bsActionsTaken < 2) {
                    var _htInc = rng.randFloat(0.02, 0.05);
                    k.healthcareTaxRate = Math.min(CONFIG.KINGDOM_HEALTHCARE_TAX_MAX || 0.30, (k.healthcareTaxRate || 0.10) + _htInc);
                    logKingAction(k, '📈 Raised healthcare tax to ' + Math.round(k.healthcareTaxRate * 100) + '%');
                    _bsActionsTaken++;
                }

                // 4. Sell surplus military stockpile for quick gold
                if (k.militaryStockpile && rng.chance(0.5) && _bsActionsTaken < 3) {
                    var _bsStockpile = k.militaryStockpile;
                    var _bsSoldItems = 0;
                    var _bsSoldGold = 0;
                    var _sellItems = ['swords', 'armor', 'bows', 'arrows', 'horses'];
                    for (var _bsi = 0; _bsi < _sellItems.length; _bsi++) {
                        var _bsItemId = _sellItems[_bsi];
                        var _bsQty = _bsStockpile[_bsItemId] || 0;
                        // Keep some reserve; sell 30-60% of surplus depending on urgency
                        var _bsSellPct = _monthsOfReserve < 1 ? 0.6 : 0.3;
                        var _bsSurplus = Math.floor(_bsQty * _bsSellPct);
                        if (_bsSurplus > 0) {
                            var _bsKTowns = world.towns.filter(function(t) {
                                // v9p33river333: liquidate only into useful live market towns.
                                return k.territories.has(t.id) && !t.abandoned && !t.destroyed && !t.isOutpost && !t.isJunction && t.market && t.market.supply && t.market.prices;
                            });
                            if (_bsKTowns.length > 0) {
                                var _bsTown = rng.pick(_bsKTowns);
                                // v9p33river310: guard malformed/partial
                                // markets so finance tick doesn't crash on
                                // a territory town that's missing market or
                                // market.prices/.supply.
                                if (!_bsTown || !_bsTown.market) continue;
                                if (!_bsTown.market.supply) _bsTown.market.supply = {};
                                if (!_bsTown.market.prices) _bsTown.market.prices = {};
                                var _bsPrice = (_bsTown.market.prices[_bsItemId] || 10) * _bsSurplus;
                                _bsTown.market.supply[_bsItemId] = (_bsTown.market.supply[_bsItemId] || 0) + _bsSurplus;
                                _bsStockpile[_bsItemId] -= _bsSurplus;
                                var _bsGain = Math.floor(_bsPrice * 0.7);
                                k.gold += _bsGain;
                                _bsSoldItems += _bsSurplus;
                                _bsSoldGold += _bsGain;
                            }
                        }
                    }
                    if (_bsSoldItems > 0) {
                        recordKingdomTransaction(k, 'income', _bsSoldGold, 'Sold ' + _bsSoldItems + ' surplus military items', 'stockpile_sale');
                        logEvent('🏰 ' + k.name + ' sells ' + _bsSoldItems + ' surplus military items for ' + _bsSoldGold + 'g.', {
                            type: 'stockpile_sale', kingdomId: k.id, cause: 'Budget sustainability', effects: ['Treasury bolstered'], _noToast: true
                        }, _eventKingdomCategory(k.id));
                        _bsActionsTaken++;
                    }
                }

                // 5. Lower tariffs to attract more merchants (clever/brilliant long-term strategy)
                // Counter-intuitive: lower tax → more trade volume → more total revenue
                if ((p.intelligence === 'brilliant' || p.intelligence === 'clever') && k.taxRate > 0.12 && rng.chance(0.2) && _bsActionsTaken < 1) {
                    // Smart king realizes high taxes are driving merchants away
                    k.taxRate = Math.max(0.08, k.taxRate - rng.randFloat(0.01, 0.03));
                    logEvent('📉 ' + k.name + ' lowers trade taxes to ' + Math.round(k.taxRate * 100) + '% to attract more merchants.', {
                        type: 'tax_decrease', kingdomId: k.id, cause: 'Trade stimulation strategy', effects: ['Trade more attractive', 'Long-term revenue growth'], _noToast: true
                    }, _eventKingdomCategory(k.id));
                    _bsActionsTaken++;
                }

                // 6. Encourage production — smart kings ensure towns have productive buildings
                if ((p.intelligence === 'brilliant' || p.intelligence === 'clever') && rng.chance(0.15) && _bsActionsTaken < 3) {
                    // Check if any town lacks a market or key production building
                    for (var _bsTid of k.territories) {
                        var _bsPTown = findTown(_bsTid);
                        if (!_bsPTown || !_bsPTown.buildings) continue;
                        var _bsHasMarket = _bsPTown.buildings.some(function(b) { return b.type === 'market'; });
                        if (!_bsHasMarket && k.gold > 400) {
                            kingdomBuild(k, _bsPTown, 'market', rng);
                            logEvent('🏗️ ' + k.name + ' builds a market in ' + _bsPTown.name + ' to boost trade revenue.', {
                                type: 'construction', kingdomId: k.id, cause: 'Revenue strategy', effects: ['More trade in ' + _bsPTown.name]
                            }, _eventKingdomCategory(k.id));
                            _bsActionsTaken++;
                            break;
                        }
                    }
                }

                // ---- EXPENSE-CUTTING OPTIONS ----

                // 7. Reduce guard budget (if high)
                if ((k.guardBudget || 0.15) > 0.05 && rng.chance(0.3) && _bsActionsTaken < 3) {
                    k.guardBudget = Math.max(0.05, (k.guardBudget || 0.15) - 0.05);
                    logEvent('🏰 ' + k.name + ' reduces guard spending.', {
                        type: 'budget_cut', kingdomId: k.id, cause: 'Budget sustainability', effects: ['Fewer guards hired'], _noToast: true
                    }, _eventKingdomCategory(k.id));
                    _bsActionsTaken++;
                }

                // 8. Discharge soldiers — personality determines how much
                // Generous/peaceful kings discharge more readily; militaristic/brave resist
                var _bsDischargeChance = 0.5;
                if (p.militarism === 'warlike' || p.courage === 'brave') _bsDischargeChance = 0.2;
                else if (p.militarism === 'peaceful' || p.courage === 'cautious') _bsDischargeChance = 0.7;
                if (soldiers.length > 5 && rng.chance(_bsDischargeChance) && _bsActionsTaken < 3) {
                    var _excessDailyCost = Math.abs(_bsBalance);
                    var _costPerSoldier = 1 + CONFIG.KINGDOM_SOLDIER_DAILY_COST / 30;
                    var _idealDischarge = Math.ceil(_excessDailyCost / _costPerSoldier);
                    // If we already raised taxes or sold stockpile, discharge fewer
                    if (_bsActionsTaken > 0) _idealDischarge = Math.max(1, Math.floor(_idealDischarge * 0.5));
                    // Personality modifier
                    if (p.courage === 'cautious') _idealDischarge = Math.ceil(_idealDischarge * 1.3);
                    else if (p.courage === 'brave') _idealDischarge = Math.ceil(_idealDischarge * 0.5);
                    if (p.intelligence === 'foolish') _idealDischarge = Math.max(1, Math.ceil(_idealDischarge * rng.randFloat(0.3, 0.8)));
                    // RNG variability
                    _idealDischarge = Math.max(1, _idealDischarge + rng.randInt(-1, 1));
                    // Never discharge more than 15% of army at once
                    _idealDischarge = Math.min(_idealDischarge, Math.max(1, Math.floor(soldiers.length * 0.15)));
                    // Don't discharge below a minimum garrison
                    var _minGarrison = Math.max(5, Math.floor(k.territories.size * 3));
                    if (soldiers.length - _idealDischarge < _minGarrison) {
                        _idealDischarge = Math.max(0, soldiers.length - _minGarrison);
                    }
                    // Discharge the least experienced soldiers first
                    if (_idealDischarge > 0) {
                        var sortedSoldiers = soldiers.slice().sort(function(a, b) {
                            return (a.skills && a.skills.combat || 0) - (b.skills && b.skills.combat || 0);
                        });
                        var discharged = 0;
                        for (var si = 0; si < sortedSoldiers.length && discharged < _idealDischarge; si++) {
                            var s = sortedSoldiers[si];
                            var sTown = findTown(s.townId);
                            if (sTown) {
                                dischargeSoldier(s, sTown);
                                discharged++;
                            }
                        }
                        if (discharged > 0) {
                            logEvent('🏰 ' + k.name + ' discharges ' + discharged + ' soldiers to balance the budget.', {
                                type: 'military_cut', kingdomId: k.id, cause: 'Budget sustainability review', effects: ['Army reduced', 'Budget pressure eased']
                            }, _eventKingdomCategory(k.id));
                        }
                    }
                }

                // 9. Halt or reduce construction spending
                if (k._buildQueue && k._buildQueue.length > 0 && rng.chance(0.3) && _bsActionsTaken < 3) {
                    // Cancel lowest-priority queued construction
                    var _cancelled = k._buildQueue.pop();
                    if (_cancelled) {
                        logEvent('🏗️ ' + k.name + ' cancels planned construction to save gold.', {
                            type: 'budget_cut', kingdomId: k.id, cause: 'Budget sustainability', effects: ['Construction delayed'], _noToast: true
                        }, _eventKingdomCategory(k.id));
                    }
                }
            }
        }
        if (treasury < (CONFIG.KINGDOM_MILD_THRESHOLD || 2000)) {
            let actionsTaken = 0;

            // 1. Raise trade tax
            if (k.taxRate < 0.25 && rng.chance(p.greed === 'greedy' || p.greed === 'corrupt' ? 0.8 : 0.4)) {
                const increase = rng.randFloat(0.01, 0.03);
                k.taxRate = Math.min(0.25, k.taxRate + increase);
                k.lastTaxIncreaseDay = world.day;
                logEvent(`📈 ${k.name} raises trade taxes to ${Math.round(k.taxRate * 100)}%.`, {
                    type: 'tax_increase', kingdomId: k.id, cause: 'Low treasury (' + Math.floor(treasury) + 'g)', effects: ['Trade becomes more expensive', 'Merchants may avoid this kingdom']
                }, _eventKingdomCategory(k.id));
                actionsTaken++;
            }

            // 2. Raise property tax
            if (actionsTaken < 2 && (k.propertyTaxRate || 0.02) < 0.06 && rng.chance(0.3)) {
                k.propertyTaxRate = Math.min(0.06, (k.propertyTaxRate || 0.02) + rng.randFloat(0.005, 0.01));
                logEvent(`📈 ${k.name} raises property taxes to ${Math.round(k.propertyTaxRate * 100)}%.`, {
                    type: 'tax_increase', kingdomId: k.id, cause: 'Low treasury', effects: ['Building owners pay more']
                }, _eventKingdomCategory(k.id));
                actionsTaken++;
            }

            // 3. Cut military spending
            if (actionsTaken < 2 && soldiers.length > 5 && rng.chance(p.militarism === 'peaceful' ? 0.5 : 0.2)) {
                const toCut = Math.max(1, Math.floor(soldiers.length * 0.10));
                let cut = 0;
                for (const s of soldiers) {
                    if (cut >= toCut) break;
                    s.occupation = 'laborer';
                    const town = findTown(s.townId);
                    if (town && town.garrison > 0) town.garrison--;
                    cut++;
                }
                logEvent(`🏰 ${k.name} reduces its army by ${cut} soldiers to save gold.`, {
                    type: 'military_cut', kingdomId: k.id, cause: 'Budget constraints', effects: ['Military strength reduced', 'Former soldiers seek work']
                }, _eventKingdomCategory(k.id));
                actionsTaken++;
            }

            // 4. Reduce guard budget
            if (actionsTaken < 2 && (k.guardBudget || 0.15) > 0.05 && rng.chance(0.3)) {
                k.guardBudget = Math.max(0.05, (k.guardBudget || 0.15) - 0.05);
                logEvent(`🏰 ${k.name} reduces guard spending.`, {
                    type: 'budget_cut', kingdomId: k.id, cause: 'Financial austerity', effects: ['Fewer guards hired', 'Town security may decrease'], _noToast: true
                }, _eventKingdomCategory(k.id));
                actionsTaken++;
            }

            // 5. Sell surplus military stockpile
            if (actionsTaken < 2 && k.militaryStockpile && rng.chance(0.4)) {
                const stockpile = k.militaryStockpile;
                let soldItems = 0;
                for (const itemId of ['swords', 'armor', 'bows', 'arrows', 'horses']) {
                    const qty = stockpile[itemId] || 0;
                    const surplus = Math.floor(qty * 0.5);
                    if (surplus > 0) {
                        const kTowns = world.towns.filter(t => k.territories.has(t.id));
                        if (kTowns.length > 0) {
                            const town = rng.pick(kTowns);
                            // v9p33river319: guard against territory towns
                            // missing market (legacy outposts, partial
                            // initialization); finance tick was crashing
                            // on .market.prices access.
                            if (!town || !town.market) continue;
                            if (!town.market.supply) town.market.supply = {};
                            if (!town.market.prices) town.market.prices = {};
                            const price = (town.market.prices[itemId] || 10) * surplus;
                            town.market.supply[itemId] = (town.market.supply[itemId] || 0) + surplus;
                            stockpile[itemId] -= surplus;
                            k.gold += Math.floor(price * 0.7); // sell at 70% market value
                            soldItems += surplus;
                        }
                    }
                }
                if (soldItems > 0) {
                    logEvent(`🏰 ${k.name} sells surplus military equipment (${soldItems} items) to raise funds.`, {
                        type: 'stockpile_sale', kingdomId: k.id, cause: 'Financial need', effects: ['Military reserves reduced', 'Treasury bolstered'], _noToast: true
                    }, _eventKingdomCategory(k.id));
                }
            }
        }

        // ---- LEVEL 2: Moderate Actions (treasury < 500g) ----
        if (treasury < (CONFIG.KINGDOM_MODERATE_THRESHOLD || 500)) {
            // 7. Emergency tax levy
            if (rng.chance(p.greed === 'greedy' || p.greed === 'corrupt' ? 0.6 : 0.2)) {
                let levy = 0;
                const citizens = getPeopleInKingdom(k.id).filter(c => c.gold > 20);
                for (const c of citizens) {
                    const tax = Math.floor(c.gold * 0.05);
                    if (tax > 0) { c.gold -= tax; levy += tax; }
                }
                if (levy > 0) {
                    k.gold += levy;
                    recordKingdomTransaction(k, 'income', levy, 'Emergency wealth tax from citizens', 'emergency_tax');
                    boostKingdomHappiness(k, -10);
                    logEvent(`💰 ${k.name} imposes an emergency wealth tax! ${levy}g collected from citizens.`, {
                        type: 'emergency_tax', kingdomId: k.id, cause: 'Near-bankruptcy', effects: ['Happiness drops significantly (-10)', 'Citizens lose savings', 'Unrest may follow']
                    }, _eventKingdomCategory(k.id));
                }
            }

            // 8. Sell non-essential kingdom buildings
            if (rng.chance(0.3)) {
                const sellable = ['guild_hall', 'marketplace_royal', 'granary', 'clinic'];
                for (const townId of k.territories) {
                    const town = findTown(townId);
                    if (!town) continue;
                    const idx = town.buildings.findIndex(b => b.ownerId === k.id && sellable.includes(b.type));
                    if (idx >= 0) {
                        const bld = town.buildings[idx];
                        const bt = findBuildingType(bld.type);
                        const salePrice = Math.floor((bt ? bt.cost : 300) * 0.5);
                        if (bld.workers && bld.workers.length) {
                            for (var _sbwi = 0; _sbwi < bld.workers.length; _sbwi++) {
                                var _sbw = findPerson(bld.workers[_sbwi]);
                                if (_sbw) { _sbw.employerId = null; _sbw.occupation = _sbw.previousOccupation || _sbw.occupation; }
                            }
                            bld.workers = [];
                        }
                        town.buildings.splice(idx, 1);
                        k.gold += salePrice;
                        // v9p33river333: record salvage income and clean owner state before removing building.
                        recordKingdomTransaction(k, 'income', salePrice, 'Emergency sale of ' + (bt ? bt.name : bld.type) + ' in ' + town.name, 'building_sale');
                        logEvent(`🏚️ ${k.name} sells a ${bt ? bt.name : bld.type} in ${town.name} for ${salePrice}g.`, {
                            type: 'building_sale', kingdomId: k.id, cause: 'Desperate for gold', effects: ['Town loses building benefits']
                        }, _eventKingdomCategory(k.id));
                        break;
                    }
                }
            }

        // v9p33river316: forced loan now creates a kingdom debt so the
        // NPC is owed back. Was permanently taking gold with no repayment
        // record. Kingdom finance tick should later see and (try to)
        // repay; if treasury can't, the debt persists as a relationship
        // penalty.
        if (rng.chance(p.temperament === 'cruel' || p.temperament === 'stern' ? 0.5 : 0.2)) {
            const wealthyNPCs = world.people.filter(c =>
                c.alive && c.kingdomId === k.id && c.gold > 200 && !c.isEliteMerchant
            ).sort((a, b) => b.gold - a.gold);
            if (wealthyNPCs.length > 0) {
                const target = wealthyNPCs[0];
                const loan = Math.min(Math.floor(target.gold * 0.3), 500);
                target.gold -= loan;
                k.gold += loan;
                if (!k._forcedLoanDebts) k._forcedLoanDebts = [];
                k._forcedLoanDebts.push({
                    creditorId: target.id,
                    amount: loan,
                    issuedDay: world.day,
                    dueDay: world.day + 180,
                });
                logEvent(`👑 ${k.name}'s king demands a ${loan}g "loan" from ${target.firstName} ${target.lastName}.`, {
                    type: 'forced_loan', kingdomId: k.id, cause: 'Royal decree to raise emergency funds', effects: ['Target loses gold', 'Relations strained', 'Kingdom owes ' + loan + 'g back within 180 days']
                }, _eventKingdomCategory(k.id));
            }
        }

            // 10. Reduce soldier pay (morale drops)
            if (soldiers.length > 3 && rng.chance(0.3)) {
                const desertCount = Math.max(1, Math.floor(soldiers.length * 0.05));
                let deserted = 0;
                for (const s of soldiers) {
                    if (deserted >= desertCount) break;
                    if (rng.chance(0.3)) {
                        s.occupation = 'laborer';
                        const town = findTown(s.townId);
                        if (town && town.garrison > 0) town.garrison--;
                        deserted++;
                    }
                }
                if (deserted > 0) {
                    logEvent(`🏰 ${k.name} cuts soldier pay. ${deserted} soldiers desert.`, {
                        type: 'soldier_pay_cut', kingdomId: k.id, cause: 'Cannot afford full military wages', effects: ['Some soldiers desert', 'Army morale drops']
                    }, _eventKingdomCategory(k.id));
                }
            }

            // 11. Trade concessions to other kingdoms
            if (rng.chance(p.intelligence === 'brilliant' || p.intelligence === 'clever' ? 0.5 : 0.15)) {
                const friendliest = world.kingdoms.filter(o => o.id !== k.id && !k.atWar.has(o.id))
                    .sort((a, b) => (k.relations[b.id] || 0) - (k.relations[a.id] || 0))[0];
                if (friendliest && friendliest.gold > 1000) {
                    const aid = Math.min(500, Math.floor(friendliest.gold * 0.05));
                    friendliest.gold -= aid;
                    k.gold += aid;
                    k.relations[friendliest.id] = Math.min(100, (k.relations[friendliest.id] || 0) + 10);
                    friendliest.relations[k.id] = Math.min(100, (friendliest.relations[k.id] || 0) + 10);
                    logEvent(`🤝 ${k.name} negotiates a trade concession deal with ${friendliest.name} for ${aid}g.`, {
                        type: 'trade_concession', kingdomId: k.id, cause: 'Financial diplomacy', effects: ['Relations improve', 'Treasury bolstered']
                    }, _eventKingdomCategory(k.id));
                }
            }
        }

        // ---- LEVEL 3: Desperate Measures (bankrupt 15+ days) ----
        if (bankruptDays >= (CONFIG.KINGDOM_DESPERATE_DAYS || 15)) {
            // 13. Seize NPC businesses
            if ((p.greed === 'greedy' || p.greed === 'corrupt') && rng.chance(0.3)) {
                for (const townId of k.territories) {
                    const town = findTown(townId);
                    if (!town) continue;
                    const npcBld = town.buildings.find(b => b.ownerId && b.ownerId !== 'player' && b.ownerId !== k.id);
                    if (npcBld) {
                        const bt = findBuildingType(npcBld.type);
                        const value = Math.floor((bt ? bt.cost : 300) * 0.4);
                        npcBld.ownerId = k.id;
                        k.gold += value;
                        logEvent(`⚠️ ${k.name}'s king seizes a ${bt ? bt.name : npcBld.type} in ${town.name}! (${value}g)`, {
                            type: 'asset_seizure', kingdomId: k.id, cause: 'Despotic measures to avoid collapse', effects: ['Building nationalized', 'Citizens fearful', 'Happiness drops']
                        }, _eventKingdomCategory(k.id));
                        boostKingdomHappiness(k, -5);
                        break;
                    }
                }
            }

            // 14. Seize elite merchant assets
            if (rng.chance(0.15)) {
                const elites = world.people.filter(e =>
                    e.alive && e.isEliteMerchant && e.gold > 500
                );
                const localElite = elites.find(e => {
                    const eTown = findTown(e.townId);
                    return eTown && eTown.kingdomId === k.id;
                });
                if (localElite) {
                    const seized = Math.min(Math.floor(localElite.gold * 0.3), 1000);
                    localElite.gold -= seized;
                    k.gold += seized;
                    localElite._seizureVictim = true;
                    logEvent(`⚠️ ${k.name}'s king seizes ${seized}g from the merchant house of ${localElite.firstName} ${localElite.lastName}!`, {
                        type: 'elite_seizure', kingdomId: k.id, cause: 'Royal confiscation of merchant wealth', effects: ['Elite merchant may flee', 'Trade confidence shattered']
                    }, _eventKingdomCategory(k.id));
                    boostKingdomHappiness(k, -8);
                }
            }

            // 16. Forced labor
            if (rng.chance(0.1) && (p.temperament === 'cruel' || p.temperament === 'stern')) {
                boostKingdomHappiness(k, -20);
                k.gold += rng.randInt(200, 500);
                logEvent(`⛓️ ${k.name}'s king decrees forced labor! Citizens conscripted for kingdom projects.`, {
                    type: 'forced_labor', kingdomId: k.id, cause: 'Desperate attempt to generate revenue', effects: ['Happiness plummets (-20)', 'Small amount of gold generated', 'Risk of rebellion']
                }, _eventKingdomCategory(k.id));
            }

            // 18. Debase currency
            if (!k._currencyDebased && rng.chance(0.2)) {
                k._currencyDebased = true;
                k._debasementInflation = 0.30;
                k.gold = Math.floor(k.gold * 1.20); // instant 20% boost
                logEvent(`💰 ${k.name} debases its currency! The kingdom mints cheaper coins.`, {
                    type: 'currency_debasement', kingdomId: k.id, cause: 'Desperate monetary policy', effects: ['Treasury gets 20% boost', 'All prices in kingdom rise 30%', 'Long-term economic damage']
                }, _eventKingdomCategory(k.id));
                // Inflate prices in all kingdom towns
                // v9p33river319: guard against towns missing market.prices
                // (legacy outposts / partial init) so debasement doesn't
                // crash the finance tick.
                for (const townId of k.territories) {
                    const town = findTown(townId);
                    if (!town || !town.market || !town.market.prices) continue;
                    for (const resId in town.market.prices) {
                        town.market.prices[resId] = Math.ceil(town.market.prices[resId] * 1.30);
                    }
                }
            }
        }

        // ---- LEVEL 4: Last Resort (bankrupt 45+ days) ----
        if (bankruptDays >= 45) {
            // 20. Offer surrender to neighbor
            if (rng.chance(p.courage === 'cowardly' ? 0.3 : 0.05)) {
                const bestNeighbor = world.kingdoms.filter(o => o.id !== k.id && !k.atWar.has(o.id))
                    .sort((a, b) => (k.relations[b.id] || 0) - (k.relations[a.id] || 0))[0];
                if (bestNeighbor) {
                    logEvent(`🏳️ ${k.name}'s king offers to merge with ${bestNeighbor.name} to avoid total collapse.`, {
                        type: 'merger_offer', kingdomId: k.id, cause: 'Kingdom cannot survive independently', effects: ['Towns may transfer', 'King may abdicate']
                    }, _eventKingdomCategory(k.id));
                    // Transfer half the towns
                    const townIds = [...k.territories];
                    const toTransfer = Math.max(1, Math.floor(townIds.length / 2));
                    for (let i = 0; i < toTransfer && i < townIds.length; i++) {
                        const town = findTown(townIds[i]);
                        if (town) {
                            k.territories.delete(townIds[i]);
                            town.kingdomId = bestNeighbor.id;
                            bestNeighbor.territories.add(townIds[i]);
                        }
                    }
                    k.relations[bestNeighbor.id] = Math.min(100, (k.relations[bestNeighbor.id] || 0) + 30);
                    bestNeighbor.relations[k.id] = Math.min(100, (bestNeighbor.relations[k.id] || 0) + 30);
                }
            }

            // 21. King abdicates
            if (rng.chance(p.courage === 'cowardly' ? 0.15 : 0.03)) {
                const king = findPerson(k.king);
                if (king && king.alive) {
                    logEvent(`👑 The king of ${k.name} abdicates! A new ruler must be found.`, {
                        type: 'abdication', kingdomId: k.id, cause: 'Kingdom bankruptcy and despair', effects: ['New king with different personality', 'Brief period of instability', 'Debts may be restructured']
                    }, _eventKingdomCategory(k.id));
                    king.occupation = 'merchant';
                    handleKingDeath(k, 'abdication');
                    k._bankruptDays = Math.floor(k._bankruptDays * 0.5); // partial reset
                    k.gold += 500; // new king brings some treasury
                }
            }
        }

        // ---- LICENSE FEE ADJUSTMENT AI ----
        // Kings periodically review and adjust license fees for restricted goods
        // Factors: treasury health, supply needs, personality, war status
        if (!k.laws) k.laws = {};
        if (!k.laws.licenseFees) k.laws.licenseFees = {};
        var restricted = k.laws.restrictedGoods || [];
        if (restricted.length > 0 && rng.chance(0.10)) { // ~10% chance per tick to review fees
            var warGoods = CONFIG.WAR_GOODS || ['swords', 'armor', 'blasting_powder', 'demolition_tools'];
            var atWar = k.atWar && k.atWar.size > 0;
            var treasuryRatio = treasury / ((k._startingGold || 10000) || 10000);
            // Personality modifiers
            var greedMod = p.greed === 'corrupt' ? 1.4 : p.greed === 'greedy' ? 1.25 : p.greed === 'fair' ? 1.0 : 0.85;
            var smartDiscount = (p.intelligence === 'brilliant' || p.intelligence === 'clever') ? 0.9 : 1.0;

            for (var ri = 0; ri < restricted.length; ri++) {
                var goodId = restricted[ri];
                var isWarGood = warGoods.indexOf(goodId) !== -1;
                var baseFee = isWarGood ? (CONFIG.LICENSE_FEE_WAR || 1000) : (CONFIG.LICENSE_FEE || 500);
                var feeMin = isWarGood ? (CONFIG.LICENSE_FEE_WAR_MIN || 500) : (CONFIG.LICENSE_FEE_MIN || 300);
                var feeMax = isWarGood ? (CONFIG.LICENSE_FEE_WAR_MAX || 5000) : (CONFIG.LICENSE_FEE_MAX || 3000);
                var currentFee = k.laws.licenseFees[goodId] || baseFee;

                var targetFee = baseFee;

                // Low treasury → raise fees for revenue
                if (treasuryRatio < 0.3) targetFee *= 1.3;
                else if (treasuryRatio < 0.5) targetFee *= 1.15;
                else if (treasuryRatio > 1.5) targetFee *= 0.9;

                // Greed modifier
                targetFee *= greedMod;

                // Smart kings moderate fees to encourage trade
                targetFee *= smartDiscount;

                // War status affects war goods
                if (isWarGood && atWar) {
                    // At war: need weapons produced → lower war-good license fees to encourage supply
                    if (p.intelligence === 'brilliant' || p.intelligence === 'clever') {
                        targetFee *= 0.6; // smart kings slash war-good fees during war
                    } else if (p.intelligence === 'average') {
                        targetFee *= 0.8;
                    }
                    // But greedy/corrupt kings might still keep fees high
                    if (p.greed === 'corrupt') targetFee *= 1.3;
                } else if (isWarGood && !atWar) {
                    // Peacetime: war goods are luxury permits, charge more
                    if (p.militarism === 'peaceful') targetFee *= 1.2;
                }

                // Check supply need: if kingdom towns are short on this good, lower fees to encourage trade
                // v9p33river319: guard against towns missing market or
                // market.supply/demand (legacy outposts / partial init).
                var totalSupply = 0, totalDemand = 0;
                for (var ti = 0; ti < world.towns.length; ti++) {
                    var town = world.towns[ti];
                    if (!k.territories.has(town.id)) continue;
                    if (!town.market) continue;
                    totalSupply += (town.market.supply && town.market.supply[goodId]) || 0;
                    totalDemand += (town.market.demand && town.market.demand[goodId]) || 0;
                }
                if (totalDemand > 0 && totalSupply < totalDemand * 0.5) {
                    // Severe shortage → lower fees to attract merchants
                    targetFee *= 0.75;
                } else if (totalDemand > 0 && totalSupply > totalDemand * 2) {
                    // Oversupply → raise fees (less need for more traders)
                    targetFee *= 1.2;
                }

                // Clamp to bounds
                targetFee = Math.max(feeMin, Math.min(feeMax, Math.round(targetFee)));

                // Gradual adjustment toward target (don't jump instantly)
                var step = Math.max(25, Math.floor(Math.abs(targetFee - currentFee) * 0.3));
                if (targetFee > currentFee) {
                    k.laws.licenseFees[goodId] = Math.min(targetFee, currentFee + step);
                } else if (targetFee < currentFee) {
                    k.laws.licenseFees[goodId] = Math.max(targetFee, currentFee - step);
                }
            }
        }

        // ---- RANDOM INSPECTIONS ENACT/REPEAL AI (every 90 days) ----
        if (world.day % 90 === 0) {
            var hasInspections = hasSpecialLaw(k, 'random_inspections');
            var kpRI = k.kingPersonality || {};
            var justiceIsHigh = (kpRI.justice || 0) > 0.5;
            var justiceIsLow = (kpRI.justice || 0) < 0.3;
            var lowHappiness = (k.happiness || 50) < 60;

            if (!hasInspections) {
                // Consider enacting: justice is high AND (low happiness or random chance)
                if (justiceIsHigh && (lowHappiness || rng.chance(0.3))) {
                    if (k.gold >= 500) {
                        var inspLaw = CONFIG.SPECIAL_LAWS.find(function(l) { return l.id === 'random_inspections'; });
                        if (inspLaw) {
                            k.laws.specialLaws.push(inspLaw);
                            logEvent('📜 ' + k.name + ' enacted Random Inspections law — guards will inspect merchants for contraband.', { category: 'laws' });
                        }
                    }
                }
            } else {
                // Consider repealing: treasury too low or lenient king
                if (k.gold < 500 || justiceIsLow) {
                    k.laws.specialLaws = k.laws.specialLaws.filter(function(l) { return l.id !== 'random_inspections'; });
                    logEvent('📜 ' + k.name + ' repealed Random Inspections law — inspections cease.', { category: 'laws' });
                }
            }
        }

        // ---- PUNISHMENT ADJUSTMENT AI (every 180 days) ----
        if (world.day % 180 === 0 && CONFIG.CRIME_TYPES && CONFIG.CRIME_TYPES.length > 0) {
            var kpPA = k.kingPersonality || {};
            var crimeToAdjust = rng.pick(CONFIG.CRIME_TYPES);
            if (crimeToAdjust) {
                var curP = (k.crimePunishments && k.crimePunishments[crimeToAdjust.id]) ||
                    { type: crimeToAdjust.defaultPunishment, jailDays: crimeToAdjust.defaultJailDays, fine: crimeToAdjust.defaultFine };
                var newP = { type: curP.type, jailDays: curP.jailDays || 0, fine: curP.fine || 0 };

                // Small adjustments based on personality
                if ((kpPA.justice || 0) > 0.6) {
                    newP.fine = Math.floor(newP.fine * 1.2);
                    newP.jailDays = Math.min(360, newP.jailDays + 2);
                } else if ((kpPA.justice || 0) < 0.3) {
                    newP.fine = Math.max(25, Math.floor(newP.fine * 0.8));
                    newP.jailDays = Math.max(0, newP.jailDays - 2);
                }

                // Greedy kings shift toward fines
                if ((kpPA.greed || 0) > 0.6 && newP.type === 'jail') {
                    if (rng.chance(0.3) && crimeToAdjust.id !== 'murder' && crimeToAdjust.id !== 'treason') {
                        newP.type = 'fine';
                        newP.fine = Math.floor((crimeToAdjust.defaultFine || 200) * 2.0);
                        newP.jailDays = 0;
                    }
                }

                // Volatile temperament: small chance to escalate to execution
                if ((kpPA.temperament || 0) > 0.8 && newP.type !== 'execution' && rng.chance(0.1)) {
                    newP.type = 'execution'; newP.jailDays = 0; newP.fine = 0;
                }

                // Generous kings lower fines
                if ((kpPA.generosity || 0) > 0.6) {
                    newP.fine = Math.max(25, Math.floor(newP.fine * 0.8));
                }

                if (!k.crimePunishments) k.crimePunishments = {};
                k.crimePunishments[crimeToAdjust.id] = newP;
            }
        }

        // ---- PROACTIVE WEALTH BUILDING (ledger trend-aware, every 30 days) ----
        // Smart/ambitious kings invest in the kingdom when treasury is healthy and income is growing
        if (treasury > 3000 && _bsBalance > 0 && world.day % 30 === 0) {
            // Personality-based investment willingness
            var _investChance = 0.3;
            if (p.ambition === 'ambitious') _investChance += 0.2;
            if (p.intelligence === 'brilliant') _investChance += 0.15;
            else if (p.intelligence === 'clever') _investChance += 0.08;
            if (p.greed === 'generous') _investChance += 0.1;
            else if (p.greed === 'greedy' || p.greed === 'corrupt') _investChance -= 0.15; // hoarders don't invest

            if (rng.chance(_investChance)) {
                // If income is growing (30-day income > 1/3 of 90-day), be more confident
                var _investBudget = _incomeGrowing ? Math.floor(treasury * 0.15) : Math.floor(treasury * 0.08);
                _investBudget = Math.min(_investBudget, Math.floor(_bsBalance * 30)); // don't invest more than 1 month's net

                if (_investBudget > 200) {
                    // Priority: build production buildings in towns that lack them
                    var _invested = false;
                    for (var _tid of k.territories) {
                        var _invTown = findTown(_tid);
                        if (!_invTown || !_invTown.buildings) continue;
                        var _hasMarket = _invTown.buildings.some(function(b) { return b.type === 'market'; });
                        if (!_hasMarket && _investBudget >= 400) {
                            kingdomBuild(k, _invTown, 'market', rng);
                            recordKingdomTransaction(k, 'expense', 400, 'Investment: market in ' + _invTown.name, 'construction');
                            _invested = true;
                            break;
                        }
                        var _hasBakery = _invTown.buildings.some(function(b) { return b.type === 'bakery'; });
                        if (!_hasBakery && _investBudget >= 300 && _invTown.population > 80) {
                            kingdomBuild(k, _invTown, 'bakery', rng);
                            recordKingdomTransaction(k, 'expense', 300, 'Investment: bakery in ' + _invTown.name, 'construction');
                            _invested = true;
                            break;
                        }
                    }
                    if (_invested) {
                        logKingAction(k, '🏗️ Invested in kingdom infrastructure (trending: ' + (_incomeGrowing ? 'income growing' : 'stable') + ')');
                    }
                }
            }
        }

        // If expenses are growing faster than income, proactive kings cut early
        if (_expenseGrowing && !_incomeGrowing && treasury > 2000 && (p.intelligence === 'brilliant' || p.intelligence === 'clever')) {
            if (world.day % 30 === 0 && rng.chance(0.4)) {
                logKingAction(k, '📊 Financial review: expenses growing faster than income. Monitoring closely.');
            }
        }
    }
    function getKingdomFinancialState(k) {
        var soldierCount = ((_tickCache.soldiersByKingdom || {})[k.id] || []).length;
        if (!soldierCount) {
            soldierCount = world.people.filter(function(p) {
                return p.alive && p.kingdomId === k.id && (p.occupation === 'soldier' || p.occupation === 'guard');
            }).length;
        }
        var totalBuildings = 0;
        var totalPop = 0;
        for (var _tid of k.territories) {
            var _t = findTown(_tid);
            if (_t) {
                totalBuildings += _t.buildings.length;
                totalPop += _t.population || 0;
            }
        }
        // Monthly upkeep costs
        // C4: Scale soldier cost with army size
        var _fScaleThreshold = CONFIG.MILITARY_MAINTENANCE_SCALE_THRESHOLD || 30;
        var _fScaleRate = CONFIG.MILITARY_MAINTENANCE_SCALE_RATE || 0.02;
        var monthlySoldierCost = soldierCount * CONFIG.KINGDOM_SOLDIER_DAILY_COST;
        if (soldierCount > _fScaleThreshold) {
            var _fExcess = soldierCount - _fScaleThreshold;
            monthlySoldierCost += _fExcess * _fScaleRate * CONFIG.KINGDOM_SOLDIER_DAILY_COST * soldierCount;
        }
        var monthlyBuildingCost = totalBuildings * CONFIG.KINGDOM_BUILDING_DAILY_COST;
        var monthlyUpkeep = monthlySoldierCost + monthlyBuildingCost;

        // Personality-driven reserve multiplier
        // Brilliant/clever kings save more, foolish save less, greedy save almost nothing
        var p = k.kingPersonality || {};
        var reserveMult = 1.0;
        if (p.intelligence === 'brilliant') reserveMult = 1.5;
        else if (p.intelligence === 'clever') reserveMult = 1.25;
        else if (p.intelligence === 'dim') reserveMult = 0.7;
        else if (p.intelligence === 'foolish') reserveMult = 0.4;
        var _taxSeasonLen = (CONFIG && CONFIG.DAYS_PER_SEASON) || 90;
        var _taxSeasonKey = Math.floor((world.day || 0) / _taxSeasonLen);
        var _totalSeasonTax = (k.tradeTaxRevenue || 0) + (k.propertyTaxRevenue || 0) + (k.incomeTaxRevenue || 0) + (k.healthcareTaxRevenue || 0);
        if (k._taxSeasonKey !== _taxSeasonKey) {
            if (k._taxSeasonTotalBaseline != null) k._lastSeasonTaxRevenue = Math.max(0, _totalSeasonTax - k._taxSeasonTotalBaseline);
            k._taxSeasonTotalBaseline = _totalSeasonTax; // v9p33river329: cumulative tax fields need a season baseline.
            k._taxSeasonKey = _taxSeasonKey;
        }
        var _currentSeasonRevenue = Math.max(0, _totalSeasonTax - (k._taxSeasonTotalBaseline || 0));

        // Greedy kings raid reserves for spending, cautious kings pad them
        if (p.greed === 'greedy' || p.greed === 'corrupt') reserveMult *= 0.6;
        else if (p.greed === 'generous') reserveMult *= 0.9;
        if (p.courage === 'cautious') reserveMult *= 1.2;

        // Base reserve = 3 months building upkeep + 3 months soldier upkeep
        var minReserve = Math.floor((totalBuildings * 30 + soldierCount * 90) * reserveMult);

        // Spending thresholds (H-3 priority system)
        var atWar = k.atWar && k.atWar.size > 0;
        return {
            soldierCount: soldierCount,
            totalBuildings: totalBuildings,
            totalPop: totalPop,
            monthlyUpkeep: monthlyUpkeep,
            monthlySoldierCost: monthlySoldierCost,
            monthlyBuildingCost: monthlyBuildingCost,
            minReserve: minReserve,
            reserveMult: reserveMult,
            atWar: atWar,
            lastSeasonRevenue: k._lastSeasonTaxRevenue || 0,
            // H-3 spending thresholds
            canConstruct: k.gold > monthlyUpkeep * 3 || atWar,         // 3 months upkeep for peacetime construction
            canHireGuards: k.gold > monthlyUpkeep * 6 && !atWar,       // 6 months upkeep, NOT during war
            canFestival: k.gold > monthlyUpkeep * 12,                   // 12 months upkeep for festivals/tournaments/public works
            // C-1 guard cap: 3% of total population
            maxGuards: Math.max(20, Math.floor(totalPop * 0.03)),
            // War budget (H-2): 40% of treasury reserved for military during war
            warBudget: atWar ? Math.floor(k.gold * 0.4) : 0,
            civilianBudget: atWar ? Math.floor(k.gold * 0.6) : k.gold,
            // v9p33river317: bug 13 — current-season tax sum (trade +
            // property + income + healthcare) so callers comparing
            // recent income aren't undercounted by reading only last
            // season's stale total. Use max(current, lastSeason) so
            // mid-season decisions see the higher number.
            currentSeasonRevenue: _currentSeasonRevenue,
            recentRevenue: Math.max(k._lastSeasonTaxRevenue || 0, _currentSeasonRevenue),
        };
    }


    // ---- RANDOM INSPECTIONS DAILY TICK ----
    function tickRandomInspections(k) {
        if (!hasSpecialLaw(k, 'random_inspections')) return;
        var rng = world.rng;

        // Count kingdom guards for daily cost
        var guardCount = 0;
        for (var _gTid of k.territories) {
            var _gTown = findTown(_gTid);
            if (!_gTown) continue;
            var _gPeople = getPeopleInTown(_gTown.id);
            for (var _gi = 0; _gi < _gPeople.length; _gi++) {
                if (_gPeople[_gi].alive && _gPeople[_gi].occupation === 'guard') guardCount++;
            }
        }
        // Daily cost: 1g per guard
        var inspCost = guardCount;
        if (inspCost > 0 && k.gold >= inspCost) {
            k.gold -= inspCost;
        } else if (inspCost > 0) {
            // Cannot afford inspections, skip
            return;
        }

        // For each town in the kingdom, run inspection chance
        for (var _iTid of k.territories) {
            var town = findTown(_iTid);
            if (!town) continue;

            var townSecurity = town.security || 0;
            var inspChance = 0.02 + (townSecurity / 100) * 0.03; // 2-5%
            if (!rng.chance(inspChance)) continue;

            var bannedGoods = (k.laws && k.laws.bannedGoods) || [];
            var restrictedGoods = (k.laws && k.laws.restrictedGoods) || [];
            if (bannedGoods.length === 0 && restrictedGoods.length === 0) continue;

            // Check player if in this town
            if (typeof Player !== 'undefined' && Player.townId === town.id) {
                // Check for forged trade permit bypass
                var pState = Player.state;
                var hasForgeTrade = pState && pState.forgedDocuments && pState.forgedDocuments.trade_permit && pState.forgedDocuments.trade_permit > world.day;
                if (hasForgeTrade) continue; // forged permit bypasses inspection

                var playerInv = Player.inventory;
                if (!playerInv) continue;

                var caughtItem = null;
                var caughtQty = 0;
                var isBanned = false;

                // Check banned goods
                var _playerMilExempt = (typeof Player !== 'undefined' && Player.hasMilitaryExemption) ? Player.hasMilitaryExemption(k.id) : false;
                for (var _bi = 0; _bi < bannedGoods.length; _bi++) {
                    var bg = bannedGoods[_bi];
                    if ((playerInv[bg] || 0) >= 3) {
                        // Military exemption: skip military/horse goods for war allies and nobles
                        if (_playerMilExempt) {
                            var _bgKey = bg.toUpperCase();
                            var _bgRes = (typeof RESOURCE_TYPES !== 'undefined' && RESOURCE_TYPES[_bgKey]) ? RESOURCE_TYPES[_bgKey] : null;
                            if (_bgRes && (_bgRes.category === 'military' || bg === 'horses' || bg === 'saddles')) continue;
                        }
                        caughtItem = bg;
                        caughtQty = playerInv[bg];
                        isBanned = true;
                        break;
                    }
                }

                // Check restricted goods (need license)
                if (!caughtItem) {
                    for (var _ri = 0; _ri < restrictedGoods.length; _ri++) {
                        var rg = restrictedGoods[_ri];
                        if ((playerInv[rg] || 0) >= 3) {
                            // Check license
                            // v9p33river312: licenses are stored as
                            // { resourceId, expiresDay, ... } objects
                            // (player.js:26683), not strings. .includes(rg)
                            // on the object array always returned false,
                            // making the inspector treat every valid
                            // license as missing.
                            var _kLics = pState && pState.licenses && pState.licenses[k.id] ? pState.licenses[k.id] : null;
                            var hasLicense = false;
                            if (_kLics) {
                                for (var _lci = 0; _lci < _kLics.length; _lci++) {
                                    var _lic = _kLics[_lci];
                                    if (_lic && _lic.resourceId === rg && (!_lic.expiresDay || _lic.expiresDay > world.day)) {
                                        hasLicense = true; break;
                                    }
                                }
                            }
                            if (!hasLicense) {
                                caughtItem = rg;
                                caughtQty = playerInv[rg];
                                isBanned = false;
                                break;
                            }
                        }
                    }
                }

                if (caughtItem) {
                    // Confiscate all of that item
                    playerInv[caughtItem] = 0;

                    // Get punishment
                    var punishment = Player.getCrimePunishment(k.id, 'smuggling');
                    var pFine = punishment.fine || 200;
                    var pJail = punishment.jailDays || 5;

                    // Apply penalty
                    Player.applyCorruptPenalty(town, k, pFine, 10, pJail, false, 'smuggling');

                    // Toast
                    var itemLabel = caughtItem.replace(/_/g, ' ');
                    if (typeof UI !== 'undefined' && UI.toast) {
                        UI.toast('🔍 Random inspection! Guards found ' + caughtQty + ' ' + itemLabel + (isBanned ? ' (BANNED)' : ' (no permit)') + '. Confiscated! Fine: ' + pFine + 'g' + (pJail > 0 ? ', Jail: ' + pJail + 'd' : ''), 'danger');
                    }
                    logEvent('🔍 Random inspection in ' + town.name + ': guards found ' + caughtQty + ' ' + itemLabel + ' on ' + (pState.fullName || 'the player') + '. Goods confiscated.', { category: 'crime' });
                }
            }

            // Check elite merchants in town
            var townEMs = (world.eliteMerchants || []).filter(function(em) { return em.alive && em.townId === town.id; });
            for (var _ei = 0; _ei < townEMs.length; _ei++) {
                var em = townEMs[_ei];
                if (!em.inventory) continue;

                var emCaughtItem = null;
                for (var _ebi = 0; _ebi < bannedGoods.length; _ebi++) {
                    if ((em.inventory[bannedGoods[_ebi]] || 0) >= 3) {
                        emCaughtItem = bannedGoods[_ebi]; break;
                    }
                }
                if (!emCaughtItem) {
                    for (var _eri = 0; _eri < restrictedGoods.length; _eri++) {
                        if ((em.inventory[restrictedGoods[_eri]] || 0) >= 3) {
                            emCaughtItem = restrictedGoods[_eri]; break;
                        }
                    }
                }
                if (emCaughtItem) {
                    em.inventory[emCaughtItem] = 0;
                    var emFine = 200;
                    if (k.crimePunishments && k.crimePunishments.smuggling) {
                        emFine = k.crimePunishments.smuggling.fine || 200;
                    }
                    em.gold = Math.max(0, (em.gold || 0) - emFine);
                    k.gold += emFine;
                    logEvent('🔍 Random inspection in ' + town.name + ': guards caught ' + (em.firstName || 'a merchant') + ' with contraband ' + emCaughtItem.replace(/_/g, ' ') + '. Fined ' + emFine + 'g.', { category: 'crime' });
                }
            }
        }
    }

    function tickKingdomFinances(k) {
        var rng = world.rng;
        // Count soldiers and buildings
        const soldiers = (_tickCache.soldiersByKingdom || {})[k.id] || [];
        let totalBuildings = 0;
        for (const townId of k.territories) {
            const town = findTown(townId);
            if (town) totalBuildings += town.buildings.length;
        }

        // Daily costs (deducted from treasury) — mandatory (H-3 priority 1 & 2)
        // C4: Scale military maintenance with army size — above threshold, extra cost per soldier
        var _scaleThreshold = CONFIG.MILITARY_MAINTENANCE_SCALE_THRESHOLD || 30;
        var _scaleRate = CONFIG.MILITARY_MAINTENANCE_SCALE_RATE || 0.02;
        var _baseSoldierCost = soldiers.length * CONFIG.KINGDOM_SOLDIER_DAILY_COST / 30;
        var _scaledExtra = 0;
        if (soldiers.length > _scaleThreshold) {
            var _excess = soldiers.length - _scaleThreshold;
            _scaledExtra = _excess * _scaleRate * CONFIG.KINGDOM_SOLDIER_DAILY_COST / 30 * soldiers.length;
        }
        const soldierCost = _baseSoldierCost + _scaledExtra;
        const buildingCost = totalBuildings * CONFIG.KINGDOM_BUILDING_DAILY_COST / 30;
        k.gold -= (soldierCost + buildingCost);
        // Ledger: record daily costs as weekly aggregate to avoid flooding (every 7 days)
        if (world.day % 7 === 0) {
            if (soldierCost > 0) recordKingdomTransaction(k, 'expense', Math.round(soldierCost * 7), soldiers.length + ' soldiers weekly upkeep', 'soldier_upkeep');
            if (buildingCost > 0) recordKingdomTransaction(k, 'expense', Math.round(buildingCost * 7), totalBuildings + ' buildings weekly upkeep', 'building_upkeep');
        }

        // ---- Kingdom Transport Upkeep (seasonal) ----
        if (k.laws && k.laws.kingdomTransport) {
            var numTowns = 0;
            for (var _ti of k.territories) {
                if (findTown(_ti)) numTowns++;
            }
            var transportCostPerTown = (CONFIG.KINGDOM_TRANSPORT ? CONFIG.KINGDOM_TRANSPORT.baseCostPerTown : 50);
            var transportCost = transportCostPerTown * numTowns;
            if (world.day % 90 === 0) {
                k.gold -= transportCost;
                recordKingdomTransaction(k, 'expense', transportCost, 'Public transport upkeep (' + numTowns + ' towns)', 'transport');
                // v9p33river333: book same-season fare revenue before insolvency cancellation.
                if (k._transportRevenueDay !== world.day) {
                    var _trRate = k.laws.transportRate || 15;
                    var _trTowns = world.towns.filter(function(t) { return t.kingdomId === k.id; });
                    var _trPassengers = 0;
                    for (var _tri = 0; _tri < _trTowns.length; _tri++) {
                        var _trPop = _trTowns[_tri].population || 50;
                        _trPassengers += Math.floor(_trPop * 0.05 * rng.randFloat(0.5, 1.5));
                    }
                    var _trRevenue = _trPassengers * _trRate;
                    k.gold += _trRevenue;
                    k.transportRevenue = (k.transportRevenue || 0) + _trRevenue;
                    k._transportRevenueDay = world.day;
                    if (_trRevenue > 0) recordKingdomTransaction(k, 'income', _trRevenue, 'Public transport fares (' + _trPassengers + ' passengers)', 'transport');
                }
                // If kingdom can't afford, they cancel it
                if (k.gold < 0) {
                    k.laws.kingdomTransport = false;
                    logEvent('📢 ' + k.name + ' can no longer afford public transport services.', { type: 'law_change', kingdomId: k.id });
                }
            }
        }

        // ---- Kingdom Transport Revenue (seasonal) ----
        if (k.laws && k.laws.kingdomTransport && world.day % 90 === 0 && k._transportRevenueDay !== world.day) {
            var rate = k.laws.transportRate || 15;
            var kTowns = world.towns.filter(function(t) { return t.kingdomId === k.id; });

            // Estimate: ~5% of each town's population uses transport per season
            var totalPassengers = 0;
            for (var ti = 0; ti < kTowns.length; ti++) {
                var townPop = kTowns[ti].population || 50;
                var passengers = Math.floor(townPop * 0.05 * rng.randFloat(0.5, 1.5));
                totalPassengers += passengers;
            }
            var revenue = totalPassengers * rate;
            k.gold += revenue;
            k.transportRevenue = (k.transportRevenue || 0) + revenue;
            if (revenue > 0) recordKingdomTransaction(k, 'income', revenue, 'Public transport fares (' + totalPassengers + ' passengers)', 'transport');
        }

        // ---- Periodic Financial Report (every 90 days, for auditing) ----
        if (world.day % 90 === 0) {
            k._financialReport = {
                day: world.day,
                gold: k.gold,
                income: { baseTax: k.taxRevenue || 0, tradeTax: k.tradeTaxRevenue || 0,
                          propertyTax: k.propertyTaxRevenue || 0, incomeTax: k.incomeTaxRevenue || 0 },
                expenses: { soldiers: soldierCost * 30, buildings: buildingCost * 30,
                            // v9p33river306: defensive — k.atWar may be a Set
                            // (raw) or an array (after a Engine.getKingdoms
                            // round-trip). Both forms covered.
                            warSupply: (k.atWar && ((k.atWar.size && k.atWar.size > 0) || (Array.isArray(k.atWar) && k.atWar.length > 0))) ? soldiers.length * (CONFIG.WARTIME_SUPPLY_COST_PER_SOLDIER || 2) * 90 : 0 }
            };
        }

        // ---- Monthly Property Tax Collection ----
        if (!k._lastPropertyTaxDay) k._lastPropertyTaxDay = 0;
        if (world.day - k._lastPropertyTaxDay >= (CONFIG.KINGDOM_PROPERTY_TAX_INTERVAL || 30)) {
            k._lastPropertyTaxDay = world.day;
            collectPropertyTaxes(k);
        }

        // ---- Income Tax Collection (H-1: every 30 days instead of 90, at 1/3 rate) ----
        if (!k._lastIncomeTaxDay) k._lastIncomeTaxDay = 0;
        if (world.day - k._lastIncomeTaxDay >= 30) {
            k._lastIncomeTaxDay = world.day;
            collectIncomeTaxes(k);
        }

        // ---- Smart Financial Strategy (C-2: 7 days during war, 30 during peace, 3 during crisis) ----
        // Skip auto-financial strategy when player is king (player manages finances)
        var _pIsKingFin = false;
        try { _pIsKingFin = Player && Player.isPlayerKing && Player.isPlayerKing() && Player.state && Player.state.kingState && Player.state.kingState.kingdomId === k.id; } catch(e) {}
        if (!_pIsKingFin) {
        if (!k._lastFinancialStrategyDay) k._lastFinancialStrategyDay = 0;
        var finStrategyInterval = k.atWar && k.atWar.size > 0 ? 7 : (CONFIG.KINGDOM_FINANCIAL_STRATEGY_INTERVAL || 30);
        // Emergency: review every 3 days if treasury critically low
        if (k.gold < (CONFIG.KINGDOM_MODERATE_THRESHOLD || 500)) finStrategyInterval = 3;
        else if (k.gold < (CONFIG.KINGDOM_MILD_THRESHOLD || 2000)) finStrategyInterval = Math.min(finStrategyInterval, 10);
        if (world.day - k._lastFinancialStrategyDay >= finStrategyInterval) {
            k._lastFinancialStrategyDay = world.day;
            tickKingdomFinancialStrategy(k);
        }
        }

        // Bankruptcy warning — stored as background data, not toasted
        if (k.gold > 0 && k.gold < CONFIG.KINGDOM_BANKRUPTCY_WARNING_GOLD && !k._bankruptWarned) {
            k._bankruptWarned = true;
            // Record as background gossip instead of toast
            _storeBackgroundGossip('kingdom_finance', '💸 The treasury of ' + k.name + ' is running dangerously low! Only ' + Math.floor(k.gold) + 'g remains.', { kingdomId: k.id });
        }
        if (k.gold > CONFIG.KINGDOM_BANKRUPTCY_WARNING_GOLD * 2) {
            k._bankruptWarned = false;
        }

        if (k.gold <= 0) {
            k.gold = 0;
            if (!k._bankruptDays) k._bankruptDays = 0;
            k._bankruptDays++;

            // First day of bankruptcy
            if (k._bankruptDays === 1) {
                var _isPlayerKingdom = typeof Player !== 'undefined' && Player.citizenshipKingdomId === k.id;
                logEvent(`💸 The Kingdom of ${k.name} is bankrupt! Soldiers go unpaid.`, {
                    type: 'bankruptcy',
                    kingdomId: k.id,
                    cause: k.name + '\'s treasury has been depleted. Expenses (soldier upkeep: ' + Math.round(soldierCost * 30) + 'g/month, buildings: ' + Math.round(buildingCost * 30) + 'g/month) exceed income.',
                    effects: [
                        'Soldiers go unpaid and may desert',
                        'Kingdom happiness decreases (-0.5/day)',
                        'Financial strategy AI will attempt recovery',
                        'Guards and military become unreliable'
                    ]
                }, _isPlayerKingdom ? 'my_kingdom' : 'foreign_kingdoms');
            }

            // Soldiers desert due to non-payment
            for (const s of soldiers) {
                if (world.rng.chance(CONFIG.KINGDOM_BANKRUPTCY_DESERTION_RATE)) {
                    s.occupation = 'laborer';
                    const town = findTown(s.townId);
                    if (town && town.garrison > 0) town.garrison--;
                }
            }

            // Happiness drops during bankruptcy
            for (const townId of k.territories) {
                const town = findTown(townId);
                if (town) {
                    town.happiness = Math.max(0, town.happiness - 0.5);
                }
            }

            // Economic collapse after prolonged bankruptcy (60+ days)
            if (k._bankruptDays >= (CONFIG.KINGDOM_COLLAPSE_TRIGGER_DAYS || 60)) {
                triggerEconomicCollapse(k);
            }

            // Kingdom collapse check after extreme bankruptcy
            if (k._bankruptDays >= CONFIG.KINGDOM_BANKRUPTCY_COLLAPSE_DAYS) {
                const happiness = k.happiness != null ? k.happiness : 50;
                if (happiness < CONFIG.KINGDOM_COLLAPSE_HAPPINESS_THRESHOLD || world.rng.chance(CONFIG.KINGDOM_COLLAPSE_CHANCE)) {
                    triggerKingdomCollapse(k);
                }
            }

            // Periodic warnings
            if (k._bankruptDays === 30) {
                logEvent(`💸 ${k.name} has been bankrupt for a month. Soldiers are deserting!`, {
                    type: 'military_desertion',
                    kingdomId: k.id,
                    cause: k.name + ' cannot pay its soldiers. Treasury: ' + Math.floor(k.gold) + 'g.',
                    effects: [
                        'Soldiers are leaving the army to find paid work',
                        'Kingdom military strength is declining',
                        'Towns may lose garrison protection',
                        'Enemy kingdoms may take advantage of the weakness'
                    ]
                }, _eventKingdomCategory(k.id));
            }
            if (k._bankruptDays === 60) {
                logEvent(`💸 ${k.name} has been bankrupt for two months. The kingdom teeters on collapse!`, { kingdomId: k.id }, _eventKingdomCategory(k.id));
            }
        } else {
            k._bankruptDays = 0;
            // Gradually recover from currency debasement
            if (k._currencyDebased && k._debasementInflation > 0) {
                k._debasementInflation = Math.max(0, k._debasementInflation - 0.001);
                if (k._debasementInflation <= 0) {
                    k._currencyDebased = false;
                    logEvent(`💰 ${k.name}'s currency has stabilized after debasement.`, { kingdomId: k.id, _noToast: true }, _eventKingdomCategory(k.id));
                }
            }
        }
    }

    // ========================================================
    // §19F2  ECONOMIC COLLAPSE SYSTEM
    // ========================================================
    function triggerEconomicCollapse(k) {
        if (k._collapseTriggered) return; // only trigger once
        k._collapseTriggered = true;
        const rng = world.rng;

        logEvent(`🔥 ECONOMIC COLLAPSE in ${k.name}! Riots, famine, and chaos spread!`, {
            type: 'economic_collapse',
            kingdomId: k.id,
            cause: k.name + ' has been bankrupt for ' + (k._bankruptDays || 60) + ' days despite all measures.',
            effects: [
                'Random buildings damaged or destroyed (10-30%)',
                'Food prices spike 300%',
                'Population decreases as people flee',
                '70% of soldiers desert',
                'Crime rate spikes',
                'Merchants flee to other kingdoms'
            ]
        }, _eventKingdomCategory(k.id));

        // 1. RIOTS — damage buildings
        for (const townId of k.territories) {
            const town = findTown(townId);
            if (!town) continue;
            const damageRatio = rng.randFloat(0.10, 0.30);
            const toDamage = Math.max(1, Math.floor(town.buildings.length * damageRatio));
            const shuffled = rng.shuffle([...town.buildings.keys()]);
            for (let i = 0; i < toDamage && i < shuffled.length; i++) {
                const bld = town.buildings[shuffled[i]];
                if (bld) bld.condition = rng.chance(0.3) ? 'destroyed' : 'breaking';
            }
            town.happiness = Math.max(0, town.happiness - 30);
            town.prosperity = Math.max(0, town.prosperity - 20);
        }

        // 2. FAMINE — food prices spike
        for (const townId of k.territories) {
            const town = findTown(townId);
            if (!town) continue;
            const foodTypes = ['bread', 'meat', 'wheat', 'fish', 'eggs', 'poultry'];
            for (const food of foodTypes) {
                if (town.market && town.market.prices && town.market.prices[food]) {
                    // v9p33river333: famine can hit towns without markets.
                    town.market.prices[food] = Math.ceil(town.market.prices[food] * 3.0);
                }
            }
            // Population flight — use killPerson for proper tracking
            const fleeing = Math.floor(town.population * rng.randFloat(0.05, 0.15));
            var fleeablePeople = getPeopleInTown(town.id).filter(function(pp) { return pp.alive; });
            var shuffledFlee = rng.shuffle([...fleeablePeople]);
            var fled = 0;
            for (var fi = 0; fi < shuffledFlee.length && fled < fleeing; fi++) {
                // Move person to a random safe town in another kingdom
                var destKingdoms = world.kingdoms.filter(function(ok) { return ok.id !== k.id; });
                if (destKingdoms.length > 0) {
                    var destK = rng.pick(destKingdoms);
                    // v9p33river131: outposts not valid flee destinations.
                    var destTowns = world.towns.filter(function(dt) { return dt.kingdomId === destK.id && !dt.destroyed && !dt.abandoned && !dt.isOutpost; });
                    if (destTowns.length > 0) {
                        var destTown2 = rng.pick(destTowns);
                        shuffledFlee[fi].townId = destTown2.id;
                        shuffledFlee[fi].kingdomId = destK.id;
                        destTown2.population = (destTown2.population || 0) + 1;
                        town.population = Math.max(10, town.population - 1);
                        if (Engine.moveYoungChildrenWithParent) Engine.moveYoungChildrenWithParent(shuffledFlee[fi], destTown2.id, destK.id);
                        fled++;
                    }
                }
            }
        }

        // 3. MILITARY DECIMATION
        const soldiers = (_tickCache.soldiersByKingdom || {})[k.id] || [];
        const toDesert = Math.floor(soldiers.length * 0.70);
        let deserted = 0;
        for (const s of soldiers) {
            if (deserted >= toDesert) break;
            s.occupation = 'laborer';
            const town = findTown(s.townId);
            if (town && town.garrison > 0) town.garrison = Math.max(0, town.garrison - 1);
            deserted++;
        }

        // 4. CRIME SPIKE
        for (const townId of k.territories) {
            const town = findTown(townId);
            if (town) town.security = Math.max(5, (town.security || 50) - 50);
        }

        // 5. MERCHANT EXODUS — NPCs with gold flee
        const merchants = ((_tickCache.merchantsByKingdom || {})[k.id] || []).filter(m =>
            m.gold > 100
        );
        for (const m of merchants) {
            if (rng.chance(0.4)) {
                // Find a neighboring kingdom town to flee to (skip outposts)
                const safeTowns = world.towns.filter(t => t.kingdomId !== k.id && !t.isOutpost && !t.destroyed && !t.abandoned);
                if (safeTowns.length > 0) {
                    const dest = rng.pick(safeTowns);
                    m.townId = dest.id;
                    m.kingdomId = dest.kingdomId;
                    if (Engine.moveYoungChildrenWithParent) Engine.moveYoungChildrenWithParent(m, dest.id, dest.kingdomId);
                }
            }
        }

        // 6. INFRASTRUCTURE DECAY — roads become dangerous
        for (const road of world.roads) {
            const fromT = findTown(road.fromTownId);
            const toT = findTown(road.toTownId);
            if ((fromT && k.territories.has(fromT.id)) || (toT && k.territories.has(toT.id))) {
                road.condition = 'breaking';
                road.banditThreat = Math.min(100, (road.banditThreat || 0) + 40);
            }
        }

        // ---- RESOLUTION PATHS ----
        resolveEconomicCollapse(k);
    }

    function resolveEconomicCollapse(k) {
        const rng = world.rng;

        // Check conditions for each resolution path
        const bestNeighbor = world.kingdoms.filter(o => o.id !== k.id)
            .sort((a, b) => (k.relations[b.id] || 0) - (k.relations[a.id] || 0))[0];
        const bestRelation = bestNeighbor ? (k.relations[bestNeighbor.id] || 0) : -100;

        // Find prominent NPC for revolution
        const prominentNPC = world.people.filter(p =>
            p.alive && p.kingdomId === k.id && p.gold > 200 && p.occupation !== 'soldier'
        ).sort((a, b) => (b.gold || 0) - (a.gold || 0))[0];

        // Find wealthy elite merchant
        const wealthyElite = world.people.filter(e =>
            e.alive && e.isEliteMerchant && e.gold >= 3000
        ).find(e => {
            const eTown = findTown(e.townId);
            return eTown && eTown.kingdomId === k.id;
        });

        // 1. Absorption — neighbor has 60+ relations
        if (bestRelation >= 60 && bestNeighbor) {
            logEvent(`🏰 ${bestNeighbor.name} absorbs the collapsing towns of ${k.name}.`, {
                type: 'kingdom_absorption',
                cause: 'Strong diplomatic ties allow peaceful absorption',
                effects: ['Towns transfer to ' + bestNeighbor.name, 'Citizens gain stability', 'Former king retires']
            });
            const townIds = [...k.territories];
            for (const townId of townIds) {
                const town = findTown(townId);
                if (town) {
                    k.territories.delete(townId);
                    town.kingdomId = bestNeighbor.id;
                    bestNeighbor.territories.add(townId);
                    town.happiness = Math.max(10, town.happiness + 10);
                }
            }
            k._bankruptDays = 0;
            k._collapseTriggered = false;
            return;
        }

        // 2. Revolution — prominent NPC becomes new king
        if (prominentNPC && prominentNPC.gold > 500 && rng.chance(0.5)) {
            const oldKing = findPerson(k.king);
            var _oldKingName = oldKing ? ((oldKing.firstName || '?') + ' ' + (oldKing.lastName || '')) : 'the king';
            var _revLeaderName = (prominentNPC.firstName || '?') + ' ' + (prominentNPC.lastName || '');
            logEvent(`🔥 Revolution in ${k.name}! ${prominentNPC.firstName} ${prominentNPC.lastName} seizes power!`, {
                type: 'revolution',
                kingdomId: k.id,
                cause: 'Citizens overthrow ' + _oldKingName + ' after ' + k.name + ' falls into bankruptcy',
                overthrownKing: _oldKingName,
                overthrownKingId: k.king,
                newKing: _revLeaderName,
                newKingId: prominentNPC.id,
                effects: ['New king installed', 'Debts wiped', 'Kingdom restarts with minimal treasury']
            });
            if (oldKing && oldKing.alive) {
                oldKing.occupation = 'laborer';
                if (oldKing.socialRank) oldKing.socialRank[k.id] = 0;
            }
            k.king = prominentNPC.id;
            prominentNPC.occupation = prominentNPC.sex === 'F' ? 'reigning_queen' : 'king';
            if (!prominentNPC.socialRank) prominentNPC.socialRank = {};
            prominentNPC.socialRank[k.id] = 7;
            // Update old king's spouse
            if (oldKing && oldKing.alive && oldKing.spouseId) {
                var _revOldSpouse = findPerson(oldKing.spouseId);
                if (_revOldSpouse && _revOldSpouse.alive && (_revOldSpouse.occupation === 'queen' || _revOldSpouse.occupation === 'queens_lord')) {
                    _revOldSpouse.occupation = 'noble';
                }
            }
            // Derive new personality from the NPC's actual personality traits
            var _rkp = prominentNPC.personality || {};
            var _rint = _rkp.intelligence || 50;
            var _rwarm = _rkp.warmth || 50;
            var _ramb = _rkp.ambition || 50;
            var _rfrug = _rkp.frugality || 50;
            var _rloy = _rkp.loyalty || 50;
            var _rhon = _rkp.honesty || 50;
            k.kingPersonality = {
                generosity: _rwarm >= 60 ? 'generous' : _rwarm >= 40 ? 'fair' : 'greedy',
                militarism: _ramb >= 70 ? 'aggressive' : _rloy >= 60 ? 'defensive' : 'peaceful',
                justice: _rhon >= 60 ? 'just' : 'pragmatic',
                tradition: _rint >= 60 ? 'progressive' : 'moderate',
                icon: '⚔️',
                intelligence: _rint >= 80 ? 'brilliant' : _rint >= 60 ? 'clever' : _rint >= 40 ? 'average' : _rint >= 20 ? 'dim' : 'foolish',
                temperament: _rwarm >= 75 ? 'kind' : _rwarm >= 50 ? 'fair' : _rwarm >= 25 ? 'stern' : 'cruel',
                ambition: _ramb >= 70 ? 'ambitious' : _ramb >= 35 ? 'content' : 'lazy',
                greed: _rhon >= 70 && _rfrug >= 60 ? 'generous' : _rhon >= 45 ? 'fair' : _rfrug <= 30 ? 'corrupt' : 'greedy',
                courage: _rloy >= 65 && _ramb >= 50 ? 'brave' : _rloy >= 35 ? 'cautious' : 'cowardly',
            };
            k.gold = Math.max(500, Math.floor(prominentNPC.gold * 0.5));
            prominentNPC.gold = Math.max(500, Math.floor(prominentNPC.gold * 0.5)); // Keep half for the NPC
            k._bankruptDays = 0;
            k._collapseTriggered = false;
            k.taxRate = 0.10; // reset to moderate
            k.happiness = 30;
            return;
        }

        // 3. Elite Merchant Bailout
        if (wealthyElite) {
            const bailoutAmount = Math.min(wealthyElite.gold, 3000);
            wealthyElite.gold -= bailoutAmount;
            k.gold += bailoutAmount;
            logEvent(`💰 ${wealthyElite.firstName} ${wealthyElite.lastName} bails out ${k.name} with ${bailoutAmount}g!`, {
                type: 'merchant_bailout',
                cause: 'Wealthy merchant saves kingdom from total collapse',
                effects: ['Kingdom survives', 'Merchant gains huge political influence', 'Economy slowly recovers']
            });
            k._bankruptDays = 0;
            k._collapseTriggered = false;
            k.happiness = Math.max(20, k.happiness);
            return;
        }

        // 4. Fragmentation — kingdom splits
        if (k.territories.size >= 4) {
            logEvent(`💔 ${k.name} fragments! Towns break away to form a new kingdom.`, {
                type: 'kingdom_fragmentation',
                cause: 'No one can hold the kingdom together',
                effects: ['Kingdom splits into smaller territories', 'New political entities emerge']
            });
            // Transfer half the towns to the strongest neighbor
            const townIds = [...k.territories];
            const halfCount = Math.floor(townIds.length / 2);
            if (bestNeighbor) {
                for (let i = 0; i < halfCount; i++) {
                    const town = findTown(townIds[i]);
                    if (town) {
                        k.territories.delete(townIds[i]);
                        town.kingdomId = bestNeighbor.id;
                        bestNeighbor.territories.add(townIds[i]);
                    }
                }
                bestNeighbor.relations[k.id] = Math.min(100, (bestNeighbor.relations[k.id] || 0) + 20);
            }
            k._bankruptDays = Math.floor(k._bankruptDays * 0.5);
            k._collapseTriggered = false;
            k.gold += 500; // surviving towns pool resources
            return;
        }

        // Fallback — towns absorbed by strongest neighbor (old collapse behavior)
        k._collapseTriggered = false;
    }

    function triggerKingdomCollapse(k) {
        logEvent(`👑💀 The Kingdom of ${k.name} has COLLAPSED! Towns declare independence!`, {
            type: 'kingdom_collapse',
            cause: k.name + ' has been bankrupt too long and its people have lost all faith in the crown.',
            effects: [
                'All towns declare independence',
                'Soldiers disbanded',
                'Former towns may be absorbed by neighboring kingdoms',
                'Trade routes become unsafe',
                'A power vacuum emerges in the region'
            ]
        }, 'sensitive_intel');

        // All towns become independent (assigned to strongest neighbor or none)
        const townIds = [...k.territories];
        for (const townId of townIds) {
            const town = findTown(townId);
            if (!town) continue;

            // Find strongest neighboring kingdom
            let bestK = null;
            let bestStr = 0;
            for (const otherK of world.kingdoms) {
                if (otherK.id === k.id) continue;
                const str = computeMilitaryStrength(otherK);
                // Check if they have a town nearby
                const hasNearby = world.towns.some(t =>
                    t.kingdomId === otherK.id && Math.hypot(t.x - town.x, t.y - town.y) < 2000
                );
                if (hasNearby && str > bestStr) {
                    bestStr = str;
                    bestK = otherK;
                }
            }

            k.territories.delete(townId);
            if (bestK) {
                town.kingdomId = bestK.id;
                bestK.territories.add(townId);
                logEvent(`${town.name} has been absorbed by ${bestK.name}.`);
            }
            // If no neighbor, town stays with collapsed kingdom (weakened state)

            town.happiness = Math.max(0, town.happiness - 20);
            town.prosperity = Math.max(0, town.prosperity - 15);
        }

        // Soldiers become laborers
        const soldiers = (_tickCache.soldiersByKingdom || {})[k.id] || [];
        for (const s of soldiers) {
            s.occupation = 'laborer';
            const town = findTown(s.townId);
            if (town && town.garrison > 0) town.garrison = Math.max(0, town.garrison - 1);
        }

        // Reset kingdom state
        k.gold = 0;
        k._bankruptDays = 0;
        k._collapseTriggered = false;
        k.happiness = 10;
    }

    // v9p33river338: policy-only variant for callers (like Player buy/sell)
    // that already compute and credit the kingdom tax revenue themselves.
    // Returns { subsidyAwarded, restrictedAmount } — applies subsidy and
    // export-restriction effects without re-collecting tax. Caller credits
    // the subsidy to the merchant/player.
    function applyTradePolicyOnly(kingdomId, amount, goodId, isImport) {
        if (!world || !kingdomId || amount <= 0) return { subsidyAwarded: 0, restrictedAmount: amount };
        const k = findKingdom(kingdomId);
        if (!k) return { subsidyAwarded: 0, restrictedAmount: amount };
        let _restrictedAmount = amount;
        if (goodId && k.exportRestrictions && k.exportRestrictions.includes(goodId)) {
            _restrictedAmount = Math.floor(amount * 0.5);
        }
        const _isImport = (isImport === undefined) ? true : !!isImport;
        let _subsidyAwarded = 0;
        if (_isImport && goodId && k.tradeSubsidies) {
            for (const sub of k.tradeSubsidies) {
                if (sub.good === goodId && (sub.unitsPaid || 0) < sub.maxUnits && sub.expiresDay > world.day) {
                    const bonus = sub.bonusPerUnit || CONFIG.KING_TRADE_SUBSIDY_PER_UNIT || 2;
                    if (k.gold >= bonus) {
                        k.gold -= bonus;
                        sub.unitsPaid = (sub.unitsPaid || 0) + 1;
                        _subsidyAwarded += bonus;
                        recordKingdomTransaction(k, 'expense', bonus, 'Trade subsidy (' + goodId + ')', 'subsidies');
                    }
                }
            }
        }
        return { subsidyAwarded: _subsidyAwarded, restrictedAmount: _restrictedAmount };
    }

    // ── Exports ──
    Engine.collectTradeTax = collectTradeTax;
    Engine.applyTradePolicyOnly = applyTradePolicyOnly;
    Engine.tickKingdomFinances = tickKingdomFinances;
    Engine.tickRandomInspections = tickRandomInspections;
    Engine.getKingdomFinancialState = getKingdomFinancialState;
    Engine.recordKingdomTransaction = recordKingdomTransaction;
    Engine.getKingdomLedger = getKingdomLedger;
    Engine.getKingdomLedgerSummary = getKingdomLedgerSummary;

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

    // ── Export functions needed by other modules ──
    Engine.tickKingdomFinancialStrategy = tickKingdomFinancialStrategy;
    Engine.triggerEconomicCollapse = triggerEconomicCollapse;
})(window.Engine);

