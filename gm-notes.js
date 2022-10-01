class GMNote extends FormApplication {

    constructor(object, options) {
        super(object, options);
        this.object.apps[this.appId] = this;
    }

    get showExtraButtons() {
        return (game.dnd5e && this.object.constructor.name !== 'RollTable' || this.object.constructor.name === "JournalEntry");
    }

    static get defaultOptions() {
        const options = super.defaultOptions;
        options.template = "modules/gm-notes/templates.html";
        options.width = '600';
        options.height = '700';
        options.classes = ['gm-notes', 'sheet'];
        options.title = game.i18n.localize('GMNote.label');
        options.resizable = true;
        options.editable = true;
        return options;
    }

    async getData() {
        const data = super.getData();

        // Current page is on another event loop - wait for 50 millis solves it in majority of circumstances
        await this.sleep(50);
        let page = this.getCurrentPage();

        data.journalNotes = await TextEditor.enrichHTML(this.object.getFlag('gm-notes', 'notes'), { async:true});

        data.flags = this.object.flags;
        data.owner = game.user.id;
        data.isGM = game.user.isGM;
        data.showExtraButtons = this.showExtraButtons && page != null;

        return data;
    }

    getCurrentPage()
    {
        // Find current page
        let pageIdentifier = $(this.object.sheet.pagesInView[0]).data("pageId");

        if(pageIdentifier) {
            return this.object.pages.get(pageIdentifier);
        }
        return null;
    }

    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    activateListeners(html) {
        super.activateListeners(html);

        html.find('.moveToNote').click(ev => this._moveToNotes());
        html.find('.moveToDescription').click(ev => this._moveToDescription());
    }
    
    async _updateObject(event, formData) {
        if (game.user.isGM) {
            await this.object.setFlag('gm-notes', 'notes', formData["flags.gm-notes.notes"]);
            this.render();
        } else {
            ui.notifications.error("You have to be GM to edit GM Notes.");
        }
    }

    static _initEntityHook(app, html, data) {
        if (game.user.isGM) {
            let labelTxt = '';
            let labelStyle= "";
            let title = game.i18n.localize('GMNote.label'); 
            let notes = app.object.getFlag('gm-notes', 'notes');


            if (game.settings.get('gm-notes', 'hideLabel') === false) {
                labelTxt = ' ' + title;
            }
            if (game.settings.get('gm-notes', 'colorLabel') === true && notes) {
                labelStyle = "style='color:green;'";
            }

            let openBtn = $(`<a class="open-gm-note" title="${title}" ${labelStyle} ><i class="fas fa-clipboard${notes ? '-check':''}"></i>${labelTxt}</a>`);
            openBtn.click(ev => {
                let noteApp = null;
                for (let key in app.object.apps) {
                    let obj = app.object.apps[key];
                    if (obj instanceof GMNote) {
                        noteApp = obj;
                        break;
                    }
                }
                if (!noteApp) noteApp = new GMNote(app.document, { submitOnClose: true, closeOnSubmit: false, submitOnUnfocus: true });
                noteApp.render(true);
            });
            html.closest('.app').find('.open-gm-note').remove();
            let titleElement = html.closest('.app').find('.window-title');
            openBtn.insertAfter(titleElement);
        }
    }
    
    async _moveToNotes() {
        if (game.dnd5e && this.object.constructor.name !== 'JournalEntry') {
            let descPath = '';
            switch (this.object.constructor.name) {
                case 'Actor5e': descPath = 'system.details.biography.value'; break;
                case 'Item5e': descPath = 'system.description.value'; break;
            }
            let description = getProperty(this.object, descPath);
            let notes = getProperty(this.object, 'flags.gm-notes.notes');

            if (notes === undefined) notes = '';
            if (description === undefined) description = '';

            let obj = {};
            obj[descPath] = '';            
            await this.object.setFlag('gm-notes', 'notes' ,notes + description);
            await this.object.update(obj);
            // No longeer required - the update will re-render
            // this.render();
        } else if(this.object.constructor.name === 'JournalEntry') {

            let page = this.getCurrentPage();
            if(!page) { 
                // I no current page - don't do things
                return;
            }
            
            let notes = this.object.getFlag('gm-notes', 'notes') ?? '';
            let description = getProperty(page, 'text.content') ?? '';
            // Here can just move text
            let obj = {};
            obj["text.content"] = '';
            await this.object.setFlag('gm-notes', 'notes' ,notes + description);
            await page.update(obj);
        }
    }

    async _moveToDescription() {
        if (game.dnd5e && this.object.constructor.name !== 'JournalEntry') {
            let descPath = '';
            switch (this.object.constructor.name) {
                case 'Actor5e': descPath = 'system.details.biography.value'; break;
                case 'Item5e': descPath = 'system.description.value'; break;
            }
            let description = getProperty(this.object, descPath);
            let notes = this.object.getFlag('gm-notes','notes');

            if (notes === undefined) notes = '';
            if (description === undefined) description = '';

            let obj = {};
            obj[descPath] = description + notes;
            await this.object.setFlag('gm-notes','notes','');       
            await this.object.update(obj);  // this will re-render
        } else if(this.object.constructor.name === 'JournalEntry') {
            let page = this.getCurrentPage();
            if(!page) {
                return;
            }
            let notes = getProperty(this.object, 'flags.gm-notes.notes') ?? '';
            let description = getProperty(page, 'text.content') ?? '';

            let obj = {};            
            obj["text.content"] = description + notes;            
            await this.object.setFlag('gm-notes','notes','');
            await page.update(obj);
        }
    }
}
Hooks.on('init', () => {
    game.settings.register("gm-notes", 'hideLabel', {
        name: game.i18n.localize('GMNote.setting'),
        hint: game.i18n.localize('GMNote.settingHint'),
        scope: "world",
        config: true,
        default: false,
        type: Boolean
    });
    game.settings.register("gm-notes", 'colorLabel', {
        name: game.i18n.localize('GMNote.colorSetting'),
        scope: "world",
        config: true,
        default: false,
        type: Boolean
    });
});

Hooks.on('renderActorSheet', (app, html, data) => {
    GMNote._initEntityHook(app, html, data);
});
Hooks.on('renderItemSheet', (app, html, data) => {
    GMNote._initEntityHook(app, html, data);
});
Hooks.on('renderJournalSheet', (app, html, data) => {
    GMNote._initEntityHook(app, html, data);
});
Hooks.on('renderRollTableConfig', (app, html, data) => {
    GMNote._initEntityHook(app, html, data);
});
