(function() {
    'use strict';

    function relationshipTemplateBlocks(def, instance, ctx) {
        var step = instance.stepIndex || 0;
        var history = instance.choiceHistory || [];
        var firstChoice = history[0] ? history[0].choiceId : null;
        var secondChoice = history[1] ? history[1].choiceId : null;

        if (def.template === 'rival_merchant') {
            if (step === 0) return {
                title: def.title,
                icon: def.icon,
                text: '{npcName} has made a habit of appearing one stall over in {townName}, smiling that ledger-thin smile while somehow offering the same goods for a hair less. Today they greet you by name, then steal a customer with a compliment they must have practiced all morning. Even so, when the crowd turns, {npcName} gives you a small nod meant for no one else. They see you. Worse, they enjoy being seen by you. {npc2Name}, one of your best contacts, is watching to see whether this becomes a trade war or the beginning of something stranger.',
                choices: [
                    { id: 'fair_duel', label: 'Meet {npcName} price for price and keep it honorable (-less gold, +relationship)', effectKey: 'haggle', nextStepIndex: 1 },
                    { id: 'poach_contact', label: 'Use {npc2Name} to poach the customer outright (+gold, -reputation)', effectKey: 'exploit', nextStepIndex: 1 },
                    { id: 'split_sale', label: 'Offer to split the sale and test whether rivalry can bend (+gold, +reputation, +relationship)', effectKey: 'share', nextStepIndex: 1 }
                ]
            };
            if (step === 1) {
                var rivalStep1 = '{npcName} finds you after sunset beside the counting house in {townName}. Their coat is damp from the mist, their temper drier than old parchment. "You make this interesting, {playerName}," they say. "That is either the highest praise I have, or a warning." Then {npc2Name} arrives with word of a caravan slot large enough for only one of you unless you choose to cooperate.';
                if (firstChoice === 'poach_contact') rivalStep1 = '{npcName} does not bother hiding the hurt when they catch up with you in {townName}. "You could have beaten me clean," they say, voice low. "Instead you made {npc2Name} choose." The words should feel like victory. They do not. Even so, when news comes of a caravan slot large enough for only one merchant unless the two of you cooperate, {npcName} brings it to you instead of burying it.';
                if (firstChoice === 'split_sale') rivalStep1 = 'The shared sale should have eased things, but instead it has changed their shape. {npcName} finds you in {townName} carrying two cups of bad market wine and offers you one without smiling. "We made coin," they say. "That does not mean I trust you." When {npc2Name} brings word of a caravan slot that favors cooperation over ego, the question hanging between you is not profit. It is whether either of you can bear to owe the other.';
                return {
                    title: def.title,
                    icon: def.icon,
                    text: rivalStep1,
                    choices: [
                        { id: 'run_together', label: 'Risk a joint run with {npcName} (+reputation, +relationship)', effectKey: 'support', nextStepIndex: 2 },
                        { id: 'blacken_name', label: 'Quietly report {npcName} for their sharp practices (+reputation, -relationship)', effectKey: 'report', nextStepIndex: 2 },
                        { id: 'respect_distance', label: 'Keep the rivalry sharp but respectful (+relationship, +reputation)', effectKey: 'encourage', nextStepIndex: 2 }
                    ]
                };
            }
            var rivalStep2 = '{npcName} is waiting at the gate of {townName} when the caravan finally rolls in under stormlight. One axle has shattered. Teamsters are shouting. {npc2Name} swears there is still time to save most of the cargo if the two of you work together. {npcName} looks at you the way merchants look at a ledger that does not balance: frustrated, intent, and unable to walk away. This is the moment the rivalry becomes a scar, a partnership, or something like respect.';
            if (secondChoice === 'blacken_name') rivalStep2 = 'The accusation did not ruin {npcName}; it only made them harder around the edges. Now, at the gate of {townName}, with a shattered axle and rain soaking the manifests, {npcName} could leave you to fail. Instead they hold the lead horse steady and wait for your decision. The look they give you is tired more than angry. That somehow lands deeper.';
            if (secondChoice === 'run_together') rivalStep2 = 'Working together taught you inconvenient things about {npcName}: that they count under their breath when afraid, that they hate waste more than hunger, that they only mock people who matter to them. Now the caravan is in trouble outside {townName}, and {npc2Name} says only one decisive voice will keep the crew from scattering. {npcName} turns to you first.';
            return {
                title: def.title,
                icon: def.icon,
                text: rivalStep2,
                choices: [
                    { id: 'bind_fates', label: 'Stand beside {npcName} and share the credit (+reputation, +relationship)', effectKey: 'share_credit' },
                    { id: 'take_opening', label: 'Use the chaos to seize the contract for yourself (+gold, +reputation)', effectKey: 'take_tribute' },
                    { id: 'let_it_end', label: 'Step back before this turns uglier (+energy)', effectKey: 'withdraw' }
                ]
            };
        }

        if (def.template === 'trusted_ally') {
            if (step === 0) return {
                title: def.title,
                icon: def.icon,
                text: '{npcName} asks for the favor quietly, as if making the request louder would make it cost more. They need help in {townName} now, before pride talks them out of asking. "I know what this will cost you," {npcName} says. "That is why I came to you and not {npc2Name}." It is a dangerous kind of compliment, the sort that lays a stone in your hands and calls it trust.',
                choices: [
                    { id: 'carry_them', label: 'Help {npcName} even though it hurts (-energy, +reputation, +relationship)', effectKey: 'help', nextStepIndex: 1 },
                    { id: 'name_price', label: 'Refuse unless there is profit in it (+gold, damages relationship)', effectKey: 'refuse', nextStepIndex: 1 },
                    { id: 'turn_advantage', label: 'Exploit the need for leverage (+gold, -reputation)', effectKey: 'exploit', nextStepIndex: 1 }
                ]
            };
            if (step === 1) {
                var allyStep1 = 'A few days later, {npcName} returns before dawn while {townName} still smells of baking bread and wet wood. They have not forgotten. Because you answered when it cost you, they now bring a chance to repay the debt: a warehouse key, a guarded introduction through {npc2Name}, a door that would have stayed closed. {npcName} is almost awkward about it, as if gratitude sits heavier on them than any cargo.';
                if (firstChoice === 'name_price') allyStep1 = '{npcName} returns because they are honorable, not because the bond is warm. In the gray light outside {townName}, they hold out repayment with the stiffness of someone settling an account they wish had been friendship. Even so, they remembered your name when they could have remembered only the price. Through {npc2Name}, they can open a profitable door if you let this become more than a transaction.';
                if (firstChoice === 'turn_advantage') allyStep1 = 'You expected {npcName} to vanish after you used their need against them. Instead they return to {townName} with tired eyes and a favor in hand. "I told myself I was done with you," they admit, glancing away. "But you are still the one person who might make this matter count." It is not forgiveness. It is something harsher and more valuable: a second chance you have not earned.';
                return {
                    title: def.title,
                    icon: def.icon,
                    text: allyStep1,
                    choices: [
                        { id: 'trust_returned', label: 'Accept the favor and let trust deepen (+gold, +relationship)', effectKey: 'share', nextStepIndex: 2 },
                        { id: 'thank_generously', label: 'Treat their return as a gift worth honoring (+relationship, +reputation)', effectKey: 'encourage', nextStepIndex: 2 },
                        { id: 'keep_score', label: 'Take the benefit and claim the credit openly (+gold, +reputation)', effectKey: 'claim', nextStepIndex: 2 }
                    ]
                };
            }
            var allyStep2 = '{npcName} comes for you at a run when crisis finally strikes. Something has gone wrong in {townName} and the easiest way out would be for {npcName} to save themselves and let your name sink with the wreckage. They do not. They stand in the open where everyone can see, asking whether you still believe this bond means something. Even {npc2Name} has fallen silent.';
            if (secondChoice === 'keep_score') allyStep2 = 'When the crisis breaks over {townName}, {npcName} arrives with the same expression people wear when they step back into a burning house for someone they are not certain would do the same. You kept score. They remembered. Yet they came anyway. That is what makes this moment hurt.';
            if (secondChoice === 'thank_generously') allyStep2 = 'People will remember this one. {npcName} stands at the gate of {townName}, breathless, refusing the safe road because your fortunes are tied together now. They are afraid. You can see it in the way their hands shake. They stay anyway. Trust has become something with weight.';
            return {
                title: def.title,
                icon: def.icon,
                text: allyStep2,
                choices: [
                    { id: 'stand_together', label: 'Spend yourself to save {npcName} and the bond (-energy, +reputation, +relationship)', effectKey: 'help' },
                    { id: 'take_blow_together', label: 'Support {npcName} publicly and weather the cost (+reputation, +relationship)', effectKey: 'support' },
                    { id: 'save_self', label: 'Let the bond break and protect your own purse (+gold, damages relationship)', effectKey: 'refuse' }
                ]
            };
        }

        if (def.template === 'old_debt') {
            if (step === 0) return {
                title: def.title,
                icon: def.icon,
                text: '{npcName} is waiting where the road bends into {townName}, older than your memory and somehow more recognizable for it. The last time you stood this close, one of you left with fuller hands and the other with the lesson. {npcName} does not waste words. "I have carried this long enough," they say. "Either we settle it, or we admit it has been carrying us." Even {npc2Name}, passing nearby, slows to listen.',
                choices: [
                    { id: 'make_amends', label: 'Hear {npcName} out and try to make this right (-energy, +reputation)', effectKey: 'hear_them_out', nextStepIndex: 1 },
                    { id: 'demand_balance', label: 'Demand repayment now, whatever it costs the bond (+gold, -reputation)', effectKey: 'exact_toll', nextStepIndex: 1 },
                    { id: 'walk_past_history', label: 'Let sleeping dogs lie and leave the debt buried (+gold, -reputation)', effectKey: 'brush_aside', nextStepIndex: 1 }
                ]
            };
            var debtStep1 = '{npcName} meets you in a quiet room above a busy tavern in {townName}. The air smells of dust and cloves. Between you lies a small bundle: maybe coins, maybe letters, maybe the proof that memory has sharper teeth than time. {npcName} is trying not to tremble. Whatever happened between you, it mattered. It still does.';
            if (firstChoice === 'demand_balance') debtStep1 = '{npcName} does not flinch when you name your price in {townName}; that somehow makes it worse. They set down a bundle that looks too light for what was taken and too heavy for what was lost. "If coin is enough," they say, "then you were luckier than I was." The room goes very still.';
            if (firstChoice === 'walk_past_history') debtStep1 = '{npcName} catches you once more before the matter dies. There is no anger in them now, only weariness. In a quiet corner of {townName}, they place the old burden in words you can no longer outrun. "I can live without justice," they say. "What I did not expect was how expensive silence would become."';
            return {
                title: def.title,
                icon: def.icon,
                text: debtStep1,
                choices: [
                    { id: 'forgive_and_mend', label: 'Choose mercy and let the old wound close (+strong reputation, +relationship)', effectKey: 'grant_mercy' },
                    { id: 'take_payment', label: 'Take repayment and call the ledger balanced (+gold, +reputation)', effectKey: 'take_tribute' },
                    { id: 'end_without_peace', label: 'Close the matter without comfort (+energy)', effectKey: 'close_case' }
                ]
            };
        }

        if (def.template === 'forbidden_friendship') {
            if (step === 0) return {
                title: def.title,
                icon: def.icon,
                text: 'You were not meant to like {npcName}. That much is obvious from the way people in {townName} lower their voices when the name comes up: enemy blood, the wrong household, the wrong guild, the wrong side of a knife. And yet {npcName} laughs like someone who has forgotten how to pretend, and when they speak to you the room feels briefly honest. {npc2Name} has already noticed. So have the wrong eyes.',
                choices: [
                    { id: 'meet_in_secret', label: 'Keep seeing {npcName}, no matter what it costs (-energy)', effectKey: 'accept', nextStepIndex: 1 },
                    { id: 'protect_with_distance', label: 'Be warm, but careful enough to shield them (+relationship, +reputation)', effectKey: 'mark_secret', nextStepIndex: 1 },
                    { id: 'profit_from_risk', label: 'Sell the danger for quick coin (+gold, -reputation)', effectKey: 'sell_secret', nextStepIndex: 1 }
                ]
            };
            var forbiddenStep1 = '{npcName} sends for you when rumors finally sharpen into accusation. A whisper has reached the wrong hall, the wrong captain, the wrong spouse. Discovery will not only wound your standing in {kingdomName}; it may ruin {npcName} outright. They do not ask you to be brave for them. They ask you to decide whether what you built was real enough to defend.';
            if (firstChoice === 'protect_with_distance') forbiddenStep1 = 'Because you were careful, the rumor is still only a rumor. Even so, {npcName} meets you with fear plain on their face. "I know what this costs you," they say. "What I do not know is whether I was selfish to want it anyway." In {kingdomName}, discovery would still bite hard. But now the danger has a heartbeat.';
            if (firstChoice === 'profit_from_risk') forbiddenStep1 = 'The coin from the secret is already in your purse when you see {npcName} again. That is what makes the next moment land like a blade. They have heard the rumor, not yet the source, and they are trying so hard to trust you that it becomes painful to watch. In {kingdomName}, discovery is no longer a possibility. It is a clock.';
            return {
                title: def.title,
                icon: def.icon,
                text: forbiddenStep1,
                choices: [
                    { id: 'stand_for_them', label: 'Support {npcName} openly, whatever follows (+reputation, +relationship)', effectKey: 'support' },
                    { id: 'shield_their_name', label: 'Investigate the leak and protect them quietly (-energy)', effectKey: 'investigate' },
                    { id: 'leave_before_fall', label: 'Stay away and leave {npcName} to the consequences (+gold, -relationship)', effectKey: 'stay_away' }
                ]
            };
        }

        if (def.template === 'npc_in_trouble') {
            if (step === 0) return {
                title: def.title,
                icon: def.icon,
                text: '{npcName} is in real trouble this time, the kind that strips pride away and leaves only need. Maybe it is debt, maybe fever, maybe iron bars, maybe the wrong men with rope and patience. What matters is that someone brings their name to you in {townName} because they believe you might still come. {npc2Name} says the clean solution will be expensive. There may not be a clean solution at all.',
                choices: [
                    { id: 'pay_and_go', label: 'Commit your own coin and strength to save {npcName} (-gold, -energy)', effectKey: 'commit', nextStepIndex: 1, requires: { gold: 'costGold' } },
                    { id: 'search_middle_path', label: 'Investigate a clever way out before paying everything (-energy)', effectKey: 'investigate', nextStepIndex: 1 },
                    { id: 'turn_away', label: 'Walk away before their disaster becomes yours (+gold)', effectKey: 'decline', nextStepIndex: 1 }
                ]
            };
            if (step === 1) {
                var troubleStep1 = '{npcName} is worse than the messenger said. In the sickroom, the cell, the debtor yard, or the ruined shop in {townName}, they still try to apologize for needing you. That small attempt at dignity is almost unbearable. {npc2Name} can secure one narrow chance: a bribe, a caravan seat, a physician, a dangerous transfer. It will work only if you choose now.';
                if (firstChoice === 'search_middle_path') troubleStep1 = 'Your search for a middle path turns up one thin thread. {npc2Name} can arrange something clever in {townName}, but clever is not the same thing as safe. When you finally reach {npcName}, they are trying to sit straighter than the moment allows, as if meeting your eyes while broken counts for something. It does.';
                if (firstChoice === 'turn_away') troubleStep1 = 'You tried to leave it alone. Then word came again. {npcName} had asked for no one, but when {npc2Name} described the look on their face at hearing your name, walking away stopped feeling like neutrality. Now you stand in {townName} with one last chance to decide what kind of absence you meant to be.';
                return {
                    title: def.title,
                    icon: def.icon,
                    text: troubleStep1,
                    choices: [
                        { id: 'pull_them_out', label: 'Rescue {npcName} at full cost (-energy, +reputation, +relationship)', effectKey: 'help', nextStepIndex: 2 },
                        { id: 'buy_solution', label: 'Spend the gold and get {npcName} clear (-gold, +items, +relationship)', effectKey: 'buy', nextStepIndex: 2, requires: { gold: 'costGold' } },
                        { id: 'profit_from_fall', label: 'Take what can be salvaged for yourself (+gold, -reputation)', effectKey: 'profit', nextStepIndex: 2 }
                    ]
                };
            }
            var troubleStep2 = '{npcName} survives the worst of it and meets you outside the walls of {townName} when the morning is still pale. They are thinner, tired, and trying not to cry in front of you. "I kept thinking you would not come," {npcName} says. "Then I kept being wrong." That is the kind of sentence a person remembers years later. What happens now decides whether the rescue becomes a bond, a bargain, or a ghost.';
            if (secondChoice === 'profit_from_fall') troubleStep2 = '{npcName} gets out, but not whole. When they find you near {townName}, there is gratitude in their face despite everything, which makes the weight of your earlier choice settle harder. They still believe you mattered in their survival. You must decide whether to deserve that belief or spend it.';
            if (secondChoice === 'buy_solution') troubleStep2 = 'Coin solved what courage could not, but {npcName} knows what you spent and what you risked in {townName}. They meet you in the pale morning carrying nothing but a bundle and a look of raw relief. The world rarely makes room for simple gratitude. This one moment does.';
            return {
                title: def.title,
                icon: def.icon,
                text: troubleStep2,
                choices: [
                    { id: 'ask_nothing', label: 'Tell {npcName} they owe you nothing (+strong reputation, +relationship)', effectKey: 'grant_mercy' },
                    { id: 'let_them_repay', label: 'Let {npcName} repay you and share the burden (+gold, +relationship)', effectKey: 'share' },
                    { id: 'close_wound', label: 'End it here before the debt turns bitter (+energy)', effectKey: 'close_case' }
                ]
            };
        }

        return null;
    }

    var relationshipEventDefinitions = [
        { id: 'market_shadow', title: 'Market Shadow', icon: '🪙', category: 'trade', rarity: 'uncommon', weight: 8, template: 'rival_merchant' },
        { id: 'countinghouse_duel', title: 'Countinghouse Duel', icon: '📒', category: 'trade', rarity: 'rare', weight: 6, template: 'rival_merchant' },
        { id: 'gate_of_two_ledgers', title: 'Gate of Two Ledgers', icon: '🚪', category: 'social', rarity: 'rare', weight: 5, template: 'rival_merchant' },

        { id: 'favor_asked_softly', title: 'Favor Asked Softly', icon: '🤝', category: 'social', rarity: 'common', weight: 10, template: 'trusted_ally' },
        { id: 'ally_keeps_score', title: 'Ally Keeps Score', icon: '🕯️', category: 'context', rarity: 'uncommon', weight: 8, template: 'trusted_ally' },
        { id: 'gate_oath', title: 'Gate Oath', icon: '🛡️', category: 'social', rarity: 'rare', weight: 6, template: 'trusted_ally' },

        { id: 'dust_of_old_promises', title: 'Dust of Old Promises', icon: '📜', category: 'social', rarity: 'uncommon', weight: 8, template: 'old_debt' },
        { id: 'coin_between_you', title: 'Coin Between You', icon: '🧾', category: 'trade', rarity: 'uncommon', weight: 7, template: 'old_debt' },
        { id: 'the_road_remembers', title: 'The Road Remembers', icon: '🛤️', category: 'context', rarity: 'rare', weight: 5, template: 'old_debt' },

        { id: 'enemy_cup_of_wine', title: 'Enemy Cup of Wine', icon: '🍷', category: 'political', rarity: 'rare', weight: 6, template: 'forbidden_friendship' },
        { id: 'guilds_unquiet_whisper', title: 'Guild\'s Unquiet Whisper', icon: '🪡', category: 'trade', rarity: 'uncommon', weight: 7, template: 'forbidden_friendship' },
        { id: 'lantern_after_curfew', title: 'Lantern After Curfew', icon: '🏮', category: 'crime', rarity: 'rare', weight: 5, template: 'forbidden_friendship' },

        { id: 'when_they_send_for_you', title: 'When They Send for You', icon: '🚑', category: 'context', rarity: 'common', weight: 9, template: 'npc_in_trouble' },
        { id: 'rope_and_rain', title: 'Rope and Rain', icon: '⛓️', category: 'crime', rarity: 'rare', weight: 6, template: 'npc_in_trouble' },
        { id: 'the_last_good_name', title: 'The Last Good Name', icon: '🌧️', category: 'social', rarity: 'uncommon', weight: 7, template: 'npc_in_trouble' }
    ];

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {
            relationshipTemplateBlocks: relationshipTemplateBlocks,
            relationshipEventDefinitions: relationshipEventDefinitions
        };
    }
}());
