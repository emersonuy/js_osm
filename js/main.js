window.onload = main;

var map_data = null;
var xml_parser = null;
var xml_doc = null;

var canvas = null;
var tmp_canvas = null;
var ctx = null;
var tmp_ctx = null;
var ways = null;
var i = 0;
var bbox = null;
var zoom = 8;

var pixels_per_km = 0;

var latitude_height = 0.00956;
var longitude_width = 0.01187;

var minlat = 0;
var minlon = 0;
var maxlat = 0;
var maxlon = 0;

function main() {
	window.addEventListener("keyup", handle_key_up);
	document.getElementById('files').addEventListener('change', handleFileSelect, false);
	canvas = document.getElementById("main_canvas");

	tmp_canvas = document.createElement("canvas");

	getLocation(function(position) {
	    console.log("Latitude: " + position.coords.latitude +
	    " Longitude: " + position.coords.longitude);

	    minlat = position.coords.latitude - (latitude_height / 2);
	    minlon = position.coords.longitude - (longitude_width / 2);
	    maxlat = position.coords.latitude + (latitude_height / 2);
	    maxlon = position.coords.longitude + (longitude_width / 2);

	    getMap(minlat, minlon, maxlat, maxlon, function(map_data) {
	    	map_data = map_data;
			xml_parser = new DOMParser();
			xml_doc = xml_parser.parseFromString(map_data, "text/xml");

			render_map();
			window.requestAnimationFrame(handle_frame);
	    });
	});
}

function getLocation(callback) {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(callback);
    } else {
        console.log("Geolocation is not supported by this browser.");
    }
}

function getMap(minlat, minlon, maxlat, maxlon, callback) {
	var query = "node(" + minlat + "," + minlon + "," + maxlat + "," + maxlon + ");";
	query += "way(bn);( ._; >; );";
//	query += "(._;>;);";
	query += "out meta;";

	var xhttp = new XMLHttpRequest();

	var self = this;
	self.callback = callback;
	xhttp.onreadystatechange = function() {
		if (this.readyState == 4 && this.status == 200) {
			self.callback(this.responseText);
		}
	};

	console.log(query);

	xhttp.open("GET", "https://lz4.overpass-api.de/api/interpreter?data=" + query, true);
	xhttp.send();
}

function handle_key_up(e) {
	if (e.keyCode === 87) { // Up
		zoom--;
	}
	else if (e.keyCode === 83) { // Down
		zoom++;
	}

	if (zoom < 5) {
		zoom = 5;
	}

	if (zoom > 12) {
		zoom = 12;
	}

	if (map_data !== null) {
		console.log("zoom: " + zoom);
		i=0;
		render_map();
		window.requestAnimationFrame(handle_frame);
	}
}

function handle_frame() {
	var ret = loop();
	ret = loop();
	ret = loop();
	clear();
	flip();

	if (ret >= ways.length) {
		return;
	}

	window.requestAnimationFrame(handle_frame);
}

function loop() {
	if (i>= ways.length) {
		return i;
	}

		var nodes = ways[i].getElementsByTagName("nd");
		var tags = ways[i].getElementsByTagName("tag");

		var way_name = "";

		var is_highway = false;

		for (var j=0; j<tags.length; j++) {
			if (tags[j].getAttribute("k") === "name") {
				way_name = tags[j].getAttribute("v");
				break;
			}
		}

		for (var j=0; j<tags.length; j++) {
			if (tags[j].getAttribute("k") === "highway") {
				is_highway = true;
				break;
			}
		}

		var line_width = 2;
		if (is_highway === false) {
			line_width = 1;
		}

		var pt1 = null;
		var node_ref = null;
		var node = null;
		var lat = null;
		var lon = null;
		var xy1 = null;
		var xy2 = null;

		for (var j=0; j<nodes.length;) {
			node_ref = nodes[j].getAttribute("ref");
			// node = get_node(xml_doc.getElementsByTagName("node"), node_ref);

			node = xml_doc.getElementById(node_ref);

			lat = node.getAttribute("lat");
			lon = node.getAttribute("lon");

			xy1 = latlon_to_xy(lat, lon);

			if (++j < nodes.length) {
				node_ref = nodes[j].getAttribute("ref");
				node = xml_doc.getElementById(node_ref);//get_node(xml_doc.getElementsByTagName("node"), node_ref);
				lat = node.getAttribute("lat");
				lon = node.getAttribute("lon");

				xy2 = latlon_to_xy(lat, lon);
			}
			else {
				continue;
			}

			xy1.x = xy1.x - bbox.left;
			xy1.y = (bbox.top - xy1.y);

			xy2.x = xy2.x - bbox.left;
			xy2.y = (bbox.top - xy2.y);

			xy1.x *= pixels_per_km;
			xy1.y *= pixels_per_km;
			xy2.x *= pixels_per_km;
			xy2.y *= pixels_per_km;

			draw_line(xy1.x, xy1.y, xy2.x, xy2.y, line_width);
		}
	i++;

	return i;
}

function handleFileSelect(evt) {
	var files = evt.target.files; // FileList object

	for (var i = 0, f; f = files[i]; i++) {
		var reader = new FileReader();

		reader.onload = (function(theFile) {
			return function(e) {
				map_data = null;
				map_data = e.target.result;
				xml_parser = new DOMParser();
				xml_doc = xml_parser.parseFromString(map_data, "text/xml");

				render_map();
				window.requestAnimationFrame(handle_frame);
			}
		})(f);

		reader.readAsText(f);
	}
}

function get_node(nodes, ref) {
	for (var i=0; i<nodes.length; i++) {
		if (nodes[i].getAttribute("id") === ref) {
			return nodes[i];
		}
	}

	return null;
}

function render_map() {
	i=0;
	var mid_lat = 0;

	bbox = {left: 0, right: 0, top: 0, bottom: 0};

	bbox.left = latlon_to_xy(0, minlon).x;
	bbox.right = latlon_to_xy(0, maxlon).x;
	bbox.top = latlon_to_xy(maxlat, 0).y;
	bbox.bottom = latlon_to_xy(minlat, 0).y;

	mid_lat = (maxlat - minlat) / 2;
	mid_lat = (minlat - 0) + mid_lat;

	console.log(bbox.right - bbox.left);

	pixels_per_km = get_pixels_per_km(mid_lat, zoom);
	console.log("mid_lat: " + mid_lat + "   pixels_per_km: " + pixels_per_km);

	tmp_canvas.width = (bbox.right - bbox.left) * pixels_per_km;
	tmp_canvas.height = (bbox.top - bbox.bottom) * pixels_per_km;

	// canvas.width = window.innerWidth;
	// canvas.height = (tmp_canvas.height * canvas.width) / tmp_canvas.width;

	canvas.width = tmp_canvas.width;
	canvas.height = tmp_canvas.height;

	ctx = canvas.getContext("2d");

	tmp_ctx = tmp_canvas.getContext("2d");

	console.log(bbox);

	ways = xml_doc.getElementsByTagName("way");
}

function latlon_to_xy(lat, lon) {
	// var RAD2DEG = 180 / Math.PI;
	var PI_4 = Math.PI / 4;

	var x = (lon * Math.PI / 180) * 6371;
	var y = Math.log(Math.tan(PI_4 + (lat * Math.PI / 360))) * 6371;

	return {x: x, y: y, z: 0};
}

function draw_dot(x, y, radius) {
	tmp_ctx.beginPath();
	tmp_ctx.arc(x, y, radius, 0, 2 * Math.PI);
	tmp_ctx.fillStyle = "red";
	tmp_ctx.fill();
}

function draw_line(x1, y1, x2, y2, line_width) {
	tmp_ctx.beginPath();
	tmp_ctx.moveTo(x1, y1);
	tmp_ctx.lineTo(x2, y2);
	tmp_ctx.lineWidth=line_width;
	tmp_ctx.stroke();
}

function clear() {
	ctx.fillStyle = "white";
	ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function flip() {
//	ctx.drawImage(tmp_canvas, 0, 0, tmp_canvas.width, tmp_canvas.height, 0, 0, canvas.width, canvas.height);
	ctx.drawImage(tmp_canvas, 0, 0, tmp_canvas.width, tmp_canvas.height, 0, 0, canvas.width, canvas.height);
}

function get_pixels_per_km(lat, zoom) {
	return 156543.03392 * Math.cos(lat * Math.PI / 180) / Math.pow(2, zoom);
}
