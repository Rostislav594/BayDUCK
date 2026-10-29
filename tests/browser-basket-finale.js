// Run with Playwright MCP browser_run_code_unsafe filename, with npm run dev active.
// A click on the decorative hero basket slides it behind the letter B.
async (browserPage) => {
  const context = await browserPage.context().browser().newContext();
  try {
    const page = await context.newPage(), results = [], errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type()==='error') errors.push(message.text()); });
    const check = (condition,name) => { if (!condition) throw new Error(name); results.push(name); };
    const basket = () => page.locator('.hero-basket');
    const state = () => page.evaluate(()=>{
      const b=document.querySelector('.hero-basket');
      return {opacity:getComputedStyle(b).opacity, stowed:b.classList.contains('is-stowed'), animations:b.getAnimations().length};
    });
    const settle = () => page.waitForFunction(()=>document.querySelector('.hero-basket').getAnimations().length===0);
    await page.goto('http://127.0.0.1:5173/#home');
    const scale = page.viewportSize().width / await page.evaluate(()=>innerWidth);
    await page.setViewportSize({width:Math.round(1280*scale),height:Math.round(900*scale)});
    await page.emulateMedia({reducedMotion:'no-preference'});

    check(await page.locator('.clothing-toy, .playful-clothes, .clothing-hint').count()===0, 'The clothing game is gone from the hero');
    check((await state()).opacity==='1' && await basket().evaluate(b=>getComputedStyle(b).cursor==='pointer'), 'Basket is visible and clickable');
    const logoBefore = await page.locator('.hero-brand-mark').boundingBox();
    await basket().click();
    const exit = await basket().evaluate(b=>{
      const a=b.getAnimations()[0];
      a.pause();
      a.currentTime=a.effect.getTiming().duration*.5;
      const style=getComputedStyle(b), logo=document.querySelector('.hero-brand-mark');
      return {moves:parseFloat(style.translate)>0, clips:style.clipPath!=='none', behind:Number(style.zIndex)<Number(getComputedStyle(logo).zIndex), smooth:a.effect.getTiming().duration===900 && a.effect.getTiming().easing.includes('cubic-bezier')};
    });
    check(exit.moves && exit.clips && exit.behind && exit.smooth, 'Click slides the basket smoothly right under the logo with progressive occlusion');
    const logoDuring = await page.locator('.hero-brand-mark').boundingBox();
    check(Math.abs(logoBefore.x-logoDuring.x)<1 && Math.abs(logoBefore.y-logoDuring.y)<1, 'The logo stays in place');
    await basket().evaluate(b=>b.getAnimations().forEach(a=>a.finish()));
    await settle();
    let current = await state();
    check(current.opacity==='0' && current.stowed && current.animations===0, 'After the exit the basket stays hidden without leftover animations');
    check(await page.locator('.cart-count').first().textContent()==='0', 'The decorative basket does not touch the real cart');

    await page.locator('#language').selectOption('ru');
    current = await state();
    check(current.opacity==='0' && current.stowed, 'Language change keeps the basket hidden');
    await page.evaluate(()=>window.scrollBy({top:80,behavior:'instant'}));
    await page.setViewportSize({width:Math.round(390*scale),height:Math.round(900*scale)});
    current = await state();
    check(current.opacity==='0', 'Scrolling and resizing keep the basket hidden');
    await page.locator('#language').selectOption('uk');

    await page.evaluate(()=>{location.hash='catalog';});
    await page.locator('.catalog-page').waitFor();
    await page.evaluate(()=>{location.hash='home';});
    await page.locator('.hero').waitFor();
    current = await state();
    check(current.opacity==='1' && !current.stowed, 'Leaving the home page and returning brings the basket back');

    // A re-render in the middle of the exit hides the new basket straight away.
    await basket().click();
    await page.locator('#language').selectOption('en');
    current = await state();
    check(current.opacity==='0' && current.stowed && current.animations===0, 'Re-rendering during the exit keeps the basket hidden');
    await page.locator('#language').selectOption('uk');

    await page.emulateMedia({reducedMotion:'reduce'});
    await page.reload();
    check((await state()).opacity==='1', 'Reload restores the basket');
    await basket().click();
    const reduced = await basket().evaluate(b=>b.getAnimations().every(a=>a.effect.getKeyframes().every(f=>!('translate' in f) && !('clipPath' in f))));
    check(reduced, 'Reduced motion uses opacity only');
    await settle();
    check((await state()).opacity==='0', 'Reduced motion reaches the same hidden state');
    await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));
    check((await state()).opacity==='1', 'Back/forward cache restoration brings the basket back');
    check(errors.length===0, `No browser errors: ${errors.join('; ')}`);
    return {passed:results.length,results,errors};
  } finally {
    await context.close();
  }
}
