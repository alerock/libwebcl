/* VSPCL -- Very simple particles simulation using WebCL
    Copyright (C) 2011  Frederic Langlade-Bellone

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

#define COLOR 2

#ifdef GL_ES
precision highp float;
#endif

varying vec3 vLightWeighting;
varying vec2 vPtVelocity;
uniform bool uIsPoint;
uniform bool uIsSelected;
uniform vec3 uSphColor;
uniform vec3 uParticlesColor;
varying vec2 vTexCoords;

void main(void) {
   if (uIsPoint){
      float velL = length(vPtVelocity.xy) * 3.;
      vec3 appliedColor;
      appliedColor = uParticlesColor;
      appliedColor.x += (1. - appliedColor.x) * min(1.0, velL);
      appliedColor.y += (1. - appliedColor.y) * min(1.0, velL);
      appliedColor.z += (1. - appliedColor.z) * min(1.0, velL);
    
      
      gl_FragColor = vec4(appliedColor, 1.0);
      gl_FragColor.xyz *= (1. - length(vTexCoords));
   }
   else {
      if (uIsSelected){
        gl_FragColor = vec4(uSphColor, 1.);
      } else {
        gl_FragColor = vec4(uSphColor, 1.) * vec4(vLightWeighting, 1.0);
      }
      
   }
}