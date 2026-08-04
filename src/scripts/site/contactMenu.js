import { gsap, getLenis, prefersReducedMotion } from "./gsapRuntime.js";

export function initContactMenu() {
  const contactWrap = document.querySelector(".contact_wrap");
  const contactPanel = document.querySelector(".contact_panel");
  const contactClose = document.querySelector(".contact_close");
  const form = document.querySelector(".contact_form");
  const openTriggers = Array.from(
    document.querySelectorAll("[data-contact-open]")
  );

  if (!contactWrap || !contactPanel || openTriggers.length === 0 || !contactClose) {
    return () => {};
  }

  if (contactWrap.dataset.scriptInitialized) return () => {};
  contactWrap.dataset.scriptInitialized = "true";

  const listeners = [];
  let isOpen = false;

  const lockScroll = () => getLenis()?.stop();
  const unlockScroll = () => getLenis()?.start();

  const setOpenState = (open) => {
    isOpen = open;
    contactWrap.classList.toggle("is-open", open);
    contactWrap.setAttribute("aria-hidden", open ? "false" : "true");
    if (open) {
      lockScroll();
      contactClose.focus({ preventScroll: true });
    } else {
      unlockScroll();
    }
  };

  gsap.set(contactWrap, { autoAlpha: 0 });
  gsap.set(contactPanel, { y: 24, opacity: 0 });

  const reduced = prefersReducedMotion();
  const openTl = gsap.timeline({
    paused: true,
    onReverseComplete: () => setOpenState(false),
  });

  if (reduced) {
    openTl
      .set(contactWrap, { autoAlpha: 1 })
      .set(contactPanel, { y: 0, opacity: 1 });
  } else {
    openTl
      .to(contactWrap, { autoAlpha: 1, duration: 0.35, ease: "power2.out" })
      .to(
        contactPanel,
        { y: 0, opacity: 1, duration: 0.5, ease: "power3.out" },
        "<0.05"
      );
  }

  const addListener = (element, eventName, handler) => {
    element.addEventListener(eventName, handler);
    listeners.push(() => element.removeEventListener(eventName, handler));
  };

  const open = (event) => {
    event?.preventDefault?.();
    if (isOpen && openTl.progress() === 1) return;
    setOpenState(true);
    openTl.play(0);
  };

  const close = (event) => {
    event?.preventDefault?.();
    if (!isOpen && openTl.progress() === 0) return;
    openTl.reverse();
  };

  openTriggers.forEach((trigger) => {
    addListener(trigger, "click", open);
  });

  addListener(contactClose, "click", close);

  addListener(contactWrap, "click", (event) => {
    if (event.target === contactWrap) close(event);
  });

  if (form) {
    addListener(form, "submit", (event) => {
      event.preventDefault();
      const success = form.querySelector(".contact_success");
      if (success) {
        success.classList.add("is-visible");
      }
    });
  }

  addListener(document, "keydown", (event) => {
    if (event.key === "Escape" && isOpen) close();
  });

  return () => {
    listeners.splice(0).forEach((cleanup) => cleanup());
    unlockScroll();
  };
}
