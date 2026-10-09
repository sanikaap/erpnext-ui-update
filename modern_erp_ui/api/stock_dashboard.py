"""
Stock dashboard figures for the Modern ERP UI.

One read-only endpoint returning every section of the Stock overview. All queries go
through `frappe.get_list`, so the caller's role permissions and User Permissions
(Company, Warehouse, Item…) apply exactly as they do in Desk. Each section is computed
independently: a section the user cannot read comes back as {"error": "permission"}
instead of failing the whole response.

Definitions
- Stock value: sum of `Bin.stock_value` over the company's warehouses. Bin is maintained
  by ERPNext from the Stock Ledger and matches the Stock Balance report.
- Stock items: enabled Items with "Maintain Stock" set.
- Low stock: an Item Reorder row (Item › Auto Re-order) whose warehouse's actual quantity
  is at or below the reorder level. Items without a reorder level are never "low"; there
  is no reliable threshold for them. `replenishing` says whether open requests/orders
  already lift the projected quantity back above the level.
- Pending stock entries: draft (docstatus 0) Stock Entries of the company.
- Stock value trend: running total of `Stock Ledger Entry.stock_value_difference`
  (cancelled entries excluded) at the end of each day (period "30d") or week ("12w",
  "26w", "52w"). This is the historical stock value ERPNext's ledger records.
- "30 days ago" comparisons: stock value from the same ledger running total; stock items
  from Item creation dates (items disabled since then are not tracked historically).
- Recent activity: the latest stock vouchers by posting date, from the Stock Ledger.
"""

from collections import OrderedDict

import frappe
from frappe import _
from frappe.utils import add_days, cint, flt, get_datetime, getdate, today

MAX_WEEKS = 52
PERIODS = {"30d": (1, 30), "12w": (7, 12), "26w": (7, 26), "52w": (7, 52)}  # bucket days, buckets
ACTIVITY_LIMIT = 8
TOP_ITEMS = 6
PARTY_FIELDS = {
	"Purchase Receipt": "supplier", "Purchase Invoice": "supplier",
	"Delivery Note": "customer", "Sales Invoice": "customer",
	"Stock Entry": "stock_entry_type", "Stock Reconciliation": "purpose",
}


def _section(compute):
	try:
		return {"data": compute(), "error": None}
	except frappe.PermissionError:
		frappe.clear_last_message()
		return {"data": None, "error": "permission"}
	except Exception:
		frappe.log_error(title="Stock dashboard section failed")
		return {"data": None, "error": "failed"}


def _company(company):
	company = company or frappe.defaults.get_user_default("Company") or frappe.db.get_single_value("Global Defaults", "default_company")
	if not company or not frappe.db.exists("Company", company):
		frappe.throw(_("Select a valid company."), frappe.ValidationError)
	return company


@frappe.whitelist()
def get_stock_overview(company: str | None = None, weeks: int | str = 26, period: str | None = None):
	company = _company(company)
	if period and period not in PERIODS:
		frappe.throw(_("Unknown period {0}.").format(period), frappe.ValidationError)
	weeks = min(max(cint(weeks) or 26, 4), MAX_WEEKS)
	step, buckets = PERIODS[period] if period else (7, weeks)
	month_ago = add_days(today(), -30)
	warehouses = frappe.get_all("Warehouse", filters={"company": company, "is_group": 0}, pluck="name")

	def bins(fields, **kwargs):
		if not warehouses:
			return []
		return frappe.get_list("Bin", filters={"warehouse": ["in", warehouses], **kwargs.pop("filters", {})}, fields=fields, limit_page_length=0, **kwargs)

	def ledger_value_on(date):
		rows = frappe.get_list("Stock Ledger Entry", filters={"company": company, "is_cancelled": 0, "posting_date": ["<=", date]}, fields=[{"SUM": "stock_value_difference", "as": "value"}])
		return round(flt(rows[0].value) if rows else 0.0, 2)

	def stock_value():
		rows = bins([{"SUM": "stock_value", "as": "value"}])
		return {"value": flt(rows[0].value) if rows else 0.0, "value_30d_ago": ledger_value_on(month_ago)}

	def stock_items():
		def count(**extra):
			rows = frappe.get_list("Item", filters={"disabled": 0, "is_stock_item": 1, **extra}, fields=[{"COUNT": "*", "as": "count"}])
			return cint(rows[0].count) if rows else 0
		return {"value": count(), "value_30d_ago": count(creation=["<", f"{month_ago} 00:00:00"])}

	def pending_entries():
		rows = frappe.get_list("Stock Entry", filters={"docstatus": 0, "company": company}, fields=[{"COUNT": "*", "as": "count"}])
		return cint(rows[0].count) if rows else 0

	def low_stock():
		if not frappe.has_permission("Item", "read"):
			raise frappe.PermissionError
		reorder = frappe.get_all(
			"Item Reorder", filters={"parenttype": "Item", "warehouse": ["in", warehouses or [""]], "warehouse_reorder_level": [">", 0]},
			fields=["parent as item_code", "warehouse", "warehouse_reorder_level as reorder_level", "warehouse_reorder_qty as reorder_qty", "material_request_type"],
		)
		if not reorder:
			return {"items": [], "configured": 0}
		codes = list({row.item_code for row in reorder})
		# Items the user may read (User Permissions on Item / Item Group apply here).
		items = {row.name: row for row in frappe.get_list("Item", filters={"name": ["in", codes], "disabled": 0}, fields=["name", "item_name", "stock_uom"], limit_page_length=0)}
		levels = {(row.item_code, row.warehouse): row for row in bins(["item_code", "warehouse", "actual_qty", "projected_qty"], filters={"item_code": ["in", codes]})}
		alerts = []
		for row in reorder:
			if row.item_code not in items:
				continue
			stock = levels.get((row.item_code, row.warehouse))
			actual = flt(stock.actual_qty) if stock else 0.0
			projected = flt(stock.projected_qty) if stock else 0.0
			if actual > flt(row.reorder_level):
				continue
			alerts.append({
				"item_code": row.item_code, "item_name": items[row.item_code].item_name, "uom": items[row.item_code].stock_uom,
				"warehouse": row.warehouse, "actual_qty": actual, "projected_qty": projected,
				"reorder_level": flt(row.reorder_level), "reorder_qty": flt(row.reorder_qty),
				"status": "out" if actual <= 0 else "low", "replenishing": projected > flt(row.reorder_level),
			})
		alerts.sort(key=lambda alert: (alert["actual_qty"] / alert["reorder_level"] if alert["reorder_level"] else 0, alert["item_code"]))
		return {"items": alerts, "configured": len(reorder)}

	def top_items():
		rows = bins(["item_code", {"SUM": "stock_value", "as": "value"}, {"SUM": "actual_qty", "as": "qty"}], group_by="item_code")
		rows = sorted((row for row in rows if flt(row.value) > 0), key=lambda row: flt(row.value), reverse=True)[:TOP_ITEMS]
		names = {}
		if rows:
			names = {row.name: row for row in frappe.get_list("Item", filters={"name": ["in", [row.item_code for row in rows]]}, fields=["name", "item_name", "stock_uom", "item_group"], limit_page_length=0)}
		return [{
			"item_code": row.item_code, "item_name": names.get(row.item_code, {}).get("item_name") or row.item_code,
			"item_group": names.get(row.item_code, {}).get("item_group"), "uom": names.get(row.item_code, {}).get("stock_uom"),
			"qty": flt(row.qty), "value": flt(row.value),
		} for row in rows]

	def trend():
		end = getdate(today())
		# Buckets end on `end` and every `step` days before it.
		ends = [add_days(end, -step * (buckets - 1 - index)) for index in range(buckets)]
		start = add_days(ends[0], -(step - 1))
		base = {"company": company, "is_cancelled": 0}
		opening = frappe.get_list("Stock Ledger Entry", filters={**base, "posting_date": ["<", start]}, fields=[{"SUM": "stock_value_difference", "as": "value"}])
		running = flt(opening[0].value) if opening else 0.0
		daily = frappe.get_list(
			"Stock Ledger Entry", filters={**base, "posting_date": ["between", [start, end]]},
			fields=["posting_date", {"SUM": "stock_value_difference", "as": "value"}], group_by="posting_date", order_by="posting_date asc", limit_page_length=0,
		)
		points, position = [], 0
		days = sorted(((getdate(row.posting_date), flt(row.value)) for row in daily), key=lambda pair: pair[0])
		for week_end in ends:
			while position < len(days) and days[position][0] <= getdate(week_end):
				running += days[position][1]
				position += 1
			points.append({"date": str(week_end), "value": round(running, 2)})
		return {"points": points, "movement_days": len(days), "opening_value": round(flt(opening[0].value) if opening else 0.0, 2), "bucket": "day" if step == 1 else "week"}

	def activity():
		recent = frappe.get_list(
			"Stock Ledger Entry", filters={"company": company, "is_cancelled": 0},
			fields=["voucher_type", "voucher_no", "posting_date", "posting_time"],
			order_by="posting_date desc, posting_time desc, creation desc", limit_page_length=ACTIVITY_LIMIT * 25,
		)
		vouchers = OrderedDict()
		for row in recent:
			key = (row.voucher_type, row.voucher_no)
			if key in vouchers:
				continue
			if len(vouchers) == ACTIVITY_LIMIT:
				break
			vouchers[key] = {"voucher_type": row.voucher_type, "voucher_no": row.voucher_no, "posting_date": str(row.posting_date), "posting_time": str(row.posting_time), "qty_in": 0.0, "qty_out": 0.0, "value_change": 0.0, "items": set(), "warehouses": set(), "from_warehouses": set(), "to_warehouses": set(), "party": None}
		chosen = list(vouchers.values())
		if not chosen:
			return []
		lines = frappe.get_list(
			"Stock Ledger Entry", filters={"company": company, "is_cancelled": 0, "voucher_no": ["in", [entry["voucher_no"] for entry in chosen]]},
			fields=["voucher_type", "voucher_no", "item_code", "warehouse", "actual_qty", "stock_value_difference"], limit_page_length=0,
		)
		index = {(entry["voucher_type"], entry["voucher_no"]): entry for entry in chosen}
		for line in lines:
			entry = index.get((line.voucher_type, line.voucher_no))
			if not entry:
				continue
			qty = flt(line.actual_qty)
			entry["qty_in" if qty > 0 else "qty_out"] += abs(qty)
			entry["value_change"] += flt(line.stock_value_difference)
			entry["items"].add(line.item_code)
			entry["warehouses"].add(line.warehouse)
			entry["to_warehouses" if qty > 0 else "from_warehouses"].add(line.warehouse)
		# Party / purpose, only from vouchers the user may read.
		for doctype, field in PARTY_FIELDS.items():
			names = [entry["voucher_no"] for entry in chosen if entry["voucher_type"] == doctype]
			if not names or not frappe.has_permission(doctype, "read"):
				continue
			for row in frappe.get_list(doctype, filters={"name": ["in", names]}, fields=["name", field], limit_page_length=0):
				index[(doctype, row.name)]["party"] = row.get(field)
		codes = {code for entry in chosen for code in entry["items"]}
		item_names = {row.name: row.item_name for row in frappe.get_list("Item", filters={"name": ["in", list(codes)]}, fields=["name", "item_name"], limit_page_length=0)} if codes else {}
		for entry in chosen:
			items = sorted(entry.pop("items"))
			entry["item_count"] = len(items)
			entry["first_item"] = item_names.get(items[0], items[0]) if items else None
			entry["from_warehouses"] = sorted(entry["from_warehouses"])
			entry["to_warehouses"] = sorted(entry["to_warehouses"])
			entry["warehouses"] = sorted(entry["warehouses"])
			entry["value_change"] = round(entry["value_change"], 2)
			entry["posted_at"] = str(get_datetime(f"{entry['posting_date']} {entry['posting_time']}"))
		return chosen

	return {
		"company": company,
		"currency": frappe.get_cached_value("Company", company, "default_currency"),
		"as_of": today(),
		"weeks": weeks if not period else None,
		"period": period or f"{weeks}w",
		"stock_value": _section(stock_value),
		"stock_items": _section(stock_items),
		"pending_entries": _section(pending_entries),
		"low_stock": _section(low_stock),
		"top_items": _section(top_items),
		"trend": _section(trend),
		"activity": _section(activity),
	}
