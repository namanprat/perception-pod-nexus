import { t as __exportAll } from "./rolldown-runtime_D7D4PA-g.mjs";
import { checkBotId } from "botid/server";
//#region src/pages/api/contact.ts
var contact_exports = /* @__PURE__ */ __exportAll({
	POST: () => POST,
	prerender: () => false
});
var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
var MAX_NAME = 200;
var MAX_MESSAGE = 5e3;
var MAX_SERVICES = 20;
function json(body, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" }
	});
}
function asString(value) {
	return typeof value === "string" ? value.trim() : "";
}
function sanitize(text, max) {
	return text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").slice(0, max);
}
var POST = async ({ request }) => {
	if ((await checkBotId()).isBot) return json({
		ok: false,
		error: "Access denied"
	}, 403);
	let formData;
	try {
		formData = await request.formData();
	} catch {
		return json({
			ok: false,
			error: "Invalid form data"
		}, 400);
	}
	sanitize(asString(formData.get("name")), MAX_NAME);
	const email = sanitize(asString(formData.get("email")), 320);
	sanitize(asString(formData.get("message")), MAX_MESSAGE);
	formData.getAll("service").filter((v) => typeof v === "string").map((v) => sanitize(v, 64)).filter(Boolean).slice(0, MAX_SERVICES);
	if (!email || !EMAIL_RE.test(email)) return json({
		ok: false,
		error: "A valid email is required"
	}, 400);
	console.error("Contact API missing RESEND_API_KEY or CONTACT_TO_EMAIL");
	return json({
		ok: false,
		error: "Contact form is not configured"
	}, 500);
};
//#endregion
//#region \0virtual:astro:page:src/pages/api/contact@_@ts
var page = () => contact_exports;
//#endregion
export { page };
