let uri = "zotero://select";
if (item.library.libraryType === "user")
    uri += "/library";
else
    uri += `/groups/${Zotero.Libraries.get(item.libraryID).groupID}`;
let coll = Zotero.getActiveZoteroPane().getSelectedCollection();
if (!!coll)
    uri += `/collections/${coll.key}`;
uri += `/items/${item.key}`;

text = `${item.getField("citationKey")}`;

const clipboard = new Zotero.ActionsTags.api.utils.ClipboardHelper();
clipboard.addText(uri, "text/unicode");
clipboard.addText(`<a href="${uri}">${text}</a>`, "text/html");
clipboard.copy();

return "Copied selection link to clipboard.";