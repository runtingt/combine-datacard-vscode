const assert = require('assert');
const fs = require('fs');
const path = require('path');
const extension = require('../../extension');

// Mock document for testing
class MockDocument {
    constructor(lines, fileName = 'test.txt', languageId = 'plaintext') {
        this.lines = lines;
        this.lineCount = lines.length;
        this.fileName = fileName;
        this.languageId = languageId;
    }

    lineAt(index) {
        return { text: this.lines[index] };
    }

    getText() {
        return this.lines.join('\n');
    }
}

// Helper function to read test files
function readTestFile(filename) {
    const testFilesPath = path.join(__dirname, '..', 'datacards');
    const filePath = path.join(testFilesPath, filename);
    if (!fs.existsSync(filePath)) {
        throw new Error(`Test file ${filename} not found`);
    }
    return fs.readFileSync(filePath, 'utf8').split('\n');
}

// Mock for vscode.languages
const mockVscode = {
    languages: {
        setTextDocumentLanguage: (doc, lang) => {
            mockVscode.lastLanguageSet = { document: doc, language: lang };
            return Promise.resolve();
        },
        lastLanguageSet: null
    }
};

// Save original methods for restoration
const originalVscode = {
    languages: {
        setTextDocumentLanguage: require('vscode').languages.setTextDocumentLanguage
    }
};

suite('Combine Datacard Extension Tests', () => {
    setup(() => {
        // Setup mock
        require('vscode').languages.setTextDocumentLanguage = mockVscode.languages.setTextDocumentLanguage;
        mockVscode.lastLanguageSet = null;
    });

    teardown(() => {
        // Restore original methods
        require('vscode').languages.setTextDocumentLanguage = originalVscode.languages.setTextDocumentLanguage;
    });

    test('detectDatacard should identify valid datacards from file', () => {
        // Read the standard test datacard file
        const lines = readTestFile('shapes_with_header.txt');
        const mockDoc = new MockDocument(lines, 'standard.txt');
        
        extension._testing.detectDatacard(mockDoc);
        
        assert.strictEqual(
            mockVscode.lastLanguageSet?.language, 
            'combine-datacard', 
            'Language should be set to combine-datacard for standard datacard file'
        );
    });
    
    test('detectDatacard should not identify invalid files', () => {
        // Read the invalid test file
        const lines = readTestFile('invalid.txt');
        const mockDoc = new MockDocument(lines, 'invalid.txt');
        
        extension._testing.detectDatacard(mockDoc);
        
        assert.strictEqual(
            mockVscode.lastLanguageSet, 
            null, 
            'Language should not be set for invalid files'
        );
    });
    
    test('getSectionIndex should correctly identify sections', () => {
        // Read the standard test datacard file
        const lines = readTestFile('shapes_with_header.txt');
        const mockDoc = new MockDocument(lines);
        
        // Find line numbers for different sections by searching the content
        let headerSection = 0;
        let imaxLine = lines.findIndex(line => line.trim().startsWith('imax'));
        let shapesLine = lines.findIndex(line => line.trim().startsWith('shapes'));
        let observationLine = lines.findIndex(line => line.trim().startsWith('observation'));
        let processLine = lines.findIndex(line => line.trim().startsWith('process'));
        let lumiLine = lines.findIndex(line => line.trim().startsWith('lumi'));
        
        // Test pre-header section (first line of file)
        let result = extension._testing.getSectionIndex(mockDoc, 0);
        let adjustedSection = extension._testing.calculateAdjustedSection(result, extension._testing.hasShapeSection(mockDoc));
        assert.strictEqual(adjustedSection, -1, 'Pre-header section should have adjusted section -1');
        
        // Test header section (imax line)
        result = extension._testing.getSectionIndex(mockDoc, imaxLine);
        adjustedSection = extension._testing.calculateAdjustedSection(result, extension._testing.hasShapeSection(mockDoc));
        assert.strictEqual(adjustedSection, 0, 'Header section should have adjusted section 0');
        
        // Test shapes section
        result = extension._testing.getSectionIndex(mockDoc, shapesLine);
        adjustedSection = extension._testing.calculateAdjustedSection(result, extension._testing.hasShapeSection(mockDoc));
        assert.strictEqual(adjustedSection, 1, 'Shapes section should have adjusted section 1');
        
        // Test observation section
        result = extension._testing.getSectionIndex(mockDoc, observationLine);
        adjustedSection = extension._testing.calculateAdjustedSection(result, extension._testing.hasShapeSection(mockDoc));
        assert.strictEqual(adjustedSection, 2, 'Observation section should have adjusted section 2');
        
        // Test process section
        result = extension._testing.getSectionIndex(mockDoc, processLine);
        adjustedSection = extension._testing.calculateAdjustedSection(result, extension._testing.hasShapeSection(mockDoc));
        assert.strictEqual(adjustedSection, 3, 'Process section should have adjusted section 3');
        
        // Test systematics section
        result = extension._testing.getSectionIndex(mockDoc, lumiLine);
        adjustedSection = extension._testing.calculateAdjustedSection(result, extension._testing.hasShapeSection(mockDoc));
        assert.strictEqual(adjustedSection, 4, 'Systematics section should have adjusted section 4');
    });

    test('getSectionIndex should adjust for datacards without shapes section', () => {
        // Read a datacard without shapes section
        const lines = readTestFile('no_shapes.txt');
        const mockDoc = new MockDocument(lines);
        
        // Find line numbers for different sections
        let imaxLine = lines.findIndex(line => line.trim().startsWith('imax'));
        let observationLine = lines.findIndex(line => line.trim().startsWith('observation'));
        let processLine = lines.findIndex(line => line.trim().startsWith('process'));
        let systLine = lines.findIndex(line => line.trim().startsWith('CMS_eff_b'));

        // Verify there's no shapes section
        assert.strictEqual(
            extension._testing.hasShapeSection(mockDoc), 
            false, 
            'Test file should not have shapes section'
        );
        
        // Test header section (imax line)
        let result = extension._testing.getSectionIndex(mockDoc, imaxLine);
        let adjustedSection = extension._testing.calculateAdjustedSection(result, extension._testing.hasShapeSection(mockDoc));
        assert.strictEqual(adjustedSection, 0, 'Header section should have adjusted section 0');
        
        // Test observation section (skipping section 1 which would be shapes)
        result = extension._testing.getSectionIndex(mockDoc, observationLine);
        adjustedSection = extension._testing.calculateAdjustedSection(result, extension._testing.hasShapeSection(mockDoc));
        assert.strictEqual(adjustedSection, 2, 'Observation section should have adjusted section 2 (skipping shapes)');
        
        // Test process section 
        result = extension._testing.getSectionIndex(mockDoc, processLine);
        adjustedSection = extension._testing.calculateAdjustedSection(result, extension._testing.hasShapeSection(mockDoc));
        assert.strictEqual(adjustedSection, 3, 'Process section should have adjusted section 3');
        
        // Test systematics section
        result = extension._testing.getSectionIndex(mockDoc, systLine);
        adjustedSection = extension._testing.calculateAdjustedSection(result, extension._testing.hasShapeSection(mockDoc));
        assert.strictEqual(adjustedSection, 4, 'Systematics section should have adjusted section 4');
    });
});