"""
What the Modern ERP UI needs to run Desk form scripts outside Desk.

ERPNext (and any other installed app) ships form behaviour as JavaScript: custom buttons,
link queries and field triggers. The Vue form runs those same scripts, so it needs the
script bundles the installed apps register through the `app_include_js` hook.
"""

import frappe
import frappe.sessions
from frappe.utils.jinja_globals import bundled_asset


@frappe.whitelist()
def get_boot() -> dict:
	"""The session user's own boot data, the same payload Desk embeds in its page."""
	return frappe.sessions.get()


@frappe.whitelist()
def get_form_script_bundles() -> list[str]:
	"""URLs of each app's Desk bundles, excluding Frappe's own Desk UI (the Vue app replaces it)."""
	urls = []
	for include in frappe.get_hooks("app_include_js"):
		url = bundled_asset(include)
		if url.startswith("/assets/frappe/"):
			continue
		urls.append(url)
	return urls


@frappe.whitelist()
def get_csrf_token() -> str:
	"""The session's CSRF token. Frappe enforces it once a session has one, for example after Desk was opened."""
	return frappe.sessions.get_csrf_token()
