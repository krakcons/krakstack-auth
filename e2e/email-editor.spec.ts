import { expect, test } from "@playwright/test";
import { installEmailApi } from "./fixtures/email-api";

const locales: ReadonlyArray<"en" | "fr"> = ["en", "fr"];

for (const locale of locales) {
  const labels =
    locale === "fr"
      ? {
          content: "Contenu",
          appearance: "Apparence",
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
          colors: "Couleurs",
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
        }
      : {
          content: "Content",
          appearance: "Appearance",
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
          colors: "Colors",
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
        };

  test.describe(`${locale} email editor`, () => {
    test("preserves type/language drafts across tabs and saves without switching the active tab", async ({
      page,
    }) => {
      const api = await installEmailApi(page);
      await page.goto(`/e2e/fixtures/email-editor.html?locale=${locale}`);
      const heading = page.getByRole("textbox", {
        name: labels.heading,
        exact: true,
      });
      const save = page.getByRole("button", { name: labels.save, exact: true });
      const content = page.getByRole("tab", {
        name: labels.content,
        exact: true,
      });
      const appearance = page.getByRole("tab", {
        name: labels.appearance,
        exact: true,
      });
      const kind = page.getByRole("combobox", {
        name: labels.kind,
        exact: true,
      });
      const language = page.getByRole("combobox", {
        name: labels.language,
        exact: true,
      });

      await expect(save).toBeDisabled();
      await heading.fill("Verification draft");
      await kind.click();
      await page
        .getByRole("option", { name: labels.reset, exact: true })
        .click();
      await expect(
        page.getByRole("textbox", { name: labels.action, exact: true }),
      ).toBeVisible();
      await heading.fill("Reset draft");
      await kind.click();
      await page
        .getByRole("option", { name: labels.verification, exact: true })
        .click();
      await expect(heading).toHaveValue("Verification draft");
      await language.click();
      await page
        .getByRole("option", { name: labels.french, exact: true })
        .click();
      await heading.fill("Brouillon français");
      await language.click();
      await page
        .getByRole("option", { name: labels.english, exact: true })
        .click();
      await appearance.click();
      await page
        .getByRole("spinbutton", { name: labels.width, exact: true })
        .fill("180");
      await content.click();
      await expect(heading).toHaveValue("Verification draft");

      let finishSave = () => {};
      api.holdSave = new Promise<void>((resolve) => {
        finishSave = resolve;
      });
      await save.click();
      await expect.poll(() => api.saves.length).toBe(1);
      await expect(save).toBeDisabled();
      await expect(content).toHaveAttribute("aria-selected", "true");
      finishSave();
      await expect(
        page.getByRole("status").filter({ hasText: labels.saved }),
      ).toBeVisible();
      await expect(content).toHaveAttribute("aria-selected", "true");
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

    test("retains failed saves and restores only the requested scope until explicitly saved", async ({
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
      await expect(save).toBeEnabled();
      expect(api.stored.appearance?.logoWidth).toBe(200);
      await save.click();
      await expect(
        page.getByRole("status").filter({ hasText: labels.saved }),
      ).toBeVisible();
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
      await expect(save).toBeDisabled();
      await expect
        .poll(() => api.stored?.templates?.["email-verification"]?.en)
        .toEqual({});
      expect(api.stored.templates?.["email-verification"]?.fr?.title).toBe(
        "Français conservé",
      );

      await page
        .getByRole("button", { name: labels.menu, exact: true })
        .click();
      await page
        .getByRole("menuitem", { name: labels.restoreAll, exact: true })
        .click();
      await expect(save).toBeEnabled();
      expect(api.stored.templates?.["email-verification"]?.fr?.title).toBe(
        "Français conservé",
      );
      await save.click();
      await expect.poll(() => api.stored).toEqual({});
      await expect(save).toBeDisabled();
    });

    test("keeps a valid preview while editing invalid colors and sends the unsaved draft without persisting it", async ({
      page,
    }) => {
      const api = await installEmailApi(page);
      await page.goto(`/e2e/fixtures/email-editor.html?locale=${locale}`);
      await page
        .getByRole("textbox", { name: labels.heading, exact: true })
        .fill("Unsaved sample");
      const preview = page.frameLocator(`iframe[title="${labels.preview}"]`);
      await expect(
        preview.getByRole("heading", { name: "Unsaved sample", exact: true }),
      ).toBeVisible();
      await page
        .getByRole("tab", { name: labels.appearance, exact: true })
        .click();
      const width = page.getByRole("spinbutton", {
        name: labels.width,
        exact: true,
      });
      await width.fill("180");
      await width.fill("");
      await page.getByText(labels.colors, { exact: true }).click();
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
      await expect(
        page.getByRole("button", { name: labels.save, exact: true }),
      ).toBeDisabled();
      const sample = page.getByRole("button", {
        name: labels.sample,
        exact: true,
      });
      await expect(sample).toBeDisabled();
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
      await expect(sample).toBeEnabled();
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
