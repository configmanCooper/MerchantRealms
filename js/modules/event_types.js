// ── Event Type Registry ──
// Centralized definitions for all game event types.
// New events should be defined here first, then emitted via EventTypes.emit().
// Existing events are being migrated in batches.
(function() {
    'use strict';

    // ── Category resolver: my_kingdom vs foreign_kingdoms ──
    function resolveKingdomCategory(kingdomId) {
        try {
            if (typeof Player !== 'undefined' && kingdomId) {
                var cit = Player.citizenshipKingdomId || (Player.state && Player.state.citizenshipKingdomId);
                if (cit === kingdomId) return 'my_kingdom';
                var tid = Player.townId || (Player.state && Player.state.townId);
                if (tid) {
                    var t = Engine.findTown(tid);
                    if (t && t.kingdomId === kingdomId) return 'my_kingdom';
                }
            }
        } catch (e) {}
        return 'foreign_kingdoms';
    }

    function resolveEitherKingdomCategory(kingdomAId, kingdomBId) {
        return resolveKingdomCategory(kingdomAId) === 'my_kingdom' || resolveKingdomCategory(kingdomBId) === 'my_kingdom'
            ? 'my_kingdom' : 'foreign_kingdoms';
    }

    // ── Simple template renderer ──
    function renderTemplate(template, params) {
        return template.replace(/\{(\w+)\}/g, function(_, key) {
            return params[key] !== undefined ? params[key] : '{' + key + '}';
        });
    }

    // ══════════════════════════════════════════
    //  EVENT REGISTRY
    // ══════════════════════════════════════════

    var TYPES = {};

    // Helper to register a batch of event definitions
    function registerBatch(defs) {
        for (var id in defs) {
            if (defs.hasOwnProperty(id)) {
                defs[id].id = id;
                TYPES[id] = defs[id];
            }
        }
    }

    // ──────────────────────────────────────────
    //  HIDDEN EVENTS (background simulation noise)
    // ──────────────────────────────────────────

    registerBatch({
        NPC_MARRIAGE: {
            category: 'npc_activity',
            subcategory: 'relationships',
            hidden: true,
            render: function(p) {
                return p.firstName + ' ' + (p.lastName || '') + ' married ' + p.spouseFirstName + ' in ' + (p.townName || 'town') + '.';
            }
        },
        NPC_MIGRATION: {
            category: 'npc_activity',
            subcategory: 'migration',
            hidden: true,
            render: function(p) {
                return p.firstName + ' ' + p.lastName + ' has migrated from ' + p.fromTown + ' to ' + p.toTown + '.';
            }
        },
        RECRUITMENT_EXPIRED: {
            category: resolveKingdomCategory,
            subcategory: 'military_admin',
            hidden: true,
            render: function(p) {
                return '📜 Recruitment posting expired (' + p.filled + '/' + p.total + ' filled). ' + p.refund + 'g refunded.';
            }
        },
        RECRUITMENT_PROGRESS: {
            category: resolveKingdomCategory,
            subcategory: 'military_admin',
            hidden: true,
            render: function(p) {
                return '🎖️ ' + (p.isConscription ? 'Conscription' : 'Recruitment') + ': ' + p.filled + '/' + p.total + ' (' + p.pct + '% filled)';
            }
        },
        EMPLOYEE_POSTING_EXPIRED: {
            category: resolveKingdomCategory,
            subcategory: 'king_court',
            hidden: true,
            render: function(p) {
                return '📋 Employee posting expired (' + p.filled + '/' + p.total + ' ' + p.type + 's filled). ' + p.refund + 'g refunded.';
            }
        },
        EMPLOYEE_HIRING_PROGRESS: {
            category: resolveKingdomCategory,
            subcategory: 'king_court',
            hidden: true,
            render: function(p) {
                return '👤 ' + p.label + ' hiring: ' + p.filled + '/' + p.total + ' filled';
            }
        },
        PROCUREMENT_FULFILLED: {
            category: resolveKingdomCategory,
            subcategory: 'economy',
            hidden: true,
            render: function(p) {
                return '✅ Procurement order fulfilled: ' + p.goodId + ' (' + p.totalFilled + ' total)';
            }
        },
        KINGDOM_EMPLOYEE_QUIT: {
            category: resolveKingdomCategory,
            subcategory: 'king_court',
            hidden: true,
            render: function(p) {
                return '💸 Kingdom employee quit (unpaid): ' + (p.name || 'unknown');
            }
        },
        SOLDIER_TRANSFER_ARRIVED: {
            category: resolveKingdomCategory,
            subcategory: 'military_admin',
            hidden: true,
            render: function(p) {
                return '🏰 ' + p.count + ' soldiers arrived at ' + p.townName + '.';
            }
        },
        SOLDIER_TRANSFER_DISPERSED: {
            category: resolveKingdomCategory,
            subcategory: 'military_admin',
            hidden: true,
            render: function(p) {
                return '⚠️ ' + p.count + ' soldiers arrived at a town no longer controlled. They dispersed.';
            }
        },
        KINGDOM_STOCKPILE: {
            category: resolveKingdomCategory,
            subcategory: 'economy',
            hidden: true,
            render: function(p) {
                return '📦 ' + p.kingdomName + ' stockpiles ' + p.qty + ' ' + p.good + ' from ' + p.townName + ' at low prices.';
            }
        },
        IMMIGRATION_BONUS_MIGRATION: {
            category: resolveKingdomCategory,
            subcategory: 'migration',
            hidden: true,
            render: function(p) {
                return '🚶 ' + p.firstName + ' ' + p.lastName + ' migrates to ' + p.townName + ' in ' + p.kingdomName + ', drawn by the ' + p.bonus + 'g immigration bonus.';
            }
        },
        PROPERTY_TAX_COLLECTED: {
            category: resolveKingdomCategory,
            subcategory: 'taxes',
            hidden: true,
            render: function(p) {
                return '📜 ' + p.kingdomName + ' collects ' + p.amount + 'g in property taxes.';
            }
        },
        INCOME_TAX_COLLECTED: {
            category: resolveKingdomCategory,
            subcategory: 'taxes',
            hidden: true,
            render: function(p) {
                return '📜 ' + p.kingdomName + ' collects ' + p.amount + 'g in seasonal income taxes.';
            }
        },
        SURPLUS_MILITARY_SALE: {
            category: resolveKingdomCategory,
            subcategory: 'economy',
            hidden: true,
            render: function(p) {
                return '🏰 ' + p.kingdomName + ' sells ' + p.items + ' surplus military items for ' + p.gold + 'g.';
            }
        },
        GUARD_SPENDING_CUT: {
            category: resolveKingdomCategory,
            subcategory: 'economy',
            hidden: true,
            template: '🏰 {kingdomName} reduces guard spending.'
        },
        SURPLUS_EQUIPMENT_SALE: {
            category: resolveKingdomCategory,
            subcategory: 'economy',
            hidden: true,
            render: function(p) {
                return '🏰 ' + p.kingdomName + ' sells surplus military equipment (' + p.items + ' items) to raise funds.';
            }
        },
        OUTPOST_THEFT_NPC: {
            category: 'military',
            subcategory: 'crime',
            hidden: true,
            render: function(p) {
                return '🦹 Thieves raided outpost "' + p.outpostName + '" and stole ' + p.stolenItems + ' (worth ~' + p.value + 'g)!';
            }
        },
        OUTPOST_THEFT_PLAYER: {
            category: 'my_business',
            subcategory: 'crime',
            hidden: false,
            render: function(p) {
                return '🦹 Thieves raided outpost "' + p.outpostName + '" and stole ' + p.stolenItems + ' (worth ~' + p.value + 'g)!';
            }
        }
    });

    // ──────────────────────────────────────────
    //  PLAYER ACTIONS — Court & Politics
    // ──────────────────────────────────────────

    registerBatch({
        COURT_SPEECH: {
            category: 'my_actions',
            subcategory: 'court',
            hidden: false,
            template: '🎙️ You spoke before the court and addressed the king directly.'
        },
        COURT_OBSERVE: {
            category: 'my_actions',
            subcategory: 'court',
            hidden: false,
            render: function(p) {
                return '👁️ You carefully observed ' + p.npcName + ' during court proceedings.';
            }
        },
        COURT_NETWORK: {
            category: 'my_actions',
            subcategory: 'court',
            hidden: false,
            render: function(p) {
                return '🤝 You made connections with ' + p.npcName + ' at court.';
            }
        },
        COURT_PETITION_DENIED: {
            category: 'my_actions',
            subcategory: 'court',
            hidden: false,
            render: function(p) {
                return '📜 Court petition for ' + p.petitionType + ' — DENIED (' + p.pct + '%)';
            }
        },
        COMMISSION_FULFILLED: {
            category: 'my_actions',
            subcategory: 'commissions',
            hidden: false,
            render: function(p) {
                return '✅ Commission fulfilled for ' + p.goodName + '! Reward: ' + p.gold + 'g + ' + p.rep + ' reputation!';
            }
        },
        COMMISSION_IGNORED: {
            category: 'my_actions',
            subcategory: 'commissions',
            hidden: false,
            template: "⏳ You ignored the king's commission. The king is displeased. (-3 reputation)"
        },
        COMMISSION_FAILED_LORD: {
            category: 'my_actions',
            subcategory: 'commissions',
            hidden: false,
            template: "❌ You failed to fulfill the king's commission on time! As a Lord, this means immediate demotion!"
        },
        COMMISSION_EXPIRED: {
            category: 'my_actions',
            subcategory: 'commissions',
            hidden: false,
            render: function(p) {
                return "❌ The king's commission has expired unfulfilled. (-" + p.repLoss + ' reputation)';
            }
        },
        PROPOSAL_ACCEPTED: {
            category: 'my_actions',
            subcategory: 'politics',
            hidden: false,
            render: function(p) {
                return '📜 The King of ' + p.kingdomName + ' accepts your proposal: ' + p.law + '!';
            }
        },
        PROPOSAL_REJECTED: {
            category: 'my_actions',
            subcategory: 'politics',
            hidden: false,
            render: function(p) {
                return '📜 The King of ' + p.kingdomName + ' rejects your proposal for ' + p.law + '.';
            }
        },
        COUNSEL_AGREED: {
            category: 'my_actions',
            subcategory: 'court',
            hidden: false,
            render: function(p) {
                return "✅ You agreed with the king's decision: " + p.description;
            }
        },
        COUNSEL_HEEDED: {
            category: 'my_actions',
            subcategory: 'court',
            hidden: false,
            render: function(p) {
                return '🛡️ ' + p.actor + ' heeded your counsel and reconsidered: ' + p.description;
            }
        },
        COUNSEL_OVERRULED: {
            category: 'my_actions',
            subcategory: 'court',
            hidden: false,
            render: function(p) {
                return '❌ ' + p.actor + ' considered your objection but proceeded: ' + p.description;
            }
        },
        JOINED_CONSPIRACY: {
            category: 'my_actions',
            subcategory: 'intrigue',
            hidden: false,
            render: function(p) {
                return '🤫 You have secretly joined the ' + p.leaderName + ' conspiracy in ' + p.kingdomName + '.';
            }
        },
        FORMED_CONSPIRACY: {
            category: 'my_actions',
            subcategory: 'intrigue',
            hidden: false,
            render: function(p) {
                return '🤫 You have formed a secret ' + p.type + ' conspiracy with ' + p.partnerName + ' in ' + p.kingdomName + '.';
            }
        },
        FUNDED_DISSIDENTS: {
            category: 'my_actions',
            subcategory: 'intrigue',
            hidden: false,
            render: function(p) {
                return '🔥 You secretly pledge ' + p.gold + 'g to support dissidents in ' + p.townName + '.';
            }
        },
        BACKED_CLAIMANT: {
            category: 'my_actions',
            subcategory: 'intrigue',
            hidden: false,
            render: function(p) {
                return '💰 You back ' + p.claimantName + ' with ' + p.gold + 'g for the throne of ' + p.kingdomName + '.';
            }
        },
        CLAIMANT_WON: {
            category: 'my_actions',
            subcategory: 'intrigue',
            hidden: false,
            template: '🎉 Your claimant won the throne! You are greatly rewarded.'
        },
        CLAIMANT_LOST: {
            category: 'my_actions',
            subcategory: 'intrigue',
            hidden: false,
            template: '😞 Your claimant lost. You lose reputation and some of your investment.'
        }
    });

    // ──────────────────────────────────────────
    //  PLAYER ACTIONS — Agents
    // ──────────────────────────────────────────

    registerBatch({
        AGENT_HIRED: {
            category: 'my_actions',
            subcategory: 'agents',
            hidden: false,
            render: function(p) {
                return p.playerName + ' hired agent ' + p.agentNum + ' in ' + p.townName + '.';
            }
        },
        AGENT_EXECUTED_SPY: {
            category: 'my_actions',
            subcategory: 'agents',
            hidden: false,
            render: function(p) {
                return '☠️ Agent ' + p.agentNum + ' was executed as a spy in a hostile kingdom!';
            }
        },
        AGENT_SCHEMING_DISCOVERED: {
            category: 'my_actions',
            subcategory: 'agents',
            hidden: false,
            render: function(p) {
                return '🔍 ' + p.playerName + "'s scheming was discovered by the nobility! " + p.detail;
            }
        },
        AGENT_CAUGHT: {
            category: 'my_actions',
            subcategory: 'agents',
            hidden: false,
            render: function(p) {
                return p.playerName + "'s agent " + p.agentNum + ' was caught during ' + p.mission + ' and is ' + p.penalty + '.';
            }
        },
        AGENT_ARSON_SUCCESS: {
            category: 'my_actions',
            subcategory: 'agents',
            hidden: false,
            render: function(p) {
                return 'A building in ' + p.townName + ' was destroyed by fire!';
            }
        },
        AGENT_EXECUTED_HOSTILE: {
            category: 'my_actions',
            subcategory: 'agents',
            hidden: false,
            render: function(p) {
                return '☠️ Agent ' + p.agentNum + ' was executed in a hostile kingdom!';
            }
        },
        AGENT_CAUGHT_DIPLOMACY: {
            category: 'my_actions',
            subcategory: 'agents',
            hidden: false,
            render: function(p) {
                return p.playerName + "'s agent " + p.agentNum + ' was caught during diplomatic intrigue.';
            }
        }
    });

    // ──────────────────────────────────────────
    //  PLAYER ACTIONS — Quarantine & Travel
    // ──────────────────────────────────────────

    registerBatch({
        QUARANTINE_VIOLATION_JAILED: {
            category: 'my_actions',
            subcategory: 'travel',
            hidden: false,
            render: function(p) {
                return '🚔 ' + p.playerName + ' was caught violating ' + p.quarantineType + ' at ' + p.townName + '! Jailed for ' + p.days + ' days' + (p.extra || '') + '.';
            }
        },
        QUARANTINE_VIOLATION_FINED: {
            category: 'my_actions',
            subcategory: 'travel',
            hidden: false,
            render: function(p) {
                return '🚧 ' + p.playerName + ' was caught at ' + p.townName + ' ' + p.quarantineType + ' and fined ' + p.gold + 'g.';
            }
        },
        QUARANTINE_BRIBE_SUCCESS: {
            category: 'my_actions',
            subcategory: 'travel',
            hidden: false,
            render: function(p) {
                return '💰 ' + p.playerName + ' bribed a guard ' + p.gold + 'g to pass through ' + p.quarantineType + ' at ' + p.townName + '.';
            }
        },
        QUARANTINE_BRIBE_JAILED: {
            category: 'my_actions',
            subcategory: 'travel',
            hidden: false,
            render: function(p) {
                return '🚔 ' + p.playerName + ' was caught bribing a guard at ' + p.townName + ' ' + p.quarantineType + '! Jailed for ' + p.days + ' days' + (p.extra || '') + '.';
            }
        },
        QUARANTINE_BRIBE_FINED: {
            category: 'my_actions',
            subcategory: 'travel',
            hidden: false,
            render: function(p) {
                return '🚧 ' + p.playerName + ' was caught bribing a guard at ' + p.townName + ' ' + p.quarantineType + ' and fined ' + p.gold + 'g.';
            }
        },
        QUARANTINE_MEDICAL_PASS: {
            category: 'my_actions',
            subcategory: 'travel',
            hidden: false,
            render: function(p) {
                return '⚕️ ' + p.playerName + ' persuaded the quarantine guard to allow passage as a medical professional.';
            }
        },
        QUARANTINE_MEDICAL_FAIL: {
            category: 'my_actions',
            subcategory: 'travel',
            hidden: false,
            render: function(p) {
                return '⚕️ ' + p.playerName + ' failed to convince the quarantine guard of medical necessity. Must wait 7 days.';
            }
        }
    });

    // ──────────────────────────────────────────
    //  PLAYER ACTIONS — Dark Deeds & Crime
    // ──────────────────────────────────────────

    registerBatch({
        MANHUNT_STARTED: {
            category: 'my_actions',
            subcategory: 'crime',
            hidden: false,
            render: function(p) {
                return '🚨 ' + p.kingdomName + ' has discovered your involvement in ' + p.crimeName + '! A manhunt has begun. (' + p.days + ' days)';
            }
        },
        MANHUNT_ENDED: {
            category: 'my_actions',
            subcategory: 'crime',
            hidden: false,
            render: function(p) {
                return '🕊️ ' + p.npcName + ' has given up the manhunt against you for ' + p.crimeId + '.';
            }
        },
        CRIME_CAUGHT: {
            category: 'my_actions',
            subcategory: 'crime',
            hidden: false,
            render: function(p) {
                return p.howCaught + ' ' + p.npcName + ' for ' + p.crimeId + '! Penalty applied.';
            }
        },
        CRIME_NOBLE_IMMUNITY: {
            category: 'my_actions',
            subcategory: 'crime',
            hidden: false,
            render: function(p) {
                return '🔓 ' + p.playerName + ' committed a crime but is immune as ' + p.title + '. (-' + p.repLoss + ' reputation)';
            }
        },
        CRIME_NOBLE_TRIAL: {
            category: 'my_actions',
            subcategory: 'crime',
            hidden: false,
            render: function(p) {
                return '⚖️ As a noble of ' + p.kingdomName + ', your case has been deferred to the Noble Council trial.';
            }
        },
        CRIME_JAILED: {
            category: 'my_actions',
            subcategory: 'crime',
            hidden: false,
            render: function(p) {
                return '🚔 You were dragged from ' + p.fromLocation + ' and locked up in ' + p.prisonName + '.';
            }
        },
        CRIME_EXILED: {
            category: 'my_actions',
            subcategory: 'crime',
            hidden: false,
            render: function(p) {
                return p.playerName + ' has been exiled from ' + p.kingdomName + '!';
            }
        },
        SABOTAGE_BUILDING_SUCCESS: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return 'A building in ' + p.townName + ' has been sabotaged! Production halted for ' + p.days + ' days.';
            }
        },
        SABOTAGE_BUILDING_CAUGHT: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return p.playerName + ' was caught sabotaging a building in ' + p.townName + '!';
            }
        },
        SABOTAGE_ROAD_SUCCESS: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            template: 'A road has been sabotaged! Travel slowed.'
        },
        SABOTAGE_ROAD_CAUGHT: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return p.playerName + ' was caught sabotaging a road!';
            }
        },
        ARSON_SUCCESS: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return 'A building in ' + p.townName + ' has been destroyed by fire!';
            }
        },
        ARSON_CAUGHT: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return p.playerName + ' was caught committing arson in ' + p.townName + '!';
            }
        },
        THEFT_MARKET_SUCCESS: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return "Goods went missing from " + p.townName + "'s market.";
            }
        },
        THEFT_MARKET_CAUGHT: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return p.playerName + ' was caught stealing in ' + p.townName + '!';
            }
        },
        PICKPOCKET_SUCCESS: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            template: 'A townsfolk reported missing coins.'
        },
        PICKPOCKET_CAUGHT: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return p.playerName + ' was caught pickpocketing in ' + p.townName + '!';
            }
        },
        ROBBERY_NPC_CAUGHT: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return p.playerName + ' was caught trying to steal from ' + p.npcName + '!';
            }
        },
        WAREHOUSE_BREAK_SUCCESS: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return 'A warehouse in ' + p.townName + ' was broken into overnight.';
            }
        },
        WAREHOUSE_BREAK_CAUGHT: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return p.playerName + ' was caught breaking into a warehouse in ' + p.townName + '!';
            }
        },
        HIGHWAY_ROBBERY_SUCCESS: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return 'A traveler was robbed on the road near ' + p.townName + '.';
            }
        },
        HIGHWAY_ROBBERY_CAUGHT: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return p.playerName + ' was caught robbing travelers near ' + p.townName + '!';
            }
        },
        BANDIT_HIRE_SCAM: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            template: 'The bandits you hired took your gold and disappeared.'
        },
        CARAVAN_RAID_SUCCESS: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return 'A trade caravan was ambushed on the roads near ' + p.townName + '.';
            }
        },
        CARAVAN_RAID_CAUGHT: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return p.playerName + ' was linked to a caravan raid near ' + p.townName + '!';
            }
        },
        COUNTERFEIT_CAUGHT: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return p.playerName + ' was caught selling counterfeit goods in ' + p.townName + '!';
            }
        }
    });

    // ──────────────────────────────────────────
    //  PLAYER ACTIONS — Inheritance
    // ──────────────────────────────────────────

    registerBatch({
        INHERIT_EMPIRE_PARTIAL: {
            category: 'my_actions',
            subcategory: 'inheritance',
            hidden: false,
            render: function(p) {
                return '💰 Your spouse left most of the ' + p.spouseName + ' empire to ' + p.beneficiary + '! You received only ' + p.amount + 'g.';
            }
        },
        INHERIT_EMPIRE_FULL: {
            category: 'my_actions',
            subcategory: 'inheritance',
            hidden: false,
            render: function(p) {
                return '💰 You inherit the ' + p.spouseName + ' merchant empire! ' + p.amount + 'g received (after 15% death tax).';
            }
        },
        INHERIT_SECRET_BENEFICIARY: {
            category: 'my_actions',
            subcategory: 'inheritance',
            hidden: false,
            render: function(p) {
                return '💰 You inherit only ' + p.amount + 'g from your late spouse ' + p.spouseName + '. Most of the estate went to ' + p.beneficiary + ' (a secret beneficiary).';
            }
        },
        INHERIT_NORMAL: {
            category: 'my_actions',
            subcategory: 'inheritance',
            hidden: false,
            render: function(p) {
                return '💰 You inherit ' + p.amount + 'g from your late spouse ' + p.spouseName + ' (after 15% death tax).';
            }
        }
    });

    // ──────────────────────────────────────────
    //  PLAYER ACTIONS — Elections
    // ──────────────────────────────────────────

    registerBatch({
        ELECTION_CANDIDATE_WON: {
            category: 'my_actions',
            subcategory: 'politics',
            hidden: false,
            render: function(p) {
                return '🤝 Your candidate won the election! As Royal Advisor, ' + p.playerName + ' wields great influence over the new ruler.';
            }
        },
        ELECTION_PARTICIPATED: {
            category: 'my_actions',
            subcategory: 'politics',
            hidden: false,
            render: function(p) {
                return '🤝 As Royal Advisor, ' + p.playerName + ' participated in the election of the new ruler.';
            }
        }
    });

    // ──────────────────────────────────────────
    //  PLAYER ACTIONS — Family
    // ──────────────────────────────────────────

    registerBatch({
        FAMILY_PROPOSAL: {
            category: 'my_actions',
            subcategory: 'family',
            hidden: false,
            render: function(p) {
                return p.playerName + ' proposed to ' + p.spouseFirstName + ' ' + p.spouseLastName + '! Wedding in ' + p.planDays + ' days.';
            }
        },
        WEDDING_VENUE_DOWNGRADE: {
            category: 'my_actions',
            subcategory: 'family',
            hidden: false,
            render: function(p) {
                return '💍 Your rank has fallen since planning the wedding; the ' + p.venueName + ' is no longer available. Using ' + p.fallbackName + ' instead.';
            }
        },
        SPOUSE_MAIDEN_NAME: {
            category: 'my_actions',
            subcategory: 'family',
            hidden: false,
            render: function(p) {
                return '💁 ' + p.spouseFirstName + ' has chosen to keep their maiden name.';
            }
        },
        FAMILY_MARRIED: {
            category: 'my_actions',
            subcategory: 'family',
            hidden: false,
            render: function(p) {
                return p.playerName + ' married ' + p.spouseFirstName + ' ' + p.spouseLastName + '! ' + p.venueIcon + ' ' + p.feastIcon;
            }
        },
        FAMILY_ROYAL_MARRIAGE: {
            category: 'my_actions',
            subcategory: 'family',
            hidden: false,
            render: function(p) {
                return '👑 ' + p.playerName + ' has married into the royal family of ' + p.kingdomName + '! +25% relationship gains with the king and kingdom.';
            }
        },
        MARRIAGE_RANK_ELEVATED: {
            category: 'my_actions',
            subcategory: 'family',
            hidden: false,
            render: function(p) {
                return '🏰 Through marriage, ' + p.playerName + ' has been elevated to ' + p.rankName + '!';
            }
        },
        MARRIAGE_ARISTOCRACY: {
            category: 'my_actions',
            subcategory: 'family',
            hidden: false,
            render: function(p) {
                return '🏰 ' + p.playerName + ' has entered the aristocracy!';
            }
        },
        NOBLE_GUARDS_GRANTED: {
            category: 'my_actions',
            subcategory: 'family',
            hidden: false,
            render: function(p) {
                return '🛡️ As a new noble, ' + p.playerName + ' has been granted ' + p.count + ' personal guards by the kingdom!';
            }
        },
        SPOUSE_RANK_ELEVATED: {
            category: 'my_actions',
            subcategory: 'family',
            hidden: false,
            render: function(p) {
                return '🏰 Through marriage to ' + p.playerName + ', ' + p.spouseFirstName + ' has been elevated to ' + p.rankName + '!';
            }
        },
        CHILD_MARRIED: {
            category: 'my_actions',
            subcategory: 'family',
            hidden: false,
            render: function(p) {
                return p.childFirstName + ' ' + p.childLastName + ' married ' + p.targetFirstName + ' ' + p.targetLastName + '!';
            }
        },
        MARRIAGE_PROPOSAL_RECEIVED: {
            category: 'my_actions',
            subcategory: 'family',
            hidden: false,
            render: function(p) {
                return p.emFirstName + ' ' + p.emLastName + ' proposes a marriage between ' + p.ecFirstName + ' and your child ' + p.pcFirstName + '!';
            }
        },
        CHILD_CAME_OF_AGE: {
            category: 'my_actions',
            subcategory: 'family',
            hidden: false,
            render: function(p) {
                return p.firstName + ' ' + p.lastName + ' has come of age!';
            }
        },
        CHILD_BORN_SPOUSE_NAMED: {
            category: 'my_actions',
            subcategory: 'family',
            hidden: false,
            render: function(p) {
                return 'A child is born! ' + p.spouseFirstName + ' has named ' + p.pronoun + ' ' + p.childFirstName + ' ' + p.lastName + '.';
            }
        },
        CHILD_BORN_JOINS_FAMILY: {
            category: 'my_actions',
            subcategory: 'family',
            hidden: false,
            render: function(p) {
                return 'A child is born! ' + p.childFirstName + ' ' + p.lastName + ' joins the family.';
            }
        },
        EXPECTING_CHILD: {
            category: 'my_actions',
            subcategory: 'family',
            hidden: false,
            render: function(p) {
                return 'Wonderful news! ' + p.who + ' expecting a child!';
            }
        },
        SPOUSE_FELL_ILL: {
            category: 'my_actions',
            subcategory: 'family',
            hidden: false,
            render: function(p) {
                return p.spouseFirstName + ' has fallen ill.';
            }
        },
        SPOUSE_INJURED: {
            category: 'my_actions',
            subcategory: 'family',
            hidden: false,
            render: function(p) {
                return p.spouseFirstName + ' has been injured.';
            }
        },
        SPOUSE_GRAVELY_ILL: {
            category: 'my_actions',
            subcategory: 'family',
            hidden: false,
            render: function(p) {
                return p.spouseFirstName + ' has become gravely ill!';
            }
        },
        SPOUSE_RECOVERED_ILLNESS: {
            category: 'my_actions',
            subcategory: 'family',
            hidden: false,
            render: function(p) {
                return p.spouseFirstName + ' has recovered from illness.';
            }
        },
        SPOUSE_DIED_ILLNESS: {
            category: 'my_actions',
            subcategory: 'family',
            hidden: false,
            render: function(p) {
                return p.spouseFirstName + ' has died from a severe illness. You are devastated.';
            }
        },
        SPOUSE_STABILIZED: {
            category: 'my_actions',
            subcategory: 'family',
            hidden: false,
            render: function(p) {
                return p.spouseFirstName + '\'s condition has stabilized.';
            }
        },
        SPOUSE_RECOVERED_INJURY: {
            category: 'my_actions',
            subcategory: 'family',
            hidden: false,
            render: function(p) {
                return p.spouseFirstName + ' has recovered from injuries.';
            }
        },
        SPOUSE_ARRIVED: {
            category: 'my_actions',
            subcategory: 'family',
            hidden: false,
            render: function(p) {
                return '💍 ' + p.spouseFirstName + ' has arrived in ' + p.townName + '.';
            }
        },
        SPOUSE_HOSPITAL_TREATMENT: {
            category: 'my_actions',
            subcategory: 'family',
            hidden: false,
            render: function(p) {
                return '🏥 ' + p.spouseFirstName + ' sought treatment at the hospital (' + p.cost + 'g from savings).';
            }
        },
        SPOUSE_RECRUITING_WORKERS: {
            category: 'my_actions',
            subcategory: 'family',
            hidden: false,
            render: function(p) {
                return p.spouseFirstName + ' is recruiting workers on your behalf.';
            }
        },
        SPOUSE_QUALITY_TIME: {
            category: 'my_actions',
            subcategory: 'family',
            hidden: false,
            render: function(p) {
                return 'You spend quality time with ' + p.spouseFirstName + '. Your bond grows stronger.';
            }
        },
        SPOUSE_GUARDING_CARAVAN: {
            category: 'my_business',
            subcategory: 'family',
            hidden: false,
            render: function(p) {
                return p.spouseFirstName + ' is guarding your caravan.';
            }
        },
        SPOUSE_NAME_DELIGHTED: {
            category: 'my_actions',
            subcategory: 'family',
            hidden: false,
            render: function(p) {
                return '❤️ ' + p.spouseName + ' is delighted you chose ' + p.pronoun + ' suggested name!';
            }
        },
        CHILD_BORN_NAMED: {
            category: 'my_actions',
            subcategory: 'family',
            hidden: false,
            render: function(p) {
                return 'A child is born! ' + p.childFullName + ' joins the family.';
            }
        },
        EXPECTING_CHILD_TRY: {
            category: 'my_actions',
            subcategory: 'family',
            hidden: false,
            render: function(p) {
                return '💕 Wonderful news! ' + p.who + ' expecting a child!';
            }
        },
        PLAYER_DIED_REGENCY: {
            category: 'my_actions',
            subcategory: 'family',
            hidden: false,
            render: function(p) {
                return p.playerName + ' has passed. ' + p.spouseFirstName + ' serves as regent for young ' + p.heirFirstName + '.';
            }
        },
        HEIR_DIED_REGENCY: {
            category: 'my_actions',
            subcategory: 'family',
            hidden: false,
            render: function(p) {
                return 'The heir has died during regency. The legacy ends.';
            }
        },
        DYNASTY_SKILL_INHERITED: {
            category: 'my_actions',
            subcategory: 'family',
            hidden: false,
            render: function(p) {
                return '🏰 ' + p.playerName + ' inherited ' + p.skillPoints + ' skill points from the dynasty bank!';
            }
        },
        HEIR_CAME_OF_AGE: {
            category: 'my_actions',
            subcategory: 'family',
            hidden: false,
            render: function(p) {
                return p.playerName + ' has come of age and inherits the family legacy! (' + p.label + ')';
            }
        }
    });

    // ──────────────────────────────────────────
    //  PLAYER ACTIONS — Quests
    // ──────────────────────────────────────────

    registerBatch({
        QUEST_TOWN_ACCEPTED: {
            category: 'my_actions',
            subcategory: 'quests',
            hidden: false,
            render: function(p) {
                return '📋 Accepted town quest: ' + p.title + ' in ' + p.townName;
            }
        },
        QUEST_TOWN_COMPLETED: {
            category: 'my_actions',
            subcategory: 'quests',
            hidden: false,
            render: function(p) {
                return '✅ Completed quest: ' + p.title + (p.donated ? ' (donated)' : ' (sold)');
            }
        },
        QUEST_TOWN_ABANDONED: {
            category: 'my_actions',
            subcategory: 'quests',
            hidden: false,
            render: function(p) {
                return '❌ Abandoned quest: ' + p.title;
            }
        },
        QUEST_TOWN_EXPIRED: {
            category: 'my_actions',
            subcategory: 'quests',
            hidden: false,
            render: function(p) {
                return '⏰ Quest expired: ' + p.title + ' in ' + p.townName;
            }
        },
        QUEST_KINGDOM_ACCEPTED: {
            category: 'my_actions',
            subcategory: 'quests',
            hidden: false,
            render: function(p) {
                return '📜 Accepted kingdom quest: ' + p.title;
            }
        },
        QUEST_KINGDOM_REJECTED: {
            category: 'my_actions',
            subcategory: 'quests',
            hidden: false,
            render: function(p) {
                return '❌ Rejected kingdom quest: ' + p.title + ' (-' + p.repLoss + ' rep, -' + p.relLoss + ' king rel)';
            }
        },
        QUEST_KINGDOM_ABANDONED: {
            category: 'my_actions',
            subcategory: 'quests',
            hidden: false,
            render: function(p) {
                return '❌ Abandoned kingdom quest: ' + p.title;
            }
        },
        QUEST_KINGDOM_COMPLETED: {
            category: 'my_actions',
            subcategory: 'quests',
            hidden: false,
            render: function(p) {
                return '✅ Completed kingdom quest: ' + p.title + ' (+' + p.gold + 'g, +' + p.rep + ' rep)';
            }
        },
        QUEST_FOLLOWUP_AVAILABLE: {
            category: 'my_actions',
            subcategory: 'quests',
            hidden: false,
            render: function(p) {
                return '🔗 A follow-up directive is now available: ' + p.title;
            }
        },
        QUEST_ACTION_ALL_STEPS_DONE: {
            category: 'my_actions',
            subcategory: 'quests',
            hidden: false,
            render: function(p) {
                return '✅ ' + p.mechLabel + ' — all steps completed! (Step ' + p.stepNum + '/' + p.totalSteps + ': ' + p.stepLabel + ')';
            }
        },
        QUEST_ACTION_STEP_COMPLETE: {
            category: 'my_actions',
            subcategory: 'quests',
            hidden: false,
            render: function(p) {
                return '✅ Step ' + p.stepNum + '/' + p.totalSteps + ' complete: ' + p.stepLabel + '. Next: ' + p.nextStepLabel;
            }
        },
        QUEST_ACTION_SUCCEEDED: {
            category: 'my_actions',
            subcategory: 'quests',
            hidden: false,
            render: function(p) {
                return '✅ ' + p.mechLabel + ' succeeded! (attempt #' + p.attemptNum + ')';
            }
        },
        QUEST_CORRUPTION_GAINED: {
            category: 'my_actions',
            subcategory: 'quests',
            hidden: false,
            render: function(p) {
                return '🏴 ' + p.playerName + ' has gained a reputation for corruption.';
            }
        },
        QUEST_EXTORTION_GOLD: {
            category: 'my_actions',
            subcategory: 'quests',
            hidden: false,
            render: function(p) {
                return '💰 ' + p.playerName + ' extracted ' + p.gold + 'g from a merchant.';
            }
        },
        QUEST_TRADE_ROUTE: {
            category: 'my_actions',
            subcategory: 'quests',
            hidden: false,
            render: function(p) {
                return '🛤️ ' + p.playerName + ' established a new trade route for the kingdom (+' + p.income + 'g/month).';
            }
        },
        QUEST_BUILDING_BUILT: {
            category: 'my_actions',
            subcategory: 'quests',
            hidden: false,
            render: function(p) {
                return '🏗️ ' + p.playerName + ' oversaw construction of a ' + p.buildingType + ' in ' + p.townName + '.';
            }
        },
        QUEST_FOREIGN_SALES: {
            category: 'my_actions',
            subcategory: 'quests',
            hidden: false,
            render: function(p) {
                return '💰 ' + p.playerName + ' earned ' + p.gold + 'g selling goods in foreign markets.';
            }
        },
        QUEST_ESCORT_THANKED: {
            category: 'my_actions',
            subcategory: 'quests',
            hidden: false,
            render: function(p) {
                return '🤝 ' + p.nobleFirstName + ' thanks ' + p.playerName + ' for the safe escort.';
            }
        },
        QUEST_ACTION_FAILED: {
            category: 'my_actions',
            subcategory: 'quests',
            hidden: false,
            render: function(p) {
                return '❌ ' + p.failLabel + ' failed (attempt #' + p.attemptNum + ', ' + p.chancePct + '% chance)';
            }
        },
        QUEST_ESPIONAGE_DISCOVERED: {
            category: 'my_actions',
            subcategory: 'quests',
            hidden: false,
            render: function(p) {
                return '🔍 ' + p.playerName + '\'s espionage activities were discovered! Reputation damaged.';
            }
        },
        QUEST_DIPLOMATIC_INCIDENT: {
            category: 'my_actions',
            subcategory: 'quests',
            hidden: false,
            render: function(p) {
                return '⚠️ Diplomatic incident: espionage operation exposed, straining relations.';
            }
        },
        QUEST_CORRUPT_NEARLY_CAUGHT: {
            category: 'my_actions',
            subcategory: 'quests',
            hidden: false,
            render: function(p) {
                return '🚔 ' + p.playerName + '\'s corrupt activities were nearly exposed!';
            }
        },
        QUEST_KINGDOM_EXPIRED: {
            category: 'my_actions',
            subcategory: 'quests',
            hidden: false,
            render: function(p) {
                return '⏰ Kingdom quest expired: ' + p.title;
            }
        },
        GUILD_JOINED: {
            category: 'my_actions',
            subcategory: 'quests',
            hidden: false,
            render: function(p) {
                return p.icon + ' Joined ' + p.guildName + ' (' + p.memberType + ', ' + p.price + 'g)';
            }
        },
        QUEST_STEP_AUTO_COMPLETED: {
            category: 'my_actions',
            subcategory: 'quests',
            hidden: false,
            render: function(p) {
                return '📋 ' + p.stepLabel + ' — auto-completed.';
            }
        },
        QUEST_EVIDENCE_FOUND: {
            category: 'my_actions',
            subcategory: 'quests',
            hidden: false,
            render: function(p) {
                return '🔍 Found evidence at ' + p.buildingType + ' in ' + p.townName + '!';
            }
        },
        QUEST_EVIDENCE_NOT_FOUND: {
            category: 'my_actions',
            subcategory: 'quests',
            hidden: false,
            render: function(p) {
                return '🔍 Searched ' + p.buildingType + ' in ' + p.townName + ' but found nothing useful.';
            }
        },
        QUEST_NPC_INTERVIEW_INFO: {
            category: 'my_actions',
            subcategory: 'quests',
            hidden: false,
            render: function(p) {
                return '🗣️ ' + p.npcName + ' provided useful information!';
            }
        },
        QUEST_NPC_INTERVIEW_EMPTY: {
            category: 'my_actions',
            subcategory: 'quests',
            hidden: false,
            render: function(p) {
                return '🗣️ ' + p.npcName + ' had nothing useful to share.';
            }
        },
        QUEST_CRIMINAL_LOCATION_FOUND: {
            category: 'my_actions',
            subcategory: 'quests',
            hidden: false,
            render: function(p) {
                return '🔎 ' + p.npcName + ' revealed that ' + p.criminalName + ' is hiding in ' + p.criminalTownName + '!';
            }
        },
        QUEST_CRIMINAL_LOCATION_UNKNOWN: {
            category: 'my_actions',
            subcategory: 'quests',
            hidden: false,
            render: function(p) {
                return '🔎 ' + p.npcName + " doesn't know where " + p.criminalName + ' is.';
            }
        },
        QUEST_CRIMINAL_CAPTURED: {
            category: 'my_actions',
            subcategory: 'quests',
            hidden: false,
            render: function(p) {
                return '🎯 You captured ' + p.targetName + '!';
            }
        },
        QUEST_CRIMINAL_ESCAPED: {
            category: 'my_actions',
            subcategory: 'quests',
            hidden: false,
            render: function(p) {
                return '🎯 ' + p.targetName + ' escaped your grasp!';
            }
        },
        QUEST_ALL_STEPS_DONE: {
            category: 'my_actions',
            subcategory: 'quests',
            hidden: false,
            render: function(p) {
                return '✅ All steps completed for quest: ' + p.title;
            }
        },
        QUEST_INTERACTIVE_STEP_DONE: {
            category: 'my_actions',
            subcategory: 'quests',
            hidden: false,
            render: function(p) {
                return '✅ Step ' + p.stepNum + '/' + p.totalSteps + ' complete. Next: ' + p.nextStepLabel;
            }
        }
    });

    // ──────────────────────────────────────────
    //  PLAYER ACTIONS — Dark Deeds
    // ──────────────────────────────────────────

    registerBatch({
        DD_BRIBE_GUARDS_SUCCESS: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return 'Guards in ' + p.townName + ' have been bribed.';
            }
        },
        DD_BRIBE_GUARDS_CAUGHT: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return p.playerName + ' was caught trying to bribe guards in ' + p.townName + '!';
            }
        },
        DD_BRIBE_ADVISOR_SUCCESS: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return 'A royal advisor in ' + p.kingdomName + ' has been influenced.';
            }
        },
        DD_BRIBE_ADVISOR_CAUGHT: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return p.playerName + ' was caught bribing a royal advisor in ' + p.kingdomName + '!';
            }
        },
        DD_HEIR_GIFT: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return p.playerName + ' gifted luxury goods to the heir of ' + p.kingdomName + '.';
            }
        },
        DD_BLACKMAIL_SUCCESS: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return p.firstName + ' is now being blackmailed.';
            }
        },
        DD_BLACKMAIL_CAUGHT: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return p.playerName + ' was exposed trying to blackmail ' + p.firstName + '!';
            }
        },
        DD_RUMORS_SPREAD: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return 'Rumors are spreading about a merchant...';
            }
        },
        DD_FRAME_SUCCESS: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return 'A merchant has been falsely accused of a crime!';
            }
        },
        DD_FRAME_CAUGHT: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return p.playerName + ' was caught trying to frame a competitor!';
            }
        },
        DD_KING_ASSASSINATED: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return 'The king of ' + p.kingdomName + ' has been assassinated!';
            }
        },
        DD_REGICIDE_CAUGHT: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return p.playerName + ' was caught plotting regicide against ' + p.kingdomName + '!';
            }
        },
        DD_GUARD_CAPTAIN_ASSASSINATED: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return 'The guard captain in ' + p.townName + ' has been assassinated!';
            }
        },
        DD_GUARD_CAPTAIN_ASSASSIN_CAUGHT: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return p.playerName + ' was caught hiring an assassin for the guard captain!';
            }
        },
        DD_COMPETITOR_KILLED: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return 'A merchant has been found dead under suspicious circumstances.';
            }
        },
        DD_HIRE_ASSASSIN_CAUGHT: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return p.playerName + ' was caught hiring an assassin!';
            }
        },
        DD_POISON_PLANTED: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return 'Someone has fallen mysteriously ill...';
            }
        },
        DD_POISON_CAUGHT: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return p.playerName + ' was caught paying an agent to poison someone!';
            }
        },
        DD_NPC_ASSASSINATED: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return p.firstName + ' ' + p.lastName + ' was found dead — assassinated by an unknown blade.';
            }
        },
        DD_NPC_ASSASSIN_CAUGHT: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return p.playerName + ' was caught hiring an assassin to kill ' + p.targetFirstName + '!';
            }
        },
        DD_NPC_MURDERED: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return p.firstName + ' ' + p.lastName + ' was found murdered (perpetrator unknown).';
            }
        },
        DD_DIRECT_KILL_CAUGHT: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return p.playerName + ' was caught murdering ' + p.targetFirstName + ' with their own blade!';
            }
        },
        DD_HIDDEN_WAREHOUSE_BUILT: {
            category: 'my_business',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return p.playerName + ' constructed something in ' + p.townName + '.';
            }
        },
        DD_COOK_BOOKS: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return p.playerName + ' is underreporting trade volumes.';
            }
        },
        DD_POISON_TARGET_DIED: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return '☠️ ' + p.victimName + ' has succumbed to the poison you arranged.';
            }
        },
        DD_POISON_TARGET_RECOVERED: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return 'A poisoning target appears to have recovered.';
            }
        },
        DD_INTEL_LEGISLATION: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return '🕵️ Intelligence: ' + p.kingdomName + ' is planning new legislation.';
            }
        },
        DD_INTEL_INSTABILITY: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return '🕵️ Intelligence: ' + p.kingdomName + ' is experiencing instability (' + p.stability + '%).';
            }
        },
        DD_INTEL_PRICES: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return '🕵️ Intelligence: ' + p.resourceName + ' prices are ' + p.trend + ' in ' + p.townName + '.';
            }
        },
        DD_SMUGGLING_BUSTED: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return '🚨 A smuggling route was discovered and shut down!';
            }
        },
        DD_PROTECTION_RACKET_EXPOSED: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return '🚨 Protection racket in ' + p.townName + ' was exposed! Merchants reported to authorities.';
            }
        },
        DD_DOUBLE_AGENT_EXPOSED: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return '🚨 ' + p.playerName + ' was exposed as a double agent! Dishonorably discharged and exiled.';
            }
        },
        DD_HIDDEN_WAREHOUSE_FOUND: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return p.playerName + '\'s hidden warehouse was discovered! Goods confiscated, fined 500g.';
            }
        },
        DD_AUDIT_CAUGHT: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return p.playerName + '\'s books were audited! Fined ' + p.fine + 'g for tax evasion.';
            }
        },
        DD_NOTORIETY_REDUCTION_DONE: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return p.playerName + '\'s notoriety reduction (' + p.reductionType + ') is complete.';
            }
        },
        DD_NPC_RUMORS_SPREAD: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return '🤫 Rumors are being spread about ' + p.playerName + '! Reputation -' + p.repLoss + '.';
            }
        },
        DD_NPC_THEFT_SUFFERED: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return '💰 ' + p.playerName + ' had ' + p.amount + 'g stolen by an unknown thief!';
            }
        },
        DD_NPC_SABOTAGE_SUFFERED: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return '🔨 One of ' + p.playerName + '\'s buildings was sabotaged! Disabled for ' + p.days + ' days.';
            }
        },
        DD_NPC_PRICE_MANIPULATION: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return '📈 Market prices for ' + p.resource + ' in ' + p.townName + ' have been artificially inflated.';
            }
        },
        DD_FRAME_DETECTED: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return '🕵️ ' + p.playerName + '\'s intelligence network uncovered a framing attempt!';
            }
        },
        DD_NPC_FRAMED: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return '🎭 ' + p.playerName + ' has been falsely accused of a crime! Fined ' + p.fine + 'g.';
            }
        },
        DD_ASSASSINATION_ATTEMPT_HIT: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return '🗡️ An assassin attacked ' + p.playerName + '! Severely wounded, lost ' + p.goldLost + 'g.';
            }
        },
        DD_ASSASSINATION_ATTEMPT_FOILED: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return '🛡️ An assassin targeted ' + p.playerName + ' but was thwarted!';
            }
        },
        DD_PASSENGER_ASSASSIN_CAUGHT: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return p.playerName + ' was caught attempting to assassinate ' + p.firstName + '!';
            }
        },
        DD_PASSENGER_KILLED: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return 'An elite merchant was found dead during transport. Foul play suspected.';
            }
        },
        DD_SPY_NETWORK_ESTABLISHED: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return p.playerName + ' established intelligence contacts in ' + p.townName + '.';
            }
        },
        DD_SMUGGLING_ROUTE_ESTABLISHED: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return 'A new smuggling route has been established between ' + p.fromTownName + ' and ' + p.toTownName + '.';
            }
        },
        DD_FORGED_ORDER_TAX: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return '📜 [Forged Royal Order] ' + p.kingdomName + ' adjusts tax rate to ' + p.taxRate + '%.';
            }
        },
        DD_FORGED_ORDER_RELEASE: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return '🗝️ [Forged Royal Order] ' + p.firstName + ' ' + p.lastName + ' has been released from jail in ' + p.townName + '.';
            }
        },
        DD_FORGED_ORDER_BAN: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return '📜 [Forged Royal Order] ' + p.kingdomName + ' bans ' + p.good + '.';
            }
        },
        DD_FORGED_ORDER_UNBAN: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return '📜 [Forged Royal Order] ' + p.kingdomName + ' unbans ' + p.good + '.';
            }
        },
        DD_FORGED_ORDER_JAIL: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return '⛓️ [Forged Royal Order] ' + p.firstName + ' ' + p.lastName + ' has been arrested in ' + p.kingdomName + '! The nobility is uneasy.';
            }
        },
        DD_FORGED_ORDER_WAR: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return '⚔️ [Forged Royal Order] ' + p.kingdomName + ' declares war on ' + p.enemyName + '!';
            }
        },
        DD_FORGED_ORDER_PEACE: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return '🕊️ [Forged Royal Order] ' + p.kingdomName + ' makes peace with ' + p.enemyName + '!';
            }
        },
        DD_TREASON_EXECUTED: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return '⚔️ The King of ' + p.kingdomName + ' ordered ' + p.firstName + ' ' + p.lastName + ' EXECUTED for treason with ' + p.enemyName + '!';
            }
        },
        DD_TREASON_EXILED: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return '🚪 The King of ' + p.kingdomName + ' EXILED ' + p.firstName + ' ' + p.lastName + ' for treasonous correspondence with ' + p.enemyName + '!';
            }
        },
        DD_TREASON_JAILED: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return '⛓️ The King of ' + p.kingdomName + ' had ' + p.firstName + ' ' + p.lastName + ' JAILED 90 days for suspected treason with ' + p.enemyName + '!';
            }
        },
        DD_WORKER_STRIKE: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return '🚧 Workers in ' + p.townName + ' have walked off the job! ' + p.count + ' buildings halted for 14 days.';
            }
        },
        DD_DISEASE_PLANTED: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return '🦠 Disease has appeared in ' + p.townName + '! Townspeople are taking ill.';
            }
        },
        DD_CARAVAN_RAIDED: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return 'A caravan belonging to ' + p.firstName + ' was raided by bandits near ' + p.townName + '.';
            }
        },
        DD_CONTRABAND_ARRESTED: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return p.firstName + ' was arrested after contraband was found in their possession!';
            }
        },
        DD_INCITE_REVOLT: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return 'Unrest is brewing in ' + p.kingdomName + '! Agitators are spreading dissent.';
            }
        },
        DD_DOUBLE_AGENT_STARTED: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return p.playerName + ' has begun selling military secrets.';
            }
        },
        DD_PROTECTION_RACKET_STARTED: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return 'Local merchants in ' + p.townName + ' are being extorted for "protection" money.';
            }
        },
        DD_LAY_LOW: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return p.playerName + ' is paying ' + p.cost + 'g to lay low and let the heat die down.';
            }
        },
        DD_JAILBREAK_SUCCESS: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return '🔓 ' + p.playerName + ' broke ' + p.firstName + ' ' + p.lastName + ' out of jail in ' + p.townName + '! Relationship: ' + p.oldRel + ' → ' + p.newRel + '. (+10 notoriety)';
            }
        },
        DD_JAILBREAK_CAUGHT: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return '⛓️ ' + p.playerName + ' caught attempting jailbreak in ' + p.townName + ' — fined ' + p.fine + 'g, jailed 14 days.';
            }
        },
        DD_JAILBREAK_ESCAPED: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return '🚪 ' + p.playerName + '\'s jailbreak attempt failed but they slipped away unnoticed.';
            }
        },
        DD_CLEANSE_IDENTITY: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return p.playerName + ' is using ' + p.skills + ' to cleanse their identity.';
            }
        },
        DD_SPY_NEARLY_EXECUTED: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return '⚔️ ' + p.playerName + ' was nearly executed as a spy! Massive fine and extended imprisonment.';
            }
        },
        DD_NOBLE_TENSIONS: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return '🗡️ Tensions rise between ' + p.nobleAName + ' and ' + p.nobleBName + '.';
            }
        },
        DD_NOBLE_LOYALTY_WAVERS: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return '🏴 ' + p.nobleName + '\'s loyalty to the crown wavers.';
            }
        },
        DD_NOBLE_DISCREDITED: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return '📜 Rumors about ' + p.nobleName + '\'s incompetence spread through the court.';
            }
        },
        DD_NOBLE_SCANDAL: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return '💥 Scandalous revelations about ' + p.firstName + ' ' + p.lastName + ' rock the court of ' + p.kingdomName + '!';
            }
        },
        DD_NOBLE_AGENT_STARTED: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return '🕵️ ' + p.playerName + ' has begun a dangerous double life as a noble agent for ' + p.sponsorName + '.';
            }
        },
        DD_NOBLE_AGENT_TASK: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return '🕵️ Double agent task completed: ' + p.taskName + ' (' + p.completed + '/5)';
            }
        },
        DD_NOBLE_AGENT_COMPLETED: {
            category: 'my_actions',
            subcategory: 'dark_deeds',
            hidden: false,
            render: function(p) {
                return '🎭 ' + p.playerName + ' revealed as a double agent! Fled to ' + p.sponsorName + ' with ' + p.reward + 'g reward.';
            }
        }
    });
    // ══════════════════════════════════════════
    //  EMIT FUNCTION
    // ══════════════════════════════════════════

    function emit(typeId, params, options) {
        params = params || {};
        options = options || {};

        var type = TYPES[typeId];
        if (!type) {
            console.warn('[EventTypes] Unknown event type:', typeId);
            return;
        }

        // Build message
        var msg = type.render
            ? type.render(params)
            : renderTemplate(type.template || '', params);

        // Resolve category (string or function)
        var cat = options.categoryOverride ||
            (typeof type.category === 'function' ? type.category(params.kingdomId) : type.category);

        // Build details — include eventType id but exclude internal fields
        var details = { eventType: typeId };
        for (var k in params) {
            if (params.hasOwnProperty(k) && k !== 'kingdomId') {
                details[k] = params[k];
            }
        }
        // Always pass kingdomId in details if present
        if (params.kingdomId) details.kingdomId = params.kingdomId;
        // Merge extra detail fields
        if (options.details) {
            for (var dk in options.details) {
                if (options.details.hasOwnProperty(dk)) details[dk] = options.details[dk];
            }
        }
        if (options._noToast) details._noToast = true;

        // Emit
        if (type.hidden) {
            Engine.logHiddenEvent(msg, details, cat);
        } else {
            Engine.logEvent(msg, details, cat);
        }
    }

    // ══════════════════════════════════════════
    //  PUBLIC API
    // ══════════════════════════════════════════

    window.EventTypes = {
        TYPES: TYPES,
        emit: emit,
        resolveKingdomCategory: resolveKingdomCategory,
        resolveEitherKingdomCategory: resolveEitherKingdomCategory
    };

})();
