// the backdrop: a minecraft day running behind the page. one fullscreen quad, half resolution.
// scroll drives the time of day, so the top of the page is dawn and the bottom is night.
// deliberately not a soft abstract gradient: minecraft's clouds are flat rectangles and its sun is a
// square, so this draws them that way. that's the whole reason it reads as minecraft and not as wallpaper.
// falls back to a plain css gradient when there's no webgl, which is more common than you'd think on the
// laptops this crowd plays on.
(() => {
	const cv = document.getElementById("sky");
	if (!cv) return;

	const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
	const gl = cv.getContext("webgl", { antialias: false, alpha: false, powerPreference: "low-power" });
	if (!gl) {
		document.documentElement.classList.add("no-sky");
		return;
	}

	const vs = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0., 1.); }`;

	// d is the time of day, 0 dawn, .33 noon, .66 dusk, 1 night
	const fs = `precision mediump float;
uniform vec2 r; uniform float t; uniform float d;

float hash(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }

// the four skies we lerp between. dusk borrows the accent on purpose, it ties the page to the client
void sky(float d, out vec3 top, out vec3 low, out vec3 sun){
	vec3 t0 = vec3(0.169, 0.290, 0.478), l0 = vec3(0.910, 0.592, 0.416), s0 = vec3(1.000, 0.886, 0.729); // dawn
	vec3 t1 = vec3(0.290, 0.561, 0.878), l1 = vec3(0.659, 0.831, 0.961), s1 = vec3(1.000, 0.984, 0.918); // noon
	vec3 t2 = vec3(0.141, 0.227, 0.388), l2 = vec3(0.878, 0.439, 0.227), s2 = vec3(1.000, 0.690, 0.431); // dusk
	vec3 t3 = vec3(0.031, 0.047, 0.086), l3 = vec3(0.086, 0.125, 0.227), s3 = vec3(0.780, 0.831, 0.914); // night
	if (d < 0.33){ float k = d / 0.33;        top = mix(t0,t1,k); low = mix(l0,l1,k); sun = mix(s0,s1,k); }
	else if (d < 0.66){ float k = (d-0.33)/0.33; top = mix(t1,t2,k); low = mix(l1,l2,k); sun = mix(s1,s2,k); }
	else { float k = (d-0.66)/0.34;           top = mix(t2,t3,k); low = mix(l2,l3,k); sun = mix(s2,s3,k); }
}

void main(){
	vec2 uv = gl_FragCoord.xy / r;
	float a = r.x / r.y;

	vec3 top, low, sunCol;
	sky(d, top, low, sunCol);

	// vertical gradient, weighted low so the horizon glow sits in the bottom third
	float g = pow(clamp(uv.y, 0., 1.), 0.72);
	vec3 col = mix(low, top, g);

	// the sun arcs left to right and sets as the day runs out. square, like the real one
	vec2 sp = vec2(mix(0.12, 0.88, d) * a, 0.30 + 0.46 * sin(d * 3.14159));
	vec2 sd = abs(vec2(uv.x * a, uv.y) - sp);
	float disc = 1. - smoothstep(0.022, 0.030, max(sd.x, sd.y));
	float glow = exp(-dot(sd, sd) * 34.);
	col = mix(col, sunCol, clamp(disc + glow * 0.45, 0., 1.) * (1. - smoothstep(0.80, 1.0, d)));

	// clouds: a band of flat cells drifting sideways, hard edges, no softness anywhere
	float band = smoothstep(0.52, 0.60, uv.y) * (1. - smoothstep(0.78, 0.92, uv.y));
	vec2 cell = floor(vec2(uv.x * a * 15. + t * 0.10, uv.y * 46.));
	float puff = step(0.63, hash(cell)) * step(0.45, hash(cell * 0.5 + 3.1));
	col = mix(col, mix(vec3(1.0), low, 0.18), puff * band * 0.55 * (1. - smoothstep(0.72, 1.0, d)));

	// stars, only once it's properly dark
	float night = smoothstep(0.70, 0.97, d);
	float star = step(0.9972, hash(floor(uv * r / 2.4))) * night * (0.55 + 0.45 * sin(t * 2. + hash(floor(uv * 40.)) * 30.));
	col += star;

	// dither, otherwise the gradient bands badly on 8 bit panels
	col += (hash(gl_FragCoord.xy + floor(t * 7.)) - 0.5) * 0.016;

	gl_FragColor = vec4(col, 1.);
}`;

	const compile = (type, src) => {
		const s = gl.createShader(type);
		gl.shaderSource(s, src);
		gl.compileShader(s);
		return s;
	};
	const prog = gl.createProgram();
	gl.attachShader(prog, compile(gl.VERTEX_SHADER, vs));
	gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fs));
	gl.linkProgram(prog);
	if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
		document.documentElement.classList.add("no-sky");
		return;
	}
	gl.useProgram(prog);

	const buf = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, buf);
	// one oversized triangle, cheaper than two triangles and no seam down the middle
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
	const p = gl.getAttribLocation(prog, "p");
	gl.enableVertexAttribArray(p);
	gl.vertexAttribPointer(p, 2, gl.FLOAT, false, 0, 0);

	const uR = gl.getUniformLocation(prog, "r");
	const uT = gl.getUniformLocation(prog, "t");
	const uD = gl.getUniformLocation(prog, "d");

	let day = 0, shown = 0;

	function size() {
		// half resolution and capped at 1.5x dpr. nobody can tell, and it keeps weak gpus out of trouble
		const s = Math.min(window.devicePixelRatio || 1, 1.5) * 0.5;
		cv.width = Math.max(2, Math.round(innerWidth * s));
		cv.height = Math.max(2, Math.round(innerHeight * s));
		gl.viewport(0, 0, cv.width, cv.height);
		gl.uniform2f(uR, cv.width, cv.height);
	}
	addEventListener("resize", size, { passive: true });
	size();

	const t0 = performance.now();
	function frame(now) {
		// ease toward the scroll's time of day rather than snapping, so flicking the wheel doesn't strobe
		shown += (day - shown) * 0.06;
		gl.uniform1f(uT, reduce ? 0 : (now - t0) / 1000);
		gl.uniform1f(uD, shown);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
		requestAnimationFrame(frame);
	}
	requestAnimationFrame(frame);

	// app.js drives this from scroll position
	window.Sky = { set: (v) => { day = Math.max(0, Math.min(1, v)); } };
})();
