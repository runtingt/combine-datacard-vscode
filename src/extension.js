const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { assert } = require('console');

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

const keywordDefinitions = {
    observation: "Number of observed events",
    bin: "Label for each channel",
    process: "Label for each process",
    rate: "Expected event yield for channel and process",
    shapes: "Template definition",
    shape: "Systematic shape uncertainty",
    imax: "Number of channels",
    jmax: "Number processes minus 1",
    kmax: "Number of nuisances",
    lnN: "(Asymmetric) Log-normal uncertainty",
    lnU: "Log-uniform uncertainty",
    gmN: "Gamma uncertainty",
    rateParam: "Multiplicative scale factor",
    discrete: "Discrete nuisance parameter",
    nuisance: "Nuisance parameter",
    edit: "Directive to modify a nuisance",
    freeze: "Freeze a nuisance"
}


function detectDatacard(document) {
    // Get all lines in the document
    const allLines = document.getText().split('\n');
    let isDatacard = false;

    // Check for three consecutive lines with the pattern anywhere in the document
    for (let i = 0; i <= allLines.length - 3; i++) {
        if (allLines[i].trim().startsWith('imax') && 
            allLines[i + 1].trim().startsWith('jmax') && 
            allLines[i + 2].trim().startsWith('kmax')) {
            isDatacard = true;
            break;
        }
    }

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

    // Register the align columns command
    const alignColumnsCommand = vscode.commands.registerCommand('combine-datacard.alignColumns', async () => {
        const editor = vscode.window.activeTextEditor;
        if (editor && (editor.document.languageId === 'combine-datacard' || 
                      (editor.document.languageId === 'plaintext' && editor.document.fileName.endsWith('.txt')))) {
            try {
                vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: "Aligning datacard columns...",
                    cancellable: false
                }, async (progress) => {
                    progress.report({ increment: 0 });
                    const success = await alignDatacardColumns(editor.document);
                    progress.report({ increment: 100 });
                    if (success) {
                        vscode.window.showInformationMessage('Datacard columns aligned successfully');
                    } else {
                        vscode.window.showErrorMessage('Failed to align datacard columns');
                    }
                });
            } catch (error) {
                vscode.window.showErrorMessage(`Error aligning columns: ${error.message}`);
            }
        } else {
            vscode.window.showWarningMessage('Align columns command only works with datacard files');
        }
    });
    
    context.subscriptions.push(alignColumnsCommand);

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
                const allLines = document.getText().split('\n');
                let isDatacard = false;
                for (let i = 0; i <= allLines.length - 3; i++) {
                    if (allLines[i].trim().startsWith('imax') && 
                        allLines[i + 1].trim().startsWith('jmax') && 
                        allLines[i + 2].trim().startsWith('kmax')) {
                        isDatacard = true;
                        break;
                    }
                }

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

    // Register the hover provider for the 'combine-datacard' language.
    context.subscriptions.push(
        vscode.languages.registerHoverProvider('combine-datacard', {
            provideHover(document, position, token) {
                // Get the word range at the position
                const range = document.getWordRangeAtPosition(position, /\w+/);
                if (!range) {
                    return;
                }
                const word = document.getText(range);
                
                // If the word is a keyword we care about, return its definition.
                if (keywordDefinitions.hasOwnProperty(word) && keywords.includes(word)) {
                    const definition = keywordDefinitions[word];
                    const markdown = new vscode.MarkdownString();
                    markdown.appendMarkdown(`**${word}**\n\n${definition}`);
                    // Optionally, disable command links if you don't want them parsed.
                    markdown.isTrusted = false;
                    return new vscode.Hover(markdown, range);
                }
                return;
            }
        })
    );

    // Register the document symbol provider for outline view and breadcrumbs
    context.subscriptions.push(
        vscode.languages.registerDocumentSymbolProvider(
            { language: 'combine-datacard' },
            new CombineDocumentSymbolProvider()
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
    // Find the imax/jmax/kmax block
    let headerStart = -1;
    for (let i = 0; i <= document.lineCount - 3; i++) {
        if (document.lineAt(i).text.trim().startsWith('imax') && 
            document.lineAt(i+1).text.trim().startsWith('jmax') && 
            document.lineAt(i+2).text.trim().startsWith('kmax')) {
            headerStart = i;
            break;
        }
    }

    // Find all section start/end indices and check if sections are blank
    const dashRegex = /^[-]{3,}$/;
    let dashedLineNumbers = [];
    let nonBlankSections = [];

    for (let i = 0; i < document.lineCount; i++) {
        const lineText = document.lineAt(i).text.trim();
        if (dashRegex.test(lineText)) {
            dashedLineNumbers.push(i);
        }
    }

    // Identify non-blank sections
    for (let i = 0; i < dashedLineNumbers.length - 1; i++) {
        let isBlank = true;
        // Check if section has any non-whitespace content
        for (let j = dashedLineNumbers[i] + 1; j < dashedLineNumbers[i + 1]; j++) {
            if (j < document.lineCount && document.lineAt(j).text.trim().length > 0) {
                isBlank = false;
                break;
            }
        }
        if (!isBlank) {
            nonBlankSections.push(i);
        }
    }

    // Check the last section (after last dash line)
    if (dashedLineNumbers.length > 0) {
        let isLastSectionBlank = true;
        for (let j = dashedLineNumbers[dashedLineNumbers.length - 1] + 1; j < document.lineCount; j++) {
            if (document.lineAt(j).text.trim().length > 0) {
                isLastSectionBlank = false;
                break;
            }
        }
        if (!isLastSectionBlank) {
            nonBlankSections.push(dashedLineNumbers.length - 1);
        }
    }

    // Determine which section contains the header
    let headerSectionIndex = 0; // Default to first section
    if (headerStart >= 0) {
        for (let i = 0; i < dashedLineNumbers.length; i++) {
            if (headerStart > dashedLineNumbers[i]) {
                // Count how many non-blank sections we've seen up to this point
                headerSectionIndex = nonBlankSections.filter(s => s < i).length + 1;
            } else {
                break;
            }
        }
    }

    // Determine section index for this line
    let section = 0;
    for (let i = 0; i < dashedLineNumbers.length; i++) {
        if (lineNumber > dashedLineNumbers[i]) {
            // Get the count of non-blank sections up to this point
            section = nonBlankSections.filter(s => s < i).length + 1;
        } else {
            break;
        }
    }

    const isPreHeader = headerStart > 0 && lineNumber < headerStart;
    return { 
        section: section, 
        isPreHeader: isPreHeader,
        headerSectionIndex: headerSectionIndex,
        nonBlankSections: nonBlankSections
    };
}

/**
 * Calculate the adjusted section number based on section info and presence of shapes section
 * @param {Object} sectionInfo The section information object
 * @param {boolean} hasShapeSection Whether the document has a shapes section
 * @returns {number} The adjusted section number
 */
function calculateAdjustedSection(sectionInfo, hasShapeSection) {
    if (sectionInfo.isPreHeader) {
        return -1; // Pre-header section
    }
    
    const relativeSection = sectionInfo.section - sectionInfo.headerSectionIndex;
    
    if (hasShapeSection) {
        return relativeSection;
    } else {
        // If no shapes section, adjust numbering
        if (relativeSection === 0) {
            return relativeSection; // Header
        } else {
            return relativeSection + sectionInfo.headerSectionIndex + 1;
        }
    }
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
        const sectionInfo = getSectionIndex(document, position.line);
        const hasShape = hasShapeSection(document);

        // Get context-specific keywords
        let contextKeywords = [];
        console.log(sectionInfo);
        
        const adjustedSection = calculateAdjustedSection(sectionInfo, hasShape);
        console.log('Adjusted section:', adjustedSection);
        switch (adjustedSection) {
            case -1: // pre-header (comments, title, etc)
                console.log('Pre-header section');
                contextKeywords = [];
                break;
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
                contextKeywords = ['lnN', 'gmN', 'lnU', 'shape', 'rateParam', 'discrete'];
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

class CombineDocumentSymbolProvider {
    provideDocumentSymbols(document, token) {
        const symbols = [];
        const dashLineRegex = /^-{3,}$/;
        const dashLineNumbers = [];
        const hasShape = hasShapeSection(document);
        
        // Find all section dividers
        for (let i = 0; i < document.lineCount; i++) {
            const lineText = document.lineAt(i).text.trim();
            if (dashLineRegex.test(lineText)) {
                dashLineNumbers.push(i);
            }
        }
        
        // Create symbols for each section
        if (dashLineNumbers.length > 0) {
            // Handle content before first divider as a section
            if (dashLineNumbers[0] > 0) {
                const preHeaderRange = new vscode.Range(0, 0, dashLineNumbers[0] - 1, document.lineAt(dashLineNumbers[0] - 1).text.length);
                let isHeader = false;
                
                // Check if this section contains the header block (imax/jmax/kmax)
                for (let i = 0; i <= Math.min(dashLineNumbers[0] - 3, document.lineCount - 3); i++) {
                    if (document.lineAt(i).text.trim().startsWith('imax') && 
                        document.lineAt(i+1).text.trim().startsWith('jmax') && 
                        document.lineAt(i+2).text.trim().startsWith('kmax')) {
                        isHeader = true;
                        break;
                    }
                }
                
                symbols.push(new vscode.DocumentSymbol(
                    isHeader ? "Header section" : "Pre-header section", 
                    "", 
                    vscode.SymbolKind.String, 
                    preHeaderRange, 
                    preHeaderRange
                ));
            }
            
            // Handle sections between dividers
            for (let i = 0; i < dashLineNumbers.length - 1; i++) {
                const startLine = dashLineNumbers[i] + 1;
                const endLine = dashLineNumbers[i + 1] - 1;
                
                if (endLine >= startLine) {
                    const sectionRange = new vscode.Range(startLine, 0, endLine, document.lineAt(endLine).text.length);
                    const sectionInfo = getSectionIndex(document, startLine);
                    const adjustedSection = calculateAdjustedSection(sectionInfo, hasShape);
                    
                    // Get section name using the same logic as CombineCompletionItemProvider
                    let sectionName = "Other section";
                    switch (adjustedSection) {
                        case -1:
                            sectionName = "Pre-header section";
                            break;
                        case 0:
                            sectionName = "Header section";
                            break;
                        case 1:
                            sectionName = "Shapes section";
                            break;
                        case 2:
                            sectionName = "Channel definition section";
                            break;
                        case 3:
                            sectionName = "Process definition section";
                            break;
                        case 4:
                            sectionName = "Systematics section";
                            break;
                    }
                    
                    symbols.push(new vscode.DocumentSymbol(
                        sectionName,
                        "",
                        vscode.SymbolKind.Struct,
                        sectionRange,
                        sectionRange
                    ));
                }
            }
            
            // Handle content after last divider
            if (dashLineNumbers[dashLineNumbers.length - 1] < document.lineCount - 1) {
                const startLine = dashLineNumbers[dashLineNumbers.length - 1] + 1;
                const endLine = document.lineCount - 1;
                const sectionRange = new vscode.Range(startLine, 0, endLine, document.lineAt(endLine).text.length);
                const sectionInfo = getSectionIndex(document, startLine);
                const adjustedSection = calculateAdjustedSection(sectionInfo, hasShape);
                
                // Get section name using the same logic as CombineCompletionItemProvider
                let sectionName = "Other section";
                switch (adjustedSection) {
                    case -1:
                        sectionName = "Pre-header section";
                        break;
                    case 0:
                        sectionName = "Header section";
                        break;
                    case 1:
                        sectionName = "Shapes section";
                        break;
                    case 2:
                        sectionName = "Channel definition section";
                        break;
                    case 3:
                        sectionName = "Process definition section";
                        break;
                    case 4:
                        sectionName = "Systematics section";
                        break;
                }
                
                symbols.push(new vscode.DocumentSymbol(
                    sectionName,
                    "",
                    vscode.SymbolKind.Struct,
                    sectionRange,
                    sectionRange
                ));
            }
        } else {
            // If no dividers, treat the whole document as one section
            const docRange = new vscode.Range(0, 0, document.lineCount - 1, document.lineAt(document.lineCount - 1).text.length);
            symbols.push(new vscode.DocumentSymbol(
                "Datacard", 
                "", 
                vscode.SymbolKind.File, 
                docRange, 
                docRange
            ));
        }
        
        return symbols;
    }
}

function deactivate() {}

/**
 * Function to align the columns in a datacard
 * @param {vscode.TextDocument} document The datacard document to align
 * @returns {Promise<boolean>} Whether alignment was successful
 */
async function alignDatacardColumns(document) {
    try {
        // Find the process and systematics sections
        processSectionID = 3
        systematicsSectionID = 4
        const hasShape = hasShapeSection(document)
        
        // Get the line numbers which correspond to the sections
        lines = document.getText().split('\n');
        let processSectionStart = -1;
        let processSectionEnd = -1;
        let systematicsSectionStart = -1;
        let systematicsSectionEnd = -1;
        let id = -1;
        for (let i = 0; i < lines.length; i++) {
            id = calculateAdjustedSection(getSectionIndex(document, i), hasShape);
            // Skip line if it is blank or a section separator
            if (lines[i].trim().length === 0 || lines[i].trim().startsWith('---')) {
                continue;
            }

            // Process section identification
            if (id === processSectionID) {
                if (processSectionStart === -1) {
                    processSectionStart = i;
                }
                processSectionEnd = i;
            }

            // Systematics section identification
            if (id === systematicsSectionID) {
                if (systematicsSectionStart === -1) {
                    systematicsSectionStart = i;
                }
                systematicsSectionEnd = i;
            }
        }
        console.log('Process section:', processSectionStart, processSectionEnd);
        console.log('Systematics section:', systematicsSectionStart, systematicsSectionEnd);
        
        // Get the columns, their current start points and the maximum length
        let binProcessColumns = [];
        let i = processSectionStart;
        assert(systematicsSectionEnd > processSectionEnd, 'Systematics section should be after process section');
        while (i <= systematicsSectionEnd) {
            if (i > lines.length) {
                console.error('Reached end of lines while processing sections');
                break;
            }
            if (i > processSectionEnd && i < systematicsSectionStart) {
                i++;
                continue; // Skip blank lines or lines outside the sections
            }
            const line = lines[i].trim();
            if (line.length > 0) {
                // Get the index of the first non-whitespace character in each column
                const columns = [];
                const columnRegex = /(\S+)/g;
                let match;
                while ((match = columnRegex.exec(line)) !== null) {
                    const columnStart = match.index;
                    const columnEnd = columnStart + match[0].length;
                    columns.push([columnStart, columnEnd]);
                }
                if (i >= systematicsSectionStart && i <= systematicsSectionEnd) {
                    // Merge the first two columns
                    const firstColumn = columns[0];
                    const secondColumn = columns[1];
                    const mergedColumn = [firstColumn[0], secondColumn[1]];
                    columns.splice(0, 2, mergedColumn);
                }
                binProcessColumns.push(columns);
            }
            i++;
        }
        // Find the maximum length of each column
        const maxColumnLengths = [];
        for (const columns of binProcessColumns) {
            for (let j = 0; j < columns.length; j++) {
                const columnLength = columns[j][1] - columns[j][0];
                if (!maxColumnLengths[j] || columnLength > maxColumnLengths[j]) {
                    maxColumnLengths[j] = columnLength + 3; // Add padding
                }
            }
        }

        // Calculate the new start points for each column
        const newColumnStarts = [];
        for (let j = 0; j < maxColumnLengths.length; j++) {
            const columnStart = j === 0 ? 0 : newColumnStarts[j - 1] + maxColumnLengths[j - 1];
            newColumnStarts.push(columnStart);
        }

        // Per row, calculate the required padding
        const newLines = [];
        i = processSectionStart;
        let linesSeen = 0;
        while (i <= systematicsSectionEnd) {
            if (i > lines.length) {
                console.error('Reached end of lines while processing sections');
                break;
            }
            const line = lines[i].trim();
            if ((i >= processSectionStart && i <= processSectionEnd) || 
                (i >= systematicsSectionStart && i <= systematicsSectionEnd)) {
                if (line.length > 0) {
                    console.log('Processing line:', line);
                    const columns = binProcessColumns[linesSeen];
                    let newLine = '';
                    
                    for (let j = 0; j < columns.length; j++) {
                        const columnStart = columns[j][0];
                        const columnEnd = columns[j][1];
                        const columnText = line.substring(columnStart, columnEnd);
                        
                        // Calculate padding needed before this column
                        const paddingNeeded = Math.max(0, newColumnStarts[j] - newLine.length);
                        newLine += ' '.repeat(paddingNeeded) + columnText;
                    }
                    
                    newLines.push(newLine);
                    linesSeen++;
                } else {
                    newLines.push(line);
                }
            } else {
                newLines.push(lines[i]); // Keep original line for lines outside our sections
            }
            i++;
            // TODO: Fix the last line of the section
            // TODO: Spacing on `lnN` terms etc
            // TODO: Also align bin definition section

        }
        
        // Write the new lines back to the document
        const edit = new vscode.WorkspaceEdit();
        const range = new vscode.Range(
            new vscode.Position(processSectionStart, 0),
            new vscode.Position(systematicsSectionEnd + 1, 0)
        );
        edit.replace(document.uri, range, newLines.join('\n'));
        await vscode.workspace.applyEdit(edit);
        console.log('Applied edit to document');
        return true;

    } catch (error) {
        console.error('Error aligning datacard columns:', error);
        vscode.window.showErrorMessage('Error aligning datacard columns: ' + error.message);
        return false;
    }
}

module.exports = {
    activate,
    deactivate,
    _testing: {
        detectDatacard,
        getSectionIndex,
        hasShapeSection,
        calculateAdjustedSection,
        keywordDefinitions,
        alignDatacardColumns
    }
};
