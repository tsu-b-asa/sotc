import { EntitySheetHelper } from "./helper.js";
import {ATTRIBUTE_TYPES} from "./constants.js";

/**
 * Extend the basic ItemSheet with some very simple modifications
 * @extends {ItemSheet}
 */
export class SotCPassiveSheet extends ItemSheet {

  /** @inheritdoc */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["sotc", "sheet", "item", "passive", "biography"],
      template: "systems/sotc/templates/passive-sheet.html",
      width: 656,
      height: 320
    });
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  async getData(options) {
    const context = await super.getData(options);
    EntitySheetHelper.getAttributeData(context.data);
    context.systemData = context.data.system;
    context.sheetEditMode = this.item.getFlag("sotc", "sheetEditMode") || false;
    context.dtypes = ATTRIBUTE_TYPES;
    // Again, not sure if I even need this but I don't want to test removing it. The commenting is easier than the removing it
    context.detailsHTML = await TextEditor.enrichHTML(context.systemData.details, {
      secrets: this.document.isOwner,
      async: true
    });
    return context;
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  activateListeners(html) {
    super.activateListeners(html);

    html.find(".print-passive_card").click(ev => {
      ev.preventDefault();
      this._printPassive(this.item);
    });
  }

  async _printPassive(item) {
    const name = item.name;
    const details = item.system.details ?? "";

    // Please make sure to also match this up to the actor-sheet.js details
    const content = `
      <div class="sotc-passive-card">
        <h2 style="margin:0; color: black; text-shadow: 1px 1px 2px white;">
          ${name}
        </h2>
        <div class="sotc-passive-details">${details}</div>
      </div>
    `;

    return ChatMessage.create({
      user: game.user.id,
      speaker: ChatMessage.getSpeaker({ actor: item.actor }),
      content
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
  
}