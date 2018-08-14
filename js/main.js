window.onload = main;

var map_data = null;
var xml_parser = null;
var xml_doc = null;

var map_config = {
	boundary: {minlat: 0, maxlat: 0, minlon: 0, maxlon: 0},
	bbox: {left: 0, right: 0, top: 0, bottom: 0},
	pixels_per_km: 0,
	main_canvas: null,
	sub_canvas: null,
	zoom: 0,
	render_index: 0
};

var zoom = 7;

var latitude_height = 0.01187;
var longitude_width = 0.00956;

var curr_lat = 0;
var curr_lon = 0;
var curr_xy = 0;

var timer = 0;

function main() {
	getLocation(function(position) {
	    console.log("Latitude: " + position.coords.latitude + " Longitude: " + position.coords.longitude);

	    curr_lat = position.coords.latitude;
	    curr_lon = position.coords.longitude;

	    var boundary = {};

	    boundary.minlat = position.coords.latitude - (latitude_height / 2);
	    boundary.minlon = position.coords.longitude - (longitude_width / 2);
	    boundary.maxlat = position.coords.latitude + (latitude_height / 2);
	    boundary.maxlon = position.coords.longitude + (longitude_width / 2);

	    getMap(boundary, function(map_data) {
			xml_parser = new DOMParser();
			xml_doc = xml_parser.parseFromString(map_data, "text/xml");

			map_config = start_render(xml_doc, boundary, zoom);
			window.requestAnimationFrame(handle_frame);
	    });
	});
}

function handle_timeout() {
	getLocation(function(position) {
	    curr_lat = position.coords.latitude;
	    curr_lon = position.coords.longitude;

		curr_xy = latlon_to_xy(curr_lat, curr_lon);
		curr_xy.x = curr_xy.x - (map_config.bbox.left);
		curr_xy.y = (map_config.bbox.top - curr_xy.y);

		curr_xy.x *= map_config.pixels_per_km;
		curr_xy.y *= map_config.pixels_per_km;

		clear();
		flip();
		draw_current_position();

	    var new_boundary = {};

	    new_boundary.minlat = position.coords.latitude - (latitude_height / 2);
	    new_boundary.minlon = position.coords.longitude - (longitude_width / 2);
	    new_boundary.maxlat = position.coords.latitude + (latitude_height / 2);
	    new_boundary.maxlon = position.coords.longitude + (longitude_width / 2);

		if (is_need_fetch_new_map(new_boundary, map_config.boundary) === true) {
			console.log("updating map");
		    getMap(new_boundary, function(map_data) {
				xml_parser = new DOMParser();
				xml_doc = xml_parser.parseFromString(map_data, "text/xml");

				map_config = start_render(xml_doc, boundary, zoom);
				window.requestAnimationFrame(handle_frame);
		    });
		}
		else {
			console.log("no need update");
		}
	});
}

function is_need_fetch_new_map(new_boundary, current_boundary) {
	var is_need = false;

	var diff_minlon = Math.abs(new_boundary.minlon - current_boundary.minlon);
	var diff_maxlon = Math.abs(new_boundary.maxlon - current_boundary.maxlon);
	var diff_minlat = Math.abs(new_boundary.minlat - current_boundary.minlat);
	var diff_maxlat = Math.abs(new_boundary.maxlat - current_boundary.maxlat);

	var lat_threshold = latitude_height * 0.1;
	var lon_threshold = longitude_width * 0.1;

	if (diff_minlon >= lon_threshold || diff_maxlon >= lon_threshold ||
		diff_minlat >= lat_threshold || diff_maxlat >= lat_threshold) {
		is_need = true;
	}

	return is_need;
}

function getLocation(callback) {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(callback);
    } else {
        console.log("Geolocation is not supported by this browser.");
    }
}

function getMap(boundary, callback) {
	var query = "node(" + boundary.minlat + "," + boundary.minlon + "," + boundary.maxlat + "," + boundary.maxlon + ");";
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

var total_elapsed = 0;
var time_limit = 500;
var curr_time = 0;
var last_time = 0;

function handle_frame() {
	curr_time = new Date().getTime();
	last_time = curr_time;
	total_elapsed = 0;

	while (total_elapsed < time_limit) {
		render_map(map_config.render_index, map_config.ways, map_config.bbox, map_config.pixels_per_km);
		map_config.render_index++;

		curr_time = new Date().getTime();
		total_elapsed += (curr_time - last_time);
		last_time = curr_time;
	}

	if (map_config.render_index >= map_config.ways.length) {
		clear();
		flip();
		draw_current_position();

		return;
	}

	window.requestAnimationFrame(handle_frame);
}

function start_render(xml_doc, boundary, zoom) {
	var map_lat_width = (boundary.maxlat - boundary.minlat);

	var config = {};

	config.pixels_per_km = get_pixels_per_km(map_lat_width, zoom);;

	config.boundary = boundary;
	config.bbox = {};
	config.bbox.left = latlon_to_xy(0, boundary.minlon).x;;
	config.bbox.right = latlon_to_xy(0, boundary.maxlon).x;
	config.bbox.top = latlon_to_xy(boundary.maxlat, 0).y;
	config.bbox.bottom = latlon_to_xy(boundary.minlat, 0).y;

	config.main_canvas = document.getElementById("main_canvas");
	config.sub_canvas = document.createElement("canvas");

	config.sub_canvas.width = (config.bbox.right - config.bbox.left) * config.pixels_per_km;
	config.sub_canvas.height = (config.bbox.top - config.bbox.bottom) * config.pixels_per_km;

	config.main_canvas.width = window.innerWidth;
	config.main_canvas.height = window.innerHeight;

	console.log(config.main_canvas.width + ", " + config.main_canvas.height + "  --  " + config.sub_canvas.width + ", " + config.sub_canvas.height);

	config.main_ctx = config.main_canvas.getContext("2d");
	config.sub_ctx = config.sub_canvas.getContext("2d");

	config.ways = xml_doc.getElementsByTagName("way");

	config.render_index = 0;

	curr_xy = latlon_to_xy(curr_lat, curr_lon);
	curr_xy.x = curr_xy.x - (config.bbox.left);
	curr_xy.y = (config.bbox.top - curr_xy.y);

	curr_xy.x *= config.pixels_per_km;
	curr_xy.y *= config.pixels_per_km;

	timer = setInterval(handle_timeout, 1000);

	return config;
}

function render_map(i, ways, bbox, pixels_per_km) {
	if (i >= ways.length) {
		return;
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

		node = xml_doc.getElementById(node_ref);

		lat = node.getAttribute("lat");
		lon = node.getAttribute("lon");

		xy1 = latlon_to_xy(lat, lon);

		if (++j < nodes.length) {
			node_ref = nodes[j].getAttribute("ref");
			node = xml_doc.getElementById(node_ref);
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
}

function latlon_to_xy(lat, lon) {
	var PI_4 = Math.PI / 4;

	var x = (lon * Math.PI / 180) * 6371;
	var y = Math.log(Math.tan(PI_4 + (lat * Math.PI / 360))) * 6371;

	return {x: x, y: y, z: 0};
}

function get_pixels_per_km(lat, zoom) {
	return 156543.03392 * Math.cos(lat * Math.PI / 180) / Math.pow(2, zoom);
}

function draw_current_position() {
	draw_dot(curr_xy.x, curr_xy.y, 5);
}

function draw_dot(x, y, radius) {
	var x1 = curr_xy.x - (map_config.main_canvas.width / 2);
	var y1 = curr_xy.y - (map_config.main_canvas.height / 2);

	x -= x1;
	y -= y1;

	map_config.main_ctx.beginPath();
	map_config.main_ctx.arc(x, y, radius, 0, 2 * Math.PI);
	map_config.main_ctx.fillStyle = "red";
	map_config.main_ctx.fill();
}

function draw_line(x1, y1, x2, y2, line_width) {
	map_config.sub_ctx.beginPath();
	map_config.sub_ctx.moveTo(x1, y1);
	map_config.sub_ctx.lineTo(x2, y2);
	map_config.sub_ctx.lineWidth=line_width;
	map_config.sub_ctx.stroke();
}

function clear() {
	map_config.main_ctx.fillStyle = "white";
	map_config.main_ctx.fillRect(0, 0, main_canvas.width, main_canvas.height);
}

function flip() {
	var x = curr_xy.x - (map_config.main_canvas.width / 2);
	var y = curr_xy.y - (map_config.main_canvas.height / 2);

	map_config.main_ctx.drawImage(map_config.sub_canvas,
		x, y, map_config.main_canvas.width, map_config.main_canvas.height,
		0, 0, map_config.main_canvas.width, map_config.main_canvas.height);
}
