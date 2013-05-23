/**
 * A library of WebCL utility functions for performing device
 * detection, context creation, etc.
 *
 * @author Tomi Aarnio
 * @copyright Nokia Research Tampere, 2012
 * @license Mozilla Public License (MPL) 2.0
 */

/**
 * @requires webcl.js
 */

(function() {

  "use strict";

  // Compatibility checks, wrappers and shorthands
  
  var console = window.console || { log : function() {} };
  var WebCL = window.WebCL;

  /**
   * #include <webcl.js>
   */

  (function() {
    if (window.webCL === undefined) { 
      (function(srcUrl) {
        var head = document.getElementsByTagName('head')[0];
        var script = document.createElement('script');
        script.type = 'text/javascript';
        script.onload = function() { console.log(srcUrl, "loaded"); };
        script.src = srcUrl;
        head.appendChild(script);
      })("webcl.js");
    }
  })();

  /**
   * API
   */

  window.libcl = (function() {

    var cl = null;

    var API = {

      platforms : [],    // the available CL platforms in this system

      current : {        // the currently active platform, context, device, etc.
        platform : null,
        context : null,
        device : null,
        queue : null
      },
      
      messages : {
        errorNotInstalled : "This page requires the Nokia WebCL extension for Firefox. " +
          "Please download and install it from http://webcl.nokiaresearch.com.",
        
        errorWrongWebCL : "Your browser appears to support WebCL in some form. However, " +
          "this page requires the Nokia WebCL extension for Firefox. " +
          "Please download and install it from http://webcl.nokiaresearch.com.",

        errorNotUpToDate : "Your Nokia WebCL extension appears to be out of date. " +
          "Please download the latest version from http://webcl.nokiaresearch.com. ",

        errorNoOpenCL: "Your browser supports WebCL in principle, but unfortunately no " +
          "OpenCL driver was found.  You may want to try updating your display driver, " +
          "or installing a CPU-based OpenCL implementation (such as the Intel OpenCL SDK " +
          "or the AMD APP SDK).",

        errorObsoleteOpenCL: "Your browser supports WebCL in principle, but unfortunately " +
          "the underlying operating system only supports OpenCL 1.0, whereas 1.1 would be " +
          "required.  You may want to try updating your display driver, or installing a " +
          "CPU-based OpenCL implementation (such as the Intel OpenCL SDK or the AMD APP SDK).",

        isSupported : "Excellent! Your system does support WebCL."
      },

      /**
       * Detects if a WebCL implementation is present, is up to date,
       * and provides at least one CL Device (such as a CPU or a
       * GPU). The available CL Platforms can be accessed afterwards at
       * libcl.platforms[i]. Devices, contexts and other properties are
       * available as attributes of each platform.
       *
       * @return {Object} a dictionary object with the fields 'success'
       * (boolean) and 'message' (string).
       */
      detectCL : function() {

        var msg;

        // STEP 1. Check if any variant of WebCL is available

        cl = window.webCL;
        if (!cl) {
          msg = this.messages.errorNotInstalled;
          console.log("detectCL: ", msg);
          return { 'success' : false, 'message' : msg };
        }

        // STEP 2. Check if we have the Nokia WebCL extension or some
        // other implementation. Currently we only support the Nokia
        // version.

        if (cl.getPlatforms) {
          console.log("Detected the Nokia WebCL Extension for Firefox");
        } else {
          msg = this.messages.errorWrongWebCL;
          console.log("detectCL: ", msg);
          return { 'success' : false, 'message' : msg };
        }

        // STEP 3. Check if the WebCL implementation is up to date.
        // This rather ad-hoc test needs to be updated whenever the
        // implementation is changed in a way that affects existing
        // applications.

        if (cl.getPlatforms) {
          console.log("Your WebCL extension appears to be up to date.");
        } else {
          msg = this.messages.errorNotUpToDate;
          console.log("detectCL: ", msg);
          return { 'success' : false, 'message' : msg };
        }

        // STEP 4. Check that an OpenCL driver can be found.

        try {
          cl.getPlatforms();
        } catch (e) {
          console.log("detectCL exception: ", e);
          msg = this.messages.errorNoOpenCL;
          console.log("detectCL: ", msg);
          return { 'success' : false, 'message' : msg };
        }

        // STEP 5. Get a list of available OpenCL platforms, and another
        // list of the available devices on each platform. If there are
        // no platforms supporting OpenCL 1.1, or no available devices
        // on any platform, then we can conclude that WebCL is not
        // available.

        var success = false;
        try {
          var platforms = cl.getPlatforms();
          for (var i=0; i < platforms.length; i++) {
            var plat = platforms[i];
            console.log("  [Platform "+i+"]:");
            this.getPlatformInfo(plat);
            var version = plat.getPlatformInfo(WebCL.CL_PLATFORM_VERSION);
            if (version.indexOf("OpenCL 1.0") !== -1) {
              console.log(version, "does not support OpenCL 1.1; disqualifying.");
            } else {
              plat.name = plat.getPlatformInfo(WebCL.CL_PLATFORM_NAME);
              plat.vendor = plat.getPlatformInfo(WebCL.CL_PLATFORM_VENDOR);
              plat.devices = plat.getDevices(WebCL.CL_DEVICE_TYPE_ALL);
              if (plat.devices.length > 0) {
                this.platforms.push(plat);
                for (var d=0; d < plat.devices.length; d++) {
                  plat.devices[d].name = plat.devices[d].getDeviceInfo(WebCL.CL_DEVICE_NAME);
                  plat.devices[d].type = plat.devices[d].getDeviceInfo(WebCL.CL_DEVICE_TYPE);
                  plat.devices[d].typeName = (plat.devices[d].type === WebCL.CL_DEVICE_TYPE_CPU) ? "CPU" : "GPU";
                }
                //this.getDeviceInfo(plat.devices);
                success = true;
              }
            }
          }
        } catch (e) {
          console.log("detectCL exception: ", e);
        }

        msg = success ? this.messages.isSupported : this.messages.errorObsoleteOpenCL;
        console.log("detectCL: ", msg);
        return { 'success' : true, 'message' : msg };
      },

      /**
       * Creates a new context for the given platform and device(s). The
       * given device, or array of devices, must belong to the given
       * platform.
       *
       * Assumes that detectCL() has already been called.
       *
       * @param {WebCLPlatform} platform the platform to create a context for
       * @param {WebCLDevice} devices the device(s) to create a context for
       *
       * @return {Boolean} 'true' if context creation succeeded, 'false' if not
       */
      createContext : function(platform, devices) {
        if (devices instanceof Array) {
          return cl.createContext(devices, platform);
        } else {
          return cl.createContext([devices], platform);
        }
      },

      /**
       * Creates a new context for each platform available on this system,
       * and a new command queue for each device on each platform.  Sets
       * one of the available devices as active; selectDevice("CPU") and
       * selectDevice("GPU") can be used to switch to another device type
       * afterwards.
       *
       * Assumes that detectCL() has already been called.
       *
       * @return {Boolean} 'true' if at least one CL context was created
       * successfully; 'false' if not
       */
      createContexts : function () {

        // Create a context for all available platforms and a command queue
        // for each device on every platform
        
        var success = false;
        for (var p=0; p < this.platforms.length; p++) {
          var platform = this.platforms[p];
          var devices = platform.devices;
          try {
            platform.context = this.createContext(platform, devices);
            platform.context.buffers = [];
            for (var d=0; d < devices.length; d++) {
              devices[d].queue = platform.context.createCommandQueue(devices[d], 0);
            }
            this.current.platform = platform;
            this.current.context = platform.context;
            this.current.device = devices[0];
            this.current.queue = devices[0].queue;
            success = true;
          } catch (e) {
            console.log("Error creating WebCL context and command queue for platform", p, "and device", d, ": ", e);
          }
        }

        return success;
      },

      /**
       * Selects the first available device with the given type (CPU or
       * GPU) as the currently active one. If no device of that type is
       * available, returns null.
       *
       * Assumes that createContexts() has already been called. That is,
       * every platform is assumed to have a valid CL context, and every
       * device a valid command queue.
       *
       * @param {String} deviceTypeName either "CPU" or "GPU"
       *
       * @param {Integer} deviceIndex [optional] in case there are multiple
       * devices of the given type, specifies which of them to select
       *
       * @return {String} the name of the selected CL platform, or 'null'
       * if no device by the given type (CPU or GPU) is available
       */
      selectDevice : function(deviceTypeName, deviceIndex) {

        deviceTypeName = deviceTypeName || "CPU";
        deviceIndex = deviceIndex || 0;

        var numMatchingDevices = 0;
        for (var p=0; p < this.platforms.length; p++) {
          var plat = this.platforms[p];
          for (var d=0; d < plat.devices.length; d++) {
            var device = plat.devices[d];
            if (device.typeName === deviceTypeName) {
              this.current.platform = plat;
              this.current.context = plat.context;
              this.current.device = plat.devices[d];
              this.current.queue = plat.devices[d].queue;
              if (deviceIndex === numMatchingDevices) {
                return plat.name;
              }
              numMatchingDevices++;
            }
          }
        }
        
        return null;
      },

      /**
       * Retrieves the source code of a CL or GL kernel from the
       * 'value' field of the specified DOM element
       *
       * @param {String} id the ID of the DOM element containing the
       * kernel source code; for example, "myShader". 
       *
       * @return {String} the source code of the specified kernel,
       * or 'null' if not found
       */
      loadKernel : function (id) {
        var kernelElement = null;
        var kernelSource = null;
        
        if (id !== null && id !== "") {
          kernelElement = document.getElementById(id);
          if (kernelElement !== null) {
            kernelSource = kernelElement.value;
          }
        }

        return kernelSource;
      },

      /**
       * Builds a kernel from the given source code for the current CL
       * context and device. Stores the compiled program and kernel as
       * 'this.current.device.program' and 'this.current.device.kernel'.
       *
       * @param {String} kernelSrc the kernel source code
       *
       * @return {String} the build info log if the build failed; null otherwise
       */
      buildKernel : function (kernelSrc) {

        var ctx = this.current.context;
        var device = this.current.device;
        
        try {
          var program = ctx.createProgramWithSource(kernelSrc);
          program.buildProgram([device], "");
          var kernels = program.createKernelsInProgram();
          var kernel = kernels[0];
          var name = kernel.getKernelInfo(WebCL.CL_KERNEL_FUNCTION_NAME);
          var ws = kernel.getKernelWorkGroupInfo(device, WebCL.CL_KERNEL_WORK_GROUP_SIZE);
          console.log("Recommended workgroup size for kernel '" + name + "': ", ws);
          var buildStatus = program.getProgramBuildInfo(device, WebCL.CL_PROGRAM_BUILD_STATUS);
          var buildOK = (buildStatus === WebCL.CL_SUCCESS);
          if (!buildOK) {
            var errorString = "Build error: " + program.getProgramBuildInfo(device, WebCL.CL_PROGRAM_BUILD_LOG);
            return errorString;
          }
          this.current.device.program = program;
          this.current.device.kernel = kernel;
        } catch (e) {
          console.log("Exception in libcl.buildKernel:", e);
          return "Build error: " + e;
        }
        return null;
      },

      /**
       *
       */
      setKernelArgs : function(kernel, args) {
        var argIndex = 0;
        for (var name in args) {
          var argValue = args[name][0];
          var argType = args[name][1];
          if (argType === "LOCAL") {
            kernel.setKernelArgLocal(argIndex, argValue);
          } else if (argType === undefined) {
            kernel.setKernelArg(argIndex, argValue);
          } else {
            kernel.setKernelArg(argIndex, argValue, argType);
          }
          argIndex++;
        }
      },

      /**
       * A convenience wrapper for clEnqueueNDRangeKernel that executes
       * the kernel in 1-dimensional index space, using a default local
       * workgroup size, and omitting the event wait list.
       *
       * @param {WebCLCommandQueue} queue the command queue to use
       * @param {WebCLKernel} kernel the kernel to put into the queue
       * @param {Integer} length the global workgroup size (# of elements)
       */
      enqueue1DRangeKernel : function (queue, kernel, length) {
        queue.enqueueNDRangeKernel(kernel, 1, [], [ length ], [], []);
      },

      /**
       * A convenience wrapper for clEnqueueNDRangeKernel that executes
       * the kernel in 2-dimensional index space, using default local
       * workgroup size, and omitting the event wait list.
       *
       * @param {WebCLCommandQueue} queue the command queue to use
       * @param {WebCLKernel} kernel the kernel to put into the queue
       * @param {Integer} width global workgroup size along the x axis
       * @param {Integer} height global workgroup size along the y axis
       */
      enqueue2DRangeKernel : function (queue, kernel, width, height) {
        queue.enqueueNDRangeKernel(kernel, 2, [], [ width, height ], [], []);
      },

      /**
       * A convenience wrapper for clEnqueueReadBuffer. Copies the given
       * number of bytes from the given CL buffer object to host memory
       * (ArrayBuffer), blocking until the operation is completed.
       * 
       * @param {WebCLCommandQueue} queue the command queue to use
       * @param {WebCLMemoryObject} srcBuffer the buffer to read from
       * @param {Integer} numBytes the number of bytes to copy to host memory
       * @param {ArrayBuffer} dstBuffer the destination ArrayBuffer
       */
      enqueueReadBuffer : function (queue, srcBuffer, numBytes, dstBuffer) {
        queue.enqueueReadBuffer(srcBuffer, true, 0, numBytes, dstBuffer, []);
      },

      /**
       * A convenience wrapper for clEnqueueWriteBuffer. Copies the given
       * number of bytes from host memory (ArrayBuffer) to the given
       * CL buffer object, blocking until the operation is completed.
       * 
       * @param {WebCLCommandQueue} queue the command queue to use
       * @param {WebCLMemoryObject} dstBuffer the buffer to copy to
       * @param {Integer} numBytes the number of bytes to copy from host memory
       * @param {ArrayBuffer} srcBuffer the source ArrayBuffer
       */
      enqueueWriteBuffer : function (queue, dstBuffer, numBytes, srcBuffer) {
        queue.enqueueWriteBuffer(dstBuffer, true, 0, numBytes, srcBuffer, []);
      },

      /**
       * Retrieves WebCL enums based on their name and numeric value.  If
       * the name of a particular WebCL enum contains the given substring
       * 'name', and its numeric value matches the given 'value', then
       * that enum will be among the ones that are returned.  If 'value'
       * is omitted, then enums are selected based on their names only.
       *
       * @param {String} name a substring to match against enum names
       *
       * @param {Number} value a numeric value to restrict the set of matches
       *
       * @return {Array} an array containing the names of all matching enums
       */
      getEnumNames : function(name, value) {
        var matching = [];
        for (var enumName in WebCL) {
          if (typeof WebCL[enumName] === 'number') {
            if (value === undefined || WebCL[enumName] === value) {
              if (enumName.indexOf(name) !== -1) {
                matching.push(enumName);
              }
            }
          }
        }
        return matching;
      },

      /**
       * Retrieves the subset of WebCL enums whose name contains the given
       * substring 'name', and whose numeric value is a power of two and a
       * bitwise subset of the given 'value'.  For example, an enum with
       * the value 0x10 would be returned if the given 'value' was 0x3C.
       *
       * @param {String} name
       * @param {Number} value
       *
       * @return {Array} an array containing the names of all matching enums
       */
      getBitmaskEnumNames : function(name, value) {
        var matching = [];
        for (var bit=1; bit <= value; bit <<= 1) {
          if (value & bit) {
            matching.push(this.getEnumNames(name, value & bit)[0]);
          }
        }
        return matching;
      },

      /**
       * Retrieves the names of the CL platforms available on this system.
       * This assumes that detectCL() has already been called.
       *
       * @return {Array} an array of strings containing the names of the
       * WebCL platforms available on this system
       */
      getPlatformNames : function () {
        var names = [];
        for (var p=0; p < this.platforms.length; p++) {
          var plat = this.platforms[p];
          names.push(plat.getPlatformInfo(WebCL.CL_PLATFORM_NAME));
        }
        return names;
      },

      /**
       * Queries all available information from the given CL platform, and
       * prints it out on the console.
       *
       * @param {WebCLPlatform} platform the CL platform to investigate
       */
      getPlatformInfo : function (platform) {
        var platformEnums = this.getEnumNames("CL_PLATFORM_");
        for (var i=0; i < platformEnums.length; i++) {
          var enumName = platformEnums[i];
          var enumValue = WebCL[enumName];
          try {
            var response = platform.getPlatformInfo(enumValue);
            console.log("    ", enumName, "\t\t", response);
          } catch (e) {}
        }
      },

      /**
       * Queries all available information from the given array of CL
       * devices, and prints it out on the console.
       *
       * @param {WebCLDevice} devices an array of CL devices to investigate
       */
      getDeviceInfo : function (devices) {
        for (var d=0; d < devices.length; d++) {
          var device = devices[d];
          console.log("    [Device "+d+"]:");
          var deviceEnums = this.getEnumNames("CL_DEVICE_");
          deviceEnums.push(this.getEnumNames("CL_DRIVER_")[0]);
          for (var i=0; i < deviceEnums.length; i++) {
            var enumName = deviceEnums[i];
            var enumval = WebCL[enumName];
            try {
              var response = device.getDeviceInfo(enumval);
              var responseNames = null;
              if (typeof response === 'number') {
                if (enumName.indexOf("DEVICE_TYPE") !== -1) {
                  responseNames = this.getEnumNames("DEVICE", response);
                }
                if (enumName.indexOf("CACHE_TYPE") !== -1) {
                  responseNames = this.getEnumNames("CACHE", response);
                }
                if (enumName.indexOf("MEM_TYPE") !== -1) {
                  responseNames = this.getEnumNames("MEM", response);
                }
                if (enumName.indexOf("QUEUE_PROPERTIES") !== -1) {
                  responseNames = this.getBitmaskEnumNames("CL_QUEUE", response);
                }
                if (enumName.indexOf("EXECUTION_CAPABILITIES") !== -1) {
                  responseNames = this.getBitmaskEnumNames("CL_EXEC", response);
                }
              }
              console.log("      ", enumName, "\t\t\t", response, responseNames? responseNames : " ");
            } catch (e) {}
          }
        }
      }
    };
    
    return API;
    
  })();
})();
