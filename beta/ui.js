import {writeUtf16String} from './util.js';

export function setupUI({net, renderer, canvas}){
  const $ = (id)=>document.getElementById(id);

  const serverSel = $('server');
  const btnConnect = $('btnConnect');
  const btnStart = $('btnStart');
  const btnSpectate = $('btnSpectate');
  const chatInput = $('chat-input');
  const feed = $('chat-feed');
  const captchaHolder = $('captcha-holder');
  const captchaDiv = $('captcha');
  const btnSkipCaptcha = $('btnSkipCaptcha');

  // read server from hash (e.g. #ffa.agar.su:6001)
  if (location.hash && location.hash.length>1){
    const host = decodeURIComponent(location.hash.slice(1));
    const opt = [...serverSel.options].find(o=>o.value===host);
    if (opt) serverSel.value = host; else serverSel.value = host;
  }

  let captchaToken = null;
  // Try to render Turnstile
  const renderCaptcha = ()=>{
    if (!window.turnstile) return;
    captchaHolder.style.display = '';
    try{
      window.turnstile.render(captchaDiv, {
        sitekey: "0x4AAAAAAA0keHJ56_KNR0MU",
        callback: (token)=>{ captchaToken = token; }
      });
    }catch(e){ /* ignore */ }
  };
  // if already loaded
  if (window.turnstile) renderCaptcha(); else {
    window.addEventListener('load', renderCaptcha);
  }

  btnSkipCaptcha.addEventListener('click', ()=>{
    captchaToken = "dev-skip";
    connect();
  });

  btnConnect.addEventListener('click', connect);
  btnStart.addEventListener('click', ()=>{ connect(true); });
  btnSpectate.addEventListener('click', ()=>{ connect(false, true); });

  function connect(withNick=false, spectate=false){
    const host = serverSel.value;
    const nick = $('nick').value.trim();
    const pass = $('pass').value.trim();
    const nickWithPass = withNick ? (nick + "#" + pass) : "";
    location.hash = host;
    net.connect(host, captchaToken, nickWithPass);
    canvas.focus();
  }

  chatInput.addEventListener('keydown', (e)=>{
    if (e.key === 'Enter'){
      const txt = chatInput.value.trim();
      if (txt.length>0){ net.sendChat(txt); }
      chatInput.value = "";
    }
  });
}
