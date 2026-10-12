const Zotero = require('Zotero');
const listenerKey = '__actionsTagsTrashOnDelete';

// Main-window-load actions receive their own window, including additional windows.
const win = window;
win[listenerKey]?.dispose();
let busy = false;
const onKeyDown = event => {
    if (event.key !== 'Delete' || event.ctrlKey || event.altKey || event.metaKey
        || event.shiftKey || event.defaultPrevented || event.isComposing)
        return;
    // Check the live setting so disabling/deleting the action takes effect immediately.
    const action = Zotero.ActionsTags?.api.actionManager.getActions('trashOnDelete');
    if (!action?.enabled || win.Zotero_Tabs?.selectedType !== 'library')
        return;
    const tree = win.document.getElementById('zotero-items-tree');
    const target = event.target;
    if (!tree?.contains(target) || target.isContentEditable
        || target.closest('input, textarea, select, textbox, search-textbox, [contenteditable="true"]'))
        return;
    const pane = win.ZoteroPane;
    const rows = pane.getCollectionTreeRows();
    if (!rows.length || !rows.every(row => row.isCollection()))
        return;
    // This load event has no injected items. Read this window's item-tree selection
    // at keydown time, rather than a pane getter that also resolves reader tabs.
    const view = pane.itemsView;
    if (!view)
        return;
    const selected = Array.from(view.selection.selected, index => view.getRow(index).ref);
    // Zotero permanently erases annotations; this action is only for trashable items.
    if (!selected.length || selected.some(item => item.deleted || item.isAnnotation()))
        return;

    // Suppress native collection removal synchronously, before starting async work.
    event.preventDefault();
    event.stopImmediatePropagation();
    if (busy || event.repeat)
        return;
    busy = true;
    // Use Zotero's permission checks, confirmation, child handling, and Undo support.
    Promise.resolve().then(() => pane.deleteSelectedItems(true, true))
        .catch(error => Zotero.logError(error))
        .finally(() => { busy = false; });
};
const dispose = () => {
    win.removeEventListener('keydown', onKeyDown, true);
    win.removeEventListener('unload', dispose);
    delete win[listenerKey];
};
win[listenerKey] = { dispose };
win.addEventListener('keydown', onKeyDown, true);
win.addEventListener('unload', dispose);
