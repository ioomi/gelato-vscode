const vscode = require("vscode");
const typography = require("./theme-definitions/typography.cjs");

const themeSelector = "[Gelato Sorbet][Gelato Affogato][Gelato Soft]";
const managedRulePrefix = "Gelato global ";

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function textMateCustomizations(current, options) {
  const root = isObject(current) ? current : {};
  const theme = isObject(root[themeSelector]) ? root[themeSelector] : {};
  const existingRules = Array.isArray(theme.textMateRules)
    ? theme.textMateRules.filter(({ name }) => !name?.startsWith(managedRulePrefix))
    : [];
  const managedRules = Object.entries(typography).map(([fontStyle, style]) => ({
    name: `${managedRulePrefix}${fontStyle}`,
    scope: style.textMateScopes,
    settings: { fontStyle: options[fontStyle] ? fontStyle : "" },
  }));

  return {
    ...root,
    [themeSelector]: {
      ...theme,
      textMateRules: [...existingRules, ...managedRules],
    },
  };
}

function semanticTokenCustomizations(current, options) {
  const root = isObject(current) ? current : {};
  const theme = isObject(root[themeSelector]) ? root[themeSelector] : {};
  const rules = isObject(theme.rules) ? { ...theme.rules } : {};

  for (const [fontStyle, style] of Object.entries(typography)) {
    for (const selector of style.semanticSelectors) {
      const currentRule = rules[selector];
      rules[selector] = {
        ...(typeof currentRule === "string" ? { foreground: currentRule } : currentRule),
        [fontStyle]: options[fontStyle],
      };
    }
  }

  return {
    ...root,
    [themeSelector]: {
      ...theme,
      rules,
    },
  };
}

async function applyTypography() {
  const options = {
    bold: vscode.workspace.getConfiguration("gelato").get("bold", typography.bold.default),
    italic: vscode.workspace.getConfiguration("gelato").get("italic", typography.italic.default),
  };
  const editor = vscode.workspace.getConfiguration("editor");
  const tokenCurrent = editor.inspect("tokenColorCustomizations")?.globalValue;
  const semanticCurrent = editor.inspect("semanticTokenColorCustomizations")?.globalValue;
  const tokenNext = textMateCustomizations(tokenCurrent, options);
  const semanticNext = semanticTokenCustomizations(semanticCurrent, options);

  if (JSON.stringify(tokenCurrent) !== JSON.stringify(tokenNext)) {
    await editor.update("tokenColorCustomizations", tokenNext, vscode.ConfigurationTarget.Global);
  }
  if (JSON.stringify(semanticCurrent) !== JSON.stringify(semanticNext)) {
    await editor.update("semanticTokenColorCustomizations", semanticNext, vscode.ConfigurationTarget.Global);
  }
}

function activate(context) {
  let update = Promise.resolve();
  const scheduleUpdate = () => {
    update = update.then(applyTypography, applyTypography);
    return update;
  };

  void scheduleUpdate();
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("gelato.bold") || event.affectsConfiguration("gelato.italic")) {
        void scheduleUpdate();
      }
    }),
  );
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
  textMateCustomizations,
  semanticTokenCustomizations,
};
