const path = require('path');
const fs = require('fs');
const { downloadAndUnzipVSCode, runTests } = require('@vscode/test-electron');

function resolveMacOSExecutablePath(vscodeExecutablePath) {
    if (process.platform !== 'darwin' || fs.existsSync(vscodeExecutablePath)) {
        return vscodeExecutablePath;
    }

    const macOSDir = path.dirname(vscodeExecutablePath);
    if (!fs.existsSync(macOSDir)) {
        return vscodeExecutablePath;
    }

    const preferredBinaryNames = ['Visual Studio Code', 'Code', 'Electron'];
    for (const binaryName of preferredBinaryNames) {
        const candidatePath = path.join(macOSDir, binaryName);
        if (fs.existsSync(candidatePath)) {
            return candidatePath;
        }
    }

    const executableCandidates = fs
        .readdirSync(macOSDir)
        .filter((entry) => {
            const fullPath = path.join(macOSDir, entry);
            try {
                const stats = fs.statSync(fullPath);
                return stats.isFile() && (stats.mode & 0o111) !== 0;
            } catch {
                return false;
            }
        })
        .sort();

    if (executableCandidates.length > 0) {
        return path.join(macOSDir, executableCandidates[0]);
    }

    return vscodeExecutablePath;
}

async function main() {
    try {
        // The folder containing the Extension Manifest package.json
        const extensionDevelopmentPath = path.resolve(__dirname, '../../');

        // The path to the test runner script
        const extensionTestsPath = path.resolve(__dirname, './suite/index.js');

        const downloadedVSCodeExecutablePath = await downloadAndUnzipVSCode();
        const vscodeExecutablePath = resolveMacOSExecutablePath(downloadedVSCodeExecutablePath);

        // Run the tests
        await runTests({ extensionDevelopmentPath, extensionTestsPath, vscodeExecutablePath });
    } catch (err) {
        console.error('Failed to run tests');
        process.exit(1);
    }
}

main();