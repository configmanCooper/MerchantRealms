# Unsolicited Events Narrative Review

Reviewed `js\modules\player_unsolicited_events.js` end-to-end: `_fill()`, `_sceneLead()`, all 17 `_rawStep()` templates, all choice labels, `RESULT_NARRATIVES`, and the 205 event definitions that bind titles/categories/templates together. The biggest issues are systemic template/title mismatches and label/result text that lies about the actual outcome.

### [CRITICAL] Windfall events ignore their own titles
**Location:** `_rawStep()` lines 401-406; representative event defs `Festival Game` (~2302-2308), `Sunset View` (~3044-3051), `Butterfly Garden` (~3790-3797), `Boom Town Investor` (~22886-22892)
**Current text:** `"While walking through {townName}, you stumble upon an unattended coin purse near the market square..."` used for titles like `"Sunset View"` and `"Festival Game"`.
**Problem:** This completely breaks immersion. A player clicks `Sunset View` and gets a dropped-wallet story. The title promises one scene; the prose delivers another.
**Suggested fix:** Split `windfall` into narrower variants such as `found_property`, `lucky_opportunity`, and `public_contest`, or rewrite the affected event titles so they actually describe found money.

### [CRITICAL] `delayed_notice` is fundamentally wrong for personal/common events
**Location:** `_rawStep()` lines 443-452; representative event defs `Family Reunion` (~8748-8755), `Old Friend` (~7758-7765), `Town Crier` (~2052-2059), `Security Checkpoint` (~24002-24009)
**Current text:** `"{npcName} seeks you out... with a proposition that requires patience. The matter is delicate — political, perhaps... Quick coin is also on the table if you'd rather twist the situation now."`
**Problem:** This works for intrigue, but not for `Family Reunion`, `Old Friend`, `Town Crier`, or other public/common/social scenes. The template sounds like palace scheming no matter what the event title says.
**Suggested fix:** Replace `delayed_notice` with at least three variants: personal reunion/news, public rumor/news, and intrigue/political delay. Example for `Family Reunion`: `"Word reaches you that kin have arrived in {townName}. If you make time for them, they will still be here in {waitDays} days..."`

### [CRITICAL] `rank_chain` collapses prestige stories into legal-case language
**Location:** `_rawStep()` lines 515-524; representative event defs `Fame Recognition` (~24868-24875), `Dynasty Founder` (~25736-25743), `Master Trader` (~25862-25869), `Notorious Reputation` (~25986-25993)
**Current text:** `"Show mercy... take tribute... close the case quietly..."`
**Problem:** Those choices only fit petitions or judgments. They do not fit fame, legacy, reputation, mentorship, or merchant prestige. `Dynasty Founder` should not resolve like a court case.
**Suggested fix:** Keep one `petition_rank_chain`, but add a separate `prestige_rank_chain` with choices like `Accept the acclaim`, `Turn honor into leverage`, and `Remain reserved`.

### [HIGH] `_sceneLead()` creates broken English from raw titles
**Location:** `_sceneLead()` lines 385-396
**Current text:** `"The talk of " + t + " is on everyone's lips..."`, `"Rumors of " + t + " are whispered..."`, `"Something called " + t + " catches your eye..."`
**Problem:** Raw title concatenation produces lines like `The talk of Wedding Invitation`, `Rumors of Pickpocket Attempt`, and `Something called Town Crier`. Thirty `common` events also fall through to the especially awkward default line.
**Suggested fix:** Add per-event `leadText` or `titlePhrase` fields instead of forcing every title into the same grammar shell. If that is too heavy, at least give `common` its own neutral lead.

### [HIGH] `social_scene` assumes romantic interest even when the title does not
**Location:** `_rawStep()` lines 422-427; representative event defs `Jealous Rival` (~7634-7641) and `Couple Fight Mediator` (~9864-9871)
**Current text:** `"The conversation turns personal — they seem to be testing whether you're worth knowing better."`
**Problem:** That fits flirtation, not jealousy or mediation. `Couple Fight Mediator` especially reads like the NPC is courting the player in public.
**Suggested fix:** Split this into `social_interest_scene` and `social_tension_scene`. A mediator scene should sound like two people dragging you into their quarrel, not like a courtship test.

### [HIGH] The `windfall` pocket label lies about reputation risk
**Location:** `_rawStep()` lines 401-405; `applyEffect()` lines 743-746
**Current text:** `"Pocket the gold (+{goldAmount}g, risk to reputation)"`
**Problem:** `pocket` only hurts reputation if `def.category === 'crime'`, but `windfall` is used by `common` and `context` events, not crime events. The label warns about a risk that usually does not exist.
**Suggested fix:** Either remove the reputation warning from the label or add a real discovery/reputation penalty to `windfall` choices.

### [HIGH] `skill_test` promises conditional success, but the effect is automatic
**Location:** `_rawStep()` lines 436-440; `applyEffect()` line 796
**Current text:** `"Accept the challenge (+gold if you succeed, risk of injury)"`
**Problem:** There is no success/failure branch. The player always loses energy, always gains gold, and only risks injury through the hazard roll. The prose implies uncertainty the mechanics do not support.
**Suggested fix:** Either add a true success test or relabel the choice as deterministic: `"Take the challenge (-energy, +gold, chance of injury)."`

### [HIGH] `romance_chain`'s `stay_away` text does not match its effect
**Location:** `_rawStep()` lines 473-476; `RESULT_NARRATIVES` line 650; `applyEffect()` line 770
**Current text:** Choice label: `"Don't show up (+energy, -relationship)"`; result: `"...but you kept your energy."`
**Problem:** The effect gives gold and relationship loss; it does not restore energy. Both the choice label and the result narrative misreport the outcome.
**Suggested fix:** Either change the effect to grant energy, or rewrite the text to match the current mechanic: `"Keep to your work instead (+gold, -relationship)."`

### [HIGH] `mystic_chain` and `long_omen` reuse `refuse` in a way that makes no narrative sense
**Location:** `_rawStep()` lines 533-536 and 568-570; `RESULT_NARRATIVES` line 628; `applyEffect()` line 748
**Current text:** `"Refuse the call (+gold)"` / `"Refuse the pattern — enough is enough"` with result text `"...you saved your energy."`
**Problem:** The generic `refuse` effect is relationship loss plus gold. That makes some sense for snubbing a person, but not for rejecting an omen. Where does the gold come from? Why is there relationship damage if the scene may have no human counterpart?
**Suggested fix:** Give omen refusal its own effect key, likely `+energy` or no reward at all, with text about warding the door, saying a prayer, or deciding the matter is beneath your attention.

### [HIGH] Several result narratives are factually wrong about the actual outcome
**Location:** `RESULT_NARRATIVES` lines 628, 639, 650
**Current text:** `refuse: "...you saved your energy."`; `decline: "...you kept your energy..."`; `stay_away: "...you kept your energy."`
**Problem:** None of those effects restore energy. `refuse` and `decline` grant gold; `stay_away` grants gold and hurts the relationship. The result text actively misinforms the player.
**Suggested fix:** Rewrite them to reflect the actual state change. Example: `"You turn away and return to business. The coin stays with you; the goodwill does not."`

### [HIGH] `trade_chain` outcome text overpromises and contradicts the mechanics
**Location:** `_rawStep()` lines 461-464; `RESULT_NARRATIVES` lines 645-647; `applyEffect()` lines 765-767
**Current text:** `"Sell at fair profit (+{rewardGold}g, +{itemQty} {resourceName})"`; `"Donate part of the goods (+reputation, lighter purse)"`; result `donate: "Your purse is lighter..."`
**Problem:** `unload` only gives half the goods, not `{itemQty}`. `donate` does not actually remove gold or goods, despite both the label and result text saying it costs something.
**Suggested fix:** Either change the effects to charge a real cost, or rewrite the text to match the existing outcome: `"Take the goodwill and let the margin go"` / `"Receive a partial allotment with your payout"`.

### [HIGH] Reward labels omit extra goods granted by the effect
**Location:** `_rawStep()` lines 557-559 and 581-583; `RESULT_NARRATIVES` line 683; `applyEffect()` lines 807-809
**Current text:** `"Take the offered reward (+{rewardGold}g)"` / `"Take the last reward (+{rewardGold}g)"`
**Problem:** For `trade`, `context`, and `skill` categories, `take_reward`/`collect_prize` also grant inventory. The label and result narrative only mention gold.
**Suggested fix:** Mention the bundled goods directly: `"Take the reward and the supplied goods (+{rewardGold}g, +goods)."`

### [MEDIUM] Choice labels sound like debug strings instead of lived decisions
**Location:** Representative labels throughout `_rawStep()`, especially lines 403-405, 409-412, 417-419, 423-426, 492-500
**Current text:** Examples include `"Pocket the gold (+{goldAmount}g, risk to reputation)"`, `"Turn their misfortune into profit (+gold, -reputation)"`, `"Help, but think of profit first (+gold, -reputation)"`
**Problem:** The labels expose spreadsheet deltas instead of dramatizing the decision. The tone becomes mechanical at the exact moment that should feel most human.
**Suggested fix:** Use narrative-first labels, with concise stakes: `"Keep the purse and trust the crowd saw nothing"`, `"Lift the burden with your own hands"`, `"Supply the troops, but charge them dearly"`.

### [MEDIUM] `RESULT_NARRATIVES` are too generic to carry consequence
**Location:** `RESULT_NARRATIVES` lines 623-685
**Current text:** `"You accept."`, `"You let the moment pass."`, `"You back the play."`
**Problem:** The system promises meaningful choices, but many outcomes land as flat aphorisms. Sanderson-style weight comes from concrete aftermath: who noticed, what shifted, what it cost.
**Suggested fix:** Add category-aware specifics using existing tokens. Example for `claim`: `"You take the reward in public, and by evening half of {townName} knows whose hand settled the matter."`

### [MEDIUM] `_fill()` is too limited to support vivid social prose
**Location:** `_fill()` lines 359-372
**Current text:** Replacement keys are effectively limited to `{townName}`, `{kingdomName}`, `{playerName}`, and `{npcName}` plus raw params.
**Problem:** Because the text cannot easily reference roles, pronouns, possessives, or social standing, many lines stay abstract and repetitive. That pushes the writing toward generic filler.
**Suggested fix:** Support richer placeholders such as `{npcRole}`, `{npcPronoun}`, `{npcPossessive}`, `{playerTitle}`, or per-event `leadText`/`resolutionText` fields.

### [LOW] Some mystical lines undercut the grounded tone with a wink
**Location:** `_rawStep()` lines 528-531 and 564-566
**Current text:** `"...the boredom of forces beyond mortal understanding..."` and `"...spit in the eye of superstition"`
**Problem:** These lines feel authorially cheeky in a system that otherwise wants grounded weight. They make the supernatural sound glib instead of unsettling.
**Suggested fix:** Keep the mystery clear and concrete: `"Whether omen or fraud, the sign demands an answer."` / `"Step toward it, or dismiss it as fear wearing a mask."`

### [LOW] `take_tribute` sends mixed moral signals
**Location:** `_rawStep()` lines 521-524; `RESULT_NARRATIVES` lines 668-670
**Current text:** `"Take tribute and close the case (+{rewardGold}g, +reputation)"`
**Problem:** The prose frames tribute-taking as a hard, morally gray act, but the label rewards reputation. That can work in a feudal world, but the current wording makes it feel unintentionally confused rather than intentionally authoritarian.
**Suggested fix:** Decide on the moral frame. If tribute is respected authority, say so. If it is exploitation, the reputation outcome should reflect that.
