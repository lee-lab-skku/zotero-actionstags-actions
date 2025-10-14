if (item.isNote() && Zotero.BetterNotes)
    uri = Zotero.BetterNotes.api.convert.note2link(item);
else
    return "The selected item is not a note, or Better Notes plugin is not detected."

const text = `${item.getField('title')} (${Zotero.Items.getTopLevel([item])[0].getField("citationKey")})`;

const clipboard = new Zotero.ActionsTags.api.utils.ClipboardHelper();
clipboard.addText(uri, "text/unicode");
clipboard.addText(`<a href="${uri}">${text}</a>`, "text/html");
clipboard.copy();

return "Copied Better Notes link to clipboard.";