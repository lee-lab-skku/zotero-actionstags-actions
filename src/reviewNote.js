(async () => {
    if (Zotero.ActionsTags.__reviewNoteRunning) return;
    Zotero.ActionsTags.__reviewNoteRunning = true;

    Zotero.ActionsTags.__reviewNoteRunning = false;
    return 0;
})();