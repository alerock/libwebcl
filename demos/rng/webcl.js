/**
 * A compatibility layer for the Nokia WebCL extension that makes it
 * look like a built-in implementation, with proper JavaScript object
 * semantics. The wrapped WebCL is accessible as 'window.webCL', while
 * the extension remains 'window.WebCL'.
 *
 * @author Tomi Aarnio
 * @copyright Nokia Research Tampere, 2012
 * @license Mozilla Public License (MPL) 2.0
 */

(function() {

  "use strict";

  // Compatibility checks, wrappers and shorthands
  
  var console = window.console || { log : function() {} };
  var WebCL = window.WebCL;

  // Bail out if the Nokia WebCL extension is not present.

  if (!WebCL) { return; }

  // A global counter for wrapped WebCL object instances.

  var numInstances = 0;

  var gl = null;

  ////////////////////////////////////////////////////////////////////

  window.webCL = (function () {

    var API = {
      getPlatforms : function() {
        var platforms = [];
        var nativePlatforms = WebCL.getPlatforms();
        for (var i=0; i < nativePlatforms.length; i++) {
          platforms[i] = new WebCLPlatform(nativePlatforms[i]);
        }
        return platforms;
      },

      createContext : function(devices, platform, glContext) {
        gl = glContext;
        var ctxPlatform = [WebCL.CL_CONTEXT_PLATFORM, platform.getPeer()];
        var nativeDevices = [];
        for (var i=0; i < devices.length; i++) {
          nativeDevices[i] = devices[i].getPeer();
        }
        console.log("createContext: ", devices, platform);
        var nativeContext = WebCL.createContext(ctxPlatform, nativeDevices);
        return new WebCLContext(nativeContext, platform, devices);
      },

      createContextFromType : null, // TODO implement

      waitForEvents : function(eventList) {
        WebCL.waitForEvents(eventList);
      }
    };

    for (var p in WebCL) {
      if (typeof WebCL[p] !== 'function') {
        API[p] = WebCL[p];
      }
    }

    return API;

  })();

  ////////////////////////////////////////////////////////////////////

  function WebCLPlatform(nativePeer) {
    return { 
      id : "WebCLPlatform " + numInstances++,
      getPeer : function() { 
        return nativePeer; 
      },
      getPlatformInfo : function(name) { 
        return nativePeer.getPlatformInfo(name); 
      },
      getDevices : function(deviceType) {
        deviceType = deviceType || WebCL.CL_DEVICE_TYPE_ALL;
        var nativeDevices = nativePeer.getDevices(deviceType);
        var devices = [];
        for (var i=0; i < nativeDevices.length; i++) {
          var isAvailable = nativeDevices[i].getDeviceInfo(WebCL.CL_DEVICE_AVAILABLE);
          if (isAvailable === true) {
            var availableDevice = new WebCLDevice(nativeDevices[i], this);
            devices.push(availableDevice);
          }
        }
        return devices;
      }
    };
  }

  ////////////////////////////////////////////////////////////////////

  function WebCLDevice(nativePeer, hostPlatform) {
    return {
      id : "WebCLDevice " + numInstances++,
      getPeer : function() {
        return nativePeer;
      },
      getDeviceInfo : function(name) {
        if (name === WebCL.CL_DEVICE_PLATFORM) {  // TODO: Remove CL_DEVICE_PLATFORM?
          return hostPlatform;
        }
        return nativePeer.getDeviceInfo(name);
      }
    };
  }

  ////////////////////////////////////////////////////////////////////

  function WebCLContext(nativePeer, hostPlatform, hostDevices) {
    return {
      id : "WebCLContext " + numInstances++,
      getPeer : function() {
        return nativePeer; 
      },
      getContextInfo : function(name) {
        if (name === WebCL.CL_CONTEXT_DEVICES) {
          return hostDevices;
        } else if (name === WebCL.CL_CONTEXT_PROPERTIES) {
          return [WebCL.CL_CONTEXT_PLATFORM, hostPlatform];
        }
        return nativePeer.getContextInfo(name);
      },
      createProgramWithSource : function(source) {
        var nativeProgram = nativePeer.createProgramWithSource(source);
        return new WebCLProgram(nativeProgram, this, hostDevices);
      },
      createCommandQueue : function(device, properties) {
        var nativeQueue = nativePeer.createCommandQueue(device.getPeer(), properties);
        return new WebCLCommandQueue(nativeQueue, this, hostDevices);
      },
      createBuffer : function(memFlags, sizeInBytes) {
        var nativeBuffer = nativePeer.createBuffer(memFlags, sizeInBytes);
        return new WebCLMemoryObject(nativeBuffer, sizeInBytes);
      },
      createBufferFromGL : function(memFlags, glBuffer) {
        gl.bindBuffer(gl.ARRAY_BUFFER, glBuffer);
        var sizeInBytes = gl.getBufferParameter(gl.ARRAY_BUFFER, gl.BUFFER_SIZE);
        console.log("createBufferFromGL: ", memFlags, glBuffer, "buffer size: ", sizeInBytes);
        var nativeBuffer = nativePeer.createBuffer(memFlags, sizeInBytes);
        return new WebCLMemoryObject(nativeBuffer, sizeInBytes, glBuffer);
      },
      createImage2D : null,
      createImage3D : null,
      createSampler : null,
      getSupportedImageFormats : null,
      createUserEvent : null
    };
  }

  ////////////////////////////////////////////////////////////////////

  function WebCLProgram(nativePeer, hostContext, hostDevices) {
    return {
      id : "WebCLProgram " + numInstances++,
      getPeer : function() { 
        return nativePeer; 
      },
      getProgramInfo : function(name) {
        if (name === WebCL.CL_PROGRAM_CONTEXT) {
          return hostContext;
        } else if (name === WebCL.CL_PROGRAM_DEVICES) {
          return hostDevices;
        }
        return nativePeer.getProgramInfo(name);
      },
      getProgramBuildInfo : function(device, name) {
        return nativePeer.getProgramBuildInfo(device.getPeer(), name);
      },
      buildProgram : function(devices, options) {
        var nativeDevices = [];
        for (var i=0; i < devices.length; i++) {
          nativeDevices[i] = devices[i].getPeer();
        }
        nativePeer.buildProgram(nativeDevices, options);
      },
      createKernel: function(kernelName) {
        var nativeKernel = nativePeer.createKernel(kernelName);
        var kernel = new WebCLKernel(nativeKernel, hostContext, this);
        return kernel;
      },
      createKernelsInProgram : function() {
        var kernels = [];
        var nativeKernels = nativePeer.createKernelsInProgram();
        for (var i=0; i < nativeKernels.length; i++) {
          kernels[i] = new WebCLKernel(nativeKernels[i], hostContext, this);
        }
        return kernels;
      }
    };
  }

  ////////////////////////////////////////////////////////////////////

  function WebCLKernel(nativePeer, hostContext, hostProgram) {
    return {
      id : "WebCLKernel " + numInstances++,
      getPeer : function() { 
        return nativePeer; 
      },
      getKernelInfo : function(name) {
        if (name === WebCL.CL_KERNEL_CONTEXT) {
          return hostContext;
        } else if (name === WebCL.CL_KERNEL_PROGRAM) {
          return hostProgram;
        }
        return nativePeer.getKernelInfo(name);
      },
      getKernelWorkGroupInfo : function(device, name) {
        return nativePeer.getKernelWorkGroupInfo(device.getPeer(), name);
      },
      setKernelArg : function(index, value, type) {
        value = (value.getPeer && value.getPeer()) || value;
        if (type === undefined) {
          return nativePeer.setKernelArg(index, value);
        } else {
          return nativePeer.setKernelArg(index, value, type);
        }
      },
      setKernelArgLocal : function(index, size) {
        return nativePeer.setKernelArgLocal(index, size);
      },
      getWorkGroupInfo : function(device, name) {  // Mozilla API
        return this.getKernelWorkGroupInfo(device, name); 
      },
      setScalarArg : function(index, value, type) { // Mozilla API
        return nativePeer.setKernelArg(index, value, WebCL.types.UINT);
      },
      setMemArg : function(index, memObject) { // Mozilla API
        return nativePeer.setKernelArg(index, memObject.getPeer());
      },
      setArgLocal : function(index, size) { // Mozilla API
        return nativePeer.setKernelArgLocal(index, size);
      }
    };
  }

  ////////////////////////////////////////////////////////////////////
  // TODO add missing functions

  function WebCLCommandQueue(nativePeer, hostContext, hostDevice) {
    return {
      id : "WebCLCommandQueue " + numInstances++,
      getPeer : function() { 
        return nativePeer; 
      },
      getCommandQueueInfo : function(name) {
        return nativePeer.getCommandQueueInfo(name);
      },
      enqueueNDRangeKernel : function(kernel, workDim, globalWorkOffset, 
                                      globalWorkSize, localWorkSize, eventWaitList) {
        var globalWorkOffsetArray = (globalWorkOffset instanceof Array) ? globalWorkOffset : [ globalWorkOffset ];
        var globalWorkSizeArray = (globalWorkSize instanceof Array) ? globalWorkSize : [ globalWorkSize ];
        var localWorkSizeArray = (localWorkSize instanceof Array) ? localWorkSize : [ localWorkSize ];
        var nativeEvent = nativePeer.enqueueNDRangeKernel(kernel.getPeer(),
                                                         workDim,
                                                         globalWorkOffsetArray,
                                                         globalWorkSizeArray,
                                                         localWorkSizeArray,
                                                         eventWaitList || []);
        return new WebCLEvent(nativeEvent);
      },
      enqueueWriteBuffer : function(dstBufferObject, blockingWrite, dstOffset, 
                                    sizeInBytes, srcArrayBuffer, eventWaitList) {
        var nativeEvent = nativePeer.enqueueWriteBuffer(dstBufferObject.getPeer(),
                                                        blockingWrite,
                                                        dstOffset,
                                                        sizeInBytes,
                                                        srcArrayBuffer,
                                                        eventWaitList || []);
        return new WebCLEvent(nativeEvent);
      },
      enqueueReadBuffer : function(srcBufferObject, blockingRead, srcOffset, 
                                   sizeInBytes, dstArrayBuffer, eventWaitList) {
        var nativeEvent = nativePeer.enqueueReadBuffer(srcBufferObject.getPeer(),
                                                       blockingRead,
                                                       srcOffset,
                                                       sizeInBytes,
                                                       dstArrayBuffer,
                                                       eventWaitList || []);
        return new WebCLEvent(nativeEvent);
      },
      enqueueAcquireGLObjects : function(clBuffer) {
        //console.log("enqueueAcquireGLObjects: ", clBuffer.getGLBuffer());
      },
      enqueueReleaseGLObjects : function(clBuffer) {
        var tmpArrayBuffer = new Float32Array(clBuffer.getSize());
        nativePeer.enqueueReadBuffer(clBuffer.getPeer(),
                                     false, 0, 
                                     clBuffer.getSize(),
                                     tmpArrayBuffer, []);
        gl.bindBuffer(gl.ARRAY_BUFFER, clBuffer.getGLBuffer());
        gl.bufferData(gl.ARRAY_BUFFER, tmpArrayBuffer, gl.DYNAMIC_DRAW);
      },
      finish : function() {
        nativePeer.finish();
      },
      flush : function() {
        nativePeer.flush();
      }
    };
  }

  ////////////////////////////////////////////////////////////////////

  function WebCLMemoryObject(nativePeer, sizeInBytes, glPeer) {
    return {
      id : "WebCLMemoryObject " + numInstances++,
      getPeer : function() { 
        return nativePeer; 
      },
      getSize : function() {
        return sizeInBytes;
      },
      getGLBuffer : function() {
        return glPeer;
      },
      getMemObjectInfo : function(name) {
        return nativePeer.getMemObjectInfo(name);
      },
      getImageInfo : function(name) {
        return nativePeer.getImageInfo(name);
      }
    };
  }

  ////////////////////////////////////////////////////////////////////
  
  function WebCLSampler(nativePeer) {
    return {
      id : "WebCLSampler " + numInstances++,
      getPeer : function() { 
        return nativePeer; 
      },
      getSamplerInfo : function(name) {
        return nativePeer.getSamplerInfo(name);
      }
    };
  }

  ////////////////////////////////////////////////////////////////////

  function WebCLEvent(nativePeer) {
    return {
      id : "WebCLEvent " + numInstances++,
      getPeer : function() { 
        return nativePeer; 
      },
      getEventInfo : function(name) {
        return nativePeer.getEventInfo(name);
      },
      getEventProfilingInfo : function(name) {
        return nativePeer.getEventProfilingInfo(name);
      },
      setUserEventStatus : function(executionStatus) {
        nativePeer.setUserEventStatus(executionStatus);
      }
    };
  }

  ////////////////////////////////////////////////////////////////////

})();



/*******************************************************************
 *
 *                 T E S T   S U I T E
 *
 *****************************************************************/

(function(command) {

  "use strict";

  if (command === 'RUN') {

    var dummyKernel = "kernel void myDummyKernel() { float f = 0.0f; }";

    console.log("Initialization done");
    console.log("window.webCL: ", window.webCL);
    var cl = window.webCL;
    var plats = cl.getPlatforms();
    for (var p=0; p < plats.length; p++) {
      var plat = plats[p];

      // Context creation
      
      plat.name = plat.getPlatformInfo(cl.CL_PLATFORM_NAME);
      plat.dev = plat.getDevices(cl.CL_DEVICE_TYPE_ALL)[0];
      plat.ctx = cl.createContext([plat.dev], plat);
      console.log("Created context for platform", p, ": ", plat.name);

      // Kernel creation

      try {
        plat.ctx.prog = plat.ctx.createProgramWithSource(dummyKernel);
        plat.ctx.prog.buildProgram([plat.dev]);
        plat.ctx.kernel = plat.ctx.prog.createKernelsInProgram()[0];
        console.log(plat.ctx.prog.getProgramBuildInfo(plat.dev, cl.CL_PROGRAM_BUILD_LOG));
        console.log("Created kernel: ", plat.ctx.kernel.getKernelInfo(cl.CL_KERNEL_FUNCTION_NAME));
      } catch (e) {
        console.log("Kernel creation failed for platform", p, ": ", e);
      }
    }
  }
})(/* 'RUN' */);
