(() => {
  const contentEl = document.getElementById("content");
  const payloadEl = document.getElementById("viewer-data");
  const decoder = new TextDecoder();

  function getMode() {
    return localStorage.getItem("mdv-theme") || "auto";
  }

  function getEffectiveTheme() {
    const mode = getMode();
    if (mode === "dark" || mode === "light") return mode;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function updateToggleButton() {
    const btn = document.querySelector(".theme-toggle");
    if (!btn) return;
    const mode = getMode();
    if (mode === "auto") {
      btn.textContent = "\u25D1";
      btn.setAttribute("aria-label", "Theme: auto (system) \u2014 click to switch to light");
    } else if (mode === "light") {
      btn.textContent = "\u2600";
      btn.setAttribute("aria-label", "Theme: light \u2014 click to switch to dark");
    } else {
      btn.textContent = "\u263E";
      btn.setAttribute("aria-label", "Theme: dark \u2014 click to switch to auto");
    }
  }

  function applyMode(mode) {
    if (mode === "auto") {
      document.documentElement.removeAttribute("data-theme");
      localStorage.removeItem("mdv-theme");
    } else {
      document.documentElement.setAttribute("data-theme", mode);
      localStorage.setItem("mdv-theme", mode);
    }
    updateToggleButton();
  }

  function toggleTheme() {
    const mode = getMode();
    if (mode === "auto") applyMode("light");
    else if (mode === "light") applyMode("dark");
    else applyMode("auto");
  }

  window.toggleTheme = toggleTheme;

  function initTheme() {
    const saved = localStorage.getItem("mdv-theme");
    if (saved === "dark" || saved === "light") {
      document.documentElement.setAttribute("data-theme", saved);
    }

    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () {
      if (getMode() === "auto") updateToggleButton();
    });
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
