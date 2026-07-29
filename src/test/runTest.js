const path = require('path');
const fs = require('fs');
const { downloadAndUnzipVSCode, runTests } = require('@vscode/test-electron');

async function main() {
    try {
        // The folder containing the Extension Manifest package.json
        const extensionDevelopmentPath = path.resolve(__dirname, '../../');

        // The path to the test runner script
        const extensionTestsPath = path.resolve(__dirname, './suite/index.js');

        let vscodeExecutablePath = await downloadAndUnzipVSCode();
        if (process.platform === 'darwin' && !fs.existsSync(vscodeExecutablePath) && vscodeExecutablePath.endsWith('/Electron')) {
            const stableBinaryPath = vscodeExecutablePath.replace(/\/Electron$/, '/Visual Studio Code');
            if (fs.existsSync(stableBinaryPath)) {
                vscodeExecutablePath = stableBinaryPath;
            }
        }

        // Run the tests
        await runTests({ extensionDevelopmentPath, extensionTestsPath, vscodeExecutablePath });
    } catch (err) {
        console.error('Failed to run tests');
        process.exit(1);
    }
}

main();