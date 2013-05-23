/*  This file is part of VSPCL
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
 * @class An OpenCL sphere
 * @constructor
 * @param {float} radius The sphere's radius
 * @param {integer} type Type of sphere(0 = normal, 1 = attrator, 2 = repulsor)
 * @param {egl} egl The drawing egl object
 * @param {vec3} center Sphere's center coordinates
 */
var Sphere = function (radius, type, egl, center){
    if (center === undefined){
        center = vec3.create(0, 0, 0);
    }
    this.radius = radius;
    this.center = center;
    this.type = type;
    this.posbuf = egl.gl.createBuffer();
    this.idxbuf = egl.gl.createBuffer();
    this.normbuf = egl.gl.createBuffer();
    
    this.setBuffers(egl);
};


// --------------------------------------------------
/**
 * @brief Create buffers for the current sphere's radius
 * @param egl Drawing egl object
 */
Sphere.prototype.setBuffers = function(egl){
    var p_and_n = this.getGLArray();
    var idx = this.getIndicesArray();
    this.len = idx.length;
    egl.gl.bindBuffer(egl.gl.ARRAY_BUFFER, this.posbuf);
    egl.gl.bufferData(egl.gl.ARRAY_BUFFER, new Float32Array(p_and_n.p), egl.gl.STREAM_DRAW);
    egl.gl.bindBuffer(egl.gl.ARRAY_BUFFER, this.normbuf);
    egl.gl.bufferData(egl.gl.ARRAY_BUFFER, new Float32Array(p_and_n.n), egl.gl.STREAM_DRAW);
    egl.gl.bindBuffer(egl.gl.ELEMENT_ARRAY_BUFFER, this.idxbuf);
    egl.gl.bufferData(egl.gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), egl.gl.STATIC_DRAW);    
};

Sphere.bands = 20;


// --------------------------------------------------
/**
 * @function Fills the list of vertices to draw the sphere
 * @return {hash} Vertices and normals arrays
 */
Sphere.prototype.getGLArray = function(){
    var verts = [];
    var perCirc = Math.sqrt(this.nbFaces);
    var scale = Math.PI * 2 / perCirc;
    var pts = [];
    var norms = [];
    
    for (var latNumber = 0; latNumber <= Sphere.bands; latNumber++) {
      var theta = latNumber * Math.PI / Sphere.bands;
      var sinTheta = Math.sin(theta);
      var cosTheta = Math.cos(theta);

      for (var longNumber = 0; longNumber <= Sphere.bands; longNumber++) {
        var phi = longNumber * 2 * Math.PI / Sphere.bands;
        var sinPhi = Math.sin(phi);
        var cosPhi = Math.cos(phi);

        var x = cosPhi * sinTheta;
        var y = cosTheta;
        var z = sinPhi * sinTheta;
        var u = 1 - (longNumber / Sphere.bands);
        var v = 1 - (latNumber / Sphere.bands);
        
        norms.push(x);
        norms.push(y);
        norms.push(z);
        pts.push(this.radius * x);
        pts.push(this.radius * y);
        pts.push(this.radius * z);
        pts.push(1);
      }
    }
    return {'p': pts, 'n' : norms};
};


// --------------------------------------------------
/**
 * @brief Creates the indices array
 * @return The array
 */
Sphere.prototype.getIndicesArray = function(){
    var indexData = [];
    for (var latNumber = 0; latNumber < Sphere.bands; latNumber++) {
      for (var longNumber = 0; longNumber < Sphere.bands; longNumber++) {
        var first = (latNumber * (Sphere.bands + 1)) + longNumber;
        var second = first + Sphere.bands + 1;
        indexData.push(first);
        indexData.push(second);
        indexData.push(first + 1);

        indexData.push(second);
        indexData.push(second + 1);
        indexData.push(first + 1);
      }
    }
    return indexData;
};


// --------------------------------------------------
/**
 * @brief Returns a typed array containing the sphere position and radius
 * @return {Float32Array} A Float32 Array
 */
Sphere.prototype.getTypedArray = function(){
    return new Float32Array([this.center[0], this.center[1], this.type, this.radius]);
};


// --------------------------------------------------
/**
 * @brief Moves the sphere along the given 2D vector
 * @param {float, float} The 2D vector
 */
Sphere.prototype.move = function(move){
    this.center[0] += move[0];
    this.center[1] += move[1];
};


// --------------------------------------------------
/**
 * @brief Grows the sphere radius given the x coord of the last move made by the user
 */
Sphere.prototype.growRadius = function(egl, move){
    this.radius += move[0];
    this.setBuffers(egl);
};


// --------------------------------------------------
/**
 * @brief Return the sphere color based on its type
 */
Sphere.prototype.getColor = function(){
    if (this.type == 0)
        return vec3.create([0.6, 0, 0.6]);
    else if (this.type == 1)
        return vec3.create([0.6, 0.6, 0]);
    else if (this.type == 2)
        return vec3.create([0, 0.6, 0.6]);
}