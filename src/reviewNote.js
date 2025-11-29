const PREF_GROUP_KEY = 'extensions.zotero-actionstags.group-id';
const PREF_COLLECTION_KEY = 'extensions.zotero-actionstags.review-collection-key';
const PREF_NAME = 'extensions.zotero-actionstags.reviewer-name';

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
        if (!ok) {
            Zotero.ActionsTags.__reviewNoteRunning = false;
            return 1;
        }
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

    if (!targetItem.getCollections().map(c => Zotero.Collections.get(c).key).includes(collectionKey)) {
        Zotero.ActionsTags.__reviewNoteRunning = false;
        return 0;
    }

    let reviewerName = Zotero.Prefs.get(PREF_NAME);
    if (!reviewerName) {
        ok = await Services.prompt.prompt(null, 'Reviewer Name', 'Please enter your name to be added to the review note. (In Korean, no space.)', selected, null, {});
        if (!ok) {
            Zotero.ActionsTags.__reviewNoteRunning = false;
            return 1;
        }
        reviewerName = selected.value.trim();
        Zotero.Prefs.set(PREF_NAME, reviewerName);
    }

    const now = new Date().getTime();
    let cnt = 0;
    const dates = [];

    while (cnt <= 7) {
        dates.push(new Date(now + cnt * 86400000).toISOString());
        cnt++;
    }

    ok = await Services.prompt.select(null, 'Review Date', 'Select the review date.', dates.map(d => d.slice(5, 10)), selected);
    if (!ok) {
        Zotero.ActionsTags.__reviewNoteRunning = false;
        return 1;
    }

    const td = dates[selected.value];
    const noteContent = `<h1>${td.slice(2,4)}${td.slice(5,7)}${td.slice(8,10)} ${reviewerName}</h1>`;

    const note = new Zotero.Item('note');
    note.parentID = targetItem.id;
    note.setNote(noteContent);
    await note.saveTx();

    Zotero.ActionsTags.__reviewNoteRunning = false;
    return 0;
})();