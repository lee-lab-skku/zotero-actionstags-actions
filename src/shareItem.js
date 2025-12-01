const PREF_GROUP_KEY = 'actionsTags.actions.groupID';
const PREF_COLLECTION_KEY = 'actionsTags.actions.shareCollectionKey';
const TARGET_ACTION_KEY = 'copySelectionLink';

const oldItem = Zotero.getActiveZoteroPane().getSelectedItems()[0];
if (Zotero.ActionsTags.__shareItemRunning) return;
Zotero.ActionsTags.__shareItemRunning = true;

const selected = new Object();
let ok;

let groupID = Zotero.Prefs.get(PREF_GROUP_KEY);
if (!groupID) {
    const groups = Zotero.Groups.getAll();
    ok = await Services.prompt.select(null, 'Organization', 'Please select your organization.', groups.map(g => g.name), selected);
    if (!ok) {
        Zotero.ActionsTags.__shareItemRunning = false;
        return 1;
    }
    groupID = groups[selected.value].id;
    Zotero.Prefs.set(PREF_GROUP_KEY, groupID);
}
const targetLibraryID = Zotero.Groups.getLibraryIDFromGroupID(groupID);

let collectionKey = Zotero.Prefs.get(PREF_COLLECTION_KEY);
if (!collectionKey) {
    const cols = Zotero.Collections.getByLibrary(targetLibraryID);
    ok = await Services.prompt.select(null, 'Collection', 'Please select the collection to share.', cols.map(c => c.name), selected);
    if (!ok) {
        Zotero.ActionsTags.__shareItemRunning = false;
        return 1;
    }
    collectionKey = cols[selected.value].key;
    Zotero.Prefs.set(PREF_COLLECTION_KEY, collectionKey);
}

const type = oldItem.itemTypeID;
const newItem = new Zotero.Item(type);

newItem.libraryID = targetLibraryID;

const fieldIDs = Zotero.ItemFields.getItemTypeFields(type);
for (const fieldID of fieldIDs) {
    const fieldName = Zotero.ItemFields.getName(fieldID);
    if (fieldName === 'key' || fieldName === 'version' || fieldName === 'libraryID')
        continue;

    const value = oldItem.getField(fieldName);
    if (!!value)
        newItem.setField(fieldName, value);
}

const creators = oldItem.getCreators();
if (!!creators)
    newItem.setCreators(creators);
const coll = Zotero.Collections.getByLibraryAndKey(targetLibraryID, collectionKey);
if (!!coll)
    newItem.addToCollection(coll.id);

await newItem.saveTx();

const attachmentIDs = oldItem.getAttachments();
if (attachmentIDs.length) {
    for (const attachmentID of attachmentIDs) {
        const oldAtt = Zotero.Items.get(attachmentID);
        if (oldAtt.isAttachment()) {
            const path = Zotero.File.pathToFile(oldAtt.getFilePath());
            if (!!path) {
                await Zotero.Attachments.importFromFile({
                    file: path, parentItemID: newItem.id, libraryID: targetLibraryID
                });
            }
        }
    }
}

const arg = { itemID: newItem.id, itemIDs: [newItem.id], collectionID: coll.id, triggerType: 'menu' };
await Zotero.ActionsTags.api.actionManager.dispatchActionByKey(TARGET_ACTION_KEY, arg);

return 0;
