
/*  VSPCL -- Very simple particles simulation using WebCL
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
    along with this program.  If not, see <http://www.gnu.org/licenses/>
*/

uniform   mat4 uPMatrix;
uniform   mat4 uMvMatrix;
uniform   mat3 uNMatrix;

attribute vec4 aVertPosition;
attribute vec3 aVertNormal;
attribute vec2 aVelocity;
uniform   bool uIsPoint;
uniform   vec3 uSphPos;
uniform   vec3 uLightPos;
uniform   bool uIsSelected;
varying   vec3 vLightWeighting;
varying   vec2 vPtVelocity;
varying   vec2 vTexCoords;


void main(void) {
  vec4 pos = aVertPosition + vec4(uSphPos, 0.0);
  vec4 mvPosition = uMvMatrix * pos;
  gl_Position = uPMatrix * mvPosition;
  vLightWeighting = aVertNormal;
  if (uIsPoint) {
      if (aVertPosition.z < 1.1){
          vTexCoords = vec2(-1, -1);
      } else if (aVertPosition.z < 2.1){
          vTexCoords = vec2(-1, 1);
      } else if (aVertPosition.z < 3.1){
          vTexCoords = vec2(1, -1);    
      } else {
          vTexCoords = vec2(1, 1);
      }
      gl_Position.z = 0.;
      vPtVelocity = aVelocity;
  } else {
      vec4 lightPos = uMvMatrix * vec4(uLightPos, 1.0);
      float dirLightWeight = max(dot(uNMatrix * aVertNormal, normalize(lightPos.xyz - mvPosition.xyz)), 0.0);
      vLightWeighting += vec3(0.2, 0.0, 0.2) + vec3(1.0, 1.0, 1.0) * dirLightWeight * 5.;
  }
}