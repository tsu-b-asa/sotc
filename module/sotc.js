/**
 * The fruits of many hours of labour to bring you a system most ideal
 * Author: Tsubasa
 * Used Atropos' simple system boilerplate
 * 
 * Vani's sotc.js is MUCH nicer looking than mine, to the point where one ought to consider it embarrassing
 *  For now, this is gonna be a mess on my end. At some point I will also refactor it into an additional combat 
 *  and damage wizard file (as well as a clash wizard), but I find myself once again not minding a bit of a mess
 *  so long as that mess is functional. I realize this makes it harder to work with the system in-so-far as forking
 *  or creating modules. For that, I am sincerely sorry. Hopefully the very many lines of documentation I have
 *  added are helpful to you.
 */

// Import Modules
import { SotCActor } from "./actor.js";
import { SotCItem } from "./item.js";
import { SotCActorSheet } from "./actor-sheet.js";
import { SotCSkillSheet } from "./skill-sheet.js";
import { SotCStatusSheet } from "./status-sheet.js";
import { SotCPassiveSheet } from "./passive-sheet.js";
import { SotCToken, SotCTokenDocument } from "./token.js";
import { preloadHandlebarsTemplates } from "./templates.js";
import { createSotCMacro } from "./macro.js";
import { SOTCHotbar } from "./macro.js";
import { escapeHTML } from "./helper.js";

/* -------------------------------------------- */
/*  Foundry VTT Initialization                  */
/* -------------------------------------------- */

/**
 * Init hook.
 */
Hooks.once("init", async function() {
  console.log("Initializing SotC");

  /**
   * This doesn't really matter that much, mainly just setting the decimal value and providing a base intiative if you flub it in character creation somehow, or if there's a mistake on my end haha.
   * @type {String}
   */
  CONFIG.Combat.initiative = {
    formula: "1d6",
    decimals: 2
  };

  // Gives us v11 and v13 compatibility by trying the v13 and then defaulting to the old
  const audio_helper_class = foundry?.audio?.AudioHelper ?? AudioHelper;

  // TSU! COME BACK AND LOOK AT THIS! Compare with Vani, and use whatever was done there to make it better
  // This APPEARS to work, but I don't think it's the most durable solution I could use, but in the end it does have a failsafe in case things explode a little bit
  // This SHOULD affect when initiative is rolled via the roll all button, the roll NPC button (NPCs don't exist yet but pretend that I'm not dumb (or if they do exist pretend that I came back and commented this out))
  // And then also by clicking the dice button to roll initiative. I'm only unsure of if this works durably now because I didn't document it fully initially.
  // Anyways, in the future I'll probably add something that lets the user modify the dice when clicking to roll initiative
  class SotCCombat extends Combat {
    async rollInitiative(ids, { formula = null, updateTurn = true, messageOptions = {} } = {}) {
      ids = typeof ids === "string" ? [ids] : ids;
      const combatants = this.combatants.filter(c => ids.includes(c.id));
      const updates = [];
      
      for (let c of combatants) {
        const actorId = c.actorId;
        // First, find all of the clones of our actor, appropriately identifying if those are clones of an actor or clones of a token
        //  so that we don't have mooks overlap
        const same_combatant_group = other_c => c.token?.isLinked ? other_c.actorId === actorId : other_c.tokenId === c.tokenId;
        // Next, go through every entity in the combat tracker and check if they are the correct combatant that we're looking for 
        //  AND that they are NOT a clone (the original, starwalker). Fallback to c
        const base_combatant = this.combatants.find(other_c => same_combatant_group(other_c) && !other_c.getFlag("sotc", "isSpeedDieClone")) ?? c;
        // Base combatant is exactly the one we're looking for now, so we're all good here to just say actor = base_combatant.actor, using the base actor's status
        //  effects instead of worrying if our clones have them
        const actor = base_combatant.actor;
        if (!actor) continue;
        await actor.prepareData();
        await actor.prepareDerivedData();
        console.log({
          combatant: c.name,
          actorId: c.actor?.id,
          actorUUID: c.actor?.uuid,
          actorIsBase: c.actor === base_combatant.actor,
          tokenId: c.tokenId,
          actorType: c.actor?.constructor?.name
        });

        const actor_formula = actor?.system?.speed_dice?.dice_size;
        let total_formula = `${actor_formula}`

        const init_mod = actor?.system?.modifiers.speed_mod ?? 0;

        const actor_type = actor?.system?.initiative_type;
        
        if (init_mod > 0) {
          total_formula = `${total_formula}+${init_mod}`;
        } 
        else if (init_mod < 0) {
          total_formula = `${total_formula}-${-init_mod}`;
        }
        // const isSpeedDie = c.flags?.sotc?.isSpeedDieClone; <- Not Needed in the current version 
        const final_formula = (total_formula && Roll.validate(total_formula))
          ? total_formula
          : formula || CONFIG.Combat.initiative.formula; // This is our given failsafe

        const roll = await (new Roll(final_formula).evaluate({ async: true }));
        let final_init = Math.max(1, roll.total);
        if (actor_type === "player") {
          final_init = final_init+0.01
        }

        updates.push({ _id: c.id, initiative: final_init });

        // Post chat message or accumulate it
        if (this._sotcGroupInitiative) {
          this._sotcGroupInitiative.push({
            name: c.name,
            img: c.actor?.img ?? "icons/svg/mystery-man.svg",
            formula: actor_formula,
            rolled: roll.total - init_mod,
            mod: init_mod,
            final: final_init,
            type: actor_type
          });
        } else {
          await roll.toMessage({
            speaker: ChatMessage.getSpeaker({ actor: c.actor }),
            flavor: `${c.name} rolls initiative (${roll.total - init_mod} → ${final_init})`,
          }, messageOptions);
        }
      }

      // Update initiatives
      await this.updateEmbeddedDocuments("Combatant", updates);
      if (updateTurn) this.update({ turn: this.turns.findIndex(t => t.initiative !== null) });
      return this;
    }

    // The purpose of this code (provided by Vani and modified by myself) is to prevent the roll all initiative button from BLASTING your
    //  ears out. Instead, it plays a single nice Ruina fingersnap. Notably, I chose to keep the base roll sound for all other things
    //  and only change the roll all sound effect to the finger snap. Works for both roll all and roll npc buttons
    async _rollHelper(ids, options = {}) {
      if (!ids.length) return this;

      // Used to group together initiatives instead of spamming the chat <- an excellent idea from Vani
      this._sotcGroupInitiative = [];

      // Silence sound for every individual roll, then restore the original sound
      try {
        CONFIG.sounds.dice = null;
        await this.rollInitiative(ids, options);
      } finally {
        CONFIG.sounds.dice = "sounds/dice.wav";
      }

      const ruina_snap = "systems/sotc/assets/audio/speed_dice.mp3";
      // Play once
      if (ruina_snap) {
        audio_helper_class.play({ src: ruina_snap, volume: 0.5, autoplay: true, loop: false }, true);
      }

      // Grouped Initiative Card
      const initRows = this._sotcGroupInitiative ?? [];
      delete this._sotcGroupInitiative;

      if (initRows.length) {
        const round = this.round ?? 1;
        const ordered_rows = initRows.sort((a,b) => b.final - a.final);

        const typeColor = r => r.type === "player" ? "#4caf7d" : "#e05050";
        const modStr = r => r.mod > 0 ? `+${r.mod}` : r.mod < 0 ? `${r.mod}` : "#ffffff";

        const rowsHtml = ordered_rows.map(r => `
          <div style="display: flex; align-items: center; gap: 8px; padding: 3px 0; border-top: 1px solid #1e1c2a;">
            <img src="${r.img}" style="width: 22px; height: 22px; border-radius: 50%; object-fit: cover; border: 1px solid #3a3050; flex-shrink: 0;">
            <span style="flex: 1; font-size: 12px; color: #ddd;">${r.name}</span>
            <span style="font-size: 12px; color: #888;">${r.formula} = ${r.rolled}</span>
            <span style="font-size: 14px; color: #efc281; margin-right: 2px; margin-left: 2px;">→</span>
            <span style="font-size: 14px; font-weight: bold; text-align: right; min-width: 14px;
              ${r.mod < 0 
                ? 'color: #DD0000; text-shadow: #000 0 0 5px, #000 0 0 5px;' 
                : r.mod > 0 
                  ? 'color: #000000; text-shadow: #fc0 0 0 5px, #fc0 0 0 5px, #fc0 0 0 5px, #fff 0 0 5px;' 
                  : 'color: #ffffff; text-shadow: #fc0 0 0 5px;'
              }">
                ${Math.floor(r.final)}
            </span>
          </div>`).join("");

        const cardHtml = `
          <div style="border: 1px solid #efc281; border-radius: 6px; padding: 10px;">
            <div class="sotc-init-toggle" style="margin-bottom: 8px;">
              <strong style="color:#efc281; font-size:14px;">Initiative — Round ${round}</strong>
            </div>
            <div class="sotc-init-rows" data-collapsed="false">${rowsHtml}</div>
          </div>`;

        await ChatMessage.create({
          speaker: { alias: "Combat" },
          content: cardHtml,
          flags: { sotc: { initiativeGroup: true } }
        });
      }

      return this;
    }
    
    async rollAll(options = {}) {
      // Get all combatant ids that haven't rolled initiative yet
      const ids = this.combatants
        .filter(c => c.initiative === null)
        .map(c => c.id);
        
      return this._rollHelper(ids, options);
    }

    /** @override */
    async rollNPC(options = {}) {
      // Get all combatant ids that are NOT player characters (which i think is defined by player ownership) and that have not rolled yet
      const ids = this.combatants
        .filter(c => c.isNPC && c.initiative === null)
        .map(c => c.id);
        
      return this._rollHelper(ids, options);
    }
  }

  CONFIG.Combat.documentClass = SotCCombat;
  
  game.sotc = {
    SotCActor,
    createSotCMacro
  };

  // Define our custom Document classes. The SotCTokenDocument and SotCToken classes aren't vestigial, but I never interacted with them.
  // If I just lied to you and I DID change them, it's because I didn't come back to change this comment. Haha I'm great at this either way.
  CONFIG.Actor.documentClass = SotCActor;
  CONFIG.Item.documentClass = SotCItem;
  CONFIG.Token.documentClass = SotCTokenDocument;
  CONFIG.Token.objectClass = SotCToken;

  // More work, specifically for our Actor sheets and Item sheets.
  // PLEASE come back and localize this later. We should ideally make this work for like, Russian, Korean, Chinese, and Japanese if we're serious about it.
  CONFIG.Actor.types = ["character"]; // No NPC Yet!!!!!!
  CONFIG.Item.types = ["skill", "ego", "status", "passive"];
  CONFIG.Actor.typeLabels = {
    character: "Character",
  //  npc: "NPC"  <- Still Not Yet!!!!!!!!!!
  };
  CONFIG.Item.typeLabels = {
    skill: "Skill",
    ego: "EGO",
    status: "Status",
    passive: "Passive"
  };

  // Register sheet application classes
  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("sotc", SotCActorSheet, {types: ["character"], makeDefault: true});
  Items.unregisterSheet("core", ItemSheet);
  Items.registerSheet("sotc", SotCSkillSheet, {types: ["skill", "ego"], makeDefault: true});
  Items.registerSheet("sotc", SotCStatusSheet, {types: ["status"]});
  Items.registerSheet("sotc", SotCPassiveSheet, {types: ["passive"]});

  //###################### SYSTEM SETTINGS ########################//
  // Register system settings for thwatever the heck this macroShorthand is? Rather, I think I know what it's for, but it doesn't do anything right now. Lets nuke it!
  // Nevermind! I can't nuke it. It's important. It came with Atropos' boilerplate.
  game.settings.register("sotc", "macroShorthand", {
    name: "SETTINGS.SotCMacroShorthandN",
    hint: "SETTINGS.SotCMacroShorthandL",
    scope: "sotc",
    type: Boolean,
    default: true,
    config: true
  });

  // This sets up our version as not truthy, which we do specifically for the sake of handling updates (we don't want to try to map things for new installs if there's)
  //  No version established. Otherwise, schemaVersion is my way of identifying if the system has updated and needs mapping (including what specific mapping it may need if)
  //  we end up encountering a jump in version from v1.05 to 1.07 or something. Gotta plan for my adorable users in the future, right?
  game.settings.register("sotc", "schemaVersion", {
    scope: "world",
    config: false,
    type: String,
    default: ""
  });
  //###################### SYSTEM SETTINGS (end) ########################//

  /**
   * Slugify a string.
   */
  Handlebars.registerHelper('slugify', function(value) {
    return value.slugify({strict: true});
  });

  /**
   * Shamelessly stolen, naturally, for the sake of having access to these when I need them.
   */  
  Handlebars.registerHelper({
    eq: (v1, v2) => v1 === v2,
    ne: (v1, v2) => v1 !== v2,
    lt: (v1, v2) => v1 < v2,
    gt: (v1, v2) => v1 > v2,
    lte: (v1, v2) => v1 <= v2,
    gte: (v1, v2) => v1 >= v2,
    and() {
        return Array.prototype.every.call(arguments, Boolean);
    },
    or() {
        return Array.prototype.slice.call(arguments, 0, -1).some(Boolean);
    }
  });

  // Preload template partials
  await preloadHandlebarsTemplates();
});

/**
 * Macrobar hook.
Hooks.on("hotbarDrop", async (bar, data, slot) => {
  if (data.type !== "Item") return true;

  const item = await fromUuid(data.uuid);
  if (!item) return true;

  if (!["skill", "ego"].includes(item.type)) return true;

  await SOTCHotbar.createSkillMacro(item, slot);
  return false;
});
 */

/**
 * Adds the actor template context menu.
 */
Hooks.on("getActorDirectoryEntryContext", (html, options) => {

  // Define an actor as a template.
  options.push({
    name: game.i18n.localize("SOTC.DefineTemplate"),
    icon: '<i class="fas fa-stamp"></i>',
    condition: li => {
      const actor = game.actors.get(li.data("documentId"));
      return !actor.isTemplate;
    },
    callback: li => {
      const actor = game.actors.get(li.data("documentId"));
      actor.setFlag("sotc", "isTemplate", true);
    }
  });

  // Undefine an actor as a template.
  options.push({
    name: game.i18n.localize("SOTC.UnsetTemplate"),
    icon: '<i class="fas fa-times"></i>',
    condition: li => {
      const actor = game.actors.get(li.data("documentId"));
      return actor.isTemplate;
    },
    callback: li => {
      const actor = game.actors.get(li.data("documentId"));
      actor.setFlag("sotc", "isTemplate", false);
    }
  });
});

/**
 * Adds the item template context menu.
 */
Hooks.on("getItemDirectoryEntryContext", (html, options) => {

  // Define an item as a template.
  options.push({
    name: game.i18n.localize("SOTC.DefineTemplate"),
    icon: '<i class="fas fa-stamp"></i>',
    condition: li => {
      const item = game.items.get(li.data("documentId"));
      return !item.isTemplate;
    },
    callback: li => {
      const item = game.items.get(li.data("documentId"));
      item.setFlag("sotc", "isTemplate", true);
    }
  });

  // Undefine an item as a template.
  options.push({
    name: game.i18n.localize("SOTC.UnsetTemplate"),
    icon: '<i class="fas fa-times"></i>',
    condition: li => {
      const item = game.items.get(li.data("documentId"));
      return item.isTemplate;
    },
    callback: li => {
      const item = game.items.get(li.data("documentId"));
      item.setFlag("sotc", "isTemplate", false);
    }
  });
});

Hooks.on("renderCombatTracker", (app, html) => {
  const root = html instanceof HTMLElement ? html : html[0];
  if (!root) return;

  // If we don't actively remove the status effects then they end up supremely cluttering the initiative tracker
  for (const el of root.querySelectorAll(".combatant")) {
    for (const img of el.querySelectorAll(".token-effects img")) {
      const statusId = img.dataset.statusId;
      if (statusId !== "dead") {
        img.remove();
      }
    }
  }

  for (const li of root.querySelectorAll(".combatant")) {
    const combatantId = li.dataset.combatantId;
    const combatant = game.combat.combatants.get(combatantId);

    const isUsed = combatant.flags?.sotc?.used;

    // Get the .combatant-controls div
    const controls = li.querySelector(".combatant-controls");
    if (!controls) continue;

    const usedButton = document.createElement("a");
    usedButton.classList.add("combatant-control");
    usedButton.dataset.control = "toggleUsedSpeedDie";
    usedButton.dataset.tooltip = "Toggle Speed Dice as Used/Unused";
    usedButton.setAttribute("aria-label", "Toggle Speed Dice as Used/Unused");
    usedButton.setAttribute("role", "button");

    // Icon reflects use state yippeeeeee
    const icon = document.createElement("img");
    icon.src = isUsed ? "systems/sotc/assets/icons/used.png" : "systems/sotc/assets/icons/unused.png";
    icon.alt = "Used Speed Die";
    icon.style.width = "20px";
    icon.style.height = "20px";
    icon.classList.add("used_and_unused_icons");
    usedButton.appendChild(icon);

    if (combatant.isOwner || game.user.isPrimaryGM) {
      usedButton.addEventListener("click", async (ev) => {
        ev.preventDefault();
        const newUsed = !isUsed;
        await combatant.setFlag("sotc", "used", newUsed);
      });
    } else {
      usedButton.style.pointerEvents = "none";
      usedButton.style.opacity = "0.0";
    }

    // Append the button to the controls, which looks only a little jank
    controls.appendChild(usedButton);

    // Visually mark the row as used by...
    li.classList.toggle("used-speed-die", isUsed);

    // ... greying it out
    if (isUsed) {
      li.style.opacity = "0.4";
    } else {
      li.style.opacity = "";
    }
  }
});

Hooks.on("createCombatant", async (combatant, options, userId) => {
  // If someone other than the gm runs the code (as it's run client side), then things get messy and we get duplicate entries
  // As pointed out to me by _twitch_ my former fix of "if (!game.user.isGM) return;" did not work, because we could have assistant GMs in the mix
  // Now, we let each machine conduct this step, checking to see if they made the combatant. If not, they do nothing, and if so then make the duplicates!
  if (typeof userId === "string") {
    if (userId !== game.user.id) return;
  } else {
    // Fallback, will have the same issue for multiple connected machines
    if (!game.user.isGM) return;
  }

  if (combatant.flags?.sotc?.isSpeedDieClone) return;
  const actor = combatant.actor;
  if (!actor || !actor.system?.speed_dice) return;

  const num_dice_mod = actor.system.modifiers.num_speed_dice_mod ?? 0;
  const temp_num_dice = actor.system.speed_dice.num_dice + num_dice_mod ?? 1;
  if (temp_num_dice <= 1) return;

  // You had to start with 1 combatant already to get more, obv
  setTimeout(async () => {
    for (let i = 1; i < temp_num_dice; i++) {
      await combatant.parent.createEmbeddedDocuments("Combatant", [{
        actorId: actor.id,
        tokenId: combatant.tokenId,
        hidden: false,
        initiative: null,
        name: `${combatant.name} #${i + 1}`,
        flags: {
          sotc: {
            isSpeedDieClone: true,
            speedDieIndex: i
          }
        }
      }]);
    }
  }, 50);
});

Hooks.on("deleteCombatant", async (combatant, options, userId) => {
  // This means that, when adjusting # of speed dice in combatround by deleting a combatant, we don't explode all the instances of the combatant
  if (combatant.getFlag("sotc", "isSpeedDieClone")) return;

  const combat = combatant.parent;
  const actorId = combatant.actorId;
  const tokenId = combatant.tokenId;
  if (!actorId || !tokenId) return;

  // Remove only other combatants that are clones of THIS token
  const toRemove = combat.combatants.filter(c =>
    c.actorId === actorId &&
    c.tokenId === tokenId &&
    c.id !== combatant.id &&
    c.getFlag("sotc", "isSpeedDieClone")
  );

  if (toRemove.length > 0) {
    await combat.deleteEmbeddedDocuments("Combatant", toRemove.map(c => c.id));
  }
});

// Now we take care of our initiative, compensating for the dice being of variable size and power
// I can't remember, do I even use this anywhere?
Hooks.on("preRollInitiative", (combat, combatants, rollOptions) => {
  for (let combatant of combatants) {
    const actor = combatant.actor;
    // Not Needed? -> const isSpeedDie = combatant.flags?.sotc?.isSpeedDieClone;
    const actorFormula = actor?.system?.speed_dice?.dice_size;
    const actorType = actor?.system?.initiative_type

    // Only override formula if valid and a speed die clone
    if (actorFormula && Roll.validate(actorFormula)) {
      console.log(`Overriding initiative roll for ${combatant.name} with formula: ${actorFormula}`);
      if (actorType === "player") {
        const total = actorFormula + 0.01
        rollOptions.formula = total
      } else {
        rollOptions.formula = actorFormula
      }
    }
  }
});

// Our most wonderful helper function which accepts the values provided by the status effect created by a user and returns to us the new value for the status effect
// This doth make for a much more elegant solution than _onPostActive, but you shant see me replace _onPostActive with this update. I am, haha, uhhh, busy
function applyOperator(value, operator, variable = 0) {
  switch (operator) {
    case "maintain": return value;
    case "clear": return 0;
    case "add": return value + variable;
    case "subtract": return Math.max(value - variable, 0);
    case "multiply": return value * variable;
    case "divide": return Math.floor(value / Math.max(variable, 1));
    default: return value;
  }
}

// New scene, new initiative! We don't currently preserve the previous round's initiative which SUCKS for the sake of accidentally skipping a round
Hooks.on("combatRound", async (combat, round) => {
  if (!game.user.isGM || !game.users.activeGM?.isSelf) {
    console.log("Stopping combatRound from running on multiple devices, just to be safe...") 
    return;
  }
  console.log("Starting new round: resetting all speed dice initiative, restoring light, removing stagger_likes (where appropriate), handling end of scene effects");

  const combatant_updates = [];
  const combatants_to_delete = [];
  const processed_actors = new Set();


  for (let c of combat.combatants) {
    const actor_updates = {};
    const actor_stag_updates = {};

    const actorId = c.actorId;

    // First, find all of the clones of our actor, appropriately identifying if those are clones of an actor or clones of a token
    //  so that we don't have mooks overlap
    let same_combatant_group = other_c => c.token?.isLinked ? other_c.actorId === actorId : other_c.tokenId === c.tokenId;
    // Next, go through every entity in the combat tracker and check if they are the correct combatant that we're looking for 
    //  AND that they are NOT a clone (the original, starwalker). Fallback to c
    const base_combatant = combat.combatants.find(other_c => same_combatant_group(other_c) && !other_c.getFlag("sotc", "isSpeedDieClone")) ?? c;

    const actor = base_combatant.actor;
    if (!actor?.system?.speed_dice) continue; // I don't really know WHY we would, but in case you're using an actor in combat with no speed dice then uhhh, yeah?

    const stag_status_updates = [];
    const stag_statuses = actor.items.filter(i => i.type === "status" && (i.system.condition === "stagger_like") && (i.system.count > 0));
    for (const stag_status of stag_statuses) {
      if (round.round >= stag_status.system.stagger_end) {
        if (stag_status.system.stagger_effects?.reset_stagger) {
          actor_stag_updates["system.stagger.value"] = actor.system.stagger.max
        }
        stag_status_updates.push({
          _id: stag_status.id,
          "system.count": 0
        });
      }
    }

    if (stag_status_updates.length) {
      await actor.updateEmbeddedDocuments("Item", stag_status_updates);
    }

    const modifiers = actor.system.modifiers ?? {};
    if (!modifiers.null_speed_dice) {
      combatant_updates.push({
        _id: c.id,
        initiative: null,
        "flags.sotc.used": false
      });
    }

    // The above affect should trigger for all instances of a combatant (all speed dice), while everything below this point should only trigger once for an actor
    // The previous implementation short-sightedly failed to acknowledge that there can be multiple copies of an actor on a scene, with independent tokens for 'mook'
    // enemies. Thus it would skip mooks when we did not want it to.
    // Vani helped to provide the following solution.
    const processed_key = c.token?.isLinked ? actor.id : c.tokenId;
    if (processed_actors.has(processed_key)) continue;
    processed_actors.add(processed_key);

    const status_updates = [];
    const statuses = actor.items.filter(i => i.type === "status" && (i.system.condition !== "stagger_like") && (i.system.count > 0));
    let delta_hp = 0;
    let delta_stagger = 0;
    let min_hp = 9999;
    let min_stag = 9999;
    for (const status of statuses) {
      if ((status.system.condition === "active") && (status.system.scene_end_effect.activate_var === "activate")) {
        const effect_type = status.system.effect;
        const flat_change = Number(status.system.potency_flat ?? 0)
        const potency = Number(status.system.potency ?? 1);
        const count = Number(status.system.count ?? 0);
        let delta = Math.floor(count * potency + flat_change);
        const sign = effect_type === "Decrease" ? -1 : 1;
        if (status.system.target === "hp" || status.system.target === "hp_stagger") {
          // For the sake of statuses like sinking where we don't want to go below 1.
          //  For each item, go through and set the minimum until we have the lowest minimum (favours status strength, target weakness)
          min_hp = Math.min(Number(status.system.min_stat) ?? -999, min_hp)
          delta_hp += delta * sign
        }
        if (status.system.target === "stagger" || status.system.target === "hp_stagger") {
          min_stag = Math.min(Number(status.system.min_stat) ?? -999, min_stag)
          delta_stagger += delta * sign
        }
      }
      if (status.system.scene_end_effect.operator === "clear") {
        status_updates.push({
          _id: status.id,
          "system.count": 0
        })
      } else if (status.system.scene_end_effect.operator !== "maintain") {
        const new_count = applyOperator(status.system.count, status.system.scene_end_effect.operator, status.system.scene_end_effect.variable);
        status_updates.push({
          _id: status.id,
          "system.count": Math.max(new_count, 0)
        })
      }
    }
    if (delta_hp) {
      actor_updates["system.health.value"] = Math.max((Number(actor.system.health.value) ?? 0) + delta_hp, min_hp);
    }
    if (delta_stagger) {
      actor_updates["system.stagger.value"] = Math.max((Number(actor.system.stagger.value) ?? 0) + delta_stagger, min_stag);
    }

    if (status_updates.length) {
      await actor.updateEmbeddedDocuments("Item", status_updates);
    }

    const light = actor.system.light;
    if (!modifiers.null_light_regen) {
      const current = Number(light.value) || 0;
      let regen_mod = modifiers.light_regen_mod || 0;
      const regen = Number(light.light_regen) + Number(regen_mod) || 0;
      const max = Number(light.max) || current;

      if (regen !== 0 && current < max) {
        const new_val = Math.max(Math.min(current + regen, max), 0);
        actor_updates["system.light.value"] = new_val;
      }
    }


    if (Object.keys(actor_updates).length) {
      await actor.update(actor_updates);
    }
    if (Object.keys(actor_stag_updates).length) {
      await actor.update(actor_stag_updates);
    }
    // As best as I am aware, we can now be confident that actor.system.modifiers has been updated after doing the above update.
    //  If the above update was NOT run, then we don't have to worry about accessing old data anyways
    //  This means that we should now be able to clear out any excess speed dice by shooting this combatant in the face I think,
    //  Thereby removing the speed dice if we're in excess. I think. Combatant combatant combatant combatant combatant
    // Therefore, we borrow some of Vani's work, and remove any excess clones or add new clones 
    // First, define the clones of our actor, appropriately identifying if those are clones of an actor or clones of a token
    //  so that we don't have mooks overlap
    same_combatant_group = other_c => c.token?.isLinked ? other_c.actorId === actor.id : other_c.tokenId === c.tokenId;
    // Next, go through every entity in the combat tracker and check if they are the correct combatant that we're looking for AND if they are a clone
    const clones = combat.combatants.filter(other_c => same_combatant_group(other_c) && other_c.getFlag("sotc", "isSpeedDieClone"));
    // Get the total number of speed dice we should have, here using the actor's data because the previous modifiers are outdated now
    const total_speed_dice = actor.system.modifiers.num_speed_dice;
    // We want clones = speed dice - 1
    if (clones.length >= total_speed_dice) {
      // Get the excess clones
      const excess = clones.slice(total_speed_dice - 1);
      // add them to the array for deletion
      combatants_to_delete.push(...excess.map(c => c.id));
    } else {
      // We still want clones = speed dice - 1, now we start with i = curr_clones for the sake of naming convention
      const curr_clones = clones.length;
      // Slow things down a bit so that we don't end up finishing the combatround updates before we're finished the work we need to do for the combatround updates (though it really shouldn't matter)
      await new Promise(resolve => setTimeout(resolve, 50));
      for (let i = curr_clones + 1; i < total_speed_dice; i++) {
        // Just exactly how we create our combatants elsewhere, and elsewhere we have the appropriate safety to prevent clones from making more clones
        await c.parent.createEmbeddedDocuments("Combatant", [{
          actorId: actor.id,
          tokenId: c.tokenId,
          hidden: false,
          initiative: null,
          name: `${c.name} #${i + 1}`,
          flags: {
            sotc: {
              isSpeedDieClone: true,
              speedDieIndex: i
            }
          }
        }]);
      }
    }
  }
  
  if (combatant_updates.length) {
    await combat.updateEmbeddedDocuments("Combatant", combatant_updates);
  }

  if (combatants_to_delete.length) {
    await combat.deleteEmbeddedDocuments("Combatant", combatants_to_delete);
  }
});


// At long last, replacing the previous kind of trash impelementation, we are now hooking our status effects into the default system status effects.
// And hurray! That means that YOU Mr/Mrs. Player can now mark people as prone and unconscious and asleep!
const SOTC_BASE_EFFECTS = new Set([
  "dead",
  "prone",
  "unconscious",
  "sleep"
]);

// As we OUGHT TO, and as is our right as Project Moon fans, our statuses need to have fancy little coloured icons and names 7 paragraphs long with
//  chinese characters in parantheses. Hence, we do not have any need for the base status effects (except those mentioned above).
//  Purging these at init makes the most sense, and should've been something I was doing ages ago.
Hooks.once("init", async function() {
  CONFIG.statusEffects = CONFIG.statusEffects.filter(
    e => SOTC_BASE_EFFECTS.has(e.id)
  );
});

// First attempts to access where TokenHUD should be in newer versions, then provides TokenHUD as a fallback for v11
const TokenHUDClass = foundry?.applications?.hud?.TokenHUD ?? TokenHUD;

// Same as above
const TokenClass = foundry?.canvas?.placeables?.Token ?? Token;

// Helper that gets our ActiveEffect for a given status effect which we need for rendering our statuses
function getActorStatusEffect(actor, statusId) {
  return actor.effects.find(e => e.statuses?.has(statusId));
}

// Helper that correctly gives us our ActiveEffects or obliterates them from existence if they set their count to 0
// This is how our items end up becoming ActiveEffects, prior to their rendering and the rest of their handling
async function syncStatusItemEffect(item) {
  if (item.type !== "status") return;
  const actor = item.actor;
  if (!actor) return;

  // This works fine. The use of activeGM prohibits duplication (there is only ever one activeGM, as far as I can tell)
  if (!actor.isOwner || !(game.user === game.users.activeGM)) return;

  const count = Number(item.system?.count ?? 0);
  const existing = getActorStatusEffect(actor, item.id);

  // Add when need to <- Why am I speaking like a caveman for this?
  // Add the status effect to the actor using an ActiveEffect that can be rendered over the token, if it does not already exist
  if (count > 0 && !existing) {
    await actor.createEmbeddedDocuments("ActiveEffect", [{
      name: item.name,
      icon: item.img,
      statuses: [item.id],
      origin: item.uuid,
      transfer: false,
      flags: {
        sotc: {
          statusItemId: item.id
        }
      }
    }]);
    return;
  }

  // Remove when need to <- alright caveman is fine here, it's trivial
  if (count <= 0 && existing) {
    await existing.delete();
  }
}


// This does the work of rendering the count onto our status effects, and otherwise allows foundry to draw the status effects as it normally would.
// It's fairly non-interventionist with what foundry wants to do, and more or less just adds onto it.
Hooks.once("ready", () => {

  // Our original draw effects. Funny how it's called original draw effects, huh?
  const originalDrawEffects = TokenClass.prototype.drawEffects;

  // Now that we have the originals, we go through our own drawing work...
  TokenClass.prototype.drawEffects = async function (...args) {

    // This prevents us from having another instance of this function excute at the same time as the current execution
    //  as a defensive measure to further make sure our status effects don't explode
    if (this._sotcDrawingEffects) return;
    this._sotcDrawingEffects = true;

    // Using try (instead of just running it raw) means that we can use finally to make sure that 
    //  this._sotcDrawingEffects = false; after we're done our work, regardless of if our work succeeded or failed
    try {
      // First, foundry draws its normal stuff. This MIGHT resolve some issues in which Foundry sometimes tweaked out and would allow some og status effects to be applied?
      await originalDrawEffects.apply(this, args);

      // Delay for foundry to finish its work, as we aim to hook onto the status icon and place the count badge on top of it
      await new Promise(resolve => requestAnimationFrame(resolve));

      // This is referring to the token we're drawing on, so, ye
      const actor = this.actor;
      if (!actor || !this.effects) return;

      // All icon sprites currently on the token, and if there are none then we're done. Hurray!
      // Essentially the sprites that have been placed previously that we then go backwards from to add the badges to
      const sprites = this.effects.children.filter(c => c.isSprite);
      if (!sprites.length) return;

      // Used, as mentioned below, to skip over icons that have already been used. This is... stupid as an implementation,
      //  but generally you should NOT have duplicate status effect icons on a character sheet anyways
      const used_sprites = new Set();

      // Now go through each of the sprites to add the count badges to them
      for (const effect of actor.effects) {

        // ...by this! Our custom link between ActiveEffect and status items, as created by syncStatusItemEffect above :))))
        const statusId = effect.flags?.sotc?.statusItemId;
        if (!statusId) continue;

        // Matching status item from our actor
        const item = actor.items.get(statusId);
        if (!item || item.type !== "status") continue;

        // Skip stagger_likes, because they don't need a count on them
        if (item.system.condition === "stagger_like") continue;

        const count = Number(item.system.count ?? 0);
        if (count <= 0) continue;

        // Match effect sprite by image path
        const effectImg = effect.img ?? effect.icon;

        // Okay okay, so, we search through our sprites and we find whichever one matches the specific filename of our effect, matching up
        //  the status effects accordingly. This... hold on... if I have two statuses with the same icon (you're trolling if you do this) then
        //  it could explode. Best option is to create a list of used up sprites, so we can bypass the first X instances of a duplicate status icon
        const sprite = sprites.find(s => {
          // If we've used this sprite, skip it
          if (used_sprites.has(s)) return false;

          // Acquire the icon path
          const src = s.texture?.baseTexture?.resource?.src;
          // Compare src and effectImg, dropping capitalization for the sake of not exploding
          // Returns true if src and effectImg exist AND src is contained within the path of effectImg
          return src && effectImg && src.toLowerCase().includes(effectImg.split("/").pop().toLowerCase());
        });

        if (!sprite) continue;
        // Add the sprite, since it exists, so that we don't do that again for the same icon/sprite
        used_sprites.add(sprite);

        // Remove old count badges. First we retrieve the children. This adds some safety to resist spam, in case when this fires the sprites don't exist
        const children = Array.from(sprite.children ?? [])
        for (const child of children) {
          if (child.name === "sotc-count") sprite.removeChild(child);
        }

        // Get the bounds of the sprite so that we appropriately size the elements of the badge according to how big the scene is
        // This should be better behaved then the previous status effect handler as far as grid sizes go.
        const bounds = sprite.getLocalBounds();
        // There's the risk of bounds not existing if statuses are getting spam updated (a la combatround hook). This minimizes the damage, I suppose
        if (!bounds) continue;

        // Create count text
        const badge = new PIXI.Text(String(count), {
          fontSize: Math.floor(bounds.width * 0.4),
          fill: 0xffffff,
          stroke: 0x000000,
          strokeThickness: 4,
          fontWeight: "900"
        });

        // Name for future cleanup
        badge.name = "sotc-count";

        // Anchor the number to the bottom right
        badge.anchor.set(1, 1);

        // Position bottom-right, with some nice spacing
        badge.position.set(bounds.width, bounds.height);

        // Attach badge to sprite. And we're done. Hurray!
        sprite.addChild(badge);
      }
    } 

    // Now, as mentioned before= then NO MATTER WHAT, even if our catch succeeds or fails, we set this._sotcDrawingEffects=false so that we don't get locked out
    finally {
      this._sotcDrawingEffects = false;
    }
  };
});

// This does the work of #1. Rendering our custom statuses on our HUD and disposing of the ones we do not want
//    and #2. Making those statuses interactable and handling the logic of our +/- with left/right clicks
//    The logic of #2 was moved here (from the ready hook) for v13 compatibility, as not everything we need for this
//    implementation exists before the hud is rendered. In v11 we overrode TokenHUD.prototype._onToggleEffect in our ready,
//    now we don't do that because it's not possible in v13, as far as I understand. Also, we no longer pass data, since we use hud.object
Hooks.on("renderTokenHUD", (hud, html) => {
  // For version compatibility, normal the HTML (defensive very good yes)
  const el = html instanceof HTMLElement ? html : html?.[0];
  if (!el) return;

  // Gets the entire panel filled with status effects, which we'll need to clear then repopulate
  // Here t he first el.querySelector(".status-effects") is for v11 compatibility and el.querySelector('[data-tab="status-effects"]') is v13 compatibility
  // Whichever exists wins
  let effects_panel = el.querySelector(".status-effects");

  // v13
  if (!effects_panel) {
    effects_panel = el.querySelector('[data-tab="status-effects"]');
  }

  // And if neither of those worked, idk man just give up
  if (!effects_panel) {
    console.log("Hey! We can't find your effects panel! Let Tsubasa know in the SOTC discord please!!!")
    return;
  }

  // The token we clicked on, which should work the same as const token = canvas.tokens.get(data._id); across versions
  const token = hud.object;
  // The actor for the token clicked on (this actor instance is independent of other actors that use the same sheet on the scene but are unlinked)
  const actor = token?.actor;
  if (!actor) return;

  // Custom status items, ONLY those on the actor themself. I really wish I could just use snake_case everywhere...
  //  Anyways, same as above (HAH! the above is now gonE! And replaced with logic at Init! See above!)
  //  but now using our custom status effects to get the exact opposite result, essentially
  const status_items = actor.items.filter(i => i.type === "status");
  for (const item of status_items) {
    // Check if we already have our img created, so that we can then make it if it wasn't made yet
    let img = effects_panel.querySelector(
      `[data-status-id="${item.id}"]`
    );

    // Now, create it if it wasn't found above
    if (!img) {
      img = document.createElement("img");
      
      img.classList.add("effect-control");
      img.src = item.img;
      img.title = item.name;
      img.dataset.statusId = item.id;

      effects_panel.appendChild(img);
    }

    img.classList.toggle(
      "active",
      Number(item.system.count ?? 0) > 0
    );
  }

  // Prior to setting up our listener, we check if we have already set up the listener. If we have, we quit out
  if (el._sotcStatusListenerAttached) return;
  el._sotcStatusListenerAttached = true;

  // Mouse down will let us then discriminate between left and right click
  el.addEventListener("mousedown", async (event) => {
    // The status button that gets clicked on
    const img = event.target.closest(".effect-control");
    if (!img) return;

    // The ID of thte status that was clicked on const token = canvas.tokens.get(data._id); except with v11-13 compatibility
    const statusId = img.dataset.statusId;
    if (!statusId) return;
    
    // BEGONE FOUNDRY! (if it's one of our events)
    if (!SOTC_BASE_EFFECTS.has(statusId)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }

    // The token we clicked on, which should work the same as const token = canvas.tokens.get(data._id); across versions
    // Also note it's a different scope, so it's a redeclaration of the above const token, without conflicts
    const token = hud.object;
    // The actor for the token clicked on (this actor instance is independent of other actors that use the same sheet on the scene but are unlinked)
    const actor = token?.actor;
    if (!actor) return;

    // Foundry gets to handle its own status effects (that we permit to exist)
    if (SOTC_BASE_EFFECTS.has(statusId)) return;

    // The item itself, found using the ID
    const item = actor.items.get(statusId);
    // Extremely defensive and unnecessary, but it can do literally no harm and only good
    if (!item || item.type !== "status") return;


    // Our current count
    const current = Number(item.system.count ?? 0);
    // Given that we were just using  mousedown, now we get to discriminate! Hurray!
    const isRightClick = event.button === 2;

    // For our stagger_likes we don't need to display a count since they're binary on/off
    if (item.system.condition === "stagger_like") {
      // Additionally to not applying a count, we ALSO need to set the end duration for the stagger effect! This was missing before. Got it now!
      const applied_round = game.combat?.round ?? 0;
      const duration = item.system.stagger_duration ?? 0;
      await item.update({ "system.count": current > 0 ? 0 : 1, "system.stagger_end": applied_round + duration + 1 });
      return;
    }

    // Cut and dry, just decrement it by 1 baby.
    if (isRightClick) {
      await item.update({ "system.count": Math.max(current - 1, 0) });
    } else {
      await item.update({ "system.count": current + 1 });
    }
  // This forces our event to go before foundry. I'm hoping this prevents ghost status effects from appearing
  //  though regardless I'll add a button to clear all status effects and another button to clear status effects that aren't ours
  //  Again I'm a loser if I didn't do this for this update ^
  }, true);

  // Although it was a cosmetic issue, whenever right clicking the console would throw an error. This now prevents that from happening
  el.addEventListener("contextmenu", event => {
    // We only care about when an effect image is clicked on
    const img = event.target.closest(".effect-control");
    if (!img) return;

    // The ID of thte status that was clicked on const token = canvas.tokens.get(data._id); except with v11-13 compatibility
    const statusId = img.dataset.statusId;
    if (!statusId) return;

    // As before, let foundry handle its own status effects
    if (SOTC_BASE_EFFECTS.has(statusId)) return;

    // But if it's one of OUR status effects, explode foundry and don't do anything stupid
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  // Now, after all that work to add our status effects to the panel, we seek to add a second panel.
  // buildActiveStatusHUD(hud, html);
});

// Also provided various stuff provided by Vani. This will handle the counts not appearing on system refresh or what-have-you. Very simple and graceful fix.
// When a canvas/map loads, force all tokens to redraw their effects so count badges appear immediately.
// Without this, badges only show after a token is interacted with or updated.
// Some additional functions were added, as in testing (thanks Gab!) we noticed that things exploded when statuses got added sometimes. May as well throw a rerender in!
// The above comment (single line) was a delusional man thinking he could simply f5 away problems he caused. We're good now though.

// This one a la Vani, refresh when we load so that things are nice (i.e. to add counts to statuses). Added some animation frames so that we make sure everything
//   is settled before we add the counts
Hooks.on("canvasReady", async () => {
  requestAnimationFrame(() => {
    requestAnimationFrame(async () => {
      for (const token of canvas.tokens.placeables) {
        await token.drawEffects();
      }
    });
  });
});

// First is our helper. redrawActorTokens(actor), which for a given actor that has an item updated or created or what-have-you, will 
//  redraw the effects on that token. Now next to stop those ghost default status effects from showing up... I guess I need a status clear button on the sheet!
//  Anyways, more on the function. It does nto do the redraw immediately! Instead, it adds the token to a list of tokens needing a redraw, so that
//  when a bunch of statuses are changed things do not violently explode with bad timing

// pending_effect_redraws stores all the tokens that we are going to redraw, as provided by redrawActorTokens(actor)
const pending_effect_redraws = new Set();

function redrawActorTokens(actor) {
  if (!actor) return;

  for (const token of actor.getActiveTokens()) {
    // Skip this token if it's already queued up
    if (pending_effect_redraws.has(token)) continue;
    // Otherwise add it to the list
    pending_effect_redraws.add(token);

    // Do things SLOWLY (might look neat when combat round happens and we can see the dominos fall) <- nvm it looks like stuttering, but if it WORKS that's what counts
    requestAnimationFrame(async () => {
      // If all is good, then try the redraw
      try {
        if (!token.destroyed) {
          await token.drawEffects();
        }
      }
      // Hopefully we never see this, but who's to say?
      catch(err) {
        console.error("SotC | drawEffects failed", err);
      }
      // Remove this token from thet list of pending redraws
      finally {
        pending_effect_redraws.delete(token);
      }
    });
  }
}

// Second is our second helper, wowzers. updateStatusHUD(actor, item) concisely updates the specific item that's touched so that we don't have to rerender
//  the entire status HUD and get an aggregious flicker, like the previous version had that had Gab end up with prone on her character 500000 times. lul
function updateStatusHUD(actor, item) {
  const hud = canvas.hud.token;
  // Safety, hurrah
  if (!hud?.object) return;

  // More safety, more hurrah
  if (hud.object.actor !== actor) return;

  // For version compatibility, normal the HTML (defensive very good yes)
  const el = hud.element instanceof HTMLElement ? hud.element : hud.element?.[0];

  // Gets the entire panel filled with status effects, which we'll need to clear then repopulate
  // Here t he first el.querySelector(".status-effects") is for v11 compatibility and el.querySelector('[data-tab="status-effects"]') is v13 compatibility
  // Whichever exists wins
  let effects_panel = el.querySelector(".status-effects");

  // v13
  if (!effects_panel) {
    effects_panel = el.querySelector('[data-tab="status-effects"]');
  }

  // And if neither of those worked, idk man just give up
  if (!effects_panel) {
    console.log("Hey! We can't find your effects panel! Let Tsubasa know in the SOTC discord please!!!")
    return;
  }

  // Target the status effect that matches our relevant ID
  const img = effects_panel.querySelector(
    `[data-status-id="${item.id}"]`
  );

  // Or explode, hopefully not though. I should probably install some failsafe, considering the cases where something would be here that is falsey or null
  if (!img) return;

  // Apply glow up effect if the count is greater than 0 (this is also true for stagger-like effects thankfully)
  const active = Number(item.system.count ?? 0) > 0;

  // GLow up effect
  img.classList.toggle("active", active);
}


// Now for when we modify/create/delete items
Hooks.on("createItem", async (item) => {
  if (item.type === "status") {
    await syncStatusItemEffect(item);
    redrawActorTokens(item.actor);
  }
});

Hooks.on("updateItem", async (item, changes) => {
  if (item.type !== "status") return;

  // Redundant safety
  if (changes?.system?.count === undefined) return;

  await syncStatusItemEffect(item);
  // As mentioned above, now we update the HUD since the item has been updated
  updateStatusHUD(item.actor, item);
  /* We do NOT want to redraw, if possible, cuz it'll make things stutter in a bad manner.
      Haha, you fool it will NOT make things stutter. The fact that you were rebuilding the HUD entirely
      is what was making things stutter! FOOL!
      Now we DO want it, to make sure that when count drops to 0 we redraw, using this as our fallback to 
      make sure everything is good after something like a combatround hook triggers
  */
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      redrawActorTokens(item.actor);
    });
  });
});

// If we delete something, we want to make sure it doesn't get permanently stuck rendering. That'd be real awkward
Hooks.on("deleteItem", async (item) => {
  if (item.type !== "status") return;

  const actor = item.actor;
  if (!actor) return;
  // Correction provided by Vani. We were calling an older iteration of this function. I could stand to have consistent naming conventions, couldn't I...
  const effect = getActorStatusEffect(actor, item.id);
  if (effect) await effect.delete();
  redrawActorTokens(item.actor);
});

// Subsequent to the addition of our status effects to theh status window, I think it'd make life really nice to
//  hhave ANOTHER window where you can activate status effects (without having to open the actor sheet)
function buildActiveStatusHUD(hud, html) {
  // For version compatibility, normal the HTML (defensive very good yes)
  const el = html instanceof HTMLElement ? html : html?.[0];
  if (!el) return;

  // Gets the entire panel filled with status effects, which we'll need to clear then repopulate
  // Here t he first el.querySelector(".status-effects") is for v11 compatibility and el.querySelector('[data-tab="status-effects"]') is v13 compatibility
  // Whichever exists wins
  let effects_panel = el.querySelector(".status-effects");

  // v13
  if (!effects_panel) {
    effects_panel = el.querySelector('[data-tab="status-effects"]');
  }

  // And if neither of those worked, idk man just give up
  if (!effects_panel) {
    console.log("Hey! We can't find your effects panel! Let Tsubasa know in the SOTC discord please!!!")
    return;
  }

  // The token we clicked on, which should work the same as const token = canvas.tokens.get(data._id); across versions
  const token = hud.object;
  // The actor for the token clicked on (this actor instance is independent of other actors that use the same sheet on the scene but are unlinked)
  const actor = token?.actor;
  if (!actor) return;

  let active_panel = el.querySelector(".sotc-active-statuses");
  let active_panel_contents = el.querySelector(".sotc-active-body")

  if (!active_panel) {
    active_panel = document.createElement("button");
    active_panel.classList.add("sotc-active-statuses", "control-icon");
    active_panel.type = "button";
    active_panel.dataset.action = "togglePalette";
    active_panel.dataset.palette = "active_buttons"

    active_panel_contents = document.createElement("div")
    active_panel_contents.classList.add("sotc-active-body", "palette");
    active_panel_contents.dataset.palette = "active_buttons"

    effects_panel.after(active_panel);
    active_panel.after(active_panel_contents);
  }
}




// Purpose of this is to get our default status effects onto our actor sheets. I feel as though this might be putting the chicken before the egg though?
// Currently, this kinda just slops this on without the desired order (Strength, Endurance, Protection, Haste would be the order we desire), but that needn't necessarily
// be the case. I'm not even sure if it would be better to handle this in actor.js perhaps. Nice thing about this implementation is, if a GM adds new default statuses to
// the compendium, those will also be picked up and added.
Hooks.on("createActor", async (actor, options, userId) => {
  // Load the compendium
  const pack = game.packs.get("sotc.default-statuses");
  if (!pack) {
    console.error("SotC | Default statuses compendium not found. Please don't delete my (and your) default statuses compendium. If you did, try reinstalling the system perhaps?");
    return;
  }

  // Get all documents from the compendium
  const statuses = await pack.getDocuments();

  // Make sure they are Items
  const items = statuses.map(s => s.toObject());

  // Create them on the actor (skip if actor already has items with the same name)
  await actor.createEmbeddedDocuments("Item", items.filter(item =>
    !actor.items.some(ai => ai.name === item.name)
  ));
});

// Provides the functionality for the button on skill rolls that adds emotion points to the TOKEN
Hooks.on("renderChatMessage", (message, html) => {
  const emotion = message.getFlag("sotc", "emotion");
  if (!emotion) return;
  html.find(".emotion_counter").text(
    `${emotion.given} Emotion Points Given`
  );

  // For the emotion giving button, we listen here and do as necessary
  html.find(".give_emotion").on("click", async () => {
    const emotion = foundry.utils.deepClone(
        message.getFlag("sotc", "emotion")
    );

    // Info relevant to our token/actor is stored on the speaker
    const scene = game.scenes.get(message.speaker.scene);
    const token = scene?.tokens.get(message.speaker.token);
    if (!token) {
      ui.notifications.warn("Uhhh, we're missing the token you tried to apply this emotion too. Seems like it no longer exists!");
      return;
    }
    // Do the incrementation
    await token.actor.update({"system.emotion": Number(token.actor.system.emotion) + 1});

    // Do the incrementaiton for the sake of the button
    emotion.given++;

    await message.setFlag("sotc", "emotion", emotion);
  });
});

// This one makes it so that our rolls (the ones provided by foundry) can be opened and closed, making life much, much neater
Hooks.on("renderChatMessage", (message, html) => {
  // Check for our flag, and if it does not exist then get outta here
  const roll_flag = message.getFlag("sotc", "roll_details_open");
  if (roll_flag == null) return;

  // Get the dice rolls stored in the chat message
  const dice_rolls = html.find(".dice-roll");
  if (!dice_rolls.length) return;

  // Wrap the dice rolls that foundry has stored, so that we can then hide the contents
  dice_rolls.wrapAll(
      $('<div class="roll-details-wrapper"></div>')
  );
  // Assign  a variable for our resulting div
  const wrapper = html.find(".roll-details-wrapper");
  // Get the <a> element that does our toggling
  const toggle_button = html.find(".toggle-roll-details");

  // Access a stored piece of data on the element, which will be stored client side
  //  This is used client side instead of server side flags so that opening only effects the user
  const toggle_key = `sotc-roll-details-${message.id}`
  // Determine if we are open or not
  const open = localStorage.getItem(toggle_key) === "true";

  // Toggle our wrapper between visibility states depending on if it was previously visible
  wrapper.toggle(open);
  // Match to the desired closed text (though I think this should be default?)
  toggle_button.text(open ? "⯆ Hide Roll Details" : "⯈ Show Roll Details");

  // We previously updated the flag here, but that forced a rerender for EVERYONe
  //  Now the flag is just used to find this specific type of roll that has "Show Roll Details"
  //  And otherwise we client-side toggle the divs between visible or not, using the state of
  //  visibility to change the behaviour of the button
  toggle_button.on("click", async () => {
    const next = wrapper.is(":visible");
    wrapper.toggle(!next);
    toggle_button.text(next ? "⯈ Show Roll Details" : "⯆ Hide Roll Details");
    localStorage.setItem(toggle_key, !next);
  });
});


// Works with the skil rolling from actor-sheet.js (and the other places that also roll) to provide both our reroll button and our damage wizard button
Hooks.on("renderChatMessage", (message, html) => {
  html.find(".reroll-die").on("click", async ev => {
    ev.preventDefault();
    const btn = ev.currentTarget;

    const item_name = btn.dataset.itemname || "Unknown Item";
    const formula = btn.dataset.formula;
    const mod = btn.dataset.mod;
    const status_mod = btn.dataset.statmod;
    let total = formula
    if (mod !== 0) {
      total = `${total}+${mod}`;
    }
    if (status_mod !== 0) {
      total = `${total}+${status_mod}`;
    }
    const type = btn.dataset.type;
    const colorClass = btn.dataset.color;
    // In the future I'd like to make the modules do something non-cosmetic. Currently this just preserves them visually
    let modules;
    try {
      modules = JSON.parse(btn.dataset.modules || "[]");
      if (!Array.isArray(modules)) modules = [];
    } catch {
      modules = [];
    }

    try {
      const roll = await (new Roll(total)).roll({ async: true });

      const icon = `systems/sotc/assets/dice types/${type}.png`;
      const moduleLine = modules.length
        ? `<div style="margin-top: 4px; font-size: 12px;"><em>${
            modules.map(m => `<div style="margin-left: 5px;">• ${m}</div>`).join("")
          }</em></div>`
        : "";

      // As with the other places this is done, setting up the payload is for the sake of our damage wizard. We pass it to our messages, and with
      // each message we regenerate it using the information that's provided in message content.
      const payload = {
        dieType: type,
        total: roll.total,
        itemName: item_name,
        isOffensive: ["slash","pierce","blunt","counter-slash","counter-pierce","counter-blunt"].includes(type),
        isDefensive: ["block","evade","counter-block","counter-evade"].includes(type)
      };

      // Again, not particularly graceful, but creates the chat message with all the info needed to do rerolls and damage wizard applications. Probably includes
      // more info than needed, honestly. Notably drops the on use/affer use effects along the way, but I think that's fine because we're reroll individual die
      const messageContent = `
        <div class="skill-die-roll">
          <h3 style="margin-bottom: 4px; color: white; text-shadow: 0 0 5px #efc281, 0 0 5px #efc281;">${item_name} - Reroll ${type}</h3>
          <div style="margin-left:5px;margin-bottom:5px;">
            <span class="${colorClass}" style="margin-left: 5px; vertical-align: middle; font-size: 16px;">
              <div style="display: flex; gap: 4px;">
                <img src="${icon}" alt="${type}" style="height: 30px; width: 30px; vertical-align: middle; border: none;">
                <strong style="text-shadow: black 0.5px 0.5px; margin-top: 4px;">${total} = ${roll.total}</strong>
                <a class="reroll-die"
                  data-formula="${formula}"
                  data-type="${type}"
                  data-mod="${mod}"
                  data-statmod="${status_mod}"
                  data-color="${colorClass}"
                  data-modules='${JSON.stringify(modules)}'
                  data-itemname="${item_name}"
                  title="Reroll die!" 
                  style="width: 16px; height: 16px; color: #efc281; margin-left: 16px; margin-top: 4px;">
                  <i class="fas fa-rotate-left"></i>
                </a>
                <a class="resolve-die"
                  title="Apply Die!"
                  data-payload="${escapeHTML(JSON.stringify(payload))}"
                  style="width: 16px; height: 16px; color: #efc281; margin-left: 16px; margin-top: 4px;">
                  <i class="fas fa-bolt"></i>
                </a>
              </div>
            </span>
            ${moduleLine ? `${moduleLine}` : ""}
          </div>
        </div>
      `;

      await roll.toMessage({
        speaker: ChatMessage.getSpeaker(),
        flavor: messageContent,
        sound: CONFIG.sounds.dice
      });

    } catch (err) {
      console.error("Reroll failed:", err);
      ui.notifications.error("Could not reroll... :(");
    }
  });

  // Everything below this point should REALLY be in a separate .js document. I did this here because I could not be fucked to move it over
  // It is sunday, at 2:25 am and I feel like that one guy who did some songs for furi who names his tracks after the time when he finishes them
  // which is to say... fulfilled? I'm basically there and just reviewing code at this point...
  // But I kind of want to explode...
  html.find(".resolve-die").on("click", ev => {
    const payload = JSON.parse(ev.currentTarget.dataset.payload);
    openDamageWizard(payload);
  });
});

// Uses the payload provided by the message content in association with our funky little button
async function openDamageWizard(payload) {
  const targets = Array.from(game.user.targets);
  if (!targets.length) {
    return ui.notifications.warn("Select a target!");
  }

  // Currently applies our effects to only the first token targetted. Maybe it could be made to apply it to all, for the sake of things like mass attacks
  // or AOEs, but for now this makes life a bit safer, I guess? Am I being safe for no reason...?
  const token = targets[0];
  const actor = token.actor;

  // What's all this about wizards anyways? We aren't out here casting spells, haha
  const content = await renderTemplate("systems/sotc/templates/damage-wizard.html", {
    payload
  });

  new Dialog({
    title: `Damage Wizard`,
    content,
    buttons: {
      resolve: {
        label: "Resolve",
        callback: html => resolveDamage(payload, html, actor)
      },
      cancel: { label: "Cancel" }
    }
  }, {
    classes: ["sotc_damage_wizard"]
  }).render(true);
}

// All of this is fairly intuitive. It acknowledges resistances and the dice provided by the defender to correctly apply the attack
// TO THE DEFENDER ONLY. It has no effect on the attacker (the one who's skill the lightning bolt was clicked on) no matter what!
async function resolveDamage(payload, html, targetActor) {
  const mod = Number(html.find('[name="mod"]').val() || 0);
  const defenderType = html.find('[name="defender_die_type"]').val();
  const defenderRoll = Number(html.find('[name="defender_die"]').val() || 0);

  const attack = payload.total + mod;

  let damage = 0;
  let stagger = 0;

  if (payload.isDefensive && (defenderType === "evade" || defenderType === "counter-evade") && (defenderRoll > attack)) {
    const curr = targetActor.system.stagger.value;
    const final = Math.min(targetActor.system.stagger.max, curr + defenderRoll - attack);
    await targetActor.update({ "system.stagger.value": final });
    return;
  }

  // With evasion taken care of, we can just straight up leave if the attack roll is less than or equal to the defender's roll (clash won)
  if (defenderRoll >= attack) return;

  if (payload.isOffensive) {
    damage = attack;
    stagger = attack;
    if (payload.dieType === "slash" || payload.dieType === "counter-slash") {
      damage = Math.max(0, damage + targetActor.system.modifiers.slash_damage_affinity);
      stagger = Math.max(0, stagger + targetActor.system.modifiers.slash_stagger_affinity);
    } else if (payload.dieType === "pierce" || payload.dieType === "counter-pierce") {
      damage = Math.max(0, damage + targetActor.system.modifiers.pierce_damage_affinity);
      stagger = Math.max(0, stagger + targetActor.system.modifiers.pierce_stagger_affinity);
    } else {
      damage = Math.max(0, damage + targetActor.system.modifiers.blunt_damage_affinity);
      stagger = Math.max(0, stagger + targetActor.system.modifiers.blunt_stagger_affinity);
    }
    if (defenderType === "block" || defenderType === "counter-block") {
      damage = Math.max(0, damage - defenderRoll);
      stagger = Math.max(0, stagger - defenderRoll);
    }
    if (defenderType === "evade" || defenderType === "counter-evade") {
      stagger = Math.max(0, stagger - defenderRoll);
    }
  }

  if (payload.dieType === "block" || payload.dieType === "counter-block") {
    stagger = attack - defenderRoll // For the most microscopic of optimizations, we already know that attack > defenderRoll, so no need to Math.max
  }

  const curr_hp = targetActor.system.health.value;
  const curr_stagger = targetActor.system.stagger.value;
  const final_hp = curr_hp - damage
  const final_stagger = curr_stagger - stagger

  await targetActor.update({
    "system.health.value": final_hp,
    "system.stagger.value": final_stagger
  });
}

//#################################//
// Hurray! Migration to our new version, to update status effects (and maybe also modules? Haha writing comments is like gambling on whether or not I add features).
//  Point is, we've got an old data structure and we need to update it to new. Here we kindly ask our users on ready if they want to migrate
//  supposing that they haven't migrated already, and then we map each of their statuses to fit the new data structure
//  The work is done by getPassiveEffectMigration and migratePassiveEffects, while the ready hook checks versions against settings to see if an update is required
//  getPassiveEffectMigration is a sub-helper which does the work for an individual item, while migratePassiveEffects does it for actors, compendiums, and world items
function getPassiveEffectMigration(item) {
  // Skip if non-status
  if (item.type !== "status") return null;
  // Simplify structure
  const system = item.system;
  // Skip if non-passive
  if (system.condition !== "passive") return null;
  // Skip if it LOOKS like it has already been migrated
  // Already migrated should have something stored in the first index of the passive_effects array as a target. Without a target, sorry, we're forcing the conversion
  if (Array.isArray(system.passive_effects)) {
    if (system.passive_effects.length && system.passive_effects[0]?.target) return null;
  }
  // Skip if we're trying to migrate from something incompleted. Remember, this migration is only for 4 specific pieces of data, everything else is untouched and fine!
  if (system.target === undefined && system.effect === undefined) return null;
  // Now return our actual stuff
  return {
    _id: item.id,
    "system.passive_effects": [{
      target: system.target ?? "",
      effect: system.effect ?? "Increase",
      potency: system.potency ?? 1,
      potency_flat: system.potency_flat ?? 0
    }]
  };
}

async function migratePassiveEffectsAndActor() {
  console.log("SotC | Migrating passive effects!");
  // First go through actors
  for (const actor of game.actors.contents) {
    const updates = [];
    const actor_update = {};
    if (actor.system.health.raw == null || !actor.system.health.raw) {
      const raw_hp = actor.system.health.max;
      actor_update["system.health.raw"] = raw_hp;
    } if (actor.system.stagger.raw == null || !actor.system.stagger.raw) {
      const raw_stagger = actor.system.stagger.max;
      actor_update["system.stagger.raw"] = raw_stagger;
    } if (actor.system.light.raw == null || !actor.system.light.raw) {
      const raw_light = actor.system.light.max;
      actor_update["system.light.raw"] = raw_light;
    }
    // and subsequently actor items
    for (const item of actor.items.contents) {
      // getPassiveEffectMigration will do all thhe checking of it an item needs to be updated
      const update = getPassiveEffectMigration(item);
      if (update) updates.push(update);
    }
    // Only do work if there was something to update
    if (updates.length) {
      console.log(`SotC | Migrating ${updates.length} statuses on ${actor.name}`);
      await actor.updateEmbeddedDocuments("Item", updates);
    } if (Object.keys(actor_update).length) {
      console.log(`SotC | Migrating HP/Stagger/Light values on ${actor.name}`);
      await actor.update(actor_update);
    }
  }
  // Next do world items (thhose in the item tab)
  // All of this is basically the same, just slightly redundant. I could probably have made getPassiveEffectMigration operate on the level of the
  //  working withh game.actor.contents or game.items.contents being passed, instead of individual items, but this redundancy is inoffensive tbh
  const world_updates = [];
  for (const item of game.items.contents) {
    const update = getPassiveEffectMigration(item);
    if (update) {
      update._id = item.id;
      world_updates.push(update);
    }
  }
  if (world_updates.length) {
    console.log(`SotC | Migrating ${world_updates.length} statuses in world items`)
    await Item.updateDocuments(world_updates);
  }
  // Lastly, go through compendiums
  for (const pack of game.packs.contents) {
    if (pack.documentName !== "Item") continue;
    // Also we're gonna leave any non-sotc compendiums alone just in case, maybe?
    if (!pack.collection.startsWith("sotc.")) continue;
    // Your compendium will probably be locked by default, but I would hhate to lazily skip it.
    //  This IS a little bit brutish for me to slam the update through, but I think it's for the best. PLEASE just take backups...
    const was_locked = pack.locked;
    if (was_locked) {
      console.warn(
        `SotC | Unlocking and migrating locked pack ${pack.collection}`
      );
      await pack.configure({
        locked: false
      });
    }

    // We use a try, in case for some reason we fail to unlock above
    try {
      const docs = await pack.getDocuments();
      for (const item of docs) {
        const update = getPassiveEffectMigration(item);
        if (update) {
          // I'm not gonna include a console log here in the official release because it'd get very spammy for this implementation (once per compendium item)
          console.log(`${pack.collection}`)
          await item.update(update);
        }
      }
    } finally {
      if (was_locked) {
        console.log(
          `SotC | Re-locking pack ${pack.collection}`
        );
        await pack.configure({
          locked: true
        });
      }
    }

  }
  console.log("SotC | Passive effect migration complete!!!");
}

// Is it considered bad form to have multiple ready/init/whatever hooks? I hope not. I hope it doesn't cause any issues, I'm just not sure really. Welp!
Hooks.once("ready", async () => {
  const current_version = game.system.version;
  // This following line is the "accounting for it" that is referred to later in comments. Now we definitely need to update this for 1.07 and so on.
  //  Essentially, we don't want to screw over any users that are going back to older versions or branches or whatever. This is just my stuff, basically
  //  For anyone else who wants to use the new status effect data structure (no reason not to if you adapt the relevant .js and .html changes), you're going
  //  to need to modify current_version here to match whatever you've said is YOUR version. 
  //  Make sure that you know what you're doing and have everything set up for that compatibility! Also take backups of your worlds before migrating versions!!!
  if (current_version !== "1.06") return;
  let saved_version = game.settings.get(
    "sotc",
    "schemaVersion"
  );

  // For if we've got a brand new world (first time install) where there should be no saved version (default is "", not truthy)
  //  HOWEVER, this will ALSO be the case whenever you users are updating from v1.05 to v1.06 since the setting hasn't been made
  //  as of yet. As such, we also heuristically test, checking if there are no actors and assuming that if there aren't it's a fresh install
  //  and otherwise you're WERE just on a non 1.06 version and now need the update
  if (!saved_version) {
    const existing_world = game.actors.size;
    
    if (existing_world) {
      // PROBABLY you're on v1.05. I can't imagine that you wouldn't be, unless you're on a fork
      // So this is another one for you devs to look at if you need to!
      console.log("SotC | I might be dumb, but I THINK this is a pre v1.06 world. We'll offer you migration")
      saved_version = "1.05";
    } else {
      console.log("SotC | I might be dumb, but I THINK this is your first time (or among your first times) running. Full speed ahead sailor")
      console.log(`SotC | Initializing schema version ${current_version}`);
      await game.settings.set(
        "sotc",
        "schemaVersion",
        current_version
      );
      return;
    }
  }

  // If saved_version IS truthy but not equal to current_version, for now we just run the status update specifically. This will NEED to be updated for
  //  any future updates where we go up to any version other than v1.06. Oh, yeah, also if v < 1.06 then we'd explode, but why would you be doing that?
  //  I guess I should account for it anyways
  if (saved_version !== current_version) {

    new Dialog({
      title: "SotC Data Migration",

      content: `
        <p>Hey there! We need to migrate your status effects (and some actor metrics) to a new version, from ${saved_version} to ${current_version}.</p>
        <p>BEFORE DOING THIS ***PLEASE*** backup your world. To do that, close this prompt, close foundry (or leave the world in settings using "Return to Setup") and then take a backup. Do it NOW! Then come back and migrate.</p>
      `,

      buttons: {
        yes: {
          label: "Run Migration",
          callback: async () => {
            await migratePassiveEffectsAndActor();
            await game.settings.set(
              "sotc",
              "schemaVersion",
              current_version
            );
            ui.notifications.info(
              "SotC migration completed."
            );
          }
        },

        no: {
          label: "Cancel"
        }
      }
    }).render(true);
  }
});