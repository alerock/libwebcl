/* VSPCL -- Very simple particles simulation using WebCL
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
 * From http://prideout.net/blog/?p=67
 * @brief Returns a pseudo random value
 * @param seed Seed for the pseudo random value
 * @param b Max value
 * @return A random value
 */
float randhashf(uint seed, float b)
{
    uint i=(seed^12345391)*2654435769;
    i^=(i<<6)^(i>>26);
    i*=2654435769;
    i+=(i<<5)^(i>>12);
    return (b * i)*(1.0/4294967295.0);
}


// --------------------------------------------------
/**
 * @brief Check if a particle is inside a given sphere
 * @param p The particle x and y
 * @param s The sphere center
 * @param srad Radius of the sphere
 */
bool isColliding(float2 p, float2 s, float srad) {
    return distance(p, s) <= srad;
}


// --------------------------------------------------
/**
 * @brief Return the velocity corresponding to the bounce of a particle on a sphere
 * @param s The sphere center
 * @param srad The sphere radius
 * @param p The particle x and y
 * @param v The former velocity
 * @param unitSphereWeight Weight of a sphere of radius 1
 * @param particleWeight Weight of a particle
 * @return The new velocity
 */
float2 getBouncingVelocity(float2 s, float srad, float2 p, float2 v, float unitSphereWeight, float particleWeight){
    float2 normalizedV = normalize(v);
    float2 c = s - p;
    float d = dot(normalizedV, c);
    float2 n = normalize(p - s);
    float2 vec = v + normalizedV * (d - sqrt(pow(srad, 2) - pow(length(c), 2) + pow(d, 2)));
    
    return vec - 2.0 * dot(vec, n) / (unitSphereWeight * srad + particleWeight) * unitSphereWeight * srad * n;
}


// --------------------------------------------------
/**
 * @brief Kernel which modifies the movements of particles based on physic
 * @param pos Positions of the particles
 * @param vel Velocity vectors of the particles
 * @param sph Center (x,y), type(0 = normal, 1 = attractor, 2 = repulsor) and radius of each sphere in the scene
 * @param sphSize Number of spheres in the scene
 * @param rndSeed A random value, to be used as a random generator seed
 * @param launcherPosX X coord of the disc center from where particles are launched
 * @param launcherPosY Y coord of the disc center from where particles are launched
 * @param launcherRadius Radius of the disc from where points are launched
 * @param stopLinePosY Y coord of the plane under which particles are considered as lost
 * @param elapsedTime since the last update
 * @param absorption Velocity reduction on bounce (in percent)
 * @param unitSphereWeight Weight of a unit sphere
 * @param particleWeight Weight of a particle
 * @param gravity 1 if there is an initial gravity, 0 otherwise
 * @param reset 1 if the particles position needs to be reset, 0 otherwise
 */
__kernel void particles(__global float4* pos,
                        __global float2* vel,
                        __global float4* sph,
                        float sphSize,
                        float rndSeed,
                        float launcherPosX,
                        float launcherPosY,
                        float launcherRadius,
                        float stopPlanePosY,
                        float elapsedTime,
                        float absorption,
                        float unitSphereWeight,
                        float particleWeight,
                        int   gravity,
                        int   reset)
{
    unsigned int i = get_global_id(0) * 4;
    uint seed = rndSeed * 1000 + i;
    
    float2 pt = pos[i].xy;

    if(reset || pt.y < stopPlanePosY) {

        float theta = randhashf(seed++, 6.28318530718);
        float r = randhashf(seed++, launcherRadius);
        float y = randhashf(seed++, 0.1);
        pt = (float2)(launcherPosX + r * cos(theta), launcherPosY - y);
        vel[i].xy = (float2)(0, 0);
        
        pos[i].xy = pt;
        pos[i].z = 1;
        pos[i + 1].z = 2;
        pos[i + 2].z = 3;
        pos[i + 3].z = 4;
    } else {

        // Initial gravity

        if (gravity){
            vel[i].y -= 9.81 * elapsedTime;
        }


        // Attraction and repulsion

        for (int j = 0; j < sphSize; j ++){
            float currSphereWeight = unitSphereWeight * sph[j].w;
            if (sph[j].z == 1.0){
                float2 vec = normalize(sph[j].xy - pt);
                float  n   = 9.81 / 3 * elapsedTime * (currSphereWeight * particleWeight / pow(distance(sph[j].xy, pt), 2.0));
                vel[i] += vec * n;
            }
            else if (sph[j].z == 2.0){
                float2 vec = normalize(sph[j].xy - pt);
                float  n   = 9.81 / 3 * elapsedTime * (currSphereWeight * particleWeight / pow(distance(sph[j].xy, pt), 2.0));
                vel[i] -= vec * n;
            }
        }



        // Collision check

        for (int j = 0; j < sphSize; j ++){
            float currSphereWeight = unitSphereWeight * sph[j].w;
            if (isColliding(pt + vel[i], sph[j].xy, sph[j].w)){
                vel[i].xy = getBouncingVelocity(sph[j].xy, sph[j].w, pt, vel[i], currSphereWeight, particleWeight);
                
                //vel[i].xy *= (100 - 30) / 100.0;
            }
        }

        // Setting new position

        pos[i].xy += vel[i];
    }



    pos[i + 1].xy = pos[i].xy + (float2)(0, 0.2);
    pos[i + 2].xy = pos[i].xy + (float2)(0.2, 0);
    pos[i + 3].xy = pos[i].xy + (float2)(0.2, 0.2);

    vel[i + 1] = vel[i + 2] = vel[i + 3] = vel[i].xy;
}