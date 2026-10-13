const Zotero = require('Zotero');

const sink = Zotero.ActionLinkBridge?.capture('copyAnnotationLink', item, items, collection,
    typeof triggerType === 'undefined' ? null : triggerType);

try {

    function fail(code, message) {
        if (sink) {
            sink.fail(code, message);
            return;
        }
        return message;
    }

    if (!item)
        return;
    if (!item.isAnnotation() || !item.parentItem?.isPDFAttachment())
        return fail('INVALID_ITEM_TYPE', 'Select an annotation in a PDF.');

    let position;
    try {
        position = JSON.parse(item.annotationPosition);
    } catch (_) {
        return fail('INVALID_POSITION', 'The annotation has no valid PDF position.');
    }
    if (!Number.isInteger(position?.pageIndex) || position.pageIndex < 0)
        return fail('INVALID_POSITION', 'The annotation has no valid PDF page.');

    let uri = "zotero://open-pdf";
    if (item.library.libraryType === "user")
        uri += "/library";
    else
        uri += `/groups/${Zotero.Libraries.get(item.libraryID).groupID}`;
    uri += `/items/${item.parentItem.key}`;
    uri += `?page=${position.pageIndex + 1}&annotation=${item.key}`;

    let text = item.annotationText || "";
    text = text.split(" ", 8).join(" ");
    const top = Zotero.Items.getTopLevel([item])[0];
    const label = (top.isRegularItem() && top.getField('citationKey')) || top.getField('title') || top.key;
    text = `${text}... (${label})`;
    const labelText = text;
    text = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    if (sink) {
        sink.complete([{ uri, label: labelText, html: `<a href="${uri}">${text}</a>` }]);
        return;
    }
    const clipboard = new Zotero.ActionsTags.api.utils.ClipboardHelper();
    clipboard.addText(uri, "text/unicode");
    clipboard.addText(`<a href="${uri}">${text}</a>`, "text/html");
    clipboard.copy();

    return "Copied PDF annotation link to clipboard.";

} catch (error) {
    if (!sink)
        throw error;
    sink.fail('ACTION_FAILED', error.message || String(error));
}
