(function(Player) {
    "use strict";
    if (!Player) throw new Error("Player must be loaded before player_health.js");

    var player;
    function _sync() { player = Player.state; }

    // Aliases for Player functions used by this module
    var hasSkill = Player.hasSkill;
    var handlePlayerDeath = Player.handlePlayerDeath;
    var grantXP = Player.grantXP;
    var modifyRelationship = Player.modifyRelationship;
    var initSpouseAI = Player.initSpouseAI;
    var recordJournalEntry = Player.recordJournalEntry;
    var getHousingDiseaseReduction = Player.getHousingDiseaseReduction;
    // v9p33river334: tolerate older Player builds that do not expose health helper lists yet.
    var INJURY_TYPES = Player.getInjuryTypes ? Player.getInjuryTypes() : [];
    var ILLNESS_TYPES = Player.getIllnessTypes ? Player.getIllnessTypes() : [];
    var NURSE_RANKS = Player.getNurseRanks ? Player.getNurseRanks() : [];
    if (!Array.isArray(INJURY_TYPES)) INJURY_TYPES = [];
    if (!Array.isArray(ILLNESS_TYPES)) ILLNESS_TYPES = [];
    if (!Array.isArray(NURSE_RANKS)) NURSE_RANKS = [];

    function _ensureConditionLists() {
        // v9p33river334: legacy/inherited saves may omit health condition arrays.
        if (!Array.isArray(player.injuries)) player.injuries = [];
        if (!Array.isArray(player.illnesses)) player.illnesses = [];
    }
    // ========================================================
    // §11.10 INJURY & ILLNESS SYSTEM
    // ========================================================

    // Health impact when first getting a condition
    var _CONDITION_HEALTH_HIT = { minor: 5, moderate: 10, severe: 20 };
    // Daily health drain while condition is active
    var _CONDITION_DAILY_DRAIN = { minor: 1, moderate: 3, severe: 8 };

    function _applyConditionHealthHit(severity) {
        _sync();
        var hit = _CONDITION_HEALTH_HIT[severity] || 0;
        if (hit > 0) {
            player.health = Math.max(0, (player.health || 100) - hit);
            if (player.health <= 0 && !window._godInvincible) {
                player.deathCause = 'Succumbed to ' + severity + ' injuries/illness';
                Engine.logEvent('💀 ' + player.fullName + ' died from their injuries/illness.', null, 'illness');
                if (typeof UI !== 'undefined' && UI.toast) UI.toast('☠️ You have died!', 'danger', 'critical');
                handlePlayerDeath();
            }
        }
    }

    function inflictRandomInjury(source) {
        _sync();
        _ensureConditionLists();
        const rng = Engine.getRng();
        if (!rng || INJURY_TYPES.length === 0) return;
        const type = INJURY_TYPES[rng.randInt(0, INJURY_TYPES.length - 1)];
        if (!type) return;
        let severity = type.severity;
        // Existing injuries increase chance of getting a worse injury
        const existingCount = player.injuries.length;
        if (existingCount > 0 && rng.random() < 0.15 * existingCount) {
            // Bump severity: minor→moderate, moderate→severe
            if (severity === 'minor') severity = 'moderate';
            else if (severity === 'moderate') severity = 'severe';
        }
        const injury = {
            type: type.id,
            name: type.name,
            severity: severity,
            dayOccurred: Engine.getDay(),
            treated: false,
            healDay: Engine.getDay() + type.healDays,
            source: source || 'unknown'
        };
        player.injuries.push(injury);
        _applyConditionHealthHit(severity);
        Engine.logEvent(`${player.fullName} sustained ${type.name} (${severity}).`, null, 'illness');

        // Journal — injury
        recordJournalEntry('injury', 'Suffered a ' + type.name + ' (' + severity + ') from ' + (source || 'an unfortunate incident') + '. Recovery will take some days.', { mood: 'weary' });

        if (typeof UI !== 'undefined' && UI.toast) {
            UI.toast(`🩹 Injury: ${type.name} (${severity})`, 'danger');
        }
    }

    function tickPlayerIllnessExposure() {
        _sync();
        if (!player.townId || player.traveling) return;
        if (player.illnesses && player.illnesses.length > 0) return; // already sick
        // v9p33river306: Story mode flags.suppressDisease was honored by
        // inflictRandomIllness but NOT by the exposure tick — the player
        // could still pick up illness from sick townsfolk during scripted
        // story sequences. Honor the flag here too.
        if (player.storyMode && player.storyMode.active && player.storyMode.flags && player.storyMode.flags.suppressDisease) return;
        var rng = Engine.getRng();
        if (!rng) return;
        var day = Engine.getDay();

        // Check every day

        try {
            var w = Engine.getWorld();
            if (!w || !w.people) return;
            var townPeople = w.people.filter(function(p) { return p.alive && p.townId === player.townId; });
            if (townPeople.length === 0) return;
            var sickCount = 0;
            var contagiousSick = {};
            for (var i = 0; i < townPeople.length; i++) {
                if (townPeople[i].sick) {
                    sickCount++;
                    var ill = townPeople[i].illness;
                    if (ill === 'plague' || ill === 'cold' || ill === 'flu') {
                        if (!contagiousSick[ill]) contagiousSick[ill] = 0;
                        contagiousSick[ill]++;
                    }
                }
            }
            if (sickCount === 0) return;

            var pop = townPeople.length;
            // Housing protection
            var housingProtection = getHousingDiseaseReduction();
            // Medical skills give protection
            var skillProtection = 0;
            if (hasSkill('doctor')) skillProtection += 0.3;
            else if (hasSkill('first_aid')) skillProtection += 0.15;
            else if (hasSkill('field_medic')) skillProtection += 0.10;
            var protectionMult = Math.max(0.1, 1.0 - housingProtection - skillProtection);

            for (var illId in contagiousSick) {
                // Early-game plague protection: immune to plague before day 90
                if (illId === 'plague' && Engine.getDay() <= 90) continue;
                var illSickRatio = contagiousSick[illId] / pop;
                // Player exposure rate: lower than NPC contagion (player takes more precautions)
                var exposureChance = illSickRatio * 0.03 * protectionMult;
                if (illId === 'plague') {
                    exposureChance *= 2; // plague is more aggressive
                    if (Engine.getDay() <= 180) exposureChance *= 0.25; // reduced in early game
                }

                if (rng.chance(exposureChance)) {
                    // Map NPC illness to player illness type
                    var playerIllId = null;
                    if (illId === 'plague') playerIllId = 'plague';
                    else if (illId === 'flu' || illId === 'cold') playerIllId = 'common_cold';
                    if (playerIllId) {
                        inflictSpecificIllness(playerIllId, 'town_exposure');
                    }
                    break; // only one illness per tick
                }
            }
        } catch(e) {}
    }

    function inflictRandomIllness(source) {
        _sync();
        _ensureConditionLists();
        // Story Mode: suppress random diseases
        if (player.storyMode && player.storyMode.active && player.storyMode.flags && player.storyMode.flags.suppressDisease) return;
        const rng = Engine.getRng();
        if (!rng) return;
        // Housing disease resistance — player's primary home reduces illness chance
        var dReduction = getHousingDiseaseReduction();
        if (dReduction > 0 && rng.chance(dReduction)) {
            Engine.logEvent(player.fullName + '\'s housing protected them from illness.', { _noToast: true }, 'illness');
            return;
        }
        // Filter out specialty illnesses from random pool (waterlogged_fever is sea-only, infection is combat-only)
        var randomPool = ILLNESS_TYPES.filter(function(t) { return t.id !== 'waterlogged_fever' && t.id !== 'infection'; });
        if (randomPool.length === 0) return; // v9p33river334: malformed/empty illness data leaves no safe random pick.
        const type = randomPool[rng.randInt(0, randomPool.length - 1)];
        const illness = {
            type: type.id,
            name: type.name,
            severity: type.severity,
            dayOccurred: Engine.getDay(),
            treated: false,
            healDay: Engine.getDay() + type.healDays,
            source: source || 'unknown'
        };
        player.illnesses.push(illness);
        _applyConditionHealthHit(type.severity);
        Engine.logEvent(`${player.fullName} contracted ${type.name} (${type.severity}).`, null, 'illness');
        if (typeof UI !== 'undefined' && UI.toast) {
            UI.toast(`🤒 Illness: ${type.name} (${type.severity})`, 'warning');
        }
    }

    function inflictSpecificIllness(illnessId, source) {
        _sync();
        _ensureConditionLists();
        const type = ILLNESS_TYPES.find(t => t.id === illnessId);
        if (!type) return;
        // Housing disease resistance
        var dReduction = getHousingDiseaseReduction();
        var rng = Engine.getRng();
        if (dReduction > 0 && rng && rng.chance(dReduction)) {
            Engine.logEvent(player.fullName + '\'s housing protected them from ' + type.name + '.', { _noToast: true }, 'illness');
            return;
        }
        const illness = {
            type: type.id,
            name: type.name,
            severity: type.severity,
            dayOccurred: Engine.getDay(),
            treated: false,
            healDay: Engine.getDay() + type.healDays,
            source: source || 'unknown'
        };
        player.illnesses.push(illness);
        _applyConditionHealthHit(type.severity);
        Engine.logEvent(`${player.fullName} contracted ${type.name}.`, null, 'illness');
        if (typeof UI !== 'undefined' && UI.toast) {
            UI.toast(`🤒 Illness: ${type.name}`, 'warning');
        }
    }

    function visitHospital(conditionIndex, isIllness) {
        _sync();
        _ensureConditionLists();
        const town = Engine.findTown(player.townId);
        if (!town) return { success: false, message: 'Not in a town.' };

        // Find the actual hospital building
        var hospBld = null;
        if (town.buildings) {
            for (var _hbi = 0; _hbi < town.buildings.length; _hbi++) {
                if (town.buildings[_hbi].type === 'hospital') { hospBld = town.buildings[_hbi]; break; }
            }
        }
        if (!hospBld) return { success: false, message: 'No hospital in this town. Try a city or capital.' };

        const list = isIllness ? player.illnesses : player.injuries;
        if (conditionIndex < 0 || conditionIndex >= list.length) return { success: false, message: 'Invalid condition.' };

        const condition = list[conditionIndex];
        const typeDef = isIllness
            ? ILLNESS_TYPES.find(t => t.id === condition.type)
            : INJURY_TYPES.find(t => t.id === condition.type);
        var effectiveTypeDef = typeDef || { id: condition.type, name: condition.name || 'Unknown', severity: condition.severity || 'minor', healDays: condition.severity === 'severe' ? 15 : condition.severity === 'moderate' ? 7 : 3, product: 'antidote', productCost: condition.severity === 'severe' ? 30 : condition.severity === 'moderate' ? 15 : 8 };

        // Get AI-driven fee from the hospital
        var fees = Engine.getHospitalFees ? Engine.getHospitalFees(player.townId) : null;
        var hospInfo = fees ? (fees.hospital || fees.clinic) : null;
        var cost = hospInfo && hospInfo.fees ? (hospInfo.fees[condition.severity] || getHospitalCost(effectiveTypeDef, condition.severity)) : getHospitalCost(effectiveTypeDef, condition.severity);
        if (player.gold < cost) return { success: false, message: 'Not enough gold. Hospital costs ' + cost + 'g.' };

        // Treatment processing time
        var treatTicks = CONFIG.TREATMENT_TICKS ? (CONFIG.TREATMENT_TICKS[condition.severity] || 25) : 25;
        if (typeof NPC_HEALTH_CONFIG !== 'undefined' && NPC_HEALTH_CONFIG.TREATMENT_TICKS) {
            treatTicks = NPC_HEALTH_CONFIG.TREATMENT_TICKS[condition.severity] || treatTicks;
        }

        // Queue wait time — player must wait in line
        var _queue = hospBld._treatmentQueue || [];
        var _wCount = (hospBld.workers && hospBld.workers.length) || 0;
        // Hospital: 4 simultaneous patients per 2 workers (floor division)
        var _maxH = Math.max(1, Math.floor(_wCount / 2) * 4);
        // Odd workers: 10% faster treatment
        var _oddWorkerBonus = (_wCount % 2 === 1) ? 0.9 : 1.0;
        treatTicks = Math.max(1, Math.floor(treatTicks * _oddWorkerBonus));
        var _playerIsNoble = player.isNoble || (player.socialRank && player.socialRank[town.kingdomId] >= 4);
        // v9p33river245: player owns this hospital → skip queue (own house, own rules)
        var _playerOwnsHosp = (hospBld.ownerId === 'player');
        var _queueWaitTicks = 0;
        if (!_playerIsNoble && !_playerOwnsHosp) {
            // Non-nobles wait behind everyone in queue
            var _patientsAhead = _queue.length;
            _queueWaitTicks = Math.max(0, Math.ceil((_patientsAhead / _maxH) * 30)); // ~30 ticks per batch ahead
        }
        // else: nobles or owners skip to front, no wait

        var totalTicks = treatTicks + _queueWaitTicks;

        _consumeMedicalSupplies(town, condition.severity, isIllness);

        if (typeof Game !== 'undefined' && Game.advanceTicks) Game.advanceTicks(totalTicks);

        player.gold -= cost;
        player.stats.totalGoldSpent += cost;

        _payHealthcareRevenue(town, cost, 'hospital');

        // Track stats on building
        if (!hospBld._treatmentStats) hospBld._treatmentStats = { treated: 0, feeEarned: 0, supplyCost: 0 };
        hospBld._treatmentStats.treated++;
        hospBld._treatmentStats.feeEarned += cost;

        // 20% chance treatment didn't work
        var rng = Engine.getRng();
        if (rng.chance(0.20)) {
            // Treatment failed — condition remains, gold still spent
            var waitDesc2 = _queueWaitTicks > 0 ? ', waited ~' + Math.round(_queueWaitTicks / 60 * 10) / 10 + ' days in queue' : '';
            Engine.logEvent('🏥 ' + player.fullName + ' was treated at the hospital for ' + condition.name + ' but the treatment was not effective. (' + cost + 'g spent)', null, 'illness');
            return { success: true, treatmentFailed: true, message: 'Treatment for ' + condition.name + ' was not effective. The hospital could not cure it this time. (' + cost + 'g spent)' + waitDesc2 };
        }

        list.splice(conditionIndex, 1);

        var waitDesc = _queueWaitTicks > 0 ? ', waited ~' + Math.round(_queueWaitTicks / 60 * 10) / 10 + ' days in queue' : '';
        var timeDesc = totalTicks <= 10 ? 'a quick visit' : totalTicks <= 60 ? 'half a day' : '~' + (Math.round(totalTicks / 60 * 10) / 10) + ' days';
        Engine.logEvent(player.fullName + ' was treated at the hospital for ' + condition.name + ' (' + cost + 'g, ' + timeDesc + ').' + (_playerOwnsHosp ? ' 🏥 Owner priority — skipped the queue.' : (_playerIsNoble ? ' Noble priority — skipped the queue.' : '')), null, 'illness');
        return { success: true, message: 'Treated ' + condition.name + ' at the hospital for ' + cost + 'g (' + timeDesc + ').' + waitDesc + (_playerOwnsHosp ? ' 🏥 Owner priority.' : (_playerIsNoble ? ' 👑 Noble priority.' : '')) };
    }

    function visitClinic(conditionIndex, isIllness) {
        _sync();
        _ensureConditionLists();
        const town = Engine.findTown(player.townId);
        if (!town) return { success: false, message: 'Not in a town.' };

        // Find the actual clinic building
        var clinicBld = null;
        if (town.buildings) {
            for (var _cbi = 0; _cbi < town.buildings.length; _cbi++) {
                if (town.buildings[_cbi].type === 'clinic') { clinicBld = town.buildings[_cbi]; break; }
            }
        }
        if (!clinicBld) return { success: false, message: 'No clinic in this town.' };

        const list = isIllness ? player.illnesses : player.injuries;
        if (conditionIndex < 0 || conditionIndex >= list.length) return { success: false, message: 'Invalid condition.' };

        const condition = list[conditionIndex];

        const typeDef = isIllness
            ? ILLNESS_TYPES.find(t => t.id === condition.type)
            : INJURY_TYPES.find(t => t.id === condition.type);
        var effectiveTypeDef = typeDef || {
            id: condition.type,
            name: condition.name || 'Unknown',
            severity: condition.severity || 'minor',
            // v9p33river306: was hard-coded `condition.severity === 'moderate' ? 7 : 3`
            // — anything other than 'moderate' (serious, severe, major)
            // fell back to a minor 3-day case with low product cost,
            // undertreating real conditions. Scale by actual severity.
            healDays: condition.severity === 'severe' ? 21
                    : condition.severity === 'major' ? 15
                    : condition.severity === 'serious' ? 14
                    : condition.severity === 'moderate' ? 7 : 3,
            product: 'antidote',
            productCost: condition.severity === 'severe' ? 60
                       : condition.severity === 'major' ? 40
                       : condition.severity === 'serious' ? 30
                       : condition.severity === 'moderate' ? 15 : 8
        };

        // Get AI-driven fee from the clinic
        var fees = Engine.getHospitalFees ? Engine.getHospitalFees(player.townId) : null;
        var clinicInfo = fees ? fees.clinic : null;
        var cost = clinicInfo && clinicInfo.fees ? (clinicInfo.fees[condition.severity] || getClinicCost(effectiveTypeDef, condition.severity)) : getClinicCost(effectiveTypeDef, condition.severity);
        if (player.gold < cost) return { success: false, message: 'Not enough gold. Clinic costs ' + cost + 'g.' };

        var treatTicks = 5;
        if (typeof NPC_HEALTH_CONFIG !== 'undefined' && NPC_HEALTH_CONFIG.TREATMENT_TICKS) {
            treatTicks = NPC_HEALTH_CONFIG.TREATMENT_TICKS[condition.severity] || 5;
        }
        // Clinic takes 2x longer than hospital for all severities
        treatTicks = treatTicks * 2;

        // Queue wait time — player must wait in line
        var _queue = clinicBld._treatmentQueue || [];
        var _wCount = (clinicBld.workers && clinicBld.workers.length) || 0;
        // Clinic: 2 simultaneous patients per 2 workers (floor division)
        var _maxH = Math.max(1, Math.floor(_wCount / 2) * 2);
        // Odd workers: 10% faster treatment
        var _oddWorkerBonus = (_wCount % 2 === 1) ? 0.9 : 1.0;
        treatTicks = Math.max(1, Math.floor(treatTicks * _oddWorkerBonus));
        var _playerIsNoble = player.isNoble || (player.socialRank && player.socialRank[town.kingdomId] >= 4);
        // v9p33river245: player owns this clinic → skip queue
        var _playerOwnsClinic = (clinicBld.ownerId === 'player');
        var _queueWaitTicks = 0;
        if (!_playerIsNoble && !_playerOwnsClinic) {
            var _patientsAhead = _queue.length;
            _queueWaitTicks = Math.max(0, Math.ceil((_patientsAhead / _maxH) * 30));
        }

        var totalTicks = treatTicks + _queueWaitTicks;

        _consumeMedicalSupplies(town, condition.severity, isIllness);

        if (typeof Game !== 'undefined' && Game.advanceTicks) Game.advanceTicks(totalTicks);

        player.gold -= cost;
        player.stats.totalGoldSpent += cost;

        _payHealthcareRevenue(town, cost, 'clinic');

        // Track stats on building
        if (!clinicBld._treatmentStats) clinicBld._treatmentStats = { treated: 0, feeEarned: 0, supplyCost: 0 };
        clinicBld._treatmentStats.treated++;
        clinicBld._treatmentStats.feeEarned += cost;

        var waitDesc = _queueWaitTicks > 0 ? ', waited ~' + Math.round(_queueWaitTicks / 60 * 10) / 10 + ' days in queue' : '';
        var nobleNote = _playerOwnsClinic ? ' 🏥 Owner priority.' : (_playerIsNoble ? ' 👑 Noble priority.' : '');

        // 20% chance treatment didn't work
        var rng = Engine.getRng();
        if (rng.chance(0.20)) {
            Engine.logEvent(player.fullName + ' was treated at the clinic for ' + condition.name + ' but the treatment was not effective. (' + cost + 'g spent)', null, 'illness');
            return { success: true, treatmentFailed: true, message: 'Treatment for ' + condition.name + ' was not effective at the clinic. (' + cost + 'g spent)' + waitDesc + nobleNote };
        }

        // Clinic fully cures all conditions (time + cost is the tradeoff vs hospital)
        list.splice(conditionIndex, 1);
        var timeDesc = totalTicks <= 10 ? 'a quick visit' : totalTicks <= 60 ? 'half a day' : '~' + (Math.round(totalTicks / 60 * 10) / 10) + ' days';
        Engine.logEvent(player.fullName + ' was treated at the clinic for ' + condition.name + ' (' + cost + 'g, ' + timeDesc + ').' + nobleNote, null, 'illness');
        return { success: true, message: 'Treated ' + condition.name + ' at the clinic for ' + cost + 'g (' + timeDesc + ').' + waitDesc + nobleNote };
    }

    function _findPlayerMedicalBuildingRecord(town, medBld) {
        if (!medBld || !player || !Array.isArray(player.buildings)) return medBld;
        for (var i = 0; i < player.buildings.length; i++) {
            if (medBld.id && player.buildings[i].id === medBld.id) return player.buildings[i];
        }
        if (!town || !Array.isArray(town.buildings)) return medBld;
        var ordinal = 0;
        for (var ti = 0; ti < town.buildings.length; ti++) {
            var tb = town.buildings[ti];
            if (!tb || tb.ownerId !== 'player' || tb.type !== medBld.type) continue;
            if (tb === medBld) break;
            ordinal++;
        }
        var seen = 0;
        for (var pi = 0; pi < player.buildings.length; pi++) {
            var pb = player.buildings[pi];
            if (pb.townId === town.id && pb.type === medBld.type) {
                if (seen === ordinal) return pb;
                seen++;
            }
        }
        return medBld;
    }

    function _payHealthcareRevenue(town, fee, bldType) {
        _sync();
        if (!town) return;
        var kingdom = Engine.findKingdom(town.kingdomId);
        var healthcareTaxRate = (kingdom && kingdom.healthcareTaxRate != null) ? kingdom.healthcareTaxRate : 0.10;
        var taxAmount = Math.floor(fee * healthcareTaxRate);

        // Find the medical building
        // v9p33river311: previously took the first hospital OR clinic
        // found, so if both existed in town the wrong owner could get
        // paid. Callers now pass the specific type used; we prefer
        // that, fall back to either if not provided.
        var medBld = null;
        if (town.buildings) {
            if (bldType) {
                for (var i = 0; i < town.buildings.length; i++) {
                    if (town.buildings[i].type === bldType) { medBld = town.buildings[i]; break; }
                }
            }
            if (!medBld) {
                for (var j = 0; j < town.buildings.length; j++) {
                    if (town.buildings[j].type === 'hospital' || town.buildings[j].type === 'clinic') {
                        medBld = town.buildings[j]; break;
                    }
                }
            }
        }

        var isKingdomOwned = medBld && kingdom && medBld.ownerId === kingdom.id;
        var isPlayerOwned = medBld && medBld.ownerId === 'player';

        if (isKingdomOwned) {
            // Kingdom gets full revenue
            if (kingdom) {
                kingdom.gold = (kingdom.gold || 0) + fee;
                kingdom.healthcareTaxRevenue = (kingdom.healthcareTaxRevenue || 0) + fee;
            }
        } else {
            // Owner keeps fee minus healthcare tax
            var ownerRevenue = fee - taxAmount;
            if (kingdom && taxAmount > 0) {
                kingdom.gold = (kingdom.gold || 0) + taxAmount;
                kingdom.healthcareTaxRevenue = (kingdom.healthcareTaxRevenue || 0) + taxAmount;
            }
            if (isPlayerOwned) {
                var playerMedBld = _findPlayerMedicalBuildingRecord(town, medBld);
                playerMedBld.retailRevenue = (playerMedBld.retailRevenue || 0) + ownerRevenue; // v9p33river329: credit the collectible player-owned medical building ledger.
            } else if (medBld && medBld.ownerId) {
                var owner = Engine.findPerson(medBld.ownerId);
                if (owner && owner.alive) owner.gold = (owner.gold || 0) + ownerRevenue;
            }
        }
    }

    function getHospitalCost(typeDef, severity) {
        var base = (typeDef && typeDef.productCost) ? typeDef.productCost : 10;
        if (severity === 'severe') return base * 8;
        if (severity === 'moderate') return base * 5;
        return base * 3;
    }

    function getClinicCost(typeDef, severity) {
        var base = (typeDef && typeDef.productCost) ? typeDef.productCost : 10;
        if (severity === 'moderate') return base * 3;
        return base * 2;
    }

    function _consumeMedicalSupplies(town, severity, isIllness) {
        if (!town || !town.market || !town.market.supply) return;
        var supply = town.market.supply;
        // v9p33river308: NPC_HEALTH_CONFIG is a top-level const
        // (config.js:3969), not a CONFIG property. Was always falling
        // back to an empty object, so treatment supply definitions were
        // never found and medical supplies were never consumed.
        var _hcCfg = (typeof NPC_HEALTH_CONFIG !== 'undefined') ? NPC_HEALTH_CONFIG : {};
        var supplyDef;
        if (isIllness) {
            supplyDef = (_hcCfg.TREATMENT_SUPPLIES_ILLNESS && _hcCfg.TREATMENT_SUPPLIES_ILLNESS[severity]) || null;
        } else {
            supplyDef = (_hcCfg.TREATMENT_SUPPLIES_INJURY && _hcCfg.TREATMENT_SUPPLIES_INJURY[severity]) || null;
        }
        if (!supplyDef) {
            // Legacy fallback
            supplyDef = (_hcCfg.TREATMENT_SUPPLIES && _hcCfg.TREATMENT_SUPPLIES[severity]) || null;
        }
        if (!supplyDef) return;

        // v9p33river311: was a direct NPC_HEALTH_CONFIG.MEDICINE_RANK read
        // which would ReferenceError if the global wasn't loaded. Use the
        // guarded _hcCfg copy from above.
        var medRank = (_hcCfg && _hcCfg.MEDICINE_RANK) || ['herbal_remedy', 'fever_tonic', 'healing_tonic', 'antidote'];

        for (var key in supplyDef) {
            var needed = supplyDef[key];
            var rankIdx = medRank.indexOf(key);
            var consumed = false;
            // Try exact match first
            if ((supply[key] || 0) >= needed) {
                supply[key] -= needed;
                consumed = true;
            } else if (rankIdx >= 0) {
                // Try higher-tier substitutes
                for (var si = rankIdx + 1; si < medRank.length; si++) {
                    if ((supply[medRank[si]] || 0) >= needed) {
                        supply[medRank[si]] -= needed;
                        consumed = true;
                        break;
                    }
                }
            }
            // If not consumed, treatment still proceeds (shortage)
        }
    }

    function getMedicalFacilities(townId) {
        _sync();
        var town = Engine.findTown(townId || player.townId);
        if (!town) return { hasHospital: false, hasClinic: false };
        var hasHospital = false, hasClinic = false;
        if (town.buildings) {
            for (var i = 0; i < town.buildings.length; i++) {
                var bt = town.buildings[i].type || '';
                if (bt === 'hospital') hasHospital = true;
                if (bt === 'clinic') hasClinic = true;
            }
        }
        return { hasHospital: hasHospital, hasClinic: hasClinic };
    }

    function selfTreat(conditionIndex, isIllness) {
        _sync();
        _ensureConditionLists();
        if (!hasSkill('doctor') && !hasSkill('first_aid') && !hasSkill('field_medic')) return { success: false, message: 'You need First Aid, Field Medic, or Doctor skill to self-treat.' };

        const list = isIllness ? player.illnesses : player.injuries;
        if (conditionIndex < 0 || conditionIndex >= list.length) return { success: false, message: 'Invalid condition.' };

        const condition = list[conditionIndex];
        const typeDef = isIllness
            ? ILLNESS_TYPES.find(t => t.id === condition.type)
            : INJURY_TYPES.find(t => t.id === condition.type);
        var effectiveTypeDef = typeDef || { id: condition.type, name: condition.name || 'Unknown', severity: condition.severity || 'minor', healDays: condition.severity === 'severe' ? 15 : condition.severity === 'moderate' ? 7 : 3, product: isIllness ? 'herbal_remedy' : 'bandages', productCost: 10 };

        // first_aid: only minor injuries/illnesses. field_medic: minor+moderate. doctor: all.
        if (!hasSkill('doctor')) {
            if (condition.severity === 'severe') return { success: false, message: 'Only the Doctor skill can treat severe conditions.' };
            if (condition.severity === 'moderate' && !hasSkill('field_medic')) return { success: false, message: 'Need Field Medic or Doctor skill for moderate conditions.' };
        }

        // Check for product in inventory
        const productId = effectiveTypeDef.product;
        if (!player.inventory[productId] || player.inventory[productId] < 1) {
            return { success: false, message: 'Need ' + productId.replace(/_/g, ' ') + ' in inventory to self-treat.' };
        }

        // Self-treat takes same time as clinic (2x hospital ticks)
        var treatTicks = CONFIG.TREATMENT_TICKS ? (CONFIG.TREATMENT_TICKS[condition.severity] || 15) : 15;
        treatTicks = treatTicks * 2; // clinic rate
        // Doctor skill: faster treatment
        if (hasSkill('doctor')) treatTicks = Math.max(5, Math.floor(treatTicks * 0.6));
        else if (hasSkill('field_medic')) treatTicks = Math.max(5, Math.floor(treatTicks * 0.8));

        if (typeof Game !== 'undefined' && Game.advanceTicks) Game.advanceTicks(treatTicks);

        player.inventory[productId]--;

        // Fully cure the condition (like hospital/clinic)
        list.splice(conditionIndex, 1);
        grantXP(8, 'medical');

        var timeDesc = treatTicks <= 10 ? 'a quick treatment' : treatTicks <= 60 ? 'half a day' : '~' + (Math.round(treatTicks / 60 * 10) / 10) + ' days';
        Engine.logEvent('⚕️ ' + player.fullName + ' self-treated ' + condition.name + ' using ' + productId.replace(/_/g, ' ') + ' (' + timeDesc + ').', null, 'illness');
        return { success: true, message: 'Self-treated ' + condition.name + ' using ' + productId.replace(/_/g, ' ') + '. Fully recovered! (' + timeDesc + ')' };
    }

    // Field Medic skill: treat injured NPCs in town for gold
    function treatOther() {
        _sync();
        if (!hasSkill('field_medic') && !hasSkill('doctor')) {
            return { success: false, message: 'You need the Field Medic or Doctor skill to treat others.' };
        }
        if (player.traveling) return { success: false, message: 'Cannot treat others while traveling.' };

        var town = Engine.findTown(player.townId);
        if (!town) return { success: false, message: 'No town found.' };

        // Find an injured/ill NPC in town
        var people = town.people || [];
        var patient = null;
        for (var i = 0; i < people.length; i++) {
            var p = people[i];
            if (!p || !p.alive) continue;
            if ((p.injuries && p.injuries.length > 0) || (p.illnesses && p.illnesses.length > 0)) {
                patient = p;
                break;
            }
        }

        if (!patient) {
            return { success: false, message: 'No one in town needs medical attention right now.' };
        }

        // Check we have the RIGHT medical supplies for the patient's condition
        var requiredProduct = null;
        var condName = '';
        if (patient.injuries && patient.injuries.length > 0) {
            var pInjType = patient.injuries[0].type || patient.injuries[0].id;
            condName = patient.injuries[0].name || pInjType;
            if (typeof Player !== 'undefined' && Player.getInjuryTypes) {
                var pInjTypes = Player.getInjuryTypes();
                for (var _pi = 0; _pi < pInjTypes.length; _pi++) {
                    if (pInjTypes[_pi].id === pInjType) { requiredProduct = pInjTypes[_pi].product; break; }
                }
            }
        } else if (patient.illnesses && patient.illnesses.length > 0) {
            var pIllType = patient.illnesses[0].type || patient.illnesses[0].id;
            condName = patient.illnesses[0].name || pIllType;
            if (typeof Player !== 'undefined' && Player.getIllnessTypes) {
                var pIllTypes = Player.getIllnessTypes();
                for (var _pil = 0; _pil < pIllTypes.length; _pil++) {
                    if (pIllTypes[_pil].id === pIllType) { requiredProduct = pIllTypes[_pil].product; break; }
                }
            }
        }

        var usedSupply = '';
        if (requiredProduct && player.inventory[requiredProduct] && player.inventory[requiredProduct] > 0) {
            usedSupply = requiredProduct;
        } else if (requiredProduct) {
            var prdName = requiredProduct.replace(/_/g, ' ');
            return { success: false, message: 'You need ' + prdName + ' to treat ' + (condName || 'this condition') + '.' };
        } else {
            // Unknown condition — fallback to any supply
            var fallback = ['bandages', 'herbal_remedy', 'healing_tonic', 'herbal_poultice', 'splint', 'fever_tonic', 'antidote'];
            for (var s = 0; s < fallback.length; s++) {
                if (player.inventory[fallback[s]] && player.inventory[fallback[s]] > 0) {
                    usedSupply = fallback[s]; break;
                }
            }
        }
        if (!usedSupply) {
            return { success: false, message: 'You need medical supplies to treat others.' };
        }

        if (typeof Game !== 'undefined' && Game.advanceTicks) Game.advanceTicks(CONFIG.ACTION_TICK_COSTS.treat_other || 5);

        player.inventory[usedSupply]--;

        // Heal the NPC
        if (patient.injuries && patient.injuries.length > 0) {
            patient.injuries.shift();
            if (patient.injuries.length === 0) {
                patient.injured = false;
                patient.injuryType = null;
                patient.injuryName = null;
                patient.injurySeverity = null;
            }
        } else if (patient.illnesses && patient.illnesses.length > 0) {
            patient.illnesses.shift();
            if (patient.illnesses.length === 0) {
                patient.sick = false;
                patient.illness = null;
                patient.asymptomatic = false;
            }
        } // v9p33river329: clear legacy flags when array conditions are gone.

        // Payment based on skill level
        var basePay = hasSkill('doctor') ? 25 : 15;
        // v9p33river316: nurse pay bonus now reads the actual nurse rank
        // (when player is enlisted as a nurse) instead of using military
        // rank — those two career tracks don't share rank values. Falls
        // back to legacy militaryRank check for backward compatibility.
        var _nurseRank = (player.militaryRole === 'nurse') ? player.militaryRank : null;
        if (_nurseRank && NURSE_RANKS && NURSE_RANKS.indexOf(_nurseRank) !== -1) {
            basePay = Math.floor(basePay * 1.5);
        } else if (NURSE_RANKS && NURSE_RANKS.indexOf(player.militaryRank) !== -1) {
            basePay = Math.floor(basePay * 1.5);
        }
        player.gold += basePay;
        player.stats.totalGoldEarned += basePay;
        grantXP(5, 'medical');

        // Relationship boost
        modifyRelationship(patient.id, 10);

        Engine.logEvent(`⚕️ ${player.fullName} treated ${patient.name || 'a townsperson'} and earned ${basePay}g.`, null, 'illness');
        return { success: true, message: `Treated ${patient.name || 'a townsperson'} using ${usedSupply}. Earned ${basePay}g.` };
    }

    // Treat a companion: spouse (spouseAI system), family member, or personal guard
    // targetType: 'spouse', 'family', 'guard'
    // targetId: NPC id for family/guard, ignored for spouse
    // method: 'player' (use player's medical skill) or 'hospital' (pay for hospital treatment)
    function treatCompanion(targetType, targetId, method) {
        _sync();
        if (player.traveling) return { success: false, message: 'Cannot treat anyone while traveling.' };
        var town = Engine.findTown(player.townId);
        if (!town) return { success: false, message: 'You must be in a town.' };
        var rng = Engine.getRng();

        // Validate method
        if (method === 'player') {
            if (!hasSkill('field_medic') && !hasSkill('doctor')) {
                return { success: false, message: 'You need the Field Medic or Doctor skill to treat others.' };
            }
        } else if (method === 'hospital') {
            var hospBld = null;
            if (town.buildings) {
                for (var _hbi = 0; _hbi < town.buildings.length; _hbi++) {
                    if (town.buildings[_hbi].type === 'hospital' || town.buildings[_hbi].type === 'clinic') {
                        hospBld = town.buildings[_hbi]; break;
                    }
                }
            }
            if (!hospBld) return { success: false, message: 'No hospital or clinic in this town.' };
        } else {
            return { success: false, message: 'Invalid treatment method.' };
        }

        // === SPOUSE (uses spouseAI condition system) ===
        if (targetType === 'spouse') {
            if (!player.spouseId) return { success: false, message: 'You have no spouse.' };
            var spouse = Engine.findPerson(player.spouseId);
            if (!spouse || !spouse.alive) return { success: false, message: 'Spouse not found.' };
            if (spouse.townId !== player.townId) return { success: false, message: 'Your spouse is not in this town.' };
            initSpouseAI();
            var ai = player.spouseAI;
            if (ai.condition === 'healthy') return { success: false, message: spouse.firstName + ' is healthy and does not need treatment.' };

            var condSeverity = ai.condition === 'gravely_ill' ? 'severe' : ai.condition === 'sick' ? 'moderate' : 'moderate';

            if (method === 'player') {
                // Check skill level vs severity
                if (ai.condition === 'gravely_ill' && !hasSkill('doctor')) {
                    return { success: false, message: 'Only the Doctor skill can treat gravely ill patients.' };
                }
                // Need medical supplies — check actual condition on the NPC first
                var spouseSupplies = null;
                var spouseCondName = '';
                if (spouse.illnesses && spouse.illnesses.length > 0) {
                    var spIllType = spouse.illnesses[0].type || spouse.illnesses[0].id;
                    spouseCondName = spouse.illnesses[0].name || spIllType;
                    if (typeof Player !== 'undefined' && Player.getIllnessTypes) {
                        var spIllTypes = Player.getIllnessTypes();
                        for (var _sil = 0; _sil < spIllTypes.length; _sil++) {
                            if (spIllTypes[_sil].id === spIllType) { spouseSupplies = [spIllTypes[_sil].product]; break; }
                        }
                    }
                } else if (spouse.injuries && spouse.injuries.length > 0) {
                    var spInjType = spouse.injuries[0].type || spouse.injuries[0].id;
                    spouseCondName = spouse.injuries[0].name || spInjType;
                    if (typeof Player !== 'undefined' && Player.getInjuryTypes) {
                        var spInjTypes = Player.getInjuryTypes();
                        for (var _sij = 0; _sij < spInjTypes.length; _sij++) {
                            if (spInjTypes[_sij].id === spInjType) { spouseSupplies = [spInjTypes[_sij].product]; break; }
                        }
                    }
                }
                // Fallback to category-based list if no specific product found
                if (!spouseSupplies) {
                    spouseSupplies = ai.condition === 'gravely_ill' ? ['antidote', 'healing_tonic', 'fever_tonic'] :
                                     ai.condition === 'sick' ? ['herbal_remedy', 'fever_tonic', 'antidote'] :
                                     ['bandages', 'herbal_poultice', 'splint'];
                }
                var usedSupply = null;
                for (var si = 0; si < spouseSupplies.length; si++) {
                    if (player.inventory[spouseSupplies[si]] && player.inventory[spouseSupplies[si]] > 0) {
                        usedSupply = spouseSupplies[si]; break;
                    }
                }
                if (!usedSupply) {
                    var supNames = spouseSupplies.map(function(s) { return s.replace(/_/g, ' '); }).join(', ');
                    return { success: false, message: 'Need ' + supNames + ' to treat ' + (spouseCondName || spouse.firstName) + '.' };
                }

                if (typeof Game !== 'undefined' && Game.advanceTicks) Game.advanceTicks(CONFIG.ACTION_TICK_COSTS.treat_other || 5);
                player.inventory[usedSupply]--;
                if (player.inventory[usedSupply] <= 0) delete player.inventory[usedSupply]; // v9p33river430: clean up zero-qty keys

                // Success chance: doctor 90%, field_medic 70%, +5% per intelligence point of player
                var baseChance = hasSkill('doctor') ? 0.90 : 0.70;
                if (ai.condition === 'gravely_ill') baseChance -= 0.15;
                var success = rng.chance(baseChance);

                if (success) {
                    if (ai.condition === 'gravely_ill') {
                        ai.condition = 'sick';
                        ai.sickEndDay = Engine.getDay() + rng.randInt(3, 7);
                        ai.health = Math.min(ai.health + 20, CONFIG.SPOUSE_AI ? CONFIG.SPOUSE_AI.HEALTH_MAX : 100);
                        Engine.logEvent('⚕️ ' + player.fullName + ' treated ' + spouse.firstName + '. Condition stabilized from gravely ill to sick.', null, 'illness');
                    } else if (ai.condition === 'sick') {
                        ai.condition = 'healthy';
                        ai.daysSick = 0;
                        // v9p33river430: clear underlying NPC illness fields so other systems see recovery
                        spouse.illnesses = []; spouse.sick = false; spouse.illness = null;
                        ai.health = Math.min(ai.health + 30, CONFIG.SPOUSE_AI ? CONFIG.SPOUSE_AI.HEALTH_MAX : 100);
                        Engine.logEvent('⚕️ ' + player.fullName + ' treated ' + spouse.firstName + '. Fully recovered!', null, 'illness');
                    } else if (ai.condition === 'injured') {
                        ai.condition = 'healthy';
                        ai.daysInjured = 0;
                        // v9p33river430: clear underlying NPC injury fields so other systems see recovery
                        spouse.injuries = []; spouse.injured = false; spouse.injurySeverity = null; spouse.injuryType = null;
                        ai.health = Math.min(ai.health + 25, CONFIG.SPOUSE_AI ? CONFIG.SPOUSE_AI.HEALTH_MAX : 100);
                        Engine.logEvent('⚕️ ' + player.fullName + ' treated ' + spouse.firstName + '\'s injuries. Fully recovered!', null, 'illness');
                    }
                    grantXP(8, 'medical');
                    modifyRelationship(player.spouseId, 5);
                    return { success: true, message: 'Successfully treated ' + spouse.firstName + ' using ' + usedSupply + '.' };
                } else {
                    ai.health = Math.min(ai.health + 5, CONFIG.SPOUSE_AI ? CONFIG.SPOUSE_AI.HEALTH_MAX : 100);
                    grantXP(3, 'medical');
                    return { success: false, message: 'Treatment of ' + spouse.firstName + ' was not fully effective. Used ' + usedSupply + '. Try again or visit a hospital.' };
                }
            } else {
                // Hospital treatment for spouse — same cost as player, no time advance (companion stays at hospital)
                var fees = Engine.getHospitalFees ? Engine.getHospitalFees(player.townId) : null;
                var hospInfo2 = fees ? (fees.hospital || fees.clinic) : null;
                // v9p33river562: pass the building type actually used so the fee is routed
                // to the correct owner when a town has both a hospital and a clinic.
                var _spBldType = (fees && fees.hospital) ? 'hospital' : 'clinic';
                var cost = hospInfo2 && hospInfo2.fees ? (hospInfo2.fees[condSeverity] || getHospitalCost({ productCost: 10 }, condSeverity)) : getHospitalCost({ productCost: 10 }, condSeverity);
                if (player.gold < cost) return { success: false, message: 'Not enough gold. Hospital costs ' + cost + 'g for ' + spouse.firstName + '.' };

                // No Game.advanceTicks — companion is locked at hospital, player continues
                player.gold -= cost;
                player.stats.totalGoldSpent += cost;
                _payHealthcareRevenue(town, cost, _spBldType);

                // Treatment duration — spouse must stay at hospital
                var spouseTreatDays = condSeverity === 'severe' ? 5 : condSeverity === 'moderate' ? 3 : 1;
                spouse._hospitalTreatmentEndDay = Engine.getDay() + spouseTreatDays;
                spouse._hospitalTownId = player.townId;

                // 20% chance treatment didn't work
                var rng2 = Engine.getRng();
                if (rng2.chance(0.20)) {
                    Engine.logEvent('🏥 ' + spouse.firstName + ' is at the hospital, but the treatment may not be effective. Cost: ' + cost + 'g. They must stay ' + spouseTreatDays + ' day(s).', null, 'illness');
                    spouse._treatmentFailed = true;
                    return { success: true, treatmentFailed: true, message: spouse.firstName + ' sent to hospital (' + cost + 'g). Must stay ' + spouseTreatDays + ' day(s). ⚠️ Treatment may not be effective.' };
                }

                // Hospital always succeeds (when it works)
                ai.condition = 'healthy';
                ai.daysSick = 0;
                ai.daysInjured = 0;
                // v9p33river430: clear underlying NPC illness/injury fields so other systems see recovery
                spouse.illnesses = []; spouse.injuries = []; spouse.sick = false; spouse.injured = false;
                spouse.injurySeverity = null; spouse.injuryType = null; spouse.illness = null;
                ai.health = Math.min(ai.health + 40, CONFIG.SPOUSE_AI ? CONFIG.SPOUSE_AI.HEALTH_MAX : 100);
                modifyRelationship(player.spouseId, 3);
                Engine.logEvent('🏥 ' + spouse.firstName + ' was sent to the hospital for treatment. Cost: ' + cost + 'g. They must stay ' + spouseTreatDays + ' day(s).', null, 'illness');
                return { success: true, message: spouse.firstName + ' sent to hospital (' + cost + 'g). Must stay ' + spouseTreatDays + ' day(s). You may leave without them.' };
            }
        }

        // === FAMILY MEMBER or GUARD (uses standard NPC illness/injury system) ===
        if (targetType === 'family' || targetType === 'guard') {
            var npc = Engine.findPerson(targetId);
            if (!npc || !npc.alive) return { success: false, message: 'Person not found.' };
            if (npc.townId !== player.townId) return { success: false, message: (npc.firstName || 'They') + ' is not in this town.' };

            // Validate they are actually family or guard
            if (targetType === 'family') {
                var isFamily = false;
                if (player.spouseId === targetId) isFamily = true;
                if (player.childrenIds && player.childrenIds.indexOf(targetId) >= 0) isFamily = true;
                if (player.familyMembers) {
                    for (var fm = 0; fm < player.familyMembers.length; fm++) {
                        if (player.familyMembers[fm].npcId === targetId) { isFamily = true; break; }
                    }
                }
                if (!isFamily) return { success: false, message: 'This person is not a family member.' };
            } else {
                var isGuard = false;
                for (var gi = 0; gi < (player.guards || []).length; gi++) {
                    if (player.guards[gi].personId === targetId) { isGuard = true; break; }
                }
                if (!isGuard) return { success: false, message: 'This person is not one of your guards.' };
            }

            // Check if they actually need treatment
            var hasInjury = npc.injured || (npc.injuries && npc.injuries.length > 0);
            var hasIllness = npc.sick || (npc.illnesses && npc.illnesses.length > 0);
            if (!hasInjury && !hasIllness) return { success: false, message: (npc.firstName || 'They') + ' does not need medical attention.' };

            if (method === 'player') {
                // Determine severity from NPC state
                var npcSeverity = 'minor';
                if (npc.injuries && npc.injuries.length > 0) {
                    npcSeverity = npc.injuries[0].severity || npc.injurySeverity || 'moderate';
                } else if (npc.illnesses && npc.illnesses.length > 0) {
                    npcSeverity = npc.illnesses[0].severity || 'moderate';
                } else if (npc.injurySeverity) {
                    npcSeverity = npc.injurySeverity;
                }

                if (npcSeverity === 'severe' && !hasSkill('doctor')) {
                    return { success: false, message: 'Only the Doctor skill can treat severe conditions.' };
                }
                if (npcSeverity === 'moderate' && !hasSkill('field_medic') && !hasSkill('doctor')) {
                    return { success: false, message: 'Need Field Medic or Doctor skill for moderate conditions.' };
                }

                // Need medical supplies — match to condition type
                var requiredProduct = null;
                var conditionName = '';
                if (npc.injuries && npc.injuries.length > 0) {
                    var injType = npc.injuries[0].type || npc.injuries[0].id;
                    conditionName = npc.injuries[0].name || injType;
                    // Look up the required product from INJURY_TYPES
                    var injDef = null;
                    if (typeof Player !== 'undefined' && Player.getInjuryTypes) {
                        var injTypes = Player.getInjuryTypes();
                        for (var _it = 0; _it < injTypes.length; _it++) {
                            if (injTypes[_it].id === injType) { injDef = injTypes[_it]; break; }
                        }
                    }
                    requiredProduct = injDef ? injDef.product : null;
                } else if (npc.illnesses && npc.illnesses.length > 0) {
                    var illType = npc.illnesses[0].type || npc.illnesses[0].id;
                    conditionName = npc.illnesses[0].name || illType;
                    // Look up the required product from ILLNESS_TYPES
                    var illDef = null;
                    if (typeof Player !== 'undefined' && Player.getIllnessTypes) {
                        var illTypes = Player.getIllnessTypes();
                        for (var _il = 0; _il < illTypes.length; _il++) {
                            if (illTypes[_il].id === illType) { illDef = illTypes[_il]; break; }
                        }
                    }
                    requiredProduct = illDef ? illDef.product : null;
                }

                var usedSup = null;
                if (requiredProduct && player.inventory[requiredProduct] && player.inventory[requiredProduct] > 0) {
                    usedSup = requiredProduct;
                } else if (requiredProduct) {
                    // Player doesn't have the right item
                    var productName = requiredProduct.replace(/_/g, ' ');
                    return { success: false, message: 'Need ' + productName + ' to treat ' + (conditionName || 'this condition') + '. Check your inventory.' };
                } else {
                    // Unknown condition type — fallback to any supply
                    var fallbackSupplies = ['bandages', 'herbal_remedy', 'healing_tonic', 'herbal_poultice', 'splint', 'fever_tonic', 'antidote'];
                    for (var _s = 0; _s < fallbackSupplies.length; _s++) {
                        if (player.inventory[fallbackSupplies[_s]] && player.inventory[fallbackSupplies[_s]] > 0) {
                            usedSup = fallbackSupplies[_s]; break;
                        }
                    }
                }
                if (!usedSup) return { success: false, message: 'Need medical supplies to treat ' + (npc.firstName || 'them') + '.' };

                if (typeof Game !== 'undefined' && Game.advanceTicks) Game.advanceTicks(CONFIG.ACTION_TICK_COSTS.treat_other || 5);
                player.inventory[usedSup]--;
                if (player.inventory[usedSup] <= 0) delete player.inventory[usedSup]; // v9p33river430: clean up zero-qty keys

                // Heal the NPC
                if (npc.injuries && npc.injuries.length > 0) {
                    npc.injuries.shift();
                    if (npc.injuries.length === 0) { npc.injured = false; npc.injurySeverity = null; npc.injuryType = null; }
                } else if (npc.illnesses && npc.illnesses.length > 0) {
                    npc.illnesses.shift();
                    if (npc.illnesses.length === 0) { npc.sick = false; npc.illness = null; }
                } else {
                    // Legacy flat flags
                    if (npc.injured) { npc.injured = false; npc.injurySeverity = null; npc.injuryType = null; }
                    else if (npc.sick) { npc.sick = false; npc.illness = null; }
                }
                npc.health = Math.min((npc.health || 50) + 25, 100);

                grantXP(6, 'medical');
                modifyRelationship(targetId, 8);
                Engine.logEvent('⚕️ ' + player.fullName + ' treated ' + (npc.firstName || 'a companion') + ' using ' + usedSup + '.', null, 'illness');
                return { success: true, message: 'Treated ' + (npc.firstName || 'companion') + ' using ' + usedSup + '.' };
            } else {
                // Hospital treatment for family/guard NPC
                var npcSev = 'minor';
                if (npc.injuries && npc.injuries.length > 0) npcSev = npc.injuries[0].severity || 'moderate';
                else if (npc.illnesses && npc.illnesses.length > 0) npcSev = npc.illnesses[0].severity || 'moderate';
                else if (npc.injurySeverity) npcSev = npc.injurySeverity;

                var fees2 = Engine.getHospitalFees ? Engine.getHospitalFees(player.townId) : null;
                var hospInfo3 = fees2 ? (fees2.hospital || fees2.clinic) : null;
                // v9p33river562: route the fee to the building type actually used.
                var _npcBldType = (fees2 && fees2.hospital) ? 'hospital' : 'clinic';
                var cost2 = hospInfo3 && hospInfo3.fees ? (hospInfo3.fees[npcSev] || getHospitalCost({ productCost: 10 }, npcSev)) : getHospitalCost({ productCost: 10 }, npcSev);
                if (player.gold < cost2) return { success: false, message: 'Not enough gold. Hospital costs ' + cost2 + 'g.' };

                player.gold -= cost2;
                player.stats.totalGoldSpent += cost2;
                _payHealthcareRevenue(town, cost2, _npcBldType);

                // Treatment duration — companion must stay at hospital
                var treatDays = npcSev === 'severe' ? 5 : npcSev === 'moderate' ? 3 : 1;
                npc._hospitalTreatmentEndDay = Engine.getDay() + treatDays;
                npc._hospitalTownId = player.townId;

                // 20% chance treatment didn't work
                var rng2 = Engine.getRng();
                if (rng2.chance(0.20)) {
                    Engine.logEvent('🏥 ' + (npc.firstName || 'Your companion') + ' is being treated at the hospital but the treatment may not be effective. Cost: ' + cost2 + 'g. They must stay for ' + treatDays + ' day(s).', null, 'illness');
                    // Still lock them at hospital for duration, but don't cure
                    npc._treatmentFailed = true;
                    return { success: true, treatmentFailed: true, message: (npc.firstName || 'Companion') + ' sent to hospital (' + cost2 + 'g). They must stay ' + treatDays + ' day(s). ⚠️ Treatment may not be effective.' };
                }

                // Hospital clears all conditions
                npc.injuries = [];
                npc.illnesses = [];
                npc.injured = false;
                npc.sick = false;
                npc.injurySeverity = null;
                npc.injuryType = null;
                npc.illness = null;
                npc.health = Math.min((npc.health || 50) + 40, 100);
                if (npc._illnessTreatPaid) delete npc._illnessTreatPaid;

                modifyRelationship(targetId, 5);
                Engine.logEvent('🏥 ' + (npc.firstName || 'Your companion') + ' was sent to the hospital for treatment. Cost: ' + cost2 + 'g. They must stay for ' + treatDays + ' day(s).', null, 'illness');
                return { success: true, message: (npc.firstName || 'Companion') + ' treated at hospital (' + cost2 + 'g). They must stay ' + treatDays + ' day(s). You may leave without them.' };
            }
        }

        return { success: false, message: 'Invalid target type.' };
    }

    // Auto-treatment: children and guards seek hospital treatment if sick and have money
    function _tickFamilyAutoTreatment() {
        _sync();
        var day = Engine.getDay();
        // Only check every 5 days to reduce overhead
        if (day % 5 !== 0) return;

        var childIds = player.childrenIds || [];
        for (var ci = 0; ci < childIds.length; ci++) {
            _autoTreatNPC(childIds[ci]);
        }
        var guards = player.guards || [];
        for (var gi = 0; gi < guards.length; gi++) {
            if (guards[gi].personId) _autoTreatNPC(guards[gi].personId);
        }
    }

    function _autoTreatNPC(npcId) {
        _sync();
        var npc = Engine.findPerson(npcId);
        if (!npc || !npc.alive) return;
        var hasSickness = npc.sick || (npc.illnesses && npc.illnesses.length > 0);
        var hasInjury = npc.injured || (npc.injuries && npc.injuries.length > 0);
        if (!hasSickness && !hasInjury) return;

        // Check if they are in a town with a hospital/clinic
        var town = Engine.findTown(npc.townId);
        if (!town) return;
        var hasMed = false;
        // v9p33river562: remember WHICH medical building type was found so the fee can be
        // routed to its owner instead of "first hospital-or-clinic in the array".
        var _medType = null;
        if (town.buildings) {
            for (var bi = 0; bi < town.buildings.length; bi++) {
                if (town.buildings[bi].type === 'hospital' || town.buildings[bi].type === 'clinic') { hasMed = true; _medType = town.buildings[bi].type; break; }
            }
        }
        if (!hasMed && (town.category === 'city' || town.category === 'capital_city')) hasMed = true;
        if (!hasMed) return;

        // Check NPC's gold (use npc.gold if it exists)
        var npcGold = npc.gold || 0;
        var sev = 'minor';
        if (npc.injuries && npc.injuries.length > 0) sev = npc.injuries[0].severity || 'moderate';
        else if (npc.illnesses && npc.illnesses.length > 0) sev = npc.illnesses[0].severity || 'moderate';
        else if (npc.injurySeverity) sev = npc.injurySeverity;

        var cost = getHospitalCost({ productCost: 10 }, sev);
        if (npcGold < cost) return;

        // Pay and cure
        npc.gold -= cost;
        npc.injuries = [];
        npc.illnesses = [];
        npc.injured = false;
        npc.sick = false;
        npc.injurySeverity = null;
        npc.injuryType = null;
        npc.illness = null;
        npc.health = Math.min((npc.health || 50) + 40, 100);
        if (npc._illnessTreatPaid) delete npc._illnessTreatPaid;
        _payHealthcareRevenue(town, cost, _medType || undefined);
        var _hospMsg = '🏥 ' + (npc.firstName || 'A family member') + ' sought treatment at the hospital (' + cost + 'g).';
        Engine.logEvent(_hospMsg, { _noToast: true }, 'illness');
    }

    // Tick hospitalized companions — release them when treatment duration is over
    function _tickHospitalizedCompanions() {
        _sync();
        var day = Engine.getDay();

        // Check all family and guards for hospital stays
        var npcIds = [];
        if (player.spouseId) npcIds.push(player.spouseId);
        var childIds = player.childrenIds || [];
        for (var ci = 0; ci < childIds.length; ci++) npcIds.push(childIds[ci]);
        var guards = player.guards || [];
        for (var gi = 0; gi < guards.length; gi++) {
            if (guards[gi].personId) npcIds.push(guards[gi].personId);
        }

        for (var ni = 0; ni < npcIds.length; ni++) {
            var npc = Engine.findPerson(npcIds[ni]);
            if (!npc || !npc.alive) continue;
            if (!npc._hospitalTreatmentEndDay) continue;

            if (day >= npc._hospitalTreatmentEndDay) {
                var npcName = npc.firstName || 'Your companion';
                if (npc._treatmentFailed) {
                    // Treatment didn't work — they still have their conditions
                    Engine.logEvent('🏥 ' + npcName + ' has been released from the hospital, but the treatment was not effective. They are still unwell.', null, 'illness');
                    if (typeof UI !== 'undefined' && UI.toast) UI.toast('⚠️ ' + npcName + '\'s treatment failed — still sick', 'warning');
                } else {
                    Engine.logEvent('🏥 ' + npcName + ' has been released from the hospital, fully recovered.', null, 'illness');
                }
                // Move them to the hospital town if they're not there already
                if (npc._hospitalTownId) {
                    npc.townId = npc._hospitalTownId;
                }
                delete npc._hospitalTreatmentEndDay;
                delete npc._hospitalTownId;
                delete npc._treatmentFailed;
            }
        }
    }

    // Get treatable companions (for UI display)
    function getTreatableCompanions() {
        _sync();
        var results = [];
        var town = Engine.findTown(player.townId);
        if (!town || player.traveling) return results;

        // Check spouse (spouseAI condition system)
        if (player.spouseId) {
            var spouse = Engine.findPerson(player.spouseId);
            if (spouse && spouse.alive && spouse.townId === player.townId) {
                initSpouseAI();
                if (player.spouseAI.condition !== 'healthy') {
                    results.push({
                        type: 'spouse',
                        id: player.spouseId,
                        name: spouse.firstName + ' ' + spouse.lastName,
                        condition: player.spouseAI.condition,
                        health: player.spouseAI.health,
                        severity: player.spouseAI.condition === 'gravely_ill' ? 'severe' : 'moderate'
                    });
                }
            }
        }

        // Check family members (NPC illness/injury system)
        if (player.familyMembers) {
            for (var i = 0; i < player.familyMembers.length; i++) {
                var fm = player.familyMembers[i];
                if (fm.npcId === player.spouseId) continue; // spouse handled above
                var fNpc = Engine.findPerson(fm.npcId);
                if (!fNpc || !fNpc.alive || fNpc.townId !== player.townId) continue;
                var fInjured = fNpc.injured || (fNpc.injuries && fNpc.injuries.length > 0);
                var fSick = fNpc.sick || (fNpc.illnesses && fNpc.illnesses.length > 0);
                if (fInjured || fSick) {
                    var fCond = fInjured ? 'injured' : 'sick';
                    var fSev = 'minor';
                    if (fNpc.injuries && fNpc.injuries.length > 0) fSev = fNpc.injuries[0].severity || 'moderate';
                    else if (fNpc.illnesses && fNpc.illnesses.length > 0) fSev = fNpc.illnesses[0].severity || 'moderate';
                    else if (fNpc.injurySeverity) fSev = fNpc.injurySeverity;
                    results.push({
                        type: 'family',
                        id: fm.npcId,
                        name: fNpc.firstName + ' ' + (fNpc.lastName || ''),
                        role: fm.role,
                        condition: fCond,
                        conditionDetail: fInjured ? (fNpc.injurySeverity || fNpc.injuryType || 'injured') : (fNpc.illness || 'sick'),
                        health: fNpc.health || 50,
                        severity: fSev
                    });
                }
            }
        }

        // Check personal guards (NPC illness/injury system)
        for (var g = 0; g < (player.guards || []).length; g++) {
            var guard = player.guards[g];
            if (!guard.personId) continue;
            var gNpc = Engine.findPerson(guard.personId);
            if (!gNpc || !gNpc.alive || gNpc.townId !== player.townId) continue;
            var gInjured = gNpc.injured || (gNpc.injuries && gNpc.injuries.length > 0);
            var gSick = gNpc.sick || (gNpc.illnesses && gNpc.illnesses.length > 0);
            if (gInjured || gSick) {
                var gCond = gInjured ? 'injured' : 'sick';
                var gSev = 'minor';
                if (gNpc.injuries && gNpc.injuries.length > 0) gSev = gNpc.injuries[0].severity || 'moderate';
                else if (gNpc.illnesses && gNpc.illnesses.length > 0) gSev = gNpc.illnesses[0].severity || 'moderate';
                else if (gNpc.injurySeverity) gSev = gNpc.injurySeverity;
                results.push({
                    type: 'guard',
                    id: guard.personId,
                    name: guard.name || gNpc.firstName,
                    condition: gCond,
                    conditionDetail: gInjured ? (gNpc.injurySeverity || gNpc.injuryType || 'injured') : (gNpc.illness || 'sick'),
                    health: gNpc.health || 50,
                    severity: gSev
                });
            }
        }

        return results;
    }

    function tickInjuriesAndIllnesses() {
        _sync();
        _ensureConditionLists();
        const day = Engine.getDay();
        const rng = Engine.getRng();

        // Daily health drain from active conditions (use worst severity)
        var worstDrain = 0;
        for (var di = 0; di < (player.injuries || []).length; di++) {
            var drainI = _CONDITION_DAILY_DRAIN[(player.injuries[di].severity)] || 0;
            if (drainI > worstDrain) worstDrain = drainI;
        }
        for (var dj = 0; dj < (player.illnesses || []).length; dj++) {
            var drainJ = _CONDITION_DAILY_DRAIN[(player.illnesses[dj].severity)] || 0;
            if (drainJ > worstDrain) worstDrain = drainJ;
        }
        if (worstDrain > 0) {
            player.health = Math.max(0, (player.health || 100) - worstDrain);
            if (player.health <= 0 && !window._godInvincible) {
                // Find the worst condition name for cause of death
                var worstName = 'injuries';
                var worstSev = 0;
                var sevMap = { minor: 1, moderate: 2, severe: 3 };
                for (var wi = 0; wi < (player.injuries || []).length; wi++) {
                    if ((sevMap[player.injuries[wi].severity] || 0) > worstSev) { worstSev = sevMap[player.injuries[wi].severity]; worstName = player.injuries[wi].name || 'injury'; }
                }
                for (var wj = 0; wj < (player.illnesses || []).length; wj++) {
                    if ((sevMap[player.illnesses[wj].severity] || 0) > worstSev) { worstSev = sevMap[player.illnesses[wj].severity]; worstName = player.illnesses[wj].name || 'illness'; }
                }
                Engine.logEvent('💀 ' + player.fullName + ' succumbed to ' + worstName + '. Health reached zero.', null, 'illness');
                if (typeof UI !== 'undefined' && UI.toast) UI.toast('☠️ Died from ' + worstName + '!', 'danger', 'critical');
                player.deathCause = worstName;
                handlePlayerDeath();
                return;
            }
        }

        // Health recovery: +2/day if no conditions AND energy, hunger, thirst all > 50; +1 bonus if all > 80
        if ((player.injuries || []).length === 0 && (player.illnesses || []).length === 0) {
            var hp = player.health || 100;
            var maxHp = player.maxHealth || 100;
            if (hp < maxHp) {
                var energy = player.energy != null ? player.energy : 100;
                var hunger = player.hunger != null ? player.hunger : 100;
                var thirst = player.thirst != null ? player.thirst : 100;
                var healAmt = 0;
                if (energy > 50 && hunger > 50 && thirst > 50) healAmt += 2;
                if (energy > 80 && hunger > 80 && thirst > 80) healAmt += 1;
                if (healAmt > 0) player.health = Math.min(maxHp, hp + healAmt);
            }
        }

        // Process injuries
        for (let i = player.injuries.length - 1; i >= 0; i--) {
            const inj = player.injuries[i];
            if (inj.treated && day >= inj.healDay) {
                player.injuries.splice(i, 1);
                Engine.logEvent(`${player.fullName}'s ${inj.name} has healed.`, null, 'illness');
                continue;
            }
            if (!inj.treated) {
                const daysUntreated = day - inj.dayOccurred;

                if (inj.severity === 'minor') {
                    // Minor: self-heals in 5-30 days (based on injury type healDays)
                    const typeDef = INJURY_TYPES.find(t => t.id === inj.type);
                    const healTime = typeDef ? Math.max(5, Math.min(30, typeDef.healDays * 2)) : 15;
                    if (daysUntreated >= healTime) {
                        player.injuries.splice(i, 1);
                        Engine.logEvent(`${player.fullName}'s ${inj.name} has naturally healed.`, { _noToast: true }, 'illness');
                        if (typeof UI !== 'undefined' && UI.toast) UI.toast(`💚 ${inj.name} healed naturally`, 'success');
                        continue;
                    }
                } else if (inj.severity === 'moderate') {
                    // Moderate: self-heals in 30-90 days, but small daily chance of becoming severe
                    const typeDef = INJURY_TYPES.find(t => t.id === inj.type);
                    const healTime = typeDef ? Math.max(30, Math.min(90, typeDef.healDays * 4)) : 60;
                    if (daysUntreated >= healTime) {
                        player.injuries.splice(i, 1);
                        Engine.logEvent(`${player.fullName}'s ${inj.name} has naturally healed.`, { _noToast: true }, 'illness');
                        if (typeof UI !== 'undefined' && UI.toast) UI.toast(`💚 ${inj.name} healed naturally`, 'success');
                        continue;
                    }
                    // 1% daily chance of worsening to severe if untreated
                    if (daysUntreated >= 10 && rng && rng.random() < 0.01) {
                        inj.severity = 'severe';
                        Engine.logEvent(`${player.fullName}'s ${inj.name} has worsened to severe!`, null, 'illness');
                        if (typeof UI !== 'undefined' && UI.toast) UI.toast(`⚠️ ${inj.name} is now severe!`, 'danger');
                    }
                } else if (inj.severity === 'severe') {
                    // Severe: NO self-healing. Check type-specific death risk first, fallback to general
                    const typeDef2 = INJURY_TYPES.find(t => t.id === inj.type);
                    var injDeathRisk = (typeDef2 && typeDef2.deathRisk) ? typeDef2.deathRisk : 0;
                    // Type-specific death risk applies immediately (e.g. deep wound 2%/day)
                    if (injDeathRisk > 0 && rng && rng.random() < injDeathRisk && !window._godInvincible) {
                        Engine.logEvent(`${player.fullName} died from ${inj.name}.`, null, 'illness');
                        if (typeof UI !== 'undefined' && UI.toast) UI.toast(`☠️ Died from ${inj.name}!`, 'danger', 'critical');
                        player.deathCause = inj.name;
                        handlePlayerDeath();
                        return;
                    }
                    // General severe injury death: ~1.5% daily after 30 days untreated
                    if (daysUntreated >= 30 && rng && rng.random() < 0.015 && !window._godInvincible) {
                        Engine.logEvent(`${player.fullName} died from untreated ${inj.name}.`, null, 'illness');
                        if (typeof UI !== 'undefined' && UI.toast) UI.toast(`☠️ Died from untreated ${inj.name}!`, 'danger', 'critical');
                        player.deathCause = 'Untreated ' + inj.name;
                        handlePlayerDeath();
                        return;
                    }
                }
            }
        }

        // Process illnesses
        // v9p33river208: prison physician system — if jailed and an illness
        // is untreated, after a delay (severity-scaled) the prison guards
        // arrange treatment. Doesn't fully heal instantly: marks ill.treated
        // with a healDay a few more days out, mirroring real treatment.
        var _injJailedDay = (player.jailedUntilDay || 0);
        var _injInJail = _injJailedDay > 0 && day < _injJailedDay;

        for (let i = player.illnesses.length - 1; i >= 0; i--) {
            const ill = player.illnesses[i];
            if (ill.treated && day >= ill.healDay) {
                player.illnesses.splice(i, 1);
                Engine.logEvent(`${player.fullName} recovered from ${ill.name}.`, null, 'illness');
                continue;
            }
            if (!ill.treated) {
                const daysUntreated = day - ill.dayOccurred;
                // v9p33river208: prison physician — kingdom guards arrange
                // treatment after a delay. Minor: 2d delay + 5d to heal.
                // Moderate: 4d + 8d. Severe: 6d + 14d. Skips if not in jail.
                if (_injInJail) {
                    var _delay = ill.severity === 'severe' ? 6 : ill.severity === 'moderate' ? 4 : 2;
                    if (daysUntreated >= _delay) {
                        var _treatTime = ill.severity === 'severe' ? 14 : ill.severity === 'moderate' ? 8 : 5;
                        ill.treated = true;
                        ill.healDay = day + _treatTime;
                        ill.source = (ill.source || '') + ' [prison physician]';
                        Engine.logEvent(`⚕️ Prison guards summoned a physician for ${player.fullName}'s ${ill.name}. Recovery in ${_treatTime} day${_treatTime !== 1 ? 's' : ''}.`, null, 'illness');
                        if (typeof UI !== 'undefined' && UI.toast) UI.toast(`⚕️ Prison physician treated your ${ill.name}.`, 'info');
                        continue;
                    }
                }
                if (ill.severity === 'minor' && daysUntreated >= 10) {
                    ill.severity = 'moderate';
                    Engine.logEvent(`${player.fullName}'s ${ill.name} has worsened!`, null, 'illness');
                } else if (ill.severity === 'moderate' && daysUntreated >= 25) {
                    ill.severity = 'severe';
                    Engine.logEvent(`${player.fullName}'s ${ill.name} is now severe!`, null, 'illness');
                } else if (ill.severity === 'severe') {
                    const typeDef = ILLNESS_TYPES.find(t => t.id === ill.type);
                    const deathRisk = (typeDef && typeDef.deathRisk) ? typeDef.deathRisk : 0.05;
                    if (rng && rng.random() < deathRisk && !window._godInvincible) {
                        Engine.logEvent(`${player.fullName} died from ${ill.name}.`, null, 'illness');
                        if (typeof UI !== 'undefined' && UI.toast) UI.toast(`☠️ Died from ${ill.name}!`, 'danger', 'critical');
                        player.deathCause = ill.name;
                        handlePlayerDeath();
                        return;
                    }
                }
            }
        }
    }

    function getWorstConditionSeverity() {
        _sync();
        _ensureConditionLists();
        let worst = null;
        const severities = { minor: 1, moderate: 2, severe: 3 };
        for (const inj of player.injuries) {
            if (!worst || severities[inj.severity] > severities[worst]) worst = inj.severity;
        }
        for (const ill of player.illnesses) {
            if (!worst || severities[ill.severity] > severities[worst]) worst = ill.severity;
        }
        return worst;
    }

    function getWorkEfficiencyModifier() {
        _sync();
        _ensureConditionLists();
        let modifier = 1.0;
        for (const inj of player.injuries) {
            const typeDef = INJURY_TYPES.find(t => t.id === inj.type);
            if (typeDef && typeDef.debuffs && typeDef.debuffs.workEfficiency) {
                modifier += typeDef.debuffs.workEfficiency;
            }
        }
        for (const ill of player.illnesses) {
            const typeDef = ILLNESS_TYPES.find(t => t.id === ill.type);
            if (typeDef && typeDef.debuffs && typeDef.debuffs.workEfficiency) {
                modifier += typeDef.debuffs.workEfficiency;
            } else {
                // Fallback for old illness types without debuffs
                var sev = ill.severity;
                if (sev === 'severe') modifier -= 0.50;
                else if (sev === 'moderate') modifier -= 0.25;
                else if (sev === 'minor') modifier -= 0.10;
            }
        }
        return Math.max(0.10, modifier); // minimum 10% efficiency
    }

    function canDoPhysicalWork() {
        _sync();
        _ensureConditionLists();
        const sev = getWorstConditionSeverity();
        if (sev === 'severe') return false;
        // Injuries that block physical work
        for (const inj of player.injuries) {
            const typeDef = INJURY_TYPES.find(t => t.id === inj.type);
            if (typeDef && typeDef.debuffs && typeDef.debuffs.blocksPhysical) return false;
        }
        // Illnesses that block physical work
        for (const ill of player.illnesses) {
            const typeDef = ILLNESS_TYPES.find(t => t.id === ill.type);
            if (typeDef && typeDef.debuffs && typeDef.debuffs.blocksPhysical) return false;
        }
        return true;
    }

    function canDoAnyWork() {
        _sync();
        const sev = getWorstConditionSeverity();
        return sev !== 'severe';
    }

    // Get combined injury + illness debuff effects for use by other systems
    function getInjuryDebuffs() {
        _sync();
        _ensureConditionLists();
        const result = { hungerRate: 1.0, travelSpeed: 0, xpMult: 1.0, tradePenalty: 0, goldDrain: 0 };
        for (const inj of player.injuries) {
            const typeDef = INJURY_TYPES.find(t => t.id === inj.type);
            if (!typeDef || !typeDef.debuffs) continue;
            const d = typeDef.debuffs;
            if (d.hungerRate) result.hungerRate = Math.max(result.hungerRate, d.hungerRate);
            if (d.travelSpeed) result.travelSpeed = Math.min(result.travelSpeed, d.travelSpeed);
            if (d.xpMult) result.xpMult = Math.min(result.xpMult, d.xpMult);
            if (d.tradePenalty) result.tradePenalty = Math.min(result.tradePenalty, d.tradePenalty);
            if (d.goldDrain) result.goldDrain += d.goldDrain;
        }
        for (const ill of player.illnesses) {
            const typeDef = ILLNESS_TYPES.find(t => t.id === ill.type);
            if (!typeDef || !typeDef.debuffs) continue;
            const d = typeDef.debuffs;
            if (d.hungerRate) result.hungerRate = Math.max(result.hungerRate, d.hungerRate);
            if (d.travelSpeed) result.travelSpeed = Math.min(result.travelSpeed, d.travelSpeed);
            if (d.xpMult) result.xpMult = Math.min(result.xpMult, d.xpMult);
            if (d.tradePenalty) result.tradePenalty = Math.min(result.tradePenalty, d.tradePenalty);
            if (d.goldDrain) result.goldDrain += d.goldDrain;
        }
        return result;
    }

    // v9p33river388: Social healing offer from talk-to-person dialog
    function offerHealNpc(personId) {
        _sync();
        if (!player) return { success: false, message: 'No player state.' };
        if (!player.inventory) player.inventory = {};

        var npc = null;
        try { npc = Engine.findPerson(personId); } catch(e) {}
        if (!npc || !npc.alive) return { success: false, message: 'Person not found.' };

        // Must be sick or injured
        var hasInjury = npc.injured || (npc.injuries && npc.injuries.length > 0);
        var hasIllness = npc.sick || (npc.illnesses && npc.illnesses.length > 0);
        if (!hasInjury && !hasIllness) return { success: false, message: (npc.firstName || 'They') + ' is not sick or injured.' };

        // Must have medical skill
        if (!hasSkill('field_medic') && !hasSkill('doctor')) {
            return { success: false, message: 'Need Field Medic or Doctor skill.' };
        }

        // Cooldown check (3-day)
        if (!player._healOfferCooldowns) player._healOfferCooldowns = {};
        var today = 0;
        try { today = Engine.getDay(); } catch(e) {}
        var lastOffer = player._healOfferCooldowns[personId] || 0;
        if (lastOffer && today - lastOffer < 3) {
            return { success: false, message: 'They declined recently. Try again in ' + (3 - (today - lastOffer)) + ' day(s).' };
        }

        // Must have medical supplies
        var supplyOrder = ['bandages', 'herbal_remedy', 'healing_tonic', 'herbal_poultice', 'splint', 'fever_tonic', 'antidote'];
        var usedSupply = null;

        // Try to match the specific condition first
        var requiredProduct = null;
        if (npc.injuries && npc.injuries.length > 0) {
            var injType = npc.injuries[0].type || npc.injuries[0].id;
            for (var _it = 0; _it < INJURY_TYPES.length; _it++) {
                if (INJURY_TYPES[_it].id === injType) { requiredProduct = INJURY_TYPES[_it].product; break; }
            }
        } else if (npc.illnesses && npc.illnesses.length > 0) {
            var illType = npc.illnesses[0].type || npc.illnesses[0].id;
            for (var _il = 0; _il < ILLNESS_TYPES.length; _il++) {
                if (ILLNESS_TYPES[_il].id === illType) { requiredProduct = ILLNESS_TYPES[_il].product; break; }
            }
        }

        if (requiredProduct && player.inventory[requiredProduct] && player.inventory[requiredProduct] > 0) {
            usedSupply = requiredProduct;
        } else {
            for (var si = 0; si < supplyOrder.length; si++) {
                if (player.inventory[supplyOrder[si]] && player.inventory[supplyOrder[si]] > 0) {
                    usedSupply = supplyOrder[si]; break;
                }
            }
        }
        if (!usedSupply) return { success: false, message: 'Need medical supplies.' };

        // Acceptance roll
        var acceptChance = 0.50;
        var relLevel = 0;
        try {
            var rel = Player.getRelationship ? Player.getRelationship(personId) : null;
            if (rel) relLevel = rel.level || 0;
        } catch(e) {}
        if (relLevel >= 20) acceptChance += 0.30;
        var npcHealth = (typeof npc.health === 'number') ? npc.health : 100;
        if (npcHealth < 50) acceptChance += 0.20;
        // Family always accepts
        if (player.spouseId === personId ||
            (player.parentIds && player.parentIds.indexOf(personId) !== -1) ||
            (player.childrenIds && player.childrenIds.indexOf(personId) !== -1) ||
            (player.siblingIds && player.siblingIds.indexOf(personId) !== -1)) {
            acceptChance = 1.0;
        }

        var rng = Engine.getRng ? Engine.getRng() : { random: function() { return Math.random(); } };
        var accepted = rng.random() < acceptChance;

        if (accepted) {
            // Consume supply
            player.inventory[usedSupply]--;
            if (player.inventory[usedSupply] <= 0) delete player.inventory[usedSupply];

            // Heal the NPC (same logic as treatCompanion)
            if (npc.injuries && npc.injuries.length > 0) {
                npc.injuries.shift();
                if (npc.injuries.length === 0) { npc.injured = false; npc.injurySeverity = null; npc.injuryType = null; }
            } else if (npc.illnesses && npc.illnesses.length > 0) {
                npc.illnesses.shift();
                if (npc.illnesses.length === 0) { npc.sick = false; npc.illness = null; }
            } else {
                if (npc.injured) { npc.injured = false; npc.injurySeverity = null; npc.injuryType = null; }
                else if (npc.sick) { npc.sick = false; npc.illness = null; }
            }
            npc.health = Math.min((npc.health || 50) + 25, 100);

            // Relationship boost (+10 for social healing)
            modifyRelationship(personId, 10);
            grantXP(6, 'medical');

            Engine.logEvent('💊 ' + player.fullName + ' offered healing to ' + (npc.firstName || 'an NPC') + ' using ' + usedSupply.replace(/_/g, ' ') + '. They accepted gratefully.', null, 'social');

            return { success: true, accepted: true, message: 'They accepted your treatment!' };
        }

        // Rejected — set 3-day cooldown
        player._healOfferCooldowns[personId] = today;
        return { success: true, accepted: false, message: (npc.firstName || 'They') + ' declined your offer. Try again in 3 days.' };
    }

    // -- Exports --
    Player._applyConditionHealthHit = _applyConditionHealthHit;
    Player.inflictRandomInjury = inflictRandomInjury;
    Player.tickPlayerIllnessExposure = tickPlayerIllnessExposure;
    Player.inflictRandomIllness = inflictRandomIllness;
    Player.inflictSpecificIllness = inflictSpecificIllness;
    Player.visitHospital = visitHospital;
    Player.visitClinic = visitClinic;
    Player.getHospitalCost = getHospitalCost;
    Player.getClinicCost = getClinicCost;
    Player.getMedicalFacilities = getMedicalFacilities;
    Player.selfTreat = selfTreat;
    Player.treatOther = treatOther;
    Player.offerHealNpc = offerHealNpc;
    Player.treatCompanion = function(targetType, targetId, method) {
        var result = treatCompanion(targetType, targetId, method);
        if (result && result.success && player.storyMode && player.storyMode.active && typeof StoryMode !== 'undefined' && StoryMode.onPlayerAction) {
            StoryMode.onPlayerAction('treat_person', { targetType: targetType, targetId: targetId, method: method });
        }
        return result;
    };
    Player.getTreatableCompanions = getTreatableCompanions;
    Player.tickInjuriesAndIllnesses = tickInjuriesAndIllnesses;
    Player._tickFamilyAutoTreatment = _tickFamilyAutoTreatment;
    Player._tickHospitalizedCompanions = _tickHospitalizedCompanions;
    Player.getWorstConditionSeverity = getWorstConditionSeverity;
    Player.getWorkEfficiencyModifier = getWorkEfficiencyModifier;
    Player.canDoPhysicalWork = canDoPhysicalWork;
    Player.canDoAnyWork = canDoAnyWork;
    Player.getInjuryDebuffs = getInjuryDebuffs;
    Player._payHealthcareRevenue = _payHealthcareRevenue;

})(window.Player);