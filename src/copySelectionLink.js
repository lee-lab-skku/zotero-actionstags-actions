if (item)
    return;

const uris = [];
const texts = [];


let targetItem;
let text;
let uri;

if (!!collection) {
    const key = collection.key;
} else {
    collection = null;
    const coll = Zotero.getActiveZoteroPane().getSelectedCollection();
    const tabs = Zotero.getMainWindow().Zotero_Tabs;
    const tabData = tabs._getTab(tabs.selectedID).tab.data;
    if (!!coll && !Object.hasOwn(tabData, 'itemID')) {
        const key = coll.key;
    }
}

for (const item of items) {
    if (item.isAttachment())
        targetItem = item.parentItem;
    else
        targetItem = item;

    uri = "zotero://select";
    if (targetItem.library.libraryType === "user")
        uri += "/library";
    else
        uri += `/groups/${Zotero.Libraries.get(targetItem.libraryID).groupID}`;

    uri += `/collections/${key}`;

    uri += `/items/${targetItem.key}`;
    text = `${targetItem.getField("citationKey")}`;

    uris.push(uri);
    texts.push(text);
}

const plainText = uris.join("\n");
const htmlText = texts.map((text, i) => `<a href="${uris[i]}">${text}</a>`).join("<br>");

const clipboard = new Zotero.ActionsTags.api.utils.ClipboardHelper();
clipboard.addText(plainText, "text/unicode");
clipboard.addText(htmlText, "text/html");
clipboard.copy();

return "Copied Zotero selection link to clipboard.";