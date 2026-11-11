// the choreography. two ideas carry the page:
//   1. the menu demonstrates itself, then hands the visitor the controls
//   2. the blacklist is shown happening to you rather than described in a paragraph
// gsap is just the engine, every sequence below is ours.
gsap.registerPlugin(ScrollTrigger);

const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = (s) => document.querySelector(s);

// ---------- sky follows the scroll ----------

// whole document maps to one day. top is dawn, bottom is night
ScrollTrigger.create({
	trigger: document.body,
	start: "top top",
	end: "bottom bottom",
	onUpdate: (self) => window.Sky && window.Sky.set(self.progress),
});

const nav = document.querySelector("nav");
addEventListener("scroll", () => nav.classList.toggle("stuck", scrollY > 8), { passive: true });

// ---------- the hero demonstrates itself ----------

const stage = $("#stage"), ghost = $("#ghost"), tap = $("#tap");
const rows = [...document.querySelectorAll(".mod")];

// where a row's switch sits, relative to the stage, so the cursor can aim at it
function at(el) {
	const a = el.getBoundingClientRect(), b = stage.getBoundingClientRect();
	return { x: a.left - b.left + a.width / 2, y: a.top - b.top + a.height / 2 };
}

function press(row, on) {
	const sw = row.querySelector(".sw");
	const p = at(sw);
	const tl = gsap.timeline();
	tl.to(ghost, { x: p.x, y: p.y, duration: 0.55, ease: "power2.inOut" })
		.set(tap, { x: p.x, y: p.y })
		.to(tap, { opacity: 1, scale: 0.4, duration: 0.01 })
		.to(ghost, { scale: 0.86, duration: 0.07, yoyo: true, repeat: 1 })
		.add(() => { sw.checked = on; }, "-=0.07")
		.to(tap, { opacity: 0, scale: 1.5, duration: 0.42, ease: "power2.out" }, "<");
	return tl;
}

if (!reduce) {
	// start with the two the demo is about to turn on actually off
	rows[0].querySelector(".sw").checked = false;
	rows[1].querySelector(".sw").checked = false;

	const intro = gsap.timeline({ delay: 0.35 });
	intro.from(".hero h1", { y: 16, opacity: 0, duration: 0.6, ease: "power3.out" })
		.from(".hero .lede", { y: 14, opacity: 0, duration: 0.55, ease: "power3.out" }, "-=0.42")
		.from(".hero .btns", { y: 12, opacity: 0, duration: 0.5, ease: "power3.out" }, "-=0.38")
		.from("#menu", { y: 26, opacity: 0, scale: 0.985, duration: 0.7, ease: "power3.out" }, "-=0.45")
		.from(".mod", { y: 10, opacity: 0, duration: 0.4, stagger: 0.06, ease: "power2.out" }, "-=0.35")
		// the cursor arrives and gets to work
		.set(ghost, { x: 40, y: 150 })
		.to(ghost, { opacity: 1, duration: 0.3 })
		.add(press(rows[0], true))
		// turning Keystrokes on makes the keystroke widget appear, same as it would in game
		.to("#w-keys", { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" }, "-=0.2")
		.add(press(rows[1], true))
		.to("#w-cps", { opacity: 1, duration: 0.4, ease: "power2.out" }, "-=0.2")
		// then it steps aside and the page belongs to the visitor
		.to(ghost, { opacity: 0, duration: 0.4 }, "+=0.35");

	// the lit key cycles so the widget looks alive rather than frozen. only WASD, the mouse row and the
	// jump bar keep their own rhythm below
	const keys = [...document.querySelectorAll("#w-keys .k")];
	let k = 0;
	setInterval(() => {
		keys.forEach((n) => n.classList.remove("lit"));
		keys[k = (k + 1) % keys.length].classList.add("lit");
	}, 620);

	// a left click every so often, and a jump now and then. deliberately not at a real 7cps, that would
	// strobe in the corner of the hero and pull your eye off the menu
	const lmb = document.querySelector("#w-keys .lmb"), jump = document.querySelector("#w-keys .jump");
	setInterval(() => {
		lmb.classList.add("lit");
		setTimeout(() => lmb.classList.remove("lit"), 110);
	}, 900);
	setInterval(() => {
		jump.classList.add("lit");
		setTimeout(() => jump.classList.remove("lit"), 180);
	}, 2400);
} else {
	gsap.set(["#w-keys", "#w-cps"], { opacity: 1 });
}

// ---------- the blacklist, scrubbed ----------

// the sequence is pinned and tied to scroll, so you drive it. three beats:
// you join, the toast lands, the two modules the server disallows go dead.
const beat = $("#beat");
const lines = [
	"Some servers don't allow certain modules. Shrike reads a public list and turns those off when you join.",
	"You join <b>FunTime</b>. Shrike checks the list for that server.",
	"Two of your modules aren't allowed there. They're switched off and told you why.",
	"Your config is untouched. Leave, and they come back exactly as you had them.",
];

if (!reduce) {
	const blocked = rows.filter((r) => ["cooldown_hud", "auto_gg"].includes(r.dataset.id));
	let said = -1;

	const tl = gsap.timeline({
		scrollTrigger: {
			trigger: "#blacklist",
			start: "top top",
			end: "+=220%",
			pin: "#pin",
			scrub: 0.6,
		},
	});

	tl.add(() => say(1))
		.fromTo("#toast", { opacity: 0, x: 26 }, { opacity: 1, x: 0, duration: 0.6, ease: "power2.out" })
		.add(() => say(2))
		.to(blocked, { duration: 0.5, onStart: mark(true), onReverseComplete: mark(false) })
		.to({}, { duration: 0.5 })
		.add(() => say(3))
		.to("#toast", { opacity: 0, duration: 0.4 }, "+=0.3");

	function mark(on) {
		return () => blocked.forEach((r) => r.classList.toggle("blocked", on));
	}
	function say(i) {
		if (said === i) return;
		said = i;
		gsap.fromTo(beat, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.35, ease: "power2.out", onStart: () => (beat.innerHTML = lines[i]) });
	}
} else {
	beat.innerHTML = lines[3];
	gsap.set("#toast", { opacity: 1 });
}
