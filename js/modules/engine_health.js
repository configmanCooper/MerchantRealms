// ========================================================
// engine_health.js
// NPC Health & Illness System, Hospital/Clinic Treatment
// Extracted from engine.js sections §16B, §16b
// ========================================================
(function(Engine) {
    "use strict";
    if (!Engine) throw new Error("Engine must be loaded before engine_health.js");

    // ── Internal state ──
    var world;
    function _syncState() {
        world = Engine.getWorld();
    }

    // ── Already-exported Engine utilities ──
    var logEvent = function(msg, details, category) { Engine.logEvent(msg, details, category); };
    var findTown = function(id) { return Engine.findTown(id); };
    var findKingdom = function(id) { return Engine.findKingdom(id); };
    var findPerson = function(id) { return Engine.findPerson(id); };
    var findBuildingType = function(id) { return Engine.findBuildingType(id); };
    var getMarketPrice = function(town, resourceId) { return Engine.getMarketPrice(town, resourceId); };
    var consumeFromMarket = function(town, resId, qty) { return Engine.consumeFromMarket(town, resId, qty); };
    var killPerson = function(p, cause) { return Engine.killPerson(p, cause); };

    // ── Functions that MUST be newly exported from engine.js ──
    var getSeason = function(day) { return Engine._getSeason(day); };
    var isPlayerRoyalAdvisorOf = function(kingdom) { return Engine.isPlayerRoyalAdvisorOf(kingdom); };
    var proposeKingDecision = function(k, decision) { return Engine.proposeKingDecision(k, decision); };
    var kingdomBuild = function(kingdom, town, buildingTypeId, rng) { return Engine.kingdomBuild(kingdom, town, buildingTypeId, rng); };

    // ========================================================
    // §16B NPC HEALTH & ILLNESS SYSTEM
    // ========================================================

    var NPC_ILLNESSES_BY_SEVERITY = null; // lazy-init cache

    function _getIllnessesBySeverity() {
        if (NPC_ILLNESSES_BY_SEVERITY) return NPC_ILLNESSES_BY_SEVERITY;
        var ills = (typeof NPC_HEALTH_CONFIG !== 'undefined' && NPC_HEALTH_CONFIG.ILLNESSES) ? NPC_HEALTH_CONFIG.ILLNESSES : {};
        var result = { minor: [], moderate: [], serious: [], severe: [] };
        for (var key in ills) {
            var ill = ills[key];
            ill._id = key;
            if (result[ill.severity]) result[ill.severity].push(ill);
        }
        NPC_ILLNESSES_BY_SEVERITY = result;
        return result;
    }

    function _isImmuneToIllness(personId, illnessId) {
        // ~10% deterministic immunity per person per illness
        var hash = 0;
        var str = personId + ':' + illnessId;
        for (var i = 0; i < str.length; i++) hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
        return (Math.abs(hash) % 100) < 10;
    }

    function _isAsymptomatic(personId, illnessId) {
        // ~20% of infected are asymptomatic carriers
        var hash = 0;
        var str = 'asym:' + personId + ':' + illnessId;
        for (var i = 0; i < str.length; i++) hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
        return (Math.abs(hash) % 100) < 20;
    }

    function _pickIllnessForSeverity(severity, seasonLower, rng) {
        var pool = _getIllnessesBySeverity();
        var candidates = (pool[severity] || []).filter(function(ill) {
            return !ill.seasons || ill.seasons.indexOf(seasonLower) >= 0;
        });
        if (candidates.length === 0) {
            // Fallback: pick any of that severity
            candidates = pool[severity] || [];
        }
        if (candidates.length === 0) return null;
        return candidates[rng.randInt(0, candidates.length - 1)];
    }

    // v9p33river241: poison debug logging.
    // Toggle via window._POISON_DEBUG = true to enable. Default OFF (was on
    // during diagnostic phase v241-v251; root causes resolved in v250-v252).
    function _dbgPoison(tag, person, extra) {
        try {
            if (typeof window === 'undefined' || window._POISON_DEBUG !== true) return;
            if (!person) return;
            var d = (world && typeof world.day === 'number') ? world.day : '?';
            var who = person.firstName ? (person.firstName + (person.lastName ? ' ' + person.lastName : '')) : ('person#' + person.id);
            if (person.isKing) who = '👑KING ' + who;
            else if (person.isNoble) who = '🎗️NOBLE ' + who;
            else if (person.isEliteMerchant) who = '💼EM ' + who;
            var hp = (typeof person.health === 'number') ? person.health.toFixed(1) : '?';
            var line = '[POISON|d' + d + '] ' + who + ' hp=' + hp + ' | ' + tag;
            if (extra) console.log(line, extra);
            else console.log(line);
        } catch(_e) {}
    }

    function infectNPC(person, illnessId, rng, day, source) {
        if (!person || !person.alive || person.sick) return false;
        if (_isImmuneToIllness(person.id, illnessId)) return false;

        var ills = (typeof NPC_HEALTH_CONFIG !== 'undefined' && NPC_HEALTH_CONFIG.ILLNESSES) ? NPC_HEALTH_CONFIG.ILLNESSES : {};
        var ill = ills[illnessId];
        if (!ill) return false;

        person.sick = true;
        person.illness = illnessId;
        person.illnessDay = day;

        // Contagion: roll severity per-victim instead of always using illness default
        // Weighted so most contagion cases are milder; severe illness definition
        // only means the *worst* case is severe, not every case
        // Age affects severity: 18-30 baseline, 31-40 slightly worse, 41+ moderately worse
        var _sev = ill.severity;
        if (source === 'contagion' && (_sev === 'severe' || _sev === 'moderate')) {
            var _age = person.age || 25;
            // Age shift: pushes the roll toward more severe outcomes for older NPCs
            var _ageShift = 0;
            if (_age >= 41) _ageShift = 0.15;
            else if (_age >= 31) _ageShift = 0.07;

            var _r = rng.random();
            if (_sev === 'severe') {
                // severe illness (plague) baseline (18-30): 45% minor, 30% moderate, 25% severe
                // 31-40: 38% minor, 30% moderate, 32% severe
                // 41+:   30% minor, 30% moderate, 40% severe
                var _minorCap = Math.max(0.15, 0.45 - _ageShift);
                if (_r < _minorCap) _sev = 'minor';
                else if (_r < _minorCap + 0.30) _sev = 'moderate';
                // else stays severe
            } else {
                // moderate illness baseline (18-30): 55% minor, 45% moderate
                // 31-40: 48% minor, 52% moderate
                // 41+:   40% minor, 60% moderate
                if (_r < Math.max(0.20, 0.55 - _ageShift)) _sev = 'minor';
            }
        }
        person.illnessSeverity = _sev;

        person.asymptomatic = _isAsymptomatic(person.id, illnessId);
        // v9p33river243: poison is a deliberate toxin attack — never asymptomatic.
        // Without this fix, ~20% of poison victims (including kings) silently
        // shrugged off the entire poisoning with zero health drain.
        if (illnessId === 'poisoned') person.asymptomatic = false;
        person.illnessSource = source || 'random';
        person.illnessTreated = false;
        if (illnessId === 'poisoned') {
            _dbgPoison('INFECTED', person, { severity: _sev, source: source, day: day });
        }
        return true;
    }

    function _infectRandomSeverity(person, severity, seasonLower, rng, day, source) {
        var ill = _pickIllnessForSeverity(severity, seasonLower, rng);
        if (!ill) return false;
        return infectNPC(person, ill._id, rng, day, source || 'random');
    }

    // Notable illness deaths only — no batch accumulation needed

    function tickNPCHealth() {
        _syncState();
        if (!world || !world.people) return;
        var rng = world.rng;
        var day = world.day;

        // Tick every 3 days for performance, scale rates accordingly
        if (day % 3 !== 0) return;
        var tickScale = 3;

        // v9p33river242: scan for poisoned NPCs at top of tick so we can see
        // how many exist and which town/illness state they're in
        try {
            if (typeof window !== 'undefined' && window._POISON_DEBUG === true) {
                var _poisonedNow = [];
                for (var _pi = 0; _pi < world.people.length; _pi++) {
                    var _pp = world.people[_pi];
                    if (_pp && _pp.alive && _pp.illness === 'poisoned') _poisonedNow.push(_pp);
                }
                if (_poisonedNow.length > 0) {
                    console.log('[POISON|d' + day + '] tickNPCHealth start — ' + _poisonedNow.length + ' poisoned NPC(s):',
                        _poisonedNow.map(function(p){
                            return (p.isKing?'👑':'') + (p.firstName||'?') + ' hp=' + (p.health!=null?p.health.toFixed(1):'?') + ' sick=' + p.sick + ' tid=' + p.townId + ' treat=' + !!p._illnessTreatPaid;
                        })
                    );
                }
            }
        } catch(_e){}

        var daysPerYear = (CONFIG.DAYS_PER_SEASON || 90) * 4;
        var season = getSeason(day);
        var seasonLower = season.toLowerCase();
        var seasonMult = 1.0;
        if (typeof NPC_HEALTH_CONFIG !== 'undefined' && NPC_HEALTH_CONFIG.SEASON_MULT) {
            seasonMult = NPC_HEALTH_CONFIG.SEASON_MULT[seasonLower] || 1.0;
        }

        // Per-NPC daily rates (annualized → daily → scaled by tick interval)
        // Incidence tuned so that ACTIVE cases show a healthy minor > moderate > severe distribution
        var minorRate = (0.18 / daysPerYear) * tickScale * seasonMult;
        var moderateRate = (0.08 / daysPerYear) * tickScale * seasonMult;
        var severeRate = (0.01 / daysPerYear) * tickScale * seasonMult;

        // Pre-calculate town health infrastructure modifier
        var townHealthMod = {};
        var townHasHospital = {};
        var townHasClinic = {};
        for (var ti = 0; ti < world.towns.length; ti++) {
            var t = world.towns[ti];
            var mod = 1.0;
            var hasHosp = false, hasClin = false;
            var blds = t.buildings || [];
            // Medical infrastructure reduces illness incidence (capped at -55%)
            var infraReduction = 0;
            for (var bi = 0; bi < blds.length; bi++) {
                var _bldEntry = blds[bi];
                // v9p33river333: tolerate null/malformed building entries in legacy towns.
                var btId = typeof _bldEntry === 'string' ? _bldEntry : (_bldEntry ? (_bldEntry.type || _bldEntry.id || '') : '');
                if (btId === 'hospital') { infraReduction += 0.20; hasHosp = true; }
                else if (btId === 'clinic') { infraReduction += 0.10; hasClin = true; }
                else if (btId === 'well' || btId === 'cistern') infraReduction += 0.05;
                else if (btId === 'bathhouse') infraReduction += 0.05;
            }
            mod -= Math.min(0.55, infraReduction);
            // Prosperity: higher = healthier. 50 prosp = 1.0x, 100 prosp = 0.7x
            var prosp = (t.prosperity || 50) / 100;
            mod *= Math.max(0.5, 1.2 - prosp * 0.5);
            // Population density: bigger towns = slightly higher illness
            if ((t.population || 0) > 300) mod *= 1.15;
            else if ((t.population || 0) > 150) mod *= 1.05;
            // Kingdom health policies
            var kd = t.kingdomId ? findKingdom(t.kingdomId) : null;
            if (kd && kd.healthPolicies) {
                for (var hp = 0; hp < kd.healthPolicies.length; hp++) {
                    var pol = kd.healthPolicies[hp];
                    if (!pol.active || (pol.expiresDay && day > pol.expiresDay)) continue;
                    if (pol.type === 'public_hygiene' && (!pol.townId || pol.townId === t.id)) mod *= 0.70;
                    if (pol.type === 'medical_funding' && (!pol.townId || pol.townId === t.id)) mod *= 0.85;
                    if (pol.type === 'martial_quarantine' && (!pol.townId || pol.townId === t.id)) mod *= 0.40; // v9p33river333: town-wide quarantine policies may omit townId.
                }
            }
            mod = Math.max(0.30, mod);
            // v9p33river191: in story mode, greatly reduce illness in Valdren
            // until the jail-protection safeguard turns off (chapter 14).
            // The early game is meant to be a calm merchant-life intro, not
            // pummeled by random plague waves.
            try {
                var _smActive = typeof StoryMode !== 'undefined' && StoryMode.isActive && StoryMode.isActive();
                if (_smActive && kd && /valdren/i.test(kd.name || '')) {
                    var _jailGuardOn = true;
                    try {
                        var _ps = (typeof Player !== 'undefined' && Player.state) ? Player.state : null;
                        if (_ps && _ps.storyMode && _ps.storyMode.flags && _ps.storyMode.flags.jailProtectionRemoved) {
                            _jailGuardOn = false;
                        }
                    } catch(_eFlag) {}
                    if (_jailGuardOn) mod *= 0.10; // ~90% less illness incidence
                }
            } catch(_eSm) {}
            townHealthMod[t.id] = mod;
            townHasHospital[t.id] = hasHosp;
            townHasClinic[t.id] = hasClin;
        }

        // Track sick counts per town for contagion
        var townSick = {};   // townId → [person, ...]
        var townHealthy = {}; // townId → [person, ...]

        // Main pass: tick existing illness + roll new random illness
        var _healthAlive = (typeof Engine !== 'undefined' && Engine.getTickCache) ? (Engine.getTickCache().alivePeople || world.people) : world.people;
        for (var i = 0; i < _healthAlive.length; i++) {
            var p = _healthAlive[i];
            if (!p.alive) continue;
            // Story Mode: protect story NPCs from random health events
            if (p.isStoryNPC && typeof Player !== 'undefined' && Player.state && Player.state.storyMode &&
                Player.state.storyMode.active && Player.state.storyMode.flags && Player.state.storyMode.flags.protectFamily) continue;
            var tid = p.townId;
            if (!tid) continue;

            if (p.sick) {
                if (!townSick[tid]) townSick[tid] = [];
                townSick[tid].push(p);
                _tickPersonIllness(p, rng, day, tickScale, townHasHospital[tid], townHasClinic[tid]);
            } else {
                if (!townHealthy[tid]) townHealthy[tid] = [];
                townHealthy[tid].push(p);
                // Roll for new random illness
                var tMod = townHealthMod[tid] || 1.0;
                var roll = rng.random();
                if (roll < severeRate * tMod) {
                    _infectRandomSeverity(p, 'severe', seasonLower, rng, day, 'random');
                } else if (roll < (severeRate + moderateRate) * tMod) {
                    _infectRandomSeverity(p, 'moderate', seasonLower, rng, day, 'random');
                } else if (roll < (severeRate + moderateRate + minorRate) * tMod) {
                    _infectRandomSeverity(p, 'minor', seasonLower, rng, day, 'random');
                }
            }
            // Tick existing injuries (independent of illness)
            if (p.injured) {
                _tickPersonInjury(p, rng, day, tickScale);
            }
        }

        // ---- NPC Random Injuries ----
        // Target rates per year: ~10% minor, ~5% moderate, ~1% severe
        var injMinorRate = (0.10 / daysPerYear) * tickScale;
        var injModRate = (0.05 / daysPerYear) * tickScale;
        var injSevRate = (0.01 / daysPerYear) * tickScale;

        // Injury type pools by severity
        var _injPool = {
            minor: [
                { id: 'cuts', name: 'Cuts & Bruises' },
                { id: 'bruise', name: 'Bruise' },
                { id: 'exhaustion_collapse', name: 'Exhaustion Collapse' }
            ],
            moderate: [
                { id: 'broken_bone', name: 'Broken Bone' },
                { id: 'concussion', name: 'Concussion' },
                { id: 'ambush_wound', name: 'Work Injury' }
            ],
            severe: [
                { id: 'deep_wound', name: 'Deep Wound' },
                { id: 'encounter_wound_severe', name: 'Severe Injury' }
            ]
        };

        // Dangerous occupations get higher injury rates
        var _dangerousJobs = {
            soldier: 3.0, guard: 2.5, miner: 2.0, lumberjack: 1.8,
            blacksmith: 1.5, hunter: 1.8, sailor: 1.6, construction: 1.5,
            quarry_worker: 1.8, fisherman: 1.3
        };

        var _injAlive = (typeof Engine !== 'undefined' && Engine.getTickCache) ? (Engine.getTickCache().alivePeople || world.people) : world.people;
        for (var ii = 0; ii < _injAlive.length; ii++) {
            var ip = _injAlive[ii];
            if (!ip.alive || ip.injured || !ip.townId) continue;

            var injMult = _dangerousJobs[ip.occupation] || 1.0;
            // Soldiers in warring kingdoms get extra risk
            if ((ip.occupation === 'soldier' || ip.occupation === 'guard') && ip.kingdomId) {
                var ipKingdom = findKingdom(ip.kingdomId);
                if (ipKingdom && ipKingdom.atWar) {
                    var _warCount = Array.isArray(ipKingdom.atWar) ? ipKingdom.atWar.length : ipKingdom.atWar.size;
                    // v9p33river333: atWar may be a legacy array or a Set.
                    if (_warCount > 0) injMult *= 1.5;
                }
            }

            var injRoll = rng.random();
            var sev = null;
            if (injRoll < injSevRate * injMult) {
                sev = 'severe';
            } else if (injRoll < (injSevRate + injModRate) * injMult) {
                sev = 'moderate';
            } else if (injRoll < (injSevRate + injModRate + injMinorRate) * injMult) {
                sev = 'minor';
            }

            if (sev) {
                var pool = _injPool[sev];
                var picked = pool[rng.randInt(0, pool.length - 1)];
                ip.injured = true;
                ip.injuryDay = day;
                ip.injuryType = picked.id;
                ip.injuryName = picked.name;
                ip.injurySeverity = sev;
                // Health hit
                var hpHit = sev === 'severe' ? 20 : sev === 'moderate' ? 10 : 5;
                ip.health = Math.max(1, (ip.health || 100) - hpHit);
            }
        }

        // Contagion: spread within towns
        _spreadContagionWithinTowns(townSick, townHealthy, townHealthMod, rng, day, seasonLower);

        // Contagion: spread between connected towns (slow, only for plague)
        if (day % 9 === 0) {
            _spreadContagionBetweenTowns(townSick, townHealthy, rng, day, seasonLower);
        }

        // (Batch illness death notifications removed — only notable deaths are reported individually)
    }

    function _tickPersonIllness(person, rng, day, tickScale, hasHospital, hasClinic) {
        var ills = (typeof NPC_HEALTH_CONFIG !== 'undefined' && NPC_HEALTH_CONFIG.ILLNESSES) ? NPC_HEALTH_CONFIG.ILLNESSES : {};
        var illDef = ills[person.illness];
        // v9p33river243: poison should never be asymptomatic — clear stale flag
        // on already-infected NPCs from older saves
        if (person.illness === 'poisoned' && person.asymptomatic) person.asymptomatic = false;
        // v9p33river242: log entry for poisoned NPCs so we can see if this is even being called
        if (person.illness === 'poisoned') {
            _dbgPoison('TICK ENTER', person, { hasIllDef: !!illDef, sick: person.sick, asymp: person.asymptomatic, illness: person.illness, illnessSeverity: person.illnessSeverity, _illnessTreatPaid: person._illnessTreatPaid });
        }
        if (!illDef) { person.sick = false; person.illness = null; return; }

        var daysSick = day - (person.illnessDay || day);
        var _pSev = person.illnessSeverity || illDef.severity || 'minor';
        // Scale health drain and recovery by person's actual severity, not just illness definition
        var _sevMult = _pSev === 'severe' ? 1.0 : (_pSev === 'moderate' ? 0.55 : 0.25);
        // Age modifier: older NPCs drain faster, recover slower
        var _pAge = person.age || 25;
        var _ageDrainMult = 1.0;
        var _ageRecovMult = 1.0; // multiplier on recovery chance (lower = worse)
        if (_pAge >= 41) { _ageDrainMult = 1.25; _ageRecovMult = 0.7; }
        else if (_pAge >= 31) { _ageDrainMult = 1.1; _ageRecovMult = 0.85; }
        var healthDrain = (illDef.healthDrain || 0.5) * _sevMult * _ageDrainMult * tickScale;

        // v9p33river261: per-tick RNG variance for poison only (±25%).
        // Some bodies fight the toxin better than others, and some days are
        // worse — adds unpredictability to kingslaying / assassinations so
        // outcomes aren't perfectly calculable from base stats.
        if (person.illness === 'poisoned') {
            var _poisonJitter = 0.75 + rng.random() * 0.5; // [0.75, 1.25)
            healthDrain *= _poisonJitter;
        }

        // Asymptomatic carriers: no health drain, but still contagious
        if (person.asymptomatic) {
            if (daysSick >= (illDef.daysToRecover || 14)) {
                person.sick = false;
                person.illness = null;
                person.asymptomatic = false;
                person.health = Math.min(100, person.health + 5);
            }
            return;
        }

        // Treatment: check if person is being treated via hospital queue system
        var treated = person._illnessTreatPaid || false;

        // v9p33river244: poison treatment is now MUCH more effective (kings survive ~70%)
        // Hospital × 0.40 (was 0.75) — treatment substantially neutralizes the toxin
        // Clinic × 0.65 (was 0.85)
        var _isPoison = person.illness === 'poisoned';
        if (treated) {
            if (hasHospital) healthDrain *= (_isPoison ? 0.40 : 0.3);
            else if (hasClinic) healthDrain *= (_isPoison ? 0.65 : 0.6);
        }
        // NPC medical self-treatment
        if (person.medicalKnowledge && person.medicalKnowledge !== 'none') {
            healthDrain *= (_isPoison ? 0.75 : 0.7);
            treated = true;
        }
        person.illnessTreated = treated;

        // Apply health drain
        var _hpBefore = person.health;
        person.health = Math.max(0, person.health - healthDrain);
        if (_isPoison) {
            _dbgPoison('TICK drain', person, {
                hpBefore: _hpBefore.toFixed(1),
                hpAfter: person.health.toFixed(1),
                drain: healthDrain.toFixed(2),
                treated: treated,
                hasHospital: hasHospital,
                hasClinic: hasClinic,
                daysSick: daysSick,
                tickScale: tickScale
            });
        }

        // Recovery check — milder cases recover faster
        var recoveryDays = illDef.daysToRecover || 14;
        if (_pSev === 'minor') recoveryDays = Math.floor(recoveryDays * 0.4);
        else if (_pSev === 'moderate') recoveryDays = Math.floor(recoveryDays * 0.65);
        if (treated) recoveryDays = Math.floor(recoveryDays * 0.6);
        var recovChance = (illDef.recoveryChance || 0.3) * tickScale;
        if (_pSev === 'minor') recovChance *= 2.5;
        else if (_pSev === 'moderate') recovChance *= 1.6;
        recovChance *= _ageRecovMult;
        if (daysSick >= recoveryDays && rng.chance(recovChance)) {
            // v9p33river244: don't allow recovery when already at 0 hp (would
            // resurrect a dying NPC that killPerson failed to actually finish)
            if (person.health <= 0) {
                if (_isPoison) _dbgPoison('SUPPRESSED illness-recovery (hp<=0)', person, {});
            } else {
                if (_isPoison) _dbgPoison('RECOVERED (illness recoveryChance roll)', person, { recoveryDays: recoveryDays, recovChance: recovChance.toFixed(3), daysSick: daysSick });
                person.sick = false;
                person.illness = null;
                person.asymptomatic = false;
                person.illnesses = []; // v9p33river329: clear array-backed illness state too.
                person._illnessTreatPaid = false;
                person.health = Math.min(100, person.health + 10);
                return;
            }
        }

        // Natural health recovery (slow, even while sick if treated)
        // v9p33river239: poison neutralizes the natural-heal benefit
        if (treated && !_isPoison) {
            person.health = Math.min(100, person.health + (NPC_HEALTH_CONFIG.DOCTOR_HEAL_PER_DAY || 3.0) * tickScale * 0.3);
        }

        // Natural immune recovery — some people fight it off even untreated
        // Milder cases have much better natural recovery
        if (illDef.naturalRecoveryDay && illDef.naturalRecoveryChance) {
            var _natDay = illDef.naturalRecoveryDay;
            var _natChance = illDef.naturalRecoveryChance * tickScale;
            if (_pSev === 'minor') { _natDay = Math.floor(_natDay * 0.5); _natChance *= 3.0; }
            else if (_pSev === 'moderate') { _natDay = Math.floor(_natDay * 0.7); _natChance *= 1.8; }
            _natChance *= _ageRecovMult;
            if (daysSick >= _natDay && rng.chance(_natChance)) {
                // v9p33river244: don't allow natural recovery when at 0 hp
                if (person.health <= 0) {
                    if (_isPoison) _dbgPoison('SUPPRESSED nat-recovery (hp<=0)', person, {});
                } else {
                    if (_isPoison) _dbgPoison('RECOVERED (naturalRecovery roll)', person, { natDay: _natDay, natChance: _natChance.toFixed(3), daysSick: daysSick });
                    person.sick = false;
                    person.illness = null;
                    person.asymptomatic = false;
                    person.illnesses = []; // v9p33river329: clear array-backed illness state too.
                    person._illnessTreatPaid = false;
                    person.health = Math.min(100, Math.max(5, person.health) + 5);
                    return;
                }
            }
        }

        // Death check
        if (person.health <= 0) {
            // v9p33river244: pass 'poisoned' as cause so killPerson can bypass
            // child-protection (poisoning is deliberate murder, not accidental
            // illness — and our previous trace showed an age-17 king getting
            // saved 95% of the time by the generic 'illness' child-protect roll)
            var _deathCause = (_isPoison ? 'poisoned' : 'illness');
            if (_isPoison) _dbgPoison('💀 DIED of poison — calling killPerson(' + _deathCause + ')', person, { daysSick: daysSick, treated: treated, age: person.age, isKing: !!person.isKing });
            var _wasAliveBeforeKill = person.alive;
            killPerson(person, _deathCause);
            // v9p33river333: only force fallback death if killPerson left the original live NPC alive.
            // v9p33river244: if poison-kill was somehow blocked but the NPC is
            // at 0 hp and poisoned, there's no realistic recovery — clean up
            // the corpse-state so they don't keep ticking
            if (_isPoison && _wasAliveBeforeKill && person.alive && person.health <= 0) {
                if (_dbgPoison) _dbgPoison('⚠️ killPerson DID NOT actually kill — forcing dead', person, {});
                person.alive = false;
                person.causeOfDeath = 'poisoned';
                person.sick = false;
                person.illness = null;
                person._illnessTreatPaid = false;
                var _ftown = findTown(person.townId);
                if (_ftown) _ftown.population = Math.max(0, _ftown.population - 1);
                if (world && world._alivePopCount != null) world._alivePopCount--;
            }
            var _dTown = findTown(person.townId);
            var _dIllName = (illDef.name || person.illness || 'illness');
            // Notable deaths get individual notifications
            var _isNotable = false;
            if (person.isKing || person.isNoble || person.isEliteMerchant) _isNotable = true;
            // Check if family or relationship >= 10 with player
            if (!_isNotable && typeof Player !== 'undefined') {
                try {
                    var _pState = Player.state || Player;
                    if (_pState.familyMembers) {
                        for (var _fi = 0; _fi < _pState.familyMembers.length; _fi++) {
                            var _pfm = _pState.familyMembers[_fi];
                            var _pfmId = (typeof _pfm === 'string') ? _pfm : (_pfm && (_pfm.npcId || _pfm.id || _pfm.personId));
                            // v9p33river333: mixed familyMembers shapes should all notify once.
                            if (_pfmId === person.id) { _isNotable = true; break; }
                        }
                    }
                    if (!_isNotable && _pState.spouseId === person.id) _isNotable = true;
                    if (!_isNotable && _pState.relationships && (_pState.relationships[person.id] || 0) > 20) _isNotable = true;
                } catch(e) { console.warn('[Health] relationship check error:', e.message); }
            }
            if (_isNotable) {
                var _roleTag = person.isKing ? '👑 King ' : person.isNoble ? '🏰 Noble ' : person.isEliteMerchant ? '💰 Elite Merchant ' : '';
                logEvent('💀 ' + _roleTag + person.firstName + ' ' + (person.lastName || '') + ' of ' + (_dTown ? _dTown.name : 'unknown') + ' died of ' + _dIllName + '.', {
                    type: 'npc_illness_death', townId: person.townId
                }, 'illness');
            }
            // Non-notable deaths are silent — no notification
        }
    }

    // Tick NPC injury: minor heals 7-14d, moderate 14-30d (can escalate), severe never heals naturally (fatal 30-60d)
    function _tickPersonInjury(person, rng, day, tickScale) {
        var daysInjured = day - (person.injuryDay || day);
        var sev = person.injurySeverity || person.illnessSeverity || 'minor';

        if (sev === 'minor') {
            // Minor: heals on its own in 7-14 days
            if (daysInjured >= 7) {
                var minorChance = Math.min(0.5, 0.10 + (daysInjured - 7) * 0.06) * tickScale;
                if (rng.chance(minorChance)) {
                    person.injured = false;
                    person.injuryType = null;
                    person.injuryName = null;
                    person.injurySeverity = null;
                    person._illnessTreatPaid = false;
                    person.health = Math.min(100, (person.health || 50) + 5);
                    return;
                }
            }
            // Guaranteed heal by day 14
            if (daysInjured >= 14) {
                person.injured = false;
                person.injuryType = null;
                person.injuryName = null;
                person.injurySeverity = null;
                person._illnessTreatPaid = false;
                person.health = Math.min(100, (person.health || 50) + 5);
                return;
            }
        } else if (sev === 'moderate') {
            // Moderate: heals in 14-30 days, but chance to escalate to severe
            // Escalation chance: ~2% per 3-day tick after day 10 if untreated
            if (!person._illnessTreatPaid && daysInjured >= 10) {
                var escalateChance = 0.02 * tickScale;
                if (rng.chance(escalateChance)) {
                    person.injurySeverity = 'severe';
                    person.injuryName = (person.injuryName || 'Injury') + ' (worsened)';
                    person.health = Math.max(1, (person.health || 100) - 15);
                    return;
                }
            }
            // Natural healing after 14 days
            if (daysInjured >= 14) {
                var modChance = Math.min(0.4, 0.08 + (daysInjured - 14) * 0.03) * tickScale;
                if (rng.chance(modChance)) {
                    person.injured = false;
                    person.injuryType = null;
                    person.injuryName = null;
                    person.injurySeverity = null;
                    person._illnessTreatPaid = false;
                    person.health = Math.min(100, (person.health || 50) + 10);
                    return;
                }
            }
            // Guaranteed heal by day 30
            if (daysInjured >= 30) {
                person.injured = false;
                person.injuryType = null;
                person.injuryName = null;
                person.injurySeverity = null;
                person._illnessTreatPaid = false;
                person.health = Math.min(100, (person.health || 50) + 10);
                return;
            }
        } else if (sev === 'severe') {
            // Severe: never heals naturally, kills in 30-60 days untreated
            // Slow health drain
            var drainRate = 0.5 * tickScale; // ~0.5 HP per day
            if (person._illnessTreatPaid) drainRate *= 0.2; // treatment slows drain dramatically
            person.health = Math.max(0, (person.health || 100) - drainRate);

            // Death: after 30 days, increasing chance; guaranteed by ~60 days via health drain
            if (person.health <= 0) {
                killPerson(person, 'injury');
                var _injTown = findTown(person.townId);
                var _isNotable = person.isKing || person.isNoble || person.isEliteMerchant;
                if (!_isNotable && typeof Player !== 'undefined') {
                    try {
                        var _ps = Player.state || Player;
                        if (_ps.spouseId === person.id) _isNotable = true;
                        if (!_isNotable && _ps.relationships && (_ps.relationships[person.id] || 0) > 20) _isNotable = true;
                    } catch(e) { console.warn('[Health] relationship check error:', e.message); }
                }
                if (_isNotable) {
                    var _roleTag = person.isKing ? '👑 King ' : person.isNoble ? '🏰 Noble ' : person.isEliteMerchant ? '💰 Elite Merchant ' : '';
                    logEvent('💀 ' + _roleTag + person.firstName + ' ' + (person.lastName || '') + ' of ' + (_injTown ? _injTown.name : 'unknown') + ' died from ' + (person.injuryName || 'severe injuries') + '.', {
                        type: 'npc_injury_death', townId: person.townId
                    }, 'illness');
                }
            }
        }
    }

    function _spreadContagionWithinTowns(townSick, townHealthy, townHealthMod, rng, day, seasonLower) {
        var ills = (typeof NPC_HEALTH_CONFIG !== 'undefined' && NPC_HEALTH_CONFIG.ILLNESSES) ? NPC_HEALTH_CONFIG.ILLNESSES : {};

        for (var tid in townSick) {
            var sickList = townSick[tid];
            var healthyList = townHealthy[tid] || [];
            if (healthyList.length === 0) continue;

            var town = findTown(tid);
            var pop = (town ? town.population : sickList.length + healthyList.length) || 1;
            var prosp = town ? (town.prosperity || 50) : 50;

            // Count contagious sick by illness
            var contagiousCounts = {};
            for (var si = 0; si < sickList.length; si++) {
                var sp = sickList[si];
                var sIll = ills[sp.illness];
                if (!sIll) continue;
                // Only flu, cold, and plague are contagious
                var isContagious = (sIll.contagious) || sp.illness === 'cold' || sp.illness === 'flu';
                if (!isContagious) continue;
                if (!contagiousCounts[sp.illness]) contagiousCounts[sp.illness] = 0;
                contagiousCounts[sp.illness]++;
            }

            var _alreadyRolledHealthy = {}; // v9p33river333: one pathogen roll per healthy NPC per town tick.

            for (var illId in contagiousCounts) {
                var sickCount = contagiousCounts[illId];
                var illDef = ills[illId];
                if (!illDef) continue;

                // Base contagion rate per healthy person
                var sickRatio = sickCount / pop;
                var baseRate;
                if (illDef.contagious) {
                    // Plague: moderate spread
                    baseRate = (illDef.spreadChance || 0.02) * sickRatio * 15;
                } else {
                    // Cold/flu: slow spread
                    baseRate = 0.003 * sickRatio * 10;
                }

                // Population modifier: bigger towns spread faster
                if (pop > 300) baseRate *= 1.3;
                else if (pop < 60) baseRate *= 0.5;

                // Prosperity slows spread
                baseRate *= Math.max(0.4, 1.3 - (prosp / 100) * 0.6);

                // Town health infrastructure
                var tMod = townHealthMod[tid] || 1.0;
                baseRate *= tMod;

                // Kingdom quarantine policies
                var kingdom = town && town.kingdomId ? findKingdom(town.kingdomId) : null;
                if (kingdom && kingdom.healthPolicies) {
                    for (var hp = 0; hp < kingdom.healthPolicies.length; hp++) {
                        var pol = kingdom.healthPolicies[hp];
                        if (!pol.active || (pol.expiresDay && day > pol.expiresDay)) continue;
                        if (pol.type === 'martial_quarantine' && (!pol.townId || pol.townId === tid)) baseRate *= 0.05;
                        else if (pol.type === 'quarantine_town' && (!pol.townId || pol.townId === tid)) baseRate *= 0.20; // v9p33river333: town-wide policies may omit townId.
                    }
                }

                // Expected new infections (scaled by tick interval already baked into sickRatio time)
                var expectedNew = Math.max(0, healthyList.length * baseRate * 3); // *3 for tick interval
                var newCases = Math.floor(expectedNew);
                if (rng.chance(expectedNew - newCases)) newCases++;

                if (newCases > 0) {
                    // Shuffle healthy list and infect first N
                    var shuffled = healthyList.filter(function(hp) { return hp && !_alreadyRolledHealthy[hp.id]; });
                    for (var shi = shuffled.length - 1; shi > 0; shi--) {
                        var shj = rng.randInt(0, shi);
                        var tmp = shuffled[shi]; shuffled[shi] = shuffled[shj]; shuffled[shj] = tmp;
                    }
                    var infected = 0;
                    for (var ni = 0; ni < Math.min(newCases, shuffled.length); ni++) {
                        var _rollTarget = shuffled[ni];
                        if (_rollTarget && _rollTarget.id) _alreadyRolledHealthy[_rollTarget.id] = true;
                        if (infectNPC(_rollTarget, illId, rng, day, 'contagion')) {
                            infected++;
                            // Remove from healthy pool
                            var hIdx = healthyList.indexOf(_rollTarget);
                            if (hIdx >= 0) healthyList.splice(hIdx, 1);
                        }
                    }
                }
            }
        }
    }

    function _spreadContagionBetweenTowns(townSick, townHealthy, rng, day, seasonLower) {
        var ills = (typeof NPC_HEALTH_CONFIG !== 'undefined' && NPC_HEALTH_CONFIG.ILLNESSES) ? NPC_HEALTH_CONFIG.ILLNESSES : {};

        // All contagious illnesses can spread between towns (cold, flu, plague)
        for (var tid in townSick) {
            var sickList = townSick[tid];
            var town = findTown(tid);
            if (!town) continue;

            var pop = town.population || 1;

            // Count contagious sick by illness type
            var contagiousByIll = {};
            for (var si = 0; si < sickList.length; si++) {
                var sp = sickList[si];
                var sIll = ills[sp.illness];
                if (!sIll) continue;
                var isContagious = (sIll.contagious) || sp.illness === 'cold' || sp.illness === 'flu';
                if (!isContagious) continue;
                if (!contagiousByIll[sp.illness]) contagiousByIll[sp.illness] = 0;
                contagiousByIll[sp.illness]++;
            }

            // Check quarantine policies blocking outbound spread
            var kingdom = town.kingdomId ? findKingdom(town.kingdomId) : null;
            var isQuarantined = false;
            var portClosed = false;
            if (kingdom && kingdom.healthPolicies) {
                for (var hp = 0; hp < kingdom.healthPolicies.length; hp++) {
                    var pol = kingdom.healthPolicies[hp];
                    if (!pol.active || (pol.expiresDay && day > pol.expiresDay)) continue;
                    if ((pol.type === 'quarantine_town' || pol.type === 'martial_quarantine') && (!pol.townId || pol.townId === tid)) isQuarantined = true;
                    if (pol.type === 'close_port' && (!pol.townId || pol.townId === tid)) portClosed = true; // v9p33river333: town-wide policies may omit townId.
                }
            }

            for (var illId in contagiousByIll) {
                var sickCount = contagiousByIll[illId];
                var illDef = ills[illId];
                if (!illDef) continue;
                var sickRatio = sickCount / pop;

                // Need a meaningful sick ratio before it can jump towns
                var minRatioForSpread = (illDef.contagious) ? 0.02 : 0.05;
                if (sickRatio < minRatioForSpread) continue;

                // Base cross-town rate: much lower than within-town
                // Plague: moderate, cold/flu: very slow
                var baseXTownRate = (illDef.contagious) ? 0.006 : 0.001;
                baseXTownRate *= sickRatio;
                baseXTownRate *= 9; // scale for every-9-day tick

                // ---- Spread via roads ----
                if (!isQuarantined) {
                    var roads = world.roads || [];
                    for (var ri = 0; ri < roads.length; ri++) {
                        var road = roads[ri];
                        var neighborId = null;
                        if (road.fromTownId === tid) neighborId = road.toTownId;
                        else if (road.toTownId === tid) neighborId = road.fromTownId;
                        if (!neighborId) continue;

                        // Disease cannot spread across destroyed bridges
                        var _dsBridgeOut = false;
                        if (road.bridges && road.bridges.length > 0) {
                            for (var _dsbi = 0; _dsbi < road.bridges.length; _dsbi++) {
                                if (road.bridges[_dsbi].destroyed) { _dsBridgeOut = true; break; }
                            }
                        } else if (road.hasBridge && road.bridgeDestroyed) { _dsBridgeOut = true; }
                        if (_dsBridgeOut) continue;

                        var nTown = findTown(neighborId);
                        if (!nTown) continue;

                        // Check if destination is blocking incoming
                        var nBlocked = _isTownBlockingIncoming(nTown, day);
                        if (nBlocked) continue;

                        // Distance factor: longer routes = slower spread
                        var dx = (town.x || 0) - (nTown.x || 0);
                        var dy = (town.y || 0) - (nTown.y || 0);
                        var dist = Math.sqrt(dx * dx + dy * dy) || 1;
                        var distFactor = Math.max(0.1, 1.0 / (1 + dist / 50)); // halved at dist 50, quartered at dist 150

                        // Prosperity of destination slows spread
                        var nProsp = (nTown.prosperity || 50) / 100;
                        var prospFactor = Math.max(0.3, 1.2 - nProsp * 0.5);

                        // Lower population destinations = slower spread
                        var popFactor = (nTown.population || 50) < 60 ? 0.5 : 1.0;

                        var roadChance = baseXTownRate * distFactor * prospFactor * popFactor;

                        if (rng.chance(roadChance)) {
                            var nHealthy = (townHealthy[neighborId] && townHealthy[neighborId].length > 0) ? townHealthy[neighborId] :
                                world.people.filter(function(np) { return np.alive && np.townId === neighborId && !np.sick; });
                            if (nHealthy.length > 0) {
                                var nToInfect = (illDef.contagious) ? rng.randInt(1, Math.min(3, nHealthy.length)) : 1;
                                for (var nii = 0; nii < nToInfect; nii++) {
                                    var nTarget = nHealthy[rng.randInt(0, nHealthy.length - 1)];
                                    infectNPC(nTarget, illId, rng, day, 'road_spread');
                                }
                                if (illDef.contagious) {
                                    // v9p33river323: log message used to
                                    // always say "Plague" regardless of the
                                    // actual illness. Use the illness name
                                    // for accurate cross-town spread logs.
                                    var _illName = (illDef.name || illId || 'Illness');
                                    logEvent('🦠 ' + _illName + ' has spread along the road from ' + town.name + ' to ' + nTown.name + '!', {
                                        type: 'plague_spread', townId: neighborId
                                    }, 'illness');
                                }
                            }
                        }
                    }
                }

                // ---- Spread via sea routes (slightly worse — cramped ships) ----
                if (town.isPort && !portClosed && (illDef.contagious || illId === 'flu')) {
                    var seaRoutes = world.seaRoutes || [];
                    for (var sri = 0; sri < seaRoutes.length; sri++) {
                        var sr = seaRoutes[sri];
                        var seaNeighborId = null;
                        if (sr.fromTownId === tid) seaNeighborId = sr.toTownId;
                        else if (sr.toTownId === tid) seaNeighborId = sr.fromTownId;
                        if (!seaNeighborId) continue;

                        var seaTown = findTown(seaNeighborId);
                        if (!seaTown) continue;

                        // Check if destination port is blocking incoming
                        var seaBlocked = _isTownBlockingIncoming(seaTown, day);
                        if (seaBlocked) continue;

                        // Sea distance factor (longer voyages = slightly slower, but ships are cramped so 1.4x worse)
                        var sdx = (town.x || 0) - (seaTown.x || 0);
                        var sdy = (town.y || 0) - (seaTown.y || 0);
                        var seaDist = Math.sqrt(sdx * sdx + sdy * sdy) || 1;
                        var seaDistFactor = Math.max(0.15, 1.0 / (1 + seaDist / 80));
                        var seaCrampedBonus = 1.4; // ships are cramped, illness spreads easier

                        var seaProspFactor = Math.max(0.3, 1.2 - ((seaTown.prosperity || 50) / 100) * 0.5);
                        var seaPopFactor = (seaTown.population || 50) < 60 ? 0.5 : 1.0;

                        var seaChance = baseXTownRate * seaDistFactor * seaCrampedBonus * seaProspFactor * seaPopFactor;

                        if (rng.chance(seaChance)) {
                            var seaHealthy = (townHealthy[seaNeighborId] && townHealthy[seaNeighborId].length > 0) ? townHealthy[seaNeighborId] :
                                world.people.filter(function(np) { return np.alive && np.townId === seaNeighborId && !np.sick; });
                            if (seaHealthy.length > 0) {
                                var seaToInfect = (illDef.contagious) ? rng.randInt(1, Math.min(4, seaHealthy.length)) : rng.randInt(1, 2);
                                for (var seaii = 0; seaii < seaToInfect; seaii++) {
                                    var seaTarget = seaHealthy[rng.randInt(0, seaHealthy.length - 1)];
                                    infectNPC(seaTarget, illId, rng, day, 'sea_spread');
                                }
                                logEvent('🦠 ' + (illDef.name || illId) + ' arrived by ship to ' + seaTown.name + ' from ' + town.name + '!',  {
                                    type: 'illness_spread', townId: seaNeighborId
                                ,
                                _noToast: true}, 'illness');
                            }
                        }
                    }
                }
            }
        }
    }

    function _isTownBlockingIncoming(town, day) {
        if (!town || !town.kingdomId) return false;
        var kd = findKingdom(town.kingdomId);
        if (!kd || !kd.healthPolicies) return false;
        for (var i = 0; i < kd.healthPolicies.length; i++) {
            var pol = kd.healthPolicies[i];
            if (!pol.active || (pol.expiresDay && day > pol.expiresDay)) continue;
            if ((pol.type === 'quarantine_town' || pol.type === 'martial_quarantine') && (!pol.townId || pol.townId === town.id)) return true;
            if (pol.type === 'close_roads' && (!pol.townId || pol.townId === town.id)) return true; // v9p33river333: town-wide policies may omit townId.
        }
        return false;
    }

    // ---- King AI Health Policy System ----

    function tickKingHealthPolicy(kingdom) {
        _syncState();
        if (!kingdom) return;
        var day = world.day;
        var rng = world.rng;
        var kp = kingdom.kingPersonality || {};

        // Initialize health policies array
        if (!kingdom.healthPolicies) kingdom.healthPolicies = [];

        // Expire old policies
        for (var ei = kingdom.healthPolicies.length - 1; ei >= 0; ei--) {
            var pol = kingdom.healthPolicies[ei];
            if (pol.expiresDay && day > pol.expiresDay) {
                kingdom.healthPolicies.splice(ei, 1);
            }
        }

        // Calculate sickness stats per kingdom town
        var kingdomTowns = world.towns.filter(function(t) { return t.kingdomId === kingdom.id; });
        var totalPop = 0;
        var totalSick = 0;
        var townStats = [];
        for (var ti = 0; ti < kingdomTowns.length; ti++) {
            var t = kingdomTowns[ti];
            var _tPeople = (typeof Engine !== 'undefined' && Engine.getPeopleInTown) ? Engine.getPeopleInTown(t.id) : [];
            var pop = _tPeople.length, sick = 0, plagueCount = 0;
            for (var pi = 0; pi < _tPeople.length; pi++) {
                var pr = _tPeople[pi];
                if (!pr.alive) continue;
                if (pr.sick) {
                    sick++;
                    var ills = (typeof NPC_HEALTH_CONFIG !== 'undefined' && NPC_HEALTH_CONFIG.ILLNESSES) ? NPC_HEALTH_CONFIG.ILLNESSES : {};
                    var prIll = ills[pr.illness];
                    if (prIll && prIll.contagious) plagueCount++;
                }
            }
            totalPop += pop;
            totalSick += sick;
            if (pop > 0) {
                townStats.push({ town: t, pop: pop, sick: sick, plagueCount: plagueCount, sickRatio: sick / pop, plagueRatio: plagueCount / pop });
            }
        }
        if (totalPop === 0) return;

        var kingdomSickRatio = totalSick / totalPop;

        // Personality thresholds: proactive kings (high justice, high intelligence) react earlier
        var proactiveness = ((kp.justice || 50) + (kp.intelligence || 50) - 50) / 100; // -0.5 to 0.5
        var greedFactor = (kp.greed || 50) / 100; // 0-1, greedy kings resist spending

        // Sort towns by sickness severity
        townStats.sort(function(a, b) { return b.sickRatio - a.sickRatio; });

        for (var tsi = 0; tsi < townStats.length; tsi++) {
            var ts = townStats[tsi];
            var alreadyHasPolicy = kingdom.healthPolicies.some(function(p) { return p.townId === ts.town.id && p.active; });

            // ---- DIAL-DOWN: Remove/weaken policies if town is recovering ----
            if (ts.sickRatio < 0.02) {
                // Town is nearly healthy — lift all policies for this town
                for (var ri = kingdom.healthPolicies.length - 1; ri >= 0; ri--) {
                    var rPol = kingdom.healthPolicies[ri];
                    if (rPol.townId === ts.town.id && rPol.active) {
                        rPol.active = false;
                        rPol.expiresDay = day;
                        logEvent('✅ ' + kingdom.name + ' lifted health measures in ' + ts.town.name + ' — sickness has subsided.', {
                            type: 'health_policy_lifted', townId: ts.town.id, kingdomId: kingdom.id
                        }, 'illness');
                    }
                }
                continue;
            }

            if (ts.sickRatio < 0.05 && alreadyHasPolicy) {
                // Getting better but not gone — downgrade policies
                for (var di = kingdom.healthPolicies.length - 1; di >= 0; di--) {
                    var dPol = kingdom.healthPolicies[di];
                    if (dPol.townId === ts.town.id && dPol.active) {
                        if (dPol.type === 'martial_quarantine') {
                            // Downgrade to regular quarantine
                            dPol.type = 'quarantine_town';
                            dPol.expiresDay = day + 30;
                            dPol.costPerDay = 8; // v9p33river329: downgrade cost with the policy type.
                            logEvent('📉 ' + kingdom.name + ' relaxed martial quarantine to standard quarantine in ' + ts.town.name + '.', {
                                type: 'health_policy_relaxed', townId: ts.town.id, kingdomId: kingdom.id
                            }, 'illness');
                        } else if (dPol.type === 'quarantine_town' && ts.plagueRatio < 0.01) {
                            // Downgrade to just medical funding
                            dPol.type = 'medical_funding';
                            dPol.expiresDay = day + 30;
                            dPol.costPerDay = 10; // v9p33river329: don't keep quarantine pricing after downgrade.
                            logEvent('📉 ' + kingdom.name + ' lifted quarantine in ' + ts.town.name + ', continuing medical support.', {
                                type: 'health_policy_relaxed', townId: ts.town.id, kingdomId: kingdom.id
                            }, 'illness');
                        }
                    }
                }
                continue;
            }

            // ---- ESCALATION: Only act if sickness affects their kingdom ----
            // Reactive kings need higher thresholds to act
            var actionThreshold = 0.08 - proactiveness * 0.04; // proactive: 0.06, reactive: 0.10
            if (ts.sickRatio < actionThreshold && !alreadyHasPolicy) continue;

            // Don't act if can't afford it (greedy kings are more reluctant)
            var treasuryThreshold = greedFactor * 500 + 100;
            if (kingdom.gold < treasuryThreshold) continue;

            // ---- DECIDE POLICY based on severity ----
            var bestPolicy = null;

            if (ts.plagueRatio > 0.15) {
                // Severe plague outbreak — martial quarantine
                if (!alreadyHasPolicy || !kingdom.healthPolicies.some(function(p) { return p.townId === ts.town.id && p.type === 'martial_quarantine' && p.active; })) {
                    bestPolicy = { type: 'martial_quarantine', cost: 15, duration: 60, tradePenalty: 0.80, happinessPenalty: 15 };
                }
            } else if (ts.plagueRatio > 0.05) {
                // Moderate plague — quarantine + medical
                if (!alreadyHasPolicy || !kingdom.healthPolicies.some(function(p) { return p.townId === ts.town.id && p.type === 'quarantine_town' && p.active; })) {
                    bestPolicy = { type: 'quarantine_town', cost: 8, duration: 45, tradePenalty: 0.40, happinessPenalty: 8 };
                }
            } else if (ts.sickRatio > 0.10) {
                // Lots of general sickness — public hygiene + medical funding
                if (!alreadyHasPolicy) {
                    bestPolicy = { type: 'public_hygiene', cost: 5, duration: 30, tradePenalty: 0, happinessPenalty: 2 };
                }
            } else if (ts.sickRatio > actionThreshold) {
                // Growing sickness — medical funding
                if (!alreadyHasPolicy) {
                    bestPolicy = { type: 'medical_funding', cost: 10, duration: 30, tradePenalty: 0, happinessPenalty: 0 };
                }
            }

            // Port towns: close port if plague is spreading
            if (ts.town.isPort && ts.plagueRatio > 0.05) {
                var hasPortPolicy = kingdom.healthPolicies.some(function(p) { return p.townId === ts.town.id && p.type === 'close_port' && p.active; });
                if (!hasPortPolicy && kingdom.gold >= 100) {
                    kingdom.healthPolicies.push({
                        type: 'close_port', townId: ts.town.id, active: true,
                        startDay: day, expiresDay: day + 45, costPerDay: 3
                    });
                    logEvent('⚓ ' + kingdom.name + ' closed the port in ' + ts.town.name + ' to prevent plague spread by sea.', {
                        type: 'health_policy', townId: ts.town.id, kingdomId: kingdom.id
                    }, 'illness');
                }
            }

            if (bestPolicy && kingdom.gold >= bestPolicy.cost * bestPolicy.duration * 0.5) {
                var _shouldConsultRA = isPlayerRoyalAdvisorOf(kingdom) && (bestPolicy.type === 'quarantine_town' || bestPolicy.type === 'martial_quarantine' || bestPolicy.type === 'close_port');
                if (_shouldConsultRA) {
                    var _policyNames2 = {
                        quarantine_town: 'quarantine',
                        martial_quarantine: 'martial quarantine',
                        close_port: 'port closure'
                    };
                    proposeKingDecision(kingdom, {
                        type: 'health_policy',
                        description: 'Impose ' + (_policyNames2[bestPolicy.type] || bestPolicy.type) + ' on ' + ts.town.name,
                        details: 'Sickness ratio: ' + Math.round(ts.sickRatio * 100) + '%. Plague: ' + Math.round((ts.plagueRatio || 0) * 100) + '%. Cost: ' + bestPolicy.cost + 'g/day.',
                        conviction: bestPolicy.type === 'martial_quarantine' ? 0.8 : 0.5,
                        execute: (function(kRef, bp, tsRef) { return function() {
                            for (var oi2 = kRef.healthPolicies.length - 1; oi2 >= 0; oi2--) {
                                if (kRef.healthPolicies[oi2].townId === tsRef.town.id && kRef.healthPolicies[oi2].active && kRef.healthPolicies[oi2].type !== 'close_port') {
                                    kRef.healthPolicies[oi2].active = false; // v9p33river329: port closures can coexist with medical/quarantine policy.
                                }
                            }
                            kRef.healthPolicies.push({
                                type: bp.type, townId: tsRef.town.id, active: true,
                                startDay: world.day, expiresDay: world.day + bp.duration,
                                costPerDay: bp.cost
                            });
                            if (bp.happinessPenalty > 0) {
                                tsRef.town.happiness = Math.max(0, (tsRef.town.happiness || 50) - bp.happinessPenalty);
                            }
                            var _pn = { medical_funding: '🏥 medical funding', public_hygiene: '🧹 public hygiene measures', quarantine_town: '🔒 quarantine', martial_quarantine: '⚔️ martial quarantine', close_port: '⚓ port closure' };
                            logEvent((_pn[bp.type] || bp.type) + ' enacted in ' + tsRef.town.name + ' by ' + kRef.name + '.', { type: 'health_policy', townId: tsRef.town.id, kingdomId: kRef.id }, 'illness');
                        }; })(kingdom, bestPolicy, ts)
                    });
                } else {
                // Remove existing lower-tier policy for this town before adding
                for (var oi = kingdom.healthPolicies.length - 1; oi >= 0; oi--) {
                    if (kingdom.healthPolicies[oi].townId === ts.town.id && kingdom.healthPolicies[oi].active && kingdom.healthPolicies[oi].type !== 'close_port') {
                        kingdom.healthPolicies[oi].active = false; // v9p33river329: keep independent port closure active.
                    }
                }

                kingdom.healthPolicies.push({
                    type: bestPolicy.type, townId: ts.town.id, active: true,
                    startDay: day, expiresDay: day + bestPolicy.duration,
                    costPerDay: bestPolicy.cost
                });

                // Apply consequences
                if (bestPolicy.happinessPenalty > 0) {
                    ts.town.happiness = Math.max(0, (ts.town.happiness || 50) - bestPolicy.happinessPenalty);
                }

                var policyNames = {
                    medical_funding: '🏥 medical funding',
                    public_hygiene: '🧹 public hygiene measures',
                    quarantine_town: '🔒 quarantine',
                    martial_quarantine: '⚔️ martial quarantine',
                    close_port: '⚓ port closure'
                };
                logEvent((policyNames[bestPolicy.type] || bestPolicy.type) + ' enacted in ' + ts.town.name + ' by ' + kingdom.name + '.', {
                    type: 'health_policy', townId: ts.town.id, kingdomId: kingdom.id
                }, 'illness');
                } // close else (non-RA path)
            }
        }

        // Pay daily costs for active policies
        for (var ci = 0; ci < kingdom.healthPolicies.length; ci++) {
            var cPol = kingdom.healthPolicies[ci];
            if (!cPol.active) continue;
            var cost = cPol.costPerDay || 0;
            if (cost > 0) {
                kingdom.gold -= cost;
                // If kingdom runs out of gold, force-expire policy
                if (kingdom.gold < 0) {
                    kingdom.gold = 0;
                    cPol.active = false;
                    cPol.expiresDay = day;
                    logEvent('💸 ' + kingdom.name + ' can no longer afford health measures — policies lifted.', {
                        type: 'health_policy_expired', kingdomId: kingdom.id
                    }, 'illness');
                }
            }
        }

        // Kingdom AI: build medical infrastructure when needed
        if (kingdom.gold > 500 && rng.chance(0.02)) {
            var _mbTerritoriesArr = Array.from(kingdom.territories);
            for (var _mbi = 0; _mbi < _mbTerritoriesArr.length; _mbi++) {
                var _mbTown = findTown(_mbTerritoriesArr[_mbi]);
                if (!_mbTown) continue;
                var _hasSickNpcs = world.people.some(function(p) { return p.alive && p.townId === _mbTown.id && p.sick; });
                if (!_hasSickNpcs && !rng.chance(0.1)) continue;
                var _hasApoth = _mbTown.buildings.some(function(b) { return b.type === 'apothecary'; });
                var _hasAdvApoth = _mbTown.buildings.some(function(b) { return b.type === 'advanced_apothecary'; });
                var _hasHerbGarden = _mbTown.buildings.some(function(b) { return b.type === 'herb_garden'; });
                var _hasBandageWs = _mbTown.buildings.some(function(b) { return b.type === 'bandage_workshop'; });
                if (!_hasHerbGarden && kingdom.gold >= 200) {
                    if (kingdomBuild(kingdom, _mbTown, 'herb_garden', rng)) {
                        logEvent('🌿 ' + kingdom.name + ' built an herb garden in ' + _mbTown.name + '.', { type: 'kingdom_build', kingdomId: kingdom.id, townId: _mbTown.id, _noToast: true }, 'my_kingdom'); break;
                    }
                }
                if (!_hasApoth && _hasHerbGarden && kingdom.gold >= 500) {
                    if (kingdomBuild(kingdom, _mbTown, 'apothecary', rng)) {
                        logEvent('⚗️ ' + kingdom.name + ' built an apothecary in ' + _mbTown.name + '.', { type: 'kingdom_build', kingdomId: kingdom.id, townId: _mbTown.id, _noToast: true }, 'my_kingdom'); break;
                    }
                }
                if (!_hasBandageWs && kingdom.gold >= 300) {
                    if (kingdomBuild(kingdom, _mbTown, 'bandage_workshop', rng)) {
                        logEvent('🩹 ' + kingdom.name + ' built a bandage workshop in ' + _mbTown.name + '.', { type: 'kingdom_build', kingdomId: kingdom.id, townId: _mbTown.id, _noToast: true }, 'my_kingdom'); break;
                    }
                }
                if (_hasApoth && !_hasAdvApoth && (_mbTown.category === 'city' || _mbTown.category === 'capital_city') && kingdom.gold >= 900) {
                    if (kingdomBuild(kingdom, _mbTown, 'advanced_apothecary', rng)) {
                        logEvent('🧬 ' + kingdom.name + ' built an advanced apothecary in ' + _mbTown.name + '.', { type: 'kingdom_build', kingdomId: kingdom.id, townId: _mbTown.id, _noToast: true }, 'my_kingdom'); break;
                    }
                }
            }
        }
    }

    // ========================================================
    // §16b HOSPITAL / CLINIC TREATMENT SYSTEM
    // ========================================================

    /**
     * Get AI-driven treatment fee for a medical facility.
     * Owner considers: local wages, capacity utilization, severity.
     */
    function getHospitalTreatmentFee(town, bld, bt, severity) {
        // Base fee by severity
        var baseFee = { minor: 10, moderate: 30, serious: 60, severe: 100 };
        var fee = baseFee[severity] || 10;

        // Local economy modifier: use average food price as wage proxy
        var econMod = 1.0;
        if (town && town.market && town.market.prices) {
            var foodPrices = ['wheat', 'bread', 'fish', 'meat'];
            var totalFoodPrice = 0, foodCount = 0;
            for (var fi = 0; fi < foodPrices.length; fi++) {
                var fp = town.market.prices[foodPrices[fi]];
                if (fp && fp > 0) { totalFoodPrice += fp; foodCount++; }
            }
            if (foodCount > 0) {
                var avgFoodPrice = totalFoodPrice / foodCount;
                econMod = Math.max(0.5, Math.min(2.5, avgFoodPrice / 7.5));
            }
        }
        // Prosperity modifier
        var prospMod = 0.7 + ((town.prosperity || 50) / 100) * 0.8;

        // Capacity utilization — more patients waiting = higher price
        var queue = bld._treatmentQueue || [];
        var baseHealers2 = (bt && bt.maxHealers != null) ? bt.maxHealers : ((bt && bt.workers != null) ? bt.workers : 2);
        var workerCount2 = _resolveWorkerCount(bld);
        var maxHealers = baseHealers2 + Math.floor(workerCount2 / 2);
        var utilization = queue.length / Math.max(maxHealers, 1);
        var demandMod = 1.0 + Math.min(1.0, utilization) * 0.5; // up to +50% at full capacity

        fee = Math.round(fee * econMod * prospMod * demandMod);
        return Math.max(1, fee);
    }

    // v9p33river115: town.buildings entries for player-owned buildings are slim
    // copies and do NOT carry the workers array. Helper resolves the canonical
    // worker count from Player.buildings when needed.
    function _resolveWorkerCount(bld) {
        if (Array.isArray(bld.workers)) return bld.workers.length;
        if (bld.ownerId === 'player' && typeof Player !== 'undefined' && Array.isArray(Player.buildings)) {
            for (var _i = 0; _i < Player.buildings.length; _i++) {
                if (Player.buildings[_i].id === bld.id) {
                    return Array.isArray(Player.buildings[_i].workers) ? Player.buildings[_i].workers.length : 0;
                }
            }
        }
        return 0;
    }

    /**
     * Consume medical supplies from building stock, retail stock, or market.
     * Supports medicine substitution: higher-tier meds can replace lower-tier.
     * Returns the total market-value cost of supplies consumed.
     */
    function _consumeTreatmentSupplies(bld, town, severity, isIllness) {
        var supplyDef;
        if (isIllness) {
            supplyDef = (NPC_HEALTH_CONFIG.TREATMENT_SUPPLIES_ILLNESS && NPC_HEALTH_CONFIG.TREATMENT_SUPPLIES_ILLNESS[severity]) || null;
        } else {
            supplyDef = (NPC_HEALTH_CONFIG.TREATMENT_SUPPLIES_INJURY && NPC_HEALTH_CONFIG.TREATMENT_SUPPLIES_INJURY[severity]) || null;
        }
        if (!supplyDef) supplyDef = (NPC_HEALTH_CONFIG.TREATMENT_SUPPLIES && NPC_HEALTH_CONFIG.TREATMENT_SUPPLIES[severity]) || null;
        var totalCost = 0;
        if (!supplyDef) return totalCost;

        var medRank = NPC_HEALTH_CONFIG.MEDICINE_RANK || ['herbal_remedy', 'fever_tonic', 'healing_tonic', 'antidote'];

        // Preflight: determine what will be consumed for each required item
        var plan = []; // [{key, needed, resolvedKey}]
        for (var supKey in supplyDef) {
            var needed = supplyDef[supKey];
            var resolved = null;
            // Try exact match first
            if (_checkStockAvailable(bld, town, supKey, needed)) {
                resolved = supKey;
            } else {
                // Try higher-tier substitutes
                var rankIdx = medRank.indexOf(supKey);
                if (rankIdx >= 0) {
                    for (var si = rankIdx + 1; si < medRank.length; si++) {
                        if (_checkStockAvailable(bld, town, medRank[si], needed)) {
                            resolved = medRank[si];
                            break;
                        }
                    }
                }
            }
            if (!resolved) return 0; // cannot fulfill — consume nothing
            plan.push({ key: supKey, needed: needed, resolvedKey: resolved });
        }

        // All items available — now actually consume
        for (var pi = 0; pi < plan.length; pi++) {
            _tryConsumeFromStocks(bld, town, plan[pi].resolvedKey, plan[pi].needed);
            totalCost += (getMarketPrice(town, plan[pi].resolvedKey) || 5) * plan[pi].needed;
        }
        return totalCost;
    }

    // Check if sufficient stock exists (without consuming)
    function _checkStockAvailable(bld, town, goodId, qty) {
        var available = 0;
        if (bld._medicalStock && bld._medicalStock[goodId]) available += bld._medicalStock[goodId];
        // Check player building retail stock + input/output storage (bld.inventory)
        if (bld.ownerId === 'player' || !bld.ownerId) {
            if (typeof Player !== 'undefined' && Player.buildings) {
                for (var _pi = 0; _pi < Player.buildings.length; _pi++) {
                    if (Player.buildings[_pi].id === bld.id) {
                        var _prs = Player.buildings[_pi].retailStock;
                        if (_prs && _prs[goodId]) available += _prs[goodId];
                        var _pinv = Player.buildings[_pi].inventory;
                        if (_pinv && _pinv[goodId]) available += _pinv[goodId];
                        break;
                    }
                }
            }
        }
        if (bld.retailStock && bld.retailStock[goodId]) available += bld.retailStock[goodId];
        if (town.market && town.market.supply && town.market.supply[goodId]) available += town.market.supply[goodId];
        return available >= qty;
    }

    function _checkSuppliesAvailable(bld, town, severity, isIllness) {
        var supplyDef;
        if (isIllness) {
            supplyDef = (NPC_HEALTH_CONFIG.TREATMENT_SUPPLIES_ILLNESS && NPC_HEALTH_CONFIG.TREATMENT_SUPPLIES_ILLNESS[severity]) || null;
        } else {
            supplyDef = (NPC_HEALTH_CONFIG.TREATMENT_SUPPLIES_INJURY && NPC_HEALTH_CONFIG.TREATMENT_SUPPLIES_INJURY[severity]) || null;
        }
        if (!supplyDef) supplyDef = (NPC_HEALTH_CONFIG.TREATMENT_SUPPLIES && NPC_HEALTH_CONFIG.TREATMENT_SUPPLIES[severity]) || null;
        if (!supplyDef) return true; // no supplies required

        var medRank = NPC_HEALTH_CONFIG.MEDICINE_RANK || ['herbal_remedy', 'fever_tonic', 'healing_tonic', 'antidote'];
        // Resolve Player building's retailStock + inventory for player-owned buildings
        var _pRetail = null;
        var _pInv = null;
        if (bld && bld.ownerId === 'player' && typeof Player !== 'undefined' && Player.buildings) {
            for (var _pi = 0; _pi < Player.buildings.length; _pi++) {
                if (Player.buildings[_pi].id === bld.id) {
                    _pRetail = Player.buildings[_pi].retailStock || null;
                    _pInv = Player.buildings[_pi].inventory || null;
                    break;
                }
            }
        }

        for (var supKey in supplyDef) {
            var needed = supplyDef[supKey];
            if (bld && bld._medicalStock && (bld._medicalStock[supKey] || 0) >= needed) continue;
            if (bld && bld.retailStock && (bld.retailStock[supKey] || 0) >= needed) continue;
            if (_pRetail && (_pRetail[supKey] || 0) >= needed) continue;
            if (_pInv && (_pInv[supKey] || 0) >= needed) continue;
            if (town && town.market && town.market.supply && (town.market.supply[supKey] || 0) >= needed) continue;
            // Try substitutes (medicine only)
            var rankIdx = medRank.indexOf(supKey);
            if (rankIdx >= 0) {
                var found = false;
                for (var si = rankIdx + 1; si < medRank.length; si++) {
                    var sub = medRank[si];
                    if ((bld && bld._medicalStock && (bld._medicalStock[sub] || 0) >= needed) ||
                        (bld && bld.retailStock && (bld.retailStock[sub] || 0) >= needed) ||
                        (_pRetail && (_pRetail[sub] || 0) >= needed) ||
                        (_pInv && (_pInv[sub] || 0) >= needed) ||
                        (town && town.market && town.market.supply && (town.market.supply[sub] || 0) >= needed)) {
                        found = true; break;
                    }
                }
                if (found) continue;
            }
            return false;
        }
        return true;
    }

    function _tryConsumeFromStocks(bld, town, resId, qty) {
        if (bld && bld._medicalStock && (bld._medicalStock[resId] || 0) >= qty) {
            bld._medicalStock[resId] -= qty;
            return true;
        }
        if (bld && bld.retailStock && (bld.retailStock[resId] || 0) >= qty) {
            bld.retailStock[resId] -= qty;
            if (bld.retailStock[resId] <= 0) delete bld.retailStock[resId];
            return true;
        }
        // Player-owned buildings: also check Player.buildings copy's retailStock + inventory
        if (bld && bld.ownerId === 'player' && typeof Player !== 'undefined' && Player.buildings) {
            for (var _pbi = 0; _pbi < Player.buildings.length; _pbi++) {
                if (Player.buildings[_pbi].id === bld.id) {
                    var _pRet = Player.buildings[_pbi].retailStock;
                    if (_pRet && (_pRet[resId] || 0) >= qty) {
                        _pRet[resId] -= qty;
                        if (_pRet[resId] <= 0) delete _pRet[resId];
                        return true;
                    }
                    var _pInv2 = Player.buildings[_pbi].inventory;
                    if (_pInv2 && (_pInv2[resId] || 0) >= qty) {
                        _pInv2[resId] -= qty;
                        if (_pInv2[resId] <= 0) delete _pInv2[resId];
                        return true;
                    }
                    break;
                }
            }
        }
        if (town && town.market && town.market.supply && (town.market.supply[resId] || 0) >= qty) {
            town.market.supply[resId] -= qty;
            return true;
        }
        return false;
    }

    /**
     * Process hospital/clinic treatment queues for all towns.
     * Called every game tick (60/day) from main loop via Engine.tickHospitals().
     */
    function tickHospitalTreatment() {
        _syncState();
        if (!world || !world.towns) return;
        var rng = world.rng;
        var day = world.day;

        for (var ti = 0; ti < world.towns.length; ti++) {
            var town = world.towns[ti];
            if (!town.buildings) continue;

            for (var bi = 0; bi < town.buildings.length; bi++) {
                var bld = town.buildings[bi];
                if (bld.type !== 'hospital' && bld.type !== 'clinic') continue;

                // Init treatment queue if needed
                if (!bld._treatmentQueue) bld._treatmentQueue = [];
                if (bld._treatmentFee == null) bld._treatmentFee = 10;
                if (!bld._lastPriceUpdateDay) bld._lastPriceUpdateDay = 0;

                var bt = findBuildingType(bld.type);
                var baseHealers = (bt && bt.maxHealers != null) ? bt.maxHealers : 2;
                var workerCount = _resolveWorkerCount(bld);
                var maxHealers = baseHealers + Math.floor(workerCount / 2);
                var kingdom = findKingdom(town.kingdomId);
                var isKingdomOwned = bld.ownerId && kingdom && bld.ownerId === kingdom.id;
                var isPlayerOwned = bld.ownerId === 'player';
                var healthcareTaxRate = (kingdom && kingdom.healthcareTaxRate != null) ? kingdom.healthcareTaxRate : 0.10;

                // --- Medical supply autobuy from local market ---
                if (!bld._medicalStock) bld._medicalStock = {};
                var medStorage = (bt && bt.medicalStorage) || 40;
                var _autobuyEnabled = bld._autobuyEnabled !== false; // default on for NPC, configurable for player
                if (_autobuyEnabled && day % 3 === 0 && town.market && town.market.supply) { // check every 3 days
                    var _medGoods = ['bandages', 'herbal_remedy', 'healing_tonic', 'herbal_poultice', 'fever_tonic', 'antidote', 'splint'];
                    var _medTotal = 0;
                    for (var _mi = 0; _mi < _medGoods.length; _mi++) _medTotal += (bld._medicalStock[_medGoods[_mi]] || 0);
                    if (_medTotal < medStorage * 0.6) {
                        // Determine which goods are most needed based on treatment supply config
                        var _treatInjury = NPC_HEALTH_CONFIG.TREATMENT_SUPPLIES_INJURY || {};
                        var _treatIllness = NPC_HEALTH_CONFIG.TREATMENT_SUPPLIES_ILLNESS || {};
                        var _needMap = {};
                        var _sev, _res;
                        for (_sev in _treatInjury) {
                            for (_res in _treatInjury[_sev]) {
                                _needMap[_res] = (_needMap[_res] || 0) + _treatInjury[_sev][_res];
                            }
                        }
                        for (_sev in _treatIllness) {
                            for (_res in _treatIllness[_sev]) {
                                _needMap[_res] = (_needMap[_res] || 0) + _treatIllness[_sev][_res];
                            }
                        }
                        for (var _mi2 = 0; _mi2 < _medGoods.length; _mi2++) {
                            var _gid = _medGoods[_mi2];
                            var _currentStock = bld._medicalStock[_gid] || 0;
                            var _targetStock = Math.max(3, Math.floor(medStorage / _medGoods.length * (_needMap[_gid] ? 1.5 : 0.5)));
                            if (_currentStock >= _targetStock) continue;
                            var _toBuy = Math.min(_targetStock - _currentStock, (town.market.supply[_gid] || 0));
                            // Clamp so total stock never exceeds storage capacity
                            var _remainingCapacity = medStorage - _medTotal;
                            if (_remainingCapacity <= 0) break;
                            _toBuy = Math.min(_toBuy, _remainingCapacity);
                            if (_toBuy <= 0) continue;
                            // Pay for supplies
                            var _unitPrice = getMarketPrice(town, _gid) || 5;
                            var _totalCost = _toBuy * _unitPrice;
                            if (isKingdomOwned && kingdom) {
                                if (kingdom.gold >= _totalCost) {
                                    kingdom.gold -= _totalCost;
                                } else continue;
                            } else if (isPlayerOwned) {
                                // Player pays from building revenue balance
                                if ((bld.retailRevenue || 0) >= _totalCost) {
                                    bld.retailRevenue -= _totalCost;
                                } else continue;
                            } else if (bld.ownerId) {
                                var _medOwner = findPerson(bld.ownerId);
                                if (_medOwner && (_medOwner.gold || 0) >= _totalCost) {
                                    _medOwner.gold -= _totalCost;
                                } else continue;
                            } else {
                                // No explicit owner — community/town-funded: buy from market at reduced cost
                                // Town absorbs the cost (small drain on prosperity)
                                if ((town.market.supply[_gid] || 0) >= _toBuy) {
                                    // Slight prosperity impact for community-funded healthcare
                                    if (town.prosperity > 20) town.prosperity -= 0.01 * _toBuy;
                                } else continue;
                            }
                            consumeFromMarket(town, _gid, _toBuy);
                            bld._medicalStock[_gid] = (_currentStock + _toBuy);
                            _medTotal += _toBuy;
                        }
                    }
                }

                // --- Owner AI updates treatment pricing every 7 days ---
                if (day - (bld._lastPriceUpdateDay || 0) >= 7 && !isPlayerOwned) {
                    // AI sets fee for each severity level
                    bld._treatmentFees = {
                        minor:    getHospitalTreatmentFee(town, bld, bt, 'minor'),
                        moderate: getHospitalTreatmentFee(town, bld, bt, 'moderate'),
                        serious:  getHospitalTreatmentFee(town, bld, bt, 'serious'),
                        severe:   getHospitalTreatmentFee(town, bld, bt, 'severe'),
                    };
                    bld._lastPriceUpdateDay = day;
                }
                if (!bld._treatmentFees) {
                    bld._treatmentFees = {
                        minor:    getHospitalTreatmentFee(town, bld, bt, 'minor'),
                        moderate: getHospitalTreatmentFee(town, bld, bt, 'moderate'),
                        serious:  getHospitalTreatmentFee(town, bld, bt, 'serious'),
                        severe:   getHospitalTreatmentFee(town, bld, bt, 'severe'),
                    };
                }

                // --- Process treatment queue: clean stale entries, then decrement ticks ---
                // Remove patients who are no longer alive or sick/injured (naturally recovered, cured elsewhere)
                for (var _cqi = bld._treatmentQueue.length - 1; _cqi >= 0; _cqi--) {
                    var _cqp = findPerson(bld._treatmentQueue[_cqi].personId);
                    var _cqIsIllness = bld._treatmentQueue[_cqi].isIllness !== false;
                    var _cqStale = !_cqp || !_cqp.alive || (_cqIsIllness && !_cqp.sick) || (!_cqIsIllness && !_cqp.injured);
                    if (_cqStale) {
                        if (_cqp) _cqp._illnessTreatPaid = false;
                        bld._treatmentQueue.splice(_cqi, 1);
                    }
                }
                var activePatients = 0;
                for (var qi = 0; qi < bld._treatmentQueue.length; qi++) {
                    var patient = bld._treatmentQueue[qi];
                    if (activePatients >= maxHealers) break; // only maxHealers patients treated simultaneously

                    patient.ticksRemaining = (patient.ticksRemaining || 0) - 1;
                    activePatients++;

                    if (patient.ticksRemaining <= 0) {
                        // Treatment timer done — consume supplies before curing
                        var person = findPerson(patient.personId);
                        // Resolve severity from queue entry OR from the actual person (backwards compat for old saves)
                        var _cureSev = patient.severity || (person ? (person.injurySeverity || person.illnessSeverity || 'minor') : 'minor');
                        var _cureIsIll = patient.isIllness != null ? (patient.isIllness !== false) : (person ? !!person.sick : true);
                        var _cureCost = _consumeTreatmentSupplies(bld, town, _cureSev, _cureIsIll);
                        if (_cureCost === 0) {
                            // Supplies unavailable — can't complete treatment yet, wait
                            patient._noSupplyRetries = (patient._noSupplyRetries || 0) + 1;
                            if (patient._noSupplyRetries > 30) {
                                // Too many retries — discharge patient untreated
                                var _dischPerson = findPerson(patient.personId);
                                if (_dischPerson) {
                                    _dischPerson._illnessTreatPaid = false;
                                    if (patient.fee) {
                                        _dischPerson.gold = (_dischPerson.gold || 0) + patient.fee; // v9p33river329: refund failed no-supply treatment.
                                        var _rfTax = Math.floor(patient.fee * healthcareTaxRate);
                                        var _rfOwner = patient.fee - _rfTax;
                                        if (isKingdomOwned && kingdom) {
                                            kingdom.gold = Math.max(0, (kingdom.gold || 0) - patient.fee);
                                            kingdom.healthcareTaxRevenue = Math.max(0, (kingdom.healthcareTaxRevenue || 0) - _rfTax);
                                        } else {
                                            if (kingdom && _rfTax > 0) {
                                                kingdom.gold = Math.max(0, (kingdom.gold || 0) - _rfTax);
                                                kingdom.healthcareTaxRevenue = Math.max(0, (kingdom.healthcareTaxRevenue || 0) - _rfTax);
                                            }
                                            if (isPlayerOwned) bld.retailRevenue = Math.max(0, (bld.retailRevenue || 0) - _rfOwner);
                                            else if (bld.ownerId) {
                                                var _rfOwnerP = findPerson(bld.ownerId);
                                                if (_rfOwnerP) _rfOwnerP.gold = Math.max(0, (_rfOwnerP.gold || 0) - _rfOwner);
                                            }
                                        }
                                    }
                                }
                                bld._treatmentQueue.splice(qi, 1);
                                qi--;
                            } else {
                                patient.ticksRemaining = 3;
                            }
                            // Backfill severity/isIllness on old queue entries for next time
                            if (!patient.severity) patient.severity = _cureSev;
                            if (patient.isIllness == null) patient.isIllness = _cureIsIll;
                            continue;
                        }
                        // Track supply cost
                        if (!bld._treatmentStats) bld._treatmentStats = { treated: 0, feeEarned: 0, supplyCost: 0 };
                        bld._treatmentStats.supplyCost += _cureCost;

                        // Treatment complete — cure the NPC
                        if (person && person.alive) {
                            var _wasPoisonCure = _cureIsIll && person.illness === 'poisoned';
                            if (_cureIsIll) {
                                person.sick = false;
                                person.illness = null;
                                person.asymptomatic = false;
                                person.illnesses = []; // v9p33river329: treatment cure clears legacy and array illness state.
                            }
                            if (!_cureIsIll) {
                                person.injured = false;
                                person.injuryDay = 0;
                                person.injuryType = null;
                                person.injuryName = null;
                                person.injurySeverity = null;
                            }
                            person._illnessTreatPaid = false;
                            var _hpBeforeCure = person.health;
                            person.health = Math.min(100, (person.health || 50) + 20);
                            if (_wasPoisonCure) {
                                _dbgPoison('🏥 HOSPITAL CURE COMPLETE (+20hp bonus)', person, {
                                    facility: bld.type,
                                    townId: town.id,
                                    hpBeforeCure: _hpBeforeCure,
                                    hpAfterCure: person.health,
                                    severity: _cureSev
                                });
                            }
                        }
                        bld._treatmentQueue.splice(qi, 1);
                        qi--; // adjust index after removal
                    }
                }

                // --- Admit new patients: sick or injured NPCs in town who can afford treatment ---
                // Only admit up to (maxHealers * 2) patients in queue at once
                var maxQueue = maxHealers * 2;
                if (bld._treatmentQueue.length < maxQueue) {
                    var sickInTown = [];
                    var _townPeopleForAdmit = (typeof Engine !== 'undefined' && Engine.getPeopleInTown) ? Engine.getPeopleInTown(town.id) : [];
                    for (var pi = 0; pi < _townPeopleForAdmit.length; pi++) {
                        var p = _townPeopleForAdmit[pi];
                        if (!p.alive) continue;
                        if (!p.sick && !p.injured) continue;
                        if (p.sick && p.asymptomatic) continue;
                        // Already in queue?
                        var alreadyQueued = false;
                        for (var qc = 0; qc < bld._treatmentQueue.length; qc++) {
                            if (bld._treatmentQueue[qc].personId === p.id) { alreadyQueued = true; break; }
                        }
                        if (alreadyQueued) continue;
                        if (p._illnessTreatPaid) continue; // already treated elsewhere
                        if (p._storyBlockTreatment) continue; // story mode blocks auto-treatment
                        sickInTown.push(p);
                    }

                    // Admit patients who can afford it (limited per tick to avoid lag)
                    var admitLimit = Math.min(3, maxQueue - bld._treatmentQueue.length, sickInTown.length);
                    for (var ai = 0; ai < admitLimit; ai++) {
                        var idx = Math.floor(rng.random() * sickInTown.length);
                        var sick = sickInTown[idx];
                        sickInTown.splice(idx, 1);

                        var _admitIsIllness = !!sick.sick;
                        var sev = _admitIsIllness ? (sick.illnessSeverity || 'minor') : (sick.injurySeverity || sick.illnessSeverity || 'minor');

                        // Minor injuries: common NPCs less likely to seek treatment (heals on its own)
                        // Kings, nobles, and elite merchants always seek treatment
                        if (!_admitIsIllness && sick.injured && sev === 'minor') {
                            var _isImportant = sick.isKing || sick.isNoble || sick.isEliteMerchant;
                            if (!_isImportant && !rng.chance(0.20)) continue;
                        }

                        var fee = (bld._treatmentFees && bld._treatmentFees[sev]) || 10;
                        if ((sick.gold || 0) < fee) continue; // can't afford

                        // Check if required supplies are available before admitting
                        if (!_checkSuppliesAvailable(bld, town, sev, _admitIsIllness)) continue;

                        var treatTicks = (NPC_HEALTH_CONFIG.TREATMENT_TICKS && NPC_HEALTH_CONFIG.TREATMENT_TICKS[sev]) || 25;
                        // v9p33river237: poison resists standard treatment (real-world poisoning takes weeks)
                        if (sick && sick.illness === 'poisoned') treatTicks *= 6;
                        // Clinics treat severe but take twice as long
                        if (bld.type === 'clinic' && sev === 'severe') treatTicks = treatTicks * 2;

                        // Pay fee
                        sick.gold -= fee;
                        sick._illnessTreatPaid = true;
                        if (sick.illness === 'poisoned') {
                            _dbgPoison('🏥 ADMITTED to ' + bld.type + ' (auto-admit)', sick, {
                                townId: town.id,
                                fee: fee,
                                treatTicks: treatTicks,
                                cureDay: (world && world.day != null) ? (world.day + treatTicks) : '?'
                            });
                        }

                        // Revenue split
                        var taxAmount = Math.floor(fee * healthcareTaxRate);
                        if (isKingdomOwned) {
                            // Kingdom owns: full revenue to kingdom, but only
                            // the tax portion counts toward the tax-revenue
                            // report. v9p33river308: previously added the
                            // entire fee to healthcareTaxRevenue, inflating
                            // healthcare tax reports.
                            if (kingdom) {
                                kingdom.gold = (kingdom.gold || 0) + fee;
                                kingdom.healthcareTaxRevenue = (kingdom.healthcareTaxRevenue || 0) + taxAmount;
                            }
                        } else {
                            // Private owner: keep revenue minus healthcare tax
                            var ownerRevenue = fee - taxAmount;
                            if (kingdom && taxAmount > 0) {
                                kingdom.gold = (kingdom.gold || 0) + taxAmount;
                                kingdom.healthcareTaxRevenue = (kingdom.healthcareTaxRevenue || 0) + taxAmount;
                            }
                            if (isPlayerOwned) {
                                // Player revenue handled via building retail revenue
                                bld.retailRevenue = (bld.retailRevenue || 0) + ownerRevenue;
                            } else if (bld.ownerId) {
                                var owner = findPerson(bld.ownerId);
                                if (owner && owner.alive) owner.gold = (owner.gold || 0) + ownerRevenue;
                            }
                        }

                        // Track treatment stats for building detail log
                        if (!bld._treatmentStats) bld._treatmentStats = { treated: 0, feeEarned: 0, supplyCost: 0 };
                        bld._treatmentStats.treated++;
                        bld._treatmentStats.feeEarned += fee;

                        // Add to treatment queue — nobles skip to front
                        var _qEntry = {
                            personId: sick.id,
                            severity: sev,
                            ticksRemaining: treatTicks,
                            fee: fee,
                            isIllness: _admitIsIllness,
                        };
                        var _isNoble = sick.isNoble || sick.isKing || (sick.socialRank && sick.socialRank[town.kingdomId] >= 4);
                        if (_isNoble) {
                            bld._treatmentQueue.unshift(_qEntry);
                        } else {
                            bld._treatmentQueue.push(_qEntry);
                        }
                    }
                }
            }
        }
    }

    /**
     * NPC, EM, and King treatment-seeking AI.
     * - Regular NPCs: already handled by tickHospitalTreatment admission
     * - Elite Merchants: proactively seek treatment, will travel if no local facility
     * - Kings/Royal family: use kingdom funds, travel for treatment
     */
    function tickNPCTreatmentSeeking() {
        _syncState();
        if (!world || !world.people) return;
        if (world.day % 3 !== 0) return; // every 3 days
        var rng = world.rng;

        // Pre-compute towns with medical facilities
        var townMedFacilities = {};
        for (var ti = 0; ti < world.towns.length; ti++) {
            var t = world.towns[ti];
            var hasMed = false;
            if (t.buildings) {
                for (var bi = 0; bi < t.buildings.length; bi++) {
                    if (t.buildings[bi].type === 'hospital' || t.buildings[bi].type === 'clinic') {
                        hasMed = true; break;
                    }
                }
            }
            townMedFacilities[t.id] = hasMed;
        }

        var _treatAlive = (typeof Engine !== 'undefined' && Engine.getTickCache) ? (Engine.getTickCache().alivePeople || world.people) : world.people;
        // v9p33river251: trace which poisoned NPCs are skipped at top of seek
        try {
            if (typeof window !== 'undefined' && window._POISON_DEBUG === true) {
                for (var _ti = 0; _ti < _treatAlive.length; _ti++) {
                    var _tp = _treatAlive[_ti];
                    if (_tp && _tp.alive && _tp.illness === 'poisoned') {
                        console.log('[POISON|d' + world.day + '] SEEK ENTER ' + (_tp.firstName||'?') + ' alive=' + _tp.alive + ' townId=' + _tp.townId + ' sick=' + _tp.sick + ' treatPaid=' + !!_tp._illnessTreatPaid + ' storyBlock=' + !!_tp._storyBlockTreatment + ' isKing=' + !!_tp.isKing);
                    }
                }
            }
        } catch(_e){}
        for (var i = 0; i < _treatAlive.length; i++) {
            var p = _treatAlive[i];
            if (!p.alive || !p.townId) continue;

            // v9p33river259: arrival handler — NPCs en route to a hospital town
            // now actually take days to get there (horse-or-better speed). When
            // the arrival day is reached, snap them to the destination so the
            // seek logic below picks them up at the new location next tick.
            if (p._treatmentTravelArrivalDay != null) {
                if (world.day >= p._treatmentTravelArrivalDay) {
                    if (p._treatmentTravelTargetTownId) {
                        // Sanity: target still has medical facility & player still alive
                        var _arrTown = findTown(p._treatmentTravelTargetTownId);
                        if (_arrTown) {
                            p.townId = _arrTown.id;
                            p.kingdomId = _arrTown.kingdomId;
                        }
                    }
                    delete p._treatmentTravelArrivalDay;
                    delete p._treatmentTravelTargetTownId;
                    delete p._treatmentTravelOriginTownId;
                    p._travelingForTreatment = false;
                    // Fall through to attempt admission this tick
                } else {
                    continue; // still on the road
                }
            }

            if (!p.sick && !p.injured) continue;
            if (p._illnessTreatPaid) continue; // already being treated
            if (p._storyBlockTreatment) continue; // story mode blocks auto-treatment

            var isEM = p.isEliteMerchant;
            // v9p33river250: don't trust just p.isKing flag — also check whether
            // any kingdom has this person as its king (succession sometimes
            // failed to set the flag, e.g., 17yo Bartholomew was a kingdom.king
            // but had isKing=false → fell into common-NPC seek path → never
            // sought treatment despite having gold and a hospital in town).
            var isKing = !!p.isKing;
            if (!isKing && world && world.kingdoms) {
                for (var _kki = 0; _kki < world.kingdoms.length; _kki++) {
                    if (world.kingdoms[_kki].king === p.id) {
                        isKing = true;
                        p.isKing = true; // backfill
                        break;
                    }
                }
            }
            var isRoyal = false;
            if (!isKing && !isEM && p.socialRank) {
                for (var kId in p.socialRank) {
                    if (p.socialRank[kId] >= 4) { isRoyal = true; break; }
                }
            }

            // Regular NPCs: 30% chance to actively seek treatment each tick
            // EMs: 80% chance, Kings/Royals: 95% chance
            var seekChance = 0.30;
            if (isEM) seekChance = 0.80;
            if (isKing || isRoyal) seekChance = 0.95;
            var _seekRoll = rng.random();
            if (_seekRoll >= seekChance) {
                if (p.illness === 'poisoned') _dbgPoison('🎲 SEEK ROLL FAIL (' + _seekRoll.toFixed(2) + ' >= ' + seekChance.toFixed(2) + ')', p, { isKing: isKing, isRoyal: isRoyal, isEM: isEM });
                continue;
            }

            var town = findTown(p.townId);
            if (!town) {
                if (p.illness === 'poisoned') _dbgPoison('⛔ SEEK no town found', p, { townId: p.townId });
                continue;
            }
            var hasFacility = townMedFacilities[p.townId];
            if (!hasFacility && p.illness === 'poisoned') {
                _dbgPoison('⛔ SEEK town has no hospital/clinic', p, { town: town.name });
            }

            // If facility exists locally, try to join queue
            if (hasFacility) {
                // Find the facility and check if already queued
                for (var fbi = 0; fbi < town.buildings.length; fbi++) {
                    var fBld = town.buildings[fbi];
                    if (fBld.type !== 'hospital' && fBld.type !== 'clinic') continue;
                    if (!fBld._treatmentQueue) fBld._treatmentQueue = [];

                    // Check if already in queue
                    var alreadyQueued = false;
                    for (var qi = 0; qi < fBld._treatmentQueue.length; qi++) {
                        if (fBld._treatmentQueue[qi].personId === p.id) { alreadyQueued = true; break; }
                    }
                    if (alreadyQueued) {
                        if (p.illness === 'poisoned') _dbgPoison('SEEK already in ' + fBld.type + ' queue', p, {});
                        break;
                    }

                    var _admit2IsIll = !!p.sick;
                    var sev = _admit2IsIll ? (p.illnessSeverity || 'minor') : (p.injurySeverity || p.illnessSeverity || 'minor');
                    var fee = (fBld._treatmentFees && fBld._treatmentFees[sev]) || 10;

                    // Check supplies available BEFORE payment
                    var _isIllness2pre = !!p.sick;
                    if (!_checkSuppliesAvailable(fBld, town, sev, _isIllness2pre)) {
                        if (p.illness === 'poisoned') _dbgPoison('⛔ SEEK ' + fBld.type + ' has no supplies for sev=' + sev, p, { town: town.name, fee: fee });
                        continue;
                    }

                    // Payment: kings/royals can use kingdom funds, then own gold,
                    // and finally fall back to FREE royal-physician care if both
                    // are dry (kings always have access to court physicians as a
                    // perk of office — no broke teenage king should die untreated)
                    var canPay = false;
                    var _royalFreeCare = false;
                    if (isKing || isRoyal) {
                        var pKingdom = findKingdom(town.kingdomId);
                        if (pKingdom && (pKingdom.gold || 0) >= fee) {
                            pKingdom.gold -= fee;
                            canPay = true;
                        } else if ((p.gold || 0) >= fee) {
                            p.gold -= fee;
                            canPay = true;
                        } else {
                            // v9p33river246: royal-physician fallback — free care
                            canPay = true;
                            _royalFreeCare = true;
                        }
                    } else if ((p.gold || 0) >= fee) {
                        p.gold -= fee;
                        canPay = true;
                    }
                    if (!canPay) {
                        if (p.illness === 'poisoned') {
                            _dbgPoison('⛔ COULD NOT PAY for ' + fBld.type + ' (fee=' + fee + ', gold=' + (p.gold||0) + ')', p, { townId: town.id });
                        }
                        continue;
                    }

                    p._illnessTreatPaid = true;
                    var bt = findBuildingType(fBld.type);
                    var treatTicks = (NPC_HEALTH_CONFIG.TREATMENT_TICKS && NPC_HEALTH_CONFIG.TREATMENT_TICKS[sev]) || 25;
                    // v9p33river237: poison resists standard treatment (real-world poisoning takes weeks)
                    if (p && p.illness === 'poisoned') treatTicks *= 6;
                    // Clinics treat severe but take twice as long
                    if (fBld.type === 'clinic' && sev === 'severe') treatTicks = treatTicks * 2;
                    if (p.illness === 'poisoned') {
                        _dbgPoison('🏥 SOUGHT treatment at ' + fBld.type + (_royalFreeCare ? ' (👑 free royal-physician care)' : ''), p, {
                            townId: town.id,
                            fee: _royalFreeCare ? 0 : fee,
                            treatTicks: treatTicks,
                            cureDay: (world && world.day != null) ? (world.day + treatTicks) : '?'
                        });
                    }

                    // Revenue to building owner
                    var ownerKingdom = findKingdom(town.kingdomId);
                    var healthcareTaxRate = (ownerKingdom && ownerKingdom.healthcareTaxRate != null) ? ownerKingdom.healthcareTaxRate : 0.10;
                    var isKingdomOwned = fBld.ownerId && ownerKingdom && fBld.ownerId === ownerKingdom.id;
                    if (isKingdomOwned) {
                        if (ownerKingdom) {
                            ownerKingdom.gold = (ownerKingdom.gold || 0) + fee;
                            // v9p33river308: same tax-vs-fee fix as line 1670
                            ownerKingdom.healthcareTaxRevenue = (ownerKingdom.healthcareTaxRevenue || 0) + Math.floor(fee * healthcareTaxRate);
                        }
                    } else if (fBld.ownerId === 'player') {
                        fBld.retailRevenue = (fBld.retailRevenue || 0) + (fee - Math.floor(fee * healthcareTaxRate));
                        if (ownerKingdom) ownerKingdom.gold = (ownerKingdom.gold || 0) + Math.floor(fee * healthcareTaxRate);
                    } else if (fBld.ownerId) {
                        var facOwner = findPerson(fBld.ownerId);
                        if (facOwner && facOwner.alive) facOwner.gold = (facOwner.gold || 0) + (fee - Math.floor(fee * healthcareTaxRate));
                        if (ownerKingdom) ownerKingdom.gold = (ownerKingdom.gold || 0) + Math.floor(fee * healthcareTaxRate);
                    }

                    // Track treatment stats
                    if (!fBld._treatmentStats) fBld._treatmentStats = { treated: 0, feeEarned: 0, supplyCost: 0 };
                    fBld._treatmentStats.treated++;
                    fBld._treatmentStats.feeEarned += fee;

                    // Nobles skip to front of queue
                    var _isIllness2 = !!p.sick;
                    var _qEntry2 = {
                        personId: p.id,
                        severity: sev,
                        ticksRemaining: treatTicks,
                        fee: fee,
                        isIllness: _isIllness2,
                    };
                    var _isNoble2 = p.isNoble || p.isKing || (p.socialRank && p.socialRank[town.kingdomId] >= 4);
                    if (_isNoble2) {
                        fBld._treatmentQueue.unshift(_qEntry2);
                    } else {
                        fBld._treatmentQueue.push(_qEntry2);
                    }
                    break; // admitted to one facility
                }
            } else if (isEM || isKing || isRoyal) {
                // v9p33river259: travel to nearest connected town with medical
                // facility — but no longer an instant warp. EM/noble/king
                // travels at horse-or-better speed (CARAVAN_BASE_SPEED × 1.5 ×
                // 1.3 horse bonus = ~234 units/day). Arrival handled at top
                // of next eligible tick.
                if (p._travelingForTreatment || p._treatmentTravelArrivalDay != null) continue; // already traveling
                if (!town.connectedTowns) continue;
                var bestMedTown = null;
                var bestDist = Infinity;
                for (var cti = 0; cti < town.connectedTowns.length; cti++) {
                    var connId = town.connectedTowns[cti];
                    if (!townMedFacilities[connId]) continue;
                    var connTown = findTown(connId);
                    if (!connTown) continue;
                    var dx = (connTown.x || 0) - (town.x || 0);
                    var dy = (connTown.y || 0) - (town.y || 0);
                    var dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < bestDist) { bestDist = dist; bestMedTown = connTown; }
                }
                if (bestMedTown) {
                    // Horse-or-better speed: base 180/day × 1.3 horse bonus = 234
                    var _baseSpd = (typeof CONFIG !== 'undefined' && CONFIG.CARAVAN_BASE_SPEED ? CONFIG.CARAVAN_BASE_SPEED : 120) * 1.5;
                    var _horseSpd = _baseSpd * (1 + (typeof CONFIG !== 'undefined' && CONFIG.HORSE_TRAVEL_SPEED_BONUS ? CONFIG.HORSE_TRAVEL_SPEED_BONUS : 0.3));
                    var _travelDays = Math.max(1, Math.ceil(bestDist / _horseSpd));
                    p._travelingForTreatment = true;
                    p._treatmentTravelArrivalDay = world.day + _travelDays;
                    p._treatmentTravelTargetTownId = bestMedTown.id;
                    p._treatmentTravelOriginTownId = town.id;
                    if (p.illness === 'poisoned') {
                        _dbgPoison('🐎 EN ROUTE to ' + bestMedTown.name + ' (' + _travelDays + 'd by horse)', p, { from: town.name, dist: Math.round(bestDist) });
                    }
                }
            }
        }

        // ---- Parent rescue: nobles/EMs seek treatment for their sick children ----
        for (var _pci = 0; _pci < _treatAlive.length; _pci++) {
            var _child = _treatAlive[_pci];
            if (!_child.alive || !_child.sick || _child._illnessTreatPaid) continue;
            if (_child.age == null || _child.age >= (typeof CONFIG !== 'undefined' ? CONFIG.COMING_OF_AGE : 18)) continue;
            if (!_child.parentIds || _child.parentIds.length === 0) continue;

            // Find a living wealthy parent
            var _rescueParent = null;
            for (var _rpi = 0; _rpi < _child.parentIds.length; _rpi++) {
                var _rp = findPerson(_child.parentIds[_rpi]);
                if (!_rp || !_rp.alive) continue;
                if (_rp.isEliteMerchant || _rp.isNoble || _rp.isKing ||
                    (_rp.socialRank && Object.values(_rp.socialRank).some(function(r) { return r >= 4; }))) {
                    _rescueParent = _rp;
                    break;
                }
                // Common parents with enough gold also try (less aggressively)
                if (_rp.gold >= 20 && rng.chance(0.4)) {
                    _rescueParent = _rp;
                    break;
                }
            }
            if (!_rescueParent) continue;

            var _childTown = findTown(_child.townId);
            if (!_childTown) continue;

            // If child not in same town as parent, move child to parent
            if (_child.townId !== _rescueParent.townId && _rescueParent.gold >= 15) {
                var _rpTown = findTown(_rescueParent.townId);
                if (_rpTown) {
                    _childTown.population = Math.max(0, _childTown.population - 1);
                    _child.townId = _rpTown.id;
                    _child.kingdomId = _rpTown.kingdomId;
                    _rpTown.population++;
                    _rescueParent.gold -= 10;
                    _childTown = _rpTown;
                }
            }

            // Try to get child treated at local facility
            var _childHasFacility = townMedFacilities[_child.townId];
            if (_childHasFacility) {
                for (var _cfbi = 0; _cfbi < _childTown.buildings.length; _cfbi++) {
                    var _cfBld = _childTown.buildings[_cfbi];
                    if (_cfBld.type !== 'hospital' && _cfBld.type !== 'clinic') continue;
                    if (!_cfBld._treatmentQueue) _cfBld._treatmentQueue = [];

                    // Check not already queued
                    var _childQueued = false;
                    for (var _cqi = 0; _cqi < _cfBld._treatmentQueue.length; _cqi++) {
                        if (_cfBld._treatmentQueue[_cqi].personId === _child.id) { _childQueued = true; break; }
                    }
                    if (_childQueued) break;

                    var _childSev = _child.illnessSeverity || 'minor';
                    var _childFee = NPC_HEALTH_CONFIG.TREATMENT_FEE ? (NPC_HEALTH_CONFIG.TREATMENT_FEE[_childSev] || 10) : 10;

                    // Parent pays for child's treatment
                    if (_rescueParent.gold >= _childFee) {
                        _rescueParent.gold -= _childFee;
                        _child._illnessTreatPaid = true;

                        var _childTreatTicks = (NPC_HEALTH_CONFIG.TREATMENT_TICKS && NPC_HEALTH_CONFIG.TREATMENT_TICKS[_childSev]) || 25;
                        if (_cfBld.type === 'clinic' && _childSev === 'severe') _childTreatTicks *= 2;

                        // Revenue to building owner
                        var _cOwnerK = findKingdom(_childTown.kingdomId);
                        var _cTaxRate = (_cOwnerK && _cOwnerK.healthcareTaxRate) || 0.15;
                        if (_cfBld.ownerId === 'kingdom' || (_cOwnerK && _cfBld.ownerId === _cOwnerK.id)) {
                            if (_cOwnerK) _cOwnerK.gold = (_cOwnerK.gold || 0) + _childFee;
                        } else if (_cfBld.ownerId === 'player') {
                            _cfBld.retailRevenue = (_cfBld.retailRevenue || 0) + (_childFee - Math.floor(_childFee * _cTaxRate));
                        } else if (_cfBld.ownerId) {
                            var _cfOwner = findPerson(_cfBld.ownerId);
                            if (_cfOwner && _cfOwner.alive) _cfOwner.gold = (_cfOwner.gold || 0) + (_childFee - Math.floor(_childFee * _cTaxRate));
                        }

                        // Children go to front of queue (priority)
                        _cfBld._treatmentQueue.unshift({
                            personId: _child.id,
                            severity: _childSev,
                            ticksRemaining: _childTreatTicks,
                            fee: _childFee,
                            isIllness: true,
                        });
                        break;
                    }
                }
            } else if (_rescueParent.gold >= 30) {
                // No local facility — parent pays for herbal remedy from market
                var _childMarket = _childTown.market && _childTown.market.supply;
                if (_childMarket) {
                    var _remedyGoods = ['herbal_remedy', 'healing_tonic', 'fever_tonic'];
                    for (var _rgi = 0; _rgi < _remedyGoods.length; _rgi++) {
                        if ((_childMarket[_remedyGoods[_rgi]] || 0) > 0) {
                            _childMarket[_remedyGoods[_rgi]]--;
                            _rescueParent.gold -= 15;
                            _child._illnessTreatPaid = true;
                            _child.health = Math.min(100, (_child.health || 50) + 15);
                            break;
                        }
                    }
                }
                // If still untreated, travel to a town with medical facility
                if (!_child._illnessTreatPaid && _rescueParent.gold >= 25) {
                    var _bestChildMed = null;
                    var _bestChildDist = Infinity;
                    for (var _mti = 0; _mti < world.towns.length; _mti++) {
                        var _mt = world.towns[_mti];
                        if (_mt.id === _child.townId) continue;
                        if (!townMedFacilities[_mt.id]) continue;
                        var _mdx = (_mt.x || 0) - (_childTown.x || 0);
                        var _mdy = (_mt.y || 0) - (_childTown.y || 0);
                        var _mdist = Math.sqrt(_mdx * _mdx + _mdy * _mdy);
                        if (_mdist < _bestChildDist) { _bestChildDist = _mdist; _bestChildMed = _mt; }
                    }
                    if (_bestChildMed) {
                        _childTown.population = Math.max(0, _childTown.population - 1);
                        _child.townId = _bestChildMed.id;
                        _child.kingdomId = _bestChildMed.kingdomId;
                        _bestChildMed.population++;
                        _rescueParent.gold -= 15;
                        // Also move parent if in different town
                        if (_rescueParent.townId !== _bestChildMed.id) {
                            var _rpOldTown = findTown(_rescueParent.townId);
                            if (_rpOldTown) _rpOldTown.population = Math.max(0, _rpOldTown.population - 1);
                            _rescueParent.townId = _bestChildMed.id;
                            _rescueParent.kingdomId = _bestChildMed.kingdomId;
                            _bestChildMed.population++;
                        }
                    }
                }
            }
        }
        // Return healed travelers to their origin towns
        for (var ri = 0; ri < _treatAlive.length; ri++) {
            var rp = _treatAlive[ri];
            if (!rp.alive || !rp._travelingForTreatment) continue;
            if (!rp.sick && !rp.injured && !rp._illnessTreatPaid) {
                // Healed — return home
                if (rp._treatmentOriginTown) {
                    rp.townId = rp._treatmentOriginTown;
                }
                delete rp._travelingForTreatment;
                delete rp._treatmentOriginTown;
            }
        }
    }

    /**
     * Get treatment fees for a facility in a given town (for player UI).
     */
    function getHospitalFees(townId) {
        _syncState();
        var town = findTown(townId);
        if (!town || !town.buildings) return null;
        var result = { hospital: null, clinic: null };
        for (var i = 0; i < town.buildings.length; i++) {
            var bld = town.buildings[i];
            if (bld.type === 'hospital' || bld.type === 'clinic') {
                var bt = findBuildingType(bld.type);
                bld._treatmentFees = {
                    minor:    getHospitalTreatmentFee(town, bld, bt, 'minor'),
                    moderate: getHospitalTreatmentFee(town, bld, bt, 'moderate'),
                    serious:  getHospitalTreatmentFee(town, bld, bt, 'serious'),
                    severe:   getHospitalTreatmentFee(town, bld, bt, 'severe'),
                }; // v9p33river329: UI fees depend on live queue/workers/prosperity/prices.
                var kingdom = findKingdom(town.kingdomId);
                var taxRate = (kingdom && kingdom.healthcareTaxRate != null) ? kingdom.healthcareTaxRate : 0.10;
                var queueLen = bld._treatmentQueue ? bld._treatmentQueue.length : 0;
                var _fBaseHealers = (bt && bt.maxHealers != null) ? bt.maxHealers : 2;
                var _fWorkerCount = _resolveWorkerCount(bld);
                var maxHealers = _fBaseHealers + Math.floor(_fWorkerCount / 2);
                result[bld.type] = {
                    fees: bld._treatmentFees,
                    ownerId: bld.ownerId,
                    isKingdomOwned: bld.ownerId && kingdom && bld.ownerId === kingdom.id,
                    healthcareTaxRate: taxRate,
                    queueLength: queueLen,
                    maxHealers: maxHealers,
                    treatmentTicks: NPC_HEALTH_CONFIG.TREATMENT_TICKS || { minor: 5, moderate: 25, serious: 70, severe: 120 },
                    medicalStock: bld._medicalStock || {},
                    autobuyEnabled: bld._autobuyEnabled !== false,
                    buildingId: bld.id,
                };
            }
        }
        return result;
    }

    /**
     * Toggle medical supply autobuy for a specific building.
     */
    function toggleMedicalAutobuy(townId, buildingId) {
        _syncState();
        var town = findTown(townId);
        if (!town || !town.buildings) return false;
        for (var i = 0; i < town.buildings.length; i++) {
            var bld = town.buildings[i];
            if (bld.id === buildingId && (bld.type === 'hospital' || bld.type === 'clinic')) {
                bld._autobuyEnabled = bld._autobuyEnabled === false ? true : false;
                return bld._autobuyEnabled;
            }
        }
        return false;
    }

    function kickPatientFromQueue(townId, buildingId, personId) {
        _syncState();
        var town = findTown(townId);
        if (!town || !town.buildings) return false;
        for (var i = 0; i < town.buildings.length; i++) {
            var bld = town.buildings[i];
            if (bld.id === buildingId && bld._treatmentQueue) {
                for (var qi = 0; qi < bld._treatmentQueue.length; qi++) {
                    if (bld._treatmentQueue[qi].personId === personId) {
                        var person = findPerson(personId);
                        if (person) person._illnessTreatPaid = false;
                        bld._treatmentQueue.splice(qi, 1);
                        return true;
                    }
                }
            }
        }
        return false;
    }

    // ========================================================
    // Register on Engine
    // ========================================================
    // Support both 5-arg internal calls: infectNPC(person, illnessId, rng, day, source)
    // and 3-arg god-mode calls: infectNPC(person, illnessId, source)
    Engine.infectNPC = function(person, illnessId, rngOrSource, day, source) {
        if (typeof rngOrSource === 'string' || rngOrSource === undefined) {
            _syncState();
            var _rng = (world && world.rng) || { random: Math.random, chance: function(c) { return Math.random() < c; }, randInt: function(a,b) { return a + Math.floor(Math.random()*(b-a+1)); } };
            return infectNPC(person, illnessId, _rng, world ? world.day : 0, rngOrSource || 'god_mode');
        }
        return infectNPC(person, illnessId, rngOrSource, day, source);
    };
    // v9p33river347: Plague-sabotage tick — runs daily, processes any
    // towns flagged with _waterContaminated or _foodTainted by the
    // player's spreadPlague scheme, and rolls karma self-infection
    // for the player if they're standing in a town they tainted.
    // Hooked into tickNPCHealth via a wrap below.
    function _tickPlagueSabotage() {
        if (!world || !world.towns) return;
        var rng = world.rng;
        var day = world.day;

        // Per-town infection rolls.
        for (var ti = 0; ti < world.towns.length; ti++) {
            var t = world.towns[ti];
            if (!t) continue;
            var waterOn = t._waterContaminated && t._waterContaminated > day;
            var foodOn  = t._foodTainted && t._foodTainted > day;
            if (!waterOn && !foodOn) continue;
            // Eligible victims: alive, non-player, in this town, not already sick.
            var pool = [];
            for (var pi = 0; pi < world.people.length; pi++) {
                var p = world.people[pi];
                if (!p || !p.alive || p.sick) continue;
                if (p.townId !== t.id) continue;
                if (p.id === 'player') continue;
                pool.push(p);
            }
            if (pool.length === 0) continue;

            // Infection counts per tick (tickNPCHealth runs every 3 days).
            var picks = 0;
            if (foodOn) picks += rng.randInt(2, 4);
            if (waterOn) picks += rng.randInt(1, 2);

            for (var pk = 0; pk < picks && pool.length > 0; pk++) {
                var idx = rng.randInt(0, pool.length - 1);
                var victim = pool[idx];
                pool.splice(idx, 1);
                infectNPC(victim, 'plague', rng, day, 'sabotage');
            }

            // Food-tainted towns: chance to spread to a connected town
            // via caravan trade (sets _waterContaminated on the neighbor
            // for a shorter window — proxy for "infected goods arrived").
            if (foodOn && rng.chance(0.10)) {
                var neighbors = [];
                if (world.roads) {
                    for (var ri = 0; ri < world.roads.length; ri++) {
                        var r = world.roads[ri];
                        if (!r || r.condition === 'destroyed') continue;
                        if (r.fromTownId === t.id) neighbors.push(r.toTownId);
                        else if (r.toTownId === t.id) neighbors.push(r.fromTownId);
                    }
                }
                if (neighbors.length > 0) {
                    var nbId = neighbors[rng.randInt(0, neighbors.length - 1)];
                    var nbTown = findTown(nbId);
                    if (nbTown && !nbTown._waterContaminated) {
                        nbTown._waterContaminated = day + 10; // shorter spillover
                        nbTown._waterContaminatedBy = 'plague_spread';
                    }
                }
            }
        }

        // Karma: player self-infection while standing in a town they tainted.
        try {
            if (typeof Player !== 'undefined' && Player.state && Player.state._plagueSelfRiskUntil && Player.state._plagueSelfRiskUntil > day) {
                if (Player.state.townId === Player.state._plagueSelfRiskTown) {
                    // ~2.1% per 3-day tick ≈ 5% per week.
                    if (rng.chance(0.021)) {
                        // v9p33river348: previously tried Player.addIllness /
                        // Player.contractIllness — neither exists in the
                        // codebase, so the karma was cosmetic only. The
                        // real API is Player.inflictSpecificIllness(id, source).
                        var _karmaApplied = false;
                        if (typeof Player.inflictSpecificIllness === 'function') {
                            Player.inflictSpecificIllness('plague', 'self_inflicted_plague');
                            _karmaApplied = true;
                        }
                        if (_karmaApplied) {
                            if (typeof UI !== 'undefined' && UI.toast) UI.toast('🦠 Karma — you\'ve caught the plague you spread!', 'danger', 'health');
                            logEvent('🦠 ' + (Player.fullName || 'The player') + ' has fallen ill with plague — possibly the very plague they spread.', null, 'illness');
                            // Don't keep rolling — one karma hit is enough.
                            Player.state._plagueSelfRiskUntil = 0;
                        }
                    }
                }
            }
        } catch (_e) {}
    }

    // v9p33river347: wrap tickNPCHealth to also run the sabotage tick.
    var _origTickNPCHealth_v347 = tickNPCHealth;
    Engine.tickNPCHealth = function() {
        var _r = _origTickNPCHealth_v347.apply(this, arguments);
        try { _tickPlagueSabotage(); } catch (_e) {}
        return _r;
    };
    Engine.tickNPCTreatmentSeeking = tickNPCTreatmentSeeking;
    Engine.tickKingHealthPolicy = tickKingHealthPolicy;
    Engine.tickHospitalTreatment = tickHospitalTreatment;

    // v9p33river242: console helper — call window.dbgPoison() in F12 to dump
    // current state of all poisoned NPCs (or just the king if you pass true).
    if (typeof window !== 'undefined') {
        window.dbgPoison = function(kingsOnly) {
            try {
                _syncState();
                if (!world || !world.people) { console.log('[dbgPoison] no world.people'); return; }
                var found = [];
                for (var i = 0; i < world.people.length; i++) {
                    var p = world.people[i];
                    if (!p || !p.alive) continue;
                    if (kingsOnly && !p.isKing) continue;
                    var hasPoisonArr = false;
                    if (p.illnesses && p.illnesses.length) {
                        for (var j = 0; j < p.illnesses.length; j++) {
                            if (p.illnesses[j] && (p.illnesses[j].id === 'poisoned' || p.illnesses[j].source === 'poisoned' || (p.illnesses[j].source && p.illnesses[j].source.indexOf('poison') >= 0))) hasPoisonArr = true;
                        }
                    }
                    if (p.illness !== 'poisoned' && !hasPoisonArr && !kingsOnly) continue;
                    var t = findTown(p.townId);
                    found.push({
                        name: (p.firstName||'?') + ' ' + (p.lastName||''),
                        isKing: !!p.isKing,
                        isNoble: !!p.isNoble,
                        sick: p.sick,
                        illness: p.illness,
                        illnessSeverity: p.illnessSeverity,
                        illnessSource: p.illnessSource,
                        illnessDay: p.illnessDay,
                        illnesses: p.illnesses,
                        health: p.health,
                        townId: p.townId,
                        town: t ? t.name : '?',
                        kingdomId: p.kingdomId,
                        _illnessTreatPaid: p._illnessTreatPaid,
                        gold: p.gold,
                        worldDay: world.day
                    });
                }
                console.log('[dbgPoison] day=' + world.day + ' tickNPCHealthRunsOn=multipleOf3 (' + (world.day % 3) + ' away) — ' + found.length + ' match:', found);
                return found;
            } catch(e) { console.error('[dbgPoison] err', e); }
        };
    }

    Engine.getHospitalTreatmentFee = getHospitalTreatmentFee;
    Engine.getHospitalFees = getHospitalFees;
    Engine.toggleMedicalAutobuy = toggleMedicalAutobuy;
    Engine.kickPatientFromQueue = kickPatientFromQueue;
    Engine._checkSuppliesAvailable = _checkSuppliesAvailable;

})(window.Engine);
