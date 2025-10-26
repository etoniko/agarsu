// Very small networking layer matching the basic AGAR.SU opcodes used in your old client.
import {utf8Decoder, utf8Encoder, writeUtf16String, readUtf8String} from './util.js';

export class Net{
  constructor(renderer){
    this.renderer = renderer;
    this.ws = null;
    this.ownerId = 0;
    this.nick = "";
    this.lastPingStamp = 0;
    this.pingElem = document.getElementById("ping");
    this.token = null;
    this.mouseX = 0; this.mouseY = 0;
    this.zoom = 1;
    this._bindInputs();
  }

  _bindInputs(){
    const canvas = document.getElementById('glcanvas');

    addEventListener('mousemove', (e)=>{
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const x = (e.clientX-rect.left)*dpr;
      const y = (e.clientY-rect.top)*dpr;
      // convert to world
      const worldX = (x - canvas.width*0.5)/this.renderer.zoom + this.renderer.camX;
      const worldY = (y - canvas.height*0.5)/this.renderer.zoom + this.renderer.camY;
      this.mouseX = worldX; this.mouseY = worldY;
      this.sendMouse();
    }, {passive:true});

    addEventListener('wheel', (e)=>{
      this.renderer.zoomBy(e.deltaY/120);
    }, {passive:true});

    addEventListener('keydown', (e)=>{
      if (document.activeElement?.id === 'chat-input') return;
      if (e.code === 'Space'){ this.sendUint8(17); e.preventDefault(); }
      else if (e.key === 'w' || e.key === 'W'){ this.sendUint8(21); }
      else if (e.key === 'q' || e.key === 'Q'){ this.sendUint8(18); }
    });
  }

  connect(host, token, nickWithPass){
    if (this.ws && this.ws.readyState === WebSocket.OPEN){
      if (this.ws._host === host) return;
      this.ws.close();
    }
    const scheme = location.protocol === 'https:' ? 'wss://' : 'ws://';
    const url = `${scheme}${host}?token=${encodeURIComponent(token||"")}`;

    const ws = new WebSocket(url, "eSejeKSVdysQvZs0ES1H");
    ws.binaryType = 'arraybuffer';
    ws._host = host;
    ws.onopen = ()=>{
      // Protocol handshake 254/5 and 255/0
      this.sendProtocol();
      this.setNick(nickWithPass || this.nick);
      // start ping
      this._pingTimer = setInterval(()=>{
        if (document.hidden) return;
        this.lastPingStamp = Date.now();
        this.sendUint8(2); // ping opcode used by server to answer with 2
      }, 3000);
    };
    ws.onmessage = (ev)=>this._onMessage(ev.data);
    ws.onclose = ()=>{
      clearInterval(this._pingTimer);
      this.ws = null;
      document.getElementById('leaderboard').innerHTML = "";
    };
    this.ws = ws;
  }

  sendProtocol(){
    // 254 + 5
    let buf = new ArrayBuffer(5);
    let dv = new DataView(buf);
    dv.setUint8(0,254); dv.setUint32(1,5,true);
    this.ws.send(buf);
    // 255 + 0
    buf = new ArrayBuffer(5);
    dv = new DataView(buf);
    dv.setUint8(0,255); dv.setUint32(1,0,true);
    this.ws.send(buf);
  }

  setNick(nickWithPass){
    this.nick = nickWithPass;
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const str = nickWithPass ?? "";
    const buf = new ArrayBuffer(1 + 2*str.length);
    const dv = new DataView(buf);
    dv.setUint8(0, 0);
    writeUtf16String(dv, 1, str);
    this.ws.send(buf);
  }

  sendMouse(){
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    // 16 + float64 x,y + uint32 0
    const buf = new ArrayBuffer(1+8+8+4);
    const dv = new DataView(buf);
    dv.setUint8(0, 16);
    dv.setFloat64(1, this.mouseX, true);
    dv.setFloat64(9, this.mouseY, true);
    dv.setUint32(17, 0, true);
    this.ws.send(buf);
  }

  sendUint8(code){
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const buf = new Uint8Array([code]);
    this.ws.send(buf);
  }

  sendChat(text){
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const max = Math.min(200, text.length);
    const buf = new ArrayBuffer(2 + 2*max);
    const dv = new DataView(buf);
    dv.setUint8(0, 99); // chat opcode
    dv.setUint8(1, 0);  // flags
    writeUtf16String(dv, 2, text.slice(0,max));
    this.ws.send(buf);
  }

  _onMessage(ab){
    const dv = new DataView(ab);
    const type = dv.getUint8(0);
    switch(type){
      case 2: { // pong
        const ping = Date.now() - this.lastPingStamp;
        if (this.pingElem) this.pingElem.textContent = String(ping);
        break; }
      case 16: { // node update stream (custom compact variant using BinaryReader in old client)
        this._parseUpdateNodes(dv);
        break; }
      case 17: {
        // position packet, ignored (server-controlled zoom/pos in some forks)
        break; }
      case 20: { // clear my cells (dead)
        this.renderer.playerIds.clear();
        break; }
      case 49: { // leaderboard (ffa)
        this._parseLeaderboard(dv, 1);
        break; }
      case 50: { // teams
        this._parseLeaderboard(dv, 2);
        break; }
      case 64: { // border
        let o=1;
        const left = dv.getFloat64(o, true); o+=8;
        const top = dv.getFloat64(o, true); o+=8;
        const right = dv.getFloat64(o, true); o+=8;
        const bottom = dv.getFloat64(o, true); o+=8;
        const foodMin = dv.getUint16(o,true); o+=2;
        const foodMax = dv.getUint16(o,true); o+=2;
        this.ownerId = dv.getUint32(o,true); o+=4;
        this.renderer.setBorder(left, top, right, bottom);
        break; }
      case 99: { // chat message
        this._parseChat(dv);
        break; }
      case 114: { /* xp update ignore */ break; }
      default:
        // console.log('unknown', type, dv.byteLength);
        break;
    }
  }

  _parseUpdateNodes(dv){
    // This is a simplified parser compatible with BinaryReader path:
    let o = 1;
    const killed = [];
    // eat events: repeat uint32 until 0
    while (true){
      const id = dv.getUint32(o, true); o+=4;
      if (id === 0) break;
      const killer = dv.getUint32(o, true); o+=4;
      killed.push([id,killer]);
    }
    // updates
    while (true){
      const id = dv.getUint32(o, true); o+=4;
      if (id === 0) break;
      const type = dv.getUint8(o); o+=1;

      let x,y,size,playerId=0;
      if (type === 1){
        // server-side food pseudo-random, skip here (we still read color/name below)
        x = dv.getInt32(o,true); o+=4;
        y = dv.getInt32(o,true); o+=4;
        size = dv.getUint16(o,true); o+=2;
      } else {
        if (type === 0){ playerId = dv.getUint32(o,true); o+=4; }
        x = dv.getInt32(o,true); o+=4;
        y = dv.getInt32(o,true); o+=4;
        size = dv.getUint16(o,true); o+=2;
      }
      const r = dv.getUint8(o); o+=1;
      const g = dv.getUint8(o); o+=1;
      const b = dv.getUint8(o); o+=1;
      let color = '#' + [r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('');
      const flags = dv.getUint8(o); o+=1;
      const name = readUtf8String(dv, ()=>{ const v=dv.getUint8(o); return (o<dv.byteLength) && v!==0 ? (o++, v) : (o++, 0); });

      this.renderer.upsertNode(id, x, y, size, color, name, flags);
      if (playerId && playerId === this.ownerId) this.renderer.setPlayerId(id);
    }
    // removes
    while (o < dv.byteLength){
      const rem = dv.getUint32(o, true); o+=4;
      if (rem) this.renderer.removeNode(rem);
    }
    // score estimate
    const myNodes = [...this.renderer.playerIds].map(id=>this.renderer.nodes.get(id)).filter(Boolean);
    const score = Math.floor(myNodes.reduce((s,n)=>s+n.size,0));
    const scoreEl = document.getElementById('score');
    if (scoreEl) scoreEl.textContent = String(score);
  }

  _parseLeaderboard(dv, mode){
    let o=1;
    const n = dv.getUint32(o,true); o+=4;
    const rows = [];
    for (let i=0;i<n;i++){
      const id = dv.getUint32(o,true); o+=4;
      // name (utf16 in original; some servers send utf16 here)
      let name="";
      while (true){
        const ch = dv.getUint16(o,true); o+=2;
        if (ch===0) break;
        name += String.fromCharCode(ch);
      }
      // xp (uint32), can be absent on some forks; guard with bounds
      if (o+4 <= dv.byteLength){
        const xp = dv.getUint32(o,true); o+=4;
        rows.push({id, name, xp});
      } else {
        rows.push({id, name, xp:0});
      }
    }
    const el = document.getElementById('leaderboard');
    const html = ['<h4>Лидерборд</h4>'].concat(rows.map((r,i)=>`<div class="row"><span>${i+1}</span><span>${r.name||'—'}</span></div>`)).join("");
    if (el) el.innerHTML = html;
  }

  _parseChat(dv){
    let o=1; // flags was in old path, but here first byte after opcode used as flags in sender; some servers pack rgb then strings.
    const flags = dv.getUint8(o); o+=1;
    const r = dv.getUint8(o); o+=1;
    const g = dv.getUint8(o); o+=1;
    const b = dv.getUint8(o); o+=1;
    const color = '#' + [r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('');

    // Optional XP + pId in some forks; try to read safely
    let xp=0,pid=0;
    if (o+4 <= dv.byteLength){ xp = dv.getUint32(o,true); o+=4; }
    if (o+2 <= dv.byteLength){ pid = dv.getUint16(o,true); o+=2; }

    // name utf16
    let name="";
    while (o+2<=dv.byteLength){
      const ch = dv.getUint16(o,true); o+=2;
      if (ch===0) break;
      name += String.fromCharCode(ch);
    }
    // message utf16
    let text="";
    while (o+2<=dv.byteLength){
      const ch = dv.getUint16(o,true); o+=2;
      if (ch===0) break;
      text += String.fromCharCode(ch);
    }
    const feed = document.getElementById('chat-feed');
    if (feed){
      const div = document.createElement('div');
      div.innerHTML = `<span style="color:${color}">${name||'?'}</span>: ${text}`;
      feed.appendChild(div);
      feed.scrollTop = feed.scrollHeight;
    }
  }
}
