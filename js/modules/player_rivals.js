// ──────────────────────────────────────────────────────────
// player_rivals.js — Rival / Enemy hostile-action system
// v9p33river364
//
// NPCs with relationship <= -20 are rivals; <= -40 are enemies.
// Rivals/enemies have a daily chance of performing hostile actions
// against the player or the player's businesses.
//
// Same-location: 2% daily chance of hostile action (rival)
// Remote (buildings/caravans): 0.1% daily chance
// Enemies: same as rivals but also poison/assassination at same location
//
// 7-day global cooldown between any rival hostile actions.
//
// Exports:
//   Player.tickRivalActions()     — called from engine daily tick
//   Player._rivalLastActionDay    — day of last rival hostile action
// ──────────────────────────────────────────────────────────
(function(Player) {
    'use strict';
    if (!Player) return;

    var player;
    function _ensureState() { player = Player.state; }

    // Lazy accessor — Engine, UI, CONFIG may not be ready at module-load time
    function _eng()  { return typeof Engine !== 'undefined' ? Engine : null; }
    function _ui()   { return typeof UI !== 'undefined' ? UI : null; }
    function _cfg()  { return typeof CONFIG !== 'undefined' ? CONFIG : null; }
    function _day()  { try { return _eng().getDay(); } catch(e) { return 0; } }
    function _rng()  { try { return _eng().getRng(); } catch(e) { return null; } }
    function _findPerson(id) { try { return _eng().findPerson(id); } catch(e) { return null; } }
    function _findTown(id)   { try { return _eng().findTown(id); } catch(e) { return null; } }
    function _toast(msg, type) { try { _ui().toast(msg, type || 'warning'); } catch(e) {} }

    // ── Hostile action definitions ──
    var RIVAL_ACTIONS = [
        { id: 'false_accusation', label: 'false accusation', minRel: -20,
          desc: function(npc) { return (npc.firstName || 'A rival') + ' spread false accusations against you, damaging your reputation.'; },
          effect: function(npc) {
              // -5 reputation in the kingdom
              var kId = _npcKingdomId(npc);
              if (kId) {
                  try { Player.modifyRelationship(npc.id, -3); } catch(e) {}
                  // Lower relationship with other nobles in that kingdom
                  _spreadReputationDamage(kId, npc, 3, 5);
              }
          }
        },
        { id: 'business_sabotage', label: 'business sabotage', minRel: -20,
          desc: function(npc) { return (npc.firstName || 'A rival') + ' sabotaged one of your businesses! Production halted for several days.'; },
          effect: function(npc) {
              var blds = player.buildings || [];
              var targets = [];
              for (var i = 0; i < blds.length; i++) {
                  if (blds[i] && blds[i].townId === npc.townId) targets.push(blds[i]);
              }
              if (targets.length === 0) return false;
              var rng = _rng(); if (!rng) return false;
              var bld = targets[rng.randInt(0, targets.length - 1)];
              // Damage building condition (string progression: new → used → breaking → destroyed)
              var condOrder = ['destroyed', 'breaking', 'used', 'new'];
              var curIdx = condOrder.indexOf(bld.condition || 'new');
              if (curIdx < 0) curIdx = 3; // default to 'new'
              if (curIdx > 0) {
                  bld.condition = condOrder[curIdx - 1];
                  if (bld.condition === 'destroyed') bld.active = false;
              }
              return true;
          }
        },
        { id: 'theft', label: 'theft', minRel: -20,
          desc: function(npc) { return (npc.firstName || 'A rival') + ' arranged to steal gold from you!'; },
          effect: function(npc) {
              var rng = _rng(); if (!rng) return false;
              var amount = rng.randInt(50, 200);
              if ((player.gold || 0) < 10) return false;
              amount = Math.min(amount, Math.floor(player.gold * 0.1));
              player.gold = Math.max(0, player.gold - amount);
              _toast('Lost ' + amount + 'g to theft by ' + (npc.firstName || 'a rival') + '!', 'danger');
              return true;
          }
        },
        { id: 'poison_attempt', label: 'poison attempt', minRel: -40, enemyOnly: true,
          desc: function(npc) { return (npc.firstName || 'An enemy') + ' attempted to poison you!'; },
          effect: function(npc) {
              var rng = _rng(); if (!rng) return false;
              // 40% chance poison succeeds
              if (rng.chance(0.4)) {
                  try {
                      if (Player.inflictSpecificIllness) {
                          Player.inflictSpecificIllness('food_poisoning', 'poisoned by ' + (npc.firstName || 'an enemy'));
                      }
                  } catch(e) {}
                  _toast('You were poisoned by ' + (npc.firstName || 'an enemy') + '!', 'danger');
                  return true;
              } else {
                  _toast('Someone tried to poison your food, but you noticed in time!', 'warning');
                  return true;
              }
          }
        },
        { id: 'assassination_attempt', label: 'assassination attempt', minRel: -40, enemyOnly: true, rare: true,
          desc: function(npc) { return (npc.firstName || 'An enemy') + ' sent an assassin after you!'; },
          effect: function(npc) {
              var rng = _rng(); if (!rng) return false;
              // 15% chance of success (serious injury)
              if (rng.chance(0.15)) {
                  player.health = Math.max(5, (player.health || 100) - rng.randInt(30, 60));
                  _toast('An assassin sent by ' + (npc.firstName || 'an enemy') + ' wounded you!', 'danger');
              } else {
                  _toast('An assassination attempt by ' + (npc.firstName || 'an enemy') + ' failed!', 'warning');
                  // Assassin may be caught — NPC gets criminal record
                  if (rng.chance(0.3)) {
                      if (!npc.criminalRecord) npc.criminalRecord = [];
                      npc.criminalRecord.push({ type: 'attempted_murder', day: _day(), target: 'player' });
                      _toast((npc.firstName || 'The assassin') + ' was caught and faces justice.', 'info');
                  }
              }
              return true;
          }
        }
    ];

    // Remote actions (against player buildings/caravans when NPC is not in same location)
    var REMOTE_RIVAL_ACTIONS = [
        { id: 'remote_sabotage', label: 'remote sabotage', minRel: -20,
          desc: function(npc, bld) { return (npc.firstName || 'A rival') + ' damaged your ' + (bld.type || 'building') + ' in ' + (bld.townName || 'a town') + '!'; },
          effect: function(npc, bld) {
              var condOrder = ['destroyed', 'breaking', 'used', 'new'];
              var curIdx = condOrder.indexOf(bld.condition || 'new');
              if (curIdx < 0) curIdx = 3;
              if (curIdx > 0) {
                  bld.condition = condOrder[curIdx - 1];
                  if (bld.condition === 'destroyed') bld.active = false;
              }
              return true;
          }
        },
        { id: 'remote_theft', label: 'remote theft', minRel: -20,
          desc: function(npc, bld) { return (npc.firstName || 'A rival') + ' stole goods from your ' + (bld.type || 'building') + '!'; },
          effect: function(npc, bld) {
              if (bld.inventory) {
                  for (var resId in bld.inventory) {
                      if (bld.inventory[resId] > 0) {
                          var stolen = Math.min(bld.inventory[resId], Math.floor(bld.inventory[resId] * 0.1) + 1);
                          bld.inventory[resId] -= stolen;
                          return true;
                      }
                  }
              }
              return false;
          }
        }
    ];

    function _npcKingdomId(npc) {
        if (!npc) return null;
        if (npc.kingdomId) return npc.kingdomId;
        if (npc.townId) {
            var t = _findTown(npc.townId);
            if (t) return t.kingdomId;
        }
        return null;
    }

    function _spreadReputationDamage(kId, instigator, count, amount) {
        // Lower player's relationship with a few random nobles in the kingdom
        try {
            var eng = _eng(); if (!eng || !eng.getKingdoms) return;
            var kingdoms = eng.getKingdoms();
            var k = null;
            for (var ki = 0; ki < kingdoms.length; ki++) {
                if (kingdoms[ki].id === kId) { k = kingdoms[ki]; break; }
            }
            if (!k || !k.territories) return;
            var nobles = [];
            for (var ti = 0; ti < k.territories.length; ti++) {
                var town = _findTown(k.territories[ti]);
                if (!town || !town.people) continue;
                for (var pi = 0; pi < town.people.length; pi++) {
                    var p = town.people[pi];
                    if (p && p.id !== instigator.id && (p.occupation === 'noble' || p.isEliteMerchant)) {
                        nobles.push(p);
                    }
                }
            }
            var rng = _rng(); if (!rng || nobles.length === 0) return;
            var affected = Math.min(count, nobles.length);
            for (var ai = 0; ai < affected; ai++) {
                var idx = rng.randInt(0, nobles.length - 1);
                try { Player.modifyRelationship(nobles[idx].id, -amount); } catch(e) {}
                nobles.splice(idx, 1);
                if (nobles.length === 0) break;
            }
        } catch(e) {}
    }

    // ── Main daily tick ──
    Player.tickRivalActions = function() {
        _ensureState();
        if (!player) return;
        var day = _day(); if (!day) return;
        var rng = _rng(); if (!rng) return;

        // Global 7-day cooldown
        if (player._rivalLastActionDay && (day - player._rivalLastActionDay) < 7) return;

        var rels = player.relationships || {};
        var rivals = [];
        for (var pid in rels) {
            var r = rels[pid];
            if (r && r.level <= -20) {
                var npc = _findPerson(pid);
                if (npc && npc.alive !== false) {
                    rivals.push({ id: pid, npc: npc, level: r.level, isEnemy: r.level <= -40 });
                }
            }
        }
        if (rivals.length === 0) return;

        var playerTownId = player.townId;
        var actionTaken = false;

        for (var ri = 0; ri < rivals.length && !actionTaken; ri++) {
            var rival = rivals[ri];
            var sameLocation = rival.npc.townId === playerTownId;

            if (sameLocation) {
                // 2% daily chance
                if (!rng.chance(0.02)) continue;

                // Pick a valid action
                var validActions = [];
                for (var ai = 0; ai < RIVAL_ACTIONS.length; ai++) {
                    var act = RIVAL_ACTIONS[ai];
                    if (rival.level > act.minRel) continue;
                    if (act.enemyOnly && !rival.isEnemy) continue;
                    if (act.rare && !rng.chance(0.1)) continue;
                    validActions.push(act);
                }
                if (validActions.length === 0) continue;

                var chosen = validActions[rng.randInt(0, validActions.length - 1)];
                var result = chosen.effect(rival.npc);
                if (result !== false) {
                    var desc = chosen.desc(rival.npc);
                    _toast(desc, 'danger');
                    try {
                        if (_eng().logEvent) _eng().logEvent(desc, null, 'world_events');
                    } catch(e) {}
                    player._rivalLastActionDay = day;
                    actionTaken = true;
                }
            } else {
                // Remote: 0.1% daily chance of doing something to player buildings/caravans
                if (!rng.chance(0.001)) continue;

                // Find player buildings in the NPC's town
                var blds = player.buildings || [];
                var remoteBlds = [];
                for (var bi = 0; bi < blds.length; bi++) {
                    if (blds[bi] && blds[bi].townId === rival.npc.townId) {
                        remoteBlds.push(blds[bi]);
                    }
                }
                if (remoteBlds.length === 0) continue;

                var target = remoteBlds[rng.randInt(0, remoteBlds.length - 1)];
                var remoteActs = [];
                for (var rai = 0; rai < REMOTE_RIVAL_ACTIONS.length; rai++) {
                    if (rival.level <= REMOTE_RIVAL_ACTIONS[rai].minRel) {
                        remoteActs.push(REMOTE_RIVAL_ACTIONS[rai]);
                    }
                }
                if (remoteActs.length === 0) continue;

                var remoteChosen = remoteActs[rng.randInt(0, remoteActs.length - 1)];
                var townName = '';
                try { var tt = _findTown(rival.npc.townId); townName = tt ? tt.name : ''; } catch(e) {}
                target.townName = target.townName || townName;
                var remoteResult = remoteChosen.effect(rival.npc, target);
                if (remoteResult !== false) {
                    var remoteDesc = remoteChosen.desc(rival.npc, target);
                    _toast(remoteDesc, 'danger');
                    try {
                        if (_eng().logEvent) _eng().logEvent(remoteDesc, null, 'world_events');
                    } catch(e) {}
                    player._rivalLastActionDay = day;
                    actionTaken = true;
                }
            }
        }
    };

})(typeof Player !== 'undefined' ? Player : null);
