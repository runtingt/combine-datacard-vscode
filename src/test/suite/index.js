const path = require('path');
const Mocha = require('mocha');
const { glob } = require('glob');

async function run() {
    // Create the Mocha test instance
    const mocha = new Mocha({
        ui: 'tdd',
        color: true,
    });

    const testsRoot = path.resolve(__dirname, '..');

    const files = await glob('**/**.test.js', { cwd: testsRoot });

    // Add files to the test suite
    files.forEach((file) => mocha.addFile(path.resolve(testsRoot, file)));

    return new Promise((resolve, reject) => {
        try {
            // Run the tests
            mocha.run((failures) => {
                if (failures > 0) {
                    reject(new Error(`${failures} tests failed.`));
                } else {
                    resolve();
                }
            });
        } catch (err) {
            reject(err);
        }
    });
}

module.exports = { run };