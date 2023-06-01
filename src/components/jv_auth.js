async function authorize(env, params = {}) {
    //alert("auth alkaa..."");
    const url = env.getUrl(); // Multiple config for EHR launches ---------------------------------------
    //+  JSON.stringify(rowData));
    if (Array.isArray(params)) {
     const urlISS = url.searchParams.get("iss") || url.searchParams.get("fhirServiceUrl");
  
      if (!urlISS) {
        throw new Error('Passing in an "iss" url parameter is required if authorize ' + 'uses multiple configurations');
      } // pick the right config
  
  
      const cfg = params.find(x => {
        if (x.issMatch) {
          if (typeof x.issMatch === "function") {
            return !!x.issMatch(urlISS);
          }
  
          if (typeof x.issMatch === "string") {
            return x.issMatch === urlISS;
          }
  
          if (x.issMatch instanceof RegExp) {
            return x.issMatch.test(urlISS);
          }
        }
  
        return false;
      });
      (0, lib_1.assert)(cfg, `No configuration found matching the current "iss" parameter "${urlISS}"`);
      return await authorize(env, cfg);
    } // ------------------------------------------------------------------------
    // Obtain input
  
  
    const {
      redirect_uri,
      clientSecret,
      fakeTokenResponse,
      patientId,
      encounterId,
      client_id,
      target,
      width,
      height,
      pkceMode,
      clientPublicKeySetUrl
    } = params;
    let {
      iss,
      launch,
      fhirServiceUrl,
      redirectUri,
      noRedirect,
      scope = "",
      clientId,
      completeInTarget,
      clientPrivateJwk
    } = params;
    const storage = env.getStorage(); // For these three an url param takes precedence over inline option
  
    iss = url.searchParams.get("iss") || iss;
    fhirServiceUrl = url.searchParams.get("fhirServiceUrl") || fhirServiceUrl;
    launch = url.searchParams.get("launch") || launch;
  
    if (!clientId) {
      clientId = client_id;
    }
  
    if (!redirectUri) {
      redirectUri = redirect_uri;
    }
  
    if (!redirectUri) {
      redirectUri = env.relative(".");
    } else if (!redirectUri.match(/^https?\:\/\//)) {
      redirectUri = env.relative(redirectUri);
    }
  
    const serverUrl = String(iss || fhirServiceUrl || ""); // Validate input
  
    if (!serverUrl) {
      throw new Error("No server url found. It must be specified as `iss` or as " + "`fhirServiceUrl` parameter");
    }
  
    if (iss) {
      debug("Making %s launch...", launch ? "EHR" : "standalone");
    } // append launch scope if needed
  
  
    if (launch && !scope.match(/launch/)) {
      scope += " launch";
    }
  
    if (isBrowser()) {
      const inFrame = isInFrame();
      const inPopUp = isInPopUp();
  
      if ((inFrame || inPopUp) && completeInTarget !== true && completeInTarget !== false) {
        // completeInTarget will default to true if authorize is called from
        // within an iframe. This is to avoid issues when the entire app
        // happens to be rendered in an iframe (including in some EHRs),
        // even though that was not how the app developer's intention.
        completeInTarget = inFrame; // In this case we can't always make the best decision so ask devs
        // to be explicit in their configuration.
  
        console.warn('Your app is being authorized from within an iframe or popup ' + 'window. Please be explicit and provide a "completeInTarget" ' + 'option. Use "true" to complete the authorization in the ' + 'same window, or "false" to try to complete it in the parent ' + 'or the opener window. See http://docs.smarthealthit.org/client-js/api.html');
      }
    } // If `authorize` is called, make sure we clear any previous state (in case
    // this is a re-authorize)
  
  
    const oldKey = await storage.get(settings_1.SMART_KEY);
    await storage.unset(oldKey); // create initial state
  
    const stateKey = (0, lib_1.randomString)(16);
    const state = {
      clientId,
      scope,
      redirectUri,
      serverUrl,
      clientSecret,
      clientPrivateJwk,
      tokenResponse: {},
      key: stateKey,
      completeInTarget,
      clientPublicKeySetUrl
    };
    const fullSessionStorageSupport = isBrowser() ? (0, lib_1.getPath)(env, "options.fullSessionStorageSupport") : true;
  
    if (fullSessionStorageSupport) {
      await storage.set(settings_1.SMART_KEY, stateKey);
    } // fakeTokenResponse to override stuff (useful in development)
  
  
    if (fakeTokenResponse) {
      Object.assign(state.tokenResponse, fakeTokenResponse);
    } // Fixed patientId (useful in development)
  
  
    if (patientId) {
      Object.assign(state.tokenResponse, {
        patient: patientId
      });
    } // Fixed encounterId (useful in development)
  
  
    if (encounterId) {
      Object.assign(state.tokenResponse, {
        encounter: encounterId
      });
    }
  
    let redirectUrl = redirectUri + "?state=" + encodeURIComponent(stateKey); // bypass oauth if fhirServiceUrl is used (but iss takes precedence)
  
    if (fhirServiceUrl && !iss) {
      debug("Making fake launch...");
      await storage.set(stateKey, state);
  
      if (noRedirect) {
        return redirectUrl;
      }
  
      return await env.redirect(redirectUrl);
    } // Get oauth endpoints and add them to the state
  
  
    const extensions = await getSecurityExtensions(serverUrl);
    Object.assign(state, extensions);
    await storage.set(stateKey, state); // If this happens to be an open server and there is no authorizeUri
  
    if (!state.authorizeUri) {
      if (noRedirect) {
        return redirectUrl;
      }
  
      return await env.redirect(redirectUrl);
    } // build the redirect uri
  
  
    const redirectParams = ["response_type=code", "client_id=" + encodeURIComponent(clientId || ""), "scope=" + encodeURIComponent(scope), "redirect_uri=" + encodeURIComponent(redirectUri), "aud=" + encodeURIComponent(serverUrl), "state=" + encodeURIComponent(stateKey)]; // also pass this in case of EHR launch
  
    if (launch) {
      redirectParams.push("launch=" + encodeURIComponent(launch));
    }
  
    if (shouldIncludeChallenge(extensions.codeChallengeMethods.includes('S256'), pkceMode)) {
      let codes = await env.security.generatePKCEChallenge();
      Object.assign(state, codes);
      await storage.set(stateKey, state);
      redirectParams.push("code_challenge=" + state.codeChallenge); // note that the challenge is ALREADY encoded properly
  
      redirectParams.push("code_challenge_method=S256");
    }
  
    redirectUrl = state.authorizeUri + "?" + redirectParams.join("&");
  
    if (noRedirect) {
      return redirectUrl;
    }
  
    if (target && isBrowser()) {
      let win;
      win = await (0, lib_1.getTargetWindow)(target, width, height);
  
      if (win !== self) {
        try {
          // Also remove any old state from the target window and then
          // transfer the current state there
          win.sessionStorage.removeItem(oldKey);
          win.sessionStorage.setItem(stateKey, JSON.stringify(state));
        } catch (ex) {
          (0, lib_1.debug)(`Failed to modify window.sessionStorage. Perhaps it is from different origin?. Failing back to "_self". %s`, ex);
          win = self;
        }
      }
  
      if (win !== self) {
        try {
          win.location.href = redirectUrl;
          self.addEventListener("message", onMessage);
        } catch (ex) {
          (0, lib_1.debug)(`Failed to modify window.location. Perhaps it is from different origin?. Failing back to "_self". %s`, ex);
          self.location.href = redirectUrl;
        }
      } else {
        self.location.href = redirectUrl;
      }
  
      return;
    } else {
      return await env.redirect(redirectUrl);
    }
  }