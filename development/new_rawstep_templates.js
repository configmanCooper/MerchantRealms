var step = instance.stepIndex || 0;
var lead = _sceneLead(def);

// Template: windfall
if (def.template === 'windfall') {
    var wText, wPocket;
    if (def.category === 'crime') {
        wText = lead + ' Rainwater runs black along the cobbles when you spot a coin purse half-hidden beneath a shuttered stall in {townName}. It is heavy enough to matter, and the clasp is stamped with a crest you do not recognize. Somewhere nearby, someone is cursing their loss, while the watch at the end of the lane has seen nothing yet. Fortune has come to you wearing another person\'s grief.';
        wPocket = 'Close your fist over the purse and melt into the crowd (+{goldAmount}g)';
    } else if (def.category === 'trade') {
        wText = lead + ' The counting table at the {townName} exchange is crowded and loud when {npcName} discovers an error in the ledger. They have charged you twice for the same lot, and their face drains white as witnesses begin to notice. With stiff fingers, they count out {goldAmount} gold and push it across the board. You can take the money, turn the moment into goodwill, or leave the merchant to remember your restraint.';
        wPocket = 'Take the refunded coin and let the ledger close (+{goldAmount}g)';
    } else {
        wText = lead + ' A loose stone beside the well in {townName} hides a small cache wrapped in oilcloth. Inside waits a scatter of old gold worth about {goldAmount}, dry despite the morning mist and far too neatly hidden to be random. No one sees you find it, but that silence feels temporary. Luck has opened its hand to you, and now your own hand must answer.';
        wPocket = 'Keep the windfall and say nothing (+{goldAmount}g)';
    }
    return { title: def.title, icon: def.icon, text: wText, choices: [
        { id: 'pocket', label: wPocket, effectKey: 'pocket' },
        { id: 'share', label: 'Call attention to the find and let others share the blessing (+reputation, +relationship)', effectKey: 'share' },
        { id: 'leave', label: 'Leave it where fate put it and walk on (+energy)', effectKey: 'leave' }
    ] };
}

// Template: aid
if (def.template === 'aid') {
    return { title: def.title, icon: def.icon, text: lead + ' {npcName} catches you by the sleeve beside the gate, mud to the knees and panic bright in the eyes. Their handcart has split open in the street, and sacks of grain are spilling into the gutter while teamsters curse and ride around it. If the grain is lost, their household will feel it before the week is done. You can stoop and help, turn the mess into a bargain, or keep walking while everyone watches.', choices: [
        { id: 'help', label: 'Set your shoulder to the cart and help save the grain (-energy, +reputation, +relationship)', effectKey: 'help' },
        { id: 'refuse', label: 'Step around the mess and keep your time for yourself (+gold, -relationship)', effectKey: 'refuse' },
        { id: 'exploit', label: 'Offer help only if the desperation can pay you (+gold, -reputation)', effectKey: 'exploit' }
    ] };
}

// Template: trade_offer
if (def.template === 'trade_offer') {
    return { title: def.title, icon: def.icon, text: lead + ' {npcName} waits in the shadow of the {townName} warehouse with a tarp thrown over a handcart. When they lift it, you glimpse {itemQty} units of {resourceName}, dry and clean and ready to move, worth far more than the whispered price of {costGold} gold. Another buyer pretends not to stare from across the lane, and the dock bell has only just rung. If you want this bargain, you need to decide before the next breath finishes.', choices: [
        { id: 'buy', label: 'Strike hands and take the lot before the other buyer moves (costs {costGold}g, +goods, +relationship)', effectKey: 'buy', requires: { gold: 'costGold' } },
        { id: 'pass', label: 'Let the bargain sail past and keep your purse uncommitted (+energy)', effectKey: 'pass' },
        { id: 'report', label: 'Send word to the market authorities about the suspicious price (+reputation, -relationship)', effectKey: 'report' }
    ] };
}

// Template: social_scene
if (def.template === 'social_scene') {
    var scText;
    if (def.category === 'social') {
        scText = lead + ' Music and lamp-smoke drift through the square as {npcName} falls into step beside you with two cups of spiced wine. Their smile is easy, but their eyes keep searching your face for an answer to some unasked question. Half the town seems to be laughing nearby, which means half the town can also watch what you do next. A warm word could knit a bond tonight; a cruel one could break it in public.';
    } else if (def.category === 'political') {
        scText = lead + ' Silver plate glints beneath candlelight while {npcName} traps you in a courteous conversation no one could mistake for harmless. Every compliment lands like a probe, and every pause gives the listeners around you time to weigh your rank, your loyalties, and your nerve. Somewhere behind the minstrels, a noble coughs to hide interest. You are not merely speaking; you are choosing what story the room will tell about you by morning.';
    } else {
        scText = lead + ' {npcName} approaches at the edge of the street crowd, close enough that only you can hear the first words. There is hope in the set of their shoulders, and fear in how quickly that hope might be embarrassed. A few nearby traders glance over, pretending not to notice. Whatever tone you choose now will travel farther than the conversation itself.';
    }
    return { title: def.title, icon: def.icon, text: scText, choices: [
        { id: 'encourage', label: 'Answer with warmth and invite the moment to deepen (+relationship, +reputation)', effectKey: 'encourage' },
        { id: 'polite', label: 'Keep the exchange gracious but carefully distant (+modest relationship)', effectKey: 'polite' },
        { id: 'cruel', label: 'Cut {npcName} down where everyone can hear it (+gold, -relationship, -reputation)', effectKey: 'cruel' }
    ] };
}

// Template: crime_scene
if (def.template === 'crime_scene') {
    return { title: def.title, icon: def.icon, text: lead + ' {npcName} waits under a crooked lantern where the alley bends out of sight of the main street. Their plan comes out in a whisper: a ledger to steal, a watchman to distract, a door that will stand unbarred for exactly one minute. The money, {goldAmount} gold by their reckoning, is real, but so is the knife-shaped gap in their smile when they say nothing can go wrong. The night smells of wet rope and bad choices.', choices: [
        { id: 'join', label: 'Take the scheme and trust the dark to cover you (+{goldAmount}g, risk of injury, -reputation)', effectKey: 'join' },
        { id: 'refuse', label: 'Leave {npcName} in the alley and keep your hands clean (+gold)', effectKey: 'refuse' },
        { id: 'report_crime', label: 'Go straight to the watch and sell them the whole scheme (+reputation, -relationship)', effectKey: 'report_crime' }
    ] };
}

// Template: skill_test
if (def.template === 'skill_test') {
    return { title: def.title, icon: def.icon, text: lead + ' The square in {townName} has been ringed with rope for a brutal little contest: a sprint across rolling casks, a climb up a greased pole, and a final throw at three bronze targets. The crowd roars every time someone slips, and the prize purse grows more tempting each time the herald rattles it. Win, and you walk away with coin and a story people repeat. Lose, and you may leave with bruised ribs and a bruised name.', choices: [
        { id: 'attempt', label: 'Vault the rope and trust your feet, hands, and nerve (-energy, +gold, chance of injury)', effectKey: 'attempt' },
        { id: 'bet_safe', label: 'Study every mistake from the edge of the crowd (+energy, +modest reputation)', effectKey: 'bet_safe' },
        { id: 'pass', label: 'Keep your pride untested and your bones unbroken (no immediate effect)', effectKey: 'pass' }
    ] };
}

// Template: delayed_notice
if (def.template === 'delayed_notice') {
    if (step === 0) {
        var dnText;
        if (def.category === 'social' || def.category === 'common') {
            dnText = lead + ' {npcName} asks to speak somewhere quieter and keeps wringing their hands even after you stop. A family matter in {townName} is about to come before the elders, but not until {waitDays} days have passed and the right witnesses arrive. If you commit, you tie a piece of your reputation to theirs. If you would rather profit now, there are uglier ways to use what you know.';
        } else if (def.category === 'political') {
            dnText = lead + ' {npcName} draws you behind a tapestry and speaks without ever quite moving their lips. A petition is being carried through {townName}, and in {waitDays} days it will either lift one faction or break it. Your backing could matter when the chamber doors finally open. So could a well-timed betrayal, if gold matters more than patience.';
        } else {
            dnText = lead + ' {npcName} brings you a matter that cannot be solved by sunset. A decision in {townName} is coming, but the people who matter will not gather for {waitDays} days, and until then every promise is a wager. If you lend your name, you share the risk. If you twist the moment now, the profit will come quicker than the consequences.';
        }
        return { title: def.title, icon: def.icon, text: dnText, choices: [
            { id: 'accept', label: 'Tie your name to the outcome and wait for word (+future outcome in {waitDays} days)', effectKey: 'accept', nextStepIndex: 1 },
            { id: 'decline', label: 'Keep your distance and leave the burden to someone else (+gold)', effectKey: 'decline' },
            { id: 'exploit', label: 'Use the uncertainty now while everyone else is still blind (+gold, -reputation)', effectKey: 'exploit' }
        ] };
    }
    return { title: def.title, icon: def.icon, text: 'After {waitDays} days, {npcName} returns with rain on their cloak and news that the matter has broken into the open. People in {townName} know you stood near this business, and now they watch to see whether you mean to be generous, ambitious, or forgettable. There is coin on the table, gratitude in the air, and danger in both. However you finish this, your name will stick to it.', choices: [
        { id: 'claim', label: 'Take public credit and the reward that follows (+{rewardGold}g, +reputation)', effectKey: 'claim' },
        { id: 'spread', label: 'Turn the outcome into a story that lifts everyone involved (+reputation, +relationship)', effectKey: 'spread' },
        { id: 'withdraw', label: 'Step back before the matter asks anything more of you (+energy)', effectKey: 'withdraw' }
    ] };
}

// Template: trade_chain
if (def.template === 'trade_chain') {
    if (step === 0) {
        return { title: def.title, icon: def.icon, text: lead + ' {npcName} unrolls a grease-stained shipping note across a tavern table and taps the line for {resourceName}. A caravan delayed by floodwater will reach {townName} in {waitDays} days, and anyone who buys in now can seize the lot before the guild posts the new price. {costGold} gold is enough to claim a real share, which means enough to hurt if the rumor is false. The candles are burning low, and every trader in the room is pretending not to listen.', choices: [
            { id: 'commit', label: 'Lay down full coin now and trust the rumor to ripen (costs {costGold}g, higher reward in {waitDays} days)', effectKey: 'commit', nextStepIndex: 1, requires: { gold: 'costGold' } },
            { id: 'haggle', label: 'Bargain hard before you risk a single crown (costs {costGold}g, less risk, +relationship)', effectKey: 'haggle', nextStepIndex: 1, requires: { gold: 'costGold' } },
            { id: 'pass', label: 'Leave the speculation to hungrier merchants (no immediate effect)', effectKey: 'pass' }
        ] };
    }
    return { title: def.title, icon: def.icon, text: 'At dawn on the {waitDays}th day, the caravan finally groans through the gate with {resourceName} stacked high under road dust. The market in {townName} lurches around the news, and suddenly the wager you made feels heavy in your hands. You can take an honest profit, strip every last coin from the frenzy, or let the town remember that you did not squeeze it while it was hungry. Fortune has arrived, but so has judgment.', choices: [
        { id: 'unload', label: 'Sell cleanly and take the fair profit while the market is hot (+{rewardGold}g, +{itemQty} {resourceName})', effectKey: 'unload' },
        { id: 'flip', label: 'Drive the price to its cruelest edge before the panic cools (+maximum gold, -reputation)', effectKey: 'flip' },
        { id: 'donate', label: 'Release part of the shipment where need will remember it (+reputation, lighter purse)', effectKey: 'donate' }
    ] };
}

// Template: romance_chain
if (def.template === 'romance_chain') {
    if (step === 0) {
        return { title: def.title, icon: def.icon, text: lead + ' {npcName} does not flirt like someone playing a game. They hold your gaze too long, then look away as though the effort cost them courage. Before parting, they ask whether you would meet them in {waitDays} days, somewhere quiet in {townName} where gossip cannot reach first. A gentle refusal will still sting; a cruel one may turn warmth into an old wound.', choices: [
            { id: 'encourage', label: 'Say yes and let the anticipation grow between now and then (+relationship)', effectKey: 'encourage', nextStepIndex: 1 },
            { id: 'polite', label: 'Refuse softly enough to leave dignity standing (+modest relationship)', effectKey: 'polite' },
            { id: 'cruel', label: 'Cut the feeling off before it can ask anything of you (+gold, -relationship, -reputation)', effectKey: 'cruel' }
        ] };
    }
    return { title: def.title, icon: def.icon, text: 'When the day comes, lanternlight shivers over the water cistern behind the old shrine, and {npcName} is already waiting. They have dressed with care, but one hand still betrays nerves whenever footsteps pass nearby. If you go to them, you may deepen something real. If you arrive bearing a gift, you say even more; if you do not come at all, silence will answer for you.', choices: [
        { id: 'attend', label: 'Keep the meeting and see what might grow there (+relationship, -energy)', effectKey: 'attend' },
        { id: 'bring_gift', label: 'Arrive with a thoughtful gift and make the answer unmistakable (costs {costGold}g, +strong relationship, +reputation)', effectKey: 'bring_gift', requires: { gold: 'costGold' } },
        { id: 'stay_away', label: 'Leave {npcName} alone under the lanterns (+gold, -relationship)', effectKey: 'stay_away' }
    ] };
}

// Template: investigation_chain
if (def.template === 'investigation_chain') {
    if (step === 0) {
        return { title: def.title, icon: def.icon, text: lead + ' The story begins with one bad detail that will not sit still: a locked storeroom opened from the inside, a payment made twice, a witness who lies too smoothly. {npcName}\'s name keeps surfacing in whispers around {townName}, never loudly, never by accident. If you pull on the thread for {waitDays} days, you may find gold, justice, or trouble with a knife in it. If you sell the rumor now, you gain coin and lose the right to know the truth.', choices: [
            { id: 'investigate', label: 'Work the alleys quietly until the truth shows its face (-energy, results in {waitDays} days)', effectKey: 'investigate', nextStepIndex: 1 },
            { id: 'sell_secret', label: 'Sell the lead to someone who wants coin more than clarity (+gold, -reputation)', effectKey: 'sell_secret' },
            { id: 'ignore', label: 'Let the suspicion rot where it lies (no immediate effect)', effectKey: 'ignore' }
        ] };
    }
    return { title: def.title, icon: def.icon, text: 'Your quiet questions have led you to proof: a ledger page torn but not burned, a hidden key, a meeting place no honest business needs. By the time the bells ring, you know exactly how {npcName} is entangled. The evidence is enough to confront, enough to condemn, and enough to profit from if your conscience bends. What you do next will decide whether this ends as justice, leverage, or theft.', choices: [
        { id: 'confront', label: 'Put the proof in {npcName}\'s face and force an answer (+reputation, -relationship, risk of injury)', effectKey: 'confront' },
        { id: 'report_crime', label: 'Hand everything to the authorities and let the law bite (+reputation, -relationship)', effectKey: 'report_crime' },
        { id: 'pocket', label: 'Take what value the truth offers and vanish with it (+gold)', effectKey: 'pocket' }
    ] };
}

// Template: war_chain
if (def.template === 'war_chain') {
    if (step === 0) {
        return { title: def.title, icon: def.icon, text: lead + ' A mud-spattered rider brings {npcName}\'s plea before the sun is properly up. The companies on the road outside {townName} are short of food, short of bandages, and burying men faster than scribes can write the names. What you send now will reach the front in {waitDays} days, when it may mean a shield held, a wound closed, or a line broken. You can give from duty, deal from advantage, or keep your wagons far from the killing.', choices: [
            { id: 'assist', label: 'Send what is needed because the line must hold (-energy, +reputation)', effectKey: 'assist', nextStepIndex: 1 },
            { id: 'profit', label: 'Supply the war, but make certain the ledger smiles too (+gold, -reputation)', effectKey: 'profit', nextStepIndex: 1 },
            { id: 'decline', label: 'Keep your people and wagons clear of the battlefield (+gold)', effectKey: 'decline' }
        ] };
    }
    return { title: def.title, icon: def.icon, text: 'The messenger who returns from the front looks older than when they left. They say your choice mattered: a company held, wounded soldiers lived through the night, and officers in {kingdomName} have spoken your name over maps stained with candle grease. Now a reward is offered, and even this peaceable moment feels sharp with memory. Take gold, give it to those who bled, or turn victory into a favor that may save lives later.', choices: [
        { id: 'accept_reward', label: 'Take the reward and let the realm see who answered the call (+{rewardGold}g, +reputation)', effectKey: 'accept_reward' },
        { id: 'donate_reward', label: 'Send the reward to the wounded and the widowed (+strong reputation)', effectKey: 'donate_reward' },
        { id: 'ask_for_favor', label: 'Ask for a debt of honor instead of coin (+relationship, +reputation)', effectKey: 'ask_for_favor' }
    ] };
}

// Template: political_chain
if (def.template === 'political_chain') {
    if (step === 0) {
        return { title: def.title, icon: def.icon, text: lead + ' {npcName} invites you to speak beneath music loud enough to hide treason. A vote, appointment, or accusation will turn the court of {kingdomName} within {waitDays} days, and they want your weight on the scale before anyone else knows it is moving. If the play succeeds, new doors open; if it fails, old enemies will remember your face. You can back the scheme, sell the whisper, or keep your hands clean while others gamble with crowns.', choices: [
            { id: 'support', label: 'Lend your influence and help shove the balance their way (+reputation, +relationship)', effectKey: 'support', nextStepIndex: 1 },
            { id: 'leak', label: 'Carry the secret to the other side while it still buys well (+gold, -reputation)', effectKey: 'leak' },
            { id: 'decline', label: 'Step out before intrigue fastens itself to your name (+gold)', effectKey: 'decline' }
        ] };
    }
    return { title: def.title, icon: def.icon, text: 'By the time the news is public, three powerful people are smiling too hard and one has stopped smiling entirely. {npcName}\'s maneuver has changed the balance in {kingdomName}, and your part in it is no longer invisible. Reward waits for you, but so does envy. Press forward boldly, accept a quieter payoff, or step back before success paints a target on your cloak.', choices: [
        { id: 'press_advantage', label: 'Push while the door is open and take the larger prize (+{rewardGold}g, +reputation)', effectKey: 'press_advantage' },
        { id: 'take_gift', label: 'Accept the discreet gift and leave the spotlight to others (+gold, -modest reputation)', effectKey: 'take_gift' },
        { id: 'step_back', label: 'Fade from the board before the knives come out (+energy)', effectKey: 'step_back' }
    ] };
}

// Template: rank_chain
if (def.template === 'rank_chain') {
    if (step === 0) {
        var rkText;
        if (def.category === 'social' || def.category === 'common') {
            rkText = lead + ' {npcName} bows a little too deeply when they reach you, and everyone nearby notices. They have brought a petition that would never be heard from common lips unless someone of standing chose to listen. The request is not small, and granting even your attention will spend time and face alike. In this square, mercy looks like strength, but so does reminding people that rank has a price.';
        } else {
            rkText = lead + ' {npcName} approaches with the careful posture of someone who knows one wrong word can offend power. What they bring is half petition, half test: a matter of privilege, precedence, and who may ask what of whom in {townName}. The onlookers are already measuring you by how long you make them wait. You can hear them fully, tax them for the honor, or dismiss them hard enough that everyone learns the lesson.';
        }
        return { title: def.title, icon: def.icon, text: rkText, choices: [
            { id: 'hear_them_out', label: 'Grant a serious hearing and spend the weight of your name (-energy, +reputation)', effectKey: 'hear_them_out', nextStepIndex: 1 },
            { id: 'exact_toll', label: 'Make them pay for the privilege of your attention (+gold, -reputation)', effectKey: 'exact_toll', nextStepIndex: 1 },
            { id: 'brush_aside', label: 'Dismiss the matter before it costs you another breath (+gold, -reputation)', effectKey: 'brush_aside' }
        ] };
    }
    if (def.category === 'social' || def.category === 'common') {
        return { title: def.title, icon: def.icon, text: 'By evening, the story has traveled all through {townName}. People say you gave {npcName} a hearing when you had every excuse to do otherwise, and now gratitude has begun to gather around your name. You can answer that gratitude with open generosity, let it take the shape of a proper reward, or close the matter before it grows into obligation. Standing is never only what you are called; it is what others remember you doing.', choices: [
            { id: 'grant_mercy', label: 'Answer gratitude with generosity and a steady hand (+strong reputation, +relationship)', effectKey: 'grant_mercy' },
            { id: 'take_tribute', label: 'Accept a fitting tribute for time only you could give (+{rewardGold}g, +reputation)', effectKey: 'take_tribute' },
            { id: 'close_case', label: 'End the matter neatly before it becomes another chain (+energy)', effectKey: 'close_case' }
        ] };
    }
    return { title: def.title, icon: def.icon, text: 'The matter has become public, and now every tavern in {townName} has an opinion about it. Some call your handling just, others call it calculated, and all of them are watching for the final act. Mercy will earn praise, tribute will affirm your station, and silence will end the spectacle on your terms. Even restraint can look like power when enough eyes are on you.', choices: [
        { id: 'grant_mercy', label: 'Show mercy where everyone can see what kind of power you choose (+strong reputation, +relationship)', effectKey: 'grant_mercy' },
        { id: 'take_tribute', label: 'Collect the tribute due to a person of your standing (+{rewardGold}g, +reputation)', effectKey: 'take_tribute' },
        { id: 'close_case', label: 'Shut the door on the affair and deny the crowd an ending (+energy)', effectKey: 'close_case' }
    ] };
}

// Template: mystic_chain
if (def.template === 'mystic_chain') {
    if (step === 0) {
        return { title: def.title, icon: def.icon, text: lead + ' At dusk, a dog refuses to cross one particular doorway in {townName}, and the old woman sweeping nearby makes a sign against evil when she sees you notice. {npcName} swears the same three knocks came at their shutters last night, though no one stood outside. The air smells of rain and tallow, and every sound after that seems a little too clear. You can follow the omen, listen without surrendering to it, or laugh loudly enough to drown your own unease.', choices: [
            { id: 'heed', label: 'Follow the sign before courage has time to cool (-energy)', effectKey: 'heed', nextStepIndex: 1 },
            { id: 'listen', label: 'Hear the story out and keep one hand on doubt (+reputation)', effectKey: 'listen', nextStepIndex: 1 },
            { id: 'mock', label: 'Scoff at the fear and leave the town to its superstition (+gold, -reputation)', effectKey: 'mock' }
        ] };
    }
    return { title: def.title, icon: def.icon, text: 'After {waitDays} days, the disturbance returns with teeth. Windows frost from the inside, strangers repeat words you spoke in private, and {npcName} refuses to sleep without a lamp burning. Whatever began as rumor now presses against the edges of ordinary life in {townName}. Follow it to the source, buy wards and smother it, or turn your back before it learns your name.', choices: [
        { id: 'follow', label: 'Track the omen to whatever is bold enough to cast it (+gold, risk of injury)', effectKey: 'follow' },
        { id: 'ward', label: 'Buy wards and nail them over every threshold (costs {costGold}g, +energy)', effectKey: 'ward', requires: { gold: 'costGold' } },
        { id: 'refuse', label: 'Refuse the call and trust distance to save you (+gold)', effectKey: 'refuse' }
    ] };
}

// Template: skill_chain
if (def.template === 'skill_chain') {
    if (step === 0) {
        return { title: def.title, icon: def.icon, text: lead + ' Notices have been nailed to every post in {townName}: the guild is holding a formal contest in {waitDays} days, with judges coming from outside the walls and pride worth almost as much as the purse. Bakers boast, fencers preen, and scribes rehearse speeches in the street. If you enter now, you bind your name to the performance before the crowd ever sees it. You can commit, study from the edge, or spare yourself the spectacle.', choices: [
            { id: 'accept', label: 'Enter your name and stand before the judges when the day comes (+future contest in {waitDays} days)', effectKey: 'accept', nextStepIndex: 1 },
            { id: 'bet_safe', label: 'Watch the field and learn what the winners know (+energy, +reputation)', effectKey: 'bet_safe' },
            { id: 'decline', label: 'Keep your craft private and your pride untested (+gold)', effectKey: 'decline' }
        ] };
    }
    return { title: def.title, icon: def.icon, text: 'When the day arrives, the hall is packed shoulder to shoulder, hot with lamp smoke and expectation. Your rivals stand in their best clothes, pretending confidence while the judges whisper behind polished tablets. You have done enough to matter; now the prize can crown you, unite the room, or prove you are strong enough not to clutch at applause. In contests like this, the last gesture is often remembered longer than the winning one.', choices: [
        { id: 'collect_prize', label: 'Take the purse and let the victory be seen (+{rewardGold}g, +reputation)', effectKey: 'collect_prize' },
        { id: 'share_credit', label: 'Name the hands that helped you reach the dais (+reputation, +relationship)', effectKey: 'share_credit' },
        { id: 'walk', label: 'Leave the glory on the stage before it owns you (+energy)', effectKey: 'walk' }
    ] };
}

// Template: context_chain
if (def.template === 'context_chain') {
    if (step === 0) {
        return { title: def.title, icon: def.icon, text: lead + ' Trouble has broken loose in {townName}, and it wears the kind of face merchants cannot ignore: empty stalls, frightened families, and angry voices rising faster than answers. {npcName} meets you in the street with ash on their sleeves and asks you to do more than merely witness it. If you step in, you spend yourself for people who may never repay you. If you profit instead, you may fill your purse while the town keeps score.', choices: [
            { id: 'intervene', label: 'Step into the middle of the crisis and bear some of its weight (-energy, +reputation)', effectKey: 'intervene', nextStepIndex: 1 },
            { id: 'profit', label: 'Turn confusion into leverage while everyone is desperate (+gold, -reputation)', effectKey: 'profit', nextStepIndex: 1 },
            { id: 'observe', label: 'Stay clear of the crush and watch before you commit (+energy)', effectKey: 'observe' }
        ] };
    }
    return { title: def.title, icon: def.icon, text: 'The crisis has finally broken, though not cleanly. In the quieter streets of {townName}, people can point to what you did, what you took, or where you stood aside. A reward is pressed on you with tired hands, and the town itself feels like it is waiting to see whether you will keep giving. Take the money, pour coin back into the recovery, or leave before gratitude curdles into dependence.', choices: [
        { id: 'take_reward', label: 'Accept the reward and let the matter end there (+{rewardGold}g)', effectKey: 'take_reward' },
        { id: 'reinvest', label: 'Put coin back into the town while the wounds are still fresh (costs {costGold}g, +strong reputation)', effectKey: 'reinvest', requires: { gold: 'costGold' } },
        { id: 'leave', label: 'Slip away before one favor becomes ten (+energy)', effectKey: 'leave' }
    ] };
}

// Template: long_omen
if (def.template === 'long_omen') {
    if (step === 0) {
        return { title: def.title, icon: def.icon, text: lead + ' The first sign comes in a dream so ordinary it is worse than nightmare: your own room, your own bed, and a second set of breathing somewhere just outside sight. At dawn, the same spiral you saw in sleep is found scratched into a door near the market. {npcName} insists it was not there yesterday. You can step toward the omen or laugh it down before fear roots too deeply.', choices: [
            { id: 'heed', label: 'Step toward the omen before daylight makes you doubt it (+future omen)', effectKey: 'heed', nextStepIndex: 1 },
            { id: 'mock', label: 'Laugh at the sign and deny it room in your thoughts (-reputation)', effectKey: 'mock' }
        ] };
    }
    if (step === 1) {
        return { title: def.title, icon: def.icon, text: 'After {waitDays} days, the shape of the thing begins to repeat. A child in the square hums the melody from your dream, an old beggar wears {npcName}\'s dead mother\'s smile for half a heartbeat, and footsteps follow you through empty alleys without ever closing the distance. Sleep no longer clears the mind; it only opens another door. Listen more closely, or refuse the pattern before it tightens.', choices: [
            { id: 'listen', label: 'Listen for the pattern and let it lead you deeper (+reputation)', effectKey: 'listen', nextStepIndex: 2 },
            { id: 'refuse', label: 'Break away now before curiosity becomes a leash (no immediate effect)', effectKey: 'refuse' }
        ] };
    }
    if (step === 2) {
        return { title: def.title, icon: def.icon, text: 'After another {waitDays2} days, the omen stops borrowing shadows and starts taking room in the world. The spiral appears in flour dust, frost, and spilled wine, and strangers in {townName} turn their heads together when your name is spoken. Even the priests have begun speaking softly around you. Follow the sign to where it wants you, or buy wards and pray wood, silver, and salt can bar what has learned the threshold.', choices: [
            { id: 'follow', label: 'Go where the sign points, even if it points below the town (+gold, risk of injury)', effectKey: 'follow', nextStepIndex: 3 },
            { id: 'ward', label: 'Buy wards and try to nail shut whatever has opened (costs {costGold}g)', effectKey: 'ward', requires: { gold: 'costGold' } }
        ] };
    }
    if (step === 3) {
        return { title: def.title, icon: def.icon, text: 'The trail ends beneath {townName}, where old stone drinks the lanternlight and every sound returns a moment late. There you find the heart of the omen: not a beast, not a ghost, but a presence wrapped around something valuable and terribly patient, as if it has been waiting for someone foolish enough to call discovery a gift. It can make you richer, more famous, or simply more marked. Claim it, turn the story loose on the town, or back away while your shadow still belongs to you.', choices: [
            { id: 'claim', label: 'Take what the darkness guards and bear the cost openly (+{rewardGold}g, +reputation)', effectKey: 'claim', nextStepIndex: 4 },
            { id: 'spread', label: 'Carry the tale upward and let the whole town live with it (+reputation, +relationship)', effectKey: 'spread', nextStepIndex: 4 },
            { id: 'withdraw', label: 'Retreat while retreat is still possible (+energy)', effectKey: 'withdraw' }
        ] };
    }
    return { title: def.title, icon: def.icon, text: 'By morning, the haunting has withdrawn, but it has not left things unchanged. Dogs snarl at empty corners, people in {townName} lower their voices when you pass, and sometimes you catch that spiral where no hand could have drawn it. A final reward remains, along with the choice of whether the truth dies with you or grows legs in the mouths of others. Whatever you choose, this town will carry the scar.', choices: [
        { id: 'take_reward', label: 'Take the last reward and call the horror worth surviving (+{rewardGold}g)', effectKey: 'take_reward' },
        { id: 'mark_secret', label: 'Bury the truth in your own keeping and spare the town a little fear (+relationship, +reputation)', effectKey: 'mark_secret' },
        { id: 'leave', label: 'Leave the scar covered and walk away while you still can (+energy)', effectKey: 'leave' }
    ] };
}

return { title: def.title, icon: def.icon, text: lead, choices: [{ id: 'leave', label: 'Move on', effectKey: 'leave' }] };
