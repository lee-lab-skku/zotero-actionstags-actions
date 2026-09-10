const Zotero = require('Zotero');

if (!item)
    return;

if (!item.isNote())
    return "The selected item is not a note.";
if (typeof Zotero.BetterNotes?.api?.convert?.note2link !== 'function')
    return "Better Notes plugin is not detected.";

const uri = Zotero.BetterNotes.api.convert.note2link(item);
const top = Zotero.Items.getTopLevel([item])[0];
const citationKey = top.isRegularItem() && top.getField('citationKey');
const label = `${item.getField('title')}${citationKey ? ` (${citationKey})` : ''}`;
const escapeHTML = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const clipboard = new Zotero.ActionsTags.api.utils.ClipboardHelper();
clipboard.addText(uri, "text/unicode");
clipboard.addText(`<a href="${escapeHTML(uri)}">${escapeHTML(label)}</a>`, "text/html");
clipboard.copy();

return "Copied Better Notes link to clipboard.";
