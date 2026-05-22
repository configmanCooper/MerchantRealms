# Merchant Realms unsolicited events review

### [CRITICAL] Live trigger path is effectively disabled, and debug mode ignores the tuned chance constants
**Location:** `tryGenerateDailyUnsolicitedEvent()` / `tryGenerateEntryUnsolicitedEvent()` lines 26198-26258  
**Current behavior:** Daily generation returns immediately unless `window._godUeBoost` is true, and the daily path uses a hardcoded `0.50` chance instead of `DAILY_CHANCE=0.02`. Entry generation is also blocked unless the same debug flag is on.  
**Problem:** In normal play, unsolicited events never fire. If the debug flag is enabled, they fire at an economy-flooding rate that bypasses the intended tuning.  
**Suggested fix:** Remove the `window._godUeBoost` gate from the live functions, use `DAILY_CHANCE` and `ENTRY_CHANCE` directly, and keep debug behavior inside `_godForceUnsolicitedEvent()` / a separate override-only path.

### [CRITICAL] Several multi-step choices are strictly dominant because earlier choices do not change later steps
**Location:** `_rawStep()` lines 455-585, `handleUnsolicitedEventChoice()` lines 26407-26441, `choiceHistory` write at 26407  
**Current behavior:** Many step-0 choices funnel to the same later step, but the system never reads `choiceHistory` and does not persist branch-specific state into later rewards. Example: in `trade_chain`, `commit` costs full `costGold` plus energy, while `haggle` costs only `floor(costGold*0.7)`, gives `+1` relationship, and still reaches the same step-1 payout menu. In `mystic_chain`, `heed` costs energy, while `listen` gives reputation and still reaches the same next step.  
**Problem:** Optimal play becomes obvious, so the chain illusion breaks. The player is not choosing a path; they are choosing the mathematically best immediate modifier before the same outcome table.  
**Suggested fix:** Store branch state in `inst.params` (investment tier, trust level, risk level, omen depth, etc.) and read it in later steps. Lower `rewardGold`/`itemQty` after haggling, unlock extra outcomes after fully committing, and let prior cautious/aggressive choices change both text and formulas.

### [CRITICAL] Trade rewards are disconnected from actual goods, so the merchant economy can swing arbitrarily
**Location:** `_chooseFromGroup()` lines 288-311, `generate()` lines 697-723 (pattern repeated in all 205 defs), `applyEffect()` cases `buy/unload/take_reward/collect_prize` lines 750, 765, 798, 803, 807-808, 927-933  
**Current behavior:** `resourceId` is chosen separately from the money roll. `itemQty`, `costGold`, and `rewardGold` come only from rarity bands, not from the chosen good or local market. A trade event can therefore price pearls, silk, wood, or tools off the same formula.  
**Problem:** This breaks merchant-game intuition. Expensive goods can become absurd bargains, cheap goods can be overpriced, and the player cannot reason from the game world. The strongest trade choices are dictated by random rarity bands instead of market logic.  
**Suggested fix:** Price every item-based event from actual local value: `unitPrice(resourceId, town) * qty`, then apply a template modifier (discount, rush margin, black-market premium, wartime surcharge). Reserve rarity for chance/complexity, not for the base price of goods.

### [CRITICAL] Many event titles can fire in the wrong context because conditions are generic and ID-heuristic driven
**Location:** `_buildContext()` lines 178-187, `_derivedExtra()` lines 202-235, `_passesCondition()` lines 323-357; example event blocks `famine_soup_kitchen` 22761-22884, `frontline_scout` 23629-23752, `war_orphan` 23877-24000, `customs_inspection` 6269-6392, `bulk_buyer` 5401-5524  
**Current behavior:** All 205 defs use the same `condition: function(ctx) { return _passesCondition(ctx, this); }`. `_passesCondition()` never checks `tradeCount`, cargo, route use, or most named crisis states. `_derivedExtra()` adds a few hardcoded gates from event IDs, but many obvious cases are missing.  
**Problem:** Cargo events can appear when the player has no cargo, war-adjacent context events can appear without war pressure, and famine/boom/depression-style events can appear without the matching town state. That damages coherence more than any number tweak.  
**Suggested fix:** Stop relying on substring heuristics for critical context. Add explicit per-event flags such as `cargoAtLeast`, `requiresTradeGoods`, `requiresWar`, `prosperityAbove`, `prosperityBelow`, `securityBelow`, `foodShortage`, `quarantine`, etc., and wire them into `_passesCondition()`.

### [HIGH] Too many “safe opt-out” choices still pay gold, creating a passive farming strategy
**Location:** `_rawStep()` lines 429-447, 491-508, 515-520, 527-537, 539-560; `applyEffect()` cases `refuse/decline/stay_away/brush_aside/mock` lines 872-883, 894, 911, 917  
**Current behavior:** A large share of refusal choices gives free resources: `crime_scene.refuse` grants `goldAmount/4`, `war_chain.decline` grants `goldAmount/4`, `skill_chain.decline` grants `goldAmount/4`, `stay_away` grants `goldAmount/4`, `mock` grants `goldAmount/5`, etc.  
**Problem:** The player can profit by disengaging. That weakens the emotional pressure of unsolicited events and pushes a low-engagement strategy: click the safest refusal for guaranteed incremental income.  
**Suggested fix:** Make most opt-outs neutral or lightly positive in tempo only (save energy, avoid injury, no stat change). Reserve gold payouts for active, risky, or morally gray choices.

### [HIGH] The system barely touches the world simulation, so major events feel disconnected from the rest of the game
**Location:** effect helpers lines 598-616 and `applyEffect()` lines 743-930  
**Current behavior:** Every event resolves through the same narrow outputs: gold, kingdom reputation, NPC relationship, energy, inventory, and a 15% injury roll on hazard-tagged actions.  
**Problem:** In a game with towns, wars, security, prosperity, and politics, this makes war/plague/crime/political events feel cosmetic. A refugee camp, price gouging scandal, quarantine escape, or court intrigue does not actually move town security, happiness, prosperity, route safety, or kingdom state.  
**Suggested fix:** Add world-facing effect helpers: town `security/happiness/prosperity`, kingdom favor/heat, route safety, shortage/surplus flags, NPC status tags, and criminal exposure. Use them on category-specific effect keys so the world remembers the player’s choices.

### [HIGH] Event numbers are theme-blind and not stage-scaled, so early game can spike and late game can flatten
**Location:** `_rarityBase()` lines 313-319 and `generate()` lines 697-723  
**Current behavior:** Every event of the same rarity rolls from the same bands. For example, common events use gold `[8,28]` and rewardGold roughly `10-33`; uncommon use `[20,55]` and rewardGold roughly `24-66`; rare use `[45,95]` and rewardGold roughly `54-114`; epic use `[80,160]` and rewardGold roughly `96-192`. None of this scales by player wealth, day, town prosperity, route reach, or rank.  
**Problem:** A “Royal Advisor Whisper” and a “Street Performer” are numerically cousins if they share rarity. Late-game merchants can ignore payouts, while early rare pulls can be disproportionately strong.  
**Suggested fix:** Split scaling into two axes: event-family base values and game-stage multipliers. Use player gold brackets, social rank, town prosperity, and active trade volume to scale both costs and rewards.

### [MEDIUM] Multi-step chains add waiting, but not enough branching or escalation to justify the overhead
**Location:** `_rawStep()` lines 443-585 and `_stepDelay()` lines 374-383  
**Current behavior:** Most chains are “choose once, wait `waitDays`, choose from another generic 3-option menu.” Only `long_omen` goes longer, but it still uses the same flat effect vocabulary and does not react to earlier path details.  
**Problem:** Chains consume one of the three active multi-step slots without delivering much extra drama or systemic payoff. They feel like delayed single-step events instead of evolving stories.  
**Suggested fix:** Give step-2+ nodes escalation hooks: branch by previous choice, town condition changes while waiting, NPC death/absence, player inventory checks, or kingdom war state changes. Make the delay itself matter.

### [MEDIUM] Frequency/cooldown tuning will underexpose a 205-event pool once live triggers are fixed
**Location:** constants lines 5-21 and `_eligibleDefs()` lines 26135-26149  
**Current behavior:** The intended live numbers are `DAILY_CHANCE=0.02`, `ENTRY_CHANCE=0.05`, `GLOBAL_COOLDOWN_DAYS=3`, `PER_EVENT_COOLDOWN_DAYS=60`, plus category cooldowns of `2-14` days.  
**Problem:** Even if both daily and entry rolls happen regularly, the raw combined chance is only about 6.9% before the 3-day lockout. With 205 defs, this makes the pool feel larger on paper than in actual play, and category cooldowns further reduce perceived variety.  
**Suggested fix:** After the trigger bug is fixed, target roughly one unsolicited event every 6-9 active days, add a pity timer after long dry spells, and shorten common/uncommon per-event cooldowns while keeping rare/supernatural cooldowns longer.

### [MEDIUM] Some rewards are hidden or mislabeled, so the UI does not tell the player the real stakes
**Location:** `_rawStep()` lines 455-560 and `applyEffect()` lines 807-808, 931-933  
**Current behavior:** `take_reward` / `collect_prize` can also add hidden inventory for `trade`, `context`, and `skill` categories, but the labels usually only mention gold. Conversely, `windfall` advertises “risk to reputation,” but `pocket` only hurts reputation when `def.category === 'crime'`, so a common event like `found_coin_purse` is pure gold.  
**Problem:** Players cannot make informed choices, and balance testing becomes muddy because the written choice text does not reliably match the mechanical result.  
**Suggested fix:** Surface all nontrivial deltas in labels/results, and keep template copy synchronized with actual formulas. If an effect is hidden intentionally, it should be discoverable through event setup, not invisible arithmetic.

### [LOW] The effect-key palette is too narrow for a merchant simulator with politics and war
**Location:** `_rawStep()` lines 398-587 and `applyEffect()` lines 743-930  
**Current behavior:** Most events reuse the same handful of outcomes: gold/reputation/relationship/energy/inventory/injury, with template-level choice labels doing most of the flavor work.  
**Problem:** After enough events, the player is not really making different kinds of decisions; they are reselecting the same resource exchange under different prose.  
**Suggested fix:** Add merchant-native effect families such as tariffs, credit, contracts, supply rights, embargo exemptions, storage loss, escort safety, guild favor, blacklists, warrants, and route intel. That will increase both variety and strategic identity without needing hundreds more event defs.
