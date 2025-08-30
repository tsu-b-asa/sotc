import { EntitySheetHelper } from "./helper.js";
import {ATTRIBUTE_TYPES} from "./constants.js";

/**
 * Extend the basic ItemSheet with some very simple modifications
 * @extends {ItemSheet}
 */
export class SotCSkillSheet extends ItemSheet {

  /** @inheritdoc */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["sotc", "sheet", "item", "skill", "ego"],
      template: "systems/sotc/templates/skill-sheet.html",
      width: 520,
      height: 480,
      resizable: false // This is a temporary solution to handle my own scope creep, sorry.
    });
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  async getData(options) {
    const context = await super.getData(options);
    if (context.data.img === "icons/svg/item-bag.svg") {
      context.data.img = "systems/sotc/assets/sheets/skills/default skill icon.png";
    }
    EntitySheetHelper.getAttributeData(context.data);
    context.systemData = context.data.system;
    context.sheetEditMode = this.item.getFlag("sotc", "sheetEditMode") || false;
    context.dtypes = ATTRIBUTE_TYPES;
    // Again again, not sure if I even need this but I don't want to test removing it. The commenting is easier than the removing it
    context.descriptionHTML = await TextEditor.enrichHTML(context.systemData.description, {
      secrets: this.document.isOwner,
      async: true
    });
    return context;
  }

  /* -------------------------------------------- */
  // Our skills are the prettiest, so I'm going to intensely document these
  /** @inheritdoc */
  activateListeners(html) {
    super.activateListeners(html);
    // For adding or removing dice
    html.find(".dice-control").click(this._onDiceControl.bind(this));
    // For adding and removing SKILL modules, currently not used
    html.find(".skill_modules-control").click(this._onSkillModControl.bind(this));
    // For adding and removing dice modules
    html.find(".dice_modules-control").click(this._onDiceModControl.bind(this));
    // To make the individual dice clickable, so that they can be recycled 
    html.find(".skill-die-button").click(this._onRollSkillDie.bind(this));
    // Make our skills editable
    html.find(".toggle-edit-mode").click(this._onToggleEditMode.bind(this));
    // Change our border colours, it's so pretty!!!
    html.find(".border-button").click(async ev => {
      const border = ev.currentTarget.dataset.border;
      await this.item.update({ "system.border_style": border });
    });
  }

  /* -------------------------------------------- */

  /** @override */
  _getSubmitData(updateData) {
    let formData = super._getSubmitData(updateData);
    formData = EntitySheetHelper.updateAttributes(formData, this.object);
    formData = EntitySheetHelper.updateGroups(formData, this.object);
    return formData;
  }

  /* -------------------------------------------- */

  /**
   * Add or remove a skill_modules from a skill. Currently we're not using this in any way because it looked ugly with the current implementation
   * At a later date I'll set this up so that the modules can have actual effects and this will then be useful
   * @param {Event} event             The original click event.
   * @returns {Promise<Item5e>|null}  Item with updates applied.
   * @private
   */

  async _onSkillModControl(event) {
    event.preventDefault();
    const a = event.currentTarget;
    const raw_mods = this.item.system.skill_modules.mods;
    const mods_array = Array.isArray(raw_mods) ? raw_mods : Object.values(raw_mods);
    console.log("Clicked skill_modules control:", a);

    // Add new skill_modules
    if ( a.classList.contains("add-skill_modules") ) {
      await this._onSubmit(event);  // Submit any unsaved changes
      const updated_mods_array = [...mods_array, ""];
      return this.item.update({"system.skill_modules.mods": updated_mods_array});
    }

    // Remove a skill_modules
    if ( a.classList.contains("delete-skill_modules") ) {
      await this._onSubmit(event);  // Submit any unsaved changes
      const li = a.closest(".skill_modules-mods");
      const index = Number(li.dataset.skill_modulesMods);
      const updated_mods_array = foundry.utils.deepClone(mods_array);
      updated_mods_array.splice(Number(li.dataset.skill_modulesMods), 1);
      return this.item.update({"system.skill_modules.mods": updated_mods_array});
    }
  }

  // Add a dice mod, so that the details can be printed on each dice when its rolled. Currently purely for visual effect and understanding
  async _onDiceModControl(event) {
    event.preventDefault();
    const a = event.currentTarget;
    await this._onSubmit(event);

    // Get the parent die container to extract the die index
    const container = a.closest(".dice-die");
    const die_index = Number(container?.dataset.diceDie);
    if (isNaN(die_index)) return console.warn("No valid die index found");

    // Normalize the dice data
    const raw_dice = this.item.system.dice.die;
    const dice_array = Array.isArray(raw_dice) ? raw_dice : Object.values(raw_dice || []);
    const die = foundry.utils.deepClone(dice_array[die_index]);
    const mods_array = Array.isArray(die.mods) ? die.mods : Object.values(die.mods || []);

    // Add new module
    if (a.classList.contains("add-dice_modules")) {
      mods_array.push("");
    }

    // Remove module
    if (a.classList.contains("delete-dice_modules")) {
      const li = a.closest(".dice_modules-mods");
      const mod_index = Number(li?.dataset.diceMod);
      if (!isNaN(mod_index)) mods_array.splice(mod_index, 1);
    }

    // Update only the specific die entry
    die.mods = mods_array;
    dice_array[die_index] = die;
    return this.item.update({ "system.dice.die": dice_array });
  }

  // Instate a generic control for dice that lets us do the adding and removing. I'm not actually a huge fan of the way this looks/works
  async _onDiceControl(event) {
    event.preventDefault();
    const a = event.currentTarget;
    const raw_die = this.item.system.dice.die;
    const die_array = Array.isArray(raw_die) ? raw_die : Object.values(raw_die);
    console.log("Clicked dice control:", a);

    // Add new dice
    if ( a.classList.contains("add-dice") ) {
      await this._onSubmit(event);
      const updated_die_array = [...die_array, { type: "slash", formula: "", effect: "" }];
      return this.item.update({"system.dice.die": updated_die_array});
    }

    // Remove a dice
    if ( a.classList.contains("delete-dice") ) {
      await this._onSubmit(event);
      const li = a.closest(".dice-die");
      const index = Number(li.dataset.diceDie);
      const updated_die_array = foundry.utils.deepClone(die_array);
      updated_die_array.splice(Number(li.dataset.diceDie), 1);
      return this.item.update({"system.dice.die": updated_die_array});
    }
  }

  /* -------------------------------------------- */
  // This would, ideally, allow us to fix the asset ratio for when resizing things so that the sheet remains all pretty and LOR looking. I didn't get it to work for this version, BUT
  // In the future, I should ocme back and get this to work since there are some goodd ideas here
  setPosition(options = {}) {
    // Call the original behavior first
    const pos = super.setPosition(options);

    // Enforce aspect ratio tgat keeps the border correctly sized
    const el = this.element[0];
    const aspectRatio = 1898 / 1500; // This is the correct ratio, which can be reasonably reduced but this is precise and accounts for border overflow onto the bar thingy at thte top

    const newWidth = el.offsetWidth;
    const newHeight = Math.round(newWidth / aspectRatio);

    el.style.height = `${newHeight}px`;

    return {
      ...pos,
      height: newHeight
    };
  }

  // How we roll the individual dice on a skill, for the purpose of recycling dice mainly or just for rerolling them. This provides no dialog box for power modification currently but should in the future
  async _onRollSkillDie(event) {
    event.preventDefault();
    const index = Number(event.currentTarget.dataset.index);
    const die = this.item.system.dice.die[index];

    if (!die || !die.formula) {
      ui.notifications.warn("No valid formula found for this die.");
      return;
    }

    try {
    const icon = `systems/sotc/assets/dice types/${die.type}.png`;
    const flavor = `<img src="${icon}" alt="${die.type}" title="${die.type}" style="width: auto; height: 36px; vertical-align: middle; border: none;"> ${die.formula}`;

      const roll = new Roll(die.formula);
      await roll.roll({ async: true });

      roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        flavor: flavor
      });
    } catch (err) {
      console.error("Error rolling die:", err);
      ui.notifications.error("Invalid formula. Please check your input.");
    }
  }

  /* -------------------------------------------- */

  async _onToggleEditMode(event) {
    event.preventDefault();

    // Save current form values if switching from edit mode
    if (this.item.getFlag("sotc", "sheetEditMode")) {
      await this._onSubmit(event); // Save the form data
    }

    const current = this.item.getFlag("sotc", "sheetEditMode") || false;
    await this.item.setFlag("sotc", "sheetEditMode", !current);
    this.render();
  }
}