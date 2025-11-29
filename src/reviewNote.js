const PREF_GROUP_KEY = 'extensions.zotero-actionstags.group-id';
const PREF_COLLECTION_KEY = 'extensions.zotero-actionstags.review-collection-key';

(async () => {
    if (Zotero.ActionsTags.__reviewNoteRunning) return;
    Zotero.ActionsTags.__reviewNoteRunning = true;

    let selected;
    let ok;

    const groupID = Zotero.Prefs.get(PREF_GROUP_KEY);
    if (!groupID) {
        const groups = Zotero.Groups.getAll();
        selected = new Object();
        ok = await Services.prompt.select(null, 'Organization', 'Please select your organization.', groups.map(g => g.name), selected);
        if (!ok)
            return 1;
        groupID = groups[selected.value].id;
        Zotero.Prefs.set(PREF_GROUP_KEY, groupID);
    }

    const collectionKey = Zotero.Prefs.get(PREF_COLLECTION_KEY);
    if (!collectionKey) {
        const targetLibraryID = Zotero.Groups.getLibraryIDFromGroupID(groupID);
        const cols = Zotero.Collections.getByLibrary(targetLibraryID);
        selected = new Object();
        ok = await Services.prompt.select(null, 'Collection', 'Please select the collection to review notes in.', cols.map(c => c.name), selected);
        if (!ok)
            return 1;
        collectionKey = cols[selected.value].key;
        Zotero.Prefs.set(PREF_COLLECTION_KEY, collectionKey);
    }

    if (!item.getCollections().map(c => Zotero.Collections.get(c).name).includes(collectionKey))
        return 0;

    Zotero.ActionsTags.__reviewNoteRunning = false;
    return 0;
})();