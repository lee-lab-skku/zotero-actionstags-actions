let uri = "zotero://open-pdf";
if (item.library.libraryType === "user")
    uri += "/library";
else
    uri += `/groups/${Zotero.Libraries.get(item.libraryID).groupID}`;
uri += `/items/${item.key}`;
uri += `?page=${JSON.parse(item.annotationPosition).pageIndex + 1}&annotation=${item.key}`;

let text = item.annotationText || "";
text = text.split(" ", 8).join(" ");
text = `${text}... (${Zotero.Items.getTopLevel([item])[0].getField("citationKey")})`;

const clipboard = new Zotero.ActionsTags.api.utils.ClipboardHelper();
clipboard.addText(uri, "text/unicode");
clipboard.addText(`<a href="${uri}">${text}</a>`, "text/html");
clipboard.copy();

return "Copied annotation link to clipboard.";