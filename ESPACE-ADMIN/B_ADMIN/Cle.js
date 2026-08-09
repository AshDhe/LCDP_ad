(() => {
  "use strict";

  const config = window.SITE_CONFIG || {};
  const ONGLET_SLOT_ID = "lcdp-cle-onglets-slot";
  const PAGE_CONNEXION = "/ESPACE-ADMIN/connexion-admin.html";

  const CONTEXTES = Object.freeze({
    parcs: {
      key: "parcs",
      label: "Parcs",
      resource: "cle-parcs",
      tableSlotId: "lcdp-cle-parcs-table-slot",
      editionSlotId: "lcdp-cle-parcs-edition-slot",
      actionsId: "lcdp-cle-parcs-actions",
      ajouterId: "lcdp-cle-parcs-ajouter",
      codeKey: "cle",
      codeLabel: "Clé",
      idKey: "idcleparc",
      path: "/cle-parc",
      optionPath: "/options/parcs",
      optionKey: "idparc",
      optionLabel: "Parc",
      boutonAjouter: "Ajouter une clé"
    },
    membres: {
      key: "membres",
      label: "Membres",
      resource: "cle-membres",
      tableSlotId: "lcdp-cle-membres-table-slot",
      editionSlotId: "lcdp-cle-membres-edition-slot",
      actionsId: "lcdp-cle-membres-actions",
      ajouterId: "lcdp-cle-membres-ajouter",
      codeKey: "brac",
      codeLabel: "Brac",
      idKey: "idclemembre",
      path: "/cle-membre",
      optionPath: "/options/membres",
      optionKey: "idmembre",
      optionLabel: "Membre",
      boutonAjouter: "Ajouter un Brac"
    }
  });

  let contexteEdition = null;
  let ligneEdition = null;
  let modeEdition = "";
  const cacheOptions = new Map();

  function urlAdmin(path) {
    return typeof window.LCDP_urlAdmin === "function"
      ? window.LCDP_urlAdmin(path)
      : path;
  }

  function urlPublic(path) {
    return typeof window.LCDP_urlPublic === "function"
      ? window.LCDP_urlPublic(path)
      : path;
  }

  function urlObjet(path) {
    return typeof window.LCDP_urlObjet === "function"
      ? window.LCDP_urlObjet(path)
      : path;
  }

  function endpointCleAdmin() {
    const configure =
      config.workerAdminCleUrl ||
      config.WORKER_ADMIN_CLE_URL ||
      window.ADMIN_CONFIG?.API_ADMIN_CLE ||
      "";

    if (configure) {
      return String(configure).replace(/\/+$/, "");
    }

    if (typeof config.apiUrl === "function") {
      const viaApi = config.apiUrl("admin-cle-api");

      if (viaApi) {
        return String(viaApi).replace(/\/+$/, "");
      }
    }

    return "https://admin-cle-api.lacleduparc.fr";
  }

  function appliquerRoutes(racine = document) {
    racine.querySelectorAll("[data-site-href]").forEach((element) => {
      const path = element.dataset.siteHref || "";
      const space = element.dataset.space || "public";

      element.setAttribute(
        "href",
        space === "admin" ? urlAdmin(path) : urlPublic(path)
      );
    });

    racine.querySelectorAll("[data-site-src]").forEach((element) => {
      const path = String(element.dataset.siteSrc || "")
        .replace(/^\/?OBJET\/?/, "/");

      element.setAttribute("src", urlObjet(path));
    });
  }

  async function chargerFragment(url, libelle) {
    const response = await fetch(url, {
      method: "GET",
      credentials: "omit",
      cache: "no-cache"
    });

    if (!response.ok) {
      throw new Error(libelle + " introuvable.");
    }

    const template = document.createElement("template");
    template.innerHTML = (await response.text()).trim();

    return template.content.cloneNode(true);
  }

  function chargerFragmentAdmin(path) {
    return chargerFragment(
      urlAdmin(path),
      "Fragment ADMIN " + path
    );
  }

  function chargerFragmentObjet(path) {
    return chargerFragment(
      urlObjet(path),
      "Fragment OBJET " + path
    );
  }

  function chargerScriptUneFois(src, attribut, valeur) {
    if (document.querySelector(`script[${attribut}="${valeur}"]`)) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.defer = true;
      script.setAttribute(attribut, valeur);
      script.onload = resolve;
      script.onerror = () => reject(
        new Error("Script introuvable : " + valeur)
      );
      document.body.appendChild(script);
    });
  }

  function chargerScriptAdminUneFois(path) {
    return chargerScriptUneFois(
      urlAdmin(path),
      "data-lcdp-script-admin",
      path
    );
  }

  function chargerScriptObjetUneFois(path) {
    return chargerScriptUneFois(
      urlObjet(path),
      "data-lcdp-script-objet",
      path
    );
  }

  async function initialiserBandeau() {
    const slot = document.getElementById("lcdp-bandeau-slot");

    if (!slot) return;

    slot.innerHTML = "";
    slot.appendChild(
      await chargerFragmentAdmin(
        "/ESPACE-ADMIN/A_STRUCTURE/box-bandeau-nav-admin.html"
      )
    );
    appliquerRoutes(slot);
  }

  async function initialiserMenuGauche() {
    const moduleMenu = window.LCDP_MENU_GAUCHE_ADMIN;

    if (!moduleMenu || typeof moduleMenu.initialiser !== "function") {
      throw new Error("Menu gauche admin centralisé indisponible.");
    }

    await moduleMenu.initialiser({
      slotId: "lcdp-menu-gauche-admin-slot",
      categorieActive: "admin"
    });
  }

  async function initialiserWraperOnglets() {
    const slot = document.getElementById(ONGLET_SLOT_ID);

    if (!slot) {
      throw new Error("Slot des onglets Clé introuvable.");
    }

    slot.innerHTML = "";
    slot.appendChild(
      await chargerFragmentObjet("/BOX/05-wraper-onglets.html")
    );

    const racine = slot.querySelector("[data-lcdp-wraper-onglets]");

    if (!racine) {
      throw new Error("Objet onglets introuvable.");
    }

    configurerOnglets(racine);
    initialiserNavigationOnglets(racine);
    preparerContenuOnglets(racine);

    return racine;
  }

  function configurerOnglets(racine) {
    const boutons = Array.from(
      racine.querySelectorAll("[data-lcdp-onglet]")
    );
    const panneaux = Array.from(
      racine.querySelectorAll("[data-lcdp-panneau-onglet]")
    );

    if (boutons.length < 2 || panneaux.length < 2) {
      throw new Error("Structure des onglets incomplète.");
    }

    racine.setAttribute("aria-label", "Administration des clés");
    racine.querySelector("[data-lcdp-wraper-onglets-navigation]")
      ?.setAttribute("aria-label", "Administration des clés");

    configurerOnglet(
      boutons[0],
      panneaux[0],
      "parcs",
      "Parcs",
      true
    );

    configurerOnglet(
      boutons[1],
      panneaux[1],
      "membres",
      "Membres",
      false
    );
  }

  function configurerOnglet(bouton, panneau, key, label, actif) {
    const idBouton = "lcdp-cle-tab-" + key;
    const idPanneau = "lcdp-cle-onglet-" + key;
    const contenu = panneau.querySelector("[data-lcdp-contenu-onglet]");

    bouton.id = idBouton;
    bouton.textContent = label;
    bouton.dataset.lcdpOnglet = key;
    bouton.setAttribute("aria-controls", idPanneau);
    bouton.setAttribute("aria-selected", String(actif));
    bouton.tabIndex = actif ? 0 : -1;

    panneau.id = idPanneau;
    panneau.dataset.lcdpPanneauOnglet = key;
    panneau.setAttribute("aria-labelledby", idBouton);
    panneau.hidden = !actif;

    if (contenu) {
      contenu.dataset.lcdpContenuOnglet = key;
    }
  }

  function initialiserNavigationOnglets(racine) {
    const boutons = Array.from(
      racine.querySelectorAll("[data-lcdp-onglet]")
    );
    const panneaux = Array.from(
      racine.querySelectorAll("[data-lcdp-panneau-onglet]")
    );

    boutons.forEach((bouton) => {
      bouton.addEventListener("click", () => {
        activerOnglet(
          bouton.dataset.lcdpOnglet,
          boutons,
          panneaux
        );
      });

      bouton.addEventListener("keydown", (event) => {
        if (!["ArrowLeft", "ArrowRight"].includes(event.key)) {
          return;
        }

        event.preventDefault();

        const index = boutons.indexOf(bouton);
        const direction = event.key === "ArrowRight" ? 1 : -1;
        const prochain = boutons[
          (index + direction + boutons.length) % boutons.length
        ];

        prochain.click();
        prochain.focus();
      });
    });
  }

  function activerOnglet(nom, boutons, panneaux) {
    boutons.forEach((bouton) => {
      const actif = bouton.dataset.lcdpOnglet === nom;
      bouton.setAttribute("aria-selected", String(actif));
      bouton.tabIndex = actif ? 0 : -1;
    });

    panneaux.forEach((panneau) => {
      panneau.hidden =
        panneau.dataset.lcdpPanneauOnglet !== nom;
    });
  }

  function preparerContenuOnglets(racine) {
    Object.values(CONTEXTES).forEach((contexte) => {
      const zone = racine.querySelector(
        `[data-lcdp-contenu-onglet="${contexte.key}"]`
      );

      if (!zone) {
        throw new Error(
          "Zone de contenu introuvable : " + contexte.key
        );
      }

      zone.innerHTML = "";

      const actions = document.createElement("div");
      actions.id = contexte.actionsId;
      actions.className = "lcdp-cle-admin__barre-actions";

      const ajouter = document.createElement("button");
      ajouter.type = "button";
      ajouter.className = "lcdp-button lcdp-button-orange";
      ajouter.id = contexte.ajouterId;
      ajouter.textContent = contexte.boutonAjouter;
      ajouter.addEventListener("click", () => {
        ouvrirCreation(contexte).catch(gererErreurPage);
      });

      const tableSlot = document.createElement("div");
      tableSlot.id = contexte.tableSlotId;
      tableSlot.className = "lcdp-cle-admin__table";

      const editionSlot = document.createElement("div");
      editionSlot.id = contexte.editionSlotId;
      editionSlot.className = "lcdp-cle-admin__edition";
      editionSlot.hidden = true;

      actions.appendChild(ajouter);
      zone.appendChild(actions);
      zone.appendChild(tableSlot);
      zone.appendChild(editionSlot);
    });
  }

  async function initialiserTables() {
    await chargerScriptAdminUneFois(
      "/ESPACE-ADMIN/A_STRUCTURE/table-lecture-admin.js"
    );

    const table = window.LCDP_TABLE_LECTURE_ADMIN;

    if (!table || typeof table.initialiser !== "function") {
      throw new Error("Objet table lecture admin indisponible.");
    }

    for (const contexte of Object.values(CONTEXTES)) {
      const slot = document.getElementById(contexte.tableSlotId);

      if (!slot) {
        throw new Error(
          "Slot de table introuvable : " + contexte.tableSlotId
        );
      }

      slot.innerHTML = "";
      slot.appendChild(
        await chargerFragmentAdmin(
          "/ESPACE-ADMIN/A_STRUCTURE/table-lecture-admin.html"
        )
      );

      await table.initialiser({
        slotId: contexte.tableSlotId,
        endpoint: endpointCleAdmin(),
        resource: contexte.resource,
        pageSize: 100,
        initialSortKey: contexte.key === "parcs" ? "dptmt" : "nom",
        initialSortDirection: "asc",
        interactiveColumns: [contexte.codeKey],
        interactiveLabel: "Modifier " + contexte.codeLabel,
        interactiveLabels: {
          [contexte.codeKey]:
            "Modifier ou supprimer " + contexte.codeLabel
        },
        onCellActivate: ({ row }) => {
          return ouvrirEdition(contexte, row);
        }
      });
    }
  }

  async function appelerCle(path, options = {}) {
    const endpoint = endpointCleAdmin();

    if (!endpoint) {
      throw new Error("Endpoint admin-cle-api non configuré.");
    }

    let response;

    try {
      response = await fetch(endpoint + path, {
        method: options.method || "GET",
        credentials: "include",
        cache: "no-store",
        headers: {
          Accept: "application/json",
          ...(options.body !== undefined
            ? { "Content-Type": "application/json" }
            : {})
        },
        body: options.body !== undefined
          ? JSON.stringify(options.body)
          : undefined
      });
    } catch (_) {
      throw new Error(
        "Impossible de joindre admin-cle-api.lacleduparc.fr."
      );
    }

    const data = await response.json().catch(() => null);

    if (response.status === 401) {
      redirigerConnexion();
      throw new Error("Session administrateur expirée.");
    }

    if (response.status === 403) {
      throw new Error(
        data?.message || "Permission administrateur insuffisante."
      );
    }

    if (!response.ok || !data || data.success !== true) {
      throw new Error(
        data?.message ||
        data?.detail ||
        "Réponse du worker Clé inexploitable."
      );
    }

    return data;
  }

  async function ouvrirCreation(contexte) {
    contexteEdition = contexte;
    ligneEdition = null;
    modeEdition = "create";

    afficherZoneEdition(contexte);

    try {
      const options = await chargerOptions(contexte);
      await rendreFormulaire(contexte, construireLigneVide(contexte), options);
    } catch (error) {
      afficherErreurEdition(contexte, error);
    }
  }

  async function ouvrirEdition(contexte, row) {
    const identifiant = String(row?.[contexte.idKey] || "").trim();

    if (!identifiant) {
      throw new Error("Identifiant absent.");
    }

    contexteEdition = contexte;
    ligneEdition = null;
    modeEdition = "update";

    afficherZoneEdition(contexte, "Chargement…");

    try {
      const [data, options] = await Promise.all([
        appelerCle(
          contexte.path +
          "?" +
          encodeURIComponent(contexte.idKey) +
          "=" +
          encodeURIComponent(identifiant)
        ),
        chargerOptions(contexte)
      ]);

      ligneEdition = data.item || null;

      if (!ligneEdition) {
        throw new Error("Entrée introuvable.");
      }

      await rendreFormulaire(contexte, ligneEdition, options);
    } catch (error) {
      afficherErreurEdition(contexte, error);
    }
  }

  function construireLigneVide(contexte) {
    if (contexte.key === "parcs") {
      return {
        idparc: "",
        cle: "",
        active: false,
        instal: "",
        datemaj: ""
      };
    }

    return {
      idmembre: "",
      brac: "",
      actif: false,
      date: "",
      datemaj: ""
    };
  }

  async function chargerOptions(contexte) {
    if (cacheOptions.has(contexte.key)) {
      return cacheOptions.get(contexte.key);
    }

    const data = await appelerCle(contexte.optionPath);
    const options = Array.isArray(data.options)
      ? data.options
      : [];

    cacheOptions.set(contexte.key, options);
    return options;
  }

  function afficherZoneEdition(contexte, message = "") {
    const tableSlot = document.getElementById(contexte.tableSlotId);
    const editionSlot = document.getElementById(contexte.editionSlotId);
    const actions = document.getElementById(contexte.actionsId);

    tableSlot.hidden = true;
    actions.hidden = true;
    editionSlot.hidden = false;
    editionSlot.innerHTML = "";

    if (message) {
      const p = document.createElement("p");
      p.className = "lcdp-cle-admin__chargement";
      p.textContent = message;
      editionSlot.appendChild(p);
    }
  }

  function afficherErreurEdition(contexte, error) {
    const editionSlot = document.getElementById(contexte.editionSlotId);

    editionSlot.innerHTML = "";

    const message = document.createElement("p");
    message.className = "lcdp-cle-admin__chargement";
    message.textContent = String(
      error?.message || error || "Erreur de chargement."
    );

    const retour = document.createElement("button");
    retour.type = "button";
    retour.className = "lcdp-button lcdp-button-secondary";
    retour.textContent = "Retour à la liste";
    retour.addEventListener("click", () => fermerEdition(contexte));

    editionSlot.appendChild(message);
    editionSlot.appendChild(retour);
  }

  async function rendreFormulaire(contexte, item, options) {
    await chargerScriptObjetUneFois("/BOX/03-box-formulaire.js");

    if (typeof window.LCDP_creerFormulaire !== "function") {
      throw new Error("Objet formulaire indisponible.");
    }

    const boutons = [
      {
        id: "lcdp-cle-enregistrer",
        type: "submit",
        style: "lcdp-button-orange",
        label: modeEdition === "create"
          ? "Ajouter"
          : "Enregistrer"
      }
    ];

    if (modeEdition === "update") {
      boutons.push({
        id: "lcdp-cle-supprimer",
        type: "button",
        style: "lcdp-button-orange",
        label: "Supprimer"
      });
    }

    boutons.push({
      id: "lcdp-cle-retour",
      type: "button",
      style: "lcdp-button-secondary",
      label: "Retour à la liste"
    });

    const form = await window.LCDP_creerFormulaire(
      contexte.editionSlotId,
      {
        id: "lcdp-cle-form",
        ariaLabel:
          (modeEdition === "create" ? "Ajouter " : "Modifier ") +
          contexte.codeLabel,
        titre:
          modeEdition === "create"
            ? contexte.boutonAjouter
            : "Modifier " + contexte.codeLabel,
        sousTitre:
          modeEdition === "update"
            ? String(item?.[contexte.codeKey] || "")
            : "",
        validationNative: true,
        champs: construireChamps(contexte, item, options),
        boutons,
        noteHtml: ""
      }
    );

    if (!form) {
      throw new Error("Formulaire Clé non créé.");
    }

    form.addEventListener("submit", enregistrer);
    form.querySelector("#lcdp-cle-retour")
      ?.addEventListener(
        "click",
        () => fermerEdition(contexte)
      );
    form.querySelector("#lcdp-cle-supprimer")
      ?.addEventListener(
        "click",
        supprimer
      );

    document.getElementById(contexte.editionSlotId)
      ?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
  }

  function construireChamps(contexte, item, options) {
    const optionsSelect = [
      { value: "", label: "Sélectionner" },
      ...options.map((option) => ({
        value: String(option.value || ""),
        label: String(option.label || "")
      }))
    ];

    if (contexte.key === "parcs") {
      return [
        {
          name: "idparc",
          label: "Parc",
          type: "select",
          value: item?.idparc || "",
          options: optionsSelect,
          required: true,
          validationNative: true
        },
        {
          name: "cle",
          label: "Clé",
          type: "text",
          value: item?.cle || "",
          required: true,
          validationNative: true,
          maxlength: 100
        },
        {
          name: "active",
          label: "Active",
          type: "checkbox",
          checked: item?.active === true,
          checkboxLabel: "Clé active"
        },
        {
          name: "instal",
          label: "Instal",
          type: "date",
          value: item?.instal || "",
          required: true,
          validationNative: true
        }
      ];
    }

    return [
      {
        name: "idmembre",
        label: "Membre",
        type: "select",
        value: item?.idmembre || "",
        options: optionsSelect,
        required: true,
        validationNative: true
      },
      {
        name: "brac",
        label: "Brac",
        type: "text",
        value: item?.brac || "",
        required: true,
        validationNative: true,
        maxlength: 100
      },
      {
        name: "actif",
        label: "Actif",
        type: "checkbox",
        checked: item?.actif === true,
        checkboxLabel: "Brac actif"
      },
      {
        name: "date",
        label: "Date",
        type: "date",
        value: item?.date || "",
        required: true,
        validationNative: true
      }
    ];
  }

  async function enregistrer(event) {
    event.preventDefault();

    const form = event.currentTarget;

    if (!form.reportValidity() || !contexteEdition) {
      return;
    }

    const boutonEnregistrer =
      form.querySelector("#lcdp-cle-enregistrer");
    const boutonRetour =
      form.querySelector("#lcdp-cle-retour");
    const boutonSupprimer =
      form.querySelector("#lcdp-cle-supprimer");
    const note =
      form.querySelector("[data-lcdp-formulaire-note]");

    const item = lireValeursFormulaire(
      contexteEdition,
      form
    );

    verrouillerBoutons(
      boutonEnregistrer,
      boutonRetour,
      boutonSupprimer,
      true
    );
    afficherNote(note, "Enregistrement en cours…", "");

    try {
      const data = await appelerCle(
        contexteEdition.path,
        {
          method: modeEdition === "create" ? "POST" : "PATCH",
          body: {
            item,
            ...(modeEdition === "update"
              ? {
                  [contexteEdition.idKey]:
                    ligneEdition?.[contexteEdition.idKey],
                  originalDatemaj:
                    ligneEdition?.datemaj || ""
                }
              : {})
          }
        }
      );

      await afficherAlerte(
        data.message ||
        (modeEdition === "create"
          ? "Entrée ajoutée."
          : "Entrée modifiée.")
      );

      await fermerEdition(contexteEdition, true);
    } catch (error) {
      verrouillerBoutons(
        boutonEnregistrer,
        boutonRetour,
        boutonSupprimer,
        false
      );

      const message = String(
        error?.message || error || "Erreur d'enregistrement."
      );

      afficherNote(note, message, "error");
      await afficherAlerte(message);
    }
  }

  function lireValeursFormulaire(contexte, form) {
    if (contexte.key === "parcs") {
      return {
        idparc: String(
          form.elements.namedItem("idparc")?.value || ""
        ).trim(),
        cle: String(
          form.elements.namedItem("cle")?.value || ""
        ).trim(),
        active:
          form.elements.namedItem("active")?.checked === true,
        instal: String(
          form.elements.namedItem("instal")?.value || ""
        ).trim()
      };
    }

    return {
      idmembre: String(
        form.elements.namedItem("idmembre")?.value || ""
      ).trim(),
      brac: String(
        form.elements.namedItem("brac")?.value || ""
      ).trim(),
      actif:
        form.elements.namedItem("actif")?.checked === true,
      date: String(
        form.elements.namedItem("date")?.value || ""
      ).trim()
    };
  }

  async function supprimer() {
    if (
      !contexteEdition ||
      !ligneEdition?.[contexteEdition.idKey] ||
      modeEdition !== "update"
    ) {
      return;
    }

    const confirme = await demanderConfirmationSuppression(
      contexteEdition.codeLabel
    );

    if (!confirme) {
      return;
    }

    const form = document.getElementById("lcdp-cle-form");
    const boutons = form
      ? Array.from(form.querySelectorAll("button"))
      : [];

    boutons.forEach((bouton) => {
      bouton.disabled = true;
    });

    try {
      const query =
        "?" +
        encodeURIComponent(contexteEdition.idKey) +
        "=" +
        encodeURIComponent(
          ligneEdition[contexteEdition.idKey]
        );

      const data = await appelerCle(
        contexteEdition.path + query,
        {
          method: "DELETE",
          body: {
            originalDatemaj:
              ligneEdition?.datemaj || ""
          }
        }
      );

      await afficherAlerte(
        data.message || "Entrée supprimée."
      );
      await fermerEdition(contexteEdition, true);
    } catch (error) {
      boutons.forEach((bouton) => {
        bouton.disabled = false;
      });

      await afficherAlerte(
        String(
          error?.message ||
          error ||
          "Erreur de suppression."
        )
      );
    }
  }

  async function fermerEdition(contexte, recharger = false) {
    const tableSlot = document.getElementById(contexte.tableSlotId);
    const editionSlot = document.getElementById(contexte.editionSlotId);
    const actions = document.getElementById(contexte.actionsId);

    editionSlot.innerHTML = "";
    editionSlot.hidden = true;
    tableSlot.hidden = false;
    actions.hidden = false;

    contexteEdition = null;
    ligneEdition = null;
    modeEdition = "";

    if (recharger) {
      await window.LCDP_TABLE_LECTURE_ADMIN
        ?.recharger(contexte.tableSlotId);
    }

    tableSlot.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  function verrouillerBoutons(
    enregistrer,
    retour,
    supprimer,
    verrouille
  ) {
    if (enregistrer) enregistrer.disabled = verrouille;
    if (retour) retour.disabled = verrouille;
    if (supprimer) supprimer.disabled = verrouille;
  }

  function afficherNote(note, texte, etat) {
    if (!note) return;

    note.textContent = texte;
    note.hidden = !texte;
    note.dataset.state = etat || "";
  }

  async function afficherAlerte(message) {
    const slot = document.getElementById("lcdp-lightbox-slot");

    if (!slot) {
      window.alert(message || "");
      return true;
    }

    slot.innerHTML = "";
    slot.appendChild(
      await chargerFragmentObjet("/BOX/02-box-alerte.html")
    );

    const alerte = slot.querySelector("[data-lcdp-box-alerte]");
    const texte = slot.querySelector("[data-lcdp-alerte-message]");
    const fermer = slot.querySelector("[data-lcdp-alerte-close]");
    const ok = slot.querySelector("[data-lcdp-alerte-ok]");

    if (!alerte || !texte || !ok) {
      slot.innerHTML = "";
      window.alert(message || "");
      return true;
    }

    texte.textContent = message || "";

    return new Promise((resolve) => {
      let termine = false;

      function terminer() {
        if (termine) return;
        termine = true;
        slot.innerHTML = "";
        resolve(true);
      }

      fermer?.addEventListener("click", terminer, { once: true });
      ok.addEventListener("click", terminer, { once: true });
      alerte.addEventListener("click", (event) => {
        if (event.target === alerte) terminer();
      });
    });
  }

  async function demanderConfirmationSuppression(libelle) {
    const slot = document.getElementById("lcdp-lightbox-slot");

    if (!slot) {
      return window.confirm("Supprimer définitivement " + libelle + " ?");
    }

    slot.innerHTML = "";
    slot.appendChild(
      await chargerFragmentObjet("/BOX/02-box-dialogue-bouton.html")
    );

    const dialogue = slot.querySelector(
      "[data-lcdp-box-dialogue-bouton]"
    );
    const titre = slot.querySelector("[data-lcdp-dialogue-title]");
    const texte = slot.querySelector("[data-lcdp-dialogue-text]");
    const actions = slot.querySelector("[data-lcdp-dialogue-actions]");
    const fermer = slot.querySelector("[data-lcdp-dialogue-close]");

    if (!dialogue || !titre || !texte || !actions) {
      slot.innerHTML = "";
      return window.confirm("Supprimer définitivement " + libelle + " ?");
    }

    titre.textContent = "Supprimer " + libelle;
    texte.textContent = "Cette suppression est définitive.";

    const annuler = document.createElement("button");
    annuler.type = "button";
    annuler.className = "lcdp-button lcdp-button-secondary";
    annuler.textContent = "Annuler";

    const confirmer = document.createElement("button");
    confirmer.type = "button";
    confirmer.className = "lcdp-button lcdp-button-orange";
    confirmer.textContent = "Supprimer";

    actions.appendChild(annuler);
    actions.appendChild(confirmer);

    return new Promise((resolve) => {
      let termine = false;

      function terminer(valeur) {
        if (termine) return;
        termine = true;
        slot.innerHTML = "";
        resolve(valeur);
      }

      annuler.addEventListener(
        "click",
        () => terminer(false),
        { once: true }
      );
      confirmer.addEventListener(
        "click",
        () => terminer(true),
        { once: true }
      );
      fermer?.addEventListener(
        "click",
        () => terminer(false),
        { once: true }
      );
      dialogue.addEventListener("click", (event) => {
        if (event.target === dialogue) {
          terminer(false);
        }
      });
    });
  }

  function gererErreurPage(error) {
    console.error("Erreur page Clé admin :", error);
    afficherAlerte(
      String(error?.message || error || "Erreur.")
    ).catch(() => {});
  }

  function redirigerConnexion() {
    if (typeof config.adminUrl === "function") {
      window.location.replace(
        config.adminUrl(PAGE_CONNEXION)
      );
      return;
    }

    window.location.replace(urlAdmin(PAGE_CONNEXION));
  }

  async function verifierAcces() {
    const guard = window.LCDP_GUARD_ADMIN;

    if (
      !guard ||
      typeof guard.verifierAccesPageAdmin !== "function"
    ) {
      throw new Error("Garde admin centralisé indisponible.");
    }

    return guard.verifierAccesPageAdmin();
  }

  async function initialiserPage() {
    const autorise = await verifierAcces();

    if (!autorise) return;

    await Promise.all([
      initialiserBandeau(),
      initialiserMenuGauche()
    ]);

    await initialiserWraperOnglets();
    await initialiserTables();

    const main = document.getElementById("lcdp-main-admin");

    if (main) {
      main.hidden = false;
    }
  }

  initialiserPage().catch(gererErreurPage);
})();
