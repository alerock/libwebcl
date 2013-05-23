function Cheese(canvasId,options){

  function avg(v){
    s = 0.0;
    for(var i=0; i<v.length; i++)
      s += v[i];
    return s/v.length;
  }

  if(!options)
    options = {};

  settings = {
    dt:1/60,
    idleFunc:function(){},
    clsuccess:function(){},
    clerror:function(){},
    canvasError:function(){},
    success:function(){}
  };

  $.extend(settings,options);

  var th = this;
  var canvas = document.getElementById(canvasId);
  var w = th.w = canvas.width;
  var h = th.h = canvas.height;
  var clstepper = this.clstepper = null;
  try {
    this.clstepper = new WebCLStepper();
    settings.clsuccess();
  } catch(e) {
    if(e=="noWebCLsupport")
      settings.clerror();
  }

  this.XMIN = 0.0;
  this.YMIN = 0.0;
  this.XMAX = w;
  this.YMAX = h;

  this.numSprings = 0;

  this.mouseDown = false;
  this.pickedNode = -1;

  $(canvas).bind({
      'mousedown':function(event){
        th.mouseDown = true;
        var pos = eventPosition(event);
	th.pickedNode = th.getClosestNode(pos.x,pos.y);
	if(th.pickedNode>0)
	  th.stat[th.pickedNode] = 1;
      },
      'mouseup':function(event){
	th.mouseDown = false;
	th.stat[th.pickedNode] = 0;
	th.pickedNode = -1;
      },
      'mousemove':function(event){
	if(!th.mouseDown || th.pickedNode<0)
	  return;
	var pos = eventPosition(event);
	th.x[th.pickedNode] = pos.x;
	th.y[th.pickedNode] = pos.y;
      }
    });
  $.extend(settings,options);

  var nstats = this.nstats = 50;
  var springstats = this.springstats = new Float32Array(nstats);
  var stepstats =   this.stepstats = new Float32Array(nstats);
  var drawstats =   this.drawstats = new Float32Array(nstats);
  var t = this.t = 0;
  var dt = this.dt = settings.dt;
  var r =  this.r =    [];
  var x =  this.x =    [];
  var y =  this.y =    [];
  var vx = this.vx =   [];
  var vy = this.vy =   [];
  var fx = this.fx =   [];
  var fy = this.fy =   [];
  var drawSprings_i = this.drawSprings_i = [];
  var drawSprings_j = this.drawSprings_j = [];
  var conn = this.conn = []; // 2D matrix, particle i is connected to conn[i*maxconn+j] (j=0,1,2,...,maxconn-1)
  var maxconn = this.maxconn = 10;
  var L = this.L =       []; // Same form as conn but contains spring rest lengths
  var invmass = this.invmass = [];   // inverse mass. Set = 0 for static
  var stat = this.stat = []; // Static particles
  var ctx = this.ctx = canvas.getContext('2d');
  if(!this.ctx){
    settings.canvasError();
    return false;
  }
  ctx.globalCompositeOperation = 'destination-over';
  ctx.fillStyle = 'rgba(1,1,1,1)';
  ctx.strokeStyle = 'rgba(0,0,0,1)';

  $("#log").append("# total\tphysics\tdraw\tsprings\n");
  setInterval(function(){
      var springs = parseInt(100*avg(springstats))/100;
      var phys = parseInt(100*avg(stepstats))/100;
      var draw = parseInt(100*avg(drawstats))/100;
      var total = parseInt(100*(phys+draw))/100;
      $("#totalStep").html(total + " ms");
      $("#numSprings").html(""+springs);
      $("#physicsStep").html(phys + " ms");
      $("#drawStep").html(draw + " ms");
      $("#log").append(total+"\t"+ phys + "\t" + draw + "\t" + th.numSprings + "\n");
    },1000);

  function animate(){
    requestAnimFrame( animate );
      if(th.x.length){
	var t0 = new Date().getTime();
	draw(th.DRAW_NODES,
	     th.DRAW_SPRINGS,
	     true);
	var t1 = new Date().getTime();
	step();
	th.t++;
	var t2 = new Date().getTime();
	th.stepstats[th.t%th.nstats] = t2-t1;
	th.springstats[th.t%th.nstats] = th.numSprings;
	th.drawstats[th.t%th.nstats] = t1-t0;
      }
      settings.idleFunc();
  }

  animate();

  function eventPosition(e){
    // Should adjust 
    var mouseX, mouseY;
    if(e.offsetX){
      mouseX = e.offsetX;
      mouseY = e.offsetY;
    } else if(e.layerX) {
      mouseX = e.layerX;
      mouseY = e.layerY;
    }
    return {
      x: mouseX,
      y: mouseY
      };
  }

  function step(){
    if(th.WEBCL && th.clstepper){
      var out = {
	x:th.x,
	y:th.y,
	vx:th.vx,
	vy:th.vy
      };
      th.clstepper.step({
	  x:th.x,
	  y:th.y,
	  N:th.x.length,
	  vx:th.vx,
	  vy:th.vy,
	  maxconn:th.maxconn,
	  dt:settings.dt,
	  conn:th.conn,
	  L:th.L,
	  invmass:th.invmass,
	  stat:th.stat,
	  KS:th.KS,
	  KD:th.KD,
	  XMIN:th.XMIN,
	  XMAX:th.XMAX,
	  YMIN:th.YMIN,
	  YMAX:th.YMAX,
	  G:th.G[1]
	},out);

    } else {

      // Reset force
      for(var i=0; i<th.x.length; i++){
	th.fx[i] = 0.0;
	th.fy[i] = 0.0;
      }

      // Gravity
      for(var i=0; i<th.x.length; i++){
	th.fx[i] += (1/th.invmass[i])*th.G[0];
	th.fy[i] += (1/th.invmass[i])*th.G[1];
      }

      var lp = [th.x,th.y];
      var lmax = [th.XMAX,
		  th.YMAX];
      var lmin = [th.XMIN,
		  th.YMIN];
      var lv = [th.vx,th.vy];
    
      // Move inside box
      for(var i=0; i<th.x.length; i++){
	for(var l=0; l<lp.length; l++){
	  if(lp[l][i]>=lmax[l]){
	    lp[l][i] = lmax[l];
	    lv[l][i] = -lv[l][i];
	  }
	  if(lp[l][i]<lmin[l]){
	    lp[l][i] = lmin[l];
	    lv[l][i] = -lv[l][i];
	  }
	}
      }

      // Calculate all spring forces
      for(var i=0; i<th.x.length; i++){
	for(var j=0; j<th.maxconn; j++){
	  var from = i;
	  var to =   th.conn[i*th.maxconn+j];
	  var len =  th.L[i*th.maxconn+j];
	  if(from>to && from!=-1 && to!=-1 && from!=to){
	    var rx = th.x[to]-th.x[from]; // Rel postition
	    var ry = th.y[to]-th.y[from];
	    var ux = th.vx[to]-th.vx[from]; // rel. velocity
	    var uy = th.vy[to]-th.vy[from];
	    var nr = Math.sqrt(rx*rx + ry*ry);
	    if(nr>0.0){
	      var lf = [th.fx,th.fy];
	      var lr = [rx,ry];
	      var lu = [ux,uy];
	      for(var l = 0; l<lp.length; l++){
		lf[l][from] += (th.KS*(nr-len)+th.KD*lu[l]*lr[l]/nr)*lr[l]/nr;
		lf[l][to]   -= (th.KS*(nr-len)+th.KD*lu[l]*lr[l]/nr)*lr[l]/nr;
	      }
	    }
	  }
	}
      }

      for(var i=0; i<th.x.length; i++){
	if(i!=th.pickedNode){
	  // Euler step
	  th.vx[i] += th.fx[i]*th.dt*th.invmass[i];
	  th.vy[i] += th.fy[i]*th.dt*th.invmass[i];
	  // Note: using new velocity
	  th.x[i] += th.vx[i]*th.dt;
	  th.y[i] += th.vy[i]*th.dt;
	}
      }
    }
  }

  function draw(nodes,springs){
    if(nodes==undefined)
      nodes = true;
    if(springs==undefined)
      springs = true;

    ctx.clearRect(0,0,th.w,th.h);

    // Draw nodes
    if(nodes)
      for(var i=0; i<th.x.length; i++)
	drawNode(ctx, th.x[i], th.y[i], th.r[i]);

    // Draw springs
    if(springs){
      ctx.beginPath();
      for(var i=0; i<th.drawSprings_i.length; i++){
	ctx.moveTo(th.x[th.drawSprings_i[i]],th.y[th.drawSprings_i[i]]);
	ctx.lineTo(th.x[th.drawSprings_j[i]],th.y[th.drawSprings_j[i]]);
      }
      ctx.stroke();
    }

    // Draw AABB
    //drawRect(ctx,th.XMIN,th.YMIN,th.XMAX,th.YMAX);
  }

  function drawRect(ctx,x,y,w,h){
    ctx.strokeRect(x,y,w,h);
  }

  function drawNode(ctx,x,y,r){
    ctx.beginPath();
    ctx.arc(x,y,r,0,Math.PI*2,true); 
    ctx.stroke();
  }

  function drawSpring(ctx,x1,y1,x2,y2){
    ctx.beginPath();
    ctx.moveTo(x1,y1);
    ctx.lineTo(x2,y2);
    ctx.stroke();
  }

  settings.success();
}

Cheese.prototype.KS =                 200;            // Spring constant
Cheese.prototype.KD =                 0.9;            // Damping
Cheese.prototype.R =                  0.1;            // Node radius
Cheese.prototype.DT =                 0.01;           // Timestep
Cheese.prototype.G =                  [0,9.82,0];     // Gravity
Cheese.prototype.WEBCL =              false;           // Toggle WebCL
Cheese.prototype.DRAW_SPRINGS =       true;
Cheese.prototype.DRAW_NODES =         false;
Cheese.prototype.XMIN =               0;              // Window size
Cheese.prototype.XMAX =               10;
Cheese.prototype.YMIN =               -10;
Cheese.prototype.YMAX =               5;

// Clear the contents (cheeses)
Cheese.prototype.clear = function(){
  this.r =    [];
  this.x =    [];
  this.y =    [];
  this.vx =   [];
  this.vy =   [];
  this.fx =   [];
  this.fy =   [];
  this.drawSprings_i = [];
  this.drawSprings_j = [];
  this.conn = []; // 2D matrix, particle i is connected to conn[i*maxconn+j] (j=0,1,2,...,maxconn-1)
  this.maxconn = 10;
  this.L =       []; // Same form as conn but contains spring rest lengths
  this.invmass = [];   // inverse mass. Set = 0 for static
};

Cheese.prototype.addNode = function(x,y,options){
  if(!options)
    options = {};
  $.extend(options,{
      x:x,
	y:y,
	vx:0.0,
	vy:0.0,
	invMass:1,
	r:5.0,
	stat:0
	});
  var newx = new Float32Array(this.x.length+1);
  var newy = new Float32Array(this.x.length+1);
  var newvx = new Float32Array(this.x.length+1);
  var newvy = new Float32Array(this.x.length+1);
  var newim = new Float32Array(this.x.length+1);
  var newstat = new Float32Array(this.x.length+1);
  var newr = new Float32Array(this.x.length+1);
  for(var i=0; i<this.x.length; i++){
    newx[i] = this.x[i];
    newy[i] = this.y[i];
    newvx[i] = this.vx[i];
    newvy[i] = this.vy[i];
    newim[i] = this.invmass[i];
    newstat[i] = this.stat[i];
    newr[i] = this.r[i];
  }
  newx[this.x.length] = options.x;
  newy[this.x.length] = options.y;
  newvx[this.x.length] = options.vx;
  newvy[this.x.length] = options.vy;
  newim[this.x.length] = options.invMass;
  newstat[this.x.length] = options.stat;
  newr[this.x.length] = options.r;
  this.x = newx;
  this.y = newy;
  this.vx = newvx;
  this.vy = newvy;
  this.invmass = newim;
  this.stat = newstat;
  this.r = newr;

  var i = this.x.length-1;

  // Add empty connections
  var newconn = new Int32Array(this.x.length*this.maxconn);
  var newL =    new Float32Array(this.x.length*this.maxconn);
  for(var j=0; j<this.conn.length; j++){
    newconn[j] = this.conn[j];
    newL[j] = this.L[j];
  }
  for(var j=this.conn.length; j<this.x.length*this.maxconn; j++){
    newconn[j] = -1;
    newL[j] = 1;
  }
  this.conn = newconn;
  this.L = newL;

  return i;
};

Cheese.prototype.addSpring = function(i,j,options){
  if(!options)
    options = {};
  var settings = {
      draw:true,
      len:'auto'
  };
  $.extend(settings,options);

  var leng;
  if(settings.len == 'auto'){
    leng = Math.sqrt(Math.pow(this.x[i]-this.x[j],2) + 
		     Math.pow(this.y[i]-this.y[j],2));
  } else
    leng = settings.len;

  for(var k=0; k<this.maxconn; k++){
    if(this.conn[i*this.maxconn+k]==-1){
      this.conn[i*this.maxconn+k] = j;
      this.L[i*this.maxconn+k] = leng;
      break;
    }
  }

  for(var k=0; k<this.maxconn; k++){
    if(this.conn[j*this.maxconn+k]==-1){
      this.conn[j*this.maxconn+k] = i;
      this.L[j*this.maxconn+k] = leng;
      break;
    }
  }

  if(settings.draw){
    this.drawSprings_i.push(i);
    this.drawSprings_j.push(j);
  }
};

Cheese.prototype.standardScene = function(nr,nc,l,drawAllSprings){
  this.numSprings = 0;
  nc = nc||20;
  nr = nr||20;
  l = l||20;
  drawAllSprings = drawAllSprings==undefined?true:false;
  var offsetx = (this.w - l*nc)*0.5,
  offsety = (this.h - l*nr)*0.5;
  
  // Definiera positioner och hastigheter av partiklar i T=1
  var idx = []; // Save indices
  for(var i=0; i<nr*nc; i++)
    idx.push(-1);
  for(var r=0; r<nr; r++){
    for(var c=0; c<nc; c++){
      idx[r*nc+c] = this.addNode(offsetx+c*(l+1), offsety+r*l);
    }
  }

  // Horizontal
  for(var r=0; r<nr; r++)
    for(var c=0; c<(nc-1); c++){
      this.addSpring(idx[r*nc + c], idx[r*nc+(c+1)], {len:l,draw:drawAllSprings||r==0||r==nr-1});
      this.numSprings++;
    }

  // Vertical springs
  for(var r=0; r<nr-1; r++)
    for(var c=0; c<nc; c++){
      this.addSpring(idx[r*nc+c], idx[(r+1)*nc+c], {len:l,draw:drawAllSprings||c==0||c==nc-1});
      this.numSprings++;
    }

  // Diagonal down right
  for(var r=0; r<nr-1; r++)
    for(var c=0; c<nc-1; c++){
      this.addSpring(idx[r*nc+c], idx[(r+1)*nc+(c+1)], {len:l*Math.sqrt(2),draw:false});
      this.numSprings++;
    }

  // diagonal down left
  for(var r=0; r<nr-1; r++)
    for(var c=0; c<nc-1; c++){
      this.addSpring(idx[r*nc+(c+1)], idx[(r+1)*nc+c], {len:l*Math.sqrt(2),draw:false});
      this.numSprings++;
    }

};

Cheese.prototype.getClosestNode = function(x,y){
  var min_dist = 20,
  min_point = -1,
  num = this.x.length,
  dist, i, j;
  
  for(i = 0; i < num; i++){
    dist = Math.sqrt(Math.pow(x-this.x[i],2) + Math.pow(y-this.y[i],2));
    
    if (dist < min_dist){
      min_dist = dist;
      min_point = i;
    }
  }
  return min_point;
};

Cheese.prototype.setAllMasses = function(m){
  var im = 1/m;
  for(var i=0; i<this.invmass.length; i++)
    this.invmass[i] = im;
};

function WebCLStepper(){
  // Check WebCL support
  if(window.WebCL == undefined){
    throw "noWebCLsupport";
    return false;
  }

  // WebCL kernel
  var kernelSrc = ("__kernel void stepFunc("+

		   // Position, length N
		   "__global float* X, \n"+ // Input
		   "__global float* Y, \n"+
		   "__global float* oX, \n"+ // Output
		   "__global float* oY, \n"+

		   // Velocity, length N
		   "__global float* Vx, \n"+
		   "__global float* Vy, \n"+
		   "__global float* oVx, \n"+
		   "__global float* oVy, \n"+

		   // length N
		   "__global float* invMass, \n"+

		   // length N
		   "__global float* stat, \n"+
		   
		   // Connection matrix, length N*maxconn
		   "__global int* conn, \n"+

		   // Other vars
		   "int N, __global float* L, int maxconn, float dt, float K, float KD, \n"+
		   "float XMIN, float XMAX, float YMIN, float YMAX, float G){\n"+

		   // 2D Thread ID
		   "  int i = get_global_id(0);\n"+
		   "  if(i<N && i>=0){\n"+

		   // Move inside box
		   "  if(X[i]>=XMAX){\n"+
		   "    X[i] = XMAX;\n"+
		   "    Vx[i] = -Vx[i];\n"+
		   "  }\n"+
		   "  if(X[i]<XMIN){\n"+
		   "    X[i] = XMIN;\n"+
		   "    Vx[i] = -Vx[i];\n"+
		   "  }\n"+
		   "  if(Y[i]>=YMAX){\n"+
		   "    Y[i] = YMAX;\n"+
		   "    Vy[i] = -Vy[i];\n"+
		   "  }\n"+
		   "  if(Y[i]<YMIN){\n"+
		   "    Y[i] = YMIN;\n"+
		   "    Vy[i] = -Vy[i];\n"+
		   "  }\n"+

		   "    float fx=0.0, fy=G;\n"+
		   // Add up forces
		   "    if(true){\n"+
		   "      for(int c=0; c<maxconn; c++){\n"+
		   "        int j = conn[maxconn*i+c];\n"+ // Connected index
		   "        float l = L[maxconn*i+c];"+
		   "        if(i!=j && j>=0 && j<N){\n"+
		   "          float rx = X[j]-X[i];\n"+ // Rel postition
		   "          float ry = Y[j]-Y[i];\n"+
		   "          float ux = Vx[j]-Vx[i];\n"+ // rel. velocity
		   "          float uy = Vy[j]-Vy[i];\n"+
		   "          float nr = sqrt(rx*rx + ry*ry);\n"+
		   "          if(nr>0.000001){\n"+
		   "            fx += (K*(nr-l)+KD*ux*rx/nr)*rx/nr;\n"+ // (nr-L)*[rnormx, rnormy, rnormz]
		   "            fy += (K*(nr-l)+KD*uy*ry/nr)*ry/nr;\n"+
		   "          }\n"+
		   "        }\n"+
		   "      }\n"+

		   // Euler step
		   "      if(stat[i]==0){\n"+
		   "        float vx = Vx[i] + fx*dt*invMass[i]; oVx[i] = vx;\n"+
		   "        float vy = Vy[i] + fy*dt*invMass[i]; oVy[i] = vy;\n"+
		   "        oX[i] = X[i] + vx*dt;\n"+
		   "        oY[i] = Y[i] + vy*dt;\n"+
		   "      } else {\n"+
		   "        oVx[i]=0.0;\n"+
		   "        oVy[i]=0.0;\n"+
		   "        oX[i] = X[i];\n"+
		   "        oY[i] = Y[i];\n"+
		   "      }\n"+

		   "    } else {\n"+

		   "      oVx[i]=Vx[i];\n"+
		   "      oVy[i]=Vy[i];\n"+
		   "      oX[i] = X[i];\n"+
		   "      oY[i] = Y[i];\n"+

		   "    }\n"+
		   "  }\n"+
		   "}");
  
  // Setup WebCL context using default device on first platform
  var platforms = WebCL.getPlatformIDs();
  var ctx = null;
  var i = 0;
  while(ctx==null && i<10){
    try {
      ctx = WebCL.createContextFromType([WebCL.CL_CONTEXT_PLATFORM, platforms[0]],
					WebCL.CL_DEVICE_TYPE_DEFAULT);
    } catch(e){ }
    i++;
  }
  if(ctx==null)
    alert("Could not create a WebCL context. Try reloading the page, or restarting your browser.");
  this.ctx = ctx;

  // Create and build program for the first device
  var program = ctx.createProgramWithSource(kernelSrc);
  var devices = ctx.getContextInfo(WebCL.CL_CONTEXT_DEVICES);

  try {
    program.buildProgram ([devices[0]], "");
  } catch(e) {
    alert ("Failed to build WebCL program. Error "
	   + program.getProgramBuildInfo (devices[0], 
					  WebCL.CL_PROGRAM_BUILD_STATUS)
	   + ":  " 
	   + program.getProgramBuildInfo (devices[0], 
					  WebCL.CL_PROGRAM_BUILD_LOG));
    throw e;
  }

  // Create kernel and set arguments
  this.kernel = program.createKernel("stepFunc");

  // Create command queue using the first available device
  this.cmdQueue = this.ctx.createCommandQueue(devices[0], 0);

  this.sizeOfFloat = 4;
  this.utils = WebCL.getUtils();
}

WebCLStepper.prototype.step = function(inn,out){
  if(this.N != inn.x.length){
    this.N = inn.x.length;
    this.bufSize = this.N*this.sizeOfFloat;

    // Init ND-range
    this.localWS = [8];
    this.globalWS = [parseInt(Math.ceil((this.N) / this.localWS[0])*this.localWS[0])];

    // Reserve buffers
    this.bufInX =       this.ctx.createBuffer(WebCL.CL_MEM_READ_ONLY,  this.bufSize);
    this.bufInY =       this.ctx.createBuffer(WebCL.CL_MEM_READ_ONLY,  this.bufSize);
    this.bufInVx =      this.ctx.createBuffer(WebCL.CL_MEM_READ_ONLY,  this.bufSize);
    this.bufInVy =      this.ctx.createBuffer(WebCL.CL_MEM_READ_ONLY,  this.bufSize);
  
    this.bufInInvMass = this.ctx.createBuffer(WebCL.CL_MEM_READ_ONLY,  this.bufSize);
    this.bufInStat =    this.ctx.createBuffer(WebCL.CL_MEM_READ_ONLY,  this.bufSize);
    this.bufInConn =    this.ctx.createBuffer(WebCL.CL_MEM_READ_ONLY,  this.bufSize*inn.maxconn);
    this.bufInL =       this.ctx.createBuffer(WebCL.CL_MEM_READ_ONLY,  this.bufSize*inn.maxconn);
  
    this.bufOutX =      this.ctx.createBuffer(WebCL.CL_MEM_WRITE_ONLY, this.bufSize);
    this.bufOutY =      this.ctx.createBuffer(WebCL.CL_MEM_WRITE_ONLY, this.bufSize);
    this.bufOutVx =     this.ctx.createBuffer(WebCL.CL_MEM_WRITE_ONLY, this.bufSize);
    this.bufOutVy =     this.ctx.createBuffer(WebCL.CL_MEM_WRITE_ONLY, this.bufSize);

    // XYZ, oXYZ, Vxyz, oVxyz, InvM, conn, N, L, maxconn, dt
    var i = 0;
    this.kernel.setKernelArg(i++, this.bufInX);
    this.kernel.setKernelArg(i++, this.bufInY);
    this.kernel.setKernelArg(i++, this.bufOutX);
    this.kernel.setKernelArg(i++, this.bufOutY);
    this.kernel.setKernelArg(i++, this.bufInVx);
    this.kernel.setKernelArg(i++, this.bufInVy);
    this.kernel.setKernelArg(i++, this.bufOutVx);
    this.kernel.setKernelArg(i++, this.bufOutVy);
    this.kernel.setKernelArg(i++, this.bufInInvMass);
    this.kernel.setKernelArg(i++, this.bufInStat);
    this.kernel.setKernelArg(i++, this.bufInConn);
    this.kernel.setKernelArg(i++, inn.N, WebCL.types.UINT);
    this.kernel.setKernelArg(i++, this.bufInL);
    this.kernel.setKernelArg(i++, inn.maxconn, WebCL.types.UINT);
    this.kernel.setKernelArg(i++, inn.dt, WebCL.types.FLOAT);
    this.kernel.setKernelArg(i++, inn.KS, WebCL.types.FLOAT);
    this.kernel.setKernelArg(i++, inn.KD, WebCL.types.FLOAT);
    this.kernel.setKernelArg(i++, inn.XMIN, WebCL.types.FLOAT);
    this.kernel.setKernelArg(i++, inn.XMAX, WebCL.types.FLOAT);
    this.kernel.setKernelArg(i++, inn.YMIN, WebCL.types.FLOAT);
    this.kernel.setKernelArg(i++, inn.YMAX, WebCL.types.FLOAT);
    this.kernel.setKernelArg(i++, inn.G, WebCL.types.FLOAT);

    function createAllocatedDataObject(size,data){
      var o = WebCL.createDataObject();
      o.allocate(size);
      o.set(data);
      return o;
    }

    // Write the buffer to OpenCL device memory
    this.dataObjectX = createAllocatedDataObject(this.bufSize,inn.x);
    this.dataObjectY = createAllocatedDataObject(this.bufSize,inn.y);

    this.dataObjectVx = createAllocatedDataObject(this.bufSize,inn.vx);
    this.dataObjectVy = createAllocatedDataObject(this.bufSize,inn.vy);

    this.dataObjectInvMass = createAllocatedDataObject(this.bufSize,inn.invmass);
    this.dataObjectStat = createAllocatedDataObject(this.bufSize,inn.stat);

    this.dataObjectConn =    createAllocatedDataObject(this.bufSize*inn.maxconn,inn.conn);
    this.dataObjectL =       createAllocatedDataObject(this.bufSize*inn.maxconn,inn.L);
  }

  this.dataObjectX.set(inn.x);
  this.dataObjectY.set(inn.y);
  this.dataObjectVx.set(inn.vx);
  this.dataObjectVy.set(inn.vy);
  this.dataObjectInvMass.set(inn.invmass);
  this.dataObjectStat.set(inn.stat);
  this.dataObjectConn.set(inn.conn);
  this.dataObjectL.set(inn.L);

  // Enqueue input things
  this.cmdQueue.enqueueWriteBuffer(this.bufInX,       false, 0, this.dataObjectX.length,       this.dataObjectX,       []);
  this.cmdQueue.enqueueWriteBuffer(this.bufInY,       false, 0, this.dataObjectY.length,       this.dataObjectY,       []);
  this.cmdQueue.enqueueWriteBuffer(this.bufInVx,      false, 0, this.dataObjectVx.length,      this.dataObjectVx,      []);
  this.cmdQueue.enqueueWriteBuffer(this.bufInVy,      false, 0, this.dataObjectVy.length,      this.dataObjectVy,      []);
  this.cmdQueue.enqueueWriteBuffer(this.bufInInvMass, false, 0, this.dataObjectInvMass.length, this.dataObjectInvMass, []);
  this.cmdQueue.enqueueWriteBuffer(this.bufInStat, false, 0, this.dataObjectStat.length, this.dataObjectStat, []);
  this.cmdQueue.enqueueWriteBuffer(this.bufInConn,    false, 0, this.dataObjectConn.length,    this.dataObjectConn,    []);
  this.cmdQueue.enqueueWriteBuffer(this.bufInL,       false, 0, this.dataObjectL.length,       this.dataObjectL,    []);


  // Execute (enqueue) kernel
  this.cmdQueue.enqueueNDRangeKernel(this.kernel,
				     this.globalWS.length,
				     [],
				     this.globalWS,
				     this.localWS,
				     []);

  // Read the result buffer from OpenCL device
  this.cmdQueue.enqueueReadBuffer(this.bufOutX, false, 0, this.bufSize, this.dataObjectX, []);
  this.cmdQueue.enqueueReadBuffer(this.bufOutY, false, 0, this.bufSize, this.dataObjectY, []);
  this.cmdQueue.enqueueReadBuffer(this.bufOutVx,false, 0, this.bufSize, this.dataObjectVx, []);
  this.cmdQueue.enqueueReadBuffer(this.bufOutVy,false, 0, this.bufSize, this.dataObjectVy, []);

  this.cmdQueue.finish();
  this.cmdQueue.flush();

  this.utils.writeDataObjectToTypedArray(this.dataObjectX,  out.x);
  this.utils.writeDataObjectToTypedArray(this.dataObjectY,  out.y);
  this.utils.writeDataObjectToTypedArray(this.dataObjectVx, out.vx);
  this.utils.writeDataObjectToTypedArray(this.dataObjectVy, out.vy);

  var t1 = new Date().getTime();

};

// requestAnim shim layer by Paul Irish
window.requestAnimFrame = (function(){
    return  window.requestAnimationFrame || 
    window.webkitRequestAnimationFrame || 
    window.mozRequestAnimationFrame    || 
    window.oRequestAnimationFrame      || 
    window.msRequestAnimationFrame     || 
    function(/* function */ callback, /* DOMElement */ element){
      window.setTimeout(callback, 1000 / 60);
    };
  })();