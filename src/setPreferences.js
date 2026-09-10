const Zotero = require('Zotero');
const Services = require('Services');
const PREF_GROUP_KEY = 'actionsTags.actions.groupID';
const PREF_GROUP_KEY_ALT = 'tara.groupID';
const PREF_REVIEW_COLLECTION_KEY = 'actionsTags.actions.reviewCollectionKey';
const PREF_SHARE_COLLECTION_KEY = 'actionsTags.actions.shareCollectionKey';
const PREF_NAME = 'actionsTags.actions.reviewerName';

let anySet = false;
let groupID = Number(Zotero.Prefs.get(PREF_GROUP_KEY) || Zotero.Prefs.get(PREF_GROUP_KEY_ALT));
let group = groupID && Zotero.Groups.get(groupID);
if (!group) {
    const groups = Zotero.Groups.getAll();
    if (!groups.length)
        return 'Join and sync a Zotero group before setting preferences.';
    const selected = { value: 0 };
    if (!Services.prompt.select(null, 'Organization', 'Which group is your organization?', groups.map(g => g.name), selected))
        return;
    group = groups[selected.value];
    if (!group)
        return;
    groupID = group.id;
}
if (Zotero.Prefs.get(PREF_GROUP_KEY) !== groupID) {
    Zotero.Prefs.set(PREF_GROUP_KEY, groupID);
    anySet = true;
}
const targetLibraryID = group.libraryID;
const cols = Zotero.Collections.getByLibrary(targetLibraryID, true);
if (!cols.length)
    return 'Create and sync the review and share collections in your group first.';

for (const [pref, title, message] of [
    [PREF_REVIEW_COLLECTION_KEY, 'Review', 'Which collection is for review?'],
    [PREF_SHARE_COLLECTION_KEY, 'Share', 'Which collection is for sharing?'],
]) {
    const key = Zotero.Prefs.get(pref);
    if (key && Zotero.Collections.getByLibraryAndKey(targetLibraryID, key))
        continue;
    const selected = { value: 0 };
    if (!Services.prompt.select(null, title, message, cols.map(c => c.name), selected))
        return;
    if (!cols[selected.value])
        return;
    Zotero.Prefs.set(pref, cols[selected.value].key);
    anySet = true;
}

if (!String(Zotero.Prefs.get(PREF_NAME) || '').trim()) {
    const input = { value: '' };
    if (!Services.prompt.prompt(null, 'Name', 'What is your name? (In Korean, no space.)', input, null, {}))
        return;
    const name = input.value.trim();
    if (!name)
        return 'Enter a non-empty reviewer name.';
    Zotero.Prefs.set(PREF_NAME, name);
    anySet = true;
}
if (anySet)
    return 'Preferences set successfully.';
