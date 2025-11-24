const TARGET_GROUP_ID = 'CENSORED';
const TARGET_COLLECTION_KEY = 'CENSORED';
const TARGET_ACTION_KEY = 'copySelectionLink';

(async () => {
    const type = item.itemTypeID;
    const newItem = new Zotero.Item(type);

    const targetLibraryID = Zotero.Groups.getLibraryIDFromGroupID(TARGET_GROUP_ID);
    newItem.libraryID = targetLibraryID;

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
    const coll = Zotero.Collections.getByLibraryAndKey(targetLibraryID, TARGET_COLLECTION_KEY);
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
                        file: path, parentItemID: newItem.id, libraryID: targetLibraryID
                    });
                }
            }
        }
    }

    const arg = { itemID: newItem.id, itemIDs: [newItem.id], collectionID: coll.id, triggerType: 'menu' };
    await Zotero.ActionsTags.api.actionManager.dispatchActionByKey(TARGET_ACTION_KEY, arg);

    return 0;
})();