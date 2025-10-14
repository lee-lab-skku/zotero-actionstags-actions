if (item.isNote() && Zotero.BetterNotes) {
    uri = Zotero.BetterNotes.api.convert.note2link(item);
}

const clipboard = new Zotero.ActionsTags.api.utils.ClipboardHelper();
clipboard.addText(uri, "text/unicode");
clipboard.addText(`<a href="${uri}">test text</a>`, "text/html");
clipboard.copy();

return "Copied Better Notes link to clipboard.";