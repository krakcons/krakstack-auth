import { expect, test, type Page } from "@playwright/test";
import { installEmailApi } from "./fixtures/email-api";

const expandSection = async (page: Page, name: string) => {
  const section = page.getByRole("group", { name, exact: true });
  if ((await section.getAttribute("open")) === null)
    await section.locator(":scope > summary").click();
  return section;
};

test("edits inline typography without losing legacy defaults and resets to effective values", async ({
  page,
}) => {
  const api = await installEmailApi(page);
  api.stored = { typography: { font: "mono", body: { size: 18 } } };
  await page.goto("/e2e/fixtures/email-editor.html?locale=en");
  await expect(
    page.getByRole("combobox", { name: "Default email font", exact: true }),
  ).toHaveCount(0);
  const save = page.getByRole("button", { name: "Save changes", exact: true });
  await expect(save).toBeDisabled();
  const heading = page.getByRole("group", { name: "Heading", exact: true });
  await expandSection(page, "Heading");
  await expect(
    heading.getByRole("combobox", { name: "Font", exact: true }),
  ).toContainText("Monospace");
  await expect(
    heading.getByRole("combobox", { name: "Font size", exact: true }),
  ).toContainText("32 px");
  await heading.getByRole("combobox", { name: "Font", exact: true }).click();
  await page.getByRole("option", { name: "Poppins", exact: true }).click();
  await heading
    .getByRole("combobox", { name: "Font size", exact: true })
    .click();
  await page.getByRole("option", { name: "36 px", exact: true }).click();
  await heading
    .getByRole("combobox", { name: "Alignment", exact: true })
    .click();
  await page.getByRole("option", { name: "Right", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Heading", exact: true })
    .fill("Custom heading");
  const preview = page.frameLocator('iframe[title="Live preview"]');
  await expect(
    preview.getByRole("heading", { name: "Custom heading", exact: true }),
  ).toHaveCSS("text-align", "right");
  await save.click();
  await expect(save).toBeDisabled();
  expect(api.stored.typography).toMatchObject({
    font: "mono",
    heading: { font: "poppins", size: 36, alignment: "right" },
  });
  await heading
    .getByRole("button", { name: "Reset text style", exact: true })
    .click();
  await expect(
    heading.getByRole("combobox", { name: "Font size", exact: true }),
  ).toContainText("32 px");
  await expect(
    heading.getByRole("combobox", { name: "Font", exact: true }),
  ).toContainText("Monospace");
  await page.getByRole("textbox", { name: "Heading", exact: true }).fill("");
  await save.click();
  await expect(save).toBeDisabled();
  expect(api.stored.templates?.["email-verification"]?.en).not.toHaveProperty(
    "title",
  );
  expect(api.stored.typography?.font).toBe("mono");
  await page.getByRole("tab", { name: "Header", exact: true }).click();
  const header = page.getByRole("region", { name: "Header", exact: true });
  await header.getByRole("button", { name: "Add block", exact: true }).click();
  await page.getByRole("menuitem", { name: "Text", exact: true }).click();
  await expect(
    header.getByRole("combobox", { name: "Font", exact: true }),
  ).toContainText("Monospace");
  await expect(
    header.getByRole("combobox", { name: "Font size", exact: true }),
  ).toContainText("18 px");
  await header
    .getByRole("combobox", { name: "Font size", exact: true })
    .click();
  await page.getByRole("option", { name: "12 px", exact: true }).click();
  await header
    .getByRole("button", { name: "Reset text style", exact: true })
    .click();
  await expect(
    header.getByRole("combobox", { name: "Font size", exact: true }),
  ).toContainText("18 px");
  for (const width of [1280, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await page.getByRole("tab", { name: "Body", exact: true }).click();
    await expandSection(page, "Heading");
    const groupBounds = await heading.boundingBox();
    if (!groupBounds)
      throw new Error("Heading typography controls are not visible");
    for (const control of await heading.getByRole("combobox").all()) {
      const bounds = await control.boundingBox();
      if (!bounds) throw new Error("Typography selector is not visible");
      expect(Math.round(bounds.x + bounds.width)).toBeLessThanOrEqual(
        Math.round(groupBounds.x + groupBounds.width),
      );
    }
  }
});

test("the labeled brand switch hides the automatic name in preview and after reload", async ({
  page,
}) => {
  const api = await installEmailApi(page);
  await page.goto("/e2e/fixtures/email-editor.html?locale=en&settings=full");
  await expandSection(page, "Project name");
  const preview = page.frameLocator('iframe[title="Live preview"]');
  const control = page.getByRole("switch", {
    name: "Brand name below message",
    exact: true,
  });
  await expect(control).toBeChecked();
  await expect(
    page.getByText(
      "Adds “Regression project” beneath the authentication content.",
      { exact: false },
    ),
  ).toBeVisible();
  await expect(
    preview.getByText("Regression project", { exact: true }),
  ).toBeVisible();
  await page.getByText("Brand name below message", { exact: true }).click();
  await expect(control).not.toBeChecked();
  await expect(
    preview.getByText("Regression project", { exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect.poll(() => api.stored?.appearance?.showProjectName).toBe(false);
  await page.reload();
  await expandSection(page, "Project name");
  await expect(control).not.toBeChecked();
  await expect(
    preview.getByText("Regression project", { exact: true }),
  ).toHaveCount(0);
  await control.focus();
  await control.press("Space");
  await expect(control).toBeChecked();
  await expect(
    preview.getByText("Regression project", { exact: true }),
  ).toBeVisible();
});

test("keeps long French blocks usable on narrow screens and rejects unsafe links", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 900 });
  const api = await installEmailApi(page);
  const longText = "RenseignementsSupplémentaires".repeat(6);
  api.stored = {
    typography: { body: { size: 18 }, code: { font: "mono", size: 24 } },
    layout: {
      header: {
        blocks: [
          { id: "intro", type: "text", text: { en: "Welcome", fr: longText } },
        ],
      },
      footer: {
        blocks: [
          {
            id: "help",
            type: "link",
            translations: {
              en: { label: "Help", url: "https://example.com/help" },
              fr: { label: longText, url: "https://example.com/fr/aide" },
            },
          },
        ],
      },
    },
  };
  await page.goto("/e2e/fixtures/email-editor.html?locale=en");
  await page
    .getByRole("combobox", { name: "Email language", exact: true })
    .click();
  await page.getByRole("option", { name: "French", exact: true }).click();
  const preview = page.frameLocator('iframe[title="Live preview"]');
  await expect(
    preview.getByRole("link", { name: longText, exact: true }),
  ).toBeVisible();
  expect(
    await preview
      .locator("html")
      .evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true);
  await page.getByRole("tab", { name: "Footer", exact: true }).click();
  const footer = page.getByRole("region", { name: "Footer", exact: true });
  await footer
    .getByRole("button", { name: "Edit Link block 1", exact: true })
    .click();
  const url = footer.getByRole("textbox", {
    name: "Link destination (FR)",
    exact: true,
  });
  await url.fill("javascript:alert(1)");
  await expect(url).toHaveAttribute("aria-invalid", "true");
  await expect(
    page.getByRole("button", { name: "Save changes", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Send test to me", exact: true }),
  ).toBeDisabled();
  await expect(
    preview.getByRole("link", { name: longText, exact: true }),
  ).toHaveAttribute("href", "https://example.com/fr/aide");
  await url.fill("mailto:aide@example.com");
  await expect(
    page.getByRole("button", { name: "Save changes", exact: true }),
  ).toBeEnabled();
  await expect(
    preview.getByRole("link", { name: longText, exact: true }),
  ).toHaveAttribute("href", "mailto:aide@example.com");
});

test("creates bilingual links and spacer/divider blocks, enforces capacity, and frees room after deletion", async ({
  page,
}) => {
  const api = await installEmailApi(page);
  api.stored = {
    layout: {
      footer: {
        blocks: Array.from({ length: 8 }, (_, index) => ({
          id: `divider-${index}`,
          type: "divider",
        })),
      },
    },
  };
  await page.goto("/e2e/fixtures/email-editor.html?locale=en");
  const save = page.getByRole("button", { name: "Save changes", exact: true });
  const language = page.getByRole("combobox", {
    name: "Email language",
    exact: true,
  });
  const header = page.getByRole("region", { name: "Header", exact: true });
  const footer = page.getByRole("region", { name: "Footer", exact: true });
  await page.getByRole("tab", { name: "Header", exact: true }).click();
  await header.getByRole("button", { name: "Add block", exact: true }).click();
  await page.getByRole("menuitem", { name: "Link", exact: true }).click();
  await header
    .getByRole("textbox", { name: "Link label (EN)", exact: true })
    .fill("Contact support");
  await header
    .getByRole("textbox", { name: "Link destination (EN)", exact: true })
    .fill("https://example.com/support");
  await expect(save).toBeDisabled();
  await expect(
    header.getByRole("button", { name: "Move to footer", exact: true }),
  ).toBeDisabled();
  await language.click();
  await page.getByRole("option", { name: "French", exact: true }).click();
  await header
    .getByRole("textbox", { name: "Link label (FR)", exact: true })
    .fill("Contacter l’aide");
  await header
    .getByRole("textbox", { name: "Link destination (FR)", exact: true })
    .fill("mailto:aide@example.com");
  await expect(save).toBeEnabled();
  await header.getByRole("button", { name: "Add block", exact: true }).click();
  await page.getByRole("menuitem", { name: "Spacer", exact: true }).click();
  await header
    .getByRole("combobox", { name: "Spacer size", exact: true })
    .click();
  await page.getByRole("option", { name: "Large", exact: true }).click();
  await header.getByRole("button", { name: "Add block", exact: true }).click();
  await page.getByRole("menuitem", { name: "Divider", exact: true }).click();
  await page.getByRole("tab", { name: "Footer", exact: true }).click();
  await expect(
    footer.getByRole("button", { name: "Add block", exact: true }),
  ).toBeDisabled();
  await footer
    .getByRole("button", { name: "Edit Divider block 1", exact: true })
    .click();
  await footer
    .getByRole("button", { name: "Delete block", exact: true })
    .click();
  await expect(
    footer.getByRole("button", { name: "Add block", exact: true }),
  ).toBeEnabled();
  await page.getByRole("tab", { name: "Header", exact: true }).click();
  await header
    .getByRole("button", { name: "Edit Link block 1", exact: true })
    .click();
  await header
    .getByRole("button", { name: "Move to footer", exact: true })
    .click();
  await expect(
    page.getByRole("tab", { name: "Footer", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    footer.getByRole("button", { name: "Add block", exact: true }),
  ).toBeDisabled();
  await expect(
    footer.getByRole("textbox", { name: "Link label (FR)", exact: true }),
  ).toHaveValue("Contacter l’aide");
  const preview = page.frameLocator('iframe[title="Live preview"]');
  await expect(
    preview.getByRole("link", { name: "Contacter l’aide", exact: true }),
  ).toHaveAttribute("href", "mailto:aide@example.com");
  await save.click();
  await expect(save).toBeDisabled();
  expect(api.stored.layout?.header?.blocks.map((block) => block.type)).toEqual([
    "spacer",
    "divider",
  ]);
  expect(api.stored.layout?.header?.blocks[0]).toMatchObject({ size: "large" });
  expect(api.stored.layout?.footer?.blocks).toHaveLength(8);
  expect(api.stored.layout?.footer?.blocks[7]).toMatchObject({
    type: "link",
    translations: {
      en: { label: "Contact support", url: "https://example.com/support" },
      fr: { label: "Contacter l’aide", url: "mailto:aide@example.com" },
    },
  });
});

for (const locale of ["en", "fr"] as const) {
  const labels =
    locale === "fr"
      ? {
          header: "En-tête",
          body: "Corps",
          footer: "Pied de page",
          appearance: "Apparence du courriel",
          logoStyle: "Taille et espacement du logo",
          actions: "Actions de la section",
          clear: "Vider les blocs de la section",
          editText: "Modifier le bloc Texte 1",
          kind: "Type de courriel",
          language: "Langue du courriel",
          verification: "Vérification du courriel",
          reset: "Lien de réinitialisation du mot de passe",
          english: "Anglais",
          french: "Français",
          heading: "Titre",
          action: "Libellé du bouton",
          save: "Enregistrer",
          preview: "Aperçu en direct",
          saved: "Réglages des courriels enregistrés.",
          saveError: "Impossible d’enregistrer les réglages des courriels.",
          background: "Couleur de fond",
          picker: "Choisir une couleur : Couleur de fond",
          slider: "Saturation et luminosité",
          width: "Largeur du logo (px)",
          menu: "Actions des réglages des courriels",
          restoreAppearance: "Rétablir l’apparence",
          restoreContent: "Rétablir cette traduction",
          restoreAll: "Rétablir tous les courriels par défaut",
          sample: "M’envoyer un test",
          sampleSent: "Courriel de test soumis pour envoi.",
          sampleError:
            "Impossible d’envoyer le test. Vérifiez votre adresse d’administration et les paramètres d’envoi de courriels du serveur.",
          add: "Ajouter un bloc",
          text: "Texte",
          textField: "Texte du bloc (EN)",
          frenchField: "Texte du bloc (FR)",
          move: "Déplacer vers le pied de page",
          up: "Monter",
          copy: "Copier depuis l’autre langue",
          font: "Police",
          mono: "Chasse fixe",
          size: "Taille de police",
          brand: "Nom de marque sous le message",
          placement: "Position du logo",
        }
      : {
          header: "Header",
          body: "Body",
          footer: "Footer",
          appearance: "Email appearance",
          logoStyle: "Logo size and spacing",
          actions: "Section actions",
          clear: "Clear section blocks",
          editText: "Edit Text block 1",
          kind: "Email type",
          language: "Email language",
          verification: "Email verification",
          reset: "Password-reset link",
          english: "English",
          french: "French",
          heading: "Heading",
          action: "Button label",
          save: "Save changes",
          preview: "Live preview",
          saved: "Email settings saved.",
          saveError: "Unable to save email settings.",
          background: "Background color",
          picker: "Choose color: Background color",
          slider: "Saturation and brightness",
          width: "Logo width (px)",
          menu: "Email settings actions",
          restoreAppearance: "Restore appearance",
          restoreContent: "Restore this translation",
          restoreAll: "Restore all email defaults",
          sample: "Send test to me",
          sampleSent: "Test email submitted for delivery.",
          sampleError:
            "Unable to send the test. Check your administrator email and the server’s email delivery settings.",
          add: "Add block",
          text: "Text",
          textField: "Block text (EN)",
          frenchField: "Block text (FR)",
          move: "Move to footer",
          up: "Move up",
          copy: "Copy from other language",
          font: "Font",
          mono: "Monospace",
          size: "Font size",
          brand: "Brand name below message",
          placement: "Logo placement",
        };

  test.describe(`${locale} email editor`, () => {
    test("starts Body sections collapsed and preserves whole-element formatting through collapse, save, reload, and reset", async ({
      page,
    }) => {
      const api = await installEmailApi(page);
      api.stored = {
        typography: { font: "mono" },
        layout: {
          footer: {
            blocks: [
              {
                id: "sender",
                type: "text",
                text: { en: "Sender marker", fr: "Expéditeur" },
              },
              {
                id: "support",
                type: "link",
                translations: {
                  en: { label: "Support marker", url: "https://example.com" },
                  fr: { label: "Aide", url: "mailto:aide@example.com" },
                },
              },
            ],
          },
        },
      };
      await page.goto(`/e2e/fixtures/email-editor.html?locale=${locale}`);
      const names =
        locale === "fr"
          ? {
              details: "Détails du courriel",
              code: "Code d’authentification",
              footing: "Note de bas de message",
              brand: "Nom du projet",
              bold: "Gras",
              italic: "Italique",
              underline: "Souligné",
              strike: "Barré",
              reset: "Rétablir le style du texte",
            }
          : {
              details: "Email details",
              code: "Authentication code",
              footing: "Footing",
              brand: "Project name",
              bold: "Bold",
              italic: "Italic",
              underline: "Underline",
              strike: "Strikethrough",
              reset: "Reset text style",
            };
      for (const name of [
        names.details,
        labels.heading,
        "Message",
        names.code,
        names.footing,
        names.brand,
      ])
        await expect(
          page.getByRole("group", { name, exact: true }),
        ).not.toHaveAttribute("open");
      const save = page.getByRole("button", { name: labels.save, exact: true });
      await expect(save).toBeDisabled();
      const heading = await expandSection(page, labels.heading);
      const toggle = (name: string) =>
        heading.getByRole("button", { name, exact: true });
      await expect(toggle(names.bold)).toHaveAttribute("aria-pressed", "true");
      await heading
        .getByRole("textbox", { name: labels.heading, exact: true })
        .fill("Formatted heading");
      for (const name of [
        names.bold,
        names.italic,
        names.underline,
        names.strike,
      ])
        await toggle(name).click();
      const preview = page.frameLocator(`iframe[title="${labels.preview}"]`);
      const renderedHeading = preview.getByRole("heading", {
        name: "Formatted heading",
        exact: true,
      });
      await expect(renderedHeading).toHaveCSS("font-weight", "400");
      await expect(renderedHeading).toHaveCSS("font-style", "italic");
      await expect(renderedHeading).toHaveCSS(
        "text-decoration-line",
        "underline line-through",
      );
      await heading.locator(":scope > summary").click();
      await expect(heading.getByRole("textbox")).not.toBeVisible();
      await expandSection(page, labels.heading);
      await expect(toggle(names.italic)).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await page.getByRole("tab", { name: labels.footer, exact: true }).click();
      const footer = page.getByRole("region", {
        name: labels.footer,
        exact: true,
      });
      await footer
        .getByRole("button", { name: labels.editText, exact: true })
        .click();
      await footer
        .getByRole("button", { name: names.bold, exact: true })
        .click();
      await expect(
        preview.getByText("Sender marker", { exact: true }),
      ).toHaveCSS("font-weight", "700");
      await footer
        .getByRole("button", {
          name:
            locale === "fr" ? "Modifier le bloc Lien 2" : "Edit Link block 2",
          exact: true,
        })
        .click();
      await expect(
        footer.getByRole("button", { name: names.underline, exact: true }),
      ).toHaveAttribute("aria-pressed", "true");
      await footer
        .getByRole("button", { name: names.strike, exact: true })
        .click();
      await expect(
        preview.getByRole("link", { name: "Support marker", exact: true }),
      ).toHaveCSS("text-decoration-line", "underline line-through");
      await footer
        .getByRole("button", { name: names.underline, exact: true })
        .click();
      await expect(
        preview.getByRole("link", { name: "Support marker", exact: true }),
      ).toHaveCSS("text-decoration-line", "line-through");
      await save.click();
      await expect(save).toBeDisabled();
      expect(api.stored.typography?.heading).toMatchObject({
        bold: false,
        italic: true,
        underline: true,
        strikethrough: true,
      });
      expect(api.stored.layout?.footer?.blocks[0]).toMatchObject({
        style: { bold: true },
      });
      expect(api.stored.layout?.footer?.blocks[1]).toMatchObject({
        style: { underline: false, strikethrough: true },
      });
      await page.reload();
      await expect(heading).not.toHaveAttribute("open");
      await expandSection(page, labels.heading);
      await expect(toggle(names.bold)).toHaveAttribute("aria-pressed", "false");
      await expect(toggle(names.italic)).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await heading
        .getByRole("button", { name: names.reset, exact: true })
        .click();
      await expect(toggle(names.bold)).toHaveAttribute("aria-pressed", "true");
      await expect(toggle(names.italic)).toHaveAttribute(
        "aria-pressed",
        "false",
      );
      await expect(renderedHeading).toHaveCSS("font-style", "normal");
      await expect(renderedHeading).toHaveCSS("text-decoration-line", "none");
      await save.click();
      await expect(save).toBeDisabled();
      expect(api.stored.typography).toMatchObject({
        font: "mono",
        heading: {},
      });
      expect(api.stored.layout?.footer?.blocks[0]).toMatchObject({
        style: { bold: true },
      });
    });

    test("edits local text colors across sections without exposing or overwriting legacy shared colors", async ({
      page,
    }) => {
      const api = await installEmailApi(page);
      const legacy = {
        foreground: "#223344",
        mutedForeground: "#445566",
        primary: "#123456",
        primaryForeground: "#FDFDFD",
        muted: "#EEF0F2",
      };
      api.stored = {
        appearance: legacy,
        layout: {
          header: {
            blocks: [
              {
                id: "color-text",
                type: "text",
                text: { en: "Outer color marker", fr: "Couleur externe" },
              },
            ],
          },
          footer: {
            blocks: [
              {
                id: "color-link",
                type: "link",
                translations: {
                  en: {
                    label: "Link color marker",
                    url: "https://example.com",
                  },
                  fr: {
                    label: "Lien de couleur",
                    url: "https://example.com/fr",
                  },
                },
              },
            ],
          },
        },
      };
      await page.goto(`/e2e/fixtures/email-editor.html?locale=${locale}`);
      const textColor = locale === "fr" ? "Couleur du texte" : "Text color";
      const resetStyle =
        locale === "fr" ? "Rétablir le style du texte" : "Reset text style";
      const save = page.getByRole("button", { name: labels.save, exact: true });
      const preview = page.frameLocator(`iframe[title="${labels.preview}"]`);
      await page.getByText(labels.appearance, { exact: true }).click();
      const appearance = page.getByRole("group", {
        name: labels.appearance,
        exact: true,
      });
      await expect(appearance.getByRole("textbox")).toHaveCount(1);
      await expect(
        appearance.getByRole("textbox", {
          name: labels.background,
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        appearance.getByText(
          locale === "fr" ? "À propos des polices" : "About fonts",
          { exact: true },
        ),
      ).toHaveCount(0);
      await page.getByText(labels.appearance, { exact: true }).click();
      const heading = page.getByRole("group", {
        name: labels.heading,
        exact: true,
      });
      await expandSection(page, labels.heading);
      const headingColor = heading.getByRole("textbox", {
        name: textColor,
        exact: true,
      });
      await expect(headingColor).toHaveAttribute(
        "placeholder",
        legacy.foreground,
      );
      await expect(save).toBeDisabled();
      await page
        .getByRole("textbox", { name: labels.heading, exact: true })
        .fill("Colored heading");
      await headingColor.fill("#AA1100");
      await expect(
        preview.getByRole("heading", { name: "Colored heading" }),
      ).toHaveCSS("color", "rgb(170, 17, 0)");
      await headingColor.fill("#AA1");
      await expect(headingColor).toHaveAttribute("aria-invalid", "true");
      await expect(save).toBeDisabled();
      await expect(
        page.getByRole("button", { name: labels.sample, exact: true }),
      ).toBeDisabled();
      await expect(
        preview.getByRole("heading", { name: "Colored heading" }),
      ).toHaveCSS("color", "rgb(170, 17, 0)");
      await headingColor.fill("#AA1100");
      for (const [name, color] of [
        ["Message", "#BB2200"],
        [
          locale === "fr" ? "Code d’authentification" : "Authentication code",
          "#CC3300",
        ],
        [locale === "fr" ? "Note de bas de message" : "Footing", "#DD4400"],
        [locale === "fr" ? "Nom du projet" : "Project name", "#EE5500"],
      ]) {
        await expandSection(page, name);
        await page
          .getByRole("group", { name, exact: true })
          .getByRole("textbox", { name: textColor, exact: true })
          .fill(color);
      }
      const codeBackground = page.getByRole("textbox", {
        name:
          locale === "fr" ? "Couleur de fond du code" : "Code background color",
        exact: true,
      });
      await codeBackground.fill("#EFEFEF");
      await page.getByRole("tab", { name: labels.header, exact: true }).click();
      const header = page.getByRole("region", {
        name: labels.header,
        exact: true,
      });
      await header
        .getByRole("button", { name: labels.editText, exact: true })
        .click();
      const outerColor = header.getByRole("textbox", {
        name: textColor,
        exact: true,
      });
      await expect(outerColor).toHaveAttribute(
        "placeholder",
        legacy.foreground,
      );
      await expect(
        preview.getByText("Outer color marker", { exact: true }),
      ).toHaveCSS("color", "rgb(34, 51, 68)");
      await outerColor.fill("#116622");
      await expect(
        preview.getByText("Outer color marker", { exact: true }),
      ).toHaveCSS("color", "rgb(17, 102, 34)");
      await header
        .getByRole("button", { name: resetStyle, exact: true })
        .click();
      await expect(outerColor).toHaveValue("");
      await expect(
        preview.getByText("Outer color marker", { exact: true }),
      ).toHaveCSS("color", "rgb(34, 51, 68)");
      await outerColor.fill("#116622");
      await page.getByRole("tab", { name: labels.footer, exact: true }).click();
      const footer = page.getByRole("region", {
        name: labels.footer,
        exact: true,
      });
      await footer
        .getByRole("button", {
          name:
            locale === "fr" ? "Modifier le bloc Lien 1" : "Edit Link block 1",
          exact: true,
        })
        .click();
      await footer
        .getByRole("textbox", { name: textColor, exact: true })
        .fill("#227733");
      await expect(
        preview.getByRole("link", { name: "Link color marker", exact: true }),
      ).toHaveCSS("color", "rgb(34, 119, 51)");
      await page.getByRole("tab", { name: labels.body, exact: true }).click();
      await page
        .getByRole("combobox", { name: labels.kind, exact: true })
        .click();
      await page
        .getByRole("option", { name: labels.reset, exact: true })
        .click();
      const button = page.getByRole("group", {
        name: labels.action,
        exact: true,
      });
      await expandSection(page, labels.action);
      const buttonColor = button.getByRole("textbox", {
        name: textColor,
        exact: true,
      });
      await expect(buttonColor).toHaveAttribute(
        "placeholder",
        legacy.primaryForeground,
      );
      await buttonColor.fill("#338844");
      await page
        .getByRole("textbox", {
          name: locale === "fr" ? "Couleur du bouton" : "Button color",
          exact: true,
        })
        .fill("#F0F0F0");
      await expect(
        preview.getByRole("link").filter({ hasText: /Reset|réinitialiser/i }),
      ).toHaveCSS("color", "rgb(51, 136, 68)");
      await save.click();
      await expect(save).toBeDisabled();
      expect(api.stored.appearance).toEqual({
        ...legacy,
        primary: "#F0F0F0",
        muted: "#EFEFEF",
      });
      expect(api.stored.typography).toMatchObject({
        heading: { color: "#AA1100" },
        body: { color: "#BB2200" },
        code: { color: "#CC3300" },
        help: { color: "#DD4400" },
        projectName: { color: "#EE5500" },
        button: { color: "#338844" },
      });
      await page.reload();
      await expandSection(page, labels.heading);
      await expect(headingColor).toHaveValue("#AA1100");
      await headingColor.fill("");
      await save.click();
      await expect(save).toBeDisabled();
      expect(api.stored.typography?.heading).not.toHaveProperty("color");
      expect(api.stored.appearance?.foreground).toBe(legacy.foreground);
      await expect(
        preview.getByRole("heading", { name: "Colored heading" }),
      ).toHaveCSS("color", "rgb(34, 51, 68)");
    });

    test("edits bilingual sections with inline styles, movement, preview, and persistence", async ({
      page,
    }) => {
      const api = await installEmailApi(page);
      await page.goto(`/e2e/fixtures/email-editor.html?locale=${locale}`);
      const save = page.getByRole("button", { name: labels.save, exact: true });
      const sample = page.getByRole("button", {
        name: labels.sample,
        exact: true,
      });
      const language = page.getByRole("combobox", {
        name: labels.language,
        exact: true,
      });
      await expandSection(
        page,
        locale === "fr" ? "Nom du projet" : "Project name",
      );
      await page
        .getByRole("switch", { name: labels.brand, exact: true })
        .click();
      await page.getByText(labels.appearance, { exact: true }).click();
      await page.getByText(labels.logoStyle, { exact: true }).click();
      await page
        .getByRole("combobox", { name: labels.placement, exact: true })
        .click();
      await page
        .getByRole("option", { name: labels.header, exact: true })
        .click();
      await page.getByText(labels.appearance, { exact: true }).click();
      await page.getByRole("tab", { name: labels.header, exact: true }).click();
      const header = page.getByRole("region", {
        name: labels.header,
        exact: true,
      });
      const footer = page.getByRole("region", {
        name: labels.footer,
        exact: true,
      });
      await header
        .getByRole("button", { name: labels.add, exact: true })
        .click();
      await page
        .getByRole("menuitem", { name: labels.text, exact: true })
        .click();
      await header
        .getByRole("textbox", { name: labels.textField, exact: true })
        .fill("Header English marker");
      await expect(save).toBeDisabled();
      await expect(sample).toBeDisabled();
      const preview = page.frameLocator(`iframe[title="${labels.preview}"]`);
      await expect(
        preview.getByText("Header English marker", { exact: true }),
      ).toBeVisible();
      await language.click();
      await page
        .getByRole("option", { name: labels.french, exact: true })
        .click();
      await expect(
        preview.getByText("Header English marker", { exact: true }),
      ).not.toBeVisible();
      await header
        .getByRole("textbox", { name: labels.frenchField, exact: true })
        .fill("Repère français");
      await expect(save).toBeEnabled();
      await expect(
        preview.getByText("Repère français", { exact: true }),
      ).toBeVisible();
      await header
        .getByRole("button", { name: labels.move, exact: true })
        .click();
      await expect(
        page.getByRole("tab", { name: labels.footer, exact: true }),
      ).toHaveAttribute("aria-selected", "true");
      await expect(
        footer.getByRole("textbox", { name: labels.frenchField, exact: true }),
      ).toHaveValue("Repère français");
      await page.getByRole("tab", { name: labels.header, exact: true }).click();
      await header
        .getByRole("button", { name: labels.add, exact: true })
        .click();
      await page
        .getByRole("menuitem", { name: labels.text, exact: true })
        .click();
      await header
        .getByRole("textbox", { name: labels.frenchField, exact: true })
        .fill("Sender address");
      await language.click();
      await page
        .getByRole("option", { name: labels.english, exact: true })
        .click();
      await header
        .getByRole("button", { name: labels.copy, exact: true })
        .click();
      await expect(
        header.getByRole("textbox", { name: labels.textField, exact: true }),
      ).toHaveValue("Sender address");
      await header
        .getByRole("button", { name: labels.move, exact: true })
        .click();
      await footer
        .getByRole("button", { name: labels.up, exact: true })
        .click();
      await page.getByRole("tab", { name: labels.body, exact: true }).click();
      const heading = page.getByRole("group", {
        name: labels.heading,
        exact: true,
      });
      await expandSection(page, labels.heading);
      await heading
        .getByRole("combobox", { name: labels.font, exact: true })
        .click();
      await page
        .getByRole("option", { name: labels.mono, exact: true })
        .click();
      await heading
        .getByRole("combobox", { name: labels.size, exact: true })
        .click();
      await page.getByRole("option", { name: "36 px", exact: true }).click();
      await save.click();
      await expect(save).toBeDisabled();
      await expect
        .poll(() =>
          api.stored?.layout?.footer?.blocks.map((block) =>
            block.type === "text" ? block.text.en : "",
          ),
        )
        .toEqual(["Sender address", "Header English marker"]);
      expect(api.stored?.appearance).toMatchObject({
        logoPlacement: "header",
        showProjectName: false,
      });
      expect(api.stored?.typography).toMatchObject({
        heading: { font: "mono", size: 36 },
      });
      await expect(preview.getByRole("heading")).toHaveCSS("font-size", "36px");
      await sample.click();
      await expect.poll(() => api.samples.length).toBe(1);
      expect(api.samples[0]?.settings).toEqual(api.stored);
      await page.reload();
      await page.getByRole("tab", { name: labels.footer, exact: true }).click();
      await footer
        .getByRole("button", { name: labels.editText, exact: true })
        .click();
      await expect(
        footer.getByRole("textbox", { name: labels.textField, exact: true }),
      ).toHaveValue("Sender address");
      await expect(save).toBeDisabled();
    });

    test("retains unsaved sections on cancelled navigation and clears only after confirmation", async ({
      page,
    }) => {
      const api = await installEmailApi(page);
      api.stored = {
        layout: {
          footer: {
            blocks: [
              {
                id: "address",
                type: "text",
                text: { en: "Address", fr: "Adresse" },
              },
            ],
          },
        },
      };
      await page.goto(`/e2e/fixtures/email-editor.html?locale=${locale}`);
      await page.getByRole("tab", { name: labels.footer, exact: true }).click();
      const footer = page.getByRole("region", {
        name: labels.footer,
        exact: true,
      });
      await footer
        .getByRole("button", { name: labels.editText, exact: true })
        .click();
      const address = footer.getByRole("textbox", {
        name: labels.textField,
        exact: true,
      });
      await address.fill("Unsaved address");
      page.once("dialog", (dialog) => dialog.dismiss());
      await page
        .getByRole("button", { name: "Leave editor", exact: true })
        .click();
      await expect(address).toHaveValue("Unsaved address");
      await footer
        .getByRole("button", { name: labels.actions, exact: true })
        .click();
      page.once("dialog", (dialog) => dialog.dismiss());
      await page
        .getByRole("menuitem", { name: labels.clear, exact: true })
        .click();
      await expect(address).toHaveValue("Unsaved address");
      await footer
        .getByRole("button", { name: labels.actions, exact: true })
        .click();
      page.once("dialog", (dialog) => dialog.accept());
      await page
        .getByRole("menuitem", { name: labels.clear, exact: true })
        .click();
      await expect(address).toHaveCount(0);
      expect(api.stored.layout?.footer?.blocks).toHaveLength(1);
      page.once("dialog", (dialog) => dialog.accept());
      await page
        .getByRole("button", { name: "Leave editor", exact: true })
        .click();
      await expect(
        page.getByText("Left editor", { exact: true }),
      ).toBeVisible();
      expect(api.saves).toHaveLength(0);
    });

    test("preserves type/language drafts across sections and keeps the active tab after save", async ({
      page,
    }) => {
      const api = await installEmailApi(page);
      await page.goto(`/e2e/fixtures/email-editor.html?locale=${locale}`);
      const heading = page.getByRole("textbox", {
        name: labels.heading,
        exact: true,
      });
      const save = page.getByRole("button", { name: labels.save, exact: true });
      const body = page.getByRole("tab", { name: labels.body, exact: true });
      const kind = page.getByRole("combobox", {
        name: labels.kind,
        exact: true,
      });
      const language = page.getByRole("combobox", {
        name: labels.language,
        exact: true,
      });
      await expect(save).toBeDisabled();
      await expandSection(page, labels.heading);
      await heading.fill("Verification draft");
      await kind.click();
      await page
        .getByRole("option", { name: labels.reset, exact: true })
        .click();
      await expandSection(page, labels.action);
      await expandSection(page, labels.heading);
      await expect(
        page.getByRole("textbox", { name: labels.action, exact: true }),
      ).toBeVisible();
      await heading.fill("Reset draft");
      await kind.click();
      await page
        .getByRole("option", { name: labels.verification, exact: true })
        .click();
      await expandSection(page, labels.heading);
      await expect(heading).toHaveValue("Verification draft");
      await language.click();
      await page
        .getByRole("option", { name: labels.french, exact: true })
        .click();
      await expandSection(page, labels.heading);
      await heading.fill("Brouillon français");
      await language.click();
      await page
        .getByRole("option", { name: labels.english, exact: true })
        .click();
      await page.getByRole("tab", { name: labels.header, exact: true }).click();
      await page.getByText(labels.appearance, { exact: true }).click();
      await page.getByText(labels.logoStyle, { exact: true }).click();
      await page
        .getByRole("spinbutton", { name: labels.width, exact: true })
        .fill("180");
      await body.click();
      await expandSection(page, labels.heading);
      await expect(heading).toHaveValue("Verification draft");
      let finishSave = () => {};
      api.holdSave = new Promise<void>((resolve) => {
        finishSave = resolve;
      });
      await save.click();
      await expect.poll(() => api.saves.length).toBe(1);
      await expect(save).toBeDisabled();
      await expect(body).toHaveAttribute("aria-selected", "true");
      finishSave();
      await expect(
        page.getByRole("status").filter({ hasText: labels.saved }),
      ).toBeVisible();
      await expect(body).toHaveAttribute("aria-selected", "true");
      await expect(save).toBeDisabled();
      expect(api.stored).toMatchObject({
        appearance: { logoWidth: 180 },
        templates: {
          "email-verification": {
            en: { title: "Verification draft" },
            fr: { title: "Brouillon français" },
          },
          "reset-password": { en: { title: "Reset draft" } },
        },
      });
      await heading.fill("Changed again");
      await expect(save).toBeEnabled();
      await heading.fill("Verification draft");
      await expect(save).toBeDisabled();
    });

    test("retains failed saves and restores only the requested scope until saved", async ({
      page,
    }) => {
      const api = await installEmailApi(page);
      api.stored = {
        appearance: { logoWidth: 200 },
        templates: {
          "email-verification": {
            en: { title: "Saved English" },
            fr: { title: "Français conservé" },
          },
        },
      };
      await page.goto(`/e2e/fixtures/email-editor.html?locale=${locale}`);
      const heading = page.getByRole("textbox", {
        name: labels.heading,
        exact: true,
      });
      const save = page.getByRole("button", { name: labels.save, exact: true });
      await expandSection(page, labels.heading);
      await heading.fill("Retain this draft");
      api.failNextSave = true;
      await save.click();
      await expect(page.getByRole("alert")).toHaveText(labels.saveError);
      await expect(heading).toHaveValue("Retain this draft");
      await expect(save).toBeEnabled();
      expect(api.stored.templates?.["email-verification"]?.en?.title).toBe(
        "Saved English",
      );
      await save.click();
      await expect(
        page.getByRole("status").filter({ hasText: labels.saved }),
      ).toBeVisible();
      await expect(save).toBeDisabled();
      await page
        .getByRole("button", { name: labels.menu, exact: true })
        .click();
      await page
        .getByRole("menuitem", { name: labels.restoreAppearance, exact: true })
        .click();
      await expect(heading).toHaveValue("Retain this draft");
      expect(api.stored.appearance?.logoWidth).toBe(200);
      await save.click();
      await expect(save).toBeDisabled();
      expect(api.stored.appearance).toBeUndefined();
      expect(api.stored.templates?.["email-verification"]?.fr?.title).toBe(
        "Français conservé",
      );
      await page
        .getByRole("button", { name: labels.menu, exact: true })
        .click();
      await page
        .getByRole("menuitem", { name: labels.restoreContent, exact: true })
        .click();
      await expect(heading).toHaveValue("");
      await save.click();
      await expect
        .poll(() => api.stored?.templates?.["email-verification"]?.en)
        .toEqual({});
      await expect(save).toBeDisabled();
      expect(api.stored.templates?.["email-verification"]?.fr?.title).toBe(
        "Français conservé",
      );
      await page
        .getByRole("button", { name: labels.menu, exact: true })
        .click();
      page.once("dialog", (dialog) => dialog.accept());
      await page
        .getByRole("menuitem", { name: labels.restoreAll, exact: true })
        .click();
      expect(api.stored.templates?.["email-verification"]?.fr?.title).toBe(
        "Français conservé",
      );
      await save.click();
      await expect.poll(() => api.stored).toEqual({});
      await expect(save).toBeDisabled();
    });

    test("keeps the last valid preview for invalid colors and sends unsaved samples without persisting", async ({
      page,
    }) => {
      const api = await installEmailApi(page);
      await page.goto(`/e2e/fixtures/email-editor.html?locale=${locale}`);
      await expandSection(page, labels.heading);
      await page
        .getByRole("textbox", { name: labels.heading, exact: true })
        .fill("Unsaved sample");
      const preview = page.frameLocator(`iframe[title="${labels.preview}"]`);
      await expect(
        preview.getByRole("heading", { name: "Unsaved sample", exact: true }),
      ).toBeVisible();
      await page.getByText(labels.appearance, { exact: true }).click();
      await page.getByText(labels.logoStyle, { exact: true }).click();
      const width = page.getByRole("spinbutton", {
        name: labels.width,
        exact: true,
      });
      await width.fill("180");
      await width.fill("");
      const color = page.getByRole("textbox", {
        name: labels.background,
        exact: true,
      });
      await page
        .getByRole("button", { name: labels.picker, exact: true })
        .click();
      const slider = page.getByRole("slider", {
        name: labels.slider,
        exact: true,
      });
      await slider.focus();
      await slider.press("ArrowDown");
      await expect(color).toHaveValue(/^#[0-9A-F]{6}$/);
      await page.keyboard.press("Escape");
      await color.fill("#123456");
      await expect(preview.locator("body")).toHaveCSS(
        "background-color",
        "rgb(18, 52, 86)",
      );
      await color.fill("#12");
      const sample = page.getByRole("button", {
        name: labels.sample,
        exact: true,
      });
      await expect(sample).toBeDisabled();
      await expect(
        page.getByRole("button", { name: labels.save, exact: true }),
      ).toBeDisabled();
      await expect(
        preview.getByRole("heading", { name: "Unsaved sample", exact: true }),
      ).toBeVisible();
      await color.fill("");
      await expect(preview.locator("body")).toHaveCSS(
        "background-color",
        "rgb(255, 255, 255)",
      );
      api.failNextSample = true;
      await sample.click();
      await expect(page.getByRole("alert")).toHaveText(labels.sampleError);
      await expect(
        page.getByRole("status").filter({ hasText: labels.sampleSent }),
      ).not.toBeVisible();
      await sample.click();
      await expect(
        page.getByRole("status").filter({ hasText: labels.sampleSent }),
      ).toBeVisible();
      expect(api.samples).toHaveLength(2);
      expect(api.samples[0]).toMatchObject({
        kind: "email-verification",
        locale: "en",
        settings: {
          templates: {
            "email-verification": { en: { title: "Unsaved sample" } },
          },
        },
      });
      expect(api.samples[0]?.settings.appearance?.background).toBeUndefined();
      expect(api.samples[0]?.settings.appearance?.logoWidth).toBeUndefined();
      expect(api.saves).toHaveLength(0);
      expect(api.stored).toBeUndefined();
      await expect(
        page.getByRole("button", { name: labels.save, exact: true }),
      ).toBeEnabled();
    });
  });
}
