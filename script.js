const menuButton = document.querySelector(".menu-toggle");
const nav = document.querySelector(".site-nav");
const navLinks = document.querySelectorAll(".site-nav a");
const quoteForm = document.querySelector(".quote-form");
const formStatus = document.querySelector(".form-status");
const revealElements = document.querySelectorAll(".reveal-up");
const explodedScroll = document.querySelector(".exploded-scroll");
const explodedStage = document.querySelector(".exploded-stage");
let explodeTarget = 0;
let explodeCurrent = 0;
let explodeFrame = null;

menuButton?.addEventListener("click", () => {
  const isOpen = nav.classList.toggle("is-open");
  menuButton.setAttribute("aria-expanded", String(isOpen));
});

nav?.addEventListener("click", (event) => {
  if (event.target instanceof HTMLAnchorElement) {
    nav.classList.remove("is-open");
    menuButton?.setAttribute("aria-expanded", "false");
  }
});

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
      }
    });
  },
  { threshold: 0.12 },
);

revealElements.forEach((element) => revealObserver.observe(element));

const updateActiveNav = () => {
  let current = "domu";
  document.querySelectorAll("main section[id]").forEach((section) => {
    const top = section.getBoundingClientRect().top;
    if (top <= window.innerHeight * 0.36) {
      current = section.id;
    }
  });

  navLinks.forEach((link) => {
    const href = link.getAttribute("href") || "";
    link.classList.toggle("active", href === `#${current}` || href.endsWith(`#${current}`));
  });
};

const updateExplodedScroll = () => {
  if (!explodedScroll || !explodedStage) return;

  const rect = explodedScroll.getBoundingClientRect();
  const travel = Math.max(1, rect.height - window.innerHeight);
  const progress = Math.min(1, Math.max(0, -rect.top / travel));
  explodeTarget = progress * progress * (3 - 2 * progress);

  if (!explodeFrame) {
    explodeFrame = requestAnimationFrame(animateExplodedScroll);
  }
};

const animateExplodedScroll = () => {
  if (!explodedStage) {
    explodeFrame = null;
    return;
  }

  explodeCurrent += (explodeTarget - explodeCurrent) * 0.085;

  if (Math.abs(explodeTarget - explodeCurrent) < 0.001) {
    explodeCurrent = explodeTarget;
  }

  explodedStage.style.setProperty("--explode-progress", explodeCurrent.toFixed(4));

  if (explodeCurrent !== explodeTarget) {
    explodeFrame = requestAnimationFrame(animateExplodedScroll);
  } else {
    explodeFrame = null;
  }
};

window.addEventListener(
  "scroll",
  () => {
    updateActiveNav();
    updateExplodedScroll();
  },
  { passive: true },
);

window.addEventListener("resize", updateExplodedScroll);
updateActiveNav();
updateExplodedScroll();

quoteForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const submitButton = quoteForm.querySelector("button[type='submit']");
  const data = new FormData(quoteForm);
  const payload = Object.fromEntries(data.entries());

  formStatus.textContent = "Odesíláme poptávku...";
  formStatus.className = "form-status wide";
  submitButton.disabled = true;

  try {
    const response = await fetch(quoteForm.action || "/api/enquiry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result.ok) {
      throw new Error(result.message || "Poptávku se nepodařilo odeslat.");
    }

    quoteForm.reset();
    formStatus.textContent = "Děkujeme. Poptávka byla odeslána.";
    formStatus.className = "form-status wide success";
  } catch (error) {
    formStatus.textContent = error.message || "Poptávku se nepodařilo odeslat. Zkuste to prosím znovu.";
    formStatus.className = "form-status wide error";
  } finally {
    submitButton.disabled = false;
  }
});
