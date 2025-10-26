// Minimal WebGL2 renderer that draws cells as circular points.
export class Renderer{
  constructor(gl, canvas){
    this.gl = gl; this.canvas = canvas;
    this.dpr = Math.max(1, devicePixelRatio||1);
    this.zoom = 1.0;
    this.camX = 0; this.camY = 0;
    this.border = {left:-5000, top:-5000, right:5000, bottom:5000};

    // nodes map: id -> {x,y,size,color:[r,g,b],name,flags}
    this.nodes = new Map();
    this.playerIds = new Set();

    this._initGL();
    addEventListener('resize', ()=>this._resize());
    this._resize();
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  _initGL(){
    const gl = this.gl;
    const vs = `#version 300 es
      precision highp float;
      layout(location=0) in vec2 a_pos;
      layout(location=1) in float a_size;
      layout(location=2) in vec3 a_color;
      uniform vec2 u_cam;
      uniform float u_zoom;
      uniform vec2 u_view;
      out vec3 v_color;
      out float v_size;
      void main(){
        // world to screen
        vec2 p = (a_pos - u_cam) * u_zoom + u_view*0.5;
        // convert to NDC
        vec2 ndc = (p / u_view)*2.0 - 1.0;
        gl_Position = vec4(ndc, 0.0, 1.0);
        gl_PointSize = a_size * u_zoom;
        v_color = a_color;
        v_size = a_size * u_zoom;
      }`;
    const fs = `#version 300 es
      precision highp float;
      in vec3 v_color;
      in float v_size;
      out vec4 outColor;
      void main(){
        // make circle inside point
        vec2 uv = gl_PointCoord*2.0-1.0;
        float d = length(uv);
        float alpha = smoothstep(1.0, 0.98, d);
        outColor = vec4(v_color, alpha);
      }`;
    const prog = this._createProgram(vs, fs);
    this.prog = prog;
    this.u_cam = this.gl.getUniformLocation(prog, "u_cam");
    this.u_zoom = this.gl.getUniformLocation(prog, "u_zoom");
    this.u_view = this.gl.getUniformLocation(prog, "u_view");

    // buffers
    this.maxCount = 20000;
    this.pos = gl.createBuffer();
    this.size = gl.createBuffer();
    this.color = gl.createBuffer();

    gl.bindBuffer(gl.ARRAY_BUFFER, this.pos);
    gl.bufferData(gl.ARRAY_BUFFER, this.maxCount*2*4, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.size);
    gl.bufferData(gl.ARRAY_BUFFER, this.maxCount*4, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.color);
    gl.bufferData(gl.ARRAY_BUFFER, this.maxCount*3*4, gl.DYNAMIC_DRAW);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0.04,0.05,0.08,1);
  }

  _createShader(type, src){
    const gl = this.gl; const sh = gl.createShader(type);
    gl.shaderSource(sh, src); gl.compileShader(sh);
    if(!gl.getShaderParameter(sh, gl.COMPILE_STATUS)){
      throw new Error(gl.getShaderInfoLog(sh));
    }
    return sh;
  }
  _createProgram(vs, fs){
    const gl = this.gl;
    const p = gl.createProgram();
    gl.attachShader(p, this._createShader(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, this._createShader(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if(!gl.getProgramParameter(p, gl.LINK_STATUS)){
      throw new Error(gl.getProgramInfoLog(p));
    }
    return p;
  }

  _resize(){
    const gl = this.gl;
    const w = Math.floor(innerWidth*this.dpr);
    const h = Math.floor(innerHeight*this.dpr);
    this.canvas.width = w; this.canvas.height = h;
    this.canvas.style.width = innerWidth+'px';
    this.canvas.style.height = innerHeight+'px';
    gl.viewport(0,0,w,h);
  }

  setBorder(left, top, right, bottom){
    this.border = {left, top, right, bottom};
    // center camera by default
    this.camX = (left+right)/2; this.camY = (top+bottom)/2;
  }

  upsertNode(id, x, y, size, colorHex, name, flags){
    // colorHex like "#rrggbb"
    const r = parseInt(colorHex.slice(1,3),16)/255;
    const g = parseInt(colorHex.slice(3,5),16)/255;
    const b = parseInt(colorHex.slice(5,7),16)/255;
    this.nodes.set(id, {x,y,size, color:[r,g,b], name, flags});
  }
  removeNode(id){ this.nodes.delete(id); }
  setPlayerId(id){ this.playerIds.add(id); }

  setCameraToPlayer(){
    for(const id of this.playerIds){
      const n = this.nodes.get(id);
      if(n){ this.camX = n.x; this.camY = n.y; return; }
    }
  }

  zoomBy(delta){
    const factor = Math.pow(0.9, delta);
    this.zoom = Math.min(Math.max(this.zoom*factor, 0.3), 4.0);
  }

  draw(){
    const gl = this.gl;
    gl.clear(gl.COLOR_BUFFER_BIT);

    const count = Math.min(this.nodes.size, this.maxCount);
    const pos = new Float32Array(count*2);
    const size = new Float32Array(count);
    const col = new Float32Array(count*3);

    let i=0;
    for(const [_, n] of this.nodes){
      pos[i*2+0]=n.x; pos[i*2+1]=n.y;
      size[i]=n.size;
      col[i*3+0]=n.color[0]; col[i*3+1]=n.color[1]; col[i*3+2]=n.color[2];
      i++; if(i>=count) break;
    }

    gl.useProgram(this.prog);
    gl.uniform2f(this.u_cam, this.camX, this.camY);
    gl.uniform1f(this.u_zoom, this.zoom);
    gl.uniform2f(this.u_view, this.canvas.width, this.canvas.height);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.pos);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, pos);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.size);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, size);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.color);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, col);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.POINTS, 0, count);
  }

  _loop(){
    this.setCameraToPlayer();
    this.draw();
    requestAnimationFrame(this._loop);
  }
}
