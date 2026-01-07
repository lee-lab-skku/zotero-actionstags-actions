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

function parseURI(item) {
    const baseURI = "zotero://select";
    const groupURI = (item.library.libraryType === "user") ? "library" : `groups/${Zotero.Libraries.get(item.libraryID).groupID}`;
    const collectionURI = key ? `collections/${key}` : "";
    const itemURI = `items/${item.key}`;

    const uri = [baseURI, groupURI, collectionURI, itemURI].filter(uri => uri).join("/");
    const text = `${item.getField("citationKey")}`;
    const html = `<a href="${uri}">${text}</a>`;

    return { uri, html };
}

const links = items.map(item => item.isAttachment() ? item.parentItem : item).map(parseURI);
const clipboard = new Zotero.ActionsTags.api.utils.ClipboardHelper();

clipboard.addText(links.map(link => link.uri).join("\n"), "text/unicode");
clipboard.addText(links.map(link => link.html).join("<br>"), "text/html");
clipboard.copy();

return "Copied Zotero selection link to clipboard.";
