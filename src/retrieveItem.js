const PREF_COLLECTION_KEY = 'actionsTags.actions.shareCollectionKey';

if (!item && items[0])
    return;

let collectionKey = Zotero.Prefs.get(PREF_COLLECTION_KEY);
if (!collectionKey)
    return 'Set preferences first.';

if (!item.getCollections().map(c => Zotero.Collections.get(c).key).includes(collectionKey))
    return 'Item not in share collection.';

const cols = Zotero.Collections.getByLibrary(1);
const selected = new Object();
const ok = await Services.prompt.select(null, 'Selection', 'Select the collection to move the item to.', cols.map(c => c.name), selected);

if (!ok)
    return;
const coll = cols[selected.value];

const type = item.itemTypeID;
const newItem = new Zotero.Item(type);
newItem.libraryID = 1;

const fieldIDs = Zotero.ItemFields.getItemTypeFields(type);
for (const fieldID of fieldIDs) {
    const fieldName = Zotero.ItemFields.getName(fieldID);
    if (fieldName === 'key' || fieldName === 'version' || fieldName === 'libraryID')
        continue;

    const value = item.getField(fieldName);
    if (!!value)
        newItem.setField(fieldName, value);
}

const creators = item.getCreators();
if (!!creators)
    newItem.setCreators(creators);
if (!!coll)
    newItem.addToCollection(coll.id);

await newItem.saveTx();

const attachmentIDs = item.getAttachments();
if (attachmentIDs.length) {
    for (const attachmentID of attachmentIDs) {
        const oldAtt = Zotero.Items.get(attachmentID);
        if (oldAtt.isAttachment()) {
            const path = Zotero.File.pathToFile(oldAtt.getFilePath());
            if (!!path) {
                await Zotero.Attachments.importFromFile({
                    file: path, parentItemID: newItem.id, libraryID: 1
                });
            }
        }
    }
}

await Zotero.Items.erase([item.id]);

return 'Retrieved item successfully.';
