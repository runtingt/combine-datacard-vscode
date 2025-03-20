const vscode = require('vscode');

function activate(context) {
    console.log('CombineCardMate extension activated');

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
