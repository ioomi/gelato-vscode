import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import process from "node:process";
import YAML from "yaml";
import themeDefinitions from "../theme-definitions/index.mjs";
import typography from "../theme-definitions/typography.cjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const palettePath = path.join(root, "palette.yaml");
const themesDirectory = path.join(root, "themes");
const checkOnly = process.argv.includes("--check");

const paletteFields = {
  base00: ["neutral", "bg0"],
  base01: ["neutral", "bg1"],
  base02: ["neutral", "bg2"],
  base03: ["neutral", "gray0"],
  base04: ["neutral", "gray2"],
  base05: ["neutral", "fg0"],
  base06: ["neutral", "fg1"],
  base07: ["neutral", "fg2"],
  base08: ["colors", "red"],
  base09: ["colors", "orange"],
  base0A: ["colors", "yellow"],
  base0B: ["colors", "green"],
  base0C: ["colors", "cyan"],
  base0D: ["colors", "blue"],
  base0E: ["colors", "purple"],
  base0F: ["colors", "brown"],
  base10: ["neutral", "gray1"],
  base11: ["bright", "red"],
  base12: ["bright", "orange"],
  base13: ["bright", "yellow"],
  base14: ["bright", "green"],
  base15: ["bright", "cyan"],
  base16: ["bright", "blue"],
  base17: ["bright", "purple"],
  cursor: ["special", "cursor"],
};

function readPalette(source) {
  const parsed = YAML.parse(source);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("palette.yaml must contain a YAML mapping");
  }

  for (const field of ["name", "variant"]) {
    if (typeof parsed[field] !== "string" || parsed[field].trim() === "") {
      throw new Error(`palette.yaml: ${field} must be a non-empty string`);
    }
  }

  const colors = {};
  const namedColors = {};
  for (const [key, [group, field]] of Object.entries(paletteFields)) {
    const value = parsed[group]?.[field];
    if (typeof value !== "string" || !/^#[0-9A-Fa-f]{6}$/.test(value)) {
      throw new Error(`palette.yaml: ${group}.${field} must be a # followed by 6 hexadecimal digits`);
    }
    colors[key] = value.toUpperCase();
    namedColors[`${group}.${field}`] = colors[key];
  }

  return { scheme: parsed.name.trim(), variant: parsed.variant.trim(), colors, namedColors };
}

function resolveColor(namedColors, reference) {
  const color = namedColors[reference];
  if (!color) {
    throw new Error(`theme definition references unknown palette color: ${reference}`);
  }
  return color;
}

function createSyntax(definition, namedColors) {
  const tokenColors = definition.tokenColors.map(({ name, scope, foreground, fontStyle }) => ({
    name,
    scope,
    settings: {
      ...(fontStyle ? { fontStyle } : {}),
      ...(foreground ? { foreground: resolveColor(namedColors, foreground) } : {}),
    },
  }));
  const semanticTokenColors = Object.fromEntries(
    Object.entries(definition.semanticTokenColors).map(([selector, style]) => {
      if (typeof style === "string") {
        return [selector, resolveColor(namedColors, style)];
      }
      return [
        selector,
        {
          ...style,
          ...(style.foreground ? { foreground: resolveColor(namedColors, style.foreground) } : {}),
        },
      ];
    }),
  );

  for (const [fontStyle, style] of Object.entries(typography)) {
    if (!style.default) {
      continue;
    }
    tokenColors.push({
      name: `Gelato global ${fontStyle}`,
      scope: style.textMateScopes,
      settings: { fontStyle },
    });
    for (const selector of style.semanticSelectors) {
      const current = semanticTokenColors[selector];
      semanticTokenColors[selector] = {
        ...(typeof current === "string" ? { foreground: current } : current),
        [fontStyle]: true,
      };
    }
  }

  return { tokenColors, semanticTokenColors };
}

function createTheme({ scheme, variant, colors: p, namedColors }, definition) {
  const alpha = (key, opacity) => `${p[key]}${opacity}`;
  const syntax = createSyntax(definition, namedColors);

  return {
    $schema: "vscode://schemas/color-theme",
    name: `${scheme} ${definition.flavor}`,
    type: variant.toLowerCase(),
    semanticHighlighting: true,
    colors: {
      foreground: p.base05,
      focusBorder: p.base0D,
      "descriptionForeground": p.base04,
      "disabledForeground": p.base03,
      "errorForeground": p.base08,
      "icon.foreground": p.base04,
      "selection.background": alpha("base0D", "40"),
      "widget.shadow": alpha("base00", "A0"),
      "widget.border": p.base02,
      "textBlockQuote.background": p.base01,
      "textBlockQuote.border": p.base0D,
      "textCodeBlock.background": p.base01,
      "textLink.activeForeground": p.base16,
      "textLink.foreground": p.base0D,
      "textPreformat.foreground": p.base0C,
      "textSeparator.foreground": p.base03,
      "button.background": p.base0D,
      "button.foreground": p.base00,
      "button.hoverBackground": p.base16,
      "button.secondaryBackground": p.base02,
      "button.secondaryForeground": p.base05,
      "button.secondaryHoverBackground": p.base03,
      "checkbox.background": p.base01,
      "checkbox.border": p.base03,
      "checkbox.foreground": p.base05,
      "dropdown.background": p.base01,
      "dropdown.border": p.base03,
      "dropdown.foreground": p.base05,
      "input.background": p.base01,
      "input.border": p.base03,
      "input.foreground": p.base05,
      "input.placeholderForeground": p.base03,
      "inputOption.activeBackground": alpha("base0D", "30"),
      "inputOption.activeBorder": p.base0D,
      "inputOption.activeForeground": p.base06,
      "inputValidation.errorBackground": p.base01,
      "inputValidation.errorBorder": p.base08,
      "inputValidation.infoBackground": p.base01,
      "inputValidation.infoBorder": p.base0D,
      "inputValidation.warningBackground": p.base01,
      "inputValidation.warningBorder": p.base0A,
      "scrollbar.shadow": alpha("base00", "80"),
      "scrollbarSlider.activeBackground": alpha("base04", "80"),
      "scrollbarSlider.background": alpha("base03", "50"),
      "scrollbarSlider.hoverBackground": alpha("base04", "60"),
      "badge.background": p.base0E,
      "badge.foreground": p.base00,
      "progressBar.background": p.base0D,
      "list.activeSelectionBackground": p.base02,
      "list.activeSelectionForeground": p.base06,
      "list.dropBackground": alpha("base0D", "30"),
      "list.errorForeground": p.base08,
      "list.focusBackground": alpha("base0D", "28"),
      "list.focusForeground": p.base06,
      "list.highlightForeground": p.base0D,
      "list.hoverBackground": p.base01,
      "list.hoverForeground": p.base06,
      "list.inactiveSelectionBackground": p.base01,
      "list.inactiveSelectionForeground": p.base05,
      "list.invalidItemForeground": p.base08,
      "list.warningForeground": p.base0A,
      "activityBar.background": p.base01,
      "activityBar.foreground": p.base06,
      "activityBar.inactiveForeground": p.base03,
      "activityBar.border": p.base02,
      "activityBar.activeBorder": p.base0D,
      "activityBar.activeBackground": p.base01,
      "activityBarBadge.background": p.base0E,
      "activityBarBadge.foreground": p.base00,
      "sideBar.background": p.base01,
      "sideBar.foreground": p.base04,
      "sideBar.border": p.base02,
      "sideBarTitle.foreground": p.base06,
      "sideBarSectionHeader.background": p.base01,
      "sideBarSectionHeader.foreground": p.base05,
      "sideBarSectionHeader.border": p.base02,
      "editorGroup.border": p.base02,
      "editorGroupHeader.tabsBackground": p.base01,
      "editorGroupHeader.tabsBorder": p.base02,
      "tab.activeBackground": p.base00,
      "tab.activeForeground": p.base06,
      "tab.activeBorderTop": p.base0D,
      "tab.border": p.base02,
      "tab.hoverBackground": p.base02,
      "tab.inactiveBackground": p.base01,
      "tab.inactiveForeground": p.base04,
      "tab.unfocusedActiveForeground": p.base05,
      "tab.unfocusedInactiveForeground": p.base03,
      "editor.background": p.base00,
      "editor.foreground": p.base05,
      "editorLineNumber.foreground": p.base03,
      "editorLineNumber.activeForeground": p.base04,
      "editorCursor.foreground": p.cursor,
      "editor.selectionBackground": alpha("base0D", "40"),
      "editor.inactiveSelectionBackground": alpha("base0D", "24"),
      "editor.selectionHighlightBackground": alpha("base0C", "22"),
      "editor.wordHighlightBackground": alpha("base0A", "20"),
      "editor.wordHighlightStrongBackground": alpha("base09", "28"),
      "editor.findMatchBackground": alpha("base0A", "55"),
      "editor.findMatchBorder": p.base13,
      "editor.findMatchHighlightBackground": alpha("base0A", "28"),
      "editor.hoverHighlightBackground": alpha("base0D", "20"),
      "editor.lineHighlightBackground": p.base01,
      "editor.lineHighlightBorder": alpha("base02", "80"),
      "editor.rangeHighlightBackground": alpha("base0D", "18"),
      "editorWhitespace.foreground": p.base02,
      "editorIndentGuide.background1": p.base02,
      "editorIndentGuide.activeBackground1": p.base03,
      "editorRuler.foreground": p.base02,
      "editorCodeLens.foreground": p.base03,
      "editorLink.activeForeground": p.base16,
      "editorBracketMatch.background": alpha("base0E", "38"),
      "editorBracketMatch.border": alpha("base0A", "70"),
      "editorBracketHighlight.foreground1": p.base0D,
      "editorBracketHighlight.foreground2": p.base0E,
      "editorBracketHighlight.foreground3": p.base0C,
      "editorBracketHighlight.foreground4": p.base0A,
      "editorBracketHighlight.foreground5": p.base09,
      "editorBracketHighlight.foreground6": p.base0B,
      "editorBracketHighlight.unexpectedBracket.foreground": p.base08,
      "editorError.foreground": p.base08,
      "editorWarning.foreground": p.base0A,
      "editorInfo.foreground": p.base0D,
      "editorHint.foreground": p.base0C,
      "editorGutter.addedBackground": p.base0B,
      "editorGutter.modifiedBackground": p.base09,
      "editorGutter.deletedBackground": p.base08,
      "editorOverviewRuler.addedForeground": p.base0B,
      "editorOverviewRuler.modifiedForeground": p.base09,
      "editorOverviewRuler.deletedForeground": p.base08,
      "editorOverviewRuler.errorForeground": p.base08,
      "editorOverviewRuler.warningForeground": p.base0A,
      "editorOverviewRuler.infoForeground": p.base0D,
      "diffEditor.insertedTextBackground": alpha("base14", "32"),
      "diffEditor.removedTextBackground": alpha("base11", "32"),
      "diffEditor.insertedLineBackground": alpha("base14", "16"),
      "diffEditor.removedLineBackground": alpha("base11", "16"),
      "diffEditor.diagonalFill": alpha("base04", "18"),
      "editorWidget.background": p.base01,
      "editorWidget.border": p.base02,
      "editorWidget.foreground": p.base05,
      "editorHoverWidget.background": p.base01,
      "editorHoverWidget.border": p.base03,
      "editorSuggestWidget.background": p.base01,
      "editorSuggestWidget.border": p.base03,
      "editorSuggestWidget.foreground": p.base05,
      "editorSuggestWidget.highlightForeground": p.base0D,
      "editorSuggestWidget.selectedBackground": p.base02,
      "peekView.border": p.base0D,
      "peekViewEditor.background": p.base00,
      "peekViewEditor.matchHighlightBackground": alpha("base0A", "40"),
      "peekViewResult.background": p.base01,
      "peekViewResult.fileForeground": p.base06,
      "peekViewResult.lineForeground": p.base04,
      "peekViewResult.matchHighlightBackground": alpha("base0A", "35"),
      "peekViewResult.selectionBackground": p.base02,
      "peekViewTitle.background": p.base01,
      "peekViewTitleDescription.foreground": p.base04,
      "peekViewTitleLabel.foreground": p.base06,
      "panel.background": p.base00,
      "panel.border": p.base02,
      "panelTitle.activeBorder": p.base0D,
      "panelTitle.activeForeground": p.base06,
      "panelTitle.inactiveForeground": p.base04,
      "statusBar.background": p.base01,
      "statusBar.foreground": p.base05,
      "statusBar.border": p.base02,
      "statusBar.debuggingBackground": p.base09,
      "statusBar.debuggingForeground": p.base00,
      "statusBar.noFolderBackground": p.base02,
      "statusBar.noFolderForeground": p.base05,
      "statusBarItem.activeBackground": alpha("base07", "18"),
      "statusBarItem.hoverBackground": alpha("base07", "10"),
      "statusBarItem.errorBackground": p.base08,
      "statusBarItem.errorForeground": p.base00,
      "statusBarItem.warningBackground": p.base0A,
      "statusBarItem.warningForeground": p.base00,
      "titleBar.activeBackground": p.base01,
      "titleBar.activeForeground": p.base06,
      "titleBar.inactiveBackground": p.base01,
      "titleBar.inactiveForeground": p.base03,
      "titleBar.border": p.base02,
      "menu.background": p.base01,
      "menu.foreground": p.base05,
      "menu.selectionBackground": p.base02,
      "menu.selectionForeground": p.base06,
      "menu.separatorBackground": p.base02,
      "menubar.selectionBackground": p.base02,
      "menubar.selectionForeground": p.base06,
      "notificationCenter.border": p.base02,
      "notificationCenterHeader.background": p.base01,
      "notificationCenterHeader.foreground": p.base06,
      "notifications.background": p.base01,
      "notifications.border": p.base02,
      "notifications.foreground": p.base05,
      "notificationLink.foreground": p.base0D,
      "notificationsErrorIcon.foreground": p.base08,
      "notificationsWarningIcon.foreground": p.base0A,
      "notificationsInfoIcon.foreground": p.base0D,
      "quickInput.background": p.base01,
      "quickInput.foreground": p.base05,
      "quickInputList.focusBackground": p.base02,
      "quickInputList.focusForeground": p.base06,
      "pickerGroup.border": p.base02,
      "pickerGroup.foreground": p.base0D,
      "gitDecoration.addedResourceForeground": p.base0B,
      "gitDecoration.modifiedResourceForeground": p.base09,
      "gitDecoration.deletedResourceForeground": p.base08,
      "gitDecoration.renamedResourceForeground": p.base0C,
      "gitDecoration.untrackedResourceForeground": p.base14,
      "gitDecoration.ignoredResourceForeground": p.base03,
      "gitDecoration.conflictingResourceForeground": p.base0A,
      "gitDecoration.submoduleResourceForeground": p.base0D,
      "terminal.background": p.base00,
      "terminal.foreground": p.base05,
      "terminal.selectionBackground": alpha("base0D", "40"),
      "terminalCursor.background": p.base00,
      "terminalCursor.foreground": p.cursor,
      "terminal.ansiBlack": p.base00,
      "terminal.ansiRed": p.base08,
      "terminal.ansiGreen": p.base0B,
      "terminal.ansiYellow": p.base0A,
      "terminal.ansiBlue": p.base0D,
      "terminal.ansiMagenta": p.base0E,
      "terminal.ansiCyan": p.base0C,
      "terminal.ansiWhite": p.base05,
      "terminal.ansiBrightBlack": p.base10,
      "terminal.ansiBrightRed": p.base11,
      "terminal.ansiBrightGreen": p.base14,
      "terminal.ansiBrightYellow": p.base13,
      "terminal.ansiBrightBlue": p.base16,
      "terminal.ansiBrightMagenta": p.base17,
      "terminal.ansiBrightCyan": p.base15,
      "terminal.ansiBrightWhite": p.base07,
    },
    ...syntax,
  };
}

function assertPaletteOnly(theme, palette) {
  const allowed = new Set(Object.values(palette).map((color) => color.slice(1)));
  const serialized = JSON.stringify(theme);
  const colors = serialized.match(/#[0-9A-Fa-f]{6}(?:[0-9A-Fa-f]{2})?/g) ?? [];
  for (const color of colors) {
    if (!allowed.has(color.slice(1, 7).toUpperCase())) {
      throw new Error(`generated theme contains color outside palette: ${color}`);
    }
  }
}

async function main() {
  const palette = readPalette(await readFile(palettePath, "utf8"));
  const outputs = themeDefinitions.map((definition) => ({
    outputPath: path.join(themesDirectory, `${palette.scheme} ${definition.flavor}-color-theme.json`),
    theme: createTheme(palette, definition),
  }));

  for (const { outputPath, theme } of outputs) {
    assertPaletteOnly(theme, palette.colors);
    const generated = `${JSON.stringify(theme, null, 2)}\n`;

    if (checkOnly) {
      let current;
      try {
        current = await readFile(outputPath, "utf8");
      } catch (error) {
        if (error.code === "ENOENT") {
          throw new Error(`${path.relative(root, outputPath)} does not exist; run npm run build`);
        }
        throw error;
      }
      if (current !== generated) {
        throw new Error(`${path.relative(root, outputPath)} is out of date; run npm run build`);
      }
      console.log(`Checked ${path.relative(root, outputPath)}`);
    } else {
      await writeFile(outputPath, generated, "utf8");
      console.log(`Generated ${path.relative(root, outputPath)}`);
    }
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
