const PREF_GROUP_KEY = 'extensions.zotero-actionstags.group-id';
const PREF_COLLECTION_KEY = 'extensions.zotero-actionstags.review-collection-key';

(async () => {
    const targetItem = item;

    if (Zotero.ActionsTags.__reviewNoteRunning) return;
    Zotero.ActionsTags.__reviewNoteRunning = true;

    const selected = new Object();
    let ok;

    let groupID = Zotero.Prefs.get(PREF_GROUP_KEY);
    if (!groupID) {
        const groups = Zotero.Groups.getAll();
        ok = await Services.prompt.select(null, 'Organization', 'Please select your organization.', groups.map(g => g.name), selected);
        if (!ok)
            return 1;
        groupID = groups[selected.value].id;
        Zotero.Prefs.set(PREF_GROUP_KEY, groupID);
    }

    let collectionKey = Zotero.Prefs.get(PREF_COLLECTION_KEY);
    if (!collectionKey) {
        const targetLibraryID = Zotero.Groups.getLibraryIDFromGroupID(groupID);
        const cols = Zotero.Collections.getByLibrary(targetLibraryID);
        ok = await Services.prompt.select(null, 'Collection', 'Please select the collection to review notes in.', cols.map(c => c.name), selected);
        if (!ok)
            return 1;
        collectionKey = cols[selected.value].key;
        Zotero.Prefs.set(PREF_COLLECTION_KEY, collectionKey);
    }

    if (!targetItem.getCollections().map(c => Zotero.Collections.get(c).name).includes(collectionKey))
        return 0;

    Zotero.ActionsTags.__reviewNoteRunning = false;
    return 0;
})();