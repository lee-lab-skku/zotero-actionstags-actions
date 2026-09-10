const Zotero = require('Zotero');
const Services = require('Services');
const PREF_GROUP_KEY = 'actionsTags.actions.groupID';
const PREF_COLLECTION_KEY = 'actionsTags.actions.reviewCollectionKey';
const PREF_NAME = 'actionsTags.actions.reviewerName';

if (!item || !item.isRegularItem() || item.deleted)
    return;

const groupID = Number(Zotero.Prefs.get(PREF_GROUP_KEY));
const group = groupID && Zotero.Groups.get(groupID);
const collectionKey = Zotero.Prefs.get(PREF_COLLECTION_KEY);
if (!group || !collectionKey)
    return 'Set preferences first.';
const targetLibraryID = group.libraryID;
if (item.libraryID !== targetLibraryID)
    return;
const targetCollection = Zotero.Collections.getByLibraryAndKey(targetLibraryID, collectionKey);
if (!targetCollection || !item.getCollections().includes(targetCollection.id))
    return;
if (!item.isEditable())
    return 'The review item is read-only.';

const reviewerName = String(Zotero.Prefs.get(PREF_NAME) || '').trim();
if (!reviewerName)
    return 'Set preferences first.';

const today = new Date();
const dates = Array.from({ length: 15 }, (_, offset) => {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0')].join('-');
});
const selected = { value: 0 };
if (!Services.prompt.select(null, 'Review Date', 'Select the review date.', dates.map(d => d.slice(5)), selected))
    return 'Review information not added.';
const date = dates[selected.value];
if (!date)
    return;
const title = date.slice(2).replace(/-/g, '') + ' ' + reviewerName;
const escapedTitle = title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const note = new Zotero.Item('note');
note.libraryID = targetLibraryID;
note.parentID = item.id;
note.setNote('<h1>' + escapedTitle + '</h1>');
await note.saveTx();
return 'Added review information successfully.';
