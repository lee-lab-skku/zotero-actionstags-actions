const Zotero = require('Zotero');

// Actions & Tags calls scripts once for the selection and then for each item.
if (item || !items?.length)
    return;

let selectedCollection = collection || null;
if (!selectedCollection) {
    const pane = Zotero.getActiveZoteroPane();
    const tabs = Zotero.getMainWindow()?.Zotero_Tabs;
    if (pane && tabs?.selectedType === 'library') {
        const collections = pane.getSelectedCollections();
        const rows = pane.getCollectionTreeRows();
        if (rows.length === 1 && collections.length === 1)
            selectedCollection = collections[0];
    }
}

function escapeHTML(value) {
    return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function parseURI(target) {
    const library = Zotero.Libraries.get(target.libraryID);
    const libraryURI = library.libraryType === 'group'
        ? `groups/${library.groupID}` : 'library';
    const inCollection = selectedCollection
        && selectedCollection.libraryID === target.libraryID
        && target.getCollections().includes(selectedCollection.id);
    const collectionURI = inCollection ? `collections/${selectedCollection.key}/` : '';
    const uri = `zotero://select/${libraryURI}/${collectionURI}items/${target.key}`;
    const text = (target.isRegularItem() && target.getField('citationKey'))
        || target.getField('title') || target.key;
    return { uri, html: `<a href="${escapeHTML(uri)}">${escapeHTML(text)}</a>` };
}

const targets = items.map(target => target.isAttachment() && target.parentItem
    ? target.parentItem : target);
const links = [...new Map(targets.map(target => [target.id, target])).values()].map(parseURI);
const clipboard = new Zotero.ActionsTags.api.utils.ClipboardHelper();

clipboard.addText(links.map(link => link.uri).join("\n"), "text/unicode");
clipboard.addText(links.map(link => link.html).join("<br>"), "text/html");
clipboard.copy();

return "Copied Zotero selection link to clipboard.";
