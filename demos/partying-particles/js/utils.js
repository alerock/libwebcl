// --------------------------------------------------
/**
 * @brief Radians to degrees
 */
function rad(degrees) {
    return degrees * Math.PI / 180;
}


// --------------------------------------------------
/**
 * @brief Degrees to radians
 */
function deg(radians) {
    return radians / Math.PI * 180;
}

var dist2 = function(p, q) {
    return Math.sqrt(Math.pow(p[0] - q[0], 2) + Math.pow(p[1] - q[1], 2));
};


// --------------------------------------------------
/**
 * @brief Set an element in full screen
 */
function toggleFullScreen(elem) {
    if ((document.fullScreenElement && document.fullScreenElement !== null) || // alternative standard method
    (!document.mozFullScreen && !document.webkitIsFullScreen)) { // current working methods
        if (elem.requestFullScreen) {
            elem.requestFullScreen();
        }
        else if (elem.mozRequestFullScreen) {
            elem.mozRequestFullScreen();
        }
        else if (elem.webkitRequestFullScreen) {
            elem.webkitRequestFullScreen(Element.ALLOW_KEYBOARD_INPUT);
        }
    }
    else {
        if (document.cancelFullScreen) {
            document.cancelFullScreen();
        }
        else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
        }
        else if (document.webkitCancelFullScreen) {
            document.webkitCancelFullScreen();
        }
    }
}


// --------------------------------------------------
/**
 * @brief Toggle activation of a button
 */
function toggleButton(btn) {
    var unique = btn.isUnique;

    if (btn.activated && !unique) {
        btn.className = btn.originalClassName;
        btn.activated = false;
        return true;
    }
    else if (!btn.activated) {
        if (unique) {
            for (var i = 0; i < btn.uniqueItems.length; ++i) {
                btn.uniqueItems[i].className = btn.uniqueItems[i].originalClassName;
                btn.uniqueItems[i].activated = false;
            }
        }

        btn.className += " clicked";
        btn.activated = true;

        return true;
    }

    return false;
}