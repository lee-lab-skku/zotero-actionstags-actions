const Zotero = require('Zotero');
const Services = require('Services');

// Startup scripts receive no item context. Filter menu follow-up calls at dispatch.
const guardKey = 'setPreferences';
const guardSymbol = Symbol.for('lee-lab-skku.actions.selectionGuard');
const guardState = Zotero[guardSymbol] ||= { menuKeys: new Set(), running: new Set() };
guardState.menuKeys.add(guardKey);
const guardManager = Zotero.ActionsTags?.api?.actionManager;
const previousDispatch = guardManager?.dispatchActionByKey;
if (typeof previousDispatch === 'function' && !previousDispatch[guardSymbol]) {
    const guardedDispatch = function(key, args, ...rest) {
        if (guardState.menuKeys.has(key) && args?.triggerType === 'menu' && args.itemID != null)
            return;
        return previousDispatch.call(this, key, args, ...rest);
    };
    guardedDispatch[guardSymbol] = true;
    guardManager.dispatchActionByKey = guardedDispatch;
}
if (guardState.running.has(guardKey)) return;
guardState.running.add(guardKey);
try {
    const PREF_GROUP_KEY = 'actionsTags.actions.groupID';
    const PREF_REVIEW_COLLECTION_KEY = 'actionsTags.actions.reviewCollectionKey';
    const PREF_NAME = 'actionsTags.actions.reviewerName';
    const PRERELEASE_KEY = 'actionsTags.actions.includePrereleases';

    let anySet = false;
    const manual = typeof triggerType !== 'undefined' && triggerType !== 8;
    if (manual || typeof Zotero.Prefs.get(PRERELEASE_KEY) !== 'boolean') {
        const prompt = Services.prompt;
        const flags = prompt.BUTTON_POS_0 * prompt.BUTTON_TITLE_NO
            + prompt.BUTTON_POS_1 * prompt.BUTTON_TITLE_YES + prompt.BUTTON_POS_0_DEFAULT;
        const answer = prompt.confirmEx(null, 'Action updates',
            'Include prerelease versions when checking for action updates?', flags,
            null, null, null, null, {});
        Zotero.Prefs.set(PRERELEASE_KEY, answer === 1);
        anySet = true;
    }
    let groupID = Number(Zotero.Prefs.get(PREF_GROUP_KEY));
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
        return 'Create and sync a review collection in your group first.';

    const reviewKey = Zotero.Prefs.get(PREF_REVIEW_COLLECTION_KEY);
    if (!reviewKey || !Zotero.Collections.getByLibraryAndKey(targetLibraryID, reviewKey)) {
        const selected = { value: 0 };
        if (!Services.prompt.select(null, 'Review', 'Which collection is for review?', cols.map(c => c.name), selected))
            return;
        if (!cols[selected.value])
            return;
        Zotero.Prefs.set(PREF_REVIEW_COLLECTION_KEY, cols[selected.value].key);
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
} finally {
    guardState.running.delete(guardKey);
}
