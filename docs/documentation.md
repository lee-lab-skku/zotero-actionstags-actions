# Documentation workflow

Follow mddt's writing procedure when changing this repository's Markdown documents.
This guide places content in the repository's document trees and describes local review, checks, and CI's floating version.

## Scope and placement

All maintained Markdown follows the [mddt document model](https://github.com/mirinae3145/mddt/blob/main/skills/mddt/references/model.md), including the changelog and bundled skill.
The collection has two entry documents, `README.md` and `skills/zot-jot/SKILL.md`.
Place content according to its reader and purpose:

| Location | Purpose |
| --- | --- |
| `README.md` | Essential installation, basic menu use, and entry points to the guides and skill |
| `CONTRIBUTING.md` | Development setup, contribution requirements, and durable action and distribution contracts |
| `docs/README.md` and its guides | Detailed user setup, documentation maintenance, builds, and release workflows |
| `tests/README.md` and its descendants | Suite selection, coverage, test oracles, and real-app verification |
| `skills/zot-jot/SKILL.md` and `references/` | Independently installable agent workflow and the canonical link API reference |
| `CHANGELOG.md` | Release history in the existing changelog format |

Keep the skill self-contained: its document links must resolve within its own directory.
Repository guides can link into the skill to explain client behavior without duplicating its API contract.
Every parent introduces its children with links and summaries; the repository README also introduces the skill entry.

Generated artifacts in `dist/` are already excluded by Git.
If future Markdown fixtures, templates, or preserved originals should not follow the model, declare them in `.mddtignore` with a reason.
Do not exclude maintained documents to silence findings; mddt already accommodates changelog conventions.

## Writing and review

Use an installed mddt skill or a checkout of the [mddt repository](https://github.com/mirinae3145/mddt) for both its references and checker.
Follow the full [writing and restructuring procedure](https://github.com/mirinae3145/mddt/blob/main/skills/mddt/references/writing.md) before and after editing:

1. Place new or moved content in its tree before writing, choosing its reader, question, document kind, and parent summary.
   Sentence-only corrections and formatting changes that preserve structure need no placement plan.
1. Preserve contracts and conditions when moving content, and update links to moved files or headings throughout the collection.
   Keep the skill's packaged resources self-contained.
1. Once the content settles, reread each changed topic whole and review its order, forms, and level of detail.
   Rewrite overviews and parent summaries from the deepest changed documents upward.
1. Run the [Markdown check](#checking-markdown) and judge the findings.

Writers and reviewers judge placement, document kinds, and summaries; the checker cannot decide those questions.
A run without errors is the automated minimum, not evidence of full conformance.

## Checking Markdown

Install [uv](https://docs.astral.sh/uv/getting-started/installation/) and use Python 3.11 or later.
uv installs the checker's declared dependencies, including its local English sentence model.
From this repository's root, a disposable mddt checkout can be used as follows:

```sh
MDDT="$(mktemp -d)/mddt"
git clone --depth 1 https://github.com/mirinae3145/mddt.git "$MDDT"
uv run "$MDDT/skills/mddt/scripts/mddt.py" --root . .
```

To use an existing mddt checkout or installed skill instead, substitute its `scripts/mddt.py` path.
Keep the checkout outside this repository so the collection check covers only this project's documents.

For an ordinary text edit, the checker can take the changed Markdown paths instead of the final `.`.
After adding, removing, moving, or renaming files or headings, check the whole collection.
Add `--review` after introducing child documents or when deliberately reviewing structure; it includes outlines and summary-related findings.
The [checker reference](https://github.com/mirinae3145/mddt/blob/main/skills/mddt/references/checker.md) defines file selection, diagnostics, and exit statuses.

Missing-anchor findings need manual review because they are warnings, even though moved headings can break links.
If a move changes a target used outside this repository, report the old and new locations so those callers can be updated.

## Continuous integration

The **Documentation** job in the shared [Test workflow](../.github/workflows/test.yml) runs on branch pushes, pull requests, manual runs, and release calls.
It fetches mddt's current default branch without a pinned tag or commit and prints the resolved commit in each run.
New upstream rules can therefore change results without a change in this repository.
When reproducing a CI result, use the logged commit and distinguish it from findings produced by a different local revision.

CI fails on checker errors anywhere in the collection, including errors in unchanged documents affected by a moved link target.
It reports warnings only for changed files, comparing a PR with its merge base or a push with its previous commit.
Manual runs, new branches, and runs without an available comparison base report warnings for all checked files.
Warnings require judgment and do not fail the job; checker or input failures do fail it.
