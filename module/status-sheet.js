import { EntitySheetHelper } from "./helper.js";
import {ATTRIBUTE_TYPES} from "./constants.js";

/**
 * Extend the basic ItemSheet with some very simple modifications
 * @extends {ItemSheet}
 */
export class SotCStatusSheet extends ItemSheet {

  /** @inheritdoc */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["sotc", "sheet", "item", "status"],
      template: "systems/sotc/templates/status-sheet.html",
      width: 656,
      height: 320
    });
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  async getData(options) {
    const context = await super.getData(options);
    if (context.data.img === "icons/svg/item-bag.svg") {
      context.data.img = "systems/sotc/assets/statuses/Default.png";
    }
    EntitySheetHelper.getAttributeData(context.data);
    context.systemData = context.data.system;
    context.sheetEditMode = this.item.getFlag("sotc", "sheetEditMode") || false;
    context.dtypes = ATTRIBUTE_TYPES;
    context.descriptionHTML = await TextEditor.enrichHTML(context.systemData.description, {
      secrets: this.document.isOwner,
      async: true
    });
    return context;
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  activateListeners(html) {
    super.activateListeners(html);
    html.find(".post_actives-control").click(this._onActivesControl.bind(this));
    html.find(".stagger_effects-control").click(this._onStaggerControl.bind(this));
    html.find(".passive_effect-control").click(this._onPassiveControl.bind(this));

    html.find(".print-status_card").click(this._printStatus.bind(this));
    // Added at the request of Gabeny, just prints the special details and status type, no numeric values unless written in special instructions
    html.find(".print-status_card_details").click(this._printStatusDetails.bind(this));
  }

  // If you can fathom it, _printStatus prints the FULL status effect to the chat, including any flavour text
  async _printStatus(event) {
    event.preventDefault();
    // Get the status
    const status = this.item;

    // Literally no idea how you would trigger this, but it's fine safety
    if (!status) return ui.notifications.error("No status data found.");

    // Simplifies the structure so we don't have to do status.system every time
    const s = status.system;
    // Name and icon are not stored in status.system
    const name = status.name;
    const icon = status.img ? `<img src="${status.img}" width="auto" height="32px" style="vertical-align: middle; margin-right: 4px; border: none;">` : "";
    let type = s.types || "other";
    // Capitalize, since for some reason I was averse to just making the html use capitalization. Oooooh spooky capitals <- me presumably
    const first_letter = type.charAt(0)
    const remaining_letters = type.substring(1)
    type = first_letter.toUpperCase() + remaining_letters
    const condition = s.condition || "";
    // Use let instead of const so that we can reuse these variables when iterating through the passive effects
    let potency_flat = s.potency_flat ?? 0;
    let potency = s.potency ?? 0;
    let effect = s.effect || "";
    let target = s.target || "";
    // Again, we could have just made this HP in the html... shrugs ig
    if (target === "hp") {
      target = "HP"
    }
    // Trim the special description
    const special = s.special?.trim();

    let message = "";
    let passive_message = ``;
    // flat and variable messages are used to appropriately word what is output to teh chat, without any "by 0 per count" uselessness.
    let flat_message = ``;
    let variable_message = ``;
    if (condition === "passive") {
      // Though it has literally never done so for statuses, foundry is retrieving passive_effects as an object instead of an array
      const raw_passive_effects = s.passive_effects ?? {};
      const passive_effects = Array.isArray(raw_passive_effects) ? raw_passive_effects : Object.values(raw_passive_effects);
      let passive_effects_length = (passive_effects).length
      for (const passive_effect of passive_effects) {
        passive_message += `${passive_effect.effect} ${passive_effect.target} `
        if (passive_effect.potency_flat) {
          passive_message += `by <b>${passive_effect.potency_flat}</b> flat`
          if (passive_effect.potency) {
            passive_message += `, and `
          }
        } if (passive_effect.potency) {
          passive_message += `by <b>${passive_effect.potency}</b> per count`
        }
        passive_effects_length -= 1;
        if (passive_effects_length) {
          passive_message += `, `
        }
      }
    } else {
      if (potency_flat) {
        flat_message = `by <b>${potency_flat}</b> flat, and`
      } if (potency) {
        variable_message = `by <b>${potency}</b> per count`
      }
    }

    switch (condition) {
      case "passive":
        message = `
          <div class="status-chat">
            <h3><div style="display: flex;">${icon}<span  style="margin-top: 2px; color: white; text-shadow: 0 0 5px #efc281, 0 0 5px #efc281;">${name}</span></div></h3>
            <p><b>Type:</b> ${type}</p>
            <b>Description:</b>
            <p>Passively ${passive_message}.</p>
            ${special ? `<p>${special}</p>` : ""}
          </div>
        `;
        break;

      case "active":
        message = `
          <div class="status-chat">
            <h3><div style="display: flex;">${icon}<span style="margin-top: 2px; color: white; text-shadow: 0 0 5px #efc281, 0 0 5px #efc281;">${name}</span></div></h3>
            <p><b>Type:</b> ${type}</p>
            <b>Description:</b>
            <p>On Trigger ${effect} ${target} ${flat_message} ${variable_message}.</p>
            ${special ? `<p>${special}</p>` : ""}
          </div>
        `;
        break;

      case "special":
        message = `
          <div class="status-chat">
            <h3><div style="display: flex;">${icon}<span style="margin-top: 2px; color: white; text-shadow: 0 0 5px #efc281, 0 0 5px #efc281;">${name}</span></div></h3>
            <p><b>Type:</b> ${type}</p>
            <b>Description:</b>
            ${special ? `<p>${special}</p>` : "<p><i>Missing Description.</i></p>"}
          </div>
        `;
        break;

      case "stagger_like":
        message = `
          <div class="status-chat">
            <h3><div style="display: flex;">${icon}<span style="margin-top: 2px; color: white; text-shadow: 0 0 5px #efc281, 0 0 5px #efc281;">${name}</span></div></h3>
            <p><b>Type:</b> ${type}</p>
            <b>Description:</b>
            "<p><i>stagger_like effects don't have description support yet. Sorry!</i></p>"}
          </div>
        `;
        break;

      default:
        message = `
          <div class="status-chat">
            <h3 style="margin-top: 2px; color: white; text-shadow: 0 0 5px #efc281, 0 0 5px #efc281;">${icon}${name} <small>(${type})</small></h3>
            <p><i>Missing Effect Details.</i></p>
          </div>
        `;
        break;
    }

    // Post to chat
    ChatMessage.create({
      user: game.user.id,
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: message,
    });
  }

  // Basically just a lazy reuse of the above, except we only print the small thing we need to print
  async _printStatusDetails(event) {
    event.preventDefault();
    // Get the status
    const status = this.item;

    // Literally no idea how you would trigger this, but it's fine safety
    if (!status) return ui.notifications.error("No status data found.");

    // Simplifies the structure so we don't have to do status.system every time
    const s = status.system;
    // Name and icon are not stored in status.system
    const name = status.name;
    const icon = status.img ? `<img src="${status.img}" width="auto" height="32px" style="vertical-align: middle; margin-right: 4px; border: none;">` : "";
    let type = s.types || "other";
    // Capitalize, since for some reason I was averse to just making the html use capitalization. Oooooh spooky capitals <- me presumably
    const first_letter = type.charAt(0)
    const remaining_letters = type.substring(1)
    type = first_letter.toUpperCase() + remaining_letters
    // Trim the special description
    const special = s.special?.trim();

    let message = "";
    message = `
      <div class="status-chat">
        <h3><div style="display: flex;">${icon}<span style="margin-top: 2px; color: white; text-shadow: 0 0 5px #efc281, 0 0 5px #efc281;">${name}</span></div></h3>
        <p><b>Type:</b> ${type}</p>
        <b>Description:</b>
        ${special ? `<p>${special}</p>` : "<p><i>Missing Description.</i></p>"}
      </div>
    `;

    // Post to chat
    ChatMessage.create({
      user: game.user.id,
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: message,
    });
  }
  
  async _onActivesControl(event) {
    event.preventDefault();
    const a = event.currentTarget;
    const raw_post_actives = this.item.system.post_actives;
    const post_actives_array = Array.isArray(raw_post_actives) ? raw_post_actives : Object.values(raw_post_actives);

    // Add new post active control button option thing <- words uttered by the deranged
    if ( a.classList.contains("add-option") ) {
      await this._onSubmit(event);
      const updated_post_array = [...post_actives_array, { operator: "maintain", variable: 0 }];
      return this.item.update({ "system.post_actives": updated_post_array });
    }

    // Remove a post active control button option thing
    if ( a.classList.contains("remove-option") ) {
      await this._onSubmit(event);
      const li = a.closest(".post_effect_contents");
      const index = Number(li.dataset.postActive);
      const updated_post_array = foundry.utils.deepClone(post_actives_array);
      updated_post_array.splice(index, 1);
      return this.item.update({ "system.post_actives": updated_post_array });
    }
  }

  async _onStaggerControl(event) {
    event.preventDefault();
    const a = event.currentTarget;
    const raw_stagger_effects = this.item.system.stagger_effects;
    const stagger_effects_array = Array.isArray(raw_stagger_effects) ? raw_stagger_effects : Object.values(raw_stagger_effects);

    // Add new post active control button option
    if ( a.classList.contains("add-option") ) {
      await this._onSubmit(event);
      const updated_post_array = [...stagger_effects_array, { operator: "maintain", variable: 0 }];
      return this.item.update({ "system.stagger_effects": updated_post_array });
    }

    // Remove a post active control button option
    if ( a.classList.contains("remove-option") ) {
      await this._onSubmit(event);
      const li = a.closest(".stagger_effect_contents");
      const index = Number(li.dataset.postActive);
      const updated_post_array = foundry.utils.deepClone(stagger_effects_array);
      updated_post_array.splice(index, 1);
      return this.item.update({ "system.stagger_effects": updated_post_array });
    }
  }

  async _onPassiveControl(event) {
    event.preventDefault();
    const a = event.currentTarget;
    const passive_index = Number(a.dataset.passiveIndex);
    const raw_effects = this.item.system.passive_effects ?? {};
    let passive_effects_array = Array.isArray(raw_effects) ? raw_effects : Object.values(raw_effects);

    // Better to make a deepClone. I should do this above as well, I think. If I didn't come back and do this, it's
    //  because I smell bad
    passive_effects_array = foundry.utils.deepClone(passive_effects_array);

    // Add new passive effect
    if (a.classList.contains("add-passive_effect")) {
      await this._onSubmit(event);
      passive_effects_array.push({
        target: "",
        effect: "Increase",
        potency: 1,
        potency_flat: 0
      });
      return this.item.update({"system.passive_effects": passive_effects_array});
    }

    // Remove passive effect
    if (a.classList.contains("remove-passive_effect")) {
      await this._onSubmit(event);
      passive_effects_array.splice(passive_index, 1);
      return this.item.update({
        "system.passive_effects": passive_effects_array
      });
    }
  }
}