if (item.isAttachment())
    targetItem = item.parentItem;
else
    targetItem = item;

let uri = "zotero://select";
if (targetItem.library.libraryType === "user")
    uri += "/library";
else
    uri += `/groups/${Zotero.Libraries.get(targetItem.libraryID).groupID}`;

const coll = Zotero.getActiveZoteroPane().getSelectedCollection();
const tabs = Zotero.getMainWindow().Zotero_Tabs;
const tabData = tabs._getTab(tabs.selectedID).tab.data;

if (!!coll && !Object.hasOwn(tabData, 'itemID'))
    uri += `/collections/${coll.key}`;
uri += `/items/${targetItem.key}`;

text = `${targetItem.getField("citationKey")}`;

const clipboard = new Zotero.ActionsTags.api.utils.ClipboardHelper();
clipboard.addText(uri, "text/unicode");
clipboard.addText(`<a href="${uri}">${text}</a>`, "text/html");
clipboard.copy();

return "Copied Zotero selection link to clipboard.";