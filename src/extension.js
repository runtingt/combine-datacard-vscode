const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

const tokenTypes = ['keyword', 'variable', 'number'];
const tokenModifiers = [];
const legend = new vscode.SemanticTokensLegend(tokenTypes, tokenModifiers);

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

    // Listen for document changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument(event => {
            const document = event.document;
            // Check plaintext files that might become datacards
            if (document.languageId === 'plaintext' && document.fileName.endsWith('.txt')) {
                console.log('Document changed, checking if this is now a datacard...');
                detectDatacard(document);
            }
            // Check datacard files that might no longer be datacards
            else if (document.languageId === 'combine-datacard') {
                const firstThreeLines = document.getText(new vscode.Range(0, 0, 3, 0)).split('\n');
                const isDatacard = firstThreeLines[0]?.startsWith('imax') &&
                                   firstThreeLines[1]?.startsWith('jmax') &&
                                   firstThreeLines[2]?.startsWith('kmax');
                
                if (!isDatacard) {
                    console.log('File no longer matches datacard format, reverting to plaintext');
                    vscode.languages.setTextDocumentLanguage(document, 'plaintext');
                }
            }
        })
    );

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

function hasShapeSection(document) {
    const shapesRegex = /^shapes\b/i;
    for (let i = 0; i < document.lineCount; i++) {
        const lineText = document.lineAt(i).text.trim();
        if (shapesRegex.test(lineText)) {
            return true;
        }
    }
    return false;
}

function getSectionIndex(document, lineNumber) {
    // Find all dashed line indices
    const dashRegex = /^[-]{3,}$/;
    let dashedLineNumbers = [];
    for (let i = 0; i < document.lineCount; i++) {
        const lineText = document.lineAt(i).text.trim();
        if (dashRegex.test(lineText)) {
            dashedLineNumbers.push(i);
        }
    }

    // Determine section index for this line
    let section = 0;
    for (let i = 0; i < dashedLineNumbers.length; i++) {
        if (lineNumber > dashedLineNumbers[i]) {
            section = i + 1;
        } else {
            break;
        }
    }
    return section;
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
        const currentSection = getSectionIndex(document, position.line);
        const hasShape = hasShapeSection(document);

        // Get context-specific keywords
        let contextKeywords = [];
        let adjustedSection;
        if (hasShape) {
            adjustedSection = currentSection;
        } else {
            if (currentSection === 0) {
                adjustedSection = 0;  // Header stays as header
            } else {
                adjustedSection = currentSection + 1;
            }
        }
        switch (adjustedSection) {
            case 0: // header
                console.log('Header section');
                contextKeywords = ['imax', 'jmax', 'kmax'];
                break;
            case 1: // shapes
                console.log('Shapes section');
                contextKeywords = ['shapes'];
                break;
            case 2: // channel definition
                console.log('Channel definition section');
                contextKeywords = ['bin', 'observation'];
                break;
            case 3: // process definition
                console.log('Process definition section');
                contextKeywords = ['bin', 'process', 'rate'];
                break;
            case 4: // systematics
                console.log('Systematics section');
                contextKeywords = ['lnN', 'gmN', 'lnU', 'shape'];
                break;
            default:
                console.log('Other section');
                contextKeywords = [];
        }

        // Sugest keywords ranked by relevance
        keywords.forEach(kw => {
            const item = new vscode.CompletionItem(kw, vscode.CompletionItemKind.Keyword);
            item.detail = `Datacard keyword: ${kw}`;

            // Sort by relevance
            if (contextKeywords.includes(kw)) {
                item.sortText = `0-${kw}`;
            } else {
                item.sortText = `1-${kw}`;
            }
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
        const defaultLength = 80;
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
                // Put this completion at the top of the list
                markerCompletion.sortText = '!';
                completions.push(markerCompletion);
            }
        }
        // If the user is typing dashes and there is no reference marker
        else if (dashPrefixMatch && lastMarkerLine < 0) {
            const markerCompletion = new vscode.CompletionItem(
                `Complete divider (${defaultLength} -'s)`,
                vscode.CompletionItemKind.Snippet
            );
            markerCompletion.insertText = '-'.repeat(defaultLength - dashPrefixMatch[1].length);
            markerCompletion.detail = `Complete marker with ${defaultLength - dashPrefixMatch[1].length} more -'s`;
            markerCompletion.filterText = '-'.repeat(dashPrefixMatch[1].length);
            // Put this completion at the top of the list
            markerCompletion.sortText = '!';
            completions.push(markerCompletion);
        }
        // If we have a reference and not currently typing dashes
        else if (lastMarkerLine >= 0 && !linePrefix.trim().startsWith('-')) {
            const closingMarker = new vscode.CompletionItem(
                `Add divider: ${lastMarkerLength} -'s`,
                vscode.CompletionItemKind.Snippet
            );
            closingMarker.insertText = '-'.repeat(lastMarkerLength);
            closingMarker.detail = `Add divider: ${lastMarkerLength} -'s`;
            completions.push(closingMarker);
        }
        // If we have no reference and not currently typing dashes
        else if (lastMarkerLine < 0 && !linePrefix.trim().startsWith('-')) {
            const defaultMarker = new vscode.CompletionItem(
                `Add divider: ${defaultLength} -\'s`,
                vscode.CompletionItemKind.Snippet
            );
            defaultMarker.insertText = '-'.repeat(80);
            defaultMarker.detail = `Add divider: ${defaultLength} -\'s`;
            completions.push(defaultMarker);
        }

        return completions;
    }
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};
