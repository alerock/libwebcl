/**
 * A WebCL based random number generator.
 *
 * @author Tomi Aarnio, Nokia Research Tampere, 2011
 * @license MIT, LGPL
 *
 * Copyright (c) Nokia Corporation. All rights reserved.
 */

/**
 * #include <libcl.js>
 */

(function() {
  if (window.libcl !== undefined) return;
  (function(srcUrl) {
    var head = document.getElementsByTagName('head')[0];
    var script = document.createElement('script');
    script.type = 'text/javascript';
    script.onload = function() { console.log(srcUrl, "loaded"); }
    script.src = srcUrl;
    head.appendChild(script);
  })("libcl.js");
})();

/**
 * @requires libcl.js
 */

rng = (function() {

  /***************************************************
   *
   *   P U B L I C   A P I
   *
   **************************************************/

  API = {

    /**
     * Common setup for WebCL and JavaScript benchmarks.
     */

    setup : function () {
      var dstCanvas = document.getElementById("dstCanvas");
      var ctx2d = dstCanvas.getContext("2d");
      var width = dstCanvas.width;
      var height = dstCanvas.height;
      globals.imageDataObject = ctx2d.createImageData(width, height);
      globals.imagePixelArray = globals.imageDataObject.data;
      globals.width = width;
      globals.height = height;
      globals.ctx2d = ctx2d;
      this.setupCL();
    },

    runAnimated : function(deviceTypeName) {

      switch (deviceTypeName) {

      case 'JS':
        this.animFunc = function () { rng.runJavaScript(); }
        break;

      case 'CPU': 
        var success = this.compileAndRunKernel('CPU'); 
        this.animFunc = success ? function() { rng.runKernel('CPU'); } : undefined;
        break;

      case 'GPU': 
        var success = this.compileAndRunKernel('GPU'); 
        this.animFunc = success ? function() { rng.runKernel('CPU'); } : undefined;
        break;

      default:
        this.animFunc = undefined;
        break;
      }
      
      this.animate();
    },

    animate : function () {
      if (rng.animFunc) {
        rng.animFunc();
        window.requestAnimFrame(rng.animate);
      }
    },
    
    /**
     * TEA Random Number Generator benchmark in JavaScript.
     */

    runJavaScript : function () {

      var imageData = globals.imageDataObject;
      var pixels = globals.imagePixelArray;
      var width = globals.width;
      var height = globals.height;
      var ctx2d = globals.ctx2d;
      var seed = globals.seed++;

      timer.start("runKernel");

      var delta = 0x9E3779B9;
      var k0 = 0xA341316C;
      var k1 = 0xC8013EA4;
      var k2 = 0xAD90777D;
      var k3 = 0x7E95761E;
      var ITER = 15;
      
      for (var i=0; i < width*height; i++) {
        var x = seed;
        var y = seed << 3;
        x += i + (i << 11) + (i << 19);
        y += i + (i << 9) + (i << 21);

        var sum = 0;
        for (var j=0; j < ITER; j++) {
          sum += delta;
          x += ((y << 4) + k0) & (y + sum) & ((y >> 5) + k1);
          y += ((x << 4) + k2) & (x + sum) & ((x >> 5) + k3);
        }

        var r = x & 0xff;
        var g = (x & 0xff00) >> 8;
        pixels[i*4    ] = r;
        pixels[i*4 + 1] = r;
        pixels[i*4 + 2] = r;
        pixels[i*4 + 3] = g;
      }

      var elapsed = timer.elapsed("runKernel");
      writeLog("\nexecuting kernel in JavaScript... took " + elapsed + " ms");

      timer.start("showOutput");
      ctx2d.putImageData(imageData, 0, 0);
      elapsed = timer.elapsed("showOutput");
      var megabytes = (pixels.length / (1024*1024)).toFixed(0);
      writeLog("copying image data (" + megabytes + " MB) from JS to HTML Canvas... took " + elapsed + " ms");
      writeLog("done.");
    },

    /**
     * WebCL setup.
     */

    setupCL : function() {
      clearLog();
      var result = libcl.detectCL();
      
      if (result.success == true) {
        var platformNames = libcl.getPlatformNames();
        writeLog("Found the following OpenCL platform(s) on this system: ");
        for (var p in platformNames) {
          writeLog("  " + platformNames[p]);
        }
      } else {
        writeLog(result.message);
        return false;
      }

      timer.start("createContexts");
      var success = libcl.createContexts();
      var elapsed = timer.elapsed("createContexts");
      writeLog("WebCL initialization took " + elapsed + " ms");

      if (success == false) {
        writeLog("ERROR: Failed to create a WebCL context.");
        return false;
      }
    },

    compileKernel : function(deviceTypeName) {
      var src = libcl.loadKernel("kernelCode");
      if (src == globals.kernelSource && globals.compiled[deviceTypeName] == true) return;
      globals.kernelSource = src;

      timer.start("compileKernel");
      var buildLog = libcl.buildKernel(src);
      var elapsed = timer.elapsed("compileKernel");
      writeLog("compiling kernel for the " + deviceTypeName + "... took " + elapsed + " ms");
      if (buildLog != null) {
        document.getElementById("compilerOutput").style.color = 'red';
        document.getElementById("compilerOutput").value = "Failed to build kernel:" + "\n" + buildLog;
        globals.compiled[deviceTypeName] = false;
        return false;
      } else {
        document.getElementById("compilerOutput").style.color = 'yellow';
        document.getElementById("compilerOutput").value = "Kernel built successfully.";
        globals.compiled[deviceTypeName] = true;
        return true;
      }
    },

    compileAndRunKernel : function(deviceTypeName) {
      var platformName = libcl.selectDevice(deviceTypeName);
      if (platformName != null) {
        try {
          writeLog("\nSelected the " + deviceTypeName + " on the " + platformName + " platform");
          var success = this.compileKernel(deviceTypeName);
          if (success == false) throw new Exception();
          this.runKernel(deviceTypeName);
          return true;
        } catch (e) {
          writeLog("ERROR: Failed to run the kernel on the " + deviceTypeName + ".");
          writeLog("Please reload the page and try again.");
          console.log(e);
          return false;
        }
      } else {
        writeLog("\nERROR: No " + deviceTypeName + " devices available on this system.");
        return false;
      }
    },

    /**
     * TEA Random Number Generator benchmark in WebCL.
     */
 
    runKernel : function(deviceTypeName) {

      var width = globals.width;
      var height = globals.height;
      var ctx = libcl.current.context;
      var device = libcl.current.device;
      var queue = libcl.current.device.queue;
      var kernel = libcl.current.device.kernel;
      var buffers = libcl.current.context.buffers;

      var bufSize = width*height*4;
      if (buffers[0] === undefined) {
        buffers[0] = ctx.createBuffer(WebCL.CL_MEM_READ_WRITE, bufSize);
        console.log("Created a new WebCL output buffer for the", deviceTypeName, "device");
      }
      
      var kernelArgs = { 
        'dst'    : [ buffers[0] ],
        'length' : [ width*height, WebCL.types.UINT ],
        'seed'   : [ globals.seed++, WebCL.types.UINT ]
      };

      timer.start("runKernel");
      libcl.setKernelArgs(kernel, kernelArgs);
      libcl.enqueue1DRangeKernel(queue, kernel, width*height);
      libcl.enqueueReadBuffer(queue, buffers[0], bufSize, globals.imagePixelArray);
      var runKernelElapsed = timer.elapsed("runKernel");

      timer.start("showOutput");
      globals.ctx2d.putImageData(globals.imageDataObject, 0, 0);
      var showOutputElapsed = timer.elapsed("showOutput");
      if ((globals.seed % 100) == 0) {
        var megabytes = (bufSize / (1024*1024)).toFixed(0);
        writeLog("executing kernel on the " + device.typeName + "... took " + runKernelElapsed + " ms");
        writeLog("copying image data (" + megabytes + " MB) from WebCL to HTML Canvas... took " + showOutputElapsed + " ms");
        writeLog("done.");
      }
    }

  };

  /***************************************************
   *
   *   P R I V A T E   I M P L E M E N T A T I O N
   *
   **************************************************/

  globals = {
    compiled : [],
    seed : 0
  };

  clearLog = function() {
    var logWindow = document.getElementById("hostCodeOutput");
    logWindow.value = "";
  };
    
  writeLog = function(msg) {
    var logWindow = document.getElementById("hostCodeOutput");
    logWindow.value += msg + "\n";
    logWindow.scrollTop = logWindow.scrollHeight - logWindow.clientHeight;
  };

  // Generate a black & white pixel pattern of size width x height

  var seedPixels = function() {
    var seed = document.getElementById("seed");
    var canvas = document.getElementById("dstCanvas");
    var ctx2d = canvas.getContext("2d");
    ctx2d.drawImage(seed, 0, 0, canvas.width, canvas.height);
    var imgData = ctx2d.getImageData(0, 0, canvas.width, canvas.height);
    var pixels = imgData.data;
    return pixels;
  };

  // requestAnimationFrame compatibility wrapper by Paul Irish
  
  window.requestAnimFrame = (function() {
    return window.requestAnimationFrame  || 
      window.webkitRequestAnimationFrame || 
      window.mozRequestAnimationFrame    || 
      window.oRequestAnimationFrame      || 
      window.msRequestAnimationFrame     || 
      function(/* function */ callback, /* DOMElement */ element){
        window.setTimeout(callback, 1000 / 60);
      };
  })();
 
  /**
   * A stopwatch timer based on the JavaScript built-in Date object.
   * Multiple concurrent measurements can be distinguished by unique
   * user-defined IDs.
   *
   * @example
   * timer.start("myUniqueID");
   * someFunction();
   * someMoreCode();
   * timer.elapsed("myUniqueID", true);
   */

  var timer = {
    startTimes : [],
    
    start : function(id) { 
      this.startTimes[id] = new Date().getTime(); 
    },

    elapsed : function(id, log) { 
      var elapsed = new Date().getTime() - this.startTimes[id]; 
      if (log==true) { console.log(id, "took", elapsed, "ms") };
      return elapsed;
    }
  };

  return API;

})();
