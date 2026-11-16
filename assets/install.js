(() => {
  let installPrompt = null;
  const buttons = [...document.querySelectorAll('[data-install-app]')];
  const installed = () => Boolean(navigator.standalone || window.matchMedia?.('(display-mode: standalone)').matches);
  function hideInstall(button, hide) {
    button.hidden = hide;
    const separator = button.nextSibling;
    if (separator?.nodeType === 3 && (separator.textContent.trim() === '·' || !separator.textContent.trim())) separator.textContent = hide ? '' : ' · ';
  }
  function updateButtons() { for (const button of buttons) hideInstall(button, installed()); }
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event; });
  window.addEventListener('appinstalled', () => { installPrompt = null; for (const button of buttons) hideInstall(button, true); });
  async function install(button) {
    if (installPrompt) {
      const prompt = installPrompt; installPrompt = null;
      await prompt.prompt(); await prompt.userChoice; return;
    }
    const dialog = document.createElement('dialog');dialog.className = 'install-dialog';dialog.setAttribute('aria-labelledby','install-title');
    const apple = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const android = /Android/i.test(navigator.userAgent);
    const instructions = apple
      ? '<p>Open this website in Safari, then:</p><ol><li>Tap the <strong>Share</strong> button.</li><li>Choose <strong>Add to Home Screen</strong>.</li><li>Tap <strong>Add</strong>.</li></ol>'
      : android
        ? '<p>Open this website in Chrome, then:</p><ol><li>Tap the <strong>three-dot menu</strong>.</li><li>Choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.</li><li>Confirm <strong>Install</strong> or <strong>Add</strong>.</li></ol>'
        : '<p>On your phone, open this website in Safari or Chrome and choose <strong>Add to Home Screen</strong> or <strong>Install app</strong> from the browser menu.</p><p>On a computer, Chrome and Edge may also offer an install icon in the address bar.</p>';
    dialog.innerHTML = '<h2 id="install-title">Add the league to your phone</h2>'+instructions+'<button type="button">Done</button>';
    const close = () => { if(dialog.close)dialog.close(); else dialog.remove(); };
    dialog.querySelector('button').addEventListener('click',close);
    dialog.addEventListener('close',()=>{dialog.remove();button.focus();},{once:true});
    dialog.addEventListener('click',event=>{if(event.target===dialog)close();});
    document.body.appendChild(dialog);if(dialog.showModal)dialog.showModal();else dialog.setAttribute('open','');dialog.querySelector('button').focus();
  }
  buttons.forEach(button=>button.addEventListener('click',()=>install(button).catch(()=>{})));
  updateButtons();
  if ('serviceWorker' in navigator && window.isSecureContext) {
    navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'}).catch(()=>{});
  }
})();
