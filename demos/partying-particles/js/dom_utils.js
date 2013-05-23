var Dom = {};


Dom.id = function(i){return document.getElementById(i);};

Dom.c = function(t, s){var o = document.createElement(t); Dom.s(o, s); return o;};

Dom.s = function(dom, s){
    if (s !== undefined)
        for (var t in s){
            if (s.hasOwnProperty(t)){
                dom.style[t] = s[t];
            }
        }
};

Dom.o = function(type, obj){
    var offset = obj["offset" + type];
    var ref = obj.offsetParent;
    while (ref !== null){
        offset += ref["offset" + type];
        ref = ref.offsetParent;        
    }
    return offset;
};

Dom.oTop = function(obj){
    return Dom.o("Top", obj);
};


Dom.oBot = function(obj){
    return Dom.o("Bottom", obj);
};

Dom.oLeft = function(obj){
    return Dom.o("Left", obj);
};

Dom.oRight = function(obj){
    return Dom.o("Right", obj);
};

Dom.ajax = function(fname){
    xhr = new XMLHttpRequest();
    xhr.open("GET", fname, false);
    xhr.overrideMimeType("text/plain");
    xhr.send();
    if (xhr.readyState == 4){
        return xhr.responseText;
    } else {
        alert(" Unable to get " + fname);
        return "";  
    }
};