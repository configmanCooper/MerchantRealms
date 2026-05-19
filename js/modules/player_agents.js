(function(Player) {
    "use strict";
    if (!Player) throw new Error("Player must be loaded before player_agents.js");

    var player;
    function _sync() { player = Player.state; }
    // ========================================================
    // §12G  NOBLE AGENTS SYSTEM
    // ========================================================
    var _nextAgentId = 1;
    // v9p33river304: re-sync the counter to be safely above the highest
    // existing agent ID. Called from agentUid() so new IDs never collide
    // with loaded saved agents (the counter resets to 1 on every page
    // load while saved agents keep their old numeric IDs).
    function _syncAgentIdCounter() {
        if (!player || !player.agents || player.agents.length === 0) return;
        var maxId = 0;
        for (var i = 0; i < player.agents.length; i++) {
            var id = player.agents[i].id || '';
            // ids are 'agent_N' — parse the numeric suffix
            var m = /^agent_(\d+)$/.exec(id);
            if (m) {
                var n = parseInt(m[1], 10);
                if (!isNaN(n) && n > maxId) maxId = n;
            }
        }
        if (maxId >= _nextAgentId) _nextAgentId = maxId + 1;
    }
    function agentUid() {
        _sync();
        _syncAgentIdCounter();
        return 'agent_' + (_nextAgentId++);
    }

    // Random agent name generator
    var _agentFirstNames = ['Marcus','Aldric','Rowan','Felix','Cedric','Hugo','Lucian','Dorian','Giles','Edmund','Theron','Gareth','Silas','Owen','Roderick','Elias','Conrad','Barrett','Desmond','Caspian','Lydia','Brenna','Isolde','Mira','Seraphina','Rowena','Helena','Celeste','Ingrid','Astrid'];
    var _agentLastNames = ['Blackwood','Ashford','Thornhill','Greymane','Ironside','Coldwell','Ravenscroft','Nightshade','Foxglove','Stormwind','Hawkridge','Duskmoore','Whitmore','Redfield','Deepwater','Fairfax','Goldwyn','Silverhand','Oakhart','Briarwood'];

    function getMaxAgents() {
        _sync();
        var maxRank = 0;
        var sr = player.socialRank || {};
        for (var k in sr) { if (sr[k] > maxRank) maxRank = sr[k]; }
        if (maxRank >= 6) return 6;  // Royal Advisor
        if (maxRank >= 5) return 4;  // Lord
        if (maxRank >= 4) return 2;  // Minor Noble
        return 0;
    }

    function getAgentDailyCost(townId) {
        _sync();
        var base = 25;
        var town = Engine.findTown(townId);
        if (town) {
            var prosperity = town.prosperity || 50;
            base = Math.round(25 + (prosperity / 100) * 15); // 25-40g depending on prosperity
        }
        return base;
    }

    function hireAgent(townId) {
        _sync();
        if (!player.isNoble) return { success: false, message: 'You must be a noble to hire agents.' };
        if (!player.agents) player.agents = [];
        var maxA = getMaxAgents();
        if ((player.agents || []).length >= maxA) return { success: false, message: 'You can only have ' + maxA + ' agents at your current rank.' };
        if (!townId) townId = player.townId;
        if (player.townId !== townId) return { success: false, message: 'You must be in the town to hire.' };
        var cost = getAgentDailyCost(townId);
        var hireFee = cost * 10; // 10 days upfront
        if (player.gold < hireFee) return { success: false, message: 'Hiring costs ' + hireFee + 'g upfront (10 days wages at ' + cost + 'g/day).' };

        var rng = Engine.getRng();
        player.gold -= hireFee;
        // v9p33river312: missing finance ledger entry — agent hire fees
        // were deducted from gold but never logged, leaving them
        // invisible in the player's finance report.
        if (Player.logFinance) Player.logFinance(-hireFee, 'agents', 'Hire agent');
        else if (player.stats) player.stats.totalGoldSpent = (player.stats.totalGoldSpent || 0) + hireFee;
        var firstName = _agentFirstNames[rng ? rng.randInt(0, _agentFirstNames.length - 1) : Math.floor(Math.random() * _agentFirstNames.length)];
        var lastName = _agentLastNames[rng ? rng.randInt(0, _agentLastNames.length - 1) : Math.floor(Math.random() * _agentLastNames.length)];

        var agent = {
            id: agentUid(),
            name: firstName + ' ' + lastName,
            hiredDay: Engine.getDay(),
            dailyCost: cost,
            townId: townId,
            status: 'idle', // idle, traveling, working, caught, jailed
            task: null,
            travelingTo: null,
            travelProgress: 0,
            travelRoute: null,
            travelTotalDist: 0,
            loyalty: 70 + (rng ? rng.randInt(0, 30) : Math.floor(Math.random() * 30)),
            skills: {
                combat: 1 + (rng ? rng.randInt(0, 7) : Math.floor(Math.random() * 7)),
                stealth: 1 + (rng ? rng.randInt(0, 7) : Math.floor(Math.random() * 7)),
                trade: 1 + (rng ? rng.randInt(0, 7) : Math.floor(Math.random() * 7)),
                persuasion: 1 + (rng ? rng.randInt(0, 7) : Math.floor(Math.random() * 7))
            },
            lastPaidDay: Engine.getDay(),
            catchCount: 0,
            earnings: 0, // total gold earned for player
            reports: [] // messages from agent
        };
        player.agents.push(agent);
        Engine.logEvent(player.fullName + ' hired agent ' + agent.name + ' in ' + (Engine.findTown(townId) || {}).name + '.', null, 'my_business');
        // Notify story mode
        if (typeof StoryMode !== 'undefined' && StoryMode.onPlayerAction) {
            StoryMode.onPlayerAction('hire_agent', { agentId: agent.id });
        }
        return { success: true, message: '✅ Hired ' + agent.name + ' for ' + hireFee + 'g (' + cost + 'g/day). Skills: ⚔️' + agent.skills.combat + ' 🥷' + agent.skills.stealth + ' 📊' + agent.skills.trade + ' 🗣️' + agent.skills.persuasion, agent: agent };
    }

    function fireAgent(agentId) {
        _sync();
        var idx = -1;
        for (var i = 0; i < (player.agents || []).length; i++) {
            if (player.agents[i].id === agentId) { idx = i; break; }
        }
        if (idx === -1) return { success: false, message: 'Agent not found.' };
        var agent = player.agents[idx];
        if (agent.status === 'jailed') return { success: false, message: agent.name + ' is in jail and cannot be dismissed yet.' };
        player.agents.splice(idx, 1);
        return { success: true, message: '✅ Dismissed ' + agent.name + '.' };
    }

    function findAgent(agentId) {
        _sync();
        for (var i = 0; i < (player.agents || []).length; i++) {
            if (player.agents[i].id === agentId) return player.agents[i];
        }
        return null;
    }

    // ── Agent Task Assignment ──
    var AGENT_TASK_DEFS = {
        // HOSTILE tasks
        sabotage_buildings: { category: 'hostile', label: 'Sabotage Buildings', icon: '🔨', duration: 3, skillKey: 'stealth', baseDetection: 0.25, desc: 'Disable target\'s building production for 15-30 days' },
        arson_buildings: { category: 'hostile', label: 'Arson', icon: '🔥', duration: 5, skillKey: 'stealth', baseDetection: 0.40, desc: 'Burn down target\'s buildings permanently' },
        raid_caravans: { category: 'hostile', label: 'Raid Caravans', icon: '⚔️', duration: 7, skillKey: 'combat', baseDetection: 0.30, desc: 'Intercept and loot target\'s trade caravans' },
        spread_rumors: { category: 'hostile', label: 'Spread Rumors', icon: '🗣️', duration: 5, skillKey: 'persuasion', baseDetection: 0.15, desc: 'Damage target\'s reputation across the kingdom' },
        steal_goods: { category: 'hostile', label: 'Steal from Warehouses', icon: '🥷', duration: 3, skillKey: 'stealth', baseDetection: 0.35, desc: 'Pilfer goods from target\'s buildings/warehouses' },
        intimidate: { category: 'hostile', label: 'Intimidate', icon: '💀', duration: 2, skillKey: 'combat', baseDetection: 0.20, desc: 'Threaten target, reducing their influence and morale' },
        // BUSINESS tasks
        run_caravan: { category: 'business', label: 'Run Trade Caravan', icon: '🐴', duration: 0, skillKey: 'trade', baseDetection: 0, desc: 'Autonomously create and run profitable trade routes' },
        scout_markets: { category: 'business', label: 'Scout Markets', icon: '🔍', duration: 10, skillKey: 'trade', baseDetection: 0, desc: 'Find supply/demand gaps and report profitable opportunities' },
        buy_sell_goods: { category: 'business', label: 'Buy/Sell Goods', icon: '💰', duration: 0, skillKey: 'trade', baseDetection: 0, desc: 'Auto-trade at assigned town within monthly budget' },
        manage_properties: { category: 'business', label: 'Manage Properties', icon: '🏠', duration: 0, skillKey: 'trade', baseDetection: 0, desc: 'Optimize your buildings and collect revenue' },
        establish_contacts: { category: 'business', label: 'Establish Trade Contacts', icon: '🤝', duration: 15, skillKey: 'persuasion', baseDetection: 0, desc: 'Set up trade connections in foreign towns' },
        guard_properties: { category: 'business', label: 'Guard Properties', icon: '🛡️', duration: 0, skillKey: 'combat', baseDetection: 0, desc: 'Protect your buildings from sabotage and theft' },
        // INTELLIGENCE tasks
        spy_on_target: { category: 'intel', label: 'Spy on Target', icon: '🕵️', duration: 7, skillKey: 'stealth', baseDetection: 0.20, desc: 'Gather intel on target\'s assets, income, and weaknesses' },
        counter_intel: { category: 'intel', label: 'Counter-Intelligence', icon: '🛡️', duration: 0, skillKey: 'stealth', baseDetection: 0, desc: 'Detect and prevent schemes against you' },
        // DIPLOMATIC tasks
        build_noble_relationship: { category: 'diplomatic', label: 'Build Noble Relationship', icon: '🤝', duration: 0, skillKey: 'persuasion', baseDetection: 0.10, desc: 'Gradually improve relationship between player and target noble' },
        diplomatic_courier: { category: 'diplomatic', label: 'Diplomatic Courier', icon: '📜', duration: 10, skillKey: 'persuasion', baseDetection: 0.05, desc: 'Carry diplomatic messages and gifts to improve standing' },
        noble_intrigue_turn: { category: 'diplomatic', label: 'Turn Noble Against King', icon: '🏴', duration: 0, skillKey: 'persuasion', baseDetection: 0.30, desc: 'Undermine target noble\'s loyalty to their king' },
        noble_intrigue_discredit: { category: 'diplomatic', label: 'Discredit Noble', icon: '📜', duration: 0, skillKey: 'persuasion', baseDetection: 0.25, desc: 'Spread misinformation to damage noble\'s perceived loyalty' },
        noble_intrigue_expose: { category: 'diplomatic', label: 'Expose Noble Secrets', icon: '💥', duration: 0, skillKey: 'stealth', baseDetection: 0.20, desc: 'Investigate and expose damaging information about a noble' }
    };

    function assignAgentTask(agentId, taskType, params) {
        _sync();
        var agent = findAgent(agentId);
        if (!agent) return { success: false, message: 'Agent not found.' };
        if (agent.status === 'jailed') return { success: false, message: agent.name + ' is in jail.' };
        if (agent.status === 'caught') return { success: false, message: agent.name + ' was recently caught and is laying low.' };
        var def = AGENT_TASK_DEFS[taskType];
        if (!def) return { success: false, message: 'Unknown task type.' };

        params = params || {};
        var day = Engine.getDay();

        // For hostile tasks, need a target
        if (def.category === 'hostile' && !params.targetId) {
            return { success: false, message: 'Must select a target for hostile tasks.' };
        }

        // For diplomatic tasks, need a target noble
        if (def.category === 'diplomatic' && !params.targetId) {
            return { success: false, message: 'Must select a target noble for diplomatic tasks.' };
        }

        // For business tasks with budget, validate
        if (params.monthlyBudget !== undefined && params.monthlyBudget < 0) {
            return { success: false, message: 'Budget cannot be negative.' };
        }

        // If agent needs to travel to a different town
        var targetTown = params.targetTownId || null;
        if (def.category === 'hostile' && params.targetId) {
            var targetPerson = Engine.findPerson(params.targetId);
            if (targetPerson) targetTown = targetPerson.townId;
        }

        agent.task = {
            type: taskType,
            category: def.category,
            targetId: params.targetId || null,
            targetTownId: targetTown || agent.townId,
            allowedActions: params.allowedActions || null, // for hostile: {sabotage:true, arson:true, etc}
            monthlyBudget: params.monthlyBudget || 0,
            monthlySpent: 0,
            startDay: day,
            duration: def.duration, // 0 = ongoing
            // v9p33river302: was 0 — newly assigned tasks executed on
            // the very next tick (day - 0 >> actionInterval). Initialize
            // to the assignment day so the interval check actually waits.
            lastActionDay: day,
            results: [],
            goodsAcquired: {},
            goldEarned: 0
        };
        agent.status = 'working';

        // If agent is not in the target town, they need to travel first
        if (targetTown && targetTown !== agent.townId) {
            _startAgentTravel(agent, targetTown);
        }

        // Notify story mode of agent task assignment
        if (typeof StoryMode !== 'undefined' && StoryMode.onPlayerAction) {
            StoryMode.onPlayerAction('assign_agent_task', { agentId: agent.id, taskType: taskType, category: def.category, targetId: params.targetId || null });
        }

        return { success: true, message: '✅ ' + agent.name + ' assigned: ' + def.icon + ' ' + def.label + (targetTown && targetTown !== agent.townId ? ' (traveling to target)' : '') };
    }

    function cancelAgentTask(agentId) {
        _sync();
        var agent = findAgent(agentId);
        if (!agent) return { success: false, message: 'Agent not found.' };
        if (!agent.task && agent.status === 'idle') return { success: false, message: agent.name + ' has no active task.' };
        agent.task = null;
        agent.status = 'idle';
        agent.travelingTo = null;
        agent.travelProgress = 0;
        agent.travelRoute = null;
        agent.travelTotalDist = 0;
        // v9p33river333: clear stale travel/UI labels when a task is cancelled mid-route.
        agent.travelStatus = null;
        agent.currentAction = null;
        return { success: true, message: '✅ ' + agent.name + ' task cancelled. Now idle in ' + ((Engine.findTown(agent.townId) || {}).name || 'unknown') + '.' };
    }

    function recallAgent(agentId) {
        _sync();
        var agent = findAgent(agentId);
        if (!agent) return { success: false, message: 'Agent not found.' };
        agent.task = null;
        if (agent.townId !== player.townId) {
            // v9p33river333: _startAgentTravel owns status='traveling'; don't mark idle first.
            _startAgentTravel(agent, player.townId);
            return { success: true, message: '✅ ' + agent.name + ' recalled, traveling back to you.' };
        }
        agent.status = 'idle';
        agent.travelingTo = null;
        agent.travelProgress = 0;
        agent.travelRoute = null;
        agent.travelTotalDist = 0;
        return { success: true, message: '✅ ' + agent.name + ' recalled and idle.' };
    }

    function _startAgentTravel(agent, destTownId) {
        _sync();
        var fromTown = Engine.findTown(agent.townId);
        var toTown = Engine.findTown(destTownId);
        if (!fromTown || !toTown) return;
        agent.travelingTo = destTownId;
        agent.travelProgress = 0;
        // Estimate distance
        var dx = (fromTown.x || 0) - (toTown.x || 0);
        var dy = (fromTown.y || 0) - (toTown.y || 0);
        agent.travelTotalDist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        agent.status = 'traveling';
    }

    // ── Agent Daily Tick ──
    function tickAgents() {
        _sync();
        if (!player.agents || player.agents.length === 0) return;
        var day = Engine.getDay();
        var rng = Engine.getRng();

        for (var i = player.agents.length - 1; i >= 0; i--) {
            var agent = player.agents[i];

            // Daily cost
            if (day > agent.lastPaidDay) {
                var daysMissed = day - agent.lastPaidDay;
                var totalCost = agent.dailyCost * daysMissed;
                if (player.gold >= totalCost) {
                    player.gold -= totalCost;
                    // v9p33river312: log agent wage payments to finance
                    // ledger. Previously vanished from the player's
                    // expense report despite draining gold daily.
                    if (Player.logFinance) Player.logFinance(-totalCost, 'agents', 'Agent wages (' + agent.name + ')');
                    else if (player.stats) player.stats.totalGoldSpent = (player.stats.totalGoldSpent || 0) + totalCost;
                    agent.lastPaidDay = day;
                } else if (player.gold > 0) {
                    // Pay partial
                    var daysPaid = Math.floor(player.gold / agent.dailyCost);
                    var _partialCost = daysPaid * agent.dailyCost;
                    player.gold -= _partialCost;
                    if (Player.logFinance && _partialCost > 0) Player.logFinance(-_partialCost, 'agents', 'Agent wages partial (' + agent.name + ')');
                    else if (player.stats && _partialCost > 0) player.stats.totalGoldSpent = (player.stats.totalGoldSpent || 0) + _partialCost;
                    // v9p33river333: partial wages pay the oldest days but unpaid skipped days remain owed.
                    if (daysPaid > 0) agent.lastPaidDay = Math.min(day, agent.lastPaidDay + daysPaid);
                    if (daysPaid < daysMissed) agent._unpaidWageDays = (agent._unpaidWageDays || 0) + (daysMissed - daysPaid);
                    agent.loyalty = Math.max(0, agent.loyalty - (daysMissed - daysPaid) * 3);
                } else {
                    agent.loyalty = Math.max(0, agent.loyalty - daysMissed * 5);
                }
                // Loyalty too low — agent quits
                if (agent.loyalty <= 10) {
                    agent.reports.push({ day: day, msg: '💔 ' + agent.name + ' quit due to unpaid wages!' });
                    player.agents.splice(i, 1);
                    continue;
                }
            }

            // Jailed agents: serve time
            // v9p33river320: was only checking _jailUntil. v316 normalized
            // agent jail flag to _jailedUntilDay with _jailUntil as a
            // legacy alias. Check both so the release path fires.
            if (agent.status === 'jailed') {
                var _ajRelease = agent._jailedUntilDay || agent._jailUntil || 0;
                if (_ajRelease && day >= _ajRelease) {
                    agent.status = 'idle';
                    agent.task = null;
                    agent._jailedUntilDay = 0;
                    agent._jailUntil = 0;
                    agent.reports.push({ day: day, msg: '🔓 ' + agent.name + ' released from jail.' });
                }
                continue;
            }

            // Caught agents: lay low for a few days
            if (agent.status === 'caught') {
                if (agent._cooldownUntil && day >= agent._cooldownUntil) {
                    agent.status = 'idle';
                    agent._cooldownUntil = 0;
                }
                continue;
            }

            // Traveling agents: move toward destination
            if (agent.status === 'traveling' && agent.travelingTo) {
                var speed = 50; // pixels per day equivalent
                agent.travelProgress += speed;
                if (agent.travelProgress >= agent.travelTotalDist) {
                    agent.townId = agent.travelingTo;
                    agent.travelingTo = null;
                    agent.travelProgress = 0;
                    agent.travelRoute = null;
                    if (agent.task) {
                        agent.status = 'working';
                        agent.reports.push({ day: day, msg: '📍 ' + agent.name + ' arrived at ' + ((Engine.findTown(agent.townId) || {}).name || 'destination') + '.' });
                    } else {
                        agent.status = 'idle';
                    }
                }
                continue;
            }

            // Working agents: execute task
            if (agent.status === 'working' && agent.task) {
                _tickAgentTask(agent, day, rng);
            }

            // Cap reports to prevent memory leak
            if (agent.reports && agent.reports.length > 50) {
                agent.reports = agent.reports.slice(-50);
            }
        }
    }

    // ── Agent Task Execution ──
    function _tickAgentTask(agent, day, rng) {
        _sync();
        var task = agent.task;
        var def = AGENT_TASK_DEFS[task.type];
        if (!def) return;

        // Finite-duration tasks: check completion
        if (def.duration > 0 && day - task.startDay >= def.duration) {
            _completeAgentTask(agent, day, rng);
            return;
        }

        // Ongoing tasks execute periodically
        var actionInterval = def.category === 'hostile' ? 3 : 5; // hostile every 3 days, business every 5
        if (day - task.lastActionDay < actionInterval) return;
        task.lastActionDay = day;

        if (def.category === 'hostile') {
            _executeHostileAction(agent, day, rng);
        } else if (def.category === 'business') {
            _executeBusinessAction(agent, day, rng);
        } else if (def.category === 'intel') {
            _executeIntelAction(agent, day, rng);
        } else if (def.category === 'diplomatic') {
            _executeDiplomaticAction(agent, day, rng);
        }
    }

    // ── HOSTILE TASK EXECUTION ──
    function _executeHostileAction(agent, day, rng) {
        _sync();
        var task = agent.task;
        var def = AGENT_TASK_DEFS[task.type];
        var target = Engine.findPerson(task.targetId);
        if (!target || !target.alive) {
            agent.reports.push({ day: day, msg: '❌ Target no longer available. Task cancelled.' });
            agent.task = null;
            agent.status = 'idle';
            return;
        }

        // Detection chance reduced by stealth skill
        var detection = def.baseDetection * (1 - agent.skills.stealth * 0.06);
        detection = Math.max(0.03, Math.min(0.90, detection));
        var caught = rng ? rng.chance(detection) : Math.random() < detection;

        if (caught) {
            agent.catchCount++;
            agent.reports.push({ day: day, msg: '🚨 ' + agent.name + ' was CAUGHT during ' + def.label + '!' });

            // Check noble notoriety: use CURRENT notoriety as % chance nobles/king catch the PLAYER
            var punishResult = null;
            if (Player.checkNobleNotorietyPunishment) {
                punishResult = Player.checkNobleNotorietyPunishment(def.label);
            }

            // Determine if agent is in own kingdom or foreign
            var agentTown = Engine.findTown(agent.townId);
            var agentKingdomId = agentTown ? agentTown.kingdomId : '';
            var isOwnKingdom = agentKingdomId === player.citizenshipKingdomId;
            var isForeignKingdom = agentKingdomId && !isOwnKingdom;
            var isForeignAtWar = false;
            if (isForeignKingdom) {
                var _playerK = Engine.findKingdom ? Engine.findKingdom(player.citizenshipKingdomId) : null;
                if (_playerK && _playerK.atWar && _playerK.atWar.has && _playerK.atWar.has(agentKingdomId)) isForeignAtWar = true;
            }

            // Noble notoriety penalties based on kingdom context
            if (isOwnKingdom) {
                // Own kingdom: +25 notoriety, disable 10 days
                player.nobleNotoriety = Math.min(CONFIG.NOBLE_NOTORIETY_MAX || 100,
                    (player.nobleNotoriety || 0) + 25);
                var disableDays = 10;
                agent.status = 'caught';
                agent._cooldownUntil = day + disableDays;
                agent.task = null;
            } else if (isForeignAtWar) {
                // Foreign kingdom at war: +30 notoriety, 50% chance agent permanently lost
                player.nobleNotoriety = Math.min(CONFIG.NOBLE_NOTORIETY_MAX || 100,
                    (player.nobleNotoriety || 0) + 30);
                var agentExecuted = rng ? rng.chance(0.50) : Math.random() < 0.50;
                if (agentExecuted) {
                    // Agent permanently lost
                    agent.reports.push({ day: day, msg: '☠️ ' + agent.name + ' was executed as a spy by the enemy kingdom!' });
                    Engine.logEvent('☠️ Agent ' + agent.name + ' was executed as a spy in a hostile kingdom!', null, 'my_actions');
                    agent.status = 'dead';
                    agent.task = null;
                    agent.travelingTo = null;
                    agent.travelProgress = 0;
                    agent.travelRoute = null;
                    agent._dead = true;
                    // v9p33river333: clear stale selection/task references for removed hostile agents.
                    if (player.selectedAgentId === agent.id) player.selectedAgentId = null;
                    if (player.activeAgentId === agent.id) player.activeAgentId = null;
                    // Remove agent from roster
                    if (player.agents) {
                        for (var _ari = player.agents.length - 1; _ari >= 0; _ari--) {
                            if (player.agents[_ari].id === agent.id) {
                                player.agents.splice(_ari, 1);
                                break;
                            }
                        }
                    }
                } else {
                    agent.status = 'jailed';
                    // v9p33river316: normalize agent jail flag to
                    // _jailedUntilDay so it matches the canonical NPC
                    // jail field used by ui_actions / engine checks.
                    agent._jailedUntilDay = day + 14;
                    agent._jailUntil = agent._jailedUntilDay; // legacy alias
                    agent.task = null;
                    agent.reports.push({ day: day, msg: '🔒 ' + agent.name + ' was jailed for 14 days in a hostile kingdom.' });
                }
            } else if (isForeignKingdom) {
                // Foreign kingdom not at war: +15 notoriety, agent jailed 7 days
                player.nobleNotoriety = Math.min(CONFIG.NOBLE_NOTORIETY_MAX || 100,
                    (player.nobleNotoriety || 0) + 15);
                agent.status = 'jailed';
                agent._jailedUntilDay = day + 7;
                agent._jailUntil = agent._jailedUntilDay; // legacy alias
                agent.task = null;
                agent.reports.push({ day: day, msg: '🔒 ' + agent.name + ' was jailed for 7 days in a foreign kingdom.' });
            } else {
                // Fallback: original behavior
                player.nobleNotoriety = Math.min(CONFIG.NOBLE_NOTORIETY_MAX || 100,
                    (player.nobleNotoriety || 0) + (CONFIG.NOBLE_NOTORIETY_AGENT_CAUGHT_ADD || 15));
                var disableDays = CONFIG.NOBLE_NOTORIETY_AGENT_DISABLE_DAYS || 30;
                agent.status = 'caught';
                agent._cooldownUntil = day + disableDays;
                agent.task = null;
            }

            // Minor reputation hit (the agent was caught, not necessarily the player)
            var repKingdomId = agentKingdomId || '';
            if (repKingdomId && player.reputation) {
                player.reputation[repKingdomId] = Math.max(0, (player.reputation[repKingdomId] || 50) - 3);
            }

            if (punishResult && punishResult.punished) {
                agent.reports.push({ day: day, msg: '⚠️ The nobles traced ' + agent.name + '\'s actions back to you! ' + punishResult.message });
                Engine.logEvent('🔍 ' + player.fullName + '\'s scheming was discovered by the nobility! ' + punishResult.message, null, 'my_actions');
            } else if (!agent._dead) {
                var _disableLabel = agent.status === 'jailed' ? ('jailed for ' + (agent._jailUntil - day) + ' days') : ('laying low for ' + ((agent._cooldownUntil || day) - day) + ' days');
                Engine.logEvent(player.fullName + '\'s agent ' + agent.name + ' was caught during ' + def.label + ' and is ' + _disableLabel + '.', null, 'my_actions');
            }
            return;
        }

        // Success! Execute the specific action
        var targetTown = Engine.findTown(target.townId || agent.townId);
        // v9p33river302: previously dispatched only on task.type (the first
        // checked action at assignment time), so picking multiple actions in
        // the hostile UI had no effect — the remainder of allowedActions
        // never ran. Pick a random allowed action each tick so all checked
        // boxes contribute.
        var _hostileChoice = task.type;
        if (task.allowedActions && typeof task.allowedActions === 'object') {
            var _hostileKeys = [];
            for (var _hak in task.allowedActions) {
                if (task.allowedActions[_hak]) _hostileKeys.push(_hak);
            }
            if (_hostileKeys.length > 0) {
                _hostileChoice = rng ? _hostileKeys[rng.randInt(0, _hostileKeys.length - 1)] : _hostileKeys[Math.floor(Math.random() * _hostileKeys.length)];
            }
        }
        switch (_hostileChoice) {
            case 'sabotage_buildings':
                _agentSabotageBuilding(agent, target, targetTown, day, rng);
                break;
            case 'arson_buildings':
                _agentArsonBuilding(agent, target, targetTown, day, rng);
                break;
            case 'raid_caravans':
                _agentRaidCaravan(agent, target, day, rng);
                break;
            case 'spread_rumors':
                _agentSpreadRumors(agent, target, targetTown, day, rng);
                break;
            case 'steal_goods':
                _agentStealGoods(agent, target, targetTown, day, rng);
                break;
            case 'intimidate':
                _agentIntimidate(agent, target, day, rng);
                break;
        }
    }

    function _agentSabotageBuilding(agent, target, town, day, rng) {
        _sync();
        if (!town) return;
        var targetBuildings = town.buildings.filter(function(b) { return b.ownerId === target.id; });
        if (targetBuildings.length === 0) {
            agent.reports.push({ day: day, msg: '🔨 No buildings belonging to target found in ' + town.name + '.' });
            return;
        }
        var bld = targetBuildings[rng ? rng.randInt(0, targetBuildings.length - 1) : 0];
        var bt = Engine.findBuildingType ? Engine.findBuildingType(bld.type) : null;
        bld._disabledUntil = day + 15 + (rng ? rng.randInt(0, 15) : 10);
        agent.reports.push({ day: day, msg: '🔨 Sabotaged ' + (bt ? bt.name : bld.type) + ' owned by ' + (target.firstName || 'target') + '. Disabled for ' + (bld._disabledUntil - day) + ' days.' });
        if (typeof StoryMode !== 'undefined' && StoryMode.onPlayerAction) {
            StoryMode.onPlayerAction('agent_sabotage', { agentId: agent.id, townId: agent.townId, targetId: agent.task.targetId });
        }
    }

    function _agentArsonBuilding(agent, target, town, day, rng) {
        _sync();
        if (!town) return;
        var idx = -1;
        for (var i = 0; i < town.buildings.length; i++) {
            if (town.buildings[i].ownerId === target.id) { idx = i; break; }
        }
        if (idx === -1) {
            agent.reports.push({ day: day, msg: '🔥 No buildings belonging to target found in ' + town.name + '.' });
            return;
        }
        var bld = town.buildings[idx];
        var bt = Engine.findBuildingType ? Engine.findBuildingType(bld.type) : null;
        town.buildings.splice(idx, 1);
        if (town.prosperity) town.prosperity = Math.max(0, town.prosperity - 3);
        agent.reports.push({ day: day, msg: '🔥 Burned down ' + (bt ? bt.name : bld.type) + ' owned by ' + (target.firstName || 'target') + ' in ' + town.name + '!' });
        Engine.logEvent('A building in ' + town.name + ' was destroyed by fire!');
        if (typeof StoryMode !== 'undefined' && StoryMode.onPlayerAction) {
            StoryMode.onPlayerAction('agent_sabotage', { agentId: agent.id, townId: agent.townId, targetId: agent.task.targetId });
        }
    }

    function _agentRaidCaravan(agent, target, day, rng) {
        _sync();
        // Find target's caravans (EM caravans or NPC caravans)
        var caravans = target.emCaravans || target.caravans || [];
        var activeCaravans = caravans.filter(function(c) { return c.active && c.status === 'traveling'; });
        if (activeCaravans.length === 0) {
            agent.reports.push({ day: day, msg: '⚔️ No active caravans found for target. Waiting...' });
            return;
        }
        var caravan = activeCaravans[rng ? rng.randInt(0, activeCaravans.length - 1) : 0];
        var lootGold = 50 + (rng ? rng.randInt(0, 150) : 75);
        player.gold += lootGold;
        agent.earnings += lootGold;
        // v9p33river333: fully deactivate raided caravans, not just status-label them.
        caravan.active = false;
        caravan.status = 'destroyed';
        caravan.traveling = false;
        caravan.progress = 1;
        caravan.route = null;
        caravan.toTownId = null;
        agent.reports.push({ day: day, msg: '⚔️ Raided caravan! Looted ' + lootGold + 'g from ' + (target.firstName || 'target') + '\'s caravan.' });
    }

    function _agentSpreadRumors(agent, target, town, day, rng) {
        _sync();
        var repDamage = 3 + (agent.skills.persuasion > 5 ? 3 : 0) + (rng ? rng.randInt(0, 4) : 2);
        // Damage target's relationships with other NPCs
        if (target._playerRelationship !== undefined) {
            target._playerRelationship = Math.max(-100, (target._playerRelationship || 0) - Math.floor(repDamage / 2));
        }
        // Damage target's standing in kingdom — reduce their gold (lost business from bad rep)
        var goldLoss = repDamage * 10;
        if (target.gold !== undefined) {
            target.gold = Math.max(0, (target.gold || 0) - goldLoss);
        }
        // Reduce town prosperity slightly (discord hurts commerce)
        if (town && town.prosperity) {
            town.prosperity = Math.max(0, town.prosperity - 1);
        }
        // v9p33river292: NPC reputation lives in target.reputation[kingdomId]
        // (per-kingdom map), matching how the noble-intrigue path applies it
        // at player_agents.js:1023-1028. target._reputation is only used for
        // BUILDINGS (bld._reputation) and was a dead write on persons.
        if (target.reputation === undefined) target.reputation = {};
        var _rumorKId = town ? town.kingdomId : '';
        if (_rumorKId) {
            target.reputation[_rumorKId] = Math.max(0, (target.reputation[_rumorKId] || 50) - repDamage);
        }
        agent.reports.push({ day: day, msg: '🗣️ Spread damaging rumors about ' + (target.firstName || 'target') + '. Rep -' + repDamage + ', gold -' + goldLoss + 'g.' });
    }

    function _agentStealGoods(agent, target, town, day, rng) {
        _sync();
        if (!town) return;
        // Steal from target's buildings
        var targetBuildings = town.buildings.filter(function(b) { return b.ownerId === target.id; });
        if (targetBuildings.length === 0) {
            agent.reports.push({ day: day, msg: '🥷 No warehouses/buildings found for target.' });
            return;
        }
        var goldStolen = 20 + (rng ? rng.randInt(0, 80) : 40) + agent.skills.stealth * 5;
        // v9p33river304: previously minted gold — added to player + agent
        // earnings without removing anything from the target. Deduct from
        // target gold first (clamped to what they actually have).
        var targetHas = Math.max(0, Math.floor(target.gold || 0));
        var actuallyStolen = Math.min(goldStolen, targetHas);
        if (actuallyStolen <= 0) {
            agent.reports.push({ day: day, msg: '🥷 Target had nothing of value in their warehouse.' });
            return;
        }
        target.gold = (target.gold || 0) - actuallyStolen;
        // v9p33river333: remove linked warehouse/retail stock so victim wealth doesn't desync.
        var _stockValueLeft = actuallyStolen;
        for (var _tbi = 0; _tbi < targetBuildings.length && _stockValueLeft > 0; _tbi++) {
            var _tb = targetBuildings[_tbi];
            var _stocks = [_tb.storage, _tb.retailStock, _tb.inventory];
            for (var _si = 0; _si < _stocks.length && _stockValueLeft > 0; _si++) {
                var _stock = _stocks[_si];
                if (!_stock) continue;
                for (var _gid in _stock) {
                    if (_stockValueLeft <= 0) break;
                    var _qty = Math.max(0, Math.floor(_stock[_gid] || 0));
                    if (_qty <= 0) continue;
                    var _res = findResource(_gid);
                    var _unitValue = Math.max(1, (_res && _res.basePrice) || 5);
                    var _takeQty = Math.min(_qty, Math.ceil(_stockValueLeft / _unitValue));
                    _stock[_gid] -= _takeQty;
                    if (_stock[_gid] <= 0) delete _stock[_gid];
                    _stockValueLeft -= _takeQty * _unitValue;
                }
            }
        }
        player.gold += actuallyStolen;
        agent.earnings += actuallyStolen;
        agent.reports.push({ day: day, msg: '🥷 Stole ' + actuallyStolen + 'g worth of goods from ' + (target.firstName || 'target') + '\'s warehouse.' });
    }

    function _agentIntimidate(agent, target, day, rng) {
        _sync();
        var success = agent.skills.combat >= 4 || (rng ? rng.chance(0.6 + agent.skills.combat * 0.05) : Math.random() < 0.7);
        if (success) {
            if (target._playerRelationship !== undefined) {
                target._playerRelationship = (target._playerRelationship || 0) - 10;
            }
            // v9p33river292: NPC reputation lives in target.reputation[kingdomId]
            // (per-kingdom map). target._reputation was a dead write — only
            // buildings use the underscore-prefixed field.
            if (target.reputation === undefined) target.reputation = {};
            var _intimKId = '';
            try {
                var _intimTown = target.townId && Engine.findTown ? Engine.findTown(target.townId) : null;
                if (_intimTown) _intimKId = _intimTown.kingdomId || '';
            } catch (_e) {}
            if (_intimKId) {
                target.reputation[_intimKId] = Math.max(0, (target.reputation[_intimKId] || 50) - 5);
            }
            agent.reports.push({ day: day, msg: '💀 Successfully intimidated ' + (target.firstName || 'target') + '. They\'re shaken.' });
        } else {
            agent.reports.push({ day: day, msg: '💀 Intimidation attempt on ' + (target.firstName || 'target') + ' failed. They stood their ground.' });
        }
    }

    // ── BUSINESS TASK EXECUTION ──
    function _executeBusinessAction(agent, day, rng) {
        _sync();
        var task = agent.task;

        // Monthly budget check (30-day cycle)
        if (task.monthlyBudget > 0) {
            var dayInCycle = (day - task.startDay) % 30;
            if (dayInCycle === 0 && day !== task.startDay) task.monthlySpent = 0; // reset monthly
            if (task.monthlySpent >= task.monthlyBudget) return; // budget exhausted
        }

        switch (task.type) {
            case 'run_caravan':
                _agentRunCaravan(agent, day, rng);
                break;
            case 'scout_markets':
                _agentScoutMarkets(agent, day, rng);
                break;
            case 'buy_sell_goods':
                _agentBuySell(agent, day, rng);
                break;
            case 'manage_properties':
                _agentManageProperties(agent, day, rng);
                break;
            case 'establish_contacts':
                _agentEstablishContacts(agent, day, rng);
                break;
            case 'guard_properties':
                _agentGuardProperties(agent, day, rng);
                break;
        }
    }

    function _agentRunCaravan(agent, day, rng) {
        _sync();
        // Agent finds profitable route and trades
        var town = Engine.findTown(agent.townId);
        if (!town || !town.market) return;
        var towns = Engine.getTowns ? Engine.getTowns() : [];
        var bestProfit = 0;
        var bestRes = null;
        var bestDest = null;
        // Find best single-good trade
        for (var ti = 0; ti < towns.length; ti++) {
            var dest = towns[ti];
            if (dest.id === agent.townId || !dest.market) continue;
            for (var resKey in (town.market.supply || {})) {
                var localSupply = town.market.supply[resKey] || 0;
                var localPrice = town.market.prices[resKey] || 10;
                var destPrice = dest.market.prices[resKey] || 10;
                if (localSupply >= 10 && destPrice > localPrice * 1.3) {
                    var profit = (destPrice - localPrice) * Math.min(20, localSupply);
                    if (profit > bestProfit) {
                        bestProfit = profit;
                        bestRes = resKey;
                        bestDest = dest;
                    }
                }
            }
        }
        if (!bestRes || !bestDest || bestProfit < 20) {
            agent.reports.push({ day: day, msg: '🐴 No profitable trade routes found. Waiting...' });
            return;
        }
        // Execute trade (simplified: instant with travel time factored into interval)
        var qty = Math.min(20, Math.floor(town.market.supply[bestRes] || 0));
        var buyCost = qty * (town.market.prices[bestRes] || 10);
        var budget = agent.task.monthlyBudget || 500;
        if (buyCost > budget - (agent.task.monthlySpent || 0)) {
            qty = Math.floor((budget - (agent.task.monthlySpent || 0)) / (town.market.prices[bestRes] || 10));
        }
        if (qty <= 0) return;
        buyCost = qty * (town.market.prices[bestRes] || 10);
        if (player.gold < buyCost) return;

        player.gold -= buyCost;
        agent.task.monthlySpent = (agent.task.monthlySpent || 0) + buyCost;
        var sellPrice = qty * (bestDest.market ? (bestDest.market.prices[bestRes] || 10) : 10);
        var netProfit = sellPrice - buyCost;
        player.gold += sellPrice;
        agent.earnings += netProfit;
        // Affect markets
        if (town.market.supply[bestRes]) town.market.supply[bestRes] = Math.max(0, town.market.supply[bestRes] - qty);
        if (bestDest.market.supply[bestRes] !== undefined) bestDest.market.supply[bestRes] = (bestDest.market.supply[bestRes] || 0) + qty;

        agent.reports.push({ day: day, msg: '🐴 Traded ' + qty + ' ' + bestRes + ' to ' + bestDest.name + ' for ' + netProfit + 'g profit.' });
    }

    function _agentScoutMarkets(agent, day, rng) {
        _sync();
        var towns = Engine.getTowns ? Engine.getTowns() : [];
        var opportunities = [];
        for (var ti = 0; ti < towns.length; ti++) {
            var t = towns[ti];
            if (!t.market) continue;
            for (var resKey in (t.market.demand || {})) {
                var demand = t.market.demand[resKey] || 0;
                var supply = t.market.supply[resKey] || 0;
                if (demand > supply * 2 && demand > 10) {
                    opportunities.push({ town: t.name, resource: resKey, demand: Math.floor(demand), supply: Math.floor(supply), price: Math.floor(t.market.prices[resKey] || 0) });
                }
            }
        }
        if (opportunities.length > 0) {
            opportunities.sort(function(a, b) { return (b.demand - b.supply) - (a.demand - a.supply); });
            var top = opportunities.slice(0, 3);
            var msg = '🔍 Market Report:\n';
            for (var oi = 0; oi < top.length; oi++) {
                msg += '  • ' + top[oi].town + ' needs ' + top[oi].resource + ' (demand: ' + top[oi].demand + ', supply: ' + top[oi].supply + ', price: ' + top[oi].price + 'g)\n';
            }
            agent.reports.push({ day: day, msg: msg });
        } else {
            agent.reports.push({ day: day, msg: '🔍 Markets are relatively balanced. No major opportunities found.' });
        }
    }

    function _agentBuySell(agent, day, rng) {
        _sync();
        var town = Engine.findTown(agent.townId);
        if (!town || !town.market) return;

        // v9p33river302: previously only bought into player.inventory with
        // no sell leg or profit realization. The agent now holds its own
        // small inventory on the task (heldGood/heldQty/heldCost) and:
        //   - If holding goods AND current price > avgCost * 1.15, sells
        //     back to this town's market, realizes profit to player.gold,
        //     and credits agent.earnings.
        //   - Otherwise buys the cheapest in-supply good as before, but
        //     tracks the hold on the task so we can sell later.
        if (!agent.task.heldQty) { agent.task.heldQty = 0; agent.task.heldGood = null; agent.task.heldCost = 0; }

        // SELL leg — if we're holding goods and price has risen, dump them
        if (agent.task.heldQty > 0 && agent.task.heldGood) {
            var sellPrice = (town.market.prices && town.market.prices[agent.task.heldGood]) || 0;
            var avgCost = agent.task.heldCost / agent.task.heldQty;
            if (sellPrice > 0 && sellPrice >= avgCost * 1.15) {
                var sellQty = agent.task.heldQty;
                var revenue = Math.floor(sellPrice * sellQty);
                player.gold += revenue;
                agent.earnings = (agent.earnings || 0) + (revenue - agent.task.heldCost);
                if (town.market.supply) {
                    town.market.supply[agent.task.heldGood] = (town.market.supply[agent.task.heldGood] || 0) + sellQty;
                }
                agent.reports.push({ day: day, msg: '💰 Sold ' + sellQty + ' ' + agent.task.heldGood + ' at ' + Math.floor(sellPrice) + 'g each in ' + town.name + ' (profit: ' + (revenue - agent.task.heldCost) + 'g).' });
                agent.task.heldQty = 0;
                agent.task.heldGood = null;
                agent.task.heldCost = 0;
                return;
            }
        }

        // BUY leg — only if we're not already holding something
        if (agent.task.heldQty > 0) return;

        var bestBuy = null;
        var bestBuyPrice = Infinity;
        for (var resKey in (town.market.supply || {})) {
            var supply = town.market.supply[resKey] || 0;
            var price = (town.market.prices && town.market.prices[resKey]) || 999;
            if (supply >= 5 && price < bestBuyPrice) {
                bestBuyPrice = price;
                bestBuy = resKey;
            }
        }
        if (!bestBuy) return;
        var qty = Math.min(10, Math.floor(town.market.supply[bestBuy] || 0));
        var cost = qty * bestBuyPrice;
        var budget = agent.task.monthlyBudget || 200;
        if (cost > budget - (agent.task.monthlySpent || 0)) return;
        if (player.gold < cost) return;

        player.gold -= cost;
        agent.task.monthlySpent = (agent.task.monthlySpent || 0) + cost;
        agent.task.heldGood = bestBuy;
        agent.task.heldQty = qty;
        agent.task.heldCost = cost;
        if (town.market.supply[bestBuy]) town.market.supply[bestBuy] = Math.max(0, town.market.supply[bestBuy] - qty);
        agent.reports.push({ day: day, msg: '🛒 Bought ' + qty + ' ' + bestBuy + ' at ' + Math.floor(bestBuyPrice) + 'g each in ' + town.name + ' (waiting for price to rise).' });
    }

    function _agentManageProperties(agent, day, rng) {
        _sync();
        var town = Engine.findTown(agent.townId);
        if (!town) return;
        // Find player buildings in this town, boost output
        var playerBuildings = town.buildings.filter(function(b) { return b.ownerId === 'player'; });
        if (playerBuildings.length === 0) {
            agent.reports.push({ day: day, msg: '🏠 No player buildings in ' + town.name + ' to manage.' });
            return;
        }
        // v9p33river306: previously minted gold from building count * skill
        // with no link to actual building output. Now only credit a small
        // efficiency bonus capped by daily wage to avoid free gold —
        // representing the agent improving margins rather than producing
        // value from thin air.
        var rawBonus = Math.floor(playerBuildings.length * (3 + agent.skills.trade));
        var dailyCap = (agent.dailyCost || 0) * 3;
        var bonus = Math.min(rawBonus, dailyCap > 0 ? dailyCap : rawBonus);
        if (bonus <= 0) {
            agent.reports.push({ day: day, msg: '🏠 Managed ' + playerBuildings.length + ' building(s) in ' + town.name + '; nothing to optimize today.' });
            return;
        }
        player.gold += bonus;
        agent.earnings += bonus;
        agent.reports.push({ day: day, msg: '🏠 Managed ' + playerBuildings.length + ' building(s) in ' + town.name + '. Earned ' + bonus + 'g in optimized revenue.' });
    }

    function _agentEstablishContacts(agent, day, rng) {
        _sync();
        var town = Engine.findTown(agent.townId);
        if (!town) return;
        // Boost town prosperity based on persuasion skill
        var prosperityGain = 1 + Math.floor(agent.skills.persuasion / 3);
        if (town.prosperity !== undefined) town.prosperity = Math.min(100, (town.prosperity || 0) + prosperityGain);
        // Boost player reputation in this town's kingdom
        var repGain = Math.floor(agent.skills.persuasion / 2);
        if (town.kingdomId && player.reputation) {
            player.reputation[town.kingdomId] = Math.min(100, (player.reputation[town.kingdomId] || 50) + repGain);
        }
        // Earn some gold from brokered connections
        var goldEarned = 5 + agent.skills.persuasion * 3 + (rng ? rng.randInt(0, 15) : 8);
        player.gold += goldEarned;
        agent.earnings += goldEarned;
        agent.reports.push({ day: day, msg: '🤝 Establishing contacts in ' + town.name + '. Prosperity +' + prosperityGain + ', rep +' + repGain + ', earned ' + goldEarned + 'g in referral fees.' });
    }

    function _agentGuardProperties(agent, day, rng) {
        _sync();
        // Passive: reduces sabotage risk. Just report presence.
        var town = Engine.findTown(agent.townId);
        if (!town) return;
        var playerBuildings = town.buildings.filter(function(b) { return b.ownerId === 'player'; });
        if (playerBuildings.length === 0) return;
        // Chance to catch saboteurs
        var catchChance = 0.05 + agent.skills.combat * 0.02;
        if (rng ? rng.chance(catchChance) : Math.random() < catchChance) {
            agent.reports.push({ day: day, msg: '🛡️ ' + agent.name + ' caught and repelled a saboteur targeting your ' + town.name + ' properties!' });
        }
    }

    // ── INTEL TASK EXECUTION ──
    function _executeIntelAction(agent, day, rng) {
        _sync();
        var task = agent.task;
        switch (task.type) {
            case 'spy_on_target':
                _agentSpyOnTarget(agent, day, rng);
                break;
            case 'counter_intel':
                _agentCounterIntel(agent, day, rng);
                break;
        }
    }

    function _agentSpyOnTarget(agent, day, rng) {
        _sync();
        var target = Engine.findPerson(agent.task.targetId);
        if (!target) return;

        var info = [];
        // Gold/finances
        if (target.gold !== undefined) info.push('💰 Treasury: ~' + (Math.round((target.gold || 0) / 50) * 50) + 'g');
        // Buildings
        var towns = Engine.getTowns ? Engine.getTowns() : [];
        var bldCount = 0;
        for (var ti = 0; ti < towns.length; ti++) {
            var tb = towns[ti].buildings || [];
            for (var bi = 0; bi < tb.length; bi++) {
                if (tb[bi].ownerId === target.id) bldCount++;
            }
        }
        info.push('🏛️ Buildings owned: ' + bldCount);
        // Caravans
        var caravans = target.emCaravans || target.caravans || [];
        var activeC = caravans.filter(function(c) { return c.active; }).length;
        info.push('🐴 Active caravans: ' + activeC);
        // Relationships
        if (target._playerRelationship !== undefined) info.push('❤️ Attitude toward you: ' + Math.floor(target._playerRelationship));
        // Strategy
        if (target.emStrategy) info.push('📋 Business strategy: ' + target.emStrategy);
        // Location
        info.push('📍 Currently in: ' + ((Engine.findTown(target.townId) || {}).name || 'unknown'));

        agent.reports.push({ day: day, msg: '🕵️ Intel on ' + (target.firstName || '') + ' ' + (target.lastName || '') + ':\n  ' + info.join('\n  ') });
    }

    function _agentCounterIntel(agent, day, rng) {
        _sync();
        // Passive protection + occasional detection
        var detectChance = 0.03 + agent.skills.stealth * 0.015;
        if (rng ? rng.chance(detectChance) : Math.random() < detectChance) {
            agent.reports.push({ day: day, msg: '🛡️ Counter-intelligence detected suspicious activity near your operations!' });
        }
    }

    // ── DIPLOMATIC TASK EXECUTION ──
    function _executeDiplomaticAction(agent, day, rng) {
        _sync();
        var task = agent.task;
        var def = AGENT_TASK_DEFS[task.type];
        var target = Engine.findPerson(task.targetId);
        if (!target || !target.alive) {
            agent.reports.push({ day: day, msg: '❌ Target noble no longer available. Task cancelled.' });
            agent.task = null;
            agent.status = 'idle';
            return;
        }

        // Detection chance reduced by persuasion skill (diplomatic tasks use persuasion primarily)
        var skillKey = def.skillKey || 'persuasion';
        var detection = def.baseDetection * (1 - agent.skills[skillKey] * 0.06);
        detection = Math.max(0.03, Math.min(0.90, detection));

        // Foreign kingdom detection increase
        var agentTown = Engine.findTown(agent.townId);
        var agentKingdomId = agentTown ? agentTown.kingdomId : '';
        var isOwnKingdom = agentKingdomId === player.citizenshipKingdomId;
        var isForeignKingdom = agentKingdomId && !isOwnKingdom;
        if (isForeignKingdom) detection += 0.15;

        var caught = rng ? rng.chance(detection) : Math.random() < detection;

        if (caught) {
            agent.catchCount++;
            agent.reports.push({ day: day, msg: '🚨 ' + agent.name + ' was CAUGHT during ' + def.label + '!' });

            // Use same caught penalty logic as hostile (own/foreign/at-war tiers)
            var isForeignAtWar = false;
            if (isForeignKingdom) {
                // v9p33river287: wars live in world.activeWars (object map),
                // not world.wars (which never existed). Each war uses
                // kingdomA/kingdomB, not attackerId/defenderId.
                var _agActiveWars = Engine.getActiveWars ? Engine.getActiveWars() : {};
                for (var _agWid in _agActiveWars) {
                    var war = _agActiveWars[_agWid];
                    if (!war) continue;
                    if ((war.kingdomA === player.citizenshipKingdomId && war.kingdomB === agentKingdomId) ||
                        (war.kingdomB === player.citizenshipKingdomId && war.kingdomA === agentKingdomId)) {
                        isForeignAtWar = true;
                        break;
                    }
                }
            }

            if (isOwnKingdom) {
                player.nobleNotoriety = Math.min(100, (player.nobleNotoriety || 0) + 20);
                agent.status = 'caught';
                agent._cooldownUntil = day + 10;
                agent.task = null;
            } else if (isForeignAtWar) {
                player.nobleNotoriety = Math.min(100, (player.nobleNotoriety || 0) + 25);
                var agentExecuted = rng ? rng.chance(0.30) : Math.random() < 0.30;
                if (agentExecuted) {
                    agent.reports.push({ day: day, msg: '☠️ ' + agent.name + ' was executed as a spy!' });
                    Engine.logEvent('☠️ Agent ' + agent.name + ' was executed in a hostile kingdom!', null, 'my_actions');
                    agent.status = 'dead';
                    agent.task = null;
                    agent._dead = true;
                    if (player.agents) {
                        for (var _ari = player.agents.length - 1; _ari >= 0; _ari--) {
                            if (player.agents[_ari].id === agent.id) {
                                player.agents.splice(_ari, 1);
                                break;
                            }
                        }
                    }
                } else {
                    agent.status = 'jailed';
                    agent._jailUntil = day + 10;
                    agent.task = null;
                }
            } else if (isForeignKingdom) {
                player.nobleNotoriety = Math.min(100, (player.nobleNotoriety || 0) + 12);
                agent.status = 'jailed';
                agent._jailUntil = day + 5;
                agent.task = null;
            } else {
                player.nobleNotoriety = Math.min(100, (player.nobleNotoriety || 0) + 15);
                agent.status = 'caught';
                agent._cooldownUntil = day + 7;
                agent.task = null;
            }

            if (player.reputation && agentKingdomId) {
                player.reputation[agentKingdomId] = Math.max(0, (player.reputation[agentKingdomId] || 50) - 2);
            }
            Engine.logEvent(player.fullName + '\'s agent ' + agent.name + ' was caught during diplomatic intrigue.', null, 'my_actions');
            return;
        }

        // Success — execute specific diplomatic action
        var targetTown = Engine.findTown(target.townId || agent.townId);
        // v9p33river302: same allowedActions-was-ignored fix as hostile —
        // pick randomly from checked diplomatic actions each tick.
        var _diploChoice = task.type;
        if (task.allowedActions && typeof task.allowedActions === 'object') {
            var _diploKeys = [];
            for (var _dak in task.allowedActions) {
                if (task.allowedActions[_dak]) _diploKeys.push(_dak);
            }
            if (_diploKeys.length > 0) {
                _diploChoice = rng ? _diploKeys[rng.randInt(0, _diploKeys.length - 1)] : _diploKeys[Math.floor(Math.random() * _diploKeys.length)];
            }
        }
        switch (_diploChoice) {
            case 'build_noble_relationship':
                _agentBuildRelationship(agent, target, targetTown, day, rng);
                break;
            case 'diplomatic_courier':
                _agentDiplomaticCourier(agent, target, targetTown, day, rng);
                break;
            case 'noble_intrigue_turn':
                _agentIntrigueTurnNoble(agent, target, targetTown, day, rng);
                break;
            case 'noble_intrigue_discredit':
                _agentIntrigueDiscredit(agent, target, targetTown, day, rng);
                break;
            case 'noble_intrigue_expose':
                _agentIntrigueExpose(agent, target, targetTown, day, rng);
                break;
        }
    }

    function _agentBuildRelationship(agent, target, town, day, rng) {
        _sync();
        // Improve player's relationship with this noble
        var relGain = 3 + Math.floor(agent.skills.persuasion / 2);
        if (Player.modifyRelationship) Player.modifyRelationship(target.id, relGain);
        agent.reports.push({ day: day, msg: '🤝 ' + agent.name + ' strengthened your relationship with ' + target.firstName + ' (+' + relGain + ' rel).' });
        // Notify story mode
        if (typeof StoryMode !== 'undefined' && StoryMode.onPlayerAction) {
            StoryMode.onPlayerAction('agent_diplomatic', { action: 'build_relationship', targetId: target.id, targetKingdomId: town ? town.kingdomId : '' });
        }
    }

    function _agentDiplomaticCourier(agent, target, town, day, rng) {
        _sync();
        // Improve reputation in target's kingdom
        var repGain = 2 + Math.floor(agent.skills.persuasion / 3);
        if (town && town.kingdomId && player.reputation) {
            player.reputation[town.kingdomId] = Math.min(100, (player.reputation[town.kingdomId] || 50) + repGain);
        }
        var relGain = 1 + Math.floor(agent.skills.persuasion / 4);
        if (Player.modifyRelationship) Player.modifyRelationship(target.id, relGain);
        agent.reports.push({ day: day, msg: '📜 ' + agent.name + ' delivered diplomatic messages to ' + target.firstName + '. Rep +' + repGain + ', rel +' + relGain + '.' });
        if (typeof StoryMode !== 'undefined' && StoryMode.onPlayerAction) {
            StoryMode.onPlayerAction('agent_diplomatic', { action: 'diplomatic_courier', targetId: target.id, targetKingdomId: town ? town.kingdomId : '' });
        }
    }

    function _agentIntrigueTurnNoble(agent, target, town, day, rng) {
        _sync();
        // Reduce noble's loyalty to their king
        var loyaltyDrop = rng ? rng.randInt(5, 15) : 10;
        target.kingLoyalty = Math.max(0, (target.kingLoyalty || 50) - loyaltyDrop);
        if (!target._nobleRelationships) target._nobleRelationships = {};
        // Find the king of this noble's kingdom
        var kingdom = town ? (Engine.findKingdom ? Engine.findKingdom(town.kingdomId) : null) : null;
        if (kingdom && kingdom.king) {
            target._nobleRelationships[kingdom.king] = Math.max(-100, (target._nobleRelationships[kingdom.king] || 0) - loyaltyDrop);
        }
        agent.reports.push({ day: day, msg: '🏴 ' + agent.name + ' undermined ' + target.firstName + '\'s loyalty to the king (-' + loyaltyDrop + ' loyalty).' });
        // Notify story mode
        if (typeof StoryMode !== 'undefined' && StoryMode.onPlayerAction) {
            StoryMode.onPlayerAction('noble_intrigue', { loyaltyReduced: loyaltyDrop, targetKingdomId: town ? town.kingdomId : '', nobleId: target.id });
        }
    }

    function _agentIntrigueDiscredit(agent, target, town, day, rng) {
        _sync();
        // Reduce noble's perceived loyalty
        var percDrop = rng ? rng.randInt(4, 12) : 8;
        target.perceivedKingLoyalty = Math.max(0, (target.perceivedKingLoyalty !== undefined ? target.perceivedKingLoyalty : (target.kingLoyalty || 50)) - percDrop);
        // Also damage reputation
        var repDrop = rng ? rng.randInt(5, 12) : 8;
        if (target.reputation === undefined) target.reputation = {};
        var kId = town ? town.kingdomId : '';
        if (kId) target.reputation[kId] = Math.max(0, (target.reputation[kId] || 50) - repDrop);
        agent.reports.push({ day: day, msg: '📜 ' + agent.name + ' discredited ' + target.firstName + '. Perceived loyalty -' + percDrop + ', reputation -' + repDrop + '.' });
        if (typeof StoryMode !== 'undefined' && StoryMode.onPlayerAction) {
            StoryMode.onPlayerAction('noble_intrigue', { perceivedLoyaltyReduced: percDrop, relationshipDamage: repDrop, targetKingdomId: kId, nobleId: target.id });
        }
    }

    function _agentIntrigueExpose(agent, target, town, day, rng) {
        _sync();
        // Expose secrets — damage relationships between nobles
        var kingdom = town ? (Engine.findKingdom ? Engine.findKingdom(town.kingdomId) : null) : null;
        var kId = town ? town.kingdomId : '';
        if (kingdom) {
            var allNobles = [];
            var people = Engine.getPeople ? Engine.getPeople() : [];
            for (var ni = 0; ni < people.length; ni++) {
                if (people[ni].alive && people[ni].occupation === 'noble' && people[ni].socialRank && people[ni].socialRank[kId]) {
                    allNobles.push(people[ni]);
                }
            }
            for (var ai = 0; ai < allNobles.length; ai++) {
                if (allNobles[ai].id === target.id) continue;
                if (!allNobles[ai]._nobleRelationships) allNobles[ai]._nobleRelationships = {};
                var drop = rng ? rng.randInt(5, 15) : 10;
                allNobles[ai]._nobleRelationships[target.id] = Math.max(-100, (allNobles[ai]._nobleRelationships[target.id] || 0) - drop);
            }
        }
        var percDrop = rng ? rng.randInt(6, 16) : 10;
        target.perceivedKingLoyalty = Math.max(0, (target.perceivedKingLoyalty !== undefined ? target.perceivedKingLoyalty : (target.kingLoyalty || 50)) - percDrop);
        agent.reports.push({ day: day, msg: '💥 ' + agent.name + ' exposed ' + target.firstName + '\'s secrets! Relationships and perceived loyalty damaged.' });
        if (typeof StoryMode !== 'undefined' && StoryMode.onPlayerAction) {
            StoryMode.onPlayerAction('noble_intrigue', { perceivedLoyaltyReduced: percDrop, relationshipDamage: 15, targetKingdomId: kId, nobleId: target.id });
        }
    }

    // ── Finish finite tasks ──
    function _completeAgentTask(agent, day, rng) {
        _sync();
        var task = agent.task;
        var def = AGENT_TASK_DEFS[task.type];
        agent.reports.push({ day: day, msg: '✅ ' + agent.name + ' completed ' + (def ? def.label : task.type) + ' task.' });
        agent.task = null;
        agent.status = 'idle';
    }

    // Get agent data for UI
    function getAgentData() {
        _sync();
        return {
            agents: player.agents || [],
            maxAgents: getMaxAgents(),
            taskDefs: AGENT_TASK_DEFS,
            hireCost: getAgentDailyCost(player.townId) * 10
        };
    }

    // -- Exports --
    Player.hireAgent = hireAgent;
    Player.fireAgent = fireAgent;
    Player.findAgent = findAgent;
    Player.assignAgentTask = assignAgentTask;
    Player.cancelAgentTask = cancelAgentTask;
    Player.recallAgent = recallAgent;
    Player.getAgentData = getAgentData;
    Player.getMaxAgents = getMaxAgents;
    Player.tickAgents = tickAgents;

})(window.Player);