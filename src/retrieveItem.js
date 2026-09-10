const Zotero = require('Zotero');
const Services = require('Services');
const PREF_GROUP_KEY = 'actionsTags.actions.groupID';
const PREF_COLLECTION_KEY = 'actionsTags.actions.shareCollectionKey';

if (!item)
    return;
if (!item.isRegularItem() || item.deleted)
    return 'Select a regular library item to retrieve.';
const groupID = Number(Zotero.Prefs.get(PREF_GROUP_KEY));
const group = groupID && Zotero.Groups.get(groupID);
const collectionKey = Zotero.Prefs.get(PREF_COLLECTION_KEY);
if (!group || !collectionKey)
    return 'Set preferences first.';
const shareCollection = Zotero.Collections.getByLibraryAndKey(group.libraryID, collectionKey);
if (item.libraryID !== group.libraryID || !shareCollection
    || !item.getCollections().includes(shareCollection.id))
    return 'Item not in the configured group share collection.';
if (!item.isEditable())
    return 'The source item is read-only.';

const cols = Zotero.Collections.getByLibrary(Zotero.Libraries.userLibraryID, true);
if (!cols.length)
    return 'Create a collection in My Library first.';
const selected = { value: 0 };
if (!Services.prompt.select(null, 'Selection', 'Select the collection to move the item to.', cols.map(c => c.name), selected))
    return;
const destination = cols[selected.value];
if (!destination)
    return;

async function copyItemToCollection(source, destination) {
    const library = Zotero.Libraries.get(destination.libraryID);
    if (!library?.editable)
        throw new Error('The destination library is read-only.');
    if (source.libraryID === destination.libraryID)
        throw new Error('Select an item from a different library.');

    const attachments = await Zotero.Items.getAsync(source.getAttachments());
    const notes = await Zotero.Items.getAsync(source.getNotes());
    const images = [];
    for (const note of notes)
        images.push(...await Zotero.Items.getAsync(note.getAttachments()));
    // Core copy APIs can skip missing files; stop before writing instead.
    for (const attachment of [...attachments, ...images]) {
        if (!attachment.isFileAttachment())
            continue;
        if (!library.filesEditable)
            throw new Error('The destination library does not allow file uploads.');
        if (!await attachment.fileExists())
            throw new Error('Download or locate all attachments and note images before copying.');
    }

    return Zotero.DB.executeTransaction(async () => {
        const copy = source.clone(destination.libraryID);
        copy.setCollections([destination.id]);
        await copy.save({ skipSelect: true });
        for (const note of notes) {
            const newNote = note.clone(destination.libraryID);
            newNote.parentID = copy.id;
            await newNote.save({ skipSelect: true });
            await Zotero.Notes.copyEmbeddedImages(note, newNote);
        }
        for (const attachment of attachments) {
            let newAttachment;
            if (attachment.isLinkedFileAttachment()) {
                // Group libraries do not support linked files. Import a stored copy.
                const path = await attachment.getFilePathAsync();
                if (!path)
                    throw new Error('The linked attachment is no longer available.');
                newAttachment = await Zotero.Attachments.importFromFile({
                    file: path,
                    libraryID: destination.libraryID,
                    parentItemID: copy.id,
                    title: attachment.getField('title'),
                    contentType: attachment.attachmentContentType,
                });
                newAttachment.setTags(attachment.getTags());
                newAttachment.setNote(attachment.getNote());
                await newAttachment.save();
            } else {
                newAttachment = await Zotero.Attachments.copyAttachmentToLibrary(
                    attachment, destination.libraryID, copy.id);
            }
            await Zotero.Items.copyChildItems(attachment, newAttachment);
        }
        return copy;
    });
}

await copyItemToCollection(item, destination);
// Keep the source recoverable; only trash it after the complete copy commits.
item.deleted = true;
await item.saveTx({
    undoAction: 'undo-action-trash',
    undoActionArgs: { count: 1 },
});
return 'Retrieved item successfully. The source is in the group library trash.';
