var RESULT_NARRATIVES = {
    pocket: {
        default: 'You close your hand over the find before anyone else sees it. By the time the shouting starts in {townName}, you and the gold are already moving in different directions, and {npcName} learns too late how quick fortune can turn.',
        crime: 'You strip the useful bits from the mess and leave {npcName} to explain the rest. A watchman at the corner studies you for a beat, then looks away with a crooked smile, which somehow feels worse than an accusation.',
        trade: 'You accept the silver and keep the market moving. {npcName} forces a merchant smile, but by sundown half of {townName} knows exactly who kept every last coin.',
        social: 'You tuck the gift away before courtesy can make demands of you. {npcName} notices, and the room in {townName} grows a little colder even while your purse grows heavier.'
    },
    share: {
        default: 'You split the windfall instead of closing your fist around it. {npcName} stares at you as if you had performed a trick, then laughs loud enough for half of {townName} to hear, and the story starts traveling before you do.',
        trade: 'You pass part of the gain across the stall and call it fair. {npcName} tells three merchants before the hour is out, and by sunset a baker throws in an extra loaf just to see if the tale is true.',
        social: 'You make a generous show of it in the square at {townName}. A child copies your grand hand gesture behind your back, making the crowd laugh, and somehow that only makes the moment warmer.'
    },
    leave: {
        default: 'You leave the matter where you found it and keep walking through {townName}. The day folds closed behind you, and whatever trouble was forming chooses someone else instead.',
        common: 'You decide that not every small wonder needs your fingerprints on it. {npcName} watches you go with puzzled respect, as if restraint were stranger than greed.',
        context: 'You step aside before the whole thing can become your burden. By evening the people of {townName} have found a new topic, and your name is not tangled in it.',
        supernatural: 'You turn your back on the sign and refuse to feed it with attention. The wind off the street feels colder for three steps, then even that passes, and {townName} returns to the ordinary noise of wagons and voices.'
    },
    help: {
        default: 'You stay and do the hard work with {npcName} until the problem finally yields. Word runs ahead of you through {townName}, and by the time you leave, strangers are nodding as though they had been there.',
        war: 'You put your shoulder to the labor and keep the line from breaking. {npcName} salutes you with shaking hands, and even the hard-eyed quartermaster in {townName} softens enough to call you by name.',
        social: 'You help {npcName} in plain sight, with no thought of what it will earn. People nearby notice the choice, and a warmth settles over the moment that feels sturdier than praise.'
    },
    refuse: {
        default: 'You let {npcName} finish, then step away before their need can become your duty. The time you save turns into coin before nightfall, but in {townName} people remember how quickly you turned your face aside.',
        crime: 'You refuse the offer and keep your hands clean, at least this time. {npcName} spits in the dust behind you, while a bored guard by the gate gives you a tiny approving nod and pretends he saw nothing.',
        supernatural: 'You refuse the call and give the dark corners of {townName} nothing more. The omen does not strike you down, but {npcName} looks at you as if you abandoned a door that should never have been left open.',
        social: 'You leave {npcName} standing in the square with their pride exposed. You gain a freer day and a heavier purse, but every greeting in {townName} feels a shade more formal after that.'
    },
    exploit: {
        default: 'You see the weakness in the moment and turn it into profit before anyone can stop you. {npcName} understands what you did a breath too late, and the people of {townName} remember the sharpness of it.',
        social: 'You turn sympathy into leverage with a smile so neat it almost passes for kindness. {npcName} gives you what you want, but the whispers that follow you through {townName} are not admiring ones.',
        political: 'You take the loose thread in {kingdomName} politics and pull until gold falls out. The move is clever enough to work and cold enough to spread, and by supper {npcName} knows exactly who profited.',
        context: 'While others argue over what is right, you quietly take what can be gained. {townName} solves the crisis without your conscience, and your ledger looks better for it.'
    },
    buy: {
        default: 'You count out the coin and close the bargain with {npcName}. The {itemQty} {resourceName} are yours, and several people in {townName} suddenly become very interested in whether you know something they do not.',
        trade: 'You buy the {resourceName} before the other bidders can elbow in. {npcName} looks relieved, the warehouse boys scramble, and one jealous merchant starts asking around {townName} about who tipped you first.',
        war: 'You secure the goods while the need is still urgent and the price still sane. By the time the carts roll out of {townName}, soldiers are blessing your timing and cursing everyone slower.'
    },
    pass: {
        default: 'You let the chance go by and keep your balance. {npcName} shrugs, {townName} keeps moving, and you walk away with your strength intact and no fresh trouble tied to your name.',
        trade: 'You leave the bargain on the table and trust another deal will come. Two merchants instantly begin circling {npcName} like gulls over fish, which is proof enough that you were right to avoid the scramble.',
        skill: 'You choose not to play to the crowd today. A few hotheads in {townName} call that caution, but the healer with the broken nose looks almost impressed.',
        common: 'You decide the moment is not worth the weight it would put on your day. {npcName} finds another answer, and you keep walking.'
    },
    report: {
        default: 'You bring the matter to the proper ears and make sure your name is attached to the truth. By sunset officials in {townName} are asking sharper questions, and {npcName} is learning how quickly a quiet problem can become public.',
        trade: 'You report the crooked deal before it can spread through the market. The scales get inspected, the shutters come down on one stall, and a fishmonger nearby mutters that you have ruined a perfectly good afternoon.',
        political: 'You carry the information upward instead of selling it sideways. {npcName} is not grateful, but the people who matter in {kingdomName} now know you chose order over profit.'
    },
    encourage: {
        default: 'You answer {npcName} with warmth instead of caution, and the whole exchange steadies into something real. By the end of the day, {townName} seems a friendlier place, mostly because people saw you make it so.',
        social: 'You give {npcName} the kind of answer that invites hope rather than guessing. A woman at the next table smiles into her cup, and before long the tavern in {townName} is treating your names like the start of a story.',
        political: 'You encourage {npcName} in measured words that still land like a promise. Courtiers remember restraint more than flattery, and in {kingdomName} that may prove the wiser gift.'
    },
    polite: {
        default: 'You keep the exchange courteous and firm, giving {npcName} no wound to carry away. The moment closes cleanly, and even in a town as talkative as {townName}, there is little cruel for anyone to repeat.',
        social: 'You answer with enough kindness to spare {npcName} embarrassment and enough distance to protect yourself. The bystanders in {townName} get no scene to feed on, which disappoints them terribly.',
        political: 'You choose formal grace over heat. {npcName} leaves with their dignity, and the hall in {kingdomName} notes that you can refuse without making an enemy of the room.'
    },
    cruel: {
        default: 'You cut {npcName} down in front of witnesses and take the small advantage that follows. The laugh you get in the moment is thin, and the silence that settles over {townName} afterward lasts longer than the coin feels heavy.',
        social: 'Your words land hard enough to make {npcName} go pale. Someone nearby coughs to hide their discomfort, and later half of {townName} repeats your line with less admiration than fear.',
        political: 'You humiliate {npcName} so cleanly that no one can pretend it was an accident. The court remembers the display, and even those who profit from it step a little more carefully around you.'
    },
    join: {
        default: 'You take {npcName} up on the risk and step into the work before doubt can catch you. The gold comes fast, but so do the eyes of people in {townName} who know a dangerous choice when they see one.',
        crime: 'You slip into the scheme with {npcName} and learn quickly why alley deals pay well. By dawn you have the coin, a racing pulse, and the strong suspicion that at least one guard in {townName} now recognizes your walk.',
        political: 'You commit to the dirty work behind the polished words. {npcName} pays well, but in {kingdomName} favors born in shadow have a habit of returning with sharper edges.'
    },
    report_crime: {
        default: 'You take what you know to the watch and let the law do the loud part. Before long {npcName} is answering difficult questions in {townName}, and your own name rises a little cleaner for it.',
        crime: 'You find the watch captain, lay out the scheme, and send the whole affair crashing down. One young guard tries to look stern and fails so badly he nearly winks, which somehow makes the arrest in {townName} feel even more final.',
        political: 'You hand the evidence upward instead of burying it. {npcName} loses room to maneuver, and the people tracking power in {kingdomName} mark you as someone who can be trusted with ugly truths.'
    },
    accept: {
        default: 'You accept and let the matter fasten itself to your future. {npcName} leaves {townName} lighter than they arrived, while you carry the weight of what comes next.',
        social: 'You give {npcName} your word, and that matters more than the details just now. The promise begins as a quiet thing in {townName}, but even quiet promises can move people.',
        political: 'You accept the arrangement knowing it will not stay private for long. Somewhere in {kingdomName}, someone just gained an ally and someone else gained a reason to watch you.',
        skill: 'You enter your name and feel the challenge become real. From that moment on, every craftsman in {townName} seems to have an opinion about your chances.'
    },
    decline: {
        default: 'You refuse without making a scene and keep your own road clear. {npcName} must look elsewhere, and the gold or effort you keep back stays safely under your control.',
        war: 'You stay out of the campaign and let other people chase glory. Some in {townName} call it caution, others call it selfishness, but none of them are spending your strength.',
        political: 'You step clear of the scheme before it can stain your sleeves. {npcName} masks disappointment behind courtesy, and {kingdomName} keeps spinning without your hand on the wheel.',
        skill: 'You decline the competition and spare yourself the theater of public judgment. A few rivals in {townName} look almost offended that you would not give them the chance to beat you.'
    },
    claim: {
        default: 'You claim what was earned and do it in the open. {npcName} cannot deny your part in the outcome, and the people of {townName} leave with a clear story and your name attached to the winning end of it.',
        social: 'You step forward when thanks are offered and accept them with steady hands. The moment lands cleanly in {townName}, and even those who envy you cannot say you did not earn it.',
        supernatural: 'You take the reward from the strange thing at the heart of it and do not flinch. The tale spreads through {townName} before sunset, half calling you brave and half wondering what else came home with you.',
        rank: 'You accept the due owed to your station and let the square watch it happen. {npcName} bows, the crowd measures the moment, and your standing in {townName} hardens into something difficult to ignore.'
    },
    spread: {
        default: 'You turn the outcome into a story and make sure it travels farther than the coin would have. {npcName} becomes part of the telling, and {townName} begins repeating the version of events that favors warmth over profit.',
        social: 'You share the tale with just enough modesty to make people believe every word. By nightfall a brewer in {townName} is already telling it louder than you did and improving the ending with each mug.',
        supernatural: 'You tell people what happened, and the telling itself changes the town. Some in {townName} laugh, some leave charms on their doors, and {npcName} discovers that fear can travel faster than truth.',
        political: 'You spread the story carefully, knowing that reputation is a blade. By the time the rumor reaches the far halls of {kingdomName}, it cuts in exactly the direction you intended.'
    },
    withdraw: {
        default: 'You step back before victory can become obligation. {npcName} is left with an ending instead of a debt, and {townName} moves on without learning how much more you might have taken.',
        supernatural: 'You leave the strange prize where it lies and walk out while the air is still thin with it. Even {npcName} seems relieved, and {townName} is spared one more story it would not know how to carry.',
        political: 'You withdraw before allies can become petitioners and rivals can become hunters. In {kingdomName}, restraint is rare enough to look almost like wisdom.'
    },
    commit: {
        default: 'You put real coin behind the promise and make the venture yours. {npcName} sees that you believe in the outcome, and suddenly half of {townName} wants to know whether they should believe too.',
        trade: 'You commit at full price and lock in the deal before the market can twitch away from you. The scribes note your name, the dockhands start betting on the shipment, and {npcName} walks straighter for having your backing.',
        war: 'You invest while everyone else is still deciding whether the risk is worth the fear. In hard times around {townName}, that kind of certainty looks either heroic or very expensive.'
    },
    haggle: {
        default: 'You slow the bargain down until the numbers make sense. {npcName} protests, then relents, and both of you leave knowing the deal survived because you demanded better terms instead of kinder words.',
        trade: 'You pick through the price one coin at a time until {npcName} finally laughs and gives in. A spice merchant nearby applauds with two fingers against his ledger, which is the market way of calling you vicious and impressive.',
        political: 'You bargain hard without ever raising your voice. By the end, {npcName} understands that in {kingdomName} you can be courteous and still take the larger share.'
    },
    unload: {
        default: 'You sell the goods cleanly and at the right moment. The coin comes in, the stock clears out, and {townName} decides you are the sort of merchant who knows exactly when to hold and when to let go.',
        trade: 'You move the {resourceName} fast while demand is still hungry. {npcName} watches the crates vanish, and a competitor across the square mutters that you have robbed the market without breaking a single law.',
        war: 'You release the goods where they will matter most and take a fair profit for it. The buyers in {townName} grumble at the price until they remember how badly they need what you brought.'
    },
    flip: {
        default: 'You waste no time and squeeze every possible coin from the moment. {npcName} cannot argue with the speed of it, but the people in {townName} remember how sharply you cut your profit from the situation.',
        trade: 'You turn the shipment almost before the dust settles on the cart wheels. The money is excellent, the goodwill is not, and one old merchant in {townName} calls it beautiful work in the same tone he might use for a knife.',
        context: 'While others are still deciding what is proper, you sell high and leave them to sort out the feelings later. It is efficient, profitable, and not at all the kind of thing {townName} forgets quickly.'
    },
    donate: {
        default: 'You part with a share of the gain and make the day better for someone besides yourself. {npcName} looks at you with startled gratitude, and the kindness echoes through {townName} farther than the goods ever would.',
        trade: 'You set aside part of the {resourceName} instead of chasing every last coin. The bakers and laborers of {townName} notice immediately, and a merchant who expected ruthlessness has to revise their story about you.',
        war: 'You send the value onward to people carrying heavier burdens than yours. When the news reaches {townName}, even hard soldiers speak of the choice with something close to tenderness.',
        context: 'You give when it would have been easier to profit, and that changes the mood of the whole street. {npcName} is not the only one who remembers it.'
    },
    attend: {
        default: 'You keep your word and show up for {npcName}. Whatever uncertainty hung between you in {townName} settles into something steadier once you arrive.',
        social: 'You meet {npcName} where the lamps burn low and the noise of {townName} cannot reach as easily. The conversation is awkward for all of three breaths, then real, and the night leaves both of you changed.',
        political: 'You attend the meeting knowing every smile may be carrying a second meaning. {npcName} notices that you came anyway, and in {kingdomName} that sort of courage can be more valuable than agreement.'
    },
    bring_gift: {
        default: 'You arrive with more than words, and the gesture lands exactly as intended. {npcName} is caught off guard in the best way, and by the end of the meeting the people of {townName} are already improving the story in your favor.',
        social: 'You place the gift in {npcName} hands before either of you can retreat into formality. A serving girl in the corner pretends not to watch and then immediately runs off to tell someone, which means half of {townName} will know by morning.',
        political: 'You bring a gift chosen with care and just enough expense to be noticed. In {kingdomName}, that kind of move reads as respect, confidence, and a warning that you understand the game.'
    },
    stay_away: {
        default: 'You do not come, and silence does the speaking for you. {npcName} waits longer than they should in {townName}, and the hurt hardens into something that will not be easily talked away.',
        social: 'The lantern burns low, the table stays empty, and {npcName} eventually walks home alone through {townName}. You gain the evening and keep your purse full, but the next meeting will begin with a wound.',
        political: 'You stay clear of the appointment and let the alliance die before it forms. {npcName} will remember the insult, and in {kingdomName} absences can be louder than shouted refusals.'
    },
    investigate: {
        default: 'You choose patience over comfort and start pulling on the thread. {npcName} may not know it yet, but in {townName} secrets are easiest to catch just before they think they are safe.',
        crime: 'You spend the days asking quiet questions in loud places and listening where thieves assume no one respectable would linger. By the time you are done, {npcName} has left a trail through {townName} even a sleepy guard could follow.',
        political: 'You investigate without announcing it, which is the only way such work survives. In {kingdomName}, truth rarely hides alone; it keeps company with favors, debts, and frightened men.'
    },
    sell_secret: {
        default: 'You trade truth for immediate coin and let someone else decide what to do with it. {npcName} may never prove your part, but the smell of betrayal hangs around the deal all the same.',
        crime: 'You sell the lead in a back room and watch it leave your hands for a heavier purse. Before night is over, three different people in {townName} know the secret and none of them learned it from you.',
        political: 'You turn privileged knowledge into profit and trust the damage to spread on its own. It is a dangerous business in {kingdomName}, because information remembers who sold it first.'
    },
    ignore: {
        default: 'You decide the trouble belongs to someone else and keep moving. {npcName} fades back into the life of {townName}, and whatever answer might have been yours never gets the chance to prove it.',
        crime: 'You see the thread and choose not to pull it. In a city street that can pass for wisdom, but if {npcName} does harm again in {townName}, you will remember this moment.',
        supernatural: 'You ignore the sign and give it no room in your thoughts. Even so, every odd noise in {townName} feels like a question you chose not to answer.',
        social: 'You leave {npcName} to manage their own entanglement and spare yourself the mess. The cost is simple: you keep your time, and lose the chance to be remembered kindly.'
    },
    confront: {
        default: 'You take the matter straight to {npcName} and force it into the open. People in {townName} notice the nerve of it, and whether the scene ends in truth or bruises, no one can call you timid.',
        crime: 'You corner {npcName} with evidence and nowhere easy to run. The alley grows very quiet, then very dangerous, and afterward even the dockhands of {townName} speak your name with a little more care.',
        political: 'You confront {npcName} directly instead of hiding behind rumor. That sort of boldness unsettles a court, and by the end of the day {kingdomName} is asking whether you are principled or merely fearless.'
    },
    assist: {
        default: 'You put your strength where it is needed and do not keep count while you are doing it. {npcName} sees the cost to you, and {townName} remembers that you answered before anyone made you.',
        war: 'You send labor, goods, and will toward the fighting until the whole effort starts moving better. When the report comes back through {townName}, it carries your name beside the kind of thanks soldiers do not waste.',
        context: 'You choose action over comfort and help steady a bad situation. That choice becomes the part of the story {townName} repeats.'
    },
    profit: {
        default: 'You help just enough to keep things moving and make sure the ledger rewards you for the trouble. {npcName} gets what they needed, but {townName} can tell the difference between service and calculation.',
        war: 'You supply the effort, take your cut, and call it practical. The realm may still benefit, but the veterans coming back through {townName} know exactly which kind of help you offered.',
        context: 'You find the angle in the chaos and take it cleanly. People are relieved the crisis ended and slightly offended by how much richer you became in the process.',
        trade: 'You turn disorder into margin with the instincts of a born merchant. A grain seller in {townName} calls it smart business, then lowers his voice before the widows can hear.'
    },
    accept_reward: {
        default: 'You accept the reward with no false modesty. {npcName} seems glad the debt is settled openly, and {townName} approves of a person who knows both service and worth.',
        war: 'You take the purse from hands that have seen too much and do it respectfully. The soldiers of {kingdomName} do not resent you for it, which may be the clearest sign that you earned every coin.',
        rank: 'You accept the offered reward as one entitled to it by deed and standing. The crowd in {townName} sees no greed in the moment, only order.'
    },
    donate_reward: {
        default: 'You push the reward away from yourself and toward people who need it sooner. {npcName} is too moved to hide it, and the mood in {townName} lifts as if generosity were a lantern someone had just lit.',
        war: 'You send the prize on to the wounded and the families waiting at home. Hardened men in {kingdomName} go quiet when they hear, because mercy from the strong always sounds louder after war.',
        context: 'You refuse to make your own victory the final point of the story. Instead, {townName} gets something useful and a better reason to say your name.'
    },
    ask_for_favor: {
        default: 'You leave the gold on the table and ask {npcName} for something harder to measure. The answer is immediate: in {townName}, you now have one more person who will move when you call.',
        war: 'You trade coin for a promise from people who matter on the frontier. That may not gleam in the hand today, but in {kingdomName} favors won under strain have a way of lasting.',
        political: 'You ask for future leverage instead of present payment. {npcName} understands the weight of that choice, and the air between you in {kingdomName} grows careful and respectful.'
    },
    support: {
        default: 'You put your weight behind {npcName} and help their move gather force. By the time the news circles {townName}, people are already sorting themselves by whether they wish they had stood with you.',
        political: 'You back the maneuver at the right moment and make it respectable by touching it. {npcName} gains ground, your name gains reach, and somewhere in {kingdomName} an enemy starts recalculating.',
        war: 'You support {npcName} because the realm needs decisions more than dithering. The choice wins allies among those who still believe strength should serve more than itself.'
    },
    leak: {
        default: 'You let the secret loose where it will earn the most and hurt the right people from a safe distance. {npcName} may never forgive it, and {townName} will wonder for some time who first opened the door.',
        political: 'You sell the whisper across faction lines and watch power shift without you needing to lift another finger. It is profitable work, but in {kingdomName} everyone eventually learns that leaked words leave stains.',
        crime: 'You pass the hidden detail to someone eager enough to pay for it. By sundown the underbelly of {townName} is buzzing, and {npcName} has one more reason to sleep lightly.'
    },
    press_advantage: {
        default: 'You move before the window can close and turn success into something larger. {npcName} recognizes the ruthlessness of it, while the people of {townName} mostly just see a winner who knew when to keep pushing.',
        political: 'You use the momentum to secure a stronger place for yourself before rivals can recover. It is not a gentle choice, but in {kingdomName} gentleness rarely survives long in rooms like these.',
        trade: 'You press while the market still leans your way and pull out extra profit before the numbers cool. Several merchants in {townName} hate the move so much they call it masterful.'
    },
    take_gift: {
        default: 'You accept the quiet gift and let everyone pretend it is merely gratitude. {npcName} looks relieved, but the people of {townName} can smell private arrangements even when the ribbon is pretty.',
        political: 'You take the discreet payment and allow the matter to stay pleasantly undefined. In {kingdomName}, that sort of courtesy is useful right until it becomes evidence.',
        social: 'You accept the present with an easy smile, though both you and {npcName} know it is buying more than thanks. By the next morning someone in {townName} is already guessing the price wrong and the intention right.'
    },
    step_back: {
        default: 'You ease away before triumph can draw too much envy. {npcName} keeps their dignity, you keep your breathing room, and {townName} is left with less reason to resent your good fortune.',
        political: 'You step back while the board still favors you, which is why it will probably favor you again later. In {kingdomName}, survival often belongs to the player who knows when not to make the final move.',
        social: 'You let the moment cool instead of feeding it. A jealous room in {townName} has nothing to bite on, and that alone is worth the restraint.'
    },
    hear_them_out: {
        default: 'You give {npcName} your time and full attention, which is rarer than most gifts in {townName}. By the end of the conversation, both of you know more than when it began, and people nearby notice the respect you paid.',
        rank: 'You allow {npcName} to speak all the way to the heart of the matter. That patience surprises the room, and in a place obsessed with standing, {townName} sees the strength in it.',
        social: 'You listen seriously instead of waving the problem away. {npcName} straightens as they speak, as if being heard were already half a remedy.',
        political: 'You hear the petition through every careful pause and hidden plea. The hall in {kingdomName} notices that you can sit with complexity without immediately reaching for profit.'
    },
    exact_toll: {
        default: 'You make it clear that your time has a price and collect it before the matter goes any farther. {npcName} pays because they must, and {townName} receives a sharp reminder that access to you is not free.',
        rank: 'You exact the toll with all the ceremony of custom and none of the softness of charity. People in {townName} bow to the rule of it even while resenting the weight.',
        trade: 'You name a fee so cleanly it sounds like market law. {npcName} grumbles, pays, and a cloth seller nearby mutters that you missed your calling as a tax collector.'
    },
    brush_aside: {
        default: 'You dismiss {npcName} before the appeal can gather force. The crowd in {townName} sees exactly who had power in that moment, and exactly how little gentleness you spent using it.',
        rank: 'You wave the petition away as though it never deserved the air it took to speak. {npcName} withdraws stiff-backed, and the lesson lands on everyone watching in {townName}.',
        social: 'You cut the conversation short and leave {npcName} holding the embarrassment alone. You gain time and coin, but the room remembers the sharpness of the gesture more than the reason for it.'
    },
    grant_mercy: {
        default: 'You choose mercy where authority might have squeezed harder. {npcName} leaves with visible relief, and the people of {townName} talk about your strength as something steady rather than cruel.',
        rank: 'You show that rank can protect as well as command. The square in {townName} softens around the moment, and even those who feared your judgment begin to hope from it.',
        war: 'You spare someone when harsher times might have excused severity. After all the hard news in {kingdomName}, the choice feels almost startling in its humanity.'
    },
    take_tribute: {
        default: 'You accept the tribute and let the exchange settle in the old shape of power repaid. {npcName} gives it over with both hands, and {townName} reads the gesture as proof that your help carries weight.',
        rank: 'You take the reward as a lord might, with calm certainty and no apology. The people watching in {townName} understand at once that gratitude to you has become a matter of form as much as feeling.',
        political: 'You collect tribute while the alliance is fresh and the debt still obvious. In {kingdomName}, such moments build memory, and memory becomes influence.'
    },
    close_case: {
        default: 'You end the matter without squeezing it for one last advantage. {npcName} goes free of further obligation, and {townName} is left with the rare satisfaction of a clean ending.',
        rank: 'You close the case with a few words and no performance. The restraint surprises {townName} more than a show of power would have, which tells you something useful about the place.',
        crime: 'You shut the book on it before vengeance, gossip, or bribes can reopen it. Even the watch in {townName} seems grateful to be spared one more complicated night.'
    },
    heed: {
        default: 'You choose not to laugh the sign away. {npcName} sees the decision and falls quiet, while {townName} seems to lean around you as if waiting to learn whether wisdom and trouble are about to become the same thing.',
        supernatural: 'You heed the omen and step after it with more courage than certainty. Dogs in {townName} start barking at nothing, a candle gutters sideways, and suddenly even sensible people stop smiling.',
        social: 'You treat {npcName} seriously when others would have scoffed. That alone changes the mood in {townName}, because respect is sometimes the first miracle people notice.'
    },
    listen: {
        default: 'You do not commit too quickly, but you do pay attention, and that proves enough for now. {npcName} relaxes a little, and small details in {townName} begin arranging themselves into a pattern you can almost trust.',
        supernatural: 'You listen to the strange thing instead of running from it. The whispers do not become clearer so much as closer, and by dusk {townName} feels full of meanings just beyond sight.',
        political: 'You keep still and let the hidden message finish itself. In {kingdomName}, people often reveal the most when they think you are merely listening.'
    },
    mock: {
        default: 'You laugh in the face of the warning and make sure others hear it. Some people in {townName} laugh with you, but the sound has an edge, as if they want your confidence more than they share it.',
        supernatural: 'You mock the omen out loud and turn fear into a cheap performance. A few bystanders grin, one old woman spits over her shoulder, and by evening {townName} has decided you are either very brave or very foolish.',
        social: 'You make {npcName} the punch line and win a quick burst of amusement from the crowd. It earns you the moment and costs you their trust.'
    },
    follow: {
        default: 'You follow the trail all the way to the place sensible people would have stopped. What you find in or beyond {townName} is worth coin and scars in equal measure, and the story of your nerve starts walking before you return.',
        supernatural: 'You go after the sign until the streets of {townName} fall away and the world turns strange around you. When you come back with reward in hand, even skeptics study your face for proof of what else you brought home.',
        crime: 'You track the lead to its source instead of waiting for it to circle back. The choice pays, but the kind of people {npcName} knows do not enjoy being found.'
    },
    ward: {
        default: 'You pay for protection and feel the tension leave your shoulders one careful breath at a time. {npcName} may smirk at the caution, but the people of {townName} have seen enough strange nights to respect a person who buys peace when they can.',
        supernatural: 'You purchase the wards, hang them where they must be hung, and sleep without dreams for the first time in days. A local wise woman in {townName} pats your arm, pockets the coin, and tells you that fear is cheaper than curses, which sounds suspiciously rehearsed.',
        social: 'You answer worry with practical steps instead of brave speeches. {npcName} seems steadier for it, and sometimes that is all the magic a town truly needs.'
    },
    attempt: {
        default: 'You step forward and take the challenge with everyone watching. Win or stumble, {townName} will remember that {npcName} called and you answered.',
        skill: 'You give the test everything you have and force the crowd to pay attention. The judges lean in, rivals stop smirking, and somewhere in {townName} a bookmaker groans because you outperformed the odds.',
        war: 'You take on the hard task because harder people will rely on its result. Even before the bruises fade, {kingdomName} has a new story about your nerve.'
    },
    bet_safe: {
        default: 'You choose the safer edge of the moment and learn without bleeding for the lesson. {npcName} may have wanted a bolder answer, but in {townName} wisdom often looks dull right until it wins.',
        skill: 'You watch every move, note every mistake, and come away smarter than half the competitors who leapt first. A boy near the rail starts copying your thoughtful nod like he expects it to help him grow a beard.',
        social: 'You stay in the circle without stepping into the fire. People in {townName} notice the restraint, and a few of them mistake it for mystery.'
    },
    collect_prize: {
        default: 'You take the prize when it is offered and do not pretend surprise. {npcName} applauds with the rest, and {townName} gives you the rare pleasure of public approval without an argument attached.',
        skill: 'You accept the judges\' reward while the crowd is still buzzing over what you did. The purse is satisfying, but the better prize is the look on your rivals when they realize they must call you the winner.',
        war: 'You receive the reward for work that mattered under pressure. In {kingdomName}, such honors are not handed out lightly, and everyone present knows it.'
    },
    share_credit: {
        default: 'You turn the spotlight wide enough to include the people who helped you reach it. {npcName} is visibly startled, and the mood in {townName} softens from admiration into something closer to affection.',
        skill: 'You name the hands, eyes, and advice that carried you here alongside your own work. The crowd in {townName} likes that almost as much as the performance itself, and your rivals find it very hard to hate you for winning.',
        social: 'You refuse to make the moment only yours. That generosity catches on quickly, and before long {townName} is telling the story as one of fellowship instead of conquest.'
    },
    walk: {
        default: 'You leave before applause can start building a throne beneath your feet. {npcName} watches you go with renewed respect, and {townName} is left wanting just a little more of you than it got.',
        skill: 'You walk away from the prize circle with steady hands and no need to milk the moment. The judges notice, the crowd notices more, and humility somehow makes the victory look even larger.',
        political: 'You exit before praise can be turned into obligation. In places like {kingdomName}, that may be the cleverest move of the day.'
    },
    intervene: {
        default: 'You step into the trouble and make it your problem until it starts behaving. {npcName} will not forget who answered, and the people of {townName} now have a solid story to tell about your kind of courage.',
        context: 'You intervene before the crisis can harden into disaster. The street of {townName} that had been full of fear is suddenly full of people breathing again.',
        war: 'You act decisively while others are still measuring risk. That sort of intervention keeps more than trade alive on a bad day in {kingdomName}.'
    },
    observe: {
        default: 'You hold back and watch, learning where the pressure is without putting your hand under it. {npcName} may wish you had done more, but in {townName} a careful witness can be useful in ways a reckless hero cannot.',
        context: 'You stay on the edge of the scene and let the crisis reveal itself. By the time it resolves, you understand far more about {townName} than the people who rushed in blind.',
        crime: 'You watch the whole thing unfold without announcing yourself. Later, when {npcName} starts lying about it, you will be one of the few in {townName} who knows exactly where the lie begins.'
    },
    take_reward: {
        default: 'You accept what is offered and let the matter close with honest payment. {npcName} seems grateful to settle the debt plainly, and {townName} approves of an ending where everyone knows what was owed.',
        context: 'You take the reward after the hard part is done and avoid the trap of false humility. The people of {townName} may ask for more tomorrow, but today they are simply glad the crisis ended with coin instead of funerals.',
        supernatural: 'You accept the last reward with careful fingers, aware that strange stories rarely end exactly where the gold is counted. Even so, when you leave {townName}, you are richer in purse and not entirely poorer in peace.'
    },
    reinvest: {
        default: 'You turn the reward back into timber, stone, labor, or whatever {townName} most needs. {npcName} looks at you as if generosity from a successful person is stranger than any magic, and the whole town stands a little taller for it.',
        context: 'You put {costGold} gold back into {townName} instead of walking away with the praise. By week end the change is visible, and a mason insists on telling everyone which wall exists because of you.',
        trade: 'You feed your winnings back into local work and materials rather than hoarding them. Merchants in {townName} notice at once, because coin spent that way ripples through ten ledgers before supper.',
        war: 'You reinvest in recovery instead of reward. For a place in {kingdomName} that has been asked to endure too much, that feels less like business and more like relief.'
    },
    mark_secret: {
        default: 'You mark the discovery as yours and keep the deeper truth off the public road. {npcName} understands the trust in that silence, and {townName} never learns how close it came to a stranger sort of story.',
        supernatural: 'You hide the secret rather than feed it to rumor. The last strange trace fades from {townName}, and only you and {npcName} know what still sleeps beneath the quiet surface.',
        political: 'You keep the knowledge sealed because not every advantage improves when exposed to sunlight. In {kingdomName}, secrets kept well can be kinder than secrets spent.'
    }
};