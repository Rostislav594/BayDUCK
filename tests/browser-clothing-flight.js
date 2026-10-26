// Run with Playwright MCP browser_run_code_unsafe filename, with npm run dev active.
async (browserPage) => {
  const context = await browserPage.context().browser().newContext();
  try {
    const page = await context.newPage();
    const results = [], errors = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    const check = (condition, name) => { if (!condition) throw new Error(name); results.push(name); };
    const garment = id => page.locator(`[data-garment="${id}"]`);
    const idle = () => page.waitForFunction(() => !document.querySelector(".clothing-flight-layer") && !document.querySelector("[data-flight-state]"));
    await page.goto("http://127.0.0.1:5173/#home");
    await page.emulateMedia({ reducedMotion: "no-preference" });
    const scale = page.viewportSize().width / await page.evaluate(() => innerWidth);
    const viewport = async width => {
      await page.setViewportSize({ width: Math.round(width * scale), height: Math.round(950 * scale) });
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      check(Math.abs(await page.evaluate(() => innerWidth) - width) <= 1, `CSS viewport ${width}px`);
    };
    // The basket copy stays upright and still; the artwork shrinks only during a
    // vertical drop, and only items starting below the basket fly a full loop.
    const flightShape = () => {
      const layer=document.querySelector(".clothing-flight-layer");
      const item=layer.querySelector(".clothing-flight-item"), basket=layer.querySelector(".clothing-flight-basket");
      const path=item.getAnimations()[0].effect.getKeyframes().map(f=>{const [x,y=0]=f.translate.split(" ").map(parseFloat);return {x,y,scale:Number(f.scale),rotate:parseFloat(f.rotate)};});
      const last=path.at(-1), shrinking=path.filter(p=>p.scale<1);
      const vertical=shrinking.length>2 && shrinking.every((p,i)=>Math.abs(p.x-last.x)<.05 && (i===0 || p.y>=shrinking[i-1].y));
      const source=document.querySelector(".is-playing img").getBoundingClientRect(), b=basket.getBoundingClientRect();
      const below=source.y+source.height/2>b.bottom;
      const spin=Math.max(...path.map(p=>p.rotate))-Math.min(...path.map(p=>p.rotate));
      const upright=[basket,layer.querySelector(".clothing-flight-rim"),document.querySelector(".hero-basket")].every(e=>getComputedStyle(e).rotate==="-90deg");
      return {upright, still:basket.getAnimations().length===0, vertical, below, loops:below ? spin>=340 : spin<40};
    };
    await viewport(1440);
    check(await page.locator('.clothing-toy img').evaluateAll(images=>images.every(image=>image.complete && image.naturalWidth>0)), "All five sneaker and backpack illustrations load successfully");

    for (const id of ["high-top", "sneaker", "backpack", "sand-pair", "mint-pair"]) {
      const source = await garment(id).locator("img").boundingBox();
      await garment(id).click();
      const initial = await page.evaluate(() => {
        const layer = document.querySelector(".clothing-flight-layer");
        layer.getAnimations({ subtree: true }).forEach(a => { a.pause(); a.currentTime = 0; });
        const item = layer.querySelector(".clothing-flight-item").getBoundingClientRect();
        const realBasket = document.querySelector(".hero-basket").getBoundingClientRect();
        const copyBasket = layer.querySelector(".clothing-flight-basket").getBoundingClientRect();
        return { x:item.x + item.width / 2, y:item.y + item.height / 2, basketError:Math.abs(copyBasket.x-realBasket.x)+Math.abs(copyBasket.y-realBasket.y), hidden:getComputedStyle(document.querySelector(".is-playing > img")).opacity, inaccessible:layer.getAttribute("aria-hidden") };
      });
      check(Math.abs(initial.x - source.x - source.width / 2) < 2 && Math.abs(initial.y - source.y - source.height / 2) < 2 && initial.basketError < 2, `${id}: copies start at the original artwork`);
      check(initial.hidden === "0" && initial.inaccessible === "true", `${id}: source hides and decorative copies stay out of accessibility tree`);
      const arrival = await page.evaluate(() => {
        const layer = document.querySelector(".clothing-flight-layer");
        const item = layer.querySelector(".clothing-flight-item");
        const basket = layer.querySelector(".clothing-flight-basket");
        const itemAnimation=item.getAnimations()[0];
        const timing=itemAnimation.effect.getTiming();
        itemAnimation.currentTime=timing.delay+timing.duration*.995;
        const a=item.getBoundingClientRect(), b=basket.getBoundingClientRect();
        return {distance:Math.hypot(a.x+a.width/2-b.x-b.width/2,a.y+a.height/2-b.y-b.height/2), size:a.width, basketSize:b.width};
      });
      check(arrival.distance < arrival.basketSize * .3 && arrival.size < arrival.basketSize * .3, `${id}: enters the basket`);
      const shape = await page.evaluate(flightShape);
      check(shape.upright && shape.still, `${id}: basket stays upright and does not turn toward the item`);
      check(shape.vertical, `${id}: drops into the basket strictly from above`);
      check(shape.loops, `${id}: ${shape.below ? "flies one full loop before the drop" : "no loop when starting above the basket"}`);
      const presentation = await page.evaluate(() => {
        const layer=document.querySelector(".clothing-flight-layer");
        const item=layer.querySelector(".clothing-flight-item"), basket=layer.querySelector(".clothing-flight-basket");
        const itemFrames=item.getAnimations()[0].effect.getKeyframes();
        const path=itemFrames.map(f=>{const [x,y=0]=f.translate.split(" ").map(parseFloat);return [x,y];});
        const timing=item.getAnimations()[0].effect.getTiming();
        // Uniform speed along the route: equal time steps cover equal distances.
        const steps=path.slice(1).map((p,i)=>Math.hypot(p[0]-path[i][0],p[1]-path[i][1]));
        const mean=steps.reduce((sum,step)=>sum+step,0)/steps.length;
        const uniform=steps.every(step=>Math.abs(step-mean)<mean*.05+.05);
        const fullSize=itemFrames.filter(f=>f.offset<=.4).every(f=>Number(f.scale)===1)
          && Number(itemFrames.at(-2).scale)<.2;
        layer.getAnimations({subtree:true}).forEach(a=>a.currentTime=timing.delay+timing.duration*.45);
        const tails=[...layer.querySelectorAll(".clothing-comet-segment")];
        const base=Math.max(...tails.map(t=>parseFloat(getComputedStyle(t).height)));
        const centres=tails.map(t=>{const r=t.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};});
        const sourceSize=Math.min(document.querySelector('.is-playing img').offsetWidth,document.querySelector('.is-playing img').offsetHeight);
        const shortTrail=Math.max(...centres.map(a=>Math.hypot(a.x-centres[0].x,a.y-centres[0].y)))<sourceSize*.7;
        const proportional=Math.abs(base/sourceSize-.6)<.001;
        const tail=tails.length>0 && tails.some(t=>getComputedStyle(t).backgroundColor==="rgb(49, 133, 255)" && Number(getComputedStyle(t).opacity)>.1);
        const rim=layer.querySelector(".clothing-flight-rim");
        layer.getAnimations({subtree:true}).forEach(a=>a.currentTime=timing.duration+30);
        const glow=rim && Number(getComputedStyle(rim).opacity)>.7 && getComputedStyle(rim).clipPath!=="none";
        const tailScale=Number(getComputedStyle(tails[0]).scale);
        const shrunkTail=tailScale<.02 && Math.abs(tailScale-Number(getComputedStyle(item).scale))<.001;
        layer.getAnimations({subtree:true}).forEach(a=>a.currentTime=timing.duration+300);
        const faded=Number(getComputedStyle(rim).opacity)===0 && getComputedStyle(basket).rotate==="-90deg";
        return {shrunkTail,proportional,duration:timing.duration,uniform,fullSize,faded,immediate:timing.delay===0,wide:base>=10 && shortTrail,glow,tail};
      });
      check(presentation.tail, `${id}: blue comet tail follows the flight`);
      check(presentation.immediate, `${id}: flight starts without delay`);
      check(presentation.wide, `${id}: comet tail is short with a broad base`);
      check(presentation.proportional, `${id}: comet base scales with garment size`);
      check(presentation.shrunkTail, `${id}: tail shrinks together with garment at entry`);
      check(presentation.glow, `${id}: only the rim lights up at impact`);
      check(presentation.fullSize, `${id}: full size during travel, shrinking only before entry`);
      check(presentation.faded, `${id}: rim glow fades with the basket still upright`);
      check(presentation.duration===1500, `${id}: reaches the basket in 1.5 seconds`);
      check(presentation.uniform, `${id}: moves at an even pace along its route`);
      const original = await page.locator(".hero-basket").boundingBox();
      await page.evaluate(() => document.querySelector(".clothing-flight-layer").getAnimations({subtree:true}).forEach(a=>a.finish()));
      if (id==='mint-pair') {
        await page.locator('.clothing-flight-layer[data-phase="stowing"]').waitFor();
        const final = await page.evaluate(()=>{
          const basket=document.querySelector('.hero-basket'), logo=document.querySelector('.hero-brand-mark');
          const animation=basket.getAnimations()[0];
          animation.pause();
          animation.currentTime=animation.effect.getTiming().duration*.5;
          const style=getComputedStyle(basket);
          const copiesHidden=[...document.querySelectorAll('.clothing-flight-basket,.clothing-flight-rim')].every(copy=>getComputedStyle(copy).display==='none');
          return {copiesHidden,moves:parseFloat(style.translate)>0, clips:style.clipPath!=='none', behind:Number(style.zIndex)<Number(getComputedStyle(logo).zIndex), smooth:animation.effect.getTiming().duration===900 && animation.effect.getTiming().easing.includes('cubic-bezier')};
        });
        check(final.copiesHidden && final.moves && final.clips && final.behind && final.smooth, "After the fifth item, one basket smoothly slides right under the logo with progressive occlusion");
        await page.evaluate(()=>document.querySelector('.hero-basket').getAnimations().forEach(a=>a.finish()));
      }
      await idle();
      const restored = await page.locator(".hero-basket").boundingBox();
      check(!await garment(id).isVisible() && Math.abs(original.x-restored.x)<1 && Math.abs(original.y-restored.y)<1, `${id}: collected artwork stays hidden while basket returns`);
      check(await page.locator('.hero-basket').evaluate((basket,last)=>getComputedStyle(basket).opacity===(last?'0':'1'),id==='mint-pair'), `${id}: basket hides only after the last item`);
    }
    check(!await page.locator('.clothing-hint').isVisible(), "Hint hides after all five garments are collected");
    await page.locator('#language').selectOption('ru');
    await viewport(1024);
    await page.evaluate(()=>window.scrollBy({top:40,behavior:'instant'}));
    check(await page.locator('.clothing-toy[hidden]').count()===5, "Collected garments stay hidden through language, resize and scroll");
    check(await page.locator('.hero-basket').evaluate(b=>getComputedStyle(b).opacity==='0'), "Stowed basket stays hidden through language, resize and scroll");
    await page.reload();
    await page.locator('#language').selectOption('uk');
    await viewport(1440);
    check(await page.locator('.clothing-toy:visible').count()===5 && await page.locator('.clothing-hint').isVisible(), "Reload restores all garments and hint");
    check(await page.locator('.hero-basket').evaluate(b=>getComputedStyle(b).opacity==='1'), "Reload also restores the basket");

    await garment("high-top").click();
    await garment("sneaker").click();
    await garment("sneaker").click();
    await garment("backpack").click();
    await garment("sand-pair").click();
    await garment("mint-pair").click();
    check(await page.locator('[data-flight-state="active"]').count() === 1 && await page.locator('[data-flight-state="queued"]').count() === 4 && await page.locator(".clothing-flight-layer").count() === 1, "Rapid clicks queue all five distinct items without duplicate flights");
    await page.waitForFunction(() => document.querySelector('[data-garment="sneaker"]').dataset.flightState === "active");
    check(await garment("backpack").getAttribute("data-flight-state") === "queued", "Queue starts sneaker after high-top");
    await idle();
    check(await page.locator(".is-playing, .is-catching, .clothing-pop").count() === 0, "Queue finishes and old sparkle effects are absent");
    check(await page.locator('.clothing-toy[hidden]').count()===5, "Queue collects each garment once");
    await page.reload();

    await garment("sneaker").focus();
    await page.keyboard.press("Enter");
    check(await garment("sneaker").getAttribute("data-flight-state") === "active", "Enter starts the shared flight");
    await idle();
    check(!await garment('sneaker').isVisible() && await page.evaluate(()=>document.activeElement?.dataset.garment)==='backpack', "Keyboard collection removes the item from tab order and focuses the next garment");
    await garment("backpack").focus();
    await page.keyboard.press("Space");
    check(await garment("backpack").getAttribute("data-flight-state") === "active", "Space starts the shared flight");
    await page.locator("#language").selectOption("ru");
    await idle();
    check(await page.locator(".is-playing, .is-catching").count() === 0 && await garment("sneaker").getAttribute("aria-label") === "Низкий кроссовок — отправить в корзину", "Changing language cancels cleanly and translates new action");
    await page.locator("#language").selectOption("en");
    check(await garment("high-top").getAttribute("aria-label") === "High-top sneaker — send to the basket", "English action translated");
    await page.locator("#language").selectOption("uk");
    check(await garment("high-top").getAttribute("aria-label") === "Високий кросівок — відправити в кошик", "Ukrainian action translated");
    for (const [language,sand,mint] of [
      ['ru','Песочно-терракотовая пара кроссовок — отправить в корзину','Мятно-серая пара кроссовок — отправить в корзину'],
      ['en','Sand and terracotta sneaker pair — send to the basket','Mint and gray sneaker pair — send to the basket'],
      ['uk','Пісочно-теракотова пара кросівок — відправити в кошик',"М'ятно-сіра пара кросівок — відправити в кошик"],
    ]) {
      await page.locator('#language').selectOption(language);
      check(await garment('sand-pair').getAttribute('aria-label')===sand && await garment('mint-pair').getAttribute('aria-label')===mint, `Both new pair actions translated in ${language}`);
    }

    await garment("high-top").click();
    await page.evaluate(() => { location.hash = "catalog"; });
    await page.locator(".catalog-page").waitFor();
    check(await page.locator(".clothing-flight-layer").count() === 0, "Navigation cancels the flight");
    await page.goto("http://127.0.0.1:5173/#home");
    check(await page.locator('.clothing-toy:visible').count()===5, "Returning from another site page restores collected garments");
    await garment("sneaker").click();
    await viewport(1024);
    await idle();
    check(await page.locator(".is-playing, .is-catching").count() === 0, "Resize restores hidden originals");
    await garment("sneaker").click();
    await page.evaluate(() => window.scrollBy({top:80,behavior:"instant"}));
    await idle();
    check(await garment("sneaker").locator("img").evaluate(img => getComputedStyle(img).opacity === "1"), "Scrolling cancels and restores the source");

    await page.emulateMedia({ reducedMotion: "reduce" });
    await garment("high-top").click();
    const reduced = await page.locator(".clothing-flight-layer").evaluate(layer => layer.getAnimations({subtree:true}).every(a => a.effect.getKeyframes().every(f => !("rotate" in f) && !("translate" in f) && !("scale" in f))));
    check(reduced, "Reduced motion replaces travel and spinning with opacity feedback");
    check(await page.locator(".clothing-comet-segment").count()===0, "Reduced motion has no comet trail");
    await idle();
    check(!await garment('high-top').isVisible(), "Reduced motion also keeps collected artwork hidden");
    // Headless Chromium keeps all tabs visible, so exercise its visibility event
    // explicitly rather than claiming bringToFront simulates a background tab.
    await page.evaluate(()=>{
      Object.defineProperty(document,'hidden',{configurable:true,value:true});
      document.dispatchEvent(new Event('visibilitychange'));
      delete document.hidden;
    });
    check(await page.locator('.clothing-toy:visible').count()===5, "Leaving the browser tab resets collected garments");
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await garment('sneaker').click();
    await page.evaluate(async()=>{
      const layer=document.querySelector('.clothing-flight-layer');
      layer.getAnimations({subtree:true}).forEach(a=>a.pause());
      const item=layer.querySelector('.clothing-flight-item').getAnimations()[0];
      item.finish();
      await item.finished;
    });
    check(!await garment('sneaker').isVisible(), "Garment is collected at impact before basket's pause finishes");
    await viewport(1440);
    await idle();
    check(!await garment('sneaker').isVisible(), "Cancelling the basket pause does not restore an already collected garment");
    await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));
    check(await page.locator('.clothing-toy:visible').count()===5, "Browser back/forward cache restoration resets collected garments");

    for (const width of [320,390,621,768,1024,1280,1440,1912]) {
      await page.reload();
      await viewport(width);
      check(await page.locator('.hero-explore, .scroll-cue').count()===0, `Extra hero links are absent at ${width}px`);
      await page.evaluate(() => window.scrollTo({top:0,behavior:"instant"}));
      const pairsFit = await page.evaluate(()=>{
        const overlap=(a,b)=>a.left<b.right && a.right>b.left && a.top<b.bottom && a.bottom>b.top;
        const hero=document.querySelector('.hero').getBoundingClientRect();
        const items=[...document.querySelectorAll('.clothing-toy')];
        const controls=[...document.querySelectorAll('.hero .search-form,.hero .category-pills,.hero .floating-card,.hero .floating-note,.clothing-hint')].filter(e=>e.getClientRects().length);
        return items.filter(e=>e.dataset.garment.endsWith('-pair')).every(a=>{
          const bounds=a.getBoundingClientRect();
          return bounds.left>=hero.left && bounds.right<=hero.right && bounds.top>=hero.top && bounds.bottom<=hero.bottom
            && [...controls,...items.filter(b=>b!==a)].every(b=>!overlap(bounds,b.getBoundingClientRect()));
        });
      });
      check(pairsFit, `New pairs fit without overlapping controls or illustrations at ${width}px`);
      const cardsFit = await page.evaluate(()=>{
        const overlap=(a,b)=>a.left<b.right && a.right>b.left && a.top<b.bottom && a.bottom>b.top;
        const hero=document.querySelector('.hero').getBoundingClientRect();
        const cards=[...document.querySelectorAll('.hero .floating-card')].filter(e=>e.getClientRects().length);
        const others=[...document.querySelectorAll('.hero-brand-mark,.hero-basket,.hero .search-form,.hero .category-pills,.clothing-toy img')];
        const fit=cards.every((a,i)=>{
          const bounds=a.getBoundingClientRect();
          return bounds.left>=hero.left && bounds.right<=hero.right && bounds.top>=hero.top && bounds.bottom<=hero.bottom
            && [...cards.slice(i+1),...others].every(b=>!overlap(bounds,b.getBoundingClientRect()));
        });
        const sizes=cards.map(e=>getComputedStyle(e).width), tilts=cards.map(e=>getComputedStyle(e).rotate);
        return {count:cards.length, fit, distinct:new Set(sizes).size===cards.length && new Set(tilts).size===cards.length, flush:Math.abs(document.documentElement.clientWidth-hero.right)<1};
      });
      check(cardsFit.fit && cardsFit.distinct && cardsFit.count===(width>1100 ? 7 : width>1000 ? 5 : 3), `${cardsFit.count} hero cards with distinct sizes and tilts fit without overlaps at ${width}px`);
      check(cardsFit.flush, `Hero reaches the right edge at ${width}px`);
      for (const id of ["sneaker","backpack","high-top","sand-pair","mint-pair"]) {
        await garment(id).click();
        check(await page.locator('.clothing-flight-layer').count()===1, `${id}: flight starts at ${width}px: ${errors.join('; ')}`);
        const geometry = await page.evaluate(() => {
          const layer=document.querySelector(".clothing-flight-layer");
          const timing=layer.querySelector(".clothing-flight-item").getAnimations()[0].effect.getTiming();
          layer.getAnimations({subtree:true}).forEach(a => {a.pause();a.currentTime=timing.delay+timing.duration*.6;});
          const item=layer.querySelector(".clothing-flight-item").getBoundingClientRect();
          const hero=document.querySelector(".hero").getBoundingClientRect();
          const active=document.querySelector('[data-flight-state="active"]');
          const sourceSize=Math.min(active.querySelector('img').offsetWidth,active.querySelector('img').offsetHeight);
          const tailBase=Math.max(...[...layer.querySelectorAll('.clothing-comet-segment')].map(t=>parseFloat(getComputedStyle(t).height)));
          const proportional=Math.abs(tailBase/sourceSize-.6)<.001;
          return {duration:timing.duration,proportional,fits:document.documentElement.scrollWidth<=innerWidth, inside:item.left>=hero.left && item.right<=hero.right && item.top>=hero.top && item.bottom<=hero.bottom};
        });
        check(geometry.fits && geometry.inside, `${id}: flight stays within hero at ${width}px`);
        check(geometry.proportional, `${id}: proportional tail at ${width}px`);
        check(geometry.duration===1500, `${id}: 1.5 second flight at ${width}px`);
        const shape = await page.evaluate(flightShape);
        check(shape.upright && shape.still && shape.vertical, `${id}: upright basket, vertical drop at ${width}px`);
        check(shape.loops, `${id}: loop only when starting below the basket at ${width}px`);
        await page.evaluate(() => document.querySelector(".clothing-flight-layer").getAnimations({subtree:true}).forEach(a=>a.finish()));
        await idle();
      }
      check(await page.locator('.hero-basket').evaluate(b=>getComputedStyle(b).opacity==='0' && b.getAnimations().length===0), `Final basket exit completes cleanly at ${width}px`);
      // Also start each route with every other illustration still on screen.
      for (const id of ['sneaker','backpack','high-top','sand-pair','mint-pair']) {
        await page.reload();
        await garment(id).click();
        check(await page.locator('.clothing-flight-layer').count()===1, `${id}: flight starts with all five items present at ${width}px`);
        await page.evaluate(()=>document.querySelector('.clothing-flight-layer').getAnimations({subtree:true}).forEach(a=>a.finish()));
        await idle();
      }
    }
    check(errors.length === 0, `No browser errors: ${errors.join("; ")}`);
    return { passed:results.length, results, errors };
  } finally {
    await context.close();
  }
}
