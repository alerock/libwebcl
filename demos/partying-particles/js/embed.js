/*  EmbedGL.js -- WebGL Framework
    Copyright (C) 2011  Frédéric Langlade-Bellone

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Lesser General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/> */

var EmbedGL = function(dom_id, config){
    this.config = config;
    this.canvas = Dom.id(dom_id);
    this.attributes = {};
    this.uniforms = {};
    this.auxBuffers = {};
    this.mvMatrix = mat4.create();
    this.pMatrix = mat4.create();
    this.rotMatrix = mat4.create();
    this.nMatrix = mat3.create();
    this.mvMatrixLoc = undefined;
    this.pMatrixLoc = undefined;
    this.nMatrix = undefined;
    this.shaderProgram = undefined;
    mat4.identity(this.rotMatrix);
    this.gl = undefined;
    this.maxZoom = 0;
    this.cam = {
        eye : [config.eyePos[0],config.eyePos[1],config.eyePos[2]],
        target : config.targetPos
    };
    this.container = this.canvas.parentNode;
    this.initGL();
    this.initShaders();
    this.initMouseEvents();
    this.glResize();
};

EmbedGL.prototype.initMouseEvents = function(){
    var mouseDown = false;
    var lastMouseX = null;
    var lastMouseY = null;
    var self = this;
    var ctrlDown = false;
    var shiftDown = false;
    var altDown = false;
    
    this.canvas.onmousedown = function(event) {
        mouseDown = true;
        lastMouseX = event.clientX;
        lastMouseY = event.clientY;
        if (!(shiftDown && self.config.enableRotates) && !(ctrlDown && self.config.enableMoves) && !altDown){
            var pos = self.toGLUnits([event.pageX - Dom.oLeft(self.canvas), 
                (self.canvas.offsetHeight - (event.pageY - Dom.oTop(self.canvas)))], true);
            self.config.clickEvt(event, [pos[0] + self.cam.eye[0], pos[1] + self.cam.eye[1]]);
        }
    };
    
    document.onmouseup = function(event) {
        mouseDown = false;
    };
    
    document.onkeydown = function(e){
        if (e.which == 18){
            altDown = true;
        }
        else if(e.which == 16){
            shiftDown = true;
        } else if (e.which == 17){
            ctrlDown = true;
        } else if (self.config["pressedK" + e.which] !==undefined ){
            self.config["pressedK" + e.which]();
        }
        
    };
    
    document.onkeyup = function(e){
        if (e.which == 18){
            altDown = false;
        } else if (e.which == 16){
            shiftDown = false;
        }
        if (e.which == 17){
            ctrlDown = false;
        }
    };
    
    this.canvas.onmousemove = function(event) {
        var newX = event.clientX;
        var newY = event.clientY;
    
        var deltaX = newX - lastMouseX;
        var deltaY = newY - lastMouseY;
        if (mouseDown && ctrlDown && self.config.enableMoves){
            self.cam.eye[0] += deltaX / 50;
            self.cam.eye[1] -= deltaY / 50;
        } else if (mouseDown && shiftDown && self.config.enableRotations) {
            var newRotationMatrix = mat4.create();
            mat4.identity(newRotationMatrix);
            mat4.rotate(self.rotMatrix, degToRad(deltaX / 5), [0, 1, 0]);
            mat4.rotate(self.rotMatrix, degToRad(deltaY / 5), [1, 0, 0]);
            mat4.multiply(newRotationMatrix, self.rotMatrix, self.rotMatrix);
        } else if (mouseDown && altDown){
            self.config.altMoveEvt(event, self.toGLUnits([deltaX, deltaY]));
        } else {
            self.config.moveEvt(event, mouseDown, self.toGLUnits([deltaX, deltaY]));
        }
        lastMouseX = newX;
        lastMouseY = newY;
    };
    
    window.addEventListener('DOMMouseScroll', function(e){
        self.cam.eye[2] += 0.6 / Math.abs(e.detail) * e.detail;
        self.glResize();
        return false;
    }, false);
};

EmbedGL.prototype.glResize = function(width, height){
    if (width !== undefined && height !== undefined){
        //this.container.style.width = width + "px";
        //this.container.style.height = height + "px";
        this.gl.viewportWidth = this.canvas.width = width;
        this.gl.viewportHeight = this.canvas.height = height;
    }
    var w = this.config.fovWidth + this.config.fovWidth * 
        (this.cam.eye[2] - this.config.eyePos[2]) * this.config.zoomReduction;
    var h = this.canvas.height / this.canvas.width * w;
    this.currFovWidth = w * 2;
    this.currFovHeight = h * 2;
    mat4.ortho(-w, w, -h, h, 0.1, 500, this.pMatrix);
};

EmbedGL.prototype.initShaders = function(){
    var fragmentShader = this.makeShader(this.gl.FRAGMENT_SHADER, this.config.fragShader);
    var vertexShader = this.makeShader(this.gl.VERTEX_SHADER, this.config.vertShader);
    this.shaderProgram = this.gl.createProgram();
    this.gl.attachShader(this.shaderProgram, vertexShader);
    this.gl.attachShader(this.shaderProgram, fragmentShader);
    this.gl.linkProgram(this.shaderProgram);

    if (!this.gl.getProgramParameter(this.shaderProgram, this.gl.LINK_STATUS)) {
        alert("Could not initialise shaders");
    }

    this.gl.useProgram(this.shaderProgram);
    
    for (var e in this.config.attributes){
        this.attributes[e] = {
            loc : this.gl.getAttribLocation(this.shaderProgram, e),
            type : this.config.attributes[e],
            buffer : this.gl.createBuffer()
        };
        this.gl.enableVertexAttribArray(this.attributes[e].loc);
    };
    
    for (e in this.config.uniforms){
        this.uniforms[e] = {
            loc : this.gl.getUniformLocation(this.shaderProgram, e),
            type : this.config.uniforms[e]
        };
        if (this.uniforms[e].type == "modelview"){
            this.mvMatrixLoc = this.uniforms[e].loc;
            this.uniforms[e].type = "mat4";
        }else if (this.uniforms[e].type == "normal"){
            this.nMatrixLoc = this.uniforms[e].loc;
            this.uniforms[e].type = "mat3";            
        }else if (this.uniforms[e].type == "projection"){
            this.pMatrixLoc = this.uniforms[e].loc;
            this.uniforms[e].type = "mat4";            
        }
    }
};

EmbedGL.prototype.initGL = function(){
    this.canvas.initWidth = this.canvas.width;
    this.canvas.initHeight = this.canvas.height;
    try {
        this.gl = this.canvas.getContext("experimental-webgl");
    } catch (e) {}
    if (!this.gl) {
        alert("Could not initialise WebGL, sorry :-(");
    }
    this.gl.clearColor(this.config.bgColor[0],
                       this.config.bgColor[1],
                       this.config.bgColor[2], 1.0);
    this.gl.clearDepth(1.0);

    this.gl.enable(this.gl.DEPTH_TEST);
    this.gl.depthFunc(this.gl.LEQUAL);
    this.glResize(this.canvas.width, this.canvas.height);
};

EmbedGL.prototype.setScene = function(){
    this.gl.viewport(0, 0, this.gl.viewportWidth, this.gl.viewportHeight);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);

    mat4.identity(this.mvMatrix);
    mat4.translate(this.mvMatrix, [-this.cam.eye[0], -this.cam.eye[1], -this.cam.eye[2]], this.mvMatrix);

    mat4.multiply(this.mvMatrix, this.rotMatrix);
    
    var normalMatrix = mat3.create();
    mat4.toInverseMat3(this.mvMatrix, normalMatrix);
    mat3.transpose(normalMatrix);
    this.gl.uniformMatrix4fv(this.mvMatrixLoc, false, this.mvMatrix);
    this.gl.uniformMatrix4fv(this.pMatrixLoc, false, this.pMatrix);
    this.gl.uniformMatrix3fv(this.nMatrixLoc, false, normalMatrix);
};

EmbedGL.prototype.setAttribute = function(name, value){
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.attributes[name].buffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, value, this.gl.STREAM_DRAW);
    
};

EmbedGL.prototype.attach = function(name, buf){
    var size = /vec([1-4]+)/.exec(this.attributes[name].type)[1];
    if (buf === undefined){
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.attributes[name].buffer);
    } else {
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buf);
    }
    this.gl.vertexAttribPointer(this.attributes[name].loc, size, this.gl.FLOAT, false, 0, 0);
};

EmbedGL.prototype.setAuxBuffer = function(name, value){
    if (this.auxBuffers[name] === undefined){
        this.auxBuffers[name] = this.gl.createBuffer();
    }
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.auxBuffers[name]);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, value, this.gl.STREAM_DRAW);
};

EmbedGL.prototype.getBuffer = function(name){
    if (this.attributes[name] !== undefined){
        return this.attributes[name].buffer;
    }
    else if (this.auxBuffers[name] !== undefined){
        return this.auxBuffers[name];
    }
    alert("unknown buffer !");
    return null;
};

EmbedGL.prototype.draw = function(mode, size, elements_buf){
    if (elements_buf !== undefined){
        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, elements_buf);
        this.gl.drawElements(mode, size, this.gl.UNSIGNED_SHORT, 0);
    } else {
        this.gl.drawArrays(mode, 0, size);
    }
};

EmbedGL.prototype.setUniform = function(name, arr_or_val_1){
    var value;
    if (arr_or_val_1 instanceof Array || arr_or_val_1.byteLength !== undefined){
        value = arr_or_val_1;
    } else {
        value = Array.prototype.slice.call(arguments);
        value.splice(0, 1);
    }
    var arr = /(vec|mat|bool)([1-4]?)/.exec(this.uniforms[name].type);
    var type = arr[1];
    var size = (arr[2] === "") ? 1 : parseInt(arr[2], 10);
    if (type == "vec"){
        this.gl["uniform" + size + "fv"](this.uniforms[name].loc, value);
    } else if (type == "mat") {
        this.gl["uniformMatrix" + size + "fv"](this.uniforms[name].loc, false, value);
    } else if (type == "bool" || type == "int"){
        this.gl["uniform" + size + "i"](this.uniforms[name].loc, value);
    } else {
        alert("Unknown type");
    }
};

EmbedGL.prototype.toGLUnits = function(pt, relative){
    var horiz = this.currFovWidth;
    var vert = this.currFovHeight;
    var pos =  [
        pt[0] / this.canvas.width * horiz,
        pt[1] / this.canvas.height * vert
    ];
    if (relative){
        pos[0] -= horiz / 2;
        pos[1] -= vert / 2;
    }
    return pos;
};

EmbedGL.prototype.makeShader = function(type, filename){
    var shader = this.gl.createShader(type);
    this.gl.shaderSource(shader, Dom.ajax(filename));
    this.gl.compileShader(shader);
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {  
      alert("An error occurred compiling the shaders: " + this.gl.getShaderInfoLog(shader));  
      return null;  
    }  
    return shader;
};
