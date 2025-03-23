const vscode = require('vscode');

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

function deactivate() {}

module.exports = {
    activate,
    deactivate
};
