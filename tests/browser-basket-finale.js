// Run with Playwright MCP browser_run_code_unsafe filename, with npm run dev active.
async (browserPage) => {
  const context = await browserPage.context().browser().newContext();
  try {
    const page = await context.newPage(), results = [], errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type()==='error') errors.push(message.text()); });
    const check = (condition,name) => { if (!condition) throw new Error(name); results.push(name); };
    const idle = () => page.waitForFunction(()=>!document.querySelector('.clothing-flight-layer'));
    const state = () => page.evaluate(()=>({
      basket:getComputedStyle(document.querySelector('.hero-basket')).opacity,
      hidden:document.querySelectorAll('.clothing-toy[hidden]').length,
      animations:document.querySelector('.hero-basket').getAnimations().length,
      layers:document.querySelectorAll('.clothing-flight-layer').length,
    }));
    await page.goto('http://127.0.0.1:5173/#home');
    const scale = page.viewportSize().width / await page.evaluate(()=>innerWidth);
    await page.setViewportSize({width:Math.round(621*scale),height:Math.round(950*scale)});
    await page.emulateMedia({reducedMotion:'no-preference'});
    const fresh = async () => {
      await page.reload();
      await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    };
    const finalStage = async () => {
      for (const [index,id] of ['sneaker','backpack','high-top','sand-pair','mint-pair'].entries()) {
        await page.locator(`[data-garment="${id}"]`).click();
        await page.evaluate(()=>document.querySelector('.clothing-flight-layer').getAnimations({subtree:true}).forEach(a=>a.finish()));
        if (index<4) await idle();
      }
      await page.locator('.clothing-flight-layer[data-phase="stowing"]').waitFor();
      await page.evaluate(()=>document.querySelector('.hero-basket').getAnimations().forEach(a=>a.pause()));
    };
    await fresh();
    const logoBefore = await page.locator('.hero-brand-mark').boundingBox();
    await finalStage();
    await page.evaluate(()=>{const a=document.querySelector('.hero-basket').getAnimations()[0];a.currentTime=a.effect.getTiming().duration*.25;});
    const logoDuring = await page.locator('.hero-brand-mark').boundingBox();
    check(Math.abs(logoBefore.x-logoDuring.x)<1 && Math.abs(logoBefore.y-logoDuring.y)<1 && Math.abs(logoBefore.width-logoDuring.width)<1, 'Final basket movement keeps the logo in place');
    await page.screenshot({path:'C:/Users/User/Desktop/BayDUCK/artifacts/basket-finale-moving.png'});
    await page.evaluate(()=>document.querySelector('.hero-basket').getAnimations().forEach(a=>a.finish()));
    await idle();
    let current=await state();
    check(current.basket==='0' && current.hidden===5 && current.animations===0, 'After the final exit, basket and all five items stay hidden without leftover animations');
    await page.screenshot({path:'C:/Users/User/Desktop/BayDUCK/artifacts/basket-finale-complete.png'});
    await page.locator('#language').selectOption('ru');
    current=await state();
    check(current.basket==='0' && current.hidden===5, 'Language changes preserve the completed finale');
    await page.evaluate(()=>{location.hash='catalog';});
    await page.locator('.catalog-page').waitFor();
    await page.evaluate(()=>{location.hash='home';});
    await page.locator('.hero').waitFor();
    current=await state();
    check(current.basket==='1' && current.hidden===0, 'Leaving the shop page and returning restores basket and every item');

    await fresh();
    await finalStage();
    await page.evaluate(()=>window.scrollBy({top:80,behavior:'instant'}));
    await idle();
    current=await state();
    check(current.basket==='0' && current.hidden===5 && current.animations===0, 'Scrolling during the exit settles the completed state cleanly');

    await fresh();
    await finalStage();
    await page.locator('#language').selectOption('en');
    await idle();
    current=await state();
    check(current.basket==='0' && current.hidden===5 && current.animations===0, 'Re-rendering during the exit keeps the basket hidden and cancels its motion');

    await fresh();
    await finalStage();
    await page.setViewportSize({width:Math.round(390*scale),height:Math.round(950*scale)});
    await idle();
    current=await state();
    check(current.basket==='0' && current.hidden===5, 'Resizing during the exit keeps the completed state');
    // Headless tabs remain visible; exercise the browser visibility event explicitly.
    await page.evaluate(()=>{
      Object.defineProperty(document,'hidden',{configurable:true,value:true});
      document.dispatchEvent(new Event('visibilitychange'));
      delete document.hidden;
    });
    current=await state();
    check(current.basket==='1' && current.hidden===0 && current.animations===0, 'Changing browser tabs restores basket and items together');

    await page.emulateMedia({reducedMotion:'reduce'});
    await fresh();
    await finalStage();
    const reduced=await page.locator('.hero-basket').evaluate(b=>b.getAnimations().every(a=>a.effect.getKeyframes().every(f=>!('translate' in f) && !('rotate' in f) && !('scale' in f))));
    check(reduced, 'Reduced motion uses opacity only for the final basket exit');
    await page.evaluate(()=>document.querySelector('.hero-basket').getAnimations().forEach(a=>a.finish()));
    await idle();
    current=await state();
    check(current.basket==='0' && current.hidden===5, 'Reduced motion reaches the same completed state');
    await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));
    current=await state();
    check(current.basket==='1' && current.hidden===0, 'Back/forward cache restoration also restores the basket');
    await fresh();
    current=await state();
    check(current.basket==='1' && current.hidden===0, 'Refreshing restores the complete scene');
    check(errors.length===0, `No browser errors: ${errors.join('; ')}`);
    return {passed:results.length,results,errors};
  } finally {
    await context.close();
  }
}
