/*  VSPCL -- Very simple particles simulation using WebCL
    Copyright (C) 2011  Frédéric Langlade-Bellone

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/> */
   

// --------------------------------------------------
/**
 * @class Main class for the particle system
 * @constructor
 * @param {String} canvas_id Id of the dom canvas
 * @param {Hash} config Default configuration of this particles system
 */
var ParticlesSystem = function(canvas_id, config){
    this.positionbufcl = undefined;
    this.velocitybufcl = undefined;
    this.spherebufcl = undefined;
    this.cl = undefined;
    this.queue = undefined;
    this.spheres = [];
    this.selected = undefined;
    this.nbParticles = config.nbParticles;
    this.gravity = true;
    this.paused = true;
    this.reset = true;
    var self = this;
    this.config = config;
    this.egl = new EmbedGL(canvas_id, {
        vertShader : "programs/shader.vert",
        fragShader : "programs/shader.frag",
        attributes : {
            "aVertPosition" : "vec4",
            "aVertNormal" : "vec3",
            "aVelocity" : "vec2",
        },
        uniforms : {
            "uPMatrix" : "projection",
            "uMvMatrix" : "modelview",
            "uNMatrix" : "normal",
            "uIsPoint" : "bool",
            "uSphPos" : "vec3",
            "uSphColor" : "vec3",
            "uIsSelected" : "bool",
            "uLightPos" : "vec3",
            "uParticlesColor" : "vec3"
        },
        clickEvt : function(e, pos){    
            var s = self.sphereAt(pos);
            if (s === undefined && self.spheres.length < self.config.maxSpheres){
                self.addSphere(pos[0], pos[1], .7, self.config.getSphereType());
                self.selected = s;
            } else {
                self.selected = s;
            }
        },
        moveEvt : function(e, clicked, move){
            move[1] *= -1;
            if (clicked && self.selected !== undefined){
                self.selected.move(move);
                self.updateSpheresPos();
            }
        },
        pressedK9 : function(){
            if (self.selected !== undefined){
                self.removeSphere(self.selected);
            }
        },
        altMoveEvt: function(e, move){
            if (self.selected !== undefined){
                self.selected.growRadius(self.egl, move);
                self.updateSpheresPos();
            }
        },
        bgColor : this.config.backgroundColor,
        eyePos : this.config.startingEyePos,
        fps : 60,
        enableRotations : false,
        enableMoves : true,
        fovWidth : 15,
        near : 0.1,
        far: 100,
        zoomReduction : 0.6
    });
    //this.egl.gl.blendFunc(this.egl.gl.SRC_ALPHA, this.egl.gl.DST_ALPHA);
    //this.egl.gl.enable(this.egl.gl.BLEND);
    //this.egl.gl.disable(this.egl.gl.DEPTH_TEST);
    this._initBuffers();
    this._initCL();
};


// --------------------------------------------------
/**
 * @brief Init the CL part of the demo, by getting context, compiling the program and creating buffers
 */
ParticlesSystem.prototype._initCL = function() {
    this.cl = window.webCL;
    if (this.cl === undefined){
        alert("You need WebCL to run this demo. Please download the corresponding Firefox binaries at gfx.parapluie.org");
    }
    var platforms = this.cl.getPlatforms();
    var devices = platforms[0].getDevices(this.cl.CL_DEVICE_TYPE_ALL);
    var context = this.cl.createContext(devices, platforms[0], this.egl.gl);
    var prog_src = Dom.ajax("programs/particles.cl");
    var program = context.createProgramWithSource(prog_src);
    try{
        program.buildProgram(devices[0], "");
    }
    catch(buildError){
        alert(program.getProgramBuildInfo(devices[0], this.cl.CL_PROGRAM_BUILD_LOG));
    }
    this.kernel = program.createKernel("particles");
    try {
        this.localMax = devices[0].getDeviceInfo(this.cl.CL_DEVICE_MAX_WORK_ITEM_SIZES)[0];
        if (this.nbParticles < this.localMax){
            this.localMax = this.nbParticles;
        }
    }
    catch(workgroupError) {
        alert("Could not determine workgroup size");
    }
    this.positionbufcl = context.createBufferFromGL(this.cl.MEM_READ_WRITE, this.egl.getBuffer("aVertPosition"));
    this.velocitybufcl = context.createBufferFromGL(this.cl.MEM_READ_WRITE, this.egl.getBuffer("aVelocity"));
    this.spherebufcl = context.createBuffer(this.cl.MEM_READ_ONLY, 32 * this.config.maxSpheres);
    this.kernel.setMemArg(0, this.positionbufcl);
    this.kernel.setMemArg(1, this.velocitybufcl);
    this.kernel.setMemArg(2, this.spherebufcl);
    this.queue = context.createCommandQueue(devices[0], 0);
    this.queue.enqueueWriteBuffer(this.spherebufcl, false, 0, 0, new Float32Array([]), null);
};


// --------------------------------------------------
/**
 * @brief Starts the execution of the particles system
 */
ParticlesSystem.prototype.run = function(){
    var buf = new Float32Array(this.nbParticles);
    var self = this;
    var seed = Math.random();
    var lastTime = window.mozAnimationStartTime;
    var loop = function(timestamp){
        if (!self.paused || self.reset){
            with(self.kernel){
                setScalarArg(3, self.spheres.length, 8);
                setScalarArg(4, seed, 8);
                setScalarArg(5, self.config.launcherPos[0], 8);
                setScalarArg(6, self.config.launcherPos[1], 8);
                setScalarArg(7, self.config.launcherRadius, 8);
                setScalarArg(8, self.config.stopPlaneY, 8);
                setScalarArg(9, (timestamp - lastTime) / 75000., 8);
                setScalarArg(10, self.config.absorption, 8);
                setScalarArg(11, self.config.unitSphereWeight, 8);
                setScalarArg(12, self.config.particleWeight, 8);
                setScalarArg(13, self.gravity, 8);
                setScalarArg(14, self.reset, 8);                
            }
            self.reset = false;
            
            with(self.queue){
                enqueueAcquireGLObjects(self.positionbufcl, null, false);
                enqueueAcquireGLObjects(self.velocitybufcl, null, false);
                enqueueNDRangeKernel(self.kernel, 1, 0, self.nbParticles, null);
                enqueueReleaseGLObjects(self.positionbufcl, null, false);
                enqueueReleaseGLObjects(self.velocitybufcl, null, false);
                finish(); 
            }
        }
    
        lastTime = timestamp;
        self._drawScene();

        seed += 1;
        window.mozRequestAnimationFrame(loop);
        //setTimeout(loop, 1000/self.config.fps);
    };
    window.mozRequestAnimationFrame(loop);
    //loop();
};


// --------------------------------------------------
/**
 * @brief Add a new sphere to the system
 * @param {float} x X coord of the sphere
 * @param {float} y Y coord of the sphere
 * @param {float} r Radius of the sphere
 * @return The corresponding object
 */
ParticlesSystem.prototype.addSphere = function(x, y, r, type) {
    var s = new Sphere(r, type, this.egl, vec3.create([x, y, 0]));
    this.spheres.push(s);
    var arr = s.getTypedArray();
    this.queue.enqueueWriteBuffer(this.spherebufcl, false, (this.spheres.length - 1) * 4 * 4, arr.byteLength, arr, null);
    return s;
};


// --------------------------------------------------
/**
 * @brief Remove a sphere from the system
 * @param {Sphere} s The sphere to remove
 */
ParticlesSystem.prototype.removeSphere = function(s) {
    var self = this;
    for (var i = 0; i < this.spheres.length; i ++){
        if (this.spheres[i] == s){
            this.spheres.splice(i, 1);
            this.updateSpheresPos();
            return;
        }
    }

};


// --------------------------------------------------
/**
 * @brief Rewrites the CL buffer containing the spheres positions
 */
ParticlesSystem.prototype.updateSpheresPos = function(){
    for (var i = 0; i < this.spheres.length; i ++){
        var tarr = this.spheres[i].getTypedArray();
        this.queue.enqueueWriteBuffer(this.spherebufcl, false, i * 4 * 4, tarr.byteLength, tarr, null);
    }  
};


// --------------------------------------------------
/**
 * @brief Initializes the GL buffers
 */
ParticlesSystem.prototype._initBuffers = function() {
    var l1 = [];
    var ln = [];
    var lidx = [];
    for (var i = 0; i < this.nbParticles * 4; i++) {
        l1.push(0, 0, 0, 1);
        
        ln.push(0, 0, 0);
            lidx.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4 + 2, i * 4 + 1, i * 4 + 3);

    }
    this.egl.setAttribute("aVertPosition", new Float32Array(l1));
    this.egl.setAttribute("aVertNormal", new Float32Array(ln));
    this.egl.setAttribute("aVelocity", new Float32Array(l1));
    
    this.particlesIdx = this.egl.gl.createBuffer();
    this.egl.gl.bindBuffer(this.egl.gl.ELEMENT_ARRAY_BUFFER, this.particlesIdx);
    this.egl.gl.bufferData(this.egl.gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(lidx), this.egl.gl.STATIC_DRAW);   
};


// --------------------------------------------------
/**
 * @brief Draws the current state of the system
 */
ParticlesSystem.prototype._drawScene = function(){
    with(this.egl){
        setScene();
        attach("aVertPosition");
        attach("aVertNormal");
        attach("aVelocity");
        setUniform("uIsPoint", 1);
        setUniform("uSphPos", [0, 0, 0]);
        setUniform("uIsSelected", 0);
        setUniform("uParticlesColor", this.config.particlesColor);
        setUniform("uLightPos", this.config.lightPosition);
        draw(gl.TRIANGLES, this.nbParticles * 6, this.particlesIdx);
    
        for (var i = 0; i < this.spheres.length; i ++){
            setUniform("uIsPoint", 0);
            setUniform("uSphColor", this.spheres[i].getColor());
            setUniform("uSphPos", this.spheres[i].center);
            setUniform("uIsSelected", (this.selected == this.spheres[i]) ? 1 : 0);
            attach("aVertPosition", this.spheres[i].posbuf);
            attach("aVertNormal", this.spheres[i].normbuf);
            draw(gl.TRIANGLES, this.spheres[i].len, this.spheres[i].idxbuf);
        }
    }
    
    this.config.infoPanel.nbParticles.innerHTML = this.nbParticles;
    this.config.infoPanel.nbSpheres.innerHTML = this.spheres.length;
    this.config.infoPanel.maxSpheres.innerHTML = this.config.maxSpheres;
};


// --------------------------------------------------
/**
 * @brief Returns the sphere that can be found at a certain position
 * @param {float, float} pos The position
 * @return The corresponding object or undefined if nothing was found
 */
ParticlesSystem.prototype.sphereAt = function(pos){
    for (var i = 0; i < this.spheres.length; i ++){
        if (dist2(pos, this.spheres[i].center) <= this.spheres[i].radius){
            return this.spheres[i];
        }
    }
    return undefined;
};


// --------------------------------------------------
/**
 * @brief Save the current scene in the local storage based on a hash key
 * @param {name} Key in the local storage
 */
ParticlesSystem.prototype.saveCurrentState = function(name){
    if (name != "" && (localStorage[name] === null || confirm(name + " already exists. Overwrite ?"))){
        var saveObj = {spheres : []};
        
        for (var i = 0; i < this.spheres.length; ++ i){
            saveObj.spheres.push({
                centerX : this.spheres[i].center[0],
                centerY : this.spheres[i].center[1],
                radius : this.spheres[i].radius,
                type   : this.spheres[i].type
            });
        }
        if (name === "?"){
            console.log(JSON.stringify(saveObj));
        } else {
            localStorage[name] = JSON.stringify(saveObj);
        }
        
    }
};


// --------------------------------------------------
/**
 * @brief Load a scene in the local storage based on a hash key
 * @param {name} Key in the local storage
 */
ParticlesSystem.prototype.loadState = function(name){
    if (name !== null){
        var saveObj;
        if (name.charAt(0) === "?"){
            saveObj = JSON.parse(name.substr(1, name.length - 1));
        } else if (localStorage[name] !== null){
            saveObj = JSON.parse(localStorage[name]);
        } else {
            alert("Unknown scene");
            return;
        }
        this.spheres = [];
        this.updateSpheresPos();
        for (var i = 0; i < saveObj.spheres.length; ++ i){
            this.addSphere(saveObj.spheres[i].centerX, saveObj.spheres[i].centerY, saveObj.spheres[i].radius, saveObj.spheres[i].type);
        } 
        this.reset = true;
        this.pause = true;
    }
};