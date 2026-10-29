// Decorative basket beside the hero wordmark. A click slides it to the right
// behind the letter B and it stays hidden until the visitor leaves the home
// page or reloads. It is only a playful detail and never touches the real cart.
let stowed = false;

export function syncHeroBasket() {
  document.querySelector(".hero-basket")?.classList.toggle("is-stowed", stowed);
}

export function resetHeroBasket() {
  stowed = false;
  syncHeroBasket();
}

export async function stowHeroBasket(basket) {
  if (stowed) return;
  // Re-rendered baskets pick this up through syncHeroBasket straight away.
  stowed = true;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const width = basket.getBoundingClientRect().width;
  const frames = reduced
    ? [{ opacity: 1 }, { opacity: 0 }]
    : [
        // The artwork is rotated upright, so its local bottom edge faces the B.
        { translate: "0px 0px", clipPath: "inset(0 0 0% 0)" },
        { translate: `${width * 1.2}px 0px`, clipPath: "inset(0 0 100% 0)" },
      ];
  const animation = basket.animate(frames, {
    duration: reduced ? 180 : 900,
    easing: "cubic-bezier(.4,0,.2,1)",
    fill: "forwards",
  });
  try {
    await animation.finished;
  } catch {
    return;
  }
  if (!stowed) return;
  basket.classList.add("is-stowed");
  animation.cancel();
}

// A page restored from the back/forward cache starts with the basket in place.
window.addEventListener("pageshow", (event) => {
  if (event.persisted) resetHeroBasket();
});
