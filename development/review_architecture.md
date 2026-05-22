# Unsolicited Events Architecture Review

Scope reviewed: `js\modules\player_unsolicited_events.js` and the unsolicited-event save/load touchpoints in `js\player.js`.

Main takeaway: this subsystem is already structured like a small template/effects engine, but most of that design value is buried under 205 repeated object literals. I did **not** find an obvious current save/load omission; unsolicited event state is explicitly serialized. The biggest problems are duplication, debug logic mixed into production flow, and hidden rule coupling.

### [CRITICAL] Collapse 205 repeated function triplets into shared handlers
**Location:** `player_unsolicited_events.js:687-26108`
**Current state:** `EVENT_DEFS` contains 205 event objects. Each one repeats the same `condition`, `generate`, and `applyEffect` bodies. In this file there are 205 `condition` functions, 205 `generate()` functions, and 205 `applyEffect()` functions; the `generate` body has 1 unique implementation, and the `applyEffect` body also has 1 unique implementation.
**Problem:** This is the main maintainability risk. Any bug fix to generation or effects must be patched in 205 places, so drift is almost guaranteed eventually. It also inflates parse/load cost: the browser has to load a 2.1MB file and instantiate hundreds of identical closures before gameplay even starts.
**Suggested refactor:** Make defs pure data and route them through shared functions.

```js
function _defaultCondition(ctx, def) {
    return _passesCondition(ctx, def);
}

function _generateStandardInstance(def, ctx) {
    // existing shared generate logic
}

function _applyStandardEffect(def, effectKey, params, ctx, outcome) {
    // existing shared switch/effect logic
}

var EVENT_DEFS = [
    { id: 'found_coin_purse', title: 'Found Coin Purse', icon: '💰', category: 'common', rarity: 'common', weight: 10, template: 'windfall' },
    { id: 'stray_dog', title: 'Stray Dog', icon: '🐕', category: 'common', rarity: 'common', weight: 10, template: 'aid' }
];
```

Then, in one normalization pass, attach shared handlers for defs that do not provide custom ones.
**Risk assessment:** Medium. The safest path is compatibility-first: keep the current def shape, add shared defaults, then delete duplicate per-def functions in batches. Main regression risk is any hidden reliance on `this` or on inferred defaults.

### [CRITICAL] Remove the god-mode gate from normal generation
**Location:** `player_unsolicited_events.js:5-6, 26198-26202, 26250-26258`
**Current state:** `DAILY_CHANCE` and `ENTRY_CHANCE` are defined at the top, but `tryGenerateDailyUnsolicitedEvent()` and `tryGenerateEntryUnsolicitedEvent()` immediately return `false` unless `window._godUeBoost` is enabled.
**Problem:** The production path appears effectively disabled. Architecturally, debug state is coupled directly into the core runtime. That also makes the constants misleading and creates a high chance of false assumptions elsewhere in the codebase.
**Suggested refactor:** Keep boost behavior, but make it a multiplier/override instead of a hard gate.

```js
function tryGenerateDailyUnsolicitedEvent() {
    var ch = window._godUeBoost ? 0.50 : DAILY_CHANCE;
    return _tryGenerate(ch);
}

function tryGenerateEntryUnsolicitedEvent(townId) {
    // existing once-per-day guard...
    return _tryGenerate(window._godUeBoost ? 0.50 : ENTRY_CHANCE);
}
```

Leave `_godForceUnsolicitedEvent()` as the true debug bypass.
**Risk assessment:** Medium. If the live game has been balanced around this accidental suppression, enabling the intended flow may change pacing and should be sanity-checked in a test save.

### [HIGH] Replace module-level `_outcome` with an explicit per-resolution collector
**Location:** `player_unsolicited_events.js:598-622, 26410-26414`
**Current state:** `_gold`, `_rep`, `_rel`, `_energy`, `_applyInventory`, and `_hazard` all push into a module-level `_outcome` array. `handleUnsolicitedEventChoice()` sets `_outcome = []`, calls `def.applyEffect(...)`, reads it back, then resets it.
**Problem:** This is only safe as long as the entire effect path stays strictly synchronous and non-reentrant. In current vanilla JS that is mostly true, but it is brittle: helper behavior depends on hidden ambient state, and any future nested callback/UI hook can corrupt the accumulator.
**Suggested refactor:** Pass an explicit collector object through the effect path.

```js
function _gold(delta, outcome) {
    if (delta) {
        Player.modifyGold(delta, 'unsolicited_event');
        outcome.push({ type: 'gold', delta: delta });
    }
}
```

Then `handleUnsolicitedEventChoice()` creates `var outcome = [];` and passes it into `_applyStandardEffect(...)`.
**Risk assessment:** Low-medium. This touches helper signatures, but the behavior is localized and becomes much easier to test.

### [HIGH] Convert `_rawStep()` from code ladder to template registry
**Location:** `player_unsolicited_events.js:385-587`
**Current state:** `_rawStep()` is a long `if (def.template === ...)` chain with 18 template branches and hardcoded step text/choices.
**Problem:** The system already behaves like a template engine, but templates are stored as executable control flow. That makes content harder to diff, discourages reuse, and increases the chance that step text, delay rules, and effect keys drift out of sync.
**Suggested refactor:** Move template content into a data registry and keep rendering logic generic.

```js
var TEMPLATE_STEPS = {
    windfall: [ { text: '...', choices: [...] } ],
    delayed_notice: [ { text: '...', choices: [...] }, { text: '...', choices: [...] } ]
};
```

`_rawStep(def, instance, ctx)` then becomes a lookup plus placeholder fill, and `_stepDelay()` can read from template metadata instead of hardcoding special cases.
**Risk assessment:** Medium. The main risk is accidentally changing step counts or choice IDs during conversion, so snapshotting current outputs before the swap would help.

### [HIGH] Stop hiding event rules in ID substring heuristics
**Location:** `player_unsolicited_events.js:202-235, 288-312, 323-357`
**Current state:** `_derivedExtra()` and `_chooseFromGroup()` infer behavior from `def.id` substrings and broad categories: NPC role, war/peace gating, rank restrictions, resource selection, hazard flags, and more.
**Problem:** Event IDs are acting like implicit configuration. Renaming a def can silently change logic. Reading one event object does not tell you its actual requirements or resource behavior; you have to mentally execute helper heuristics too.
**Suggested refactor:** Promote inferred properties into explicit def fields such as `npcRole`, `requirements`, `resourcePool`, `hazardous`, `rankAtLeast`, `needsSpouse`, etc. Keep `_derivedExtra()` only as a temporary backfill layer while defs are migrated.
**Risk assessment:** Medium. Any missed default during migration could change eligibility, so this should be done with a content audit or smoke test.

### [MEDIUM] Keep the existing save/load hooks, but add instance normalization
**Location:** `player_unsolicited_events.js:68-88, 26161-26452`; `player.js:19373-19380, 20012-20019`
**Current state:** Unsolicited event state is explicitly serialized and restored in `player.js`, which is good. Inside the events module, `_ensureState()` backfills top-level containers, but saved event instances themselves are mostly trusted as-is.
**Problem:** This is not a current “state lost on reload” bug, but it is a schema-drift risk. Old saves can carry `stepIndex`, `status`, `choiceHistory`, `dueDay`, or `params` shapes that no longer match the current template definitions.
**Suggested refactor:** Add `_normalizeEventInstance(inst)` and run it on pending/active events during `_ensureState()` or `tickUnsolicitedEvents()`. Backfill missing fields, clamp impossible values, and discard instances whose def/template no longer supports the saved step.
**Risk assessment:** Low. Worst case, some invalid legacy events get dropped instead of surfacing as broken UI.

### [MEDIUM] Replace silent catch-and-ignore blocks with targeted diagnostics
**Location:** `player_unsolicited_events.js:60-67, 26145-26147, 26188, 26411`
**Current state:** Many failures are swallowed silently: helper accessors, condition evaluation, generation, and effect application all use empty `catch` blocks.
**Problem:** In a content-heavy system, silent failure is brutal for maintenance. A bad event can simply stop appearing, or an effect can partially fail, with no clue which def caused it.
**Suggested refactor:** Add one debug-only reporting path such as `_diagError(stage, defId, err)`, and have `_godDiagUnsolicitedEvents()` expose the last few failures. Even `console.warn('[UE]', stage, defId, err)` behind a debug flag would be a major improvement.
**Risk assessment:** Low. The only real risk is log noise if the diagnostics are not gated.

### [MEDIUM] Split the subsystem by concern without changing the vanilla architecture
**Location:** entire module, especially `player_unsolicited_events.js:1-26463`
**Current state:** Helpers, effects, narratives, templates, runtime state machine, diagnostics, and 205 defs all live in one IIFE file.
**Problem:** This is difficult to navigate, easy to create merge conflicts in, and expensive to review. The event definitions alone occupy almost the whole file.
**Suggested refactor:** Keep the no-build-step approach, but split by responsibility: for example `player_unsolicited_events_core.js`, `player_unsolicited_event_templates.js`, `player_unsolicited_event_effects.js`, and `player_unsolicited_event_defs_{common,trade,social,...}.js`. A shared namespace object can be populated across files and finalized in the export file.
**Risk assessment:** Medium. Script order becomes important, so this should be done with a deliberate load-order plan.

### [MEDIUM] Add a smoke-test harness for definitions, templates, and effect keys
**Location:** `player_unsolicited_events.js:385-587, 687-26108, 26395-26450`
**Current state:** The module is hard to test because behavior is spread across repeated function literals, global helpers, and swallowed exceptions.
**Problem:** Without an automated smoke pass, any refactor of templates or effect routing will be high-risk. This is especially true once the duplication starts getting removed.
**Suggested refactor:** Add a dev-only harness that iterates all defs with mocked `player`/`ctx`/`rng`, verifies generation, renders each reachable step, and checks that every `choice.effectKey` has both a narrative and an effect implementation.
**Risk assessment:** Low. The main cost is maintaining the harness as templates evolve, but it will pay for itself quickly during refactors.
