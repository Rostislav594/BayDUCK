// Run with Playwright MCP browser_run_code_unsafe filename, with npm run dev active.
// Demo accounts: quick guest checkout, sign-up from checkout, account page,
// profile, password change, sign-out/in, reset view, deletion and layout.
async (browserPage) => {
  const context = await browserPage.context().browser().newContext();
  try {
    const page = await context.newPage();
    const results = [], errors = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    const check = (condition, name) => { if (!condition) throw new Error(name); results.push(name); };
    const stored = () => page.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(localStorage))) + JSON.stringify(Object.fromEntries(Object.entries(sessionStorage))));
    const auth = page.locator("#auth-dialog");
    const email = "olena.demo@example.com", password = "duck2026pass", newPassword = "newduck2027";

    await page.goto("http://127.0.0.1:5173/#home");
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const scale = page.viewportSize().width / await page.evaluate(() => innerWidth);
    const viewport = async (width, height = 900) => {
      await page.setViewportSize({ width: Math.round(width * scale), height: Math.round(height * scale) });
      await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 50)));
    };
    await viewport(1440);
    await page.reload();

    // Guest: the account icon opens sign-in; Escape closes it and returns focus.
    await page.locator(".header-account").click();
    check(await auth.evaluate(d => d.open) && await page.locator("#signin-form").count() === 1, "Account icon opens the sign-in dialog for guests");
    check(await page.evaluate(() => document.activeElement?.name) === "email", "Sign-in dialog focuses the email field");
    await page.keyboard.press("Escape");
    check(!await auth.evaluate(d => d.open) && await page.evaluate(() => document.activeElement?.classList.contains("header-account")), "Escape closes the dialog and returns focus");

    // Guest quick checkout keeps working and saves nothing personal.
    // Each item is one of a kind and sells with the order, so every order uses a different pair.
    const addItem = async (id) => {
      await page.locator(`.product-grid a.product-open[href="#product/${id}"]`).first().click();
      await page.locator('.product-page [data-action="add-cart"]').click();
      await page.goBack();
    };
    const addCourt = () => addItem("court");
    await addCourt();
    await page.locator(".cart-trigger").click();
    await page.locator('[data-action="checkout"]').click();
    check(await page.locator(".quick-buy").isVisible() && await page.locator('.quick-buy [data-action="auth"]').isVisible(), "Guests see quick checkout with an optional sign-in link");
    await page.locator('#checkout-form [name="lastName"]').fill("Buyer");
    await page.locator('#checkout-form [name="firstName"]').fill("Guest");
    await page.locator('#checkout-form [name="phone"]').fill("+380501234567");
    await page.locator('#checkout-form [name="city"]').fill("Kyiv");
    await page.locator('#checkout-form [name="point"]').fill("1");
    await page.locator('#checkout-form button[type="submit"]').click();
    check(await page.locator(".success-state").count() === 1 && await page.locator('.success-state a[href="#account"]').count() === 0, "Guest quick checkout completes without an account");
    const guestData = await stored();
    // Guests get no account; their delivery details live only inside the order.
    check(!guestData.includes("buyduck:accounts") && await page.evaluate(() => Object.entries(localStorage).every(([k, v]) => k === "buyduck:orders" || !v.includes("+380501234567"))), "Guest checkout creates no account and keeps details only in the order");
    await page.keyboard.press("Escape");

    // Sign up from the checkout, with validation, then continue to a prefilled form.
    // The guest order emptied the cart and sold Court Essential, so add another pair.
    await addItem("retro");
    await page.locator(".cart-trigger").click();
    await page.locator('[data-action="checkout"]').click();
    await page.locator('.quick-buy [data-action="auth"]').click();
    await page.locator('#auth-dialog [data-view="signup"]').click();
    const signup = page.locator("#signup-form");
    await signup.locator('[name="name"]').fill("Olena");
    await signup.locator('[name="email"]').fill("olena@");
    await signup.locator('[name="password"]').fill(password);
    await signup.locator('button[type="submit"]').click();
    check((await signup.locator(".form-error").textContent()).includes("пошти"), "Invalid email is reported in Ukrainian");
    await signup.locator('[name="email"]').fill(email);
    await signup.locator('[name="password"]').fill("short");
    await signup.locator('button[type="submit"]').click();
    check(await signup.locator(".form-error").isVisible() && (await signup.locator(".form-error").textContent()).includes("8"), "Weak password is rejected");
    await signup.locator('[name="password"]').fill(password);
    await signup.locator('[data-action="toggle-password"]').click();
    check(await signup.locator('[name="password"]').getAttribute("type") === "text" && await signup.locator('[data-action="toggle-password"]').getAttribute("aria-pressed") === "true", "Password visibility toggle works");
    await signup.locator('button[type="submit"]').click();
    await page.locator(".checkout-account").waitFor();
    check(!await auth.evaluate(d => d.open) && await page.locator(".checkout-account").textContent().then(text => text.includes(email)), "Sign-up returns to checkout as the new customer");
    check(await page.locator('#checkout-form [name="firstName"]').inputValue() === "Olena", "Checkout is prefilled from the account");
    const accountData = await stored();
    check(accountData.includes("buyduck:accounts") && !accountData.includes(password) && accountData.includes("pbkdf2-sha256"), "Password is stored only as a PBKDF2 hash");
    await page.locator('#checkout-form [name="lastName"]').fill("Koval");
    await page.locator('#checkout-form [name="phone"]').fill("+380671112233");
    await page.locator('#checkout-form [name="city"]').fill("Lviv");
    await page.locator('#checkout-form [name="point"]').fill("7");
    await page.locator('#checkout-form button[type="submit"]').click();
    const number = (await page.locator(".success-state strong").textContent()).match(/BD-\d+/)?.[0];
    check(Boolean(number) && await page.locator('.success-state a[href="#account"]').isVisible(), "Signed-in order gets a number and a link to the account");

    // Account page: order history and saved delivery details.
    await page.locator('.success-state a[href="#account"]').click();
    await page.locator(".account-page .order-card").waitFor();
    check((await page.locator(".order-card h3").first().textContent()).includes(number) && (await page.locator(".order-card").first().textContent()).includes("Retro Runner 02"), "Order appears in the account history");
    check(await page.locator('#profile-form [name="phone"]').inputValue() === "+380671112233" && await page.locator('#profile-form [name="city"]').inputValue() === "Lviv", "Delivery details were saved to the profile");
    check(await page.locator(".header-account.is-signed-in").count() === 1, "Header shows the signed-in state");
    await page.locator('#profile-form [name="name"]').fill("Olena K");
    await page.locator('#profile-form button[type="submit"]').click();
    check((await page.locator(".account-intro h1").textContent()).includes("Olena K") && (await page.locator(".header-account").getAttribute("aria-label")).includes("Olena K"), "Profile edits update the page and header");

    // Password change.
    await page.locator('#password-form [name="current"]').fill("wrong-pass1");
    await page.locator('#password-form [name="next"]').fill(newPassword);
    await page.locator('#password-form button[type="submit"]').click();
    await page.locator("#password-form .form-error:not([hidden])").waitFor();
    check(true, "Wrong current password is rejected");
    await page.locator('#password-form [name="current"]').fill(password);
    await page.locator('#password-form [name="next"]').fill(newPassword);
    await page.locator('#password-form button[type="submit"]').click();
    await page.waitForFunction(() => document.querySelector("#password-form [name=current]").value === "");
    check(await page.locator("#password-form .form-error").isHidden(), "Password change succeeds");

    // Language switch keeps the session.
    await page.locator("#language").selectOption("ru");
    check(await page.locator(".breadcrumbs span").textContent() === "Личный кабинет" && await page.locator(".order-card").count() === 1, "Russian account page keeps the session and orders");
    await page.locator("#language").selectOption("en");
    check(await page.locator('#profile-form button[type="submit"]').textContent() === "Save changes", "English account page");
    await page.locator("#language").selectOption("uk");

    // Sign out, wrong password, forgot view, sign in with the new password.
    await page.locator('[data-action="sign-out"]').click();
    check(await page.locator(".account-empty").isVisible() && await page.locator(".header-account.is-signed-in").count() === 0, "Sign-out shows the signed-out account page");
    await page.reload();
    check(await page.locator(".account-empty").isVisible(), "Signed-out state survives reload");
    await page.locator('.account-empty [data-action="auth"]').first().click();
    const signin = page.locator("#signin-form");
    await signin.locator('[name="email"]').fill(email);
    await signin.locator('[name="password"]').fill(password);
    await signin.locator('button[type="submit"]').click();
    await signin.locator(".form-error:not([hidden])").waitFor();
    check((await signin.locator(".form-error").textContent()).includes("Неправильна"), "Old password no longer works");
    await page.locator('#auth-dialog [data-view="forgot"]').click();
    await page.locator('#forgot-form [name="email"]').fill(email);
    await page.locator('#forgot-form button[type="submit"]').click();
    check(await page.locator("#forgot-form .form-success").isVisible(), "Reset view shows a neutral message");
    await page.locator('#auth-dialog [data-view="signin"]').click();
    await signin.locator('[name="email"]').fill(email);
    await signin.locator('[name="password"]').fill(newPassword);
    await signin.locator('[name="remember"]').uncheck();
    await signin.locator('button[type="submit"]').click();
    await page.locator(".account-intro").waitFor();
    check(await page.evaluate(() => sessionStorage.getItem("buyduck:session") !== null && localStorage.getItem("buyduck:session") === null), "Unchecked “remember me” keeps the session to this tab");

    // Layout on phones.
    for (const width of [320, 390]) {
      await viewport(width, 800);
      check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Account page fits ${width}px`);
      check(await page.locator(".header-account").isVisible(), `Account icon visible at ${width}px`);
    }
    await page.locator('[data-action="sign-out"]').click();
    await page.locator(".menu-pull").click();
    check(await page.locator(".mobile-nav .menu-card").count() === 3, "Mobile menu shows the men, women and sale cards");
    await page.locator(".menu-pull").click();
    await page.locator(".header-account").click();
    check(await auth.evaluate(d => d.scrollWidth <= d.clientWidth + 1) && await auth.evaluate(d => d.open), "Sign-in dialog fits the phone screen");
    await signin.locator('[name="email"]').fill(email);
    await signin.locator('[name="password"]').fill(newPassword);
    await signin.locator('button[type="submit"]').click();
    await page.locator(".header-account.is-signed-in").waitFor();
    await viewport(1440);

    // Deletion requires the password and removes everything.
    await page.goto("http://127.0.0.1:5173/#account");
    await page.locator(".account-danger summary").click();
    await page.locator('#delete-form [name="password"]').fill("wrong-pass1");
    await page.locator('#delete-form button[type="submit"]').click();
    await page.locator("#delete-form .form-error:not([hidden])").waitFor();
    await page.locator('#delete-form [name="password"]').fill(newPassword);
    await page.locator('#delete-form button[type="submit"]').click();
    await page.waitForFunction(() => location.hash === "#home");
    check(!(await stored()).includes(email), "Account deletion requires the password and removes the data");

    check(errors.length === 0, `No browser errors: ${errors.join("; ")}`);
    return { passed: results.length, results, errors };
  } finally {
    await context.close();
  }
}
