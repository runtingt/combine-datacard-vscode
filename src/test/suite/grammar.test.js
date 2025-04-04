const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Function to test if a string matches a pattern
function testPatternMatch(pattern, text) {
    const regex = new RegExp(pattern);
    return regex.test(text);
}

// Load the grammar file
function loadGrammar() {
    const grammarPath = path.join(__dirname, '..', '..', '..', 'syntaxes', 'combine-datacard.tmLanguage.json');
    try {
        return JSON.parse(fs.readFileSync(grammarPath, 'utf8'));
    } catch (error) {
        console.error('Error loading grammar file:', error);
        return null;
    }
}

suite('Grammar File Tests', () => {
    let grammar;

    setup(() => {
        grammar = loadGrammar();
        assert.notStrictEqual(grammar, null, 'Grammar file should load successfully');
    });

    test('Grammar has correct scope name', () => {
        assert.strictEqual(grammar.scopeName, 'source.combine-datacard');
    });

    test('Grammar defines expected patterns', () => {
        const patternNames = grammar.patterns.map(p => p.name);
        const expectedPatterns = [
            'markup.heading.separator.combine-datacard',
            'comment.block.preheader.combine-datacard',
            'keyword.combine-datacard',
            'comment.combine-datacard',
            'constant.numeric.combine-datacard',
            'variable.parameter.combine-datacard',
            'entity.name.tag.combine-datacard',
            'constant.other.placeholder.combine-datacard',
            'string.unquoted.filename.combine-datacard'
        ];
        
        expectedPatterns.forEach(pattern => {
            assert.ok(
                patternNames.includes(pattern), 
                `Grammar should include pattern: ${pattern}`
            );
        });
    });

    test('Separator pattern matches dashed lines', () => {
        const pattern = grammar.patterns.find(p => 
            p.name === 'markup.heading.separator.combine-datacard'
        ).match;
        
        assert.ok(testPatternMatch(pattern, '---'));
        assert.ok(testPatternMatch(pattern, '--------------------'));
        assert.ok(testPatternMatch(pattern, '   -----   '));
        assert.ok(!testPatternMatch(pattern, '--'));
        assert.ok(!testPatternMatch(pattern, '--- text'));
    });

    test('Keyword pattern matches datacard keywords', () => {
        const pattern = grammar.patterns.find(p => 
            p.name === 'keyword.combine-datacard'
        );
        
        // Extract keywords from the pattern
        const keywordMatch = pattern.match.match(/\((.*?)\)/);
        const extractedKeywords = keywordMatch[1].split('|');
        
        // Test each keyword defined in the grammar file
        extractedKeywords.forEach(keyword => {
            assert.ok(
                testPatternMatch(pattern.match, keyword), 
                `Pattern should match keyword: ${keyword}`
            );
            assert.ok(
                testPatternMatch(pattern.match, `text ${keyword} text`), 
                `Pattern should match keyword in context: ${keyword}`
            );
        });
        
        // Test for non-keywords
        assert.ok(!testPatternMatch(pattern.match, 'notakeyword'));
        assert.ok(!testPatternMatch(pattern.match, 'imaximum')); // Should not match as substring
    });

    test('Comment pattern matches # comments', () => {
        const pattern = grammar.patterns.find(p => 
            p.name === 'comment.combine-datacard'
        ).match;
        
        assert.ok(testPatternMatch(pattern, '# This is a comment'));
        assert.ok(testPatternMatch(pattern, '#Comment without space'));
        assert.ok(testPatternMatch(pattern, 'End of line # comment'));
    });

    test('Numeric pattern matches numbers and placeholders', () => {
        const pattern = grammar.patterns.find(p => 
            p.name === 'constant.numeric.combine-datacard'
        ).match;
        
        assert.ok(testPatternMatch(pattern, '123'));
        assert.ok(testPatternMatch(pattern, '-123'));
        assert.ok(testPatternMatch(pattern, '1.234'));
        assert.ok(testPatternMatch(pattern, '1e-3'));
        assert.ok(testPatternMatch(pattern, ' - ')); // Standalone dash as placeholder
        assert.ok(testPatternMatch(pattern, ' * ')); // Standalone asterisk as placeholder
    });

    test('Variable parameter pattern matches first column identifiers', () => {
        const pattern = grammar.patterns.find(p => 
            p.name === 'variable.parameter.combine-datacard'
        ).match;
        
        assert.ok(testPatternMatch(pattern, 'lumi '));
        assert.ok(testPatternMatch(pattern, 'signal_norm '));
        assert.ok(testPatternMatch(pattern, '  param1 '));
        assert.ok(!testPatternMatch(pattern, '1param ')); // Cannot start with number
    });

    test('Entity name tag pattern matches process names', () => {
        const pattern = grammar.patterns.find(p => 
            p.name === 'entity.name.tag.combine-datacard'
        ).match;
        
        assert.ok(testPatternMatch(pattern, ' signal '));
        assert.ok(testPatternMatch(pattern, ' bkg '));
        assert.ok(testPatternMatch(pattern, ' process1 '));
    });

    test('Placeholder pattern matches $PROCESS and similar', () => {
        const pattern = grammar.patterns.find(p => 
            p.name === 'constant.other.placeholder.combine-datacard'
        ).match;
        
        assert.ok(testPatternMatch(pattern, '$PROCESS'));
        assert.ok(testPatternMatch(pattern, '$PROCESS_$SYSTEMATIC'));
        assert.ok(testPatternMatch(pattern, '$CHANNEL'));
        assert.ok(!testPatternMatch(pattern, '$process')); // Must be uppercase
    });

    test('Filename pattern matches .root files', () => {
        const pattern = grammar.patterns.find(p => 
            p.name === 'string.unquoted.filename.combine-datacard'
        ).match;
        
        assert.ok(testPatternMatch(pattern, 'file.root'));
        assert.ok(testPatternMatch(pattern, 'path/to/file.root'));
        assert.ok(testPatternMatch(pattern, '$DIR/file.root'));
        assert.ok(!testPatternMatch(pattern, 'file.txt'));
    });
});
