/* eslint-disable */

import dat from 'dat.gui';
import { mat3, mat4, quat, vec3 } from 'gl-matrix';
import * as Cesium from 'Cesium';
import Previous from '../index.js';
/** @preserve Javascript graphics utility library
 * Helper functions, WebGL classes, Mouse input, Colours and Gradients UI
 * Copyright (c) 2014, Owen Kaluza
 * Released into public domain:
 * This program is free software. It comes without any warranty, to
 * the extent permitted by applicable law. You can redistribute it
 * and/or modify it as long as this header remains intact
 */
//Miscellaneous javascript helper functions
//Module definition, TODO: finish module
//Previous.SVData代替DTGloe

var OK = (function () {
  var ok = {};

  ok.debug_on = false;
  ok.debug = function (str) {
    if (!ok.debug_on) return;
    var uconsole = document.getElementById('console');
    if (uconsole) uconsole.innerHTML = '<div style="font-family: \'monospace\'; font-size: 8pt;">' + str + '</div>' + uconsole.innerHTML;
    else console.log(str);
  };

  ok.clear = function consoleClear() {
    var uconsole = document.getElementById('console');
    if (uconsole) uconsole.innerHTML = '';
  };

  return ok;
})();

function getSearchVariable(variable, defaultVal) {
  var query = window.location.search.substring(1);
  var vars = query.split('&');
  for (var i = 0; i < vars.length; i++) {
    var pair = vars[i].split('=');
    if (unescape(pair[0]) == variable) {
      return unescape(pair[1]);
    }
  }
  return defaultVal;
}

function getImageDataURL(img) {
  var canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  var ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  var dataURL = canvas.toDataURL('image/png');
  return dataURL;
}

//DOM

//Shortcuts for element and style lookup
if (!window.$) {
  window.$ = function (v, o) {
    return (typeof o == 'object' ? o : document).getElementById(v);
  };
}
if (!window.$S) {
  window.$S = function (o) {
    o = $(o);
    if (o) return o.style;
  };
}
if (!window.toggle) {
  window.toggle = function (v) {
    var d = $S(v).display;
    if (d == 'none' || !d) $S(v).display = 'block';
    else $S(v).display = 'none';
  };
}

//Set display style of all elements of classname
function setAll(display, classname) {
  var elements = document.getElementsByClassName(classname);
  for (var i = 0; i < elements.length; i++) elements[i].style.display = display;
}

//Get some data stored in a script element
function getSourceFromElement(id) {
  var script = document.getElementById(id);
  if (!script) return null;
  var str = '';
  var k = script.firstChild;
  while (k) {
    if (k.nodeType == 3) str += k.textContent;
    k = k.nextSibling;
  }
  return str;
}

function removeChildren(element) {
  if (element.hasChildNodes()) {
    while (element.childNodes.length > 0) element.removeChild(element.firstChild);
  }
}

//Browser specific animation frame request
if (!window.requestAnimationFrame) {
  window.requestAnimationFrame = (function () {
    return window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || window.oRequestAnimationFrame || window.msRequestAnimationFrame;
  })();
}

//Browser specific full screen request
function requestFullScreen(id) {
  var element = document.getElementById(id);
  if (element.requestFullscreen) element.requestFullscreen();
  else if (element.mozRequestFullScreen) element.mozRequestFullScreen();
  else if (element.webkitRequestFullScreen) element.webkitRequestFullScreen();
}

function typeOf(value) {
  var s = typeof value;
  if (s === 'object') {
    if (value) {
      if (typeof value.length === 'number' && !value.propertyIsEnumerable('length') && typeof value.splice === 'function') {
        s = 'array';
      }
    } else {
      s = 'null';
    }
  }
  return s;
}

function isEmpty(o) {
  var i, v;
  if (typeOf(o) === 'object') {
    for (i in o) {
      v = o[i];
      if (v !== undefined && typeOf(v) !== 'function') {
        return false;
      }
    }
  }
  return true;
}

//AJAX
//Reads a file from server, responds when done with file data + passed name to callback function
function ajaxReadFile(filename, callback, nocache, progress, headers) {
  var http = new XMLHttpRequest();
  var total = 0;
  if (progress != undefined) {
    if (typeof progress == 'number') total = progress;
    else http.onprogress = progress;
  }

  http.onreadystatechange = function () {
    if (total > 0 && http.readyState > 2) {
      //Passed size progress
      var recvd = parseInt(http.responseText.length);
      //total = parseInt(http.getResponseHeader('Content-length'))
      if (progress) setProgress((recvd / total) * 100);
    }

    if (http.readyState == 4) {
      if (http.status == 200) {
        if (progress) setProgress(100);
        OK.debug('RECEIVED: ' + filename);
        if (callback) callback(http.responseText, filename);
      } else {
        if (callback) callback('Error: ' + http.status + ' : ' + filename); //Error callback
        else OK.debug('Ajax Read File Error: returned status code ' + http.status + ' ' + http.statusText);
      }
    }
  };

  //Add date to url to prevent caching
  if (nocache) {
    var d = new Date();
    http.open('GET', filename + '?d=' + d.getTime(), true);
  } else http.open('GET', filename, true);

  //Custom headers
  for (var key in headers) http.setRequestHeader(key, headers[key]);

  http.send(null);
}

function readURL(url, nocache, progress) {
  //Read url (synchronous)
  var http = new XMLHttpRequest();
  var total = 0;
  if (progress != undefined) {
    if (typeof progress == 'number') total = progress;
    else http.onprogress = progress;
  }

  http.onreadystatechange = function () {
    if (total > 0 && http.readyState > 2) {
      //Passed size progress
      var recvd = parseInt(http.responseText.length);
      //total = parseInt(http.getResponseHeader('Content-length'))
      if (progress) setProgress((recvd / total) * 100);
    }
  };

  //Add date to url to prevent caching
  if (nocache) {
    var d = new Date();
    http.open('GET', url + '?d=' + d.getTime(), false);
  } else http.open('GET', url, false);
  http.overrideMimeType('text/plain; charset=x-user-defined');
  http.send(null);
  if (http.status != 200) return '';
  if (progress) setProgress(100);
  return http.responseText;
}

function updateProgress(evt) {
  //evt.loaded: bytes browser received/sent
  //evt.total: total bytes set in header by server (for download) or from client (upload)
  if (evt.lengthComputable) {
    setProgress((evt.loaded / evt.total) * 100);
    OK.debug(evt.loaded + ' / ' + evt.total);
  }
}

function setProgress(percentage) {
  var val = Math.round(percentage);
  $S('progressbar').width = 3 * val + 'px';
  $('progressstatus').innerHTML = val + '%';
}

//Posts request to server, responds when done with response data to callback function
function ajaxPost(url, params, callback, progress, headers) {
  var http = new XMLHttpRequest();
  if (progress != undefined) http.upload.onprogress = progress;

  http.onreadystatechange = function () {
    if (http.readyState == 4) {
      if (http.status == 200) {
        if (progress) setProgress(100);
        OK.debug('POST: ' + url);
        if (callback) callback(http.responseText);
      } else {
        if (callback) callback('Error, status:' + http.status); //Error callback
        else OK.debug('Ajax Post Error: returned status code ' + http.status + ' ' + http.statusText);
      }
    }
  };

  http.open('POST', url, true);

  //Send the proper header information along with the request
  if (typeof params == 'string') {
    http.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
    http.setRequestHeader('Content-length', params.length);
  }

  //Custom headers
  if (headers) {
    //alert(key + " : " + headers[key]);
    for (key in headers) http.setRequestHeader(key, headers[key]);
  }

  http.send(params);
}

var defaultMouse;
var dragMouse; //Global drag tracking

//Handler class from passed functions
/**
 * @constructor
 */
function MouseEventHandler(click, wheel, move, down, up, leave, pinch) {
  //All these functions should take (event, mouse)
  this.click = click;
  this.wheel = wheel;
  this.move = move;
  this.down = down;
  this.up = up;
  this.leave = leave;
  this.pinch = pinch;
}

/**
 * @constructor
 */
function Mouse(element, handler, enableContext) {
  this.element = element;
  //Custom handler for mouse actions...
  //requires members: click(event, mouse), move(event, mouse) and wheel(event, mouse)
  this.handler = handler;

  this.disabled = false;
  this.isdown = false;
  this.button = null;
  this.dragged = false;
  this.x = 0;
  this.x = 0;
  this.absoluteX = 0;
  this.absoluteY = 0;
  this.lastX = 0;
  this.lastY = 0;
  this.slider = null;
  this.spin = 0;
  //Option settings...
  this.moveUpdate = false; //Save mouse move origin once on mousedown or every move
  this.enableContext = enableContext ? true : false;

  element.addEventListener('onwheel' in document ? 'wheel' : 'mousewheel', handleMouseWheel, false);
  element.onmousedown = handleMouseDown;
  element.onmouseout = handleMouseLeave;
  document.onmouseup = handleMouseUp;
  document.onmousemove = handleMouseMove;
  //Touch events! testing...
  element.addEventListener('touchstart', touchHandler, true);
  element.addEventListener('touchmove', touchHandler, true);
  element.addEventListener('touchend', touchHandler, true);
  //To disable context menu
  element.oncontextmenu = function () {
    return this.mouse.enableContext;
  };
}

Mouse.prototype.setDefault = function () {
  //Sets up this mouse as the default for the document
  //Multiple mouse handlers can be created for elements but only
  //one should be set to handle document events
  defaultMouse = document.mouse = this;
};

Mouse.prototype.update = function (e) {
  // Get the mouse position relative to the document.
  if (!e) var e = window.event;
  var coord = mousePageCoord(e);
  this.x = coord[0];
  this.y = coord[1];

  //Save doc relative coords
  this.absoluteX = this.x;
  this.absoluteY = this.y;
  //Get element offset in document
  var offset = findElementPos(this.element);
  //Convert coords to position relative to element
  this.x -= offset[0];
  this.y -= offset[1];
  //Save position without scrolling, only checked in ff5 & chrome12
  this.clientx = e.clientX - offset[0];
  this.clienty = e.clientY - offset[1];
};

function mousePageCoord(event) {
  //Note: screen relative coords are only that are consistent (e.screenX/Y)
  var x, y;
  if (event.pageX || event.pageY) {
    x = event.pageX;
    y = event.pageY;
  } else {
    x = event.clientX + document.body.scrollLeft + document.documentElement.scrollLeft;
    y = event.clientY + document.body.scrollTop + document.documentElement.scrollTop;
  }
  return [x, y];
}

function elementRelativeCoord(element, coord) {
  var offset = findElementPos(element);
  coord[0] -= offset[0];
  coord[1] -= offset[1];
}

// Get offset of element
function findElementPos(obj) {
  var curleft = 0,
    curtop = 0;
  //if (obj.offsetParent) { //Fix for chrome not getting actual object's offset here
  do {
    curleft += obj.offsetLeft;
    curtop += obj.offsetTop;
  } while ((obj = obj.offsetParent));
  //}
  return [curleft, curtop];
}

function getMouse(event) {
  if (!event) event = window.event; //access the global (window) event object
  var mouse = event.target.mouse;
  if (mouse) return mouse;
  //Attempt to find in parent nodes
  var target = event.target;
  var i = 0;
  while (target != document) {
    target = target.parentNode;
    if (target.mouse) return target.mouse;
  }

  return null;
}

function handleMouseDown(event) {
  //Event delegation details
  var mouse = getMouse(event);
  if (!mouse || mouse.disabled) return true;
  var e = event || window.event;
  mouse.target = e.target;
  //Clear dragged flag on mouse down
  mouse.dragged = false;

  mouse.update(event);
  if (!mouse.isdown) {
    mouse.lastX = mouse.absoluteX;
    mouse.lastY = mouse.absoluteY;
  }
  mouse.isdown = true;
  dragMouse = mouse;
  mouse.button = event.button;
  //Set document move & up event handlers to this.mouse object's
  document.mouse = mouse;

  //Handler for mouse down
  var action = true;
  if (mouse.handler.down) action = mouse.handler.down(event, mouse);
  //If handler returns false, prevent default action
  if (!action && event.preventDefault) event.preventDefault();
  return action;
}

//Default handlers for up & down, call specific handlers on element
function handleMouseUp(event) {
  var mouse = document.mouse;
  if (!mouse || mouse.disabled) return true;
  var action = true;
  if (mouse.isdown) {
    mouse.update(event);
    if (mouse.handler.click) action = mouse.handler.click(event, mouse);
    mouse.isdown = false;
    dragMouse = null;
    mouse.button = null;
    mouse.dragged = false;
  }
  if (mouse.handler.up) action = action && mouse.handler.up(event, mouse);
  //Restore default mouse on document
  document.mouse = defaultMouse;

  //If handler returns false, prevent default action
  if (!action && event.preventDefault) event.preventDefault();
  return action;
}

function handleMouseMove(event) {
  //Use previous mouse if dragging
  var mouse = dragMouse ? dragMouse : getMouse(event);
  if (!mouse || mouse.disabled) return true;
  mouse.update(event);
  mouse.deltaX = mouse.absoluteX - mouse.lastX;
  mouse.deltaY = mouse.absoluteY - mouse.lastY;
  var action = true;

  //Set dragged flag if moved more than limit
  if (!mouse.dragged && mouse.isdown && Math.abs(mouse.deltaX) + Math.abs(mouse.deltaY) > 3) mouse.dragged = true;

  if (mouse.handler.move) action = mouse.handler.move(event, mouse);

  if (mouse.moveUpdate) {
    //Constant update of last position
    mouse.lastX = mouse.absoluteX;
    mouse.lastY = mouse.absoluteY;
  }

  //If handler returns false, prevent default action
  if (!action && event.preventDefault) event.preventDefault();
  return action;
}

function handleMouseWheel(event) {
  var mouse = getMouse(event);
  if (!mouse || mouse.disabled) return true;
  mouse.update(event);
  var action = false; //Default action disabled

  var delta = event.deltaY ? -event.deltaY : event.wheelDelta;
  event.spin = delta > 0 ? 1 : -1;

  if (mouse.handler.wheel) action = mouse.handler.wheel(event, mouse);

  //If handler returns false, prevent default action
  if (!action && event.preventDefault) event.preventDefault();
  return action;
}

function handleMouseLeave(event) {
  var mouse = getMouse(event);
  if (!mouse || mouse.disabled) return true;

  var action = true;
  if (mouse.handler.leave) action = mouse.handler.leave(event, mouse);

  //If handler returns false, prevent default action
  if (!action && event.preventDefault) event.preventDefault();
  event.returnValue = action; //IE
  return action;
}

//Basic touch event handling
//Based on: http://ross.posterous.com/2008/08/19/iphone-touch-events-in-javascript/
//Pinch handling all by OK
function touchHandler(event) {
  var touches = event.changedTouches,
    first = touches[0],
    simulate = null, //Mouse event to simulate
    prevent = false,
    mouse = getMouse(event);

  switch (event.type) {
    case 'touchstart':
      if (event.touches.length == 2) {
        mouse.isdown = false; //Ignore first pinch touchdown being processed as mousedown
        mouse.scaling = 0;
      } else simulate = 'mousedown';
      break;
    case 'touchmove':
      if (mouse.scaling != null && event.touches.length == 2) {
        var dist = Math.sqrt(
          (event.touches[0].pageX - event.touches[1].pageX) * (event.touches[0].pageX - event.touches[1].pageX) +
            (event.touches[0].pageY - event.touches[1].pageY) * (event.touches[0].pageY - event.touches[1].pageY)
        );

        if (mouse.scaling > 0) {
          event.distance = dist - mouse.scaling;
          if (mouse.handler.pinch) action = mouse.handler.pinch(event, mouse);
          //If handler returns false, prevent default action
          var action = true;
          if (!action && event.preventDefault) event.preventDefault(); // Firefox
          event.returnValue = action; //IE
        } else mouse.scaling = dist;
      } else simulate = 'mousemove';
      break;
    case 'touchend':
      if (mouse.scaling != null) {
        //Pinch sends two touch start/end,
        //only turn off scaling after 2nd touchend
        if (mouse.scaling == 0) mouse.scaling = null;
        else mouse.scaling = 0;
      } else simulate = 'mouseup';
      break;
    default:
      return;
  }
  if (event.touches.length > 1)
    //Avoid processing multiple touch except pinch zoom
    simulate = null;

  //Passes other events on as simulated mouse events
  if (simulate) {
    //OK.debug(event.type + " - " + event.touches.length + " touches");

    //initMouseEvent(type, canBubble, cancelable, view, clickCount,
    //           screenX, screenY, clientX, clientY, ctrlKey,
    //           altKey, shiftKey, metaKey, button, relatedTarget);
    var simulatedEvent = document.createEvent('MouseEvent');
    simulatedEvent.initMouseEvent(
      simulate,
      true,
      true,
      window,
      1,
      first.screenX,
      first.screenY,
      first.clientX,
      first.clientY,
      event.ctrlKey,
      event.altKey,
      event.shiftKey,
      event.metaKey,
      0 /*left*/,
      null
    );

    //Prevent default where requested
    prevent = !first.target.dispatchEvent(simulatedEvent);
    event.preventDefault();
  }

  //if (prevent || scaling)
  //  event.preventDefault();
}

/**
 * WebGL interface object
 * standard utilities for WebGL
 * Shader & matrix utilities for 3d & 2d
 * functions for 2d rendering / image processing
 * (c) Owen Kaluza 2012
 */

/**
 * @constructor
 */
function Viewport(x, y, width, height) {
  this.x = x;
  this.y = y;
  this.width = width;
  this.height = height;
}

/**
 * @constructor
 */
function WebGL(canvas, options) {
  this.program = null;
  this.modelView = new ViewMatrix();
  this.perspective = new ViewMatrix();
  this.textures = [];
  this.timer = null;

  if (!window.WebGLRenderingContext) throw 'No browser WebGL support';

  // Try to grab the standard context. If it fails, fallback to experimental.
  try {
    this.gl = canvas.getContext('webgl', options) || canvas.getContext('experimental-webgl', options);
  } catch (e) {
    OK.debug('detectGL exception: ' + e);
    throw 'No context';
  }
  this.viewport = new Viewport(0, 0, canvas.width, canvas.height);
  if (!this.gl) throw 'Failed to get context';
}

WebGL.prototype.setMatrices = function () {
  //Model view matrix
  this.gl.uniformMatrix4fv(this.program.mvMatrixUniform, false, this.modelView.matrix);
  //Perspective matrix
  this.gl.uniformMatrix4fv(this.program.pMatrixUniform, false, this.perspective.matrix);
  //Normal matrix
  if (this.program.nMatrixUniform) {
    var nMatrix = mat4.create();
    mat4.invert(nMatrix, this.modelView.matrix);
    mat4.transpose(nMatrix, nMatrix);
    this.gl.uniformMatrix4fv(this.program.nMatrixUniform, false, nMatrix);
  }
};

WebGL.prototype.initDraw2d = function () {
  this.gl.viewport(this.viewport.x, this.viewport.y, this.viewport.width, this.viewport.height);

  this.gl.enableVertexAttribArray(this.program.attributes['aVertexPosition']);
  this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexPositionBuffer);
  this.gl.vertexAttribPointer(this.program.attributes['aVertexPosition'], this.vertexPositionBuffer.itemSize, this.gl.FLOAT, false, 0, 0);

  if (this.program.attributes['aTextureCoord']) {
    this.gl.enableVertexAttribArray(this.program.attributes['aTextureCoord']);
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.textureCoordBuffer);
    this.gl.vertexAttribPointer(this.program.attributes['aTextureCoord'], this.textureCoordBuffer.itemSize, this.gl.FLOAT, false, 0, 0);
  }

  this.setMatrices();
};

WebGL.prototype.updateTexture = function (texture, image, unit) {
  //Set default texture unit if not provided
  if (unit == undefined) unit = this.gl.TEXTURE0;
  this.gl.activeTexture(unit);
  this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
  this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, image);
  this.gl.bindTexture(this.gl.TEXTURE_2D, null);
};

WebGL.prototype.init2dBuffers = function (unit) {
  //Set default texture unit if not provided
  if (unit == undefined) unit = this.gl.TEXTURE0;
  //All output drawn onto a single 2x2 quad
  this.vertexPositionBuffer = this.gl.createBuffer();
  this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexPositionBuffer);
  var vertexPositions = [1.0, 1.0, -1.0, 1.0, 1.0, -1.0, -1.0, -1.0];
  this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(vertexPositions), this.gl.STATIC_DRAW);
  this.vertexPositionBuffer.itemSize = 2;
  this.vertexPositionBuffer.numItems = 4;

  //Gradient texture
  this.gl.activeTexture(unit);
  this.gradientTexture = this.gl.createTexture();
  this.gl.bindTexture(this.gl.TEXTURE_2D, this.gradientTexture);

  this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);
  this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);

  //Texture coords
  this.textureCoordBuffer = this.gl.createBuffer();
  this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.textureCoordBuffer);
  var textureCoords = [1.0, 1.0, 0.0, 1.0, 1.0, 0.0, 0.0, 0.0];
  this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(textureCoords), this.gl.STATIC_DRAW);
  this.textureCoordBuffer.itemSize = 2;
  this.textureCoordBuffer.numItems = 4;
};

WebGL.prototype.loadTexture = function (image, filter) {
  if (filter == undefined) filter = this.gl.NEAREST;
  this.texid = this.textures.length;
  this.textures.push(this.gl.createTexture());
  this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures[this.texid]);
  //this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, true);
  //(Ability to set texture type?)
  this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.LUMINANCE, this.gl.LUMINANCE, this.gl.UNSIGNED_BYTE, image);
  //this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, image);
  this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, filter);
  this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, filter);
  this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
  this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
  this.gl.bindTexture(this.gl.TEXTURE_2D, null);
  return this.textures[this.texid];
};

WebGL.prototype.setPerspective = function (fovy, aspect, znear, zfar) {
  this.perspective.matrix = mat4.create();
  mat4.perspective(this.perspective.matrix, fovy, aspect, znear, zfar);
};

WebGL.prototype.use = function (program) {
  this.program = program;
  if (this.program.program) this.gl.useProgram(this.program.program);
};

/**
 * @constructor
 */
//Program object
function WebGLProgram(gl, vs, fs) {
  //Can be passed source directly or script tag
  this.program = null;
  if (vs.indexOf('main') < 0) vs = getSourceFromElement(vs);
  if (fs.indexOf('main') < 0) fs = getSourceFromElement(fs);
  //Pass in vertex shader, fragment shaders...
  this.gl = gl;
  if (this.program && this.gl.isProgram(this.program)) {
    //Clean up previous shader set
    if (this.gl.isShader(this.vshader)) {
      this.gl.detachShader(this.program, this.vshader);
      this.gl.deleteShader(this.vshader);
    }
    if (this.gl.isShader(this.fshader)) {
      this.gl.detachShader(this.program, this.fshader);
      this.gl.deleteShader(this.fshader);
    }
    this.gl.deleteProgram(this.program); //Required for chrome, doesn't like re-using this.program object
  }

  this.program = this.gl.createProgram();

  this.vshader = this.compileShader(vs, this.gl.VERTEX_SHADER);
  this.fshader = this.compileShader(fs, this.gl.FRAGMENT_SHADER);

  this.gl.attachShader(this.program, this.vshader);
  this.gl.attachShader(this.program, this.fshader);

  this.gl.linkProgram(this.program);

  if (!this.gl.getProgramParameter(this.program, this.gl.LINK_STATUS)) {
    throw 'Could not initialise shaders: ' + this.gl.getProgramInfoLog(this.program);
  }
}

WebGLProgram.prototype.compileShader = function (source, type) {
  //alert("Compiling " + type + " Source == " + source);
  var shader = this.gl.createShader(type);
  this.gl.shaderSource(shader, source);
  this.gl.compileShader(shader);
  if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) throw this.gl.getShaderInfoLog(shader);
  return shader;
};

//Setup and load uniforms
WebGLProgram.prototype.setup = function (attributes, uniforms, noenable) {
  if (!this.program) return;
  if (attributes == undefined) attributes = ['aVertexPosition', 'aTextureCoord'];
  this.attributes = {};
  var i;
  for (i in attributes) {
    this.attributes[attributes[i]] = this.gl.getAttribLocation(this.program, attributes[i]);
    if (!noenable) this.gl.enableVertexAttribArray(this.attributes[attributes[i]]);
  }

  this.uniforms = {};
  for (i in uniforms) this.uniforms[uniforms[i]] = this.gl.getUniformLocation(this.program, uniforms[i]);
  this.mvMatrixUniform = this.gl.getUniformLocation(this.program, 'uMVMatrix');
  this.pMatrixUniform = this.gl.getUniformLocation(this.program, 'uPMatrix');
  this.nMatrixUniform = this.gl.getUniformLocation(this.program, 'uNMatrix');
};

/**
 * @constructor
 */
function ViewMatrix() {
  this.matrix = mat4.create();
  mat4.identity(this.matrix);
  this.stack = [];
}

ViewMatrix.prototype.toString = function () {
  return JSON.stringify(this.toArray());
};

ViewMatrix.prototype.toArray = function () {
  return JSON.parse(mat4.str(this.matrix));
};

ViewMatrix.prototype.push = function (m) {
  if (m) {
    this.stack.push(mat4.create(m));
    this.matrix = mat4.create(m);
  } else {
    this.stack.push(mat4.create(this.matrix));
  }
};

ViewMatrix.prototype.pop = function () {
  if (this.stack.length == 0) {
    throw 'Matrix stack underflow';
  }
  this.matrix = this.stack.pop();
  return this.matrix;
};

ViewMatrix.prototype.mult = function (m) {
  mat4.multiply(this.matrix, this.matrix, m);
};

ViewMatrix.prototype.identity = function () {
  mat4.identity(this.matrix);
};

ViewMatrix.prototype.scale = function (v) {
  mat4.scale(this.matrix, this.matrix, v);
};

ViewMatrix.prototype.translate = function (v) {
  mat4.translate(this.matrix, this.matrix, v);
};

ViewMatrix.prototype.rotate = function (angle, v) {
  var arad = (angle * Math.PI) / 180.0;
  mat4.rotate(this.matrix, this.matrix, arad, v);
};

/**
 * @constructor
 */
function Palette(source, premultiply) {
  this.premultiply = premultiply;
  //Default transparent black background
  this.background = new Colour('rgba(0,0,0,0)');
  //Colour palette array
  this.colours = [];
  this.slider = new Image();
  this.slider.src =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAkAAAAPCAYAAAA2yOUNAAAAj0lEQVQokWNIjHT8/+zZs//Pnj37/+TJk/9XLp/+f+bEwf9HDm79v2Prqv9aKrz/GUYVEaeoMDMQryJXayWIoi0bFmFV1NWS+z/E1/Q/AwMDA0NVcez/LRsWoSia2luOUAADVcWx/xfO6/1/5fLp/1N7y//HhlmhKoCBgoyA/w3Vyf8jgyyxK4CBUF8zDAUAAJRXY0G1eRgAAAAASUVORK5CYII=';

  if (!source) {
    //Default greyscale
    this.colours.push(new ColourPos('rgba(255,255,255,1)', 0));
    this.colours.push(new ColourPos('rgba(0,0,0,1)', 1.0));
    return;
  }

  var calcPositions = false;

  if (typeof source == 'string') {
    //Palette string data parser
    var lines = source.split(/[\n;]/); // split on newlines and/or semi-colons
    var position;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) continue;

      //Palette: parse into attrib=value pairs
      var pair = line.split('=');
      if (pair[0] == 'Background') this.background = new Colour(pair[1]);
      else if (pair[0][0] == 'P')
        //Very old format: PositionX=
        position = parseFloat(pair[1]);
      else if (pair[0][0] == 'C') {
        //Very old format: ColourX=
        //Colour constructor handles html format colours, if no # or rgb/rgba assumes integer format
        this.colours.push(new ColourPos(pair[1], position));
        //Some old palettes had extra colours at end which screws things up so check end position
        if (position == 1.0) break;
      } else if (pair.length == 2) {
        //New style: position=value
        this.colours.push(new ColourPos(pair[1], pair[0]));
      } else {
        //Interpret as colour only, calculate positions
        calcPositions = true;
        this.colours.push(new ColourPos(line));
      }
    }
  } else {
    //JSON colour/position list data
    for (var j = 0; j < source.length; j++) {
      //Calculate default positions if none provided
      if (source[j].position == undefined) calcPositions = true;
      //Create the entry
      this.colours.push(new ColourPos(source[j].colour, source[j].position));
    }
    //Use background if included
    if (source.background) this.background = new Colour(source.background);
  }

  //Calculate default positions
  if (calcPositions) {
    for (var j = 0; j < this.colours.length; j++) this.colours[j].position = j * (1.0 / (this.colours.length - 1));
  }

  //Sort by position (fix out of order entries in old palettes)
  this.sort();

  //Check for all-transparent palette and fix
  var opaque = false;
  for (var c = 0; c < this.colours.length; c++) {
    if (this.colours[c].colour.alpha > 0) opaque = true;
    //Fix alpha=255
    if (this.colours[c].colour.alpha > 1.0) this.colours[c].colour.alpha = 1.0;
  }
  if (!opaque) {
    for (var c = 0; c < this.colours.length; c++) this.colours[c].colour.alpha = 1.0;
  }
}

Palette.prototype.sort = function () {
  this.colours.sort(function (a, b) {
    return a.position - b.position;
  });
};

Palette.prototype.newColour = function (position, colour) {
  var col = new ColourPos(colour, position);
  this.colours.push(col);
  this.sort();
  for (var i = 1; i < this.colours.length - 1; i++) if (this.colours[i].position == position) return i;
  return -1;
};

Palette.prototype.inRange = function (pos, range, length) {
  for (var i = 0; i < this.colours.length; i++) {
    var x = this.colours[i].position * length;
    if (pos == x || (range > 1 && pos >= x - range / 2 && pos <= x + range / 2)) return i;
  }
  return -1;
};

Palette.prototype.inDragRange = function (pos, range, length) {
  for (var i = 1; i < this.colours.length - 1; i++) {
    var x = this.colours[i].position * length;
    if (pos == x || (range > 1 && pos >= x - range / 2 && pos <= x + range / 2)) return i;
  }
  return 0;
};

Palette.prototype.remove = function (i) {
  this.colours.splice(i, 1);
};

Palette.prototype.toString = function () {
  var paletteData = 'Background=' + this.background.html();
  for (var i = 0; i < this.colours.length; i++) paletteData += '\n' + this.colours[i].position.toFixed(6) + '=' + this.colours[i].colour.html();
  return paletteData;
};

Palette.prototype.get = function () {
  var obj = {};
  obj.background = this.background.html();
  obj.colours = [];
  for (var i = 0; i < this.colours.length; i++) obj.colours.push({ position: this.colours[i].position, colour: this.colours[i].colour.html() });
  return obj;
};

Palette.prototype.toJSON = function () {
  return JSON.stringify(this.get());
};

//Palette draw to canvas
Palette.prototype.draw = function (canvas, ui) {
  //Slider image not yet loaded?
  if (!this.slider.width && ui) {
    var _this = this;
    setTimeout(function () {
      _this.draw(canvas, ui);
    }, 150);
    return;
  }

  // Figure out if a webkit browser is being used
  if (!canvas) {
    alert('Invalid canvas!');
    return;
  }
  var webkit = /webkit/.test(navigator.userAgent.toLowerCase());

  if (this.colours.length == 0) {
    this.background = new Colour('#ffffff');
    this.colours.push(new ColourPos('#000000', 0));
    this.colours.push(new ColourPos('#ffffff', 1));
  }

  //Colours might be out of order (especially during editing)
  //so save a (shallow) copy and sort it
  var list = this.colours.slice(0);
  list.sort(function (a, b) {
    return a.position - b.position;
  });

  if (canvas.getContext) {
    //Draw the gradient(s)
    var width = canvas.width;
    var height = canvas.height;
    var context = canvas.getContext('2d');
    context.clearRect(0, 0, width, height);

    if (webkit) {
      //Split up into sections or webkit draws a fucking awful gradient with banding
      var x0 = 0;
      for (var i = 1; i < list.length; i++) {
        var x1 = Math.round(width * list[i].position);
        context.fillStyle = context.createLinearGradient(x0, 0, x1, 0);
        var colour1 = list[i - 1].colour;
        var colour2 = list[i].colour;
        //Pre-blend with background unless in UI mode
        if (this.premultiply && !ui) {
          colour1 = this.background.blend(colour1);
          colour2 = this.background.blend(colour2);
        }
        context.fillStyle.addColorStop(0.0, colour1.html());
        context.fillStyle.addColorStop(1.0, colour2.html());
        context.fillRect(x0, 0, x1 - x0, height);
        x0 = x1;
      }
    } else {
      //Single gradient
      context.fillStyle = context.createLinearGradient(0, 0, width, 0);
      for (var i = 0; i < list.length; i++) {
        var colour = list[i].colour;
        //Pre-blend with background unless in UI mode
        if (this.premultiply && !ui) colour = this.background.blend(colour);
        context.fillStyle.addColorStop(list[i].position, colour.html());
      }
      context.fillRect(0, 0, width, height);
    }

    /* Posterise mode (no gradients)
    var x0 = 0;
    for (var i = 1; i < list.length; i++) {
      var x1 = Math.round(width * list[i].position);
      //Pre-blend with background unless in UI mode
      var colour2 = ui ? list[i].colour : this.background.blend(list[i].colour);
      context.fillStyle = colour2.html();
      context.fillRect(x0, 0, x1-x0, height);
      x0 = x1;
    }
    */

    //Background colour
    var bg = document.getElementById('backgroundCUR');
    if (bg) bg.style.background = this.background.html();

    //User interface controls
    if (!ui) return; //Skip drawing slider interface
    for (var i = 1; i < list.length - 1; i++) {
      var x = Math.floor(width * list[i].position) + 0.5;
      var HSV = list[i].colour.HSV();
      if (HSV.V > 50) context.strokeStyle = 'black';
      else context.strokeStyle = 'white';
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, canvas.height);
      context.closePath();
      context.stroke();
      x -= this.slider.width / 2;
      context.drawImage(this.slider, x, 0);
    }
  } else alert('getContext failed!');
};

/**
 * @constructor
 */
function ColourPos(colour, pos) {
  //Stores colour as rgba and position as real [0,1]
  if (pos == undefined) this.position = 0.0;
  else this.position = parseFloat(pos);
  //Detect out of range...
  if (this.position >= 0 && this.position <= 1) {
    if (colour) {
      if (typeof colour == 'object') this.colour = colour;
      else this.colour = new Colour(colour);
    } else {
      this.colour = new Colour('#000000');
    }
  } else {
    throw 'Invalid Colour Position: ' + pos;
  }
}

/**
 * @constructor
 */
function Colour(colour) {
  //Construct... stores colour as r,g,b,a values
  //Can pass in html colour string, HSV object, Colour object or integer rgba
  if (typeof colour == 'undefined') this.set('#ffffff');
  else if (typeof colour == 'string') this.set(colour);
  else if (typeof colour == 'object') {
    //Determine passed type, Colour, RGBA or HSV
    if (typeof colour.H != 'undefined')
      //HSV
      this.setHSV(colour);
    else if (typeof colour.red != 'undefined') {
      //Another Colour object
      this.red = colour.red;
      this.green = colour.green;
      this.blue = colour.blue;
      this.alpha = colour.alpha;
    } else if (colour.R) {
      //RGBA
      this.red = colour.R;
      this.green = colour.G;
      this.blue = colour.B;
      this.alpha = typeof colour.A == 'undefined' ? 1.0 : colour.A;
    } else {
      //Assume array
      this.red = colour[0];
      this.green = colour[1];
      this.blue = colour[2];
      //Convert float components to [0-255]
      //NOTE: This was commented, not sure where the problem was
      //Needed for parsing JSON array [0,1] colours
      if (this.red <= 1.0 && this.green <= 1.0 && this.blue <= 1.0) {
        this.red = Math.round(this.red * 255);
        this.green = Math.round(this.green * 255);
        this.blue = Math.round(this.blue * 255);
      }
      this.alpha = typeof colour[3] == 'undefined' ? 1.0 : colour[3];
    }
  } else {
    //Convert from integer AABBGGRR
    this.fromInt(colour);
  }
}

Colour.prototype.set = function (val) {
  if (!val) val = '#ffffff'; //alert("No Value provided!");
  var re = /^rgba?\((\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,?\s*(\d\.?\d*)?\)$/;
  var bits = re.exec(val);
  if (bits) {
    this.red = parseInt(bits[1]);
    this.green = parseInt(bits[2]);
    this.blue = parseInt(bits[3]);
    this.alpha = typeof bits[4] == 'undefined' ? 1.0 : parseFloat(bits[4]);
  } else if (val.charAt(0) == '#') {
    var hex = val.substring(1, 7);
    this.alpha = 1.0;
    this.red = parseInt(hex.substring(0, 2), 16);
    this.green = parseInt(hex.substring(2, 4), 16);
    this.blue = parseInt(hex.substring(4, 6), 16);
  } else {
    //Attempt to parse as integer
    this.fromInt(parseInt(val));
  }
};

Colour.prototype.fromInt = function (intcolour) {
  //Convert from integer AABBGGRR
  this.red = intcolour & 0x000000ff;
  this.green = (intcolour & 0x0000ff00) >>> 8;
  this.blue = (intcolour & 0x00ff0000) >>> 16;
  this.alpha = ((intcolour & 0xff000000) >>> 24) / 255.0;
};

Colour.prototype.toInt = function () {
  //Convert to integer AABBGGRR
  var result = this.red;
  result += this.green << 8;
  result += this.blue << 16;
  result += Math.round(this.alpha * 255) << 24;
  return result;
};

Colour.prototype.toString = function () {
  return this.html();
};

Colour.prototype.html = function () {
  return 'rgba(' + this.red + ',' + this.green + ',' + this.blue + ',' + this.alpha.toFixed(2) + ')';
};

Colour.prototype.rgbaGL = function () {
  var arr = [this.red / 255.0, this.green / 255.0, this.blue / 255.0, this.alpha];
  return new Float32Array(arr);
};

Colour.prototype.rgbaGLSL = function () {
  var c = this.rgbaGL();
  return 'rgba(' + c[0].toFixed(4) + ',' + c[1].toFixed(4) + ',' + c[2].toFixed(4) + ',' + c[3].toFixed(4) + ')';
};

Colour.prototype.rgba = function () {
  var rgba = [this.red / 255.0, this.green / 255.0, this.blue / 255.0, this.alpha];
  return rgba;
};

Colour.prototype.rgbaObj = function () {
  //OK.debug('R:' + this.red + ' G:' + this.green + ' B:' + this.blue + ' A:' + this.alpha);
  return { R: this.red, G: this.green, B: this.blue, A: this.alpha };
};

Colour.prototype.print = function () {
  OK.debug(this.printString(true));
};

Colour.prototype.printString = function (alpha) {
  return 'R:' + this.red + ' G:' + this.green + ' B:' + this.blue + (alpha ? ' A:' + this.alpha : '');
};

Colour.prototype.HEX = function (o) {
  o = Math.round(Math.min(Math.max(0, o), 255));
  return '0123456789ABCDEF'.charAt((o - (o % 16)) / 16) + '0123456789ABCDEF'.charAt(o % 16);
};

Colour.prototype.htmlHex = function (o) {
  return '#' + this.HEX(this.red) + this.HEX(this.green) + this.HEX(this.blue);
};

Colour.prototype.hex = function (o) {
  //hex RGBA in expected order
  return this.HEX(this.red) + this.HEX(this.green) + this.HEX(this.blue) + this.HEX(this.alpha * 255);
};

Colour.prototype.hexGL = function (o) {
  //RGBA for openGL (stored ABGR internally on little endian)
  return this.HEX(this.alpha * 255) + this.HEX(this.blue) + this.HEX(this.green) + this.HEX(this.red);
};

Colour.prototype.setHSV = function (o) {
  var R,
    G,
    A,
    B,
    C,
    F,
    S = o.S / 100,
    V = o.V / 100,
    H = o.H / 360;

  if (S > 0) {
    if (H >= 1) H = 0;

    H = 6 * H;
    F = H - Math.floor(H);
    A = Math.round(255 * V * (1 - S));
    B = Math.round(255 * V * (1 - S * F));
    C = Math.round(255 * V * (1 - S * (1 - F)));
    V = Math.round(255 * V);

    switch (Math.floor(H)) {
      case 0:
        R = V;
        G = C;
        B = A;
        break;
      case 1:
        R = B;
        G = V;
        B = A;
        break;
      case 2:
        R = A;
        G = V;
        B = C;
        break;
      case 3:
        R = A;
        G = B;
        B = V;
        break;
      case 4:
        R = C;
        G = A;
        B = V;
        break;
      case 5:
        R = V;
        G = A;
        B = B;
        break;
    }

    this.red = R ? R : 0;
    this.green = G ? G : 0;
    this.blue = B ? B : 0;
  } else {
    this.red = V = Math.round(V * 255);
    this.green = V;
    this.blue = V;
  }
  this.alpha = typeof o.A == 'undefined' ? 1.0 : o.A;
};

Colour.prototype.HSV = function () {
  var r = this.red / 255.0; //RGB values = 0 ÷ 255
  var g = this.green / 255.0;
  var b = this.blue / 255.0;

  var min = Math.min(r, g, b); //Min. value of RGB
  var max = Math.max(r, g, b); //Max. value of RGB
  var deltaMax = max - min; //Delta RGB value

  var v = max;
  var s, h;
  var deltaRed, deltaGreen, deltaBlue;

  if (deltaMax == 0) {
    //This is a gray, no chroma...
    h = 0; //HSV results = 0 ÷ 1
    s = 0;
  } //Chromatic data...
  else {
    s = deltaMax / max;

    deltaRed = ((max - r) / 6 + deltaMax / 2) / deltaMax;
    deltaGreen = ((max - g) / 6 + deltaMax / 2) / deltaMax;
    deltaBlue = ((max - b) / 6 + deltaMax / 2) / deltaMax;

    if (r == max) h = deltaBlue - deltaGreen;
    else if (g == max) h = 1 / 3 + deltaRed - deltaBlue;
    else if (b == max) h = 2 / 3 + deltaGreen - deltaRed;

    if (h < 0) h += 1;
    if (h > 1) h -= 1;
  }

  return { H: 360 * h, S: 100 * s, V: v * 100 };
};

Colour.prototype.HSVA = function () {
  var hsva = this.HSV();
  hsva.A = this.alpha;
  return hsva;
};

Colour.prototype.interpolate = function (other, lambda) {
  //Interpolate between this colour and another by lambda
  this.red = Math.round(this.red + lambda * (other.red - this.red));
  this.green = Math.round(this.green + lambda * (other.green - this.green));
  this.blue = Math.round(this.blue + lambda * (other.blue - this.blue));
  this.alpha = Math.round(this.alpha + lambda * (other.alpha - this.alpha));
};

Colour.prototype.blend = function (src) {
  //Blend this colour with another and return result (uses src alpha from other colour)
  return new Colour([
    Math.round((1.0 - src.alpha) * this.red + src.alpha * src.red),
    Math.round((1.0 - src.alpha) * this.green + src.alpha * src.green),
    Math.round((1.0 - src.alpha) * this.blue + src.alpha * src.blue),
    (1.0 - src.alpha) * this.alpha + src.alpha * src.alpha,
  ]);
};

/* JavaScript colour picker with opacity, (c) Owen Kaluza, Public Domain
 * Depends on: utils.js, colours.js
 * */

/**
 * Draggable window class *
 * @constructor
 */
function MoveWindow(id) {
  //Mouse processing:
  if (!id) return;
  this.element = $(id);
  if (!this.element) {
    alert('No such element: ' + id);
    return null;
  }
  this.mouse = new Mouse(this.element, this);
  this.mouse.moveUpdate = true;
  this.element.mouse = this.mouse;
}

MoveWindow.prototype.open = function (x, y) {
  //Show the window
  var style = this.element.style;

  if (x < 0) x = 0;
  if (y < 0) y = 0;
  if (x != undefined) style.left = x + 'px';
  if (y != undefined) style.top = y + 'px';
  style.display = 'block';

  //Correct if outside window width/height
  var w = this.element.offsetWidth,
    h = this.element.offsetHeight;
  if (x + w > window.innerWidth - 20) style.left = window.innerWidth - w - 20 + 'px';
  if (y + h > window.innerHeight - 20) style.top = window.innerHeight - h - 20 + 'px';
  //console.log("Open " + this.element.id + " " + style.left + "," + style.top + " : " + style.display);
};

MoveWindow.prototype.close = function () {
  this.element.style.display = 'none';
};

MoveWindow.prototype.move = function (e, mouse) {
  //console.log("Move: " + mouse.isdown);
  if (!mouse.isdown) return;
  if (mouse.button > 0) return; //Process left drag only
  //Drag position
  var style = mouse.element.style;
  style.left = parseInt(style.left) + mouse.deltaX + 'px';
  style.top = parseInt(style.top) + mouse.deltaY + 'px';
};

MoveWindow.prototype.down = function (e, mouse) {
  //Prevents drag/selection
  return false;
};

function scale(val, range, min, max) {
  return clamp((max * val) / range, min, max);
}
function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

/**
 * @constructor
 */
function ColourPicker(savefn, abortfn) {
  // Originally based on :
  // DHTML Color Picker, Programming by Ulyses, ColorJack.com (Creative Commons License)
  // http://www.dynamicdrive.com/dynamicindex11/colorjack/index.htm
  // (Stripped down, clean class based interface no IE6 support for HTML5 browsers only)

  function createDiv(id, inner, styles) {
    var div = document.createElement('div');
    div.id = id;
    if (inner) div.innerHTML = inner;
    if (styles) div.style.cssText = styles;

    return div;
  }

  var parentElement = document.body;
  //Images
  var checkimg =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAIElEQVQ4jWP4TwAcOHAAL2YYNWBYGEBIASEwasCwMAAALvidroqDalkAAAAASUVORK5CYII=';
  var slideimg =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB0AAAAFCAYAAAC5Fuf5AAAAKklEQVQokWP4////fwY6gv////9n+A8F9LIQxVJaW4xiz4D5lB4WIlsMAPjER7mTpG/OAAAAAElFTkSuQmCC';
  var pickimg =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAkAAAAJCAYAAADgkQYQAAAALUlEQVQYlWNgQAX/kTBW8B8ZYFMIk0ARQFaIoQCbQuopIspNRPsOrpABSzgBAFHzU61KjdKlAAAAAElFTkSuQmCC';
  var svimg =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAEG0lEQVQ4jQEQBO/7APz8/Pz7+/vx+/v75Pr6+tb6+vrF+Pj4tPf396H4+PiO9/f3e/X19Wfz8/NU8PDwQuvr6zLi4uIjzs7OFZmZmQoA8PDw/O/v7/Ht7e3l7Ozs2Ozs7Mjq6uq35ubmpeXl5ZLf39+A3NzcbtXV1VvMzMxLvr6+O6ioqCyEhIQfQEBAFADk5OT84eHh8uDg4Obe3t7Z3Nzcy9nZ2brV1dWq0NDQmcrKyofCwsJ2uLi4ZKqqqlSYmJhFfX19N1lZWSsnJychANPT0/zT09Pz0NDQ6c3NzdzKysrNx8fHv8DAwK+6urqfsrKyj6mpqX+cnJxvjIyMX3l5eVBeXl5EPz8/ORsbGy8Aw8PD/MHBwfS+vr7qurq63ra2ttKxsbHErKystaOjo6eampqXj4+PiYODg3lycnJrXl5eX0hISFIuLi5IEBAQPwCwsLD9r6+v9aysrOynp6fioqKi1p2dncmVlZW8jo6OroODg6F5eXmUa2trhl1dXXlLS0ttNzc3YiIiIlkNDQ1RAJ6env2bm5v2l5eX7pSUlOWPj4/aiIiIz4GBgcN5eXm3cHBwq2RkZJ5XV1eSSkpKhzk5OX0qKipzGBgYawgICGMAioqK/YeHh/eDg4PvgICA6Hp6et90dHTVbW1ty2VlZcBcXFy1UVFRqkZGRqA6OjqWLS0tjSEhIYQSEhJ9BgYGdwB2dnb+c3Nz+HFxcfJra2vrZmZm42JiYttaWlrRUlJSyUtLS79CQkK2Nzc3rS0tLaQiIiKdGBgYlQ4ODo8EBASKAGNjY/5gYGD5XV1d9FpaWu5VVVXnTk5O4UlJSdlCQkLRPDw8yTQ0NMEqKiq7IiIisxkZGa0RERGmCgoKoQMDA5wAUFBQ/k9PT/pKSkr3R0dH8kNDQ+w+Pj7mOTk54DMzM9otLS3TJycnzSAgIMgZGRnBExMTvA0NDbcHBweyAwMDrwA9PT3+PDw8+zo6Ovg2Njb0MzMz8DAwMOwqKirnJSUl4iEhId4cHBzYFxcX1BISEtAODg7KCQkJxwQEBMQBAQHBAC0tLf4rKyv9Kioq+iYmJvclJSX0ISEh8R4eHu4aGhrqFhYW5xMTE+MQEBDgDQ0N3AgICNkGBgbWBAQE0wAAANEAHh4e/h0dHf0bGxv7Ghoa+hgYGPcWFhb2FBQU8xEREfEPDw/uDAwM7AoKCuoICAjoBgYG5gMDA+MBAQHiAAAA4QARERH+EBAQ/g8PD/0NDQ38DQ0N+wsLC/kKCgr4CAgI9wcHB/YFBQX0BAQE8wICAvIBAQHwAQEB7wAAAO8AAADuAAUFBf4FBQX+BAQE/gQEBP4DAwP+AwMD/QMDA/0CAgL8AQEB/AEBAfsAAAD7AAAA+wAAAPoAAAD6AAAA+QAAAPmq2NbsCl2m4wAAAABJRU5ErkJggg==';

  var checked = 'background-image: url("' + checkimg + '");';
  var slider = 'cursor: crosshair; float: left; height: 170px; position: relative; width: 19px; padding: 0;' + checked;
  var sliderControl = 'top: 0px; left: -5px; background: url("' + slideimg + '"); height: 5px; width: 29px; position: absolute; ';
  var sliderBG = 'position: relative;';

  this.element = createDiv(
    'picker',
    null,
    'display:none; top: 58px; z-index: 20; background: #0d0d0d; color: #aaa; cursor: move; font-family: arial; font-size: 11px; padding: 7px 10px 11px 10px; position: fixed; width: 229px; border-radius: 5px; border: 1px solid #444;'
  );
  var bg = createDiv('pickCURBG', null, checked + ' float: left; width: 12px; height: 12px; margin-right: 3px;');
  bg.appendChild(createDiv('pickCUR', null, 'float: left; width: 12px; height: 12px; background: #fff; margin-right: 3px;'));
  this.element.appendChild(bg);
  var rgb = createDiv('pickRGB', 'R: 255 G: 255 B: 255', 'float: left; position: relative; top: -1px;');
  rgb.onclick = 'colours.picker.updateString()';
  this.element.appendChild(rgb);
  this.element.appendChild(createDiv('pickCLOSE', 'X', 'float: right; cursor: pointer; margin: 0 8px 3px;'));
  this.element.appendChild(createDiv('pickOK', 'OK', 'float: right; cursor: pointer; margin: 0 8px 3px;'));
  var sv = createDiv(
    'SV',
    null,
    "position: relative; cursor: crosshair; float: left; height: 170px; width: 170px; margin-right: 10px; background: url('" +
      svimg +
      "') no-repeat; background-size: 100%;"
  );
  sv.appendChild(createDiv('SVslide', null, "background: url('" + pickimg + "'); height: 9px; width: 9px; position: absolute; cursor: crosshair"));
  this.element.appendChild(sv);
  var h = createDiv('H', null, slider);
  h.appendChild(createDiv('Hmodel', null, sliderBG));
  h.appendChild(createDiv('Hslide', null, sliderControl));
  this.element.appendChild(h);
  var o = createDiv('O', null, slider + 'border: 1px solid #888; left: 9px;');
  o.appendChild(createDiv('Omodel', null, sliderBG));
  o.appendChild(createDiv('Oslide', null, sliderControl));
  this.element.appendChild(o);
  parentElement.appendChild(this.element);

  /* Hover rules require appending to stylesheet */
  var css = '#pickRGB:hover {color: #FFD000;} #pickCLOSE:hover {color: #FFD000;} #pickOK:hover {color: #FFD000;}';
  var style = document.createElement('style');
  if (style.styleSheet) style.styleSheet.cssText = css;
  else style.appendChild(document.createTextNode(css));
  document.getElementsByTagName('head')[0].appendChild(style);

  // call base class constructor
  MoveWindow.call(this, 'picker');

  this.savefn = savefn;
  this.abortfn = abortfn;
  this.size = 170.0; //H,S & V range in pixels
  this.sv = 5; //Half size of SV selector
  this.oh = 2; //Half size of H & O selectors
  this.picked = { H: 360, S: 100, V: 100, A: 1.0 };
  this.max = { H: 360, S: 100, V: 100, A: 1.0 };
  this.colour = new Colour();

  //Load hue strip
  var i,
    html = '',
    bgcol,
    opac;
  for (i = 0; i <= this.size; i++) {
    bgcol = new Colour({ H: Math.round((360 / this.size) * i), S: 100, V: 100, A: 1.0 });
    html += "<div class='hue' style='height: 1px; width: 19px; margin: 0; padding: 0; background: " + bgcol.htmlHex() + ";'> </div>";
  }
  $('Hmodel').innerHTML = html;

  //Load alpha strip
  html = '';
  for (i = 0; i <= this.size; i++) {
    opac = 1.0 - i / this.size;
    html +=
      "<div class='opacity' style='height: 1px; width: 19px; margin: 0; padding: 0; background: #000;opacity: " + opac.toFixed(2) + ";'> </div>";
  }
  $('Omodel').innerHTML = html;
}

//Inherits from MoveWindow
ColourPicker.prototype = new MoveWindow();
ColourPicker.prototype.constructor = MoveWindow;

ColourPicker.prototype.pick = function (colour, x, y) {
  //Show the picker, with selected colour
  this.update(colour.HSVA());
  if (this.element.style.display == 'block') return;
  MoveWindow.prototype.open.call(this, x, y);
};

ColourPicker.prototype.select = function (element, x, y) {
  if (!x || !y) {
    var offset = findElementPos(element); //Requires: mouse.js
    x = x ? x : offset[0] + 32;
    y = y ? y : offset[1] + 32;
  }
  var colour = new Colour(element.style.backgroundColor);
  //Show the picker, with selected colour
  this.update(colour.HSVA());
  if (this.element.style.display == 'block') return;
  MoveWindow.prototype.open.call(this, x, y);
  this.target = element;
};

//Mouse event handling
ColourPicker.prototype.click = function (e, mouse) {
  if (mouse.target.id == 'pickCLOSE') {
    if (this.abortfn) this.abortfn();
    toggle('picker');
  } else if (mouse.target.id == 'pickOK') {
    if (this.savefn) this.savefn(this.picked);

    //Set element background
    if (this.target) {
      var colour = new Colour(this.picked);
      this.target.style.backgroundColor = colour.html();
    }

    toggle('picker');
  } else if (mouse.target.id == 'SV') this.setSV(mouse);
  else if (mouse.target.id == 'Hslide' || mouse.target.className == 'hue') this.setHue(mouse);
  else if (mouse.target.id == 'Oslide' || mouse.target.className == 'opacity') this.setOpacity(mouse);
};

ColourPicker.prototype.move = function (e, mouse) {
  //Process left drag
  if (mouse.isdown && mouse.button == 0) {
    if (mouse.target.id == 'picker' || mouse.target.id == 'pickCUR' || mouse.target.id == 'pickRGB') {
      //Call base class function
      MoveWindow.prototype.move.call(this, e, mouse);
    } else if (mouse.target) {
      //Drag on H/O slider acts as click
      this.click(e, mouse);
    }
  }
};

ColourPicker.prototype.wheel = function (e, mouse) {
  this.incHue(-e.spin);
};

ColourPicker.prototype.setSV = function (mouse) {
  var X = mouse.clientx - parseInt($('SV').offsetLeft),
    Y = mouse.clienty - parseInt($('SV').offsetTop);
  //Saturation & brightness adjust
  this.picked.S = scale(X, this.size, 0, this.max['S']);
  this.picked.V = this.max['V'] - scale(Y, this.size, 0, this.max['V']);
  this.update(this.picked);
};

ColourPicker.prototype.setHue = function (mouse) {
  var X = mouse.clientx - parseInt($('H').offsetLeft),
    Y = mouse.clienty - parseInt($('H').offsetTop);
  //Hue adjust
  this.picked.H = scale(Y, this.size, 0, this.max['H']);
  this.update(this.picked);
};

ColourPicker.prototype.incHue = function (inc) {
  //Hue adjust incrementally
  this.picked.H += inc;
  this.picked.H = clamp(this.picked.H, 0, this.max['H']);
  this.update(this.picked);
};

ColourPicker.prototype.setOpacity = function (mouse) {
  var X = mouse.clientx - parseInt($('O').offsetLeft),
    Y = mouse.clienty - parseInt($('O').offsetTop);
  //Alpha adjust
  this.picked.A = 1.0 - clamp(Y / this.size, 0, 1);
  this.update(this.picked);
};

ColourPicker.prototype.updateString = function (str) {
  if (!str) str = prompt('Edit colour:', this.colour.html());
  if (!str) return;
  this.colour = new Colour(str);
  this.update(this.colour.HSV());
};

ColourPicker.prototype.update = function (HSV) {
  this.picked = HSV;
  (this.colour = new Colour(HSV)),
    (rgba = this.colour.rgbaObj()),
    (rgbaStr = this.colour.html()),
    (bgcol = new Colour({ H: HSV.H, S: 100, V: 100, A: 255 }));

  $('pickRGB').innerHTML = this.colour.printString();
  $S('pickCUR').background = rgbaStr;
  $S('pickCUR').backgroundColour = rgbaStr;
  $S('SV').backgroundColor = bgcol.htmlHex();

  //Hue adjust
  $S('Hslide').top = this.size * (HSV.H / 360.0) - this.oh + 'px';
  //SV adjust
  $S('SVslide').top = Math.round(this.size - this.size * (HSV.V / 100.0) - this.sv) + 'px';
  $S('SVslide').left = Math.round(this.size * (HSV.S / 100.0) - this.sv) + 'px';
  //Alpha adjust
  $S('Oslide').top = this.size * (1.0 - HSV.A) - this.oh - 1 + 'px';
};

/**
 * @constructor
 */
function GradientEditor(canvas, callback, premultiply, nopicker, scrollable) {
  this.canvas = canvas;
  this.callback = callback;
  this.premultiply = premultiply;
  this.changed = true;
  this.inserting = false;
  this.editing = null;
  this.element = null;
  this.spin = 0;
  this.scrollable = scrollable;
  var self = this;
  function saveColour(val) {
    self.save(val);
  }
  function abortColour() {
    self.cancel();
  }
  if (!nopicker) this.picker = new ColourPicker(this.save.bind(this), this.cancel.bind(this));

  //Create default palette object (enable premultiply if required)
  this.palette = new Palette(null, premultiply);
  //Event handling for palette
  this.canvas.mouse = new Mouse(this.canvas, this);
  this.canvas.oncontextmenu = 'return false;';
  this.canvas.oncontextmenu = function () {
    return false;
  };

  //this.update();
}

//Palette management
GradientEditor.prototype.read = function (source) {
  //Read a new palette from source data
  this.palette = new Palette(source, this.premultiply);
  this.reset();
  this.update(true);
};

GradientEditor.prototype.update = function (nocallback) {
  //Redraw and flag change
  this.changed = true;
  this.palette.draw(this.canvas, true);
  //Trigger callback if any
  if (!nocallback && this.callback) this.callback(this);
};

//Draw gradient to passed canvas if data has changed
//If no changes, return false
GradientEditor.prototype.get = function (canvas, cache) {
  if (cache && !this.changed) return false;
  this.changed = false;
  //Update passed canvas
  this.palette.draw(canvas, false);
  return true;
};

GradientEditor.prototype.insert = function (position, x, y) {
  //Flag unsaved new colour
  this.inserting = true;
  var col = new Colour();
  this.editing = this.palette.newColour(position, col);
  this.update();
  //Edit new colour
  this.picker.pick(col, x, y);
};

GradientEditor.prototype.editBackground = function (element) {
  this.editing = -1;
  var offset = findElementPos(element); //From mouse.js
  this.element = element;
  this.picker.pick(this.palette.background, offset[0] + 32, offset[1] + 32);
};

GradientEditor.prototype.edit = function (val, x, y) {
  if (typeof val == 'number') {
    this.editing = val;
    this.picker.pick(this.palette.colours[val].colour, x, y);
  } else if (typeof val == 'object') {
    //Edit element
    this.cancel(); //Abort any current edit first
    this.element = val;
    var col = new Colour(val.style.backgroundColor);
    var offset = findElementPos(val); //From mouse.js
    this.picker.pick(col, offset[0] + 32, offset[1] + 32);
  }
  this.update();
};

GradientEditor.prototype.save = function (val) {
  if (this.editing != null) {
    if (this.editing >= 0)
      //Update colour with selected
      this.palette.colours[this.editing].colour.setHSV(val);
    //Update background colour with selected
    else this.palette.background.setHSV(val);
  }
  if (this.element) {
    var col = new Colour(0);
    col.setHSV(val);
    this.element.style.backgroundColor = col.html();
    if (this.element.onchange) this.element.onchange(); //Call change function
  }
  this.reset();
  this.update();
};

GradientEditor.prototype.cancel = function () {
  //If aborting a new colour add, delete it
  if (this.editing >= 0 && this.inserting) this.palette.remove(this.editing);
  this.reset();
  this.update();
};

GradientEditor.prototype.reset = function () {
  //Reset editing data
  this.inserting = false;
  this.editing = null;
  this.element = null;
};

//Mouse event handling
GradientEditor.prototype.click = function (event, mouse) {
  //this.changed = true;
  if (event.ctrlKey) {
    //Flip
    for (var i = 0; i < this.palette.colours.length; i++) this.palette.colours[i].position = 1.0 - this.palette.colours[i].position;
    this.update();
    return false;
  }

  //Use non-scrolling position
  if (!this.scrollable) mouse.x = mouse.clientx;

  if (mouse.slider != null) {
    //Slider moved, update texture
    mouse.slider = null;
    this.palette.sort(); //Fix any out of order colours
    this.update();
    return false;
  }
  var pal = this.canvas;
  if (pal.getContext) {
    this.cancel(); //Abort any current edit first
    var context = pal.getContext('2d');
    var ypos = findElementPos(pal)[1] + 30;

    //Get selected colour
    //In range of a colour pos +/- 0.5*slider width?
    var i = this.palette.inRange(mouse.x, this.palette.slider.width, pal.width);
    if (i >= 0) {
      if (event.button == 0) {
        //Edit colour on left click
        this.edit(i, event.clientX - 128, ypos);
      } else if (event.button == 2) {
        //Delete on right click
        this.palette.remove(i);
        this.update();
      }
    } else {
      //Clicked elsewhere, add new colour
      this.insert(mouse.x / pal.width, event.clientX - 128, ypos);
    }
  }
  return false;
};

GradientEditor.prototype.down = function (event, mouse) {
  return false;
};

GradientEditor.prototype.move = function (event, mouse) {
  if (!mouse.isdown) return true;

  //Use non-scrolling position
  if (!this.scrollable) mouse.x = mouse.clientx;

  if (mouse.slider == null) {
    //Colour slider dragged on?
    var i = this.palette.inDragRange(mouse.x, this.palette.slider.width, this.canvas.width);
    if (i > 0) mouse.slider = i;
  }

  if (mouse.slider == null) mouse.isdown = false; //Abort action if not on slider
  else {
    if (mouse.x < 1) mouse.x = 1;
    if (mouse.x > this.canvas.width - 1) mouse.x = this.canvas.width - 1;
    //Move to adjusted position and redraw
    this.palette.colours[mouse.slider].position = mouse.x / this.canvas.width;
    this.update(true);
  }
};

GradientEditor.prototype.wheel = function (event, mouse) {
  if (this.timer) clearTimeout(this.timer);
  else this.canvas.style.cursor = 'wait';
  this.spin += 0.01 * event.spin;
  //this.cycle(0.01 * event.spin);
  var this_ = this;
  this.timer = setTimeout(function () {
    this_.cycle(this_.spin);
    this_.spin = 0;
  }, 150);
};

GradientEditor.prototype.leave = function (event, mouse) {};

GradientEditor.prototype.cycle = function (inc) {
  this.canvas.style.cursor = 'default';
  this.timer = null;
  //Shift all colours cyclically
  for (var i = 1; i < this.palette.colours.length - 1; i++) {
    var x = this.palette.colours[i].position;
    x += inc;
    if (x <= 0) x += 1.0;
    if (x >= 1.0) x -= 1.0;
    this.palette.colours[i].position = x;
  }
  this.palette.sort(); //Fix any out of order colours
  this.update();
};

/** @preserve
 * ShareVol
 * Lightweight WebGL volume viewer/slicer
 *
 * Copyright (c) 2014, Monash University. All rights reserved.
 * Author: Owen Kaluza - owen.kaluza ( at ) monash.edu
 *
 * Licensed under the GNU Lesser General Public License
 * https://www.gnu.org/licenses/lgpl.html
 *
 */
//TODO: colourmaps per slicer/volume not shared (global shared list of selectable maps?)
var volume;
var slicer;
var colours;
//Windows...
var info, colourmaps;
var state = {};
var reset;
var filename;
var mobile;

function initVolume(jsonfile) {
  if (!jsonfile) return;

  window.onresize = autoResize;

  //Create tool windows
  info = new Popup('info');
  info.show();

  try {
    if (!window.WebGLRenderingContext) throw 'No browser WebGL support';
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!ctx) throw 'No WebGL context available';
    canvas = ctx = null;
  } catch (e) {
    $('status').innerHTML = "Sorry, ShareVol requires a <a href='http://get.webgl.org'>WebGL</a> capable browser!";
    return;
  }

  //Yes it's user agent sniffing, but we need to attempt to detect mobile devices so we don't over-stress their gpu...
  mobile = screen.width <= 760 || /Android|webOS|iPhone|iPad|iPod|BlackBerry/i.test(navigator.userAgent);

  if (!colours) {
    //Colour editing and palette management
    colours = new GradientEditor($('palette'), updateColourmap);
  }

  if (!colourmaps) {
    colourmaps = new Popup('colourmap', 400, 200);
  }

  $('status').innerHTML = 'Loading params...';
  ajaxReadFile(decodeURI(jsonfile), loadData, true);
}

function loadStoredData(key) {
  if (localStorage[key]) {
    try {
      var parsed = JSON.parse(localStorage[key]);
      state = parsed;
    } catch (e) {
      //if erroneous data in local storage, delete
      //console.log("parse error: " + e.message);
      alert('parse error: ' + e.message);
      localStorage[key] = null;
    }
  }
}

function loadData(src, fn) {
  var parsed = JSON.parse(src);
  if (parsed.volume) {
    //Old data format
    state = {};
    state.properties = {};
    state.colourmaps = [{}];
    object = {};
    view = {};
    state.views = [view];
    state.objects = [object];
    //Copy fields to their new locations
    //Objects
    object.name = 'volume';
    object.samples = parsed.volume.properties.samples;
    object.isovalue = parsed.volume.properties.isovalue;
    object.isowalls = parsed.volume.properties.drawWalls;
    object.isoalpha = parsed.volume.properties.isoalpha;
    object.isosmooth = parsed.volume.properties.isosmooth;
    object.colour = parsed.volume.properties.isocolour;
    object.density = parsed.volume.properties.density;
    object.power = parsed.volume.properties.power;
    if (parsed.volume.properties.usecolourmap) object.colourmap = 0;
    object.tricubicfilter = parsed.volume.properties.tricubicFilter;
    object.zmin = parsed.volume.properties.Zmin;
    object.zmax = parsed.volume.properties.Zmax;
    object.ymin = parsed.volume.properties.Ymin;
    object.ymax = parsed.volume.properties.Ymax;
    object.xmin = parsed.volume.properties.Xmin;
    object.xmax = parsed.volume.properties.Xmax;
    object.brightness = parsed.volume.properties.brightness;
    object.contrast = parsed.volume.properties.contrast;
    //The volume data sub-object
    object.volume = {};
    object.volume.url = parsed.url;
    object.volume.res = parsed.res;
    object.volume.scale = parsed.scale;
    //The slicer properties
    object.slices = parsed.slicer;
    //Properties - global rendering properties
    state.properties.nogui = parsed.nogui;
    //Views - single only in old data
    view.axes = parsed.volume.properties.axes;
    view.border = parsed.volume.properties.border;
    view.translate = parsed.volume.translate;
    view.rotate = parsed.volume.rotate;
    view.focus = parsed.volume.focus;

    //Colourmap
    colours.read(parsed.volume.colourmap);
    colours.update();
    state.colourmaps = [colours.palette.get()];
    delete state.colourmaps[0].background;
    state.properties.background = colours.palette.background.html();
  } else {
    //New format - LavaVu compatible
    state = parsed;
  }

  reset = state; //Store orig for reset
  //Storage reset?
  if (getSearchVariable('reset')) {
    localStorage.removeItem(fn);
    console.log('Storage cleared');
  }
  /* LOCALSTORAGE DISABLED
  //Load any stored presets for this file
  filename = fn;
  loadStoredData(fn);
  */

  //Setup default props from original data...
  //state.objects = reset.objects;
  if (!state.objects[0].volume.res) state.objects[0].volume.res = [256, 256, 256];
  if (!state.objects[0].volume.scale) state.objects[0].volume.scale = [1.0, 1.0, 1.0];

  //Load the image
  loadTexture();
}

function saveData() {
  try {
    localStorage[filename] = getData();
  } catch (e) {
    //data wasn’t successfully saved due to quota exceed so throw an error
    console.log('LocalStorage Error: Quota exceeded? ' + e);
  }
}

function getData(compact, matrix) {
  if (volume) {
    var vdat = volume.get(matrix);
    var object = state.objects[0];
    object.saturation = vdat.properties.saturation;
    object.brightness = vdat.properties.brightness;
    object.contrast = vdat.properties.contrast;
    object.zmin = vdat.properties.zmin;
    object.zmax = vdat.properties.zmax;
    object.ymin = vdat.properties.ymin;
    object.ymax = vdat.properties.ymax;
    object.xmin = vdat.properties.xmin;
    object.xmax = vdat.properties.xmax;
    //object.volume.res = parsed.res;
    //object.volume.scale = parsed.scale;
    object.samples = vdat.properties.samples;
    object.isovalue = vdat.properties.isovalue;
    object.isowalls = vdat.properties.isowalls;
    object.isoalpha = vdat.properties.isoalpha;
    object.isosmooth = vdat.properties.isosmooth;
    object.colour = vdat.properties.colour;
    object.density = vdat.properties.density;
    object.power = vdat.properties.power;
    object.tricubicfilter = vdat.properties.tricubicFilter;
    if (vdat.properties.usecolourmap) object.colourmap = 0;
    else delete object.colourmap;

    //Views - single only in old data
    state.views[0].axes = vdat.properties.axes;
    state.views[0].border = vdat.properties.border;
    state.views[0].translate = vdat.translate;
    state.views[0].rotate = vdat.rotate;

    if (slicer) state.objects[0].slices = slicer.get();

    //Colourmap
    state.colourmaps = [colours.palette.get()];
    delete state.colourmaps[0].background;
    state.properties.background = colours.palette.background.html();
  }

  //Return compact json string
  console.log(JSON.stringify(state, null, 2));
  if (compact) return JSON.stringify(state);
  //Otherwise return indented json string
  return JSON.stringify(state, null, 2);
}

function exportData() {
  window.open('data:text/json;base64,' + window.btoa(getData()));
}

function resetFromData(src) {
  //Restore data from saved props
  if (src.objects[0].volume && volume) {
    volume.load(src.objects[0]);
    volume.draw();
  }

  if (src.objects[0].slices && slicer) {
    slicer.load(src.objects[0].slices);
    slicer.draw();
  }
}

function loadTexture() {
  $('status').innerHTML = 'Loading image data... ';
  var image;

  loadImage(state.objects[0].volume.url, function () {
    image = new Image();

    var headers = request.getAllResponseHeaders();
    var match = headers.match(/^Content-Type\:\s*(.*?)$/im);
    var mimeType = match[1] || 'image/png';
    var blob = new Blob([request.response], { type: mimeType });
    image.src = window.URL.createObjectURL(blob);
    var imageElement = document.createElement('img');

    image.onload = function () {
      console.log('Loaded image: ' + image.width + ' x ' + image.height);
      imageLoaded(image);
    };
  });
}

function imageLoaded(image) {
  if (slicer) {
    slicer.clear();
    slicer = null;
  }

  //Create the slicer
  if (state.objects[0].slices) {
    if (mobile) state.objects[0].slices.show = false; //Start hidden on small screen
    slicer = new Slicer(state.objects[0], image, 'linear', $('volume-container'));
  }

  if (volume) {
    volume.clear();
    volume = null;
  }

  //Create the volume viewer
  if (state.objects[0].volume) {
    var interactive = true;
    if (mobile || state.properties.interactive == false) interactive = false;
    // var widget = document.getElementsByClassName("cesium-widget").item(0);
    // var minWGS84 = [115.23, 39.55], maxWGS84 = [116.23, 41.55];
    // var position = Cesium.Cartesian3.fromDegrees((minWGS84[0] + maxWGS84[0]) / 2, (minWGS84[1] + maxWGS84[1]) / 2, 2500);
    volume = new Volume(state.objects[0], image, interactive, $('volume-container'));
    volume.slicer = slicer; //For axis position
  }
  if (Previous.SVData.length == 1) {
    Previous.SVData.push(volume);
    Previous.SVData.push(colours);
  } else {
    Previous.SVData[1] = volume;
  }

  //Volume draw on mouseup to apply changes from other controls (including slicer)
  //document.addEventListener("mouseup", function(ev) {if (volume) volume.delayedRender(250, true);}, false);
  //document.addEventListener("wheel", function(ev) {if (volume) volume.delayedRender(250, true);}, false);

  //Update colours (and draw objects)
  colours.read(state.colourmaps[0].colours);
  //Copy the global background colour
  colours.palette.background = new Colour(state.properties.background);
  colours.update();

  info.hide(); //Status

  /*/Draw speed test
  frames = 0;
  testtime = new Date().getTime();
  info.show();
  volume.draw(false, true);*/

  if (!state.properties.nogui) {
    var gui = new dat.GUI();
    if (state.properties.server)
      gui.add(
        {
          Update: function () {
            ajaxPost(state.properties.server + '/update', 'data=' + encodeURIComponent(getData(true, true)));
          },
        },
        'Update'
      );
    /* LOCALSTORAGE DISABLED
    gui.add({"Reset" : function() {resetFromData(reset);}}, 'Reset');*/
    gui.add(
      {
        Restore: function () {
          resetFromData(state);
        },
      },
      'Restore'
    );
    gui.add(
      {
        Export: function () {
          exportData();
        },
      },
      'Export'
    );
    //gui.add({"loadFile" : function() {document.getElementById('fileupload').click();}}, 'loadFile'). name('Load Image file');
    gui.add(
      {
        ColourMaps: function () {
          colourmaps.toggle();
        },
      },
      'ColourMaps'
    );

    // var f = gui.addFolder('Views');
    // var ir2 = 1.0 / Math.sqrt(2.0);
    // f.add({"XY" : function() {volume.rotate = quat.create([0, 0, 0, 1]);}}, 'XY');
    // f.add({"YX" : function() {volume.rotate = quat.create([0, 1, 0, 0]);}}, 'YX');
    // f.add({"XZ" : function() {volume.rotate = quat.create([ir2, 0, 0, -ir2]);}}, 'XZ');
    // f.add({"ZX" : function() {volume.rotate = quat.create([ir2, 0, 0, ir2]);}}, 'ZX');
    // f.add({"YZ" : function() {volume.rotate = quat.create([0, -ir2, 0, -ir2]);}}, 'YZ');
    // f.add({"ZY" : function() {volume.rotate = quat.create([0, -ir2, 0, ir2]);}}, 'ZY');

    if (volume) volume.addGUI(gui);
    if (slicer) slicer.addGUI(gui);
  }

  //Save props on exit
  window.onbeforeunload = saveData;
}

/////////////////////////////////////////////////////////////////////////
function autoResize() {
  if (volume) {
    volume.width = 0; //volume.canvas.width = window.innerWidth;
    volume.height = 0; //volume.canvas.height = window.innerHeight;
    // volume.draw();
  }
}

function updateColourmap() {
  if (!colours) return;
  var gradient = $('gradient');
  colours.palette.draw(gradient, false);

  if (volume && volume.webgl) {
    volume.webgl.updateTexture(volume.webgl.gradientTexture, gradient, volume.gl.TEXTURE1); //Use 2nd texture unit
    volume.applyBackground(colours.palette.background.html());
    // volume.draw();
  }

  if (slicer) {
    slicer.updateColourmap();
    slicer.draw();
  }
}

var request, progressBar;

function loadImage(imageURI, callback) {
  request = new XMLHttpRequest();
  request.onloadstart = showProgressBar;
  request.onprogress = updateProgressBar;
  request.onload = callback;
  request.onloadend = hideProgressBar;
  request.open('GET', imageURI, true);
  request.responseType = 'arraybuffer';
  request.send(null);
}

function showProgressBar() {
  progressBar = document.createElement('progress');
  progressBar.value = 0;
  progressBar.max = 100;
  progressBar.removeAttribute('value');
  document.getElementById('status').appendChild(progressBar);
}

function updateProgressBar(e) {
  if (e.lengthComputable) progressBar.value = (e.loaded / e.total) * 100;
  else progressBar.removeAttribute('value');
}

function hideProgressBar() {
  document.getElementById('status').removeChild(progressBar);
}

/**
 * @constructor
 */
function Popup(id, x, y) {
  this.el = $(id);
  this.style = $S(id);
  if (x && y) {
    this.style.left = x + 'px';
    this.style.top = y + 'px';
  } else {
    this.style.left = (window.innerWidth - this.el.offsetWidth) * 0.5 + 'px';
    this.style.top = (window.innerHeight - this.el.offsetHeight) * 0.5 + 'px';
  }
  this.drag = false;
}

Popup.prototype.toggle = function () {
  if (this.style.visibility == 'visible') this.hide();
  else this.show();
};

Popup.prototype.show = function () {
  this.style.visibility = 'visible';
};

Popup.prototype.hide = function () {
  this.style.visibility = 'hidden';
};

/*
 * ShareVol
 * Lightweight WebGL volume viewer/slicer
 *
 * Copyright (c) 2014, Monash University. All rights reserved.
 * Author: Owen Kaluza - owen.kaluza ( at ) monash.edu
 *
 * Licensed under the GNU Lesser General Public License
 * https://www.gnu.org/licenses/lgpl.html
 *
 */

function Slicer(props, image, filter, parentEl) {
  this.image = image;
  this.res = props.volume.res;
  this.dims = [props.volume.res[0] * props.volume.scale[0], props.volume.res[1] * props.volume.scale[1], props.volume.res[2] * props.volume.scale[2]];
  this.slices = [0.5, 0.5, 0.5];

  // Set properties
  this.properties = {};
  this.properties.show = true;
  this.properties.X = Math.round(this.res[0] / 2);
  this.properties.Y = Math.round(this.res[1] / 2);
  this.properties.Z = Math.round(this.res[2] / 2);
  this.properties.brightness = 0.0;
  this.properties.contrast = 1.0;
  this.properties.power = 1.0;
  this.properties.usecolourmap = false;
  this.properties.layout = 'xyz';
  this.flipY = false;
  this.properties.zoom = 1.0;

  this.container = document.createElement('div');
  this.container.style.cssText = 'position: absolute; bottom: 10px; right: 635px; margin: 0px; padding: 0px; pointer-events: none;';
  if (!parentEl) parentEl = document.body;
  parentEl.appendChild(this.container);

  //Load from local storage or previously loaded file
  if (props.slices) this.load(props.slices);

  this.canvas = document.createElement('canvas');
  this.canvas.id = 'slicer-canvas';
  this.canvas.style.cssText =
    'position: absolute; bottom: 0px; margin: 0px; padding: 0px; border: none; background: rgba(0,0,0,0); pointer-events: none;';

  this.doLayout();

  this.canvas.mouse = new Mouse(this.canvas, this);

  this.webgl = new WebGL(this.canvas);
  this.gl = this.webgl.gl;

  this.filter = this.gl.NEAREST; //Nearest-neighbour (default)
  if (filter == 'linear') this.filter = this.gl.LINEAR;

  //Use the default buffers
  this.webgl.init2dBuffers(this.gl.TEXTURE2);

  //Compile the shaders
  this.program = new WebGLProgram(this.gl, 'texture-vs', 'texture-fs');
  if (this.program.errors) OK.debug(this.program.errors);
  this.program.setup(['aVertexPosition'], ['palette', 'texture', 'colourmap', 'cont', 'bright', 'power', 'slice', 'dim', 'res', 'axis', 'select']);

  this.gl.clearColor(0, 0, 0, 0);
  this.gl.enable(this.gl.BLEND);
  this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
  this.gl.enable(this.gl.SCISSOR_TEST);

  //Load the textures
  this.loadImage(this.image);

  //Hidden?
  if (!this.properties.show) this.toggle();
}

Slicer.prototype.toggle = function () {
  if (this.container.style.visibility == 'hidden') this.container.style.visibility = 'visible';
  else this.container.style.visibility = 'hidden';
};

Slicer.prototype.show = function () {
  if (this.container.style.visibility != 'visible') {
    this.container.style.visibility = 'visible';
  }
};

Slicer.prototype.hide = function () {
  if (this.container.style.visibility != 'hidden') {
    this.container.style.visibility = 'hidden';
  }
};

Slicer.prototype.addGUI = function (gui) {
  this.gui = gui;
  var that = this;
  //Add folder
  var f1 = this.gui.addFolder('Slices');
  f1.add(this.properties, 'show').onFinishChange(function (l) {
    that.toggle();
  });
  //["hide/show"] = function() {};
  f1.add(this.properties, 'layout').onFinishChange(function (l) {
    that.doLayout();
    that.draw();
  });
  //f1.add(this.properties, 'X', 0, this.res[0], 1).listen();
  //f1.add(this.properties, 'Y', 0, this.res[1], 1).listen();
  //f1.add(this.properties, 'Z', 0, this.res[2], 1).listen();
  f1.add(this.properties, 'zoom', 0.01, 4.0, 0.1).onFinishChange(function (l) {
    that.doLayout();
    that.draw();
  });

  f1.add(this.properties, 'brightness', -1.0, 1.0, 0.01);
  f1.add(this.properties, 'contrast', 0.0, 3.0, 0.01);
  f1.add(this.properties, 'power', 0.01, 5.0, 0.01);
  f1.add(this.properties, 'usecolourmap');
  f1.open();

  var changefn = function (value) {
    that.draw();
  };
  for (var i in f1.__controllers) f1.__controllers[i].onChange(changefn);
};

Slicer.prototype.get = function () {
  var data = {};
  //data.colourmap = colours.palette.toString();
  data.properties = this.properties;
  return data;
};

Slicer.prototype.load = function (src) {
  //colours.read(data.colourmap);
  //colours.update();
  for (var key in src.properties) this.properties[key] = src.properties[key];
};

Slicer.prototype.setX = function (val) {
  this.properties.X = val * this.res[0];
  this.draw();
};
Slicer.prototype.setY = function (val) {
  this.properties.Y = val * this.res[1];
  this.draw();
};
Slicer.prototype.setZ = function (val) {
  this.properties.Z = val * this.res[2];
  this.draw();
};

Slicer.prototype.doLayout = function () {
  this.viewers = [];

  var x = 0;
  var y = 0;
  var xmax = 0;
  var ymax = 0;
  var rotate = 0;
  var alignTop = false;

  removeChildren(this.container);

  var that = this;
  var buffer = '';
  var rowHeight = 0,
    rowWidth = 0;
  var addViewer = function (idx) {
    var mag = 1.0;
    if (buffer) mag = parseFloat(buffer);
    var v = new SliceView(that, x, y, idx, rotate, mag);
    that.viewers.push(v);
    that.container.appendChild(v.div);

    //      x += v.viewport.width + 5; //Offset by previous width
    //      var h = v.viewport.height + 5;
    //      if (h > rowHeight) rowHeight = h;
    //      if (x > xmax) xmax = x;

    y += v.viewport.height + 5; //Offset by previous height
    var w = v.viewport.width + 5;
    if (w > rowWidth) rowWidth = w;
    if (y > ymax) ymax = y;
  };

  //Process based on layout
  this.flipY = false;
  for (var i = 0; i < this.properties.layout.length; i++) {
    var c = this.properties.layout.charAt(i);
    rotate = 0;
    switch (c) {
      case 'X':
        rotate = 90;
      case 'x':
        addViewer(0);
        break;
      case 'Y':
        rotate = 90;
      case 'y':
        addViewer(1);
        break;
      case 'Z':
        rotate = 90;
      case 'z':
        addViewer(2);
        break;
      case '|':
        //          x = 0;
        //          y += rowHeight; //this.viewers[this.viewers.length-1].viewport.height + 5; //Offset by previous height
        //          rowHeight = 0;

        y = 0;
        x += rowWidth;
        rowWidth = 0;
        break;
      case '_':
        this.flipY = true;
        break;
      case '-':
        alignTop = false;
        break;
      default:
        //Add other chars to buffer, if a number will be used as zoom
        buffer += c;
        continue;
    }
    //Clear buffer
    buffer = '';
  }

  //    this.width = xmax;
  //    this.height = y + rowHeight; //this.viewers[this.viewers.length-1].viewport.height;

  this.width = x + rowWidth;
  this.height = ymax;

  //Restore the main canvas
  this.container.appendChild(this.canvas);

  this.container.style.right = this.width + 25 + 'px';

  if (alignTop) {
    this.container.style.bottom = undefined;
    this.container.style.top = this.height + 105 + 'px';
  } else {
    this.container.style.top = undefined;
    this.container.style.bottom = 10 + 'px';
  }
};

Slicer.prototype.loadImage = function (image) {
  //Texture load
  for (var i = 0; i < 3; i++) this.webgl.loadTexture(image, this.filter);
  this.reset();
};

Slicer.prototype.reset = function () {
  this.dimx = this.image.width / this.res[0];
  this.dimy = this.image.height / this.res[1];
  //console.log(this.res[0] + "," + this.res[1] + "," + this.res[2] + " -- " + this.dimx + "x" + this.dimy);
};

Slicer.prototype.updateColourmap = function () {
  this.webgl.updateTexture(this.webgl.gradientTexture, $('gradient'), this.gl.TEXTURE2); //Use 2nd texture unit
  this.draw();
};

Slicer.prototype.draw = function () {
  this.slices = [
    (this.properties.X - 1) / (this.res[0] - 1),
    (this.properties.Y - 1) / (this.res[1] - 1),
    (this.properties.Z - 1) / (this.res[2] - 1),
  ];

  if (this.width != this.canvas.width || this.height != this.canvas.height) {
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.canvas.setAttribute('width', this.width);
    this.canvas.setAttribute('height', this.height);
    if (this.webgl) {
      this.gl.viewportWidth = this.width;
      this.gl.viewportHeight = this.height;
      this.webgl.viewport = new Viewport(0, 0, this.width, this.height);
    }
  }
  //console.log(this.gl.viewportWidth + " x " + this.gl.viewportHeight);
  //console.log(this.width + " x " + this.height);

  this.webgl.use(this.program);

  //Uniform variables

  //Gradient texture
  this.gl.activeTexture(this.gl.TEXTURE0);
  this.gl.bindTexture(this.gl.TEXTURE_2D, this.webgl.gradientTexture);
  this.gl.uniform1i(this.program.uniforms['palette'], 0);

  //Options
  this.gl.uniform1i(this.program.uniforms['colourmap'], this.properties.usecolourmap);

  // brightness and contrast
  this.gl.uniform1f(this.program.uniforms['bright'], this.properties.brightness);
  this.gl.uniform1f(this.program.uniforms['cont'], this.properties.contrast);
  this.gl.uniform1f(this.program.uniforms['power'], this.properties.power);

  //Image texture
  this.gl.activeTexture(this.gl.TEXTURE1);
  this.gl.bindTexture(this.gl.TEXTURE_2D, this.webgl.textures[0]);
  this.gl.uniform1i(this.program.uniforms['texture'], 1);

  //Clear all
  this.gl.scissor(0, 0, this.width, this.height);
  this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);

  //Draw each slice viewport
  for (var i = 0; i < this.viewers.length; i++) this.drawSlice(i);
};

Slicer.prototype.drawSlice = function (idx) {
  var view = this.viewers[idx];
  var vp = view.viewport;

  //Set selection crosshairs
  var sel;
  if (view.rotate == 90) sel = [1.0 - this.slices[view.j], this.slices[view.i]];
  else sel = [this.slices[view.i], this.slices[view.j]];

  //Swap y-coord
  if (!this.flipY) sel[1] = 1.0 - sel[1];

  this.webgl.viewport = vp;
  this.gl.scissor(vp.x, vp.y, vp.width, vp.height);
  //console.log(JSON.stringify(vp));

  //Apply translation to origin, any rotation and scaling (inverse of zoom factor)
  this.webgl.modelView.identity();
  this.webgl.modelView.translate([0.5, 0.5, 0]);
  this.webgl.modelView.rotate(-view.rotate, [0, 0, 1]);

  //Apply zoom and flip Y
  var scale = [1.0 / 2.0, -1.0 / 2.0, -1.0];
  if (this.flipY) scale[1] = -scale[1];
  this.webgl.modelView.scale(scale);

  //Texturing
  //this.gl.uniform1i(this.program.uniforms["slice"], ));
  this.gl.uniform3f(this.program.uniforms['slice'], this.slices[0], this.slices[1], this.slices[2]);
  this.gl.uniform2f(this.program.uniforms['dim'], this.dimx, this.dimy);
  this.gl.uniform3i(this.program.uniforms['res'], this.res[0], this.res[1], this.res[2]);
  this.gl.uniform1i(this.program.uniforms['axis'], view.axis);
  //Convert [0,1] selection coords to pixel coords
  this.gl.uniform2i(this.program.uniforms['select'], vp.width * sel[0] + vp.x, vp.height * sel[1] + vp.y);

  this.webgl.initDraw2d();

  this.gl.enable(this.gl.BLEND);

  //Draw, single pass
  this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
  this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, this.webgl.vertexPositionBuffer.numItems);
};

Slicer.prototype.clear = function () {
  this.container.remove();
  this.canvas.remove();
};

function SliceView(slicer, x, y, axis, rotate, magnify) {
  this.axis = axis;
  this.slicer = slicer;

  this.magnify = magnify || 1.0;
  this.origin = [0.5, 0.5];
  this.rotate = rotate || 0;

  //Calc viewport
  this.i = 0;
  this.j = 1;
  if (axis == 0) this.i = 2;
  if (axis == 1) this.j = 2;

  var w = Math.round(slicer.dims[this.i] * slicer.properties.zoom * this.magnify);
  var h = Math.round(slicer.dims[this.j] * slicer.properties.zoom * this.magnify);

  if (this.rotate == 90) this.viewport = new Viewport(x, y, h, w);
  else this.viewport = new Viewport(x, y, w, h);

  //Border and mouse interaction element
  this.div = document.createElement('div');
  this.div.style.cssText =
    'padding: 0px; margin: 0px; outline: 2px solid rgba(64,64,64,0.5); position: absolute; display: inline-block; pointer-events: auto;';
  this.div.id = 'slice-div-' + axis;

  this.div.style.left = x + 'px';
  this.div.style.bottom = y + 'px';
  this.div.style.width = this.viewport.width + 'px';
  this.div.style.height = this.viewport.height + 'px';

  this.div.mouse = new Mouse(this.div, this);
}

SliceView.prototype.click = function (event, mouse) {
  if (this.slicer.flipY) mouse.y = mouse.element.clientHeight - mouse.y;

  var coord;

  //Rotated?
  if (this.rotate == 90) coord = [mouse.y / mouse.element.clientHeight, 1.0 - mouse.x / mouse.element.clientWidth];
  else coord = [mouse.x / mouse.element.clientWidth, mouse.y / mouse.element.clientHeight];

  var A = Math.round(this.slicer.res[this.i] * coord[0]);
  var B = Math.round(this.slicer.res[this.j] * coord[1]);

  if (this.axis == 0) {
    slicer.properties.Z = A;
    slicer.properties.Y = B;
  } else if (this.axis == 1) {
    slicer.properties.X = A;
    slicer.properties.Z = B;
  } else {
    slicer.properties.X = A;
    slicer.properties.Y = B;
  }

  this.slicer.draw();
};

SliceView.prototype.wheel = function (event, mouse) {
  if (this.axis == 0) slicer.properties.X += event.spin;
  if (this.axis == 1) slicer.properties.Y += event.spin;
  if (this.axis == 2) slicer.properties.Z += event.spin;
  this.slicer.draw();
};

SliceView.prototype.move = function (event, mouse) {
  if (mouse.isdown) this.click(event, mouse);
};

/*
 * ShareVol
 * Lightweight WebGL volume viewer/slicer
 *
 * Copyright (c) 2014, Monash University. All rights reserved.
 * Author: Owen Kaluza - owen.kaluza ( at ) monash.edu
 *
 * Licensed under the GNU Lesser General Public License
 * https://www.gnu.org/licenses/lgpl.html
 *
 */
//BUGS:
//Canvas Y slightly too large, scroll bar appearing
//
//Improvements:
//Separate Opacity gradient
//Data min, data max - masked or clamped
//Timestepping
//Superimposed volumes

function Volume(props, image, interactive, parentEl) {
  this.image = image;
  this.canvas = document.createElement('canvas');
  this.canvas.id = 'volume-canvas';
  this.canvas.style.cssText = 'width: 100%; height: 100%; z-index: 0; margin: 0px; padding: 0px; background: black; border: none; display:block;';
  if (!parentEl) parentEl = document.body;
  parentEl.appendChild(this.canvas);

  //canvas event handling
  this.canvas.mouse = new Mouse(this.canvas, this);
  this.canvas.mouse.moveUpdate = true; //Continual update of deltaX/Y

  console.log(props.cesium);

  var rotat = quat.create();
  quat.rotateZ(rotat, rotat, (props.cesium['rotate'][2] * Math.PI) / 180);
  quat.rotateY(rotat, rotat, (props.cesium['rotate'][1] * Math.PI) / 180);
  var scale = props.cesium['scale'];
  var trans = props.cesium['translate'];
  this.modelMatrix = mat4.create();
  // mat4.fromRotationTranslationScaleOrigin()
  mat4.fromRotationTranslationScale(this.modelMatrix, rotat, trans, scale);

  // mat4.identity(this.modelMatrix);
  // mat4.translate(this.modelMatrix, this.modelMatrix, trans);
  // let quatMat = mat4.create();
  // mat4.fromQuat(quatMat, rotat);
  // mat4.multiply(this.modelMatrix, this.modelMatrix, quatMat);
  // mat4.scale(this.modelMatrix, this.modelMatrix, scale);

  // var matrixScale = mat4.create();
  // mat4.fromRotationTranslationScale();
  // mat4.fromScaling(matrixScale, vec3.fromValues(0.02, 0.02, 0.02));
  // mat4.translate(this.modelMatrix, matrixScale, vec3.fromValues(-1250, -1250, -1250));
  this.viewMatrix = Cesium.Matrix4.clone(Previous.SVData[0].camera.viewMatrix, new Cesium.Matrix4());
  this.projMatrix = Cesium.Matrix4.clone(Previous.SVData[0].camera.frustum.projectionMatrix, new Cesium.Matrix4());

  this.background = new Colour(0xff404040);
  this.borderColour = new Colour(0xffbbbbbb);

  this.width = this.height = 0; //Auto-size

  this.webgl = new WebGL(this.canvas);
  this.gl = this.webgl.gl;

  this.rotating = false;
  this.translate = [0, 0, 4];
  this.rotate = quat.create();
  quat.identity(this.rotate);
  this.focus = [0, 0, 0];
  this.centre = [0, 0, 0];
  this.modelsize = 1;
  this.scale = [1, 1, 1];
  this.orientation = 1.0; //1.0 for RH, -1.0 for LH
  this.fov = 60.0; // cesium
  this.focalLength = 1.0 / Math.tan((0.5 * this.fov * Math.PI) / 180);
  this.resolution = props.volume['res'];

  //Calculated scaling
  this.res = props.volume['res'];
  this.dims = props.volume['scale'];
  this.scaling = this.dims;
  //Auto compensate for differences in resolution..
  if (props.volume.autoscale) {
    //Divide all by the highest res
    var maxn = Math.max.apply(null, this.res);
    this.scaling = [(this.res[0] / maxn) * this.dims[0], (this.res[1] / maxn) * this.dims[1], (this.res[2] / maxn) * this.dims[2]];
  }
  this.tiles = [this.image.width / this.res[0], this.image.height / this.res[1]];
  this.iscale = [1.0 / this.scaling[0], 1.0 / this.scaling[1], 1.0 / this.scaling[2]];

  //Set dims
  this.centre = [0.5 * this.scaling[0], 0.5 * this.scaling[1], 0.5 * this.scaling[2]];
  this.modelsize = Math.sqrt(3);
  this.focus = this.centre;

  this.translate[2] = -this.modelsize * 1.25;

  OK.debug('New model size: ' + this.modelsize + ', Focal point: ' + this.focus[0] + ',' + this.focus[1] + ',' + this.focus[2]);

  //Setup 3D rendering
  this.linePositionBuffer = this.gl.createBuffer();
  this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.linePositionBuffer);
  var vertexPositions = [-1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, -1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, -1.0, 0.0, 0.0, 1.0];
  this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(vertexPositions), this.gl.STATIC_DRAW);
  this.linePositionBuffer.itemSize = 3;
  this.linePositionBuffer.numItems = 6;

  this.lineColourBuffer = this.gl.createBuffer();
  this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.lineColourBuffer);
  var vertexColours = [1.0, 0.0, 0.0, 1.0, 1.0, 0.0, 0.0, 1.0, 0.0, 1.0, 0.0, 1.0, 0.0, 1.0, 0.0, 1.0, 0.0, 0.0, 1.0, 1.0, 0.0, 0.0, 1.0, 1.0];
  this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(vertexColours), this.gl.STATIC_DRAW);
  this.lineColourBuffer.itemSize = 4;
  this.lineColourBuffer.numItems = 6;

  //Bounding box
  this.box([-0.5, -0.5, -0.5], [0.5, 0.5, 0.5]);

  //Setup two-triangle rendering
  this.webgl.init2dBuffers(this.gl.TEXTURE1); //Use 2nd texture unit

  //Override texture params set in previous call
  this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
  this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);

  this.webgl.loadTexture(image, this.gl.LINEAR);

  //Compile the shaders
  var IE11 = !!window.MSInputMethodContext; //More evil user-agent sniffing, broken WebGL on windows forces me to do this
  this.lineprogram = new WebGLProgram(this.gl, 'line-vs', 'line-fs');
  if (this.lineprogram.errors) OK.debug(this.lineprogram.errors);
  this.lineprogram.setup(['aVertexPosition', 'aVertexColour'], ['uColour', 'uAlpha']);
  this.gl.vertexAttribPointer(this.lineprogram.attributes['aVertexPosition'], this.linePositionBuffer.itemSize, this.gl.FLOAT, false, 0, 0);
  this.gl.vertexAttribPointer(this.lineprogram.attributes['aVertexColour'], this.lineColourBuffer.itemSize, this.gl.FLOAT, false, 0, 0);

  var defines = 'precision highp float; const highp vec2 slices = vec2(' + this.tiles[0] + ',' + this.tiles[1] + ');\n';
  defines += IE11 ? '#define IE11\n' : '#define NOT_IE11\n';
  var maxSamples = interactive ? 1024 : 256;
  defines += 'const int maxSamples = ' + maxSamples + ';\n\n\n\n\n\n'; //Extra newlines so errors in main shader have correct line #
  OK.debug(defines);

  var fs = getSourceFromElement('volume-fs');
  this.program = new WebGLProgram(this.gl, 'volume-vs', defines + fs);
  //console.log(defines + fs);
  if (this.program.errors) OK.debug(this.program.errors);
  this.program.setup(
    ['aVertexPosition'],
    [
      'uBackCoord',
      'uVolume',
      'uTransferFunction',
      'uEnableColour',
      'uFilter',
      'uDensityFactor',
      'uPower',
      'uSaturation',
      'uBrightness',
      'uContrast',
      'uSamples',
      'uViewport',
      'uBBMin',
      'uBBMax',
      'uResolution',
      'uRange',
      'uDenMinMax',
      'uIsoValue',
      'uIsoColour',
      'uIsoSmooth',
      'uIsoWalls',
      'uInvPMatrix',
    ]
  );

  this.gl.enable(this.gl.DEPTH_TEST);
  this.gl.clearColor(0, 0, 0, 0);
  //this.gl.clearColor(this.background.red/255, this.background.green/255, this.background.blue/255, 0.0);
  this.gl.enable(this.gl.BLEND);
  this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
  this.gl.depthFunc(this.gl.LEQUAL);

  //Set default properties
  this.properties = {};

  this.properties.samples = 256;
  this.properties.isovalue = 0.0;
  this.properties.isowalls = false;
  this.properties.isoalpha = 0.75;
  this.properties.isosmooth = 1.0;
  this.properties.colour = [214, 188, 86];

  this.properties.xmin = this.properties.ymin = this.properties.zmin = 0.0;
  this.properties.xmax = this.properties.ymax = this.properties.zmax = 1.0;

  this.properties.density = 10.0;
  this.properties.saturation = 1.0;
  this.properties.brightness = 0.0;
  this.properties.contrast = 1.0;
  this.properties.power = 1.0;
  this.properties.mindensity = props.volume.mindensity || 0.0;
  this.properties.maxdensity = props.volume.mindensity || 1.0;
  this.properties.usecolourmap = false;
  this.properties.tricubicFilter = false;
  this.properties.interactive = interactive;
  this.properties.axes = true;
  this.properties.border = true;
  this.properties.firstLoop = true;
  //Load from local storage or previously loaded file
  this.load(props);
}

Volume.prototype.box = function (min, max) {
  var vertices = new Float32Array([
    min[0],
    min[1],
    max[2],
    min[0],
    max[1],
    max[2],
    max[0],
    max[1],
    max[2],
    max[0],
    min[1],
    max[2],
    min[0],
    min[1],
    min[2],
    min[0],
    max[1],
    min[2],
    max[0],
    max[1],
    min[2],
    max[0],
    min[1],
    min[2],
  ]);

  var indices = new Uint16Array([0, 1, 1, 2, 2, 3, 3, 0, 4, 5, 5, 6, 6, 7, 7, 4, 0, 4, 3, 7, 1, 5, 2, 6]);
  this.boxPositionBuffer = this.gl.createBuffer();
  this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.boxPositionBuffer);
  this.gl.bufferData(this.gl.ARRAY_BUFFER, vertices, this.gl.STATIC_DRAW);
  this.boxPositionBuffer.itemSize = 3;

  this.boxIndexBuffer = this.gl.createBuffer();
  this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.boxIndexBuffer);
  this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, indices, this.gl.STATIC_DRAW);
  this.boxIndexBuffer.numItems = 24;
};

Volume.prototype.addGUI = function (gui) {
  if (this.gui) this.gui.destroy(); //Necessary/valid?

  this.gui = gui;

  var f = this.gui.addFolder('Volume');
  f.add(this.properties, 'interactive');
  f.add(this.properties, 'usecolourmap');
  this.properties.samples = Math.floor(this.properties.samples);
  if (this.properties.samples % 32 > 0) this.properties.samples -= this.properties.samples % 32;
  f.add(this.properties, 'samples', 32, 1024, 32);
  f.add(this.properties, 'density', 0.0, 50.0, 1.0);
  f.add(this.properties, 'brightness', -1.0, 1.0, 0.05);
  f.add(this.properties, 'contrast', 0.0, 2.0, 0.05);
  f.add(this.properties, 'saturation', 0.0, 2.0, 0.05);
  f.add(this.properties, 'power', 0.01, 5.0, 0.05);
  f.add(this.properties, 'mindensity', 0.0, 1.0, 0.0);
  f.add(this.properties, 'maxdensity', 0.0, 1.0, 1.0);
  f.add(this.properties, 'axes');
  f.add(this.properties, 'border');
  f.add(this.properties, 'tricubicFilter');
  f.open();
  //this.gui.__folders.f.controllers[1].updateDisplay();  //Update samples display

  //Clip planes folder
  var f0 = this.gui.addFolder('Clip planes');
  f0.add(this.properties, 'xmin', 0.0, 1.0, 0.01); //.onFinishChange(function(l) {if (slicer) slicer.setX(l);});
  f0.add(this.properties, 'xmax', 0.0, 1.0, 0.01); //.onFinishChange(function(l) {if (slicer) slicer.setX(l);});
  f0.add(this.properties, 'ymin', 0.0, 1.0, 0.01); //.onFinishChange(function(l) {if (slicer) slicer.setY(l);});
  f0.add(this.properties, 'ymax', 0.0, 1.0, 0.01); //.onFinishChange(function(l) {if (slicer) slicer.setY(l);});
  f0.add(this.properties, 'zmin', 0.0, 1.0, 0.01); //.onFinishChange(function(l) {if (slicer) slicer.setZ(l);});
  f0.add(this.properties, 'zmax', 0.0, 1.0, 0.01); //.onFinishChange(function(l) {if (slicer) slicer.setZ(l);});
  //f0.open();

  //Isosurfaces folder
  var f1 = this.gui.addFolder('Isosurface');
  f1.add(this.properties, 'isovalue', 0.0, 1.0, 0.01);
  f1.add(this.properties, 'isowalls');
  f1.add(this.properties, 'isoalpha', 0.0, 1.0, 0.01);
  f1.add(this.properties, 'isosmooth', 0.1, 3.0, 0.1);
  f1.addColor(this.properties, 'colour');
  //f1.open();

  // Iterate over all controllers and set change function
  var that = this;
  var changefn = function (value) {
    that.delayedRender(250);
  }; //Use delayed high quality render for faster interaction
  for (var i in f.__controllers) f.__controllers[i].onChange(changefn);
  for (var i in f0.__controllers) f0.__controllers[i].onChange(changefn);
  for (var i in f1.__controllers) f1.__controllers[i].onChange(changefn);
};

Volume.prototype.load = function (src) {
  for (var key in src) this.properties[key] = src[key];

  if (src.colourmap != undefined) this.properties.usecolourmap = true;
  this.properties.axes = state.views[0].axes;
  this.properties.border = state.views[0].border;
  this.properties.tricubicFilter = src.tricubicfilter;

  if (state.views[0].translate) this.translate = state.views[0].translate;
  //Initial rotation (Euler angles or quaternion accepted)
  if (state.views[0].rotate) {
    if (state.views[0].rotate.length == 3) {
      this.rotateZ(-state.views[0].rotate[2]);
      this.rotateY(-state.views[0].rotate[1]);
      this.rotateX(-state.views[0].rotate[0]);
    } else if (state.views[0].rotate[3] != 0) this.rotate = quat.create(state.views[0].rotate);
  }
};

Volume.prototype.get = function (matrix) {
  var data = {};
  if (matrix) {
    //Include the modelview matrix array
    data.modelview = this.webgl.modelView.toArray();
  } else {
    //Translate + rotation quaternion
    data.translate = this.translate;
    data.rotate = [this.rotate[0], this.rotate[1], this.rotate[2], this.rotate[3]];
  }
  data.properties = this.properties;
  return data;
};

var frames = 0;
var testtime;

Volume.prototype.draw = function (lowquality, testmode) {
  console.log('showvolume:' + Previous.SVData.showVolume);
  if (!Previous.SVData.showVolume) {
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
    if (slicer) slicer.hide();
    return;
  }
  let updateViewMatrix = false,
    updateProjMatrix = false;
  if (!this.viewMatrix.equals(Previous.SVData[0].camera.viewMatrix)) {
    this.viewMatrix = Cesium.Matrix4.clone(Previous.SVData[0].camera.viewMatrix, new Cesium.Matrix4());
    updateViewMatrix = true;
  }
  if (!this.projMatrix.equals(Previous.SVData[0].camera.frustum.projectionMatrix)) {
    this.viewMatrix = Cesium.Matrix4.clone(Previous.SVData[0].camera.frustum.projectionMatrix, new Cesium.Matrix4());
    updateProjMatrix = true;
  }

  if (!this.properties.firstLoop) {
    if (!updateViewMatrix && !updateProjMatrix) return;
  } else this.properties.firstLoop = false;

  if (!this.properties || !this.webgl) return; //Getting called before vars defined, TODO:fix

  //this.time = new Date().getTime();
  if (this.width == 0 || this.height == 0) {
    //Get size from window
    this.width = window.innerWidth;
    this.height = window.innerHeight;
  }
  if (this.width != this.canvas.width || this.height != this.canvas.height) {
    //Get size from element
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.canvas.setAttribute('width', this.width);
    this.canvas.setAttribute('height', this.height);
    if (this.gl) {
      this.gl.viewportWidth = this.width;
      this.gl.viewportHeight = this.height;
      this.webgl.viewport = new Viewport(0, 0, this.width, this.height);
    }
  }
  //Reset to auto-size...
  //this.width = this.height = 0;
  //console.log(this.width + "," + this.height);
  this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
  this.gl.viewport(this.webgl.viewport.x, this.webgl.viewport.y, this.webgl.viewport.width, this.webgl.viewport.height);

  //box/axes draw fully opaque behind volume
  if (this.properties.border) this.drawBox(1.0);
  if (this.properties.axes) this.drawAxis(1.0);

  //Volume render (skip while interacting if lowpower device flag is set)
  if (!(lowquality && !this.properties.interactive)) {
    //Setup volume camera
    this.webgl.modelView.push();
    //this.copyCamera();
    this.copyCamera();

    this.webgl.use(this.program);
    //this.webgl.modelView.scale(this.scaling);  //Apply scaling
    this.gl.disableVertexAttribArray(this.program.attributes['aVertexColour']);

    this.gl.activeTexture(this.gl.TEXTURE0);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.webgl.textures[0]);

    this.gl.activeTexture(this.gl.TEXTURE1);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.webgl.gradientTexture);

    //Only render full quality when not interacting
    //this.gl.uniform1i(this.program.uniforms["uSamples"], this.samples);
    this.gl.uniform1i(this.program.uniforms['uSamples'], lowquality ? this.properties.samples * 0.5 : this.properties.samples);
    this.gl.uniform1i(this.program.uniforms['uVolume'], 0);
    this.gl.uniform1i(this.program.uniforms['uTransferFunction'], 1);
    this.gl.uniform1i(this.program.uniforms['uEnableColour'], this.properties.usecolourmap);
    this.gl.uniform1i(this.program.uniforms['uFilter'], lowquality ? false : this.properties.tricubicFilter);
    this.gl.uniform4fv(this.program.uniforms['uViewport'], new Float32Array([0, 0, this.gl.viewportWidth, this.gl.viewportHeight]));

    var bbmin = [this.properties.xmin, this.properties.ymin, this.properties.zmin];
    var bbmax = [this.properties.xmax, this.properties.ymax, this.properties.zmax];
    this.gl.uniform3fv(this.program.uniforms['uBBMin'], new Float32Array(bbmin));
    this.gl.uniform3fv(this.program.uniforms['uBBMax'], new Float32Array(bbmax));
    this.gl.uniform3fv(this.program.uniforms['uResolution'], new Float32Array(this.resolution));

    this.gl.uniform1f(this.program.uniforms['uDensityFactor'], this.properties.density);
    // brightness and contrast
    this.gl.uniform1f(this.program.uniforms['uSaturation'], this.properties.saturation);
    this.gl.uniform1f(this.program.uniforms['uBrightness'], this.properties.brightness);
    this.gl.uniform1f(this.program.uniforms['uContrast'], this.properties.contrast);
    this.gl.uniform1f(this.program.uniforms['uPower'], this.properties.power);

    this.gl.uniform1f(this.program.uniforms['uIsoValue'], this.properties.isovalue);
    var colour = new Colour(this.properties.colour);
    colour.alpha = this.properties.isoalpha;
    this.gl.uniform4fv(this.program.uniforms['uIsoColour'], colour.rgbaGL());
    this.gl.uniform1f(this.program.uniforms['uIsoSmooth'], this.properties.isosmooth);
    this.gl.uniform1i(this.program.uniforms['uIsoWalls'], this.properties.isowalls);

    //Data value range (default only for now)
    this.gl.uniform2fv(this.program.uniforms['uRange'], new Float32Array([0.0, 1.0]));
    //Density clip range
    this.gl.uniform2fv(this.program.uniforms['uDenMinMax'], new Float32Array([this.properties.mindensity, this.properties.maxdensity]));

    //Draw two triangles
    this.webgl.initDraw2d(); //This sends the matrices, uNMatrix may not be correct here though
    this.gl.uniformMatrix4fv(this.program.uniforms['uInvPMatrix'], false, this.invPMatrix);
    //this.gl.enableVertexAttribArray(this.program.attributes["aVertexPosition"]);
    //this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.webgl.vertexPositionBuffer);
    //this.gl.vertexAttribPointer(this.program.attributes["aVertexPosition"], this.webgl.vertexPositionBuffer.itemSize, this.gl.FLOAT, false, 0, 0);
    //this.webgl.setMatrices();

    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, this.webgl.vertexPositionBuffer.numItems);

    this.webgl.modelView.pop();
  } else {
    //Always draw axis even if turned off to show interaction
    if (!this.properties.axes) this.drawAxis(1.0);
    //Bounding box
    this.drawBox(1.0);
  }
  //this.timeAction("Render", this.time);

  //Draw box/axes again as overlay (near transparent)
  this.gl.clear(this.gl.DEPTH_BUFFER_BIT);
  if (this.properties.axes) this.drawAxis(0.2);
  if (this.properties.border) this.drawBox(0.2);

  //Running speed test?
  if (testmode) {
    frames++;
    $('status').innerHTML = 'Speed test: frame ' + frames;
    if (frames == 5) {
      var elapsed = new Date().getTime() - testtime;
      console.log('5 frames in ' + elapsed / 1000 + ' seconds');
      //Reduce quality for slower device
      if (elapsed > 1000) {
        this.properties.samples = Math.floor((this.properties.samples * 1000) / elapsed);
        if (this.properties.samples < 32) this.properties.samples = 32;
        $('status').innerHTML = '5 frames in ' + elapsed / 1000 + ' seconds, Reduced quality to ' + this.properties.samples;
        //Hide info window in 2 sec
        setTimeout(function () {
          info.hide();
        }, 2000);
      } else {
        info.hide();
      }
    } else {
      this.draw(true, true);
    }
  }

  if (slicer) slicer.show();
};

Volume.prototype.copyCamera = function () {
  // Copy viewMatrix from cesium camera
  // var cvm = DTGlobe[0].camera.viewMatrix;
  // this.webgl.modelView.matrix = mat4.fromValues(
  //   cvm[0 ], cvm[1 ], cvm[2 ], cvm[3 ],
  //   cvm[4 ], cvm[5 ], cvm[6 ], cvm[7 ],
  //   cvm[8 ], cvm[9 ], cvm[10], cvm[11],
  //   cvm[12], cvm[13], cvm[14], cvm[15]
  // );

  var camera = Previous.SVData[0].camera;
  mat4.lookAt(
    this.webgl.modelView.matrix,
    vec3.fromValues(camera.position.x, camera.position.y, camera.position.z),
    vec3.fromValues(0.0, 0.0, 0.0),
    vec3.fromValues(camera.up.x, camera.up.y, camera.up.z)
  );

  // model-view matrix = viewMatrix * modelMatrix
  this.webgl.modelView.mult(this.modelMatrix);

  //Perspective matrix
  //var frustum = DTGlobe[0].camera.frustum;
  //this.webgl.setPerspective(frustum.fovy, frustum.aspectRatio, frustum.near, frustum.far);

  var pm = Previous.SVData[0].camera.frustum.projectionMatrix;
  this.webgl.perspective.matrix = mat4.fromValues(
    pm[0],
    pm[1],
    pm[2],
    pm[3],
    pm[4],
    pm[5],
    pm[6],
    pm[7],
    pm[8],
    pm[9],
    pm[10],
    pm[11],
    pm[12],
    pm[13],
    pm[14],
    pm[15]
  );

  //Get inverted matrix for volume shader
  this.invPMatrix = mat4.create();
  mat4.invert(this.invPMatrix, this.webgl.perspective.matrix);
};

Volume.prototype.camera = function () {
  //Apply translation to origin, any rotation and scaling
  this.webgl.modelView.identity();
  this.webgl.modelView.translate(this.translate);
  // Adjust centre of rotation, default is same as focal point so this does nothing...
  var adjust = [-(this.focus[0] - this.centre[0]), -(this.focus[1] - this.centre[1]), -(this.focus[2] - this.centre[2])];
  this.webgl.modelView.translate(adjust);

  // rotate model
  var rotmat = mat4.create();
  mat4.fromQuat(rotmat, this.rotate);
  this.webgl.modelView.mult(rotmat);
  //this.webgl.modelView.mult(this.rotate);

  // Adjust back for rotation centre
  adjust = [this.focus[0] - this.centre[0], this.focus[1] - this.centre[1], this.focus[2] - this.centre[2]];
  this.webgl.modelView.translate(adjust);

  // Translate back by centre of model to align eye with model centre
  this.webgl.modelView.translate([-this.focus[0], -this.focus[1], -this.focus[2] * this.orientation]);

  //Perspective matrix
  this.webgl.setPerspective(this.fov, this.gl.viewportWidth / this.gl.viewportHeight, 0.1, 100.0);
};

Volume.prototype.rayCamera = function () {
  //Apply translation to origin, any rotation and scaling
  this.webgl.modelView.identity();
  this.webgl.modelView.translate(this.translate);

  // rotate model
  var rotmat = mat4.create();
  mat4.fromQuat(rotmat, this.rotate);
  this.webgl.modelView.mult(rotmat);

  //For a volume cube other than [0,0,0] - [1,1,1], need to translate/scale here...
  this.webgl.modelView.translate([-this.scaling[0] * 0.5, -this.scaling[1] * 0.5, -this.scaling[2] * 0.5]); //Translate to origin
  //Inverse of scaling
  this.webgl.modelView.scale([this.iscale[0], this.iscale[1], this.iscale[2]]);

  //Perspective matrix
  this.webgl.setPerspective(this.fov, this.gl.viewportWidth / this.gl.viewportHeight, 0.1, 100.0);

  //Get inverted matrix for volume shader
  this.invPMatrix = mat4.create();
  mat4.invert(this.invPMatrix, this.webgl.perspective.matrix);
};

Volume.prototype.drawAxis = function (alpha) {
  this.camera();
  this.webgl.use(this.lineprogram);
  this.gl.uniform1f(this.lineprogram.uniforms['uAlpha'], alpha);
  this.gl.uniform4fv(this.lineprogram.uniforms['uColour'], new Float32Array([1.0, 1.0, 1.0, 0.0]));

  this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.linePositionBuffer);
  this.gl.enableVertexAttribArray(this.lineprogram.attributes['aVertexPosition']);
  this.gl.vertexAttribPointer(this.lineprogram.attributes['aVertexPosition'], this.linePositionBuffer.itemSize, this.gl.FLOAT, false, 0, 0);

  this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.lineColourBuffer);
  this.gl.enableVertexAttribArray(this.lineprogram.attributes['aVertexColour']);
  this.gl.vertexAttribPointer(this.lineprogram.attributes['aVertexColour'], this.lineColourBuffer.itemSize, this.gl.FLOAT, false, 0, 0);

  //Axis position, default centre, use slicer positions if available
  var pos = [0.5 * this.scaling[0], 0.5 * this.scaling[1], 0.5 * this.scaling[2]];
  if (this.slicer) {
    pos = [this.slicer.slices[0] * this.scaling[0], this.slicer.slices[1] * this.scaling[1], this.slicer.slices[2] * this.scaling[2]];
  }
  this.webgl.modelView.translate(pos);
  this.webgl.setMatrices();
  this.gl.drawArrays(this.gl.LINES, 0, this.linePositionBuffer.numItems);
  this.webgl.modelView.translate([-pos[0], -pos[1], -pos[2]]);
};

Volume.prototype.drawBox = function (alpha) {
  this.copyCamera();
  this.webgl.use(this.lineprogram);
  this.gl.uniform1f(this.lineprogram.uniforms['uAlpha'], alpha);
  this.gl.uniform4fv(this.lineprogram.uniforms['uColour'], this.borderColour.rgbaGL());

  this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.boxPositionBuffer);
  this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.boxIndexBuffer);
  this.gl.enableVertexAttribArray(this.lineprogram.attributes['aVertexPosition']);
  this.gl.vertexAttribPointer(this.lineprogram.attributes['aVertexPosition'], this.boxPositionBuffer.itemSize, this.gl.FLOAT, false, 0, 0);
  this.gl.vertexAttribPointer(this.lineprogram.attributes['aVertexColour'], 4, this.gl.UNSIGNED_BYTE, true, 0, 0);

  this.webgl.modelView.scale(this.scaling); //Apply scaling
  this.webgl.setMatrices();
  this.gl.drawElements(this.gl.LINES, this.boxIndexBuffer.numItems, this.gl.UNSIGNED_SHORT, 0);
};

Volume.prototype.timeAction = function (action, start) {
  if (!window.requestAnimationFrame) return;
  var timer = start || new Date().getTime();
  function logTime() {
    var elapsed = new Date().getTime() - timer;
    if (elapsed < 50) window.requestAnimationFrame(logTime); //Not enough time, assume triggered too early, try again
    else {
      console.log(action + ' took: ' + elapsed / 1000 + ' seconds');
      /*if (elapsed > 200 && this.quality > 32) {
        this.quality = Math.floor(this.quality * 0.5);
        OK.debug("Reducing quality to " + this.quality + " samples");
        this.draw();
      } else if (elapsed < 100 && this.quality < 512 && this.quality >= 128) {
        this.quality = this.quality * 2;
        OK.debug("Increasing quality to " + this.quality + " samples");
        this.draw();
      }*/
    }
  }
  window.requestAnimationFrame(logTime);
};

Volume.prototype.rotateX = function (deg) {
  this.rotation(deg, [1, 0, 0]);
};

Volume.prototype.rotateY = function (deg) {
  this.rotation(deg, [0, 1, 0]);
};

Volume.prototype.rotateZ = function (deg) {
  this.rotation(deg, [0, 0, 1]);
};

Volume.prototype.rotation = function (deg, axis) {
  //Quaterion rotate
  var arad = (deg * Math.PI) / 180.0;
  // var rotation = quat.fromAngleAxis(arad, axis);
  var rotation = quat.create();
  var half = arad * 0.5;
  var s = Math.sin(half);
  rotation[3] = Math.cos(half);
  rotation[0] = s * axis[0];
  rotation[1] = s * axis[1];
  rotation[2] = s * axis[2];

  rotation = quat.normalize(rotation, rotation);
  this.rotate = quat.multiply(rotation, rotation, this.rotate);
};

Volume.prototype.zoom = function (factor) {
  this.translate[2] += factor * this.modelsize;
};

Volume.prototype.zoomClip = function (factor) {
  //var clip = parseFloat($("nearclip").value) - factor;
  //$("nearclip").value = clip;
  this.draw();
  //OK.debug(clip + " " + $("nearclip").value);
};

Volume.prototype.click = function (event, mouse) {
  this.rotating = false;
  this.draw();
  return false;
};

Volume.prototype.move = function (event, mouse) {
  this.rotating = false;
  if (!mouse.isdown) return true;

  //Switch buttons for translate/rotate
  var button = mouse.button;

  switch (button) {
    case 0:
      this.rotateY(mouse.deltaX / 5.0);
      this.rotateX(mouse.deltaY / 5.0);
      this.rotating = true;
      break;
    case 1:
      this.rotateZ(Math.sqrt(mouse.deltaX * mouse.deltaX + mouse.deltaY * mouse.deltaY) / 5.0);
      this.rotating = true;
      break;
    case 2:
      var adjust = this.modelsize / 1000; //1/1000th of size
      this.translate[0] += mouse.deltaX * adjust;
      this.translate[1] -= mouse.deltaY * adjust;
      break;
  }

  this.draw(true);
  return false;
};

Volume.prototype.wheel = function (event, mouse) {
  if (event.shiftKey) {
    var factor = event.spin * 0.01;
    this.zoomClip(factor);
  } else {
    var factor = event.spin * 0.05;
    this.zoom(factor);
  }
  this.delayedRender(250); //Delayed high quality render

  return false; //Prevent default
};

Volume.prototype.pinch = function (event, mouse) {
  var zoom = event.distance * 0.0001;
  this.zoom(zoom);
  this.delayedRender(250); //Delayed high quality render
};

//Delayed high quality render
Volume.prototype.delayedRender = function (time, skipImm) {
  if (!skipImm) this.draw(true); //Draw immediately in low quality
  //Set timer to draw the final render
  if (this.delaytimer) clearTimeout(this.delaytimer);
  var that = this;
  this.delaytimer = setTimeout(function () {
    that.draw();
  }, time);
};

Volume.prototype.applyBackground = function (bg) {
  if (!bg) return;
  this.background = new Colour(bg);
  var hsv = this.background.HSV();
  this.borderColour = hsv.V > 50 ? new Colour(0xff444444) : new Colour(0xffbbbbbb);

  //document.body.style.background = bg;

  //Set canvas background
  if (this.properties.usecolourmap) this.canvas.style.backgroundColor = bg;
  else this.canvas.style.backgroundColor = 'black';
};

Volume.prototype.clear = function () {
  this.canvas.remove();
};

export { initVolume, updateColourmap };
