$(document).ready(function(){
    $("#otherThings").hide();
    
    var width=800,height=600,hidecontrols=false;
    
    if(window.location.hash){
      var ass = window.location.hash.substr(1).split("&");
      for(var i=0; i<ass.length; i++){
	var varAndVal = ass[i].split("=");
	switch(varAndVal[0]){
	case "w":
	  width=parseInt(varAndVal[1]);
	  break;
	case "h":
	  height=parseInt(varAndVal[1]);
	  break;
	case "hidecontrols":
	  hidecontrols = parseInt(varAndVal[1]);
	  break;
	}
      }
    }

    $("#theCanvas").attr("width",width);
    $("#theCanvas").attr("height",height);

    var c = new Cheese("theCanvas",{
	clerror:function(){
	  $("#webclRadio_webcl").attr("disabled",true);
	},
	success:function(){
	  $("#errormessage").hide();
	  $("#otherThings").show();
	}
      });

    $("#drawNodesCB").change(function(){
	c.DRAW_NODES = ($(this).attr("checked")!=undefined);
      });

    $("#drawLinesCB").change(function(){
	c.DRAW_SPRINGS = ($(this).attr("checked")!=undefined);
      });

    $(".webclRadio").change(function(){
	c.WEBCL = ($(this).attr("value")=="webcl");
      });

    $("#kSlider").change(function(){
	c.KS = $(this).val();
	$("#K").html(c.KS);
      });

    $("#gSlider").change(function(){
	c.G = [0, $(this).val(), 0];
	$("#G").html(c.G[1]);
      });

    $("#mSlider").change(function(){
	var m = $(this).val();
	c.setAllMasses(m);
	$("#M").html(m);
      });

    $("#kdSlider").change(function(){
	c.KD = $(this).val();
	$("#KD").html(parseInt(c.KD*100)/100);
      });

    var changeSize = function(){
      c.clear();
      var cols = parseInt($("#nxSlider").val());
      var rows = parseInt($("#nySlider").val());
      var l = parseInt($("#lSlider").val());
      c.standardScene(cols,rows,l);
      $("#NX").html("Rows: " + cols);
      $("#NY").html("Columns: " + rows);
      $("#L").html("Rest length: " + l);
    }

    $("#nxSlider").change(changeSize);
    $("#nySlider").change(changeSize);
    $("#lSlider").change(changeSize);


    var keys = {BACKSPACE: 8,
		TAB: 9,
		ENTER: 13,
		SHIFT: 16,
		CTRL: 17,
		ALT: 18,
		PAUSE: 19,
		CAPS: 20,
		ESCAPE: 27,
		PAGEUP: 33,
		PAGEDOWN: 34,
		END: 35,
		HOME: 36,
		LEFT: 37,
		UP: 38,
		RIGHT: 39,
		DOWN: 40,
		INSERT: 45,
		DELETE: 46};
    $(window).keydown(function(e){
	var changed = false;
	switch(e.keyCode){
	case keys.UP:
	  $("#nxSlider").val(parseInt($("#nxSlider").val())+1);
	  changed = true;
	  break;
	case keys.DOWN:
	  $("#nxSlider").val(parseInt($("#nxSlider").val())-1);
	  changed = true;
	  break;
	case keys.RIGHT:
	  $("#nySlider").val(parseInt($("#nySlider").val())+1);
	  changed = true;
	  break;
	case keys.LEFT:
	  $("#nySlider").val(parseInt($("#nySlider").val())-1);
	  changed = true;
	  break;
	}
	
	if(changed)
	  $("input").trigger('change');
      });

    if(hidecontrols){
      console.log("hiding...");
      $("#otherThings, #fb-root, .fb-like").hide();
    }

    $("input").trigger('change');

  });