const PREF_GROUP_KEY = 'actionsTags.actions.groupID';
const PREF_REVIEW_COLLECTION_KEY = 'actionsTags.actions.reviewCollectionKey';
const PREF_SHARE_COLLECTION_KEY = 'actionsTags.actions.shareCollectionKey';
const PREF_NAME = 'actionsTags.actions.reviewerName';

const selected = new Object();
let ok;
let anySet = false;

let groupID = Zotero.Prefs.get(PREF_GROUP_KEY);
if (!groupID) {
    const groups = Zotero.Groups.getAll();
    ok = await Services.prompt.select(null, 'Organization', 'Which group is your organization?', groups.map(g => g.name), selected);
    if (!ok) {
        return 1;
    }
    groupID = groups[selected.value].id;
    Zotero.Prefs.set(PREF_GROUP_KEY, groupID);
    anySet = true;
}
const targetLibraryID = Zotero.Groups.getLibraryIDFromGroupID(groupID);

let reviewCollectionKey = Zotero.Prefs.get(PREF_REVIEW_COLLECTION_KEY);
if (!reviewCollectionKey) {
    const cols = Zotero.Collections.getByLibrary(targetLibraryID);
    ok = await Services.prompt.select(null, 'Review', 'Which collection is for review?', cols.map(c => c.name), selected);
    if (!ok) {
        return 1;
    }
    reviewCollectionKey = cols[selected.value].key;
    Zotero.Prefs.set(PREF_REVIEW_COLLECTION_KEY, reviewCollectionKey);
    anySet = true;
}
let shareCollectionKey = Zotero.Prefs.get(PREF_SHARE_COLLECTION_KEY);
if (!shareCollectionKey) {
    const cols = Zotero.Collections.getByLibrary(targetLibraryID);
    ok = await Services.prompt.select(null, 'Share', 'Which collection is for sharing?', cols.map(c => c.name), selected);
    if (!ok) {
        return 1;
    }
    shareCollectionKey = cols[selected.value].key;
    Zotero.Prefs.set(PREF_SHARE_COLLECTION_KEY, shareCollectionKey);
    anySet = true;
}

let reviewerName = Zotero.Prefs.get(PREF_NAME);
if (!reviewerName) {
    ok = await Services.prompt.prompt(null, 'Name', 'What is your name? (In Korean, no space.)', selected, null, {});
    if (!ok) {
        return 1;
    }
    reviewerName = selected.value;
    Zotero.Prefs.set(PREF_NAME, reviewerName);
}

if (anySet)
    return 'Preferences set successfully.';
