(() => {
  const contentEl = document.getElementById("content");
  const payloadEl = document.getElementById("viewer-data");
  const decoder = new TextDecoder();

  function getEffectiveTheme() {
    const explicit = document.documentElement.getAttribute("data-theme");
    if (explicit) return explicit;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function updateToggleButton() {
    const btn = document.querySelector(".theme-toggle");
    if (!btn) return;
    const isDark = getEffectiveTheme() === "dark";
    btn.textContent = isDark ? "\u2600" : "\u263E";
    btn.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("mdv-theme", theme);
    updateToggleButton();
  }

  function toggleTheme() {
    var newTheme = getEffectiveTheme() === "dark" ? "light" : "dark";
    applyTheme(newTheme);
  }

  window.toggleTheme = toggleTheme;

  function initTheme() {
    const saved = localStorage.getItem("mdv-theme");
    if (saved === "dark" || saved === "light") {
      document.documentElement.setAttribute("data-theme", saved);
    }
  }

  function createToggleButton() {
    const btn = document.createElement("button");
    btn.className = "theme-toggle";
    btn.addEventListener("click", toggleTheme);
    document.body.appendChild(btn);
    updateToggleButton();
  }

  function setError(message) {
    contentEl.innerHTML = "";
    const errorEl = document.createElement("p");
    errorEl.className = "document__error";
    errorEl.textContent = message;
    contentEl.appendChild(errorEl);
  }

  function decodeBase64Utf8(value) {
    const binary = window.atob(value || "");
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    return decoder.decode(bytes);
  }

  function applyBaseUrl(baseUrl) {
    if (!baseUrl) {
      return;
    }

    let baseEl = document.querySelector("base");
    if (!baseEl) {
      baseEl = document.createElement("base");
      document.head.prepend(baseEl);
    }

    baseEl.href = baseUrl;
  }

  function finalizeLinks(root) {
    const anchors = root.querySelectorAll("a[href]");

    for (const anchor of anchors) {
      const href = anchor.getAttribute("href") || "";

      if (/^https?:\/\//i.test(href)) {
        anchor.setAttribute("target", "_blank");
        anchor.setAttribute("rel", "noopener noreferrer");
      }
    }
  }

  function finalizeImages(root) {
    const images = root.querySelectorAll("img");

    for (const image of images) {
      image.loading = "lazy";
      image.decoding = "async";
    }
  }

  function disableTaskCheckboxes(root) {
    const checkboxes = root.querySelectorAll('input[type="checkbox"]');

    for (const checkbox of checkboxes) {
      checkbox.disabled = true;
    }
  }

  initTheme();

  if (!payloadEl) {
    setError("Preview data is missing.");
    createToggleButton();
    return;
  }

  if (!window.marked || !window.DOMPurify) {
    setError("Renderer assets failed to load.");
    createToggleButton();
    return;
  }

  let payload;

  try {
    const rawPayload = JSON.parse(payloadEl.textContent || "{}");

    payload = {
      filename: decodeBase64Utf8(rawPayload.filename),
      sourcePath: decodeBase64Utf8(rawPayload.sourcePath),
      baseUrl: decodeBase64Utf8(rawPayload.baseUrl),
      markdown: decodeBase64Utf8(rawPayload.markdown),
    };
  } catch (error) {
    console.error(error);
    setError("Preview data could not be decoded.");
    createToggleButton();
    return;
  }

  applyBaseUrl(payload.baseUrl);

  document.title = payload.filename || document.title;

  try {
    const renderedHtml = window.marked.parse(payload.markdown || "", {
      gfm: true,
      breaks: true,
    });

    const sanitizedHtml = window.DOMPurify.sanitize(renderedHtml, {
      USE_PROFILES: { html: true },
      ALLOW_UNKNOWN_PROTOCOLS: false,
      FORBID_TAGS: ["script", "style"],
    });

    contentEl.innerHTML = sanitizedHtml || "<p></p>";
    disableTaskCheckboxes(contentEl);
    finalizeLinks(contentEl);
    finalizeImages(contentEl);

    const firstHeading = contentEl.querySelector("h1");
    if (firstHeading && firstHeading.textContent.trim()) {
      document.title = firstHeading.textContent.trim();
    }
  } catch (error) {
    console.error(error);
    setError("Markdown preview failed to render.");
  }

  createToggleButton();
})();
