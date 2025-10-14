if (item.isAttachment())
    targetItem = item.parentItem;
else
    targetItem = item;

let uri = "zotero://select";
if (targetItem.library.libraryType === "user")
    uri += "/library";
else
    uri += `/groups/${Zotero.Libraries.get(targetItem.libraryID).groupID}`;

let coll = Zotero.getActiveZoteroPane().getSelectedCollection();
if (!!coll)
    uri += `/collections/${coll.key}`;
uri += `/items/${targetItem.key}`;

text = `${targetItem.getField("citationKey")}`;

const clipboard = new Zotero.ActionsTags.api.utils.ClipboardHelper();
clipboard.addText(uri, "text/unicode");
clipboard.addText(`<a href="${uri}">${text}</a>`, "text/html");
clipboard.copy();

return "Copied selection link to clipboard.";