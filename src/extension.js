const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

let keywords = [];
function loadKeywords(context) {
    const grammarPath = path.join(context.extensionPath, 'syntaxes', 'combine-datacard.tmLanguage.json');
    try {
        // Extract keywords from the grammar file
        const grammar = JSON.parse(fs.readFileSync(grammarPath, 'utf8'));
        const keywordPattern = grammar.patterns.find(pattern => pattern.name === "keyword.combine-datacard");
        if (keywordPattern && keywordPattern.match) {
            const keywordRegex = /(?:\(|\|)(\w+)(?=\||\))/g;
            let match;
            while ((match = keywordRegex.exec(keywordPattern.match)) !== null) {
                keywords.push(match[1]);
            }
        }
        console.log('Loaded keywords:', keywords);

    } catch (error) {
        console.error('Error loading grammar file:', error);
        console.error('Tried to load:', grammarPath);
    }
}

function detectDatacard(document) {
    const firstThreeLines = document.getText(new vscode.Range(0, 0, 3, 0)).split('\n');
    const isDatacard = firstThreeLines[0]?.startsWith('imax') &&
                       firstThreeLines[1]?.startsWith('jmax') &&
                       firstThreeLines[2]?.startsWith('kmax');
    console.log(firstThreeLines);
    console.log('Is datacard:', isDatacard);
    if (isDatacard) {
        vscode.languages.setTextDocumentLanguage(document, 'combine-datacard');
        console.log('Datacard detected and language set to combine-datacard');
    } else {
        console.log('This file does not appear to be a datacard.');
    }
}

function activate(context) {
    console.log('CombineDatacard extension activated');
    loadKeywords(context);

    // Listen for opened text documents
    vscode.workspace.onDidOpenTextDocument(document => {
        console.log('Opened document:', document.fileName);
        console.log('Language ID:', document.languageId);
        // Check if the file is a plain text file
        if (document.languageId === 'plaintext' && document.fileName.endsWith('.txt')) {
            console.log('Checking if this is a datacard...');
            detectDatacard(document);
        }
    });

    // Process any already open documents
    vscode.workspace.textDocuments.forEach(document => {
        console.log('Open document:', document.fileName);
        console.log('Language ID:', document.languageId);
        // Check if the file is a plain text file
        if (document.languageId === 'plaintext' && document.fileName.endsWith('.txt')) {
            console.log('Checking if this is a datacard...');
            detectDatacard(document);
        }
    });

    // Register the folding range provider for combine-datacard files
    context.subscriptions.push(
        vscode.languages.registerFoldingRangeProvider(
            { language: 'combine-datacard' },
            new CombineFoldingRangeProvider()
        )
    );

    // Register the completion item provider for combine-datacard files
    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(
            { language: 'combine-datacard' },
            new CombineCompletionItemProvider(),
            ' ', // trigger on space
            '-', // trigger on dash
            '\n', // trigger on newline
            ...keywords, // trigger on keywords
        )
    );
}

class CombineFoldingRangeProvider {
    provideFoldingRanges(document, context, token) {
        const foldingRanges = [];
        const dashLineRegex = /^-{3,}$/; // matches lines with 3 or more dashes
        let startMarkerLine = null;

        for (let i = 0; i < document.lineCount; i++) {
            const lineText = document.lineAt(i).text.trim();
            if (dashLineRegex.test(lineText)) {
                if (startMarkerLine === null) {
                    // First marker found – this will be our folding start.
                    startMarkerLine = i;
                } else {
                    // Next marker found – fold from the previous marker to the line above this one.
                    if (i - 1 > startMarkerLine) { // ensure there's at least one line in between
                        foldingRanges.push(new vscode.FoldingRange(startMarkerLine, i - 1));
                    }
                    // Update startMarkerLine for any subsequent region
                    startMarkerLine = i;
                }
            }
        }
        return foldingRanges;
    }
}

class CombineCompletionItemProvider {
    provideCompletionItems(document, position, token, context) {
        const completions = [];
        const linePrefix = document.lineAt(position).text.substring(0, position.character);
        const currentLineText = document.lineAt(position).text.trim();
        
        // Suggest completions for keywords
        keywords.forEach(kw => {
            const item = new vscode.CompletionItem(kw, vscode.CompletionItemKind.Keyword);
            item.detail = `Datacard keyword: ${kw}`;
            completions.push(item);
        });

        // Find the most recent marker line
        let lastMarkerLine = -1;
        let lastMarkerLength = 0;
        for (let i = position.line - 1; i >= 0; i--) {
            const lineText = document.lineAt(i).text.trim();
            const dashMatch = lineText.match(/^(-{3,})$/);
            if (dashMatch) {
                lastMarkerLine = i;
                lastMarkerLength = dashMatch[1].length;
                break;
            }
        }

        // Don't suggest anything if the line is already a complete marker
        if (/^-{3,}$/.test(currentLineText)) {
            return completions;
        }

        // If the user is typing dashes (but not enough to be a complete marker)
        const dashPrefixMatch = linePrefix.trim().match(/^(-{1,2})$/);
        if (dashPrefixMatch && lastMarkerLength > 0) {
            const existingDashes = dashPrefixMatch[1].length;
            const remainingDashes = lastMarkerLength - existingDashes;

            if (remainingDashes > 0) {
                const markerCompletion = new vscode.CompletionItem(
                    `Complete divider (${lastMarkerLength} -'s)`,
                    vscode.CompletionItemKind.Snippet
                );
                markerCompletion.insertText = '-'.repeat(remainingDashes);
                markerCompletion.detail = `Complete marker with ${remainingDashes} more -'s`;
                markerCompletion.filterText = '-'.repeat(existingDashes);
                completions.push(markerCompletion);
            }
        }

        // Suggest adding a full marker if we have a reference and not currently typing dashes
        else if (lastMarkerLine >= 0 && !linePrefix.trim().startsWith('-')) {
            const closingMarker = new vscode.CompletionItem(
                `Add divider: ${lastMarkerLength} -'s`,
                vscode.CompletionItemKind.Snippet
            );
            closingMarker.insertText = '-'.repeat(lastMarkerLength);
            closingMarker.detail = `Add divider: ${lastMarkerLength} -'s`;
            completions.push(closingMarker);
        }

        return completions;
    }
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};
