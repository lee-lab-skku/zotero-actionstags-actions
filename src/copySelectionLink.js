if (item)
    return;

let key;

if (!!collection)
    key = collection.key;
else {
    const coll = Zotero.getActiveZoteroPane().getSelectedCollection();
    const tabs = Zotero.getMainWindow().Zotero_Tabs;
    const tabData = tabs._getTab(tabs.selectedID).tab.data;
    if (!!coll && !Object.hasOwn(tabData, 'itemID'))
        key = coll.key;
}

function parse(item) {
    let targetItem;
    if (item.isAttachment())
        targetItem = item.parentItem;
    else
        targetItem = item;

    let uri = "zotero://select";
    if (targetItem.library.libraryType === "user")
        uri += "/library";
    else
        uri += `/groups/${Zotero.Libraries.get(targetItem.libraryID).groupID}`;
    if (!!key)
        uri += `/collections/${key}`;
    uri += `/items/${targetItem.key}`;
    const text = `${targetItem.getField("citationKey")}`;

    return { uri, text };
}

const links = items.map(parse);

const plainText = links.map(link => link.uri).join("\n");
const htmlText = links.map(link => `<a href="${link.uri}">${link.text}</a>`).join("<br>");

const clipboard = new Zotero.ActionsTags.api.utils.ClipboardHelper();
clipboard.addText(plainText, "text/unicode");
clipboard.addText(htmlText, "text/html");
clipboard.copy();

return "Copied Zotero selection link to clipboard.";
