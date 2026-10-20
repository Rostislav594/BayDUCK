const garments = [
  { id: "sneaker", label: "playSneaker" },
  { id: "hoodie", label: "playHoodie" },
  { id: "cap", label: "playCap" },
  { id: "socks", label: "playSocks" },
];

export function clothingMarkup(t) {
  return `<div class="playful-clothes" role="group" aria-label="${t("playClothes")}">
    ${garments.map(({ id, label }) => `<button type="button" class="clothing-toy clothing-toy--${id}" data-action="play-clothing" data-garment="${id}" aria-label="${t(label)}" title="${t(label)}"><img src="assets/playful/${id}-v1.png" alt="" width="160" height="160" draggable="false" decoding="async" /></button>`).join("")}
    <p class="clothing-hint">${t("playHint")} <span aria-hidden="true">↗</span></p>
  </div>`;
}

const motions = {
  sneaker: [
    { transform: "translateY(0) rotate(0) scale(1)", offset: 0 },
    {
      transform: "translateY(4px) rotate(-5deg) scale(1.1, .82)",
      offset: 0.15,
    },
    {
      transform: "translateY(-52px) rotate(-18deg) scale(.96, 1.05)",
      offset: 0.45,
    },
    { transform: "translateY(0) rotate(7deg) scale(1.12, .85)", offset: 0.7 },
    { transform: "translateY(-12px) rotate(-4deg) scale(1)", offset: 0.85 },
    { transform: "translateY(0) rotate(0) scale(1)", offset: 1 },
  ],
  hoodie: [
    { transform: "rotate(0) translateX(0)" },
    { transform: "rotate(-17deg) translateX(-6px)" },
    { transform: "rotate(16deg) translateX(6px) scale(1.05)" },
    { transform: "rotate(-11deg) translateX(-4px)" },
    { transform: "rotate(8deg) translateX(3px)" },
    { transform: "rotate(0) translateX(0)" },
  ],
  cap: [
    { transform: "translateY(0) rotate(0)" },
    { transform: "translateY(-12px) rotate(-22deg)", offset: 0.18 },
    { transform: "translateY(-24px) rotate(180deg) scale(1.08)", offset: 0.5 },
    { transform: "translateY(0) rotate(360deg)", offset: 1 },
  ],
  socks: [
    { transform: "rotate(0)" },
    { transform: "rotate(28deg)" },
    { transform: "rotate(-24deg)" },
    { transform: "rotate(18deg)" },
    { transform: "rotate(-10deg)" },
    { transform: "rotate(0)" },
  ],
};

const activeAnimations = new WeakMap();

export function animateClothing(button) {
  const image = button.querySelector("img");
  const frames = motions[button.dataset.garment];
  if (!image || !frames) return;
  activeAnimations.get(button)?.cancel();
  button.querySelectorAll(".clothing-pop").forEach((node) => node.remove());

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  button.classList.add("is-playing");
  if (!reduced) {
    for (const [index, [x, y]] of [
      [-35, -28],
      [35, -25],
      [-28, 26],
      [32, 28],
    ].entries()) {
      const star = document.createElement("span");
      star.className = "clothing-pop";
      star.textContent = index % 2 ? "✦" : "✧";
      star.setAttribute("aria-hidden", "true");
      star.style.setProperty("--pop-x", `${x}px`);
      star.style.setProperty("--pop-y", `${y}px`);
      star.addEventListener("animationend", () => star.remove(), {
        once: true,
      });
      button.append(star);
    }
  }
  const animation = image.animate(
    reduced ? [{ opacity: 1 }, { opacity: 0.65 }, { opacity: 1 }] : frames,
    {
      duration: reduced ? 180 : 950,
      easing: "cubic-bezier(.22,.61,.36,1)",
      iterations: 1,
    },
  );
  activeAnimations.set(button, animation);
  const cleanUp = () => {
    if (activeAnimations.get(button) !== animation) return;
    button.classList.remove("is-playing");
    button.querySelectorAll(".clothing-pop").forEach((node) => node.remove());
    activeAnimations.delete(button);
  };
  animation.finished.then(cleanUp, cleanUp);
}
