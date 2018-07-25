window.onload = main;

var map_data = "";
var xml_parser = null;
var xml_doc = null;

var canvas = null;
var tmp_canvas = null;
var ctx = null;
var tmp_ctx = null;

function main() {
	document.getElementById('files').addEventListener('change', handleFileSelect, false);
	canvas = document.getElementById("main_canvas");

	tmp_canvas = document.createElement("canvas");
	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;
	ctx = canvas.getContext("2d");
}

function handleFileSelect(evt) {
	var files = evt.target.files; // FileList object

	for (var i = 0, f; f = files[i]; i++) {
		var reader = new FileReader();

		reader.onload = (function(theFile) {
			return function(e) {
				map_data = e.target.result;
				render_map();
				flip();
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
	xml_parser = new DOMParser();
	xml_doc = xml_parser.parseFromString(map_data, "text/xml");

	var bounds = xml_doc.getElementsByTagName("bounds");
	var bbox = {left: 0, right: 0, top: 0, bottom: 0};

	for (var i=0; i<bounds.length; i++) {
		bbox.left = latlon_to_xy(0, bounds[i].getAttribute("minlon")).x;
		bbox.right = latlon_to_xy(0, bounds[i].getAttribute("maxlon")).x;
		bbox.top = latlon_to_xy(bounds[i].getAttribute("maxlat"), 0).y;
		bbox.bottom = latlon_to_xy(bounds[i].getAttribute("minlat"), 0).y;
	}

	tmp_canvas.width = bbox.right;
	tmp_canvas.height = bbox.top;

	tmp_ctx = tmp_canvas.getContext("2d");

	console.log(bbox);

	var ways = xml_doc.getElementsByTagName("way");

	for (var i=0; i<ways.length; i++) {
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

		if (is_highway === false) {
			continue;
		}

		console.log("way_name: " + way_name);

		var pt1 = null;
		var node_ref = null;
		var node = null;
		var lat = null;
		var lon = null;
		var xy1 = null;
		var xy2 = null;

		for (var j=0; j<nodes.length;) {
			node_ref = nodes[j].getAttribute("ref");
			node = get_node(xml_doc.getElementsByTagName("node"), node_ref);
			lat = node.getAttribute("lat");
			lon = node.getAttribute("lon");

			xy1 = latlon_to_xy(lat, lon);

			if (++j < nodes.length) {
				node_ref = nodes[j].getAttribute("ref");
				node = get_node(xml_doc.getElementsByTagName("node"), node_ref);
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

			xy1.x *= 1000;
			xy1.y *= 1000;
			xy2.x *= 1000;
			xy2.y *= 1000;

			draw_line(xy1.x, xy1.y, xy2.x, xy2.y);
		}
	}
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

function draw_line(x1, y1, x2, y2) {
	tmp_ctx.beginPath();
	tmp_ctx.moveTo(x1, y1);
	tmp_ctx.lineTo(x2, y2);
	tmp_ctx.lineWidth=3;
	tmp_ctx.stroke();
}

function flip() {
	ctx.drawImage(tmp_canvas, 0, 0, tmp_canvas.width, tmp_canvas.height);
}
