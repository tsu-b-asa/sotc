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
  }

  /* -------------------------------------------- */

  /** @override */
  _getSubmitData(updateData) {
    let formData = super._getSubmitData(updateData);
    formData = EntitySheetHelper.updateAttributes(formData, this.object);
    formData = EntitySheetHelper.updateGroups(formData, this.object);
    return formData;
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
}