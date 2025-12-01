const PREF_GROUP_KEY = 'actionsTags.actions.groupID';
const PREF_COLLECTION_KEY = 'actionsTags.actions.reviewCollectionKey';
const PREF_NAME = 'actionsTags.actions.reviewerName';

const targetItem = Zotero.Items.get(item.id);

if (Zotero.ActionsTags.__reviewNoteRunning) return;
Zotero.ActionsTags.__reviewNoteRunning = true;

const groupID = Zotero.Prefs.get(PREF_GROUP_KEY);
if (!groupID) 
    return 'Set preferences first.';
const targetLibraryID = Zotero.Groups.getLibraryIDFromGroupID(groupID);

const collectionKey = Zotero.Prefs.get(PREF_COLLECTION_KEY);
if (!collectionKey)
    return 'Set preferences first.';

if (!targetItem.getCollections().map(c => Zotero.Collections.get(c).key).includes(collectionKey)) {
    Zotero.ActionsTags.__reviewNoteRunning = false;
    return 0;
}

const reviewerName = Zotero.Prefs.get(PREF_NAME);
if (!reviewerName) 
    return 'Set preferences first.';

const now = new Date().getTime();
let cnt = 0;
const dates = [];

while (cnt <= 7) {
    dates.push(new Date(now + cnt * 86400000).toISOString());
    cnt++;
}

const selected = new Object();
const ok = await Services.prompt.select(null, 'Review Date', 'Select the review date.', dates.map(d => d.slice(5, 10)), selected);
if (!ok) {
    Zotero.ActionsTags.__reviewNoteRunning = false;
    return 1;
}

const td = dates[selected.value];
const noteContent = `<h1>${td.slice(2,4)}${td.slice(5,7)}${td.slice(8,10)} ${reviewerName}</h1>`;

const note = new Zotero.Item('note');
note.libraryID = targetLibraryID;
note.parentID = targetItem.id;
note.setNote(noteContent);
await note.saveTx();

Zotero.ActionsTags.__reviewNoteRunning = false;
return 0;
