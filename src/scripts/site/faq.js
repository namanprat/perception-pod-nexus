import { gsap, prefersReducedMotion } from "./gsapRuntime.js";

export function initFaq() {
  document.querySelectorAll(".faq_list").forEach((list) => {
    if (list.dataset.scriptInitialized) return;
    list.dataset.scriptInitialized = "true";

    const items = Array.from(list.querySelectorAll(".faq_item"));
    let openItem = null;

    items.forEach((item) => {
      const head = item.querySelector(".faq_item_head");
      const panel = item.querySelector(".faq_item_panel");
      const icon = item.querySelector(".faq_item_icon");

      if (!head || !panel) return;

      if (prefersReducedMotion()) {
        head.addEventListener("click", () => toggleCss(item, items));
        return;
      }

      gsap.set(panel, { height: 0, overflow: "hidden", autoAlpha: 1 });

      const toggle = (event) => {
        event?.preventDefault?.();
        const isOpen = openItem === item;

        if (openItem && openItem !== item) {
          closeItem(openItem);
        }

        if (isOpen) {
          closeItem(item);
          openItem = null;
        } else {
          openItemPanel(item, icon, panel);
          openItem = item;
        }
      };

      head.addEventListener("click", toggle);
      head.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          toggle(event);
        }
      });
    });

    document.addEventListener("click", (event) => {
      if (!openItem) return;
      if (event.target.closest(".faq_item")) return;
      closeItem(openItem);
      openItem = null;
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && openItem) {
        closeItem(openItem);
        openItem = null;
      }
    });
  });
}

function openItemPanel(item, icon, panel) {
  const tl = gsap.timeline();

  if (icon) {
    tl.to(icon, { rotation: 45, duration: 0.4, ease: "power2.inOut" });
  }

  gsap.set(panel, { height: "auto" });
  const fullHeight = panel.offsetHeight;
  gsap.set(panel, { height: 0 });

  tl.to(
    panel,
    { height: fullHeight, duration: 0.6, ease: "power3.inOut" },
    icon ? "-=0.2" : 0,
  );
  tl.set(panel, { height: "auto" });

  item.classList.add("is-active");
  item.querySelector(".faq_item_head")?.setAttribute("aria-expanded", "true");
}

function closeItem(item) {
  const icon = item.querySelector(".faq_item_icon");
  const panel = item.querySelector(".faq_item_panel");
  if (!panel) return;

  const tl = gsap.timeline();
  const currentHeight = panel.offsetHeight;

  gsap.set(panel, { height: currentHeight });
  tl.to(panel, { height: 0, duration: 0.5, ease: "power3.in" });

  if (icon) {
    tl.to(icon, { rotation: 0, duration: 0.4, ease: "power2.out" }, "-=0.4");
  }

  item.classList.remove("is-active");
  item.querySelector(".faq_item_head")?.setAttribute("aria-expanded", "false");
}

function toggleCss(item, items) {
  const willOpen = !item.classList.contains("is-active");
  items.forEach((other) => {
    other.classList.toggle("is-active", other === item && willOpen);
    other
      .querySelector(".faq_item_head")
      ?.setAttribute(
        "aria-expanded",
        other === item && willOpen ? "true" : "false",
      );
  });
}
