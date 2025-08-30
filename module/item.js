import {EntitySheetHelper} from "./helper.js";

/**
 * Extend the base Item document to support attributes and groups with a custom template creation dialog.
 * @extends {Item}
 */
export class SotCItem extends Item {
  static get defaultType() {
    return null;
  }

  /** @inheritdoc */
  prepareDerivedData() {
    super.prepareDerivedData();

    this.system.groups = this.system.groups || {};
    this.system.attributes = this.system.attributes || {};
    EntitySheetHelper.clampResourceValues(this.system.attributes);
  }

  /** -------------------------------------------- 
   * This formerly made use of the line below, which should ideally be adjusted but I don't really understand what it's doing. 
   * It's doing some stuff with defining sheets as templates, which could be pretty useful for creating NPCs.
   * We'll consider modifying returning to using the helper functions at a later date, since I'm sure the person who made this had some clever motivation.
   * line in question:
   * return EntitySheetHelper.createDialog.call(this, data, options);
   * -------------------------------------------- */
  /** @override */
  static async createDialog(data = {}, options = {}) {
    const documentName = this.metadata.name;
    const label = game.i18n.localize(this.metadata.label);
    const title = game.i18n.format("DOCUMENT.Create", { type: label });
    const folders = game.folders.filter(f => f.type === documentName && f.displayed);

    // All available item types
    const itemTypes = CONFIG.Item.types.reduce((obj, t) => {
      obj[t] = CONFIG.Item.typeLabels[t] || t;
      return obj;
    }, {});

    // Render the document creation form
    const template = "templates/sidebar/document-create.html";
    const html = await renderTemplate(template, {
      name: data.name || game.i18n.format("DOCUMENT.New", { type: label }),
      folder: data.folder,
      folders,
      hasFolders: folders.length > 1,
      type: data.type || CONFIG.Item.types[0],
      types: itemTypes,
      hasTypes: true
    });

    return Dialog.prompt({
      title,
      content: html,
      label: title,
      callback: async html => {
        const form = html[0].querySelector("form");
        const fd = new FormDataExtended(form);
        let createData = fd.object;

        // Merge provided override data
        createData = foundry.utils.mergeObject(createData, data, { inplace: false });

        // Ensure type is valid
        if (!createData.type || !CONFIG.Item.types.includes(createData.type)) {
          createData.type = CONFIG.Item.types[0];
        }

        return this.create(createData, { renderSheet: true });
      },
      rejectClose: false,
      options
    });
  }

  /* -------------------------------------------- */

  /**
   * Is this Item used as a template for other Items? <- This is a wonderful question that isn't relevant currently, because items aren't used as templates currently.
   * @type {boolean}
   */
  get isTemplate() {
    return !!this.getFlag("sotc", "isTemplate");
  }
}
