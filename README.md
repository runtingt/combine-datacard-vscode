# Syntax highlighting for datacards for the [CMS Combine](https://cms-analysis.github.io/HiggsAnalysis-CombinedLimit/latest/) tool

## Features :sparkles:

- Syntax highlighting for keywords and numbers

    ![1742490518036](images/datacard_highlight.png)

- Fold blocks within datacards

    ![1742490518036](images/datacard_fold.gif)

## Coming soon :soon:

- Tell the difference between a general `.txt` file and a datacard
- Auto-commenting
- Auto section closing
- IntelliSense for datacard keywords
- Auto-aligning table columns
- Breadcrumbs for datacard sections
- Sticky scrolling for table headings

## Installation :computer:

To install this extension from the marketplace, launch `VSCode`, press `Ctrl+P` and paste the following:

```bash
ext install cms-combine-datacard
```

To build and install this extension locally:

```bash
npm install --save-dev @vscode/vsce
npx vsce package
code --install-extension cms-combine-datacard-<version>.vsix 
```
